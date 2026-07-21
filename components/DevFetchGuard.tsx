'use client';

import { useEffect } from 'react';

/**
 * Next.js Turbopack sometimes logs TypeError: Failed to fetch when an RSC
 * payload request is aborted during Fast Refresh / slow compiles. That shows
 * up as a full-screen console overlay even though the app recovers via
 * browser navigation. Filter those benign errors in development only.
 */
export default function DevFetchGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const isBenignFetchError = (value: unknown) => {
      const text =
        typeof value === 'string'
          ? value
          : value instanceof Error
            ? `${value.name}: ${value.message}`
            : value != null
              ? String(value)
              : '';
      return (
        text.includes('Failed to fetch') ||
        text.includes('Failed to fetch RSC payload') ||
        text.includes('NetworkError when attempting to fetch resource')
      );
    };

    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      if (args.some(isBenignFetchError)) return;
      originalError.apply(console, args as never[]);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isBenignFetchError(event.reason)) {
        event.preventDefault();
      }
    };

    const onError = (event: ErrorEvent) => {
      if (isBenignFetchError(event.error) || isBenignFetchError(event.message)) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);

    return () => {
      console.error = originalError;
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, []);

  return null;
}
