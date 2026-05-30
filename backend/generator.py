import random
import pandas as pd
from pathlib import Path

from database import SessionLocal
from models_pytantic import Transaction

# ✅ On écrit dans le MÊME dossier que celui lu par reconciliation_engine.py
#    (BASE_DIR/data), pour que ça marche en local ET sur Render, quel que
#    soit le répertoire de travail.
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

COLUMNS = ["reference", "amount", "status", "created_at"]


def generate_datasets(db=None):
    """
    Construit operator.csv et merchant.csv À PARTIR des transactions en base.

      - operator = reflet fidèle de la base
      - merchant = copie dans laquelle on injecte des écarts (anomalies)

    Les anomalies sont DÉTERMINISTES par référence : une même transaction
    produit toujours le même type d'écart d'un run à l'autre. Cela évite que
    les anomalies « sautent » à chaque réconciliation et garde la résolution
    cohérente.

    Retourne un petit récap {"operator": n, "merchant": m}.
    """
    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)

        transactions = db.query(Transaction).all()

        operator_data = []
        merchant_data = []

        for t in transactions:
            operator_record = {
                "reference": t.reference,
                "amount": t.amount,
                "status": t.status,
                "created_at": t.created_at,
            }
            operator_data.append(operator_record)

            # Tirage déterministe basé sur la référence (stable dans le temps).
            # "none" est doublé pour que la majorité des transactions soient saines.
            rng = random.Random(str(t.reference))
            anomaly_type = rng.choice(["none", "none", "amount", "missing", "status"])

            merchant_record = operator_record.copy()

            if anomaly_type == "amount":
                merchant_record["amount"] = (t.amount or 0) + rng.randint(100, 500)
            elif anomaly_type == "status":
                merchant_record["status"] = "failed"
            elif anomaly_type == "missing":
                # absent côté marchand → on ne l'ajoute pas
                continue

            merchant_data.append(merchant_record)

        # columns=COLUMNS garantit un en-tête correct même si la base est vide
        pd.DataFrame(operator_data, columns=COLUMNS).to_csv(
            DATA_DIR / "operator.csv", index=False
        )
        pd.DataFrame(merchant_data, columns=COLUMNS).to_csv(
            DATA_DIR / "merchant.csv", index=False
        )

        return {"operator": len(operator_data), "merchant": len(merchant_data)}

    finally:
        if own_session:
            db.close()


# Permet aussi de lancer manuellement :  python -m generator
if __name__ == "__main__":
    print(generate_datasets())
