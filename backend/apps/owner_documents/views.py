"""
Owner-documents API — a self-scoped personal vault, repointed off Supabase.
Mirrors apps/lp/views.py (LPDocument list/upload/delete/download) verbatim, with
ONE intentional improvement: because this is a PII document upload, the POST path
adds SERVER-SIDE validation (extension + content-type allowlist and a max size).

  GET    /api/owner-documents/               The caller's own documents (newest first).
  POST   /api/owner-documents/               Upload a document (multipart) — validated.
  DELETE /api/owner-documents/{id}/          Delete one of the caller's own documents.
  GET    /api/owner-documents/{id}/download/ Owner-only file blob (FileResponse).

Everything is OWNER-SCOPED: every queryset is `filter(user=request.user)`, so an
owner only ever sees / downloads / deletes their OWN rows (a second user gets 404).
"""
import os

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import OwnerDocument
from .serializers import OwnerDocumentSerializer

# --- Server-side upload validation (intentional improvement over the LP pattern). ---
# Matches the frontend file picker `accept` (.pdf,.doc,.docx,.jpg,.jpeg,.png).
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB cap.
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
}


def _validate_upload(upload):
    """Return an error string if the upload is missing / oversize / a disallowed type, else None."""
    if upload is None:
        return "A file is required."
    if upload.size and upload.size > MAX_UPLOAD_BYTES:
        return f"File too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)."
    ext = os.path.splitext(upload.name or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return f"Disallowed file type '{ext or 'unknown'}'. Allowed: PDF, DOC, DOCX, JPG, PNG."
    # content_type is client-supplied; treat as a secondary gate (extension is primary).
    content_type = getattr(upload, "content_type", None)
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        return f"Disallowed content type '{content_type}'."
    return None


class OwnerDocumentsView(APIView):
    """List the caller's own documents; upload a new one (validated)."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        docs = OwnerDocument.objects.filter(user=request.user)
        return Response(OwnerDocumentSerializer(docs, many=True).data)

    def post(self, request):
        upload = request.FILES.get("file")
        error = _validate_upload(upload)
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)

        document_type = request.data.get("document_type") or "other"
        if document_type not in OwnerDocument.DocType.values:
            document_type = "other"
        document_name = request.data.get("document_name") or upload.name
        doc = OwnerDocument.objects.create(
            user=request.user,
            document_name=document_name,
            document_type=document_type,
            file=upload,
            file_size=getattr(upload, "size", None),
            file_type=getattr(upload, "content_type", None),
            description=request.data.get("description") or None,
            property_name=request.data.get("property_name") or None,
            status="active",
        )
        return Response(
            OwnerDocumentSerializer(doc).data, status=status.HTTP_201_CREATED
        )


class OwnerDocumentDetailView(APIView):
    """Delete one of the caller's own documents (removes the row + the stored file)."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, doc_id):
        doc = get_object_or_404(OwnerDocument, pk=doc_id, user=request.user)
        if doc.file:
            doc.file.delete(save=False)
        doc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OwnerDocumentDownloadView(APIView):
    """Owner-only file download (blob). Replaces the Supabase signed URL."""

    permission_classes = [IsAuthenticated]

    def get(self, request, doc_id):
        doc = get_object_or_404(OwnerDocument, pk=doc_id, user=request.user)
        if not doc.file:
            return Response({"detail": "No file."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            doc.file.open("rb"), as_attachment=True, filename=doc.document_name
        )
