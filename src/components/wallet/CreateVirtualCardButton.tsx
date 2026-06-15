import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CreditCard, Plus } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CreateCardDialog } from "@/components/wallet/CreateCardDialog";

interface CreateVirtualCardButtonProps {
  roleLabel?: string;
  variant?: "icon" | "full";
}

/** Header CTA that opens the smart family/dependent card issuance flow. */
export function CreateVirtualCardButton({ roleLabel, variant = "full" }: CreateVirtualCardButtonProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);
  const [open, setOpen] = useState(false);

  if (variant === "icon") {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="hero"
                onClick={() => setOpen(true)}
                className="relative shadow-lg"
                aria-label={t("Issue New Card", "إصدار بطاقة جديدة")}
              >
                <CreditCard className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] flex items-center justify-center border-2 border-background">
                  <Plus className="h-2.5 w-2.5" />
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("Issue New Card", "إصدار بطاقة جديدة")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <CreateCardDialog open={open} onOpenChange={setOpen} roleLabel={roleLabel} />
      </>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="hero" className="gap-2 shadow-lg">
        <span className="relative inline-flex">
          <CreditCard className="h-4 w-4" />
          <Plus className="h-3 w-3 absolute -top-1 -right-1.5" />
        </span>
        {t("Issue New Card", "إصدار بطاقة جديدة")}
      </Button>
      <CreateCardDialog open={open} onOpenChange={setOpen} roleLabel={roleLabel} />
    </>
  );
}
