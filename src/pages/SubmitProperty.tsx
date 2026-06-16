import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ownerApi } from "@/integrations/api/client";
import { useOwnerProfile } from "@/hooks/useOwnerProfile";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import {
  Building2,
  MapPin,
  DollarSign,
  FileText,
  Image,
  Check,
  ChevronRight,
  ChevronLeft,
  Upload,
  Info,
  AlertCircle,
  Save,
  ShieldCheck,
  Loader2,
} from "lucide-react";

const steps = [
  { id: 1, title: "Basic Info", icon: Building2 },
  { id: 2, title: "Location", icon: MapPin },
  { id: 3, title: "Financial Details", icon: DollarSign },
  { id: 4, title: "Documents", icon: FileText },
  { id: 5, title: "Media", icon: Image },
  { id: 6, title: "Review & Submit", icon: Check },
];

const propertyTypes = [
  { id: "residential", label: "Residential" },
  { id: "commercial", label: "Commercial" },
  { id: "mixed", label: "Mixed Use" },
  { id: "industrial", label: "Industrial" },
  { id: "land", label: "Land" },
];

const constructionStatus = [
  { id: "ready", label: "Ready / Completed" },
  { id: "under-construction", label: "Under Construction" },
  { id: "off-plan", label: "Off-Plan" },
];

const requiredDocuments = [
  { id: "title", name: "Title Deed", required: true },
  { id: "valuation", name: "Valuation Report", required: true },
  { id: "insurance", name: "Insurance Policy", required: true },
  { id: "noc", name: "NOC (No Objection Certificate)", required: false },
  { id: "financial", name: "Financial Statements", required: false },
  { id: "legal", name: "Legal Documents", required: true },
];

// Required-document types the backend enforces on submit (Title Deed, Valuation,
// Legal — the `required: true` items the form marks). Mirrors
// owner.models.REQUIRED_SUBMISSION_DOC_TYPES.
const REQUIRED_DOC_IDS = ["title", "valuation", "legal"];

interface UploadedDoc {
  id: string;
  document_name: string;
}

