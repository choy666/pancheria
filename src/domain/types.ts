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

export type PaymentPart = {
  method: PaymentMethod;
  amount: number;
};

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

export type BranchPhone = {
  label: string;
  number: string;
};

export type BranchSocialNetwork =
  | 'instagram'
  | 'facebook'
  | 'whatsapp'
  | 'tiktok'
  | 'x'
  | 'otro';

export type BranchSocialLink = {
  network: BranchSocialNetwork;
  url: string;
};

export type Branch = {
  id: number;
  name: string;
  openingHours: BranchOpeningHours[];
  address?: string | null;
  phones: BranchPhone[];
  socialLinks: BranchSocialLink[];
  location?: string | null;
  createdAt: Date;
};

/**
 * Estado de una caja abierta evaluado contra los turnos configurados de la
 * sucursal (horarios vigentes, timezone de sucursal):
 * - `en_turno`: la caja se abrió dentro del turno que sigue vigente.
 * - `fuera_de_horario`: el turno terminó (o la caja se abrió en un hueco) y
 *   todavía no comenzó el siguiente turno.
 * - `recomendar_cierre`: ya comenzó el primer turno posterior a la apertura;
 *   equivale al aviso anterior de "caja del día anterior".
 * - `sin_horarios`: la sucursal no tiene horarios configurados; se aplica el
 *   fallback por fecha calendario y umbral de horas.
 */
export type CashRegisterShiftStatus =
  | 'en_turno'
  | 'fuera_de_horario'
  | 'recomendar_cierre'
  | 'sin_horarios';

type CashRegisterAlertCode =
  | 'fuera_de_horario'
  | 'cierre_recomendado'
  | 'dia_anterior'
  | 'excedida';

export type CashRegisterAlert = {
  code: CashRegisterAlertCode;
  severity: 'info' | 'warning';
  detalle?: {
    horasUmbral?: number;
    aperturaEnTurno?: boolean;
    proximoTurno?: string;
    /** Días calendario (en timezone de sucursal) desde la apertura de la caja. */
    diasAbierta?: number;
  };
};

/**
 * Versión serializada del estado de turno que viaja en los payloads JSON
 * (`/api/caja/resumen`, `/api/panel/resumen`). Las fechas llegan como ISO.
 */
type CashRegisterShiftSlotDTO = {
  dayOfWeek: number;
  open: string;
  close: string;
  start: string;
  end: string;
};

export type CashRegisterShiftInfoDTO = {
  status: CashRegisterShiftStatus;
  aperturaEnTurno: boolean;
  currentShift: CashRegisterShiftSlotDTO | null;
  nextShiftStart: string | null;
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
  imageUrl?: string | null;
  imageKey?: string | null;
  imageMimeType?: string | null;
  imageSize?: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type RecipeItemConfig = {
  supplyId: number;
  supplyName: string;
  supplyType: ProductType;
  quantity: number;
  autoDiscount: boolean;
  isOptional: boolean;
  selected: boolean;
  selectedByDefault: boolean;
};

export type SaleItemInput = {
  productId: number;
  quantity: number;
  selectedRecipeItemIds?: number[];
  recipeSnapshot?: RecipeItemConfig[];
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

export type OrderItem = {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product?: ProductRow;
  recipeSnapshot?: RecipeItemConfig[];
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

export type PublicOrderItem = {
  productId: number;
  name: string;
  price: number;
  unit: string;
  quantity: number;
  recipeSnapshot?: RecipeItemConfig[];
};

export type StockMovement = {
  id: number;
  branchId: number;
  productId: number;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  saleId: number | null;
  orderId: number | null;
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
