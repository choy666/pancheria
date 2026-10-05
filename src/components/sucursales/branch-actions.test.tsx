/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BranchActions } from './branch-actions';

const mockDeleteBranchAction = jest.fn();
const mockGetSummary = jest.fn();
const mockSetBranchActiveAction = jest.fn();
const mockGetDeactivationSummary = jest.fn();

jest.mock('@/app/(panel)/sucursales/actions', () => ({
  deleteBranchAction: (...args: unknown[]) => mockDeleteBranchAction(...args),
  getBranchDeletionSummaryAction: (...args: unknown[]) =>
    mockGetSummary(...args),
  setBranchActiveAction: (...args: unknown[]) =>
    mockSetBranchActiveAction(...args),
  getBranchDeactivationSummaryAction: (...args: unknown[]) =>
    mockGetDeactivationSummary(...args),
}));

const SUMMARY = {
  branch: { id: 1, name: 'Centro' },
  counts: {
    products: 2,
    sales: 5,
    cashRegisters: 1,
    stockMovements: 3,
    users: 1,
    recipes: 0,
    orders: 4,
    videos: 0,
    cascaded: 0,
    total: 16,
  },
  flags: {
    isDefaultBranch: false,
    isSelfBranch: false,
    isLastBranch: false,
    hasOpenCashRegister: false,
    activeOrders: 0,
  },
};

const RISKY_SUMMARY = {
  branch: { id: 1, name: 'Centro' },
  counts: {
    products: 2,
    sales: 5,
    cashRegisters: 1,
    stockMovements: 3,
    users: 1,
    recipes: 0,
    orders: 4,
    videos: 0,
    cascaded: 9,
    total: 25,
  },
  flags: {
    isDefaultBranch: true,
    isSelfBranch: true,
    isLastBranch: true,
    hasOpenCashRegister: true,
    activeOrders: 2,
  },
};

