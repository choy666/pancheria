/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';
import { ConditionalAnalytics } from './conditional-analytics';

describe('ConditionalAnalytics', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    document.head.innerHTML = '';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('no inyecta el script cuando no está habilitado', () => {
    process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS = undefined;
    render(<ConditionalAnalytics />);

    expect(document.head.querySelector('script[src*="/_vercel/insights/script.js"]')).toBeNull();
  });

  test('inyecta el script cuando está habilitado', () => {
    process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS = 'true';
    render(<ConditionalAnalytics />);

    const script = document.head.querySelector('script[src="/_vercel/insights/script.js"]');
    expect(script).not.toBeNull();
    expect(script).toHaveAttribute('defer');
    expect(script).toHaveAttribute('data-sdkn', '@vercel/analytics/next');
  });

  test('no duplica el script si ya existe', () => {
    process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS = 'true';
    const existing = document.createElement('script');
    existing.src = '/_vercel/insights/script.js';
    document.head.appendChild(existing);

    render(<ConditionalAnalytics />);

    expect(document.head.querySelectorAll('script[src*="/_vercel/insights/script.js"]')).toHaveLength(1);
  });
});
