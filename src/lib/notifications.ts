// Phase 10 — frontend rendering of in-app notifications. The backend stores `type` +
// `params` (no display strings); we map each type to a UI category (for the existing
// tabs/icons) and render EN/AR copy from the i18n layer, interpolating params.
import type { ApiNotification } from "@/integrations/api/client";

export type NotificationCategory =
  | "financial"
  | "investment"
  | "report"
  | "system"
  | "alert";

// Map each backend event type → the page's existing tab/icon category.
const TYPE_CATEGORY: Record<string, NotificationCategory> = {
  kyc_approved: "system",
  kyc_rejected: "alert",
  kyb_approved: "system",
  kyb_rejected: "alert",
  wallet_created: "system",
  investment_minted: "investment",
  earnings_credited: "financial",
  distribution_credited: "financial",
  secondary_sale_buyer: "investment",
  secondary_sale_seller: "financial",
  withdrawal_requested: "financial",
  submission_published: "investment",
  submission_rejected: "alert",
  // Partner assignment workflow (Phase 11 Wave B).
  partner_assigned: "system",
  partner_deliverable_submitted: "report",
  partner_deliverable_approved: "report",
  partner_revision_requested: "alert",
  partner_assignment_completed: "report",
  // Broker licence verification (Phase 12 Wave A).
  broker_license_approved: "system",
  broker_license_rejected: "alert",
  // Broker commission (Phase 12 Wave B) — money-in.
  broker_commission_credited: "financial",
  // Installments (Wave C) — a scheduled installment cleared → tokens released.
  installment_paid: "financial",
};

export function categoryOf(type: string): NotificationCategory {
  return TYPE_CATEGORY[type] ?? "system";
}

function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = params?.[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

export function renderNotificationCopy(
  n: ApiNotification,
  t: (key: string) => string,
): { title: string; description: string; actionLabel: string } {
  return {
    title: interpolate(t(`notif.${n.type}.title`), n.params || {}),
    description: interpolate(t(`notif.${n.type}.body`), n.params || {}),
    actionLabel: n.action_url ? t("notif.action.view") : "",
  };
}

// Localized relative time ("2h ago" / "منذ ساعتين") from an ISO timestamp — replaces
// the mock's hardcoded relative strings. Uses Intl.RelativeTimeFormat (supports ar/en).
export function relativeTime(iso: string, language: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.round((then - Date.now()) / 1000); // negative = past
  const rtf = new Intl.RelativeTimeFormat(language === "ar" ? "ar" : "en", {
    numeric: "auto",
  });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), "month");
  return rtf.format(Math.round(diffSec / 31536000), "year");
}
