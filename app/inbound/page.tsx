// File Path = warehouse-frontend\app\inbound\page.tsx
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Stack, Tab, Tabs,
  CircularProgress, Alert, Card, CardContent, LinearProgress, Divider,
  Select, FormControl, InputLabel, InputAdornment, Checkbox, FormControlLabel,
  Collapse, IconButton, AppBar, Toolbar, useMediaQuery, useTheme, Switch, Pagination, InputBase, Fade
} from '@mui/material';

import {
  Add as AddIcon, Download as DownloadIcon, Upload as UploadIcon,
  Settings as SettingsIcon, CheckCircleOutline as CheckIcon, Info as InfoIcon,
  Delete as DeleteIcon, Refresh as RefreshIcon,
  CheckCircle,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterListIcon,
  Close as CloseIcon,
  Tune as TuneIcon, KeyboardArrowLeft, KeyboardArrowRight, FirstPage, LastPage, AccessTime
} from '@mui/icons-material';

import { inboundAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import { StandardPageHeader, StandardTabs, BatchManagementTab } from '@/components';
import { useTableRowHeight } from '@/app/context/AppearanceContext';
import toast, { Toaster } from 'react-hot-toast';
// ⚡ OPTIMIZED: XLSX loaded dynamically on export to reduce bundle size
// import * as XLSX from 'xlsx'; // Removed - loaded dynamically when needed
import Tooltip from '@mui/material/Tooltip';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { printLabel, isAgentRunning } from '@/lib/printAgent';


// Constants
const DEFAULT_MULTI_COLUMNS = [
  'wsn',
  'product_serial_number',
  'rack_no',
  'unload_remarks',
  'product_title',
  'brand',
  'cms_vertical',
  'fsp',
  'mrp',
  'fkqc_remark',
  'fk_grade',
];

const DEFault_LIST_COLUMNS = [
  'inbound_date',
  'vehicle_no',
  'rack_no',
  'product_serial_number',
  'unload_remarks',
  'wsn',
  'wid',
  'fsn',
  'product_title',
  'brand',
  'cms_vertical',
  'fsp',
  'mrp',
  'quantity',
  'fkqc_remark',
];

const ALL_MASTER_COLUMNS = [
  'wid', 'fsn', 'order_id', 'product_title', 'brand',
  'mrp', 'fsp', 'hsn_sac', 'igst_rate', 'cms_vertical',
  'fkt_link', 'p_type', 'p_size', 'vrp', 'yield_value', 'fk_grade', 'fkqc_remark'
];

const INBOUND_LIST_COLUMNS = [
  'inbound_date',
  'vehicle_no',
  'rack_no',
  'product_serial_number',
  'unload_remarks',
  'wsn',
  'wid',
  'fsn',
  'product_title',
  'brand',
  'cms_vertical',
  'fsp',
  'mrp',
  'quantity',
  'fkqc_remark',
];

const EDITABLE_COLUMNS = ['wsn', 'product_serial_number', 'rack_no', 'unload_remarks'];

import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import React from 'react';
import localforage from 'localforage';
import { useInboundPermissions } from '@/hooks/usePagePermissions';
import BulkUploadCard from '@/components/BulkUploadCard';
import {
  getMasterDataByWSN as getLocalMasterData,
  prewarmCache,
  getCacheStats,
  getBatchList,
  cacheBatchData,
  isWSNInCachedBatches,
  getBatchCacheStats,
  BatchInfo
} from '@/lib/masterDataCache';

// Register AG Grid modules ONCE
ModuleRegistry.registerModules([AllCommunityModule]);

// Tab definitions with permission codes
const ALL_TABS = ['Inbound List', 'Single Entry', 'Bulk Upload', 'Multi Entry', 'Batch Management'];
const TAB_CODES = ['list', 'single', 'bulk', 'multi', 'batches'];

export default function InboundPage() {

  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);

  // Get table row height from appearance settings
  const tableRowHeight = useTableRowHeight();

  // Permission hook
  const { filterTabs, canSeeTab, canSeeButton, canAccessButton, isAdmin, isLoading: permLoading } = useInboundPermissions();

  // Get visible tabs based on permissions
  const visibleTabs = useMemo(() => filterTabs(ALL_TABS, TAB_CODES), [filterTabs]);
  const visibleTabCodes = useMemo(() => {
    if (isAdmin) return TAB_CODES;
    return TAB_CODES.filter((code) => canSeeTab(code));
  }, [canSeeTab, isAdmin]);

  const [tabValue, setTabValue] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<any>(null);
  const columnApiRef = useRef<any>(null);
  const hasAutoFittedRef = useRef(false); // Track if auto-fit has been done
  const lastKeyDownRef = useRef<any>(null);
  const isAutoScrollingRef = useRef<boolean>(false);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Scanner mode detection (for rapid barcode scanner inputs)
  const scanCountRef = useRef<number>(0);
  const lastScanTsRef = useRef<number | null>(null);
  const scanModeTimeoutRef = useRef<number | null>(null);
  const scanningModeRef = useRef<boolean>(false);
  // Track a desired row index to keep visible during scanning sessions
  const desiredRowIndexRef = useRef<number | null>(null);
  // Track user manual scroll to avoid overriding it
  const userScrolledRef = useRef<boolean>(false);
  const userScrollTimeoutRef = useRef<number | null>(null);
  const lastGridScrollTopRef = useRef<number>(0);
  const [agentReady, setAgentReady] = useState(false);

  // ====== PRINT TOGGLE STATE ======
  const [singlePrintEnabled, setSinglePrintEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('inbound_singlePrintEnabled');
      return saved !== 'false'; // Default to true
    }
    return true;
  });
  const [multiPrintEnabled, setMultiPrintEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('inbound_multiPrintEnabled');
      return saved !== 'false'; // Default to true
    }
    return true;
  });

  // ====== CTRL+P REPRINT SHORTCUT STATE ======
  const [ctrlPPrintEnabled, setCtrlPPrintEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('inbound_ctrlPPrintEnabled');
      return saved !== 'false'; // Default to true
    }
    return true;
  });

  // ====== CTRL+O PRODUCT LINK SHORTCUT STATE ======
  const [ctrlOProductLinkEnabled, setCtrlOProductLinkEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('inbound_ctrlOProductLinkEnabled');
      return saved !== 'false'; // Default to true
    }
    return true;
  });

  // Track last scanned row data for Ctrl+P reprint
  const lastScannedRowRef = useRef<any>(null);

  //state variables for responsive UI
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDarkMode = theme.palette.mode === 'dark';

  // Keep filters collapsed by default for a cleaner list view
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  // Mobile full-screen Actions dialog (filters + actions)
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);


  // ====== SINGLE ENTRY STATE ======
  const [singleWSN, setSingleWSN] = useState('');
  const [masterData, setMasterData] = useState<any>(null);
  const [singleForm, setSingleForm] = useState({
    inbound_date: new Date().toISOString().split('T')[0],
    vehicle_no: '',
    product_serial_number: '',
    rack_no: '',
    unload_remarks: ''
  });
  const [singleLoading, setSingleLoading] = useState(false);
  const [duplicateWSN, setDuplicateWSN] = useState<any>(null);
  const [racks, setRacks] = useState<any[]>([]);

  // ====== MULTI ENTRY STATE ======
  // ⚡ PERFORMANCE: Track unique row ID counter for efficient AG Grid updates
  const rowIdCounterRef = useRef(0);

  const generateEmptyRows = (count: number) => {
    return Array.from({ length: count }, () => {
      rowIdCounterRef.current += 1;
      return {
        _rowId: `row_${rowIdCounterRef.current}_${Date.now()}`, // ⚡ Unique row ID for AG Grid
        wsn: '',
        inbound_date: new Date().toISOString().split('T')[0],
        vehicle_no: '',
        product_serial_number: '',
        rack_no: '',
        unload_remarks: ''
      };
    });
  };

  const [multiRows, setMultiRows] = useState<any[]>(generateEmptyRows(500));
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiResults, setMultiResults] = useState<any[]>([]);
  const [duplicateWSNs, setDuplicateWSNs] = useState<Set<string>>(new Set());

  // ====== EXCEL-LIKE ENHANCEMENTS ======
  // Row highlighting for newly added/scanned rows
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(new Set());
  const highlightTimeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // Undo/Redo history for Excel-like behavior - CELL-LEVEL like Excel
  interface UndoAction {
    type: 'cell' | 'paste' | 'fillDown';
    rowIndex: number;
    field: string;
    oldValue: any;
    newValue: any;
    // For WSN changes that trigger master data clear/fetch
    oldRowData?: any;
    newRowData?: any;
  }
  const undoStackRef = useRef<UndoAction[]>([]);
  const redoStackRef = useRef<UndoAction[]>([]);
  const multiRowsRef = useRef<any[]>([]); // Track multiRows synchronously for undo
  const MAX_UNDO_HISTORY = 100;

  // WSN fetch tracking to prevent race conditions
  const wsnFetchMapRef = useRef<Map<number, string>>(new Map());

  // ---- Draft / Autosave (IndexedDB via localForage) ----
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftExists, setDraftExists] = useState(false);
  const lastChangeAtRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ---- Receiving WSNs Sync (for master data "Receiving" status) ----
  const receivingSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedWSNsRef = useRef<string>(''); // JSON string for comparison

  const [crossWarehouseWSNs, setCrossWarehouseWSNs] = useState<Set<string>>(new Set());
  const [gridDuplicateWSNs, setGridDuplicateWSNs] = useState<Set<string>>(new Set());

  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_MULTI_COLUMNS);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [commonDate, setCommonDate] = useState(new Date().toISOString().split('T')[0]);
  const [commonVehicle, setCommonVehicle] = useState('');
  const [multiErrorMessage, setMultiErrorMessage] = useState('');
  const [scrollTop, setScrollTop] = useState(0);

  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [filteredBrands, setFilteredBrands] = useState<string[]>([]);

  // ====== INBOUND LIST STATE ======
  const [listData, setListData] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  // Local refresh button state (non-blocking)
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [total, setTotal] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const listLoadDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const currentLoadIdRef = useRef(0);
  const listAbortControllerRef = useRef<AbortController | null>(null);
  const [topLoading, setTopLoading] = useState(false);
  // Overlay delay/visibility helpers to avoid flicker
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const overlayShownRef = useRef(false);
  const overlayStartRef = useRef<number | null>(null);
  const SHOW_OVERLAY_DELAY = 150; // ms - show overlay only if load lasts longer than this
  const [searchPending, setSearchPending] = useState(false);

  // Minimum time (ms) to show loading overlay to avoid flicker
  const MIN_LOADING_MS = 350;
  // Search debounce delay for smooth performance
  const SEARCH_DEBOUNCE_MS = 300;

  // ⚡ PAGE CACHE: Store fetched pages for instant back navigation
  const pageCacheRef = useRef<Map<string, { data: any[], total: number, timestamp: number }>>(new Map());
  const PAGE_CACHE_TTL = 60000; // 1 minute cache validity

  // ⚡ LAST REFRESH TIME: Track when data was last fetched
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // ⚡ AUTO-RETRY: Track retry attempts
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  // ⚡ LAZY LOADING: Defer filter options loading
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Whether any filter is active (used to show green dot on Filters button)
  const filtersActive = Boolean(
    (searchFilter && searchFilter.trim() !== '') ||
    (brandFilter && brandFilter !== '') ||
    (categoryFilter && categoryFilter !== '') ||
    (dateFromFilter && dateFromFilter !== '') ||
    (dateToFilter && dateToFilter !== '')
  );
  const [listColumns, setListColumns] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('inboundListColumns');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.log('Column settings load error');
        }
      }
    }
    return [
      'wsn',
      'product_title',
      'brand',
      'inbound_date',
      'vehicle_no',
      'rack_no',
      'quantity',
      'batch_id',
      'product_serial_number',
      'unload_remarks'
    ];
  });


  const [listColumnSettingsOpen, setListColumnSettingsOpen] = useState(false);

  // ====== BATCH MANAGEMENT STATE ======
  const [batches, setBatches] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // ====== EXPORT STATE ======
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportBatchIds, setExportBatchIds] = useState<string[]>([]);
  const [existingInboundWSNs, setExistingInboundWSNs] = useState(new Set());

  // Grid settings with localStorage
  const [gridSettings, setGridSettings] = useState({
    sortable: true,
    filter: true,
    resizable: true,
    editable: true,
  });

  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);

  // ====== MULTI ENTRY GRID SETTINGS (SEPARATE) ======
  const [multiGridSettings, setMultiGridSettings] = useState({
    sortable: true,
    filter: true,
    resizable: true,
    editable: true,
  });
  const [multiGridSettingsOpen, setMultiGridSettingsOpen] = useState(false);

  // ✅ LOAD Grid Settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('qc_grid_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setGridSettings(parsed);
        console.log('✅ Grid settings loaded:', parsed);
      } catch (e) {
        console.log('Failed to parse grid settings');
      }
    }
    // Load Multi Entry grid settings
    const savedMultiSettings = localStorage.getItem('inbound_multi_grid_settings');
    if (savedMultiSettings) {
      try {
        const parsed = JSON.parse(savedMultiSettings);
        setMultiGridSettings(parsed);
        console.log('✅ Multi Entry Grid settings loaded:', parsed);
      } catch (e) {
        console.log('Failed to parse multi grid settings');
      }
    }
  }, []);

  // ✅ SAVE to localStorage whenever settings change
  const updateGridSettings = (newSettings: typeof gridSettings) => {
    setGridSettings(newSettings);
    localStorage.setItem('qc_grid_settings', JSON.stringify(newSettings));
    console.log('💾 Grid settings saved:', newSettings);
  };

  // ✅ SAVE Multi Entry grid settings
  const updateMultiGridSettings = (newSettings: typeof multiGridSettings) => {
    setMultiGridSettings(newSettings);
    localStorage.setItem('inbound_multi_grid_settings', JSON.stringify(newSettings));
    console.log('💾 Multi Entry Grid settings saved:', newSettings);
  };

  // ====== MASTER DATA CACHE STATE ======
  const [cacheStats, setCacheStats] = useState<{ totalRecords: number; isReady: boolean } | null>(null);
  const [cacheLoading, setCacheLoading] = useState(false);

  // ====== BATCH-SPECIFIC CACHING STATE ======
  const [availableBatches, setAvailableBatches] = useState<BatchInfo[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [batchCacheLoading, setBatchCacheLoading] = useState(false);
  const [batchCacheProgress, setBatchCacheProgress] = useState<{ loaded: number; total: number; message: string } | null>(null);
  const [batchSelectorOpen, setBatchSelectorOpen] = useState(false);
  // Confirmation dialog for WSN not in batch
  const [wsnNotInBatchDialog, setWsnNotInBatchDialog] = useState<{
    open: boolean;
    wsn: string;
    rowIndex: number;
    masterData: any;
  } | null>(null);

  // Load available batches on mount
  useEffect(() => {
    const loadBatches = async () => {
      try {
        const batches = await getBatchList();
        setAvailableBatches(batches);
        console.log(`📦 Loaded ${batches.length} available batches`);
      } catch (error) {
        console.error('Failed to load batch list:', error);
      }
    };
    loadBatches();
  }, []);

  // Restore selected batches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('inbound_selected_batches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedBatchIds(parsed);
        }
      }
    } catch (e) { /* ignore */ }
  }, []);

  // Auto-load batch cache when batches are selected
  useEffect(() => {
    if (selectedBatchIds.length > 0) {
      localStorage.setItem('inbound_selected_batches', JSON.stringify(selectedBatchIds));

      // Cache the selected batches
      const loadBatchCache = async () => {
        setBatchCacheLoading(true);
        setBatchCacheProgress({ loaded: 0, total: 1, message: 'Loading batch data...' });

        try {
          const result = await cacheBatchData(selectedBatchIds, true, (loaded, total, message) => {
            setBatchCacheProgress({ loaded, total, message });
          });

          if (result.success) {
            setCacheStats({ totalRecords: result.count, isReady: true });
            toast.success(`✅ Cached ${result.count.toLocaleString()} products from ${selectedBatchIds.length} batch(es)`);
          } else {
            toast.error('Failed to cache batch data');
          }
        } catch (error) {
          console.error('Batch cache error:', error);
          toast.error('Failed to cache batch data');
        } finally {
          setBatchCacheLoading(false);
          setBatchCacheProgress(null);
        }
      };

      loadBatchCache();
    } else {
      // Clear cache stats when no batches selected
      localStorage.removeItem('inbound_selected_batches');
    }
  }, [selectedBatchIds]);

  // Prewarm cache on mount (ONLY if no batch mode)
  useEffect(() => {
    // Skip full cache prewarm if batch mode is being used
    if (selectedBatchIds.length > 0) return;

    const initCache = async () => {
      try {
        setCacheLoading(true);
        // Start prewarming in background
        prewarmCache();

        // Get initial stats
        const stats = await getCacheStats();
        setCacheStats({ totalRecords: stats.totalRecords, isReady: stats.isReady });

        if (stats.isReady) {
          console.log(`✅ Master data cache ready: ${stats.totalRecords} records`);
        }
      } catch (error) {
        console.error('Cache init error:', error);
      } finally {
        setCacheLoading(false);
      }
    };

    initCache();

    // Refresh cache stats periodically
    const interval = setInterval(async () => {
      try {
        const stats = await getCacheStats();
        setCacheStats({ totalRecords: stats.totalRecords, isReady: stats.isReady });
      } catch (e) { /* ignore */ }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [selectedBatchIds.length]);

  useEffect(() => {
    async function fetchExistingWSNs() {
      try {
        const res = await inboundAPI.getAllInboundWSNs();
        setExistingInboundWSNs(new Set(res.data));
      } catch (error) {
        console.error('Failed to fetch existing inbound WSNs', error);
      }
    }
    fetchExistingWSNs();
  }, []);

  // ====== AUTH CHECK ======
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(storedUser);
  }, [router]);

  // ====== VEHICLE PERSISTENCE ======
  useEffect(() => {
    // Load multi entry vehicle number (persists until submit)
    const savedMultiVehicle = localStorage.getItem('inbound_multiVehicleNumber');
    if (savedMultiVehicle) {
      setCommonVehicle(savedMultiVehicle);
    }
    // Load single entry vehicle number
    const savedVehicle = localStorage.getItem('lastVehicleNumber');
    if (savedVehicle) {
      setSingleForm(prev => ({ ...prev, vehicle_no: savedVehicle }));
    }
  }, []);

  const saveVehicleNumber = (vehicle: string) => {
    if (vehicle.trim()) {
      localStorage.setItem('lastVehicleNumber', vehicle);
    }
  };

  // ====== SAVE MULTI VEHICLE NUMBER ON BLUR (not on every keystroke) ======
  const saveMultiVehicleNumber = () => {
    if (commonVehicle.trim()) {
      localStorage.setItem('inbound_multiVehicleNumber', commonVehicle);
    }
  };

  // ====== MULTI ENTRY COLUMN WIDTHS PERSISTENCE ======
  const [multiColumnWidths, setMultiColumnWidths] = useState<Record<string, number>>({});

  // ====== LOAD COLUMN SETTINGS FROM LOCALSTORAGE ======
  useEffect(() => {
    const saved = localStorage.getItem('multiEntryColumns');

    if (saved) {
      try {
        const cols = JSON.parse(saved);
        setVisibleColumns(cols);
      } catch (e) {
        console.log('Column settings load error');
      }
    } else {
      setVisibleColumns(DEFAULT_MULTI_COLUMNS);
    }

    // Load saved column widths
    const savedWidths = localStorage.getItem('multiEntryColumnWidths');
    if (savedWidths) {
      try {
        const widths = JSON.parse(savedWidths);
        setMultiColumnWidths(widths);
        console.log('✅ Multi Entry column widths loaded:', widths);
      } catch (e) {
        console.log('Column widths load error');
      }
    }
  }, []);

  // ------------------ Draft helpers & autosave ------------------
  const getDraftKey = () => {
    if (!activeWarehouse?.id || !user?.id) return null;
    return `inboundMultiDraft_${activeWarehouse.id}_${user.id}`;
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
      console.error('Failed to save draft', err);
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
      // Also clear vehicle number
      setCommonVehicle('');
      localStorage.removeItem('inbound_multiVehicleNumber');
      toast.success('Draft cleared');
    } catch (err) {
      console.error('Failed to clear draft', err);
    }
  };

  // ---- Sync receiving WSNs to server (for master data "Receiving" status) ----
  const syncReceivingWSNs = async (rowsToSync = multiRows) => {
    if (!activeWarehouse?.id) return;

    // Extract valid WSNs from rows
    const wsns = rowsToSync
      .map((r: any) => r.wsn?.trim()?.toUpperCase())
      .filter((w: string) => w && w.length > 0);

    // Create a hash to compare with last synced
    const wsnsHash = JSON.stringify(wsns.sort());

    // Skip if no change
    if (wsnsHash === lastSyncedWSNsRef.current) return;

    // Skip API call if no valid WSNs (just update ref to avoid re-calling)
    if (wsns.length === 0) {
      lastSyncedWSNsRef.current = wsnsHash;
      return;
    }

    try {
      await inboundAPI.syncReceivingWSNs(wsns, activeWarehouse.id);
      lastSyncedWSNsRef.current = wsnsHash;
      console.log('📡 Synced receiving WSNs:', wsns.length);
    } catch (err) {
      console.error('Failed to sync receiving WSNs', err);
    }
  };

  const clearReceivingWSNs = async () => {
    if (!activeWarehouse?.id) return;
    try {
      await inboundAPI.clearReceivingWSNs(activeWarehouse.id);
      lastSyncedWSNsRef.current = '';
      console.log('🧹 Cleared receiving WSNs');
    } catch (err) {
      console.error('Failed to clear receiving WSNs', err);
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
          // Apply defaults for missing fields and ensure _rowId exists
          const restored = draft.rows.map((r: any, index: number) => {
            // ⚡ PERFORMANCE: Ensure each row has a unique _rowId
            const rowId = r._rowId || `restored_${index}_${Date.now()}`;
            rowIdCounterRef.current = Math.max(rowIdCounterRef.current, index + 1);
            return {
              _rowId: rowId,
              inbound_date: r.inbound_date || commonDate,
              vehicle_no: r.vehicle_no || commonVehicle,
              ...r,
            };
          });
          setMultiRows(restored);
          setDraftSavedAt(draft.savedAt || Date.now());
          setDraftExists(true);
          //toast.success('✓ Draft restored');
        }
      } catch (err) {
        console.error('Failed to load draft', err);
      }
    };
    load();
    return () => { mounted = false; };
  }, [activeWarehouse?.id, user?.id]);

  // Autosave (debounced) whenever multiRows change
  useEffect(() => {
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

  // Sync receiving WSNs to server (debounced) for master data "Receiving" status
  useEffect(() => {
    // Skip if no warehouse selected
    if (!activeWarehouse?.id) return;

    // Skip initial sync when rows are empty (avoid unnecessary API calls)
    const hasAnyWSN = multiRows.some(r => r.wsn?.trim());
    if (!hasAnyWSN) return;

    // Debounce sync (longer interval than draft save)
    if (receivingSyncTimeoutRef.current) clearTimeout(receivingSyncTimeoutRef.current);
    receivingSyncTimeoutRef.current = setTimeout(() => {
      syncReceivingWSNs(multiRows);
    }, 1000); // 1 second debounce

    return () => {
      if (receivingSyncTimeoutRef.current) clearTimeout(receivingSyncTimeoutRef.current);
    };
  }, [multiRows, activeWarehouse?.id]);

  // Clear receiving WSNs on page unload
  useEffect(() => {
    const onUnload = () => {
      // Use sendBeacon for reliable unload sync
      if (activeWarehouse?.id && navigator.sendBeacon) {
        const url = `${process.env.NEXT_PUBLIC_API_URL}/api/inbound/receiving-wsns/clear`;
        const data = JSON.stringify({ warehouse_id: activeWarehouse.id });
        navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
      }
    };
    window.addEventListener('unload', onUnload);
    return () => window.removeEventListener('unload', onUnload);
  }, [activeWarehouse?.id]);

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

  // Add this useEffect after loadCategories function (around line 450)
  useEffect(() => {
    if (currentTabCode !== 'multi') return;
    const t = setTimeout(() => {
      try {
        const colApi = columnApiRef.current;
        const api = gridRef.current;
        if (!colApi || !api) return;
        const allCols = colApi.getAllColumns ? colApi.getAllColumns().map((c: any) => c.getColId()) : [];
        if (!allCols || allCols.length === 0) return;
        colApi.autoSizeColumns(allCols, false);
        let total = 0;
        for (const id of allCols) {
          const col = colApi.getColumn(id);
          total += col?.getActualWidth ? col.getActualWidth() : 0;
        }
        const dims = api.getSize ? api.getSize() : (api.gridPanel && api.gridPanel.getBodyClientRect && api.gridPanel.getBodyClientRect());
        const gridW = dims?.width || 0;
        if (gridW && total < gridW) api.sizeColumnsToFit();
      } catch (e) { /* ignore */ }
    }, 50);
    return () => clearTimeout(t);
  }, [tabValue, visibleColumns, multiRows]);

  useEffect(() => {
    if (brandFilter) {
      // Filter categories based on selected brand
      const filtered = listData
        .filter(item => item.brand === brandFilter)
        .map(item => item.cms_vertical)
        .filter((v, i, a) => v && a.indexOf(v) === i); // unique values
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories(categories);
    }
  }, [brandFilter, listData, categories]);

  useEffect(() => {
    if (categoryFilter) {
      // Filter brands based on selected category
      const filtered = listData
        .filter(item => item.cms_vertical === categoryFilter)
        .map(item => item.brand)
        .filter((v, i, a) => v && a.indexOf(v) === i); // unique values
      setFilteredBrands(filtered);
    } else {
      setFilteredBrands(brands);
    }
  }, [categoryFilter, listData, brands]);

  // ====== SAVE PRINT TOGGLE SETTINGS ======
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('inbound_singlePrintEnabled', String(singlePrintEnabled));
    }
  }, [singlePrintEnabled]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('inbound_multiPrintEnabled', String(multiPrintEnabled));
    }
  }, [multiPrintEnabled]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('inbound_ctrlPPrintEnabled', String(ctrlPPrintEnabled));
    }
  }, [ctrlPPrintEnabled]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('inbound_ctrlOProductLinkEnabled', String(ctrlOProductLinkEnabled));
    }
  }, [ctrlOProductLinkEnabled]);

  // ====== KEEP multiRowsRef IN SYNC WITH multiRows STATE ======
  useEffect(() => {
    multiRowsRef.current = multiRows;
  }, [multiRows]);

  // ====== PRINT AGENT CHECK ======
  useEffect(() => {
    const checkAgent = async () => {
      const running = await isAgentRunning();
      setAgentReady(running);
      if (running) {
        console.log('✅ Print Agent is ready');
      } else {
        console.warn('⚠️ Print Agent not detected - printing will not work');
      }
    };

    checkAgent();

    // Check every 10 seconds if agent status changes
    const interval = setInterval(checkAgent, 10000);
    return () => clearInterval(interval);
  }, []);

  // NOTE: Intentionally do NOT auto-expand filters on screen size change.
  // Filters will remain collapsed by default and open only when the user toggles them.


  // ✅ ISSUE #1, #3 - SAVE COLUMN SETTINGS
  const saveColumnSettings = (cols: string[]) => {
    setVisibleColumns(cols);
    localStorage.setItem('multiEntryColumns', JSON.stringify(cols));
    //toast.success('✓ Columns saved');
  };

  const saveListColumnSettings = (cols: string[]) => {
    setListColumns(cols);
    localStorage.setItem('inboundListColumns', JSON.stringify(cols));
    //toast.success('✓ List columns saved');
  };

  // Date formatter (stable) — moved before column defs to avoid "used before declaration" errors
  const formatInboundDate = useCallback((dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';

    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = months[d.getMonth()];
    const yy = String(d.getFullYear()).slice(-2);
    return `${day}-${mon}-${yy}`;   // 01-Dec-25
  }, []);

  // -------- AG Grid helpers for Inbound List (keeps behavior same as table) --------
  const inboundColumnDefs = useMemo(() => {
    const srCol = {
      headerName: 'SR.NO',
      field: '__sr',
      valueGetter: (params: any) => (params.node ? (page - 1) * limit + params.node.rowIndex + 1 : undefined),
      width: 80,
      cellStyle: { fontWeight: 700, textAlign: 'center', color: isDarkMode ? '#94a3b8' : '#64748b' },
      suppressMovable: true,
      sortable: false,
      filter: false,
    };

    const cols = listColumns.map((col: string) => {
      const isDate = col.includes('date');
      const headerName = col.replace(/_/g, ' ').toUpperCase();
      const base: any = {
        field: col,
        headerName,
        minWidth: col === 'product_title' ? 240 : col === 'brand' ? 140 : 120,
        flex: col === 'product_title' ? 1.5 : 1,
      };
      if (isDate) base.valueFormatter = (params: any) => formatInboundDate(params.value);
      return base;
    });

    return [srCol, ...cols];
  }, [listColumns, formatInboundDate, page, limit]);

  const inboundDefaultColDef = useMemo(() => ({
    sortable: gridSettings.sortable,
    filter: gridSettings.filter,
    resizable: gridSettings.resizable,
    editable: false,
    suppressMovable: true,
    cellStyle: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  }), [gridSettings]);

  // Autosize / overlays when data or loading state changes
  useEffect(() => {
    // We avoid showing the loading overlay directly here to prevent flicker.
    // However, when not loading we still need to show NoRows overlay if appropriate.
    const api = gridRef.current?.api;
    if (!api) return;

    if (!listLoading) {
      if (!listData || listData.length === 0) api.showNoRowsOverlay();
      else api.hideOverlay();
    }
  }, [listLoading, listData]);

  useEffect(() => {
    if (currentTabCode !== 'list') return;
    const colApi = columnApiRef.current;
    if (!colApi) return;

    setTimeout(() => {
      try {
        const allCols = colApi.getAllColumns().map((c: any) => c.getId());
        colApi.autoSizeColumns(allCols, false);
      } catch (err) {
        gridRef.current?.api?.sizeColumnsToFit();
      }
    }, 80);
  }, [tabValue, listColumns, listData.length]);

  // ====== INBOUND LIST & helper loaders ======
  // ⚡ HELPER: Generate cache key for current filters
  const getCacheKey = useCallback(() => {
    return JSON.stringify({
      warehouseId: activeWarehouse?.id,
      page,
      limit,
      search: searchFilter,
      brand: brandFilter,
      category: categoryFilter,
      dateFrom: dateFromFilter,
      dateTo: dateToFilter,
    });
  }, [activeWarehouse?.id, page, limit, searchFilter, brandFilter, categoryFilter, dateFromFilter, dateToFilter]);

  // ⚡ PREFETCH: Prefetch next page in background
  const prefetchNextPage = useCallback(async () => {
    const totalPages = Math.ceil(total / limit);
    if (page >= totalPages) return;

    const nextPageCacheKey = JSON.stringify({
      warehouseId: activeWarehouse?.id,
      page: page + 1,
      limit,
      search: searchFilter,
      brand: brandFilter,
      category: categoryFilter,
      dateFrom: dateFromFilter,
      dateTo: dateToFilter,
    });

    const cached = pageCacheRef.current.get(nextPageCacheKey);
    if (cached && Date.now() - cached.timestamp < PAGE_CACHE_TTL) return;

    try {
      const response = await inboundAPI.getAll(page + 1, limit, {
        warehouseId: activeWarehouse?.id,
        search: searchFilter,
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
  }, [activeWarehouse?.id, page, limit, total, searchFilter, brandFilter, categoryFilter, dateFromFilter, dateToFilter]);

  const loadInboundList = useCallback(async ({ buttonRefresh = false } = {}) => {
    const t0 = Date.now();

    // Mark this request id so we can ignore stale responses
    currentLoadIdRef.current += 1;
    const loadId = currentLoadIdRef.current;

    const cacheKey = getCacheKey();

    // ⚡ PAGE CACHE: Check cache first (unless force refresh)
    if (!buttonRefresh) {
      const cached = pageCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PAGE_CACHE_TTL) {
        setListData(cached.data);
        setTotal(cached.total);
        setLastRefreshTime(new Date(cached.timestamp));
        setListLoading(false);
        setTimeout(() => prefetchNextPage(), 100);
        return;
      }
    }

    if (buttonRefresh) {
      setRefreshing(true);
      setRefreshSuccess(false);
    } else {
      setListLoading(true);
      // Start a delayed overlay timer to avoid flicker for fast responses
      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current);
        overlayTimerRef.current = null;
      }
      overlayShownRef.current = false;
      overlayStartRef.current = null;
      overlayTimerRef.current = setTimeout(() => {
        try {
          setTopLoading(true);
          overlayShownRef.current = true;
          overlayStartRef.current = Date.now();
        } catch (err) { }
        overlayTimerRef.current = null;
      }, SHOW_OVERLAY_DELAY);
    }

    try {
      // Cancel previous in-flight load to avoid out-of-order responses and flicker
      if (listAbortControllerRef.current) {
        try { listAbortControllerRef.current.abort(); } catch (err) { }
        listAbortControllerRef.current = null;
      }

      const controller = new AbortController();
      listAbortControllerRef.current = controller;

      const response = await inboundAPI.getAll(page, limit, {
        warehouseId: activeWarehouse?.id,
        search: searchFilter,
        brand: brandFilter,
        category: categoryFilter,
        dateFrom: dateFromFilter,
        dateTo: dateToFilter
      }, { signal: controller.signal });

      // Only apply if this is the latest load
      if (loadId === currentLoadIdRef.current) {
        const rows = response.data.data;
        const totalCount = response.data.total;
        setListData(rows);
        setTotal(totalCount);

        // ⚡ CACHE: Store in cache
        pageCacheRef.current.set(cacheKey, {
          data: rows,
          total: totalCount,
          timestamp: Date.now(),
        });
        setLastRefreshTime(new Date());
        retryCountRef.current = 0; // Reset retry count on success

        // ⚡ PREFETCH: Trigger prefetch of next page
        setTimeout(() => prefetchNextPage(), 100);

        if (buttonRefresh) {
          toast.success('✓ List refreshed');
          setRefreshSuccess(true);
          setTimeout(() => setRefreshSuccess(false), 1800);
        }
      } else {
        // stale response, ignore
        return;
      }
    } catch (error: any) {
      // Ignore aborted requests
      if (error?.code === 'ERR_CANCELED') {
        return;
      }

      // Only show errors for latest request
      if (loadId === currentLoadIdRef.current) {
        console.error('Load error:', error);
        const status = error?.response?.status;
        const msg = error?.response?.data?.error || 'Failed to load list';
        if (status === 401) {
          toast.error('Not authenticated — redirecting to login');
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
          router.push('/login');
        } else {
          // ⚡ AUTO-RETRY: Retry on network errors (max 2 times)
          if (retryCountRef.current < MAX_RETRIES && !buttonRefresh) {
            retryCountRef.current += 1;
            const delay = Math.pow(2, retryCountRef.current) * 500;
            setTimeout(() => loadInboundList({ buttonRefresh: false }), delay);
            return;
          }
          if (buttonRefresh) toast.error(msg);
          else toast.error(msg);
        }
      }
    } finally {
      // Only clear the loading state if this is the last issued request
      if (loadId === currentLoadIdRef.current) {
        // If overlay was shown, ensure it stays visible for MIN_LOADING_MS since it appeared
        if (overlayShownRef.current && overlayStartRef.current) {
          const overlayElapsed = Date.now() - overlayStartRef.current;
          if (overlayElapsed < MIN_LOADING_MS) {
            await new Promise(res => setTimeout(res, MIN_LOADING_MS - overlayElapsed));
          }

          try { setTopLoading(false); } catch (err) { }
          overlayShownRef.current = false;
          overlayStartRef.current = null;
        } else {
          // Overlay never shown, cancel pending timer
          if (overlayTimerRef.current) {
            clearTimeout(overlayTimerRef.current);
            overlayTimerRef.current = null;
          }
        }

        if (buttonRefresh) setRefreshing(false);
        else setListLoading(false);

        // cleanup controller
        listAbortControllerRef.current = null;
      }
    }
  }, [activeWarehouse?.id, page, limit, searchFilter, brandFilter, categoryFilter, dateFromFilter, dateToFilter, router, getCacheKey, prefetchNextPage]);

  const loadBrands = useCallback(async () => {
    try {
      const response = await inboundAPI.getBrands(activeWarehouse?.id);
      setBrands(response.data || []);
    } catch (error) {
      console.log('Brands error');
      setBrands([]);
    }
  }, [activeWarehouse?.id]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await inboundAPI.getCategories(activeWarehouse?.id);
      setCategories(response.data || []);
    } catch (error) {
      console.log('Categories error');
      setCategories([]);
    }
  }, [activeWarehouse?.id]);

  const loadBatches = useCallback(async () => {
    setBatchLoading(true);
    try {
      const response = await inboundAPI.getBatches(activeWarehouse?.id?.toString());
      // Format last_updated date for display (20-Jan-2026 format)
      const formattedBatches = (response.data || []).map((batch: any) => {
        let dateDisplay = '-';
        if (batch.last_updated) {
          try {
            const d = new Date(batch.last_updated);
            if (!isNaN(d.getTime())) {
              const day = String(d.getDate()).padStart(2, '0');
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const mon = months[d.getMonth()];
              const yyyy = d.getFullYear();
              dateDisplay = `${day}-${mon}-${yyyy}`;
            }
          } catch { /* fallback to '-' */ }
        }
        return {
          ...batch,
          lastupdated_display: dateDisplay
        };
      });
      setBatches(formattedBatches);
    } catch (error) {
      console.error('Batches error');
    } finally {
      setBatchLoading(false);
    }
  }, [activeWarehouse?.id]);

  const loadRacks = useCallback(async () => {
    try {
      const response = await inboundAPI.getWarehouseRacks(activeWarehouse?.id);
      setRacks(response.data);
    } catch (error) {
      console.error('Failed to load racks');
    }
  }, [activeWarehouse?.id]);

  // ====== LOAD DATA ON TAB CHANGE ======
  const currentTabCode = visibleTabCodes[tabValue];

  useEffect(() => {
    if (activeWarehouse && (currentTabCode === 'list' || currentTabCode === 'single')) {
      loadRacks();
      loadBatches();
      loadBrands();
      loadCategories();
      if (currentTabCode === 'list') loadInboundList();
    }
  }, [activeWarehouse, currentTabCode, loadRacks, loadBatches, loadBrands, loadCategories, loadInboundList]);

  useEffect(() => {
    if (activeWarehouse && currentTabCode === 'list') {
      // ✅ Reduced debounce (100ms) since search already debounces 350ms
      if (listLoadDebounceRef.current) clearTimeout(listLoadDebounceRef.current);
      listLoadDebounceRef.current = setTimeout(() => {
        loadInboundList();
        listLoadDebounceRef.current = null;
      }, 100);
    }

    return () => {
      if (listLoadDebounceRef.current) {
        clearTimeout(listLoadDebounceRef.current);
        listLoadDebounceRef.current = null;
      }
    };
  }, [activeWarehouse, tabValue, page, limit, searchFilter, brandFilter, categoryFilter, dateFromFilter, dateToFilter, loadInboundList]);



  // ====== GET PRINTING SETTINGS ======
  const getPrintingSettings = async () => {
    try {
      const response = await fetch('http://127.0.0.1:9100/config', {
        method: 'GET',
        mode: 'cors',
      });

      if (response.ok) {
        const data = await response.json();
        return data.config;
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch printing settings');
    }

    return null;
  };

  // ====== PRINTING FUNCTION ======

  const triggerPrint = async (wsn: string, masterData?: any) => {
    if (!agentReady) {
      console.warn('⚠️ Print agent not available');
      return;
    }

    try {
      // Get printing settings from agent
      const settings = await getPrintingSettings();

      // CHECK: Is printing enabled?
      if (settings && !settings.printingEnabled) {
        console.log('⏸️ Printing disabled in settings - skipping print');
        return;
      }

      // Ensure WSN is always uppercase for printing
      const wsnUpper = wsn.toUpperCase();
      console.log(`🖨️ Printing WSN: ${wsnUpper}`);

      // Get copy count from settings (fallback to 1)
      const copies = 1;

      const success = await printLabel({
        wsn: wsnUpper,
        product_title: masterData?.product_title || '',
        brand: masterData?.brand || '',
        mrp: masterData?.mrp || '',
        fsp: masterData?.fsp || '',
        fsn: masterData?.fsn || masterData?.fsn_code || '',
        product_serial_number: masterData?.product_serial_number || '',
        copies: copies,
      });

      if (success) {
        console.log(`✅ Print sent successfully (${copies} copies)`);
      } else {
        console.warn('⚠️ Print failed - but entry was created');
      }
    } catch (err) {
      console.error('❌ Print error:', err);
      // Don't throw - allow entry creation even if print fails
    }
  };

  // ====== PRINT ROW FUNCTION (for manual print button) ======
  const printRowWSN = useCallback(async (rowData: any) => {
    if (!rowData?.wsn?.trim()) {
      toast.error('No WSN to print');
      return;
    }

    if (!agentReady) {
      toast.error('Print agent not available');
      return;
    }

    const wsnUpper = rowData.wsn.trim().toUpperCase();

    try {
      const printPayload = {
        wsn: wsnUpper,
        fsn: rowData.fsn || '',
        product_title: rowData.product_title || '',
        brand: rowData.brand || '',
        mrp: rowData.mrp || '',
        fsp: rowData.fsp || '',
        copies: 1,
      };

      const printSuccess = await printLabel(printPayload);

      if (printSuccess) {
        toast.success(`✓ Label printed: ${wsnUpper}`, { duration: 2000 });
      } else {
        toast.error('Print failed');
      }
    } catch (err: any) {
      toast.error(`Print error: ${err.message}`);
    }
  }, [agentReady]);


  // ====== SINGLE ENTRY FUNCTIONS ======
  // Step 1: Add new ref for auto-fetch debounce (around line 80, with other refs)
  const wsnFetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Step 2: Cleanup timer on unmount (add to existing cleanup useEffect around line 180)
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (wsnFetchTimerRef.current) {
        clearTimeout(wsnFetchTimerRef.current);
        wsnFetchTimerRef.current = null;
      }
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      if (listLoadDebounceRef.current) {
        clearTimeout(listLoadDebounceRef.current);
        listLoadDebounceRef.current = null;
      }
      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current);
        overlayTimerRef.current = null;
      }
      if (listAbortControllerRef.current) {
        try { listAbortControllerRef.current.abort(); } catch (err) { }
        listAbortControllerRef.current = null;
      }
    };
  }, []);

  // Step 3: Replace handleWSNBlur function (around line 350)
  const handleWSNBlur = async () => {
    if (!singleWSN.trim()) {
      setMasterData(null);
      return;
    }

    try {
      const wsnUpper = singleWSN.trim().toUpperCase();
      setSingleLoading(true);
      const response = await inboundAPI.getMasterDataByWSN(wsnUpper);
      setMasterData(response.data);
      setDuplicateWSN(null);
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast.error('WSN not found in master data');
        setMasterData(null);
      } else {
        console.error('Error fetching master data:', error);
      }
    } finally {
      setSingleLoading(false);
    }
  };

  // Step 4: Add auto-fetch function with debounce (add after handleWSNBlur)
  const autoFetchMasterData = async (wsn: string) => {
    if (!wsn || wsn.length < 8) {
      setMasterData(null);
      return;
    }

    try {
      const wsnUpper = wsn.trim().toUpperCase();
      const response = await inboundAPI.getMasterDataByWSN(wsnUpper);
      setMasterData(response.data);
      setDuplicateWSN(null);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Don't show toast for auto-fetch, only on blur
        console.log('WSN not found:', wsn);
        setMasterData(null);
      }
    }
  };

  // ====== SINGLE ENTRY SUBMIT ======
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!singleWSN.trim()) {
      toast.error('WSN is required');
      return;
    }

    setSingleLoading(true);
    try {
      const response = await inboundAPI.createSingle({
        wsn: singleWSN,
        ...singleForm,
        rack_no: singleForm.rack_no || 'Staging', // ✅ Auto-fill Staging
        warehouse_id: activeWarehouse?.id,
        created_by: user?.id
      });

      if (response.data.action === 'created') {
        toast.success('✓ Inbound entry created successfully!');
        saveVehicleNumber(singleForm.vehicle_no);

        // Trigger print if agent is ready AND print is enabled
        if (singlePrintEnabled && agentReady && masterData) {
          await triggerPrint(singleWSN, masterData);
        }

        setSingleWSN('');
      } else if (response.data.action === 'updated') {
        toast.success('✓ Inbound entry updated successfully!');
        saveVehicleNumber(singleForm.vehicle_no);
      }

      setSingleWSN('');
      setMasterData(null);
      setDuplicateWSN(null);
      setSingleForm({
        inbound_date: new Date().toISOString().split('T')[0],
        vehicle_no: singleForm.vehicle_no,
        product_serial_number: '',
        rack_no: '',
        unload_remarks: ''
      });
      loadInboundList();

    } catch (error: any) {
      if (error.response?.status === 409) {
        setDuplicateWSN(error.response.data);
        toast.error('Duplicate WSN - Click "Update" to modify');
      } else if (error.response?.status === 403) {
        toast.error(`❌ ${error.response.data.error}`);
      } else {
        toast.error(error.response?.data?.error || 'Failed to create entry');
      }
    } finally {
      setSingleLoading(false);
    }
  };

  const handleUpdateDuplicate = async () => {
    setSingleLoading(true);
    try {
      await inboundAPI.createSingle({
        wsn: singleWSN,
        ...singleForm,
        warehouse_id: activeWarehouse?.id,
        update_existing: true,
        created_by: user?.id // ✅ ISSUE #8
      });

      toast.success('✓ Updated successfully!');
      setSingleWSN('');
      setMasterData(null);
      setDuplicateWSN(null);
      setSingleForm({
        inbound_date: new Date().toISOString().split('T')[0],
        vehicle_no: singleForm.vehicle_no,
        product_serial_number: '',
        rack_no: '',
        unload_remarks: ''
      });
      loadInboundList();
    } catch (error: any) {
      toast.error('Failed to update');
    } finally {
      setSingleLoading(false);
    }
  };

  // ====== BULK UPLOAD FUNCTIONS ======
  const downloadTemplate = async () => {
    // ⚡ OPTIMIZED: Load XLSX dynamically
    const XLSX = await import('xlsx');

    const template = [{
      'WSN': 'ABC123_A',
      'INBOUND_DATE': new Date().toISOString().split('T')[0],
      'VEHICLE_NO': 'PB04AA1234',
      'PRODUCT_SERIAL_NUMBER': 'ABCDE12345',
      'RACK_NO': 'A-01',
      'UNLOAD_REMARKS': 'Brand Box missing'
    }];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Bulk_Inbound_Template.xlsx');
    toast.success('✓ Template downloaded');
  };

  // ====== MULTI ENTRY FUNCTIONS ======

  // ✅ EXCEL ENHANCEMENT: Highlight newly added row for visual confirmation
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

  // ✅ EXCEL-LIKE: Save cell change for undo (cell-level, not full grid)
  const saveCellUndoAction = useCallback((
    rowIndex: number,
    field: string,
    oldValue: any,
    newValue: any,
    oldRowData?: any,
    newRowData?: any
  ) => {
    // Debug logging
    console.log('💾 SAVE UNDO - Saving action:', {
      rowIndex,
      field,
      oldValue,
      newValue,
      hasOldRowData: !!oldRowData,
      oldRowDataWSN: oldRowData?.wsn,
      oldRowDataTitle: oldRowData?.product_title,
    });

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

    console.log('💾 SAVE UNDO - Stack size:', undoStackRef.current.length);
  }, []);

  // ✅ EXCEL-LIKE: Undo last change (Ctrl+Z) - cell level
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) {
      toast('Nothing to undo', { icon: 'ℹ️', duration: 500 });
      return;
    }

    const action = undoStackRef.current.pop()!;

    // Debug logging
    console.log('🔄 UNDO - Action:', {
      type: action.type,
      rowIndex: action.rowIndex,
      field: action.field,
      oldValue: action.oldValue,
      newValue: action.newValue,
      hasOldRowData: !!action.oldRowData,
      oldRowDataWSN: action.oldRowData?.wsn,
    });

    setMultiRows(currentRows => {
      const newRows = [...currentRows];

      // Capture current row data for redo BEFORE making changes
      const currentRowData = JSON.parse(JSON.stringify(newRows[action.rowIndex]));

      console.log('🔄 UNDO - Before change row', action.rowIndex, ':', {
        wsn: newRows[action.rowIndex]?.wsn,
        product_title: newRows[action.rowIndex]?.product_title,
      });

      // Debug: Check row 6 before (to see if it changes)
      if (action.rowIndex !== 6 && newRows[6]) {
        console.log('🔄 UNDO - Row 6 before:', {
          wsn: newRows[6]?.wsn,
          product_title: newRows[6]?.product_title,
        });
      }

      if (action.type === 'cell') {
        // If we have full row data (WSN change with master data), restore it
        if (action.oldRowData) {
          newRows[action.rowIndex] = { ...action.oldRowData };
        } else {
          // Simple cell change - just restore the old value
          newRows[action.rowIndex] = {
            ...newRows[action.rowIndex],
            [action.field]: action.oldValue
          };
        }
      }

      console.log('🔄 UNDO - After change row', action.rowIndex, ':', {
        wsn: newRows[action.rowIndex]?.wsn,
        product_title: newRows[action.rowIndex]?.product_title,
      });

      // Debug: Check row 6 after
      if (action.rowIndex !== 6 && newRows[6]) {
        console.log('🔄 UNDO - Row 6 after:', {
          wsn: newRows[6]?.wsn,
          product_title: newRows[6]?.product_title,
        });
      }

      // Save to redo stack with current data for proper redo
      redoStackRef.current.push({
        ...action,
        oldValue: action.newValue,
        newValue: action.oldValue,
        // Store the row data we're replacing for redo
        oldRowData: currentRowData,
        newRowData: action.oldRowData,
      });

      return newRows;
    });

    // ⚡ EXCEL-LIKE: Move focus to the undone cell (like Excel)
    setTimeout(() => {
      const api = gridRef.current;
      if (api) {
        // Ensure the row is visible first
        api.ensureIndexVisible(action.rowIndex, 'middle');
        // Set focus on the cell that was undone
        api.setFocusedCell(action.rowIndex, action.field);
        // Optionally start editing the cell
        // api.startEditingCell({ rowIndex: action.rowIndex, colKey: action.field });
      }
    }, 50);

    toast.success('Undo successful', { duration: 1500 });
  }, []);

  // ✅ EXCEL-LIKE: Redo last undone change (Ctrl+Y) - cell level
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) {
      toast('Nothing to redo', { icon: 'ℹ️', duration: 1500 });
      return;
    }

    const action = redoStackRef.current.pop()!;

    setMultiRows(currentRows => {
      const newRows = [...currentRows];

      // Capture current row data for undo BEFORE making changes
      const currentRowData = JSON.parse(JSON.stringify(newRows[action.rowIndex]));

      if (action.type === 'cell') {
        // If we have full row data, restore it (this is the state we're redoing TO)
        if (action.oldRowData) {
          newRows[action.rowIndex] = { ...action.oldRowData };
        } else {
          // Simple cell change
          newRows[action.rowIndex] = {
            ...newRows[action.rowIndex],
            [action.field]: action.oldValue
          };
        }
      }

      // Save to undo stack with current data for proper undo again
      undoStackRef.current.push({
        ...action,
        oldValue: action.newValue,
        newValue: action.oldValue,
        oldRowData: currentRowData,
        newRowData: action.oldRowData,
      });

      return newRows;
    });

    // ⚡ EXCEL-LIKE: Move focus to the redone cell (like Excel)
    setTimeout(() => {
      const api = gridRef.current;
      if (api) {
        // Ensure the row is visible first
        api.ensureIndexVisible(action.rowIndex, 'middle');
        // Set focus on the cell that was redone
        api.setFocusedCell(action.rowIndex, action.field);
      }
    }, 50);

    toast.success('Redo successful', { duration: 1500 });
  }, []);

  // ⚡ EXCEL-LIKE: Track selected cell range for multi-cell operations
  const [selectedRange, setSelectedRange] = useState<{
    startRow: number;
    endRow: number;
    startCol: string;
    endCol: string;
  } | null>(null);
  const rangeStartCellRef = useRef<{ rowIndex: number; colId: string } | null>(null);

  // ⚡ Keep a ref in sync with selectedRange for use in cellStyle callback
  const selectedRangeRef = useRef<typeof selectedRange>(null);

  // ⚡ PERFORMANCE: Cache computed selection bounds to avoid recalculating for every cell
  const selectionBoundsRef = useRef<{
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
    startCol: string;
    endCol: string;
    colIndexMap: Map<string, number>;
  } | null>(null);

  useEffect(() => {
    selectedRangeRef.current = selectedRange;

    // Pre-compute selection bounds when selection changes
    if (selectedRange && gridRef.current) {
      const api = gridRef.current;
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
          startCol: selectedRange.startCol,
          endCol: selectedRange.endCol,
          colIndexMap,
        };
      } else {
        selectionBoundsRef.current = null;
      }
    } else {
      selectionBoundsRef.current = null;
    }
  }, [selectedRange]);

  // ✅ EXCEL ENHANCEMENT: Fill Down (Ctrl+D) - copy value from FIRST selected cell to all cells below
  const handleFillDown = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    const focusedCell = api.getFocusedCell();
    if (!focusedCell) {
      toast('Select a cell first', { icon: 'ℹ️', duration: 1500 });
      return;
    }

    const { rowIndex, column } = focusedCell;
    // Use the column from selection start if available, otherwise use focused cell's column
    const colId = selectedRange?.startCol || column.getColId();

    // Check if column is editable
    if (!EDITABLE_COLUMNS.includes(colId)) {
      toast('Cannot fill down in this column', { icon: '⚠️', duration: 1500 });
      return;
    }

    // If we have a selected range, fill down from the FIRST cell to all cells below
    if (selectedRange) {
      const startRow = Math.min(selectedRange.startRow, selectedRange.endRow);
      const endRow = Math.max(selectedRange.startRow, selectedRange.endRow);

      // Get the value from the FIRST selected cell (topmost)
      const sourceValue = multiRows[startRow]?.[colId];
      if (sourceValue === undefined || sourceValue === null || sourceValue === '') {
        toast('First selected cell is empty', { icon: 'ℹ️', duration: 1500 });
        return;
      }

      const newRows = [...multiRows];
      let filledCount = 0;

      // Fill all cells BELOW the first selected cell
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
      toast.success(`Filled ${filledCount} cells with: ${sourceValue}`, { duration: 1500 });
      return;
    }

    // Single cell fill down (copy from cell above)
    if (rowIndex === 0) {
      toast('No cell above to copy from', { icon: 'ℹ️', duration: 1500 });
      return;
    }

    const valueAbove = multiRows[rowIndex - 1]?.[colId];
    if (valueAbove === undefined || valueAbove === null || valueAbove === '') {
      toast('No value above to copy', { icon: 'ℹ️', duration: 1500 });
      return;
    }

    // Save to undo stack before modification (cell-level)
    const oldValue = multiRows[rowIndex]?.[colId];
    saveCellUndoAction(rowIndex, colId, oldValue, valueAbove);

    const newRows = [...multiRows];
    newRows[rowIndex] = { ...newRows[rowIndex], [colId]: valueAbove };
    setMultiRows(newRows);

    // Refresh cell
    api.refreshCells({ rowNodes: [api.getRowNode(String(rowIndex))], columns: [colId] });
    toast.success(`Filled: ${valueAbove}`, { duration: 1500 });
  }, [multiRows, saveCellUndoAction, selectedRange]);

  // ✅ EXCEL ENHANCEMENT: Fill Right (Ctrl+R) - copy value from cell to the left
  const handleFillRight = useCallback(() => {
    const api = gridRef.current;
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

    // Check if target column is editable
    if (!EDITABLE_COLUMNS.includes(colId)) {
      toast('Cannot fill in this column', { icon: '⚠️', duration: 1500 });
      return;
    }

    const valueLeft = multiRows[rowIndex]?.[leftColId];
    if (valueLeft === undefined || valueLeft === null || valueLeft === '') {
      toast('No value to the left to copy', { icon: 'ℹ️', duration: 1500 });
      return;
    }

    const oldValue = multiRows[rowIndex]?.[colId];
    saveCellUndoAction(rowIndex, colId, oldValue, valueLeft);

    const newRows = [...multiRows];
    newRows[rowIndex] = { ...newRows[rowIndex], [colId]: valueLeft };
    setMultiRows(newRows);

    api.refreshCells({ rowNodes: [api.getRowNode(String(rowIndex))], columns: [colId] });
    toast.success(`Filled: ${valueLeft}`, { duration: 1500 });
  }, [multiRows, saveCellUndoAction]);

  // ✅ EXCEL ENHANCEMENT: Clear selected cells (Delete key)
  const handleClearCells = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    const focusedCell = api.getFocusedCell();
    if (!focusedCell) return;

    const { rowIndex, column } = focusedCell;
    const colId = column.getColId();

    // If we have a selected range, clear all cells in rectangular range
    if (selectedRange) {
      const startRow = Math.min(selectedRange.startRow, selectedRange.endRow);
      const endRow = Math.max(selectedRange.startRow, selectedRange.endRow);

      // Get column range
      const allColumns = api.getAllDisplayedColumns() || [];
      const colIds = allColumns.map((c: any) => c.getColId());
      const startColIndex = colIds.indexOf(selectedRange.startCol);
      const endColIndex = colIds.indexOf(selectedRange.endCol);

      if (startColIndex === -1 || endColIndex === -1) return;

      const minCol = Math.min(startColIndex, endColIndex);
      const maxCol = Math.max(startColIndex, endColIndex);

      const newRows = [...multiRows];
      let clearedCount = 0;

      for (let r = startRow; r <= endRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const currentColId = colIds[c];

          // Only clear editable columns
          if (!EDITABLE_COLUMNS.includes(currentColId)) continue;

          const oldValue = newRows[r]?.[currentColId];
          if (oldValue !== '' && oldValue !== null && oldValue !== undefined) {
            saveCellUndoAction(r, currentColId, oldValue, '');
            newRows[r] = { ...newRows[r], [currentColId]: '' };

            // Clear master data if clearing WSN
            if (currentColId === 'wsn') {
              ALL_MASTER_COLUMNS.forEach((col) => {
                newRows[r][col] = null;
              });
            }
            clearedCount++;
          }
        }
      }

      setMultiRows(newRows);
      api.refreshCells({ force: true });
      toast.success(`Cleared ${clearedCount} cells`, { duration: 1500 });
      return;
    }

    // Single cell clear
    if (!EDITABLE_COLUMNS.includes(colId)) {
      toast('Cannot clear this column', { icon: '⚠️', duration: 1500 });
      return;
    }
    const oldValue = multiRows[rowIndex]?.[colId];
    if (oldValue === '' || oldValue === null || oldValue === undefined) return;

    saveCellUndoAction(rowIndex, colId, oldValue, '');

    const newRows = [...multiRows];
    newRows[rowIndex] = { ...newRows[rowIndex], [colId]: '' };

    // Clear master data if clearing WSN
    if (colId === 'wsn') {
      ALL_MASTER_COLUMNS.forEach((col) => {
        newRows[rowIndex][col] = null;
      });
    }

    setMultiRows(newRows);
    api.refreshCells({ rowNodes: [api.getRowNode(String(rowIndex))], columns: [colId] });
  }, [multiRows, saveCellUndoAction, selectedRange]);

  // ✅ EXCEL ENHANCEMENT: Select All (Ctrl+A)
  const handleSelectAll = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    const totalRows = api.getDisplayedRowCount();
    if (totalRows === 0) return;

    // Get all editable columns for selection
    const allColumns = api.getAllDisplayedColumns() || [];
    const editableColIds = allColumns.map((c: any) => c.getColId()).filter((id: string) => EDITABLE_COLUMNS.includes(id));

    const firstCol = editableColIds[0] || 'wsn';
    const lastCol = editableColIds[editableColIds.length - 1] || 'wsn';

    // Select all rows
    api.selectAll();

    // Set range to all editable cells
    setSelectedRange({
      startRow: 0,
      endRow: totalRows - 1,
      startCol: firstCol,
      endCol: lastCol,
    });

    rangeStartCellRef.current = { rowIndex: 0, colId: firstCol };

    toast('All rows selected', { icon: '✓', duration: 1500 });
  }, []);

  // ✅ EXCEL ENHANCEMENT: Go to first cell (Ctrl+Home)
  const handleGoToFirst = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    api.ensureIndexVisible(0, 'top');
    api.setFocusedCell(0, 'wsn');
    setSelectedRange(null);
  }, []);

  // ✅ EXCEL ENHANCEMENT: Go to last cell with data (Ctrl+End)
  const handleGoToLast = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    // Find last row with data
    let lastRowWithData = 0;
    for (let i = multiRows.length - 1; i >= 0; i--) {
      if (multiRows[i]?.wsn?.trim()) {
        lastRowWithData = i;
        break;
      }
    }

    api.ensureIndexVisible(lastRowWithData, 'bottom');
    api.setFocusedCell(lastRowWithData, 'wsn');
    setSelectedRange(null);
  }, [multiRows]);

  // ⚡ EXCEL-LIKE: Track mouse drag state for multi-cell selection
  const isDraggingRef = useRef(false);
  const dragStartCellRef = useRef<{ rowIndex: number; colId: string } | null>(null);

  // ✅ EXCEL ENHANCEMENT: Handle cell mouse down - start drag selection
  const handleCellMouseDown = useCallback((rowIndex: number, colId: string, shiftKey: boolean) => {
    if (shiftKey && rangeStartCellRef.current) {
      // Shift+Click: Extend selection from start cell to this cell
      setSelectedRange({
        startRow: rangeStartCellRef.current.rowIndex,
        endRow: rowIndex,
        startCol: rangeStartCellRef.current.colId,
        endCol: colId,
      });
    } else {
      // Start new drag selection - just set anchor, don't create selection yet
      isDraggingRef.current = true;
      dragStartCellRef.current = { rowIndex, colId };
      rangeStartCellRef.current = { rowIndex, colId };
      // Clear any existing selection on new click
      setSelectedRange(null);
    }
  }, []);

  // ✅ EXCEL ENHANCEMENT: Handle cell mouse over - extend selection while dragging
  const handleCellMouseOver = useCallback((rowIndex: number, colId: string) => {
    if (!isDraggingRef.current || !dragStartCellRef.current) return;

    // Update selection range while dragging
    setSelectedRange({
      startRow: dragStartCellRef.current.rowIndex,
      endRow: rowIndex,
      startCol: dragStartCellRef.current.colId,
      endCol: colId,
    });
  }, []);

  // ✅ EXCEL ENHANCEMENT: Handle mouse up - end drag selection
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // ✅ EXCEL ENHANCEMENT: Handle Shift+Click for range selection (legacy - keep for compatibility)
  const handleCellClick = useCallback((rowIndex: number, colId: string, shiftKey: boolean) => {
    if (shiftKey && rangeStartCellRef.current) {
      // Extend selection from start cell to this cell
      setSelectedRange({
        startRow: rangeStartCellRef.current.rowIndex,
        endRow: rowIndex,
        startCol: rangeStartCellRef.current.colId,
        endCol: colId,
      });
    } else {
      // Start new selection - just set anchor, don't highlight single cell
      rangeStartCellRef.current = { rowIndex, colId };
      setSelectedRange(null);
    }
  }, []);

  // ✅ EXCEL ENHANCEMENT: Handle Shift+Arrow for range selection
  const handleShiftArrow = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const api = gridRef.current;
    if (!api) return;

    const focusedCell = api.getFocusedCell();
    if (!focusedCell) return;

    const { rowIndex, column } = focusedCell;
    const colId = column.getColId();

    // Initialize range start if not set
    if (!rangeStartCellRef.current) {
      rangeStartCellRef.current = { rowIndex, colId };
    }

    // Get current selection or initialize from focused cell
    const currentRange = selectedRange || {
      startRow: rowIndex,
      endRow: rowIndex,
      startCol: colId,
      endCol: colId,
    };

    let newEndRow = currentRange.endRow;
    let newEndCol = currentRange.endCol;

    if (direction === 'up' && currentRange.endRow > 0) {
      newEndRow = currentRange.endRow - 1;
    } else if (direction === 'down' && currentRange.endRow < multiRows.length - 1) {
      newEndRow = currentRange.endRow + 1;
    } else if (direction === 'left' || direction === 'right') {
      const allColumns = api.getColumns();
      if (allColumns) {
        const colIndex = allColumns.findIndex((c: any) => c.getColId() === currentRange.endCol);
        if (direction === 'left' && colIndex > 0) {
          newEndCol = allColumns[colIndex - 1].getColId();
        } else if (direction === 'right' && colIndex < allColumns.length - 1) {
          newEndCol = allColumns[colIndex + 1].getColId();
        }
      }
    }

    // Update range - use rangeStartCellRef as anchor
    setSelectedRange({
      startRow: rangeStartCellRef.current.rowIndex,
      endRow: newEndRow,
      startCol: rangeStartCellRef.current.colId,
      endCol: newEndCol,
    });

    // Move focus to follow selection
    api.setFocusedCell(newEndRow, newEndCol);
    api.ensureIndexVisible(newEndRow, 'middle');
  }, [multiRows.length, selectedRange]);

  // ⚡ EXCEL-LIKE: Refresh grid when selection changes to update cell highlighting
  // Use requestAnimationFrame + refreshCells instead of redrawRows for better performance
  useEffect(() => {
    const api = gridRef.current;
    if (api) {
      // Use refreshCells with force:true to update styles without full redraw
      // requestAnimationFrame batches the refresh for better performance
      requestAnimationFrame(() => {
        api.refreshCells({ force: true });
      });
    }
  }, [selectedRange]);

  // ⚡ EXCEL-LIKE KEYBOARD SHORTCUTS (Global listener for Multi Entry tab)
  useEffect(() => {
    if (currentTabCode !== 'multi') return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const ctrlKey = e.ctrlKey || e.metaKey;
      const shiftKey = e.shiftKey;

      // Only handle shortcuts when Multi Entry tab is active
      if (currentTabCode !== 'multi') return;

      // Don't handle if editing in input/textarea (except for specific shortcuts)
      const activeEl = document.activeElement;
      const isEditing = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';

      // Ctrl+P → Print last scanned WSN label (custom shortcut)
      if (ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        e.stopPropagation();

        if (!ctrlPPrintEnabled) {
          toast('Ctrl+P shortcut is disabled', { icon: '⚠️', duration: 1500 });
          return;
        }

        if (!lastScannedRowRef.current?.wsn?.trim()) {
          toast.error('No scanned WSN to print', { duration: 2000 });
          return;
        }

        if (!agentReady) {
          toast.error('Print agent not available', { duration: 2000 });
          return;
        }

        // Print the last scanned WSN
        const rowData = lastScannedRowRef.current;
        printRowWSN(rowData);
        return;
      }

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

      // Ctrl+D → Fill Down (works on selected range)
      if (ctrlKey && e.key.toLowerCase() === 'd') {
        const api = gridRef.current;
        if (!api) return;
        const focusedCell = api.getFocusedCell();
        if (!focusedCell) return;
        e.preventDefault();
        handleFillDown();
        return;
      }

      // Ctrl+R → Fill Right
      if (ctrlKey && e.key.toLowerCase() === 'r') {
        const api = gridRef.current;
        if (!api) return;
        const focusedCell = api.getFocusedCell();
        if (!focusedCell) return;
        e.preventDefault();
        handleFillRight();
        return;
      }

      // Delete or Backspace → Clear selected cells
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditing) {
        e.preventDefault();
        handleClearCells();
        return;
      }

      // Ctrl+A → Select All
      if (ctrlKey && e.key.toLowerCase() === 'a') {
        if (isEditing) return;
        e.preventDefault();
        handleSelectAll();
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

      // Shift+Arrow keys → Extend selection
      if (shiftKey && !ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (isEditing) return;
        e.preventDefault();
        const direction = e.key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right';
        handleShiftArrow(direction);
        return;
      }

      // Escape → Clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedRange(null);
        rangeStartCellRef.current = null;
        const api = gridRef.current;
        if (api) {
          api.deselectAll();
          api.stopEditing(true);  // Cancel any cell editing
          api.refreshCells({ force: true });
        }
        toast('Selection cleared', { icon: '✓', duration: 1000 });
        return;
      }

      // F2 → Edit current cell
      if (e.key === 'F2' && !isEditing) {
        const api = gridRef.current;
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
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentTabCode, handleUndo, handleRedo, handleFillDown, handleFillRight, handleClearCells, handleSelectAll, handleGoToFirst, handleGoToLast, handleShiftArrow]);

  // Record scanning activity: detect rapid consecutive inputs and enable scanning mode
  function recordScanActivity() {
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

      // Enable scanning mode immediately for responsiveness
      scanningModeRef.current = true;

      // ⚡ SMOOTH SCROLL FIX: Clear user scroll flag when scanner is actively scanning
      // This allows auto-scroll during continuous scanning operations
      userScrolledRef.current = false;
      if (userScrollTimeoutRef.current) {
        window.clearTimeout(userScrollTimeoutRef.current);
        userScrollTimeoutRef.current = null;
      }

      // Exit scanning mode after a longer inactivity window (3s) to be robust for long runs
      scanModeTimeoutRef.current = window.setTimeout(() => {
        scanCountRef.current = 0;
        scanningModeRef.current = false;
        lastScanTsRef.current = null;
        scanModeTimeoutRef.current = null;
      }, 3000);
    } catch (e) { /* ignore */ }
  }

  // Ensure a row is visible both inside AG Grid and in the outer scroll container
  // rowsBelow controls how many rows below the target stay visible (helps scanner users)
  // Accepts an optional callback which is invoked after the scrolling finishes
  // Uses offsetTop for stable calculations and does immediate jumps for rapid scanner input
  const lastAutoScrollTsRef = useRef<number | null>(null);

  // Wait for AG Grid to render the row element (up to timeoutMs). Returns the element or null.
  function waitForRowElement(rowIndex: number, timeoutMs = 600): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
      const start = performance.now();
      const check = () => {
        const el = document.querySelector(`[data-row=\"${rowIndex}\"][data-col=\"0\"]`) as HTMLElement | null;
        if (el) { resolve(el); return; }
        if (performance.now() - start > timeoutMs) { resolve(null); return; }
        requestAnimationFrame(check);
      };
      check();
    });
  }
  function ensureRowVisible(
    rowIndex: number,
    position: 'top' | 'middle' | 'bottom' = 'bottom',
    rowsBelow = 3,
    onComplete?: () => void,
    immediate = false
  ) {
    // ⚡ SMOOTH SCROLL FIX: If user recently scrolled manually, don't auto-scroll
    // This prevents the jarring jump when user scrolls up and scans
    if (userScrolledRef.current && !immediate) {
      onComplete?.();
      return;
    }

    // Cancel any ongoing scroll operations
    if (scrollAnimationFrameRef.current) {
      cancelAnimationFrame(scrollAnimationFrameRef.current);
      scrollAnimationFrameRef.current = null;
    }
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    isAutoScrollingRef.current = true;

    // Use AG Grid's native scrolling - it's smoother and handles virtualization properly
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
      const topBuffer = 2; // rows from top to consider "visible"
      const bottomBuffer = rowsBelow; // rows from bottom to consider "visible"

      const isAlreadyVisible = rowIndex >= (firstVisibleRow + topBuffer) &&
        rowIndex <= (lastVisibleRow - bottomBuffer);

      // If row is already comfortably visible, don't scroll - just invoke callback
      if (isAlreadyVisible) {
        isAutoScrollingRef.current = false;
        onComplete?.();
        return;
      }

      // Use AG Grid's smooth scroll approach
      // For scanning mode or immediate, use 'middle' position for minimal movement
      // Otherwise position based on where row is relative to viewport
      const effectivePosition = (scanningModeRef.current || immediate)
        ? 'middle'
        : (rowIndex < firstVisibleRow ? 'top' : 'bottom');

      api.ensureIndexVisible(rowIndex, effectivePosition);

      // Small delay to let AG Grid finish scrolling, then invoke callback
      scrollTimeoutRef.current = window.setTimeout(() => {
        isAutoScrollingRef.current = false;
        onComplete?.();
      }, 50);

    } catch (e) {
      isAutoScrollingRef.current = false;
      onComplete?.();
    }
  }

  const addMultiRow = () => {
    const newRowIndex = multiRows.length;
    // ⚡ PERFORMANCE: Generate unique row ID for new row
    rowIdCounterRef.current += 1;
    const newRows = [
      ...multiRows,
      {
        _rowId: `row_${rowIdCounterRef.current}_${Date.now()}`,
        wsn: '',
        inbound_date: commonDate,
        vehicle_no: commonVehicle,
        product_serial_number: '',
        rack_no: '',
        unload_remarks: ''
      }
    ];

    setMultiRows(newRows);

    // ⚡ EXCEL ENHANCEMENT: Highlight newly added row
    highlightRow(newRowIndex, 1500);

    // Give React/AG Grid a moment to render, then ensure the new row is visible (Excel-like behavior)
    setTimeout(() => {
      try {
        ensureRowVisible(newRows.length - 1, 'bottom', 3, undefined, scanningModeRef.current);

        // Auto-focus the WSN cell of the new row
        const api = gridRef.current;
        if (api) {
          api.startEditingCell({
            rowIndex: newRowIndex,
            colKey: 'wsn',
          });
        }
      } catch (e) { /* ignore */ }
    }, 80);
  };

  const statusCounts = useMemo(() => {
    let ready = 0;
    let duplicate = 0;
    let cross = 0;

    multiRows.forEach(row => {
      if (!row.wsn?.trim()) return;

      const wsn = row.wsn.trim().toUpperCase();

      if (crossWarehouseWSNs.has(wsn)) cross++;
      else if (gridDuplicateWSNs.has(wsn)) duplicate++;
      else ready++;
    });

    return { ready, duplicate, cross };
  }, [multiRows, gridDuplicateWSNs, crossWarehouseWSNs]);


  const add500Rows = () => {
    const newRows = generateEmptyRows(500).map(row => ({
      ...row,
      inbound_date: commonDate,
      vehicle_no: commonVehicle
    }));
    setMultiRows([...multiRows, ...newRows]);
    //toast.success('✓ Added 500 rows');
  };

  // Export Multi Entry grid data to Excel
  const exportMultiEntryToExcel = async () => {
    // Filter only rows with actual data (WSN entered)
    const dataRows = multiRows.filter(row => row.wsn?.trim());

    if (dataRows.length === 0) {
      toast('⚠️ No data to export', { icon: '⚠️' });
      return;
    }

    try {
      // Dynamic import to reduce bundle size
      const XLSX = await import('xlsx');

      // Prepare export data with all columns (user input + master data)
      const exportData = dataRows.map((row, idx) => ({
        'Sr No': idx + 1,
        // User Input Columns
        'WSN': row.wsn || '',
        'Product Serial Number': row.product_serial_number || '',
        'Rack No': row.rack_no || '',
        'Unload Remarks': row.unload_remarks || '',
        'Inbound Date': row.inbound_date || commonDate || '',
        'Vehicle No': row.vehicle_no || commonVehicle || '',
        // Master Data Columns
        'WID': row.wid || '',
        'FSN': row.fsn || '',
        'Order ID': row.order_id || '',
        'Product Title': row.product_title || '',
        'Brand': row.brand || '',
        'MRP': row.mrp || '',
        'FSP': row.fsp || '',
        'HSN/SAC': row.hsn_sac || '',
        'IGST Rate': row.igst_rate || '',
        'CMS Vertical': row.cms_vertical || '',
        'FKT Link': row.fkt_link || '',
        'Product Type': row.p_type || '',
        'Product Size': row.p_size || '',
        'VRP': row.vrp || '',
        'Yield Value': row.yield_value || '',
        'FK Grade': row.fk_grade || '',
        'FKQC Remark': row.fkqc_remark || '',
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Multi Entry Data');

      // Auto-fit column widths
      const colWidths = Object.keys(exportData[0]).map(key => ({
        wch: Math.max(key.length, ...exportData.map(row => String((row as any)[key] || '').length)) + 2
      }));
      ws['!cols'] = colWidths;

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const filename = `Inbound_MultiEntry_${timestamp}.xlsx`;

      // Download the file
      XLSX.writeFile(wb, filename);
      toast.success(`✅ Exported ${dataRows.length} rows to ${filename}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  };


  const checkDuplicates = async (rows: any[]) => {
    const gridDup = new Set<string>();
    const crossWh = new Set<string>();
    const wsnCount = new Map<string, number>();

    // 1) Grid-level duplicates - fast local check
    rows.forEach(row => {
      if (!row.wsn?.trim()) return;

      const wsn = row.wsn.trim().toUpperCase();

      wsnCount.set(wsn, (wsnCount.get(wsn) || 0) + 1);
      if (wsnCount.get(wsn)! > 1) {
        gridDup.add(wsn);
      }
    });

    // Update grid duplicates immediately for fast feedback
    setGridDuplicateWSNs(gridDup);

    // 2) Cross-warehouse check: batch the API calls for efficiency
    const uniqueWsns = Array.from(new Set(rows.map(r => r.wsn?.trim().toUpperCase()).filter(Boolean)));

    // Limit concurrent API calls to prevent overwhelming the server
    const BATCH_SIZE = 5;
    for (let i = 0; i < uniqueWsns.length; i += BATCH_SIZE) {
      const batch = uniqueWsns.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (wsn) => {
        try {
          // Search for this WSN across inbound entries
          const resp = await inboundAPI.getAll(1, 1, { search: wsn });
          const item = resp?.data?.data?.[0] || resp?.data?.[0] || null;
          if (item) {
            const itemWarehouseId = item.warehouse_id ?? item.warehouseId ?? item.warehouseid ?? null;
            if (itemWarehouseId && itemWarehouseId !== activeWarehouse?.id) {
              crossWh.add(wsn);
            }
          }
        } catch (err) {
          // ignore individual failures - they simply won't be marked cross-warehouse
        }
      }));
    }

    setGridDuplicateWSNs(gridDup);
    setCrossWarehouseWSNs(crossWh);

    // backward compatibility (submit button disable)
    setDuplicateWSNs(
      new Set([
        ...Array.from(gridDup),
        ...Array.from(crossWh)
      ])
    );
  };

  const updateMultiRow = (index: number, field: string, value: any) => {
    const newRows = [...multiRows];
    newRows[index][field] = field === 'wsn' ? value.toUpperCase() : value;
    setMultiRows(newRows);

    // Debounce duplicate check (200ms)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      checkDuplicates(newRows);
    }, 200);

    // Only fetch master data for WSN - with 500ms delay
    if (field === 'wsn' && value.trim()) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const wsnUpper = value.trim().toUpperCase();
          const response = await inboundAPI.getMasterDataByWSN(wsnUpper);
          const masterInfo = response.data;

          setMultiRows(prevRows => {
            const updatedRows = [...prevRows];
            ALL_MASTER_COLUMNS.forEach(col => {
              updatedRows[index][col] = masterInfo[col] || null;
            });
            return updatedRows;
          });

          // Auto-print if no duplicates AND print is enabled
          const wsn = wsnUpper;
          const isGridDup = gridDuplicateWSNs.has(wsn);
          const isCrossWh = crossWarehouseWSNs.has(wsn);

          if (multiPrintEnabled && !isGridDup && !isCrossWh && agentReady) {
            // Trigger print for this WSN
            triggerPrint(wsn, masterInfo);
          }


        } catch (error) {
          console.log('WSN not found');
        }
      }, 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextCell = document.querySelector(
        `[data-row="${rowIndex}"][data-col="${colIndex + 1}"]`
      ) as HTMLElement;

      if (nextCell) {
        nextCell.focus();
      } else {
        const nextRowFirstCell = document.querySelector(
          `[data-row="${rowIndex + 1}"][data-col="0"]`
        ) as HTMLElement;

        if (nextRowFirstCell) {
          nextRowFirstCell.focus();
        } else {
          addMultiRow();
        }
      }
    }
  };

  // ✅ NAVIGATE TO NEXT CELL (AG GRID) - move right across visible columns, then down to next row like Picking page
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
        // Same row, next visible column
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

  // ✅ EXCEL-LIKE TAB NAVIGATION - move through editable cells like Excel
  const tabToNextCell = useCallback((params: any) => {
    const { previousCellPosition, nextCellPosition, backwards } = params;

    if (!previousCellPosition) return nextCellPosition;

    const currentRow = previousCellPosition.rowIndex;
    const currentCol = previousCellPosition.column.getColId();
    const api = params.api;
    const allColumns = api.getAllDisplayedColumns();
    const editableColumnIds = allColumns
      .map((c: any) => c.getColId())
      .filter((id: string) => EDITABLE_COLUMNS.includes(id));

    const currentColIndex = editableColumnIds.indexOf(currentCol);

    if (backwards) {
      // Shift+Tab - go backwards
      if (currentColIndex > 0) {
        // Move to previous editable column in same row
        const prevColId = editableColumnIds[currentColIndex - 1];
        const prevCol = allColumns.find((c: any) => c.getColId() === prevColId);
        return { rowIndex: currentRow, column: prevCol };
      } else if (currentRow > 0) {
        // Move to last editable column of previous row
        const lastColId = editableColumnIds[editableColumnIds.length - 1];
        const lastCol = allColumns.find((c: any) => c.getColId() === lastColId);
        return { rowIndex: currentRow - 1, column: lastCol };
      }
    } else {
      // Tab - go forwards
      if (currentColIndex < editableColumnIds.length - 1) {
        // Move to next editable column in same row
        const nextColId = editableColumnIds[currentColIndex + 1];
        const nextCol = allColumns.find((c: any) => c.getColId() === nextColId);
        return { rowIndex: currentRow, column: nextCol };
      } else {
        // Move to first editable column of next row
        const firstColId = editableColumnIds[0];
        const firstCol = allColumns.find((c: any) => c.getColId() === firstColId);

        // Auto-scroll to next row
        const nextRow = currentRow + 1;
        setTimeout(() => {
          try {
            ensureRowVisible(nextRow, 'bottom', 4, undefined, true);
          } catch (e) { /* ignore */ }
        }, 50);

        return { rowIndex: nextRow, column: firstCol };
      }
    }

    return nextCellPosition;
  }, [ensureRowVisible]);



  const handleMultiSubmit = async () => {
    if (!activeWarehouse?.id) {
      toast.error("Select warehouse first");
      return;
    }

    const rowsWithDefaults = multiRows.map(row => ({
      ...row,
      inbound_date: row.inbound_date || commonDate,
      vehicle_no: row.vehicle_no || commonVehicle,
      rack_no: row.rack_no || 'Staging' // ✅ Auto-fill Staging
    }));

    const filtered = rowsWithDefaults.filter((r: any) => r.wsn && r.wsn.trim() !== "");

    if (filtered.length === 0) {
      toast.error("No valid WSN rows");
      return;
    }

    // Check for duplicates
    const hasGridDup = filtered.some(r =>
      gridDuplicateWSNs.has(r.wsn.trim().toUpperCase())
    );

    const hasCrossWh = filtered.some(r =>
      crossWarehouseWSNs.has(r.wsn.trim().toUpperCase())
    );

    if (hasCrossWh) {
      toast.error('WSN already inbound in another warehouse');
      return;
    }

    if (hasGridDup) {
      toast.error('Duplicate WSN in grid');
      return;
    }


    setMultiLoading(true);
    setMultiErrorMessage('');
    try {
      // ✅ ISSUE #2, #8 - Add created_by for each row
      const res = await inboundAPI.multiEntry(
        filtered.map(row => ({
          ...row,
          created_by: user?.id,
          warehouse_id: activeWarehouse.id
        })),
        activeWarehouse.id
      );

      // Save vehicle number from current entry
      saveVehicleNumber(commonVehicle);

      toast.success(`✓ Saved ${res.data.successCount} rows`);
      setMultiResults(res.data.results);

      // Reset grid to 500 rows
      setMultiRows(generateEmptyRows(500));

      // Clear vehicle number after successful submit (both state and localStorage)
      setCommonVehicle('');
      localStorage.removeItem('inbound_multiVehicleNumber');

      // Clear saved draft after successful submit
      await clearDraft();

      // Clear receiving WSNs from server (they are now inbound)
      await clearReceivingWSNs();

      loadInboundList();

    } catch (err: any) {
      console.error(err);
      setMultiErrorMessage('❌ Multi entry failed: ' + (err.response?.data?.error || 'Unknown error'));
      toast.error("Multi entry failed");
    } finally {
      setMultiLoading(false);
    }
  };



  const exportToExcel = () => {
    setExportDialogOpen(true);
  };

  const handleAdvancedExport = async () => {
    try {
      // ⚡ OPTIMIZED: Load XLSX dynamically
      const XLSX = await import('xlsx');

      let dataToExport = listData;

      // Build filter params
      const filterParams: any = {
        warehouseId: activeWarehouse?.id,
      };

      // Add current filters from list view FIRST
      if (searchFilter) filterParams.search = searchFilter;
      if (brandFilter) filterParams.brand = brandFilter;
      if (categoryFilter) filterParams.category = categoryFilter;

      // Override with export-specific date filters if provided (takes priority)
      if (exportStartDate) filterParams.dateFrom = exportStartDate;
      else if (dateFromFilter) filterParams.dateFrom = dateFromFilter;

      if (exportEndDate) filterParams.dateTo = exportEndDate;
      else if (dateToFilter) filterParams.dateTo = dateToFilter;

      // Add batch filter if provided
      if (exportBatchIds && exportBatchIds.length > 0) filterParams.batchId = exportBatchIds;

      // Fetch data with all filters
      const response = await inboundAPI.getAll(1, 10000, filterParams);
      dataToExport = response.data.data;

      if (dataToExport.length === 0) {
        toast.error('No data to export with selected filters');
        return;
      }

      // Format dates before export
      const formattedData = dataToExport.map((row: any) => ({
        ...row,
        inbound_date: row.inbound_date ? formatInboundDate(row.inbound_date) : '',
        invoice_date: row.invoice_date ? formatInboundDate(row.invoice_date) : ''
      }));

      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inbound');

      // Generate meaningful filename based on applied filters
      let filenameParts = ['inbound'];
      if (exportBatchIds && exportBatchIds.length > 0) {
        if (exportBatchIds.length === 1) {
          filenameParts.push(`batch_${exportBatchIds[0]}`);
        } else {
          filenameParts.push(`batches_${exportBatchIds.length}`);
        }
      }
      if (exportStartDate || dateFromFilter) filenameParts.push(`from_${(exportStartDate || dateFromFilter).replace(/-/g, '')}`);
      if (exportEndDate || dateToFilter) filenameParts.push(`to_${(exportEndDate || dateToFilter).replace(/-/g, '')}`);
      if (searchFilter) filenameParts.push('search');
      if (brandFilter) filenameParts.push(`brand_${brandFilter.replace(/\s+/g, '_')}`);
      if (categoryFilter) filenameParts.push(`cat_${categoryFilter.replace(/\s+/g, '_')}`);
      if (filenameParts.length === 1) filenameParts.push('all');

      const filename = `${filenameParts.join('_')}_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success(`✓ Exported ${dataToExport.length} records`);
      setExportDialogOpen(false);
      setExportStartDate('');
      setExportEndDate('');
      setExportBatchIds([]);
    } catch (error) {
      toast.error('Export failed');
    }
  };





  const deleteBatch = async (batchId: string) => {
    if (!confirm('Delete batch?')) return;

    try {
      await inboundAPI.deleteBatch(batchId);
      toast.success('Batch deleted');
      loadBatches();
      loadInboundList();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const COLUMN_WIDTHS: Record<string, any> = useMemo(() => ({
    wsn: { width: 60 },
    product_serial_number: { width: 160 },
    rack_no: { width: 30 },
    unload_remarks: { flex: 1, minWidth: 160 },

    // ---- MASTER / READ ONLY COLUMNS ----
    wid: { width: 60 },
    fsn: { width: 120 },
    order_id: { width: 60 },

    product_title: { flex: 2, minWidth: 220 },
    brand: { width: 60 },

    mrp: { width: 30 },
    fsp: { width: 30 },
    hsn_sac: { width: 90 },
    igst_rate: { width: 20 },

    cms_vertical: { width: 120 },
    p_type: { width: 90 },
    p_size: { width: 80 },
    vrp: { width: 70 },
    yield_value: { width: 60 },
    fk_grade: { width: 80 },
    inbound_date: { width: 110 },
    fkt_link: { Width: 50 },
    fkqc_remark: { flex: 1, minWidth: 40 },
  }), []);


  // ✅  - MULTI ENTRY - COLUMN DEFS
  const columnDefs = useMemo(() => {
    // Add row number column at the beginning
    const rowNumberCol = {
      field: 'rowNumber',
      headerName: '#',
      width: 50,
      minWidth: 50,
      maxWidth: 50,
      suppressSizeToFit: true,
      resizable: false,
      editable: false,
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        return <span style={{ fontWeight: 700, color: isDarkMode ? '#94a3b8' : '#64748b' }}>{params.node.rowIndex + 1}</span>;
      },
      cellStyle: { textAlign: 'center' }
    };

    // Print column at the end
    const printCol = {
      field: 'print_action',
      headerName: '🖨️',
      width: 55,
      minWidth: 55,
      maxWidth: 55,
      suppressSizeToFit: true,
      resizable: false,
      editable: false,
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const hasProductData = params.data?.product_title || params.data?.fsn;
        const hasWSN = params.data?.wsn?.trim();

        // Only show print button if WSN exists and product data is populated
        if (!hasWSN || !hasProductData) {
          return null;
        }

        return (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              printRowWSN(params.data);
            }}
            sx={{
              p: 0.5,
              color: '#16a34a',
              '&:hover': {
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                color: '#15803d'
              }
            }}
            title="Print WSN Label"
          >
            <span style={{ fontSize: '16px' }}>🖨️</span>
          </IconButton>
        );
      },
      cellStyle: { textAlign: 'center', padding: '0 4px' }
    };

    const dataCols = visibleColumns.map(col => {
      const isEditable = EDITABLE_COLUMNS.includes(col);

      // Use saved width if available, otherwise use default
      const savedWidth = multiColumnWidths[col];

      const baseColDef: any = {
        field: col,
        headerName: col.replace(/_/g, ' ').toUpperCase(),
        editable: isEditable,
        suppressSizeToFit: true,
        resizable: true,
        minWidth: 80,
        ...(savedWidth ? { width: savedWidth } : {}),
        // Clean consistent cell styling - no different backgrounds
        cellStyle: () => ({})
      };

      const columnWidthConfig = savedWidth ? {} : (COLUMN_WIDTHS[col] || {});

      if (col === 'rack_no' && isEditable) {
        return {
          ...baseColDef,
          width: savedWidth || 110,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: { values: racks.map(r => r.rack_name) }
        };
      } else if (col.includes('date')) {
        return {
          ...baseColDef,
          width: savedWidth || 130,
          cellDataType: 'date'
        };
      } else {
        return {
          ...baseColDef,
          ...columnWidthConfig,

          cellRenderer: (params: any) => {

            // Special rendering for fkqc_remark column
            if (col === 'fkqc_remark') {
              const value = params.value?.trim()?.toUpperCase();
              const isCX = value === 'CX';
              const isNTF = value === 'NTF';

              return (
                <span
                  className={isCX ? 'fkqc-badge-cx' : isNTF ? 'fkqc-badge-ntf' : ''}
                  style={{
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                  title={params.value}
                >
                  {params.value ?? '-'}
                </span>
              );
            }

            if (col !== 'wsn') {
              // Make the FKT_LINK column clickable (open in new tab) while keeping other columns simple
              if (col === 'fkt_link') {
                return (
                  <a
                    href={params.value}
                    target="_blank"
                    rel="noreferrer"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (params.value) window.open(params.value, '_blank');
                    }}
                    style={{ color: '#2563eb', textDecoration: 'underline' }}
                    title={params.value}
                  >
                    {params.value ?? ''}
                  </a>
                );
              }

              return (
                <span title={params.value}>
                  {params.value ?? ''}
                </span>
              );
            }

            const wsn = params.value?.trim()?.toUpperCase();
            const isCross = wsn && crossWarehouseWSNs.has(wsn);
            const isDup = wsn && gridDuplicateWSNs.has(wsn);



            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{params.value ?? ''}</span>

                {/* Clickable product link if available */}
                {params.data?.fkt_link && (
                  <a
                    href={params.data.fkt_link}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      try { window.open(params.data.fkt_link, '_blank'); } catch (err) { /* ignore */ }
                    }}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 14, color: '#2563eb', textDecoration: 'none', marginLeft: 4, cursor: 'pointer' }}
                    title="Open product link"
                  >
                    🔗
                  </a>
                )}

                {isCross && (
                  <Tooltip title="Already inbound in another warehouse">
                    <span style={{ color: '#dc2626', cursor: 'help' }}>⛔</span>
                  </Tooltip>
                )}

                {isDup && !isCross && (
                  <Tooltip title="Duplicate WSN in grid">
                    <span style={{ color: '#d97706', cursor: 'help' }}>⚠️</span>
                  </Tooltip>
                )}
              </div>
            );
          },


          cellClassRules: {
            'wsn-cross-error': (params: any) => {
              const wsn = params.value?.trim()?.toUpperCase();
              return !!wsn && crossWarehouseWSNs.has(wsn);
            },
            'wsn-dup-error': (params: any) => {
              const wsn = params.value?.trim()?.toUpperCase();
              return !!wsn && gridDuplicateWSNs.has(wsn);
            }
          },


        };


      }
    });

    return [rowNumberCol, ...dataCols, printCol];
  },
    [visibleColumns, racks, gridDuplicateWSNs, crossWarehouseWSNs, COLUMN_WIDTHS, multiColumnWidths, printRowWSN]
  );

  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const handleConfirmDownload = () => {
    downloadTemplate();
    setConfirmOpen(false);
  };



  if (!activeWarehouse) {
    return (
      <AppLayout>
        <Box sx={{ p: 6, textAlign: 'center', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <Box sx={{ p: 5, background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', borderRadius: 4, color: 'white', boxShadow: '0 20px 60px rgba(30, 64, 175, 0.4)' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>⚠️ No active warehouse selected.</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>Please go to Settings → Warehouses to set one.</Typography>
          </Box>
        </Box>
      </AppLayout>
    );
  }


  /////////////////////////////// UI RENDERING ///////////////////////////////////
  return (
    <AppLayout>
      <Toaster position="top-right" />

      <Box sx={{
        p: { xs: 0.75, md: 1 },
        background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        height: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>

        {/* ==================== HEADER SECTION ==================== */}
        <StandardPageHeader
          title="Inbound Management"
          subtitle="Manage inbound operations"
          icon="📦"
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

        {/* ✅ NEW: Scrollable Content Wrapper */}
        <Box ref={scrollContainerRef} sx={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/* ==================== MAIN CONTENT AREA ==================== */}
          <Paper
            sx={{
              p: 0,
              borderRadius: 2,
              boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.08)',
              transition: 'opacity 0.15s ease-in-out',
              background: isDarkMode ? '#1e293b' : 'white',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              //overflow: 'hidden',
            }}
          >
            {/* ==================== TAB: INBOUND LIST ==================== */}
            {visibleTabCodes[tabValue] === 'list' && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  p: { xs: 0.25, sm: 0.50 },
                }}
              >
                {/* SEARCH BAR + FILTERS TOGGLE */}
                <Box sx={{ flexShrink: 0, mb: 1, position: 'relative', zIndex: 95 }}>
                  <Stack direction="row" spacing={1} alignItems="stretch" sx={{ mb: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="🔍 Search by WSN, Product Title, or any field..."
                      value={searchInput}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSearchInput(v);

                        // indicate a pending search for the spinner
                        setSearchPending(true);

                        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                        searchDebounceRef.current = setTimeout(() => {
                          setSearchPending(false);
                          setSearchFilter(v);
                          setPage(1);
                        }, SEARCH_DEBOUNCE_MS);
                      }}
                      InputProps={{
                        endAdornment: (searchPending || listLoading) ? (
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

                    {/* Mobile Actions button: opens a full-screen dialog with filters + actions (mobile only) */}
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
                      onClick={() => setMobileActionsOpen(true)}
                    >
                      Actions
                    </Button>

                    <Button
                      variant="outlined"
                      onClick={() => setFiltersExpanded(!filtersExpanded)}
                      sx={{
                        display: { xs: 'none', md: 'inline-flex' },
                        minWidth: { xs: 42, sm: 115 },
                        height: 38,
                        borderWidth: 2,
                        borderColor: filtersExpanded ? '#1e40af' : (isDarkMode ? 'rgba(255,255,255,0.2)' : '#cbd5e1'),
                        bgcolor: filtersExpanded ? 'rgba(30, 64, 175, 0.1)' : (isDarkMode ? '#0f172a' : 'white'),
                        color: filtersExpanded ? '#1e40af' : (isDarkMode ? '#94a3b8' : '#64748b'),
                        fontWeight: 700,
                        fontSize: { xs: '0.7rem', sm: '0.78rem' },
                        borderRadius: 1.5,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        transition: 'all 0.2s',
                        px: { xs: 1, sm: 1.5 },
                        '&:hover': {
                          borderWidth: 2,
                          borderColor: '#1e40af',
                          bgcolor: 'rgba(30, 64, 175, 0.15)',
                          boxShadow: '0 4px 12px rgba(30, 64, 175, 0.2)'
                        },
                        position: 'relative'
                      }}
                    >
                      <FilterListIcon sx={{
                        fontSize: { xs: '1.1rem', sm: '1.15rem' },
                        mr: { xs: 0, sm: 0.4 }
                      }} />

                      <Box component="span" sx={{ mr: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box component="span">{filtersExpanded ? "Hide Filters" : "Show Filters"}</Box>
                        {filtersActive && (
                          <Box sx={{
                            position: 'absolute',
                            top: -5,
                            right: -5,
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            bgcolor: '#10b981',
                            border: '2px solid white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Typography sx={{ fontSize: '0.5rem', fontWeight: 800, color: 'white' }}>
                              ●
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      <ExpandMoreIcon sx={{ transform: filtersExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }} />
                    </Button>
                  </Stack>

                  {/* Collapsible Filter Content */}
                  <Collapse in={filtersExpanded} timeout="auto">
                    <Card sx={{
                      borderRadius: 1.5,
                      boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.15)',
                      background: isDarkMode ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                      border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                      position: 'relative',
                      zIndex: 95
                    }}>
                      <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                        <Stack spacing={1}>
                          {/* ROW 1: Date Filters + Brand + Category */}
                          <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                            gap: 1
                          }}>
                            <TextField
                              label="From Date"
                              type="date"
                              size="small"
                              InputLabelProps={{ shrink: true }}
                              value={dateFromFilter}
                              onChange={(e) => { setDateFromFilter(e.target.value); setPage(1); }}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  height: 36,
                                  fontSize: '0.8rem',
                                  bgcolor: isDarkMode ? '#1e293b' : 'white',
                                  '&:hover fieldset': { borderColor: '#1e40af' },
                                  '&.Mui-focused fieldset': { borderColor: '#1e40af' }
                                },
                                '& .MuiInputLabel-root': {
                                  fontSize: '0.75rem'
                                }
                              }}
                            />
                            <TextField
                              label="To Date"
                              type="date"
                              size="small"
                              InputLabelProps={{ shrink: true }}
                              value={dateToFilter}
                              onChange={(e) => { setDateToFilter(e.target.value); setPage(1); }}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  height: 36,
                                  fontSize: '0.8rem',
                                  bgcolor: isDarkMode ? '#1e293b' : 'white',
                                  '&:hover fieldset': { borderColor: '#1e40af' },
                                  '&.Mui-focused fieldset': { borderColor: '#1e40af' }
                                },
                                '& .MuiInputLabel-root': {
                                  fontSize: '0.75rem'
                                }
                              }}
                            />
                            <FormControl size="small">
                              <InputLabel sx={{ fontSize: '0.75rem' }}>Brand</InputLabel>
                              <Select
                                value={brandFilter}
                                label="Brand"
                                onChange={(e) => {
                                  setBrandFilter(e.target.value);
                                  if (e.target.value && categoryFilter) {
                                    const validCategories = listData
                                      .filter(item => item.brand === e.target.value)
                                      .map(item => item.cms_vertical);
                                    if (!validCategories.includes(categoryFilter)) {
                                      setCategoryFilter('');
                                    }
                                  }
                                  setPage(1);
                                }}
                                sx={{
                                  height: 36,
                                  fontSize: '0.8rem',
                                  bgcolor: isDarkMode ? '#1e293b' : 'white',
                                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' },
                                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' }
                                }}
                              >
                                <MenuItem value="">All Brands</MenuItem>
                                {(categoryFilter ? filteredBrands : brands).map(b =>
                                  <MenuItem key={b} value={b} sx={{ fontSize: '0.8rem' }}>{b}</MenuItem>
                                )}
                              </Select>
                            </FormControl>
                            <FormControl size="small">
                              <InputLabel sx={{ fontSize: '0.75rem' }}>Category</InputLabel>
                              <Select
                                value={categoryFilter}
                                label="Category"
                                onChange={(e) => {
                                  setCategoryFilter(e.target.value);
                                  if (e.target.value && brandFilter) {
                                    const validBrands = listData
                                      .filter(item => item.cms_vertical === e.target.value)
                                      .map(item => item.brand);
                                    if (!validBrands.includes(brandFilter)) {
                                      setBrandFilter('');
                                    }
                                  }
                                  setPage(1);
                                }}
                                sx={{
                                  height: 36,
                                  fontSize: '0.8rem',
                                  bgcolor: isDarkMode ? '#1e293b' : 'white',
                                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' },
                                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' }
                                }}
                              >
                                <MenuItem value="">All Categories</MenuItem>
                                {(brandFilter ? filteredCategories : categories).map(c =>
                                  <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>
                                )}
                              </Select>
                            </FormControl>
                          </Box>

                          {/* ROW 2: Action Buttons */}
                          <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                            gap: 1
                          }}>
                            <Button
                              fullWidth
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                setSearchInput('');
                                setSearchFilter('');
                                setBrandFilter('');
                                setCategoryFilter('');
                                setDateFromFilter('');
                                setDateToFilter('');
                                setPage(1);
                              }}
                              sx={{
                                height: 34,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                borderWidth: 2,
                                borderColor: isDarkMode ? '#64748b' : '#94a3b8',
                                color: isDarkMode ? '#94a3b8' : '#64748b',
                                '&:hover': {
                                  borderWidth: 2,
                                  borderColor: isDarkMode ? '#94a3b8' : '#64748b',
                                  bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc'
                                }
                              }}
                            >
                              🔄 RESET
                            </Button>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              {canSeeButton('list:columns') && (
                                <Tooltip title={!canAccessButton('list:columns') ? "You don't have permission to use this feature" : "Manage Columns"} arrow>
                                  <span style={{ width: '100%' }}>
                                    <Button
                                      fullWidth
                                      size="small"
                                      startIcon={<SettingsIcon sx={{ fontSize: '0.9rem' }} />}
                                      variant="outlined"
                                      disabled={!canAccessButton('list:columns')}
                                      onClick={() => canAccessButton('list:columns') && setListColumnSettingsOpen(true)}
                                      sx={{
                                        height: 34,
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        borderWidth: 2,
                                        borderColor: '#1e40af',
                                        color: '#1e40af',
                                        '&:hover': {
                                          borderWidth: 2,
                                          bgcolor: 'rgba(30, 64, 175, 0.1)'
                                        }
                                      }}
                                    >
                                      COLUMNS
                                    </Button>
                                  </span>
                                </Tooltip>
                              )}

                              <Button
                                type="button"
                                fullWidth
                                size="small"
                                startIcon={<SettingsIcon sx={{ fontSize: '0.9rem' }} />}
                                variant="outlined"
                                onClick={(e) => { e.stopPropagation(); setGridSettingsOpen(true); }}

                                sx={{
                                  height: 34,
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  borderWidth: 2,
                                  borderColor: isDarkMode ? '#64748b' : '#94a3b8',
                                  color: isDarkMode ? '#94a3b8' : '#475569',
                                  '&:hover': {
                                    borderWidth: 2,
                                    bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc'
                                  }
                                }}
                              >
                                GRID
                              </Button>
                            </Stack>
                            {canSeeButton('list:export') && (
                              <Tooltip title={!canAccessButton('list:export') ? "You don't have permission to use this feature" : "Export Data"} arrow>
                                <span style={{ width: '100%' }}>
                                  <Button
                                    fullWidth
                                    size="small"
                                    startIcon={<DownloadIcon sx={{ fontSize: '0.9rem' }} />}
                                    variant="contained"
                                    disabled={!canAccessButton('list:export')}
                                    onClick={() => canAccessButton('list:export') && exportToExcel()}
                                    sx={{
                                      height: 34,
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                      '&:hover': {
                                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                        boxShadow: '0 6px 16px rgba(16, 185, 129, 0.4)'
                                      }
                                    }}
                                  >
                                    EXPORT
                                  </Button>
                                </span>
                              </Tooltip>
                            )}
                            {true && (
                              <Button
                                fullWidth
                                size="small"
                                startIcon={refreshing ? <CircularProgress size={14} /> : refreshSuccess ? <CheckCircle sx={{ color: '#10b981' }} /> : <RefreshIcon sx={{ fontSize: '0.9rem' }} />}
                                variant="outlined"
                                onClick={() => loadInboundList({ buttonRefresh: true })}
                                disabled={refreshing}
                                sx={{
                                  height: 34,
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  borderWidth: 2,
                                  borderColor: '#3b82f6',
                                  color: '#3b82f6',
                                  '&:hover': {
                                    borderWidth: 2,
                                    bgcolor: 'rgba(59, 130, 246, 0.1)'
                                  }
                                }}
                              >
                                {refreshing ? 'Refreshing...' : refreshSuccess ? 'Refreshed' : 'REFRESH'}
                              </Button>
                            )}
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Collapse>

                  {/* MOBILE ACTIONS DIALOG (Filters + Actions combined - mobile only) */}
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
                              label="Brand"
                              value={brandFilter}
                              onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                              fullWidth
                              sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}
                            >
                              <MenuItem value="">All Brands</MenuItem>
                              {(categoryFilter ? filteredBrands : brands).map((b) => (
                                <MenuItem key={b} value={b}>{b}</MenuItem>
                              ))}
                            </TextField>

                            <TextField
                              select
                              size="small"
                              label="Category"
                              value={categoryFilter}
                              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                              fullWidth
                              sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}
                            >
                              <MenuItem value="">All Categories</MenuItem>
                              {(brandFilter ? filteredCategories : categories).map((c) => (
                                <MenuItem key={c} value={c}>{c}</MenuItem>
                              ))}
                            </TextField>

                            <Box display="flex" gap={1}>
                              <TextField
                                label="From Date"
                                type="date"
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                value={dateFromFilter}
                                onChange={(e) => setDateFromFilter(e.target.value)}
                                sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 40 } }}
                              />
                              <TextField
                                label="To Date"
                                type="date"
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                value={dateToFilter}
                                onChange={(e) => setDateToFilter(e.target.value)}
                                sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 40 } }}
                              />
                            </Box>
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
                              onClick={() => { setSearchInput(''); setBrandFilter(''); setCategoryFilter(''); setDateFromFilter(''); setDateToFilter(''); setPage(1); }}
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
                                    onClick={() => { if (canAccessButton('list:export')) { setExportDialogOpen(true); setMobileActionsOpen(false); } }}
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
                              onClick={() => loadInboundList({ buttonRefresh: true })}
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
                        onClick={() => {
                          setSearchInput('');
                          setBrandFilter('');
                          setCategoryFilter('');
                          setDateFromFilter('');
                          setDateToFilter('');
                          setPage(1);
                        }}
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

                </Box>

                {/* TABLE (AG GRID) - HORIZONTAL SCROLL: Replaced Table with AG Grid to improve column sizing and interactions while keeping filters/export/pagination unchanged */}
                <Box sx={{
                  position: 'relative',
                  flex: 1,
                  overflow: 'hidden',
                  minHeight: 0,
                  border: isDarkMode ? '2px solid rgba(255,255,255,0.1)' : '2px solid #e2e8f0',
                  borderRadius: 1.5,
                  boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
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
                        boxShadow: isDarkMode ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)'
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
                            color: isDarkMode ? '#94a3b8' : '#546e7a',
                            letterSpacing: 0.3,
                            textAlign: 'center'
                          }}
                        >
                          Loading data...
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Empty State Overlay */}
                  {!listLoading && (!listData || listData.length === 0) && (
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
                        <Typography variant="h5" sx={{ fontWeight: 600, color: '#6b7280', mb: 0.5 }}>
                          No Data Found
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#9ca3af', maxWidth: 400 }}>
                          No inbound items match your current filters. Try adjusting your search criteria or reset filters to see all items.
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* AG Grid - Always Rendered */}
                  <Box className="ag-theme-quartz" sx={{
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
                      ref={gridRef}
                      rowData={listData}
                      columnDefs={inboundColumnDefs}
                      defaultColDef={inboundDefaultColDef}

                      suppressScrollOnNewData={true}
                      maintainColumnOrder={true}
                      ensureDomOrder={true}
                      enableCellTextSelection={true}
                      suppressRowTransform={true}
                      onGridReady={(params: any) => {
                        columnApiRef.current = params.api;
                        try {
                          const savedState = localStorage.getItem('inbound_columnState');
                          if (savedState && params.api) {
                            params.api.applyColumnState({ state: JSON.parse(savedState), applyOrder: true });
                            hasAutoFittedRef.current = true;
                          }
                        } catch { /* ignore */ }
                      }}
                      onColumnResized={(params: any) => {
                        if (params.finished && params.api) {
                          try {
                            localStorage.setItem('inbound_columnState', JSON.stringify(params.api.getColumnState()));
                          } catch { /* ignore */ }
                        }
                      }}
                      onColumnMoved={(params: any) => {
                        if (params.finished && params.api) {
                          try {
                            localStorage.setItem('inbound_columnState', JSON.stringify(params.api.getColumnState()));
                          } catch { /* ignore */ }
                        }
                      }}
                      onFirstDataRendered={(params: any) => {
                        // Only auto-size columns on first ever load, not on pagination
                        if (!hasAutoFittedRef.current && params.api) {
                          try {
                            // Check if we have saved state - if yes, apply it instead of auto-sizing
                            const savedState = localStorage.getItem('inbound_columnState');
                            if (savedState) {
                              params.api.applyColumnState({ state: JSON.parse(savedState), applyOrder: true });
                            } else {
                              const allColIds = params.api.getColumns()?.map((col: any) => col.getColId()) || [];
                              if (allColIds.length > 0) {
                                params.api.autoSizeColumns(allColIds);
                              }
                            }
                            hasAutoFittedRef.current = true;
                          } catch { /* ignore */ }
                        }
                      }}
                      animateRows={false}
                      rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
                      loading={false}
                      suppressNoRowsOverlay={true}
                      containerStyle={{ height: '100%', width: '100%' }}
                      rowHeight={tableRowHeight}
                      headerHeight={32}
                    />
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

                {/* EXPORT DIALOG */}
                <Dialog
                  open={exportDialogOpen}
                  onClose={() => setExportDialogOpen(false)}
                  maxWidth="md"
                  fullWidth
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
                          {brandFilter && (
                            <Chip size="small" label={`🏷️ ${brandFilter}`} sx={{ bgcolor: isDarkMode ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7', color: isDarkMode ? '#86efac' : '#166534' }} />
                          )}
                          {categoryFilter && (
                            <Chip size="small" label={`📂 ${categoryFilter}`} sx={{ bgcolor: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7', color: isDarkMode ? '#fcd34d' : '#92400e' }} />
                          )}
                          {(exportStartDate || dateFromFilter) && (
                            <Chip size="small" label={`📅 From: ${exportStartDate || dateFromFilter}`} sx={{ bgcolor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff', color: isDarkMode ? '#a5b4fc' : '#3730a3' }} />
                          )}
                          {(exportEndDate || dateToFilter) && (
                            <Chip size="small" label={`📅 To: ${exportEndDate || dateToFilter}`} sx={{ bgcolor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff', color: isDarkMode ? '#a5b4fc' : '#3730a3' }} />
                          )}
                          {(exportBatchIds && exportBatchIds.length > 0) && (
                            <Chip size="small" label={`📦 ${exportBatchIds.length} Batch${exportBatchIds.length > 1 ? 'es' : ''}`} sx={{ bgcolor: isDarkMode ? 'rgba(168, 85, 247, 0.2)' : '#f3e8ff', color: isDarkMode ? '#c4b5fd' : '#6b21a8' }} />
                          )}
                          {!exportStartDate && !exportEndDate && (!exportBatchIds || exportBatchIds.length === 0) && !searchFilter && !brandFilter && !categoryFilter && !dateFromFilter && !dateToFilter && (
                            <Chip size="small" label="📊 All Data" sx={{ bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2', color: isDarkMode ? '#fca5a5' : '#dc2626' }} />
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

                      {/* BATCH SELECTION */}
                      <FormControl fullWidth>
                        <InputLabel sx={{ '&.Mui-focused': { color: '#10b981' } }}>
                          Select Batch IDs (Multiple)
                        </InputLabel>
                        <Select
                          multiple
                          value={exportBatchIds}
                          onChange={(e) => setExportBatchIds(e.target.value as string[])}
                          renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {selected.map((value) => (
                                <Chip
                                  key={value}
                                  label={value}
                                  size="small"
                                  onDelete={() => setExportBatchIds(exportBatchIds.filter(b => b !== value))}
                                  sx={{
                                    bgcolor: '#10b981',
                                    color: 'white',
                                    '& .MuiChip-deleteIcon': { color: 'white', '&:hover': { color: '#a7f3d0' } }
                                  }}
                                />
                              ))}
                            </Box>
                          )}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                              '&:hover fieldset': { borderColor: '#10b981' },
                              '&.Mui-focused fieldset': { borderColor: '#10b981' }
                            }
                          }}
                        >
                          {batches.map(b => (
                            <MenuItem key={b.batch_id} value={b.batch_id} sx={{ py: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {b.batch_id}
                                </Typography>
                                <Chip
                                  label={`${b.count} entries`}
                                  size="small"
                                  sx={{
                                    bgcolor: isDarkMode ? '#334155' : '#e5e7eb',
                                    color: isDarkMode ? '#94a3b8' : '#374151',
                                    fontSize: '0.7rem',
                                    height: '20px'
                                  }}
                                />
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
                            This will export filtered inbound records to Excel with all selected criteria applied.
                            The file will include product details, dates, and batch information.
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
                      onClick={handleAdvancedExport}
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

                {/* INBOUND TAB: COLUMN SETTINGS DIALOG */}
                <Dialog
                  open={listColumnSettingsOpen}
                  onClose={() => setListColumnSettingsOpen(false)}
                  maxWidth="sm"
                  fullWidth
                >
                  <DialogTitle
                    sx={{
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                      color: 'white',
                      py: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2
                    }}
                  >
                    ⚙️ List Columns
                    <Button
                      type="button"
                      size="small"
                      variant="outlined"
                      onClick={(e) => { e.stopPropagation(); setGridSettingsOpen(true); }}
                      disabled={!true}

                      sx={{ ml: 'auto', height: 30, borderColor: '#94a3b8', color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', borderWidth: 1 }}
                    >
                      Grid Settings
                    </Button>
                  </DialogTitle>
                  <DialogContent sx={{ py: 3, maxHeight: 500, overflow: 'auto' }}>
                    <Stack spacing={1.5}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 800,
                          color: '#1e40af',
                          fontSize: '0.8rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        Select Columns
                      </Typography>

                      {INBOUND_LIST_COLUMNS.map((col, idx) => (
                        <FormControlLabel
                          key={`inbound_${idx}_${col}`}
                          control={
                            <Checkbox
                              checked={listColumns.includes(col)}
                              onChange={(e) => {
                                let next = listColumns;

                                if (e.target.checked) {
                                  next = [...listColumns, col];
                                } else {
                                  next = listColumns.filter((c: string) => c !== col);
                                }

                                // order same rakho
                                const ordered = INBOUND_LIST_COLUMNS
                                  .concat(
                                    ALL_MASTER_COLUMNS.filter(
                                      (c) => !INBOUND_LIST_COLUMNS.includes(c),
                                    ),
                                  )
                                  .filter((c) => next.includes(c));

                                saveListColumnSettings(ordered);
                              }}
                            />
                          }
                          label={col.toUpperCase().replace(/_/g, ' ')}
                        />
                      ))}

                      <Divider sx={{ my: 1.5 }} />
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 600, color: '#3b82f6', fontSize: '0.7rem' }}
                      >
                        Additional Master Data
                      </Typography>

                      {ALL_MASTER_COLUMNS.filter(
                        (col) => !INBOUND_LIST_COLUMNS.includes(col),
                      ).map((col, idx) => (
                        <FormControlLabel
                          key={`master_${idx}_${col}`}
                          control={
                            <Checkbox
                              checked={listColumns.includes(col)}
                              onChange={(e) => {
                                let next = listColumns;

                                if (e.target.checked) {
                                  next = [...listColumns, col];
                                } else {
                                  next = listColumns.filter((c: string) => c !== col);
                                }

                                const ordered = INBOUND_LIST_COLUMNS
                                  .concat(
                                    ALL_MASTER_COLUMNS.filter(
                                      (c) => !INBOUND_LIST_COLUMNS.includes(c),
                                    ),
                                  )
                                  .filter((c) => next.includes(c));

                                saveListColumnSettings(ordered);
                              }}
                            />
                          }
                          label={col.toUpperCase().replace(/_/g, ' ')}
                        />
                      ))}
                    </Stack>
                  </DialogContent>
                  <DialogActions sx={{ p: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => setListColumnSettingsOpen(false)}
                      sx={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' }}
                    >
                      Done
                    </Button>
                  </DialogActions>
                </Dialog>

                {/* GRID SETTINGS DIALOG (moved out of tabs so it can open from any tab) */}
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
                        Settings auto-save and persist after reload 💾
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
                              checked={gridSettings.filter}
                              onChange={(e) => updateGridSettings({ ...gridSettings, filter: e.target.checked })}
                              sx={{
                                '&.Mui-checked': { color: '#f59e0b' }
                              }}
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
                              checked={gridSettings.resizable}
                              onChange={(e) => updateGridSettings({ ...gridSettings, resizable: e.target.checked })}
                              sx={{
                                '&.Mui-checked': { color: '#f59e0b' }
                              }}
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
                      Close
                    </Button>
                  </DialogActions>
                </Dialog>


              </Box>
            )
            }
          </Paper >

          {/* TAB: SINGLE ENTRY */}
          {
            visibleTabCodes[tabValue] === 'single' && (
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: { xs: 1.5, sm: 2, lg: 2.5 },
                p: { xs: 1, sm: 1.5, md: 2 },
                height: '100%',
                overflow: 'auto'
              }}>
                {/* Entry Form Card */}
                <Card sx={{
                  borderRadius: { xs: 2, sm: 2.5 },
                  boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : { xs: '0 2px 8px rgba(0,0,0,0.1)', sm: '0 4px 16px rgba(0,0,0,0.08)' },
                  height: { xs: 'auto', lg: 'fit-content' },
                  maxHeight: { xs: '70vh', lg: 'none' },
                  overflow: { xs: 'auto', lg: 'visible' },
                  bgcolor: isDarkMode ? '#1e293b' : 'white',
                }}>
                  <CardContent sx={{ p: { xs: 1.2, sm: 1.5, md: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 1, sm: 1.5 } }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 700,
                          color: isDarkMode ? '#f1f5f9' : '#1a237e',
                          fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem' }
                        }}
                      >
                        📝 Entry Form
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ color: singlePrintEnabled ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          {singlePrintEnabled ? '🖨️ Print ON' : '🖨️ Print OFF'}
                        </Typography>
                        <Switch
                          size="small"
                          checked={singlePrintEnabled}
                          onChange={(e) => setSinglePrintEnabled(e.target.checked)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: '#16a34a',
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: '#16a34a',
                            },
                          }}
                        />
                      </Box>
                    </Box>

                    <Stack spacing={{ xs: 1, sm: 1.2, md: 1.5 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="WSN *"
                        value={singleWSN}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          setSingleWSN(value);

                          if (wsnFetchTimerRef.current) {
                            clearTimeout(wsnFetchTimerRef.current);
                          }

                          if (value.length === 8) {
                            wsnFetchTimerRef.current = setTimeout(() => {
                              autoFetchMasterData(value);
                            }, 300);
                          } else if (value.length < 8) {
                            setMasterData(null);
                          }
                        }}
                        onBlur={handleWSNBlur}
                        placeholder="Enter 8-char WSN"
                        inputProps={{ maxLength: 8 }}
                        disabled={singleLoading}
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: { xs: '0.85rem', sm: '0.875rem' }
                          }
                        }}
                      />

                      <TextField
                        fullWidth
                        size="small"
                        label="Inbound Date"
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        value={singleForm.inbound_date}
                        onChange={(e) => setSingleForm({ ...singleForm, inbound_date: e.target.value })}
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: { xs: '0.85rem', sm: '0.875rem' }
                          }
                        }}
                      />

                      <TextField
                        fullWidth
                        size="small"
                        label="Vehicle Number"
                        value={singleForm.vehicle_no}
                        onChange={(e) => setSingleForm({ ...singleForm, vehicle_no: e.target.value })}
                        placeholder="Vehicle plate"
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: { xs: '0.85rem', sm: '0.875rem' }
                          }
                        }}
                      />

                      <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: { xs: '0.85rem', sm: '0.875rem' } }}>
                          Rack Number
                        </InputLabel>
                        <Select
                          value={singleForm.rack_no}
                          onChange={(e) => setSingleForm({ ...singleForm, rack_no: e.target.value })}
                          label="Rack Number"
                          sx={{
                            '& .MuiSelect-select': {
                              fontSize: { xs: '0.85rem', sm: '0.875rem' }
                            }
                          }}
                        >
                          <MenuItem value="">Select Rack</MenuItem>
                          {racks.map(r => (
                            <MenuItem key={r.id} value={r.rack_name} sx={{ fontSize: { xs: '0.85rem', sm: '0.875rem' } }}>
                              {r.rack_name} - {r.location}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <TextField
                        fullWidth
                        size="small"
                        label="Product Serial Number"
                        value={singleForm.product_serial_number}
                        onChange={(e) => setSingleForm({ ...singleForm, product_serial_number: e.target.value })}
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: { xs: '0.85rem', sm: '0.875rem' }
                          }
                        }}
                      />

                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        rows={3}
                        label="Unload Remarks"
                        value={singleForm.unload_remarks}
                        onChange={(e) => setSingleForm({ ...singleForm, unload_remarks: e.target.value })}
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: { xs: '0.85rem', sm: '0.875rem' }
                          }
                        }}
                      />

                      {duplicateWSN ? (
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <Button
                            fullWidth
                            variant="contained"
                            size="small"
                            onClick={handleUpdateDuplicate}
                            disabled={singleLoading}
                            sx={{
                              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                              py: { xs: 0.9, sm: 0.8 },
                              fontSize: { xs: '0.75rem', sm: '0.8rem' },
                              fontWeight: 700
                            }}
                          >
                            🔄 Update
                          </Button>
                          <Button
                            fullWidth
                            variant="outlined"
                            size="small"
                            onClick={() => { setSingleWSN(''); setDuplicateWSN(null); }}
                            sx={{
                              py: { xs: 0.9, sm: 0.8 },
                              fontSize: { xs: '0.75rem', sm: '0.8rem' },
                              fontWeight: 700
                            }}
                          >
                            Clear
                          </Button>
                        </Stack>
                      ) : (
                        <Button
                          fullWidth
                          variant="contained"
                          size="small"
                          onClick={handleSingleSubmit}
                          disabled={singleLoading}
                          sx={{
                            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                            py: { xs: 0.9, sm: 0.8 },
                            fontSize: { xs: '0.75rem', sm: '0.8rem' },
                            fontWeight: 700
                          }}
                        >
                          ✓ Add Entry
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Master Data Card */}
                {masterData && (
                  <Card sx={{
                    borderRadius: { xs: 2, sm: 2.5, md: 3 },
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
                      : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                    border: `2px solid ${isDarkMode ? '#10b981' : '#10b981'}`,
                    order: { xs: -1, lg: 0 }, // Show master data above form on mobile
                    height: { xs: 'auto', lg: 'fit-content' },
                    maxHeight: { xs: '50vh', lg: 'none' },
                    overflow: { xs: 'auto', lg: 'visible' }
                  }}>
                    <CardContent sx={{ p: { xs: 1.2, sm: 1.5, md: 2 } }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: { xs: 1, sm: 1.5 } }}>
                        <CheckCircle sx={{ color: isDarkMode ? '#4ade80' : '#10b981', fontSize: { xs: 24, sm: 26, md: 28 } }} />
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 700,
                            color: isDarkMode ? '#a7f3d0' : '#065f46',
                            fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem' }
                          }}
                        >
                          Master Data Found
                        </Typography>
                      </Stack>

                      <Divider sx={{ mb: { xs: 1, sm: 1.5 }, borderColor: isDarkMode ? 'rgba(167, 243, 208, 0.3)' : 'rgba(5, 150, 105, 0.3)' }} />

                      <Stack spacing={{ xs: 1, sm: 1.2, md: 1.5 }}>
                        {/* FSN */}
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: isDarkMode ? '#a7f3d0' : '#065f46',
                              fontWeight: 700,
                              fontSize: { xs: '0.65rem', sm: '0.7rem' },
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                              display: 'block',
                              mb: 0.3
                            }}
                          >
                            FSN
                          </Typography>
                          <Typography sx={{
                            fontWeight: 700,
                            color: isDarkMode ? '#ecfdf5' : '#047857',
                            fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem' },
                            wordBreak: 'break-all'
                          }}>
                            {masterData.fsn || 'N/A'}
                          </Typography>
                        </Box>

                        {/* Product */}
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: isDarkMode ? '#a7f3d0' : '#065f46',
                              fontWeight: 700,
                              fontSize: { xs: '0.65rem', sm: '0.7rem' },
                              textTransform: 'uppercase',
                              display: 'block',
                              mb: 0.3
                            }}
                          >
                            PRODUCT
                          </Typography>
                          <Typography sx={{
                            fontWeight: 600,
                            color: isDarkMode ? '#d1fae5' : '#047857',
                            fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.85rem' },
                            lineHeight: 1.4
                          }}>
                            {masterData.product_title || 'N/A'}
                          </Typography>
                        </Box>

                        {/* Brand & Category */}
                        <Box sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                          gap: { xs: 1, sm: 1.5 }
                        }}>
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: isDarkMode ? '#a7f3d0' : '#065f46',
                                fontWeight: 700,
                                fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                display: 'block',
                                mb: 0.3
                              }}
                            >
                              BRAND
                            </Typography>
                            <Typography sx={{
                              fontWeight: 700,
                              color: isDarkMode ? '#ecfdf5' : '#047857',
                              fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' }
                            }}>
                              {masterData.brand || 'N/A'}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: isDarkMode ? '#a7f3d0' : '#065f46',
                                fontWeight: 700,
                                fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                display: 'block',
                                mb: 0.3
                              }}
                            >
                              CATEGORY
                            </Typography>
                            <Typography sx={{
                              fontWeight: 700,
                              color: isDarkMode ? '#ecfdf5' : '#047857',
                              fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' }
                            }}>
                              {masterData.cms_vertical || 'N/A'}
                            </Typography>
                          </Box>
                        </Box>

                        {/* MRP & FSP */}
                        <Box sx={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: { xs: 1, sm: 1.5 },
                          p: { xs: 1, sm: 1.2 },
                          background: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
                          borderRadius: 1
                        }}>
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: isDarkMode ? '#a7f3d0' : '#065f46',
                                fontWeight: 700,
                                fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                display: 'block',
                                mb: 0.3
                              }}
                            >
                              MRP
                            </Typography>
                            <Typography sx={{
                              fontWeight: 700,
                              color: isDarkMode ? '#ecfdf5' : '#047857',
                              fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' }
                            }}>
                              ₹{masterData.mrp || 'N/A'}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: isDarkMode ? '#a7f3d0' : '#065f46',
                                fontWeight: 700,
                                fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                display: 'block',
                                mb: 0.3
                              }}
                            >
                              FSP
                            </Typography>
                            <Typography sx={{
                              fontWeight: 700,
                              color: isDarkMode ? '#ecfdf5' : '#047857',
                              fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' }
                            }}>
                              ₹{masterData.fsp || 'N/A'}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Product Link */}
                        {masterData.fkt_link && (
                          <Box sx={{
                            p: { xs: 0.8, sm: 1 },
                            background: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                            borderRadius: 1,
                            border: `1px dashed ${isDarkMode ? '#4ade80' : '#10b981'}`
                          }}>
                            <Typography
                              variant="caption"
                              sx={{
                                color: isDarkMode ? '#a7f3d0' : '#065f46',
                                fontWeight: 700,
                                fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                display: 'block',
                                mb: 0.5
                              }}
                            >
                              PRODUCT LINK
                            </Typography>
                            <a
                              href={masterData.fkt_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: isDarkMode ? '#38bdf8' : '#0284c7',
                                fontWeight: 600,
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                fontSize: 'clamp(0.75rem, 2vw, 0.85rem)',
                                wordBreak: 'break-word'
                              }}
                            >
                              View on Flipkart →
                            </a>
                          </Box>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </Box>
            )
          }



          {/* TAB: BULK UPLOAD */}
          {
            visibleTabCodes[tabValue] === 'bulk' && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  p: { xs: 1, sm: 1.5, md: 2 },
                  overflow: 'auto',
                }}
              >
                <BulkUploadCard
                  module="inbound"
                  warehouseId={activeWarehouse?.id || 0}
                  userId={user?.id}
                  onUploadComplete={() => {
                    loadBatches();
                    loadInboundList();
                  }}
                  onDownloadTemplate={downloadTemplate}
                  templateColumns={['WSN', 'INBOUND_DATE', 'VEHICLE_NO', 'PRODUCT_SERIAL_NUMBER', 'RACK_NO', 'UNLOAD_REMARKS']}
                  title="📤 Bulk Inbound Upload"
                />
              </Box>
            )
          }


          {/* TAB: MULTI ENTRY */}
          {
            visibleTabCodes[tabValue] === 'multi' && (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%', overflow: 'hidden',
                p: { xs: 1, sm: 1, md: 1 },
                bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa',
                // Prevent white flash during tab switch
                '& *': { transition: 'none !important' },
                '& .ag-root-wrapper': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },
              }}>
                {/* CONTROLS */}
                <Card
                  sx={{
                    borderRadius: 1.5,
                    boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
                    flexShrink: 0, // Don't shrink this card
                    mb: { xs: 1, sm: 1.5 }, // Add bottom margin for spacing
                    bgcolor: isDarkMode ? '#1e293b' : 'white',
                    overflow: 'visible', // Allow content to overflow for scrolling
                  }}
                >
                  <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } }, overflow: 'visible' }}>
                    {/* DESKTOP: Side by side layout */}
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                      <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{
                          alignItems: 'center',
                          width: '100%'
                        }}
                      >
                        {/* LEFT: Date and Vehicle */}
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{
                            flex: '0 0 auto',
                            minWidth: 280
                          }}
                        >
                          <TextField
                            size="small"
                            label="Common Date"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={commonDate}
                            onChange={(e) => setCommonDate(e.target.value)}
                            sx={{
                              width: 140,
                              '& .MuiInputBase-root': { height: 34 }
                            }}
                          />
                          <TextField
                            size="small"
                            label="Vehicle"
                            value={commonVehicle}
                            onChange={(e) => setCommonVehicle(e.target.value)}
                            onBlur={saveMultiVehicleNumber}
                            sx={{
                              width: 130,
                              '& .MuiInputBase-root': { height: 34 }
                            }}
                            placeholder="Auto-fill"
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
                          {/* Action Buttons - Consistent Styling */}
                          <Stack direction="row" spacing={0.75} sx={{ width: 'fit-content', minWidth: 'max-content', alignItems: 'center' }}>
                            {/* COLUMNS Button */}
                            <Tooltip title="Select which columns to show in the grid" placement="top">
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
                            </Tooltip>

                            {/* +500 Add Rows Button */}
                            <Tooltip title="Add 500 more empty rows to the grid" placement="top">
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
                            </Tooltip>

                            {/* Grid Settings Button */}
                            <Tooltip title="Configure grid display settings (row height, font size)" placement="top">
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<SettingsIcon sx={{ fontSize: 14 }} />}
                                onClick={(e) => { e.stopPropagation(); setMultiGridSettingsOpen(true); }}
                                sx={{
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  height: 32,
                                  minWidth: 'auto',
                                  px: 1,
                                  borderRadius: 1,
                                  borderColor: '#f59e0b',
                                  color: '#f59e0b',
                                  whiteSpace: 'nowrap',
                                  textTransform: 'none',
                                  '& .MuiButton-startIcon': { mr: 0.5 },
                                  '&:hover': { borderColor: '#d97706', bgcolor: 'rgba(245, 158, 11, 0.08)' }
                                }}
                              >
                                Grid
                              </Button>
                            </Tooltip>

                            {/* Export Button */}
                            <Tooltip title="Export grid data to Excel with all columns" placement="top">
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={exportMultiEntryToExcel}
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
                                  '&:hover': { borderColor: '#059669', bgcolor: 'rgba(16, 185, 129, 0.08)' }
                                }}
                              >
                                Export
                              </Button>
                            </Tooltip>

                            {/* Divider */}
                            <Box sx={{ width: 1, height: 20, bgcolor: isDarkMode ? '#475569' : '#d1d5db', mx: 0.25 }} />

                            {/* Print Toggle */}
                            <Tooltip title="Auto-print label when WSN is scanned" placement="top">
                              <Box
                                onClick={() => setMultiPrintEnabled(!multiPrintEnabled)}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                  bgcolor: multiPrintEnabled ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                                  border: `1.5px solid ${multiPrintEnabled ? '#16a34a' : '#dc2626'}`,
                                  borderRadius: 1,
                                  px: 1,
                                  height: 32,
                                  cursor: 'pointer',
                                  '&:hover': { opacity: 0.85 }
                                }}
                              >
                                <Typography sx={{ fontSize: '0.85rem', lineHeight: 1 }}>🖨️</Typography>
                                <Typography sx={{ color: multiPrintEnabled ? '#16a34a' : '#dc2626', fontWeight: 700, fontSize: '0.65rem' }}>
                                  {multiPrintEnabled ? 'ON' : 'OFF'}
                                </Typography>
                                <Switch
                                  size="small"
                                  checked={multiPrintEnabled}
                                  onChange={(e) => { e.stopPropagation(); setMultiPrintEnabled(e.target.checked); }}
                                  sx={{
                                    width: 32, height: 18, p: 0,
                                    '& .MuiSwitch-switchBase': { p: '2px' },
                                    '& .MuiSwitch-thumb': { width: 14, height: 14 },
                                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#16a34a' },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#16a34a' },
                                  }}
                                />
                              </Box>
                            </Tooltip>

                            {/* Ctrl+P Toggle */}
                            <Tooltip title="Ctrl+P: Reprint last scanned WSN label" placement="top">
                              <Box
                                onClick={() => setCtrlPPrintEnabled(!ctrlPPrintEnabled)}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                  bgcolor: ctrlPPrintEnabled ? 'rgba(37, 99, 235, 0.1)' : isDarkMode ? 'rgba(100, 116, 139, 0.2)' : 'rgba(156, 163, 175, 0.1)',
                                  border: `1.5px solid ${ctrlPPrintEnabled ? '#2563eb' : isDarkMode ? '#64748b' : '#9ca3af'}`,
                                  borderRadius: 1,
                                  px: 1,
                                  height: 32,
                                  cursor: 'pointer',
                                  '&:hover': { opacity: 0.85 }
                                }}
                              >
                                <Typography sx={{ color: ctrlPPrintEnabled ? '#2563eb' : isDarkMode ? '#94a3b8' : '#6b7280', fontWeight: 700, fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                                  Ctrl+P {ctrlPPrintEnabled ? 'ON' : 'OFF'}
                                </Typography>
                                <Switch
                                  size="small"
                                  checked={ctrlPPrintEnabled}
                                  onChange={(e) => { e.stopPropagation(); setCtrlPPrintEnabled(e.target.checked); }}
                                  sx={{
                                    width: 32, height: 18, p: 0,
                                    '& .MuiSwitch-switchBase': { p: '2px' },
                                    '& .MuiSwitch-thumb': { width: 14, height: 14 },
                                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#2563eb' },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#2563eb' },
                                  }}
                                />
                              </Box>
                            </Tooltip>

                            {/* Ctrl+O Product Link Toggle */}
                            <Tooltip title="Ctrl+O: Open product link for last scanned WSN" placement="top">
                              <Box
                                onClick={() => setCtrlOProductLinkEnabled(!ctrlOProductLinkEnabled)}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                  bgcolor: ctrlOProductLinkEnabled ? 'rgba(168, 85, 247, 0.1)' : isDarkMode ? 'rgba(100, 116, 139, 0.2)' : 'rgba(156, 163, 175, 0.1)',
                                  border: `1.5px solid ${ctrlOProductLinkEnabled ? '#a855f7' : isDarkMode ? '#64748b' : '#9ca3af'}`,
                                  borderRadius: 1,
                                  px: 1,
                                  height: 32,
                                  cursor: 'pointer',
                                  '&:hover': { opacity: 0.85 }
                                }}
                              >
                                <Typography sx={{ color: ctrlOProductLinkEnabled ? '#a855f7' : isDarkMode ? '#94a3b8' : '#6b7280', fontWeight: 700, fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                                  Ctrl+O {ctrlOProductLinkEnabled ? 'ON' : 'OFF'}
                                </Typography>
                                <Switch
                                  size="small"
                                  checked={ctrlOProductLinkEnabled}
                                  onChange={(e) => { e.stopPropagation(); setCtrlOProductLinkEnabled(e.target.checked); }}
                                  sx={{
                                    width: 32, height: 18, p: 0,
                                    '& .MuiSwitch-switchBase': { p: '2px' },
                                    '& .MuiSwitch-thumb': { width: 14, height: 14 },
                                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#a855f7' },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#a855f7' },
                                  }}
                                />
                              </Box>
                            </Tooltip>

                            {/* Divider */}
                            <Box sx={{ width: 1, height: 20, bgcolor: isDarkMode ? '#475569' : '#d1d5db', mx: 0.25 }} />

                            {/* Cache Status Chip */}
                            <Tooltip title="Click to select batch for WSN validation" placement="top">
                              <Chip
                                size="small"
                                onClick={() => setBatchSelectorOpen(true)}
                                icon={<Box sx={{ fontSize: '0.75rem', ml: 0.25 }}>{batchCacheLoading || cacheLoading ? '🔄' : selectedBatchIds.length > 0 ? '📦' : '✅'}</Box>}
                                label={
                                  batchCacheLoading
                                    ? 'Loading...'
                                    : selectedBatchIds.length > 0
                                      ? `${selectedBatchIds.length} batch`
                                      : cacheLoading
                                        ? 'Syncing...'
                                        : cacheStats
                                          ? `${cacheStats.totalRecords.toLocaleString()} WSN`
                                          : 'Loading...'
                                }
                                sx={{
                                  height: 32,
                                  borderRadius: 1,
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  bgcolor: selectedBatchIds.length > 0
                                    ? 'rgba(139, 92, 246, 0.12)'
                                    : batchCacheLoading || cacheLoading
                                      ? 'rgba(59, 130, 246, 0.12)'
                                      : 'rgba(16, 185, 129, 0.12)',
                                  color: selectedBatchIds.length > 0
                                    ? '#8b5cf6'
                                    : batchCacheLoading || cacheLoading
                                      ? '#3b82f6'
                                      : '#10b981',
                                  border: `1.5px solid ${selectedBatchIds.length > 0 ? '#8b5cf6' : batchCacheLoading || cacheLoading ? '#3b82f6' : '#10b981'}`,
                                  '& .MuiChip-icon': { color: 'inherit' },
                                  '&:hover': { opacity: 0.85 }
                                }}
                              />
                            </Tooltip>
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>

                    {/* MOBILE: Two rows layout */}
                    <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                      <Stack
                        spacing={1.5}
                        sx={{
                          width: '100%'
                        }}
                      >
                        {/* ROW 1: Date and Vehicle */}
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{
                            width: '100%',
                            alignItems: 'center'
                          }}
                        >
                          <TextField
                            size="small"
                            label="Common Date"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={commonDate}
                            onChange={(e) => setCommonDate(e.target.value)}
                            sx={{
                              flex: 1,
                              '& .MuiInputBase-root': { height: 36 }
                            }}
                          />
                          <TextField
                            size="small"
                            label="Vehicle"
                            value={commonVehicle}
                            onChange={(e) => setCommonVehicle(e.target.value)}
                            onBlur={saveMultiVehicleNumber}
                            sx={{
                              flex: 1,
                              '& .MuiInputBase-root': { height: 36 }
                            }}
                            placeholder="Auto-fill"
                          />
                        </Stack>

                        {/* ROW 2: Status Chips + Action Buttons - Horizontally Scrollable */}
                        <Box
                          sx={{
                            width: '100%',
                            maxWidth: '100%',
                            overflowX: 'scroll',
                            overflowY: 'hidden',
                            WebkitOverflowScrolling: 'touch',
                            scrollbarWidth: 'thin',
                            '&::-webkit-scrollbar': { height: 6 },
                            '&::-webkit-scrollbar-thumb': { bgcolor: '#94a3b8', borderRadius: 3 },
                            '&::-webkit-scrollbar-track': { bgcolor: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: 3 },
                            pb: 0.5,
                            mx: -1, // Negative margin to extend scroll area
                            px: 1,  // Padding to compensate
                          }}
                        >
                          {/* Action Buttons */}
                          <Stack direction="row" spacing={1} sx={{ flexShrink: 0, width: 'fit-content', minWidth: 'max-content' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setColumnSettingsOpen(true)}
                              sx={{
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                minWidth: 85,
                                height: 28,
                                px: 0.75,
                                borderColor: '#1e40af',
                                color: '#1e40af',
                                whiteSpace: 'nowrap',
                                '&:hover': {
                                  borderColor: '#1e40af',
                                  bgcolor: 'rgba(30, 64, 175, 0.08)'
                                }
                              }}
                            >
                              <SettingsIcon sx={{ fontSize: '0.85rem', mr: 0.25 }} /> COLUMNS
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={add500Rows}
                              sx={{
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                minWidth: 80,
                                height: 28,
                                px: 0.75,
                                borderColor: '#1e40af',
                                color: '#1e40af',
                                whiteSpace: 'nowrap',
                                '&:hover': {
                                  borderColor: '#1e40af',
                                  bgcolor: 'rgba(30, 64, 175, 0.08)'
                                }
                              }}

                            >
                              +500 Rows
                            </Button>
                            {/* ✅ Multi Entry Grid Settings Button (Mobile) */}
                            <Button
                              type="button"
                              size="small"
                              variant="outlined"
                              onClick={(e) => { e.stopPropagation(); setMultiGridSettingsOpen(true); }}
                              sx={{
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                minWidth: 55,
                                height: 28,
                                px: 0.75,
                                borderColor: '#f59e0b',
                                color: '#f59e0b',
                                whiteSpace: 'nowrap',
                                '&:hover': {
                                  borderColor: '#f59e0b',
                                  bgcolor: 'rgba(245, 158, 11, 0.08)'
                                }
                              }}
                            >
                              <SettingsIcon sx={{ fontSize: '0.85rem', mr: 0.25 }} /> Grid
                            </Button>

                            {/* Print Toggle (Mobile) */}
                            <Box
                              onClick={() => setMultiPrintEnabled(!multiPrintEnabled)}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: `2px solid ${multiPrintEnabled ? '#16a34a' : '#dc2626'}`,
                                borderRadius: 1,
                                px: 0.75,
                                height: 28,
                                minWidth: 55,
                                cursor: 'pointer',
                                flexShrink: 0,
                                '&:hover': { opacity: 0.8 }
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: multiPrintEnabled ? '#16a34a' : '#dc2626',
                                  fontWeight: 700,
                                  fontSize: '0.6rem',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                🖨️ {multiPrintEnabled ? 'ON' : 'OFF'}
                              </Typography>
                            </Box>

                            {/* Ctrl+P Reprint Toggle (Mobile) */}
                            <Box
                              onClick={() => setCtrlPPrintEnabled(!ctrlPPrintEnabled)}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: `2px solid ${ctrlPPrintEnabled ? '#2563eb' : '#9ca3af'}`,
                                borderRadius: 1,
                                px: 0.75,
                                height: 28,
                                minWidth: 50,
                                flexShrink: 0,
                                cursor: 'pointer',
                                '&:hover': { opacity: 0.8 }
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: ctrlPPrintEnabled ? '#2563eb' : '#9ca3af',
                                  fontWeight: 700,
                                  fontSize: '0.55rem'
                                }}
                              >
                                Ctrl+P {ctrlPPrintEnabled ? 'ON' : 'OFF'}
                              </Typography>
                            </Box>

                            {/* Ctrl+O Product Link Toggle (Mobile) */}
                            <Box
                              onClick={() => setCtrlOProductLinkEnabled(!ctrlOProductLinkEnabled)}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: `2px solid ${ctrlOProductLinkEnabled ? '#a855f7' : '#9ca3af'}`,
                                borderRadius: 1,
                                px: 0.75,
                                height: 28,
                                minWidth: 50,
                                flexShrink: 0,
                                cursor: 'pointer',
                                '&:hover': { opacity: 0.8 }
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: ctrlOProductLinkEnabled ? '#a855f7' : '#9ca3af',
                                  fontWeight: 700,
                                  fontSize: '0.55rem'
                                }}
                              >
                                Ctrl+O {ctrlOProductLinkEnabled ? 'ON' : 'OFF'}
                              </Typography>
                            </Box>

                            {/* Cache Status Indicator (Mobile) */}
                            <Chip
                              size="small"
                              onClick={() => setBatchSelectorOpen(true)}
                              label={
                                batchCacheLoading
                                  ? '🔄'
                                  : selectedBatchIds.length > 0
                                    ? `📦 ${cacheStats?.totalRecords?.toLocaleString() || 0}`
                                    : cacheStats
                                      ? `✅ ${cacheStats.totalRecords.toLocaleString()}`
                                      : '⏳'
                              }
                              sx={{
                                height: 24,
                                fontSize: '0.55rem',
                                fontWeight: 600,
                                minWidth: 40,
                                flexShrink: 0,
                                cursor: 'pointer',
                                bgcolor: selectedBatchIds.length > 0
                                  ? 'rgba(139, 92, 246, 0.1)'
                                  : batchCacheLoading || cacheLoading
                                    ? 'rgba(59, 130, 246, 0.1)'
                                    : cacheStats && cacheStats.totalRecords > 0
                                      ? 'rgba(16, 185, 129, 0.1)'
                                      : 'rgba(156, 163, 175, 0.1)',
                                color: selectedBatchIds.length > 0
                                  ? '#8b5cf6'
                                  : batchCacheLoading || cacheLoading
                                    ? '#3b82f6'
                                    : cacheStats && cacheStats.totalRecords > 0
                                      ? '#10b981'
                                      : '#6b7280',
                                border: `1px solid ${selectedBatchIds.length > 0
                                  ? '#8b5cf6'
                                  : batchCacheLoading || cacheLoading
                                    ? '#3b82f6'
                                    : cacheStats && cacheStats.totalRecords > 0
                                      ? '#10b981'
                                      : '#9ca3af'}`,
                              }}
                            />

                            {/* ⚡ EXCEL SHORTCUTS HELP */}
                            <Tooltip
                              title={
                                <Box sx={{ p: 1, fontSize: '11px', lineHeight: 1.6 }}>
                                  <Typography sx={{ fontWeight: 700, mb: 1, fontSize: '13px', borderBottom: '1px solid #444', pb: 0.5 }}>⌨️ Excel-Like Shortcuts</Typography>
                                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mb: 1 }}>
                                    <span><b>Ctrl+Z</b> Undo</span>
                                    <span><b>Ctrl+Y</b> Redo</span>
                                    <span><b>Ctrl+C</b> Copy</span>
                                    <span><b>Ctrl+V</b> Paste</span>
                                    <span><b>Ctrl+X</b> Cut</span>
                                    <span><b>Ctrl+D</b> Fill Down</span>
                                    <span><b>Ctrl+R</b> Fill Right</span>
                                    <span><b>Ctrl+A</b> Select All</span>
                                    <span><b>Delete</b> Clear Cells</span>
                                    <span><b>F2</b> Edit Cell</span>
                                    <span><b>Escape</b> Clear Selection</span>
                                    <span><b>Enter</b> Next Row</span>
                                    <span><b>Tab</b> Next Cell</span>
                                    <span><b>Shift+Tab</b> Prev Cell</span>
                                    <span><b>Ctrl+Home</b> Go First</span>
                                    <span><b>Ctrl+End</b> Go Last</span>
                                  </Box>
                                  <Typography sx={{ fontWeight: 600, fontSize: '11px', color: '#93c5fd' }}>📊 Range Selection:</Typography>
                                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0.5, mt: 0.5 }}>
                                    <span><b>Shift+Click</b> Select range</span>
                                    <span><b>Shift+Arrow</b> Extend selection</span>
                                  </Box>
                                </Box>
                              }
                              arrow
                              placement="bottom"
                            >
                              <Button
                                type="button"
                                size="small"
                                variant="outlined"
                                sx={{
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                  minWidth: 32,
                                  width: 32,
                                  height: 28,
                                  px: 0,
                                  flexShrink: 0,
                                  borderColor: '#10b981',
                                  color: '#10b981',
                                  '&:hover': {
                                    borderColor: '#10b981',
                                    bgcolor: 'rgba(16, 185, 129, 0.08)'
                                  }
                                }}
                              >
                                ⌨️
                              </Button>
                            </Tooltip>

                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  </CardContent>
                </Card>

                {/* ERROR ALERTS */}
                {crossWarehouseWSNs.size > 0 && (
                  <Alert severity="error" sx={{ mb: 0.75, fontWeight: 700, mx: { xs: 0.5, sm: 1 }, flexShrink: 0 }}>
                    Some WSNs are already inbound in another warehouse. Remove them.
                  </Alert>
                )}
                {gridDuplicateWSNs.size > 0 && (
                  <Alert severity="warning" sx={{ mb: 0.75, fontWeight: 700, mx: { xs: 0.5, sm: 1 }, flexShrink: 0 }}>
                    Duplicate WSNs found inside the grid.
                  </Alert>
                )}


                {/* AG GRID - Professional Excel-like styling */}
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 300,
                    border: isDarkMode ? '1px solid #334155' : '2px solid #94a3b8',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
                    boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.12)',
                    // Prevent white flash in dark mode - target all possible AG Grid containers
                    '& *': { transition: 'none !important' },
                    '& .ag-theme-quartz, & .ag-theme-quartz-dark': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },
                    '& .ag-root-wrapper, & .ag-root, & .ag-body': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important', border: 'none' },
                    '& .ag-body-viewport, & .ag-body-horizontal-scroll-viewport': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },
                    '& .ag-center-cols-viewport, & .ag-center-cols-container': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },
                    '& .ag-center-cols-clipper, & .ag-pinned-left-cols-container, & .ag-pinned-right-cols-container': { backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff !important' },

                    // Professional dark header
                    '& .ag-header': {
                      backgroundColor: isDarkMode ? '#1e3a5f' : '#1e3a5f',
                      borderBottom: isDarkMode ? '2px solid #10b981' : '2px solid #059669',
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

                    // Professional rows with visible borders
                    '& .ag-row': {
                      height: 36,
                      overflow: 'visible',
                      borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #cbd5e1',
                    },
                    '& .ag-row-even': { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' },
                    '& .ag-row-odd': { backgroundColor: isDarkMode ? '#1a2536' : '#f1f5f9' },

                    // ⚡ EXCEL ENHANCEMENT: Highlight animation for newly added rows
                    '& .ag-row-highlight-new': {
                      animation: 'rowHighlightPulse 1.5s ease-out',
                      backgroundColor: isDarkMode ? '#14532d !important' : '#dcfce7 !important',
                    },
                    '@keyframes rowHighlightPulse': {
                      '0%': { backgroundColor: isDarkMode ? '#166534' : '#86efac' },
                      '50%': { backgroundColor: isDarkMode ? '#15803d' : '#bbf7d0' },
                      '100%': { backgroundColor: isDarkMode ? '#14532d' : '#dcfce7' },
                    },

                    // Active cell focus - ENHANCED for dark mode visibility
                    '& .ag-cell-focus': {
                      border: isDarkMode ? '2px solid #22d3ee !important' : '2px solid #10b981 !important',
                      outline: 'none',
                      boxShadow: isDarkMode ? '0 0 0 2px rgba(34, 211, 238, 0.4), inset 0 0 8px rgba(34, 211, 238, 0.15)' : '0 0 0 1px rgba(16, 185, 129, 0.3)',
                      backgroundColor: isDarkMode ? 'rgba(34, 211, 238, 0.12) !important' : 'rgba(16, 185, 129, 0.08) !important',
                    },

                    // Selected cell (clicked but not editing)
                    '& .ag-cell.ag-cell-focus:not(.ag-cell-inline-editing)': {
                      border: isDarkMode ? '2px solid #22d3ee !important' : '2px solid #10b981 !important',
                      backgroundColor: isDarkMode ? 'rgba(34, 211, 238, 0.15) !important' : 'rgba(16, 185, 129, 0.1) !important',
                    },

                    // Editing cell - even more prominent
                    '& .ag-cell-inline-editing': {
                      border: isDarkMode ? '2px solid #fbbf24 !important' : '2px solid #f59e0b !important',
                      boxShadow: isDarkMode ? '0 0 0 3px rgba(251, 191, 36, 0.3), inset 0 0 12px rgba(251, 191, 36, 0.1)' : '0 0 0 2px rgba(245, 158, 11, 0.25)',
                      backgroundColor: isDarkMode ? 'rgba(251, 191, 36, 0.1) !important' : 'rgba(245, 158, 11, 0.08) !important',
                    },

                    // ⚡ ENHANCED: Custom range selection styles via data attributes
                    '& .ag-cell[style*="border-top: 3px"]': {
                      borderTop: isDarkMode ? '3px solid #60a5fa !important' : '3px solid #2563eb !important',
                    },
                    '& .ag-cell[style*="border-bottom: 3px"]': {
                      borderBottom: isDarkMode ? '3px solid #60a5fa !important' : '3px solid #2563eb !important',
                    },
                    '& .ag-cell[style*="border-left: 3px"]': {
                      borderLeft: isDarkMode ? '3px solid #60a5fa !important' : '3px solid #2563eb !important',
                    },
                    '& .ag-cell[style*="border-right: 3px"]': {
                      borderRight: isDarkMode ? '3px solid #60a5fa !important' : '3px solid #2563eb !important',
                    },

                    // ⚡ EXCEL-LIKE: Custom range selection CSS classes - VERY VISIBLE
                    '& .custom-range-selected': {
                      backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.4) !important' : 'rgba(37, 99, 235, 0.2) !important',
                      boxShadow: isDarkMode
                        ? 'inset 0 0 0 1px rgba(96, 165, 250, 0.7)'
                        : 'inset 0 0 0 1px rgba(37, 99, 235, 0.5)',
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

                    // Range selection
                    '& .ag-cell-range-selected': {
                      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.25) !important' : '#d1fae5 !important',
                    },
                    '& .ag-cell-range-single-cell': {
                      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2) !important' : '#ecfdf5 !important',
                    },

                    // ⚡ EXCEL-LIKE: Cell range selection highlight (specific column only)
                    '& .ag-cell-in-selection': {
                      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.4) !important' : '#a7f3d0 !important',
                      borderTop: '1px solid #10b981',
                      borderBottom: '1px solid #10b981',
                    },
                    '& .ag-cell-selection-start': {
                      borderTop: '2px solid #059669 !important',
                    },
                    '& .ag-cell-selection-end': {
                      borderBottom: '2px solid #059669 !important',
                    },
                    '& .ag-cell-selection-left': {
                      borderLeft: '2px solid #059669 !important',
                    },
                    '& .ag-cell-selection-right': {
                      borderRight: '2px solid #059669 !important',
                    },

                    // Row indicator for selected range (left border)
                    '& .ag-row-range-selected': {
                      '& .ag-cell:first-of-type': {
                        borderLeft: '3px solid #10b981 !important',
                      },
                    },

                    // Hover effect
                    '& .ag-row-hover': {
                      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.12) !important' : '#d1fae5 !important',
                    },
                    // Prevent white flash in dark mode - apply to inner container immediately
                    '& > div': {
                      backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff',
                    },
                  }}
                >
                  <AgGridReact
                    ref={gridRef}
                    className="ag-theme-quartz"
                    containerStyle={{ height: '100%', width: '100%', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }}
                    // ⚡ PERFORMANCE: getRowId for efficient row tracking and updates
                    getRowId={(params) => params.data._rowId}
                    onGridReady={(params: any) => {
                      gridRef.current = params.api;
                      columnApiRef.current = params.columnApi;
                    }}
                    onModelUpdated={(params: any) => {
                      try {
                        const desired = desiredRowIndexRef.current;
                        if (scanningModeRef.current && typeof desired === 'number') {
                          ensureRowVisible(desired, 'bottom', 3, undefined, true);
                        }
                      } catch (e) { /* ignore */ }
                    }}
                    onFirstDataRendered={(params: any) => {
                      try {
                        const desired = desiredRowIndexRef.current;
                        if (scanningModeRef.current && typeof desired === 'number') {
                          ensureRowVisible(desired, 'bottom', 3, undefined, true);
                        }
                      } catch (e) { /* ignore */ }
                    }}

                    // Removed onCellFocused scroll - was causing unwanted scrolling on cell click
                    // AG Grid handles cell visibility natively
                    //theme="legacy"
                    rowData={multiRows}
                    columnDefs={columnDefs}
                    rowHeight={tableRowHeight}
                    headerHeight={32}
                    suppressNoRowsOverlay={false}
                    overlayNoRowsTemplate='<span style="padding: 20px; font-size: 14px; color: #666;">Click on any cell to start entering data</span>'

                    defaultColDef={{
                      sortable: multiGridSettings.sortable,  // ✅ Multi Entry Settings
                      filter: multiGridSettings.filter,      // ✅ Multi Entry Settings
                      resizable: multiGridSettings.resizable, // ✅ Multi Entry Settings
                      editable: (params) => {
                        // ✅ Check multi grid settings first
                        if (!multiGridSettings.editable) return false;

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
                      // ⚡ EXCEL-LIKE: Cell style for precise rectangular selection highlighting (OPTIMIZED)
                      // Uses pre-computed selectionBoundsRef for O(1) lookups instead of O(n) column search
                      cellStyle: (params: any) => {
                        const bounds = selectionBoundsRef.current;
                        if (!bounds) return undefined;

                        const rowIndex = params.rowIndex;
                        const colId = params.colDef?.field;
                        if (rowIndex === null || rowIndex === undefined || !colId) return undefined;

                        // Fast O(1) lookup from pre-computed map
                        const currentColIndex = bounds.colIndexMap.get(colId);
                        if (currentColIndex === undefined) return undefined;

                        // Check if cell is within the rectangular selection range
                        const isInRowRange = rowIndex >= bounds.minRow && rowIndex <= bounds.maxRow;
                        const isInColRange = currentColIndex >= bounds.minCol && currentColIndex <= bounds.maxCol;

                        if (isInRowRange && isInColRange) {
                          const borderColor = isDarkMode ? '#60a5fa' : '#2563eb';
                          const bgColor = isDarkMode ? 'rgba(96, 165, 250, 0.35)' : 'rgba(37, 99, 235, 0.2)';

                          const style: any = {
                            backgroundColor: bgColor,
                            boxShadow: isDarkMode
                              ? 'inset 0 0 0 1px rgba(96, 165, 250, 0.6)'
                              : 'inset 0 0 0 1px rgba(37, 99, 235, 0.4)',
                          };

                          // Add THICK borders for edges of selection
                          if (rowIndex === bounds.minRow) style.borderTop = `3px solid ${borderColor}`;
                          if (rowIndex === bounds.maxRow) style.borderBottom = `3px solid ${borderColor}`;
                          if (currentColIndex === bounds.minCol) style.borderLeft = `3px solid ${borderColor}`;
                          if (currentColIndex === bounds.maxCol) style.borderRight = `3px solid ${borderColor}`;

                          return style;
                        }

                        return undefined;
                      },
                      // ⚡ EXCEL-LIKE: Add CSS class for selected cells (OPTIMIZED)
                      cellClass: (params: any) => {
                        const bounds = selectionBoundsRef.current;
                        if (!bounds) return '';

                        const rowIndex = params.rowIndex;
                        const colId = params.colDef?.field;
                        if (rowIndex === null || rowIndex === undefined || !colId) return '';

                        // Fast O(1) lookup from pre-computed map
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

                    // ⚡ EXCEL-LIKE CLIPBOARD & SELECTION FEATURES
                    enableCellTextSelection={true}
                    suppressCopyRowsToClipboard={false}
                    clipboardDelimiter="\t"
                    rowSelection={undefined}
                    suppressRowDeselection={false}

                    // ⚡ EXCEL-LIKE: Process clipboard paste from Excel
                    processCellFromClipboard={(params) => {
                      // Allow pasting into editable columns only
                      const colId = params.column.getColId();
                      if (!EDITABLE_COLUMNS.includes(colId)) {
                        return params.node?.data?.[colId]; // Return original value
                      }
                      return params.value;
                    }}

                    // ⚡ EXCEL-LIKE: Handle paste end for notifications
                    onPasteEnd={(params) => {
                      toast.success(`Pasted data successfully`, { duration: 1500 });
                      // Refresh grid to ensure all cells are updated
                      const api = gridRef.current;
                      if (api) {
                        api.refreshCells({ force: true });
                      }
                    }}

                    // keyboard navigation
                    stopEditingWhenCellsLoseFocus={true}
                    enterNavigatesVertically={true}
                    enterNavigatesVerticallyAfterEdit={true}
                    navigateToNextCell={navigateToNextCell}
                    tabToNextCell={tabToNextCell}
                    ensureDomOrder={true}
                    suppressMovableColumns={true}
                    // ⚡ PERFORMANCE: Increase row buffer for smoother scrolling
                    rowBuffer={20}
                    animateRows={false}
                    suppressScrollOnNewData={true}
                    // ⚡ PERFORMANCE: Additional optimizations for large datasets
                    debounceVerticalScrollbar={true}
                    suppressPropertyNamesCheck={true}
                    suppressRowVirtualisation={false}
                    // ⚡ PERFORMANCE: Extra optimizations for 500+ rows
                    suppressColumnVirtualisation={false}
                    suppressCellFocus={false}
                    asyncTransactionWaitMillis={50}
                    suppressChangeDetection={false}
                    valueCache={true}
                    valueCacheNeverExpires={false}

                    // ⚡ EXCEL-LIKE: Handle cell mouse down for drag selection start
                    onCellMouseDown={(event) => {
                      const rowIndex = event.rowIndex;
                      const colId = event.column?.getColId();
                      if (rowIndex === null || rowIndex === undefined || !colId) return;

                      const browserEvent = event.event as MouseEvent;
                      handleCellMouseDown(rowIndex, colId, browserEvent?.shiftKey || false);
                    }}

                    // ⚡ EXCEL-LIKE: Handle cell mouse over for drag selection extend
                    onCellMouseOver={(event) => {
                      const rowIndex = event.rowIndex;
                      const colId = event.column?.getColId();
                      if (rowIndex === null || rowIndex === undefined || !colId) return;

                      handleCellMouseOver(rowIndex, colId);
                    }}

                    // ⚡ EXCEL-LIKE: Handle cell click for shift+click selection
                    onCellClicked={(event) => {
                      const rowIndex = event.rowIndex;
                      const colId = event.column?.getColId();
                      if (rowIndex === null || rowIndex === undefined || !colId) return;

                      const browserEvent = event.event as MouseEvent;
                      handleCellClick(rowIndex, colId, browserEvent?.shiftKey || false);
                    }}

                    // ⚡ SMOOTH SCROLL: Detect user manual scroll to avoid overriding it
                    onBodyScroll={(event) => {
                      // If we're NOT auto-scrolling, this is a user-initiated scroll
                      if (!isAutoScrollingRef.current) {
                        const currentScrollTop = event.top;
                        const scrollDelta = Math.abs(currentScrollTop - lastGridScrollTopRef.current);

                        // Only mark as user scroll if there's significant movement (>10px)
                        // This filters out tiny adjustments from AG Grid's internal operations
                        if (scrollDelta > 10) {
                          userScrolledRef.current = true;

                          // Clear user scroll flag after 1.5 seconds of no scanning activity
                          // This allows auto-scroll to resume for continuous scanning
                          if (userScrollTimeoutRef.current) {
                            window.clearTimeout(userScrollTimeoutRef.current);
                          }
                          userScrollTimeoutRef.current = window.setTimeout(() => {
                            userScrolledRef.current = false;
                            userScrollTimeoutRef.current = null;
                          }, 1500);
                        }

                        lastGridScrollTopRef.current = currentScrollTop;
                      }
                    }}

                    // ✅ Save column widths when resized
                    onColumnResized={(params: any) => {
                      if (params.finished && params.column) {
                        const colId = params.column.getColId();
                        const newWidth = params.column.getActualWidth();
                        // Don't save special columns
                        if (colId === 'rowNumber' || colId === 'print_action') return;

                        setMultiColumnWidths(prev => {
                          const updated = { ...prev, [colId]: newWidth };
                          localStorage.setItem('multiEntryColumnWidths', JSON.stringify(updated));
                          return updated;
                        });
                      }
                    }}

                    // ⚡ EXCEL-LIKE: Get row class for highlighting (newly added rows + selected range)
                    getRowClass={(params) => {
                      const classes: string[] = [];

                      // Highlight newly added/scanned rows
                      if (highlightedRows.has(params.rowIndex)) {
                        classes.push('ag-row-highlight-new');
                      }

                      // Note: Row-level selection highlighting removed - using cell-level highlighting instead
                      // via cellClass in defaultColDef for precise column-only selection

                      return classes.length > 0 ? classes.join(' ') : undefined;
                    }}

                    onCellValueChanged={(event) => {
                      const { colDef, newValue, rowIndex, oldValue, data } = event;
                      const field = colDef?.field;

                      // ✅ NULL SAFETY: Return early if field or rowIndex is null
                      if (!field || rowIndex === null || rowIndex === undefined) return;

                      // ⚡ EXCEL-LIKE: Save cell-level undo action for any meaningful change
                      if (oldValue !== newValue) {
                        // For WSN field, save the entire row data for proper undo
                        // This allows us to restore both the WSN AND the master data that was loaded
                        if (field === 'wsn') {
                          // Reconstruct the old row data by taking current data and replacing WSN with oldValue
                          // Also clear master columns since they weren't loaded yet for the old WSN
                          const currentRowData = multiRowsRef.current[rowIndex];
                          const oldRowData = { ...currentRowData, [field]: oldValue };
                          // Clear master data columns since old WSN didn't have them loaded
                          ALL_MASTER_COLUMNS.forEach((col) => {
                            oldRowData[col] = null;
                          });
                          saveCellUndoAction(rowIndex, field, oldValue, newValue, oldRowData, undefined);
                        } else {
                          saveCellUndoAction(rowIndex, field, oldValue, newValue);
                        }
                      }

                      const newRows = [...multiRows];

                      // WSN clear - master clear
                      if (field === 'wsn' && (!newValue || !newValue.trim())) {
                        newRows[rowIndex] = { ...newRows[rowIndex], [field]: newValue };
                        ALL_MASTER_COLUMNS.forEach((col) => {
                          newRows[rowIndex][col] = null;
                        });
                        setMultiRows(newRows);
                        checkDuplicates(newRows);
                        return;
                      }

                      // ⚡ Convert WSN to uppercase
                      const processedValue = field === 'wsn' && newValue ? newValue.toUpperCase() : newValue;
                      newRows[rowIndex] = { ...newRows[rowIndex], [field]: processedValue };
                      setMultiRows(newRows);

                      // ⚡ SMOOTH SCROLL: Only scroll to next row for WSN field (scanner input)
                      // and only if NOT user-initiated scroll - this prevents disruptive auto-scrolling
                      // For non-WSN fields, user is manually editing so no auto-scroll needed

                      // If user entered a WSN, start scan activity detection
                      if (field === 'wsn' && newValue?.trim()) {
                        // ⚡ EXCEL ENHANCEMENT: Highlight the row being scanned
                        highlightRow(rowIndex, 1500);

                        try {
                          recordScanActivity();
                        } catch (e) { /* ignore */ }

                        // Remember the row that was last edited
                        desiredRowIndexRef.current = rowIndex;

                        setTimeout(() => {
                          if (!scanningModeRef.current) {
                            desiredRowIndexRef.current = null;
                          }
                        }, 1400);

                        // Calculate duplicates immediately
                        const wsn = newValue?.trim()?.toUpperCase();
                        const immediateCounts = new Map<string, number>();

                        newRows.forEach((r: any) => {
                          const rv = r.wsn?.trim()?.toUpperCase();
                          if (rv) immediateCounts.set(rv, (immediateCounts.get(rv) || 0) + 1);
                        });

                        const isGridDuplicateImmediate = (immediateCounts.get(wsn) || 0) > 1;

                        // Grid duplicate → clear cell + toast
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

                          newRows[rowIndex].wsn = '';
                          ALL_MASTER_COLUMNS.forEach((col) => {
                            newRows[rowIndex][col] = null;
                          });
                          setMultiRows(newRows);
                          checkDuplicates(newRows);

                          setTimeout(() => {
                            event.api.startEditingCell({
                              rowIndex: rowIndex,
                              colKey: 'wsn',
                            });
                          }, 100);

                          return;
                        }

                        // ⚡ FAST FETCH: Use LOCAL CACHE first, then API fallback
                        const wsnUpper = newValue.trim().toUpperCase();
                        wsnFetchMapRef.current.set(rowIndex, wsnUpper);

                        // Start ownership check in parallel (this still needs API)
                        const ownershipPromise = inboundAPI.getAll(1, 1, { search: wsnUpper }).catch(() => null);

                        // Use LOCAL CACHE for master data (instant if cached)
                        const masterDataPromise = getLocalMasterData(wsnUpper).catch(() => null);

                        // Process results as they come
                        (async () => {
                          // Define moveToNextRow helper at the start of async block
                          const moveToNextRow = () => {
                            try {
                              recordScanActivity();
                            } catch (e) { /* ignore */ }

                            setTimeout(() => {
                              try {
                                const nextIndex = (rowIndex ?? 0) + 1;

                                if (nextIndex < event.api.getDisplayedRowCount()) {
                                  desiredRowIndexRef.current = nextIndex;
                                  ensureRowVisible(nextIndex, 'bottom', 4, () => {
                                    try {
                                      event.api.startEditingCell({
                                        rowIndex: nextIndex,
                                        colKey: 'wsn',
                                      });
                                    } catch (e) { /* ignore */ }
                                  }, scanningModeRef.current);
                                } else {
                                  addMultiRow();
                                  setTimeout(() => {
                                    const newIdx = nextIndex;
                                    desiredRowIndexRef.current = newIdx;
                                    ensureRowVisible(newIdx, 'bottom', 4, () => {
                                      try {
                                        event.api.startEditingCell({
                                          rowIndex: newIdx,
                                          colKey: 'wsn',
                                        });
                                      } catch (e) { /* ignore */ }
                                    }, scanningModeRef.current);
                                  }, 50);
                                }
                              } catch (e) { /* ignore */ }
                            }, 30);
                          };

                          try {
                            // Check ownership first (usually faster)
                            const ownerResp = await ownershipPromise;
                            const ownerItem = ownerResp?.data?.data?.[0] || ownerResp?.data?.[0] || null;

                            if (ownerItem) {
                              const ownerWarehouseId = ownerItem.warehouse_id ?? ownerItem.warehouseId ?? ownerItem.warehouseid ?? null;

                              if (ownerWarehouseId && ownerWarehouseId !== activeWarehouse?.id) {
                                toast.error(`WSN ${wsnUpper} already inbound in another warehouse`, {
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
                                  icon: '❌',
                                });

                                setMultiRows(prev => {
                                  const updated = [...prev];
                                  updated[rowIndex].wsn = '';
                                  ALL_MASTER_COLUMNS.forEach((col) => {
                                    updated[rowIndex][col] = null;
                                  });
                                  return updated;
                                });
                                checkDuplicates(newRows);

                                setTimeout(() => {
                                  event.api.startEditingCell({
                                    rowIndex: rowIndex,
                                    colKey: 'wsn',
                                  });
                                }, 50);
                                return;
                              }

                              if (ownerWarehouseId && ownerWarehouseId === activeWarehouse?.id) {
                                toast(`WSN ${wsnUpper} already inbound in this warehouse`, {
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

                                setMultiRows(prev => {
                                  const updated = [...prev];
                                  updated[rowIndex].wsn = '';
                                  ALL_MASTER_COLUMNS.forEach((col) => {
                                    updated[rowIndex][col] = null;
                                  });
                                  return updated;
                                });
                                checkDuplicates(newRows);

                                setTimeout(() => {
                                  event.api.startEditingCell({
                                    rowIndex: rowIndex,
                                    colKey: 'wsn',
                                  });
                                }, 50);
                                return;
                              }
                            }

                            // Now get master data result (from local cache or API)
                            const masterInfo = await masterDataPromise;
                            if (!masterInfo) {
                              console.log('WSN not found in master data');
                              // Still move to next row even if not found
                              moveToNextRow();
                              return;
                            }

                            // Check if this is still the latest fetch for this row
                            const latestWSN = wsnFetchMapRef.current.get(rowIndex);
                            if (latestWSN !== wsnUpper) {
                              console.log(`⏭️ Skipping stale fetch for row ${rowIndex}: ${wsnUpper} (latest: ${latestWSN})`);
                              return;
                            }

                            // ⚡ BATCH MODE: Check if WSN is in selected batch(es)
                            if (selectedBatchIds.length > 0) {
                              const wsnBatch = await isWSNInCachedBatches(wsnUpper);
                              if (!wsnBatch) {
                                // WSN not in selected batch - show confirmation dialog
                                setWsnNotInBatchDialog({
                                  open: true,
                                  wsn: wsnUpper,
                                  rowIndex,
                                  masterData: masterInfo
                                });
                                // Don't auto-apply master data - wait for user confirmation
                                return;
                              }
                            }

                            // Update master data in grid
                            setMultiRows((prevRows) => {
                              const currentWSN = prevRows[rowIndex]?.wsn?.trim()?.toUpperCase();
                              if (currentWSN !== wsnUpper) {
                                return prevRows;
                              }

                              const updatedRows = [...prevRows];
                              updatedRows[rowIndex] = { ...updatedRows[rowIndex] };
                              ALL_MASTER_COLUMNS.forEach((masterCol) => {
                                updatedRows[rowIndex][masterCol] = masterInfo[masterCol] || null;
                              });

                              // ⚡ CTRL+P REPRINT: Save last scanned row data for Ctrl+P shortcut
                              lastScannedRowRef.current = { ...updatedRows[rowIndex], wsn: wsnUpper };

                              return updatedRows;
                            });

                            // ✅ AUTO-PRINT: Only if multiPrintEnabled is ON
                            if (multiPrintEnabled) {
                              try {
                                const printPayload = {
                                  wsn: wsnUpper,
                                  fsn: masterInfo.fsn || '',
                                  product_title: masterInfo.product_title || '',
                                  brand: masterInfo.brand || '',
                                  mrp: String(masterInfo.mrp || ''),
                                  fsp: String(masterInfo.fsp || ''),
                                  copies: 1,
                                };

                                const printSuccess = await printLabel(printPayload);
                                if (printSuccess) {
                                  toast.success(`✓ Label printed: ${wsnUpper}`, { duration: 2000 });
                                }
                              } catch (printError: any) {
                                toast.error(`Print error: ${printError.message}`, { duration: 3000 });
                              }
                            }

                            moveToNextRow();
                          } catch (error) {
                            console.log('WSN fetch error:', error);
                          }
                        })();
                      }

                      // Only fetch master data for WSN
                      if (field !== 'wsn') {
                        if (debounceTimerRef.current) {
                          clearTimeout(debounceTimerRef.current);
                        }

                        debounceTimerRef.current = setTimeout(() => {
                          checkDuplicates(newRows);
                        }, 200);
                      }
                    }}

                    onCellKeyDown={(event) => {
                      // ✅ FIX: event.event is AG Grid's wrapper - access the native keyboard event
                      const nativeEvent = event.event as KeyboardEvent | undefined;
                      const key = nativeEvent?.key;
                      const rowIndex = event.rowIndex;

                      // ✅ NULL SAFETY: Check rowIndex
                      if (rowIndex === null || rowIndex === undefined) return;

                      // ⚡ EXCEL-LIKE KEYBOARD SHORTCUTS
                      const ctrlKey = nativeEvent?.ctrlKey || nativeEvent?.metaKey;

                      // Note: Ctrl+Z and Ctrl+Y are handled by the global keyboard handler
                      // to avoid double-triggering. Only grid-specific shortcuts here.

                      // Ctrl+D → Fill Down (copy value from cell above)
                      if (ctrlKey && key?.toLowerCase() === 'd') {
                        nativeEvent?.preventDefault();
                        handleFillDown();
                        return;
                      }

                      // When user presses Enter or Tab to move to next row
                      if (key === 'Enter' || key === 'Tab') {
                        const nextRowIndex = rowIndex + 1;
                        const totalRows = event.api.getDisplayedRowCount();

                        // ⚡ Immediately scroll to show next row (Excel behavior)
                        if (nextRowIndex < totalRows) {
                          setTimeout(() => {
                            try {
                              ensureRowVisible(nextRowIndex, 'bottom', 4, undefined, true);
                            } catch (e) { /* ignore */ }
                          }, 50);
                        }
                      }

                      // Arrow key navigation with Ctrl → Jump to edge of data
                      if (ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key || '')) {
                        nativeEvent?.preventDefault();
                        const api = event.api;
                        const focusedCell = api.getFocusedCell();
                        if (!focusedCell) return;

                        const currentRow = focusedCell.rowIndex;
                        const currentCol = focusedCell.column;
                        const colId = currentCol.getColId();
                        const totalRows = api.getDisplayedRowCount();
                        const allColumns = api.getAllDisplayedColumns();

                        let targetRow = currentRow;
                        let targetCol = currentCol;

                        if (key === 'ArrowUp') {
                          // Jump to first row with data in this column
                          targetRow = 0;
                        } else if (key === 'ArrowDown') {
                          // Jump to last row with data
                          for (let i = totalRows - 1; i >= 0; i--) {
                            const rowData = api.getDisplayedRowAtIndex(i)?.data;
                            if (rowData?.wsn?.trim()) {
                              targetRow = i;
                              break;
                            }
                          }
                        } else if (key === 'ArrowLeft') {
                          // Jump to first column
                          targetCol = allColumns[0];
                        } else if (key === 'ArrowRight') {
                          // Jump to last column
                          targetCol = allColumns[allColumns.length - 1];
                        }

                        api.setFocusedCell(targetRow, targetCol);
                        ensureRowVisible(targetRow, 'middle', 3, undefined, true);
                      }
                    }}




                  />
                </Box>



                {/* DRAFT STATUS + ACTIONS + SUBMIT - Single Row */}
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: { xs: 0.5, sm: 1 },
                  flexWrap: 'wrap',
                  py: 0.5,
                  flexShrink: 0
                }}>
                  {/* ⚡ EXCEL-LIKE: Selection indicator - only show when multiple cells selected */}
                  {selectedRange && Math.abs(selectedRange.endRow - selectedRange.startRow) > 0 && (
                    <Chip
                      label={`📊 ${Math.abs(selectedRange.endRow - selectedRange.startRow) + 1} cells selected (${selectedRange.startCol})`}
                      color="primary"
                      size="small"
                      onDelete={() => {
                        setSelectedRange(null);
                        rangeStartCellRef.current = null;
                        gridRef.current?.refreshCells({ force: true });
                      }}
                      sx={{
                        fontWeight: 600,
                        height: 28,
                        '& .MuiChip-deleteIcon': { color: '#93c5fd' }
                      }}
                    />
                  )}
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

                  {/* SUBMIT BUTTON */}
                  <Button
                    variant="contained"
                    onClick={handleMultiSubmit}
                    disabled={multiLoading || gridDuplicateWSNs.size > 0 || crossWarehouseWSNs.size > 0}
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
                    SUBMIT ALL ({multiRows.filter(r => r.wsn?.trim()).length} rows)
                  </Button>
                </Box>

                {/* MULTI ENTRY TAB: COLUMN SETTINGS DIALOG */}
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

                                const ordered = [...EDITABLE_COLUMNS, ...ALL_MASTER_COLUMNS].filter(
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
                      {ALL_MASTER_COLUMNS.filter(
                        (col) => !EDITABLE_COLUMNS.includes(col),
                      ).map((col, idx) => (
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

                                const ordered = [...EDITABLE_COLUMNS, ...ALL_MASTER_COLUMNS].filter(
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

                {/* MULTI ENTRY GRID SETTINGS DIALOG */}
                <Dialog
                  open={multiGridSettingsOpen}
                  onClose={() => setMultiGridSettingsOpen(false)}
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
                    background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    py: 1.5
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SettingsIcon />
                      Multi Entry Grid Settings
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
                              checked={multiGridSettings.sortable}
                              onChange={(e) => updateMultiGridSettings({ ...multiGridSettings, sortable: e.target.checked })}
                              sx={{
                                '&.Mui-checked': { color: '#1e40af' }
                              }}
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
                              checked={multiGridSettings.filter}
                              onChange={(e) => updateMultiGridSettings({ ...multiGridSettings, filter: e.target.checked })}
                              sx={{
                                '&.Mui-checked': { color: '#1e40af' }
                              }}
                            />
                          }
                          label={
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                                🔍 Enable Filtering
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                                Filter icon appears in column headers for quick search
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
                              checked={multiGridSettings.resizable}
                              onChange={(e) => updateMultiGridSettings({ ...multiGridSettings, resizable: e.target.checked })}
                              sx={{
                                '&.Mui-checked': { color: '#1e40af' }
                              }}
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

                  <DialogActions sx={{ p: 2, pt: 1, background: '#f9fafb', gap: 1 }}>
                    <Button
                      onClick={() => {
                        const defaultSettings = {
                          sortable: true,
                          filter: true,
                          resizable: true,
                          editable: true,
                        };
                        updateMultiGridSettings(defaultSettings);
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
                      onClick={() => setMultiGridSettingsOpen(false)}
                      sx={{
                        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                        fontWeight: 700,
                        boxShadow: '0 4px 12px rgba(30, 64, 175, 0.3)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
                        }
                      }}
                    >
                      Close
                    </Button>
                  </DialogActions>
                </Dialog>

                {/* ====== BATCH SELECTOR DIALOG ====== */}
                <Dialog
                  open={batchSelectorOpen}
                  onClose={() => setBatchSelectorOpen(false)}
                  maxWidth="sm"
                  fullWidth
                  PaperProps={{
                    sx: {
                      borderRadius: 2,
                      maxHeight: '80vh'
                    }
                  }}
                >
                  <DialogTitle sx={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                    color: 'white',
                    fontWeight: 700,
                    py: 1.5
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      📦 Select Master Data Batch(es)
                    </Box>
                  </DialogTitle>
                  <DialogContent sx={{ mt: 2, pb: 1 }}>
                    <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
                      Select batch(es) to cache locally for instant WSN lookup. Only selected batch data will be cached (~1000 products = 2-3 seconds).
                    </Alert>

                    {/* Batch loading progress */}
                    {batchCacheLoading && batchCacheProgress && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 600 }}>
                          {batchCacheProgress.message}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={(batchCacheProgress.loaded / Math.max(batchCacheProgress.total, 1)) * 100}
                          sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    )}

                    {/* Refresh batches button */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        Available Batches ({availableBatches.length})
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<RefreshIcon sx={{ fontSize: '0.9rem' }} />}
                        onClick={async () => {
                          const batches = await getBatchList();
                          setAvailableBatches(batches);
                          toast.success(`Refreshed: ${batches.length} batches`);
                        }}
                        sx={{ fontSize: '0.7rem', textTransform: 'none' }}
                      >
                        Refresh
                      </Button>
                    </Box>

                    {/* Batch list */}
                    <Stack spacing={1} sx={{ maxHeight: 350, overflow: 'auto' }}>
                      {availableBatches.length === 0 ? (
                        <Alert severity="warning">No batches found. Upload master data first.</Alert>
                      ) : (
                        availableBatches.map((batch) => (
                          <Box
                            key={batch.batch_id}
                            onClick={() => {
                              setSelectedBatchIds(prev =>
                                prev.includes(batch.batch_id)
                                  ? prev.filter(id => id !== batch.batch_id)
                                  : [...prev, batch.batch_id]
                              );
                            }}
                            sx={{
                              p: 1.5,
                              borderRadius: 1.5,
                              border: (theme) => `2px solid ${selectedBatchIds.includes(batch.batch_id) ? '#8b5cf6' : theme.palette.divider}`,
                              bgcolor: (theme) => selectedBatchIds.includes(batch.batch_id) ? 'rgba(139, 92, 246, 0.15)' : theme.palette.background.paper,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': {
                                borderColor: '#8b5cf6',
                                bgcolor: 'rgba(139, 92, 246, 0.1)'
                              }
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Checkbox
                                  size="small"
                                  checked={selectedBatchIds.includes(batch.batch_id)}
                                  sx={{
                                    p: 0,
                                    color: '#8b5cf6',
                                    '&.Mui-checked': { color: '#8b5cf6' }
                                  }}
                                />
                                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', fontFamily: 'monospace', color: 'text.primary' }}>
                                  {batch.batch_id}
                                </Typography>
                              </Box>
                              <Chip
                                size="small"
                                label={`${batch.count.toLocaleString()} items`}
                                sx={{
                                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.3)' : '#dbeafe',
                                  color: (theme) => theme.palette.mode === 'dark' ? '#a5b4fc' : '#1e40af',
                                  fontWeight: 600,
                                  fontSize: '0.7rem'
                                }}
                              />
                            </Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 3.5 }}>
                              Created: {new Date(batch.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Typography>
                          </Box>
                        ))
                      )}
                    </Stack>

                    {/* Selected summary */}
                    {selectedBatchIds.length > 0 && (
                      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(139, 92, 246, 0.15)', borderRadius: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#a78bfa' }}>
                          ✅ {selectedBatchIds.length} batch(es) selected
                          {cacheStats && ` • ${cacheStats.totalRecords.toLocaleString()} products cached`}
                        </Typography>
                      </Box>
                    )}
                  </DialogContent>
                  <DialogActions sx={{ p: 2, pt: 1, bgcolor: 'background.default', gap: 1 }}>
                    <Button
                      onClick={() => {
                        setSelectedBatchIds([]);
                        localStorage.removeItem('inbound_selected_batches');
                        toast.success('Batch selection cleared');
                      }}
                      disabled={selectedBatchIds.length === 0}
                      sx={{
                        color: '#dc2626',
                        fontWeight: 600,
                        fontSize: '0.8rem'
                      }}
                    >
                      Clear Selection
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Button
                      variant="contained"
                      onClick={() => setBatchSelectorOpen(false)}
                      sx={{
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                        fontWeight: 700,
                        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                        }
                      }}
                    >
                      Done
                    </Button>
                  </DialogActions>
                </Dialog>

                {/* ====== WSN NOT IN BATCH CONFIRMATION DIALOG ====== */}
                <Dialog
                  open={Boolean(wsnNotInBatchDialog?.open)}
                  onClose={() => setWsnNotInBatchDialog(null)}
                  maxWidth="xs"
                  fullWidth
                  PaperProps={{ sx: { borderRadius: 2 } }}
                >
                  <DialogTitle sx={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    fontWeight: 700,
                    py: 1.5
                  }}>
                    ⚠️ WSN Not In Selected Batch
                  </DialogTitle>
                  <DialogContent sx={{ mt: 2 }}>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      The scanned WSN <strong>{wsnNotInBatchDialog?.wsn}</strong> was not found in the selected batch(es).
                    </Alert>
                    <Typography variant="body2" sx={{ color: '#374151' }}>
                      Do you want to continue with this WSN anyway? Product details will be fetched from the database.
                    </Typography>
                  </DialogContent>
                  <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button
                      onClick={() => {
                        // Clear the WSN and close dialog
                        if (wsnNotInBatchDialog) {
                          const newRows = [...multiRows];
                          newRows[wsnNotInBatchDialog.rowIndex].wsn = '';
                          ALL_MASTER_COLUMNS.forEach((col) => {
                            newRows[wsnNotInBatchDialog.rowIndex][col] = null;
                          });
                          setMultiRows(newRows);
                        }
                        setWsnNotInBatchDialog(null);
                      }}
                      sx={{ color: '#dc2626', fontWeight: 600 }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => {
                        // Apply the master data and continue
                        if (wsnNotInBatchDialog?.masterData) {
                          const newRows = [...multiRows];
                          ALL_MASTER_COLUMNS.forEach((col) => {
                            newRows[wsnNotInBatchDialog.rowIndex][col] = wsnNotInBatchDialog.masterData[col] ?? null;
                          });
                          setMultiRows(newRows);
                          toast.success(`Applied product details for ${wsnNotInBatchDialog.wsn}`);
                        }
                        setWsnNotInBatchDialog(null);
                      }}
                      sx={{
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        fontWeight: 700
                      }}
                    >
                      Continue Anyway
                    </Button>
                  </DialogActions>
                </Dialog>
              </Box>
            )
          }

          {/* TAB: BATCH MANAGER */}
          {
            visibleTabCodes[tabValue] === 'batches' && (
              <BatchManagementTab
                batches={batches}
                loading={batchLoading}
                onRefresh={loadBatches}
                onDelete={canSeeButton('batches:delete') ? deleteBatch : undefined}
                canDelete={canSeeButton('batches:delete')}
                title="Batch Management"
                emptyMessage="No batches found"
                emptySubMessage="Batches will appear here after inbound uploads"
              />
            )
          }
        </Box >
      </Box >
    </AppLayout >
  );
}
