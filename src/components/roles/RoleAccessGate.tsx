import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ClipboardList, Clock, Loader2, ShieldCheck, UserCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ROLE_LABELS, useRoles } from "@/hooks/useRoles";
import { rolesApi, type RoleKey } from "@/integrations/api/client";

const SLUG: Record<RoleKey, string> = {
  investor: "investor", owner: "owner", broker: "broker", lp: "liquidity_provider",
  developer: "developer", partner: "partner",
};

/**
 * Shown on a role's area when the account doesn't hold that role yet: "<Role> Access" with
 * the three steps and a Request Access button (or the pending / rejected state).
 */
export function RoleAccessGate({ role }: { role: Exclude<RoleKey, "investor" | "owner"> }) {
  const { isRTL } = useLanguage();
  const { status, rows } = useRoles();
  const st = status(role);
  const name = isRTL ? ROLE_LABELS[role].ar : ROLE_LABELS[role].en;
  const note = rows.find((r) => r.role === role)?.review_note;
  const steps = [
    { icon: ClipboardList, en: "Fill in the application", ar: "املا الطلب" },
    { icon: UserCheck, en: "Our team reviews it", ar: "الفريق يراجعه" },
    { icon: CheckCircle2, en: "The role is activated", ar: "الدور يتفعّل" },
  ];

  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="p-8 text-center space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{isRTL ? `صلاحية ${name}` : `${name} Access`}</h2>
          <p className="text-muted-foreground mt-2">
            {isRTL
              ? `المنطقة دي محتاجة دور ${name}. يتفعّل بعد موافقة الإدارة.`
              : `This area needs the ${name} role. It is activated after admin approval.`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {steps.map((s, i) => (
            <div key={i} className="p-3 rounded-lg border bg-card">
              <s.icon className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="text-xs text-muted-foreground">{i + 1}</div>
              <div className="text-sm font-medium">{isRTL ? s.ar : s.en}</div>
            </div>
          ))}
        </div>
        {st === "pending" ? (
          <div className="space-y-3">
            <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30">
              <Clock className="w-3 h-3" />
              {isRTL ? "طلبك قيد المراجعة" : "Your application is pending review"}
            </Badge>
            <div>
              <Button variant="outline" asChild>
                <Link to={`/roles/apply/${SLUG[role]}`}>{isRTL ? "عرض الطلب" : "View application"}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {st === "rejected" && note && <p className="text-sm text-destructive">{note}</p>}
            <Button size="lg" asChild>
              <Link to={`/roles/apply/${SLUG[role]}`}>
                {st === "rejected" ? (isRTL ? "عدّل وقدّم تاني" : "Edit & resubmit") : isRTL ? "اطلب الصلاحية" : "Request Access"}
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Property Owner is granted instantly — no form, no documents. */
export function BecomeOwnerCard() {
  const { isRTL } = useLanguage();
  const { refresh } = useRoles();
  const [busy, setBusy] = useState(false);
  const become = async () => {
    setBusy(true);
    try {
      await rolesApi.becomeOwner();
      toast.success(isRTL ? "أصبحت مالك عقار" : "You're now a Property Owner");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "تعذّر إضافة الدور" : "Could not add the role"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4" dir={isRTL ? "rtl" : "ltr"}>
        <div>
          <div className="font-semibold">{isRTL ? "صلاحية مالك العقار" : "Property Owner Access"}</div>
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            {isRTL ? "تُمنح فوراً — بدون فورم أو مستندات." : "Granted instantly — no form, no documents."}
          </div>
        </div>
        <Button onClick={become} disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
          {isRTL ? "انضم كمالك" : "Become a Property Owner"}
        </Button>
      </CardContent>
    </Card>
  );
}
