// File Path = warehouse-frontend\app\picking\page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Stack, Tab, Tabs,
  CircularProgress, Alert, IconButton, Autocomplete, Checkbox, FormControlLabel,
  Card, CardContent, LinearProgress, Divider, Collapse, Tooltip, FormControl, InputLabel, Select,
  useTheme, useMediaQuery, AppBar, Toolbar, Pagination, InputBase, Fade,
  Drawer, Accordion, AccordionSummary, AccordionDetails, Switch
} from '@mui/material';
import {
  Add as AddIcon, Download as DownloadIcon, Settings as SettingsIcon,
  CheckCircle as CheckIcon, CheckCircle, Delete as DeleteIcon, Refresh as RefreshIcon, Visibility as VisibilityIcon,
  FilterList as FilterListIcon, ExpandMore as ExpandMoreIcon, Info as InfoIcon,
  Tune as TuneIcon, Close as CloseIcon, KeyboardArrowLeft, KeyboardArrowRight, FirstPage, LastPage, AccessTime,
  PieChart as PieChartIcon, Link as LinkIcon,
  Fullscreen as FullscreenIcon, FullscreenExit as FullscreenExitIcon,
  Menu as MenuIcon, ViewColumn as ViewColumnIcon, TableChart as TableChartIcon
} from '@mui/icons-material';
import { pickingAPI, rackAPI, inboundAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import { StandardPageHeader, StandardTabs, BatchManagementTab, CustomerAutocomplete, WSNOverwriteDialog } from '@/components';
import type { WSNOverwriteDialogData } from '@/components';
import { useTableRowHeight } from '@/app/context/AppearanceContext';
import toast, { Toaster } from 'react-hot-toast';
// OPTIMIZED: XLSX loaded dynamically on export to reduce bundle size
// import * as XLSX from 'xlsx'; // Removed - loaded dynamically
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ClientSideRowModelModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import localforage from 'localforage';
// Simple localStorage-based grid state (native ag-Grid pattern)

// WMS Cache imports for instant WSN lookups
import {
  loadAvailableInventory,
  updateAvailableCacheSource,
  isCacheEnabled as isWMSCacheEnabled,
  enableCache as enableWMSCache,
  disableCache as disableWMSCache,
  getCacheStats,
} from '@/lib/wmsCache';

// Register AG Grid modules ONCE (include ClientSideRowModel for client-side features)
ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

// ⚡ WINDOW-LEVEL CACHE: Persists data outside React lifecycle for instant navigation
declare global {
  interface Window {
    __PICKING_LIST_CACHE__?: {
      data: any[];
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
const getCachedPickingListData = (): any[] => {
  const currentWarehouseId = getCurrentWarehouseId();

  // Priority 1: Window cache (fastest, survives navigation)
  if (typeof window !== 'undefined' && window.__PICKING_LIST_CACHE__?.data?.length) {
    // Only use cache if warehouse matches
    if (window.__PICKING_LIST_CACHE__.warehouseId === currentWarehouseId) {
      return window.__PICKING_LIST_CACHE__.data;
    }
  }
  // Priority 2: SessionStorage (survives page refresh) - skip if warehouse mismatch
  try {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('picking_list_cache');
      const savedWarehouseId = sessionStorage.getItem('picking_list_cache_warehouseId');
      if (saved && savedWarehouseId && parseInt(savedWarehouseId, 10) === currentWarehouseId) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Also populate window cache for faster subsequent access
          window.__PICKING_LIST_CACHE__ = { data: parsed, total: parsed.length, timestamp: Date.now(), warehouseId: currentWarehouseId };
          return parsed;
        }
      }
    }
  } catch { /* ignore */ }
  return [];
};

import { usePickingPermissions } from '@/hooks/usePagePermissions';
import { useFullscreen, useLiveSession } from '@/hooks';
import LiveViewPanel from '@/components/LiveViewPanel';

// Tab definitions with permission codes
const ALL_TABS = ['Picking List', 'Multi Picking', 'Batch Management'];
const TAB_CODES = ['list', 'multi', 'batches'];

// Format date helper
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

// Safe date-time formatter for display (returns '-' for invalid dates)
const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString();
};

