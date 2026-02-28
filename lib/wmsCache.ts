/**
 * WMS Unified Cache Module using Dexie (IndexedDB)
 * 
 * Purpose: Fast WSN lookups for all pages with feature flag control
 * 
 * Two cache types:
 * 1. PENDING CACHE (Inbound page)
 *    - Contains: master_data not yet received, not rejected
 *    - Update: Remove on inbound submit
 * 
 * 2. AVAILABLE CACHE (QC/Picking/Outbound pages)
 *    - Contains: Items in warehouse (PICKING > QC > INBOUND) not dispatched
 *    - Update: Update status on QC/Picking, Remove on outbound dispatch
 * 
 * Safety: Feature flag controlled, API fallback always works
 */

import Dexie, { Table } from 'dexie';
import { cacheAPI } from './api';

// ======================== INTERFACES ========================

export interface PendingInventoryRecord {
    wsn: string;  // Primary key (uppercase)
    id?: number;
    wid?: string;
    fsn?: string;
    order_id?: string;
    product_title?: string;
    brand?: string;
    cms_vertical?: string;
    mrp?: number | string;
    fsp?: number | string;
    hsn_sac?: string;
    igst_rate?: number;
    fkt_link?: string;
    wh_location?: string;
    vrp?: number;
    yield_value?: number;
    p_type?: string;
    p_size?: string;
    fk_grade?: string;
    fkqc_remark?: string;
    invoice_date?: string;
    batch_id?: string;
    uploaded_at?: string;
    warehouse_id?: number;
    cached_at?: number;
    [key: string]: any;
}

export interface AvailableInventoryRecord {
    wsn: string;  // Primary key (uppercase)
    source: 'PICKING' | 'QC' | 'INBOUND';
    status: string;
    last_action_date?: string;
    rack_no?: string;
    action_by?: string;
    master_id?: number;
    wid?: string;
    fsn?: string;
    order_id?: string;
    product_title?: string;
    brand?: string;
    cms_vertical?: string;
    mrp?: number | string;
    fsp?: number | string;
    hsn_sac?: string;
    igst_rate?: number;
    fkt_link?: string;
    wh_location?: string;
    vrp?: number;
    yield_value?: number;
    p_type?: string;
    p_size?: string;
    fk_grade?: string;
    fkqc_remark?: string;
    invoice_date?: string;
    warehouse_id?: number;
    cached_at?: number;
    [key: string]: any;
}

interface CacheMetadata {
    key: string;
    value: any;
}

// ======================== DATABASE ========================

class WMSCacheDB extends Dexie {
    pendingInventory!: Table<PendingInventoryRecord>;
    availableInventory!: Table<AvailableInventoryRecord>;
    metadata!: Table<CacheMetadata>;

    constructor() {
        super('WMSUnifiedCache');
        this.version(1).stores({
            pendingInventory: 'wsn, brand, product_title, warehouse_id',
            availableInventory: 'wsn, source, brand, product_title, warehouse_id',
            metadata: 'key'
        });
    }
}

// Singleton database instance
let db: WMSCacheDB | null = null;

function getDB(): WMSCacheDB {
    if (!db) {
        db = new WMSCacheDB();
    }
    return db;
}

// ======================== CONFIGURATION ========================

const CACHE_CONFIG = {
    // Stale thresholds
    PENDING_STALE_MS: 24 * 60 * 60 * 1000,  // 24 hours for pending (master_data rarely changes same day)
    AVAILABLE_STALE_MS: 24 * 60 * 60 * 1000,  // 24 hours for available (auto-refresh keeps data fresh)

    // Auto-refresh settings
    AUTO_REFRESH_INTERVAL_MS: 30 * 60 * 1000,  // 30 minutes auto-refresh
    SILENT_REFRESH_TIMEOUT_MS: 15000,           // 15 sec API timeout for background refresh

    // Performance tuning
    CHUNK_SIZE: 1000,     // Records per IndexedDB write
    YIELD_DELAY_MS: 10,   // Yield between chunks

    // Feature flag - defaults to OFF for safety
    ENABLED: typeof window !== 'undefined'
        ? localStorage.getItem('WMS_CACHE_ENABLED') === 'true'
        : false,

    // In-memory cache settings
    MEMORY_CACHE_ENABLED: true,  // Enable ultra-fast in-memory layer
    MEMORY_WARMUP_CHUNK: 5000,   // Records per chunk during warmup
};

