# MM-Recon — Démarrage Docker

Tout le projet est dockerisé. Une seule commande suffit pour lancer la stack
complète (PostgreSQL + API FastAPI + dashboard React).

---

## 1. Prérequis

- Docker Desktop (ou Docker Engine + Docker Compose v2)
- Ports libres : **5173** (frontend), **8000** (backend API), **5432** (Postgres)

---

## 2. Lancer la stack

À la racine du projet (là où se trouve `docker-compose.yml`) :

```bash
docker compose up --build
```

Premier lancement = quelques minutes (build des images).
Les fois suivantes :

```bash
docker compose up
```

En arrière-plan :

```bash
docker compose up -d
```

Pour arrêter :

```bash
docker compose down
```

Pour tout reset (DB comprise) :

```bash
docker compose down -v
```

---

## 3. Accès

| Service     | URL                              | Détails                                       |
|-------------|----------------------------------|-----------------------------------------------|
| Dashboard   | http://localhost:5173            | App React, sert aussi le reverse-proxy /api   |
| API directe | http://localhost:8000            | Swagger : http://localhost:8000/docs          |
| Postgres    | `localhost:5432`                 | user `postgres` / pwd `postgres` / db `mmrecon` |

### Compte par défaut
L'entrypoint backend crée automatiquement un admin au premier démarrage :

- **utilisateur** : `admin`
- **mot de passe** : `123456`

---

## 4. Simulateur de transactions

Désormais **contrôlable depuis le dashboard** (bouton en haut à droite à
côté de "Actualiser") :

- ▶ **Démarrer simulation** : génère ~1 transaction toutes les `SIM_INTERVAL`
  secondes (3 s par défaut, modifiable dans `docker-compose.yml`)
- ■ **Arrêter simulation** : arrêt propre (sleep interruptible)
- L'indicateur affiche en temps réel le nombre de transactions générées

Endpoints REST correspondants :

```
POST /api/simulator/start
POST /api/simulator/stop
GET  /api/simulator/status
```

---

## 5. Architecture Docker

```
┌─────────────────────┐      ┌─────────────────────┐      ┌────────────────┐
│  frontend (nginx)   │ ───▶ │  backend (FastAPI)  │ ───▶ │  db (Postgres) │
│  :5173 -> :80       │/api  │  :8000              │      │  :5432         │
└─────────────────────┘      └─────────────────────┘      └────────────────┘
                                      │
                                      ▼
                              ./data   (CSV opérateur / marchand)
                              ./logs   (transactions.log)
```

- Le **frontend** est un build Vite statique servi par Nginx. Toutes les
  requêtes vers `/api/...` sont reverse-proxy-fiées vers `backend:8000`.
  → Aucune URL hardcodée, l'image est portable.
- Le **backend** est buildé depuis la racine du projet pour conserver la
  structure `backend/...` à l'intérieur du conteneur (imports
  `from backend.X import Y` intacts).
- Les dossiers `./data` et `./logs` sont montés en volume, donc les CSV
  et logs persistent entre les redémarrages.

---

## 6. Variables d'environnement utiles

| Variable        | Service  | Défaut                                              | Rôle                              |
|-----------------|----------|-----------------------------------------------------|-----------------------------------|
| `DATABASE_URL`  | backend  | `postgresql://postgres:postgres@db:5432/mmrecon`    | Connexion SQLAlchemy              |
| `SIM_INTERVAL`  | backend  | `3`                                                 | Délai (s) entre 2 transactions    |
| `VITE_API_URL`  | frontend | `/api` (au build)                                   | Base URL Axios                    |

---

## 7. Dépannage

**Le backend redémarre en boucle**
→ Vérifier les logs : `docker compose logs backend`.
Le plus souvent : DB pas encore prête (le `healthcheck` + `depends_on` gèrent
ça, mais en cas de souci, relancez `docker compose up`).

**"Identifiants invalides" au login**
→ L'admin n'a pas été créé. Relancez :
```bash
docker compose exec backend python -m backend.create_admin
```

**La réconciliation renvoie une erreur de CSV manquant**
→ Vérifier que `./data/operator.csv` et `./data/merchant.csv` existent.
Pour régénérer depuis la DB :
```bash
docker compose exec backend python -m backend.generator
```

**Reset complet**
```bash
docker compose down -v
docker compose up --build
```

---

## 8. Fichiers ajoutés / modifiés pour la dockerisation

```
MM_recon/
├── docker-compose.yml          (réécrit : 3 services + healthcheck + volumes)
├── .dockerignore               (nouveau)
├── DOCKER.md                   (ce fichier)
├── backend/
│   ├── Dockerfile              (réécrit : context = racine projet)
│   ├── entrypoint.sh           (nouveau : attente DB + create_admin + uvicorn)
│   ├── .dockerignore
│   ├── main.py                 (imports corrigés + endpoints simulateur)
│   ├── simulator.py            (refactor : module thread-safe contrôlable)
│   └── database.py             (DATABASE_URL depuis env)
└── frontend/
    ├── Dockerfile              (nouveau : multi-stage Vite + Nginx)
    ├── nginx.conf              (nouveau : SPA fallback + proxy /api)
    ├── .dockerignore           (nouveau)
    ├── .env                    (VITE_API_URL=/api)
    └── src/
        ├── App.jsx             (bouton Démarrer/Arrêter simulation)
        └── pages/LoginPage.jsx (URL relative au lieu de 127.0.0.1)
```
