import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Home page legal disclaimer — the very last block of the page, in small print (client text,
 * "Capimax_BRX_Homepage_Legal_Disclosures_EN"). The Arabic version is a translation of it.
 */
export function LegalDisclaimer() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const linkCls = "underline underline-offset-2 hover:text-foreground";

  return (
    <section
      aria-label={isAr ? "إخلاء المسؤولية القانوني" : "Legal disclaimer"}
      className="border-t border-border bg-background"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="container pt-6 pb-20 max-w-5xl">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {isAr ? "إخلاء المسؤولية القانوني — Capimax BRX" : "Capimax BRX Legal Disclaimer"}
        </h2>
        {isAr ? (
          <div className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
            <p>
              يُدار هذا الموقع بواسطة شركة Capimax Real Estate Technologies LLC («كابيماكس»). منصة Capimax BRX
              هي منصة تقنية ومنظومة رقمية تربط بين المستثمرين وملاك العقارات والمطوّرين والوسطاء ومزوّدي السيولة.
            </p>
            <p>
              كابيماكس ليست وسيطاً مالياً مسجّلاً (Broker-Dealer) ولا مستشاراً استثمارياً، ولا تقدّم خدمات استشارات
              مالية أو نصائح استثمارية شخصية أو توصيات بشراء أي استثمار أو الاحتفاظ به أو بيعه. العروض ومحتوى الموقع
              مقدّمة لأغراض المعلومات فقط، ولا تمثّل تأييداً لأي استثمار أو ضماناً لملاءمته.
            </p>
            <p>
              تنطوي جميع الاستثمارات على مخاطر، بما في ذلك احتمال خسارة جزء من رأس المال المستثمر أو كله. لا تضمن
              كابيماكس العوائد أو الدخل أو ارتفاع قيمة رأس المال أو السيولة أو استرداد رأس المال. الأداء السابق ليس
              مؤشراً موثوقاً للنتائج المستقبلية.
            </p>
            <p>
              أنت مسؤول عن تقييم مدى ملاءمة أي استثمار لظروفك المالية وأهدافك ومدى تحمّلك للمخاطر. راجع المستندات
              الخاصة بكل استثمار، واطلب استشارة مستقلة من مختصين مؤهّلين في الشؤون القانونية والضريبية والاستثمارية
              قبل الاستثمار.
            </p>
            <p>
              يخضع استخدام هذا الموقع لـ<Link to="/terms-conditions" className={linkCls}>اتفاقية المستخدم</Link> و
              <Link to="/privacy-policy" className={linkCls}>سياسة الخصوصية</Link>. لا يستثني أي شيء في إخلاء
              المسؤولية هذا مسؤوليةً لا يجوز استثناؤها قانوناً.
            </p>
            <p>حقوق النشر © 2026 Capimax Real Estate Technologies LLC. جميع الحقوق محفوظة.</p>
          </div>
        ) : (
          <div className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
            <p>
              This website is operated by Capimax Real Estate Technologies LLC (“Capimax”). Capimax BRX is a
              technology platform and digital ecosystem connecting investors, property owners, developers, brokers
              and liquidity providers.
            </p>
            <p>
              Capimax is not a registered broker-dealer or investment adviser and does not provide financial advisory
              services, personalised investment advice, or recommendations to buy, hold or sell any investment.
              Listings and website content are provided for information and do not constitute an endorsement or
              assurance of suitability.
            </p>
            <p>
              All investments involve risk, including the possible loss of some or all invested capital. Capimax does
              not guarantee returns, income, capital appreciation, liquidity or repayment of capital. Past performance
              is not a reliable indicator of future results.
            </p>
            <p>
              You are responsible for assessing whether an investment is appropriate for your financial
              circumstances, objectives and risk tolerance. Review the applicable documents and seek independent
              advice from qualified legal, tax and investment professionals before investing.
            </p>
            <p>
              Use of this website is subject to our{" "}
              <Link to="/terms-conditions" className={linkCls}>User Agreement</Link> and{" "}
              <Link to="/privacy-policy" className={linkCls}>Privacy Policy</Link>. Nothing in this disclaimer
              excludes liability that cannot lawfully be excluded.
            </p>
            <p>Copyright © 2026 Capimax Real Estate Technologies LLC. All rights reserved.</p>
          </div>
        )}
      </div>
    </section>
  );
}
