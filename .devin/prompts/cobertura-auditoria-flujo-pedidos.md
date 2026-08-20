# Prompt: Cobertura de auditoría — flujo de pedidos públicos y stock

## Contexto

Proyecto: `pancheria` — Sistema multi-sucursal de gestión de stock, ventas, caja y pedidos públicos por WhatsApp.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5, Playwright.

Este prompt documenta el estado del flujo de pedidos públicos por WhatsApp después de una auditoría y limpieza. Antes de tocar cualquiera de estos archivos, leer:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/recomendaciones-pedidos-sucursal-stock.md" />

> **Advertencia:** el flujo anterior con `sentAt` y confirmación de envío por WhatsApp fue revertido. El único contexto histórico vive en `.devin/informes/archivados/`. Este prompt y el código son la fuente de verdad del flujo vigente.

## 1. Flujo vigente de pedidos públicos

### Creación del pedido

- Componente: <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />
- API pública: <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />
- Servicio: <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> (`createOrder`)

El cliente crea un pedido en estado `pending`. El sistema:

1. Valida disponibilidad con `validateCartAvailability`.
2. Inserta `orders` e `order_items`.
3. Genera la URL de WhatsApp con `buildWhatsAppMessage` y `encodeWhatsAppUrl`.
4. Muestra un diálogo con título **"Pedido creado"** y mensaje que aclara:
   - El pedido se creó correctamente.
   - El cliente debe abrir WhatsApp para enviarlo.
   - Si no se abre automáticamente, puede usar el enlace manual.
   - El operador lo confirmará y preparará al recibir el mensaje.
5. **No reserva ni descuenta stock.**

### Diálogo de éxito

- No hay fases `reserved` → `confirming` → `sent`.
- No se le pregunta al cliente si ya envió el mensaje.
- El botón "Enviar Pedido" abre WhatsApp con `noopener,noreferrer`.
- El enlace **"Abrir WhatsApp manualmente"** está siempre visible.

### Cancelación pública

- Endpoint: `POST /api/public/pedido/[id]/cancelar` (valida `cancellationToken`).
- Marca el pedido como `cancelled`.
- **No modifica stock** porque el pedido nunca reservó.

### Confirmación del operador

- Endpoint: <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/confirmar/route.ts" />
- Servicio: <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> (`convertOrderToSale`)
- Requisitos: sesión, sucursal activa, caja abierta, pedido `pending`, stock disponible.
- Acciones:
  1. Revalida stock con `validateCartAvailability`.
  2. Descuenta stock con `deductStockForItems` (tipo `sale`).
  3. Crea la venta y actualiza la caja.
  4. Marca el pedido como `converted`.

### Enlace de WhatsApp para el operador

- En <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" /> el panel muestra un botón **"Abrir WhatsApp del cliente"** que reconstruye el mensaje y abre el chat.
- Esto permite reenviar el pedido si el cliente no lo envió.

## 2. Limpieza realizada (ya aplicada)

Los siguientes elementos fueron eliminados del flujo y del esquema:

| Elemento | Qué se hizo |
|---|---|
| `sentAt` | Eliminado de `src/db/schema.ts`, `src/domain/types.ts`, respuestas API, tipos del cliente y del panel. |
| `markOrderAsSent` | Eliminado de `src/application/services/orderService.ts` y `src/repositories/orderRepository.ts`. |
| `orderSendSchema` | Eliminado de `src/lib/zod-schemas.ts`. |
| `POST /api/public/pedido/[id]/enviar` | Eliminado el directorio `src/app/api/public/pedido/[id]/enviar/`. |
| Badge "Enviado por WhatsApp" | Eliminado de `pedidos-list.tsx` y `pedido-detail.tsx`. |
| `PUBLIC_PEDIDO_ENVIAR_API` | Eliminado de `src/config/api.ts`. |
| Migración | `drizzle/0012_dear_mulholland_black.sql` (`DROP COLUMN sent_at`) generada y aplicada. |

