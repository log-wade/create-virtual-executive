import { assertAnthropicKey } from "@/lib/config";
import { completeExecutiveReply } from "@/lib/executive/complete-reply";
import { voiceWorkerUnauthorized } from "@/lib/internal/voice-worker-auth";
import {
  getCallMessages,
  getCallPersona,
  setCallMessages,
} from "@/lib/twilio/call-conversation";

export const maxDuration = 120;

type ChatMessage = { role: "user" | "assistant"; content: string };

type Body = {
  personaId?: string;
  messages?: ChatMessage[];
  /**
   * Twilio Call SID. When set, prior turns are loaded from Upstash (same keys as
   * `/api/twilio/voice/gather`), `messages` are **appended**, and the full thread +
   * assistant reply are persisted. Requires `X-Voice-Worker: 1`.
   */
  callSid?: string;
};

/**
 * Non-streaming chat completion for phone / voice workers.
 * Prefer `POST /api/chat` + streaming for web clients.
 */
export async function POST(req: Request) {
  try {
    const denied = voiceWorkerUnauthorized(req);
    if (denied) return denied;

    assertAnthropicKey();
    const body = (await req.json()) as Body;
    const callSid = body.callSid?.trim() ?? "";
    if (callSid && req.headers.get("x-voice-worker")?.trim() !== "1") {
      return Response.json(
        { error: "callSid is only accepted with X-Voice-Worker: 1" },
        { status: 400 },
      );
    }

    let personaId = body.personaId?.trim() ?? "";
    const incoming = body.messages;

    if (callSid && !personaId) {
      personaId = (await getCallPersona(callSid)) ?? "";
    }

    if (!personaId) {
      return Response.json({ error: "personaId required" }, { status: 400 });
    }
    if (!incoming || !Array.isArray(incoming) || incoming.length === 0) {
      return Response.json({ error: "messages required" }, { status: 400 });
    }

    for (const m of incoming) {
      if (
        !m ||
        (m.role !== "user" && m.role !== "assistant") ||
        typeof m.content !== "string"
      ) {
        return Response.json({ error: "invalid messages shape" }, { status: 400 });
      }
    }

    let thread: ChatMessage[] = incoming;
    if (callSid) {
      const prior = await getCallMessages(callSid);
      thread = [...prior, ...incoming];
    }

    const text = await completeExecutiveReply(personaId, thread);

    if (callSid) {
      await setCallMessages(
        callSid,
        [...thread, { role: "assistant", content: text }],
        { personaId },
      );
    }

    return Response.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Completion failed";
    if (msg === "Persona not found") {
      return Response.json({ error: msg }, { status: 404 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
