import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Activity, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

interface AuditEntry {
  id: string;
  action: string;
  method_type: string;
  ip_address: string | null;
  user_agent: string | null;
  details: any;
  created_at: string;
}

export default function AuditLog() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("payment_method_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setEntries((data as AuditEntry[]) || []);
      setLoading(false);
    })();
  }, []);

  const actionTone = (action: string) => {
    if (action.includes("delete") || action.includes("fail")) return "destructive";
    if (action.includes("create") || action.includes("add")) return "default";
    return "secondary";
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6" dir={isAr ? "rtl" : "ltr"}>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              {isAr ? "سجل التدقيق الأمني" : "Security & Audit Log"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isAr
                ? "سجل كامل وغير قابل للتعديل لجميع الأنشطة الحساسة على حسابك"
                : "Immutable, institutional-grade record of every sensitive action on your account"}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              {isAr ? "آخر 200 نشاط" : "Last 200 activities"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                {isAr ? "جارٍ التحميل..." : "Loading..."}
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <AlertCircle className="h-8 w-8" />
                <p className="text-sm">
                  {isAr ? "لا توجد أنشطة مسجلة بعد" : "No audit activity recorded yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant={actionTone(e.action) as any} className="shrink-0">
                        {e.action}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {e.method_type}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {e.ip_address || "—"} · {(e.user_agent || "").slice(0, 60)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 font-mono">
                      {format(new Date(e.created_at), "yyyy-MM-dd HH:mm:ss")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
