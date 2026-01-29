// File: components/StandardAGGrid.tsx
// Standardized AG Grid wrapper for consistency across all pages

import React, { useRef, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Box, useTheme, useMediaQuery, Paper } from '@mui/material';
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
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));
    const gridRef = useRef<any>(null);

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
                    {...otherProps}
                />
            </Box>
        </Paper>
    );
};

export default StandardAGGrid;
