# Twilio Media Streams (experimental)

The Next.js app handles **Gather + Say** voice UX. **Media Streams** send **raw audio** (μ-law base64 in JSON) over a **WebSocket** so a long-lived worker can run STT/TTS without serverless timeouts.

## Worker in this repo

`voice-worker/server.mjs` implements an **end-to-end prototype** on a bi-directional stream:

1. Decodes inbound **μ-law** → **linear16** @ 8 kHz (see `voice-worker/mulaw.mjs`).
2. **STT (default):** opens a **Deepgram live WebSocket** on stream `start` and forwards PCM frames; finals drive assistant turns. Set **`VOICE_STREAM_STT_MODE=rest`** to use batched **HTTP** `/v1/listen` on an interval + **`stop`** instead.
3. On a non-empty transcript, calls **`POST {APP_BASE_URL}/api/chat/complete`** with `{ personaId, messages: [{ role: "user", content }], callSid }` when Twilio provides **`CallSid`** in the `start` event. The Next route merges **Upstash** history using the same keys as **`/api/twilio/voice/gather`** (`lib/twilio/call-conversation.ts`) and persists the assistant reply after each turn (requires **`UPSTASH_REDIS_*`** on the Next deployment).
4. Synthesizes the reply via **`POST {APP_BASE_URL}/api/tts`** with `{ text, outputFormat: "ulaw_8000" }` (ElevenLabs μ-law @ 8 kHz).
5. Streams outbound **`media`** JSON frames (160-byte μ-law chunks, ~20 ms pacing) back to Twilio.
6. **Barge-in (default on):** while outbound audio is playing, inbound μ-law is decoded per frame; if peak PCM energy exceeds a threshold **after** a short grace period (`VOICE_STREAM_BARGE_IN_GRACE_MS`), remaining outbound chunks are **not** sent. Set `VOICE_STREAM_BARGE_IN=false` to disable.
7. **Half-duplex STT (default):** while assistant TTS is playing, inbound PCM is **not** forwarded to Deepgram (reduces echo). After **barge-in** (`outboundAbortPlayback`), forwarding resumes. Set **`VOICE_STREAM_STT_DUPLEX=full`** to always send audio to Deepgram.
8. **Post-playback STT tail:** after playback **completes normally** (not barge-in), inbound PCM stays blocked for **`VOICE_STREAM_POST_PLAYBACK_STT_TAIL_MS`** (default 280, `0` = off) when half-duplex is on—drops room/speaker **echo tail**. Barge-in clears the tail so caller speech is not muted.

```bash
cd voice-worker && pnpm install && pnpm start
```

Default port **8765** (`VOICE_WORKER_PORT`). Expose **wss://** publicly (ngrok, Fly.io, Railway).

**Health check:** `GET /health` (override with `VOICE_WORKER_HEALTH_PATH`) returns JSON: `ok`, `sttMode`, `deepgramConfigured`, `appBaseConfigured` — for load balancers and deploy probes.

### Worker environment

| Variable | Purpose |
|----------|---------|
| `APP_BASE_URL` | Origin of the Next app (e.g. `https://your-app.vercel.app`) — **no trailing slash**. |
| `DEEPGRAM_API_KEY` | Same key as web STT; used from the worker process. |
| `TWILIO_VOICE_PERSONA_ID` | Default executive id when Twilio does not send `<Parameter name="personaId" …/>`. After the first Redis write, **`personaId` can be recovered from `callSid`** on the server. |
| `INTERNAL_VOICE_WORKER_SECRET` | Optional; if set on **both** Next and worker, worker sends `Authorization: Bearer …` plus `X-Voice-Worker: 1` (see `lib/internal/voice-worker-auth.ts`). |
| `TWILIO_MEDIA_STREAM_SECRET` | Optional; if set, WebSocket URL must include `?token=<same>` or the socket is closed. |
| `VOICE_STREAM_STT_MODE` | `stream` (default) = Deepgram WebSocket; `rest` / `batch` = HTTP buffer flushes. |
| `VOICE_STREAM_STT_DUPLEX` | Omit or `half` (default): suppress STT ingress during outbound TTS; `full` / `duplex` / `always` = always forward. |
| `VOICE_STREAM_POST_PLAYBACK_STT_TAIL_MS` | After normal TTS end, block STT ingress (ms); half-duplex only; default 280; `0` disables. |
| `VOICE_STREAM_FINAL_DEDUPE_MS` | Suppress duplicate / shorter-prefix Deepgram finals within this window (default 1200; `0` = off). |
| `VOICE_WORKER_HEALTH_PATH` | HTTP health JSON path (default `/health`). |
| `VOICE_STREAM_DG_ENDPOINTING_MS` | Deepgram `endpointing` silence (ms) for utterance splits (default 400). |
| `VOICE_STREAM_STT_PREFETCH_MAX` | Max PCM bytes to buffer before the live socket connects (default 240000). |
| `VOICE_STREAM_DG_RECONNECT` | `true` (default) / `false` — auto-reconnect Deepgram live after an unexpected close. |
| `VOICE_STREAM_DG_RECONNECT_MAX` | Max reconnect attempts per stream (default 8). |
| `VOICE_STREAM_DG_RECONNECT_BASE_MS` | Base backoff (ms); delay = min(30s, base × 2^attempt) (default 400). |
| `VOICE_STREAM_FLUSH_MS` | **Rest mode only:** periodic flush interval (ms). |
| `VOICE_STREAM_MIN_PCM_BYTES` | **Rest mode only:** minimum buffered PCM before interval flush. |
| `VOICE_STREAM_MIN_PCM_ON_STOP` | **Rest mode only:** lower floor for final flush on `stop`. |
| `VOICE_STREAM_BARGE_IN` | `true` (default) / `false` — cancel outbound TTS when caller speech is detected. |
| `VOICE_STREAM_BARGE_IN_GRACE_MS` | Ignore speech detection for this long after outbound starts (default 220). |
| `VOICE_STREAM_BARGE_IN_PCM_THRESHOLD` | Peak \|int16\| per inbound frame to count as speech (default 1800). |

## TwiML snippet (bi-directional stream)

After answering, connect the call leg to your stream URL:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://your-host.example/media" />
  </Connect>
</Response>
```

Twilio sends JSON messages: `connected` → `start` → repeated `media` (base64 payload) → `stop`. See [Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams).

## Coexisting with Gather MVP

- **Gather path:** `POST /api/twilio/voice` — no WebSocket.
- **Stream path:** separate TwiML branch or dedicated number that returns `<Connect><Stream>` instead of `<Gather>`.

You can also use `<Start><Stream …/>` for a one-way inbound track without blocking the rest of the call flow (see Twilio docs for `track` and `statusCallback`).

## Security

- Terminate **TLS** at your edge; Twilio expects **wss://** in production.
- Validate Twilio **signatures** on HTTP webhooks; for streams, set **`TWILIO_MEDIA_STREAM_SECRET`** and use `wss://host/path?token=…` (see worker).
- Optional **`INTERNAL_VOICE_WORKER_SECRET`**: worker-identified calls to `/api/tts` and `/api/chat/complete` must present a valid Bearer token; browser clients omit `X-Voice-Worker` and are unchanged. When the secret is set and the Bearer matches, **middleware** does not apply the generic Upstash **30/min per IP** limit to those two routes (avoids 429s from burst TTS + completions during a call).
