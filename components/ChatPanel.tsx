"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export type ChatPanelProps = {
  personaId: string;
  /** Fires when assistant TTS playback starts or stops (for avatar lip-sync stub). */
  onTtsPlaybackChange?: (playing: boolean) => void;
};

function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export function ChatPanel({
  personaId,
  onTtsPlaybackChange,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [sttError, setSttError] = useState<string | null>(null);
  const [ttsLoadingIndex, setTtsLoadingIndex] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [sttPending, setSttPending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsObjectUrlRef = useRef<string | null>(null);
  const messagesRef = useRef<Msg[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordMimeRef = useRef<string>("audio/webm");
  const mountedRef = useRef(true);
  const ttsPlaybackGenerationRef = useRef(0);

  messagesRef.current = messages;

  const canUseMic =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    pickRecorderMimeType() !== "";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  function stopMediaStream() {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }

  function stopTtsPlayback() {
    onTtsPlaybackChange?.(false);
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    if (ttsObjectUrlRef.current) {
      URL.revokeObjectURL(ttsObjectUrlRef.current);
      ttsObjectUrlRef.current = null;
    }
  }

  async function runChatTurn(userText: string, baseMessages: Msg[]) {
    const trimmed = userText.trim();
    if (!trimmed || pending) return;

    setError(null);
    const prev = baseMessages;
    const next: Msg[] = [...baseMessages, { role: "user", content: trimmed }];
    setMessages(next);
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId,
          messages: next,
        }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const dec = new TextDecoder();
      let assistant = "";
      setMessages([...next, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += dec.decode(value, { stream: true });
        setMessages([
          ...next,
          { role: "assistant", content: assistant },
        ]);
      }

      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
      setMessages(prev);
    } finally {
      setPending(false);
    }
  }

  async function submitTranscription(blob: Blob) {
    if (blob.size === 0) {
      setSttError("Recording was empty.");
      return;
    }
    setSttPending(true);
    setSttError(null);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const res = await fetch("/api/stt", { method: "POST", body: formData });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        transcript?: string;
      };
      if (!res.ok) {
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const transcript = j.transcript?.trim() ?? "";
      if (!transcript) {
        setSttError("No speech detected — try again.");
        return;
      }
      await runChatTurn(transcript, messagesRef.current);
    } catch (e) {
      setSttError(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setSttPending(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    if (pending || sttPending || ttsLoadingIndex !== null) return;

    const mime = pickRecorderMimeType();
    if (!mime) {
      setSttError("Recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: mime });
      recordMimeRef.current = mr.mimeType || mime;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stopMediaStream();
        mediaRecorderRef.current = null;
        const blob = new Blob(chunksRef.current, {
          type: recordMimeRef.current,
        });
        if (mountedRef.current && blob.size > 0) {
          void submitTranscription(blob);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setSttError(null);
    } catch (e) {
      stopMediaStream();
      setSttError(
        e instanceof Error ? e.message : "Microphone permission denied",
      );
    }
  }

  async function speakAssistant(text: string, messageIndex: number) {
    const trimmed = text.trim();
    if (!trimmed || ttsLoadingIndex !== null) return;

    stopTtsPlayback();
    const playbackGeneration = ++ttsPlaybackGenerationRef.current;
    setTtsError(null);
    setTtsLoadingIndex(messageIndex);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, personaId }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      ttsObjectUrlRef.current = url;
      const audio = new Audio(url);
      ttsAudioRef.current = audio;
      audio.onended = () => {
        if (playbackGeneration !== ttsPlaybackGenerationRef.current) return;
        onTtsPlaybackChange?.(false);
        if (ttsObjectUrlRef.current === url) {
          URL.revokeObjectURL(url);
          ttsObjectUrlRef.current = null;
          ttsAudioRef.current = null;
        }
        setTtsLoadingIndex(null);
      };
      try {
        await audio.play();
        if (playbackGeneration === ttsPlaybackGenerationRef.current) {
          onTtsPlaybackChange?.(true);
        }
      } catch {
        stopTtsPlayback();
        setTtsError("Could not start audio playback (browser may have blocked it)");
        setTtsLoadingIndex(null);
        return;
      }
    } catch (e) {
      stopTtsPlayback();
      setTtsError(e instanceof Error ? e.message : "Playback failed");
      setTtsLoadingIndex(null);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || pending || recording || sttPending) return;
    setInput("");
    await runChatTurn(text, messages);
  }

  const inputDisabled = pending || recording || sttPending;

  return (
    <div className="flex min-h-[420px] flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="max-h-[480px] flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        {messages.length === 0 ? (
          <p className="text-zinc-500">
            Say hello as you would to a new executive — they will respond in
            character.
          </p>
        ) : null}
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={
              m.role === "user"
                ? "ml-8 rounded-lg bg-zinc-100 px-3 py-2 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                : "mr-8 whitespace-pre-wrap rounded-lg border border-zinc-200 px-3 py-2 text-zinc-800 dark:border-zinc-800 dark:text-zinc-200"
            }
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                {m.role === "user" ? "You" : "Executive"}
              </span>
              {m.role === "assistant" &&
              m.content.trim() &&
              !(pending && i === messages.length - 1) ? (
                <button
                  type="button"
                  onClick={() => void speakAssistant(m.content, i)}
                  disabled={ttsLoadingIndex !== null}
                  className="shrink-0 rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {ttsLoadingIndex === i ? "Speaking…" : "Speak"}
                </button>
              ) : null}
            </div>
            {m.content || (pending && m.role === "assistant" ? "…" : "")}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}
      {ttsError || sttError ? (
        <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {ttsError || sttError}
        </p>
      ) : null}

      <div className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Message…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          disabled={inputDisabled}
        />
        <button
          type="button"
          onClick={() => void toggleRecording()}
          disabled={
            !canUseMic ||
            (!recording &&
              (pending || sttPending || ttsLoadingIndex !== null))
          }
          title={
            !canUseMic
              ? "Recording not supported"
              : recording
                ? "Stop and transcribe"
                : "Record a message"
          }
          className={
            recording
              ? "shrink-0 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 disabled:opacity-50 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
              : "shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          }
        >
          {recording ? "Stop" : sttPending ? "…" : "Mic"}
        </button>
        <button
          type="button"
          onClick={() => void send()}
          disabled={inputDisabled || !input.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Send
        </button>
      </div>
    </div>
  );
}
