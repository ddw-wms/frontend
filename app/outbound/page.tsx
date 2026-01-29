'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
    Tune as TuneIcon,
    Close as CloseIcon,
    KeyboardArrowLeft,
    KeyboardArrowRight,
    FirstPage,
    LastPage,
    AccessTime,
} from '@mui/icons-material';
import { outboundAPI, customerAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';

import AppLayout from '@/components/AppLayout';
import localforage from 'localforage';
import { StandardPageHeader, StandardTabs, BatchManagementTab } from '@/components';
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
import { useOutboundPermissions } from '@/hooks/usePagePermissions';
import BulkUploadCard from '@/components/BulkUploadCard';

// ⚡ OUTBOUND INVENTORY CACHE - for instant WSN lookups
import {
    getAvailableInventoryByWSN,
    loadAvailableInventory,
    getOutboundCacheStats,
    clearOutboundCache,
    removeFromCache,
    needsCacheRefresh
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
    const columnApiRef = useRef<any>(null);
    const hasAutoFittedRef = useRef(false); // Track if auto-fit has been done
    const wsnInputRef = useRef<HTMLInputElement>(null);
    const wsnFetchTimerRef = useRef<NodeJS.Timeout | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        type: 'cell' | 'paste' | 'fillDown';
        rowIndex: number;
        field: string;
        oldValue: any;
        newValue: any;
        oldRowData?: any;
        newRowData?: any;
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

    // ⚡ MULTI ENTRY: Export entered data to Excel
    const exportMultiEntryToExcel = async () => {
        try {
            const dataToExport = multiRows.filter((row: any) => row.wsn?.trim());
            if (dataToExport.length === 0) {
                toast.error('No data to export');
                return;
            }
            const XLSX = await import('xlsx');
            const exportData = dataToExport.map((row: any, idx: number) => ({
                'S.No': idx + 1,
                'WSN': row.wsn || '',
                'Dispatch Remarks': row.dispatch_remarks || '',
                'Other Remarks': row.other_remarks || '',
                'Quantity': row.quantity || '',
                'Brand': row.brand || '',
                'Category': row.cms_vertical || '',
                'Model': row.product_title || ''
            }));
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Multi Outbound');
            XLSX.writeFile(wb, `Outbound_MultiEntry_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`);
            toast.success(`✓ Exported ${dataToExport.length} rows`);
        } catch (error) {
            toast.error('Export failed');
        }
    };

    const [multiRows, setMultiRows] = useState<OutboundItem[]>(generateEmptyRows(500));
    const [multiLoading, setMultiLoading] = useState(false);
    //   const [multiResults, setMultiResults] = useState<any[]>([]);
    const [existingOutboundWSNs, setExistingOutboundWSNs] = useState<Set<string>>(new Set());
    const [duplicateWSNs, setDuplicateWSNs] = useState<Set<string>>(new Set());

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
    const [commonDate, setCommonDate] = useState(new Date().toISOString().split('T')[0]);
    const [commonCustomer, setCommonCustomer] = useState('');
    const [commonVehicle, setCommonVehicle] = useState('');
    const [multiErrorMessage, setMultiErrorMessage] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState('');

    // ====== OUTBOUND LIST STATE ======
    const [listData, setListData] = useState<OutboundItem[]>([]);
    const [listLoading, setListLoading] = useState(true); // Start with loading=true to prevent flash
    const [isFetching, setIsFetching] = useState(true); // Start with fetching=true
    const [initialLoadDone, setInitialLoadDone] = useState(false); // Track if first load completed
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
    const [mobileActionsOpen, setMobileActionsOpen] = useState(false);

    // Open mobile actions handler
    const openMobileActions = () => { setMobileActionsOpen(true); };

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
        const saved = localStorage.getItem('outboundMultiEntryColumns');
        if (saved) {
            try {
                const cols = JSON.parse(saved);
                // Validate columns exist in ALL_MULTI_COLUMNS
                const valid = cols.filter((col: string) => ALL_MULTI_COLUMNS.includes(col));
                if (valid.length > 0) {
                    setVisibleColumns(valid);
                    return;
                }
            } catch (e) {
                console.log('Column settings load error');
            }
        }
        setVisibleColumns(DEFAULT_MULTI_COLUMNS);
    }, []);

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
    };

    // Apply saved column widths when Multi Entry tab opens or visibleColumns change
    // Only auto-size columns that DON'T have saved widths
    useEffect(() => {
        if (currentTabCode !== 'multi') return;
        const api = gridRef.current?.api;
        if (!api) return;

        // Only apply saved widths, don't auto-size (preserves user's column widths)
        setTimeout(() => {
            const savedWidths = localStorage.getItem('outboundMultiEntryColumnWidths');
            if (savedWidths) {
                try {
                    const widths = JSON.parse(savedWidths);
                    const columnState = Object.entries(widths).map(([colId, width]) => ({
                        colId,
                        width: width as number
                    }));
                    if (columnState.length > 0) {
                        api.applyColumnState({ state: columnState });
                    }
                } catch (err) {
                    console.log('Failed to apply saved column widths');
                }
            }
        }, 100);
    }, [currentTabCode, visibleColumns]); // Removed multiRows.length to prevent reset on data change
    // ====== LOAD DATA ON TAB CHANGE ======
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

    // ⚡ UNDO: Handle undo (Ctrl+Z)
    const handleUndo = useCallback(() => {
        if (undoStackRef.current.length === 0) {
            toast('Nothing to undo', { icon: 'ℹ️', duration: 500 });
            return;
        }

        const action = undoStackRef.current.pop()!;

        setMultiRows(currentRows => {
            const newRows = [...currentRows];
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
                api.ensureIndexVisible(action.rowIndex, 'middle');
                api.setFocusedCell(action.rowIndex, action.field);
                api.refreshCells({ force: true });
            }
        }, 50);

        toast.success('Undo successful', { duration: 1500 });
    }, []);

    // ⚡ REDO: Handle redo (Ctrl+Y or Ctrl+Shift+Z)
    const handleRedo = useCallback(() => {
        if (redoStackRef.current.length === 0) {
            toast('Nothing to redo', { icon: 'ℹ️', duration: 1500 });
            return;
        }

        const action = redoStackRef.current.pop()!;

        setMultiRows(currentRows => {
            const newRows = [...currentRows];
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
                api.ensureIndexVisible(action.rowIndex, 'middle');
                api.setFocusedCell(action.rowIndex, action.field);
                api.refreshCells({ force: true });
            }
        }, 50);

        toast.success('Redo successful', { duration: 1500 });
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

    // ✅ NAVIGATE TO NEXT CELL (AG GRID) - handles Enter and Arrow keys
    const navigateToNextCell = useCallback(
        (params: any) => {
            const { key, previousCellPosition, nextCellPosition, event } = params;

            // Tab / arrow keys default behaviour
            if (key !== 'Enter') {
                return nextCellPosition;
            }

            // Enter: same column, next/prev row
            const api = params.api;
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
            } else {
                selectionBoundsRef.current = null;
            }
        } else {
            selectionBoundsRef.current = null;
        }
    }, [selectedRange]);

    // ⚡ EXCEL-LIKE: Refresh grid when selection changes
    useEffect(() => {
        const api = gridRef.current?.api;
        if (api) {
            requestAnimationFrame(() => {
                api.refreshCells({ force: true });
            });
        }
    }, [selectedRange]);

    // ⚡ EXCEL-LIKE: Handle cell mouse down - start drag selection
    const handleCellMouseDown = useCallback((rowIndex: number, colId: string, shiftKey: boolean) => {
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
    const handleCellMouseOver = useCallback((rowIndex: number, colId: string) => {
        if (!isDraggingRef.current || !dragStartCellRef.current) return;
        setSelectedRange({
            startRow: dragStartCellRef.current.rowIndex,
            endRow: rowIndex,
            startCol: dragStartCellRef.current.colId,
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
            newRows[rowIndex] = { ...newRows[rowIndex], [colId]: '' };
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
                }
            }
        }

        if (cleared > 0) {
            setMultiRows(newRows);
            api.refreshCells({ force: true });
            toast.success(`Cleared ${cleared} cells`, { duration: 1500 });
        }
    }, [saveCellUndoAction]);

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
    }, [currentTabCode, handleSelectAll, handleClearCells, handleUndo, handleRedo, handleFillDown, handleFillRight, handleGoToFirst, handleGoToLast]);

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
                const wsn = rowData.wsn?.trim()?.toUpperCase();

                // WSN cleared -> clear all master data columns
                if (!wsn) {
                    rowNode.setDataValue('source', '');
                    rowNode.setDataValue('product_title', '');
                    rowNode.setDataValue('brand', '');
                    rowNode.setDataValue('cms_vertical', '');
                    rowNode.setDataValue('wid', '');
                    rowNode.setDataValue('fsn', '');
                    rowNode.setDataValue('order_id', '');
                    rowNode.setDataValue('fkqc_remark', '');
                    rowNode.setDataValue('fk_grade', '');
                    rowNode.setDataValue('hsn_sac', '');
                    rowNode.setDataValue('igst_rate', '');
                    rowNode.setDataValue('fsp', '');
                    rowNode.setDataValue('mrp', '');
                    rowNode.setDataValue('vrp', '');
                    rowNode.setDataValue('yield_value', '');
                    rowNode.setDataValue('invoice_date', '');
                    rowNode.setDataValue('fkt_link', '');
                    rowNode.setDataValue('wh_location', '');
                    rowNode.setDataValue('p_type', '');
                    rowNode.setDataValue('p_size', '');
                    rowNode.setDataValue('quantity', '');
                    return;
                }

                if (!activeWarehouse) return;

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

                    // Clear the cell and all master columns
                    rowNode.setDataValue('wsn', '');
                    ['source', 'product_title', 'brand', 'cms_vertical', 'wid', 'fsn', 'order_id', 'fkqc_remark', 'fk_grade', 'hsn_sac', 'igst_rate', 'fsp', 'mrp', 'vrp', 'yield_value', 'invoice_date', 'fkt_link', 'wh_location', 'p_type', 'p_size', 'quantity'].forEach(c => rowNode.setDataValue(c, ''));

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

                    rowNode.setDataValue('wsn', '');
                    ['source', 'product_title', 'brand', 'cms_vertical', 'wid', 'fsn', 'order_id', 'fkqc_remark', 'fk_grade', 'hsn_sac', 'igst_rate', 'fsp', 'mrp', 'vrp', 'yield_value', 'invoice_date', 'fkt_link', 'wh_location', 'p_type', 'p_size', 'quantity'].forEach(c => rowNode.setDataValue(c, ''));

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

                        rowNode.setDataValue('wsn', '');
                        ['source', 'product_title', 'brand', 'cms_vertical', 'wid', 'fsn', 'order_id', 'fkqc_remark', 'fk_grade', 'hsn_sac', 'igst_rate', 'fsp', 'mrp', 'vrp', 'yield_value', 'invoice_date', 'fkt_link', 'wh_location', 'p_type', 'p_size', 'quantity'].forEach(c => rowNode.setDataValue(c, ''));

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
                // ⚡ CACHE + OFFLINE: Try local cache first, fall back to API, support offline mode (Issue #7)
                try {
                    let data = null;
                    let fromCache = false;

                    // Try local cache first (works offline)
                    if (cacheEnabled && cacheStats?.isReady) {
                        try {
                            const cached = await getAvailableInventoryByWSN(wsn, activeWarehouse.id);
                            if (cached) {
                                data = cached;
                                fromCache = true;
                                console.log(`⚡ Cache HIT for ${wsn}`);
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

                    // Set all product columns from response
                    rowNode.setDataValue('source', data.source || '');
                    rowNode.setDataValue('product_title', data.product_title || '');
                    rowNode.setDataValue('brand', data.brand || '');
                    rowNode.setDataValue('cms_vertical', data.cms_vertical || '');
                    rowNode.setDataValue('wid', data.wid || '');
                    rowNode.setDataValue('fsn', data.fsn || '');
                    rowNode.setDataValue('order_id', data.order_id || '');
                    rowNode.setDataValue('fkqc_remark', data.fkqc_remark || '');
                    rowNode.setDataValue('fk_grade', data.fk_grade || '');
                    rowNode.setDataValue('hsn_sac', data.hsn_sac || '');
                    rowNode.setDataValue('igst_rate', data.igst_rate || '');
                    rowNode.setDataValue('fsp', data.fsp || '');
                    rowNode.setDataValue('mrp', data.mrp || '');
                    rowNode.setDataValue('vrp', data.vrp || '');
                    rowNode.setDataValue('yield_value', data.yield_value || '');
                    rowNode.setDataValue('invoice_date', data.invoice_date || '');
                    rowNode.setDataValue('fkt_link', data.fkt_link || '');
                    rowNode.setDataValue('wh_location', data.wh_location || '');
                    rowNode.setDataValue('p_type', data.p_type || '');
                    rowNode.setDataValue('p_size', data.p_size || '');
                    rowNode.setDataValue('quantity', data.quantity || '');

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

    // ✅ MULTI ENTRY SUBMIT
    const handleMultiSubmit = async () => {
        if (!activeWarehouse) {
            toast.error('Please select a warehouse');
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


            toast.success(`✓ ${res.data.successCount}/${res.data.totalCount} entries created (Batch: ${res.data.batchId})`);

            // Reset grid and common fields
            setMultiRows(generateEmptyRows(500) as OutboundItem[]);
            setDuplicateWSNs(new Set());
            setGridDuplicateWSNs(new Set());
            setCrossWarehouseWSNs(new Set());
            setCommonDate(new Date().toISOString().split('T')[0]);
            setCommonCustomer('');
            setSelectedCustomer('');
            setCommonVehicle('');
            loadExistingWSNs();

            // Clear saved draft after successful submit
            await clearDraft();

            // Clear saved draft after successful submit
            await clearDraft();
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
            await localforage.setItem(key, { rows: rowsToSave, savedAt: Date.now(), version: 1 });
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
                    // toast.success('✓ Draft restored');
                }
            } catch (err) {
                console.error('Failed to load outbound draft', err);
            }
        };
        load();
        return () => { mounted = false; };
    }, [activeWarehouse?.id, user?.id]);

    // Autosave (debounced) whenever multiRows change
    useEffect(() => {
        lastChangeAtRef.current = Date.now();

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveDraftImmediate(multiRows);
        }, 500);

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [multiRows, activeWarehouse?.id, user?.id]);

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
                setListLoading(false);
                setIsFetching(false);
                setInitialLoadDone(true);
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
            // Only clear loading/overlays when this is the latest request
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

                // If we have no previous data and listData is empty (and there is no pending empty timer), show full spinner; else keep previous rows visible
                if (!previousDataRef.current || (Array.isArray(previousDataRef.current) && previousDataRef.current.length === 0)) {
                    if (!emptyTimerRef.current) {
                        // No previous data - normal behavior
                        if (buttonRefresh) setRefreshing(false);
                        else setListLoading(false);
                    } else {
                        // If an empty timer is pending, keep showing old rows until it resolves; ensure we don't show full spinner
                        if (buttonRefresh) setRefreshing(false);
                        else setListLoading(false);
                    }
                } else {
                    // We have previous data - keep it visible, don't show full-screen spinner
                    if (buttonRefresh) setRefreshing(false);
                    else setListLoading(false);
                }
                // Clear both loaders to avoid stuck spinner in empty-list + refresh cases
                try { setRefreshing(false); } catch { }
                try { setListLoading(false); } catch { }

                // Mark initial load as done (even if it failed, we've attempted a load)
                setInitialLoadDone(true);

                // Clear fetching flag for latest request
                setIsFetching(false);
                outboundAbortControllerRef.current = null;
            }
        }
    };

    const handleListReset = () => {
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

    // ✅ AG GRID COLUMN DEFINITIONS
    const columnDefs = useMemo(() => {
        // Serial column (Sr. No.) - pinned to left
        const srCol = {
            headerName: 'SR.NO',
            field: '__sr',
            valueGetter: (params: any) => params.node ? params.node.rowIndex + 1 : undefined,
            width: 70,
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

            return {
                field: col,
                headerName: col.replace(/_/g, ' ').toUpperCase(),
                editable: isEditable,
                width: defaultWidth, // Let ag-Grid manage widths via applyColumnState
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
    }, [visibleColumns, isDarkMode, crossWarehouseWSNs, gridDuplicateWSNs]);

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
                    const borderColor = isDarkMode ? '#60a5fa' : '#2563eb';
                    const bgColor = isDarkMode ? 'rgba(96, 165, 250, 0.35)' : 'rgba(37, 99, 235, 0.2)';

                    const style: any = { backgroundColor: bgColor };
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

    // ✅ LIST GRID COLUMN DEFINITIONS (AG GRID)
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
            width: 80,
            cellStyle: { fontWeight: 700, textAlign: 'center', color: isDarkMode ? '#94a3b8' : '#64748b' },
            suppressMovable: true,
            sortable: false,
            filter: false,
        };

        const cols = listColumns.map((col: string) => {
            // Dates
            if (col.includes('date')) {
                return {
                    field: col,
                    headerName: col.replace(/_/g, ' ').toUpperCase(),
                    filter: enableColumnFilters ? 'agDateColumnFilter' : undefined,
                    valueFormatter: (p: any) => formatDate(p.value),
                    tooltipField: col,
                    flex: 1, // Let ag-Grid manage widths via applyColumnState
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
                    flex: 1,
                };
            }

            // Default
            return {
                field: col,
                headerName: col.replace(/_/g, ' ').toUpperCase(),
                filter: enableColumnFilters ? 'agTextColumnFilter' : undefined,
                tooltipField: col,
                flex: col === 'wsn' ? 1.2 : 1,
            };
        });

        return [sr, ...cols];
    }, [listColumns, enableColumnFilters, enableSorting, enableColumnResize, isDarkMode]);

    // Re-apply column state when columnDefs change (e.g., column visibility toggle)
    // Matches Dashboard pattern exactly
    useEffect(() => {
        if (listGridRef.current) {
            try {
                const saved = localStorage.getItem('outbound_list_grid_state');
                if (saved) {
                    const state = JSON.parse(saved);
                    // Apply widths without changing order (applyOrder: false)
                    // This preserves user's widths when toggling column visibility
                    listGridRef.current.applyColumnState({ state, applyOrder: false });
                }
            } catch { /* ignore */ }
        }
    }, [listColumnDefs]);

    const listDefaultColDef = useMemo(() => ({
        sortable: !!enableSorting,
        resizable: !!enableColumnResize,
        filter: !!enableColumnFilters,
        editable: false,
        suppressHeaderMenuButton: false,
        minWidth: 100,
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
            <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#363636', color: '#fff', borderRadius: '10px', padding: '16px', fontWeight: 600 }, success: { iconTheme: { primary: '#10b981', secondary: '#fff' } }, error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } } }} />

            <Box sx={{
                p: { xs: 0.75, md: 1 },
                background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)', minHeight: '100vh', width: '100%',
                display: 'flex', flexDirection: 'column'
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(110vh - 200px)', transition: 'opacity 0.15s ease-in-out' }}>
                        {/* SEARCH + FILTERS TOGGLE */}
                        <Box sx={{ mb: 0.5, mt: 0.5 }}>
                            <Stack direction={{ xs: 'row', md: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%' }}>
                                    <TextField size="small" placeholder="🔍 Search by WSN, Product or Customer" value={searchFilter} onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }} sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { height: 36 } }} />

                                    {/* Mobile Actions button - opens full-screen filters/actions dialog */}
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<TuneIcon />}
                                        sx={{
                                            display: { xs: 'inline-flex', md: 'none' },
                                            height: 40,
                                            px: 2,
                                            textTransform: 'none',
                                            flexShrink: 0,
                                            fontSize: '0.85rem',
                                            fontWeight: 600
                                        }}
                                        onClick={openMobileActions}
                                    >
                                        Actions
                                    </Button>
                                </Box>

                                <Button
                                    variant="outlined"
                                    onClick={() => setFiltersExpanded(!filtersExpanded)}
                                    sx={{
                                        display: { xs: 'none', md: 'inline-flex' },
                                        minWidth: { md: 120 },
                                        height: 36,

                                        borderWidth: 2,
                                        borderColor: filtersExpanded ? '#1e40af' : (isDarkMode ? 'rgba(255,255,255,0.15)' : '#cbd5e1'),
                                        bgcolor: filtersExpanded ? 'rgba(30, 64, 175, 0.06)' : (isDarkMode ? '#0f172a' : 'white'),
                                        color: filtersExpanded ? '#1e40af' : (isDarkMode ? '#f1f5f9' : '#64748b'),
                                        fontWeight: 700,
                                        fontSize: '0.68rem',
                                        borderRadius: 1.5,
                                        px: 1.25,
                                        position: 'relative'
                                    }}
                                >
                                    <FilterListIcon sx={{ mr: 0.5 }} />
                                    <Box component="span" sx={{ mr: 1, width: 120, }}>{filtersExpanded ? 'Hide Filters' : 'Show Filters'}</Box>
                                    {filtersActive && (
                                        <Tooltip title="Filters active">
                                            <Box sx={{
                                                position: 'absolute',
                                                top: -6,
                                                right: -6,
                                                width: 14,
                                                height: 14,
                                                borderRadius: '50%',
                                                bgcolor: '#10b981',
                                                border: '2px solid white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, color: 'white' }}>●</Typography>
                                            </Box>
                                        </Tooltip>
                                    )}
                                    <ExpandMoreIcon sx={{ transform: filtersExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }} />
                                </Button>


                            </Stack>

                            <Collapse in={filtersExpanded} timeout="auto">
                                <Card sx={{ mb: 0.5, borderRadius: 1, boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.08)', background: isDarkMode ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0' }}>
                                    <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                        <Box sx={{ display: 'grid', gap: 1 }}>
                                            {/* DESKTOP LAYOUT - 2 Rows (unchanged) */}
                                            <Box sx={{ display: { xs: 'none', md: 'grid' }, gap: 1 }}>
                                                {/* ROW 1: Dates + Source + Customer */}
                                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                                                    <TextField label="From Date" type="date" size="small" InputLabelProps={{ shrink: true }} value={startDateFilter} onChange={(e) => { setStartDateFilter(e.target.value); setPage(1); }} sx={{ '& .MuiOutlinedInput-root': { height: 36 } }} />
                                                    <TextField label="To Date" type="date" size="small" InputLabelProps={{ shrink: true }} value={endDateFilter} onChange={(e) => { setEndDateFilter(e.target.value); setPage(1); }} sx={{ '& .MuiOutlinedInput-root': { height: 36 } }} />
                                                    <TextField select size="small" label="Source" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }} sx={{ '& .MuiOutlinedInput-root': { height: 36 } }}>
                                                        <MenuItem value="">All</MenuItem>
                                                        {sources.map((s) => (
                                                            <MenuItem key={s} value={s}>{s}</MenuItem>
                                                        ))}
                                                    </TextField>
                                                    <Autocomplete
                                                        freeSolo
                                                        options={customers}
                                                        value={customerFilter}
                                                        onChange={(event, newValue) => { setCustomerFilter(newValue || ''); setPage(1); }}
                                                        onInputChange={(event, newInputValue) => { setCustomerFilter(newInputValue); setPage(1); }}
                                                        renderInput={(params) => (
                                                            <TextField {...params} label="Customer" size="small" sx={{ '& .MuiOutlinedInput-root': { height: 36 } }} />
                                                        )}
                                                        size="small"
                                                        noOptionsText={customers.length === 0 ? "No customers available" : "No matching customers"}
                                                    />
                                                </Box>

                                                {/* ROW 2: Brand / Category / Batch / Actions */}
                                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, alignItems: 'center' }}>
                                                    <TextField select size="small" label="Brand" value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }} sx={{ '& .MuiOutlinedInput-root': { height: 36 } }}>
                                                        <MenuItem value="">All Brands</MenuItem>
                                                        {filteredBrands.length > 0 ? filteredBrands.map((b) => (
                                                            <MenuItem key={b} value={b}>{b}</MenuItem>
                                                        )) : brands.map((b) => (
                                                            <MenuItem key={b} value={b}>{b}</MenuItem>
                                                        ))}
                                                    </TextField>

                                                    <TextField select size="small" label="Category" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} sx={{ '& .MuiOutlinedInput-root': { height: 36 } }}>
                                                        <MenuItem value="">All Categories</MenuItem>
                                                        {filteredCategories.length > 0 ? filteredCategories.map((c) => (
                                                            <MenuItem key={c} value={c}>{c}</MenuItem>
                                                        )) : categories.map((c) => (
                                                            <MenuItem key={c} value={c}>{c}</MenuItem>
                                                        ))}
                                                    </TextField>

                                                    <TextField select size="small" label="Batch ID" value={batchFilter} onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }} sx={{ '& .MuiOutlinedInput-root': { height: 36 } }}>
                                                        <MenuItem value="">All</MenuItem>
                                                        {batches.map((b: any) => (
                                                            <MenuItem key={b.batch_id} value={b.batch_id}>{b.batch_id} {b.count ? `(${b.count})` : null}</MenuItem>
                                                        ))}
                                                    </TextField>

                                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ width: '100%' }}>
                                                        <Button size="small" variant="outlined" onClick={handleListReset} sx={{ height: 36, fontSize: '0.7rem', fontWeight: 600 }}>RESET</Button>
                                                        {canSeeButton('list:columns') && (
                                                            <Tooltip title={!canAccessButton('list:columns') ? "You don't have permission to use this feature" : "Manage Columns"} arrow>
                                                                <span>
                                                                    <Button size="small" startIcon={<SettingsIcon sx={{ fontSize: 14 }} />} variant="outlined" disabled={!canAccessButton('list:columns')} onClick={() => canAccessButton('list:columns') && setListColumnSettingsOpen(true)} sx={{ height: 36, fontSize: '0.7rem', fontWeight: 600 }}>COLUMNS</Button>
                                                                </span>
                                                            </Tooltip>
                                                        )}
                                                        <Button size="small" startIcon={<SettingsIcon sx={{ fontSize: 14 }} />} variant="outlined" onClick={() => setGridSettingsOpen(true)} sx={{ height: 36, fontSize: '0.7rem', fontWeight: 600 }}>GRID</Button>
                                                        {canSeeButton('list:export') && (
                                                            <Tooltip title={!canAccessButton('list:export') ? "You don't have permission to use this feature" : "Export Data"} arrow>
                                                                <span>
                                                                    <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 14 }} />} variant="contained" disabled={!canAccessButton('list:export')} onClick={() => canAccessButton('list:export') && setExportDialogOpen(true)} sx={{ height: 36, fontSize: '0.7rem', fontWeight: 600, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>EXPORT</Button>
                                                                </span>
                                                            </Tooltip>
                                                        )}
                                                        <Button
                                                            size="small"
                                                            startIcon={refreshing ? <CircularProgress size={14} /> : (refreshSuccess ? <CheckCircle sx={{ color: 'success.main' }} /> : <RefreshIcon sx={{ fontSize: 14 }} />)}
                                                            variant="outlined"
                                                            onClick={() => loadOutboundList({ buttonRefresh: true })}
                                                            sx={{ height: 36, fontSize: '0.7rem', fontWeight: 600 }}
                                                            disabled={refreshing}
                                                        >
                                                            {refreshing ? 'Refreshing...' : (refreshSuccess ? 'Refreshed' : 'Refresh')}
                                                        </Button>
                                                    </Stack>
                                                </Box>
                                            </Box>

                                            {/* MOBILE LAYOUT - Exact 3 Rows */}
                                            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
                                                    {/* ROW 1: From Date, To Date, Source */}
                                                    <TextField
                                                        label="From Date"
                                                        type="date"
                                                        size="small"
                                                        fullWidth
                                                        InputLabelProps={{ shrink: true }}
                                                        value={startDateFilter}
                                                        onChange={(e) => { setStartDateFilter(e.target.value); setPage(1); }}
                                                        sx={{
                                                            minWidth: 0,
                                                            '& .MuiOutlinedInput-root': { height: 36 },
                                                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                                                            '& .MuiInputBase-input': { fontSize: '0.7rem' },
                                                        }}
                                                    />

                                                    <TextField
                                                        label="To Date"
                                                        type="date"
                                                        size="small"
                                                        fullWidth
                                                        InputLabelProps={{ shrink: true }}
                                                        value={endDateFilter}
                                                        onChange={(e) => { setEndDateFilter(e.target.value); setPage(1); }}
                                                        sx={{
                                                            minWidth: 0,
                                                            '& .MuiOutlinedInput-root': { height: 36 },
                                                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                                                            '& .MuiInputBase-input': { fontSize: '0.7rem' },
                                                        }}
                                                    />

                                                    <TextField
                                                        select
                                                        size="small"
                                                        fullWidth
                                                        label="Source"
                                                        value={sourceFilter}
                                                        onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                                                        sx={{
                                                            minWidth: 0,
                                                            '& .MuiOutlinedInput-root': { height: 36 },
                                                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                                                            '& .MuiInputBase-input': { fontSize: '0.7rem' },
                                                        }}
                                                    >
                                                        <MenuItem value="">All</MenuItem>
                                                        {sources.map((s) => (
                                                            <MenuItem key={s} value={s}>{s}</MenuItem>
                                                        ))}
                                                    </TextField>

                                                    {/* ROW 2: Customer, Brand, Category */}
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
                                                                    '& .MuiOutlinedInput-root': { height: 36 },
                                                                    '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                                                                    '& .MuiInputBase-input': { fontSize: '0.7rem' },
                                                                }}
                                                            />
                                                        )}
                                                        size="small"
                                                        noOptionsText={customers.length === 0 ? "No customers available" : "No matching customers"}
                                                        sx={{ minWidth: 0 }}
                                                    />

                                                    <TextField
                                                        select
                                                        size="small"
                                                        fullWidth
                                                        label="Brand"
                                                        value={brandFilter}
                                                        onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                                                        sx={{
                                                            minWidth: 0,
                                                            '& .MuiOutlinedInput-root': { height: 36 },
                                                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                                                            '& .MuiInputBase-input': { fontSize: '0.7rem' },
                                                        }}
                                                    >
                                                        <MenuItem value="">All Brands</MenuItem>
                                                        {filteredBrands.length > 0 ? filteredBrands.map((b) => (
                                                            <MenuItem key={b} value={b}>{b}</MenuItem>
                                                        )) : brands.map((b) => (
                                                            <MenuItem key={b} value={b}>{b}</MenuItem>
                                                        ))}
                                                    </TextField>

                                                    <TextField
                                                        select
                                                        size="small"
                                                        fullWidth
                                                        label="Category"
                                                        value={categoryFilter}
                                                        onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                                                        sx={{
                                                            minWidth: 0,
                                                            '& .MuiOutlinedInput-root': { height: 36 },
                                                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                                                            '& .MuiInputBase-input': { fontSize: '0.7rem' },
                                                        }}
                                                    >
                                                        <MenuItem value="">All Categories</MenuItem>
                                                        {filteredCategories.length > 0 ? filteredCategories.map((c) => (
                                                            <MenuItem key={c} value={c}>{c}</MenuItem>
                                                        )) : categories.map((c) => (
                                                            <MenuItem key={c} value={c}>{c}</MenuItem>
                                                        ))}
                                                    </TextField>
                                                </Box>

                                                {/* ROW 3: 4 Action Buttons */}
                                                <Box
                                                    sx={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(4, 1fr)',
                                                        gap: 0.5,
                                                        mt: 0.5,
                                                    }}
                                                >
                                                    {[
                                                        {
                                                            icon: '🧹',
                                                            label: 'Reset',
                                                            onClick: handleListReset,
                                                        },
                                                        {
                                                            icon: <SettingsIcon fontSize="small" />,
                                                            label: 'Columns',
                                                            onClick: () => setListColumnSettingsOpen(true),
                                                        },
                                                        {
                                                            icon: <DownloadIcon fontSize="small" />,
                                                            label: 'Export',
                                                            onClick: () => setExportDialogOpen(true),
                                                        },
                                                        {
                                                            icon: <RefreshIcon fontSize="small" />,
                                                            label: 'Refresh',
                                                            onClick: loadOutboundList,
                                                        },
                                                    ].map((btn, index) => (
                                                        <Button
                                                            key={index}
                                                            size="small"
                                                            variant="outlined"
                                                            onClick={() => btn.onClick?.()}
                                                            sx={{
                                                                minWidth: 0,
                                                                height: 36,
                                                                px: 0.5,
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                lineHeight: 1,
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    fontSize: '1rem',
                                                                    display: 'flex',
                                                                    justifyContent: 'center',
                                                                    alignItems: 'center',
                                                                }}
                                                            >
                                                                {btn.icon}
                                                            </Box>
                                                            <Box
                                                                sx={{
                                                                    fontSize: '0.55rem',
                                                                    fontWeight: 600,
                                                                    mt: 0.1,
                                                                    textAlign: 'center',
                                                                }}
                                                            >
                                                                {btn.label}
                                                            </Box>
                                                        </Button>
                                                    ))}
                                                </Box>
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Collapse>

                        </Box>


                        {/* TABLE - AG GRID (always render grid so header remains visible) */}
                        <Box sx={{
                            flex: 1,
                            minHeight: 0,
                            border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d1d5db',
                            position: 'relative'
                        }}>

                            {/* Loading Spinner Overlay - semi-transparent so data stays visible */}
                            {listLoading && listData && listData.length > 0 && (
                                <Box sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.5)',
                                    zIndex: 10,
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

                            {/* Full Loading Overlay - ONLY for initial load when no data exists */}
                            {listLoading && (!listData || listData.length === 0) && (
                                <Box sx={{
                                    position: 'absolute',
                                    top: 48,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                                    backdropFilter: 'blur(3px)',
                                    zIndex: 5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Box sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 3,
                                        p: 4,
                                        bgcolor: isDarkMode ? '#1e293b' : 'white',
                                        borderRadius: 3,
                                        boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)'
                                    }}>
                                        <Box sx={{ position: 'relative' }}>
                                            <CircularProgress
                                                size={56}
                                                thickness={3.5}
                                                sx={{
                                                    color: '#1e40af',
                                                    filter: 'drop-shadow(0 2px 8px rgba(25, 118, 210, 0.2))'
                                                }}
                                            />
                                            <Box sx={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                width: 44,
                                                height: 44,
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #1e40af 0%, #60a5fa 100%)',
                                                opacity: 0.15,
                                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                                                '@keyframes pulse': {
                                                    '0%, 100%': {
                                                        transform: 'translate(-50%, -50%) scale(1)',
                                                        opacity: 0.15
                                                    },
                                                    '50%': {
                                                        transform: 'translate(-50%, -50%) scale(1.15)',
                                                        opacity: 0.05
                                                    }
                                                }
                                            }} />
                                        </Box>
                                        <Typography
                                            sx={{
                                                fontSize: '0.95rem',
                                                fontWeight: 500,
                                                color: '#546e7a',
                                                letterSpacing: 0.3,
                                                textAlign: 'center'
                                            }}
                                        >
                                            Loading data...
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                            {/* Empty State Overlay - Only show when NOT loading AND NOT fetching AND initial load is done */}
                            {!listLoading && !isFetching && initialLoadDone && (!listData || listData.length === 0) && (
                                <Box sx={{
                                    position: 'absolute',
                                    top: 60,
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

                            <Box sx={{ height: '100%', width: '100%', bgcolor: isDarkMode ? '#1e293b' : '#ffffff' }}>
                                <div className="ag-theme-quartz" style={{ height: '100%', width: '100%', position: 'relative', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }}>
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
                                            backgroundColor: isDarkMode ? '#334155' : '#f1f5f9',
                                            borderBottom: isDarkMode ? '2px solid #475569' : '2px solid #d1d5db',
                                            opacity: '1 !important',
                                            zIndex: 15,
                                            position: 'relative'
                                        },
                                        '& .ag-header-cell': {
                                            backgroundColor: isDarkMode ? '#334155' : '#f1f5f9',
                                            color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            borderRight: isDarkMode ? '1px solid #475569' : '1px solid #d1d5db',
                                            opacity: '1 !important'
                                        },
                                        '& .ag-header-cell:last-child': {
                                            borderRight: 'none',
                                        },
                                        '& .ag-body-viewport': {
                                            opacity: listLoading ? 0.3 : 1,
                                            transition: 'opacity 0.2s ease-in-out',
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
                                            rowBuffer={20}
                                            valueCache={true}
                                            debounceVerticalScrollbar={true}
                                            gridOptions={{ suppressRowTransform: true }}
                                            onGridReady={(params: any) => {
                                                listGridRef.current = params.api;
                                                columnApiRef.current = params.api;
                                                try {
                                                    const saved = localStorage.getItem('outbound_list_grid_state');
                                                    if (saved && params.api) {
                                                        params.api.applyColumnState({ state: JSON.parse(saved), applyOrder: true });
                                                        hasAutoFittedRef.current = true;
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
                                                            params.api.autoSizeColumns(allColIds);
                                                        }
                                                        hasAutoFittedRef.current = true;
                                                    } catch { /* ignore */ }
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
                                    borderTop: isDarkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid #ddd",
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
                        <Dialog open={listColumnSettingsOpen} onClose={() => setListColumnSettingsOpen(false)} maxWidth="sm" fullWidth>
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
                        <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
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

                {/* MOBILE ACTIONS DIALOG (Filters + Actions for mobile) */}
                <Dialog fullScreen open={mobileActionsOpen} onClose={() => setMobileActionsOpen(false)}>
                    <AppBar position="sticky" elevation={1} sx={{ bgcolor: isDarkMode ? '#1e293b' : 'background.paper', color: isDarkMode ? '#f1f5f9' : 'text.primary', borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e0e0e0' }}>
                        <Toolbar>
                            <IconButton edge="start" color="inherit" onClick={() => setMobileActionsOpen(false)} aria-label="close">
                                <CloseIcon />
                            </IconButton>
                            <Typography sx={{ ml: 2, flex: 1, fontWeight: 700 }}>Filters & Actions</Typography>
                            <Button color="primary" onClick={() => setMobileActionsOpen(false)}>Close</Button>
                        </Toolbar>
                    </AppBar>

                    <DialogContent sx={{ p: 2, bgcolor: isDarkMode ? '#0f172a' : 'background.default' }}>
                        <Stack spacing={2}>
                            {/* Filters */}
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: isDarkMode ? '#94a3b8' : '#6b7280' }}>
                                    📊 Filters
                                </Typography>

                                <Stack spacing={1.5}>
                                    <TextField
                                        select
                                        size="small"
                                        label="Source"
                                        value={sourceFilter}
                                        onChange={(e) => setSourceFilter(e.target.value)}
                                        fullWidth
                                        SelectProps={{ MenuProps: { PaperProps: { style: { maxHeight: 300 } } } }}
                                        sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}
                                    >
                                        <MenuItem value="">All Sources</MenuItem>
                                        {sources.map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
                                    </TextField>

                                    <Autocomplete
                                        freeSolo
                                        options={customers}
                                        value={customerFilter}
                                        onChange={(event, newValue) => setCustomerFilter(newValue || '')}
                                        onInputChange={(event, newInputValue) => setCustomerFilter(newInputValue)}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Customer"
                                                size="small"
                                                sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}
                                            />
                                        )}
                                        noOptionsText={customers.length === 0 ? "No customers available" : "No matching customers"}
                                    />

                                    <TextField
                                        select
                                        size="small"
                                        label="Brand"
                                        value={brandFilter}
                                        onChange={(e) => setBrandFilter(e.target.value)}
                                        fullWidth
                                        SelectProps={{ MenuProps: { PaperProps: { style: { maxHeight: 300 } } } }}
                                        sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}
                                    >
                                        <MenuItem value="">All Brands</MenuItem>
                                        {(filteredBrands.length > 0 ? filteredBrands : brands).map((b) => (<MenuItem key={b} value={b}>{b}</MenuItem>))}
                                    </TextField>

                                    <TextField
                                        select
                                        size="small"
                                        label="Category"
                                        value={categoryFilter}
                                        onChange={(e) => setCategoryFilter(e.target.value)}
                                        fullWidth
                                        SelectProps={{ MenuProps: { PaperProps: { style: { maxHeight: 300 } } } }}
                                        sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}
                                    >
                                        <MenuItem value="">All Categories</MenuItem>
                                        {(filteredCategories.length > 0 ? filteredCategories : categories).map((c) => (<MenuItem key={c} value={c}>{c}</MenuItem>))}
                                    </TextField>

                                    <Box display="flex" gap={1}>
                                        <TextField
                                            label="From Date"
                                            type="date"
                                            size="small"
                                            variant="outlined"
                                            InputLabelProps={{ shrink: true }}
                                            value={startDateFilter || ''}
                                            onChange={(e) => setStartDateFilter(e.target.value)}
                                            sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 40 } }}
                                        />
                                        <TextField
                                            label="To Date"
                                            type="date"
                                            size="small"
                                            variant="outlined"
                                            InputLabelProps={{ shrink: true }}
                                            value={endDateFilter || ''}
                                            onChange={(e) => setEndDateFilter(e.target.value)}
                                            sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 40 } }}
                                        />
                                    </Box>

                                    <TextField
                                        select
                                        size="small"
                                        label="Batch ID"
                                        value={batchFilter}
                                        onChange={(e) => setBatchFilter(e.target.value)}
                                        fullWidth
                                        SelectProps={{ MenuProps: { PaperProps: { style: { maxHeight: 300 } } } }}
                                        sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}
                                    >
                                        <MenuItem value="">All Batches</MenuItem>
                                        {batches.map((b: any) => (<MenuItem key={b.batch_id} value={b.batch_id}>{b.batch_id} {b.count ? `(${b.count})` : null}</MenuItem>))}
                                    </TextField>
                                </Stack>
                            </Box>

                            {/* Action Buttons */}
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: isDarkMode ? '#94a3b8' : '#6b7280' }}>
                                    ⚡ Actions
                                </Typography>

                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<FilterListIcon />}
                                        onClick={() => { handleListReset(); }}
                                        sx={{ height: 44, fontSize: '0.85rem' }}
                                    >
                                        Clear
                                    </Button>

                                    {canSeeButton('list:columns') && (
                                        <Tooltip title={!canAccessButton('list:columns') ? "You don't have permission to use this feature" : ""} arrow>
                                            <span style={{ width: '100%' }}>
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<SettingsIcon />}
                                                    disabled={!canAccessButton('list:columns')}
                                                    onClick={() => { if (canAccessButton('list:columns')) { setListColumnSettingsOpen(true); setMobileActionsOpen(false); } }}
                                                    sx={{ height: 44, fontSize: '0.85rem', width: '100%' }}
                                                >
                                                    Columns
                                                </Button>
                                            </span>
                                        </Tooltip>
                                    )}

                                    <Button
                                        variant="outlined"
                                        startIcon={<SettingsIcon />}
                                        onClick={() => { setGridSettingsOpen(true); setMobileActionsOpen(false); }}
                                        sx={{ height: 44, fontSize: '0.85rem' }}
                                    >
                                        Grid
                                    </Button>

                                    {canSeeButton('list:export') && (
                                        <Tooltip title={!canAccessButton('list:export') ? "You don't have permission to use this feature" : ""} arrow>
                                            <span style={{ width: '100%' }}>
                                                <Button
                                                    variant="outlined"
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
                                                        setMobileActionsOpen(false);
                                                    }}
                                                    sx={{ height: 44, fontSize: '0.85rem', width: '100%' }}
                                                >
                                                    Export
                                                </Button>
                                            </span>
                                        </Tooltip>
                                    )}

                                    <Button
                                        variant="outlined"
                                        startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />}
                                        onClick={() => loadOutboundList({ buttonRefresh: true })}
                                        disabled={refreshing}
                                        sx={{ height: 44, fontSize: '0.85rem', gridColumn: 'span 2' }}
                                    >
                                        {refreshing ? 'Refreshing...' : 'Refresh'}
                                    </Button>
                                </Box>
                            </Box>
                        </Stack>
                    </DialogContent>

                    <Box sx={{ position: 'sticky', bottom: 0, left: 0, right: 0, bgcolor: isDarkMode ? '#1e293b' : 'background.paper', p: 2, borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e0e0e0', display: 'flex', gap: 1 }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            onClick={() => { handleListReset(); }}
                            sx={{ height: 48 }}
                        >
                            Reset Filters
                        </Button>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={() => { setPage(1); setMobileActionsOpen(false); }}
                            sx={{ height: 48 }}
                        >
                            Apply
                        </Button>
                    </Box>
                </Dialog>

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

                                    <FormControl fullWidth size="small">
                                        <InputLabel>Customer Name *</InputLabel>
                                        <Select
                                            value={singleForm.customer_name}
                                            onChange={(e) => setSingleForm({ ...singleForm, customer_name: e.target.value })}
                                            label="Customer Name *"
                                        >
                                            <MenuItem value="">Select Customer</MenuItem>
                                            {customers.length === 0 ? (
                                                <MenuItem disabled value="">
                                                    No customers available. Please add customers first.
                                                </MenuItem>
                                            ) : (
                                                customers.map((c) => (
                                                    <MenuItem key={c} value={c}>{c}</MenuItem>
                                                ))
                                            )}
                                        </Select>
                                    </FormControl>

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
                            title="📤 Bulk Outbound Upload"
                        />
                    </Box>
                )}



                {/* ====== TAB 3: MULTI ENTRY (AG GRID) ====== */}
                {currentTabCode === 'multi' && (
                    <Box sx={{
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
                            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                {isMobile ? (
                                    <Box sx={{ display: 'grid', gap: 1 }}>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                                            <TextField
                                                label="Dispatch Date *"
                                                type="date"
                                                value={commonDate}
                                                onChange={(e) => setCommonDate(e.target.value)}
                                                InputLabelProps={{ shrink: true }}
                                                size="small"
                                                required
                                                sx={{ '& .MuiOutlinedInput-root': { height: 36 } }}
                                            />

                                            <Autocomplete
                                                freeSolo
                                                options={customers}
                                                value={selectedCustomer}
                                                onChange={(event, newValue) => setSelectedCustomer(newValue || '')}
                                                onInputChange={(event, newInputValue) => setSelectedCustomer(newInputValue)}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        label="Customer Name *"
                                                        placeholder="Type or select..."
                                                        size="small"
                                                        sx={{ '& .MuiOutlinedInput-root': { height: 36 } }}
                                                    />
                                                )}
                                                noOptionsText={customers.length === 0 ? "No customers available. Please add customers first." : "No matching customers"}
                                            />
                                        </Box>

                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 1, alignItems: 'center' }}>
                                            <TextField
                                                label="Vehicle Number"
                                                value={commonVehicle}
                                                onChange={(e) => setCommonVehicle(e.target.value.toUpperCase())}
                                                size="small"
                                                placeholder="Optional"
                                                sx={{ '& .MuiOutlinedInput-root': { height: 36 } }}
                                            />


                                            <Button
                                                size="small"
                                                variant="contained"
                                                onClick={add500Rows}
                                                sx={{ height: 32, fontSize: '0.7rem', fontWeight: 600, background: '#ec4899' }}
                                            >
                                                +500 Add Rows
                                            </Button>

                                            <Button
                                                size="small"
                                                onClick={() => setColumnSettingsOpen(true)}
                                                startIcon={<SettingsIcon sx={{ fontSize: 16 }} />}
                                                variant="outlined"
                                                sx={{ height: 32, fontSize: '0.7rem', fontWeight: 600, px: 1 }}
                                            >
                                                COLUMNS
                                            </Button>
                                        </Box>
                                    </Box>
                                ) : (
                                    /* Desktop: Two sections - Left (inputs) | Right (buttons) - like Inbound */
                                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: '100%' }}>
                                        {/* LEFT: Input Fields */}
                                        <Stack direction="row" spacing={1} sx={{ flex: '0 0 auto' }}>
                                            <TextField
                                                label="Dispatch Date *"
                                                type="date"
                                                value={commonDate}
                                                onChange={(e) => setCommonDate(e.target.value)}
                                                InputLabelProps={{ shrink: true }}
                                                size="small"
                                                required
                                                sx={{ width: 145, '& .MuiOutlinedInput-root': { height: 34 } }}
                                            />
                                            <Autocomplete
                                                freeSolo
                                                options={customers}
                                                value={selectedCustomer}
                                                onChange={(event, newValue) => setSelectedCustomer(newValue || '')}
                                                onInputChange={(event, newInputValue) => setSelectedCustomer(newInputValue)}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        label="Customer Name *"
                                                        placeholder="Type or select..."
                                                        size="small"
                                                        sx={{ '& .MuiOutlinedInput-root': { height: 34 } }}
                                                    />
                                                )}
                                                noOptionsText={customers.length === 0 ? "No customers available" : "No match"}
                                                sx={{ width: 180 }}
                                            />
                                            <TextField
                                                label="Vehicle No"
                                                value={commonVehicle}
                                                onChange={(e) => setCommonVehicle(e.target.value.toUpperCase())}
                                                size="small"
                                                placeholder="Optional"
                                                sx={{ width: 110, '& .MuiOutlinedInput-root': { height: 34 } }}
                                            />
                                        </Stack>

                                        {/* RIGHT: Action Buttons - Scrollable */}
                                        <Box
                                            sx={{
                                                flex: 1,
                                                minWidth: 0,
                                                overflowX: 'auto',
                                                overflowY: 'hidden',
                                                WebkitOverflowScrolling: 'touch',
                                                scrollbarWidth: 'thin',
                                                '&::-webkit-scrollbar': { height: 4 },
                                                '&::-webkit-scrollbar-thumb': { bgcolor: isDarkMode ? '#475569' : '#cbd5e1', borderRadius: 2 },
                                                '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                                            }}
                                        >
                                            <Stack direction="row" spacing={0.75} sx={{ width: 'fit-content', minWidth: 'max-content', alignItems: 'center' }}>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => setColumnSettingsOpen(true)}
                                                    sx={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        height: 32,
                                                        minWidth: 'auto',
                                                        px: 1.5,
                                                        borderRadius: 1,
                                                        borderColor: isDarkMode ? '#3b82f6' : '#1e40af',
                                                        color: isDarkMode ? '#60a5fa' : '#1e40af',
                                                        whiteSpace: 'nowrap',
                                                        textTransform: 'none',
                                                        '&:hover': { borderColor: '#3b82f6', bgcolor: 'rgba(59, 130, 246, 0.08)' }
                                                    }}
                                                >
                                                    Columns
                                                </Button>

                                                {/* +500 Rows Button */}
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    onClick={add500Rows}
                                                    sx={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        height: 32,
                                                        minWidth: 'auto',
                                                        px: 1.5,
                                                        borderRadius: 1,
                                                        background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                                                        whiteSpace: 'nowrap',
                                                        textTransform: 'none',
                                                        boxShadow: 'none',
                                                        '&:hover': { background: 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)', boxShadow: 'none' }
                                                    }}
                                                >
                                                    +500 Rows
                                                </Button>

                                                {/* Export Button */}
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={exportMultiEntryToExcel}
                                                    disabled={!multiRows.some((r: any) => r.wsn?.trim())}
                                                    sx={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        height: 32,
                                                        minWidth: 'auto',
                                                        px: 1.5,
                                                        borderRadius: 1,
                                                        borderColor: '#10b981',
                                                        color: '#10b981',
                                                        whiteSpace: 'nowrap',
                                                        textTransform: 'none',
                                                        '&:hover': { borderColor: '#059669', bgcolor: 'rgba(16, 185, 129, 0.08)' },
                                                        '&.Mui-disabled': { borderColor: '#94a3b8', color: '#94a3b8' }
                                                    }}
                                                >
                                                    Export
                                                </Button>

                                                {/* Divider */}
                                                <Box sx={{ width: 1, height: 20, bgcolor: isDarkMode ? '#475569' : '#d1d5db' }} />

                                                {/* Cache Toggle */}
                                                <Tooltip title={cacheEnabled ? 'Offline mode ON - Click to disable' : 'Enable offline mode for faster lookups'}>
                                                    <Box
                                                        onClick={toggleCache}
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 0.5,
                                                            bgcolor: cacheEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                                                            border: `1.5px solid ${cacheEnabled ? '#10b981' : isDarkMode ? '#64748b' : '#9ca3af'}`,
                                                            borderRadius: 1,
                                                            px: 1,
                                                            height: 32,
                                                            cursor: 'pointer',
                                                            '&:hover': { opacity: 0.85 }
                                                        }}
                                                    >
                                                        <Typography sx={{ fontSize: '0.75rem', lineHeight: 1 }}>💾</Typography>
                                                        <Typography sx={{ color: cacheEnabled ? '#10b981' : isDarkMode ? '#94a3b8' : '#6b7280', fontWeight: 700, fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                                                            {cacheLoading ? 'Loading...' : cacheEnabled ? (cacheStats ? `${cacheStats.totalRecords.toLocaleString()}` : 'ON') : 'OFF'}
                                                        </Typography>
                                                        <Switch
                                                            size="small"
                                                            checked={cacheEnabled}
                                                            onChange={(e) => { e.stopPropagation(); toggleCache(); }}
                                                            sx={{
                                                                width: 32, height: 18, p: 0,
                                                                '& .MuiSwitch-switchBase': { p: '2px' },
                                                                '& .MuiSwitch-thumb': { width: 14, height: 14 },
                                                                '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' },
                                                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#10b981' },
                                                            }}
                                                        />
                                                    </Box>
                                                </Tooltip>

                                                {/* Refresh Cache Button (only when cache enabled) */}
                                                {cacheEnabled && (
                                                    <Tooltip title="Refresh cache">
                                                        <IconButton
                                                            size="small"
                                                            onClick={refreshCache}
                                                            disabled={cacheLoading}
                                                            sx={{
                                                                width: 32,
                                                                height: 32,
                                                                color: '#10b981',
                                                                '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' }
                                                            }}
                                                        >
                                                            <RefreshIcon sx={{ fontSize: 18, animation: cacheLoading ? 'spin 1s linear infinite' : 'none' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Stack>
                                        </Box>
                                    </Stack>
                                )}
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

                            // ⚡ EXCEL-LIKE: Custom range selection CSS classes
                            '& .custom-range-selected': {
                                backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.4) !important' : 'rgba(37, 99, 235, 0.2) !important',
                            },
                            '& .custom-range-top': {
                                borderTop: isDarkMode ? '3px solid #60a5fa !important' : '3px solid #2563eb !important',
                            },
                            '& .custom-range-bottom': {
                                borderBottom: isDarkMode ? '3px solid #60a5fa !important' : '3px solid #2563eb !important',
                            },
                            '& .custom-range-left': {
                                borderLeft: isDarkMode ? '3px solid #60a5fa !important' : '3px solid #2563eb !important',
                            },
                            '& .custom-range-right': {
                                borderRight: isDarkMode ? '3px solid #60a5fa !important' : '3px solid #2563eb !important',
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
                                getRowStyle={getRowStyle}
                                getRowId={(params: any) => params.data._rowId}
                                navigateToNextCell={navigateToNextCell}
                                singleClickEdit={true}
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
                                    handleCellMouseDown(rowIndex, colId, browserEvent?.shiftKey || false);
                                }}
                                onCellMouseOver={(event) => {
                                    const rowIndex = event.rowIndex;
                                    const colId = event.column?.getColId();
                                    if (rowIndex === null || rowIndex === undefined || !colId) return;
                                    handleCellMouseOver(rowIndex, colId);
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

                                // ⚡ PERFORMANCE: Optimizations
                                rowBuffer={20}
                                animateRows={false}
                                suppressScrollOnNewData={true}
                                debounceVerticalScrollbar={true}
                                suppressPropertyNamesCheck={true}
                                valueCache={true}

                                // Simple localStorage - save column state when resized
                                onColumnResized={(params: any) => {
                                    if (params.finished && params.api) {
                                        try {
                                            const state = params.api.getColumnState();
                                            localStorage.setItem('outbound_multi_grid_state', JSON.stringify(state));
                                        } catch { /* ignore */ }
                                    }
                                }}
                                onGridReady={(params: any) => {
                                    columnApiRef.current = params.columnApi;
                                    // Restore saved column state
                                    try {
                                        const saved = localStorage.getItem('outbound_multi_grid_state');
                                        if (saved) {
                                            params.api.applyColumnState({ state: JSON.parse(saved), applyOrder: true });
                                        }
                                    } catch { /* ignore */ }
                                }}
                            // Removed onFirstDataRendered and onGridSizeChanged auto-sizing to preserve user column widths
                            />
                        </Box>

                        {/* DRAFT STATUS + ACTIONS + SUBMIT - Single Row */}
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 0.5, sm: 1 },
                            py: 0.5,
                            flexWrap: 'wrap',
                            flexShrink: 0
                        }}>
                            <Chip
                                label={draftSavedAt ? `Draft saved ${new Date(draftSavedAt).toLocaleTimeString()}` : 'No draft'}
                                color={draftExists ? 'success' : 'default'}
                                size="small"
                                sx={{ height: 28 }}
                            />
                            <Button size="small" variant="outlined" onClick={() => saveDraftImmediate()} disabled={draftSaving} sx={{ height: 32, fontSize: '0.75rem' }}>Save Draft</Button>
                            <Button size="small" variant="text" onClick={clearDraft} disabled={!draftExists} sx={{ height: 32, fontSize: '0.75rem' }}>Clear Draft</Button>
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
                <Dialog open={columnSettingsOpen} onClose={() => setColumnSettingsOpen(false)} maxWidth="sm" fullWidth>
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
            </Box>
        </AppLayout >
    );
}
