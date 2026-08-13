import { Money } from '@/lib/money';

export type PaginationParams = {
  page: number;
  limit: number;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type ProductType = 'critical_supply' | 'compound' | 'manual_supply' | 'service';

export type CriticalSupplyType = 'bread' | 'sausage' | 'beverage';

export type PaymentMethod = 'cash' | 'transfer';

export type SaleStatus = 'active' | 'cancelled';

export type CashRegisterStatus = 'open' | 'closed';

export type StockMovementType =
  | 'sale'
  | 'cancellation'
  | 'manual_adjustment'
  | 'restock';

export type Branch = {
  id: number;
  name: string;
  createdAt: Date;
};

export type ProductRow = {
  id: number;
  branchId: number;
  name: string;
  description: string | null;
  type: ProductType;
  criticalSupplyType: CriticalSupplyType | null;
  price: number;
  unit: string;
  stock: number;
  minStock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type Product = {
  id: number;
  branchId: number;
  name: string;
  description: string | null;
  type: ProductType;
  criticalSupplyType: CriticalSupplyType | null;
  price: Money;
  unit: string;
  stock: number;
  minStock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type RecipeItem = {
  id: number;
  compoundProductId: number;
  supplyId: number;
  quantity: number;
  autoDiscount: boolean;
  supply?: Product;
};

export type SaleItemInput = {
  productId: number;
  quantity: number;
};

export type SaleItem = {
  id: number;
  saleId: number;
  productId: number;
  quantity: number;
  unitPrice: Money;
  subtotal: Money;
  product?: Product;
};

export type Sale = {
  id: number;
  branchId: number;
  total: Money;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  cashRegisterId: number | null;
  cashRegister?: CashRegister | null;
  idempotencyKey: string | null;
  createdAt: Date;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  items?: SaleItem[];
};

export type CashRegister = {
  id: number;
  branchId: number;
  openedAt: Date;
  closedAt: Date | null;
  openedBy: string;
  closedBy: string | null;
  status: CashRegisterStatus;
  autoClosed: boolean;
  total: Money;
  cashTotal: Money;
  transferTotal: Money;
  totalSales: number;
  productsSummary: Record<string, number>;
  criticalSuppliesSummary: Record<string, number>;
  createdAt: Date;
  deletedAt: Date | null;
  sales?: Sale[];
};

export type StockMovement = {
  id: number;
  branchId: number;
  productId: number;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  saleId: number | null;
  createdAt: Date;
};

export type DailyClosure = {
  id: number;
  branchId: number;
  date: Date;
  total: Money;
  cashTotal: Money;
  transferTotal: Money;
  totalSales: number;
  productsSummary: Record<string, number>;
  criticalSuppliesSummary: Record<string, number>;
  createdAt: Date;
};
