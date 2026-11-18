import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

export interface WithdrawalRow {
  id: string;
  amount: number | string;
  currency?: string;
  method: "bank" | "crypto" | string;
  status: "pending" | "processing" | "completed" | "failed" | string;
  reference: string;
  destination_label?: string;
  provider?: string;
  speed?: string;
  fee_amount?: number | string;
  payout_reference?: string;
  failure_reason?: string;
  processed_at?: string | null;
  created_at: string;
}

const STATUS: Record<string, { en: string; ar: string; cls: string; hintEn: string; hintAr: string }> = {
  pending: {
    en: "Received", ar: "تم الاستلام", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    hintEn: "Your request is received and waiting to be processed.", hintAr: "تم استلام طلبك وهو بانتظار التنفيذ.",
  },
  processing: {
    en: "Processing", ar: "قيد التنفيذ", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    hintEn: "The transfer is being made to your account.", hintAr: "جارٍ تنفيذ التحويل إلى حسابك.",
  },
  completed: {
    en: "Paid", ar: "تم التحويل", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    hintEn: "The amount was sent to your account.", hintAr: "تم إرسال المبلغ إلى حسابك.",
  },
  failed: {
    en: "Returned", ar: "مُعاد", cls: "bg-red-500/15 text-red-600 border-red-500/30",
    hintEn: "The transfer could not be made; the amount is back in your balance.",
    hintAr: "تعذّر التحويل، وأُعيد المبلغ إلى رصيدك.",
  },
};

/**
 * The investor's withdrawals one by one (client letter 2026-11, withdrawal path §5): amount,
 * destination, status in plain words, the request reference and, once paid, the bank / chain
 * reference — so a transfer can be followed until it reaches the account.
 */
export function WithdrawalsList({ rows }: { rows: WithdrawalRow[] }) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  if (!rows.length) return null;
  // "2026-11-18 13:18" — the same in every language and reading direction.
  const stamp = (iso: string) => {
    const d = new Date(iso);
    const p2 = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  };
  const money = (n: number | string) =>
    `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="font-display text-lg font-semibold mb-4">{isAr ? "طلبات السحب" : "My withdrawals"}</h3>
      <div className="space-y-3">
        {rows.map((w) => {
          const st = STATUS[w.status] ?? { en: w.status, ar: w.status, cls: "", hintEn: "", hintAr: "" };
          return (
            <div key={w.id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold" dir="ltr">{money(w.amount)}</span>
                <Badge variant="outline" className={st.cls}>{isAr ? st.ar : st.en}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{isAr ? st.hintAr : st.hintEn}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {isAr ? "الوجهة: " : "To: "}
                  {w.method === "crypto" ? (isAr ? "محفظة كريبتو" : "Crypto wallet") : isAr ? "حساب بنكي" : "Bank account"}
                  {w.destination_label ? ` · ${w.destination_label}` : ""}
                </span>
                <span>
                  {isAr ? "رقم الطلب: " : "Request: "}
                  <span dir="ltr" className="font-mono">{w.reference}</span>
                </span>
                <span>
                  {isAr ? "تاريخ الطلب: " : "Requested: "}
                  <span dir="ltr">{stamp(w.created_at)}</span>
                </span>
                {w.payout_reference && (
                  <span>
                    {isAr ? "مرجع التحويل: " : "Transfer reference: "}
                    <span dir="ltr" className="font-mono">{w.payout_reference}</span>
                  </span>
                )}
                {w.status === "failed" && w.failure_reason && (
                  <span className="sm:col-span-2 text-red-600">
                    {isAr ? "السبب: " : "Reason: "}
                    {w.failure_reason}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
