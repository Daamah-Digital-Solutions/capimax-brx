// Sumsub WebSDK loader (Phase 4).
//
// The WebSDK is loaded lazily from Sumsub's hosted builder script — NO npm
// dependency — so the bundle is unaffected when KYC keys are deferred (the script
// is only fetched when the backend actually issues an access token). The token
// comes from POST /api/kyc/access-token/; identity capture / liveness / document
// upload all happen on Sumsub's side (minimal PII on our servers).

const SDK_SRC = "https://static.sumsub.com/idensic/static/sns-websdk-builder.js";

interface SnsWebSdk {
  init: (
    token: string,
    onExpired: (cb: (newToken: string) => void) => void,
  ) => {
    withConf: (conf: Record<string, unknown>) => any;
    withOptions: (opts: Record<string, unknown>) => any;
    on: (event: string, handler: (payload: any) => void) => any;
    build: () => { launch: (selector: string) => void };
  };
}

declare global {
  interface Window {
    snsWebSdk?: SnsWebSdk;
  }
}

let loaderPromise: Promise<SnsWebSdk> | null = null;

function loadSdk(): Promise<SnsWebSdk> {
  if (window.snsWebSdk) return Promise.resolve(window.snsWebSdk);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => {
      if (window.snsWebSdk) resolve(window.snsWebSdk);
      else reject(new Error("Sumsub WebSDK failed to initialise."));
    };
    script.onerror = () => reject(new Error("Could not load the Sumsub WebSDK."));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

export interface MountOptions {
  /** The live container element to launch the SDK into (must be in the DOM). */
  container: HTMLElement;
  accessToken: string;
  /** Lang for the SDK UI ("en" | "ar"). */
  lang?: string;
  /**
   * Called when the applicant actually SUBMITS their documents. This is the moment
   * to move our UI to "under review" — not on every intermediate status change,
   * which would tear down the open widget mid-flow.
   */
  onSubmitted?: () => void;
  /** Called on intermediate applicant-status changes (informational; safe to omit). */
  onStatusChanged?: () => void;
  /** Called when the SDK signals completion. */
  onComplete?: () => void;
}

// Monotonic id source for SDK containers. Sumsub's launch() takes a CSS selector,
// so each container needs a plain, valid, unique id (NOT a useId()-derived value,
// which React may wrap in guillemets like «r0» → an invalid selector → the
// "Provide a valid selector for the iframe container" error).
let sdkContainerSeq = 0;

/**
 * Mount and launch the Sumsub WebSDK into the given container ELEMENT. We build
 * the selector from an id we assign to the element we were handed, so the selector
 * always resolves — no dependency on a caller-built selector that may be invalid or
 * point at a node that isn't in the DOM after a React re-render. Resolves once the
 * SDK is launched; rejects if the script/SDK can't load. Approval is still driven by
 * the signed webhook (the callbacks here only trigger a status re-fetch in the UI).
 */
export async function mountSumsubWebSdk(opts: MountOptions): Promise<void> {
  const sdk = await loadSdk();
  const el = opts.container;
  if (!el.id) el.id = `sumsub-sdk-container-${sdkContainerSeq++}`;
  const selector = `#${el.id}`;
  const instance = sdk
    .init(opts.accessToken, (cb) => {
      // The token is short-lived; the simplest refresh is to re-issue via our API.
      // Imported lazily to avoid a cycle.
      import("@/integrations/api/client").then(({ kycApi }) => {
        kycApi.accessToken().then((r) => r.token && cb(r.token));
      });
    })
    .withConf({ lang: opts.lang || "en" })
    // Only the SUBMIT + COMPLETE events drive our UI transition; intermediate status
    // changes are informational so the open widget is never torn down mid-flow.
    .on("idCheck.onApplicantSubmitted", () => opts.onSubmitted?.())
    .on("idCheck.onApplicantStatusChanged", () => opts.onStatusChanged?.())
    .on("idCheck.applicantStatus", () => opts.onStatusChanged?.())
    .on("idCheck.onComplete", () => opts.onComplete?.())
    .build();
  instance.launch(selector);
}
