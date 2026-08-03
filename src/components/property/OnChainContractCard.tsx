import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ExternalLink, ShieldCheck, Boxes, Clock, Link2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Smart Contract & Token Details — driven ONLY by the REAL on-chain deployment the backend
// records after confirmation (tokenMetadata.onChain). When a property's PropertyToken is
// deployed we show its real address + network + a real block-explorer link ("Verified on-chain");
// until then we show an HONEST "deployment in progress" state — never a fabricated address or a
// fake "verified" badge. This is the live-property counterpart to the old demo-only section.

export interface OnChainDeployment {
  address: string;
  network: string;
  networkLabel: string;
  isTestnet: boolean;
  chainId: number | null;
  txHash: string | null;
  deployedAt: string | null;
  explorerUrl: string;
  txExplorerUrl: string | null;
}

interface Props {
  onChain?: OnChainDeployment | null;
  totalSupply?: number;
  tokenPrice?: number | string;
}

function Fact({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="p-3 rounded-xl bg-muted/40 border border-border">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-semibold text-foreground text-sm">{value}</span>
        {badge && <Badge variant="outline" className="text-[10px]">{badge}</Badge>}
      </div>
    </div>
  );
}

export function OnChainContractCard({ onChain, totalSupply, tokenPrice }: Props) {
  const { language, isRTL } = useLanguage();
  const isAr = language === "ar";
  const [copied, setCopied] = useState(false);

  const copy = async (v: string) => {
    await navigator.clipboard.writeText(v);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const header = (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold shrink-0">
        <Boxes className="w-5 h-5 text-primary-foreground" />
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">
          {isAr ? "العقد الذكي وتفاصيل الرمز" : "Smart Contract & Token Details"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isAr ? "التحقّق على السلسلة" : "On-chain verification"}
        </p>
      </div>
    </div>
  );

  // No real deployment yet → honest "pending" (no fabricated address / no fake "verified").
  if (!onChain) {
    return (
      <Card>
        <CardContent className="p-6" dir={isRTL ? "rtl" : "ltr"}>
          <div className="mb-4">{header}</div>
          <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/40">
            <Clock className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                {isAr ? "التوثيق على السلسلة قيد التنفيذ" : "On-chain tokenization in progress"}
              </p>
              <p className="text-muted-foreground">
                {isAr
                  ? "سيتم نشر عقد هذا العقار على السلسلة قريبًا، وسيظهر هنا عنوان العقد الموثّق ورابط المستكشف بمجرد اكتماله."
                  : "This property's token contract is being deployed on-chain. The verified contract address and explorer link will appear here once it's live."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          {header}
          <Badge className="bg-success text-success-foreground gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            {isAr ? "موثّق على السلسلة" : "Verified on-chain"}
          </Badge>
        </div>

        {/* Real contract address */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {isAr ? "عنوان العقد الذكي" : "Smart contract address"}
            </span>
            <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={() => copy(onChain.address)}>
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              {isAr ? "نسخ" : "Copy"}
            </Button>
          </div>
          <p className="font-mono text-xs sm:text-sm break-all text-foreground" dir="ltr">
            {onChain.address}
          </p>
        </div>

        {/* Verifiable facts only */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Fact
            label={isAr ? "الشبكة" : "Network"}
            value={onChain.networkLabel}
            badge={onChain.isTestnet ? (isAr ? "شبكة اختبار" : "Testnet") : undefined}
          />
          {typeof totalSupply === "number" && totalSupply > 0 && (
            <Fact label={isAr ? "إجمالي المعروض" : "Total supply"} value={totalSupply.toLocaleString()} />
          )}
          {tokenPrice != null && (
            <Fact label={isAr ? "سعر الرمز" : "Token price"} value={`$${Number(tokenPrice).toLocaleString()}`} />
          )}
          {onChain.deployedAt && (
            <Fact
              label={isAr ? "تاريخ النشر" : "Deployed"}
              value={new Date(onChain.deployedAt).toISOString().slice(0, 10)}
            />
          )}
        </div>

        {/* Real explorer actions */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <a href={onChain.explorerUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="hero" className="w-full gap-2">
              <ExternalLink className="w-4 h-4" />
              {isAr ? "التحقّق على BSCScan" : "Verify on BSCScan"}
            </Button>
          </a>
          {onChain.txExplorerUrl && (
            <a href={onChain.txExplorerUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full gap-2">
                <Link2 className="w-4 h-4" />
                {isAr ? "معاملة النشر" : "Deployment tx"}
              </Button>
            </a>
          )}
        </div>

        {onChain.isTestnet && (
          <p className="text-xs text-muted-foreground mt-3">
            {isAr
              ? "ملاحظة: العقد منشور حاليًا على شبكة الاختبار (BSC Testnet) خلال مرحلة ما قبل الإطلاق."
              : "Note: the contract is currently deployed on the test network (BSC Testnet) during the pre-launch phase."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
