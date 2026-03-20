import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Build the URL Twilio used when signing (must match Console webhook URL).
 * Prefer `PUBLIC_BASE_URL` so it matches production host behind proxies.
 */
export function getTwilioSignatureUrl(req: Request): string {
  const incoming = new URL(req.url);
  const pathWithQuery = `${incoming.pathname}${incoming.search}`;
  const base = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  const raw = base ? `${base}${pathWithQuery}` : incoming.toString();
  return normalizeTwilioUrl(raw);
}

function normalizeTwilioUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol === "https:" && u.port === "443") u.port = "";
    if (u.protocol === "http:" && u.port === "80") u.port = "";
    return u.toString();
  } catch {
    return url;
  }
}

export function formDataToParamRecord(form: FormData): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") record[key] = value;
  }
  return record;
}

/**
 * Twilio request signature (HMAC-SHA1, base64).
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
export function verifyTwilioSignature(
  authToken: string,
  twilioSignature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  const sortedKeys = Object.keys(params).sort();
  let payload = normalizeTwilioUrl(url);
  for (const key of sortedKeys) {
    payload += key + params[key];
  }

  const expected = createHmac("sha1", authToken)
    .update(Buffer.from(payload, "utf8"))
    .digest("base64");

  try {
    return timingSafeEqual(
      Buffer.from(twilioSignature, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}

/**
 * When `TWILIO_AUTH_TOKEN` is set, require a valid `X-Twilio-Signature`.
 * When unset (local dev), validation is skipped.
 */
export function isTwilioWebhookAuthentic(
  req: Request,
  params: Record<string, string>,
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!token) return true;

  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;

  const url = getTwilioSignatureUrl(req);
  return verifyTwilioSignature(token, signature, url, params);
}
