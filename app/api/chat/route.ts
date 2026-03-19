import { assertAnthropicKey, getAnthropicModel } from "@/lib/config";
import { getAnthropic } from "@/lib/anthropic";
import {
  buildChatSystemPrompt,
  loadPersonaPackage,
} from "@/lib/personas/store";

export const maxDuration = 120;

type ChatMessage = { role: "user" | "assistant"; content: string };

type Body = {
  personaId?: string;
  messages?: ChatMessage[];
};

export async function POST(req: Request) {
  try {
    assertAnthropicKey();
    const body = (await req.json()) as Body;
    const personaId = body.personaId?.trim();
    const messages = body.messages;
    if (!personaId) {
      return new Response(JSON.stringify({ error: "personaId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const pkg = await loadPersonaPackage(personaId);
    if (!pkg) {
      return new Response(JSON.stringify({ error: "Persona not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const system = buildChatSystemPrompt(pkg);
    const anthropic = getAnthropic();

    const stream = anthropic.messages.stream({
      model: getAnthropicModel(),
      max_tokens: 4096,
      system,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chat failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
