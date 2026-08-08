'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ProductForm } from './product-form';
import { PromoForm } from './promo-form';

type FormTab = 'product' | 'promo';

interface ProductFormTabsProps {
  initialTab?: FormTab;
}

export function ProductFormTabs({ initialTab = 'product' }: ProductFormTabsProps) {
  const [tab, setTab] = useState<FormTab>(initialTab);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === 'product' ? 'default' : 'outline'}
          onClick={() => setTab('product')}
        >
          Producto
        </Button>
        <Button
          type="button"
          variant={tab === 'promo' ? 'default' : 'outline'}
          onClick={() => setTab('promo')}
        >
          Promo
        </Button>
      </div>

      {tab === 'product' ? <ProductForm /> : <PromoForm />}
    </div>
  );
}
