'use client';

import { useEffect, useRef, useCallback } from 'react';
import { sessionsAPI } from '@/lib/api';
import { getStoredToken } from '@/lib/auth';

interface UseHeartbeatOptions {
    intervalMs?: number;  // How often to send heartbeat (default: 30 seconds)
    enabled?: boolean;    // Whether to enable heartbeat (default: true)
    onSessionExpired?: () => void;  // Callback when session is detected as expired
}

/**
 * useHeartbeat - Sends periodic heartbeat to server to maintain real-time online status
 * 
 * This hook:
 * 1. Sends heartbeat every 30 seconds (configurable)
 * 2. Updates user's last_activity in database
 * 3. Detects if session has been invalidated (forced logout)
 * 4. Stops when user is not logged in or tab is hidden
 */
export function useHeartbeat(options: UseHeartbeatOptions = {}) {
    const {
        intervalMs = 30000, // 30 seconds default
        enabled = true,
        onSessionExpired
    } = options;

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const isVisibleRef = useRef(true);
    const lastHeartbeatRef = useRef<Date | null>(null);

    const sendHeartbeat = useCallback(async () => {
        const token = getStoredToken();
        if (!token) return;

        try {
            const response = await sessionsAPI.heartbeat();
            lastHeartbeatRef.current = new Date();
            console.debug('💓 Heartbeat sent:', response.data?.timestamp);
        } catch (error: any) {
            console.warn('Heartbeat failed:', error?.response?.data?.error || error.message);

            // If session is invalidated, trigger callback
            if (error?.response?.status === 401) {
                console.warn('Session expired or invalidated');
                onSessionExpired?.();
            }
        }
    }, [onSessionExpired]);

    // Handle visibility change - pause heartbeat when tab is hidden
    useEffect(() => {
        const handleVisibilityChange = () => {
            isVisibleRef.current = document.visibilityState === 'visible';

            // Send immediate heartbeat when tab becomes visible again
            if (isVisibleRef.current && enabled) {
                sendHeartbeat();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [enabled, sendHeartbeat]);

    // Main heartbeat interval
    useEffect(() => {
        const token = getStoredToken();
        if (!enabled || !token) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // Send initial heartbeat
        sendHeartbeat();

        // Set up interval
        intervalRef.current = setInterval(() => {
            if (isVisibleRef.current) {
                sendHeartbeat();
            }
        }, intervalMs);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [enabled, intervalMs, sendHeartbeat]);

    return {
        lastHeartbeat: lastHeartbeatRef.current,
        sendHeartbeat, // Manual trigger if needed
    };
}

export default useHeartbeat;
