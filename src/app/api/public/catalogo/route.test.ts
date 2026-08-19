/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as catalogService from '@/application/services/catalogService';
import { getDefaultBranchId } from '@/lib/branch-resolver';
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

function buildRequest(path = ''): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/public/catalogo${path ? `?${path}` : ''}`
  );
}

describe('GET /api/public/catalogo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDefaultBranchId.mockResolvedValue(BRANCH_ID);
    mockedCatalogService.listPublicCatalogWithAvailability.mockResolvedValue({
      branch: { id: BRANCH_ID, name: 'Sucursal Test', createdAt: new Date() },
      products: [
        {
          id: 1,
          name: 'Panchuque',
          description: null,
          type: 'compound',
          criticalSupplyType: null,
          price: 1200,
          unit: 'unidad',
          availability: 5,
          breakdown: [],
        },
      ],
    });
  });

  test('devuelve la sucursal y el catálogo con disponibilidad', async () => {
    const response = await GET(buildRequest('includeAvailability=true'));
    const body = (await response.json()) as {
      branch: { id: number; name: string };
      products: unknown[];
    };

    expect(response.status).toBe(200);
    expect(body.branch).toMatchObject({
      id: BRANCH_ID,
      name: 'Sucursal Test',
    });
    expect(body.products).toHaveLength(1);
    expect(body.products[0]).toMatchObject({ id: 1, name: 'Panchuque' });
  });

  test('usa el branchId del query param cuando está presente', async () => {
    await GET(buildRequest('branchId=2&includeAvailability=true'));

    expect(mockedGetDefaultBranchId).not.toHaveBeenCalled();
    expect(mockedCatalogService.listPublicCatalogWithAvailability).toHaveBeenCalledWith(
      2
    );
  });

  test('usa la sucursal por defecto si no hay branchId', async () => {
    await GET(buildRequest('includeAvailability=true'));

    expect(mockedGetDefaultBranchId).toHaveBeenCalled();
    expect(mockedCatalogService.listPublicCatalogWithAvailability).toHaveBeenCalledWith(
      BRANCH_ID
    );
  });

  test('devuelve 404 si la sucursal no existe', async () => {
    mockedCatalogService.listPublicCatalog.mockRejectedValue(
      new NotFoundError('Sucursal', 999)
    );

    const response = await GET(buildRequest('branchId=999'));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toContain('Sucursal');
  });

  test('devuelve 400 si no se puede resolver la sucursal por defecto', async () => {
    mockedGetDefaultBranchId.mockResolvedValue(null);

    const response = await GET(buildRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain('sucursal activa');
    expect(mockedCatalogService.listPublicCatalog).not.toHaveBeenCalled();
    expect(
      mockedCatalogService.listPublicCatalogWithAvailability
    ).not.toHaveBeenCalled();
  });
});
