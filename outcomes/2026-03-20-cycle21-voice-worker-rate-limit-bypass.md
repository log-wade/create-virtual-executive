# Cycle 21 — Voice worker middleware rate-limit bypass

## Goal

Long-running **Media Streams** calls can burst **`POST /api/tts`** and **`POST /api/chat/complete`**, tripping the generic **Upstash sliding-window** limit (30 req/min per IP) when Redis is enabled. Exempt **authenticated** trusted workers only.

## Changes

- **`lib/internal/voice-worker-middleware-auth.ts`** (new) — **`isVoiceWorkerRequestAuthenticated`** for **Edge** middleware: UTF-8 timing-safe compare (no `node:crypto`), same semantics as **`verifyBearerSecret`** when **`INTERNAL_VOICE_WORKER_SECRET`**, **`X-Voice-Worker: 1`**, and Bearer match.
- **`middleware.ts`** — Before **`ratelimit.limit`**, if path is **`/api/tts`** or **`/api/chat/complete`** and authenticated worker, **`NextResponse.next()`** (no rate limit).
- **`docs/twilio-media-streams.md`**, **`.env.example`** — document behavior.

## Verification

- `pnpm lint`
- `pnpm build`

## Security

- No bypass when **`INTERNAL_VOICE_WORKER_SECRET`** is unset (workers look like normal browser traffic).
- Spoofing **`X-Voice-Worker`** alone does not bypass; Bearer must match.

## Review

- Self-review: PASS.
