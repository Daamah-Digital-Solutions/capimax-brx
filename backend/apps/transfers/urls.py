"""Gift / family-transfer / inheritance routes — mounted at /api/transfers/."""
from django.urls import path

from . import views

app_name = "transfers"

urlpatterns = [
    path("", views.TransferListView.as_view(), name="list"),
    path("giftable/", views.GiftableView.as_view(), name="giftable"),
    path("gifts/", views.GiftCreateView.as_view(), name="gift-create"),
    path("family/", views.FamilyTransferCreateView.as_view(), name="family-create"),
    path("<uuid:pk>/cancel/", views.TransferCancelView.as_view(), name="cancel"),
    path("estate/beneficiaries/", views.BeneficiariesView.as_view(), name="beneficiaries"),
    path("estate/certificate/pdf/", views.CertificatePdfView.as_view(), name="certificate-pdf"),
    path("estate/claims/", views.EstateClaimsView.as_view(), name="claims"),
]
