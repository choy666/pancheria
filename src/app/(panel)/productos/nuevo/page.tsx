import { ProductForm } from '@/components/productos/product-form';

export default function NewProductPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo producto</h1>
      <ProductForm />
    </div>
  );
}
