# Cycle 17 — Media Streams: Deepgram live (streaming) STT

## Goal

Replace timer-based **batch** Deepgram HTTP STT with **live WebSocket** transcription by default, while keeping **`VOICE_STREAM_STT_MODE=rest`** for the previous behavior.

## Changes

- **`voice-worker/deepgram-live.mjs`** (new) — connects to `wss://api.deepgram.com/v1/listen` with `encoding=linear16`, `sample_rate=8000`, `interim_results`, `endpointing`, `vad_events`; invokes **`onFinal`** for `type === "Results"` && `is_final`; sends **`CloseStream`** on close.
- **`voice-worker/server.mjs`**
  - **Stream mode (default):** on Twilio **`start`**, open Deepgram live; forward each inbound PCM frame; **`sttPcmPrefetch`** caps early audio until the socket is open.
  - **Utterance queue + pump:** serializes `complete` → TTS → outbound μ-law (same as before, shared with rest mode).
  - **Deduping:** ignore repeated identical finals within ~900 ms.
  - **`onClose`:** clears `dgLive` if the socket drops.
  - **Rest mode:** unchanged interval + `stop` buffer flushes to HTTP `/v1/listen`.
- **Docs** — `docs/twilio-media-streams.md`, `voice-worker/README.md`, root `README.md`, `.env.example`, `context.md`.

## Verification

- `pnpm lint` / `pnpm build`
- `node --check voice-worker/deepgram-live.mjs` (syntax)

## Limitations

- Does not reconnect Deepgram mid-call if the live socket fails; operator can fall back to **`VOICE_STREAM_STT_MODE=rest`**.
- ElevenLabs HTTP is still non-cancelable (same as cycle 16).

## Review

- Self-review: PASS for default streaming path + explicit legacy mode.