describe('BranchActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('muestra el resumen de impacto y exige el nombre exacto para habilitar el borrado', async () => {
    mockGetSummary.mockResolvedValue(SUMMARY);

    render(
      <BranchActions branchId={1} branchName="Centro" branchIsActive />
    );

    fireEvent.click(screen.getByTestId('delete-branch-1'));

    expect(
      await screen.findByText(/Total de registros afectados:/)
    ).toBeInTheDocument();
    expect(screen.getByText('Ventas: 5')).toBeInTheDocument();

    const submit = screen.getByRole('button', {
      name: 'Eliminar definitivamente',
    });
    expect(submit).toBeDisabled();

    fireEvent.change(
      screen.getByPlaceholderText('Escribí "Centro" para confirmar'),
      { target: { value: 'Centro' } }
    );
    expect(submit).not.toBeDisabled();
  });

  test('si falla la consulta no fabrica un resumen en cero y no permite confirmar', async () => {
    mockGetSummary.mockRejectedValue(new Error('fallo de red'));

    render(
      <BranchActions branchId={1} branchName="Centro" branchIsActive />
    );

    fireEvent.click(screen.getByTestId('delete-branch-1'));

    expect(
      await screen.findByText(/No se pudo cargar el resumen/)
    ).toBeInTheDocument();

    // Regresión H-M5: el diálogo no debe mostrar un falso "0 registros".
    expect(
      screen.queryByText(/Total de registros afectados:/)
    ).toBeNull();
    expect(screen.queryByText('No hay registros asociados.')).toBeNull();
    expect(screen.queryByPlaceholderText(/para confirmar/)).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Eliminar definitivamente' })
    ).toBeNull();
  });

  test('Reintentar vuelve a consultar el resumen y habilita el flujo', async () => {
    mockGetSummary
      .mockRejectedValueOnce(new Error('fallo de red'))
      .mockResolvedValue(SUMMARY);

    render(
      <BranchActions branchId={1} branchName="Centro" branchIsActive />
    );

    fireEvent.click(screen.getByTestId('delete-branch-1'));
    await screen.findByText(/No se pudo cargar el resumen/);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Reintentar' })
    );

    expect(
      await screen.findByText(/Total de registros afectados:/)
    ).toBeInTheDocument();
    expect(mockGetSummary).toHaveBeenCalledTimes(2);
    expect(
      screen.getByPlaceholderText('Escribí "Centro" para confirmar')
    ).toBeInTheDocument();
  });

  test('muestra los banners de riesgo y el detalle de registros en cascada', async () => {
    mockGetSummary.mockResolvedValue(RISKY_SUMMARY);

    render(
      <BranchActions branchId={1} branchName="Centro" branchIsActive />
    );

    fireEvent.click(screen.getByTestId('delete-branch-1'));

    expect(
      await screen.findByTestId('branch-delete-warning-last')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('branch-delete-warning-self')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('branch-delete-warning-default')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('branch-delete-warning-open-register')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('branch-delete-warning-active-orders')
    ).toHaveTextContent('2 pedidos en curso');
    // H-m12: el total incluye los registros hijos en cascada y lo explicita.
    expect(
      screen.getByText(/Incluye 9 registros asociados en cascada/)
    ).toBeInTheDocument();
    // Solo advierte: la confirmación sigue siendo el nombre exacto.
    expect(
      screen.getByRole('button', { name: 'Eliminar definitivamente' })
    ).toBeDisabled();
  });

  test('no muestra banners cuando no hay flags activos', async () => {
    mockGetSummary.mockResolvedValue(SUMMARY);

    render(
      <BranchActions branchId={1} branchName="Centro" branchIsActive />
    );

    fireEvent.click(screen.getByTestId('delete-branch-1'));
    await screen.findByText(/Total de registros afectados:/);

    expect(screen.queryByTestId('branch-delete-warning-last')).toBeNull();
    expect(screen.queryByTestId('branch-delete-warning-self')).toBeNull();
    expect(screen.queryByTestId('branch-delete-warning-default')).toBeNull();
    expect(
      screen.queryByTestId('branch-delete-warning-open-register')
    ).toBeNull();
    expect(
      screen.queryByTestId('branch-delete-warning-active-orders')
    ).toBeNull();
  });

  // Regresión H-m10: reabrir el diálogo no debe conservar el nombre
  // escrito ni dejar el submit pre-habilitado.
  test('al cerrar y reabrir el diálogo el nombre de confirmación se resetea', async () => {
    mockGetSummary.mockResolvedValue(SUMMARY);

    render(
      <BranchActions branchId={1} branchName="Centro" branchIsActive />
    );

    fireEvent.click(screen.getByTestId('delete-branch-1'));
    await screen.findByText(/Total de registros afectados:/);

    fireEvent.change(
      screen.getByPlaceholderText('Escribí "Centro" para confirmar'),
      { target: { value: 'Centro' } }
    );
    expect(
      screen.getByRole('button', { name: 'Eliminar definitivamente' })
    ).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText('Escribí "Centro" para confirmar')
      ).toBeNull()
    );

    fireEvent.click(screen.getByTestId('delete-branch-1'));
    await screen.findByText(/Total de registros afectados:/);

    const input = screen.getByPlaceholderText(
      'Escribí "Centro" para confirmar'
    );
    expect(input).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Eliminar definitivamente' })
    ).toBeDisabled();
  });

  describe('activar/desactivar', () => {
    const DEACTIVATION_SUMMARY = {
      branch: { id: 1, name: 'Centro', isActive: true },
      openCashRegisters: 1,
      activeOrders: 2,
      flags: {
        isDefaultBranch: true,
        isSelfBranch: true,
        isLastActiveBranch: false,
      },
    };

    test('desactivar muestra los warnings y confirma sin pedir el nombre', async () => {
      mockGetDeactivationSummary.mockResolvedValue(DEACTIVATION_SUMMARY);

      render(
        <BranchActions branchId={1} branchName="Centro" branchIsActive />
      );

      fireEvent.click(screen.getByTestId('toggle-branch-1'));

      expect(
        await screen.findByText(/Deja de aparecer en el canal público/)
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('branch-toggle-warning-default')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('branch-toggle-warning-open-register')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('branch-toggle-warning-active-orders')
      ).toHaveTextContent('2 pedidos en curso');

      // No destructivo: la confirmación no exige tipear el nombre.
      const submit = screen.getByRole('button', { name: 'Desactivar' });
      expect(submit).not.toBeDisabled();
      fireEvent.click(submit);
      await waitFor(() =>
        expect(mockSetBranchActiveAction).toHaveBeenCalled()
      );
    });

    test('si falla el resumen de desactivación no habilita el submit', async () => {
      mockGetDeactivationSummary.mockRejectedValue(new Error('fallo'));

      render(
        <BranchActions branchId={1} branchName="Centro" branchIsActive />
      );

      fireEvent.click(screen.getByTestId('toggle-branch-1'));

      expect(
        await screen.findByText(/No se pudo cargar el resumen de efectos/)
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Desactivar' })
      ).toBeNull();
    });

    test('activar no consulta el resumen y confirma directo', async () => {
      render(
        <BranchActions
          branchId={1}
          branchName="Centro"
          branchIsActive={false}
        />
      );

      fireEvent.click(screen.getByTestId('toggle-branch-1'));

      expect(
        await screen.findByText(/Vas a activar/)
      ).toBeInTheDocument();
      expect(mockGetDeactivationSummary).not.toHaveBeenCalled();

      const submit = screen.getByRole('button', { name: 'Activar' });
      expect(submit).not.toBeDisabled();
      fireEvent.click(submit);
      await waitFor(() =>
        expect(mockSetBranchActiveAction).toHaveBeenCalled()
      );
    });
  });
});
