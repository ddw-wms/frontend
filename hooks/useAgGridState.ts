/**
 * useAgGridState - Comprehensive hook for ag-Grid state management
 * 
 * Purpose: Centralized, professional-grade grid state persistence
 * 
 * Features:
 * - Persists column widths after user resize
 * - Persists column order and alignment
 * - Persists hide/unhide state WITHOUT changing column positions
 * - Restores state correctly on reload and navigation
 * - Per-page, per-user, per-grid state isolation
 * - Large dataset performance optimizations
 * - Debounced saves to prevent excessive writes
 * 
 * Usage:
 * ```tsx
 * const {
 *   gridRef,
 *   onGridReady,
 *   onColumnResized,
 *   onColumnMoved,
 *   onColumnVisible,
 *   onSortChanged,
 *   defaultColDef,
 *   columnWidths,
 *   resetGridState,
 * } = useAgGridState({
 *   pageId: 'inbound',
 *   gridId: 'list',
 *   columnDefs: myColumnDefs,
 * });
 * ```
 */

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import {
    saveGridState,
    loadGridState,
    clearGridState,
    debouncedSaveGridState,
    mergeColumnState,
    extractColumnWidths,
    migrateLegacyState,
    ColumnState,
    applyWidthsToColumnDefs,
} from '@/lib/gridStateManager';

// ============================================================================
// TYPES
// ============================================================================

export interface UseAgGridStateOptions {
    /** Unique identifier for the page (e.g., 'inbound', 'outbound', 'dashboard') */
    pageId: string;

    /** Grid identifier for pages with multiple grids (e.g., 'list', 'multiEntry') */
    gridId?: string;

    /** Column definitions - used to merge with saved state */
    columnDefs?: any[];

    /** Whether to apply saved column order (default: true for list grids, false for entry grids) */
    applyColumnOrder?: boolean;

    /** Whether to auto-size columns on first render if no saved state (default: true) */
    autoSizeOnFirstRender?: boolean;

    /** Debounce delay for saving state in ms (default: 300) */
    saveDebounceMs?: number;

    /** Callback when grid state is restored */
    onStateRestored?: (state: ColumnState[] | null) => void;

    /** Callback when column widths change */
    onColumnWidthsChange?: (widths: Record<string, number>) => void;

    /** Additional default column definition overrides */
    defaultColDefOverrides?: any;

    /** Whether grid is in mobile mode */
    isMobile?: boolean;
}

export interface UseAgGridStateReturn {
    /** Ref to attach to AgGridReact */
    gridRef: React.RefObject<any>;

    /** Grid API reference (after grid ready) */
    gridApi: any;

    /** Saved column widths */
    columnWidths: Record<string, number>;

    /** Whether state has been restored */
    isStateRestored: boolean;

    /** Optimized default column definition */
    defaultColDef: any;

    /** Handler for onGridReady - restores saved state */
    onGridReady: (params: any) => void;

    /** Handler for onColumnResized - saves column state */
    onColumnResized: (params: any) => void;

    /** Handler for onColumnMoved - saves column state */
    onColumnMoved: (params: any) => void;

    /** Handler for onColumnVisible - saves column state without reordering */
    onColumnVisible: (params: any) => void;

    /** Handler for onSortChanged - saves sort state */
    onSortChanged: (params: any) => void;

    /** Handler for onFirstDataRendered - auto-sizes if needed */
    onFirstDataRendered: (params: any) => void;

    /** Reset grid state to defaults */
    resetGridState: () => Promise<void>;

    /** Save current grid state manually */
    saveCurrentState: () => void;

    /** Apply saved widths to column definitions */
    getColumnDefsWithWidths: <T extends any[]>(defs: T) => T;

