"""
Multi-role: Profile.role is now the CURRENT role, which must be one the user holds (its own
record approved). Accounts whose role was picked at sign-up but never approved go back to
Investor as their current role; their pending application/record is untouched.
"""
from django.db import migrations

RECORDS = {
    "owner": ("owner", "OwnerProfile"),
    "broker": ("broker", "BrokerProfile"),
    "lp": ("lp", "LiquidityProvider"),
    "developer": ("developer", "DeveloperProfile"),
    "partner": ("partners", "PartnerProfile"),
}


def forwards(apps, schema_editor):
    Profile = apps.get_model("core", "Profile")
    for role, (app_label, model) in RECORDS.items():
        Model = apps.get_model(app_label, model)
        approved = Model.objects.filter(status="approved").values_list("user_id", flat=True)
        Profile.objects.filter(role=role).exclude(user_id__in=list(approved)).update(
            role="investor", role_status="active"
        )


class Migration(migrations.Migration):
    dependencies = [
        ("roles", "0001_initial"),
        ("core", "0004_profile_disclosure_accepted_at_and_more"),
        ("owner", "0006_alter_ownerkybdocument_file_and_more"),
        ("broker", "0004_alter_brokerprofile_license_document"),
        ("lp", "0005_alter_lpdocument_file_alter_lpkybdocument_file"),
        ("developer", "0003_alter_developerkybdocument_file"),
        ("partners", "0004_alter_deliverabledocument_file_and_more"),
    ]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
