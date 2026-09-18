# Prompt: destacar visualmente el botón de cierre de caja

> **Estado:** implementado.
> Este prompt destaca el botón "Cerrar caja" como acción principal en `/cierre` y `/ventas`: el cierre normal usa `variant="default"` con icono `LockKeyhole` (más `size="lg"` en `/cierre`), el cierre forzado mantiene `variant="destructive"` y el botón de confirmación del diálogo usa `destructive` solo en cierres forzados. Se preservaron `data-testid` y `data-tour`.

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos y gestión de videos.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui (base-ui), Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright, lucide-react.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />

Código relevante:

- Panel de caja en `/cierre` (contiene el botón principal): <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-panel.tsx" />
- Estado de caja en `/ventas` (segundo botón de cierre): <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-status.tsx" />
- Página `/cierre` donde se monta `CajaPanel`: <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/cierre/page.tsx" />
- Terminal de ventas donde se monta `CajaStatus`: <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" />
- Variantes y tamaños disponibles del botón: <ref_file file="C:/developer/paginas/pancheria/src/components/ui/button.tsx" />
- Tour interactivo (usa `data-tour`): <ref_file file="C:/developer/paginas/pancheria/src/components/tour/tour-context.tsx" />
- Helpers E2E (usan los `data-testid` del botón): <ref_file file="C:/developer/paginas/pancheria/tests/e2e/helpers.ts" />

## Estado actual relevante

- El botón "Cerrar caja" usa `variant="outline"` en ambos componentes (`caja-panel.tsx` y `caja-status.tsx`), el estilo más débil del sistema: fondo transparente y borde fino. Visualmente no destaca y cuesta encontrarlo.
- En `/cierre`, el botón "Historial de cajas" del encabezado también es `outline`, así que la acción principal de la página se ve igual que un enlace secundario de navegación.
- En `/ventas`, el botón "Abrir caja" usa `variant="default"` (fondo `primary`, prominente). La jerarquía visual queda invertida: abrir destaca, cerrar no — aunque cerrar es la acción crítica al terminar el turno.
- El cierre forzado (`isForcedClose`, admin cerrando caja ajena) ya usa `variant="destructive"`, por lo que solo el cierre normal carece de protagonismo.
- El botón es contrato de tests y tour: `data-testid="close-cash-register"` y `data-testid="confirm-close-cash-register"` los usan los helpers E2E (`tests/e2e/helpers.ts`), y `data-tour="caja-action"` / `data-tour="caja-status"` los usa el tour interactivo.

## Objetivo

Hacer que el botón "Cerrar caja" sea la llamada a la acción visible y fácil de localizar en `/cierre` y `/ventas`, con jerarquía correcta respecto a las acciones secundarias, manteniendo la diferenciación del cierre forzado y sin romper tests E2E ni el tour.

## Alcance

Aplicar cambios en:

- `src/components/caja/caja-panel.tsx` (botón en `/cierre`).
- `src/components/caja/caja-status.tsx` (botón en `/ventas`).
- Opcionalmente `src/app/(panel)/cierre/page.tsx` si el encabezado requiere ajuste de jerarquía.

No modificar:

- Lógica de negocio del cierre (`useCashRegister`, `cashRegisterService`, rutas API).
- El diálogo de confirmación más allá de la coherencia visual de su botón de acción.
- Esquema de base de datos ni migraciones.
- Los atributos `data-testid` y `data-tour` existentes.

## Criterios de aceptación

- [x] El botón "Cerrar caja" normal destaca como acción principal en `/cierre` y `/ventas` (variant `default` o jerarquía equivalente con tokens del sistema).
- [x] El "Cierre forzado" sigue siendo claramente distinguible del cierre normal (mantiene `variant="destructive"` o estilo de advertencia equivalente).
- [x] En `/cierre`, "Cerrar caja" es visualmente más prominente que "Historial de cajas".
- [x] Se preservan `data-testid="close-cash-register"`, `data-testid="confirm-close-cash-register"`, `data-tour="caja-action"` y `data-tour="caja-status"`.
- [x] El estado `isSubmitting`/`disabled` sigue funcionando con la nueva variante (el sistema de botones ya maneja `disabled:opacity-50`).
- [x] `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run knip` pasan.

## Reglas de negocio

