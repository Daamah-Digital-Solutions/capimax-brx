import { useEffect, useState } from "react";
import { Download, Loader2, Plus, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { transfersApi, type BeneficiaryRow } from "@/integrations/api/client";

const blank = (): BeneficiaryRow => ({ full_name: "", email: "", relationship: "", percent: 0 });

/**
 * Name who inherits your free property units and wallet, and in what share (≤ 100%).
 * Saving issues a numbered certificate (CPB-XXXX-XXXX); a beneficiary quotes it with a death
 * certificate to claim, and after review the estate is divided in these shares.
 */
export function BeneficiariesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { isRTL } = useLanguage();
  const [rows, setRows] = useState<BeneficiaryRow[]>([]);
  const [cert, setCert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    transfersApi
      .beneficiaries()
      .then((p) => {
        setRows(p.beneficiaries.length ? p.beneficiaries : [blank()]);
        setCert(p.certificate_number);
      })
      .catch(() => setRows([blank()]));
  }, [open]);

  const total = rows.reduce((s, r) => s + (Number(r.percent) || 0), 0);
  const update = (i: number, patch: Partial<BeneficiaryRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setBusy(true);
    try {
      const filled = rows.filter((r) => r.full_name.trim() || r.email.trim());
      const p = await transfersApi.saveBeneficiaries(
        filled.map((r) => ({ ...r, percent: Number(r.percent) || 0 })),
      );
      setRows(p.beneficiaries.length ? p.beneficiaries : [blank()]);
      setCert(p.certificate_number);
      toast.success(isRTL ? "تم حفظ المستفيدين" : "Beneficiaries saved");
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "تعذّر الحفظ" : "Could not save"));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    try {
      await transfersApi.certificatePdf();
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "تعذّر التنزيل" : "Download failed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRTL ? "rtl" : "ltr"} className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            {isRTL ? "المستفيدون" : "Beneficiaries"}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? "بعد مراجعة شهادة الوفاة تُقسَّم وحداتك الحرة ورصيد محفظتك بهذه النسب، ويستلم كل مستفيد نصيبه بعد توثيق هويته."
              : "After a death certificate is reviewed, your free units and wallet balance are divided in these shares; each beneficiary receives theirs once verified."}
          </DialogDescription>
        </DialogHeader>

        {cert && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-blue-500/30 bg-blue-500/5">
            <div>
              <div className="text-xs text-muted-foreground">{isRTL ? "رقم الشهادة" : "Certificate number"}</div>
              <div className="font-mono font-semibold" dir="ltr">{cert}</div>
            </div>
            <Button size="sm" variant="outline" onClick={download} className="gap-2">
              <Download className="w-4 h-4" />
              PDF
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-3" placeholder={isRTL ? "الاسم" : "Name"} value={r.full_name}
                onChange={(e) => update(i, { full_name: e.target.value })} />
              <Input className="col-span-4" dir="ltr" type="email" placeholder={isRTL ? "البريد" : "Email"} value={r.email}
                onChange={(e) => update(i, { email: e.target.value })} />
              <Input className="col-span-2" placeholder={isRTL ? "الصلة" : "Relation"} value={r.relationship}
                onChange={(e) => update(i, { relationship: e.target.value })} />
              <div className="col-span-2 relative">
                <Input type="number" min={0} max={100} value={r.percent || ""}
                  onChange={(e) => update(i, { percent: Number(e.target.value) })} />
                <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
              <Button size="icon" variant="ghost" className="col-span-1"
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blank()]))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button size="sm" variant="ghost" className="gap-1" disabled={rows.length >= 20}
              onClick={() => setRows((rs) => [...rs, blank()])}>
              <Plus className="w-4 h-4" />
              {isRTL ? "إضافة مستفيد" : "Add beneficiary"}
            </Button>
            <span className={total > 100 ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
              {isRTL ? "الإجمالي" : "Total"}: {total}%
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isRTL ? "إغلاق" : "Close"}
          </Button>
          <Button onClick={save} disabled={busy || total > 100}>
            {busy && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            {isRTL ? "حفظ" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
