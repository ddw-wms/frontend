/**
 * useOfflineGuard — Centralized offline submit protection
 *
 * Provides:
 *  - `isOnline`  — reactive boolean from ConnectionContext + navigator.onLine
 *  - `guardSubmit(fn)` — wraps an async submit function; blocks with a toast when offline
 *
 * Usage:
 *   const { isOnline, guardSubmit } = useOfflineGuard();
 *   const handleSubmit = () => guardSubmit(async () => { ... });
 *
 * All 4 Multi Entry pages already have inline `navigator.onLine` checks.
 * This hook exists so future pages can adopt the same pattern in one line.
 */

import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useConnection } from '@/app/context/ConnectionContext';

export function useOfflineGuard() {
  const { isOnline: contextOnline } = useConnection();

  // Belt-and-suspenders: check both context AND navigator
  const isOnline = contextOnline && (typeof navigator === 'undefined' || navigator.onLine);

  const guardSubmit = useCallback(
    async <T,>(submitFn: () => Promise<T>): Promise<T | undefined> => {
      if (!isOnline) {
        toast.error(
          'Cannot submit while offline. Data is saved locally — submit when back online.',
          { duration: 4000, icon: '📴' }
        );
        return undefined;
      }
      return submitFn();
    },
    [isOnline]
  );

  return { isOnline, guardSubmit } as const;
}
