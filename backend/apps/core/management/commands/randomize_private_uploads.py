"""
Give already-uploaded private files unguessable names (apps/core/private_media.py).

  python manage.py randomize_private_uploads --dry-run   # list what would move
  python manage.py randomize_private_uploads             # move + update the database

Every file of a PrivateUpload field whose name isn't random yet is copied to a new random
name, the row is updated, then the old file is removed. A missing file is reported and left
alone. Safe to re-run: already-random names are skipped.
"""
import re

from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import FileField

from apps.core.private_media import PrivateUpload

RANDOM = re.compile(r"/[0-9a-f]{64}(\.[a-z0-9]{0,7})?$")


class Command(BaseCommand):
    help = "Rename existing private uploads to unguessable names."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, dry_run=False, **opts):
        moved = missing = skipped = 0
        for model in apps.get_models():
            for field in model._meta.fields:
                if not isinstance(field, FileField) or not isinstance(field.upload_to, PrivateUpload):
                    continue
                qs = model.objects.exclude(**{field.name: ""}).exclude(**{f"{field.name}__isnull": True})
                for obj in qs.iterator():
                    ff = getattr(obj, field.name)
                    old = ff.name
                    if RANDOM.search(old.replace("\\", "/")):
                        skipped += 1
                        continue
                    storage = ff.storage
                    if not storage.exists(old):
                        missing += 1
                        self.stdout.write(f"MISSING {model.__name__}.{field.name} {obj.pk}: {old}")
                        continue
                    new = field.generate_filename(obj, old.rsplit("/", 1)[-1])
                    self.stdout.write(f"{'WOULD MOVE' if dry_run else 'MOVE'} {model.__name__}.{field.name} {obj.pk}")
                    if dry_run:
                        moved += 1
                        continue
                    with storage.open(old, "rb") as src:
                        saved = storage.save(new, src)
                    with transaction.atomic():
                        extra = {}
                        # Certificate keeps a copy of the storage path.
                        if field.name == "pdf_file" and hasattr(obj, "pdf_path"):
                            extra["pdf_path"] = saved
                        model.objects.filter(pk=obj.pk).update(**{field.name: saved}, **extra)
                    storage.delete(old)
                    moved += 1
        self.stdout.write(f"moved={moved} skipped={skipped} missing={missing} dry_run={dry_run}")
