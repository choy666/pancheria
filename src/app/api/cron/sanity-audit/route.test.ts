/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as sanityAuditService from '@/application/services/sanityAuditService';

jest.mock('@/application/services/sanityAuditService', () => ({
  runSanityAudit: jest.fn(),
}));

const mockedRunSanityAudit = sanityAuditService.runSanityAudit as jest.MockedFunction<
  typeof sanityAuditService.runSanityAudit
>;

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

beforeAll(() => {
  process.env.CRON_SECRET = 'secreto-cron';
});

afterAll(() => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

function buildRequest(authHeader?: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/sanity-audit', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

const REPORT: sanityAuditService.SanityAuditReport = {
  generatedAt: '2026-10-06T00:00:00.000Z',
  thresholds: {
    orderExpirationMs: 3_600_000,
    stalePendingMaxAgeHours: 24,
    cajaOverdueHours: 12,
    sampleLimit: 50,
  },
  findings: [],
  metrics: { openCashRegisters: [] },
};

describe('GET /api/cron/sanity-audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRunSanityAudit.mockResolvedValue(REPORT);
  });

  test('devuelve 401 si no hay encabezado de autorizacion', async () => {
    const response = await GET(buildRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('No autorizado.');
    expect(mockedRunSanityAudit).not.toHaveBeenCalled();
  });

  test('devuelve 401 si el token no coincide', async () => {
    const response = await GET(buildRequest('Bearer token-incorrecto'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('No autorizado.');
    expect(mockedRunSanityAudit).not.toHaveBeenCalled();
  });

  test('devuelve el reporte de auditoría', async () => {
    const response = await GET(buildRequest('Bearer secreto-cron'));
    const body = (await response.json()) as { ok: boolean } & typeof REPORT;

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, ...REPORT });
    expect(mockedRunSanityAudit).toHaveBeenCalledWith();
  });
});
