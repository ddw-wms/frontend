/**
 * Outbound Available Inventory Cache using Dexie (IndexedDB)
 * 
 * Purpose: Cache ONLY available inventory WSNs for instant outbound lookups
 * - Available = Items in PICKING/QC/INBOUND that are NOT yet dispatched
 * - Does NOT cache already dispatched items or master_data
 * - Subsequent lookups: Instant from local cache
 * - Works offline for cached WSNs
 */

import Dexie, { Table } from 'dexie';
import { outboundAPI } from './api';

// Available inventory record interface
export interface AvailableInventoryRecord {
    wsn: string;  // Primary key
    source: 'PICKING' | 'QC' | 'INBOUND';
    wid?: string;
    fsn?: string;
    order_id?: string;
    product_title?: string;
    brand?: string;
    mrp?: number | string;
    fsp?: number | string;
    hsn_sac?: string;
    igst_rate?: number;
    cms_vertical?: string;
    fkt_link?: string;
    p_type?: string;
    p_size?: string;
    vrp?: number;
    yield_value?: number;
    fk_grade?: string;
    fkqc_remark?: string;
    wh_location?: string;
    invoice_date?: string;
    quantity?: number;
    rack_no?: string;
    picked_date?: string;
    qc_date?: string;
    inbound_date?: string;
    customer_name?: string;
    vehicle_no?: string;
    cached_at?: number;
    warehouse_id?: number;
    [key: string]: any;
}

// Cache metadata interface
export interface CacheMetadata {
    key: string;
    value: any;
}

// Define the database
class OutboundCacheDB extends Dexie {
    availableInventory!: Table<AvailableInventoryRecord>;
    metadata!: Table<CacheMetadata>;

    constructor() {
        super('WMSOutboundCache');
        this.version(1).stores({
            availableInventory: 'wsn, source, brand, product_title, warehouse_id',
            metadata: 'key'
        });
    }
}

// Singleton database instance
let db: OutboundCacheDB | null = null;

function getDB(): OutboundCacheDB {
    if (!db) {
        db = new OutboundCacheDB();
    }
    return db;
}

// Cache configuration
const CACHE_CONFIG = {
    STALE_THRESHOLD_MS: 24 * 60 * 60 * 1000,  // 24 hours (auto-refresh keeps data fresh)
    AUTO_REFRESH_INTERVAL_MS: 30 * 60 * 1000,  // 30 minutes auto-refresh
    CHUNK_SIZE: 1000,  // Records per IndexedDB write
    YIELD_DELAY_MS: 10,  // Time to yield between chunks
    MEMORY_CACHE_ENABLED: true,  // Enable ultra-fast in-memory layer
};

// ======================== IN-MEMORY CACHE (ULTRA FAST) ========================

/**
 * In-memory Map for sub-millisecond WSN lookups
 * Populated from IndexedDB on page load
 */
let outboundMemoryMap: Map<string, AvailableInventoryRecord> | null = null;
let memoryWarehouseId: number | null = null;
let isMemoryWarmedUp = false;
let isMemoryWarming = false;
let warmupPromise: Promise<void> | null = null;

/**
 * Check if memory cache is ready for a warehouse
 */
export function isOutboundMemoryCacheReady(warehouseId: number): boolean {
    return isMemoryWarmedUp && memoryWarehouseId === warehouseId;
}

/**
 * Get memory cache stats
 */
export function getOutboundMemoryCacheStats(): {
    isWarmedUp: boolean;
    isWarming: boolean;
    warehouseId: number | null;
    count: number;
} {
    return {
        isWarmedUp: isMemoryWarmedUp,
        isWarming: isMemoryWarming,
        warehouseId: memoryWarehouseId,
        count: outboundMemoryMap?.size || 0,
    };
}

/**
 * Warm up in-memory cache from IndexedDB (background task)
 * Call this when entering Multi Entry tab
 */