1. Solo puede cerrar la caja quien la abrió (`openedBy === userName`) o un `admin`; un admin cerrando caja ajena ejecuta un **cierre forzado** (`isForcedClose`) y debe seguir viéndose como acción de advertencia, no como cierre normal.
2. El cierre normal es una acción operativa de fin de turno, no destructiva: debe destacar pero **sin** comunicar peligro (no usar `destructive` para el cierre normal).
3. La jerarquía debe ser consistente con "Abrir caja" (`variant="default"`): las acciones primarias del ciclo de caja comparten el mismo nivel de prominencia.
4. No hardcodear colores, sombras ni estilos ad-hoc: usar las variantes de `src/components/ui/button.tsx` y los tokens del tema (`primary`, `destructive`, etc.). Si se agrega un icono, usar `lucide-react` (ya es dependencia del proyecto).
5. Mantener `className="w-full sm:w-auto"` o el comportamiento responsive equivalente.
6. Idioma español en textos de UI, comentarios y documentación.

## Implementación detallada

### 1. `caja-panel.tsx` (`/cierre`)

En <ref_snippet file="C:/developer/paginas/pancheria/src/components/caja/caja-panel.tsx" lines="189-204" />:

- Cambiar `variant={isForcedClose ? 'destructive' : 'outline'}` por una jerarquía donde el cierre normal use `variant="default"` (o `size="lg"` además, dado que es la acción principal de la página).
- Considerar agregar un icono de `lucide-react` que refuerce la acción sin implicar peligro (por ejemplo `LockKeyhole`, `CircleCheck` o similar), coherente con el uso de iconos en el resto del panel.
- Mantener `data-tour="caja-action"`, `data-testid="close-cash-register"`, `disabled={isSubmitting}` y `className="w-full sm:w-auto"`.
- El botón de confirmación del diálogo (`confirm-close-cash-register`, líneas ~286-297) ya usa `default`; evaluar si para `isForcedClose` conviene `variant="destructive"` por coherencia con la advertencia, y documentar la decisión.

### 2. `caja-status.tsx` (`/ventas`)

En <ref_snippet file="C:/developer/paginas/pancheria/src/components/caja/caja-status.tsx" lines="229-243" />:

- Aplicar el mismo criterio: cierre normal con `variant="default"`, cierre forzado con `variant="destructive"`.
- Mantener `data-testid="close-cash-register"` y `disabled={isSubmitting || loading}`.
- Verificar que dentro de la `Card` "Estado de la caja" el botón siga leyéndose como acción principal (la card ya tiene `border-primary/30`).

### 3. Jerarquía del encabezado de `/cierre` (opcional)

En <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/cierre/page.tsx" />:

- "Historial de cajas" permanece `outline` (acción secundaria de navegación) — verificar que tras el cambio el contraste de jerarquía sea evidente.

### 4. Tests

- No existen tests unitarios de `caja-panel.tsx` ni `caja-status.tsx`; `sales-terminal.test.tsx` mockea `CajaStatus` completo, así que no requiere cambios.
- Verificar que los helpers E2E (`tests/e2e/helpers.ts`, `closeCashRegister` en líneas ~399-404) sigan funcionando: dependen solo de `data-testid`, no de la variante.
- Correr los specs E2E de caja relacionados (`tests/e2e/caja-*.spec.ts`, `tests/e2e/flujo-diario.spec.ts`, `tests/e2e/tour.spec.ts`) en base descartable.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de API, secretos ni parámetros sensibles.
- El cambio es puramente de UI en el cliente; no toca esquema, migraciones ni lógica de negocio.
- Ejecutar tests E2E solo en una base de datos descartable (`test`, `e2e`, `testing`, `qa` o `staging`), siguiendo <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />.
- No commitear `.env.local`, `.env.e2e` ni archivos de entorno.

## Verificaciones

Ejecutar en orden:

| Paso | Comando | Propósito |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Estilo y calidad |
| 2 | `npx tsc --noEmit` | Verificación de tipos |
| 3 | `npm test` | Tests unitarios |
| 4 | `npm run build` | Build de producción |
| 5 | `npm run knip` | Detección de código muerto |
| 6 | `npm run test:e2e` | Tests E2E (solo en base descartable, con `.env.e2e` configurado) |

Si alguna verificación falla, corregir antes de continuar. Documentar decisiones no triviales en `.devin/informes/lecciones-aprendidas.md` si aplica, y archivar este prompt en `.devin/prompts/archivados/` al completarse.
