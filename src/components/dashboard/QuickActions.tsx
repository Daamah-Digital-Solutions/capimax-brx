import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Award,
  BarChart3,
  Calendar,
  FolderOpen,
  Gift,
  HelpCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { GiftDialog } from "@/components/transfers/GiftDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type Action = { ar: string; en: string; icon: LucideIcon; to?: string; onClick?: () => void; tone?: string };

/** The dashboard's shortcuts to every investor service (deposit, transfer, documents, …). */
export function QuickActions({ className }: { className?: string }) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [giftOpen, setGiftOpen] = useState(false);

  const actions: Action[] = [
    { ar: "إيداع", en: "Deposit", icon: ArrowDownToLine, to: "/wallet", tone: "text-emerald-500" },
    { ar: "سحب", en: "Withdraw", icon: ArrowUpFromLine, to: "/wallet" },
    { ar: "تحويل حصص", en: "Transfer units", icon: Gift, onClick: () => setGiftOpen(true), tone: "text-primary" },
    { ar: "الشهادات", en: "Certificates", icon: Award, to: "/portfolio?tab=certificates" },
    { ar: "مركز المستندات", en: "Document center", icon: FolderOpen, to: "/documents" },
    { ar: "مركز التحقق", en: "Verification center", icon: ShieldCheck, to: "/verification-center" },
    { ar: "الكشوف والتقارير", en: "Statements & reports", icon: BarChart3, to: "/reports?tab=reports" },
    { ar: "الأقساط", en: "Installments", icon: Calendar, to: "/installments" },
    { ar: "السوق الثانوي", en: "Secondary market", icon: ArrowRightLeft, to: "/secondary-market" },
    { ar: "إعادة استثمار", en: "Reinvest", icon: RefreshCw, to: "/reinvestment" },
    { ar: "التخارج", en: "Exits", icon: LogOut, to: "/exits-hub" },
    { ar: "الدعم", en: "Support", icon: HelpCircle, to: "/support" },
  ];

  const tile = "flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-background/40 px-2 py-4 text-center transition-colors hover:border-primary/50 hover:bg-primary/5";

  return (
    <div className={cn("bg-card rounded-2xl border border-border p-6", className)}>
      <h3 className="font-semibold text-foreground mb-4">{isAr ? "إجراءات سريعة" : "Quick actions"}</h3>
      <div className="grid grid-cols-3 gap-2.5">
        {actions.map((a) => {
          const body = (
            <>
              <a.icon className={cn("w-5 h-5", a.tone ?? "text-muted-foreground")} />
              <span className="text-xs font-medium text-foreground leading-tight">{isAr ? a.ar : a.en}</span>
            </>
          );
          return a.to ? (
            <Link key={a.en} to={a.to} className={tile}>
              {body}
            </Link>
          ) : (
            <button key={a.en} type="button" onClick={a.onClick} className={tile}>
              {body}
            </button>
          );
        })}
      </div>
      <GiftDialog open={giftOpen} onOpenChange={setGiftOpen} />
    </div>
  );
}
