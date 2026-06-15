import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { LPDocument } from "@/hooks/useLiquidityProvider";
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  FileText,
  FileImage,
  File,
  Clock,
  BookOpen,
  FileCheck,
  FilePlus,
} from "lucide-react";

interface LPDocumentsProps {
  documents: LPDocument[];
  onUpload: (file: File, documentType: string, documentName: string) => Promise<{ success: boolean }>;
  onDownload: (doc: LPDocument) => Promise<{ success: boolean }>;
  onDelete: (docId: string) => Promise<{ success: boolean }>;
  isRTL: boolean;
}

export function LPDocuments({ documents, onUpload, onDownload, onDelete, isRTL }: LPDocumentsProps) {
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("other");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documentTypes = [
    { value: "business_model", label: isRTL ? "نموذج العمل" : "Business Model", icon: BookOpen },
    { value: "terms", label: isRTL ? "الشروط والأحكام" : "Terms & Conditions", icon: FileCheck },
    { value: "contract", label: isRTL ? "العقد" : "Contract", icon: FileText },
    { value: "report", label: isRTL ? "تقرير" : "Report", icon: FileText },
    { value: "other", label: isRTL ? "أخرى" : "Other", icon: File },
  ];

  const templateDocuments = documents.filter((doc) => doc.is_template);
  const userDocuments = documents.filter((doc) => !doc.is_template);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
      return FileImage;
    }
    if (["pdf", "doc", "docx"].includes(ext || "")) {
      return FileText;
    }
    return File;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    const result = await onUpload(selectedFile, documentType, documentName || selectedFile.name);
    
    if (result.success) {
      setShowUploadForm(false);
      setDocumentName("");
      setDocumentType("other");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    
    setUploading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!documentName) {
        setDocumentName(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Upload Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">
              {isRTL ? "مستندات مزود السيولة" : "Liquidity Provider Documents"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isRTL
                ? "تحميل وإدارة المستندات المتعلقة بنموذج العمل"
                : "Upload and manage documents related to the business model"}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowUploadForm(!showUploadForm)} className="gap-2">
          <Upload className="w-4 h-4" />
          {isRTL ? "رفع مستند" : "Upload Document"}
        </Button>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FilePlus className="w-5 h-5" />
              {isRTL ? "رفع مستند جديد" : "Upload New Document"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isRTL ? "اسم المستند" : "Document Name"}</Label>
                  <Input
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    placeholder={isRTL ? "أدخل اسم المستند" : "Enter document name"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "نوع المستند" : "Document Type"}</Label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3"
                  >
                    {documentTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{isRTL ? "اختر الملف" : "Select File"}</Label>
                <div className="flex items-center gap-4">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {isRTL
                    ? "الملفات المسموحة: PDF, DOC, DOCX, JPG, PNG (الحد الأقصى 20MB)"
                    : "Allowed: PDF, DOC, DOCX, JPG, PNG (Max 20MB)"}
                </p>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={uploading || !selectedFile}>
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      {isRTL ? "رفع" : "Upload"}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowUploadForm(false);
                    setSelectedFile(null);
                    setDocumentName("");
                  }}
                >
                  {isRTL ? "إلغاء" : "Cancel"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Template Documents (Business Model Info) */}
      {templateDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              {isRTL ? "مستندات نموذج العمل" : "Business Model Documents"}
            </CardTitle>
            <CardDescription>
              {isRTL
                ? "مستندات مرجعية لفهم نموذج عمل مزود السيولة"
                : "Reference documents to understand the Liquidity Provider business model"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              {templateDocuments.map((doc) => {
                const FileIcon = getFileIcon(doc.document_name);
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <FileIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{doc.document_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            {documentTypes.find((t) => t.value === doc.document_type)?.label || doc.document_type}
                          </Badge>
                          <span>{formatFileSize(doc.file_size)}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDownload(doc)}
                      className="gap-1"
                    >
                      <Download className="w-4 h-4" />
                      {isRTL ? "تحميل" : "Download"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {isRTL ? "مستنداتي" : "My Documents"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {userDocuments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">
                {isRTL ? "لا توجد مستندات" : "No documents yet"}
              </p>
              <p className="text-sm">
                {isRTL
                  ? "ابدأ برفع المستندات المتعلقة بحسابك"
                  : "Start by uploading documents related to your account"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {userDocuments.map((doc) => {
                const FileIcon = getFileIcon(doc.document_name);
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                        <FileIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{doc.document_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {documentTypes.find((t) => t.value === doc.document_type)?.label || doc.document_type}
                          </Badge>
                          <span>{formatFileSize(doc.file_size)}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownload(doc)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      {doc.uploaded_by === "user" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDelete(doc.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
