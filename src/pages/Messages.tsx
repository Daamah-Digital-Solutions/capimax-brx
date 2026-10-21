import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCheck, Loader2, MailOpen, MessageSquare } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { inboxApi, type InboxMessage } from "@/integrations/api/client";
import { relativeTime } from "@/lib/notifications";
import { cn } from "@/lib/utils";

/** Inbox — messages from the platform team (owners, developers, brokers, LPs, partners). */
export default function Messages() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<InboxMessage[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState<InboxMessage | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    inboxApi
      .list()
      .then((d) => {
        setItems(d.messages);
        setUnread(d.unread);
      })
      .catch(() => setItems([]));
  }, [user]);
  useEffect(load, [load]);

  const show = useCallback(
    async (id: string) => {
      setOpening(id);
      try {
        const m = await inboxApi.get(id);
        setOpen(m);
        setItems((prev) => prev?.map((x) => (x.id === id ? { ...x, read: true } : x)) ?? prev);
        setUnread((u) => (items?.find((x) => x.id === id && !x.read) ? Math.max(0, u - 1) : u));
        setParams({ id }, { replace: true });
      } finally {
        setOpening(null);
      }
    },
    [items, setParams],
  );

  // Deep link from a notification / email: /messages?id=<message>.
  useEffect(() => {
    const id = params.get("id");
    if (id && items && open?.id !== id) void show(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const Back = isAr ? ArrowRight : ArrowLeft;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(isAr ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" });

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
                {t("nav.messages")}
                {unread > 0 && <Badge>{unread}</Badge>}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isAr ? "الرسائل الواردة من فريق المنصة" : "Messages from the platform team"}
              </p>
            </div>
          </div>
          {unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => inboxApi.readAll().then(load)}
            >
              <CheckCheck className="w-4 h-4" />
              {isAr ? "تحديد الكل كمقروء" : "Mark all read"}
            </Button>
          )}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <Card className={cn("lg:col-span-2 bg-card/50 backdrop-blur border-border/50", open && "hidden lg:block")}>
            <CardContent className="p-0 divide-y divide-border/50">
              {items === null ? (
                <div className="p-10 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center text-center py-16 px-6">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
                  <p className="font-semibold text-foreground">{isAr ? "لا توجد رسائل بعد" : "No messages yet"}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isAr
                      ? "ستظهر هنا الرسائل التي يرسلها لك فريق المنصة."
                      : "Messages the platform team sends you will appear here."}
                  </p>
                </div>
              ) : (
                items.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => show(m.id)}
                    className={cn(
                      "w-full text-start p-4 transition-colors hover:bg-muted/40",
                      open?.id === m.id && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={cn("truncate", m.read ? "text-foreground" : "font-semibold text-foreground")}>
                        {!m.read && <span className="inline-block w-2 h-2 rounded-full bg-primary me-2 align-middle" />}
                        {m.subject}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">{relativeTime(m.created_at, language)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1">{m.preview}</p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className={cn("lg:col-span-3 bg-card/50 backdrop-blur border-border/50", !open && "hidden lg:block")}>
            <CardContent className="p-6">
              {opening ? (
                <div className="py-16 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : open ? (
                <div className="space-y-4">
                  <Button variant="ghost" size="sm" className="gap-2 lg:hidden -ms-2" onClick={() => setOpen(null)}>
                    <Back className="w-4 h-4" />
                    {isAr ? "كل الرسائل" : "All messages"}
                  </Button>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">{open.subject}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isAr ? "من فريق Capimax BRX" : "From the Capimax BRX team"} · {fmt(open.created_at)}
                    </p>
                  </div>
                  <div className="text-foreground whitespace-pre-wrap leading-relaxed border-t border-border/50 pt-4" dir="auto">
                    {open.body}
                  </div>
                </div>
              ) : (
                <div className="py-16 flex flex-col items-center text-center text-muted-foreground">
                  <MailOpen className="w-10 h-10 mb-3 opacity-50" />
                  {isAr ? "اختر رسالة لقراءتها" : "Choose a message to read it"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
