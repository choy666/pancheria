import type {
  CriticalSupplyType,
  ProductRow,
  ProductType,
} from '@/domain/types';

/**
 * Catálogo versionado de Panchería Popular para la carga inicial de una
 * sucursal (PR-1 de la auditoría de nueva sucursal). Lo consume
 * `scripts/cargar-catalogo.ts`, que resuelve los nombres a IDs reales y
 * aplica las reglas de `productService`/`saveRecipe`.
 *
 * Fuentes:
 * - Inventario de 59 ítems del prompt de auditoría (unidad entre paréntesis).
 * - Menú real confirmado por el usuario: 11 promos, 13 aderezos, 5 toppings
 *   y 2 extras.
 * - Decisiones D-1 a D-6 del informe `.devin/informes/auditoria-nueva-sucursal-stock-2026-10-04.md`.
 *
 * Reglas aplicadas:
 * - Pan/Salchichas son `critical_supply` no vendibles: solo insumos de combos.
 * - Las bebidas son `critical_supply beverage` (vendibles standalone).
 * - Los aderezos/toppings son `manual_supply` con el NOMBRE DEL MENÚ (es lo
 *   que ven el cliente en el toggle y la cocina en el snapshot).
 * - Los postres y los extras son `service` con precio.
 * - El pancho común define `maxOptionalSelections = 4` (PR-8): el cliente
 *   elige cuáles 4 de los 13 aderezos; los 4 clásicos quedan preseleccionados.
 * - En promos de varios panchos el set de aderezos es compartido (el toggle
 *   aplica a todos los panchos; quantity = cantidad de panchos). Para sets
 *   distintos por pancho el operador carga líneas separadas o usa
 *   aclaraciones de la línea.
 *
 * PRECIOS ESTIMADOS: el inventario no define precio de bebidas sueltas ni
 * postres. Se cargan activos con valores estimados a partir de las promos
 * (Pritty 500 cc ≈ $800 por Promo Pritty 1; Doble Cola 2,25 L ≈ $1.500 por
 * Promo Familiar; Tutti 200 cc ≈ $500 por Popu Kids) — el dueño debe
 * revisarlos y corregirlos desde /productos antes de abrir al público.
 */

export type CatalogProductDef = {
  name: string;
  type: ProductType;
  criticalSupplyType?: CriticalSupplyType;
  price: number;
  unit: string;
  description?: string;
  minStock?: number;
  /** Por defecto `true`. Los vendibles sin precio quedan en `false`. */
  isActive?: boolean;
  /** Tope de opcionales elegibles (PR-8). Solo productos `compound`. */
  maxOptionalSelections?: number;
  /**
   * Stock inicial a cargar con `adjustStock` (movimiento `restock`) cuando
   * se crea el producto. Solo aplica a productos nuevos: en re-ejecuciones
   * el stock existente nunca se toca. Por defecto 0.
   */
  initialStock?: number;
};

type CatalogRecipeCriticalDef = {
  /** Nombre exacto del producto-insumo crítico. */
  supply: string;
  quantity: number;
};

type CatalogRecipeOptionalDef = {
  /** Nombre exacto del producto-insumo (manual o service). */
  supply: string;
  quantity: number;
  selectedByDefault: boolean;
};

export type CatalogRecipeDef = {
  /** Nombre exacto del producto compuesto dueño de la receta. */
  compound: string;
  /** Insumos críticos: `autoDiscount=true, isOptional=false` implícito. */
  criticals: CatalogRecipeCriticalDef[];
  /**
   * Componentes incluidos sin elección y sin descuento de stock
   * (`autoDiscount=false, isOptional=false`): p. ej. el vaso de gaseosa de
   * una promo — siempre va, no lo puede sacar el cliente y no cuenta para
   * el tope de opcionales. Solo insumos no críticos (service/manual).
   */
  fixeds?: CatalogRecipeCriticalDef[];
  /** Opcionales: `autoDiscount=false, isOptional=true` implícito. */
  optionals: CatalogRecipeOptionalDef[];
};

