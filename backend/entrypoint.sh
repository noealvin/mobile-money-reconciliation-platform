#!/bin/sh
# =========================
# Entrypoint backend MM-Recon
# 1. Attend que PostgreSQL soit prêt
# 2. Crée l'utilisateur admin si nécessaire
# 3. Démarre l'API FastAPI (uvicorn)
# =========================
set -e

# ✅ Si DB_HOST n'est pas fourni explicitement (cas Render), on l'extrait
#    directement de DATABASE_URL. Sur Render la base est managée :
#    on attend le VRAI hôte, pas "db" (qui n'existe qu'en docker-compose).
if [ -z "$DB_HOST" ] && [ -n "$DATABASE_URL" ]; then
    # format : postgresql://user:pass@HOTE:PORT/nom_base
    DB_HOST=$(printf '%s' "$DATABASE_URL" | sed -E 's#.*@([^:/]+).*#\1#')
    DB_PORT=$(printf '%s' "$DATABASE_URL" | sed -E 's#.*@[^:/]+:([0-9]+).*#\1#')
fi

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"

echo "⏳ Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
for i in $(seq 1 30); do
    if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
        echo "✅ PostgreSQL is up"
        break
    fi
    echo "   ... still waiting (${i}/30)"
    sleep 1
done

echo "👤 Ensuring admin user exists..."
python -m create_admin || echo "⚠️  create_admin a échoué (peut-être déjà créé) — on continue."

# ✅ Render impose le port d'écoute via la variable PORT.
#    En local elle n'existe pas → on retombe sur 8000.
echo "🚀 Starting FastAPI on 0.0.0.0:${PORT:-8000}"
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
