import { NextResponse } from "next/server";
import { MAX_STT_AUDIO_BYTES, transcribeAudio } from "@/lib/voice/stt";

export const maxDuration = 60;

function isDeepgramConfigError(message: string): boolean {
  return message.includes("DEEPGRAM_API_KEY");
}

export async function POST(req: Request) {
  try {
    const headerCt = req.headers.get("content-type") || "";
    if (!headerCt.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("audio");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing multipart field \"audio\" (File)" },
        { status: 400 },
      );
    }

    if (file.size > MAX_STT_AUDIO_BYTES) {
      return NextResponse.json(
        {
          error: `Audio exceeds maximum size (${MAX_STT_AUDIO_BYTES} bytes)`,
        },
        { status: 413 },
      );
    }

    const buf = await file.arrayBuffer();
    const mime = file.type || "application/octet-stream";
    const transcript = await transcribeAudio(buf, mime);

    return NextResponse.json({ transcript });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "STT failed";
    if (isDeepgramConfigError(msg)) {
      return NextResponse.json(
        { error: "Speech transcription is not configured on the server" },
        { status: 503 },
      );
    }
    if (msg === "Audio is empty") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg.startsWith("Audio exceeds maximum size")) {
      return NextResponse.json({ error: msg }, { status: 413 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
