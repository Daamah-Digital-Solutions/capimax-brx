import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Award,
  BarChart3,
  Calendar,
  FolderOpen,
  Send,
  HandCoins,
  HelpCircle,
  Coins,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Action = { ar: string; en: string; icon: LucideIcon; to?: string; onClick?: () => void; tone?: string };

/** The dashboard's shortcuts to every investor service (deposit, transfer, documents, …). */
export function QuickActions({ className }: { className?: string }) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();
  const [sellOpen, setSellOpen] = useState(false);

  const actions: Action[] = [
    { ar: "إيداع", en: "Deposit", icon: ArrowDownToLine, to: "/wallet", tone: "text-emerald-500" },
    { ar: "سحب", en: "Withdraw", icon: ArrowUpFromLine, to: "/wallet" },
    { ar: "تحويل", en: "Transfer", icon: Send, to: "/transfers", tone: "text-primary" },
    { ar: "الشهادات", en: "Certificates", icon: Award, to: "/portfolio?tab=certificates" },
    { ar: "مركز المستندات", en: "Document center", icon: FolderOpen, to: "/documents" },
    { ar: "مركز التحقق", en: "Verification center", icon: ShieldCheck, to: "/verification-center" },
    { ar: "الكشوف والتقارير", en: "Statements & reports", icon: BarChart3, to: "/reports?tab=reports" },
    { ar: "الأقساط", en: "Installments", icon: Calendar, to: "/installments" },
    { ar: "السوق الثانوي", en: "Secondary market", icon: ArrowRightLeft, to: "/secondary-market" },
    { ar: "إعادة استثمار", en: "Reinvest", icon: RefreshCw, to: "/reinvestment" },
    // Starts the sale: the investor then picks the secondary market or a liquidity provider.
    { ar: "بيع", en: "Sell", icon: HandCoins, onClick: () => setSellOpen(true), tone: "text-primary" },
    { ar: "الدعم", en: "Support", icon: HelpCircle, to: "/support" },
  ];

  const tile = "flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-background/40 px-2 py-4 text-center transition-colors hover:border-primary/50 hover:bg-primary/5";

  return (
    <div className={cn("bg-card rounded-2xl border border-border p-6", className)}>
      <h3 className="font-semibold text-foreground mb-4">{isAr ? "إجراءات سريعة" : "Quick actions"}</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-2.5">
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

      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isAr ? "بيع حصصك" : "Sell your units"}</DialogTitle>
            <DialogDescription>{isAr ? "اختر طريقة البيع" : "Choose how to sell"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {sellRoutes.map((r) => (
              <button
                key={r.to}
                type="button"
                onClick={() => {
                  setSellOpen(false);
                  navigate(r.to);
                }}
                className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-start transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <r.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-semibold text-foreground">{isAr ? r.ar : r.en}</span>
                  <span className="block text-xs text-muted-foreground">{isAr ? r.descAr : r.descEn}</span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const sellRoutes = [
  {
    ar: "السوق الثانوي",
    en: "Secondary market",
    descAr: "اعرض حصصك للمستثمرين الآخرين بالسعر الذي تحدده.",
    descEn: "Offer your units to other investors at the price you set.",
    icon: ArrowRightLeft,
    to: "/secondary-market?sell=1",
  },
  {
    ar: "مزود السيولة",
    en: "Liquidity provider",
    descAr: "بيع فوري لمزود السيولة بسعر المنصة.",
    descEn: "Sell instantly to a liquidity provider at the platform price.",
    icon: Coins,
    to: "/lp-market",
  },
];
