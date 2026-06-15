import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, RefreshCcw, Users, ExternalLink, ArrowRight, ArrowLeft, CreditCard, Shield, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function NotificationsSection() {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const notifications = [
    {
      id: 1,
      icon: Building2,
      title: isRTL ? "منصة كابيماكس بروبشير" : "Capimax PropShare Platform",
      description: isRTL
        ? "منصة الاستثمار العقاري الرقمي الجزئي التي تعمل عبر تقنية البلوكتشين. استثمر في العقارات بسهولة وأمان."
        : "The digital fractional real estate investment platform operating via blockchain. Invest in real estate easily and securely.",
      linkType: "external",
      link: "https://capimaxpropshare.shop",
      buttonText: isRTL ? "زيارة المنصة" : "Visit Platform",
      gradient: "from-blue-500/20 to-cyan-500/20",
      iconBg: "bg-blue-500",
    },
    {
      id: 2,
      icon: RefreshCcw,
      title: isRTL ? "ميزة إعادة استثمار الأرباح" : "Profit Reinvestment Feature",
      description: isRTL
        ? "أعد استثمار عوائدك تلقائياً مع خصم على المبالغ المعاد استثمارها ومكافأة برونوفا إضافية."
        : "Reinvest your returns automatically with a discount on reinvested amounts and Pronova bonus for reinvestment.",
      highlights: [
        isRTL ? "خصم على المبالغ المعاد استثمارها" : "Discount on reinvested amounts",
        isRTL ? "مكافأة برونوفا لإعادة الاستثمار" : "Pronova bonus for reinvestment",
      ],
      linkType: "internal",
      link: "/dashboard",
      buttonText: isRTL ? "لوحة المستثمر" : "Investor Dashboard",
      gradient: "from-emerald-500/20 to-green-500/20",
      iconBg: "bg-emerald-500",
    },
    {
      id: 3,
      icon: Users,
      title: isRTL ? "ميزة الاستثمار العائلي" : "Family Investment Feature",
      description: isRTL
        ? "استثمر لأفراد عائلتك مع إمكانية تخصيص العوائد أو الاستثمارات لأحد أفراد الأسرة."
        : "Invest for your family members with the ability to allocate returns or investments to a family member.",
      highlights: [
        isRTL ? "تخصيص العوائد أو الاستثمارات لأفراد الأسرة" : "Allocate returns or investments to family members",
        isRTL ? "ربط الحسابات العائلية بدون رسوم تحويل" : "Link family accounts with zero transfer fees",
      ],
      linkType: "internal",
      link: "/family-investment",
      buttonText: isRTL ? "الاستثمار العائلي" : "Family Investment",
      gradient: "from-purple-500/20 to-pink-500/20",
      iconBg: "bg-purple-500",
    },
    {
      id: 4,
      icon: CreditCard,
      title: isRTL ? "بطاقات افتراضية للعائلة والمعالين" : "Family & Dependent Virtual Cards",
      description: isRTL
        ? "أنشئ بطاقات افتراضية إضافية مرتبطة بالاستثمارات العائلية والمعالين والمحافظ المخصصة داخل حسابك."
        : "Create additional virtual cards linked to family investments, dependents, and allocated portfolios inside your account.",
      highlights: [
        isRTL ? "بطاقة شخصية أساسية وبطاقات إضافية" : "Primary card plus additional virtual cards",
        isRTL ? "تجميد/إلغاء تجميد وتتبع المعاملات" : "Freeze/unfreeze and transaction tracking",
      ],
      linkType: "internal",
      link: "/cards",
      buttonText: isRTL ? "إدارة البطاقات" : "Manage Cards",
      gradient: "from-amber-500/20 to-orange-500/20",
      iconBg: "bg-amber-500",
    },
    {
      id: 5,
      icon: Shield,
      title: isRTL ? "تأمين العقارات" : "Property Insurance",
      description: isRTL
        ? "حماية شاملة لكل عقار مع تقييم وتأمين معتمد لضمان أمان استثمارك على المدى الطويل."
        : "Comprehensive protection for every property with certified valuation and insurance to safeguard your investment long-term.",
      highlights: [
        isRTL ? "تأمين معتمد لكل أصل" : "Certified insurance per asset",
        isRTL ? "تقييم دوري وشفاف" : "Periodic transparent valuation",
      ],
      linkType: "internal",
      link: "/marketplace",
      buttonText: isRTL ? "استكشاف العقارات" : "Explore Properties",
      gradient: "from-sky-500/20 to-blue-500/20",
      iconBg: "bg-sky-500",
    },
    {
      id: 6,
      icon: LayoutGrid,
      title: isRTL ? "8 أنواع من العقارات والمحافظ" : "8 Types of Properties & Portfolios",
      description: isRTL
        ? "اكتشف ثماني فئات من الفرص: عقارات جاهزة، قيد الإنشاء، محافظ جاهزة، ومحافظ تطوير."
        : "Discover eight opportunity categories: Ready Properties, Under Construction, Ready Portfolios, and Development Portfolios.",
      highlights: [
        isRTL ? "عقارات جاهزة وقيد الإنشاء" : "Ready & Under-construction properties",
        isRTL ? "محافظ جاهزة ومحافظ تطوير" : "Ready & Development portfolios",
      ],
      linkType: "internal",
      link: "/products",
      buttonText: isRTL ? "تصفح المنتجات" : "Browse Products",
      gradient: "from-teal-500/20 to-emerald-500/20",
      iconBg: "bg-teal-500",
    },
  ];

  const handleClick = (notification: typeof notifications[0]) => {
    if (notification.linkType === "external") {
      window.open(notification.link, "_blank", "noopener,noreferrer");
    } else {
      navigate(notification.link);
    }
  };

  return (
    <section className="py-16 bg-gradient-to-b from-background to-muted/30">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
            {isRTL ? "أحدث الإعلانات والميزات" : "Latest Announcements & Features"}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {isRTL
              ? "اكتشف أحدث الميزات والخدمات المتاحة على منصتنا"
              : "Discover the latest features and services available on our platform"}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notifications.map((notification) => {
            const IconComponent = notification.icon;
            return (
              <Card
                key={notification.id}
                className={`group cursor-pointer border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-xl bg-gradient-to-br ${notification.gradient} backdrop-blur-sm overflow-hidden`}
                onClick={() => handleClick(notification)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 ${notification.iconBg} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                        {notification.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    {notification.description}
                  </p>

                  {notification.highlights && (
                    <ul className="space-y-2 mb-4">
                      {notification.highlights.map((highlight, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm text-foreground/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300"
                  >
                    {notification.buttonText}
                    {notification.linkType === "external" ? (
                      <ExternalLink className="w-4 h-4 ml-2" />
                    ) : (
                      <ArrowIcon className={`w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform ${isRTL ? "group-hover:-translate-x-1" : ""}`} />
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
