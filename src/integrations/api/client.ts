// Minimal API client for the new Django backend.
//
// Scope (Phase 1 / Part C): AUTH ONLY. The base URL is env-driven so the same
// build points at local Django in dev and the VPS in prod. Domain features
// (investments, wallets, …) still talk to Supabase/mock until their phase lands —
// this client deliberately does not touch them.
//
// Token strategy mirrors the SPEC §5.2 SimpleJWT model: a short-lived access token
// + a long-lived refresh token kept in localStorage (same persistence the Supabase
// client used). On a 401 we transparently try the refresh token once.

const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000/api";

const ACCESS_KEY = "capimax.access";
const REFRESH_KEY = "capimax.refresh";

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string | null, refresh?: string | null) {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    else localStorage.removeItem(ACCESS_KEY);
    if (refresh !== undefined) {
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
      else localStorage.removeItem(REFRESH_KEY);
    }
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export interface ApiError extends Error {
  status?: number;
  data?: unknown;
}

function buildError(message: string, status?: number, data?: unknown): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  err.data = data;
  return err;
}

/** Pull the most useful message out of a DRF error body. */
function messageFromBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const b = body as Record<string, unknown>;
  if (typeof b.detail === "string") return b.detail;
  // DRF field errors: { field: ["msg", ...] } — surface the first one.
  for (const key of Object.keys(b)) {
    const v = b[key];
    if (Array.isArray(v) && v.length && typeof v[0] === "string") {
      return key === "non_field_errors" ? (v[0] as string) : `${v[0]}`;
    }
    if (typeof v === "string") return v;
  }
  return fallback;
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean; // attach the access token
  retryOn401?: boolean; // try a refresh once (default true for authed calls)
}

async function rawRequest(path: string, opts: RequestOptions): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth && tokenStore.access) {
    headers.Authorization = `Bearer ${tokenStore.access}`;
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && opts.auth && opts.retryOn401 !== false && tokenStore.refresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return rawRequest(path, { ...opts, retryOn401: false });
    }
  }

  const data = await parse(res);
  if (!res.ok) {
    throw buildError(messageFromBody(data, `Request failed (${res.status})`), res.status, data);
  }
  return data;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Exchange the refresh token for a fresh access token. Returns success. */
