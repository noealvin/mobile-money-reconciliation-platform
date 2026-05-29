# MM-Recon

MM-Recon is a Mobile Money Reconciliation Platform designed to simulate and monitor transaction reconciliation workflows between operators and merchants.

The project was built to demonstrate fintech engineering concepts such as:

- transaction lifecycle simulation,
- reconciliation engines,
- anomaly detection,
- monitoring dashboards,
- JWT authentication,
- PostgreSQL persistence,
- operational workflows.

---

# Project Overview

MM-Recon simulates a real fintech reconciliation system.

The platform compares transaction records coming from:

- Mobile Money Operators
- Merchants

and automatically detects anomalies such as:

- missing transactions,
- amount mismatches,
- status mismatches.

---

# Features

## Backend

- FastAPI REST API
- PostgreSQL database
- SQLAlchemy ORM
- JWT authentication
- Protected routes
- Reconciliation engine
- Anomaly workflow (OPEN / RESOLVED)

## Frontend

- React dashboard
- Recharts analytics
- Authentication UI
- Real-time statistics
- Anomaly management
- CSV export

## Reconciliation Engine

- CSV comparison
- Matching logic
- Missing transaction detection
- Amount mismatch detection
- Status mismatch detection

---

# Architecture

Frontend (React)
↓
Secure Axios Client (JWT)
↓
FastAPI Backend
↓
Reconciliation Engine
↓
PostgreSQL Database

---

# Tech Stack

## Backend

- FastAPI
- SQLAlchemy
- PostgreSQL
- Python-Jose
- Passlib
- Pandas

## Frontend

- React
- Axios
- Recharts

---

# Authentication

The platform uses JWT authentication.

Protected APIs require:

Authorization: Bearer TOKEN

---

# Screenshots

## Dashboard

## Reconciliation ano

## Login page

<img width="1084" height="596" alt="image" src="https://github.com/user-attachments/assets/0764cdef-6709-4b96-af3c-a3c9d7647d54" />
<img width="1102" height="621" alt="image" src="https://github.com/user-attachments/assets/66ec54b4-03ac-48f4-bd28-7a2337c3223d" />
<img width="1088" height="506" alt="image" src="https://github.com/user-attachments/assets/37d6466c-4f19-4a7f-819d-7c4256755999" />
<img width="1089" height="602" alt="image" src="https://github.com/user-attachments/assets/2e007c6c-5264-454f-9c9f-bd0f7afb8507" />
<img width="642" height="566" alt="image" src="https://github.com/user-attachments/assets/c9e0d568-0182-4302-9d50-11a78f653515" />

# Installation

## Backend

```bash
pip install -r requirements.txt
```
