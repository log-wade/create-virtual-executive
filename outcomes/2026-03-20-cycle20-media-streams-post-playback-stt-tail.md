# Cycle 20 — Post-playback STT tail (echo after TTS)

## Goal

After assistant **outbound** playback **finishes normally**, keep **half-duplex STT** blocking for a short window so **room/speaker echo** is less likely to hit Deepgram. **Do not** apply that gate when the caller **barged in** (they are trying to talk).

## Changes

- **`voice-worker/server.mjs`**
  - **`VOICE_STREAM_POST_PLAYBACK_STT_TAIL_MS`** (default **280**, **`0`** disables).
  - **`sttBlockedUntilMs`** — set at end of **`playAssistantReply`** only when **`!outboundAbortPlayback`** and half-duplex is on.
  - **`forwardToDeepgram`** also requires **`!isPostPlaybackSttTailBlocking(sttBlockedUntilMs)`**.
  - **Barge-in** sets **`sttBlockedUntilMs = 0`** immediately.
  - Twilio **`start`** and **`closeDeepgramIntentional`** reset **`sttBlockedUntilMs`**.
- **Docs** — `docs/twilio-media-streams.md`, `voice-worker/README.md`, `.env.example`, `context.md`.

## Verification

- `node --check voice-worker/server.mjs`
- `pnpm lint` / `pnpm build`

## Limitations

- **Full duplex** (`VOICE_STREAM_STT_DUPLEX=full`) ignores the tail (no half-duplex story).
- First syllables right after the tail window still depend on Deepgram **endpointing** only.

## Review

- Self-review: PASS; pairs with cycle 19 half-duplex + cycle 16 barge-in.
