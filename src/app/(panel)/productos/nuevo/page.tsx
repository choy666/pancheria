import { ProductFormTabs } from '@/components/productos/product-form-tabs';

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
