/**
 * Master Data Local Cache using Dexie (IndexedDB)
 * 
 * Purpose: Cache master_data locally for instant WSN lookups
 * - Full sync: Downloads all master data from server (for large datasets)
 * - Batch mode: Downloads only selected batch(es) - RECOMMENDED
 * - Subsequent lookups: Instant from local cache
 * - Works offline for cached WSNs
 */

import Dexie, { Table } from 'dexie';
import { inboundAPI } from './api';

// Module-level warehouse context for cache scoping
let _activeWarehouseId: number | undefined;

/**
 * Set the active warehouse ID for cache operations.
 * When warehouse changes, the cache is cleared automatically.
 */
export async function setActiveWarehouseForCache(warehouseId: number | undefined): Promise<void> {
    if (_activeWarehouseId === warehouseId) return;
    const previousId = _activeWarehouseId;
    _activeWarehouseId = warehouseId;
    if (previousId !== undefined && warehouseId !== undefined && previousId !== warehouseId) {
        console.log(`🔄 Warehouse changed from ${previousId} to ${warehouseId}, clearing cache...`);
        await clearCache();
    }
}

export function getActiveWarehouseId(): number | undefined {
    return _activeWarehouseId;
}

// Master data interface
export interface MasterDataRecord {
    wsn: string;  // Primary key
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
    batch_id?: string;  // For batch-specific caching
    cached_at?: number;
    [key: string]: any; // Allow dynamic key access
}

// Batch info interface
export interface BatchInfo {
    batch_id: string;
    count: number;
    created_at: string;
    last_updated: string;
}

// Cache metadata interface
export interface CacheMetadata {
    key: string;
    value: any;
}

// Define the database
class MasterDataDB extends Dexie {
    masterData!: Table<MasterDataRecord>;
    metadata!: Table<CacheMetadata>;

    constructor() {
        super('WMSMasterDataCache');
        this.version(2).stores({
            masterData: 'wsn, brand, product_title, batch_id',  // Added batch_id index
            metadata: 'key'
        });
    }
}

// Singleton database instance
let db: MasterDataDB | null = null;

function getDB(): MasterDataDB {
    if (!db) {
        db = new MasterDataDB();
    }
    return db;
}

// Cache configuration - ⚡ OPTIMIZED for both low-end and high-end systems
const CACHE_CONFIG = {
    SYNC_INTERVAL_MS: 24 * 60 * 60 * 1000,  // 24 hours
    BATCH_SIZE: 5000,  // ⚡ REDUCED from 10000: Records per batch during initial load (prevents memory spikes on low-end devices)
    STALE_THRESHOLD_MS: 7 * 24 * 60 * 60 * 1000,  // 7 days - consider record stale
    CHUNK_SIZE: 500,  // ⚡ REDUCED from 2000: Records per IndexedDB write (prevents main thread blocking)
    INCREMENTAL_SYNC_ENABLED: true,  // Only sync changes, not full data
    MAX_RECORDS_WARNING: 100000,  // ⚡ REDUCED from 500000: Show warning if > 1 lakh records (more reasonable threshold)
    YIELD_DELAY_MS: 16,  // ⚡ NEW: Time to yield between chunks (~1 frame at 60fps)
    WSN_LOOKUP_TIMEOUT_MS: 2000,  // ⚡ NEW: Fast timeout for single WSN lookup (2 seconds)
};

/**
 * ⚡ Helper: Check if browser is online
 */
function isNetworkOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * ⚡ Helper: Create a timeout promise that rejects after specified ms
 */
function createTimeoutPromise<T>(ms: number, fallbackValue: T): Promise<T> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(fallbackValue), ms);
    });
}

/**
 * Get master data by WSN - LOCAL FIRST, then API fallback
 * ⚡ OPTIMIZED: Fast timeout for API calls, instant cache return when offline/slow
 * This is the main function to use for WSN lookups
 */
