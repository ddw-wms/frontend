// File: components/StandardTableStyles.ts
// Enhanced AG Grid styling utilities for consistency
import { useTheme, useMediaQuery } from '@mui/material';

export const useStandardGridStyles = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));

    return {
        containerStyle: {
            width: '100%',
            height: '100%',
        },
        gridStyle: {
            width: '100%',
            height: '100%',
        },
        defaultColDef: {
            sortable: true,
            filter: true,
            resizable: true,
            flex: 1,
            minWidth: isMobile ? 100 : 120,
            cellStyle: {
                fontSize: isMobile ? '12px' : '13px',
                padding: isMobile ? '4px 8px' : '8px 12px',
            },
        },
        gridOptions: {
            headerHeight: isMobile ? 40 : 48,
            rowHeight: isMobile ? 36 : 42,
            animateRows: true,
            enableCellTextSelection: true,
            suppressMovableColumns: isMobile,
            suppressMenuHide: false,
            pagination: true,
            paginationPageSize: isMobile ? 25 : 50,
            paginationPageSizeSelector: [25, 50, 100, 200],
            suppressPaginationPanel: false,
            domLayout: 'normal' as const,
        },
        theme: 'ag-theme-quartz',
    };
};

export const getStatusCellStyle = (status: string) => {
    const statusColors: Record<string, { background: string; color: string }> = {
        pending: { background: '#fff3cd', color: '#856404' },
        'in-progress': { background: '#cce5ff', color: '#004085' },
        completed: { background: '#d4edda', color: '#155724' },
        approved: { background: '#d4edda', color: '#155724' },
        rejected: { background: '#f8d7da', color: '#721c24' },
        failed: { background: '#f8d7da', color: '#721c24' },
        success: { background: '#d4edda', color: '#155724' },
        error: { background: '#f8d7da', color: '#721c24' },
        warning: { background: '#fff3cd', color: '#856404' },
        active: { background: '#d1ecf1', color: '#0c5460' },
        inactive: { background: '#e2e3e5', color: '#383d41' },
    };

    return statusColors[status.toLowerCase()] || { background: '#e2e3e5', color: '#383d41' };
};

export const statusCellRenderer = (params: any) => {
    const status = params.value?.toLowerCase() || '';
    const styles = getStatusCellStyle(status);

    return `
    <span style="
      background: ${styles.background};
      color: ${styles.color};
      padding: 4px 12px;
      border-radius: 12px;
      font-weight: 500;
      font-size: 12px;
      display: inline-block;
      text-transform: capitalize;
    ">
      ${params.value || '-'}
    </span>
  `;
};

export const dateCellRenderer = (params: any) => {
    if (!params.value) return '-';
    try {
        const date = new Date(params.value);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return params.value;
    }
};

export const currencyCellRenderer = (params: any) => {
    if (!params.value && params.value !== 0) return '-';
    return `₹${parseFloat(params.value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const numberCellRenderer = (params: any) => {
    if (!params.value && params.value !== 0) return '-';
    return parseFloat(params.value).toLocaleString('en-IN');
};

export default useStandardGridStyles;
