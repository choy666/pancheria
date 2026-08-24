'use client';

import { useEffect } from 'react';

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
  const enabled =
    String(process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS).trim() === 'true';

  useEffect(() => {
    if (enabled) {
      injectAnalyticsScript();
    }
  }, [enabled]);

  return null;
}