export async function getMasterDataByWSN(wsn: string): Promise<MasterDataRecord | null> {
    if (!wsn) return null;

    const normalizedWSN = wsn.trim().toUpperCase();

    // ⚡ INSTANT OFFLINE CHECK: Check network status FIRST before any async operations
    const isOnline = isNetworkOnline();

    try {
        const database = getDB();

        // 1. Try local cache first (INSTANT)
        const cached = await database.masterData.get(normalizedWSN);

        // ⚡ OFFLINE FAST PATH: Return cache immediately when offline (skip stale check)
        if (!isOnline) {
            if (cached) {
                console.log(`📴 Offline - instant cache return for WSN: ${normalizedWSN}`);
                return cached;
            }
            console.log(`📴 Offline - WSN not in cache: ${normalizedWSN}`);
            return null;
        }

        if (cached) {
            // Check if cache is not too old
            const age = Date.now() - (cached.cached_at || 0);
            if (age < CACHE_CONFIG.STALE_THRESHOLD_MS) {
                console.log(`✅ Cache HIT for WSN: ${normalizedWSN}`);
                return cached;
            }
            console.log(`⚠️ Cache STALE for WSN: ${normalizedWSN}, will try API...`);
        }

        // 2. Cache miss or stale - fetch from API with FAST TIMEOUT
        console.log(`🔍 Cache MISS for WSN: ${normalizedWSN}, fetching from API...`);

        // ⚡ RACE: API call vs timeout - return stale cache if API is slow
        const apiPromise = inboundAPI.getMasterDataByWSN(normalizedWSN, _activeWarehouseId)
            .then(response => {
                if (response?.data) {
                    const record: MasterDataRecord = {
                        ...response.data,
                        wsn: normalizedWSN,
                        cached_at: Date.now()
                    };
                    // Save to cache in background (don't await)
                    database.masterData.put(record).catch(() => { });
                    console.log(`💾 Cached WSN: ${normalizedWSN}`);
                    return record;
                }
                return null;
            })
            .catch((error: any) => {
                // Handle 404 - WSN not found in master data
                if (error?.response?.status === 404) {
                    console.log(`ℹ️ WSN not found in master data: ${normalizedWSN}`);
                    return null;
                }
                throw error;
            });

        // ⚡ FAST TIMEOUT: If we have stale cache, use it if API is slow
        if (cached) {
            // Race: API vs 2-second timeout returning stale cache
            const result = await Promise.race([
                apiPromise,
                createTimeoutPromise(CACHE_CONFIG.WSN_LOOKUP_TIMEOUT_MS, 'TIMEOUT' as const)
            ]);

            if (result === 'TIMEOUT') {
                console.log(`⏱️ API slow - using stale cache for WSN: ${normalizedWSN}`);
                return cached;
            }

            return result;
        }

        // No cache - wait for API with timeout
        const result = await Promise.race([
            apiPromise,
            createTimeoutPromise(CACHE_CONFIG.WSN_LOOKUP_TIMEOUT_MS, null)
        ]);

        return result;
    } catch (error: any) {
        // Handle 404 - WSN not found in master data (this is normal, not an error)
        if (error?.response?.status === 404) {
            console.log(`ℹ️ WSN not found in master data: ${normalizedWSN}`);
            return null;
        }

        // If API fails but we have cached data (even if stale), return it
        try {
            const database = getDB();
            const cached = await database.masterData.get(normalizedWSN);
            if (cached) {
                console.log(`⚠️ API failed, using stale cache for WSN: ${normalizedWSN}`);
                return cached;
            }
        } catch (e) {
            // Ignore cache errors
        }

        console.error(`❌ Failed to get master data for WSN: ${normalizedWSN}`, error);
        return null; // Return null instead of throwing to prevent UI error popups
    }
}

/**
 * Bulk lookup multiple WSNs at once
 * Returns a Map of WSN -> MasterDataRecord
 */
