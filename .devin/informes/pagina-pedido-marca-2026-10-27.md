# Página de pedido: marca, navegación y pie empresarial

**Estado:** en curso (2026-10-27). Implementado y verificado en local: tipos, lint, Jest (214 suites, 2485 pruebas), knip, build y E2E de la marca (9/9). La migración `0044` está aplicada en desarrollo, en la base E2E y en producción (2026-10-27, con confirmación explícita). El desborde del encabezado del panel quedó resuelto (menú "Más" + menú de usuario + breakpoint `xl`). Quedan pendientes la revisión legal, el deploy de este código y el commit/PR.

## Qué se implementó

- **Datos:** tabla `brand_settings` (fila singleton `id = 1`) con nombre, lema, logo, datos legales, pie, preguntas frecuentes (hasta 8), aviso destacado y tres interruptores de bloques. Migración `drizzle/0044_brand-settings.sql`.
- **Panel `/pedido-config` (solo admin):** marca, logo (PNG, JPG o WebP; se reduce a 512 px en el navegador), datos legales y de contacto, pie, preguntas frecuentes, aviso destacado y vista previa en vivo con la sucursal activa. Acceso desde la tarjeta **"Página de pedido"** en Accesos rápidos. El enlace "Catálogo" del panel ahora lleva a la sucursal activa.
- **Cliente:**
  - Encabezado con logo y nombre, "Hacer pedido", "Seguir mi pedido" y "Chat del pedido" (solo si hay un pedido reciente vigente).
  - Pie con identidad, pedidos, sucursal, legal, preguntas frecuentes y derechos de autor.
  - Nota legal junto a "Confirmar pedido" (solo si se cargaron términos o privacidad).
  - `noindex` en seguimiento y chat.
- **Seguimiento y cancelación:**
  - El seguimiento entrega el token del chat mientras el pedido no esté `finished` ni `cancelled`.
  - La cancelación pública solo acepta `pending`, tanto antes de la transacción como dentro del lock.
  - Botón "Cancelar pedido" con confirmación, solo en pendientes.
- **Captación:**
  - Metadatos por sucursal (título, descripción, Open Graph y canonical).
  - JSON-LD `Restaurant` con `OrderAction`.
  - "Compartir catálogo" y "Ver QR" en `/pedido`.
- **Pantallas:** `/pantalla` y `/menu` muestran la marca en el encabezado, el skeleton y el error, y reciben `brand` en sus snapshots, así el polling de la TV la actualiza. Si no hay marca cargada, el encabezado muestra el nombre de la sucursal una sola vez.
- **Corrección de pruebas y helpers:** el copy del chat distingue pedido vencido de pedido finalizado o cancelado; los test-ids del pie no se repiten; `loginAs` espera la hidratación del campo de usuario.

## Desviaciones respecto del plan aprobado

1. **Logo en la base, no en el storage activo.** Se guarda en `brand_settings.logo_data` (`bytea`, con check de 512 KB) y se sirve desde `GET /api/public/marca/logo?v=…`. Así funciona igual con cualquier `STORAGE_PROVIDER` y no depende del disco de Vercel, que es efímero.
2. **Sin fila semilla en `seeds.ts`.** La marca es configuración del dueño. Sin datos, el nombre cae a la sucursal activa y el pie omite los bloques vacíos.
3. **Validación del CUIT solo por formato** (11 dígitos, con o sin guiones). No se verifica el dígito verificador.
4. **Sin cambios en `next.config.ts`.** El logo usa `next/image` con `unoptimized`.
5. **Acceso desde la tarjeta del panel, no desde el encabezado.** El plan lo permitía. El encabezado ya se desborda antes de este trabajo (ver pendientes) y un ítem más lo empeoraba 68 px.
6. **Vista previa del pie:** los breakpoints son del viewport del panel, no del recuadro. A 1280 px el pie se ve en cuatro columnas estrechas dentro de la vista previa. Es solo visual; el pie público no cambia.

## Pendiente antes de producción

- **Migración `0044` en producción: aplicada el 2026-10-27** sobre `neondb`, la base que sirve el sitio (mismo endpoint que desarrollo, `neondb_dev`). El código de producción actual no usa la tabla, así que el sitio no cambió. Sin la tabla, `brandService.getBrand()` falla y las páginas públicas responden 500; por eso debe existir antes del deploy de este código.
- **Encabezado del panel: desborde previo a este trabajo, ya resuelto.** Medido con 13 ítems: 317 px de desborde a 1280, 231 a 1366, 61 a 1536 y 0 a 1920. A 1280 px "Catálogo" se superpone con el selector de sucursal, y "Mi perfil" y "Cerrar sesión" quedaban fuera de la pantalla. **Solución aplicada (2026-10-27):** los 7 ítems operativos quedan fijos y el resto (Reportes, Sucursales, Usuarios, Videos, Pantallas, Catálogo) va a un menú "Más"; nombre, "Mi perfil" y "Cerrar sesión" pasaron a un menú de usuario (`@base-ui/react/menu`, nuevo `src/components/ui/dropdown-menu.tsx`); la barra de escritorio solo se muestra desde `xl` (1280 px), por debajo el menú hamburguesa cubre todo. Medido después: `documentElement.scrollWidth === innerWidth` en 1280/1366/1536/1920, sin desborde. E2E actualizados: `paso3`, `perfil-cambio-contrasena`, `pantalla-config`, `roles-y-sucursales`.
- **Revisión legal** de términos, política de privacidad, leyenda de la Ley 25.326 y textos del pie por un profesional. Sobre el botón de arrepentimiento: InfoLeg 417152 (B.O. 04/09/2025) pide un enlace visible y en el primer acceso; hoy está en el pie porque así lo aprobó el plan.
- **Diagrama ER** de `arquitectura/`: no incluye `brand_settings` (la tabla sí está en `base-de-datos.md`). Regenerar según el checklist pre-push.
- **Commit y PR:** los cambios quedaron sin commitear.

## Verificación

- **E2E** en la base descartable `neondb_e2e`:
  - `pedido-marca.spec.ts`: 9/9 pasan con el código final.
  - Suite completa (corrida previa al cambio de la tarjeta del panel): 218 pasaron, 2 inestables (guía, que pasaron al reintentar) y 1 falló en `responsive.spec.ts` («no hay scroll horizontal en las rutas protegidas principales»). Ese caso pasó al correrlo solo, junto con las dos pruebas de la guía que habían fallado.
  - Después del cambio del panel: accesibilidad (axe) y guía pasan.
- **Local:** `npx tsc --noEmit` sin errores; `npm run lint` sin errores (1 advertencia preexistente en `sign-out-client.tsx`); `npx jest` con 214 suites y 2485 pruebas; `npm run knip` sin hallazgos; `npm run build` exitoso.
- **Revisión visual:** encabezado y pie a 360 px correctos. `/pedido-config` a 1280 px correcto; el desborde del encabezado del panel quedó resuelto (ver pendientes). Las capturas están en `.devin/informes/shots/`, carpeta fuera de git que ya contenía capturas de auditorías anteriores: algunas capturas nuevas pueden haber sobrescrito archivos con el mismo nombre.
- **Pruebas nuevas:** `brand-helpers`, `brand-logo-normalize`, `structured-data`, `brandService`, `public-footer`, cancelación pública de pedidos aceptados, seguimiento y cancelación desde el seguimiento, copy de chat vencido y cerrado, acceso desde el panel (admin y operador) y `tests/e2e/pedido-marca.spec.ts`.
