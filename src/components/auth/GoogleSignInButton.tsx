import { useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

// Renders Google's official "Sign in with Google" button (GIS). The browser
// obtains a signed id_token which we hand to the backend
// (POST /api/auth/oauth/google/) via loginWithGoogle. On success, AuthContext
// sets the user and the Auth page's effect navigates to the dashboard.
//
// The client id is public and injected at build time. When it's absent (local
// dev without the env var), the button is not rendered — email/password still work.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined;
const GIS_SRC = "https://accounts.google.com/gsi/client";

interface GoogleCredentialResponse {
  credential?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS load failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GIS load failed"));
    document.head.appendChild(script);
  });
}

export function GoogleSignInButton() {
  const { language, isRTL } = useLanguage();
  const { loginWithGoogle } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false); // guard StrictMode double-invoke

  useEffect(() => {
    if (!CLIENT_ID || rendered.current) return;
    let active = true;

    loadGis()
      .then(() => {
        if (!active || rendered.current || !containerRef.current || !window.google) return;
        rendered.current = true;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async (resp: GoogleCredentialResponse) => {
            if (!resp.credential) return;
            const { error } = await loginWithGoogle(resp.credential);
            if (error) {
              toast({
                title: language === "ar" ? "خطأ" : "Error",
                description: error.message,
                variant: "destructive",
              });
            }
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "center",
          width: 360,
          locale: language === "ar" ? "ar" : "en",
        });
      })
      .catch(() => {
        /* GIS unavailable (offline/blocked) — email+password still work. */
      });

    return () => {
      active = false;
    };
  }, [language, loginWithGoogle]);

  if (!CLIENT_ID) return null;

  return <div ref={containerRef} dir={isRTL ? "rtl" : "ltr"} className="flex justify-center" />;
}
