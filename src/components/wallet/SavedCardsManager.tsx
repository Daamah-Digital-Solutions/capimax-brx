import { useState } from "react";
import {
  CreditCard,
  Plus,
  Trash2,
  Star,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const cardBrands = [
  { id: "visa", name: "Visa" },
  { id: "mastercard", name: "Mastercard" },
  { id: "amex", name: "American Express" },
  { id: "discover", name: "Discover" },
];

interface NewCardData {
  card_brand: string;
  card_last_four: string;
  card_expiry_month: number;
  card_expiry_year: number;
  cardholder_name: string;
}

const initialFormData: NewCardData = {
  card_brand: "visa",
  card_last_four: "",
  card_expiry_month: 1,
  card_expiry_year: new Date().getFullYear(),
  cardholder_name: "",
};

export function SavedCardsManager() {
  const { language } = useLanguage();
  const { cards, isLoading, saveCard, deleteCard, setDefaultCard } = useSavedCards();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState<NewCardData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAr = language === "ar";

  const handleSubmit = async () => {
    if (!formData.cardholder_name || !formData.card_last_four) {
      return;
    }

    setIsSubmitting(true);
    try {
      await saveCard(formData);
      setShowAddDialog(false);
      setFormData(initialFormData);
    } finally {
      setIsSubmitting(false);
    }
  };

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

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) setFormData(initialFormData);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isAr ? "إضافة بطاقة جديدة" : "Add New Card"}
            </DialogTitle>
            <DialogDescription>
              {isAr ? "أدخل تفاصيل بطاقتك" : "Enter your card details"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isAr ? "نوع البطاقة" : "Card Type"}</Label>
              <Select value={formData.card_brand} onValueChange={(v) => setFormData({ ...formData, card_brand: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cardBrands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{isAr ? "اسم حامل البطاقة" : "Cardholder Name"} *</Label>
              <Input
                value={formData.cardholder_name}
                onChange={(e) => setFormData({ ...formData, cardholder_name: e.target.value })}
                placeholder={isAr ? "الاسم كما يظهر على البطاقة" : "Name as it appears on card"}
              />
            </div>

            <div className="space-y-2">
              <Label>{isAr ? "آخر 4 أرقام" : "Last 4 Digits"} *</Label>
              <Input
                value={formData.card_last_four}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setFormData({ ...formData, card_last_four: value });
                }}
                placeholder="1234"
                maxLength={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isAr ? "شهر الانتهاء" : "Expiry Month"}</Label>
                <Select 
                  value={formData.card_expiry_month.toString()} 
                  onValueChange={(v) => setFormData({ ...formData, card_expiry_month: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {month.toString().padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isAr ? "سنة الانتهاء" : "Expiry Year"}</Label>
                <Select 
                  value={formData.card_expiry_year.toString()} 
                  onValueChange={(v) => setFormData({ ...formData, card_expiry_year: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowAddDialog(false);
                  setFormData(initialFormData);
                }}
              >
                <X className="w-4 h-4 mr-1" />
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                variant="hero"
                className="flex-1"
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.cardholder_name || formData.card_last_four.length !== 4}
              >
                <Check className="w-4 h-4 mr-1" />
                {isSubmitting 
                  ? (isAr ? "جاري الحفظ..." : "Saving...") 
                  : (isAr ? "حفظ" : "Save")
                }
              </Button>
            </div>
          </div>
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
