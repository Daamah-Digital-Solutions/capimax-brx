import { useState } from "react";
import {
  Building2,
  Plus,
  Trash2,
  Edit2,
  Star,
  Shield,
  X,
  Check,
  MapPin,
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
import { useInvestorBankAccounts, type NewBankAccountData } from "@/hooks/useInvestorBankAccounts";
import { useLanguage } from "@/contexts/LanguageContext";

const countries = [
  { code: "AE", nameEn: "UAE", nameAr: "الإمارات" },
  { code: "SA", nameEn: "Saudi Arabia", nameAr: "السعودية" },
  { code: "QA", nameEn: "Qatar", nameAr: "قطر" },
  { code: "KW", nameEn: "Kuwait", nameAr: "الكويت" },
  { code: "BH", nameEn: "Bahrain", nameAr: "البحرين" },
  { code: "OM", nameEn: "Oman", nameAr: "عمان" },
  { code: "EG", nameEn: "Egypt", nameAr: "مصر" },
  { code: "JO", nameEn: "Jordan", nameAr: "الأردن" },
  { code: "LB", nameEn: "Lebanon", nameAr: "لبنان" },
  { code: "US", nameEn: "USA", nameAr: "أمريكا" },
  { code: "GB", nameEn: "UK", nameAr: "بريطانيا" },
  { code: "DE", nameEn: "Germany", nameAr: "ألمانيا" },
  { code: "FR", nameEn: "France", nameAr: "فرنسا" },
  { code: "CH", nameEn: "Switzerland", nameAr: "سويسرا" },
  { code: "SG", nameEn: "Singapore", nameAr: "سنغافورة" },
  { code: "IN", nameEn: "India", nameAr: "الهند" },
];

const currencies = [
  { code: "USD", nameEn: "US Dollar", nameAr: "دولار أمريكي" },
  { code: "AED", nameEn: "UAE Dirham", nameAr: "درهم إماراتي" },
  { code: "SAR", nameEn: "Saudi Riyal", nameAr: "ريال سعودي" },
  { code: "QAR", nameEn: "Qatari Riyal", nameAr: "ريال قطري" },
  { code: "KWD", nameEn: "Kuwaiti Dinar", nameAr: "دينار كويتي" },
  { code: "BHD", nameEn: "Bahraini Dinar", nameAr: "دينار بحريني" },
  { code: "OMR", nameEn: "Omani Rial", nameAr: "ريال عماني" },
  { code: "EGP", nameEn: "Egyptian Pound", nameAr: "جنيه مصري" },
  { code: "JOD", nameEn: "Jordanian Dinar", nameAr: "دينار أردني" },
  { code: "EUR", nameEn: "Euro", nameAr: "يورو" },
  { code: "GBP", nameEn: "British Pound", nameAr: "جنيه إسترليني" },
  { code: "CHF", nameEn: "Swiss Franc", nameAr: "فرنك سويسري" },
  { code: "SGD", nameEn: "Singapore Dollar", nameAr: "دولار سنغافوري" },
  { code: "INR", nameEn: "Indian Rupee", nameAr: "روبية هندية" },
];

const initialFormData: NewBankAccountData = {
  bank_name: "",
  bank_code: "",
  account_holder_name: "",
  account_number: "",
  iban: "",
  swift_code: "",
  country: "",
  currency: "USD",
};

export function BankAccountsManager() {
  const { language } = useLanguage();
  const { accounts, isLoading, addAccount, updateAccount, deleteAccount, setDefaultAccount } = useInvestorBankAccounts();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState<NewBankAccountData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAr = language === "ar";

  const handleSubmit = async () => {
    if (!formData.bank_name || !formData.account_holder_name || !formData.account_number || !formData.country) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateAccount(editingId, formData);
      } else {
        await addAccount(formData);
      }
      setShowAddDialog(false);
      setEditingId(null);
      setFormData(initialFormData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (account: typeof accounts[0]) => {
    setEditingId(account.id);
    setFormData({
      bank_name: account.bank_name,
      bank_code: account.bank_code || "",
      account_holder_name: account.account_holder_name,
      account_number: "", // Can't show masked number
      iban: "",
      swift_code: account.swift_code || "",
      country: account.country,
      currency: account.currency,
    });
    setShowAddDialog(true);
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteAccount(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">
            {isAr ? "الحسابات البنكية" : "Bank Accounts"}
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
      ) : accounts.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-border rounded-xl">
          <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">
            {isAr ? "لا توجد حسابات بنكية مضافة" : "No bank accounts added yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{account.bank_name}</span>
                    {account.is_default && (
                      <Badge variant="outline" className="text-xs">
                        <Star className="w-3 h-3 mr-1" />
                        {isAr ? "افتراضي" : "Default"}
                      </Badge>
                    )}
                    {account.is_verified && (
                      <Badge variant="success" className="text-xs">
                        <Shield className="w-3 h-3 mr-1" />
                        {isAr ? "موثق" : "Verified"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{account.account_number_masked}</span>
                    <span>•</span>
                    <span>{account.currency}</span>
                    <span>•</span>
                    <MapPin className="w-3 h-3" />
                    <span>{countries.find(c => c.code === account.country)?.[isAr ? "nameAr" : "nameEn"] || account.country}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!account.is_default && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDefaultAccount(account.id)}
                    title={isAr ? "تعيين كافتراضي" : "Set as default"}
                  >
                    <Star className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(account)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteConfirmId(account.id)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) {
          setEditingId(null);
          setFormData(initialFormData);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId 
                ? (isAr ? "تعديل الحساب البنكي" : "Edit Bank Account")
                : (isAr ? "إضافة حساب بنكي" : "Add Bank Account")
              }
            </DialogTitle>
            <DialogDescription>
              {isAr ? "أدخل تفاصيل حسابك البنكي" : "Enter your bank account details"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isAr ? "الدولة" : "Country"} *</Label>
                <Select value={formData.country} onValueChange={(v) => setFormData({ ...formData, country: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={isAr ? "اختر الدولة" : "Select country"} />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {isAr ? country.nameAr : country.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isAr ? "العملة" : "Currency"} *</Label>
                <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.code} - {isAr ? currency.nameAr : currency.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{isAr ? "اسم البنك" : "Bank Name"} *</Label>
              <Input
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder={isAr ? "مثال: بنك الإمارات دبي الوطني" : "e.g., Emirates NBD"}
              />
            </div>

            <div className="space-y-2">
              <Label>{isAr ? "اسم صاحب الحساب" : "Account Holder Name"} *</Label>
              <Input
                value={formData.account_holder_name}
                onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                placeholder={isAr ? "الاسم كما يظهر في البنك" : "Name as it appears in the bank"}
              />
            </div>

            <div className="space-y-2">
              <Label>{isAr ? "رقم الحساب" : "Account Number"} *</Label>
              <Input
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                placeholder="XXXXXXXXXX"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isAr ? "رقم الآيبان" : "IBAN"}</Label>
                <Input
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  placeholder="e.g., AE07..."
                />
              </div>
              <div className="space-y-2">
                <Label>{isAr ? "رمز السويفت" : "SWIFT Code"}</Label>
                <Input
                  value={formData.swift_code}
                  onChange={(e) => setFormData({ ...formData, swift_code: e.target.value })}
                  placeholder="e.g., EABORAAE"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowAddDialog(false);
                  setEditingId(null);
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
                disabled={isSubmitting || !formData.bank_name || !formData.account_holder_name || !formData.account_number || !formData.country}
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
            <AlertDialogTitle>{isAr ? "حذف الحساب البنكي" : "Delete Bank Account"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr 
                ? "هل أنت متأكد من حذف هذا الحساب البنكي؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this bank account? This action cannot be undone."
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
