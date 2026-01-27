// File Path = warehouse-frontend/hooks/useApiQuery.ts
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { parseApiError, ApiErrorDetails, withRetry } from '@/lib/api';

interface UseApiQueryOptions<T> {
    /** Initial data value */
    initialData?: T;
    /** Auto-fetch on mount */
    autoFetch?: boolean;
    /** Number of retries (0 = no retry) */
    retries?: number;
    /** Retry delay in ms */
    retryDelay?: number;
    /** Timeout for loading state before showing error (ms) */
    loadingTimeout?: number;
    /** Callback on success */
    onSuccess?: (data: T) => void;
    /** Callback on error */
    onError?: (error: ApiErrorDetails) => void;
    /** Dependencies that trigger refetch */
    deps?: any[];
}

interface UseApiQueryResult<T> {
    data: T | null;
    isLoading: boolean;
    isRetrying: boolean;
    error: ApiErrorDetails | null;
    hasTimedOut: boolean;
    refetch: () => Promise<void>;
    reset: () => void;
}

/**
 * useApiQuery - Hook for data fetching with automatic retry and timeout handling
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Loading timeout detection (prevents infinite loading)
 * - User-friendly error messages
 * - Refetch capability
 * 
 * @param fetchFn - Async function that returns data
 * @param options - Configuration options
 */
export function useApiQuery<T>(
    fetchFn: () => Promise<T>,
    options: UseApiQueryOptions<T> = {}
): UseApiQueryResult<T> {
    const {
        initialData = null,
        autoFetch = true,
        retries = 3,
        retryDelay = 1000,
        loadingTimeout = 30000, // 30 seconds default timeout
        onSuccess,
        onError,
        deps = [],
    } = options;

    const [data, setData] = useState<T | null>(initialData);
    const [isLoading, setIsLoading] = useState(autoFetch);
    const [isRetrying, setIsRetrying] = useState(false);
    const [error, setError] = useState<ApiErrorDetails | null>(null);
    const [hasTimedOut, setHasTimedOut] = useState(false);

    const isMounted = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const retryCountRef = useRef(0);

    const cleanup = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    const fetch = useCallback(async () => {
        if (!isMounted.current) return;

        cleanup();

        setIsLoading(true);
        setError(null);
        setHasTimedOut(false);
        retryCountRef.current = 0;

        // Create new abort controller
        abortControllerRef.current = new AbortController();

        // Set loading timeout
        if (loadingTimeout > 0) {
            timeoutRef.current = setTimeout(() => {
                if (isMounted.current && isLoading) {
                    setHasTimedOut(true);
                }
            }, loadingTimeout);
        }

        try {
            let result: T;

            if (retries > 0) {
                result = await withRetry(
                    fetchFn,
                    {
                        maxRetries: retries,
                        retryDelay,
                        retryCondition: (err) => {
                            const parsed = parseApiError(err);
                            if (parsed.isRetryable) {
                                retryCountRef.current++;
                                if (isMounted.current) {
                                    setIsRetrying(true);
                                }
                                return true;
                            }
                            return false;
                        },
                    }
                );
            } else {
                result = await fetchFn();
            }

            if (!isMounted.current) return;

            setData(result);
            setError(null);
            setIsRetrying(false);
            onSuccess?.(result);
        } catch (err: any) {
            if (!isMounted.current) return;

            // Ignore abort errors
            if (err.name === 'AbortError' || err.name === 'CanceledError') {
                return;
            }

            const parsedError = err.parsedError || parseApiError(err);
            setError(parsedError);
            setIsRetrying(false);
            onError?.(parsedError);
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
                setIsRetrying(false);
            }
            cleanup();
        }
    }, [fetchFn, retries, retryDelay, loadingTimeout, onSuccess, onError, cleanup]);

    const reset = useCallback(() => {
        cleanup();
        setData(initialData);
        setIsLoading(false);
        setIsRetrying(false);
        setError(null);
        setHasTimedOut(false);
        retryCountRef.current = 0;
    }, [cleanup, initialData]);

    // Auto-fetch on mount and when deps change
    useEffect(() => {
        if (autoFetch) {
            fetch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoFetch, ...deps]);

    // Cleanup on unmount
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            cleanup();
        };
    }, [cleanup]);

    return {
        data,
        isLoading,
        isRetrying,
        error,
        hasTimedOut,
        refetch: fetch,
        reset,
    };
}

/**
 * useApiMutation - Hook for mutations (POST, PUT, DELETE) with retry support
 */
export function useApiMutation<TData, TVariables = void>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options: {
        retries?: number;
        onSuccess?: (data: TData) => void;
        onError?: (error: ApiErrorDetails) => void;
    } = {}
) {
    const { retries = 1, onSuccess, onError } = options;

    const [isLoading, setIsLoading] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const [error, setError] = useState<ApiErrorDetails | null>(null);
    const [data, setData] = useState<TData | null>(null);

    const mutate = useCallback(
        async (variables: TVariables) => {
            setIsLoading(true);
            setError(null);
            setIsRetrying(false);

            try {
                let result: TData;

                if (retries > 0) {
                    result = await withRetry(
                        () => mutationFn(variables),
                        {
                            maxRetries: retries,
                            retryCondition: (err) => {
                                const parsed = parseApiError(err);
                                if (parsed.isRetryable && (parsed.isNetworkError || parsed.isServerError)) {
                                    setIsRetrying(true);
                                    return true;
                                }
                                return false;
                            },
                        }
                    );
                } else {
                    result = await mutationFn(variables);
                }

                setData(result);
                setError(null);
                onSuccess?.(result);
                return result;
            } catch (err: any) {
                const parsedError = err.parsedError || parseApiError(err);
                setError(parsedError);
                onError?.(parsedError);
                throw err;
            } finally {
                setIsLoading(false);
                setIsRetrying(false);
            }
        },
        [mutationFn, retries, onSuccess, onError]
    );

    const reset = useCallback(() => {
        setIsLoading(false);
        setIsRetrying(false);
        setError(null);
        setData(null);
    }, []);

    return {
        mutate,
        isLoading,
        isRetrying,
        error,
        data,
        reset,
    };
}

export default useApiQuery;
