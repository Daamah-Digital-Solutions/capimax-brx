"""
Certificates were never moved from provisional to final (the transition existed but nothing
called it). Finalize every certificate whose purchase is already fully settled — the same
rule as services.is_settled: paid, units minted, installment plan completed, no active
Nova Finance pledge. Revoked certificates and unpaid attempts are left as they are.
"""
from django.db import migrations
from django.utils import timezone


def finalize_settled(apps, schema_editor):
    Certificate = apps.get_model("certificates", "Certificate")
    NovaPledge = apps.get_model("payments", "NovaPledge")
    now = timezone.now()
    for cert in Certificate.objects.filter(status="provisional").select_related(
        "investment", "investment__installment_plan"
    ):
        inv = cert.investment
        if inv is None or inv.payment_status != "completed" or not inv.tokens_minted:
            continue
        if inv.is_installment and inv.installment_plan_id and inv.installment_plan.status != "completed":
            continue
        if inv.payment_method == "sukuk" and NovaPledge.objects.filter(investment=inv, status="active").exists():
            continue
        cert.status = "final"
        cert.finalized_at = now
        cert.save(update_fields=["status", "finalized_at", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("certificates", "0004_alter_certificate_pdf_file"),
        ("investments", "0005_investment_refund_reason_investment_refunded_at_and_more"),
        ("installments", "0006_installmentpayment_due_reminder_sent_at"),
        ("payments", "0009_alter_sukukcertificate_file"),
    ]

    operations = [migrations.RunPython(finalize_settled, migrations.RunPython.noop)]
