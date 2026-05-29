import os

# Importation de create_engine
# Sert à créer la connexion entre Python et PostgreSQL
from sqlalchemy import create_engine

# Importation de sessionmaker et declarative_base
from sqlalchemy.orm import sessionmaker, declarative_base


# ✅ Adresse de connexion à PostgreSQL
#    Lue depuis la variable d'environnement DATABASE_URL
#    (définie dans docker-compose.yml) pour que la même image
#    fonctionne en local ET dans Docker sans modification.
#    Fallback = config Docker par défaut.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@db:5432/mmrecon",
)


# Création du moteur de connexion
engine = create_engine(DATABASE_URL)


# Création d'une fabrique de sessions
SessionLocal = sessionmaker(

    # Désactive la validation automatique
    autocommit=False,

    # Désactive l'envoi automatique
    autoflush=False,

    # Liaison avec PostgreSQL
    bind=engine
)


# Classe de base pour tous les modèles SQLAlchemy
Base = declarative_base()
