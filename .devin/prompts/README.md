# Guía para escribir prompts — Proyecto Panchería

> Esta guía reemplaza la acumulación de prompts puntuales. Antes de crear un prompt nuevo, consultar los informes y lecciones aprendidas para evitar regresiones documentadas.

## Propósito

El directorio `.devin/prompts` debe contener **guías y ejemplos reutilizables**, no una colección infinita de prompts monolíticos. Un buen prompt para este proyecto debe ser:

- **Contextualizado**: incluye stack, arquitectura y estado actual.
- **Evidenciado**: referencia código real con `<ref_file .../>` o `<ref_snippet .../>`.
- **Preventivo**: cruza con informes y lecciones aprendidas.
- **Accionable**: define objetivo, reglas de negocio, archivos a tocar y verificaciones.
- **Seguro**: incluye consideraciones de entorno, credenciales y bases de datos de prueba.

## Antes de escribir un prompt

1. Revisar si ya existe un informe relacionado en `.devin/informes/README.md`.
2. Leer `.devin/informes/lecciones-aprendidas.md` para no repetir errores documentados.
3. Leer <file:///C%3A/developer/paginas/pancheria/AGENTS.md> para respetar comandos, variables de entorno y convenciones.
4. Leer el código que será afectado usando `<ref_file .../>` o `<ref_snippet .../>`.
5. Revisar si `.devin/informes/lecciones-aprendidas.md` ya cubre el tema; si no, crear un prompt nuevo siguiendo esta guía.

## Estructura recomendada

### 1. Título claro

```markdown
# Prompt: {acción concreta} en {área del sistema}
```

Ejemplo: `# Prompt: Sistema de Caja con Apertura, Cierre Automático e Historial`.

### 2. Contexto

- Proyecto y dominio.
- Stack y arquitectura.
- Estado actual relevante del sistema.
- Documentación de referencia (informes, AGENTS.md, README.md).

### 3. Problema u objetivo

- Si es una auditoría: listar hipótesis y síntomas.
- Si es una feature: describir el comportamiento esperado.
- Si es un refactor: explicar por qué es necesario.

### 4. Reglas de negocio

Enumerar las reglas que **no deben romperse**. Ejemplos del proyecto:

- Los productos nuevos nacen con `stock: 0` y `minStock: 0`.
- Las promos (`compound`) y servicios (`service`) siempre tienen `stock: 0` y `minStock: 0`.
- Los ajustes manuales de stock y la carga inicial pasan por `stockService.adjustStock`.
- Las ventas y anulaciones gestionan sus propios movimientos de stock de forma transaccional dentro de `saleService`.
- No se hardcodean credenciales ni URLs de API.

### 5. Implementación detallada

Dividir en secciones por capa (frontend, backend, base de datos, tests). Evitar indicar pasos genéricos como "arreglar todo". Preferir referencias a archivos concretos.

### 6. Archivos y áreas a tocar

Listar archivos relevantes usando `<ref_file .../>` o `<ref_snippet .../>`:

```markdown
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/productService.ts" />
- <ref_snippet file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" lines="24-45" />
```

### 7. Consideraciones de seguridad y entorno

- `.env.local` no se commitea.
- Tests E2E truncan la base; usarlos solo en entornos de prueba.
- No hardcodear credenciales, secretos ni URLs de API.

### 8. Verificaciones

| Comando | Cuándo usarlo |
| ------- | ------------- |
| `npm run lint` | Siempre |
| `npm run build` | Siempre |
| `npm test` | Cambios en servicios, repositorios o dominio |
| `npm run test:e2e` (o `npx playwright test`) | Cambios en flujos críticos de UI/E2E |
| `npx tsc --noEmit` | Cambios de tipos |
| `npx drizzle-kit push` | Cambios en esquema de base de datos |

## Plantilla base

