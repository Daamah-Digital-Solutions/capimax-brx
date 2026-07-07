import { useEffect, useState } from "react";
import { installmentsApi, type InstallmentPreview } from "@/integrations/api/client";

/**
 * The shared installment terms every property-page calculator reads + writes, so all four
 * blocks (InstallmentCalculator, DynamicInstallmentPlanner, InstallmentScheduleSection,
 * PostConstructionPaymentPlan) show ONE identical plan. Duration is stored in whole MONTHS
 * (12/24/36) — the common unit both the months-dropdown and the years-chips map onto.
 */
export interface InstallmentTerms {
  units: number;
  downPct: number;
  months: number; // 12 / 24 / 36
  frequency: "monthly" | "quarterly";
}

export const DEFAULT_INSTALLMENT_TERMS: InstallmentTerms = {
  units: 1,
  downPct: 20,
  months: 24,
  frequency: "monthly",
};

/** Installments charged for these terms: one row per month, or per 3 months if quarterly. */
export function termInstallmentCount(t: InstallmentTerms): number {
  return t.frequency === "quarterly"
    ? Math.max(1, Math.round(t.months / 3))
    : t.months;
}

/**
 * The shared `type=installment` checkout URL query (down/duration/frequency) — identical
 * whichever calculator's "Invest with installments" CTA the investor clicks. `duration` is
 * the installment COUNT (what Checkout reads as n_installments), not the month span.
 */
export function installmentCheckoutQuery(propertySlug: string, t: InstallmentTerms): string {
  return new URLSearchParams({
    property: propertySlug,
    units: String(t.units),
    type: "installment",
    down: String(t.downPct),
    duration: String(termInstallmentCount(t)),
    frequency: t.frequency,
  }).toString();
}

/**
 * Fetch a live, cent-exact plan preview for `terms` from the engine (the single source of
 * truth). Re-runs whenever the terms change. Returns null while loading or on error (callers
 * fall back to a clearly-labelled example), never a fabricated plan.
 */
export function useInstallmentPreview(
  propertySlug: string | undefined,
  terms: InstallmentTerms,
  enabled = true,
) {
  const [preview, setPreview] = useState<InstallmentPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = termInstallmentCount(terms);
  useEffect(() => {
    if (!enabled || !propertySlug || terms.units < 1 || n < 1) return;
    let active = true;
    setLoading(true);
    setError(null);
    installmentsApi
      .preview({
        property: propertySlug,
        units: terms.units,
        down_payment_percent: terms.downPct,
        n_installments: n,
        frequency: terms.frequency,
      })
      .then((p) => {
        if (active) {
          setPreview(p);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // n encodes months+frequency; list the primitive term fields so the effect re-runs on any change.
  }, [propertySlug, terms.units, terms.downPct, n, terms.frequency, enabled]);

  return { preview, loading, error };
}
