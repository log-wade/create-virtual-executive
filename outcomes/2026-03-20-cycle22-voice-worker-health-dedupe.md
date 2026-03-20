# Cycle 22 — Voice worker health + Deepgram final dedupe

## Goal

1. Expose a **probe-friendly HTTP endpoint** for the worker process (deploy / load balancers).
2. Reduce **double assistant turns** from near-duplicate Deepgram finals (case, spacing, shorter prefix repeats).

## Changes

- **`voice-worker/server.mjs`**
  - **`GET`** **`VOICE_WORKER_HEALTH_PATH`** (default **`/health`**) → JSON: `ok`, `service`, `sttMode`, `deepgramConfigured`, `appBaseConfigured`.
  - **`normalizeForFinalDedupe`** + **`shouldSkipDuplicateFinal`**: within **`VOICE_STREAM_FINAL_DEDUPE_MS`** (default **1200**, **`0`** disables), skip if normalized text equals last or if last enqueued text **starts with** the new text **followed by a space** (shorter repeat of same utterance).
  - **`enqueueUtterance`** pushes **whitespace-collapsed** raw transcript (preserves casing for the model).
  - Startup log includes health path.
- **Docs** — `docs/twilio-media-streams.md`, `voice-worker/README.md`, `.env.example`, `context.md`.

## Verification

- `node --check voice-worker/server.mjs`
- `pnpm lint` / `pnpm build`

## Limitations

- Does not merge “Hello” → “Hello there” into one turn (only suppresses strict shorter **word** prefix).
- Health JSON does not reflect live Twilio or Deepgram socket state.

## Review

- Self-review: PASS.
