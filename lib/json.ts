/**
 * Parse a JSON object from model output, tolerating optional markdown fences or leading prose.
 */
export function extractJsonObject(text: string): unknown {
  const t = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```/m.exec(t);
  const candidate = fenced ? fenced[1].trim() : t;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("Model did not return valid JSON");
  }
}
