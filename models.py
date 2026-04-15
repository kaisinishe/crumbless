from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from database import Base

# 👈 NEW: The Temporary Holding Zone for all unverified signups
class PendingVerification(Base):
    __tablename__ = "pending_verifications"
    id = Column(Integer, primary_key=True, index=True)
    login_id = Column(String, unique=True, index=True) # Email or Phone
    otp_code = Column(String)
    expires_at = Column(DateTime)
    payload = Column(String) # Stores the requested account info securely as a JSON string

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    
    phone = Column(String, unique=True, index=True, nullable=True)
    preferences = Column(String, default="")
    allergies = Column(String, default="")
    
    location = Column(Geometry('POINT', srid=4326))

    orders = relationship("Order", back_populates="user")

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String) 
    email = Column(String, unique=True, index=True) 
    phone = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String) 
    
    locations = relationship("StoreLocation", back_populates="company", cascade="all, delete-orphan")

class StoreLocation(Base):
    __tablename__ = "store_locations"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    
    name = Column(String) 
    address_text = Column(String) 
    
    location = Column(Geometry('POINT', srid=4326))
    
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    company = relationship("Company", back_populates="locations")
    bags = relationship("SurpriseBag", back_populates="store", cascade="all, delete-orphan")

class SurpriseBag(Base):
    __tablename__ = "surprise_bags"
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("store_locations.id")) 
    
    name = Column(String)  
    description = Column(String, nullable=True) 
    items_included = Column(String, nullable=True)
    image_url = Column(String, nullable=True)      
    
    quantity_available = Column(Integer, default=0)
    pickup_start = Column(DateTime)
    pickup_end = Column(DateTime)
    original_price = Column(Float)
    discounted_price = Column(Float)
    categorical_tags = Column(String) 

    store = relationship("StoreLocation", back_populates="bags")
    orders = relationship("Order", back_populates="bag")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    bag_id = Column(Integer, ForeignKey("surprise_bags.id"))
    quantity = Column(Integer, default=1)
    pickup_code = Column(String, unique=True, index=True)
    status = Column(String, default="reserved")

    user = relationship("User", back_populates="orders")
    bag = relationship("SurpriseBag", back_populates="orders")