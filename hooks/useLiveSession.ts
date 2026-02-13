// useLiveSession.ts - Hook to manage broadcasting current user's Multi Entry session
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { liveViewAPI } from '@/lib/api';

interface LiveSessionEntry {
    wsn: string;
    product_title?: string;
    brand?: string;
    mrp?: number;
    fsp?: number;
    cms_vertical?: string;
    rack_no?: string;
    row_index: number;
}

interface UseLiveSessionOptions {
    warehouseId: number | undefined;
    pageType: 'inbound' | 'qc' | 'picking' | 'outbound';
    enabled?: boolean;
    updateInterval?: number; // ms between updates, default 2000
}

export function useLiveSession({
    warehouseId,
    pageType,
    enabled = true,
    updateInterval = 2000
}: UseLiveSessionOptions) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [lastSync, setLastSync] = useState<Date | null>(null);

    const entriesRef = useRef<LiveSessionEntry[]>([]);
    const pendingUpdateRef = useRef(false);
    const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const isRestartingRef = useRef(false);

    // Keep ref in sync with state (for use in intervals/cleanup)
    useEffect(() => {
        sessionIdRef.current = sessionId;
    }, [sessionId]);

    // Reset session state (used for recovery)
    const resetSession = useCallback(() => {
        setSessionId(null);
        setIsActive(false);
        setLastSync(null);
        sessionIdRef.current = null;
        isRestartingRef.current = false;
    }, []);

    // Start a new live session
    const startSession = useCallback(async () => {
        if (!warehouseId || !enabled || sessionId) return;

        try {
            const res = await liveViewAPI.startSession(warehouseId, pageType);
            // Only set session if we got a valid sessionId back
            if (res.data.success && res.data.sessionId) {
                setSessionId(res.data.sessionId);
                setIsActive(true);
                setLastSync(new Date());
                isRestartingRef.current = false;
            }
        } catch (error) {
            // Silently ignore - not critical if live session fails to start
        }
    }, [warehouseId, pageType, enabled, sessionId]);

    // End the live session
    const endSession = useCallback(async () => {
        if (!sessionId) return;

        try {
            await liveViewAPI.endSession(sessionId);
        } catch (error) {
            console.debug('Live session end skipped:', error);
        } finally {
            resetSession();
            entriesRef.current = [];
        }
    }, [sessionId, resetSession]);

    // Update entries (debounced)
    const updateEntries = useCallback((entries: LiveSessionEntry[]) => {
        if (!sessionId || !enabled) return;

        entriesRef.current = entries;
        pendingUpdateRef.current = true;
    }, [sessionId, enabled]);

    // Sync entries to server (also acts as heartbeat)
    const syncEntries = useCallback(async () => {
        if (!sessionId) return;

        try {
            // Always send current entries as heartbeat (even if no changes)
            const res = await liveViewAPI.updateEntries(sessionId, entriesRef.current);

            // Check if server says session expired
            if (res.data?.sessionExpired) {
                console.debug('Live session expired on server, will restart...');
                // Clear session so startSession can re-fire
                resetSession();
                return;
            }

            setLastSync(new Date());
            pendingUpdateRef.current = false;
        } catch (error: any) {
            // If server returns error (session gone), trigger recovery
            if (error?.response?.status === 404 || error?.response?.status === 400) {
                console.debug('Live session error, resetting for recovery...');
                resetSession();
            } else {
                console.debug('Live entries sync skipped:', error);
            }
        }
    }, [sessionId, resetSession]);

    // Set up periodic sync (acts as both data sync + heartbeat)
    useEffect(() => {
        if (sessionId && enabled) {
            // Sync every updateInterval — this keeps last_activity_at fresh even without edits
            updateTimerRef.current = setInterval(syncEntries, updateInterval);
        }

        return () => {
            if (updateTimerRef.current) {
                clearInterval(updateTimerRef.current);
            }
        };
    }, [sessionId, enabled, updateInterval, syncEntries]);

    // Auto-restart session if it gets cleared while still enabled (recovery)
    useEffect(() => {
        if (enabled && warehouseId && !sessionId && !isRestartingRef.current) {
            // Small delay to avoid rapid restart loops
            const timer = setTimeout(() => {
                if (!sessionIdRef.current && enabled) {
                    isRestartingRef.current = true;
                    // We can't call startSession directly (it checks sessionId),
                    // so we call the API directly for restart
                    liveViewAPI.startSession(warehouseId, pageType)
                        .then(res => {
                            if (res.data.success && res.data.sessionId) {
                                setSessionId(res.data.sessionId);
                                setIsActive(true);
                                setLastSync(new Date());
                            }
                            isRestartingRef.current = false;
                        })
                        .catch(() => {
                            isRestartingRef.current = false;
                        });
                }
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [enabled, warehouseId, sessionId, pageType]);

    // End session on unmount
    useEffect(() => {
        return () => {
            if (sessionIdRef.current) {
                // Fire and forget - don't await on unmount
                liveViewAPI.endSession(sessionIdRef.current).catch(() => { });
            }
        };
    }, []); // Empty deps - only runs on unmount

    // Note: We don't use sendBeacon because the /end endpoint requires auth headers.
    // Sessions will auto-cleanup after inactivity via server-side cleanup.

    return {
        sessionId,
        isActive,
        lastSync,
        startSession,
        endSession,
        updateEntries,
        syncEntries, // Force immediate sync if needed
    };
}
