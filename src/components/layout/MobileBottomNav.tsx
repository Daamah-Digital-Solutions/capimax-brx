import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Building2,
  LayoutDashboard,
  CircleUser,
  ArrowLeftRight,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  id: string;
  label: string;
  labelAr: string;
  icon: React.ElementType;
  href?: string;
  /** Path that marks the item active when it differs from `href` (e.g. href carries a query). */
  match?: string;
  action?: "more-menu";
}

// Order fixed by the client: Home — Properties — Dashboard — Account — Trade — More.
// It starts on the left in English and on the right in Arabic (the page is dir="rtl").
const navItems: NavItem[] = [
  { id: "home", label: "Home", labelAr: "الرئيسية", icon: Home, href: "/" },
  { id: "properties", label: "Properties", labelAr: "العقارات", icon: Building2, href: "/marketplace" },
  { id: "dashboard", label: "Dashboard", labelAr: "لوحة التحكم", icon: LayoutDashboard, href: "/dashboard" },
  { id: "account", label: "Account", labelAr: "حسابي", icon: CircleUser, href: "/settings?tab=profile", match: "/settings" },
  // Buy and sell units and manage your offers.
  { id: "trade", label: "Trade", labelAr: "التداول", icon: ArrowLeftRight, href: "/secondary-market" },
  { id: "more", label: "More", labelAr: "المزيد", icon: Menu, action: "more-menu" },
];

interface MobileBottomNavProps {
  onOpenSidebar: () => void;
}

export function MobileBottomNav({ onOpenSidebar }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();

  const isActive = (item: NavItem) => {
    const path = item.match ?? item.href;
    if (!path) return false;
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (item: NavItem) => {
    if (item.action === "more-menu") {
      onOpenSidebar();
    } else if (item.id === "account" && !user) {
      navigate("/auth");
    } else if (item.href) {
      navigate(item.href);
    }
  };

  return (
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
  );
}
