# Prompt: Auditoría y corrección del rate limit de pedidos públicos (429)

## Contexto

En la panchería, al intentar crear el segundo pedido desde el catálogo público, el usuario recibe el mensaje **"Demasiados pedidos. Intentalo más tarde."** y la consola del navegador muestra:

```
/api/public/pedido?branchId=1:1  Failed to load resource: the server responded with a status of 429 ()
/api/public/pedido?branchId=1:1  Failed to load resource: the server responded with a status of 429 ()
```

Aparecen también advertencias del navegador:

```
MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 close listeners added. Use emitter.setMaxListeners() to increase limit
ObjectMultiplex - orphaned data for stream "app-init-liveness"
ObjectMultiplex - orphaned data for stream "background-liveness"
Loading the script 'https://vercel.live/_next-live/feedback/feedback.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com https://va.vercel-scripts.com".
```

Esas advertencias **no son la causa del 429**; provienen de una extensión del navegador (`contentscript.js`) y del Vercel Toolbar / Vercel Live. El problema está en el rate limiting del endpoint `POST /api/public/pedido`.

## Archivos relevantes

- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/public-order-rate-limit-store.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/config/orders.ts" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />

## Objetivo

1. Determinar por qué un segundo pedido (u otros pocos intentos) devuelve `429` en desarrollo local.
2. Corregir el comportamiento sin comprometer la protección en producción.
3. Mejorar la resolución de IP para ambientes Vercel, proxy propio y desarrollo local.
4. Dejar documentadas las variables de entorno involucradas.

## Reproducción esperada

