import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Create Virtual Executive
        </Link>
        <nav className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/create" className="hover:text-zinc-900 dark:hover:text-zinc-200">
            Create
          </Link>
          <Link href="/personas" className="hover:text-zinc-900 dark:hover:text-zinc-200">
            Personas
          </Link>
        </nav>
      </div>
    </header>
  );
}
