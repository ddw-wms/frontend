'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Box,
    Paper,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    MenuItem,
    Chip,
    Stack,
    Tab,
    Tabs,
    CircularProgress,
    Alert,
    Select,
    FormControl,
    InputLabel,
    Checkbox,
    FormControlLabel,
    LinearProgress,
    Divider,
    Card,
    CardContent,
    Autocomplete,
    Collapse,
    Tooltip,
    useMediaQuery,
    useTheme,
    AppBar,
    Toolbar,
    IconButton,
    Switch,
    Pagination,
    InputBase,
    Fade,
    Drawer,
    Accordion,
    AccordionSummary,
    AccordionDetails,
} from '@mui/material';
import {
    Download as DownloadIcon,
    Settings as SettingsIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
    CheckCircle,
    Upload as UploadIcon,
    ExpandMore as ExpandMoreIcon,
    FilterList as FilterListIcon,
    Close as CloseIcon,
    KeyboardArrowLeft,
    KeyboardArrowRight,
    FirstPage,
    LastPage,
    AccessTime,
    PieChart as PieChartIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon,
    Menu as MenuIcon,
    ViewColumn as ViewColumnIcon,
    TableChart as TableChartIcon,
    Link as LinkIcon,
} from '@mui/icons-material';
import { outboundAPI, customerAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import {
    removeMultipleFromAvailableCache,
    isCacheEnabled as isWMSCacheEnabled
} from '@/lib/wmsCache';

import AppLayout from '@/components/AppLayout';
import localforage from 'localforage';
import { StandardPageHeader, StandardTabs, BatchManagementTab, CustomerAutocomplete, WSNOverwriteDialog } from '@/components';
import type { WSNOverwriteDialogData } from '@/components';
import { useTableRowHeight } from '@/app/context/AppearanceContext';
import toast, { Toaster } from 'react-hot-toast';
// ⚡ OPTIMIZED: XLSX not needed here - exports handled server-side
// import * as XLSX from 'xlsx'; // Removed - unused
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ClientSideRowModelModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';
// Simple localStorage-based grid state (native ag-Grid pattern)

// Register AG Grid modules ONCE (include ClientSideRowModel for client-side features)
ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

// ⚡ WINDOW-LEVEL CACHE: Persists data outside React lifecycle for instant navigation
declare global {
    interface Window {
        __OUTBOUND_LIST_CACHE__?: {
            data: OutboundItem[];
            total: number;
            timestamp: number;
            warehouseId?: number;
        };
    }
}

// Helper to get current warehouse ID from localStorage
const getCurrentWarehouseId = (): number | null => {
    try {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('activeWarehouse');
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed?.id ?? null;
            }
        }
    } catch { /* ignore */ }
    return null;
};

// Helper to get cached data (checks both window cache and sessionStorage)
// ⚡ FIX: Only returns cache if warehouseId matches current warehouse
const getCachedOutboundListData = (): OutboundItem[] => {
    const currentWarehouseId = getCurrentWarehouseId();

    // Priority 1: Window cache (fastest, survives navigation)
    if (typeof window !== 'undefined' && window.__OUTBOUND_LIST_CACHE__?.data?.length) {
        // Only use cache if warehouse matches
        if (window.__OUTBOUND_LIST_CACHE__.warehouseId === currentWarehouseId) {
            return window.__OUTBOUND_LIST_CACHE__.data;
        }
    }
    // Priority 2: SessionStorage (survives page refresh) - skip if warehouse mismatch
    try {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('outbound_list_cache');
            const savedWarehouseId = sessionStorage.getItem('outbound_list_cache_warehouseId');
            if (saved && savedWarehouseId && parseInt(savedWarehouseId, 10) === currentWarehouseId) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Also populate window cache for faster subsequent access
                    window.__OUTBOUND_LIST_CACHE__ = { data: parsed, total: parsed.length, timestamp: Date.now(), warehouseId: currentWarehouseId };
                    return parsed;
                }
            }
        }
    } catch { /* ignore */ }
    return [];
};

import { useOutboundPermissions } from '@/hooks/usePagePermissions';
import { useFullscreen, useLiveSession } from '@/hooks';
import BulkUploadCard from '@/components/BulkUploadCard';
import LiveViewPanel from '@/components/LiveViewPanel';

// ⚡ OUTBOUND INVENTORY CACHE - for instant WSN lookups
import {
    getAvailableInventoryByWSN,
    getAvailableInventoryByWSNFast,
    loadAvailableInventory,
    getOutboundCacheStats,
    clearOutboundCache,
    removeFromCache,
    needsCacheRefresh,
    warmupOutboundMemoryCache,
    clearOutboundMemoryCache
} from '@/lib/outboundInventoryCache';

// Tab definitions with permission codes
const ALL_TABS = ['Outbound List', 'Single Entry', 'Bulk Upload', 'Multi Entry', 'Batch Management'];
const TAB_CODES = ['list', 'single', 'bulk', 'multi', 'batches'];

const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = months[d.getMonth()];
    const yy = String(d.getFullYear()).slice(-2);
    return `${day}-${mon}-${yy}`;
};

const ALL_LIST_COLUMNS = [
    'wsn',
    'customer_name',
    'dispatch_date',
    'vehicle_no',
    'source',
    'product_title',
    'brand',
    'cms_vertical',
    'wid',
    'fsn',
    'order_id',
    'fkqc_remark',
    'fk_grade',
    'hsn_sac',
    'igst_rate',
    'fsp',
    'mrp',
    'vrp',
    'yield_value',
    'invoice_date',
    'fkt_link',
    'wh_location',
    'p_type',
    'p_size',
    'batch_id',
    'dispatch_remarks',
    'other_remarks',
    'quantity',
    'created_user_name',
];

const ALL_MULTI_COLUMNS = [
    'wsn',
    'dispatch_remarks',
    'other_remarks',
    'product_title',
    'brand',
    'cms_vertical',
    'source',
    'wid',
    'fsn',
    'order_id',
    'fkqc_remark',
    'fk_grade',
    'hsn_sac',
    'igst_rate',
    'fsp',
    'mrp',
    'vrp',
    'yield_value',
    'invoice_date',
    'fkt_link',
    'wh_location',
    'p_type',
    'p_size',
    'quantity',
];

const DEFAULT_MULTI_COLUMNS = [
    'wsn',
    'dispatch_remarks',
    'other_remarks',
    'product_title',
    'brand',
    'cms_vertical',
    'fsp',
    'mrp',
    'wid',
    'fsn',
    'fkqc_remark',

];

const EDITABLE_COLUMNS = ['wsn', 'dispatch_remarks', 'other_remarks', 'quantity'];

interface OutboundItem {
    id: number;
    [key: string]: any;
}

interface StatsType {
    picking: number;
    qc: number;
    inbound: number;
    total: number;
}

interface BulkProgressType {
    show: boolean;
    processed: number;
    total: number;
    successCount: number;
    errorCount: number;
    batchId: string;
}

interface Batch {
    batch_id: string;
    count: number;
    last_updated: string;
}

