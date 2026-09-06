/**
 * @jest-environment jsdom
 */
import {
  getLastCustomerName,
  setLastCustomerName,
} from './last-customer-name';

const STORAGE_KEY = 'pancheria-last-customer-name';

/**
 * Simula un entorno sin localStorage (por ejemplo SSR, donde `window` no
 * existe o el storage no está disponible) forzando la rama de fallback
 * interna del módulo. En jsdom `window` no se puede eliminar, pero
 * `window.localStorage` es redefinible y produce el mismo camino de código.
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

describe('last-customer-name', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('devuelve null cuando no hay un nombre guardado', () => {
    expect(getLastCustomerName()).toBeNull();
  });

  test('guarda y recupera el nombre del cliente', () => {
    setLastCustomerName('Juan Pérez');

    expect(getLastCustomerName()).toBe('Juan Pérez');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('Juan Pérez');
  });

  test('recorta los espacios al guardar', () => {
    setLastCustomerName('  Ana María  ');

    expect(getLastCustomerName()).toBe('Ana María');
  });

  test('elimina la clave si el nombre queda vacío', () => {
    setLastCustomerName('Carlos');
    setLastCustomerName('');

    expect(getLastCustomerName()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test('elimina la clave si el nombre son solo espacios', () => {
    setLastCustomerName('Carlos');
    setLastCustomerName('   ');

    expect(getLastCustomerName()).toBeNull();
  });

  test('no falla cuando localStorage no está disponible (SSR)', () => {
    sinLocalStorage(() => {
      expect(getLastCustomerName()).toBeNull();
      expect(() => setLastCustomerName('Juan')).not.toThrow();
      expect(() => setLastCustomerName('')).not.toThrow();
    });
  });
});
