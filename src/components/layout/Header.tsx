import { Bell, Search, Menu, Globe, LogOut, User, Home, Sun, Moon } from "lucide-react";
import { isDarkNow, onThemeChange, setThemeMode } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const { user, signOut } = useAuth();
  const { unreadCount } = useUnreadCount();
  const navigate = useNavigate();
  // Shared with Settings › Appearance (src/lib/theme.ts); the toggle picks light/dark.
  const [isDark, setIsDark] = useState(isDarkNow);
  useEffect(() => onThemeChange(({ dark }) => setIsDark(dark)), []);
  const toggleTheme = () => setThemeMode(isDark ? "light" : "dark");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="h-full flex items-center justify-between px-4 lg:px-6">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuToggle}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex"
            onClick={onMenuToggle}
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Platform Logo — official Capimax BRX wordmark (navy on light, white on dark) */}
          <Link to="/" className="flex items-center">
            <img
              src="/capimax-brx-logo-dark.svg"
              alt="Capimax BRX"
              className="h-8 sm:h-9 w-auto dark:hidden"
            />
            <img
              src="/capimax-brx-logo-light.svg"
              alt="Capimax BRX"
              className="h-8 sm:h-9 w-auto hidden dark:block"
            />
          </Link>
          
          {/* Search */}
          <div className="hidden md:flex items-center gap-2 bg-muted rounded-lg px-3 py-2 w-64">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("header.search")}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Install app — persistent, available any time (self-hides once installed) */}
          <InstallAppButton variant="gold-outline" className="hidden sm:inline-flex" />

          {/* Theme Toggle (signed-out phones hide it to make room for Login + Get started) */}
          <Button 
            variant="ghost" 
            size="icon" 
            className={user ? undefined : "hidden sm:inline-flex"}
            onClick={toggleTheme}
            title={isDark ? (language === "ar" ? "الوضع الفاتح" : "Light mode") : (language === "ar" ? "الوضع الداكن" : "Dark mode")}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

          {/* Language Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Globe className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setLanguage("en")}
                className={language === "en" ? "bg-accent" : ""}
              >
                🇺🇸 English
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLanguage("ar")}
                className={language === "ar" ? "bg-accent" : ""}
              >
                🇸🇦 العربية
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLanguage("fr")}
                className={language === "fr" ? "bg-accent" : ""}
              >
                🇫🇷 Français
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLanguage("es")}
                className={language === "es" ? "bg-accent" : ""}
              >
                🇪🇸 Español
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLanguage("zh")}
                className={language === "zh" ? "bg-accent" : ""}
              >
                🇨🇳 中文
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLanguage("de")}
                className={language === "de" ? "bg-accent" : ""}
              >
                🇩🇪 Deutsch
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLanguage("pt")}
                className={language === "pt" ? "bg-accent" : ""}
              >
                🇧🇷 Português
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setLanguage("ru")}
                className={language === "ru" ? "bg-accent" : ""}
              >
                🇷🇺 Русский
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => navigate("/notifications")}
            aria-label={t("notifications.title")}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>

          {/* Auth Actions */}
          <div className="flex items-center gap-2 ms-1 sm:ms-2">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="relative rounded-full border-primary/40"
                    aria-label={language === "ar" ? "الحساب" : "Account"}
                  >
                    <User className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-muted-foreground text-sm">
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/settings?tab=profile")}>
                    <User className="w-4 h-4 me-2" />
                    {language === "ar" ? "الحساب" : "Account"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    {t("nav.dashboard")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/kyc")}>
                    {language === "ar" ? "توثيق الهوية (KYC)" : "Identity verification (KYC)"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings?tab=preferences")}>
                    {t("nav.settings")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    {t("auth.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="gold-outline" size="sm" asChild>
                  <Link to="/auth">{t("auth.login")}</Link>
                </Button>
                <Button variant="hero" size="sm" asChild>
                  <Link to="/auth?mode=register">
                    <span className="sm:hidden">{language === "ar" ? "ابدأ الآن" : "Get started"}</span>
                    <span className="hidden sm:inline">{language === "ar" ? "سجّل الآن" : "Register Now"}</span>
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
