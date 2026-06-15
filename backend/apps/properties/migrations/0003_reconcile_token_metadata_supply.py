# Wave 2 policy #4: reconcile the data-room display supply to the authoritative
# Property.token_supply (fixes the seeded 5,000-vs-50,000 mismatch on existing rows).
from django.db import migrations


def reconcile(apps, schema_editor):
    TokenMetadata = apps.get_model("properties", "TokenMetadata")
    for meta in TokenMetadata.objects.select_related("property").all():
        supply = meta.property.token_supply
        if meta.total_supply != supply or meta.tokenized_units != supply:
            meta.total_supply = supply
            meta.tokenized_units = supply
            meta.save(update_fields=["total_supply", "tokenized_units"])


def noop(apps, schema_editor):
    # No reverse — we don't restore the known-wrong figures.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("properties", "0002_tokenmetadata_deployed_at_and_more"),
    ]

    operations = [migrations.RunPython(reconcile, noop)]
