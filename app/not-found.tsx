import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Erro 404</p>
        <h1 className="mt-3 text-3xl font-bold text-foreground">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A rota solicitada não existe ou foi movida para outro local.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}

