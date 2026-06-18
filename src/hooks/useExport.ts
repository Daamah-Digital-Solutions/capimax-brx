import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

// Phase 13: shared helper for the export/download buttons. Tracks which button is
// running (so each can show its own spinner) and toasts success/failure. The actual
// download is a reportsApi call passed in by the caller.
export function useExport() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [exporting, setExporting] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setExporting(key);
    try {
      await fn();
      toast.success(isAr ? "تم تنزيل الملف" : "Download started");
    } catch (err: any) {
      toast.error(err?.message || (isAr ? "تعذّر التصدير" : "Export failed"));
    } finally {
      setExporting(null);
    }
  }

  return { exporting, run };
}
