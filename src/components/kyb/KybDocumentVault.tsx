import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Download, Loader2 } from "lucide-react";
import type { KybDocumentRow } from "@/integrations/api/client";

/**
 * Shared entity-KYB document vault control (Owner / Developer / Partner cards).
 *
 * Mirrors the LP KYB-document upload pattern: a real multipart upload via the role's
 * api method + a self-scoped list with per-document download. Lets an entity attach
 * its business-verification evidence (registration certificate / trade licence / …)
 * so an admin can review it before manually approving KYB when Sumsub is deferred.
 *
 * Self-contained: owns its own list/upload state; bilingual EN/AR. The three role
 * APIs share the identical `kybDocuments` / `uploadKYBDocument` / `downloadKYBDocument`
 * shape, so this stays DRY across the cards.
 */
export interface KybDocumentVaultProps {
  isArabic: boolean;
  /** The role api's self-scoped list of the caller's KYB documents. */
  list: () => Promise<KybDocumentRow[]>;
  /** The role api's multipart upload (file, documentType, documentName). */
  upload: (file: File, documentType: string, documentName: string) => Promise<KybDocumentRow>;
  /** The role api's self-scoped blob download (triggers a browser save). */
  download: (docId: string, filename?: string) => Promise<void>;
  /** Called after a successful upload (e.g. refresh the profile so kyb_status updates). */
  onUploaded?: () => void;
}

export function KybDocumentVault({ isArabic, list, upload, download, onUploaded }: KybDocumentVaultProps) {
  const [docs, setDocs] = useState<KybDocumentRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocs = async () => {
    try {
      setDocs(await list());
    } catch {
      // No profile yet / nothing uploaded — keep the empty list.
    }
  };

  useEffect(() => {
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await upload(file, "registration_certificate", file.name);
      await loadDocs();
      onUploaded?.();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const statusLabel = (s: string) => {
    if (s === "approved") return isArabic ? "معتمد" : "Approved";
    if (s === "rejected") return isArabic ? "مرفوض" : "Rejected";
    return isArabic ? "قيد المراجعة" : "Pending";
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <FileText className="h-4 w-4 text-primary" />
        {isArabic ? "مستندات التحقق من الكيان (KYB)" : "Entity verification documents (KYB)"}
      </div>
      <p className="text-xs text-muted-foreground">
        {isArabic
          ? "ارفع مستندات الكيان (السجل التجاري / الرخصة التجارية) ليراجعها المشرف قبل الاعتماد."
          : "Upload your entity documents (registration certificate / trade licence) for admin review before approval."}
      </p>

      {docs.length > 0 && (
        <ul className="space-y-1">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{d.document_name}</span>
                <Badge variant="outline" className="text-[10px]">{statusLabel(d.status)}</Badge>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 px-2"
                onClick={() => download(d.id, d.document_name)}
                title={isArabic ? "تنزيل" : "Download"}
              >
                <Download className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
        {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        {isArabic ? "رفع مستند" : "Upload document"}
      </Button>
    </div>
  );
}
