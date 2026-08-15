import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { routes } from '@/config/routes';

interface BranchRequiredFallbackProps {
  role?: string | null;
  signOutAction: () => Promise<void>;
}

export function BranchRequiredFallback({
  role,
  signOutAction,
}: BranchRequiredFallbackProps) {
  const isAdmin = role === 'admin';

  return (
    <div className="flex min-h-full flex-col">
      <main className="flex flex-1 items-center justify-center p-4 md:p-6 lg:p-8">
        <Card className="w-full max-w-md rounded-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Sucursal requerida
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base text-muted-foreground">
              {isAdmin
                ? 'No tenés una sucursal asignada. Para continuar, ejecutá el seed del proyecto (npx tsx src/db/seeds.ts) o asigná manualmente una sucursal al usuario administrador en la base de datos.'
                : 'No tenés una sucursal asignada. Contactá al administrador para que te asigne una sucursal.'}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {isAdmin && (
                <Link
                  href={routes.sucursales}
                  className={cn(
                    buttonVariants({ variant: 'outline' }),
                    'w-full sm:w-auto'
                  )}
                >
                  Ir a Sucursales
                </Link>
              )}
              <form action={signOutAction} className="w-full sm:w-auto">
                <Button type="submit" className="w-full sm:w-auto">
                  Cerrar sesión
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