export function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = tokenStore.refresh;
  if (!refresh) return Promise.resolve(false);

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) {
        tokenStore.clear();
        return false;
      }
      const data = (await parse(res)) as { access?: string; refresh?: string } | null;
      if (data?.access) {
        tokenStore.set(data.access, data.refresh ?? refresh);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// --------------------------------------------------------------------------- //
// Auth API — the exact endpoints the Django core app exposes (SPEC §5.2).
// --------------------------------------------------------------------------- //
export interface ApiUser {
  id: string;
  email: string;
  is_email_verified?: boolean;
  profile?: { role?: string; role_status?: string; full_name?: string | null } | null;
}
export interface AuthResult {
  user: ApiUser;
  session: { access_token: string; refresh_token: string };
}

export const authApi = {
  async register(payload: {
    email: string;
    password: string;
    full_name?: string;
    phone?: string;
    is_us_citizen?: boolean;
    role?: string;
  }): Promise<void> {
    // Creates the account. We intentionally do NOT log the user in here — the
    // frontend shows a "check your email" screen and the user signs in next,
    // exactly as it did with Supabase email confirmation.
    await rawRequest("/auth/register/", { method: "POST", body: payload });
  },

  async login(email: string, password: string): Promise<AuthResult> {
    const data = (await rawRequest("/auth/login/", {
      method: "POST",
      body: { email, password },
    })) as AuthResult;
    tokenStore.set(data.session.access_token, data.session.refresh_token);
    return data;
  },

  async me(): Promise<ApiUser> {
    return (await rawRequest("/auth/me/", { auth: true })) as ApiUser;
  },

  async logout(): Promise<void> {
    const refresh = tokenStore.refresh;
    try {
      if (refresh) {
        await rawRequest("/auth/logout/", { method: "POST", auth: true, body: { refresh } });
      }
    } finally {
      tokenStore.clear();
    }
  },
};

// --------------------------------------------------------------------------- //
// Property read API (Phase 2) — PUBLIC (no auth). Replaces the static
// src/data/properties.ts as the data source for the property-reading screens.
// Returns the exact `Property` shape the components already consume.
// --------------------------------------------------------------------------- //
async function publicGet(path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  const data = await parse(res);
  if (!res.ok) {
    throw buildError(messageFromBody(data, `Request failed (${res.status})`), res.status, data);
  }
  return data;
}

export const propertiesApi = {
  /** Full catalogue (bare array) — Marketplace filters this client-side. */
  list: () => publicGet("/properties/") as Promise<any[]>,
  /** Full detail incl. the model-specific nested block + data room. */
  detail: (idOrSlug: string) => publicGet(`/properties/${idOrSlug}/`),
  /** Index featured carousel. */
  featured: () => publicGet("/properties/featured/") as Promise<any[]>,
  /** Closed deals for FundedProperties. */
  funded: () => publicGet("/properties/funded/") as Promise<any[]>,
};

// --------------------------------------------------------------------------- //
// Investment API (Phase 3 Wave 2) — authenticated. SPEC §4.1.
// The server computes amount, price, ownership and symbol from the REAL property;
// the client only chooses which property and how many tokens.
// --------------------------------------------------------------------------- //
export interface CreateInvestmentResult {
  success: boolean;
  investment_id?: string;
  tokens_minted?: boolean;
  certificate_generated?: boolean;
  // Machine-readable error code on rejection (e.g. "kyc_required" — Phase 4 gate).
  code?: string;
  error?: string;
}

export const investmentsApi = {
  /** Create an investment (simulated payment + auto-mint if a wallet exists). */
  create: (payload: {
    property_id: string;
    token_amount: number;
    payment_method: string;
  }) =>
    rawRequest("/investments/", {
      method: "POST",
      auth: true,
      body: payload,
    }) as Promise<CreateInvestmentResult>,
  /** Mint tokens for an already-paid investment (when the wallet came later). */
  mint: (investmentId: string) =>
    rawRequest(`/investments/${investmentId}/mint/`, {
      method: "POST",
      auth: true,
    }) as Promise<CreateInvestmentResult & { tx_hash?: string; pending_reason?: string }>,
  /** Read one of the caller's investments — used to POLL payment/mint status. */
  get: (investmentId: string) =>
    rawRequest(`/investments/${investmentId}/`, { auth: true }) as Promise<{
      id: string;
      payment_status: "pending" | "processing" | "completed" | "failed";
      tokens_minted: boolean;
      token_amount: number;
      token_symbol: string;
    }>,
};

// --------------------------------------------------------------------------- //
// Payments API (Phase 5 Wave 1) — Stripe card. SPEC §6.
// Raw card data NEVER passes through here: the browser confirms the card directly
// with Stripe using the client_secret; minting is gated on the Stripe webhook.
// --------------------------------------------------------------------------- //
export const paymentsApi = {
  /** Browser-safe publishable key (configured=false when Stripe is deferred). */
  stripeConfig: () =>
    rawRequest("/payments/stripe/config/", { auth: true }) as Promise<{
      configured: boolean;
      publishable_key: string;
    }>,
  /** Start a card payment for a (pending) investment → returns the client_secret. */
  createStripeIntent: (investmentId: string) =>
    rawRequest("/payments/stripe/create-intent/", {
      method: "POST",
      auth: true,
      body: { investment_id: investmentId },
    }) as Promise<{
      client_secret: string;
      publishable_key: string;
      payment_id: string;
      investment_id: string;
    }>,
  /**
   * Start a crypto payment (Wave 2, NOW Payments) for a (pending) investment →
   * returns the REAL deposit address + exact crypto amount + currency to display.
   * The buyer pays the address directly; minting is gated on the NOW IPN.
   */
  createNowPayment: (investmentId: string, payCurrency: string) =>
    rawRequest("/payments/nowpayments/create/", {
      method: "POST",
      auth: true,
      body: { investment_id: investmentId, pay_currency: payCurrency },
    }) as Promise<{
      payment_id: string;
      pay_address: string;
      pay_amount: string | null;
      pay_currency: string;
      investment_id: string;
    }>,
};

// --------------------------------------------------------------------------- //
// Wallet + KYC API (Phase 4) — authenticated. SPEC §3.4 / §3.2.
// Repoints the frontend's wallet/KYC/holdings layer off Supabase onto Django.
// --------------------------------------------------------------------------- //
export interface Wallet {
  id: string;
  wallet_address: string;
  network: string;
  wallet_type: string;
  created_at: string;
}

export interface KycStatus {
  status: "pending" | "submitted" | "approved" | "rejected";
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
}

export interface KycAccessToken {
  configured: boolean;
  token?: string;
  code?: string;
}

export const kycApi = {
  /** The caller's KYC status (defaults to a `pending` record server-side). */
  me: () => rawRequest("/kyc/me/", { auth: true }) as Promise<KycStatus>,
  /** Create/advance the KYC record to `submitted` and persist any personal info. */
  submit: (payload: Record<string, unknown> = {}) =>
    rawRequest("/kyc/submit/", { method: "POST", auth: true, body: payload }) as Promise<KycStatus>,
  /**
   * Issue a Sumsub WebSDK access token. When the provider is unconfigured (keys
   * deferred), the backend returns 503 + a machine code — we normalise that into
   * `{ configured: false, code }` so the UI degrades to the dev path, never throws.
   */
  accessToken: async (): Promise<KycAccessToken> => {
    try {
      return (await rawRequest("/kyc/access-token/", {
        method: "POST",
        auth: true,
      })) as KycAccessToken;
    } catch (err) {
      const data = ((err as ApiError).data ?? {}) as { configured?: boolean; code?: string };
      return { configured: false, code: data.code || "kyc_provider_unconfigured" };
    }
  },
};

export const walletsApi = {
  /** The caller's custodial wallet, or null when none exists yet (404). */
  me: async (): Promise<Wallet | null> => {
    try {
      return (await rawRequest("/wallets/me/", { auth: true })) as Wallet;
    } catch (err) {
      if ((err as ApiError).status === 404) return null;
      throw err;
    }
  },
  /** Create (or return the existing) custodial wallet. KYC-gated server-side. */
  create: () => rawRequest("/wallets/", { method: "POST", auth: true }) as Promise<Wallet>,
  /** The wallet's OwnershipToken positions (owner-only). */
  tokens: (walletId: string) =>
    rawRequest(`/wallets/${walletId}/tokens/`, { auth: true }) as Promise<any[]>,
  /** The wallet's on-chain transactions (owner-only). */
  transactions: (walletId: string) =>
    rawRequest(`/wallets/${walletId}/transactions/`, { auth: true }) as Promise<any[]>,
  /** The caller's internal USD proceeds balance (withdrawable). Phase 6 Wave 3. */
  balance: () =>
    rawRequest("/wallets/balance/", { auth: true }) as Promise<{
      current_balance: number;
      currency: string;
    }>,
  /** The caller's withdrawal history. */
  withdrawals: () => rawRequest("/wallets/withdrawals/", { auth: true }) as Promise<any[]>,
  /** Request a withdrawal of internal balance (debits it + records a pending request). */
  requestWithdrawal: (payload: { amount: number; method: string; notes?: string }) =>
    rawRequest("/wallets/withdrawals/", { method: "POST", auth: true, body: payload }),
};

// --------------------------------------------------------------------------- //
// Investor PEER secondary market (Phase 6 Wave 3) — one-shot listings, on-chain
// settlement server-side. SPEC §2.8/§3.9. (NOT the bid/ask order book — deferred.)
// --------------------------------------------------------------------------- //
export const secondaryMarketApi = {
  /** Browse: `my_listings` (own) + `listings` (others' listed inventory). */
  market: () =>
    rawRequest("/secondary-market/", { auth: true }) as Promise<{
      my_listings: any[];
      listings: any[];
    }>,
  /** List your UNLOCKED tokens (KYC-approved; server escrow-locks + computes the 0.5% fee). */
  listAsset: (payload: Record<string, unknown>) =>
    rawRequest("/secondary-market/", { method: "POST", auth: true, body: payload }),
  /** Seller-scoped cancel → unlock escrow. */
  cancelListing: (listingId: string) =>
    rawRequest(`/secondary-market/${listingId}/cancel/`, { method: "POST", auth: true }),
  /** Buy a listing (KYC-approved investor) → on-chain transfer + UserBalance settlement. */
  purchaseListing: (listingId: string) =>
    rawRequest(`/secondary-market/${listingId}/purchase/`, {
      method: "POST",
      auth: true,
    }) as Promise<{ completed: boolean; already?: boolean; tx_hash?: string; explorer_tx?: string }>,
  /** Completed trades involving the caller (trade history). */
  trades: () => rawRequest("/secondary-market/trades/", { auth: true }) as Promise<any[]>,
};

// --------------------------------------------------------------------------- //
// Certificate API (Phase 3 Wave 3) — SPEC §4.1 / §4.2 / §2.3.
// list/generate/download are authenticated; verify is PUBLIC (curated projection).
// --------------------------------------------------------------------------- //
export const certificatesApi = {
  /** The authenticated user's certificates. */
  list: () => rawRequest("/certificates/", { auth: true }) as Promise<any[]>,
  /** Generate (idempotent) the PDF for one of the user's investments. */
  generate: (investmentId: string, status: "provisional" | "final" = "provisional") =>
    rawRequest("/certificates/generate/", {
      method: "POST",
      auth: true,
      body: { investment_id: investmentId, status },
    }) as Promise<{ success: boolean; certificate?: any; error?: string }>,
  /** Owner download of the PDF blob (authenticated). */
  async downloadPdf(certificateId: string): Promise<Blob> {
    const res = await fetch(`${API_BASE_URL}/certificates/${certificateId}/pdf/`, {
      headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {},
    });
    if (!res.ok) {
      throw buildError(`Certificate download failed (${res.status})`, res.status);
    }
    return res.blob();
  },
  /** PUBLIC verification by code — returns the curated projection only. */
  verify: (code: string) => publicGet(`/certificates/verify/${code}/`),
};

// --------------------------------------------------------------------------- //
// Liquidity Provider API (Phase 6 Wave 1) — authenticated. SPEC §2.7 / §3.8.
// Repoints the LP onboarding layer (profile / KYB / wallet / transactions /
// documents) off Supabase onto Django. KYB approval is automatic via the signed
// Sumsub webhook (business level); the WebSDK access-token degrades to 503 (then
// the form/dev path) when keys are deferred. The LP secondary market is a later
// wave and is intentionally NOT touched here.
// --------------------------------------------------------------------------- //

/** Authed multipart upload (files). Retries once on a 401, like rawRequest. */
async function rawUpload(
  path: string,
  form: FormData,
  method = "POST",
  retryOn401 = true,
): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;
  const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: form });
  if (res.status === 401 && retryOn401 && tokenStore.refresh) {
    const refreshed = await tryRefresh();
    if (refreshed) return rawUpload(path, form, method, false);
  }
  const data = await parse(res);
  if (!res.ok) {
    throw buildError(messageFromBody(data, `Upload failed (${res.status})`), res.status, data);
  }
  return data;
}

