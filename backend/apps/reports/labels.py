"""Display names for wallet ledger sources and payment providers (statements + receipts)."""

SOURCE_LABELS = {
    "deposit": "Wallet top-up",
    "withdrawal": "Withdrawal request",
    "withdrawal_refund": "Withdrawal not completed — amount returned",
    "instant_fee_refund": "Instant withdrawal fee returned",
    "gift_sent": "Gift sent",
    "gift_received": "Gift received",
    "gift_returned": "Gift returned",
    "family_sent": "Family transfer sent",
    "family_received": "Family transfer received",
    "family_returned": "Family transfer returned",
    "estate_sent": "Inheritance distributed",
    "estate_received": "Inheritance received",
    "estate_returned": "Inheritance returned",
    "reinvestment": "Purchase paid from the wallet",
    "installment": "Installment paid from the wallet",
    "installment_autodebit": "Installment auto-debited from the wallet",
    "distribution": "Rental income distribution",
    "secondary_market_purchase": "Secondary market purchase",
    "secondary_market_sale": "Secondary market sale proceeds",
    "lp_market_sale": "Sale to a liquidity provider",
    "primary_sale": "Primary sale proceeds",
    "broker_commission": "Referral commission",
    "purchase_refund": "Purchase refunded to the wallet",
    "crypto_underpaid_refund": "Crypto payment below the amount due — returned",
    "crypto_overpaid_credit": "Crypto payment above the amount due — extra credited",
    "family_accrual_release": "Family allocation released",
}

PROVIDER_LABELS = {"stripe": "Card (Stripe)", "nowpayments": "Crypto (NOWPayments)", "balance": "Wallet"}


def source_label(source: str) -> str:
    return SOURCE_LABELS.get(source, (source or "").replace("_", " ").capitalize())
