# Twilio Media Streams (experimental)

The Next.js app handles **Gather + Say** voice UX. **Media Streams** send **raw audio** (μ-law base64 in JSON) over a **WebSocket** so a long-lived worker can run STT/TTS without serverless timeouts.

## Worker in this repo

`voice-worker/server.mjs` accepts Twilio’s WebSocket protocol and logs `start` / `media` / `stop`. Next steps: decode μ-law, stream to Deepgram (or similar), call your app’s `POST /api/chat/complete`, encode TTS back as outbound `media` messages (see Twilio’s outbound stream format).

```bash
cd voice-worker && pnpm install && pnpm start
```

Default port **8765** (`VOICE_WORKER_PORT`). Expose **wss://** publicly (ngrok, Fly.io, Railway).

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
- Validate Twilio **signatures** on HTTP webhooks; WebSocket connections should use **hard-to-guess URLs** or Twilio’s recommended auth patterns for streams.
