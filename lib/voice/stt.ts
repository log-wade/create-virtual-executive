import { assertDeepgramSttConfigured, getDeepgramApiKey } from "@/lib/config";

/** Max upload size for a single STT request (multipart `audio` field). */
export const MAX_STT_AUDIO_BYTES = 5 * 1024 * 1024;

const DEEPGRAM_LISTEN_URL = "https://api.deepgram.com/v1/listen";

/**
 * Transcribe a short prerecorded clip via Deepgram (server-only).
 * `contentType` should match the uploaded blob (e.g. `audio/webm` from MediaRecorder).
 */
export async function transcribeAudio(
  audio: ArrayBuffer,
  contentType: string,
): Promise<string> {
  assertDeepgramSttConfigured();

  if (audio.byteLength === 0) {
    throw new Error("Audio is empty");
  }
  if (audio.byteLength > MAX_STT_AUDIO_BYTES) {
    throw new Error(
      `Audio exceeds maximum size (${MAX_STT_AUDIO_BYTES} bytes)`,
    );
  }

  const key = getDeepgramApiKey()!;
  const params = new URLSearchParams({
    model: "nova-2",
    smart_format: "true",
  });
  const url = `${DEEPGRAM_LISTEN_URL}?${params.toString()}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": contentType.trim() || "application/octet-stream",
    },
    body: audio,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Deepgram STT failed (${response.status}): ${detail.slice(0, 200)}`,
    );
  }

  const json = (await response.json()) as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{ transcript?: string }>;
      }>;
    };
  };

  return (
    json.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? ""
  );
}