export async function getMasterDataBulk(wsns: string[]): Promise<Map<string, MasterDataRecord>> {
    const result = new Map<string, MasterDataRecord>();
    if (!wsns || wsns.length === 0) return result;

    const normalizedWSNs = wsns.map(w => w.trim().toUpperCase()).filter(Boolean);
    const uniqueWSNs = Array.from(new Set(normalizedWSNs));
    try {
        const database = getDB();

        // Get all from local cache
        const cached = await database.masterData.where('wsn').anyOf(uniqueWSNs).toArray();

        cached.forEach(record => {
            result.set(record.wsn, record);
        });

        console.log(`📦 Bulk lookup: ${cached.length}/${uniqueWSNs.length} found in cache`);

        return result;
    } catch (error) {
        console.error('❌ Bulk lookup failed:', error);
        return result;
    }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
    totalRecords: number;
    lastSyncTime: number | null;
    dbSizeMB: number;
    isReady: boolean;
}> {
    try {
        const database = getDB();
        const totalRecords = await database.masterData.count();
        const metaRecord = await database.metadata.get('lastFullSync');
        const lastSyncTime = metaRecord?.value || null;

        // Estimate size (rough approximation)
        const avgRecordSize = 500; // bytes
        const dbSizeMB = (totalRecords * avgRecordSize) / (1024 * 1024);

        return {
            totalRecords,
            lastSyncTime,
            dbSizeMB: Math.round(dbSizeMB * 100) / 100,
            isReady: totalRecords > 0
        };
    } catch (error) {
        return {
            totalRecords: 0,
            lastSyncTime: null,
            dbSizeMB: 0,
            isReady: false
        };
    }
}

/**
 * Check if initial sync is needed
 */
export async function needsInitialSync(): Promise<boolean> {
    try {
        const stats = await getCacheStats();

        // Need sync if no records or last sync was too long ago
        if (stats.totalRecords === 0) return true;
        if (!stats.lastSyncTime) return true;

        const timeSinceSync = Date.now() - stats.lastSyncTime;
        return timeSinceSync > CACHE_CONFIG.SYNC_INTERVAL_MS;
    } catch (error) {
        return true;
    }
}

/**
 * Perform initial/full sync of master data
 * This downloads ALL master data from the server
 * 
 * ⚡ OPTIMIZED for large datasets (5-10 lakh records):
 * - Uses chunked writes to prevent memory spikes
 * - Yields to main thread between chunks (prevents UI freeze)
 * - Shows progress for user feedback
 * 
 * @param onProgress - Callback for progress updates
 * @returns Promise<boolean> - true if sync successful
 */
