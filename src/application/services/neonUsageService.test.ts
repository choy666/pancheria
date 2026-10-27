import { getNeonUsage } from './neonUsageService';

function neonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('getNeonUsage', () => {
  const originalEnv = { ...process.env };
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.NEON_API_KEY = 'napi_test';
    process.env.NEON_PROJECT_ID = 'proj-123';
    delete process.env.NEON_COMPUTE_QUOTA_CU_HOURS;
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fetchSpy.mockRestore();
  });

  test('devuelve configured:false sin llamar a la API si faltan las variables', async () => {
    delete process.env.NEON_API_KEY;
    delete process.env.NEON_PROJECT_ID;

    await expect(getNeonUsage()).resolves.toEqual({ configured: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test.each([401, 403, 404])(
    'degrada a configError cuando la API responde %i (key sin acceso o proyecto eliminado)',
    async (status) => {
      fetchSpy.mockResolvedValue(neonResponse(status));

      await expect(getNeonUsage()).resolves.toEqual({
        configured: false,
        configError: 'invalid_credentials',
      });
    }
  );

  test('lanza error ante un 5xx de la API', async () => {
    fetchSpy.mockResolvedValue(neonResponse(500));

    await expect(getNeonUsage()).rejects.toThrow(
      'La API de Neon respondió 500'
    );
  });

  test('calcula las CU-horas con el tamaño del endpoint read_write', async () => {
    fetchSpy.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/endpoints')) {
        return neonResponse(200, {
          endpoints: [
            { type: 'read_write', autoscaling_limit_min_cu: 0.5 },
          ],
        });
      }
      return neonResponse(200, {
        project: {
          name: 'pancheria-db',
          compute_time_seconds: 7200,
          active_time_seconds: 9000,
          consumption_period_start: '2026-10-01T00:00:00Z',
          consumption_period_end: '2026-11-01T00:00:00Z',
        },
      });
    });

    const usage = await getNeonUsage();

    expect(usage).toMatchObject({
      configured: true,
      projectName: 'pancheria-db',
      // 7200 s * 0.5 CU / 3600 = 1 CU-h
      usedCuHours: 1,
      quotaCuHours: 100,
      remainingCuHours: 99,
      computeSeconds: 7200,
      cuSize: 0.5,
      periodEnd: '2026-11-01T00:00:00Z',
    });
  });
});
