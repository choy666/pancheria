import { AlertCircle } from 'lucide-react';
import type { CashRegisterAlert } from '@/domain/types';

function resolveText(alerta: CashRegisterAlert): {
  titulo: string;
  mensaje: string;
} {
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
        mensaje:
          alerta.detalle?.aperturaEnTurno === false
            ? 'La caja fue abierta fuera del turno vigente. Cerrala antes de abrir una nueva.'
            : 'La caja quedó abierta desde un turno anterior. Cerrala antes de abrir una nueva.',
      };
    case 'dia_anterior':
      return {
        titulo: 'Caja del día anterior',
        mensaje:
          'Esta caja fue abierta el día anterior. Cerrala antes de abrir una nueva.',
      };
    case 'excedida': {
      const horas = alerta.detalle?.horasUmbral;
      return {
        titulo: horas
          ? `Caja abierta hace más de ${horas} horas`
          : 'Caja abierta hace mucho tiempo',
        mensaje:
          'La caja lleva mucho tiempo abierta. Recomendamos cerrarla y abrir una nueva.',
      };
    }
  }
}

interface CashRegisterAlertBannerProps {
  alerta: CashRegisterAlert | null | undefined;
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
  compact = false,
}: CashRegisterAlertBannerProps) {
  if (!alerta) return null;

  const { titulo, mensaje } = resolveText(alerta);
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
