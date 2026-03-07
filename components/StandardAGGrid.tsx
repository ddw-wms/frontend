// File: components/StandardAGGrid.tsx
// Standardized AG Grid wrapper for consistency across all pages

import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Box, useTheme, useMediaQuery, Paper, CircularProgress } from '@mui/material';
import 'ag-grid-community/styles/ag-theme-quartz.css';

export const _isModule = true;

interface StandardAGGridProps {
    rowData: any[];
    columnDefs: any[];
    defaultColDef?: any;
    onGridReady?: (params: any) => void;
    onFirstDataRendered?: (params: any) => void;
    onCellClicked?: (params: any) => void;
    onRowClicked?: (params: any) => void;
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
    pagination = true,
    paginationPageSize,
    paginationPageSizeSelector,
    domLayout = 'normal',
    height = '600px',
    minHeight = '400px',
    suppressMovableColumns,
    enableCellTextSelection = true,
    animateRows = false,
    loading = false,
    ...otherProps
}) => {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));
    const gridRef = useRef<any>(null);

    // Rapid scroll detection — show overlay spinner when user scrolls very fast
    const [isRapidScrolling, setIsRapidScrolling] = useState(false);
    const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollCountRef = useRef(0);
    const scrollWindowRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isRapidScrollingRef = useRef(false);

    const handleBodyScroll = useCallback(() => {
        scrollCountRef.current++;
        // Reset count every 300ms to measure frequency in rolling windows
        if (!scrollWindowRef.current) {
            scrollWindowRef.current = setTimeout(() => {
                scrollCountRef.current = 0;
                scrollWindowRef.current = null;
            }, 300);
        }
        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
        // 5+ scroll events in 300ms window = rapid scrolling
        if (scrollCountRef.current >= 5 && !isRapidScrollingRef.current) {
            isRapidScrollingRef.current = true;
            setIsRapidScrolling(true);
        }
        // 150ms after last scroll event = scrolling stopped
        scrollTimerRef.current = setTimeout(() => {
            isRapidScrollingRef.current = false;
            setIsRapidScrolling(false);
            scrollCountRef.current = 0;
        }, 150);
    }, []);

    useEffect(() => {
        return () => {
            if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
            if (scrollWindowRef.current) clearTimeout(scrollWindowRef.current);
        };
    }, []);

    const responsivePageSize = useMemo(() =>
        paginationPageSize || (isMobile ? 25 : isTablet ? 50 : 100),
        [paginationPageSize, isMobile, isTablet]
    );

    const responsivePageSizeSelector = useMemo(() =>
        paginationPageSizeSelector || (isMobile ? [25, 50, 100] : [50, 100, 200, 500]),
        [paginationPageSizeSelector, isMobile]
    );

    const standardDefaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: isMobile ? 100 : 120,
        cellStyle: {
            fontSize: isMobile ? '12px' : '13px',
            padding: isMobile ? '4px 8px' : '8px 12px',
            display: 'flex',
            alignItems: 'center',
        },
        ...defaultColDef,
    }), [isMobile, defaultColDef]);

    const handleGridReady = useCallback((params: any) => {
        gridRef.current = params.api;
        onGridReady?.(params);
    }, [onGridReady]);

    return (
        <Paper
            elevation={0}
            sx={{
                position: 'relative',
                width: '100%',
                height: domLayout === 'autoHeight' ? 'auto' : height,
                minHeight: domLayout === 'autoHeight' ? 'auto' : minHeight,
                overflow: 'hidden',
                borderRadius: { xs: 0, md: 3 },
                border: { xs: 'none', md: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)' },
                boxShadow: { xs: 'none', md: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.05), 0 4px 6px rgba(0,0,0,0.03)' },
                transition: 'box-shadow 0.2s ease',
                '&:hover': {
                    boxShadow: { xs: 'none', md: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.08)' },
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
                    '--ag-header-foreground-color': isDarkMode ? '#e2e8f0' : '#1e293b',
                    '--ag-header-background-color': isDarkMode ? '#1e293b' : '#f8fafc',
                    '--ag-background-color': isDarkMode ? '#0f172a' : '#ffffff',
                    '--ag-foreground-color': isDarkMode ? '#e2e8f0' : '#1e293b',
                    '--ag-border-color': isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    '--ag-odd-row-background-color': isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(248, 250, 252, 0.5)',
                    '--ag-row-hover-color': isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(30, 64, 175, 0.04)',
                    '--ag-selected-row-background-color': isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(30, 64, 175, 0.08)',
                    '--ag-font-size': isMobile ? '13px' : '14px',
                    '--ag-font-family': 'Inter, -apple-system, sans-serif',
                    '--ag-cell-horizontal-padding': isMobile ? '8px' : '12px',
                    '--ag-range-selection-border-color': '#1e40af',
                    '& .ag-root-wrapper': {
                        borderRadius: { xs: 0, md: 3 },
                        border: 'none',
                    },
                    '& .ag-header': {
                        borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
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
                        borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)',
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
                        borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                        background: isDarkMode ? '#1e293b' : '#fafbfc',
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
                        background: isDarkMode ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)',
                        backdropFilter: 'blur(4px)',
                    },
                    '& .ag-overlay-loading-center': {
                        borderRadius: 2,
                        boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
                        padding: '16px 24px',
                        background: isDarkMode ? '#1e293b' : 'white',
                        color: isDarkMode ? '#e2e8f0' : 'inherit',
                    },
                    '& .ag-overlay-no-rows-center': {
                        padding: '24px',
                        color: isDarkMode ? '#94a3b8' : '#64748b',
                        fontSize: '14px',
                    },
                }}
            >
                <AgGridReact
                    ref={gridRef}
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={standardDefaultColDef}
                    onGridReady={handleGridReady}
                    onFirstDataRendered={onFirstDataRendered}
                    onCellClicked={onCellClicked}
                    onRowClicked={onRowClicked}
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
                    // ⚡ PERFORMANCE: Optimizations for smooth fast scrolling
                    rowBuffer={20}
                    suppressRowTransform={true}
                    debounceVerticalScrollbar={true}
                    onBodyScroll={handleBodyScroll}
                    overlayNoRowsTemplate={'<span style="padding: 24px; font-size: 14px;">No data found</span>'}
                    suppressScrollOnNewData={true}
                    alwaysShowVerticalScroll={true}
                    {...otherProps}
                />
            </Box>
            {isRapidScrolling && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isDarkMode ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.6)',
                        backdropFilter: 'blur(2px)',
                        zIndex: 10,
                        pointerEvents: 'none',
                    }}
                >
                    <CircularProgress size={28} sx={{ color: isDarkMode ? '#60a5fa' : '#1e40af' }} />
                </Box>
            )}
        </Paper>
    );
};

export default StandardAGGrid;
