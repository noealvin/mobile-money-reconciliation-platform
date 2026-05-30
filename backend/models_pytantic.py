from sqlalchemy import (Column,Integer,String,DateTime,ForeignKey,Float)

from sqlalchemy.orm import relationship

from datetime import datetime

from database import Base


# =====================================================
# TRANSACTIONS
# =====================================================
class Transaction(Base):

    __tablename__ = "transactions"

    # ID interne
    id = Column(Integer, primary_key=True, index=True)

    # ID transaction métier
    transaction_id = Column(String, unique=True)

    # référence unique
    reference = Column(String, unique=True)

    # numéro client
    phone_number = Column(String)

    # montant transaction
    amount = Column(Float)

    # devise
    currency = Column(String)

    # type transaction
    # deposit / withdrawal / transfer
    type = Column(String)

    # statut
    # success / failed / pending / reversed
    status = Column(String)

    # provider mobile money
    provider = Column(String)

    # date création
    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# =====================================================
# RECONCILIATION RUNS
# =====================================================
class ReconciliationRun(Base):

    __tablename__ = "reconciliation_runs"

    # ID interne
    id = Column(Integer, primary_key=True, index=True)

    # date lancement reconciliation
    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # total transactions analysées
    total_transactions = Column(
        Integer,
        default=0
    )

    # total anomalies détectées
    total_anomalies = Column(
        Integer,
        default=0
    )

    # statut reconciliation
    # running / completed / failed
    status = Column(
        String,
        default="completed"
    )

    # relation avec anomalies
    anomalies = relationship(
        "Anomaly",
        back_populates="reconciliation_run",
        cascade="all, delete"
    )


# =====================================================
# ANOMALIES
# =====================================================
class Anomaly(Base):

    __tablename__ = "anomalies"

    # ID interne
    id = Column(Integer, primary_key=True, index=True)

    # référence transaction
    reference = Column(String)

    # type anomalie
    issue = Column(String)

    # niveau gravité
    severity = Column(String)

    # montant transaction normal
    amount = Column(
        Float,
        nullable=True
    )

    # NOUVEAU
    # montant attendu
    expected_amount = Column(
        Float,
        nullable=True
    )

    # différence de montant
    difference = Column(
        String,
        nullable=True
    )

    # NOUVEAU
    # statut anomalie
    # OPEN / RESOLVED / IGNORED
    status = Column(
        String,
        default="OPEN"
    )

    # date détection anomalie
    detected_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # clé étrangère reconciliation
    reconciliation_run_id = Column(
        Integer,
        ForeignKey("reconciliation_runs.id")
    )

    # relation inverse
    reconciliation_run = relationship(
        "ReconciliationRun",
        back_populates="anomalies"
    )