export async function warmupOutboundMemoryCache(
    warehouseId: number,
    onProgress?: (message: string, count: number) => void
): Promise<void> {
    // If already warmed for this warehouse, skip
    if (isMemoryWarmedUp && memoryWarehouseId === warehouseId) {
        console.log('⚡ Outbound memory cache already warm');
        return;
    }

    // If currently warming, wait for it
    if (isMemoryWarming && warmupPromise) {
        console.log('⏳ Waiting for ongoing outbound warmup...');
        return warmupPromise;
    }

    isMemoryWarming = true;
    memoryWarehouseId = warehouseId;

    warmupPromise = (async () => {
        try {
            const database = getDB();
            const startTime = performance.now();

            if (onProgress) onProgress('Loading available inventory...', 0);

            // Load all available inventory for this warehouse into Map
            const records = await database.availableInventory
                .where('warehouse_id')
                .equals(warehouseId)
                .toArray();

            outboundMemoryMap = new Map(records.map(r => [r.wsn, r]));

            const elapsed = Math.round(performance.now() - startTime);
            isMemoryWarmedUp = true;

            console.log(`⚡ Outbound memory cache warmed in ${elapsed}ms: ${outboundMemoryMap.size} records`);

            if (onProgress) {
                onProgress(`Ready! (${elapsed}ms)`, outboundMemoryMap.size);
            }
        } catch (error) {
            console.error('❌ Outbound memory warmup failed:', error);
            // Reset state on error
            outboundMemoryMap = null;
            isMemoryWarmedUp = false;
        } finally {
            isMemoryWarming = false;
            warmupPromise = null;
        }
    })();

    return warmupPromise;
}

/**
 * Clear memory cache (call on warehouse change or page unmount)
 */
export function clearOutboundMemoryCache(): void {
    outboundMemoryMap = null;
    memoryWarehouseId = null;
    isMemoryWarmedUp = false;
    isMemoryWarming = false;
    warmupPromise = null;
    console.log('🗑️ Outbound memory cache cleared');
}

/**
 * ULTRA FAST - Get available inventory by WSN
 * Tier 1: Memory Map (sync, ~0.001ms)
 * Tier 2: IndexedDB (async, 1-5ms)
 * Tier 3: API (async, 100-500ms)
 */
export async function getAvailableInventoryByWSNFast(
    wsn: string,
    warehouseId: number
): Promise<AvailableInventoryRecord | null> {
    if (!wsn || !warehouseId) return null;

    const normalizedWSN = wsn.trim().toUpperCase();

    // TIER 1: Memory Map (INSTANT - sub-millisecond)
    // No stale check — auto-refresh keeps data fresh in background
    if (CACHE_CONFIG.MEMORY_CACHE_ENABLED && isMemoryWarmedUp && outboundMemoryMap && memoryWarehouseId === warehouseId) {
        const cached = outboundMemoryMap.get(normalizedWSN);
        if (cached) {
            console.log(`⚡ Outbound Memory HIT: ${normalizedWSN}`);
            return cached;
        }
    }

    // TIER 2 & 3: IndexedDB + API fallback (existing function)
    const result = await getAvailableInventoryByWSN(wsn, warehouseId);

    // If found, add to memory Map for future lookups
    if (result && outboundMemoryMap && memoryWarehouseId === warehouseId) {
        outboundMemoryMap.set(normalizedWSN, result);
    }

    return result;
}

/**
 * Update item in memory cache
 */
export function updateOutboundMemoryCache(wsn: string, data: AvailableInventoryRecord): void {
    if (!outboundMemoryMap || !wsn) return;
    const normalizedWSN = wsn.trim().toUpperCase();
    outboundMemoryMap.set(normalizedWSN, { ...data, wsn: normalizedWSN, cached_at: Date.now() });
}

/**
 * Remove item from memory cache
 */
export function removeFromOutboundMemoryCache(wsn: string): void {
    if (!outboundMemoryMap || !wsn) return;
    const normalizedWSN = wsn.trim().toUpperCase();
    outboundMemoryMap.delete(normalizedWSN);
}

