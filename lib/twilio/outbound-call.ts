/**
 * Start an outbound call via Twilio REST (2010-04-01).
 * @see https://www.twilio.com/docs/voice/api/call-resource#create-a-call-resource
 */
export type CreateTwilioOutboundCallParams = {
  accountSid: string;
  authToken: string;
  fromE164: string;
  toE164: string;
  /** Twilio will request this URL (POST) for the first TwiML leg. */
  twimlWebhookUrl: string;
};

export type CreateTwilioOutboundCallResult = { callSid: string };

export async function createTwilioOutboundCall(
  params: CreateTwilioOutboundCallParams,
): Promise<CreateTwilioOutboundCallResult> {
  const { accountSid, authToken, fromE164, toE164, twimlWebhookUrl } = params;
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Calls.json`;
  const body = new URLSearchParams({
    To: toE164,
    From: fromE164,
    Url: twimlWebhookUrl,
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Twilio Calls API ${res.status}: ${text.slice(0, 600)}`);
  }

  let json: { sid?: string };
  try {
    json = JSON.parse(text) as { sid?: string };
  } catch {
    throw new Error("Twilio Calls API returned non-JSON");
  }
  if (!json.sid) {
    throw new Error("Twilio Calls API response missing sid");
  }
  return { callSid: json.sid };
}

const E164_RE = /^\+[1-9]\d{1,14}$/;

export function assertE164(to: string, label: string): string {
  const t = to.trim();
  if (!E164_RE.test(t)) {
    throw new Error(`${label} must be E.164 (e.g. +15551234567)`);
  }
  return t;
}
