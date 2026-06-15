import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Store,
  Briefcase,
  LogOut,
  LayoutDashboard,
  Menu,
  TrendingUp,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface NavItem {
  id: string;
  label: string;
  labelAr: string;
  icon: React.ElementType;
  href?: string;
  action?: "exit-menu" | "more-menu";
}

const navItems: NavItem[] = [
  { id: "home", label: "Home", labelAr: "الرئيسية", icon: Home, href: "/" },
  { id: "marketplace", label: "Marketplace", labelAr: "السوق", icon: Store, href: "/marketplace" },
  { id: "portfolio", label: "Portfolio", labelAr: "المحفظة", icon: Briefcase, href: "/portfolio" },
  { id: "exit", label: "Exit", labelAr: "خروج", icon: LogOut, action: "exit-menu" },
  { id: "dashboard", label: "Dashboard", labelAr: "لوحة التحكم", icon: LayoutDashboard, href: "/dashboard" },
  { id: "more", label: "More", labelAr: "المزيد", icon: Menu, action: "more-menu" },
];

const exitSubItems = [
  { label: "Secondary Market", labelAr: "السوق الثانوي", icon: TrendingUp, href: "/secondary-market" },
  { label: "Liquidity Market", labelAr: "سوق السيولة", icon: Coins, href: "/lp-market" },
];

interface MobileBottomNavProps {
  onOpenSidebar: () => void;
}

export function MobileBottomNav({ onOpenSidebar }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [exitOpen, setExitOpen] = useState(false);

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const handleNavClick = (item: NavItem) => {
    if (item.action === "exit-menu") {
      setExitOpen(true);
    } else if (item.action === "more-menu") {
      onOpenSidebar();
    } else if (item.href) {
      navigate(item.href);
    }
  };

  return (
    <>
      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border lg:hidden safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
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

      {/* Exit Sub-menu Sheet */}
      <Sheet open={exitOpen} onOpenChange={setExitOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8 lg:hidden">
          <SheetHeader>
            <SheetTitle className="text-start">
              {language === "ar" ? "خيارات الخروج" : "Exit Options"}
            </SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {exitSubItems.map((sub) => (
              <button
                key={sub.href}
                onClick={() => {
                  navigate(sub.href);
                  setExitOpen(false);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-muted/50 hover:bg-muted transition-colors",
                  location.pathname === sub.href && "border-primary bg-primary/10"
                )}
              >
                <sub.icon className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {language === "ar" ? sub.labelAr : sub.label}
                </span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
