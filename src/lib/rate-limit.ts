import { NextRequest } from 'next/server';
import { createPublicOrderRateLimitStore } from '@/lib/public-order-rate-limit-store';

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return (request as unknown as { ip?: string }).ip ?? 'unknown';
}

export function createRateLimiter(
  scope: string,
  windowMs: number,
  maxRequests: number
) {
  const store = createPublicOrderRateLimitStore();

  return async function isRateLimited(ip: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') return false;

    const key = `${scope}:${ip}`;
    const now = Date.now();
    const record = await store.get(key);

    if (!record || now > record.resetAt) {
      await store.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }

    record.count += 1;
    if (record.count > maxRequests) return true;

    await store.set(key, record);
    return false;
  };
}
