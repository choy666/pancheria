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

export type OrderStatus =
  | 'pending'
  | 'in_process'
  | 'paid'
  | 'finished'
  | 'cancelled';

export type DeliveryType = 'delivery' | 'pickup';

export type CashRegisterStatus = 'open' | 'closed';

export type StockMovementType =
  | 'sale'
  | 'cancellation'
  | 'manual_adjustment'
  | 'restock'
  | 'reserve'
  | 'reserve_release';

export type BranchOpeningHours = {
  dayOfWeek: number;
  open: string;
  close: string;
};

export type Branch = {
  id: number;
  name: string;
  openingHours: BranchOpeningHours[];
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
  customerPhone: string;
  deliveryType: DeliveryType;
  address: string | null;
  notes: string | null;
  cancellationToken: string;
  convertedSaleId: number | null;
  idempotencyKey: string | null;
  createdAt: Date;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  deletedAt: Date | null;
  items?: OrderItem[];
};

type OrderItem = {
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

export type OrderMessageSenderType = 'client' | 'operator';

export type OrderMessage = {
  id: number;
  orderId: number;
  senderType: OrderMessageSenderType;
  senderName: string | null;
  content: string | null;
  attachmentUrl: string | null;
  attachmentKey: string | null;
  attachmentMimeType: string | null;
  attachmentSize: number | null;
  attachmentName: string | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
};

export type OrderWithUnreadCount = OrderWithItems & {
  unreadCount: number;
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
