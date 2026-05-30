"""
Simulateur de transactions Mobile Money.

⚙️  Refactor important :
    L'ancien fichier était un script avec un `while True:` global qui
    se lançait au moment de l'import.  Impossible à arrêter, impossible
    à contrôler depuis le frontend.

    Maintenant c'est un module thread-safe contrôlable :
        - start_simulator()  -> lance la boucle dans un thread daemon
        - stop_simulator()   -> demande l'arrêt (sleep interruptible)
        - get_status()       -> renvoie l'état courant pour le dashboard

    Les endpoints FastAPI dans backend/main.py exposent ces fonctions
    au frontend (bouton "Démarrer / Arrêter la simulation").
"""

import os
import random
import logging
import threading
from datetime import datetime

from faker import Faker

from database import SessionLocal
from models_pytantic import Transaction


# =========================
# CONFIGURATION LOGS
# =========================
LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    filename=os.path.join(LOG_DIR, "transactions.log"),
    level=logging.INFO,
    format="%(asctime)s - %(message)s",
)


fake = Faker()


# =========================
# PARAMÈTRES MÉTIER
# =========================
PROVIDERS = [
    "Airtel Money",
    "Moov Money",
]

STATUSES = [
    "success",
    "failed",
    "pending",
    "timeout",
    "reversed",
]

TRANSACTION_TYPES = [
    "deposit",
    "withdrawal",
    "transfer",
]

# Délai entre 2 transactions générées (secondes)
# Plus court qu'avant (30s) pour avoir une démo réactive
INTERVAL_SECONDS = float(os.getenv("SIM_INTERVAL", "3"))


# =========================
# ÉTAT INTERNE (thread-safe)
# =========================
_lock = threading.Lock()
_thread: "threading.Thread | None" = None
_stop_event = threading.Event()

_state = {
    "running": False,
    "generated": 0,
    "started_at": None,
    "stopped_at": None,
    "last_transaction_id": None,
}


def _generate_one():
    """Génère et persiste UNE transaction aléatoire."""
    db = SessionLocal()
    try:
        ts = datetime.now()
        transaction_id = (
            f"TXN-{ts.strftime('%Y%m%d%H%M%S')}-{random.randint(100, 999)}"
        )
        reference = (
            f"REF-{ts.strftime('%Y%m%d%H%M%S')}-{random.randint(100, 999)}"
        )

        new_transaction = Transaction(
            transaction_id=transaction_id,
            reference=reference,
            phone_number=fake.phone_number(),
            amount=random.randint(1000, 100000),
            currency="XAF",
            type=random.choice(TRANSACTION_TYPES),
            status=random.choice(STATUSES),
            provider=random.choice(PROVIDERS),
            created_at=ts,
        )

        db.add(new_transaction)
        db.commit()

        logging.info(
            f"{transaction_id} | "
            f"{new_transaction.provider} | "
            f"{new_transaction.amount} XAF | "
            f"{new_transaction.status}"
        )

        with _lock:
            _state["generated"] += 1
            _state["last_transaction_id"] = transaction_id

        return transaction_id
    except Exception as e:
        db.rollback()
        logging.error(f"Simulator error: {e}")
        return None
    finally:
        db.close()


def _run_loop():
    """Boucle principale, exécutée dans un thread daemon."""
    with _lock:
        _state["running"] = True
        _state["started_at"] = datetime.utcnow().isoformat()
        _state["stopped_at"] = None

    logging.info("=== Simulator STARTED ===")

    try:
        while not _stop_event.is_set():
            _generate_one()
            # sleep interruptible : si stop_event.set() pendant le sleep,
            # on sort immédiatement de la boucle
            if _stop_event.wait(timeout=INTERVAL_SECONDS):
                break
    finally:
        with _lock:
            _state["running"] = False
            _state["stopped_at"] = datetime.utcnow().isoformat()
        logging.info("=== Simulator STOPPED ===")


# =========================
# API PUBLIQUE
# =========================
def start_simulator() -> dict:
    """Lance le simulateur (idempotent)."""
    global _thread

    with _lock:
        already_running = _thread is not None and _thread.is_alive()

    if already_running:
        return {"running": True, "started_now": False, **get_status()}

    _stop_event.clear()
    _thread = threading.Thread(
        target=_run_loop,
        name="mm-simulator",
        daemon=True,
    )
    _thread.start()

    return {"running": True, "started_now": True, **get_status()}


def stop_simulator() -> dict:
    """Demande l'arrêt du simulateur (idempotent)."""
    global _thread

    _stop_event.set()

    t = _thread
    if t is not None and t.is_alive():
        t.join(timeout=INTERVAL_SECONDS + 1)

    return {"running": False, "stopped_now": True, **get_status()}


def get_status() -> dict:
    """Retourne l'état courant du simulateur."""
    with _lock:
        snapshot = dict(_state)
    is_alive = _thread is not None and _thread.is_alive()
    snapshot["running"] = is_alive
    snapshot["interval_seconds"] = INTERVAL_SECONDS
    return snapshot
