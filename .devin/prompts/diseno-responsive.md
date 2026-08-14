# Prompt: Corroborar y mejorar el diseño responsive del proyecto

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja y cierre de caja.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado-2026-08-13.md" />
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/responsive.spec.ts" />
- <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/layout.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/globals.css" />

## Estado actual relevante

- El proyecto ya incluye `tests/e2e/responsive.spec.ts` con verificaciones de scroll horizontal, menú hamburguesa, tablas y formularios en móvil (375x667).
- `src/app/layout.tsx` define el viewport `width: "device-width"`, `initialScale: 1`.
- `playwright.config.ts` solo corre Chromium en Desktop; no hay un proyecto dedicado a móvil.
- Varios componentes usan clases de Tailwind (`sm:`, `md:`, `lg:`), pero puede haber tablas, formularios o diálogos que no se adapten correctamente en pantallas pequeñas.

## Objetivo

Corroborar que la aplicación sea totalmente responsive y se adapte correctamente a diferentes pantallas. Si se detectan problemas, corregirlos y ampliar la cobertura de tests E2E para prevenir regresiones.

## Reglas de negocio

1. Usar enfoque **mobile-first**: las clases base deben ser para móvil y agregar `sm:`, `md:`, `lg:`, `xl:` solo cuando sea necesario.
2. No usar anchos fijos en píxeles para contenedores de layout; preferir `w-full`, `min-w-0`, flexbox y grid.
3. Las tablas anchas deben poder visualizarse sin scroll horizontal de toda la página: usar contenedor con `overflow-x-auto` u ocultar columnas secundarias en móvil.
4. Los botones y controles interactivos deben tener un área táctil mínima de **44x44px** (ideal 48x48px).
5. Los diálogos y modales no deben desbordar el viewport ni cortar contenido en móvil.
6. Los formularios largos deben apilarse en una sola columna en móvil; evitar grids de dos o más columnas sin breakpoint.
7. No ocultar acciones críticas con `hidden md:block` a menos que exista una alternativa clara para móvil.
8. Mantener la coherencia visual: tipografía, espaciado y bordes deben escalar correctamente.

## Implementación detallada

### 1. Auditoría inicial

- Revisar todas las rutas principales en anchos representativos: 375px, 430px, 768px, 1024px y 1920px.
- Enfocarse en:
  - <ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" /> (menú hamburguesa, selector de sucursal, acciones de usuario).
  - <ref_file file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" /> (terminal de ventas, botones de pago, carrito).
  - <ref_file file="C:/developer/paginas/pancheria/src/components/productos/product-form.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/productos/promo-form.tsx" /> (formularios, selects, precios).
  - <ref_file file="C:/developer/paginas/pancheria/src/components/caja/caja-history.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/caja/cash-register-summary.tsx" /> (tablas, resúmenes).
  - <ref_file file="C:/developer/paginas/pancheria/src/components/stock/stock-list.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/stock/stock-history.tsx" /> (tablas de stock).
  - <ref_file file="C:/developer/paginas/pancheria/src/components/cierre/closure-history.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/cierre/closure-panel.tsx" />.
  - <ref_file file="C:/developer/paginas/pancheria/src/components/ui/dialog.tsx" /> (diálogos).
  - <ref_file file="C:/developer/paginas/pancheria/src/components/ui/table.tsx" /> (tablas base).
- Documentar cada problema encontrado con ruta, viewport y captura de descripción textual.

### 2. Correcciones de interfaz

- Ajustar clases de Tailwind en los componentes afectados para eliminar scroll horizontal, mejorar legibilidad y asegurar áreas táctiles.
- Si una tabla no entra, envolverla en `<div className="overflow-x-auto">` o reducir columnas con `hidden sm:table-cell`.
- Si un diálogo desborda, usar `max-h-[90vh] overflow-y-auto` o revisar el ancho en `dialog.tsx`.
- Asegurar que el menú hamburguesa funcione en todas las rutas, incluso con scroll o diálogos abiertos.

### 3. Tests E2E

- Ampliar <ref_file file="C:/developer/paginas/pancheria/tests/e2e/responsive.spec.ts" />:
  - Agregar rutas faltantes a `protectedRoutes` si aplica (`/usuarios`, `/sucursales`, etc.).
  - Agregar verificación de áreas táctiles mínimas (usar `page.evaluate` con `Element.getBoundingClientRect()`).
  - Incluir un caso de diálogo/modal en móvil para confirmar que no desborda.
- Opcionalmente, agregar un proyecto móvil en <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" /> usando `devices['iPhone 13']` o similar, solo si no impacta excesivamente en el tiempo de ejecución.

### 4. CSS global y tokens

- Revisar <ref_file file="C:/developer/paginas/pancheria/src/app/globals.css" /> por clases que impidan el responsive (anchos fijos, `min-width` excesivos, `overflow` incorrectos).
- Mantener las variables de Tailwind y no duplicar breakpoints en CSS.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs ni secretos.
- `tests/e2e/global-setup.ts` trunca tablas de negocio y ejecuta el seed. Ejecutar `npm run test:e2e` solo en una base de datos de prueba y con confirmación explícita.
- No modificar `.env.local` ni agregar variables sensibles.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npm run test:e2e` | Tests E2E de responsividad en base de prueba |
