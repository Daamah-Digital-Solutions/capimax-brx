import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Phone, MessageCircle, Headphones, ArrowRight } from "lucide-react";

interface LPAccountManagerProps {
  isRTL?: boolean;
}

// The platform's REAL support contact (mirrors the /support page's published number).
// There is no per-LP account-manager assignment backend yet, so this card points at the
// real platform support channel + the real tickets/help surface (/support) — never a
// fabricated "dedicated manager". DELETE NOTHING: the card stays, made honest.
const SUPPORT_PHONE = "+1 205 350 8771";
const SUPPORT_TEL = "+12053508771";

export function LPAccountManager({ isRTL = false }: LPAccountManagerProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Headphones className="w-5 h-5 text-primary" />
          {isRTL ? "تحتاج مساعدة؟" : "Need Help?"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          {isRTL
            ? "فريق دعم المنصة جاهز لمساعدتك في أي استفسار يتعلق بحساب مزود السيولة."
            : "Our platform support team is here to help with any questions about your Liquidity Provider account."}
        </p>

        {/* Real platform support phone (matches the /support page). */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Phone className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">
              {isRTL ? "هاتف الدعم" : "Support Phone"}
            </p>
            <p className="font-medium text-foreground" dir="ltr">{SUPPORT_PHONE}</p>
          </div>
        </div>

        {/* Actions: call the real number, or open the real support/tickets surface. */}
        <div className="flex gap-3">
          <Button asChild variant="outline" className="flex-1">
            <a href={`tel:${SUPPORT_TEL}`}>
              <Phone className="w-4 h-4 mr-2" />
              {isRTL ? "اتصال" : "Call"}
            </a>
          </Button>
          <Button asChild className="flex-1">
            <Link to="/support">
              <MessageCircle className="w-4 h-4 mr-2" />
              {isRTL ? "تواصل مع الدعم" : "Contact Support"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          {isRTL
            ? "افتح تذكرة دعم أو تصفّح مركز المساعدة من صفحة الدعم."
            : "Open a support ticket or browse the help center from the Support page."}
        </p>
      </CardContent>
    </Card>
  );
}
