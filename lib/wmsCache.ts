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
    PENDING_STALE_MS: 60 * 60 * 1000,     // 1 hour for pending (master_data changes less)
    AVAILABLE_STALE_MS: 30 * 60 * 1000,   // 30 mins for available (changes frequently)

    // Performance tuning
    CHUNK_SIZE: 1000,     // Records per IndexedDB write
    YIELD_DELAY_MS: 10,   // Yield between chunks

    // Feature flag - defaults to OFF for safety
    ENABLED: typeof window !== 'undefined'
        ? localStorage.getItem('WMS_CACHE_ENABLED') === 'true'
        : false
};

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
            const age = Date.now() - (cached.cached_at || 0);
            if (age < CACHE_CONFIG.PENDING_STALE_MS) {
                console.log(`✅ Pending Cache HIT: ${normalizedWSN}`);
                return cached;
            }
            console.log(`⚠️ Pending Cache STALE: ${normalizedWSN}`);
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

        if (cached) {
            const age = Date.now() - (cached.cached_at || 0);
            if (age < CACHE_CONFIG.AVAILABLE_STALE_MS) {
                console.log(`✅ Available Cache HIT: ${normalizedWSN}`);
                return cached;
            }
            console.log(`⚠️ Available Cache STALE: ${normalizedWSN}`);
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

// Export database for direct access if needed
export { getDB };
