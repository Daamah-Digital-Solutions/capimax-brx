import { API_BASE_URL } from "@/integrations/api/client";
import { isThirdPartyExtensionError } from "@/lib/thirdPartyErrors";

// Report uncaught browser errors to the backend (POST /api/monitoring/client-errors/), which
// logs them and emails the team (each distinct error once per 15 minutes). Production only;
// browser-extension noise is skipped, and one page load sends at most a handful of reports.

const ENDPOINT = `${API_BASE_URL}/monitoring/client-errors/`;
const MAX_REPORTS_PER_PAGE = 5;
const sent = new Set<string>();

type Source = "error" | "unhandledrejection" | "boundary";

export function reportError(error: unknown, source: Source, extraStack?: string): void {
  if (!import.meta.env.PROD) return;
  if (isThirdPartyExtensionError(error)) return;
  const err = error instanceof Error ? error : null;
  const message = (err ? `${err.name}: ${err.message}` : String(error ?? "Unknown error")).slice(0, 1000);
  if (sent.has(message) || sent.size >= MAX_REPORTS_PER_PAGE) return;
  sent.add(message);
  const body = JSON.stringify({
    message,
    stack: [err?.stack, extraStack].filter(Boolean).join("\n\nComponent stack:").slice(0, 6000),
    source,
    url: window.location.href.slice(0, 500),
    release: (document.querySelector('script[type="module"][src*="/assets/index-"]') as HTMLScriptElement | null)
      ?.src.split("/").pop()?.slice(0, 80) ?? "",
  });
  try {
    // keepalive lets the report finish even if the page is unloading.
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* reporting must never break the page */
  }
}

export function installErrorReporter(): void {
  const w = window as unknown as { __errorReporterInstalled?: boolean };
  if (w.__errorReporterInstalled) return;
  w.__errorReporterInstalled = true;
  window.addEventListener("error", (event) => {
    if (event.defaultPrevented) return; // already handled (e.g. extension guard)
    if (isThirdPartyExtensionError(event.error || event.message, event.filename)) return;
    reportError(event.error ?? event.message, "error");
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (event.defaultPrevented) return;
    reportError(event.reason, "unhandledrejection");
  });
}
