import { useEffect, useState } from "react";
import { ArrowLeftRight, Gift, Loader2 } from "lucide-react";
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
import { installmentsApi, transfersApi, type Giftable, type PlanPartPreview } from "@/integrations/api/client";
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
 *
 * Units of a running installment plan can be sent too (any number, at least one): the
 * recipient gets a plan of their own for them and continues their share of the installments.
 * `initialPlanId` / `initialUnits` open the dialog on such a plan (from the Installments page).
 */
export function GiftDialog({
  open,
  onOpenChange,
  onDone,
  mode = "gift",
  initialPlanId,
  initialUnits,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  mode?: "gift" | "transfer";
  initialPlanId?: string;
  initialUnits?: number;
}) {
  const { isRTL } = useLanguage();
  const isTransfer = mode === "transfer";
  const word = isTransfer
    ? { ar: "التحويل", en: "Transfer", enLower: "transfer" }
    : { ar: "الهدية", en: "Gift", enLower: "gift" };
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
  // Transfers review what they send on a confirmation step; gifts (Family page) send directly.
  const [confirming, setConfirming] = useState(false);

  const [planPreview, setPlanPreview] = useState<PlanPartPreview | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfirming(false);
    transfersApi
      .giftable()
      .then((g) => {
        setInfo(g);
        if (initialPlanId && g.plans?.some((p) => p.plan_id === initialPlanId)) {
          setAsset("units");
          setSlug(`plan:${initialPlanId}`);
          setUnits(String(initialUnits ?? 1));
        } else if (g.positions.length) setSlug((s) => s || g.positions[0].property_slug);
        else if (g.plans?.length) setSlug((s) => s || `plan:${g.plans![0].plan_id}`);
        else setAsset("cash");
      })
      .catch(() => setInfo(null));
  }, [open, initialPlanId, initialUnits]);

  // Units of an installment plan go with the recipient's share of the plan.
  const planSel = slug.startsWith("plan:") ? info?.plans?.find((p) => `plan:${p.plan_id}` === slug) : undefined;
  const pos = planSel ?? info?.positions.find((p) => p.property_slug === slug);
  const n = Number(units) || 0;
  const planOverdue = (planSel?.overdue_installments ?? 0) > 0;

  useEffect(() => {
    if (!open || !planSel || n < 1 || n > planSel.free_units) {
      setPlanPreview(null);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      installmentsApi
        .partPreview(planSel.plan_id, n)
        .then((p) => live && setPlanPreview(p))
        .catch(() => live && setPlanPreview(null));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, planSel?.plan_id, planSel?.free_units, n]);
  const amt = Number(amount) || 0;
  const value = asset === "units" ? n * (pos?.unit_value ?? 0) : amt;
  const fee = Math.round(value * (info?.gift_fee_percent ?? 0)) / 100;
  const valid =
    /\S+@\S+\.\S+/.test(email) &&
    (asset === "units"
      ? !!pos && n >= 1 && n <= pos.free_units && !planOverdue
      : amt > 0 && amt + fee <= (info?.balance ?? 0));

  const submit = async () => {
    setBusy(true);
    try {
      const t = await transfersApi.gift({
        recipient_email: email.trim(),
        recipient_name: name.trim(),
        asset,
        ...(asset === "units"
          ? planSel
            ? { property_slug: planSel.property_slug, units: n, plan_id: planSel.plan_id }
            : { property_slug: slug, units: n }
          : { amount: amt }),
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

  const later = date > today();
  const occasionRow = OCCASIONS.find((o) => o.id === occasion && o.id !== NO_OCCASION);
  const reviewRows: { label: string; value: string; ltr?: boolean }[] = [
    asset === "units"
      ? {
          label: isRTL ? "ما سيتم تحويله" : "What you send",
          value: `${n} ${isRTL ? "وحدة" : n === 1 ? "unit" : "units"} — ${(isRTL && pos?.property_name_ar) || pos?.property_name || ""}${
            planSel ? (isRTL ? " (خطة تقسيط)" : " (installment plan)") : ""
          }`,
        }
      : { label: isRTL ? "المبلغ" : "Amount", value: `$${amt.toFixed(2)}`, ltr: true },
    ...(asset === "units" && planSel && planPreview
      ? [{
          label: isRTL ? "يكمّلها المستلم" : "The recipient continues",
          value: isRTL
            ? `${planPreview.taker.schedule.length} قسط — $${planPreview.taker.remaining.toFixed(2)} أصل`
            : `${planPreview.taker.schedule.length} installments — $${planPreview.taker.remaining.toFixed(2)} principal`,
        }]
      : []),
    ...(fee > 0 ? [{ label: isRTL ? "رسوم التحويل" : "Transfer fee", value: `$${fee.toFixed(2)}`, ltr: true }] : []),
    ...(asset === "cash"
      ? [{ label: isRTL ? "يُخصم من رصيدك" : "Taken from your balance", value: `$${(amt + fee).toFixed(2)}`, ltr: true }]
      : []),
    { label: isRTL ? "بريد المستلم" : "Recipient email", value: email.trim(), ltr: true },
    ...(name.trim() ? [{ label: isRTL ? "اسم المستلم" : "Recipient name", value: name.trim() }] : []),
    { label: isRTL ? "تاريخ التسليم" : "Delivery date", value: later ? date : isRTL ? "فوراً" : "Right away" },
    ...(occasionRow ? [{ label: isRTL ? "المناسبة" : "Occasion", value: isRTL ? occasionRow.ar : occasionRow.en }] : []),
    ...(message.trim() ? [{ label: isRTL ? "الرسالة" : "Message", value: message.trim() }] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRTL ? "rtl" : "ltr"} className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isTransfer ? <ArrowLeftRight className="w-5 h-5 text-primary" /> : <Gift className="w-5 h-5 text-pink-500" />}
            {confirming
              ? isRTL ? "تأكيد التحويل" : "Confirm transfer"
              : isTransfer
                ? isRTL ? "تحويل" : "Transfer"
                : isRTL ? "هدية عقارية" : "Property gift"}
          </DialogTitle>
          <DialogDescription>
            {confirming
              ? isRTL
                ? "راجع البيانات قبل التأكيد. إن كان بريد المستلم مؤكدًا وهويته موثّقة والتسليم فوري، يصله التحويل مباشرة ولا يمكن إلغاؤه بعد ذلك."
                : "Check the details before confirming. If the recipient's email is confirmed, their identity verified and delivery is right away, the transfer reaches them at once and can't be cancelled after that."
              : isTransfer
              ? isRTL
                ? `يُحجز ما تحوّله فوراً، ويصل للمستلم مباشرة إن كان بريده مؤكدًا وهويته موثّقة، وإلا يصله بريد دعوة ويصله التحويل فور توثيقه. إن لم يستلمه خلال ${info?.claim_days ?? 30} يوماً يعود إليك، ويمكنك إلغاؤه قبل ذلك من صفحة التحويلات.`
                : `What you send is held at once and reaches the recipient right away if their email is confirmed and their identity verified; otherwise they get an invitation and receive it as soon as they verify. If not received within ${info?.claim_days ?? 30} days it returns to you — you can cancel it before then on the Transfers page.`
              : isRTL
                ? `يُحجز ما تهديه فوراً ويصل للمستلم بعد تأكيد بريده وتوثيق هويته. إن لم يستلمه خلال ${info?.claim_days ?? 30} يوماً يعود إليك، ويمكنك إلغاؤه قبل ذلك.`
                : `What you give is held at once and reaches the recipient after they confirm their email and verify their identity. If not received within ${info?.claim_days ?? 30} days it returns to you — you can cancel before then.`}
          </DialogDescription>
        </DialogHeader>

        {confirming ? (
          <dl className="rounded-lg border border-border divide-y divide-border text-sm">
            {reviewRows.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4 p-3">
                <dt className="text-muted-foreground shrink-0">{r.label}</dt>
                <dd className="font-medium text-end break-words min-w-0" dir={r.ltr ? "ltr" : undefined}>{r.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["units", "cash"] as const).map((a) => (
              <button
                key={a}
                type="button"
                disabled={a === "units" && !info?.positions.length && !info?.plans?.length}
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
                    {info?.plans?.map((p) => (
                      <SelectItem key={p.plan_id} value={`plan:${p.plan_id}`}>
                        {(isRTL && p.property_name_ar) || p.property_name} — {isRTL ? "خطة تقسيط" : "installment plan"} ({p.free_units})
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
          {asset === "units" && planSel && (
            <p className={cn("text-xs", planOverdue ? "text-destructive" : "text-muted-foreground")}>
              {planOverdue
                ? isRTL
                  ? "على هذه الخطة قسط متأخر. سدّده أولًا، وبعدها يمكنك تحويل جزء منها."
                  : "This plan has an overdue installment. Pay it first — then you can transfer part of it."
                : planPreview
                  ? isRTL
                    ? `يحصل المستلم على خطة باسمه بـ ${n} وحدة ويكمّل نصيبها من الأقساط: ${planPreview.taker.schedule.length} قسط، $${planPreview.taker.remaining.toFixed(2)} أصل، بنفس المواعيد. ويبقى لك ${planPreview.keptUnits} وحدة.`
                    : `The recipient gets a plan in their name for ${n} unit(s) and continues their share of the installments: ${planPreview.taker.schedule.length} installments, $${planPreview.taker.remaining.toFixed(2)} principal, on the same dates. You keep ${planPreview.keptUnits} unit(s).`
                  : isRTL
                    ? "المستلم يكمّل نصيب هذه الوحدات من أقساط الخطة."
                    : "The recipient continues these units' share of the plan's installments."}
            </p>
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
        )}

        <DialogFooter>
          {confirming ? (
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
              {isRTL ? "رجوع" : "Back"}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
          )}
          {isTransfer && !confirming ? (
            <Button onClick={() => setConfirming(true)} disabled={!valid} className="gap-2">
              <ArrowLeftRight className="w-4 h-4" />
              {isRTL ? "مراجعة التحويل" : "Review transfer"}
            </Button>
          ) : (
            <Button onClick={submit} disabled={busy || !valid} className="gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : isTransfer ? <ArrowLeftRight className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
              {confirming
                ? isRTL ? "تأكيد التحويل" : "Confirm transfer"
                : later
                  ? isRTL ? `جدولة ${word.ar}` : `Schedule ${word.enLower}`
                  : isRTL ? `إرسال ${word.ar}` : `Send ${word.enLower}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
