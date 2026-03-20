# Cycle 14 — Media Streams audio pipeline (E2E prototype)

## Goal

Close the loop on Twilio **bi-directional** Media Streams: decode inbound μ-law, run **STT**, call **`POST /api/chat/complete`**, synthesize **μ-law** for Twilio, and send outbound **`media`** frames.

## Changes

- **`voice-worker/mulaw.mjs`** — G.711 μ-law → linear16 LE @ 8 kHz.
- **`voice-worker/server.mjs`** — Buffer PCM; periodic flush + `stop` flush; Deepgram REST (`encoding=linear16`, `sample_rate=8000`); Next **`/api/chat/complete`** + **`/api/tts`** with `outputFormat: "ulaw_8000"`; outbound chunks (160 bytes, ~20 ms). Optional **`?token=`** WebSocket gate; **`personaId`** from `start.customParameters` or `TWILIO_VOICE_PERSONA_ID`.
- **`lib/voice/tts.ts`** — `outputFormat` (`mp3_44100_128` | `ulaw_8000`) via ElevenLabs query param.
- **`app/api/tts/route.ts`** — `body.outputFormat`; `Content-Type: audio/basic` for μ-law.
- **`lib/internal/voice-worker-auth.ts`** — If `INTERNAL_VOICE_WORKER_SECRET` is set, require Bearer **only** when `X-Voice-Worker: 1` (browser clients unchanged).
- **`app/api/chat/complete/route.ts`** — Same optional worker auth.
- **Docs** — `docs/twilio-media-streams.md`, `voice-worker/README.md`, root `README.md`, `.env.example`, `context.md`.

## Verification

- `pnpm lint`
- `pnpm build`

## Limitations / follow-ups

- **Batch STT** on a timer (not true streaming recognition); may merge/split utterances awkwardly.
- **No Upstash history** in the worker path — each flush is effectively a single user turn unless extended.
- **No barge-in** while outbound audio is playing; TTS runs to completion for each flush.
- **ElevenLabs + Deepgram** keys must be valid on the Next app and worker env respectively; live call testing required.

## Review

- Self-review: PASS for scoped prototype; production needs rate limits, observability, and stream-level session design.
