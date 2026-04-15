from typing import Optional

from pydantic import BaseModel
from datetime import datetime

# ==========================================
# AUTHENTICATION SCHEMAS
# ==========================================
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None
    role: str | None = None

class GoogleAuthRequest(BaseModel):
    token: str
    intended_role: str = "client"

# ==========================================
# UNIVERSAL SECURITY & EMAIL CHANGE SCHEMAS
# ==========================================
class PasswordChangeRequest(BaseModel):
    old_password: str | None = None # 👈 Made optional for Google users
    new_password: str

class EmailChangeRequest(BaseModel):
    new_email: str

class EmailChangeVerify(BaseModel):
    new_email: str
    otp_code: str
    change_password: bool = False
    old_password: str | None = None
    new_password: str | None = None

# ==========================================
# OTP & VERIFICATION SCHEMAS
# ==========================================
class OTPVerifyRequest(BaseModel):
    email: str 
    otp_code: str

class OTPResendRequest(BaseModel):
    email: str

# ==========================================
# USER (CLIENT) SCHEMAS
# ==========================================
class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str

    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    preferences: str | None = None
    allergies: str | None = None

# ==========================================
# COMPANY (HQ) SCHEMAS
# ==========================================
class CompanyCreate(BaseModel):
    email: str
    password: str
    name: str

class CompanyResponse(BaseModel):
    id: int
    email: str
    phone: str | None = None 
    name: str

    class Config:
        from_attributes = True

class CompanyProfileUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None

# ==========================================
# STORE LOCATION (BRANCH) SCHEMAS
# ==========================================
class StoreLocationCreate(BaseModel):
    name: str
    email: str 
    password: str 
    address_text: str 
    lat: float
    lon: float

class StoreLocationResponse(BaseModel):
    id: int
    company_id: int
    name: str
    email: str
    address_text: str

    class Config:
        from_attributes = True

class StoreProfileUpdate(BaseModel):
    name: str | None = None
    address_text: str | None = None
    lat: float | None = None  # 👈 Add this
    lon: float | None = None  # 👈 Add this

class HQStoreUpdate(BaseModel):
    name: str | None = None
    address_text: str | None = None
    email: str | None = None
    password: str | None = None # 👈 HQ override still allows forceful password resets

# ==========================================
# SURPRISE BAG SCHEMAS
# ==========================================
class SurpriseBagBase(BaseModel):
    name: str 
    quantity_available: int
    original_price: float
    discounted_price: float
    categorical_tags: str
    pickup_start: datetime
    pickup_end: datetime
    description: str | None = None
    items_included: str | None = None 
    image_url: str | None = None

class SurpriseBagCreate(SurpriseBagBase):
    pass 

class SurpriseBagUpdate(BaseModel):
    name: str | None = None 
    description: str | None = None
    categorical_tags: str | None = None
    items_included: str | None = None
    image_url: str | None = None
    pickup_start: datetime | None = None
    pickup_end: datetime | None = None
    original_price: float | None = None
    discounted_price: float | None = None
    quantity_available: int | None = None

class SurpriseBagResponse(SurpriseBagBase):
    id: int
    store_id: int

    class Config:
        from_attributes = True

class NearbyBagResponse(SurpriseBagBase):
    id: int
    store_id: int
    store_name: str
    address_text: str
    lat: float
    lon: float
    distance_km: float

    class Config:
        from_attributes = True

# ==========================================
# ORDER & TRANSACTION SCHEMAS
# ==========================================
class OrderCreate(BaseModel):
    bag_id: int

class OrderResponse(BaseModel):
    id: int
    user_id: int
    bag_id: int
    quantity: int
    pickup_code: str
    status: str

    class Config:
        from_attributes = True

class VerifyOrderRequest(BaseModel):
    pickup_code: str

class CheckoutSessionRequest(BaseModel):
    bag_id: int

class PaymentConfirmRequest(BaseModel):
    session_id: str
    bag_id: int

# ==========================================
# SUPPORT & REVIEW SCHEMAS
# ==========================================
class SupportReportRequest(BaseModel):
    order_id: int
    reason: str
    details: str

class ReviewCreate(BaseModel):
    rating: float