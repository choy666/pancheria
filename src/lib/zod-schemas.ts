import { z } from 'zod';
import { getChatMaxTextLength } from '@/config/chat';
import { ITEM_NOTE_MAX_LENGTH } from '@/lib/cart-helpers';

const MAX_ITEMS_PER_LIST = 100;
const MAX_ITEM_QUANTITY = 999;
const MAX_ORDER_NUMBER_LENGTH = 100;

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
  maxOptionalSelections: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable(),
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
  )
  .refine(
    (data) => !(data.type !== 'compound' && data.maxOptionalSelections != null),
    {
      message:
        'Solo los productos compuestos pueden tener un tope de opcionales.',
      path: ['maxOptionalSelections'],
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
  )
  .refine(
    (data) => !(data.type !== 'compound' && data.maxOptionalSelections != null),
    {
      message:
        'Solo los productos compuestos pueden tener un tope de opcionales.',
      path: ['maxOptionalSelections'],
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
    items: z.array(recipeItemSchema).min(1).max(MAX_ITEMS_PER_LIST),
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
  quantity: z.number().int().positive().max(MAX_ITEM_QUANTITY),
  selectedRecipeItemIds: z
    .array(z.number().int().positive())
    .max(MAX_ITEMS_PER_LIST)
    .optional()
    .default([]),
  notes: z.string().trim().max(ITEM_NOTE_MAX_LENGTH).optional().nullable(),
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
  items: z.array(saleItemSchema).min(1).max(MAX_ITEMS_PER_LIST),
  payments: paymentPartsSchema,
  idempotencyKey: z.string().min(1),
});

export const cartAvailabilitySchema = z.object({
  items: z.array(saleItemSchema).max(MAX_ITEMS_PER_LIST),
  productIds: z.array(z.number().int().positive()).max(500).optional(),
});

/**
 * Tipos de movimiento que un operador puede registrar vía /api/stock/ajustar.
 * Los demás tipos (`sale`, `reserve`, etc.) son internos del sistema y no se
 * aceptan por este endpoint.
 */
const stockAdjustmentTypeSchema = z.enum(['manual_adjustment', 'restock']);

export const stockAdjustmentSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int(),
  reason: z.string().min(3).max(500),
  type: stockAdjustmentTypeSchema.default('manual_adjustment'),
});

export const cancellationSchema = z.object({
  reason: z.string().min(3).max(500),
});

const phoneRegex = /^\+?\d{8,15}$/;

