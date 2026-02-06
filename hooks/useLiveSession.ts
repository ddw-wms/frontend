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
            setSessionId(null);
            setIsActive(false);
            setLastSync(null);
            entriesRef.current = [];
        }
    }, [sessionId]);

    // Update entries (debounced)
    const updateEntries = useCallback((entries: LiveSessionEntry[]) => {
        if (!sessionId || !enabled) return;

        entriesRef.current = entries;
        pendingUpdateRef.current = true;
    }, [sessionId, enabled]);

    // Sync entries to server
    const syncEntries = useCallback(async () => {
        if (!sessionId || !pendingUpdateRef.current) return;

        try {
            await liveViewAPI.updateEntries(sessionId, entriesRef.current);
            setLastSync(new Date());
            pendingUpdateRef.current = false;
        } catch (error) {
            console.debug('Live entries sync skipped:', error);
        }
    }, [sessionId]);

    // Set up periodic sync
    useEffect(() => {
        if (sessionId && enabled) {
            updateTimerRef.current = setInterval(syncEntries, updateInterval);
        }

        return () => {
            if (updateTimerRef.current) {
                clearInterval(updateTimerRef.current);
            }
        };
    }, [sessionId, enabled, updateInterval, syncEntries]);

    // End session on unmount
    useEffect(() => {
        return () => {
            if (sessionId) {
                // Fire and forget - don't await on unmount
                liveViewAPI.endSession(sessionId).catch(() => { });
            }
        };
    }, [sessionId]);

    // Note: We don't use sendBeacon because the /end endpoint requires auth headers.
    // Sessions will auto-cleanup after 5 minutes of inactivity via server-side cleanup.

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
