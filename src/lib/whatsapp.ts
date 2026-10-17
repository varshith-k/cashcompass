/**
 * WhatsApp's "click to chat" deep link needs no API key, no Business
 * approval, and no backend — it just opens a pre-filled conversation. A
 * real WhatsApp Business API integration (sent automatically, on a
 * schedule) would need Meta approval and a phone-number-verified
 * business account; this is the zero-credential version of the same
 * idea: one tap, grounded in the real outstanding amount.
 */
export function buildWhatsAppReminderLink(phone: string, message: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
