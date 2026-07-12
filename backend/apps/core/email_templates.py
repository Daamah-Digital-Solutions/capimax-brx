"""
Shared branded HTML email template for CapiMax BRX.

`render_branded_email(...)` returns an ``(html, text)`` pair from a few content
pieces so the HTML and plain-text bodies never drift apart. The design mirrors the
platform's brand (deep-navy header with the CapiMax BRX wordmark + a green call-to-
action) and carries a full corporate footer — both legal entities, contact details,
and the "Ecosystem" positioning — on every message, per the client's brief.

The HTML is deliberately old-school — table layout, inline CSS, solid colours, NO
gradients or background-images and NO remote images (which Outlook/Gmail block) — so
it renders in Gmail, Apple Mail, and Outlook alike. The brand mark is drawn with
styled text (not an image) so it always shows. English only; the plain-text part is
the fallback for no-HTML clients.

Pure Python (no Django template engine) so it can be rendered and asserted on in
isolation.
"""
from __future__ import annotations

import html as _html

# Brand palette (from the CapiMax BRX logo).
GREEN = "#2FAD6F"
GREEN_DARK = "#1F8A55"
NAVY = "#0A2928"
NAVY_SOFT = "#0f3a34"
PAGE_BG = "#f4f4f5"
CARD_BG = "#ffffff"
BORDER = "#e5e7eb"
MUTED = "#6b7280"
FOOTER_TEXT = "#c8d3cf"
FOOTER_MUTED = "#8fa39c"

# Platform + corporate identity (shown in every footer).
PLATFORM_NAME = "CapiMax BRX"
TAGLINE = "Real Estate Tokenization Ecosystem"
SUPPORT_EMAIL = "info@capimaxbrx.com"
SUPPORT_PHONE = "+1 (207) 977-2889"
COPYRIGHT_YEAR = "2026"
ENTITY_ONE = (
    "CAPImax Real Estate Technologies LLC",
    "Entity No. 10630386 · Delaware, USA",
    "501 Silverside Rd, Ste 105, Wilmington, DE 19809",
)
ENTITY_TWO = (
    "Capimax Asset Structures LLC",
    "Wyoming Entity ID 2026-001989735",
    "1095 Sugarview Dr, Ste 100, Sheridan, WY 82801",
)


def _brand_header() -> str:
    return f"""\
        <tr>
          <td align="center" bgcolor="{NAVY}" style="background-color:{NAVY};padding:26px 24px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:800;letter-spacing:1px;line-height:1;">
              <span style="color:{GREEN};">C</span><span style="color:#ffffff;">APIMAX</span><span style="display:inline-block;background-color:{GREEN};color:{NAVY};padding:2px 9px;border-radius:6px;font-size:17px;font-weight:800;margin-left:6px;vertical-align:middle;">BRX</span>
            </div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:3px;color:{FOOTER_MUTED};margin-top:9px;text-transform:uppercase;">{TAGLINE}</div>
          </td>
        </tr>"""


def _entity_cell(entity: tuple[str, str, str]) -> str:
    name, line1, line2 = entity
    return f"""\
              <td valign="top" width="50%" style="padding:0 10px;font-family:Arial,Helvetica,sans-serif;">
                <p style="margin:0 0 3px 0;font-size:12px;font-weight:bold;color:#ffffff;">{_html.escape(name)}</p>
                <p style="margin:0;font-size:11px;line-height:1.5;color:{FOOTER_MUTED};">{_html.escape(line1)}<br>{_html.escape(line2)}</p>
              </td>"""


def _brand_footer() -> str:
    return f"""\
        <tr>
          <td style="padding:28px 32px;background-color:{NAVY};">
            <p style="margin:0 0 2px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:800;color:#ffffff;letter-spacing:1px;">
              <span style="color:{GREEN};">C</span>APIMAX <span style="color:{GREEN};">BRX</span>
            </p>
            <p style="margin:0 0 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:{FOOTER_MUTED};text-transform:uppercase;">{TAGLINE}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid {NAVY_SOFT};padding-top:16px;">
              <tr>
{_entity_cell(ENTITY_ONE)}
{_entity_cell(ENTITY_TWO)}
              </tr>
            </table>
            <p style="margin:18px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:{FOOTER_TEXT};">
              <a href="mailto:{SUPPORT_EMAIL}" style="color:{GREEN};text-decoration:none;">{SUPPORT_EMAIL}</a>
              &nbsp;·&nbsp; {SUPPORT_PHONE}
            </p>
            <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:{FOOTER_MUTED};">
              &copy; {COPYRIGHT_YEAR} {PLATFORM_NAME}. All rights reserved.<br>
              This email was sent automatically by {PLATFORM_NAME} from a send-only address — please do not reply.
            </p>
          </td>
        </tr>"""


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
    # cta_url goes into href (already a trusted, app-built link) and is shown verbatim
    # as the copy-paste fallback.
    safe_url = _html.escape(cta_url, quote=True)

    # The CTA + fallback blocks are omitted when there is no link (informational emails).
    cta_block = ""
    if cta_url and cta_label:
        cta_block = f"""\
        <tr>
          <td align="center" style="padding:0 40px 24px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="{GREEN}" style="background-color:{GREEN};border-radius:8px;">
                  <a href="{safe_url}" target="_blank" style="display:inline-block;padding:14px 34px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;border:1px solid {GREEN_DARK};">{safe_cta_label}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 24px 40px;">
            <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:{MUTED};">Or copy and paste this link into your browser:</p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;word-break:break-all;"><a href="{safe_url}" target="_blank" style="color:{GREEN_DARK};text-decoration:underline;">{safe_url}</a></p>
          </td>
        </tr>"""

    outro_block = ""
    if outro:
        outro_block = f"""\
        <tr>
          <td style="padding:0 40px 32px 40px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:{MUTED};">{safe_outro}</p>
          </td>
        </tr>"""

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
{_brand_header()}
        <tr>
          <td style="padding:36px 40px 8px 40px;">
            <h1 style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;color:{NAVY};">{safe_heading}</h1>
            <p style="margin:0 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#374151;">{safe_intro}</p>
          </td>
        </tr>
{cta_block}
{outro_block}
{_brand_footer()}
      </table>
    </td>
  </tr>
</table>
</body>
</html>"""

    text_lines = [heading, "", intro, ""]
    if cta_url and cta_label:
        text_lines += [f"{cta_label}: {cta_url}", ""]
    if outro:
        text_lines += [outro, ""]
    text_lines += [
        f"— {PLATFORM_NAME} · {TAGLINE}",
        f"{SUPPORT_EMAIL} · {SUPPORT_PHONE}",
        f"© {COPYRIGHT_YEAR} {PLATFORM_NAME}. All rights reserved.",
        "This email was sent automatically from a send-only address — please do not reply.",
    ]
    text_body = "\n".join(text_lines)

    return html_body, text_body
