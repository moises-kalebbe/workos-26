import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="mb-3 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-4 text-lg text-muted-foreground">Pagina nao encontrada</p>
        <Link href="/" className="text-primary underline hover:text-primary/90">
          Voltar para o inicio
        </Link>
      </div>
    </div>
  );
}


