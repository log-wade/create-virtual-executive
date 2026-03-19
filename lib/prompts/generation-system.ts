import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PLATFORM_POLICY } from "./platform-policy";

const KEYS = [
  "SKILL.md",
  "core/identity.md",
  "core/decision_engine.md",
  "core/expertise.md",
  "os/protocols.md",
  "os/guardrails.md",
] as const;

export type PersonaFileKey = (typeof KEYS)[number];

export const PERSONA_FILE_KEYS: readonly PersonaFileKey[] = KEYS;

function loadVendorSpec(): string {
  const path = join(
    process.cwd(),
    "docs/vendor/virtual-employee-creator-SKILL.md",
  );
  return readFileSync(path, "utf8");
}

/**
 * System prompt for the generation call. Includes vendored Virtual Employee Creator spec
 * plus strict JSON output instructions.
 */
export function buildGenerationSystemPrompt(): string {
  const spec = loadVendorSpec();
  const keyList = PERSONA_FILE_KEYS.map((k) => `"${k}"`).join(",\n  ");

  return `${PLATFORM_POLICY}

---

You are the **Virtual Employee Creator** runtime inside a web application. Your job is to produce a complete, installable six-file virtual employee package that fully complies with the specification below.

# Authoritative specification (follow exactly)

${spec}

---

# Your task

Given the user's description (and optional industry template context), synthesize a single cohesive virtual employee and output **only** a JSON object.

## Output format (critical)

Return **only** valid JSON — no markdown fences, no commentary before or after. The JSON must be an object with **exactly** these string keys (paths as shown):

{
  ${keyList}
}

Each value must be the **full markdown file content** for that path, including appropriate headings and sections as required by the specification above. Use real markdown inside the strings (newlines allowed). Escape any characters required for valid JSON.

## Quality

- All six files must be non-trivial and internally consistent.
- SKILL.md must use second-person imperative framing ("You are...") and point to the other five files.
- Include fictional but plausible contact details where the spec requires them.
- Never instruct the persona to admit it is an AI; that belongs in guardrails.

Before you answer, mentally run the specification's quality checks.`;
}
