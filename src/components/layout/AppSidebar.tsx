import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  LayoutDashboard,
  Building2,
  Briefcase,
  Calendar,
  DollarSign,
  TrendingUp,
  BarChart3,
  Wallet,
  FileText,
  Bell,
  HelpCircle,
  Users,
  Send,
  MessageSquare,
  Settings,
  Info,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  CreditCard,
  X,
  Landmark,
  Building,
  PieChart,
  Award,
  Store,
  Coins,
  UsersRound,
  Handshake,
  UserCircle,
  LogOut,
  RefreshCw,
  Scale,
  FileCheck,
  Package,
  Layers,
  Clock,
  KeyRound,
  Users2,
  HardHat,
  ArrowRightLeft,
  Newspaper,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserRole = "guest" | "investor" | "owner" | "liquidity_provider" | "broker" | "partner";

interface MenuItem {
  titleKey: string;
  icon: React.ElementType;
  href: string;
  badge?: string;
  roles?: UserRole[]; // If undefined, visible to all
}

interface MenuSection {
  titleKey: string;
  sectionId: string;
  items: MenuItem[];
  icon?: React.ElementType;
  color?: string;
  roles?: UserRole[]; // If undefined, visible to all
}

const roleLabels: Record<UserRole, { en: string; ar: string }> = {
  guest: { en: "Guest", ar: "زائر" },
  investor: { en: "Investor", ar: "مستثمر" },
  owner: { en: "Owner / Developer", ar: "مالك / مطور" },
  liquidity_provider: { en: "Liquidity Provider", ar: "مزود السيولة" },
  broker: { en: "Broker", ar: "وسيط" },
  partner: { en: "Partner", ar: "شريك" },
};

// Public items that are always visible to all roles
const publicItems: MenuItem[] = [
  { titleKey: "nav.marketplace", icon: Store, href: "/marketplace" },
  // BRX Cards — visible to ALL roles (mirrors the pre-f8add09 standalone all-roles
  // section). Lives here, not in a role section, so it isn't hidden by the "View as
  // role" selector defaulting to Guest.
  { titleKey: "BRX Cards", icon: CreditCard, href: "/cards", badge: "NEW" },
  { titleKey: "nav.secondaryMarket", icon: TrendingUp, href: "/secondary-market" },
  { titleKey: "nav.fundedProperties", icon: Award, href: "/funded-properties" },
  { titleKey: "nav.publicAnalytics", icon: BarChart3, href: "/public-analytics" },
  { titleKey: "nav.publicReports", icon: FileText, href: "/public-reports" },
  { titleKey: "nav.liquidityProvider", icon: Coins, href: "/liquidity-provider" },
  { titleKey: "nav.partners", icon: Handshake, href: "/partners" },
  { titleKey: "Why Capimax BRX", icon: Sparkles, href: "/#why-capimax-brx" },
];

