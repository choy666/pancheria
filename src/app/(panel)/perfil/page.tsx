import { auth } from '@/auth';
import { ChangePasswordForm } from '@/components/usuarios/change-password-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function PerfilPage() {
  const session = await auth();
  const userName = session?.user?.name ?? '';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="text-base text-muted-foreground">
          Gestión de tu cuenta y contraseña.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del usuario</CardTitle>
          <CardDescription>
            Nombre de usuario con el que iniciás sesión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p
            data-testid="profile-username"
            className="text-base text-muted-foreground"
          >
            {userName}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
          <CardDescription>
            Completá los campos para actualizar tu contraseña de acceso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
