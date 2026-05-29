from pydantic import BaseModel
from datetime import datetime


# =========================
# TRANSACTION CREATE
# =========================
class TransactionCreate(BaseModel):

    phone_number: str

    amount: int

    currency: str

    type: str

    provider: str


# =========================
# TRANSACTION RESPONSE
# =========================
class TransactionResponse(BaseModel):

    transaction_id: str

    reference: str

    amount: int

    status: str

    provider: str

    created_at: datetime


    class Config:
        from_attributes = True