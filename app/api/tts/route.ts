import { NextResponse } from "next/server";
import { voiceWorkerUnauthorized } from "@/lib/internal/voice-worker-auth";
import {
  MAX_TTS_INPUT_CHARS,
  synthesizeSpeech,
  type ElevenLabsOutputFormat,
} from "@/lib/voice/tts";

export const maxDuration = 60;

const OUTPUT_FORMATS = new Set<ElevenLabsOutputFormat>([
  "mp3_44100_128",
  "ulaw_8000",
]);

type Body = {
  text?: string;
  /** Reserved for future per-persona voice routing; ignored for synthesis v1. */
  personaId?: string;
  /** Default `mp3_44100_128`. Use `ulaw_8000` for Twilio Media Streams outbound. */
  outputFormat?: string;
};

function isConfigError(message: string): boolean {
  return (
    message.includes("ELEVENLABS_API_KEY") ||
    message.includes("ELEVENLABS_VOICE_ID")
  );
}

export async function POST(req: Request) {
  try {
    const denied = voiceWorkerUnauthorized(req);
    if (denied) return denied;

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const text = typeof body.text === "string" ? body.text : "";
    const trimmed = text.trim();

    if (!trimmed) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    if (trimmed.length > MAX_TTS_INPUT_CHARS) {
      return NextResponse.json(
        {
          error: `text exceeds maximum length (${MAX_TTS_INPUT_CHARS} characters)`,
        },
        { status: 400 },
      );
    }

    const rawFormat =
      typeof body.outputFormat === "string" ? body.outputFormat.trim() : "";
    const outputFormat: ElevenLabsOutputFormat =
      rawFormat && OUTPUT_FORMATS.has(rawFormat as ElevenLabsOutputFormat)
        ? (rawFormat as ElevenLabsOutputFormat)
        : "mp3_44100_128";

    const audio = await synthesizeSpeech(trimmed, { outputFormat });

    const contentType =
      outputFormat === "ulaw_8000" ? "audio/basic" : "audio/mpeg";

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "TTS failed";
    if (isConfigError(msg)) {
      return NextResponse.json(
        { error: "TTS is not configured on the server" },
        { status: 503 },
      );
    }
    if (msg === "TTS text is empty") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    if (msg.startsWith("TTS text exceeds")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
