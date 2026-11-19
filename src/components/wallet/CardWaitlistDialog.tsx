import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Baby, CheckCircle2, CreditCard, Loader2, User as UserIcon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCardWaitlist } from "@/hooks/useCardWaitlist";
import type { CardWaitlistType } from "@/integrations/api/client";

/** The label every card entry point shows while cards are not issued (client letter 2026-11-19). */
export function waitlistLabel(isAr: boolean) {
  return isAr ? "قريباً · انضم إلى قائمة الانتظار" : "Coming soon · Join the Waitlist";
}

const TYPES: { id: CardWaitlistType; icon: typeof UserIcon; en: string; ar: string; descEn: string; descAr: string }[] = [
  { id: "personal", icon: UserIcon, en: "Personal Card", ar: "بطاقة شخصية",
    descEn: "Linked to your wallet.", descAr: "مرتبطة بمحفظتك." },
  { id: "family", icon: Users, en: "Family Investment Card", ar: "بطاقة استثمار عائلي",
    descEn: "Linked to a family member's allocation.", descAr: "مرتبطة بحصة فرد من العائلة." },
  { id: "dependent", icon: Baby, en: "Dependent Card", ar: "بطاقة معال",
    descEn: "Controlled card for a child or dependent.", descAr: "بطاقة بضوابط لطفل أو معال." },
];

interface CardWaitlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: CardWaitlistType;
}

/**
 * BRX Visa cards are "Coming soon": instead of issuing a card, the investor joins the
 * waitlist with the card they want (recorded server-side, listed for staff in the admin).
 */
export function CardWaitlistDialog({ open, onOpenChange, initialType }: CardWaitlistDialogProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);
  const { signedIn, joined, cardType, joinedAt, join, joining } = useCardWaitlist();
  const [type, setType] = useState<CardWaitlistType>(initialType ?? "personal");

  useEffect(() => {
    if (open) setType(initialType ?? cardType ?? "personal");
  }, [open, initialType, cardType]);

  const submit = async () => {
    try {
      await join(type);
      toast.success(t("You're on the waitlist — we'll let you know when cards open.",
        "تم تسجيلك في قائمة الانتظار — سنبلغك فور إتاحة البطاقات."));
      onOpenChange(false);
    } catch {
      toast.error(t("Could not join the waitlist. Please try again.", "تعذّر التسجيل في قائمة الانتظار. حاول مرة أخرى."));
    }
  };

  const chosen = TYPES.find((x) => x.id === cardType);
  const sameAsSaved = joined && cardType === type;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold shrink-0">
              <CreditCard className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <DialogTitle>{t("Capimax BRX Visa Cards", "بطاقات فيزا كابيماكس BRX")}</DialogTitle>
              <Badge variant="outline" className="mt-1">{waitlistLabel(isAr)}</Badge>
            </div>
          </div>
          <DialogDescription className="pt-2">
            {t("Cards are not issued yet. Join the waitlist with the card you want and we'll let you know as soon as you can request it.",
              "البطاقات غير متاحة للإصدار بعد. انضم إلى قائمة الانتظار بالبطاقة التي تريدها، وسنبلغك فور إتاحة طلبها.")}
          </DialogDescription>
        </DialogHeader>

        {joined && chosen && (
          <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
            <span>
              {t("You're on the waitlist for the", "أنت في قائمة الانتظار لـ")}{" "}
              <strong>{isAr ? chosen.ar : chosen.en}</strong>
              {joinedAt && (
                <span className="text-muted-foreground">
                  {" · "}
                  {new Date(joinedAt).toLocaleDateString(isAr ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
            </span>
          </div>
        )}

        <div className="grid gap-2" role="radiogroup" aria-label={t("Card", "البطاقة")}>
          {TYPES.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={type === x.id}
              onClick={() => setType(x.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-start transition-colors",
                type === x.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
              )}
            >
              <div className="p-2 rounded-md bg-primary/10 shrink-0">
                <x.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">{isAr ? x.ar : x.en}</div>
                <div className="text-xs text-muted-foreground">{isAr ? x.descAr : x.descEn}</div>
              </div>
              <span className={cn("h-4 w-4 rounded-full border-2 shrink-0", type === x.id ? "border-primary bg-primary" : "border-muted-foreground/40")} />
            </button>
          ))}
        </div>

        <DialogFooter>
          {signedIn ? (
            <Button variant="hero" onClick={submit} disabled={joining || sameAsSaved} className="gap-2">
              {joining && <Loader2 className="h-4 w-4 animate-spin" />}
              {joined
                ? (sameAsSaved ? t("You're on the waitlist", "أنت في قائمة الانتظار") : t("Update my request", "تحديث طلبي"))
                : t("Join the Waitlist", "انضم إلى قائمة الانتظار")}
            </Button>
          ) : (
            <Button variant="hero" asChild>
              <Link to="/auth">{t("Sign in to join the waitlist", "سجّل الدخول للانضمام إلى قائمة الانتظار")}</Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
