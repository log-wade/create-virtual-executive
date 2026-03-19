import { NextResponse } from "next/server";

import { getAnthropic, messageTextContent } from "@/lib/anthropic";
import { assertAnthropicKey, getAnthropicModel } from "@/lib/config";
import { extractJsonObject } from "@/lib/json";
import { buildGenerationSystemPrompt } from "@/lib/prompts/generation-system";
import {
  coercePackage,
  validatePersonaPackage,
} from "@/lib/personas/validate";
import { savePersonaPackage } from "@/lib/personas/store";
import {
  formatTemplateForPrompt,
  loadTemplates,
} from "@/lib/templates";

export const maxDuration = 300;

type Body = {
  description?: string;
  templateId?: string | null;
};

async function runGeneration(userContent: string): Promise<string> {
  assertAnthropicKey();
  const anthropic = getAnthropic();
  const res = await anthropic.messages.create({
    model: getAnthropicModel(),
    max_tokens: 16384,
    system: buildGenerationSystemPrompt(),
    messages: [{ role: "user", content: userContent }],
  });
  return messageTextContent(res);
}

function buildUserContent(description: string, templateBlock: string): string {
  return `## User brief

${description.trim()}

${templateBlock}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const description = body.description?.trim();
    if (!description || description.length < 20) {
      return NextResponse.json(
        { error: "Description must be at least 20 characters." },
        { status: 400 },
      );
    }

    let templateBlock = "";
    if (body.templateId) {
      const templates = await loadTemplates();
      const t = templates.find((x) => x.id === body.templateId);
      if (t) {
        templateBlock = `## Industry template context\n\n${formatTemplateForPrompt(t)}`;
      }
    }

    const userContent = buildUserContent(description, templateBlock);
    let text: string;
    try {
      text = await runGeneration(userContent);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    let pkgRaw: unknown;
    try {
      pkgRaw = extractJsonObject(text);
    } catch {
      try {
        text = await runGeneration(
          `${userContent}\n\n## Repair\nYour previous output was not valid JSON. Reply with only a valid JSON object and nothing else.`,
        );
        pkgRaw = extractJsonObject(text);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid JSON from model";
        return NextResponse.json({ error: msg }, { status: 422 });
      }
    }

    const pkg = coercePackage(pkgRaw);
    if (!pkg) {
      return NextResponse.json(
        { error: "JSON missing required persona file keys." },
        { status: 422 },
      );
    }

    const validation = validatePersonaPackage(pkg);
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 422 },
      );
    }

    const meta = await savePersonaPackage(pkg);
    return NextResponse.json({ meta });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
