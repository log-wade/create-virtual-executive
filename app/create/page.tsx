import { CreatePersonaForm } from "@/components/CreatePersonaForm";

export default function CreatePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Create virtual executive
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Optional industry templates ground decision style and communications;
        your description stays in control.
      </p>
      <div className="mt-8">
        <CreatePersonaForm />
      </div>
    </main>
  );
}
