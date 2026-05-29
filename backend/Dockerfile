# =========================
# Backend Dockerfile
# Build context = racine du projet (cf. docker-compose.yml)
# Cela permet de conserver la structure `backend/...` à l'intérieur du
# conteneur, donc TOUS les imports `from backend.X import Y` fonctionnent.
# =========================
FROM python:3.11-slim

# Désactive le bytecode + flush des logs en temps réel
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dépendances système minimales (libpq pour psycopg2-binary, gcc pour bcrypt si besoin)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        libpq5 \
        netcat-openbsd \
 && rm -rf /var/lib/apt/lists/*

# Installation Python en cache layer
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Code applicatif — on conserve la hiérarchie `backend/`
COPY backend/ ./backend/

# Données initiales (CSV opérateur/marchand). Le volume défini dans
# docker-compose.yml prendra le dessus au runtime.
COPY data/ ./data/

# Dossier logs (volume monté ensuite)
RUN mkdir -p /app/logs

# Entrypoint : attend la DB, crée l'admin, démarre uvicorn
COPY backend/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["entrypoint.sh"]
