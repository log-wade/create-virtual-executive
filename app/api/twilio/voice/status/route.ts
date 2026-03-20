import { clearCallMessages } from "@/lib/twilio/call-conversation";
import {
  formDataToParamRecord,
  isTwilioWebhookAuthentic,
} from "@/lib/twilio/validate-signature";

export const maxDuration = 30;

const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "busy",
  "no-answer",
  "canceled",
]);

/**
 * Optional Twilio **call status** webhook: clears CallSid conversation keys when the call ends.
 * Configure under Phone Number → **Call status changes** → POST `.../api/twilio/voice/status`.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response("", { status: 400 });
  }

  const params = formDataToParamRecord(form);
  if (!isTwilioWebhookAuthentic(req, params)) {
    return new Response("Forbidden", { status: 403 });
  }

  const callSid = params.CallSid?.trim();
  const status = params.CallStatus?.trim();
  if (callSid && status && TERMINAL_STATUSES.has(status)) {
    await clearCallMessages(callSid);
  }

  return new Response("", { status: 200 });
}
