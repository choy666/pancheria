import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ProductFormTabs } from '@/components/productos/product-form-tabs';
import { routes } from '@/config/routes';

interface NewProductPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function tabFromSearchParam(
  param: string | string[] | undefined
): 'product' | 'promo' {
  return param === 'promo' ? 'promo' : 'product';
}

export default async function NewProductPage({
  searchParams,
}: NewProductPageProps) {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect(routes.home);
  }

  const params = await searchParams;
  const initialTab = tabFromSearchParam(params.tab);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        Nuevo producto o promo
      </h1>
      <ProductFormTabs initialTab={initialTab} />
    </div>
  );
}
