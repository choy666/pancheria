# Guía para escribir prompts — Proyecto Panchería

> Antes de crear un prompt nuevo, consultar los informes, `lecciones-aprendidas.md`, `guia-funcionamiento-pancheria.md` y `pancheria.prompt.md` para evitar regresiones documentadas.

## Propósito

El directorio `.devin/prompts` debe contener **guías y ejemplos reutilizables**, no una colección infinita de prompts monolíticos. Un buen prompt para este proyecto debe ser:

- **Contextualizado**: incluye stack, arquitectura y estado actual.
- **Evidenciado**: referencia código real con `<ref_file .../>` o `<ref_snippet .../>`.
- **Preventivo**: cruza con informes y lecciones aprendidas.
- **Accionable**: define objetivo, reglas de negocio, archivos a tocar y verificaciones.
- **Seguro**: incluye consideraciones de entorno, credenciales y bases de datos de prueba.

## Antes de escribir un prompt

1. Revisar si ya existe un informe relacionado en `.devin/informes/README.md`.
2. Leer `.devin/informes/lecciones-aprendidas.md`.
3. Leer `AGENTS.md` para comandos, variables de entorno y convenciones.
4. Si la tarea es operativa o de negocio, leer `.devin/informes/guia-funcionamiento-pancheria.md`.
5. Leer el código afectado usando `<ref_file .../>` o `<ref_snippet .../>`.
6. Si `lecciones-aprendidas.md` cubre el tema, no crear un prompt nuevo; referenciarlo.

## Estructura recomendada

1. Título claro: `# Prompt: {acción} en {área}`.
2. Contexto (proyecto, stack, documentación de referencia).
3. Estado actual relevante.
4. Objetivo.
5. Reglas de negocio.
6. Implementación detallada por capa (backend, frontend, tests).
7. Consideraciones de seguridad y entorno.
8. Verificaciones.

## Plantilla base

