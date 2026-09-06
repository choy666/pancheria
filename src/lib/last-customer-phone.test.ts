/**
 * @jest-environment jsdom
 */
import {
  getLastCustomerPhone,
  setLastCustomerPhone,
} from './last-customer-phone';

const STORAGE_KEY = 'pancheria-last-customer-phone';

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

describe('last-customer-phone', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('devuelve null cuando no hay un teléfono guardado', () => {
    expect(getLastCustomerPhone()).toBeNull();
  });

  test('guarda y recupera el teléfono del cliente', () => {
    setLastCustomerPhone('1122334455');

    expect(getLastCustomerPhone()).toBe('1122334455');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1122334455');
  });

  test('recorta los espacios y elimina los espacios intermedios', () => {
    setLastCustomerPhone('  +54 9 11 5555 1234  ');

    expect(getLastCustomerPhone()).toBe('+5491155551234');
  });

  test('elimina también tabulaciones y saltos de línea', () => {
    setLastCustomerPhone('11\t2222\n3333');

    expect(getLastCustomerPhone()).toBe('1122223333');
  });

  test('elimina la clave si el teléfono queda vacío', () => {
    setLastCustomerPhone('1122334455');
    setLastCustomerPhone('');

    expect(getLastCustomerPhone()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test('elimina la clave si el teléfono son solo espacios', () => {
    setLastCustomerPhone('1122334455');
    setLastCustomerPhone('   ');

    expect(getLastCustomerPhone()).toBeNull();
  });

  test('no falla cuando localStorage no está disponible (SSR)', () => {
    sinLocalStorage(() => {
      expect(getLastCustomerPhone()).toBeNull();
      expect(() => setLastCustomerPhone('1122334455')).not.toThrow();
      expect(() => setLastCustomerPhone('')).not.toThrow();
    });
  });
});