export interface LpKybAccessToken {
  configured: boolean;
  token?: string;
  code?: string;
}

export const lpApi = {
  /** The caller's LP profile, or null when none exists yet (404). */
  profile: async (): Promise<any | null> => {
    try {
      return await rawRequest("/lp/profile/", { auth: true });
    } catch (err) {
      if ((err as ApiError).status === 404) return null;
      throw err;
    }
  },
  /** Apply as an LP (idempotent server-side). */
  apply: (payload: Record<string, unknown>) =>
    rawRequest("/lp/profile/", { method: "POST", auth: true, body: payload }),
  updateBankDetails: (payload: Record<string, unknown>) =>
    rawRequest("/lp/profile/bank-details/", { method: "PATCH", auth: true, body: payload }),
  updateCryptoDetails: (payload: Record<string, unknown>) =>
    rawRequest("/lp/profile/crypto-details/", { method: "PATCH", auth: true, body: payload }),
  /** The caller's LP ledger. */
  transactions: () => rawRequest("/lp/transactions/", { auth: true }) as Promise<any[]>,
  /** Create a withdrawal request (a pending transaction). */
  requestWithdrawal: (payload: Record<string, unknown>) =>
    rawRequest("/lp/withdrawals/", { method: "POST", auth: true, body: payload }),
  /** Own documents + shared templates. */
  documents: () => rawRequest("/lp/documents/", { auth: true }) as Promise<any[]>,
  uploadDocument: (file: File, documentType: string, documentName: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("document_type", documentType);
    form.append("document_name", documentName);
    return rawUpload("/lp/documents/", form);
  },
  deleteDocument: (docId: string) =>
    rawRequest(`/lp/documents/${docId}/`, { method: "DELETE", auth: true }),
  /** Owner/template file blob (the frontend triggers a browser download). */
  async downloadDocument(docId: string): Promise<Blob> {
    const res = await fetch(`${API_BASE_URL}/lp/documents/${docId}/download/`, {
      headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {},
    });
    if (!res.ok) throw buildError(`Document download failed (${res.status})`, res.status);
    return res.blob();
  },
  /** Persist business info → KYB under_review. */
  submitKYB: (payload: Record<string, unknown>) =>
    rawRequest("/lp/kyb/submit/", { method: "POST", auth: true, body: payload }),
  uploadKYBDocument: (file: File, documentType: string, documentName: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("document_type", documentType);
    form.append("document_name", documentName);
    return rawUpload("/lp/kyb/documents/", form);
  },
  /**
   * Sumsub WebSDK access token for KYB. When the provider is unconfigured (keys
   * deferred), the backend returns 503 + a machine code — we normalise that into
   * `{ configured: false, code }` so the UI keeps the form/dev path, never throws.
   */
  kybAccessToken: async (): Promise<LpKybAccessToken> => {
    try {
      return (await rawRequest("/lp/kyb/access-token/", {
        method: "POST",
        auth: true,
      })) as LpKybAccessToken;
    } catch (err) {
      const data = ((err as ApiError).data ?? {}) as { configured?: boolean; code?: string };
      return { configured: false, code: data.code || "kyb_provider_unconfigured" };
    }
  },

  // --- LP secondary market (Phase 6 Wave 2) — on-chain settlement server-side. --- //
  /** Both arrays the market hook needs: `my_listings` (always) + `listings` (approved LPs only). */
  market: () =>
    rawRequest("/lp/market/", { auth: true }) as Promise<{
      my_listings: any[];
      listings: any[];
    }>,
  /** List your UNLOCKED tokens for sale (server escrow-locks them + computes fees). */
  listAsset: (payload: Record<string, unknown>) =>
    rawRequest("/lp/market/", { method: "POST", auth: true, body: payload }),
  /** Seller-scoped cancel → unlock the escrow. */
  cancelListing: (listingId: string) =>
    rawRequest(`/lp/market/${listingId}/cancel/`, { method: "POST", auth: true }),
  /** Approved-LP purchase → on-chain transfer + balance settlement (returns the real tx). */
  purchaseListing: (listingId: string) =>
    rawRequest(`/lp/market/${listingId}/purchase/`, { method: "POST", auth: true }) as Promise<{
      completed: boolean;
      already?: boolean;
      tx_hash?: string;
      explorer_tx?: string;
    }>,
  /** The caller's LP holdings. */
  holdings: () => rawRequest("/lp/holdings/", { auth: true }) as Promise<any[]>,
  /** Update a holding's status (resale lifecycle). */
  updateHolding: (holdingId: string, payload: Record<string, unknown>) =>
    rawRequest(`/lp/holdings/${holdingId}/`, { method: "PATCH", auth: true, body: payload }),
};

