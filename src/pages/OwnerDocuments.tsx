import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOwnerDocuments, DocumentType } from "@/hooks/useOwnerDocuments";
import {
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  Search,
  Filter,
  FolderOpen,
  FileCheck,
  FileWarning,
  Building2,
  Calendar,
  Shield,
  Receipt,
  FileSpreadsheet,
  Scale,
  Clock,
} from "lucide-react";

const documentCategories = [
  { id: "all", icon: FolderOpen, labelEn: "All Documents", labelAr: "جميع المستندات" },
  { id: "ownership", icon: Shield, labelEn: "Ownership", labelAr: "ملكية" },
  { id: "legal", icon: Scale, labelEn: "Legal", labelAr: "قانوني" },
  { id: "financial", icon: FileSpreadsheet, labelEn: "Financial", labelAr: "مالي" },
  { id: "transaction", icon: Receipt, labelEn: "Transactions", labelAr: "معاملات" },
  { id: "certificate", icon: FileCheck, labelEn: "Certificates", labelAr: "شهادات" },
  { id: "contract", icon: FileText, labelEn: "Contracts", labelAr: "عقود" },
  { id: "other", icon: FolderOpen, labelEn: "Other", labelAr: "أخرى" },
];

export default function OwnerDocuments() {
  const { language } = useLanguage();
  const { documents, isLoading, uploadDocument, deleteDocument, getSignedUrl } = useOwnerDocuments();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    documentType: "other" as DocumentType,
    propertyName: "",
    description: "",
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.document_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.property_name && doc.property_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || doc.document_type === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadDialogOpen(true);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    await uploadDocument(
      selectedFile,
      uploadForm.documentType,
      undefined,
      uploadForm.propertyName || undefined,
      uploadForm.description || undefined
    );
    setUploading(false);
    setUploadDialogOpen(false);
    setSelectedFile(null);
    setUploadForm({ documentType: "other", propertyName: "", description: "" });
  };

  const handleView = async (filePath: string) => {
    const url = await getSignedUrl(filePath);
    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const url = await getSignedUrl(filePath);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocumentIcon = (type: string) => {
    const category = documentCategories.find(c => c.id === type);
    return category?.icon || FileText;
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {language === "ar" ? "مستندات المالك" : "Owner Documents"}
                </h1>
                <p className="text-muted-foreground">
                  {language === "ar" 
                    ? "إدارة وتخزين مستندات العقارات والاستثمارات" 
                    : "Manage and store property and investment documents"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={language === "ar" ? "بحث..." : "Search..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
                <Button 
                  variant="hero" 
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  {language === "ar" ? "رفع مستند" : "Upload Document"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{documents.length}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? "إجمالي المستندات" : "Total Documents"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {documents.filter(d => d.status === "active").length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? "نشط" : "Active"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {documents.filter(d => d.document_type === "ownership").length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? "ملكية" : "Ownership"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {documents.filter(d => d.document_type === "legal").length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? "قانوني" : "Legal"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Categories & Documents */}
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Categories Sidebar */}
            <Card className="lg:col-span-1 bg-card/50 backdrop-blur border-border/50 h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {language === "ar" ? "التصنيفات" : "Categories"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="space-y-1">
                  {documentCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                        selectedCategory === cat.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <cat.icon className="w-4 h-4" />
                      <span className="flex-1 text-left">
                        {language === "ar" ? cat.labelAr : cat.labelEn}
                      </span>
                      <span className="text-xs opacity-60">
                        {cat.id === "all"
                          ? documents.length
                          : documents.filter((d) => d.document_type === cat.id).length}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Documents List */}
            <Card className="lg:col-span-3 bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {selectedCategory === "all"
                      ? (language === "ar" ? "جميع المستندات" : "All Documents")
                      : documentCategories.find(c => c.id === selectedCategory)?.[language === "ar" ? "labelAr" : "labelEn"]}
                  </CardTitle>
                  <Badge variant="outline">
                    {filteredDocs.length} {language === "ar" ? "مستند" : "documents"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Clock className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FolderOpen className="w-12 h-12 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">
                      {language === "ar" ? "لا توجد مستندات" : "No documents found"}
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4 gap-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4" />
                      {language === "ar" ? "رفع أول مستند" : "Upload first document"}
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {filteredDocs.map((doc) => {
                      const DocIcon = getDocumentIcon(doc.document_type);
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                        >
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <DocIcon className="w-6 h-6 text-primary" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground truncate">
                              {doc.document_name}
                            </h4>
                            {doc.description && (
                              <p className="text-sm text-muted-foreground truncate">
                                {doc.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {doc.property_name && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {doc.property_name}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(doc.uploaded_at).toLocaleDateString()}
                              </span>
                              <span>{formatFileSize(doc.file_size)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {documentCategories.find(c => c.id === doc.document_type)?.[language === "ar" ? "labelAr" : "labelEn"]}
                            </Badge>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title={language === "ar" ? "عرض" : "View"}
                              onClick={() => handleView(doc.file_path)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title={language === "ar" ? "تنزيل" : "Download"}
                              onClick={() => handleDownload(doc.file_path, doc.document_name)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title={language === "ar" ? "حذف" : "Delete"}
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteDocument(doc.id, doc.file_path)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "رفع مستند" : "Upload Document"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? "أدخل تفاصيل المستند قبل الرفع"
                : "Enter document details before uploading"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedFile && (
              <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {language === "ar" ? "نوع المستند" : "Document Type"}
              </label>
              <Select
                value={uploadForm.documentType}
                onValueChange={(value) => setUploadForm(prev => ({ ...prev, documentType: value as DocumentType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentCategories.filter(c => c.id !== "all").map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {language === "ar" ? cat.labelAr : cat.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {language === "ar" ? "اسم العقار (اختياري)" : "Property Name (optional)"}
              </label>
              <Input
                placeholder={language === "ar" ? "أدخل اسم العقار" : "Enter property name"}
                value={uploadForm.propertyName}
                onChange={(e) => setUploadForm(prev => ({ ...prev, propertyName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {language === "ar" ? "الوصف (اختياري)" : "Description (optional)"}
              </label>
              <Textarea
                placeholder={language === "ar" ? "أدخل وصف المستند" : "Enter document description"}
                value={uploadForm.description}
                onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading 
                ? (language === "ar" ? "جاري الرفع..." : "Uploading...")
                : (language === "ar" ? "رفع" : "Upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
