"""
Django admin for the user/profile foundation. SPEC §3.0 — admin is the product's
sole back-office surface, and (GOVERNING PRINCIPLES) an exception handler, not a
required step in any flow.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import Profile, User


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = "Profile"
    # role + role_status ARE editable here — admin is the only place they may change
    # (SPEC §5). Flipping role_status to "active" is the manual exception path that
    # verification webhooks automate in a later phase (DECISIONS.md: automation-first).
    fields = (
        "full_name",
        "phone",
        "avatar_url",
        "is_us_citizen",
        "role",
        "role_status",
        "role_verified_at",
    )
    # Audit stamp — auto-set when role_status becomes active (see Profile.save).
    readonly_fields = ("role_verified_at",)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """Email-login user admin (no username). SPEC §3.13."""

    inlines = [ProfileInline]
    ordering = ("-date_joined",)
    list_display = ("email", "is_email_verified", "is_staff", "is_active", "date_joined")
    list_filter = ("is_staff", "is_active", "is_email_verified", "is_superuser")
    search_fields = ("email",)
    readonly_fields = ("date_joined", "last_login")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Status"), {"fields": ("is_email_verified",)}),
        (
            _("Permissions"),
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "is_staff", "is_active"),
            },
        ),
    )


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    """SPEC §3.0: list_display / list_filter / search_fields for profiles."""

    list_display = ("user", "full_name", "role", "role_status", "phone")
    list_filter = ("role", "role_status")
    search_fields = ("full_name", "user__email", "phone")
    autocomplete_fields = ("user",)
    readonly_fields = ("role_verified_at",)
