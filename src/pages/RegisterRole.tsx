import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Briefcase,
  HardHat,
  Building2,
  Users,
  Coins,
  Handshake,
  ArrowRight,
  ArrowLeft,
  Landmark,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

type RoleId =
  | "investor"
  | "developer"
  | "owner"
  | "broker"
  | "lp"
  | "partner";

interface RoleDef {
  id: RoleId;
  icon: React.ElementType;
  labelEn: string;
  labelAr: string;
  taglineEn: string;
  taglineAr: string;
  bulletsEn: string[];
  bulletsAr: string[];
  badgeEn: string;
  badgeAr: string;
  accent: string; // tailwind gradient classes
  iconColor: string;
  kyc: "KYC" | "KYB" | "KYC + Accreditation";
}

const ROLES: RoleDef[] = [
  {
    id: "investor",
    icon: Briefcase,
    labelEn: "Investor",
    labelAr: "مستثمر",
    taglineEn: "Own fractions of premium real estate",
    taglineAr: "امتلك حصصاً في عقارات مميزة",
    bulletsEn: [
      "From $100 per token",
      "Quarterly yield distributions",
      "Trade on the Secondary Market",
    ],
    bulletsAr: [
      "ابتداءً من 100$ للوحدة",
      "توزيعات أرباح ربع سنوية",
      "التداول في السوق الثانوية",
    ],
    badgeEn: "Most Popular",
    badgeAr: "الأكثر شيوعاً",
    accent: "from-blue-500/20 via-blue-500/5 to-transparent",
    iconColor: "text-blue-500",
    kyc: "KYC",
  },
  {
    id: "developer",
    icon: HardHat,
    labelEn: "Developer",
    labelAr: "مطور عقاري",
    taglineEn: "Tokenize and finance your projects",
    taglineAr: "رقمنة وتمويل مشاريعك",
    bulletsEn: [
      "Submit under-construction assets",
      "Phased / installment funding",
      "Direct access to global capital",
    ],
    bulletsAr: [
      "تقديم مشاريع قيد الإنشاء",
      "تمويل بالمراحل أو بالتقسيط",
      "وصول مباشر لرأس مال عالمي",
    ],
    badgeEn: "KYB Required",
    badgeAr: "يتطلب توثيق شركة",
    accent: "from-orange-500/20 via-orange-500/5 to-transparent",
    iconColor: "text-orange-500",
    kyc: "KYB",
  },
  {
    id: "owner",
    icon: Building2,
    labelEn: "Property Owner",
    labelAr: "مالك عقار",
    taglineEn: "Unlock liquidity from existing assets",
    taglineAr: "حرّر السيولة من أصولك القائمة",
    bulletsEn: [
      "List ready, yield-bearing properties",
      "Keep operating, raise instantly",
      "Transparent ownership ledger",
    ],
    bulletsAr: [
      "إدراج عقارات جاهزة مدرّة للعائد",
      "استمر بالتشغيل واجمع التمويل فوراً",
      "سجل ملكية شفاف",
    ],
    badgeEn: "KYB + Title Docs",
    badgeAr: "توثيق شركة + سندات",
    accent: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    iconColor: "text-emerald-500",
    kyc: "KYB",
  },
  {
    id: "broker",
    icon: Users,
    labelEn: "Broker",
    labelAr: "وسيط",
    taglineEn: "Earn commissions on referrals & listings",
    taglineAr: "اكسب عمولات من الإحالات والإدراج",
    bulletsEn: [
      "Refer investors & owners",
      "Tiered commission structure",
      "Real-time dashboard & payouts",
    ],
    bulletsAr: [
      "إحالة المستثمرين والمُلّاك",
      "هيكل عمولات متدرّج",
      "لوحة تحكم ودفعات فورية",
    ],
    badgeEn: "License Verified",
    badgeAr: "ترخيص موثّق",
    accent: "from-amber-500/20 via-amber-500/5 to-transparent",
    iconColor: "text-amber-500",
    kyc: "KYC",
  },
  {
    id: "lp",
    icon: Coins,
    labelEn: "Liquidity Provider",
    labelAr: "مزود السيولة",
    taglineEn: "Provide capital, earn from market flow",
    taglineAr: "وفّر رأس المال واكسب من حركة السوق",
    bulletsEn: [
      "Buy from the LP Market (1% fee)",
      "Institutional onboarding (KYB)",
      "Bank, IBAN, or crypto settlement",
    ],
    bulletsAr: [
      "الشراء من سوق LP (رسوم 1%)",
      "تأهيل مؤسسي (KYB)",
      "تسوية بنكية أو IBAN أو عملات رقمية",
    ],
    badgeEn: "Institutional",
    badgeAr: "مؤسسي",
    accent: "from-cyan-500/20 via-cyan-500/5 to-transparent",
    iconColor: "text-cyan-500",
    kyc: "KYC + Accreditation",
  },
  {
    id: "partner",
    icon: Handshake,
    labelEn: "Partner",
    labelAr: "شريك",
    taglineEn: "Integrate, distribute, or co-build",
    taglineAr: "تكامل، توزيع، أو شراكة بناء",
    bulletsEn: [
      "Strategic & technology partners",
      "API & white-label access",
      "Co-marketing programs",
    ],
    bulletsAr: [
      "شركاء استراتيجيون وتقنيون",
      "وصول API وحلول العلامة البيضاء",
      "برامج تسويق مشترك",
    ],
    badgeEn: "By Application",
    badgeAr: "بطلب رسمي",
    accent: "from-purple-500/20 via-purple-500/5 to-transparent",
    iconColor: "text-purple-500",
    kyc: "KYB",
  },
];

