# Cycle 18 — Deepgram live auto-reconnect

## Goal

When the **Deepgram live** WebSocket closes unexpectedly during an active Twilio Media Stream, **reconnect with exponential backoff** instead of losing STT for the rest of the call. **Do not** reconnect after intentional teardown (`stop` / Twilio socket close) or when replacing the socket on a new `start`.

## Changes

- **`voice-worker/server.mjs`**
  - **`dgSessionId`** — incremented on each new `openDeepgram` attempt, on each scheduled reconnect attempt, and on **`closeDeepgramIntentional()`**. `onClose` handlers compare their session to **`dgSessionId`** and ignore stale closes.
  - **`dgIntentionalClose`** — set when Twilio sends **`stop`** or the Twilio WebSocket closes; clears reconnect timers and prevents `onClose` from scheduling.
  - **`scheduleDeepgramReconnect` / `reconnectDeepgramNow`** — backoff `min(30s, DG_RECONNECT_BASE_MS * 2^attempt)` up to **`VOICE_STREAM_DG_RECONNECT_MAX`** (default 8).
  - **`connectDeepgramSession`** — shared open + `onClose` wiring; flushes **`sttPcmPrefetch`** after a successful connect; if session invalidated during `waitOpen`, closes the new client.
  - **`VOICE_STREAM_DG_RECONNECT`** — `false` / `off` / `no` disables auto-reconnect (initial open failure will not schedule retries either).
- **Docs** — `docs/twilio-media-streams.md`, `voice-worker/README.md`, `.env.example`, `context.md`.

## Verification

- `node --check voice-worker/server.mjs`
- `pnpm lint` / `pnpm build`

## Limitations

- Does not surface Deepgram **close codes** for metrics; logging remains console-only.
- Exhausted backoff leaves the stream without live STT until the next Twilio `start` / new call.

## Review

- Self-review: PASS for session-stale guard + intentional shutdown path.
