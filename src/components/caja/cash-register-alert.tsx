import { AlertCircle } from 'lucide-react';
import type { CashRegisterAlert } from '@/domain/types';
import { formatDateTime } from '@/lib/date';

function resolveText(
  alerta: CashRegisterAlert,
  openedAt: Date | string
): {
  titulo: string;
  mensaje: string;
} {
  // `formatDateTime` devuelve "dd/mm/aaaa hh:mm" en la timezone de sucursal.
  const [fechaApertura, horaApertura] = formatDateTime(openedAt).split(' ');
  const diaMesApertura = fechaApertura.slice(0, 5);

  switch (alerta.code) {
    case 'fuera_de_horario':
      return {
        titulo: 'Fuera de horario de atención',
        mensaje:
          'La caja sigue abierta fuera del horario configurado para la sucursal. Podés seguir operando con normalidad.',
      };
    case 'cierre_recomendado':
      return {
        titulo: 'Se recomienda cerrar esta caja',
        mensaje: `Esta caja está abierta desde el ${fechaApertura} a las ${horaApertura}. Cerrala antes de abrir una nueva.`,
      };
    case 'dia_anterior':
      return {
        titulo: `Caja abierta desde el ${diaMesApertura}`,
        mensaje: `Se abrió el ${fechaApertura} a las ${horaApertura} y sigue abierta. Cerrala antes de abrir una nueva.`,
      };
    case 'excedida': {
      const horas = alerta.detalle?.horasUmbral;
      return {
        titulo: horas
          ? `Caja abierta hace más de ${horas} horas`
          : 'Caja abierta hace mucho tiempo',
        mensaje: `Se abrió el ${fechaApertura} a las ${horaApertura}. Recomendamos cerrarla y abrir una nueva.`,
      };
    }
  }
}

interface CashRegisterAlertBannerProps {
  alerta: CashRegisterAlert | null | undefined;
  /** Momento de apertura de la caja; se menciona en el texto del aviso. */
  openedAt: Date | string;
  /**
   * `compact` renderiza una sola línea (dashboard / resumen); por defecto
   * muestra título + mensaje (panel y estado de caja).
   */
  compact?: boolean;
}

/**
 * Banner unificado de avisos de caja. Renderiza el `CashRegisterAlert`
 * calculado en el servidor (única fuente de verdad): ningún aviso bloquea
 * operaciones, todos son informativos o de recomendación.
 */
export function CashRegisterAlertBanner({
  alerta,
  openedAt,
  compact = false,
}: CashRegisterAlertBannerProps) {
  if (!alerta) return null;

  const { titulo, mensaje } = resolveText(alerta, openedAt);
  const isWarning = alerta.severity === 'warning';
  const palette = isWarning
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
    : 'border-sky-500/30 bg-sky-500/10 text-sky-700';

  if (compact) {
    return (
      <div
        data-testid="cash-register-alert"
        data-code={alerta.code}
        role={isWarning ? 'alert' : 'status'}
        className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${palette}`}
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {titulo}. {mensaje}
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="cash-register-alert"
      data-code={alerta.code}
      role={isWarning ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-lg border p-4 text-base ${palette}`}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-medium">{titulo}</p>
        <p className="text-sm">{mensaje}</p>
      </div>
    </div>
  );
}
