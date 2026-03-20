# Cycle 16 — Media Streams outbound barge-in

## Goal

Let callers **interrupt** assistant TTS on **bi-directional** Media Streams by **stopping** further outbound `media` frames when **inbound speech energy** is detected (without treating constant silent frames as speech).

## Changes

- **`voice-worker/server.mjs`**
  - While **`sendUlawChunks`** runs, sets **`outboundPlaybackActive`** and arms barge-in after **`VOICE_STREAM_BARGE_IN_GRACE_MS`** (default 220).
  - On each inbound **`media`** frame, decodes to PCM and checks peak **|int16|** ≥ **`VOICE_STREAM_BARGE_IN_PCM_THRESHOLD`** (default 1800); if so, sets **`outboundAbortPlayback`** so the outbound ticker exits early.
  - **`VOICE_STREAM_BARGE_IN`**: disable with `false` / `0` / `off` / `no` (default on).
- **Docs** — `docs/twilio-media-streams.md`, `voice-worker/README.md`, `.env.example`, `context.md`.

## Verification

- `pnpm lint` / `pnpm build` (worker is plain Node; no TS changes required).

## Limitations

- Does **not** cancel in-flight **ElevenLabs** HTTP; only skips sending remaining μ-law to Twilio.
- No **VAD** or streaming STT merge — threshold may need tuning for noisy lines or echo.

## Review

- Self-review: PASS for MVP barge-in; follow-up could add RMS windowing or Twilio `track` filtering if needed.
