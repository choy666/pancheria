# Prompt: Hacer pública la sección de pedidos

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja y cierre de caja.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia:
- `AGENTS.md`
- `.devin/informes/lecciones-aprendidas.md`
- `.devin/prompts/pancheria.prompt.md`

## Estado actual relevante

El proyecto ya cuenta con un flujo de pedidos público completo: catálogo en `src/app/(public)/pedido/page.tsx`, API pública en `src/app/api/public/pedido/route.ts`, y validación de disponibilidad en `src/app/api/public/disponibilidad/route.ts`. El esquema `orders` no requiere usuario autenticado. El problema que puede impedir el acceso sin sesión reside en el proxy de Next.js 16 (`src/proxy.ts`) y en el callback `authorized` de `src/auth.config.ts`, que históricamente solo permitía `/login`.

## Objetivo

Permitir que cualquier persona acceda a `/pedido`, arme un carrito, reserve un pedido y reciba el enlace de WhatsApp para enviarlo, sin necesidad de iniciar sesión. La página no debe destacar el inicio de sesión. Los usuarios autenticados deben seguir accediendo al panel; los visitantes deben caer en el catálogo al entrar al dominio.

## Reglas de negocio

1. `/pedido`, `/api/public/catalogo`, `/api/public/disponibilidad`, `/api/public/pedido` y `/api/public/pedido/[id]/cancelar` deben ser accesibles sin sesión.
2. Las rutas del panel (`/`, `/ventas`, `/productos`, `/pedidos`, etc.) siguen requiriendo autenticación.
3. La raíz `/` debe redirigir a `/pedido` cuando no hay sesión activa.
4. `/login` debe redirigir a `/` cuando ya hay sesión activa.
5. El header público no debe mostrar un botón prominente de "Ingresar"; el acceso al panel debe ser discreto.

## Implementación detallada

### Backend
- <ref_file file="C:/developer/paginas/pancheria/src/lib/route-guard.ts" />
  - Centralizar la lógica de rutas públicas y redirecciones en un helper puro y testeable.
  - `isPublicPath` debe reconocer `/pedido`, `/login`, prefijos `/api/public`, recursos estáticos (`/_next`, `/favicon.ico`).
  - `getAuthRedirect` debe devolver `NextResponse.redirect(...)` para `/` → `/pedido` sin sesión, `/login` → `/` con sesión, y rutas protegidas → `/login` sin sesión.
- <ref_file file="C:/developer/paginas/pancheria/src/auth.config.ts" />
  - En el callback `authorized`, delegar la decisión en `getAuthRedirect`.
  - Retornar `redirect ?? true` para permitir o redirigir.
- <ref_file file="C:/developer/paginas/pancheria/src/proxy.ts" />
  - Ajustar `matcher` para excluir `/pedido` y evitar ejecutar el proxy sobre una ruta pública.

### Frontend
- <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/layout.tsx" />
  - Quitar el botón de "Ingresar" del header.
  - Agregar un footer con un enlace discreto "Acceso para el personal" hacia `/login`.
- <ref_file file="C:/developer/paginas/pancheria/src/app/(auth)/login/login-form.tsx" />
  - Agregar un enlace "Pedir sin iniciar sesión" que lleve a `/pedido`.
- <ref_file file="C:/developer/paginas/pancheria/src/app/(auth)/login/page.tsx" />
  - Verificar la sesión con `auth()`; si existe, redirigir a `/`.

### Tests
- <ref_file file="C:/developer/paginas/pancheria/src/lib/route-guard.test.ts" />
  - Cubrir casos de rutas públicas, redirección de `/` a `/pedido`, redirección de `/login` a `/` con sesión, y redirección de rutas protegidas a `/login`.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales ni URLs de API. El número de WhatsApp debe provenir de `NEXT_PUBLIC_WHATSAPP_NUMBER`.
- El rate limiting de pedidos públicos es por IP en memoria. Si el negocio usa WiFi compartida o se despliega en múltiples instancias de Vercel, considerar `DbRateLimitStore` o una estrategia alternativa.
- `DEFAULT_BRANCH_NAME` debe estar configurado para que `getDefaultBranchId` resuelva la sucursal por defecto.
- Ejecutar tests E2E solo en una base de datos de prueba, ya que truncan tablas de negocio.
- `.env.local` no debe commitearse.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm run build` | Build de producción |
| `npm test` | Tests unitarios |
| `npm start` + requests manuales | Verificar que `/pedido` sea 200, `/` redirija a `/pedido`, `/ventas` redirija a `/login` y `/api/pedidos` sin sesión retorne 401. |
