/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { CashRegisterAlertBanner } from './cash-register-alert';
import type { CashRegisterAlert } from '@/domain/types';

// 13:30 UTC del 10/06/2025 = 10:30 del mismo día en
// America/Argentina/Buenos_Aires (timezone de sucursal por defecto).
const OPENED_AT = '2025-06-10T13:30:00.000Z';
const FECHA_APERTURA = '10/06/2025';
const DIA_MES_APERTURA = '10/06';
const HORA_APERTURA = '10:30';

function renderBanner(alerta: CashRegisterAlert | null, compact = false) {
  return render(
    <CashRegisterAlertBanner
      alerta={alerta}
      openedAt={OPENED_AT}
      compact={compact}
    />
  );
}

describe('CashRegisterAlertBanner', () => {
  test('no renderiza nada cuando no hay aviso', () => {
    const { container } = renderBanner(null);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('cash-register-alert')).not.toBeInTheDocument();
  });

  test('fuera_de_horario mantiene su texto y usa role status', () => {
    renderBanner({ code: 'fuera_de_horario', severity: 'info' });

    const banner = screen.getByTestId('cash-register-alert');
    expect(banner).toHaveAttribute('data-code', 'fuera_de_horario');
    expect(banner).toHaveAttribute('role', 'status');
    expect(
      screen.getByText('Fuera de horario de atención')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/fuera del horario configurado/)
    ).toBeInTheDocument();
  });

  test('cierre_recomendado menciona la fecha y hora de apertura', () => {
    renderBanner({
      code: 'cierre_recomendado',
      severity: 'warning',
      detalle: { aperturaEnTurno: true },
    });

    const banner = screen.getByTestId('cash-register-alert');
    expect(banner).toHaveAttribute('data-code', 'cierre_recomendado');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(
      screen.getByText('Se recomienda cerrar esta caja')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Esta caja está abierta desde el ${FECHA_APERTURA} a las ${HORA_APERTURA}. Cerrala antes de abrir una nueva.`
      )
    ).toBeInTheDocument();
  });

  test('cierre_recomendado muestra el mismo texto aunque la apertura haya sido fuera de turno', () => {
    renderBanner({
      code: 'cierre_recomendado',
      severity: 'warning',
      detalle: { aperturaEnTurno: false },
    });

    expect(
      screen.getByText(
        `Esta caja está abierta desde el ${FECHA_APERTURA} a las ${HORA_APERTURA}. Cerrala antes de abrir una nueva.`
      )
    ).toBeInTheDocument();
  });

  test('dia_anterior titula con el día de apertura y detalla fecha y hora', () => {
    renderBanner({
      code: 'dia_anterior',
      severity: 'warning',
      detalle: { diasAbierta: 11 },
    });

    expect(
      screen.getByText(`Caja abierta desde el ${DIA_MES_APERTURA}`)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Se abrió el ${FECHA_APERTURA} a las ${HORA_APERTURA} y sigue abierta. Cerrala antes de abrir una nueva.`
      )
    ).toBeInTheDocument();
  });

  test('excedida conserva el umbral en el título y agrega la apertura', () => {
    renderBanner({
      code: 'excedida',
      severity: 'warning',
      detalle: { horasUmbral: 12 },
    });

    expect(
      screen.getByText('Caja abierta hace más de 12 horas')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Se abrió el ${FECHA_APERTURA} a las ${HORA_APERTURA}. Recomendamos cerrarla y abrir una nueva.`
      )
    ).toBeInTheDocument();
  });

  test('excedida sin umbral usa el título genérico', () => {
    renderBanner({ code: 'excedida', severity: 'warning' });

    expect(
      screen.getByText('Caja abierta hace mucho tiempo')
    ).toBeInTheDocument();
  });

  test('modo compact muestra una sola línea "Título. Mensaje"', () => {
    renderBanner(
      {
        code: 'dia_anterior',
        severity: 'warning',
        detalle: { diasAbierta: 2 },
      },
      true
    );

    const banner = screen.getByTestId('cash-register-alert');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveTextContent(
      `Caja abierta desde el ${DIA_MES_APERTURA}. Se abrió el ${FECHA_APERTURA} a las ${HORA_APERTURA} y sigue abierta. Cerrala antes de abrir una nueva.`
    );
  });

  test('modo compact respeta el role status de los avisos info', () => {
    renderBanner({ code: 'fuera_de_horario', severity: 'info' }, true);

    const banner = screen.getByTestId('cash-register-alert');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveTextContent('Fuera de horario de atención.');
  });
});
