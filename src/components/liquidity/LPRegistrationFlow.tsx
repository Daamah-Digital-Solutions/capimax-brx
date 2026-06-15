import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle,
  Circle,
  Building2,
  FileText,
  Upload,
  ArrowRight,
  ArrowLeft,
  Loader2,
  User,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Briefcase,
} from "lucide-react";

interface LPRegistrationFlowProps {
  onSubmitRegistration: (data: RegistrationData) => Promise<{ success: boolean; error?: string }>;
  onSubmitKYB: (data: KYBData) => Promise<{ success: boolean; error?: string }>;
  onUploadDocument: (file: File, documentType: string, documentName: string) => Promise<{ success: boolean; error?: string }>;
  isRTL?: boolean;
}

interface RegistrationData {
  company_name?: string;
  contact_name: string;
  email: string;
  phone?: string;
  country?: string;
  investment_amount: number;
}

interface KYBData {
  business_type: string;
  business_registration_number: string;
  tax_id: string;
  business_address: string;
  business_description: string;
  annual_revenue: string;
  source_of_funds: string;
}

const STEPS = [
  { id: 1, title: "Registration", titleAr: "التسجيل", icon: User },
  { id: 2, title: "Business Info", titleAr: "معلومات الأعمال", icon: Building2 },
  { id: 3, title: "Documents", titleAr: "المستندات", icon: FileText },
  { id: 4, title: "Review", titleAr: "المراجعة", icon: CheckCircle },
];

const DOCUMENT_TYPES = [
  { id: "business_license", label: "Business License", labelAr: "رخصة العمل" },
  { id: "incorporation_certificate", label: "Incorporation Certificate", labelAr: "شهادة التأسيس" },
  { id: "tax_certificate", label: "Tax Certificate", labelAr: "الشهادة الضريبية" },
  { id: "bank_statement", label: "Bank Statement (Last 3 months)", labelAr: "كشف حساب بنكي (آخر 3 أشهر)" },
  { id: "proof_of_address", label: "Proof of Business Address", labelAr: "إثبات عنوان العمل" },
  { id: "id_document", label: "ID Document (Authorized Signatory)", labelAr: "وثيقة هوية (المفوض بالتوقيع)" },
];

