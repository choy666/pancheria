/**
 * Stub de `next/cache` para tests unitarios (ver `moduleNameMapper` en
 * `jest.config.ts`). Fuera del runtime de Next, `unstable_cache` y las
 * funciones de revalidación no tienen store de caché; este stub hace
 * passthrough para que la capa de `src/lib/server-cache.ts` y las actions
 * sean transparentes en Jest.
 */

export const unstable_cache = <T extends (...args: never[]) => Promise<unknown>>(
  fn: T
): T => fn;

export const revalidateTag = jest.fn();
export const revalidatePath = jest.fn();
export const updateTag = jest.fn();
export const refresh = jest.fn();
export const cacheTag = jest.fn();
export const cacheLife = jest.fn();
export const unstable_noStore = jest.fn();
export const unstable_cacheLife = jest.fn();
export const unstable_cacheTag = jest.fn();
