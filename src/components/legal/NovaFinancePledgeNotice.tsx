import { Lock, FileWarning } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface NovaFinancePledgeNoticeProps {
  variant?: "default" | "compact" | "inline";
  className?: string;
}

/**
 * Institutional disclosure notice required wherever Nova Finance financing
 * is presented (checkout, property pages, financing, ownership, exit).
 */
export function NovaFinancePledgeNotice({
  variant = "default",
  className,
}: NovaFinancePledgeNoticeProps) {
  const { isRTL } = useLanguage();

  const title = isRTL
    ? "إفصاح قانوني — تمويل Nova Finance"
    : "Legal Disclosure — Nova Finance Financing";

  const body = isRTL
    ? "العقارات الممولة عبر Nova Finance تظل مرهونة لصالح الجهة الممولة، ولا يجوز بيع العقار أو نقل ملكيته أو التخارج منه قبل صدور خطاب إخلاء طرف رسمي (Clearance / Release) من Nova Finance."
    : "Properties financed through Nova Finance remain pledged/mortgaged in favor of the financier. The property cannot be sold, transferred, or exited unless an official clearance/release is issued by Nova Finance.";

  if (variant === "inline") {
    return (
      <p
        className={cn(
          "text-xs text-muted-foreground flex items-start gap-2",
          className
        )}
      >
        <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-warning" />
        <span>
          <span className="font-semibold text-foreground">{title}: </span>
          {body}
        </span>
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-warning/40 bg-warning/5 p-4",
        variant === "compact" ? "p-3" : "p-4",
        className
      )}
      role="note"
      aria-label={title}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "rounded-lg bg-warning/15 flex items-center justify-center shrink-0",
            variant === "compact" ? "w-8 h-8" : "w-10 h-10"
          )}
        >
          <FileWarning
            className={cn(
              "text-warning",
              variant === "compact" ? "w-4 h-4" : "w-5 h-5"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4
              className={cn(
                "font-semibold text-foreground",
                variant === "compact" ? "text-xs" : "text-sm"
              )}
            >
              {title}
            </h4>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-warning">
              <Lock className="w-3 h-3" />
              {isRTL ? "مرهون" : "Pledged"}
            </span>
          </div>
          <p
            className={cn(
              "text-muted-foreground leading-relaxed",
              variant === "compact" ? "text-[11px]" : "text-xs"
            )}
          >
            {body}
          </p>
          <p
            className={cn(
              "mt-2 text-[11px] text-muted-foreground/80 italic",
              variant === "compact" && "hidden"
            )}
          >
            {isRTL
              ? "يطبق هذا البند على جميع صفحات العقار، التمويل، الدفع، اتفاقيات الملكية، وآليات التخارج."
              : "This clause applies across property, financing, payment, ownership agreements, and exit mechanisms."}
          </p>
        </div>
      </div>
    </div>
  );
}
