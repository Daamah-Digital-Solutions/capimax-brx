import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOptionalLanguage } from "@/contexts/LanguageContext";

/**
 * Capimax BRX support chatbot — a floating widget backed by the group's n8n webhook.
 *
 * Contract (see the n8n Technical Spec):
 *   POST {ENDPOINT}
 *   body: { action: "sendMessage", sessionId, chatInput }
 *   resp: { output: "<assistant reply>" }
 *
 * `sessionId` is one stable id per browser/conversation (server keeps the last 12 messages of
 * memory keyed on it); a brand-new visitor gets a fresh one. CORS for the capimax domains is
 * whitelisted server-side, so we call the endpoint directly (NOT through the app API client —
 * different host, no auth header). Mounted once globally in App.tsx.
 */
const ENDPOINT =
  import.meta.env.VITE_CHATBOT_URL ||
  "https://ai.capimaxgroup.com/webhook/capimax-brx/chat";

const SESSION_KEY = "capimax-chat-session";

type ChatRole = "user" | "assistant";
interface ChatMessage {
  role: ChatRole;
  text: string;
}

/** Stable per-browser conversation id; fresh for a new visitor. */
function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        (typeof crypto !== "undefined" && crypto.randomUUID?.()) ||
        `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private mode) → ephemeral id for this page load.
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function ChatWidget() {
  const language = useOptionalLanguage();
  const isArabic = language?.language === "ar";
  const isRTL = language?.isRTL ?? false;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>("");

  const tr = (en: string, ar: string) => (isArabic ? ar : en);

  // Seed the greeting the first time the panel opens; focus the input.
  useEffect(() => {
    if (!open) return;
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          text: tr(
            "Hi! I'm the Capimax BRX assistant. How can I help you today?",
            "أهلاً! أنا مساعد Capimax BRX. أقدر أساعدك في إيه النهاردة؟",
          ),
        },
      ]);
    }
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the transcript pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    if (!sessionIdRef.current) sessionIdRef.current = getSessionId();

    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sendMessage",
          sessionId: sessionIdRef.current,
          chatInput: text,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      // Be lenient about the reply shape ({output} per spec; tolerate a couple of variants).
      const reply =
        (typeof data === "string" ? data : data?.output ?? data?.reply ?? data?.message) || "";
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text:
            reply ||
            tr(
              "Sorry, I couldn't process that. Please try again.",
              "آسف، لم أتمكن من المعالجة. حاول مرة أخرى من فضلك.",
            ),
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: tr(
            "Sorry, something went wrong reaching the assistant. Please try again.",
            "عذراً، حدث خطأ أثناء الاتصال بالمساعد. حاول مرة أخرى من فضلك.",
          ),
        },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elevated",
            "bottom-24 md:bottom-24 w-[calc(100vw-2rem)] max-w-sm h-[70vh] max-h-[560px]",
            "animate-in slide-in-from-bottom-4 duration-300",
            isRTL ? "left-4" : "right-4",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 bg-gradient-gold px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-primary-foreground">
                  {tr("Capimax BRX Assistant", "مساعد Capimax BRX")}
                </p>
                <p className="truncate text-[11px] text-primary-foreground/80">
                  {tr("Typically replies in a few seconds", "يرد عادةً خلال ثوانٍ")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label={tr("Close chat", "إغلاق المحادثة")}
              className="shrink-0 rounded-md p-1 text-primary-foreground/90 transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-background/40 p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
                    m.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="flex items-center gap-2 border-t border-border bg-card p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={busy}
              placeholder={tr("Type your message…", "اكتب رسالتك…")}
              className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            />
            <Button
              size="icon"
              onClick={() => void send()}
              disabled={busy || !input.trim()}
              aria-label={tr("Send", "إرسال")}
              className="h-10 w-10 shrink-0"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Floating launcher (sits above the mobile bottom-nav) */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={tr("Open chat", "افتح المحادثة")}
        className={cn(
          "fixed bottom-20 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-gold text-primary-foreground shadow-gold transition-transform hover:scale-105 active:scale-95 md:bottom-6",
          isRTL ? "left-4" : "right-4",
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
