"""
Distributions admin — Phase 9.

Declaring a distribution is a SANCTIONED ADMIN ACTION (like property publication, not
an exception handler): only the platform pools and pays a property's yield. The
"Declare & distribute" button opens an intermediate form (property + pool_amount +
type + period_label + pay_date) → runs services.declare_distribution, which snapshots
the property's current ACTIVE holders, splits the pool pro-rata, and credits each
holder's UserBalance immediately. Distributions/payouts are otherwise READ-ONLY in the
admin (the engine writes them; nobody edits them by hand).
"""
from django import forms
from django.contrib import admin, messages
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.urls import path, reverse

from apps.properties.models import Property

from .models import Distribution, DistributionPayout
from .services import NoEligibleHolders, declare_distribution


# Cadence choices the frontend Distributions.tsx understands.
DIST_TYPE_CHOICES = (
    ("monthly", "Monthly"),
    ("quarterly", "Quarterly"),
    ("semi-annual", "Semi-annual"),
    ("annual", "Annual"),
    ("special", "Special / one-off"),
)


class DeclareDistributionForm(forms.Form):
    """The admin declare form. Property is a dropdown of published catalog properties."""

    property_slug = forms.ChoiceField(label="Property")
    pool_amount_usd = forms.DecimalField(
        min_value=0.01, max_digits=18, decimal_places=2,
        label="Pool amount (USD) to split across holders",
    )
    dist_type = forms.ChoiceField(choices=DIST_TYPE_CHOICES, label="Cadence (type)")
    period_label = forms.CharField(max_length=64, label="Period label (e.g. \"Q4 2024\")")
    pay_date = forms.DateField(
        label="Pay date", widget=forms.DateInput(attrs={"type": "date"})
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Published first; show "Name (slug)" so the reviewer picks unambiguously.
        choices = [
            (p.slug, f"{p.name} ({p.slug}){'' if p.is_published else ' — unpublished'}")
            for p in Property.objects.all().order_by("-is_published", "name")
        ]
        self.fields["property_slug"].choices = choices


@admin.register(Distribution)
class DistributionAdmin(admin.ModelAdmin):
    change_list_template = "admin/distributions/distribution_changelist.html"
    list_display = (
        "property_id", "property_name", "pool_amount_usd", "dist_type",
        "period_label", "pay_date", "status", "declared_by", "created_at",
    )
    list_filter = ("status", "dist_type", "property_id")
    search_fields = ("property_id", "property_name", "period_label")
    readonly_fields = (
        "id", "property_id", "property_name", "declared_by", "pool_amount_usd",
        "dist_type", "period_label", "pay_date", "status", "created_at",
    )

    def has_add_permission(self, request):
        # Created ONLY through the declare flow (which snapshots + credits), never the
        # bare add form (that would persist a pool with no payouts).
        return False

    def has_change_permission(self, request, obj=None):
        return False  # read-only; the engine is the only writer

    # ----------------------------------------------------------------------- #
    # Declare surface — a custom admin view reached from the changelist button.
    # ----------------------------------------------------------------------- #
    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                "declare/",
                self.admin_site.admin_view(self.declare_view),
                name="distributions_distribution_declare",
            ),
        ]
        return custom + urls

    def declare_view(self, request):
        changelist_url = reverse("admin:distributions_distribution_changelist")
        if request.method == "POST":
            form = DeclareDistributionForm(request.POST)
            if form.is_valid():
                data = form.cleaned_data
                try:
                    dist = declare_distribution(
                        data["property_slug"],
                        data["pool_amount_usd"],
                        dist_type=data["dist_type"],
                        period_label=data["period_label"],
                        pay_date=data["pay_date"],
                        admin=request.user,
                    )
                except NoEligibleHolders as exc:
                    self.message_user(request, f"Nothing declared: {exc}", messages.WARNING)
                    return redirect(request.get_full_path())
                except Exception as exc:  # surface, don't 500
                    self.message_user(request, f"Declare failed: {exc}", messages.ERROR)
                    return redirect(request.get_full_path())
                n = dist.payouts.count()
                self.message_user(
                    request,
                    f"Declared ${dist.pool_amount_usd} for '{dist.property_id}' "
                    f"({dist.period_label}) — split across {n} holder(s) and credited "
                    f"each holder's balance.",
                    messages.SUCCESS,
                )
                return redirect(changelist_url)
        else:
            form = DeclareDistributionForm()

        context = {
            **self.admin_site.each_context(request),
            "title": "Declare & distribute",
            "intro": (
                "Declare a cash distribution for a property. The pool is split PRO-RATA "
                "across the property's CURRENT active token holders (by token amount) and "
                "credited to each holder's balance immediately. No tokens move on-chain."
            ),
            "form": form,
            "submit_label": "Declare & distribute",
            "back_url": changelist_url,
            "opts": self.model._meta,
        }
        return TemplateResponse(
            request, "admin/distributions/declare_distribution.html", context
        )


class DistributionPayoutInline(admin.TabularInline):
    model = DistributionPayout
    extra = 0
    readonly_fields = (
        "user", "holding", "tokens_at_snapshot", "ownership_pct_at_snapshot",
        "share_amount_usd", "credited", "created_at",
    )
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(DistributionPayout)
class DistributionPayoutAdmin(admin.ModelAdmin):
    list_display = (
        "distribution", "user", "tokens_at_snapshot", "ownership_pct_at_snapshot",
        "share_amount_usd", "credited", "created_at",
    )
    list_filter = ("credited",)
    search_fields = ("user__email", "distribution__property_id")
    readonly_fields = (
        "id", "distribution", "user", "holding", "tokens_at_snapshot",
        "ownership_pct_at_snapshot", "share_amount_usd", "credited", "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
