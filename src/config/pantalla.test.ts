import {
  getPantallaProductoMs,
  getPantallaQrMs,
  getPantallaRefetchIntervalMs,
  getPantallaSucursalMs,
  getPantallaVideoMaxMs,
  getPantallaMaxProductos,
} from './pantalla';

describe('pantalla config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('getPantallaProductoMs usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_PANTALLA_PRODUCTO_MS;
    expect(getPantallaProductoMs()).toBe(6000);
  });

  test('getPantallaProductoMs respeta el valor configurado', () => {
    process.env.NEXT_PUBLIC_PANTALLA_PRODUCTO_MS = '4500';
    expect(getPantallaProductoMs()).toBe(4500);
  });

  test('getPantallaProductoMs aplica un mínimo de 1000 ms', () => {
    process.env.NEXT_PUBLIC_PANTALLA_PRODUCTO_MS = '200';
    expect(getPantallaProductoMs()).toBe(6000);
  });

  test('getPantallaSucursalMs usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_PANTALLA_SUCURSAL_MS;
    expect(getPantallaSucursalMs()).toBe(8000);
  });

  test('getPantallaQrMs usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_PANTALLA_QR_MS;
    expect(getPantallaQrMs()).toBe(12000);
  });

  test('getPantallaRefetchIntervalMs usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_PANTALLA_REFETCH_INTERVAL_MS;
    expect(getPantallaRefetchIntervalMs()).toBe(120000);
  });

  test('getPantallaRefetchIntervalMs aplica un mínimo de 10000 ms', () => {
    process.env.NEXT_PUBLIC_PANTALLA_REFETCH_INTERVAL_MS = '5000';
    expect(getPantallaRefetchIntervalMs()).toBe(120000);
  });

  test('getPantallaVideoMaxMs usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_PANTALLA_VIDEO_MAX_MS;
    expect(getPantallaVideoMaxMs()).toBe(120000);
  });

  test('getPantallaVideoMaxMs respeta el valor configurado', () => {
    process.env.NEXT_PUBLIC_PANTALLA_VIDEO_MAX_MS = '30000';
    expect(getPantallaVideoMaxMs()).toBe(30000);
  });

  test('getPantallaMaxProductos usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_PANTALLA_MAX_PRODUCTOS;
    expect(getPantallaMaxProductos()).toBe(15);
  });

  test('getPantallaMaxProductos respeta el valor configurado', () => {
    process.env.NEXT_PUBLIC_PANTALLA_MAX_PRODUCTOS = '7';
    expect(getPantallaMaxProductos()).toBe(7);
  });

  test('getPantallaMaxProductos vuelve al default ante valores inválidos', () => {
    process.env.NEXT_PUBLIC_PANTALLA_MAX_PRODUCTOS = '0';
    expect(getPantallaMaxProductos()).toBe(15);
    process.env.NEXT_PUBLIC_PANTALLA_MAX_PRODUCTOS = 'abc';
    expect(getPantallaMaxProductos()).toBe(15);
  });
});
