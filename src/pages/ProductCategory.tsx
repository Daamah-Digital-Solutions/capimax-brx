import { useParams, Link, Navigate } from "react-router-dom";
import { PropertyModelTemplate } from "@/components/property/templates/PropertyModelTemplate";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Building2,
  Calendar,
  Layers,
  Clock,
  KeyRound,
  Users2,
  Briefcase,
  HardHat,
  ArrowRight,
  CheckCircle2,
  Info,
} from "lucide-react";

type CategoryConfig = {
  slug: string;
  icon: React.ElementType;
  parent: "ready" | "under-construction" | "ready-portfolio" | "uc-portfolio";
  titleEn: string;
  titleAr: string;
  taglineEn: string;
  taglineAr: string;
  bulletsEn: string[];
  bulletsAr: string[];
  workflowEn: string[];
  workflowAr: string[];
};

const CATEGORIES: Record<string, CategoryConfig> = {
  "ready-yield": {
    slug: "ready-yield",
    icon: Building2,
    parent: "ready",
    titleEn: "Ready Properties with Yield",
    titleAr: "عقارات جاهزة مدرّة للعائد",
    taglineEn: "Own a fraction of fully operational properties already generating rental income.",
    taglineAr: "تملّك حصة في عقارات تشغيلية جاهزة تدرّ دخلاً تأجيرياً منذ اليوم الأول.",
    bulletsEn: [
      "Income-producing from day one",
      "Monthly or quarterly distributions",
      "Established tenants and operating history",
      "Liquidity via Secondary Market and LP exit",
    ],
    bulletsAr: [
      "دخل تشغيلي من اليوم الأول",
      "توزيعات شهرية أو ربع سنوية",
      "مستأجرون فعليون وسجل تشغيلي",
      "خروج عبر السوق الثانوي ومزود السيولة",
    ],
    workflowEn: [
      "Browse the property and review the SPV documents",
      "Buy ownership shares (tokens) at $100 per unit",
      "Receive periodic rental distributions to your wallet",
      "Exit anytime via Secondary Market or LP instant exit",
    ],
    workflowAr: [
      "تصفّح العقار وراجع مستندات الـ SPV",
      "اشترِ حصص ملكية (توكنات) بسعر 100$ للوحدة",
      "استلم توزيعات الإيجار دورياً في محفظتك",
      "اخرج في أي وقت عبر السوق الثانوي أو مزود السيولة",
    ],
  },
  "installment": {
    slug: "installment",
    icon: Calendar,
    parent: "under-construction",
    titleEn: "Installment Property Model",
    titleAr: "نموذج العقار بالتقسيط",
    taglineEn: "Gradually acquire ownership through scheduled installments — your share grows with every payment.",
    taglineAr: "تملّك تدريجي عبر أقساط مجدولة — تزداد حصتك مع كل دفعة.",
    bulletsEn: [
      "Ownership percentage scales with completed payments",
      "Returns may begin after operational activation",
      "Transparent installment schedule and milestones",
      "Construction progress visible at every stage",
    ],
    bulletsAr: [
      "نسبة الملكية تتناسب مع الدفعات المكتملة",
      "تبدأ العوائد بعد التفعيل التشغيلي",
      "جدول أقساط ومحطات شفافة",
      "تقدّم البناء معروض في كل مرحلة",
    ],
    workflowEn: [
      "Reserve your share with a first installment",
      "Pay subsequent installments per the schedule",
      "Track ownership % and construction progress",
      "Receive returns once the property is activated",
    ],
    workflowAr: [
      "احجز حصتك بدفعة أولى",
      "ادفع الأقساط التالية وفق الجدول",
      "تابع نسبة الملكية وتقدّم البناء",
      "استلم العوائد عند تفعيل العقار",
    ],
  },
  "phasing": {
    slug: "phasing",
    icon: Layers,
    parent: "under-construction",
    titleEn: "Property Phasing Model",
    titleAr: "نموذج العقار بالمراحل",
    taglineEn: "Token pricing rises with each construction and valuation phase — early ownership, future appreciation.",
    taglineAr: "سعر التوكن يرتفع مع كل مرحلة بناء وتقييم — تملّك مبكر، نمو مستقبلي.",
    bulletsEn: [
      "Each phase has its own token valuation",
      "Prices increase with verified milestones",
      "Backed by independent valuation reports",
      "Clear visibility into next phase pricing",
    ],
    bulletsAr: [
      "لكل مرحلة تقييم مستقل للتوكن",
      "ترتفع الأسعار مع المحطات الموثقة",
      "مدعوم بتقارير تقييم مستقلة",
      "رؤية واضحة لسعر المرحلة التالية",
    ],
    workflowEn: [
      "Buy tokens at the current phase price",
      "Track milestones and valuation reports",
      "Token price re-evaluates at each new phase",
      "Sell on Secondary Market or hold to completion",
    ],
    workflowAr: [
      "اشترِ التوكنات بسعر المرحلة الحالية",
      "تابع المحطات وتقارير التقييم",
      "إعادة تسعير التوكن في كل مرحلة جديدة",
      "بِع في السوق الثانوي أو احتفظ حتى الإنجاز",
    ],
  },
  "future": {
    slug: "future",
    icon: Clock,
    parent: "under-construction",
    titleEn: "Property Future Model",
    titleAr: "نموذج العقار الآجل",
    taglineEn: "Reserve future ownership today at predefined pricing, activated at a future settlement date.",
    taglineAr: "احجز ملكية مستقبلية اليوم بأسعار محددة مسبقاً، تُفعّل في تاريخ تسوية لاحق.",
    bulletsEn: [
      "Lock-in future ownership exposure",
      "Predefined pricing structure",
      "Activation on the agreed execution date",
      "Future ROI estimates published upfront",
    ],
    bulletsAr: [
      "تثبيت ملكية مستقبلية",
      "هيكل تسعير محدد مسبقاً",
      "تفعيل في تاريخ التنفيذ المتفق عليه",
      "تقديرات عائد مستقبلي معلنة مسبقاً",
    ],
    workflowEn: [
      "Reserve a future allocation at today's terms",
      "Wait through the activation timeline",
      "Ownership settles on the execution date",
      "Receive returns from that point forward",
    ],
    workflowAr: [
      "احجز حصة مستقبلية بشروط اليوم",
      "انتظر خلال فترة التفعيل",
      "تتم تسوية الملكية في تاريخ التنفيذ",
      "ابدأ باستلام العوائد من تلك اللحظة",
    ],
  },
  "option": {
    slug: "option",
    icon: KeyRound,
    parent: "under-construction",
    titleEn: "Property Option Model",
    titleAr: "نموذج خيار العقار",
    taglineEn: "Buy the right — not the obligation — to acquire shares later at a locked-in price.",
    taglineAr: "اشترِ الحق — وليس الالتزام — للاستحواذ على حصص لاحقاً بسعر مثبّت.",
    bulletsEn: [
      "Lock pricing without full commitment",
      "Defined option validity and expiry",
      "Exercise when conditions are favorable",
      "Limit downside while keeping upside",
    ],
    bulletsAr: [
      "تثبيت السعر دون التزام كامل",
      "صلاحية وانتهاء محددان للخيار",
      "نفّذ الخيار عندما تناسبك الظروف",
      "تحديد الخسائر مع الإبقاء على المكاسب",
    ],
    workflowEn: [
      "Purchase the option at a small premium",
      "Monitor valuation and milestones",
      "Exercise the option before expiry to acquire shares",
      "Or let the option expire — premium only is at risk",
    ],
    workflowAr: [
      "اشترِ الخيار بعلاوة بسيطة",
      "راقب التقييم والمحطات",
      "نفّذ الخيار قبل انتهائه للحصول على الحصص",
      "أو دع الخيار ينتهي — العلاوة فقط هي المخاطرة",
    ],
  },
  "shared": {
    slug: "shared",
    icon: Users2,
    parent: "under-construction",
    titleEn: "Shared Property with Owner",
    titleAr: "ملكية مشتركة مع المالك",
    taglineEn: "Co-own directly with the original owner or developer with transparent rights and revenue sharing.",
    taglineAr: "تملّك مشترك مباشر مع المالك أو المطور بحقوق وتوزيعات شفافة.",
    bulletsEn: [
      "Direct co-ownership with the asset owner",
      "Transparent profit and revenue distribution",
      "Defined exit and transfer mechanism",
      "Aligned interests with the operator",
    ],
    bulletsAr: [
      "ملكية مشتركة مباشرة مع المالك",
      "توزيعات أرباح وإيرادات شفافة",
      "آلية خروج ونقل ملكية محددة",
      "توافق مصالح مع المشغّل",
    ],
    workflowEn: [
      "Subscribe to the co-ownership offering",
      "Hold your share alongside the original owner",
      "Receive your share of revenue and profits",
      "Transfer or exit per the SPV terms",
    ],
    workflowAr: [
      "اشترك في عرض الملكية المشتركة",
      "احتفظ بحصتك إلى جانب المالك الأصلي",
      "استلم حصتك من الإيرادات والأرباح",
      "انقل أو اخرج وفق شروط الـ SPV",
    ],
  },
  "portfolios-ready": {
    slug: "portfolios-ready",
    icon: Briefcase,
    parent: "ready-portfolio",
    titleEn: "Ready Property Portfolios",
    titleAr: "محافظ عقارات جاهزة",
    taglineEn: "Diversified baskets of operational properties — one ticket, multiple income streams.",
    taglineAr: "سلال متنوعة من عقارات تشغيلية — اكتتاب واحد، مصادر دخل متعددة.",
    bulletsEn: [
      "Built-in diversification across assets",
      "Combined yield from multiple properties",
      "Professional curation and management",
      "Easier exit through portfolio liquidity",
    ],
    bulletsAr: [
      "تنويع جاهز عبر أصول متعددة",
      "عائد مجمّع من عدة عقارات",
      "اختيار وإدارة احترافية",
      "خروج أسهل عبر سيولة المحفظة",
    ],
    workflowEn: [
      "Choose a portfolio that matches your risk profile",
      "Buy portfolio tokens at $100 per unit",
      "Receive blended distributions from all assets",
      "Exit via Secondary Market or LP",
    ],
    workflowAr: [
      "اختر المحفظة المناسبة لملفك المخاطري",
      "اشترِ توكنات المحفظة بسعر 100$ للوحدة",
      "استلم توزيعات مدمجة من جميع الأصول",
      "اخرج عبر السوق الثانوي أو مزود السيولة",
    ],
  },
  "portfolios-under-construction": {
    slug: "portfolios-under-construction",
    icon: HardHat,
    parent: "uc-portfolio",
    titleEn: "Under Construction Property Portfolios",
    titleAr: "محافظ عقارات قيد الإنشاء",
    taglineEn: "Diversified development portfolios with potential for capital appreciation as projects mature.",
    taglineAr: "محافظ تطوير متنوعة بإمكانات نمو رأسمالي مع نضوج المشاريع.",
    bulletsEn: [
      "Spread development risk across multiple projects",
      "Phased pricing and milestone-based valuation",
      "Strong upside as projects deliver",
      "Aggregated reporting and progress tracking",
    ],
    bulletsAr: [
      "توزيع مخاطر التطوير عبر مشاريع متعددة",
      "تسعير مرحلي وتقييم وفق المحطات",
      "إمكانات نمو قوية عند التسليم",
      "تقارير ومتابعة مجمّعة",
    ],
    workflowEn: [
      "Subscribe to the development portfolio",
      "Track combined construction progress",
      "Token value rebases as phases complete",
      "Exit at completion or via Secondary Market",
    ],
    workflowAr: [
      "اشترك في محفظة التطوير",
      "تابع تقدّم البناء المجمّع",
      "تُعاد قيمة التوكن مع إنجاز المراحل",
      "اخرج عند الإنجاز أو عبر السوق الثانوي",
    ],
  },
};

