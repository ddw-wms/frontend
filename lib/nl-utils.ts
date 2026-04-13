import { useMemo } from 'react';

interface NlGridTheme {
    headerBg?: string;
    headerBorder?: string;
    headerBorderLight?: string;
    headerCellBorder?: string;
    hoverBg?: string;
    hoverBgLight?: string;
    focusBorder?: string;
    focusBorderLight?: string;
    rangeBg?: string;
    rangeBgLight?: string;
}

const DEFAULT_THEME: NlGridTheme = {
    headerBg: '#1e3a5f',
    headerBorder: '#10b981',
    headerBorderLight: '#059669',
    headerCellBorder: '#3b5998',
    hoverBg: 'rgba(59, 130, 246, 0.15)',
    hoverBgLight: '#eff6ff',
    focusBorder: '#38bdf8',
    focusBorderLight: '#2563eb',
    rangeBg: 'rgba(59, 130, 246, 0.25)',
    rangeBgLight: '#dbeafe',
};

/**
 * Shared AG Grid dark/light theme styles for NL module pages.
 * Uses MUI sx overrides (NOT ag-theme-quartz-dark class) for dark mode.
 */
export function useNlGridSx(isDarkMode: boolean, theme?: NlGridTheme) {
    const t = { ...DEFAULT_THEME, ...theme };
    return useMemo(() => ({
        height: '100%', width: '100%',
        bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
        border: isDarkMode ? '1px solid #475569' : '1px solid #d1d5db',
        borderRadius: '4px', overflow: 'hidden',
        '& .ag-root-wrapper': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important', border: 'none' },
        '& .ag-root': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },
        '& .ag-header': { backgroundColor: `${t.headerBg} !important`, borderBottom: isDarkMode ? `2px solid ${t.headerBorder}` : `2px solid ${t.headerBorderLight}`, fontWeight: 700 },
        '& .ag-header-cell': { padding: '0 12px', fontWeight: 700, fontSize: '0.75rem', backgroundColor: `${t.headerBg} !important`, color: '#ffffff !important', borderRight: `1px solid ${t.headerCellBorder}`, textTransform: 'uppercase', letterSpacing: '0.02em' },
        '& .ag-header-cell:last-child': { borderRight: 'none' },
        '& .ag-header-row': { backgroundColor: `${t.headerBg} !important` },
        '& .ag-header-viewport': { backgroundColor: `${t.headerBg} !important` },
        '& .ag-header-container': { backgroundColor: `${t.headerBg} !important` },
        '& .ag-header-cell-label': { color: '#ffffff !important' },
        '& .ag-header-cell-text': { color: '#ffffff !important' },
        '& .ag-icon': { color: '#94a3b8 !important' },
        '& .ag-body-viewport': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },
        '& .ag-center-cols-viewport': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },
        '& .ag-center-cols-container': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },
        '& .ag-center-cols-clipper': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },
        '& .ag-pinned-left-cols-container, & .ag-pinned-right-cols-container': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },
        '& .ag-body-horizontal-scroll-viewport': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },
        '& .ag-body': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },
        '& .ag-row': { borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e5e7eb' },
        '& .ag-row-even': { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' },
        '& .ag-row-odd': { backgroundColor: isDarkMode ? '#1a2536' : '#f8fafc' },
        '& .ag-cell': { borderRight: isDarkMode ? '1px solid #334155' : '1px solid #e5e7eb', color: isDarkMode ? '#f1f5f9' : '#1e293b', display: 'flex', alignItems: 'center' },
        '& .ag-cell:last-child': { borderRight: 'none' },
        '& .ag-row-hover': { backgroundColor: isDarkMode ? `${t.hoverBg} !important` : `${t.hoverBgLight} !important` },
        '& .ag-cell-focus': { border: isDarkMode ? `2px solid ${t.focusBorder} !important` : `2px solid ${t.focusBorderLight} !important`, outline: 'none' },
        '& .ag-cell-range-selected': { backgroundColor: isDarkMode ? `${t.rangeBg} !important` : `${t.rangeBgLight} !important` },
        '& > div': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff' },
        '& .ag-overlay-loading-wrapper, & .ag-overlay-no-rows-wrapper': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },
    }), [
        isDarkMode,
        t.headerBg,
        t.headerBorder,
        t.headerBorderLight,
        t.headerCellBorder,
        t.hoverBg,
        t.hoverBgLight,
        t.focusBorder,
        t.focusBorderLight,
        t.rangeBg,
        t.rangeBgLight,
    ]);
}

/**
 * Format a date string to DD-Mon-YY (e.g., "09-Apr-26")
 */
export const nlFormatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
};

export const nlFormatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};
