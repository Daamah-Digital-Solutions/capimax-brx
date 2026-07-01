// INERT SUPABASE STUB — the real Supabase client was decommissioned (no external PII).
//
// The restored card / bank / crypto-wallet UI still imports `supabase`; this local
// stub lets the app boot without the `@supabase/supabase-js` dependency and without any
// network call. Behaviour is deliberately HONEST (never fake a success):
//   * READS resolve empty  ({ data: [], error: null })  → screens render empty lists.
//   * WRITES resolve a clear "coming soon" error         → the UI shows the notice
//     instead of pretending the save worked.
// These features light up for real once their Django backends land.

const COMING_SOON =
  "This feature is being connected to the backend — coming soon.";

type Ok<T> = { data: T; error: null };
type ComingSoon = { data: null; error: { message: string; code: string } };

const ok = <T>(data: T): Promise<Ok<T>> => Promise.resolve({ data, error: null });
const comingSoon = (): Promise<ComingSoon> =>
  Promise.resolve({ data: null, error: { message: COMING_SOON, code: "coming_soon" } });

/**
 * A thenable query builder: chain methods return `this`; awaiting a plain read yields
 * an empty array, while awaiting anything after a write (insert/update/delete/upsert)
 * yields the coming-soon error.
 */
class QueryStub implements PromiseLike<Ok<unknown[]> | ComingSoon> {
  private isWrite = false;

  select(): this { return this; }
  insert(): this { this.isWrite = true; return this; }
  update(): this { this.isWrite = true; return this; }
  delete(): this { this.isWrite = true; return this; }
  upsert(): this { this.isWrite = true; return this; }
  eq(): this { return this; }
  neq(): this { return this; }
  in(): this { return this; }
  is(): this { return this; }
  order(): this { return this; }
  limit(): this { return this; }
  range(): this { return this; }
  single(): Promise<Ok<null> | ComingSoon> { return this.isWrite ? comingSoon() : ok(null); }
  maybeSingle(): Promise<Ok<null> | ComingSoon> { return this.isWrite ? comingSoon() : ok(null); }

  then<TResult1 = Ok<unknown[]> | ComingSoon, TResult2 = never>(
    onfulfilled?: ((value: Ok<unknown[]> | ComingSoon) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const result = this.isWrite ? comingSoon() : ok([] as unknown[]);
    return result.then(onfulfilled, onrejected);
  }
}

const channelStub = {
  on(): typeof channelStub { return channelStub; },
  subscribe(): typeof channelStub { return channelStub; },
};

export const supabase = {
  from: (_table: string) => new QueryStub(),
  rpc: (_fn: string, _args?: unknown) => comingSoon(),
  auth: {
    getUser: () => ok({ user: null }),
    getSession: () => ok({ session: null }),
    setSession: (_tokens: unknown) => ok({ session: null, user: null }),
    signOut: () => ok(null),
    // Sync return matching Supabase's shape: a subscription with a no-op unsubscribe.
    onAuthStateChange: (_callback: unknown) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
  },
  channel: (_name: string) => channelStub,
  removeChannel: (_channel: unknown) => {},
};
