import { NextResponse } from "next/server";
import { MAX_TTS_INPUT_CHARS, synthesizeSpeech } from "@/lib/voice/tts";

export const maxDuration = 60;

type Body = {
  text?: string;
  /** Reserved for future per-persona voice routing; ignored for synthesis v1. */
  personaId?: string;
};

function isConfigError(message: string): boolean {
  return (
    message.includes("ELEVENLABS_API_KEY") ||
    message.includes("ELEVENLABS_VOICE_ID")
  );
}

export async function POST(req: Request) {
  try {
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

    const audio = await synthesizeSpeech(trimmed);

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
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
