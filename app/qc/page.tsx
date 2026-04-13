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
  InputAdornment,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Divider,
  Card,
  CardContent,
  useMediaQuery,
  useTheme,
  Collapse,
  IconButton,
  Toolbar,
  AppBar,
  Tooltip,
  Pagination,
  InputBase,
  Fade,
  Drawer,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
  CheckCircle,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  Close as CloseIcon,
  Tune as TuneIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  FirstPage,
  LastPage,
  AccessTime,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Menu as MenuIcon,
  ViewColumn as ViewColumnIcon,
  TableChart as TableChartIcon,
  Inventory as InventoryIcon,
  Print as PrintIcon,
  Keyboard as KeyboardIcon,
  Link as LinkIcon,
  Info as InfoIcon,
  QrCodeScanner as QrCodeScannerIcon,
} from '@mui/icons-material';
import { qcAPI } from '@/lib/api';
import { printLabel, isAgentRunning } from '@/lib/printAgent';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import {
  updateAvailableCacheSource,
  isCacheEnabled as isWMSCacheEnabled,
  enableCache as enableWMSCache,
  disableCache as disableWMSCache,
  loadAvailableInventory,
  getCacheStats,
  getAvailableByWSNFast,
  warmupMemoryCache,
  clearMemoryCache,
  startAutoRefresh,
  stopAutoRefresh
} from '@/lib/wmsCache';
import AppLayout from '@/components/AppLayout';
import { StandardPageHeader, StandardTabs, BatchManagementTab, WSNOverwriteDialog } from '@/components';
import type { WSNOverwriteDialogData } from '@/components';
import { useTableRowHeight } from '@/app/context/AppearanceContext';

import toast, { Toaster } from 'react-hot-toast';
// ⚡ OPTIMIZED: XLSX loaded dynamically on export to reduce bundle size
// import * as XLSX from 'xlsx'; // Removed - loaded dynamically
import { AgGridReact } from '@/components/AGGridScrollWrapper';
import { ModuleRegistry, AllCommunityModule, ClientSideRowModelModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { debounce } from 'lodash';
import localforage from 'localforage';
// Simple localStorage-based grid state (native ag-Grid pattern)

// Register AG Grid modules ONCE (include ClientSideRowModel for client-side features)
ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

// ? WINDOW-LEVEL CACHE: Persists data outside React lifecycle for instant navigation
declare global {
  interface Window {
    __QC_LIST_CACHE__?: {
      data: QCItem[];
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
// ? FIX: Only returns cache if warehouseId matches current warehouse
const getCachedQCListData = (): QCItem[] => {
  const currentWarehouseId = getCurrentWarehouseId();

  // Priority 1: Window cache (fastest, survives navigation)
  if (typeof window !== 'undefined' && window.__QC_LIST_CACHE__?.data?.length) {
    // Only use cache if warehouse matches and not stale (2 min TTL)
    if (window.__QC_LIST_CACHE__.warehouseId === currentWarehouseId &&
      Date.now() - (window.__QC_LIST_CACHE__.timestamp || 0) < 120000) {
      return window.__QC_LIST_CACHE__.data;
    }
  }
  // Priority 2: SessionStorage (survives page refresh) - skip if warehouse mismatch
  try {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('qc_list_cache');
      const savedWarehouseId = sessionStorage.getItem('qc_list_cache_warehouseId');
      if (saved && savedWarehouseId && parseInt(savedWarehouseId, 10) === currentWarehouseId) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Also populate window cache for faster subsequent access
          window.__QC_LIST_CACHE__ = { data: parsed, total: parsed.length, timestamp: Date.now(), warehouseId: currentWarehouseId };
          return parsed;
        }
      }
    }
  } catch { /* ignore */ }
  return [];
};

import { useQCPermissions } from '@/hooks/usePagePermissions';
import { useFullscreen, useLiveSession, useRealtimeSync } from '@/hooks';
import BulkUploadCard from '@/components/BulkUploadCard';
import LiveViewPanel from '@/components/LiveViewPanel';

// Tab definitions with permission codes
const ALL_TABS = ['QC List', 'Single QC', 'Multi QC', 'Bulk Upload', 'Batch Management'];
const TAB_CODES = ['list', 'single', 'multi', 'bulk', 'batches'];

let QC_GRADES = ['A', 'B', 'C', 'D'];
const QC_STATUSES = ['Pending', 'Done', 'Pass', 'Fail', 'Hold'];

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
  'product_title',
  'brand',
  'cms_vertical',
  'mrp',
  'fsp',
  'inbound_date',
  'vehicle_no',
  'qc_date',
  'qc_by_name',
  'qc_grade',
  'qc_status',
  'qc_remarks',
  'updated_by_name',
  'updated_at',
];

const ALL_MULTI_COLUMNS = [
  'sno',
  'wsn',
  'productserialnumber',
  'rackno',
  'qcgrade',
  'qcremarks',
  'otherremarks',
  // Master data
  'fsn',
  'producttitle',
  'brand',
  'cmsvertical',
  'hsnsac',
  'igstrate',
  'mrp',
  'fsp',
  'vrp',
  'yieldvalue',
  'ptype',
  'psize',
  'fktlink',
  'whlocation',
  'orderid',
  'fkqcremark',
  'fkgrade',
  'invoicedate',
];

// Constants
const DEFAULT_MULTI_COLUMNS = [
  'sno',
  'wsn',
  'product_serial_number',
  'rack_no',
  'qc_grade',
  'qc_remarks',
  'other_remarks',
  'fsn',
  'producttitle',
  'brand',
  'cmsvertical',
  'mrp',
  'fsp',
  'fkqcremark',
];

const ALL_MASTER_COLUMNS = [
  'fsn',
  'producttitle',
  'brand',
  'cmsvertical',
  'hsnsac',
  'igstrate',
  'mrp',
  'fsp',
  'vrp',
  'yieldvalue',
  'ptype',
  'psize',
  'fktlink',
  'whlocation',
  'orderid',
  'fkqcremark',
  'fkgrade',
  'invoicedate',
];

const EDITABLE_COLUMNS = ['wsn', 'product_serial_number', 'rack_no', 'qc_grade', 'qc_remarks', 'other_remarks'];

// All exportable columns with display names
const EXPORT_COLUMN_MAP: { key: string; label: string; dataKey: string }[] = [
  { key: 'sno', label: 'S.No', dataKey: 'sno' },
  { key: 'wsn', label: 'WSN', dataKey: 'wsn' },
  { key: 'productserialnumber', label: 'Product Serial Number', dataKey: 'productserialnumber' },
  { key: 'rackno', label: 'Rack No', dataKey: 'rackno' },
  { key: 'qcgrade', label: 'QC Grade', dataKey: 'qcgrade' },
  { key: 'qcremarks', label: 'QC Remarks', dataKey: 'qcremarks' },
  { key: 'otherremarks', label: 'Other Remarks', dataKey: 'otherremarks' },
  { key: 'fsn', label: 'FSN', dataKey: 'fsn' },
  { key: 'producttitle', label: 'Product Title', dataKey: 'producttitle' },
  { key: 'brand', label: 'Brand', dataKey: 'brand' },
  { key: 'cmsvertical', label: 'CMS Vertical', dataKey: 'cmsvertical' },
  { key: 'hsnsac', label: 'HSN/SAC', dataKey: 'hsnsac' },
  { key: 'igstrate', label: 'IGST Rate', dataKey: 'igstrate' },
  { key: 'mrp', label: 'MRP', dataKey: 'mrp' },
  { key: 'fsp', label: 'FSP', dataKey: 'fsp' },
  { key: 'vrp', label: 'VRP', dataKey: 'vrp' },
  { key: 'yieldvalue', label: 'Yield Value', dataKey: 'yieldvalue' },
  { key: 'ptype', label: 'Product Type', dataKey: 'ptype' },
  { key: 'psize', label: 'Product Size', dataKey: 'psize' },
  { key: 'fktlink', label: 'FKT Link', dataKey: 'fktlink' },
  { key: 'whlocation', label: 'WH Location', dataKey: 'whlocation' },
  { key: 'orderid', label: 'Order ID', dataKey: 'orderid' },
  { key: 'fkqcremark', label: 'FK QC Remark', dataKey: 'fkqcremark' },
  { key: 'fkgrade', label: 'FK Grade', dataKey: 'fkgrade' },
  { key: 'invoicedate', label: 'Invoice Date', dataKey: 'invoicedate' },
];

const DEFAULT_EXPORT_COLUMNS = EXPORT_COLUMN_MAP.map(c => c.key);

interface QCItem {
  id: number;
  [key: string]: any;
}

interface Rack {
  id: number;
  rack_name: string;
}

interface StatsType {
  pending: number;
  pass: number;
  fail: number;
  hold: number;
  done: number;
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
  created_at: string;
  status: string;
}

