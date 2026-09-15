'use client';

import { useEffect } from 'react';
import { isVercelAnalyticsEnabled } from '@/config/analytics';
import { logger } from '@/lib/logger';

function injectAnalyticsScript() {
  if (typeof window === 'undefined') {
    return;
  }

  const src = '/_vercel/insights/script.js';
  if (document.head.querySelector(`script[src*="${src}"]`)) {
    return;
  }

  const script = document.createElement('script');
  script.src = src;
  script.defer = true;
  script.dataset.sdkn = '@vercel/analytics/next';
  // El endpoint `/_vercel/*` solo existe en deploys de Vercel: en
  // desarrollo/test el script siempre falla, así que solo se loguea en
  // producción para no ensuciar la consola.
  if (process.env.NODE_ENV === 'production') {
    script.onerror = () => {
      logger.warn(
        'No se pudo cargar el script de Vercel Analytics. Verificá que Analytics esté habilitado en el dashboard de Vercel.',
        { source: 'ConditionalAnalytics', src }
      );
    };
  }
  document.head.appendChild(script);
}

export function ConditionalAnalytics() {
  const enabled = isVercelAnalyticsEnabled();

  useEffect(() => {
    if (enabled) {
      injectAnalyticsScript();
    }
  }, [enabled]);

  return null;
}