export function LPRegistrationFlow({
  onSubmitRegistration,
  onSubmitKYB,
  onUploadDocument,
  isRTL = false,
}: LPRegistrationFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);

  // Registration form state
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    country: "",
    investment_amount: 100000,
  });

  // KYB form state
  const [kybData, setKybData] = useState<KYBData>({
    business_type: "",
    business_registration_number: "",
    tax_id: "",
    business_address: "",
    business_description: "",
    annual_revenue: "",
    source_of_funds: "",
  });

  const progress = (currentStep / STEPS.length) * 100;

  const handleRegistrationChange = (field: keyof RegistrationData, value: string | number) => {
    setRegistrationData((prev) => ({ ...prev, [field]: value }));
  };

  const handleKYBChange = (field: keyof KYBData, value: string) => {
    setKybData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(docType);
    try {
      const result = await onUploadDocument(file, docType, file.name);
      if (result.success) {
        setUploadedDocs((prev) => [...prev, docType]);
        toast.success(isRTL ? "تم رفع المستند بنجاح" : "Document uploaded successfully");
      } else {
        toast.error(result.error || (isRTL ? "فشل رفع المستند" : "Failed to upload document"));
      }
    } catch (error) {
      toast.error(isRTL ? "حدث خطأ" : "An error occurred");
    } finally {
      setUploadingDoc(null);
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(
          registrationData.contact_name &&
          registrationData.email &&
          registrationData.investment_amount >= 100000
        );
      case 2:
        return !!(
          kybData.business_type &&
          kybData.business_registration_number &&
          kybData.business_address &&
          kybData.source_of_funds
        );
      case 3:
        return uploadedDocs.length >= 3; // At least 3 documents required
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) {
      toast.error(isRTL ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill in all required fields");
      return;
    }

    if (currentStep === 1) {
      setLoading(true);
      try {
        const result = await onSubmitRegistration(registrationData);
        if (!result.success) {
          toast.error(result.error || (isRTL ? "فشل التسجيل" : "Registration failed"));
          setLoading(false);
          return;
        }
      } catch (error) {
        toast.error(isRTL ? "حدث خطأ" : "An error occurred");
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    if (currentStep === 4) {
      setLoading(true);
      try {
        const result = await onSubmitKYB(kybData);
        if (result.success) {
          toast.success(isRTL ? "تم تقديم طلبك بنجاح!" : "Your application has been submitted!");
        } else {
          toast.error(result.error || (isRTL ? "فشل تقديم الطلب" : "Submission failed"));
        }
      } catch (error) {
        toast.error(isRTL ? "حدث خطأ" : "An error occurred");
      }
      setLoading(false);
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {isRTL ? `الخطوة ${currentStep} من ${STEPS.length}` : `Step ${currentStep} of ${STEPS.length}`}
              </span>
              <span className="text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            
            {/* Step Indicators */}
            <div className="flex justify-between mt-6">
              {STEPS.map((step) => {
                const Icon = step.icon;
                const isCompleted = currentStep > step.id;
                const isCurrent = currentStep === step.id;
                
                return (
                  <div key={step.id} className="flex flex-col items-center gap-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        isCompleted
                          ? "bg-emerald-500 text-white"
                          : isCurrent
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        isCurrent ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {isRTL ? step.titleAr : step.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              {isRTL ? "التسجيل كمزود سيولة" : "Register as Liquidity Provider"}
            </CardTitle>
            <CardDescription>
              {isRTL
                ? "أدخل معلوماتك الأساسية للبدء"
                : "Enter your basic information to get started"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">
                  <Building2 className="w-4 h-4 inline mr-2" />
                  {isRTL ? "اسم الشركة" : "Company Name"}
                </Label>
                <Input
                  id="company_name"
                  value={registrationData.company_name}
                  onChange={(e) => handleRegistrationChange("company_name", e.target.value)}
                  placeholder={isRTL ? "اسم الشركة" : "Company name"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_name">
                  <User className="w-4 h-4 inline mr-2" />
                  {isRTL ? "اسم جهة الاتصال *" : "Contact Name *"}
                </Label>
                <Input
                  id="contact_name"
                  value={registrationData.contact_name}
                  onChange={(e) => handleRegistrationChange("contact_name", e.target.value)}
                  placeholder={isRTL ? "الاسم الكامل" : "Full name"}
                  required
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="w-4 h-4 inline mr-2" />
                  {isRTL ? "البريد الإلكتروني *" : "Email *"}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={registrationData.email}
                  onChange={(e) => handleRegistrationChange("email", e.target.value)}
                  placeholder="email@company.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">
                  <Phone className="w-4 h-4 inline mr-2" />
                  {isRTL ? "رقم الهاتف" : "Phone Number"}
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={registrationData.phone}
                  onChange={(e) => handleRegistrationChange("phone", e.target.value)}
                  placeholder="+971 50 123 4567"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">
                  <MapPin className="w-4 h-4 inline mr-2" />
                  {isRTL ? "البلد" : "Country"}
                </Label>
                <Select
                  value={registrationData.country}
                  onValueChange={(value) => handleRegistrationChange("country", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? "اختر البلد" : "Select country"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UAE">UAE</SelectItem>
                    <SelectItem value="Saudi Arabia">Saudi Arabia</SelectItem>
                    <SelectItem value="Qatar">Qatar</SelectItem>
                    <SelectItem value="Kuwait">Kuwait</SelectItem>
                    <SelectItem value="Bahrain">Bahrain</SelectItem>
                    <SelectItem value="Oman">Oman</SelectItem>
                    <SelectItem value="United States">United States</SelectItem>
                    <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="investment_amount">
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  {isRTL ? "مبلغ الاستثمار (بالدولار) *" : "Investment Amount (USD) *"}
                </Label>
                <Input
                  id="investment_amount"
                  type="number"
                  min={100000}
                  value={registrationData.investment_amount}
                  onChange={(e) => handleRegistrationChange("investment_amount", parseInt(e.target.value) || 0)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "الحد الأدنى: 100,000 دولار" : "Minimum: $100,000"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {isRTL ? "معلومات الأعمال (KYB)" : "Business Information (KYB)"}
            </CardTitle>
            <CardDescription>
              {isRTL
                ? "أدخل تفاصيل عملك للتحقق"
                : "Enter your business details for verification"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="business_type">
                  {isRTL ? "نوع العمل *" : "Business Type *"}
                </Label>
                <Select
                  value={kybData.business_type}
                  onValueChange={(value) => handleKYBChange("business_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? "اختر نوع العمل" : "Select business type"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corporation">{isRTL ? "شركة مساهمة" : "Corporation"}</SelectItem>
                    <SelectItem value="llc">{isRTL ? "شركة ذات مسؤولية محدودة" : "LLC"}</SelectItem>
                    <SelectItem value="partnership">{isRTL ? "شراكة" : "Partnership"}</SelectItem>
                    <SelectItem value="sole_proprietorship">{isRTL ? "مؤسسة فردية" : "Sole Proprietorship"}</SelectItem>
                    <SelectItem value="trust">{isRTL ? "صندوق استثماري" : "Trust"}</SelectItem>
                    <SelectItem value="fund">{isRTL ? "صندوق" : "Fund"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_registration_number">
                  {isRTL ? "رقم السجل التجاري *" : "Business Registration Number *"}
                </Label>
                <Input
                  id="business_registration_number"
                  value={kybData.business_registration_number}
                  onChange={(e) => handleKYBChange("business_registration_number", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax_id">
                  {isRTL ? "الرقم الضريبي" : "Tax ID"}
                </Label>
                <Input
                  id="tax_id"
                  value={kybData.tax_id}
                  onChange={(e) => handleKYBChange("tax_id", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="annual_revenue">
                  {isRTL ? "الإيرادات السنوية" : "Annual Revenue"}
                </Label>
                <Select
                  value={kybData.annual_revenue}
                  onValueChange={(value) => handleKYBChange("annual_revenue", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? "اختر النطاق" : "Select range"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under_1m">Under $1M</SelectItem>
                    <SelectItem value="1m_10m">$1M - $10M</SelectItem>
                    <SelectItem value="10m_50m">$10M - $50M</SelectItem>
                    <SelectItem value="50m_100m">$50M - $100M</SelectItem>
                    <SelectItem value="over_100m">Over $100M</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_address">
                {isRTL ? "عنوان العمل *" : "Business Address *"}
              </Label>
              <Textarea
                id="business_address"
                value={kybData.business_address}
                onChange={(e) => handleKYBChange("business_address", e.target.value)}
                placeholder={isRTL ? "العنوان الكامل" : "Full address"}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_description">
                {isRTL ? "وصف النشاط التجاري" : "Business Description"}
              </Label>
              <Textarea
                id="business_description"
                value={kybData.business_description}
                onChange={(e) => handleKYBChange("business_description", e.target.value)}
                placeholder={isRTL ? "صف نشاطك التجاري" : "Describe your business activities"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source_of_funds">
                {isRTL ? "مصدر الأموال *" : "Source of Funds *"}
              </Label>
              <Select
                value={kybData.source_of_funds}
                onValueChange={(value) => handleKYBChange("source_of_funds", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? "اختر مصدر الأموال" : "Select source of funds"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business_profits">{isRTL ? "أرباح الأعمال" : "Business Profits"}</SelectItem>
                  <SelectItem value="investment_returns">{isRTL ? "عوائد الاستثمار" : "Investment Returns"}</SelectItem>
                  <SelectItem value="savings">{isRTL ? "مدخرات" : "Savings"}</SelectItem>
                  <SelectItem value="inheritance">{isRTL ? "ميراث" : "Inheritance"}</SelectItem>
                  <SelectItem value="sale_of_assets">{isRTL ? "بيع أصول" : "Sale of Assets"}</SelectItem>
                  <SelectItem value="other">{isRTL ? "أخرى" : "Other"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {isRTL ? "المستندات المطلوبة" : "Required Documents"}
            </CardTitle>
            <CardDescription>
              {isRTL
                ? "ارفع المستندات التالية للتحقق من عملك (3 مستندات على الأقل)"
                : "Upload the following documents to verify your business (at least 3 documents)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {DOCUMENT_TYPES.map((doc) => {
                const isUploaded = uploadedDocs.includes(doc.id);
                const isUploading = uploadingDoc === doc.id;

                return (
                  <div
                    key={doc.id}
                    className={`p-4 border rounded-lg transition-colors ${
                      isUploaded ? "border-emerald-500 bg-emerald-500/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isUploaded ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{isRTL ? doc.labelAr : doc.label}</p>
                          {isUploaded && (
                            <Badge variant="outline" className="mt-1 text-emerald-500 border-emerald-500">
                              {isRTL ? "تم الرفع" : "Uploaded"}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <input
                          type="file"
                          id={`file-${doc.id}`}
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileUpload(e, doc.id)}
                          disabled={isUploading}
                        />
                        <Button
                          variant={isUploaded ? "outline" : "default"}
                          size="sm"
                          onClick={() => document.getElementById(`file-${doc.id}`)?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              {isUploaded
                                ? isRTL
                                  ? "استبدال"
                                  : "Replace"
                                : isRTL
                                ? "رفع"
                                : "Upload"}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {isRTL
                  ? `تم رفع ${uploadedDocs.length} من ${DOCUMENT_TYPES.length} مستندات. مطلوب 3 مستندات على الأقل.`
                  : `${uploadedDocs.length} of ${DOCUMENT_TYPES.length} documents uploaded. At least 3 required.`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              {isRTL ? "مراجعة وتقديم" : "Review & Submit"}
            </CardTitle>
            <CardDescription>
              {isRTL
                ? "راجع معلوماتك قبل التقديم"
                : "Review your information before submitting"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Registration Summary */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                {isRTL ? "معلومات التسجيل" : "Registration Information"}
              </h4>
              <div className="grid sm:grid-cols-2 gap-3 p-4 bg-muted/30 rounded-lg text-sm">
                <div>
                  <span className="text-muted-foreground">{isRTL ? "الشركة:" : "Company:"}</span>
                  <span className="font-medium ml-2">{registrationData.company_name || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{isRTL ? "جهة الاتصال:" : "Contact:"}</span>
                  <span className="font-medium ml-2">{registrationData.contact_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{isRTL ? "البريد:" : "Email:"}</span>
                  <span className="font-medium ml-2">{registrationData.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{isRTL ? "الاستثمار:" : "Investment:"}</span>
                  <span className="font-medium ml-2">${registrationData.investment_amount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* KYB Summary */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                {isRTL ? "معلومات الأعمال" : "Business Information"}
              </h4>
              <div className="grid sm:grid-cols-2 gap-3 p-4 bg-muted/30 rounded-lg text-sm">
                <div>
                  <span className="text-muted-foreground">{isRTL ? "نوع العمل:" : "Business Type:"}</span>
                  <span className="font-medium ml-2">{kybData.business_type}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{isRTL ? "رقم التسجيل:" : "Registration #:"}</span>
                  <span className="font-medium ml-2">{kybData.business_registration_number}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">{isRTL ? "العنوان:" : "Address:"}</span>
                  <span className="font-medium ml-2">{kybData.business_address}</span>
                </div>
              </div>
            </div>

            {/* Documents Summary */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {isRTL ? "المستندات المرفوعة" : "Uploaded Documents"}
              </h4>
              <div className="flex flex-wrap gap-2">
                {uploadedDocs.map((docId) => {
                  const doc = DOCUMENT_TYPES.find((d) => d.id === docId);
                  return (
                    <Badge key={docId} variant="secondary" className="gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                      {doc ? (isRTL ? doc.labelAr : doc.label) : docId}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="p-4 border border-yellow-500/30 bg-yellow-500/5 rounded-lg text-sm">
              <p className="text-muted-foreground">
                {isRTL
                  ? "بالنقر على 'تقديم الطلب'، أؤكد أن جميع المعلومات المقدمة صحيحة ودقيقة. أفهم أن طلبي سيخضع للمراجعة وأن الموافقة تخضع للتحقق."
                  : "By clicking 'Submit Application', I confirm that all information provided is true and accurate. I understand that my application will be subject to review and approval is subject to verification."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1 || loading}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {isRTL ? "السابق" : "Back"}
        </Button>
        <Button onClick={handleNext} disabled={loading || !validateStep(currentStep)}>
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : currentStep === 4 ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              {isRTL ? "تقديم الطلب" : "Submit Application"}
            </>
          ) : (
            <>
              {isRTL ? "التالي" : "Next"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
