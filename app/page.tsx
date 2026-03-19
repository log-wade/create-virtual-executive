import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Autonomous virtual executives
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Describe the role you need. The app generates a full six-file persona
          (skill package), then you can chat with them in character—powered by
          Claude and the Virtual Employee Creator specification.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/create"
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Create an executive
        </Link>
        <Link
          href="/personas"
          className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
        >
          View personas
        </Link>
      </div>
      <section className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
          MVP note
        </h2>
        <p className="mt-2">
          There is no sign-in yet—personas are stored on the server under{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">data/personas/</code>.
          Add auth, Stripe, and a real database before production.
        </p>
      </section>
    </main>
  );
}
