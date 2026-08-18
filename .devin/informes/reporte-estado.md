# Reporte de estado — Expiración de pedidos, limpieza de `.devin` y estado actual

**Fecha:** 2026-08-18  
**Proyecto:** `pancheria`

---

## 1. Resumen ejecutivo

Se implementó la **expiración automática de pedidos `pending`** para marcar como cancelado un pedido no confirmado dentro del tiempo configurado (por defecto 1 hora, configurable con `ORDER_EXPIRATION_MS`). La funcionalidad incluye la función de dominio e integración en el listado del panel de pedidos. También se agregaron tests unitarios.

Se completó la **limpieza del directorio `.devin`**: los informes históricos obsoletos se eliminaron de `informes/archivados/` y la `guia-funcionamiento-pancheria.md` se actualizó para reflejar el estado real del proyecto. Los prompts resueltos del directorio `prompts/archivados/` se eliminaron previamente, manteniendo solo los prompts activos. Se actualizaron los índices de `.devin/README.md`, `.devin/prompts/README.md`, `pancheria.prompt.md` y `recomendaciones-pedidos-sucursal-stock.md`.

Las verificaciones automatizadas (`lint`, `tsc`, `test`, `build`) y los tests E2E pasan sin errores.

---

## 2. Comandos ejecutados

|| Paso | Comando | Resultado |
|| ---- | ------- | --------- |
|| 1 | `npm run lint` | Pasa (exit 0) |
|| 2 | `npx tsc --noEmit` | Pasa |
|| 3 | `npm test` | 61 suites, 684 tests pasan |
|| 4 | `npm run build` | Build de producción exitoso (39 páginas) |
|| 5 | `npm run test:e2e` | 81 tests E2E pasan (10.2 min) en base de datos de prueba |
|| — | `npx tsx src/db/seeds.ts` | No ejecutado (modifica datos) |
|| — | `npx drizzle-kit check` | No ejecutado (sin cambios de esquema) |

---

## 3. Expiración automática de pedidos `pending`

### Implementación

|| Componente | Archivo | Descripción |
|| ---------- | ------- | ----------- |
|| Configuración | <ref_file file="C:/developer/paginas/pancheria/src/config/orders.ts" /> | `getOrderExpirationMs()` lee `ORDER_EXPIRATION_MS` con default de 3_600_000 ms y mínimo de 60_000 ms. |
|| Servicio | <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> | `expirePendingOrders(branchId?)` busca pedidos `pending` cuyo `createdAt` supere la ventana de expiración y los cancela usando `cancelOrder` con motivo "Expiración automática por inactividad", sin modificar stock. Ignora pedidos que ya fueron confirmados durante la limpieza para evitar errores de carrera. |
|| API de listado | <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/route.ts" /> | `GET /api/pedidos` llama `expirePendingOrders(branchId)` antes de `getOrders`, después de autenticar y validar permisos. |
|| Tests de servicio | <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.test.ts" /> | Cubre expiración de pedidos vencidos y no expiración de pedidos recientes. |

### Variables de entorno agregadas

- `ORDER_EXPIRATION_MS` (opcional) — milisegundos antes de expirar un pedido `pending`. Default: `3600000` (1 hora). Mínimo: `60000`.

Documentadas en <ref_file file="C:/developer/paginas/pancheria/.env.example" />, <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" /> y <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />.

### Notas de operación

- El panel de pedidos (`/pedidos`) expira pedidos automáticamente al listar. Dado que los pedidos `pending` no reservan stock, la expiración solo limpia pedidos viejos del panel; no es crítica para liberar inventario.
- No se requieren cambios de esquema: la expiración usa `orders.createdAt` y `orders.status`.

---

## 4. Flujo de pedidos: sin reserva de stock hasta la confirmación

Se ajustó el flujo de pedidos públicos para que **el stock se descuente únicamente cuando el operador confirma el pedido desde el panel**, no al crearlo. Esto se alinea con la operación real de la panchería: el cliente envía el pedido por WhatsApp, el operador verifica la forma de pago en el chat y recién después confirma o cancela desde la app.

|| Etapa | Archivo | Comportamiento |
|| ----- | ------- | -------------- |
|| Crear pedido | <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> (`createOrder`) | Valida disponibilidad con `validateCartAvailability` e inserta `orders` e `order_items` en estado `pending`. **No descuenta stock.** |
|| Confirmar pedido | <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> (`convertOrderToSale`) | Revalida disponibilidad, descuenta stock (`deductStockForItems` con `movementType: 'sale'`), crea la venta, actualiza la caja y marca el pedido como `converted`. Conserva los precios históricos de `order.items`. |
|| Cancelar pedido | <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> (`cancelOrder`) | Marca el pedido como `cancelled`. **No modifica stock** porque el pedido nunca lo reservó. |
|| Expirar pedido | <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> (`expirePendingOrders`) | Cancela pedidos `pending` vencidos. **No modifica stock**. |
|| UI pública | <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" /> | El botón y el mensaje del diálogo indican que el pedido se envía por WhatsApp y que el stock se confirma al aceptar el pedido. |

