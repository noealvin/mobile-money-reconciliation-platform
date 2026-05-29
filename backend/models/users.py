from sqlalchemy import Column, Integer, String
from backend.database import Base
#creation de la table user pour creer les utilisateur admin de l appli

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    username = Column(String, unique=True, nullable=False)

    hashed_password = Column(String, nullable=False)

    role = Column(String, default="admin")