/**
 * Twilio Media Streams — bidirectional audio bridge (experimental).
 * STT: **Deepgram live WebSocket** by default (`VOICE_STREAM_STT_MODE=stream`);
 * set `VOICE_STREAM_STT_MODE=rest` for batched REST flushes.
 * **Half-duplex STT** (default): no PCM to Deepgram while assistant TTS plays
 * (`VOICE_STREAM_STT_DUPLEX=full` to always forward).
 * **Post-playback tail:** optional ms after TTS ends before STT ingress resumes (echo).
 * Then `POST /api/chat/complete` + `POST /api/tts` (ulaw_8000) and outbound `media`.
 *
 * Env: see `docs/twilio-media-streams.md` and `voice-worker/README.md`.
 */
import { createServer } from "node:http";
import { URL } from "node:url";
import { WebSocketServer } from "ws";
import { connectDeepgramLive } from "./deepgram-live.mjs";
import { decodeMulawToPcm16le } from "./mulaw.mjs";

const PORT = Number(process.env.VOICE_WORKER_PORT ?? "8765");
const HEALTH_PATH_RAW = process.env.VOICE_WORKER_HEALTH_PATH?.trim();
const HEALTH_PATH =
  HEALTH_PATH_RAW && HEALTH_PATH_RAW.startsWith("/")
    ? HEALTH_PATH_RAW
    : "/health";
const APP_BASE_URL = (process.env.APP_BASE_URL ?? "").trim().replace(/\/$/, "");
const DEEPGRAM_API_KEY = (process.env.DEEPGRAM_API_KEY ?? "").trim();
const DEFAULT_PERSONA_ID = (process.env.TWILIO_VOICE_PERSONA_ID ?? "").trim();
const INTERNAL_SECRET = (process.env.INTERNAL_VOICE_WORKER_SECRET ?? "").trim();
const WS_MEDIA_SECRET = (process.env.TWILIO_MEDIA_STREAM_SECRET ?? "").trim();
const FLUSH_MS = Number(process.env.VOICE_STREAM_FLUSH_MS ?? 2800);
const MIN_PCM_BYTES = Number(process.env.VOICE_STREAM_MIN_PCM_BYTES ?? 32_000);
/** On `stop`, still try STT if we have at least ~0.25s of 16-bit mono @ 8 kHz (rest mode only). */
const MIN_PCM_BYTES_ON_STOP = Number(
  process.env.VOICE_STREAM_MIN_PCM_ON_STOP ?? 4_000,
);
const DG_ENDPOINTING_MS = Number(
  process.env.VOICE_STREAM_DG_ENDPOINTING_MS ?? 400,
);
/** Max bytes to buffer before Deepgram live connects (~7.5s @ 8kHz mono int16 default). */
const STT_PREFETCH_MAX_BYTES = Number(
  process.env.VOICE_STREAM_STT_PREFETCH_MAX ?? 240_000,
);
/** Max reconnect attempts after an unexpected Deepgram socket close. */
const DG_RECONNECT_MAX = Number(process.env.VOICE_STREAM_DG_RECONNECT_MAX ?? 8);
/** Base delay (ms) for exponential backoff between reconnect attempts. */
const DG_RECONNECT_BASE_MS = Number(
  process.env.VOICE_STREAM_DG_RECONNECT_BASE_MS ?? 400,
);

/** After outbound playback starts, ignore barge-in for this many ms (echo / tail). */
const BARGE_IN_GRACE_MS = Number(
  process.env.VOICE_STREAM_BARGE_IN_GRACE_MS ?? 220,
);
/** Peak |int16| sample in a 20 ms inbound frame above this counts as “speech”. */
const BARGE_IN_PCM_THRESHOLD = Number(
  process.env.VOICE_STREAM_BARGE_IN_PCM_THRESHOLD ?? 1_800,
);
/**
 * After assistant playback completes (not barge-in), block STT ingress this long (ms).
 * Only when half-duplex STT is enabled. Set 0 to disable.
 */
const POST_PLAYBACK_STT_TAIL_MS = Number(
  process.env.VOICE_STREAM_POST_PLAYBACK_STT_TAIL_MS ?? 280,
);
/** Drop near-duplicate Deepgram finals within this window (ms). Set 0 to disable. */
const FINAL_DEDUPE_MS = Number(process.env.VOICE_STREAM_FINAL_DEDUPE_MS ?? 1_200);

