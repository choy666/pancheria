import {
  lockCashRegisterById,
  lockOpenCashRegister,
} from '@/repositories/cashRegisterRepository';
import {
  isCashRegisterOverdue,
  isCashRegisterFromPreviousDay,
  getCashRegisterShiftStatus,
  resolveCashRegisterAlert,
  resolveDisplayedCashRegisterAlert,
} from './cash-register-helpers';
import type { BranchOpeningHours } from '@/domain/types';

const TZ = 'America/Argentina/Buenos_Aires';

// Turnos del lunes (dayOfWeek 1): 11:00-14:00 y 19:00-23:00.
const DOS_TURNOS_LUNES: BranchOpeningHours[] = [
  { dayOfWeek: 1, open: '11:00', close: '14:00' },
  { dayOfWeek: 1, open: '19:00', close: '23:00' },
];


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

  describe('isCashRegisterOverdue', () => {
    it('devuelve false si la caja lleva menos de 12 horas abierta', () => {
      const openedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(isCashRegisterOverdue(openedAt)).toBe(false);
    });

    it('devuelve true si la caja lleva 12 horas o más abierta', () => {
      const openedAt = new Date(Date.now() - 12 * 60 * 60 * 1000);
      expect(isCashRegisterOverdue(openedAt)).toBe(true);
    });
  });

  describe('isCashRegisterFromPreviousDay', () => {
    it('devuelve true si la caja fue abierta el día anterior', () => {
      const openedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(isCashRegisterFromPreviousDay(openedAt, 'America/Argentina/Buenos_Aires')).toBe(true);
    });

    it('devuelve false si la caja fue abierta hoy', () => {
      const openedAt = new Date();
      expect(isCashRegisterFromPreviousDay(openedAt, 'America/Argentina/Buenos_Aires')).toBe(false);
    });
  });

  describe('getCashRegisterShiftStatus', () => {
    it('en_turno: la caja sigue dentro del turno en que se abrió', () => {
      const openedAt = new Date('2025-06-02T12:00:00-03:00'); // Lunes 12:00
      const now = new Date('2025-06-02T13:00:00-03:00');

      const info = getCashRegisterShiftStatus(openedAt, DOS_TURNOS_LUNES, now, TZ);

      expect(info.status).toBe('en_turno');
      expect(info.aperturaEnTurno).toBe(true);
      expect(info.currentShift?.open).toBe('11:00');
    });

    it('fuera_de_horario: el turno terminó y aún no empezó el siguiente', () => {
      const openedAt = new Date('2025-06-02T12:00:00-03:00');
      const now = new Date('2025-06-02T17:00:00-03:00'); // Lunes 17:00, hueco

      const info = getCashRegisterShiftStatus(openedAt, DOS_TURNOS_LUNES, now, TZ);

      expect(info.status).toBe('fuera_de_horario');
      expect(info.aperturaEnTurno).toBe(true);
      expect(info.nextShiftStart?.toISOString()).toBe('2025-06-02T22:00:00.000Z');
    });

    it('recomendar_cierre: ya comenzó el turno posterior a la apertura', () => {
      const openedAt = new Date('2025-06-02T12:00:00-03:00');
      const now = new Date('2025-06-02T19:30:00-03:00'); // Lunes 19:30

      const info = getCashRegisterShiftStatus(openedAt, DOS_TURNOS_LUNES, now, TZ);

      expect(info.status).toBe('recomendar_cierre');
      expect(info.aperturaEnTurno).toBe(true);
      expect(info.currentShift?.open).toBe('19:00');
    });

    it('apertura en un hueco: aviso literal al primer turno posterior (D2)', () => {
      // Caja abierta 18:30 (hueco entre turnos): el aviso aparece a las 19:00,
      // no cuando el turno de las 19:00 termina.
      const openedAt = new Date('2025-06-02T18:30:00-03:00');
      const now = new Date('2025-06-02T19:30:00-03:00');

      const info = getCashRegisterShiftStatus(openedAt, DOS_TURNOS_LUNES, now, TZ);

      expect(info.status).toBe('recomendar_cierre');
      expect(info.aperturaEnTurno).toBe(false);
    });

    it('apertura en un hueco antes del próximo turno: fuera_de_horario', () => {
      const openedAt = new Date('2025-06-02T18:30:00-03:00');
      const now = new Date('2025-06-02T18:45:00-03:00');

      const info = getCashRegisterShiftStatus(openedAt, DOS_TURNOS_LUNES, now, TZ);

      expect(info.status).toBe('fuera_de_horario');
      expect(info.aperturaEnTurno).toBe(false);
    });

    it('turno overnight: la caja sigue en_turno pasada medianoche', () => {
      const hours: BranchOpeningHours[] = [
        { dayOfWeek: 1, open: '20:00', close: '02:00' },
      ];
      const openedAt = new Date('2025-06-02T21:00:00-03:00'); // Lunes 21:00
      const now = new Date('2025-06-03T01:00:00-03:00'); // Martes 01:00

      const info = getCashRegisterShiftStatus(openedAt, hours, now, TZ);

      expect(info.status).toBe('en_turno');
      expect(info.aperturaEnTurno).toBe(true);
    });

    it('turno overnight: fuera_de_horario cuando el turno ya cerró', () => {
      const hours: BranchOpeningHours[] = [
        { dayOfWeek: 1, open: '20:00', close: '02:00' },
      ];
      const openedAt = new Date('2025-06-02T21:00:00-03:00');
      const now = new Date('2025-06-03T03:00:00-03:00'); // Martes 03:00

      const info = getCashRegisterShiftStatus(openedAt, hours, now, TZ);

      expect(info.status).toBe('fuera_de_horario');
      // El próximo turno es el lunes siguiente.
      expect(info.nextShiftStart?.toISOString()).toBe('2025-06-09T23:00:00.000Z');
    });

    it('turno overnight: recomendar_cierre cuando llega el turno de la semana siguiente', () => {
      const hours: BranchOpeningHours[] = [
        { dayOfWeek: 1, open: '20:00', close: '02:00' },
      ];
      const openedAt = new Date('2025-06-02T21:00:00-03:00');
      const now = new Date('2025-06-09T21:00:00-03:00'); // Lunes siguiente 21:00

      const info = getCashRegisterShiftStatus(openedAt, hours, now, TZ);

      expect(info.status).toBe('recomendar_cierre');
    });

    it('caja abierta en un día sin turnos: avisa al primer turno posterior', () => {
      // Abierta un martes (sin turnos configurados): el aviso aparece cuando
      // comienza el turno del lunes siguiente.
      const openedAt = new Date('2025-06-03T12:00:00-03:00'); // Martes 12:00
      const now = new Date('2025-06-09T20:00:00-03:00'); // Lunes 20:00

      const info = getCashRegisterShiftStatus(openedAt, DOS_TURNOS_LUNES, now, TZ);

      expect(info.status).toBe('recomendar_cierre');
      expect(info.aperturaEnTurno).toBe(false);
    });

    it('sin_horarios: sucursal sin horarios configurados', () => {
      const info = getCashRegisterShiftStatus(new Date(), [], new Date(), TZ);

      expect(info.status).toBe('sin_horarios');
      expect(info.aperturaEnTurno).toBe(false);
      expect(info.currentShift).toBeNull();
      expect(info.nextShiftStart).toBeNull();
    });
  });

  describe('resolveCashRegisterAlert', () => {
    it('sin aviso cuando la caja está en_turno', () => {
      const alert = resolveCashRegisterAlert(
        '2025-06-02T12:00:00-03:00',
        DOS_TURNOS_LUNES,
        new Date('2025-06-02T13:00:00-03:00'),
        TZ
      );
      expect(alert).toBeNull();
    });

    it('aviso informativo fuera_de_horario con el próximo turno', () => {
      const alert = resolveCashRegisterAlert(
        '2025-06-02T12:00:00-03:00',
        DOS_TURNOS_LUNES,
        new Date('2025-06-02T17:00:00-03:00'),
        TZ
      );

      expect(alert).toEqual({
        code: 'fuera_de_horario',
        severity: 'info',
        detalle: { proximoTurno: '2025-06-02T22:00:00.000Z' },
      });
    });

    it('aviso warning cierre_recomendado al empezar el turno posterior', () => {
      const alert = resolveCashRegisterAlert(
        '2025-06-02T12:00:00-03:00',
        DOS_TURNOS_LUNES,
        new Date('2025-06-02T19:30:00-03:00'),
        TZ
      );

      expect(alert).toEqual({
        code: 'cierre_recomendado',
        severity: 'warning',
        detalle: { aperturaEnTurno: true },
      });
    });

    it('marca aperturaEnTurno=false cuando la caja se abrió en un hueco', () => {
      const alert = resolveCashRegisterAlert(
        '2025-06-02T18:30:00-03:00',
        DOS_TURNOS_LUNES,
        new Date('2025-06-02T19:30:00-03:00'),
        TZ
      );

      expect(alert).toEqual({
        code: 'cierre_recomendado',
        severity: 'warning',
        detalle: { aperturaEnTurno: false },
      });
    });

    it('fallback sin horarios: caja de un día civil anterior', () => {
      const alert = resolveCashRegisterAlert(
        '2025-06-01T20:00:00-03:00',
        [],
        new Date('2025-06-02T10:00:00-03:00'),
        TZ
      );
      expect(alert).toEqual({ code: 'dia_anterior', severity: 'warning' });
    });

    it('fallback sin horarios: caja excedida por umbral el mismo día', () => {
      const alert = resolveCashRegisterAlert(
        '2025-06-02T05:00:00-03:00',
        [],
        new Date('2025-06-02T20:00:00-03:00'),
        TZ
      );
      expect(alert).toEqual({
        code: 'excedida',
        severity: 'warning',
        detalle: { horasUmbral: 12 },
      });
    });

    it('fallback sin horarios: sin aviso dentro del umbral', () => {
      const alert = resolveCashRegisterAlert(
        '2025-06-02T19:00:00-03:00',
        [],
        new Date('2025-06-02T20:00:00-03:00'),
        TZ
      );
      expect(alert).toBeNull();
    });
  });

  describe('resolveDisplayedCashRegisterAlert', () => {
    it('respeta el aviso del servidor cuando viene calculado', () => {
      const server = { code: 'fuera_de_horario', severity: 'info' } as const;

      expect(
        resolveDisplayedCashRegisterAlert(
          server,
          '2025-06-01T20:00:00-03:00',
          new Date('2025-06-02T10:00:00-03:00'),
          TZ
        )
      ).toBe(server);
    });

    it('respeta el null del servidor (sin aviso) aunque el fallback marcaría otra cosa', () => {
      // Caja abierta el día anterior: el fallback legacy diría dia_anterior,
      // pero el servidor ya decidió que no hay aviso (p. ej. turno overnight).
      expect(
        resolveDisplayedCashRegisterAlert(
          null,
          '2025-06-01T20:00:00-03:00',
          new Date('2025-06-02T10:00:00-03:00'),
          TZ
        )
      ).toBeNull();
    });

    it('cae al fallback legacy solo cuando el payload no trae el campo', () => {
      const alert = resolveDisplayedCashRegisterAlert(
        undefined,
        '2025-06-01T20:00:00-03:00',
        new Date('2025-06-02T10:00:00-03:00'),
        TZ
      );
      expect(alert).toEqual({ code: 'dia_anterior', severity: 'warning' });
    });
  });
});
