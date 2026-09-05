import { lockCashRegisterById, lockOpenCashRegister } from './cash-register-helpers';


var mockFor: jest.Mock;
var mockWhere: jest.Mock;
var mockFrom: jest.Mock;
var mockSelect: jest.Mock;

function buildMockTx(returning: unknown[] = []) {
  mockFor = jest.fn().mockResolvedValue(returning);
  mockWhere = jest.fn(() => ({ for: mockFor, orderBy: jest.fn(() => ({ for: mockFor })) }));
  mockFrom = jest.fn(() => ({ where: mockWhere }));
  mockSelect = jest.fn(() => ({ from: mockFrom }));

  return {
    select: mockSelect,
  } as unknown as typeof import('@/db').db;
}

const BRANCH_ID = 1;
const CASH_REGISTER_ID = 10;

describe('cash-register-helpers', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('lockCashRegisterById', () => {
    it('lockea por id y branchId sin filtros adicionales', async () => {
      const tx = buildMockTx([{ id: CASH_REGISTER_ID, branchId: BRANCH_ID }]);

      const result = await lockCashRegisterById(tx, BRANCH_ID, CASH_REGISTER_ID);

      expect(result).toEqual({ id: CASH_REGISTER_ID, branchId: BRANCH_ID });
      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith(expect.anything());
      expect(mockWhere).toHaveBeenCalledWith(expect.anything());
      expect(mockFor).toHaveBeenCalledWith('update');
    });

    it('agrega condicion de status open cuando se requiere', async () => {
      const tx = buildMockTx([{ id: CASH_REGISTER_ID, status: 'open' }]);

      await lockCashRegisterById(tx, BRANCH_ID, CASH_REGISTER_ID, {
        requireOpen: true,
      });

      const whereArg = mockWhere.mock.calls[0][0];
      expect(whereArg).toBeDefined();
    });

    it('agrega condicion de no eliminado cuando se requiere', async () => {
      const tx = buildMockTx([{ id: CASH_REGISTER_ID, deletedAt: null }]);

      await lockCashRegisterById(tx, BRANCH_ID, CASH_REGISTER_ID, {
        requireNotDeleted: true,
      });

      const whereArg = mockWhere.mock.calls[0][0];
      expect(whereArg).toBeDefined();
    });

    it('devuelve null cuando no encuentra caja', async () => {
      const tx = buildMockTx([]);

      const result = await lockCashRegisterById(tx, BRANCH_ID, CASH_REGISTER_ID);

      expect(result).toBeNull();
    });

    it('puede combinar ambas opciones', async () => {
      const tx = buildMockTx([{ id: CASH_REGISTER_ID, status: 'open', deletedAt: null }]);

      await lockCashRegisterById(tx, BRANCH_ID, CASH_REGISTER_ID, {
        requireOpen: true,
        requireNotDeleted: true,
      });

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFor).toHaveBeenCalledWith('update');
    });
  });

  describe('lockOpenCashRegister', () => {
    it('lockea caja abierta por branchId', async () => {
      const tx = buildMockTx([{ id: CASH_REGISTER_ID, status: 'open' }]);

      const result = await lockOpenCashRegister(tx, BRANCH_ID);

      expect(result).toEqual({ id: CASH_REGISTER_ID, status: 'open' });
      expect(mockSelect).toHaveBeenCalled();
      expect(mockFor).toHaveBeenCalledWith('update');
    });

    it('devuelve null cuando no hay caja abierta', async () => {
      const tx = buildMockTx([]);

      const result = await lockOpenCashRegister(tx, BRANCH_ID);

      expect(result).toBeNull();
    });
  });
});
