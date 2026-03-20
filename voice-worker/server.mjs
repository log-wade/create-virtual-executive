/**
 * Twilio Media Streams — WebSocket receiver skeleton (inbound audio frames).
 * Parses `connected`, `start`, `media`, `stop`, `mark` JSON events and logs metrics.
 *
 * Wire Twilio: expose this server as wss:// (ngrok/Fly) and reference the URL from
 * `<Connect><Stream url="wss://..."/></Connect>` — see `docs/twilio-media-streams.md`.
 *
 * Run: pnpm install && pnpm start  (from this directory)
 */
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.VOICE_WORKER_PORT ?? "8765");

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(
    "voice-worker: Twilio Media Streams WebSocket (see docs/twilio-media-streams.md)\n",
  );
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  let mediaFrames = 0;
  let mediaBytes = 0;
  let streamSid = "";
  let callSid = "";

  // eslint-disable-next-line no-console -- operational logging
  console.log("[voice-worker] websocket open");

  ws.on("message", (data) => {
    const text = typeof data === "string" ? data : data.toString("utf8");
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      // eslint-disable-next-line no-console -- operational logging
      console.log("[voice-worker] non-json frame", text.slice(0, 120));
      return;
    }

    switch (msg.event) {
      case "connected":
        // eslint-disable-next-line no-console -- operational logging
        console.log("[voice-worker] connected", msg.protocol ?? "");
        break;
      case "start": {
        const s = msg.start ?? {};
        streamSid = typeof s.streamSid === "string" ? s.streamSid : "";
        callSid = typeof s.callSid === "string" ? s.callSid : "";
        // eslint-disable-next-line no-console -- operational logging
        console.log("[voice-worker] start", {
          streamSid,
          callSid,
          tracks: s.tracks,
        });
        break;
      }
      case "media": {
        const payload = msg.media?.payload;
        if (typeof payload === "string") {
          mediaFrames += 1;
          mediaBytes += Buffer.byteLength(payload, "utf8");
        }
        if (mediaFrames === 1 || mediaFrames % 500 === 0) {
          // eslint-disable-next-line no-console -- operational logging
          console.log("[voice-worker] media", {
            streamSid,
            frames: mediaFrames,
            approxPayloadChars: mediaBytes,
          });
        }
        break;
      }
      case "mark":
        // eslint-disable-next-line no-console -- operational logging
        console.log("[voice-worker] mark", msg.mark?.name);
        break;
      case "stop":
        // eslint-disable-next-line no-console -- operational logging
        console.log("[voice-worker] stop", {
          streamSid,
          callSid,
          mediaFrames,
        });
        break;
      default:
        // eslint-disable-next-line no-console -- operational logging
        console.log("[voice-worker] event", msg.event);
    }
  });

  ws.on("close", () => {
    // eslint-disable-next-line no-console -- operational logging
    console.log("[voice-worker] websocket closed", { streamSid, mediaFrames });
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console -- operational logging
  console.log(`[voice-worker] HTTP + WS listening on port ${PORT}`);
});
