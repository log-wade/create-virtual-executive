export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";
}

export function assertAnthropicKey(): void {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
}

/** ElevenLabs API key for server-side TTS (see `lib/voice/tts.ts`). */
export function getElevenLabsApiKey(): string | undefined {
  return process.env.ELEVENLABS_API_KEY?.trim() || undefined;
}

/**
 * Voice ID from the ElevenLabs dashboard (required for synthesis).
 * Example: a UUID from GET https://api.elevenlabs.io/v1/voices
 */
export function getElevenLabsVoiceId(): string | undefined {
  return process.env.ELEVENLABS_VOICE_ID?.trim() || undefined;
}

/** Optional; defaults inside ElevenLabs if omitted. */
export function getElevenLabsModelId(): string | undefined {
  return process.env.ELEVENLABS_MODEL_ID?.trim() || undefined;
}

/** Fail fast before calling TTS when keys are missing. */
export function assertElevenLabsTtsConfigured(): void {
  if (!getElevenLabsApiKey()) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }
  if (!getElevenLabsVoiceId()) {
    throw new Error("ELEVENLABS_VOICE_ID is not set");
  }
}

/**
 * Deepgram API key for server-side STT (Phase B4).
 * Optional until speech-input routes are enabled.
 */
export function getDeepgramApiKey(): string | undefined {
  return process.env.DEEPGRAM_API_KEY?.trim() || undefined;
}

export function assertDeepgramSttConfigured(): void {
  if (!getDeepgramApiKey()) {
    throw new Error("DEEPGRAM_API_KEY is not set");
  }
}
