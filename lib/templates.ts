import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type IndustryTemplate = {
  id: string;
  industry: string;
  role_archetype: string;
  seniority: string;
  decision_culture: string;
  communication_pattern: string;
  guardrail_emphasis: string;
  starter_user_prompt: string;
};

export async function loadTemplates(): Promise<IndustryTemplate[]> {
  const path = join(process.cwd(), "content/templates/templates.json");
  const raw = await readFile(path, "utf8");
  const data = JSON.parse(raw) as IndustryTemplate[];
  if (!Array.isArray(data)) return [];
  return data;
}

export function formatTemplateForPrompt(t: IndustryTemplate): string {
  return [
    `Industry: ${t.industry}`,
    `Role archetype: ${t.role_archetype}`,
    `Seniority band: ${t.seniority}`,
    `Decision culture: ${t.decision_culture}`,
    `Communication pattern: ${t.communication_pattern}`,
    `Guardrail emphasis: ${t.guardrail_emphasis}`,
    `Starter brief (use as tone/grounding; expand as needed): ${t.starter_user_prompt}`,
  ].join("\n");
}
