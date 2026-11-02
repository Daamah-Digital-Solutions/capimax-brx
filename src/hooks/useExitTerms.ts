import { useEffect, useState } from "react";
import { lpApi, type ExitTerms } from "@/integrations/api/client";

// The exit fees the pages quote come from the server (apps/lp exit_terms), so the text always
// matches what is charged. The fallback is the server's default, shown until the answer lands.
const FALLBACK: ExitTerms = { discount_percent: 3, fee_percent: 2, ttl_minutes: 1440, secondary_fee_percent: 1 };

let cached: ExitTerms | null = null;
let pending: Promise<ExitTerms> | null = null;

function load(): Promise<ExitTerms> {
  if (!pending) {
    pending = lpApi
      .exitTerms()
      .then((t) => (cached = { ...FALLBACK, ...t }))
      .catch(() => {
        pending = null;
        return FALLBACK;
      });
  }
  return pending;
}

export function useExitTerms(): ExitTerms {
  const [terms, setTerms] = useState<ExitTerms>(cached ?? FALLBACK);
  useEffect(() => {
    if (cached) return;
    let alive = true;
    load().then((t) => alive && setTerms(t));
    return () => {
      alive = false;
    };
  }, []);
  return terms;
}

/** "2%", "0.5%": a percent without trailing zeros. */
export const pct = (n: number) => `${Number(n.toFixed(2))}%`;
