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
} from '@mui/icons-material';
import { qcAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import { StandardPageHeader, StandardTabs, BatchManagementTab } from '@/components';
import { useTableRowHeight } from '@/app/context/AppearanceContext';

import toast, { Toaster } from 'react-hot-toast';
// ⚡ OPTIMIZED: XLSX loaded dynamically on export to reduce bundle size
// import * as XLSX from 'xlsx'; // Removed - loaded dynamically
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ClientSideRowModelModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { debounce } from 'lodash';
import localforage from 'localforage';
// Simple localStorage-based grid state (native ag-Grid pattern)

// Register AG Grid modules ONCE (include ClientSideRowModel for client-side features)
ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);
import { useQCPermissions } from '@/hooks/usePagePermissions';
import BulkUploadCard from '@/components/BulkUploadCard';

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
  const columnApiRef = useRef<any>(null);
  const hasAutoFittedRef = useRef(false); // Track if auto-fit has been done

  // ⚡ EXCEL-LIKE: Refs for smooth scrolling and selection
  const userScrolledRef = useRef(false);
  const userScrollTimeoutRef = useRef<number | null>(null);
  const lastGridScrollTopRef = useRef(0);
  const isAutoScrollingRef = useRef(false);
  const desiredRowIndexRef = useRef<number | null>(null);
  const scanningModeRef = useRef(false);
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
    startCol: string;
    endCol: string;
    colIndexMap: Map<string, number>;
  } | null>(null);

  // ⚡ EXCEL-LIKE: Track mouse drag state for multi-cell selection
  const isDraggingRef = useRef(false);
  const dragStartCellRef = useRef<{ rowIndex: number; colId: string } | null>(null);

  // Single Entry WSN debounce ref (for scanner support)
  const singleWSNDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // QC LIST STATE
  const [qcList, setQcList] = useState<QCItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
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
    try { return localStorage.getItem('qc_enableSorting') !== 'false'; } catch { return true; }
  });
  const [enableColumnFilters, setEnableColumnFilters] = useState<boolean>(() => {
    try { return localStorage.getItem('qc_enableColumnFilters') !== 'false'; } catch { return true; }
  });
  const [enableColumnResize, setEnableColumnResize] = useState<boolean>(() => {
    try { return localStorage.getItem('qc_enableColumnResize') !== 'false'; } catch { return true; }
  });
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);

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

  // ✅ ADD THIS - Template download confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);

  // MULTI ENTRY STATE
  const generateEmptyRows = (count: number) => {
    return Array.from({ length: count }, () => ({
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
    }));
  };


  const [multiRows, setMultiRows] = useState<any[]>(generateEmptyRows(500));
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiResults, setMultiResults] = useState<any[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [commonQcDate, setCommonQcDate] = useState('');
  const [commonQcByName, setCommonQcByName] = useState('');

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
        // ✅ Always include 'sno' at the beginning
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



  // Grid settings with localStorage
  const [gridSettings, setGridSettings] = useState({
    sortable: true,
    filter: true,
    resizable: true,
    editable: true,
  });

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


  // Fetch all existing QC'd WSNs on mount (for cross-warehouse checking)
  // ✅ Fetch existing QC WSNs with warehouse IDs
  useEffect(() => {
    async function fetchExistingWSNs() {
      try {
        const res = await qcAPI.getAllQCWSNs();
        // res.data is now: [{ wsn: "ABC", warehouseid: 1 }, ...]
        setExistingQCWSNs(res.data || []);
        console.log('✅ Existing QC WSNs loaded:', res.data);
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
    const key = getDraftKey();
    if (!key) return;
    setDraftSaving(true);
    try {
      await localforage.setItem(key, { rows: rowsToSave, savedAt: Date.now(), version: 1 });
      setDraftSavedAt(Date.now());
      setDraftExists(true);
    } catch (err) {
      console.error('Failed to save QC draft', err);
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
      console.error('Failed to clear QC draft', err);
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
            qcdate: r.qcdate || commonQcDate,
            qcbyname: r.qcbyname || commonQcByName,
            ...r,
          }));
          setMultiRows(restored);
          setDraftSavedAt(draft.savedAt || Date.now());
          setDraftExists(true);
          //toast.success('✓ Draft restored');
        }
      } catch (err) {
        console.error('Failed to load QC draft', err);
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
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);

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


  // AUTH CHECK
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }

    setUser(storedUser);

    // ✅ AUTO-POPULATE QC BY NAME FROM LOGGED-IN USER
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

      console.log('✅ QC By Name auto-populated:', userName);
    }
  }, [router]);

  // ✅ KEEP QC BY NAME UPDATED WHEN USER CHANGES
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

  // ✅ LOAD COLUMN SETTINGS FROM LOCALSTORAGE
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

  // ✅ SAVE COLUMN SETTINGS
  const saveColumnSettings = (cols: string[]) => {
    setVisibleColumns(cols);
    localStorage.setItem('qcMultiEntryColumns', JSON.stringify(cols));
  };




  // ✅ NAVIGATE TO NEXT CELL (AG GRID)
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

  // ⚡ EXCEL-LIKE: Refresh grid when selection changes
  useEffect(() => {
    const api = gridRef.current;
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
    toast('All rows selected', { icon: '✓', duration: 1500 });
  }, []);

  // ⚡ EXCEL-LIKE: Smooth scroll to row
  const ensureRowVisible = useCallback((rowIndex: number, position: 'top' | 'middle' | 'bottom' = 'middle') => {
    const api = gridRef.current;
    if (!api) return;

    if (userScrolledRef.current) return;

    isAutoScrollingRef.current = true;
    try {
      api.ensureIndexVisible(rowIndex, position);
    } finally {
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 100);
    }
  }, []);

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

      // Shift+Arrow keys - Extend selection
      if (shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditing) {
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
  }, [currentTabCode, handleSelectAll, handleClearCells]);


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

  // LOAD DATA
  useEffect(() => {
    if (!activeWarehouse) return;

    if (currentTabCode === 'list') {
      loadQCList();
      loadStats();
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

  // ✅ LIST GRID COLUMN DEFINITIONS (AG GRID)
  // Include ALL columns with hide property - columnDefs structure never changes
  const listColumnDefs = useMemo(() => {
    const sr = {
      headerName: 'SR.NO',
      field: '__sr',
      valueGetter: (params: any) => params.node ? params.node.rowIndex + 1 + (page - 1) * limit : undefined,
      width: 80,
      cellStyle: { fontWeight: 700, textAlign: 'center', color: isDarkMode ? '#94a3b8' : '#64748b' },
      suppressMovable: true,
      sortable: false,
      filter: false,
    };

    // Include ALL columns - visibility controlled by ag-Grid state
    const cols = ALL_LIST_COLUMNS.map((col: string) => {
      // Dates
      if (col.includes('date')) {
        return {
          field: col,
          headerName: col.replace(/_/g, ' ').toUpperCase(),
          filter: enableColumnFilters ? 'agDateColumnFilter' : undefined,
          valueFormatter: (p: any) => formatDate(p.value),
          tooltipField: col,
          flex: 1,
          minWidth: 140,
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
          flex: 1,
          minWidth: 120,
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
          flex: 1,
          minWidth: 120,
          hide: false,
        };
      }

      // Default
      return {
        field: col,
        headerName: col.replace(/_/g, ' ').toUpperCase(),
        filter: enableColumnFilters ? 'agTextColumnFilter' : undefined,
        tooltipField: col,
        flex: 1,
        minWidth: col === 'wsn' ? 180 : col === 'product_title' ? 250 : 150,
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
    minWidth: 100,
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
        setListLoading(false);
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

        // ⚡ PAGE CACHE: Store in cache
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
          toast.success('✓ List refreshed');
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
      if (loadId === currentLoadIdRef.current) {
        setIsFetching(false);
        if (buttonRefresh) setRefreshing(false);
        setListLoading(false);
      }
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
  // ✅ ADD THIS - Actual download after confirmation (used by BulkUploadCard)
  const handleConfirmDownload = async () => {
    // ⚡ OPTIMIZED: Load XLSX dynamically
    const XLSX = await import('xlsx');

    const template = [
      {
        WSN: 'ABC123A',
        QCBYNAME: 'John Doe',
        QCDATE: new Date().toISOString().split('T')[0],
        GRADE: 'A',
        QCREMARKS: 'All checks passed',
        OTHERREMARKS: 'Package condition good',
        PRODUCTSERIALNUMBER: 'SN12345',
        RACKNO: 'A-01',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'QCBulkTemplate.xlsx');
    toast.success('Template downloaded');
  };


  // TAB 3: MULTI ENTRY ACTIONS
  const add500Rows = () => {
    setMultiRows([...multiRows, ...generateEmptyRows(500)]);
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
        'Product Serial': row.product_serial_number || '',
        'Rack No': row.rack_no || '',
        'QC Grade': row.qc_grade || '',
        'QC Remarks': row.qc_remarks || '',
        'Other Remarks': row.other_remarks || '',
        'Brand': row.brand || '',
        'Category': row.cms_vertical || '',
        'Model': row.product_title || ''
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Multi QC');
      XLSX.writeFile(wb, `QC_MultiEntry_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`);
      toast.success(`✓ Exported ${dataToExport.length} rows`);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  // Column widths matching inbound page
  const COLUMN_WIDTHS: Record<string, any> = {
    // Editable columns
    sno: { width: 50 },
    wsn: { width: 80 },
    productserialnumber: { width: 160 },
    rackno: { width: 80 },
    qcgrade: { width: 80 },
    qcremarks: { flex: 1, minWidth: 90 },
    otherremarks: { flex: 1, minWidth: 100 },

    // Master data columns (read-only)
    fsn: { width: 100 },
    producttitle: { flex: 2, minWidth: 220 },
    brand: { width: 90 },
    cmsvertical: { width: 100 },
    hsnsac: { width: 80 },
    igstrate: { width: 70 },
    mrp: { width: 60 },
    fsp: { width: 60 },
    vrp: { width: 60 },
    yieldvalue: { width: 70 },
    ptype: { width: 100 },
    psize: { width: 80 },
    fktlink: { width: 80 },
    whlocation: { width: 100 },
    orderid: { width: 100 },
    fkqcremark: { width: 120 },
    fkgrade: { width: 70 },
    invoicedate: { width: 90 },
  };

  const handleMultiSubmit = async () => {
    const validRows = multiRows.filter((r) => r.wsn?.trim());
    if (validRows.length === 0) {
      toast.error('At least 1 WSN required');
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

      setMultiResults(response.data?.results || []);
      toast.success(`✓ ${response.data?.successCount || 0} entries created`);

      // Reset rows
      setMultiRows(generateEmptyRows(500));

      // Clear saved draft after successful submit
      await clearDraft();

      loadQCList();
      loadStats();
      loadBatches();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Submission failed');
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
        dateFrom: exportStartDate,
        dateTo: exportEndDate,
        qc_grade: exportGrade,
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
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'QC');
      const filename = `QC_${exportStartDate || 'all'}_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`✓ Exported ${exportData.length} records`);
      setExportDialogOpen(false);
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

  if (!activeWarehouse) {
    return <AppLayout>⚠️ No warehouse selected</AppLayout>;
  }

  //////////////////////////////////====UI RENDERING====////////////////////////////////////
  return (
    <AppLayout>
      <Toaster position="top-right" toastOptions={{
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
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        {/* ==================== HEADER SECTION ==================== */}
        <StandardPageHeader
          title="QC Management"
          subtitle="Quality control operations"
          icon="✅"
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
            borderRadius: 2,
            boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.08)',
            background: isDarkMode ? '#1e293b' : 'white',
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

                  {!isMobile ? (
                    <Button
                      variant="outlined"
                      onClick={() => setFiltersExpanded(!filtersExpanded)}
                      sx={{
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
                          <Tooltip title="Filters active">
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
                          </Tooltip>
                        )}
                      </Box>

                      <ExpandMoreIcon sx={{ transform: filtersExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }} />
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<TuneIcon />}
                      onClick={() => setMobileActionsOpen(true)}
                      sx={{
                        height: 40,
                        px: 2,
                        textTransform: 'none',
                        flexShrink: 0,
                        fontSize: '0.85rem',
                        fontWeight: 600
                      }}
                    >
                      Actions
                    </Button>
                  )}
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
                        {/* ROW 1: Date Filters + Status + Grade + Brand + Category */}
                        <Box sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
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
                                bgcolor: 'white',
                                '&:hover fieldset': { borderColor: '#1e40af' },
                                '&.Mui-focused fieldset': { borderColor: '#1e40af' }
                              },
                              '& .MuiInputLabel-root': {
                                fontSize: '0.75rem'
                              }
                            }}
                          />

                          <FormControl size="small">
                            <InputLabel sx={{ fontSize: '0.75rem' }}>Grade</InputLabel>
                            <Select
                              value={gradeFilter}
                              label="Grade"
                              onChange={(e) => { setGradeFilter(e.target.value); setPage(1); }}
                              sx={{
                                height: 36,
                                fontSize: '0.8rem',
                                bgcolor: 'white',
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' }
                              }}
                            >
                              <MenuItem value="">All Grades</MenuItem>
                              {QC_GRADES.map(g => <MenuItem key={g} value={g} sx={{ fontSize: '0.8rem' }}>{g}</MenuItem>)}
                            </Select>
                          </FormControl>
                          <FormControl size="small">
                            <InputLabel sx={{ fontSize: '0.75rem' }}>Brand</InputLabel>
                            <Select
                              value={brandFilter}
                              label="Brand"
                              onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                              sx={{
                                height: 36,
                                fontSize: '0.8rem',
                                bgcolor: 'white',
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' }
                              }}
                            >
                              <MenuItem value="">All Brands</MenuItem>
                              {brands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                            </Select>
                          </FormControl>
                          <FormControl size="small">
                            <InputLabel sx={{ fontSize: '0.75rem' }}>Category</InputLabel>
                            <Select
                              value={categoryFilter}
                              label="Category"
                              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                              sx={{
                                height: 36,
                                fontSize: '0.8rem',
                                bgcolor: 'white',
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' }
                              }}
                            >
                              <MenuItem value="">All Categories</MenuItem>
                              {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                            </Select>
                          </FormControl>
                        </Box>

                        {/* ROW 2: Action Buttons */}
                        <Box sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(5, 1fr)' },
                          gap: 1
                        }}>
                          <Button
                            fullWidth
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setSearchFilter('');
                              setStatusFilter('');
                              setGradeFilter('');
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
                            fullWidth
                            size="small"
                            startIcon={<SettingsIcon sx={{ fontSize: '0.9rem' }} />}
                            variant="outlined"
                            onClick={() => setGridSettingsOpen(true)}
                            sx={{
                              height: 34,
                              fontSize: '0.72rem',
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
                            GRID
                          </Button>
                          {canSeeButton('list:export') && (
                            <Tooltip title={!canAccessButton('list:export') ? "You don't have permission to use this feature" : "Export Data"} arrow>
                              <span style={{ width: '100%' }}>
                                <Button
                                  fullWidth
                                  size="small"
                                  startIcon={<DownloadIcon sx={{ fontSize: '0.9rem' }} />}
                                  variant="contained"
                                  disabled={!canAccessButton('list:export')}
                                  onClick={() => canAccessButton('list:export') && setExportDialogOpen(true)}
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
                          <Button
                            fullWidth
                            size="small"
                            startIcon={refreshing ? <CircularProgress size={14} /> : refreshSuccess ? <CheckCircle sx={{ color: '#10b981' }} /> : <RefreshIcon sx={{ fontSize: '0.9rem' }} />}
                            variant="outlined"
                            onClick={() => loadQCList({ buttonRefresh: true })}
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
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Collapse>
              </Box>

              {/* MOBILE ACTIONS DIALOG */}
              <Dialog
                open={mobileActionsOpen}
                onClose={() => setMobileActionsOpen(false)}
                fullScreen
              >
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
                        <Box display="flex" gap={1}>
                          <TextField
                            label="From Date"
                            type="date"
                            size="small"
                            InputLabelProps={{ shrink: true }}
                            value={dateFromFilter}
                            onChange={(e) => { setDateFromFilter(e.target.value); setPage(1); }}
                            sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 40 } }}
                          />
                          <TextField
                            label="To Date"
                            type="date"
                            size="small"
                            InputLabelProps={{ shrink: true }}
                            value={dateToFilter}
                            onChange={(e) => { setDateToFilter(e.target.value); setPage(1); }}
                            sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 40 } }}
                          />
                        </Box>

                        <TextField
                          select
                          size="small"
                          label="Status"
                          value={statusFilter}
                          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                          fullWidth
                          sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}
                        >
                          <MenuItem value="">All Status</MenuItem>
                          {QC_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                        </TextField>

                        <TextField
                          select
                          size="small"
                          label="Grade"
                          value={gradeFilter}
                          onChange={(e) => { setGradeFilter(e.target.value); setPage(1); }}
                          fullWidth
                          sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}
                        >
                          <MenuItem value="">All Grades</MenuItem>
                          {QC_GRADES.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                        </TextField>

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
                          {brands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
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
                          {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
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
                          onClick={() => {
                            setSearchFilter('');
                            setStatusFilter('');
                            setGradeFilter('');
                            setBrandFilter('');
                            setCategoryFilter('');
                            setDateFromFilter('');
                            setDateToFilter('');
                            setPage(1);
                          }}
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
                          startIcon={refreshing ? <CircularProgress size={14} /> : refreshSuccess ? <CheckCircle sx={{ color: '#10b981' }} /> : <RefreshIcon />}
                          onClick={() => { loadQCList({ buttonRefresh: true }); setMobileActionsOpen(false); }}
                          disabled={refreshing}
                          sx={{ height: 44, fontSize: '0.85rem', gridColumn: 'span 2' }}
                        >
                          {refreshing ? 'Refreshing...' : refreshSuccess ? 'Refreshed' : 'Refresh'}
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
                      setSearchFilter('');
                      setStatusFilter('');
                      setGradeFilter('');
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
                    onClick={() => { setPage(1); setMobileActionsOpen(false); loadQCList(); }}
                    sx={{ height: 48 }}
                  >
                    Apply
                  </Button>
                </Box>
              </Dialog>

              {/* TABLE - AG GRID (always render grid so header remains visible) */}
              <Box sx={{
                flex: 1,
                minHeight: 0,
                border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d1d5db',
                position: 'relative'
              }}>

                {/* Loading Spinner Overlay - semi-transparent so data stays visible */}
                {listLoading && qcList && qcList.length > 0 && (
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
                {listLoading && (!qcList || qcList.length === 0) && (
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
                {!listLoading && (!qcList || qcList.length === 0) && (
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
                        No QC items match your current filters. Try adjusting your search criteria or reset filters to see all items.
                      </Typography>
                    </Box>
                  </Box>
                )}

                <Box sx={{ height: '100%', width: '100%', bgcolor: isDarkMode ? '#1e293b' : '#ffffff' }}>
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
                        rowData={qcList}
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
                        rowBuffer={20}
                        valueCache={true}
                        debounceVerticalScrollbar={true}
                        gridOptions={{ getRowId: (params: any) => String(params.data?.id || params.data?.wsn || params.rowIndex), suppressRowTransform: true }}
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
                                params.api.autoSizeColumns(allColIds);
                              }
                              hasAutoFittedRef.current = true;
                            } catch { /* ignore */ }
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
          )}

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

          {/* ========== TAB 1: SINGLE QC ========== */}
          {currentTabCode === 'single' && (
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
                    >
                      📝 Single QC Entry
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
                          >
                            ⚙️ Manage Grades
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
                            ✓ Submit QC Entry
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
                          >
                            ⚙️ Grades
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
                      >
                        📊 Today's QC Stats
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
          {currentTabCode === 'multi' && (() => {
            // Column definitions for AG Grid
            const columnDefs = visibleColumns.map((field: string) => {
              // Normalize the field (remove underscores and lowercase) to match COLUMN_WIDTHS / ALL_MASTER_COLUMNS keys
              const key = String(field).replace(/_/g, '').toLowerCase();
              const isEditable = EDITABLE_COLUMNS.includes(field);

              // Use default column widths from COLUMN_WIDTHS config
              const widthConfig = COLUMN_WIDTHS[key] || {};

              const baseColDef: any = {
                field,
                // prettier header for underscore-field names
                headerName: field === 'sno' ? 'S.No' : String(field).replace(/_/g, ' ').toUpperCase(),
                ...widthConfig,
                cellStyle: (params: any) => {
                  const styles: any = {};

                  // ✅ SERIAL NUMBER STYLING - centered with bold text
                  if (field === 'sno') {
                    styles.fontWeight = 700;
                    styles.color = isDarkMode ? '#94a3b8' : '#64748b';
                    styles.textAlign = 'center';
                  }
                  return styles;
                },
              };

              // ✅ SERIAL NUMBER COLUMN (Auto-numbered, non-editable)
              if (field === 'sno') {
                baseColDef.valueGetter = (params: any) => params.node.rowIndex + 1;
                baseColDef.editable = false;
                return baseColDef;
              }



              //  Visual indicators for WSN column with icons
              if (field === 'wsn') {
                baseColDef.cellRenderer = (params: any) => {
                  return params.value || '';
                };
              }

              // Special handling for specific columns (use normalized key)
              if (key === 'qcgrade' || field === 'qc_grade') {
                baseColDef.cellEditor = 'agSelectCellEditor';
                baseColDef.cellEditorParams = {
                  values: ['', ...QC_GRADES],
                };
              } else if (key === 'rackno' || field === 'rack_no') {
                baseColDef.cellEditor = 'agSelectCellEditor';
                baseColDef.cellEditorParams = {
                  values: ['', ...racks.map((r) => r.rack_name)],
                };
              }

              // Read-only for master data columns
              if (ALL_MASTER_COLUMNS.includes(key)) {
                baseColDef.editable = false;
              }

              return baseColDef;
            });

            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1, mt: 0 }}>
                {/* HEADER */}
                <Card sx={{ borderRadius: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', bgcolor: isDarkMode ? '#1e293b' : 'white' }}>
                  <CardContent sx={{ p: 1.2, '&:last-child': { pb: 1.2 } }}>

                    {/* ===== MOBILE: 2 ROWS ===== */}
                    <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                      {/* ROW 1: Date + Name Fields */}
                      <Stack
                        direction="row"
                        spacing={0.8}
                        alignItems="center"
                        sx={{ mb: 1 }}
                      >
                        <TextField
                          label="QC Date"
                          type="date"
                          value={commonQcDate}
                          onChange={(e) => setCommonQcDate(e.target.value)}
                          size="small"
                          sx={{
                            width: '48%',
                            '& .MuiInputBase-root': {
                              height: 32,
                              fontSize: '0.75rem'
                            },
                            '& .MuiInputLabel-root': {
                              fontSize: '0.7rem'
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
                            width: '48%',
                            '& .MuiInputBase-root': {
                              height: 32,
                              fontSize: '0.75rem'
                            },
                            '& .MuiInputLabel-root': {
                              fontSize: '0.7rem'
                            }
                          }}
                        />
                      </Stack>

                      {/* ROW 2: Chips + Buttons (NO WRAP) */}
                      <Stack
                        direction="row"
                        spacing={0.4}
                        alignItems="center"
                        sx={{
                          flexWrap: 'nowrap',
                          overflowX: 'auto',
                          '&::-webkit-scrollbar': { display: 'none' },
                          scrollbarWidth: 'none'
                        }}
                      >

                        {/* Buttons */}
                        <Stack direction="row" spacing={1} sx={{ flexShrink: 0, paddingRight: 5, ml: 'auto !important' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={add500Rows}
                            sx={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              width: 110,
                              '&:hover': {
                                borderWidth: 2,
                                bgcolor: 'rgba(245, 158, 11, 0.1)'
                              }
                            }}
                          >
                            +500 Rows
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<DownloadIcon sx={{ fontSize: '0.85rem' }} />}
                            onClick={exportMultiEntryToExcel}
                            disabled={!multiRows.some((r: any) => r.wsn?.trim())}
                            sx={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              width: 100,
                              borderColor: '#10b981',
                              color: '#10b981',
                              '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981' },
                              '&.Mui-disabled': { borderColor: '#94a3b8', color: '#94a3b8' }
                            }}
                          >
                            Export
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SettingsIcon sx={{ fontSize: '0.85rem' }} />}
                            onClick={() => setColumnSettingsOpen(true)}
                            sx={{
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              width: 110,
                              height: 26,
                              px: 0.8,
                              borderWidth: 2,
                              '&:hover': { borderWidth: 2 }
                            }}
                          >
                            Columns
                          </Button>



                          {/* ✅ NEW: Grid Settings Button */}
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SettingsIcon sx={{ fontSize: '0.85rem' }} />}
                            onClick={() => setGridSettingsOpen(true)}
                            sx={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              width: 110,
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
                    </Box>

                    {/* ===== DESKTOP: SINGLE ROW ===== */}
                    <Stack
                      direction="row"
                      spacing={2}
                      alignItems="center"
                      sx={{ display: { xs: 'none', md: 'flex' } }}
                    >
                      {/* Date + Name Fields */}
                      <TextField
                        label="QC Date"
                        type="date"
                        value={commonQcDate}
                        onChange={(e) => setCommonQcDate(e.target.value)}
                        size="small"
                        sx={{ width: 150 }}
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        label="QC By Name"
                        value={commonQcByName}
                        onChange={(e) => setCommonQcByName(e.target.value)}
                        size="small"
                        sx={{ width: 200 }}
                      />

                      {/* Buttons */}
                      <Stack direction="row" spacing={0.8}>

                        <Button
                          size="small"
                          variant="outlined"
                          onClick={add500Rows}
                          sx={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            '&:hover': {
                              borderWidth: 2,
                              bgcolor: 'rgba(245, 158, 11, 0.1)'
                            }
                          }}
                        >
                          +500 Rows
                        </Button>

                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SettingsIcon sx={{ fontSize: '0.85rem' }} />}
                          onClick={() => setColumnSettingsOpen(true)}
                          sx={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            '&:hover': {
                              borderWidth: 2,
                              bgcolor: 'rgba(245, 158, 11, 0.1)'
                            }
                          }}
                        >
                          Columns
                        </Button>


                        {/* ✅ NEW: Grid Settings Button */}
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SettingsIcon sx={{ fontSize: '0.85rem' }} />}
                          onClick={() => setGridSettingsOpen(true)}
                          sx={{
                            fontSize: '0.7rem',
                            fontWeight: 700,

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

                    // Active cell focus - Enhanced for dark mode
                    '& .ag-cell-focus': {
                      border: isDarkMode ? '2px solid #22d3ee !important' : '2px solid #2563eb !important',
                      outline: 'none',
                      boxShadow: isDarkMode ? '0 0 8px rgba(34, 211, 238, 0.4)' : '0 0 0 1px rgba(37, 99, 235, 0.3)',
                    },

                    // Range selection
                    '& .ag-cell-range-selected': {
                      backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.25) !important' : '#dbeafe !important',
                    },
                    '& .ag-cell-range-single-cell': {
                      backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2) !important' : '#eff6ff !important',
                    },

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

                    // Hover effects
                    '& .ag-row-hover': {
                      backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.12) !important' : '#e0f2fe !important',
                    },
                  }}
                >
                  <AgGridReact
                    ref={gridRef}
                    rowData={multiRows}
                    columnDefs={columnDefs}
                    rowHeight={tableRowHeight}
                    headerHeight={32}
                    getRowId={(params: any) => String(params.data?.id || params.node?.rowIndex || Math.random())}

                    onGridReady={(params: any) => {
                      gridRef.current = params.api;
                      columnApiRef.current = params.columnApi;
                      // Restore column state from localStorage
                      try {
                        const savedState = localStorage.getItem('qc_multi_grid_state');
                        if (savedState && params.api) {
                          params.api.applyColumnState({ state: JSON.parse(savedState), applyOrder: true });
                        }
                      } catch { /* ignore */ }
                    }}

                    defaultColDef={{
                      sortable: gridSettings.sortable,
                      filter: gridSettings.filter,
                      resizable: gridSettings.resizable,
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
                    }}

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

                    stopEditingWhenCellsLoseFocus={true}
                    enterNavigatesVertically={true}
                    enterNavigatesVerticallyAfterEdit={true}
                    navigateToNextCell={navigateToNextCell}
                    ensureDomOrder={true}
                    suppressMovableColumns={true}
                    // ⚡ PERFORMANCE: Optimizations
                    rowBuffer={20}
                    animateRows={false}
                    suppressScrollOnNewData={true}
                    debounceVerticalScrollbar={true}
                    suppressPropertyNamesCheck={true}
                    valueCache={true}
                    className="ag-theme-quartz"
                    containerStyle={{ height: '100%', width: '100%' }}
                    // ✅ Save column state when resized
                    onColumnResized={(params: any) => {
                      if (params.finished && params.api) {
                        try {
                          const columnState = params.api.getColumnState();
                          localStorage.setItem('qc_multi_grid_state', JSON.stringify(columnState));
                        } catch { /* ignore */ }
                      }
                    }}
                    onCellValueChanged={(event: any) => {
                      const { colDef, newValue, rowIndex } = event;
                      const field = colDef?.field;
                      if (!field) return;

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
                            icon: '🚫',
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
                            icon: '⚠️',
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
                            icon: '⚠️',
                          });


                          // Clear cell
                          newRows[rowIndex].wsn = '';
                          ALL_MASTER_COLUMNS.forEach((col) => {
                            newRows[rowIndex][col] = null;
                          });
                          setMultiRows(newRows);

                          // ✅ UPDATE CHIPS AFTER CLEARING
                          setTimeout(() => {
                            event.api.startEditingCell({
                              rowIndex: rowIndex,
                              colKey: 'wsn',
                            });
                          }, 100);
                          return;
                        }

                        // ✅ VALID WSN - Update row and chips (store uppercase)
                        newRows[rowIndex] = { ...newRows[rowIndex], [field]: wsn }; // Use uppercase wsn
                        setMultiRows(newRows);



                        // Auto add new rows at last row
                        if (rowIndex === event.api.getDisplayedRowCount() - 1) {
                          add500Rows();
                        }

                        // Fetch master data
                        if (wsn) {
                          setTimeout(async () => {
                            try {
                              const response = await qcAPI.getPendingInbound(activeWarehouse?.id, wsn);

                              // ✅ ADD DEBUG
                              console.log('🔍 API Response for WSN:', wsn, response.data[0]);

                              if (response.data.length > 0) {
                                const item = response.data[0];
                                setMultiRows((prevRows) => {
                                  const updatedRows = [...prevRows];
                                  updatedRows[rowIndex] = {
                                    ...updatedRows[rowIndex],
                                    // ✅ EXACT MAPPING FROM CONSOLE OUTPUT
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
                                  return updatedRows;
                                });
                              }

                            } catch (error) {
                              console.log('WSN not found in pending inbound');
                            }
                          }, 500);
                        }

                        return;
                      }

                      // ===== OTHER FIELDS (non-WSN) =====
                      newRows[rowIndex] = { ...newRows[rowIndex], [field]: newValue };
                      setMultiRows(newRows);
                    }}

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
                      Done
                    </Button>
                  </DialogActions>
                </Dialog>



                {/* DRAFT STATUS + ACTIONS + SUBMIT - Single Row */}
                <Box sx={{
                  display: 'flex',
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
                    ⚙️ Column View Settings
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
                              disabled={col === 'sno'}  // ✅ Can't uncheck serial number
                              onChange={(e) => {
                                if (col === 'sno') return;  // ✅ Safety check

                                let next: string[];
                                if (e.target.checked) {
                                  // Add column
                                  next = [...visibleColumns, col];
                                } else {
                                  // Remove column
                                  next = visibleColumns.filter((c: string) => c !== col);
                                }

                                // ✅ Build ordered array respecting user's choices
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

                                // ✅ Build ordered array respecting user's choices
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
            );
          })()}

          {/* ========== TAB 3: BULK UPLOAD ========== */}
          {currentTabCode === 'bulk' && (
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
                templateColumns={['WSN', 'QCBYNAME', 'QCDATE', 'GRADE', 'QCREMARKS', 'OTHERREMARKS', 'PRODUCTSERIALNUMBER', 'RACKNO']}
                title="📤 Bulk QC Upload"
              />
            </Box>
          )}

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
        </Paper>

        {/* EXPORT DIALOG */}
        <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>📥 Export QC Data</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField type="date" label="Start Date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
              <TextField type="date" label="End Date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
              <FormControl fullWidth size="small">
                <InputLabel>Grade</InputLabel>
                <Select
                  value={exportGrade}
                  label="Grade"
                  onChange={(e) => setExportGrade(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  {QC_GRADES.map((g) => (
                    <MenuItem key={g} value={g}>
                      {g}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleExport} variant="contained">
              Export
            </Button>
          </DialogActions>
        </Dialog>

        {/* GRADE MANAGEMENT DIALOG */}
        <Dialog open={gradeDialogOpen} onClose={() => { setGradeDialogOpen(false); setNewGrade(''); setEditingGradeIndex(null); }} maxWidth="sm" fullWidth>
          <DialogTitle>⚙️ Manage QC Grades</DialogTitle>
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
        </Dialog>

        {/* COLUMN SETTINGS - LIST */}
        <Dialog open={listColumnSettingsOpen} onClose={() => setListColumnSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>⚙️ Column Settings</DialogTitle>
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
        </Dialog>
      </Box >
    </AppLayout >
  );
}
