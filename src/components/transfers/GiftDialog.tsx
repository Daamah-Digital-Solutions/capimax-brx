import { useEffect, useState } from "react";
import { Gift, Loader2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { transfersApi, type Giftable } from "@/integrations/api/client";
import { cn } from "@/lib/utils";

const OCCASIONS = [
  { id: "birthday", en: "Birthday", ar: "عيد ميلاد" },
  { id: "graduation", en: "Graduation", ar: "تخرج" },
  { id: "wedding", en: "Wedding", ar: "زواج" },
  { id: "new_baby", en: "New baby", ar: "مولود جديد" },
  { id: "holiday", en: "Holiday", ar: "عيد" },
  { id: "other", en: "Other", ar: "أخرى" },
];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Give property units or a wallet amount to anyone by email — now or on a chosen date.
 * It is held from the moment it's scheduled and reaches the recipient once they have a
 * verified email and approved KYC (they're emailed an invitation if not yet).
 */
export function GiftDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const { isRTL } = useLanguage();
  const [info, setInfo] = useState<Giftable | null>(null);
  const [asset, setAsset] = useState<"units" | "cash">("units");
  const [slug, setSlug] = useState("");
  const [units, setUnits] = useState("");
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(today());
  const [occasion, setOccasion] = useState("birthday");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    transfersApi
      .giftable()
      .then((g) => {
        setInfo(g);
        if (g.positions.length) setSlug((s) => s || g.positions[0].property_slug);
        else setAsset("cash");
      })
      .catch(() => setInfo(null));
  }, [open]);

  const pos = info?.positions.find((p) => p.property_slug === slug);
  const n = Number(units) || 0;
  const amt = Number(amount) || 0;
  const value = asset === "units" ? n * (pos?.unit_value ?? 0) : amt;
  const fee = Math.round(value * (info?.gift_fee_percent ?? 0)) / 100;
  const valid =
    /\S+@\S+\.\S+/.test(email) &&
    (asset === "units" ? !!pos && n >= 1 && n <= pos.free_units : amt > 0 && amt + fee <= (info?.balance ?? 0));

  const submit = async () => {
    setBusy(true);
    try {
      const t = await transfersApi.gift({
        recipient_email: email.trim(),
        recipient_name: name.trim(),
        asset,
        ...(asset === "units" ? { property_slug: slug, units: n } : { amount: amt }),
        deliver_on: date,
        occasion,
        message: message.trim(),
      });
      toast.success(
        t.status === "delivered"
          ? isRTL ? "تم تسليم الهدية" : "Gift delivered"
          : t.status === "waiting"
            ? isRTL ? "الهدية بانتظار تسجيل المستلم وتوثيقه — أرسلنا له دعوة" : "Gift waiting for the recipient to sign up and verify — we invited them"
            : isRTL ? `تمت جدولة الهدية ليوم ${t.deliver_on}` : `Gift scheduled for ${t.deliver_on}`,
      );
      setUnits("");
      setAmount("");
      setEmail("");
      setName("");
      setMessage("");
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "تعذّر إرسال الهدية" : "Could not send the gift"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRTL ? "rtl" : "ltr"} className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-500" />
            {isRTL ? "هدية عقارية" : "Property gift"}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? `يُحجز ما تهديه فوراً ويصل للمستلم بعد تأكيد بريده وتوثيق هويته. إن لم يستلمه خلال ${info?.claim_days ?? 30} يوماً يعود إليك، ويمكنك إلغاؤه قبل ذلك.`
              : `What you give is held at once and reaches the recipient after they confirm their email and verify their identity. If not received within ${info?.claim_days ?? 30} days it returns to you — you can cancel before then.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["units", "cash"] as const).map((a) => (
              <button
                key={a}
                type="button"
                disabled={a === "units" && !info?.positions.length}
                onClick={() => setAsset(a)}
                className={cn(
                  "p-2.5 rounded-lg border text-sm transition-colors disabled:opacity-50",
                  asset === a ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                )}
              >
                {a === "units" ? (isRTL ? "وحدات عقار" : "Property units") : isRTL ? "مبلغ من المحفظة" : "Wallet amount"}
              </button>
            ))}
          </div>

          {asset === "units" ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>{isRTL ? "العقار" : "Property"}</Label>
                <Select value={slug} onValueChange={setSlug}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {info?.positions.map((p) => (
                      <SelectItem key={p.property_slug} value={p.property_slug}>
                        {p.property_name} ({p.free_units})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{isRTL ? "الوحدات" : "Units"}</Label>
                <Input type="number" min={1} max={pos?.free_units} value={units} onChange={(e) => setUnits(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>
                {isRTL ? "المبلغ (USD)" : "Amount (USD)"}
                <span className="text-xs text-muted-foreground ms-2">
                  {isRTL ? "الرصيد" : "Balance"}: ${(info?.balance ?? 0).toLocaleString()}
                </span>
              </Label>
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          )}
          {fee > 0 && (
            <p className="text-xs text-muted-foreground">
              {isRTL ? `رسوم الهدية: $${fee.toFixed(2)}` : `Gift fee: $${fee.toFixed(2)}`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{isRTL ? "بريد المستلم" : "Recipient email"}</Label>
              <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{isRTL ? "اسم المستلم" : "Recipient name"}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{isRTL ? "تاريخ التسليم" : "Delivery date"}</Label>
              <Input type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{isRTL ? "المناسبة" : "Occasion"}</Label>
              <Select value={occasion} onValueChange={setOccasion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OCCASIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {isRTL ? o.ar : o.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{isRTL ? "رسالة (اختياري)" : "Message (optional)"}</Label>
            <Textarea rows={2} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {isRTL ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={submit} disabled={busy || !valid} className="gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            {date > today() ? (isRTL ? "جدولة الهدية" : "Schedule gift") : isRTL ? "إرسال الهدية" : "Send gift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
