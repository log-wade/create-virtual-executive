import Link from "next/link";
import { notFound } from "next/navigation";

import { getPersonaMeta, loadPersonaPackage } from "@/lib/personas/store";

type PageProps = { params: Promise<{ id: string }> };

export default async function PersonaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const meta = await getPersonaMeta(id);
  if (!meta) notFound();

  const pkg = await loadPersonaPackage(id);
  const preview = pkg?.["SKILL.md"]?.slice(0, 3500) ?? "";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <p className="text-sm text-zinc-500">
        <Link href="/personas" className="underline">
          Personas
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {meta.name}
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        {meta.title}
        {meta.company ? ` · ${meta.company}` : ""}
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href={`/personas/${id}/chat`}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Open chat
        </Link>
      </div>
      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          SKILL.md preview
        </h2>
        <pre className="mt-2 max-h-[480px] overflow-auto rounded-xl border border-zinc-200 bg-white p-4 text-xs leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          {preview}
          {pkg?.["SKILL.md"] && pkg["SKILL.md"].length > preview.length
            ? "\n\n…"
            : ""}
        </pre>
      </section>
    </main>
  );
}
