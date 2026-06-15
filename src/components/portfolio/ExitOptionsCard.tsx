import { TrendingUp, Coins, ArrowRight, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface ExitOptionsCardProps {
  assetId?: string;
  assetName?: string;
  className?: string;
  style?: React.CSSProperties;
  compact?: boolean;
}

export function ExitOptionsCard({ 
  assetId, 
  assetName,
  className,
  style,
  compact = false
}: ExitOptionsCardProps) {
  const { language } = useLanguage();

  const exitOptions = [
    {
      id: "secondary",
      title: language === "ar" ? "البيع في السوق الثانوي" : "Sell on Secondary Market",
      description: language === "ar" 
        ? "أدرج أصولك للبيع للمستثمرين الآخرين بالسعر الذي تحدده"
        : "List your assets for sale to other investors at your chosen price",
      fee: "0.5%",
      feeLabel: language === "ar" ? "رسوم" : "Fee",
      icon: TrendingUp,
      href: assetId ? `/secondary-market?asset=${assetId}` : "/secondary-market",
      color: "text-info",
      bgColor: "bg-info/10",
      badge: language === "ar" ? "مرن" : "Flexible",
      badgeVariant: "outline" as const,
      features: [
        language === "ar" ? "تحكم بالسعر" : "Price control",
        language === "ar" ? "عوائد أعلى محتملة" : "Higher potential returns",
      ],
    },
    {
      id: "lp",
      title: language === "ar" ? "بيع فوري عبر مزود السيولة" : "Instant Sale via LP",
      description: language === "ar"
        ? "بع أصولك فوراً بسعر محدد مسبقاً مع سيولة مضمونة"
        : "Sell your assets instantly at a pre-determined price with guaranteed liquidity",
      fee: "1%",
      feeLabel: language === "ar" ? "رسوم" : "Fee",
      icon: Coins,
      href: assetId ? `/lp-market?asset=${assetId}` : "/lp-market",
      color: "text-primary",
      bgColor: "bg-primary/10",
      badge: language === "ar" ? "فوري" : "Instant",
      badgeVariant: "gold" as const,
      features: [
        language === "ar" ? "تنفيذ فوري" : "Instant execution",
        language === "ar" ? "سيولة مضمونة" : "Guaranteed liquidity",
      ],
    },
  ];

  if (compact) {
    return (
      <div className={cn("space-y-3", className)} style={style}>
        <h3 className="font-semibold text-foreground text-sm mb-3">
          {language === "ar" ? "خيارات البيع" : "Exit Options"}
        </h3>
        {exitOptions.map((option) => (
          <Link
            key={option.id}
            to={option.href}
            className="flex items-center justify-between p-3 bg-muted rounded-xl hover:bg-muted/80 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", option.bgColor)}>
                <option.icon className={cn("w-5 h-5", option.color)} />
              </div>
              <div>
                <div className="font-medium text-foreground text-sm">{option.title}</div>
                <div className="text-xs text-muted-foreground">
                  {option.feeLabel}: <span className="font-semibold">{option.fee}</span>
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-2xl border border-border p-6", className)} style={style}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {language === "ar" ? "خيارات التخارج" : "Exit Options"}
        </h3>
        {assetName && (
          <Badge variant="outline" className="text-xs">
            {assetName}
          </Badge>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {exitOptions.map((option) => (
          <div
            key={option.id}
            className="relative p-5 rounded-xl border border-border hover:border-primary/30 transition-all group bg-gradient-to-br from-background to-muted/30"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", option.bgColor)}>
                <option.icon className={cn("w-6 h-6", option.color)} />
              </div>
              <Badge variant={option.badgeVariant} className="gap-1">
                {option.id === "lp" ? <Zap className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {option.badge}
              </Badge>
            </div>

            <h4 className="font-semibold text-foreground mb-2">{option.title}</h4>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{option.description}</p>

            <div className="flex flex-wrap gap-2 mb-4">
              {option.features.map((feature, idx) => (
                <span key={idx} className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">
                  {feature}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-muted-foreground">{option.feeLabel}: </span>
                <span className="font-bold text-foreground">{option.fee}</span>
              </div>
              <Link to={option.href}>
                <Button size="sm" variant={option.id === "lp" ? "hero" : "outline"} className="gap-2">
                  {language === "ar" ? "بيع الآن" : "Sell Now"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground text-center">
          {language === "ar" 
            ? "* الرسوم تُخصم من قيمة المعاملة النهائية. التوفر يعتمد على ظروف السوق."
            : "* Fees are deducted from the final transaction amount. Availability depends on market conditions."}
        </p>
      </div>
    </div>
  );
}