export async function performFullSync(
    onProgress?: (loaded: number, total: number) => void
): Promise<boolean> {
    try {
        const database = getDB();

        console.log('🔄 Starting full master data sync...');

        // Get total count first
        const countResponse = await inboundAPI.getMasterDataCount(_activeWarehouseId);
        const totalCount = countResponse?.data?.count || 0;

        if (totalCount === 0) {
            console.log('⚠️ No master data to sync');
            return false;
        }

        console.log(`📊 Total master data records: ${totalCount.toLocaleString()}`);

        // ⚡ LARGE DATA WARNING
        if (totalCount > CACHE_CONFIG.MAX_RECORDS_WARNING) {
            console.warn(`⚠️ Large dataset detected: ${totalCount.toLocaleString()} records. Initial sync may take 5-10 minutes.`);
        }

        let loaded = 0;
        let page = 1;
        const batchSize = CACHE_CONFIG.BATCH_SIZE;
        const chunkSize = CACHE_CONFIG.CHUNK_SIZE;

        // Clear existing data before full sync
        await database.masterData.clear();

        while (loaded < totalCount) {
            const response = await inboundAPI.getMasterDataBatch(page, batchSize, _activeWarehouseId);
            const records = response?.data?.data || response?.data || [];

            if (!records || records.length === 0) break;

            // Add cached_at timestamp to all records
            const recordsWithTimestamp = records.map((r: any) => ({
                ...r,
                wsn: r.wsn?.toUpperCase() || '',
                cached_at: Date.now()
            }));

            // ⚡ CHUNKED WRITE: Split into smaller chunks to prevent memory spikes
            for (let i = 0; i < recordsWithTimestamp.length; i += chunkSize) {
                const chunk = recordsWithTimestamp.slice(i, i + chunkSize);
                await database.masterData.bulkPut(chunk);

                // ⚡ YIELD to main thread - prevents UI freeze (use config value)
                await new Promise(resolve => setTimeout(resolve, CACHE_CONFIG.YIELD_DELAY_MS));
            }

            loaded += records.length;
            page++;

            if (onProgress) {
                onProgress(loaded, totalCount);
            }

            console.log(`📦 Synced ${loaded.toLocaleString()}/${totalCount.toLocaleString()} records...`);

            // ⚡ YIELD between batches for UI responsiveness
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Update last sync time
        await database.metadata.put({ key: 'lastFullSync', value: Date.now() });

        console.log(`✅ Full sync complete! ${loaded.toLocaleString()} records cached.`);
        return true;
    } catch (error) {
        console.error('❌ Full sync failed:', error);
        return false;
    }
}

/**
 * ⚡ INCREMENTAL SYNC - Only sync recently modified records
 * Much faster than full sync for subsequent syncs
 * 
 * @param sinceTimestamp - Only sync records modified after this timestamp
 * @returns Promise<number> - Number of records updated
 */
export async function performIncrementalSync(sinceTimestamp?: number): Promise<number> {
    try {
        const database = getDB();
        const lastSync = sinceTimestamp || (await database.metadata.get('lastFullSync'))?.value;

        if (!lastSync) {
            console.log('⚠️ No previous sync found, performing full sync...');
            await performFullSync();
            return -1;
        }

        console.log(`🔄 Starting incremental sync (changes since ${new Date(lastSync).toLocaleString()})...`);

        // For now, just update the sync time - incremental API needs backend support
        // You can add a backend API: GET /master-data/changes?since=timestamp
        await database.metadata.put({ key: 'lastFullSync', value: Date.now() });

        console.log('✅ Incremental sync complete');
        return 0;
    } catch (error) {
        console.error('❌ Incremental sync failed:', error);
        return -1;
    }
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
    try {
        const database = getDB();
        await database.masterData.clear();
        await database.metadata.clear();
        console.log('🗑️ Cache cleared');
    } catch (error) {
        console.error('❌ Failed to clear cache:', error);
    }
}

/**
 * ⚡ SMART Pre-warm cache
 * - First time: Full sync in background
 * - Subsequent: Quick incremental sync OR skip if recent
 * - Shows progress for large datasets
 */
export async function prewarmCache(
    onProgress?: (loaded: number, total: number, message: string) => void
): Promise<void> {
    try {
        const stats = await getCacheStats();
        const needsSync = await needsInitialSync();

        if (stats.totalRecords === 0) {
            // First time - full sync needed
            console.log('🔥 First time cache init, starting background sync...');
            if (onProgress) onProgress(0, 1, 'Starting initial sync...');

            performFullSync((loaded, total) => {
                if (onProgress) onProgress(loaded, total, `Syncing ${loaded.toLocaleString()}/${total.toLocaleString()}...`);
            }).catch(err => {
                console.error('Background sync failed:', err);
                if (onProgress) onProgress(0, 1, 'Sync failed');
            });
        } else if (needsSync) {
            // Subsequent sync needed - use incremental if possible
            console.log('🔄 Cache needs refresh, starting background sync...');
            if (onProgress) onProgress(stats.totalRecords, stats.totalRecords, 'Refreshing cache...');

            performFullSync((loaded, total) => {
                if (onProgress) onProgress(loaded, total, `Refreshing ${loaded.toLocaleString()}/${total.toLocaleString()}...`);
            }).catch(err => {
                console.error('Background sync failed:', err);
            });
        } else {
            // Cache is fresh
            console.log(`✅ Cache ready with ${stats.totalRecords.toLocaleString()} records`);
            if (onProgress) onProgress(stats.totalRecords, stats.totalRecords, 'Cache ready');
        }
    } catch (error) {
        console.error('❌ Prewarm failed:', error);
    }
}

/**
 * ⚡ Get sync progress status
 */
let syncInProgress = false;
let syncProgress = { loaded: 0, total: 0 };

export function getSyncStatus(): { inProgress: boolean; loaded: number; total: number } {
    return { inProgress: syncInProgress, ...syncProgress };
}

// ====== BATCH-SPECIFIC CACHING ======

/**
 * Get list of available batches from server
 */
export async function getBatchList(): Promise<BatchInfo[]> {
    try {
        const response = await inboundAPI.getMasterDataBatchList(_activeWarehouseId);
        return response?.data?.batches || [];
    } catch (error) {
        console.error('❌ Failed to get batch list:', error);
        return [];
    }
}

/**
 * Get currently cached batch IDs
 */
export async function getCachedBatchIds(): Promise<string[]> {
    try {
        const database = getDB();
        const meta = await database.metadata.get('cachedBatchIds');
        return meta?.value || [];
    } catch (error) {
        return [];
    }
}

/**
 * Cache specific batch(es) - FAST! Only downloads selected batch data
 * 
 * @param batchIds - Array of batch IDs to cache
 * @param clearExisting - If true, clears existing cache first
 * @param onProgress - Progress callback
 * @returns Promise<{ success: boolean; count: number; batchIds: string[] }>
 */
export async function cacheBatchData(
    batchIds: string[],
    clearExisting: boolean = true,
    onProgress?: (loaded: number, total: number, message: string) => void
): Promise<{ success: boolean; count: number; batchIds: string[] }> {
    if (!batchIds || batchIds.length === 0) {
        return { success: false, count: 0, batchIds: [] };
    }

    syncInProgress = true;
    syncProgress = { loaded: 0, total: 0 };

    try {
        const database = getDB();

        console.log(`📦 Caching batch(es): ${batchIds.join(', ')}...`);
        if (onProgress) onProgress(0, 1, `Loading ${batchIds.length} batch(es)...`);

        // Fetch data for selected batches
        const response = await inboundAPI.getMasterDataByBatchIds(batchIds, _activeWarehouseId);
        const records = response?.data?.data || [];
        const totalCount = records.length;

        console.log(`📊 Received ${totalCount.toLocaleString()} records for batch(es)`);

        if (totalCount === 0) {
            syncInProgress = false;
            return { success: false, count: 0, batchIds };
        }

        // Clear existing data if requested
        if (clearExisting) {
            await database.masterData.clear();
        }

        // Add cached_at timestamp to all records
        const recordsWithTimestamp = records.map((r: any) => ({
            ...r,
            wsn: r.wsn?.toUpperCase() || '',
            cached_at: Date.now()
        }));

        // Chunked write for better performance
        const chunkSize = 2000;
        let loaded = 0;

        for (let i = 0; i < recordsWithTimestamp.length; i += chunkSize) {
            const chunk = recordsWithTimestamp.slice(i, i + chunkSize);
            await database.masterData.bulkPut(chunk);
            loaded += chunk.length;
            syncProgress = { loaded, total: totalCount };

            if (onProgress) {
                onProgress(loaded, totalCount, `Caching ${loaded.toLocaleString()}/${totalCount.toLocaleString()}...`);
            }

            // Yield to main thread
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Save cached batch IDs to metadata
        await database.metadata.put({ key: 'cachedBatchIds', value: batchIds });
        await database.metadata.put({ key: 'lastBatchSync', value: Date.now() });

        console.log(`✅ Batch cache complete! ${loaded.toLocaleString()} records cached.`);
        if (onProgress) onProgress(loaded, totalCount, 'Cache ready!');

        syncInProgress = false;
        return { success: true, count: loaded, batchIds };
    } catch (error) {
        console.error('❌ Batch cache failed:', error);
        syncInProgress = false;
        return { success: false, count: 0, batchIds };
    }
}

/**
 * Check if a WSN exists in the cached batch(es)
 * Returns the batch_id if found, null if not found
 */
export async function isWSNInCachedBatches(wsn: string): Promise<string | null> {
    if (!wsn) return null;

    try {
        const database = getDB();
        const normalizedWSN = wsn.trim().toUpperCase();
        const record = await database.masterData.get(normalizedWSN);

        if (record) {
            return record.batch_id || 'unknown';
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Get batch cache statistics
 */
export async function getBatchCacheStats(): Promise<{
    totalRecords: number;
    cachedBatchIds: string[];
    lastSyncTime: number | null;
    isReady: boolean;
}> {
    try {
        const database = getDB();
        const totalRecords = await database.masterData.count();
        const batchIdsMeta = await database.metadata.get('cachedBatchIds');
        const lastSyncMeta = await database.metadata.get('lastBatchSync');

        return {
            totalRecords,
            cachedBatchIds: batchIdsMeta?.value || [],
            lastSyncTime: lastSyncMeta?.value || null,
            isReady: totalRecords > 0
        };
    } catch (error) {
        return {
            totalRecords: 0,
            cachedBatchIds: [],
            lastSyncTime: null,
            isReady: false
        };
    }
}

// Export the database for direct access if needed
export { getDB };
