import { ProductForm } from '@/components/productos/product-form';

export default function NewProductPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nuevo producto</h1>
      <ProductForm />
    </div>
  );
}