### Implicaciones

- **Ventaja operativa**: evita bloquear stock en pedidos que el operador aún no confirmó (por ejemplo, mientras verifica la forma de pago).
- **Riesgo**: dos clientes pueden ver stock disponible y crear pedidos del mismo producto antes de que el operador confirme el primero. `convertOrderToSale` falla con `InsufficientStockError` si al confirmar no hay stock suficiente; el operador debe cancelar el pedido e informar al cliente.
- **Movimientos de stock**: los pedidos `pending` no generan movimientos de tipo `order` ni `order_cancellation`. El descuento ocurre con `sale` al confirmar; la anulación de una venta genera `cancellation`.
- **Concurrencia**: `expirePendingOrders` ignora pedidos que fueron confirmados o cancelados entre la búsqueda y la cancelación, evitando errores si un operador confirma un pedido mientras el panel limpia pedidos viejos.
- **Tests E2E**: el texto del botón en el catálogo pasó de "Reservar y abrir WhatsApp" a "Enviar pedido por WhatsApp".

---

## 5. Limpieza de `.devin`

|| Acción | Archivos afectados | Resultado |
|| ------ | ------------------ | --------- |
|| Actualizar guía de funcionamiento | <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" /> | Se corrigieron limitaciones resueltas, el flujo de stock de pedidos y el checklist antes de producción. |
|| Eliminar informes históricos obsoletos | `.devin/informes/archivados/*.md` (informes de estado 2026-08-13, 2026-08-15, 2026-08-17, plan y auditoría de pedidos del 17/08). | Eliminados; el `reporte-estado.md` vigente y `lecciones-aprendidas.md` concentran el contexto actual. |
|| Eliminar prompts archivados | `.devin/prompts/archivados/*.md` (eliminados) y el directorio vacío removido. | Se mantuvieron solo los prompts activos: `pancheria.prompt.md`, `auditoria-y-documentacion.md`, `recomendaciones-pedidos-sucursal-stock.md` y `errores-deploy-vercel-forbidden-react-441.md`. |
|| Actualizar índices | <ref_file file="C:/developer/paginas/pancheria/.devin/README.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/recomendaciones-pedidos-sucursal-stock.md" /> | Referencias a archivos archivados actualizadas o eliminadas. |

---

## 6. Estado del plan de cobertura — Pedidos, sucursal y cliente

El plan de cobertura del 2026-08-17 quedó implementado. A continuación el estado final de cada fase:

|| Fase | Objetivo | Estado | Evidencia |
|| ---- | -------- | ------ | --------- |
|| Fase 1 | Conservar precios históricos en `convertOrderToSale` | **Implementado** | `buildSaleItemValues` acepta `unitPrice` y `subtotal` opcionales en <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />. `convertOrderToSale` pasa los valores de `order.items` en <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />. |
|| Fase 2 | Validar `branchId` entero positivo en `/pedido` | **Implementado** | `parseBranchId` en <ref_file file="C:/developer/paginas/pancheria/src/lib/branch-resolver.ts" />. |
|| Fase 3 | `branchId` explícito en el panel de pedidos | **Implementado** | <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedidos-list.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/route.ts" />. |
|| Fase 4 | Rate limiting de pedidos públicos | **Resuelto — rate limit por IP en memoria suficiente para el alcance actual** | <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />. Para escalar horizontalmente, requiere store compartido. |
|| Fase 5 | Consolidar lógica de cancelación | **Implementado** | `cancelSale` reusa `buildReintegrationContext` y `reintegrateStockAndUpdateCashRegister` de <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />. `cancelOrder` no modifica stock porque los pedidos `pending` no reservan. |
|| Fase 6 | Decisión sobre `setState` en `useEffect` | **Resuelto documentalmente** | <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> y <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/recomendaciones-pedidos-sucursal-stock.md" />. |
|| Fase 7 | Eliminar carga inicial duplicada del catálogo | **Implementado** | <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />. |
|| Fase 8 | Actualizar documentación de prompts | **Implementado y ampliado** | Limpieza completa de `prompts/archivados/` y actualización de `guia-funcionamiento-pancheria.md`. |
|| Fase 9 | Seguridad de `.env.local` | **Recomendación pendiente del usuario** | No ejecutable por el agente. |

---

## 7. Prompt activos y su estado

- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" /> — vigente.
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" /> — vigente.
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/recomendaciones-pedidos-sucursal-stock.md" /> — vigente.
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/errores-deploy-vercel-forbidden-react-441.md" /> — **resuelto**. Todos los Server Components del panel usan `getCurrentBranchIdOrRedirect`; las rutas API y server actions mantienen `getCurrentBranchId` para devolver `403`.

---

## 8. Hallazgos

|| Gravedad | Hallazgo | Estado |
|| -------- | -------- | ------ |
|| Menor | Expiración automática de pedidos `pending` no estaba implementada. | **Resuelto** con `expirePendingOrders` e integración en `GET /api/pedidos`. |
|| Menor | Directorio `.devin` contenía prompts archivados e informes resueltos que ya no eran necesarios en la raíz. | **Resuelto** — documentación actualizada, informes obsoletos eliminados, índices actualizados. |
|| Menor | `src/app/(panel)/pedidos/page.tsx` y `src/app/(panel)/layout.tsx` aún usan `getCurrentBranchId` directamente. | **Resuelto** — ambos Server Components migraron a `getCurrentBranchIdOrRedirect`. |
|| Menor / Escalabilidad | Rate limit de pedidos públicos vive en memoria por instancia. | **Pendiente** — documentado; requiere decisión de arquitectura (KV/Redis/PostgreSQL). |
|| Menor | Pedidos públicos reservaban stock al crearse, antes de la confirmación del operador. | **Resuelto** — `createOrder` ya no descuenta stock; `convertOrderToSale` descuenta al confirmar; `cancelOrder` y expiración no tocan stock. |
|| Menor / Operativo | `STORAGE_PROVIDER=local` en producción con `BLOB_READ_WRITE_TOKEN` configurado. | **Resuelto** — `STORAGE_PROVIDER` cambiado a `vercel-blob` en producción y en `.env.example`. |
|| Menor / Documentación | `guia-funcionamiento-pancheria.md` tenía limitaciones y checklist desactualizados. | **Resuelto** — sección 1, tabla de movimientos de stock, limitaciones, checklist y conclusiones actualizadas. |
|| Informativo | Las verificaciones automatizadas pasan; no hay regresiones detectadas. | Confirmado. |

---

## 9. Riesgos y acciones pendientes

|| Riesgo / Acción | Descripción |
|| ----------------- | ----------- |
|| `npm run test:e2e` | Ejecutado: 81 tests pasan. Repetir en base de datos de prueba antes de cada deploy o cambio de flujo crítico. |
|| `npx tsx src/db/seeds.ts` | No ejecutado. Es idempotente pero modifica datos. Ejecutar solo con confirmación. |
|| `npx drizzle-kit check` | Ejecutar tras cambios de esquema futuros para validar consistencia. |
|| Migración de `getCurrentBranchIdOrRedirect` | **Resuelto** en `src/app/(panel)/layout.tsx` y `src/app/(panel)/pedidos/page.tsx`. Las rutas API y server actions mantienen `getCurrentBranchId` para devolver `403`. |
|| Variables de producción | `NEXTAUTH_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ORDER_EXPIRATION_MS` y `STORAGE_PROVIDER` verificadas. `STORAGE_PROVIDER` ahora es `vercel-blob`. |
|| Rate limit compartido | Evaluar store compartido para `POST /api/public/pedido` si se escala horizontalmente. |

---

## 10. Recomendaciones

1. ~~**Ejecutar `npm run test:e2e`** en una base de datos de prueba para validar el flujo completo, incluyendo la expiración de pedidos.~~ **Resuelto: 81 tests pasan.**
2. ~~**Completar la migración a `getCurrentBranchIdOrRedirect`** en `src/app/(panel)/layout.tsx` y `src/app/(panel)/pedidos/page.tsx`.~~ **Resuelto.**
3. ~~**Verificar el proveedor de almacenamiento de videos en producción** antes del deploy.~~ **Resuelto — `STORAGE_PROVIDER` es `vercel-blob`.**
4. **Mantener `AGENTS.md`, `README.md`, `.devin/environment.yaml`, `guia-funcionamiento-pancheria.md` y `.devin/prompts/pancheria.prompt.md` sincronizados** con cada nueva feature o variable de entorno.
5. **No duplicar informes de estado**: generar un único `reporte-estado.md` vigente y archivar los anteriores.
6. **Evaluar rate limit compartido** para pedidos públicos antes de escalar horizontalmente.

---

## 11. Conclusión

El proyecto incorporó la expiración automática de pedidos, actualizó la `guia-funcionamiento-pancheria.md` para reflejar el estado real, eliminó informes históricos obsoletos, migró todos los Server Components del panel a `getCurrentBranchIdOrRedirect` y ajustó el flujo de pedidos para que el stock se descuente solo al confirmar desde el panel. Las pruebas unitarias, el build de producción y los tests E2E pasan. Quedan las recomendaciones habituales de despliegue y la evaluación futura del rate limit compartido.
