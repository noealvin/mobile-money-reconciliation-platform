#!/bin/sh
# =========================
# Entrypoint backend MM-Recon
# 1. Attend que PostgreSQL soit prêt
# 2. Crée l'utilisateur admin si nécessaire
# 3. Démarre l'API FastAPI (uvicorn)
# =========================
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"

echo "⏳ Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
for i in $(seq 1 30); do
    if nc -z "$DB_HOST" "$DB_PORT"; then
        echo "✅ PostgreSQL is up"
        break
    fi
    echo "   ... still waiting (${i}/30)"
    sleep 1
done

echo "👤 Ensuring admin user exists..."
python -m backend.create_admin || echo "⚠️  create_admin a échoué (peut-être déjà créé) — on continue."

echo "🚀 Starting FastAPI on 0.0.0.0:8000"
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
