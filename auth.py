from datetime import datetime, timedelta, timezone
import bcrypt
import jwt

# Security Configurations
SECRET_KEY = "super-secret-salvia-key-change-this-later"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7 

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Checks if the typed password matches the scrambled one in the database using raw bcrypt."""
    password_bytes = plain_password.encode('utf-8')
    hash_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hash_bytes)

def get_password_hash(password: str) -> str:
    """Turns a plain text password into a mathematically irreversible string using raw bcrypt."""
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode('utf-8') # Convert back to a string for PostgreSQL

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """Generates the digital VIP wristband (JWT) for the user."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
        
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt