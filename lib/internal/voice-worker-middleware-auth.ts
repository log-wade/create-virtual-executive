/**
 * Edge-safe auth check for **middleware** (no `node:crypto`).
 * Must stay in sync with `verifyBearerSecret` semantics in `lib/admin/verify-bearer-secret.ts`.
 */
function timingSafeEqualUtf8(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < ba.length; i++) {
    out |= ba[i]! ^ bb[i]!;
  }
  return out === 0;
}

/**
 * True when `INTERNAL_VOICE_WORKER_SECRET` is set, `X-Voice-Worker: 1`, and Bearer matches.
 */
export function isVoiceWorkerRequestAuthenticated(req: {
  headers: Headers;
}): boolean {
  const secret = process.env.INTERNAL_VOICE_WORKER_SECRET?.trim();
  if (!secret) return false;
  if (req.headers.get("x-voice-worker")?.trim() !== "1") return false;
  const authorizationHeader = req.headers.get("authorization");
  const prefix = "Bearer ";
  if (!authorizationHeader?.startsWith(prefix)) return false;
  const token = authorizationHeader.slice(prefix.length);
  return timingSafeEqualUtf8(token, secret);
}
