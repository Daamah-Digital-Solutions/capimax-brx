/**
 * The certificate status label with the reason behind it, the same words as the certificate
 * PDF: "Final · Fully paid", "Provisional · Installments outstanding", ... The reason code
 * comes from the backend (status_reason), worked out from the real state of the purchase.
 * Shown in capitals; French comes from fr-extra.json (the whole label is one string).
 */
type Lang = "ar" | string;

const BASE: Record<string, [string, string]> = {
  final: ["Final", "نهائية"],
  provisional: ["Provisional", "مؤقتة"],
  revoked: ["Revoked", "ملغاة"],
};

const REASON: Record<string, [string, string]> = {
  fully_paid: ["Fully paid", "مدفوعة بالكامل"],
  installments_outstanding: ["Installments outstanding", "أقساط مستحقة"],
  pledged_nova: ["Pledged to Nova Finance", "مرهونة لدى Nova Finance"],
  awaiting_record: ["Awaiting on-chain record", "بانتظار التسجيل على البلوكتشين"],
};

export function certificateStatusLabel(status: string, reason: string | null | undefined, language: Lang): string {
  const i = language === "ar" ? 1 : 0;
  const base = BASE[status]?.[i] ?? status;
  const why = reason ? REASON[reason]?.[i] : undefined;
  return why ? `${base} · ${why}` : base;
}
