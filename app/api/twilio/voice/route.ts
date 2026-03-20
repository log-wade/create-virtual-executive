import { getPersonaMeta } from "@/lib/personas/store";
import {
  isPhoneConversationStoreConfigured,
  setCallPersona,
} from "@/lib/twilio/call-conversation";
import {
  escapeTwiMLText,
  getPublicBaseUrl,
  twimlResponse,
} from "@/lib/twilio/twiml";
import {
  formDataToParamRecord,
  isTwilioWebhookAuthentic,
} from "@/lib/twilio/validate-signature";

export const maxDuration = 30;

/**
 * Twilio Voice webhook (incoming or outbound first leg).
 * Optional query: `?personaId=` (must exist) for outbound API; else `TWILIO_VOICE_PERSONA_ID`.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const params = formDataToParamRecord(form);
  if (!isTwilioWebhookAuthentic(req, params)) {
    return new Response("Forbidden", { status: 403 });
  }

  let personaId = process.env.TWILIO_VOICE_PERSONA_ID?.trim() ?? "";
  const qPersona = new URL(req.url).searchParams.get("personaId")?.trim();
  if (qPersona) {
    const qMeta = await getPersonaMeta(qPersona);
    if (qMeta) personaId = qPersona;
  }

  if (!personaId) {
    return twimlResponse(
      `<Response><Say voice="Polly.Joanna">${escapeTwiMLText(
        "This phone line is not configured. Set Twilio Voice Persona Id or pass a valid persona Id in the webhook URL.",
      )}</Say><Hangup/></Response>`,
    );
  }

  const meta = await getPersonaMeta(personaId);
  if (!meta) {
    return twimlResponse(
      `<Response><Say voice="Polly.Joanna">${escapeTwiMLText(
        "That executive persona is not available.",
      )}</Say><Hangup/></Response>`,
    );
  }

  const callSid = params.CallSid?.trim();
  if (callSid && isPhoneConversationStoreConfigured()) {
    await setCallPersona(callSid, personaId);
  }

  const base = getPublicBaseUrl(req);
  const gatherUrl = `${base}/api/twilio/voice/gather?personaId=${encodeURIComponent(personaId)}`;

  return twimlResponse(
    `<Response>
      <Gather input="speech" speechTimeout="auto" action="${gatherUrl}" method="POST" language="en-US">
        <Say voice="Polly.Joanna">Hello. I am your virtual executive. Please speak after the tone.</Say>
      </Gather>
      <Say voice="Polly.Joanna">I did not catch that. Goodbye.</Say>
      <Hangup/>
    </Response>`,
  );
}
