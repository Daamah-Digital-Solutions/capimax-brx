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
    ref?: string; // broker referral code carried from a /ref/<code> link (Phase 12 Wave A)
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
  /**
   * Create an investment. Normal buy: server charges the full price.
   * Installment (Wave B): pass `is_installment` + the terms — the server charges only
   * the DOWN-PAYMENT (settlement-gated) and mints the full position LOCKED on the webhook.
   */
  create: (payload: {
    property_id: string;
    token_amount: number;
    payment_method: string;
    is_installment?: boolean;
    down_payment_percent?: number;
    n_installments?: number;
    frequency?: "monthly" | "quarterly";
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
  /**
   * DEPOSIT / top-up (card) — start a Stripe charge that CREDITS the caller's balance
   * (no investment, no mint). Returns the client_secret to confirm with Elements. The
   * balance is credited only on the confirmed webhook. 503 ⇒ Stripe not configured.
   */
  createDepositStripe: (amount: number) =>
    rawRequest("/payments/deposit/stripe/", {
      method: "POST",
      auth: true,
      body: { amount },
    }) as Promise<{
      client_secret: string;
      publishable_key: string;
      payment_id: string;
      deposit_id: string;
    }>,
  /**
   * DEPOSIT / top-up (crypto) — start a NOW Payments charge that CREDITS the balance →
   * returns the REAL deposit address + amount. Credited only on the confirmed IPN.
   * 503 ⇒ NOW not configured.
   */
  createDepositNow: (amount: number, payCurrency: string) =>
    rawRequest("/payments/deposit/nowpayments/", {
      method: "POST",
      auth: true,
      body: { amount, pay_currency: payCurrency },
    }) as Promise<{
      payment_id: string;
      pay_address: string;
      pay_amount: string | null;
      pay_currency: string;
      deposit_id: string;
    }>,
};

// --------------------------------------------------------------------------- //
// Reinvestments — spend accrued internal balance (distribution/sale yield) to buy more
// tokens via the normal invest+mint path (payment_method="balance"; no PSP). The buy is
// the existing investmentsApi.create with payment_method:"balance"; this api only reads
// the self-scoped HISTORY (balance-funded investments). Available balance = walletsApi
// .balance(). NO bonus/discount in v1 (deferred product decision). REINVESTMENTS_SURFACE.md.
// --------------------------------------------------------------------------- //
export interface ReinvestmentRow {
  id: string;
  property_id: string;
  property_name: string;
  source_amount: number;       // amount spent from balance (== net; no discount in v1)
  discount_amount: number;     // always 0 in v1 (bonus deferred)
  net_investment_value: number;
  token_amount: number;
  token_symbol: string;
  tokens_minted: boolean;
  status: "completed" | "pending" | "failed" | string;
  created_at: string;
}

export const reinvestmentsApi = {
  /** The caller's reinvestments (balance-funded buys), newest first. */
  history: () =>
    rawRequest("/investments/reinvestments/", { auth: true }) as Promise<ReinvestmentRow[]>,
};

// --------------------------------------------------------------------------- //
// Family accounts (Wave A) — self-scoped records + allocation config. Repoints the LAST
// Supabase-backed domain onto Django. NO money/tokens/payout this wave: a "transfer" writes a
// record-only FamilyTransaction (status pending), banks are stored MASKED (last-4 only), and
// members are passive sub-records (no user/KYC/wallet). FAMILY_SURFACE.md.
// --------------------------------------------------------------------------- //
export interface FamilyAccountRow {
  id: string;
  investor_id: string;
  member_name: string;
  member_email: string;
  relationship: string;
  status: "pending" | "active" | "suspended";
  access_level: "view_only" | "authorized";
  allocated_returns_percent: number;
  total_transferred: number;
  linked_at: string;
  created_at: string;
  updated_at: string;
}
export interface FamilyBankAccountRow {
  id: string;
  family_account_id: string;
  bank_name: string;
  bank_code: string | null;
  account_holder_name: string;
  account_number_masked: string;
  iban_masked: string | null;
  currency: string;
  is_verified: boolean;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}
export interface FamilyTransferScheduleRow {
  id: string;
  family_account_id: string;
  bank_account_id: string;
  schedule_type: "immediate" | "weekly" | "monthly" | "quarterly" | "threshold";
  threshold_amount: number | null;
  next_transfer_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface FamilyTransactionRow {
  id: string;
  family_account_id: string;
  bank_account_id: string | null;
  transaction_type: string;
  amount: number | null;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed";
  reference_number: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  initiated_by: string;
  created_at: string;
}

export const familyApi = {
  accounts: () => rawRequest("/family/accounts/", { auth: true }) as Promise<FamilyAccountRow[]>,
  createAccount: (payload: { member_name: string; member_email: string; relationship: string }) =>
    rawRequest("/family/accounts/", { method: "POST", auth: true, body: payload }) as Promise<FamilyAccountRow>,
  /** Partial update: member fields, status, access_level, and/or allocated_returns_percent (≤100% enforced server-side). */
  updateAccount: (id: string, payload: Record<string, unknown>) =>
    rawRequest(`/family/accounts/${id}/`, { method: "PATCH", auth: true, body: payload }) as Promise<FamilyAccountRow>,
  deleteAccount: (id: string) =>
    rawRequest(`/family/accounts/${id}/`, { method: "DELETE", auth: true }),
  banks: () => rawRequest("/family/banks/", { auth: true }) as Promise<FamilyBankAccountRow[]>,
  /** Link a bank. The full account_number/iban are MASKED server-side and never stored. */
  addBank: (payload: Record<string, unknown>) =>
    rawRequest("/family/banks/", { method: "POST", auth: true, body: payload }) as Promise<FamilyBankAccountRow>,
  schedules: () => rawRequest("/family/schedules/", { auth: true }) as Promise<FamilyTransferScheduleRow[]>,
  createSchedule: (payload: Record<string, unknown>) =>
    rawRequest("/family/schedules/", { method: "POST", auth: true, body: payload }) as Promise<FamilyTransferScheduleRow>,
  transactions: () => rawRequest("/family/transactions/", { auth: true }) as Promise<FamilyTransactionRow[]>,
  /** RECORD-ONLY transfer intent (status pending). Moves NO money/tokens this wave. */
  recordTransfer: (payload: { family_account_id: string; bank_account_id?: string; amount: number; transfer_type?: string; description?: string }) =>
    rawRequest("/family/transactions/", { method: "POST", auth: true, body: payload }) as Promise<FamilyTransactionRow>,
};

// --------------------------------------------------------------------------- //
// PWA settings — a SINGLETON global-config row (app branding + install-prompt
// toggle), repointed off Supabase. GET is public (the app reads its own branding
// + install gate); the WRITE is ADMIN-ONLY (global config). No PII/secrets.
// --------------------------------------------------------------------------- //

export interface PWASettingsRow {
  id: number;
  app_name: string;
  app_short_name: string;
  app_description: string;
  theme_color: string;
  background_color: string;
  install_prompt_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const pwaSettingsApi = {
  /** The singleton config (readable app-wide for branding). */
  get: () => rawRequest("/pwa-settings/") as Promise<PWASettingsRow>,
  /** Admin-only partial update of global app config (403 for non-admins). */
  update: (payload: Partial<PWASettingsRow>) =>
    rawRequest("/pwa-settings/", { method: "PATCH", auth: true, body: payload }) as Promise<PWASettingsRow>,
};

// --------------------------------------------------------------------------- //
// Support / tickets — the backend for Support.tsx (was 100% mock). Self-scoped CRUD:
// the caller's own tickets + a real unresolved count; the New-Ticket form POSTs here.
// Fields mirror the form EXACTLY (subject / category / priority / details + the open/
// pending/resolved status the badges render). AI-assistant + live-chat stay deferred.
// --------------------------------------------------------------------------- //
export interface SupportTicketRow {
  id: string;
  reference: string;             // TKT-#### (the list's mono ref)
  subject: string;
  category: "investment" | "payments" | "account" | "technical" | "other" | string;
  priority: "low" | "medium" | "high" | string;
  details: string;
  status: "open" | "pending" | "resolved" | string;
  created_at: string;
  updated_at: string;
}
export interface SupportTicketsResponse {
  tickets: SupportTicketRow[];
  unresolved_count: number;      // real count (open + pending) for the tab badge
}

export const supportApi = {
  /** The caller's own tickets (newest first) + the real unresolved count. */
  tickets: () =>
    rawRequest("/support/tickets/", { auth: true }) as Promise<SupportTicketsResponse>,
  /** Submit a new ticket (the New-Ticket form). */
  create: (payload: { subject: string; category: string; priority: string; details: string }) =>
    rawRequest("/support/tickets/", { method: "POST", auth: true, body: payload }) as Promise<SupportTicketRow>,
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

/** An internal-balance ledger entry (credit/debit). `source` localized on the frontend. */
export interface BalanceTransactionRow {
  id: string;
  entry_type: "credit" | "debit";
  amount: number;
  source: string;   // distribution | secondary_sale | broker_commission | primary_sale | withdrawal | ...
  reference: string;
  memo: string;
  created_at: string;
}

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
  /** The caller's internal-balance ledger history (credits/debits, self-scoped). */
  balanceTransactions: () =>
    rawRequest("/wallets/balance/transactions/", { auth: true }) as Promise<BalanceTransactionRow[]>,
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
// Owner-documents — a self-scoped personal document VAULT, repointed off Supabase
// onto Django. Mirrors the lpApi document pattern verbatim: list / multipart upload
// (rawUpload) / delete / owner-only blob download (FileResponse, not a signed URL).
// Server-side type+size validation lives on the backend. NO Property FK; the
// PropertyDetail data-room is a separate deferred surface. OWNER_DOCUMENTS.md.
// --------------------------------------------------------------------------- //

export interface OwnerDocumentRow {
  id: string;
  user_id: string;
  document_name: string;
  document_type: string;
  file_path: string | null;
  file_size: number | null;
  file_type: string | null;
  description: string | null;
  property_name: string | null;
  status: string;
  uploaded_at: string;
  created_at: string;
}

export const ownerDocumentsApi = {
  /** The caller's own documents (self-scoped, newest first). */
  list: () => rawRequest("/owner-documents/", { auth: true }) as Promise<OwnerDocumentRow[]>,
  /** Upload a document (multipart). The server validates type + size. */
  upload: (
    file: File,
    documentType: string,
    opts?: { documentName?: string; propertyName?: string; description?: string },
  ) => {
    const form = new FormData();
    form.append("file", file);
    form.append("document_type", documentType);
    form.append("document_name", opts?.documentName || file.name);
    if (opts?.propertyName) form.append("property_name", opts.propertyName);
    if (opts?.description) form.append("description", opts.description);
    return rawUpload("/owner-documents/", form) as Promise<OwnerDocumentRow>;
  },
  /** Delete one of the caller's own documents (removes row + file). */
  delete: (docId: string) =>
    rawRequest(`/owner-documents/${docId}/`, { method: "DELETE", auth: true }),
  /** Owner-only file blob (the frontend opens or downloads it). */
  async download(docId: string): Promise<Blob> {
    const res = await fetch(`${API_BASE_URL}/owner-documents/${docId}/download/`, {
      headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {},
    });
    if (!res.ok) throw buildError(`Document download failed (${res.status})`, res.status);
    return res.blob();
  },
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

// --------------------------------------------------------------------------- //
// Investor distributions API (Phase 9) — authenticated, READ-ONLY. SPEC §3.
// Backs Distributions.tsx (rental/appreciation cash yield paid to token holders).
// Declaring a distribution is an admin-only action (Django admin), never a client
// write — so this exposes only the self-scoped read. DISTRIBUTIONS_SURFACE.md.
// --------------------------------------------------------------------------- //
export interface DistributionRow {
  id: string;
  propertyId: string;
  property: string;    // Arabic name
  propertyEn: string;  // English name
  amount: number;
  type: string;        // cadence: "monthly" | "quarterly" | …
  period: string;      // e.g. "Q4 2024"
  date: string;        // pay date (ISO)
  status: string;      // "paid" in v1
  yield: number;       // annual % (from the property)
}
export interface DistributionByProperty {
  id: string;          // property slug
  name: string;        // Arabic name
  nameEn: string;      // English name
  totalDistributed: number;
  annualYield: number;
  type: string;        // cadence
  nextPayment: string | null;
  status: string;      // "active"
  series: number[];    // real monthly payout totals (USD), chronological — sparkline
}
export interface DistributionsResponse {
  stats: {
    totalReceived: number;
    pendingAmount: number;
    nextPaymentDate: string | null;
    yearToDate: number;
    averageMonthly: number;
    propertiesDistributing: number;
    vsLastYear: number | null;  // real YoY % change; null when no prior-year data
  };
  distributions: DistributionRow[];
  by_property: DistributionByProperty[];
}

export const distributionsApi = {
  /** The caller's own distribution payouts: summary + history rows + per-property rollup. */
  list: () =>
    rawRequest("/distributions/", { auth: true }) as Promise<DistributionsResponse>,
};

// --------------------------------------------------------------------------- //
// Installments API (Wave A) — authenticated, self-scoped. Backs the investor
// Installments.tsx page: the caller's own installment PLANS + their cent-exact
// schedules. READ-ONLY this wave — there is NO "pay installment" endpoint yet
// (the down-payment charge + full-mint-then-lock + per-installment payments are
// later waves). INSTALLMENTS_SURFACE.md.
// --------------------------------------------------------------------------- //
export interface InstallmentSchedulePayment {
  sequence: number;                 // 0 = synthesized down-payment display row; 1..N = installments
  type: "down_payment" | "installment";
  date: string;                     // ISO date
  amount: number;
  status: "pending" | "paid" | "missed";
}

export interface InstallmentPlanRow {
  id: string;
  propertyId: string;               // Property.slug (links to /property/:slug)
  property: string;                 // AR name
  propertyEn: string;               // EN name
  status: "draft" | "active" | "completed" | "defaulted";
  totalAmount: number;
  downPayment: number;
  downPaymentPercent: number;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  remainingInstallments: number;
  frequency: "monthly" | "quarterly";
  durationMonths: number;
  nextDueDate: string | null;
  progress: number;                 // released/paid % (down-payment once confirmed; + installments in Wave C)
  downPaid: boolean;                // the down-payment has confirmed (plan active)
  // Real on-chain token split (full-mint-then-lock). null until the down-payment mints.
  // After a DEFAULT (Wave D), tokenAmount/releasedTokens reflect the KEPT (paid) position.
  tokenAmount: number | null;
  releasedTokens: number | null;
  lockedTokens: number | null;
  forfeitedTokens: number;          // unpaid tokens forfeited on default (0 otherwise)
  defaultedAt: string | null;       // ISO when the plan defaulted (null otherwise)
  payments: InstallmentSchedulePayment[];
}

export interface InstallmentsResponse {
  stats: {
    totalCommitment: number;
    totalPaid: number;
    remainingAmount: number;
    nextPaymentAmount: number;
    nextPaymentDate: string | null;
    activePlans: number;
    completedPlans: number;
  };
  plans: InstallmentPlanRow[];
}

/** Wave C: the gated charge for the NEXT due installment (Stripe client_secret OR NOW address). */
export interface PayNextStripeResult {
  provider: "stripe";
  client_secret: string;
  publishable_key: string;
  payment_id: string;
  installment_payment_id: string;
  sequence: number;
  amount: string;
}
export interface PayNextNowResult {
  provider: "nowpayments";
  payment_id: string;
  pay_address: string;
  pay_amount: string | null;
  pay_currency: string;
  installment_payment_id: string;
  sequence: number;
  amount: string;
}
export type PayNextResult = PayNextStripeResult | PayNextNowResult;

export const installmentsApi = {
  /** The caller's own installment plans + schedules. */
  plans: () =>
    rawRequest("/installments/plans/", { auth: true }) as Promise<InstallmentsResponse>,
  /**
   * Wave C: start a GATED charge for the plan's NEXT due installment. Card returns a Stripe
   * client_secret (confirmed in-browser); crypto returns a real NOW deposit address. On the
   * confirmed webhook/IPN the server progressively releases locked→released tokens + credits
   * the owner/broker on that installment — there is NO new mint.
   */
  payNext: (planId: string, provider: "stripe" | "nowpayments", payCurrency?: string) =>
    rawRequest(`/installments/plans/${planId}/pay-next/`, {
      method: "POST",
      auth: true,
      body: { provider, ...(payCurrency ? { pay_currency: payCurrency } : {}) },
    }) as Promise<PayNextResult>,
};

// --------------------------------------------------------------------------- //
// In-app notifications API (Phase 10) — authenticated, self-scoped. Backs the bell
// + the Notifications page. The backend stores type + params + action_url (NO display
// strings); the frontend renders EN/AR copy from its i18n layer keyed by `type`.
// Emitted server-side at event points; no client create. NOTIFICATIONS_SURFACE.md.
// --------------------------------------------------------------------------- //
export interface ApiNotification {
  id: string;
  type: string;                       // event type (kyc_approved, distribution_credited, …)
  params: Record<string, unknown>;    // interpolation values for the copy
  action_url: string;
  read: boolean;
  created_at: string;
}

export const notificationsApi = {
  /** The caller's notifications (own, not deleted, newest first). */
  list: () => rawRequest("/notifications/", { auth: true }) as Promise<ApiNotification[]>,
  /** The caller's unread count (drives the bell badge). */
  unreadCount: () =>
    rawRequest("/notifications/unread-count/", { auth: true }) as Promise<{ unread: number }>,
  /** Mark one notification read. */
  markRead: (id: string) =>
    rawRequest(`/notifications/${id}/read/`, { method: "POST", auth: true }) as Promise<ApiNotification>,
  /** Mark all the caller's unread notifications read. */
  markAllRead: () =>
    rawRequest("/notifications/mark-all-read/", { method: "POST", auth: true }) as Promise<{ updated: number }>,
  /** Soft-delete one notification (hidden from the list). */
  delete: (id: string) =>
    rawRequest(`/notifications/${id}/delete/`, { method: "POST", auth: true }),
  /** The caller's per-type notification preferences (the 7 settings toggles). */
  preferences: () =>
    rawRequest("/notifications/preferences/", { auth: true }) as Promise<NotificationPreferences>,
  /** Update one or more per-type toggles (partial). Returns the full saved prefs. */
  updatePreferences: (patch: Partial<NotificationPreferences>) =>
    rawRequest("/notifications/preferences/", { method: "PATCH", auth: true, body: patch }) as Promise<NotificationPreferences>,
};

// The 7 per-type toggles the Notifications settings column persists (in-app only).
// Channel (email/SMS) + digest toggles are NOT here — no mailer/SMS/scheduler exists.
export interface NotificationPreferences {
  distributions: boolean;
  installments: boolean;
  newProperties: boolean;
  reports: boolean;
  priceAlerts: boolean;
  marketUpdates: boolean;
  security: boolean;
}

// --------------------------------------------------------------------------- //
// Strategic Partner API (Phase 11 Wave A) — partner ENTITY verification (business KYB)
// + the partner's own public-directory details + the PUBLIC partners directory.
// Mirrors developerApi for the KYB half: apply → submit business info → request a
// Sumsub WebSDK token (partner business level); approval is driven by the signed webhook
// on the backend. The partner is a SERVICE VENDOR (NON-EARNING) — NO money endpoints.
//
// TWO INDEPENDENT states the partner sees: `status`/`kyb_status` (verification) and
// `directory_status` (whether they appear in the public directory — a separate admin
// approve/reject step). PARTNERS_SURFACE.md.
// --------------------------------------------------------------------------- //
export interface PartnerKybAccessToken {
  configured: boolean;
  token?: string;
  code?: string;
}

// Wave B — assignment / deliverable work portal (StrategicPartners.tsx). Shaped to the
// AssignedAsset/Deliverable mock so the page maps 1:1; `type`/`location` are localized on
// the frontend from `service_type` + the bilingual fields. NON-EARNING — no money fields.
export interface ApiDeliverable {
  id: string;
  name: string;        // Arabic (falls back to English)
  nameEn: string;
  status: "pending" | "submitted" | "approved" | "revision";
  dueDate: string | null;
  has_document: boolean;
}
export interface ApiAssignment {
  id: string;
  name: string;        // Arabic property name
  nameEn: string;      // English property name
  service_type: "valuation" | "property-management" | "insurance";
  location: string;    // English
  location_ar: string; // Arabic
  assignedDate: string;
  dueDate: string | null;
  status: "pending" | "in-progress" | "submitted" | "approved" | "revision";
  progress: number;
  notes: string;
  review_notes: string;
  deliverables: ApiDeliverable[];
}
export interface ApiAssignmentEvent {
  id: string;
  event_type: "assigned" | "uploaded" | "submitted" | "approved" | "revision_requested" | "completed";
  property: string;     // English
  property_ar: string;  // Arabic
  deliverable: string;
  created_at: string;
}
export interface AssignmentsResponse {
  assignments: ApiAssignment[];
  activity: ApiAssignmentEvent[];
}

/** A public-directory row (Partners.tsx shape). Only directory-approved partners. */
export interface PublicPartner {
  id: string;
  name: string | null;
  nameAr: string | null;
  category: string | null;
  description: string | null;
  descriptionAr: string | null;
  logo_url: string | null;
  country: string | null;
  countryAr: string | null;
  website: string | null;
  verified: boolean;
}

export const partnerApi = {
  /** The caller's partner profile, or null when none exists yet (404). */
  profile: async (): Promise<any | null> => {
    try {
      return await rawRequest("/partner/profile/", { auth: true });
    } catch (err) {
      if ((err as ApiError).status === 404) return null;
      throw err;
    }
  },
  /** Apply as a partner (idempotent server-side); may carry directory fields. */
  apply: (payload: Record<string, unknown>) =>
    rawRequest("/partner/profile/", { method: "POST", auth: true, body: payload }),
  /** Update the partner's own public-directory fields (no status change). */
  updateDirectory: (payload: Record<string, unknown>) =>
    rawRequest("/partner/profile/", { method: "POST", auth: true, body: payload }),
  /** Persist business info → partner KYB under_review. */
  submitKYB: (payload: Record<string, unknown>) =>
    rawRequest("/partner/kyb/submit/", { method: "POST", auth: true, body: payload }),
  /**
   * Sumsub WebSDK access token for partner KYB. When the provider is unconfigured
   * (keys deferred), the backend returns 503 + a machine code — we normalise that into
   * `{ configured: false, code }` so the UI keeps the form/dev path, never throws.
   */
  kybAccessToken: async (): Promise<PartnerKybAccessToken> => {
    try {
      return (await rawRequest("/partner/kyb/access-token/", {
        method: "POST",
        auth: true,
      })) as PartnerKybAccessToken;
    } catch (err) {
      const data = ((err as ApiError).data ?? {}) as { configured?: boolean; code?: string };
      return { configured: false, code: data.code || "kyb_provider_unconfigured" };
    }
  },
  /** The PUBLIC partners directory (AllowAny) — only directory-approved partners. */
  directory: () =>
    rawRequest("/partners/directory/", {}) as Promise<PublicPartner[]>,

  // --- Wave B: the partner's own assignments / deliverable work portal. ----- //
  /** The caller-partner's assignments + the derived activity feed. */
  assignments: () =>
    rawRequest("/partner/assignments/", { auth: true }) as Promise<AssignmentsResponse>,
  /** One of the caller-partner's own assignments. */
  assignment: (id: string) =>
    rawRequest(`/partner/assignments/${id}/`, { auth: true }) as Promise<ApiAssignment>,
  /** Mark an assignment ready for review (→ submitted). */
  submitAssignment: (id: string) =>
    rawRequest(`/partner/assignments/${id}/submit/`, { method: "POST", auth: true }) as Promise<ApiAssignment>,
  /**
   * Upload a document for one deliverable (multipart). Returns the refreshed assignment
   * (updated status/progress). Uses fetch directly for the FormData body.
   */
  uploadDeliverable: async (deliverableId: string, file: File): Promise<ApiAssignment> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE_URL}/partner/deliverables/${deliverableId}/upload/`, {
      method: "POST",
      headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {},
      body: form,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw buildError((data as any)?.detail || `Upload failed (${res.status})`, res.status, data);
    }
    return (await res.json()) as ApiAssignment;
  },
};

// --------------------------------------------------------------------------- //
// Broker API (Phase 12 Wave A) — BROKER_SURFACE.md. HYBRID verification: identity reuses
// the EXISTING investor KYC surface (/api/kyc/*); the broker-specific half is a
// professional LICENCE (admin-approved hinge). Plus referral attribution.
//
// THIS WAVE has NO money/commission endpoints — only verification + the referral code.
// --------------------------------------------------------------------------- //
export interface BrokerProfile {
  id: string;
  user_id: string;
  contact_name: string;
  email: string;
  phone: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  applied_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  license_number: string | null;
  license_authority: string | null;
  license_expiry: string | null;
  has_license_document: boolean;
  license_submitted_at: string | null;
  license_reviewed_at: string | null;
  review_notes: string | null;
  referral_code: string;
  referral_link: string; // relative `/ref/<code>`; the UI prepends the origin
  // Commission accumulators (Wave B; read-only, unwritten this wave).
  commission_rate: string;
  total_commission_earned: string;
  pending_commission: string;
  // Mirrored identity status from the shared UserKYC (NOT a broker field).
  kyc_status: "pending" | "submitted" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
}

export interface ReferralResolveResult {
  valid: boolean;
  broker_name?: string;
}

// Wave B commission ledger (broker-scoped). Amounts are decimal strings.
export interface BrokerCommissionRow {
  id: string;
  referral: string;        // referred investor's display name
  investor_email: string;
  property: string;
  amount: string;          // the investor's purchase amount
  commission: string;      // the broker's commission
  status: "paid";          // credited to the broker's balance at settlement
  date: string;
}
export interface BrokerReferralRow {
  id: string;
  name: string;
  email: string;
  status: "invested" | "registered";
  property: string;
  amount: string;          // total invested by this referral
  commission: string;      // total commission this referral generated
  date: string;
}
export interface BrokerCommissions {
  stats: {
    total_referrals: number;
    converted_referrals: number;
    conversion_rate: number;
    total_commission: string;
    pending_commission: string;
    this_month_commission: string;
  };
  referrals: BrokerReferralRow[];
  commissions: BrokerCommissionRow[];
}

export const brokerApi = {
  /** The caller's broker profile, or null when none exists yet (404). */
  profile: async (): Promise<BrokerProfile | null> => {
    try {
      return (await rawRequest("/broker/profile/", { auth: true })) as BrokerProfile;
    } catch (err) {
      if ((err as ApiError).status === 404) return null;
      throw err;
    }
  },
  /** Apply as a broker (idempotent server-side). */
  apply: (payload: { contact_name: string; email: string; phone?: string }) =>
    rawRequest("/broker/profile/", { method: "POST", auth: true, body: payload }) as Promise<BrokerProfile>,
  /** Persist licence number/authority/expiry (status stays pending until admin approves). */
  submitLicense: (payload: { license_number: string; license_authority: string; license_expiry?: string | null }) =>
    rawRequest("/broker/license/submit/", { method: "POST", auth: true, body: payload }) as Promise<BrokerProfile>,
  /** Upload the licence document (multipart). Returns the refreshed profile. */
  uploadLicense: async (file: File): Promise<BrokerProfile> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE_URL}/broker/license/upload/`, {
      method: "POST",
      headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {},
      body: form,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw buildError((data as any)?.detail || `Upload failed (${res.status})`, res.status, data);
    }
    return (await res.json()) as BrokerProfile;
  },
  /** PUBLIC: validate a referral code at signup (no auth). */
  resolveReferral: (code: string) =>
    publicGet(`/broker/referral/resolve/?code=${encodeURIComponent(code)}`) as Promise<ReferralResolveResult>,
  /** The caller-broker's commission ledger + totals + referred-investor roster (Wave B). */
  commissions: () =>
    rawRequest("/broker/commissions/", { auth: true }) as Promise<BrokerCommissions>,
};

// --------------------------------------------------------------------------- //
// Reports-export API (Phase 13) — self-scoped CSV/PDF downloads of EXISTING data.
// The endpoints stream a FileResponse; we fetch it as a blob and trigger a browser
// download (filename comes from Content-Disposition). NB: the format param is `fmt`
// (not `format`, which DRF reserves for content negotiation).
// --------------------------------------------------------------------------- //
export const reportsApi = {
  async download(path: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw buildError((data as any)?.detail || `Export failed (${res.status})`, res.status, data);
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const filename = /filename="?([^"]+)"?/.exec(cd)?.[1] || "capimax-report";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  /** Export a report context as csv|pdf (optional year/period filter). */
  export(
    context: "wallet" | "distributions" | "installments" | "owner-earnings" | "lp" | "broker-commissions",
    fmt: "csv" | "pdf",
    params?: { year?: number | string; period?: string },
  ): Promise<void> {
    const q = new URLSearchParams({ fmt });
    if (params?.year) q.set("year", String(params.year));
    if (params?.period) q.set("period", params.period);
    return reportsApi.download(`/reports/${context}/export/?${q.toString()}`);
  },
  /** Informational annual distribution-income summary (PDF). NOT a tax document. */
  tax(year?: number | string): Promise<void> {
    const q = new URLSearchParams();
    if (year) q.set("year", String(year));
    return reportsApi.download(`/reports/distributions/tax/?${q.toString()}`);
  },
};

export { API_BASE_URL };
