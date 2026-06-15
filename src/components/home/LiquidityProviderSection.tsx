import { ArrowRight, ArrowLeft, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";

export function LiquidityProviderSection() {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <section className="py-12 relative">
      <div className="container">
        <div className="flex justify-center">
          <Card 
            className="border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group max-w-sm w-full"
            onClick={() => navigate("/liquidity-provider")}
          >
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-gold rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-gold group-hover:scale-110 transition-transform duration-300">
                <Droplets className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {isRTL ? "سجل كمزود سيولة" : "Register as LP"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isRTL ? "انضم إلى برنامج مزودي السيولة" : "Join our Liquidity Provider Program"}
              </p>
              <Button
                variant="hero"
                size="sm"
                className="group/btn"
              >
                {isRTL ? "سجل الآن" : "Register Now"}
                <ArrowIcon className={`w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform ${isRTL ? "group-hover/btn:-translate-x-1" : ""}`} />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