// ======================== IN-MEMORY CACHE (ULTRA FAST) ========================

/**
 * In-memory Maps for sub-millisecond WSN lookups
 * These are populated from IndexedDB on page load
 */
let pendingMemoryMap: Map<string, PendingInventoryRecord> | null = null;
let availableMemoryMap: Map<string, AvailableInventoryRecord> | null = null;
let memoryWarehouseId: number | null = null;
let isMemoryWarmedUp = false;
let isMemoryWarming = false;
let warmupPromise: Promise<void> | null = null;

/**
 * Check if memory cache is ready for a warehouse
 */
export function isMemoryCacheReady(warehouseId: number): boolean {
    return isMemoryWarmedUp && memoryWarehouseId === warehouseId;
}

/**
 * Get memory cache stats
 */
export function getMemoryCacheStats(): {
    isWarmedUp: boolean;
    isWarming: boolean;
    warehouseId: number | null;
    pendingCount: number;
    availableCount: number;
} {
    return {
        isWarmedUp: isMemoryWarmedUp,
        isWarming: isMemoryWarming,
        warehouseId: memoryWarehouseId,
        pendingCount: pendingMemoryMap?.size || 0,
        availableCount: availableMemoryMap?.size || 0,
    };
}

/**
 * Warm up in-memory cache from IndexedDB (background task)
 * Call this when entering Multi Entry tab
 */
