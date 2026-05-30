from database import SessionLocal, Base, engine
from models.users import User
from security import hash_password

# Création des tables
Base.metadata.create_all(bind=engine)

db = SessionLocal()

admin = db.query(User).filter(
    User.username == "admin"
).first()

if admin:

    print("Admin existe déjà")

else:

    new_admin = User(

        username="admin",

        # IMPORTANT : hash bcrypt
        hashed_password=hash_password("123456"),

        role="admin"
    )

    db.add(new_admin)

    db.commit()

    print("Admin créé avec succès")