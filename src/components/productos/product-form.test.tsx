/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductForm } from './product-form';

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockFetch = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock('@/lib/fetch', () => ({
  authenticatedFetch: (...args: unknown[]) => mockFetch(...args),
}));

describe('ProductForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });
  });

  test('renderiza el campo de unidad editable con valor por defecto', () => {
    render(<ProductForm />);

    const unitInput = screen.getByLabelText('Unidad') as HTMLInputElement;
    expect(unitInput).toBeInTheDocument();
    expect(unitInput.value).toBe('unidad');
  });

  test('mantiene la unidad del producto al editar', () => {
    render(
      <ProductForm
        product={{
          id: 1,
          name: 'Gaseosa',
          description: null,
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
          price: 500,
          unit: 'botella',
          stock: 20,
          minStock: 5,
          isActive: true,
        }}
      />
    );

    const unitInput = screen.getByLabelText('Unidad') as HTMLInputElement;
    expect(unitInput.value).toBe('botella');
  });

  test('permite editar la unidad y la envía al guardar', async () => {
    render(<ProductForm />);

    const nameInput = screen.getByLabelText('Nombre');
    fireEvent.change(nameInput, { target: { value: 'Aderezo especial' } });

    const unitInput = screen.getByLabelText('Unidad') as HTMLInputElement;
    fireEvent.change(unitInput, { target: { value: 'porción' } });
    expect(unitInput.value).toBe('porción');

    const submitButton = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/productos',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"unit":"porción"'),
        })
      );
    });
  });
});
