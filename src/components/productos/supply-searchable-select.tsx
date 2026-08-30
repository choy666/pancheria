'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const [maxHeight, setMaxHeight] = useState(384);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const fallbackId = useId();
  const listboxId = `${id || fallbackId}-listbox`;

  const normalizedQuery = useMemo(() => normalizeSearch(query), [query]);

  const selectedSupply = useMemo(
    () => supplies.find((s) => s.id === value),
    [supplies, value]
  );

  const groupedOptions = useMemo(() => {
    const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 0);

    const filtered = supplies.filter((s) => {
      const haystack = normalizeSearch(
        [
          s.name,
          productTypeLabels[s.type],
          s.criticalSupplyType ? criticalTypeLabels[s.criticalSupplyType] : '',
          s.unit,
        ].join(' ')
      ).replace(/\s+/g, ' ');
      if (queryWords.length === 0) return true;
      return queryWords.every((word) => haystack.includes(word));
    });

    const groups = new Map<
      SupplyGroupKey,
      { supply: Supply; label: string }[]
    >();
    for (const s of filtered) {
      const key = getSupplyGroupKey(s);
      const arr = groups.get(key) ?? [];
      arr.push({ supply: s, label: formatSupplyLabel(s) });
      groups.set(key, arr);
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
  }, [supplies, normalizedQuery, preferredGroupKey]);

  const flatOptions = useMemo(
    () => groupedOptions.flatMap((g) => g.items),
    [groupedOptions]
  );

  const safeActiveIndex = useMemo(() => {
    if (flatOptions.length === 0) return -1;
    if (activeIndex >= 0 && activeIndex < flatOptions.length) return activeIndex;
    return 0;
  }, [activeIndex, flatOptions]);

  useEffect(() => {
    if (safeActiveIndex >= 0) {
      const active = flatOptions[safeActiveIndex];
      if (active) {
        const node = optionRefs.current.get(active.supply.id);
        node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }, [safeActiveIndex, flatOptions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function updateLayout() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const vh = window.innerHeight;
      const padding = 8;
      const minHeight = 150;
      const desired = 384;

      const spaceBelow = vh - rect.bottom - padding;
      const spaceAbove = rect.top - padding;
      let nextPlacement: 'bottom' | 'top' = 'bottom';
      let nextMaxHeight = desired;

      if (spaceBelow >= minHeight) {
        nextPlacement = 'bottom';
        nextMaxHeight = Math.min(spaceBelow, desired);
      } else if (spaceAbove >= minHeight) {
        nextPlacement = 'top';
        nextMaxHeight = Math.min(spaceAbove, desired);
      } else {
        nextPlacement = 'bottom';
        nextMaxHeight = Math.max(spaceBelow, minHeight);
      }

      setPlacement(nextPlacement);
      setMaxHeight(nextMaxHeight);
    }

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, [open]);

  function handleSelect(supply: Supply) {
    onChange(supply.id);
    setOpen(false);
    setQuery('');
  }

  function handleToggle() {
    const nextOpen = !open;
    if (nextOpen) {
      setQuery('');
      setActiveIndex(0);
    } else {
      setActiveIndex(-1);
    }
    setOpen(nextOpen);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter'
      ) {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
      return;
    }

    if (flatOptions.length === 0) {
      if (event.key === 'Escape' || event.key === 'Tab') {
        setOpen(false);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex(
          safeActiveIndex >= flatOptions.length - 1 ? 0 : safeActiveIndex + 1
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex(
          safeActiveIndex <= 0 ? flatOptions.length - 1 : safeActiveIndex - 1
        );
        break;
      case 'Enter':
        event.preventDefault();
        if (safeActiveIndex >= 0) {
          handleSelect(flatOptions[safeActiveIndex].supply);
        }
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(flatOptions.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
    }
  }

  const activeOptionId =
    safeActiveIndex >= 0
      ? `${id || fallbackId}-option-${flatOptions[safeActiveIndex].supply.id}`
      : undefined;

  const showClear = query.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        data-testid={testId}
        ref={triggerRef}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        role="combobox"
        className={cn(
          'flex w-full min-h-11 items-center justify-between gap-1.5 rounded-lg border border-input bg-input/50 px-3 py-2 text-base transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          !selectedSupply && 'text-muted-foreground'
        )}
      >
        <span className="flex-1 truncate text-left">
          {selectedSupply
            ? formatSupplyLabel(selectedSupply)
            : 'Seleccionar insumo'}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-50 w-full min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-popover p-1.5 text-popover-foreground shadow-xl ring-1 ring-white/10 flex flex-col sm:min-w-[320px]',
            placement === 'top' ? 'bottom-[100%] mb-1' : 'top-[100%] mt-1'
          )}
          style={{ maxHeight }}
          role="listbox"
          id={listboxId}
        >
          <div className="shrink-0 p-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                onBlur={(e) => {
                  if (
                    !containerRef.current?.contains(e.relatedTarget as Node)
                  ) {
                    setOpen(false);
                  }
                }}
                placeholder="Buscar por nombre, tipo o unidad"
                autoFocus
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={activeOptionId}
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
          <div className="min-h-0 flex-1 overflow-y-auto">
            {flatOptions.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                No se encontraron insumos. Probá con otro término.
              </div>
            ) : (
              groupedOptions.map((group) => (
                <div key={group.key} role="group" aria-label={group.label}>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    {group.label}
                  </div>
                  {group.items.map(({ supply, label }) => {
                    const isSelected = supply.id === value;
                    const isActive =
                      flatOptions[safeActiveIndex]?.supply.id === supply.id;
                    return (
                      <button
                        key={supply.id}
                        type="button"
                        role="option"
                        id={`${id || fallbackId}-option-${supply.id}`}
                        aria-selected={isSelected}
                        tabIndex={-1}
                        onClick={() => handleSelect(supply)}
                        ref={(node) => {
                          if (node) {
                            optionRefs.current.set(supply.id, node);
                          } else {
                            optionRefs.current.delete(supply.id);
                          }
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors select-none focus:outline-none',
                          isActive ? 'ring-2 ring-ring/50 bg-accent/30' : '',
                          isSelected
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent/80 hover:text-accent-foreground'
                        )}
                      >
                        <span
                          className={cn(
                            'inline-block h-2 w-2 shrink-0 rounded-full',
                            productTypeDotClasses[supply.type]
                          )}
                        />
                        <span className="flex-1 truncate">
                          <HighlightText text={label} query={normalizedQuery} />
                        </span>
                        {isSelected && <Check className="size-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
