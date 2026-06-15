import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Phone, Mail, MessageCircle, Calendar, Headphones } from "lucide-react";

interface LPAccountManagerProps {
  isRTL?: boolean;
}

export function LPAccountManager({ isRTL = false }: LPAccountManagerProps) {
  // Account Manager details - could be fetched from backend in production
  const accountManager = {
    name: "Michael Anderson",
    nameAr: "مايكل أندرسون",
    title: "Senior Account Manager",
    titleAr: "مدير حساب أول",
    phone: "+971 4 123 4567",
    mobile: "+971 50 123 4567",
    email: "michael.anderson@capimax.com",
    availability: "Sun - Thu, 9:00 AM - 6:00 PM (GST)",
    availabilityAr: "الأحد - الخميس، 9:00 ص - 6:00 م (بتوقيت الخليج)",
    avatarUrl: "",
  };

  const handleEmailClick = () => {
    window.location.href = `mailto:${accountManager.email}?subject=Liquidity Provider Inquiry`;
  };

  const handlePhoneClick = () => {
    window.location.href = `tel:${accountManager.mobile}`;
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Headphones className="w-5 h-5 text-primary" />
            {isRTL ? "مدير حسابك المخصص" : "Your Dedicated Account Manager"}
          </CardTitle>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
            {isRTL ? "متاح" : "Available"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Manager Profile */}
        <div className="flex items-start gap-4">
          <Avatar className="w-16 h-16 border-2 border-primary/20">
            <AvatarImage src={accountManager.avatarUrl} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
              {accountManager.name.split(" ").map(n => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-lg">
              {isRTL ? accountManager.nameAr : accountManager.name}
            </h3>
            <p className="text-muted-foreground text-sm">
              {isRTL ? accountManager.titleAr : accountManager.title}
            </p>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              {isRTL ? accountManager.availabilityAr : accountManager.availability}
            </div>
          </div>
        </div>

        {/* Contact Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">
                {isRTL ? "هاتف المكتب" : "Office Phone"}
              </p>
              <p className="font-medium text-foreground" dir="ltr">{accountManager.phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">
                {isRTL ? "الجوال / واتساب" : "Mobile / WhatsApp"}
              </p>
              <p className="font-medium text-foreground" dir="ltr">{accountManager.mobile}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">
                {isRTL ? "البريد الإلكتروني" : "Email Address"}
              </p>
              <p className="font-medium text-foreground text-sm break-all">{accountManager.email}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Button onClick={handlePhoneClick} variant="outline" className="flex-1">
            <Phone className="w-4 h-4 mr-2" />
            {isRTL ? "اتصال" : "Call"}
          </Button>
          <Button onClick={handleEmailClick} className="flex-1">
            <Mail className="w-4 h-4 mr-2" />
            {isRTL ? "إرسال بريد" : "Email"}
          </Button>
        </div>

        {/* Support Note */}
        <p className="text-xs text-center text-muted-foreground">
          {isRTL
            ? "مدير حسابك متاح لمساعدتك في أي استفسارات تتعلق باستثماراتك"
            : "Your account manager is available to assist you with any questions regarding your investments"}
        </p>
      </CardContent>
    </Card>
  );
}
