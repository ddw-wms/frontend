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
  Collapse, IconButton, AppBar, Toolbar, useMediaQuery, useTheme // Add these
} from '@mui/material';

import {
  Add as AddIcon, Download as DownloadIcon, Upload as UploadIcon,
  Settings as SettingsIcon, CheckCircleOutline as CheckIcon, Info as InfoIcon,
  Delete as DeleteIcon, Refresh as RefreshIcon,
  CheckCircle,
  ExpandMore as ExpandMoreIcon, // Add this
  FilterList as FilterListIcon, // Add this
  Close as CloseIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';

import { inboundAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import { StandardPageHeader, StandardTabs } from '@/components';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import Tooltip from '@mui/material/Tooltip';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { printLabel, isAgentRunning } from '@/lib/printAgent';
import { usePermissionGuard } from '@/hooks/usePermissionGuard';
import { usePermissions } from '@/app/context/PermissionsContext';

// Constants
const DEFAULT_MULTI_COLUMNS = [
  'wsn',
  'product_serial_number',
  'rack_no',
  'unload_remarks'
];

const ALL_MASTER_COLUMNS = ['wid', 'fsn', 'order_id', 'product_title', 'brand', 'mrp', 'fsp', 'hsn_sac', 'igst_rate', 'cms_vertical', 'fkt_link', 'p_type', 'p_size', 'vrp', 'yield_value'];
const INBOUND_LIST_COLUMNS = [
  'wsn',
  'product_title',
  'brand',
  'cms_vertical',
  'fsp',
  'mrp',
  'inbound_date',
  'vehicle_no',
  'rack_no',
  'quantity',
  'batch_id',
  'product_serial_number',
  'unload_remarks',
  'created_user_name',
  'fkqc_remark',
  'fk_grade'
];

const EDITABLE_COLUMNS = ['wsn', 'product_serial_number', 'rack_no', 'unload_remarks'];

import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import React from 'react';
import localforage from 'localforage';

// Register AG Grid modules ONCE
ModuleRegistry.registerModules([AllCommunityModule]);

export default function InboundPage() {
  // Role guard - only admin, manager, operator can access
  const { loading: permissionLoading } = usePermissionGuard('view_inbound');

  // Permission checks
  const { hasPermission } = usePermissions();

  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);
  const [tabValue, setTabValue] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<any>(null);
  const columnApiRef = useRef<any>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [agentReady, setAgentReady] = useState(false);

  //state variables for responsive UI
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
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

  // ====== BULK UPLOAD STATE ======
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkCurrentBatch, setBulkCurrentBatch] = useState<any>(null);
  const [bulkErrors, setBulkErrors] = useState<any[]>([]);
  const [bulkErrorsOpen, setBulkErrorsOpen] = useState(false);

  // ====== MULTI ENTRY STATE ======
  const generateEmptyRows = (count: number) => {
    return Array.from({ length: count }, () => ({
      wsn: '',
      inbound_date: new Date().toISOString().split('T')[0],
      vehicle_no: '',
      product_serial_number: '',
      rack_no: '',
      unload_remarks: ''
    }));
  };

  const [multiRows, setMultiRows] = useState<any[]>(generateEmptyRows(50));
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiResults, setMultiResults] = useState<any[]>([]);
  const [duplicateWSNs, setDuplicateWSNs] = useState<Set<string>>(new Set());

  // ---- Draft / Autosave (IndexedDB via localForage) ----
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftExists, setDraftExists] = useState(false);
  const lastChangeAtRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  }, []);

  // ✅ SAVE to localStorage whenever settings change
  const updateGridSettings = (newSettings: typeof gridSettings) => {
    setGridSettings(newSettings);
    localStorage.setItem('qc_grid_settings', JSON.stringify(newSettings));
    console.log('💾 Grid settings saved:', newSettings);
  };

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
    const savedVehicle = localStorage.getItem('lastVehicleNumber');
    if (savedVehicle) {
      setSingleForm(prev => ({ ...prev, vehicle_no: savedVehicle }));
      setCommonVehicle(savedVehicle);
    }
  }, []);

  const saveVehicleNumber = (vehicle: string) => {
    if (vehicle.trim()) {
      localStorage.setItem('lastVehicleNumber', vehicle);
    }
  };

  // ====== LOAD COLUMN SETTINGS FROM LOCALSTORAGE ======
  useEffect(() => {
    const saved = localStorage.getItem('multiEntryColumns');

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
      toast.success('Draft cleared');
    } catch (err) {
      console.error('Failed to clear draft', err);
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
          // Apply defaults for missing fields
          const restored = draft.rows.map((r: any) => ({
            inbound_date: r.inbound_date || commonDate,
            vehicle_no: r.vehicle_no || commonVehicle,
            ...r,
          }));
          setMultiRows(restored);
          setDraftSavedAt(draft.savedAt || Date.now());
          setDraftExists(true);
          toast.success('✓ Draft restored');
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
      valueGetter: (params: any) => (params.node ? params.node.rowIndex + 1 : undefined),
      width: 80,
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
  }, [listColumns, formatInboundDate]);

  const inboundDefaultColDef = useMemo(() => ({
    sortable: gridSettings.sortable,
    filter: gridSettings.filter,
    resizable: gridSettings.resizable,
    editable: gridSettings.editable,
    suppressMovable: true,
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
    if (tabValue !== 0) return;
    const colApi = columnApiRef.current;
    if (!colApi) return;

    setTimeout(() => {
      try {
        const allCols = colApi.getAllColumns().map((c: any) => c.getId());
        colApi.autoSizeColumns(allCols, false);
      } catch (err) {
        gridRef.current?.api.sizeColumnsToFit();
      }
    }, 80);
  }, [tabValue, listColumns, listData.length]);

  // ====== INBOUND LIST & helper loaders ======
  const loadInboundList = useCallback(async ({ buttonRefresh = false } = {}) => {
    const t0 = Date.now();

    // Mark this request id so we can ignore stale responses
    currentLoadIdRef.current += 1;
    const loadId = currentLoadIdRef.current;

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
        setListData(response.data.data);
        setTotal(response.data.total);

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
  }, [activeWarehouse?.id, page, limit, searchFilter, brandFilter, categoryFilter, dateFromFilter, dateToFilter, router]);

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
      setBatches(response.data);
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
  useEffect(() => {
    if (activeWarehouse && (tabValue === 0 || tabValue === 1)) {
      loadRacks();
      loadBatches();
      loadBrands();
      loadCategories();
      if (tabValue === 0) loadInboundList();
    }
  }, [activeWarehouse, tabValue, loadRacks, loadBatches, loadBrands, loadCategories, loadInboundList]);

  useEffect(() => {
    if (activeWarehouse && tabValue === 0) {
      // Debounce list loads when filters/search/page change to avoid rapid overlay flicker
      if (listLoadDebounceRef.current) clearTimeout(listLoadDebounceRef.current);
      listLoadDebounceRef.current = setTimeout(() => {
        loadInboundList();
        listLoadDebounceRef.current = null;
      }, 350);
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

      console.log(`🖨️ Printing WSN: ${wsn}`);

      // Get copy count from settings (fallback to 1)
      const copies = 1;

      const success = await printLabel({
        wsn,
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

        // Trigger print if agent is ready
        if (agentReady && masterData) {
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
  const downloadTemplate = () => {
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

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      toast.error('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', bulkFile);
    formData.append('warehouse_id', activeWarehouse?.id?.toString() || '');
    formData.append('created_by', user?.id?.toString() || '');

    setBulkLoading(true);
    setBulkErrors([]);
    try {
      const response = await inboundAPI.bulkUpload(formData);
      setBulkCurrentBatch({
        id: response.data.batchId,
        total: response.data.totalRows,
        timestamp: response.data.timestamp
      });

      toast.success(`✓ Batch started: ${response.data.batchId}`);
      setBulkFile(null);

      setTimeout(() => {
        setBulkCurrentBatch(null);
        loadBatches();
        loadInboundList();
      }, 5000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Upload failed';
      toast.error(errorMsg);
      if (error.response?.data?.errors) {
        setBulkErrors(error.response.data.errors);
        setBulkErrorsOpen(true);
      }
    } finally {
      setBulkLoading(false);
    }
  };

  // ====== MULTI ENTRY FUNCTIONS ======
  const addMultiRow = () => {
    const newRows = [
      ...multiRows,
      {
        wsn: '',
        inbound_date: commonDate,
        vehicle_no: commonVehicle,
        product_serial_number: '',
        rack_no: '',
        unload_remarks: ''
      }
    ];

    setMultiRows(newRows);

    // Give React/AG Grid a moment to render, then ensure the new row is visible (Excel-like behavior)
    setTimeout(() => {
      try {
        const api = gridRef.current;
        if (api && newRows.length > 0) {
          api.ensureIndexVisible(newRows.length - 1, 'bottom');
        }
      } catch (e) { /* ignore */ }
    }, 50);
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


  const add30Rows = () => {
    const newRows = generateEmptyRows(30).map(row => ({
      ...row,
      inbound_date: commonDate,
      vehicle_no: commonVehicle
    }));
    setMultiRows([...multiRows, ...newRows]);
    //toast.success('✓ Added 30 rows');
  };


  const checkDuplicates = async (rows: any[]) => {
    const gridDup = new Set<string>();
    const crossWh = new Set<string>();
    const wsnCount = new Map<string, number>();

    // 1) Grid-level duplicates
    rows.forEach(row => {
      if (!row.wsn?.trim()) return;

      const wsn = row.wsn.trim().toUpperCase();

      wsnCount.set(wsn, (wsnCount.get(wsn) || 0) + 1);
      if (wsnCount.get(wsn)! > 1) {
        gridDup.add(wsn);
      }
    });

    // 2) Cross-warehouse check: for unique WSNs query the API and verify warehouse ownership
    const uniqueWsns = Array.from(new Set(rows.map(r => r.wsn?.trim().toUpperCase()).filter(Boolean)));

    await Promise.all(uniqueWsns.map(async (wsn) => {
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

          // Auto-print if no duplicates
          const wsn = wsnUpper;
          const isGridDup = gridDuplicateWSNs.has(wsn);
          const isCrossWh = crossWarehouseWSNs.has(wsn);

          if (!isGridDup && !isCrossWh && agentReady) {
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

  const navigateToNextCell = (params: any) => {
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
  };



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

      // Reset grid to 10 rows
      setMultiRows(generateEmptyRows(10));

      // Clear saved draft after successful submit
      await clearDraft();

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
    fkqc_remark: { flex: 1, minWidth: 180 },
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
        return <span style={{ fontWeight: 700, color: '#64748b' }}>{params.node.rowIndex + 1}</span>;
      },
      cellStyle: { textAlign: 'center', backgroundColor: '#f8fafc' }
    };

    return [
      rowNumberCol,
      ...visibleColumns.map(col => {
        const isEditable = EDITABLE_COLUMNS.includes(col);

        const baseColDef: any = {
          field: col,
          headerName: col.replace(/_/g, ' ').toUpperCase(),
          editable: isEditable,
          suppressSizeToFit: true,
          resizable: true,
          minWidth: 80
        };

        const columnWidthConfig = COLUMN_WIDTHS[col] || {};

        if (col === 'rack_no' && isEditable) { // ✅ Added isEditable check
          return {
            ...baseColDef,
            width: 110,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: { values: racks.map(r => r.rack_name) }
          };
        } else if (col.includes('date')) {
          return {
            ...baseColDef,
            width: 130,
            cellDataType: 'date'
          };
        } else {

          return {
            ...baseColDef,
            ...columnWidthConfig,

            cellRenderer: (params: any) => {

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
      })
    ];
  },
    [visibleColumns, racks, gridDuplicateWSNs, crossWarehouseWSNs, COLUMN_WIDTHS]
  );

  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const handleConfirmDownload = () => {
    downloadTemplate();
    setConfirmOpen(false);
  };

  // Show loading state while permissions are being checked
  if (permissionLoading) {
    return (
      <AppLayout>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh'
        }}>
          <CircularProgress />
        </Box>
      </AppLayout>
    );
  }

  if (!activeWarehouse) {
    return (
      <AppLayout>
        <Box sx={{ p: 6, textAlign: 'center', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <Box sx={{ p: 5, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 4, color: 'white', boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4)' }}>
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
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
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
          tabs={['Inbound List', 'Single Entry', 'Bulk Upload', 'Multi Entry', 'Batch Manager']}
          color="#667eea"
        />

        {/* ✅ NEW: Scrollable Content Wrapper */}
        <Box sx={{
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
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              background: 'white',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              //overflow: 'hidden',
            }}
          >
            {/* ==================== TAB 0: INBOUND LIST ==================== */}
            {tabValue === 0 && (
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
                        }, MIN_LOADING_MS);
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
                          bgcolor: 'white',
                          borderRadius: 1.5,
                          height: 38,
                          fontSize: { xs: '0.8rem', sm: '0.875rem' },
                          fontWeight: 500,
                          border: '2px solid #e2e8f0',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          '&:hover': {
                            borderColor: '#cbd5e1',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          },
                          '&.Mui-focused': {
                            borderColor: '#667eea',
                            boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)'
                          },
                          '& fieldset': {
                            border: 'none'
                          },
                          '& input': {
                            py: 0.75
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
                        size: 'small', height: 38, px: 2.5, textTransform: 'none'
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
                        borderColor: filtersExpanded ? '#667eea' : '#cbd5e1',
                        bgcolor: filtersExpanded ? 'rgba(102, 126, 234, 0.1)' : 'white',
                        color: filtersExpanded ? '#667eea' : '#64748b',
                        fontWeight: 700,
                        fontSize: { xs: '0.7rem', sm: '0.78rem' },
                        borderRadius: 1.5,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        transition: 'all 0.2s',
                        px: { xs: 1, sm: 1.5 },
                        '&:hover': {
                          borderWidth: 2,
                          borderColor: '#667eea',
                          bgcolor: 'rgba(102, 126, 234, 0.15)',
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)'
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
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                      border: '1px solid #e2e8f0',
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
                                  bgcolor: 'white',
                                  '&:hover fieldset': { borderColor: '#667eea' },
                                  '&.Mui-focused fieldset': { borderColor: '#667eea' }
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
                                  bgcolor: 'white',
                                  '&:hover fieldset': { borderColor: '#667eea' },
                                  '&.Mui-focused fieldset': { borderColor: '#667eea' }
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
                                  bgcolor: 'white',
                                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' },
                                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' }
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
                                  bgcolor: 'white',
                                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' },
                                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' }
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
                                borderColor: '#94a3b8',
                                color: '#64748b',
                                '&:hover': {
                                  borderWidth: 2,
                                  borderColor: '#64748b',
                                  bgcolor: '#f8fafc'
                                }
                              }}
                            >
                              🔄 RESET
                            </Button>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <Button
                                fullWidth
                                size="small"
                                startIcon={<SettingsIcon sx={{ fontSize: '0.9rem' }} />}
                                variant="outlined"
                                onClick={() => setListColumnSettingsOpen(true)}
                                sx={{
                                  height: 34,
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  borderWidth: 2,
                                  borderColor: '#667eea',
                                  color: '#667eea',
                                  '&:hover': {
                                    borderWidth: 2,
                                    bgcolor: 'rgba(102, 126, 234, 0.1)'
                                  }
                                }}
                              >
                                COLUMNS
                              </Button>

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
                                  borderColor: '#94a3b8',
                                  color: '#475569',
                                  '&:hover': {
                                    borderWidth: 2,
                                    bgcolor: '#f8fafc'
                                  }
                                }}
                              >
                                GRID
                              </Button>
                            </Stack>
                            {hasPermission('export_inbound') && (
                              <Button
                                fullWidth
                                size="small"
                                startIcon={<DownloadIcon sx={{ fontSize: '0.9rem' }} />}
                                variant="contained"
                                onClick={exportToExcel}
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
                            )}
                            {hasPermission('refresh_inbound') && (
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
                  <Dialog fullScreen open={mobileActionsOpen} onClose={() => setMobileActionsOpen(false)} TransitionProps={{}}>
                    <AppBar position="sticky" elevation={1} sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>
                      <Toolbar>
                        <IconButton edge="start" color="inherit" onClick={() => setMobileActionsOpen(false)} aria-label="close">
                          <CloseIcon />
                        </IconButton>
                        <Typography sx={{ ml: 2, flex: 1, fontWeight: 700 }}>Filters & Actions</Typography>
                        <Button color="primary" onClick={() => setMobileActionsOpen(false)}>Close</Button>
                      </Toolbar>
                    </AppBar>

                    <DialogContent sx={{ p: 2 }}>
                      <Stack spacing={2}>
                        <Box display="flex" gap={1} flexDirection="column">
                          <FormControl size="small">
                            <InputLabel>Brand</InputLabel>
                            <Select value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }} fullWidth>
                              <MenuItem value="">All</MenuItem>
                              {(categoryFilter ? filteredBrands : brands).map((b) => (
                                <MenuItem key={b} value={b}>{b}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          <FormControl size="small">
                            <InputLabel>Category</InputLabel>
                            <Select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} fullWidth>
                              <MenuItem value="">All</MenuItem>
                              {(brandFilter ? filteredCategories : categories).map((c) => (
                                <MenuItem key={c} value={c}>{c}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          <Box display="flex" gap={1} alignItems="center">
                            <TextField label="From Date" type="date" size="small" InputLabelProps={{ shrink: true }} value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} sx={{ flex: 1 }} />
                            <TextField label="To Date" type="date" size="small" InputLabelProps={{ shrink: true }} value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} sx={{ flex: 1 }} />
                          </Box>

                          <Box sx={{ display: 'grid', gap: 1, mt: 1, gridTemplateColumns: 'repeat(2, 1fr)' }}>
                            <Button variant="outlined" onClick={() => { setSearchInput(''); setBrandFilter(''); setCategoryFilter(''); setDateFromFilter(''); setDateToFilter(''); setPage(1); }}>Reset</Button>
                            <Button variant="outlined" onClick={() => { setListColumnSettingsOpen(true); }}>Columns</Button>
                            <Button variant="outlined" onClick={() => { setGridSettingsOpen(true); }}>Grid</Button>
                            <Button variant="outlined" onClick={() => { setExportDialogOpen(true); }}>Export</Button>
                          </Box>

                        </Box>
                      </Stack>
                    </DialogContent>

                    <Box sx={{ position: 'sticky', bottom: 0, left: 0, right: 0, bgcolor: 'background.paper', p: 1, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 1 }}>
                      <Button fullWidth variant="outlined" onClick={() => { setSearchInput(''); setBrandFilter(''); setCategoryFilter(''); setDateFromFilter(''); setDateToFilter(''); }}>Reset</Button>
                      <Button fullWidth variant="contained" onClick={() => { setPage(1); setMobileActionsOpen(false); }}>Apply</Button>
                    </Box>
                  </Dialog>

                </Box>

                {/* TABLE (AG GRID) - HORIZONTAL SCROLL: Replaced Table with AG Grid to improve column sizing and interactions while keeping filters/export/pagination unchanged */}
                <Box sx={{
                  position: 'relative',
                  flex: 1,
                  overflow: 'hidden',
                  minHeight: 0,
                  border: '2px solid #e2e8f0',
                  borderRadius: 1.5,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}>

                  {/* Loading Overlay with Spinner */}
                  {listLoading && (
                    <Box sx={{
                      position: 'absolute',
                      top: 48,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
                        bgcolor: 'white',
                        borderRadius: 3,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                      }}>
                        <Box sx={{ position: 'relative' }}>
                          <CircularProgress
                            size={56}
                            thickness={3.5}
                            sx={{
                              color: '#1976d2',
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
                            background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
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

                  {/* Empty State Overlay */}
                  {!listLoading && (!listData || listData.length === 0) && (
                    <Box sx={{
                      position: 'absolute',
                      top: 60,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
                    '& .ag-header': {
                      background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                      borderBottom: '1px solid #e5e7eb',
                      opacity: '1 !important',
                      zIndex: 15,
                      position: 'relative'
                    },
                    '& .ag-header-cell': {
                      backgroundColor: 'transparent',
                      color: '#1e293b',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      borderRight: '1px solid #e5e7eb',
                      opacity: '1 !important'
                    },
                    '& .ag-body-viewport': {
                      opacity: listLoading ? 0.3 : 1,
                      transition: 'opacity 0.2s ease-in-out'
                    },
                    '& .ag-cell': { borderRight: '1px solid #f1f5f9' }
                  }}>
                    <AgGridReact
                      ref={gridRef}
                      rowData={listData}
                      columnDefs={inboundColumnDefs}
                      defaultColDef={inboundDefaultColDef}
                      onGridReady={(params: any) => {
                        columnApiRef.current = params.columnApi;
                        try {
                          const savedState = localStorage.getItem('inbound_columnState');
                          if (savedState && params.api) {
                            params.api.applyColumnState({ state: JSON.parse(savedState), applyOrder: true });
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
                      onFirstDataRendered={() => {
                        const colApi = columnApiRef.current;
                        if (!colApi) return;
                        try {
                          const allCols = colApi.getAllColumns().map((c: any) => c.getId());
                          colApi.autoSizeColumns(allCols, false);
                        } catch (err) {
                          gridRef.current?.api.sizeColumnsToFit();
                        }
                      }}
                      onGridSizeChanged={() => {
                        const colApi = columnApiRef.current;
                        if (!colApi) return;
                        try {
                          const allCols = colApi.getAllColumns().map((c: any) => c.getId());
                          colApi.autoSizeColumns(allCols, false);
                        } catch (err) {
                          gridRef.current?.api.sizeColumnsToFit();
                        }
                      }}
                      animateRows={false}
                      suppressRowClickSelection={true}
                      rowSelection="single"
                      suppressLoadingOverlay={true}
                      suppressNoRowsOverlay={true}
                      containerStyle={{ height: '100%', width: '100%' }}
                    />
                  </Box>
                </Box>


                {/* PAGINATION - STICKY AT BOTTOM */}
                <Box sx={{
                  mt: 1,
                  p: { xs: 0.5, sm: 0.75 },
                  background: 'white',
                  borderRadius: 1.25,
                  border: '2px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 0.5,
                  flexShrink: 0,
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 10,
                  backdropFilter: 'blur(8px)',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)'
                }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      color: '#475569',
                      fontSize: { xs: '0.65rem', sm: '0.72rem' },
                      display: { xs: 'none', sm: 'block' }
                    }}
                  >
                    📊 {listData.length > 0 ? (page - 1) * limit + 1 : 0}-{Math.min(page * limit, total)} of {total}
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      color: '#475569',
                      fontSize: '0.65rem',
                      display: { xs: 'block', sm: 'none' }
                    }}
                  >
                    {listData.length > 0 ? (page - 1) * limit + 1 : 0}-{Math.min(page * limit, total)} / {total}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75 } }}>
                    <FormControl size="small" sx={{ minWidth: 100 }}>
                      <Select
                        value={limit}
                        onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                        sx={{ height: 34, fontSize: '0.75rem' }}
                      >
                        <MenuItem value={50}>50 / page</MenuItem>
                        <MenuItem value={100}>100 / page</MenuItem>
                        <MenuItem value={500}>500 / page</MenuItem>
                        <MenuItem value={1000}>1000 / page</MenuItem>
                      </Select>
                    </FormControl>

                    <Button
                      size="small"
                      variant="outlined"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                      sx={{
                        fontSize: { xs: '0.65rem', sm: '0.72rem' },
                        fontWeight: 700,
                        minWidth: { xs: 40, sm: 65 },
                        height: { xs: 26, sm: 30 },
                        borderWidth: 2,
                        borderColor: '#667eea',
                        color: '#667eea',
                        px: { xs: 0.25, sm: 1 },
                        '&:hover': {
                          borderWidth: 2,
                          bgcolor: 'rgba(102, 126, 234, 0.1)'
                        },
                        '&.Mui-disabled': {
                          borderWidth: 2,
                          borderColor: '#e2e8f0',
                          color: '#cbd5e1'
                        }
                      }}
                    >
                      {isMobile ? '◀' : '◀ Prev'}
                    </Button>

                    <Box sx={{
                      px: { xs: 1, sm: 1.5 },
                      py: { xs: 0.25, sm: 0.4 },
                      border: '2px solid #667eea',
                      borderRadius: 1,
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                      minWidth: { xs: 50, sm: 60 },
                      textAlign: 'center'
                    }}>
                      <Typography sx={{
                        fontWeight: 800,
                        color: '#667eea',
                        fontSize: { xs: '0.68rem', sm: '0.75rem' },
                        lineHeight: 1.1
                      }}>
                        {page}/{Math.ceil(total / limit) || 1}
                      </Typography>
                    </Box>

                    <Button
                      size="small"
                      variant="outlined"
                      disabled={page >= Math.ceil(total / limit)}
                      onClick={() => setPage(page + 1)}
                      sx={{
                        fontSize: { xs: '0.65rem', sm: '0.72rem' },
                        fontWeight: 700,
                        minWidth: { xs: 40, sm: 65 },
                        height: { xs: 26, sm: 30 },
                        borderWidth: 2,
                        borderColor: '#667eea',
                        color: '#667eea',
                        px: { xs: 0.25, sm: 1 },
                        '&:hover': {
                          borderWidth: 2,
                          bgcolor: 'rgba(102, 126, 234, 0.1)'
                        },
                        '&.Mui-disabled': {
                          borderWidth: 2,
                          borderColor: '#e2e8f0',
                          color: '#cbd5e1'
                        }
                      }}
                    >
                      {isMobile ? '▶' : 'Next ▶'}
                    </Button>
                  </Box>
                </Box>

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
                          {searchFilter && (
                            <Chip size="small" label={`🔍 "${searchFilter}"`} sx={{ bgcolor: '#dbeafe', color: '#1e40af' }} />
                          )}
                          {brandFilter && (
                            <Chip size="small" label={`🏷️ ${brandFilter}`} sx={{ bgcolor: '#dcfce7', color: '#166534' }} />
                          )}
                          {categoryFilter && (
                            <Chip size="small" label={`📂 ${categoryFilter}`} sx={{ bgcolor: '#fef3c7', color: '#92400e' }} />
                          )}
                          {(exportStartDate || dateFromFilter) && (
                            <Chip size="small" label={`📅 From: ${exportStartDate || dateFromFilter}`} sx={{ bgcolor: '#e0e7ff', color: '#3730a3' }} />
                          )}
                          {(exportEndDate || dateToFilter) && (
                            <Chip size="small" label={`📅 To: ${exportEndDate || dateToFilter}`} sx={{ bgcolor: '#e0e7ff', color: '#3730a3' }} />
                          )}
                          {(exportBatchIds && exportBatchIds.length > 0) && (
                            <Chip size="small" label={`📦 ${exportBatchIds.length} Batch${exportBatchIds.length > 1 ? 'es' : ''}`} sx={{ bgcolor: '#f3e8ff', color: '#6b21a8' }} />
                          )}
                          {!exportStartDate && !exportEndDate && (!exportBatchIds || exportBatchIds.length === 0) && !searchFilter && !brandFilter && !categoryFilter && !dateFromFilter && !dateToFilter && (
                            <Chip size="small" label="📊 All Data" sx={{ bgcolor: '#fee2e2', color: '#dc2626' }} />
                          )}
                        </Box>
                      </Alert>

                      {/* DIVIDER WITH ICON */}
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
                            This will export filtered inbound records to Excel with all selected criteria applied.
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
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
                          color: '#667eea',
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
                        sx={{ fontWeight: 600, color: '#764ba2', fontSize: '0.7rem' }}
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
                      sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
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

                      <Divider sx={{ my: 0.5 }} />

                      {/* EDITABLE */}
                      <Box>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={gridSettings.editable}
                              onChange={(e) => updateGridSettings({ ...gridSettings, editable: e.target.checked })}
                              sx={{
                                '&.Mui-checked': { color: '#f59e0b' }
                              }}
                            />
                          }
                          label={
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                                ✏️ Enable Cell Editing
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                                Double-click or press Enter to edit cells
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

          {/* TAB 1: SINGLE ENTRY */}
          {
            tabValue === 1 && (
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
                  boxShadow: { xs: '0 2px 8px rgba(0,0,0,0.1)', sm: '0 4px 16px rgba(0,0,0,0.08)' },
                  height: { xs: 'auto', lg: 'fit-content' },
                  maxHeight: { xs: '70vh', lg: 'none' },
                  overflow: { xs: 'auto', lg: 'visible' }
                }}>
                  <CardContent sx={{ p: { xs: 1.2, sm: 1.5, md: 2 } }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 700,
                        mb: { xs: 1, sm: 1.5 },
                        color: '#1a237e',
                        fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem' }
                      }}
                    >
                      📝 Entry Form
                    </Typography>

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
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
                    background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                    border: '2px solid #10b981',
                    order: { xs: -1, lg: 0 }, // Show master data above form on mobile
                    height: { xs: 'auto', lg: 'fit-content' },
                    maxHeight: { xs: '50vh', lg: 'none' },
                    overflow: { xs: 'auto', lg: 'visible' }
                  }}>
                    <CardContent sx={{ p: { xs: 1.2, sm: 1.5, md: 2 } }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: { xs: 1, sm: 1.5 } }}>
                        <CheckCircle sx={{ color: '#10b981', fontSize: { xs: 24, sm: 26, md: 28 } }} />
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 700,
                            color: '#065f46',
                            fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem' }
                          }}
                        >
                          Master Data Found
                        </Typography>
                      </Stack>

                      <Divider sx={{ mb: { xs: 1, sm: 1.5 }, borderColor: 'rgba(5, 150, 105, 0.3)' }} />

                      <Stack spacing={{ xs: 1, sm: 1.2, md: 1.5 }}>
                        {/* FSN */}
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#065f46',
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
                            color: '#047857',
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
                              color: '#065f46',
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
                            color: '#047857',
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
                                color: '#065f46',
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
                              color: '#047857',
                              fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' }
                            }}>
                              {masterData.brand || 'N/A'}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#065f46',
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
                              color: '#047857',
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
                          background: 'rgba(255, 255, 255, 0.5)',
                          borderRadius: 1
                        }}>
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#065f46',
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
                              color: '#047857',
                              fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' }
                            }}>
                              ₹{masterData.mrp || 'N/A'}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#065f46',
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
                              color: '#047857',
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
                            background: 'rgba(255, 255, 255, 0.6)',
                            borderRadius: 1,
                            border: '1px dashed #10b981'
                          }}>
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#065f46',
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
                                color: '#0284c7',
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



          {/* TAB 2: BULK UPLOAD */}
          {
            tabValue === 2 && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  p: { xs: 1, sm: 1.5, md: 2 },
                  overflow: 'auto',
                }}
              >
                <Card sx={{ borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#1a237e' }}>📤 Bulk Upload</Typography>
                    <Stack spacing={2}>
                      <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => setConfirmOpen(true)}
                        sx={{ py: 1.5 }}
                      >
                        Download Template
                      </Button>

                      {/* Confirmation Dialog for Download */}
                      <Dialog
                        open={confirmOpen}
                        onClose={() => setConfirmOpen(false)}
                        maxWidth="xs"
                        fullWidth
                      >
                        <DialogTitle sx={{ fontWeight: 700, color: '#1a237e' }}>
                          Confirm Download
                        </DialogTitle>

                        <DialogContent>
                          <Typography sx={{ color: '#334155', mb: 2 }}>
                            Would you like to proceed with downloading the template?
                          </Typography>
                        </DialogContent>

                        <DialogActions sx={{ p: 2 }}>
                          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                          <Button
                            variant="contained"
                            onClick={handleConfirmDownload}
                            sx={{
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            }}
                          >
                            Yes, Download
                          </Button>
                        </DialogActions>
                      </Dialog>

                      <Box sx={{ border: '2px dashed #667eea', borderRadius: 2, p: 3, textAlign: 'center', cursor: 'pointer', background: 'rgba(102, 126, 234, 0.05)', transition: 'all 0.3s', '&:hover': { background: 'rgba(102, 126, 234, 0.1)', borderColor: '#764ba2' } }}>
                        <input type="file" accept=".xlsx,.xls" onChange={(e) => setBulkFile(e.target.files?.[0] || null)} style={{ display: 'none' }} id="bulk-file" />
                        <label htmlFor="bulk-file" style={{ cursor: 'pointer', display: 'block' }}>
                          <UploadIcon sx={{ fontSize: 40, color: '#667eea', mb: 1 }} />
                          <Typography sx={{ fontWeight: 700 }}>Click to upload file</Typography>
                          <Typography variant="caption" sx={{ color: '#94a3b8' }}>{bulkFile?.name || 'No file selected'}</Typography>
                        </label>
                      </Box>

                      <Button variant="contained" onClick={handleBulkUpload} disabled={bulkLoading || !bulkFile} sx={{ py: 1.5, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                        {bulkLoading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : <UploadIcon sx={{ mr: 1 }} />}
                        Upload
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>

                {bulkCurrentBatch && (
                  <Card sx={{ background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', border: '2px solid #3b82f6' }}>
                    <CardContent>
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#1e40af' }}>BATCH ID</Typography>
                          <Typography sx={{ fontWeight: 700, color: '#1e3a8a' }}>{bulkCurrentBatch.id}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#1e40af' }}>TOTAL ROWS</Typography>
                          <Typography sx={{ fontWeight: 700, color: '#1e3a8a' }}>{bulkCurrentBatch.total}</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={50} sx={{ height: 8, borderRadius: 4 }} />
                        <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 600 }}>Processing...</Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                )}

                {bulkErrors.length > 0 && (
                  <Dialog open={bulkErrorsOpen} onClose={() => setBulkErrorsOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle>❌ Upload Errors</DialogTitle>
                    <DialogContent sx={{ maxHeight: 400, overflow: 'auto' }}>
                      {bulkErrors.map((err, idx) => (
                        <Alert key={idx} severity="error" sx={{ mb: 1 }}>
                          Row {err.row}: {err.message}
                        </Alert>
                      ))}
                    </DialogContent>
                  </Dialog>
                )}
              </Box>
            )
          }


          {/* TAB 3: MULTI ENTRY */}
          {
            tabValue === 3 && (
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%', overflow: 'hidden',
                p: { xs: 1, sm: 1, md: 1 }
              }}>
                {/* CONTROLS */}
                <Card
                  sx={{
                    borderRadius: 1.5,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    flexShrink: 0, // Don't shrink this card
                    mb: { xs: 1, sm: 1.5 } // Add bottom margin for spacing
                  }}
                >
                  <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                    {/* DESKTOP: Side by side layout */}
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                      <Stack
                        direction="row"
                        spacing={2}
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
                            minWidth: 340
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
                            sx={{
                              flex: 1,
                              '& .MuiInputBase-root': { height: 36 }
                            }}
                            placeholder="Auto-fill"
                          />
                        </Stack>

                        {/* RIGHT: Status Chips + Action Buttons */}
                        <Stack
                          direction="row"
                          spacing={1.5}
                          sx={{
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            flex: 1,
                            gap: 0
                          }}
                        >

                          {/* Action Buttons */}
                          <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setColumnSettingsOpen(true)}
                              sx={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                minWidth: 75,
                                height: 32,
                                px: 1.5,
                                borderColor: '#667eea',
                                color: '#667eea',
                                '&:hover': {
                                  borderColor: '#667eea',
                                  bgcolor: 'rgba(102, 126, 234, 0.08)'
                                }
                              }}
                            >
                              COLUMNS
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={add30Rows}
                              sx={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                minWidth: 85,
                                height: 32,
                                px: 1.5,
                                background: '#ec4899',
                                '&:hover': { background: '#db2777' }
                              }}
                            >
                              + 30 ROWS
                            </Button>

                            {/* ✅ NEW: Grid Settings Button */}
                            <Button
                              type="button"
                              size="small"
                              variant="outlined"
                              startIcon={<SettingsIcon sx={{ fontSize: '0.85rem' }} />}
                              onClick={(e) => { e.stopPropagation(); setGridSettingsOpen(true); }}
                              sx={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                borderWidth: 2,
                                borderColor: '#f59e0b',
                                color: '#f59e0b',
                                '&:hover': {
                                  borderWidth: 2,
                                  bgcolor: 'rgba(245, 158, 11, 0.1)'
                                }
                              }}
                            >
                              Grid
                            </Button>
                          </Stack>
                        </Stack>
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
                            sx={{
                              flex: 1,
                              '& .MuiInputBase-root': { height: 36 }
                            }}
                            placeholder="Auto-fill"
                          />
                        </Stack>

                        {/* ROW 2: Status Chips + Action Buttons */}
                        <Stack
                          direction="row"
                          spacing={0.25}
                          sx={{
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%'
                          }}
                        >

                          {/* Action Buttons */}
                          <Stack direction="row" spacing={1.50} sx={{ flexShrink: 0 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setColumnSettingsOpen(true)}
                              sx={{
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                width: 105,
                                height: 28,
                                px: 0.75,
                                borderColor: '#667eea',
                                color: '#667eea',
                                '&:hover': {
                                  borderColor: '#667eea',
                                  bgcolor: 'rgba(102, 126, 234, 0.08)'
                                }
                              }}
                            >
                              <SettingsIcon sx={{ fontSize: '0.85rem' }} /> COLUMNS
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={add30Rows}
                              sx={{
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                width: 105,
                                height: 28,
                                px: 0.75,
                                borderColor: '#667eea',
                                color: '#667eea',
                                '&:hover': {
                                  borderColor: '#667eea',
                                  bgcolor: 'rgba(102, 126, 234, 0.08)'
                                }
                              }}

                            >
                              + 30 ROWS
                            </Button>
                            {/* ✅ NEW: Grid Settings Button */}
                            <Button
                              type="button"
                              size="small"
                              variant="outlined"
                              onClick={(e) => { e.stopPropagation(); setGridSettingsOpen(true); }}
                              sx={{
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                width: 105,
                                height: 28,
                                px: 0.75,
                                borderColor: '#667eea',
                                color: '#667eea',
                                '&:hover': {
                                  borderColor: '#667eea',
                                  bgcolor: 'rgba(102, 126, 234, 0.08)'
                                }
                              }}
                            >
                              <SettingsIcon sx={{ fontSize: '0.85rem' }} /> Grid
                            </Button>

                          </Stack>
                        </Stack>
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


                {/* AG GRID */}
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 300,
                    border: '1px solid #cbd5e1',
                    borderRadius: 1,
                    overflow: 'hidden',
                    '& .ag-root-wrapper': { borderRadius: 0, height: '100%' },

                    // Excel-style header
                    '& .ag-header': {
                      borderBottom: '1px solid #cbd5e1',
                    },
                    '& .ag-header-cell': {
                      backgroundColor: '#e5e7eb',
                      color: '#111827',
                      fontWeight: 700,
                      borderRight: '1px solid #d1d5db',
                      fontSize: '11px',
                      padding: '0 4px',
                    },

                    // Excel-style cells
                    '& .ag-cell': {
                      borderRight: '1px solid #e5e7eb',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '11px',
                      padding: '1px 4px',
                      display: 'flex',
                      alignItems: 'center',

                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    },


                    // Compact rows
                    // Compact rows (popup visible)
                    '& .ag-row': {
                      height: 26,
                      overflow: 'visible',   // ⭐ REQUIRED
                    },

                    '& .ag-row-even': { backgroundColor: '#ffffff' },
                    '& .ag-row-odd': { backgroundColor: '#f9fafb' },

                    // Active (focused) cell – Excel जैसी नीली border
                    '& .ag-cell-focus': {
                      border: '2px solid #2563eb !important',
                      boxSizing: 'border-box',
                    },

                    // Range selection (drag / shift select) – हल्का blue background
                    '& .ag-cell-range-selected': {
                      backgroundColor: '#dbeafe !important',
                    },
                    '& .ag-cell-range-single-cell': {
                      backgroundColor: '#eff6ff !important',
                    },

                    // Hover like selected Excel row
                    '& .ag-row-hover': {
                      backgroundColor: '#e5f3ff !important',
                    },
                    '& .ag-row-focus': {
                      outline: '1 px solid #60a5fa',
                    },
                  }}
                >
                  <div style={{ height: '100%', width: '100%' }} className="ag-theme-quartz">
                    <AgGridReact
                      ref={gridRef}
                      onGridReady={(params: any) => {
                        gridRef.current = params.api;
                        columnApiRef.current = params.columnApi;
                      }}
                      //theme="legacy"
                      rowData={multiRows}
                      columnDefs={columnDefs}
                      rowHeight={36}
                      suppressNoRowsOverlay={false}
                      overlayNoRowsTemplate='<span style="padding: 20px; font-size: 14px; color: #666;">Click on any cell to start entering data</span>'

                      defaultColDef={{
                        sortable: gridSettings.sortable,  // ✅ Dynamic
                        filter: gridSettings.filter,      // ✅ Dynamic
                        resizable: gridSettings.resizable, // ✅ Dynamic
                        editable: (params) => {
                          // ✅ Check grid settings first
                          if (!gridSettings.editable) return false;

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
                      }}

                      // keyboard navigation
                      stopEditingWhenCellsLoseFocus={true}
                      enterNavigatesVertically={true}
                      enterNavigatesVerticallyAfterEdit={true}
                      navigateToNextCell={navigateToNextCell}
                      ensureDomOrder={true}
                      suppressRowClickSelection={true}
                      suppressMovableColumns={true}
                      rowBuffer={5}
                      onCellValueChanged={(event: any) => {
                        const { colDef, newValue, rowIndex } = event;
                        const field = colDef?.field;
                        if (!field) return;

                        const newRows = [...multiRows];

                        // WSN clear -> master clear
                        if (field === 'wsn' && (!newValue || newValue.trim() === '')) {
                          newRows[rowIndex] = { ...newRows[rowIndex], [field]: newValue };
                          ALL_MASTER_COLUMNS.forEach((col) => {
                            newRows[rowIndex][col] = null;
                          });
                          setMultiRows(newRows);
                          checkDuplicates(newRows);
                          return;
                        }

                        newRows[rowIndex] = { ...newRows[rowIndex], [field]: newValue };
                        setMultiRows(newRows);

                        if (field === 'wsn') {
                          // Calculate duplicates immediately for instant feedback (don't wait on checkDuplicates)
                          const wsn = newValue?.trim()?.toUpperCase();

                          const immediateCounts = new Map<string, number>();
                          newRows.forEach((r: any) => {
                            const rv = r.wsn?.trim()?.toUpperCase();
                            if (rv) immediateCounts.set(rv, (immediateCounts.get(rv) || 0) + 1);
                          });

                          const isGridDuplicateImmediate = (immediateCounts.get(wsn) || 0) > 1;



                          // 🟡 Grid duplicate → clear cell + toast (match QC behaviour)
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

                            // Clear the cell and master columns like QC
                            newRows[rowIndex].wsn = '';
                            ALL_MASTER_COLUMNS.forEach((col) => {
                              newRows[rowIndex][col] = null;
                            });
                            setMultiRows(newRows);
                            checkDuplicates(newRows);
                            checkDuplicates(newRows);

                            // Re-focus same cell for quick correction
                            setTimeout(() => {
                              event.api.startEditingCell({
                                rowIndex: rowIndex,
                                colKey: 'wsn',
                              });
                            }, 100);

                            return;
                          }

                          // ➕ Last row → auto add new row
                          if (rowIndex === event.api.getDisplayedRowCount() - 1) {
                            addMultiRow();
                          }

                          // If there's a WSN value, first perform a quick remote check to figure out ownership
                          if (newValue?.trim()) {
                            // Run the ownership check immediately (no delay) so we can clear bad WSNs early
                            setTimeout(async () => {
                              try {
                                const wsnCheck = newValue.trim().toUpperCase();
                                const ownerResp = await inboundAPI.getAll(1, 1, { search: wsnCheck });
                                const ownerItem = ownerResp?.data?.data?.[0] || ownerResp?.data?.[0] || null;

                                if (ownerItem) {
                                  const ownerWarehouseId = ownerItem.warehouse_id ?? ownerItem.warehouseId ?? ownerItem.warehouseid ?? null;

                                  if (ownerWarehouseId && ownerWarehouseId !== activeWarehouse?.id) {
                                    // Cross-warehouse → error and clear
                                    toast.error(`WSN ${wsnCheck} already inbound in another warehouse`, {
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

                                    newRows[rowIndex].wsn = '';
                                    ALL_MASTER_COLUMNS.forEach((col) => {
                                      newRows[rowIndex][col] = null;
                                    });
                                    setMultiRows(newRows);
                                    await checkDuplicates(newRows);

                                    setTimeout(() => {
                                      event.api.startEditingCell({ rowIndex: rowIndex, colKey: 'wsn' });
                                    }, 100);

                                    return;
                                  }

                                  if (ownerWarehouseId && ownerWarehouseId === activeWarehouse?.id) {
                                    // Same-warehouse duplicate → warn + clear (match QC behavior)
                                    toast(`WSN ${wsnCheck} already inbound in this warehouse`, {
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
                                    await checkDuplicates(newRows);

                                    setTimeout(() => {
                                      event.api.startEditingCell({ rowIndex: rowIndex, colKey: 'wsn' });
                                    }, 100);

                                    return;
                                  }
                                }
                              } catch (err) {
                                // ignore remote lookup errors and continue to master data fetch
                              }
                            }, 0);

                            // Continue with the regular master-data fetch (delayed)
                            setTimeout(async () => {
                              try {
                                const wsnUpper = newValue.trim().toUpperCase();

                                // GUARD: if the cell was cleared (duplicate or owner) skip master data fetch
                                if (!newRows[rowIndex].wsn || newRows[rowIndex].wsn.trim().toUpperCase() !== wsnUpper) {
                                  return;
                                }

                                const response = await inboundAPI.getMasterDataByWSN(wsnUpper);
                                const masterInfo = response.data;
                                setMultiRows((prevRows) => {
                                  const updatedRows = [...prevRows];
                                  updatedRows[rowIndex] = { ...updatedRows[rowIndex] };
                                  ALL_MASTER_COLUMNS.forEach((masterCol) => {
                                    updatedRows[rowIndex][masterCol] =
                                      masterInfo[masterCol] || null;
                                  });
                                  return updatedRows;
                                });

                                // 🖨️ AUTO-PRINT label for valid WSN
                                console.log('🖨️ Attempting to print label for:', wsnUpper);
                                try {
                                  const printPayload = {
                                    wsn: newValue,
                                    fsn: masterInfo.fsn || '',
                                    product_title: masterInfo.product_title || '',
                                    brand: masterInfo.brand || '',
                                    mrp: masterInfo.mrp || '',
                                    fsp: masterInfo.fsp || '',
                                    copies: 1,
                                  };
                                  console.log('📋 Print payload:', printPayload);

                                  const printSuccess = await printLabel(printPayload);
                                  console.log('📊 Print result:', printSuccess);

                                  if (printSuccess) {
                                    console.log(`✅ Label printed for WSN: ${newValue}`);
                                    toast.success(`🖨️ Label printed: ${newValue}`, { duration: 2000 });
                                  }
                                  // If printSuccess is false, printing is disabled or agent not running
                                  // Check console logs to determine reason - no toast needed
                                } catch (printError: any) {
                                  console.error('❌ Print error:', printError);
                                  console.error('❌ Print error stack:', printError.stack);
                                  toast.error(`Print error: ${printError.message}`, { duration: 3000 });
                                }
                              } catch (error) {
                                console.log('WSN not found');
                              }
                            }, 500);
                          }
                        }
                      }}
                    />
                  </div>
                </Box>



                {/* DRAFT STATUS + ACTIONS */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Chip
                    label={draftSavedAt ? `Draft saved ${new Date(draftSavedAt).toLocaleTimeString()}` : 'No draft'}
                    color={draftExists ? 'success' : 'default'}
                    size="small"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => saveDraftImmediate()}
                    disabled={draftSaving}
                  >
                    Save Draft
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={clearDraft}
                    disabled={!draftExists}
                  >
                    Clear Draft
                  </Button>
                </Stack>

                {/* SUBMIT BUTTON */}
                <Button fullWidth variant="contained" size="medium" onClick={handleMultiSubmit} disabled={
                  multiLoading ||
                  gridDuplicateWSNs.size > 0 ||
                  crossWarehouseWSNs.size > 0
                }
                  sx={{
                    py: 1,
                    borderRadius: 1.5,
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    flexShrink: 0,
                    mt: 1
                  }}>
                  ✓ SUBMIT ALL ({multiRows.filter(r => r.wsn?.trim()).length} rows)
                </Button>

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
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
                        color: '#667eea',
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
                        color: '#764ba2',
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
                      sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontWeight: 700 }}
                    >
                      Done
                    </Button>
                  </DialogActions>
                </Dialog>
              </Box>
            )
          }

          {/* TAB 4: BATCH MANAGER */}
          {
            tabValue === 4 && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  p: { xs: 1, sm: 1.5, md: 2 },
                  overflow: 'auto',
                }}
              >
                <Card sx={{ borderRadius: 1.5 }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Batch Manager
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<RefreshIcon />}
                        onClick={loadBatches}
                        variant="outlined"
                      >
                        Refresh
                      </Button>
                    </Stack>

                    {batchLoading ? (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <CircularProgress />
                      </Box>
                    ) : batches.length === 0 ? (
                      <Alert severity="info">No batches found</Alert>
                    ) : (
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#f3f4f6' }}>
                              <TableCell sx={{ fontWeight: 700 }}>Batch ID</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Count</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Last Updated</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {batches.map((batch, idx) => (
                              <TableRow key={idx} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                  {batch.batch_id}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={`${batch.count} items`}
                                    size="small"
                                    sx={{ bgcolor: '#dbeafe', color: '#1e40af' }}
                                  />
                                </TableCell>
                                <TableCell>
                                  {new Date(batch.last_updated).toLocaleString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => deleteBatch(batch.batch_id)}
                                  >
                                    Delete
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </CardContent>
                </Card>
              </Box>
            )
          }
        </Box >
      </Box >
    </AppLayout >
  );
}
