"""
Shared branded HTML email template for Capimax BRX.

`render_branded_email(...)` returns an ``(html, text)`` pair from a few content
pieces so the HTML and plain-text bodies never drift apart. The HTML is
deliberately old-school — table layout, inline CSS, a solid-colour header/CTA
(no gradients or background-images, which Outlook drops) — so it renders in
Gmail, Apple Mail, and Outlook alike. English only; the plain-text part is the
fallback for no-HTML clients.

Pure Python (no Django template engine) so it can be rendered and asserted on in
isolation. Brand tokens mirror the frontend: gold ``--primary hsl(43 74% 49%)``
and deep-navy ``--foreground hsl(222 47% 11%)``.
"""
from __future__ import annotations

import html as _html

# Brand palette (hex equivalents of the frontend HSL tokens).
GOLD = "#D9A520"          # --primary  hsl(43 74% 49%)
GOLD_DARK = "#B8860B"     # button border / hover shade
NAVY = "#0F1A29"          # --foreground hsl(222 47% 11%)
PAGE_BG = "#f4f4f5"
CARD_BG = "#ffffff"
BORDER = "#e5e7eb"
MUTED = "#6b7280"

WORDMARK = "CAPIMAX&nbsp;BRX"


def render_branded_email(
    *,
    preheader: str,
    heading: str,
    intro: str,
    cta_label: str,
    cta_url: str,
    outro: str,
) -> tuple[str, str]:
    """Build the branded ``(html, text)`` bodies for a transactional email."""
    safe_heading = _html.escape(heading)
    safe_intro = _html.escape(intro)
    safe_outro = _html.escape(outro)
    safe_cta_label = _html.escape(cta_label)
    # cta_url goes into href (already a trusted, app-built link) and is shown
    # verbatim as the copy-paste fallback.
    safe_url = _html.escape(cta_url, quote=True)

    html_body = f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>{safe_heading}</title>
</head>
<body style="margin:0;padding:0;background-color:{PAGE_BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{PAGE_BG};font-size:1px;line-height:1px;">{_html.escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{PAGE_BG};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:{CARD_BG};border:1px solid {BORDER};border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <!-- Header -->
        <tr>
          <td align="center" bgcolor="{GOLD}" style="background-color:{GOLD};padding:28px 24px;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;letter-spacing:3px;color:{NAVY};">{WORDMARK}</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 8px 40px;">
            <h1 style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;color:{NAVY};">{safe_heading}</h1>
            <p style="margin:0 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#374151;">{safe_intro}</p>
          </td>
        </tr>
        <!-- CTA button -->
        <tr>
          <td align="center" style="padding:0 40px 28px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="{GOLD}" style="background-color:{GOLD};border-radius:8px;">
                  <a href="{safe_url}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:{NAVY};text-decoration:none;border-radius:8px;border:1px solid {GOLD_DARK};">{safe_cta_label}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Fallback link -->
        <tr>
          <td style="padding:0 40px 28px 40px;">
            <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:{MUTED};">Or copy and paste this link into your browser:</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;word-break:break-all;"><a href="{safe_url}" target="_blank" style="color:{GOLD_DARK};text-decoration:underline;">{safe_url}</a></p>
          </td>
        </tr>
        <!-- Outro -->
        <tr>
          <td style="padding:0 40px 36px 40px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:{MUTED};">{safe_outro}</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid {BORDER};background-color:#fafafa;">
            <p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:{MUTED};">&copy; Capimax BRX &middot; Fractional real-estate investment</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#9ca3af;">This is an automated message from a send-only address — please do not reply.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>"""

    text_body = (
        f"{heading}\n\n"
        f"{intro}\n\n"
        f"{cta_label}: {cta_url}\n\n"
        f"{outro}\n\n"
        f"— Capimax BRX\n"
        f"This is an automated message from a send-only address — please do not reply."
    )

    return html_body, text_body
