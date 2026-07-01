import { Wrench } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Honest "coming soon" banner for the card / bank / crypto-wallet surfaces. Their data
 * layer (formerly Supabase) is disconnected until the Django backends land, so the UI is
 * present but non-functional — we say so plainly instead of faking success or an empty
 * screen.
 */
export function BackendPendingNotice() {
  const { language } = useLanguage();
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
      <Wrench className="h-4 w-4 shrink-0" />
      <span>
        {language === "ar"
          ? "هذه الميزة قيد الربط بالخادم — قريباً."
          : "This feature is being connected to the backend — coming soon."}
      </span>
    </div>
  );
}
