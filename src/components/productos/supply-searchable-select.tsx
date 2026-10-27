'use client';

import { useMemo, useRef, useState } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import {
  criticalTypeLabels,
  productTypeDotClasses,
  productTypeLabels,
} from '@/lib/product-style';
import type { CriticalSupplyType, ProductType } from '@/domain/types';

export interface Supply {
  id: number;
  name: string;
  type: ProductType;
  criticalSupplyType: CriticalSupplyType | null;
  unit: string;
  stock: number;
}

export type SupplyGroupKey =
  | CriticalSupplyType
  | 'manual_supply'
  | 'service'
  | 'compound';

const groupPriorityDefault: Record<SupplyGroupKey, number> = {
  bread: 1,
  sausage: 2,
  beverage: 3,
  manual_supply: 4,
  service: 5,
  compound: 6,
};

export function getSupplyGroupKey(supply: Supply): SupplyGroupKey {
  if (supply.type === 'critical_supply' && supply.criticalSupplyType) {
    return supply.criticalSupplyType;
  }
  if (
    supply.type === 'manual_supply' ||
    supply.type === 'service' ||
    supply.type === 'compound'
  ) {
    return supply.type;
  }
  return 'manual_supply';
}

function getGroupLabel(key: SupplyGroupKey): string {
  if (['bread', 'sausage', 'beverage'].includes(key)) {
    return `Insumos críticos — ${criticalTypeLabels[key as CriticalSupplyType]}`;
  }
  return productTypeLabels[key as ProductType];
}

function formatSupplyLabel(supply: Supply) {
  if (supply.type === 'critical_supply' && supply.criticalSupplyType) {
    return `${supply.name} (${supply.unit}) — ${criticalTypeLabels[supply.criticalSupplyType]}`;
  }
  return `${supply.name} (${supply.unit}) — ${productTypeLabels[supply.type]}`;
}

