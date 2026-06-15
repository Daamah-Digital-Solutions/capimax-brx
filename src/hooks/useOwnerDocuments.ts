import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface OwnerDocument {
  id: string;
  user_id: string;
  property_id: string | null;
  property_name: string | null;
  document_name: string;
  document_type: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  description: string | null;
  status: string;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export type DocumentType = 'ownership' | 'legal' | 'financial' | 'transaction' | 'certificate' | 'contract' | 'other';

export function useOwnerDocuments() {
  const [documents, setDocuments] = useState<OwnerDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("owner_documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments((data as unknown as OwnerDocument[]) || []);
    } catch (error) {
      console.error("Error fetching owner documents:", error);
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const uploadDocument = async (
    file: File,
    documentType: DocumentType,
    propertyId?: string,
    propertyName?: string,
    description?: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("owner-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create database record
      const { data, error } = await supabase
        .from("owner_documents")
        .insert({
          user_id: user.id,
          property_id: propertyId || null,
          property_name: propertyName || null,
          document_name: file.name,
          document_type: documentType,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          description: description || null,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Document Uploaded",
        description: "Your document has been uploaded successfully",
      });

      await fetchDocuments();
      return data as unknown as OwnerDocument;
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteDocument = async (documentId: string, filePath: string) => {
    try {
      // Delete from storage
      await supabase.storage.from("owner-documents").remove([filePath]);

      // Delete database record
      const { error } = await supabase
        .from("owner_documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;

      toast({
        title: "Document Deleted",
        description: "Document has been deleted successfully",
      });

      await fetchDocuments();
    } catch (error: any) {
      console.error("Error deleting document:", error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  const getSignedUrl = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("owner-documents")
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error("Error getting signed URL:", error);
      return null;
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  return {
    documents,
    isLoading,
    uploadDocument,
    deleteDocument,
    getSignedUrl,
    refetch: fetchDocuments,
  };
}
