import os

# Importation de create_engine
# Sert à créer la connexion entre Python et PostgreSQL
from sqlalchemy import create_engine

# Importation de sessionmaker et declarative_base
from sqlalchemy.orm import sessionmaker, declarative_base


# ✅ Adresse de connexion à PostgreSQL
#    Lue depuis la variable d'environnement DATABASE_URL.
#    - En local (docker-compose) : postgresql://postgres:postgres@db:5432/mmrecon
#    - Sur Render : la valeur est fournie par la base PostgreSQL managée.
#    Fallback = config Docker par défaut.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@db:5432/mmrecon",
)

# ✅ Compatibilité Render : Render fournit une URL qui commence par
#    "postgres://". SQLAlchemy 1.4+/2.x exige "postgresql://".
#    On normalise automatiquement pour éviter le crash.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)


# Création du moteur de connexion
#   pool_pre_ping=True : vérifie que la connexion est vivante avant de
#   l'utiliser (utile avec une base managée qui ferme les connexions inactives).
engine = create_engine(DATABASE_URL, pool_pre_ping=True)


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
