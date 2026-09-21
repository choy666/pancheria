/**
 * @jest-environment jsdom
 */
import { getStoredBranchId, BRANCH_STORAGE_KEY } from './selected-branch';

/**
 * Mismo patrón que `last-customer-name.test.ts`: en jsdom `window` no se
 * puede eliminar, pero `window.localStorage` es redefinible y produce el
 * mismo camino de código que el SSR.
 */
function sinLocalStorage<T>(callback: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get: () => undefined,
  });
  try {
    return callback();
  } finally {
    if (descriptor) {
      Object.defineProperty(window, 'localStorage', descriptor);
    }
  }
}

describe('selected-branch', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('devuelve null cuando no hay sucursal guardada', () => {
    expect(getStoredBranchId()).toBeNull();
  });

  test('devuelve el id guardado por el catálogo público', () => {
    localStorage.setItem(BRANCH_STORAGE_KEY, '7');

    expect(getStoredBranchId()).toBe(7);
  });

  test.each(['abc', '0', '-3', ''])(
    'devuelve null con un valor inválido (%s)',
    (raw) => {
      localStorage.setItem(BRANCH_STORAGE_KEY, raw);

      expect(getStoredBranchId()).toBeNull();
    }
  );

  test('trunca decimales como parseInt ("2.5" → 2)', () => {
    localStorage.setItem(BRANCH_STORAGE_KEY, '2.5');

    expect(getStoredBranchId()).toBe(2);
  });

  test('devuelve null cuando localStorage no está disponible (SSR)', () => {
    sinLocalStorage(() => {
      expect(getStoredBranchId()).toBeNull();
    });
  });
});
