import Link from "next/link";
import { notFound } from "next/navigation";

import { PersonaChatSection } from "@/components/personas/PersonaChatSection";
import { getPersonaMeta } from "@/lib/personas/store";

type PageProps = { params: Promise<{ id: string }> };

export default async function PersonaChatPage({ params }: PageProps) {
  const { id } = await params;
  const meta = await getPersonaMeta(id);
  if (!meta) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <p className="text-sm text-zinc-500">
        <Link href={`/personas/${id}`} className="underline">
          {meta.name}
        </Link>
      </p>
      <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Chat
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Messages use Claude with this persona&apos;s full skill package as
        system context.
      </p>
      <PersonaChatSection personaId={id} />
    </main>
  );
}
