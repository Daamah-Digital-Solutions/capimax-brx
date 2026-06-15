import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  BadgeCheck, 
  Building, 
  Calendar, 
  DollarSign, 
  Heart, 
  MoreVertical, 
  Send, 
  Shield, 
  Eye,
  UserCheck,
  User,
  Mail,
  Clock,
  CreditCard,
  Percent,
  ArrowUpRight
} from "lucide-react";
import { BankAccountForm } from "./BankAccountForm";
import { TransferScheduleForm } from "./TransferScheduleForm";
import type { FamilyAccount, FamilyBankAccount, TransferSchedule } from "@/hooks/useFamilyAccounts";

interface FamilyMemberCardProps {
  member: FamilyAccount;
  bankAccounts: FamilyBankAccount[];
  transferSchedules: TransferSchedule[];
  onAddBankAccount: (data: {
    family_account_id: string;
    bank_name: string;
    bank_code?: string;
    account_holder_name: string;
    account_number: string;
    iban?: string;
    currency?: string;
    is_primary?: boolean;
  }) => Promise<unknown>;
  onCreateSchedule: (data: {
    family_account_id: string;
    bank_account_id: string;
    schedule_type: "immediate" | "weekly" | "monthly" | "quarterly" | "threshold";
    threshold_amount?: number;
  }) => Promise<unknown>;
  onInitiateTransfer: (data: { family_account_id: string; bank_account_id: string; amount: number }) => Promise<unknown>;
  onUpdateAccessLevel: (data: { accountId: string; accessLevel: "view_only" | "authorized" }) => Promise<void>;
  isAddingBank?: boolean;
  isCreatingSchedule?: boolean;
}