```markdown
# Prompt: {título}

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja y cierre de caja.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia:
- `AGENTS.md`
- `.devin/informes/lecciones-aprendidas.md`
- `.devin/informes/entornos.md` (si aplica migraciones o variables)
- `.devin/informes/guia-funcionamiento-pancheria.md` (si aplica)
- {informe específico si aplica}

## Estado actual relevante

{2-3 oraciones}

## Objetivo

{Qué debe lograrse}

## Reglas de negocio

1. {regla 1}
2. {regla 2}

## Implementación detallada

### Backend
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/{servicio}.ts" />
  - {cambio concreto}

### Frontend
- <ref_file file="C:/developer/paginas/pancheria/src/components/{componente}.tsx" />
  - {cambio concreto}

### Tests
- {tests}

## Consideraciones de seguridad y entorno

- No hardcodear credenciales ni URLs de API.
- Ejecutar tests E2E solo en base de datos de prueba.
- `.env.local` no debe commitearse.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npm run build` | Build de producción |
| `npm test` | Tests unitarios |
| `npm run test:e2e` | Tests E2E en base de prueba |
```

## Anti-patrones y lecciones aprendidas

Consultar `.devin/informes/lecciones-aprendidas.md` para el detalle completo. Los puntos críticos son:

- Server actions con `useActionState` deben devolver el estado con `error`, no lanzar `throw` para errores controlados.
- `NotFoundError` debe devolver `404`; `DomainError` genérico `400`; `ForbiddenError` `403` en APIs y redirección en Server Components.
- No mezclar helpers de UI con utilidades generales (`src/lib/utils.ts` vs `src/lib/json.ts`).
- No ocultar reglas de negocio en helpers de test.
- Validar integridad con soft delete considerando el estado del padre.
- Tener cuidado con `findFirst` cuando coexisten activos e inactivos.
- Incluir siempre una sección de seguridad y entorno cuando se trabaje con `.env.local`, credenciales o bases de datos.
- `setState` en `useEffect` solo está permitido para carga asíncrona con flag de montaje o persistencia derivada.

## Cuándo crear un nuevo prompt

Crear un prompt nuevo solo cuando:
1. El tema no está cubierto por la guía ni por un informe existente.
2. La tarea es lo suficientemente compleja como para requerir contexto estructurado.
3. Se detecta un patrón repetible.

Si la tarea es puntual, preferir preguntar directamente incluyendo `AGENTS.md` y `lecciones-aprendidas.md`.

## Cómo referenciar archivos

- Usar `<ref_file file="..."/>` para archivos completos.
- Usar `<ref_snippet file="..." lines="x-y"/>` solo cuando el rango sea estable; de lo contrario, preferir `<ref_file .../>` o nombres de función/exportación.

## Prompts guardados

### Prompts activos

- [Prompt maestro — Proyecto Panchería](pancheria.prompt.md) — punto de entrada para cualquier tarea futura.
- [Auditoría y sincronización de documentación](auditoria-y-documentacion.md) — guía reutilizable para mantener documentación y código alineados.
- [Auditoría de cobertura de pruebas y tests](auditoria-cobertura-de-pruebas.md) — guía para mapear sectores críticos, tests unitarios y E2E, detectar brechas y proponer tests faltantes.
- [Plan de implementación — multi-tenant compartido](plan-implementacion-multi-tenant.md) — propuesta estratégica para transformar el sistema en una plataforma SaaS con múltiples tenants (futuro, no implementado).

### Prompts archivados

- [Mejoras de UX en combos y pagos del módulo de ventas](archivados/mejoras-ux-ventas-combos-pagos.md) — resuelto: diálogo de combos con servicios/extras separados, pago adaptado a pesos argentinos, formato de moneda con/sin centavos y `NEXT_PUBLIC_PAYMENT_DENOMINATIONS`.
- [Corrección de tests E2E fallidos — caja, stock y entorno](archivados/correccion-tests-e2e-caja-y-entorno.md) — resuelto: entorno, helpers y locators robustos para `npm run test:e2e`.
- [Errores de deploy en Vercel](archivados/errores-deploy-vercel-forbidden-react-441.md) — resuelto: todos los Server Components del panel usan `getCurrentBranchIdOrRedirect`; las rutas API y server actions mantienen `getCurrentBranchId` para devolver `403`.
- [Auditoría del chat de pedidos — workaround de body, warnings y mejoras pendientes](archivados/auditoria-chat-workaround-y-mejoras.md) — resuelto: JSON body, compresión en test, `disablePollingOnMount` y `force-dynamic`.
- [Auditoría de rate limit 429](archivados/auditoria-rate-limit-429.md) — resuelto: ajustes en rate limit de pedidos y chat.
- [Soporte de pagos mixtos en ventas y pedidos](archivados/pago-mixto-ventas-y-pedidos.md) — resuelto: tabla `sale_payments`, pagos mixtos en ventas y confirmación de pedidos; migración `0022_jittery_grandmaster.sql`.
- [Personalizar promos permitiendo quitar insumos manuales y servicios](archivados/promos-con-servicios-y-manuales.md) — resuelto: promos con insumos críticos, manuales y servicios, snapshots de receta en `sale_item_recipes`/`order_item_recipes`; migraciones `0018_black_vin_gonzales.sql`, `0021_ambiguous_mandarin.sql` y `0023_chubby_sersi.sql`.
- [Imágenes ilustrativas para promos y catálogo público](archivados/plan-imagenes-promos.md) — resuelto: imágenes de productos/promos en catálogo público; migración `0021_ambiguous_mandarin.sql`.
- [Auditoría, depuración y mejoras de UX del módulo de ventas](archivados/auditoria-y-mejoras-ventas.md) — resuelto: productos agotados ocultos por defecto, pago mixto con badge "Mixto" y refactor de `SalesTerminal` en `SalesProductCard`/`SalesCart`; ver `src/lib/ventas-helpers.ts`.

## Véase también

- [Índice general de `.devin`](../README.md)
- [Índice de informes](../informes/README.md)
- [Entornos y credenciales](../informes/entornos.md)
- [Lecciones aprendidas](../informes/lecciones-aprendidas.md)
- [Guía de funcionamiento](../informes/guia-funcionamiento-pancheria.md)
- [AGENTS.md](../../AGENTS.md)
