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
    /** Called when multi-entry rows are synced from another device (same user) */
    onEntrySynced?: (data: { rows: Array<{ index: number; data: any }>; userId: number }) => void;
    /** Called when multi-entry header fields are synced from another device (same user) */
    onHeaderUpdated?: (data: { commonDate?: string; selectedCustomer?: string; commonVehicle?: string; userId: number }) => void;
}

export function useRealtimeSync({
    page,
    warehouseId,
    enabled = true,
    onDataSubmitted,
    onDraftUpdated,
    onDraftCleared,
    onEntrySynced,
    onHeaderUpdated,
}: RealtimeSyncOptions) {
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptRef = useRef(0);
    const isConnectedRef = useRef(false);

    // Store callbacks in refs so reconnect doesn't stale-close over old values
    const onDataSubmittedRef = useRef(onDataSubmitted);
    const onDraftUpdatedRef = useRef(onDraftUpdated);
    const onDraftClearedRef = useRef(onDraftCleared);
    const onEntrySyncedRef = useRef(onEntrySynced);
    const onHeaderUpdatedRef = useRef(onHeaderUpdated);

    useEffect(() => { onDataSubmittedRef.current = onDataSubmitted; }, [onDataSubmitted]);
    useEffect(() => { onDraftUpdatedRef.current = onDraftUpdated; }, [onDraftUpdated]);
    useEffect(() => { onDraftClearedRef.current = onDraftCleared; }, [onDraftCleared]);
    useEffect(() => { onEntrySyncedRef.current = onEntrySynced; }, [onEntrySynced]);
    useEffect(() => { onHeaderUpdatedRef.current = onHeaderUpdated; }, [onHeaderUpdated]);

    const connect = useCallback(async () => {
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

        // Try ticket exchange first (keeps JWT out of URL/logs), fall back to token
        let authParam: string;
        try {
            const resp = await fetch(`${API_URL}/events/ticket`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            });
            if (resp.ok) {
                const { ticket } = await resp.json();
                authParam = `ticket=${encodeURIComponent(ticket)}`;
            } else {
                authParam = `token=${encodeURIComponent(token)}`;
            }
        } catch {
            authParam = `token=${encodeURIComponent(token)}`;
        }

        const url = `${API_URL}/events/subscribe?warehouseId=${warehouseId}&page=${page}&deviceId=${deviceId}&${authParam}`;

        try {
            const es = new EventSource(url);
            eventSourceRef.current = es;

            es.addEventListener('connected', () => {
                isConnectedRef.current = true;
                reconnectAttemptRef.current = 0; // Reset backoff on successful connect

            });

            es.addEventListener('data-submitted', (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);

                    onDataSubmittedRef.current?.(data);
                } catch { /* ignore parse errors */ }
            });

            es.addEventListener('draft-updated', (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);

                    onDraftUpdatedRef.current?.(data);
                } catch { /* ignore */ }
            });

            es.addEventListener('draft-cleared', (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);

                    onDraftClearedRef.current?.(data);
                } catch { /* ignore */ }
            });

            es.addEventListener('entry-synced', (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);

                    onEntrySyncedRef.current?.(data);
                } catch (e) { console.error('[SSE] Failed to parse entry-synced event:', e); }
            });

            es.addEventListener('header-updated', (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    onHeaderUpdatedRef.current?.(data);
                } catch (e) { console.error('[SSE] Failed to parse header-updated event:', e); }
            });

            es.addEventListener('ping', () => {
                // Heartbeat received — connection is alive
            });

            es.onerror = () => {
                isConnectedRef.current = false;
                es.close();
                eventSourceRef.current = null;

                // Exponential backoff with jitter: 1s → 2s → 4s → ... → 30s max
                const base = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
                const jitter = Math.random() * 1000;
                const delay = base + jitter;
                reconnectAttemptRef.current++;



                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, delay);
            };
        } catch (err) {

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