function normalizeSearch(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getHighlightSegments(text: string, query: string) {
  const segments: { text: string; isMatch: boolean }[] = [];
  if (!text || !query) return [{ text, isMatch: false }];

  const words = normalizeSearch(query)
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return [{ text, isMatch: false }];

  const normalizedText = normalizeSearch(text).replace(/\s+/g, ' ');
  const chars = Array.from(text);
  const matched = new Array<boolean>(chars.length).fill(false);

  for (const word of words) {
    let start = normalizedText.indexOf(word);
    while (start !== -1) {
      for (let i = start; i < start + word.length && i < chars.length; i++) {
        matched[i] = true;
      }
      start = normalizedText.indexOf(word, start + 1);
    }
  }

  let i = 0;
  while (i < chars.length) {
    const isMatch = matched[i];
    let j = i + 1;
    while (j < chars.length && matched[j] === isMatch) j++;
    segments.push({ text: chars.slice(i, j).join(''), isMatch });
    i = j;
  }
  return segments;
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const segments = getHighlightSegments(text, query);
  return (
    <>
      {segments.map((s, i) =>
        s.isMatch ? (
          <mark
            key={i}
            className="rounded-sm bg-primary/30 px-0.5 font-medium text-primary-foreground"
          >
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </>
  );
}

interface SupplyOption {
  supply: Supply;
  label: string;
}

interface SupplyOptionGroup {
  key: SupplyGroupKey;
  label: string;
  items: SupplyOption[];
}

interface SupplySearchableSelectProps {
  id?: string;
  'data-testid'?: string;
  supplies: Supply[];
  value: number;
  onChange: (value: number) => void;
  preferredGroupKey?: SupplyGroupKey;
}

export function SupplySearchableSelect({
  id,
  'data-testid': testId,
  supplies,
  value,
  onChange,
  preferredGroupKey,
}: SupplySearchableSelectProps) {
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const normalizedQuery = useMemo(() => normalizeSearch(query), [query]);

  const selectedOption = useMemo<SupplyOption | null>(() => {
    const supply = supplies.find((s) => s.id === value);
    return supply ? { supply, label: formatSupplyLabel(supply) } : null;
  }, [supplies, value]);

  const groupedOptions = useMemo<SupplyOptionGroup[]>(() => {
    const groups = new Map<SupplyGroupKey, SupplyOption[]>();
    for (const supply of supplies) {
      const key = getSupplyGroupKey(supply);
      const items = groups.get(key) ?? [];
      items.push({ supply, label: formatSupplyLabel(supply) });
      groups.set(key, items);
    }

    const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
      const priorityA =
        (groupPriorityDefault[a] ?? 99) + (a === preferredGroupKey ? -100 : 0);
      const priorityB =
        (groupPriorityDefault[b] ?? 99) + (b === preferredGroupKey ? -100 : 0);
      return priorityA - priorityB || a.localeCompare(b);
    });

    return sortedKeys.map((key) => ({
      key,
      label: getGroupLabel(key),
      items:
        groups
          .get(key)
          ?.sort((a, b) => a.supply.name.localeCompare(b.supply.name)) ?? [],
    }));
  }, [supplies, preferredGroupKey]);

  const showClear = query.length > 0;

  return (
    <Combobox.Root<SupplyOption>
      items={groupedOptions}
      value={selectedOption}
      onValueChange={(option) => {
        if (option) {
          onChange(option.supply.id);
          setQuery('');
        }
      }}
      isItemEqualToValue={(a, b) => a?.supply.id === b?.supply.id}
      itemToStringLabel={(option) => option.label}
      filter={(option, rawQuery) => {
        const haystack = normalizeSearch(
          [
            option.supply.name,
            productTypeLabels[option.supply.type],
            option.supply.criticalSupplyType
              ? criticalTypeLabels[option.supply.criticalSupplyType]
              : '',
            option.supply.unit,
          ].join(' ')
        ).replace(/\s+/g, ' ');
        return normalizeSearch(rawQuery)
          .split(/\s+/)
          .filter((word) => word.length > 0)
          .every((word) => haystack.includes(word));
      }}
      inputValue={query}
      onInputValueChange={setQuery}
      onOpenChange={(open) => {
        if (open) {
          setQuery('');
        }
      }}
      autoHighlight
    >
      <Combobox.Trigger
        id={id}
        data-testid={testId}
        className={cn(
          'flex w-full min-h-11 items-center justify-between gap-1.5 rounded-lg border border-input bg-input/50 px-3 py-2 text-base transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          !selectedOption && 'text-muted-foreground'
        )}
      >
        <span className="flex-1 truncate text-left">
          <Combobox.Value>
            {(option: SupplyOption | null) =>
              option ? option.label : 'Seleccionar insumo'
            }
          </Combobox.Value>
        </span>
        <Combobox.Icon
          render={
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          }
        />
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner
          className="isolate z-50"
          sideOffset={4}
          align="start"
          collisionPadding={8}
        >
          <Combobox.Popup
            aria-label="Opciones de insumo"
            className="flex max-h-(--available-height) w-(--anchor-width) min-w-0 max-w-(--available-width) flex-col overflow-hidden rounded-2xl border border-white/10 bg-popover p-1.5 text-popover-foreground shadow-xl ring-1 ring-white/10 sm:min-w-[320px]"
          >
            <div className="shrink-0 p-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Combobox.Input
                  ref={searchInputRef}
                  autoFocus
                  placeholder="Buscar por nombre, tipo o unidad"
                  className={cn(
                    'min-h-11 w-full rounded-lg border border-input bg-input/50 px-3 py-2 pl-9 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 md:min-h-9 md:px-2.5 md:pl-9 md:text-sm',
                    showClear ? 'pr-9' : 'pr-3'
                  )}
                />
                {showClear && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      setQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>
            <Combobox.Empty>
              <div className="px-2 py-3 text-sm text-muted-foreground">
                No se encontraron insumos. Probá con otro término.
              </div>
            </Combobox.Empty>
            <Combobox.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {(group: SupplyOptionGroup) => (
                <Combobox.Group key={group.key} items={group.items}>
                  <Combobox.GroupLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    {group.label}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(option: SupplyOption) => (
                      <Combobox.Item
                        key={option.supply.id}
                        value={option}
                        className="flex w-full cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none transition-colors select-none not-data-[selected]:hover:bg-accent/80 not-data-[selected]:hover:text-accent-foreground data-highlighted:bg-accent/30 data-highlighted:ring-2 data-highlighted:ring-inset data-highlighted:ring-ring/50 data-selected:bg-accent data-selected:text-accent-foreground"
                      >
                        <span
                          className={cn(
                            'inline-block h-2 w-2 shrink-0 rounded-full',
                            productTypeDotClasses[option.supply.type]
                          )}
                        />
                        <span className="flex-1 truncate">
                          <HighlightText
                            text={option.label}
                            query={normalizedQuery}
                          />
                        </span>
                        <Combobox.ItemIndicator>
                          <Check className="size-4 shrink-0" />
                        </Combobox.ItemIndicator>
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