// --------------------------------------------------------------------------- //
// Property Owner API (Phase 7 Wave A) — authenticated. OWNER_SURFACE.md.
// Owner ENTITY verification (business KYB) only — mirrors lpApi's KYB subset. KYB
// approval is automatic via the signed Sumsub webhook (owner business level); the
// WebSDK access-token degrades to 503 (then the form/dev path) when keys are
// deferred. Property submission / earnings are later waves and NOT touched here.
// --------------------------------------------------------------------------- //
export interface OwnerKybAccessToken {
  configured: boolean;
  token?: string;
  code?: string;
}

export const ownerApi = {
  /** The caller's owner profile, or null when none exists yet (404). */
  profile: async (): Promise<any | null> => {
    try {
      return await rawRequest("/owner/profile/", { auth: true });
    } catch (err) {
      if ((err as ApiError).status === 404) return null;
      throw err;
    }
  },
  /** Apply as a property owner (idempotent server-side). */
  apply: (payload: Record<string, unknown>) =>
    rawRequest("/owner/profile/", { method: "POST", auth: true, body: payload }),
  /** Persist business info → owner KYB under_review. */
  submitKYB: (payload: Record<string, unknown>) =>
    rawRequest("/owner/kyb/submit/", { method: "POST", auth: true, body: payload }),
  /**
   * Sumsub WebSDK access token for owner KYB. When the provider is unconfigured
   * (keys deferred), the backend returns 503 + a machine code — we normalise that
   * into `{ configured: false, code }` so the UI keeps the form/dev path, never throws.
   */
  kybAccessToken: async (): Promise<OwnerKybAccessToken> => {
    try {
      return (await rawRequest("/owner/kyb/access-token/", {
        method: "POST",
        auth: true,
      })) as OwnerKybAccessToken;
    } catch (err) {
      const data = ((err as ApiError).data ?? {}) as { configured?: boolean; code?: string };
      return { configured: false, code: data.code || "kyb_provider_unconfigured" };
    }
  },

  // --- Property submission intake (Phase 7 Wave B) — gated to approved owners. --- //
  /** The caller's property submissions (drafts + submitted). */
  submissions: () => rawRequest("/owner/submissions/", { auth: true }) as Promise<any[]>,
  /** One of the caller's submissions (owner-scoped; 404 otherwise). */
  submission: (id: string) =>
    rawRequest(`/owner/submissions/${id}/`, { auth: true }),
  /** Create a new DRAFT submission. */
  createSubmission: (payload: Record<string, unknown>) =>
    rawRequest("/owner/submissions/", { method: "POST", auth: true, body: payload }),
  /** Edit a draft submission's content (draft only, server-enforced). */
  updateSubmission: (id: string, payload: Record<string, unknown>) =>
    rawRequest(`/owner/submissions/${id}/`, { method: "PATCH", auth: true, body: payload }),
  /** Transition a draft → submitted (server validates required documents). */
  submitSubmission: (id: string) =>
    rawRequest(`/owner/submissions/${id}/submit/`, { method: "POST", auth: true }),
  /** A submission's documents. */
  submissionDocuments: (id: string) =>
    rawRequest(`/owner/submissions/${id}/documents/`, { auth: true }) as Promise<any[]>,
  /** Upload a document to a draft submission (multipart). */
  uploadSubmissionDocument: (id: string, file: File, documentType: string, documentName: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("document_type", documentType);
    form.append("document_name", documentName);
    return rawUpload(`/owner/submissions/${id}/documents/`, form);
  },
  /** Delete a document from a draft submission. */
  deleteSubmissionDocument: (id: string, docId: string) =>
    rawRequest(`/owner/submissions/${id}/documents/${docId}/`, { method: "DELETE", auth: true }),

  // --- Owner earnings / ledger (Phase 7 Wave D) — primary-sale proceeds. --- //
  /** The caller's primary-sale earnings per owned property + totals. */
  earnings: () =>
    rawRequest("/owner/earnings/", { auth: true }) as Promise<{
      total_net_proceeds: number;
      total_units_sold: number;
      total_investors: number;
      properties: Array<{
        property_id: string;
        property_name: string;
        is_published: boolean;
        token_supply: number;
        units_sold: number;
        investors: number;
        gross_proceeds: number;
        fees: number;
        net_proceeds: number;
      }>;
    }>,
};

