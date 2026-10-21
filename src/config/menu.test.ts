import { getMenuPaginaMs, getMenuFilasPagina } from './menu';

describe('menu config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('getMenuPaginaMs usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_MENU_PAGINA_MS;
    expect(getMenuPaginaMs()).toBe(12000);
  });

  test('getMenuPaginaMs respeta el valor configurado', () => {
    process.env.NEXT_PUBLIC_MENU_PAGINA_MS = '8000';
    expect(getMenuPaginaMs()).toBe(8000);
  });

  test('getMenuPaginaMs aplica un mínimo de 1000 ms', () => {
    process.env.NEXT_PUBLIC_MENU_PAGINA_MS = '200';
    expect(getMenuPaginaMs()).toBe(12000);
  });

  test('getMenuFilasPagina usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_MENU_FILAS_PAGINA;
    expect(getMenuFilasPagina()).toBe(4);
  });

  test('getMenuFilasPagina respeta el valor configurado', () => {
    process.env.NEXT_PUBLIC_MENU_FILAS_PAGINA = '6';
    expect(getMenuFilasPagina()).toBe(6);
  });

  test('getMenuFilasPagina vuelve al default ante valores inválidos', () => {
    process.env.NEXT_PUBLIC_MENU_FILAS_PAGINA = '0';
    expect(getMenuFilasPagina()).toBe(4);
    process.env.NEXT_PUBLIC_MENU_FILAS_PAGINA = 'abc';
    expect(getMenuFilasPagina()).toBe(4);
  });
});
