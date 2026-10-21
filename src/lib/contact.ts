// Customer-service contact details (Support page). Same address / numbers / email as the
// site footer. WhatsApp shows only when VITE_SUPPORT_WHATSAPP is set (international format).
export const SUPPORT_EMAIL = "info@capimaxbrx.com";
export const SUPPORT_PHONES = ["+1 205 350 8771", "+1 205 350 8864", "+44 7577 370309"];
export const SUPPORT_ADDRESS = "8 The Green, Ste R, Dover DE 19901";
export const SUPPORT_WHATSAPP = ((import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined) || "").replace(/[^\d]/g, "");

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
export const whatsappHref = (text: string) =>
  `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;
