# Cycle 10 — Phone CallSid conversation memory (Upstash)

## Summary

- **`lib/twilio/call-conversation.ts`** — Load/save/clear `PhoneChatMessage[]` in Redis under `cve:twilio:call:{CallSid}` with TTL (`PHONE_CALL_SESSION_TTL_SECONDS`, default 24h) and tail cap (`PHONE_CALL_MAX_MESSAGES`, default 40). Uses existing **`UPSTASH_REDIS_*`** (same as rate limiting). No Redis → gather behaves as before (single-utterance context only).
- **`app/api/twilio/voice/gather/route.ts`** — After valid speech, merges **prior** messages + user line, calls `completeExecutiveReply`, persists **user + assistant** turns when `CallSid` is present and Redis is configured.
- **`app/api/twilio/voice/status/route.ts`** — Optional Twilio **call status** webhook; deletes session key on terminal `CallStatus` values (`completed`, `failed`, `busy`, `no-answer`, `canceled`). Signature-checked like other Twilio routes; excluded from API rate limit via `/api/twilio/` prefix.

## Verification

- `pnpm lint` — PASS
- `pnpm build` — PASS

## Review

- **PASS** for D1-hardening scope; D2 (media streams / barge-in) still open.

## Ops notes

- Configure **Call status changes** in Twilio for early cleanup; otherwise **TTL** still expires keys.
- Ensure **Upstash** is enabled wherever phone multi-turn is required (e.g. production); local dev may omit Redis for simpler testing.