// ————————————————————————————————————————————————————————————————————
// Nombres reutilizados por las recetas. Deben coincidir EXACTAMENTE con
// los `name` de PRODUCTOS: el script falla si una receta referencia un
// producto que no existe ni va a crearse.
// ————————————————————————————————————————————————————————————————————
const PAN = 'Pan super pancho';
const SALCHICHAS = 'Salchichas';
const VASO_GASEOSA = 'Vaso de gaseosa';
const PRITTY_500 = 'Pritty 500 cc';
const DOBLE_COLA_225 = 'Doble Cola 2,25 L';
const TUTTI_200 = 'Jugo Tutti 200 cc';

const ADEREZOS = [
  'Mayonesa',
  'Ketchup',
  'Salsa Golf',
  'Mostaza',
  'Barbacoa',
  'Aceituna',
  'Cheddar',
  'Fugazzeta',
  'Parmesano',
  'Roquefort',
  'Salame',
  'Picante',
  'Chimichurri',
] as const;

/** Los 4 aderezos clásicos del pancho común: preseleccionados por defecto. */
const ADEREZOS_CLASICOS: readonly string[] = [
  'Mayonesa',
  'Ketchup',
  'Salsa Golf',
  'Mostaza',
];

const TOPPINGS = [
  'Choclo en grano',
  'Huevo picado',
  'Papas Pay',
  'Criollita',
  'Mayonesa provenzal',
] as const;

const TOPE_ADEREZOS_COMUN = 4;

