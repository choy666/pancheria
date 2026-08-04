import { notFound } from 'next/navigation';
import { ProductForm } from '@/components/productos/product-form';
import * as productService from '@/application/services/productService';

interface PageParams {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: PageParams) {
  const { id } = await params;
  const product = await productService.getProductById(Number(id));

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Editar producto</h1>
      <ProductForm product={product} />
    </div>
  );
}
