import {
  getAutoCloseHours,
  getAutoClosedBy,
  getCajaClockIntervalMs,
  getDefaultCajaHistoryDays,
  getCajaRefreshInterval,
} from './caja';

describe('caja config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('getAutoCloseHours usa el valor por defecto', () => {
    delete process.env.CAJA_AUTO_CLOSE_HOURS;
    delete process.env.NEXT_PUBLIC_CAJA_AUTO_CLOSE_HOURS;
    expect(getAutoCloseHours()).toBe(12);
  });

  test('getAutoCloseHours respeta la variable privada', () => {
    process.env.CAJA_AUTO_CLOSE_HOURS = '24';
    expect(getAutoCloseHours()).toBe(24);
  });

  test('getAutoCloseHours respeta la variable pública', () => {
    process.env.NEXT_PUBLIC_CAJA_AUTO_CLOSE_HOURS = '8';
    expect(getAutoCloseHours()).toBe(8);
  });

  test('getAutoCloseHours ignora valores inválidos', () => {
    process.env.CAJA_AUTO_CLOSE_HOURS = 'abc';
    expect(getAutoCloseHours()).toBe(12);
  });

  test('getAutoClosedBy usa el valor por defecto', () => {
    delete process.env.CAJA_AUTO_CLOSED_BY;
    expect(getAutoClosedBy()).toBe('Sistema');
  });

  test('getAutoClosedBy respeta la variable', () => {
    process.env.CAJA_AUTO_CLOSED_BY = 'Bot';
    expect(getAutoClosedBy()).toBe('Bot');
  });

  test('getCajaClockIntervalMs usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_CAJA_CLOCK_INTERVAL_MS;
    expect(getCajaClockIntervalMs()).toBe(60000);
  });

  test('getCajaClockIntervalMs respeta la variable', () => {
    process.env.NEXT_PUBLIC_CAJA_CLOCK_INTERVAL_MS = '30000';
    expect(getCajaClockIntervalMs()).toBe(30000);
  });

  test('getCajaClockIntervalMs ignora valores inválidos', () => {
    process.env.NEXT_PUBLIC_CAJA_CLOCK_INTERVAL_MS = 'abc';
    expect(getCajaClockIntervalMs()).toBe(60000);
  });

  test('getCajaClockIntervalMs ajusta al mínimo valores menores a 10 segundos', () => {
    process.env.NEXT_PUBLIC_CAJA_CLOCK_INTERVAL_MS = '5000';
    expect(getCajaClockIntervalMs()).toBe(10000);
  });

  test('getCajaClockIntervalMs ajusta al mínimo valores positivos muy bajos', () => {
    process.env.NEXT_PUBLIC_CAJA_CLOCK_INTERVAL_MS = '1';
    expect(getCajaClockIntervalMs()).toBe(10000);
  });

  test('getDefaultCajaHistoryDays usa el valor por defecto', () => {
    delete process.env.CAJA_DEFAULT_HISTORY_DAYS;
    delete process.env.NEXT_PUBLIC_CAJA_DEFAULT_HISTORY_DAYS;
    expect(getDefaultCajaHistoryDays()).toBe(30);
  });

  test('getDefaultCajaHistoryDays respeta la variable pública', () => {
    process.env.NEXT_PUBLIC_CAJA_DEFAULT_HISTORY_DAYS = '90';
    expect(getDefaultCajaHistoryDays()).toBe(90);
  });

  test('getDefaultCajaHistoryDays ignora valores inválidos', () => {
    process.env.CAJA_DEFAULT_HISTORY_DAYS = '-1';
    expect(getDefaultCajaHistoryDays()).toBe(30);
  });

  test('getCajaRefreshInterval usa el valor por defecto', () => {
    delete process.env.NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS;
    expect(getCajaRefreshInterval()).toBe(5000);
  });

  test('getCajaRefreshInterval respeta la variable', () => {
    process.env.NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS = '10000';
    expect(getCajaRefreshInterval()).toBe(10000);
  });

  test('getCajaRefreshInterval ignora valores inválidos', () => {
    process.env.NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS = '0';
    expect(getCajaRefreshInterval()).toBe(5000);
  });

  test('getCajaRefreshInterval ajusta al mínimo valores menores a 5 segundos', () => {
    process.env.NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS = '1000';
    expect(getCajaRefreshInterval()).toBe(5000);
  });

  test('getCajaRefreshInterval ajusta al mínimo valores positivos muy bajos', () => {
    process.env.NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS = '1';
    expect(getCajaRefreshInterval()).toBe(5000);
  });
});
