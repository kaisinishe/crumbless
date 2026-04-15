import os
import shutil
import uuid
import json 
from dotenv import load_dotenv
load_dotenv()
stripe_key = os.getenv("STRIPE_SECRET_KEY")
import requests 
import smtplib  
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, BackgroundTasks 
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from sqlalchemy import func, Column, Integer, Float, String, ForeignKey, text
from geoalchemy2.elements import WKTElement
from geoalchemy2.types import Geography
from datetime import datetime, timedelta
import jwt
import random
import string
import stripe
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
import models
import schemas
import auth
from database import engine, SessionLocal
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from sqlalchemy.orm import Session
from database import SessionLocal # Adjust based on your db import
import models

def expire_missed_reservations():
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        # Find all active reservations
        active_orders = db.query(models.Order).filter(models.Order.status == "reserved").all()
        
        for order in active_orders:
            bag = db.query(models.SurpriseBag).filter(models.SurpriseBag.id == order.bag_id).first()
            # If the bag's pickup time has passed, mark it as missed
            if bag and bag.pickup_end < now:
                order.status = "missed"
        
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error running cron job: {e}")
    finally:
        db.close()

# Start the background scheduler when FastAPI starts
scheduler = BackgroundScheduler()
scheduler.add_job(expire_missed_reservations, 'interval', minutes=15)
scheduler.start()

# ==========================================
# CREDENTIALS & INTEGRATIONS
# ==========================================
TELEGRAM_BOT_TOKEN = "8793713698:AAHFpO0kEEQ5-ssny3IIbUGTD9aIxhzuesM"
TELEGRAM_CHAT_ID = "1020667452" 
# ⚠️ Replace this later with your real Client ID from the Google Cloud Console
GOOGLE_CLIENT_ID = "202570166276-fafj2daidvl6h251242foshni8sfdfjf.apps.googleusercontent.com"
# Google SMTP Setup
SENDER_EMAIL = "salvia.helpdesk@gmail.com"
SENDER_PASSWORD = "ptkhbowsqfjtandg" 
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

