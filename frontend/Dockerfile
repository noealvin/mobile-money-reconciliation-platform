# =========================
# Frontend Dockerfile (multi-stage)
# - stage 1 : build Vite/React
# - stage 2 : sert le bundle via Nginx + proxy /api -> backend
# =========================

# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Cache des dépendances
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Code source
COPY . .

# ✅ L'app appelle /api/... et nginx reverse-proxy vers le backend Docker.
#    Pas besoin d'IP, donc l'image est portable (dev/prod/CI).
ENV VITE_API_URL=/api

RUN npm run build


# ---- Serve stage ----
FROM nginx:alpine

# Conf custom : SPA fallback + reverse proxy /api -> backend:8000
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Bundle React
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
