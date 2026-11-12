import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Building2,
  LayoutDashboard,
  CircleUser,
  ArrowLeftRight,
  Menu,
  TrendingUp,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface NavItem {
  id: string;
  label: string;
  labelAr: string;
  icon: React.ElementType;
  href?: string;
  /** Paths that mark the item active when they differ from `href` (e.g. href carries a query). */
  match?: string[];
  action?: "more-menu" | "trade-menu";
}

// Order fixed by the client: Home — Properties — Dashboard — Account — Trade — More.
// It starts on the left in English and on the right in Arabic (the page is dir="rtl").
const navItems: NavItem[] = [
  { id: "home", label: "Home", labelAr: "الرئيسية", icon: Home, href: "/" },
  { id: "properties", label: "Properties", labelAr: "العقارات", icon: Building2, href: "/marketplace" },
  { id: "dashboard", label: "Dashboard", labelAr: "لوحة التحكم", icon: LayoutDashboard, href: "/dashboard" },
  { id: "account", label: "Account", labelAr: "حسابي", icon: CircleUser, href: "/settings?tab=profile", match: ["/settings"] },
  // Opens the choice between the two markets (client: the liquidity provider market must be as visible as the secondary market).
  { id: "trade", label: "Trade", labelAr: "التداول", icon: ArrowLeftRight, action: "trade-menu", match: ["/secondary-market", "/lp-market"] },
  { id: "more", label: "More", labelAr: "المزيد", icon: Menu, action: "more-menu" },
];

const markets = [
  {
    href: "/secondary-market",
    label: "Secondary Market",
    labelAr: "السوق الثانوي",
    desc: "Buy and sell units with other investors and manage your offers.",
    descAr: "اشترِ وبِع الوحدات مع المستثمرين الآخرين وأدِر عروضك.",
    icon: TrendingUp,
  },
  {
    href: "/lp-market",
    label: "Liquidity Provider Market",
    labelAr: "سوق مزود السيولة",
    desc: "Sell your units instantly to a liquidity provider at the platform price.",
    descAr: "بِع وحداتك فورًا لمزود السيولة بسعر المنصة.",
    icon: Coins,
  },
];

interface MobileBottomNavProps {
  onOpenSidebar: () => void;
}

export function MobileBottomNav({ onOpenSidebar }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const [tradeOpen, setTradeOpen] = useState(false);

  const isActive = (item: NavItem) => {
    const paths = item.match ?? (item.href ? [item.href] : []);
    return paths.some((p) => (p === "/" ? location.pathname === "/" : location.pathname.startsWith(p)));
  };

  const handleNavClick = (item: NavItem) => {
    if (item.action === "more-menu") {
      onOpenSidebar();
    } else if (item.action === "trade-menu") {
      setTradeOpen(true);
    } else if (item.id === "account" && !user) {
      navigate("/auth");
    } else if (item.href) {
      navigate(item.href);
    }
  };

  return (
    <>
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5", active && "text-primary")} strokeWidth={active ? 2.5 : 2} />
              <span className={cn("text-[10px] leading-tight font-medium", active && "font-bold")}>
                {language === "ar" ? item.labelAr : item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>

    {/* Trade: choose a market */}
    <Sheet open={tradeOpen} onOpenChange={setTradeOpen}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8 lg:hidden">
        <SheetHeader>
          <SheetTitle className="text-start">{language === "ar" ? "التداول" : "Trade"}</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {markets.map((m) => (
            <button
              key={m.href}
              onClick={() => {
                setTradeOpen(false);
                navigate(m.href);
              }}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-muted/50 hover:bg-muted transition-colors text-center",
                location.pathname.startsWith(m.href) && "border-primary bg-primary/10"
              )}
            >
              <m.icon className="w-6 h-6 text-primary" />
              <span className="text-sm font-semibold text-foreground">{language === "ar" ? m.labelAr : m.label}</span>
              <span className="text-[11px] leading-snug text-muted-foreground">{language === "ar" ? m.descAr : m.desc}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}
