"""
Auto-create a Profile when a User is created.

Replaces the Supabase `handle_new_user` trigger, which the migrations left
unwired (SPEC §4.3). The signal-created profile gets the safe baseline role
(investor, ACTIVE). The user's SELECTED role, when present, is applied by
RegisterSerializer via Profile.apply_self_selected_role — never read from raw
client input here (anti-privilege-escalation, SPEC §5; role policy in DECISIONS.md).
"""
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Profile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        # role defaults to INVESTOR on the model; never accept a client-supplied role.
        Profile.objects.get_or_create(user=instance)
