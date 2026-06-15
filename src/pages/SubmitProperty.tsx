import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

export default function SubmitProperty() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedType, setSelectedType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const progress = (currentStep / steps.length) * 100;

  const nextStep = () => {
    if (currentStep < steps.length) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

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
          <Button variant="outline">
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
                  <Input placeholder="e.g. Marina Residential Tower" />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Property Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {propertyTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setSelectedType(type.id)}
                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                          selectedType === type.id
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
                        onClick={() => setSelectedStatus(status.id)}
                        className={`p-4 rounded-lg border-2 text-center transition-all ${
                          selectedStatus === status.id
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
                  <Textarea placeholder="Enter a detailed description of the property..." rows={4} />
                </div>
              </>
            )}

            {/* Step 2: Location */}
            {currentStep === 2 && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Country</label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3">
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
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3">
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
                  <Input placeholder="e.g. Marina, Downtown, Financial District" />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Full Address</label>
                  <Textarea placeholder="Enter the complete property address..." rows={2} />
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
                    <Input type="number" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Minimum Investment</label>
                    <Input type="number" placeholder="1000" defaultValue="1000" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Expected Yield (Annual %)
                    </label>
                    <Input type="number" placeholder="8.5" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Investment Duration (Years)</label>
                    <Input type="number" placeholder="5" />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Distribution Model</label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3">
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
                  {requiredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">{doc.name}</p>
                        </div>
                        {doc.required && (
                          <Badge variant="destructive" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                      <Button variant="outline" size="sm">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-muted/30 rounded-lg border-2 border-dashed border-border text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-foreground">Drag files here or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOC, DOCX up to 25MB per file
                  </p>
                </div>
              </>
            )}

            {/* Step 5: Media */}
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
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1" />
                    <p className="text-sm text-muted-foreground">
                      I confirm that all information provided is accurate and correct
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1" />
                    <p className="text-sm text-muted-foreground">
                      I agree to the{" "}
                      <a href="#" className="text-primary underline">
                        Listing Terms and Conditions
                      </a>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1" />
                    <p className="text-sm text-muted-foreground">
                      I understand that the platform will verify all documents and information
                    </p>
                  </div>
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
            <Button className="bg-gradient-gold hover:opacity-90 shadow-gold">
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
