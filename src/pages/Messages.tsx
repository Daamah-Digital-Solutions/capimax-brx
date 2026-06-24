import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { MessageSquare, Bell, ChevronRight } from "lucide-react";

// Messages — an admin↔owner inbox. There is NO messaging/inbox backend yet (the same
// gap as the OwnerDashboard "Platform Messages" card), so this is an HONEST "Coming
// soon" placeholder, NOT a fake inbox. The nav item ([AppSidebar.tsx:138]) now lands
// here instead of falling through to NotFound. The notifications feed is the real,
// one-way activity surface today, so we point there.
export default function Messages() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
              {t("nav.messages")}
              <Badge variant="outline" className="text-[10px]">{t("support.comingSoon")}</Badge>
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAr ? "صندوق الرسائل بينك وبين المنصة" : "Your inbox with the platform"}
            </p>
          </div>
        </div>

        {/* Honest empty / Coming-soon state — no fake messages. */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="flex flex-col items-center justify-center text-center py-16 px-6">
            <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {isAr ? "لا توجد رسائل بعد" : "No messages yet"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              {isAr
                ? "ميزة المراسلة المباشرة مع المنصة قيد التطوير. حتى ذلك الحين، تابع الإشعارات لكل تحديثات حسابك وعقاراتك."
                : "Direct messaging with the platform is coming soon. In the meantime, check your Notifications for all activity on your account and properties."}
            </p>
            <Link to="/notifications" className="mt-6">
              <Button variant="outline" className="gap-2">
                <Bell className="w-4 h-4" />
                {isAr ? "عرض الإشعارات" : "View Notifications"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
