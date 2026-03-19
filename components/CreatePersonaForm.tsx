"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Template = {
  id: string;
  industry: string;
  role_archetype: string;
  seniority: string;
  starter_user_prompt: string;
};

export function CreatePersonaForm() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    const t = templates.find((x) => x.id === templateId);
    if (t && !description.trim()) {
      setDescription(t.starter_user_prompt);
    }
  }, [templateId, templates, description]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedId(null);
    setLoading(true);
    try {
      const res = await fetch("/api/personas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          templateId: templateId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail =
          Array.isArray(data.details) && data.details.length
            ? `${data.error}: ${data.details.join("; ")}`
            : data.error || "Request failed";
        throw new Error(detail);
      }
      setCreatedId(data.meta?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div>
        <label
          htmlFor="template"
          className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Industry template (optional)
        </label>
        <select
          id="template"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">None — custom only</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.industry} — {t.role_archetype} ({t.seniority})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          Templates add decision and communication culture from your playbook;
          you still edit the description.
        </p>
      </div>

      <div>
        <label
          htmlFor="description"
          className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          What do you need this executive to do?
        </label>
        <textarea
          id="description"
          required
          minLength={20}
          rows={10}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Company context, mandate, stakeholders, tone, constraints…"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {createdId ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          Persona created.{" "}
          <Link href={`/personas/${createdId}`} className="font-medium underline">
            View profile
          </Link>{" "}
          or{" "}
          <Link
            href={`/personas/${createdId}/chat`}
            className="font-medium underline"
          >
            open chat
          </Link>
          .
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? "Generating (can take a minute)…" : "Generate virtual executive"}
      </button>
    </form>
  );
}