/**
 * Get available inventory by WSN - LOCAL FIRST, then API fallback
 * This is the main function to use for WSN lookups in outbound
 */
export async function getAvailableInventoryByWSN(
    wsn: string,
    warehouseId: number
): Promise<AvailableInventoryRecord | null> {
    if (!wsn || !warehouseId) return null;

    const normalizedWSN = wsn.trim().toUpperCase();

    try {
        const database = getDB();

        // 1. Try local cache first (INSTANT)
        // No stale check — auto-refresh keeps data fresh in background
        const cached = await database.availableInventory
            .where('wsn')
            .equals(normalizedWSN)
            .and(item => item.warehouse_id === warehouseId)
            .first();

        if (cached) {
            console.log(`✅ Outbound Cache HIT for WSN: ${normalizedWSN}`);
            return cached;
        }

        return null;
    } catch (error: any) {
        // If error is 409 (already dispatched) or 404 (not found), remove from cache
        if (error?.response?.status === 409 || error?.response?.status === 404) {
            try {
                const database = getDB();
                await database.availableInventory.delete(normalizedWSN);
                console.log(`🗑️ Removed WSN from cache (dispatched/not found): ${normalizedWSN}`);
            } catch (e) {
                // Ignore cache errors
            }
        }

        // Return cached data if API fails (even if stale)
        try {
            const database = getDB();
            const cached = await database.availableInventory.get(normalizedWSN);
            if (cached && cached.warehouse_id === warehouseId) {
                console.log(`⚠️ API failed, using stale cache for WSN: ${normalizedWSN}`);
                return cached;
            }
        } catch (e) {
            // Ignore cache errors
        }

        // Re-throw the original error for the caller to handle
        throw error;
    }
}

/**
 * Bulk lookup multiple WSNs at once
 */
export async function getAvailableInventoryBulk(
    wsns: string[],
    warehouseId: number
): Promise<Map<string, AvailableInventoryRecord>> {
    const result = new Map<string, AvailableInventoryRecord>();
    if (!wsns || wsns.length === 0 || !warehouseId) return result;

    const normalizedWSNs = wsns.map(w => w.trim().toUpperCase()).filter(Boolean);
    const uniqueWSNs = Array.from(new Set(normalizedWSNs));

    try {
        const database = getDB();

        // Get all from local cache
        const cached = await database.availableInventory
            .where('wsn')
            .anyOf(uniqueWSNs)
            .and(item => item.warehouse_id === warehouseId)
            .toArray();

        cached.forEach(record => {
            result.set(record.wsn, record);
        });

        console.log(`📦 Outbound bulk lookup: ${cached.length}/${uniqueWSNs.length} found in cache`);

        return result;
    } catch (error) {
        console.error('❌ Bulk lookup failed:', error);
        return result;
    }
}

/**
 * Get cache statistics
 */
export async function getOutboundCacheStats(warehouseId?: number): Promise<{
    totalRecords: number;
    lastSyncTime: number | null;
    isReady: boolean;
    bySource: { picking: number; qc: number; inbound: number };
}> {
    try {
        const database = getDB();

        let collection = database.availableInventory.toCollection();
        if (warehouseId) {
            collection = database.availableInventory.where('warehouse_id').equals(warehouseId);
        }

        const allRecords = await collection.toArray();
        const totalRecords = allRecords.length;

        const metaRecord = await database.metadata.get('lastSync');
        const lastSyncTime = metaRecord?.value || null;

        // Count by source
        const bySource = {
            picking: allRecords.filter(r => r.source === 'PICKING').length,
            qc: allRecords.filter(r => r.source === 'QC').length,
            inbound: allRecords.filter(r => r.source === 'INBOUND').length,
        };

        return {
            totalRecords,
            lastSyncTime,
            isReady: totalRecords > 0,
            bySource
        };
    } catch (error) {
        return {
            totalRecords: 0,
            lastSyncTime: null,
            isReady: false,
            bySource: { picking: 0, qc: 0, inbound: 0 }
        };
    }
}

