'use client';

import {
  DAYS,
  minutesOf,
  getSocialNetworkLabel,
  getSocialLinkHref,
} from '@/lib/branch-helpers';
import { cn } from '@/lib/utils';
import type { PantallaSnapshot } from '@/lib/pantalla-playlist';

interface PantallaBranchSceneProps {
  snapshot: PantallaSnapshot;
}

function openingHoursByDay(snapshot: PantallaSnapshot) {
  const byDay = new Map<number, string[]>();
  const sorted = [...(snapshot.branch.openingHours ?? [])].sort(
    (a, b) =>
      a.dayOfWeek - b.dayOfWeek || minutesOf(a.open) - minutesOf(b.open)
  );
  for (const slot of sorted) {
    const list = byDay.get(slot.dayOfWeek) ?? [];
    list.push(`${slot.open} - ${slot.close}`);
    byDay.set(slot.dayOfWeek, list);
  }
  return byDay;
}

/**
 * Escena de datos de la sucursal: estado abierto/cerrado, horario de hoy y
 * próxima apertura, la grilla semanal de horarios y los canales de contacto.
 * Es la escena "informativa" del loop: útil también cuando la sucursal está
 * cerrada o el catálogo está vacío.
 */
export function PantallaBranchScene({ snapshot }: PantallaBranchSceneProps) {
  const { branch, isOpen, currentOpening, nextOpening } = snapshot;
  const byDay = openingHoursByDay(snapshot);
  const today = new Date().getDay();
  const phones = branch.phones ?? [];
  const socialLinks = branch.socialLinks ?? [];

  return (
    <div
      data-testid="pantalla-scene-branch"
      className="relative flex h-full w-full flex-col items-center justify-center gap-6 overflow-hidden p-6 md:gap-10 md:p-12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-red/15 blur-[160px]"
      />

      <div className="relative flex flex-col items-center gap-3 text-center">
        <h2 className="font-heading text-4xl tracking-wide text-white md:text-6xl">
          {branch.name}
        </h2>
        <p
          data-testid="pantalla-branch-status"
          className={cn(
            'flex items-center gap-3 text-xl font-medium md:text-3xl',
            isOpen ? 'text-green-400' : 'text-amber-400'
          )}
        >
          <span
            className={cn(
              'inline-block size-4 rounded-full md:size-5',
              isOpen ? 'bg-green-500' : 'bg-amber-500'
            )}
          />
          {isOpen
            ? `Abierto ahora · ${currentOpening}`
            : `Cerrado ahora${nextOpening ? ` · Abre ${nextOpening}` : ''}`}
        </p>
      </div>

      {byDay.size > 0 && (
        <dl className="relative grid w-full max-w-4xl grid-cols-1 gap-x-10 gap-y-2 text-lg sm:grid-cols-2 md:text-2xl">
          {DAYS.map((dayName, dayOfWeek) => {
            const slots = byDay.get(dayOfWeek);
            if (!slots) return null;
            const isToday = dayOfWeek === today;
            return (
              <div
                key={dayName}
                className={cn(
                  'flex items-baseline justify-between gap-4 border-b border-white/10 pb-2',
                  isToday && 'text-brand-mustard'
                )}
              >
                <dt className="font-semibold">
                  {dayName}
                  {isToday && (
                    <span className="ml-2 align-middle text-sm uppercase tracking-wider text-brand-mustard/80">
                      hoy
                    </span>
                  )}
                </dt>
                <dd className="text-white/80">{slots.join(' · ')}</dd>
              </div>
            );
          })}
        </dl>
      )}

      <div className="relative flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-base text-white/70 md:text-xl">
        {branch.address && <span>{branch.address}</span>}
        {phones.map((phone) => (
          <span key={`${phone.label}-${phone.number}`}>
            {phone.label}: {phone.number}
          </span>
        ))}
        {socialLinks.map((link) => (
          <span key={`${link.network}-${link.url}`}>
            {getSocialNetworkLabel(link.network)}:{' '}
            {getSocialLinkHref(link) ?? link.url}
          </span>
        ))}
      </div>
    </div>
  );
}
