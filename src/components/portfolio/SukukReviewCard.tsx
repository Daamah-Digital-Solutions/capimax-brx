import { useEffect, useState } from "react";
import { FileText, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { investmentsApi, type SukukInvestmentRow } from "@/integrations/api/client";

// Portfolio surface for Nova certificate (sukuk) investments that aren't holdings yet:
// "Certificate under review" (PENDING) or "rejected + reason" (FAILED). Approved ones become
// real token holdings and drop off this list. Mirrors the KYC under-review UX. Self-scoped;
// renders nothing when the caller has no pending/rejected certificates.
export function SukukReviewCard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [rows, setRows] = useState<SukukInvestmentRow[]>([]);

  useEffect(() => {
    if (!user) {
      setRows([]);
      return;
    }
    let active = true;
    investmentsApi
      .sukukInvestments()
      .then((r) => active && setRows(r))
      .catch(() => active && setRows([]));
    return () => {
      active = false;
    };
  }, [user]);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3 animate-fade-in">
      {rows.map((row) => {
        const rejected = row.state === "rejected";
        return (
          <div
            key={row.id}
            className={cn(
              "flex items-start gap-3 p-4 rounded-2xl border",
              rejected
                ? "border-destructive/30 bg-destructive/5"
                : "border-warning/30 bg-warning/5",
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                rejected ? "bg-destructive/20" : "bg-warning/20",
              )}
            >
              {rejected ? (
                <XCircle className="w-5 h-5 text-destructive" />
              ) : (
                <Clock className="w-5 h-5 text-warning" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground">{row.property_name}</span>
                <Badge variant={rejected ? "destructive" : "warning"}>
                  {rejected
                    ? isAr
                      ? "شهادة مرفوضة"
                      : "Certificate rejected"
                    : isAr
                      ? "قيد المراجعة"
                      : "Under review"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {row.token_amount} {isAr ? "وحدة" : "units"} · $
                {row.settlement_amount.toLocaleString()}
              </p>
              {rejected ? (
                <p className="text-sm text-destructive mt-1">
                  {isAr ? "السبب: " : "Reason: "}
                  {row.review_notes || (isAr ? "غير محدد" : "not specified")}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  {isAr
                    ? "استلمنا شهادة نوفا الخاصة بك ويراجعها فريقنا. تظهر رموزك بمجرد الموافقة."
                    : "We've received your Nova certificate and our team is reviewing it. Your tokens appear once approved."}
                </p>
              )}
            </div>
            <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
          </div>
        );
      })}
    </div>
  );
}