/**
 * Load available inventory for a warehouse
 * Only loads items that can be dispatched (PICKING/QC/INBOUND not yet in outbound)
 */
export async function loadAvailableInventory(
    warehouseId: number,
    onProgress?: (loaded: number, total: number, message: string) => void
): Promise<{ success: boolean; count: number }> {
    if (!warehouseId) {
        return { success: false, count: 0 };
    }

    try {
        const database = getDB();
        console.log(`🔄 Loading available inventory for warehouse ${warehouseId}...`);
        if (onProgress) onProgress(0, 1, 'Loading available inventory...');

        // Fetch available inventory from API
        const response = await outboundAPI.getAvailableForOutbound(warehouseId);
        const records = response?.data || [];
        const totalCount = records.length;

        console.log(`📊 Received ${totalCount.toLocaleString()} available inventory records`);

        if (totalCount === 0) {
            if (onProgress) onProgress(0, 0, 'No available inventory found');
            return { success: true, count: 0 };
        }

        // Clear existing cache for this warehouse
        await database.availableInventory
            .where('warehouse_id')
            .equals(warehouseId)
            .delete();

        // Add cached_at timestamp and warehouse_id to all records
        const recordsWithTimestamp = records.map((r: any) => ({
            ...r,
            wsn: r.wsn?.toUpperCase() || '',
            warehouse_id: warehouseId,
            cached_at: Date.now()
        }));

        // Chunked write for better performance
        let loaded = 0;
        for (let i = 0; i < recordsWithTimestamp.length; i += CACHE_CONFIG.CHUNK_SIZE) {
            const chunk = recordsWithTimestamp.slice(i, i + CACHE_CONFIG.CHUNK_SIZE);
            await database.availableInventory.bulkPut(chunk);
            loaded += chunk.length;

            if (onProgress) {
                onProgress(loaded, totalCount, `Caching ${loaded.toLocaleString()}/${totalCount.toLocaleString()}...`);
            }

            // Yield to main thread
            await new Promise(resolve => setTimeout(resolve, CACHE_CONFIG.YIELD_DELAY_MS));
        }

        // Update last sync time
        await database.metadata.put({ key: 'lastSync', value: Date.now() });
        await database.metadata.put({ key: `lastSync_${warehouseId}`, value: Date.now() });

        console.log(`✅ Available inventory cache complete! ${loaded.toLocaleString()} records cached.`);
        if (onProgress) onProgress(loaded, totalCount, 'Cache ready!');

        return { success: true, count: loaded };
    } catch (error) {
        console.error('❌ Failed to load available inventory:', error);
        if (onProgress) onProgress(0, 0, 'Failed to load cache');
        return { success: false, count: 0 };
    }
}

/**
 * Remove a WSN from cache (after dispatch)
 */
export async function removeFromCache(wsn: string): Promise<void> {
    if (!wsn) return;

    try {
        const database = getDB();
        const normalizedWSN = wsn.trim().toUpperCase();
        await database.availableInventory.delete(normalizedWSN);
        console.log(`🗑️ Removed from outbound cache: ${normalizedWSN}`);
    } catch (error) {
        console.error('❌ Failed to remove from cache:', error);
    }
}

/**
 * Clear all cached data for a warehouse
 */
export async function clearOutboundCache(warehouseId?: number): Promise<void> {
    try {
        const database = getDB();

        if (warehouseId) {
            await database.availableInventory
                .where('warehouse_id')
                .equals(warehouseId)
                .delete();
            console.log(`🗑️ Outbound cache cleared for warehouse ${warehouseId}`);
        } else {
            await database.availableInventory.clear();
            await database.metadata.clear();
            console.log('🗑️ All outbound cache cleared');
        }
    } catch (error) {
        console.error('❌ Failed to clear outbound cache:', error);
    }
}

/**
 * Check if cache needs refresh
 */
