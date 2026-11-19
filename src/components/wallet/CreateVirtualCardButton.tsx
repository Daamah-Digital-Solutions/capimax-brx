import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, CreditCard } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { CardWaitlistDialog, waitlistLabel } from "@/components/wallet/CardWaitlistDialog";
import { useCardWaitlist } from "@/hooks/useCardWaitlist";

interface CreateVirtualCardButtonProps {
  roleLabel?: string;
  variant?: "icon" | "full";
}

/**
 * Header card CTA. BRX Visa cards are not issued yet (client letter 2026-11-19), so it reads
 * "Coming soon · Join the Waitlist" and opens the waitlist instead of card issuance; once
 * joined it says so. Same button, same place, same look.
 */
export function CreateVirtualCardButton({ variant = "full" }: CreateVirtualCardButtonProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [open, setOpen] = useState(false);
  const { joined } = useCardWaitlist();
  const label = joined
    ? (isAr ? "قريباً · أنت في قائمة الانتظار" : "Coming soon · You're on the waitlist")
    : waitlistLabel(isAr);

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
                aria-label={label}
              >
                <CreditCard className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <CardWaitlistDialog open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="hero" className="gap-2 shadow-lg">
        {joined ? <CheckCircle2 className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
        {label}
      </Button>
      <CardWaitlistDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
