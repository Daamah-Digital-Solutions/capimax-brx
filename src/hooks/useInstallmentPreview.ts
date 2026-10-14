import { useEffect, useState } from "react";
import { installmentsApi, type InstallmentPreview } from "@/integrations/api/client";

/**
 * The shared installment terms every property-page calculator reads + writes, so all four
 * blocks (InstallmentCalculator, DynamicInstallmentPlanner, InstallmentScheduleSection,
 * PostConstructionPaymentPlan) show ONE identical plan.
 *
 * Off-plan §4: `months` is the plan TERM — a down payment now + (months - 1) monthly
 * installments — and each term has its own down payment % (default 6/12/18/24 months at
 * 30/25/20/15%, or the property's admin-set terms). The server only accepts offered terms.
 */
export interface InstallmentTerms {
  units: number;
  downPct: number;
  months: number; // the term: 6 / 12 / 18 / 24 by default
  frequency: "monthly" | "quarterly";
}

/** A plan the property offers (PropertyDetail `installmentTerms`). */
export interface OfferedTerm {
  months: number;
  downPaymentPercent: number;
}

export const DEFAULT_INSTALLMENT_TERMS: InstallmentTerms = {
  units: 1,
  downPct: 25,
  months: 12,
  frequency: "monthly",
};

/** Monthly installments after the down payment: a term of N months = N - 1 installments. */
export function termInstallmentCount(t: InstallmentTerms): number {
  return t.frequency === "quarterly"
    ? Math.max(1, Math.round(t.months / 3))
    : Math.max(1, t.months - 1);
}

/**
 * Snap terms onto what the property offers: keep the current term if offered (with its down %),
 * else the 12-month term if offered, else the first one. Unchanged when nothing is offered.
 */
export function snapToOfferedTerm(t: InstallmentTerms, offered?: OfferedTerm[] | null): InstallmentTerms {
  if (!offered || offered.length === 0) return t;
  const match =
    offered.find((o) => o.months === t.months) ??
    offered.find((o) => o.months === 12) ??
    offered[0];
  if (match.months === t.months && match.downPaymentPercent === t.downPct && t.frequency === "monthly") {
    return t;
  }
  return { ...t, months: match.months, downPct: match.downPaymentPercent, frequency: "monthly" };
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
    term: String(t.months),
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
        ...(terms.frequency === "monthly" ? { term_months: terms.months } : {}),
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
