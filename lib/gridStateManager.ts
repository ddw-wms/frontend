/**
 * Grid State Manager - Centralized persistence for ag-Grid column states
 * 
 * Uses IndexedDB (via Dexie) for robust, per-page, per-user state persistence.
 * Falls back to localStorage for simple cases.
 * 
 * Features:
 * - Persists column widths, order, visibility, sort, and filter state
 * - Per-grid state keyed by page + gridId + userId
 * - Handles visibility changes WITHOUT changing column positions
 * - Preserves critical column logical positions (WSN, WID, FSN, Title, MRP, FSP)
 * - Efficient debounced saves to prevent excessive writes
 * - Migration support from legacy localStorage keys
 */

import Dexie, { Table } from 'dexie';

// ============================================================================
// TYPES
// ============================================================================

export interface ColumnState {
    colId: string;
    width?: number;
    hide?: boolean;
    pinned?: 'left' | 'right' | null;
    sort?: 'asc' | 'desc' | null;
    sortIndex?: number | null;
    flex?: number | null;
}

export interface GridStateRecord {
    id: string; // Composite key: `${pageId}_${gridId}_${userId}`
    pageId: string;
    gridId: string;
    userId: string;
    columnState: ColumnState[];
    columnOrder: string[]; // Original column order for reference
    updatedAt: number;
    version: number; // For migration support
}

export interface GridStateMetadata {
    key: string;
    value: any;
}

// ============================================================================
// DATABASE SCHEMA
// ============================================================================

class GridStateDB extends Dexie {
    gridStates!: Table<GridStateRecord>;
    metadata!: Table<GridStateMetadata>;

    constructor() {
        super('WMSGridStateCache');
        this.version(1).stores({
            gridStates: 'id, pageId, gridId, userId, updatedAt',
            metadata: 'key'
        });
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let db: GridStateDB | null = null;

function getDB(): GridStateDB {
    if (typeof window === 'undefined') {
        throw new Error('GridStateDB can only be used in browser environment');
    }
    if (!db) {
        db = new GridStateDB();
    }
    return db;
}

// ============================================================================
// CRITICAL COLUMNS - These should retain logical position
// ============================================================================

/**
 * Columns that should maintain their relative order when visibility changes.
 * These are typically identifier/key columns that users expect in specific positions.
 */
export const CRITICAL_COLUMNS = new Set([
    'wsn',
    'wid',
    'fsn',
    'product_serial_number',
    'product_title',
    'title',
    'mrp',
    'fsp',
    'brand',
    'order_id',
    'inbound_date',
    'outbound_date',
    'created_at',
    'updated_at',
]);

// ============================================================================
// STATE KEY GENERATION
// ============================================================================

/**
 * Generate a unique key for grid state
 */
export function generateGridStateKey(
    pageId: string,
    gridId: string = 'main',
    userId?: string
): string {
    const user = userId || getCurrentUserId();
    return `${pageId}_${gridId}_${user}`;
}

/**
 * Get current user ID from localStorage
 */
function getCurrentUserId(): string {
    if (typeof window === 'undefined') return 'anonymous';
    try {
        const user = localStorage.getItem('user');
        if (user) {
            const parsed = JSON.parse(user);
            return parsed.id || parsed.user_id || parsed.username || 'default';
        }
    } catch {
        // Ignore parsing errors
    }
    return 'default';
}

// ============================================================================
// CORE OPERATIONS
// ============================================================================

/**
 * Save grid column state to IndexedDB
 */
export async function saveGridState(
    pageId: string,
    columnState: ColumnState[],
    gridId: string = 'main',
    originalColumnOrder?: string[]
): Promise<void> {
    if (typeof window === 'undefined' || !columnState?.length) return;

    try {
        const database = getDB();
        const userId = getCurrentUserId();
        const id = generateGridStateKey(pageId, gridId, userId);

        const record: GridStateRecord = {
            id,
            pageId,
            gridId,
            userId,
            columnState,
            columnOrder: originalColumnOrder || columnState.map(c => c.colId),
            updatedAt: Date.now(),
            version: 1,
        };

        await database.gridStates.put(record);

        // Also save to localStorage as backup (for faster initial load)
        try {
            localStorage.setItem(`${pageId}_columnState_v3`, JSON.stringify(columnState));
        } catch {
            // localStorage might be full or disabled
        }
    } catch (error) {
        console.warn('[GridStateManager] Failed to save state to IndexedDB:', error);
        // Fallback to localStorage only
        try {
            localStorage.setItem(
                `${pageId}_columnState_v3`,
                JSON.stringify(columnState)
            );
        } catch {
            // Ignore localStorage errors
        }
    }
}

/**
 * Load grid column state from IndexedDB (or localStorage fallback)
 */
export async function loadGridState(
    pageId: string,
    gridId: string = 'main'
): Promise<ColumnState[] | null> {
    if (typeof window === 'undefined') return null;

    try {
        const database = getDB();
        const userId = getCurrentUserId();
        const id = generateGridStateKey(pageId, gridId, userId);

        const record = await database.gridStates.get(id);
        if (record?.columnState?.length) {
            return record.columnState;
        }
    } catch (error) {
        console.warn('[GridStateManager] Failed to load from IndexedDB:', error);
    }

    // Fallback to localStorage
    try {
        // Try v3 format first
        let savedState = localStorage.getItem(`${pageId}_columnState_v3`);
        if (savedState) {
            return JSON.parse(savedState);
        }

        // Try v2 format (legacy)
        savedState = localStorage.getItem(`${pageId}_columnState_v2`);
        if (savedState) {
            const parsed = JSON.parse(savedState);
            // Migrate to v3
            localStorage.setItem(`${pageId}_columnState_v3`, savedState);
            localStorage.removeItem(`${pageId}_columnState_v2`);
            return parsed;
        }

        // Try v1 format (oldest legacy)
        savedState = localStorage.getItem(`${pageId}_columnState`);
        if (savedState) {
            const parsed = JSON.parse(savedState);
            // Migrate to v3
            localStorage.setItem(`${pageId}_columnState_v3`, JSON.stringify(parsed));
            localStorage.removeItem(`${pageId}_columnState`);
            return parsed;
        }
    } catch (error) {
        console.warn('[GridStateManager] Failed to parse localStorage state:', error);
    }

    return null;
}

/**
 * Clear grid state for a specific page
 */
export async function clearGridState(
    pageId: string,
    gridId: string = 'main'
): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
        const database = getDB();
        const userId = getCurrentUserId();
        const id = generateGridStateKey(pageId, gridId, userId);
        await database.gridStates.delete(id);
    } catch (error) {
        console.warn('[GridStateManager] Failed to clear IndexedDB state:', error);
    }

