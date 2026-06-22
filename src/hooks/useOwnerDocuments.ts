import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  ownerDocumentsApi,
  type OwnerDocumentRow,
} from "@/integrations/api/client";

// Owner documents — repointed off Supabase onto the Django ownerDocumentsApi (one of the
// satellite Supabase surfaces; see OWNER_DOCUMENTS.md). A self-scoped personal VAULT:
// files are stored server-side under the gitignored backend/media/, the owner sees only
// their OWN docs, and the blob is streamed from an owner-only download endpoint (no more
// Supabase storage bucket / signed URLs). NO Property FK — `property_name` stays a
// free-text label. The server validates file type + size on upload.

// Re-export the row shape under the legacy name the page imports.
export type OwnerDocument = OwnerDocumentRow;

export type DocumentType =
  | "ownership"
  | "legal"
  | "financial"
  | "transaction"
  | "certificate"
  | "contract"
  | "other";

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useOwnerDocuments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<OwnerDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    if (!user?.id) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setDocuments(await ownerDocumentsApi.list());
    } catch (error) {
      console.error("Error fetching owner documents:", error);
      toast({ title: "Error", description: "Failed to load documents", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const uploadDocument = async (
    file: File,
    documentType: DocumentType,
    propertyName?: string,
    description?: string,
  ) => {
    try {
      const doc = await ownerDocumentsApi.upload(file, documentType, {
        documentName: file.name,
        propertyName,
        description,
      });
      toast({ title: "Document Uploaded", description: "Your document has been uploaded successfully" });
      await fetchDocuments();
      return doc;
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast({
        title: "Upload Failed",
        description: error?.message || "Failed to upload document",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      await ownerDocumentsApi.delete(documentId);
      toast({ title: "Document Deleted", description: "Document has been deleted successfully" });
      await fetchDocuments();
    } catch (error: any) {
      console.error("Error deleting document:", error);
      toast({
        title: "Delete Failed",
        description: error?.message || "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  // Open the document in a new tab (owner-only blob).
  const viewDocument = async (documentId: string) => {
    try {
      const blob = await ownerDocumentsApi.download(documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // Revoke after a beat so the new tab can load it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      console.error("Error opening document:", error);
      toast({ title: "Error", description: "Failed to open document", variant: "destructive" });
    }
  };

  // Download the document blob to disk (owner-only).
  const downloadDocument = async (documentId: string, fileName: string) => {
    try {
      triggerBlobDownload(await ownerDocumentsApi.download(documentId), fileName);
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({ title: "Error", description: "Failed to download document", variant: "destructive" });
    }
  };

  return {
    documents,
    isLoading,
    uploadDocument,
    deleteDocument,
    viewDocument,
    downloadDocument,
    refetch: fetchDocuments,
  };
}
