const envDenominations = process.env.NEXT_PUBLIC_PAYMENT_DENOMINATIONS;

export const DEFAULT_DENOMINATIONS = envDenominations
  ? envDenominations
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0)
  : [1000, 2000, 5000, 10000, 20000];
