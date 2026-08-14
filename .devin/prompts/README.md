# Guía para escribir prompts — Proyecto Panchería

> Antes de crear un prompt nuevo, consultar los informes y `lecciones-aprendidas.md` para evitar regresiones documentadas.

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
4. Leer el código afectado usando `<ref_file .../>` o `<ref_snippet .../>`.
5. Si `lecciones-aprendidas.md` cubre el tema, no crear un prompt nuevo; referenciarlo.

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
- `NotFoundError` debe devolver `404`; `DomainError` genérico `400`.
- No mezclar helpers de UI con utilidades generales (`src/lib/utils.ts` vs `src/lib/json.ts`).
- No ocultar reglas de negocio en helpers de test.
- Validar integridad con soft delete considerando el estado del padre.
- Tener cuidado con `findFirst` cuando coexisten activos e inactivos.
- Incluir siempre una sección de seguridad y entorno cuando se trabaje con `.env.local`, credenciales o bases de datos.

## Cuándo crear un nuevo prompt

Crear un prompt nuevo solo cuando:
1. El tema no está cubierto por la guía ni por un informe existente.
2. La tarea es lo suficientemente compleja como para requerir contexto estructurado.
3. Se detecta un patrón repetible.

Si la tarea es puntual, preferir preguntar directamente incluyendo `AGENTS.md` y `lecciones-aprendidas.md`.

## Cómo referenciar archivos

Usar `<ref_file file="..."/>` para archivos completos y `<ref_snippet file="..." lines="x-y"/>` para secciones específicas.

## Prompts guardados

Lista de prompts reutilizables y activos:

- [Actualizar documentación y generar informe de estado](actualizar-documentacion-y-reporte.md) — guía reutilizable.
- [Auditoría general](auditoria-documentacion.md) — guía reutilizable.
- [Corroborar y mejorar diseño responsive](diseno-responsive.md) — guía reutilizable.
- [Página de administración para videos con reproducción y soporte Cast](videos-y-cast.md) — guía reutilizable.

> Los prompts resueltos (`caja-trazabilidad-sucursal-y-operador.md`, `control-de-acceso-y-sucursales.md`, `multi-sucursal.md`, `roles-y-permisos.md`, `tour-navbar.md`, `tour-por-rol.md` y `verificar-navbar-sucursal.md`) fueron eliminados porque su implementación ya finalizó y su contexto queda resumido en `.devin/informes/lecciones-aprendidas.md` y en este índice.

## Véase también

- [Índice de informes](../informes/README.md)
- [Lecciones aprendidas](../informes/lecciones-aprendidas.md)
- [AGENTS.md](../../AGENTS.md)
