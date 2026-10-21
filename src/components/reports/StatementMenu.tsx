import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import { useExport } from "@/hooks/useExport";
import { reportsApi, type ReportContext } from "@/integrations/api/client";

const PERIODS = [
  { key: "month", ar: "هذا الشهر", en: "This month" },
  { key: "quarter", ar: "هذا الربع", en: "This quarter" },
  { key: "year", ar: "هذه السنة", en: "This year" },
  { key: "", ar: "كل الفترات", en: "All time" },
] as const;

/** "Download statement" menu: a PDF for a chosen period, or the full data as CSV (Excel). */
export function StatementMenu({
  context,
  label,
  csv = true,
  size = "sm",
}: {
  context: ReportContext;
  label?: string;
  csv?: boolean;
  size?: "sm" | "default";
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { exporting, run } = useExport();
  const busy = exporting !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="gap-2" disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {label ?? (isAr ? "تنزيل كشف الحساب" : "Download statement")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">PDF</DropdownMenuLabel>
        {PERIODS.map((p) => (
          <DropdownMenuItem
            key={p.key || "all"}
            onClick={() => run(`${context}-${p.key}`, () => reportsApi.export(context, "pdf", { period: p.key }))}
          >
            <FileText className="w-4 h-4 me-2" />
            {isAr ? p.ar : p.en}
          </DropdownMenuItem>
        ))}
        {csv && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => run(`${context}-csv`, () => reportsApi.export(context, "csv"))}>
              <FileSpreadsheet className="w-4 h-4 me-2" />
              {isAr ? "Excel / CSV (كل الفترات)" : "Excel / CSV (all time)"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
