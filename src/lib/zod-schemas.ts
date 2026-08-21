import { z } from 'zod';

const productTypeSchema = z.enum([
  'critical_supply',
  'compound',
  'manual_supply',
  'service',
]);

const criticalSupplyTypeSchema = z.enum(['bread', 'sausage', 'beverage']);

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
  )
  .refine(
    (data) => !(data.type === 'manual_supply' && data.price !== 0),
    {
      message: 'Los insumos manuales no pueden tener precio.',
      path: ['price'],
    }
  );

export const productUpdateSchema = productBaseSchema
  .partial()
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
  )
  .refine(
    (data) => !(data.type === 'manual_supply' && data.price !== 0),
    {
      message: 'Los insumos manuales no pueden tener precio.',
      path: ['price'],
    }
  );

export const recipeItemSchema = z
  .object({
    supplyId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    autoDiscount: z.boolean(),
    supplyType: productTypeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.supplyType || data.supplyType === 'critical_supply') {
      return;
    }

    const message = data.autoDiscount
      ? 'Solo los insumos críticos pueden tener descuento automático.'
      : 'La receta solo puede incluir insumos críticos.';

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: ['supplyType'],
    });
  });

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

const saleItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

export const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  paymentMethod: z.enum(['cash', 'transfer']),
  idempotencyKey: z.string().min(1),
});

export const cartAvailabilitySchema = z.object({
  items: z.array(saleItemSchema),
  productIds: z.array(z.number().int().positive()).optional(),
});

const stockMovementTypeSchema = z.enum([
  'sale',
  'cancellation',
  'manual_adjustment',
  'restock',
]);

export const stockAdjustmentSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int(),
  reason: z.string().min(3).max(500),
  type: stockMovementTypeSchema.default('manual_adjustment'),
});

export const cancellationSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const orderSchema = z
  .object({
    items: z.array(saleItemSchema).min(1),
    customerName: z.string().min(1).max(255),
    deliveryType: z.enum(['delivery', 'pickup']),
    address: z.string().max(500).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    idempotencyKey: z.string().min(1).max(255),
  })
  .refine(
    (data) =>
      data.deliveryType !== 'delivery' ||
      (data.address !== undefined &&
        data.address !== null &&
        data.address.trim().length > 0),
    {
      message: 'La dirección es obligatoria para envío a domicilio.',
      path: ['address'],
    }
  );

export const orderConfirmSchema = z.object({
  paymentMethod: z.enum(['cash', 'transfer']),
  idempotencyKey: z.string().min(1),
});

export const branchIdQueryParamSchema = z.coerce.number().int().positive();

export const orderCancellationSchema = z.object({
  reason: z.string().min(3).max(500),
  token: z.string().optional(),
});

export const videoSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  fileUrl: z.string().min(1).url(),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().nonnegative().optional().nullable(),
  isActive: z.coerce.boolean().default(true),
});

export const videoUpdateSchema = videoSchema.partial();

export const chatMessageContentSchema = z.object({
  content: z.string().min(1),
});
