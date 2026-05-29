import pandas as pd


def run_reconciliation():

    # =========================
    # LECTURE DES CSV
    # =========================
    operator_df = pd.read_csv("data/operator.csv")
    merchant_df = pd.read_csv("data/merchant.csv")

    # =========================
    # NORMALISATION TYPES
    # =========================
    operator_df["amount"] = pd.to_numeric(operator_df["amount"], errors="coerce")
    merchant_df["amount"] = pd.to_numeric(merchant_df["amount"], errors="coerce")

    # =========================
    # MERGE DATASETS
    # =========================
    merged_df = operator_df.merge(
        merchant_df,
        on="reference",
        how="outer",
        suffixes=("_op", "_m")
    )

    anomalies = []

    # =========================
    # ANALYSE
    # =========================
    for _, row in merged_df.iterrows():

        reference = row.get("reference")

        operator_amount = row.get("amount_op")
        merchant_amount = row.get("amount_m")

        tx_date = row.get("created_at_op") or row.get("created_at_m")
        tx_date = str(tx_date) if pd.notna(tx_date) else "—"

        # =========================
        # 1. MISSING OPERATOR
        # =========================
        if pd.isna(operator_amount):
            anomalies.append({
                "reference": reference,
                "issue": "MISSING_IN_OPERATOR",
                "amount": merchant_amount,
                "expected_amount": None,
                "severity": "high",
                "date": tx_date
            })

        # =========================
        # 2. MISSING MERCHANT
        # =========================
        elif pd.isna(merchant_amount):
            anomalies.append({
                "reference": reference,
                "issue": "MISSING_IN_MERCHANT",
                "amount": operator_amount,
                "expected_amount": None,
                "severity": "high",
                "date": tx_date
            })

        # =========================
        # 3. AMOUNT MISMATCH
        # =========================
        elif abs(operator_amount - merchant_amount) > 0.01:
            anomalies.append({
                "reference": reference,
                "issue": "AMOUNT_MISMATCH",
                "amount": operator_amount,
                "expected_amount": merchant_amount,
                "severity": "med",
                "date": tx_date
            })

        # =========================
        # 4. STATUS MISMATCH
        # =========================
        elif row.get("status_op") != row.get("status_m"):
            anomalies.append({
                "reference": reference,
                "issue": "STATUS_MISMATCH",
                "amount": operator_amount,
                "expected_amount": None,
                "severity": "med",
                "date": tx_date
            })

        # 🔧 Bloc "AMOUNT_MISMATCH" dupliqué + mal indenté supprimé ici
        #    (il était inaccessible car le 1er bloc plus haut traite déjà ce cas)


    # =========================
    # EXPORT CSV REPORT
    # =========================
    pd.DataFrame(anomalies).to_csv(
        "data/reconciliation_report.csv",
        index=False
    )

    # =========================
    # SUMMARY
    # =========================
    summary = {
        "total_anomalies": len(anomalies),
        "missing_transactions": len([a for a in anomalies if "MISSING" in a["issue"]]),
        "amount_mismatches": len([a for a in anomalies if a["issue"] == "AMOUNT_MISMATCH"]),
        "status_mismatches": len([a for a in anomalies if a["issue"] == "STATUS_MISMATCH"])
    }

    return {
        "summary": summary,
        "anomalies": anomalies
    }