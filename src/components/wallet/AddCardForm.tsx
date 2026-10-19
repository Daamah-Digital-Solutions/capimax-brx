import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { paymentMethodsApi, type ApiError } from "@/integrations/api/client";

// Save a card with Stripe: the card is entered in Stripe's own field and confirmed by Stripe
// (3-D Secure if the bank asks); our server only reads the result from Stripe. The card can
// then be picked at checkout, top-up and installment payments.

const stripeCache: Record<string, Promise<Stripe | null>> = {};

export function AddCardForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [setup, setSetup] = useState<{ client_secret: string; setup_intent_id: string; publishable_key: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    paymentMethodsApi
      .cardSetup()
      .then(setSetup)
      .catch((err: ApiError) =>
        setError(
          (err?.data as { code?: string } | undefined)?.code === "stripe_unconfigured"
            ? isAr ? "مدفوعات البطاقة غير مُفعّلة بعد." : "Card payments are not configured yet."
            : err?.message || (isAr ? "تعذّر بدء حفظ البطاقة" : "Couldn't start saving the card"),
        ),
      );
  }, [isAr]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!setup) return <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />;

  stripeCache[setup.publishable_key] ??= loadStripe(setup.publishable_key);
  return (
    <Elements stripe={stripeCache[setup.publishable_key]}>
      <Inner setup={setup} onSaved={onSaved} onCancel={onCancel} />
    </Elements>
  );
}

function Inner({
  setup,
  onSaved,
  onCancel,
}: {
  setup: { client_secret: string; setup_intent_id: string };
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const stripe = useStripe();
  const elements = useElements();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const card = elements?.getElement(CardElement);
    if (!stripe || !card) return;
    setBusy(true);
    try {
      const { error, setupIntent } = await stripe.confirmCardSetup(setup.client_secret, {
        payment_method: { card, billing_details: { name: name || undefined } },
      });
      if (error) {
        toast.error(error.message || (isAr ? "تعذّر تأكيد البطاقة" : "Couldn't confirm the card"));
        return;
      }
      await paymentMethodsApi.addCard({ setup_intent_id: setupIntent?.id || setup.setup_intent_id });
      toast.success(isAr ? "تم حفظ البطاقة" : "Card saved");
      onSaved();
    } catch (err) {
      toast.error((err as ApiError)?.message || (isAr ? "تعذّر حفظ البطاقة" : "Couldn't save the card"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{isAr ? "اسم حامل البطاقة" : "Cardholder name"}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isAr ? "الاسم كما يظهر على البطاقة" : "Name as it appears on card"} />
      </div>
      <div className="p-4 rounded-xl border border-border bg-card" dir="ltr">
        <CardElement
          options={{
            hidePostalCode: true,
            style: {
              base: { fontSize: "16px", color: "#e2e8f0", "::placeholder": { color: "#94a3b8" } },
              invalid: { color: "#ef4444" },
            },
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "تُحفظ البطاقة لدى Stripe ولا تُخزَّن أرقامها على خوادمنا. تُستخدم فقط عندما تختارها وتؤكد الدفع بنفسك."
          : "The card is stored by Stripe — its number never reaches our servers. It is only charged when you pick it and confirm a payment."}
      </p>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={busy}>
          <X className="w-4 h-4 mr-1" />
          {isAr ? "إلغاء" : "Cancel"}
        </Button>
        <Button variant="hero" className="flex-1" onClick={save} disabled={busy || !stripe}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
          {isAr ? "حفظ" : "Save"}
        </Button>
      </div>
    </div>
  );
}
