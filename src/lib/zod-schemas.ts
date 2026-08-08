import { z } from 'zod';

export const productTypeSchema = z.enum([
  'critical_supply',
  'compound',
  'manual_supply',
  'service',
]);

export const criticalSupplyTypeSchema = z.enum(['bread', 'sausage', 'beverage']);

const productBaseSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  type: productTypeSchema,
  criticalSupplyType: criticalSupplyTypeSchema.optional().nullable(),
  price: z.coerce.number().nonnegative(),
  unit: z.string().min(1).max(50),
  stock: z.coerce.number().int().nonnegative().default(0),
  minStock: z.coerce.number().int().nonnegative().default(0),
  isActive: z.coerce.boolean().default(true),
});

export const productSchema = productBaseSchema
  .refine(
    (data) => !(data.type === 'critical_supply' && !data.criticalSupplyType),
    {
      message: 'Los insumos críticos deben tener un tipo de insumo crítico.',
      path: ['criticalSupplyType'],
    }
  )
  .refine(
    (data) => !(data.type !== 'critical_supply' && data.criticalSupplyType),
    {
      message: 'Solo los insumos críticos pueden tener un tipo de insumo crítico.',
      path: ['criticalSupplyType'],
    }
  );

// Esquema parcial para actualizaciones: no incluye el .refine() cruzado
// porque Zod v4 no permite .partial() sobre esquemas con refinamientos.
// La validación cruzada sigue ejecutándose en productService.updateProduct.
export const productUpdateSchema = productBaseSchema.partial();

export const recipeItemSchema = z
  .object({
    supplyId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    autoDiscount: z.boolean(),
    supplyType: productTypeSchema.optional(),
  })
  .refine(
    (data) =>
      !data.autoDiscount ||
      !data.supplyType ||
      data.supplyType === 'critical_supply',
    {
      message: 'Solo los insumos críticos pueden tener descuento automático.',
      path: ['autoDiscount'],
    }
  );

export const recipeSchema = z
  .object({
    compoundProductId: z.number().int().positive(),
    items: z.array(recipeItemSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const supplyIds = data.items.map((item) => item.supplyId);

    if (new Set(supplyIds).size !== supplyIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'No puede haber insumos duplicados en la receta.',
        path: ['items'],
      });
    }

    if (supplyIds.includes(data.compoundProductId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Una receta no puede incluir al propio producto compuesto como insumo.',
        path: ['items'],
      });
    }
  });

export const saleItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

export const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  paymentMethod: z.enum(['cash', 'transfer']),
  idempotencyKey: z.string().min(1),
});

export const stockAdjustmentSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int(),
  reason: z.string().min(3).max(500),
});

export const cancellationSchema = z.object({
  reason: z.string().min(3).max(500),
});
