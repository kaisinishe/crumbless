from database import engine, Base
import models

print("Dropping old tables...")
Base.metadata.drop_all(bind=engine)

print("Creating new tables with email and password columns...")
Base.metadata.create_all(bind=engine)

print("Database reset successfully!")