// ————————————————————————————————————————————————————————————————————
// Productos (76): 59 del inventario + 4 del menú + 2 extras + 11 promos.
// ————————————————————————————————————————————————————————————————————
export const PRODUCTOS: CatalogProductDef[] = [
  // — Insumos críticos (2): no vendibles, solo descuento por receta —
  {
    name: PAN,
    type: 'critical_supply',
    criticalSupplyType: 'bread',
    price: 0,
    unit: 'unidad',
  },
  {
    name: SALCHICHAS,
    type: 'critical_supply',
    criticalSupplyType: 'sausage',
    price: 0,
    unit: 'unidad',
    description:
      'Stock en unidades (D-4); el paquete de 6 es solo referencia de compra.',
  },

  // — Descartables y packaging (9) —
  { name: 'Caja descartable chica', type: 'manual_supply', price: 0, unit: 'unidad' },
  { name: 'Caja descartable grande', type: 'manual_supply', price: 0, unit: 'unidad' },
  { name: 'Porta panchos super', type: 'manual_supply', price: 0, unit: 'unidad' },
  { name: 'Sorbetes', type: 'manual_supply', price: 0, unit: 'unidad' },
  {
    name: 'Vasos',
    type: 'manual_supply',
    price: 0,
    unit: 'unidad',
    description: 'Stock en vasos individuales; la tira es solo presentación.',
  },
  { name: 'Bolsas', type: 'manual_supply', price: 0, unit: 'unidad' },
  { name: 'Folex', type: 'manual_supply', price: 0, unit: 'paquete' },
  { name: 'Rollo de cocina', type: 'manual_supply', price: 0, unit: 'rollo' },
  { name: 'Cintas', type: 'manual_supply', price: 0, unit: 'unidad' },

  // — Gas y cocina (7) —
  { name: 'Gas', type: 'manual_supply', price: 0, unit: 'garrafa' },
  { name: 'Aceite', type: 'manual_supply', price: 0, unit: 'litro' },
  { name: 'Vinagre', type: 'manual_supply', price: 0, unit: 'botella' },
  { name: 'Sal gruesa', type: 'manual_supply', price: 0, unit: 'paquete' },
  { name: 'Ajo', type: 'manual_supply', price: 0, unit: 'bolsa' },
  { name: 'Provenzal', type: 'manual_supply', price: 0, unit: 'bolsita' },
  { name: 'Caldos', type: 'manual_supply', price: 0, unit: 'unidad' },

  // — Limpieza (3) —
  { name: 'Líquido para piso', type: 'manual_supply', price: 0, unit: 'bidón' },
  { name: 'Lavandina', type: 'manual_supply', price: 0, unit: 'bidón' },
  { name: 'Detergente', type: 'manual_supply', price: 0, unit: 'litro' },

  // — Aderezos (13, sachet): los 4 clásicos + los 9 del completo —
  ...ADEREZOS.map<CatalogProductDef>((name) => ({
    name,
    type: 'manual_supply',
    price: 0,
    unit: 'sachet',
  })),

  // — Toppings (5): nombres del menú; Mayonesa provenzal es producto propio —
  { name: 'Choclo en grano', type: 'manual_supply', price: 0, unit: 'porción' },
  { name: 'Huevo picado', type: 'manual_supply', price: 0, unit: 'unidad' },
  { name: 'Papas Pay', type: 'manual_supply', price: 0, unit: 'porción' },
  { name: 'Criollita', type: 'manual_supply', price: 0, unit: 'unidad' },
  { name: 'Mayonesa provenzal', type: 'manual_supply', price: 0, unit: 'porción' },

  // — Frescos y almacén sin uso en menú (2) —
  { name: 'Tomate', type: 'manual_supply', price: 0, unit: 'unidad' },
  { name: 'Morrones', type: 'manual_supply', price: 0, unit: 'unidad' },

  // — Bebidas del inventario (17): vendibles, precio pendiente → inactivas —
  // Bebidas sueltas — PRECIO ESTIMADO (ver encabezado): revisar en /productos.
  { name: 'Coca-Cola 1 L', type: 'critical_supply', criticalSupplyType: 'beverage', price: 1200, unit: 'botella' },
  { name: 'Coca-Cola 1,5 L', type: 'critical_supply', criticalSupplyType: 'beverage', price: 1600, unit: 'botella' },
  { name: 'Coca-Cola chica', type: 'critical_supply', criticalSupplyType: 'beverage', price: 600, unit: 'botella' },
  { name: 'Doble cola 1 L', type: 'critical_supply', criticalSupplyType: 'beverage', price: 1000, unit: 'botella' },
  { name: 'Doble cola chica', type: 'critical_supply', criticalSupplyType: 'beverage', price: 500, unit: 'botella' },
  { name: 'Pritty 1 L', type: 'critical_supply', criticalSupplyType: 'beverage', price: 1000, unit: 'botella' },
  { name: 'Agua chica 500 ml', type: 'critical_supply', criticalSupplyType: 'beverage', price: 500, unit: 'botella' },
  { name: 'Agua 1,5 L', type: 'critical_supply', criticalSupplyType: 'beverage', price: 800, unit: 'botella' },
  { name: 'Agua de pera chica', type: 'critical_supply', criticalSupplyType: 'beverage', price: 600, unit: 'botella' },
  { name: 'Agua de manzana chica', type: 'critical_supply', criticalSupplyType: 'beverage', price: 600, unit: 'botella' },
  { name: 'Agua de pera 1 L', type: 'critical_supply', criticalSupplyType: 'beverage', price: 900, unit: 'botella' },
  { name: 'Agua de manzana 1 L', type: 'critical_supply', criticalSupplyType: 'beverage', price: 900, unit: 'botella' },
  { name: 'Agua de pomelo 1 L', type: 'critical_supply', criticalSupplyType: 'beverage', price: 900, unit: 'botella' },
  { name: 'Fanta 1,5 L', type: 'critical_supply', criticalSupplyType: 'beverage', price: 1400, unit: 'botella' },
  { name: 'Jugo Tutti 475 ml', type: 'critical_supply', criticalSupplyType: 'beverage', price: 700, unit: 'botella' },
  { name: 'Cerveza grande 700 ml', type: 'critical_supply', criticalSupplyType: 'beverage', price: 1800, unit: 'botella' },
  { name: 'Cerveza chica 475 ml', type: 'critical_supply', criticalSupplyType: 'beverage', price: 1200, unit: 'botella' },

  // — Bebidas del menú (3, tamaño real de compra — D-3): precio pendiente —
  // Bebidas de las promos (también vendibles sueltas) — PRECIO ESTIMADO.
  { name: PRITTY_500, type: 'critical_supply', criticalSupplyType: 'beverage', price: 800, unit: 'botella' },
  { name: DOBLE_COLA_225, type: 'critical_supply', criticalSupplyType: 'beverage', price: 1500, unit: 'botella' },
  { name: TUTTI_200, type: 'critical_supply', criticalSupplyType: 'beverage', price: 500, unit: 'unidad' },

  // — Postres (2, service con precio — D-5): precio pendiente → inactivos —
  // Postres — PRECIO ESTIMADO (ver encabezado): revisar en /productos.
  { name: 'Postre Oreo', type: 'service', price: 800, unit: 'unidad' },
  { name: 'Flan', type: 'service', price: 700, unit: 'unidad' },

  // — Extras (2 services con precio del menú) —
  {
    name: VASO_GASEOSA,
    type: 'service',
    price: 500,
    unit: 'unidad',
    description:
      'Se vende suelto y va incluido en promos. No descuenta stock: el conteo sale del resumen de caja.',
  },
  {
    name: 'Agregado de toppings',
    type: 'service',
    price: 200,
    unit: 'unidad',
    description:
      'Agregado cobrable por unidad; el topping elegido se indica en la aclaración de la línea.',
  },

  // — Promos (11 compound) —
  {
    name: 'Súper Pancho',
    type: 'compound',
    price: 1000,
    unit: 'unidad',
    description: 'Súper Pancho con hasta 4 aderezos a elección.',
    maxOptionalSelections: TOPE_ADEREZOS_COMUN,
  },
  {
    name: 'Promo 1',
    type: 'compound',
    price: 1500,
    unit: 'unidad',
    description: 'Súper Pancho con hasta 4 aderezos + vaso de gaseosa.',
    maxOptionalSelections: TOPE_ADEREZOS_COMUN,
  },
  {
    name: 'Promo 2',
    type: 'compound',
    price: 2000,
    unit: 'unidad',
    description: 'Súper Pancho completo (aderezos y toppings) + vaso de gaseosa.',
  },
  {
    name: 'Promo Pritty 1',
    type: 'compound',
    price: 2000,
    unit: 'unidad',
    description: 'Súper Pancho con hasta 4 aderezos + Pritty 500 cc.',
    maxOptionalSelections: TOPE_ADEREZOS_COMUN,
  },
  {
    name: 'Promo Pritty 2',
    type: 'compound',
    price: 2500,
    unit: 'unidad',
    description: 'Súper Pancho completo + Pritty 500 cc.',
  },
  {
    name: 'Promo Amigos 1',
    type: 'compound',
    price: 2500,
    unit: 'unidad',
    description:
      '2 Súper Panchos con hasta 4 aderezos compartidos + 2 vasos de gaseosa.',
    maxOptionalSelections: TOPE_ADEREZOS_COMUN,
  },
  {
    name: 'Promo Amigos 2',
    type: 'compound',
    price: 3500,
    unit: 'unidad',
    description: '2 Súper Panchos completos + 2 vasos de gaseosa.',
  },
  {
    name: 'Promo Popular',
    type: 'compound',
    price: 10000,
    unit: 'unidad',
    description: '5 Súper Panchos completos + Doble Cola 2,25 L.',
  },
  {
    name: 'Promo Familiar',
    type: 'compound',
    price: 11000,
    unit: 'unidad',
    description:
      '9 Súper Panchos con hasta 4 aderezos compartidos + Doble Cola 2,25 L.',
    maxOptionalSelections: TOPE_ADEREZOS_COMUN,
  },
  {
    name: 'Promo Familiar Plus',
    type: 'compound',
    price: 16000,
    unit: 'unidad',
    description: '9 Súper Panchos completos + Doble Cola 2,25 L.',
  },
  {
    name: 'Popu Kids',
    type: 'compound',
    price: 2000,
    unit: 'unidad',
    description: 'Súper Pancho completo + Juguito Tutti 200 cc.',
  },
];