export default function OutboundPage() {

    const router = useRouter();
    const { activeWarehouse } = useWarehouse();
    const [user, setUser] = useState<any>(null);

    // Get table row height from appearance settings
    const tableRowHeight = useTableRowHeight();

    // Permission hook
    const { filterTabs, canSeeTab, canSeeButton, canAccessButton, isAdmin, isLoading: permLoading } = useOutboundPermissions();

    // Get visible tabs based on permissions
    const visibleTabs = useMemo(() => filterTabs(ALL_TABS, TAB_CODES), [filterTabs]);
    const visibleTabCodes = useMemo(() => {
        if (isAdmin) return TAB_CODES;
        return TAB_CODES.filter((code) => canSeeTab(code));
    }, [canSeeTab, isAdmin]);

    const [tabValue, setTabValue] = useState(0);
    const currentTabCode = visibleTabCodes[tabValue];
    const gridRef = useRef<any>(null);  // For Multi Entry grid
    const listGridRef = useRef<any>(null);  // Separate ref for List grid
    const multiEntryContainerRef = useRef<HTMLDivElement>(null);  // Ref for fullscreen mode
    const columnApiRef = useRef<any>(null);
    const hasAutoFittedRef = useRef(false); // Track if auto-fit has been done
    const wsnInputRef = useRef<HTMLInputElement>(null);
    const wsnFetchTimerRef = useRef<NodeJS.Timeout | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // ====== FULLSCREEN MODE ======
    const { isFullscreen, toggleFullscreen } = useFullscreen(multiEntryContainerRef);

    // ⚡ EXCEL-LIKE: Refs for smooth scrolling and selection
    const userScrolledRef = useRef(false);
    const userScrollTimeoutRef = useRef<number | null>(null);
    const lastGridScrollTopRef = useRef(0);
    const isAutoScrollingRef = useRef(false);
    const multiRowsRef = useRef([] as any[]);
    const scrollAnimationFrameRef = useRef<number | null>(null);
    const scrollTimeoutRef = useRef<number | null>(null);

    // ⚡ SCANNER MODE: Detect rapid barcode scanner inputs
    const scanCountRef = useRef<number>(0);
    const lastScanTsRef = useRef<number | null>(null);
    const scanModeTimeoutRef = useRef<number | null>(null);
    const scanningModeRef = useRef<boolean>(false);
    const desiredRowIndexRef = useRef<number | null>(null);

    // ⚡ PERFORMANCE: Track unique row ID counter for efficient AG Grid updates
    const rowIdCounterRef = useRef(0);

    // ⚡ UNDO/REDO: Excel-like undo/redo for cell changes
    interface UndoAction {
        type: 'cell' | 'paste' | 'fillDown' | 'batch';
        rowIndex: number;
        field: string;
        oldValue: any;
        newValue: any;
        oldRowData?: any;
        newRowData?: any;
        // For batch operations (paste multiple cells)
        batchChanges?: Array<{
            rowIndex: number;
            field: string;
            oldValue: any;
            newValue: any;
        }>;
    }
    const undoStackRef = useRef<UndoAction[]>([]);
    const redoStackRef = useRef<UndoAction[]>([]);
    const MAX_UNDO_HISTORY = 100;

    // ⚡ ROW HIGHLIGHTING: For newly scanned/added rows
    const [highlightedRows, setHighlightedRows] = useState<Set<number>>(new Set());
    const highlightTimeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());

    // ⚡ CACHE STATE: Available inventory cache (manual toggle - Issue #6)
    const [cacheEnabled, setCacheEnabled] = useState<boolean>(() => {
        try { return localStorage.getItem('outbound_cacheEnabled') === 'true'; } catch { return false; }
    });
    const [cacheStats, setCacheStats] = useState<{ totalRecords: number; isReady: boolean } | null>(null);
    const [cacheLoading, setCacheLoading] = useState(false);
    const [cacheProgress, setCacheProgress] = useState<{ loaded: number; total: number; message: string } | null>(null);

    // ⚡ EXCEL-LIKE: Track selected cell range for multi-cell operations
    const [selectedRange, setSelectedRange] = useState<{
        startRow: number;
        endRow: number;
        startCol: string;
        endCol: string;
    } | null>(null);
    const rangeStartCellRef = useRef<{ rowIndex: number; colId: string } | null>(null);
    const selectedRangeRef = useRef<typeof selectedRange>(null);

    // ⚡ PERFORMANCE: Cache computed selection bounds
    const selectionBoundsRef = useRef<{
        minRow: number;
        maxRow: number;
        minCol: number;
        maxCol: number;
        colIndexMap: Map<string, number>;
    } | null>(null);

    // ⚡ EXCEL-LIKE: Track mouse drag state
    const isDraggingRef = useRef(false);
    const dragStartCellRef = useRef<{ rowIndex: number; colId: string } | null>(null);

    // ⚡ EXCEL-LIKE: Selection statistics (sum, count, average for numeric cells)
    const [selectionStats, setSelectionStats] = useState<{
        sum: number;
        count: number;
        average: number;
        numericCount: number;
    } | null>(null);

    // ⚡ PERFORMANCE: Debounce ref for selection stats calculation
    const selectionStatsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ====== WSN OVERWRITE DIALOG STATE ======
    const [wsnOverwriteDialog, setWsnOverwriteDialog] = useState<WSNOverwriteDialogData | null>(null);
    const pendingWSNRef = useRef<{ wsn: string; rowIndex: number; params: any } | null>(null);

    // ====== SINGLE ENTRY STATE ======
    const [singleWSN, setSingleWSN] = useState('');
    const [sourceData, setSourceData] = useState<any>(null);
    const [singleForm, setSingleForm] = useState({
        dispatch_date: new Date().toISOString().split('T')[0],
        customer_name: '',
        vehicle_no: '',
        dispatch_remarks: '',
        other_remarks: '',
    });
    const [singleLoading, setSingleLoading] = useState(false);
    const [duplicateWSN, setDuplicateWSN] = useState<any>(null);
    const [updateMode, setUpdateMode] = useState(false);



    // ====== MULTI ENTRY STATE (AG GRID) ======
    const generateEmptyRows = (count: number): OutboundItem[] => {
        return Array.from({ length: count }, () => {
            rowIdCounterRef.current += 1;
            return {
                id: 0, // Placeholder ID for empty rows
                _rowId: `row_${rowIdCounterRef.current}_${Date.now()}`, // ⚡ Unique row ID for AG Grid
                wsn: '',
                dispatch_date: new Date().toISOString().split('T')[0],
                customer_name: '',
                vehicle_no: '',
                dispatch_remarks: '',
                other_remarks: '',
                source: '',
                product_title: '',
                brand: '',
                mrp: '',
                fsp: '',
            };
        });
    };

    // Fast add 500 rows (used by Add +500 button) — use functional update for performance
    const add500Rows = () => {
        setMultiRows(prev => [...prev, ...generateEmptyRows(500)] as OutboundItem[]);
    };

    // ⚡ MULTI ENTRY: Export entered data to Excel (with all columns - user input + master data)
    const exportMultiEntryToExcel = async () => {
        try {
            // Get fresh data directly from AG Grid to ensure we have all the latest values
            const allGridRows: any[] = [];
            gridRef.current?.api?.forEachNode((node: any) => {
                if (node.data) allGridRows.push(node.data);
            });

            const dataToExport = allGridRows.filter((row: any) => row.wsn?.trim());
            if (dataToExport.length === 0) {
                toast.error('No data to export');
                return;
            }
            const XLSX = await import('xlsx');

            // Get customer name from form (selectedCustomer is the active field)
            const customerForExport = selectedCustomer || commonCustomer || '';
            const vehicleForExport = commonVehicle || '';
            const dateForExport = commonDate || new Date().toISOString().split('T')[0];

            // Prepare export data with all columns (user input + master data)
            const exportData = dataToExport.map((row: any, idx: number) => ({
                'Sr No': idx + 1,
                // User Input Columns
                'WSN': row.wsn || '',
                'Dispatch Date': row.dispatch_date || dateForExport,
                'Customer Name': row.customer_name || customerForExport,
                'Vehicle No': vehicleForExport, // Use only common vehicle field, not row data (which may have inbound vehicle)
                'Dispatch Remarks': row.dispatch_remarks || '',
                'Other Remarks': row.other_remarks || '',
                'Quantity': row.quantity || 1,
                // Master Data Columns
                'Source': row.source || '',
                'Product Title': row.product_title || '',
                'Brand': row.brand || '',
                'CMS Vertical': row.cms_vertical || '',
                'WID': row.wid || '',
                'FSN': row.fsn || '',
                'Order ID': row.order_id || '',
                'FKQC Remark': row.fkqc_remark || '',
                'FK Grade': row.fk_grade || '',
                'HSN/SAC': row.hsn_sac || '',
                'IGST Rate': row.igst_rate || '',
                'FSP': row.fsp || '',
                'MRP': row.mrp || '',
                'VRP': row.vrp || '',
                'Yield Value': row.yield_value || '',
                'Invoice Date': row.invoice_date || '',
                'FKT Link': row.fkt_link || '',
                'WH Location': row.wh_location || '',
                'Product Type': row.p_type || '',
                'Product Size': row.p_size || '',
            }));

            // Create workbook and worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Multi Outbound');

            // Auto-fit column widths
            const colWidths = Object.keys(exportData[0]).map(key => ({
                wch: Math.max(key.length, ...exportData.map(row => String((row as any)[key] || '').length)) + 2
            }));
            ws['!cols'] = colWidths;

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const filename = `Outbound_MultiEntry_${timestamp}.xlsx`;

            // Download the file
            XLSX.writeFile(wb, filename);
            toast.success(`✅ Exported ${dataToExport.length} rows to ${filename}`);
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Export failed');
        }
    };

    const [multiRows, setMultiRows] = useState<OutboundItem[]>(generateEmptyRows(500));
    const [multiLoading, setMultiLoading] = useState(false);
    //   const [multiResults, setMultiResults] = useState<any[]>([]);
    const [existingOutboundWSNs, setExistingOutboundWSNs] = useState<Set<string>>(new Set());
    const [duplicateWSNs, setDuplicateWSNs] = useState<Set<string>>(new Set());

    // ====== LIVE VIEW SESSION ======
    const isOnMultiTab = visibleTabCodes[tabValue] === 'multi';
    const { startSession: startLiveSession, updateEntries: updateLiveEntries, endSession: endLiveSession, isActive: isLiveSessionActive } = useLiveSession({
        warehouseId: activeWarehouse?.id,
        pageType: 'outbound',
        enabled: isOnMultiTab && !!activeWarehouse?.id,
    });

    // Auto-start live session when entering Multi Entry tab
    useEffect(() => {
        if (isOnMultiTab && activeWarehouse?.id && !isLiveSessionActive) {
            startLiveSession();
            // ⚡ Warm up memory cache for ultra-fast WSN lookups
            warmupOutboundMemoryCache(activeWarehouse.id).catch(err => {
                console.warn('Outbound memory cache warmup failed:', err);
            });
        } else if (!isOnMultiTab && isLiveSessionActive) {
            endLiveSession();
        }
    }, [isOnMultiTab, activeWarehouse?.id, isLiveSessionActive, startLiveSession, endLiveSession]);

    // Broadcast entries when multiRows change
    useEffect(() => {
        if (isLiveSessionActive && isOnMultiTab) {
            const validEntries = multiRows
                .map((row, idx) => ({
                    wsn: row.wsn || '',
                    product_title: row.product_title || '',
                    brand: row.brand || '',
                    mrp: row.mrp,
                    fsp: row.fsp,
                    cms_vertical: row.cms_vertical || '',
                    fkqc_remarks: row.fkqc_remark || '',
                    p_type: row.p_type || '',
                    p_size: row.p_size || '',
                    source: row.source || '',
                    wid: row.wid || '',
                    fsn: row.fsn || '',
                    order_id: row.order_id || '',
                    fk_grade: row.fk_grade || '',
                    hsn_sac: row.hsn_sac || '',
                    igst_rate: row.igst_rate,
                    vrp: row.vrp,
                    yield_value: row.yield_value,
                    invoice_date: row.invoice_date || '',
                    fkt_link: row.fkt_link || '',
                    wh_location: row.wh_location || '',
                    quantity: row.quantity,
                    dispatch_remarks: row.dispatch_remarks || '',
                    other_remarks: row.other_remarks || '',
                    row_index: idx,
                }))
                .filter(e => e.wsn.trim());
            updateLiveEntries(validEntries);
        }
    }, [multiRows, isLiveSessionActive, isOnMultiTab, updateLiveEntries]);

    // ---- Draft / Autosave (IndexedDB via localForage) ----
    const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
    const [draftSaving, setDraftSaving] = useState(false);
    const [draftExists, setDraftExists] = useState(false);
    const lastChangeAtRef = useRef<number | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [gridDuplicateWSNs, setGridDuplicateWSNs] = useState<Set<string>>(new Set());
    const [crossWarehouseWSNs, setCrossWarehouseWSNs] = useState<Set<string>>(new Set());
    const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_MULTI_COLUMNS);
    const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
    // Settings Panel state for Multi Entry
    const [outboundSettingsPanelOpen, setOutboundSettingsPanelOpen] = useState(false);
    const [settingsPanelExpanded, setSettingsPanelExpanded] = useState<string | false>('columns');

    // ====== EXPORT CONFIRMATION DIALOG ======
    const [exportConfirmOpen, setExportConfirmOpen] = useState(false);

    // ====== CATEGORY PIVOT DIALOG ======
    const [categoryPivotOpen, setCategoryPivotOpen] = useState(false);
    const [pivotGroupBy, setPivotGroupBy] = useState<'category' | 'brand' | 'p_type' | 'combined' | 'crosstab'>('category');
    const [categoryPivotSortBy, setCategoryPivotSortBy] = useState<'category' | 'qty' | 'fsp' | 'mrp'>('qty');
    const [categoryPivotSortDir, setCategoryPivotSortDir] = useState<'asc' | 'desc'>('desc');
    // Combined view filters (multiple selection)
    const [pivotCategoryFilter, setPivotCategoryFilter] = useState<string[]>([]);
    const [pivotBrandFilter, setPivotBrandFilter] = useState<string[]>([]);
    const [pivotPTypeFilter, setPivotPTypeFilter] = useState<string[]>([]);
    // Cross-Tab Pivot settings
    const [crossTabRowField, setCrossTabRowField] = useState<'category' | 'brand' | 'p_type'>('brand');
    const [crossTabColField, setCrossTabColField] = useState<'category' | 'brand' | 'p_type'>('p_type');
    const [crossTabFilter, setCrossTabFilter] = useState<string[]>([]);
    // Pivot Dialog fullscreen toggle
    const [pivotDialogFullscreen, setPivotDialogFullscreen] = useState(false);

    // ====== MULTI ENTRY COLUMN WIDTHS PERSISTENCE ======
    const [multiColumnWidths, setMultiColumnWidths] = useState<Record<string, number>>({});

    // ====== CTRL+O PRODUCT LINK SHORTCUT STATE ======
    const [ctrlOProductLinkEnabled, setCtrlOProductLinkEnabled] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('outbound_ctrlOProductLinkEnabled');
            return saved !== 'false'; // Default to true
        }
        return true;
    });

    // Track last scanned row data for Ctrl+O to open product link
    const lastScannedRowRef = useRef<any>(null);

    const [commonDate, setCommonDate] = useState(new Date().toISOString().split('T')[0]);
    const [commonCustomer, setCommonCustomer] = useState('');
    const [commonVehicle, setCommonVehicle] = useState('');
    const [multiErrorMessage, setMultiErrorMessage] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState('');

    // ====== OUTBOUND LIST STATE ======
    // ⚡ INSTANT NAVIGATION: Initialize from cache to prevent empty grid flash
    const [listData, setListData] = useState<OutboundItem[]>(() => getCachedOutboundListData());
    const [listLoading, setListLoading] = useState(() => getCachedOutboundListData().length === 0);
    const [isFetching, setIsFetching] = useState(() => getCachedOutboundListData().length === 0);
    // ⚡ PREVENT COLUMN RESIZE FLASH: Hide grid body until columns are auto-sized
    const [gridDataRendered, setGridDataRendered] = useState(false);

    // ⚡ SYNCHRONOUS MOUNT: Load cache BEFORE paint for instant display
    useLayoutEffect(() => {
        const cached = getCachedOutboundListData();
        if (cached.length > 0) {
            setListData(cached);
            setListLoading(false);
            setIsFetching(false);
        }
    }, []);

    const [initialLoadDone, setInitialLoadDone] = useState(() => getCachedOutboundListData().length > 0);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshSuccess, setRefreshSuccess] = useState(false);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(100);
    const [total, setTotal] = useState(0);
    const [searchFilter, setSearchFilter] = useState('');
    const [searchDebounced, setSearchDebounced] = useState('');
    const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const [sourceFilter, setSourceFilter] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');
    const [batchFilter, setBatchFilter] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    // Grid Settings (persisted)
    const [enableSorting, setEnableSorting] = useState<boolean>(() => {
        try { return localStorage.getItem('outbound_enableSorting') !== 'false'; } catch { return true; }
    });
    const [enableColumnFilters, setEnableColumnFilters] = useState<boolean>(() => {
        try { return localStorage.getItem('outbound_enableColumnFilters') !== 'false'; } catch { return true; }
    });
    const [enableColumnResize, setEnableColumnResize] = useState<boolean>(() => {
        try { return localStorage.getItem('outbound_enableColumnResize') !== 'false'; } catch { return true; }
    });
    const [enableCellEditing, setEnableCellEditing] = useState<boolean>(() => {
        try { return localStorage.getItem('outbound_enableCellEditing') !== 'false'; } catch { return true; }
    });
    const [gridSettingsOpen, setGridSettingsOpen] = useState(false);

    // ====== LIST OPTIONS PANEL STATE ======
    const [listOptionsPanelOpen, setListOptionsPanelOpen] = useState(false);
    const [listSettingsPanelExpanded, setListSettingsPanelExpanded] = useState<string | false>('filters');

    // Smooth loading helpers (prevent blinking overlay)
    const currentLoadIdRef = useRef(0);
    const outboundAbortControllerRef = useRef<AbortController | null>(null);
    const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);
    const overlayShownRef = useRef(false);
    const overlayStartRef = useRef<number | null>(null);
    const emptyTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastErrorToastRef = useRef<number>(0); // Rate-limit error toasts
    const listRetryCountRef = useRef(0); // Track retry attempts
    const SHOW_OVERLAY_DELAY = 150; // ms
    const MIN_LOADING_MS = 350; // ms
    const EMPTY_CONFIRM_DELAY = 400; // ms - delay before clearing rows when server returns empty
    const ERROR_TOAST_COOLDOWN = 5000; // ms - minimum time between error toasts
    const [topLoading, setTopLoading] = useState(false);
    const previousDataRef = useRef<OutboundItem[] | null>(null);

    // ⚡ PAGE CACHE: Store fetched pages for instant back navigation
    const pageCacheRef = useRef<Map<string, { data: OutboundItem[], total: number, timestamp: number }>>(new Map());
    const PAGE_CACHE_TTL = 60000; // 1 minute cache validity

    // ⚡ LAST REFRESH TIME: Track when data was last fetched
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

    // ⚡ AUTO-RETRY: Track retry attempts
    const retryCountRef = useRef(0);
    const MAX_RETRIES = 2;

    // ⚡ LAZY LOADING: Defer filter options loading
    const [filtersLoaded, setFiltersLoaded] = useState(false);

    const [customers, setCustomers] = useState<string[]>([]);
    const [brands, setBrands] = useState<string[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [sources, setSources] = useState<string[]>([]);
    const [listColumns, setListColumns] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('outboundListColumns');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Validate that saved columns exist in ALL_LIST_COLUMNS
                    const valid = parsed.filter((col: string) => ALL_LIST_COLUMNS.includes(col));
                    if (valid.length > 0) {
                        return valid;
                    }
                } catch (e) {
                    console.log('Column settings load error');
                }
            }
        }
        // Default: show all important columns
        return ['wsn', 'customer_name', 'dispatch_date', 'product_title', 'brand', 'cms_vertical', 'source', 'fsp', 'mrp', 'batch_id'];
    });
    const [listColumnSettingsOpen, setListColumnSettingsOpen] = useState(false);

    // ====== BATCH MANAGEMENT STATE ======
    const [batches, setBatches] = useState<Batch[]>([]);
    const [batchLoading, setBatchLoading] = useState(false);

    // ====== STATS ======
    const [stats, setStats] = useState<StatsType>({
        picking: 0,
        qc: 0,
        inbound: 0,
        total: 0,
    });

    // ====== RESPONSIVE FILTERS ======
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isDarkMode = theme.palette.mode === 'dark';
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
    const [filteredBrands, setFilteredBrands] = useState<string[]>([]);

    const filtersActive = Boolean(
        (searchFilter && searchFilter.trim() !== '') ||
        (brandFilter && brandFilter !== '') ||
        (categoryFilter && categoryFilter !== '') ||
        (startDateFilter && startDateFilter !== '') ||
        (endDateFilter && endDateFilter !== '')
    );

    // Default: filters collapsed by default on Outbound List tab
    useEffect(() => {
        // Start collapsed on mount
        setFiltersExpanded(false);
    }, []);

    // Ensure filters are collapsed whenever user navigates to the Outbound List tab
    useEffect(() => {
        if (currentTabCode === 'list') {
            setFiltersExpanded(false);
        }
    }, [currentTabCode]);

    // ====== EXPORT STATE ======
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [exportStartDate, setExportStartDate] = useState('');
    const [exportEndDate, setExportEndDate] = useState('');
    const [exportCustomer, setExportCustomer] = useState('');
    const [exportBatchId, setExportBatchId] = useState('');
    const [exportSource, setExportSource] = useState('');

    // AUTH CHECK
    useEffect(() => {
        const storedUser = getStoredUser();
        if (!storedUser) {
            router.push('/login');
            return;
        }
        setUser(storedUser);
    }, [router]);

    // ✅ LOAD COLUMN SETTINGS FROM LOCALSTORAGE
    useEffect(() => {
        // Load visible columns
        const saved = localStorage.getItem('outboundMultiEntryColumns');
        if (saved) {
            try {
                const cols = JSON.parse(saved);
                // Validate columns exist in ALL_MULTI_COLUMNS
                const valid = cols.filter((col: string) => ALL_MULTI_COLUMNS.includes(col));
                if (valid.length > 0) {
                    setVisibleColumns(valid);
                }
            } catch (e) {
                console.log('Column settings load error');
                setVisibleColumns(DEFAULT_MULTI_COLUMNS);
            }
        } else {
            setVisibleColumns(DEFAULT_MULTI_COLUMNS);
        }

        // Load saved column widths (always load regardless of column settings)
        const savedWidths = localStorage.getItem('outboundMultiEntryColumnWidths');
        if (savedWidths) {
            try {
                const widths = JSON.parse(savedWidths);
                setMultiColumnWidths(widths);
                console.log('✅ Outbound Multi Entry column widths loaded:', widths);
            } catch (e) {
                console.log('Column widths load error');
            }
        }
    }, []);

    // Save Ctrl+O preference to localStorage when changed
    useEffect(() => {
        localStorage.setItem('outbound_ctrlOProductLinkEnabled', String(ctrlOProductLinkEnabled));
    }, [ctrlOProductLinkEnabled]);

    // ✅ SAVE COLUMN SETTINGS - Maintain order
    const saveColumnSettings = (cols: string[]) => {
        // Maintain the order of ALL_MULTI_COLUMNS, only filter by selected cols
        const orderedCols = ALL_MULTI_COLUMNS.filter(col => cols.includes(col));
        setVisibleColumns(orderedCols);
        localStorage.setItem('outboundMultiEntryColumns', JSON.stringify(orderedCols));
    };

    const saveListColumnSettings = (cols: string[]) => {
        setListColumns(cols);
        localStorage.setItem('outboundListColumns', JSON.stringify(cols));

        // Use ag-Grid API to toggle column visibility WITHOUT rebuilding columnDefs
        // This preserves column order
        const api = listGridRef.current;
        if (api) {
            // Get all columns and set visibility based on `cols` array
            const allColIds = api.getColumns()?.map((c: any) => c.getColId()) || [];
            allColIds.forEach((colId: string) => {
                if (colId === '__sr') return; // SR column always visible
                const shouldShow = cols.includes(colId);
                api.setColumnsVisible([colId], shouldShow);
            });
            // Save the updated state
            try {
                const state = api.getColumnState();
                localStorage.setItem('outbound_list_grid_state', JSON.stringify(state));
            } catch { /* ignore */ }
        }
    };

    // ====== LOAD DATA ON TAB CHANGE ======
    // NOTE: Column widths are now baked into columnDefs via multiColumnWidths state
    // No need for a separate useEffect to apply widths - they're preserved automatically
    useEffect(() => {
        if (activeWarehouse) {
            if (currentTabCode === 'list') {
                // Only load filter options here - list loading is handled by the filter useEffect
                loadBrands();
                loadCategories();
            } else if (currentTabCode === 'single' || currentTabCode === 'multi') {
                loadExistingWSNs();
                loadCustomers();
            } else if (currentTabCode === 'batches') {
                loadBatches();
            }
        }
    }, [activeWarehouse, currentTabCode]);

    // Debounced auto-fetch for single WSN (mimic inbound behaviour)
    useEffect(() => {
        if (wsnFetchTimerRef.current) {
            clearTimeout(wsnFetchTimerRef.current);
            wsnFetchTimerRef.current = null;
        }

        if (!singleWSN || singleWSN.trim() === '') {
            setSourceData(null);
            setDuplicateWSN(null);
            return;
        }

        // Only auto-fetch after user stops typing for 500ms and WSN looks valid
        wsnFetchTimerRef.current = setTimeout(() => {
            const wsnUpper = singleWSN.trim().toUpperCase();
            autoFetchSource(wsnUpper);
        }, 500);

        return () => {
            if (wsnFetchTimerRef.current) {
                clearTimeout(wsnFetchTimerRef.current);
                wsnFetchTimerRef.current = null;
            }
        };
    }, [singleWSN, activeWarehouse]);

    const autoFetchSource = async (wsn: string) => {
        if (!wsn || wsn.length < 6) {
            setSourceData(null);
            return;
        }

        try {
            await fetchSourceByWSN(wsn, true);
        } catch (err) {
            // silent on auto fetch
            console.debug('Auto fetch error', err);
        }
    };

    useEffect(() => {
        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
            searchDebounceRef.current = null;
        }
        // ✅ Debounce typing (300ms) to avoid spamming requests and UI lag
        searchDebounceRef.current = setTimeout(() => {
            setSearchDebounced(searchFilter);
        }, 300);

        return () => {
            if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = null;
            }
        };
    }, [searchFilter]);

    // Trigger outbound list load when debounced search or other filters change
    // Also triggers when switching TO list tab
    useEffect(() => {
        if (activeWarehouse && currentTabCode === 'list') {
            loadOutboundList();
        }
    }, [activeWarehouse, currentTabCode, page, limit, searchDebounced, sourceFilter, customerFilter, startDateFilter, endDateFilter, batchFilter, brandFilter, categoryFilter]);

    // Force refresh SR.NO column when page/limit changes - update context and refresh cells
    useEffect(() => {
        if (currentTabCode === 'list' && listGridRef.current) {
            console.log('🔄 SR.NO Refresh triggered - page:', page, 'limit:', limit);
            // Small delay to ensure React state is settled
            const timer = setTimeout(() => {
                try {
                    const api = listGridRef.current?.api || listGridRef.current;
                    if (api) {
                        // Update the grid's context with current page/limit values
                        if (typeof api.setGridOption === 'function') {
                            api.setGridOption('context', { page, limit });
                        }
                        // Then refresh the SR.NO column cells to re-run valueGetter
                        if (typeof api.refreshCells === 'function') {
                            api.refreshCells({ columns: ['__sr'], force: true });
                            console.log('🔄 SR.NO refreshCells called with context:', { page, limit });
                        }
                    }
                } catch { /* ignore */ }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [page, limit, currentTabCode]);

    // ====== LOAD EXISTING OUTBOUND WSNs ======
    const loadExistingWSNs = async () => {
        if (!activeWarehouse) return;
        try {
            const res = await outboundAPI.getExistingWSNs(activeWarehouse.id);
            const wsnSet = new Set<string>(res.data.map((w: string) => w.toUpperCase()));
            setExistingOutboundWSNs(wsnSet);
        } catch (err: any) {
            console.error('Failed to load existing WSNs');
        }
    };

    // ====== LOAD CUSTOMERS ======
    const loadCustomers = async () => {
        try {
            // Use master customers table for dropdown (like Picking page)
            const response = await customerAPI.getNames(activeWarehouse?.id);
            if (Array.isArray(response.data)) {
                setCustomers(response.data);
                if (response.data.length === 0) {
                    console.warn('No customers found for this warehouse. Please add customers first.');
                }
            } else {
                console.error('Invalid response format from customerAPI:', response.data);
                setCustomers([]);
            }
        } catch (error: any) {
            console.error('Load customers error:', error);
            console.error('Error details:', error.response?.data);
            toast.error(error.response?.data?.error || 'Failed to load customers');
            setCustomers([]);
        }
    };

    // ====== LOAD BRANDS ======
    const loadBrands = async () => {
        try {
            const response = await outboundAPI.getBrands(activeWarehouse?.id);
            setBrands(response.data || []);
        } catch (error) {
            console.log('Brands error');
            setBrands([]);
        }
    };

    // ====== LOAD CATEGORIES ======
    const loadCategories = async () => {
        try {
            const response = await outboundAPI.getCategories(activeWarehouse?.id);
            setCategories(response.data || []);
        } catch (error) {
            console.log('Categories error');
            setCategories([]);
        }
    };

    useEffect(() => {
        if (activeWarehouse) {
            loadCustomers();
        }
    }, [activeWarehouse]);

    // ====== FILTER DEPENDENCIES ======
    useEffect(() => {
        if (brandFilter) {
            const filtered = listData
                .filter(item => item.brand === brandFilter)
                .map(item => item.cms_vertical)
                .filter((v, i, a) => v && a.indexOf(v) === i);
            setFilteredCategories(filtered);
        } else {
            setFilteredCategories(categories);
        }
    }, [brandFilter, listData, categories]);

    useEffect(() => {
        if (categoryFilter) {
            const filtered = listData
                .filter(item => item.cms_vertical === categoryFilter)
                .map(item => item.brand)
                .filter((v, i, a) => v && a.indexOf(v) === i);
            setFilteredBrands(filtered);
        } else {
            setFilteredBrands(brands);
        }
    }, [categoryFilter, listData, brands]);

    // ====== SINGLE ENTRY: FETCH SOURCE BY WSN ======
    const fetchSourceByWSN = async (wsn: string, quiet = false) => {
        if (!wsn.trim() || !activeWarehouse) return;

        setSingleLoading(true);
        setSourceData(null);
        setDuplicateWSN(null);
        setUpdateMode(false);

        try {
            const res = await outboundAPI.getSourceByWSN(wsn.trim(), activeWarehouse.id);
            const data = res.data;
            setSourceData(data);
            // Auto-fill common single form fields when available
            setSingleForm((prev) => ({
                ...prev,
                customer_name: data.customer_name || prev.customer_name,
                vehicle_no: data.vehicle_no || data.inbound_vehicle_no || prev.vehicle_no,
            }));
            if (!quiet) toast.success('✓ Source data loaded');
        } catch (err: any) {
            console.error('Fetch source by WSN error:', err);
            if (err.response?.status === 409) {
                setDuplicateWSN(err.response.data);
                if (!quiet) toast.error(err.response.data.error || 'WSN already dispatched');
            } else if (err.response?.status === 404) {
                if (!quiet) toast.error('WSN not found in Picking, QC or Inbound');
            } else {
                if (!quiet) toast.error(err.response?.data?.error || 'Failed to fetch source data');
            }
        } finally {
            setSingleLoading(false);
        }
    };

    const handleSingleWSNScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            fetchSourceByWSN(singleWSN);
        }
    };

    const handleSingleSubmit = async () => {
        if (!singleWSN.trim() || !activeWarehouse) {
            toast.error('WSN is required');
            return;
        }

        if (!singleForm.dispatch_date || !singleForm.customer_name) {
            toast.error('Dispatch date and customer name are required');
            return;
        }

        setSingleLoading(true);
        try {
            const payload = {
                wsn: singleWSN.trim(),
                ...singleForm,
                warehouse_id: activeWarehouse.id,
                update_existing: updateMode,
            };

            const res = await outboundAPI.createSingle(payload);

            if (res.data.action === 'updated') {
                toast.success('✓ Outbound entry updated');
            } else {
                toast.success('✓ Outbound entry created');
            }

            // Reset
            setSingleWSN('');
            setSourceData(null);
            setDuplicateWSN(null);
            setUpdateMode(false);
            setSingleForm({
                dispatch_date: new Date().toISOString().split('T')[0],
                customer_name: '',
                vehicle_no: '',
                dispatch_remarks: '',
                other_remarks: '',
            });

            setTimeout(() => wsnInputRef.current?.focus(), 100);
        } catch (err: any) {
            if (err.response?.status === 409 && err.response?.data?.canUpdate) {
                setDuplicateWSN(err.response.data);
                toast.error('Duplicate WSN. Enable "Update Existing" to modify.');
            } else {
                toast.error(err.response?.data?.error || 'Failed to create outbound');
            }
        } finally {
            setSingleLoading(false);
        }
    };

    const handleSingleReset = () => {
        setSingleWSN('');
        setSourceData(null);
        setDuplicateWSN(null);
        setUpdateMode(false);
        setSingleForm({
            dispatch_date: new Date().toISOString().split('T')[0],
            customer_name: '',
            vehicle_no: '',
            dispatch_remarks: '',
            other_remarks: '',
        });
        setTimeout(() => wsnInputRef.current?.focus(), 100);
    };

    // ⚡ CACHE: Load available inventory cache ONLY when cacheEnabled is true (Issue #6)
    useEffect(() => {
        if (!activeWarehouse?.id || !cacheEnabled) {
            // Clear cache stats if disabled
            if (!cacheEnabled) {
                setCacheStats(null);
            }
            return;
        }

        const initCache = async () => {
            try {
                setCacheLoading(true);
                const needsRefresh = await needsCacheRefresh(activeWarehouse.id);

                if (needsRefresh) {
                    setCacheProgress({ loaded: 0, total: 1, message: 'Loading available inventory...' });
                    const result = await loadAvailableInventory(activeWarehouse.id, (loaded, total, message) => {
                        setCacheProgress({ loaded, total, message });
                    });

                    if (result.success) {
                        toast.success(`✅ Cached ${result.count.toLocaleString()} available items`);
                    }
                }

                const stats = await getOutboundCacheStats(activeWarehouse.id);
                setCacheStats({ totalRecords: stats.totalRecords, isReady: stats.isReady });
            } catch (error) {
                console.error('Cache init error:', error);
                // Still try to get existing cache stats on error
                try {
                    const stats = await getOutboundCacheStats(activeWarehouse.id);
                    if (stats.totalRecords > 0) {
                        setCacheStats({ totalRecords: stats.totalRecords, isReady: stats.isReady });
                    }
                } catch { /* ignore */ }
            } finally {
                setCacheLoading(false);
                setCacheProgress(null);
            }
        };

        initCache();

        // Refresh cache stats periodically when cache is enabled
        const interval = setInterval(async () => {
            if (!cacheEnabled) return;
            try {
                const stats = await getOutboundCacheStats(activeWarehouse.id);
                setCacheStats({ totalRecords: stats.totalRecords, isReady: stats.isReady });
            } catch (e) { /* ignore */ }
        }, 60000); // Every 60 seconds

        return () => clearInterval(interval);
    }, [activeWarehouse?.id, cacheEnabled]);

    // ⚡ CACHE: Persist cacheEnabled setting
    useEffect(() => {
        try {
            localStorage.setItem('outbound_cacheEnabled', String(cacheEnabled));
        } catch { /* ignore */ }
    }, [cacheEnabled]);

    // ⚡ CACHE: Toggle cache on/off
    const toggleCache = async () => {
        if (cacheEnabled) {
            // Turning OFF - clear cache
            setCacheEnabled(false);
            setCacheStats(null);
            if (activeWarehouse?.id) {
                await clearOutboundCache(activeWarehouse.id);
            }
            toast.success('Cache disabled');
        } else {
            // Turning ON - will trigger useEffect to load cache
            setCacheEnabled(true);
            toast.success('Cache enabled - loading data...');
        }
    };

    // ⚡ CACHE: Refresh cache function
    const refreshCache = async () => {
        if (!activeWarehouse?.id) return;
        if (!cacheEnabled) {
            toast.error('Please enable cache first');
            return;
        }

        setCacheLoading(true);
        setCacheProgress({ loaded: 0, total: 1, message: 'Refreshing cache...' });

        try {
            await clearOutboundCache(activeWarehouse.id);
            const result = await loadAvailableInventory(activeWarehouse.id, (loaded, total, message) => {
                setCacheProgress({ loaded, total, message });
            });

            if (result.success) {
                toast.success(`✅ Cache refreshed: ${result.count.toLocaleString()} items`);
                const stats = await getOutboundCacheStats(activeWarehouse.id);
                setCacheStats({ totalRecords: stats.totalRecords, isReady: stats.isReady });
            }
        } catch (error) {
            toast.error('Failed to refresh cache');
        } finally {
            setCacheLoading(false);
            setCacheProgress(null);
        }
    };

    // ⚡ ROW HIGHLIGHTING: Highlight newly added row for visual confirmation
    const highlightRow = useCallback((rowIndex: number, duration = 1500) => {
        // Clear any existing timeout for this row
        const existingTimeout = highlightTimeoutRefs.current.get(rowIndex);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Add row to highlighted set
        setHighlightedRows(prev => {
            const newSet = new Set(Array.from(prev));
            newSet.add(rowIndex);
            return newSet;
        });

        // Remove highlight after duration
        const timeout = setTimeout(() => {
            setHighlightedRows(prev => {
                const newSet = new Set(prev);
                newSet.delete(rowIndex);
                return newSet;
            });
            highlightTimeoutRefs.current.delete(rowIndex);
        }, duration);

        highlightTimeoutRefs.current.set(rowIndex, timeout);
    }, []);

    // ⚡ SCANNER MODE: Record scanning activity
    const recordScanActivity = useCallback(() => {
        try {
            const now = Date.now();
            if (lastScanTsRef.current && now - lastScanTsRef.current < 600) {
                scanCountRef.current = (scanCountRef.current || 0) + 1;
            } else {
                scanCountRef.current = 1;
            }
            lastScanTsRef.current = now;

            if (scanModeTimeoutRef.current) {
                window.clearTimeout(scanModeTimeoutRef.current);
                scanModeTimeoutRef.current = null;
            }

            scanningModeRef.current = true;
            userScrolledRef.current = false;

            if (userScrollTimeoutRef.current) {
                window.clearTimeout(userScrollTimeoutRef.current);
                userScrollTimeoutRef.current = null;
            }

            // Exit scanning mode after 3s of inactivity
            scanModeTimeoutRef.current = window.setTimeout(() => {
                scanCountRef.current = 0;
                scanningModeRef.current = false;
                lastScanTsRef.current = null;
                scanModeTimeoutRef.current = null;
            }, 3000);
        } catch (e) { /* ignore */ }
    }, []);

    // ⚡ UNDO: Save cell change for undo (cell-level)
    const saveCellUndoAction = useCallback((
        rowIndex: number,
        field: string,
        oldValue: any,
        newValue: any,
        oldRowData?: any,
        newRowData?: any
    ) => {
        const action: UndoAction = {
            type: 'cell',
            rowIndex,
            field,
            oldValue,
            newValue,
            oldRowData: oldRowData ? JSON.parse(JSON.stringify(oldRowData)) : undefined,
            newRowData: newRowData ? JSON.parse(JSON.stringify(newRowData)) : undefined,
        };
        undoStackRef.current.push(action);
        if (undoStackRef.current.length > MAX_UNDO_HISTORY) {
            undoStackRef.current.shift();
        }
        // Clear redo stack when new action is performed
        redoStackRef.current = [];
    }, []);

    // ⚡ UNDO: Handle undo (Ctrl+Z) - supports batch operations
    const handleUndo = useCallback(() => {
        if (undoStackRef.current.length === 0) {
            toast('Nothing to undo', { icon: 'ℹ️', duration: 500 });
            return;
        }

        const action = undoStackRef.current.pop()!;

        // Master data columns that get auto-populated when WSN is entered
        const MASTER_DATA_COLUMNS = [
            'source', 'product_title', 'brand', 'cms_vertical', 'wid', 'fsn',
            'order_id', 'fkqc_remark', 'fk_grade', 'hsn_sac', 'igst_rate',
            'fsp', 'mrp', 'vrp', 'yield_value', 'invoice_date', 'fkt_link',
            'wh_location', 'p_type', 'p_size', 'quantity'
        ];

        setMultiRows(currentRows => {
            const newRows = [...currentRows];

            // Handle batch undo (paste operations)
            if (action.type === 'batch' && action.batchChanges) {
                const redoBatchChanges: typeof action.batchChanges = [];

                for (const change of action.batchChanges) {
                    const currentValue = newRows[change.rowIndex]?.[change.field];
                    redoBatchChanges.push({
                        rowIndex: change.rowIndex,
                        field: change.field,
                        oldValue: currentValue,
                        newValue: change.oldValue,
                    });

                    // If undoing a WSN field, also clear all auto-populated master data
                    if (change.field === 'wsn') {
                        const clearedRow: any = {
                            ...newRows[change.rowIndex],
                            [change.field]: change.oldValue
                        };
                        // Clear all master data columns
                        for (const col of MASTER_DATA_COLUMNS) {
                            clearedRow[col] = '';
                        }
                        newRows[change.rowIndex] = clearedRow;
                    } else {
                        newRows[change.rowIndex] = {
                            ...newRows[change.rowIndex],
                            [change.field]: change.oldValue
                        };
                    }
                }

                // Save to redo stack
                redoStackRef.current.push({
                    ...action,
                    batchChanges: redoBatchChanges,
                });

                return newRows;
            }

            // Handle single cell undo
            const currentRowData = JSON.parse(JSON.stringify(newRows[action.rowIndex]));

            if (action.type === 'cell') {
                if (action.oldRowData) {
                    newRows[action.rowIndex] = { ...action.oldRowData };
                } else {
                    newRows[action.rowIndex] = {
                        ...newRows[action.rowIndex],
                        [action.field]: action.oldValue
                    };
                }
            }

            // Save to redo stack
            redoStackRef.current.push({
                ...action,
                oldValue: action.newValue,
                newValue: action.oldValue,
                oldRowData: currentRowData,
                newRowData: action.oldRowData,
            });

            return newRows;
        });

        // Focus the undone cell and refresh grid
        setTimeout(() => {
            const api = gridRef.current?.api;
            if (api) {
                if (action.type === 'batch' && action.batchChanges?.length) {
                    api.ensureIndexVisible(action.batchChanges[0].rowIndex, 'middle');
                    api.setFocusedCell(action.batchChanges[0].rowIndex, action.batchChanges[0].field);
                } else {
                    api.ensureIndexVisible(action.rowIndex, 'middle');
                    api.setFocusedCell(action.rowIndex, action.field);
                }
                api.refreshCells({ force: true });
            }
        }, 50);

        const count = action.type === 'batch' ? action.batchChanges?.length || 1 : 1;
        toast.success(`Undo: ${count} cell${count > 1 ? 's' : ''}`, { duration: 1000 });
    }, []);

    // ⚡ REDO: Handle redo (Ctrl+Y or Ctrl+Shift+Z) - supports batch operations
    const handleRedo = useCallback(() => {
        if (redoStackRef.current.length === 0) {
            toast('Nothing to redo', { icon: 'ℹ️', duration: 1500 });
            return;
        }

        const action = redoStackRef.current.pop()!;

        setMultiRows(currentRows => {
            const newRows = [...currentRows];

            // Handle batch redo (paste operations)
            if (action.type === 'batch' && action.batchChanges) {
                const undoBatchChanges: typeof action.batchChanges = [];

                for (const change of action.batchChanges) {
                    const currentValue = newRows[change.rowIndex]?.[change.field];
                    undoBatchChanges.push({
                        rowIndex: change.rowIndex,
                        field: change.field,
                        oldValue: currentValue,
                        newValue: change.oldValue,
                    });
                    newRows[change.rowIndex] = {
                        ...newRows[change.rowIndex],
                        [change.field]: change.oldValue
                    };
                }

                undoStackRef.current.push({
                    ...action,
                    batchChanges: undoBatchChanges,
                });

                return newRows;
            }

            const currentRowData = JSON.parse(JSON.stringify(newRows[action.rowIndex]));

            if (action.type === 'cell') {
                if (action.oldRowData) {
                    newRows[action.rowIndex] = { ...action.oldRowData };
                } else {
                    newRows[action.rowIndex] = {
                        ...newRows[action.rowIndex],
                        [action.field]: action.oldValue
                    };
                }
            }

            undoStackRef.current.push({
                ...action,
                oldValue: action.newValue,
                newValue: action.oldValue,
                oldRowData: currentRowData,
                newRowData: action.oldRowData,
            });

            return newRows;
        });

        setTimeout(() => {
            const api = gridRef.current?.api;
            if (api) {
                if (action.type === 'batch' && action.batchChanges?.length) {
                    api.ensureIndexVisible(action.batchChanges[0].rowIndex, 'middle');
                    api.setFocusedCell(action.batchChanges[0].rowIndex, action.batchChanges[0].field);
                } else {
                    api.ensureIndexVisible(action.rowIndex, 'middle');
                    api.setFocusedCell(action.rowIndex, action.field);
                }
                api.refreshCells({ force: true });
            }
        }, 50);

        const count = action.type === 'batch' ? action.batchChanges?.length || 1 : 1;
        toast.success(`Redo: ${count} cell${count > 1 ? 's' : ''}`, { duration: 1000 });
    }, []);

    // ⚡ FILL DOWN: Copy value from first selected cell to all cells below (Ctrl+D)
    const handleFillDown = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;

        const focusedCell = api.getFocusedCell();
        if (!focusedCell) {
            toast('Select a cell first', { icon: 'ℹ️', duration: 1500 });
            return;
        }

        const { rowIndex, column } = focusedCell;
        const colId = selectedRange?.startCol || column.getColId();

        if (!EDITABLE_COLUMNS.includes(colId)) {
            toast('Cannot fill down in this column', { icon: '⚠️', duration: 1500 });
            return;
        }

        // If we have a selected range, fill down from first cell
        if (selectedRange) {
            const startRow = Math.min(selectedRange.startRow, selectedRange.endRow);
            const endRow = Math.max(selectedRange.startRow, selectedRange.endRow);
            const sourceValue = multiRowsRef.current[startRow]?.[colId];

            if (sourceValue === undefined || sourceValue === null || sourceValue === '') {
                toast('First selected cell is empty', { icon: 'ℹ️', duration: 1500 });
                return;
            }

            const newRows = [...multiRowsRef.current];
            let filledCount = 0;

            for (let r = startRow + 1; r <= endRow; r++) {
                const oldValue = newRows[r]?.[colId];
                if (oldValue !== sourceValue) {
                    saveCellUndoAction(r, colId, oldValue, sourceValue);
                    newRows[r] = { ...newRows[r], [colId]: sourceValue };
                    filledCount++;
                }
            }

            if (filledCount === 0) {
                toast('All cells already have the same value', { icon: 'ℹ️', duration: 1500 });
                return;
            }

            setMultiRows(newRows);
            api.refreshCells({ force: true });
            toast.success(`Filled ${filledCount} cells`, { duration: 1500 });
            return;
        }

        // Single cell: copy from cell above
        if (rowIndex === 0) {
            toast('No cell above to copy from', { icon: 'ℹ️', duration: 1500 });
            return;
        }

        const valueAbove = multiRowsRef.current[rowIndex - 1]?.[colId];
        if (valueAbove === undefined || valueAbove === null || valueAbove === '') {
            toast('No value above to copy', { icon: 'ℹ️', duration: 1500 });
            return;
        }

        const oldValue = multiRowsRef.current[rowIndex]?.[colId];
        saveCellUndoAction(rowIndex, colId, oldValue, valueAbove);

        const newRows = [...multiRowsRef.current];
        newRows[rowIndex] = { ...newRows[rowIndex], [colId]: valueAbove };
        setMultiRows(newRows);
        api.refreshCells({ force: true });
        toast.success(`Filled: ${valueAbove}`, { duration: 1500 });
    }, [selectedRange, saveCellUndoAction]);

    // ⚡ FILL RIGHT: Copy value from cell to the left (Ctrl+R)
    const handleFillRight = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;

        const focusedCell = api.getFocusedCell();
        if (!focusedCell) {
            toast('Select a cell first', { icon: 'ℹ️', duration: 1500 });
            return;
        }

        const { rowIndex, column } = focusedCell;
        const colId = column.getColId();
        const allColumns = api.getColumns();
        if (!allColumns) return;

        const colIndex = allColumns.findIndex((c: any) => c.getColId() === colId);
        if (colIndex <= 0) {
            toast('No cell to the left to copy from', { icon: 'ℹ️', duration: 1500 });
            return;
        }

        const leftColId = allColumns[colIndex - 1].getColId();

        if (!EDITABLE_COLUMNS.includes(colId)) {
            toast('Cannot fill in this column', { icon: '⚠️', duration: 1500 });
            return;
        }

        const valueLeft = multiRowsRef.current[rowIndex]?.[leftColId];
        if (valueLeft === undefined || valueLeft === null || valueLeft === '') {
            toast('No value to the left to copy', { icon: 'ℹ️', duration: 1500 });
            return;
        }

        const oldValue = multiRowsRef.current[rowIndex]?.[colId];
        saveCellUndoAction(rowIndex, colId, oldValue, valueLeft);

        const newRows = [...multiRowsRef.current];
        newRows[rowIndex] = { ...newRows[rowIndex], [colId]: valueLeft };
        setMultiRows(newRows);
        api.refreshCells({ force: true });
        toast.success(`Filled: ${valueLeft}`, { duration: 1500 });
    }, [saveCellUndoAction]);

    // ⚡ GO TO FIRST: Navigate to first cell (Ctrl+Home)
    const handleGoToFirst = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;

        api.ensureIndexVisible(0, 'top');
        api.setFocusedCell(0, 'wsn');
        setSelectedRange(null);
    }, []);

    // ⚡ GO TO LAST: Navigate to last cell with data (Ctrl+End)
    const handleGoToLast = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;

        let lastRowWithData = 0;
        for (let i = multiRowsRef.current.length - 1; i >= 0; i--) {
            if (multiRowsRef.current[i]?.wsn?.trim()) {
                lastRowWithData = i;
                break;
            }
        }

        api.ensureIndexVisible(lastRowWithData, 'bottom');
        api.setFocusedCell(lastRowWithData, 'wsn');
        setSelectedRange(null);
    }, []);

    // ✅ CHECK DUPLICATES IN GRID
    const checkDuplicates = useCallback(
        async (rows: any[]) => {
            const gridDup = new Set<string>();
            const crossWh = new Set<string>();
            const wsnCounts = new Map<string, number>();

            rows.forEach((row) => {
                const wsn = row.wsn?.trim()?.toUpperCase();
                if (!wsn) return;

                wsnCounts.set(wsn, (wsnCounts.get(wsn) || 0) + 1);
                if (wsnCounts.get(wsn)! > 1) {
                    gridDup.add(wsn);
                }

                if (existingOutboundWSNs.has(wsn)) {
                    crossWh.add(wsn);
                }
            });

            setGridDuplicateWSNs(gridDup);
            setCrossWarehouseWSNs(crossWh);
            setDuplicateWSNs(new Set([...Array.from(gridDup), ...Array.from(crossWh)]));
        },
        [existingOutboundWSNs]
    );

    // ✅ NAVIGATE TO NEXT CELL (AG GRID) - handles Enter, Tab, and Arrow keys
    const navigateToNextCell = useCallback(
        (params: any) => {
            const { key, previousCellPosition, nextCellPosition, event } = params;
            const api = params.api;

            // Tab key: move to next/prev cell horizontally (Excel-like)
            if (key === 'Tab') {
                const column = previousCellPosition.column;
                const rowIndex = previousCellPosition.rowIndex;
                const allColumns = api.getAllDisplayedColumns() || [];
                const currentColIndex = allColumns.findIndex((c: any) => c.getColId() === column.getColId());

                const goingBack = event && event.shiftKey;

                if (goingBack) {
                    // Shift+Tab: move left, wrap to previous row if at start
                    if (currentColIndex > 0) {
                        return { rowIndex, column: allColumns[currentColIndex - 1], rowPinned: null };
                    } else if (rowIndex > 0) {
                        // Wrap to end of previous row
                        return { rowIndex: rowIndex - 1, column: allColumns[allColumns.length - 1], rowPinned: null };
                    }
                } else {
                    // Tab: move right, wrap to next row if at end
                    if (currentColIndex < allColumns.length - 1) {
                        return { rowIndex, column: allColumns[currentColIndex + 1], rowPinned: null };
                    } else if (rowIndex < api.getDisplayedRowCount() - 1) {
                        // Wrap to start of next row
                        return { rowIndex: rowIndex + 1, column: allColumns[0], rowPinned: null };
                    }
                }
                return previousCellPosition;
            }

            // Arrow keys: default behaviour
            if (key !== 'Enter') {
                return nextCellPosition;
            }

            // Enter: same column, next/prev row
            const column = previousCellPosition.column;
            const rowIndex = previousCellPosition.rowIndex;

            const goingUp = event && event.shiftKey;
            const newRowIndex = goingUp ? rowIndex - 1 : rowIndex + 1;

            if (newRowIndex < 0 || newRowIndex >= api.getDisplayedRowCount()) {
                return previousCellPosition;
            }

            return {
                rowIndex: newRowIndex,
                column,
                rowPinned: null,
            };
        },
        []
    );

    // ⚡ EXCEL-LIKE: Keep multiRowsRef in sync
    useEffect(() => {
        multiRowsRef.current = multiRows;
    }, [multiRows]);

    // ⚡ EXCEL-LIKE: Update selection bounds when selection changes
    useEffect(() => {
        selectedRangeRef.current = selectedRange;

        if (selectedRange && gridRef.current?.api) {
            const api = gridRef.current.api;
            const allColumns = api.getAllDisplayedColumns?.() || [];
            const colIndexMap = new Map<string, number>();
            allColumns.forEach((c: any, idx: number) => {
                colIndexMap.set(c.getColId(), idx);
            });

            const startColIndex = colIndexMap.get(selectedRange.startCol) ?? -1;
            const endColIndex = colIndexMap.get(selectedRange.endCol) ?? -1;

            if (startColIndex !== -1 && endColIndex !== -1) {
                selectionBoundsRef.current = {
                    minRow: Math.min(selectedRange.startRow, selectedRange.endRow),
                    maxRow: Math.max(selectedRange.startRow, selectedRange.endRow),
                    minCol: Math.min(startColIndex, endColIndex),
                    maxCol: Math.max(startColIndex, endColIndex),
                    colIndexMap,
                };

                // ⚡ PERFORMANCE: Debounce selection statistics calculation (50ms)
                if (selectionStatsTimeoutRef.current) {
                    clearTimeout(selectionStatsTimeoutRef.current);
                }
                selectionStatsTimeoutRef.current = setTimeout(() => {
                    // ⚡ EXCEL-LIKE: Calculate selection statistics for numeric cells (FSP, MRP, Quantity, etc.)
                    const minRow = Math.min(selectedRange.startRow, selectedRange.endRow);
                    const maxRow = Math.max(selectedRange.startRow, selectedRange.endRow);
                    const minCol = Math.min(startColIndex, endColIndex);
                    const maxCol = Math.max(startColIndex, endColIndex);

                    const numericColumns = ['fsp', 'mrp', 'vrp', 'quantity', 'igst_rate', 'yield_value'];
                    let sum = 0;
                    let count = 0;
                    let numericCount = 0;

                    for (let r = minRow; r <= maxRow; r++) {
                        const rowNode = api.getDisplayedRowAtIndex(r);
                        if (!rowNode?.data) continue;

                        for (let c = minCol; c <= maxCol; c++) {
                            const colId = allColumns[c]?.getColId();
                            if (!colId) continue;

                            count++;
                            const cellValue = rowNode.data[colId];

                            // Check if it's a numeric column or if the value is numeric
                            if (numericColumns.includes(colId) || !isNaN(parseFloat(cellValue))) {
                                const numVal = parseFloat(cellValue);
                                if (!isNaN(numVal) && numVal !== 0) {
                                    sum += numVal;
                                    numericCount++;
                                }
                            }
                        }
                    }

                    if (numericCount > 0) {
                        setSelectionStats({
                            sum: Math.round(sum * 100) / 100, // Round to 2 decimal places
                            count,
                            average: Math.round((sum / numericCount) * 100) / 100,
                            numericCount,
                        });
                    } else {
                        setSelectionStats(null);
                    }
                }, 50); // 50ms debounce for smooth drag selection
            } else {
                selectionBoundsRef.current = null;
                setSelectionStats(null);
            }
        } else {
            selectionBoundsRef.current = null;
            if (selectionStatsTimeoutRef.current) {
                clearTimeout(selectionStatsTimeoutRef.current);
            }
            setSelectionStats(null);
        }
    }, [selectedRange]);

    // Store previous selection for smart refresh
    const prevSelectionBoundsRef = useRef<{ minRow: number; maxRow: number } | null>(null);

    // ⚡ EXCEL-LIKE: Optimized refresh - only refresh affected rows instead of entire grid
    useEffect(() => {
        const api = gridRef.current?.api;
        if (!api) return;

        requestAnimationFrame(() => {
            const bounds = selectionBoundsRef.current;
            const prevBounds = prevSelectionBoundsRef.current;

            // Collect row indices that need refresh
            const rowsToRefresh = new Set<number>();

            // Add current selection rows
            if (bounds) {
                for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
                    rowsToRefresh.add(r);
                }
            }

            // Add previous selection rows (to clear old selection styling)
            if (prevBounds) {
                for (let r = prevBounds.minRow; r <= prevBounds.maxRow; r++) {
                    rowsToRefresh.add(r);
                }
            }

            // Update prev bounds for next time
            prevSelectionBoundsRef.current = bounds ? { minRow: bounds.minRow, maxRow: bounds.maxRow } : null;

            // Only refresh if there are rows to update
            if (rowsToRefresh.size > 0) {
                const rowNodes: any[] = [];
                rowsToRefresh.forEach((rowIndex) => {
                    const node = api.getDisplayedRowAtIndex(rowIndex);
                    if (node) rowNodes.push(node);
                });
                if (rowNodes.length > 0) {
                    api.refreshCells({ rowNodes, force: true });
                }
            }
        });
    }, [selectedRange]);

    // ⚡ EXCEL-LIKE: Handle cell mouse down - start drag selection
    // FIXED: Only allow left mouse button (button === 0) for drag selection
    const handleCellMouseDown = useCallback((rowIndex: number, colId: string, shiftKey: boolean, mouseButton: number) => {
        // Only allow left mouse button (button === 0) for selection
        if (mouseButton !== 0) return;

        if (shiftKey && rangeStartCellRef.current) {
            setSelectedRange({
                startRow: rangeStartCellRef.current.rowIndex,
                endRow: rowIndex,
                startCol: rangeStartCellRef.current.colId,
                endCol: colId,
            });
        } else {
            isDraggingRef.current = true;
            dragStartCellRef.current = { rowIndex, colId };
            rangeStartCellRef.current = { rowIndex, colId };
            setSelectedRange(null);
        }
    }, []);

    // ⚡ EXCEL-LIKE: Handle cell mouse over - extend selection while dragging
    // FIXED: Only create selection when mouse moves to a DIFFERENT cell AND left button is still pressed
    const handleCellMouseOver = useCallback((rowIndex: number, colId: string, mouseButtons: number) => {
        // ✅ CRITICAL FIX: Check if left mouse button is STILL pressed (buttons & 1)
        // This prevents unwanted selection when mouse moves without button pressed
        const isLeftButtonPressed = (mouseButtons & 1) === 1;

        if (!isLeftButtonPressed) {
            // Mouse button was released - stop dragging
            isDraggingRef.current = false;
            return;
        }

        if (!isDraggingRef.current || !dragStartCellRef.current) return;

        // ✅ EXCEL FIX: Only create selection if target cell is DIFFERENT from start cell
        const startRow = dragStartCellRef.current.rowIndex;
        const startCol = dragStartCellRef.current.colId;

        if (rowIndex === startRow && colId === startCol) {
            // Same cell - don't create selection (Excel behavior: single click = no range)
            return;
        }

        setSelectedRange({
            startRow: startRow,
            endRow: rowIndex,
            startCol: startCol,
            endCol: colId,
        });
    }, []);

    // ⚡ EXCEL-LIKE: Handle cell click for shift+click selection
    const handleCellClick = useCallback((rowIndex: number, colId: string, shiftKey: boolean) => {
        if (shiftKey && rangeStartCellRef.current) {
            setSelectedRange({
                startRow: rangeStartCellRef.current.rowIndex,
                endRow: rowIndex,
                startCol: rangeStartCellRef.current.colId,
                endCol: colId,
            });
        } else {
            rangeStartCellRef.current = { rowIndex, colId };
            setSelectedRange(null);
        }
    }, []);

    // ⚡ EXCEL-LIKE: Handle mouse up - end drag selection
    useEffect(() => {
        const handleMouseUp = () => {
            if (isDraggingRef.current) {
                isDraggingRef.current = false;
            }
        };
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    // ⚡ EXCEL-LIKE: Clear selected cells (Delete/Backspace) with undo support
    const handleClearCells = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;

        // Master data columns to clear when WSN is cleared
        const MASTER_DATA_COLUMNS = [
            'source', 'product_title', 'brand', 'cms_vertical', 'wid', 'fsn',
            'order_id', 'fkqc_remark', 'fk_grade', 'hsn_sac', 'igst_rate',
            'fsp', 'mrp', 'vrp', 'yield_value', 'invoice_date', 'fkt_link',
            'wh_location', 'p_type', 'p_size', 'quantity'
        ];

        const range = selectedRangeRef.current;
        if (!range) {
            const focusedCell = api.getFocusedCell();
            if (!focusedCell) return;
            const { rowIndex, column } = focusedCell;
            const colId = column.getColId();
            if (!EDITABLE_COLUMNS.includes(colId)) return;

            const oldValue = multiRowsRef.current[rowIndex]?.[colId];
            if (oldValue !== '' && oldValue !== null && oldValue !== undefined) {
                saveCellUndoAction(rowIndex, colId, oldValue, '');
            }

            const newRows = [...multiRowsRef.current];

            // If WSN is being cleared, also clear all master data columns
            if (colId === 'wsn') {
                const clearedRow = { ...newRows[rowIndex], wsn: '' };
                MASTER_DATA_COLUMNS.forEach(col => { clearedRow[col] = ''; });
                newRows[rowIndex] = clearedRow;
            } else {
                newRows[rowIndex] = { ...newRows[rowIndex], [colId]: '' };
            }

            setMultiRows(newRows);
            api.refreshCells({ force: true });
            return;
        }

        const minRow = Math.min(range.startRow, range.endRow);
        const maxRow = Math.max(range.startRow, range.endRow);

        const allColumns = api.getAllDisplayedColumns?.() || [];
        const colIds = allColumns.map((c: any) => c.getColId());
        const startColIndex = colIds.indexOf(range.startCol);
        const endColIndex = colIds.indexOf(range.endCol);
        const minCol = Math.min(startColIndex, endColIndex);
        const maxCol = Math.max(startColIndex, endColIndex);

        const newRows = [...multiRowsRef.current];
        let cleared = 0;

        // Track which rows have WSN cleared so we can clear their master data
        const rowsWithWsnCleared = new Set<number>();

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const colId = colIds[c];
                if (EDITABLE_COLUMNS.includes(colId)) {
                    const oldValue = newRows[r]?.[colId];
                    if (oldValue !== '' && oldValue !== null && oldValue !== undefined) {
                        saveCellUndoAction(r, colId, oldValue, '');
                    }
                    newRows[r] = { ...newRows[r], [colId]: '' };
                    cleared++;

                    // Track if WSN was cleared for this row
                    if (colId === 'wsn') {
                        rowsWithWsnCleared.add(r);
                    }
                }
            }
        }

        // Clear master data columns for rows where WSN was cleared
        rowsWithWsnCleared.forEach(r => {
            MASTER_DATA_COLUMNS.forEach(col => {
                newRows[r] = { ...newRows[r], [col]: '' };
            });
        });

        if (cleared > 0) {
            setMultiRows(newRows);
            api.refreshCells({ force: true });
            toast.success(`Cleared ${cleared} cells`, { duration: 1500 });
        }
    }, [saveCellUndoAction]);

    // ⚡ EXCEL-LIKE: Copy selected cells to clipboard (Ctrl+C)
    const handleCopy = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;

        const range = selectedRangeRef.current;

        // If no range selected, copy single focused cell
        if (!range) {
            const focusedCell = api.getFocusedCell();
            if (!focusedCell) {
                toast('No cells selected to copy', { icon: 'ℹ️', duration: 1500 });
                return;
            }
            const { rowIndex, column } = focusedCell;
            const colId = column.getColId();
            const cellValue = multiRowsRef.current[rowIndex]?.[colId] ?? '';

            navigator.clipboard.writeText(String(cellValue)).then(() => {
                toast.success('Copied to clipboard', { duration: 1000 });
            }).catch(() => {
                toast.error('Failed to copy', { duration: 1500 });
            });
            return;
        }

        const minRow = Math.min(range.startRow, range.endRow);
        const maxRow = Math.max(range.startRow, range.endRow);

        const allColumns = api.getAllDisplayedColumns?.() || [];
        const colIds = allColumns.map((c: any) => c.getColId());
        const startColIndex = colIds.indexOf(range.startCol);
        const endColIndex = colIds.indexOf(range.endCol);
        const minCol = Math.min(startColIndex, endColIndex);
        const maxCol = Math.max(startColIndex, endColIndex);

        // Build TSV (Tab-Separated Values) string for clipboard
        const lines: string[] = [];
        for (let r = minRow; r <= maxRow; r++) {
            const rowValues: string[] = [];
            for (let c = minCol; c <= maxCol; c++) {
                const colId = colIds[c];
                const cellValue = multiRowsRef.current[r]?.[colId] ?? '';
                rowValues.push(String(cellValue));
            }
            lines.push(rowValues.join('\t'));
        }
        const tsvData = lines.join('\n');

        navigator.clipboard.writeText(tsvData).then(() => {
            const cellCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
            toast.success(`Copied ${cellCount} cells`, { duration: 1000 });
        }).catch(() => {
            toast.error('Failed to copy to clipboard', { duration: 1500 });
        });
    }, []);

    // ⚡ EXCEL-LIKE: Paste from clipboard (Ctrl+V)
    const handlePaste = useCallback(async () => {
        const api = gridRef.current?.api;
        if (!api) return;

        let startRow: number;
        let startColId: string;

        // Determine paste starting position
        const range = selectedRangeRef.current;
        if (range) {
            startRow = Math.min(range.startRow, range.endRow);
            const allColumns = api.getAllDisplayedColumns?.() || [];
            const colIds = allColumns.map((c: any) => c.getColId());
            const startColIndex = colIds.indexOf(range.startCol);
            const endColIndex = colIds.indexOf(range.endCol);
            startColId = colIds[Math.min(startColIndex, endColIndex)];
        } else {
            const focusedCell = api.getFocusedCell();
            if (!focusedCell) {
                toast('Select a cell to paste into', { icon: 'ℹ️', duration: 1500 });
                return;
            }
            startRow = focusedCell.rowIndex;
            startColId = focusedCell.column.getColId();
        }

        try {
            const clipboardText = await navigator.clipboard.readText();
            if (!clipboardText.trim()) {
                toast('Clipboard is empty', { icon: 'ℹ️', duration: 1500 });
                return;
            }

            // Parse clipboard data (TSV format - Tab and Newline separated)
            const lines = clipboardText.split(/\r?\n/).filter(line => line.length > 0);
            const pasteData = lines.map(line => line.split('\t'));

            const allColumns = api.getAllDisplayedColumns?.() || [];
            const colIds = allColumns.map((c: any) => c.getColId());
            const startColIndex = colIds.indexOf(startColId);

            if (startColIndex === -1) return;

            const newRows = [...multiRowsRef.current];
            let pastedCount = 0;
            const pastedWSNRows: { rowIndex: number; wsn: string }[] = []; // Track pasted WSNs for lookup
            const batchChanges: Array<{ rowIndex: number; field: string; oldValue: any; newValue: any }> = []; // For batch undo

            for (let rowOffset = 0; rowOffset < pasteData.length; rowOffset++) {
                const targetRowIndex = startRow + rowOffset;
                if (targetRowIndex >= newRows.length) break; // Don't paste beyond grid

                const rowData = pasteData[rowOffset];

                for (let colOffset = 0; colOffset < rowData.length; colOffset++) {
                    const targetColIndex = startColIndex + colOffset;
                    if (targetColIndex >= colIds.length) break;

                    const colId = colIds[targetColIndex];

                    // Only paste to editable columns
                    if (!EDITABLE_COLUMNS.includes(colId)) continue;

                    const newValue = rowData[colOffset];
                    const oldValue = newRows[targetRowIndex]?.[colId];

                    // Track change for batch undo (instead of individual saveCellUndoAction)
                    if (oldValue !== newValue) {
                        batchChanges.push({ rowIndex: targetRowIndex, field: colId, oldValue, newValue });
                    }

                    // Apply WSN uppercase conversion if it's the WSN column
                    const finalValue = colId === 'wsn' ? newValue.trim().toUpperCase() : newValue;
                    newRows[targetRowIndex] = { ...newRows[targetRowIndex], [colId]: finalValue };
                    pastedCount++;

                    // Track WSN pastes for product lookup
                    if (colId === 'wsn' && finalValue) {
                        pastedWSNRows.push({ rowIndex: targetRowIndex, wsn: finalValue });
                    }
                }
            }

            if (pastedCount > 0) {
                // ⚡ BATCH UNDO: Save all paste changes as a single undo action
                if (batchChanges.length > 0) {
                    const batchAction: UndoAction = {
                        type: 'batch',
                        rowIndex: batchChanges[0].rowIndex,
                        field: batchChanges[0].field,
                        oldValue: null,
                        newValue: null,
                        batchChanges: batchChanges,
                    };
                    undoStackRef.current.push(batchAction);
                    if (undoStackRef.current.length > MAX_UNDO_HISTORY) {
                        undoStackRef.current.shift();
                    }
                    redoStackRef.current = [];
                }

                setMultiRows(newRows);
                api.refreshCells({ force: true });
                toast.success(`Pasted ${pastedCount} cells`, { duration: 1500 });

                // ⚡ ULTRA-FAST PARALLEL WSN LOOKUPS: Process multiple batches concurrently
                if (pastedWSNRows.length > 0 && activeWarehouse?.id) {
                    const toastId = toast.loading(`Loading ${pastedWSNRows.length} WSNs...`);

                    const BATCH_SIZE = 100; // Items per batch
                    const CONCURRENT_BATCHES = 10; // Run 10 batches simultaneously
                    let successCount = 0;
                    let failCount = 0;
                    let processedCount = 0;

                    // Helper function to lookup a single WSN
                    const lookupWSN = async (rowIndex: number, wsn: string): Promise<{ rowIndex: number; data: any | null }> => {
                        try {
                            // Try ultra-fast memory + IndexedDB cache first
                            if (cacheEnabled && cacheStats?.isReady) {
                                try {
                                    const cached = await getAvailableInventoryByWSNFast(wsn, activeWarehouse.id);
                                    if (cached) return { rowIndex, data: cached };
                                } catch { /* cache miss */ }
                            }
                            // Fall back to API
                            const res = await outboundAPI.getSourceByWSN(wsn, activeWarehouse.id);
                            return { rowIndex, data: res.data };
                        } catch {
                            return { rowIndex, data: null };
                        }
                    };

                    // Split into batches
                    const batches: Array<typeof pastedWSNRows> = [];
                    for (let i = 0; i < pastedWSNRows.length; i += BATCH_SIZE) {
                        batches.push(pastedWSNRows.slice(i, i + BATCH_SIZE));
                    }

                    // Process batches in parallel groups
                    const allResults: Array<{ rowIndex: number; data: any }> = [];

                    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
                        const concurrentBatches = batches.slice(i, i + CONCURRENT_BATCHES);

                        // Run multiple batches in parallel
                        const batchPromises = concurrentBatches.map(batch =>
                            Promise.all(batch.map(({ rowIndex, wsn }) => lookupWSN(rowIndex, wsn)))
                        );

                        const batchResults = await Promise.all(batchPromises);

                        // Flatten and collect results
                        for (const results of batchResults) {
                            allResults.push(...results);
                        }

                        processedCount += concurrentBatches.reduce((sum, b) => sum + b.length, 0);
                        toast.loading(`Loading ${processedCount}/${pastedWSNRows.length} WSNs...`, { id: toastId });
                    }

                    // Apply all results to grid at once (batch update for performance)
                    const updatedRowsMap = new Map<number, any>();

                    for (const { rowIndex, data } of allResults) {
                        if (data) {
                            const rowNode = api.getDisplayedRowAtIndex(rowIndex);
                            if (rowNode) {
                                updatedRowsMap.set(rowIndex, {
                                    ...rowNode.data,
                                    source: data.source || '',
                                    product_title: data.product_title || '',
                                    brand: data.brand || '',
                                    cms_vertical: data.cms_vertical || '',
                                    wid: data.wid || '',
                                    fsn: data.fsn || '',
                                    order_id: data.order_id || '',
                                    fkqc_remark: data.fkqc_remark || '',
                                    fk_grade: data.fk_grade || '',
                                    hsn_sac: data.hsn_sac || '',
                                    igst_rate: data.igst_rate || '',
                                    fsp: data.fsp || '',
                                    mrp: data.mrp || '',
                                    vrp: data.vrp || '',
                                    yield_value: data.yield_value || '',
                                    invoice_date: data.invoice_date || '',
                                    fkt_link: data.fkt_link || '',
                                    wh_location: data.wh_location || '',
                                    p_type: data.p_type || '',
                                    p_size: data.p_size || '',
                                    quantity: data.quantity || 1,
                                });
                                successCount++;
                            }
                        } else {
                            failCount++;
                        }
                    }

                    // Apply all updates at once using transaction for maximum speed
                    const rowNodesToUpdate: any[] = [];
                    updatedRowsMap.forEach((data, rowIndex) => {
                        const rowNode = api.getDisplayedRowAtIndex(rowIndex);
                        if (rowNode) {
                            rowNode.setData(data);
                            rowNodesToUpdate.push(rowNode);
                        }
                    });

                    // Sync to React state after all lookups
                    const updatedRows: any[] = [];
                    api.forEachNode((node: any) => { if (node.data) updatedRows.push(node.data); });
                    setMultiRows(updatedRows);

                    toast.dismiss(toastId);
                    if (successCount > 0) {
                        toast.success(`✓ Loaded ${successCount}/${pastedWSNRows.length} WSNs`, { duration: 2000 });
                    }
                    if (failCount > 0) {
                        toast.error(`${failCount} WSNs not found`, { duration: 2000 });
                    }
                }
            }
        } catch (err: any) {
            // Clipboard access denied or other error
            if (err.name === 'NotAllowedError') {
                toast.error('Clipboard access denied. Please allow clipboard access.', { duration: 2500 });
            } else {
                toast.error('Failed to paste from clipboard', { duration: 1500 });
            }
        }
    }, [saveCellUndoAction, activeWarehouse, cacheEnabled, cacheStats]);

    // ⚡ EXCEL-LIKE: Select All (Ctrl+A)
    const handleSelectAll = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;

        const totalRows = api.getDisplayedRowCount();
        if (totalRows === 0) return;

        const allColumns = api.getAllDisplayedColumns() || [];
        const editableColIds = allColumns.map((c: any) => c.getColId()).filter((id: string) => EDITABLE_COLUMNS.includes(id));

        const firstCol = editableColIds[0] || 'wsn';
        const lastCol = editableColIds[editableColIds.length - 1] || 'wsn';

        setSelectedRange({
            startRow: 0,
            endRow: totalRows - 1,
            startCol: firstCol,
            endCol: lastCol,
        });

        rangeStartCellRef.current = { rowIndex: 0, colId: firstCol };
        toast('All rows selected', { icon: '✓', duration: 1500 });
    }, []);

    // ⚡ EXCEL-LIKE: Keyboard shortcuts for Multi Entry tab (extended)
    useEffect(() => {
        if (currentTabCode !== 'multi') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const ctrlKey = e.ctrlKey || e.metaKey;
            const shiftKey = e.shiftKey;

            const activeEl = document.activeElement;
            const isEditing = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';

            // Ctrl+O → Open product link for last scanned WSN (custom shortcut)
            if (ctrlKey && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                e.stopPropagation();

                if (!ctrlOProductLinkEnabled) {
                    toast('Ctrl+O shortcut is disabled', { icon: '⚠️', duration: 1500 });
                    return;
                }

                if (!lastScannedRowRef.current?.wsn?.trim()) {
                    toast.error('No scanned WSN available', { duration: 2000 });
                    return;
                }

                const fktLink = lastScannedRowRef.current?.fkt_link;
                if (!fktLink) {
                    toast.error('No product link available for this WSN', { duration: 2000 });
                    return;
                }

                // Open product link in new tab
                try {
                    window.open(fktLink, '_blank');
                    toast.success(`Product link opened: ${lastScannedRowRef.current.wsn}`, { duration: 2000 });
                } catch (err) {
                    toast.error('Failed to open product link', { duration: 2000 });
                }
                return;
            }

            // Ctrl+Z → Undo (global, works even outside grid)
            if (ctrlKey && e.key.toLowerCase() === 'z' && !shiftKey) {
                if (isEditing) return;
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                handleUndo();
                return;
            }

            // Ctrl+Y or Ctrl+Shift+Z → Redo
            if (ctrlKey && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && shiftKey))) {
                if (isEditing) return;
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                handleRedo();
                return;
            }

            // Ctrl+D → Fill Down
            if (ctrlKey && e.key.toLowerCase() === 'd') {
                const api = gridRef.current?.api;
                if (!api) return;
                const focusedCell = api.getFocusedCell();
                if (!focusedCell) return;
                e.preventDefault();
                handleFillDown();
                return;
            }

            // Ctrl+R → Fill Right
            if (ctrlKey && e.key.toLowerCase() === 'r') {
                const api = gridRef.current?.api;
                if (!api) return;
                const focusedCell = api.getFocusedCell();
                if (!focusedCell) return;
                e.preventDefault();
                handleFillRight();
                return;
            }

            // Ctrl+C → Copy selected cells to clipboard
            if (ctrlKey && e.key.toLowerCase() === 'c' && !isEditing) {
                e.preventDefault();
                handleCopy();
                return;
            }

            // Ctrl+V → Paste from clipboard
            if (ctrlKey && e.key.toLowerCase() === 'v' && !isEditing) {
                e.preventDefault();
                handlePaste();
                return;
            }

            // Ctrl+Home → Go to first cell
            if (ctrlKey && e.key === 'Home') {
                e.preventDefault();
                handleGoToFirst();
                return;
            }

            // Ctrl+End → Go to last cell with data
            if (ctrlKey && e.key === 'End') {
                e.preventDefault();
                handleGoToLast();
                return;
            }

            // ⚡ EXCEL-LIKE: Ctrl+Arrow - Jump to last cell with data in direction
            if (ctrlKey && !shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditing) {
                const api = gridRef.current?.api;
                if (!api) return;
                const focusedCell = api.getFocusedCell();
                if (!focusedCell) return;

                e.preventDefault();
                e.stopImmediatePropagation();

                const { rowIndex, column } = focusedCell;
                const colId = column.getColId();
                const allColumns = api.getAllDisplayedColumns() || [];
                const colIds = allColumns.map((c: any) => c.getColId());
                const currentColIndex = colIds.indexOf(colId);

                let targetRow = rowIndex;
                let targetColIndex = currentColIndex;

                if (e.key === 'ArrowDown') {
                    // Find last row with data in this column
                    for (let r = multiRowsRef.current.length - 1; r > rowIndex; r--) {
                        if (multiRowsRef.current[r]?.[colId]?.toString().trim()) {
                            targetRow = r;
                            break;
                        }
                    }
                    // If no data found below, go to last row
                    if (targetRow === rowIndex) targetRow = multiRowsRef.current.length - 1;
                } else if (e.key === 'ArrowUp') {
                    // Find first row with data in column (Excel behavior: Ctrl+Up from last goes to first)
                    for (let r = 0; r < rowIndex; r++) {
                        if (multiRowsRef.current[r]?.[colId]?.toString().trim()) {
                            targetRow = r;
                            break; // Stop at FIRST row with data, not last
                        }
                    }
                    // If no data found above, go to first row
                    if (targetRow === rowIndex) targetRow = 0;
                } else if (e.key === 'ArrowRight') {
                    // Go to last column
                    targetColIndex = colIds.length - 1;
                } else if (e.key === 'ArrowLeft') {
                    // Go to first column (skip SR.NO which is index 0)
                    targetColIndex = 1;
                }

                // Clear selection and navigate
                setSelectedRange(null);
                rangeStartCellRef.current = null;
                api.setFocusedCell(targetRow, colIds[targetColIndex]);
                api.ensureIndexVisible(targetRow, 'middle');
                api.refreshCells({ force: true });
                return;
            }

            // ⚡ EXCEL-LIKE: Ctrl+Shift+Arrow - Select to last cell with data in direction
            if (ctrlKey && shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditing) {
                const api = gridRef.current?.api;
                if (!api) return;
                const focusedCell = api.getFocusedCell();
                if (!focusedCell) return;

                e.preventDefault();
                e.stopImmediatePropagation();

                const { rowIndex, column } = focusedCell;
                const colId = column.getColId();
                const allColumns = api.getAllDisplayedColumns() || [];
                const colIds = allColumns.map((c: any) => c.getColId());
                const currentColIndex = colIds.indexOf(colId);

                // Set anchor if not already set
                if (!rangeStartCellRef.current) {
                    rangeStartCellRef.current = { rowIndex, colId };
                }

                const currentRange = selectedRangeRef.current;
                let endRow = currentRange ? currentRange.endRow : rowIndex;
                let endCol = currentRange ? currentRange.endCol : colId;
                let endColIndex = colIds.indexOf(endCol);

                if (e.key === 'ArrowDown') {
                    // Select to last row with data
                    for (let r = multiRowsRef.current.length - 1; r > endRow; r--) {
                        if (multiRowsRef.current[r]?.[colId]?.toString().trim()) {
                            endRow = r;
                            break;
                        }
                    }
                    if (endRow === (currentRange?.endRow ?? rowIndex)) endRow = multiRowsRef.current.length - 1;
                } else if (e.key === 'ArrowUp') {
                    endRow = 0;
                } else if (e.key === 'ArrowRight') {
                    endColIndex = colIds.length - 1;
                    endCol = colIds[endColIndex];
                } else if (e.key === 'ArrowLeft') {
                    endColIndex = 1;
                    endCol = colIds[endColIndex];
                }

                setSelectedRange({
                    startRow: rangeStartCellRef.current.rowIndex,
                    endRow,
                    startCol: rangeStartCellRef.current.colId,
                    endCol,
                });

                api.setFocusedCell(endRow, endCol);
                api.ensureIndexVisible(endRow, 'middle');
                return;
            }

            // Ctrl+A - Select All
            if (ctrlKey && e.key.toLowerCase() === 'a' && !isEditing) {
                e.preventDefault();
                handleSelectAll();
                return;
            }

            // Delete/Backspace - Clear cells
            if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditing) {
                e.preventDefault();
                handleClearCells();
                return;
            }

            // Escape → Clear selection
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setSelectedRange(null);
                rangeStartCellRef.current = null;
                const api = gridRef.current?.api;
                if (api) {
                    api.deselectAll();
                    api.stopEditing(true);
                    api.refreshCells({ force: true });
                }
                toast('Selection cleared', { icon: '✓', duration: 1000 });
                return;
            }

            // F2 → Edit current cell
            if (e.key === 'F2' && !isEditing) {
                const api = gridRef.current?.api;
                if (!api) return;
                const focusedCell = api.getFocusedCell();
                if (focusedCell) {
                    e.preventDefault();
                    api.startEditingCell({
                        rowIndex: focusedCell.rowIndex,
                        colKey: focusedCell.column.getColId(),
                    });
                }
                return;
            }

            // Arrow keys WITHOUT Shift - Clear selection and move (Excel-like behavior)
            if (!shiftKey && !ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditing) {
                // If there's a selection, clear it but let AG Grid handle the movement
                if (selectedRangeRef.current) {
                    setSelectedRange(null);
                    rangeStartCellRef.current = null;
                    const api = gridRef.current?.api;
                    if (api) {
                        api.refreshCells({ force: true });
                    }
                }
                // Let AG Grid handle the arrow key navigation naturally
                return;
            }

            // Shift+Arrow keys - Extend selection (Excel-like behavior)
            if (shiftKey && !ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditing) {
                const api = gridRef.current?.api;
                if (!api) return;

                const focusedCell = api.getFocusedCell();
                if (!focusedCell) return;

                e.preventDefault();
                e.stopImmediatePropagation(); // Stop AG Grid from handling this

                const { rowIndex, column } = focusedCell;
                const colId = column.getColId();

                const allColumns = api.getAllDisplayedColumns() || [];
                const colIds = allColumns.map((c: any) => c.getColId());

                // If no anchor set, use current focused cell as anchor (starting point)
                if (!rangeStartCellRef.current) {
                    rangeStartCellRef.current = { rowIndex, colId };
                }

                // Get current end position from existing selection, or use anchor as starting point
                const currentRange = selectedRangeRef.current;
                let currentEndRow = currentRange ? currentRange.endRow : rangeStartCellRef.current.rowIndex;
                let currentEndCol = currentRange ? currentRange.endCol : rangeStartCellRef.current.colId;
                const currentEndColIndex = colIds.indexOf(currentEndCol);

                let newEndRow = currentEndRow;
                let newEndCol = currentEndCol;

                // Extend selection from current end point
                if (e.key === 'ArrowUp') newEndRow = Math.max(0, currentEndRow - 1);
                if (e.key === 'ArrowDown') newEndRow = Math.min(multiRowsRef.current.length - 1, currentEndRow + 1);
                if (e.key === 'ArrowLeft') {
                    const newColIndex = Math.max(0, currentEndColIndex - 1);
                    newEndCol = colIds[newColIndex];
                }
                if (e.key === 'ArrowRight') {
                    const newColIndex = Math.min(colIds.length - 1, currentEndColIndex + 1);
                    newEndCol = colIds[newColIndex];
                }

                // Update range - use rangeStartCellRef as anchor
                setSelectedRange({
                    startRow: rangeStartCellRef.current.rowIndex,
                    endRow: newEndRow,
                    startCol: rangeStartCellRef.current.colId,
                    endCol: newEndCol,
                });

                // Move focus to follow selection end
                api.setFocusedCell(newEndRow, newEndCol);
                api.ensureIndexVisible(newEndRow, 'middle');
                return; // Exit early
            }
        };

        // Use capture phase to intercept before AG Grid handles it
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [currentTabCode, handleSelectAll, handleClearCells, handleUndo, handleRedo, handleFillDown, handleFillRight, handleGoToFirst, handleGoToLast, handleCopy, handlePaste, ctrlOProductLinkEnabled]);

    // ✅ AUTO-FETCH SOURCE DATA ON WSN CELL EDIT (MULTI ENTRY)
    const onCellValueChanged = useCallback(
        async (params: any) => {
            const field = params.column.getColId();
            const rowNode = params.node;
            const rowIndex = params.rowIndex;
            const rowData = rowNode.data;
            const oldValue = params.oldValue;
            const newValue = params.newValue;

            // ⚡ EXCEL-LIKE: Save cell-level undo action ONLY for user-editable columns
            // This prevents auto-populated master data fields from creating undo entries
            if (oldValue !== newValue && rowIndex !== null && rowIndex !== undefined && EDITABLE_COLUMNS.includes(field)) {
                // For WSN field, save the entire row data for proper undo
                if (field === 'wsn') {
                    const currentRowData = { ...rowData };
                    const oldRowData = { ...currentRowData, [field]: oldValue };
                    // Clear master data columns in old row data since they weren't loaded for old WSN
                    ['source', 'product_title', 'brand', 'cms_vertical', 'wid', 'fsn', 'order_id',
                        'fkqc_remark', 'fk_grade', 'hsn_sac', 'igst_rate', 'fsp', 'mrp', 'vrp',
                        'yield_value', 'invoice_date', 'fkt_link', 'wh_location', 'p_type', 'p_size', 'quantity'
                    ].forEach(col => { oldRowData[col] = ''; });
                    saveCellUndoAction(rowIndex, field, oldValue, newValue, oldRowData, undefined);
                } else {
                    // For other editable columns (dispatch_remarks, other_remarks, quantity)
                    saveCellUndoAction(rowIndex, field, oldValue, newValue);
                }
            }

            if (field === 'wsn') {
                // ⚡ Convert WSN to uppercase immediately
                const wsn = newValue?.trim()?.toUpperCase();

                // If WSN changed to uppercase, update the cell
                if (wsn && wsn !== newValue) {
                    rowNode.setDataValue('wsn', wsn);
                }

                // WSN cleared -> clear all master data columns using setData for performance
                if (!wsn) {
                    const clearedData = {
                        ...rowNode.data,
                        wsn: '',
                        source: '', product_title: '', brand: '', cms_vertical: '', wid: '', fsn: '',
                        order_id: '', fkqc_remark: '', fk_grade: '', hsn_sac: '', igst_rate: '',
                        fsp: '', mrp: '', vrp: '', yield_value: '', invoice_date: '', fkt_link: '',
                        wh_location: '', p_type: '', p_size: '', quantity: ''
                    };
                    rowNode.setData(clearedData);

                    // Sync to React state
                    const updatedRows: any[] = [];
                    gridRef.current?.api.forEachNode((node: any) => { if (node.data) updatedRows.push(node.data); });
                    setMultiRows(updatedRows);
                    return;
                }

                // NOTE: WSN overwrite check moved to onCellEditingStopped to prevent re-trigger loops

                if (!activeWarehouse) return;

                // ⚡ AUTO-EXTEND: Add 500 rows when entering data near the end
                if (rowIndex != null && rowIndex >= params.api.getDisplayedRowCount() - 2) {
                    add500Rows();
                }

                // Build current grid snapshot
                const allRows: any[] = [];
                gridRef.current?.api.forEachNode((node: any) => { if (node.data) allRows.push(node.data); });

                // Immediate inline duplicate detection (grid duplicates)
                const counts = new Map<string, number>();
                allRows.forEach((r) => {
                    const val = r.wsn?.trim()?.toUpperCase();
                    if (val) counts.set(val, (counts.get(val) || 0) + 1);
                });

                const isGridDuplicateImmediate = (counts.get(wsn) || 0) > 1;

                if (isGridDuplicateImmediate) {
                    toast(`Duplicate WSN in grid: ${wsn}`, {
                        duration: 2500,
                        style: {
                            background: '#ffffff',
                            color: '#d97706',
                            border: '2px solid #f59e0b',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            fontWeight: 600,
                            fontSize: '14px',
                        },
                        icon: '⚠️',
                    });

                    // ⚡ PERFORMANCE: Use setData() once instead of multiple setDataValue() calls
                    const clearedData = {
                        ...rowNode.data,
                        wsn: '',
                        source: '', product_title: '', brand: '', cms_vertical: '', wid: '', fsn: '',
                        order_id: '', fkqc_remark: '', fk_grade: '', hsn_sac: '', igst_rate: '',
                        fsp: '', mrp: '', vrp: '', yield_value: '', invoice_date: '', fkt_link: '',
                        wh_location: '', p_type: '', p_size: '', quantity: ''
                    };
                    rowNode.setData(clearedData);

                    // Update duplicates state & refocus
                    const updatedRows: any[] = [];
                    gridRef.current?.api.forEachNode((node: any) => { if (node.data) updatedRows.push(node.data); });
                    checkDuplicates(updatedRows);

                    setTimeout(() => {
                        params.api.startEditingCell({ rowIndex: params.rowIndex, colKey: 'wsn' });
                    }, 100);

                    return;
                }

                // Check existing outbound WSNs in this warehouse (same-warehouse duplicate)
                if (existingOutboundWSNs.has(wsn)) {
                    toast(`WSN ${wsn} already dispatched in this warehouse`, {
                        duration: 2500,
                        style: {
                            background: '#ffffff',
                            color: '#d97706',
                            border: '2px solid #f59e0b',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            fontWeight: 600,
                            fontSize: '14px',
                        },
                        icon: '⚠️',
                    });

                    // Clear all data columns using setData for performance
                    const clearedData = { ...rowNode.data, wsn: '', source: '', product_title: '', brand: '', cms_vertical: '', wid: '', fsn: '', order_id: '', fkqc_remark: '', fk_grade: '', hsn_sac: '', igst_rate: '', fsp: '', mrp: '', vrp: '', yield_value: '', invoice_date: '', fkt_link: '', wh_location: '', p_type: '', p_size: '', quantity: '' };
                    rowNode.setData(clearedData);

                    const updatedRows: any[] = [];
                    gridRef.current?.api.forEachNode((node: any) => { if (node.data) updatedRows.push(node.data); });
                    await checkDuplicates(updatedRows);

                    setTimeout(() => {
                        params.api.startEditingCell({ rowIndex: params.rowIndex, colKey: 'wsn' });
                    }, 100);

                    return;
                }

                // Cross-warehouse detection: if WSN exists anywhere but not in this warehouse
                try {
                    const allWsnsResp = await outboundAPI.getAllOutboundWSNs();
                    const allWsns: string[] = allWsnsResp.data.map((w: string) => w.toUpperCase());
                    if (allWsns.includes(wsn) && !existingOutboundWSNs.has(wsn)) {
                        toast.error(`WSN ${wsn} already dispatched in another warehouse`, {
                            duration: 3000,
                            style: {
                                background: '#ffffff',
                                color: '#dc2626',
                                border: '2px solid #dc2626',
                                borderRadius: '8px',
                                padding: '12px 16px',
                                fontWeight: 600,
                                fontSize: '14px',
                            },
                            icon: '🚫',
                        });

                        // Clear all data columns using setData for performance
                        const clearedData = { ...rowNode.data, wsn: '', source: '', product_title: '', brand: '', cms_vertical: '', wid: '', fsn: '', order_id: '', fkqc_remark: '', fk_grade: '', hsn_sac: '', igst_rate: '', fsp: '', mrp: '', vrp: '', yield_value: '', invoice_date: '', fkt_link: '', wh_location: '', p_type: '', p_size: '', quantity: '' };
                        rowNode.setData(clearedData);

                        const updatedRows: any[] = [];
                        gridRef.current?.api.forEachNode((node: any) => { if (node.data) updatedRows.push(node.data); });
                        await checkDuplicates(updatedRows);

                        setTimeout(() => {
                            params.api.startEditingCell({ rowIndex: params.rowIndex, colKey: 'wsn' });
                        }, 100);

                        return;
                    }
                } catch (err) {
                    // ignore remote lookup errors
                }

                // If we reach here, proceed to fetch source/master data
                // ⚡ CACHE + OFFLINE: Try ultra-fast memory cache first, fall back to API, support offline mode (Issue #7)
                try {
                    let data = null;
                    let fromCache = false;

                    // Try ultra-fast memory + IndexedDB cache first (works offline)
                    if (cacheEnabled && cacheStats?.isReady) {
                        try {
                            const cached = await getAvailableInventoryByWSNFast(wsn, activeWarehouse.id);
                            if (cached) {
                                data = cached;
                                fromCache = true;
                                console.log(`⚡ Memory/Cache HIT for ${wsn}`);
                            }
                        } catch (cacheErr) {
                            console.log(`📡 Cache miss for ${wsn}`);
                        }
                    }

                    // Fall back to API if not in cache (only if online)
                    if (!data) {
                        try {
                            const res = await outboundAPI.getSourceByWSN(wsn, activeWarehouse.id);
                            data = res.data;
                        } catch (apiErr: any) {
                            // If API fails and we have cache enabled, show offline message
                            if (cacheEnabled) {
                                toast.error(`${wsn}: Not found in cache. Enable cache refresh when online.`);
                            } else {
                                // If cache is disabled and API fails, show error
                                if (apiErr.response?.status === 409) {
                                    toast.error(`${wsn} already dispatched`);
                                } else if (apiErr.code === 'ERR_NETWORK' || apiErr.message?.includes('Network')) {
                                    toast.error(`Offline - Enable cache for offline mode`);
                                } else {
                                    toast.error(`${wsn}: Not found`);
                                }
                            }
                            throw apiErr;
                        }
                    }

                    // Set all product columns from response - using setData for performance (single update instead of 21 calls)
                    const updatedData = {
                        ...rowNode.data,
                        source: data.source || '',
                        product_title: data.product_title || '',
                        brand: data.brand || '',
                        cms_vertical: data.cms_vertical || '',
                        wid: data.wid || '',
                        fsn: data.fsn || '',
                        order_id: data.order_id || '',
                        fkqc_remark: data.fkqc_remark || '',
                        fk_grade: data.fk_grade || '',
                        hsn_sac: data.hsn_sac || '',
                        igst_rate: data.igst_rate || '',
                        fsp: data.fsp || '',
                        mrp: data.mrp || '',
                        vrp: data.vrp || '',
                        yield_value: data.yield_value || '',
                        invoice_date: data.invoice_date || '',
                        fkt_link: data.fkt_link || '',
                        wh_location: data.wh_location || '',
                        p_type: data.p_type || '',
                        p_size: data.p_size || '',
                        // ⚡ AUTO-SET: Quantity defaults to 1 since WSN is unique per product
                        quantity: data.quantity || 1,
                    };
                    rowNode.setData(updatedData);

                    // ⚡ CTRL+O: Update last scanned row ref for product link shortcut
                    lastScannedRowRef.current = { wsn, ...data };

                    // ⚡ HIGHLIGHT: Visual feedback for scanned row
                    highlightRow(params.rowIndex, 1500);

                    // ⚡ SCANNER MODE: Record scan activity
                    recordScanActivity();

                    toast.success(`✓ ${fromCache ? '(Cache)' : ''} Data loaded for ${wsn}`);
                } catch (err: any) {
                    // Already handled above
                }
            }

            // ⚡ CRITICAL: Sync grid data to React state for auto-save to work
            const updatedRows: any[] = [];
            gridRef.current?.api.forEachNode((node: any) => {
                if (node.data) {
                    updatedRows.push(node.data);
                }
            });
            setMultiRows(updatedRows); // This triggers the auto-save useEffect
            checkDuplicates(updatedRows);
        },
        [activeWarehouse, checkDuplicates, existingOutboundWSNs, cacheEnabled, cacheStats, saveCellUndoAction]
    );

    // ✅ ROW STYLING (DUPLICATES + HIGHLIGHTED)
    const getRowStyle = useCallback(
        (params: any): { [key: string]: string } | undefined => {
            // Check if row is highlighted (recently scanned)
            const rowIndex = params.node?.rowIndex;
            if (rowIndex !== undefined && highlightedRows.has(rowIndex)) {
                return {
                    background: 'linear-gradient(90deg, #e8f5e9 0%, #c8e6c9 50%, #e8f5e9 100%)',
                    transition: 'background 0.3s ease-out'
                };
            }

            // Check for duplicates
            const wsn = params.data?.wsn?.trim()?.toUpperCase();
            if (wsn && (gridDuplicateWSNs.has(wsn) || crossWarehouseWSNs.has(wsn))) {
                return { background: '#ffebee' };
            }
            return undefined;
        },
        [gridDuplicateWSNs, crossWarehouseWSNs, highlightedRows]
    );

    // ====== WSN OVERWRITE DIALOG HANDLERS ======
    const handleOverwriteCancel = () => {
        // User cancelled - keep existing WSN
        if (pendingWSNRef.current) {
            const { rowIndex, params } = pendingWSNRef.current;
            setTimeout(() => {
                params?.api?.startEditingCell({ rowIndex, colKey: 'wsn' });
            }, 100);
        }
        setWsnOverwriteDialog(null);
        pendingWSNRef.current = null;
    };

    const handleOverwriteReplace = async () => {
        // User chose to replace - proceed with new WSN
        if (pendingWSNRef.current && activeWarehouse?.id) {
            const { wsn, rowIndex, params } = pendingWSNRef.current;
            const rowNode = params?.api?.getDisplayedRowAtIndex(rowIndex);
            if (rowNode) {
                rowNode.setDataValue('wsn', wsn);
                // Fetch and apply master data (ultra-fast cache function handles API fallback)
                try {
                    const data = await getAvailableInventoryByWSNFast(wsn, activeWarehouse.id);
                    if (data) {
                        // Exclude vehicle_no/inbound_vehicle_no from spread - these are inbound vehicle, not dispatch vehicle
                        const { vehicle_no: _v, inbound_vehicle_no: _iv, ...safeData } = data;
                        const updatedData = { ...rowNode.data, ...safeData, wsn };
                        rowNode.setData(updatedData);
                        // Sync to React state
                        const updatedRows: any[] = [];
                        gridRef.current?.api.forEachNode((node: any) => { if (node.data) updatedRows.push(node.data); });
                        setMultiRows(updatedRows);
                        checkDuplicates(updatedRows);
                    }
                } catch { /* ignore */ }
                // Move to next row
                setTimeout(() => {
                    params?.api?.startEditingCell({ rowIndex: rowIndex + 1, colKey: 'wsn' });
                }, 100);
            }
        }
        setWsnOverwriteDialog(null);
        pendingWSNRef.current = null;
    };

    const handleOverwriteAddToNextRow = async () => {
        // User chose to add new WSN to next empty row
        if (pendingWSNRef.current && activeWarehouse?.id) {
            const { wsn, params } = pendingWSNRef.current;
            // Find next empty row
            let nextEmptyIndex = -1;
            for (let i = 0; i < multiRows.length; i++) {
                if (!multiRows[i].wsn?.trim()) {
                    nextEmptyIndex = i;
                    break;
                }
            }
            if (nextEmptyIndex >= 0) {
                const rowNode = params?.api?.getDisplayedRowAtIndex(nextEmptyIndex);
                if (rowNode) {
                    rowNode.setDataValue('wsn', wsn);
                    // Fetch master data (ultra-fast cache function handles API fallback)
                    try {
                        const data = await getAvailableInventoryByWSNFast(wsn, activeWarehouse.id);
                        if (data) {
                            // Exclude vehicle_no/inbound_vehicle_no from spread - these are inbound vehicle, not dispatch vehicle
                            const { vehicle_no: _v, inbound_vehicle_no: _iv, ...safeData } = data;
                            const updatedData = { ...rowNode.data, ...safeData, wsn };
                            rowNode.setData(updatedData);
                            // Sync to React state
                            const updatedRows: any[] = [];
                            gridRef.current?.api.forEachNode((node: any) => { if (node.data) updatedRows.push(node.data); });
                            setMultiRows(updatedRows);
                            checkDuplicates(updatedRows);
                        }
                    } catch { /* ignore */ }
                    // Move to row after new one
                    setTimeout(() => {
                        params?.api?.startEditingCell({ rowIndex: nextEmptyIndex + 1, colKey: 'wsn' });
                    }, 100);
                }
            } else {
                toast.error('No empty row available');
            }
        }
        setWsnOverwriteDialog(null);
        pendingWSNRef.current = null;
    };

    // ✅ MULTI ENTRY SUBMIT
    const handleMultiSubmit = async () => {
        if (!activeWarehouse) {
            toast.error('Please select a warehouse');
            return;
        }

        // ⚡ VALIDATION: Offline check
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        if (!isOnline) {
            toast.error('Cannot submit while offline. Data is saved locally - submit when back online.', {
                duration: 4000,
                icon: '📴'
            });
            return;
        }

        // Get customer from either selectedCustomer or commonCustomer
        const customerName = selectedCustomer || commonCustomer;

        // Validate common fields
        if (!commonDate || !customerName) {
            toast.error('Please enter dispatch date and customer name');
            return;
        }

        const rows: any[] = [];
        gridRef.current?.api.forEachNode((node: any) => {
            if (node.data) {
                rows.push(node.data);
            }
        });
        const filledRows = rows.filter((r: any) => r.wsn?.trim());

        if (filledRows.length === 0) {
            toast.error('No WSNs entered');
            return;
        }

        if (duplicateWSNs.size > 0) {
            toast.error('Remove duplicate WSNs before submitting');
            return;
        }

        // ⚡ VALIDATION: Grid duplicate check
        if (gridDuplicateWSNs.size > 0) {
            toast.error('Remove duplicate WSNs in grid before submitting');
            return;
        }

        // ⚡ VALIDATION: Cross-warehouse check
        if (crossWarehouseWSNs.size > 0) {
            toast.error('Some WSNs already dispatched from other warehouses');
            return;
        }

        setMultiLoading(true);

        setMultiErrorMessage('');

        try {
            // Add common fields to each row
            const entriesWithCommonFields = filledRows.map((row: any) => ({
                ...row,
                dispatch_date: commonDate,
                customer_name: selectedCustomer || commonCustomer,
                vehicle_no: commonVehicle || '',
            }));

            const payload = {
                entries: entriesWithCommonFields,
                warehouse_id: activeWarehouse.id,
            };

            const res = await outboundAPI.multiEntry(payload);

            const results = res.data?.results || [];
            const successCount = res.data?.successCount || 0;
            const totalCount = res.data?.totalCount || entriesWithCommonFields.length;

            // --- Toasts ---
            if (successCount === totalCount) {
                toast.success(`✓ ${successCount} entries created (Batch: ${res.data.batchId})`);
            } else if (successCount > 0) {
                const failedCount = totalCount - successCount;
                toast.success(`${successCount}/${totalCount} entries created, ${failedCount} failed — failed rows kept in grid`);
            } else {
                toast.error('No entries were saved. Check data.');
            }

            // --- Smart 3-way clearing ---
            if (successCount === totalCount) {
                // All succeeded → full clear
                setMultiRows(generateEmptyRows(500) as OutboundItem[]);
                setDuplicateWSNs(new Set());
                setGridDuplicateWSNs(new Set());
                setCrossWarehouseWSNs(new Set());
                setCommonDate(new Date().toISOString().split('T')[0]);
                setCommonCustomer('');
                setSelectedCustomer('');
                setCommonVehicle('');
                await clearDraft();

                if (isWMSCacheEnabled()) {
                    const dispatchedWSNs = entriesWithCommonFields.map((r: any) => r.wsn?.trim()?.toUpperCase()).filter(Boolean);
                    removeMultipleFromAvailableCache(dispatchedWSNs).catch(() => { });
                }
            } else if (successCount > 0) {
                // Partial success → remove only successful WSNs, keep failed rows
                const failedWSNs = new Set(
                    results.filter((r: any) => r.status !== 'SUCCESS').map((r: any) => r.wsn?.toUpperCase())
                );
                const survivingRows = multiRows.filter((r: any) => {
                    const wsn = r.wsn?.trim()?.toUpperCase();
                    if (!wsn) return false;
                    return failedWSNs.has(wsn);
                });
                const padding = generateEmptyRows(Math.max(500 - survivingRows.length, 0)) as OutboundItem[];
                const newRows = [...survivingRows, ...padding];
                setMultiRows(newRows);
                await saveDraftImmediate(newRows);

                // Cache update for successful WSNs only
                if (isWMSCacheEnabled()) {
                    const successWSNs = results
                        .filter((r: any) => r.status === 'SUCCESS')
                        .map((r: any) => r.wsn?.trim()?.toUpperCase())
                        .filter(Boolean);
                    removeMultipleFromAvailableCache(successWSNs).catch(() => { });
                }
            }
            // else: successCount === 0 → keep all rows as-is

            loadExistingWSNs();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Multi entry failed');
            setMultiErrorMessage(err.response?.data?.error || 'Failed to submit');
        } finally {
            setMultiLoading(false);
        }
    };

    // ------------------ Draft helpers & autosave ------------------
    const getDraftKey = () => {
        if (!activeWarehouse?.id || !user?.id) return null;
        return `outboundMultiDraft_${activeWarehouse.id}_${user.id}`;
    };

    const saveDraftImmediate = async (rowsToSave = multiRows) => {
        const key = getDraftKey();
        if (!key) return;
        setDraftSaving(true);
        try {
            // ⚡ DRAFT: Save customer and vehicle along with rows
            await localforage.setItem(key, {
                rows: rowsToSave,
                savedAt: Date.now(),
                version: 2,
                // Include common fields in draft
                customerName: selectedCustomer || commonCustomer,
                vehicleNo: commonVehicle,
                dispatchDate: commonDate,
            });
            setDraftSavedAt(Date.now());
            setDraftExists(true);
        } catch (err) {
            console.error('Failed to save outbound draft', err);
        } finally {
            setDraftSaving(false);
        }
    };

    const clearDraft = async () => {
        const key = getDraftKey();
        if (!key) return;
        try {
            await localforage.removeItem(key);
            setDraftSavedAt(null);
            setDraftExists(false);
            // Also clear customer and vehicle fields
            setCommonCustomer('');
            setSelectedCustomer('');
            setCommonVehicle('');
            toast.success('Draft cleared');
        } catch (err) {
            console.error('Failed to clear outbound draft', err);
        }
    };

    // Load draft when warehouse/user become available
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            const key = getDraftKey();
            if (!key) return;
            try {
                const draft: any = await localforage.getItem(key);
                if (draft && draft.rows && draft.rows.length > 0 && mounted) {
                    // Generate unique row IDs for restored rows
                    let startId = rowIdCounterRef.current;
                    const restored = draft.rows.map((r: any, idx: number) => ({
                        dispatch_date: r.dispatch_date || commonDate,
                        customer_name: r.customer_name || selectedCustomer,
                        vehicle_no: r.vehicle_no || commonVehicle,
                        ...r,
                        _rowId: r._rowId || `row_${startId + idx}`, // Ensure row ID exists
                    }));
                    rowIdCounterRef.current = startId + restored.length;
                    setMultiRows(restored);
                    setDraftSavedAt(draft.savedAt || Date.now());
                    setDraftExists(true);

                    // ⚡ DRAFT: Restore customer and vehicle from draft
                    if (draft.customerName) {
                        setSelectedCustomer(draft.customerName);
                        setCommonCustomer(draft.customerName);
                    }
                    if (draft.vehicleNo) {
                        setCommonVehicle(draft.vehicleNo);
                    }
                    if (draft.dispatchDate) {
                        setCommonDate(draft.dispatchDate);
                    }
                }
            } catch (err) {
                console.error('Failed to load outbound draft', err);
            }
        };
        load();
        return () => { mounted = false; };
    }, [activeWarehouse?.id, user?.id]);

    // Autosave (debounced) whenever multiRows or common fields change
    useEffect(() => {
        lastChangeAtRef.current = Date.now();

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveDraftImmediate(multiRows);
        }, 500);

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [multiRows, activeWarehouse?.id, user?.id, selectedCustomer, commonCustomer, commonVehicle, commonDate]);

    // Warn on unload if there are unsaved changes
    useEffect(() => {
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            const hasData = multiRows.some(r => r.wsn?.trim());
            if (!hasData) return;
            if (!draftSavedAt || (lastChangeAtRef.current && draftSavedAt < lastChangeAtRef.current)) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [multiRows, draftSavedAt]);

    // Template download function (used by BulkUploadCard)
    const handleConfirmDownload = async () => {
        const template = [
            {
                WSN: 'ABC123',
                DISPATCHDATE: '2025-12-19',
                CUSTOMERNAME: 'Flipkart',
                VEHICLENO: 'MH01AB1234',
                DISPATCHREMARKS: 'Good condition',
                OTHERREMARKS: '',
            },
        ];
        // Generate actual Excel file (.xlsx) for compatibility with backend
        try {
            const XLSX = await import('xlsx');
            const worksheet = XLSX.utils.json_to_sheet(template);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
            XLSX.writeFile(workbook, 'outbound_bulk_template.xlsx');
            toast.success('Template downloaded (.xlsx)');
        } catch (error) {
            console.error('Failed to generate Excel template:', error);
            toast.error('Failed to download template');
        }
    };

    // ====== OUTBOUND LIST ======
    // ⚡ HELPER: Generate cache key for current filters
    const getCacheKey = useCallback(() => {
        return JSON.stringify({
            warehouseId: activeWarehouse?.id,
            page,
            limit,
            search: searchDebounced,
            source: sourceFilter,
            customer: customerFilter,
            startDate: startDateFilter,
            endDate: endDateFilter,
            batchId: batchFilter,
            brand: brandFilter,
            category: categoryFilter,
        });
    }, [activeWarehouse?.id, page, limit, searchDebounced, sourceFilter, customerFilter, startDateFilter, endDateFilter, batchFilter, brandFilter, categoryFilter]);

    // ⚡ PREFETCH: Prefetch next page in background
    const prefetchNextPage = useCallback(async () => {
        const totalPages = Math.ceil(total / limit);
        if (page >= totalPages) return;

        const nextPageCacheKey = JSON.stringify({
            warehouseId: activeWarehouse?.id,
            page: page + 1,
            limit,
            search: searchDebounced,
            source: sourceFilter,
            customer: customerFilter,
            startDate: startDateFilter,
            endDate: endDateFilter,
            batchId: batchFilter,
            brand: brandFilter,
            category: categoryFilter,
        });

        const cached = pageCacheRef.current.get(nextPageCacheKey);
        if (cached && Date.now() - cached.timestamp < PAGE_CACHE_TTL) return;

        try {
            const res = await outboundAPI.getList(page + 1, limit, {
                warehouseId: activeWarehouse?.id,
                search: searchDebounced,
                source: sourceFilter,
                customer: customerFilter,
                startDate: startDateFilter,
                endDate: endDateFilter,
                batchId: batchFilter,
                brand: brandFilter,
                category: categoryFilter,
            });
            const rows = res.data?.data || [];
            pageCacheRef.current.set(nextPageCacheKey, {
                data: rows,
                total: res.data?.total || 0,
                timestamp: Date.now(),
            });
        } catch { /* Silently fail - prefetch is optional */ }
    }, [activeWarehouse?.id, page, limit, total, searchDebounced, sourceFilter, customerFilter, startDateFilter, endDateFilter, batchFilter, brandFilter, categoryFilter]);

    const loadOutboundList = async (opts: { buttonRefresh?: boolean } = { buttonRefresh: false }) => {
        if (!activeWarehouse) return;

        // Use request id to ignore stale responses
        currentLoadIdRef.current += 1;
        const loadId = currentLoadIdRef.current;

        const cacheKey = getCacheKey();

        // ⚡ PAGE CACHE: Check cache first (unless force refresh)
        const { buttonRefresh } = opts;
        if (!buttonRefresh) {
            const cached = pageCacheRef.current.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < PAGE_CACHE_TTL) {
                previousDataRef.current = cached.data;
                setListData(cached.data);
                setTotal(cached.total);
                setLastRefreshTime(new Date(cached.timestamp));
                setInitialLoadDone(true);
                // Keep spinner visible briefly for consistent UX during filter reset
                setTimeout(() => { setListLoading(false); setIsFetching(false); }, 300);
                setTimeout(() => prefetchNextPage(), 100);
                return;
            }
        }

        if (buttonRefresh) {
            setRefreshing(true);
        } else {
            // Always show loading spinner immediately for smooth UX (like inbound page)
            setListLoading(true);
            // Start a delayed overlay timer to avoid flicker for fast responses
            if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
            overlayShownRef.current = false;
            overlayStartRef.current = null;
            overlayTimerRef.current = setTimeout(() => {
                try {
                    setTopLoading(true);
                    overlayShownRef.current = true;
                    overlayStartRef.current = Date.now();
                    // We intentionally avoid AG Grid's built-in loading overlay to prevent "Loading..." text
                    // and rely on our custom spinner overlays for consistency.
                    try { listGridRef.current?.api?.hideOverlay(); } catch { }
                } catch (err) { }
                overlayTimerRef.current = null;
            }, SHOW_OVERLAY_DELAY);
        }

        // Mark fetching in-progress
        setIsFetching(true);

        // Cancel any previous in-flight request & pending empty timers
        if (outboundAbortControllerRef.current) {
            try { outboundAbortControllerRef.current.abort(); } catch { }
            outboundAbortControllerRef.current = null;
        }
        if (emptyTimerRef.current) {
            clearTimeout(emptyTimerRef.current);
            emptyTimerRef.current = null;
        }
        const controller = new AbortController();
        outboundAbortControllerRef.current = controller;

        try {
            const res = await outboundAPI.getList(page, limit, {
                warehouseId: activeWarehouse.id,
                search: searchDebounced,
                source: sourceFilter,
                customer: customerFilter,
                startDate: startDateFilter,
                endDate: endDateFilter,
                batchId: batchFilter,
                brand: brandFilter,
                category: categoryFilter,
            }, { signal: controller.signal });

            // Only apply if this is the latest request
            if (loadId === currentLoadIdRef.current) {
                const data = res.data.data || [];
                setTotal(res.data.total || 0);

                // DEBUG: Log data received
                console.log('📦 Outbound List Data:', { page, limit, dataLength: data.length, total: res.data.total });

                // Clear any pending empty timers (we are about to handle the new response)
                if (emptyTimerRef.current) {
                    clearTimeout(emptyTimerRef.current);
                    emptyTimerRef.current = null;
                }

                // Always update listData and grid with new data (even if same length)
                setListData(data);
                previousDataRef.current = data;
                try {
                    const api = listGridRef.current?.api || listGridRef.current;
                    if (api && typeof api.setRowData === 'function') {
                        api.setRowData(data);
                        console.log('📦 AG Grid setRowData called with', data.length, 'items');
                    }
                } catch (err) { /* ignore */ }

                let uniqCusts: string[] = [];
                try {
                    const custRes = await outboundAPI.getCustomers(activeWarehouse.id);
                    if (Array.isArray(custRes.data) && custRes.data.length > 0) {
                        uniqCusts = custRes.data;
                    }
                } catch (err) {
                    // ignore and fallback
                }

                if (uniqCusts.length === 0) {
                    const names: string[] = data.map((d: any) => String(d.customer_name || '')).filter((n: string) => n !== '');
                    uniqCusts = Array.from(new Set(names)).sort();
                }

                setCustomers(uniqCusts);

                // Populate source options from outbound endpoint (preferred) or dedupe from data
                let uniqSources: string[] = [];
                try {
                    const sRes = await outboundAPI.getSources(activeWarehouse.id);
                    if (Array.isArray(sRes.data) && sRes.data.length > 0) uniqSources = sRes.data;
                } catch (err) {
                    // ignore and fallback to data
                }

                if (uniqSources.length === 0) {
                    const srcs: string[] = data.map((d: any) => String(d.source || '')).filter((s: string) => s !== '');
                    uniqSources = Array.from(new Set(srcs)).sort();
                }

                setSources(uniqSources);

                // Load batches in background so batch dropdowns are available for filters/export
                loadBatches();

                // Reset any customer/source-related filters if they are not in the current outbound lists
                if (customerFilter && !uniqCusts.includes(customerFilter)) {
                    setCustomerFilter('');
                }
                if (exportCustomer && !uniqCusts.includes(exportCustomer)) {
                    setExportCustomer('');
                }
                if (sourceFilter && !uniqSources.includes(sourceFilter)) {
                    setSourceFilter('');
                }
                if (exportSource && !uniqSources.includes(exportSource)) {
                    setExportSource('');
                }

                // Calculate stats
                const pickingCount = data.filter((d: any) => d.source === 'PICKING').length;
                const qcCount = data.filter((d: any) => d.source === 'QC').length;
                const inboundCount = data.filter((d: any) => d.source === 'INBOUND').length;

                setStats({
                    picking: pickingCount,
                    qc: qcCount,
                    inbound: inboundCount,
                    total: data.length,
                });

                // Reset retry counter on success
                listRetryCountRef.current = 0;
                retryCountRef.current = 0;

                // ⚡ WINDOW CACHE: Store in window for instant navigation (survives component unmount)
                if (typeof window !== 'undefined' && data && data.length > 0) {
                    window.__OUTBOUND_LIST_CACHE__ = {
                        data: data,
                        total: res.data?.total || 0,
                        timestamp: Date.now(),
                        warehouseId: activeWarehouse?.id
                    };
                    try {
                        sessionStorage.setItem('outbound_list_cache', JSON.stringify(data));
                        sessionStorage.setItem('outbound_list_cache_warehouseId', String(activeWarehouse?.id || ''));
                    } catch { /* ignore quota errors */ }
                }

                // ⚡ PAGE CACHE: Store in cache
                pageCacheRef.current.set(cacheKey, {
                    data,
                    total: res.data?.total || 0,
                    timestamp: Date.now(),
                });
                setLastRefreshTime(new Date());

                // ⚡ PREFETCH: Prefetch next page after successful load
                setTimeout(() => prefetchNextPage(), 500);

                // Mark initial load as complete
                setInitialLoadDone(true);

                if (buttonRefresh) {
                    setRefreshSuccess(true);
                    toast.success('List refreshed');
                    setTimeout(() => setRefreshSuccess(false), 1800);
                }
            }
        } catch (err: any) {
            // Handle aborts: clear overlay/timer and return without clearing data
            if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') {
                // Abort: clear timers, hide overlays, and clear fetching flag for the latest request
                if (overlayTimerRef.current) {
                    clearTimeout(overlayTimerRef.current);
                    overlayTimerRef.current = null;
                }
                if (overlayShownRef.current) {
                    try { listGridRef.current?.api?.hideOverlay(); } catch { }
                    overlayShownRef.current = false;
                    overlayStartRef.current = null;
                    try { setTopLoading(false); } catch { }
                }
                // Ensure any loading/refresh indicators are cleared on abort
                try { setRefreshing(false); } catch { }
                try { setListLoading(false); } catch { }

                setIsFetching(false);
                outboundAbortControllerRef.current = null;
                return;
            }

            console.error('Load outbound list error:', err);

            // ⚡ AUTO-RETRY: Retry on failure with exponential backoff
            if (retryCountRef.current < MAX_RETRIES && !buttonRefresh) {
                retryCountRef.current++;
                toast.error(`Loading failed, retrying... (${retryCountRef.current}/${MAX_RETRIES})`);
                setTimeout(() => {
                    loadOutboundList({ buttonRefresh: true });
                }, 1000 * retryCountRef.current);
                return;
            }

            // Rate-limit error toasts to prevent spamming
            const now = Date.now();
            if (now - lastErrorToastRef.current > ERROR_TOAST_COOLDOWN) {
                lastErrorToastRef.current = now;
                if (buttonRefresh) {
                    toast.error(err.response?.data?.error || 'Failed to refresh outbound list');
                } else {
                    toast.error(err.response?.data?.error || 'Failed to load outbound list');
                }
            }
            retryCountRef.current = 0;

            // Do not clear existing list data on error to avoid blinking; keep previous rows visible
        } finally {
            // Only clear overlays when this is the latest request
            if (loadId === currentLoadIdRef.current) {
                if (overlayShownRef.current && overlayStartRef.current) {
                    const elapsed = Date.now() - overlayStartRef.current;
                    if (elapsed < MIN_LOADING_MS) {
                        await new Promise(res => setTimeout(res, MIN_LOADING_MS - elapsed));
                    }
                    try { listGridRef.current?.api?.hideOverlay(); } catch { }
                    overlayShownRef.current = false;
                    overlayStartRef.current = null;
                    try { setTopLoading(false); } catch { }
                } else {
                    // overlay never shown, clear pending timer
                    if (overlayTimerRef.current) {
                        clearTimeout(overlayTimerRef.current);
                        overlayTimerRef.current = null;
                    }
                }

                // Mark initial load as done (even if it failed, we've attempted a load)
                setInitialLoadDone(true);
                outboundAbortControllerRef.current = null;
            }
            // Always clear loading states to prevent infinite spinner
            try { setRefreshing(false); } catch { }
            try { setListLoading(false); } catch { }
            setIsFetching(false);
        }
    };

    const handleListReset = () => {
        setListLoading(true);
        setSearchFilter('');
        setSourceFilter('');
        setCustomerFilter('');
        setStartDateFilter('');
        setEndDateFilter('');
        setBatchFilter('');
        setBrandFilter('');
        setCategoryFilter('');
        setFilteredBrands(brands);
        setFilteredCategories(categories);
        setPage(1);
        // Close filters on mobile to save space
        if (isMobile) setFiltersExpanded(false);
    };

    const handleExportExcel = async () => {
        if (!activeWarehouse) return;

        try {
            const res = await outboundAPI.exportToExcel({
                warehouseId: activeWarehouse.id,
                source: exportSource || sourceFilter,
                customer: exportCustomer || customerFilter,
                startDate: exportStartDate || startDateFilter,
                endDate: exportEndDate || endDateFilter,
                batchId: exportBatchId || batchFilter,
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `outbound_export_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success('✓ Excel exported');
            setExportDialogOpen(false);
            setExportStartDate('');
            setExportEndDate('');
            setExportCustomer('');
            setExportBatchId('');
            setExportSource('');
        } catch (err: any) {
            console.error('Export error:', err);
            console.error('Error response:', err.response?.data);
            toast.error(err.response?.data?.error || 'Failed to export Excel');
        }
    };

    // ====== BATCH MANAGEMENT ======
    const loadBatches = async () => {
        if (!activeWarehouse) return;

        setBatchLoading(true);
        try {
            const res = await outboundAPI.getBatches(activeWarehouse.id);
            const bs = res.data || [];
            setBatches(bs);

            // If a previously selected export batch is no longer available, clear it
            if (exportBatchId && !bs.find((b: any) => b.batch_id === exportBatchId)) {
                setExportBatchId('');
            }

            // If the active list filter batch is no longer available, clear it and reset page
            if (batchFilter && !bs.find((b: any) => b.batch_id === batchFilter)) {
                setBatchFilter('');
                setPage(1);
            }
        } catch (err: any) {
            toast.error('Failed to load batches');
        } finally {
            setBatchLoading(false);
        }
    };

    // Load batches when export dialog is opened so export dropdown has values
    useEffect(() => {
        if (exportDialogOpen && activeWarehouse) {
            loadBatches();
        }
    }, [exportDialogOpen, activeWarehouse]);

    // Grid settings persisted
    useEffect(() => {
        try {
            const s = localStorage.getItem('outbound_enableSorting');
            const f = localStorage.getItem('outbound_enableColumnFilters');
            const r = localStorage.getItem('outbound_enableColumnResize');
            const e = localStorage.getItem('outbound_enableCellEditing');
            if (s !== null) setEnableSorting(s === 'true');
            if (f !== null) setEnableColumnFilters(f === 'true');
            if (r !== null) setEnableColumnResize(r === 'true');
            if (e !== null) setEnableCellEditing(e === 'true');
        } catch { /* ignore */ }
    }, []);



    useEffect(() => {
        try {
            localStorage.setItem('outbound_enableSorting', String(enableSorting));
            localStorage.setItem('outbound_enableColumnFilters', String(enableColumnFilters));
            localStorage.setItem('outbound_enableColumnResize', String(enableColumnResize));
            localStorage.setItem('outbound_enableCellEditing', String(enableCellEditing));
        } catch { }
    }, [enableSorting, enableColumnFilters, enableColumnResize, enableCellEditing]);

    // Ensure AG Grid shows the correct overlay while fetching or when empty
    useEffect(() => {
        const api = listGridRef.current?.api;
        if (!api) return;

        // While fetching, ensure AG Grid overlays are hidden — we use custom spinners instead
        if (isFetching) {
            try { api.hideOverlay(); } catch { }
            return;
        }

        if (!isFetching && !listLoading && listData.length === 0) {
            try { api.showNoRowsOverlay(); } catch { }
        } else {
            try { api.hideOverlay(); } catch { }
        }
    }, [listData, listLoading, isFetching]);

    // Apply AG Grid quick filter when search input changes for instant UI filtering (mirrors Dashboard behaviour)
    useEffect(() => {
        const api = listGridRef.current?.api;
        if (!api || typeof api.setQuickFilter !== 'function') return;

        // If a server request is in-flight keep previous rows visible (avoid local filtering that can blank the grid)
        if (isFetching) {
            // Keep AG Grid overlays hidden while we show our custom spinner
            try { api.hideOverlay(); } catch { }
            return;
        }

        api.setQuickFilter(searchFilter || '');
    }, [searchFilter, listData]);

    const handleDeleteBatch = async (batchId: string) => {
        if (!confirm(`Delete batch ${batchId}?`)) return;

        try {
            await outboundAPI.deleteBatch(batchId);
            toast.success('✓ Batch deleted');
            loadBatches();
            loadExistingWSNs();
        } catch (err: any) {
            toast.error('Failed to delete batch');
        }
    };

    const handleViewBatch = (batchId: string) => {
        setBatchFilter(batchId);
        setTabValue(0);
    };

    // ====== CATEGORY PIVOT DATA COMPUTATION ======
    // Calculate category/brand-wise quantity summary from scanned rows in Multi Entry
    // Get available filter options for combined view
    // Dynamic filter options based on selected filters
    const pivotFilterOptions = useMemo(() => {
        const filledRows = multiRows.filter((row: any) => row.wsn?.trim());

        // Filter rows based on current selections for dynamic options
        let filteredForCategories = filledRows;
        let filteredForBrands = filledRows;
        let filteredForPTypes = filledRows;

        // For categories dropdown: filter by selected brands and pTypes
        if (pivotBrandFilter.length > 0) {
            filteredForCategories = filteredForCategories.filter((row: any) =>
                pivotBrandFilter.includes(row.brand?.trim()));
        }
        if (pivotPTypeFilter.length > 0) {
            filteredForCategories = filteredForCategories.filter((row: any) =>
                pivotPTypeFilter.includes(row.p_type?.trim()));
        }

        // For brands dropdown: filter by selected categories and pTypes
        if (pivotCategoryFilter.length > 0) {
            filteredForBrands = filteredForBrands.filter((row: any) =>
                pivotCategoryFilter.includes(row.cms_vertical?.trim()));
        }
        if (pivotPTypeFilter.length > 0) {
            filteredForBrands = filteredForBrands.filter((row: any) =>
                pivotPTypeFilter.includes(row.p_type?.trim()));
        }

        // For pTypes dropdown: filter by selected categories and brands
        if (pivotCategoryFilter.length > 0) {
            filteredForPTypes = filteredForPTypes.filter((row: any) =>
                pivotCategoryFilter.includes(row.cms_vertical?.trim()));
        }
        if (pivotBrandFilter.length > 0) {
            filteredForPTypes = filteredForPTypes.filter((row: any) =>
                pivotBrandFilter.includes(row.brand?.trim()));
        }

        const categories = new Set<string>();
        const brands = new Set<string>();
        const pTypes = new Set<string>();

        filteredForCategories.forEach((row: any) => {
            if (row.cms_vertical?.trim()) categories.add(row.cms_vertical.trim());
        });
        filteredForBrands.forEach((row: any) => {
            if (row.brand?.trim()) brands.add(row.brand.trim());
        });
        filteredForPTypes.forEach((row: any) => {
            if (row.p_type?.trim()) pTypes.add(row.p_type.trim());
        });

        return {
            categories: Array.from(categories).sort(),
            brands: Array.from(brands).sort(),
            pTypes: Array.from(pTypes).sort(),
        };
    }, [multiRows, pivotCategoryFilter, pivotBrandFilter, pivotPTypeFilter]);

    const categoryPivotData = useMemo(() => {
        // Only consider rows with WSN filled
        let filledRows = multiRows.filter((row: any) => row.wsn?.trim());

        if (filledRows.length === 0) {
            return { categories: [], grandTotal: { qty: 0, fsp: 0, mrp: 0 }, filteredTotal: { qty: 0, fsp: 0, mrp: 0 } };
        }

        // Apply filters for combined view (multiple selection)
        if (pivotGroupBy === 'combined') {
            if (pivotCategoryFilter.length > 0) {
                filledRows = filledRows.filter((row: any) => pivotCategoryFilter.includes(row.cms_vertical?.trim()));
            }
            if (pivotBrandFilter.length > 0) {
                filledRows = filledRows.filter((row: any) => pivotBrandFilter.includes(row.brand?.trim()));
            }
            if (pivotPTypeFilter.length > 0) {
                filledRows = filledRows.filter((row: any) => pivotPTypeFilter.includes(row.p_type?.trim()));
            }
        }

        if (filledRows.length === 0) {
            return { categories: [], grandTotal: { qty: 0, fsp: 0, mrp: 0 }, filteredTotal: { qty: 0, fsp: 0, mrp: 0 } };
        }

        // Group by category (cms_vertical), brand, p_type, or combined based on pivotGroupBy
        const categoryMap = new Map<string, { qty: number; fsp: number; mrp: number; items: any[]; categoryName?: string; brandName?: string; pTypeName?: string }>();

        filledRows.forEach((row: any) => {
            let groupKey: string;
            let categoryName = '';
            let brandName = '';
            let pTypeName = '';

            if (pivotGroupBy === 'combined') {
                // Combined: group by category + brand + p_type
                categoryName = row.cms_vertical?.trim() || 'Uncategorized';
                brandName = row.brand?.trim() || 'Unknown Brand';
                pTypeName = row.p_type?.trim() || 'Unknown Type';
                groupKey = `${categoryName}|||${brandName}|||${pTypeName}`;
            } else {
                const groupField = pivotGroupBy === 'brand' ? 'brand' : pivotGroupBy === 'p_type' ? 'p_type' : 'cms_vertical';
                const defaultLabel = pivotGroupBy === 'brand' ? 'Unknown Brand' : pivotGroupBy === 'p_type' ? 'Unknown Type' : 'Uncategorized';
                groupKey = row[groupField]?.trim() || defaultLabel;
            }

            const fsp = parseFloat(row.fsp) || 0;
            const mrp = parseFloat(row.mrp) || 0;

            if (!categoryMap.has(groupKey)) {
                categoryMap.set(groupKey, { qty: 0, fsp: 0, mrp: 0, items: [], categoryName, brandName, pTypeName });
            }

            const data = categoryMap.get(groupKey)!;
            data.qty += 1;
            data.fsp += fsp;
            data.mrp += mrp;
            data.items.push(row);
        });

        // Calculate grand total
        const grandTotal = { qty: 0, fsp: 0, mrp: 0 };
        categoryMap.forEach((data) => {
            grandTotal.qty += data.qty;
            grandTotal.fsp += data.fsp;
            grandTotal.mrp += data.mrp;
        });

        // Convert to array with percentage
        const categories = Array.from(categoryMap.entries()).map(([category, data]) => ({
            category,
            qty: data.qty,
            fsp: data.fsp,
            mrp: data.mrp,
            percentage: grandTotal.qty > 0 ? (data.qty / grandTotal.qty) * 100 : 0,
            // For combined view
            categoryName: data.categoryName || '',
            brandName: data.brandName || '',
            pTypeName: data.pTypeName || '',
        }));

        // Sort based on current sort settings
        categories.sort((a, b) => {
            let aVal: any, bVal: any;
            switch (categoryPivotSortBy) {
                case 'category':
                    aVal = a.category.toLowerCase();
                    bVal = b.category.toLowerCase();
                    break;
                case 'qty':
                    aVal = a.qty;
                    bVal = b.qty;
                    break;
                case 'fsp':
                    aVal = a.fsp;
                    bVal = b.fsp;
                    break;
                case 'mrp':
                    aVal = a.mrp;
                    bVal = b.mrp;
                    break;
                default:
                    aVal = a.qty;
                    bVal = b.qty;
            }

            if (categoryPivotSortDir === 'asc') {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });

        return { categories, grandTotal };
    }, [multiRows, pivotGroupBy, categoryPivotSortBy, categoryPivotSortDir, pivotCategoryFilter, pivotBrandFilter, pivotPTypeFilter]);

    // Cross-Tab filter options (the third field not used in row/col)
    const crossTabFilterField = useMemo(() => {
        const fields: ('category' | 'brand' | 'p_type')[] = ['category', 'brand', 'p_type'];
        return fields.find(f => f !== crossTabRowField && f !== crossTabColField) || 'category';
    }, [crossTabRowField, crossTabColField]);

    const crossTabFilterOptions = useMemo(() => {
        const filledRows = multiRows.filter((row: any) => row.wsn?.trim());
        const options = new Set<string>();
        const fieldMap: Record<string, string> = {
            'category': 'cms_vertical',
            'brand': 'brand',
            'p_type': 'p_type',
        };
        const dbField = fieldMap[crossTabFilterField];
        filledRows.forEach((row: any) => {
            if (row[dbField]?.trim()) options.add(row[dbField].trim());
        });
        return Array.from(options).sort();
    }, [multiRows, crossTabFilterField]);

    // Cross-Tab Pivot Data computation
    const crossTabPivotData = useMemo(() => {
        let filledRows = multiRows.filter((row: any) => row.wsn?.trim());

        if (filledRows.length === 0) {
            return { rowHeaders: [], colHeaders: [], data: {}, rowTotals: {}, colTotals: {}, grandTotal: 0 };
        }

        // Apply filter if selected
        const fieldMap: Record<string, string> = {
            'category': 'cms_vertical',
            'brand': 'brand',
            'p_type': 'p_type',
        };

        if (crossTabFilter.length > 0) {
            const filterDbField = fieldMap[crossTabFilterField];
            filledRows = filledRows.filter((row: any) => crossTabFilter.includes(row[filterDbField]?.trim()));
        }

        const rowDbField = fieldMap[crossTabRowField];
        const colDbField = fieldMap[crossTabColField];

        // Collect unique row and column values
        const rowSet = new Set<string>();
        const colSet = new Set<string>();

        filledRows.forEach((row: any) => {
            const rowVal = row[rowDbField]?.trim() || 'Unknown';
            const colVal = row[colDbField]?.trim() || 'Unknown';
            rowSet.add(rowVal);
            colSet.add(colVal);
        });

        const rowHeaders = Array.from(rowSet).sort();
        const colHeaders = Array.from(colSet).sort();

        // Build the 2D data matrix
        const data: Record<string, Record<string, number>> = {};
        const rowTotals: Record<string, number> = {};
        const colTotals: Record<string, number> = {};
        let grandTotal = 0;

        // Initialize
        rowHeaders.forEach(rh => {
            data[rh] = {};
            rowTotals[rh] = 0;
            colHeaders.forEach(ch => {
                data[rh][ch] = 0;
            });
        });
        colHeaders.forEach(ch => {
            colTotals[ch] = 0;
        });

        // Fill data
        filledRows.forEach((row: any) => {
            const rowVal = row[rowDbField]?.trim() || 'Unknown';
            const colVal = row[colDbField]?.trim() || 'Unknown';
            data[rowVal][colVal] += 1;
            rowTotals[rowVal] += 1;
            colTotals[colVal] += 1;
            grandTotal += 1;
        });

        return { rowHeaders, colHeaders, data, rowTotals, colTotals, grandTotal };
    }, [multiRows, crossTabRowField, crossTabColField, crossTabFilter, crossTabFilterField]);

    // Clear pivot filters when switching away from combined view
    const handlePivotGroupChange = (newGroup: 'category' | 'brand' | 'p_type' | 'combined' | 'crosstab') => {
        setPivotGroupBy(newGroup);
        if (newGroup !== 'combined') {
            setPivotCategoryFilter([]);
            setPivotBrandFilter([]);
            setPivotPTypeFilter([]);
        }
        if (newGroup !== 'crosstab') {
            setCrossTabFilter([]);
        }
    };

    // Handle sort column click for category pivot
    const handleCategoryPivotSort = (column: 'category' | 'qty' | 'fsp' | 'mrp') => {
        if (categoryPivotSortBy === column) {
            setCategoryPivotSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setCategoryPivotSortBy(column);
            setCategoryPivotSortDir('desc');
        }
    };

    // Export category pivot to Excel
    const exportCategoryPivotToExcel = async () => {
        try {
            const XLSX = await import('xlsx');

            // Handle Cross-Tab export separately
            if (pivotGroupBy === 'crosstab') {
                const { rowHeaders, colHeaders, data, rowTotals, colTotals, grandTotal } = crossTabPivotData;
                const rowLabel = crossTabRowField === 'category' ? 'Category' : crossTabRowField === 'brand' ? 'Brand' : 'P_Type';
                const colLabel = crossTabColField === 'category' ? 'Category' : crossTabColField === 'brand' ? 'Brand' : 'P_Type';

                // Build export data with cross-tab format
                const exportData: any[] = [];

                // Header row
                const headerRow: any = { [rowLabel]: '' };
                colHeaders.forEach(ch => { headerRow[ch] = ch; });
                headerRow['Grand Total'] = 'Grand Total';

                // Data rows
                rowHeaders.forEach(rh => {
                    const row: any = { [rowLabel]: rh };
                    colHeaders.forEach(ch => {
                        row[ch] = data[rh][ch] || 0;
                    });
                    row['Grand Total'] = rowTotals[rh];
                    exportData.push(row);
                });

                // Grand Total row
                const totalRow: any = { [rowLabel]: 'Grand Total' };
                colHeaders.forEach(ch => {
                    totalRow[ch] = colTotals[ch];
                });
                totalRow['Grand Total'] = grandTotal;
                exportData.push(totalRow);

                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, `${rowLabel} x ${colLabel}`);

                const timestamp = new Date().toISOString().slice(0, 10);
                XLSX.writeFile(wb, `CrossTab_${rowLabel}_${colLabel}_${timestamp}.xlsx`);

                toast.success(`Cross-Tab (${rowLabel} × ${colLabel}) exported!`);
                return;
            }

            const groupLabel = pivotGroupBy === 'brand' ? 'Brand' : pivotGroupBy === 'p_type' ? 'P_Type' : pivotGroupBy === 'combined' ? 'Combined' : 'Category';

            let exportData;
            if (pivotGroupBy === 'combined') {
                exportData = categoryPivotData.categories.map((cat, idx) => ({
                    'Sr No': idx + 1,
                    'Category': cat.categoryName,
                    'Brand': cat.brandName,
                    'P_Type': cat.pTypeName,
                    'Quantity': cat.qty,
                    'Total FSP (₹)': cat.fsp,
                    'Total MRP (₹)': cat.mrp,
                    'Percentage (%)': cat.percentage.toFixed(1),
                }));
                // Add grand total row
                exportData.push({
                    'Sr No': '',
                    'Category': 'GRAND TOTAL',
                    'Brand': '',
                    'P_Type': '',
                    'Quantity': categoryPivotData.grandTotal.qty,
                    'Total FSP (₹)': categoryPivotData.grandTotal.fsp,
                    'Total MRP (₹)': categoryPivotData.grandTotal.mrp,
                    'Percentage (%)': '100.0',
                } as any);
            } else {
                exportData = categoryPivotData.categories.map((cat, idx) => ({
                    'Sr No': idx + 1,
                    [groupLabel]: cat.category,
                    'Quantity': cat.qty,
                    'Total FSP (₹)': cat.fsp,
                    'Total MRP (₹)': cat.mrp,
                    'Percentage (%)': cat.percentage.toFixed(1),
                }));
                // Add grand total row
                exportData.push({
                    'Sr No': '',
                    [groupLabel]: 'GRAND TOTAL',
                    'Quantity': categoryPivotData.grandTotal.qty,
                    'Total FSP (₹)': categoryPivotData.grandTotal.fsp,
                    'Total MRP (₹)': categoryPivotData.grandTotal.mrp,
                    'Percentage (%)': '100.0',
                } as any);
            }

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `${groupLabel} Summary`);

            const timestamp = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `${groupLabel}_Pivot_${timestamp}.xlsx`);

            toast.success(`${groupLabel} summary exported!`);
        } catch (err) {
            console.error('Export error:', err);
            toast.error('Export failed');
        }
    };

    // ✅ AG GRID COLUMN DEFINITIONS
    const columnDefs = useMemo(() => {
        // Serial column (Sr. No.) - pinned to left
        const srCol = {
            headerName: 'SR.NO',
            field: '__sr',
            valueGetter: (params: any) => params.node ? params.node.rowIndex + 1 : undefined,
            width: 20,
            suppressSizeToFit: true,
            cellStyle: {
                fontWeight: 700,
                textAlign: 'center',
                color: isDarkMode ? '#94a3b8' : '#64748b'
            },
            suppressMovable: true,
            sortable: false,
            filter: false,
        };

        const cols = visibleColumns.map((col) => {
            const isEditable = EDITABLE_COLUMNS.includes(col);
            const defaultWidth = col === 'wsn' ? 140 : col === 'dispatch_date' ? 140 : 130;

            // Use saved width if available, otherwise use default
            const savedWidth = multiColumnWidths[col];

            return {
                field: col,
                headerName: col.replace(/_/g, ' ').toUpperCase(),
                editable: isEditable,
                width: savedWidth || defaultWidth, // Use saved width or fall back to default
                suppressSizeToFit: true,
                cellStyle: (params: any) => {
                    const wsn = params.data?.wsn?.trim()?.toUpperCase();
                    const styles: any = {};

                    // WSN validation colors
                    if (wsn && col === 'wsn') {
                        if (crossWarehouseWSNs.has(wsn)) {
                            styles.backgroundColor = isDarkMode ? '#7f1d1d' : '#fee2e2';
                            styles.color = isDarkMode ? '#fca5a5' : '#dc2626';
                        } else if (gridDuplicateWSNs.has(wsn)) {
                            styles.backgroundColor = isDarkMode ? '#78350f' : '#fef3c7';
                            styles.color = isDarkMode ? '#fcd34d' : '#92400e';
                        }
                    }

                    return styles;
                },
            };
        });

        return [srCol, ...cols];
    }, [visibleColumns, isDarkMode, crossWarehouseWSNs, gridDuplicateWSNs, multiColumnWidths]);

    const defaultColDef = useMemo(
        () => ({
            sortable: false,
            filter: false,
            resizable: true,
            editable: (params: any) => {
                const field = params.colDef.field as string;
                const wsn = params.data?.wsn?.trim()?.toUpperCase();

                if (!wsn) return EDITABLE_COLUMNS.includes(field);

                // 🔴 Cross warehouse → nothing editable
                if (crossWarehouseWSNs.has(wsn)) return false;

                // 🟡 Duplicate → only WSN editable
                if (gridDuplicateWSNs.has(wsn)) {
                    return field === 'wsn';
                }

                return EDITABLE_COLUMNS.includes(field);
            },
            // ⚡ EXCEL-LIKE: Optimized cell style for selection
            cellStyle: (params: any) => {
                const bounds = selectionBoundsRef.current;
                if (!bounds) return undefined;

                const rowIndex = params.rowIndex;
                const colId = params.colDef?.field;
                if (rowIndex === null || rowIndex === undefined || !colId) return undefined;

                const currentColIndex = bounds.colIndexMap.get(colId);
                if (currentColIndex === undefined) return undefined;

                const isInRowRange = rowIndex >= bounds.minRow && rowIndex <= bounds.maxRow;
                const isInColRange = currentColIndex >= bounds.minCol && currentColIndex <= bounds.maxCol;

                if (isInRowRange && isInColRange) {
                    // Use consistent blue color matching CSS rules
                    const borderColor = isDarkMode ? '#60a5fa' : '#2563eb';
                    const bgColor = isDarkMode ? 'rgba(96, 165, 250, 0.35)' : 'rgba(37, 99, 235, 0.2)';

                    const style: any = {
                        backgroundColor: bgColor,
                        boxShadow: isDarkMode
                            ? 'inset 0 0 0 1px rgba(96, 165, 250, 0.6)'
                            : 'inset 0 0 0 1px rgba(37, 99, 235, 0.4)',
                    };
                    if (rowIndex === bounds.minRow) style.borderTop = `3px solid ${borderColor}`;
                    if (rowIndex === bounds.maxRow) style.borderBottom = `3px solid ${borderColor}`;
                    if (currentColIndex === bounds.minCol) style.borderLeft = `3px solid ${borderColor}`;
                    if (currentColIndex === bounds.maxCol) style.borderRight = `3px solid ${borderColor}`;
                    return style;
                }
                return undefined;
            },
            cellClass: (params: any) => {
                const bounds = selectionBoundsRef.current;
                if (!bounds) return '';

                const rowIndex = params.rowIndex;
                const colId = params.colDef?.field;
                if (rowIndex === null || rowIndex === undefined || !colId) return '';

                const currentColIndex = bounds.colIndexMap.get(colId);
                if (currentColIndex === undefined) return '';

                const isInRowRange = rowIndex >= bounds.minRow && rowIndex <= bounds.maxRow;
                const isInColRange = currentColIndex >= bounds.minCol && currentColIndex <= bounds.maxCol;

                if (isInRowRange && isInColRange) {
                    const classes = ['custom-range-selected'];
                    if (rowIndex === bounds.minRow) classes.push('custom-range-top');
                    if (rowIndex === bounds.maxRow) classes.push('custom-range-bottom');
                    if (currentColIndex === bounds.minCol) classes.push('custom-range-left');
                    if (currentColIndex === bounds.maxCol) classes.push('custom-range-right');
                    return classes.join(' ');
                }
                return '';
            },
        }),
        [gridDuplicateWSNs, crossWarehouseWSNs, isDarkMode]
    );

    // Column minWidth config based on content type for Outbound List
    const OUTBOUND_COLUMN_MIN_WIDTHS: Record<string, number> = {
        wsn: 80,
        customer_name: 140,
        dispatch_date: 100,
        vehicle_no: 100,
        source: 90,
        product_title: 400,
        brand: 100,
        cms_vertical: 120,
        wid: 100,
        fsn: 120,
        order_id: 80,
        fkqc_remark: 70,
        fk_grade: 90,
        hsn_sac: 90,
        igst_rate: 60,
        fsp: 70,
        mrp: 70,
        vrp: 70,
        yield_value: 80,
        invoice_date: 100,
        fkt_link: 150,
        wh_location: 100,
        p_type: 80,
        p_size: 80,
        batch_id: 100,
        dispatch_remarks: 150,
        other_remarks: 150,
        quantity: 70,
        created_user_name: 120,
    };

    // ✅ LIST GRID COLUMN DEFINITIONS (AG GRID)
    // Include ALL columns with hide property - columnDefs structure never changes
    const listColumnDefs = useMemo(() => {
        const sr = {
            headerName: 'SR.NO',
            field: '__sr',
            // Use context for page/limit to ensure values are always current
            valueGetter: (params: any) => {
                if (!params.node) return undefined;
                const ctx = params.context || {};
                const currentPage = ctx.page || 1;
                const currentLimit = ctx.limit || 100;
                return params.node.rowIndex + 1 + (currentPage - 1) * currentLimit;
            },
            width: 20,
            cellStyle: { fontWeight: 700, textAlign: 'center', color: isDarkMode ? '#94a3b8' : '#64748b' },
            suppressMovable: true,
            sortable: false,
            filter: false,
            suppressSizeToFit: true,
        };

        // Include ALL columns - visibility controlled by ag-Grid state
        const cols = ALL_LIST_COLUMNS.map((col: string) => {
            const minWidth = OUTBOUND_COLUMN_MIN_WIDTHS[col] || 100;

            // Dates
            if (col.includes('date')) {
                return {
                    field: col,
                    headerName: col.replace(/_/g, ' ').toUpperCase(),
                    filter: enableColumnFilters ? 'agDateColumnFilter' : undefined,
                    valueFormatter: (p: any) => formatDate(p.value),
                    tooltipField: col,
                    minWidth,
                    hide: false, // ag-Grid state controls visibility
                };
            }

            // Source chip
            if (col === 'source') {
                return {
                    field: col,
                    headerName: 'SOURCE',
                    cellRenderer: (p: any) => {
                        if (!p.value) return '-';
                        return (
                            <Chip label={p.value} size="small" color={p.value === 'PICKING' ? 'primary' : p.value === 'QC' ? 'success' : 'warning'} sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }} />
                        );
                    },
                    minWidth,
                    hide: false,
                };
            }

            // Default
            return {
                field: col,
                headerName: col.replace(/_/g, ' ').toUpperCase(),
                filter: enableColumnFilters ? 'agTextColumnFilter' : undefined,
                tooltipField: col,
                minWidth,
                hide: false,
            };
        });

        return [sr, ...cols];
    }, [enableColumnFilters, enableSorting, enableColumnResize, isDarkMode]);

    // NOTE: No longer need to re-apply column state on columnDefs change
    // because columnDefs structure is now STABLE (includes ALL columns with hide property)
    // Column visibility is controlled via setColumnsVisible() API which preserves order

    const listDefaultColDef = useMemo(() => ({
        sortable: !!enableSorting,
        resizable: !!enableColumnResize,
        filter: !!enableColumnFilters,
        editable: false,
        suppressHeaderMenuButton: false,
        cellStyle: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    }), [enableSorting, enableColumnFilters, enableColumnResize]);

    if (!user) {
        return (
            <AppLayout>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: isDarkMode ? '#0f172a' : '#f8fafc' }}>
                    <CircularProgress />
                </Box>
            </AppLayout>
        );
    }


    if (!activeWarehouse) {
        return (
            <AppLayout>
                <Box sx={{ p: 3, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ p: 5, background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', borderRadius: 4, color: 'white', boxShadow: '0 20px 60px rgba(30, 64, 175, 0.4)' }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>⚠️ No active warehouse selected.</Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>Please go to Settings → Warehouses to set one.</Typography>
                    </Box>
                </Box>
            </AppLayout>
        );
    }


    ///////////////////////////////////////// UI RENDERING /////////////////////////////////////////
    return (
        <AppLayout>
            <Toaster position="top-right" containerStyle={{ zIndex: 99999 }} toastOptions={{ duration: 3000, style: { background: '#363636', color: '#fff', borderRadius: '10px', padding: '16px', fontWeight: 600 }, success: { iconTheme: { primary: '#10b981', secondary: '#fff' } }, error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } } }} />

            <Box sx={{
                p: { xs: 0.75, md: 1 },
                background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                height: '100%', width: '100%',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* HEADER */}
                <StandardPageHeader
                    title="Outbound Management"
                    subtitle="Dispatch and track outgoing shipments"
                    icon="🚚"
                    warehouseName={activeWarehouse?.name}
                    userName={user?.full_name}
                />

                {/* TABS */}
                <StandardTabs
                    value={tabValue}
                    onChange={(e, v) => setTabValue(v)}
                    tabs={visibleTabs}
                    color="#1e40af"
                />


                {/* TAB: OUTBOUND LIST */}
                {currentTabCode === 'list' && (
                    <Box sx={{
                        display: 'flex', flexDirection: 'column',
                        flex: 1, minHeight: 0, overflow: 'hidden',
                        background: isDarkMode ? '#0f172a' : '#f8fafc', py: { xs: 0.25, sm: 0.50 },
                        transition: 'opacity 0.15s ease-in-out'
                    }}>
                        {/* SEARCH + OPTIONS BUTTON */}
                        <Box sx={{
                            mb: 1,

                            // Paste inside the existing sx object
                            '& .MuiOutlinedInput-root': {
                                bgcolor: 'transparent !important',
                                boxShadow: 'none !important',
                                '&:hover': { bgcolor: 'transparent !important' },
                                '&.Mui-focused': { bgcolor: 'transparent !important', boxShadow: 'none !important' },
                            },
                            '& .MuiOutlinedInput-input': {
                                background: 'transparent !important',
                            },
                            '& input[type="date"], & .MuiOutlinedInput-input[type="date"], & .MuiInputBase-input[type="date"]': {
                                background: 'transparent !important',
                                color: 'inherit !important',
                                WebkitAppearance: 'none !important',
                                MozAppearance: 'textfield !important',
                                appearance: 'none !important',
                                borderRadius: '6px !important',
                                padding: '0 6px !important',
                            },
                            '& input[type="date"]::-webkit-datetime-edit, & input[type="date"]::-webkit-datetime-edit-text, & input[type="date"]::-webkit-datetime-edit-month-field, & input[type="date"]::-webkit-datetime-edit-day-field, & input[type="date"]::-webkit-datetime-edit-year-field': {
                                background: 'transparent !important',
                                color: 'inherit !important',
                            },
                            '& input[type="date"]::-webkit-calendar-picker-indicator': {
                                WebkitAppearance: 'none',
                                appearance: 'none',
                                background: 'transparent',
                                padding: 0,
                                margin: 0,
                            },
                            '& input:-webkit-autofill': {
                                WebkitBoxShadow: '0 0 0 1000px transparent inset',
                                boxShadow: '0 0 0 1000px transparent inset',
                                WebkitTextFillColor: 'inherit',
                            },
                        }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <TextField
                                    size="small"
                                    placeholder="🔍 Search by WSN, Product or Customer"
                                    value={searchFilter}
                                    onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }}
                                    sx={{
                                        flex: 1,
                                        minWidth: 0,
                                        '& .MuiOutlinedInput-root': {
                                            height: 38,
                                            bgcolor: isDarkMode ? '#1e293b' : 'white',
                                            borderRadius: 1.5,
                                            '& fieldset': {
                                                borderWidth: 2,
                                                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'
                                            },
                                            '&:hover fieldset': {
                                                borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#cbd5e1'
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#1e40af'
                                            },
                                            '& input': {
                                                py: 0.75,
                                                color: isDarkMode ? '#f1f5f9' : 'inherit'
                                            }
                                        }
                                    }}
                                />

                                {/* Options Button - Opens Options Panel Drawer (works on both mobile and desktop) */}
                                <Tooltip title="Open Options Panel">
                                    <Button
                                        variant="outlined"
                                        onClick={() => setListOptionsPanelOpen(true)}
                                        sx={{
                                            minWidth: { xs: 'auto', sm: 100 },
                                            height: 38,
                                            borderWidth: 2,
                                            borderColor: isDarkMode ? '#3b82f6' : '#1e40af',
                                            bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(30, 64, 175, 0.04)',
                                            color: isDarkMode ? '#60a5fa' : '#1e40af',
                                            fontWeight: 700,
                                            fontSize: { xs: '0.75rem', sm: '0.78rem' },
                                            borderRadius: 1.5,
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                            transition: 'all 0.2s',
                                            px: { xs: 1.5, sm: 2 },
                                            '&:hover': {
                                                borderWidth: 2,
                                                borderColor: '#3b82f6',
                                                bgcolor: 'rgba(59, 130, 246, 0.12)',
                                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
                                            },
                                            position: 'relative'
                                        }}
                                    >
                                        <MenuIcon sx={{ fontSize: '1.1rem', mr: { xs: 0, sm: 0.5 } }} />
                                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Options</Box>
                                        {/* Green dot indicator when filters are active */}
                                        {filtersActive && (
                                            <Box sx={{
                                                position: 'absolute',
                                                top: -4,
                                                right: -4,
                                                width: 12,
                                                height: 12,
                                                borderRadius: '50%',
                                                bgcolor: '#10b981',
                                                border: '2px solid white',
                                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.4)'
                                            }} />
                                        )}
                                    </Button>
                                </Tooltip>
                            </Stack>
                        </Box>

                        {/* TABLE - AG GRID (always render grid so header remains visible) */}
                        <Box sx={{
                            flex: 1,
                            minHeight: 0,
                            border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d1d5db',
                            borderBottom: 'none',
                            position: 'relative',
                            borderRadius: '12px 12px 0 0',
                            boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
                            overflow: 'hidden',
                        }}>

                            {/* Loading Spinner Overlay - semi-transparent so data stays visible */}
                            {(listLoading || isFetching) && listData && listData.length > 0 && gridDataRendered && (
                                <Box sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.5)',
                                    zIndex: 100,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Box sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        p: 3,
                                        bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                                        borderRadius: 2,
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                                    }}>
                                        <CircularProgress
                                            size={40}
                                            thickness={4}
                                            sx={{ color: '#1e40af' }}
                                        />
                                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                            Loading...
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                            {/* Empty State Overlay - Only show when NOT loading AND NOT fetching AND initial load is done */}
                            {!listLoading && !isFetching && initialLoadDone && (!listData || listData.length === 0) && (
                                <Box sx={{
                                    position: 'absolute',
                                    top: 32,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                                    zIndex: 5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Box sx={{
                                        textAlign: 'center',
                                        p: 4,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 2
                                    }}>
                                        <Box sx={{
                                            fontSize: '4rem',
                                            opacity: 0.3,
                                            mb: 1
                                        }}>
                                            📭
                                        </Box>
                                        <Typography variant="h5" sx={{ fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#6b7280', mb: 0.5 }}>
                                            No Data Found
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: isDarkMode ? '#64748b' : '#9ca3af', maxWidth: 400 }}>
                                            No outbound items match your current filters. Try adjusting your search criteria or reset filters to see all items.
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                            <Box sx={{ height: '100%', width: '100%', bgcolor: isDarkMode ? '#1e293b' : '#ffffff', position: 'relative' }}>
                                <div className="ag-theme-quartz" style={{ height: '100%', width: '100%', position: 'relative' }}>
                                    <Box sx={{
                                        height: '100%',
                                        width: '100%',
                                        bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
                                        border: isDarkMode ? '1px solid #475569' : '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        overflow: 'hidden',
                                        '& .ag-root-wrapper': {
                                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                            border: 'none',
                                        },
                                        '& .ag-header': {
                                            backgroundColor: '#1e3a5f !important',
                                            borderBottom: isDarkMode ? '2px solid #10b981' : '2px solid #059669',
                                            fontWeight: 700,
                                            opacity: '1 !important',
                                            zIndex: 15,
                                            position: 'relative'
                                        },
                                        '& .ag-header-cell': {
                                            padding: '0 12px',
                                            opacity: '1 !important',
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            backgroundColor: '#1e3a5f !important',
                                            color: '#ffffff !important',
                                            borderRight: '1px solid #3b5998',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.02em',
                                        },
                                        '& .ag-header-cell:last-child': {
                                            borderRight: 'none',
                                        },
                                        '& .ag-header-row': {
                                            backgroundColor: '#1e3a5f !important',
                                        },
                                        '& .ag-header-viewport': {
                                            backgroundColor: '#1e3a5f !important',
                                        },
                                        '& .ag-header-container': {
                                            backgroundColor: '#1e3a5f !important',
                                        },
                                        '& .ag-header-cell-label': {
                                            color: '#ffffff !important',
                                        },
                                        '& .ag-header-cell-text': {
                                            color: '#ffffff !important',
                                        },
                                        '& .ag-icon': {
                                            color: '#94a3b8 !important',
                                        },
                                        '& .ag-body-viewport': {
                                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                        },
                                        '& .ag-center-cols-viewport': {
                                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                        },
                                        '& .ag-center-cols-container': {
                                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                        },
                                        '& .ag-body': {
                                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                        },
                                        '& .ag-row': {
                                            borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e5e7eb',
                                        },
                                        '& .ag-row-even': {
                                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                        },
                                        '& .ag-row-odd': {
                                            backgroundColor: isDarkMode ? '#1a2536' : '#f8fafc',
                                        },
                                        '& .ag-cell': {
                                            borderRight: isDarkMode ? '1px solid #334155' : '1px solid #e5e7eb',
                                            color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                            display: 'flex',
                                            alignItems: 'center',
                                        },
                                        '& .ag-cell:last-child': {
                                            borderRight: 'none',
                                        },
                                        '& .ag-row-hover': {
                                            backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15) !important' : '#eff6ff !important',
                                        },
                                        '& .ag-cell-focus': {
                                            border: isDarkMode ? '2px solid #38bdf8 !important' : '2px solid #2563eb !important',
                                            outline: 'none',
                                        },
                                        '& .ag-cell-range-selected': {
                                            backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.25) !important' : '#dbeafe !important',
                                        },
                                    }}>
                                        <AgGridReact
                                            ref={listGridRef}
                                            rowData={listData}
                                            columnDefs={listColumnDefs}
                                            defaultColDef={listDefaultColDef}
                                            context={{ page, limit }}
                                            rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
                                            loading={false}
                                            suppressNoRowsOverlay={true}
                                            suppressScrollOnNewData={true}
                                            maintainColumnOrder={true}
                                            enableCellTextSelection={true}
                                            ensureDomOrder={true}
                                            animateRows={false}
                                            // ⚡ PERFORMANCE: Optimizations for smooth fast scrolling
                                            rowBuffer={100}
                                            suppressRowTransform={true}
                                            suppressAnimationFrame={true}
                                            alwaysShowVerticalScroll={true}
                                            valueCache={true}
                                            debounceVerticalScrollbar={true}
                                            onGridReady={(params: any) => {
                                                listGridRef.current = params.api;
                                                columnApiRef.current = params.api;
                                                try {
                                                    const saved = localStorage.getItem('outbound_list_grid_state');
                                                    if (saved && params.api) {
                                                        params.api.applyColumnState({ state: JSON.parse(saved), applyOrder: true });
                                                        hasAutoFittedRef.current = true;
                                                    } else {
                                                        // No saved state - hide columns not in listColumns
                                                        const allColIds = params.api.getColumns()?.map((c: any) => c.getColId()) || [];
                                                        allColIds.forEach((colId: string) => {
                                                            if (colId === '__sr') return;
                                                            const shouldShow = listColumns.includes(colId);
                                                            params.api.setColumnsVisible([colId], shouldShow);
                                                        });
                                                    }
                                                } catch { /* ignore */ }
                                            }}
                                            onFirstDataRendered={(params: any) => {
                                                // Auto-size columns on first load if no saved state
                                                if (!hasAutoFittedRef.current && params.api) {
                                                    try {
                                                        const allColIds = params.api.getColumns()
                                                            ?.filter((col: any) => col.getColId() !== '__action' && col.getColId() !== '__sr')
                                                            .map((col: any) => col.getColId()) || [];
                                                        if (allColIds.length > 0) {
                                                            // Auto-size columns based on content
                                                            params.api.autoSizeColumns(allColIds);

                                                            // If total width is less than grid width, stretch to fill
                                                            // ⚡ IMPORTANT: Show grid AFTER all sizing is complete to prevent flash
                                                            setTimeout(() => {
                                                                try {
                                                                    let total = 0;
                                                                    for (const id of allColIds) {
                                                                        const col = params.api.getColumn(id);
                                                                        total += col?.getActualWidth ? col.getActualWidth() : 0;
                                                                    }
                                                                    // Add SR column width
                                                                    const srCol = params.api.getColumn('__sr');
                                                                    total += srCol?.getActualWidth ? srCol.getActualWidth() : 80;

                                                                    const dims = params.api.getSize ? params.api.getSize() : null;
                                                                    const gridW = dims?.width || 0;
                                                                    if (gridW && total < gridW) {
                                                                        params.api.sizeColumnsToFit();
                                                                    }
                                                                } catch { /* ignore */ }
                                                                // ⚡ Show grid body AFTER sizeColumnsToFit completes
                                                                requestAnimationFrame(() => setGridDataRendered(true));
                                                            }, 50);
                                                        } else {
                                                            // No columns to resize - show immediately
                                                            requestAnimationFrame(() => setGridDataRendered(true));
                                                        }
                                                        hasAutoFittedRef.current = true;
                                                    } catch {
                                                        // On error, still show the grid
                                                        requestAnimationFrame(() => setGridDataRendered(true));
                                                    }
                                                } else {
                                                    // Saved state exists - show grid immediately
                                                    requestAnimationFrame(() => setGridDataRendered(true));
                                                }
                                            }}
                                            onColumnResized={(params: any) => {
                                                if (params.finished && params.api) {
                                                    try {
                                                        const state = params.api.getColumnState();
                                                        localStorage.setItem('outbound_list_grid_state', JSON.stringify(state));
                                                    } catch { /* ignore */ }
                                                }
                                            }}
                                            onColumnMoved={(params: any) => {
                                                if (params.finished && params.api) {
                                                    try {
                                                        const state = params.api.getColumnState();
                                                        localStorage.setItem('outbound_list_grid_state', JSON.stringify(state));
                                                    } catch { /* ignore */ }
                                                }
                                            }}
                                            onColumnVisible={(params: any) => {
                                                if (params.api) {
                                                    try {
                                                        const state = params.api.getColumnState();
                                                        localStorage.setItem('outbound_list_grid_state', JSON.stringify(state));
                                                    } catch { /* ignore */ }
                                                }
                                            }}
                                            pagination={false}
                                            rowHeight={tableRowHeight}
                                            headerHeight={32}
                                        />
                                    </Box>
                                </div>

                                {/* Initial Loading Overlay - positioned below header */}
                                {((listLoading && (!listData || listData.length === 0)) || (listData && listData.length > 0 && !gridDataRendered)) && (
                                    <Box sx={{
                                        position: 'absolute',
                                        top: 32,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
                                        zIndex: 50,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                            <CircularProgress size={40} thickness={4} sx={{ color: '#1e40af' }} />
                                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                                Loading outbound data...
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        </Box>

                        {/* ================= PAGINATION (DASHBOARD STYLE - FULLY RESPONSIVE) ================= */}
                        <Fade in={true} timeout={300}>
                            <Box
                                sx={{
                                    px: { xs: 1, sm: 2 },
                                    py: { xs: 0.75, sm: 0.5 },
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    borderTop: isDarkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid #d1d5db",
                                    borderLeft: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d1d5db',
                                    borderRight: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d1d5db',
                                    borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d1d5db',
                                    borderRadius: '0 0 12px 12px',
                                    bgcolor: isDarkMode ? '#1e293b' : "white",
                                    flexShrink: 0,
                                    minHeight: { xs: 44, sm: 52 },
                                    gap: { xs: 0.5, sm: 1 },
                                    flexWrap: 'wrap',
                                }}
                            >
                                {/* Left Section: Per Page + Last Refresh */}
                                <Stack direction="row" spacing={{ xs: 0.5, sm: 1.5 }} alignItems="center">
                                    <Typography sx={{ fontSize: { xs: "0.7rem", sm: "0.78rem" }, whiteSpace: "nowrap", color: isDarkMode ? '#94a3b8' : 'inherit' }}>
                                        Per page:
                                    </Typography>

                                    <Select
                                        size="small"
                                        value={limit}
                                        onChange={(e) => {
                                            setLimit(Number(e.target.value));
                                            setPage(1);
                                        }}
                                        sx={{
                                            minWidth: { xs: 58, sm: 70 },
                                            '& .MuiSelect-select': {
                                                py: { xs: 0.5, sm: 0.75 },
                                                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                            }
                                        }}
                                    >
                                        <MenuItem value={50}>50</MenuItem>
                                        <MenuItem value={100}>100</MenuItem>
                                        <MenuItem value={500}>500</MenuItem>
                                        <MenuItem value={1000}>1000</MenuItem>
                                    </Select>

                                    {/* Last Refresh Time Indicator */}
                                    {lastRefreshTime && !isMobile && (
                                        <Tooltip title={`Last updated: ${lastRefreshTime.toLocaleTimeString()}`}>
                                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 1 }}>
                                                <AccessTime sx={{ fontSize: 14, color: isDarkMode ? '#64748b' : '#94a3b8' }} />
                                                <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                                                    {(() => {
                                                        const seconds = Math.floor((new Date().getTime() - lastRefreshTime.getTime()) / 1000);
                                                        if (seconds < 10) return 'just now';
                                                        if (seconds < 60) return `${seconds}s ago`;
                                                        const minutes = Math.floor(seconds / 60);
                                                        if (minutes < 60) return `${minutes}m ago`;
                                                        return `${Math.floor(minutes / 60)}h ago`;
                                                    })()}
                                                </Typography>
                                            </Stack>
                                        </Tooltip>
                                    )}
                                </Stack>

                                {/* Center Section: Count */}
                                <Typography
                                    sx={{
                                        fontSize: { xs: "0.7rem", sm: "0.78rem" },
                                        whiteSpace: "nowrap",
                                        color: isDarkMode ? '#94a3b8' : 'inherit',
                                    }}
                                >
                                    {listData.length > 0 ? (page - 1) * limit + 1 : 0} – {Math.min(page * limit, total)} of {total}
                                </Typography>

                                {/* Right Section: Pagination Controls */}
                                {isMobile ? (
                                    // MOBILE COMPACT PAGINATION
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                        <IconButton
                                            size="small"
                                            disabled={page === 1}
                                            onClick={() => setPage(1)}
                                            sx={{ p: 0.5 }}
                                        >
                                            <FirstPage fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            disabled={page === 1}
                                            onClick={() => setPage(page - 1)}
                                            sx={{ p: 0.5 }}
                                        >
                                            <KeyboardArrowLeft fontSize="small" />
                                        </IconButton>

                                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, minWidth: 50, textAlign: 'center' }}>
                                            {page} / {Math.ceil(total / limit) || 1}
                                        </Typography>

                                        <IconButton
                                            size="small"
                                            disabled={page >= Math.ceil(total / limit)}
                                            onClick={() => setPage(page + 1)}
                                            sx={{ p: 0.5 }}
                                        >
                                            <KeyboardArrowRight fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            disabled={page >= Math.ceil(total / limit)}
                                            onClick={() => setPage(Math.ceil(total / limit))}
                                            sx={{ p: 0.5 }}
                                        >
                                            <LastPage fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                ) : (
                                    // DESKTOP: Enhanced pagination with MUI Pagination component
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Tooltip title="First page">
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    disabled={page === 1}
                                                    onClick={() => setPage(1)}
                                                >
                                                    <FirstPage fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>

                                        <Tooltip title="Previous page">
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    disabled={page === 1}
                                                    onClick={() => setPage(page - 1)}
                                                >
                                                    <KeyboardArrowLeft />
                                                </IconButton>
                                            </span>
                                        </Tooltip>

                                        <Pagination
                                            page={page}
                                            count={Math.ceil(total / limit) || 1}
                                            size="small"
                                            onChange={(_, v) => setPage(v)}
                                            siblingCount={1}
                                            boundaryCount={1}
                                            sx={{
                                                '& .MuiPaginationItem-root': {
                                                    color: isDarkMode ? '#94a3b8' : 'inherit',
                                                },
                                                '& .Mui-selected': {
                                                    bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.3) !important' : 'rgba(25, 118, 210, 0.12) !important',
                                                }
                                            }}
                                        />

                                        <Tooltip title="Next page">
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    disabled={page >= Math.ceil(total / limit)}
                                                    onClick={() => setPage(page + 1)}
                                                >
                                                    <KeyboardArrowRight />
                                                </IconButton>
                                            </span>
                                        </Tooltip>

                                        <Tooltip title="Last page">
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    disabled={page >= Math.ceil(total / limit)}
                                                    onClick={() => setPage(Math.ceil(total / limit))}
                                                >
                                                    <LastPage fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </Stack>
                                )}
                            </Box>
                        </Fade>

                        {/* List Column Settings Dialog */}
                        <Dialog open={listColumnSettingsOpen} onClose={() => setListColumnSettingsOpen(false)} maxWidth="sm" fullWidth container={isFullscreen ? multiEntryContainerRef.current : undefined}>
                            <DialogTitle>⚙️ Column Settings</DialogTitle>
                            <DialogContent>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6b21a8', mb: 1 }}>EDITABLE FIELDS</Typography>
                                <Stack spacing={1} sx={{ mb: 2 }}>
                                    {EDITABLE_COLUMNS.map((col) => (
                                        <FormControlLabel
                                            key={col}
                                            control={
                                                <Checkbox
                                                    checked={listColumns.includes(col)}
                                                    onChange={() => {
                                                        let next: string[];
                                                        if (listColumns.includes(col)) {
                                                            next = listColumns.filter((c: string) => c !== col);
                                                        } else {
                                                            next = [...listColumns, col];
                                                        }
                                                        // Maintain order using ALL_LIST_COLUMNS
                                                        const ordered = ALL_LIST_COLUMNS.filter((c) => next.includes(c));
                                                        saveListColumnSettings(ordered);
                                                    }}
                                                />
                                            }
                                            label={col.replace(/_/g, ' ').toUpperCase()}
                                        />
                                    ))}
                                </Stack>
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6b21a8', mb: 1 }}>READ-ONLY MASTER DATA</Typography>
                                <Stack spacing={1} sx={{ mt: 1 }}>
                                    {ALL_LIST_COLUMNS.filter((col) => !EDITABLE_COLUMNS.includes(col)).map((col) => (
                                        <FormControlLabel
                                            key={col}
                                            control={
                                                <Checkbox
                                                    checked={listColumns.includes(col)}
                                                    onChange={() => {
                                                        let next: string[];
                                                        if (listColumns.includes(col)) {
                                                            next = listColumns.filter((c: string) => c !== col);
                                                        } else {
                                                            next = [...listColumns, col];
                                                        }
                                                        // Maintain order using ALL_LIST_COLUMNS
                                                        const ordered = ALL_LIST_COLUMNS.filter((c) => next.includes(c));
                                                        saveListColumnSettings(ordered);
                                                    }}
                                                />
                                            }
                                            label={col.replace(/_/g, ' ').toUpperCase()}
                                        />
                                    ))}
                                </Stack>
                            </DialogContent>
                            <DialogActions sx={{ justifyContent: 'space-between' }}>
                                <Button onClick={() => setListColumnSettingsOpen(false)}>CLOSE</Button>
                                <Button onClick={() => setListColumnSettingsOpen(false)} variant="contained" sx={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: '#fff' }}>DONE</Button>
                            </DialogActions>
                        </Dialog>

                        {/* Export Dialog */}
                        <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth container={isFullscreen ? multiEntryContainerRef.current : undefined}>
                            <DialogTitle>Export to Excel</DialogTitle>
                            <DialogContent>
                                <Stack spacing={2} sx={{ mt: 1 }}>
                                    <TextField
                                        label="Start Date"
                                        type="date"
                                        value={exportStartDate}
                                        onChange={(e) => setExportStartDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        fullWidth
                                        size="small"
                                    />
                                    <TextField
                                        label="End Date"
                                        type="date"
                                        value={exportEndDate}
                                        onChange={(e) => setExportEndDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        fullWidth
                                        size="small"
                                    />
                                    <Autocomplete
                                        freeSolo
                                        options={customers}
                                        value={exportCustomer}
                                        onChange={(event, newValue) => setExportCustomer(newValue || '')}
                                        onInputChange={(event, newInputValue) => setExportCustomer(newInputValue)}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Customer"
                                                placeholder="Select or type customer name..."
                                                size="small"
                                            />
                                        )}
                                        noOptionsText={customers.length === 0 ? "No customers available" : "No matching customers"}
                                    />
                                    <TextField
                                        select
                                        label="Batch ID"
                                        value={exportBatchId}
                                        onChange={(e) => setExportBatchId(e.target.value)}
                                        fullWidth
                                        size="small"
                                    >
                                        <MenuItem value="">All Batches</MenuItem>
                                        {batches.map((b: any) => (
                                            <MenuItem key={b.batch_id} value={b.batch_id}>{b.batch_id} {b.count ? `(${b.count})` : null}</MenuItem>
                                        ))}
                                    </TextField>
                                    <TextField
                                        select
                                        label="Source"
                                        value={exportSource}
                                        onChange={(e) => setExportSource(e.target.value)}
                                        fullWidth
                                        size="small"
                                    >
                                        <MenuItem value="">All Sources</MenuItem>
                                        {sources.map((s) => (
                                            <MenuItem key={s} value={s}>{s}</MenuItem>
                                        ))}
                                    </TextField>
                                    <Typography variant="caption" color="text.secondary">
                                        Leave empty to use current list filters
                                    </Typography>
                                </Stack>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleExportExcel} variant="contained" startIcon={<DownloadIcon />}>
                                    Export
                                </Button>
                            </DialogActions>
                        </Dialog>
                    </Box>
                )}

                {/* GRID SETTINGS DIALOG (Outbound) */}
                <Dialog
                    open={gridSettingsOpen}
                    onClose={() => setGridSettingsOpen(false)}
                    maxWidth="xs"
                    fullWidth
                    PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } }}
                >
                    <DialogTitle sx={{
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: 'white',
                        fontWeight: 800,
                        fontSize: '1.1rem',
                        py: 1.5
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SettingsIcon />
                            Grid Settings
                        </Box>
                    </DialogTitle>

                    <DialogContent sx={{ mt: 2, pb: 1 }}>
                        <Stack spacing={2.5}>
                            <Alert severity="info" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                Settings auto-save and persist after reload 💾
                            </Alert>

                            {/* SORTABLE */}
                            <Box>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={enableSorting}
                                            onChange={(e) => setEnableSorting(e.target.checked)}
                                            sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                                        />
                                    }
                                    label={
                                        <Box>
                                            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                                                ⬆️ Enable Sorting
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                                                Click column headers to sort ascending/descending
                                            </Typography>
                                        </Box>
                                    }
                                />
                            </Box>

                            <Divider sx={{ my: 0.5 }} />

                            {/* FILTER */}
                            <Box>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={enableColumnFilters}
                                            onChange={(e) => setEnableColumnFilters(e.target.checked)}
                                            sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                                        />
                                    }
                                    label={
                                        <Box>
                                            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                                                🔍 Enable Column Filters
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                                                Filter menu icon in column headers
                                            </Typography>
                                        </Box>
                                    }
                                />
                            </Box>

                            <Divider sx={{ my: 0.5 }} />

                            {/* RESIZABLE */}
                            <Box>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={enableColumnResize}
                                            onChange={(e) => setEnableColumnResize(e.target.checked)}
                                            sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                                        />
                                    }
                                    label={
                                        <Box>
                                            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                                                ↔️ Enable Column Resize
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                                                Drag column borders to adjust width
                                            </Typography>
                                        </Box>
                                    }
                                />
                            </Box>

                        </Stack>
                    </DialogContent>

                    <DialogActions sx={{ p: 2, background: '#fef3c7', gap: 1 }}>
                        <Button
                            onClick={() => {
                                setEnableSorting(true);
                                setEnableColumnFilters(true);
                                setEnableColumnResize(true);
                                toast.success('Settings reset to default');
                            }}
                            sx={{
                                fontWeight: 700,
                                color: '#78716c',
                                '&:hover': { bgcolor: 'rgba(120, 113, 108, 0.1)' }
                            }}
                        >
                            Reset
                        </Button>

                        <Box sx={{ flex: 1 }} />

                        <Button onClick={() => setGridSettingsOpen(false)} sx={{ fontWeight: 700 }}>Close</Button>
                        <Button onClick={() => setGridSettingsOpen(false)} variant="contained" sx={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: '#fff' }}>Done</Button>
                    </DialogActions>
                </Dialog>

                {/* ====== TAB 1: SINGLE ENTRY ====== */}
                {currentTabCode === 'single' && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
                        <Card sx={{ borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#1a237e', fontSize: '0.9rem' }}>📝 Dispatch Entry Form</Typography>
                                <Stack spacing={1.5}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="WSN *"
                                        value={singleWSN}
                                        onChange={(e) => setSingleWSN(e.target.value.toUpperCase())}
                                        onKeyDown={handleSingleWSNScan}
                                        placeholder="Scan or enter WSN"
                                        inputRef={wsnInputRef}
                                        autoFocus
                                    />

                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Dispatch Date *"
                                        type="date"
                                        InputLabelProps={{ shrink: true }}
                                        value={singleForm.dispatch_date}
                                        onChange={(e) => setSingleForm({ ...singleForm, dispatch_date: e.target.value })}
                                    />

                                    <CustomerAutocomplete
                                        value={singleForm.customer_name}
                                        onChange={(newValue) => setSingleForm({ ...singleForm, customer_name: newValue })}
                                        customers={customers}
                                        warehouseId={activeWarehouse?.id}
                                        onCustomerAdded={loadCustomers}
                                        size="small"
                                        label="Customer Name *"
                                        placeholder="Type or select..."
                                        fullWidth
                                    />

                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Vehicle Number"
                                        value={singleForm.vehicle_no}
                                        onChange={(e) => setSingleForm({ ...singleForm, vehicle_no: e.target.value.toUpperCase() })}
                                        placeholder="e.g., MH01AB1234"
                                    />

                                    <TextField
                                        fullWidth
                                        size="small"
                                        multiline
                                        rows={2}
                                        label="Dispatch Remarks"
                                        value={singleForm.dispatch_remarks}
                                        onChange={(e) => setSingleForm({ ...singleForm, dispatch_remarks: e.target.value })}
                                    />

                                    <TextField
                                        fullWidth
                                        size="small"
                                        multiline
                                        rows={2}
                                        label="Other Remarks"
                                        value={singleForm.other_remarks}
                                        onChange={(e) => setSingleForm({ ...singleForm, other_remarks: e.target.value })}
                                    />

                                    {duplicateWSN && (
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={updateMode}
                                                    onChange={(e) => setUpdateMode(e.target.checked)}
                                                    color="warning"
                                                />
                                            }
                                            label="Update Existing Entry"
                                        />
                                    )}

                                    <Stack direction="row" spacing={1}>
                                        <Button
                                            fullWidth
                                            variant="contained"
                                            size="small"
                                            onClick={handleSingleSubmit}
                                            disabled={singleLoading}
                                            sx={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', py: 1 }}
                                        >
                                            {singleLoading ? <CircularProgress size={20} /> : '✓ Dispatch'}
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={handleSingleReset}
                                            sx={{ py: 1 }}
                                        >
                                            Reset
                                        </Button>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>

                        {sourceData && (
                            <Card sx={{
                                borderRadius: 2,
                                background: isDarkMode
                                    ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
                                    : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                                border: '2px solid #10b981'
                            }}>
                                <CardContent sx={{ p: 2 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                                        <CheckCircle sx={{ color: isDarkMode ? '#4ade80' : '#10b981', fontSize: 28 }} />
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: isDarkMode ? '#a7f3d0' : '#065f46', fontSize: '0.95rem' }}>Source Data Found</Typography>
                                    </Stack>
                                    <Divider sx={{ mb: 1.5, borderColor: isDarkMode ? 'rgba(167, 243, 208, 0.3)' : 'rgba(5, 150, 105, 0.3)' }} />
                                    <Stack spacing={1.5}>
                                        <Box>
                                            <Typography variant="caption" sx={{ color: isDarkMode ? '#a7f3d0' : '#065f46', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>SOURCE</Typography>
                                            <Box sx={{ mt: 0.5 }}>
                                                <Chip label={sourceData.source} size="small" color={sourceData.source === 'PICKING' ? 'primary' : sourceData.source === 'QC' ? 'success' : 'warning'} sx={{ fontWeight: 700 }} />
                                            </Box>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" sx={{ color: isDarkMode ? '#a7f3d0' : '#065f46', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>PRODUCT</Typography>
                                            <Typography sx={{ fontWeight: 600, color: isDarkMode ? '#d1fae5' : '#047857', fontSize: '0.85rem' }}>{sourceData.product_title || 'N/A'}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                                            <Box>
                                                <Typography variant="caption" sx={{ color: isDarkMode ? '#a7f3d0' : '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>BRAND</Typography>
                                                <Typography sx={{ fontWeight: 700, color: isDarkMode ? '#ecfdf5' : '#047857' }}>{sourceData.brand || 'N/A'}</Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" sx={{ color: isDarkMode ? '#a7f3d0' : '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>CATEGORY</Typography>
                                                <Typography sx={{ fontWeight: 700, color: isDarkMode ? '#ecfdf5' : '#047857' }}>{sourceData.cms_vertical || 'N/A'}</Typography>
                                            </Box>
                                        </Box>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                                            <Box>
                                                <Typography variant="caption" sx={{ color: isDarkMode ? '#a7f3d0' : '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>MRP</Typography>
                                                <Typography sx={{ fontWeight: 700, color: isDarkMode ? '#ecfdf5' : '#047857' }}>₹{sourceData.mrp || 'N/A'}</Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" sx={{ color: isDarkMode ? '#a7f3d0' : '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>FSP</Typography>
                                                <Typography sx={{ fontWeight: 700, color: isDarkMode ? '#ecfdf5' : '#047857' }}>₹{sourceData.fsp || 'N/A'}</Typography>
                                            </Box>
                                        </Box>
                                        {sourceData.fkt_link && (
                                            <Box>
                                                <Typography variant="caption" sx={{ color: isDarkMode ? '#a7f3d0' : '#065f46', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>PRODUCT LINK</Typography>
                                                <Box sx={{ mt: 0.5 }}>
                                                    <a
                                                        href={sourceData.fkt_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            color: isDarkMode ? '#38bdf8' : '#0ea5e9',
                                                            textDecoration: 'underline',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        View Product →
                                                    </a>
                                                </Box>
                                            </Box>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>
                        )}

                        {duplicateWSN && (
                            <Card sx={{ gridColumn: '1 / -1', borderRadius: 2, background: isDarkMode ? '#78350f' : '#fff3cd', border: `2px solid ${isDarkMode ? '#fbbf24' : '#ffc107'}` }}>
                                <CardContent>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isDarkMode ? '#fcd34d' : '#856404', mb: 1 }}>⚠️ Duplicate WSN Detected</Typography>
                                    <Typography variant="body2" sx={{ color: isDarkMode ? '#fde68a' : 'text.secondary' }}>
                                        This WSN is already dispatched. Enable "Update Existing Entry" checkbox to modify.
                                    </Typography>
                                </CardContent>
                            </Card>
                        )}
                    </Box>
                )}

                {/* TAB 2 - BULK UPLOAD */}
                {currentTabCode === 'bulk' && (
                    <Box sx={{ p: { xs: 1, sm: 1.5, md: 2 } }}>
                        <BulkUploadCard
                            module="outbound"
                            warehouseId={activeWarehouse?.id || 0}
                            userId={user?.id}
                            onUploadComplete={() => {
                                loadExistingWSNs();
                                loadOutboundList();
                            }}
                            onDownloadTemplate={handleConfirmDownload}
                            templateColumns={['WSN', 'DISPATCHDATE', 'CUSTOMERNAME', 'VEHICLENO', 'DISPATCHREMARKS', 'OTHERREMARKS']}
                            title="🔍 Bulk Outbound Upload"
                        />
                    </Box>
                )}



                {/* ====== TAB 3: MULTI ENTRY (AG GRID) ====== */}
                {currentTabCode === 'multi' && (
                    <Box
                        ref={multiEntryContainerRef}
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            minHeight: 0,
                            overflow: 'hidden',
                            bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa',
                            // Prevent white flash during tab switch
                            '& *': { transition: 'none !important' },
                            '& .ag-root-wrapper': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },
                        }}>

                        {/* Common Fields */}
                        <Card sx={{ mb: 0.5, borderRadius: 1, boxShadow: isDarkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)', bgcolor: isDarkMode ? '#1e293b' : 'white' }}>
                            <CardContent sx={{ p: { xs: 1.5, md: 1 }, pt: { xs: 2, md: 1 }, '&:last-child': { pb: { xs: 1.5, md: 1 } } }}>
                                {isMobile ? (
                                    /* MOBILE: Single Row - Scrollable Inputs + Fixed Buttons */
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', mt: 1 }}>
                                        {/* LEFT: Scrollable Input Fields with Arrow Indicators */}
                                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            {/* Left Arrow Indicator */}
                                            <Box
                                                sx={{
                                                    width: 16,
                                                    height: 40,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: isDarkMode ? '#64748b' : '#94a3b8',
                                                    fontSize: '0.7rem',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                ◀
                                            </Box>

                                            {/* Scrollable Container */}
                                            <Box
                                                sx={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    overflowX: 'auto',
                                                    overflowY: 'visible',
                                                    WebkitOverflowScrolling: 'touch',
                                                    scrollbarWidth: 'none',
                                                    '&::-webkit-scrollbar': { display: 'none' },
                                                }}
                                            >
                                                <Stack direction="row" spacing={1} sx={{ width: 'max-content', pt: 1 }}>
                                                    <TextField
                                                        label="Date *"
                                                        type="date"
                                                        value={commonDate}
                                                        onChange={(e) => setCommonDate(e.target.value)}
                                                        InputLabelProps={{ shrink: true }}
                                                        size="small"
                                                        required
                                                        sx={{
                                                            minWidth: 120,
                                                            '& .MuiInputBase-root': { height: 36, fontSize: '0.8rem' },
                                                            '& .MuiInputLabel-root': { fontSize: '0.75rem' }
                                                        }}
                                                    />
                                                    <Box sx={{ minWidth: 130 }}>
                                                        <CustomerAutocomplete
                                                            value={selectedCustomer}
                                                            onChange={(newValue) => setSelectedCustomer(newValue)}
                                                            customers={customers}
                                                            warehouseId={activeWarehouse?.id}
                                                            onCustomerAdded={loadCustomers}
                                                            size="small"
                                                            label="Customer *"
                                                            placeholder="Select..."
                                                            sx={{
                                                                '& .MuiInputBase-root': { height: 36, fontSize: '0.8rem' },
                                                                '& .MuiInputLabel-root': { fontSize: '0.75rem' }
                                                            }}
                                                        />
                                                    </Box>
                                                    <TextField
                                                        label="Vehicle"
                                                        value={commonVehicle}
                                                        onChange={(e) => setCommonVehicle(e.target.value.toUpperCase())}
                                                        size="small"
                                                        placeholder="Optional"
                                                        sx={{
                                                            minWidth: 90,
                                                            '& .MuiInputBase-root': { height: 36, fontSize: '0.8rem' },
                                                            '& .MuiInputLabel-root': { fontSize: '0.75rem' }
                                                        }}
                                                    />
                                                </Stack>
                                            </Box>

                                            {/* Right Arrow Indicator */}
                                            <Box
                                                sx={{
                                                    width: 16,
                                                    height: 40,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: isDarkMode ? '#64748b' : '#94a3b8',
                                                    fontSize: '0.7rem',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                ▶
                                            </Box>
                                        </Box>

                                        {/* RIGHT: Fixed Action Buttons */}
                                        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, alignItems: 'center' }}>
                                            {/* Menu Button */}
                                            <Tooltip title="Open Settings">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setOutboundSettingsPanelOpen(true)}
                                                    sx={{
                                                        width: 36,
                                                        height: 36,
                                                        borderRadius: 1,
                                                        border: '1.5px solid',
                                                        borderColor: isDarkMode ? '#3b82f6' : '#1e40af',
                                                        color: isDarkMode ? '#60a5fa' : '#1e40af',
                                                        bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(30, 64, 175, 0.04)',
                                                        '&:hover': { borderColor: '#3b82f6', bgcolor: 'rgba(59, 130, 246, 0.12)' }
                                                    }}
                                                >
                                                    <MenuIcon sx={{ fontSize: 18 }} />
                                                </IconButton>
                                            </Tooltip>

                                            {/* Fullscreen Button */}
                                            <Tooltip title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
                                                <IconButton
                                                    size="small"
                                                    onClick={toggleFullscreen}
                                                    sx={{
                                                        width: 36,
                                                        height: 36,
                                                        borderRadius: 1,
                                                        border: '1.5px solid',
                                                        borderColor: isFullscreen ? '#f59e0b' : (isDarkMode ? '#475569' : '#d1d5db'),
                                                        color: isFullscreen ? '#f59e0b' : (isDarkMode ? '#94a3b8' : '#64748b'),
                                                        bgcolor: isFullscreen ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                                                        '&:hover': { borderColor: '#f59e0b', bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }
                                                    }}
                                                >
                                                    {isFullscreen ? <FullscreenExitIcon sx={{ fontSize: 18 }} /> : <FullscreenIcon sx={{ fontSize: 18 }} />}
                                                </IconButton>
                                            </Tooltip>

                                            {/* Live View Panel */}
                                            <LiveViewPanel
                                                warehouseId={activeWarehouse?.id}
                                                pageType="outbound"
                                                isDarkMode={isDarkMode}
                                                container={multiEntryContainerRef.current}
                                            />
                                        </Stack>
                                    </Box>
                                ) : (
                                    /* Desktop: Clean Single Row Layout - like Inbound */
                                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                        {/* LEFT: Input Fields */}
                                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flex: 1, maxWidth: 550 }}>
                                            <TextField
                                                label="Dispatch Date *"
                                                type="date"
                                                value={commonDate}
                                                onChange={(e) => setCommonDate(e.target.value)}
                                                InputLabelProps={{ shrink: true }}
                                                size="small"
                                                required
                                                sx={{
                                                    width: 150,
                                                    '& .MuiInputBase-root': {
                                                        height: 38,
                                                        bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                                                        borderRadius: 1.5
                                                    }
                                                }}
                                            />
                                            <Box sx={{ flex: 1, minWidth: 180, maxWidth: 240 }}>
                                                <CustomerAutocomplete
                                                    value={selectedCustomer}
                                                    onChange={(newValue) => setSelectedCustomer(newValue)}
                                                    customers={customers}
                                                    warehouseId={activeWarehouse?.id}
                                                    onCustomerAdded={loadCustomers}
                                                    size="small"
                                                    label="Customer Name *"
                                                    placeholder="Type or select..."
                                                    sx={{ width: '100%' }}
                                                />
                                            </Box>
                                            <TextField
                                                label="Vehicle No"
                                                value={commonVehicle}
                                                onChange={(e) => setCommonVehicle(e.target.value.toUpperCase())}
                                                size="small"
                                                placeholder="Optional"
                                                sx={{
                                                    width: 120,
                                                    '& .MuiInputBase-root': {
                                                        height: 38,
                                                        bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                                                        borderRadius: 1.5
                                                    }
                                                }}
                                            />
                                        </Stack>

                                        {/* RIGHT: Menu Button + Fullscreen + Live View */}
                                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                            {/* Settings Menu Button */}
                                            <Tooltip title="Open Settings Panel" placement="top">
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    startIcon={<MenuIcon sx={{ fontSize: 18 }} />}
                                                    onClick={() => setOutboundSettingsPanelOpen(true)}
                                                    sx={{
                                                        height: 38,
                                                        px: 2,
                                                        borderRadius: 1.5,
                                                        fontWeight: 600,
                                                        fontSize: '0.8rem',
                                                        textTransform: 'none',
                                                        borderColor: isDarkMode ? '#3b82f6' : '#1e40af',
                                                        color: isDarkMode ? '#60a5fa' : '#1e40af',
                                                        bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(30, 64, 175, 0.04)',
                                                        '&:hover': {
                                                            borderColor: '#3b82f6',
                                                            bgcolor: 'rgba(59, 130, 246, 0.12)'
                                                        }
                                                    }}
                                                >
                                                    Menu
                                                </Button>
                                            </Tooltip>

                                            {/* Fullscreen Button */}
                                            <Tooltip title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen mode"} placement="top">
                                                <IconButton
                                                    size="small"
                                                    onClick={toggleFullscreen}
                                                    sx={{
                                                        width: 38,
                                                        height: 38,
                                                        borderRadius: 1.5,
                                                        border: '1.5px solid',
                                                        borderColor: isFullscreen ? '#f59e0b' : (isDarkMode ? '#475569' : '#d1d5db'),
                                                        color: isFullscreen ? '#f59e0b' : (isDarkMode ? '#94a3b8' : '#64748b'),
                                                        bgcolor: isFullscreen ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                                                        '&:hover': {
                                                            borderColor: '#f59e0b',
                                                            bgcolor: 'rgba(245, 158, 11, 0.1)',
                                                            color: '#f59e0b'
                                                        }
                                                    }}
                                                >
                                                    {isFullscreen ? <FullscreenExitIcon sx={{ fontSize: 20 }} /> : <FullscreenIcon sx={{ fontSize: 20 }} />}
                                                </IconButton>
                                            </Tooltip>

                                            {/* Live View Panel */}
                                            <LiveViewPanel
                                                warehouseId={activeWarehouse?.id}
                                                pageType="outbound"
                                                isDarkMode={isDarkMode}
                                                container={multiEntryContainerRef.current}
                                            />
                                        </Stack>
                                    </Stack>
                                )}

                                {/* SETTINGS DRAWER - Right Side Panel with Accordions */}
                                <Drawer
                                    anchor="right"
                                    open={outboundSettingsPanelOpen}
                                    onClose={() => setOutboundSettingsPanelOpen(false)}
                                    container={multiEntryContainerRef.current}
                                    ModalProps={{
                                        container: multiEntryContainerRef.current,
                                        keepMounted: false,
                                    }}
                                    PaperProps={{
                                        sx: {
                                            width: { xs: '100%', sm: 380 },
                                            maxWidth: '100vw',
                                            bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
                                            borderLeft: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0'
                                        }
                                    }}
                                >
                                    {/* Panel Header */}
                                    <Box sx={{
                                        p: 2,
                                        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 10
                                    }}>
                                        <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>⚙️ Settings</Typography>
                                        <IconButton size="small" onClick={() => setOutboundSettingsPanelOpen(false)} sx={{ color: 'white' }}>
                                            <CloseIcon />
                                        </IconButton>
                                    </Box>

                                    {/* Panel Content with Accordions */}
                                    <Box sx={{ overflow: 'auto', flex: 1 }}>

                                        {/* ═══════════ COLUMNS ACCORDION ═══════════ */}
                                        <Accordion
                                            expanded={settingsPanelExpanded === 'columns'}
                                            onChange={(_, isExpanded) => setSettingsPanelExpanded(isExpanded ? 'columns' : false)}
                                            disableGutters
                                            sx={{
                                                bgcolor: 'transparent',
                                                boxShadow: 'none',
                                                '&:before': { display: 'none' },
                                                borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0'
                                            }}
                                        >
                                            <AccordionSummary
                                                expandIcon={<ExpandMoreIcon sx={{ color: isDarkMode ? '#94a3b8' : '#64748b' }} />}
                                                sx={{
                                                    px: 2,
                                                    minHeight: 56,
                                                    '&.Mui-expanded': { minHeight: 56 },
                                                    '& .MuiAccordionSummary-content': { my: 1.5 }
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <ViewColumnIcon sx={{ color: '#3b82f6', fontSize: 22 }} />
                                                    <Box>
                                                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>Columns</Typography>
                                                        <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                                                            {visibleColumns.length} columns visible
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                                                <Box sx={{ maxHeight: 280, overflow: 'auto', pr: 1 }}>
                                                    <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', color: '#3b82f6', mb: 1, textTransform: 'uppercase' }}>Editable Fields</Typography>
                                                    <Stack spacing={0.5} sx={{ mb: 2 }}>
                                                        {EDITABLE_COLUMNS.map((col) => (
                                                            <FormControlLabel
                                                                key={col}
                                                                control={
                                                                    <Checkbox
                                                                        size="small"
                                                                        checked={visibleColumns.includes(col)}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setVisibleColumns([...visibleColumns, col]);
                                                                            } else {
                                                                                setVisibleColumns(visibleColumns.filter((c: string) => c !== col));
                                                                            }
                                                                        }}
                                                                        sx={{ py: 0.25, '&.Mui-checked': { color: '#3b82f6' } }}
                                                                    />
                                                                }
                                                                label={<Typography sx={{ fontSize: '0.8rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>{col.replace(/_/g, ' ').toUpperCase()}</Typography>}
                                                                sx={{ m: 0 }}
                                                            />
                                                        ))}
                                                    </Stack>
                                                    <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', color: '#10b981', mb: 1, textTransform: 'uppercase' }}>Master Data Fields</Typography>
                                                    <Stack spacing={0.5}>
                                                        {ALL_MULTI_COLUMNS.filter((col) => !EDITABLE_COLUMNS.includes(col)).map((col: string) => (
                                                            <FormControlLabel
                                                                key={col}
                                                                control={
                                                                    <Checkbox
                                                                        size="small"
                                                                        checked={visibleColumns.includes(col)}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setVisibleColumns([...visibleColumns, col]);
                                                                            } else {
                                                                                setVisibleColumns(visibleColumns.filter((c: string) => c !== col));
                                                                            }
                                                                        }}
                                                                        sx={{ py: 0.25, '&.Mui-checked': { color: '#10b981' } }}
                                                                    />
                                                                }
                                                                label={<Typography sx={{ fontSize: '0.8rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>{col.replace(/_/g, ' ').toUpperCase()}</Typography>}
                                                                sx={{ m: 0 }}
                                                            />
                                                        ))}
                                                    </Stack>
                                                </Box>
                                            </AccordionDetails>
                                        </Accordion>

                                        {/* ═══════════ GRID SETTINGS ACCORDION ═══════════ */}
                                        <Accordion
                                            expanded={settingsPanelExpanded === 'grid'}
                                            onChange={(_, isExpanded) => setSettingsPanelExpanded(isExpanded ? 'grid' : false)}
                                            disableGutters
                                            sx={{
                                                bgcolor: 'transparent',
                                                boxShadow: 'none',
                                                '&:before': { display: 'none' },
                                                borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0'
                                            }}
                                        >
                                            <AccordionSummary
                                                expandIcon={<ExpandMoreIcon sx={{ color: isDarkMode ? '#94a3b8' : '#64748b' }} />}
                                                sx={{
                                                    px: 2,
                                                    minHeight: 56,
                                                    '&.Mui-expanded': { minHeight: 56 },
                                                    '& .MuiAccordionSummary-content': { my: 1.5 }
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <TableChartIcon sx={{ color: '#f59e0b', fontSize: 22 }} />
                                                    <Box>
                                                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>Grid Settings</Typography>
                                                        <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Sorting, filtering, resize</Typography>
                                                    </Box>
                                                </Box>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                                                <Stack spacing={1.5}>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={enableSorting}
                                                                onChange={(e) => {
                                                                    setEnableSorting(e.target.checked);
                                                                    localStorage.setItem('outbound_enableSorting', String(e.target.checked));
                                                                }}
                                                                sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                                                            />
                                                        }
                                                        label={
                                                            <Box>
                                                                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>⬆️ Enable Sorting</Typography>
                                                                <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Click headers to sort</Typography>
                                                            </Box>
                                                        }
                                                    />
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={enableColumnFilters}
                                                                onChange={(e) => {
                                                                    setEnableColumnFilters(e.target.checked);
                                                                    localStorage.setItem('outbound_enableColumnFilters', String(e.target.checked));
                                                                }}
                                                                sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                                                            />
                                                        }
                                                        label={
                                                            <Box>
                                                                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>🔍 Enable Filtering</Typography>
                                                                <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Filter in column headers</Typography>
                                                            </Box>
                                                        }
                                                    />
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={enableColumnResize}
                                                                onChange={(e) => {
                                                                    setEnableColumnResize(e.target.checked);
                                                                    localStorage.setItem('outbound_enableColumnResize', String(e.target.checked));
                                                                }}
                                                                sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                                                            />
                                                        }
                                                        label={
                                                            <Box>
                                                                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>↔️ Column Resize</Typography>
                                                                <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Drag borders to resize</Typography>
                                                            </Box>
                                                        }
                                                    />
                                                    <Button
                                                        size="small"
                                                        onClick={() => {
                                                            setEnableSorting(true);
                                                            setEnableColumnFilters(true);
                                                            setEnableColumnResize(true);
                                                            localStorage.setItem('outbound_enableSorting', 'true');
                                                            localStorage.setItem('outbound_enableColumnFilters', 'true');
                                                            localStorage.setItem('outbound_enableColumnResize', 'true');
                                                            toast.success('Grid settings reset');
                                                        }}
                                                        sx={{ alignSelf: 'flex-start', fontSize: '0.75rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}
                                                    >
                                                        🔄 Reset to Default
                                                    </Button>
                                                </Stack>
                                            </AccordionDetails>
                                        </Accordion>

                                        {/* ═══════════ BATCH & CACHE ACCORDION ═══════════ */}
                                        <Accordion
                                            expanded={settingsPanelExpanded === 'cache'}
                                            onChange={(_, isExpanded) => setSettingsPanelExpanded(isExpanded ? 'cache' : false)}
                                            disableGutters
                                            sx={{
                                                bgcolor: 'transparent',
                                                boxShadow: 'none',
                                                '&:before': { display: 'none' },
                                                borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0'
                                            }}
                                        >
                                            <AccordionSummary
                                                expandIcon={<ExpandMoreIcon sx={{ color: isDarkMode ? '#94a3b8' : '#64748b' }} />}
                                                sx={{
                                                    px: 2,
                                                    minHeight: 56,
                                                    '&.Mui-expanded': { minHeight: 56 },
                                                    '& .MuiAccordionSummary-content': { my: 1.5 }
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <Box sx={{ fontSize: 20 }}>💾</Box>
                                                    <Box>
                                                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>Batch & Cache</Typography>
                                                        <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                                                            {cacheEnabled ? `${cacheStats?.totalRecords?.toLocaleString() || 0} items cached` : 'Cache disabled'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                                                <Stack spacing={2}>
                                                    {/* Cache Toggle */}
                                                    <Box sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        p: 1.5,
                                                        borderRadius: 1.5,
                                                        bgcolor: cacheEnabled ? (isDarkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)') : (isDarkMode ? '#0f172a' : '#f8fafc'),
                                                        border: cacheEnabled ? '1px solid #10b981' : (isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0')
                                                    }}>
                                                        <Box>
                                                            <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>Offline Cache</Typography>
                                                            <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Faster WSN lookups</Typography>
                                                        </Box>
                                                        <Switch
                                                            checked={cacheEnabled}
                                                            onChange={toggleCache}
                                                            sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10b981' } }}
                                                        />
                                                    </Box>

                                                    {/* Ctrl+O Toggle */}
                                                    <Box sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        p: 1.5,
                                                        borderRadius: 1.5,
                                                        bgcolor: ctrlOProductLinkEnabled ? (isDarkMode ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.08)') : (isDarkMode ? '#0f172a' : '#f8fafc'),
                                                        border: ctrlOProductLinkEnabled ? '1px solid #a855f7' : (isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0')
                                                    }}>
                                                        <Box>
                                                            <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>Ctrl+O Product Link</Typography>
                                                            <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Opens FKT link for last scanned WSN</Typography>
                                                        </Box>
                                                        <Switch
                                                            checked={ctrlOProductLinkEnabled}
                                                            onChange={(e) => setCtrlOProductLinkEnabled(e.target.checked)}
                                                            sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#a855f7' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#a855f7' } }}
                                                        />
                                                    </Box>

                                                    {/* Refresh Cache Button */}
                                                    {cacheEnabled && (
                                                        <Button
                                                            size="small"
                                                            startIcon={<RefreshIcon />}
                                                            onClick={refreshCache}
                                                            disabled={cacheLoading}
                                                            sx={{
                                                                alignSelf: 'flex-start',
                                                                fontSize: '0.75rem',
                                                                color: '#10b981',
                                                                borderColor: '#10b981',
                                                                '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' }
                                                            }}
                                                            variant="outlined"
                                                        >
                                                            {cacheLoading ? 'Refreshing...' : 'Refresh Cache'}
                                                        </Button>
                                                    )}
                                                </Stack>
                                            </AccordionDetails>
                                        </Accordion>

                                        {/* ═══════════ CATEGORY PIVOT BUTTON ═══════════ */}
                                        <Box sx={{ p: 2, borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
                                            <Button
                                                fullWidth
                                                variant="outlined"
                                                startIcon={<PieChartIcon />}
                                                onClick={() => { setCategoryPivotOpen(true); setOutboundSettingsPanelOpen(false); }}
                                                disabled={!multiRows.some((r: any) => r.wsn?.trim())}
                                                sx={{
                                                    height: 44,
                                                    fontWeight: 600,
                                                    borderColor: '#8b5cf6',
                                                    color: '#8b5cf6',
                                                    '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.1)', borderColor: '#8b5cf6' },
                                                    '&.Mui-disabled': { borderColor: '#94a3b8', color: '#94a3b8' }
                                                }}
                                            >
                                                Category Pivot View
                                            </Button>
                                        </Box>

                                        {/* ═══════════ EXPORT BUTTON ═══════════ */}
                                        <Box sx={{ p: 2, borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
                                            <Button
                                                fullWidth
                                                variant="contained"
                                                startIcon={<DownloadIcon />}
                                                onClick={() => { setExportConfirmOpen(true); setOutboundSettingsPanelOpen(false); }}
                                                disabled={!multiRows.some((r: any) => r.wsn?.trim())}
                                                sx={{
                                                    height: 44,
                                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                    fontWeight: 600,
                                                    '&:hover': { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' },
                                                    '&.Mui-disabled': { background: '#94a3b8' }
                                                }}
                                            >
                                                Export to Excel
                                            </Button>
                                        </Box>
                                    </Box>
                                </Drawer>
                            </CardContent>
                        </Card>

                        {/* Duplicate Warning */}
                        {(gridDuplicateWSNs.size > 0 || crossWarehouseWSNs.size > 0) && (
                            <Alert severity="error" sx={{ mb: 0.5, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600 }}>
                                {gridDuplicateWSNs.size > 0 && `Duplicate WSNs: ${Array.from(gridDuplicateWSNs).join(', ')}. `}
                                {crossWarehouseWSNs.size > 0 && `Already dispatched: ${Array.from(crossWarehouseWSNs).join(', ')}`}
                            </Alert>
                        )}

                        {/* MULTI ENTRY: COLUMN SETTINGS DIALOG (match Inbound/QC) */}
                        <Dialog
                            open={columnSettingsOpen}
                            onClose={() => setColumnSettingsOpen(false)}
                            maxWidth="sm"
                            fullWidth
                            container={multiEntryContainerRef.current}
                            PaperProps={{ sx: { borderRadius: 2 } }}
                        >
                            <DialogTitle
                                sx={{
                                    fontWeight: 800,
                                    background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                                    color: 'white',
                                    py: 2,
                                }}
                            >
                                ⚙️ Columns View Settings
                            </DialogTitle>
                            <DialogContent sx={{ py: 3, maxHeight: 600, overflow: 'auto' }}>
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        mb: 2,
                                        fontWeight: 800,
                                        color: '#1e40af',
                                        textTransform: 'uppercase',
                                        fontSize: '0.75rem',
                                    }}
                                >
                                    Editable Fields
                                </Typography>
                                <Stack spacing={1} sx={{ mb: 3 }}>
                                    {EDITABLE_COLUMNS.map((col, idx) => (
                                        <FormControlLabel
                                            key={`col_${idx}_${col}`}
                                            control={
                                                <Checkbox
                                                    checked={visibleColumns.includes(col)}
                                                    onChange={(e) => {
                                                        let next = visibleColumns;

                                                        if (e.target.checked) {
                                                            next = [...visibleColumns, col];
                                                        } else {
                                                            next = visibleColumns.filter((c) => c !== col);
                                                        }

                                                        const ordered = [...EDITABLE_COLUMNS, ...ALL_MULTI_COLUMNS].filter(
                                                            (c) => next.includes(c),
                                                        );

                                                        saveColumnSettings(ordered);
                                                    }}
                                                />
                                            }
                                            label={col.replace(/_/g, ' ').toUpperCase()}
                                        />
                                    ))}
                                </Stack>

                                <Divider sx={{ my: 2 }} />
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        mb: 2,
                                        fontWeight: 800,
                                        color: '#3b82f6',
                                        textTransform: 'uppercase',
                                        fontSize: '0.75rem',
                                    }}
                                >
                                    Read-Only Master Data
                                </Typography>
                                <Stack spacing={1}>
                                    {ALL_MULTI_COLUMNS.filter((col) => !EDITABLE_COLUMNS.includes(col)).map((col, idx) => (
                                        <FormControlLabel
                                            key={`master_${idx}_${col}`}
                                            control={
                                                <Checkbox
                                                    checked={visibleColumns.includes(col)}
                                                    onChange={(e) => {
                                                        let next = visibleColumns;

                                                        if (e.target.checked) {
                                                            next = [...visibleColumns, col];
                                                        } else {
                                                            next = visibleColumns.filter((c) => c !== col);
                                                        }

                                                        const ordered = [...EDITABLE_COLUMNS, ...ALL_MULTI_COLUMNS].filter(
                                                            (c) => next.includes(c),
                                                        );

                                                        saveColumnSettings(ordered);
                                                    }}
                                                />
                                            }
                                            label={col.replace(/_/g, ' ').toUpperCase()}
                                        />
                                    ))}
                                </Stack>
                            </DialogContent>
                            <DialogActions sx={{ p: 2, background: '#f9fafb' }}>
                                <Button onClick={() => setColumnSettingsOpen(false)} sx={{ fontWeight: 700 }}>
                                    Close
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={() => setColumnSettingsOpen(false)}
                                    sx={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', fontWeight: 700 }}
                                >
                                    Done
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {/* Export Confirmation Dialog */}
                        <Dialog
                            open={exportConfirmOpen}
                            onClose={() => setExportConfirmOpen(false)}
                            container={multiEntryContainerRef.current}
                            PaperProps={{
                                sx: {
                                    borderRadius: 2,
                                    minWidth: 340,
                                }
                            }}
                        >
                            <DialogTitle sx={{
                                pb: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                fontWeight: 700,
                                color: '#1e40af'
                            }}>
                                <DownloadIcon sx={{ color: '#10b981' }} />
                                Export to Excel
                            </DialogTitle>
                            <DialogContent>
                                <Typography variant="body2" color="text.secondary">
                                    Export {multiRows.filter((r: any) => r.wsn?.trim()).length} rows with WSN data to Excel file?
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                    All columns including product details will be exported.
                                </Typography>
                            </DialogContent>
                            <DialogActions sx={{ p: 2, pt: 1 }}>
                                <Button
                                    onClick={() => setExportConfirmOpen(false)}
                                    sx={{ color: '#64748b', fontWeight: 600 }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={() => {
                                        setExportConfirmOpen(false);
                                        exportMultiEntryToExcel();
                                    }}
                                    sx={{
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        fontWeight: 700,
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                        }
                                    }}
                                >
                                    Yes, Export
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {/* Category Pivot Dialog */}
                        <Dialog
                            open={categoryPivotOpen}
                            onClose={() => setCategoryPivotOpen(false)}
                            maxWidth={pivotDialogFullscreen ? false : "lg"}
                            fullWidth
                            container={multiEntryContainerRef.current}
                            PaperProps={{
                                sx: {
                                    borderRadius: pivotDialogFullscreen ? 0 : 2,
                                    bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
                                    ...(pivotDialogFullscreen ? {
                                        width: '98vw',
                                        height: '92vh',
                                        maxWidth: 'none',
                                        maxHeight: 'none',
                                        m: 1,
                                    } : {
                                        width: '1100px', // ~2 inch wider than md (900px)
                                        minHeight: '600px', // ~1 inch taller
                                    }),
                                }
                            }}
                        >
                            <DialogTitle sx={{
                                pb: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                                color: 'white',
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PieChartIcon />
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        {pivotGroupBy === 'brand' ? 'Brand' : pivotGroupBy === 'p_type' ? 'P_Type' : pivotGroupBy === 'combined' ? 'Combined' : pivotGroupBy === 'crosstab' ? 'Cross-Tab' : 'Category'} Quantity Summary
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip
                                        label={`${pivotGroupBy === 'crosstab' ? crossTabPivotData.grandTotal : categoryPivotData.grandTotal.qty} Items`}
                                        size="small"
                                        sx={{
                                            bgcolor: 'rgba(255,255,255,0.2)',
                                            color: 'white',
                                            fontWeight: 700,
                                        }}
                                    />
                                    <IconButton
                                        size="small"
                                        onClick={() => setPivotDialogFullscreen(!pivotDialogFullscreen)}
                                        sx={{
                                            color: 'white',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                                        }}
                                        title={pivotDialogFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                                    >
                                        {pivotDialogFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                                    </IconButton>
                                </Box>
                            </DialogTitle>
                            <DialogContent sx={{ p: 0 }}>
                                {/* Group By Toggle */}
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    p: 2,
                                    borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
                                    bgcolor: isDarkMode ? '#1e293b' : '#f8fafc',
                                }}>
                                    <Typography sx={{ fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '0.85rem' }}>
                                        Group By:
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                        <Button
                                            size="small"
                                            variant={pivotGroupBy === 'category' ? 'contained' : 'outlined'}
                                            onClick={() => handlePivotGroupChange('category')}
                                            sx={{
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                px: 2,
                                                py: 0.5,
                                                borderRadius: 1,
                                                textTransform: 'none',
                                                ...(pivotGroupBy === 'category' ? {
                                                    background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                                                    '&:hover': { background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)' },
                                                } : {
                                                    borderColor: isDarkMode ? '#6366f1' : '#8b5cf6',
                                                    color: isDarkMode ? '#a5b4fc' : '#7c3aed',
                                                    '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.08)' },
                                                }),
                                            }}
                                        >
                                            📁 Category
                                        </Button>
                                        <Button
                                            size="small"
                                            variant={pivotGroupBy === 'brand' ? 'contained' : 'outlined'}
                                            onClick={() => handlePivotGroupChange('brand')}
                                            sx={{
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                px: 2,
                                                py: 0.5,
                                                borderRadius: 1,
                                                textTransform: 'none',
                                                ...(pivotGroupBy === 'brand' ? {
                                                    background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
                                                    '&:hover': { background: 'linear-gradient(135deg, #0e7490 0%, #0891b2 100%)' },
                                                } : {
                                                    borderColor: isDarkMode ? '#22d3ee' : '#0891b2',
                                                    color: isDarkMode ? '#67e8f9' : '#0891b2',
                                                    '&:hover': { bgcolor: 'rgba(6, 182, 212, 0.08)' },
                                                }),
                                            }}
                                        >
                                            🏷️ Brand
                                        </Button>
                                        <Button
                                            size="small"
                                            variant={pivotGroupBy === 'p_type' ? 'contained' : 'outlined'}
                                            onClick={() => handlePivotGroupChange('p_type')}
                                            sx={{
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                px: 2,
                                                py: 0.5,
                                                borderRadius: 1,
                                                textTransform: 'none',
                                                ...(pivotGroupBy === 'p_type' ? {
                                                    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
                                                    '&:hover': { background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)' },
                                                } : {
                                                    borderColor: isDarkMode ? '#fb923c' : '#ea580c',
                                                    color: isDarkMode ? '#fdba74' : '#ea580c',
                                                    '&:hover': { bgcolor: 'rgba(249, 115, 22, 0.08)' },
                                                }),
                                            }}
                                        >
                                            📦 P_Type
                                        </Button>
                                        <Button
                                            size="small"
                                            variant={pivotGroupBy === 'combined' ? 'contained' : 'outlined'}
                                            onClick={() => handlePivotGroupChange('combined')}
                                            sx={{
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                px: 2,
                                                py: 0.5,
                                                borderRadius: 1,
                                                textTransform: 'none',
                                                ...(pivotGroupBy === 'combined' ? {
                                                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                                    '&:hover': { background: 'linear-gradient(135deg, #047857 0%, #059669 100%)' },
                                                } : {
                                                    borderColor: isDarkMode ? '#34d399' : '#059669',
                                                    color: isDarkMode ? '#6ee7b7' : '#059669',
                                                    '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.08)' },
                                                }),
                                            }}
                                        >
                                            🔗 Combined
                                        </Button>
                                        <Button
                                            size="small"
                                            variant={pivotGroupBy === 'crosstab' ? 'contained' : 'outlined'}
                                            onClick={() => handlePivotGroupChange('crosstab')}
                                            sx={{
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                px: 2,
                                                py: 0.5,
                                                borderRadius: 1,
                                                textTransform: 'none',
                                                ...(pivotGroupBy === 'crosstab' ? {
                                                    background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                                                    '&:hover': { background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)' },
                                                } : {
                                                    borderColor: isDarkMode ? '#f87171' : '#dc2626',
                                                    color: isDarkMode ? '#fca5a5' : '#dc2626',
                                                    '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)' },
                                                }),
                                            }}
                                        >
                                            📊 Cross-Tab
                                        </Button>
                                    </Box>
                                </Box>

                                {/* Cross-Tab Settings */}
                                {pivotGroupBy === 'crosstab' && (
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        px: 2,
                                        py: 1.5,
                                        borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
                                        bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.03)',
                                        flexWrap: 'wrap',
                                    }}>
                                        <Typography sx={{ fontWeight: 600, color: isDarkMode ? '#fca5a5' : '#dc2626', fontSize: '0.8rem' }}>
                                            ⚙️ Settings:
                                        </Typography>
                                        <FormControl size="small" sx={{ minWidth: 130 }}>
                                            <InputLabel
                                                id="crosstab-row-field-label"
                                                sx={{
                                                    fontSize: '0.75rem',
                                                    color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                    '&.Mui-focused': {
                                                        color: isDarkMode ? '#fca5a5' : '#dc2626',
                                                    },
                                                    '&.MuiInputLabel-shrink': {
                                                        color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                    },
                                                }}
                                            >Row Field</InputLabel>
                                            <Select
                                                labelId="crosstab-row-field-label"
                                                id="crosstab-row-field"
                                                value={crossTabRowField}
                                                onChange={(e) => {
                                                    const newVal = e.target.value as 'category' | 'brand' | 'p_type';
                                                    if (newVal === crossTabColField) {
                                                        // Swap: set col field to current row field before changing row field
                                                        setCrossTabColField(crossTabRowField);
                                                    }
                                                    setCrossTabRowField(newVal);
                                                    setCrossTabFilter([]);
                                                }}
                                                label="Row Field"
                                                MenuProps={{
                                                    PaperProps: {
                                                        sx: {
                                                            bgcolor: isDarkMode ? '#1e293b' : '#fff',
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                            '& .MuiMenuItem-root': {
                                                                fontSize: '0.75rem',
                                                                color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                                '&:hover': {
                                                                    bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                                                },
                                                                '&.Mui-selected': {
                                                                    bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.15)',
                                                                    color: isDarkMode ? '#fca5a5' : '#dc2626',
                                                                },
                                                            },
                                                        },
                                                    },
                                                }}
                                                sx={{
                                                    fontSize: '0.75rem',
                                                    height: 36,
                                                    bgcolor: isDarkMode ? '#1e293b' : '#fff',
                                                    color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                    '& .MuiSelect-select': {
                                                        color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                    },
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: isDarkMode ? '#475569' : '#d1d5db',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: isDarkMode ? '#f87171' : '#dc2626',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: isDarkMode ? '#f87171' : '#dc2626',
                                                    },
                                                    '& .MuiSelect-icon': {
                                                        color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                    },
                                                }}
                                            >
                                                <MenuItem value="category">📁 Category</MenuItem>
                                                <MenuItem value="brand">🏷️ Brand</MenuItem>
                                                <MenuItem value="p_type">📦 P_Type</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <Typography sx={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 600 }}>×</Typography>
                                        <FormControl size="small" sx={{ minWidth: 130 }}>
                                            <InputLabel
                                                id="crosstab-col-field-label"
                                                sx={{
                                                    fontSize: '0.75rem',
                                                    color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                    '&.Mui-focused': {
                                                        color: isDarkMode ? '#fca5a5' : '#dc2626',
                                                    },
                                                    '&.MuiInputLabel-shrink': {
                                                        color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                    },
                                                }}
                                            >Column Field</InputLabel>
                                            <Select
                                                labelId="crosstab-col-field-label"
                                                id="crosstab-col-field"
                                                value={crossTabColField}
                                                onChange={(e) => {
                                                    const newVal = e.target.value as 'category' | 'brand' | 'p_type';
                                                    if (newVal === crossTabRowField) {
                                                        // Swap: set row field to current col field before changing col field
                                                        setCrossTabRowField(crossTabColField);
                                                    }
                                                    setCrossTabColField(newVal);
                                                    setCrossTabFilter([]);
                                                }}
                                                label="Column Field"
                                                MenuProps={{
                                                    PaperProps: {
                                                        sx: {
                                                            bgcolor: isDarkMode ? '#1e293b' : '#fff',
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                            '& .MuiMenuItem-root': {
                                                                fontSize: '0.75rem',
                                                                color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                                '&:hover': {
                                                                    bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                                                },
                                                                '&.Mui-selected': {
                                                                    bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.15)',
                                                                    color: isDarkMode ? '#fca5a5' : '#dc2626',
                                                                },
                                                            },
                                                        },
                                                    },
                                                }}
                                                sx={{
                                                    fontSize: '0.75rem',
                                                    height: 36,
                                                    bgcolor: isDarkMode ? '#1e293b' : '#fff',
                                                    color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                    '& .MuiSelect-select': {
                                                        color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                    },
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: isDarkMode ? '#475569' : '#d1d5db',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: isDarkMode ? '#f87171' : '#dc2626',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: isDarkMode ? '#f87171' : '#dc2626',
                                                    },
                                                    '& .MuiSelect-icon': {
                                                        color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                    },
                                                }}
                                            >
                                                <MenuItem value="category">📁 Category</MenuItem>
                                                <MenuItem value="brand">🏷️ Brand</MenuItem>
                                                <MenuItem value="p_type">📦 P_Type</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: isDarkMode ? '#475569' : '#e2e8f0' }} />
                                        <Autocomplete
                                            multiple
                                            size="small"
                                            disableCloseOnSelect
                                            options={crossTabFilterOptions}
                                            value={crossTabFilter}
                                            onChange={(_, newValue) => setCrossTabFilter(newValue)}
                                            noOptionsText="No options available"
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label={`Filter by ${crossTabFilterField === 'category' ? 'Category' : crossTabFilterField === 'brand' ? 'Brand' : 'P_Type'}`}
                                                    placeholder={crossTabFilter.length === 0 ? "All" : ""}
                                                    sx={{
                                                        minWidth: 200,
                                                        '& .MuiInputBase-root': {
                                                            fontSize: '0.75rem',
                                                            minHeight: 36,
                                                            bgcolor: isDarkMode ? '#1e293b' : '#fff',
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                        },
                                                        '& .MuiInputBase-input': {
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                            '&::placeholder': {
                                                                color: isDarkMode ? '#94a3b8' : '#9ca3af',
                                                                opacity: 1,
                                                            },
                                                        },
                                                        '& .MuiInputLabel-root': {
                                                            fontSize: '0.75rem',
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                            '&.Mui-focused': {
                                                                color: isDarkMode ? '#fca5a5' : '#dc2626',
                                                            },
                                                            '&.MuiInputLabel-shrink': {
                                                                color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                            },
                                                        },
                                                        '& .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: isDarkMode ? '#475569' : '#d1d5db',
                                                        },
                                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: isDarkMode ? '#f87171' : '#dc2626',
                                                        },
                                                        '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: isDarkMode ? '#f87171' : '#dc2626',
                                                        },
                                                        '& .MuiSvgIcon-root': {
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                        },
                                                    }}
                                                />
                                            )}
                                            renderTags={(value, getTagProps) =>
                                                value.map((option, index) => (
                                                    <Chip
                                                        {...getTagProps({ index })}
                                                        key={option}
                                                        label={option}
                                                        size="small"
                                                        sx={{
                                                            fontSize: '0.65rem',
                                                            height: 22,
                                                            bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.15)',
                                                            color: isDarkMode ? '#fca5a5' : '#dc2626',
                                                            '& .MuiChip-deleteIcon': {
                                                                color: isDarkMode ? '#f87171' : '#ef4444',
                                                                fontSize: '0.9rem',
                                                            },
                                                        }}
                                                    />
                                                ))
                                            }
                                            slotProps={{
                                                paper: {
                                                    sx: {
                                                        bgcolor: isDarkMode ? '#1e293b' : '#fff',
                                                        color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                        '& .MuiAutocomplete-option': {
                                                            fontSize: '0.75rem',
                                                            '&:hover': {
                                                                bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                                                            },
                                                            '&[aria-selected="true"]': {
                                                                bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
                                                            },
                                                        },
                                                        '& .MuiAutocomplete-noOptions': {
                                                            fontSize: '0.75rem',
                                                            color: isDarkMode ? '#94a3b8' : '#64748b',
                                                        },
                                                    },
                                                },
                                            }}
                                        />
                                        {crossTabFilter.length > 0 && (
                                            <Button
                                                size="small"
                                                onClick={() => setCrossTabFilter([])}
                                                sx={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    color: '#ef4444',
                                                    textTransform: 'none',
                                                    '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)' },
                                                }}
                                            >
                                                ✕ Clear
                                            </Button>
                                        )}
                                    </Box>
                                )}

                                {/* Combined View Filters */}
                                {pivotGroupBy === 'combined' && (
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        px: 2,
                                        py: 1.5,
                                        borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
                                        bgcolor: isDarkMode ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.03)',
                                        flexWrap: 'wrap',
                                    }}>
                                        <Typography sx={{ fontWeight: 600, color: isDarkMode ? '#6ee7b7' : '#059669', fontSize: '0.8rem' }}>
                                            🔍 Filters:
                                        </Typography>
                                        <Autocomplete
                                            multiple
                                            size="small"
                                            options={pivotFilterOptions.categories}
                                            value={pivotCategoryFilter}
                                            onChange={(_, newValue) => setPivotCategoryFilter(newValue)}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Category"
                                                    placeholder={pivotCategoryFilter.length === 0 ? "All" : ""}
                                                    sx={{
                                                        minWidth: 180,
                                                        '& .MuiInputBase-root': {
                                                            fontSize: '0.75rem',
                                                            minHeight: 36,
                                                            bgcolor: isDarkMode ? '#1e293b' : '#fff',
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                        },
                                                        '& .MuiInputBase-input': {
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                            '&::placeholder': {
                                                                color: isDarkMode ? '#94a3b8' : '#9ca3af',
                                                                opacity: 1,
                                                            },
                                                        },
                                                        '& .MuiInputLabel-root': {
                                                            fontSize: '0.75rem',
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                            '&.Mui-focused': {
                                                                color: isDarkMode ? '#a78bfa' : '#7c3aed',
                                                            },
                                                        },
                                                        '& .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: isDarkMode ? '#475569' : '#d1d5db',
                                                        },
                                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: isDarkMode ? '#7c3aed' : '#8b5cf6',
                                                        },
                                                        '& .MuiSvgIcon-root': {
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                        },
                                                    }}
                                                />
                                            )}
                                            renderTags={(value, getTagProps) =>
                                                value.map((option, index) => (
                                                    <Chip
                                                        {...getTagProps({ index })}
                                                        key={option}
                                                        label={option}
                                                        size="small"
                                                        sx={{
                                                            fontSize: '0.65rem',
                                                            height: 22,
                                                            bgcolor: isDarkMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.15)',
                                                            color: isDarkMode ? '#c4b5fd' : '#7c3aed',
                                                            '& .MuiChip-deleteIcon': {
                                                                color: isDarkMode ? '#a78bfa' : '#8b5cf6',
                                                                fontSize: '0.9rem',
                                                            },
                                                        }}
                                                    />
                                                ))
                                            }
                                            slotProps={{
                                                paper: {
                                                    sx: {
                                                        bgcolor: isDarkMode ? '#1e293b' : '#fff',
                                                        color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                        '& .MuiAutocomplete-option': {
                                                            fontSize: '0.75rem',
                                                            '&:hover': {
                                                                bgcolor: isDarkMode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
                                                            },
                                                            '&[aria-selected="true"]': {
                                                                bgcolor: isDarkMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)',
                                                            },
                                                        },
                                                    },
                                                },
                                            }}
                                        />
                                        <Autocomplete
                                            multiple
                                            size="small"
                                            options={pivotFilterOptions.brands}
                                            value={pivotBrandFilter}
                                            onChange={(_, newValue) => setPivotBrandFilter(newValue)}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Brand"
                                                    placeholder={pivotBrandFilter.length === 0 ? "All" : ""}
                                                    sx={{
                                                        minWidth: 180,
                                                        '& .MuiInputBase-root': {
                                                            fontSize: '0.75rem',
                                                            minHeight: 36,
                                                            bgcolor: isDarkMode ? '#1e293b' : '#fff',
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                        },
                                                        '& .MuiInputBase-input': {
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                            '&::placeholder': {
                                                                color: isDarkMode ? '#94a3b8' : '#9ca3af',
                                                                opacity: 1,
                                                            },
                                                        },
                                                        '& .MuiInputLabel-root': {
                                                            fontSize: '0.75rem',
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                            '&.Mui-focused': {
                                                                color: isDarkMode ? '#22d3ee' : '#0891b2',
                                                            },
                                                        },
                                                        '& .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: isDarkMode ? '#475569' : '#d1d5db',
                                                        },
                                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: isDarkMode ? '#06b6d4' : '#0891b2',
                                                        },
                                                        '& .MuiSvgIcon-root': {
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                        },
                                                    }}
                                                />
                                            )}
                                            renderTags={(value, getTagProps) =>
                                                value.map((option, index) => (
                                                    <Chip
                                                        {...getTagProps({ index })}
                                                        key={option}
                                                        label={option}
                                                        size="small"
                                                        sx={{
                                                            fontSize: '0.65rem',
                                                            height: 22,
                                                            bgcolor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(6, 182, 212, 0.15)',
                                                            color: isDarkMode ? '#67e8f9' : '#0891b2',
                                                            '& .MuiChip-deleteIcon': {
                                                                color: isDarkMode ? '#22d3ee' : '#06b6d4',
                                                                fontSize: '0.9rem',
                                                            },
                                                        }}
                                                    />
                                                ))
                                            }
                                            slotProps={{
                                                paper: {
                                                    sx: {
                                                        bgcolor: isDarkMode ? '#1e293b' : '#fff',
                                                        color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                        '& .MuiAutocomplete-option': {
                                                            fontSize: '0.75rem',
                                                            '&:hover': {
                                                                bgcolor: isDarkMode ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.1)',
                                                            },
                                                            '&[aria-selected="true"]': {
                                                                bgcolor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(6, 182, 212, 0.2)',
                                                            },
                                                        },
                                                    },
                                                },
                                            }}
                                        />
                                        <Autocomplete
                                            multiple
                                            size="small"
                                            options={pivotFilterOptions.pTypes}
                                            value={pivotPTypeFilter}
                                            onChange={(_, newValue) => setPivotPTypeFilter(newValue)}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="P_Type"
                                                    placeholder={pivotPTypeFilter.length === 0 ? "All" : ""}
                                                    sx={{
                                                        minWidth: 180,
                                                        '& .MuiInputBase-root': {
                                                            fontSize: '0.75rem',
                                                            minHeight: 36,
                                                            bgcolor: isDarkMode ? '#1e293b' : '#fff',
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                        },
                                                        '& .MuiInputBase-input': {
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                            '&::placeholder': {
                                                                color: isDarkMode ? '#94a3b8' : '#9ca3af',
                                                                opacity: 1,
                                                            },
                                                        },
                                                        '& .MuiInputLabel-root': {
                                                            fontSize: '0.75rem',
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                            '&.Mui-focused': {
                                                                color: isDarkMode ? '#fb923c' : '#ea580c',
                                                            },
                                                        },
                                                        '& .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: isDarkMode ? '#475569' : '#d1d5db',
                                                        },
                                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: isDarkMode ? '#f97316' : '#ea580c',
                                                        },
                                                        '& .MuiSvgIcon-root': {
                                                            color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                        },
                                                    }}
                                                />
                                            )}
                                            renderTags={(value, getTagProps) =>
                                                value.map((option, index) => (
                                                    <Chip
                                                        {...getTagProps({ index })}
                                                        key={option}
                                                        label={option}
                                                        size="small"
                                                        sx={{
                                                            fontSize: '0.65rem',
                                                            height: 22,
                                                            bgcolor: isDarkMode ? 'rgba(249, 115, 22, 0.3)' : 'rgba(249, 115, 22, 0.15)',
                                                            color: isDarkMode ? '#fdba74' : '#ea580c',
                                                            '& .MuiChip-deleteIcon': {
                                                                color: isDarkMode ? '#fb923c' : '#f97316',
                                                                fontSize: '0.9rem',
                                                            },
                                                        }}
                                                    />
                                                ))
                                            }
                                            slotProps={{
                                                paper: {
                                                    sx: {
                                                        bgcolor: isDarkMode ? '#1e293b' : '#fff',
                                                        color: isDarkMode ? '#e2e8f0' : 'inherit',
                                                        '& .MuiAutocomplete-option': {
                                                            fontSize: '0.75rem',
                                                            '&:hover': {
                                                                bgcolor: isDarkMode ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.1)',
                                                            },
                                                            '&[aria-selected="true"]': {
                                                                bgcolor: isDarkMode ? 'rgba(249, 115, 22, 0.3)' : 'rgba(249, 115, 22, 0.2)',
                                                            },
                                                        },
                                                    },
                                                },
                                            }}
                                        />
                                        {(pivotCategoryFilter.length > 0 || pivotBrandFilter.length > 0 || pivotPTypeFilter.length > 0) && (
                                            <Button
                                                size="small"
                                                onClick={() => {
                                                    setPivotCategoryFilter([]);
                                                    setPivotBrandFilter([]);
                                                    setPivotPTypeFilter([]);
                                                }}
                                                sx={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    color: '#ef4444',
                                                    textTransform: 'none',
                                                    '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)' },
                                                }}
                                            >
                                                ✕ Clear All
                                            </Button>
                                        )}
                                    </Box>
                                )}

                                {/* Cross-Tab View */}
                                {pivotGroupBy === 'crosstab' ? (
                                    crossTabPivotData.grandTotal === 0 ? (
                                        <Box sx={{ p: 4, textAlign: 'center' }}>
                                            <Typography color="text.secondary">
                                                {crossTabFilter.length > 0
                                                    ? 'No items match the selected filters.'
                                                    : 'No scanned items found. Start scanning WSNs to see cross-tab summary.'}
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <TableContainer sx={{ maxHeight: pivotDialogFullscreen ? 'calc(92vh - 220px)' : 500 }}>
                                            <Table stickyHeader size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell
                                                            sx={{
                                                                fontWeight: 700,
                                                                bgcolor: isDarkMode ? '#334155' : '#f1f5f9',
                                                                color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                                                borderRight: isDarkMode ? '2px solid #475569' : '2px solid #e2e8f0',
                                                                minWidth: 120,
                                                            }}
                                                        >
                                                            {crossTabRowField === 'category' ? '📁 Category' : crossTabRowField === 'brand' ? '🏷️ Brand' : '📦 P_Type'} ↓ / {crossTabColField === 'category' ? 'Category' : crossTabColField === 'brand' ? 'Brand' : 'P_Type'} →
                                                        </TableCell>
                                                        {crossTabPivotData.colHeaders.map((col) => (
                                                            <TableCell
                                                                key={col}
                                                                align="center"
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    bgcolor: isDarkMode ? '#334155' : '#f1f5f9',
                                                                    color: isDarkMode ? '#67e8f9' : '#0891b2',
                                                                    fontSize: '0.75rem',
                                                                    whiteSpace: 'nowrap',
                                                                }}
                                                            >
                                                                {col}
                                                            </TableCell>
                                                        ))}
                                                        <TableCell
                                                            align="center"
                                                            sx={{
                                                                fontWeight: 700,
                                                                bgcolor: isDarkMode ? '#374151' : '#e2e8f0',
                                                                color: isDarkMode ? '#f97316' : '#ea580c',
                                                                borderLeft: isDarkMode ? '2px solid #475569' : '2px solid #cbd5e1',
                                                            }}
                                                        >
                                                            Grand Total
                                                        </TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {crossTabPivotData.rowHeaders.map((row) => (
                                                        <TableRow key={row} hover>
                                                            <TableCell
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    color: isDarkMode ? '#c4b5fd' : '#7c3aed',
                                                                    fontSize: '0.8rem',
                                                                    borderRight: isDarkMode ? '2px solid #475569' : '2px solid #e2e8f0',
                                                                    bgcolor: isDarkMode ? 'rgba(139, 92, 246, 0.05)' : 'rgba(139, 92, 246, 0.03)',
                                                                }}
                                                            >
                                                                {row}
                                                            </TableCell>
                                                            {crossTabPivotData.colHeaders.map((col) => (
                                                                <TableCell
                                                                    key={col}
                                                                    align="center"
                                                                    sx={{
                                                                        fontSize: '0.8rem',
                                                                        color: crossTabPivotData.data[row][col] > 0
                                                                            ? (isDarkMode ? '#34d399' : '#059669')
                                                                            : (isDarkMode ? '#64748b' : '#94a3b8'),
                                                                        fontWeight: crossTabPivotData.data[row][col] > 0 ? 600 : 400,
                                                                    }}
                                                                >
                                                                    {crossTabPivotData.data[row][col] || '-'}
                                                                </TableCell>
                                                            ))}
                                                            <TableCell
                                                                align="center"
                                                                sx={{
                                                                    fontWeight: 700,
                                                                    color: isDarkMode ? '#f97316' : '#ea580c',
                                                                    borderLeft: isDarkMode ? '2px solid #475569' : '2px solid #cbd5e1',
                                                                    bgcolor: isDarkMode ? 'rgba(249, 115, 22, 0.08)' : 'rgba(249, 115, 22, 0.05)',
                                                                }}
                                                            >
                                                                {crossTabPivotData.rowTotals[row]}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {/* Grand Total Row */}
                                                    <TableRow sx={{
                                                        bgcolor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                                                        '& td': { borderTop: isDarkMode ? '2px solid #6366f1' : '2px solid #818cf8' },
                                                    }}>
                                                        <TableCell
                                                            sx={{
                                                                fontWeight: 700,
                                                                color: isDarkMode ? '#a5b4fc' : '#4f46e5',
                                                                borderRight: isDarkMode ? '2px solid #475569' : '2px solid #e2e8f0',
                                                            }}
                                                        >
                                                            Grand Total
                                                        </TableCell>
                                                        {crossTabPivotData.colHeaders.map((col) => (
                                                            <TableCell
                                                                key={col}
                                                                align="center"
                                                                sx={{
                                                                    fontWeight: 700,
                                                                    color: isDarkMode ? '#67e8f9' : '#0891b2',
                                                                }}
                                                            >
                                                                {crossTabPivotData.colTotals[col]}
                                                            </TableCell>
                                                        ))}
                                                        <TableCell
                                                            align="center"
                                                            sx={{
                                                                fontWeight: 700,
                                                                fontSize: '1rem',
                                                                color: 'white',
                                                                bgcolor: isDarkMode ? '#dc2626' : '#ef4444',
                                                                borderLeft: isDarkMode ? '2px solid #475569' : '2px solid #cbd5e1',
                                                            }}
                                                        >
                                                            {crossTabPivotData.grandTotal}
                                                        </TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )
                                ) : categoryPivotData.categories.length === 0 ? (
                                    <Box sx={{ p: 4, textAlign: 'center' }}>
                                        <Typography color="text.secondary">
                                            {pivotGroupBy === 'combined' && (pivotCategoryFilter.length > 0 || pivotBrandFilter.length > 0 || pivotPTypeFilter.length > 0)
                                                ? 'No items match the selected filters.'
                                                : `No scanned items found. Start scanning WSNs to see ${pivotGroupBy} summary.`}
                                        </Typography>
                                    </Box>
                                ) : (
                                    <TableContainer sx={{ maxHeight: pivotDialogFullscreen ? 'calc(92vh - 220px)' : 500 }}>
                                        <Table stickyHeader size="small">
                                            <TableHead>
                                                <TableRow>
                                                    {/* For combined view, show 3 columns */}
                                                    {pivotGroupBy === 'combined' ? (
                                                        <>
                                                            <TableCell
                                                                onClick={() => handleCategoryPivotSort('category')}
                                                                sx={{
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer',
                                                                    bgcolor: isDarkMode ? '#334155' : '#f1f5f9',
                                                                    color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                                                    '&:hover': { bgcolor: isDarkMode ? '#475569' : '#e2e8f0' },
                                                                    userSelect: 'none',
                                                                }}
                                                            >
                                                                Category {categoryPivotSortBy === 'category' && (categoryPivotSortDir === 'asc' ? '↑' : '↓')}
                                                            </TableCell>
                                                            <TableCell
                                                                sx={{
                                                                    fontWeight: 700,
                                                                    bgcolor: isDarkMode ? '#334155' : '#f1f5f9',
                                                                    color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                                                }}
                                                            >
                                                                Brand
                                                            </TableCell>
                                                            <TableCell
                                                                sx={{
                                                                    fontWeight: 700,
                                                                    bgcolor: isDarkMode ? '#334155' : '#f1f5f9',
                                                                    color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                                                }}
                                                            >
                                                                P_Type
                                                            </TableCell>
                                                        </>
                                                    ) : (
                                                        <TableCell
                                                            onClick={() => handleCategoryPivotSort('category')}
                                                            sx={{
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                bgcolor: isDarkMode ? '#334155' : '#f1f5f9',
                                                                color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                                                '&:hover': { bgcolor: isDarkMode ? '#475569' : '#e2e8f0' },
                                                                userSelect: 'none',
                                                            }}
                                                        >
                                                            {pivotGroupBy === 'brand' ? 'Brand' : pivotGroupBy === 'p_type' ? 'P_Type' : 'Category'} {categoryPivotSortBy === 'category' && (categoryPivotSortDir === 'asc' ? '↑' : '↓')}
                                                        </TableCell>
                                                    )}
                                                    <TableCell
                                                        align="right"
                                                        onClick={() => handleCategoryPivotSort('qty')}
                                                        sx={{
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            bgcolor: isDarkMode ? '#334155' : '#f1f5f9',
                                                            color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                                            '&:hover': { bgcolor: isDarkMode ? '#475569' : '#e2e8f0' },
                                                            userSelect: 'none',
                                                        }}
                                                    >
                                                        Qty {categoryPivotSortBy === 'qty' && (categoryPivotSortDir === 'asc' ? '↑' : '↓')}
                                                    </TableCell>
                                                    <TableCell
                                                        align="right"
                                                        onClick={() => handleCategoryPivotSort('fsp')}
                                                        sx={{
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            bgcolor: isDarkMode ? '#334155' : '#f1f5f9',
                                                            color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                                            '&:hover': { bgcolor: isDarkMode ? '#475569' : '#e2e8f0' },
                                                            userSelect: 'none',
                                                        }}
                                                    >
                                                        Total FSP {categoryPivotSortBy === 'fsp' && (categoryPivotSortDir === 'asc' ? '↑' : '↓')}
                                                    </TableCell>
                                                    <TableCell
                                                        align="right"
                                                        onClick={() => handleCategoryPivotSort('mrp')}
                                                        sx={{
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            bgcolor: isDarkMode ? '#334155' : '#f1f5f9',
                                                            color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                                            '&:hover': { bgcolor: isDarkMode ? '#475569' : '#e2e8f0' },
                                                            userSelect: 'none',
                                                        }}
                                                    >
                                                        Total MRP {categoryPivotSortBy === 'mrp' && (categoryPivotSortDir === 'asc' ? '↑' : '↓')}
                                                    </TableCell>
                                                    <TableCell
                                                        align="center"
                                                        sx={{
                                                            fontWeight: 700,
                                                            bgcolor: isDarkMode ? '#334155' : '#f1f5f9',
                                                            color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                                        }}
                                                    >
                                                        %
                                                    </TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {categoryPivotData.categories.map((cat, idx) => (
                                                    <TableRow
                                                        key={cat.category}
                                                        sx={{
                                                            '&:nth-of-type(odd)': { bgcolor: isDarkMode ? 'rgba(51, 65, 85, 0.3)' : 'rgba(241, 245, 249, 0.5)' },
                                                            '&:hover': { bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)' },
                                                        }}
                                                    >
                                                        {/* For combined view, show 3 columns */}
                                                        {pivotGroupBy === 'combined' ? (
                                                            <>
                                                                <TableCell sx={{
                                                                    fontWeight: 600,
                                                                    color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                                                }}>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <Box
                                                                            sx={{
                                                                                width: 8,
                                                                                height: 8,
                                                                                borderRadius: '50%',
                                                                                bgcolor: [
                                                                                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                                                                                    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
                                                                                ][idx % 10],
                                                                            }}
                                                                        />
                                                                        {cat.categoryName}
                                                                    </Box>
                                                                </TableCell>
                                                                <TableCell sx={{
                                                                    fontWeight: 600,
                                                                    color: isDarkMode ? '#67e8f9' : '#0891b2',
                                                                }}>
                                                                    {cat.brandName}
                                                                </TableCell>
                                                                <TableCell sx={{
                                                                    fontWeight: 600,
                                                                    color: isDarkMode ? '#fdba74' : '#ea580c',
                                                                }}>
                                                                    {cat.pTypeName}
                                                                </TableCell>
                                                            </>
                                                        ) : (
                                                            <TableCell sx={{
                                                                fontWeight: 600,
                                                                color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                                            }}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <Box
                                                                        sx={{
                                                                            width: 8,
                                                                            height: 8,
                                                                            borderRadius: '50%',
                                                                            bgcolor: [
                                                                                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                                                                                '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
                                                                            ][idx % 10],
                                                                        }}
                                                                    />
                                                                    {cat.category}
                                                                </Box>
                                                            </TableCell>
                                                        )}
                                                        <TableCell align="right" sx={{
                                                            fontWeight: 700,
                                                            color: isDarkMode ? '#60a5fa' : '#2563eb',
                                                            fontSize: '0.95rem',
                                                        }}>
                                                            {cat.qty.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{
                                                            color: isDarkMode ? '#4ade80' : '#16a34a',
                                                            fontWeight: 600,
                                                        }}>
                                                            ₹{cat.fsp.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{
                                                            color: isDarkMode ? '#f97316' : '#ea580c',
                                                            fontWeight: 600,
                                                        }}>
                                                            ₹{cat.mrp.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Box sx={{
                                                                    flex: 1,
                                                                    height: 6,
                                                                    bgcolor: isDarkMode ? '#334155' : '#e2e8f0',
                                                                    borderRadius: 3,
                                                                    overflow: 'hidden',
                                                                }}>
                                                                    <Box sx={{
                                                                        width: `${cat.percentage}%`,
                                                                        height: '100%',
                                                                        bgcolor: [
                                                                            '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                                                                            '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
                                                                        ][idx % 10],
                                                                        borderRadius: 3,
                                                                    }} />
                                                                </Box>
                                                                <Typography sx={{
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 600,
                                                                    color: isDarkMode ? '#94a3b8' : '#64748b',
                                                                    minWidth: 45,
                                                                }}>
                                                                    {cat.percentage.toFixed(1)}%
                                                                </Typography>
                                                            </Box>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {/* Grand Total Row */}
                                                <TableRow sx={{
                                                    bgcolor: isDarkMode ? '#1e3a5f' : '#1e40af',
                                                    '& td': { borderBottom: 'none' },
                                                }}>
                                                    <TableCell sx={{
                                                        fontWeight: 800,
                                                        color: 'white',
                                                        fontSize: '0.95rem',
                                                    }}>
                                                        GRAND TOTAL
                                                    </TableCell>
                                                    {/* Empty cells for combined view extra columns */}
                                                    {pivotGroupBy === 'combined' && (
                                                        <>
                                                            <TableCell sx={{ color: 'white' }}></TableCell>
                                                            <TableCell sx={{ color: 'white' }}></TableCell>
                                                        </>
                                                    )}
                                                    <TableCell align="right" sx={{
                                                        fontWeight: 800,
                                                        color: 'white',
                                                        fontSize: '1.1rem',
                                                    }}>
                                                        {categoryPivotData.grandTotal.qty.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{
                                                        fontWeight: 700,
                                                        color: '#4ade80',
                                                    }}>
                                                        ₹{categoryPivotData.grandTotal.fsp.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{
                                                        fontWeight: 700,
                                                        color: '#fbbf24',
                                                    }}>
                                                        ₹{categoryPivotData.grandTotal.mrp.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{
                                                        fontWeight: 700,
                                                        color: 'white',
                                                    }}>
                                                        100%
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </DialogContent>
                            <DialogActions sx={{ p: 2, borderTop: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
                                <Button
                                    onClick={exportCategoryPivotToExcel}
                                    startIcon={<DownloadIcon />}
                                    disabled={pivotGroupBy === 'crosstab' ? crossTabPivotData.grandTotal === 0 : categoryPivotData.categories.length === 0}
                                    sx={{
                                        color: '#10b981',
                                        fontWeight: 600,
                                        '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.08)' },
                                    }}
                                >
                                    Export to Excel
                                </Button>
                                <Button
                                    onClick={() => setCategoryPivotOpen(false)}
                                    variant="contained"
                                    sx={{
                                        background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                                        fontWeight: 700,
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)',
                                        }
                                    }}
                                >
                                    Close
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {multiErrorMessage && (
                            <Alert severity="error" sx={{ mb: 0.5, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600 }} onClose={() => setMultiErrorMessage('')}>
                                {multiErrorMessage}
                            </Alert>
                        )}

                        {/* AG Grid - Professional Excel-like styling */}
                        <Box sx={{
                            flex: 1,
                            minHeight: 0,
                            borderRadius: '6px',
                            overflow: 'hidden',
                            border: isDarkMode ? '1px solid #334155' : '2px solid #94a3b8',
                            bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
                            boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.12)',
                            '& .ag-root-wrapper': { borderRadius: 0, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', border: 'none' },

                            // Professional dark header
                            '& .ag-header': {
                                backgroundColor: isDarkMode ? '#1e3a5f' : '#1e3a5f',
                                borderBottom: isDarkMode ? '2px solid #2563eb' : '2px solid #1e40af',
                            },
                            '& .ag-header-cell': {
                                backgroundColor: isDarkMode ? '#1e3a5f' : '#1e3a5f',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: '11px',
                                padding: '0 8px',
                                borderRight: '1px solid #3b5998',
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                            },
                            '& .ag-header-cell:last-child': { borderRight: 'none' },
                            '& .ag-header-cell-label': { color: '#ffffff' },
                            '& .ag-icon': { color: '#94a3b8' },
                            '& .ag-header-icon': { color: '#94a3b8' },

                            // Excel-style cells with visible borders
                            '& .ag-cell': {
                                borderRight: isDarkMode ? '1px solid #334155' : '1px solid #cbd5e1',
                                fontSize: '12px',
                                padding: '0 8px',
                                display: 'flex',
                                alignItems: 'center',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                color: isDarkMode ? '#f1f5f9' : '#1e293b',
                            },
                            '& .ag-cell:last-child': { borderRight: isDarkMode ? 'none' : '1px solid #cbd5e1' },

                            // Professional rows with visible borders
                            '& .ag-row': { height: 36, overflow: 'visible', borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #cbd5e1' },
                            '& .ag-row-even': { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' },
                            '& .ag-row-odd': { backgroundColor: isDarkMode ? '#1a2536' : '#f1f5f9' },

                            // Active cell focus - Enhanced for dark mode with strong visibility
                            '& .ag-cell-focus, & .ag-cell.ag-cell-focus': {
                                border: isDarkMode ? '2px solid #22d3ee !important' : '2px solid #2563eb !important',
                                outline: 'none !important',
                                boxShadow: isDarkMode ? '0 0 12px rgba(34, 211, 238, 0.6), inset 0 0 8px rgba(34, 211, 238, 0.15)' : '0 0 0 2px rgba(37, 99, 235, 0.3)',
                                backgroundColor: isDarkMode ? 'rgba(34, 211, 238, 0.15) !important' : 'rgba(37, 99, 235, 0.08) !important',
                                zIndex: 1,
                            },
                            // Cell being edited
                            '& .ag-cell-inline-editing': {
                                border: isDarkMode ? '2px solid #22d3ee !important' : '2px solid #2563eb !important',
                                backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important',
                                boxShadow: isDarkMode ? '0 0 16px rgba(34, 211, 238, 0.5)' : '0 0 8px rgba(37, 99, 235, 0.3)',
                            },
                            '& .ag-cell-range-selected': { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.25) !important' : '#dbeafe !important' },
                            '& .ag-cell-range-single-cell': { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2) !important' : '#eff6ff !important' },

                            // ⚡ EXCEL-LIKE: Custom range selection CSS classes - Enhanced visibility for dark mode
                            '& .custom-range-selected': {
                                backgroundColor: isDarkMode ? 'rgba(34, 211, 238, 0.25) !important' : 'rgba(37, 99, 235, 0.15) !important',
                            },
                            '& .custom-range-top': {
                                borderTop: isDarkMode ? '3px solid #22d3ee !important' : '3px solid #2563eb !important',
                            },
                            '& .custom-range-bottom': {
                                borderBottom: isDarkMode ? '3px solid #22d3ee !important' : '3px solid #2563eb !important',
                            },
                            '& .custom-range-left': {
                                borderLeft: isDarkMode ? '3px solid #22d3ee !important' : '3px solid #2563eb !important',
                            },
                            '& .custom-range-right': {
                                borderRight: isDarkMode ? '3px solid #22d3ee !important' : '3px solid #2563eb !important',
                            },

                            '& .ag-row-hover': { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.12) !important' : '#e0f2fe !important' },
                        }}>
                            <AgGridReact
                                ref={gridRef}
                                className="ag-theme-quartz"
                                containerStyle={{ height: '100%', width: '100%', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }}
                                rowData={multiRows}
                                columnDefs={columnDefs}
                                rowHeight={tableRowHeight}
                                headerHeight={32}
                                defaultColDef={defaultColDef}
                                onCellValueChanged={onCellValueChanged}
                                onCellEditingStopped={async (event: any) => {
                                    const field = event.colDef?.field;
                                    const value = event.value;
                                    const oldValue = event.oldValue;
                                    const node = event.node;
                                    const rowIndex = event.rowIndex;

                                    if (field !== 'wsn') return;

                                    const wsn = value?.trim()?.toUpperCase();
                                    const existingWSN = oldValue?.trim()?.toUpperCase();

                                    // ====== WSN OVERWRITE CHECK ======
                                    // If user is replacing a valid WSN with a different valid WSN, show warning dialog
                                    if (existingWSN && wsn && existingWSN !== wsn) {
                                        // Revert cell to original value until user confirms
                                        node.setDataValue('wsn', existingWSN);
                                        // Store pending WSN data
                                        pendingWSNRef.current = { wsn, rowIndex, params: event };
                                        // Show dialog with existing product info
                                        setWsnOverwriteDialog({
                                            open: true,
                                            existingWSN,
                                            newWSN: wsn,
                                            existingData: {
                                                product_title: node.data?.product_title || '',
                                                brand: node.data?.brand || '',
                                                mrp: node.data?.mrp || '',
                                                fsp: node.data?.fsp || '',
                                            },
                                            rowIndex
                                        });
                                        return;
                                    }
                                }}
                                getRowStyle={getRowStyle}
                                getRowId={(params: any) => params.data._rowId}
                                navigateToNextCell={navigateToNextCell}
                                stopEditingWhenCellsLoseFocus={true}
                                enterNavigatesVertically={true}
                                enterNavigatesVerticallyAfterEdit={true}
                                ensureDomOrder={true}
                                suppressMovableColumns={true}

                                // ⚡ EXCEL-LIKE: Mouse events for drag selection
                                onCellMouseDown={(event) => {
                                    const rowIndex = event.rowIndex;
                                    const colId = event.column?.getColId();
                                    if (rowIndex === null || rowIndex === undefined || !colId) return;
                                    const browserEvent = event.event as MouseEvent;
                                    // Pass mouse button to handler (0 = left, 1 = middle, 2 = right)
                                    handleCellMouseDown(rowIndex, colId, browserEvent?.shiftKey || false, browserEvent?.button ?? 0);
                                }}
                                onCellMouseOver={(event) => {
                                    const rowIndex = event.rowIndex;
                                    const colId = event.column?.getColId();
                                    if (rowIndex === null || rowIndex === undefined || !colId) return;
                                    const browserEvent = event.event as MouseEvent;
                                    // Pass buttons (bitmask of currently pressed buttons: 1=left, 2=right, 4=middle)
                                    handleCellMouseOver(rowIndex, colId, browserEvent?.buttons ?? 0);
                                }}
                                onCellClicked={(event) => {
                                    const rowIndex = event.rowIndex;
                                    const colId = event.column?.getColId();
                                    if (rowIndex === null || rowIndex === undefined || !colId) return;
                                    const browserEvent = event.event as MouseEvent;
                                    handleCellClick(rowIndex, colId, browserEvent?.shiftKey || false);
                                }}

                                // ⚡ SMOOTH SCROLL: Detect user manual scroll
                                onBodyScroll={(event) => {
                                    if (!isAutoScrollingRef.current) {
                                        const currentScrollTop = event.top;
                                        const scrollDelta = Math.abs(currentScrollTop - lastGridScrollTopRef.current);
                                        if (scrollDelta > 10) {
                                            userScrolledRef.current = true;
                                            if (userScrollTimeoutRef.current) window.clearTimeout(userScrollTimeoutRef.current);
                                            userScrollTimeoutRef.current = setTimeout(() => {
                                                userScrolledRef.current = false;
                                            }, 1500) as unknown as number;
                                            lastGridScrollTopRef.current = currentScrollTop;
                                        }
                                    }
                                }}

                                // ⚡ PERFORMANCE: Optimizations for smooth fast scrolling
                                rowBuffer={100}
                                suppressRowTransform={true}
                                alwaysShowVerticalScroll={true}
                                animateRows={false}
                                suppressScrollOnNewData={true}
                                debounceVerticalScrollbar={true}
                                suppressPropertyNamesCheck={true}
                                valueCache={true}
                                suppressCellFocus={false}
                                suppressRowHoverHighlight={false}
                                suppressColumnVirtualisation={false}
                                suppressRowVirtualisation={false}
                                suppressAnimationFrame={true}

                                // ✅ Save column widths when resized (matching inbound pattern)
                                onColumnResized={(params: any) => {
                                    if (params.finished && params.column) {
                                        const colId = params.column.getColId();
                                        const newWidth = params.column.getActualWidth();
                                        // Don't save special columns
                                        if (colId === '__sr') return;

                                        setMultiColumnWidths(prev => {
                                            const updated = { ...prev, [colId]: newWidth };
                                            localStorage.setItem('outboundMultiEntryColumnWidths', JSON.stringify(updated));
                                            return updated;
                                        });
                                    }
                                }}
                                onGridReady={(params: any) => {
                                    columnApiRef.current = params.columnApi;
                                    // Column widths are now baked into columnDefs via multiColumnWidths state
                                    // No need to apply column state here - widths are already set
                                }}
                            // Removed onFirstDataRendered and onGridSizeChanged auto-sizing to preserve user column widths
                            />
                        </Box>

                        {/* DRAFT STATUS + ACTIONS + SUBMIT */}
                        {/* MOBILE: Scrollable Actions + Fixed Submit */}
                        <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 0.5, py: 0.5, flexShrink: 0 }}>
                            {/* Left: Scrollable Actions with Arrow Indicators */}
                            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                {/* Left Arrow */}
                                <Box sx={{ width: 16, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDarkMode ? '#64748b' : '#94a3b8', fontSize: '0.65rem', flexShrink: 0 }}>◀</Box>

                                {/* Scrollable Container */}
                                <Box
                                    sx={{
                                        flex: 1,
                                        minWidth: 0,
                                        overflowX: 'auto',
                                        overflowY: 'hidden',
                                        WebkitOverflowScrolling: 'touch',
                                        scrollbarWidth: 'none',
                                        '&::-webkit-scrollbar': { display: 'none' },
                                    }}
                                >
                                    <Stack direction="row" spacing={0.5} sx={{ width: 'max-content', alignItems: 'center' }}>
                                        <Chip
                                            icon={<AccessTime sx={{ fontSize: 14 }} />}
                                            label={draftSavedAt ? new Date(draftSavedAt).toLocaleTimeString() : 'No draft'}
                                            color={draftExists ? 'success' : 'default'}
                                            size="small"
                                            sx={{ height: 32, fontSize: '0.7rem', '& .MuiChip-icon': { ml: 0.5 } }}
                                        />
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => saveDraftImmediate()}
                                            disabled={draftSaving}
                                            sx={{ height: 32, minWidth: 'auto', px: 1, fontSize: '0.7rem', fontWeight: 600 }}
                                        >
                                            💾 Save
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={clearDraft}
                                            disabled={!draftExists}
                                            sx={{ height: 32, minWidth: 'auto', px: 1, fontSize: '0.7rem', fontWeight: 600, borderColor: '#ef4444', color: '#ef4444', '&:hover': { borderColor: '#dc2626', bgcolor: 'rgba(239,68,68,0.08)' } }}
                                        >
                                            🗑️ Clear
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={add500Rows}
                                            sx={{ height: 32, minWidth: 'auto', px: 1, fontSize: '0.7rem', fontWeight: 600, borderColor: '#3b82f6', color: '#3b82f6', '&:hover': { borderColor: '#2563eb', bgcolor: 'rgba(59,130,246,0.08)' } }}
                                        >
                                            ➕ 500
                                        </Button>
                                    </Stack>
                                </Box>

                                {/* Right Arrow */}
                                <Box sx={{ width: 16, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDarkMode ? '#64748b' : '#94a3b8', fontSize: '0.65rem', flexShrink: 0 }}>▶</Box>
                            </Box>
                            {/* Right: Fixed Submit Button */}
                            <Button
                                variant="contained"
                                onClick={handleMultiSubmit}
                                disabled={multiLoading || !activeWarehouse || duplicateWSNs.size > 0}
                                startIcon={multiLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <CheckCircle sx={{ fontSize: 16 }} />}
                                sx={{
                                    flexShrink: 0,
                                    height: 36,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    px: 1.5,
                                    minWidth: 100,
                                    background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                                    boxShadow: 'none',
                                    '&:hover': { boxShadow: 'none' }
                                }}
                            >
                                SUBMIT ({multiRows.filter((r) => r.wsn?.trim()).length})
                            </Button>
                        </Box>

                        {/* DESKTOP: Original Layout */}
                        <Box sx={{
                            display: { xs: 'none', md: 'flex' },
                            alignItems: 'center',
                            gap: { xs: 0.5, sm: 1 },
                            py: 0.5,
                            flexWrap: 'wrap',
                            flexShrink: 0
                        }}>
                            {/* ⚡ EXCEL-LIKE: Selection Statistics (Sum, Count, Average) */}
                            {selectionStats && selectionStats.numericCount > 0 && (
                                <Chip
                                    size="small"
                                    sx={{
                                        height: 28,
                                        bgcolor: isDarkMode ? 'rgba(34, 211, 238, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                                        border: `1px solid ${isDarkMode ? '#22d3ee' : '#3b82f6'}`,
                                        '& .MuiChip-label': { fontWeight: 600, fontSize: '0.7rem' }
                                    }}
                                    label={
                                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                                            <span style={{ color: isDarkMode ? '#22d3ee' : '#2563eb' }}>
                                                Sum: ₹{selectionStats.sum.toLocaleString()}
                                            </span>
                                            <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>|</span>
                                            <span style={{ color: isDarkMode ? '#a78bfa' : '#7c3aed' }}>
                                                Avg: ₹{selectionStats.average.toLocaleString()}
                                            </span>
                                            <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>|</span>
                                            <span style={{ color: isDarkMode ? '#4ade80' : '#16a34a' }}>
                                                Count: {selectionStats.numericCount}
                                            </span>
                                        </Box>
                                    }
                                />
                            )}

                            <Chip
                                label={draftSavedAt ? `Draft saved ${new Date(draftSavedAt).toLocaleTimeString()}` : 'No draft'}
                                color={draftExists ? 'success' : 'default'}
                                size="small"
                                sx={{ height: 28 }}
                            />
                            <Button size="small" variant="outlined" onClick={() => saveDraftImmediate()} disabled={draftSaving} sx={{ height: 32, fontSize: '0.75rem' }}>Save Draft</Button>
                            <Button size="small" variant="text" onClick={clearDraft} disabled={!draftExists} sx={{ height: 32, fontSize: '0.75rem' }}>Clear Draft</Button>

                            {/* +500 ROWS BUTTON - Desktop only */}
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={add500Rows}
                                sx={{
                                    display: { xs: 'none', md: 'flex' },
                                    height: 32,
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    borderColor: '#3b82f6',
                                    color: '#3b82f6',
                                    '&:hover': {
                                        borderColor: '#2563eb',
                                        bgcolor: 'rgba(59, 130, 246, 0.1)'
                                    }
                                }}
                            >
                                +500 Rows
                            </Button>

                            <Button
                                variant="contained"
                                onClick={handleMultiSubmit}
                                disabled={multiLoading || !activeWarehouse || duplicateWSNs.size > 0}
                                startIcon={multiLoading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <CheckCircle sx={{ fontSize: 18 }} />}
                                sx={{
                                    ml: 'auto',
                                    height: 38,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    minWidth: { xs: 150, sm: 200 },
                                    background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)'
                                }}
                            >
                                SUBMIT ALL ({multiRows.filter((r) => r.wsn?.trim()).length} rows)
                            </Button>
                        </Box>
                    </Box>
                )}

                {/* Column Settings Dialog - Outside flex container */}
                <Dialog open={columnSettingsOpen} onClose={() => setColumnSettingsOpen(false)} maxWidth="sm" fullWidth container={isFullscreen ? multiEntryContainerRef.current : undefined}>
                    <DialogTitle>⚙️ Columns View Settings</DialogTitle>
                    <DialogContent>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                            Editable: {EDITABLE_COLUMNS.join(', ')}
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6b21a8', mb: 1 }}>EDITABLE FIELDS</Typography>
                        <Stack spacing={1} sx={{ mb: 2 }}>
                            {EDITABLE_COLUMNS.map((col) => (
                                <FormControlLabel
                                    key={col}
                                    control={
                                        <Checkbox
                                            checked={visibleColumns.includes(col)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    saveColumnSettings([...visibleColumns, col]);
                                                } else {
                                                    saveColumnSettings(visibleColumns.filter((c) => c !== col));
                                                }
                                            }}
                                        />
                                    }
                                    label={col.replace(/_/g, ' ').toUpperCase()}
                                />
                            ))}
                        </Stack>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6b21a8', mb: 1 }}>READ-ONLY MASTER DATA</Typography>
                        <Stack spacing={1} sx={{ mt: 1 }}>
                            {ALL_MULTI_COLUMNS.filter((col) => !EDITABLE_COLUMNS.includes(col)).map((col) => (
                                <FormControlLabel
                                    key={col}
                                    control={
                                        <Checkbox
                                            checked={visibleColumns.includes(col)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    saveColumnSettings([...visibleColumns, col]);
                                                } else {
                                                    saveColumnSettings(visibleColumns.filter((c) => c !== col));
                                                }
                                            }}
                                        />
                                    }
                                    label={col.replace(/_/g, ' ').toUpperCase()}
                                />
                            ))}
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ justifyContent: 'space-between' }}>
                        <Button onClick={() => setColumnSettingsOpen(false)}>CLOSE</Button>
                        <Button onClick={() => setColumnSettingsOpen(false)} variant="contained" sx={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: '#fff' }}>DONE</Button>
                    </DialogActions>
                </Dialog>

                {/* ====== TAB 4: BATCH MANAGEMENT ====== */}
                {currentTabCode === 'batches' && (
                    <BatchManagementTab
                        batches={batches}
                        loading={batchLoading}
                        onRefresh={loadBatches}
                        onDelete={canSeeButton('batches:delete') ? handleDeleteBatch : undefined}
                        onView={handleViewBatch}
                        canDelete={canSeeButton('batches:delete')}
                        canView={true}
                        title="Batch Management"
                        emptyMessage="No batches found"
                        emptySubMessage="Batches will appear here after outbound operations"
                    />
                )}

                {/* ================= LIST OPTIONS PANEL DRAWER ================= */}
                <Drawer
                    anchor="right"
                    open={listOptionsPanelOpen}
                    onClose={() => setListOptionsPanelOpen(false)}
                    PaperProps={{
                        sx: {
                            width: { xs: '85%', sm: 380 },
                            maxWidth: '100vw',
                            bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
                            borderLeft: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0'
                        }
                    }}
                >
                    {/* Panel Header */}
                    <Box sx={{
                        p: 2,
                        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10
                    }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>🔍 Options</Typography>
                        <IconButton size="small" onClick={() => setListOptionsPanelOpen(false)} sx={{ color: 'white' }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {/* Panel Content with Accordions */}
                    <Box sx={{ overflow: 'auto', flex: 1 }}>

                        {/* ═══════════ FILTERS ACCORDION ═══════════ */}
                        <Accordion
                            expanded={listSettingsPanelExpanded === 'filters'}
                            onChange={(_, isExpanded) => setListSettingsPanelExpanded(isExpanded ? 'filters' : false)}
                            disableGutters
                            sx={{
                                bgcolor: 'transparent',
                                boxShadow: 'none',
                                '&:before': { display: 'none' },
                                borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0'
                            }}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon sx={{ color: isDarkMode ? '#94a3b8' : '#64748b' }} />}
                                sx={{
                                    px: 2,
                                    minHeight: 56,
                                    '&.Mui-expanded': { minHeight: 56 },
                                    '& .MuiAccordionSummary-content': { my: 1.5 }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <FilterListIcon sx={{ color: '#3b82f6', fontSize: 22 }} />
                                    <Box>
                                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>Filters</Typography>
                                        <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                                            {filtersActive ? 'Active filters applied' : 'No filters applied'}
                                        </Typography>
                                    </Box>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                                <Stack spacing={1.5}>
                                    {/* Date Filters */}
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <TextField
                                            label="From Date"
                                            type="date"
                                            size="small"
                                            InputLabelProps={{ shrink: true }}
                                            value={startDateFilter || ''}
                                            onChange={(e) => { setStartDateFilter(e.target.value); setPage(1); }}
                                            fullWidth
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    height: 40,
                                                    bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                                                }
                                            }}
                                        />
                                        <TextField
                                            label="To Date"
                                            type="date"
                                            size="small"
                                            InputLabelProps={{ shrink: true }}
                                            value={endDateFilter || ''}
                                            onChange={(e) => { setEndDateFilter(e.target.value); setPage(1); }}
                                            fullWidth
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    height: 40,
                                                    bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                                                }
                                            }}
                                        />
                                    </Box>

                                    {/* Source Filter */}
                                    <TextField
                                        select
                                        size="small"
                                        label="Source"
                                        value={sourceFilter}
                                        onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                                        fullWidth
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                height: 40,
                                                bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                                            }
                                        }}
                                    >
                                        <MenuItem value="">All Sources</MenuItem>
                                        {sources.map((s) => (
                                            <MenuItem key={s} value={s}>{s}</MenuItem>
                                        ))}
                                    </TextField>

                                    {/* Customer Filter */}
                                    <Autocomplete
                                        freeSolo
                                        options={customers}
                                        value={customerFilter}
                                        onChange={(event, newValue) => { setCustomerFilter(newValue || ''); setPage(1); }}
                                        onInputChange={(event, newInputValue) => { setCustomerFilter(newInputValue); setPage(1); }}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Customer"
                                                size="small"
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        height: 40,
                                                        bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                                                    }
                                                }}
                                            />
                                        )}
                                        size="small"
                                        noOptionsText={customers.length === 0 ? "No customers available" : "No matching customers"}
                                    />

                                    {/* Brand Filter */}
                                    <TextField
                                        select
                                        size="small"
                                        label="Brand"
                                        value={brandFilter}
                                        onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                                        fullWidth
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                height: 40,
                                                bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                                            }
                                        }}
                                    >
                                        <MenuItem value="">All Brands</MenuItem>
                                        {(filteredBrands.length > 0 ? filteredBrands : brands).map((b) => (
                                            <MenuItem key={b} value={b}>{b}</MenuItem>
                                        ))}
                                    </TextField>

                                    {/* Category Filter */}
                                    <TextField
                                        select
                                        size="small"
                                        label="Category"
                                        value={categoryFilter}
                                        onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                                        fullWidth
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                height: 40,
                                                bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                                            }
                                        }}
                                    >
                                        <MenuItem value="">All Categories</MenuItem>
                                        {(filteredCategories.length > 0 ? filteredCategories : categories).map((c) => (
                                            <MenuItem key={c} value={c}>{c}</MenuItem>
                                        ))}
                                    </TextField>

                                    {/* Batch Filter */}
                                    <TextField
                                        select
                                        size="small"
                                        label="Batch ID"
                                        value={batchFilter}
                                        onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }}
                                        fullWidth
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                height: 40,
                                                bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                                            }
                                        }}
                                    >
                                        <MenuItem value="">All Batches</MenuItem>
                                        {batches.map((b: any) => (
                                            <MenuItem key={b.batch_id} value={b.batch_id}>{b.batch_id} {b.count ? `(${b.count})` : null}</MenuItem>
                                        ))}
                                    </TextField>
                                </Stack>
                            </AccordionDetails>
                        </Accordion>

                        {/* ═══════════ COLUMNS ACCORDION ═══════════ */}
                        {canSeeButton('list:columns') && (
                            <Accordion
                                expanded={listSettingsPanelExpanded === 'columns'}
                                onChange={(_, isExpanded) => setListSettingsPanelExpanded(isExpanded ? 'columns' : false)}
                                disableGutters
                                sx={{
                                    bgcolor: 'transparent',
                                    boxShadow: 'none',
                                    '&:before': { display: 'none' },
                                    borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0'
                                }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon sx={{ color: isDarkMode ? '#94a3b8' : '#64748b' }} />}
                                    sx={{
                                        px: 2,
                                        minHeight: 56,
                                        '&.Mui-expanded': { minHeight: 56 },
                                        '& .MuiAccordionSummary-content': { my: 1.5 }
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <ViewColumnIcon sx={{ color: '#10b981', fontSize: 22 }} />
                                        <Box>
                                            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>Columns</Typography>
                                            <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                                                {listColumns.length} of {ALL_LIST_COLUMNS.length} visible
                                            </Typography>
                                        </Box>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                                    {!canAccessButton('list:columns') ? (
                                        <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>
                                            You don't have permission to manage columns
                                        </Alert>
                                    ) : (
                                        <Box sx={{ maxHeight: 280, overflow: 'auto', pr: 1 }}>
                                            <Stack spacing={0.5}>
                                                {ALL_LIST_COLUMNS.map((col) => (
                                                    <FormControlLabel
                                                        key={col}
                                                        control={
                                                            <Checkbox
                                                                size="small"
                                                                checked={listColumns.includes(col)}
                                                                onChange={() => {
                                                                    let next: string[];
                                                                    if (listColumns.includes(col)) {
                                                                        next = listColumns.filter((c: string) => c !== col);
                                                                    } else {
                                                                        next = [...listColumns, col];
                                                                    }
                                                                    // Maintain order using ALL_LIST_COLUMNS
                                                                    const ordered = ALL_LIST_COLUMNS.filter((c) => next.includes(c));
                                                                    saveListColumnSettings(ordered);
                                                                }}
                                                                sx={{ py: 0.25, '&.Mui-checked': { color: '#10b981' } }}
                                                            />
                                                        }
                                                        label={
                                                            <Typography sx={{ fontSize: '0.8rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                                                                {col.replace(/_/g, ' ').toUpperCase()}
                                                            </Typography>
                                                        }
                                                        sx={{ m: 0 }}
                                                    />
                                                ))}
                                            </Stack>
                                        </Box>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        )}

                        {/* ═══════════ GRID SETTINGS ACCORDION ═══════════ */}
                        <Accordion
                            expanded={listSettingsPanelExpanded === 'grid'}
                            onChange={(_, isExpanded) => setListSettingsPanelExpanded(isExpanded ? 'grid' : false)}
                            disableGutters
                            sx={{
                                bgcolor: 'transparent',
                                boxShadow: 'none',
                                '&:before': { display: 'none' },
                                borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0'
                            }}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon sx={{ color: isDarkMode ? '#94a3b8' : '#64748b' }} />}
                                sx={{
                                    px: 2,
                                    minHeight: 56,
                                    '&.Mui-expanded': { minHeight: 56 },
                                    '& .MuiAccordionSummary-content': { my: 1.5 }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <TableChartIcon sx={{ color: '#f59e0b', fontSize: 22 }} />
                                    <Box>
                                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>Grid Settings</Typography>
                                        <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Sorting, filtering, resize</Typography>
                                    </Box>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                                <Stack spacing={1.5}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={enableSorting}
                                                onChange={(e) => {
                                                    setEnableSorting(e.target.checked);
                                                    localStorage.setItem('outbound_enableSorting', String(e.target.checked));
                                                }}
                                                sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>⬆️ Enable Sorting</Typography>
                                                <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Click headers to sort</Typography>
                                            </Box>
                                        }
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={enableColumnFilters}
                                                onChange={(e) => {
                                                    setEnableColumnFilters(e.target.checked);
                                                    localStorage.setItem('outbound_enableColumnFilters', String(e.target.checked));
                                                }}
                                                sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>🔍 Enable Filtering</Typography>
                                                <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Filter in column headers</Typography>
                                            </Box>
                                        }
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={enableColumnResize}
                                                onChange={(e) => {
                                                    setEnableColumnResize(e.target.checked);
                                                    localStorage.setItem('outbound_enableColumnResize', String(e.target.checked));
                                                }}
                                                sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>↔️ Column Resize</Typography>
                                                <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Drag borders to resize</Typography>
                                            </Box>
                                        }
                                    />
                                    <Button
                                        size="small"
                                        onClick={() => {
                                            setEnableSorting(true);
                                            setEnableColumnFilters(true);
                                            setEnableColumnResize(true);
                                            setEnableCellEditing(true);
                                            localStorage.setItem('outbound_enableSorting', 'true');
                                            localStorage.setItem('outbound_enableColumnFilters', 'true');
                                            localStorage.setItem('outbound_enableColumnResize', 'true');
                                            localStorage.setItem('outbound_enableCellEditing', 'true');
                                            toast.success('Grid settings reset');
                                        }}
                                        sx={{ alignSelf: 'flex-start', fontSize: '0.75rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}
                                    >
                                        🔄 Reset to Default
                                    </Button>
                                </Stack>
                            </AccordionDetails>
                        </Accordion>

                        {/* ═══════════ ACTIONS SECTION ═══════════ */}
                        <Box sx={{ p: 2, borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: isDarkMode ? '#94a3b8' : '#64748b', mb: 1.5, textTransform: 'uppercase' }}>
                                Actions
                            </Typography>
                            <Stack spacing={1}>
                                {canSeeButton('list:export') && (
                                    <Tooltip title={!canAccessButton('list:export') ? "You don't have permission to use this feature" : ""} arrow>
                                        <span style={{ width: '100%' }}>
                                            <Button
                                                fullWidth
                                                variant="contained"
                                                startIcon={<DownloadIcon />}
                                                disabled={!canAccessButton('list:export')}
                                                onClick={() => {
                                                    if (!canAccessButton('list:export')) return;
                                                    setExportStartDate(startDateFilter);
                                                    setExportEndDate(endDateFilter);
                                                    setExportCustomer(customerFilter);
                                                    setExportBatchId(batchFilter);
                                                    setExportSource(sourceFilter);
                                                    setExportDialogOpen(true);
                                                    setListOptionsPanelOpen(false);
                                                }}
                                                sx={{
                                                    height: 44,
                                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                    fontWeight: 600,
                                                    '&:hover': { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' },
                                                    '&.Mui-disabled': { background: '#94a3b8' }
                                                }}
                                            >
                                                Export to Excel
                                            </Button>
                                        </span>
                                    </Tooltip>
                                )}

                                <Button
                                    fullWidth
                                    variant="outlined"
                                    startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
                                    disabled={refreshing}
                                    onClick={() => {
                                        loadOutboundList({ buttonRefresh: true });
                                        setListOptionsPanelOpen(false);
                                    }}
                                    sx={{
                                        height: 44,
                                        fontWeight: 600,
                                        borderColor: '#3b82f6',
                                        color: '#3b82f6',
                                        '&:hover': { borderColor: '#2563eb', bgcolor: 'rgba(59, 130, 246, 0.08)' }
                                    }}
                                >
                                    {refreshing ? 'Refreshing...' : 'Refresh Data'}
                                </Button>

                                {filtersActive && (
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        startIcon={<FilterListIcon />}
                                        onClick={() => {
                                            handleListReset();
                                            setListOptionsPanelOpen(false);
                                        }}
                                        sx={{
                                            height: 44,
                                            fontWeight: 600,
                                            borderColor: '#f59e0b',
                                            color: '#f59e0b',
                                            '&:hover': { borderColor: '#d97706', bgcolor: 'rgba(245, 158, 11, 0.08)' }
                                        }}
                                    >
                                        Reset All Filters
                                    </Button>
                                )}
                            </Stack>
                        </Box>
                    </Box>
                </Drawer>

                {/* WSN Overwrite Warning Dialog */}
                <WSNOverwriteDialog
                    data={wsnOverwriteDialog}
                    onCancel={handleOverwriteCancel}
                    onReplace={handleOverwriteReplace}
                    onAddToNextRow={handleOverwriteAddToNextRow}
                    container={isFullscreen ? multiEntryContainerRef.current : undefined}
                />
            </Box>
        </AppLayout >
    );
}
