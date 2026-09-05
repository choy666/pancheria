/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DashboardClient } from './dashboard-client';
import { useDashboard } from '@/hooks/useDashboard';
import type { UseDashboardResult } from '@/hooks/useDashboard';
import type { OrderStatus } from '@/domain/types';

jest.mock('next/link', () => ({
  __esModule: true,
  default: function Link({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
}));

jest.mock('@/hooks/useDashboard', () => ({
  useDashboard: jest.fn(),
}));

jest.mock('@/lib/date', () => ({
  safeFormatDuration: jest.fn(() => '12h 30m'),
}));

const mockedUseDashboard = useDashboard as jest.MockedFunction<typeof useDashboard>;
type DashboardData = NonNullable<UseDashboardResult['data']>;

const actionTestIds = [
  'dashboard-action-ventas',
  'dashboard-action-productos',
  'dashboard-action-stock',
  'dashboard-action-caja',
  'dashboard-action-pedidos',
  'dashboard-action-sucursales',
  'dashboard-action-usuarios',
  'dashboard-action-videos',
  'dashboard-action-catalogo',
  'dashboard-action-perfil',
];

const adminOnlyTestIds = [
  'dashboard-action-productos',
  'dashboard-action-sucursales',
  'dashboard-action-usuarios',
  'dashboard-action-videos',
];

function makeOrderCounts(overrides: Partial<Record<OrderStatus, number>> = {}): Record<OrderStatus, number> {
  return {
    pending: 1,
    in_process: 2,
    paid: 3,
    finished: 4,
    cancelled: 5,
    ...overrides,
  };
}

function makeDashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    cashRegister: {
      id: 1,
      status: 'open' as const,
      openedAt: new Date().toISOString(),
      total: 123_400,
      cashTotal: 50_000,
      transferTotal: 73_400,
      totalSales: 12,
    } as unknown as DashboardData['cashRegister'],
    lowStockCount: 0,
    orderCounts: makeOrderCounts(),
    ...overrides,
  } as unknown as DashboardData;
}

