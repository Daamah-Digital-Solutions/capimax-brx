import { useState } from "react";
import {
  Bitcoin,
  Plus,
  Trash2,
  Edit2,
  Star,
  Shield,
  X,
  Check,
  Copy,
  ExternalLink,
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
import { useInvestorCryptoWallets, type NewCryptoWalletData } from "@/hooks/useInvestorCryptoWallets";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

const networks = [
  { id: "ethereum", nameEn: "Ethereum (ERC-20)", nameAr: "إيثيريوم (ERC-20)", explorer: "https://etherscan.io/address/" },
  { id: "polygon", nameEn: "Polygon (MATIC)", nameAr: "بوليجون (MATIC)", explorer: "https://polygonscan.com/address/" },
  { id: "bsc", nameEn: "BNB Smart Chain (BEP-20)", nameAr: "سلسلة بي إن بي الذكية", explorer: "https://bscscan.com/address/" },
  { id: "arbitrum", nameEn: "Arbitrum", nameAr: "أربيتروم", explorer: "https://arbiscan.io/address/" },
  { id: "optimism", nameEn: "Optimism", nameAr: "أوبتيميزم", explorer: "https://optimistic.etherscan.io/address/" },
  { id: "avalanche", nameEn: "Avalanche (C-Chain)", nameAr: "أفالانش", explorer: "https://snowtrace.io/address/" },
  { id: "solana", nameEn: "Solana", nameAr: "سولانا", explorer: "https://solscan.io/account/" },
  { id: "tron", nameEn: "TRON (TRC-20)", nameAr: "ترون (TRC-20)", explorer: "https://tronscan.org/#/address/" },
];

const initialFormData: NewCryptoWalletData = {
  wallet_address: "",
  wallet_label: "",
  network: "ethereum",
};

export function CryptoWalletsManager() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { wallets, isLoading, addWallet, updateWallet, deleteWallet, setDefaultWallet } = useInvestorCryptoWallets();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState<NewCryptoWalletData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAr = language === "ar";

  const handleSubmit = async () => {
    if (!formData.wallet_address || !formData.network) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateWallet(editingId, formData);
      } else {
        await addWallet(formData);
      }
      setShowAddDialog(false);
      setEditingId(null);
      setFormData(initialFormData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (wallet: typeof wallets[0]) => {
    setEditingId(wallet.id);
    setFormData({
      wallet_address: wallet.wallet_address,
      wallet_label: wallet.wallet_label || "",
      network: wallet.network,
    });
    setShowAddDialog(true);
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteWallet(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({
      title: isAr ? "تم النسخ" : "Copied",
      description: isAr ? "تم نسخ العنوان" : "Address copied to clipboard",
    });
  };

  const getExplorerUrl = (address: string, network: string) => {
    const net = networks.find(n => n.id === network);
    return net ? `${net.explorer}${address}` : "#";
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bitcoin className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">
            {isAr ? "محافظ العملات الرقمية" : "Crypto Wallets"}
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
      ) : wallets.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-border rounded-xl">
          <Bitcoin className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">
            {isAr ? "لا توجد محافظ مضافة" : "No crypto wallets added yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {wallets.map((wallet) => {
            const network = networks.find(n => n.id === wallet.network);
            return (
              <div
                key={wallet.id}
                className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Bitcoin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {wallet.wallet_label || (isAr ? "محفظة" : "Wallet")}
                      </span>
                      {wallet.is_default && (
                        <Badge variant="outline" className="text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          {isAr ? "افتراضي" : "Default"}
                        </Badge>
                      )}
                      {wallet.is_verified && (
                        <Badge variant="success" className="text-xs">
                          <Shield className="w-3 h-3 mr-1" />
                          {isAr ? "موثق" : "Verified"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-mono">{truncateAddress(wallet.wallet_address)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => copyAddress(wallet.wallet_address)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <a
                        href={getExplorerUrl(wallet.wallet_address, wallet.network)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <span>•</span>
                      <span>{isAr ? network?.nameAr : network?.nameEn}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!wallet.is_default && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDefaultWallet(wallet.id)}
                      title={isAr ? "تعيين كافتراضي" : "Set as default"}
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(wallet)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConfirmId(wallet.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
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
                ? (isAr ? "تعديل المحفظة" : "Edit Crypto Wallet")
                : (isAr ? "إضافة محفظة" : "Add Crypto Wallet")
              }
            </DialogTitle>
            <DialogDescription>
              {isAr ? "أدخل تفاصيل محفظتك الرقمية" : "Enter your crypto wallet details"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isAr ? "الشبكة" : "Network"} *</Label>
              <Select value={formData.network} onValueChange={(v) => setFormData({ ...formData, network: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {networks.map((network) => (
                    <SelectItem key={network.id} value={network.id}>
                      {isAr ? network.nameAr : network.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{isAr ? "عنوان المحفظة" : "Wallet Address"} *</Label>
              <Input
                value={formData.wallet_address}
                onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })}
                placeholder="0x..."
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>{isAr ? "اسم المحفظة (اختياري)" : "Wallet Label (Optional)"}</Label>
              <Input
                value={formData.wallet_label}
                onChange={(e) => setFormData({ ...formData, wallet_label: e.target.value })}
                placeholder={isAr ? "مثال: محفظتي الرئيسية" : "e.g., My Main Wallet"}
              />
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
                disabled={isSubmitting || !formData.wallet_address || !formData.network}
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
            <AlertDialogTitle>{isAr ? "حذف المحفظة" : "Delete Crypto Wallet"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr 
                ? "هل أنت متأكد من حذف هذه المحفظة؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this wallet? This action cannot be undone."
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
