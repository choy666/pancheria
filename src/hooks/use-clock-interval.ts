import { useEffect, useState } from 'react';

export function useClockInterval(intervalMs: number) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const isDocumentDefined = typeof document !== 'undefined';

    function startInterval() {
      intervalId = setInterval(() => setNow(new Date()), intervalMs);
    }

    function stopInterval() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function handleVisibilityChange() {
      if (isDocumentDefined && document.hidden) {
        stopInterval();
      } else {
        queueMicrotask(() => setNow(new Date()));
        startInterval();
      }
    }

    startInterval();

    if (isDocumentDefined) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      stopInterval();
      if (isDocumentDefined) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [intervalMs]);

  return now;
}
