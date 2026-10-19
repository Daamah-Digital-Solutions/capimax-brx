import { useState } from "react";
import {
  CreditCard,
  Plus,
  Trash2,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddCardForm } from "./AddCardForm";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSavedCards } from "@/hooks/useSavedCards";
import { useLanguage } from "@/contexts/LanguageContext";

export function SavedCardsManager() {
  const { language } = useLanguage();
  const { cards, isLoading, deleteCard, setDefaultCard, refresh } = useSavedCards();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const isAr = language === "ar";

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteCard(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const getCardBrandIcon = (brand: string) => {
    // In a real app, you'd use actual card brand icons
    return <CreditCard className="w-5 h-5" />;
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">
            {isAr ? "البطاقات المحفوظة" : "Saved Cards"}
          </h3>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-1" />
          {isAr ? "إضافة" : "Add"}
        </Button>
      </div>

      {isLoading ? (
        <div className="p-4 text-center text-muted-foreground">
          {isAr ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : cards.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-border rounded-xl">
          <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">
            {isAr ? "لا توجد بطاقات محفوظة" : "No saved cards yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => (
            <div
              key={card.id}
              className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  {getCardBrandIcon(card.card_brand)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground capitalize">
                      {card.card_brand}
                    </span>
                    <span className="text-muted-foreground">•••• {card.card_last_four}</span>
                    {card.is_default && (
                      <Badge variant="outline" className="text-xs">
                        <Star className="w-3 h-3 mr-1" />
                        {isAr ? "افتراضي" : "Default"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {card.cardholder_name} • {isAr ? "تنتهي" : "Expires"} {card.card_expiry_month.toString().padStart(2, "0")}/{card.card_expiry_year}
                  </div>
                  {card.chargeable === false && (
                    <div className="text-xs text-warning">
                      {isAr ? "محفوظة قبل تفعيل الدفع بالبطاقات — أضفها من جديد لتستخدمها في الدفع." : "Saved before card payments were enabled — add it again to pay with it."}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!card.is_default && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDefaultCard(card.id)}
                    title={isAr ? "تعيين كافتراضي" : "Set as default"}
                  >
                    <Star className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteConfirmId(card.id)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Dialog — the card is entered and confirmed with Stripe (AddCardForm). */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isAr ? "إضافة بطاقة جديدة" : "Add New Card"}
            </DialogTitle>
            <DialogDescription>
              {isAr ? "أدخل تفاصيل بطاقتك" : "Enter your card details"}
            </DialogDescription>
          </DialogHeader>
          {showAddDialog && (
            <AddCardForm
              onSaved={() => { setShowAddDialog(false); refresh(); }}
              onCancel={() => setShowAddDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? "حذف البطاقة" : "Delete Card"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr 
                ? "هل أنت متأكد من حذف هذه البطاقة؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this card? This action cannot be undone."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {isAr ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
