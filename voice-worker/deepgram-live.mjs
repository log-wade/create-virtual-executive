/**
 * Deepgram live (streaming) STT over WebSocket — linear16 mono @ 8 kHz.
 * @see https://developers.deepgram.com/docs/getting-started-with-live-streaming-audio
 */
import WebSocket from "ws";

/**
 * @typedef {object} DeepgramLiveHandlers
 * @property {(text: string) => void} onFinal
 * @property {(err: Error) => void} [onError]
 * @property {() => void} [onClose]
 */

/**
 * @param {string} apiKey
 * @param {DeepgramLiveHandlers & { endpointingMs?: number }} handlers
 */
export function connectDeepgramLive(apiKey, handlers) {
  const endpointingMs = handlers.endpointingMs ?? 400;
  const params = new URLSearchParams({
    encoding: "linear16",
    sample_rate: "8000",
    channels: "1",
    model: "nova-2",
    smart_format: "true",
    interim_results: "true",
    endpointing: String(endpointingMs),
    vad_events: "true",
  });
  const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
  const ws = new WebSocket(url, {
    headers: { Authorization: `Token ${apiKey}` },
  });

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.type === "Results" && msg.is_final === true) {
      const transcript =
        msg.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
      if (transcript) handlers.onFinal(transcript);
    }
  });

  ws.on("error", (err) => {
    handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
  });

  ws.on("close", () => {
    handlers.onClose?.();
  });

  return {
    /** @returns {Promise<void>} */
    waitOpen() {
      return new Promise((resolve, reject) => {
        if (ws.readyState === WebSocket.OPEN) {
          resolve();
          return;
        }
        ws.once("open", () => resolve());
        ws.once("error", (e) =>
          reject(e instanceof Error ? e : new Error(String(e))),
        );
      });
    },
    /** @param {Buffer} buf */
    sendPcm(buf) {
      if (ws.readyState === WebSocket.OPEN && buf.length > 0) {
        ws.send(buf);
      }
    },
    /** Request final results and close the socket. */
    close() {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "CloseStream" }));
        }
      } catch {
        /* ignore */
      }
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    },
  };
}
