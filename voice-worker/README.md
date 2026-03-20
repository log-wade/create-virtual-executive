# Voice worker (stub)

## Current MVP (no worker required)

Inbound calls can use **Twilio `<Gather input="speech">`**, which posts transcripts to the Next.js app:

| Route | Role |
|--------|------|
| `POST /api/twilio/voice` | Incoming call TwiML (prompt + gather) |
| `POST /api/twilio/voice/gather` | `SpeechResult` → `completeExecutiveReply` → `<Say>` reply (+ optional follow-up gather) |

Set on the server:

- `PUBLIC_BASE_URL` — public origin Twilio can reach (e.g. `https://your-app.vercel.app`), used for absolute `<Gather action="...">` URLs.
- `TWILIO_VOICE_PERSONA_ID` — existing persona id under `data/personas/`.
- `ANTHROPIC_API_KEY` — same as web chat.

In Twilio Console → Phone Numbers → your number → **A call comes in** → Webhook `POST` → `https://YOUR_HOST/api/twilio/voice`.

## This package

`server.mjs` runs an HTTP server plus a **WebSocket** listener that **parses Twilio Media Streams** JSON (`connected`, `start`, `media`, `mark`, `stop`) and logs frame counts. It does **not** yet decode μ-law, STT, or send outbound audio — see **[`docs/twilio-media-streams.md`](../docs/twilio-media-streams.md)** for TwiML wiring and next steps.

**Speech barge-in** for the Gather MVP lives in Next.js (`TWILIO_VOICE_BARGE_IN`). **Stream-level** TTS cancel / raw-audio pipelines belong here once you `<Connect><Stream>` to this worker.

Serverless is a poor fit for long WebSockets; deploy on Fly.io, Railway, etc.

```bash
pnpm install
pnpm start
```

Default port **8765** (`VOICE_WORKER_PORT`).

## Security (next steps)

- Twilio signatures and **CallSid + Upstash** multi-turn history are implemented on the Next.js app (`/api/twilio/voice*`). This worker remains for **Media Streams** audio.

## Session memory

Phone **conversation state** lives in **Upstash Redis** (`lib/twilio/call-conversation.ts`), not in this process.
