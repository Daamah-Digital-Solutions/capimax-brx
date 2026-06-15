import { CreditCard, Check, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface SavedCard {
  id: string;
  card_brand: string;
  card_last_four: string;
  card_expiry_month: number;
  card_expiry_year: number;
  cardholder_name: string;
  is_default: boolean;
}

interface SavedCardsProps {
  cards: SavedCard[];
  selectedCardId: string | null;
  onSelectCard: (cardId: string | null) => void;
  onDeleteCard: (cardId: string) => void;
  onSetDefault: (cardId: string) => void;
  isLoading?: boolean;
}

const brandColors: Record<string, string> = {
  visa: "text-info",
  mastercard: "text-warning",
  amex: "text-info",
};

const brandLabels: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
};

export function SavedCards({
  cards,
  selectedCardId,
  onSelectCard,
  onDeleteCard,
  onSetDefault,
  isLoading,
}: SavedCardsProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleDelete = async (cardId: string) => {
    setDeletingId(cardId);
    await onDeleteCard(cardId);
    setDeletingId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-20 bg-muted rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">{t("payment.savedCards")}</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelectCard(null)}
          className="text-xs"
        >
          {t("payment.useNewCard")}
        </Button>
      </div>

      <div className="space-y-2">
        {cards.map((card) => {
          const isSelected = selectedCardId === card.id;
          const isDeleting = deletingId === card.id;

          return (
            <div
              key={card.id}
              className={cn(
                "relative p-4 rounded-xl border-2 transition-all cursor-pointer",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 bg-card",
                isDeleting && "opacity-50 pointer-events-none"
              )}
              onClick={() => onSelectCard(card.id)}
            >
              <div className="flex items-center gap-4">
                {/* Selection indicator */}
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground"
                  )}
                >
                  {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>

                {/* Card icon */}
                <div className="w-12 h-8 bg-muted rounded-md flex items-center justify-center">
                  <CreditCard className={cn("w-6 h-6", brandColors[card.card_brand] || "text-foreground")} />
                </div>

                {/* Card details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {brandLabels[card.card_brand] || card.card_brand}
                    </span>
                    <span className="text-muted-foreground">•••• {card.card_last_four}</span>
                    {card.is_default && (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {t("payment.default")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {card.cardholder_name} • {String(card.card_expiry_month).padStart(2, "0")}/{card.card_expiry_year}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!card.is_default && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetDefault(card.id);
                      }}
                    >
                      <Star className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(card.id);
                    }}
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
