"""Property read API routes, mounted at /api/. SPEC §2.12."""
from rest_framework.routers import DefaultRouter

from .views import PropertyViewSet

router = DefaultRouter()
router.register("properties", PropertyViewSet, basename="property")

app_name = "properties"
urlpatterns = router.urls
