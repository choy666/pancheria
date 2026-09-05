/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as branchService from '@/application/services/branchService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import {
  isBranchOpen,
  getTodayOpening,
  getNextOpening,
} from '@/lib/branch-helpers';
import { NotFoundError } from '@/domain/errors';

jest.mock('@/application/services/branchService');
jest.mock('@/application/services/cashRegisterService');
jest.mock('@/lib/branch-helpers', () => ({
  isBranchOpen: jest.fn(),
  getTodayOpening: jest.fn(),
  getNextOpening: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logError: jest.fn(),
}));

const mockedBranchService = branchService as jest.Mocked<typeof branchService>;
const mockedCashRegisterService = cashRegisterService as jest.Mocked<
  typeof cashRegisterService
>;
const mockedIsBranchOpen = isBranchOpen as jest.MockedFunction<typeof isBranchOpen>;
const mockedGetTodayOpening = getTodayOpening as jest.MockedFunction<
  typeof getTodayOpening
>;
const mockedGetNextOpening = getNextOpening as jest.MockedFunction<
  typeof getNextOpening
>;

const BRANCH_ID = 1;

function buildRequest(query = ''): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/public/sucursal/estado${
      query ? `?${query}` : ''
    }`
  );
}

const BRANCH = {
  id: BRANCH_ID,
  name: 'Sucursal Test',
  openingHours: [],
  address: 'Calle 123',
  phone: '3415555555',
  location: 'Rosario',
};

describe('GET /api/public/sucursal/estado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBranchService.getBranchById.mockResolvedValue(BRANCH as any);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue({
      id: 1,
    } as any);
    mockedIsBranchOpen.mockReturnValue(true);
    mockedGetTodayOpening.mockReturnValue('12:00 a 23:00');
    mockedGetNextOpening.mockReturnValue('Mañana 12:00 a 23:00');
  });

  test('devuelve el estado de una sucursal abierta', async () => {
    const response = await GET(buildRequest(`branchId=${BRANCH_ID}`));
    const body = (await response.json()) as {
      isOpen: boolean;
      branch: { id: number; name: string };
    };

    expect(response.status).toBe(200);
    expect(body.isOpen).toBe(true);
    expect(body.branch).toMatchObject({
      id: BRANCH_ID,
      name: 'Sucursal Test',
    });
    expect(mockedBranchService.getBranchById).toHaveBeenCalledWith(BRANCH_ID);
    expect(mockedCashRegisterService.getOpenCashRegister).toHaveBeenCalledWith(
      BRANCH_ID
    );
  });

  test('devuelve el estado de una sucursal cerrada', async () => {
    mockedIsBranchOpen.mockReturnValue(false);

    const response = await GET(buildRequest(`branchId=${BRANCH_ID}`));
    const body = (await response.json()) as { isOpen: boolean };

    expect(response.status).toBe(200);
    expect(body.isOpen).toBe(false);
  });

  test('devuelve 400 cuando el branchId es inválido', async () => {
    const response = await GET(buildRequest('branchId=abc'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain('Invalid input');
  });

  test('devuelve 404 cuando la sucursal no existe', async () => {
    mockedBranchService.getBranchById.mockResolvedValue(undefined);

    const response = await GET(buildRequest(`branchId=${BRANCH_ID}`));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Sucursal no encontrada.');
  });

  test('devuelve 404 cuando getBranchById lanza NotFoundError', async () => {
    mockedBranchService.getBranchById.mockRejectedValue(
      new NotFoundError('Sucursal', 999)
    );

    const response = await GET(buildRequest('branchId=999'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toContain('Sucursal');
  });
});