// ————————————————————————————————————————————————————————————————————
// Recetas (11): críticos con autoDiscount + opcionales del menú + fijos.
// `quantity` en opcionales/fijos = cantidad cobrada/consumida por unidad de
// promo (multiplicada por la cantidad de panchos en promos múltiples).
// ————————————————————————————————————————————————————————————————————
function aderezosComunes(panchos: number): CatalogRecipeOptionalDef[] {
  return ADEREZOS.map((supply) => ({
    supply,
    quantity: panchos,
    selectedByDefault: ADEREZOS_CLASICOS.includes(supply),
  }));
}

function completo(panchos: number): CatalogRecipeOptionalDef[] {
  return [...ADEREZOS, ...TOPPINGS].map((supply) => ({
    supply,
    quantity: panchos,
    selectedByDefault: true,
  }));
}

/**
 * Vaso de gaseosa incluido en la promo: componente fijo (no opcional).
 * Es `service`: no descuenta stock, pero queda registrado en el snapshot
 * de la receta y en el resumen de insumos del cierre.
 */
function vasosFijos(cantidad: number): CatalogRecipeCriticalDef {
  return { supply: VASO_GASEOSA, quantity: cantidad };
}

export const RECETAS: CatalogRecipeDef[] = [
  {
    compound: 'Súper Pancho',
    criticals: [
      { supply: PAN, quantity: 1 },
      { supply: SALCHICHAS, quantity: 2 },
    ],
    optionals: aderezosComunes(1),
  },
  {
    compound: 'Promo 1',
    criticals: [
      { supply: PAN, quantity: 1 },
      { supply: SALCHICHAS, quantity: 2 },
    ],
    optionals: aderezosComunes(1),
    fixeds: [vasosFijos(1)],
  },
  {
    compound: 'Promo 2',
    criticals: [
      { supply: PAN, quantity: 1 },
      { supply: SALCHICHAS, quantity: 2 },
    ],
    optionals: completo(1),
    fixeds: [vasosFijos(1)],
  },
  {
    compound: 'Promo Pritty 1',
    criticals: [
      { supply: PAN, quantity: 1 },
      { supply: SALCHICHAS, quantity: 2 },
      { supply: PRITTY_500, quantity: 1 },
    ],
    optionals: aderezosComunes(1),
  },
  {
    compound: 'Promo Pritty 2',
    criticals: [
      { supply: PAN, quantity: 1 },
      { supply: SALCHICHAS, quantity: 2 },
      { supply: PRITTY_500, quantity: 1 },
    ],
    optionals: completo(1),
  },
  {
    compound: 'Promo Amigos 1',
    criticals: [
      { supply: PAN, quantity: 2 },
      { supply: SALCHICHAS, quantity: 4 },
    ],
    optionals: aderezosComunes(2),
    fixeds: [vasosFijos(2)],
  },
  {
    compound: 'Promo Amigos 2',
    criticals: [
      { supply: PAN, quantity: 2 },
      { supply: SALCHICHAS, quantity: 4 },
    ],
    optionals: completo(2),
    fixeds: [vasosFijos(2)],
  },
  {
    compound: 'Promo Popular',
    criticals: [
      { supply: PAN, quantity: 5 },
      { supply: SALCHICHAS, quantity: 10 },
      { supply: DOBLE_COLA_225, quantity: 1 },
    ],
    optionals: completo(5),
  },
  {
    compound: 'Promo Familiar',
    criticals: [
      { supply: PAN, quantity: 9 },
      { supply: SALCHICHAS, quantity: 18 },
      { supply: DOBLE_COLA_225, quantity: 1 },
    ],
    optionals: aderezosComunes(9),
  },
  {
    compound: 'Promo Familiar Plus',
    criticals: [
      { supply: PAN, quantity: 9 },
      { supply: SALCHICHAS, quantity: 18 },
      { supply: DOBLE_COLA_225, quantity: 1 },
    ],
    optionals: completo(9),
  },
  {
    compound: 'Popu Kids',
    criticals: [
      { supply: PAN, quantity: 1 },
      { supply: SALCHICHAS, quantity: 2 },
      { supply: TUTTI_200, quantity: 1 },
    ],
    optionals: completo(1),
  },
];