describe('DashboardClient', () => {
  const refresh = jest.fn();

  beforeEach(() => {
    refresh.mockClear();
    mockedUseDashboard.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refresh,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('muestra el esqueleto de carga inicial', () => {
    const { container } = render(<DashboardClient branchName="Test" role="admin" />);

    expect(screen.queryByTestId('dashboard-caja-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-refresh')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  test('muestra el encabezado con sucursal y usuario', () => {
    mockedUseDashboard.mockReturnValue({
      data: makeDashboardData(),
      loading: false,
      error: null,
      refresh,
    });

    render(<DashboardClient branchName="Sucursal Norte" role="admin" userName="Juan" />);

    expect(screen.getByText(/Panel de control/)).toBeInTheDocument();
    const header = screen.getByText(/Resumen operativo de/);
    expect(header).toHaveTextContent(/Resumen operativo de\s+Sucursal Norte/);
    expect(header).toHaveTextContent(/Sesión iniciada como\s+Juan/);
  });

  test('muestra un mensaje de error cuando el hook reporta fallo', () => {
    mockedUseDashboard.mockReturnValue({
      data: null,
      loading: false,
      error: 'No se pudo cargar el panel',
      refresh,
    });

    render(<DashboardClient branchName="Test" role="admin" />);

    expect(screen.getByText('No se pudo cargar el panel')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-caja-card')).not.toBeInTheDocument();
  });

  test('muestra las tarjetas principales con data-testid', () => {
    mockedUseDashboard.mockReturnValue({
      data: makeDashboardData(),
      loading: false,
      error: null,
      refresh,
    });

    render(<DashboardClient branchName="Test" role="admin" />);

    expect(screen.getByTestId('dashboard-caja-card')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-pedidos-card')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-stock-card')).toBeInTheDocument();
  });

  describe('tarjeta de caja', () => {
    test('renderiza el estado cerrado con la acción de abrir', () => {
      mockedUseDashboard.mockReturnValue({
        data: makeDashboardData({
          cashRegister: { status: 'closed' as const } as unknown as DashboardData['cashRegister'],
        }),
        loading: false,
        error: null,
        refresh,
      });

      render(<DashboardClient branchName="Test" role="admin" />);

      const cajaCard = screen.getByTestId('dashboard-caja-card');
      expect(within(cajaCard).getByText('Cerrada')).toBeInTheDocument();
      expect(
        within(cajaCard).getByText(
          'No hay una caja abierta. Abrí una caja para comenzar a vender.'
        )
      ).toBeInTheDocument();
      expect(within(cajaCard).getByRole('button', { name: 'Abrir caja' })).toBeInTheDocument();
    });

    test('renderiza el estado abierto con totales y cierre automático', () => {
      mockedUseDashboard.mockReturnValue({
        data: makeDashboardData(),
        loading: false,
        error: null,
        refresh,
      });

      render(<DashboardClient branchName="Test" role="admin" />);

      const cajaCard = screen.getByTestId('dashboard-caja-card');
      expect(within(cajaCard).getByText('Abierta')).toBeInTheDocument();
      expect(within(cajaCard).getByText(/Cierre automático en:/)).toBeInTheDocument();
      expect(within(cajaCard).getByText('12h 30m')).toBeInTheDocument();
      expect(within(cajaCard).getByText(/Efectivo:/)).toBeInTheDocument();
      expect(within(cajaCard).getByText(/Transferencia:/)).toBeInTheDocument();
      expect(within(cajaCard).getByText(/Ventas:/)).toBeInTheDocument();
      expect(within(cajaCard).getByRole('button', { name: 'Ver caja' })).toBeInTheDocument();
    });
  });

  describe('tarjeta de pedidos', () => {
    test('muestra el conteo de cada estado', () => {
      mockedUseDashboard.mockReturnValue({
        data: makeDashboardData({
          orderCounts: makeOrderCounts({ pending: 7, in_process: 0 }),
        }),
        loading: false,
        error: null,
        refresh,
      });

      render(<DashboardClient branchName="Test" role="admin" />);

      const pedidosCard = screen.getByTestId('dashboard-pedidos-card');
      expect(within(pedidosCard).getByText('7')).toBeInTheDocument();
      expect(within(pedidosCard).getByText('Pendiente')).toBeInTheDocument();
      expect(within(pedidosCard).getByText('En proceso')).toBeInTheDocument();
      expect(within(pedidosCard).getByText('Pagado')).toBeInTheDocument();
      expect(within(pedidosCard).getByText('Finalizado')).toBeInTheDocument();
      expect(within(pedidosCard).getByText('Cancelado')).toBeInTheDocument();
    });
  });

  describe('tarjeta de stock', () => {
    test('muestra alerta cuando hay stock bajo', () => {
      mockedUseDashboard.mockReturnValue({
        data: makeDashboardData({ lowStockCount: 3 }),
        loading: false,
        error: null,
        refresh,
      });

      render(<DashboardClient branchName="Test" role="admin" />);

      const stockCard = screen.getByTestId('dashboard-stock-card');
      expect(within(stockCard).getByText(/insumo\(s\) con stock bajo/)).toBeInTheDocument();
    });

    test('muestra mensaje positivo cuando no hay alertas', () => {
      mockedUseDashboard.mockReturnValue({
        data: makeDashboardData({ lowStockCount: 0 }),
        loading: false,
        error: null,
        refresh,
      });

      render(<DashboardClient branchName="Test" role="admin" />);

      const stockCard = screen.getByTestId('dashboard-stock-card');
      expect(within(stockCard).getByText('No hay alertas de stock bajo.')).toBeInTheDocument();
    });
  });

  describe('accesos rápidos según rol', () => {
    test('el admin ve todas las acciones', () => {
      mockedUseDashboard.mockReturnValue({
        data: makeDashboardData(),
        loading: false,
        error: null,
        refresh,
      });

      render(<DashboardClient branchName="Test" role="admin" />);

      for (const testId of actionTestIds) {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      }
    });

    test('el operador no ve las acciones exclusivas de admin', () => {
      mockedUseDashboard.mockReturnValue({
        data: makeDashboardData(),
        loading: false,
        error: null,
        refresh,
      });

      render(<DashboardClient branchName="Test" role="operator" />);

      for (const testId of adminOnlyTestIds) {
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      }

      expect(screen.getByTestId('dashboard-action-ventas')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-action-stock')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-action-caja')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-action-pedidos')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-action-catalogo')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-action-perfil')).toBeInTheDocument();
    });
  });

  test('el botón de actualizar invoca refresh', () => {
    mockedUseDashboard.mockReturnValue({
      data: makeDashboardData(),
      loading: false,
      error: null,
      refresh,
    });

    render(<DashboardClient branchName="Test" role="admin" />);

    const refreshButton = screen.getByTestId('dashboard-refresh');
    fireEvent.click(refreshButton);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('deshabilita el botón de actualizar mientras está cargando', () => {
    mockedUseDashboard.mockReturnValue({
      data: makeDashboardData(),
      loading: true,
      error: null,
      refresh,
    });

    render(<DashboardClient branchName="Test" role="admin" />);

    expect(screen.getByTestId('dashboard-refresh')).toBeDisabled();
  });
});
