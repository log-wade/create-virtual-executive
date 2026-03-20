import { assertAnthropicKey } from "@/lib/config";
import { completeExecutiveReply } from "@/lib/executive/complete-reply";

export const maxDuration = 120;

type ChatMessage = { role: "user" | "assistant"; content: string };

type Body = {
  personaId?: string;
  messages?: ChatMessage[];
};

/**
 * Non-streaming chat completion for phone / voice workers.
 * Prefer `POST /api/chat` + streaming for web clients.
 */
export async function POST(req: Request) {
  try {
    assertAnthropicKey();
    const body = (await req.json()) as Body;
    const personaId = body.personaId?.trim();
    const messages = body.messages;

    if (!personaId) {
      return Response.json({ error: "personaId required" }, { status: 400 });
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages required" }, { status: 400 });
    }

    for (const m of messages) {
      if (
        !m ||
        (m.role !== "user" && m.role !== "assistant") ||
        typeof m.content !== "string"
      ) {
        return Response.json({ error: "invalid messages shape" }, { status: 400 });
      }
    }

    const text = await completeExecutiveReply(personaId, messages);
    return Response.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Completion failed";
    if (msg === "Persona not found") {
      return Response.json({ error: msg }, { status: 404 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
