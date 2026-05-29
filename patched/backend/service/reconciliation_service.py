from backend.models import ReconciliationRun, Anomaly


# =========================
# SAVE RECONCILIATION RESULT
#
# Stratégie MVP cohérente :
#   1. On garde toutes les anomalies déjà RESOLVED (mémoire).
#   2. On supprime les anciennes OPEN (elles vont être recréées
#      si elles sont toujours détectées dans ce run).
#   3. Pour chaque anomalie détectée par le moteur :
#        - si (reference, issue) existe déjà en RESOLVED → on la garde
#          telle quelle et on NE recrée PAS de doublon OPEN
#        - sinon on crée une nouvelle anomalie OPEN
#   4. Retourne (run, anomalies_serialisables) — avec leurs IDs DB
#      pour que le bouton "Résoudre" du frontend fonctionne.
# =========================
def save_reconciliation_result(db, result):

    incoming = result.get("anomalies", [])

    # =========================
    # 1. CREATE RUN
    # =========================
    run = ReconciliationRun(
        total_transactions=result["summary"].get("total_transactions", 0),
        total_anomalies=result["summary"].get("total_anomalies", 0),
        status="completed",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # =========================
    # 2. INDEX DES ANOMALIES DÉJÀ RESOLVED
    # =========================
    resolved_existing = db.query(Anomaly).filter(
        Anomaly.status == "RESOLVED"
    ).all()
    resolved_map = {
        (a.reference, a.issue): a for a in resolved_existing
    }

    # =========================
    # 3. PURGE DES ANCIENNES OPEN
    # =========================
    db.query(Anomaly).filter(Anomaly.status == "OPEN").delete()
    db.commit()

    # =========================
    # 4. INSERTION DES NOUVELLES ANOMALIES
    # =========================
    saved = []
    seen_keys = set()

    for item in incoming:
        ref = item.get("reference")
        issue = item.get("issue")
        key = (ref, issue)

        if key in seen_keys:
            continue
        seen_keys.add(key)

        # déjà résolue précédemment → on conserve
        if key in resolved_map:
            saved.append(resolved_map[key])
            continue

        # nouvelle anomalie OPEN
        anomaly = Anomaly(
            reference=ref,
            issue=issue,
            severity=item.get("severity"),
            status="OPEN",
            reconciliation_run_id=run.id,
        )

        # montant réel
        raw_amount = item.get("amount")
        try:
            anomaly.amount = (
                float(raw_amount) if raw_amount is not None else None
            )
        except Exception:
            anomaly.amount = None

        # montant attendu
        raw_expected = item.get("expected_amount")
        try:
            anomaly.expected_amount = (
                float(raw_expected) if raw_expected is not None else None
            )
        except Exception:
            anomaly.expected_amount = None

        if issue == "AMOUNT_MISMATCH":
            anomaly.difference = (
                f"{anomaly.amount} / {anomaly.expected_amount}"
            )

        db.add(anomaly)
        saved.append(anomaly)

    db.commit()

    # refresh pour récupérer les IDs des nouveaux objets
    for a in saved:
        try:
            db.refresh(a)
        except Exception:
            pass

    return run, saved


# =========================
# RESOLVE ANOMALY
# =========================
def resolve_anomaly(db, anomaly_id: int):

    anomaly = db.query(Anomaly).filter(
        Anomaly.id == anomaly_id
    ).first()

    if not anomaly:
        return None

    anomaly.status = "RESOLVED"

    db.commit()
    db.refresh(anomaly)

    return anomaly
