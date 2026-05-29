from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.schemas import TransactionCreate
from datetime import datetime, timedelta
import uuid

from backend.reconciliation_engine import run_reconciliation
from backend.service.reconciliation_service import (
    save_reconciliation_result,
    resolve_anomaly,
)
from backend.database import SessionLocal, engine, Base
from backend.models import Transaction, ReconciliationRun, Anomaly

from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()

# =========================
# CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# DB INIT
# =========================
Base.metadata.create_all(bind=engine)


# =========================
# DB SESSION DEPENDENCY
# =========================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# ROOT
# =========================
@app.get("/")
def root():
    return {"message": "MM-Recon API Running"}


# =========================
# SAFE DATE FUNCTION
# =========================
def safe_date(value):
    if value is None:
        return None

    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value).date()
        except Exception:
            return None

    try:
        return value.date()
    except Exception:
        return None


# =========================
# SERIALIZE ANOMALY (helper)
# =========================
def serialize_anomaly(a: Anomaly):
    return {
        "id": a.id,
        "reference": a.reference,
        "issue": a.issue,
        "severity": a.severity,
        "amount": a.amount,
        "expected_amount": a.expected_amount,
        "difference": a.difference,
        "status": a.status,
        "detected_at": str(a.detected_at) if a.detected_at else None,
    }


# =========================
# CREATE TRANSACTION
# =========================
@app.post("/transactions")
def create_transaction(transaction: TransactionCreate):
    db = SessionLocal()
    try:
        transaction_id = f"TXN-{uuid.uuid4().hex}"
        reference = f"REF-{uuid.uuid4().hex[:12].upper()}"

        new_transaction = Transaction(
            transaction_id=transaction_id,
            reference=reference,
            phone_number=transaction.phone_number,
            amount=transaction.amount,
            currency=transaction.currency,
            type=transaction.type,
            status="pending",
            provider=transaction.provider,
            created_at=datetime.utcnow(),
        )

        db.add(new_transaction)
        db.commit()
        db.refresh(new_transaction)

        return {
            "message": "Transaction created successfully",
            "data": {
                "transaction_id": new_transaction.transaction_id,
                "reference": new_transaction.reference,
                "phone_number": new_transaction.phone_number,
                "amount": new_transaction.amount,
                "currency": new_transaction.currency,
                "type": new_transaction.type,
                "status": new_transaction.status,
                "provider": new_transaction.provider,
                "created_at": new_transaction.created_at,
            },
        }
    finally:
        db.close()


# =========================
# GET ALL TRANSACTIONS
# =========================
@app.get("/transactions")
def get_transactions():
    db = SessionLocal()
    try:
        return db.query(Transaction).all()
    finally:
        db.close()


# =========================
# SUCCESS
# =========================
@app.get("/transactions/success")
def get_transaction_success():
    db = SessionLocal()
    try:
        return db.query(Transaction).filter(Transaction.status == "success").all()
    finally:
        db.close()


# =========================
# FAILED
# =========================
@app.get("/transactions/failed")
def get_transaction_failed():
    db = SessionLocal()
    try:
        return db.query(Transaction).filter(Transaction.status == "failed").all()
    finally:
        db.close()


# =========================
# RECONCILIATION
# =========================
@app.post("/reconciliation/run")
def reconciliation_run():
    db = SessionLocal()
    try:
        result = run_reconciliation()

        # ✅ save_reconciliation_result retourne maintenant
        # (run, saved_anomalies) avec les IDs DB et le bon statut
        run, saved_anomalies = save_reconciliation_result(db, result)

        # Recalcule le summary depuis ce qui est en base
        # (pour refléter OPEN vs RESOLVED correctement)
        open_anomalies = [a for a in saved_anomalies if a.status == "OPEN"]

        summary = {
            "total_anomalies": len(open_anomalies),
            "missing_transactions": len(
                [a for a in open_anomalies if a.issue and "MISSING" in a.issue]
            ),
            "amount_mismatches": len(
                [a for a in open_anomalies if a.issue == "AMOUNT_MISMATCH"]
            ),
            "status_mismatches": len(
                [a for a in open_anomalies if a.issue == "STATUS_MISMATCH"]
            ),
            "resolved_count": len(
                [a for a in saved_anomalies if a.status == "RESOLVED"]
            ),
        }

        return {
            "message": "Reconciliation completed",
            "summary": summary,
            "anomalies": [serialize_anomaly(a) for a in saved_anomalies],
        }

    except Exception as e:
        db.rollback()
        return {
            "message": "Reconciliation failed",
            "error": str(e),
        }

    finally:
        db.close()


