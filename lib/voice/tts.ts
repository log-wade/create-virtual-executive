import {
  assertElevenLabsTtsConfigured,
  getElevenLabsApiKey,
  getElevenLabsModelId,
  getElevenLabsVoiceId,
} from "@/lib/config";

/** Upper bound for a single synthesis request; routes should enforce similarly. */
export const MAX_TTS_INPUT_CHARS = 5_000;

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";

/** ElevenLabs `output_format` query values we expose to callers. */
export type ElevenLabsOutputFormat = "mp3_44100_128" | "ulaw_8000";

export type SynthesizeSpeechOptions = {
  /** Overrides `ELEVENLABS_VOICE_ID` when set. */
  voiceId?: string;
  /** Telephony / Twilio Media Streams use `ulaw_8000`. Default: MP3 for web. */
  outputFormat?: ElevenLabsOutputFormat;
};

/**
 * Server-side text-to-speech via ElevenLabs (MVP default per voice research).
 * Call only from server routes or server actions; never expose the API key to the client.
 */
export async function synthesizeSpeech(
  text: string,
  options: SynthesizeSpeechOptions = {},
): Promise<ArrayBuffer> {
  assertElevenLabsTtsConfigured();

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("TTS text is empty");
  }
  if (trimmed.length > MAX_TTS_INPUT_CHARS) {
    throw new Error(
      `TTS text exceeds maximum length (${MAX_TTS_INPUT_CHARS} characters)`,
    );
  }

  const apiKey = getElevenLabsApiKey()!;
  const voiceId = options.voiceId?.trim() || getElevenLabsVoiceId()!;

  const modelId = getElevenLabsModelId();
  const body: { text: string; model_id?: string } = { text: trimmed };
  if (modelId) {
    body.model_id = modelId;
  }

  const outputFormat = options.outputFormat ?? "mp3_44100_128";
  const url = new URL(
    `${ELEVENLABS_TTS_URL}/${encodeURIComponent(voiceId)}`,
  );
  url.searchParams.set("output_format", outputFormat);

  const accept =
    outputFormat === "ulaw_8000" ? "application/octet-stream" : "audio/mpeg";

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
      Accept: accept,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `ElevenLabs TTS failed (${response.status}): ${detail.slice(0, 200)}`,
    );
  }

  return response.arrayBuffer();
}
