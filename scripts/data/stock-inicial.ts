/**
 * Carga de stock inicial para una sucursal ya provisionada con el catálogo
 * (`scripts/cargar-catalogo.ts` solo aplica `initialStock` a productos
 * NUEVOS; este archivo cubre la carga posterior).
 *
 * Lo consume `scripts/cargar-stock.ts`, que resuelve los nombres a IDs
 * reales de la sucursal y aplica `stockService.adjustStock` con movimiento
 * `restock` — dejando rastro en `stock_movements` igual que la carga por
 * `POST /api/stock/ajustar`.
 *
 * COMPLETAR ANTES DE `--apply`: `quantity: 0` significa "pendiente de
 * definir" y la entrada se omite con advertencia. Las cantidades son
 * datos del negocio (unidades físicas disponibles), no valores técnicos.
 *
 * `minStock` es opcional: activa la alerta "bajo" del panel
 * (`isLow` = stock <= min_stock) para ese insumo.
 *
 * Para agregar filas (p. ej. `manual_supply` del anotador manual) basta
 * una entrada más con el nombre EXACTO del producto — el script valida
 * contra la base y falla si el nombre no existe en la sucursal.
 */
export type StockInicialEntry = {
  /** Nombre exacto del producto (debe coincidir con `products.name`). */
  product: string;
  /** Unidades a ingresar como movimiento `restock`. 0 = pendiente (se omite). */
  quantity: number;
  /** Umbral de alerta "bajo" (`products.min_stock`). Se actualiza solo si difiere. */
  minStock?: number;
};

export const STOCK_INICIAL: StockInicialEntry[] = [
  // — Insumos críticos de receta (no vendibles; descuentan por promo) —
  { product: 'Pan super pancho', quantity: 0, minStock: 0 },
  { product: 'Salchichas', quantity: 0, minStock: 0 },

  // — Bebidas vendibles (critical_supply/beverage) —
  { product: 'Coca-Cola 1 L', quantity: 0 },
  { product: 'Coca-Cola 1,5 L', quantity: 0 },
  { product: 'Coca-Cola chica', quantity: 0 },
  { product: 'Doble cola 1 L', quantity: 0 },
  { product: 'Doble cola chica', quantity: 0 },
  { product: 'Pritty 1 L', quantity: 0 },
  { product: 'Pritty 500 cc', quantity: 0 },
  { product: 'Doble Cola 2,25 L', quantity: 0 },
  { product: 'Agua chica 500 ml', quantity: 0 },
  { product: 'Agua 1,5 L', quantity: 0 },
  { product: 'Agua de pera chica', quantity: 0 },
  { product: 'Agua de manzana chica', quantity: 0 },
  { product: 'Agua de pera 1 L', quantity: 0 },
  { product: 'Agua de manzana 1 L', quantity: 0 },
  { product: 'Agua de pomelo 1 L', quantity: 0 },
  { product: 'Fanta 1,5 L', quantity: 0 },
  { product: 'Jugo Tutti 475 ml', quantity: 0 },
  { product: 'Jugo Tutti 200 cc', quantity: 0 },
  { product: 'Cerveza grande 700 ml', quantity: 0 },
  { product: 'Cerveza chica 475 ml', quantity: 0 },
];
