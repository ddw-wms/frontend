// File Path = warehouse-frontend/app/context/ConnectionContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { checkServerHealth, wakeUpServer } from '@/lib/api';

// Connection status types
export type ConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'offline' | 'error';

interface ConnectionState {
    status: ConnectionStatus;
    lastChecked: Date | null;
    lastError: string | null;
    retryCount: number;
    isOnline: boolean;
    serverReady: boolean;
    databaseReady: boolean;
    initialCheckDone: boolean;
}

interface ConnectionContextType extends ConnectionState {
    checkConnection: () => Promise<boolean>;
    retryConnection: () => Promise<boolean>;
    isHealthy: boolean;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// Health check intervals
const HEALTH_CHECK_INTERVAL = 60000; // Check every 60 seconds when healthy
const RECONNECT_INTERVAL = 10000; // Retry every 10 seconds when disconnected
const MAX_RETRY_COUNT = 10;

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<ConnectionState>({
        status: 'connecting',
        lastChecked: null,
        lastError: null,
        retryCount: 0,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        serverReady: false,
        databaseReady: false,
        initialCheckDone: false,
    });

    const healthCheckInterval = useRef<NodeJS.Timeout | null>(null);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
    const isMounted = useRef(true);

    // Check server connection
    const checkConnection = useCallback(async (): Promise<boolean> => {
        try {
            const health = await checkServerHealth();

            if (!isMounted.current) return false;

            const isHealthy = health.status === 'OK' || health.status === 'DEGRADED';
            const dbReady = health.database?.ready ?? false;
            const dbHealthy = health.database?.healthy ?? false;

            setState(prev => ({
                ...prev,
                status: isHealthy ? 'connected' : (health.status === 'CONNECTING' ? 'connecting' : 'error'),
                lastChecked: new Date(),
                lastError: null,
                retryCount: 0,
                serverReady: isHealthy,
                databaseReady: dbReady && dbHealthy,
                initialCheckDone: true,
            }));

            return isHealthy;
        } catch (error: any) {
            if (!isMounted.current) return false;

            const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';

            setState(prev => ({
                ...prev,
                status: isNetworkError ? 'offline' : 'error',
                lastChecked: new Date(),
                lastError: error.message,
                serverReady: false,
                databaseReady: false,
                initialCheckDone: true,
            }));

            return false;
        }
    }, []);

    // Retry connection with wake-up
    const retryConnection = useCallback(async (): Promise<boolean> => {
        if (!isMounted.current) return false;

        setState(prev => ({
            ...prev,
            status: 'reconnecting',
            retryCount: prev.retryCount + 1,
        }));

        try {
            // Try to wake up the server
            const wakeSuccess = await wakeUpServer();

            if (wakeSuccess) {
                return await checkConnection();
            }

            // Wait a bit and try health check anyway
            await new Promise(resolve => setTimeout(resolve, 2000));
            return await checkConnection();
        } catch (error: any) {
            if (!isMounted.current) return false;

            setState(prev => ({
                ...prev,
                status: 'error',
                lastError: error.message,
            }));

            return false;
        }
    }, [checkConnection]);

    // Monitor browser online/offline status
    useEffect(() => {
        const handleOnline = () => {
            setState(prev => ({ ...prev, isOnline: true }));
            checkConnection();
        };

        const handleOffline = () => {
            setState(prev => ({
                ...prev,
                isOnline: false,
                status: 'offline',
                serverReady: false,
            }));
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [checkConnection]);

    // Initial connection check and periodic health checks
    useEffect(() => {
        isMounted.current = true;

        const initialCheck = async () => {
            const isHealthy = await checkConnection();

            if (!isHealthy && isMounted.current) {
                await retryConnection();
            }
        };

        initialCheck();

        healthCheckInterval.current = setInterval(() => {
            if (state.status === 'connected' && state.isOnline) {
                checkConnection();
            }
        }, HEALTH_CHECK_INTERVAL);

        return () => {
            isMounted.current = false;
            if (healthCheckInterval.current) {
                clearInterval(healthCheckInterval.current);
            }
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-retry when disconnected
    useEffect(() => {
        if (
            (state.status === 'error' || state.status === 'offline') &&
            state.isOnline &&
            state.retryCount < MAX_RETRY_COUNT
        ) {
            reconnectTimeout.current = setTimeout(() => {
                retryConnection();
            }, RECONNECT_INTERVAL);
        }

        return () => {
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
        };
    }, [state.status, state.isOnline, state.retryCount, retryConnection]);

    // Check when page becomes visible again
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && state.isOnline) {
                checkConnection();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [checkConnection, state.isOnline]);

    const isHealthy = state.status === 'connected' && state.serverReady;

    return (
        <ConnectionContext.Provider
            value={{
                ...state,
                checkConnection,
                retryConnection,
                isHealthy,
            }}
        >
            {children}
        </ConnectionContext.Provider>
    );
}

export function useConnection() {
    const context = useContext(ConnectionContext);
    if (context === undefined) {
        throw new Error('useConnection must be used within a ConnectionProvider');
    }
    return context;
}

// Hook for showing connection status banner
export function useConnectionStatus() {
    const { status, isOnline, retryCount, retryConnection, isHealthy, initialCheckDone } = useConnection();

    // Only show banner after initial check is done AND there's a problem
    // Don't show during initial 'connecting' phase
    const shouldShowBanner = initialCheckDone && !isHealthy && status !== 'connecting';

    const message = (() => {
        if (!isOnline) {
            return 'No internet connection. Please check your network.';
        }
        if (status === 'reconnecting') {
            return `Reconnecting to server... (Attempt ${retryCount})`;
        }
        if (status === 'offline' || status === 'error') {
            return 'Unable to connect to server. Retrying automatically...';
        }
        if (status === 'connecting') {
            return 'Connecting to server...';
        }
        return '';
    })();

    return {
        shouldShowBanner,
        message,
        status,
        isOnline,
        isHealthy,
        retry: retryConnection,
    };
}
