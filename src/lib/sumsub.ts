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
  containerSelector: string;
  accessToken: string;
  /** Lang for the SDK UI ("en" | "ar"). */
  lang?: string;
  /** Called when the applicant reaches a terminal status change (poll backend after). */
  onStatusChanged?: () => void;
  /** Called when the SDK signals completion. */
  onComplete?: () => void;
}

/**
 * Mount and launch the Sumsub WebSDK into the given container. Resolves once the
 * SDK is launched; rejects if the script/SDK can't load. The caller still relies
 * on the signed webhook (not the SDK callbacks) as the source of truth for
 * approval — the callbacks here only trigger a status re-fetch in the UI.
 */
export async function mountSumsubWebSdk(opts: MountOptions): Promise<void> {
  const sdk = await loadSdk();
  const instance = sdk
    .init(opts.accessToken, (cb) => {
      // The token is short-lived; the simplest refresh is to re-issue via our API.
      // Imported lazily to avoid a cycle.
      import("@/integrations/api/client").then(({ kycApi }) => {
        kycApi.accessToken().then((r) => r.token && cb(r.token));
      });
    })
    .withConf({ lang: opts.lang || "en" })
    .on("idCheck.onApplicantStatusChanged", () => opts.onStatusChanged?.())
    .on("idCheck.onApplicantSubmitted", () => opts.onStatusChanged?.())
    .on("idCheck.applicantStatus", () => opts.onStatusChanged?.())
    .on("idCheck.onComplete", () => opts.onComplete?.())
    .build();
  instance.launch(opts.containerSelector);
}
