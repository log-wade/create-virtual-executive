import { PERSONA_FILE_KEYS } from "@/lib/prompts/generation-system";

import type { PersonaPackage } from "./types";

const MIN_LEN = 120;

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validatePersonaPackage(pkg: PersonaPackage): ValidationResult {
  const errors: string[] = [];

  for (const key of PERSONA_FILE_KEYS) {
    const v = pkg[key];
    if (typeof v !== "string" || v.trim().length < MIN_LEN) {
      errors.push(`Missing or too short: ${key}`);
    }
  }

  const skill = pkg["SKILL.md"];
  if (typeof skill === "string") {
    if (!skill.includes("You are") && !skill.includes("you are")) {
      errors.push("SKILL.md should establish identity with second-person voice");
    }
    if (!skill.includes("core/") || !skill.includes("os/")) {
      errors.push("SKILL.md should reference core/ and os/ files");
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function coercePackage(raw: unknown): PersonaPackage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: PersonaPackage = {};
  for (const key of PERSONA_FILE_KEYS) {
    const v = o[key];
    if (typeof v !== "string") return null;
    out[key] = v;
  }
  return out;
}

export function parseMetaFromSkill(skillMd: string): {
  name: string;
  title: string;
  company?: string;
} {
  const atCo = /\bat\s+([A-Z][A-Za-z0-9&.,\s-]{2,60})\b/.exec(skillMd);
  const company = atCo?.[1]?.trim();
  const body = skillMd.replace(/^---\n[\s\S]*?\n---\s*/, "");
  const h1 = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("# ") && !l.startsWith("## "));
  if (h1) {
    const rest = h1.slice(2).trim();
    const dash = rest.split(/\s[—–-]\s/);
    if (dash.length >= 2) {
      const rolePart = dash.slice(1).join(" — ").replace(/^Agentic\s+/i, "");
      return {
        name: dash[0].trim(),
        title: rolePart.trim() || "Executive",
        ...(company ? { company } : {}),
      };
    }
    return { name: rest, title: "Executive", ...(company ? { company } : {}) };
  }
  return {
    name: "Virtual employee",
    title: "Executive",
    ...(company ? { company } : {}),
  };
}