# =========================
# DASHBOARD STATS
# - Compteurs globaux (all-time) ET du jour (today_*)
# - Le frontend "Vue d'ensemble — aujourd'hui" consomme today_*
# =========================
@app.get("/dashboard/stats")
def dashboard_stats():
    db = SessionLocal()
    try:
        transactions = db.query(Transaction).all()
        today = datetime.utcnow().date()

        # =========================
        # ALL-TIME (utile pour KPIs globaux si besoin)
        # =========================
        total = len(transactions)
        success = sum(1 for t in transactions if t.status == "success")
        failed = sum(1 for t in transactions if t.status == "failed")
        pending = sum(1 for t in transactions if t.status == "pending")
        reversed_ = sum(1 for t in transactions if t.status == "reversed")
        success_rate = round((success / total) * 100, 2) if total else 0

        # =========================
        # TODAY ONLY  ✅ NOUVEAU
        # =========================
        today_tx = [t for t in transactions if safe_date(t.created_at) == today]
        today_total = len(today_tx)
        today_success = sum(1 for t in today_tx if t.status == "success")
        today_failed = sum(1 for t in today_tx if t.status == "failed")
        today_pending = sum(1 for t in today_tx if t.status == "pending")
        today_reversed = sum(1 for t in today_tx if t.status == "reversed")
        today_rate = (
            round((today_success / today_total) * 100, 2) if today_total else 0
        )

        today_transactions = [
            {
                "reference": t.reference,
                "amount": t.amount,
                "status": t.status,
                "provider": t.provider,
                "created_at": str(t.created_at),
            }
            for t in today_tx
        ]

        # =========================
        # WEEKLY DATA (7 derniers jours)
        # =========================
        day_labels = {
            "Mon": "Lun", "Tue": "Mar", "Wed": "Mer",
            "Thu": "Jeu", "Fri": "Ven", "Sat": "Sam", "Sun": "Dim",
        }

        weekly_data = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_transactions = [
                t for t in transactions if safe_date(t.created_at) == day
            ]
            weekly_data.append({
                "date": str(day),
                "name": day_labels.get(day.strftime("%a"), day.strftime("%a")),
                "success":  sum(1 for t in day_transactions if t.status == "success"),
                "failed":   sum(1 for t in day_transactions if t.status == "failed"),
                "pending":  sum(1 for t in day_transactions if t.status == "pending"),
                "reversed": sum(1 for t in day_transactions if t.status == "reversed"),
                "total":    len(day_transactions),
            })

        return {
            # All-time
            "total_transactions": total,
            "success_count": success,
            "failed_count": failed,
            "pending_count": pending,
            "reversed_count": reversed_,
            "success_rate": success_rate,

            # ✅ Today only
            "today_total": today_total,
            "today_success_count": today_success,
            "today_failed_count": today_failed,
            "today_pending_count": today_pending,
            "today_reversed_count": today_reversed,
            "today_success_rate": today_rate,

            "today_transactions": today_transactions,
            "weekly_data": weekly_data,
        }

    finally:
        db.close()


# =========================
# RESOLVE ANOMALY
# =========================
@app.put("/anomalies/{anomaly_id}/resolve")
def resolve_anomaly_endpoint(
    anomaly_id: int,
    db: Session = Depends(get_db),
):
    anomaly = resolve_anomaly(db, anomaly_id)

    if not anomaly:
        raise HTTPException(
            status_code=404,
            detail="Anomaly not found",
        )

    return {
        "message": "Anomaly resolved",
        "anomaly_id": anomaly.id,
        "status": anomaly.status,
    }
