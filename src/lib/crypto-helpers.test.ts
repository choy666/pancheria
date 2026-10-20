/**
 * @jest-environment node
 */
import { tokensMatch } from './crypto-helpers';

describe('tokensMatch', () => {
  test('acepta tokens idénticos', () => {
    expect(tokensMatch('a'.repeat(64), 'a'.repeat(64))).toBe(true);
  });

  test('rechaza tokens distintos de la misma longitud', () => {
    expect(tokensMatch('a'.repeat(63) + 'b', 'a'.repeat(64))).toBe(false);
  });

  test('rechaza tokens de distinta longitud sin lanzar', () => {
    expect(tokensMatch('abc', 'abcd')).toBe(false);
    expect(tokensMatch('abc', '')).toBe(false);
  });
});
