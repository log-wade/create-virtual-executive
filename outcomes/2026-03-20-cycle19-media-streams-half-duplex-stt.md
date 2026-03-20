# Cycle 19 — Half-duplex STT during outbound playback

## Goal

Reduce **echo** and **self-transcription** on Media Streams: while the assistant is playing **outbound** μ-law, do not forward inbound PCM to **Deepgram live**. When the caller **barges in** (existing energy gate), resume forwarding so their speech is transcribed.

## Changes

- **`voice-worker/server.mjs`**
  - **`isSttSuppressedDuringAssistantPlayback()`** — default **on**; disabled when **`VOICE_STREAM_STT_DUPLEX`** is `full`, `duplex`, `always`, or `both`.
  - Inbound **`media`**: compute **`forwardToDeepgram`** = full duplex **or** not `outboundPlaybackActive` **or** `outboundAbortPlayback`; only then **`sendPcm`** / **prefetch**.
  - Startup log includes **`sttDuplex: "half" | "full"`**.
- **Docs** — `docs/twilio-media-streams.md`, `voice-worker/README.md`, `.env.example`, `context.md`.

## Verification

- `node --check voice-worker/server.mjs`
- `pnpm lint` / `pnpm build`

## Limitations

- Audio during TTS is **dropped** for STT (not buffered); first words right after TTS ends rely on Deepgram **endpointing** only.
- No extra **tail** mute after playback ends (possible follow-up).

## Review

- Self-review: PASS; aligns half-duplex with existing barge-in flag.
