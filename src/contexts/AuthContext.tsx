import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authApi, tokenStore, type ApiUser } from "@/integrations/api/client";

// Auth now talks to the new Django backend (SPEC §5.2) instead of Supabase.
// Scope is AUTH ONLY — domain hooks/pages keep their existing Supabase/mock calls
// until their phase lands. The shapes below are intentionally minimal but keep the
// fields existing consumers read (user.id, user.email, session.access_token).

interface AuthUser {
  id: string;
  email: string;
  profile?: ApiUser["profile"];
}
interface AuthSession {
  access_token: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  // ROLE POLICY (frontend = source of truth): the user's selected role is now
  // forwarded to the backend, which persists it and gates privileged roles behind
  // verification (see DECISIONS.md "Role policy"). Previously the role was dropped.
  signUp: (
    email: string,
    password: string,
    metadata?: { full_name?: string; phone?: string; is_us_citizen?: boolean; role?: string; ref?: string }
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  // Exchange a Google GIS id_token (obtained by the browser) for a backend session.
  loginWithGoogle: (idToken: string) => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toAuthUser(u: ApiUser): AuthUser {
  return { id: u.id, email: u.email, profile: u.profile };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap: if we have a stored access token, resolve the current user.
  // The client transparently refreshes on a 401. Any failure => logged-out.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!tokenStore.access) {
        if (active) setLoading(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (!active) return;
        setUser(toAuthUser(me));
        setSession({ access_token: tokenStore.access! });
      } catch {
        tokenStore.clear();
        if (active) {
          setUser(null);
          setSession(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    metadata?: { full_name?: string; phone?: string; is_us_citizen?: boolean; role?: string; ref?: string }
  ) => {
    try {
      await authApi.register({
        email,
        password,
        full_name: metadata?.full_name,
        phone: metadata?.phone,
        is_us_citizen: metadata?.is_us_citizen,
        role: metadata?.role, // selected role; backend validates + gates it
        ref: metadata?.ref, // broker referral code (set-once linkage, server-side)
      });
      // Mirror Supabase email-confirmation: account created but NOT signed in yet.
      // Auth.tsx shows the "check your email" screen; the user logs in next.
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await authApi.login(email, password);
      setUser(toAuthUser(result.user));
      setSession({ access_token: result.session.access_token });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Google Sign-In: the browser (GIS button) obtains a signed id_token and hands
  // it here; the backend verifies it and returns the same { user, session } as
  // login. First sign-in creates the account (baseline investor). SPEC §6.
  const loginWithGoogle = async (idToken: string) => {
    try {
      const result = await authApi.googleOAuth(idToken);
      setUser(toAuthUser(result.user));
      setSession({ access_token: result.session.access_token });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Apple sign-in is scaffolded on the backend but not wired end-to-end yet
  // (provider keys pending — SPEC §6). Return a clear, non-throwing error.
  const signInWithApple = async () => ({
    error: new Error("Apple sign-in isn't enabled yet. Please use email and password."),
  });

  const signOut = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, loginWithGoogle, signInWithApple, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
