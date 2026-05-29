# Importation de CryptContext
# Sert à gérer le hachage et la vérification des mots de passe
from passlib.context import CryptContext

# Importation de jwt
# Sert à créer et décoder des tokens JWT
from jose import jwt

# Importation des outils de gestion du temps
# datetime -> date et heure actuelle
# timedelta -> permet d'ajouter une durée
from datetime import datetime, timedelta


# Clé secrète utilisée pour signer les tokens JWT
# IMPORTANT :
# En production, cette clé doit être longue et secrète
SECRET_KEY = "MMRECON_SECRET_KEY"


# Algorithme utilisé pour signer le token
# HS256 = HMAC + SHA256
ALGORITHM = "HS256"


# Configuration du système de hachage des mots de passe
pwd_context = CryptContext(
    
    # Utilisation de bcrypt pour sécuriser les mots de passe
    schemes=["bcrypt"],
    
    # Gestion automatique des anciens schémas de hachage
    deprecated="auto"
)


# Fonction qui transforme un mot de passe en hash sécurisé
def hash_password(password: str):
    
    # Retourne le mot de passe chiffré
    return pwd_context.hash(password)


# Fonction qui vérifie si un mot de passe correspond au hash stocké
def verify_password(
    
    # Mot de passe tapé par l'utilisateur
    plain_password,
    
    # Mot de passe hashé enregistré dans la base
    hashed_password
):
    
    # Vérifie la correspondance
    return pwd_context.verify(
        plain_password,
        hashed_password
    )


# Fonction qui crée un token JWT
def create_access_token(data: dict):

    # Copie des données envoyées
    # Exemple :
    # {"sub": "admin"}
    to_encode = data.copy()

    
    # Définition de la date d'expiration du token
    # Ici : expiration dans 12 heures
    expire = datetime.utcnow() + timedelta(hours=12)

    
    # Ajout de l'information d'expiration dans le token
    to_encode.update({
        "exp": expire
    })

    
    # Création et signature du token JWT
    return jwt.encode(
        
        # Données à encoder
        to_encode,
        
        # Clé secrète
        SECRET_KEY,
        
        # Algorithme de signature
        algorithm=ALGORITHM
    )