    // Also clear localStorage variants
    try {
        localStorage.removeItem(`${pageId}_columnState_v3`);
        localStorage.removeItem(`${pageId}_columnState_v2`);
        localStorage.removeItem(`${pageId}_columnState`);
    } catch {
        // Ignore localStorage errors
    }
}

/**
 * Clear all grid states (for a full reset)
 */
export async function clearAllGridStates(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
        const database = getDB();
        await database.gridStates.clear();
    } catch (error) {
        console.warn('[GridStateManager] Failed to clear all IndexedDB states:', error);
    }

    // Clear localStorage patterns
    try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.includes('_columnState')) {
                localStorage.removeItem(key);
            }
        });
    } catch {
        // Ignore localStorage errors
    }
}

// ============================================================================
// COLUMN STATE HELPERS
// ============================================================================

/**
 * Merge saved state with current column definitions
 * Preserves saved widths/order while respecting new columns
 */
export function mergeColumnState(
    savedState: ColumnState[],
    currentColDefs: { field?: string; colId?: string }[],
    options: {
        applyOrder?: boolean;
        applyWidths?: boolean;
        applyVisibility?: boolean;
    } = {}
): ColumnState[] {
    const { applyOrder = true, applyWidths = true, applyVisibility = true } = options;

    // Create a map of saved state by colId
    const savedMap = new Map<string, ColumnState>();
    savedState.forEach(col => {
        if (col.colId) {
            savedMap.set(col.colId, col);
        }
    });

    // Get current column IDs
    const currentColIds = currentColDefs.map(def => def.colId || def.field || '').filter(Boolean);
    const currentColIdSet = new Set(currentColIds);

    // Build merged state
    const mergedState: ColumnState[] = [];

    if (applyOrder) {
        // Start with saved order (only for columns that still exist)
        savedState.forEach(saved => {
            if (saved.colId && currentColIdSet.has(saved.colId)) {
                mergedState.push({
                    colId: saved.colId,
                    width: applyWidths ? saved.width : undefined,
                    hide: applyVisibility ? saved.hide : undefined,
                    pinned: saved.pinned,
                    sort: saved.sort,
                    sortIndex: saved.sortIndex,
                });
            }
        });

        // Add any new columns that weren't in saved state
        currentColIds.forEach(colId => {
            if (!savedMap.has(colId)) {
                mergedState.push({ colId });
            }
        });
    } else {
        // Keep current order, just apply widths/visibility
        currentColIds.forEach(colId => {
            const saved = savedMap.get(colId);
            if (saved) {
                mergedState.push({
                    colId,
                    width: applyWidths ? saved.width : undefined,
                    hide: applyVisibility ? saved.hide : undefined,
                    pinned: saved.pinned,
                    sort: saved.sort,
                    sortIndex: saved.sortIndex,
                });
            } else {
                mergedState.push({ colId });
            }
        });
    }

    return mergedState;
}

