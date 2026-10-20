"""
/api/roles/ — multi-role accounts (apps/roles/services.py).

  GET  /                          my roles: held / pending / rejected / available + the current one
  POST owner/                     become a Property Owner (instant)
  POST switch/                    {role} — make a held role the current one
  GET  applications/<slug>/       my application for broker | liquidity_provider | developer | partner
  POST applications/<slug>/       submit or edit & resubmit it (multipart: fields + documents)
"""
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import RoleApplication


class RolesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(services.overview(request.user))


class BecomeOwnerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        services.become_owner(request.user)
        return Response(services.overview(request.user), status=status.HTTP_201_CREATED)


class SwitchRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        services.switch_role(request.user, str(request.data.get("role") or ""))
        return Response(services.overview(request.user))


class ApplicationSerializer(serializers.ModelSerializer):
    documents = serializers.SerializerMethodField()

    class Meta:
        model = RoleApplication
        fields = ("id", "role", "status", "data", "review_note", "submitted_at", "decided_at", "documents")

    def get_documents(self, obj):
        return [{"kind": d.kind, "name": d.original_name, "size": d.size, "uploaded_at": d.uploaded_at}
                for d in obj.documents.all()]


class ApplicationView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, slug):
        role = services.role_for_slug(slug)
        app = RoleApplication.objects.filter(user=request.user, role=role).first()
        return Response({
            "role": role,
            "status": services.role_status(request.user, role),
            "form": services.ROLE_FORMS.get(role),
            "application": ApplicationSerializer(app).data if app else None,
        })

    def post(self, request, slug):
        from apps.core.permissions import EMAIL_UNVERIFIED, needs_email_verification

        if needs_email_verification(request.user):
            return Response(EMAIL_UNVERIFIED, status=status.HTTP_403_FORBIDDEN)
        data = {k: request.data.get(k) for k in request.data.keys() if k not in request.FILES}
        app = services.submit_application(request.user, slug, data, dict(request.FILES.items()))
        return Response(ApplicationSerializer(app).data, status=status.HTTP_201_CREATED)
