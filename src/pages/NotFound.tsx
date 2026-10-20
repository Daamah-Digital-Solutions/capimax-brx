import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted" dir={isAr ? "rtl" : "ltr"}>
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">{isAr ? "عذراً! الصفحة غير موجودة" : "Oops! Page not found"}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {isAr ? "العودة للرئيسية" : "Return to Home"}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
