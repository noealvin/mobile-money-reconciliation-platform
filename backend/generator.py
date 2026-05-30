import random
import pandas as pd
from database import SessionLocal
from models_pytantic import Transaction

db = SessionLocal()

# =========================
# RECUPERATION DES DONNEES DB
# =========================
transactions = db.query(Transaction).all()

operator_data = []
merchant_data = []

for transaction in transactions:

    # =========================
    # DONNEES OPERATEUR
    # =========================
    operator_record = {
        "reference": transaction.reference,
        "amount": transaction.amount,
        "status": transaction.status,
        "created_at": transaction.created_at  # 👈 toujours présent
    }

    operator_data.append(operator_record)

    # =========================
    # COPIE POUR MERCHANT
    # =========================
    merchant_record = operator_record.copy()

    # =========================
    # SIMULATION DES ANOMALIES
    # =========================
    anomaly_type = random.choice(["none", "amount", "missing", "status"])

    # anomalie montant
    if anomaly_type == "amount":
        merchant_record["amount"] += random.randint(100, 500)

    # anomalie statut
    elif anomaly_type == "status":
        merchant_record["status"] = "failed"

    # anomalie transaction manquante côté merchant
    elif anomaly_type == "missing":
        continue

    merchant_data.append(merchant_record)

# =========================
# EXPORT CSV
# =========================
operator_df = pd.DataFrame(operator_data)
merchant_df = pd.DataFrame(merchant_data)

operator_df.to_csv("data/operator.csv", index=False)
merchant_df.to_csv("data/merchant.csv", index=False)

print("Datasets generated successfully")