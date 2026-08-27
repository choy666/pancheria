# ARCHIVADO — Prompt: Cobertura de auditoría — flujo de pedidos públicos y stock

> **Estado: archivado.** El flujo de pedidos evolucionó a estados `pending` → `in_process` → `paid` → `finished` con reservas de stock. El contexto vigente está en `.devin/informes/guia-funcionamiento-pancheria.md`. Se conserva como registro histórico.

## Contexto

Proyecto: `pancheria` — Sistema multi-sucursal de gestión de stock, ventas, caja y pedidos públicos por WhatsApp.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5, Playwright.

Este prompt documenta el flujo de pedidos públicos vigente y las decisiones de arquitectura que lo sostienen. Antes de tocar cualquiera de estos archivos, leer:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/archivados/recomendaciones-pedidos-sucursal-stock-2026-08-27.md" />

> **Advertencia:** el flujo anterior con `sentAt` y confirmación de envío por WhatsApp fue revertido. El contexto histórico vive en `.devin/prompts/archivados/confirmacion-envio-pedido-whatsapp.md` e `.devin/informes/archivados/`. Este prompt y el código son la fuente de verdad del flujo vigente.

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
npm run knip
npx playwright test tests/e2e/pedido-sucursal-y-stock.spec.ts
```

Para la suite completa de E2E:

```bash
npm run test:e2e
```

> **Atención:** `tests/e2e/global-setup.ts` trunca tablas y re-ejecuta `src/db/seeds.ts`. No correr E2E en una base de datos con datos reales.

## 4. Decisiones clave que no se deben revertir sin consultar

1. **No se reserva stock al crear el pedido.** La disponibilidad del catálogo es solo informativa/validación inicial.
2. **El stock se descuenta solo al confirmar la venta** desde el panel (`convertOrderToSale`).
3. **La confirmación de envío no es del cliente.** El cliente envía por WhatsApp; el operador confirma desde el panel.
4. **No hay `sentAt`.** Si en el futuro se quiere trackear envío, se debe diseñar de nuevo y no restaurar el código anterior.
5. **El enlace de WhatsApp del panel es la herramienta del operador**, no un reemplazo del flujo del cliente.

## 5. Relación con otros prompts e informes

- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/archivados/recomendaciones-pedidos-sucursal-stock-2026-08-27.md" /> — flujo de pedidos, sucursales y stock.
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" /> — guía operativa del negocio: multi-sucursal, stock, caja, pedidos.
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> — lecciones transversales de auditorías anteriores.
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" /> — estado verificado del proyecto y recomendaciones vigentes.
