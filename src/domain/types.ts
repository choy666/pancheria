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

export type OrderStatus = 'pending' | 'converted' | 'cancelled';

export type DeliveryType = 'delivery' | 'pickup';

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

export type SaleItemInput = {
  productId: number;
  quantity: number;
};

export type Order = {
  id: number;
  branchId: number;
  orderNumber: string;
  total: number;
  status: OrderStatus;
  customerName: string;
  deliveryType: DeliveryType;
  address: string | null;
  notes: string | null;
  cancellationToken: string;
  convertedSaleId: number | null;
  idempotencyKey: string | null;
  createdAt: Date;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  sentAt: Date | null;
  deletedAt: Date | null;
  items?: OrderItem[];
};

export type OrderItem = {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product?: ProductRow;
};

export type OrderWithItems = Order & {
  items: OrderItem[];
  branch?: Branch;
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

export type VideoRow = {
  id: number;
  branchId: number;
  title: string;
  description: string | null;
  fileUrl: string;
  mimeType: string;
  size: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
