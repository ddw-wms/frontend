// File: components/StandardAGGrid.tsx
// Standardized AG Grid wrapper for consistency across all pages
// ⚡ OPTIMIZED: Added useMemo to prevent unnecessary re-renders
// 🗃️ ENHANCED: Integrated with centralized grid state persistence

import React, { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Box, useTheme, useMediaQuery, Paper } from '@mui/material';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import {
    loadGridState,
    debouncedSaveGridState,
    extractColumnWidths,
    ColumnState,
} from '@/lib/gridStateManager';

export const _isModule = true;

interface StandardAGGridProps {
    rowData: any[];
    columnDefs: any[];
    defaultColDef?: any;
    onGridReady?: (params: any) => void;
    onFirstDataRendered?: (params: any) => void;
    onCellClicked?: (params: any) => void;
    onRowClicked?: (params: any) => void;
    onColumnResized?: (params: any) => void;
    onColumnMoved?: (params: any) => void;
    onColumnVisible?: (params: any) => void;
    pagination?: boolean;
    paginationPageSize?: number;
    paginationPageSizeSelector?: number[];
    domLayout?: 'normal' | 'autoHeight' | 'print';
    height?: string | number;
    minHeight?: string | number;
    suppressMovableColumns?: boolean;
    enableCellTextSelection?: boolean;
    animateRows?: boolean;
    loading?: boolean;
    /** Unique page identifier for state persistence (e.g., 'inbound', 'outbound') */
    pageId?: string;
    /** Grid identifier for pages with multiple grids (e.g., 'list', 'multiEntry') */
    gridId?: string;
    /** Whether to persist column state (default: true if pageId is provided) */
    persistState?: boolean;
    /** Whether to apply saved column order on restore (default: true) */
    applyColumnOrder?: boolean;
    /** Callback when column widths change */
    onColumnWidthsChange?: (widths: Record<string, number>) => void;
    [key: string]: any;
}

