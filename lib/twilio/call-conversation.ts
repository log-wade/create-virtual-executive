import { Redis } from "@upstash/redis";

const KEY_PREFIX = "cve:twilio:call:";
const PERSONA_KEY_PREFIX = "cve:twilio:call-persona:";

export type PhoneChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function getRedis(): Redis | null {
  if (
    !process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    !process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  ) {
    return null;
  }
  return Redis.fromEnv();
}

function callKey(callSid: string): string {
  return `${KEY_PREFIX}${callSid}`;
}

function callPersonaKey(callSid: string): string {
  return `${PERSONA_KEY_PREFIX}${callSid}`;
}

function sessionTtlSeconds(): number {
  const raw = process.env.PHONE_CALL_SESSION_TTL_SECONDS?.trim();
  const n = raw ? Number(raw) : 86400;
  return Number.isFinite(n) && n > 60 ? Math.floor(n) : 86400;
}

function maxMessages(): number {
  const raw = process.env.PHONE_CALL_MAX_MESSAGES?.trim();
  const n = raw ? Number(raw) : 40;
  return Number.isFinite(n) && n >= 4 ? Math.floor(n) : 40;
}

function parseMessages(raw: unknown): PhoneChatMessage[] {
  if (raw == null) return [];
  let arr: unknown;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  } else {
    arr = raw;
  }
  if (!Array.isArray(arr)) return [];
  const out: PhoneChatMessage[] = [];
  for (const item of arr) {
    if (
      item &&
      typeof item === "object" &&
      "role" in item &&
      "content" in item &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string"
    ) {
      out.push({ role: item.role, content: item.content });
    }
  }
  return out;
}

/** True when Upstash env is present (same credentials as API rate limiting). */
export function isPhoneConversationStoreConfigured(): boolean {
  return getRedis() !== null;
}

export async function getCallMessages(
  callSid: string,
): Promise<PhoneChatMessage[]> {
  const redis = getRedis();
  if (!redis || !callSid) return [];
  const raw = await redis.get(callKey(callSid));
  return parseMessages(raw);
}

export async function setCallMessages(
  callSid: string,
  messages: PhoneChatMessage[],
  options?: { personaId?: string },
): Promise<void> {
  const redis = getRedis();
  if (!redis || !callSid) return;

  const max = maxMessages();
  let next = messages;
  if (next.length > max) {
    next = next.slice(next.length - max);
  }

  const ex = sessionTtlSeconds();
  await redis.set(callKey(callSid), JSON.stringify(next), { ex });

  if (options?.personaId?.trim()) {
    await redis.set(callPersonaKey(callSid), options.personaId.trim(), {
      ex,
    });
  }
}

export async function setCallPersona(
  callSid: string,
  personaId: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis || !callSid || !personaId.trim()) return;
  await redis.set(callPersonaKey(callSid), personaId.trim(), {
    ex: sessionTtlSeconds(),
  });
}

export async function getCallPersona(
  callSid: string,
): Promise<string | null> {
  const redis = getRedis();
  if (!redis || !callSid) return null;
  const v = await redis.get(callPersonaKey(callSid));
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function clearCallMessages(callSid: string): Promise<void> {
  const redis = getRedis();
  if (!redis || !callSid) return;
  await redis.del(callKey(callSid), callPersonaKey(callSid));
}
