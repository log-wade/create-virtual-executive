export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";
}

export function assertAnthropicKey(): void {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
}