const ULAW_FRAME_BYTES = 160;
const MU_LAW_SILENCE = 0xff;

/** `stream` (default) = Deepgram WebSocket; `rest` / `batch` = periodic HTTP listen. */
function isRestSttMode() {
  const v = process.env.VOICE_STREAM_STT_MODE?.trim().toLowerCase();
  return v === "rest" || v === "batch";
}

/** Auto-reconnect Deepgram live after unexpected socket close (default on). */
function isDeepgramReconnectEnabled() {
  const v = process.env.VOICE_STREAM_DG_RECONNECT?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return true;
}

function isStreamBargeInEnabled() {
  const v = process.env.VOICE_STREAM_BARGE_IN?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return true;
}

/**
 * When true, inbound PCM is **not** sent to Deepgram while `outboundPlaybackActive`
 * (reduces echo / self-transcription). Barge-in sets `outboundAbortPlayback` so user
 * speech is forwarded again. Set `VOICE_STREAM_STT_DUPLEX=full` for full duplex.
 */
function isSttSuppressedDuringAssistantPlayback() {
  const v = process.env.VOICE_STREAM_STT_DUPLEX?.trim().toLowerCase();
  if (
    v === "full" ||
    v === "always" ||
    v === "duplex" ||
    v === "both"
  ) {
    return false;
  }
  return true;
}

/**
 * @param {number} blockedUntilMs
 * @returns {boolean}
 */
function isPostPlaybackSttTailBlocking(blockedUntilMs) {
  if (POST_PLAYBACK_STT_TAIL_MS <= 0) return false;
  if (!isSttSuppressedDuringAssistantPlayback()) return false;
  return Date.now() < blockedUntilMs;
}

/**
 * @param {Buffer} pcm16leChunk
 * @returns {boolean}
 */
function pcmChunkHasVoiceEnergy(pcm16leChunk) {
  let peak = 0;
  for (let i = 0; i + 1 < pcm16leChunk.length; i += 2) {
    const s = Math.abs(pcm16leChunk.readInt16LE(i));
    if (s > peak) peak = s;
  }
  return peak >= BARGE_IN_PCM_THRESHOLD;
}

/**
 * @param {string} s
 * @returns {string}
 */
function normalizeForFinalDedupe(s) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * @param {string} newKey normalized
 * @param {string} lastKey normalized
 * @param {number} now
 * @param {number} lastAt
 * @returns {boolean}
 */
function shouldSkipDuplicateFinal(newKey, lastKey, now, lastAt) {
  if (!newKey) return true;
  if (now - lastAt >= FINAL_DEDUPE_MS) return false;
  if (newKey === lastKey) return true;
  if (
    lastKey.length > newKey.length &&
    lastKey.startsWith(newKey) &&
    lastKey[newKey.length] === " "
  ) {
    return true;
  }
  return false;
}

