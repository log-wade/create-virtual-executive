import { assertAnthropicKey } from "@/lib/config";
import { completeExecutiveReply } from "@/lib/executive/complete-reply";
import { getPersonaMeta } from "@/lib/personas/store";
import {
  getCallMessages,
  getCallPersona,
  setCallMessages,
} from "@/lib/twilio/call-conversation";
import {
  escapeTwiMLText,
  getPublicBaseUrl,
  truncateForSay,
  twimlResponse,
} from "@/lib/twilio/twiml";
import {
  formDataToParamRecord,
  isTwilioWebhookAuthentic,
} from "@/lib/twilio/validate-signature";
import { isTwilioVoiceBargeInEnabled } from "@/lib/twilio/voice-settings";

export const maxDuration = 120;

/**
 * Twilio `<Gather speech>` callback: `SpeechResult` → executive reply.
 * With Upstash: history + per-call persona. `personaId` query param keeps outbound
 * calls working without Redis. With `TWILIO_VOICE_BARGE_IN` (default on), assistant
 * `<Say>` is nested in `<Gather>` for speech barge-in.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return twimlResponse(
      `<Response><Say voice="Polly.Joanna">Invalid request.</Say><Hangup/></Response>`,
    );
  }

  const params = formDataToParamRecord(form);
  if (!isTwilioWebhookAuthentic(req, params)) {
    return new Response("Forbidden", { status: 403 });
  }

  const callSidRaw = form.get("CallSid");
  const callSid =
    typeof callSidRaw === "string" ? callSidRaw.trim() : "";

  let personaId = process.env.TWILIO_VOICE_PERSONA_ID?.trim() ?? "";
  const url = new URL(req.url);
  const qPersona = url.searchParams.get("personaId")?.trim();
  if (qPersona) {
    const m = await getPersonaMeta(qPersona);
    if (m) personaId = qPersona;
  }
  if (callSid) {
    const stored = await getCallPersona(callSid);
    if (stored) personaId = stored;
  }

  if (!personaId) {
    return twimlResponse(
      `<Response><Say voice="Polly.Joanna">Server misconfiguration.</Say><Hangup/></Response>`,
    );
  }

  const personaMeta = await getPersonaMeta(personaId);
  if (!personaMeta) {
    return twimlResponse(
      `<Response><Say voice="Polly.Joanna">${escapeTwiMLText(
        "Persona not found.",
      )}</Say><Hangup/></Response>`,
    );
  }

  const speechRaw = form.get("SpeechResult");
  const speech =
    typeof speechRaw === "string" ? speechRaw.trim() : String(speechRaw ?? "").trim();

  const base = getPublicBaseUrl(req);
  const gatherUrl = `${base}/api/twilio/voice/gather?personaId=${encodeURIComponent(personaId)}`;
  const bargeIn = isTwilioVoiceBargeInEnabled();

  if (!speech) {
    return twimlResponse(
      `<Response>
        <Gather input="speech" speechTimeout="auto" action="${gatherUrl}" method="POST" language="en-US">
          <Say voice="Polly.Joanna">Sorry, I did not hear anything. Please try again.</Say>
        </Gather>
        <Say voice="Polly.Joanna">Goodbye.</Say>
        <Hangup/>
      </Response>`,
    );
  }

  try {
    assertAnthropicKey();
    const prior = callSid ? await getCallMessages(callSid) : [];
    const messages = [...prior, { role: "user" as const, content: speech }];
    const reply = await completeExecutiveReply(personaId, messages);
    if (callSid) {
      await setCallMessages(
        callSid,
        [...messages, { role: "assistant" as const, content: reply }],
        { personaId },
      );
    }
    const safe = escapeTwiMLText(truncateForSay(reply));
    const followUpText = escapeTwiMLText(
      "Anything else? You can speak anytime, or hang up when you are done.",
    );

    if (bargeIn) {
      return twimlResponse(
        `<Response>
          <Gather input="speech" speechTimeout="auto" action="${gatherUrl}" method="POST" language="en-US">
            <Say voice="Polly.Joanna">${safe}</Say>
            <Say voice="Polly.Joanna">${followUpText}</Say>
          </Gather>
          <Say voice="Polly.Joanna">Goodbye.</Say>
          <Hangup/>
        </Response>`,
      );
    }

    return twimlResponse(
      `<Response>
        <Say voice="Polly.Joanna">${safe}</Say>
        <Gather input="speech" speechTimeout="auto" action="${gatherUrl}" method="POST" language="en-US">
          <Say voice="Polly.Joanna">Anything else?</Say>
        </Gather>
        <Say voice="Polly.Joanna">Goodbye.</Say>
        <Hangup/>
      </Response>`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return twimlResponse(
      `<Response><Say voice="Polly.Joanna">${escapeTwiMLText(
        `Sorry, something went wrong. ${msg.slice(0, 200)}`,
      )}</Say><Hangup/></Response>`,
    );
  }
}
