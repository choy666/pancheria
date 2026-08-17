import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { routes } from '@/config/routes';
import { LoginForm } from './login-form';

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();

  if (session?.user) {
    redirect(routes.home);
  }

  const { error } = await searchParams;
  return <LoginForm errorQuery={error} />;
}
