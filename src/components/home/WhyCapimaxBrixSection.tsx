import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ShieldCheck,
  LayoutGrid,
  Layers,
  Globe2,
  ArrowRightLeft,
  Building2,
  Wallet,
  TrendingUp,
  Coins,
  Sparkles,
  Network,
  Repeat,
  UsersRound,
  CreditCard,
  Scroll,
  CheckCircle2,
} from "lucide-react";

export function WhyCapimaxBrixSection() {
  const { isRTL } = useLanguage();

  const coreBenefits = [
    {
      icon: ShieldCheck,
      title: isRTL ? "عقارات مؤمَّنة" : "Insured Properties",
      desc: isRTL ? "تأمين معتمد على كل أصل لحماية رأس المال." : "Certified insurance on every asset to protect capital.",
    },
    {
      icon: LayoutGrid,
      title: isRTL ? "فئات عقارية متعددة" : "Multiple Real Estate Categories",
      desc: isRTL ? "سكني، تجاري، فندقي، صناعي ولوجستي." : "Residential, commercial, hospitality, industrial & logistics.",
    },
    {
      icon: Layers,
      title: isRTL ? "تنويع: جاهز وقيد الإنشاء" : "Ready & Under-Construction Mix",
      desc: isRTL ? "وازن بين الدخل الفوري ونمو رأس المال." : "Balance immediate income with capital growth.",
    },
    {
      icon: Globe2,
      title: isRTL ? "تقييم عالمي مستقل" : "Independent Global Valuation",
      desc: isRTL ? "شركات تقييم دولية محايدة لكل عقار." : "Neutral international valuation firms for every asset.",
    },
    {
      icon: ArrowRightLeft,
      title: isRTL ? "طرق خروج متعددة" : "Multiple Exit Methods",
      desc: isRTL ? "السوق الثانوية ومزود السيولة وتصفية الأصل." : "Secondary market, LP exit & asset liquidation.",
    },
    {
      icon: Building2,
      title: isRTL ? "نماذج ملكية متنوعة" : "Different Ownership Models",
      desc: isRTL ? "ملكية كاملة، جزئية، ومحافظ مجمّعة." : "Full, fractional and pooled portfolio ownership.",
    },
    {
      icon: Wallet,
      title: isRTL ? "ملكية مولّدة للدخل" : "Income-Generating Ownership",
      desc: isRTL ? "توزيعات دورية من إيجارات وعوائد الأصول." : "Recurring distributions from rents & asset yields.",
    },
    {
      icon: TrendingUp,
      title: isRTL ? "فرص نمو رأس المال" : "Capital Appreciation",
      desc: isRTL ? "ارتفاع قيمة الأصول مع الزمن والتطوير." : "Asset value appreciation over time & through development.",
    },
    {
      icon: Coins,
      title: isRTL ? "ابدأ بدون رأس مال كبير" : "No Large Capital Required",
      desc: isRTL ? "ادخل السوق العقاري بمبالغ صغيرة." : "Enter the real estate market with small amounts.",
    },
    {
      icon: Sparkles,
      title: isRTL ? "هياكل ملكية مبتكرة" : "Innovative Ownership Structures",
      desc: isRTL ? "SPV وتوكنة وحوكمة شفافة على البلوكتشين." : "SPV, tokenization & transparent on-chain governance.",
    },
  ];

  const firsts = [
    {
      icon: Network,
      title: isRTL ? "أول منظومة عقارية متكاملة" : "First Integrated Ecosystem",
      desc: isRTL
        ? "تجمع المالكين والمطورين والوسطاء ومزودي السيولة والمستثمرين في منظومة عقارية واحدة مدعومة بالبلوكتشين."
        : "Bringing together Owners, Developers, Brokers, Liquidity Providers and Investors in one blockchain-powered real estate ecosystem.",
      tags: isRTL
        ? ["المالكون", "المطورون", "الوسطاء", "مزودو السيولة", "المستثمرون"]
        : ["Owners", "Developers", "Brokers", "Liquidity Providers", "Investors"],
    },
    {
      icon: Repeat,
      title: isRTL ? "أول منصة بسوقي خروج" : "Two Exit Markets",
      desc: isRTL
        ? "خروج عبر السوق الثانوية أو خروج فوري عبر مزود السيولة."
        : "Exit via the Secondary Market or instant exit through Liquidity Providers.",
      tags: isRTL
        ? ["السوق الثانوية", "خروج فوري عبر LP"]
        : ["Secondary Market Exit", "LP Instant Exit"],
    },
    {
      icon: UsersRound,
      title: isRTL ? "أول منصة للاستثمار العائلي" : "Family Investment Structures",
      desc: isRTL
        ? "تخصيص استثمارات وادخار ودخل وملكية لأفراد العائلة."
        : "Allocate investments, savings, passive income and ownership to family members.",
      tags: isRTL
        ? ["تخصيص العائلة", "ادخار العائلة", "دخل سلبي للعائلة", "ملكية للعائلة"]
        : ["Family allocation", "Family savings", "Passive income share", "Ownership allocation"],
    },
    {
      icon: CreditCard,
      title: isRTL ? "منظومة بطاقات BRX Visa" : "BRX Visa & Card Ecosystem",
      desc: isRTL
        ? "بطاقات مرتبطة بالمحفظة، للإنفاق من العوائد والرصيد والدخل السلبي — للمستثمر، العائلة، المطور، مزود السيولة والوسيط."
        : "Wallet-linked cards spending directly from real estate returns, balances and passive income — for investors, family, developers, LPs and brokers.",
      tags: isRTL
        ? ["مرتبطة بالمحفظة", "للجميع", "إنفاق من العوائد", "إنفاق من الدخل السلبي"]
        : ["Wallet-linked", "All roles", "Spend from returns", "Spend from passive income"],
    },
    {
      icon: Scroll,
      title: isRTL ? "أول نظام ميراث للعقار المرمّز" : "Tokenized Real Estate Inheritance",
      desc: isRTL
        ? "ميراث الأصول، نقل الملكية، تعيين المستفيدين، استمرارية ثروة العائلة، والوكلاء القانونيون."
        : "Asset inheritance, ownership transfer, beneficiary assignment, family wealth continuity & legal proxies.",
      tags: isRTL
        ? ["ميراث الأصول", "نقل الملكية", "تعيين المستفيدين", "استمرارية الثروة", "وكلاء قانونيون"]
        : ["Asset inheritance", "Ownership transfer", "Beneficiary assignment", "Wealth continuity", "Authorized representatives"],
    },
    {
      icon: LayoutGrid,
      title: isRTL ? "تحكم كامل عبر لوحة القيادة" : "Full Dashboard Control",
      desc: isRTL
        ? "أدوات متكاملة لإدارة الاستثمار والملكية والتوزيعات والخروج من مكان واحد."
        : "Complete investment & ownership management tools in one place.",
      tags: isRTL
        ? ["إدارة الاستثمار", "إدارة الملكية", "التوزيعات", "الخروج"]
        : ["Investment mgmt", "Ownership mgmt", "Distributions", "Exits"],
    },
  ];

  return (
    <section id="why-capimax-brx" className="py-20 bg-gradient-to-b from-background via-card/30 to-background">
      <div className="container">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="gold" className="mb-4">
            {isRTL ? "لماذا كابيماكس BRX" : "Why Capimax BRX"}
          </Badge>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            {isRTL
              ? "منظومة عقارية كاملة على البلوكتشين"
              : "A Complete Blockchain-Powered Real Estate Ecosystem"}
          </h2>
          <p className="text-lg text-muted-foreground">
            {isRTL
              ? "ليست مجرد منصة ترميز عقاري — بل منظومة متكاملة للملكية والثروة والاستثمار العائلي والدخل السلبي والميراث."
              : "Not only a tokenized real estate platform — a complete ownership, wealth, family investment, passive income and inheritance ecosystem."}
          </p>
        </div>

        {/* Core benefits grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-16">
          {coreBenefits.map((b, i) => (
            <div
              key={i}
              className="group p-5 bg-card rounded-2xl border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-gold animate-fade-in"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <b.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground text-sm mb-1.5 leading-snug">{b.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>

        {/* Firsts / pillars */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge variant="gold" className="mb-3">
            {isRTL ? "السبَّاقون في القطاع" : "Industry Firsts"}
          </Badge>
          <h3 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            {isRTL ? "ميزات تفرّد بها BRX" : "Pioneering Features Only on BRX"}
          </h3>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {firsts.map((f, i) => (
            <div
              key={i}
              className="group relative p-6 rounded-2xl border border-border bg-gradient-to-br from-card to-card/50 hover:border-primary/50 transition-all duration-300 hover:shadow-gold animate-fade-in overflow-hidden"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
              <div className="relative">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-display text-lg font-semibold text-foreground mb-2">{f.title}</h4>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{f.desc}</p>
                <ul className="space-y-1.5">
                  {f.tags.map((t, ti) => (
                    <li key={ti} className="flex items-center gap-2 text-xs text-foreground/85">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
