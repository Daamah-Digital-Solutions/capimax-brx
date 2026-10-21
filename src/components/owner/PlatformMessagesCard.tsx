import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { inboxApi, type InboxMessage } from "@/integrations/api/client";
import { relativeTime } from "@/lib/notifications";

/** The three latest inbox messages from the platform team (owner / developer dashboard). */
export function PlatformMessagesCard() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [items, setItems] = useState<InboxMessage[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    inboxApi
      .list()
      .then((d) => {
        setItems(d.messages.slice(0, 3));
        setUnread(d.unread);
      })
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">{isAr ? "رسائل المنصة" : "Platform Messages"}</h3>
        </div>
        {unread > 0 && <Badge>{isAr ? `${unread} جديدة` : `${unread} new`}</Badge>}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <MessageSquare className="w-8 h-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">{isAr ? "لا توجد رسائل بعد" : "No messages yet"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((m) => (
            <Link
              key={m.id}
              to={`/messages?id=${m.id}`}
              className="block rounded-lg p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm truncate ${m.read ? "text-foreground" : "font-semibold text-foreground"}`}>
                  {!m.read && <span className="inline-block w-2 h-2 rounded-full bg-primary me-2 align-middle" />}
                  {m.subject}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{relativeTime(m.created_at, language)}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-1">{m.preview}</p>
            </Link>
          ))}
        </div>
      )}

      <Link to="/messages">
        <Button variant="ghost" className="w-full mt-4">
          {isAr ? "عرض كل الرسائل" : "View all messages"}
        </Button>
      </Link>
    </div>
  );
}
