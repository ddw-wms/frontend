// File: components/StandardTableStyles.ts
// Standardized table styling constants for consistency across all pages

export const tableCellStyle = {
    py: 0.25,
    px: 0.8,
    fontSize: '0.875rem',
    border: '1px solid #e0e0e0',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    maxWidth: '100%'
};

export const tableHeaderStyle = {
    bgcolor: '#1565c0',
    color: 'white',
    fontWeight: '700',
    py: 0.3,
    px: 0.8,
    border: '1px solid #1565c0',
    position: 'sticky' as const,
    top: 0,
    zIndex: 3,
    fontSize: '0.8rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px'
};

export const TABLE_ROW_HEIGHT = 30; // pixels
export const TABLE_HEADER_HEIGHT = 40; // pixels

export const getTableRowHoverStyle = {
    '&:hover': { bgcolor: '#f5f5f5' },
    height: TABLE_ROW_HEIGHT
};

export const BUTTON_SIZES = {
    compact: { height: 32, fontSize: '0.8rem', padding: '4px 10px' },
    normal: { height: 36, fontSize: '0.85rem', padding: '6px 12px' },
    large: { height: 40, fontSize: '0.9rem', padding: '8px 16px' }
};

export const FILTER_SIZES = {
    batchId: 160,
    status: 140,
    brand: 140,
    category: 140,
    search: 250
};

export const COLORS = {
    primary: '#1976d2',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#d32f2f',
    background: '#fafafa',
    border: '#e0e0e0',
    header: '#1565c0'
};
