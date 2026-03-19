import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

import { PERSONA_FILE_KEYS } from "@/lib/prompts/generation-system";
import { PLATFORM_POLICY } from "@/lib/prompts/platform-policy";

import { getIndexPath, getPersonaDir, getPersonasRoot } from "./paths";
import { parseMetaFromSkill } from "./validate";
import type { PersonaIndexFile, PersonaMeta, PersonaPackage } from "./types";

async function ensurePersonasRoot(): Promise<void> {
  await mkdir(getPersonasRoot(), { recursive: true });
}

export async function readIndex(): Promise<PersonaIndexFile> {
  try {
    const raw = await readFile(getIndexPath(), "utf8");
    const data = JSON.parse(raw) as PersonaIndexFile;
    if (!data.personas || !Array.isArray(data.personas)) {
      return { personas: [] };
    }
    return data;
  } catch {
    return { personas: [] };
  }
}

async function writeIndex(index: PersonaIndexFile): Promise<void> {
  await ensurePersonasRoot();
  await writeFile(getIndexPath(), JSON.stringify(index, null, 2), "utf8");
}

export async function listPersonas(): Promise<PersonaMeta[]> {
  const { personas } = await readIndex();
  return [...personas].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getPersonaMeta(id: string): Promise<PersonaMeta | null> {
  const { personas } = await readIndex();
  return personas.find((p) => p.id === id) ?? null;
}

export async function loadPersonaPackage(id: string): Promise<PersonaPackage | null> {
  const base = getPersonaDir(id);
  const out: PersonaPackage = {};
  try {
    for (const key of PERSONA_FILE_KEYS) {
      const full = join(base, key);
      const text = await readFile(full, "utf8");
      out[key] = text;
    }
    return out;
  } catch {
    return null;
  }
}

export async function savePersonaPackage(
  pkg: PersonaPackage,
): Promise<PersonaMeta> {
  await ensurePersonasRoot();
  const id = randomUUID();
  const base = getPersonaDir(id);
  const skill = pkg["SKILL.md"];
  const { name, title, company } = parseMetaFromSkill(skill);
  for (const key of PERSONA_FILE_KEYS) {
    const full = join(base, key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, pkg[key], "utf8");
  }
  const meta: PersonaMeta = {
    id,
    name,
    title,
    company,
    createdAt: new Date().toISOString(),
    userId: null,
  };
  const index = await readIndex();
  index.personas.push(meta);
  await writeIndex(index);
  return meta;
}

export function buildChatSystemPrompt(pkg: PersonaPackage): string {
  const order = [
    "SKILL.md",
    "core/identity.md",
    "core/decision_engine.md",
    "core/expertise.md",
    "os/protocols.md",
    "os/guardrails.md",
  ] as const;
  const blocks = order.map(
    (k) => `### File: ${k}\n\n${pkg[k]?.trim() ?? ""}`,
  );
  return `${PLATFORM_POLICY}

---

You are the virtual employee defined by the following skill package. **Fully embody** this person at all times in this chat. Never state that you are an AI, language model, bot, or assistant. Obey all guardrails and deference rules in the materials below. When you need operational detail, rely on the cited files as your source of truth.

${blocks.join("\n\n---\n\n")}`;
}

// Avoid require — use import at top