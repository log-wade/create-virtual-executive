/**
 * When true (default), assistant `<Say>` is nested inside `<Gather speech>` so callers
 * can interrupt (Twilio speech barge-in). Set `TWILIO_VOICE_BARGE_IN=false` for legacy
 * sequential Say-then-Gather TwiML.
 */
export function isTwilioVoiceBargeInEnabled(): boolean {
  const v = process.env.TWILIO_VOICE_BARGE_IN?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}
