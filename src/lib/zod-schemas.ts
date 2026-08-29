import { z } from 'zod';
import { getChatMaxTextLength } from '@/config/chat';

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
  imageUrl: z.string().url().max(2048).optional().nullable(),
  imageKey: z.string().max(255).optional().nullable(),
  imageMimeType: z.string().max(100).optional().nullable(),
  imageSize: z.coerce.number().int().nonnegative().optional().nullable(),
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
    isOptional: z.boolean().optional(),
    selectedByDefault: z.boolean().optional(),
    supplyType: productTypeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.supplyType) {
      return;
    }

    if (data.supplyType === 'critical_supply') {
      if (data.isOptional === true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Los insumos críticos no pueden ser opcionales.',
          path: ['isOptional'],
        });
      }
      if (data.autoDiscount !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Los insumos críticos deben tener descuento automático.',
          path: ['autoDiscount'],
        });
      }
      if (data.selectedByDefault === true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'selectedByDefault no aplica a insumos críticos.',
          path: ['selectedByDefault'],
        });
      }
      return;
    }

    if (data.autoDiscount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Solo los insumos críticos pueden tener descuento automático.',
        path: ['autoDiscount'],
      });
    }

    if (data.isOptional === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Los insumos manuales y servicios son siempre opcionales.',
        path: ['isOptional'],
      });
    }

    if (data.selectedByDefault === true && data.isOptional === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'selectedByDefault solo puede ser true si isOptional es true.',
        path: ['selectedByDefault'],
      });
    }
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

    const hasTypedCritical = data.items.some(
      (item) => item.supplyType === 'critical_supply' && item.autoDiscount
    );

    if (hasTypedCritical || data.items.every((item) => item.supplyType)) {
      if (!hasTypedCritical) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'La receta debe incluir al menos un insumo crítico con descuento automático.',
          path: ['items'],
        });
      }
    }
  });

const saleItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  selectedRecipeItemIds: z.array(z.number().int().positive()).optional().default([]),
});

const paymentPartSchema = z.object({
  method: z.enum(['cash', 'transfer']),
  amount: z.number().positive(),
});

const paymentPartsSchema = z
  .array(paymentPartSchema)
  .min(1)
  .superRefine((parts, ctx) => {
    const methods = new Set(parts.map((part) => part.method));
    if (methods.size !== parts.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'No puede haber más de una parte por medio de pago.',
        path: ['payments'],
      });
    }
  });

export const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  payments: paymentPartsSchema,
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
  'reserve',
  'reserve_release',
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

const phoneRegex = /^\+?\d{8,15}$/;

export const orderSchema = z
  .object({
    items: z.array(saleItemSchema).min(1),
    customerName: z.string().min(1).max(255),
    customerPhone: z
      .string()
      .min(1)
      .max(20)
      .refine((value) => phoneRegex.test(value.replace(/\s/g, '')), {
        message:
          'El teléfono debe contener entre 8 y 15 dígitos, opcionalmente con un signo + al inicio.',
      }),
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
  payments: paymentPartsSchema,
  idempotencyKey: z.string().min(1),
});

export const branchIdQueryParamSchema = z.coerce.number().int().positive();

export const orderCancellationSchema = z.object({
  reason: z.string().min(3).max(500),
  token: z.string().min(1),
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
  content: z
    .string()
    .min(1)
    .refine((value) => value.length <= getChatMaxTextLength(), {
      message: `El contenido no puede superar los ${getChatMaxTextLength()} caracteres.`,
    }),
});

export const chatPaginationQuerySchema = z
  .object({
    limit: z.coerce.number().int().positive().max(100).optional(),
    before: z.coerce.number().int().positive().optional(),
    after: z.coerce.number().int().nonnegative().optional(),
  })
  .refine((data) => !(data.before !== undefined && data.after !== undefined), {
    message: 'No se puede usar before y after al mismo tiempo.',
  });

export const orderTrackingSchema = z.object({
  orderNumber: z.string().min(1),
  customerName: z.string().optional(),
  customerPhone: z
    .string()
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value === '' ||
        phoneRegex.test(value.replace(/\s/g, '')),
      {
        message:
          'El teléfono debe contener entre 8 y 15 dígitos, opcionalmente con un signo + al inicio.',
      }
    ),
});
