# Cycle 15 — Media Streams + Upstash call memory

## Goal

Reuse **Twilio `CallSid`** conversation state from **`lib/twilio/call-conversation.ts`** when the **Media Streams** worker completes a turn, so **Gather** and **Stream** paths can share multi-turn history when Upstash is configured.

## Changes

- **`app/api/chat/complete/route.ts`**
  - Optional body field **`callSid`** (Twilio `CallSid`).
  - Requires **`X-Voice-Worker: 1`** whenever `callSid` is set (blocks arbitrary browser use of `callSid`).
  - Loads **`getCallMessages`**, appends **`messages`** from the body (incremental turns), runs **`completeExecutiveReply`**, then **`setCallMessages`** with the assistant reply + **`personaId`** (and restores **`personaId`** via **`getCallPersona`** when omitted on later turns).
- **`voice-worker/server.mjs`** — passes **`callSid`** from the `start` event into **`completeChat`** → JSON body to Next.
- **Docs** — `docs/twilio-media-streams.md`, `voice-worker/README.md`, `context.md`.

## Verification

- `pnpm lint`
- `pnpm build`

## Notes

- If **`UPSTASH_REDIS_*`** is unset on Next, **`callSid`** is accepted but merge/persist no-ops (same as Gather without Redis).
- **`/api/twilio/voice/status`** still clears keys on call end when that webhook is configured.

## Review

- Self-review: PASS for scope; production should set **`INTERNAL_VOICE_WORKER_SECRET`** so worker → Next calls are authenticated.
