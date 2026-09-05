'use client';

import { useEffect } from 'react';
import { isVercelAnalyticsEnabled } from '@/config/analytics';

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