const httpServer = createServer((req, res) => {
  let pathname = "/";
  try {
    pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  } catch {
    pathname = "/";
  }
  if (pathname === HEALTH_PATH) {
    const body = JSON.stringify({
      ok: true,
      service: "create-virtual-executive-voice-worker",
      sttMode: isRestSttMode() ? "rest" : "stream",
      deepgramConfigured: Boolean(DEEPGRAM_API_KEY),
      appBaseConfigured: Boolean(APP_BASE_URL),
    });
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(body);
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(
    "voice-worker: Twilio Media Streams WebSocket (see docs/twilio-media-streams.md)\n",
  );
});

const wss = new WebSocketServer({ server: httpServer });

/**
 * @returns {Record<string, string>}
 */
function appJsonHeaders() {
  const h = {
    "Content-Type": "application/json",
    "X-Voice-Worker": "1",
  };
  if (INTERNAL_SECRET) {
    h.Authorization = `Bearer ${INTERNAL_SECRET}`;
  }
  return h;
}

/**
 * @param {Buffer} pcm
 * @returns {Promise<string>}
 */
async function transcribeLinear16Pcm8k(pcm) {
  if (!DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is not set");
  }
  const params = new URLSearchParams({
    model: "nova-2",
    smart_format: "true",
    encoding: "linear16",
    sample_rate: "8000",
    channels: "1",
  });
  const url = `https://api.deepgram.com/v1/listen?${params.toString()}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
      "Content-Type": "application/octet-stream",
    },
    body: pcm,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Deepgram STT failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  const json = await response.json();
  return (
    json.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? ""
  );
}

/**
 * @param {string} personaId
 * @param {string} userText
 * @param {string} [twilioCallSid] When non-empty, Next merges Upstash history (Gather + Stream share keys).
 * @returns {Promise<string>}
 */
async function completeChat(personaId, userText, twilioCallSid) {
  if (!APP_BASE_URL) {
    throw new Error("APP_BASE_URL is not set");
  }
  const payload = {
    personaId,
    messages: [{ role: "user", content: userText }],
  };
  if (twilioCallSid) {
    payload.callSid = twilioCallSid;
  }
  const response = await fetch(`${APP_BASE_URL}/api/chat/complete`, {
    method: "POST",
    headers: appJsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`chat/complete failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  const data = await response.json();
  const text = typeof data.text === "string" ? data.text.trim() : "";
  return text;
}

/**
 * @param {string} text
 * @returns {Promise<Buffer>}
 */
async function synthesizeUlaw(text) {
  if (!APP_BASE_URL) {
    throw new Error("APP_BASE_URL is not set");
  }
  const response = await fetch(`${APP_BASE_URL}/api/tts`, {
    method: "POST",
    headers: appJsonHeaders(),
    body: JSON.stringify({ text, outputFormat: "ulaw_8000" }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`TTS failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  return buf;
}

/**
 * @param {import("ws").WebSocket} ws
 * @param {string} streamSid
 * @param {Buffer} ulawBuf
 * @param {() => boolean} isAborted
 * @returns {Promise<void>}
 */
function sendUlawChunks(ws, streamSid, ulawBuf, isAborted) {
  return new Promise((resolve) => {
    let offset = 0;
    const tick = () => {
      if (isAborted()) {
        resolve();
        return;
      }
      if (ws.readyState !== 1) {
        resolve();
        return;
      }
      if (offset >= ulawBuf.length) {
        resolve();
        return;
      }
      const end = Math.min(offset + ULAW_FRAME_BYTES, ulawBuf.length);
      let slice = ulawBuf.subarray(offset, end);
      if (slice.length < ULAW_FRAME_BYTES) {
        const padded = Buffer.alloc(ULAW_FRAME_BYTES, MU_LAW_SILENCE);
        slice.copy(padded);
        slice = padded;
      }
      offset += ULAW_FRAME_BYTES;
      ws.send(
        JSON.stringify({
          event: "media",
          streamSid,
          media: { payload: slice.toString("base64") },
        }),
      );
      setTimeout(tick, 20);
    };
    tick();
  });
}

wss.on("connection", (ws, req) => {
  if (WS_MEDIA_SECRET) {
    const host = req.headers.host ?? "localhost";
    const u = new URL(req.url ?? "/", `http://${host}`);
    if (u.searchParams.get("token") !== WS_MEDIA_SECRET) {
      // eslint-disable-next-line no-console -- operational logging
      console.warn("[voice-worker] rejected websocket (bad token)");
      ws.close(1008, "Unauthorized");
      return;
    }
  }

  let mediaFrames = 0;
  let streamSid = "";
  let callSid = "";
  /** @type {string} */
  let personaId = DEFAULT_PERSONA_ID;
  /** @type {Buffer} */
  let pcmBuffer = Buffer.alloc(0);
  let flushTimer = null;
  let outboundPlaybackActive = false;
  let outboundAbortPlayback = false;
  /** @type {number} */
  let outboundBargeInAfterMs = 0;
  /** Do not forward PCM to Deepgram until this timestamp (post-TTS echo tail). */
  let sttBlockedUntilMs = 0;

  /** @type {null | { waitOpen: () => Promise<void>, sendPcm: (buf: Buffer) => void, close: () => void }} */
  let dgLive = null;
  /** PCM queued while Deepgram is still connecting or reconnecting. */
  let sttPcmPrefetch = Buffer.alloc(0);
  /** Bumped on intentional shutdown or new `start` so stale `onClose` handlers do not reconnect. */
  let dgSessionId = 0;
  let dgIntentionalClose = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let dgReconnectTimer = null;
  let dgReconnectAttempts = 0;

  const utteranceQueue = [];
  let pumpRunning = false;
  let transcribeBusy = false;

  let lastFinalDedupeKey = "";
  let lastFinalAt = 0;

  // eslint-disable-next-line no-console -- operational logging
  console.log("[voice-worker] websocket open", {
    stt: isRestSttMode() ? "rest" : "stream",
    sttDuplex: isSttSuppressedDuringAssistantPlayback() ? "half" : "full",
    postPlaybackSttTailMs: isSttSuppressedDuringAssistantPlayback()
      ? POST_PLAYBACK_STT_TAIL_MS
      : 0,
  });

  /**
   * @param {import("ws").WebSocket} twilioWs
   */
  async function playAssistantReply(twilioWs, transcript) {
    if (!personaId) {
      // eslint-disable-next-line no-console -- operational logging
      console.warn("[voice-worker] missing personaId; set TWILIO_VOICE_PERSONA_ID or Stream Parameter");
      return;
    }
    // eslint-disable-next-line no-console -- operational logging
    console.log("[voice-worker] transcript", {
      callSid,
      transcript: transcript.slice(0, 120),
    });

    const reply = await completeChat(personaId, transcript, callSid);
    if (!reply) {
      // eslint-disable-next-line no-console -- operational logging
      console.log("[voice-worker] empty model reply");
      return;
    }

    const ulaw = await synthesizeUlaw(reply);
    // eslint-disable-next-line no-console -- operational logging
    console.log("[voice-worker] outbound ulaw bytes", ulaw.length);

    outboundAbortPlayback = false;
    outboundPlaybackActive = true;
    outboundBargeInAfterMs = Date.now() + BARGE_IN_GRACE_MS;

    await sendUlawChunks(twilioWs, streamSid, ulaw, () => outboundAbortPlayback);

    if (outboundAbortPlayback) {
      // eslint-disable-next-line no-console -- operational logging
      console.log("[voice-worker] outbound playback ended early (barge-in)");
    } else if (
      POST_PLAYBACK_STT_TAIL_MS > 0 &&
      isSttSuppressedDuringAssistantPlayback()
    ) {
      sttBlockedUntilMs = Date.now() + POST_PLAYBACK_STT_TAIL_MS;
    }
  }

  async function pumpQueue(twilioWs) {
    if (pumpRunning) return;
    pumpRunning = true;
    try {
      while (utteranceQueue.length > 0 && streamSid) {
        const t = utteranceQueue.shift();
        if (!t) continue;
        try {
          await playAssistantReply(twilioWs, t);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // eslint-disable-next-line no-console -- operational logging
          console.error("[voice-worker] reply pipeline error", msg);
        } finally {
          outboundPlaybackActive = false;
          outboundAbortPlayback = false;
        }
      }
    } finally {
      pumpRunning = false;
      outboundPlaybackActive = false;
      outboundAbortPlayback = false;
      if (utteranceQueue.length > 0 && streamSid) {
        void pumpQueue(twilioWs);
      }
    }
  }

  /**
   * @param {string} text
   * @param {import("ws").WebSocket} twilioWs
   */
  function enqueueUtterance(text, twilioWs) {
    const raw = String(text).trim().replace(/\s+/g, " ");
    if (!raw) return;
    const key = normalizeForFinalDedupe(raw);
    const now = Date.now();
    if (
      FINAL_DEDUPE_MS > 0 &&
      shouldSkipDuplicateFinal(key, lastFinalDedupeKey, now, lastFinalAt)
    ) {
      return;
    }
    lastFinalDedupeKey = key;
    lastFinalAt = now;
    utteranceQueue.push(raw);
    void pumpQueue(twilioWs);
  }

  async function flushRest(reason, twilioWs) {
    if (!isRestSttMode() || !streamSid || transcribeBusy) return;
    const minNeeded =
      reason === "stop" ? MIN_PCM_BYTES_ON_STOP : MIN_PCM_BYTES;
    if (pcmBuffer.length < minNeeded) return;

    transcribeBusy = true;
    const pcm = pcmBuffer;
    pcmBuffer = Buffer.alloc(0);
    try {
      const transcript = await transcribeLinear16Pcm8k(pcm);
      if (!transcript) {
        // eslint-disable-next-line no-console -- operational logging
        console.log("[voice-worker] flush empty transcript", { reason, callSid });
        return;
      }
      enqueueUtterance(transcript, twilioWs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console -- operational logging
      console.error("[voice-worker] flush error", msg);
    } finally {
      transcribeBusy = false;
    }
  }

  function closeDeepgramIntentional() {
    dgIntentionalClose = true;
    dgSessionId += 1;
    sttBlockedUntilMs = 0;
    if (dgReconnectTimer) {
      clearTimeout(dgReconnectTimer);
      dgReconnectTimer = null;
    }
    dgReconnectAttempts = 0;
    if (!dgLive) return;
    try {
      dgLive.close();
    } catch {
      /* ignore */
    }
    dgLive = null;
  }

  /**
   * @param {import("ws").WebSocket} twilioWs
   * @param {number} sessionForThisOpen
   */
  async function connectDeepgramSession(twilioWs, sessionForThisOpen) {
    const client = connectDeepgramLive(DEEPGRAM_API_KEY, {
      endpointingMs: DG_ENDPOINTING_MS,
      onFinal: (text) => {
        enqueueUtterance(text, twilioWs);
      },
      onError: (err) => {
        // eslint-disable-next-line no-console -- operational logging
        console.error("[voice-worker] deepgram live error", err.message);
      },
      onClose: () => {
        // eslint-disable-next-line no-console -- operational logging
        console.log("[voice-worker] deepgram live socket closed");
        if (dgLive === client) {
          dgLive = null;
        }
        if (sessionForThisOpen !== dgSessionId) {
          return;
        }
        if (
          dgIntentionalClose ||
          isRestSttMode() ||
          !isDeepgramReconnectEnabled() ||
          !streamSid ||
          twilioWs.readyState !== 1
        ) {
          return;
        }
        scheduleDeepgramReconnect(twilioWs);
      },
    });
    await client.waitOpen();
    if (sessionForThisOpen !== dgSessionId) {
      try {
        client.close();
      } catch {
        /* ignore */
      }
      return;
    }
    dgLive = client;
    dgReconnectAttempts = 0;
    if (sttPcmPrefetch.length > 0) {
      dgLive.sendPcm(sttPcmPrefetch);
      sttPcmPrefetch = Buffer.alloc(0);
    }
  }

  /**
   * @param {import("ws").WebSocket} twilioWs
   */
  function scheduleDeepgramReconnect(twilioWs) {
    if (
      dgIntentionalClose ||
      isRestSttMode() ||
      !isDeepgramReconnectEnabled() ||
      !streamSid ||
      twilioWs.readyState !== 1
    ) {
      return;
    }
    if (dgLive) {
      return;
    }
    if (dgReconnectAttempts >= DG_RECONNECT_MAX) {
      // eslint-disable-next-line no-console -- operational logging
      console.error("[voice-worker] deepgram reconnect exhausted", {
        callSid,
        attempts: DG_RECONNECT_MAX,
      });
      return;
    }
    const delay = Math.min(
      30_000,
      DG_RECONNECT_BASE_MS * 2 ** dgReconnectAttempts,
    );
    dgReconnectAttempts += 1;
    // eslint-disable-next-line no-console -- operational logging
    console.log("[voice-worker] scheduling deepgram reconnect", {
      callSid,
      delayMs: delay,
      attempt: dgReconnectAttempts,
    });
    if (dgReconnectTimer) {
      clearTimeout(dgReconnectTimer);
    }
    dgReconnectTimer = setTimeout(() => {
      dgReconnectTimer = null;
      void reconnectDeepgramNow(twilioWs);
    }, delay);
  }

  /**
   * @param {import("ws").WebSocket} twilioWs
   */
  async function reconnectDeepgramNow(twilioWs) {
    if (
      dgIntentionalClose ||
      isRestSttMode() ||
      !streamSid ||
      twilioWs.readyState !== 1 ||
      dgLive
    ) {
      return;
    }
    if (!DEEPGRAM_API_KEY) {
      return;
    }
    dgSessionId += 1;
    const session = dgSessionId;
    try {
      await connectDeepgramSession(twilioWs, session);
      if (session === dgSessionId && dgLive) {
        // eslint-disable-next-line no-console -- operational logging
        console.log("[voice-worker] deepgram live reconnected", { callSid });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (session !== dgSessionId) {
        return;
      }
      // eslint-disable-next-line no-console -- operational logging
      console.error("[voice-worker] deepgram reconnect failed", msg);
      scheduleDeepgramReconnect(twilioWs);
    }
  }

  async function openDeepgram(twilioWs) {
    if (!DEEPGRAM_API_KEY || isRestSttMode()) return;
    dgIntentionalClose = false;
    dgReconnectAttempts = 0;
    if (dgReconnectTimer) {
      clearTimeout(dgReconnectTimer);
      dgReconnectTimer = null;
    }

    dgSessionId += 1;
    const session = dgSessionId;

    if (dgLive) {
      try {
        dgLive.close();
      } catch {
        /* ignore */
      }
      dgLive = null;
    }
    sttPcmPrefetch = Buffer.alloc(0);

    try {
      await connectDeepgramSession(twilioWs, session);
      if (session === dgSessionId && dgLive) {
        // eslint-disable-next-line no-console -- operational logging
        console.log("[voice-worker] deepgram live connected", { callSid });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (session !== dgSessionId) {
        return;
      }
      // eslint-disable-next-line no-console -- operational logging
      console.error("[voice-worker] deepgram live connect failed", msg);
      if (isDeepgramReconnectEnabled()) {
        scheduleDeepgramReconnect(twilioWs);
      }
    }
  }

  if (isRestSttMode()) {
    flushTimer = setInterval(() => {
      void flushRest("interval", ws);
    }, FLUSH_MS);
  }

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
        const custom = s.customParameters;
        if (custom && typeof custom === "object" && !Array.isArray(custom)) {
          const pid = custom.personaId ?? custom.persona_id;
          if (typeof pid === "string" && pid.trim()) {
            personaId = pid.trim();
          }
        }
        // eslint-disable-next-line no-console -- operational logging
        console.log("[voice-worker] start", {
          streamSid,
          callSid,
          personaId,
          tracks: s.tracks,
        });
        sttBlockedUntilMs = 0;
        void openDeepgram(ws);
        break;
      }
      case "media": {
        const payload = msg.media?.payload;
        if (typeof payload === "string") {
          mediaFrames += 1;
          const ulaw = Buffer.from(payload, "base64");
          const pcm = decodeMulawToPcm16le(ulaw);
          if (
            isStreamBargeInEnabled() &&
            outboundPlaybackActive &&
            Date.now() >= outboundBargeInAfterMs &&
            pcmChunkHasVoiceEnergy(pcm) &&
            !outboundAbortPlayback
          ) {
            outboundAbortPlayback = true;
            sttBlockedUntilMs = 0;
            // eslint-disable-next-line no-console -- operational logging
            console.log("[voice-worker] barge-in: canceling outbound TTS", {
              callSid,
              frame: mediaFrames,
            });
          }
          if (!isRestSttMode()) {
            const postPlaybackTail = isPostPlaybackSttTailBlocking(
              sttBlockedUntilMs,
            );
            const forwardToDeepgram =
              !postPlaybackTail &&
              (!isSttSuppressedDuringAssistantPlayback() ||
                !outboundPlaybackActive ||
                outboundAbortPlayback);
            if (forwardToDeepgram) {
              if (dgLive) {
                dgLive.sendPcm(pcm);
              } else {
                sttPcmPrefetch = Buffer.concat([sttPcmPrefetch, pcm]);
                if (sttPcmPrefetch.length > STT_PREFETCH_MAX_BYTES) {
                  sttPcmPrefetch = sttPcmPrefetch.subarray(
                    sttPcmPrefetch.length - STT_PREFETCH_MAX_BYTES,
                  );
                }
              }
            }
          } else {
            pcmBuffer = Buffer.concat([pcmBuffer, pcm]);
          }
        }
        if (mediaFrames === 1 || mediaFrames % 500 === 0) {
          // eslint-disable-next-line no-console -- operational logging
          console.log("[voice-worker] media", {
            streamSid,
            frames: mediaFrames,
            pcmBytes: pcmBuffer.length,
            live: Boolean(dgLive),
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
        if (flushTimer) {
          clearInterval(flushTimer);
          flushTimer = null;
        }
        closeDeepgramIntentional();
        if (isRestSttMode()) {
          void flushRest("stop", ws);
        }
        break;
      default:
        // eslint-disable-next-line no-console -- operational logging
        console.log("[voice-worker] event", msg.event);
    }
  });

  ws.on("close", () => {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    closeDeepgramIntentional();
    // eslint-disable-next-line no-console -- operational logging
    console.log("[voice-worker] websocket closed", { streamSid, mediaFrames });
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console -- operational logging
  console.log(
    `[voice-worker] HTTP + WS listening on port ${PORT} (health: GET ${HEALTH_PATH})`,
  );
});