export default function RegisterRole() {
  const navigate = useNavigate();
  const { language, isRTL } = useLanguage();
  const [selected, setSelected] = useState<RoleId | null>(null);
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const handleContinue = () => {
    if (!selected) return;
    navigate(`/auth?mode=register&role=${selected}`);
  };

  return (
    <div
      className="min-h-screen bg-background relative overflow-hidden"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Ambient backdrop */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80rem] h-[40rem] bg-gradient-to-b from-primary/10 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[40rem] h-[40rem] bg-gradient-to-tl from-primary/10 to-transparent blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/60 sticky top-0 z-20">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
              <Landmark className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-bold text-foreground">
                Capimax BRX
              </div>
              <div className="text-[11px] text-muted-foreground">
                {language === "ar"
                  ? "ترميز عقاري على البلوكتشين"
                  : "Real Estate Tokenization"}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground hidden sm:inline">
              {language === "ar"
                ? "لديك حساب بالفعل؟"
                : "Already have an account?"}
            </span>
            <Link
              to="/auth?mode=login"
              className="text-primary font-medium hover:underline"
            >
              {language === "ar" ? "تسجيل الدخول" : "Sign In"}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 pt-12 pb-8 text-center max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-xs font-medium text-primary mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          {language === "ar"
            ? "الخطوة 1 من 3 — اختيار الدور"
            : "Step 1 of 3 — Choose your role"}
        </div>
        <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground tracking-tight">
          {language === "ar" ? (
            <>
              كيف تريد الانضمام إلى{" "}
              <span className="text-gradient-gold">كابيماكس</span>؟
            </>
          ) : (
            <>
              How will you join{" "}
              <span className="text-gradient-gold">Capimax</span>?
            </>
          )}
        </h1>
        <p className="mt-4 text-base md:text-lg text-muted-foreground">
          {language === "ar"
            ? "كابيماكس منظومة متعددة الأدوار. اختر دورك لتخصيص عملية التسجيل، التحقق (KYC/KYB)، ولوحة التحكم."
            : "Capimax is a multi-role ecosystem. Pick your role to tailor your registration, verification (KYC/KYB), and dashboard."}
        </p>
      </section>

      {/* Stepper */}
      <div className="container mx-auto px-6 mb-8 max-w-3xl">
        <div className="flex items-center gap-3">
          {[
            { en: "Choose role", ar: "اختر الدور" },
            { en: "Create account", ar: "أنشئ الحساب" },
            { en: "Verify (KYC / KYB)", ar: "التحقق (KYC / KYB)" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 flex-1 last:flex-initial">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border",
                  i === 0
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border"
                )}
              >
                {i + 1}
              </div>
              <span
                className={cn(
                  "text-xs sm:text-sm font-medium",
                  i === 0 ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {language === "ar" ? s.ar : s.en}
              </span>
              {i < 2 && (
                <div className="flex-1 h-px bg-border hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Role grid */}
      <section className="container mx-auto px-6 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ROLES.map((role) => {
            const isSelected = selected === role.id;
            const Icon = role.icon;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelected(role.id)}
                className={cn(
                  "group relative text-start rounded-2xl border bg-card/60 backdrop-blur-sm p-6 transition-all duration-300 overflow-hidden",
                  "hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10",
                  isSelected
                    ? "border-primary ring-2 ring-primary/40 shadow-2xl shadow-primary/20"
                    : "border-border hover:border-primary/40"
                )}
              >
                {/* Accent gradient */}
                <div
                  className={cn(
                    "absolute inset-0 -z-10 bg-gradient-to-br opacity-60 group-hover:opacity-100 transition-opacity",
                    role.accent
                  )}
                />

                {/* Top row: icon + badge */}
                <div className="flex items-start justify-between mb-5">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center bg-background/70 border border-border/60",
                      role.iconColor
                    )}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-background/80 border border-border/60 text-muted-foreground">
                    {language === "ar" ? role.badgeAr : role.badgeEn}
                  </span>
                </div>

                {/* Title + tagline */}
                <h3 className="font-display text-xl font-bold text-foreground">
                  {language === "ar" ? role.labelAr : role.labelEn}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 mb-5">
                  {language === "ar" ? role.taglineAr : role.taglineEn}
                </p>

                {/* Bullets */}
                <ul className="space-y-2 mb-5">
                  {(language === "ar" ? role.bulletsAr : role.bulletsEn).map(
                    (b, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-foreground/80"
                      >
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    )
                  )}
                </ul>

                {/* Footer: KYC tag + select */}
                <div className="flex items-center justify-between pt-4 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{role.kyc}</span>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold transition-colors",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {isSelected
                      ? language === "ar"
                        ? "محدّد ✓"
                        : "Selected ✓"
                      : language === "ar"
                        ? "اختر"
                        : "Select"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Continue CTA */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-3xl mx-auto">
          <p className="text-xs text-muted-foreground text-center sm:text-start max-w-md">
            {language === "ar"
              ? "يمكنك تغيير الدور لاحقاً عبر فريق الدعم. تطبق متطلبات التحقق وفقاً للوائح Reg D / Reg S."
              : "You can change role later via support. Verification requirements apply per Reg D / Reg S compliance."}
          </p>
          <Button
            size="lg"
            onClick={handleContinue}
            disabled={!selected}
            className="min-w-[220px] gap-2"
          >
            {language === "ar" ? "متابعة إلى التسجيل" : "Continue to Sign Up"}
            <ArrowIcon className="w-4 h-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
