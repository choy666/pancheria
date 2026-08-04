import { notFound } from 'next/navigation';
import { RecipeEditor } from '@/components/productos/recipe-editor';
import * as productService from '@/application/services/productService';

interface PageParams {
  params: Promise<{ productId: string }>;
}

export default async function EditRecipePage({ params }: PageParams) {
  const { productId } = await params;
  const product = await productService.getProductById(Number(productId));

  if (product.type !== 'compound') {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Receta: {product.name}</h1>
      <RecipeEditor productId={product.id} />
    </div>
  );
}
