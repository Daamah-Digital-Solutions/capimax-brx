import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { transfersApi, type TransferRow } from "@/integrations/api/client";

const STATUS: Record<TransferRow["status"], { en: string; ar: string; cls: string }> = {
  scheduled: { en: "Scheduled", ar: "مجدولة", cls: "bg-blue-500/10 text-blue-600" },
  waiting: { en: "Waiting for recipient", ar: "بانتظار المستلم", cls: "bg-amber-500/10 text-amber-600" },
  delivered: { en: "Delivered", ar: "تم التسليم", cls: "bg-green-500/10 text-green-600" },
  cancelled: { en: "Cancelled — returned", ar: "أُلغيت — أُعيدت", cls: "bg-muted text-muted-foreground" },
  expired: { en: "Expired — returned", ar: "انتهت — أُعيدت", cls: "bg-muted text-muted-foreground" },
  failed: { en: "Failed — returned", ar: "فشلت — أُعيدت", cls: "bg-destructive/10 text-destructive" },
};

const KIND = {
  gift: { en: "Gift", ar: "هدية" },
  family: { en: "Family", ar: "عائلي" },
  estate: { en: "Inheritance", ar: "ميراث" },
};

/** The caller's gifts / family transfers / inheritance (sent and received), with cancel. */
export function TransfersList({ kinds, refreshKey = 0 }: { kinds?: TransferRow["kind"][]; refreshKey?: number }) {
  const { isRTL } = useLanguage();
  const [rows, setRows] = useState<TransferRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    transfersApi
      .list()
      .then((r) => setRows(kinds ? r.filter((t) => kinds.includes(t.kind)) : r))
      .catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kinds?.join(",")]);

  useEffect(load, [load, refreshKey]);

  const cancel = async (id: string) => {
    setBusy(id);
    try {
      await transfersApi.cancel(id);
      toast.success(isRTL ? "أُلغي التحويل وأُعيد إليك" : "Cancelled — returned to you");
      load();
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "تعذّر الإلغاء" : "Could not cancel"));
    } finally {
      setBusy(null);
    }
  };

  if (rows === null) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">{isRTL ? "لا توجد تحويلات بعد." : "Nothing sent or received yet."}</p>;

  return (
    <div className="space-y-2">
      {rows.map((t) => {
        const st = STATUS[t.status];
        const what =
          t.asset === "units"
            ? `${t.units} ${isRTL ? "وحدة" : t.units === 1 ? "unit" : "units"} · ${t.property_name}`
            : `$${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        return (
          <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {t.direction === "sent" ? (isRTL ? "إلى " : "To ") : isRTL ? "من " : "From "}
                {t.counterparty} · {what}
              </div>
              <div className="text-xs text-muted-foreground">
                {isRTL ? KIND[t.kind].ar : KIND[t.kind].en} · {t.reference} ·{" "}
                {t.status === "scheduled" ? t.deliver_on : new Date(t.created_at).toLocaleDateString()}
                {t.closed_reason && t.status !== "delivered" ? ` · ${t.closed_reason}` : ""}
              </div>
            </div>
            <Badge variant="outline" className={st.cls}>
              {isRTL ? st.ar : st.en}
            </Badge>
            {t.direction === "sent" && t.kind !== "estate" && (t.status === "scheduled" || t.status === "waiting") && (
              <Button
                size="icon"
                variant="ghost"
                title={isRTL ? "إلغاء" : "Cancel"}
                disabled={busy === t.id}
                onClick={() => cancel(t.id)}
              >
                {busy === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
