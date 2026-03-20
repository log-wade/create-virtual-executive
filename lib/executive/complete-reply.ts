import { getAnthropic } from "@/lib/anthropic";
import { getAnthropicModel } from "@/lib/config";
import {
  buildChatSystemPrompt,
  loadPersonaPackage,
} from "@/lib/personas/store";

type ChatMessage = { role: "user" | "assistant"; content: string };

// Use complete replies for turn-based voice adapters (v1) that synthesize
// text after each model turn; chat UIs should use streamExecutiveReply().
export async function completeExecutiveReply(
  personaId: string,
  messages: ChatMessage[],
): Promise<string> {
  const pkg = await loadPersonaPackage(personaId);
  if (!pkg) {
    throw new Error("Persona not found");
  }

  const system = buildChatSystemPrompt(pkg);
  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: getAnthropicModel(),
    max_tokens: 4096,
    system,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}
