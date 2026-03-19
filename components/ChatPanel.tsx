"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatPanel({ personaId }: { personaId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    setError(null);
    setInput("");
    const prev = messages;
    const next: Msg[] = [...messages, { role: "user", content: text }];
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
        const j = await res.json().catch(() => ({}));
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
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              {m.role === "user" ? "You" : "Executive"}
            </span>
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
          disabled={pending}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={pending || !input.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Send
        </button>
      </div>
    </div>
  );
}
