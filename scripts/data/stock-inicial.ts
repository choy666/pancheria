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
 * CARGA DE PRUEBA (2026-10-08): cantidades de prueba para la sucursal
 * Panchería Popular — critical_supply ×20, manual_supply ×5, service ×20
 * (los `compound` no llevan stock: su consumo sale de la receta).
 * Atención: `restock` es ADITIVO — correr `--apply` dos veces duplica
 * las cantidades. Antes de abrir al público reemplazar por los conteos
 * reales del negocio.
 *
 * Semántica del dominio (ver `deductStockForItems` en saleService): solo
 * descuenta stock el `critical_supply` (bebidas sueltas) y los insumos
 * `autoDiscount` de las recetas (pan, salchichas, bebidas en promos).
 * `manual_supply` y `service` NUNCA descuentan ni reintegran — su número
 * solo alimenta el panel y la alerta de stock bajo.
 *
 * `minStock` es opcional: activa la alerta "bajo" del panel
 * (`isLow` = stock <= min_stock) para ese insumo.
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
  // — Insumos críticos: pan y salchichas (insumos de receta) —
  { product: 'Pan super pancho', quantity: 20 },
  { product: 'Salchichas', quantity: 20 },

  // — Bebidas vendibles (critical_supply beverage) —
  { product: 'Coca-Cola 1 L', quantity: 20 },
  { product: 'Coca-Cola 1,5 L', quantity: 20 },
  { product: 'Coca-Cola chica', quantity: 20 },
  { product: 'Doble cola 1 L', quantity: 20 },
  { product: 'Doble cola chica', quantity: 20 },
  { product: 'Pritty 1 L', quantity: 20 },
  { product: 'Pritty 500 cc', quantity: 20 },
  { product: 'Doble Cola 2,25 L', quantity: 20 },
  { product: 'Agua chica 500 ml', quantity: 20 },
  { product: 'Agua 1,5 L', quantity: 20 },
  { product: 'Agua de pera chica', quantity: 20 },
  { product: 'Agua de manzana chica', quantity: 20 },
  { product: 'Agua de pera 1 L', quantity: 20 },
  { product: 'Agua de manzana 1 L', quantity: 20 },
  { product: 'Agua de pomelo 1 L', quantity: 20 },
  { product: 'Fanta 1,5 L', quantity: 20 },
  { product: 'Jugo Tutti 475 ml', quantity: 20 },
  { product: 'Jugo Tutti 200 cc', quantity: 20 },
  { product: 'Cerveza grande 700 ml', quantity: 20 },
  { product: 'Cerveza chica 475 ml', quantity: 20 },

  // — Insumos manuales: descartables y packaging —
  { product: 'Caja descartable chica', quantity: 5 },
  { product: 'Caja descartable grande', quantity: 5 },
  { product: 'Porta panchos super', quantity: 5 },
  { product: 'Sorbetes', quantity: 5 },
  { product: 'Vasos', quantity: 5 },
  { product: 'Bolsas', quantity: 5 },
  { product: 'Folex', quantity: 5 },
  { product: 'Rollo de cocina', quantity: 5 },
  { product: 'Cintas', quantity: 5 },

  // — Insumos manuales: gas y cocina —
  { product: 'Gas', quantity: 5 },
  { product: 'Aceite', quantity: 5 },
  { product: 'Vinagre', quantity: 5 },
  { product: 'Sal gruesa', quantity: 5 },
  { product: 'Ajo', quantity: 5 },
  { product: 'Provenzal', quantity: 5 },
  { product: 'Caldos', quantity: 5 },

  // — Insumos manuales: limpieza —
  { product: 'Líquido para piso', quantity: 5 },
  { product: 'Lavandina', quantity: 5 },
  { product: 'Detergente', quantity: 5 },

  // — Insumos manuales: aderezos (sachet) —
  { product: 'Mayonesa', quantity: 5 },
  { product: 'Ketchup', quantity: 5 },
  { product: 'Salsa Golf', quantity: 5 },
  { product: 'Mostaza', quantity: 5 },
  { product: 'Barbacoa', quantity: 5 },
  { product: 'Aceituna', quantity: 5 },
  { product: 'Cheddar', quantity: 5 },
  { product: 'Fugazzeta', quantity: 5 },
  { product: 'Parmesano', quantity: 5 },
  { product: 'Roquefort', quantity: 5 },
  { product: 'Salame', quantity: 5 },
  { product: 'Picante', quantity: 5 },
  { product: 'Chimichurri', quantity: 5 },

  // — Insumos manuales: toppings y frescos —
  { product: 'Choclo en grano', quantity: 5 },
  { product: 'Huevo picado', quantity: 5 },
  { product: 'Papas Pay', quantity: 5 },
  { product: 'Criollita', quantity: 5 },
  { product: 'Mayonesa provenzal', quantity: 5 },
  { product: 'Tomate', quantity: 5 },
  { product: 'Morrones', quantity: 5 },

  // — Servicios extras (no descuentan stock; queda como referencia) —
  { product: 'Postre Oreo', quantity: 20 },
  { product: 'Flan', quantity: 20 },
  { product: 'Vaso de gaseosa', quantity: 20 },
  { product: 'Agregado de toppings', quantity: 20 },
];
