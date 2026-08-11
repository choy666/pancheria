import type { CriticalSupplyType, ProductType } from '@/domain/types';

export const productTypeLabels: Record<ProductType, string> = {
  critical_supply: 'Insumo crítico',
  compound: 'Promo',
  manual_supply: 'Insumo manual',
  service: 'Servicio / extra',
};

export const criticalTypeLabels: Record<CriticalSupplyType, string> = {
  bread: 'Pan',
  sausage: 'Salchicha',
  beverage: 'Bebida',
};

export const typePriority: Record<ProductType, number> = {
  compound: 1,
  critical_supply: 2,
  manual_supply: 3,
  service: 4,
};

export const criticalSupplyTypePriority: Record<CriticalSupplyType, number> = {
  bread: 1,
  sausage: 2,
  beverage: 3,
};

export const productTypeBadgeClasses: Record<ProductType, string> = {
  compound: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  critical_supply: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  manual_supply: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  service: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
};

export const productTypeTextClasses: Record<ProductType, string> = {
  compound: 'text-amber-400',
  critical_supply: 'text-rose-400',
  manual_supply: 'text-sky-400',
  service: 'text-violet-400',
};

export const productTypeDotClasses: Record<ProductType, string> = {
  compound: 'bg-amber-500',
  critical_supply: 'bg-rose-500',
  manual_supply: 'bg-sky-500',
  service: 'bg-violet-500',
};

export const productTypeGroupClasses: Record<ProductType, string> = {
  compound: 'bg-amber-500/10 text-amber-300',
  critical_supply: 'bg-rose-500/10 text-rose-300',
  manual_supply: 'bg-sky-500/10 text-sky-300',
  service: 'bg-violet-500/10 text-violet-300',
};
