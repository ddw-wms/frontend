// File Path = warehouse-frontend/hooks/useRealtimeSync.ts
// Real-time sync hook using Server-Sent Events (SSE)
// Connects to backend SSE endpoint for multi-device data synchronization
'use client';

import { useEffect, useRef, useCallback } from 'react';

const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

// Generate unique device ID per browser tab (persisted in sessionStorage)
const getDeviceId = (): string => {
    if (typeof window === 'undefined') return '';
    let deviceId = sessionStorage.getItem('wms_device_id');
    if (!deviceId) {
        deviceId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        sessionStorage.setItem('wms_device_id', deviceId);
    }
    return deviceId;
};

// Export for use in API calls (x-device-id header)
export const getSSEDeviceId = getDeviceId;

interface RealtimeSyncOptions {
    /** Page name: 'inbound' | 'qc' | 'picking' | 'outbound' */
    page: string;
    /** Active warehouse ID */
    warehouseId: number | undefined | null;
    /** Whether the hook is enabled (e.g., user is logged in) */
    enabled?: boolean;
    /** Called when data is submitted from another device */
    onDataSubmitted?: (data: {
        successCount: number;
        totalCount: number;
        batchId: string;
        submittedWSNs?: string[];
        submittedBy: string;
    }) => void;
    /** Called when draft is updated from another device */
    onDraftUpdated?: (data: { userId: number; rowCount: number }) => void;
    /** Called when draft is cleared from another device */
    onDraftCleared?: (data: { userId: number }) => void;
}

export function useRealtimeSync({
    page,
    warehouseId,
    enabled = true,
    onDataSubmitted,
    onDraftUpdated,
    onDraftCleared,
}: RealtimeSyncOptions) {
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptRef = useRef(0);
    const isConnectedRef = useRef(false);

    // Store callbacks in refs so reconnect doesn't stale-close over old values
    const onDataSubmittedRef = useRef(onDataSubmitted);
    const onDraftUpdatedRef = useRef(onDraftUpdated);
    const onDraftClearedRef = useRef(onDraftCleared);

    useEffect(() => { onDataSubmittedRef.current = onDataSubmitted; }, [onDataSubmitted]);
    useEffect(() => { onDraftUpdatedRef.current = onDraftUpdated; }, [onDraftUpdated]);
    useEffect(() => { onDraftClearedRef.current = onDraftCleared; }, [onDraftCleared]);

    const connect = useCallback(() => {
        if (typeof window === 'undefined') return;
        if (!warehouseId || !enabled) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        const deviceId = getDeviceId();

        // Close existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        // Build SSE URL with auth token as query param (EventSource doesn't support headers)
        // We pass token as query param since EventSource API doesn't support custom headers
        const url = `${API_URL}/events/subscribe?warehouseId=${warehouseId}&page=${page}&deviceId=${deviceId}&token=${encodeURIComponent(token)}`;

        try {
            const es = new EventSource(url);
            eventSourceRef.current = es;

            es.addEventListener('connected', () => {
                isConnectedRef.current = true;
                reconnectAttemptRef.current = 0; // Reset backoff on successful connect
                console.log(`[SSE] ✅ Connected: ${page} warehouse=${warehouseId}`);
            });

            es.addEventListener('data-submitted', (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log(`[SSE] 📡 Data submitted from another device:`, data);
                    onDataSubmittedRef.current?.(data);
                } catch { /* ignore parse errors */ }
            });

            es.addEventListener('draft-updated', (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log(`[SSE] 📝 Draft updated from another device:`, data);
                    onDraftUpdatedRef.current?.(data);
                } catch { /* ignore */ }
            });

            es.addEventListener('draft-cleared', (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log(`[SSE] 🗑️ Draft cleared from another device:`, data);
                    onDraftClearedRef.current?.(data);
                } catch { /* ignore */ }
            });

            es.addEventListener('ping', () => {
                // Heartbeat received — connection is alive
            });

            es.onerror = () => {
                isConnectedRef.current = false;
                es.close();
                eventSourceRef.current = null;

                // Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s max
                const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
                reconnectAttemptRef.current++;

                console.log(`[SSE] ⚠️ Disconnected. Reconnecting in ${delay / 1000}s (attempt ${reconnectAttemptRef.current})...`);

                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, delay);
            };
        } catch (err) {
            console.warn('[SSE] Failed to create EventSource:', err);
        }
    }, [warehouseId, page, enabled]);

    // Connect/reconnect when deps change
    useEffect(() => {
        connect();

        return () => {
            // Cleanup on unmount or deps change
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            isConnectedRef.current = false;
        };
    }, [connect]);

    return {
        isConnected: isConnectedRef.current,
        deviceId: typeof window !== 'undefined' ? getDeviceId() : '',
    };
}