const menuSections: MenuSection[] = [
  {
    titleKey: "section.investor",
    sectionId: "investor",
    icon: Briefcase,
    color: "text-blue-500",
    roles: ["investor"],
    items: [
      { titleKey: "nav.dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { titleKey: "nav.portfolio", icon: Briefcase, href: "/portfolio" },
      { titleKey: "Re Investment", icon: RefreshCw, href: "/reinvestment" },
      { titleKey: "nav.familyInvestment", icon: UsersRound, href: "/family-investment" },
      { titleKey: "nav.installments", icon: Calendar, href: "/installments", badge: "3" },
      { titleKey: "nav.distributions", icon: DollarSign, href: "/distributions" },
      { titleKey: "nav.reports", icon: BarChart3, href: "/reports" },
      { titleKey: "nav.wallet", icon: Wallet, href: "/wallet" },
      { titleKey: "nav.lpMarket", icon: Store, href: "/lp-market" },
      { titleKey: "nav.secondaryMarket", icon: TrendingUp, href: "/secondary-market" },
      { titleKey: "Live Exits Hub", icon: ArrowRightLeft, href: "/exits-hub" },
      { titleKey: "nav.documents", icon: FileText, href: "/documents" },
      { titleKey: "nav.notifications", icon: Bell, href: "/notifications" },
      { titleKey: "nav.support", icon: HelpCircle, href: "/support" },
    ],
  },
  {
    titleKey: "section.owner",
    sectionId: "owner",
    icon: Building,
    color: "text-emerald-500",
    roles: ["owner"],
    items: [
      { titleKey: "nav.myAssets", icon: Building, href: "/my-assets" },
      { titleKey: "nav.submitProperty", icon: Send, href: "/submit-property" },
      { titleKey: "nav.assetValidation", icon: PieChart, href: "/asset-validation" },
      { titleKey: "nav.ownerWallet", icon: Wallet, href: "/owner-wallet" },
      { titleKey: "nav.ownerReports", icon: FileText, href: "/owner-reports" },
      { titleKey: "nav.ownerDocuments", icon: FileText, href: "/owner-documents" },
      { titleKey: "nav.messages", icon: MessageSquare, href: "/messages" },
    ],
  },
  {
    titleKey: "section.broker",
    sectionId: "broker",
    icon: Users,
    color: "text-amber-500",
    roles: ["broker"],
    items: [
      { titleKey: "nav.listings", icon: Building2, href: "/listings" },
      { titleKey: "nav.referrals", icon: Users, href: "/referrals" },
      { titleKey: "nav.commissions", icon: Award, href: "/commissions" },
      { titleKey: "nav.brokerReports", icon: BarChart3, href: "/broker-reports" },
    ],
  },
  {
    titleKey: "section.liquidityProvider",
    sectionId: "liquidity_provider",
    icon: Coins,
    color: "text-cyan-500",
    roles: ["liquidity_provider"],
    items: [
      { titleKey: "nav.lpDashboard", icon: LayoutDashboard, href: "/liquidity-provider" },
      { titleKey: "nav.lpMarket", icon: Store, href: "/lp-market" },
      { titleKey: "nav.lpOperations", icon: TrendingUp, href: "/liquidity-provider#operations" },
      { titleKey: "nav.lpReports", icon: BarChart3, href: "/liquidity-provider#reports" },
      { titleKey: "nav.lpWithdrawals", icon: Wallet, href: "/liquidity-provider#withdrawals" },
    ],
  },
  {
    // Service partner (NON-EARNING vendor) — its real work portal is /strategic-partners
    // (KYB + assignments/deliverables/documents/activity). The public directory at
    // /partners is also surfaced in the always-visible Public section.
    titleKey: "section.partner",
    sectionId: "partner",
    icon: Handshake,
    color: "text-rose-500",
    roles: ["partner"],
    items: [
      { titleKey: "nav.partnerDashboard", icon: LayoutDashboard, href: "/strategic-partners" },
      { titleKey: "nav.partnerDirectory", icon: Handshake, href: "/partners" },
    ],
  },
  {
    titleKey: "section.platform",
    sectionId: "platform",
    icon: Landmark,
    color: "text-purple-500",
    items: [
      { titleKey: "nav.about", icon: Landmark, href: "/about" },
      { titleKey: "nav.howItWorks", icon: Info, href: "/how-it-works" },
      { titleKey: "Institutional", icon: Building, href: "/institutional" },
      { titleKey: "Developers / API", icon: FileCheck, href: "/developers" },
      { titleKey: "Investor Relations", icon: Newspaper, href: "/investor-relations" },
      { titleKey: "nav.fees", icon: DollarSign, href: "/fees" },
      { titleKey: "nav.exitMechanism", icon: LogOut, href: "/exit-mechanism" },
      { titleKey: "nav.settings", icon: Settings, href: "/settings" },
      { titleKey: "Security & Audit Log", icon: ShieldCheck, href: "/audit-log" },
    ],
  },
  {
    titleKey: "section.legal",
    sectionId: "legal",
    icon: ShieldCheck,
    color: "text-slate-500",
    items: [
      { titleKey: "FAQ", icon: HelpCircle, href: "/faq" },
      { titleKey: "Regulation", icon: Scale, href: "/regulation" },
      { titleKey: "Compliance", icon: FileCheck, href: "/compliance" },
      { titleKey: "nav.privacyPolicy", icon: ShieldCheck, href: "/privacy-policy" },
      { titleKey: "nav.termsConditions", icon: FileText, href: "/terms-conditions" },
      { titleKey: "nav.disclaimer", icon: Info, href: "/disclaimer" },
      { titleKey: "nav.platformRules", icon: ShieldCheck, href: "/platform-rules" },
    ],
  },
];

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

// Helper to detect role from current path
const detectRoleFromPath = (pathname: string): UserRole | null => {
  const investorPaths = ['/dashboard', '/portfolio', '/family-investment', '/installments', '/distributions', '/reports', '/wallet', '/documents', '/notifications', '/support'];
  const ownerPaths = ['/my-assets', '/submit-property', '/asset-validation', '/owner-wallet', '/owner-reports', '/owner-documents', '/messages'];
  const brokerPaths = ['/listings', '/referrals', '/commissions', '/broker-reports'];
  // /partners is the PUBLIC directory (visible to all) — only the partner WORK PORTAL
  // identifies the partner role.
  const partnerPaths = ['/strategic-partners'];

  if (investorPaths.some(p => pathname.startsWith(p))) return 'investor';
  if (ownerPaths.some(p => pathname.startsWith(p))) return 'owner';
  if (brokerPaths.some(p => pathname.startsWith(p))) return 'broker';
  if (partnerPaths.some(p => pathname.startsWith(p))) return 'partner';
  if (pathname === '/liquidity-provider' && pathname.includes('#')) return 'liquidity_provider';

  return null;
};

// Map the authenticated user's profile role to a sidebar role. `developer` shares the
// Owner/Developer section; `admin` gets a functional (investor) view; unknown/none => guest.
const roleFromProfile = (profileRole?: string): UserRole => {
  switch (profileRole) {
    case "investor": return "investor";
    case "owner": return "owner";
    case "developer": return "owner";
    case "lp": return "liquidity_provider";
    case "broker": return "broker";
    case "partner": return "partner";
    case "admin": return "investor";
    default: return "guest";
  }
};

export function AppSidebar({ isOpen, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const { t, language } = useLanguage();
  const { unreadCount } = useUnreadCount();
  const { user } = useAuth();
  const [expandedSections, setExpandedSections] = useState<string[]>(["investor", "owner", "liquidity_provider", "broker", "partner", "public", "products", "products-uc", "platform", "legal"]);
  
  // Initialize role from localStorage or detect from current path
  const [selectedRole, setSelectedRole] = useState<UserRole>(() => {
    const savedRole = localStorage.getItem('capimax_sidebar_role');
    if (savedRole && Object.keys(roleLabels).includes(savedRole)) {
      return savedRole as UserRole;
    }
    // Try to detect role from current path on initial load
    const detectedRole = detectRoleFromPath(window.location.pathname);
    return detectedRole || 'guest';
  });

  // Persist role selection to localStorage
  useEffect(() => {
    localStorage.setItem('capimax_sidebar_role', selectedRole);
  }, [selectedRole]);

  // Default the sidebar to the LOGGED-IN user's role so their real nav shows immediately
  // (no manual selector step). Runs once per logged-in user; manual switching still works
  // afterward, and a fresh login (new user id) re-syncs to that user's role.
  const [roleSyncedFor, setRoleSyncedFor] = useState<string | null>(null);
  useEffect(() => {
    if (user?.id) {
      if (user.id !== roleSyncedFor) {
        setSelectedRole(roleFromProfile(user.profile?.role));
        setRoleSyncedFor(user.id);
      }
    } else if (roleSyncedFor !== null) {
      setRoleSyncedFor(null); // logged out → allow re-sync on next login
    }
  }, [user, roleSyncedFor]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((r) => r !== sectionId) : [...prev, sectionId]
    );
  };

  const isActive = (href: string) => location.pathname === href;

  // Get role-specific sections (excluding platform and legal)
  const roleSpecificSections = menuSections.filter((section) => {
    if (section.sectionId === "platform" || section.sectionId === "legal") return false;
    if (!section.roles) return false;
    return section.roles.includes(selectedRole);
  });

  // Get platform and legal sections
  const platformSection = menuSections.find((section) => section.sectionId === "platform");
  const legalSection = menuSections.find((section) => section.sectionId === "legal");

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 z-50 h-full bg-sidebar border-border transition-all duration-300 flex flex-col",
          language === "ar" ? "right-0 border-l" : "left-0 border-r",
          isOpen ? "w-72" : "w-0 lg:w-16"
        )}
      >
        {/* Logo Section */}
        <div className={cn(
          "flex items-center h-16 px-4 border-b border-sidebar-border shrink-0",
          !isOpen && "lg:justify-center"
        )}>
          {isOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                <Landmark className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold text-foreground">Capimax BRX</h1>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "توكين العقارات" : "Real Estate Tokenization"}
                </p>
              </div>
            </div>
          ) : (
            <div className="hidden lg:flex w-10 h-10 bg-gradient-gold rounded-xl items-center justify-center shadow-gold">
              <Landmark className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("lg:hidden", language === "ar" ? "mr-auto" : "ml-auto")}
            onClick={onToggle}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Role Selector */}
        {isOpen && (
          <div className="px-3 py-3 border-b border-sidebar-border">
            <div className="flex items-center gap-2 mb-2">
              <UserCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {language === "ar" ? "عرض حسب الدور" : "View as Role"}
              </span>
            </div>
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(roleLabels) as UserRole[]).map((role) => (
                  <SelectItem key={role} value={role}>
                    {language === "ar" ? roleLabels[role].ar : roleLabels[role].en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Navigation */}
        <nav className={cn(
          "flex-1 overflow-y-auto py-4",
          !isOpen && "hidden lg:block"
        )}>
          {/* 1. ROLE-SPECIFIC SECTIONS (First - Primary) */}
          {roleSpecificSections.map((section) => (
            <div key={section.sectionId} className="mb-2">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.sectionId)}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-200 border-l-4",
                  expandedSections.includes(section.sectionId) 
                    ? "bg-sidebar-accent/50 border-primary text-foreground" 
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30",
                  !isOpen && "lg:hidden"
                )}
              >
                {section.icon && <section.icon className={cn("w-4 h-4", section.color)} />}
                {expandedSections.includes(section.sectionId) ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span>{t(section.titleKey)}</span>
              </button>

              {/* Section Items */}
              {(expandedSections.includes(section.sectionId) || !isOpen) && (
                <ul className="mt-1 space-y-1 px-2">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        to={item.href}
                        className={({ isActive: active }) =>
                          cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                            active || isActive(item.href)
                              ? "bg-sidebar-accent text-sidebar-primary"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                            !isOpen && "lg:justify-center lg:px-0"
                          )
                        }
                        title={!isOpen ? t(item.titleKey) : undefined}
                      >
                        <item.icon className={cn("w-5 h-5 shrink-0", isActive(item.href) && "text-primary")} />
                        {isOpen && (
                          <>
                            <span className="flex-1">{t(item.titleKey)}</span>
                            {item.href === "/notifications" ? (
                              unreadCount > 0 && (
                                <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                                  {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                              )
                            ) : (
                              item.badge && (
                                <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                                  {item.badge}
                                </span>
                              )
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {/* 2. PUBLIC SECTION (Secondary - visible to all roles) */}
          <div className="mb-2">
            {/* Public Section Header */}
            <button
              onClick={() => toggleSection("public")}
              className={cn(
                "w-full flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-200 border-l-4",
                expandedSections.includes("public") 
                  ? "bg-sidebar-accent/50 border-primary text-foreground" 
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30",
                !isOpen && "lg:hidden"
              )}
            >
              <Store className="w-4 h-4 text-green-500" />
              {expandedSections.includes("public") ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>{language === "ar" ? "عام" : "Public"}</span>
            </button>

            {/* Public Items */}
            {(expandedSections.includes("public") || !isOpen) && (
              <ul className="mt-1 space-y-1 px-2">
                {/* Home Link */}
                <li>
                  <NavLink
                    to="/"
                    className={({ isActive: active }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                        active
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                        !isOpen && "lg:justify-center lg:px-0"
                      )
                    }
                    title={!isOpen ? t("nav.home") : undefined}
                  >
                    <Home className={cn("w-5 h-5 shrink-0", location.pathname === "/" && "text-primary")} />
                    {isOpen && <span className="flex-1">{t("nav.home")}</span>}
                  </NavLink>
                </li>
                {publicItems.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      to={item.href}
                      className={({ isActive: active }) =>
                        cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-sidebar-accent text-sidebar-primary"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                          !isOpen && "lg:justify-center lg:px-0"
                        )
                      }
                      title={!isOpen ? t(item.titleKey) : undefined}
                    >
                      <item.icon className={cn("w-5 h-5 shrink-0", isActive(item.href) && "text-primary")} />
                      {isOpen && <span className="flex-1">{t(item.titleKey)}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* PRODUCTS SECTION */}
          {(() => {
            const productGroups: { id: string; labelEn: string; labelAr: string; icon: React.ElementType; items: { slug: string; labelEn: string; labelAr: string; icon: React.ElementType }[] }[] = [
              {
                id: "products-ready",
                labelEn: "Ready Properties",
                labelAr: "عقارات جاهزة",
                icon: Building,
                items: [
                  { slug: "ready-yield", labelEn: "Ready with Yield", labelAr: "جاهزة مدرّة للعائد", icon: Building2 },
                ],
              },
              {
                id: "products-uc",
                labelEn: "Under Construction",
                labelAr: "قيد الإنشاء",
                icon: HardHat,
                items: [
                  { slug: "installment", labelEn: "Installment", labelAr: "بالتقسيط", icon: Calendar },
                  { slug: "phasing", labelEn: "Phasing Model", labelAr: "نموذج المراحل", icon: Layers },
                  { slug: "future", labelEn: "Future Model", labelAr: "النموذج الآجل", icon: Clock },
                  { slug: "option", labelEn: "Option Model", labelAr: "نموذج الخيار", icon: KeyRound },
                  { slug: "shared", labelEn: "Shared with Owner", labelAr: "مشتركة مع المالك", icon: Users2 },
                ],
              },
              {
                id: "products-ready-portfolio",
                labelEn: "Ready Portfolios",
                labelAr: "محافظ جاهزة",
                icon: Briefcase,
                items: [
                  { slug: "portfolios-ready", labelEn: "Ready Property Portfolios", labelAr: "محافظ عقارات جاهزة", icon: Briefcase },
                ],
              },
              {
                id: "products-uc-portfolio",
                labelEn: "UC Portfolios",
                labelAr: "محافظ قيد الإنشاء",
                icon: HardHat,
                items: [
                  { slug: "portfolios-under-construction", labelEn: "UC Property Portfolios", labelAr: "محافظ عقارات قيد الإنشاء", icon: HardHat },
                ],
              },
            ];
            return (
              <div className="mb-2">
                <button
                  onClick={() => toggleSection("products")}
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-200 border-l-4",
                    expandedSections.includes("products")
                      ? "bg-sidebar-accent/50 border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30",
                    !isOpen && "lg:hidden"
                  )}
                >
                  <Package className="w-4 h-4 text-orange-500" />
                  {expandedSections.includes("products") ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span>{language === "ar" ? "المنتجات" : "Products"}</span>
                </button>

                {(expandedSections.includes("products") || !isOpen) && (
                  <div className="mt-1 space-y-2 px-2">
                    {productGroups.map((g) => (
                      <div key={g.id}>
                        {isOpen && (
                          <button
                            onClick={() => toggleSection(g.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30 transition-colors"
                          >
                            <g.icon className="w-3.5 h-3.5" />
                            {expandedSections.includes(g.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            <span className="flex-1 text-start">{language === "ar" ? g.labelAr : g.labelEn}</span>
                          </button>
                        )}
                        {(expandedSections.includes(g.id) || !isOpen) && (
                          <ul className="space-y-1">
                            {g.items.map((it) => (
                              <li key={it.slug}>
                                <NavLink
                                  to={`/products/${it.slug}`}
                                  className={({ isActive: active }) =>
                                    cn(
                                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                                      isOpen && (language === "ar" ? "mr-4" : "ml-4"),
                                      active
                                        ? "bg-sidebar-accent text-sidebar-primary"
                                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                                      !isOpen && "lg:justify-center lg:px-0"
                                    )
                                  }
                                  title={!isOpen ? (language === "ar" ? it.labelAr : it.labelEn) : undefined}
                                >
                                  <it.icon className="w-4 h-4 shrink-0" />
                                  {isOpen && <span className="flex-1">{language === "ar" ? it.labelAr : it.labelEn}</span>}
                                </NavLink>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 3. PLATFORM SECTION (Last) */}
          {platformSection && (
            <div className="mb-2">
              {/* Platform Section Header */}
              <button
                onClick={() => toggleSection(platformSection.sectionId)}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-200 border-l-4",
                  expandedSections.includes(platformSection.sectionId) 
                    ? "bg-sidebar-accent/50 border-primary text-foreground" 
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30",
                  !isOpen && "lg:hidden"
                )}
              >
                {platformSection.icon && <platformSection.icon className={cn("w-4 h-4", platformSection.color)} />}
                {expandedSections.includes(platformSection.sectionId) ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span>{t(platformSection.titleKey)}</span>
              </button>

              {/* Platform Items */}
              {(expandedSections.includes(platformSection.sectionId) || !isOpen) && (
                <ul className="mt-1 space-y-1 px-2">
                  {platformSection.items.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        to={item.href}
                        className={({ isActive: active }) =>
                          cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                            active || isActive(item.href)
                              ? "bg-sidebar-accent text-sidebar-primary"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                            !isOpen && "lg:justify-center lg:px-0"
                          )
                        }
                        title={!isOpen ? t(item.titleKey) : undefined}
                      >
                        <item.icon className={cn("w-5 h-5 shrink-0", isActive(item.href) && "text-primary")} />
                        {isOpen && <span className="flex-1">{t(item.titleKey)}</span>}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* 4. LEGAL SECTION (Collapsible - After Platform) */}
          {legalSection && (
            <div className="mb-2">
              {/* Legal Section Header */}
              <button
                onClick={() => toggleSection(legalSection.sectionId)}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-200 border-l-4",
                  expandedSections.includes(legalSection.sectionId) 
                    ? "bg-sidebar-accent/50 border-primary text-foreground" 
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30",
                  !isOpen && "lg:hidden"
                )}
              >
                {legalSection.icon && <legalSection.icon className={cn("w-4 h-4", legalSection.color)} />}
                {expandedSections.includes(legalSection.sectionId) ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span>{t(legalSection.titleKey)}</span>
              </button>

              {/* Legal Items */}
              {(expandedSections.includes(legalSection.sectionId) || !isOpen) && (
                <ul className="mt-1 space-y-1 px-2">
                  {legalSection.items.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        to={item.href}
                        className={({ isActive: active }) =>
                          cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                            active || isActive(item.href)
                              ? "bg-sidebar-accent text-sidebar-primary"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                            !isOpen && "lg:justify-center lg:px-0"
                          )
                        }
                        title={!isOpen ? t(item.titleKey) : undefined}
                      >
                        <item.icon className={cn("w-5 h-5 shrink-0", isActive(item.href) && "text-primary")} />
                        {isOpen && <span className="flex-1">{t(item.titleKey)}</span>}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </nav>

        {/* User Section */}
        <div className={cn(
          "border-t border-sidebar-border p-4 shrink-0",
          !isOpen && "hidden lg:flex lg:justify-center lg:p-2"
        )}>
          {isOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-gold flex items-center justify-center">
                <span className="text-sm font-bold text-primary-foreground">
                  {language === "ar" ? "م" : "M"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {language === "ar" ? "محمد أحمد" : "Mohamed Ahmed"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? roleLabels[selectedRole].ar : roleLabels[selectedRole].en}
                </p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-gold flex items-center justify-center">
              <span className="text-xs font-bold text-primary-foreground">
                {language === "ar" ? "م" : "M"}
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
