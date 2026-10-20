import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, ShieldCheck, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { rolesApi } from "@/integrations/api/client";
import { ROLE_LABELS, useRoles } from "@/hooks/useRoles";

/**
 * Settings → Role Access: the roles the account holds, and the ones it can add — Property
 * Owner instantly, the others with an application an admin reviews.
 */
export function RoleAccessCard() {
  const { isRTL } = useLanguage();
  const { rows, current, isAdmin, isLoading, refresh } = useRoles();
  const [busy, setBusy] = useState(false);

  const label = (r: (typeof rows)[number]) => (isRTL ? ROLE_LABELS[r.role].ar : ROLE_LABELS[r.role].en);
  const held = rows.filter((r) => r.status === "active");
  const others = rows.filter((r) => r.status !== "active");

  const becomeOwner = async () => {
    setBusy(true);
    try {
      await rolesApi.becomeOwner();
      toast.success(
        isRTL ? "أصبحت مالك عقار — بدّل للدور من القائمة الجانبية" : "You're now a Property Owner — switch to it from the sidebar",
      );
      refresh();
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "تعذّر إضافة الدور" : "Could not add the role"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          {isRTL ? "صلاحيات الأدوار" : "Role Access"}
        </CardTitle>
        <CardDescription>
          {isRTL
            ? "الأدوار اللي معاك، والأدوار اللي تقدر تطلبها. بدّل بينها من القائمة الجانبية."
            : "The roles you hold and the ones you can request. Switch between them from the sidebar."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {held.map((r) => (
                <Badge key={r.role} variant="outline" className="gap-1 bg-success/10 text-success border-success/30">
                  <CheckCircle2 className="w-3 h-3" />
                  {label(r)}
                  {current === r.role && <span className="opacity-70">· {isRTL ? "الحالي" : "current"}</span>}
                </Badge>
              ))}
            </div>

            {!isAdmin && others.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {isRTL ? "أدوار تقدر تطلبها" : "Roles you can request"}
                </div>
                {others.map((r) => (
                  <div key={r.role} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{label(r)}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {r.approval === "instant" ? (
                          <>
                            <Zap className="w-3 h-3" />
                            {isRTL ? "يُمنح فوراً" : "Granted instantly"}
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3 h-3" />
                            {isRTL ? "بموافقة الإدارة" : "Admin approval"}
                          </>
                        )}
                      </div>
                      {r.status === "rejected" && r.review_note && (
                        <div className="text-xs text-destructive mt-1">{r.review_note}</div>
                      )}
                    </div>
                    {r.approval === "instant" ? (
                      <Button size="sm" onClick={becomeOwner} disabled={busy}>
                        {busy && <Loader2 className="w-4 h-4 me-1 animate-spin" />}
                        {isRTL ? "انضم" : "Become"}
                      </Button>
                    ) : r.status === "pending" ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30">
                          <Clock className="w-3 h-3" />
                          {isRTL ? "قيد المراجعة" : "Pending review"}
                        </Badge>
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/roles/apply/${r.slug}`}>{isRTL ? "عرض الطلب" : "View application"}</Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {r.status === "rejected" && (
                          <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/30">
                            <XCircle className="w-3 h-3" />
                            {isRTL ? "مرفوض" : "Rejected"}
                          </Badge>
                        )}
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/roles/apply/${r.slug}`}>
                            {r.status === "rejected"
                              ? isRTL ? "عدّل وقدّم تاني" : "Edit & resubmit"
                              : isRTL ? "طلب تفعيل" : "Request activation"}
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