    /** Performance props to spread on AgGridReact */
    performanceProps: Record<string, any>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useAgGridState(options: UseAgGridStateOptions): UseAgGridStateReturn {
    const {
        pageId,
        gridId = 'main',
        columnDefs = [],
        applyColumnOrder = true,
        autoSizeOnFirstRender = true,
        saveDebounceMs = 300,
        onStateRestored,
        onColumnWidthsChange,
        defaultColDefOverrides = {},
        isMobile = false,
    } = options;

    // Refs
    const gridRef = useRef<any>(null);
    const gridApiRef = useRef<any>(null);
    const hasRestoredStateRef = useRef(false);
    const hasAutoSizedRef = useRef(false);
    const originalColumnOrderRef = useRef<string[]>([]);

    // State
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const [isStateRestored, setIsStateRestored] = useState(false);

    // Store original column order from columnDefs
    useEffect(() => {
        if (columnDefs.length > 0 && originalColumnOrderRef.current.length === 0) {
            originalColumnOrderRef.current = columnDefs
                .map((def: any) => def.colId || def.field)
                .filter(Boolean);
        }
    }, [columnDefs]);

    // Migrate legacy state on mount
    useEffect(() => {
        migrateLegacyState(pageId).catch(() => {
            // Ignore migration errors
        });
    }, [pageId]);

    // Optimized default column definition
    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: isMobile ? 80 : 100,
        // Don't use flex by default - it interferes with width persistence
        // flex: 1, // REMOVED - causes width reset issues
        suppressSizeToFit: true, // Preserve user widths
        tooltipComponentParams: { color: '#ececec' },
        cellStyle: {
            fontSize: isMobile ? '12px' : '13px',
            display: 'flex',
            alignItems: 'center',
        },
        ...defaultColDefOverrides,
    }), [isMobile, defaultColDefOverrides]);

    // Performance props for large datasets
    const performanceProps = useMemo(() => ({
        // Virtualization & rendering
        rowBuffer: isMobile ? 10 : 20,
        animateRows: false, // Disable for better performance
        suppressAnimationFrame: false,

        // Prevent unnecessary re-renders
        suppressScrollOnNewData: true,
        maintainColumnOrder: true,
        ensureDomOrder: true,
        suppressRowTransform: true,

        // Value caching
        valueCache: true,
        valueCacheNeverExpires: false,

        // DOM optimization
        debounceVerticalScrollbar: true,
        suppressColumnVirtualisation: false, // Keep horizontal virtualization

        // Selection
        enableCellTextSelection: true,
        suppressCellFocus: false,

        // Prevent flickering
        suppressLoadingOverlay: false,
        suppressNoRowsOverlay: false,
    }), [isMobile]);

    // Save current column state
    const saveCurrentColumnState = useCallback(() => {
        if (!gridApiRef.current) return;

        try {
            const columnState = gridApiRef.current.getColumnState();
            if (columnState && columnState.length > 0) {
                debouncedSaveGridState(
                    pageId,
                    columnState,
                    gridId,
                    saveDebounceMs
                );

                // Update column widths state
                const widths = extractColumnWidths(columnState);
                setColumnWidths(widths);
                onColumnWidthsChange?.(widths);
            }
        } catch (error) {
            console.warn('[useAgGridState] Failed to save column state:', error);
        }
    }, [pageId, gridId, saveDebounceMs, onColumnWidthsChange]);

    // Grid ready handler - restores saved state
    const onGridReady = useCallback(async (params: any) => {
        gridRef.current = params;
        gridApiRef.current = params.api;

        if (hasRestoredStateRef.current) return;

        try {
            const savedState = await loadGridState(pageId, gridId);

            if (savedState && savedState.length > 0) {
                // Merge saved state with current column definitions
                const mergedState = mergeColumnState(
                    savedState,
                    columnDefs,
                    { applyOrder: applyColumnOrder, applyWidths: true, applyVisibility: true }
                );

                // Apply the state
                params.api.applyColumnState({
                    state: mergedState,
                    applyOrder: applyColumnOrder,
                });

                // Update column widths state
                const widths = extractColumnWidths(mergedState);
                setColumnWidths(widths);
                onColumnWidthsChange?.(widths);

                hasRestoredStateRef.current = true;
                hasAutoSizedRef.current = true; // Don't auto-size if we have saved state
                setIsStateRestored(true);
                onStateRestored?.(savedState);

                console.log(`[useAgGridState] Restored state for ${pageId}/${gridId}`);
            } else {
                setIsStateRestored(true);
                onStateRestored?.(null);
            }
        } catch (error) {
            console.warn('[useAgGridState] Failed to restore state:', error);
            setIsStateRestored(true);
            onStateRestored?.(null);
        }
    }, [pageId, gridId, columnDefs, applyColumnOrder, onStateRestored, onColumnWidthsChange]);

    // Column resized handler
    const onColumnResized = useCallback((params: any) => {
        // Only save when resize is finished (not during drag)
        if (!params.finished || !params.api) return;

        saveCurrentColumnState();
    }, [saveCurrentColumnState]);

    // Column moved handler
    const onColumnMoved = useCallback((params: any) => {
        // Only save when move is finished
        if (!params.finished || !params.api) return;

        saveCurrentColumnState();
    }, [saveCurrentColumnState]);

    // Column visibility changed handler
    // This handler ensures visibility changes don't affect column order
    const onColumnVisible = useCallback((params: any) => {
        if (!params.api) return;

        // Get current state and save it
        // The key insight: we DON'T apply order changes, just save the current state
        saveCurrentColumnState();
    }, [saveCurrentColumnState]);

    // Sort changed handler
    const onSortChanged = useCallback((params: any) => {
        if (!params.api) return;

        saveCurrentColumnState();
    }, [saveCurrentColumnState]);

    // First data rendered handler - auto-size if no saved state
    const onFirstDataRendered = useCallback((params: any) => {
        if (!autoSizeOnFirstRender || hasAutoSizedRef.current || !params.api) return;

        // Only auto-size if we don't have saved state
        if (!hasRestoredStateRef.current) {
            try {
                const allColIds = params.api.getColumns()?.map((col: any) => col.getColId()) || [];
                // Exclude special columns from auto-sizing
                const colsToAutoSize = allColIds.filter((id: string) =>
                    !['actions', 'checkbox', 'selection', 'sno'].includes(id)
                );

                if (colsToAutoSize.length > 0) {
                    params.api.autoSizeColumns(colsToAutoSize);
                    hasAutoSizedRef.current = true;

                    // Save the auto-sized state
                    setTimeout(() => {
                        saveCurrentColumnState();
                    }, 100);
                }
            } catch (error) {
                console.warn('[useAgGridState] Auto-size failed:', error);
            }
        }

        hasAutoSizedRef.current = true;
    }, [autoSizeOnFirstRender, saveCurrentColumnState]);

    // Reset grid state
    const resetGridState = useCallback(async () => {
        try {
            await clearGridState(pageId, gridId);
            setColumnWidths({});
            hasRestoredStateRef.current = false;
            hasAutoSizedRef.current = false;

            // If grid is available, reset to default column state
            if (gridApiRef.current) {
                gridApiRef.current.resetColumnState();

                // Auto-size after reset
                const allColIds = gridApiRef.current.getColumns()?.map((col: any) => col.getColId()) || [];
                if (allColIds.length > 0) {
                    gridApiRef.current.autoSizeColumns(allColIds);
                }
            }

            console.log(`[useAgGridState] Reset state for ${pageId}/${gridId}`);
        } catch (error) {
            console.warn('[useAgGridState] Failed to reset state:', error);
        }
    }, [pageId, gridId]);

    // Save current state manually
    const saveCurrentState = useCallback(() => {
        saveCurrentColumnState();
    }, [saveCurrentColumnState]);

    // Apply saved widths to column definitions
    const getColumnDefsWithWidths = useCallback(<T extends any[]>(defs: T): T => {
        return applyWidthsToColumnDefs(defs, columnWidths) as T;
    }, [columnWidths]);

    return {
        gridRef,
        gridApi: gridApiRef.current,
        columnWidths,
        isStateRestored,
        defaultColDef,
        onGridReady,
        onColumnResized,
        onColumnMoved,
        onColumnVisible,
        onSortChanged,
        onFirstDataRendered,
        resetGridState,
        saveCurrentState,
        getColumnDefsWithWidths,
        performanceProps,
    };
}

export default useAgGridState;
