import Link from "next/link";

import { listPersonas } from "@/lib/personas/store";

export default async function PersonasPage() {
  const personas = await listPersonas();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Personas
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Generated virtual employees on this server instance.
      </p>

      {personas.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          No personas yet.{" "}
          <Link href="/create" className="font-medium text-zinc-900 underline dark:text-zinc-100">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {personas.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {p.name}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {p.title}
                    {p.company ? ` · ${p.company}` : ""}
                  </p>
                </div>
                <div className="flex gap-3 text-sm">
                  <Link
                    href={`/personas/${p.id}`}
                    className="text-zinc-700 underline dark:text-zinc-300"
                  >
                    Profile
                  </Link>
                  <Link
                    href={`/personas/${p.id}/chat`}
                    className="font-medium text-zinc-900 underline dark:text-zinc-100"
                  >
                    Chat
                  </Link>
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                {new Date(p.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