// ————————————————————————————————————————————————————————————————————
// Plan de carga (puro, testeable sin base). Vive acá y no en el script
// ejecutable porque `import.meta` no compila bajo ts-jest.
// ————————————————————————————————————————————————————————————————————

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

type SkippedProduct = {
  def: CatalogProductDef;
  existing: ProductRow;
  /** Diferencias legibles entre la definición y lo ya cargado (informativas). */
  diffs: string[];
};

type StockPlanAction = {
  productName: string;
  quantity: number;
};

type RecipePlanAction = {
  def: CatalogRecipeDef;
  /** El compuesto ya existía en la sucursal (la receta se reescribe igual). */
  compoundExisted: boolean;
};

export type CatalogPlan = {
  creates: CatalogProductDef[];
  skips: SkippedProduct[];
  recipes: RecipePlanAction[];
  stockActions: StockPlanAction[];
  /** Referencias de receta que no resuelven a ningún producto. */
  errors: string[];
  warnings: string[];
};

function describeDiff(
  def: CatalogProductDef,
  existing: ProductRow
): string[] {
  const diffs: string[] = [];
  if (existing.type !== def.type) {
    diffs.push(`tipo ${existing.type} → ${def.type}`);
  }
  if (existing.price !== def.price) {
    diffs.push(`precio ${existing.price} → ${def.price}`);
  }
  if (existing.unit !== def.unit) {
    diffs.push(`unidad "${existing.unit}" → "${def.unit}"`);
  }
  if (
    (existing.maxOptionalSelections ?? null) !==
    (def.maxOptionalSelections ?? null)
  ) {
    diffs.push(
      `tope opcionales ${existing.maxOptionalSelections ?? 'sin tope'} → ${def.maxOptionalSelections ?? 'sin tope'}`
    );
  }
  const defActive = def.isActive ?? true;
  if (existing.isActive !== defActive) {
    diffs.push(`isActive ${existing.isActive} → ${defActive}`);
  }
  return diffs;
}

