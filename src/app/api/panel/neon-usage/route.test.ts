/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as neonUsageService from '@/application/services/neonUsageService';
import { requireAdmin, getCurrentBranchId } from '@/lib/auth';
import { UnauthorizedError } from '@/domain/errors';

jest.mock('@/application/services/neonUsageService');
jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn(),
  getCurrentBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockedService = neonUsageService as jest.Mocked<typeof neonUsageService>;
const mockedRequireAdmin = requireAdmin as jest.MockedFunction<
  typeof requireAdmin
>;
const mockedGetCurrentBranchId = getCurrentBranchId as jest.MockedFunction<
  typeof getCurrentBranchId
>;

const BRANCH_ID = 3;

function buildRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/panel/neon-usage');
}

describe('GET /api/panel/neon-usage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = {
      user: { name: 'admin', role: 'admin', branchId: BRANCH_ID },
    } as Awaited<ReturnType<typeof requireAdmin>>;
    mockedRequireAdmin.mockResolvedValue(session);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
  });

  test('devuelve 401 cuando no hay sesión admin', async () => {
    mockedRequireAdmin.mockRejectedValue(
      new UnauthorizedError('Se requiere iniciar sesión.')
    );

    const response = await GET(buildRequest(), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(401);
  });

  test('devuelve configured:false cuando faltan las variables de Neon', async () => {
    mockedService.getNeonUsage.mockResolvedValue({ configured: false });

    const response = await GET(buildRequest(), {
      params: Promise.resolve({}),
    });
    const body = (await response.json()) as { configured: boolean };

    expect(response.status).toBe(200);
    expect(body.configured).toBe(false);
  });

  test('devuelve el consumo cuando el servicio responde', async () => {
    mockedService.getNeonUsage.mockResolvedValue({
      configured: true,
      projectName: 'pancheria-db-2',
      usedCuHours: 12.5,
      quotaCuHours: 100,
      remainingCuHours: 87.5,
      usedPercent: 12.5,
      computeSeconds: 180000,
      activeSeconds: 400000,
      cuSize: 0.25,
      periodStart: '2026-10-01T00:00:00Z',
      periodEnd: '2026-11-01T00:00:00Z',
    });

    const response = await GET(buildRequest(), {
      params: Promise.resolve({}),
    });
    const body = (await response.json()) as {
      configured: boolean;
      usedCuHours: number;
      remainingCuHours: number;
    };

    expect(response.status).toBe(200);
    expect(body.configured).toBe(true);
    expect(body.usedCuHours).toBe(12.5);
    expect(body.remainingCuHours).toBe(87.5);
  });
});