// Date-only formatter: 28-Dec-2025 (no time)
const formatDateFull = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${day}-${mon}-${yyyy}`;
};


// ALL MASTER DATA COLUMNS
const ALL_MASTER_COLUMNS = [
  'wid', 'fsn', 'order_id', 'product_title', 'brand', 'mrp', 'fsp',
  'hsn_sac', 'igst_rate', 'cms_vertical', 'fkt_link', 'p_type', 'p_size',
  'vrp', 'yield_value', 'wh_location', 'fkqc_remark', 'fk_grade'
];
// DEFAULT VISIBLE COLUMNS FOR MULTI ENTRY
const DEFAULT_MULTI_COLUMNS = [
  'sno', 'wsn', 'product_serial_number', 'rack_no', 'picking_remarks', 'product_title', 'brand', 'cms_vertical',
  'fsp', 'mrp'
];

// EDITABLE COLUMNS IN MULTI ENTRY
const EDITABLE_COLUMNS = ['wsn', 'product_serial_number', 'rack_no', 'picking_remarks'];

// DEFAULT VISIBLE COLUMNS FOR PICKING LIST (includes master data columns)
const ALL_LIST_COLUMNS = [
  'wsn', 'product_title', 'brand', 'cms_vertical', 'fsp', 'mrp',
  'rack_no', 'batch_id', 'source', 'picking_date', 'customer_name',
  'picker_name', 'quantity', 'picking_remarks', 'other_remarks', 'created_user_name',
  'wid', 'fsn', 'order_id', 'hsn_sac', 'igst_rate', 'p_type', 'p_size',
  'vrp', 'yield_value', 'wh_location', 'fkqc_remark', 'fk_grade', 'invoice_date', 'fkt_link'
];

const DEFAULT_LIST_COLUMNS = [
  'wsn', 'product_title', 'brand', 'cms_vertical', 'fsp', 'mrp',
  'rack_no', 'batch_id', 'source', 'picking_date', 'customer_name', 'picker_name'
];

export default function PickingPage() {


  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);
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
  const multiRowsRef = useRef([] as any[]);

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

  // ⚡ EXCEL-LIKE: Undo/Redo support with batch operations
  interface UndoAction {
    type: 'cell' | 'paste' | 'fillDown' | 'batch';
    rowIndex: number;
    field: string;
    oldValue: any;
    newValue: any;
    oldRowData?: any;
    newRowData?: any;
    batchChanges?: Array<{
      rowIndex: number;
      field: string;
      oldValue: any;
      newValue: any;
    }>;
  }
  const MAX_UNDO_HISTORY = 100;
  const undoStackRef = useRef<UndoAction[]>([]);
  const redoStackRef = useRef<UndoAction[]>([]);

  // ⚡ EXCEL-LIKE: Selection statistics
  const [selectionStats, setSelectionStats] = useState<{
    sum: number;
    count: number;
    average: number;
    numericCount: number;
  } | null>(null);
  const selectionStatsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ⚡ EXCEL-LIKE: Previous selection bounds for smart refresh
  const prevSelectionBoundsRef = useRef<{ minRow: number; maxRow: number } | null>(null);

  // Get table row height from appearance settings
  const tableRowHeight = useTableRowHeight();

  // Permission hook
  const { filterTabs, canSeeTab, canSeeButton, canAccessButton, isAdmin, isLoading: permLoading } = usePickingPermissions();

  // Get visible tabs based on permissions
  const visibleTabs = useMemo(() => filterTabs(ALL_TABS, TAB_CODES), [filterTabs]);
  const visibleTabCodes = useMemo(() => {
    if (isAdmin) return TAB_CODES;
    return TAB_CODES.filter((code) => canSeeTab(code));
  }, [canSeeTab, isAdmin]);

  // Tab state
  const [tabValue, setTabValue] = useState(0);
  const currentTabCode = visibleTabCodes[tabValue];

  // Multi Entry Header state
  const [pickingDate, setPickingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customers, setCustomers] = useState<string[]>([]);
  const [pickerName, setPickerName] = useState<string>('');
  const [racks, setRacks] = useState<any[]>([]);

  // Load racks for warehouse
  const loadRacks = async () => {
    try {
      const res = await rackAPI.getByWarehouse(activeWarehouse?.id);
      const data = res.data || [];
      setRacks(data);
      if (!data || data.length === 0) {
        console.warn('No racks returned for warehouse', activeWarehouse?.id);
        toast('No racks configured for this warehouse', { duration: 3000, style: { background: '#fff3cd', color: '#856404', border: '1px solid #f59e0b' } });
      }
    } catch (error) {
      console.error('Failed to load racks', error);
      setRacks([]);
      toast.error('Failed to load racks');
    }
  };

  useEffect(() => {
    if (activeWarehouse) loadRacks();
  }, [activeWarehouse]);

  // Multi Entry state with AG Grid
  const rowIdCounterRef = useRef(0);
  const generateEmptyRows = (count: number) => {
    return Array.from({ length: count }, () => {
      rowIdCounterRef.current += 1;
      return {
        id: `row-${rowIdCounterRef.current}`,
        wsn: '',
        product_serial_number: '',
        picking_date: pickingDate,
        picking_remarks: '',
        product_title: '',
        brand: '',
        cms_vertical: '',
        fsp: '',
        mrp: '',
        rack_no: '',
        wid: '',
        fsn: '',
        order_id: '',
        fkqc_remark: '',
        fk_grade: '',
        hsn_sac: '',
        igst_rate: '',
        invoice_date: '',
        fkt_link: '',
        wh_location: '',
        vrp: '',
        yield_value: '',
        p_type: '',
        p_size: '',
        source: '',
        customer_name: selectedCustomer || '',
        picker_name: pickerName || ''
      };
    });
  };

  const [multiRows, setMultiRows] = useState<any[]>(generateEmptyRows(500));
  const [existingWSNs, setExistingWSNs] = useState<string[]>([]);
  const [multiLoading, setMultiLoading] = useState(false);

  // ====== LIVE VIEW SESSION MANAGEMENT ======
  const isOnMultiTab = visibleTabCodes[tabValue] === 'multi'; // Use tab code, not index
  const { startSession: startLiveSession, updateEntries: updateLiveEntries, endSession: endLiveSession, isActive: isLiveSessionActive } = useLiveSession({
    warehouseId: activeWarehouse?.id,
    pageType: 'picking',
    enabled: isOnMultiTab && !!activeWarehouse?.id,
  });

  // Auto-start live session when entering Multi Picking tab
  useEffect(() => {
    if (isOnMultiTab && activeWarehouse?.id && !isLiveSessionActive) {
      startLiveSession();
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
          rack_no: row.rack_no || '',
          product_serial_number: row.product_serial_number || '',
          row_index: idx,
        }))
        .filter(e => e.wsn.trim());
      updateLiveEntries(validEntries);
    }
  }, [multiRows, isLiveSessionActive, isOnMultiTab, updateLiveEntries]);

  // ====== MULTI PICKING COLUMN WIDTHS PERSISTENCE ======
  const [multiColumnWidths, setMultiColumnWidths] = useState<Record<string, number>>({});

  // Column widths are now managed directly by AG Grid via localStorage

  // Load Multi Picking column widths from localStorage on mount
  useEffect(() => {
    const savedWidths = localStorage.getItem('pickingMultiEntryColumnWidths');
    if (savedWidths) {
      try {
        const widths = JSON.parse(savedWidths);
        setMultiColumnWidths(widths);
        console.log('✅ Picking Multi column widths loaded:', widths);
      } catch (e) {
        console.log('Failed to parse Picking Multi column widths');
      }
    }
  }, []);

  // ---- Draft / Autosave (IndexedDB via localForage) ----
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftExists, setDraftExists] = useState(false);
  const lastChangeAtRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('pickingMultiEntryColumns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as string[];
        // Ensure 'sno' is first
        if (!parsed.includes('sno')) parsed.unshift('sno');
        // Ensure product_serial_number is present after wsn
        if (!parsed.includes('product_serial_number')) {
          const wsnIndex = parsed.indexOf('wsn');
          const insertAt = wsnIndex >= 0 ? wsnIndex + 1 : 1;
          parsed.splice(insertAt, 0, 'product_serial_number');
        }
        // Ensure rack_no is present after product_serial_number
        if (!parsed.includes('rack_no')) {
          const psIndex = parsed.indexOf('product_serial_number');
          const insertAt = psIndex >= 0 ? psIndex + 1 : 2;
          parsed.splice(insertAt, 0, 'rack_no');
        }
        return parsed;
      } catch (e) {
        return DEFAULT_MULTI_COLUMNS;
      }
    }
    return DEFAULT_MULTI_COLUMNS;
  });

  // Persist visible columns so new users and existing users see the same defaults
  useEffect(() => {
    try {
      localStorage.setItem('pickingMultiEntryColumns', JSON.stringify(visibleColumns));
    } catch (e) {
      // ignore
    }
  }, [visibleColumns]);

  // ------------------ Draft helpers & autosave ------------------
  const getDraftKey = () => {
    if (!activeWarehouse?.id || !user?.id) return null;
    return `pickingMultiDraft_${activeWarehouse.id}_${user.id}`;
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
      console.error('Failed to save picking draft', err);
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
      console.error('Failed to clear picking draft', err);
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
          const restored = draft.rows.map((r: any) => ({
            picking_date: r.picking_date || pickingDate,
            customer_name: r.customer_name || selectedCustomer,
            picker_name: r.picker_name || pickerName,
            ...r,
          }));
          setMultiRows(restored);
          setDraftSavedAt(draft.savedAt || Date.now());
          setDraftExists(true);
          // toast.success('Draft restored');
        }
      } catch (err) {
        console.error('Failed to load picking draft', err);
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

  // Track if Multi Picking grid has been initialized (to avoid resetting saved widths)
  const multiGridInitializedRef = useRef(false);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  // Settings Panel state for Multi Picking
  const [pickingSettingsPanelOpen, setPickingSettingsPanelOpen] = useState(false);
  const [settingsPanelExpanded, setSettingsPanelExpanded] = useState<string | false>('columns');
  const [gridDuplicateWSNs, setGridDuplicateWSNs] = useState<Set<string>>(new Set());
  const [crossWarehouseWSNs, setCrossWarehouseWSNs] = useState<Set<string>>(new Set());
  const [existingPickingWSNs, setExistingPickingWSNs] = useState(new Set());

  // ====== AVAILABLE CACHE STATE (wmsCache - for Picking) ======
  const [availableCacheEnabled, setAvailableCacheEnabled] = useState(false);
  const [availableCacheStats, setAvailableCacheStats] = useState<{ count: number; lastSync: number | null } | null>(null);
  const [availableCacheLoading, setAvailableCacheLoading] = useState(false);
  const [availableCacheProgress, setAvailableCacheProgress] = useState('');

  // ====== WSN OVERWRITE DIALOG STATE ======
  const [wsnOverwriteDialog, setWsnOverwriteDialog] = useState<WSNOverwriteDialogData | null>(null);
  const pendingWSNRef = useRef<{ wsn: string; rowIndex: number; event: any } | null>(null);

  // ====== MULTI ENTRY: CTRL+O PRODUCT LINK SHORTCUT STATE ======
  const [ctrlOProductLinkEnabled, setCtrlOProductLinkEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('picking_ctrlOProductLinkEnabled');
      return saved !== 'false'; // Default to true
    }
    return true;
  });

  // Track last scanned row data for Ctrl+O
  const lastScannedRowRef = useRef<any>(null);
  // Ref for instant Ctrl+O toggle (avoids stale closure)
  const ctrlOProductLinkEnabledRef = useRef(ctrlOProductLinkEnabled);

  // ====== MULTI ENTRY: GRID SETTINGS ======
  const [multiGridSettings, setMultiGridSettings] = useState({
    sortable: true,
    filter: true,
    resizable: true,
    editable: true,
  });
  const [multiGridSettingsOpen, setMultiGridSettingsOpen] = useState(false);

  // Load Multi Entry grid settings from localStorage
  useEffect(() => {
    const savedMultiSettings = localStorage.getItem('picking_multi_grid_settings');
    if (savedMultiSettings) {
      try {
        const parsed = JSON.parse(savedMultiSettings);
        setMultiGridSettings(parsed);
      } catch (e) {
        console.log('Failed to parse multi grid settings');
      }
    }
  }, []);

  // Save Multi Entry grid settings
  const updateMultiGridSettings = (newSettings: typeof multiGridSettings) => {
    setMultiGridSettings(newSettings);
    localStorage.setItem('picking_multi_grid_settings', JSON.stringify(newSettings));
  };

  // ====== MULTI ENTRY: CATEGORY PIVOT DIALOG ======
  const [categoryPivotOpen, setCategoryPivotOpen] = useState(false);
  const [pivotGroupBy, setPivotGroupBy] = useState<'category' | 'brand'>('category');
  const [categoryPivotSortBy, setCategoryPivotSortBy] = useState<'category' | 'qty' | 'fsp' | 'mrp'>('qty');
  const [categoryPivotSortDir, setCategoryPivotSortDir] = useState<'asc' | 'desc'>('desc');

  // Picking List state
  // ⚡ INSTANT NAVIGATION: Initialize from cache to prevent empty grid flash
  const [pickingList, setPickingList] = useState<any[]>(() => getCachedPickingListData());
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(() => getCachedPickingListData().length === 0);
  const [dataResponseReceived, setDataResponseReceived] = useState(() => getCachedPickingListData().length > 0);
  // ⚡ PREVENT COLUMN RESIZE FLASH: Hide grid body until columns are auto-sized
  const [gridDataRendered, setGridDataRendered] = useState(false);

  // ⚡ SYNCHRONOUS MOUNT: Load cache BEFORE paint for instant display
  useLayoutEffect(() => {
    const cached = getCachedPickingListData();
    if (cached.length > 0) {
      setPickingList(cached);
      setLoading(false);
      setDataResponseReceived(true);
    }
  }, []);

  const [isFetching, setIsFetching] = useState(false);
  // Local refresh button state (non-blocking)
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [pickingCustomers, setPickingCustomers] = useState<string[]>([]);

  // Load customers from picking table (for filter dropdown - only customers with picking entries)
  const loadPickingCustomers = async () => {
    try {
      const response = await pickingAPI.getPickingCustomers(activeWarehouse?.id);
      if (Array.isArray(response.data)) {
        setPickingCustomers(response.data);
      } else {
        setPickingCustomers([]);
      }
    } catch (error) {
      console.error('Failed to load picking customers:', error);
      setPickingCustomers([]);
    }
  };
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // ====== LIST OPTIONS PANEL STATE ======
  const [listOptionsPanelOpen, setListOptionsPanelOpen] = useState(false);
  const [listSettingsPanelExpanded, setListSettingsPanelExpanded] = useState<string | false>('filters');

  // Mobile actions dialog state (kept for backward compatibility, but now uses Options Panel)
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';

  // Smooth loading helpers (prevent blinking overlay)
  const currentLoadIdRef = useRef(0);
  const pickingAbortControllerRef = useRef<AbortController | null>(null);
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const overlayShownRef = useRef(false);
  const overlayStartRef = useRef<number | null>(null);
  const emptyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const SHOW_OVERLAY_DELAY = 50; // ms - reduced to show animation faster
  const MIN_LOADING_MS = 350; // ms
  const EMPTY_CONFIRM_DELAY = 400; // ms
  const [topLoading, setTopLoading] = useState(false);
  const previousDataRef = useRef<any[] | null>(null);

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

  // Grid Settings (persisted)
  const [enableSorting, setEnableSorting] = useState<boolean>(() => {
    try { return localStorage.getItem('picking_enableSorting') !== 'false'; } catch { return true; }
  });
  const [enableColumnFilters, setEnableColumnFilters] = useState<boolean>(() => {
    try { return localStorage.getItem('picking_enableColumnFilters') !== 'false'; } catch { return true; }
  });
  const [enableColumnResize, setEnableColumnResize] = useState<boolean>(() => {
    try { return localStorage.getItem('picking_enableColumnResize') !== 'false'; } catch { return true; }
  });
  const [enableCellEditing, setEnableCellEditing] = useState<boolean>(() => {
    try { return localStorage.getItem('picking_enableCellEditing') !== 'false'; } catch { return true; }
  });
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);

  const filtersActive = Boolean(
    (searchFilter && searchFilter.trim() !== '') ||
    (brandFilter && brandFilter !== '') ||
    (categoryFilter && categoryFilter !== '') ||
    (sourceFilter && sourceFilter !== '') ||
    (customerFilter && customerFilter !== '') ||
    (startDateFilter && startDateFilter !== '') ||
    (endDateFilter && endDateFilter !== '')
  );

  // Default: filters collapsed by default on Picking List tab
  useEffect(() => {
    // Start collapsed on mount
    setFiltersExpanded(false);
  }, []);

  // Ensure filters are collapsed whenever user navigates to the Picking List tab (tab index 0)
  useEffect(() => {
    if (tabValue === 0) {
      setFiltersExpanded(false);
    }
  }, [tabValue]);

  type ColumnConfig = {
    key: string;
    visible: boolean;
  };

  const DEFAULT_LIST_COLUMNS_CONFIG: ColumnConfig[] = ALL_LIST_COLUMNS.map(col => ({
    key: col,
    visible: DEFAULT_LIST_COLUMNS.includes(col),
  }));

  // Use simple string array for list columns (matching outbound pattern)
  const [listColumns, setListColumns] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pickingListColumns');
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
    // Default: show most important columns
    return DEFAULT_LIST_COLUMNS;
  });
  const [listColumnSettingsOpen, setListColumnSettingsOpen] = useState(false);

  // Batch Management state
  const [batches, setBatches] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Export Dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportCustomer, setExportCustomer] = useState('');
  const [exportBatchIds, setExportBatchIds] = useState<string[]>([]);

  // ====== AVAILABLE CACHE INIT ======
  useEffect(() => {
    // Initialize cache state from wmsCache
    setAvailableCacheEnabled(isWMSCacheEnabled());

    // Load cache stats asynchronously
    const loadStats = async () => {
      if (activeWarehouse?.id) {
        const stats = await getCacheStats(activeWarehouse.id);
        if (stats?.available?.count) {
          setAvailableCacheStats({ count: stats.available.count, lastSync: stats.available.lastSync || Date.now() });
        }
      }
    };
    loadStats();
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

  // Auth check
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(storedUser);
    setPickerName(storedUser?.fullName || storedUser?.username || '');
  }, [router]);

  // Fetch all existing picked WSNs on mount
  useEffect(() => {
    async function fetchExistingWSNs() {
      try {
        const res = await pickingAPI.getExistingWSNs(activeWarehouse?.id);
        setExistingPickingWSNs(new Set(res.data));
      } catch (error) {
        console.error('Failed to fetch existing picking WSNs', error);
      }
    }
    if (activeWarehouse) {
      fetchExistingWSNs();
    }
  }, [activeWarehouse]);

  // Load existing WSNs and customers on mount
  useEffect(() => {
    if (activeWarehouse) {
      loadCustomers();
    }
  }, [activeWarehouse]);

  // ✅ Debounce search filter (300ms delay for smooth performance)
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

  // Load picking list when filters change
  useEffect(() => {
    if (activeWarehouse && currentTabCode === 'list') {
      loadPickingList();
    }
  }, [activeWarehouse, currentTabCode, page, limit, searchDebounced, brandFilter, categoryFilter, sourceFilter, customerFilter, startDateFilter, endDateFilter]);

  // Load batches when batch tab opens
  useEffect(() => {
    if (activeWarehouse && currentTabCode === 'batches') {
      loadBatches();
    }
  }, [activeWarehouse, currentTabCode]);

  // ✅ Load brands, categories, and picking customers from database when component mounts or warehouse changes
  useEffect(() => {
    if (activeWarehouse) {
      loadBrands();
      loadCategories();
      loadPickingCustomers();
    }
  }, [activeWarehouse]);

  // Load list columns from localStorage with validation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pickingListColumns');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const valid = parsed.filter((col: string) => ALL_LIST_COLUMNS.includes(col));
          if (valid.length > 0) {
            setListColumns(valid);
          }
        } catch (e) {
          // Keep default
        }
      }
    }
  }, []);

  // Grid settings persisted
  useEffect(() => {
    try {
      const s = localStorage.getItem('picking_enableSorting');
      const f = localStorage.getItem('picking_enableColumnFilters');
      const r = localStorage.getItem('picking_enableColumnResize');
      const e = localStorage.getItem('picking_enableCellEditing');
      if (s !== null) setEnableSorting(s === 'true');
      if (f !== null) setEnableColumnFilters(f === 'true');
      if (r !== null) setEnableColumnResize(r === 'true');
      if (e !== null) setEnableCellEditing(e === 'true');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('picking_enableSorting', String(enableSorting));
      localStorage.setItem('picking_enableColumnFilters', String(enableColumnFilters));
      localStorage.setItem('picking_enableColumnResize', String(enableColumnResize));
      localStorage.setItem('picking_enableCellEditing', String(enableCellEditing));
    } catch { }
  }, [enableSorting, enableColumnFilters, enableColumnResize, enableCellEditing]);

  // Load customers from customers table
  const loadCustomers = async () => {
    try {
      const response = await pickingAPI.getCustomers(activeWarehouse?.id);
      if (Array.isArray(response.data)) {
        setCustomers(response.data);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Load customers error:', error);
      toast.error('Failed to load customers');
      setCustomers([]);
    }
  };

  // Check for duplicates in grid
  const checkDuplicates = useCallback((rows: any[]) => {
    const gridDup = new Set<string>();
    const crossWh = new Set<string>();
    const wsnCounts = new Map<string, number>();

    rows.forEach((row) => {
      const wsn = row.wsn?.trim()?.toUpperCase();
      if (!wsn) return;

      // Grid duplicate counting
      wsnCounts.set(wsn, (wsnCounts.get(wsn) || 0) + 1);
      if (wsnCounts.get(wsn)! > 1) {
        gridDup.add(wsn);
      }

      // Check if already picked (any warehouse)
      if (existingPickingWSNs.has(wsn)) {
        crossWh.add(wsn);
      }
    });

    setGridDuplicateWSNs(gridDup);
    setCrossWarehouseWSNs(crossWh);
  }, [existingPickingWSNs]);

  // Navigate to next cell in AG Grid
  const navigateToNextCell = useCallback((params: any) => {
    const { previousCellPosition, nextCellPosition, key } = params;

    if (key === 'Enter') {
      const currentCol = previousCellPosition.column.getColId();
      const currentRow = previousCellPosition.rowIndex;

      if (currentCol === visibleColumns[visibleColumns.length - 1]) {
        // Last column -> move to first column of next row
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

  // ⚡ EXCEL-LIKE: Update selection bounds when selection changes
  useEffect(() => {
    selectedRangeRef.current = selectedRange;

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
          colIndexMap,
        };

        // ⚡ PERFORMANCE: Debounce selection statistics calculation (50ms)
        if (selectionStatsTimeoutRef.current) {
          clearTimeout(selectionStatsTimeoutRef.current);
        }
        selectionStatsTimeoutRef.current = setTimeout(() => {
          const minRow = Math.min(selectedRange.startRow, selectedRange.endRow);
          const maxRow = Math.max(selectedRange.startRow, selectedRange.endRow);
          const minCol = Math.min(startColIndex, endColIndex);
          const maxCol = Math.max(startColIndex, endColIndex);

          const numericColumns = ['fsp', 'mrp', 'vrp', 'igst_rate', 'yield_value'];
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
              sum: Math.round(sum * 100) / 100,
              count,
              average: Math.round((sum / numericCount) * 100) / 100,
              numericCount,
            });
          } else {
            setSelectionStats(null);
          }
        }, 50);
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

  // ⚡ EXCEL-LIKE: Optimized refresh - only refresh affected rows instead of entire grid
  useEffect(() => {
    const api = gridRef.current;
    if (!api) return;

    requestAnimationFrame(() => {
      const bounds = selectionBoundsRef.current;
      const prevBounds = prevSelectionBoundsRef.current;

      const rowsToRefresh = new Set<number>();

      if (bounds) {
        for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
          rowsToRefresh.add(r);
        }
      }

      if (prevBounds) {
        for (let r = prevBounds.minRow; r <= prevBounds.maxRow; r++) {
          rowsToRefresh.add(r);
        }
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

    setSelectedRange({
      startRow: 0,
      endRow: totalRows - 1,
      startCol: firstCol,
      endCol: lastCol,
    });

    rangeStartCellRef.current = { rowIndex: 0, colId: firstCol };
    toast('All rows selected', { icon: '🚫', duration: 1500 });
  }, []);

  // ⚡ EXCEL-LIKE: Save cell-level undo action
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
      oldRowData,
      newRowData,
    };
    undoStackRef.current.push(action);
    if (undoStackRef.current.length > MAX_UNDO_HISTORY) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
  }, []);

  // Master data columns that get auto-populated when WSN is entered
  const MASTER_DATA_COLUMNS = [
    'source', 'product_title', 'brand', 'cms_vertical', 'wid', 'fsn',
    'order_id', 'fkqc_remark', 'fk_grade', 'hsn_sac', 'igst_rate',
    'fsp', 'mrp', 'vrp', 'yield_value', 'invoice_date', 'fkt_link',
    'wh_location', 'p_type', 'p_size', 'rack_no', 'product_serial_number'
  ];

  // ⚡ UNDO: Handle undo (Ctrl+Z) - supports batch operations
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) {
      toast('Nothing to undo', { icon: '🚫', duration: 500 });
      return;
    }

    const action = undoStackRef.current.pop()!;

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

      redoStackRef.current.push({
        ...action,
        oldValue: action.newValue,
        newValue: action.oldValue,
        oldRowData: currentRowData,
        newRowData: action.oldRowData,
      });

      return newRows;
    });

    setTimeout(() => {
      const api = gridRef.current;
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
      toast('Nothing to redo', { icon: '🚫', duration: 1500 });
      return;
    }

    const action = redoStackRef.current.pop()!;

    setMultiRows(currentRows => {
      const newRows = [...currentRows];

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
        if (action.newRowData) {
          newRows[action.rowIndex] = { ...action.newRowData };
        } else {
          newRows[action.rowIndex] = {
            ...newRows[action.rowIndex],
            [action.field]: action.newValue
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
      const api = gridRef.current;
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

  // ⚡ EXCEL-LIKE: Copy selected cells (Ctrl+C)
  const handleCopy = useCallback(async () => {
    const api = gridRef.current;
    if (!api) return;

    const range = selectedRangeRef.current;
    let textToCopy = '';

    if (!range) {
      const focusedCell = api.getFocusedCell();
      if (!focusedCell) return;
      const { rowIndex, column } = focusedCell;
      const colId = column.getColId();
      const rowNode = api.getDisplayedRowAtIndex(rowIndex);
      textToCopy = rowNode?.data?.[colId]?.toString() || '';
    } else {
      const minRow = Math.min(range.startRow, range.endRow);
      const maxRow = Math.max(range.startRow, range.endRow);
      const allColumns = api.getAllDisplayedColumns?.() || [];
      const colIds = allColumns.map((c: any) => c.getColId());
      const startColIndex = colIds.indexOf(range.startCol);
      const endColIndex = colIds.indexOf(range.endCol);
      const minCol = Math.min(startColIndex, endColIndex);
      const maxCol = Math.max(startColIndex, endColIndex);

      const lines: string[] = [];
      for (let r = minRow; r <= maxRow; r++) {
        const rowNode = api.getDisplayedRowAtIndex(r);
        const cells: string[] = [];
        for (let c = minCol; c <= maxCol; c++) {
          const colId = colIds[c];
          cells.push(rowNode?.data?.[colId]?.toString() || '');
        }
        lines.push(cells.join('\t'));
      }
      textToCopy = lines.join('\n');
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      const cellCount = range ? (Math.abs(range.endRow - range.startRow) + 1) * (Math.abs(api.getAllDisplayedColumns().findIndex((c: any) => c.getColId() === range.endCol) - api.getAllDisplayedColumns().findIndex((c: any) => c.getColId() === range.startCol)) + 1) : 1;
      toast.success(`Copied ${cellCount} cell${cellCount > 1 ? 's' : ''}`, { duration: 1000 });
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  }, []);

  // ⚡ EXCEL-LIKE: Paste with ultra-fast parallel WSN lookups (Ctrl+V)
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;

      const api = gridRef.current;
      if (!api) return;

      const focusedCell = api.getFocusedCell();
      if (!focusedCell) {
        toast.error('Click a cell first to paste');
        return;
      }

      const startRowIndex = focusedCell.rowIndex;
      const startColId = focusedCell.column.getColId();

      const allColumns = api.getAllDisplayedColumns() || [];
      const colIds = allColumns.map((c: any) => c.getColId());
      const startColIndex = colIds.indexOf(startColId);

      if (startColIndex === -1) return;

      const lines = text.split('\n').filter(line => line.trim() !== '');
      const newRows = [...multiRowsRef.current];
      let pastedCount = 0;
      const pastedWSNRows: Array<{ rowIndex: number; wsn: string }> = [];
      const batchChanges: Array<{ rowIndex: number; field: string; oldValue: any; newValue: any }> = [];

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const cells = lines[lineIndex].split('\t');
        const targetRowIndex = startRowIndex + lineIndex;

        if (targetRowIndex >= newRows.length) {
          const additionalRows = generateEmptyRows(targetRowIndex - newRows.length + 100);
          newRows.push(...additionalRows);
        }

        for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
          const targetColIndex = startColIndex + cellIndex;
          if (targetColIndex >= colIds.length) continue;

          const colId = colIds[targetColIndex];
          if (!EDITABLE_COLUMNS.includes(colId)) continue;

          let pastedValue = cells[cellIndex]?.trim() || '';
          if (colId === 'wsn') {
            pastedValue = pastedValue.toUpperCase();
          }

          const oldValue = newRows[targetRowIndex]?.[colId] || '';
          batchChanges.push({
            rowIndex: targetRowIndex,
            field: colId,
            oldValue,
            newValue: pastedValue,
          });

          newRows[targetRowIndex] = {
            ...newRows[targetRowIndex],
            [colId]: pastedValue,
          };
          pastedCount++;

          if (colId === 'wsn' && pastedValue) {
            pastedWSNRows.push({ rowIndex: targetRowIndex, wsn: pastedValue });
          }
        }
      }

      if (pastedCount > 0) {
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

        // ⚡ ULTRA-FAST PARALLEL WSN LOOKUPS
        if (pastedWSNRows.length > 0 && activeWarehouse?.id) {
          const toastId = toast.loading(`Loading ${pastedWSNRows.length} WSNs...`);

          const BATCH_SIZE = 100;
          const CONCURRENT_BATCHES = 10;
          let successCount = 0;
          let failCount = 0;
          let processedCount = 0;

          const lookupWSN = async (rowIndex: number, wsn: string): Promise<{ rowIndex: number; data: any | null }> => {
            try {
              const res = await pickingAPI.getSourceByWSN(wsn, activeWarehouse.id);
              return { rowIndex, data: res.data };
            } catch {
              try {
                const inboundResp = await inboundAPI.getMasterDataByWSN(wsn);
                return { rowIndex, data: inboundResp.data };
              } catch {
                return { rowIndex, data: null };
              }
            }
          };

          const batches: Array<typeof pastedWSNRows> = [];
          for (let i = 0; i < pastedWSNRows.length; i += BATCH_SIZE) {
            batches.push(pastedWSNRows.slice(i, i + BATCH_SIZE));
          }

          const allResults: Array<{ rowIndex: number; data: any }> = [];

          for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
            const concurrentBatches = batches.slice(i, i + CONCURRENT_BATCHES);
            const batchPromises = concurrentBatches.map(batch =>
              Promise.all(batch.map(({ rowIndex, wsn }) => lookupWSN(rowIndex, wsn)))
            );
            const batchResults = await Promise.all(batchPromises);
            for (const results of batchResults) {
              allResults.push(...results);
            }
            processedCount += concurrentBatches.reduce((sum, b) => sum + b.length, 0);
            toast.loading(`Loading ${processedCount}/${pastedWSNRows.length} WSNs...`, { id: toastId });
          }

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
                  rack_no: data.rack_no || '',
                });
                successCount++;
              }
            } else {
              failCount++;
            }
          }

          updatedRowsMap.forEach((data, rowIndex) => {
            const rowNode = api.getDisplayedRowAtIndex(rowIndex);
            if (rowNode) {
              rowNode.setData(data);
            }
          });

          const updatedRows: any[] = [];
          api.forEachNode((node: any) => { if (node.data) updatedRows.push(node.data); });
          setMultiRows(updatedRows);

          toast.dismiss(toastId);
          if (successCount > 0) {
            toast.success(`Loaded ${successCount}/${pastedWSNRows.length} WSNs`, { duration: 2000 });
          }
          if (failCount > 0) {
            toast.error(`${failCount} WSNs not found`, { duration: 2000 });
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        toast.error('Clipboard access denied');
      } else {
        toast.error('Failed to paste');
      }
    }
  }, [activeWarehouse]);

  // ⚡ EXCEL-LIKE: Fill Down (Ctrl+D)
  const handleFillDown = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    const range = selectedRangeRef.current;
    if (!range) {
      toast('Select a range first', { icon: '🚫', duration: 1500 });
      return;
    }

    const minRow = Math.min(range.startRow, range.endRow);
    const maxRow = Math.max(range.startRow, range.endRow);

    if (minRow === maxRow) {
      toast('Need at least 2 rows for Fill Down', { icon: '🚫', duration: 1500 });
      return;
    }

    const allColumns = api.getAllDisplayedColumns?.() || [];
    const colIds = allColumns.map((c: any) => c.getColId());
    const startColIndex = colIds.indexOf(range.startCol);
    const endColIndex = colIds.indexOf(range.endCol);
    const minCol = Math.min(startColIndex, endColIndex);
    const maxCol = Math.max(startColIndex, endColIndex);

    const newRows = [...multiRowsRef.current];
    let filledCount = 0;

    for (let c = minCol; c <= maxCol; c++) {
      const colId = colIds[c];
      if (!EDITABLE_COLUMNS.includes(colId)) continue;

      const sourceValue = newRows[minRow]?.[colId] || '';
      for (let r = minRow + 1; r <= maxRow; r++) {
        if (newRows[r]?.[colId] !== sourceValue) {
          newRows[r] = { ...newRows[r], [colId]: sourceValue };
          filledCount++;
        }
      }
    }

    if (filledCount > 0) {
      setMultiRows(newRows);
      api.refreshCells({ force: true });
      toast.success(`Filled ${filledCount} cells`, { duration: 1500 });
    }
  }, []);

  // ⚡ EXCEL-LIKE: Go to first cell (Ctrl+Home)
  const handleGoToFirst = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    setSelectedRange(null);
    rangeStartCellRef.current = null;

    const allColumns = api.getAllDisplayedColumns() || [];
    const firstEditableCol = allColumns.find((c: any) => EDITABLE_COLUMNS.includes(c.getColId()));
    const colId = firstEditableCol?.getColId() || 'wsn';

    api.ensureIndexVisible(0, 'top');
    api.setFocusedCell(0, colId);
  }, []);

  // ⚡ EXCEL-LIKE: Go to last cell with data (Ctrl+End)
  const handleGoToLast = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    setSelectedRange(null);
    rangeStartCellRef.current = null;

    let lastRowWithData = 0;
    for (let i = multiRowsRef.current.length - 1; i >= 0; i--) {
      const row = multiRowsRef.current[i];
      if (row?.wsn?.trim()) {
        lastRowWithData = i;
        break;
      }
    }

    const allColumns = api.getAllDisplayedColumns() || [];
    const editableColIds = allColumns.map((c: any) => c.getColId()).filter((id: string) => EDITABLE_COLUMNS.includes(id));
    const lastCol = editableColIds[editableColIds.length - 1] || 'wsn';

    api.ensureIndexVisible(lastRowWithData, 'bottom');
    api.setFocusedCell(lastRowWithData, lastCol);
  }, []);

  // ⚡ EXCEL-LIKE: Keyboard shortcuts for Multi Picking tab
  useEffect(() => {
    if (currentTabCode !== 'multi') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrlKey = e.ctrlKey || e.metaKey;
      const shiftKey = e.shiftKey;

      const activeEl = document.activeElement;
      const isEditing = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' ||
        (activeEl?.classList?.contains('ag-input-field-input'));

      // Ctrl+O -> Open product link for last scanned WSN
      if (ctrlKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        e.stopPropagation();

        // Use ref for instant toggle effect (no stale closure)
        if (!ctrlOProductLinkEnabledRef.current) {
          toast('Ctrl+O shortcut is disabled', { icon: '🚫', duration: 1500 });
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

      // Ctrl+Z - Undo
      if (ctrlKey && !shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z - Redo
      if ((ctrlKey && e.key.toLowerCase() === 'y') || (ctrlKey && shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl+C - Copy
      if (ctrlKey && e.key.toLowerCase() === 'c' && !isEditing) {
        e.preventDefault();
        handleCopy();
        return;
      }

      // Ctrl+V - Paste
      if (ctrlKey && e.key.toLowerCase() === 'v' && !isEditing) {
        e.preventDefault();
        handlePaste();
        return;
      }

      // Ctrl+D - Fill Down
      if (ctrlKey && e.key.toLowerCase() === 'd' && !isEditing) {
        e.preventDefault();
        handleFillDown();
        return;
      }

      // Ctrl+Home - Go to first cell
      if (ctrlKey && e.key === 'Home' && !isEditing) {
        e.preventDefault();
        handleGoToFirst();
        return;
      }

      // Ctrl+End - Go to last cell with data
      if (ctrlKey && e.key === 'End' && !isEditing) {
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

      // Escape - Clear selection or cancel editing
      if (e.key === 'Escape') {
        if (selectedRangeRef.current) {
          setSelectedRange(null);
          rangeStartCellRef.current = null;
          gridRef.current?.refreshCells({ force: true });
        }
        return;
      }

      // F2 - Enter edit mode
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

      // ⚡ EXCEL-LIKE: Ctrl+Arrow - Jump to last cell with data in direction
      if (ctrlKey && !shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditing) {
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
        const currentColIndex = colIds.indexOf(colId);

        let targetRow = rowIndex;
        let targetColIndex = currentColIndex;

        if (e.key === 'ArrowDown') {
          for (let r = multiRowsRef.current.length - 1; r > rowIndex; r--) {
            if (multiRowsRef.current[r]?.[colId]?.toString().trim()) {
              targetRow = r;
              break;
            }
          }
          if (targetRow === rowIndex) targetRow = multiRowsRef.current.length - 1;
        } else if (e.key === 'ArrowUp') {
          for (let r = 0; r < rowIndex; r++) {
            if (multiRowsRef.current[r]?.[colId]?.toString().trim()) {
              targetRow = r;
              break;
            }
          }
          if (targetRow === rowIndex) targetRow = 0;
        } else if (e.key === 'ArrowRight') {
          targetColIndex = colIds.length - 1;
        } else if (e.key === 'ArrowLeft') {
          targetColIndex = 1;
        }

        setSelectedRange(null);
        rangeStartCellRef.current = null;
        api.setFocusedCell(targetRow, colIds[targetColIndex]);
        api.ensureIndexVisible(targetRow, 'middle');
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
        const currentColIndex = colIds.indexOf(colId);

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

      // Arrow keys without Shift - Clear selection and move
      if (!shiftKey && !ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditing) {
        if (selectedRangeRef.current) {
          setSelectedRange(null);
          rangeStartCellRef.current = null;
        }
        return;
      }

      // Shift+Arrow keys - Extend selection
      if (shiftKey && !ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditing) {
        const api = gridRef.current;
        if (!api) return;

        const focusedCell = api.getFocusedCell();
        if (!focusedCell) return;

        e.preventDefault();

        const { rowIndex, column } = focusedCell;
        const colId = column.getColId();

        if (!rangeStartCellRef.current) {
          rangeStartCellRef.current = { rowIndex, colId };
        }

        const allColumns = api.getAllDisplayedColumns() || [];
        const colIds = allColumns.map((c: any) => c.getColId());
        const currentColIndex = colIds.indexOf(colId);

        let newRowIndex = rowIndex;
        let newColIndex = currentColIndex;

        if (e.key === 'ArrowUp') newRowIndex = Math.max(0, rowIndex - 1);
        if (e.key === 'ArrowDown') newRowIndex = Math.min(multiRowsRef.current.length - 1, rowIndex + 1);
        if (e.key === 'ArrowLeft') newColIndex = Math.max(0, currentColIndex - 1);
        if (e.key === 'ArrowRight') newColIndex = Math.min(colIds.length - 1, currentColIndex + 1);

        const newColId = colIds[newColIndex];

        setSelectedRange({
          startRow: rangeStartCellRef.current.rowIndex,
          endRow: newRowIndex,
          startCol: rangeStartCellRef.current.colId,
          endCol: newColId,
        });

        api.setFocusedCell(newRowIndex, newColId);
        api.ensureIndexVisible(newRowIndex, 'middle');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTabCode, handleSelectAll, handleClearCells, handleUndo, handleRedo, handleCopy, handlePaste, handleFillDown, handleGoToFirst, handleGoToLast]);

  // Add new rows
  const add500Rows = () => {
    setMultiRows([...multiRows, ...generateEmptyRows(500)]);
  };

  // ⚡ MULTI ENTRY: Export entered data to Excel with ALL columns
  const exportMultiEntryToExcel = async () => {
    try {
      // Filter by customer if selected, otherwise export all
      let dataToExport = multiRows.filter((row: any) => row.wsn?.trim());

      // Apply customer filter if customer is selected in header
      if (selectedCustomer) {
        dataToExport = dataToExport.filter((row: any) =>
          row.customer_name === selectedCustomer || !row.customer_name
        );
      }

      if (dataToExport.length === 0) {
        toast.error('No data to export');
        return;
      }
      const XLSX = await import('xlsx');
      const exportData = dataToExport.map((row: any, idx: number) => ({
        'S.No': idx + 1,
        'WSN': row.wsn || '',
        'Product Serial': row.product_serial_number || '',
        'Rack No': row.rack_no || '',
        'Picking Date': row.picking_date || pickingDate || '',
        'Customer': row.customer_name || selectedCustomer || '',
        'Picker': row.picker_name || pickerName || '',
        'Picking Remarks': row.picking_remarks || '',
        'Product Title': row.product_title || '',
        'Brand': row.brand || '',
        'Category': row.cms_vertical || '',
        'FSP': row.fsp || '',
        'MRP': row.mrp || '',
        'VRP': row.vrp || '',
        'WID': row.wid || '',
        'FSN': row.fsn || '',
        'Order ID': row.order_id || '',
        'HSN/SAC': row.hsn_sac || '',
        'IGST Rate': row.igst_rate || '',
        'Product Type': row.p_type || '',
        'Product Size': row.p_size || '',
        'Yield Value': row.yield_value || '',
        'WH Location': row.wh_location || '',
        'FK QC Remark': row.fkqc_remark || '',
        'FK Grade': row.fk_grade || '',
        'Invoice Date': row.invoice_date || '',
        'FKT Link': row.fkt_link || '',
        'Source': row.source || ''
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Multi Picking');
      const customerSuffix = selectedCustomer ? `_${selectedCustomer.replace(/\s+/g, '_')}` : '';
      XLSX.writeFile(wb, `Picking_MultiEntry${customerSuffix}_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`);
      toast.success(`Exported ${dataToExport.length} rows`);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  // ====== WSN OVERWRITE DIALOG HANDLERS ======
  const handleOverwriteCancel = () => {
    // User cancelled - keep existing WSN
    if (pendingWSNRef.current) {
      const { rowIndex, event } = pendingWSNRef.current;
      // Restore original value (already done by reverting)
      setTimeout(() => {
        event?.api?.startEditingCell({ rowIndex, colKey: 'wsn' });
      }, 100);
    }
    setWsnOverwriteDialog(null);
    pendingWSNRef.current = null;
  };

  const handleOverwriteReplace = async () => {
    // User chose to replace - proceed with new WSN
    if (pendingWSNRef.current) {
      const { wsn, rowIndex, event } = pendingWSNRef.current;
      const node = event?.api?.getDisplayedRowAtIndex(rowIndex);
      if (node) {
        node.setDataValue('wsn', wsn);
        // Fetch and apply master data for new WSN
        try {
          const res = await pickingAPI.getSourceByWSN(wsn, activeWarehouse?.id);
          const d = res.data;
          node.setDataValue('product_title', d.product_title ?? '');
          node.setDataValue('brand', d.brand ?? '');
          node.setDataValue('cms_vertical', d.cms_vertical ?? '');
          node.setDataValue('fsp', d.fsp ?? '');
          node.setDataValue('mrp', d.mrp ?? '');
          node.setDataValue('rack_no', d.rack_no ?? '');
          node.setDataValue('hsn_sac', d.hsn_sac ?? '');
          node.setDataValue('igst_rate', d.igst_rate ?? '');
          node.setDataValue('p_type', d.p_type ?? '');
          node.setDataValue('p_size', d.p_size ?? '');
          node.setDataValue('vrp', d.vrp ?? '');
          node.setDataValue('wid', d.wid ?? '');
          node.setDataValue('fsn', d.fsn ?? '');
          node.setDataValue('order_id', d.order_id ?? '');
          node.setDataValue('fkqc_remark', d.fkqc_remark ?? '');
          node.setDataValue('fk_grade', d.fk_grade ?? '');
          node.setDataValue('invoice_date', d.invoice_date ?? '');
          node.setDataValue('fkt_link', d.fkt_link ?? '');
          node.setDataValue('wh_location', d.wh_location ?? '');
          node.setDataValue('yield_value', d.yield_value ?? '');
          node.setDataValue('source', d.source ?? '');

          setMultiRows((prev) => {
            const rows = [...prev];
            rows[rowIndex] = {
              ...rows[rowIndex],
              wsn,
              product_title: d.product_title ?? '',
              brand: d.brand ?? '',
              cms_vertical: d.cms_vertical ?? '',
              fsp: d.fsp ?? '',
              mrp: d.mrp ?? '',
              rack_no: d.rack_no ?? '',
              hsn_sac: d.hsn_sac ?? '',
              igst_rate: d.igst_rate ?? '',
              p_type: d.p_type ?? '',
              p_size: d.p_size ?? '',
              vrp: d.vrp ?? '',
              wid: d.wid ?? '',
              fsn: d.fsn ?? '',
              order_id: d.order_id ?? '',
              fkqc_remark: d.fkqc_remark ?? '',
              fk_grade: d.fk_grade ?? '',
              invoice_date: d.invoice_date ?? '',
              fkt_link: d.fkt_link ?? '',
              wh_location: d.wh_location ?? '',
              yield_value: d.yield_value ?? '',
              source: d.source ?? ''
            };
            checkDuplicates(rows);
            return rows;
          });
        } catch (err) {
          // Try inbound master data fallback
          try {
            const inboundResp = await inboundAPI.getMasterDataByWSN(wsn);
            const md = inboundResp.data;
            node.setDataValue('product_title', md.product_title ?? '');
            node.setDataValue('brand', md.brand ?? '');
            node.setDataValue('cms_vertical', md.cms_vertical ?? '');
            node.setDataValue('fsp', md.fsp ?? '');
            node.setDataValue('mrp', md.mrp ?? '');
            setMultiRows((prev) => {
              const rows = [...prev];
              rows[rowIndex] = { ...rows[rowIndex], wsn, product_title: md.product_title ?? '', brand: md.brand ?? '' };
              checkDuplicates(rows);
              return rows;
            });
          } catch { /* ignore */ }
        }
        // Move to next row
        setTimeout(() => {
          event?.api?.startEditingCell({ rowIndex: rowIndex + 1, colKey: 'wsn' });
        }, 100);
      }
    }
    setWsnOverwriteDialog(null);
    pendingWSNRef.current = null;
  };

  const handleOverwriteAddToNextRow = async () => {
    // User chose to add new WSN to next empty row
    if (pendingWSNRef.current) {
      const { wsn, event } = pendingWSNRef.current;
      // Find next empty row
      let nextEmptyIndex = -1;
      for (let i = 0; i < multiRows.length; i++) {
        if (!multiRows[i].wsn?.trim()) {
          nextEmptyIndex = i;
          break;
        }
      }
      if (nextEmptyIndex >= 0) {
        const node = event?.api?.getDisplayedRowAtIndex(nextEmptyIndex);
        if (node) {
          node.setDataValue('wsn', wsn);
          // Fetch master data
          try {
            const res = await pickingAPI.getSourceByWSN(wsn, activeWarehouse?.id);
            const d = res.data;
            node.setDataValue('product_title', d.product_title ?? '');
            node.setDataValue('brand', d.brand ?? '');
            node.setDataValue('cms_vertical', d.cms_vertical ?? '');
            node.setDataValue('fsp', d.fsp ?? '');
            node.setDataValue('mrp', d.mrp ?? '');
            node.setDataValue('rack_no', d.rack_no ?? '');
            node.setDataValue('hsn_sac', d.hsn_sac ?? '');
            node.setDataValue('igst_rate', d.igst_rate ?? '');
            node.setDataValue('p_type', d.p_type ?? '');
            node.setDataValue('p_size', d.p_size ?? '');
            node.setDataValue('vrp', d.vrp ?? '');
            node.setDataValue('wid', d.wid ?? '');
            node.setDataValue('fsn', d.fsn ?? '');
            node.setDataValue('order_id', d.order_id ?? '');
            node.setDataValue('fkqc_remark', d.fkqc_remark ?? '');
            node.setDataValue('fk_grade', d.fk_grade ?? '');
            node.setDataValue('invoice_date', d.invoice_date ?? '');
            node.setDataValue('fkt_link', d.fkt_link ?? '');
            node.setDataValue('wh_location', d.wh_location ?? '');
            node.setDataValue('yield_value', d.yield_value ?? '');
            node.setDataValue('source', d.source ?? '');

            setMultiRows((prev) => {
              const rows = [...prev];
              rows[nextEmptyIndex] = {
                ...rows[nextEmptyIndex],
                wsn,
                product_title: d.product_title ?? '',
                brand: d.brand ?? '',
                cms_vertical: d.cms_vertical ?? '',
                fsp: d.fsp ?? '',
                mrp: d.mrp ?? '',
                rack_no: d.rack_no ?? '',
                hsn_sac: d.hsn_sac ?? '',
                igst_rate: d.igst_rate ?? '',
                p_type: d.p_type ?? '',
                p_size: d.p_size ?? '',
                vrp: d.vrp ?? '',
                wid: d.wid ?? '',
                fsn: d.fsn ?? '',
                order_id: d.order_id ?? '',
                fkqc_remark: d.fkqc_remark ?? '',
                fk_grade: d.fk_grade ?? '',
                invoice_date: d.invoice_date ?? '',
                fkt_link: d.fkt_link ?? '',
                wh_location: d.wh_location ?? '',
                yield_value: d.yield_value ?? '',
                source: d.source ?? ''
              };
              checkDuplicates(rows);
              return rows;
            });
          } catch { /* ignore */ }
          // Move to row after new one
          setTimeout(() => {
            event?.api?.startEditingCell({ rowIndex: nextEmptyIndex + 1, colKey: 'wsn' });
          }, 100);
        }
      } else {
        toast.error('No empty row available');
      }
    }
    setWsnOverwriteDialog(null);
    pendingWSNRef.current = null;
  };

  // Submit multi entry
  const handleMultiSubmit = async () => {
    const validRows = multiRows.filter(r => r.wsn?.trim());

    if (validRows.length === 0) {
      toast.error('At least 1 WSN required');
      return;
    }

    if (!pickingDate) {
      toast.error('Please select picking date');
      return;
    }

    if (!selectedCustomer) {
      toast.error('Please select customer');
      return;
    }

    if (!pickerName.trim()) {
      toast.error('Picker name is required');
      return;
    }

    const fixedRows = validRows.map(row => ({
      ...row,
      picking_date: pickingDate,
      customer_name: selectedCustomer,
      picker_name: pickerName,
      created_by: user?.id,
      created_user_name: user?.fullName || user?.username,
      warehouse_name: activeWarehouse?.name
    }));

    console.log('Submitting picking entries:', { fixedRows, warehouse_id: activeWarehouse?.id });

    setMultiLoading(true);
    try {
      const response = await pickingAPI.multiEntry(fixedRows, activeWarehouse?.id);

      if (response.data?.successCount > 0) {
        toast.success(`${response.data.successCount} entries created`);
      }

      if (response.data?.errors && response.data.errors.length > 0) {
        console.error('Errors:', response.data.errors);
        toast.error(`❌ ${response.data.errors.length} entries failed. Check console.`);
      }

      if (response.data?.successCount === 0 && response.data?.errors?.length === 0) {
        toast.error('No entries were saved. Check data.');
      }

      // Reset rows
      setMultiRows(generateEmptyRows(500));
      setGridDuplicateWSNs(new Set());
      setCrossWarehouseWSNs(new Set());

      // Clear saved draft after successful submit
      await clearDraft();

      // Reload data
      const res = await pickingAPI.getExistingWSNs(activeWarehouse?.id);
      setExistingPickingWSNs(new Set(res.data));
      loadPickingList();
      loadBatches();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Submission failed');
    } finally {
      setMultiLoading(false);
    }
  };

  // Calculate status counts for Multi Entry
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

  // ====== CATEGORY PIVOT DATA COMPUTATION ======
  // Calculate category/brand-wise quantity summary from scanned rows in Multi Entry
  const categoryPivotData = useMemo(() => {
    // Only consider rows with WSN filled
    const filledRows = multiRows.filter((row: any) => row.wsn?.trim());

    if (filledRows.length === 0) {
      return { categories: [], grandTotal: { qty: 0, fsp: 0, mrp: 0 } };
    }

    // Group by category (cms_vertical) or brand based on pivotGroupBy
    const groupField = pivotGroupBy === 'brand' ? 'brand' : 'cms_vertical';
    const defaultLabel = pivotGroupBy === 'brand' ? 'Unknown Brand' : 'Uncategorized';
    const categoryMap = new Map<string, { qty: number; fsp: number; mrp: number; items: any[] }>();

    filledRows.forEach((row: any) => {
      const category = row[groupField]?.trim() || defaultLabel;
      const fsp = parseFloat(row.fsp) || 0;
      const mrp = parseFloat(row.mrp) || 0;

      if (!categoryMap.has(category)) {
        categoryMap.set(category, { qty: 0, fsp: 0, mrp: 0, items: [] });
      }

      const data = categoryMap.get(category)!;
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
  }, [multiRows, pivotGroupBy, categoryPivotSortBy, categoryPivotSortDir]);

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
      const groupLabel = pivotGroupBy === 'brand' ? 'Brand' : 'Category';
      const exportData = categoryPivotData.categories.map((cat, idx) => ({
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

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${groupLabel} Summary`);

      const timestamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Picking_${groupLabel}_Pivot_${timestamp}.xlsx`);

      toast.success(`${groupLabel} summary exported!`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Export failed');
    }
  };

  // ⚡ HELPER: Generate cache key for current filters
  const getCacheKey = useCallback(() => {
    return JSON.stringify({
      warehouseId: activeWarehouse?.id,
      page,
      limit,
      search: searchDebounced,
      brand: brandFilter,
      category: categoryFilter,
      source: sourceFilter,
      customer: customerFilter,
      startDate: startDateFilter,
      endDate: endDateFilter,
    });
  }, [activeWarehouse?.id, page, limit, searchDebounced, brandFilter, categoryFilter, sourceFilter, customerFilter, startDateFilter, endDateFilter]);

  // ⚡ PREFETCH: Prefetch next page in background
  const prefetchNextPage = useCallback(async () => {
    const totalPages = Math.ceil(total / limit);
    if (page >= totalPages) return;

    const nextPageCacheKey = JSON.stringify({
      warehouseId: activeWarehouse?.id,
      page: page + 1,
      limit,
      search: searchDebounced,
      brand: brandFilter,
      category: categoryFilter,
      source: sourceFilter,
      customer: customerFilter,
      startDate: startDateFilter,
      endDate: endDateFilter,
    });

    const cached = pageCacheRef.current.get(nextPageCacheKey);
    if (cached && Date.now() - cached.timestamp < PAGE_CACHE_TTL) return;

    try {
      const response = await pickingAPI.getList({
        page: page + 1,
        limit,
        warehouseId: activeWarehouse?.id,
        search: searchDebounced,
        brand: brandFilter,
        category: categoryFilter,
        source: sourceFilter,
        customer: customerFilter,
        startDate: startDateFilter,
        endDate: endDateFilter,
      });
      const rows = response.data?.data || [];
      pageCacheRef.current.set(nextPageCacheKey, {
        data: rows,
        total: response.data?.pagination?.total || 0,
        timestamp: Date.now(),
      });
    } catch { /* Silently fail - prefetch is optional */ }
  }, [activeWarehouse?.id, page, limit, total, searchDebounced, brandFilter, categoryFilter, sourceFilter, customerFilter, startDateFilter, endDateFilter]);

  // Load picking list (supports buttonRefresh for non-blocking inline refresh)
  const loadPickingList = async ({ buttonRefresh = false } = {}) => {
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
        setPickingList(cached.data);
        setTotal(cached.total);
        setLastRefreshTime(new Date(cached.timestamp));
        setDataResponseReceived(true);
        // Keep spinner visible briefly for consistent UX during filter reset
        setTimeout(() => { setLoading(false); setIsFetching(false); }, 300);
        setTimeout(() => prefetchNextPage(), 100);
        return;
      }
    }

    if (buttonRefresh) setRefreshing(true);

    // If we have no data yet, show full loader; otherwise show a delayed overlay to avoid flicker
    if (!pickingList || pickingList.length === 0) {
      setLoading(true);
    } else {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      overlayShownRef.current = false;
      overlayStartRef.current = null;
      overlayTimerRef.current = setTimeout(() => {
        try {
          setTopLoading(true);
          overlayShownRef.current = true;
          overlayStartRef.current = Date.now();
          // Hide AG Grid's built-in loading overlay for consistency
          try { gridRef.current?.api?.hideOverlay(); } catch { }
        } catch (err) { }
        overlayTimerRef.current = null;
      }, SHOW_OVERLAY_DELAY);
    }

    // Mark fetching in-progress
    setIsFetching(true);

    // Cancel any previous in-flight request & pending empty timers
    if (pickingAbortControllerRef.current) {
      try { pickingAbortControllerRef.current.abort(); } catch { }
      pickingAbortControllerRef.current = null;
    }
    if (emptyTimerRef.current) {
      clearTimeout(emptyTimerRef.current);
      emptyTimerRef.current = null;
    }
    const controller = new AbortController();
    pickingAbortControllerRef.current = controller;

    try {
      const response = await pickingAPI.getList({
        page,
        limit,
        warehouseId: activeWarehouse.id,
        search: searchDebounced,
        brand: brandFilter,
        category: categoryFilter,
        source: sourceFilter,
        customer: customerFilter,
        startDate: startDateFilter,
        endDate: endDateFilter
      });

      // Only process if this is still the latest request
      if (loadId === currentLoadIdRef.current) {
        const data = response.data.data || [];
        const totalCount = response.data.pagination?.total || 0;

        // Clear any pending empty timers
        if (emptyTimerRef.current) {
          clearTimeout(emptyTimerRef.current);
          emptyTimerRef.current = null;
        }

        // If server returned rows, update immediately
        if (data.length > 0) {
          setPickingList(data);
          previousDataRef.current = data;
        } else {
          // Server returned zero rows - delay clearing to avoid flicker
          emptyTimerRef.current = setTimeout(() => {
            if (loadId === currentLoadIdRef.current) {
              setPickingList([]);
              previousDataRef.current = [];
            }
            emptyTimerRef.current = null;
          }, EMPTY_CONFIRM_DELAY);
        }

        setTotal(totalCount);
        setDataResponseReceived(true); // Mark that we've received API response

        // ⚡ WINDOW CACHE: Store in window for instant navigation (survives component unmount)
        if (typeof window !== 'undefined' && data && data.length > 0) {
          window.__PICKING_LIST_CACHE__ = {
            data: data,
            total: totalCount,
            timestamp: Date.now(),
            warehouseId: activeWarehouse?.id
          };
          try {
            sessionStorage.setItem('picking_list_cache', JSON.stringify(data));
            sessionStorage.setItem('picking_list_cache_warehouseId', String(activeWarehouse?.id || ''));
          } catch { /* ignore quota errors */ }
        }

        // ⚡ PAGE CACHE: Store in cache
        pageCacheRef.current.set(cacheKey, {
          data,
          total: totalCount,
          timestamp: Date.now(),
        });
        setLastRefreshTime(new Date());
        retryCountRef.current = 0; // Reset retry count on success

        // ⚡ PREFETCH: Prefetch next page after successful load
        setTimeout(() => prefetchNextPage(), 500);

        if (buttonRefresh) {
          setRefreshSuccess(true);
          toast.success('List refreshed');
          setTimeout(() => setRefreshSuccess(false), 1800);
        }
      }
    } catch (err: any) {
      // Handle aborts: clear overlay/timer and return without clearing data
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') {
        if (overlayTimerRef.current) {
          clearTimeout(overlayTimerRef.current);
          overlayTimerRef.current = null;
        }
        if (overlayShownRef.current) {
          try { gridRef.current?.api?.hideOverlay(); } catch { }
          overlayShownRef.current = false;
          overlayStartRef.current = null;
          try { setTopLoading(false); } catch { }
        }
        // Ensure any loading/refresh indicators are cleared on abort
        try { setRefreshing(false); } catch { }
        try { setLoading(false); } catch { }


        setIsFetching(false);
        pickingAbortControllerRef.current = null;
        return;
      }

      console.error('Load picking list error:', err);

      // ⚡ AUTO-RETRY: Retry on failure
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        toast.error(`Loading failed, retrying... (${retryCountRef.current}/${MAX_RETRIES})`);
        setTimeout(() => {
          loadPickingList({ buttonRefresh: true });
        }, 1000 * retryCountRef.current);
        return;
      }

      if (buttonRefresh) toast.error(err.response?.data?.error || 'Failed to refresh picking list');
      else toast.error(err.response?.data?.error || 'Failed to load picking list');
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
          try { gridRef.current?.api?.hideOverlay(); } catch { }
          overlayShownRef.current = false;
          overlayStartRef.current = null;
          try { setTopLoading(false); } catch { }
        } else {
          // overlay never shown, clear pending timer
          if (overlayTimerRef.current) {
            clearTimeout(overlayTimerRef.current);
            overlayTimerRef.current = null;
          }
          // Also ensure topLoading is false if the timer was pending
          try { setTopLoading(false); } catch { }
        }
        pickingAbortControllerRef.current = null;
      }
      // Always clear loading states to prevent infinite spinner
      try { setRefreshing(false); } catch { }
      try { setLoading(false); } catch { }
      setIsFetching(false);
    }
  };

  // Load batches
  const loadBatches = async () => {
    setBatchLoading(true);
    try {
      console.log('Loading batches for warehouse:', activeWarehouse?.id);
      const response = await pickingAPI.getBatches(activeWarehouse?.id);
      setBatches(response.data || []);
      console.log('Batches loaded:', response.data?.length ?? 0);
    } catch (err: any) {
      // Surface server error details for easier debugging
      console.error('Load batches error:', err);
      const serverMsg = err?.response?.data?.error || err?.message || 'Failed to load batches';
      toast.error(serverMsg);
      // Helpful debug toast when server returns stack or details
      if (err?.response?.data?.details) {
        console.error('Server error details:', err.response.data.details);
      }
    } finally {
      setBatchLoading(false);
    }
  };

  // ✅ Load brands from database API
  const loadBrands = async () => {
    try {
      const response = await pickingAPI.getBrands(activeWarehouse?.id);
      setBrandOptions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load brands:', error);
      setBrandOptions([]);
    }
  };

  // ✅ Load categories from database API
  const loadCategories = async () => {
    try {
      const response = await pickingAPI.getCategories(activeWarehouse?.id);
      setCategoryOptions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategoryOptions([]);
    }
  };

  // Delete batch
  const handleDeleteBatch = async (batchId: string) => {
    if (window.confirm(`Delete batch ${batchId}?`)) {
      try {
        await pickingAPI.deleteBatch(batchId);
        toast.success('Batch deleted successfully');

        // Reload existing WSNs after deletion
        const res = await pickingAPI.getExistingWSNs(activeWarehouse?.id);
        setExistingPickingWSNs(new Set(res.data));

        loadBatches();
        loadPickingList();
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to delete batch');
      }
    }
  };

  // Export to Excel with filters
  const handleAdvancedExport = async () => {
    if (!activeWarehouse) return;

    try {
      // ⚡ OPTIMIZED: Load XLSX dynamically
      const XLSX = await import('xlsx');

      let dataToExport = pickingList;

      // Build filter params
      const filterParams: any = {
        warehouseId: activeWarehouse.id,
      };

      // Add date filters if provided
      if (exportStartDate) filterParams.startDate = exportStartDate;
      if (exportEndDate) filterParams.endDate = exportEndDate;

      // Add customer filter if provided
      if (exportCustomer) filterParams.customer = exportCustomer;

      // Add batch filter if provided
      if (exportBatchIds && exportBatchIds.length > 0) filterParams.batchId = exportBatchIds;

      // Fetch data with all filters
      const response = await pickingAPI.getList({
        page: 1,
        limit: 999999,
        ...filterParams
      });

      dataToExport = response.data.data || [];

      if (dataToExport.length === 0) {
        toast.error('No data to export with selected filters');
        return;
      }

      const exportData = dataToExport.map((item: any) => ({
        ID: item.id || '-',
        WSN: item.wsn,
        'Product Title': item.product_title || '-',
        Brand: item.brand || '-',
        Category: item.cms_vertical || '-',
        FSP: item.fsp || '-',
        MRP: item.mrp || '-',
        'Rack No': item.rack_no || '-',
        'Batch ID': item.batch_id || '-',
        Source: item.source || '-',
        'Picking Date': formatDate(item.picking_date),
        Customer: item.customer_name || '-',
        Picker: item.picker_name || '-',
        Quantity: item.quantity || 1,
        'Picking Remarks': item.picking_remarks || '-',
        'Other Remarks': item.other_remarks || '-',
        'Created By': item.created_user_name || '-',
        'Warehouse ID': item.warehouse_id || '-',
        'Warehouse Name': item.warehouse_name || '-',
        WID: item.wid || '-',
        FSN: item.fsn || '-',
        'Order ID': item.order_id || '-',
        'HSN/SAC': item.hsn_sac || '-',
        'IGST Rate': item.igst_rate || '-',
        'Product Type': item.p_type || '-',
        'Product Size': item.p_size || '-',
        VRP: item.vrp || '-',
        'Yield Value': item.yield_value || '-',
        'WH Location': item.wh_location || '-',
        'FK QC Remark': item.fkqc_remark || '-',
        'FK Grade': item.fk_grade || '-',
        'Invoice Date': formatDate(item.invoice_date),
        'FKT Link': item.fkt_link || '-'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Picking List');

      // Generate meaningful filename
      let filenameParts = ['picking'];
      if (exportBatchIds && exportBatchIds.length > 0) {
        if (exportBatchIds.length === 1) {
          filenameParts.push(`batch_${exportBatchIds[0]}`);
        } else {
          filenameParts.push(`batches_${exportBatchIds.length}`);
        }
      }
      if (exportStartDate) filenameParts.push(`from_${exportStartDate.replace(/-/g, '')}`);
      if (exportEndDate) filenameParts.push(`to_${exportEndDate.replace(/-/g, '')}`);
      if (exportCustomer) filenameParts.push(`customer_${exportCustomer.replace(/\s+/g, '_')}`);
      if (filenameParts.length === 1) filenameParts.push('all');

      const filename = `${filenameParts.join('_')}_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success(`Exported ${exportData.length} records`);
      setExportDialogOpen(false);
      setExportStartDate('');
      setExportEndDate('');
      setExportCustomer('');
      setExportBatchIds([]);
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(err.response?.data?.error || 'Failed to export Excel');
    }
  };

  // Get unique customers from API (all customers, not just current page)
  // customers state is loaded from backend via loadCustomers()
  const exportCustomerOptions = useMemo(() => {
    return customers.sort();
  }, [customers]);

  const handleListReset = () => {
    setLoading(true);
    setSearchFilter('');
    setBrandFilter('');
    setCategoryFilter('');
    setSourceFilter('');
    setCustomerFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setPage(1);
  };

  const saveListColumnSettings = (cols: string[]) => {
    setListColumns(cols);
    localStorage.setItem('pickingListColumns', JSON.stringify(cols));

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
        localStorage.setItem('picking_grid_state', JSON.stringify(state));
      } catch { /* ignore */ }
    }
  };

  // Ensure AG Grid shows the correct overlay
  useEffect(() => {
    const api = gridRef.current;
    if (!api) return;

    if (isFetching) {
      try { api.hideOverlay(); } catch { }
      return;
    }

    if (!isFetching && !loading && pickingList.length === 0) {
      try { api.showNoRowsOverlay(); } catch { }
    } else {
      try { api.hideOverlay(); } catch { }
    }
  }, [pickingList, loading, isFetching]);

  // Apply AG Grid quick filter when search input changes
  useEffect(() => {
    const api = gridRef.current;
    if (!api || typeof api.setQuickFilter !== 'function') return;

    if (isFetching) {
      try { api.hideOverlay(); } catch { }
      return;
    }

    api.setQuickFilter(searchDebounced || '');
  }, [searchDebounced, pickingList]);

  // ✅ LIST GRID COLUMN DEFINITIONS (AG GRID)
  // Include ALL columns with hide property - columnDefs structure never changes
  // Store page/limit and grid settings in refs for stable valueGetter/columnDefs
  const pageRef = useRef(page);
  const limitRef = useRef(limit);
  const enableSortingRef = useRef(enableSorting);
  const enableColumnFiltersRef = useRef(enableColumnFilters);
  const enableColumnResizeRef = useRef(enableColumnResize);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { limitRef.current = limit; }, [limit]);
  useEffect(() => { enableSortingRef.current = enableSorting; }, [enableSorting]);
  useEffect(() => { enableColumnFiltersRef.current = enableColumnFilters; }, [enableColumnFilters]);
  useEffect(() => { enableColumnResizeRef.current = enableColumnResize; }, [enableColumnResize]);

  // Column minWidth config based on content type
  const COLUMN_MIN_WIDTHS: Record<string, number> = {
    wsn: 80,
    product_title: 500,
    brand: 90,
    cms_vertical: 120,
    fsp: 60,
    mrp: 60,
    rack_no: 70,
    batch_id: 100,
    source: 90,
    picking_date: 90,
    invoice_date: 100,
    customer_name: 100,
    picker_name: 90,
    quantity: 50,
    picking_remarks: 90,
    other_remarks: 90,
    created_user_name: 120,
    wid: 100,
    fsn: 150,
    order_id: 90,
    hsn_sac: 90,
    igst_rate: 60,
    p_type: 80,
    p_size: 80,
    vrp: 70,
    yield_value: 80,
    wh_location: 100,
    fkqc_remark: 80,
    fk_grade: 90,
    fkt_link: 150,
  };

  const listColumnDefs = useMemo(() => {
    const sr = {
      headerName: 'SR.NO',
      field: '__sr',
      valueGetter: (params: any) => params.node ? params.node.rowIndex + 1 + (pageRef.current - 1) * limitRef.current : undefined,
      width: 20,
      cellStyle: { fontWeight: 700, textAlign: 'center', color: isDarkMode ? '#94a3b8' : '#64748b' },
      suppressMovable: true,
      sortable: false,
      filter: false,
      suppressSizeToFit: true,
    };

    // Include ALL columns - visibility controlled by ag-Grid state
    const cols = ALL_LIST_COLUMNS.map((col: string) => {
      const minWidth = COLUMN_MIN_WIDTHS[col] || 100;

      // Dates
      if (col.includes('date')) {
        return {
          field: col,
          headerName: col.replace(/_/g, ' ').toUpperCase(),
          filter: 'agDateColumnFilter',
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
            const colorMap: any = { 'QC': 'success', 'INBOUND': 'warning', 'MASTER': 'info' };
            return (
              <Chip label={p.value} size="small" color={colorMap[p.value] || 'default'} sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }} />
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
        filter: 'agTextColumnFilter',
        tooltipField: col,
        minWidth,
        hide: false,
      };
    });

    return [sr, ...cols];
  }, [isDarkMode]); // Only isDarkMode - grid settings handled via defaultColDef refs

  // NOTE: No longer need to re-apply column state on columnDefs change
  // because columnDefs structure is now STABLE (includes ALL columns with hide property)
  // Column visibility is controlled via setColumnsVisible() API which preserves order

  // STABLE defaultColDef - no dependencies to prevent grid re-render
  const listDefaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: true,
    editable: false,
    suppressMovable: true,
    cellStyle: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  }), []);

  // Apply grid settings dynamically via API (preserves column widths)
  useEffect(() => {
    const api = listGridRef.current;
    if (!api) return;

    try {
      const columns = api.getColumns();
      if (columns && columns.length > 0) {
        columns.forEach((col: any) => {
          const colDef = col.getColDef();
          colDef.sortable = enableSorting;
          colDef.resizable = enableColumnResize;
          colDef.filter = enableColumnFilters;
        });
        // Refresh headers to apply changes
        api.refreshHeader();
      }
    } catch { /* ignore */ }
  }, [enableSorting, enableColumnFilters, enableColumnResize]);

  // Column widths for AG Grid
  const COLUMN_WIDTHS: Record<string, any> = {
    sno: { width: 60 },
    wsn: { width: 80 },
    product_serial_number: { width: 160 },
    picking_remarks: { flex: 1, minWidth: 120 },
    product_title: { flex: 2, minWidth: 220 },
    brand: { width: 90 },
    cms_vertical: { width: 100 },
    mrp: { width: 40 },
    fsp: { width: 40 },
    rack_no: { width: 80 },
  };

  if (!activeWarehouse) {
    return <AppLayout>⚠️ No warehouse selected</AppLayout>;
  }

  // ✅ MULTI ENTRY - COLUMN DEFS (useMemo for stable reference)
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

    const dataCols = visibleColumns.filter(f => f !== 'sno').map((field) => {
      const savedWidth = multiColumnWidths[field];
      const widthConfig = savedWidth ? { width: savedWidth } : (COLUMN_WIDTHS[field] || {});
      const isEditable = EDITABLE_COLUMNS.includes(field);

      const baseColDef: any = {
        field,
        headerName: field.replace(/_/g, ' ').toUpperCase(),
        editable: isEditable,
        suppressSizeToFit: true,
        resizable: true,
        minWidth: 80,
        ...widthConfig,
        cellStyle: (params: any) => {
          const wsn = params.data?.wsn?.trim()?.toUpperCase();
          const styles: any = {};

          // WSN validation colors
          if (wsn && field === 'wsn') {
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

      // Rack select editor (editable)
      if (field === 'rack_no' && isEditable) {
        return {
          ...baseColDef,
          width: savedWidth || 110,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: { values: ['', ...racks.map((r: any) => r.rack_name)] },
        };
      }

      // Read-only for master data columns
      if (ALL_MASTER_COLUMNS.includes(field)) {
        baseColDef.editable = false;
      }

      // WSN column with product link
      if (field === 'wsn') {
        baseColDef.cellRenderer = (params: any) => {
          const wsn = params.value?.trim()?.toUpperCase();
          const isCross = wsn && crossWarehouseWSNs.has(wsn);
          const isDup = wsn && gridDuplicateWSNs.has(wsn);

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700 }}>{params.value ?? ''}</span>
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
                  style={{ fontSize: 14, color: '#f59e0b', textDecoration: 'none', marginLeft: 4, cursor: 'pointer' }}
                  title="Open product link"
                >
                  🔗
                </a>
              )}
              {isCross && (
                <Tooltip title="Already picked">
                  <span style={{ color: '#dc2626', cursor: 'help' }}>⛔</span>
                </Tooltip>
              )}
              {isDup && !isCross && (
                <Tooltip title="Duplicate in grid">
                  <span style={{ color: '#f59e0b', cursor: 'help' }}>⚠️</span>
                </Tooltip>
              )}
            </div>
          );
        };
      }

      // FKT Link column - clickable
      if (field === 'fkt_link') {
        baseColDef.cellRenderer = (params: any) => {
          if (!params.value) return null;
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
              style={{ color: '#f59e0b', textDecoration: 'underline' }}
              title={params.value}
            >
              🔗
            </a>
          );
        };
      }

      return baseColDef;
    });

    return [rowNumberCol, ...dataCols];
  }, [visibleColumns, multiColumnWidths, racks, crossWarehouseWSNs, gridDuplicateWSNs, isDarkMode]);

  //////////////////////////////////====UI RENDERING====////////////////////////////////////

  return (
    <AppLayout>
      <Toaster position="top-right" containerStyle={{ zIndex: 99999 }} toastOptions={{
        duration: 3000,
        style: {
          background: '#363636',
          color: '#fff',
          borderRadius: '10px',
          padding: '16px',
          fontWeight: 600
        },
        success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } }
      }} />

      <Box sx={{
        p: { xs: 0.75, md: 1 },
        background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)',
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* HEADER */}
        <StandardPageHeader
          title="Picking"
          subtitle="Prepare orders for dispatch"
          icon="📦"
          warehouseName={activeWarehouse?.name}
        // userName={user?.fullName}
        />

        {/* TABS */}
        <StandardTabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          tabs={visibleTabs}
          color="#f59e0b"
        />

        {/* ========== TAB: PICKING LIST ========== */}
        {currentTabCode === 'list' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {/* FILTERS - REDESIGNED LIKE INBOUND */}
            <Card sx={{ mb: { xs: 0.5, md: 0.5 }, borderRadius: 1.5, boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)', background: isDarkMode ? '#1e293b' : 'rgba(255, 255, 255, 0.98)' }}>
              <CardContent sx={{ p: { xs: 1, md: 1.5 }, '&:last-child': { pb: { xs: 1, md: 1.5 } } }}>
                {/* ROW 1: Search + Options Button (like Dashboard/Inbound) */}
                <Stack direction="row" spacing={1} alignItems="center">
                  {/* Search Field */}
                  <TextField
                    size="small"
                    placeholder="🔍 Search by WSN, Product, or any field..."
                    value={searchFilter}
                    onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }}
                    sx={{
                      flex: 1,
                      minWidth: { xs: 150, sm: 200, md: 280 },
                      '& .MuiOutlinedInput-root': {
                        bgcolor: isDarkMode ? '#1e293b' : 'white',
                        borderRadius: 1.5,
                        height: 38,
                        fontSize: { xs: '0.8rem', sm: '0.875rem' },
                        fontWeight: 500,
                        border: isDarkMode ? '2px solid rgba(255,255,255,0.15)' : '2px solid #e2e8f0',
                        '&:hover': { borderColor: isDarkMode ? 'rgba(255,255,255,0.25)' : '#cbd5e1' },
                        '&.Mui-focused': { borderColor: '#f59e0b' },
                        '& fieldset': { border: 'none' },
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
              </CardContent>
            </Card>

            {/* TABLE - AG GRID */}
            <Box sx={{
              flex: 1,
              minHeight: 0,
              border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d1d5db',
              position: 'relative'
            }}>

              {/* Loading Spinner Overlay - semi-transparent so data stays visible */}
              {(loading || isFetching) && pickingList && pickingList.length > 0 && gridDataRendered && (
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
              {!loading && !isFetching && dataResponseReceived && (!pickingList || pickingList.length === 0) && (
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
                      No picking items match your current filters. Try adjusting your search criteria or reset filters to see all items.
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
                      ref={gridRef}
                      rowData={pickingList}
                      columnDefs={listColumnDefs}
                      defaultColDef={listDefaultColDef}
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
                      gridOptions={{ getRowId: (params: any) => String(params.data?.wsn || params.data?.id || params.rowIndex) }}
                      onGridReady={(params: any) => {
                        listGridRef.current = params.api;  // Use listGridRef for list grid
                        gridRef.current = params.api;
                        columnApiRef.current = params.api;
                        try {
                          // Try localStorage
                          const savedState = localStorage.getItem('picking_grid_state');
                          if (savedState && params.api) {
                            params.api.applyColumnState({ state: JSON.parse(savedState), applyOrder: true });
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
                            localStorage.setItem('picking_grid_state', JSON.stringify(params.api.getColumnState()));
                          } catch { /* ignore */ }
                        }
                      }}
                      onColumnMoved={(params: any) => {
                        if (params.finished && params.api) {
                          try {
                            localStorage.setItem('picking_grid_state', JSON.stringify(params.api.getColumnState()));
                          } catch { /* ignore */ }
                        }
                      }}
                      onColumnVisible={(params: any) => {
                        if (params.api) {
                          try {
                            localStorage.setItem('picking_grid_state', JSON.stringify(params.api.getColumnState()));
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
                {((loading && (!pickingList || pickingList.length === 0)) || (pickingList && pickingList.length > 0 && !gridDataRendered)) && (
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
                        Loading picking data...
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
                  {pickingList.length > 0 ? (page - 1) * limit + 1 : 0} – {Math.min(page * limit, total)} of {total}
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

            {/* Export Dialog */}
            <Dialog
              open={exportDialogOpen}
              onClose={() => setExportDialogOpen(false)}
              maxWidth="md"
              fullWidth
              PaperProps={{
                sx: {
                  borderRadius: 3,
                  boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                  overflow: 'hidden'
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

              <DialogContent sx={{ py: 4, px: 3 }}>
                <Stack spacing={3}>
                  {/* CURRENT FILTERS PREVIEW */}
                  <Alert
                    severity="info"
                    icon={<InfoIcon />}
                    sx={{
                      fontSize: '0.85rem',
                      borderRadius: 2,
                      '& .MuiAlert-icon': { color: '#0ea5e9' }
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#0ea5e9' }}>
                      📋 Applied Filters Preview:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {exportStartDate && (
                        <Chip size="small" label={`📅 From: ${exportStartDate}`} sx={{ bgcolor: '#e0e7ff', color: '#3730a3' }} />
                      )}
                      {exportEndDate && (
                        <Chip size="small" label={`📅 To: ${exportEndDate}`} sx={{ bgcolor: '#e0e7ff', color: '#3730a3' }} />
                      )}
                      {exportCustomer && (
                        <Chip size="small" label={`👤 ${exportCustomer}`} sx={{ bgcolor: '#dcfce7', color: '#166534' }} />
                      )}
                      {(exportBatchIds && exportBatchIds.length > 0) && (
                        <Chip size="small" label={`📦 ${exportBatchIds.length} Batch${exportBatchIds.length > 1 ? 'es' : ''}`} sx={{ bgcolor: '#f3e8ff', color: '#6b21a8' }} />
                      )}
                      {!exportStartDate && !exportEndDate && !exportCustomer && (!exportBatchIds || exportBatchIds.length === 0) && (
                        <Chip size="small" label="🔍 All Data" sx={{ bgcolor: '#fee2e2', color: '#dc2626' }} />
                      )}
                    </Box>
                  </Alert>

                  {/* DIVIDER */}
                  <Divider sx={{ '&::before, &::after': { borderColor: '#e5e7eb' } }}>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 2,
                      py: 0.5,
                      bgcolor: '#f9fafb',
                      borderRadius: 2,
                      border: '1px solid #e5e7eb'
                    }}>
                      <SettingsIcon sx={{ fontSize: '1rem', color: '#6b7280' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280' }}>
                        Filter Options
                      </Typography>
                    </Box>
                  </Divider>

                  {/* DATE RANGE */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                    <TextField
                      fullWidth
                      label="Start Date"
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
                      label="End Date"
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

                  {/* CUSTOMER */}
                  <CustomerAutocomplete
                    value={exportCustomer}
                    onChange={(newValue) => setExportCustomer(newValue)}
                    customers={pickingCustomers}
                    warehouseId={activeWarehouse?.id}
                    onCustomerAdded={loadPickingCustomers}
                    size="medium"
                    label="Customer Name"
                    placeholder="Select or type customer name..."
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': { borderColor: '#10b981' },
                        '&.Mui-focused fieldset': { borderColor: '#10b981' }
                      }
                    }}
                  />

                  {/* BATCH SELECTION */}
                  <FormControl fullWidth>
                    <InputLabel sx={{ '&.Mui-focused': { color: '#10b981' } }}>
                      Select Batch IDs (Multiple)
                    </InputLabel>
                    <Select
                      multiple
                      value={exportBatchIds}
                      onChange={(e: any) => setExportBatchIds(e.target.value as string[])}
                      renderValue={(selected: string[]) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value: string) => (
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
                                bgcolor: '#e5e7eb',
                                color: '#374151',
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
                    bgcolor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 2
                  }}>
                    <CardContent sx={{ py: 2, px: 3 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#166534', mb: 1 }}>
                        📊 Export Summary:
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#166534' }}>
                        This will export filtered picking records to Excel with all selected criteria applied.
                        The file will include product details, dates, and batch information.
                      </Typography>
                    </CardContent>
                  </Card>
                </Stack>
              </DialogContent>

              <DialogActions sx={{
                p: 3,
                bgcolor: '#f9fafb',
                borderTop: '1px solid #e5e7eb',
                gap: 1
              }}>
                <Button
                  onClick={() => setExportDialogOpen(false)}
                  sx={{
                    borderRadius: 2,
                    px: 3,
                    fontWeight: 600,
                    color: '#6b7280',
                    '&:hover': { bgcolor: '#e5e7eb' }
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
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    }
                  }}
                >
                  Export to Excel
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        )}

        {/* ========== TAB 1: MULTI PICKING (AG GRID) ========== */}
        {currentTabCode === 'multi' && (
          <Box
            ref={multiEntryContainerRef}
            sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 0.5, mt: 0, overflow: 'hidden', bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa' }}>
            {/* HEADER */}
            <Card sx={{ borderRadius: 1, boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)', bgcolor: isDarkMode ? '#1e293b' : 'white' }}>
              <CardContent sx={{ p: { xs: 1.5, md: 1.2 }, pt: { xs: 2, md: 1.2 }, '&:last-child': { pb: { xs: 1.5, md: 1.2 } } }}>

                {/* ===== MOBILE: Single Row - Scrollable Inputs + Fixed Buttons ===== */}
                <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'flex-end', gap: 0.5, width: '100%', pt: 1 }}>
                  {/* LEFT: Scrollable Input Fields with Arrow Indicators */}
                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-end', gap: 0.5 }}>
                    {/* Left Arrow Indicator */}
                    <Box
                      sx={{
                        width: 20,
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isDarkMode ? '#64748b' : '#94a3b8',
                        fontSize: '0.75rem',
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
                        overflowY: 'hidden',
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'none',
                        '&::-webkit-scrollbar': { display: 'none' },
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ width: 'max-content', py: 0.5 }}>
                        <TextField
                          label="Date"
                          type="date"
                          value={pickingDate}
                          onChange={(e) => setPickingDate(e.target.value)}
                          size="small"
                          sx={{
                            minWidth: 120,
                            '& .MuiInputBase-root': { height: 36, fontSize: '0.8rem' },
                            '& .MuiInputLabel-root': { fontSize: '0.75rem' }
                          }}
                          InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                          label="Picker"
                          value={pickerName}
                          onChange={(e) => setPickerName(e.target.value)}
                          size="small"
                          sx={{
                            minWidth: 90,
                            '& .MuiInputBase-root': { height: 36, fontSize: '0.8rem' },
                            '& .MuiInputLabel-root': { fontSize: '0.75rem' }
                          }}
                        />
                        <Box sx={{ minWidth: 140 }}>
                          <CustomerAutocomplete
                            value={selectedCustomer}
                            onChange={(newValue) => setSelectedCustomer(newValue)}
                            customers={customers}
                            warehouseId={activeWarehouse?.id}
                            onCustomerAdded={loadCustomers}
                            size="small"
                            label="Customer"
                            placeholder="Select..."
                            sx={{
                              '& .MuiInputBase-root': { height: 36, fontSize: '0.8rem' },
                              '& .MuiInputLabel-root': { fontSize: '0.75rem' }
                            }}
                          />
                        </Box>
                      </Stack>
                    </Box>

                    {/* Right Arrow Indicator */}
                    <Box
                      sx={{
                        width: 20,
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isDarkMode ? '#64748b' : '#94a3b8',
                        fontSize: '0.75rem',
                        flexShrink: 0,
                      }}
                    >
                      ▶
                    </Box>
                  </Box>

                  {/* RIGHT: Fixed Action Buttons */}
                  <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, alignItems: 'flex-end', height: 36 }}>
                    {/* Menu Button */}
                    <Tooltip title="Open Settings">
                      <IconButton
                        size="small"
                        onClick={() => setPickingSettingsPanelOpen(true)}
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
                      pageType="picking"
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
                  {/* LEFT: Date + Picker + Customer Fields */}
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flex: 1, maxWidth: 700 }}>
                    <TextField
                      label="Picking Date"
                      type="date"
                      value={pickingDate}
                      onChange={(e) => setPickingDate(e.target.value)}
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
                      label="Picker Name"
                      value={pickerName}
                      onChange={(e) => setPickerName(e.target.value)}
                      size="small"
                      sx={{
                        width: 150,
                        '& .MuiInputBase-root': {
                          height: 38,
                          bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                          borderRadius: 1.5
                        }
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 200, maxWidth: 350 }}>
                      <CustomerAutocomplete
                        value={selectedCustomer}
                        onChange={(newValue) => setSelectedCustomer(newValue)}
                        customers={customers}
                        warehouseId={activeWarehouse?.id}
                        onCustomerAdded={loadCustomers}
                        size="small"
                        label="Customer Name"
                        placeholder="Type to search or select..."
                        sx={{ width: '100%' }}
                      />
                    </Box>
                  </Stack>

                  {/* RIGHT: Menu Button + Fullscreen + Live View */}
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    {/* Settings Menu Button */}
                    <Tooltip title="Open Settings Panel" placement="top">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<MenuIcon sx={{ fontSize: 18 }} />}
                        onClick={() => setPickingSettingsPanelOpen(true)}
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
                      pageType="picking"
                      isDarkMode={isDarkMode}
                      container={multiEntryContainerRef.current}
                    />
                  </Stack>
                </Stack>

                {/* SETTINGS DRAWER - Right Side Panel with Accordions */}
                <Drawer
                  anchor="right"
                  open={pickingSettingsPanelOpen}
                  onClose={() => setPickingSettingsPanelOpen(false)}
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
                    <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>⚙️ Settings</Typography>
                    <IconButton size="small" onClick={() => setPickingSettingsPanelOpen(false)} sx={{ color: 'white' }}>
                      <CloseIcon />
                    </IconButton>
                  </Box>

                  {/* Panel Content with Accordions */}
                  <Box sx={{ overflow: 'auto', flex: 1 }}>

                    {/* ═══════════ COLUMNS ACCORDION ═══════════ */}
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
                            {ALL_MASTER_COLUMNS.map((col) => (
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

                    {/* ═══════════ GRID SETTINGS ACCORDION ═══════════ */}
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
                                  localStorage.setItem('picking_enableSorting', String(e.target.checked));
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
                                  localStorage.setItem('picking_enableColumnFilters', String(e.target.checked));
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
                                  localStorage.setItem('picking_enableColumnResize', String(e.target.checked));
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
                              localStorage.setItem('picking_enableSorting', 'true');
                              localStorage.setItem('picking_enableColumnFilters', 'true');
                              localStorage.setItem('picking_enableColumnResize', 'true');
                              toast.success('Grid settings reset');
                            }}
                            sx={{ alignSelf: 'flex-start', fontSize: '0.75rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}
                          >
                            🔄 Reset to Default
                          </Button>
                        </Stack>
                      </AccordionDetails>
                    </Accordion>

                    {/* ═══════════ SHORTCUTS ACCORDION (Ctrl+O) ═══════════ */}
                    <Accordion
                      expanded={settingsPanelExpanded === 'shortcuts'}
                      onChange={(_, isExpanded) => setSettingsPanelExpanded(isExpanded ? 'shortcuts' : false)}
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
                          <LinkIcon sx={{ color: '#8b5cf6', fontSize: 22 }} />
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>Keyboard Shortcuts</Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Ctrl+O and more</Typography>
                          </Box>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                        <Stack spacing={1.5}>
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1.5,
                            borderRadius: 1.5,
                            bgcolor: ctrlOProductLinkEnabled ? (isDarkMode ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.08)') : (isDarkMode ? '#0f172a' : '#f8fafc'),
                            border: ctrlOProductLinkEnabled ? '1px solid #8b5cf6' : (isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0')
                          }}>
                            <Box>
                              <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>Ctrl+O Product Link</Typography>
                              <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Opens FKT link for last scanned WSN</Typography>
                            </Box>
                            <Switch
                              checked={ctrlOProductLinkEnabled}
                              onChange={(e) => {
                                const newValue = e.target.checked;
                                setCtrlOProductLinkEnabled(newValue);
                                ctrlOProductLinkEnabledRef.current = newValue;
                                localStorage.setItem('picking_ctrlOProductLinkEnabled', String(newValue));
                                toast.success(`Ctrl+O ${newValue ? 'enabled' : 'disabled'}`);
                              }}
                              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#8b5cf6' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#8b5cf6' } }}
                            />
                          </Box>
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
                          <DownloadIcon sx={{ color: '#8b5cf6', fontSize: 22 }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>Available Cache</Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                              {availableCacheLoading ? availableCacheProgress || 'Loading...' : availableCacheStats?.count ? `${availableCacheStats.count.toLocaleString()} items` : availableCacheEnabled ? 'Not loaded' : 'Disabled'}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={availableCacheLoading ? '...' : availableCacheStats?.count ? '✓' : '○'}
                            sx={{ height: 24, fontSize: '0.8rem', bgcolor: availableCacheStats?.count ? '#10b981' : '#64748b', color: 'white' }}
                          />
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                        <Stack spacing={1.5}>
                          <Alert severity="info" sx={{ fontSize: '0.75rem', py: 0.5 }}>
                            Cache available inventory for instant WSN lookup during Picking.
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
                            {availableCacheLoading ? 'Loading...' : 'Load Available Cache'}
                          </Button>
                          {availableCacheStats?.lastSync && (
                            <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8', textAlign: 'center' }}>
                              Last sync: {new Date(availableCacheStats.lastSync).toLocaleTimeString()}
                            </Typography>
                          )}
                        </Stack>
                      </AccordionDetails>
                    </Accordion>

                    {/* ═══════════ PIVOT BUTTON ═══════════ */}
                    <Box sx={{ p: 2, borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<PieChartIcon />}
                        onClick={() => { setCategoryPivotOpen(true); setPickingSettingsPanelOpen(false); }}
                        disabled={!multiRows.some((r: any) => r.wsn?.trim())}
                        sx={{
                          height: 44,
                          fontWeight: 600,
                          borderColor: '#7c3aed',
                          color: '#7c3aed',
                          '&:hover': { bgcolor: 'rgba(124, 58, 237, 0.1)', borderColor: '#7c3aed' },
                          '&.Mui-disabled': { borderColor: '#94a3b8', color: '#94a3b8' }
                        }}
                      >
                        Category Pivot View
                      </Button>
                    </Box>

                    {/* ═══════════ EXPORT BUTTON ═══════════ */}
                    <Box sx={{ p: 2, borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={() => { exportMultiEntryToExcel(); setPickingSettingsPanelOpen(false); }}
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

            {/* ERROR */}
            {crossWarehouseWSNs.size > 0 && (
              <Alert severity="error" sx={{ mb: 0.5, fontWeight: 700 }}>
                ❌ Some WSNs are already picked. Remove them to proceed.
              </Alert>
            )}

            {gridDuplicateWSNs.size > 0 && (
              <Alert severity="warning" sx={{ mb: 0.5, fontWeight: 700 }}>
                ⚠️ Duplicate WSNs found inside the grid.
              </Alert>
            )}

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
                '& .ag-root-wrapper': { borderRadius: 0, height: '100%', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', border: 'none' },

                // Professional dark header
                '& .ag-header': {
                  backgroundColor: isDarkMode ? '#1e3a5f' : '#1e3a5f',
                  borderBottom: isDarkMode ? '2px solid #f59e0b' : '2px solid #d97706',
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
              }}
            >
              <AgGridReact
                key={`multi-grid-${multiGridSettings.sortable}-${multiGridSettings.filter}-${multiGridSettings.resizable}-${multiGridSettings.editable}`}
                ref={gridRef}
                onGridReady={(params: any) => {
                  gridRef.current = params.api;
                  columnApiRef.current = params.columnApi;
                  setTimeout(() => {
                    try {
                      const colApi = columnApiRef.current;
                      if (!colApi) return;
                      const allCols = colApi.getAllColumns ? colApi.getAllColumns().map((c: any) => c.getColId()) : [];
                      if (allCols.length > 0) {
                        colApi.autoSizeColumns(allCols, false);
                        const api = gridRef.current;
                        let total = 0;
                        for (const id of allCols) {
                          const col = colApi.getColumn(id);
                          total += col?.getActualWidth ? col.getActualWidth() : 0;
                        }
                        const dims = api.getSize ? api.getSize() : (api.gridPanel && api.gridPanel.getBodyClientRect && api.gridPanel.getBodyClientRect());
                        const gridW = dims?.width || 0;
                        if (gridW && total < gridW) api.sizeColumnsToFit();
                      }
                    } catch { /* ignore */ }
                  }, 50);
                }}
                rowData={multiRows}
                columnDefs={columnDefs}
                rowHeight={tableRowHeight}
                headerHeight={32}
                getRowId={(params) => String(params.data.id)}
                defaultColDef={{
                  sortable: multiGridSettings.sortable,    // ✅ Apply grid settings
                  filter: multiGridSettings.filter,        // ✅ Apply grid settings
                  resizable: multiGridSettings.resizable,  // ✅ Apply grid settings
                  editable: (params) => {
                    // Check grid settings first
                    if (!multiGridSettings.editable) return false;

                    const field = params.colDef.field as string;
                    const wsn = params.data?.wsn?.trim()?.toUpperCase();

                    if (!wsn) return EDITABLE_COLUMNS.includes(field);
                    if (crossWarehouseWSNs.has(wsn)) return false;
                    if (gridDuplicateWSNs.has(wsn)) return field === 'wsn';
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

                stopEditingWhenCellsLoseFocus={true}
                enterNavigatesVertically={true}
                enterNavigatesVerticallyAfterEdit={true}
                navigateToNextCell={navigateToNextCell}
                ensureDomOrder={true}
                suppressMovableColumns={true}
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
                //theme="legacy"
                className="ag-theme-quartz"
                containerStyle={{ height: '100%', width: '100%' }}
                // ✅ Save column widths when resized
                onColumnResized={(params: any) => {
                  if (params.finished && params.column) {
                    const colId = params.column.getColId();
                    const newWidth = params.column.getActualWidth();
                    // Don't save special columns
                    if (colId === 'sno') return;

                    setMultiColumnWidths(prev => {
                      const updated = { ...prev, [colId]: newWidth };
                      localStorage.setItem('pickingMultiEntryColumnWidths', JSON.stringify(updated));
                      return updated;
                    });
                  }
                }}
                onGridSizeChanged={() => {
                  // Only sizeColumnsToFit if no saved widths - don't auto-size if user has customized widths
                  try {
                    const hasSavedWidths = Object.keys(multiColumnWidths).length > 0;
                    if (hasSavedWidths) return; // Respect user's saved column widths

                    const colApi = columnApiRef.current;
                    const api = gridRef.current;
                    if (!colApi || !api) return;
                    // Only fit to grid width if columns are narrower than grid
                    const allCols = colApi.getAllColumns ? colApi.getAllColumns().map((c: any) => c.getColId()) : [];
                    if (!allCols || allCols.length === 0) return;
                    let total = 0;
                    for (const id of allCols) {
                      const col = colApi.getColumn(id);
                      total += col?.getActualWidth ? col.getActualWidth() : 0;
                    }
                    const dims = api.getSize ? api.getSize() : null;
                    const gridW = dims?.width || 0;
                    if (gridW && total < gridW) api.sizeColumnsToFit();
                  } catch { /* ignore */ }
                }}
                onFirstDataRendered={() => {
                  // Only auto-size columns on first render if no saved widths exist
                  if (multiGridInitializedRef.current) return;
                  multiGridInitializedRef.current = true;

                  try {
                    const hasSavedWidths = Object.keys(multiColumnWidths).length > 0;
                    if (hasSavedWidths) return; // Respect user's saved column widths

                    const colApi = columnApiRef.current;
                    const api = gridRef.current;
                    if (!colApi || !api) return;
                    const allCols = colApi.getAllColumns ? colApi.getAllColumns().map((c: any) => c.getColId()) : [];
                    if (allCols.length === 0) return;
                    colApi.autoSizeColumns(allCols, false);
                    let total = 0;
                    for (const id of allCols) {
                      const col = colApi.getColumn(id);
                      total += col?.getActualWidth ? col.getActualWidth() : 0;
                    }
                    const dims = api.getSize ? api.getSize() : null;
                    const gridW = dims?.width || 0;
                    if (gridW && total < gridW) api.sizeColumnsToFit();
                  } catch { /* ignore */ }
                }}

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
                    pendingWSNRef.current = { wsn, rowIndex, event };
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

                  // If WSN is cleared/deleted, reset all product fields
                  if (!wsn) {
                    // Clear all product and master data fields
                    node.setDataValue('product_title', '');
                    node.setDataValue('brand', '');
                    node.setDataValue('cms_vertical', '');
                    node.setDataValue('fsp', '');
                    node.setDataValue('mrp', '');
                    node.setDataValue('rack_no', '');
                    node.setDataValue('source', '');
                    node.setDataValue('batch_id', '');
                    node.setDataValue('hsn_sac', '');
                    node.setDataValue('igst_rate', '');
                    node.setDataValue('p_type', '');
                    node.setDataValue('p_size', '');
                    node.setDataValue('vrp', '');
                    node.setDataValue('wid', '');
                    node.setDataValue('fsn', '');
                    node.setDataValue('order_id', '');
                    node.setDataValue('fkqc_remark', '');
                    node.setDataValue('fk_grade', '');
                    node.setDataValue('invoice_date', '');
                    node.setDataValue('fkt_link', '');
                    node.setDataValue('wh_location', '');
                    node.setDataValue('yield_value', '');
                    node.setDataValue('product_serial_number', '');

                    // Also update React state
                    setMultiRows((prev) => {
                      const rows = [...prev];
                      rows[rowIndex] = {
                        ...rows[rowIndex],
                        wsn: '',
                        product_title: '',
                        brand: '',
                        cms_vertical: '',
                        fsp: '',
                        mrp: '',
                        rack_no: '',
                        source: '',
                        batch_id: '',
                        hsn_sac: '',
                        igst_rate: '',
                        p_type: '',
                        p_size: '',
                        vrp: '',
                        wid: '',
                        fsn: '',
                        order_id: '',
                        fkqc_remark: '',
                        fk_grade: '',
                        invoice_date: '',
                        fkt_link: '',
                        wh_location: '',
                        yield_value: '',
                        product_serial_number: ''
                      };
                      checkDuplicates(rows);
                      return rows;
                    });
                    return; // Exit early after clearing fields
                  }

                  // Immediate grid-level duplicate or existing pick check
                  const immediateCounts = new Map<string, number>();
                  multiRows.forEach((r: any) => {
                    const rv = r.wsn?.trim()?.toUpperCase();
                    if (rv) immediateCounts.set(rv, (immediateCounts.get(rv) || 0) + 1);
                  });

                  const isGridDuplicateImmediate = (immediateCounts.get(wsn) || 0) > 1;

                  if (isGridDuplicateImmediate) {
                    // Styled toast like QC/Inbounds
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
                      icon: '🚫',
                    });

                    // Clear the cell and master columns
                    node.setDataValue('wsn', '');
                    ALL_MASTER_COLUMNS.forEach((col) => {
                      node.setDataValue(col, null);
                    });
                    node.setDataValue('product_serial_number', null);

                    // Update react state
                    setMultiRows((prev) => {
                      const rows = [...prev];
                      rows[rowIndex] = { ...rows[rowIndex], wsn: '' };
                      ALL_MASTER_COLUMNS.forEach(col => (rows[rowIndex][col] = null));
                      rows[rowIndex]['product_serial_number'] = null;
                      checkDuplicates(rows);
                      return rows;
                    });

                    // Re-focus same cell for quick correction
                    setTimeout(() => {
                      event.api.startEditingCell({
                        rowIndex: rowIndex,
                        colKey: 'wsn',
                      });
                    }, 100);

                    return;
                  }

                  if (existingPickingWSNs.has(wsn)) {
                    // Determine whether it's in this warehouse or another warehouse
                    try {
                      const resp = await pickingAPI.checkWSNExists(wsn, activeWarehouse?.id);
                      const existsHere = resp.data?.exists;

                      if (existsHere) {
                        // Same-warehouse duplicate -> warn + clear
                        toast(`WSN ${wsn} already picked in this warehouse`, {
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
                          icon: '🚫',
                        });

                      } else {
                        // Cross-warehouse -> error + clear
                        toast.error(`WSN ${wsn} already picked in another warehouse`, {
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
                      }

                      // Clear cell + master fields and update state
                      node.setDataValue('wsn', '');
                      ALL_MASTER_COLUMNS.forEach((col) => {
                        node.setDataValue(col, null);
                      });
                      node.setDataValue('product_serial_number', null);

                      setMultiRows((prev) => {
                        const rows = [...prev];
                        rows[rowIndex] = { ...rows[rowIndex], wsn: '' };
                        ALL_MASTER_COLUMNS.forEach(col => (rows[rowIndex][col] = null));
                        rows[rowIndex]['product_serial_number'] = null;
                        checkDuplicates(rows);
                        return rows;
                      });

                      // Re-focus same cell
                      setTimeout(() => {
                        event.api.startEditingCell({ rowIndex: rowIndex, colKey: 'wsn' });
                      }, 100);

                      return;
                    } catch (err) {
                      // On API error, fall through to master data fetch (best-effort)
                    }
                  }

                  try {
                    const res = await pickingAPI.getSourceByWSN(
                      wsn,
                      activeWarehouse?.id
                    );

                    const d = res.data;
                    console.log('BACKEND DATA:', d);

                    // GUARD: ensure cell wasn't cleared in the meantime
                    const currentWsn = node?.data?.wsn?.trim()?.toUpperCase();
                    if (!currentWsn || currentWsn !== wsn) return;

                    // ðŸ”¥ UPDATE AG GRID CELLS DIRECTLY
                    node.setDataValue('product_title', d.product_title ?? '');
                    node.setDataValue('brand', d.brand ?? '');
                    node.setDataValue('cms_vertical', d.cms_vertical ?? '');
                    node.setDataValue('fsp', d.fsp ?? '');
                    node.setDataValue('mrp', d.mrp ?? '');
                    node.setDataValue('rack_no', d.rack_no ?? '');
                    node.setDataValue('hsn_sac', d.hsn_sac ?? '');
                    node.setDataValue('igst_rate', d.igst_rate ?? '');
                    node.setDataValue('p_type', d.p_type ?? '');
                    node.setDataValue('p_size', d.p_size ?? '');
                    node.setDataValue('vrp', d.vrp ?? '');
                    node.setDataValue('wid', d.wid ?? '');
                    node.setDataValue('fsn', d.fsn ?? '');
                    node.setDataValue('order_id', d.order_id ?? '');
                    node.setDataValue('fkqc_remark', d.fkqc_remark ?? '');
                    node.setDataValue('fk_grade', d.fk_grade ?? '');
                    node.setDataValue('invoice_date', d.invoice_date ?? '');
                    node.setDataValue('fkt_link', d.fkt_link ?? '');
                    node.setDataValue('wh_location', d.wh_location ?? '');
                    node.setDataValue('yield_value', d.yield_value ?? '');
                    node.setDataValue('source', d.source ?? '');

                    // ⚡ Track last scanned row for Ctrl+O product link
                    lastScannedRowRef.current = {
                      wsn,
                      fkt_link: d.fkt_link ?? '',
                      product_title: d.product_title ?? '',
                    };

                    // ðŸ”¥ ALSO UPDATE REACT STATE FOR CONSISTENCY
                    setMultiRows((prev) => {
                      const rows = [...prev];
                      rows[rowIndex] = {
                        ...rows[rowIndex],
                        wsn,
                        product_title: d.product_title ?? '',
                        brand: d.brand ?? '',
                        cms_vertical: d.cms_vertical ?? '',
                        fsp: d.fsp ?? '',
                        mrp: d.mrp ?? '',
                        rack_no: d.rack_no ?? '',
                        hsn_sac: d.hsn_sac ?? '',
                        igst_rate: d.igst_rate ?? '',
                        p_type: d.p_type ?? '',
                        p_size: d.p_size ?? '',
                        vrp: d.vrp ?? '',
                        wid: d.wid ?? '',
                        fsn: d.fsn ?? '',
                        order_id: d.order_id ?? '',
                        fkqc_remark: d.fkqc_remark ?? '',
                        fk_grade: d.fk_grade ?? '',
                        invoice_date: d.invoice_date ?? '',
                        fkt_link: d.fkt_link ?? '',
                        wh_location: d.wh_location ?? '',
                        yield_value: d.yield_value ?? '',
                        source: d.source ?? ''
                      };
                      checkDuplicates(rows);
                      return rows;
                    });
                  } catch (err: any) {
                    console.error('Picking source fetch error:', err);

                    // If not found in picking sources, try inbound master data as a fallback
                    if (err?.response?.status === 404) {
                      try {
                        const inboundResp = await inboundAPI.getMasterDataByWSN(wsn);
                        const md = inboundResp.data;

                        // Update grid cells from inbound master data
                        node.setDataValue('product_title', md.product_title ?? '');
                        node.setDataValue('brand', md.brand ?? '');
                        node.setDataValue('cms_vertical', md.cms_vertical ?? '');
                        node.setDataValue('fsp', md.fsp ?? '');
                        node.setDataValue('mrp', md.mrp ?? '');
                        node.setDataValue('rack_no', md.rack_no ?? '');
                        node.setDataValue('hsn_sac', md.hsn_sac ?? '');
                        node.setDataValue('igst_rate', md.igst_rate ?? '');
                        node.setDataValue('p_type', md.p_type ?? '');
                        node.setDataValue('p_size', md.p_size ?? '');
                        node.setDataValue('vrp', md.vrp ?? '');
                        node.setDataValue('wid', md.wid ?? '');
                        node.setDataValue('fsn', md.fsn ?? '');
                        node.setDataValue('order_id', md.order_id ?? '');
                        node.setDataValue('fkqc_remark', md.fkqc_remark ?? '');
                        node.setDataValue('fk_grade', md.fk_grade ?? '');
                        node.setDataValue('invoice_date', md.invoice_date ?? '');
                        node.setDataValue('fkt_link', md.fkt_link ?? '');
                        node.setDataValue('wh_location', md.wh_location ?? '');
                        node.setDataValue('yield_value', md.yield_value ?? '');
                        node.setDataValue('source', md.source ?? '');

                        // Also update React state
                        setMultiRows((prev) => {
                          const rows = [...prev];
                          rows[rowIndex] = {
                            ...rows[rowIndex],
                            wsn,
                            product_title: md.product_title ?? '',
                            brand: md.brand ?? '',
                            cms_vertical: md.cms_vertical ?? '',
                            fsp: md.fsp ?? '',
                            mrp: md.mrp ?? '',
                            rack_no: md.rack_no ?? '',
                            hsn_sac: md.hsn_sac ?? '',
                            igst_rate: md.igst_rate ?? '',
                            p_type: md.p_type ?? '',
                            p_size: md.p_size ?? '',
                            vrp: md.vrp ?? '',
                            wid: md.wid ?? '',
                            fsn: md.fsn ?? '',
                            order_id: md.order_id ?? '',
                            fkqc_remark: md.fkqc_remark ?? '',
                            fk_grade: md.fk_grade ?? '',
                            invoice_date: md.invoice_date ?? '',
                            fkt_link: md.fkt_link ?? '',
                            wh_location: md.wh_location ?? '',
                            yield_value: md.yield_value ?? '',
                            source: md.source ?? ''
                          };
                          checkDuplicates(rows);
                          return rows;
                        });

                        toast.success(`Source data loaded from Inbound for ${wsn}`);
                        return;
                      } catch (inErr) {
                        console.error('Inbound fallback failed:', inErr);
                      }
                    }

                    toast.error(`WSN ${wsn} not found`);
                    node.setDataValue('wsn', '');
                    setTimeout(() => {
                      event.api.startEditingCell({ rowIndex: rowIndex, colKey: 'wsn' });
                    }, 100);
                  }
                }}

              />
            </Box>

            {/* DRAFT STATUS + SELECTION STATS + ACTIONS + SUBMIT */}
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
                      sx={{ height: 32, minWidth: 'auto', px: 1, fontSize: '0.7rem', fontWeight: 600, borderColor: '#ec4899', color: '#ec4899', '&:hover': { borderColor: '#db2777', bgcolor: 'rgba(236,72,153,0.08)' } }}
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
                disabled={multiLoading || gridDuplicateWSNs.size > 0 || crossWarehouseWSNs.size > 0}
                startIcon={multiLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <CheckCircle sx={{ fontSize: 16 }} />}
                sx={{
                  flexShrink: 0,
                  height: 36,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  px: 1.5,
                  minWidth: 100,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
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
              {/* ⚡ EXCEL-LIKE: Selection Statistics */}
              {selectionStats && (
                <Box sx={{
                  display: 'flex',
                  gap: 1.5,
                  alignItems: 'center',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                  border: isDarkMode ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                }}>
                  <Typography sx={{ fontSize: '0.75rem', color: isDarkMode ? '#fbbf24' : '#d97706', fontWeight: 600 }}>
                    Count: {selectionStats.count}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: isDarkMode ? '#fbbf24' : '#d97706', fontWeight: 600 }}>
                    Sum: {selectionStats.sum.toLocaleString()}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: isDarkMode ? '#fbbf24' : '#d97706', fontWeight: 600 }}>
                    Avg: {selectionStats.average.toLocaleString()}
                  </Typography>
                </Box>
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
                  borderColor: '#ec4899',
                  color: '#ec4899',
                  '&:hover': {
                    borderColor: '#db2777',
                    bgcolor: 'rgba(236, 72, 153, 0.1)'
                  }
                }}
              >
                +500 Rows
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
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)'
                }}
              >
                SUBMIT ALL ({multiRows.filter((r) => r.wsn?.trim()).length} rows)
              </Button>
            </Box>
          </Box>
        )}

        {/* COLUMN SETTINGS DIALOG - Outside flex container */}
        <Dialog
          open={columnSettingsOpen}
          onClose={() => setColumnSettingsOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)', color: 'white', py: 2 }}>
            ⚙️ Column Settings
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                Editable Columns
              </Typography>

              {/* Locked S.No column - always visible */}
              <FormControlLabel
                key="sno"
                control={<Checkbox checked={visibleColumns.includes('sno')} disabled />}
                label="S. No"
              />

              {EDITABLE_COLUMNS.map((col) => (
                <FormControlLabel
                  key={col}
                  control={
                    <Checkbox
                      checked={visibleColumns.includes(col)}
                      onChange={() => {
                        if (visibleColumns.includes(col)) {
                          if (visibleColumns.length === 1) {
                            toast.error('At least one column must be visible');
                            return;
                          }
                          setVisibleColumns(visibleColumns.filter(c => c !== col));
                        } else {
                          setVisibleColumns([...visibleColumns, col]);
                        }
                      }}
                    />
                  }
                  label={col.replace(/_/g, ' ').toUpperCase()}
                />
              ))}

              <Divider sx={{ my: 1 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                Master Data Columns (Read-only)
              </Typography>
              {ALL_MASTER_COLUMNS.map((col) => (
                <FormControlLabel
                  key={col}
                  control={
                    <Checkbox
                      checked={visibleColumns.includes(col)}
                      onChange={() => {
                        if (visibleColumns.includes(col)) {
                          setVisibleColumns(visibleColumns.filter(c => c !== col));
                        } else {
                          setVisibleColumns([...visibleColumns, col]);
                        }
                      }}
                    />
                  }
                  label={col.replace(/_/g, ' ').toUpperCase()}
                />
              ))}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setColumnSettingsOpen(false)} variant="outlined">Close</Button>
            <Button onClick={() => setVisibleColumns(DEFAULT_MULTI_COLUMNS)} variant="contained" sx={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)' }}>
              Reset to Default
            </Button>
          </DialogActions>
        </Dialog>

        {/* ========== MULTI ENTRY GRID SETTINGS DIALOG ========== */}
        <Dialog
          open={multiGridSettingsOpen}
          onClose={() => setMultiGridSettingsOpen(false)}
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
                      sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
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
                      sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
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
                      checked={multiGridSettings.resizable}
                      onChange={(e) => updateMultiGridSettings({ ...multiGridSettings, resizable: e.target.checked })}
                      sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
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
                updateMultiGridSettings(defaultSettings);
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

            <Button onClick={() => setMultiGridSettingsOpen(false)} sx={{ fontWeight: 700 }}>Close</Button>
            <Button onClick={() => setMultiGridSettingsOpen(false)} variant="contained" sx={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)', color: '#fff' }}>Done</Button>
          </DialogActions>
        </Dialog>

        {/* ========== CATEGORY PIVOT DIALOG ========== */}
        <Dialog
          open={categoryPivotOpen}
          onClose={() => setCategoryPivotOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
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
                {pivotGroupBy === 'brand' ? 'Brand' : 'Category'} Quantity Summary
              </Typography>
            </Box>
            <Chip
              label={`${categoryPivotData.grandTotal.qty} Items`}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontWeight: 700,
              }}
            />
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
                  onClick={() => setPivotGroupBy('category')}
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
                  ðŸ“ Category
                </Button>
                <Button
                  size="small"
                  variant={pivotGroupBy === 'brand' ? 'contained' : 'outlined'}
                  onClick={() => setPivotGroupBy('brand')}
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
                  ðŸ·ï¸ Brand
                </Button>
              </Box>
            </Box>

            {categoryPivotData.categories.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  No scanned items found. Start scanning WSNs to see {pivotGroupBy} summary.
                </Typography>
              </Box>
            ) : (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
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
                        {pivotGroupBy === 'brand' ? 'Brand' : 'Category'} {categoryPivotSortBy === 'category' && (categoryPivotSortDir === 'asc' ? '^' : 'v')}
                      </TableCell>
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
                        Qty {categoryPivotSortBy === 'qty' && (categoryPivotSortDir === 'asc' ? '^' : 'v')}
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
                        Total FSP {categoryPivotSortBy === 'fsp' && (categoryPivotSortDir === 'asc' ? '^' : 'v')}
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
                        Total MRP {categoryPivotSortBy === 'mrp' && (categoryPivotSortDir === 'asc' ? '^' : 'v')}
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
              disabled={categoryPivotData.categories.length === 0}
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

        {/* ========== TAB 2: BATCH MANAGEMENT ========== */}
        {currentTabCode === 'batches' && (
          <BatchManagementTab
            batches={batches}
            loading={batchLoading}
            onRefresh={loadBatches}
            onDelete={canSeeButton('batches:delete') ? handleDeleteBatch : undefined}
            canDelete={canSeeButton('batches:delete')}
            title="Batch Management"
            emptyMessage="No batches found"
            emptySubMessage="Batches will appear here after picking operations"
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
                    {brandOptions.map((b) => (
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
                    {categoryOptions.map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </TextField>

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
                    <MenuItem value="QC">QC</MenuItem>
                    <MenuItem value="INBOUND">INBOUND</MenuItem>
                    <MenuItem value="MASTER">MASTER</MenuItem>
                  </TextField>

                  {/* Customer Filter */}
                  <TextField
                    select
                    size="small"
                    label="Customer"
                    value={customerFilter}
                    onChange={(e) => { setCustomerFilter(e.target.value); setPage(1); }}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        height: 40,
                        bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                      }
                    }}
                  >
                    <MenuItem value="">All Customers</MenuItem>
                    {pickingCustomers.map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
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
                        onChange={(e) => setEnableSorting(e.target.checked)}
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
                        onChange={(e) => setEnableColumnFilters(e.target.checked)}
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
                        onChange={(e) => setEnableColumnResize(e.target.checked)}
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
                          loadBatches();
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
                    loadPickingList({ buttonRefresh: true });
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