export default function ProductCategory() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const cfg = slug ? CATEGORIES[slug] : undefined;

  if (!cfg) return <Navigate to="/marketplace" replace />;

  const Icon = cfg.icon;
  const bullets = isAr ? cfg.bulletsAr : cfg.bulletsEn;
  const workflow = isAr ? cfg.workflowAr : cfg.workflowEn;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
            <Icon className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <Badge variant="outline" className="mb-2">
              {isAr ? "نموذج تملّك" : "Ownership Model"}
            </Badge>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
              {isAr ? cfg.titleAr : cfg.titleEn}
            </h1>
            <p className="text-muted-foreground mt-2 text-base sm:text-lg">
              {isAr ? cfg.taglineAr : cfg.taglineEn}
            </p>
          </div>
        </div>

        {/* Highlights + Workflow */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                {isAr ? "أبرز المزايا" : "Key Highlights"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" />
                {isAr ? "كيف يعمل" : "How It Works"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {workflow.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Sample property using the model-specific template */}
        <div className="mb-4">
          <h2 className="font-display text-xl font-bold text-foreground mb-1">
            {isAr ? "عيّنة فرصة بهذا النموذج" : "Sample Opportunity (This Model)"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "بيانات توضيحية تعرض شكل الفرصة الفعلي بهذا النموذج."
              : "Illustrative data showing how a live opportunity in this model is presented."}
          </p>
        </div>
        <PropertyModelTemplate model={cfg.slug as any} />

        <Card className="border-dashed mt-6">
          <CardContent className="py-6 text-center">
            <Button asChild variant="outline">
              <Link to="/marketplace" className="inline-flex items-center gap-2">
                {isAr ? "تصفّح كل الفرص" : "Browse All Opportunities"}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