export const orderSchema = z
  .object({
    items: z.array(saleItemSchema).min(1).max(MAX_ITEMS_PER_LIST),
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

/**
 * Configuración de la pantalla publicitaria (una fila por sucursal en
 * `pantalla_settings`). Las duraciones viajan en milisegundos; la UI del
 * panel las convierte a segundos. Los límites replican los mínimos de
 * `src/config/pantalla.ts` (mínimo 1 s por escena) y agregan un tope sanos
 * de 10 minutos para evitar errores de tipeo que congelen la pantalla.
 */
const pantallaDurationMsSchema = z.coerce
  .number()
  .int({ message: 'La duración debe ser un número entero de milisegundos.' })
  .min(1000, { message: 'La duración mínima de una escena es 1 segundo.' })
  .max(600_000, {
    message: 'La duración máxima de una escena es 600 segundos (10 minutos).',
  });

export const pantallaSettingsSchema = z.object({
  playlistMode: z.enum(['auto', 'custom']),
  productoMs: pantallaDurationMsSchema,
  sucursalMs: pantallaDurationMsSchema,
  qrMs: pantallaDurationMsSchema,
  videoMaxMs: pantallaDurationMsSchema,
  maxProductos: z.coerce
    .number()
    .int({ message: 'El máximo de productos debe ser un número entero.' })
    .min(1, { message: 'El máximo de productos debe ser al menos 1.' })
    .max(200, { message: 'El máximo de productos no puede superar 200.' }),
  showBranchScene: z.boolean(),
  showQrScene: z.boolean(),
});

/**
 * Configuración del menú digital `/menu`: duración de cada página al rotar,
 * presupuesto de filas y columnas de la grilla, escala tipográfica, estilo
 * de tarjeta, orden dentro de cada categoría, si se muestra la franja QR
 * fija (y su CTA), las descripciones y la curaduría de productos ocultos y
 * destacados del tablero.
 */
export const menuSettingsSchema = z.object({
  paginaMs: pantallaDurationMsSchema,
  filasPagina: z.coerce
    .number()
    .int({ message: 'Las filas por página deben ser un número entero.' })
    .min(1, { message: 'Debe entrar al menos una fila por página.' })
    .max(12, {
      message: 'Más de 12 filas por página hace ilegible el menú en la TV.',
    }),
  gridColumns: z.coerce
    .number()
    .int({ message: 'Las columnas de la grilla deben ser un número entero.' })
    .min(3, { message: 'La grilla del menú admite al menos 3 columnas.' })
    .max(5, { message: 'Más de 5 columnas hace ilegible el menú en la TV.' }),
  fontScale: z.enum(['normal', 'large'], {
    message: 'La escala de texto debe ser normal o grande.',
  }),
  showDescriptions: z.boolean(),
  cardStyle: z.enum(['image', 'compact'], {
    message: 'El estilo de tarjeta debe ser imagen o compacta.',
  }),
  sortOrder: z.enum(['catalog', 'price_asc', 'price_desc'], {
    message: 'El orden debe ser catálogo, precio ascendente o precio descendente.',
  }),
  showQrStrip: z.boolean(),
  hiddenProductIds: z
    .array(z.number().int().positive(), {
      message: 'Los productos ocultos deben ser una lista de IDs.',
    })
    .max(500, {
      message: 'No se pueden ocultar más de 500 productos del menú.',
    })
    .default([]),
  featuredProductIds: z
    .array(z.number().int().positive(), {
      message: 'Los productos destacados deben ser una lista de IDs.',
    })
    .max(50, {
      message: 'No se pueden destacar más de 50 productos del menú.',
    })
    .default([]),
  qrStripText: z
    .string()
    .trim()
    .min(1, { message: 'El texto de la franja QR no puede quedar vacío.' })
    .max(60, {
      message: 'El texto de la franja QR admite hasta 60 caracteres.',
    }),
});

const pantallaPlaylistItemSchema = z.object({
  kind: z.enum(['product', 'video']),
  refId: z.number().int().positive(),
  isEnabled: z.boolean().default(true),
});

/**
 * Playlist explícita de la pantalla (modo `custom`): el orden del array es
 * el orden del ciclo; `position` se reescribe como el índice al guardar.
 * Se rechazan duplicados (misma referencia producto/video dos veces).
 */
export const pantallaPlaylistSchema = z
  .array(pantallaPlaylistItemSchema)
  .max(100, { message: 'La playlist no puede tener más de 100 ítems.' })
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    for (const item of items) {
      const key = `${item.kind}:${item.refId}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'No puede haber ítems duplicados en la playlist.',
          path: ['items'],
        });
        return;
      }
      seen.add(key);
    }
  });

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

/**
 * Parámetros del stream SSE de chat (`.../chat/stream`). `interval` y
 * `budget` permiten acotar la conexión en tests; los valores efectivos se
 * clampean contra la configuración del servidor en la ruta.
 */
export const chatStreamQuerySchema = z.object({
  after: z.coerce.number().int().nonnegative().optional(),
  interval: z.coerce.number().int().positive().optional(),
  budget: z.coerce.number().int().positive().optional(),
});

export const orderTrackingSchema = z.object({
  orderNumber: z.string().min(1).max(MAX_ORDER_NUMBER_LENGTH),
  branchId: z.coerce.number().int().positive().optional(),
  customerName: z
    .string()
    .trim()
    .min(1, { message: 'Ingresá tu nombre.' })
    .max(255),
  customerPhone: z
    .string()
    .trim()
    .min(1, { message: 'Ingresá tu teléfono.' })
    .refine(
      (value) => value === '' || phoneRegex.test(value.replace(/\s/g, '')),
      {
        message:
          'El teléfono debe contener entre 8 y 15 dígitos, opcionalmente con un signo + al inicio.',
      }
    ),
});
