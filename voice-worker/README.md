# Voice worker (Media Streams)

When **`INTERNAL_VOICE_WORKER_SECRET`** is set on the Next app, the worker’s **`POST /api/tts`** and **`POST /api/chat/complete`** calls skip the **generic** IP rate limit (`middleware.ts`) so long calls are not 429’d for burst TTS/completions.

**Health:** `GET /health` (or **`VOICE_WORKER_HEALTH_PATH`**) returns JSON for probes. **Deduping:** **`VOICE_STREAM_FINAL_DEDUPE_MS`** drops repeated / shorter-prefix finals from Deepgram within a time window (case- and whitespace-normalized).

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

`server.mjs` runs HTTP + **WebSocket** for Twilio **Media Streams**. It decodes inbound **μ-law** and, by default, streams **linear16 @ 8 kHz** to **Deepgram live** (`deepgram-live.mjs`); finals enqueue **`POST /api/chat/complete`** → **`POST /api/tts`** (`ulaw_8000`) → outbound **`media`** (~20 ms). Use **`VOICE_STREAM_STT_MODE=rest`** for the older batched HTTP STT. See **[`docs/twilio-media-streams.md`](../docs/twilio-media-streams.md)** for env vars (`APP_BASE_URL`, `DEEPGRAM_API_KEY`, …).

**Speech barge-in** for the Gather MVP lives in Next.js (`TWILIO_VOICE_BARGE_IN`). With **Upstash** on the Next app, the worker passes **`callSid`** into **`/api/chat/complete`** so **Gather and Media Streams share the same conversation** (`lib/twilio/call-conversation.ts`). **Media Streams barge-in** (`VOICE_STREAM_BARGE_IN`, default on) stops sending outbound μ-law when inbound frames show speech energy after a grace window — tune **`VOICE_STREAM_BARGE_IN_PCM_THRESHOLD`** if needed.

**Deepgram live reconnect:** if the STT WebSocket drops mid-call, the worker schedules **exponential backoff** reconnects (see **`VOICE_STREAM_DG_RECONNECT_*`**). Twilio **`stop`** / worker disconnect sets an **intentional** shutdown so stale sockets do not respawn.

**Half-duplex STT (default):** inbound audio is **not** sent to Deepgram while assistant μ-law is playing; **barge-in** re-enables forwarding. Use **`VOICE_STREAM_STT_DUPLEX=full`** if you need full duplex (more echo risk).

**Post-playback tail:** after TTS finishes **without** barge-in, STT ingress stays off for **`VOICE_STREAM_POST_PLAYBACK_STT_TAIL_MS`** (default 280 ms). Barge-in clears this so the caller is not gated.

Serverless is a poor fit for long WebSockets; deploy on Fly.io, Railway, etc.

```bash
pnpm install
pnpm start
```

Default port **8765** (`VOICE_WORKER_PORT`).

## Security

- Optional **query token**: `TWILIO_MEDIA_STREAM_SECRET` → connect only with `wss://…?token=…`.
- Optional **app auth**: set `INTERNAL_VOICE_WORKER_SECRET` on Next **and** this worker; worker sends `X-Voice-Worker: 1` + `Authorization: Bearer …`.
- Twilio **HTTP** webhooks still use **X-Twilio-Signature** on `/api/twilio/voice*` in the Next app.

## Session memory

Phone **conversation state** lives in **Upstash Redis** (`lib/twilio/call-conversation.ts`), not in this process.
