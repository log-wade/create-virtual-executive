import { verifyBearerSecret } from "@/lib/admin/verify-bearer-secret";
import { getPersonaMeta } from "@/lib/personas/store";
import { getPublicBaseUrl } from "@/lib/twilio/twiml";
import {
  assertE164,
  createTwilioOutboundCall,
} from "@/lib/twilio/outbound-call";

export const maxDuration = 60;

type Body = {
  to?: string;
  personaId?: string;
};

/**
 * Admin-only: start an outbound call that uses the same TwiML entrypoint as inbound
 * (`/api/twilio/voice`). Authenticate with `Authorization: Bearer <TWILIO_OUTBOUND_API_SECRET>`.
 */
export async function POST(req: Request) {
  const secret = process.env.TWILIO_OUTBOUND_API_SECRET?.trim();
  if (!secret) {
    return Response.json(
      { error: "Outbound calls disabled (set TWILIO_OUTBOUND_API_SECRET)" },
      { status: 503 },
    );
  }

  if (!verifyBearerSecret(req.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_VOICE_FROM_NUMBER?.trim();
  if (!accountSid || !authToken || !fromNumber) {
    return Response.json(
      {
        error:
          "Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_VOICE_FROM_NUMBER",
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let to: string;
  try {
    to = assertE164(body.to ?? "", "to");
    assertE164(fromNumber, "TWILIO_VOICE_FROM_NUMBER");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid number";
    return Response.json({ error: msg }, { status: 400 });
  }

  const defaultPersona = process.env.TWILIO_VOICE_PERSONA_ID?.trim() ?? "";
  let personaId = typeof body.personaId === "string" ? body.personaId.trim() : "";
  if (!personaId) personaId = defaultPersona;
  if (!personaId) {
    return Response.json(
      { error: "personaId or TWILIO_VOICE_PERSONA_ID required" },
      { status: 400 },
    );
  }

  const meta = await getPersonaMeta(personaId);
  if (!meta) {
    return Response.json({ error: "Persona not found" }, { status: 404 });
  }

  const base = getPublicBaseUrl(req);
  const twimlWebhookUrl = `${base}/api/twilio/voice?personaId=${encodeURIComponent(personaId)}`;

  try {
    const { callSid } = await createTwilioOutboundCall({
      accountSid,
      authToken,
      fromE164: fromNumber,
      toE164: to,
      twimlWebhookUrl,
    });
    return Response.json({ callSid, personaId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Twilio request failed";
    return Response.json({ error: msg }, { status: 502 });
  }
}
