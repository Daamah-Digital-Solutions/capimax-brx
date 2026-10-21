import { useEffect, useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
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

const NO_OCCASION = "none";
const OCCASIONS = [
  { id: NO_OCCASION, en: "No occasion", ar: "بدون مناسبة" },
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
 *
 * `mode="transfer"` is the Transfers page wording (a plain transfer, occasion optional);
 * the default "gift" wording is the Family Investment page's.
 */
export function GiftDialog({
  open,
  onOpenChange,
  onDone,
  mode = "gift",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  mode?: "gift" | "transfer";
}) {
  const { isRTL } = useLanguage();
  const isTransfer = mode === "transfer";
  // Title, button and messages say "transfer" everywhere (the gift wording stays only in
  // the Family Investment description and its occasion default).
  const word = { ar: "التحويل", en: "Transfer", enLower: "transfer" };
  const [info, setInfo] = useState<Giftable | null>(null);
  const [asset, setAsset] = useState<"units" | "cash">("units");
  const [slug, setSlug] = useState("");
  const [units, setUnits] = useState("");
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(today());
  const [occasion, setOccasion] = useState(isTransfer ? NO_OCCASION : "birthday");
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
        occasion: occasion === NO_OCCASION ? "" : occasion,
        message: message.trim(),
      });
      toast.success(
        t.status === "delivered"
          ? isRTL ? `تم تسليم ${word.ar}` : `${word.en} delivered`
          : t.status === "waiting"
            ? isRTL ? `${word.ar} بانتظار تسجيل المستلم وتوثيقه — أرسلنا له دعوة` : `${word.en} waiting for the recipient to sign up and verify — we invited them`
            : isRTL ? `تمت جدولة ${word.ar} ليوم ${t.deliver_on}` : `${word.en} scheduled for ${t.deliver_on}`,
      );
      setUnits("");
      setAmount("");
      setEmail("");
      setName("");
      setMessage("");
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? `تعذّر إرسال ${word.ar}` : `Could not send the ${word.enLower}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRTL ? "rtl" : "ltr"} className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            {isRTL ? "تحويل وحدات أو رصيد" : "Transfer units or balance"}
          </DialogTitle>
          <DialogDescription>
            {isTransfer
              ? isRTL
                ? `يُحجز ما تحوّله فوراً، ويصل للمستلم مباشرة إن كان بريده مؤكدًا وهويته موثّقة، وإلا يصله بريد دعوة ويصله التحويل فور توثيقه. إن لم يستلمه خلال ${info?.claim_days ?? 30} يوماً يعود إليك، ويمكنك إلغاؤه قبل ذلك من صفحة التحويلات.`
                : `What you send is held at once and reaches the recipient right away if their email is confirmed and their identity verified; otherwise they get an invitation and receive it as soon as they verify. If not received within ${info?.claim_days ?? 30} days it returns to you — you can cancel it before then on the Transfers page.`
              : isRTL
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
                        {(isRTL && p.property_name_ar) || p.property_name} ({p.free_units})
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
              {isRTL ? `رسوم ${word.ar}: $${fee.toFixed(2)}` : `${word.en} fee: $${fee.toFixed(2)}`}
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
              <Label>{isTransfer ? (isRTL ? "المناسبة (اختياري)" : "Occasion (optional)") : isRTL ? "المناسبة" : "Occasion"}</Label>
              <Select value={occasion} onValueChange={setOccasion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OCCASIONS.filter((o) => isTransfer || o.id !== NO_OCCASION).map((o) => (
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
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
            {date > today()
              ? isRTL ? `جدولة ${word.ar}` : `Schedule ${word.enLower}`
              : isRTL ? `إرسال ${word.ar}` : `Send ${word.enLower}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
