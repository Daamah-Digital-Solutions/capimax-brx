import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  User,
  Phone,
  ArrowRight,
  ArrowLeft,
  Landmark,
  CheckCircle2,
  Shield,
  Building2,
  Banknote,
  HardHat,
  Handshake
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

type AuthMode = "login" | "register";
type UserRole = "investor" | "owner" | "broker" | "lp" | "developer" | "partner";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signUp, signIn, signInWithGoogle, signInWithApple } = useAuth();
  const { t, isRTL, language } = useLanguage();
  const urlMode = searchParams.get("mode") === "register" ? "register" : "login";
  const urlRole = (searchParams.get("role") as UserRole | null) ?? null;
  // Broker referral code (Phase 12 Wave A): from ?ref= on this URL, or stashed by the
  // /ref/<code> landing route in localStorage. Carried through signup → linked set-once.
  const referralCode =
    searchParams.get("ref") ||
    (typeof window !== "undefined" ? localStorage.getItem("capimax_ref") : null) ||
    undefined;
  const [mode, setMode] = useState<AuthMode>(urlMode);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(urlRole ?? "investor");
  const [isLoading, setIsLoading] = useState(false);

  const [isUSCitizen, setIsUSCitizen] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    phone: "",
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "register") {
        if (formData.password !== formData.confirmPassword) {
          toast({
            title: language === "ar" ? "خطأ" : "Error",
            description: language === "ar" ? "كلمات المرور غير متطابقة" : "Passwords do not match",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        if (formData.password.length < 6) {
          toast({
            title: language === "ar" ? "خطأ" : "Error",
            description: language === "ar" ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // Role policy (frontend = source of truth): forward the user's selected
        // role. The backend validates it (rejects 'admin'/unknown) and gates
        // privileged roles behind verification, so this is safe. See DECISIONS.md.
        const { error } = await signUp(formData.email, formData.password, {
          full_name: formData.fullName,
          phone: formData.phone,
          is_us_citizen: isUSCitizen,
          role: selectedRole,
          ref: referralCode,
        });

        if (error) {
          let errorMessage = error.message;
          if (error.message.includes("already registered")) {
            errorMessage = language === "ar" ? "هذا البريد الإلكتروني مسجل بالفعل" : "This email is already registered";
          }
          toast({
            title: language === "ar" ? "خطأ في التسجيل" : "Registration Error",
            description: errorMessage,
            variant: "destructive",
          });
        } else {
          // Referral code consumed at registration; clear the stash so it can't leak
          // into a later, unrelated signup on the same browser.
          if (typeof window !== "undefined") localStorage.removeItem("capimax_ref");
          // Show email verification message
          setShowVerificationMessage(true);
          toast({
            title: language === "ar" ? "تم إنشاء الحساب" : "Account Created",
            description: language === "ar" 
              ? "تم إرسال رابط التحقق إلى بريدك الإلكتروني. يرجى التحقق من بريدك لتفعيل حسابك."
              : "A verification link has been sent to your email. Please check your inbox to activate your account.",
          });
        }
      } else {
        const { error } = await signIn(formData.email, formData.password);

        if (error) {
          let errorMessage = error.message;
          if (error.message.includes("Invalid login credentials")) {
            errorMessage = language === "ar" ? "بيانات الدخول غير صحيحة" : "Invalid email or password";
          }
          toast({
            title: language === "ar" ? "خطأ في تسجيل الدخول" : "Login Error",
            description: errorMessage,
            variant: "destructive",
          });
        } else {
          toast({
            title: language === "ar" ? "تم تسجيل الدخول بنجاح" : "Logged in successfully",
            description: language === "ar" ? "مرحباً بعودتك!" : "Welcome back!",
          });
          navigate("/dashboard");
        }
      }
    } catch (error) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "حدث خطأ غير متوقع" : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const roles = [
    { 
      id: "investor" as const, 
      icon: User, 
      label: language === "ar" ? "مستثمر" : "Investor", 
      description: language === "ar" ? "استثمر في العقارات" : "Invest in properties" 
    },
    { 
      id: "owner" as const, 
      icon: Building2, 
      label: language === "ar" ? "مالك عقار" : "Property Owner", 
      description: language === "ar" ? "أدرج عقارك" : "List your property" 
    },
    { 
      id: "broker" as const, 
      icon: Shield, 
      label: language === "ar" ? "وسيط" : "Broker", 
      description: language === "ar" ? "احصل على عمولات" : "Earn commissions" 
    },
    { 
      id: "lp" as const, 
      icon: Banknote, 
      label: language === "ar" ? "مزود سيولة" : "Liquidity Provider", 
      description: language === "ar" ? "وفر السيولة" : "Provide liquidity" 
    },
    { 
      id: "developer" as const, 
      icon: HardHat, 
      label: language === "ar" ? "مطور" : "Developer", 
      description: language === "ar" ? "طور المشاريع" : "Develop projects" 
    },
    { 
      id: "partner" as const, 
      icon: Handshake, 
      label: language === "ar" ? "شريك" : "Partner", 
      description: language === "ar" ? "انضم كشريك" : "Join as partner" 
    },
  ];

  const features = language === "ar" ? [
    "ملكية جزئية تبدأ من 1,000 دولار",
    "شفافية كاملة مع تقنية البلوكتشين",
    "عوائد دورية مباشرة إلى محفظتك",
    "سوق ثانوي للسيولة المحسنة",
  ] : [
    "Fractional ownership starting from $1,000",
    "Complete transparency with blockchain",
    "Regular returns directly to your wallet",
    "Secondary market for enhanced liquidity",
  ];

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className={cn("min-h-screen bg-background flex", isRTL && "flex-row-reverse")} dir={isRTL ? "rtl" : "ltr"}>
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        
        <div className="relative z-10 flex flex-col justify-between p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
              <Landmark className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Capimax BRX</h1>
              <p className="text-sm text-muted-foreground">Real Estate Tokenization</p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-8">
            <div>
              <h2 className="font-display text-4xl font-bold text-foreground mb-4">
                {language === "ar" ? "استثمر في المستقبل" : "Invest in the Future"}
                <span className="block text-gradient-gold">
                  {language === "ar" ? "بطريقة ذكية" : "Smart Way"}
                </span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-md">
                {language === "ar" 
                  ? "انضم إلى آلاف المستثمرين الذين يملكون حصصاً في أفضل العقارات الاستثمارية"
                  : "Join thousands of investors who own shares in premium investment properties"}
              </p>
            </div>

            <div className="space-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trust */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span>{language === "ar" ? "آمن ومشفر" : "Secure & Encrypted"}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>{language === "ar" ? "مرخص ومنظم" : "Licensed & Regulated"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
              <Landmark className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-foreground">Capimax BRX</span>
          </div>

          {/* Email Verification Message */}
          {showVerificationMessage ? (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-success" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                  {language === "ar" ? "تحقق من بريدك الإلكتروني" : "Check Your Email"}
                </h2>
                <p className="text-muted-foreground">
                  {language === "ar" 
                    ? `لقد أرسلنا رابط تحقق إلى ${formData.email}. يرجى النقر على الرابط لتفعيل حسابك.`
                    : `We've sent a verification link to ${formData.email}. Please click the link to activate your account.`}
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setShowVerificationMessage(false);
                    setMode("login");
                  }}
                >
                  {language === "ar" ? "العودة لتسجيل الدخول" : "Back to Login"}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" 
                    ? "لم تستلم البريد؟ تحقق من مجلد الرسائل غير المرغوب فيها"
                    : "Didn't receive the email? Check your spam folder"}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center">
                <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                  {mode === "login" ? t("auth.login") : t("auth.signup")}
                </h2>
                <p className="text-muted-foreground">
                  {mode === "login" 
                    ? (language === "ar" ? "أدخل بياناتك للوصول إلى حسابك" : "Enter your credentials to access your account")
                    : (language === "ar" ? "انضم إلى منصتنا الاستثمارية" : "Join our investment platform")}
                </p>
              </div>

          {/* Mode Toggle */}
          <div className="flex p-1 bg-muted rounded-lg">
            <button
              onClick={() => setMode("login")}
              className={cn(
                "flex-1 py-2.5 rounded-md text-sm font-medium transition-colors",
                mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {t("auth.login")}
            </button>
            <button
              onClick={() => navigate("/register")}
              className={cn(
                "flex-1 py-2.5 rounded-md text-sm font-medium transition-colors",
                mode === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {t("auth.signup")}
            </button>
          </div>

          {/* Selected Role Pill (Register only — role chosen on /register screen) */}
          {mode === "register" && (() => {
            const role = roles.find((r) => r.id === selectedRole) ?? roles[0];
            const Icon = role.icon;
            return (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {language === "ar" ? "الدور المختار" : "Selected role"}
                    </div>
                    <div className="text-sm font-semibold text-foreground">{role.label}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {language === "ar" ? "تغيير" : "Change"}
                </button>
              </div>
            );
          })()}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {language === "ar" ? "الاسم الكامل" : "Full Name"}
                </label>
                <div className="relative">
                  <User className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
                  <input
                    type="text"
                    placeholder={language === "ar" ? "أدخل اسمك الكامل" : "Enter your full name"}
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className={cn("w-full h-12 bg-muted rounded-lg outline-none focus:ring-2 focus:ring-primary/50", isRTL ? "pr-11 pl-4" : "pl-11 pr-4")}
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t("auth.email")}</label>
              <div className="relative">
                <Mail className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={cn("w-full h-12 bg-muted rounded-lg outline-none focus:ring-2 focus:ring-primary/50", isRTL ? "pr-11 pl-4" : "pl-11 pr-4")}
                  required
                />
              </div>
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {language === "ar" ? "رقم الهاتف" : "Phone Number"}
                </label>
                <div className="relative">
                  <Phone className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
                  <input
                    type="tel"
                    placeholder="+971 50 000 0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={cn("w-full h-12 bg-muted rounded-lg outline-none focus:ring-2 focus:ring-primary/50", isRTL ? "pr-11 pl-4" : "pl-11 pr-4")}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{t("auth.password")}</label>
              <div className="relative">
                <Lock className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={cn("w-full h-12 bg-muted rounded-lg outline-none focus:ring-2 focus:ring-primary/50", isRTL ? "pr-11 pl-11" : "pl-11 pr-11")}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn("absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground", isRTL ? "left-3" : "right-3")}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {language === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}
                </label>
                <div className="relative">
                  <Lock className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={cn("w-full h-12 bg-muted rounded-lg outline-none focus:ring-2 focus:ring-primary/50", isRTL ? "pr-11 pl-4" : "pl-11 pr-4")}
                    required
                  />
                </div>
              </div>
            )}

            {mode === "login" && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                  <span className="text-sm text-muted-foreground">
                    {language === "ar" ? "تذكرني" : "Remember me"}
                  </span>
                </label>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  {t("auth.forgotPassword")}
                </Link>
              </div>
            )}

            {mode === "register" && (
              <div className="space-y-4">
                {/* US Citizen Checkbox */}
                <label className="flex items-start gap-3 cursor-pointer p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <input 
                    type="checkbox" 
                    checked={isUSCitizen}
                    onChange={(e) => setIsUSCitizen(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-border text-primary focus:ring-primary" 
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {language === "ar" ? "أنا مواطن أمريكي أو مقيم ضريبي أمريكي" : "I am a US Citizen or US Tax Resident"}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === "ar" 
                        ? "يرجى التحديد إذا كنت مواطنًا أمريكيًا أو حامل بطاقة خضراء أو مقيمًا ضريبيًا أمريكيًا"
                        : "Please check if you are a US citizen, green card holder, or US tax resident"}
                    </p>
                  </div>
                </label>

                {/* Terms Checkbox */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 mt-0.5 rounded border-border text-primary focus:ring-primary" required />
                  <span className="text-sm text-muted-foreground">
                    {language === "ar" ? (
                      <>
                        أوافق على{" "}
                        <Link to="/terms" className="text-primary hover:underline">الشروط والأحكام</Link>
                        {" "}و{" "}
                        <Link to="/privacy" className="text-primary hover:underline">سياسة الخصوصية</Link>
                      </>
                    ) : (
                      <>
                        I agree to the{" "}
                        <Link to="/terms" className="text-primary hover:underline">Terms & Conditions</Link>
                        {" "}and{" "}
                        <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                      </>
                    )}
                  </span>
                </label>
              </div>
            )}

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {t("common.loading")}
                </span>
              ) : mode === "login" ? (
                <>
                  {t("auth.login")}
                  <ArrowIcon className="w-5 h-5" />
                </>
              ) : (
                <>
                  {t("auth.signup")}
                  <ArrowIcon className="w-5 h-5" />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-background text-muted-foreground">{t("common.or")}</span>
            </div>
          </div>

          {/* Social Login */}
          <div className="space-y-3">
            <Button 
              variant="outline" 
              className="h-12 w-full"
              onClick={async () => {
                setIsLoading(true);
                const { error } = await signInWithGoogle();
                if (error) {
                  toast({
                    title: language === "ar" ? "خطأ" : "Error",
                    description: error.message,
                    variant: "destructive",
                  });
                }
                setIsLoading(false);
              }}
              disabled={isLoading}
            >
              <svg className={cn("w-5 h-5", isRTL ? "ml-2" : "mr-2")} viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {language === "ar" ? "المتابعة مع Google" : "Continue with Google"}
            </Button>
            <Button 
              variant="outline" 
              className="h-12 w-full"
              onClick={async () => {
                setIsLoading(true);
                const { error } = await signInWithApple();
                if (error) {
                  toast({
                    title: language === "ar" ? "خطأ" : "Error",
                    description: error.message,
                    variant: "destructive",
                  });
                }
                setIsLoading(false);
              }}
              disabled={isLoading}
            >
              <svg className={cn("w-5 h-5", isRTL ? "ml-2" : "mr-2")} fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              {language === "ar" ? "المتابعة مع Apple" : "Continue with Apple"}
            </Button>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" 
              ? (language === "ar" ? "ليس لديك حساب؟ " : "Don't have an account? ")
              : (language === "ar" ? "لديك حساب بالفعل؟ " : "Already have an account? ")}
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-primary hover:underline font-medium"
            >
              {mode === "login" 
                ? (language === "ar" ? "سجل الآن" : "Sign up now")
                : (language === "ar" ? "تسجيل الدخول" : "Login")}
            </button>
          </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
