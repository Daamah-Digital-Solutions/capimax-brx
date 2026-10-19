import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { paymentMethodsApi } from "@/integrations/api/client";
import { cn } from "@/lib/utils";

// Pick one of the investor's saved cards (or a new card). The server attaches the chosen card
// to the payment — its Stripe id never reaches the browser — and the browser only confirms it
// (3-D Secure if the bank asks). Renders nothing when there is no usable saved card.

interface SavedCardRow {
  id: string;
  card_brand: string;
  card_last_four: string;
  card_expiry_month: number;
  card_expiry_year: number;
  is_default: boolean;
  chargeable: boolean;
}

export function SavedCardPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [cards, setCards] = useState<SavedCardRow[]>([]);

  useEffect(() => {
    paymentMethodsApi
      .listCards()
      .then((rows) => {
        const usable = (rows as SavedCardRow[]).filter((c) => c.chargeable);
        setCards(usable);
        const def = usable.find((c) => c.is_default) ?? usable[0];
        if (def) onChange(def.id);
      })
      .catch(() => setCards([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cards.length === 0) return null;

  const option = (id: string | null, label: string, sub?: string) => (
    <button
      key={id ?? "new"}
      type="button"
      onClick={() => onChange(id)}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg border text-start transition-colors",
        value === id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
      )}
    >
      <CreditCard className="w-4 h-4 text-primary shrink-0" />
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      {sub && <span className="text-xs text-muted-foreground" dir="ltr">{sub}</span>}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">{isAr ? "ادفع بكارت محفوظ" : "Pay with a saved card"}</div>
      {cards.map((c) =>
        option(
          c.id,
          `${c.card_brand.toUpperCase()} •••• ${c.card_last_four}`,
          `${String(c.card_expiry_month).padStart(2, "0")}/${String(c.card_expiry_year).slice(-2)}`,
        ),
      )}
      {option(null, isAr ? "كارت جديد" : "Use a new card")}
    </div>
  );
}
