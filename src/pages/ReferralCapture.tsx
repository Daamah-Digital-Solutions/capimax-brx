import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

/**
 * Broker referral landing — Phase 12 Wave A (BROKER_SURFACE.md). A visitor who follows a
 * broker's share link `/ref/<code>` lands here: we stash the code in localStorage and
 * redirect into the registration flow (also passing ?ref= so it works even if storage is
 * blocked). The DURABLE link is formed server-side, set-once, at register time. No code is
 * trusted client-side beyond carrying it through — the backend validates + ignores
 * unknown/own codes.
 */
export default function ReferralCapture() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const clean = (code || "").trim();
    if (clean) {
      try {
        localStorage.setItem("capimax_ref", clean);
      } catch {
        /* storage blocked — the query param below still carries it */
      }
    }
    navigate(clean ? `/register?ref=${encodeURIComponent(clean)}` : "/register", { replace: true });
  }, [code, navigate]);

  return null;
}
