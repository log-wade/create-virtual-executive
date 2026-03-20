/** Escape text for safe inclusion inside Twilio TwiML elements. */
export function escapeTwiMLText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Twilio `<Say>` has practical length limits; keep responses bounded. */
export const MAX_TWILIO_SAY_CHARS = 3_500;

export function truncateForSay(text: string): string {
  const t = text.trim();
  if (t.length <= MAX_TWILIO_SAY_CHARS) return t;
  return `${t.slice(0, MAX_TWILIO_SAY_CHARS - 1)}…`;
}

export function twimlResponse(xmlBody: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>${xmlBody}`;
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function getPublicBaseUrl(req: Request): string {
  const env = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (env) return env;
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}
