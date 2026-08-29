/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as catalogService from '@/application/services/catalogService';
import { getDefaultBranchId, DEFAULT_BRANCH_ERROR } from '@/lib/branch-resolver';
import { NotFoundError } from '@/domain/errors';

jest.mock('@/application/services/catalogService');
jest.mock('@/lib/branch-resolver', () => ({
  ...jest.requireActual('@/lib/branch-resolver'),
  getDefaultBranchId: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
}));

const mockedCatalogService = catalogService as jest.Mocked<typeof catalogService>;
const mockedGetDefaultBranchId = getDefaultBranchId as jest.MockedFunction<
  typeof getDefaultBranchId
>;

const BRANCH_ID = 1;

function buildRequest(
  path = '',
  init?: ConstructorParameters<typeof NextRequest>[1]
): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/public/disponibilidad${
      path ? `?${path}` : ''
    }`,
    init
  );
}

describe('POST /api/public/disponibilidad', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDefaultBranchId.mockResolvedValue(BRANCH_ID);
    mockedCatalogService.validatePublicCart.mockResolvedValue({
      availabilityByProduct: { 1: 5 },
      shortageByProduct: {},
      breakdownByProduct: {},
    });
  });

  test('devuelve la disponibilidad del carrito', async () => {
    const response = await POST(
      buildRequest(`branchId=${BRANCH_ID}`, {
        method: 'POST',
        body: JSON.stringify({
          items: [{ productId: 1, quantity: 2, selectedRecipeItemIds: [] }],
        }),
      })
    );
    const body = (await response.json()) as {
      availabilityByProduct: Record<number, number>;
      shortageByProduct: unknown;
      breakdownByProduct: unknown;
    };

    expect(response.status).toBe(200);
    expect(body.availabilityByProduct).toEqual({ 1: 5 });
    expect(mockedCatalogService.validatePublicCart).toHaveBeenCalledWith(
      BRANCH_ID,
      [{ productId: 1, quantity: 2, selectedRecipeItemIds: [] }]
    );
  });

  test('usa el branchId del query param cuando está presente', async () => {
    await POST(
      buildRequest('branchId=2', {
        method: 'POST',
        body: JSON.stringify({ items: [] }),
      })
    );

    expect(mockedGetDefaultBranchId).not.toHaveBeenCalled();
    expect(mockedCatalogService.validatePublicCart).toHaveBeenCalledWith(
      2,
      []
    );
  });

  test('usa la sucursal por defecto si no hay branchId', async () => {
    await POST(
      buildRequest('', {
        method: 'POST',
        body: JSON.stringify({ items: [] }),
      })
    );

    expect(mockedGetDefaultBranchId).toHaveBeenCalled();
    expect(mockedCatalogService.validatePublicCart).toHaveBeenCalledWith(
      BRANCH_ID,
      []
    );
  });

  test('devuelve 404 si la sucursal no existe', async () => {
    mockedCatalogService.validatePublicCart.mockRejectedValue(
      new NotFoundError('Sucursal', 999)
    );

    const response = await POST(
      buildRequest('branchId=999', {
        method: 'POST',
        body: JSON.stringify({ items: [] }),
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toContain('Sucursal');
  });

  test('devuelve 400 si no se puede resolver la sucursal por defecto', async () => {
    mockedGetDefaultBranchId.mockResolvedValue(null);

    const response = await POST(
      buildRequest('', {
        method: 'POST',
        body: JSON.stringify({ items: [] }),
      })
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe(DEFAULT_BRANCH_ERROR);
    expect(mockedCatalogService.validatePublicCart).not.toHaveBeenCalled();
  });
});