export const StandardAGGrid: React.FC<StandardAGGridProps> = ({
    rowData,
    columnDefs,
    defaultColDef,
    onGridReady,
    onFirstDataRendered,
    onCellClicked,
    onRowClicked,
    onColumnResized,
    onColumnMoved,
    onColumnVisible,
    pagination = true,
    paginationPageSize,
    paginationPageSizeSelector,
    domLayout = 'normal',
    height = '600px',
    minHeight = '400px',
    suppressMovableColumns,
    enableCellTextSelection = true,
    animateRows = false, // ⚡ Default to false for better performance
    loading = false,
    pageId,
    gridId = 'main',
    persistState,
    applyColumnOrder = true,
    onColumnWidthsChange,
    ...otherProps
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));
    const gridRef = useRef<any>(null);
    const gridApiRef = useRef<any>(null);
    const hasRestoredStateRef = useRef(false);
    const hasAutoSizedRef = useRef(false);

    // Determine if we should persist state
    const shouldPersistState = persistState ?? !!pageId;

    // ⚡ OPTIMIZED: Memoize responsive values to prevent recalculation
    const responsivePageSize = useMemo(() =>
        paginationPageSize || (isMobile ? 25 : isTablet ? 50 : 100),
        [paginationPageSize, isMobile, isTablet]
    );

    const responsivePageSizeSelector = useMemo(() =>
        paginationPageSizeSelector || (isMobile ? [25, 50, 100] : [50, 100, 200, 500]),
        [paginationPageSizeSelector, isMobile]
    );

    // ⚡ OPTIMIZED: Memoize defaultColDef to prevent AG Grid re-renders
    // 🗃️ FIXED: Removed flex:1 to prevent width reset issues
    const standardDefaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: isMobile ? 100 : 120,
        suppressSizeToFit: true, // Preserve user widths
        cellStyle: {
            fontSize: isMobile ? '12px' : '13px',
            padding: isMobile ? '4px 8px' : '8px 12px',
            display: 'flex',
            alignItems: 'center',
        },
        ...defaultColDef,
    }), [isMobile, defaultColDef]);

    // 🗃️ Save column state helper
    const saveColumnState = useCallback(() => {
        if (!shouldPersistState || !pageId || !gridApiRef.current) return;

        try {
            const columnState = gridApiRef.current.getColumnState();
            if (columnState && columnState.length > 0) {
                debouncedSaveGridState(pageId, columnState, gridId, 300);

                // Update column widths callback
                if (onColumnWidthsChange) {
                    const widths = extractColumnWidths(columnState);
                    onColumnWidthsChange(widths);
                }
            }
        } catch {
            // Ignore save errors
        }
    }, [shouldPersistState, pageId, gridId, onColumnWidthsChange]);

    // 🗃️ Grid ready handler with state restoration
    const handleGridReady = useCallback(async (params: any) => {
        gridRef.current = params;
        gridApiRef.current = params.api;

        // Restore saved state if persistence is enabled
        if (shouldPersistState && pageId && !hasRestoredStateRef.current) {
            try {
                const savedState = await loadGridState(pageId, gridId);
                if (savedState && savedState.length > 0) {
                    params.api.applyColumnState({
                        state: savedState,
                        applyOrder: applyColumnOrder,
                    });
                    hasRestoredStateRef.current = true;
                    hasAutoSizedRef.current = true;

                    if (onColumnWidthsChange) {
                        const widths = extractColumnWidths(savedState);
                        onColumnWidthsChange(widths);
                    }
                }
            } catch {
                // Ignore restore errors
            }
        }

        onGridReady?.(params);
    }, [shouldPersistState, pageId, gridId, applyColumnOrder, onColumnWidthsChange, onGridReady]);

    // 🗃️ Column resized handler
    const handleColumnResized = useCallback((params: any) => {
        if (params.finished) {
            saveColumnState();
        }
        onColumnResized?.(params);
    }, [saveColumnState, onColumnResized]);

    // 🗃️ Column moved handler
    const handleColumnMoved = useCallback((params: any) => {
        if (params.finished) {
            saveColumnState();
        }
        onColumnMoved?.(params);
    }, [saveColumnState, onColumnMoved]);

    // 🗃️ Column visibility handler
    const handleColumnVisible = useCallback((params: any) => {
        saveColumnState();
        onColumnVisible?.(params);
    }, [saveColumnState, onColumnVisible]);

    // 🗃️ First data rendered - auto-size if no saved state
    const handleFirstDataRendered = useCallback((params: any) => {
        if (!hasAutoSizedRef.current && !hasRestoredStateRef.current && params.api) {
            try {
                const allColIds = params.api.getColumns()?.map((col: any) => col.getColId()) || [];
                const colsToAutoSize = allColIds.filter((id: string) =>
                    !['actions', 'checkbox', 'selection', 'sno'].includes(id)
                );

                if (colsToAutoSize.length > 0) {
                    params.api.autoSizeColumns(colsToAutoSize);
                    hasAutoSizedRef.current = true;

                    // Save auto-sized state
                    setTimeout(() => saveColumnState(), 100);
                }
            } catch {
                // Ignore auto-size errors
            }
        }
        hasAutoSizedRef.current = true;
        onFirstDataRendered?.(params);
    }, [saveColumnState, onFirstDataRendered]);

    return (
        <Paper
            elevation={0}
            sx={{
                width: '100%',
                height: domLayout === 'autoHeight' ? 'auto' : height,
                minHeight: domLayout === 'autoHeight' ? 'auto' : minHeight,
                overflow: 'hidden',
                borderRadius: { xs: 0, md: 3 },
                border: { xs: 'none', md: '1px solid rgba(0,0,0,0.06)' },
                boxShadow: { xs: 'none', md: '0 1px 3px rgba(0,0,0,0.05), 0 4px 6px rgba(0,0,0,0.03)' },
                transition: 'box-shadow 0.2s ease',
                '&:hover': {
                    boxShadow: { xs: 'none', md: '0 4px 12px rgba(0,0,0,0.08)' },
                },
            }}
        >
            <Box
                className="ag-theme-quartz"
                sx={{
                    width: '100%',
                    height: '100%',
                    '--ag-header-height': isMobile ? '44px' : '48px',
                    '--ag-row-height': isMobile ? '44px' : '46px',
                    '--ag-header-foreground-color': '#1e293b',
                    '--ag-header-background-color': '#f8fafc',
                    '--ag-border-color': 'rgba(0,0,0,0.06)',
                    '--ag-odd-row-background-color': 'rgba(248, 250, 252, 0.5)',
                    '--ag-row-hover-color': 'rgba(30, 64, 175, 0.04)',
                    '--ag-selected-row-background-color': 'rgba(30, 64, 175, 0.08)',
                    '--ag-font-size': isMobile ? '13px' : '14px',
                    '--ag-font-family': 'Inter, -apple-system, sans-serif',
                    '--ag-cell-horizontal-padding': isMobile ? '8px' : '12px',
                    '--ag-range-selection-border-color': '#1e40af',
                    '& .ag-root-wrapper': {
                        borderRadius: { xs: 0, md: 3 },
                        border: 'none',
                    },
                    '& .ag-header': {
                        borderBottom: '1px solid rgba(0,0,0,0.08)',
                        fontWeight: 600,
                    },
                    '& .ag-header-cell': {
                        fontWeight: 600,
                        letterSpacing: '0.01em',
                    },
                    '& .ag-header-cell-text': {
                        textTransform: 'none',
                    },
                    '& .ag-row': {
                        transition: 'background-color 0.15s ease',
                        borderBottom: '1px solid rgba(0,0,0,0.04)',
                    },
                    '& .ag-row:last-child': {
                        borderBottom: 'none',
                    },
                    '& .ag-cell': {
                        display: 'flex',
                        alignItems: 'center',
                        lineHeight: 1.5,
                    },
                    '& .ag-paging-panel': {
                        height: isMobile ? '52px' : '56px',
                        borderTop: '1px solid rgba(0,0,0,0.06)',
                        background: '#fafbfc',
                        justifyContent: 'center',
                        gap: isMobile ? '8px' : '16px',
                        padding: isMobile ? '0 8px' : '0 16px',
                    },
                    '& .ag-paging-button': {
                        borderRadius: '8px',
                        minWidth: isMobile ? '36px' : '32px',
                        height: isMobile ? '36px' : '32px',
                        '&:hover': {
                            backgroundColor: 'rgba(30, 64, 175, 0.08)',
                        },
                    },
                    '& .ag-paging-page-size': {
                        marginRight: isMobile ? '4px' : '8px',
                    },
                    '& .ag-icon': {
                        fontSize: isMobile ? '18px' : '16px',
                    },
                    '& .ag-overlay-loading-wrapper': {
                        background: 'rgba(255,255,255,0.9)',
                        backdropFilter: 'blur(4px)',
                    },
                    '& .ag-overlay-loading-center': {
                        borderRadius: 2,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        padding: '16px 24px',
                        background: 'white',
                    },
                }}
            >
                <AgGridReact
                    ref={gridRef}
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={standardDefaultColDef}
                    onGridReady={handleGridReady}
                    onFirstDataRendered={handleFirstDataRendered}
                    onCellClicked={onCellClicked}
                    onRowClicked={onRowClicked}
                    onColumnResized={handleColumnResized}
                    onColumnMoved={handleColumnMoved}
                    onColumnVisible={handleColumnVisible}
                    pagination={pagination}
                    paginationPageSize={responsivePageSize}
                    paginationPageSizeSelector={responsivePageSizeSelector}
                    headerHeight={isMobile ? 44 : 48}
                    rowHeight={isMobile ? 44 : 46}
                    animateRows={animateRows}
                    enableCellTextSelection={enableCellTextSelection}
                    suppressMovableColumns={suppressMovableColumns !== undefined ? suppressMovableColumns : isMobile}
                    domLayout={domLayout}
                    loading={loading}
                    // ⚡ Performance optimizations for large datasets
                    rowBuffer={isMobile ? 10 : 20}
                    suppressScrollOnNewData={true}
                    maintainColumnOrder={true}
                    ensureDomOrder={true}
                    suppressRowTransform={true}
                    valueCache={true}
                    debounceVerticalScrollbar={true}
                    {...otherProps}
                />
            </Box>
        </Paper>
    );
};

export default StandardAGGrid;
