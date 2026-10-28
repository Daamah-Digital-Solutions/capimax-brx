import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Blocks,
  Building,
  Check,
  Copy,
  ExternalLink,
  FileCheck2,
  LineChart,
  QrCode,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { propertiesApi } from "@/integrations/api/client";
import { displayUrl } from "@/lib/partners";
import {
  INDEPENDENT_VERIFICATION,
  VERIFICATION_PARTNERS,
  VERIFY_INTRO,
  type VerificationPartner,
} from "@/lib/verificationPartners";

/**
 * "Verify Your Documents": BRX certificates by QR code, the designated partners, and the
 * Wyoming registries with each property's IDs to search with (same layout as PropShare).
 */

const ICONS: Record<string, LucideIcon> = {
  certificates: QrCode,
  valuation_financial: LineChart,
  insurance: ShieldCheck,
  legal: Scale,
  blockchain: Blocks,
  spv: Building,
  digital_asset: FileCheck2,
};

type Registration = Awaited<ReturnType<typeof propertiesApi.registrations>>[number];

function CopyId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => undefined);
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground hover:border-primary/50"
      dir="ltr"
    >
      {value}
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

/** The IDs to search the Wyoming registry with, one row per property. */
function RegistryList({ kind, rows, isAr }: { kind: "spv" | "digital_asset"; rows: Registration[]; isAr: boolean }) {
  const list = rows.filter((r) => (kind === "spv" ? r.filingId || r.spvName : r.digitalAssetId));
  if (!list.length) return null;
  return (
    <div className="mt-4 rounded-lg border border-border">
      <p className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
        {kind === "spv"
          ? isAr ? "بيانات البحث لكل عقار" : "What to search for each property"
          : isAr ? "معرّف الأصل الرقمي لكل عقار" : "Each property's digital asset ID"}
      </p>
      <ul className="divide-y divide-border">
        {list.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 font-medium text-foreground">{isAr ? r.nameAr : r.name}</span>
            <span className="flex flex-wrap items-center gap-2">
              {kind === "spv" ? (
                <>
                  {r.spvName && <span className="text-xs text-muted-foreground" dir="ltr">{r.spvName}</span>}
                  {r.filingId && <CopyId value={r.filingId} />}
                </>
              ) : (
                <CopyId value={r.digitalAssetId} />
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Certificates are verified here: the QR opens /verify/<code>; the code can be typed too. */
function CertificateCheck({ p, isAr }: { p: VerificationPartner; isAr: boolean }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = code.trim();
    if (value) navigate(`/verify/${encodeURIComponent(value)}`);
  };
  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={isAr ? "رمز التحقق المدوّن على الشهادة" : "Verification code on the certificate"}
        aria-label={isAr ? p.linkLabel.ar : p.linkLabel.en}
        dir="ltr"
        className="font-mono"
      />
      <Button type="submit" className="gap-2 shrink-0" disabled={!code.trim()}>
        <QrCode className="h-4 w-4" />
        {isAr ? p.action.ar : p.action.en}
      </Button>
    </form>
  );
}

export function VerificationPartners() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const pick = (t: { en: string; ar: string }) => (isAr ? t.ar : t.en);

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  useEffect(() => {
    let active = true;
    propertiesApi
      .registrations()
      .then((rows) => active && setRegistrations(rows))
      .catch(() => active && setRegistrations([]));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-labelledby="verify-your-documents" className="space-y-6">
      <div className="text-center">
        <h2 id="verify-your-documents" className="font-display text-2xl md:text-3xl font-bold text-foreground">
          {pick(VERIFY_INTRO.title)}
        </h2>
        <p className="mt-2 text-muted-foreground mx-auto max-w-2xl">{pick(VERIFY_INTRO.text)}</p>
      </div>

      <ol className="space-y-4">
        {VERIFICATION_PARTNERS.map((p, i) => {
          const Icon = ICONS[p.key] ?? FileCheck2;
          return (
            <li key={p.key}>
              <Card className="overflow-hidden">
                <CardContent className="p-5 md:p-6">
                  <div className="flex items-start gap-4">
                    <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 sm:flex">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold leading-snug text-foreground">
                        <span className="text-primary">{i + 1}.</span> {pick(p.title)}
                      </h3>
                      <p className="mt-0.5 text-sm font-medium text-primary">{pick(p.providerLine)}</p>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{pick(p.description)}</p>
                      <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm leading-relaxed text-foreground">
                        {pick(p.howTo)}
                      </p>
                      {p.notes?.map((n) => (
                        <p key={n.en} className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {pick(n)}
                        </p>
                      ))}

                      {p.kind === "certificate" ? (
                        <CertificateCheck p={p} isAr={isAr} />
                      ) : (
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <Button asChild className="gap-2 self-start whitespace-normal h-auto min-h-10 text-start">
                            <a href={p.url} target="_blank" rel="noopener noreferrer">
                              {pick(p.action)} <ExternalLink className="h-4 w-4 shrink-0" />
                            </a>
                          </Button>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 text-sm sm:text-end"
                          >
                            <span className="block font-medium text-primary underline underline-offset-4 hover:text-primary/80">
                              {pick(p.linkLabel)}
                            </span>
                            <span className="block break-all text-xs text-muted-foreground" dir="ltr">
                              {displayUrl(p.url)}
                            </span>
                          </a>
                        </div>
                      )}

                      {p.registry && <RegistryList kind={p.registry} rows={registrations} isAr={isAr} />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl border border-border bg-muted/30 p-5 text-center">
        <h3 className="font-semibold text-foreground">{pick(INDEPENDENT_VERIFICATION.title)}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground mx-auto max-w-2xl">
          {pick(INDEPENDENT_VERIFICATION.text)}
        </p>
      </div>
    </section>
  );
}