// --------------------------------------------------------------------------- //
// Developer ENTITY verification (business KYB) only — Phase 8 Wave A. Mirrors
// ownerApi's KYB subset exactly. KYB approval is automatic via the signed Sumsub
// webhook (developer business level); the WebSDK access-token degrades to 503 (then
// the form/dev path) when keys are deferred. Property submission / earnings are later
// waves that REUSE the owner surfaces and are NOT touched here. (NOTE: unrelated to
// the /developers API hub — that is for software developers, not the property role.)
// --------------------------------------------------------------------------- //
export interface DeveloperKybAccessToken {
  configured: boolean;
  token?: string;
  code?: string;
}

export const developerApi = {
  /** The caller's developer profile, or null when none exists yet (404). */
  profile: async (): Promise<any | null> => {
    try {
      return await rawRequest("/developer/profile/", { auth: true });
    } catch (err) {
      if ((err as ApiError).status === 404) return null;
      throw err;
    }
  },
  /** Apply as a property developer (idempotent server-side). */
  apply: (payload: Record<string, unknown>) =>
    rawRequest("/developer/profile/", { method: "POST", auth: true, body: payload }),
  /** Persist business info → developer KYB under_review. */
  submitKYB: (payload: Record<string, unknown>) =>
    rawRequest("/developer/kyb/submit/", { method: "POST", auth: true, body: payload }),
  /**
   * Sumsub WebSDK access token for developer KYB. When the provider is unconfigured
   * (keys deferred), the backend returns 503 + a machine code — we normalise that into
   * `{ configured: false, code }` so the UI keeps the form/dev path, never throws.
   */
  kybAccessToken: async (): Promise<DeveloperKybAccessToken> => {
    try {
      return (await rawRequest("/developer/kyb/access-token/", {
        method: "POST",
        auth: true,
      })) as DeveloperKybAccessToken;
    } catch (err) {
      const data = ((err as ApiError).data ?? {}) as { configured?: boolean; code?: string };
      return { configured: false, code: data.code || "kyb_provider_unconfigured" };
    }
  },
};

export { API_BASE_URL };
