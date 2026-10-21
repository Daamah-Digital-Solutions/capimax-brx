import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, FileSignature, Loader2, ShieldAlert } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import { brokerLeadsApi } from "@/integrations/api/client";

type Info = Awaited<ReturnType<typeof brokerLeadsApi.ownerRequest>>;

/** PUBLIC — a property owner confirms that a broker may refer their property (emailed link). */
export default function BrokerAuthorization() {
  const { token = "" } = useParams();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [info, setInfo] = useState<Info | null>(null);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    brokerLeadsApi.ownerRequest(token).then((d) => {
      setInfo(d);
      setDone(d.confirmed);
      setName(d.owner_name || "");
    }).catch(() => setMissing(true));
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await brokerLeadsApi.ownerConfirm(token, name.trim());
      setDone(true);
    } catch (e: any) {
      setError(e?.message || (isAr ? "تعذّر التأكيد" : "Could not confirm"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-xl mx-auto">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-6 space-y-5">
            {missing ? (
              <div className="text-center py-8 space-y-3">
                <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="font-semibold text-foreground">{isAr ? "الرابط غير صالح أو انتهى" : "This link is invalid or has expired"}</p>
                <p className="text-sm text-muted-foreground">
                  {isAr ? "اطلب من الوسيط إرسال رابط جديد." : "Ask the broker to send you a new link."}
                </p>
              </div>
            ) : !info ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : done ? (
              <div className="text-center py-8 space-y-3">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
                <p className="text-lg font-semibold text-foreground">{isAr ? "تم تأكيد التفويض" : "Authorization confirmed"}</p>
                <p className="text-sm text-muted-foreground">
                  {isAr
                    ? "شكرًا لك. سيتواصل معك فريق Capimax BRX بخصوص إدراج العقار."
                    : "Thank you. The Capimax BRX team will contact you about listing the property."}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileSignature className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-display font-bold text-foreground">
                      {isAr ? "تأكيد تفويض إحالة العقار" : "Confirm the referral of your property"}
                    </h1>
                    <p className="text-sm text-muted-foreground">Capimax BRX</p>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 p-4 space-y-1.5 text-sm">
                  <p><span className="text-muted-foreground">{isAr ? "العقار:" : "Property:"}</span> <strong>{info.property}</strong></p>
                  {info.location && <p><span className="text-muted-foreground">{isAr ? "الموقع:" : "Location:"}</span> {info.location}</p>}
                  {info.property_type && <p><span className="text-muted-foreground">{isAr ? "النوع:" : "Type:"}</span> {info.property_type}</p>}
                  <p>
                    <span className="text-muted-foreground">{isAr ? "الوسيط:" : "Broker:"}</span> {info.broker_name}
                    {info.broker_license && <span className="text-muted-foreground"> · {isAr ? "ترخيص" : "licence"} {info.broker_license}</span>}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isAr
                    ? "بتأكيدك تفوّض هذا الوسيط بإحالة العقار إلى Capimax BRX لدراسة إدراجه. لا يعني ذلك بيع العقار أو إدراجه؛ سيتواصل معك فريقنا قبل أي خطوة."
                    : "By confirming, you authorize this broker to refer the property to Capimax BRX for listing review. This doesn't sell or list the property; our team will contact you before any step."}
                </p>
                <div className="space-y-1.5">
                  <Label>{isAr ? "اسمك الكامل" : "Your full name"}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
                  <span>
                    {isAr
                      ? "أؤكد أنني مالك العقار أو مخوّل عنه، وأفوّض هذا الوسيط بإحالته."
                      : "I confirm I own this property or am authorized to act for its owner, and I authorize this broker to refer it."}
                  </span>
                </label>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button className="w-full bg-gradient-gold hover:opacity-90" onClick={confirm} disabled={busy || !agree || !name.trim()}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                  {isAr ? "تأكيد التفويض" : "Confirm authorization"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {isAr ? "إن لم تكن تعرف هذا الوسيط فتجاهل الصفحة، فلن يحدث شيء دون تأكيدك." : "If you don't know this broker, just close this page — nothing happens without your confirmation."}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
