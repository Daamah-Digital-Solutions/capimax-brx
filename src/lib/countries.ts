// Every country (ISO 3166-1 alpha-2), named in the site language by the browser's own
// Intl.DisplayNames — no hand-kept translations to drift. A few codes keep the values the
// platform already stored before (USA / UAE / UK) so existing records still match.

const CODES =
  "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(
    " ",
  );

const LEGACY_VALUE: Record<string, string> = { US: "USA", AE: "UAE", GB: "UK" };

export interface CountryOption {
  value: string;
  label: string;
}

/** All countries, sorted by name in the given language. */
export function countryOptions(language: string): CountryOption[] {
  const lang = language === "ar" ? "ar" : "en";
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([lang], { type: "region" });
  } catch {
    names = null;
  }
  return CODES.map((code) => ({
    value: LEGACY_VALUE[code] ?? code,
    label: names?.of(code) ?? code,
  })).sort((a, b) => a.label.localeCompare(b.label, lang));
}