**No volver a introducir `sentAt` ni confirmación del cliente a menos que el usuario lo pida explícitamente.**

## 3. Verificaciones mínimas

Después de cualquier cambio en este flujo, correr:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
npx playwright test tests/e2e/pedido-sucursal-y-stock.spec.ts
```

Para la suite completa de E2E:

```bash
npm run test:e2e
```

> **Atención:** `tests/e2e/global-setup.ts` trunca tablas y re-ejecuta `src/db/seeds.ts`. No correr E2E en una base de datos con datos reales.

## 4. Pendientes documentados

Los siguientes items quedaron como deuda técnica / mejoras futuras. Revisarlos en próximas auditorías:

### 4.1 Código muerto

- ~~<ref_file file="C:/developer/paginas/pancheria/src/components/panel/branch-required-fallback.tsx" /> no es importado por ningún otro archivo.~~ Resuelto: se eliminó porque el flujo actual redirige a login o sucursales cuando el usuario no tiene una sucursal asignada.

### 4.2 Simplificación de schemas

- ~~En <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />, `videoSchema` es un alias de `videoBaseSchema`. Unificar en uno solo.~~ **Resuelto / obsoleto:** `videoBaseSchema` no existe; `videoSchema` es el único schema de video.

### 4.3 Documentación

- ~~En <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" /> la tabla de "¿se modifica el stock y quién lo hace?" contenía una fila obsoleta: "Confirmar envío por WhatsApp" con referencia a `sentAt`.~~ **Resuelto:** no quedan referencias a `sentAt`, `sent_at`, confirmación de envío por WhatsApp ni `POST /api/public/pedido/[id]/enviar` en los informes activos ni en el código.

### 4.4 Validación completa

- Correr la suite E2E completa (`npm run test:e2e`) para detectar regresiones en otros flujos.

### 4.5 Dependencias marcadas como no usadas

- `knip` puede marcar `@aws-sdk/client-s3` y `@aws-sdk/s3-presigned-post` como no usadas porque se importan dinámicamente en <ref_file file="C:/developer/paginas/pancheria/src/lib/storage.ts" />. No eliminar. **Resuelto:** los imports dinámicos ahora están tipados con `import type { S3Client }` y `import type { createPresignedPost }`.

## 5. Mejoras sugeridas

### 5.1 Tests E2E más robustos

- Preferir `getByRole` con nombres exactos en lugar de `getByText` parciales para reducir fragilidad.
- En `tests/e2e/pedido-sucursal-y-stock.spec.ts` se usó `.getByTestId()` con `.getByText()` para scopar selectores de disponibilidad.

### 5.2 Tipado de `src/lib/storage.ts`

- ~~Los `any` para clientes S3/R2 son difíciles de mantener. Considerar tipar los módulos importados dinámicamente o usar librerías más específicas.~~ **Resuelto:** se tiparon los clientes con `import type { S3Client }` y `import type { createPresignedPost }`, y se eliminaron los `any`.

### 5.3 Auditoría periódica

- Ejecutar `npx knip` cada cierto tiempo para detectar exports muertos. Muchos son componentes de shadcn generados automáticamente, pero conviene revisar los propios del dominio.

### 5.4 Rate limiting en producción

- El proyecto tiene `public_order_rate_limits`. Asegurar `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db` en producción con múltiples instancias. Esto es una acción de configuración en Vercel, no de código.

## 6. Decisiones clave que no se deben revertir sin consultar

1. **No se reserva stock al crear el pedido.** La disponibilidad del catálogo es solo informativa/validación inicial.
2. **El stock se descuenta solo al confirmar la venta** desde el panel (`convertOrderToSale`).
3. **La confirmación de envío no es del cliente.** El cliente envía por WhatsApp; el operador confirma desde el panel.
4. **No hay `sentAt`.** Si en el futuro se quiere trackear envío, se debe diseñar de nuevo y no restaurar el código anterior.
5. **El enlace de WhatsApp del panel es la herramienta del operador**, no un reemplazo del flujo del cliente.
