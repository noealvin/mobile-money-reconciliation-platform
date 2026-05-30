import pandas as pd
from pathlib import Path


def run_reconciliation():

    # =========================
    # LECTURE DES CSV (FIX PATH POUR PROD RENDER)
    # =========================
    BASE_DIR = Path(__file__).resolve().parent
    DATA_DIR = BASE_DIR / "data"

    operator_path = DATA_DIR / "operator.csv"
    merchant_path = DATA_DIR / "merchant.csv"

    operator_df = pd.read_csv(operator_path)
    merchant_df = pd.read_csv(merchant_path)

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
        elif operator_amount is not None and merchant_amount is not None and abs(operator_amount - merchant_amount) > 0.01:
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

    # =========================
    # EXPORT CSV REPORT
    # =========================
    output_path = DATA_DIR / "reconciliation_report.csv"

    pd.DataFrame(anomalies).to_csv(
        output_path,
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

    print(len(operator_df), len(merchant_df))
    print(merged_df.head())