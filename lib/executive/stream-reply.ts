import { getAnthropic } from "@/lib/anthropic";
import { getAnthropicModel } from "@/lib/config";
import {
  buildChatSystemPrompt,
  loadPersonaPackage,
} from "@/lib/personas/store";

type ChatMessage = { role: "user" | "assistant"; content: string };

// Use streaming for web chat UIs so tokens can render as they arrive.
// Voice adapters can prefer completeExecutiveReply() for turn-level TTS chunking.
export async function streamExecutiveReply(
  personaId: string,
  messages: ChatMessage[],
): Promise<ReadableStream<Uint8Array>> {
  const pkg = await loadPersonaPackage(personaId);
  if (!pkg) {
    throw new Error("Persona not found");
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
  return new ReadableStream({
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
}
