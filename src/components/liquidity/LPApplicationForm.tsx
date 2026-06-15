import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { Droplets, Building2, User, Mail, Phone, Globe, DollarSign, ArrowRight } from "lucide-react";

interface LPApplicationFormProps {
  onSubmit: (data: {
    company_name?: string;
    contact_name: string;
    email: string;
    phone?: string;
    country?: string;
    investment_amount: number;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function LPApplicationForm({ onSubmit }: LPApplicationFormProps) {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    country: "",
    investment_amount: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    await onSubmit({
      company_name: formData.company_name || undefined,
      contact_name: formData.contact_name,
      email: formData.email,
      phone: formData.phone || undefined,
      country: formData.country || undefined,
      investment_amount: parseFloat(formData.investment_amount) || 0,
    });

    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Introduction Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shrink-0">
              <Droplets className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">
                {isRTL ? "انضم كمزود سيولة" : "Become a Liquidity Provider"}
              </h2>
              <p className="text-muted-foreground">
                {isRTL
                  ? "مزودو السيولة يلعبون دورًا حيويًا في منظومتنا من خلال توفير رأس المال للاستثمارات العقارية. استمتع بعوائد جذابة ووصول حصري للفرص."
                  : "Liquidity Providers play a vital role in our ecosystem by supplying capital for real estate investments. Enjoy attractive returns and exclusive access to opportunities."}
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 pt-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                  {isRTL ? "عوائد تنافسية" : "Competitive returns"}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                  {isRTL ? "تقارير شفافة" : "Transparent reporting"}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                  {isRTL ? "سحوبات مرنة" : "Flexible withdrawals"}
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Application Form */}
      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? "نموذج التقديم" : "Application Form"}</CardTitle>
          <CardDescription>
            {isRTL
              ? "أكمل النموذج أدناه للتقدم كمزود سيولة"
              : "Complete the form below to apply as a Liquidity Provider"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  {isRTL ? "اسم الشركة (اختياري)" : "Company Name (Optional)"}
                </Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder={isRTL ? "اسم الشركة" : "Company Name"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_name" className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  {isRTL ? "اسم جهة الاتصال *" : "Contact Name *"}
                </Label>
                <Input
                  id="contact_name"
                  required
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder={isRTL ? "الاسم الكامل" : "Full Name"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {isRTL ? "البريد الإلكتروني *" : "Email Address *"}
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  {isRTL ? "رقم الهاتف" : "Phone Number"}
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+971 50 XXX XXXX"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country" className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  {isRTL ? "البلد" : "Country"}
                </Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder={isRTL ? "الإمارات العربية المتحدة" : "United Arab Emirates"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="investment_amount" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  {isRTL ? "مبلغ الاستثمار المقترح *" : "Proposed Investment Amount *"}
                </Label>
                <Input
                  id="investment_amount"
                  type="number"
                  required
                  min="10000"
                  step="1000"
                  value={formData.investment_amount}
                  onChange={(e) => setFormData({ ...formData, investment_amount: e.target.value })}
                  placeholder="100,000"
                />
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "الحد الأدنى: 10,000 دولار" : "Minimum: $10,000"}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button type="submit" disabled={loading} className="w-full gap-2">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    {isRTL ? "إرسال الطلب" : "Submit Application"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
