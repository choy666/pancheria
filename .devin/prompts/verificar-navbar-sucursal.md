# Prompt: Corroborar y corregir que la navbar muestre el nombre actual de la sucursal

> **Estado: resuelto.** El layout del panel ahora consulta el nombre actual de la sucursal desde la base de datos y lo pasa al header, por lo que la navbar refleja el valor actual sin requerir un nuevo inicio de sesión. Se conserva como referencia histórica.

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos y cierre de caja.

Stack:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Drizzle ORM con PostgreSQL (Neon)
- NextAuth v5 (sesión JWT)
- Patrón de arquitectura: repositorios + servicios de aplicación + dominio

Documentación de referencia:

- <file:///C%3A/developer/paginas/pancheria/AGENTS.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/prompts/README.md>
- <file:///C%3A/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md>

## Estado actual relevante

La navbar del panel está implementada en <ref_file file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" /> y se instancia en el layout del panel: <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/layout.tsx" />.

<ref_snippet file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" lines="11-16" />
<ref_snippet file="C:/developer/paginas/pancheria/src/components/panel/panel-header.tsx" lines="69-76" />
<ref_snippet file="C:/developer/paginas/pancheria/src/app/(panel)/layout.tsx" lines="23-35" />

El layout recibe `branchName` desde `session.user.branchName`. El flujo de sesión se configura en <ref_file file="C:/developer/paginas/pancheria/src/auth.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/auth.config.ts" />, y el nombre de la sucursal se incluye en el token al iniciar sesión:

<ref_snippet file="C:/developer/paginas/pancheria/src/auth.ts" lines="31-37" />
<ref_snippet file="C:/developer/paginas/pancheria/src/auth.config.ts" lines="25-47" />
<ref_snippet file="C:/developer/paginas/pancheria/src/application/services/authService.ts" lines="86-93" />

## Problema a corroborar

Si un administrador edita el nombre de una sucursal en `/sucursales` y guarda los cambios, el nombre almacenado en la sesión JWT (`session.user.branchName`) no se actualiza automáticamente. Como consecuencia, la navbar puede seguir mostrando el nombre anterior hasta que el usuario cierre sesión y vuelva a ingresar.

## Objetivo

Corroborar el comportamiento actual y, de ser necesario, corregirlo para que la navbar muestre siempre el nombre **actual** de la sucursal asignada al usuario logueado, sin requerir un nuevo inicio de sesión después de editar el nombre de la sucursal.

## Reglas de negocio

1. El nombre mostrado en la navbar debe coincidir con el valor actual en la tabla `branches` para el `branchId` del usuario logueado.
2. La corrección debe respetar el flujo de autenticación y autorización existente; no se deben exponer datos de otras sucursales.
3. No hardcodear nombres, IDs ni rutas.
4. No modificar la configuración de sesión (`NEXTAUTH_SECRET`, cookies, etc.) de forma insegura.
5. Mantener el patrón de arquitectura del proyecto: Server Components, Client Components, server actions y revalidaciones.
6. Si se elige refrescar la sesión, debe hacerse de forma controlada y documentar sus limitaciones.
7. La solución debe funcionar en desarrollo y en producción (Vercel).

## Implementación detallada

### Diagnóstico

1. Iniciar sesión con un usuario operador asignado a una sucursal.
2. Navegar a `/sucursales`, editar el nombre de esa sucursal y guardar.
3. Verificar si el nombre en la navbar se actualiza inmediatamente.
4. Inspeccionar el flujo de datos entre `auth.ts`, `auth.config.ts`, `src/app/(panel)/layout.tsx` y `PanelHeader`.

### Opciones de corrección

Elegir una estrategia y documentar la decisión, el impacto y las limitaciones:

#### Opción A: Cargar el nombre desde la base de datos en `PanelLayout` (recomendada si se prioriza consistencia)

- En <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/layout.tsx" />, además de obtener `session.user.branchId`, consultar la tabla `branches` (por ejemplo, con `branchService.getBranchById(session.user.branchId)`) y pasar `branchName` actualizado a `PanelHeader`.
- Ventaja: siempre refleja el valor actual de la base de datos.
- Desventaja: agrega una query en cada render del panel.

#### Opción B: Actualizar la sesión JWT tras editar una sucursal

- En la server action de edición (`/sucursales/actions.ts`), tras actualizar la sucursal, refrescar la sesión del usuario.
- En NextAuth v5 esto puede requerir `auth()` y `unstable_update` u otra estrategia documentada.
- Documentar que solo actualizará la sesión del usuario que realiza la edición; otros usuarios de la misma sucursal seguirán viendo el nombre anterior hasta que su token se renueve.

#### Opción C: Refrescar el nombre en el cliente

- En `PanelHeader` o en un hook, obtener el nombre actual desde una API o server action al montar o al detectar un cambio.
- Ventaja: dinámico.
- Desventaja: posible parpadeo y más complejidad en cliente.

### Tests

- Si se modifica `branchService` o `PanelLayout`, agregar o actualizar tests unitarios.
- Considerar un test que simule la edición del nombre de la sucursal y verifique que el layout pasa el nombre actualizado a `PanelHeader`.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de API ni nombres de sucursal.
- `.env.local` no debe commitearse.
- Si se prueba en producción, asegurarse de no modificar datos reales.
- Si se implementa una nueva server action o endpoint, protegerla con `requireAuth()` o `requireAdmin()` según corresponda.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Verificar tipos |
| `npm run lint` | Detectar errores de estilo |
| `npm test` | Ejecutar tests unitarios |
| `npm run build` | Verificar build de producción |
| `npm run dev` | Validar manualmente: iniciar sesión, editar el nombre de una sucursal en `/sucursales` y corroborar que la navbar muestra el nuevo nombre sin refrescar la página ni reiniciar sesión |

## Preguntas a resolver antes de implementar

1. ¿Se prefiere consistencia inmediata a costa de una query extra por render (Opción A), o se prefiere mantener el `branchName` en la sesión y refrescarla puntualmente (Opción B)?
2. Si se elige la Opción B, ¿cómo se refrescará la sesión en NextAuth v5 y con qué alcance (solo el usuario actual o todos los usuarios de la sucursal)?
3. ¿Se requiere algún estado de carga o fallback mientras se obtiene el nombre actualizado?