export async function needsCacheRefresh(warehouseId: number): Promise<boolean> {
    try {
        const database = getDB();
        const metaRecord = await database.metadata.get(`lastSync_${warehouseId}`);

        if (!metaRecord?.value) return true;

        const timeSinceSync = Date.now() - metaRecord.value;
        return timeSinceSync > CACHE_CONFIG.STALE_THRESHOLD_MS;
    } catch (error) {
        return true;
    }
}

// ======================== AUTO-REFRESH (BACKGROUND) ========================

let outboundAutoRefreshTimer: ReturnType<typeof setInterval> | null = null;
let isOutboundRefreshing = false;

/**
 * Silent background refresh of outbound available inventory cache
 * No UI feedback, chunked writes, mutex, offline-safe
 */
export async function silentRefreshOutboundCache(
    warehouseId: number
): Promise<boolean> {
    if (isOutboundRefreshing) {
        console.log('🔄 Outbound refresh already in progress, skipping...');
        return false;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.log('📴 Offline — skipping outbound cache refresh');
        return false;
    }

    isOutboundRefreshing = true;
    try {
        const database = getDB();
        console.log(`🔄 Silent refreshing outbound cache for warehouse ${warehouseId}...`);

        const response = await outboundAPI.getAvailableForOutbound(warehouseId);
        const records = response?.data || [];
        const totalCount = records.length;

        if (totalCount === 0) {
            console.log('🔄 Silent outbound refresh: no records found');
            return true;
        }

        // Clear existing and re-insert (atomic refresh)
        await database.availableInventory
            .where('warehouse_id')
            .equals(warehouseId)
            .delete();

        const recordsWithMeta = records.map((r: any) => ({
            ...r,
            wsn: (r.wsn || '').toUpperCase(),
            warehouse_id: warehouseId,
            cached_at: Date.now()
        }));

        for (let i = 0; i < recordsWithMeta.length; i += CACHE_CONFIG.CHUNK_SIZE) {
            const chunk = recordsWithMeta.slice(i, i + CACHE_CONFIG.CHUNK_SIZE);
            await database.availableInventory.bulkPut(chunk);
            await new Promise(resolve => setTimeout(resolve, CACHE_CONFIG.YIELD_DELAY_MS));
        }

        await database.metadata.put({ key: 'lastSync', value: Date.now() });
        await database.metadata.put({ key: `lastSync_${warehouseId}`, value: Date.now() });

        // Re-warm memory map from fresh data
        if (CACHE_CONFIG.MEMORY_CACHE_ENABLED) {
            outboundMemoryMap = new Map(recordsWithMeta.map((r: any) => [r.wsn, r]));
            memoryWarehouseId = warehouseId;
            isMemoryWarmedUp = true;
        }

        console.log(`✅ Silent outbound refresh complete: ${totalCount.toLocaleString()} records`);
        return true;
    } catch (error) {
        console.error('❌ Silent outbound refresh failed:', error);
        return false;
    } finally {
        isOutboundRefreshing = false;
    }
}

/**
 * Start auto-refresh timer for outbound cache
 * Refreshes every 30 minutes while multi-entry tab is active
 */
export function startOutboundAutoRefresh(
    warehouseId: number,
    intervalMs?: number
): () => void {
    stopOutboundAutoRefresh();

    const interval = intervalMs || CACHE_CONFIG.AUTO_REFRESH_INTERVAL_MS;

    console.log(`⏰ Outbound auto-refresh started: every ${Math.round(interval / 60000)} minutes for warehouse ${warehouseId}`);

    outboundAutoRefreshTimer = setInterval(() => {
        silentRefreshOutboundCache(warehouseId).catch(err => {
            console.warn('Outbound auto-refresh error (will retry):', err);
        });
    }, interval);

    return () => stopOutboundAutoRefresh();
}

/**
 * Stop outbound auto-refresh timer
 */
export function stopOutboundAutoRefresh(): void {
    if (outboundAutoRefreshTimer) {
        clearInterval(outboundAutoRefreshTimer);
        outboundAutoRefreshTimer = null;
        console.log('⏰ Outbound auto-refresh stopped');
    }
}

// Export the database for direct access if needed
export { getDB };
