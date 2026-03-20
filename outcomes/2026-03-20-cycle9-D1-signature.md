# Cycle 9 — D1 follow-up: Twilio webhook signatures

## Context

Base D1 shipped in cycle 8 (`/api/chat/complete`, Twilio Gather routes, `voice-worker` stub). This pass completes deferred **webhook authentication**.

## Changes

- **`lib/twilio/validate-signature.ts`** — `getTwilioSignatureUrl` (uses `PUBLIC_BASE_URL` + request path/query, normalizes default ports), `formDataToParamRecord`, HMAC-SHA1 + `timingSafeEqual`, `isTwilioWebhookAuthentic` (skips check if `TWILIO_AUTH_TOKEN` unset for local dev).
- **`app/api/twilio/voice/route.ts`** — Parse `formData`, validate signature, then TwiML.
- **`app/api/twilio/voice/gather/route.ts`** — Validate after parsing form, before business logic.
- **`.env.example`**, **`README.md`** — `TWILIO_AUTH_TOKEN` documented.

## Verification

- `pnpm lint` — PASS
- `pnpm build` — PASS

## Still open (D1-hardening)

- **CallSid-scoped message history** for multi-turn phone chat (use Redis/Upstash on serverless).
