import { useEffect, useState } from "react";
import { Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useExport } from "@/hooks/useExport";
import { reportsApi, type ReceiptRow } from "@/integrations/api/client";

// Purchases and installments paid directly by card or crypto don't pass through the wallet,
// so their receipts are listed here (wallet movements have theirs on each transaction row).
export function PaymentReceipts() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { exporting, run } = useExport();
  const [rows, setRows] = useState<ReceiptRow[] | null>(null);

  useEffect(() => {
    reportsApi
      .receipts()
      .then((all) => setRows(all.filter((r) => r.kind === "payment")))
      .catch(() => setRows([]));
  }, []);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="mt-6 bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          {isAr ? "إيصالات الدفع بالكارت والعملات الرقمية" : "Card & crypto payment receipts"}
        </h3>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-foreground truncate">{r.title}</div>
              <div className="text-xs text-muted-foreground" dir="ltr">
                {r.number} · {new Date(r.date).toLocaleDateString(isAr ? "ar" : "en")}
                {r.method ? ` · ${r.method}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-semibold" dir="ltr">${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <Button
                variant="ghost"
                size="icon"
                title={isAr ? "تحميل الإيصال" : "Download receipt"}
                disabled={exporting === r.id}
                onClick={() => run(r.id, () => reportsApi.receipt("payment", r.id))}
              >
                {exporting === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
