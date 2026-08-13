import { notFound } from 'next/navigation';
import { ProductForm } from '@/components/productos/product-form';
import { PromoForm } from '@/components/productos/promo-form';
import * as productService from '@/application/services/productService';
import { auth } from '@/auth';

interface PageParams {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: PageParams) {
  const session = await auth();
  const branchId = Number(session?.user?.branchId);

  const { id } = await params;
  const product = await productService.getProductById(branchId, Number(id));

  if (!product) {
    notFound();
  }

  const isPromo = product.type === 'compound';

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isPromo ? 'Editar promo' : 'Editar producto'}
      </h1>
      {isPromo ? (
        <PromoForm product={product} />
      ) : (
        <ProductForm product={product} />
      )}
    </div>
  );
}
