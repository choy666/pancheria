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
  isActive: boolean;
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
  /**
   * Tope de insumos opcionales seleccionables por unidad en una promo
   * compuesta (ej. 4 aderezos). `null`/`undefined` = sin límite.
   */
  maxOptionalSelections?: number | null;
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
  /**
   * `null` cuando el insumo fue eliminado definitivamente: el snapshot de
   * receta sobrevive al producto (`supply_name`/`supply_type` son la fuente
   * de verdad para mostrar y para los resúmenes de consumo).
   */
  supplyId: number | null;
  supplyName: string;
  supplyType: ProductType;
  quantity: number;
  autoDiscount: boolean;
  isOptional: boolean;
  selected: boolean;
  selectedByDefault: boolean;
};

/**
 * Ítem de receta en contexto vivo (carrito, catálogo, diálogo de
 * personalización): se construye desde la receta vigente del producto,
 * así que `supplyId` siempre apunta a un producto existente. Para
 * snapshots históricos usar `RecipeItemConfig`, donde puede ser `null`.
 */
export type CartRecipeItem = Omit<RecipeItemConfig, 'supplyId'> & {
  supplyId: number;
};

export type SaleItemInput = {
  productId: number;
  quantity: number;
  selectedRecipeItemIds?: number[];
  recipeSnapshot?: RecipeItemConfig[];
  notes?: string | null;
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
  /** URL canónica del pin de entrega (`delivery`); `null` en pickup/legacy. */
  deliveryLocation: string | null;
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
  /** `null` si el producto fue eliminado definitivamente. */
  productId: number | null;
  /** Snapshot del producto al momento del pedido: sobrevive al purge. */
  productName: string;
  productType: ProductType;
  criticalSupplyType: CriticalSupplyType | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string | null;
  product?: ProductRow | null;
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
  productId: number | null;
  name: string;
  price: number;
  unit: string;
  quantity: number;
  notes?: string | null;
  recipeSnapshot?: RecipeItemConfig[];
};

export type StockMovement = {
  id: number;
  branchId: number;
  /** `null` si el producto fue eliminado definitivamente. */
  productId: number | null;
  /** Snapshot del nombre para mantener legible el historial. */
  productName: string;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  performedBy: string | null;
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

/**
 * Modo de la playlist de la pantalla publicitaria (`pantalla_settings`):
 * `auto` rota el catálogo con stock + videos activos; `custom` usa solo la
 * playlist explícita de `pantalla_items`.
 */
export type PantallaPlaylistMode = 'auto' | 'custom';

/** Referencia de un ítem de playlist de pantalla: producto o video. */
export type PantallaItemKind = 'product' | 'video';

export type PantallaSettingsRow = {
  branchId: number;
  playlistMode: PantallaPlaylistMode;
  productoMs: number;
  sucursalMs: number;
  qrMs: number;
  videoMaxMs: number;
  maxProductos: number;
  showBranchScene: boolean;
  showQrScene: boolean;
  updatedAt: Date;
};

export type PantallaItemRow = {
  id: number;
  branchId: number;
  kind: PantallaItemKind;
  productId: number | null;
  videoId: number | null;
  position: number;
  isEnabled: boolean;
  createdAt: Date;
};

/**
 * Escala tipográfica del menú digital (`menu_settings.font_scale`):
 * `normal` es el tamaño base; `large` agranda los textos un paso para
 * lectura a mayor distancia.
 */
export type MenuFontScale = 'normal' | 'large';

/**
 * Estilo de la tarjeta del menú (`menu_settings.card_style`): `image`
 * apila foto sobre texto; `compact` pone imagen lateral y texto a la derecha.
 */
export type MenuCardStyle = 'image' | 'compact';

/**
 * Orden de los productos dentro de cada categoría del menú
 * (`menu_settings.sort_order`): `catalog` conserva el orden del
 * agrupamiento público; `price_asc`/`price_desc` reordenan por precio.
 */
export type MenuSortOrder = 'catalog' | 'price_asc' | 'price_desc';

export type MenuSettingsRow = {
  branchId: number;
  paginaMs: number;
  filasPagina: number;
  gridColumns: number;
  fontScale: MenuFontScale;
  showDescriptions: boolean;
  cardStyle: MenuCardStyle;
  sortOrder: MenuSortOrder;
  showQrStrip: boolean;
  hiddenProductIds: number[];
  featuredProductIds: number[];
  qrStripText: string;
  updatedAt: Date;
};

export type BrandAnnouncementVariant = 'info' | 'warning';

export type BrandFaqItem = {
  question: string;
  answer: string;
};

/**
 * Identidad de marca de la plataforma pública (`brand_settings`). `logoUpdatedAt`
 * versiona la URL del logo para que el navegador no sirva una versión vieja tras
 * reemplazarlo; `null` significa sin logo. Los bytes del logo no viajan acá.
 */
export type BrandSettings = {
  name: string | null;
  tagline: string | null;
  logoUpdatedAt: Date | null;
  legalName: string | null;
  taxId: string | null;
  supportEmail: string | null;
  termsUrl: string | null;
  privacyUrl: string | null;
  footerAbout: string | null;
  paymentMethods: string | null;
  developedBy: string | null;
  showHours: boolean;
  showMap: boolean;
  showSocial: boolean;
  faq: BrandFaqItem[];
  announcementText: string | null;
  announcementEnabled: boolean;
  announcementVariant: BrandAnnouncementVariant;
};

export type BrandLogo = {
  data: Buffer;
  mimeType: string;
  updatedAt: Date;
};
