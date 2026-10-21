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


# Arabic names for the same sources (receipt titles on the Arabic site).
SOURCE_LABELS_AR = {
    "deposit": "شحن المحفظة",
    "withdrawal": "طلب سحب",
    "withdrawal_refund": "سحب لم يكتمل — أُعيد المبلغ",
    "instant_fee_refund": "استرداد رسوم السحب الفوري",
    "gift_sent": "هدية مُرسلة",
    "gift_received": "هدية مُستلمة",
    "gift_returned": "هدية مُعادة",
    "family_sent": "تحويل عائلي مُرسل",
    "family_received": "تحويل عائلي مُستلم",
    "family_returned": "تحويل عائلي مُعاد",
    "estate_sent": "توزيع ميراث",
    "estate_received": "ميراث مُستلم",
    "estate_returned": "ميراث مُعاد",
    "reinvestment": "شراء من المحفظة",
    "installment": "قسط مدفوع من المحفظة",
    "installment_autodebit": "خصم قسط تلقائي من المحفظة",
    "distribution": "توزيع دخل الإيجار",
    "secondary_market_purchase": "شراء من السوق الثانوي",
    "secondary_market_sale": "عائدات بيع في السوق الثانوي",
    "lp_market_sale": "بيع لمزود سيولة",
    "primary_sale": "عائدات البيع الأولي",
    "broker_commission": "عمولة إحالة",
    "purchase_refund": "استرداد مبلغ شراء للمحفظة",
    "crypto_underpaid_refund": "دفعة كريبتو أقل من المستحق — أُعيدت",
    "crypto_overpaid_credit": "دفعة كريبتو أعلى من المستحق — أُضيف الفرق",
    "family_accrual_release": "تحرير مخصص عائلي",
}


def source_label_ar(source: str) -> str:
    return SOURCE_LABELS_AR.get(source, source_label(source))
