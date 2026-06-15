import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  Building, 
  Calendar, 
  CheckCircle, 
  Clock, 
  FileText,
  XCircle,
  RefreshCw,
  Link2
} from "lucide-react";
import { format } from "date-fns";
import type { FamilyTransaction } from "@/hooks/useFamilyAccounts";

interface TransactionHistoryProps {
  transactions: FamilyTransaction[];
  isLoading?: boolean;
}

const transactionTypeConfig: Record<string, {
  icon: React.ElementType;
  labelEn: string;
  labelAr: string;
  color: string;
}> = {
  allocation: { icon: ArrowDownRight, labelEn: "Allocation", labelAr: "تخصيص", color: "text-blue-600" },
  transfer_initiated: { icon: ArrowUpRight, labelEn: "Transfer Initiated", labelAr: "تحويل جاري", color: "text-amber-600" },
  transfer_completed: { icon: CheckCircle, labelEn: "Transfer Completed", labelAr: "تحويل مكتمل", color: "text-green-600" },
  transfer_failed: { icon: XCircle, labelEn: "Transfer Failed", labelAr: "تحويل فاشل", color: "text-red-600" },
  schedule_created: { icon: Calendar, labelEn: "Schedule Created", labelAr: "جدول جديد", color: "text-purple-600" },
  schedule_updated: { icon: RefreshCw, labelEn: "Schedule Updated", labelAr: "تحديث الجدول", color: "text-cyan-600" },
  bank_linked: { icon: Link2, labelEn: "Bank Linked", labelAr: "ربط البنك", color: "text-indigo-600" },
  bank_verified: { icon: Building, labelEn: "Bank Verified", labelAr: "تحقق البنك", color: "text-teal-600" },
};

const statusConfig: Record<string, { labelEn: string; labelAr: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { labelEn: "Pending", labelAr: "قيد الانتظار", variant: "secondary" },
  processing: { labelEn: "Processing", labelAr: "قيد المعالجة", variant: "outline" },
  completed: { labelEn: "Completed", labelAr: "مكتمل", variant: "default" },
  failed: { labelEn: "Failed", labelAr: "فاشل", variant: "destructive" },
};

export function TransactionHistory({ transactions, isLoading }: TransactionHistoryProps) {
  const { isRTL } = useLanguage();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {isRTL ? "سجل المعاملات" : "Transaction History"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Clock className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {isRTL ? "سجل المعاملات" : "Transaction History"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{isRTL ? "لا توجد معاملات بعد" : "No transactions yet"}</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {transactions.map((tx) => {
                const config = transactionTypeConfig[tx.transaction_type] || transactionTypeConfig.allocation;
                const status = statusConfig[tx.status] || statusConfig.completed;
                const IconComponent = config.icon;

                return (
                  <div
                    key={tx.id}
                    className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-full bg-background flex items-center justify-center shrink-0 ${config.color}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-medium text-sm">
                          {isRTL ? config.labelAr : config.labelEn}
                        </p>
                        <Badge variant={status.variant} className="text-xs">
                          {isRTL ? status.labelAr : status.labelEn}
                        </Badge>
                      </div>
                      {tx.description && (
                        <p className="text-sm text-muted-foreground mb-2 truncate">
                          {tx.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(tx.created_at), "MMM dd, yyyy HH:mm")}
                        </span>
                        {tx.amount && (
                          <span className="font-medium text-foreground">
                            ${tx.amount.toLocaleString()} {tx.currency}
                          </span>
                        )}
                        {tx.reference_number && (
                          <span className="font-mono">
                            #{tx.reference_number}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
