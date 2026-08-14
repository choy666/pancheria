import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">404</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Esta página no se pudo encontrar.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 min-w-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