```markdown
# Prompt: {título}

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos y cierre de caja.

Stack:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Drizzle ORM con PostgreSQL (Neon)
- NextAuth v5
- Patrón de arquitectura: repositorios + servicios de aplicación + dominio

Documentación de referencia:

- <file:///C%3A/developer/paginas/pancheria/AGENTS.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md>
- {informe específico si aplica}

## Estado actual relevante

{2-3 oraciones sobre el estado previo al cambio.}

## Objetivo

{Qué debe lograrse.}

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

- {tests unitarios y/o E2E a agregar o actualizar}

## Consideraciones de seguridad y entorno

- No hardcodear credenciales ni URLs de API.
- Ejecutar tests E2E solo en base de datos de prueba.
- `.env.local` no debe commitearse.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Detectar errores de estilo y tipado |
| `npm run build` | Verificar build de producción |
| `npm test` | Ejecutar tests unitarios |
| `npm run test:e2e` (o `npx playwright test`) | Ejecutar tests E2E en base de prueba |
```

## Anti-patrones y lecciones aprendidas

Consultar `.devin/informes/lecciones-aprendidas.md` para el detalle completo. Los puntos críticos son:

- **Verificar el patrón de manejo de errores antes de recomendar `throw new Error()`**. En Next.js con `useActionState`, la server action debe devolver el estado con `error`.
- **Confirmar limitaciones de librerías antes de documentarlas**. Ejemplo: Zod v4 sí soporta `productBaseSchema.partial().refine(...)`.
- **Distinguir tipos de error en wrappers de API**. `NotFoundError` debe devolver `404`, no `400`.
- **No mezclar helpers de UI con utilidades generales**. `src/lib/utils.ts` contiene `cn`; utilidades de JSON van en `src/lib/json.ts`.
- **No ocultar reglas de negocio en helpers de test**. Los productos nuevos nacen con `stock: 0`; la carga inicial se registra con `type: 'restock'`.
- **Validar integridad con soft delete considerando el padre**. Una receta huérfana de una promo eliminada no debe bloquear operaciones.
- **Tener cuidado con `findFirst` cuando coexisten activos e inactivos**.
- **Revisar imports obsoletos antes de incluirlos en un checklist**.
- **Incluir siempre una sección de seguridad y entorno** cuando se trabaje con `.env.local`, credenciales o bases de datos.

## Cuándo crear un nuevo prompt

Crear un prompt nuevo solo cuando:

1. El tema no está cubierto por la guía ni por un informe existente.
2. La tarea es lo suficientemente compleja como para requerir contexto estructurado.
3. Se detecta un patrón que se va a repetir y conviene documentar.

Si la tarea es puntual o simple, es preferible hacer la pregunta directamente en la conversación e incluir como contexto `AGENTS.md` y `lecciones-aprendidas.md`.

## Cómo referenciar archivos

Para que Devin lea el contexto exacto, usar las etiquetas `<ref_file .../>` y `<ref_snippet .../>`:

```markdown
<ref_file file="C:/developer/paginas/pancheria/src/domain/errors.ts" />
<ref_snippet file="C:/developer/paginas/pancheria/src/application/services/productService.ts" lines="99-108" />
```

Preferir `<ref_snippet .../>` cuando se quiere destacar una sección específica. Preferir `<ref_file .../>` cuando se quiere que Devin lea el archivo completo.

## Nota sobre prompts anteriores

Los prompts puntuales anteriores fueron condensados en guías reutilizables; los que aún se conservan (`multi-sucursal.md` y `tour-navbar.md`) reflejan propuestas o problemas específicos. Esta guía es ahora el punto de partida para escribir prompts nuevos. Los ejemplos concretos pueden reconstruirse a partir del historial de commits si es necesario.

## Véase también

- [Índice de informes de auditoría](file:///C%3A/developer/paginas/pancheria/.devin/informes/README.md)
- [Lecciones aprendidas](file:///C%3A/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md)
- [AGENTS.md](file:///C%3A/developer/paginas/pancheria/AGENTS.md)