1. Levantar el servidor con `npm run dev` (asegurarse de que `.env.local` esté cargado y `NODE_ENV=development`).
2. Enviar 12 POST consecutivos al endpoint con un cuerpo inválido (para forzar la ruta de rate limit sin escribir en la base):

   ```powershell
   for ($i = 1; $i -le 12; $i++) {
     curl -s -o nul -w "$i %{http_code}\n" `
       -X POST "http://localhost:3000/api/public/pedido?branchId=1" `
       -H "Content-Type: application/json" `
       -d '{}'
   }
   ```

3. Se espera que las primeras 10 devuelvan `400` y las solicitudes 11 y 12 devuelvan `429`.
4. Agregar logs temporales en `getClientIp` para confirmar que la IP resuelta es `::1` (loopback) en local.

## Causa raíz esperada

- `NextRequest.ip` fue removido en Next.js 15/16. Leer `(request as any).ip` es código muerto y devuelve `undefined`.
- En desarrollo local, `x-forwarded-for` contiene `::1` (IPv6 de loopback).
- `.env.local` creado por Vercel CLI incluye `VERCEL=1`, por lo que `getClientIp` busca primero `x-vercel-forwarded-for`; al no estar presente en local, cae a `x-forwarded-for` y devuelve `::1`.
- `createPublicOrderRateLimitStore()` (con `NODE_ENV=development` y sin provider explícito) devuelve `InMemoryPublicOrderRateLimitStore`, que comparte la clave `::1` para toda la sesión del servidor.
- El límite por defecto (`PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=10`, `PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS=60000`) se agota después de 10 POST en menos de 60 segundos, aunque sean inválidos. El segundo pedido real del usuario puede ser la solicitud número 11 y por eso recibe `429`.
- Las advertencias de `contentscript.js` y el CSP de Vercel Live son ruido externo y no afectan el rate limit.

## Solución propuesta

### 1. Corregir `getClientIp` en `src/lib/rate-limit.ts`

- Eliminar el bloque que lee `request.ip` (Next.js 16 lo quitó).
- Mantener el orden: Vercel header (`x-vercel-forwarded-for`) primero si `VERCEL` está definido.
- Luego el header confiable configurado por `TRUSTED_PROXY_IP_HEADER`.
- En desarrollo, mantener el fallback a `x-forwarded-for`.
- En producción, **no** usar `x-forwarded-for` genérico salvo que venga del proxy confiable configurado, para evitar falsificaciones.

Ejemplo de estructura resultante:

```ts
export function getClientIp(request: NextRequest): string {
  // En Vercel, el header x-vercel-forwarded-for es confiable.
  if (process.env.VERCEL) {
    const vercelForwarded = getFirstHeaderValue(
      request.headers.get('x-vercel-forwarded-for')
    );
    if (vercelForwarded) return vercelForwarded;
  }

  // Permitir configurar un header de proxy confiable explícito.
  const trustedHeader = process.env.TRUSTED_PROXY_IP_HEADER;
  if (trustedHeader) {
    const trustedValue = getFirstHeaderValue(
      request.headers.get(trustedHeader.toLowerCase())
    );
    if (trustedValue) return trustedValue;
  }

  // En desarrollo local sin proxy, usar X-Forwarded-For como fallback.
  if (process.env.NODE_ENV === 'development') {
    const forwarded = getFirstHeaderValue(request.headers.get('x-forwarded-for'));
    if (forwarded) return forwarded;
  }

  return 'unknown';
}
```

### 2. Deshabilitar rate limit en desarrollo por defecto

En `createRateLimiter` (`src/lib/rate-limit.ts`), agregar una salida temprana para desarrollo, salvo que el usuario active explícitamente el rate limit con una variable de entorno:

```ts
export function createRateLimiter(
  _scope: string,
  windowMs: number,
  maxRequests: number
) {
  const store = createPublicOrderRateLimitStore();

  return async function isRateLimited(ip: string): Promise<boolean> {
    // Tests E2E ya se saltan el rate limit salvo que E2E_ENABLE_RATE_LIMIT=true.
    if (
      process.env.NODE_ENV === 'test' &&
      process.env.E2E_ENABLE_RATE_LIMIT !== 'true'
    ) {
      return false;
    }

    // En desarrollo se desactiva por defecto para evitar bloqueos por IP compartida (loopback).
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV !== 'true'
    ) {
      return false;
    }

    return store.recordRequest(ip, windowMs, maxRequests);
  };
}
```

**Nota:** también es válida la alternativa `PUBLIC_ORDER_RATE_LIMIT_DISABLE_IN_DEV=true` para desactivar manteniendo activo por defecto. Elegir la más coherente con las convenciones actuales del proyecto y documentarla.

### 3. Mover el rate limit después de la validación del cuerpo (opcional, recomendado)

Actualmente `isRateLimited` se ejecuta **antes** de `orderSchema.parse(body)`. Esto hace que pedidos inválidos (por ejemplo, datos incompletos o productos inexistentes) cuenten para el límite. Considerar moverlo justo antes de `orderService.createOrder(...)`, después de parsear el body y resolver la sucursal. Esto mantiene la protección contra abuso de la base de datos sin penalizar errores de validación.

### 4. Actualizar `.env.example`

Documentar la nueva variable y reforzar la descripción del rate limit:

```bash
# Rate limiting para la creación pública de pedidos y del chat (opcionales).
# En producción con DATABASE_URL/POSTGRES_URL definidas, el proveedor por defecto
# es `db` (compartido en PostgreSQL); en desarrollo/test y sin base de datos
# disponible, `memory`. Forzar `memory` desactiva el store compartido.
# En desarrollo el rate limit se desactiva por defecto para evitar falsos
# positivos con la IP compartida de loopback. Activar con:
# PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV=true
# PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=memory
# PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS=60000
# PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=10
```

### 5. Ajustar tests

- Si se desactiva el rate limit en desarrollo, los tests unitarios actuales (`route.test.ts`) deben seguir pasando porque ya se ejecutan con `NODE_ENV=test`.
- Si se mueve el rate limit después del parseo, considerar agregar un test que verifique que un request con body inválido devuelve `400` y **no** incrementa el contador.
- El test E2E `tests/e2e/rate-limit-pedidos.spec.ts` está skipeado. Si se lo reactiva, asegurarse de que usa `E2E_ENABLE_RATE_LIMIT=true` y `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV=true` (si aplica) o la variable equivalente.

## Verificación

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm test`
4. Levantar `npm run dev` y repetir la reproducción: las 12 solicitudes deben devolver `400` (no 429) con `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV` sin definir.
5. Con `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV=true`, el comportamiento 10/429 debe seguir funcionando.
6. Si se movió el rate limit después de la validación, probar que un POST con body inválido no consume el límite.

## Reglas y consideraciones

- Seguir `AGENTS.md`: español, no hardcodear credenciales, no modificar `.env.local` del usuario.
- No eliminar el rate limit en producción; solo ajustar el comportamiento en desarrollo y la resolución de IP.
- No introducir `@vercel/functions` a menos que se decida como mejora futura y se agregue al `package.json` con cuidado de versiones.
- Las advertencias de `contentscript.js` y del CSP de Vercel Live no requieren cambios de código, salvo que el usuario decida ajustar la política CSP para permitir `vercel.live` (fuera del alcance de este prompt).
