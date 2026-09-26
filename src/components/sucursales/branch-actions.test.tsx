/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BranchActions } from './branch-actions';

const mockDeleteBranchAction = jest.fn();
const mockGetSummary = jest.fn();

jest.mock('@/app/(panel)/sucursales/actions', () => ({
  deleteBranchAction: (...args: unknown[]) => mockDeleteBranchAction(...args),
  getBranchDeletionSummaryAction: (...args: unknown[]) =>
    mockGetSummary(...args),
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
    total: 16,
  },
};

describe('BranchActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('muestra el resumen de impacto y exige el nombre exacto para habilitar el borrado', async () => {
    mockGetSummary.mockResolvedValue(SUMMARY);

    render(
      <BranchActions branchId={1} branchName="Centro" onEdit={jest.fn()} />
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
      <BranchActions branchId={1} branchName="Centro" onEdit={jest.fn()} />
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
      <BranchActions branchId={1} branchName="Centro" onEdit={jest.fn()} />
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
});