export default function SubmitProperty() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { ownerProfile, loading: ownerLoading } = useOwnerProfile();

  const [currentStep, setCurrentStep] = useState(1);

  // All wizard fields — controlled state mirroring exactly what the form collects.
  const [form, setForm] = useState({
    name: "",
    property_type: "",
    construction_status: "",
    description: "",
    country: "",
    city: "",
    district: "",
    address: "",
    property_value_usd: "",
    min_investment: "1000",
    expected_yield: "",
    duration_years: "",
    distribution_model: "quarterly",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // The draft submission id (lazily created on first save / document upload) +
  // uploaded documents keyed by document_type.
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, UploadedDoc>>({});
  const [confirms, setConfirms] = useState([false, false, false]);
  const [busy, setBusy] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const progress = (currentStep / steps.length) * 100;
  const isApprovedOwner = ownerProfile?.status === "approved";

  const nextStep = () => {
    if (currentStep < steps.length) setCurrentStep(currentStep + 1);
  };
  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // Build the API payload from the form (numbers where present; omit blanks).
  const payload = () => {
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    return {
      name: form.name,
      property_type: form.property_type,
      construction_status: form.construction_status,
      description: form.description,
      country: form.country,
      city: form.city,
      district: form.district,
      address: form.address,
      property_value_usd: num(form.property_value_usd),
      min_investment: num(form.min_investment),
      expected_yield: num(form.expected_yield),
      duration_years: form.duration_years.trim() === "" ? null : parseInt(form.duration_years, 10),
      distribution_model: form.distribution_model,
    };
  };

  // Lazily create the draft (or patch it) so documents can attach to a real row.
  const ensureDraft = async (): Promise<string | null> => {
    try {
      if (submissionId) {
        await ownerApi.updateSubmission(submissionId, payload());
        return submissionId;
      }
      const created = (await ownerApi.createSubmission(payload())) as { id: string };
      setSubmissionId(created.id);
      return created.id;
    } catch (err: any) {
      toast.error(err?.message || "Could not save the draft");
      return null;
    }
  };

  const saveDraft = async () => {
    setBusy(true);
    const id = await ensureDraft();
    setBusy(false);
    if (id) toast.success(isArabic ? "تم حفظ المسودة" : "Draft saved");
  };

  const onPickFile = (docId: string) => fileInputs.current[docId]?.click();

  const onFileChange = async (docId: string, docName: string, file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const id = await ensureDraft();
      if (!id) return;
      const doc = (await ownerApi.uploadSubmissionDocument(id, file, docId, docName)) as UploadedDoc;
      setUploadedDocs((prev) => ({ ...prev, [docId]: doc }));
      toast.success(isArabic ? "تم رفع المستند" : "Document uploaded");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const allConfirmed = confirms.every(Boolean);

  const submitForReview = async () => {
    if (!allConfirmed) {
      toast.error(isArabic ? "يرجى تأكيد جميع البنود" : "Please confirm all items");
      return;
    }
    setBusy(true);
    try {
      const id = await ensureDraft();
      if (!id) return;
      await ownerApi.submitSubmission(id);
      toast.success(isArabic ? "تم إرسال العقار للمراجعة" : "Property submitted for review");
      navigate("/my-assets");
    } catch (err: any) {
      // Backend blocks submit when required docs are missing.
      const data = (err?.data ?? {}) as { code?: string; missing?: string[] };
      if (data.code === "missing_required_documents") {
        const names = (data.missing || [])
          .map((t) => requiredDocuments.find((d) => d.id === t)?.name || t)
          .join(", ");
        toast.error(
          (isArabic ? "مستندات مطلوبة ناقصة: " : "Missing required documents: ") + names,
        );
      } else {
        toast.error(err?.message || "Failed to submit");
      }
    } finally {
      setBusy(false);
    }
  };

  // --- KYB gate: only APPROVED owners can submit (server-enforced; we pre-check to
  // avoid a raw 403 and route the owner to verification). -------------------- //
  if (ownerLoading) {
    return (
      <MainLayout>
        <div className="p-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {isArabic ? "جارٍ التحميل..." : "Loading..."}
        </div>
      </MainLayout>
    );
  }
  if (!isApprovedOwner) {
    return (
      <MainLayout>
        <div className="p-6">
          <Card className="bg-card/50 backdrop-blur border-border/50 max-w-2xl">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-display font-bold text-foreground">
                {isArabic ? "أكمل توثيق المالك أولاً" : "Complete owner verification first"}
              </h2>
              <p className="text-muted-foreground">
                {isArabic
                  ? "يجب اعتماد توثيق المالك (KYB) قبل تقديم عقار. أكمل التوثيق من لوحة تحكم المالك."
                  : "Your owner verification (KYB) must be approved before you can submit a property. Complete it from your owner dashboard."}
              </p>
              <Button onClick={() => navigate("/my-assets")}>
                {isArabic ? "الذهاب إلى التوثيق" : "Go to verification"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Submit New Property
            </h1>
            <p className="text-muted-foreground mt-1">Complete all steps to submit your property for listing</p>
          </div>
          <Button variant="outline" onClick={saveDraft} disabled={busy}>
            <Save className="w-4 h-4 mr-2" />
            Save as Draft
          </Button>
        </div>

        {/* Progress */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">
                Step {currentStep} of {steps.length}
              </span>
              <span className="text-sm font-medium text-primary">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2 mb-6" />

            <div className="flex justify-between">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex flex-col items-center gap-2 ${
                    step.id === currentStep
                      ? "text-primary"
                      : step.id < currentStep
                        ? "text-emerald-500"
                        : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      step.id === currentStep
                        ? "bg-primary text-primary-foreground"
                        : step.id < currentStep
                          ? "bg-emerald-500 text-white"
                          : "bg-muted"
                    }`}
                  >
                    {step.id < currentStep ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className="text-xs hidden sm:block">{step.title}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {(() => {
                const StepIcon = steps[currentStep - 1].icon;
                return <StepIcon className="w-5 h-5 text-primary" />;
              })()}
              {steps[currentStep - 1].title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Property Name</label>
                  <Input
                    placeholder="e.g. Marina Residential Tower"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Property Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {propertyTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => set("property_type", type.id)}
                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                          form.property_type === type.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <p className="font-medium text-foreground">{type.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Construction Status</label>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {constructionStatus.map((status) => (
                      <button
                        key={status.id}
                        onClick={() => set("construction_status", status.id)}
                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                          form.construction_status === status.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <p className="font-medium text-foreground">{status.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Property Description</label>
                  <Textarea
                    placeholder="Enter a detailed description of the property..."
                    rows={4}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Step 2: Location */}
            {currentStep === 2 && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Country</label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3"
                      value={form.country}
                      onChange={(e) => set("country", e.target.value)}
                    >
                      <option value="">Select Country...</option>
                      <option value="USA">United States</option>
                      <option value="UAE">United Arab Emirates</option>
                      <option value="UK">United Kingdom</option>
                      <option value="SA">Saudi Arabia</option>
                      <option value="EG">Egypt</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">City</label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3"
                      value={form.city}
                      onChange={(e) => set("city", e.target.value)}
                    >
                      <option value="">Select City...</option>
                      <option value="newyork">New York</option>
                      <option value="miami">Miami</option>
                      <option value="dubai">Dubai</option>
                      <option value="london">London</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">District / Neighborhood</label>
                  <Input
                    placeholder="e.g. Marina, Downtown, Financial District"
                    value={form.district}
                    onChange={(e) => set("district", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Full Address</label>
                  <Textarea
                    placeholder="Enter the complete property address..."
                    rows={2}
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </div>

                <div className="h-64 bg-muted/50 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Select location on map</p>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Financial Details */}
            {currentStep === 3 && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Property Value (USD)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.property_value_usd}
                      onChange={(e) => set("property_value_usd", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Minimum Investment</label>
                    <Input
                      type="number"
                      placeholder="1000"
                      value={form.min_investment}
                      onChange={(e) => set("min_investment", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Expected Yield (Annual %)
                    </label>
                    <Input
                      type="number"
                      placeholder="8.5"
                      value={form.expected_yield}
                      onChange={(e) => set("expected_yield", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Investment Duration (Years)</label>
                    <Input
                      type="number"
                      placeholder="5"
                      value={form.duration_years}
                      onChange={(e) => set("duration_years", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Distribution Model</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3"
                    value={form.distribution_model}
                    onChange={(e) => set("distribution_model", e.target.value)}
                  >
                    <option value="quarterly">Quarterly</option>
                    <option value="semi-annual">Semi-Annual</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>

                <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-foreground font-medium">Important Note</p>
                      <p className="text-sm text-muted-foreground">
                        Financial details will be reviewed by our valuation team before listing approval
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Step 4: Documents */}
            {currentStep === 4 && (
              <>
                <div className="space-y-4">
                  {requiredDocuments.map((doc) => {
                    const uploaded = uploadedDocs[doc.id];
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-foreground">{doc.name}</p>
                            {uploaded && (
                              <p className="text-xs text-emerald-500 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                {uploaded.document_name}
                              </p>
                            )}
                          </div>
                          {doc.required && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        <input
                          ref={(el) => (fileInputs.current[doc.id] = el)}
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          onChange={(e) => onFileChange(doc.id, doc.name, e.target.files?.[0])}
                        />
                        <Button
                          variant={uploaded ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => onPickFile(doc.id)}
                          disabled={busy}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {uploaded ? "Replace" : "Upload"}
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 bg-muted/30 rounded-lg border-2 border-dashed border-border text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-foreground">PDF, DOC, DOCX up to 25MB per file</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Title Deed, Valuation Report &amp; Legal Documents are required to submit
                  </p>
                </div>
              </>
            )}

            {/* Step 5: Media — visual capture (image/video/tour) is a later wave; the
                Wave-B submission model stores the fields + documents above only. */}
            {currentStep === 5 && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Property Images</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="aspect-square bg-muted/30 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                      >
                        <div className="text-center">
                          <Image className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
                          <span className="text-xs text-muted-foreground">Add Image</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    We recommend uploading at least 10 high-quality images (JPG, PNG)
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Property Video (Optional)</label>
                  <div className="p-6 bg-muted/30 rounded-lg border-2 border-dashed border-border text-center">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-foreground">Upload Video</p>
                    <p className="text-xs text-muted-foreground mt-1">MP4, MOV up to 100MB</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Virtual Tour (Optional)</label>
                  <Input placeholder="Enter virtual tour URL..." />
                </div>
              </>
            )}

            {/* Step 6: Review */}
            {currentStep === 6 && (
              <>
                <div className="p-6 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-4">
                    <Check className="w-6 h-6 text-emerald-500" />
                    <h3 className="font-semibold text-foreground">Ready to Submit</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Please review all information before submitting your listing request. Your application will be reviewed by our team within 3-5 business days.
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    "I confirm that all information provided is accurate and correct",
                    "I agree to the Listing Terms and Conditions",
                    "I understand that the platform will verify all documents and information",
                  ].map((label, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={confirms[i]}
                        onChange={(e) =>
                          setConfirms((c) => {
                            const next = [...c];
                            next[i] = e.target.checked;
                            return next;
                          })
                        }
                      />
                      <p className="text-sm text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={prevStep} disabled={currentStep === 1}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          {currentStep === steps.length ? (
            <Button
              className="bg-gradient-gold hover:opacity-90 shadow-gold"
              onClick={submitForReview}
              disabled={busy || !allConfirmed}
            >
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Submit for Review
              <Check className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={nextStep}>
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