export function FamilyMemberCard({
  member,
  bankAccounts,
  transferSchedules,
  onAddBankAccount,
  onCreateSchedule,
  onInitiateTransfer,
  onUpdateAccessLevel,
  isAddingBank,
  isCreatingSchedule,
}: FamilyMemberCardProps) {
  const { isRTL } = useLanguage();
  const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isMemberPageOpen, setIsMemberPageOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");

  const memberBankAccounts = bankAccounts.filter((ba) => ba.family_account_id === member.id);
  const memberSchedules = transferSchedules.filter((ts) => ts.family_account_id === member.id);
  const primaryBank = memberBankAccounts.find((ba) => ba.is_primary) || memberBankAccounts[0];
  const activeSchedule = memberSchedules.find((s) => s.is_active);

  const handleTransfer = async () => {
    if (!primaryBank || !transferAmount) return;
    await onInitiateTransfer({
      family_account_id: member.id,
      bank_account_id: primaryBank.id,
      amount: parseFloat(transferAmount),
    });
    setTransferAmount("");
    setIsTransferDialogOpen(false);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Member Info */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-xl font-bold text-white">
                {member.member_name.charAt(0)}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">{member.member_name}</h3>
                {member.status === "active" && (
                  <BadgeCheck className="w-5 h-5 text-green-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">{member.member_email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  <Heart className="w-3 h-3 mr-1" />
                  {member.relationship}
                </Badge>
                <Badge 
                  className={
                    member.status === "active" 
                      ? "bg-green-500/20 text-green-600 border-green-500/30"
                      : "bg-yellow-500/20 text-yellow-600 border-yellow-500/30"
                  }
                >
                  {member.status === "active" 
                    ? (isRTL ? "نشط" : "Active")
                    : (isRTL ? "معلق" : "Pending")}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {member.access_level === "authorized" ? (
                    <>
                      <UserCheck className="w-3 h-3 mr-1" />
                      {isRTL ? "مفوض" : "Authorized"}
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 mr-1" />
                      {isRTL ? "عرض فقط" : "View Only"}
                    </>
                  )}
                </Badge>
              </div>
            </div>
          </div>

          {/* Stats and Actions */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-lg font-bold text-foreground">{member.allocated_returns_percent}%</div>
                <div className="text-xs text-muted-foreground">
                  {isRTL ? "العوائد المخصصة" : "Allocated Returns"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">${member.total_transferred.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  {isRTL ? "إجمالي المحول" : "Total Transferred"}
                </div>
              </div>
            </div>

            {/* Bank Status */}
            {primaryBank && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                <Building className="w-4 h-4 text-muted-foreground" />
                <div className="text-xs">
                  <p className="font-medium">{primaryBank.bank_name}</p>
                  <p className="text-muted-foreground">{primaryBank.account_number_masked}</p>
                </div>
                {primaryBank.is_verified && (
                  <Shield className="w-4 h-4 text-green-500" />
                )}
              </div>
            )}

            {/* Schedule Status */}
            {activeSchedule && (
              <Badge variant="outline" className="bg-primary/10">
                <Calendar className="w-3 h-3 mr-1" />
                {activeSchedule.schedule_type}
              </Badge>
            )}

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsMemberPageOpen(true)}>
                  <User className="w-4 h-4 mr-2" />
                  {isRTL ? "صفحة العضو" : "Member Page"}
                </DropdownMenuItem>
                {!primaryBank && (
                  <DropdownMenuItem onClick={() => setIsBankDialogOpen(true)}>
                    <Building className="w-4 h-4 mr-2" />
                    {isRTL ? "ربط حساب بنكي" : "Link Bank Account"}
                  </DropdownMenuItem>
                )}
                {primaryBank && !activeSchedule && (
                  <DropdownMenuItem onClick={() => setIsScheduleDialogOpen(true)}>
                    <Calendar className="w-4 h-4 mr-2" />
                    {isRTL ? "إعداد التحويل التلقائي" : "Setup Auto Transfer"}
                  </DropdownMenuItem>
                )}
                {primaryBank && (
                  <DropdownMenuItem onClick={() => setIsTransferDialogOpen(true)}>
                    <Send className="w-4 h-4 mr-2" />
                    {isRTL ? "تحويل يدوي" : "Manual Transfer"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={() => onUpdateAccessLevel({
                    accountId: member.id,
                    accessLevel: member.access_level === "view_only" ? "authorized" : "view_only"
                  })}
                >
                  {member.access_level === "view_only" ? (
                    <>
                      <UserCheck className="w-4 h-4 mr-2" />
                      {isRTL ? "منح صلاحيات" : "Grant Authorization"}
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      {isRTL ? "عرض فقط" : "Set View Only"}
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Bank Account Dialog */}
        <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isRTL ? "ربط حساب بنكي" : "Link Bank Account"}</DialogTitle>
              <DialogDescription>
                {isRTL 
                  ? `إضافة حساب بنكي لـ ${member.member_name} لتلقي التحويلات التلقائية`
                  : `Add a bank account for ${member.member_name} to receive automatic transfers`}
              </DialogDescription>
            </DialogHeader>
            <BankAccountForm
              familyAccountId={member.id}
              onSubmit={async (data) => {
                await onAddBankAccount(data);
                setIsBankDialogOpen(false);
              }}
              onCancel={() => setIsBankDialogOpen(false)}
              isSubmitting={isAddingBank}
            />
          </DialogContent>
        </Dialog>

        {/* Schedule Dialog */}
        <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isRTL ? "إعداد التحويل التلقائي" : "Setup Auto Transfer"}</DialogTitle>
              <DialogDescription>
                {isRTL 
                  ? "اختر متى يتم تحويل العوائد تلقائياً"
                  : "Choose when returns should be automatically transferred"}
              </DialogDescription>
            </DialogHeader>
            <TransferScheduleForm
              familyAccountId={member.id}
              bankAccounts={memberBankAccounts}
              onSubmit={async (data) => {
                await onCreateSchedule(data);
                setIsScheduleDialogOpen(false);
              }}
              onCancel={() => setIsScheduleDialogOpen(false)}
              isSubmitting={isCreatingSchedule}
            />
          </DialogContent>
        </Dialog>

        {/* Manual Transfer Dialog */}
        <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? "تحويل يدوي" : "Manual Transfer"}</DialogTitle>
              <DialogDescription>
                {isRTL 
                  ? `تحويل إلى ${member.member_name} عبر ${primaryBank?.bank_name}`
                  : `Transfer to ${member.member_name} via ${primaryBank?.bank_name}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{isRTL ? "المبلغ" : "Amount"}</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                    placeholder="0.00"
                    min={0}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={handleTransfer} disabled={!transferAmount}>
                <Send className="w-4 h-4 mr-2" />
                {isRTL ? "تحويل" : "Transfer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Member Page Dialog */}
        <Dialog open={isMemberPageOpen} onOpenChange={setIsMemberPageOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">
                    {member.member_name.charAt(0)}
                  </span>
                </div>
                <div>
                  <span className="flex items-center gap-2">
                    {member.member_name}
                    {member.status === "active" && (
                      <BadgeCheck className="w-5 h-5 text-green-500" />
                    )}
                  </span>
                  <p className="text-sm font-normal text-muted-foreground">{member.member_email}</p>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Personal Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    {isRTL ? "المعلومات الشخصية" : "Personal Information"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">{isRTL ? "الاسم" : "Name"}</p>
                        <p className="font-medium">{member.member_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">{isRTL ? "البريد الإلكتروني" : "Email"}</p>
                        <p className="font-medium text-sm">{member.member_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Heart className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">{isRTL ? "صلة القرابة" : "Relationship"}</p>
                        <p className="font-medium">{member.relationship}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">{isRTL ? "تاريخ الربط" : "Linked Date"}</p>
                        <p className="font-medium">{member.linked_at ? new Date(member.linked_at).toLocaleDateString() : "-"}</p>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        className={
                          member.status === "active" 
                            ? "bg-green-500/20 text-green-600 border-green-500/30"
                            : "bg-yellow-500/20 text-yellow-600 border-yellow-500/30"
                        }
                      >
                        {member.status === "active" ? (isRTL ? "نشط" : "Active") : (isRTL ? "معلق" : "Pending")}
                      </Badge>
                      <Badge variant="outline">
                        {member.access_level === "authorized" ? (
                          <>
                            <UserCheck className="w-3 h-3 mr-1" />
                            {isRTL ? "مفوض" : "Authorized"}
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 mr-1" />
                            {isRTL ? "عرض فقط" : "View Only"}
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    {isRTL ? "الملخص المالي" : "Financial Summary"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
                      <Percent className="w-6 h-6 text-primary mx-auto mb-2" />
                      <p className="text-2xl font-bold text-foreground">{member.allocated_returns_percent}%</p>
                      <p className="text-xs text-muted-foreground">{isRTL ? "العوائد المخصصة" : "Allocated Returns"}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20 text-center">
                      <ArrowUpRight className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-600">${member.total_transferred.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{isRTL ? "إجمالي المحول" : "Total Transferred"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bank Accounts */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building className="w-4 h-4 text-primary" />
                    {isRTL ? "الحسابات البنكية" : "Bank Accounts"}
                    <Badge variant="secondary" className="ml-auto">{memberBankAccounts.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {memberBankAccounts.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Building className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>{isRTL ? "لا توجد حسابات بنكية مرتبطة" : "No bank accounts linked"}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-3"
                        onClick={() => {
                          setIsMemberPageOpen(false);
                          setIsBankDialogOpen(true);
                        }}
                      >
                        <Building className="w-4 h-4 mr-2" />
                        {isRTL ? "إضافة حساب بنكي" : "Add Bank Account"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {memberBankAccounts.map((bank) => (
                        <div key={bank.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <CreditCard className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{bank.bank_name}</p>
                              <p className="text-sm text-muted-foreground">{bank.account_number_masked}</p>
                              {bank.iban_masked && (
                                <p className="text-xs text-muted-foreground">IBAN: {bank.iban_masked}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{bank.currency}</Badge>
                            {bank.is_verified ? (
                              <Badge className="bg-green-500/20 text-green-600">
                                <Shield className="w-3 h-3 mr-1" />
                                {isRTL ? "موثق" : "Verified"}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">{isRTL ? "قيد التحقق" : "Pending"}</Badge>
                            )}
                            {bank.is_primary && (
                              <Badge className="bg-primary/20 text-primary">
                                {isRTL ? "أساسي" : "Primary"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Transfer Schedules */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    {isRTL ? "جداول التحويل" : "Transfer Schedules"}
                    <Badge variant="secondary" className="ml-auto">{memberSchedules.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {memberSchedules.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>{isRTL ? "لا توجد جداول تحويل" : "No transfer schedules"}</p>
                      {primaryBank && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-3"
                          onClick={() => {
                            setIsMemberPageOpen(false);
                            setIsScheduleDialogOpen(true);
                          }}
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          {isRTL ? "إضافة جدول" : "Add Schedule"}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {memberSchedules.map((schedule) => {
                        const bank = memberBankAccounts.find(ba => ba.id === schedule.bank_account_id);
                        return (
                          <div key={schedule.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-purple-600" />
                              </div>
                              <div>
                                <p className="font-medium capitalize">{schedule.schedule_type}</p>
                                <p className="text-sm text-muted-foreground">{bank?.bank_name}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {schedule.threshold_amount && (
                                <Badge variant="secondary">
                                  ${schedule.threshold_amount.toLocaleString()}
                                </Badge>
                              )}
                              {schedule.is_active ? (
                                <Badge className="bg-green-500/20 text-green-600">
                                  {isRTL ? "نشط" : "Active"}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">{isRTL ? "موقوف" : "Paused"}</Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsMemberPageOpen(false)}>
                {isRTL ? "إغلاق" : "Close"}
              </Button>
              {primaryBank && (
                <Button onClick={() => {
                  setIsMemberPageOpen(false);
                  setIsTransferDialogOpen(true);
                }}>
                  <Send className="w-4 h-4 mr-2" />
                  {isRTL ? "تحويل" : "Transfer"}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
