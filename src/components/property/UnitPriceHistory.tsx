import { useEffect, useMemo, useState } from "react";
import { History, TrendingDown, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { propertiesApi, type UnitPriceSummary } from "@/integrations/api/client";
import { cn } from "@/lib/utils";

// Off-plan §7: the unit price over time — launch price, today's price and the change since
// launch, the current phase, every recorded change, and (for a holder) their average cost.
// Real data only (GET /api/properties/{slug}/prices/). Prices are recorded by the admin when
// they change; nothing here forecasts them.

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  slug: string;
  /** The holder's average cost per unit — drawn as a reference line when given. */
  avgCost?: number | null;
  /** Hide the change log (e.g. inside a report card). */
  compact?: boolean;
  /** Render nothing while the price is still the launch price. */
  hideIfUnchanged?: boolean;
  title?: string;
  className?: string;
}

export function UnitPriceHistory({ slug, avgCost, compact, hideIfUnchanged, title, className }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [data, setData] = useState<UnitPriceSummary | null>(null);

  useEffect(() => {
    let live = true;
    propertiesApi
      .prices(slug)
      .then((d) => live && setData(d))
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [slug]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(isAr ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  // Steps: each recorded price holds until the next one; the last one runs to today.
  const series = useMemo(() => {
    if (!data) return [];
    const pts = data.points.map((p) => ({ t: new Date(p.date).getTime(), price: Number(p.price) }));
    const now = Date.now();
    if (pts.length && pts[pts.length - 1].t < now) pts.push({ t: now, price: Number(data.currentPrice) });
    return pts;
  }, [data]);

  if (!data) return null;

  const launch = Number(data.launchPrice);
  const current = Number(data.currentPrice);
  const change = Number(data.changePct);
  const changed = data.points.length > 1;
  const up = change >= 0;
  const changes = data.points.slice(1).reverse();
  if (hideIfUnchanged && !changed) return null;

  return (
    <div className={cn("p-6 bg-card rounded-2xl border border-border", className)}>
      <h3 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
        <History className="w-5 h-5 text-primary" />
        {title ?? (isAr ? "سعر الوحدة عبر الزمن" : "Unit price over time")}
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
        <Stat label={isAr ? "سعر الإطلاق" : "Launch price"} value={money(launch)} />
        <Stat label={isAr ? "السعر الحالي" : "Current price"} value={money(current)} />
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-xs text-muted-foreground mb-0.5">{isAr ? "التغيّر منذ الإطلاق" : "Change since launch"}</div>
          <div
            className={cn(
              "font-semibold flex items-center gap-1",
              !changed ? "text-foreground" : up ? "text-success" : "text-destructive",
            )}
            dir="ltr"
          >
            {changed && (up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />)}
            {up && changed ? "+" : ""}
            {change.toFixed(2)}%
          </div>
        </div>
        <Stat
          label={data.label ? (isAr ? "المرحلة الحالية" : "Current phase") : isAr ? "آخر تحديث" : "Last update"}
          value={data.label || (data.updatedAt ? fmtDate(data.updatedAt) : isAr ? "لم يتغيّر" : "Unchanged")}
        />
      </div>

      {changed ? (
        <div className="h-56 -mx-2" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t) => new Date(t).toLocaleDateString(isAr ? "ar-EG" : "en-GB", { month: "short", year: "2-digit" })}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
              <YAxis
                width={56}
                domain={["auto", "auto"]}
                tickFormatter={(v) => `$${v}`}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
              <Tooltip
                labelFormatter={(t) => fmtDate(new Date(Number(t)).toISOString())}
                formatter={(v: number) => [money(v), isAr ? "سعر الوحدة" : "Unit price"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              {avgCost ? (
                <ReferenceLine
                  y={avgCost}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 4"
                  label={{
                    value: `${isAr ? "متوسط تكلفتك" : "Your avg cost"} ${money(avgCost)}`,
                    position: "insideTopLeft",
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 11,
                  }}
                />
              ) : null}
              <Line
                type="stepAfter"
                dataKey="price"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {isAr
            ? "لم يتغيّر سعر الوحدة منذ الإطلاق. تُسجَّل أي تغييرات هنا بتاريخها."
            : "The unit price hasn't changed since launch. Any change is recorded here with its date."}
        </p>
      )}

      {!compact && changes.length > 0 && (
        <div className="mt-4 rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[420px]">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="text-start font-medium px-4 py-2">{isAr ? "التاريخ" : "Date"}</th>
                <th className="text-start font-medium px-4 py-2">{isAr ? "السعر" : "Price"}</th>
                <th className="text-start font-medium px-4 py-2">{isAr ? "المرحلة / ملاحظة" : "Phase / note"}</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((p, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(p.date)}</td>
                  <td className="px-4 py-2 whitespace-nowrap" dir="ltr">
                    {p.previousPrice ? `${money(Number(p.previousPrice))} → ` : ""}
                    <span className="font-medium">{money(Number(p.price))}</span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {[p.label, p.note].filter(Boolean).join(" — ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        {isAr
          ? "الأسعار السابقة لا تضمن الأسعار المستقبلية، وقد ينخفض السعر."
          : "Past prices don't guarantee future prices; the price can go down."}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-muted rounded-lg">
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="font-semibold text-foreground" dir="ltr">{value}</div>
    </div>
  );
}