# --- Review Database Model ---
class Review(models.Base):
    __tablename__ = "reviews"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True)
    store_id = Column(Integer, ForeignKey("store_locations.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    rating = Column(Float)

models.Review = Review 

# --- Precision Order Logging Table ---
class OrderLog(models.Base):
    __tablename__ = "order_logs"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True)
    purchased_at = Column(String)
    completed_at = Column(String, nullable=True)

models.OrderLog = OrderLog 

models.Base.metadata.create_all(bind=engine) 

app = FastAPI(title="Salvia Enterprise API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# ==========================================
# THE "BOUNCER" (Role-Based Access Control)
# ==========================================
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        if email is None or role is None: raise credentials_exception
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise credentials_exception

    user = None
    if role == "client": user = db.query(models.User).filter(models.User.email == email).first()
    elif role == "store_manager": user = db.query(models.StoreLocation).filter(models.StoreLocation.email == email).first()
    elif role == "company_admin": user = db.query(models.Company).filter(models.Company.email == email).first()

    if user is None: raise credentials_exception

    user.role = role
    return user

# ==========================================
# OTP VERIFICATION HELPERS
# ==========================================
def generate_otp():
    return ''.join(random.choices(string.digits, k=6))

def send_verification_code(email: str, otp_code: str):
    try:
        msg = MIMEMultipart()
        msg['From'] = SENDER_EMAIL
        msg['To'] = email
        msg['Subject'] = "Your Salvia Verification Code"
        msg.attach(MIMEText(f"Welcome to Salvia!\n\nYour 6-digit verification code is: {otp_code}\n\nThis code will expire in 15 minutes.", 'plain'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.send_message(msg)
        server.quit()
    except Exception as e: 
        print(f"Failed to send OTP email: {e}")

def upsert_pending_verification(db: Session, email: str, payload_dict: dict):
    otp = generate_otp()
    pending = db.query(models.PendingVerification).filter(models.PendingVerification.login_id == email).first()
    
    if pending:
        pending.otp_code = otp
        pending.expires_at = datetime.now() + timedelta(minutes=15)
        pending.payload = json.dumps(payload_dict)
    else:
        pending = models.PendingVerification(
            login_id=email, otp_code=otp, expires_at=datetime.now() + timedelta(minutes=15), payload=json.dumps(payload_dict)
        )
        db.add(pending)
    db.commit()
    return otp

def is_email_taken(db: Session, email: str):
    """Strictly checks if an email is used in ANY account table."""
    if db.query(models.User).filter(models.User.email == email).first(): return True
    if db.query(models.Company).filter(models.Company.email == email).first(): return True
    if db.query(models.StoreLocation).filter(models.StoreLocation.email == email).first(): return True
    return False

# ==========================================
# AUTHENTICATION & LOGIN
# ==========================================
@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    role = "client"
    
    if not user:
        user = db.query(models.StoreLocation).filter(models.StoreLocation.email == form_data.username).first()
        role = "store_manager"
        
    if not user:
        user = db.query(models.Company).filter(models.Company.email == form_data.username).first()
        role = "company_admin"

    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    access_token = auth.create_access_token(data={"sub": user.email, "role": role, "id": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/google")
def google_auth(req: schemas.GoogleAuthRequest, db: Session = Depends(get_db)):
    """Handles Google Single Sign-On and auto-sorts Clients vs Businesses"""
    try:
        # 1. Verify token with Google
        idinfo = id_token.verify_oauth2_token(req.token, google_requests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo['email']
        name = idinfo.get('name', 'Google User')
        
        # 2. Check if this email exists ANYWHERE in our system
        existing_client = db.query(models.User).filter(models.User.email == email).first()
        existing_company = db.query(models.Company).filter(models.Company.email == email).first()
        existing_store = db.query(models.StoreLocation).filter(models.StoreLocation.email == email).first()
        
        user = None
        role = None
        
        if existing_client: user, role = existing_client, "client"
        elif existing_company: user, role = existing_company, "company_admin"
        elif existing_store: user, role = existing_store, "store_manager"

        # 3. Handle Existing Users
        if user:
            if req.intended_role == "company_admin" and role != "company_admin":
                raise HTTPException(status_code=400, detail="This Google account is already registered as a Client. Please use a different email for your HQ.")
            
            access_token = auth.create_access_token(data={"sub": user.email, "role": role, "id": user.id})
            return {"access_token": access_token, "token_type": "bearer"}

        # 4. Handle BRAND NEW Users based on where they clicked the button
        if req.intended_role == "company_admin":
            new_company = models.Company(email=email, name=name, hashed_password="")
            db.add(new_company)
            db.commit()
            db.refresh(new_company)
            access_token = auth.create_access_token(data={"sub": new_company.email, "role": "company_admin", "id": new_company.id})
            return {"access_token": access_token, "token_type": "bearer"}
        else:
            new_client = models.User(email=email, name=name, hashed_password="", location='SRID=4326;POINT(28.8320 47.0250)')
            db.add(new_client)
            db.commit()
            db.refresh(new_client)
            access_token = auth.create_access_token(data={"sub": new_client.email, "role": "client", "id": new_client.id})
            return {"access_token": access_token, "token_type": "bearer"}

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Google authentication.")

# ==========================================
# REGISTRATION & VERIFICATION ENDPOINTS
# ==========================================
@app.post("/register", status_code=status.HTTP_202_ACCEPTED)
def register_user(user: schemas.UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    email_clean = user.email.strip().lower()
    
    if is_email_taken(db, email_clean):
        raise HTTPException(status_code=400, detail="This email is already registered.")
    
    payload = {"role": "client", "email": email_clean, "name": user.name.strip(), "password": auth.get_password_hash(user.password)}
    otp = upsert_pending_verification(db, email_clean, payload)
    
    background_tasks.add_task(send_verification_code, email_clean, otp)
    return {"message": "Verification code sent."}

@app.post("/companies/register", status_code=status.HTTP_202_ACCEPTED)
def register_company(company: schemas.CompanyCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    email_clean = company.email.strip().lower()
    
    if is_email_taken(db, email_clean):
        raise HTTPException(status_code=400, detail="This email is already registered.")
    
    payload = {"role": "company_admin", "email": email_clean, "name": company.name.strip(), "password": auth.get_password_hash(company.password)}
    otp = upsert_pending_verification(db, email_clean, payload)
    
    background_tasks.add_task(send_verification_code, email_clean, otp)
    return {"message": "Verification code sent."}

@app.post("/verify-otp")
def verify_otp(req: schemas.OTPVerifyRequest, db: Session = Depends(get_db)):
    email_clean = req.email.strip().lower()
    incoming_otp = ''.join(filter(str.isdigit, req.otp_code)) 
    
    pending = db.query(models.PendingVerification).filter(func.lower(models.PendingVerification.login_id) == email_clean).first()
    
    if not pending: raise HTTPException(status_code=404, detail="No pending registration found.")
    if pending.expires_at and datetime.now() > pending.expires_at:
        db.delete(pending)
        db.commit()
        raise HTTPException(status_code=400, detail="Code expired. Please sign up again.")
        
    if ''.join(filter(str.isdigit, str(pending.otp_code))) != incoming_otp:
        raise HTTPException(status_code=400, detail="Incorrect verification code.")
        
    data = json.loads(pending.payload)
    
    try:
        if data["role"] == "client":
            new_account = models.User(email=data["email"], name=data["name"], hashed_password=data["password"], location='SRID=4326;POINT(28.8320 47.0250)')
        elif data["role"] == "company_admin":
            new_account = models.Company(email=data["email"], name=data["name"], hashed_password=data["password"])
            
        db.add(new_account)
        db.delete(pending) 
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error creating account.")
    
    return {"message": "Account successfully verified!"}

@app.post("/resend-otp")
def resend_otp(req: schemas.OTPResendRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    email_clean = req.email.strip().lower()
    pending = db.query(models.PendingVerification).filter(func.lower(models.PendingVerification.login_id) == email_clean).first()
    if not pending: raise HTTPException(status_code=404, detail="No pending registration found.")
        
    otp = generate_otp()
    pending.otp_code = otp
    pending.expires_at = datetime.now() + timedelta(minutes=15)
    db.commit()
    background_tasks.add_task(send_verification_code, email_clean, otp)
    return {"message": "A new code has been sent."}

@app.post("/locations/register", response_model=schemas.StoreLocationResponse, status_code=status.HTTP_201_CREATED)
def register_store_location(store: schemas.StoreLocationCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "company_admin": raise HTTPException(status_code=403, detail="Unauthorized")
    if is_email_taken(db, store.email.strip().lower()): raise HTTPException(status_code=400, detail="Email already registered.")
        
    point = f"SRID=4326;POINT({store.lon} {store.lat})"
    new_store = models.StoreLocation(
        company_id=current_user.id, name=store.name, email=store.email.strip().lower(), address_text=store.address_text,
        location=WKTElement(point, srid=4326), hashed_password=auth.get_password_hash(store.password)
    )
    db.add(new_store)
    db.commit()
    db.refresh(new_store)
    return new_store

# ==========================================
# CLIENT MAP & POSTGIS
# ==========================================
@app.get("/bags/nearby")
def get_nearby_bags(lat: float, lon: float, radius_km: float = 5.0, db: Session = Depends(get_db)):
    user_location = f"SRID=4326;POINT({lon} {lat})"
    radius_meters = radius_km * 1000
    now = datetime.now() 

    results = (
        db.query(
            models.SurpriseBag,
            models.StoreLocation.name.label("store_name"),
            models.StoreLocation.address_text,
            func.ST_AsText(models.StoreLocation.location).label("gps_text"),
            func.ST_Distance(
                func.cast(models.StoreLocation.location, Geography),
                func.cast(user_location, Geography)
            ).label("distance_meters")
        )
        .join(models.StoreLocation, models.SurpriseBag.store_id == models.StoreLocation.id)
        .filter(models.SurpriseBag.quantity_available > 0)
        .filter(models.SurpriseBag.pickup_end > now) 
        .filter(func.ST_DWithin(
            func.cast(models.StoreLocation.location, Geography),
            func.cast(user_location, Geography),
            radius_meters
        ))
        .order_by("distance_meters")
        .all()
    )

    store_ids = [r[0].store_id for r in results]
    ratings = db.query(models.Review.store_id, func.avg(models.Review.rating).label('avg')).filter(models.Review.store_id.in_(store_ids)).group_by(models.Review.store_id).all()
    rating_dict = {r.store_id: round(r.avg, 1) for r in ratings}

    final_bags = []
    for bag, store_name, address_text, gps_text, dist in results:
        coords = gps_text.replace("POINT(", "").replace(")", "").split()
        bag_data = {
            "id": bag.id,
            "store_id": bag.store_id,
            "store_name": store_name,
            "address_text": address_text,
            "quantity_available": bag.quantity_available,
            "original_price": bag.original_price,
            "discounted_price": bag.discounted_price,
            "categorical_tags": bag.categorical_tags,
            "pickup_start": bag.pickup_start,
            "pickup_end": bag.pickup_end,
            "name": bag.name,
            "description": bag.description,
            "image_url": bag.image_url,
            "lat": float(coords[1]),
            "lon": float(coords[0]),
            "distance_km": round(dist / 1000, 2),
            "avg_rating": rating_dict.get(bag.store_id, 0.0)
        }
        final_bags.append(bag_data)
        
    return final_bags

@app.get("/bags/bbox")
def get_bags_in_bbox(
    ne_lat: float, ne_lon: float,
    sw_lat: float, sw_lon: float,
    user_lat: float, user_lon: float,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    bbox = func.ST_MakeEnvelope(sw_lon, sw_lat, ne_lon, ne_lat, 4326)
    now = datetime.now()

    bags = db.query(
        models.SurpriseBag,
        func.ST_Y(models.StoreLocation.location).label('lat'),
        func.ST_X(models.StoreLocation.location).label('lon')
    ).join(models.StoreLocation).filter(
        models.SurpriseBag.quantity_available > 0,
        models.SurpriseBag.pickup_end > now, 
        func.ST_Intersects(models.StoreLocation.location, bbox)  
    ).limit(limit).all()

    store_ids = [b[0].store_id for b in bags]
    ratings = db.query(models.Review.store_id, func.avg(models.Review.rating).label('avg')).filter(models.Review.store_id.in_(store_ids)).group_by(models.Review.store_id).all()
    rating_dict = {r.store_id: round(r.avg, 1) for r in ratings}

    from geopy.distance import geodesic
    results = []
    
    for bag, lat, lon in bags:
        bag_data = bag.__dict__.copy()
        bag_data.pop('_sa_instance_state', None) 
        
        bag_data["store_name"] = bag.store.name
        bag_data["address_text"] = bag.store.address_text
        bag_data["lat"] = lat
        bag_data["lon"] = lon
        
        bag_data["distance_km"] = round(geodesic((user_lat, user_lon), (lat, lon)).kilometers, 2)
        bag_data["avg_rating"] = rating_dict.get(bag.store_id, 0.0) 
        results.append(bag_data)
        
    results.sort(key=lambda x: x["distance_km"])
    return results

# ==========================================
# LOCAL SCHEMAS 
# ==========================================
class CheckoutSessionRequest(BaseModel):
    bag_id: int

class PaymentConfirmRequest(BaseModel):
    session_id: str
    bag_id: int

class VerifyOrderRequest(BaseModel):
    pickup_code: str

class SupportReportRequest(BaseModel):
    order_id: int
    reason: str
    details: str

class ReviewCreate(BaseModel):
    rating: float

class CompanyProfileUpdate(BaseModel):
    name: str = None
    phone: str = None

class StoreProfileUpdate(BaseModel):
    name: str = None
    address_text: str = None

class UserProfileUpdate(BaseModel):
    name: str = None
    phone: str = None
    preferences: str = None
    allergies: str = None


@app.post("/create-checkout-session")
def create_checkout_session(req: CheckoutSessionRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "client":
        raise HTTPException(status_code=403, detail="Only clients can purchase bags.")
        
    bag = db.query(models.SurpriseBag).filter(models.SurpriseBag.id == req.bag_id).first()

    now = datetime.now()
    if not bag:
        raise HTTPException(status_code=404, detail="Bag not found.")
    if bag.quantity_available < 1:
        raise HTTPException(status_code=400, detail="Bag sold out.")
    if now > bag.pickup_end:
        raise HTTPException(status_code=400, detail="This bag has expired and is no longer available.")

    price_in_bani = int(bag.discounted_price * 100)

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'mdl', 
                    'product_data': {
                        'name': f"Surprise Bag: {bag.categorical_tags}",
                    },
                    'unit_amount': price_in_bani,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"http://localhost:5173/payment-success?session_id={{CHECKOUT_SESSION_ID}}&bag_id={bag.id}",
            cancel_url="http://localhost:5173/map",
        )
        return {"checkout_url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/orders/confirm-payment")
def confirm_payment(req: PaymentConfirmRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "client":
        raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        session = stripe.checkout.Session.retrieve(req.session_id)
        if session.payment_status != "paid":
            raise HTTPException(status_code=400, detail="Payment was not completed.")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Stripe session.")

    bag = db.query(models.SurpriseBag).filter(models.SurpriseBag.id == req.bag_id).with_for_update().first()
    
    if not bag or bag.quantity_available < 1:
        raise HTTPException(status_code=400, detail="Bag sold out during checkout! Please contact support for a refund.")

    bag.quantity_available -= 1
    
    pickup_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    new_order = models.Order(
        user_id=current_user.id,
        bag_id=bag.id,
        pickup_code=pickup_code,
        status="reserved"
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    new_log = models.OrderLog(order_id=new_order.id, purchased_at=datetime.now().isoformat())
    db.add(new_log)
    db.commit()
    
    return {"message": "Order confirmed!", "pickup_code": new_order.pickup_code}

@app.get("/orders/me")
def get_my_orders(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "client":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    orders = db.query(
        models.Order.id,
        models.Order.pickup_code,
        models.Order.status,
        models.SurpriseBag.categorical_tags,
        models.SurpriseBag.name.label("bag_name"),               
        models.SurpriseBag.description.label("bag_description"), 
        models.SurpriseBag.pickup_start,  # 👈 Added
        models.SurpriseBag.pickup_end,    # 👈 Added
        models.StoreLocation.name.label("store_name"),
        models.StoreLocation.address_text,
        func.ST_AsText(models.StoreLocation.location).label("gps_text"),
        models.Review.id.label("review_id")
    ).join(
        models.SurpriseBag, models.Order.bag_id == models.SurpriseBag.id
    ).join(
        models.StoreLocation, models.SurpriseBag.store_id == models.StoreLocation.id
    ).outerjoin(
        models.Review, models.Order.id == models.Review.order_id
    ).filter(
        models.Order.user_id == current_user.id
    ).order_by(models.Order.id.desc()).all()
    
    result = []
    for o in orders:
        coords = o.gps_text.replace("POINT(", "").replace(")", "").split()
        result.append({
            "id": o.id,
            "pickup_code": o.pickup_code,
            "status": o.status,
            "categorical_tags": o.categorical_tags,
            "bag_name": o.bag_name,               
            "bag_description": o.bag_description, 
            "pickup_start": o.pickup_start,  # 👈 Added
            "pickup_end": o.pickup_end,      # 👈 Added
            "store_name": o.store_name,
            "address_text": o.address_text,
            "lat": float(coords[1]),
            "lon": float(coords[0]),
            "is_reviewed": True if o.review_id else False 
        })
    return result

@app.get("/locations/me/orders")
def get_store_orders(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "store_manager":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    orders = db.query(
        models.Order.id.label("order_id"),
        models.Order.pickup_code,
        models.Order.status,
        models.SurpriseBag.categorical_tags,
        models.SurpriseBag.pickup_start,
        models.SurpriseBag.pickup_end,
        models.OrderLog.purchased_at,       
        models.OrderLog.completed_at        
    ).join(
        models.SurpriseBag, models.Order.bag_id == models.SurpriseBag.id
    ).outerjoin(                                
        models.OrderLog, models.Order.id == models.OrderLog.order_id
    ).filter(
        models.SurpriseBag.store_id == current_user.id
    ).order_by(models.Order.id.desc()).all()
    
    return [{
        "order_id": o.order_id, 
        "pickup_code": o.pickup_code, 
        "status": o.status, 
        "categorical_tags": o.categorical_tags, 
        "pickup_start": o.pickup_start, 
        "pickup_end": o.pickup_end,
        "purchased_at": o.purchased_at,     
        "completed_at": o.completed_at      
    } for o in orders]

@app.patch("/orders/verify")
def verify_order(req: VerifyOrderRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "store_manager":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    result = (
        db.query(models.Order, models.SurpriseBag)
        .join(models.SurpriseBag, models.Order.bag_id == models.SurpriseBag.id)
        .filter(
            models.Order.pickup_code == req.pickup_code,
            models.SurpriseBag.store_id == current_user.id
        )
        .first()
    )
    
    if not result:
        raise HTTPException(status_code=400, detail="Invalid code.")
        
    order, bag = result
        
    if order.status == "completed":
        raise HTTPException(status_code=400, detail="Order already completed.")
        
    now = datetime.now()
    if now < bag.pickup_start:
        raise HTTPException(status_code=400, detail="Too early! The pickup window hasn't started yet.")
    if now > bag.pickup_end:
        raise HTTPException(status_code=400, detail="Too late! The pickup window has already closed.")
        
    order.status = "completed"
    
    log = db.query(models.OrderLog).filter(models.OrderLog.order_id == order.id).first()
    if log:
        log.completed_at = datetime.now().isoformat()
        
    db.commit()
    return {"message": "Order verified"}

@app.patch("/orders/{order_id}/cancel")
def cancel_order(order_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "client":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    order = db.query(models.Order).filter(models.Order.id == order_id, models.Order.user_id == current_user.id).first()
    if not order or order.status != "reserved":
        raise HTTPException(status_code=400, detail="Invalid order.")
        
    bag = db.query(models.SurpriseBag).filter(models.SurpriseBag.id == order.bag_id).with_for_update().first()
    
    time_until_pickup = bag.pickup_start - datetime.now()
    is_refundable = time_until_pickup > timedelta(hours=1)
    
    order.status = "cancelled"
    bag.quantity_available += 1 
    db.commit()
    
    return {"detail": "Refund processed." if is_refundable else "Cancelled less than 1 hour before pickup. No refund."}

@app.post("/support/report")
def submit_report(req: SupportReportRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "client":
        raise HTTPException(status_code=403, detail="Only clients can report issues.")
        
    order = db.query(models.Order).filter(models.Order.id == req.order_id, models.Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    bag = db.query(models.SurpriseBag).filter(models.SurpriseBag.id == order.bag_id).first()
    store = db.query(models.StoreLocation).filter(models.StoreLocation.id == bag.store_id).first()
    
    ticket_body = (
        f"🚨 SALVIA SUPPORT TICKET 🚨\n\n"
        f"From: {current_user.name} ({current_user.email})\n"
        f"Regarding: Order #{order.id}\n"
        f"Store: {store.name}\n"
        f"Issue Category: {req.reason}\n\n"
        f"Customer Comments:\n{req.details}\n\n"
        f"---\n"
        f"Please review this incident in your dashboard."
    )
    
    background_tasks.add_task(send_telegram_alert, ticket_body)
    background_tasks.add_task(send_store_email, store.email, f"Salvia Issue Report: Order #{order.id}", ticket_body)
    
    return {"message": "Report submitted successfully. We are on it!"}

@app.post("/orders/{order_id}/review")
def leave_review(order_id: int, req: ReviewCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "client":
        raise HTTPException(status_code=403, detail="Only clients can leave reviews.")
        
    order = db.query(models.Order).filter(models.Order.id == order_id, models.Order.user_id == current_user.id).first()
    if not order or order.status != "completed":
        raise HTTPException(status_code=400, detail="Can only review completed orders.")
        
    if db.query(models.Review).filter(models.Review.order_id == order_id).first():
        raise HTTPException(status_code=400, detail="Order already reviewed.")
        
    bag = db.query(models.SurpriseBag).filter(models.SurpriseBag.id == order.bag_id).first()
    new_review = models.Review(order_id=order_id, store_id=bag.store_id, user_id=current_user.id, rating=req.rating)
    
    db.add(new_review)
    db.commit()
    return {"message": "Review submitted successfully!"}

@app.get("/companies/me/profile")
def get_company_profile(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "company_admin": raise HTTPException(status_code=403, detail="Unauthorized")
    return {
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
        "has_password": bool(current_user.hashed_password) # 👈 NEW
    }

@app.patch("/companies/me/profile")
def update_company_profile(req: CompanyProfileUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "company_admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    if req.name: current_user.name = req.name
    if req.phone is not None: current_user.phone = req.phone
    db.commit()
    return {"message": "Company profile updated successfully!"}

@app.get("/companies/me/stats")
def get_hq_stats(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "company_admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    stores = db.query(models.StoreLocation).filter(models.StoreLocation.company_id == current_user.id).all()
    store_ids = [s.id for s in stores]

    completed_orders = db.query(models.SurpriseBag.discounted_price).join(
        models.Order, models.Order.bag_id == models.SurpriseBag.id
    ).filter(
        models.SurpriseBag.store_id.in_(store_ids),
        models.Order.status == "completed"
    ).all()

    canceled_count = db.query(models.Order).join(
        models.SurpriseBag, models.Order.bag_id == models.SurpriseBag.id
    ).filter(
        models.SurpriseBag.store_id.in_(store_ids),
        models.Order.status == "cancelled"
    ).count()

    reviews = db.query(models.Review).filter(models.Review.store_id.in_(store_ids)).all()
    avg_rating = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else 0.0

    total_revenue = sum([price[0] for price in completed_orders]) if completed_orders else 0
    bags_sold = len(completed_orders)

    return {
        "total_revenue": total_revenue,
        "bags_sold": bags_sold,
        "canceled_orders": canceled_count,
        "rating": avg_rating
    }

@app.get("/companies/me/all_orders")
def get_hq_all_orders(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "company_admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    store_ids = [s.id for s in db.query(models.StoreLocation).filter(models.StoreLocation.company_id == current_user.id).all()]
    
    orders = db.query(
        models.Order.id.label("order_id"), models.Order.status, models.SurpriseBag.pickup_start, models.SurpriseBag.store_id
    ).join(models.SurpriseBag, models.Order.bag_id == models.SurpriseBag.id).filter(
        models.SurpriseBag.store_id.in_(store_ids),
        models.Order.status.in_(["reserved", "completed"])
    ).all()
    
    result = []
    for o in orders:
        log = db.query(models.OrderLog).filter(models.OrderLog.order_id == o.order_id).first()
        p_time = log.purchased_at if log else str(o.pickup_start)
        c_time = log.completed_at if log and log.completed_at else None
        result.append({
            "order_id": o.order_id, "status": o.status, "store_id": o.store_id,
            "purchased_at": p_time, "completed_at": c_time
        })
    return result

@app.get("/companies/me/locations", response_model=list[schemas.StoreLocationResponse])
def get_company_locations(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "company_admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    return db.query(models.StoreLocation).filter(models.StoreLocation.company_id == current_user.id).all() 

@app.get("/companies/me/locations/{store_id}/stats")
def get_hq_store_stats(store_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "company_admin": raise HTTPException(status_code=403)
    
    completed_orders = db.query(models.SurpriseBag.discounted_price).join(
        models.Order, models.Order.bag_id == models.SurpriseBag.id
    ).filter(models.SurpriseBag.store_id == store_id, models.Order.status == "completed").all()

    canceled_count = db.query(models.Order).join(
        models.SurpriseBag, models.Order.bag_id == models.SurpriseBag.id
    ).filter(models.SurpriseBag.store_id == store_id, models.Order.status == "cancelled").count()

    reviews = db.query(models.Review).filter(models.Review.store_id == store_id).all()
    avg_rating = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else 0.0

    bags_sold = len(completed_orders)
    return {
        "total_revenue": sum([price[0] for price in completed_orders]) if completed_orders else 0,
        "bags_sold": bags_sold, 
        "canceled_orders": canceled_count, 
        "rating": avg_rating 
    }

@app.get("/companies/me/locations/{store_id}/inventory")
def get_hq_store_inventory(store_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "company_admin": raise HTTPException(status_code=403)
    bags = db.query(models.SurpriseBag).filter(models.SurpriseBag.store_id == store_id).all()
    
    result = jsonable_encoder(bags)
    
    for i, bag in enumerate(bags):
        orders = db.query(models.Order).filter(models.Order.bag_id == bag.id, models.Order.status.in_(["reserved", "completed"])).all()
        result[i]["sold_count"] = len(orders)
        sales_history = []
        for o in orders:
            log = db.query(models.OrderLog).filter(models.OrderLog.order_id == o.id).first()
            p_time = log.purchased_at if log else str(bag.pickup_start)
            c_time = log.completed_at if log and log.completed_at else None
            sales_history.append({ "order_id": o.id, "purchased_at": p_time, "completed_at": c_time, "status": o.status })
        result[i]["sales_history"] = sales_history
    return result

@app.get("/companies/me/locations/{store_id}/orders")
def get_hq_store_orders(store_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "company_admin": raise HTTPException(status_code=403)
    orders = db.query(
        models.Order.id.label("order_id"), models.Order.pickup_code, models.Order.status,
        models.SurpriseBag.categorical_tags, models.SurpriseBag.pickup_start, models.SurpriseBag.pickup_end
    ).join(models.SurpriseBag, models.Order.bag_id == models.SurpriseBag.id).filter(models.SurpriseBag.store_id == store_id).order_by(models.Order.id.desc()).all()
    return [{"order_id": o.order_id, "pickup_code": o.pickup_code, "status": o.status, "categorical_tags": o.categorical_tags, "pickup_start": o.pickup_start, "pickup_end": o.pickup_end} for o in orders]


# ==========================================
# HQ OVERRIDE: Update Store Details
# ==========================================
@app.patch("/companies/me/locations/{store_id}")
def hq_update_store(store_id: int, req: schemas.HQStoreUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "company_admin": 
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    store = db.query(models.StoreLocation).filter(
        models.StoreLocation.id == store_id, 
        models.StoreLocation.company_id == current_user.id
    ).first()
    
    if not store: 
        raise HTTPException(status_code=404, detail="Store not found")

    if req.name: store.name = req.name
    if req.address_text: store.address_text = req.address_text
    
    if req.email:
        email_clean = req.email.strip().lower()
        if email_clean != store.email and is_email_taken(db, email_clean):
            raise HTTPException(status_code=400, detail="This email is already in use by another account.")
        store.email = email_clean

    if req.password:
        store.hashed_password = auth.get_password_hash(req.password)

    db.commit()
    return {"message": "Store updated successfully!"}



@app.delete("/companies/me/locations/{location_id}")
def delete_company_location(location_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "company_admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    store = db.query(models.StoreLocation).filter(
        models.StoreLocation.id == location_id,
        models.StoreLocation.company_id == current_user.id
    ).first()
    
    if not store:
        raise HTTPException(status_code=404, detail="Store not found.")
        
    db.delete(store)
    db.commit()
    return {"message": "Store successfully deleted."}

# ==========================================
# UNIVERSAL SECURITY ENDPOINTS (Clients, Stores, HQ)
# ==========================================
@app.post("/auth/change-password")
def change_password(req: schemas.PasswordChangeRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # 👈 If they have a password, verify the old one. If not, skip it!
    if current_user.hashed_password:
        if not req.old_password or not auth.verify_password(req.old_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Incorrect current password.")
        
    current_user.hashed_password = auth.get_password_hash(req.new_password)
    db.commit()
    return {"message": "Password updated successfully!"}

@app.post("/auth/change-email/request")
def request_email_change(req: schemas.EmailChangeRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    new_email = req.new_email.strip().lower()
    
    if new_email == current_user.email:
        raise HTTPException(status_code=400, detail="This is already your current email.")
    if is_email_taken(db, new_email):
        raise HTTPException(status_code=400, detail="This email is already registered to an active account.")

    payload = {"action": "change_email", "user_id": current_user.id, "role": current_user.role, "new_email": new_email}
    otp = upsert_pending_verification(db, new_email, payload)

    background_tasks.add_task(send_verification_code, new_email, otp)
    return {"message": "Verification code sent to the new email address."}

@app.post("/auth/change-email/verify")
def verify_email_change(req: schemas.EmailChangeVerify, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    new_email = req.new_email.strip().lower()
    incoming_otp = ''.join(filter(str.isdigit, req.otp_code))

    pending = db.query(models.PendingVerification).filter(func.lower(models.PendingVerification.login_id) == new_email).first()
    if not pending: raise HTTPException(status_code=404, detail="No pending email change request found.")
    if pending.expires_at and datetime.now() > pending.expires_at:
        db.delete(pending)
        db.commit()
        raise HTTPException(status_code=400, detail="Code expired. Please request a new one.")
    if ''.join(filter(str.isdigit, str(pending.otp_code))) != incoming_otp:
        raise HTTPException(status_code=400, detail="Incorrect verification code.")

    data = json.loads(pending.payload)
    if data.get("action") != "change_email" or data.get("user_id") != current_user.id or data.get("role") != current_user.role:
        raise HTTPException(status_code=400, detail="Invalid request payload.")

    if req.change_password:
        if not req.new_password:
            raise HTTPException(status_code=400, detail="New password is required.")
        # 👈 If they have a password, verify the old one. If not, skip it!
        if current_user.hashed_password:
            if not req.old_password or not auth.verify_password(req.old_password, current_user.hashed_password):
                raise HTTPException(status_code=400, detail="Incorrect current password.")
                
        current_user.hashed_password = auth.get_password_hash(req.new_password)

    current_user.email = new_email
    db.delete(pending)
    db.commit()
    return {"message": "Account credentials updated successfully!"}


@app.get("/reset-db")
def reset_database(db: Session = Depends(get_db)):
    drop_query = """
        DROP TABLE IF EXISTS 
        reviews, order_logs, orders, surprise_bags, store_locations, 
        companies, users, pending_verifications CASCADE;
    """
    db.execute(text(drop_query))
    db.commit()
    
    models.Base.metadata.create_all(bind=engine)
    
    return {"message": "Enterprise Database force-wiped and perfectly recreated!"}

@app.get("/locations/me/profile")
def get_store_profile(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "store_manager": raise HTTPException(status_code=403, detail="Unauthorized")
    return {
        "name": current_user.name,
        "email": current_user.email,
        "address_text": current_user.address_text,
        "has_password": bool(current_user.hashed_password) # 👈 NEW
    }

@app.patch("/locations/me/profile")
def update_store_profile(req: schemas.StoreProfileUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "store_manager":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    if req.name: 
        current_user.name = req.name
    if req.address_text: 
        current_user.address_text = req.address_text
        
    # 👇 NEW: Update the spatial map coordinates if they are provided
    if req.lat is not None and req.lon is not None:
        current_user.location = f"POINT({req.lon} {req.lat})"
    
    db.commit()
    return {"message": "Store profile updated successfully!"}

@app.post("/upload-image")
def upload_image(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    if current_user.role != "store_manager":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    file_ext = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    file_path = f"uploads/{unique_filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"image_url": f"http://localhost:8000/{file_path}"}

@app.get("/locations/me/stats")
def get_store_stats(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "store_manager":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    completed_orders = db.query(models.SurpriseBag.discounted_price).join(
        models.Order, models.Order.bag_id == models.SurpriseBag.id
    ).filter(
        models.SurpriseBag.store_id == current_user.id,
        models.Order.status == "completed"
    ).all()

    canceled_count = db.query(models.Order).join(
        models.SurpriseBag, models.Order.bag_id == models.SurpriseBag.id
    ).filter(
        models.SurpriseBag.store_id == current_user.id,
        models.Order.status == "cancelled"
    ).count()

    reviews = db.query(models.Review).filter(models.Review.store_id == current_user.id).all()
    avg_rating = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else 0.0

    total_revenue = sum([price[0] for price in completed_orders]) if completed_orders else 0
    bags_sold = len(completed_orders)

    return {
        "total_revenue": total_revenue,
        "bags_sold": bags_sold,
        "canceled_orders": canceled_count,
        "rating": avg_rating 
    }

@app.get("/inventory/store")
def get_store_inventory(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "store_manager": 
        raise HTTPException(status_code=403, detail="Only stores can view this dashboard.")
        
    bags = db.query(models.SurpriseBag).filter(models.SurpriseBag.store_id == current_user.id).all()
    
    result = jsonable_encoder(bags)
    
    for i, bag in enumerate(bags):
        orders = db.query(models.Order).filter(
            models.Order.bag_id == bag.id, 
            models.Order.status.in_(["reserved", "completed"])
        ).all()
        result[i]["sold_count"] = len(orders)
        
        sales_history = []
        for o in orders:
            log = db.query(models.OrderLog).filter(models.OrderLog.order_id == o.id).first()
            p_time = log.purchased_at if log else bag.pickup_start.isoformat() if hasattr(bag.pickup_start, 'isoformat') else str(bag.pickup_start)
            c_time = log.completed_at if log and log.completed_at else None
            
            sales_history.append({
                "order_id": o.id,
                "purchased_at": p_time,
                "completed_at": c_time,
                "status": o.status
            })
        result[i]["sales_history"] = sales_history
        
    return result

@app.post("/inventory/register-bag")
def create_inventory_bag(bag: schemas.SurpriseBagCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "store_manager": 
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    new_bag = models.SurpriseBag(
        store_id=current_user.id,
        **bag.model_dump(exclude_none=True)
    )
    db.add(new_bag)
    db.commit()
    return {"message": "Bag created successfully!"}

@app.patch("/inventory/{bag_id}")
def update_inventory_bag(bag_id: int, bag_update: schemas.SurpriseBagUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "store_manager": 
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    bag = db.query(models.SurpriseBag).filter(models.SurpriseBag.id == bag_id, models.SurpriseBag.store_id == current_user.id).first()
    if not bag:
        raise HTTPException(status_code=404, detail="Bag not found")
        
    for key, value in bag_update.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(bag, key, value)
        
    db.commit()
    return {"message": "Bag updated!"}

@app.patch("/inventory/{bag_id}/quantity")
def update_inventory_quantity(bag_id: int, req: dict, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "store_manager": 
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    bag = db.query(models.SurpriseBag).filter(models.SurpriseBag.id == bag_id, models.SurpriseBag.store_id == current_user.id).first()
    if not bag:
        raise HTTPException(status_code=404, detail="Bag not found")
        
    bag.quantity_available = max(0, bag.quantity_available + req.get("delta", 0))
    db.commit()
    return {"message": "Quantity updated"}

@app.delete("/inventory/{bag_id}")
def delete_inventory_bag(bag_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "store_manager": 
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    bag = db.query(models.SurpriseBag).filter(models.SurpriseBag.id == bag_id, models.SurpriseBag.store_id == current_user.id).first()
    if bag:
        db.delete(bag)
        db.commit()
    return {"message": "Bag deleted"}

@app.patch("/users/me/profile")
def update_profile(req: schemas.UserProfileUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "client":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    if req.name is not None: current_user.name = req.name
    if req.phone is not None:
        if req.phone and not req.phone.startswith("+"):
            raise HTTPException(status_code=400, detail="Phone number must start with country code (e.g., +373)")
        current_user.phone = req.phone
        
    if req.preferences is not None: current_user.preferences = req.preferences
    if req.allergies is not None: current_user.allergies = req.allergies
    
    db.commit()
    return {"message": "Profile updated successfully!"}

@app.get("/users/me/impact")
def get_user_impact(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "client":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    completed_orders = db.query(models.SurpriseBag).join(
        models.Order, models.Order.bag_id == models.SurpriseBag.id
    ).filter(
        models.Order.user_id == current_user.id,
        models.Order.status == "completed"
    ).all()

    total_spent = sum([bag.discounted_price for bag in completed_orders])
    total_value = sum([bag.original_price for bag in completed_orders])
    
    meals_saved = len(completed_orders)
    money_saved = total_value - total_spent
    co2_saved = round(meals_saved * 2.5, 1)

    return {
        "meals_saved": meals_saved,
        "money_saved": money_saved,
        "co2_saved": co2_saved,
        "user_details": {
            "name": current_user.name,
            "email": current_user.email,
            "phone": current_user.phone or "",
            "has_password": bool(current_user.hashed_password),
            "preferences": current_user.preferences.split(',') if current_user.preferences else [],
            "allergies": current_user.allergies.split(',') if current_user.allergies else []
        }
    }