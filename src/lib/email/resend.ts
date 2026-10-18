import "server-only";

/**
 * Email delivery through Resend (https://resend.com). Server-only: the API
 * key never reaches the browser.
 *
 * RESEND_API_KEY  — from the Resend dashboard.
 * EMAIL_FROM      — a sender on a domain verified in Resend, e.g.
 *                   "CashCompass <notify@cashcompass.club>". Without a
 *                   verified domain Resend only delivers to your own address.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<{ ok: boolean; status?: number }> {
  if (!isEmailConfigured()) return { ok: false };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM!.trim(),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) {
      // Status only: never log addresses, message bodies or the key.
      console.warn(`[email] Resend rejected the message (status ${response.status})`);
      return { ok: false, status: response.status };
    }
    return { ok: true };
  } catch (error) {
    console.warn("[email] Resend request failed:", error instanceof Error ? error.name : "unknown error");
    return { ok: false };
  }
}