/**
 * Apply visibility changes without affecting column order
 * This is critical for maintaining UX when toggling columns
 */
export function applyVisibilityWithoutReorder(
    currentState: ColumnState[],
    visibleColumns: Set<string> | string[]
): ColumnState[] {
    const visibleSet = visibleColumns instanceof Set
        ? visibleColumns
        : new Set(visibleColumns);

    return currentState.map(col => ({
        ...col,
        hide: !visibleSet.has(col.colId),
    }));
}

/**
 * Extract column widths from grid API state
 */
export function extractColumnWidths(
    columnState: ColumnState[]
): Record<string, number> {
    const widths: Record<string, number> = {};
    columnState.forEach(col => {
        if (col.colId && col.width && col.width > 0) {
            widths[col.colId] = col.width;
        }
    });
    return widths;
}

/**
 * Get column order from state
 */
export function getColumnOrder(columnState: ColumnState[]): string[] {
    return columnState.map(col => col.colId).filter(Boolean) as string[];
}

// ============================================================================
// DEBOUNCED SAVE UTILITY
// ============================================================================

const saveDebounceTimers = new Map<string, NodeJS.Timeout>();

/**
 * Debounced save to prevent excessive writes during rapid column resizing
 */
export function debouncedSaveGridState(
    pageId: string,
    columnState: ColumnState[],
    gridId: string = 'main',
    debounceMs: number = 300
): void {
    const key = generateGridStateKey(pageId, gridId);

    // Clear existing timer
    const existingTimer = saveDebounceTimers.get(key);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
        saveGridState(pageId, columnState, gridId);
        saveDebounceTimers.delete(key);
    }, debounceMs);

    saveDebounceTimers.set(key, timer);
}

// ============================================================================
// LEGACY MIGRATION
// ============================================================================

/**
 * Migrate legacy localStorage keys to new format
 */
export async function migrateLegacyState(pageId: string): Promise<void> {
    if (typeof window === 'undefined') return;

    const legacyKeys = [
        `${pageId}_columnState`,
        `${pageId}_columnState_v2`,
    ];

    for (const key of legacyKeys) {
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsed = JSON.parse(saved);
                await saveGridState(pageId, parsed);
                localStorage.removeItem(key);
                console.log(`[GridStateManager] Migrated legacy key: ${key}`);
            }
        } catch {
            // Ignore migration errors
        }
    }
}

// ============================================================================
// COLUMN WIDTH PERSISTENCE FOR COLUMN DEFINITIONS
// ============================================================================

/**
 * Apply saved widths to column definitions
 * Use this when building columnDefs to include persisted widths
 */
export function applyWidthsToColumnDefs<T extends { field?: string; colId?: string; width?: number; flex?: number }>(
    columnDefs: T[],
    savedWidths: Record<string, number>
): T[] {
    if (!savedWidths || Object.keys(savedWidths).length === 0) {
        return columnDefs;
    }

    return columnDefs.map(def => {
        const colId = def.colId || def.field;
        if (colId && savedWidths[colId]) {
            return {
                ...def,
                width: savedWidths[colId],
                flex: undefined, // Remove flex when applying fixed width
            };
        }
        return def;
    });
}

export default {
    saveGridState,
    loadGridState,
    clearGridState,
    clearAllGridStates,
    debouncedSaveGridState,
    mergeColumnState,
    applyVisibilityWithoutReorder,
    extractColumnWidths,
    getColumnOrder,
    applyWidthsToColumnDefs,
    migrateLegacyState,
    generateGridStateKey,
    CRITICAL_COLUMNS,
};
