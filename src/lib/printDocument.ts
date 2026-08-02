// Client-side "Download PDF" for static legal / policy pages. Builds a clean, branded
// document from the page's own section DATA (title + text) and opens it in a print window,
// where the browser's "Save as PDF" produces the file. Built from data, not the DOM, so it
// works no matter which accordion sections are expanded — and needs no backend / library.

export interface PrintSection {
  title: string;
  content: string; // plain text; blank lines and "• " bullets are preserved
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const paragraphs = (content: string) =>
  escapeHtml(content)
    .split("\n")
    .map((line) => (line.trim() ? `<p>${line}</p>` : '<div class="gap"></div>'))
    .join("");

/**
 * Open `sections` as a branded, printable document and trigger the print dialog. Returns
 * false if the popup was blocked (the caller can surface a hint), true otherwise.
 */
export function printDocument(
  title: string,
  sections: PrintSection[],
  opts?: { isRTL?: boolean; subtitle?: string },
): boolean {
  const isRTL = opts?.isRTL ?? false;
  const win = window.open("", "_blank", "noopener,noreferrer,width=920,height=1000");
  if (!win) return false; // popup blocked

  const year = new Date().getFullYear();
  const body = sections
    .map((s) => `<section><h2>${escapeHtml(s.title)}</h2><div class="content">${paragraphs(s.content)}</div></section>`)
    .join("");

  win.document.write(
    `<!doctype html><html lang="${isRTL ? "ar" : "en"}" dir="${isRTL ? "rtl" : "ltr"}"><head>` +
      `<meta charset="utf-8"/><title>${escapeHtml(title)} — CapiMax BRX</title><style>` +
      `body{font-family:'Segoe UI',system-ui,-apple-system,Tahoma,sans-serif;max-width:820px;margin:40px auto;padding:0 32px;color:#111;line-height:1.7}` +
      `.brand{color:#2FAD6F;font-weight:700;font-size:12px;letter-spacing:1px;text-transform:uppercase}` +
      `h1{font-size:26px;color:#0A2928;border-bottom:3px solid #2FAD6F;padding-bottom:12px;margin:4px 0 4px}` +
      `.subtitle{color:#555;font-size:13px;margin-bottom:8px}` +
      `h2{font-size:17px;color:#0A2928;margin-top:26px}` +
      `.content p{margin:6px 0}.content .gap{height:8px}` +
      `footer{margin-top:40px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#666}` +
      `@media print{body{margin:0;max-width:none}}` +
      `</style></head><body>` +
      `<div class="brand">CapiMax BRX · Real Estate Tokenization</div>` +
      `<h1>${escapeHtml(title)}</h1>` +
      (opts?.subtitle ? `<div class="subtitle">${escapeHtml(opts.subtitle)}</div>` : "") +
      body +
      `<footer>© ${year} CapiMax BRX. ${isRTL ? "هذا المستند للاطلاع فقط ولا يُعد نصيحة استثمارية." : "This document is for information only and is not investment advice."}</footer>` +
      `<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},250);};</script>` +
      `</body></html>`,
  );
  win.document.close();
  return true;
}
