import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { transfersApi } from "@/integrations/api/client";

/** A named beneficiary reports the holder's death with the certificate number + death certificate. */
export function EstateClaimDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { isRTL } = useLanguage();
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      await transfersApi.submitClaim({ certificate_number: number.trim(), date_of_death: date, notes, file });
      toast.success(isRTL ? "تم إرسال الطلب للمراجعة" : "Claim submitted for review");
      setNumber("");
      setDate("");
      setNotes("");
      setFile(null);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "تعذّر إرسال الطلب" : "Could not submit the claim"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {isRTL ? "طلب ميراث" : "Inheritance claim"}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? "للمستفيدين المسجّلين فقط: أدخل رقم شهادة المستفيدين وارفع شهادة الوفاة. يجب أن يكون بريدك موثّقاً وهويتك مُعتمدة."
              : "For named beneficiaries: enter the beneficiary certificate number and upload the death certificate. Your email and identity must be verified."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{isRTL ? "رقم الشهادة" : "Certificate number"}</Label>
            <Input dir="ltr" placeholder="CPB-XXXX-XXXX" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{isRTL ? "تاريخ الوفاة" : "Date of death"}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{isRTL ? "شهادة الوفاة (PDF أو صورة، حتى 10MB)" : "Death certificate (PDF or image, up to 10 MB)"}</Label>
            <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1.5">
            <Label>{isRTL ? "ملاحظات (اختياري)" : "Notes (optional)"}</Label>
            <Textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {isRTL ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={submit} disabled={busy || !file || !/^CPB-/i.test(number.trim())}>
            {busy && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            {isRTL ? "إرسال الطلب" : "Submit claim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