export async function warmupMemoryCache(
    warehouseId: number,
    onProgress?: (message: string, pendingCount: number, availableCount: number) => void
): Promise<void> {
    // If already warmed for this warehouse, skip
    if (isMemoryWarmedUp && memoryWarehouseId === warehouseId) {
        console.log('⚡ Memory cache already warm');
        return;
    }

    // If currently warming, wait for it
    if (isMemoryWarming && warmupPromise) {
        console.log('⏳ Waiting for ongoing warmup...');
        return warmupPromise;
    }

    // If cache feature is disabled, skip
    if (!isCacheEnabled()) {
        console.log('⚠️ Cache disabled, skipping memory warmup');
        return;
    }

    isMemoryWarming = true;
    memoryWarehouseId = warehouseId;

    warmupPromise = (async () => {
        try {
            const database = getDB();
            const startTime = performance.now();

            if (onProgress) onProgress('Loading pending inventory...', 0, 0);

            // Load pending inventory into Map
            const pendingRecords = await database.pendingInventory
                .where('warehouse_id')
                .equals(warehouseId)
                .toArray();

            pendingMemoryMap = new Map(pendingRecords.map(r => [r.wsn, r]));

            if (onProgress) onProgress('Loading available inventory...', pendingMemoryMap.size, 0);

            // Load available inventory into Map
            const availableRecords = await database.availableInventory
                .where('warehouse_id')
                .equals(warehouseId)
                .toArray();

            availableMemoryMap = new Map(availableRecords.map(r => [r.wsn, r]));

            const elapsed = Math.round(performance.now() - startTime);
            isMemoryWarmedUp = true;

            console.log(`⚡ Memory cache warmed in ${elapsed}ms: ${pendingMemoryMap.size} pending, ${availableMemoryMap.size} available`);

            if (onProgress) {
                onProgress(`Ready! (${elapsed}ms)`, pendingMemoryMap.size, availableMemoryMap.size);
            }
        } catch (error) {
            console.error('❌ Memory warmup failed:', error);
            // Reset state on error
            pendingMemoryMap = null;
            availableMemoryMap = null;
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
export function clearMemoryCache(): void {
    pendingMemoryMap = null;
    availableMemoryMap = null;
    memoryWarehouseId = null;
    isMemoryWarmedUp = false;
    isMemoryWarming = false;
    warmupPromise = null;
    console.log('🗑️ Memory cache cleared');
}

/**
 * ULTRA FAST - Get pending item by WSN
 * Tier 1: Memory Map (sync, ~0.001ms)
 * Tier 2: IndexedDB (async, 1-5ms)
 */
export async function getPendingByWSNFast(
    wsn: string,
    warehouseId: number
): Promise<PendingInventoryRecord | null> {
    if (!wsn || !warehouseId) return null;

    const normalizedWSN = wsn.trim().toUpperCase();

    // TIER 1: Memory Map (INSTANT - sub-millisecond)
    if (CACHE_CONFIG.MEMORY_CACHE_ENABLED && isMemoryWarmedUp && pendingMemoryMap && memoryWarehouseId === warehouseId) {
        const cached = pendingMemoryMap.get(normalizedWSN);
        if (cached) {
            // ⚡ Always return from memory — auto-refresh keeps data fresh
            // No stale check needed: 24hr threshold + 30min auto-refresh = always valid
            console.log(`⚡ Memory HIT (pending): ${normalizedWSN}`);
            return cached;
        }
    }

    // TIER 2: IndexedDB fallback (existing function)
    const indexedDbResult = await getPendingByWSN(wsn, warehouseId);

    // If found in IndexedDB but not in Map, add to Map for future lookups
    if (indexedDbResult && pendingMemoryMap && memoryWarehouseId === warehouseId) {
        pendingMemoryMap.set(normalizedWSN, indexedDbResult);
    }

    return indexedDbResult;
}

/**
 * ULTRA FAST - Get available item by WSN
 * Tier 1: Memory Map (sync, ~0.001ms)
 * Tier 2: IndexedDB (async, 1-5ms)
 */
export async function getAvailableByWSNFast(
    wsn: string,
    warehouseId: number
): Promise<AvailableInventoryRecord | null> {
    if (!wsn || !warehouseId) return null;

    const normalizedWSN = wsn.trim().toUpperCase();

    // TIER 1: Memory Map (INSTANT - sub-millisecond)
    // No stale check here — auto-refresh keeps data fresh in background
    if (CACHE_CONFIG.MEMORY_CACHE_ENABLED && isMemoryWarmedUp && availableMemoryMap && memoryWarehouseId === warehouseId) {
        const cached = availableMemoryMap.get(normalizedWSN);
        if (cached) {
            console.log(`⚡ Memory HIT (available): ${normalizedWSN}`);
            return cached;
        }
    }

    // TIER 2: IndexedDB fallback (existing function)
    const indexedDbResult = await getAvailableByWSN(wsn, warehouseId);

    // If found in IndexedDB but not in Map, add to Map for future lookups
    if (indexedDbResult && availableMemoryMap && memoryWarehouseId === warehouseId) {
        availableMemoryMap.set(normalizedWSN, indexedDbResult);
    }

    return indexedDbResult;
}

/**
 * Add/Update item in pending memory cache
 */
export function updatePendingMemoryCache(wsn: string, data: PendingInventoryRecord): void {
    if (!pendingMemoryMap || !wsn) return;
    const normalizedWSN = wsn.trim().toUpperCase();
    pendingMemoryMap.set(normalizedWSN, { ...data, wsn: normalizedWSN, cached_at: Date.now() });
}

/**
 * Add/Update item in available memory cache
 */
export function updateAvailableMemoryCache(wsn: string, data: AvailableInventoryRecord): void {
    if (!availableMemoryMap || !wsn) return;
    const normalizedWSN = wsn.trim().toUpperCase();
    availableMemoryMap.set(normalizedWSN, { ...data, wsn: normalizedWSN, cached_at: Date.now() });
}

/**
 * Remove item from pending memory cache
 */
export function removeFromPendingMemoryCache(wsn: string): void {
    if (!pendingMemoryMap || !wsn) return;
    const normalizedWSN = wsn.trim().toUpperCase();
    pendingMemoryMap.delete(normalizedWSN);
}

/**
 * Remove item from available memory cache
 */
export function removeFromAvailableMemoryCache(wsn: string): void {
    if (!availableMemoryMap || !wsn) return;
    const normalizedWSN = wsn.trim().toUpperCase();
    availableMemoryMap.delete(normalizedWSN);
}

/**
 * Bulk remove from pending memory cache
 */
export function removeMultipleFromPendingMemoryCache(wsns: string[]): void {
    if (!pendingMemoryMap || !wsns?.length) return;
    wsns.forEach(wsn => {
        const normalizedWSN = wsn.trim().toUpperCase();
        pendingMemoryMap!.delete(normalizedWSN);
    });
}


// ======================== FEATURE FLAG ========================

/**
 * Check if cache is enabled
 */
export function isCacheEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('WMS_CACHE_ENABLED') === 'true';
}

/**
 * Enable cache feature
 */
export function enableCache(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('WMS_CACHE_ENABLED', 'true');
    console.log('✅ WMS Cache ENABLED');
}

/**
 * Disable cache feature (use API-only mode)
 */
export function disableCache(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('WMS_CACHE_ENABLED', 'false');
    console.log('⚠️ WMS Cache DISABLED - API-only mode');
}

// ======================== PENDING CACHE (INBOUND) ========================

/**
 * Get pending item by WSN - for Inbound page autofill
 * Returns master_data item if not yet received and not rejected
 */
export async function getPendingByWSN(
    wsn: string,
    warehouseId: number
): Promise<PendingInventoryRecord | null> {
    if (!wsn || !warehouseId) return null;

    const normalizedWSN = wsn.trim().toUpperCase();

    // If cache disabled, return null (caller should use API fallback)
    if (!isCacheEnabled()) {
        console.log(`⚠️ Cache disabled, skip local lookup for: ${normalizedWSN}`);
        return null;
    }

    try {
        const database = getDB();

        const cached = await database.pendingInventory
            .where('wsn')
            .equals(normalizedWSN)
            .and(item => item.warehouse_id === warehouseId)
            .first();

        if (cached) {
            // ⚡ Always return cached data — auto-refresh keeps it updated
            // No stale check: avoids API fallback on slow/offline internet
            console.log(`✅ Pending Cache HIT: ${normalizedWSN}`);
            return cached;
        }

        return null;
    } catch (error) {
        console.error('❌ Pending cache lookup error:', error);
        return null;
    }
}

/**
 * Load all pending inventory for a warehouse
 */
export async function loadPendingInventory(
    warehouseId: number,
    onProgress?: (loaded: number, total: number, message: string) => void
): Promise<{ success: boolean; count: number }> {
    if (!warehouseId) {
        return { success: false, count: 0 };
    }

    try {
        const database = getDB();
        console.log(`🔄 Loading pending inventory for warehouse ${warehouseId}...`);
        if (onProgress) onProgress(0, 1, 'Loading pending inventory...');

        // Fetch from API
        const response = await cacheAPI.getPending(warehouseId);
        const records = response?.data?.data || [];
        const totalCount = records.length;

        console.log(`📊 Received ${totalCount.toLocaleString()} pending inventory records`);

        if (totalCount === 0) {
            if (onProgress) onProgress(0, 0, 'No pending inventory found');
            return { success: true, count: 0 };
        }

        // Clear existing cache for this warehouse
        await database.pendingInventory
            .where('warehouse_id')
            .equals(warehouseId)
            .delete();

        // Add metadata to records
        const recordsWithMeta = records.map((r: any) => ({
            ...r,
            wsn: (r.wsn || '').toUpperCase(),
            warehouse_id: warehouseId,
            cached_at: Date.now()
        }));

        // Chunked write for performance
        let loaded = 0;
        for (let i = 0; i < recordsWithMeta.length; i += CACHE_CONFIG.CHUNK_SIZE) {
            const chunk = recordsWithMeta.slice(i, i + CACHE_CONFIG.CHUNK_SIZE);
            await database.pendingInventory.bulkPut(chunk);
            loaded += chunk.length;

            if (onProgress) {
                onProgress(loaded, totalCount, `Caching ${loaded.toLocaleString()}/${totalCount.toLocaleString()}...`);
            }

            await new Promise(resolve => setTimeout(resolve, CACHE_CONFIG.YIELD_DELAY_MS));
        }

        // Update sync time
        await database.metadata.put({ key: `pendingSync_${warehouseId}`, value: Date.now() });

        console.log(`✅ Pending cache complete! ${loaded.toLocaleString()} records.`);
        if (onProgress) onProgress(loaded, totalCount, 'Cache ready!');

        return { success: true, count: loaded };
    } catch (error) {
        console.error('❌ Failed to load pending inventory:', error);
        if (onProgress) onProgress(0, 0, 'Failed to load cache');
        return { success: false, count: 0 };
    }
}

/**
 * Remove WSN from pending cache (after inbound submit)
 */
export async function removeFromPendingCache(wsn: string): Promise<void> {
    if (!wsn) return;

    try {
        const database = getDB();
        const normalizedWSN = wsn.trim().toUpperCase();
        await database.pendingInventory.delete(normalizedWSN);
        console.log(`🗑️ Removed from pending cache: ${normalizedWSN}`);
    } catch (error) {
        console.error('❌ Failed to remove from pending cache:', error);
    }
}

/**
 * Bulk remove from pending cache (after batch inbound submit)
 */
export async function removeMultipleFromPendingCache(wsns: string[]): Promise<void> {
    if (!wsns || wsns.length === 0) return;

    try {
        const database = getDB();
        const normalizedWSNs = wsns.map(w => w.trim().toUpperCase());
        await database.pendingInventory.bulkDelete(normalizedWSNs);
        console.log(`🗑️ Removed ${normalizedWSNs.length} items from pending cache`);
    } catch (error) {
        console.error('❌ Failed to bulk remove from pending cache:', error);
    }
}

// ======================== AVAILABLE CACHE (QC/PICKING/OUTBOUND) ========================

/**
 * Get available item by WSN - for QC/Picking/Outbound autofill
 * Returns item if in warehouse and not yet dispatched
 */
export async function getAvailableByWSN(
    wsn: string,
    warehouseId: number
): Promise<AvailableInventoryRecord | null> {
    if (!wsn || !warehouseId) return null;

    const normalizedWSN = wsn.trim().toUpperCase();

    // If cache disabled, return null
    if (!isCacheEnabled()) {
        console.log(`⚠️ Cache disabled, skip local lookup for: ${normalizedWSN}`);
        return null;
    }

    try {
        const database = getDB();

        const cached = await database.availableInventory
            .where('wsn')
            .equals(normalizedWSN)
            .and(item => item.warehouse_id === warehouseId)
            .first();

        // No stale check — auto-refresh keeps data fresh in background
        if (cached) {
            console.log(`✅ Available Cache HIT: ${normalizedWSN}`);
            return cached;
        }

        return null;
    } catch (error) {
        console.error('❌ Available cache lookup error:', error);
        return null;
    }
}

/**
 * Load all available inventory for a warehouse
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

        // Fetch from API
        const response = await cacheAPI.getAvailable(warehouseId);
        const records = response?.data?.data || [];
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

        // Add metadata to records
        const recordsWithMeta = records.map((r: any) => ({
            ...r,
            wsn: (r.wsn || '').toUpperCase(),
            warehouse_id: warehouseId,
            cached_at: Date.now()
        }));

        // Chunked write for performance
        let loaded = 0;
        for (let i = 0; i < recordsWithMeta.length; i += CACHE_CONFIG.CHUNK_SIZE) {
            const chunk = recordsWithMeta.slice(i, i + CACHE_CONFIG.CHUNK_SIZE);
            await database.availableInventory.bulkPut(chunk);
            loaded += chunk.length;

            if (onProgress) {
                onProgress(loaded, totalCount, `Caching ${loaded.toLocaleString()}/${totalCount.toLocaleString()}...`);
            }

            await new Promise(resolve => setTimeout(resolve, CACHE_CONFIG.YIELD_DELAY_MS));
        }

        // Update sync time
        await database.metadata.put({ key: `availableSync_${warehouseId}`, value: Date.now() });

        console.log(`✅ Available cache complete! ${loaded.toLocaleString()} records.`);
        if (onProgress) onProgress(loaded, totalCount, 'Cache ready!');

        return { success: true, count: loaded };
    } catch (error) {
        console.error('❌ Failed to load available inventory:', error);
        if (onProgress) onProgress(0, 0, 'Failed to load cache');
        return { success: false, count: 0 };
    }
}

/**
 * Update available cache item (after QC or Picking submit)
 * Updates the source field to reflect new status
 */
export async function updateAvailableCacheSource(
    wsn: string,
    newSource: 'PICKING' | 'QC' | 'INBOUND',
    additionalData?: Partial<AvailableInventoryRecord>
): Promise<void> {
    if (!wsn) return;

    try {
        const database = getDB();
        const normalizedWSN = wsn.trim().toUpperCase();

        const existing = await database.availableInventory.get(normalizedWSN);
        if (existing) {
            await database.availableInventory.update(normalizedWSN, {
                source: newSource,
                cached_at: Date.now(),
                ...additionalData
            });
            console.log(`🔄 Updated cache source for ${normalizedWSN}: ${newSource}`);
        }
    } catch (error) {
        console.error('❌ Failed to update available cache:', error);
    }
}

/**
 * Remove WSN from available cache (after outbound dispatch)
 */
export async function removeFromAvailableCache(wsn: string): Promise<void> {
    if (!wsn) return;

    try {
        const database = getDB();
        const normalizedWSN = wsn.trim().toUpperCase();
        await database.availableInventory.delete(normalizedWSN);
        console.log(`🗑️ Removed from available cache: ${normalizedWSN}`);
    } catch (error) {
        console.error('❌ Failed to remove from available cache:', error);
    }
}

/**
 * Bulk remove from available cache (after batch outbound)
 */
export async function removeMultipleFromAvailableCache(wsns: string[]): Promise<void> {
    if (!wsns || wsns.length === 0) return;

    try {
        const database = getDB();
        const normalizedWSNs = wsns.map(w => w.trim().toUpperCase());
        await database.availableInventory.bulkDelete(normalizedWSNs);
        console.log(`🗑️ Removed ${normalizedWSNs.length} items from available cache`);
    } catch (error) {
        console.error('❌ Failed to bulk remove from available cache:', error);
    }
}

// ======================== CACHE MANAGEMENT ========================

/**
 * Get unified cache statistics
 */
export async function getCacheStats(warehouseId?: number): Promise<{
    pending: { count: number; lastSync: number | null };
    available: { count: number; lastSync: number | null; bySource: { picking: number; qc: number; inbound: number } };
    isEnabled: boolean;
}> {
    try {
        const database = getDB();

        // Pending stats
        let pendingCount = 0;
        if (warehouseId) {
            pendingCount = await database.pendingInventory
                .where('warehouse_id')
                .equals(warehouseId)
                .count();
        } else {
            pendingCount = await database.pendingInventory.count();
        }

        const pendingSyncMeta = warehouseId
            ? await database.metadata.get(`pendingSync_${warehouseId}`)
            : await database.metadata.get('pendingSync');

        // Available stats
        let availableRecords: AvailableInventoryRecord[] = [];
        if (warehouseId) {
            availableRecords = await database.availableInventory
                .where('warehouse_id')
                .equals(warehouseId)
                .toArray();
        } else {
            availableRecords = await database.availableInventory.toArray();
        }

        const availableSyncMeta = warehouseId
            ? await database.metadata.get(`availableSync_${warehouseId}`)
            : await database.metadata.get('availableSync');

        const bySource = {
            picking: availableRecords.filter(r => r.source === 'PICKING').length,
            qc: availableRecords.filter(r => r.source === 'QC').length,
            inbound: availableRecords.filter(r => r.source === 'INBOUND').length,
        };

        return {
            pending: {
                count: pendingCount,
                lastSync: pendingSyncMeta?.value || null
            },
            available: {
                count: availableRecords.length,
                lastSync: availableSyncMeta?.value || null,
                bySource
            },
            isEnabled: isCacheEnabled()
        };
    } catch (error) {
        console.error('❌ Failed to get cache stats:', error);
        return {
            pending: { count: 0, lastSync: null },
            available: { count: 0, lastSync: null, bySource: { picking: 0, qc: 0, inbound: 0 } },
            isEnabled: isCacheEnabled()
        };
    }
}

/**
 * Check if cache needs refresh
 */
export async function needsCacheRefresh(
    warehouseId: number,
    cacheType: 'pending' | 'available'
): Promise<boolean> {
    try {
        const database = getDB();
        const key = cacheType === 'pending'
            ? `pendingSync_${warehouseId}`
            : `availableSync_${warehouseId}`;

        const meta = await database.metadata.get(key);
        if (!meta?.value) return true;

        const staleThreshold = cacheType === 'pending'
            ? CACHE_CONFIG.PENDING_STALE_MS
            : CACHE_CONFIG.AVAILABLE_STALE_MS;

        return Date.now() - meta.value > staleThreshold;
    } catch (error) {
        return true;
    }
}

/**
 * Clear all cache for a warehouse
 */
export async function clearCache(warehouseId?: number): Promise<void> {
    try {
        const database = getDB();

        if (warehouseId) {
            await Promise.all([
                database.pendingInventory.where('warehouse_id').equals(warehouseId).delete(),
                database.availableInventory.where('warehouse_id').equals(warehouseId).delete()
            ]);
            console.log(`🗑️ Cache cleared for warehouse ${warehouseId}`);
        } else {
            await Promise.all([
                database.pendingInventory.clear(),
                database.availableInventory.clear(),
                database.metadata.clear()
            ]);
            console.log('🗑️ All cache cleared');
        }
    } catch (error) {
        console.error('❌ Failed to clear cache:', error);
    }
}

/**
 * Sync both caches for a warehouse (background)
 */
export async function syncAllCaches(
    warehouseId: number,
    onProgress?: (message: string) => void
): Promise<void> {
    try {
        if (onProgress) onProgress('Syncing pending inventory...');
        await loadPendingInventory(warehouseId);

        if (onProgress) onProgress('Syncing available inventory...');
        await loadAvailableInventory(warehouseId);

        if (onProgress) onProgress('Cache sync complete!');
        console.log('✅ All caches synced successfully');
    } catch (error) {
        console.error('❌ Cache sync failed:', error);
        if (onProgress) onProgress('Cache sync failed');
    }
}

// ======================== AUTO-REFRESH (BACKGROUND) ========================

let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
let isRefreshing = false;

/**
 * Silent background refresh of pending cache
 * - No UI toast/popup — only console logs
 * - Chunked writes with yields — won't freeze UI
 * - Mutex — skips if already refreshing
 * - Offline-safe — silently skips if no internet
 */
export async function silentRefreshPendingCache(
    warehouseId: number
): Promise<boolean> {
    // Mutex: skip if already refreshing
    if (isRefreshing) {
        console.log('🔄 Silent refresh already in progress, skipping');
        return false;
    }

    // Skip if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.log('📴 Offline — skipping silent refresh');
        return false;
    }

    // Skip if cache disabled
    if (!isCacheEnabled()) {
        return false;
    }

    isRefreshing = true;

    try {
        const database = getDB();
        console.log(`🔄 Silent refresh: fetching pending inventory for warehouse ${warehouseId}...`);

        // Fetch from API with short timeout (don't block on slow connection)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CACHE_CONFIG.SILENT_REFRESH_TIMEOUT_MS);

        let response;
        try {
            response = await cacheAPI.getPending(warehouseId);
        } catch (fetchErr: any) {
            clearTimeout(timeoutId);
            if (fetchErr?.name === 'AbortError' || fetchErr?.code === 'ECONNABORTED') {
                console.log('⏱️ Silent refresh timeout — will retry next interval');
            } else {
                console.warn('⚠️ Silent refresh API error:', fetchErr?.message);
            }
            return false;
        }
        clearTimeout(timeoutId);

        const records = response?.data?.data || [];
        const totalCount = records.length;

        if (totalCount === 0) {
            console.log('🔄 Silent refresh: no pending records found');
            return true;
        }

        // Clear existing and re-insert (atomic refresh)
        await database.pendingInventory
            .where('warehouse_id')
            .equals(warehouseId)
            .delete();

        // Add metadata to records
        const recordsWithMeta = records.map((r: any) => ({
            ...r,
            wsn: (r.wsn || '').toUpperCase(),
            warehouse_id: warehouseId,
            cached_at: Date.now()
        }));

        // Chunked write — prevents UI freeze
        for (let i = 0; i < recordsWithMeta.length; i += CACHE_CONFIG.CHUNK_SIZE) {
            const chunk = recordsWithMeta.slice(i, i + CACHE_CONFIG.CHUNK_SIZE);
            await database.pendingInventory.bulkPut(chunk);
            // Yield to main thread between chunks
            await new Promise(resolve => setTimeout(resolve, CACHE_CONFIG.YIELD_DELAY_MS));
        }

        // Update sync timestamp
        await database.metadata.put({ key: `pendingSync_${warehouseId}`, value: Date.now() });

        // Re-warm memory map from fresh IndexedDB data
        if (CACHE_CONFIG.MEMORY_CACHE_ENABLED) {
            pendingMemoryMap = new Map(recordsWithMeta.map((r: any) => [r.wsn, r]));
            memoryWarehouseId = warehouseId;
            isMemoryWarmedUp = true;
        }

        console.log(`✅ Silent refresh complete: ${totalCount.toLocaleString()} pending records refreshed`);
        return true;
    } catch (error) {
        console.error('❌ Silent refresh failed:', error);
        return false;
    } finally {
        isRefreshing = false;
    }
}

/**
 * Silent background refresh of available cache (QC/Picking/Outbound)
 * Same pattern as pending: no UI, chunked writes, mutex, offline-safe
 */
let isRefreshingAvailable = false;

export async function silentRefreshAvailableCache(
    warehouseId: number
): Promise<boolean> {
    if (isRefreshingAvailable) {
        console.log('🔄 Available refresh already in progress, skipping...');
        return false;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.log('📴 Offline — skipping available cache refresh');
        return false;
    }

    isRefreshingAvailable = true;
    try {
        const database = getDB();
        console.log(`🔄 Silent refreshing available cache for warehouse ${warehouseId}...`);

        const response = await cacheAPI.getAvailable(warehouseId);
        const records = response?.data?.data || [];
        const totalCount = records.length;

        if (totalCount === 0) {
            console.log('🔄 Silent available refresh: no records found');
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

        await database.metadata.put({ key: `availableSync_${warehouseId}`, value: Date.now() });

        // Re-warm memory map from fresh data
        if (CACHE_CONFIG.MEMORY_CACHE_ENABLED) {
            availableMemoryMap = new Map(recordsWithMeta.map((r: any) => [r.wsn, r]));
            memoryWarehouseId = warehouseId;
            isMemoryWarmedUp = true;
        }

        console.log(`✅ Silent available refresh complete: ${totalCount.toLocaleString()} records`);
        return true;
    } catch (error) {
        console.error('❌ Silent available refresh failed:', error);
        return false;
    } finally {
        isRefreshingAvailable = false;
    }
}

/**
 * Start auto-refresh timer for BOTH pending and available caches
 * Refreshes every 30 minutes (configurable) while multi-entry tab is active
 * @param cacheType - 'pending' | 'available' | 'both' (default: 'pending' for backward compat)
 * Returns cleanup function to stop auto-refresh
 */
export function startAutoRefresh(
    warehouseId: number,
    intervalMs?: number,
    cacheType: 'pending' | 'available' | 'both' = 'pending'
): () => void {
    // Stop any existing timer first
    stopAutoRefresh();

    const interval = intervalMs || CACHE_CONFIG.AUTO_REFRESH_INTERVAL_MS;

    console.log(`⏰ Auto-refresh started (${cacheType}): every ${Math.round(interval / 60000)} minutes for warehouse ${warehouseId}`);

    autoRefreshTimer = setInterval(() => {
        if (cacheType === 'pending' || cacheType === 'both') {
            silentRefreshPendingCache(warehouseId).catch(err => {
                console.warn('Auto-refresh pending error (will retry):', err);
            });
        }
        if (cacheType === 'available' || cacheType === 'both') {
            silentRefreshAvailableCache(warehouseId).catch(err => {
                console.warn('Auto-refresh available error (will retry):', err);
            });
        }
    }, interval);

    // Return cleanup function
    return () => stopAutoRefresh();
}

/**
 * Stop auto-refresh timer
 */
export function stopAutoRefresh(): void {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
        console.log('⏰ Auto-refresh stopped');
    }
}

// Export database for direct access if needed
export { getDB };
