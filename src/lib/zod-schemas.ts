import { z } from 'zod';

export const productTypeSchema = z.enum([
  'critical_supply',
  'compound',
  'manual_supply',
]);

export const criticalSupplyTypeSchema = z.enum(['bread', 'sausage', 'beverage']);

export const productSchema = z.object({
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

export const recipeItemSchema = z.object({
  supplyId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  autoDiscount: z.boolean(),
});

export const recipeSchema = z.object({
  compoundProductId: z.number().int().positive(),
  items: z.array(recipeItemSchema).min(1),
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
