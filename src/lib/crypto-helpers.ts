import { createHash, timingSafeEqual } from 'crypto';

export function tokensMatch(expected: string, provided: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(expected), digest(provided));
}
