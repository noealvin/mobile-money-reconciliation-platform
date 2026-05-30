# 🔧 CE FICHIER DOIT S'APPELER __init__.py (deux underscores de chaque côté)
#
# Sans cela, Python ne reconnaît pas le dossier "models" comme un package
# et l'import "from backend.models.users import User" plante.
#
# Si tu vois encore un fichier "_init_.py" (avec UN seul underscore) dans
# backend/models/, supprime-le et garde uniquement __init__.py.

from models.users import User

__all__ = ["User"]
