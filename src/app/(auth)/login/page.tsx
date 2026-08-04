import { signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function LoginPage() {
  async function handleSubmit(formData: FormData) {
    'use server';

    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    await signIn('credentials', {
      username,
      password,
      redirectTo: '/',
    });
  }

  return (
    <div className='flex min-h-full items-center justify-center p-4'>
      <Card className='w-full max-w-sm'>
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Sistema de gestión de la panchería</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='username'>Usuario</Label>
              <Input
                id='username'
                name='username'
                type='text'
                required
                autoComplete='username'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='password'>Contraseña</Label>
              <Input
                id='password'
                name='password'
                type='password'
                required
                autoComplete='current-password'
              />
            </div>
            <Button type='submit' className='w-full'>
              Ingresar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}