import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyAccounts } from "@/hooks/useFamilyAccounts";
import { FamilyMemberCard } from "@/components/family/FamilyMemberCard";
import { TransactionHistory } from "@/components/family/TransactionHistory";
import { 
  Users, 
  UserPlus, 
  Link2, 
  ArrowRightLeft, 
  Gift, 
  Shield, 
  CheckCircle2, 
  DollarSign,
  Percent,
  Heart,
  Wallet,
  FileText,
  Clock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  BadgeCheck,
  Building,
  History,
  User,
  Mail,
  CreditCard,
  ArrowUpRight,
  Calendar,
  Pencil,
  Plus,
  X
} from "lucide-react";
import { toast } from "sonner";

interface DemoFamilyMember {
  id: string;
  name: string;
  email: string;
  relationship: string;
  status: "active" | "pending" | "invited";
  linkedAt: string;
  allocatedReturns: number;
  totalTransferred: number;
}

const FamilyInvestment = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDemoMember, setSelectedDemoMember] = useState<DemoFamilyMember | null>(null);
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [isAddingBankAccount, setIsAddingBankAccount] = useState(false);
  const [editMemberData, setEditMemberData] = useState({
    name: "",
    email: "",
    relationship: "",
    allocatedReturns: 0
  });
  const [newBankAccount, setNewBankAccount] = useState({
    country: "",
    bank_name: "",
    account_number: "",
    iban: "",
    account_holder_name: "",
    currency: "AED"
  });
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    relationship: ""
  });

  // Real data from hook
  const {
    familyAccounts,
    bankAccounts,
    transferSchedules,
    transactions,
    isLoading,
    createFamilyAccount,
    updateAllocation,
    addBankAccount,
    createTransferSchedule,
    initiateTransfer,
    updateAccessLevel,
    withdrawAccrual,
    isCreating,
    isAddingBank,
    isCreatingSchedule,
    isTransferring,
    isWithdrawingAccrual,
  } = useFamilyAccounts();

  // Allocation drafts (per member) + the Transfers-tab form (Wave A: record-only).
  const [allocDraft, setAllocDraft] = useState<Record<string, number>>({});
  const [transferForm, setTransferForm] = useState({ recipient: "", type: "returns", amount: "" });

  // Demo data for non-authenticated users
  const [demoFamilyMembers] = useState<DemoFamilyMember[]>([
    {
      id: "1",
      name: isRTL ? "أحمد محمد" : "Ahmed Mohamed",
      email: "ahmed@example.com",
      relationship: isRTL ? "ابن" : "Son",
      status: "active",
      linkedAt: "2024-01-15",
      allocatedReturns: 25,
      totalTransferred: 5000,
    },
    {
      id: "2",
      name: isRTL ? "فاطمة محمد" : "Fatima Mohamed",
      email: "fatima@example.com",
      relationship: isRTL ? "ابنة" : "Daughter",
      status: "active",
      linkedAt: "2024-02-20",
      allocatedReturns: 25,
      totalTransferred: 3500,
    },
    {
      id: "3",
      name: isRTL ? "سارة أحمد" : "Sara Ahmed",
      email: "sara@example.com",
      relationship: isRTL ? "زوجة" : "Spouse",
      status: "pending",
      linkedAt: "2024-03-01",
      allocatedReturns: 50,
      totalTransferred: 0,
    },
  ]);

  // Demo bank accounts data
  const [demoBankAccounts] = useState([
    {
      id: "bank-1",
      family_account_id: "1",
      bank_name: isRTL ? "بنك الإمارات دبي الوطني" : "Emirates NBD",
      account_number_masked: "****1234",
      iban_masked: "AE****1234",
      account_holder_name: isRTL ? "أحمد محمد" : "Ahmed Mohamed",
      currency: "AED",
      is_verified: true,
      is_primary: true,
    },
    {
      id: "bank-2",
      family_account_id: "2",
      bank_name: isRTL ? "بنك أبوظبي الأول" : "First Abu Dhabi Bank",
      account_number_masked: "****5678",
      iban_masked: "AE****5678",
      account_holder_name: isRTL ? "فاطمة محمد" : "Fatima Mohamed",
      currency: "USD",
      is_verified: true,
      is_primary: true,
    },
    {
      id: "bank-3",
      family_account_id: "3",
      bank_name: isRTL ? "بنك دبي الإسلامي" : "Dubai Islamic Bank",
      account_number_masked: "****9012",
      iban_masked: "AE****9012",
      account_holder_name: isRTL ? "سارة أحمد" : "Sara Ahmed",
      currency: "AED",
      is_verified: false,
      is_primary: true,
    },
  ]);

  // Demo transfer schedules data
  const [demoTransferSchedules] = useState([
    {
      id: "schedule-1",
      family_account_id: "1",
      bank_account_id: "bank-1",
      schedule_type: isRTL ? "شهري" : "monthly",
      threshold_amount: 1000,
      is_active: true,
      next_transfer_date: "2026-02-15",
    },
    {
      id: "schedule-2",
      family_account_id: "2",
      bank_account_id: "bank-2",
      schedule_type: isRTL ? "أسبوعي" : "weekly",
      threshold_amount: 500,
      is_active: true,
      next_transfer_date: "2026-02-07",
    },
  ]);

  const features = [
    {
      icon: ArrowRightLeft,
      title: isRTL ? "تحويلات مجانية" : "Zero Transfer Fees",
      description: isRTL 
        ? "انقل الاستثمارات أو العوائد لأفراد عائلتك بدون أي رسوم تحويل"
        : "Transfer investments or returns to family members with zero transfer fees",
      highlight: isRTL ? "0٪ رسوم" : "0% Fees",
    },
    {
      icon: Building,
      title: isRTL ? "تكامل بنكي" : "Bank Integration",
      description: isRTL
        ? "ربط الحسابات البنكية لتحويل العوائد تلقائياً"
        : "Link bank accounts for automatic returns transfers",
      highlight: isRTL ? "تلقائي" : "Automatic",
    },
    {
      icon: Link2,
      title: isRTL ? "ربط الحسابات" : "Account Linking",
      description: isRTL
        ? "اربط حساباتك العائلية بسهولة لإدارة الاستثمارات بشكل موحد"
        : "Easily link family accounts for unified investment management",
      highlight: isRTL ? "سهل" : "Easy",
    },
    {
      icon: Shield,
      title: isRTL ? "أمان كامل" : "Full Security",
      description: isRTL
        ? "تُسجَّل جميع العمليات بسجل نشاط شفاف، وتُخزَّن بيانات البنوك بشكل مُقنّع (آخر 4 أرقام فقط)"
        : "Every action is logged in a transparent activity history; bank details are stored masked (last-4 only)",
      highlight: isRTL ? "آمن" : "Secure",
    },
  ];

  const benefits = [
    {
      icon: Percent,
      value: "0%",
      label: isRTL ? "رسوم التحويل" : "Transfer Fees",
    },
    {
      icon: Users,
      value: isRTL ? "غير محدود" : "Unlimited",
      label: isRTL ? "أفراد العائلة" : "Family Members",
    },
    {
      icon: Clock,
      value: isRTL ? "فوري" : "Instant",
      label: isRTL ? "وقت التحويل" : "Transfer Time",
    },
    {
      icon: Shield,
      value: "100%",
      label: isRTL ? "مؤمن" : "Secured",
    },
  ];

  const handleAddMember = async () => {
    if (!newMember.name || !newMember.email || !newMember.relationship) {
      toast.error(isRTL ? "يرجى ملء جميع الحقول" : "Please fill all fields");
      return;
    }

    if (user) {
      try {
        await createFamilyAccount({
          member_name: newMember.name,
          member_email: newMember.email,
          relationship: newMember.relationship,
        });
        toast.success(
          isRTL 
            ? `تم إضافة ${newMember.name} بنجاح` 
            : `${newMember.name} added successfully`
        );
      } catch {
        toast.error(isRTL ? "حدث خطأ" : "An error occurred");
      }
    } else {
      toast.success(
        isRTL 
          ? `تم إرسال دعوة إلى ${newMember.name}` 
          : `Invitation sent to ${newMember.name}`
      );
    }
    setNewMember({ name: "", email: "", relationship: "" });
    setIsAddDialogOpen(false);
  };

  const handleAllocateReturns = () => {
    toast.success(isRTL ? "تم تحديث تخصيص العوائد" : "Returns allocation updated");
  };

  // Persist a member's allocation % to Django (≤100% enforced server-side). Demo members
  // (unauthenticated) keep the toast-only path.
  const saveAllocation = async (member: any) => {
    const isReal = "allocated_returns_percent" in member;
    const pct = allocDraft[member.id] ?? (isReal ? member.allocated_returns_percent : member.allocatedReturns);
    if (isReal && user) {
      try {
        await updateAllocation({ accountId: member.id, percent: Number(pct) });
        toast.success(isRTL ? "تم تحديث تخصيص العوائد" : "Returns allocation updated");
      } catch (e: any) {
        toast.error(e?.message || (isRTL ? "تعذّر تحديث التخصيص (الحد 100%)" : "Could not update allocation (100% cap)"));
      }
    } else {
      handleAllocateReturns();
    }
  };

  // Wave A: a transfer RECORDS an intent only (no money moves yet). Wired to Django for real
  // members; demo path stays a toast.
  const handleRecordTransfer = async () => {
    const amt = parseFloat(transferForm.amount);
    if (!transferForm.recipient || !amt || amt <= 0) {
      toast.error(isRTL ? "اختر المستلم وأدخل مبلغاً" : "Pick a recipient and enter an amount");
      return;
    }
    const isReal = user && familyAccounts.some((m) => m.id === transferForm.recipient);
    if (isReal) {
      try {
        await initiateTransfer({
          family_account_id: transferForm.recipient,
          amount: amt,
          transfer_type: transferForm.type,
        } as any);
        setTransferForm({ recipient: "", type: "returns", amount: "" });
      } catch (e: any) {
        toast.error(e?.message || (isRTL ? "تعذّر تسجيل التحويل" : "Could not record the transfer"));
      }
    } else {
      toast.success(isRTL ? "تم تسجيل التحويل (سيُنفَّذ لاحقاً)" : "Transfer recorded (executed in a later release)");
    }
  };

  const handleTransfer = () => {
    toast.success(isRTL ? "تم بدء التحويل بنجاح" : "Transfer initiated successfully");
  };

  const handleEditMember = () => {
    if (selectedDemoMember) {
      setEditMemberData({
        name: selectedDemoMember.name,
        email: selectedDemoMember.email,
        relationship: selectedDemoMember.relationship,
        allocatedReturns: selectedDemoMember.allocatedReturns
      });
      setIsEditingMember(true);
    }
  };

  const handleSaveMemberEdit = () => {
    toast.success(isRTL ? "تم تحديث بيانات العضو بنجاح" : "Member details updated successfully");
    setIsEditingMember(false);
  };

  const handleAddBankAccount = () => {
    if (!newBankAccount.country || !newBankAccount.bank_name || !newBankAccount.account_number || !newBankAccount.account_holder_name) {
      toast.error(isRTL ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    toast.success(isRTL ? "تم إضافة الحساب البنكي بنجاح" : "Bank account added successfully");
    setNewBankAccount({
      country: "",
      bank_name: "",
      account_number: "",
      iban: "",
      account_holder_name: "",
      currency: "AED"
    });
    setIsAddingBankAccount(false);
  };

  // Decide which data to show
  const showRealData = user && familyAccounts.length > 0;

  return (
    <MainLayout>
      <div className="container py-8">
        {/* Hero Section */}
        <div className="relative mb-12 p-8 rounded-3xl bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/20 to-pink-500/20 blur-3xl rounded-full" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-orange-500/20 to-yellow-500/20 blur-3xl rounded-full" />
          
          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {isRTL ? "ميزة محسنة" : "Enhanced Feature"}
                </Badge>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
                {isRTL ? "الاستثمار العائلي" : "Family Investment"}
              </h1>
              <p className="text-lg text-muted-foreground mb-6 max-w-xl">
                {isRTL
                  ? "استثمر لأفراد عائلتك، خصص العوائد، واربط الحسابات البنكية للتحويلات التلقائية. إدارة شاملة مع سجل كامل للمعاملات."
                  : "Invest for your family, allocate returns, and link bank accounts for automatic transfers. Complete management with full transaction history."}
              </p>
              
              <div className="flex flex-wrap gap-4">
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="gap-2">
                      <UserPlus className="w-5 h-5" />
                      {isRTL ? "إضافة فرد من العائلة" : "Add Family Member"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {isRTL ? "إضافة فرد من العائلة" : "Add Family Member"}
                      </DialogTitle>
                      <DialogDescription>
                        {isRTL
                          ? "أضف فرداً من عائلتك لربط حسابه وتخصيص العوائد"
                          : "Add a family member to link their account and allocate returns"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>{isRTL ? "الاسم الكامل" : "Full Name"}</Label>
                        <Input
                          value={newMember.name}
                          onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                          placeholder={isRTL ? "أدخل الاسم" : "Enter name"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{isRTL ? "البريد الإلكتروني" : "Email"}</Label>
                        <Input
                          type="email"
                          value={newMember.email}
                          onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                          placeholder={isRTL ? "أدخل البريد الإلكتروني" : "Enter email"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{isRTL ? "صلة القرابة" : "Relationship"}</Label>
                        <Select
                          value={newMember.relationship}
                          onValueChange={(value) => setNewMember({ ...newMember, relationship: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={isRTL ? "اختر صلة القرابة" : "Select relationship"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="spouse">{isRTL ? "زوج/زوجة" : "Spouse"}</SelectItem>
                            <SelectItem value="son">{isRTL ? "ابن" : "Son"}</SelectItem>
                            <SelectItem value="daughter">{isRTL ? "ابنة" : "Daughter"}</SelectItem>
                            <SelectItem value="parent">{isRTL ? "أب/أم" : "Parent"}</SelectItem>
                            <SelectItem value="sibling">{isRTL ? "أخ/أخت" : "Sibling"}</SelectItem>
                            <SelectItem value="other">{isRTL ? "أخرى" : "Other"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        {isRTL ? "إلغاء" : "Cancel"}
                      </Button>
                      <Button onClick={handleAddMember} disabled={isCreating}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        {isCreating 
                          ? (isRTL ? "جاري الإضافة..." : "Adding...")
                          : (isRTL ? "إضافة" : "Add Member")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                <Button variant="outline" size="lg" className="gap-2">
                  <FileText className="w-5 h-5" />
                  {isRTL ? "دليل الاستخدام" : "User Guide"}
                </Button>
              </div>
            </div>
            
            {/* Benefits Stats */}
            <div className="grid grid-cols-2 gap-4">
              {benefits.map((benefit, index) => {
                const IconComponent = benefit.icon;
                return (
                  <Card key={index} className="bg-card/50 backdrop-blur border-border/50">
                    <CardContent className="p-4 text-center">
                      <IconComponent className="w-6 h-6 text-primary mx-auto mb-2" />
                      <div className="text-2xl font-bold text-foreground">{benefit.value}</div>
                      <div className="text-xs text-muted-foreground">{benefit.label}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <IconComponent className="w-6 h-6 text-purple-600" />
                    </div>
                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                      {feature.highlight}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="members" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-5">
            <TabsTrigger value="members" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? "الأعضاء" : "Members"}</span>
            </TabsTrigger>
            <TabsTrigger value="banking" className="gap-2">
              <Building className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? "البنوك" : "Banking"}</span>
            </TabsTrigger>
            <TabsTrigger value="allocations" className="gap-2">
              <Gift className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? "التخصيصات" : "Allocations"}</span>
            </TabsTrigger>
            <TabsTrigger value="transfers" className="gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? "التحويلات" : "Transfers"}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? "السجل" : "History"}</span>
            </TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Clock className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : showRealData ? (
              <div className="grid gap-4">
                {familyAccounts.map((member) => (
                  <FamilyMemberCard
                    key={member.id}
                    member={member}
                    bankAccounts={bankAccounts}
                    transferSchedules={transferSchedules}
                    onAddBankAccount={addBankAccount}
                    onCreateSchedule={createTransferSchedule}
                    onInitiateTransfer={initiateTransfer}
                    onUpdateAccessLevel={updateAccessLevel}
                    onWithdrawAccrual={withdrawAccrual}
                    isAddingBank={isAddingBank}
                    isCreatingSchedule={isCreatingSchedule}
                    isWithdrawingAccrual={isWithdrawingAccrual}
                  />
                ))}
              </div>
            ) : (
              // Demo data view
              <div className="grid gap-4">
                {demoFamilyMembers.map((member) => (
                  <Card key={member.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <span className="text-xl font-bold text-white">
                              {member.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-foreground">{member.name}</h3>
                              {member.status === "active" && (
                                <BadgeCheck className="w-5 h-5 text-green-500" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                            <div className="flex items-center gap-2 mt-1">
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
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                          <div className="flex gap-6">
                            <div className="text-center">
                              <div className="text-lg font-bold text-foreground">{member.allocatedReturns}%</div>
                              <div className="text-xs text-muted-foreground">
                                {isRTL ? "العوائد المخصصة" : "Allocated Returns"}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-green-600">${member.totalTransferred.toLocaleString()}</div>
                              <div className="text-xs text-muted-foreground">
                                {isRTL ? "إجمالي المحول" : "Total Transferred"}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedDemoMember(member)}
                            >
                              <User className="w-4 h-4 mr-1" />
                              {isRTL ? "صفحة العضو" : "Member Page"}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleAllocateReturns()}
                            >
                              <Percent className="w-4 h-4 mr-1" />
                              {isRTL ? "تخصيص" : "Allocate"}
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => handleTransfer()}
                              disabled={member.status !== "active"}
                            >
                              <ArrowRightLeft className="w-4 h-4 mr-1" />
                              {isRTL ? "تحويل" : "Transfer"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Banking Tab - NEW */}
          <TabsContent value="banking" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-purple-600" />
                  {isRTL ? "الحسابات البنكية المرتبطة" : "Linked Bank Accounts"}
                </CardTitle>
                <CardDescription>
                  {isRTL
                    ? "إدارة الحسابات البنكية لأفراد العائلة لتحويل العوائد تلقائياً"
                    : "Manage bank accounts for family members to receive automatic transfers"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const displayBankAccounts = user && bankAccounts.length > 0 ? bankAccounts : demoBankAccounts;
                  const displayFamilyMembers = user && familyAccounts.length > 0 ? familyAccounts : demoFamilyMembers;
                  
                  return (
                    <div className="space-y-4">
                      {displayBankAccounts.map((bank) => {
                        const familyMember = displayFamilyMembers.find(fa => fa.id === bank.family_account_id);
                        const memberName = familyMember ? ('member_name' in familyMember ? familyMember.member_name : familyMember.name) : bank.account_holder_name;
                        return (
                          <div key={bank.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Building className="w-6 h-6 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{bank.bank_name}</p>
                                <p className="text-sm text-muted-foreground">{bank.account_number_masked}</p>
                                {bank.iban_masked && (
                                  <p className="text-xs text-muted-foreground">IBAN: {bank.iban_masked}</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {memberName}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">{bank.currency}</Badge>
                              {bank.is_verified ? (
                                <Badge className="bg-green-500/20 text-green-600">
                                  <Shield className="w-3 h-3 mr-1" />
                                  {isRTL ? "موثق" : "Verified"}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  {isRTL ? "قيد التحقق" : "Pending"}
                                </Badge>
                              )}
                              {bank.is_primary && (
                                <Badge className="bg-primary/20 text-primary">
                                  {isRTL ? "أساسي" : "Primary"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Add Bank Account Button */}
                      <Button variant="outline" className="w-full mt-4" onClick={() => toast.info(isRTL ? "افتح صفحة العضو لإضافة حساب بنكي" : "Open member page to add bank account")}>
                        <Building className="w-4 h-4 mr-2" />
                        {isRTL ? "إضافة حساب بنكي جديد" : "Add New Bank Account"}
                      </Button>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Transfer Schedules */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  {isRTL ? "جداول التحويل التلقائي" : "Auto Transfer Schedules"}
                </CardTitle>
                <CardDescription>
                  {isRTL
                    ? "إعداد تحويلات تلقائية للعوائد بناءً على الجدول الزمني أو الحد الأدنى للرصيد"
                    : "Set up automatic returns transfers based on schedule or balance threshold"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const displaySchedules = user && transferSchedules.length > 0 ? transferSchedules : demoTransferSchedules;
                  const displayFamilyMembers = user && familyAccounts.length > 0 ? familyAccounts : demoFamilyMembers;
                  const displayBankAccounts = user && bankAccounts.length > 0 ? bankAccounts : demoBankAccounts;
                  
                  return (
                    <div className="space-y-4">
                      {displaySchedules.map((schedule) => {
                        const familyMember = displayFamilyMembers.find(fa => fa.id === schedule.family_account_id);
                        const bank = displayBankAccounts.find(ba => ba.id === schedule.bank_account_id);
                        const memberName = familyMember ? ('member_name' in familyMember ? familyMember.member_name : familyMember.name) : '';
                        
                        return (
                          <div key={schedule.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <Clock className="w-6 h-6 text-purple-600" />
                              </div>
                              <div>
                                <p className="font-medium">{memberName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {bank?.bank_name} - {bank?.account_number_masked}
                                </p>
                                {schedule.next_transfer_date && (
                                  <p className="text-xs text-muted-foreground">
                                    {isRTL ? "التحويل القادم:" : "Next transfer:"} {schedule.next_transfer_date}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="capitalize">
                                {schedule.schedule_type}
                              </Badge>
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
                                <Badge variant="secondary">
                                  {isRTL ? "موقوف" : "Paused"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Add Schedule Button */}
                      <Button variant="outline" className="w-full mt-4" onClick={() => toast.info(isRTL ? "افتح صفحة العضو لإعداد جدول تحويل" : "Open member page to set up transfer schedule")}>
                        <Clock className="w-4 h-4 mr-2" />
                        {isRTL ? "إضافة جدول تحويل جديد" : "Add New Transfer Schedule"}
                      </Button>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Banking Info Card */}
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Shield className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {isRTL ? "معلومات أمان البنوك" : "Bank Security Information"}
                    </h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        {isRTL ? "نحتفظ فقط بآخر 4 أرقام من أرقام الحسابات" : "We only store the last 4 digits of account numbers"}
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        {isRTL ? "جميع التحويلات مشفرة ومحمية" : "All transfers are encrypted and secure"}
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        {isRTL ? "التحقق من الحساب قبل أول تحويل" : "Account verification before first transfer"}
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Allocations Tab */}
          <TabsContent value="allocations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-purple-600" />
                  {isRTL ? "تخصيص العوائد التلقائي" : "Automatic Returns Allocation"}
                </CardTitle>
                <CardDescription>
                  {isRTL
                    ? "حدد نسبة العوائد التي تريد تخصيصها لكل فرد من أفراد عائلتك"
                    : "Set the percentage of returns you want to allocate to each family member"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(showRealData ? familyAccounts.filter(m => m.status === "active") : demoFamilyMembers.filter(m => m.status === "active")).map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <span className="text-sm font-bold text-white">
                          {('member_name' in member ? member.member_name : member.name).charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {'member_name' in member ? member.member_name : member.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{member.relationship}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32">
                        <Select
                          defaultValue={('allocated_returns_percent' in member ? member.allocated_returns_percent : member.allocatedReturns).toString()}
                          onValueChange={(v) => setAllocDraft((d) => ({ ...d, [member.id]: Number(v) }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="10">10%</SelectItem>
                            <SelectItem value="25">25%</SelectItem>
                            <SelectItem value="50">50%</SelectItem>
                            <SelectItem value="75">75%</SelectItem>
                            <SelectItem value="100">100%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" onClick={() => saveAllocation(member)}>
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-foreground">
                      {isRTL ? "المتبقي لك" : "Remaining for You"}
                    </span>
                  </div>
                  <span className="text-xl font-bold text-green-600">50%</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transfers Tab */}
          <TabsContent value="transfers" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-purple-600" />
                    {isRTL ? "تحويل جديد" : "New Transfer"}
                  </CardTitle>
                  <CardDescription>
                    {isRTL
                      ? "انقل استثماراً أو مبلغاً لأحد أفراد عائلتك"
                      : "Transfer an investment or amount to a family member"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? "المستلم" : "Recipient"}</Label>
                    <Select
                      value={transferForm.recipient}
                      onValueChange={(v) => setTransferForm((f) => ({ ...f, recipient: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isRTL ? "اختر فرد العائلة" : "Select family member"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(showRealData ? familyAccounts.filter(m => m.status === "active") : demoFamilyMembers.filter(m => m.status === "active")).map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {'member_name' in member ? member.member_name : member.name} ({member.relationship})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "نوع التحويل" : "Transfer Type"}</Label>
                    <Select
                      value={transferForm.type}
                      onValueChange={(v) => setTransferForm((f) => ({ ...f, type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="returns">{isRTL ? "عوائد" : "Returns"}</SelectItem>
                        <SelectItem value="tokens">{isRTL ? "رموز ملكية" : "Ownership Tokens"}</SelectItem>
                        <SelectItem value="balance">{isRTL ? "رصيد المحفظة" : "Wallet Balance"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "المبلغ" : "Amount"}</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={transferForm.amount}
                      onChange={(e) => setTransferForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>

                  {/* Wave A: a transfer is RECORDED only — execution (real money/token movement)
                      is a later release. Honest, not a faked "instant free transfer". */}
                  <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <p className="text-xs text-amber-700">
                      {isRTL
                        ? "سيتم تسجيل التحويل في السجل الآن — التنفيذ الفعلي (نقل الأموال/الرموز) يأتي في إصدار لاحق."
                        : "The transfer will be recorded now — actual execution (moving money/tokens) comes in a later release."}
                    </p>
                  </div>

                  <Button className="w-full" size="lg" onClick={handleRecordTransfer} disabled={isTransferring}>
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    {isTransferring
                      ? (isRTL ? "جاري التسجيل..." : "Recording...")
                      : (isRTL ? "تسجيل التحويل" : "Record Transfer")}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-600" />
                    {isRTL ? "سجل التحويلات الأخيرة" : "Recent Transfer History"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // REAL records (replaces the old hardcoded array): the caller's recorded
                    // transfer intents. Wave A → status is "pending" (recorded, not executed).
                    const transferRows = (transactions || []).filter((t) =>
                      t.transaction_type.startsWith("transfer"),
                    );
                    if (transferRows.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          {isRTL ? "لا توجد تحويلات مسجّلة بعد" : "No transfers recorded yet"}
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-4">
                        {transferRows.map((tx) => {
                          const member = familyAccounts.find((m) => m.id === tx.family_account_id);
                          return (
                            <div key={tx.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                  <ArrowRight className="w-4 h-4 text-purple-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {member ? member.member_name : (tx.description || "—")}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(tx.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-foreground">
                                  ${(tx.amount ?? 0).toLocaleString()}
                                </p>
                                <Badge variant="secondary" className="text-xs">
                                  {isRTL ? "مسجّل" : "Recorded"}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab - NEW */}
          <TabsContent value="history" className="space-y-6">
            <TransactionHistory transactions={transactions} isLoading={isLoading} />
          </TabsContent>
        </Tabs>

        {/* Info Banner */}
        <Card className="mt-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1 text-center md:text-start">
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {isRTL ? "الأمان والخصوصية" : "Security & Privacy"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isRTL
                    ? "تُسجَّل جميع عمليات العائلة في سجل نشاط شفاف، ويُخزَّن فقط آخر 4 أرقام من المعلومات البنكية. (تنفيذ التحويلات الفعلي يأتي في إصدار لاحق.)"
                    : "All family actions are recorded in a transparent activity log, and only the last 4 digits of bank information are stored. (Actual transfer execution comes in a later release.)"}
                </p>
              </div>
              <Button variant="outline" className="shrink-0">
                {isRTL ? "معرفة المزيد" : "Learn More"}
                <ArrowIcon className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Demo Member Page Dialog */}
        <Dialog open={!!selectedDemoMember} onOpenChange={(open) => {
          if (!open) {
            setSelectedDemoMember(null);
            setIsEditingMember(false);
            setIsAddingBankAccount(false);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedDemoMember && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <span className="text-lg font-bold text-white">
                          {selectedDemoMember.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <span className="flex items-center gap-2">
                          {selectedDemoMember.name}
                          {selectedDemoMember.status === "active" && (
                            <BadgeCheck className="w-5 h-5 text-green-500" />
                          )}
                        </span>
                        <p className="text-sm font-normal text-muted-foreground">{selectedDemoMember.email}</p>
                      </div>
                    </div>
                    {!isEditingMember && !isAddingBankAccount && (
                      <Button variant="outline" size="sm" onClick={handleEditMember}>
                        <Pencil className="w-4 h-4 mr-1" />
                        {isRTL ? "تعديل" : "Edit"}
                      </Button>
                    )}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Edit Member Form */}
                  {isEditingMember ? (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Pencil className="w-4 h-4 text-primary" />
                          {isRTL ? "تعديل بيانات العضو" : "Edit Member Details"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>{isRTL ? "الاسم الكامل" : "Full Name"}</Label>
                          <Input
                            value={editMemberData.name}
                            onChange={(e) => setEditMemberData({ ...editMemberData, name: e.target.value })}
                            placeholder={isRTL ? "أدخل الاسم" : "Enter name"}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{isRTL ? "البريد الإلكتروني" : "Email"}</Label>
                          <Input
                            type="email"
                            value={editMemberData.email}
                            onChange={(e) => setEditMemberData({ ...editMemberData, email: e.target.value })}
                            placeholder={isRTL ? "أدخل البريد الإلكتروني" : "Enter email"}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{isRTL ? "صلة القرابة" : "Relationship"}</Label>
                          <Select
                            value={editMemberData.relationship.toLowerCase()}
                            onValueChange={(value) => setEditMemberData({ ...editMemberData, relationship: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={isRTL ? "اختر صلة القرابة" : "Select relationship"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="spouse">{isRTL ? "زوج/زوجة" : "Spouse"}</SelectItem>
                              <SelectItem value="son">{isRTL ? "ابن" : "Son"}</SelectItem>
                              <SelectItem value="daughter">{isRTL ? "ابنة" : "Daughter"}</SelectItem>
                              <SelectItem value="parent">{isRTL ? "أب/أم" : "Parent"}</SelectItem>
                              <SelectItem value="sibling">{isRTL ? "أخ/أخت" : "Sibling"}</SelectItem>
                              <SelectItem value="other">{isRTL ? "أخرى" : "Other"}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{isRTL ? "نسبة العوائد المخصصة" : "Allocated Returns (%)"}</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={editMemberData.allocatedReturns}
                            onChange={(e) => setEditMemberData({ ...editMemberData, allocatedReturns: Number(e.target.value) })}
                            placeholder="0-100"
                          />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" onClick={() => setIsEditingMember(false)} className="flex-1">
                            <X className="w-4 h-4 mr-1" />
                            {isRTL ? "إلغاء" : "Cancel"}
                          </Button>
                          <Button onClick={handleSaveMemberEdit} className="flex-1">
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            {isRTL ? "حفظ التغييرات" : "Save Changes"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
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
                                <p className="font-medium">{selectedDemoMember.name}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <p className="text-xs text-muted-foreground">{isRTL ? "البريد الإلكتروني" : "Email"}</p>
                                <p className="font-medium text-sm">{selectedDemoMember.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                              <Heart className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <p className="text-xs text-muted-foreground">{isRTL ? "صلة القرابة" : "Relationship"}</p>
                                <p className="font-medium">{selectedDemoMember.relationship}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <p className="text-xs text-muted-foreground">{isRTL ? "تاريخ الربط" : "Linked Date"}</p>
                                <p className="font-medium">{selectedDemoMember.linkedAt}</p>
                              </div>
                            </div>
                          </div>
                          
                          <Separator />
                          
                          <div className="flex items-center gap-2">
                            <Badge 
                              className={
                                selectedDemoMember.status === "active" 
                                  ? "bg-green-500/20 text-green-600 border-green-500/30"
                                  : "bg-yellow-500/20 text-yellow-600 border-yellow-500/30"
                              }
                            >
                              {selectedDemoMember.status === "active" ? (isRTL ? "نشط" : "Active") : (isRTL ? "معلق" : "Pending")}
                            </Badge>
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
                              <p className="text-2xl font-bold text-foreground">{selectedDemoMember.allocatedReturns}%</p>
                              <p className="text-xs text-muted-foreground">{isRTL ? "العوائد المخصصة" : "Allocated Returns"}</p>
                            </div>
                            <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20 text-center">
                              <ArrowUpRight className="w-6 h-6 text-green-600 mx-auto mb-2" />
                              <p className="text-2xl font-bold text-green-600">${selectedDemoMember.totalTransferred.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{isRTL ? "إجمالي المحول" : "Total Transferred"}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Bank Accounts */}
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Building className="w-4 h-4 text-primary" />
                              {isRTL ? "الحسابات البنكية" : "Bank Accounts"}
                            </CardTitle>
                            <Button variant="outline" size="sm" onClick={() => setIsAddingBankAccount(true)}>
                              <Plus className="w-4 h-4 mr-1" />
                              {isRTL ? "إضافة" : "Add"}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {isAddingBankAccount ? (
                            <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
                              <h4 className="font-medium text-sm">{isRTL ? "إضافة حساب بنكي جديد" : "Add New Bank Account"}</h4>
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>{isRTL ? "الدولة" : "Country"} *</Label>
                                    <Select
                                      value={newBankAccount.country}
                                      onValueChange={(value) => setNewBankAccount({ ...newBankAccount, country: value })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder={isRTL ? "اختر الدولة" : "Select country"} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="UAE">{isRTL ? "الإمارات العربية المتحدة" : "United Arab Emirates"}</SelectItem>
                                        <SelectItem value="SA">{isRTL ? "المملكة العربية السعودية" : "Saudi Arabia"}</SelectItem>
                                        <SelectItem value="QA">{isRTL ? "قطر" : "Qatar"}</SelectItem>
                                        <SelectItem value="KW">{isRTL ? "الكويت" : "Kuwait"}</SelectItem>
                                        <SelectItem value="BH">{isRTL ? "البحرين" : "Bahrain"}</SelectItem>
                                        <SelectItem value="OM">{isRTL ? "عُمان" : "Oman"}</SelectItem>
                                        <SelectItem value="EG">{isRTL ? "مصر" : "Egypt"}</SelectItem>
                                        <SelectItem value="JO">{isRTL ? "الأردن" : "Jordan"}</SelectItem>
                                        <SelectItem value="LB">{isRTL ? "لبنان" : "Lebanon"}</SelectItem>
                                        <SelectItem value="US">{isRTL ? "الولايات المتحدة" : "United States"}</SelectItem>
                                        <SelectItem value="UK">{isRTL ? "المملكة المتحدة" : "United Kingdom"}</SelectItem>
                                        <SelectItem value="DE">{isRTL ? "ألمانيا" : "Germany"}</SelectItem>
                                        <SelectItem value="FR">{isRTL ? "فرنسا" : "France"}</SelectItem>
                                        <SelectItem value="IN">{isRTL ? "الهند" : "India"}</SelectItem>
                                        <SelectItem value="PK">{isRTL ? "باكستان" : "Pakistan"}</SelectItem>
                                        <SelectItem value="PH">{isRTL ? "الفلبين" : "Philippines"}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{isRTL ? "اسم البنك" : "Bank Name"} *</Label>
                                    <Input
                                      value={newBankAccount.bank_name}
                                      onChange={(e) => setNewBankAccount({ ...newBankAccount, bank_name: e.target.value })}
                                      placeholder={isRTL ? "أدخل اسم البنك" : "Enter bank name"}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>{isRTL ? "اسم صاحب الحساب" : "Account Holder Name"} *</Label>
                                  <Input
                                    value={newBankAccount.account_holder_name}
                                    onChange={(e) => setNewBankAccount({ ...newBankAccount, account_holder_name: e.target.value })}
                                    placeholder={isRTL ? "أدخل اسم صاحب الحساب" : "Enter account holder name"}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>{isRTL ? "رقم الحساب" : "Account Number"} *</Label>
                                    <Input
                                      value={newBankAccount.account_number}
                                      onChange={(e) => setNewBankAccount({ ...newBankAccount, account_number: e.target.value })}
                                      placeholder={isRTL ? "أدخل رقم الحساب" : "Enter account number"}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{isRTL ? "رقم IBAN" : "IBAN"}</Label>
                                    <Input
                                      value={newBankAccount.iban}
                                      onChange={(e) => setNewBankAccount({ ...newBankAccount, iban: e.target.value })}
                                      placeholder={isRTL ? "أدخل رقم IBAN" : "Enter IBAN"}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>{isRTL ? "العملة" : "Currency"}</Label>
                                  <Select
                                    value={newBankAccount.currency}
                                    onValueChange={(value) => setNewBankAccount({ ...newBankAccount, currency: value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="AED">{isRTL ? "درهم إماراتي (AED)" : "AED - UAE Dirham"}</SelectItem>
                                      <SelectItem value="USD">{isRTL ? "دولار أمريكي (USD)" : "USD - US Dollar"}</SelectItem>
                                      <SelectItem value="EUR">{isRTL ? "يورو (EUR)" : "EUR - Euro"}</SelectItem>
                                      <SelectItem value="GBP">{isRTL ? "جنيه إسترليني (GBP)" : "GBP - British Pound"}</SelectItem>
                                      <SelectItem value="SAR">{isRTL ? "ريال سعودي (SAR)" : "SAR - Saudi Riyal"}</SelectItem>
                                      <SelectItem value="QAR">{isRTL ? "ريال قطري (QAR)" : "QAR - Qatari Riyal"}</SelectItem>
                                      <SelectItem value="KWD">{isRTL ? "دينار كويتي (KWD)" : "KWD - Kuwaiti Dinar"}</SelectItem>
                                      <SelectItem value="BHD">{isRTL ? "دينار بحريني (BHD)" : "BHD - Bahraini Dinar"}</SelectItem>
                                      <SelectItem value="OMR">{isRTL ? "ريال عُماني (OMR)" : "OMR - Omani Rial"}</SelectItem>
                                      <SelectItem value="EGP">{isRTL ? "جنيه مصري (EGP)" : "EGP - Egyptian Pound"}</SelectItem>
                                      <SelectItem value="JOD">{isRTL ? "دينار أردني (JOD)" : "JOD - Jordanian Dinar"}</SelectItem>
                                      <SelectItem value="LBP">{isRTL ? "ليرة لبنانية (LBP)" : "LBP - Lebanese Pound"}</SelectItem>
                                      <SelectItem value="INR">{isRTL ? "روبية هندية (INR)" : "INR - Indian Rupee"}</SelectItem>
                                      <SelectItem value="PKR">{isRTL ? "روبية باكستانية (PKR)" : "PKR - Pakistani Rupee"}</SelectItem>
                                      <SelectItem value="PHP">{isRTL ? "بيزو فلبيني (PHP)" : "PHP - Philippine Peso"}</SelectItem>
                                      <SelectItem value="CHF">{isRTL ? "فرنك سويسري (CHF)" : "CHF - Swiss Franc"}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="flex gap-2 pt-2">
                                <Button variant="outline" onClick={() => {
                                  setIsAddingBankAccount(false);
                                  setNewBankAccount({
                                    country: "",
                                    bank_name: "",
                                    account_number: "",
                                    iban: "",
                                    account_holder_name: "",
                                    currency: "AED"
                                  });
                                }} className="flex-1">
                                  <X className="w-4 h-4 mr-1" />
                                  {isRTL ? "إلغاء" : "Cancel"}
                                </Button>
                                <Button onClick={handleAddBankAccount} className="flex-1">
                                  <Plus className="w-4 h-4 mr-1" />
                                  {isRTL ? "إضافة الحساب" : "Add Account"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {(() => {
                                const memberBanks = demoBankAccounts.filter(b => b.family_account_id === selectedDemoMember.id);
                                if (memberBanks.length === 0) {
                                  return (
                                    <div className="text-center py-6 text-muted-foreground">
                                      <Building className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                      <p>{isRTL ? "لا توجد حسابات بنكية مرتبطة" : "No bank accounts linked"}</p>
                                      <Button 
                                        variant="link" 
                                        className="mt-2"
                                        onClick={() => setIsAddingBankAccount(true)}
                                      >
                                        <Plus className="w-4 h-4 mr-1" />
                                        {isRTL ? "إضافة حساب بنكي" : "Add bank account"}
                                      </Button>
                                    </div>
                                  );
                                }
                                return (
                                  <div className="space-y-3">
                                    {memberBanks.map((bank) => (
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
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </CardContent>
                      </Card>

                      {/* Transfer Schedules */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            {isRTL ? "جداول التحويل" : "Transfer Schedules"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {(() => {
                            const memberSchedules = demoTransferSchedules.filter(s => s.family_account_id === selectedDemoMember.id);
                            if (memberSchedules.length === 0) {
                              return (
                                <div className="text-center py-6 text-muted-foreground">
                                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                  <p>{isRTL ? "لا توجد جداول تحويل" : "No transfer schedules"}</p>
                                </div>
                              );
                            }
                            return (
                              <div className="space-y-3">
                                {memberSchedules.map((schedule) => {
                                  const bank = demoBankAccounts.find(b => b.id === schedule.bank_account_id);
                                  return (
                                    <div key={schedule.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                          <Clock className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div>
                                          <p className="font-medium capitalize">{schedule.schedule_type}</p>
                                          <p className="text-sm text-muted-foreground">{bank?.bank_name}</p>
                                          {schedule.next_transfer_date && (
                                            <p className="text-xs text-muted-foreground">
                                              {isRTL ? "التحويل القادم:" : "Next:"} {schedule.next_transfer_date}
                                            </p>
                                          )}
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
                            );
                          })()}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => {
                    setSelectedDemoMember(null);
                    setIsEditingMember(false);
                    setIsAddingBankAccount(false);
                  }}>
                    {isRTL ? "إغلاق" : "Close"}
                  </Button>
                  {!isEditingMember && !isAddingBankAccount && (
                    <Button onClick={() => {
                      setSelectedDemoMember(null);
                      handleTransfer();
                    }} disabled={selectedDemoMember.status !== "active"}>
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      {isRTL ? "تحويل" : "Transfer"}
                    </Button>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ───────────── A) Long-term Family Wealth Management ───────────── */}
        <div className="mt-16">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-display">
                {isRTL ? "إدارة الثروة العائلية طويلة الأجل" : "Long-term Family Wealth Management"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isRTL ? "هياكل ملكية مشتركة ومشاركة متعددة الأعضاء" : "Shared ownership structures & multi-member participation"}
              </p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-border/50">
              <CardContent className="p-5">
                <Users className="w-6 h-6 text-primary mb-3" />
                <h3 className="font-semibold mb-1">{isRTL ? "ملكية عائلية مشتركة" : "Shared Family Ownership"}</h3>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? "هيكلة الأصول كملكية جماعية بحصص محددة لكل فرد." : "Structure assets as collective holdings with defined per-member shares."}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-5">
                <UserPlus className="w-6 h-6 text-primary mb-3" />
                <h3 className="font-semibold mb-1">{isRTL ? "مشاركة متعددة الأعضاء" : "Multi-Member Participation"}</h3>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? "اضمّ زوجك، أبناءك وأقاربك في قرارات الاستثمار." : "Include spouse, children & relatives in investment decisions."}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-5">
                <Clock className="w-6 h-6 text-primary mb-3" />
                <h3 className="font-semibold mb-1">{isRTL ? "تخطيط طويل الأجل" : "Long-term Planning"}</h3>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? "خطط ثروة عابرة للأجيال بدورات استثمار 10+ سنوات." : "Multi-generational wealth plans with 10+ year horizons."}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ───────────── B) Inheritance System ───────────── */}
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-display">
                {isRTL ? "نظام الميراث" : "Inheritance System"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isRTL ? "نقل الملكية تلقائياً وفق إعداداتك" : "Automatic ownership transfer per your settings"}
              </p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-5">
                <ArrowRightLeft className="w-6 h-6 text-blue-600 mb-3" />
                <h3 className="font-semibold mb-1">{isRTL ? "نقل ملكية تلقائي" : "Automatic Ownership Transfer"}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {isRTL ? "حدّد المستفيدين وحصصهم — سينفذ النقل تلقائياً عند التفعيل." : "Set beneficiaries & shares — transfer executes automatically when triggered."}
                </p>
                <Button size="sm" variant="outline" onClick={() => toast.success(isRTL ? "تم فتح إعدادات المستفيدين" : "Beneficiaries setup opened")}>
                  {isRTL ? "إعداد المستفيدين" : "Setup Beneficiaries"}
                </Button>
              </CardContent>
            </Card>
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-5">
                <Clock className="w-6 h-6 text-blue-600 mb-3" />
                <h3 className="font-semibold mb-1">{isRTL ? "محفّز عدم النشاط" : "Inactivity Trigger"}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {isRTL ? "بدء عملية التوريث بعد فترة عدم نشاط محددة (مثلاً 12 شهراً)." : "Trigger inheritance process after a defined inactivity period (e.g., 12 months)."}
                </p>
                <Button size="sm" variant="outline" onClick={() => toast.success(isRTL ? "تم ضبط فترة عدم النشاط" : "Inactivity period configured")}>
                  {isRTL ? "ضبط الفترة" : "Configure Period"}
                </Button>
              </CardContent>
            </Card>
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-5">
                <BadgeCheck className="w-6 h-6 text-blue-600 mb-3" />
                <h3 className="font-semibold mb-1">{isRTL ? "وكيل/وصي قانوني" : "Legal Proxy / Agent"}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {isRTL ? "عيّن وكيلاً قانونياً لإدارة الأصول نيابة عنك عند الحاجة." : "Assign a legal proxy to manage assets on your behalf when needed."}
                </p>
                <Button size="sm" variant="outline" onClick={() => toast.success(isRTL ? "تم تعيين الوكيل" : "Proxy assigned")}>
                  {isRTL ? "تعيين الوكيل" : "Assign Proxy"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ───────────── C) Real Estate Gifts ───────────── */}
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-display">
                {isRTL ? "هدايا عقارية" : "Real Estate Gifts"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isRTL ? "جدول هدايا التوكنز/العقارات للمناسبات العائلية" : "Schedule token/property gifts for family events"}
              </p>
            </div>
          </div>
          <Card className="border-pink-500/30 bg-gradient-to-br from-pink-500/5 to-rose-500/5">
            <CardContent className="p-6">
              <div className="grid md:grid-cols-3 gap-4 mb-5">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-card border">
                  <Calendar className="w-5 h-5 text-pink-500" />
                  <div>
                    <div className="font-medium text-sm">{isRTL ? "أعياد الميلاد" : "Birthdays"}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? "هدية سنوية تلقائية" : "Auto annual gift"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-card border">
                  <BadgeCheck className="w-5 h-5 text-pink-500" />
                  <div>
                    <div className="font-medium text-sm">{isRTL ? "التخرج" : "Graduations"}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? "احتفل بالإنجازات" : "Celebrate milestones"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-card border">
                  <Heart className="w-5 h-5 text-pink-500" />
                  <div>
                    <div className="font-medium text-sm">{isRTL ? "المناسبات العائلية" : "Family Events"}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? "زواج، مولود، عيد" : "Wedding, birth, holidays"}</div>
                  </div>
                </div>
              </div>
              <Button onClick={() => toast.success(isRTL ? "تم فتح جدولة الهدية" : "Gift scheduling opened")} className="gap-2">
                <Gift className="w-4 h-4" />
                {isRTL ? "جدولة هدية عقارية جديدة" : "Schedule New Property Gift"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ───────────── D) Family Collaboration Incentives ───────────── */}
        <div className="mt-12 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-display">
                {isRTL ? "حوافز التعاون العائلي" : "Family Collaboration Incentives"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isRTL ? "مكافآت عند الاستثمار المشترك مع عائلتك" : "Rewards for investing together with your family"}
              </p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-5">
                <Users className="w-6 h-6 text-amber-600 mb-3" />
                <h3 className="font-semibold mb-1">{isRTL ? "مكافآت المشاركة" : "Participation Rewards"}</h3>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? "احصل على توكنز إضافية لكل فرد عائلة ينضم ويستثمر." : "Earn bonus tokens for every family member who joins and invests."}
                </p>
                <Badge className="mt-3 bg-amber-500/20 text-amber-700 border-amber-500/30">
                  +5 {isRTL ? "توكن/عضو" : "tokens / member"}
                </Badge>
              </CardContent>
            </Card>
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-5">
                <DollarSign className="w-6 h-6 text-amber-600 mb-3" />
                <h3 className="font-semibold mb-1">{isRTL ? "حوافز الاستثمار المشترك" : "Shared Investment Bonus"}</h3>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? "خصم على رسوم المنصة عند الاستثمار العائلي المشترك." : "Reduced platform fees when your family invests together."}
                </p>
                <Badge className="mt-3 bg-amber-500/20 text-amber-700 border-amber-500/30">
                  -50% {isRTL ? "رسوم" : "fees"}
                </Badge>
              </CardContent>
            </Card>
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-5">
                <Sparkles className="w-6 h-6 text-amber-600 mb-3" />
                <h3 className="font-semibold mb-1">{isRTL ? "نظام الولاء" : "Loyalty System"}</h3>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? "ارفع مستوى عائلتك واحصل على عوائد مضاعفة." : "Level up your family tier for boosted yields & perks."}
                </p>
                <Badge className="mt-3 bg-amber-500/20 text-amber-700 border-amber-500/30">
                  {isRTL ? "ذهبي / بلاتيني" : "Gold / Platinum"}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default FamilyInvestment;