/**
 * Arma el plan de carga contra el estado actual de la sucursal:
 * - Producto nuevo → `creates` (stock nace en 0; `initialStock` genera una
 *   acción `restock` solo para los recién creados).
 * - Producto existente por nombre → `skips` con diff informativo (nunca se
 *   sobrescribe precio, tipo ni tope de un producto ya cargado).
 * - Recetas → siempre se reescriben (`saveRecipe` es delete+insert); solo se
 *   valida que el compuesto y todos los insumos resuelvan por nombre.
 */
export function buildCatalogPlan(
  existing: ProductRow[],
  products: CatalogProductDef[] = PRODUCTOS,
  recipes: CatalogRecipeDef[] = RECETAS
): CatalogPlan {
  const byName = new Map<string, ProductRow>();
  const capByName = new Map<string, number | null>();
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const product of existing) {
    const key = normalizeName(product.name);
    if (byName.has(key)) {
      warnings.push(
        `Nombre duplicado en la sucursal: "${product.name}" (id ${product.id} y ${byName.get(key)!.id}). Se usa el de menor id; conviene deduplicar.`
      );
    } else {
      byName.set(key, product);
      capByName.set(key, product.maxOptionalSelections ?? null);
    }
  }

  const creates: CatalogProductDef[] = [];
  const skips: SkippedProduct[] = [];
  const seenDefs = new Set<string>();

  for (const def of products) {
    const key = normalizeName(def.name);
    if (seenDefs.has(key)) {
      errors.push(`Producto duplicado en el archivo de datos: "${def.name}".`);
      continue;
    }
    seenDefs.add(key);
    capByName.set(key, def.maxOptionalSelections ?? null);

    const found = byName.get(key);
    if (found) {
      skips.push({ def, existing: found, diffs: describeDiff(def, found) });
      // El compuesto ya cargado manda: su tope es el vigente, no el del archivo.
      capByName.set(key, found.maxOptionalSelections ?? null);
    } else {
      creates.push(def);
      // Los ítems a crear también resuelven referencias de recetas.
      byName.set(key, {
        id: -1,
        name: def.name,
        type: def.type,
      } as ProductRow);
    }
  }

  const pendingPrice = creates.filter(
    (def) =>
      def.price === 0 &&
      (def.isActive ?? true) === false &&
      (def.type === 'service' ||
        (def.type === 'critical_supply' &&
          def.criticalSupplyType === 'beverage'))
  );
  if (pendingPrice.length > 0) {
    warnings.push(
      `${pendingPrice.length} productos vendibles se crean INACTIVOS por precio pendiente: ${pendingPrice.map((d) => d.name).join(', ')}. Fijar precio y activarlos desde /productos antes de abrir.`
    );
  }

  const recipeActions: RecipePlanAction[] = [];
  const recipeCompounds = new Set<string>();
  for (const def of recipes) {
    const compoundKey = normalizeName(def.compound);
    if (recipeCompounds.has(compoundKey)) {
      errors.push(`Receta duplicada en el archivo de datos: "${def.compound}".`);
      continue;
    }
    recipeCompounds.add(compoundKey);

    const compound = byName.get(compoundKey);
    if (!compound) {
      errors.push(
        `La receta "${def.compound}" no tiene producto compuesto (ni existe ni está en el archivo de datos).`
      );
      continue;
    }
    if (compound.type !== 'compound') {
      errors.push(
        `"${def.compound}" tiene receta pero su producto no es compound (tipo ${compound.type}).`
      );
      continue;
    }

    const missing = [...def.criticals, ...(def.fixeds ?? []), ...def.optionals]
      .map((item) => item.supply)
      .filter((supply) => !byName.has(normalizeName(supply)));
    if (missing.length > 0) {
      errors.push(
        `La receta "${def.compound}" referencia insumos inexistentes: ${missing.join(', ')}.`
      );
      continue;
    }

    // Misma regla que recipeService.saveRecipe: los preseleccionados deben
    // entrar en el tope del compuesto; si no, el apply rechaza a mitad de
    // camino. La validación vive en el plan para detectarla en dry-run.
    const cap = capByName.get(compoundKey) ?? null;
    if (cap != null) {
      const defaultCount = def.optionals.filter((o) => o.selectedByDefault).length;
      if (defaultCount > cap) {
        errors.push(
          `La receta "${def.compound}" tiene ${defaultCount} opcionales preseleccionados pero el producto permite elegir hasta ${cap}.`
        );
        continue;
      }
    }

    recipeActions.push({ def, compoundExisted: compound.id !== -1 });
  }

  const stockActions: StockPlanAction[] = creates
    .filter((def) => (def.initialStock ?? 0) > 0)
    .map((def) => ({ productName: def.name, quantity: def.initialStock! }));

  return {
    creates,
    skips,
    recipes: recipeActions,
    stockActions,
    errors,
    warnings,
  };
}
