from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# The connection string format: postgresql://user:password@host:port/database_name
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:kaisinishe@localhost:5432/salvia_db"

# Create the engine that drives the connection
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Create a session factory to talk to the database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# The base class all our models will inherit from
Base = declarative_base()