export default function QCPage() {

  const theme = useTheme();
  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const isMobile = useMediaQuery('(max-width:600px)');
  const isDarkMode = theme.palette.mode === 'dark';
  const [user, setUser] = useState<any>(null);

  // Get table row height from appearance settings
  const tableRowHeight = useTableRowHeight();

  // Permission hook
  const { filterTabs, canSeeTab, canSeeButton, canAccessButton, isAdmin, isLoading: permLoading } = useQCPermissions();

  // Get visible tabs based on permissions
  const visibleTabs = useMemo(() => filterTabs(ALL_TABS, TAB_CODES), [filterTabs]);
  const visibleTabCodes = useMemo(() => {
    if (isAdmin) return TAB_CODES;
    return TAB_CODES.filter((code) => canSeeTab(code));
  }, [canSeeTab, isAdmin]);

  const [tabValue, setTabValue] = useState(0);
  const currentTabCode = visibleTabCodes[tabValue];
  const [multiQCSubTab, setMultiQCSubTab] = useState(0); // Sub-tab for Multi QC (0: Grid, 1: Bulk Upload)

  // AG Grid refs
  const gridRef = useRef<any>(null);
  const listGridRef = useRef<any>(null);  // Separate ref for List grid
  const multiEntryContainerRef = useRef<HTMLDivElement>(null);  // Ref for fullscreen mode
  const columnApiRef = useRef<any>(null);
  const hasAutoFittedRef = useRef(false); // Track if auto-fit has been done

  // ====== FULLSCREEN MODE ======
  const { isFullscreen, toggleFullscreen } = useFullscreen(multiEntryContainerRef);

  // ⚡ EXCEL-LIKE: Refs for smooth scrolling and selection
  const userScrolledRef = useRef(false);
  const userScrollTimeoutRef = useRef<number | null>(null);
  const lastGridScrollTopRef = useRef(0);
  const isAutoScrollingRef = useRef(false);
  const desiredRowIndexRef = useRef<number | null>(null);
  const scanningModeRef = useRef(false);
  const multiRowsRef = useRef([] as any[]);

  // ⚡ OFFLINE: Track if offline warning has been shown
  const offlineWarningShownRef = useRef<boolean>(false);
  const wsnFetchMapRef = useRef<Map<number, string>>(new Map());

  // 🖨️ PRINT AGENT: State for printing & shortcuts
  const [agentReady, setAgentReady] = useState(false);
  const [ctrlPPrintEnabled, setCtrlPPrintEnabled] = useState(false);
  const [ctrlOProductLinkEnabled, setCtrlOProductLinkEnabled] = useState(false);
  const lastScannedRowRef = useRef<any>(null);

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
    startCol: string;
    endCol: string;
    colIndexMap: Map<string, number>;
  } | null>(null);
  const prevSelectionBoundsRef = useRef<{ minRow: number; maxRow: number } | null>(null);

  // ⚡ PERF: Update selection refs + refresh cells WITHOUT triggering React re-render.
  // Called directly during drag to avoid re-rendering the entire component on every mouseMove.
  const updateSelectionRange = useCallback((range: typeof selectedRange) => {
    selectedRangeRef.current = range;

    // Pre-compute selection bounds
    if (range && gridRef.current) {
      const api = gridRef.current;
      const allColumns = api.getAllDisplayedColumns?.() || [];
      const colIndexMap = new Map<string, number>();
      allColumns.forEach((c: any, idx: number) => {
        colIndexMap.set(c.getColId(), idx);
      });

      const startColIndex = colIndexMap.get(range.startCol) ?? -1;
      const endColIndex = colIndexMap.get(range.endCol) ?? -1;

      if (startColIndex !== -1 && endColIndex !== -1) {
        selectionBoundsRef.current = {
          minRow: Math.min(range.startRow, range.endRow),
          maxRow: Math.max(range.startRow, range.endRow),
          minCol: Math.min(startColIndex, endColIndex),
          maxCol: Math.max(startColIndex, endColIndex),
          startCol: range.startCol,
          endCol: range.endCol,
          colIndexMap,
        };
      } else {
        selectionBoundsRef.current = null;
      }
    } else {
      selectionBoundsRef.current = null;
    }

    // Row-scoped refresh — only refreshes affected rows instead of entire grid
    const api = gridRef.current;
    if (api) {
      const bounds = selectionBoundsRef.current;
      const prevBounds = prevSelectionBoundsRef.current;
      const rowsToRefresh = new Set<number>();

      if (bounds) {
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) rowsToRefresh.add(r);
      }
      if (prevBounds) {
        for (let r = prevBounds.minRow; r <= prevBounds.maxRow; r++) rowsToRefresh.add(r);
      }

      prevSelectionBoundsRef.current = bounds ? { minRow: bounds.minRow, maxRow: bounds.maxRow } : null;

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
    }
  }, []);

  // ⚡ PERF: Wrapper that updates refs/cells AND triggers React re-render (for JSX chip display).
  // Use this for final/clear events (mouseUp, Escape, Shift+Click, keyboard selection, etc.).
  const setSelectionRange = useCallback((range: typeof selectedRange) => {
    updateSelectionRange(range);
    setSelectedRange(range);
  }, [updateSelectionRange]);

  // ⚡ EXCEL-LIKE: Track mouse drag state for multi-cell selection
  const isDraggingRef = useRef(false);
  const dragStartCellRef = useRef<{ rowIndex: number; colId: string } | null>(null);

  // ⚡ PERFORMANCE: Stable row ID counter for AG Grid
  const rowIdCounterRef = useRef(0);

  // ⚡ UNDO/REDO: Track undo/redo actions for cell edits, paste, and fill-down
  type UndoAction = {
    type: 'cell' | 'paste' | 'fillDown' | 'batch';
    rowIndex?: number;
    field?: string;
    oldValue?: string;
    newValue?: string;
    oldRowData?: any;
    newRowData?: any;
    pasteData?: {
      startRow: number;
      endRow: number;
      oldRows: any[];
      newRows: any[];
    };
  };
  const MAX_UNDO_HISTORY = 100;
  const undoStackRef = useRef<UndoAction[]>([]);
  const redoStackRef = useRef<UndoAction[]>([]);
  const draftLoadedRef = useRef(false);
  const draftLoadFailedRef = useRef(false); // Track if draft load failed (prevents empty overwrite)

  // Single Entry WSN debounce ref (for scanner support)
  const singleWSNDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // QC LIST STATE
  // ? INSTANT NAVIGATION: Initialize from cache to prevent empty grid flash
  const [qcList, setQcList] = useState<QCItem[]>(() => getCachedQCListData());
  const [listLoading, setListLoading] = useState(() => getCachedQCListData().length === 0);
  const [dataResponseReceived, setDataResponseReceived] = useState(() => getCachedQCListData().length > 0);
  // ? PREVENT COLUMN RESIZE FLASH: Hide grid body until columns are auto-sized
  const [gridDataRendered, setGridDataRendered] = useState(false);

  // ? SYNCHRONOUS MOUNT: Load cache BEFORE paint for instant display
  useLayoutEffect(() => {
    const cached = getCachedQCListData();
    if (cached.length > 0) {
      setQcList(cached);
      setListLoading(false);
      setDataResponseReceived(true);
    }
  }, []);

  const [isFetching, setIsFetching] = useState(false);
  // Local refresh button state (non-blocking)
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Smooth loading helpers (prevent blinking overlay)
  const currentLoadIdRef = useRef(0);
  const qcAbortControllerRef = useRef<AbortController | null>(null);
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const overlayShownRef = useRef(false);
  const overlayStartRef = useRef<number | null>(null);
  const emptyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const SHOW_OVERLAY_DELAY = 150; // ms
  const MIN_LOADING_MS = 350; // ms
  const EMPTY_CONFIRM_DELAY = 400; // ms - delay before clearing rows when server returns empty
  const [topLoading, setTopLoading] = useState(false);
  const previousDataRef = useRef<QCItem[] | null>(null);

  // ⚡ PAGE CACHE: Store fetched pages for instant back navigation
  const pageCacheRef = useRef<Map<string, { data: QCItem[], total: number, timestamp: number }>>(new Map());
  const PAGE_CACHE_TTL = 60000; // 1 minute cache validity

  // ⚡ LAST REFRESH TIME: Track when data was last fetched
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // ⚡ AUTO-RETRY: Track retry attempts
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  // ⚡ LAZY LOADING: Defer filter options loading
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // Whether any filter is active (shows green dot on Filters button)
  const filtersActive = Boolean(
    (searchFilter && searchFilter.trim() !== '') ||
    (statusFilter && statusFilter !== '') ||
    (gradeFilter && gradeFilter !== '') ||
    (brandFilter && brandFilter !== '') ||
    (categoryFilter && categoryFilter !== '') ||
    (dateFromFilter && dateFromFilter !== '') ||
    (dateToFilter && dateToFilter !== '')
  );

  type ColumnConfig = {
    key: string;
    visible: boolean;
  };

  const DEFAULT_LIST_COLUMNS: ColumnConfig[] = ALL_LIST_COLUMNS.map(col => ({
    key: col,
    visible: true,
  }));

  const [listColumns, setListColumns] = useState<ColumnConfig[]>([]);

  const [listColumnSettingsOpen, setListColumnSettingsOpen] = useState(false);

  // Grid Settings (persisted)
  const [enableSorting, setEnableSorting] = useState<boolean>(() => {
    try { return localStorage.getItem('qc_enableSorting') === 'true'; } catch { return false; }
  });
  const [enableColumnFilters, setEnableColumnFilters] = useState<boolean>(() => {
    try { return localStorage.getItem('qc_enableColumnFilters') === 'true'; } catch { return false; }
  });
  const [enableColumnResize, setEnableColumnResize] = useState<boolean>(() => {
    try { return localStorage.getItem('qc_enableColumnResize') !== 'false'; } catch { return true; }
  });
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);

  // ====== QC MULTI ENTRY SETTINGS PANEL STATE ======
  const [qcSettingsPanelOpen, setQcSettingsPanelOpen] = useState(false);
  const [settingsPanelExpanded, setSettingsPanelExpanded] = useState<string | false>('columns');

  // ====== AVAILABLE CACHE STATE (wmsCache - for QC) ======
  const [availableCacheEnabled, setAvailableCacheEnabled] = useState(false);
  const [availableCacheStats, setAvailableCacheStats] = useState<{ count: number; lastSync: number | null } | null>(null);
  const [availableCacheLoading, setAvailableCacheLoading] = useState(false);
  const [availableCacheProgress, setAvailableCacheProgress] = useState('');

  // SINGLE ENTRY STATE
  const [singleWSN, setSingleWSN] = useState('');
  const [singleProduct, setSingleProduct] = useState({
    fsn: '',
    product_title: '',
    brand: '',
    cms_vertical: '',
    mrp: '',
    fsp: '',
    fkt_link: '',
  });
  const [singleForm, setSingleForm] = useState({
    qc_date: new Date().toISOString().split('T')[0],
    qc_by_name: '',
    qc_grade: '',
    qc_remarks: '',
    other_remarks: '',
    product_serial_number: '',
    rack_no: '',
  });
  const [singleLoading, setSingleLoading] = useState(false);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [duplicateQC, setDuplicateQC] = useState<any>(null);

  // ? ADD THIS - Template download confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);

  // MULTI ENTRY STATE
  const generateEmptyRows = (count: number) => {
    return Array.from({ length: count }, () => {
      rowIdCounterRef.current++;
      return {
        _rowId: `qc_row_${rowIdCounterRef.current}_${Date.now()}`,
        wsn: '',
        qcdate: new Date().toISOString().split('T')[0],
        qcbyname: '',
        productserialnumber: '',
        rackno: '',
        qcgrade: '',
        qcremarks: '',
        otherremarks: '',
        // Master data fields
        fsn: '',
        producttitle: '',
        brand: '',
        cmsvertical: '',
        hsnsac: '',
        igstrate: '',
        mrp: '',
        fsp: '',
        vrp: '',
        yieldvalue: '',
        ptype: '',
        psize: '',
        fktlink: '',
        whlocation: '',
        orderid: '',
        fkqcremark: '',
        fkgrade: '',
        invoicedate: '',
      };
    });
  };


  const [multiRows, setMultiRows] = useState<any[]>(() => generateEmptyRows(500));
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiResults, setMultiResults] = useState<any[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [commonQcDate, setCommonQcDate] = useState('');
  const [commonQcByName, setCommonQcByName] = useState('');

  // ====== WSN OVERWRITE WARNING DIALOG ======
  const [wsnOverwriteDialog, setWsnOverwriteDialog] = useState<WSNOverwriteDialogData | null>(null);
  const pendingWSNRef = useRef<{ rowIndex: number; newWSN: string; event: any } | null>(null);

  // ⚡ REAL-TIME SYNC: Cross-device row sync refs
  const isSyncingRef = useRef(false);
  const lastSyncReceivedAtRef = useRef(0);
  const pendingSyncRowsRef = useRef<Map<number, any>>(new Map());
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ====== LIVE VIEW SESSION ======
  const isOnMultiTab = visibleTabCodes[tabValue] === 'multi';
  const { startSession: startLiveSession, updateEntries: updateLiveEntries, endSession: endLiveSession, isActive: isLiveSessionActive } = useLiveSession({
    warehouseId: activeWarehouse?.id,
    pageType: 'qc',
    enabled: isOnMultiTab && !!activeWarehouse?.id,
  });

  // Auto-start live session when entering Multi QC tab
  useEffect(() => {
    if (isOnMultiTab && activeWarehouse?.id && !isLiveSessionActive) {
      startLiveSession();
      // ⚡ Warm up memory cache for ultra-fast WSN lookups
      warmupMemoryCache(activeWarehouse.id).catch(err => {
        console.warn('Memory cache warmup failed:', err);
      });

      // ⚡ AUTO-ENABLE + AUTO-LOAD available cache on multi-tab open
      if (!isWMSCacheEnabled()) {
        enableWMSCache();
        setAvailableCacheEnabled(true);
        console.log('⚡ QC: Cache auto-enabled on multi-tab open');
      }
      // Load available inventory if not loaded or stale
      getCacheStats(activeWarehouse.id).then(stats => {
        setAvailableCacheStats({ count: stats.available.count, lastSync: stats.available.lastSync });
        if (!stats.available.count || !stats.available.lastSync) {
          console.log('⚡ QC: Auto-loading available cache...');
          loadAvailableInventory(activeWarehouse.id, (loaded, total, msg) => {
            setAvailableCacheProgress(msg);
          }).then(result => {
            if (result.success) {
              setAvailableCacheStats({ count: result.count, lastSync: Date.now() });
              warmupMemoryCache(activeWarehouse.id).catch(() => { });
            }
            setAvailableCacheProgress('');
          }).catch(() => setAvailableCacheProgress(''));
        }
      }).catch(console.error);
    } else if (!isOnMultiTab && isLiveSessionActive) {
      endLiveSession();
    }
  }, [isOnMultiTab, activeWarehouse?.id, isLiveSessionActive, startLiveSession, endLiveSession]);

  // ⚡ AUTO-REFRESH: Refresh available cache every 30 min while on multi-tab
  useEffect(() => {
    if (isOnMultiTab && activeWarehouse?.id) {
      const cleanup = startAutoRefresh(activeWarehouse.id, undefined, 'available');
      return cleanup;
    } else {
      stopAutoRefresh();
    }
  }, [isOnMultiTab, activeWarehouse?.id]);

  // 🖨️ PRINT AGENT: Check if print agent is running (poll every 10s) & load settings
  useEffect(() => {
    // Load saved toggle states from localStorage
    const savedCtrlP = localStorage.getItem('qc_ctrlP_print_enabled');
    const savedCtrlO = localStorage.getItem('qc_ctrlO_productlink_enabled');
    if (savedCtrlP === 'true') setCtrlPPrintEnabled(true);
    if (savedCtrlO === 'true') setCtrlOProductLinkEnabled(true);

    let cancelled = false;
    const checkAgent = async () => {
      try {
        const running = await isAgentRunning();
        if (!cancelled) setAgentReady(running);
      } catch {
        if (!cancelled) setAgentReady(false);
      }
    };
    checkAgent();
    const interval = setInterval(checkAgent, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Broadcast entries when multiRows change
  useEffect(() => {
    if (isLiveSessionActive && isOnMultiTab) {
      const validEntries = multiRows
        .map((row, idx) => ({
          wsn: row.wsn || '',
          product_title: row.producttitle || row.product_title || '',
          brand: row.brand || '',
          mrp: row.mrp,
          fsp: row.fsp,
          cms_vertical: row.cmsvertical || row.cms_vertical || '',
          fkqc_remarks: row.fkqcremark || '',
          p_type: row.ptype || '',
          p_size: row.psize || '',
          source: row.source || '',
          wid: row.wid || '',
          fsn: row.fsn || '',
          fk_grade: row.fkgrade || '',
          hsn_sac: row.hsnsac || '',
          igst_rate: row.igstrate,
          vrp: row.vrp,
          yield_value: row.yieldvalue,
          fkt_link: row.fktlink || '',
          wh_location: row.whlocation || '',
          rack_no: row.rackno || '',
          qc_grade: row.grade || '',
          qc_remarks: row.qcremarks || '',
          other_remarks: row.otherremarks || '',
          product_serial_number: row.productserialnumber || '',
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

  // Store objects with WSN + warehouse ID
  const [existingQCWSNs, setExistingQCWSNs] = useState<Array<{ wsn: string; warehouseid: number }>>([]);

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('qcMultiEntryColumns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // ? Always include 'sno' at the beginning
        if (!parsed.includes('sno')) {
          return ['sno', ...parsed];
        }
        return parsed;
      } catch (e) {
        return DEFAULT_MULTI_COLUMNS;
      }
    }
    return DEFAULT_MULTI_COLUMNS;
  });

  // ====== MULTI ENTRY EXPORT COLUMN SELECTION ======
  const [exportColumnsDialogOpen, setExportColumnsDialogOpen] = useState(false);
  const [exportSelectedColumns, setExportSelectedColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('qcMultiEntryExportColumns');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return DEFAULT_EXPORT_COLUMNS;
  });
  const [exportSavePreference, setExportSavePreference] = useState(() => {
    return localStorage.getItem('qcMultiEntryExportColumns') !== null;
  });

  // ====== MULTI ENTRY COLUMN WIDTHS PERSISTENCE ======
  const [multiColumnWidths, setMultiColumnWidths] = useState<Record<string, number>>(() => {
    const savedWidths = localStorage.getItem('qcMultiEntryColumnWidths');
    if (savedWidths) {
      try {
        return JSON.parse(savedWidths);
      } catch { return {}; }
    }
    return {};
  });



  // Grid settings with localStorage
  const [gridSettings, setGridSettings] = useState({
    sortable: true,
    filter: true,
    resizable: true,
    editable: true,
  });

  // ? LOAD Grid Settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('qc_grid_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setGridSettings(parsed);
        console.log('[QC] Grid settings loaded:', parsed);
      } catch (e) {
        console.log('Failed to parse grid settings');
      }
    }
  }, []);

  // ? SAVE to localStorage whenever settings change
  const updateGridSettings = (newSettings: typeof gridSettings) => {
    setGridSettings(newSettings);
    localStorage.setItem('qc_grid_settings', JSON.stringify(newSettings));
    console.log('[QC] Grid settings saved:', newSettings);
  };


  // Fetch all existing QC'd WSNs on mount (for cross-warehouse checking)
  // ? Fetch existing QC WSNs with warehouse IDs
  useEffect(() => {
    async function fetchExistingWSNs() {
      try {
        const res = await qcAPI.getAllQCWSNs();
        // res.data is now: [{ wsn: "ABC", warehouseid: 1 }, ...]
        setExistingQCWSNs(res.data || []);
        console.log('? Existing QC WSNs loaded:', res.data);
      } catch (error) {
        console.error('Failed to fetch existing QC WSNs:', error);
      }
    }
    fetchExistingWSNs();
  }, []);

  // ------------------ Draft helpers & autosave ------------------
  const getDraftKey = () => {
    if (!activeWarehouse?.id || !user?.id) return null;
    return `qcMultiDraft_${activeWarehouse.id}_${user.id}`;
  };

  const saveDraftImmediate = async (rowsToSave = multiRows) => {
    if (!draftLoadedRef.current) return; // Don't overwrite before draft is loaded
    if (!activeWarehouse?.id) return;

    // 🛡️ SAFEGUARD: Never overwrite a real draft with empty rows
    const hasAnyData = rowsToSave.some((r: any) => r.wsn?.trim());
    if (!hasAnyData && (draftExists || draftLoadFailedRef.current)) {
      console.warn('[DRAFT] 🛡️ Blocked: refusing to overwrite QC (draftExists:', draftExists, 'loadFailed:', draftLoadFailedRef.current, ')');
      return;
    }

    setDraftSaving(true);
    try {
      // Primary: Save to server-side DB
      await qcAPI.saveDraft(rowsToSave, activeWarehouse.id, commonQcDate, 'desktop');
      setDraftSavedAt(Date.now());
      setDraftExists(true);
    } catch (err) {
      console.error('Failed to save QC draft to DB, falling back to IndexedDB', err);
      // Fallback: Save to IndexedDB
      try {
        const key = getDraftKey();
        if (key) {
          await localforage.setItem(key, { rows: rowsToSave, savedAt: Date.now(), version: 1 });
          setDraftSavedAt(Date.now());
          setDraftExists(true);
        }
      } catch (localErr) {
        console.error('Failed to save QC draft to IndexedDB', localErr);
      }
    } finally {
      setDraftSaving(false);
    }
  };

  // ⚡ REAL-TIME SYNC: Debounced function to send changed rows to other devices via SSE
  const flushSyncRows = useCallback(() => {
    if (!activeWarehouse?.id) return;
    if (pendingSyncRowsRef.current.size === 0) return;
    const rows = Array.from(pendingSyncRowsRef.current.entries()).map(([index, data]) => ({ index, data }));
    pendingSyncRowsRef.current.clear();
    qcAPI.syncRows(rows, activeWarehouse.id)
      .catch(() => { });
  }, [activeWarehouse?.id]);

  const queueRowSync = useCallback((rowIndex: number, rowData: any) => {
    if (isSyncingRef.current) return;
    pendingSyncRowsRef.current.set(rowIndex, rowData);
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(flushSyncRows, 300);
  }, [flushSyncRows]);

  const clearDraft = async () => {
    const key = getDraftKey();
    try {
      // Clear from DB
      if (activeWarehouse?.id) {
        await qcAPI.clearDraft(activeWarehouse.id, 'desktop');
      }
    } catch (err) {
      console.error('Failed to clear QC draft from DB', err);
    }
    try {
      // Also clear from IndexedDB
      if (key) {
        await localforage.removeItem(key);
      }
    } catch (err) {
      console.error('Failed to clear QC draft from IndexedDB', err);
    }
    setDraftSavedAt(null);
    setDraftExists(false);
    undoStackRef.current = [];
    redoStackRef.current = [];
    toast.success('Draft cleared');
  };

  // Load draft when warehouse/user become available
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!activeWarehouse?.id || !user?.id) return;
      draftLoadedRef.current = false;
      draftLoadFailedRef.current = false;
      let anyLoadSucceeded = false;
      try {
        // Primary: Load from server-side DB
        const res = await qcAPI.loadDraft(activeWarehouse.id, 'desktop');
        anyLoadSucceeded = true; // DB call completed (even if no draft found)
        const dbDraft = res.data;
        if (dbDraft?.exists && dbDraft.draft?.rows?.length > 0 && mounted) {
          const restored = dbDraft.draft.rows.map((r: any, idx: number) => {
            rowIdCounterRef.current++;
            return {
              _rowId: r._rowId || `qc_restored_${rowIdCounterRef.current}_${Date.now()}`,
              qcdate: r.qcdate || commonQcDate,
              qcbyname: r.qcbyname || commonQcByName,
              ...r,
            };
          });
          setMultiRows(restored);
          setDraftSavedAt(new Date(dbDraft.draft.saved_at || dbDraft.draft.updated_at).getTime());
          setDraftExists(true);
          draftLoadedRef.current = true;
          return;
        }
      } catch (err) {
        console.error('Failed to load QC draft from DB', err);
      }

      // Fallback: Load from IndexedDB
      try {
        const key = getDraftKey();
        if (!key) { draftLoadedRef.current = true; return; }
        const draft: any = await localforage.getItem(key);
        anyLoadSucceeded = true; // IndexedDB call completed
        if (draft && draft.rows && draft.rows.length > 0 && mounted) {
          const restored = draft.rows.map((r: any, idx: number) => {
            rowIdCounterRef.current++;
            return {
              _rowId: r._rowId || `qc_local_${rowIdCounterRef.current}_${Date.now()}`,
              qcdate: r.qcdate || commonQcDate,
              qcbyname: r.qcbyname || commonQcByName,
              ...r,
            };
          });
          setMultiRows(restored);
          setDraftSavedAt(draft.savedAt || Date.now());
          setDraftExists(true);
          // Sync local draft to DB
          if (activeWarehouse?.id) {
            try { await qcAPI.saveDraft(restored, activeWarehouse.id, commonQcDate, 'desktop'); } catch { }
          }
        }
      } catch (err) {
        console.error('Failed to load QC draft from IndexedDB', err);
      }
      // 🛡️ If BOTH DB and IndexedDB failed, mark to prevent empty overwrite
      if (!anyLoadSucceeded) {
        draftLoadFailedRef.current = true;
        console.error('⚠️ QC draft load failed from both DB and IndexedDB — autosave blocked for empty rows');
      }
      if (mounted) draftLoadedRef.current = true;
    };
    load();
    return () => { mounted = false; };
  }, [activeWarehouse?.id, user?.id]);

  // Autosave (debounced) whenever multiRows change
  useEffect(() => {
    // Skip autosave when change came from real-time sync (prevents circular save loop)
    if (isSyncingRef.current) return;

    // Update last change timestamp
    lastChangeAtRef.current = Date.now();

    // Debounce save
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


  // Set initial date on client side only (avoid hydration mismatch)
  useEffect(() => {
    if (!commonQcDate) {
      setCommonQcDate(new Date().toISOString().split('T')[0]);
    }
  }, []);



  // BATCH MANAGEMENT STATE
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // GRADE MANAGEMENT STATE
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [newGrade, setNewGrade] = useState('');
  const [editingGradeIndex, setEditingGradeIndex] = useState<number | null>(null);

  // FILTERS
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState<StatsType>({
    pending: 0,
    pass: 0,
    fail: 0,
    hold: 0,
    done: 0,
    total: 0,
  });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const [exportGrade, setExportGrade] = useState('');
  const [exportBrand, setExportBrand] = useState('');
  const [exportCategory, setExportCategory] = useState('');
  const [exportBatchIds, setExportBatchIds] = useState<string[]>([]);

  // ====== QC LIST OPTIONS PANEL STATE ======
  const [qcOptionsPanelOpen, setQcOptionsPanelOpen] = useState(false);
  const [qcSettingsPanelExpanded, setQcSettingsPanelExpanded] = useState<string | false>('filters');

  // Persist grid settings to localStorage
  useEffect(() => {
    try { localStorage.setItem('qc_enableSorting', String(enableSorting)); } catch { }
  }, [enableSorting]);

  useEffect(() => {
    try { localStorage.setItem('qc_enableColumnFilters', String(enableColumnFilters)); } catch { }
  }, [enableColumnFilters]);

  useEffect(() => {
    try { localStorage.setItem('qc_enableColumnResize', String(enableColumnResize)); } catch { }
  }, [enableColumnResize]);

  // ====== AVAILABLE CACHE INIT ======
  useEffect(() => {
    setAvailableCacheEnabled(isWMSCacheEnabled());
    if (isWMSCacheEnabled() && activeWarehouse?.id) {
      getCacheStats(activeWarehouse.id).then(stats => {
        setAvailableCacheStats({
          count: stats.available.count,
          lastSync: stats.available.lastSync
        });
      }).catch(console.error);
    }
  }, [activeWarehouse?.id]);

  // Load available cache function
  const handleLoadAvailableCache = async () => {
    if (!activeWarehouse?.id) {
      toast.error('No warehouse selected');
      return;
    }

    setAvailableCacheLoading(true);
    setAvailableCacheProgress('Loading...');

    try {
      // Auto-enable cache if not enabled
      if (!isWMSCacheEnabled()) {
        enableWMSCache();
        setAvailableCacheEnabled(true);
      }

      const result = await loadAvailableInventory(
        activeWarehouse.id,
        (loaded, total, message) => setAvailableCacheProgress(message)
      );

      if (result.success) {
        setAvailableCacheStats({ count: result.count, lastSync: Date.now() });
        toast.success(`Cache loaded: ${result.count.toLocaleString()} items`);
      } else {
        toast.error('Failed to load available cache');
      }
    } catch (error) {
      console.error('Available cache error:', error);
      toast.error('Failed to load available cache');
    } finally {
      setAvailableCacheLoading(false);
      setAvailableCacheProgress('');
    }
  };


  // AUTH CHECK
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }

    setUser(storedUser);

    // ? AUTO-POPULATE QC BY NAME FROM LOGGED-IN USER
    const userName =
      (storedUser as any)?.full_name ||
      (storedUser as any)?.name ||
      (storedUser as any)?.username ||
      '';

    if (userName) {
      // Set single form
      setSingleForm((prev) => ({
        ...prev,
        qc_by_name: userName,
      }));

      // Set common QC by name for multi entry
      setCommonQcByName(userName);

      console.log('? QC By Name auto-populated:', userName);
    }
  }, [router]);

  // ? KEEP QC BY NAME UPDATED WHEN USER CHANGES
  useEffect(() => {
    if (!user) return;

    const userName =
      (user as any)?.full_name ||
      (user as any)?.name ||
      (user as any)?.username ||
      '';

    if (userName) {
      setSingleForm((prev) => ({
        ...prev,
        qc_by_name: userName,
      }));

      setCommonQcByName(userName);
    }
  }, [user]);

  // ? LOAD COLUMN SETTINGS FROM LOCALSTORAGE
  useEffect(() => {
    const saved = localStorage.getItem('qcMultiEntryColumns');

    if (saved) {
      try {
        const cols = JSON.parse(saved);
        setVisibleColumns(cols);
        return;
      } catch (e) {
        console.log('Column settings load error');
      }
    }

    setVisibleColumns(DEFAULT_MULTI_COLUMNS);
  }, []);

  // ? SAVE COLUMN SETTINGS
  const saveColumnSettings = (cols: string[]) => {
    setVisibleColumns(cols);
    localStorage.setItem('qcMultiEntryColumns', JSON.stringify(cols));
  };




  // ? NAVIGATE TO NEXT CELL (AG GRID)
  const navigateToNextCell = useCallback((params: any) => {
    const { previousCellPosition, nextCellPosition, key } = params;

    if (key === 'Enter') {
      const currentCol = previousCellPosition.column.getColId();
      const currentRow = previousCellPosition.rowIndex;

      if (currentCol === visibleColumns[visibleColumns.length - 1]) {
        // Last column → move to first column of next row
        return {
          rowIndex: currentRow + 1,
          column: params.api.getColumns()![0],
        };
      } else {
        // Same row, next column
        const colIndex = visibleColumns.indexOf(currentCol);
        const nextColId = visibleColumns[colIndex + 1];
        const nextCol = params.api.getColumns()!.find((c: any) => c.getColId() === nextColId);
        return {
          rowIndex: currentRow,
          column: nextCol,
        };
      }
    }

    return nextCellPosition;
  }, [visibleColumns]);

  // ⚡ EXCEL-LIKE: Keep multiRowsRef in sync
  useEffect(() => {
    multiRowsRef.current = multiRows;
  }, [multiRows]);

  // ⚡ PERF: Selection refresh is now handled inline by updateSelectionRange — no useEffect needed.

  // ⚡ EXCEL-LIKE: Handle cell mouse down - start drag selection
  // FIXED: Only allow left mouse button (button === 0) for drag selection
  const handleCellMouseDown = useCallback((rowIndex: number, colId: string, shiftKey: boolean, mouseButton: number) => {
    // Only allow left mouse button (button === 0) for selection
    if (mouseButton !== 0) return;

    if (shiftKey && rangeStartCellRef.current) {
      setSelectionRange({
        startRow: rangeStartCellRef.current.rowIndex,
        endRow: rowIndex,
        startCol: rangeStartCellRef.current.colId,
        endCol: colId,
      });
    } else {
      isDraggingRef.current = true;
      dragStartCellRef.current = { rowIndex, colId };
      rangeStartCellRef.current = { rowIndex, colId };
      setSelectionRange(null);
    }
  }, [setSelectionRange]);

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

    updateSelectionRange({
      startRow: startRow,
      endRow: rowIndex,
      startCol: startCol,
      endCol: colId,
    });
  }, [updateSelectionRange]);

  // ⚡ EXCEL-LIKE: Handle cell click for shift+click selection
  const handleCellClick = useCallback((rowIndex: number, colId: string, shiftKey: boolean) => {
    if (shiftKey && rangeStartCellRef.current) {
      setSelectionRange({
        startRow: rangeStartCellRef.current.rowIndex,
        endRow: rowIndex,
        startCol: rangeStartCellRef.current.colId,
        endCol: colId,
      });
    } else {
      rangeStartCellRef.current = { rowIndex, colId };
      setSelectionRange(null);
    }
  }, [setSelectionRange]);

  // ⚡ EXCEL-LIKE: Handle mouse up - end drag selection and sync React state
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        // Sync final drag selection to React state (for JSX chip display)
        if (selectedRangeRef.current) {
          setSelectedRange(selectedRangeRef.current);
        }
      }
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // ⚡ UNDO/REDO: Save a cell-level undo action
  const saveCellUndoAction = useCallback((action: UndoAction) => {
    undoStackRef.current.push(action);
    if (undoStackRef.current.length > MAX_UNDO_HISTORY) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
  }, []);

  // ⚡ UNDO/REDO: Handle Ctrl+Z
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) {
      toast('Nothing to undo', { icon: 'ℹ️', duration: 1500 });
      return;
    }

    const action = undoStackRef.current.pop()!;
    const newRows = [...multiRowsRef.current];

    if (action.type === 'paste' && action.pasteData) {
      // Restore all rows from before paste
      const { startRow, oldRows } = action.pasteData;
      for (let i = 0; i < oldRows.length; i++) {
        if (startRow + i < newRows.length) {
          newRows[startRow + i] = { ...oldRows[i] };
        }
      }
      redoStackRef.current.push({
        type: 'paste',
        pasteData: {
          startRow: action.pasteData.startRow,
          endRow: action.pasteData.endRow,
          oldRows: action.pasteData.oldRows,
          newRows: action.pasteData.newRows,
        },
      });
      setMultiRows(newRows);
      gridRef.current?.refreshCells({ force: true });
      toast.success('Paste undone', { duration: 1500 });
    } else if (action.type === 'fillDown' && action.pasteData) {
      const { startRow, oldRows } = action.pasteData;
      for (let i = 0; i < oldRows.length; i++) {
        if (startRow + i < newRows.length) {
          newRows[startRow + i] = { ...oldRows[i] };
        }
      }
      redoStackRef.current.push({
        type: 'fillDown',
        pasteData: {
          startRow: action.pasteData.startRow,
          endRow: action.pasteData.endRow,
          oldRows: action.pasteData.oldRows,
          newRows: action.pasteData.newRows,
        },
      });
      setMultiRows(newRows);
      gridRef.current?.refreshCells({ force: true });
      toast.success('Fill down undone', { duration: 1500 });
    } else if (action.type === 'cell') {
      if (action.rowIndex !== undefined && action.field) {
        if (action.oldRowData) {
          newRows[action.rowIndex] = { ...action.oldRowData };
        } else {
          newRows[action.rowIndex] = { ...newRows[action.rowIndex], [action.field]: action.oldValue || '' };
        }
        redoStackRef.current.push({
          type: 'cell',
          rowIndex: action.rowIndex,
          field: action.field,
          oldValue: action.oldValue,
          newValue: action.newValue,
          oldRowData: action.oldRowData,
          newRowData: action.newRowData,
        });
        setMultiRows(newRows);
        gridRef.current?.refreshCells({ force: true });
      }
    }
  }, []);

  // ⚡ UNDO/REDO: Handle Ctrl+Y / Ctrl+Shift+Z
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) {
      toast('Nothing to redo', { icon: 'ℹ️', duration: 1500 });
      return;
    }

    const action = redoStackRef.current.pop()!;
    const newRows = [...multiRowsRef.current];

    if ((action.type === 'paste' || action.type === 'fillDown') && action.pasteData) {
      const { startRow, newRows: pastedRows } = action.pasteData;
      for (let i = 0; i < pastedRows.length; i++) {
        if (startRow + i < newRows.length) {
          newRows[startRow + i] = { ...pastedRows[i] };
        }
      }
      undoStackRef.current.push({
        type: action.type,
        pasteData: {
          startRow: action.pasteData.startRow,
          endRow: action.pasteData.endRow,
          oldRows: action.pasteData.oldRows,
          newRows: action.pasteData.newRows,
        },
      });
      setMultiRows(newRows);
      gridRef.current?.refreshCells({ force: true });
      toast.success(`${action.type === 'paste' ? 'Paste' : 'Fill down'} redone`, { duration: 1500 });
    } else if (action.type === 'cell') {
      if (action.rowIndex !== undefined && action.field) {
        if (action.newRowData) {
          newRows[action.rowIndex] = { ...action.newRowData };
        } else {
          newRows[action.rowIndex] = { ...newRows[action.rowIndex], [action.field]: action.newValue || '' };
        }
        undoStackRef.current.push({
          type: 'cell',
          rowIndex: action.rowIndex,
          field: action.field,
          oldValue: action.oldValue,
          newValue: action.newValue,
          oldRowData: action.oldRowData,
          newRowData: action.newRowData,
        });
        setMultiRows(newRows);
        gridRef.current?.refreshCells({ force: true });
      }
    }
  }, []);

  // ⚡ EXCEL-LIKE: Fill Down (Ctrl+D) — Copy first cell value down through selection
  const handleFillDown = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    const range = selectedRangeRef.current;
    if (!range) {
      toast('Select a range first (Shift+Arrow or drag)', { icon: 'ℹ️', duration: 2000 });
      return;
    }

    const minRow = Math.min(range.startRow, range.endRow);
    const maxRow = Math.max(range.startRow, range.endRow);
    if (minRow === maxRow) return;

    const allColumns = api.getAllDisplayedColumns?.() || [];
    const colIds = allColumns.map((c: any) => c.getColId());
    const startColIndex = colIds.indexOf(range.startCol);
    const endColIndex = colIds.indexOf(range.endCol);
    const minCol = Math.min(startColIndex, endColIndex);
    const maxCol = Math.max(startColIndex, endColIndex);

    const newRows = [...multiRowsRef.current];
    const oldRows = newRows.slice(minRow, maxRow + 1).map(r => ({ ...r }));
    let filled = 0;

    for (let c = minCol; c <= maxCol; c++) {
      const colId = colIds[c];
      if (!EDITABLE_COLUMNS.includes(colId)) continue;
      const sourceValue = newRows[minRow]?.[colId] || '';
      for (let r = minRow + 1; r <= maxRow; r++) {
        newRows[r] = { ...newRows[r], [colId]: sourceValue };
        filled++;
      }
    }

    if (filled > 0) {
      const newRowsSnapshot = newRows.slice(minRow, maxRow + 1).map(r => ({ ...r }));
      saveCellUndoAction({
        type: 'fillDown',
        pasteData: {
          startRow: minRow,
          endRow: maxRow,
          oldRows,
          newRows: newRowsSnapshot,
        },
      });
      setMultiRows(newRows);
      api.refreshCells({ force: true });
      toast.success(`Filled ${filled} cells`, { duration: 1500 });
    }
  }, [saveCellUndoAction]);

  // ⚡ EXCEL-LIKE: Paste handler (Excel multi-row/cell paste with auto-populate)
  useEffect(() => {
    if (currentTabCode !== 'multi') return;

    const handlePaste = async (e: ClipboardEvent) => {
      // Skip if user is editing an input/textarea (let native paste work)
      const activeEl = document.activeElement;
      if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') return;

      const api = gridRef.current;
      if (!api) return;

      const focusedCell = api.getFocusedCell();
      if (!focusedCell) return;

      e.preventDefault();

      const clipText = e.clipboardData?.getData('text/plain') || '';
      if (!clipText.trim()) return;

      // Parse clipboard: rows by newline, columns by tab
      const clipRows = clipText.split(/\r?\n/).filter(line => line.trim());
      if (clipRows.length === 0) return;

      const allColumns = api.getAllDisplayedColumns?.() || [];
      const colIds = allColumns.map((c: any) => c.getColId());
      const startColIndex = colIds.indexOf(focusedCell.column.getColId());
      const startRow = focusedCell.rowIndex;

      // Auto-extend rows if paste goes beyond current grid
      let currentRows = [...multiRowsRef.current];
      const neededRows = startRow + clipRows.length + 50;
      if (neededRows > currentRows.length) {
        const emptyRow = () => {
          rowIdCounterRef.current++;
          return {
            _rowId: `qc_paste_${rowIdCounterRef.current}_${Date.now()}`,
            wsn: '', qcdate: new Date().toISOString().split('T')[0], qcbyname: '',
            productserialnumber: '', rackno: '', qcgrade: '', qcremarks: '', otherremarks: '',
            fsn: '', producttitle: '', brand: '', cmsvertical: '', hsnsac: '', igstrate: '',
            mrp: '', fsp: '', vrp: '', yieldvalue: '', ptype: '', psize: '',
            fktlink: '', whlocation: '', orderid: '', fkqcremark: '', fkgrade: '', invoicedate: '',
          };
        };
        while (currentRows.length < neededRows) {
          currentRows.push(emptyRow());
        }
      }

      // Save snapshot for undo
      const endRow = Math.min(startRow + clipRows.length - 1, currentRows.length - 1);
      const oldRows = currentRows.slice(startRow, endRow + 1).map(r => ({ ...r }));

      // Apply paste data
      const wsnsToPrefetch: string[] = [];
      for (let r = 0; r < clipRows.length; r++) {
        const rowIdx = startRow + r;
        if (rowIdx >= currentRows.length) break;

        const cells = clipRows[r].split('\t');
        for (let c = 0; c < cells.length; c++) {
          const colIdx = startColIndex + c;
          if (colIdx >= colIds.length) break;

          const colId = colIds[colIdx];
          if (!EDITABLE_COLUMNS.includes(colId)) continue;

          const value = (cells[c] || '').trim().toUpperCase();
          currentRows[rowIdx] = { ...currentRows[rowIdx], [colId]: value };

          // Collect WSNs for master data fetch
          if (colId === 'wsn' && value) {
            wsnsToPrefetch.push(value);
          }
        }
      }

      const newRowsSnapshot = currentRows.slice(startRow, endRow + 1).map(r => ({ ...r }));

      // Save undo action
      saveCellUndoAction({
        type: 'paste',
        pasteData: {
          startRow,
          endRow,
          oldRows,
          newRows: newRowsSnapshot,
        },
      });

      // --- Duplicate check BEFORE master data fetch ---
      // Check if any pasted WSN already exists elsewhere in the grid
      let wsnsToFetch: string[] = [];
      if (wsnsToPrefetch.length > 0) {
        const uniquePastedWSNs = Array.from(new Set(wsnsToPrefetch));

        // Count WSN occurrences across entire grid
        const wsnCountMap = new Map<string, number>();
        currentRows.forEach(r => {
          const w = r.wsn?.trim()?.toUpperCase();
          if (w) wsnCountMap.set(w, (wsnCountMap.get(w) || 0) + 1);
        });
        const gridDupWSNs = new Set<string>();
        uniquePastedWSNs.forEach(wsn => {
          if ((wsnCountMap.get(wsn) || 0) > 1) gridDupWSNs.add(wsn);
        });

        // Auto-remove duplicate WSNs from pasted rows BEFORE fetch
        if (gridDupWSNs.size > 0) {
          let removedCount = 0;
          for (let r = startRow; r <= endRow && r < currentRows.length; r++) {
            const w = currentRows[r].wsn?.trim()?.toUpperCase();
            if (w && gridDupWSNs.has(w)) {
              currentRows[r] = { ...currentRows[r], wsn: '' };
              ALL_MASTER_COLUMNS.forEach(col => { currentRows[r][col] = ''; });
              removedCount++;
            }
          }
          if (removedCount > 0) {
            toast.error(`Removed ${gridDupWSNs.size} duplicate WSN(s) from pasted data`, {
              duration: 5000,
              style: { fontWeight: 600, fontSize: '14px' },
            });
          }
        }

        // Only fetch for non-duplicate WSNs that remain in the grid
        wsnsToFetch = uniquePastedWSNs.filter(wsn => !gridDupWSNs.has(wsn));
      }

      // Update state with paste data (including duplicate removals)
      multiRowsRef.current = currentRows;
      setMultiRows(currentRows);
      api.refreshCells({ force: true });

      // Fetch master data for non-duplicate pasted WSNs
      if (wsnsToFetch.length > 0) {
        toast.loading(`Fetching data for ${wsnsToFetch.length} WSN(s)...`, { id: 'paste-fetch' });

        let fetchedCount = 0;

        // Batch fetch with concurrency limit
        const BATCH_SIZE = 20;
        for (let i = 0; i < wsnsToFetch.length; i += BATCH_SIZE) {
          const batch = wsnsToFetch.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map(async (wsn) => {
              try {
                // Try cache first
                const { getAvailableByWSNFast } = await import('@/lib/wmsCache');
                const cached = await getAvailableByWSNFast(wsn, activeWarehouse?.id || 0);
                if (cached) return { wsn, data: cached, source: 'cache' };

                // Fallback to API
                const res = await qcAPI.getPendingInbound(activeWarehouse?.id, wsn);
                const items = res.data?.data || res.data || [];
                const match = items.find?.((item: any) => item.wsn?.toUpperCase() === wsn.toUpperCase());
                return match ? { wsn, data: match, source: 'api' } : { wsn, data: null, source: 'api' };
              } catch {
                return { wsn, data: null, source: 'error' };
              }
            })
          );

          // Use multiRowsRef.current for freshest state (not stale copy)
          const latestRows = [...multiRowsRef.current];

          for (const result of results) {
            if (result.status !== 'fulfilled' || !result.value?.data) continue;
            const { wsn, data } = result.value;

            // Find all rows with this WSN and populate master data
            for (let r = startRow; r <= endRow && r < latestRows.length; r++) {
              if (latestRows[r].wsn?.toUpperCase() === wsn.toUpperCase()) {
                latestRows[r] = {
                  ...latestRows[r],
                  fsn: data.fsn || data.FSN || '',
                  producttitle: data.product_title || data.producttitle || '',
                  brand: data.brand || '',
                  cmsvertical: data.cms_vertical || data.cmsvertical || '',
                  hsnsac: data.hsn_sac || data.hsnsac || '',
                  igstrate: data.igst_rate || data.igstrate || '',
                  mrp: data.mrp || '',
                  fsp: data.fsp || '',
                  vrp: data.vrp || '',
                  yieldvalue: data.yield_value || data.yieldvalue || '',
                  ptype: data.p_type || data.ptype || '',
                  psize: data.p_size || data.psize || '',
                  fktlink: data.fkt_link || data.fktlink || '',
                  whlocation: data.wh_location || data.whlocation || '',
                  orderid: data.order_id || data.orderid || '',
                  fkqcremark: data.fkqc_remark || data.fkqcremark || '',
                  fkgrade: data.fk_grade || data.fkgrade || '',
                  invoicedate: data.invoice_date || data.invoicedate || '',
                };
                fetchedCount++;
              }
            }
          }

          // Commit fetched data back to state
          multiRowsRef.current = latestRows;
          setMultiRows([...latestRows]);
          api.refreshCells({ force: true });
        }

        toast.dismiss('paste-fetch');
        toast.success(`Pasted ${clipRows.length} row(s), fetched data for ${fetchedCount} WSN(s)`, { duration: 3000 });
      } else if (wsnsToPrefetch.length === 0) {
        toast.success(`Pasted ${clipRows.length} row(s)`, { duration: 2000 });
      }
    };

    // ⚡ EXCEL-LIKE: Copy handler (Ctrl+C for single cell or selected range)
    const handleCopy = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      const isEditing = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      if (isEditing) return; // Let native copy work in inputs

      const api = gridRef.current;
      if (!api) return;

      const range = selectedRangeRef.current;
      const rows = multiRowsRef.current;
      const allColumns = api.getAllDisplayedColumns() || [];
      const colIds = allColumns.map((c: any) => c.getColId());

      let text = '';

      if (range) {
        // Multi-cell range copy
        const minRow = Math.min(range.startRow, range.endRow);
        const maxRow = Math.max(range.startRow, range.endRow);
        const startColIdx = colIds.indexOf(range.startCol);
        const endColIdx = colIds.indexOf(range.endCol);
        const minCol = Math.min(startColIdx, endColIdx);
        const maxCol = Math.max(startColIdx, endColIdx);

        const lines: string[] = [];
        for (let r = minRow; r <= maxRow; r++) {
          const cells: string[] = [];
          for (let c = minCol; c <= maxCol; c++) {
            const colId = colIds[c];
            const val = rows[r]?.[colId];
            cells.push(val != null ? String(val) : '');
          }
          lines.push(cells.join('\t'));
        }
        text = lines.join('\n');
      } else {
        // Single focused cell copy
        const focusedCell = api.getFocusedCell();
        if (!focusedCell) return;
        const { rowIndex, column } = focusedCell;
        const colId = column.getColId();
        const val = rows[rowIndex]?.[colId];
        text = val != null ? String(val) : '';
      }

      if (text) {
        e.preventDefault();
        navigator.clipboard.writeText(text).catch(() => {
          // Fallback for older browsers
          try {
            e.clipboardData?.setData('text/plain', text);
          } catch { /* ignore */ }
        });
      }
    };

    document.addEventListener('paste', handlePaste);
    document.addEventListener('copy', handleCopy);
    return () => {
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('copy', handleCopy);
    };
  }, [currentTabCode, activeWarehouse?.id, saveCellUndoAction]);

  // ⚡ EXCEL-LIKE: Clear selected cells (Delete/Backspace)
  const handleClearCells = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    const range = selectedRangeRef.current;
    if (!range) {
      const focusedCell = api.getFocusedCell();
      if (!focusedCell) return;
      const { rowIndex, column } = focusedCell;
      const colId = column.getColId();
      if (!EDITABLE_COLUMNS.includes(colId)) return;

      const newRows = [...multiRowsRef.current];

      // If WSN is being cleared, also clear all master data columns
      if (colId === 'wsn') {
        const clearedRow = { ...newRows[rowIndex], wsn: '' };
        ALL_MASTER_COLUMNS.forEach(col => { clearedRow[col] = ''; });
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
      ALL_MASTER_COLUMNS.forEach(col => {
        newRows[r] = { ...newRows[r], [col]: '' };
      });
    });

    if (cleared > 0) {
      setMultiRows(newRows);
      api.refreshCells({ force: true });
      toast.success(`Cleared ${cleared} cells`, { duration: 1500 });
    }
  }, []);

  // ⚡ EXCEL-LIKE: Select All (Ctrl+A)
  const handleSelectAll = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    const totalRows = api.getDisplayedRowCount();
    if (totalRows === 0) return;

    const allColumns = api.getAllDisplayedColumns() || [];
    const editableColIds = allColumns.map((c: any) => c.getColId()).filter((id: string) => EDITABLE_COLUMNS.includes(id));

    const firstCol = editableColIds[0] || 'wsn';
    const lastCol = editableColIds[editableColIds.length - 1] || 'wsn';

    setSelectionRange({
      startRow: 0,
      endRow: totalRows - 1,
      startCol: firstCol,
      endCol: lastCol,
    });

    rangeStartCellRef.current = { rowIndex: 0, colId: firstCol };
    toast('All rows selected', { icon: '✓', duration: 1500 });
  }, [setSelectionRange]);

  // ⚡ EXCEL-LIKE: Smooth scroll to row (Inbound-style with visibility check)
  const ensureRowVisible = useCallback((rowIndex: number, position: 'top' | 'middle' | 'bottom' = 'bottom', rowsBelow = 3, onComplete?: () => void, immediate = false) => {
    // If user recently scrolled manually, don't auto-scroll (prevents jarring jumps)
    if (userScrolledRef.current && !immediate) {
      onComplete?.();
      return;
    }

    isAutoScrollingRef.current = true;

    try {
      const api = gridRef.current;
      if (!api) {
        isAutoScrollingRef.current = false;
        onComplete?.();
        return;
      }

      // Get visible row range to check if row is already visible
      const firstVisibleRow = api.getFirstDisplayedRowIndex?.() ?? 0;
      const lastVisibleRow = api.getLastDisplayedRowIndex?.() ?? 0;

      // Calculate comfortable visible range (with some buffer)
      const topBuffer = 2;
      const bottomBuffer = rowsBelow;

      const isAlreadyVisible = rowIndex >= (firstVisibleRow + topBuffer) &&
        rowIndex <= (lastVisibleRow - bottomBuffer);

      // If row is already comfortably visible, don't scroll
      if (isAlreadyVisible) {
        isAutoScrollingRef.current = false;
        onComplete?.();
        return;
      }

      // Dynamic position: scanner mode uses 'middle' for minimal movement
      const effectivePosition = (scanningModeRef.current || immediate)
        ? 'middle'
        : (rowIndex < firstVisibleRow ? 'top' : position);

      api.ensureIndexVisible(rowIndex, effectivePosition);

      // Small delay to let AG Grid finish scrolling, then invoke callback
      setTimeout(() => {
        isAutoScrollingRef.current = false;
        onComplete?.();
      }, 50);

    } catch (e) {
      isAutoScrollingRef.current = false;
      onComplete?.();
    }
  }, []);

  // 🖨️ PRINT: Print a WSN label for a specific row
  const printRowWSN = useCallback(async (rowData: any) => {
    if (!rowData?.wsn) {
      toast.error('No WSN to print');
      return;
    }
    if (!agentReady) {
      toast.error('Print agent is not running. Please start the WMS Print Agent app.', { duration: 4000 });
      return;
    }
    try {
      const payload = {
        wsn: rowData.wsn || '',
        fsn: rowData.fsn || '',
        product_title: rowData.producttitle || '',
        brand: rowData.brand || '',
        mrp: rowData.mrp || '',
        fsp: rowData.fsp || '',
        cms_vertical: rowData.cmsvertical || '',
        p_type: rowData.ptype || '',
        p_size: rowData.psize || '',
        rack_no: rowData.rackno || '',
        qc_grade: rowData.qcgrade || '',
      };
      await printLabel(payload);
      toast.success(`Printing label for ${rowData.wsn}`, { duration: 2000 });
    } catch (err: any) {
      toast.error(`Print failed: ${err.message || 'Unknown error'}`, { duration: 4000 });
    }
  }, [agentReady]);

  // ⚡ EXCEL-LIKE: Keyboard shortcuts for Multi QC tab
  useEffect(() => {
    if (currentTabCode !== 'multi') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrlKey = e.ctrlKey || e.metaKey;
      const shiftKey = e.shiftKey;

      const activeEl = document.activeElement;
      const isEditing = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';

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

      // Ctrl+Z - Undo
      if (ctrlKey && !shiftKey && e.key.toLowerCase() === 'z' && !isEditing) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z - Redo
      if ((ctrlKey && e.key.toLowerCase() === 'y' && !isEditing) || (ctrlKey && shiftKey && e.key.toLowerCase() === 'z' && !isEditing)) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl+D - Fill Down
      if (ctrlKey && e.key.toLowerCase() === 'd' && !isEditing) {
        e.preventDefault();
        handleFillDown();
        return;
      }

      // 🖨️ Ctrl+P - Print last scanned WSN label
      if (ctrlKey && e.key.toLowerCase() === 'p' && !isEditing) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!ctrlPPrintEnabled) return;
        const rowData = lastScannedRowRef.current;
        if (rowData && rowData.wsn) {
          printRowWSN(rowData);
        } else {
          // Fallback: try focused row
          const api = gridRef.current;
          if (api) {
            const focusedCell = api.getFocusedCell();
            if (focusedCell) {
              const row = multiRowsRef.current[focusedCell.rowIndex];
              if (row?.wsn) {
                printRowWSN(row);
              } else {
                toast.error('No WSN in focused row to print');
              }
            }
          }
        }
        return;
      }

      // 🔗 Ctrl+O - Open product link for last scanned WSN
      if (ctrlKey && e.key.toLowerCase() === 'o' && !isEditing) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!ctrlOProductLinkEnabled) return;
        const rowData = lastScannedRowRef.current;
        let fktLink = rowData?.fktlink;
        if (!fktLink) {
          // Fallback: try focused row
          const api = gridRef.current;
          if (api) {
            const focusedCell = api.getFocusedCell();
            if (focusedCell) {
              fktLink = multiRowsRef.current[focusedCell.rowIndex]?.fktlink;
            }
          }
        }
        if (fktLink) {
          const url = fktLink.startsWith('http') ? fktLink : `https://${fktLink}`;
          window.open(url, '_blank');
        } else {
          toast.error('No product link available for this WSN');
        }
        return;
      }

      // ⚡ EXCEL-LIKE: Ctrl+Arrow - Excel boundary-jumping behavior
      if (ctrlKey && !shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditing) {
        const api = gridRef.current;
        if (!api) return;
        const focusedCell = api.getFocusedCell();
        if (!focusedCell) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const currentRow = focusedCell.rowIndex;
        const currentColId = focusedCell.column.getColId();
        const totalRows = api.getDisplayedRowCount();
        const allColumns = api.getAllDisplayedColumns() || [];
        const colIds = allColumns.map((c: any) => c.getColId());

        let targetRow = currentRow;
        let targetColId = currentColId;

        // Helper: check if a cell has data
        const hasCellData = (r: number, colId: string): boolean => {
          const rowData = api.getDisplayedRowAtIndex(r)?.data;
          if (!rowData) return false;
          const val = rowData[colId];
          return val !== undefined && val !== null && String(val).trim() !== '';
        };

        if (e.key === 'ArrowDown') {
          const currentHasData = hasCellData(currentRow, currentColId);
          if (currentHasData) {
            const nextRow = currentRow + 1;
            if (nextRow >= totalRows) {
              targetRow = currentRow;
            } else if (hasCellData(nextRow, currentColId)) {
              let r = nextRow;
              while (r + 1 < totalRows && hasCellData(r + 1, currentColId)) r++;
              targetRow = r;
            } else {
              let found = false;
              for (let r = nextRow + 1; r < totalRows; r++) {
                if (hasCellData(r, currentColId)) { targetRow = r; found = true; break; }
              }
              if (!found) targetRow = currentRow;
            }
          } else {
            let found = false;
            for (let r = currentRow + 1; r < totalRows; r++) {
              if (hasCellData(r, currentColId)) { targetRow = r; found = true; break; }
            }
            if (!found) targetRow = totalRows - 1;
          }
        } else if (e.key === 'ArrowUp') {
          const currentHasData = hasCellData(currentRow, currentColId);
          if (currentHasData) {
            const prevRow = currentRow - 1;
            if (prevRow < 0) {
              targetRow = 0;
            } else if (hasCellData(prevRow, currentColId)) {
              let r = prevRow;
              while (r - 1 >= 0 && hasCellData(r - 1, currentColId)) r--;
              targetRow = r;
            } else {
              let found = false;
              for (let r = prevRow - 1; r >= 0; r--) {
                if (hasCellData(r, currentColId)) { targetRow = r; found = true; break; }
              }
              if (!found) targetRow = currentRow;
            }
          } else {
            let found = false;
            for (let r = currentRow - 1; r >= 0; r--) {
              if (hasCellData(r, currentColId)) { targetRow = r; found = true; break; }
            }
            if (!found) targetRow = 0;
          }
        } else if (e.key === 'ArrowRight') {
          const colIdx = colIds.indexOf(currentColId);
          if (colIdx < colIds.length - 1) {
            const currentHasData = hasCellData(currentRow, currentColId);
            if (currentHasData) {
              const nextColId = colIds[colIdx + 1];
              if (hasCellData(currentRow, nextColId)) {
                let c = colIdx + 1;
                while (c + 1 < colIds.length && hasCellData(currentRow, colIds[c + 1])) c++;
                targetColId = colIds[c];
              } else {
                let found = false;
                for (let c = colIdx + 2; c < colIds.length; c++) {
                  if (hasCellData(currentRow, colIds[c])) { targetColId = colIds[c]; found = true; break; }
                }
                if (!found) targetColId = colIds[colIds.length - 1];
              }
            } else {
              let found = false;
              for (let c = colIdx + 1; c < colIds.length; c++) {
                if (hasCellData(currentRow, colIds[c])) { targetColId = colIds[c]; found = true; break; }
              }
              if (!found) targetColId = colIds[colIds.length - 1];
            }
          }
        } else if (e.key === 'ArrowLeft') {
          const colIdx = colIds.indexOf(currentColId);
          if (colIdx > 0) {
            const currentHasData = hasCellData(currentRow, currentColId);
            if (currentHasData) {
              const prevColId = colIds[colIdx - 1];
              if (hasCellData(currentRow, prevColId)) {
                let c = colIdx - 1;
                while (c - 1 >= 0 && hasCellData(currentRow, colIds[c - 1])) c--;
                targetColId = colIds[c];
              } else {
                let found = false;
                for (let c = colIdx - 2; c >= 0; c--) {
                  if (hasCellData(currentRow, colIds[c])) { targetColId = colIds[c]; found = true; break; }
                }
                if (!found) targetColId = colIds[0];
              }
            } else {
              let found = false;
              for (let c = colIdx - 1; c >= 0; c--) {
                if (hasCellData(currentRow, colIds[c])) { targetColId = colIds[c]; found = true; break; }
              }
              if (!found) targetColId = colIds[0];
            }
          }
        }

        setSelectionRange(null);
        rangeStartCellRef.current = null;
        api.setFocusedCell(targetRow, targetColId);
        // Only scroll when row changes (not for horizontal movement)
        if (targetRow !== currentRow) {
          api.ensureIndexVisible(targetRow, 'middle');
        }
        api.refreshCells({ force: true });
        return;
      }

      // ⚡ EXCEL-LIKE: Ctrl+Shift+Arrow - Select to last cell with data in direction
      if (ctrlKey && shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditing) {
        const api = gridRef.current;
        if (!api) return;
        const focusedCell = api.getFocusedCell();
        if (!focusedCell) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const { rowIndex, column } = focusedCell;
        const colId = column.getColId();
        const allColumns = api.getAllDisplayedColumns() || [];
        const colIds = allColumns.map((c: any) => c.getColId());

        if (!rangeStartCellRef.current) {
          rangeStartCellRef.current = { rowIndex, colId };
        }

        const currentRange = selectedRangeRef.current;
        let endRow = currentRange ? currentRange.endRow : rowIndex;
        let endCol = currentRange ? currentRange.endCol : colId;
        let endColIndex = colIds.indexOf(endCol);

        if (e.key === 'ArrowDown') {
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

        setSelectionRange({
          startRow: rangeStartCellRef.current.rowIndex,
          endRow,
          startCol: rangeStartCellRef.current.colId,
          endCol,
        });

        api.setFocusedCell(endRow, endCol);
        api.ensureIndexVisible(endRow, 'middle');
        return;
      }

      // Arrow keys without Shift - Clear selection and move
      if (!shiftKey && !ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditing) {
        if (selectedRangeRef.current) {
          setSelectionRange(null);
          rangeStartCellRef.current = null;
        }
        return;
      }

      // Shift+Arrow keys - Extend selection (Excel-like from current end position)
      if (shiftKey && !ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditing) {
        const api = gridRef.current;
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
        setSelectionRange({
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTabCode, handleSelectAll, handleClearCells, handleUndo, handleRedo, handleFillDown, setSelectionRange, ctrlPPrintEnabled, ctrlOProductLinkEnabled, printRowWSN]);


  // FETCH PRODUCT DETAILS FOR SINGLE ENTRY
  const fetchProductDetails = async (wsn: string) => {
    if (!wsn.trim()) {
      setSingleProduct({
        fsn: '',
        product_title: '',
        brand: '',
        cms_vertical: '',
        mrp: '',
        fsp: '',
        fkt_link: '',
      });
      return;
    }

    const upperWsn = wsn.trim().toUpperCase();

    try {
      // Try pending inbound first
      const pendingResponse = await qcAPI.getPendingInbound(activeWarehouse?.id, upperWsn);
      if (pendingResponse.data.length > 0) {
        const item = pendingResponse.data[0];
        setSingleProduct({
          fsn: item.fsn || '',
          product_title: item.product_title || '',
          brand: item.brand || '',
          cms_vertical: item.cms_vertical || '',
          mrp: item.mrp || '',
          fsp: item.fsp || '',
          fkt_link: item.fkt_link || '',
        });
        return;
      }

      // If not in pending, try QC list
      const listResponse = await qcAPI.getList(1, 1, {
        warehouseId: activeWarehouse?.id,
        search: upperWsn,
      });
      if (listResponse.data?.data?.length > 0) {
        const item = listResponse.data.data[0];
        setSingleProduct({
          fsn: item.fsn || '',
          product_title: item.product_title || '',
          brand: item.brand || '',
          cms_vertical: item.cms_vertical || '',
          mrp: item.mrp || '',
          fsp: item.fsp || '',
          fkt_link: item.fkt_link || '',
        });
        return;
      }

      // If not found, clear
      setSingleProduct({
        fsn: '',
        product_title: '',
        brand: '',
        cms_vertical: '',
        mrp: '',
        fsp: '',
        fkt_link: '',
      });
    } catch (error) {
      console.error('Failed to fetch product details:', error);
      setSingleProduct({
        fsn: '',
        product_title: '',
        brand: '',
        cms_vertical: '',
        mrp: '',
        fsp: '',
        fkt_link: '',
      });
    }
  };

  // ? Debounce search filter (300ms delay for smooth performance)
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
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

  // LOAD DATA
  useEffect(() => {
    if (!activeWarehouse) return;

    if (currentTabCode === 'list') {
      loadQCList();
      loadStats();
      loadBatches();
    } else if (currentTabCode === 'single') {
      loadRacks();
    } else if (currentTabCode === 'multi' || currentTabCode === 'bulk') {
      loadRacks();
    } else if (currentTabCode === 'batches') {
      loadBatches();
      loadStats();
    }
    loadBrands();
    loadCategories();
  }, [
    activeWarehouse,
    currentTabCode,
    page,
    limit,
    searchDebounced,
    statusFilter,
    gradeFilter,
    brandFilter,
    categoryFilter,
    dateFromFilter,
    dateToFilter,
  ]);


  // Add localStorage management for listColumns
  useEffect(() => {
    const saved = localStorage.getItem('qc_list_columns');
    if (saved) {
      setListColumns(JSON.parse(saved));
    } else {
      setListColumns(DEFAULT_LIST_COLUMNS);
    }
  }, []);


  // Save to localStorage when columns change
  const handleListColumnToggle = (key: string) => {
    // Check if column exists in listColumns
    const existingCol = listColumns.find(col => col.key === key);

    let updated: ColumnConfig[];
    if (existingCol) {
      // Toggle visibility of existing column
      updated = listColumns.map(col =>
        col.key === key ? { ...col, visible: !col.visible } : col
      );
    } else {
      // Column doesn't exist in array - add it at correct position based on ALL_LIST_COLUMNS order
      const newCol = { key, visible: true };
      const allKeys = ALL_LIST_COLUMNS;
      const targetIndex = allKeys.indexOf(key);

      // Find the right insertion point to maintain order
      let insertIndex = listColumns.length;
      for (let i = 0; i < listColumns.length; i++) {
        const currentColIndex = allKeys.indexOf(listColumns[i].key);
        if (currentColIndex > targetIndex) {
          insertIndex = i;
          break;
        }
      }

      updated = [
        ...listColumns.slice(0, insertIndex),
        newCol,
        ...listColumns.slice(insertIndex)
      ];
    }

    setListColumns(updated);
    localStorage.setItem('qc_list_columns', JSON.stringify(updated));

    // Use ag-Grid API to toggle column visibility WITHOUT rebuilding columnDefs
    // This preserves column order
    const api = listGridRef.current;
    if (api) {
      const shouldShow = existingCol ? !existingCol.visible : true;
      api.setColumnsVisible([key], shouldShow);
      // Save the updated state
      try {
        const state = api.getColumnState();
        localStorage.setItem('qc_list_grid_state', JSON.stringify(state));
      } catch { /* ignore */ }
    }
  };

  // Column minWidth config based on content type for QC List
  const QC_COLUMN_MIN_WIDTHS: Record<string, number> = {
    wsn: 80,
    product_title: 400,
    brand: 100,
    cms_vertical: 120,
    mrp: 70,
    fsp: 70,
    inbound_date: 100,
    vehicle_no: 100,
    qc_date: 100,
    qc_by_name: 120,
    qc_grade: 90,
    qc_status: 90,
    qc_remarks: 150,
    updated_by_name: 120,
    updated_at: 140,
  };

  // ? LIST GRID COLUMN DEFINITIONS (AG GRID)
  // Include ALL columns with hide property - columnDefs structure never changes
  const listColumnDefs = useMemo(() => {
    const sr = {
      headerName: 'SR.NO',
      field: '__sr',
      valueGetter: (params: any) => params.node ? params.node.rowIndex + 1 + (page - 1) * limit : undefined,
      width: 20,
      cellStyle: { fontWeight: 700, textAlign: 'center', color: isDarkMode ? '#94a3b8' : '#64748b' },
      suppressMovable: true,
      sortable: false,
      filter: false,
      suppressSizeToFit: true,
    };

    // Include ALL columns - visibility controlled by ag-Grid state
    const cols = ALL_LIST_COLUMNS.map((col: string) => {
      const minWidth = QC_COLUMN_MIN_WIDTHS[col] || 100;

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

      // Status chip
      if (col === 'qc_status') {
        return {
          field: col,
          headerName: 'QC STATUS',
          cellStyle: (p: any) => {
            if (!p.value) return null;
            const value = p.value;
            const color = value === 'Pass' ? 'success' : value === 'Fail' ? 'error' : value === 'Done' ? 'info' : 'warning';
            const bgColor = color === 'success' ? '#d1fae5' : color === 'error' ? '#fee2e2' : color === 'info' ? '#dbeafe' : '#fef3c7';
            const textColor = color === 'success' ? '#065f46' : color === 'error' ? '#991b1b' : color === 'info' ? '#1e40af' : '#92400e';

            return {
              backgroundColor: bgColor,
              color: textColor,
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.7rem',
              fontWeight: '600' as any,
              textAlign: 'center' as any,
            };
          },
          minWidth,
          hide: false,
        };
      }

      // Grade chip
      if (col === 'qc_grade') {
        return {
          field: col,
          headerName: 'QC GRADE',
          cellStyle: (p: any) => {
            if (!p.value) return null;
            return {
              backgroundColor: '#e0e7ff',
              color: '#3730a3',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.7rem',
              fontWeight: '700' as any,
              textAlign: 'center' as any,
            };
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
  }, [page, limit, enableColumnFilters, enableSorting, enableColumnResize, isDarkMode]);

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

  // LOAD FUNCTIONS
  // ⚡ HELPER: Generate cache key for current filters
  const getCacheKey = useCallback(() => {
    return JSON.stringify({
      warehouseId: activeWarehouse?.id,
      page,
      limit,
      search: searchDebounced,
      status: statusFilter,
      grade: gradeFilter,
      brand: brandFilter,
      category: categoryFilter,
      dateFrom: dateFromFilter,
      dateTo: dateToFilter,
    });
  }, [activeWarehouse?.id, page, limit, searchDebounced, statusFilter, gradeFilter, brandFilter, categoryFilter, dateFromFilter, dateToFilter]);

  // ⚡ PREFETCH: Prefetch next page in background
  const prefetchNextPage = useCallback(async () => {
    const totalPages = Math.ceil(total / limit);
    if (page >= totalPages) return;

    const nextPageCacheKey = JSON.stringify({
      warehouseId: activeWarehouse?.id,
      page: page + 1,
      limit,
      search: searchDebounced,
      status: statusFilter,
      grade: gradeFilter,
      brand: brandFilter,
      category: categoryFilter,
      dateFrom: dateFromFilter,
      dateTo: dateToFilter,
    });

    const cached = pageCacheRef.current.get(nextPageCacheKey);
    if (cached && Date.now() - cached.timestamp < PAGE_CACHE_TTL) return;

    try {
      const response = await qcAPI.getList(page + 1, limit, {
        warehouseId: activeWarehouse?.id,
        search: searchDebounced,
        qcStatus: statusFilter,
        qc_grade: gradeFilter,
        brand: brandFilter,
        category: categoryFilter,
        dateFrom: dateFromFilter,
        dateTo: dateToFilter,
      });
      const rows = response.data?.data || [];
      pageCacheRef.current.set(nextPageCacheKey, {
        data: rows,
        total: response.data?.total || 0,
        timestamp: Date.now(),
      });
    } catch { /* Silently fail - prefetch is optional */ }
  }, [activeWarehouse?.id, page, limit, total, searchDebounced, statusFilter, gradeFilter, brandFilter, categoryFilter, dateFromFilter, dateToFilter]);

  const loadQCList = async ({ buttonRefresh = false } = {}) => {
    if (!activeWarehouse) return;

    // Use request id to ignore stale responses
    currentLoadIdRef.current += 1;
    const loadId = currentLoadIdRef.current;

    const cacheKey = getCacheKey();

    // ⚡ PAGE CACHE: Check cache first (unless force refresh)
    if (!buttonRefresh) {
      const cached = pageCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PAGE_CACHE_TTL) {
        previousDataRef.current = cached.data;
        setQcList(cached.data);
        setTotal(cached.total);
        setLastRefreshTime(new Date(cached.timestamp));
        setDataResponseReceived(true);
        // Keep spinner visible briefly for consistent UX during filter reset
        setTimeout(() => { setListLoading(false); setIsFetching(false); }, 300);
        setTimeout(() => prefetchNextPage(), 100);
        return;
      }
    }

    if (buttonRefresh) {
      setRefreshing(true);
      setRefreshSuccess(false);
    }

    // If we have no data yet, show full loader; otherwise show a delayed overlay to avoid flicker
    if (!qcList || qcList.length === 0) {
      setListLoading(true);
    } else {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      overlayShownRef.current = false;
      overlayStartRef.current = null;
      overlayTimerRef.current = setTimeout(() => {
        try {
          setTopLoading(true);
          overlayShownRef.current = true;
          overlayStartRef.current = Date.now();
          try { gridRef.current?.api?.hideOverlay(); } catch { }
        } catch (err) { }
        overlayTimerRef.current = null;
      }, SHOW_OVERLAY_DELAY);
    }

    // Mark fetching in-progress
    setIsFetching(true);

    // Cancel any previous in-flight request & pending empty timers
    if (qcAbortControllerRef.current) {
      try { qcAbortControllerRef.current.abort(); } catch { }
      qcAbortControllerRef.current = null;
    }
    if (emptyTimerRef.current) {
      clearTimeout(emptyTimerRef.current);
      emptyTimerRef.current = null;
    }
    const controller = new AbortController();
    qcAbortControllerRef.current = controller;

    try {
      const response = await qcAPI.getList(page, limit, {
        warehouseId: activeWarehouse?.id,
        search: searchDebounced,
        qcStatus: statusFilter,
        qc_grade: gradeFilter,
        brand: brandFilter,
        category: categoryFilter,
        dateFrom: dateFromFilter,
        dateTo: dateToFilter,
      });

      // Only apply if this is the latest request
      if (loadId === currentLoadIdRef.current) {
        const data = response.data?.data || [];
        setTotal(response.data?.total || 0);

        // Clear any pending empty timers (we are about to handle the new response)
        if (emptyTimerRef.current) {
          clearTimeout(emptyTimerRef.current);
          emptyTimerRef.current = null;
        }

        if (data.length === 0) {
          // Empty response → delayed clear to avoid flicker
          emptyTimerRef.current = setTimeout(() => {
            if (loadId === currentLoadIdRef.current) {
              setQcList([]);
              previousDataRef.current = [];
            }
            emptyTimerRef.current = null;
          }, EMPTY_CONFIRM_DELAY);
        } else {
          // Non-empty response: flash animation & update
          if (gridRef.current && gridRef.current.api) {
            const api = gridRef.current.api;
            try {
              // Flash animation logic (prevent blinking)
              if (previousDataRef.current && previousDataRef.current.length > 0) {
                const prevMap = new Map(previousDataRef.current.map((r: any) => [r.id || r.wsn, r]));
                const currMap = new Map(data.map((r: any) => [r.id || r.wsn, r]));

                api.forEachNode((rowNode: any) => {
                  const rowId = rowNode.data?.id || rowNode.data?.wsn;
                  const prev = prevMap.get(rowId);
                  const curr = currMap.get(rowId);

                  if (prev && curr && JSON.stringify(prev) !== JSON.stringify(curr)) {
                    try {
                      api.flashCells({ rowNodes: [rowNode], flashDelay: 100, fadeDelay: 400 });
                    } catch (e) { }
                  }
                });
              }

              setQcList(data);
              previousDataRef.current = data;
            } catch (err) {
              setQcList(data);
              previousDataRef.current = data;
            }
          } else {
            setQcList(data);
            previousDataRef.current = data;
          }
        }
        setDataResponseReceived(true); // Mark that we've received API response

        // ? WINDOW CACHE: Store in window for instant navigation (survives component unmount)
        if (typeof window !== 'undefined' && data && data.length > 0) {
          window.__QC_LIST_CACHE__ = {
            data: data,
            total: response.data?.total || 0,
            timestamp: Date.now(),
            warehouseId: activeWarehouse?.id
          };
          try {
            sessionStorage.setItem('qc_list_cache', JSON.stringify(data));
            sessionStorage.setItem('qc_list_cache_warehouseId', String(activeWarehouse?.id || ''));
          } catch { /* ignore quota errors */ }
        }

        // ? PAGE CACHE: Store in cache
        pageCacheRef.current.set(cacheKey, {
          data,
          total: response.data?.total || 0,
          timestamp: Date.now(),
        });
        setLastRefreshTime(new Date());
        retryCountRef.current = 0; // Reset retry count on success

        // ⚡ PREFETCH: Prefetch next page after successful load
        setTimeout(() => prefetchNextPage(), 500);

        if (buttonRefresh) {
          toast.success('List refreshed');
          setRefreshSuccess(true);
          setTimeout(() => setRefreshSuccess(false), 1800);
        }

        // Ensure minimum loading time for smooth UX
        if (overlayShownRef.current && overlayStartRef.current) {
          const elapsed = Date.now() - overlayStartRef.current;
          if (elapsed < MIN_LOADING_MS) {
            await new Promise(res => setTimeout(res, MIN_LOADING_MS - elapsed));
          }
        }

        // Clear overlay
        if (overlayTimerRef.current) {
          clearTimeout(overlayTimerRef.current);
          overlayTimerRef.current = null;
        }
        try { setTopLoading(false); } catch { }
      }
    } catch (error: any) {
      if (loadId === currentLoadIdRef.current) {
        // Clear overlay on error
        if (overlayTimerRef.current) {
          clearTimeout(overlayTimerRef.current);
          overlayTimerRef.current = null;
        }
        try { setTopLoading(false); } catch { }
        setIsFetching(false);

        // Only set empty if we have no previous data
        if (!previousDataRef.current || (Array.isArray(previousDataRef.current) && previousDataRef.current.length === 0)) {
          setQcList([]);
        }

        if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
          console.error('Load QC list error:', error);

          // ⚡ AUTO-RETRY: Retry on failure
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++;
            toast.error(`Loading failed, retrying... (${retryCountRef.current}/${MAX_RETRIES})`);
            setTimeout(() => {
              loadQCList({ buttonRefresh: true });
            }, 1000 * retryCountRef.current);
            return;
          }

          if (buttonRefresh) toast.error('Failed to refresh QC list');
          else toast.error('Failed to load QC list');
          retryCountRef.current = 0;
        }
      }
    } finally {
      // Always clear loading states to prevent infinite spinner
      setIsFetching(false);
      if (buttonRefresh) setRefreshing(false);
      setListLoading(false);
    }
  };


  const loadStats = async () => {
    try {
      const response = await qcAPI.getStats(activeWarehouse?.id);
      setStats(response.data || {
        pending: 0,
        pass: 0,
        fail: 0,
        hold: 0,
        done: 0,
        total: 0,
      });
    } catch (error) {
      console.error('Stats error:', error);
    }
  };

  const loadBrands = async () => {
    try {
      const response = await qcAPI.getBrands(activeWarehouse?.id);
      setBrands(response.data || []);
    } catch (error) {
      console.error('Brands error:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await qcAPI.getCategories(activeWarehouse?.id);
      setCategories(response.data || []);
    } catch (error) {
      console.error('Categories error:', error);
    }
  };

  const loadRacks = async () => {
    try {
      const response = await qcAPI.getWarehouseRacks(activeWarehouse?.id);
      setRacks(response.data || []);
    } catch (error) {
      console.error('Racks error:', error);
    }
  };

  const loadBatches = async () => {
    setBatchLoading(true);
    try {
      const response = await qcAPI.getBatches(activeWarehouse?.id);
      setBatches(response.data || []);
    } catch (error) {
      toast.error('Failed to load batches');
    } finally {
      setBatchLoading(false);
    }
  };

  // GRADE MANAGEMENT
  const handleAddGrade = () => {
    if (!newGrade.trim()) {
      toast.error('Grade name is required');
      return;
    }

    if (editingGradeIndex !== null) {
      // Edit existing grade
      const updatedGrades = [...QC_GRADES];
      updatedGrades[editingGradeIndex] = newGrade.toUpperCase();
      QC_GRADES = updatedGrades;
      toast.success(`✓ Grade updated to ${newGrade}`);
      setEditingGradeIndex(null);
    } else {
      // Add new grade
      if (QC_GRADES.includes(newGrade.toUpperCase())) {
        toast.error('Grade already exists');
        return;
      }
      QC_GRADES = [...QC_GRADES, newGrade.toUpperCase()];
      toast.success(`✓ Grade ${newGrade} added`);
    }

    setNewGrade('');
    setGradeDialogOpen(false);
  };

  const handleDeleteGrade = (index: number) => {
    if (QC_GRADES.length <= 1) {
      toast.error('At least one grade must exist');
      return;
    }
    const deletedGrade = QC_GRADES[index];
    QC_GRADES = QC_GRADES.filter((_, i) => i !== index);
    toast.success(`✓ Grade ${deletedGrade} deleted`);
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm('Delete entire batch?')) return;
    try {
      await qcAPI.deleteBatch(batchId);
      toast.success('✓ Batch deleted');
      // Clear page cache so QC list fetches fresh data
      pageCacheRef.current.clear();
      loadQCList({ buttonRefresh: true });
      loadBatches();
      loadStats();
    } catch (error) {
      toast.error('Failed to delete batch');
    }
  };

  // TAB 1: SINGLE ENTRY ACTIONS
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleWSN.trim()) {
      toast.error('WSN is required');
      return;
    }
    if (!singleForm.qc_by_name.trim()) {
      toast.error('QC By Name is required');
      return;
    }

    setSingleLoading(true);
    try {
      await qcAPI.createEntry({
        wsn: singleWSN,
        ...singleForm,
        warehouse_id: activeWarehouse?.id,
        update_existing: duplicateQC ? true : false,
      });
      toast.success('✓ QC entry created');
      setSingleWSN('');
      setDuplicateQC(null);

      // Clear product details
      setSingleProduct({
        fsn: '',
        product_title: '',
        brand: '',
        cms_vertical: '',
        mrp: '',
        fsp: '',
        fkt_link: '',
      });

      const userName = (user as any)?.full_name || (user as any)?.name || (user as any)?.username || '';

      setSingleForm({
        qc_date: new Date().toISOString().split('T')[0],
        qc_by_name: userName,  // ← Auto-fills again
        qc_grade: '',
        qc_remarks: '',
        other_remarks: '',
        product_serial_number: '',
        rack_no: '',
      });

      loadQCList();
      loadStats();
    } catch (error: any) {
      if (error.response?.status === 409) {
        const data = error.response.data;
        if (data.canUpdate === false) {
          toast.error('WSN already exists in another warehouse - cannot update');
          setDuplicateQC(null);
        } else {
          setDuplicateQC(data);
          toast.error('Duplicate QC in this warehouse - Click "Update" to modify');
        }
      } else {
        toast.error(error.response?.data?.error || 'Failed to create');
      }
    } finally {
      setSingleLoading(false);
    }
  };

  // TAB 2: BULK UPLOAD ACTIONS
  // ? ADD THIS - Actual download after confirmation (used by BulkUploadCard)
  const handleConfirmDownload = async () => {
    try {
      // Download template from backend with Excel dropdown validation for GRADE & RACKNO
      const response = await qcAPI.downloadValidatedTemplate(activeWarehouse?.id || 0);
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'QCBulkTemplate.xlsx';
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded with dropdown validation');
    } catch (error) {
      console.error('Failed to download QC template:', error);
      // Fallback: generate simple template client-side
      try {
        const XLSX = await import('xlsx');
        const template = [
          {
            WSN: 'ABC123A',
            GRADE: 'A',
            RACKNO: 'A-01',
            QCREMARKS: 'All checks passed',
            OTHERREMARKS: 'Package condition good',
            PRODUCTSERIALNUMBER: 'SN12345',
          },
        ];
        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'QCBulkTemplate.xlsx');
        toast.success('Template downloaded (basic)');
      } catch (e2) {
        toast.error('Failed to download template');
      }
    }
  };


  // TAB 3: MULTI ENTRY ACTIONS
  const add500Rows = () => {
    setMultiRows([...multiRows, ...generateEmptyRows(500)]);
  };

  // ⚡ MULTI ENTRY: Export entered data to Excel with selected columns
  const exportMultiEntryToExcel = async (selectedCols: string[]) => {
    try {
      const dataToExport = multiRows.filter((row: any) => row.wsn?.trim());
      if (dataToExport.length === 0) {
        toast.error('No data to export');
        return;
      }
      const columnsToExport = EXPORT_COLUMN_MAP.filter(c => selectedCols.includes(c.key));
      if (columnsToExport.length === 0) {
        toast.error('No columns selected for export');
        return;
      }
      const XLSX = await import('xlsx');
      const exportData = dataToExport.map((row: any, idx: number) => {
        const obj: Record<string, any> = {};
        columnsToExport.forEach(col => {
          if (col.key === 'sno') {
            obj[col.label] = idx + 1;
          } else {
            obj[col.label] = row[col.dataKey] || '';
          }
        });
        return obj;
      });
      const ws = XLSX.utils.json_to_sheet(exportData);
      const colWidths = Object.keys(exportData[0]).map(key => ({
        wch: Math.max(key.length, ...exportData.map(row => String((row as any)[key] || '').length)) + 2
      }));
      ws['!cols'] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Multi QC');
      XLSX.writeFile(wb, `QC_MultiEntry_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`);
      toast.success(`✓ Exported ${dataToExport.length} rows with ${columnsToExport.length} columns`);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  // Column width config — removed all minWidth/flex constraints.
  // Columns auto-size to text content on first render; user-resized widths are saved permanently.
  const COLUMN_WIDTHS: Record<string, any> = {
    sno: { width: 80, maxWidth: 120 },
  };

  // ⚡ PERFORMANCE: Memoize multi-entry column definitions to prevent AG Grid full rebuild on every render
  const multiColumnDefs = useMemo(() => {
    const cols = visibleColumns.map((field: string) => {
      const key = String(field).replace(/_/g, '').toLowerCase();
      const widthConfig = COLUMN_WIDTHS[key] || {};

      // Use saved width if available, otherwise use default
      const savedWidth = multiColumnWidths[field];

      const baseColDef: any = {
        field,
        headerName: field === 'sno' ? 'S.No' : String(field).replace(/_/g, ' ').toUpperCase(),
        // Apply saved width as fixed width; unsaved columns will be auto-sized on first render
        ...(savedWidth ? { width: savedWidth } : widthConfig),
        cellStyle: (params: any) => {
          const styles: any = {};
          if (field === 'sno') {
            styles.fontWeight = 700;
            styles.color = isDarkMode ? '#94a3b8' : '#64748b';
            styles.textAlign = 'center';
          }
          return styles;
        },
      };

      if (field === 'sno') {
        baseColDef.valueGetter = (params: any) => params.node.rowIndex + 1;
        baseColDef.editable = false;
        return baseColDef;
      }

      if (field === 'wsn') {
        baseColDef.cellRenderer = (params: any) => params.value || '';
      }

      if (key === 'qcgrade' || field === 'qc_grade') {
        baseColDef.cellEditor = 'agSelectCellEditor';
        baseColDef.cellEditorParams = { values: ['', ...QC_GRADES] };
      } else if (key === 'rackno' || field === 'rack_no') {
        baseColDef.cellEditor = 'agSelectCellEditor';
        baseColDef.cellEditorParams = { values: ['', ...racks.map((r) => r.rack_name)] };
      }

      if (ALL_MASTER_COLUMNS.includes(key)) {
        baseColDef.editable = false;
      }

      return baseColDef;
    });

    // 🖨️ PRINT: Add print action column at the end
    cols.push({
      headerName: '🖨️',
      field: 'print_action',
      width: 55,
      minWidth: 55,
      maxWidth: 55,
      editable: false,
      sortable: false,
      filter: false,
      resizable: false,
      suppressNavigable: true,
      cellRenderer: (params: any) => {
        const wsn = params.data?.wsn;
        if (!wsn) return null;
        return (
          <span
            title="Print WSN Label"
            style={{ cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
            onClick={(e) => {
              e.stopPropagation();
              printRowWSN(params.data);
            }}
          >
            🖨️
          </span>
        );
      },
    });

    // Invisible filler column — absorbs remaining space on wide screens (Excel-style)
    cols.push({
      field: '_filler',
      headerName: '',
      flex: 1,
      resizable: false,
      editable: false,
      sortable: false,
      filter: false,
      suppressNavigable: true,
      suppressSizeToFit: true,
      cellStyle: { pointerEvents: 'none' } as any,
    });

    return cols;
  }, [visibleColumns, racks, isDarkMode, multiColumnWidths, printRowWSN]);

  // ====== WSN OVERWRITE DIALOG HANDLERS ======
  const handleOverwriteCancel = useCallback(() => {
    setWsnOverwriteDialog(null);
    pendingWSNRef.current = null;
    // Refocus on same cell
    if (wsnOverwriteDialog?.rowIndex !== undefined) {
      setTimeout(() => {
        gridRef.current?.api?.startEditingCell({
          rowIndex: wsnOverwriteDialog.rowIndex,
          colKey: 'wsn',
        });
      }, 100);
    }
  }, [wsnOverwriteDialog?.rowIndex]);

  const handleOverwriteReplace = useCallback(async () => {
    const pending = pendingWSNRef.current;
    if (!pending) return;

    const { rowIndex, newWSN } = pending;
    setWsnOverwriteDialog(null);
    pendingWSNRef.current = null;

    // Replace with new WSN
    const newRows = [...multiRowsRef.current];
    newRows[rowIndex] = { ...newRows[rowIndex], wsn: newWSN };

    // Clear old master data
    ALL_MASTER_COLUMNS.forEach(col => {
      newRows[rowIndex][col] = null;
    });
    setMultiRows(newRows);

    // Fetch new master data
    try {
      const response = await qcAPI.getPendingInbound(activeWarehouse?.id, newWSN);
      if (response.data.length > 0) {
        const item = response.data[0];
        setMultiRows(prevRows => {
          const updatedRows = [...prevRows];
          if (updatedRows[rowIndex]?.wsn?.trim()?.toUpperCase() === newWSN) {
            updatedRows[rowIndex] = {
              ...updatedRows[rowIndex],
              fsn: item.fsn || '',
              producttitle: item.product_title || '',
              brand: item.brand || '',
              cmsvertical: item.cms_vertical || '',
              hsnsac: item.hsn_sac || '',
              igstrate: item.igst_rate || '',
              mrp: item.mrp || '',
              fsp: item.fsp || '',
              vrp: item.vrp || '',
              yieldvalue: item.yield_value || '',
              psize: item.p_size || '',
              ptype: item.p_type || '',
              fktlink: item.fkt_link || '',
              whlocation: item.wh_location || '',
              orderid: item.order_id || '',
              fkqcremark: item.fkqc_remark || '',
              fkgrade: item.fk_grade || '',
              invoicedate: item.invoice_date || '',
            };
          }
          return updatedRows;
        });
      }
    } catch (e) {
      console.error('Error fetching master data:', e);
    }

    // Sync replaced row to other browsers
    setTimeout(() => queueRowSync(rowIndex, multiRowsRef.current[rowIndex]), 50);

    // Move to next row
    setTimeout(() => {
      const nextIndex = rowIndex + 1;
      if (nextIndex < multiRowsRef.current.length) {
        ensureRowVisible(nextIndex);
        gridRef.current?.api?.startEditingCell({
          rowIndex: nextIndex,
          colKey: 'wsn',
        });
      }
    }, 100);
  }, [activeWarehouse?.id, ensureRowVisible, queueRowSync]);

  const handleOverwriteAddToNextRow = useCallback(async () => {
    const pending = pendingWSNRef.current;
    if (!pending) return;

    const { rowIndex, newWSN } = pending;
    setWsnOverwriteDialog(null);
    pendingWSNRef.current = null;

    // Find next empty row
    let nextEmptyRow = rowIndex + 1;
    while (nextEmptyRow < multiRowsRef.current.length && multiRowsRef.current[nextEmptyRow]?.wsn?.trim()) {
      nextEmptyRow++;
    }

    // If no empty row found, add new rows
    if (nextEmptyRow >= multiRowsRef.current.length) {
      add500Rows();
      nextEmptyRow = multiRowsRef.current.length;
    }

    // Insert new WSN in next empty row
    setMultiRows(prevRows => {
      const newRows = [...prevRows];
      newRows[nextEmptyRow] = { ...newRows[nextEmptyRow], wsn: newWSN };
      return newRows;
    });

    // Fetch master data for new WSN
    try {
      const response = await qcAPI.getPendingInbound(activeWarehouse?.id, newWSN);
      if (response.data.length > 0) {
        const item = response.data[0];
        setMultiRows(prevRows => {
          const updatedRows = [...prevRows];
          if (updatedRows[nextEmptyRow]?.wsn?.trim()?.toUpperCase() === newWSN) {
            updatedRows[nextEmptyRow] = {
              ...updatedRows[nextEmptyRow],
              fsn: item.fsn || '',
              producttitle: item.product_title || '',
              brand: item.brand || '',
              cmsvertical: item.cms_vertical || '',
              hsnsac: item.hsn_sac || '',
              igstrate: item.igst_rate || '',
              mrp: item.mrp || '',
              fsp: item.fsp || '',
              vrp: item.vrp || '',
              yieldvalue: item.yield_value || '',
              psize: item.p_size || '',
              ptype: item.p_type || '',
              fktlink: item.fkt_link || '',
              whlocation: item.wh_location || '',
              orderid: item.order_id || '',
              fkqcremark: item.fkqc_remark || '',
              fkgrade: item.fk_grade || '',
              invoicedate: item.invoice_date || '',
            };
          }
          return updatedRows;
        });
      }
    } catch (e) {
      console.error('Error fetching master data:', e);
    }

    // Sync new row to other browsers
    setTimeout(() => queueRowSync(nextEmptyRow, multiRowsRef.current[nextEmptyRow]), 50);

    // Move to row after the newly inserted one
    setTimeout(() => {
      const focusRow = nextEmptyRow + 1;
      if (focusRow < multiRowsRef.current.length) {
        ensureRowVisible(focusRow);
        gridRef.current?.api?.startEditingCell({
          rowIndex: focusRow,
          colKey: 'wsn',
        });
      }
    }, 100);
  }, [activeWarehouse?.id, ensureRowVisible, add500Rows, queueRowSync]);

  const handleMultiSubmit = async () => {
    // ⚡ VALIDATION: Warehouse check
    if (!activeWarehouse?.id) {
      toast.error('Select warehouse first');
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

    const validRows = multiRows.filter((r) => r.wsn?.trim());
    if (validRows.length === 0) {
      toast.error('At least 1 WSN required');
      return;
    }

    // ⚡ VALIDATION: Check for grid duplicates
    const wsnCounts = new Map<string, number>();
    validRows.forEach((row) => {
      const wsn = row.wsn?.trim()?.toUpperCase();
      if (wsn) wsnCounts.set(wsn, (wsnCounts.get(wsn) || 0) + 1);
    });
    const hasGridDuplicates = Array.from(wsnCounts.values()).some(count => count > 1);
    if (hasGridDuplicates) {
      toast.error('Remove duplicate WSNs in grid before submitting');
      return;
    }

    // ⚡ VALIDATION: Check for cross-warehouse and same-warehouse duplicates
    const crossWarehouseFound: string[] = [];
    const sameWarehouseFound: string[] = [];
    validRows.forEach((row) => {
      const wsn = row.wsn?.trim()?.toUpperCase();
      if (wsn) {
        const existingRecord = existingQCWSNs.find((item) => item.wsn === wsn);
        if (existingRecord) {
          if (existingRecord.warehouseid !== activeWarehouse.id) {
            crossWarehouseFound.push(wsn);
          } else {
            sameWarehouseFound.push(wsn);
          }
        }
      }
    });

    if (crossWarehouseFound.length > 0) {
      toast.error(`${crossWarehouseFound.length} WSN(s) already QC'd in other warehouse`);
      return;
    }

    if (sameWarehouseFound.length > 0) {
      toast.error(`${sameWarehouseFound.length} WSN(s) already QC'd in this warehouse`);
      return;
    }

    if (!commonQcByName.trim()) {
      toast.error('QC By Name is required');
      return;
    }

    const fixedRows = validRows.map((row) => ({
      ...row,
      qc_date: commonQcDate,
      qc_by_name: commonQcByName,
    }));

    setMultiLoading(true);
    try {
      const response = await qcAPI.multiEntry({
        entries: fixedRows,
        warehouse_id: activeWarehouse?.id,
      });

      const results = response.data?.results || [];
      const successCount = response.data?.successCount || 0;
      const totalCount = validRows.length;
      setMultiResults(results);

      // ⚡ DATA SAFETY: Collect successfully processed WSNs
      const successWSNs = new Set<string>(
        results
          .filter((r: any) => r.status === 'SUCCESS')
          .map((r: any) => r.wsn?.trim()?.toUpperCase())
          .filter(Boolean)
      );

      if (successCount === totalCount) {
        // All succeeded — full reset
        toast.success(`✓ ${successCount} entries created`);
        setMultiRows(generateEmptyRows(500));
        // Retry clearDraft up to 3 times — prevents orphaned drafts on transient failures
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await clearDraft();
            break;
          } catch (e) {
            console.error(`clearDraft attempt ${attempt}/3 failed`, e);
            if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
          }
        }
      } else if (successCount > 0) {
        // Partial success — remove only successful rows, keep failed rows editable
        toast.success(`✓ ${successCount}/${totalCount} entries created. ${totalCount - successCount} rows kept for review.`);
        setMultiRows(prevRows => {
          const remaining = prevRows.filter(row => {
            const wsn = row.wsn?.trim()?.toUpperCase();
            if (!wsn) return true; // Keep empty rows
            return !successWSNs.has(wsn); // Keep rows that did NOT succeed
          });
          // Ensure at least 500 rows
          const emptyNeeded = Math.max(0, 500 - remaining.length);
          return emptyNeeded > 0 ? [...remaining, ...generateEmptyRows(emptyNeeded)] : remaining;
        });
        // Re-save draft with remaining failed rows
        saveDraftImmediate();
      } else {
        // All failed — keep ALL rows, no clearing
        toast.error('No entries were saved. Rows kept for retry.');
      }

      // ⚡ CACHE UPDATE: Update source to QC in available cache (only for successful ones)
      if (isWMSCacheEnabled() && successWSNs.size > 0) {
        successWSNs.forEach((wsn) => {
          updateAvailableCacheSource(wsn, 'QC').catch(() => { });
        });
      }

      // Clear page cache so QC list fetches fresh data
      pageCacheRef.current.clear();
      loadQCList({ buttonRefresh: true });
      loadStats();
      loadBatches();
    } catch (error: any) {
      // ⚡ DATA SAFETY: On network/API failure, grid data is preserved (no clearing)
      toast.error(error.response?.data?.error || 'Submission failed. Data preserved — retry when ready.');
    } finally {
      setMultiLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      // ⚡ OPTIMIZED: Load XLSX dynamically
      const XLSX = await import('xlsx');

      const response = await qcAPI.exportData({
        warehouseId: activeWarehouse?.id,
        dateFrom: exportStartDate || dateFromFilter,
        dateTo: exportEndDate || dateToFilter,
        qc_grade: exportGrade || gradeFilter,
        brand: exportBrand || brandFilter,
        category: exportCategory,
        batchId: exportBatchIds.length > 0 ? exportBatchIds : undefined,
      });


      const exportData = response.data.data.map((item: any) => ({
        // QC
        WSN: item.wsn,
        'QC Date': formatDate(item.qc_date),
        'QC By': item.qc_by_name,
        'QC Grade': item.qc_grade,
        'QC Status': item.qc_status,
        'QC Remarks': item.qc_remarks,
        'Other Remarks': item.other_remarks,
        'QC Batch ID': item.batch_id,
        'QC Updated By': item.updated_by_name,
        'QC Updated At': formatDate(item.updated_at),

        // MASTER DATA
        WID: item.wid,
        FSN: item.fsn,
        'Order ID': item.order_id,
        'FK QC Remark': item.fkqc_remark,
        'FK Grade': item.fk_grade,
        'Product Title': item.product_title,
        'HSN/SAC': item.hsn_sac,
        'IGST Rate': item.igst_rate,
        MRP: item.mrp,
        FSP: item.fsp,
        'Invoice Date': item.invoice_date,
        'FKT Link': item.fkt_link,
        'WH Location': item.wh_location,
        Brand: item.brand,
        Category: item.cms_vertical,
        VRP: item.vrp,
        Yield: item.yield_value,
        'Product Type': item.p_type,
        'Product Size': item.p_size,

        // INBOUND
        'Inbound Date': formatDate(item.inbound_date),
        'Vehicle No': item.vehicle_no,
        'Rack No': item.rack_no,
        'Product Serial No': item.product_serial_number,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      // Auto-fit column widths
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length, ...exportData.map((row: any) => String(row[key] || '').length)) + 2
      }));
      ws['!cols'] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'QC');
      const filename = `QC_${exportBatchIds.length > 0 ? exportBatchIds.join('_') + '_' : ''}${exportStartDate || 'all'}_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`✓ Exported ${exportData.length} records`);
      setExportDialogOpen(false);
      setExportStartDate('');
      setExportEndDate('');
      setExportGrade('');
      setExportBrand('');
      setExportCategory('');
      setExportBatchIds([]);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleDeleteQCEntry = async (qcId: number) => {
    if (!confirm('Delete QC entry?')) return;
    try {
      await qcAPI.deleteEntry(qcId);
      toast.success('✓ Entry deleted');
      loadQCList();
      loadStats();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  // ⚡ EXTRACTED: Multi-entry grid onCellValueChanged handler
  const handleMultiCellValueChanged = useCallback((event: any) => {
    const { colDef, newValue, rowIndex, oldValue } = event;
    const field = colDef?.field;
    if (!field) return;

    // ⚠️ WSN OVERWRITE WARNING: Check if replacing an existing WSN with a different one
    if (field === 'wsn') {
      const existingWSN = oldValue?.trim()?.toUpperCase();
      const newWSN = newValue?.trim()?.toUpperCase();

      // If row had a valid WSN and user is entering a DIFFERENT valid WSN
      if (existingWSN && newWSN && existingWSN !== newWSN) {
        // Store pending WSN and show dialog
        pendingWSNRef.current = { rowIndex, newWSN, event };

        // Get existing row data for display
        const existingData = multiRowsRef.current[rowIndex] || {};

        setWsnOverwriteDialog({
          open: true,
          rowIndex,
          existingWSN,
          existingData: {
            product_title: existingData.producttitle,
            brand: existingData.brand,
            mrp: existingData.mrp,
            fsp: existingData.fsp,
            fsn: existingData.fsn,
            cms_vertical: existingData.cmsvertical,
          },
          newWSN,
        });

        // REVERT the cell value to old WSN (user hasn't confirmed yet)
        setTimeout(() => {
          const node = event.api.getRowNode(String(rowIndex));
          if (node) {
            node.setDataValue('wsn', existingWSN);
          }
        }, 10);

        return; // Don't process further until user confirms
      }
    }

    const newRows = [...multiRows];

    // ===== WSN FIELD LOGIC =====
    if (field === 'wsn') {
      const wsn = newValue?.trim()?.toUpperCase();

      // 🔴 WSN cleared - clear master data
      if (!newValue || !newValue.trim()) {
        newRows[rowIndex] = { ...newRows[rowIndex], [field]: newValue };
        ALL_MASTER_COLUMNS.forEach((col) => {
          newRows[rowIndex][col] = null;
        });
        setMultiRows(newRows);
        // ⚡ SYNC: Broadcast cleared row to other devices
        queueRowSync(rowIndex, newRows[rowIndex]);
        return;
      }

      // Calculate duplicates inline for immediate feedback
      const wsnCounts = new Map<string, number>();
      newRows.forEach((row: any) => {
        const rowWsn = row.wsn?.trim()?.toUpperCase();
        if (rowWsn) {
          wsnCounts.set(rowWsn, (wsnCounts.get(rowWsn) || 0) + 1);
        }
      });

      const isGridDuplicate = (wsnCounts.get(wsn) || 0) > 1;

      // Check against database
      const existingRecord = existingQCWSNs.find((item) => item.wsn === wsn);
      const isSameWarehouseDup = existingRecord?.warehouseid === activeWarehouse?.id;
      const isCrossWarehouse = existingRecord && existingRecord.warehouseid !== activeWarehouse?.id;

      // 🔴 CROSS-WAREHOUSE ERROR (different warehouse)
      if (isCrossWarehouse) {
        toast.error(`WSN ${wsn} already QC'd in another warehouse`, {
          duration: 3000,
          style: {
            background: '#ffffff',
            color: '#dc2626',
            border: '2px solid #dc2626',
            borderRadius: '8px',
            padding: '12px 16px',
            fontWeight: 600,
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)',
          },
          icon: '✓',
        });


        // Clear cell
        newRows[rowIndex].wsn = '';
        ALL_MASTER_COLUMNS.forEach((col) => {
          newRows[rowIndex][col] = null;
        });
        setMultiRows(newRows);
        return;
      }

      // 🟡 SAME WAREHOUSE DUPLICATE
      if (isSameWarehouseDup) {
        toast(`WSN ${wsn} already QC'd in this warehouse`, {
          duration: 2500,
          style: {
            background: '#ffffff',
            color: '#d97706',
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            padding: '12px 16px',
            fontWeight: 600,
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
          },
          icon: '✓',
        });


        // Clear cell
        newRows[rowIndex].wsn = '';
        ALL_MASTER_COLUMNS.forEach((col) => {
          newRows[rowIndex][col] = null;
        });
        setMultiRows(newRows);

        return;
      }

      // 🟡 GRID DUPLICATE
      if (isGridDuplicate) {
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
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
          },
          icon: '✓',
        });


        // Clear cell
        newRows[rowIndex].wsn = '';
        ALL_MASTER_COLUMNS.forEach((col) => {
          newRows[rowIndex][col] = null;
        });
        setMultiRows(newRows);

        // ? UPDATE CHIPS AFTER CLEARING
        setTimeout(() => {
          event.api.startEditingCell({
            rowIndex: rowIndex,
            colKey: 'wsn',
          });
        }, 100);
        return;
      }

      // ? VALID WSN - Update row and chips (store uppercase)
      newRows[rowIndex] = { ...newRows[rowIndex], [field]: wsn }; // Use uppercase wsn
      setMultiRows(newRows);



      // ⚡ AUTO-EXTEND: Add 500 rows when entering data near the end
      if (rowIndex != null && rowIndex >= event.api.getDisplayedRowCount() - 2) {
        add500Rows();
      }

      // ⚡ SCANNER: Move to next row after WSN entry
      const moveToNextRow = () => {
        setTimeout(() => {
          try {
            const nextIndex = (rowIndex ?? 0) + 1;
            if (nextIndex < event.api.getDisplayedRowCount()) {
              desiredRowIndexRef.current = nextIndex;
              ensureRowVisible(nextIndex, 'bottom');
              event.api.setFocusedCell(nextIndex, 'wsn');
            } else {
              add500Rows();
              setTimeout(() => {
                desiredRowIndexRef.current = nextIndex;
                ensureRowVisible(nextIndex, 'bottom');
                event.api.setFocusedCell(nextIndex, 'wsn');
              }, 50);
            }
          } catch (e) { /* ignore */ }
        }, 30);
      };

      // Fetch master data
      if (wsn) {
        // Track this fetch request
        wsnFetchMapRef.current.set(rowIndex, wsn);

        // ⚡ OFFLINE CHECK
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

        // Show offline warning once per session
        if (!isOnline && !offlineWarningShownRef.current) {
          offlineWarningShownRef.current = true;
          toast('📴 Offline Mode - Using cached data. Will validate on submit.', {
            duration: 5000,
            style: {
              background: '#fef3c7',
              color: '#92400e',
              border: '1px solid #f59e0b',
              borderRadius: '8px',
              padding: '12px 16px',
              fontWeight: 500,
              fontSize: '13px',
            },
            icon: '⚠️',
          });
        }

        // Reset warning flag when back online
        if (isOnline && offlineWarningShownRef.current) {
          offlineWarningShownRef.current = false;
        }

        // ⚡ CACHE FIRST + API FALLBACK
        // ⚡ Move to next row IMMEDIATELY (non-blocking — don't wait for data)
        moveToNextRow();

        (async () => {
          try {
            let masterInfo = null;

            // TRY AVAILABLE CACHE FIRST (ultra-fast memory + IndexedDB)
            if (isWMSCacheEnabled() && activeWarehouse?.id) {
              try {
                masterInfo = await getAvailableByWSNFast(wsn, activeWarehouse.id);
                if (masterInfo) {
                  console.log('[QC] ⚡ Memory/Cache HIT for WSN:', wsn);
                }
              } catch { /* cache miss */ }
            }

            // FALLBACK TO API (only if online) with 3s timeout
            if (!masterInfo && isOnline) {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 3000);
              try {
                const response = await qcAPI.getPendingInbound(activeWarehouse?.id, wsn, { signal: controller.signal });
                console.log('[QC] API Response for WSN:', wsn, response.data[0]);
                if (response.data.length > 0) {
                  masterInfo = response.data[0];
                }
              } catch (apiErr: any) {
                if (apiErr?.name === 'CanceledError' || apiErr?.code === 'ERR_CANCELED') {
                  console.log('[QC] API timeout for WSN:', wsn);
                } else {
                  throw apiErr;
                }
              } finally {
                clearTimeout(timeoutId);
              }
            }

            // Check if this is still the latest fetch for this row
            const latestWSN = wsnFetchMapRef.current.get(rowIndex);
            if (latestWSN !== wsn) {
              console.log(`⏭️ Skipping stale fetch for row ${rowIndex}: ${wsn} (latest: ${latestWSN})`);
              return;
            }

            if (masterInfo) {
              setMultiRows((prevRows) => {
                const updatedRows = [...prevRows];
                updatedRows[rowIndex] = {
                  ...updatedRows[rowIndex],
                  // EXACT MAPPING FROM API/CACHE
                  fsn: masterInfo.fsn || '',
                  producttitle: masterInfo.product_title || '',
                  brand: masterInfo.brand || '',
                  cmsvertical: masterInfo.cms_vertical || '',
                  hsnsac: masterInfo.hsn_sac || '',
                  igstrate: masterInfo.igst_rate || '',
                  mrp: masterInfo.mrp || '',
                  fsp: masterInfo.fsp || '',
                  vrp: masterInfo.vrp || '',
                  yieldvalue: masterInfo.yield_value || '',
                  psize: masterInfo.p_size || '',
                  ptype: masterInfo.p_type || '',
                  fktlink: masterInfo.fkt_link || '',
                  whlocation: masterInfo.wh_location || '',
                  orderid: masterInfo.order_id || '',
                  fkqcremark: masterInfo.fkqc_remark || '',
                  fkgrade: masterInfo.fk_grade || '',
                  invoicedate: masterInfo.invoice_date || '',
                };
                // ⚡ SYNC: Broadcast row with master data to other devices
                queueRowSync(rowIndex, updatedRows[rowIndex]);
                // 🖨️ PRINT: Save last scanned row for Ctrl+P / Ctrl+O
                lastScannedRowRef.current = { ...updatedRows[rowIndex] };
                return updatedRows;
              });
            }

            // Data populated in background, row already advanced

          } catch (error) {
            console.log('WSN not found in pending inbound');
            // Row already moved, no need to call moveToNextRow again
          }
        })();
      }

      return;
    }

    // ===== OTHER FIELDS (non-WSN) =====
    newRows[rowIndex] = { ...newRows[rowIndex], [field]: newValue };
    setMultiRows(newRows);
    // ⚡ SYNC: Broadcast non-WSN field changes to other devices
    queueRowSync(rowIndex, newRows[rowIndex]);
  }, [multiRows, existingQCWSNs, activeWarehouse, add500Rows, ensureRowVisible, isWMSCacheEnabled, getAvailableByWSNFast, setMultiRows, setWsnOverwriteDialog, queueRowSync]);

  // 📡 SSE: Real-time sync for multi-device updates
  useRealtimeSync({
    page: 'qc',
    warehouseId: activeWarehouse?.id,
    enabled: !!user && !!activeWarehouse,
    onDataSubmitted: useCallback((data: any) => {
      toast.success(`${data.submittedBy} submitted ${data.successCount} QC entries from another device`, { duration: 4000, icon: '📡' });
      // Add submitted WSNs to existing list for duplicate prevention
      if (data.submittedWSNs?.length) {
        setExistingQCWSNs((prev: any[]) => {
          const newEntries = data.submittedWSNs!.map((wsn: string) => ({ wsn, warehouseid: activeWarehouse?.id }));
          return [...prev, ...newEntries];
        });
      }
      // Clear grid — data was submitted from another device, draft is now empty
      isSyncingRef.current = true;
      setMultiRows(generateEmptyRows(500));
      setDraftSavedAt(null);
      setDraftExists(false);
      setTimeout(() => { isSyncingRef.current = false; }, 300);
      // Refresh list data
      loadQCList();
      loadStats();
    }, [activeWarehouse, loadQCList, loadStats]),
    onDraftUpdated: useCallback((data: any) => {
      // Skip toast if we just received sync data (real-time sync already handles updates)
      if (Date.now() - lastSyncReceivedAtRef.current < 3000) return;
      toast('QC draft updated from another device', { duration: 3000, icon: '📝' });
    }, []),
    onDraftCleared: useCallback(() => {
      toast('QC draft cleared from another device', { duration: 3000, icon: '🗑️' });
      // Clear grid and reset draft state so stale data doesn't remain
      isSyncingRef.current = true;
      setMultiRows(generateEmptyRows(500));
      setDraftSavedAt(null);
      setDraftExists(false);
      setTimeout(() => { isSyncingRef.current = false; }, 300);
    }, []),
    onEntrySynced: useCallback((data: any) => {
      if (!data?.rows?.length) return;
      isSyncingRef.current = true;
      lastSyncReceivedAtRef.current = Date.now();
      setMultiRows(prev => {
        const updated = [...prev];
        for (const { index, data: rowData } of data.rows) {
          if (index >= 0 && index < updated.length) {
            updated[index] = { ...updated[index], ...rowData };
          }
        }
        return updated;
      });
      // Force AG Grid to visually refresh updated cells
      setTimeout(() => {
        try { gridRef.current?.refreshCells({ force: true }); } catch { /* ignore */ }
        isSyncingRef.current = false;
      }, 150);
    }, []),
  });

  if (!activeWarehouse) {
    return <AppLayout>⚠️ No warehouse selected</AppLayout>;
  }

  //////////////////////////////////====UI RENDERING====////////////////////////////////////
  return (
    <AppLayout>
      <Toaster position="top-right" containerStyle={{ zIndex: 99999 }} toastOptions={{
        duration: 3000,
        style: {
          background: '#363636', color: '#fff', borderRadius: '10px',
          padding: '16px', fontWeight: 600
        }, success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } }
      }} />

      <Box sx={{
        p: { xs: 0.75, md: 1 },
        background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* ==================== HEADER SECTION ==================== */}
        <StandardPageHeader
          title="QC Management"
          subtitle="Quality control operations"
          icon="🔍"
          warehouseName={activeWarehouse?.name}
          userName={user?.full_name}
        />


        {/* ==================== TABS SECTION ==================== */}
        <StandardTabs
          value={tabValue}
          onChange={(event, newValue) => setTabValue(newValue)}
          tabs={visibleTabs}
          color="#1e40af"
        />

        {/* ==================== MAIN CONTENT AREA ==================== */}
        <Paper
          sx={{
            p: 0,
            boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.08)',
            background: isDarkMode ? '#0f172a' : '#f8fafc',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'opacity 0.15s ease-in-out',

          }}
        >

          {/* ========== TAB 0: QC LIST ========== */}
          {currentTabCode === 'list' && (
            <Box
              sx={{
                background: isDarkMode ? '#0f172a' : '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                py: { xs: 0.25, sm: 0.50 },
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

              }}
            >
              <Box sx={{
                flexShrink: 0,
                mb: 0,
                mt: 0.50,
                background: isDarkMode ? '#0f172a' : '#f8fafc',
                borderBottom: 'transparent',
                position: 'relative',
                zIndex: 95
              }}>
                <Stack direction="row" spacing={1} alignItems="stretch" sx={{ mb: { xs: 0.5, sm: 1 } }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search by WSN, Product Title, or any field..."
                    value={searchFilter}
                    onChange={(e) => {
                      setSearchFilter(e.target.value);
                      setPage(1);
                    }}
                    InputProps={{
                      endAdornment: (searchFilter !== searchDebounced) ? (
                        <InputAdornment position="end">
                          <CircularProgress size={16} />
                        </InputAdornment>
                      ) : undefined
                    }}
                    sx={{
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        bgcolor: isDarkMode ? '#1e293b' : 'white',
                        borderRadius: 1.5,
                        height: 38,
                        fontSize: { xs: '0.8rem', sm: '0.875rem' },
                        fontWeight: 500,
                        border: isDarkMode ? '2px solid rgba(255,255,255,0.15)' : '2px solid #e2e8f0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        '&:hover': {
                          borderColor: isDarkMode ? 'rgba(255,255,255,0.25)' : '#cbd5e1',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        },
                        '&.Mui-focused': {
                          borderColor: '#1e40af',
                          boxShadow: '0 4px 16px rgba(30, 64, 175, 0.2)'
                        },
                        '& fieldset': {
                          border: 'none'
                        },
                        '& input': {
                          py: 0.75,
                          color: isDarkMode ? '#f1f5f9' : 'inherit'
                        }
                      }
                    }}
                  />


                  {/* Options Button - Opens Options Panel Drawer */}
                  <Tooltip title="Open Options Panel">
                    <Button
                      variant="outlined"
                      onClick={() => setQcOptionsPanelOpen(true)}
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
              <Box
                sx={{
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
                {(listLoading || isFetching) && qcList && qcList.length > 0 && gridDataRendered && (
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

                {/* Empty State Overlay */}
                {!listLoading && !isFetching && dataResponseReceived && (!qcList || qcList.length === 0) && (
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
                        No QC items match your current filters. Try adjusting your search criteria or reset filters to see all items.
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
                        rowData={qcList}
                        columnDefs={listColumnDefs as any}
                        defaultColDef={listDefaultColDef}
                        rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
                        loading={false}
                        suppressNoRowsOverlay={true}
                        suppressScrollOnNewData={true}
                        maintainColumnOrder={true}
                        enableCellTextSelection={true}
                        ensureDomOrder={true}
                        animateRows={false}
                        // ? PERFORMANCE: Optimizations for smooth fast scrolling
                        rowBuffer={20}
                        suppressRowTransform={false}
                        suppressAnimationFrame={false}
                        alwaysShowVerticalScroll={true}
                        valueCache={true}
                        debounceVerticalScrollbar={true}
                        gridOptions={{ getRowId: (params: any) => String(params.data?.id || params.data?.wsn || params.rowIndex) }}
                        onGridReady={(params: any) => {
                          listGridRef.current = params.api;  // Use listGridRef for list grid
                          gridRef.current = params.api;
                          columnApiRef.current = params.api;
                          try {
                            const savedState = localStorage.getItem('qc_list_grid_state');
                            if (savedState && params.api) {
                              params.api.applyColumnState({ state: JSON.parse(savedState), applyOrder: true });
                              hasAutoFittedRef.current = true;
                            } else {
                              // No saved state - hide columns not in listColumns visible set
                              const visibleKeys = listColumns.filter(c => c.visible).map(c => c.key);
                              const allColIds = params.api.getColumns()?.map((c: any) => c.getColId()) || [];
                              allColIds.forEach((colId: string) => {
                                if (colId === '__sr') return;
                                const shouldShow = visibleKeys.includes(colId);
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
                                // ? IMPORTANT: Show grid AFTER all sizing is complete to prevent flash
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
                                  // ? Show grid body AFTER sizeColumnsToFit completes
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
                              const columnState = params.api.getColumnState();
                              localStorage.setItem('qc_list_grid_state', JSON.stringify(columnState));
                            } catch { /* ignore */ }
                          }
                        }}
                        onColumnMoved={(params: any) => {
                          if (params.finished && params.api) {
                            try {
                              const columnState = params.api.getColumnState();
                              localStorage.setItem('qc_list_grid_state', JSON.stringify(columnState));
                            } catch { /* ignore */ }
                          }
                        }}
                        onColumnVisible={(params: any) => {
                          if (params.api) {
                            try {
                              const columnState = params.api.getColumnState();
                              localStorage.setItem('qc_list_grid_state', JSON.stringify(columnState));
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
                  {((listLoading && (!qcList || qcList.length === 0)) || (qcList && qcList.length > 0 && !gridDataRendered)) && (
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
                          Loading QC data...
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
                    {qcList.length > 0 ? (page - 1) * limit + 1 : 0} – {Math.min(page * limit, total)} of {total}
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
            </Box>
          )
          }

          {/* GRID SETTINGS DIALOG (QC) */}
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
                  Settings auto-save and persist after reload
                </Alert>

                {/* SORTABLE */}
                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={gridSettings.sortable}
                        onChange={(e) => updateGridSettings({ ...gridSettings, sortable: e.target.checked })}
                        sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                      />
                    }
                    label={
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>Enable Sorting
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
                        checked={gridSettings.filter}
                        onChange={(e) => updateGridSettings({ ...gridSettings, filter: e.target.checked })}
                        sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                      />
                    }
                    label={
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>Enable Column Filters
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
                        checked={gridSettings.resizable}
                        onChange={(e) => updateGridSettings({ ...gridSettings, resizable: e.target.checked })}
                        sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                      />
                    }
                    label={
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>Enable Column Resize
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
                  updateGridSettings({ sortable: true, filter: true, resizable: true, editable: true });
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

          {/* ========== TAB 1: SINGLE QC ========== */}
          {
            currentTabCode === 'single' && (
              <Box sx={{
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: { xs: 1.5, sm: 2, lg: 2.5 },
                p: { xs: 1, sm: 1.5, md: 2 },
                height: '100%',
                overflow: 'auto'
              }}
              >
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                  gap: { xs: 1, sm: 2 },
                  flex: 1,
                  minHeight: 0
                }}>
                  {/* LEFT COLUMN - FORM */}
                  <Card sx={{
                    borderRadius: 1.5,
                    boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.15)',
                    background: isDarkMode ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 800,
                          mb: 2,
                          color: isDarkMode ? '#f1f5f9' : '#1e293b',
                          fontSize: { xs: '1rem', sm: '1.1rem' },
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1
                        }}
                      >Single QC Entry
                      </Typography>

                      {duplicateQC && (
                        <Alert
                          severity="warning"
                          sx={{
                            mb: 2,
                            py: 1,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            borderRadius: 1,
                            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                            border: '1px solid #f59e0b'
                          }}
                        >
                          ⚠️ QC already exists. Click "Update" to modify existing entry.
                        </Alert>
                      )}

                      <Box sx={{ flex: 1, overflow: 'auto' }}>
                        <Stack spacing={1.5}>
                          <TextField
                            fullWidth
                            size="small"
                            label="WSN *"
                            value={singleWSN}
                            onChange={(e) => {
                              const value = e.target.value.toUpperCase(); // Auto uppercase
                              setSingleWSN(value);

                              // Debounce fetch for scanner support (scanners send chars rapidly)
                              if (singleWSNDebounceRef.current) {
                                clearTimeout(singleWSNDebounceRef.current);
                              }
                              singleWSNDebounceRef.current = setTimeout(() => {
                                fetchProductDetails(value);
                              }, 150); // Short debounce for rapid scanner input
                            }}
                            onKeyDown={(e) => {
                              // Scanner sends Enter after scan - immediately fetch on Enter
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (singleWSNDebounceRef.current) {
                                  clearTimeout(singleWSNDebounceRef.current);
                                }
                                const value = singleWSN.trim().toUpperCase();
                                if (value) {
                                  fetchProductDetails(value);
                                }
                              }
                            }}
                            placeholder="Enter WSN to auto-fetch product details"
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                height: 40,
                                fontSize: '0.85rem',
                                bgcolor: 'white',
                                '&:hover fieldset': { borderColor: '#1e40af' },
                                '&.Mui-focused fieldset': { borderColor: '#1e40af' }
                              },
                              '& .MuiInputLabel-root': {
                                fontSize: '0.8rem',
                                fontWeight: 600
                              }
                            }}
                          />

                          <TextField
                            fullWidth
                            size="small"
                            label="QC By Name"
                            value={singleForm.qc_by_name}
                            onChange={(e) => setSingleForm({ ...singleForm, qc_by_name: e.target.value })}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                height: 40,
                                fontSize: '0.85rem',
                                bgcolor: 'white',
                                '&:hover fieldset': { borderColor: '#1e40af' },
                                '&.Mui-focused fieldset': { borderColor: '#1e40af' }
                              },
                              '& .MuiInputLabel-root': {
                                fontSize: '0.8rem',
                                fontWeight: 600
                              }
                            }}
                          />

                          <TextField
                            fullWidth
                            size="small"
                            label="QC Date"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={singleForm.qc_date}
                            onChange={(e) => setSingleForm({ ...singleForm, qc_date: e.target.value })}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                height: 40,
                                fontSize: '0.85rem',
                                bgcolor: 'white',
                                '&:hover fieldset': { borderColor: '#1e40af' },
                                '&.Mui-focused fieldset': { borderColor: '#1e40af' }
                              },
                              '& .MuiInputLabel-root': {
                                fontSize: '0.8rem',
                                fontWeight: 600
                              }
                            }}
                          />

                          <TextField
                            fullWidth
                            size="small"
                            label="Product Serial Number"
                            value={singleForm.product_serial_number}
                            onChange={(e) => setSingleForm({ ...singleForm, product_serial_number: e.target.value })}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                height: 40,
                                fontSize: '0.85rem',
                                bgcolor: 'white',
                                '&:hover fieldset': { borderColor: '#1e40af' },
                                '&.Mui-focused fieldset': { borderColor: '#1e40af' }
                              },
                              '& .MuiInputLabel-root': {
                                fontSize: '0.8rem',
                                fontWeight: 600
                              }
                            }}
                          />

                          <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '0.8rem', fontWeight: 600 }}>QC Grade</InputLabel>
                            <Select
                              value={singleForm.qc_grade}
                              label="QC Grade"
                              onChange={(e) => setSingleForm({ ...singleForm, qc_grade: e.target.value })}
                              sx={{
                                height: 40,
                                fontSize: '0.85rem',
                                bgcolor: 'white',
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' }
                              }}
                            >
                              <MenuItem value="" sx={{ fontSize: '0.85rem' }}>Select Grade</MenuItem>
                              {QC_GRADES.map((g) => (
                                <MenuItem key={g} value={g} sx={{ fontSize: '0.85rem' }}>
                                  {g}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '0.8rem', fontWeight: 600 }}>Rack Location</InputLabel>
                            <Select
                              value={singleForm.rack_no}
                              label="Rack Location"
                              onChange={(e) => setSingleForm({ ...singleForm, rack_no: e.target.value })}
                              sx={{
                                height: 40,
                                fontSize: '0.85rem',
                                bgcolor: 'white',
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' }
                              }}
                            >
                              <MenuItem value="" sx={{ fontSize: '0.85rem' }}>Select Rack</MenuItem>
                              {racks.map((r) => (
                                <MenuItem key={r.id} value={r.rack_name} sx={{ fontSize: '0.85rem' }}>
                                  {r.rack_name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          <TextField
                            fullWidth
                            size="small"
                            multiline
                            rows={3}
                            label="QC Remarks"
                            value={singleForm.qc_remarks}
                            onChange={(e) => setSingleForm({ ...singleForm, qc_remarks: e.target.value })}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                fontSize: '0.85rem',
                                bgcolor: 'white',
                                '&:hover fieldset': { borderColor: '#1e40af' },
                                '&.Mui-focused fieldset': { borderColor: '#1e40af' }
                              },
                              '& .MuiInputLabel-root': {
                                fontSize: '0.8rem',
                                fontWeight: 600
                              }
                            }}
                          />

                          <TextField
                            fullWidth
                            size="small"
                            multiline
                            rows={2}
                            label="Other Remarks"
                            value={singleForm.other_remarks}
                            onChange={(e) => setSingleForm({ ...singleForm, other_remarks: e.target.value })}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                fontSize: '0.85rem',
                                bgcolor: 'white',
                                '&:hover fieldset': { borderColor: '#1e40af' },
                                '&.Mui-focused fieldset': { borderColor: '#1e40af' }
                              },
                              '& .MuiInputLabel-root': {
                                fontSize: '0.8rem',
                                fontWeight: 600
                              }
                            }}
                          />
                        </Stack>
                      </Box>

                      {/* ACTION BUTTONS */}
                      <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e2e8f0' }}>
                        {duplicateQC ? (
                          <Stack direction="row" spacing={1}>
                            <Button
                              fullWidth
                              variant="contained"
                              size="small"
                              onClick={handleSingleSubmit}
                              disabled={singleLoading}
                              sx={{
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                py: 1,
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                borderRadius: 1,
                                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                                '&:hover': {
                                  background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                                  boxShadow: '0 6px 16px rgba(245, 158, 11, 0.4)'
                                }
                              }}
                            >
                              🔄 Update Existing QC
                            </Button>
                            <Button
                              fullWidth
                              variant="outlined"
                              size="small"
                              onClick={() => setGradeDialogOpen(true)}
                              sx={{
                                py: 1,
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                borderWidth: 2,
                                borderColor: '#1e40af',
                                color: '#1e40af',
                                '&:hover': {
                                  borderWidth: 2,
                                  bgcolor: 'rgba(30, 64, 175, 0.1)'
                                }
                              }}
                            >Manage Grades
                            </Button>
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1}>
                            <Button
                              fullWidth
                              variant="contained"
                              size="small"
                              onClick={handleSingleSubmit}
                              disabled={singleLoading}
                              sx={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                py: 1,
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                height: 36,
                                borderRadius: 1,
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                '&:hover': {
                                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                  boxShadow: '0 6px 16px rgba(16, 185, 129, 0.4)'
                                }
                              }}
                            >
                              ? Submit QC Entry
                            </Button>

                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => setGradeDialogOpen(true)}
                              sx={{
                                py: 1,
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                borderWidth: 2,
                                height: 36,
                                minWidth: 100,
                                borderColor: '#1e40af',
                                color: '#1e40af',
                                '&:hover': {
                                  borderWidth: 2,
                                  bgcolor: 'rgba(30, 64, 175, 0.1)'
                                }
                              }}
                            >Grades
                            </Button>
                          </Stack>
                        )}
                      </Box>
                    </CardContent>
                  </Card>

                  {/* RIGHT COLUMN - PRODUCT DETAILS */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1, sm: 2 } }}>
                    {singleProduct.product_title && (
                      <Card sx={{
                        borderRadius: 1.5,
                        background: isDarkMode
                          ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
                          : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                        border: '2px solid #10b981',
                        boxShadow: isDarkMode ? '0 4px 20px rgba(16, 185, 129, 0.3)' : '0 4px 20px rgba(16, 185, 129, 0.2)',
                        flex: 1
                      }}>
                        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                            <CheckCircle sx={{ color: isDarkMode ? '#4ade80' : '#10b981', fontSize: { xs: 24, sm: 28 } }} />
                            <Typography
                              variant="h6"
                              sx={{
                                fontWeight: 800,
                                color: isDarkMode ? '#a7f3d0' : '#065f46',
                                fontSize: { xs: '0.95rem', sm: '1rem' }
                              }}
                            >
                              Master Data Found
                            </Typography>
                          </Stack>

                          <Divider sx={{ mb: 2, borderColor: isDarkMode ? 'rgba(167, 243, 208, 0.3)' : 'rgba(5, 150, 105, 0.3)' }} />

                          <Box sx={{ flex: 1, overflow: 'auto' }}>
                            <Stack spacing={2}>
                              <Box>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: isDarkMode ? '#a7f3d0' : '#065f46',
                                    fontWeight: 700,
                                    fontSize: '0.7rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5
                                  }}
                                >
                                  FSN
                                </Typography>
                                <Typography sx={{
                                  fontWeight: 700,
                                  color: isDarkMode ? '#ecfdf5' : '#047857',
                                  fontSize: '0.9rem',
                                  wordBreak: 'break-all'
                                }}>
                                  {singleProduct.fsn || 'N/A'}
                                </Typography>
                              </Box>

                              <Box>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: isDarkMode ? '#a7f3d0' : '#065f46',
                                    fontWeight: 700,
                                    fontSize: '0.7rem',
                                    textTransform: 'uppercase'
                                  }}
                                >
                                  PRODUCT TITLE
                                </Typography>
                                <Typography sx={{
                                  fontWeight: 600,
                                  color: isDarkMode ? '#d1fae5' : '#047857',
                                  fontSize: '0.85rem',
                                  lineHeight: 1.3
                                }}>
                                  {singleProduct.product_title || 'N/A'}
                                </Typography>
                              </Box>

                              <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                gap: 1.5
                              }}>
                                <Box>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: isDarkMode ? '#a7f3d0' : '#065f46',
                                      fontWeight: 700,
                                      fontSize: '0.7rem'
                                    }}
                                  >
                                    BRAND
                                  </Typography>
                                  <Typography sx={{ fontWeight: 700, color: isDarkMode ? '#ecfdf5' : '#047857' }}>
                                    {singleProduct.brand || 'N/A'}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: isDarkMode ? '#a7f3d0' : '#065f46',
                                      fontWeight: 700,
                                      fontSize: '0.7rem'
                                    }}
                                  >
                                    CATEGORY
                                  </Typography>
                                  <Typography sx={{ fontWeight: 700, color: isDarkMode ? '#ecfdf5' : '#047857' }}>
                                    {singleProduct.cms_vertical || 'N/A'}
                                  </Typography>
                                </Box>
                              </Box>

                              <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                gap: 1.5
                              }}>
                                <Box>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: isDarkMode ? '#a7f3d0' : '#065f46',
                                      fontWeight: 700,
                                      fontSize: '0.7rem'
                                    }}
                                  >
                                    MRP
                                  </Typography>
                                  <Typography sx={{ fontWeight: 700, color: isDarkMode ? '#ecfdf5' : '#047857' }}>
                                    ₹{singleProduct.mrp || 'N/A'}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: isDarkMode ? '#a7f3d0' : '#065f46',
                                      fontWeight: 700,
                                      fontSize: '0.7rem'
                                    }}
                                  >
                                    FSP
                                  </Typography>
                                  <Typography sx={{ fontWeight: 700, color: isDarkMode ? '#ecfdf5' : '#047857' }}>
                                    ₹{singleProduct.fsp || 'N/A'}
                                  </Typography>
                                </Box>
                              </Box>

                              {singleProduct.fkt_link && (
                                <Box>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: isDarkMode ? '#a7f3d0' : '#065f46',
                                      fontWeight: 700,
                                      fontSize: '0.7rem'
                                    }}
                                  >
                                    PRODUCT LINK
                                  </Typography>
                                  <Typography
                                    sx={{
                                      fontWeight: 600,
                                      color: isDarkMode ? '#38bdf8' : '#047857',
                                      fontSize: '0.8rem',
                                      cursor: 'pointer',
                                      textDecoration: 'underline',
                                      '&:hover': { color: isDarkMode ? '#7dd3fc' : '#065f46' }
                                    }}
                                    onClick={() => window.open(singleProduct.fkt_link, '_blank')}
                                  >
                                    View Product Details →
                                  </Typography>
                                </Box>
                              )}
                            </Stack>
                          </Box>
                        </CardContent>
                      </Card>
                    )}

                    {/* STATS CARD */}
                    <Card sx={{
                      borderRadius: 1.5,
                      boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.15)',
                      background: isDarkMode ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                      border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0'
                    }}>
                      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 800,
                            mb: 2,
                            color: isDarkMode ? '#f1f5f9' : '#1e293b',
                            fontSize: { xs: '0.95rem', sm: '1rem' },
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}
                        >Today's QC Stats
                        </Typography>

                        <Stack spacing={1}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>Pending:</Typography>
                            <Chip
                              label={stats.pending}
                              sx={{
                                bgcolor: '#fef3c7',
                                color: '#92400e',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                height: 24
                              }}
                            />
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>Pass:</Typography>
                            <Chip
                              label={stats.pass}
                              sx={{
                                bgcolor: '#d1fae5',
                                color: '#065f46',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                height: 24
                              }}
                            />
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>Fail:</Typography>
                            <Chip
                              label={stats.fail}
                              sx={{
                                bgcolor: '#fee2e2',
                                color: '#991b1b',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                height: 24
                              }}
                            />
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>Hold:</Typography>
                            <Chip
                              label={stats.hold}
                              sx={{
                                bgcolor: '#fed7d7',
                                color: '#9b2c2c',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                height: 24
                              }}
                            />
                          </Box>
                          <Divider sx={{ my: 1 }} />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>Total:</Typography>
                            <Chip
                              label={stats.total}
                              sx={{
                                bgcolor: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                                color: 'white',
                                fontWeight: 800,
                                fontSize: '0.8rem',
                                height: 26
                              }}
                            />
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Box>
                </Box>
              </Box>
            )
          }

          {/* ========== TAB 2: MULTI QC ========== */}
          {
            currentTabCode === 'multi' && (
              <Box
                ref={multiEntryContainerRef}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%', gap: 1, mt: 1,
                  bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa'
                }}>
                {/* HEADER */}
                <Card sx={{ borderRadius: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', bgcolor: isDarkMode ? '#1e293b' : 'white' }}>
                  <CardContent sx={{ p: { xs: 1.5, md: 1.2 }, pt: { xs: 2, md: 1.2 }, '&:last-child': { pb: { xs: 1.5, md: 1.2 } } }}>

                    {/* ===== MOBILE: Single Row - Scrollable Inputs + Fixed Buttons ===== */}
                    <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 0.5, width: '100%', mt: 1 }}>
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
                              label="QC Date"
                              type="date"
                              value={commonQcDate}
                              onChange={(e) => setCommonQcDate(e.target.value)}
                              size="small"
                              sx={{
                                minWidth: 130,
                                '& .MuiInputBase-root': { height: 36, fontSize: '0.8rem' },
                                '& .MuiInputLabel-root': { fontSize: '0.75rem' }
                              }}
                              InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                              label="QC By"
                              value={commonQcByName}
                              onChange={(e) => setCommonQcByName(e.target.value)}
                              size="small"
                              sx={{
                                minWidth: 100,
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
                        {/* Mobile Scan Button */}
                        <Tooltip title="Mobile Scan">
                          <IconButton
                            size="small"
                            onClick={() => router.push('/mobile-scan?mode=qc')}
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: 1,
                              border: '1.5px solid',
                              borderColor: '#7c3aed',
                              color: '#7c3aed',
                              bgcolor: 'rgba(124,58,237,0.06)',
                              '&:hover': { borderColor: '#7c3aed', bgcolor: 'rgba(124,58,237,0.15)' }
                            }}
                          >
                            <QrCodeScannerIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>

                        {/* Menu Button */}
                        <Tooltip title="Open Settings">
                          <IconButton
                            size="small"
                            onClick={() => setQcSettingsPanelOpen(true)}
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
                          pageType="qc"
                          isDarkMode={isDarkMode}
                          container={multiEntryContainerRef.current}
                        />
                      </Stack>
                    </Box>

                    {/* ===== DESKTOP: Clean Single Row Layout ===== */}
                    <Stack
                      direction="row"
                      sx={{
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        display: { xs: 'none', md: 'flex' }
                      }}
                    >
                      {/* LEFT: Date + Name Fields */}
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <TextField
                          label="QC Date"
                          type="date"
                          value={commonQcDate}
                          onChange={(e) => setCommonQcDate(e.target.value)}
                          size="small"
                          sx={{
                            width: 150,
                            '& .MuiInputBase-root': {
                              height: 38,
                              bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                              borderRadius: 1.5
                            }
                          }}
                          InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                          label="QC By Name"
                          value={commonQcByName}
                          onChange={(e) => setCommonQcByName(e.target.value)}
                          size="small"
                          sx={{
                            width: 180,
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
                            onClick={() => setQcSettingsPanelOpen(true)}
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
                          pageType="qc"
                          isDarkMode={isDarkMode}
                          container={multiEntryContainerRef.current}
                        />
                      </Stack>
                    </Stack>

                    {/* SETTINGS DRAWER - Right Side Panel with Accordions */}
                    <Drawer
                      anchor="right"
                      open={qcSettingsPanelOpen}
                      onClose={() => setQcSettingsPanelOpen(false)}
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
                        <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Settings</Typography>
                        <IconButton size="small" onClick={() => setQcSettingsPanelOpen(false)} sx={{ color: 'white' }}>
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
                                          let next: string[];
                                          if (e.target.checked) {
                                            next = [...visibleColumns, col];
                                          } else {
                                            next = visibleColumns.filter((c: string) => c !== col);
                                          }
                                          // ✅ FIX: Maintain column ordering
                                          const ordered = ['sno', ...EDITABLE_COLUMNS, ...ALL_MASTER_COLUMNS].filter(c => next.includes(c));
                                          saveColumnSettings(ordered);
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
                                {ALL_MASTER_COLUMNS.map((col) => (
                                  <FormControlLabel
                                    key={col}
                                    control={
                                      <Checkbox
                                        size="small"
                                        checked={visibleColumns.includes(col)}
                                        onChange={(e) => {
                                          let next: string[];
                                          if (e.target.checked) {
                                            next = [...visibleColumns, col];
                                          } else {
                                            next = visibleColumns.filter((c: string) => c !== col);
                                          }
                                          // ✅ FIX: Maintain column ordering
                                          const ordered = ['sno', ...EDITABLE_COLUMNS, ...ALL_MASTER_COLUMNS].filter(c => next.includes(c));
                                          saveColumnSettings(ordered);
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
                                    checked={gridSettings.sortable}
                                    onChange={(e) => updateGridSettings({ ...gridSettings, sortable: e.target.checked })}
                                    sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                                  />
                                }
                                label={
                                  <Box>
                                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>Enable Sorting</Typography>
                                    <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Click headers to sort</Typography>
                                  </Box>
                                }
                              />
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={gridSettings.filter}
                                    onChange={(e) => updateGridSettings({ ...gridSettings, filter: e.target.checked })}
                                    sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                                  />
                                }
                                label={
                                  <Box>
                                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>Enable Filtering</Typography>
                                    <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Filter in column headers</Typography>
                                  </Box>
                                }
                              />
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={gridSettings.resizable}
                                    onChange={(e) => updateGridSettings({ ...gridSettings, resizable: e.target.checked })}
                                    sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                                  />
                                }
                                label={
                                  <Box>
                                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>Column Resize</Typography>
                                    <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Drag borders to resize</Typography>
                                  </Box>
                                }
                              />
                              <Button
                                size="small"
                                onClick={() => {
                                  updateGridSettings({ sortable: true, filter: true, resizable: true, editable: true });
                                  toast.success('Grid settings reset');
                                }}
                                sx={{ alignSelf: 'flex-start', fontSize: '0.75rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}
                              >
                                Reset to Default
                              </Button>
                            </Stack>
                          </AccordionDetails>
                        </Accordion>

                        {/* ═══════════ AVAILABLE CACHE ACCORDION ═══════════ */}
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                              <InventoryIcon sx={{ color: '#8b5cf6', fontSize: 22 }} />
                              <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>Available Cache</Typography>
                                <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                                  {availableCacheLoading ? availableCacheProgress || 'Loading...' : availableCacheStats?.count ? `${availableCacheStats.count.toLocaleString()} items` : availableCacheEnabled ? 'Not loaded' : 'Disabled'}
                                </Typography>
                              </Box>
                              <Chip
                                size="small"
                                label={availableCacheLoading ? '🔄' : availableCacheStats?.count ? '✅' : '⚪'}
                                sx={{ height: 24, fontSize: '0.8rem', bgcolor: availableCacheStats?.count ? '#10b981' : '#64748b', color: 'white' }}
                              />
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                            <Stack spacing={1.5}>
                              <Alert severity="info" sx={{ fontSize: '0.75rem', py: 0.5 }}>
                                Cache available inventory for instant WSN lookup during QC.
                              </Alert>
                              <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                p: 1.5,
                                borderRadius: 1.5,
                                bgcolor: availableCacheEnabled ? 'rgba(139, 92, 246, 0.1)' : (isDarkMode ? '#0f172a' : '#f8fafc'),
                                border: `1px solid ${availableCacheEnabled ? '#8b5cf6' : (isDarkMode ? '#334155' : '#e2e8f0')}`
                              }}>
                                <Box>
                                  <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>Enable Cache</Typography>
                                  <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Instant WSN lookups</Typography>
                                </Box>
                                <Switch
                                  checked={availableCacheEnabled}
                                  onChange={(e) => {
                                    const newValue = e.target.checked;
                                    if (newValue) {
                                      enableWMSCache();
                                    } else {
                                      disableWMSCache();
                                    }
                                    setAvailableCacheEnabled(newValue);
                                    toast.success(`Cache ${newValue ? 'enabled' : 'disabled'}`);
                                  }}
                                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#8b5cf6' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#8b5cf6' } }}
                                />
                              </Box>
                              <Button
                                fullWidth
                                variant="contained"
                                disabled={availableCacheLoading || !activeWarehouse?.id}
                                onClick={handleLoadAvailableCache}
                                sx={{
                                  height: 44,
                                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                                  fontWeight: 600,
                                  '&:hover': { background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' },
                                  '&.Mui-disabled': { bgcolor: '#64748b' }
                                }}
                              >
                                {availableCacheLoading ? '🔄 Loading...' : '⚡ Load Available Cache'}
                              </Button>
                              {availableCacheStats?.lastSync && (
                                <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8', textAlign: 'center' }}>
                                  Last sync: {new Date(availableCacheStats.lastSync).toLocaleTimeString()}
                                </Typography>
                              )}
                            </Stack>
                          </AccordionDetails>
                        </Accordion>

                        {/* ═══════════ EXPORT BUTTON ═══════════ */}
                        <Box sx={{ p: 2, borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
                          <Button
                            fullWidth
                            variant="contained"
                            startIcon={<DownloadIcon />}
                            onClick={() => { setQcSettingsPanelOpen(false); setExportColumnsDialogOpen(true); }}
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

                        {/* ═══════════ PRINT & SHORTCUTS ═══════════ */}
                        <Box sx={{ p: 2 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PrintIcon fontSize="small" /> Print & Shortcuts
                          </Typography>

                          {/* Print Agent Status */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, p: 1, borderRadius: 1, bgcolor: agentReady ? (isDarkMode ? '#064e3b' : '#ecfdf5') : (isDarkMode ? '#7f1d1d' : '#fef2f2') }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: agentReady ? '#10b981' : '#ef4444' }} />
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              Print Agent: {agentReady ? 'Connected' : 'Not Running'}
                            </Typography>
                          </Box>

                          {/* Ctrl+P Toggle */}
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <KeyboardIcon fontSize="small" sx={{ color: isDarkMode ? '#94a3b8' : '#64748b' }} />
                              <Typography variant="body2">Ctrl+P Print Label</Typography>
                            </Box>
                            <Switch
                              size="small"
                              checked={ctrlPPrintEnabled}
                              onChange={(e) => {
                                setCtrlPPrintEnabled(e.target.checked);
                                localStorage.setItem('qc_ctrlP_print_enabled', String(e.target.checked));
                              }}
                            />
                          </Box>

                          {/* Ctrl+O Toggle */}
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LinkIcon fontSize="small" sx={{ color: isDarkMode ? '#94a3b8' : '#64748b' }} />
                              <Typography variant="body2">Ctrl+O Product Link</Typography>
                            </Box>
                            <Switch
                              size="small"
                              checked={ctrlOProductLinkEnabled}
                              onChange={(e) => {
                                setCtrlOProductLinkEnabled(e.target.checked);
                                localStorage.setItem('qc_ctrlO_productlink_enabled', String(e.target.checked));
                              }}
                            />
                          </Box>

                          <Typography variant="caption" sx={{ color: isDarkMode ? '#64748b' : '#94a3b8', display: 'block', mt: 1 }}>
                            Enable shortcuts to quickly print labels or open product pages after scanning a WSN.
                          </Typography>
                        </Box>
                      </Box>
                    </Drawer>

                  </CardContent>
                </Card>


                {/* AG GRID - Professional Excel-like styling */}
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    border: isDarkMode ? '1px solid #334155' : '2px solid #94a3b8',
                    borderRadius: '6px',
                    overflow: 'hidden',
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
                      color: isDarkMode ? '#f1f5f9' : '#1e293b',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    },
                    '& .ag-cell:last-child': { borderRight: isDarkMode ? 'none' : '1px solid #cbd5e1' },

                    // Error cell styling
                    '& .wsn-cross-error': {
                      backgroundColor: isDarkMode ? '#7f1d1d !important' : '#fee2e2 !important',
                      fontWeight: 700,
                    },
                    '& .wsn-dup-error': {
                      backgroundColor: isDarkMode ? '#78350f !important' : '#fef3c7 !important',
                      fontWeight: 700,
                    },

                    // Professional rows with visible borders
                    '& .ag-row': {
                      height: 36,
                      overflow: 'visible',
                      borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #cbd5e1',
                    },
                    '& .ag-row-even': { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' },
                    '& .ag-row-odd': { backgroundColor: isDarkMode ? '#1a2536' : '#f1f5f9' },

                    // Active cell focus - Enhanced for dark mode with strong visibility (matching Outbound)
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

                    // Range selection
                    '& .ag-cell-range-selected': {
                      backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.25) !important' : '#dbeafe !important',
                    },
                    '& .ag-cell-range-single-cell': {
                      backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2) !important' : '#eff6ff !important',
                    },

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

                    // Hover effects
                    '& .ag-row-hover': {
                      backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.12) !important' : '#e0f2fe !important',
                    },
                  }}
                >
                  <AgGridReact
                    rowData={multiRows}
                    columnDefs={multiColumnDefs}
                    rowHeight={tableRowHeight}
                    headerHeight={32}
                    getRowId={(params: any) => params.data._rowId}

                    onGridReady={(params: any) => {
                      gridRef.current = params.api;
                      columnApiRef.current = params.columnApi;
                    }}

                    defaultColDef={{
                      sortable: gridSettings.sortable,
                      filter: gridSettings.filter,
                      resizable: gridSettings.resizable,
                      // ⚡ CRITICAL: Suppress AG Grid's built-in Ctrl+Arrow / Shift+Arrow handling
                      // so our custom handlers get the CORRECT focused cell position.
                      suppressKeyboardEvent: (params: any) => {
                        // Don't suppress when editing a cell — let native input handle Shift+Arrow, Ctrl+Arrow etc.
                        if (params.editing) return false;
                        const event = params.event;
                        if (!event) return false;
                        const ctrlKey = event.ctrlKey || event.metaKey;
                        const shiftKey = event.shiftKey;
                        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
                        // Suppress both Ctrl+Arrow and Shift+Arrow so our custom handlers
                        // get the CORRECT focused cell position (AG Grid won't move focus first)
                        if ((ctrlKey || shiftKey) && arrowKeys.includes(event.key)) return true;
                        return false;
                      },
                      editable: (params: any) => {
                        if (!gridSettings.editable) return false;
                        const field = params.colDef.field as string;
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
                          // Use consistent cyan color matching Outbound
                          const borderColor = isDarkMode ? '#22d3ee' : '#2563eb';
                          const bgColor = isDarkMode ? 'rgba(34, 211, 238, 0.25)' : 'rgba(37, 99, 235, 0.15)';

                          const style: any = {
                            backgroundColor: bgColor,
                            boxShadow: isDarkMode
                              ? 'inset 0 0 0 1px rgba(34, 211, 238, 0.6)'
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
                    }}

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
                      // Always update lastGridScrollTopRef during auto-scroll to prevent stale deltas
                      if (isAutoScrollingRef.current) {
                        lastGridScrollTopRef.current = event.top;
                        return;
                      }

                      const currentScrollTop = event.top;
                      const scrollDelta = Math.abs(currentScrollTop - lastGridScrollTopRef.current);

                      if (scrollDelta > 10) {
                        userScrolledRef.current = true;
                        if (userScrollTimeoutRef.current) window.clearTimeout(userScrollTimeoutRef.current);
                        userScrollTimeoutRef.current = setTimeout(() => {
                          userScrolledRef.current = false;
                          userScrollTimeoutRef.current = null;
                        }, 1500) as unknown as number;
                      }

                      lastGridScrollTopRef.current = currentScrollTop;
                    }}

                    stopEditingWhenCellsLoseFocus={true}
                    enterNavigatesVertically={true}
                    enterNavigatesVerticallyAfterEdit={true}
                    navigateToNextCell={navigateToNextCell}
                    ensureDomOrder={true}
                    suppressMovableColumns={true}
                    // ? PERFORMANCE: Optimizations for smooth fast scrolling
                    rowBuffer={20}
                    suppressRowTransform={false}
                    suppressAnimationFrame={false}
                    alwaysShowVerticalScroll={true}
                    animateRows={false}
                    suppressScrollOnNewData={true}
                    debounceVerticalScrollbar={true}
                    suppressPropertyNamesCheck={true}
                    valueCache={true}
                    className="ag-theme-quartz"
                    containerStyle={{ height: '100%', width: '100%' }}
                    // ✅ Save column widths when user finishes resizing
                    onColumnResized={(params: any) => {
                      if (params.finished && params.column && params.source === 'uiColumnResized') {
                        const colId = params.column.getColId();
                        const newWidth = params.column.getActualWidth();
                        // Don't save special columns
                        if (colId === 'print_action' || colId === '_filler') return;
                        setMultiColumnWidths(prev => {
                          const updated = { ...prev, [colId]: newWidth };
                          localStorage.setItem('qcMultiEntryColumnWidths', JSON.stringify(updated));
                          return updated;
                        });
                      }
                    }}

                    // Column widths are fixed (auto-sized or user-saved) — no forced re-layout on container resize
                    onGridSizeChanged={() => {
                      // Intentionally empty — filler column absorbs remaining space
                    }}

                    // Auto-size columns that don't have user-saved widths (size to text content)
                    onFirstDataRendered={(params: any) => {
                      try {
                        const api = params.api;
                        if (api) {
                          const allCols = api.getColumns ? api.getColumns() : (api.getAllGridColumns ? api.getAllGridColumns() : []);
                          const colsToAutoSize = allCols
                            .map((c: any) => c.getColId())
                            .filter((id: string) => id !== 'sno' && id !== 'print_action' && id !== '_filler' && !multiColumnWidths[id]);
                          if (colsToAutoSize.length > 0) {
                            api.autoSizeColumns(colsToAutoSize, false);
                          }
                        }
                      } catch { /* ignore */ }
                    }}

                    onCellValueChanged={handleMultiCellValueChanged}

                  />
                </Box>

                {/* ======================== GRID SETTINGS DIALOG ======================== */}
                <Dialog
                  open={gridSettingsOpen}
                  onClose={() => setGridSettingsOpen(false)}
                  maxWidth="xs"
                  fullWidth
                  PaperProps={{
                    sx: {
                      borderRadius: 2,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
                    }
                  }}
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
                        Settings auto-save and persist after reload
                      </Alert>

                      {/* SORTABLE */}
                      <Box>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={gridSettings.sortable}
                              onChange={(e) => updateGridSettings({ ...gridSettings, sortable: e.target.checked })}
                              sx={{
                                '&.Mui-checked': { color: '#f59e0b' }
                              }}
                            />
                          }
                          label={
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>Enable Sorting
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
                              checked={gridSettings.filter}
                              onChange={(e) => updateGridSettings({ ...gridSettings, filter: e.target.checked })}
                              sx={{
                                '&.Mui-checked': { color: '#f59e0b' }
                              }}
                            />
                          }
                          label={
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>Enable Column Filters
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
                              checked={gridSettings.resizable}
                              onChange={(e) => updateGridSettings({ ...gridSettings, resizable: e.target.checked })}
                              sx={{
                                '&.Mui-checked': { color: '#f59e0b' }
                              }}
                            />
                          }
                          label={
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>Enable Column Resize
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
                        const defaultSettings = {
                          sortable: true,
                          filter: true,
                          resizable: true,
                          editable: true,
                        };
                        updateGridSettings(defaultSettings);
                        toast.success('Settings reset to default');
                      }}
                      sx={{
                        fontWeight: 700,
                        color: '#78716c',
                        '&:hover': {
                          bgcolor: 'rgba(120, 113, 108, 0.1)'
                        }
                      }}
                    >
                      🔄 Reset All
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Button
                      variant="contained"
                      onClick={() => setGridSettingsOpen(false)}
                      sx={{
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        fontWeight: 700,
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #d97706 0%, #b45309 100)',
                        }
                      }}
                    >
                      Done
                    </Button>
                  </DialogActions>
                </Dialog>



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
                    disabled={multiLoading}
                    startIcon={multiLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <CheckCircle sx={{ fontSize: 16 }} />}
                    sx={{
                      flexShrink: 0,
                      height: 36,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      px: 1.5,
                      minWidth: 100,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
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
                  flexWrap: 'wrap',
                  py: 0.5,
                  flexShrink: 0
                }}>
                  <Chip
                    label={draftSavedAt ? `Draft saved ${new Date(draftSavedAt).toLocaleTimeString()}` : 'No draft'}
                    color={draftExists ? 'success' : 'default'}
                    size="small"
                    sx={{ height: 28 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => saveDraftImmediate()}
                    disabled={draftSaving}
                    sx={{ height: 32, fontSize: '0.75rem' }}
                  >
                    Save Draft
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={clearDraft}
                    disabled={!draftExists}
                    sx={{ height: 32, fontSize: '0.75rem' }}
                  >
                    Clear Draft
                  </Button>

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
                      borderColor: '#f59e0b',
                      color: '#f59e0b',
                      '&:hover': {
                        borderColor: '#d97706',
                        bgcolor: 'rgba(245, 158, 11, 0.1)'
                      }
                    }}
                  >
                    +500 Rows
                  </Button>

                  {/* SUBMIT BUTTON */}
                  <Button
                    variant="contained"
                    onClick={handleMultiSubmit}
                    disabled={multiLoading}
                    startIcon={multiLoading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <CheckCircle sx={{ fontSize: 18 }} />}
                    sx={{
                      ml: 'auto',
                      height: 38,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      minWidth: { xs: 150, sm: 200 },
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    }}
                  >
                    SUBMIT ALL ({multiRows.filter((r) => r.wsn?.trim()).length} rows)
                  </Button>
                </Box>

                {/* COLUMN SETTINGS DIALOG */}
                <Dialog
                  open={columnSettingsOpen}
                  onClose={() => setColumnSettingsOpen(false)}
                  maxWidth="sm"
                  fullWidth
                  fullScreen={isMobile}
                  PaperProps={{ sx: { borderRadius: 2 } }}
                >
                  <DialogTitle
                    sx={{
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                      color: 'white',
                      py: 2,
                    }}
                  >Column View Settings
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
                      {EDITABLE_COLUMNS.map((col) => (
                        <FormControlLabel
                          key={col}
                          control={
                            <Checkbox
                              checked={visibleColumns.includes(col)}
                              disabled={col === 'sno'}  // ? Can't uncheck serial number
                              onChange={(e) => {
                                if (col === 'sno') return;  // ? Safety check

                                let next: string[];
                                if (e.target.checked) {
                                  // Add column
                                  next = [...visibleColumns, col];
                                } else {
                                  // Remove column
                                  next = visibleColumns.filter((c: string) => c !== col);
                                }

                                // ? Build ordered array respecting user's choices
                                const ordered = [
                                  'sno',  // Always first
                                  ...EDITABLE_COLUMNS.filter(c => c !== 'sno' && next.includes(c)),  // User-selected editable columns
                                  ...ALL_MASTER_COLUMNS.filter(c => next.includes(c))  // User-selected master columns
                                ];

                                saveColumnSettings(ordered);
                              }}
                            />
                          }
                          label={col === 'sno' ? 'S.No' : col.replace(/([A-Z])/g, ' $1').toUpperCase()}
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
                      {ALL_MASTER_COLUMNS.map((col) => (
                        <FormControlLabel
                          key={col}
                          control={
                            <Checkbox
                              checked={visibleColumns.includes(col)}
                              onChange={(e) => {
                                let next: string[];
                                if (e.target.checked) {
                                  // Add column
                                  next = [...visibleColumns, col];
                                } else {
                                  // Remove column
                                  next = visibleColumns.filter((c: string) => c !== col);
                                }

                                // ? Build ordered array respecting user's choices
                                const ordered = [
                                  'sno',  // Always first
                                  ...EDITABLE_COLUMNS.filter(c => c !== 'sno' && next.includes(c)),  // User-selected editable columns
                                  ...ALL_MASTER_COLUMNS.filter(c => next.includes(c))  // User-selected master columns
                                ];

                                saveColumnSettings(ordered);
                              }}
                            />
                          }
                          label={col.replace(/([A-Z])/g, ' $1').toUpperCase()}
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
              </Box>
            )
          }

          {/* ========== TAB 3: BULK UPLOAD ========== */}
          {
            currentTabCode === 'bulk' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: { xs: 1, sm: 1.5, md: 2 }, overflow: 'auto' }}>
                <BulkUploadCard
                  module="qc"
                  warehouseId={activeWarehouse?.id || 0}
                  userId={user?.id}
                  onUploadComplete={() => {
                    loadQCList();
                    loadStats();
                    loadBatches();
                  }}
                  onDownloadTemplate={handleConfirmDownload}
                  templateColumns={['WSN', 'GRADE', 'RACKNO', 'QCREMARKS', 'OTHERREMARKS', 'PRODUCTSERIALNUMBER']}
                  title="Bulk QC Upload"
                  dropdownFields={[
                    {
                      key: 'qc_date',
                      label: 'QC Date',
                      type: 'date',
                      required: true,
                    },
                    {
                      key: 'qc_by_name',
                      label: 'QC By',
                      type: 'readonly',
                      value: (user as any)?.full_name || (user as any)?.name || (user as any)?.username || 'Current User',
                    },
                  ]}
                />
              </Box>
            )
          }

          {/* ========== TAB 4: BATCH MANAGER ========== */}
          {
            currentTabCode === 'batches' && (
              <BatchManagementTab
                batches={batches}
                loading={batchLoading}
                onRefresh={loadBatches}
                onDelete={canSeeButton('batches:delete') ? handleDeleteBatch : undefined}
                canDelete={canSeeButton('batches:delete')}
                title="Batch Management"
                emptyMessage="No batches found"
                emptySubMessage="Batches will appear here after bulk QC uploads"
              />
            )
          }
        </Paper >

        {/* EXPORT DIALOG */}
        <Dialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          maxWidth="md"
          fullWidth
          fullScreen={isMobile}
          container={isFullscreen ? multiEntryContainerRef.current : undefined}
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              bgcolor: isDarkMode ? '#0f172a' : 'background.paper'
            }
          }}
        >
          <DialogTitle sx={{
            fontWeight: 800,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            py: 3,
            px: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}>
            <DownloadIcon sx={{ fontSize: '1.5rem' }} />
            Advanced Export Options
            <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.8, fontSize: '0.7rem' }}>
              Filter & Download
            </Typography>
          </DialogTitle>

          <DialogContent sx={{
            py: 4,
            px: 3,
            bgcolor: isDarkMode ? '#0f172a' : 'background.paper'
          }}>
            <Stack spacing={3}>
              {/* CURRENT FILTERS PREVIEW */}
              <Alert
                severity="info"
                icon={<InfoIcon />}
                sx={{
                  fontSize: '0.85rem',
                  borderRadius: 2,
                  bgcolor: isDarkMode ? 'rgba(14, 165, 233, 0.1)' : undefined,
                  border: isDarkMode ? '1px solid rgba(14, 165, 233, 0.3)' : undefined,
                  '& .MuiAlert-icon': { color: '#0ea5e9' },
                  '& .MuiAlert-message': { color: isDarkMode ? '#f1f5f9' : undefined }
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#0ea5e9' }}>
                  📋 Applied Filters Preview:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {searchFilter && (
                    <Chip size="small" label={`🔍 "${searchFilter}"`} sx={{ bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe', color: isDarkMode ? '#93c5fd' : '#1e40af' }} />
                  )}
                  {(exportGrade || gradeFilter) && (
                    <Chip size="small" label={`📊 Grade: ${exportGrade || gradeFilter}`} sx={{ bgcolor: isDarkMode ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7', color: isDarkMode ? '#86efac' : '#166534' }} />
                  )}
                  {(exportBrand || brandFilter) && (
                    <Chip size="small" label={`🏷️ ${exportBrand || brandFilter}`} sx={{ bgcolor: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7', color: isDarkMode ? '#fcd34d' : '#92400e' }} />
                  )}
                  {exportCategory && (
                    <Chip size="small" label={`📂 ${exportCategory}`} sx={{ bgcolor: isDarkMode ? 'rgba(168, 85, 247, 0.2)' : '#f3e8ff', color: isDarkMode ? '#c4b5fd' : '#6b21a8' }} />
                  )}
                  {exportBatchIds.length > 0 && (
                    <Chip size="small" label={`📦 ${exportBatchIds.length} Batch${exportBatchIds.length > 1 ? 'es' : ''}`} sx={{ bgcolor: isDarkMode ? 'rgba(236, 72, 153, 0.2)' : '#fce7f3', color: isDarkMode ? '#f9a8d4' : '#9d174d' }} />
                  )}
                  {(exportStartDate || dateFromFilter) && (
                    <Chip size="small" label={`📅 From: ${exportStartDate || dateFromFilter}`} sx={{ bgcolor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff', color: isDarkMode ? '#a5b4fc' : '#3730a3' }} />
                  )}
                  {(exportEndDate || dateToFilter) && (
                    <Chip size="small" label={`📅 To: ${exportEndDate || dateToFilter}`} sx={{ bgcolor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff', color: isDarkMode ? '#a5b4fc' : '#3730a3' }} />
                  )}
                  {!exportStartDate && !exportEndDate && !exportGrade && !exportBrand && !exportCategory && !searchFilter && !gradeFilter && !brandFilter && !dateFromFilter && !dateToFilter && exportBatchIds.length === 0 && (
                    <Chip size="small" label="🔍 All Data" sx={{ bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2', color: isDarkMode ? '#fca5a5' : '#dc2626' }} />
                  )}
                </Box>
              </Alert>

              {/* DIVIDER WITH ICON */}
              <Divider sx={{ '&::before, &::after': { borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e5e7eb' } }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 0.5,
                  bgcolor: isDarkMode ? '#334155' : '#f9fafb',
                  borderRadius: 2,
                  border: isDarkMode ? '1px solid rgba(255,255,255,0.15)' : '1px solid #e5e7eb'
                }}>
                  <SettingsIcon sx={{ fontSize: '1rem', color: isDarkMode ? '#94a3b8' : '#6b7280' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#6b7280' }}>
                    Override Filters (Optional)
                  </Typography>
                </Box>
              </Divider>

              {/* OVERRIDE CONTROLS */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <TextField
                  fullWidth
                  label="Start Date Override"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#10b981' },
                      '&.Mui-focused fieldset': { borderColor: '#10b981' }
                    }
                  }}
                />
                <TextField
                  fullWidth
                  label="End Date Override"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#10b981' },
                      '&.Mui-focused fieldset': { borderColor: '#10b981' }
                    }
                  }}
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel sx={{ '&.Mui-focused': { color: '#10b981' } }}>Grade</InputLabel>
                  <Select
                    value={exportGrade}
                    label="Grade"
                    onChange={(e) => setExportGrade(e.target.value)}
                    sx={{ borderRadius: 2, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#10b981' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#10b981' } }}
                  >
                    <MenuItem value="">All Grades</MenuItem>
                    {QC_GRADES.map((g) => (
                      <MenuItem key={g} value={g}>{g}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel sx={{ '&.Mui-focused': { color: '#10b981' } }}>Brand</InputLabel>
                  <Select
                    value={exportBrand}
                    label="Brand"
                    onChange={(e) => setExportBrand(e.target.value)}
                    sx={{ borderRadius: 2, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#10b981' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#10b981' } }}
                  >
                    <MenuItem value="">All Brands</MenuItem>
                    {brands.map((b) => (
                      <MenuItem key={b} value={b}>{b}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel sx={{ '&.Mui-focused': { color: '#10b981' } }}>Category</InputLabel>
                  <Select
                    value={exportCategory}
                    label="Category"
                    onChange={(e) => setExportCategory(e.target.value)}
                    sx={{ borderRadius: 2, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#10b981' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#10b981' } }}
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    {categories.map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* BATCH MULTI-SELECT */}
              <FormControl fullWidth>
                <InputLabel sx={{ '&.Mui-focused': { color: '#10b981' } }}>Batch IDs</InputLabel>
                <Select
                  multiple
                  value={exportBatchIds}
                  label="Batch IDs"
                  onChange={(e) => setExportBatchIds(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[])}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip
                          key={value}
                          label={value}
                          size="small"
                          onDelete={() => setExportBatchIds(exportBatchIds.filter(id => id !== value))}
                          onMouseDown={(e) => e.stopPropagation()}
                          sx={{
                            bgcolor: isDarkMode ? 'rgba(236, 72, 153, 0.2)' : '#fce7f3',
                            color: isDarkMode ? '#f9a8d4' : '#9d174d',
                            fontWeight: 600,
                            '& .MuiChip-deleteIcon': { color: isDarkMode ? '#f9a8d4' : '#9d174d' }
                          }}
                        />
                      ))}
                    </Box>
                  )}
                  sx={{ borderRadius: 2, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#10b981' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#10b981' } }}
                >
                  {batches.map((b) => (
                    <MenuItem key={b.batch_id} value={b.batch_id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{b.batch_id}</Typography>
                        <Chip label={`${b.count} entries`} size="small" sx={{ bgcolor: isDarkMode ? '#334155' : '#e5e7eb', color: isDarkMode ? '#94a3b8' : '#374151', fontSize: '0.7rem', height: '20px', ml: 1 }} />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* EXPORT SUMMARY */}
              <Card sx={{
                bgcolor: isDarkMode ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4',
                border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #bbf7d0',
                borderRadius: 2
              }}>
                <CardContent sx={{ py: 2, px: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isDarkMode ? '#34d399' : '#166534', mb: 1 }}>
                    📊 Export Summary:
                  </Typography>
                  <Typography variant="body2" sx={{ color: isDarkMode ? '#a7f3d0' : '#166534' }}>
                    This will export filtered QC records to Excel with all selected criteria applied.
                    The file will include QC details, product information, and master data.
                  </Typography>
                </CardContent>
              </Card>
            </Stack>
          </DialogContent>

          <DialogActions sx={{
            p: 3,
            bgcolor: isDarkMode ? '#1e293b' : '#f9fafb',
            borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
            gap: 1
          }}>
            <Button
              onClick={() => setExportDialogOpen(false)}
              sx={{
                borderRadius: 2,
                px: 3,
                fontWeight: 600,
                color: isDarkMode ? '#94a3b8' : '#6b7280',
                '&:hover': { bgcolor: isDarkMode ? '#334155' : '#e5e7eb' }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleExport}
              startIcon={<DownloadIcon />}
              sx={{
                borderRadius: 2,
                px: 4,
                py: 1.5,
                fontWeight: 700,
                fontSize: '0.9rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
                  transform: 'translateY(-1px)'
                },
                transition: 'all 0.2s ease-in-out'
              }}
            >
              Export Data
            </Button>
          </DialogActions>
        </Dialog>

        {/* GRADE MANAGEMENT DIALOG */}
        < Dialog open={gradeDialogOpen} onClose={() => { setGradeDialogOpen(false); setNewGrade(''); setEditingGradeIndex(null); }} maxWidth="sm" fullWidth fullScreen={isMobile} container={isFullscreen ? multiEntryContainerRef.current : undefined} >
          <DialogTitle>Manage QC Grades</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1}>
                <TextField
                  label={editingGradeIndex !== null ? 'Edit Grade' : 'New Grade'}
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value.toUpperCase())}
                  fullWidth
                  size="small"
                  placeholder="e.g., A, B, C"
                />
                <Button variant="contained" onClick={handleAddGrade}>
                  {editingGradeIndex !== null ? 'Update' : 'Add'}
                </Button>
              </Stack>

              <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2 }}>
                Current Grades:
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {QC_GRADES.map((grade, idx) => (
                  <Chip
                    key={grade}
                    label={grade}
                    onDelete={() => handleDeleteGrade(idx)}
                    onClick={() => { setNewGrade(grade); setEditingGradeIndex(idx); }}
                    icon={<EditIcon />}
                  />
                ))}
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setGradeDialogOpen(false); setNewGrade(''); setEditingGradeIndex(null); }}>Done</Button>
          </DialogActions>
        </Dialog >

        {/* COLUMN SETTINGS - LIST */}
        < Dialog open={listColumnSettingsOpen} onClose={() => setListColumnSettingsOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile} container={isFullscreen ? multiEntryContainerRef.current : undefined} >
          <DialogTitle>Column Settings</DialogTitle>
          <DialogContent>
            <Stack spacing={1} sx={{ mt: 2 }}>
              {ALL_LIST_COLUMNS.map((col) => (
                <FormControlLabel
                  key={col}
                  control={
                    <Checkbox
                      checked={listColumns.find(c => c.key === col)?.visible || false}
                      onChange={() => handleListColumnToggle(col)}

                    />
                  }
                  label={col.toUpperCase().replace(/_/g, ' ')}
                />
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setListColumnSettingsOpen(false)}>Done</Button>
          </DialogActions>
        </Dialog >

        {/* ═══════════ EXPORT COLUMNS SELECTION DIALOG ═══════════ */}
        <Dialog
          open={exportColumnsDialogOpen}
          onClose={() => setExportColumnsDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          fullScreen={isMobile}
          container={isFullscreen ? multiEntryContainerRef.current : undefined}
          PaperProps={{
            sx: {
              borderRadius: '12px',
              bgcolor: isDarkMode ? '#1e293b' : '#fff',
              color: isDarkMode ? '#e2e8f0' : '#1e293b',
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0', pb: 1.5 }}>
            Select Export Columns
          </DialogTitle>
          <DialogContent sx={{ pt: '16px !important' }}>
            {/* Select All / None */}
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setExportSelectedColumns(DEFAULT_EXPORT_COLUMNS)}
                sx={{ textTransform: 'none', fontSize: '12px' }}
              >
                Select All
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setExportSelectedColumns([])}
                sx={{ textTransform: 'none', fontSize: '12px' }}
              >
                Select None
              </Button>
            </Box>

            {/* User Input Columns */}
            <Typography variant="caption" sx={{ fontWeight: 700, color: isDarkMode ? '#94a3b8' : '#64748b', display: 'block', mb: 0.5, mt: 1 }}>
              USER INPUT COLUMNS
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
              {EXPORT_COLUMN_MAP.filter(c => c.key === 'sno' || !ALL_MASTER_COLUMNS.includes(c.key)).map(col => (
                <FormControlLabel
                  key={col.key}
                  control={
                    <Checkbox
                      size="small"
                      checked={exportSelectedColumns.includes(col.key)}
                      onChange={(e) => {
                        setExportSelectedColumns(prev =>
                          e.target.checked ? [...prev, col.key] : prev.filter(k => k !== col.key)
                        );
                      }}
                    />
                  }
                  label={<Typography variant="body2">{col.label}</Typography>}
                />
              ))}
            </Box>

            {/* Master Data Columns */}
            <Typography variant="caption" sx={{ fontWeight: 700, color: isDarkMode ? '#94a3b8' : '#64748b', display: 'block', mb: 0.5, mt: 2 }}>
              MASTER DATA COLUMNS
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
              {EXPORT_COLUMN_MAP.filter(c => ALL_MASTER_COLUMNS.includes(c.key)).map(col => (
                <FormControlLabel
                  key={col.key}
                  control={
                    <Checkbox
                      size="small"
                      checked={exportSelectedColumns.includes(col.key)}
                      onChange={(e) => {
                        setExportSelectedColumns(prev =>
                          e.target.checked ? [...prev, col.key] : prev.filter(k => k !== col.key)
                        );
                      }}
                    />
                  }
                  label={<Typography variant="body2">{col.label}</Typography>}
                />
              ))}
            </Box>

            {/* Save preference checkbox */}
            <Box sx={{ mt: 2, pt: 1.5, borderTop: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={exportSavePreference}
                    onChange={(e) => setExportSavePreference(e.target.checked)}
                    sx={{ '&.Mui-checked': { color: '#8b5cf6' } }}
                  />
                }
                label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Save column selection for next time</Typography>}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setExportColumnsDialogOpen(false)} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={exportSelectedColumns.length === 0}
              onClick={() => {
                if (exportSavePreference) {
                  localStorage.setItem('qcMultiEntryExportColumns', JSON.stringify(exportSelectedColumns));
                } else {
                  localStorage.removeItem('qcMultiEntryExportColumns');
                }
                setExportColumnsDialogOpen(false);
                exportMultiEntryToExcel(exportSelectedColumns);
              }}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' },
              }}
            >
              Export ({exportSelectedColumns.length} columns)
            </Button>
          </DialogActions>
        </Dialog>

        {/* WSN Overwrite Warning Dialog */}
        < WSNOverwriteDialog
          data={wsnOverwriteDialog}
          onCancel={handleOverwriteCancel}
          onReplace={handleOverwriteReplace}
          onAddToNextRow={handleOverwriteAddToNextRow}
          container={isFullscreen ? multiEntryContainerRef.current : undefined}
        />

        {/* ================= QC LIST OPTIONS PANEL DRAWER ================= */}
        <Drawer
          anchor="right"
          open={qcOptionsPanelOpen}
          onClose={() => setQcOptionsPanelOpen(false)}
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
            <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Options</Typography>
            <IconButton size="small" onClick={() => setQcOptionsPanelOpen(false)} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Panel Content with Accordions */}
          <Box sx={{ overflow: 'auto', flex: 1 }}>

            {/* ----------- FILTERS ACCORDION ----------- */}
            <Accordion
              expanded={qcSettingsPanelExpanded === 'filters'}
              onChange={(_, isExpanded) => setQcSettingsPanelExpanded(isExpanded ? 'filters' : false)}
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
                      value={dateFromFilter || ''}
                      onChange={(e) => { setDateFromFilter(e.target.value); setPage(1); }}
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
                      value={dateToFilter || ''}
                      onChange={(e) => { setDateToFilter(e.target.value); setPage(1); }}
                      fullWidth
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          height: 40,
                          bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                        }
                      }}
                    />
                  </Box>

                  {/* Grade Filter */}
                  <FormControl size="small" fullWidth>
                    <InputLabel>Grade</InputLabel>
                    <Select
                      value={gradeFilter}
                      label="Grade"
                      onChange={(e) => { setGradeFilter(e.target.value); setPage(1); }}
                      sx={{ height: 40, bgcolor: isDarkMode ? '#0f172a' : '#f8fafc' }}
                    >
                      <MenuItem value="">All Grades</MenuItem>
                      {QC_GRADES.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </Select>
                  </FormControl>

                  {/* Brand Filter */}
                  <FormControl size="small" fullWidth>
                    <InputLabel>Brand</InputLabel>
                    <Select
                      value={brandFilter}
                      label="Brand"
                      onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                      sx={{ height: 40, bgcolor: isDarkMode ? '#0f172a' : '#f8fafc' }}
                    >
                      <MenuItem value="">All Brands</MenuItem>
                      {brands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                    </Select>
                  </FormControl>

                  {/* Category Filter */}
                  <FormControl size="small" fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={categoryFilter}
                      label="Category"
                      onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                      sx={{ height: 40, bgcolor: isDarkMode ? '#0f172a' : '#f8fafc' }}
                    >
                      <MenuItem value="">All Categories</MenuItem>
                      {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* ----------- COLUMNS ACCORDION ----------- */}
            {canSeeButton('list:columns') && (
              <Accordion
                expanded={qcSettingsPanelExpanded === 'columns'}
                onChange={(_, isExpanded) => setQcSettingsPanelExpanded(isExpanded ? 'columns' : false)}
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
                        {listColumns.filter(c => c.visible).length} of {ALL_LIST_COLUMNS.length} visible
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
                                checked={listColumns.find(c => c.key === col)?.visible || false}
                                onChange={() => handleListColumnToggle(col)}
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

            {/* ----------- GRID SETTINGS ACCORDION ----------- */}
            <Accordion
              expanded={qcSettingsPanelExpanded === 'grid'}
              onChange={(_, isExpanded) => setQcSettingsPanelExpanded(isExpanded ? 'grid' : false)}
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
                        onChange={(e) => setEnableSorting(e.target.checked)}
                        sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                      />
                    }
                    label={
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>↕ Enable Sorting</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Click headers to sort</Typography>
                      </Box>
                    }
                  />
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
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>Enable Filtering</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Filter in column headers</Typography>
                      </Box>
                    }
                  />
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
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>Column Resize</Typography>
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
                      toast.success('Grid settings reset');
                    }}
                    sx={{ alignSelf: 'flex-start', fontSize: '0.75rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}
                  >Reset to Default
                  </Button>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* ----------- ACTIONS SECTION ----------- */}
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
                          setExportStartDate(dateFromFilter);
                          setExportEndDate(dateToFilter);
                          setExportGrade(gradeFilter);
                          setExportBrand(brandFilter);
                          setExportDialogOpen(true);
                          setQcOptionsPanelOpen(false);
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
                    loadQCList({ buttonRefresh: true });
                    setQcOptionsPanelOpen(false);
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
                      setListLoading(true);
                      setSearchFilter('');
                      setStatusFilter('');
                      setGradeFilter('');
                      setBrandFilter('');
                      setCategoryFilter('');
                      setDateFromFilter('');
                      setDateToFilter('');
                      setPage(1);
                      setQcOptionsPanelOpen(false);
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

      </Box >
    </AppLayout >
  );
}

