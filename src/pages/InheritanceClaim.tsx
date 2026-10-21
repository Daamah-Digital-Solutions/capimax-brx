import { useState } from "react";
import { Link } from "react-router-dom";
import { FileCheck, FileText, ShieldCheck, UserCheck } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { EstateClaimDialog } from "@/components/transfers/EstateClaimDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

/** Public page for a named beneficiary: how an inheritance claim works, and the claim form. */
export default function InheritanceClaim() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const steps = [
    {
      icon: FileText,
      ar: "يحتفظ صاحب الحساب بشهادة المستفيدين التي تحمل رقمًا خاصًا وتحدد نصيب كل مستفيد.",
      en: "The account holder keeps a beneficiary certificate with its own number and each beneficiary's share.",
    },
    {
      icon: UserCheck,
      ar: "يسجّل المستفيد الدخول بالبريد المسجّل في الشهادة، ويوثّق بريده وهويته.",
      en: "The beneficiary signs in with the email named on the certificate and verifies their email and identity.",
    },
    {
      icon: FileCheck,
      ar: "يرسل المستفيد رقم الشهادة مع شهادة الوفاة الرسمية.",
      en: "The beneficiary submits the certificate number with the official death certificate.",
    },
    {
      icon: ShieldCheck,
      ar: "بعد المراجعة تُوزَّع وحدات العقارات ورصيد المحفظة على المستفيدين بالنسب المحددة.",
      en: "After review, the property units and wallet balance are divided among the beneficiaries in the stated shares.",
    },
  ];

  return (
    <MainLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {isAr ? "طلب الميراث (شهادة المستفيدين)" : "Inheritance claim (beneficiary certificate)"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAr
              ? "إذا كنت مستفيدًا مسجّلًا في شهادة مستفيدين لدى Capimax BRX، يمكنك تقديم طلب الميراث من هنا."
              : "If you are named on a Capimax BRX beneficiary certificate, you can submit the inheritance claim here."}
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {steps.map((s, i) => (
            <div key={i} className="p-5 flex items-start gap-4">
              <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                <s.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isAr ? `الخطوة ${i + 1}` : `Step ${i + 1}`}</p>
                <p className="text-foreground">{isAr ? s.ar : s.en}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {user ? (
            <Button className="bg-gradient-gold hover:opacity-90" onClick={() => setOpen(true)}>
              <FileText className="w-4 h-4 me-2" />
              {isAr ? "تقديم طلب الميراث" : "Submit an inheritance claim"}
            </Button>
          ) : (
            <>
              <Link to="/auth?next=/inheritance-claim">
                <Button className="bg-gradient-gold hover:opacity-90 w-full">
                  {isAr ? "سجّل الدخول لتقديم الطلب" : "Sign in to submit a claim"}
                </Button>
              </Link>
              <Link to="/auth?mode=register&next=/inheritance-claim">
                <Button variant="outline" className="w-full">
                  {isAr ? "إنشاء حساب" : "Create an account"}
                </Button>
              </Link>
            </>
          )}
          <Link to="/verification-center">
            <Button variant="ghost" className="w-full">
              {isAr ? "التحقق من شهادة ملكية" : "Verify an ownership certificate"}
            </Button>
          </Link>
        </div>
      </div>
      <EstateClaimDialog open={open} onOpenChange={setOpen} />
    </MainLayout>
  );
}
