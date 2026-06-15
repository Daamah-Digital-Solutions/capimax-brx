import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Coins,
  TrendingUp,
  Layers,
  Clock,
  Sparkles,
  Users2,
  PieChart,
  HardHat,
  CheckCircle2,
  ArrowRight,
  FileText,
  ShieldCheck,
  GraduationCap,
  Workflow,
  LineChart,
  LogOut,
  Wallet,
} from "lucide-react";
import type { Property } from "@/data/properties";
import { propertyModelMeta } from "@/data/properties";

interface Section {
  icon: React.ElementType;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
}

// Educational copy per model — kept here so wording stays consistent
const educationalCopy: Record<
  Property["model"],
  { education: Section; workflow: Section; timeline: Section; returns: Section; ownership: Section; exit: Section }
> = {
  ready: {
    education: {
      icon: GraduationCap,
      title: "About this model",
      titleAr: "عن هذا النموذج",
      body: "A fully operational, income-producing property. Investors purchase tokenised ownership and immediately participate in stabilised rental cash flow.",
      bodyAr: "عقار تشغيلي بالكامل مدر للدخل. يشتري المستثمرون ملكية مرمزة ويشاركون فوراً في التدفقات النقدية الإيجارية المستقرة.",
    },
    workflow: { icon: Workflow, title: "How it works", titleAr: "آلية العمل", body: "Buy tokens → Receive periodic rental distributions → Hold or exit via LP / Secondary Market.", bodyAr: "اشترِ الرموز ← استلم توزيعات إيجارية دورية ← احتفظ أو اخرج عبر سوق LP أو السوق الثانوي." },
    timeline: { icon: Clock, title: "Timeline", titleAr: "الجدول الزمني", body: "Income begins from the first distribution period after purchase. Hold horizon defined by the offering.", bodyAr: "يبدأ الدخل من أول فترة توزيع بعد الشراء. أفق الاحتفاظ محدد في العرض." },
    returns: { icon: LineChart, title: "Returns", titleAr: "العوائد", body: "Annualised rental yield distributed pro-rata to ownership.", bodyAr: "عائد إيجاري سنوي يوزَّع بالتناسب مع نسبة الملكية." },
    ownership: { icon: PieChart, title: "Ownership", titleAr: "الملكية", body: "Direct fractional ownership via SPV. Each token represents the same beneficial interest.", bodyAr: "ملكية جزئية مباشرة عبر شركة ذات غرض خاص. كل رمز يمثل نفس الحق الانتفاعي." },
    exit: { icon: LogOut, title: "Exit", titleAr: "التخارج", body: "Available via Liquidity Provider (1% fee) or Secondary Market (0.5% fee).", bodyAr: "متاح عبر مزود السيولة (رسوم 1%) أو السوق الثانوي (رسوم 0.5%)." },
  },
  ready_portfolio: {
    education: { icon: GraduationCap, title: "About this model", titleAr: "عن هذا النموذج", body: "A diversified bundle of operational income-producing assets. Buy one token, gain exposure to many properties.", bodyAr: "حزمة متنوعة من الأصول التشغيلية المدرّة للدخل. اشترِ رمزاً واحداً واحصل على انكشاف لعدة عقارات." },
    workflow: { icon: Workflow, title: "How it works", titleAr: "آلية العمل", body: "Single token → Pro-rata exposure to all underlying assets → Blended income distributed periodically.", bodyAr: "رمز واحد ← انكشاف نسبي لجميع الأصول الأساسية ← دخل مدمج يوزَّع دورياً." },
    timeline: { icon: Clock, title: "Timeline", titleAr: "الجدول الزمني", body: "Distributions begin from the first cycle after purchase.", bodyAr: "تبدأ التوزيعات من أول دورة بعد الشراء." },
    returns: { icon: LineChart, title: "Returns", titleAr: "العوائد", body: "Blended yield across all assets, weighted by allocation.", bodyAr: "عائد مدمج عبر جميع الأصول وموزون حسب التخصيص." },
    ownership: { icon: PieChart, title: "Ownership", titleAr: "الملكية", body: "Each token represents a proportional share of the master SPV which holds all underlying assets.", bodyAr: "كل رمز يمثل حصة نسبية من الشركة الأم ذات الغرض الخاص التي تملك جميع الأصول الأساسية." },
    exit: { icon: LogOut, title: "Exit", titleAr: "التخارج", body: "LP or Secondary Market exit available at portfolio level.", bodyAr: "تخارج عبر سوق LP أو السوق الثانوي على مستوى المحفظة." },
  },
  installment: {
    education: { icon: GraduationCap, title: "About this model", titleAr: "عن هذا النموذج", body: "Investors gradually purchase tokenised ownership through scheduled installments. Ownership percentage grows with every paid milestone.", bodyAr: "يشتري المستثمرون الملكية المرمزة تدريجياً عبر أقساط مجدولة. تزداد نسبة الملكية مع كل دفعة مكتملة." },
    workflow: { icon: Workflow, title: "How it works", titleAr: "آلية العمل", body: "Sign up → Pay monthly installment → Tokens are released proportionally → Returns activate after operational handover.", bodyAr: "اشترك ← ادفع القسط الشهري ← تُحرَّر الرموز تناسبياً ← تنشط العوائد بعد التسليم التشغيلي." },
    timeline: { icon: Clock, title: "Timeline", titleAr: "الجدول الزمني", body: "Installment plan runs through construction. Returns begin after operational activation.", bodyAr: "تمتد خطة الأقساط طوال فترة الإنشاء. تبدأ العوائد بعد التفعيل التشغيلي." },
    returns: { icon: LineChart, title: "Returns", titleAr: "العوائد", body: "Combined model: capital appreciation through construction plus rental yield post-activation.", bodyAr: "نموذج مدمج: نمو رأسمالي خلال البناء بالإضافة إلى عائد إيجاري بعد التفعيل." },
    ownership: { icon: PieChart, title: "Ownership", titleAr: "الملكية", body: "Ownership accrues proportionally to paid installments. Full ownership at final installment.", bodyAr: "تتراكم الملكية تناسبياً مع الأقساط المدفوعة. الملكية الكاملة عند آخر قسط." },
    exit: { icon: LogOut, title: "Exit", titleAr: "التخارج", body: "Limited until activation. After activation, LP and Secondary Market exits become available.", bodyAr: "محدود حتى التفعيل. بعد التفعيل تتاح خيارات التخارج عبر LP والسوق الثانوي." },
  },
  phasing: {
    education: { icon: GraduationCap, title: "About this model", titleAr: "عن هذا النموذج", body: "Token pricing changes by construction phase. Each new phase carries a higher token valuation justified by progress, milestones, valuation reports, and market appreciation.", bodyAr: "يتغير سعر الرمز بحسب مرحلة الإنشاء. كل مرحلة جديدة تحمل تقييماً أعلى للرمز مدعوماً بالتقدم والمعالم وتقارير التقييم وارتفاع السوق." },
    workflow: { icon: Workflow, title: "How it works", titleAr: "آلية العمل", body: "Enter at the current phase price → Hold while project progresses → Future phases launch at higher prices, raising the value of your earlier tokens.", bodyAr: "ادخل بسعر المرحلة الحالية ← احتفظ مع تقدم المشروع ← تنطلق المراحل المستقبلية بأسعار أعلى ترفع قيمة الرموز السابقة." },
    timeline: { icon: Clock, title: "Timeline", titleAr: "الجدول الزمني", body: "Each phase has a defined start and end. Phase transitions are validated by independent valuation.", bodyAr: "لكل مرحلة بداية ونهاية محددتان. يتم التحقق من انتقالات المراحل بتقييم مستقل." },
    returns: { icon: LineChart, title: "Returns", titleAr: "العوائد", body: "Capital appreciation driven by phase re-pricing. Optional rental yield once operational.", bodyAr: "نمو رأسمالي مدفوع بإعادة تسعير المراحل. عائد إيجاري اختياري بعد التشغيل." },
    ownership: { icon: PieChart, title: "Ownership", titleAr: "الملكية", body: "Tokens represent the same fractional ownership; only the unit price evolves between phases.", bodyAr: "الرموز تمثل نفس الملكية الجزئية؛ فقط سعر الوحدة يتطور بين المراحل." },
    exit: { icon: LogOut, title: "Exit", titleAr: "التخارج", body: "Secondary Market available throughout. LP exit may activate at later phases.", bodyAr: "السوق الثانوي متاح طوال الوقت. قد يتاح تخارج LP في مراحل لاحقة." },
  },
  future: {
    education: { icon: GraduationCap, title: "About this model", titleAr: "عن هذا النموذج", body: "Investors reserve future ownership exposure today at predefined pricing. Ownership activates at the contract execution date.", bodyAr: "يحجز المستثمرون انكشاف ملكية مستقبلية اليوم بأسعار محددة مسبقاً. تنشط الملكية في تاريخ تنفيذ العقد." },
    workflow: { icon: Workflow, title: "How it works", titleAr: "آلية العمل", body: "Reserve at today's price → Wait through activation window → Settlement transfers full tokenised ownership at the agreed future date.", bodyAr: "احجز بسعر اليوم ← انتظر نافذة التفعيل ← تنتقل الملكية المرمزة الكاملة في التاريخ المستقبلي المتفق عليه." },
    timeline: { icon: Clock, title: "Timeline", titleAr: "الجدول الزمني", body: "Reservation → Activation date → Settlement date.", bodyAr: "الحجز ← تاريخ التفعيل ← تاريخ التسوية." },
    returns: { icon: LineChart, title: "Returns", titleAr: "العوائد", body: "Spread between reservation price and future activated valuation.", bodyAr: "الفارق بين سعر الحجز والتقييم المفعل المستقبلي." },
    ownership: { icon: PieChart, title: "Ownership", titleAr: "الملكية", body: "Ownership transfers on settlement date; until then investors hold a contractual right.", bodyAr: "تنتقل الملكية في تاريخ التسوية؛ وحتى ذلك الحين يحمل المستثمرون حقاً تعاقدياً." },
    exit: { icon: LogOut, title: "Exit", titleAr: "التخارج", body: "Contract resale via Secondary Market only until settlement.", bodyAr: "إعادة بيع العقد عبر السوق الثانوي فقط حتى التسوية." },
  },
  option: {
    education: { icon: GraduationCap, title: "About this model", titleAr: "عن هذا النموذج", body: "Investors purchase the right — but not the obligation — to acquire tokenised shares later at predefined pricing.", bodyAr: "يشتري المستثمرون الحق وليس الالتزام في الحصول على حصص مرمزة لاحقاً وفق تسعير محدد مسبقاً." },
    workflow: { icon: Workflow, title: "How it works", titleAr: "آلية العمل", body: "Pay option premium → Lock the strike price → Exercise any time before expiry, or let the option lapse.", bodyAr: "ادفع علاوة الخيار ← ثبّت سعر التنفيذ ← نفّذ في أي وقت قبل الانتهاء أو دعه ينتهي." },
    timeline: { icon: Clock, title: "Timeline", titleAr: "الجدول الزمني", body: "Validity period defined upfront. Expiry date is fixed.", bodyAr: "فترة الصلاحية محددة مسبقاً. تاريخ الانتهاء ثابت." },
    returns: { icon: LineChart, title: "Returns", titleAr: "العوائد", body: "Returns come from exercising at strike when market value exceeds it.", bodyAr: "تأتي العوائد من تنفيذ سعر التنفيذ عندما تتجاوز قيمة السوق." },
    ownership: { icon: PieChart, title: "Ownership", titleAr: "الملكية", body: "No ownership until exercised. Premium is non-refundable.", bodyAr: "لا توجد ملكية حتى التنفيذ. علاوة الخيار غير قابلة للاسترداد." },
    exit: { icon: LogOut, title: "Exit", titleAr: "التخارج", body: "Option contracts may be transferable subject to platform rules.", bodyAr: "قد تكون عقود الخيار قابلة للتحويل وفق قواعد المنصة." },
  },
  shared: {
    education: { icon: GraduationCap, title: "About this model", titleAr: "عن هذا النموذج", body: "Investors directly co-own a property with the original owner or developer.", bodyAr: "يشارك المستثمرون في الملكية المباشرة للعقار مع المالك الأصلي أو المطور." },
    workflow: { icon: Workflow, title: "How it works", titleAr: "آلية العمل", body: "Buy your share of the investor pool → Owner retains the remainder → Revenue is split pro-rata to ownership.", bodyAr: "اشترِ حصتك من تجمع المستثمرين ← يحتفظ المالك بالباقي ← تُقسم الإيرادات بالتناسب مع الملكية." },
    timeline: { icon: Clock, title: "Timeline", titleAr: "الجدول الزمني", body: "Distributions begin once the asset is operational. Long-term hold typical.", bodyAr: "تبدأ التوزيعات بمجرد تشغيل الأصل. الاحتفاظ طويل الأجل هو المعتاد." },
    returns: { icon: LineChart, title: "Returns", titleAr: "العوائد", body: "Rental income plus appreciation, distributed pro-rata.", bodyAr: "دخل إيجاري بالإضافة إلى الارتفاع، يوزع بالتناسب." },
    ownership: { icon: PieChart, title: "Ownership", titleAr: "الملكية", body: "Direct co-ownership recorded at SPV level. Owner share is disclosed and locked.", bodyAr: "ملكية مشتركة مباشرة مسجلة في الشركة ذات الغرض الخاص. حصة المالك مُفصح عنها ومثبَّتة." },
    exit: { icon: LogOut, title: "Exit", titleAr: "التخارج", body: "Owner has right of first refusal; otherwise LP / Secondary exits apply.", bodyAr: "للمالك حق الأولوية في الشراء؛ خلاف ذلك تُطبق خيارات التخارج عبر LP والسوق الثانوي." },
  },
  construction_portfolio: {
    education: { icon: GraduationCap, title: "About this model", titleAr: "عن هذا النموذج", body: "A bundle of under-construction projects packaged into a single growth-oriented vehicle.", bodyAr: "حزمة من المشاريع قيد الإنشاء مجمَّعة في أداة استثمارية واحدة موجهة نحو النمو." },
    workflow: { icon: Workflow, title: "How it works", titleAr: "آلية العمل", body: "Buy one token → Diversified construction exposure → Returns crystallise as projects deliver.", bodyAr: "اشترِ رمزاً واحداً ← انكشاف إنشائي متنوع ← تتحقق العوائد عند تسليم المشاريع." },
    timeline: { icon: Clock, title: "Timeline", titleAr: "الجدول الزمني", body: "Aligned to the longest project timeline in the bundle.", bodyAr: "موافق لأطول جدول زمني للمشاريع في الحزمة." },
    returns: { icon: LineChart, title: "Returns", titleAr: "العوائد", body: "Capital appreciation focus, with optional rental yield post-delivery.", bodyAr: "تركيز على نمو رأس المال مع عائد إيجاري اختياري بعد التسليم." },
    ownership: { icon: PieChart, title: "Ownership", titleAr: "الملكية", body: "Master SPV holds all underlying construction SPVs.", bodyAr: "تمتلك الشركة الأم ذات الغرض الخاص جميع الشركات الإنشائية الفرعية." },
    exit: { icon: LogOut, title: "Exit", titleAr: "التخارج", body: "Secondary Market available throughout the lifecycle.", bodyAr: "السوق الثانوي متاح طوال دورة حياة المنتج." },
  },
};

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className={`p-4 rounded-xl border ${accent ? "bg-primary/5 border-primary/20" : "bg-muted/40 border-border"}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

interface PropertyModelSectionProps {
  property: Property;
}

export function PropertyModelSection({ property }: PropertyModelSectionProps) {
  const { language, isRTL } = useLanguage();
  const isAr = language === "ar";
  const meta = propertyModelMeta[property.model];
  const copy = educationalCopy[property.model];

  const sections = [copy.education, copy.workflow, copy.timeline, copy.returns, copy.ownership, copy.exit];

  return (
    <div className="space-y-6">
      {/* Model header banner */}
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? "نموذج العقار" : "Property model"}</p>
              <h3 className="text-xl font-display font-bold text-foreground">
                {isAr ? meta.labelAr : meta.label}
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">${property.tokenPrice} / token</Badge>
            {property.futureTokenPrice && (
              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                {isAr ? "السعر المستقبلي" : "Future price"}: ${property.futureTokenPrice}
              </Badge>
            )}
            {property.insuranceActive && (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
                <ShieldCheck className="w-3 h-3 mr-1" />
                {isAr ? "مؤمَّن" : "Insured"}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Model-specific data block */}
      {property.model === "installment" && property.installment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {isAr ? "خطة الأقساط" : "Installment Plan"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label={isAr ? "إجمالي الأقساط" : "Total installments"} value={`${property.installment.totalInstallments}`} icon={Layers} />
              <MetricCard label={isAr ? "المدفوع" : "Paid"} value={`${property.installment.paidInstallments}`} icon={CheckCircle2} />
              <MetricCard label={isAr ? "القسط الشهري" : "Monthly amount"} value={`$${property.installment.monthlyAmount}`} icon={Coins} />
              <MetricCard label={isAr ? "تاريخ التفعيل" : "Activation date"} value={property.installment.activationDate} icon={Sparkles} accent />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{isAr ? "نسبة الإكمال" : "Completion"}</span>
                <span className="font-semibold">{property.installment.completionPercent}%</span>
              </div>
              <Progress value={property.installment.completionPercent} />
            </div>
            <p className="text-sm text-muted-foreground">
              {isAr ? "الدفعة القادمة:" : "Next payment:"}{" "}
              <span className="text-foreground font-medium">{property.installment.nextPaymentDate}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {property.model === "phasing" && property.phases && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              {isAr ? "مراحل التسعير" : "Pricing Phases"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {property.phases.map((ph) => (
                <div
                  key={ph.number}
                  className={`p-4 rounded-xl border ${
                    ph.status === "current"
                      ? "border-primary/40 bg-primary/5"
                      : ph.status === "completed"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={ph.status === "current" ? "gold" : "outline"}>
                        {isAr ? `المرحلة ${ph.number}` : `Phase ${ph.number}`}
                      </Badge>
                      <span className="font-medium">{isAr ? ph.nameAr : ph.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Coins className="w-4 h-4 text-primary" />
                      <span className="font-bold">${ph.tokenPrice}</span>
                      <span className="text-muted-foreground">/ token</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {ph.startDate} → {ph.endDate}
                  </div>
                  <Progress value={ph.progress} className="h-1.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {property.model === "future" && property.future && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-primary" />
              {isAr ? "عقد ملكية مستقبلية" : "Future Ownership Contract"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricCard label={isAr ? "تاريخ الحجز" : "Reservation"} value={property.future.reservationDate} icon={Calendar} />
            <MetricCard label={isAr ? "تاريخ التفعيل" : "Activation"} value={property.future.activationDate} icon={Sparkles} accent />
            <MetricCard label={isAr ? "تاريخ التسوية" : "Settlement"} value={property.future.settlementDate} icon={CheckCircle2} />
            <MetricCard label={isAr ? "سعر الحجز" : "Reservation price"} value={`$${property.future.reservationPrice}`} icon={Coins} />
            <MetricCard label={isAr ? "القيمة المستقبلية المقدرة" : "Est. future value"} value={`$${property.future.estimatedFutureValue}`} icon={TrendingUp} />
            <MetricCard label={isAr ? "العائد المستقبلي المقدر" : "Est. future ROI"} value={`${property.future.estimatedRoi}%`} icon={LineChart} accent />
          </CardContent>
        </Card>
      )}

      {property.model === "option" && property.option && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {isAr ? "شروط عقد الخيار" : "Option Contract Terms"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard label={isAr ? "علاوة الخيار" : "Option premium"} value={`$${property.option.optionPremium}`} icon={Coins} />
              <MetricCard label={isAr ? "سعر التنفيذ" : "Strike price"} value={`$${property.option.strikePrice}`} icon={Coins} accent />
              <MetricCard label={isAr ? "تاريخ الانتهاء" : "Expiry"} value={property.option.expiryDate} icon={Clock} />
              <MetricCard label={isAr ? "فترة الصلاحية" : "Validity"} value={`${property.option.validityMonths} mo`} icon={Calendar} />
              <MetricCard label={isAr ? "القيمة المستقبلية المقدرة" : "Est. future value"} value={`$${property.option.estimatedFutureValue}`} icon={TrendingUp} />
            </div>
            <div className="p-3 rounded-lg bg-muted/40 border border-border text-sm">
              <p className="font-medium mb-1">{isAr ? "شروط التنفيذ" : "Exercise conditions"}</p>
              <p className="text-muted-foreground">
                {isAr ? property.option.exerciseConditionsAr : property.option.exerciseConditions}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {property.model === "shared" && property.shared && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="w-5 h-5 text-primary" />
              {isAr ? "هيكل الملكية المشتركة" : "Co-Ownership Structure"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                <div
                  className="bg-primary"
                  style={{ width: `${property.shared.investorShare}%` }}
                />
                <div
                  className="bg-emerald-500"
                  style={{ width: `${property.shared.ownerShare}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span><span className="inline-block w-2 h-2 rounded-full bg-primary mr-1" />{isAr ? "المستثمرون" : "Investors"} {property.shared.investorShare}%</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />{property.shared.ownerName} {property.shared.ownerShare}%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard label={isAr ? "تقاسم الأرباح" : "Profit split"} value={property.shared.profitSplit} icon={PieChart} />
              <MetricCard label={isAr ? "وتيرة التوزيع" : "Distribution"} value={property.shared.revenueDistribution} icon={Calendar} />
              <MetricCard label={isAr ? "حصة المستثمرين" : "Investor pool"} value={`${property.shared.investorShare}%`} icon={Users2} accent />
            </div>
            <div className="p-3 rounded-lg bg-muted/40 border border-border text-sm">
              <p className="font-medium mb-1">{isAr ? "آلية نقل الملكية" : "Transfer process"}</p>
              <p className="text-muted-foreground">
                {isAr ? property.shared.transferProcessAr : property.shared.transferProcess}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {(property.model === "ready_portfolio" || property.model === "construction_portfolio") &&
        property.portfolioAssets && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" />
                {isAr ? "أصول المحفظة" : "Portfolio Assets"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {property.portfolioAssets.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                  <div>
                    <div className="font-medium">{isAr ? a.nameAr : a.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {a.assetType} · {a.city}
                    </div>
                  </div>
                  <Badge variant="gold">{a.weight}%</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

      {/* Construction progress (any under-construction model) */}
      {typeof property.constructionProgress === "number" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardHat className="w-5 h-5 text-primary" />
              {isAr ? "تقدم البناء" : "Construction Progress"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{isAr ? "النسبة المنجزة" : "Completed"}</span>
              <span className="font-semibold">{property.constructionProgress}%</span>
            </div>
            <Progress value={property.constructionProgress} />
            {property.developerReports && (
              <div className="space-y-2 pt-2">
                {property.developerReports.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30">
                    <div>
                      <div className="font-medium">{isAr ? r.titleAr : r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.date}</div>
                    </div>
                    <Badge variant="outline">{r.progress}%</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Educational sections (always shown) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            {isAr ? "كيف يعمل هذا النموذج" : "How this model works"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          {sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="p-4 rounded-xl bg-muted/30 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold">{isAr ? s.titleAr : s.title}</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isAr ? s.bodyAr : s.body}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
