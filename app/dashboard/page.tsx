// File Path = warehouse-frontend\app\dashboard\page.tsx UUU
"use client";

//import { useState, useEffect } from "react";
import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Paper,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Card,
  Select,
  Tooltip,
  Pagination,
  Autocomplete,
  FormControlLabel,
  Checkbox,
  Collapse,
  useTheme,
  useMediaQuery,
  LinearProgress,
  Skeleton,
  InputBase,
  Fade,
  Drawer,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
} from "@mui/material";
import {
  Logout as LogoutIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  FilterList as FilterIcon,
  Info as InfoIcon,
  Tune as TuneIcon,
  RestartAlt as RestartAltIcon,
  Close as CloseIcon,
  InventoryRounded,
  PivotTableChart as PivotIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  FirstPage,
  LastPage,
  AccessTime,
  Menu as MenuIcon,
  ViewColumn as ViewColumnIcon,
  TableChart as TableChartIcon,
  CameraAlt as CameraIcon,
  Search as SearchIcon,
  OpenInNew as OpenInNewIcon,
} from "@mui/icons-material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { dashboardAPI, inventoryAPI, inboundAPI, pickingAPI, outboundAPI } from "@/lib/api";
import { useWarehouse } from "@/app/context/WarehouseContext";
import { getStoredUser, logout } from "@/lib/auth";
import { useDashboardPermissions } from '@/hooks/usePagePermissions';

import AppLayout from "@/components/AppLayout";
import { StandardPageHeader } from '@/components';
import { useTableRowHeight } from '@/app/context/AppearanceContext';
import PivotTableDrawer from '@/components/PivotTableDrawer';
import CameraScanner from '@/components/CameraScanner';
import toast, { Toaster } from "react-hot-toast";
// ⚡ OPTIMIZED: XLSX loaded dynamically on export to reduce bundle size
// import * as XLSX from "xlsx"; // Removed static import

import { AgGridReact } from '@/components/AGGridScrollWrapper';
import { ModuleRegistry, AllCommunityModule, ClientSideRowModelModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

// Register AG Grid modules ONCE (explicitly include ClientSideRowModel)
ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

import {
  DashboardRounded,
  LoginRounded,
  CheckCircleRounded,
  LocalShippingRounded,
  SendRounded,
} from "@mui/icons-material";

interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  warehouseId?: number;
}

interface InventoryItem {
  wsn: string;
  wid?: string;
  fsn?: string;
  order_id?: string;
  fkqc_remark?: string;
  fk_grade?: string;
  product_title: string;
  hsn_sac?: string;
  igst_rate?: number;
  fsp: number;
  mrp: number;
  invoice_date?: string;
  fkt_link?: string;
  wh_location?: string;
  brand: string;
  cms_vertical: string;
  vrp?: number;
  yield_value?: number;
  p_type?: string;
  p_size?: string;
  inbound_date: string;
  inbound_status: string;
  qc_date: string;
  qc_status: string;
  qc_grade: string;
  picking_date: string;
  picking_status: string;
  outbound_date: string;
  outbound_status: string;
  vehicle_no: string;
  warehouse_location: string;
  rack_no: string;
  current_stage: string;
  [key: string]: any;
}

const ALL_COLUMNS = [
  "wsn",
  "wid",
  "fsn",
  "order_id",
  "fkqc_remark",
  "fk_grade",
  "product_title",
  "hsn_sac",
  "igst_rate",
  "fsp",
  "mrp",
  "invoice_date",
  "fkt_link",
  "wh_location",
  "brand",
  "cms_vertical",
  "vrp",
  "yield_value",
  "p_type",
  "p_size",
  "inbound_date",
  "inbound_status",
  "qc_date",
  "qc_status",
  "qc_grade",
  "picking_date",
  "picking_status",
  "outbound_date",
  "outbound_status",
  "vehicle_no",
  "warehouse_location",
  "rack_no",
  "current_stage",
];

const DEFAULT_VISIBLE_COLUMNS = [
  "wsn",
  "wid",
  "fsn",
  "product_title",
  "brand",
  "cms_vertical",
  "fsp",
  "mrp",
  "qc_status",
  "picking_status",
  "outbound_status",
  "order_id",
  "fkqc_remark",
  "p_type",
  "current_stage",
];

// Column width configuration - adjust per column. Use numbers for fixed widths (px) or flex for flexible columns.
// You can add mobile overrides using a `mobile` key; otherwise the helper will scale widths on small screens.
const COLUMN_WIDTHS: Record<string, any> = {
  wid: { width: 80 },
  fsn: { width: 130 },
  order_id: { width: 130 },
  fkqc_remark: { width: 150 },
  fk_grade: { width: 100 },
  hsn_sac: { width: 120 },
  igst_rate: { width: 100 },
  invoice_date: { width: 120 },
  fkt_link: { width: 120 },
  wh_location: { width: 120 },
  vrp: { width: 100 },
  yield_value: { width: 100 },
  p_type: { width: 100 },
  p_size: { width: 100 },
  wsn: { width: 80 },
  product_title: { width: 350 },
  brand: { width: 100 },
  cms_vertical: { width: 120 },
  fsp: { width: 100 },
  mrp: { width: 100 },
  inbound_status: { width: 100 },
  qc_status: { width: 100 },
  qc_grade: { width: 100 },
  picking_status: { width: 100 },
  outbound_status: { width: 100 },
  current_stage: { width: 100 },
  vehicle_no: { width: 130 },
  warehouse_location: { width: 150 },
  rack_no: { width: 120 },
  inbound_date: { width: 120 },
  qc_date: { width: 120 },
  picking_date: { width: 120 },
  outbound_date: { width: 120 },
};

const PIPELINE_STAGES = [
  { value: "all", label: "All Items" },
  { value: "inbound", label: "Inbound" },
  { value: "qc", label: "QC (Done)" },
  { value: "picking", label: "Picking" },
  { value: "dispatched", label: "Dispatched" },
];

// ⚡ WINDOW-LEVEL CACHE: Persists data outside React lifecycle for instant navigation
// This survives component unmount/remount during client-side navigation
declare global {
  interface Window {
    __DASHBOARD_CACHE__?: {
      data: InventoryItem[];
      total: number;
      timestamp: number;
      warehouseId?: number;
    };
  }
}

// Helper: Get user-specific grid state localStorage key
// Ensures each user's column widths are saved/restored independently
const getDashboardGridStateKey = (): string => {
  try {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u?.id) return `dashboard_grid_state_user_${u.id}`;
      }
    }
  } catch { /* ignore */ }
  return 'dashboard_grid_state';
};

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
const getCachedDashboardData = (): InventoryItem[] => {
  const currentWarehouseId = getCurrentWarehouseId();

  // Priority 1: Window cache (fastest, survives navigation)
  if (typeof window !== 'undefined' && window.__DASHBOARD_CACHE__?.data?.length) {
    // Only use cache if warehouse matches and not stale (2 min TTL)
    if (window.__DASHBOARD_CACHE__.warehouseId === currentWarehouseId &&
        Date.now() - (window.__DASHBOARD_CACHE__.timestamp || 0) < 120000) {
      return window.__DASHBOARD_CACHE__.data;
    }
  }
  // Priority 2: SessionStorage (survives page refresh) - skip if warehouse mismatch
  try {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('dashboard_last_data');
      const savedWarehouseId = sessionStorage.getItem('dashboard_last_data_warehouseId');
      if (saved && savedWarehouseId && parseInt(savedWarehouseId, 10) === currentWarehouseId) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Also populate window cache for faster subsequent access
          window.__DASHBOARD_CACHE__ = { data: parsed, total: parsed.length, timestamp: Date.now(), warehouseId: currentWarehouseId };
          return parsed;
        }
      }
    }
  } catch { /* ignore */ }
  return [];
};

/** Isolated TimeAgo component — re-renders itself every 10s without triggering parent re-render */
const TimeAgo = memo(({ date }: { date: Date | null }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!date) return;
    const id = setInterval(() => tick(p => p + 1), 10000);
    return () => clearInterval(id);
  }, [date]);
  if (!date) return null;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  let label: string;
  if (seconds < 10) label = 'just now';
  else if (seconds < 60) label = `${seconds}s ago`;
  else { const m = Math.floor(seconds / 60); label = m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`; }
  return <>{label}</>;
});
TimeAgo.displayName = 'TimeAgo';

export default function DashboardPage() {
  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [user, setUser] = useState<User | null>(null);

  // ⚡ INSTANT NAVIGATION: Track if dashboard was already mounted in this session
  const didInitialMountRef = useRef(
    (() => {
      try {
        return sessionStorage.getItem('dashboard_mounted_this_session') === 'true';
      } catch { return false; }
    })()
  );

  // ⚡ BACKGROUND REFRESH: State for subtle progress bar (not blocking overlay)
  const [isBackgroundRefresh, setIsBackgroundRefresh] = useState(false);

  // ⚡ SSR/HYDRATION FIX: Track if component has mounted on client
  // This prevents empty grid flash during SSR and hydration
  const [isMounted, setIsMounted] = useState(false);

  // ⚡ INSTANT DATA REF: Store cached data in ref for immediate synchronous access
  // This ref is read SYNCHRONOUSLY during render to avoid empty grid flash
  // Use IIFE to get cache data on client, empty array on server
  const cachedDataRef = useRef<InventoryItem[]>(
    typeof window !== 'undefined' ? getCachedDashboardData() : []
  );

  // ⚡ SYNCHRONOUS MOUNT: Use useLayoutEffect to load cache BEFORE paint
  // This runs synchronously after DOM mutations but before browser paint
  useLayoutEffect(() => {
    setIsMounted(true);
    // Load cached data SYNCHRONOUSLY for immediate display
    const cached = getCachedDashboardData();
    if (cached.length > 0) {
      cachedDataRef.current = cached;
      setFilteredData(cached);
      setInventoryData(cached);
      setLoading(false); // Important: set loading false since we have data
      lastNonEmptyDataRef.current = cached;
      previousDataRef.current = cached;
    }
  }, []);


  // Dark mode state
  const isDarkMode = theme.palette.mode === 'dark';

  // Get table row height from appearance settings
  const tableRowHeight = useTableRowHeight();

  // Permission hook - import at top of file
  const { canSeeButton, canAccessButton, isAdmin, isLoading: permLoading } = useDashboardPermissions();

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  // ⚡ INSTANT NAVIGATION: Initialize from window cache/sessionStorage to prevent empty grid flash
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>(() => getCachedDashboardData());
  const [filteredData, setFilteredData] = useState<InventoryItem[]>(() => getCachedDashboardData());

  // loading=false if we have cached data (instant navigation), true otherwise
  const [loading, setLoading] = useState(() => getCachedDashboardData().length === 0);
  // ⚡ INSTANT NAVIGATION: Initialize columns synchronously to prevent empty grid flash
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dashboardColumns');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return DEFAULT_VISIBLE_COLUMNS;
  });
  const gridRef = useRef<any>(null);
  const columnApiRef = useRef<any>(null);
  const hasAutoFittedRef = useRef(false); // Track if auto-fit has been done
  // ⚡ FLASH FIX: Track when AG Grid has actually rendered data rows
  const [gridDataRendered, setGridDataRendered] = useState(false);
  // ⚡ INSTANT COLUMN DEFS: Initialize with default columns to prevent empty grid header
  const [columnDefs, setColumnDefs] = useState<any[]>(() => {
    // Build initial column defs synchronously for immediate render
    const cols = (() => {
      try {
        const saved = localStorage.getItem('dashboardColumns');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch { /* ignore */ }
      return DEFAULT_VISIBLE_COLUMNS;
    })();

    const srCol = {
      headerName: 'SR.NO',
      field: '__sr',
      valueGetter: (params: any) => params.node ? params.node.rowIndex + 1 : undefined,
      width: 20,
      maxWidth: 50,
      suppressMovable: true,
      sortable: false,
      filter: false,
      cellStyle: { fontWeight: 700, textAlign: 'center' },
    };

    const colDefs = [srCol, ...cols.map((col) => ({
      field: col,
      headerName: col.replace(/_/g, ' ').toUpperCase(),
      sortable: true,
      resizable: true,
      filter: 'agTextColumnFilter',
    }))];

    colDefs.push({
      headerName: 'Action',
      field: '__action',
      width: 90,
      resizable: true,
      sortable: false,
      filter: false,
    } as any);

    return colDefs;
  });
  const [pickingWSNs, setPickingWSNs] = useState<Set<string>>(new Set());
  const [outboundWSNs, setOutboundWSNs] = useState<Set<string>>(new Set());

  // ====== DASHBOARD COLUMN WIDTHS PERSISTENCE ======
  // Note: Column widths are managed by ag-Grid's native column state API
  // Saved/restored via localStorage in grid event handlers
  // This state is only used for legacy compatibility with getColumnSizing
  const [columnWidths] = useState<Record<string, number>>({});

  // Pagination state - declared early for use in column defs
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);

  // Smooth loading helpers (avoid blinking): debounce, abort controller, delayed overlay
  const currentLoadIdRef = useRef(0);
  const inventoryAbortControllerRef = useRef<AbortController | null>(null);
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const overlayShownRef = useRef(false);
  const overlayStartRef = useRef<number | null>(null);
  const SHOW_OVERLAY_DELAY = 50; // ms
  const MIN_LOADING_MS = 100; // ms - ensure overlay visible long enough to avoid flicker
  const [topLoading, setTopLoading] = useState(false);
  const inventoryLoadDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // Track if this is the very first load ever (persisted to localStorage)
  const [initialLoad, setInitialLoad] = useState<boolean>(() => {
    try { return !localStorage.getItem('dashboard_ever_loaded'); } catch { return true; }
  });
  // ⚡ PROFESSIONAL PAGINATION: Keep previous data visible during page transitions
  // Initialize from cache to ensure immediate availability
  const previousDataRef = useRef<InventoryItem[] | null>(getCachedDashboardData().length > 0 ? getCachedDashboardData() : null);
  const [isFetching, setIsFetching] = useState(false);

  // ⚡ BACKGROUND REFRESH: Track when refreshing with existing data visible (prevents row fluctuation)
  const isBackgroundRefreshRef = useRef(false);

  // ⚡ FORCE OVERLAY: Track when we want to force show overlay spinner (e.g., reset filters)
  const forceOverlayRef = useRef(false);

  // ⚡ INSTANT NAVIGATION: Keep last non-empty data to prevent empty grid flash on return
  const lastNonEmptyDataRef = useRef<InventoryItem[] | null>(getCachedDashboardData().length > 0 ? getCachedDashboardData() : null);

  // ⚡ PAGE CACHE: Store fetched pages for instant back navigation (persisted to sessionStorage)
  const pageCacheRef = useRef<Map<string, { data: InventoryItem[], total: number, timestamp: number }>>(
    (() => {
      try {
        const saved = sessionStorage.getItem('dashboard_page_cache');
        if (saved) {
          const parsed = JSON.parse(saved);
          return new Map(Object.entries(parsed)) as Map<string, { data: InventoryItem[], total: number, timestamp: number }>;
        }
      } catch { /* ignore */ }
      return new Map();
    })()
  );
  const PAGE_CACHE_TTL = 120000; // 2 minutes cache validity for smoother navigation

  // ⚡ LAST REFRESH TIME: Track when data was last fetched
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // ⚡ AUTO-RETRY: Track retry attempts
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  // ⚡ LAZY LOADING: Defer non-critical loads for faster initial render
  const initialDataLoadedRef = useRef(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // ⚡ QUICK PAGE JUMP: State for page input
  const [pageInputValue, setPageInputValue] = useState('');
  const [showPageInput, setShowPageInput] = useState(false);

  const [enableSorting, setEnableSorting] = useState<boolean>(() => {
    try { return localStorage.getItem('dashboard_enableSorting') !== 'false'; } catch { return true; }
  });
  const [enableColumnFilters, setEnableColumnFilters] = useState<boolean>(() => {
    try { return localStorage.getItem('dashboard_enableColumnFilters') !== 'false'; } catch { return true; }
  });
  const [enableColumnResize, setEnableColumnResize] = useState<boolean>(() => {
    try { return localStorage.getItem('dashboard_enableColumnResize') !== 'false'; } catch { return true; }
  });
  const [enableCellEditing, setEnableCellEditing] = useState<boolean>(() => {
    try { return localStorage.getItem('dashboard_enableCellEditing') !== 'false'; } catch { return true; }
  });

  const defaultColDef = useMemo(() => ({
    sortable: !!enableSorting,
    resizable: !!enableColumnResize,
    filter: !!enableColumnFilters,
    editable: false,
    minWidth: 80,
    tooltipComponentParams: { color: '#ececec' },
    cellStyle: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  }), [enableSorting, enableColumnFilters, enableColumnResize]);

  // ⚡ STABLE ROW DATA: Compute grid row data with useMemo for stable reference
  // This ensures the grid NEVER receives an empty array when we have cached data
  // Priority order: Window cache (survives navigation) > State > Refs
  const gridRowData = useMemo(() => {
    // Priority 1: Window cache - MOST RELIABLE on client navigation (survives remount)
    if (typeof window !== 'undefined' && window.__DASHBOARD_CACHE__?.data?.length) {
      return window.__DASHBOARD_CACHE__.data;
    }
    // Priority 2: Current filtered data from state
    if (filteredData && filteredData.length > 0) {
      return filteredData;
    }
    // Priority 3: Cached data ref (synchronously available on client)
    if (cachedDataRef.current && cachedDataRef.current.length > 0) {
      return cachedDataRef.current;
    }
    // Priority 4: Last non-empty data ref
    if (lastNonEmptyDataRef.current && lastNonEmptyDataRef.current.length > 0) {
      return lastNonEmptyDataRef.current;
    }
    // Priority 5: Previous data ref
    if (previousDataRef.current && previousDataRef.current.length > 0) {
      return previousDataRef.current;
    }
    return [];
  }, [filteredData, inventoryData, isMounted]); // isMounted triggers recompute after client mount

  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);
  const [pivotOpen, setPivotOpen] = useState(false);

  // ====== SETTINGS PANEL STATE ======
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [settingsPanelExpanded, setSettingsPanelExpanded] = useState<string | false>('filters');

  // Grid settings
  useEffect(() => {
    try {
      const s = localStorage.getItem('dashboard_enableSorting');
      const f = localStorage.getItem('dashboard_enableColumnFilters');
      const r = localStorage.getItem('dashboard_enableColumnResize');
      const e = localStorage.getItem('dashboard_enableCellEditing');
      if (s !== null) setEnableSorting(s === 'true');
      if (f !== null) setEnableColumnFilters(f === 'true');
      if (r !== null) setEnableColumnResize(r === 'true');
      if (e !== null) setEnableCellEditing(e === 'true');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('dashboard_enableSorting', String(enableSorting));
      localStorage.setItem('dashboard_enableColumnFilters', String(enableColumnFilters));
      localStorage.setItem('dashboard_enableColumnResize', String(enableColumnResize));
      localStorage.setItem('dashboard_enableCellEditing', String(enableCellEditing));
    } catch { }
  }, [enableSorting, enableColumnFilters, enableColumnResize, enableCellEditing]);

  const formatGridDate = (raw: any) => {
    if (!raw) return '-';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // Get column sizing from predefined widths (widths are applied via ag-Grid column state, not here)
  const getColumnSizing = useCallback((col: string) => {
    const sizing = COLUMN_WIDTHS[col];
    if (!sizing) return {};
    // if explicit mobile override present, use it when on mobile
    if (isMobile && sizing.mobile) return { ...sizing.mobile, ...(sizing.mobile.width ? { suppressSizeToFit: true } : {}) };

    if (isMobile) {
      // scale fixed widths down for mobile
      const r: any = {};
      if (sizing.flex) r.flex = sizing.flex;
      if (sizing.width) {
        r.width = Math.max(70, Math.round(sizing.width * 0.7));
        r.suppressSizeToFit = true;
      }
      if (sizing.maxWidth) r.maxWidth = Math.round(sizing.maxWidth * 0.8);
      return r;
    }

    // Desktop / default
    const r: any = { ...sizing };
    if (sizing.width && !sizing.flex) r.suppressSizeToFit = true;
    return r;
  }, [isMobile]);

  useEffect(() => {
    // SR.NO column - always first
    const srCol = {
      headerName: 'SR.NO',
      field: '__sr',
      valueGetter: (params: any) => params.node ? (page - 1) * limit + params.node.rowIndex + 1 : undefined,
      width: 20,
      maxWidth: 50,
      suppressMovable: true,
      sortable: false,
      filter: false,
      cellStyle: { fontWeight: 700, textAlign: 'center' },
    };

    const defs: any = [srCol, ...visibleColumns.map((col) => {
      const headerName = col.replace(/_/g, ' ').toUpperCase();
      const base: any = {
        field: col,
        headerName,
        sortable: enableSorting,
        resizable: enableColumnResize,
      };

      // Status-like columns (use chips)
      if (col.includes('status')) {
        return {
          ...base,
          filter: enableColumnFilters ? 'agTextColumnFilter' : undefined,
          cellRenderer: (p: any) => {
            // Use latest pickingWSNs and outboundWSNs values
            const wsn = p.data?.wsn;
            if (col === 'picking_status' && wsn && pickingWSNs.has(wsn)) {
              return (
                <Chip label="DONE" size="small" sx={{ bgcolor: getStatusColor('DONE'), color: 'white', fontSize: '0.6rem' }} />
              );
            }
            if (col === 'outbound_status' && wsn && outboundWSNs.has(wsn)) {
              return (
                <Chip label="DONE" size="small" sx={{ bgcolor: getStatusColor('DONE'), color: 'white', fontSize: '0.7rem' }} />
              );
            }

            const raw = p.value;
            if (!raw) return (
              <Chip label="-" size="small" sx={{ bgcolor: '#999', color: 'white', fontSize: '0.7rem' }} />
            );
            const s = String(raw).toLowerCase();
            const normalized = s.includes('pend')
              ? 'PENDING'
              : (s.includes('done') || s.includes('pass') || s.includes('complete') || s.includes('ok'))
                ? 'DONE'
                : String(raw).toUpperCase();
            return (
              <Chip
                label={normalized}
                size="small"
                sx={{ bgcolor: getStatusColor(normalized), color: 'white', fontSize: '0.7rem' }}
              />
            );
          },
          suppressHeaderMenuButton: true,
          ...getColumnSizing(col),
        };
      }

      // Current stage special renderer
      if (col === 'current_stage') {
        return {
          ...base,
          filter: enableColumnFilters ? 'agTextColumnFilter' : undefined,
          cellRenderer: (p: any) => (
            <Chip label={p.value || '-'} color={getStageColor(p.value) as any} size="small" variant="outlined" />
          ),
          suppressHeaderMenuButton: true,
          ...getColumnSizing(col),
        };
      }

      // Dates formatting
      if (col.includes('date') || col === 'invoice_date') {
        return {
          ...base,
          filter: enableColumnFilters ? 'agDateColumnFilter' : undefined,
          valueFormatter: (p: any) => formatGridDate(p.value),
          tooltipField: col,
          ...getColumnSizing(col),
        };
      }

      // Default text column (apply sizing if present)
      const sizing = getColumnSizing(col);
      return {
        ...base,
        filter: enableColumnFilters ? 'agTextColumnFilter' : undefined,
        tooltipField: col,
        ...sizing,
      };
    })];

    // Action column
    defs.push({
      headerName: 'Action',
      field: '__action',
      cellRenderer: (p: any) => (
        <IconButton
          size="small"
          onClick={() => {
            setSelectedItem(p.data);
            setDetailsDialogOpen(true);
          }}
          sx={{ color: "#1e40af", p: 0.5 }}
        >
          <FilterIcon fontSize="small" />
        </IconButton>
      ),
      width: 90,
      suppressHeaderMenuButton: true,
      resizable: enableColumnResize,
      sortable: false,
    });

    setColumnDefs(defs);
  }, [visibleColumns, enableSorting, enableColumnFilters, enableColumnResize, isMobile, page, limit, getColumnSizing]);

  // Re-apply column state when columnDefs change (e.g., column visibility toggle)
  // applyOrder: false - updates widths/visibility WITHOUT changing order
  // Order is set ONLY ONCE in onGridReady
  useEffect(() => {
    if (gridRef.current) {
      try {
        const stateKey = getDashboardGridStateKey();
        const saved = localStorage.getItem(stateKey);
        if (saved) {
          const state = JSON.parse(saved);
          gridRef.current.applyColumnState({ state, applyOrder: false });
        }
      } catch { /* ignore */ }
    }
  }, [columnDefs]);

  const [searchWSN, setSearchWSN] = useState("");

  // WSN Product Lookup
  const [lookupWSN, setLookupWSN] = useState('');
  const [lookupCameraOpen, setLookupCameraOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupError, setLookupError] = useState('');

  const handleWSNLookup = useCallback(async (wsn: string) => {
    const trimmed = wsn.trim().toUpperCase();
    if (!trimmed || !activeWarehouse?.id) return;
    setLookupWSN(trimmed);
    setLookupLoading(true);
    setLookupError('');
    setLookupResult(null);
    try {
      const res = await pickingAPI.getSourceByWSN(trimmed, activeWarehouse.id);
      if (res.data) { setLookupResult(res.data); return; }
    } catch { /* try fallback */ }
    try {
      const res = await inboundAPI.getMasterDataByWSN(trimmed, activeWarehouse.id);
      if (res.data) { setLookupResult(res.data); return; }
    } catch { /* ignore */ }
    setLookupError(`No product found for WSN: ${trimmed}`);
    setLookupLoading(false);
  }, [activeWarehouse?.id]);

  // Clear loading when result or error is set
  useEffect(() => {
    if (lookupResult || lookupError) setLookupLoading(false);
  }, [lookupResult, lookupError]);

  const [stageFilter, setStageFilter] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [brandFilter, setBrandFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);

  const [searchDebounced, setSearchDebounced] = useState(searchWSN);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  // fallbackRows removed; grid now always displays server-provided data via `filteredData` (pagination handled by server)

  // Determine if any filters are active (used to show Reset button instead of Menu)
  const filtersActive = Boolean(
    (searchWSN && searchWSN.trim() !== "") ||
    (stageFilter && stageFilter !== "all") ||
    availableOnly ||
    (brandFilter && brandFilter !== "") ||
    (categoryFilter && categoryFilter !== "") ||
    (dateFrom && dateFrom !== "") ||
    (dateTo && dateTo !== "")
  );



  // Infinite scroll removed: using server-side pagination. All data is fetched by `loadInventoryData()` and displayed via `filteredData`.



  interface Metrics {
    total: number;
    inbound: number;
    qcPending: number;
    qcPassed: number;
    qcDone: number;
    qcTotal: number;
    qcFailed: number;
    pickingPending: number;
    pickingCompleted: number;
    outboundReady: number;
    outboundDispatched: number;
  }

  const initialMetrics = useMemo<Metrics>(() => ({
    total: 0,
    inbound: 0,
    qcPending: 0,
    qcPassed: 0,
    qcDone: 0,
    qcTotal: 0,
    qcFailed: 0,
    pickingPending: 0,
    pickingCompleted: 0,
    outboundReady: 0,
    outboundDispatched: 0,
  }), []);

  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);

  // Inventory summary state
  const [inventorySummary, setInventorySummary] = useState({
    available_stock: 0,
    qc_pending: 0,
    ready_for_dispatch: 0,
    dispatched_items: 0,
  });

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    dateFrom: "",
    dateTo: "",
    stage: "all",
    brand: "",
    category: "",
    // scope for export: 'all' | 'available'
    availableOnly: 'all',
  });
  const [exportLoading, setExportLoading] = useState(false);

  // NOTE: sessionStorage read moved to useState initializers for instant data on navigation return


  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(searchWSN), 100);
    return () => clearTimeout(id);
  }, [searchWSN]);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push("/login");
      return;
    }
    setUser(storedUser);
  }, [router]);

  // NOTE: visibleColumns now initialized synchronously in useState
  // Only load savedLimit here (columns already loaded)
  useEffect(() => {
    const savedLimit = localStorage.getItem("dashboardLimit");
    if (savedLimit) {
      setLimit(Number(savedLimit));
    }
  }, []);

  useEffect(() => {
    if (visibleColumns.length > 0) {
      localStorage.setItem("dashboardColumns", JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem("dashboardLimit", String(limit));
  }, [limit]);

  // ⚡ HELPER: Generate cache key for current filters
  const getCacheKey = useCallback(() => {
    return JSON.stringify({
      warehouseId: activeWarehouse?.id,
      page,
      limit,
      search: searchDebounced,
      stage: stageFilter,
      availableOnly,
      brand: brandFilter,
      category: categoryFilter,
      dateFrom,
      dateTo,
    });
  }, [activeWarehouse?.id, page, limit, searchDebounced, stageFilter, availableOnly, brandFilter, categoryFilter, dateFrom, dateTo]);

  // ⚡ PREFETCH: Prefetch next page in background
  const prefetchNextPage = useCallback(async () => {
    const totalPages = Math.ceil(total / limit);
    if (page >= totalPages) return; // No next page

    const nextPageCacheKey = JSON.stringify({
      warehouseId: activeWarehouse?.id,
      page: page + 1,
      limit,
      search: searchDebounced,
      stage: stageFilter,
      availableOnly,
      brand: brandFilter,
      category: categoryFilter,
      dateFrom,
      dateTo,
    });

    // Check if already cached
    const cached = pageCacheRef.current.get(nextPageCacheKey);
    if (cached && Date.now() - cached.timestamp < PAGE_CACHE_TTL) return;

    try {
      const params: any = {
        warehouseId: activeWarehouse?.id,
        page: page + 1,
        limit,
      };
      if (searchDebounced) params.search = searchDebounced;
      if (stageFilter && stageFilter !== "all") params.stage = stageFilter;
      if (availableOnly) params.availableOnly = true;
      if (brandFilter) params.brand = brandFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const response = await dashboardAPI.getInventoryPipeline(params);
      const rows = (response.data?.data || []) as InventoryItem[];

      // Store in cache
      pageCacheRef.current.set(nextPageCacheKey, {
        data: rows,
        total: response.data?.pagination?.total || 0,
        timestamp: Date.now(),
      });
    } catch {
      // Silently fail - prefetch is optional
    }
  }, [activeWarehouse?.id, page, limit, total, searchDebounced, stageFilter, availableOnly, brandFilter, categoryFilter, dateFrom, dateTo]);

  const loadInventoryData = useCallback(async (forceRefresh = false, showOverlay = false) => {
    currentLoadIdRef.current += 1;
    const loadId = currentLoadIdRef.current;
    const cacheKey = getCacheKey();

    // ⚡ Check if force overlay was requested (e.g., from reset filters)
    const shouldShowOverlay = showOverlay || forceOverlayRef.current;
    if (forceOverlayRef.current) {
      forceOverlayRef.current = false; // Reset the flag
    }

    // ⚡ PAGE CACHE: Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = pageCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PAGE_CACHE_TTL) {
        previousDataRef.current = cached.data;
        setInventoryData(cached.data);
        setFilteredData(cached.data);
        setTotal(cached.total);
        setLastRefreshTime(new Date(cached.timestamp));
        setLoading(false);
        setIsBackgroundRefresh(false);
        setTimeout(() => prefetchNextPage(), 100);
        return;
      }
    }

    // 🔥 ENHANCED: Show overlay spinner when showOverlay=true (filter changes/reset)
    const hasExistingData = (filteredData && filteredData.length > 0) ||
      (lastNonEmptyDataRef.current && lastNonEmptyDataRef.current.length > 0);

    if (shouldShowOverlay || forceRefresh) {
      // ⚡ FILTER CHANGE: Show blocking overlay spinner
      setLoading(true);
      setIsBackgroundRefresh(false);
      isBackgroundRefreshRef.current = false;
    } else if (hasExistingData) {
      // ⚡ SUBTLE REFRESH: Only show progress bar, not blocking overlay
      setIsBackgroundRefresh(true);
      setLoading(false); // Don't show blocking overlay
      isBackgroundRefreshRef.current = true;
    } else if (!initialLoad) {
      setLoading(true);
      setIsBackgroundRefresh(false);
    }

    // Cancel previous request
    if (inventoryAbortControllerRef.current) {
      try { inventoryAbortControllerRef.current.abort(); } catch { }
      inventoryAbortControllerRef.current = null;
    }
    const controller = new AbortController();
    inventoryAbortControllerRef.current = controller;

    try {
      const params: any = {
        warehouseId: activeWarehouse?.id,
        page,
        limit,
      };

      if (searchDebounced) params.search = searchDebounced;
      if (stageFilter && stageFilter !== "all") params.stage = stageFilter;
      if (availableOnly) params.availableOnly = true;
      if (brandFilter) params.brand = brandFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const response = await dashboardAPI.getInventoryPipeline(params, { signal: controller.signal });
      const rows = (response.data?.data || []) as InventoryItem[];

      if (loadId === currentLoadIdRef.current) {
        // 🔥 Update data BEFORE clearing loading
        previousDataRef.current = rows;

        if (rows && rows.length > 0) {
          lastNonEmptyDataRef.current = rows;
          // ⚡ WINDOW CACHE: Store in window for instant navigation (survives component unmount)
          if (typeof window !== 'undefined') {
            window.__DASHBOARD_CACHE__ = {
              data: rows,
              total: response.data?.pagination?.total || 0,
              timestamp: Date.now(),
              warehouseId: activeWarehouse?.id
            };
          }
          try {
            sessionStorage.setItem('dashboard_last_data', JSON.stringify(rows));
            sessionStorage.setItem('dashboard_last_data_warehouseId', String(activeWarehouse?.id || ''));
          } catch { }
        }

        setInventoryData(rows);
        setFilteredData(rows);
        setTotal(response.data?.pagination?.total || 0);
        setLastRefreshTime(new Date());
        isBackgroundRefreshRef.current = false;
        setIsBackgroundRefresh(false);

        if (initialLoad) {
          setInitialLoad(false);
          try { localStorage.setItem('dashboard_ever_loaded', 'true'); } catch { }
        }

        // ⚡ PERSIST CACHE: Save to sessionStorage for navigation survival
        pageCacheRef.current.set(cacheKey, {
          data: rows,
          total: response.data?.pagination?.total || 0,
          timestamp: Date.now(),
        });
        try {
          const cacheObj = Object.fromEntries(pageCacheRef.current);
          sessionStorage.setItem('dashboard_page_cache', JSON.stringify(cacheObj));
        } catch { /* ignore quota errors */ }

        retryCountRef.current = 0;

        // NOTE: Removed direct setRowData() - let React's controlled rowData prop handle updates
        // This prevents race conditions between React state and AG Grid internal state

        setTimeout(() => prefetchNextPage(), 500);
      }

    } catch (error: any) {
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED' || error?.name === 'AbortError') {
        setLoading(false);
        setIsBackgroundRefresh(false);
        return;
      }
      console.error("Load inventory error:", error);

      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        toast.error(`Loading failed, retrying... (${retryCountRef.current}/${MAX_RETRIES})`);
        setTimeout(() => {
          loadInventoryData(true);
        }, 1000 * retryCountRef.current);
        return;
      }

      toast.error("Failed to load inventory data");
      retryCountRef.current = 0;
    } finally {
      if (loadId === currentLoadIdRef.current) {
        setLoading(false);
        setIsBackgroundRefresh(false);
        inventoryAbortControllerRef.current = null;
      }
    }
  }, [activeWarehouse?.id, page, limit, searchDebounced, stageFilter, availableOnly, brandFilter, categoryFilter, dateFrom, dateTo, getCacheKey, prefetchNextPage, filteredData, initialLoad]);


  // ⚡ QUICK PAGE JUMP: Handle page input submit
  const handlePageJump = useCallback(() => {
    const targetPage = parseInt(pageInputValue, 10);
    const totalPages = Math.ceil(total / limit);

    if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
      setPage(targetPage);
      setShowPageInput(false);
      setPageInputValue('');
    } else {
      toast.error(`Please enter a valid page (1-${totalPages})`);
    }
  }, [pageInputValue, total, limit]);

  const loadFilterOptions = useCallback(async () => {
    // ⚡ SKIP if already loaded
    if (filtersLoaded) return;

    try {
      const [bResp, cResp] = await Promise.all([
        inboundAPI.getBrands(activeWarehouse?.id),
        inboundAPI.getCategories(activeWarehouse?.id),
      ]);
      // Extract data correctly
      const brandsData = Array.isArray(bResp?.data) ? bResp.data : bResp?.data?.data || [];
      const categoriesData = Array.isArray(cResp?.data) ? cResp.data : cResp?.data?.data || [];

      setBrands(brandsData);
      setCategories(categoriesData);
      setFiltersLoaded(true);
    } catch (err) {
      console.warn("Could not load full filter options:", err);
      // On error, just leave empty - no fallback to page data
      setBrands([]);
      setCategories([]);
    }
  }, [activeWarehouse?.id, filtersLoaded]);

  // ⚡ LAZY LOAD: If settings panel opens, load filter options
  useEffect(() => {
    if (settingsPanelOpen && !filtersLoaded && activeWarehouse?.id) {
      loadFilterOptions();
    }
  }, [settingsPanelOpen, filtersLoaded, activeWarehouse?.id, loadFilterOptions]);

  // 🔥 GET FILTERED CATEGORIES - only for selected brand
  // ⚡ OPTIMIZED: Use local inventory data instead of API call
  const getFilteredCategories = useCallback(async () => {
    if (!brandFilter) {
      // No brand selected, show all categories
      return categories;
    }

    // ⚡ FAST PATH: Get categories from already loaded inventory data
    // This avoids a heavy API call that was fetching 10000 records!
    if (inventoryData.length > 0) {
      const uniqueCategories = Array.from(
        new Set(
          inventoryData
            .filter((item: any) => item.brand === brandFilter)
            .map((item: any) => item.cms_vertical)
            .filter(Boolean)
        )
      ) as string[];

      // If we found categories, use them
      if (uniqueCategories.length > 0) {
        return uniqueCategories.sort();
      }
    }

    // Fallback to all categories if no match found
    return categories;
  }, [brandFilter, categories, inventoryData]);

  const loadMetrics = useCallback(async () => {
    try {
      const response = await dashboardAPI.getInventoryMetrics(
        activeWarehouse?.id
      );
      setMetrics(response.data || initialMetrics);
    } catch (error) {
      console.error("Load metrics error:", error);
    }
  }, [activeWarehouse?.id, initialMetrics]);

  const loadInventorySummary = useCallback(async () => {
    try {
      if (!activeWarehouse?.id) return;
      const response = await inventoryAPI.getSummary(activeWarehouse.id);
      setInventorySummary(response.data || {
        available_stock: 0,
        qc_pending: 0,
        ready_for_dispatch: 0,
        dispatched_items: 0,
      });
    } catch (error) {
      console.error("Load inventory summary error:", error);
    }
  }, [activeWarehouse?.id]);

  // Load lists of WSNs that are present in Picking and Outbound lists so we can render DONE correctly
  const loadExistingStageWSNs = useCallback(async () => {
    try {
      if (!activeWarehouse?.id) {
        setPickingWSNs(new Set());
        setOutboundWSNs(new Set());
        return;
      }

      const [pResp, oResp] = await Promise.all([
        pickingAPI.getExistingWSNs(activeWarehouse.id),
        outboundAPI.getExistingWSNs(activeWarehouse.id),
      ]);

      const pList = Array.isArray(pResp?.data) ? pResp.data : pResp?.data?.data || [];
      const oList = Array.isArray(oResp?.data) ? oResp.data : oResp?.data?.data || [];

      setPickingWSNs(new Set(pList.map((x: any) => (x?.wsn ?? x))));
      setOutboundWSNs(new Set(oList.map((x: any) => (x?.wsn ?? x))));
    } catch (err) {
      console.warn("Could not load existing stage WSNs:", err);
      setPickingWSNs(new Set());
      setOutboundWSNs(new Set());
    }
  }, [activeWarehouse?.id]);

  // Effect 1: Load inventory data on page/filter changes
  useEffect(() => {
    if (activeWarehouse) {
      if (inventoryLoadDebounceRef.current) clearTimeout(inventoryLoadDebounceRef.current);
      inventoryLoadDebounceRef.current = setTimeout(() => {
        try { sessionStorage.setItem('dashboard_mounted_this_session', 'true'); } catch { }

        const shouldForceRefresh = forceOverlayRef.current;

        if (filteredData.length > 0 && !shouldForceRefresh) {
          isBackgroundRefreshRef.current = true;
          setIsBackgroundRefresh(true);
        }

        loadInventoryData(shouldForceRefresh, shouldForceRefresh);
        inventoryLoadDebounceRef.current = null;
      }, 50);

      return () => {
        if (inventoryLoadDebounceRef.current) {
          clearTimeout(inventoryLoadDebounceRef.current);
          inventoryLoadDebounceRef.current = null;
        }
      };
    }
  }, [activeWarehouse, page, limit, searchDebounced, stageFilter, availableOnly, brandFilter, categoryFilter, dateFrom, dateTo, loadInventoryData]);

  // Effect 2: Load metrics/summary on warehouse change + 60s interval (NOT on page/filter changes)
  useEffect(() => {
    if (activeWarehouse) {
      loadMetrics();
      loadInventorySummary();
      loadExistingStageWSNs();

      const interval = setInterval(() => {
        loadMetrics();
        loadInventorySummary();
        loadExistingStageWSNs();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [activeWarehouse, loadMetrics, loadInventorySummary, loadExistingStageWSNs]);

  // NOTE: Removed redundant inventoryData → filteredData sync useEffect
  // loadInventoryData already sets both, and having this useEffect caused double render/fluctuation

  // Removed AG Grid overlay sync to avoid flash during loading

  // Cleanup timers/aborters on unmount
  useEffect(() => {
    return () => {
      if (inventoryLoadDebounceRef.current) {
        clearTimeout(inventoryLoadDebounceRef.current);
        inventoryLoadDebounceRef.current = null;
      }
      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current);
        overlayTimerRef.current = null;
      }
      if (inventoryAbortControllerRef.current) {
        try { inventoryAbortControllerRef.current.abort(); } catch { }
        inventoryAbortControllerRef.current = null;
      }
    };
  }, []);

  // Content-based auto-sizing: auto-size columns to their content, then fallback to sizeColumnsToFit if there's extra space
  // Only runs after initial render is complete (gridDataRendered = true)
  // IMPORTANT: Does NOT run if user already has saved column widths (preserves user customization)
  useEffect(() => {
    if (!gridDataRendered) return; // Don't run until overlay is hidden

    // If user has saved column state, respect it — don't auto-size
    const stateKey = getDashboardGridStateKey();
    if (localStorage.getItem(stateKey)) return;

    const autoSize = () => {
      try {
        const api = gridRef.current;
        if (!api) return;
        const allColIds = api.getColumns
          ? api.getColumns()?.map((c: any) => c.getColId()) || []
          : (columnApiRef.current?.getAllColumns?.() || []).map((c: any) => c.getColId());
        if (!allColIds || allColIds.length === 0) return;

        // Auto-size to content
        if (api.autoSizeColumns) {
          api.autoSizeColumns(allColIds, false);
        } else if (columnApiRef.current?.autoSizeColumns) {
          columnApiRef.current.autoSizeColumns(allColIds, false);
        }

        // If total column width is less than grid width, stretch to fit
        let total = 0;
        const getCol = api.getColumn?.bind(api) || columnApiRef.current?.getColumn?.bind(columnApiRef.current);
        if (getCol) {
          for (const id of allColIds) {
            const col = getCol(id);
            total += col?.getActualWidth ? col.getActualWidth() : 0;
          }
        }
        const gridEl = document.querySelector('.ag-theme-quartz');
        const gridW = gridEl?.clientWidth || 0;
        if (gridW && total < gridW) {
          api.sizeColumnsToFit();
        }
      } catch { /* ignore */ }
    };

    const t = setTimeout(autoSize, 50);
    return () => { clearTimeout(t); };
  }, [columnDefs, gridDataRendered]);


  const memoizedFilteredBrands = useMemo(() => {
    if (!categoryFilter || inventoryData.length === 0) {
      return brands;
    }

    const filteredByCategory = inventoryData.filter((item: any) => item.cms_vertical === categoryFilter);

    return Array.from(
      new Set(
        filteredByCategory
          .map((item: any) => item.brand)
          .filter(Boolean)
      )
    ).sort() as string[];
  }, [categoryFilter, inventoryData, brands]);


  // ✅ NEW:
  useEffect(() => {
    if (!brandFilter) {
      setFilteredCategories(categories);
      return;
    }

    getFilteredCategories()
      .then(setFilteredCategories)
      .catch(() => setFilteredCategories(categories));
  }, [brandFilter, categories, getFilteredCategories]);




  // When brand changes, update filtered categories
  useEffect(() => {
    if (brandFilter && inventoryData.length > 0) {
      // Get unique categories from current inventory data for selected brand
      const filtered = Array.from(
        new Set(
          inventoryData
            .map((item: any) => item.cms_vertical)
            .filter(Boolean)
        )
      ) as string[];
      setFilteredCategories(filtered.sort());
    } else {
      setFilteredCategories(categories);
    }
  }, [brandFilter, inventoryData, categories]);







  const getStageColor = (stage: string) => {
    if (stage?.includes("INBOUND")) return "primary";
    if (stage?.includes("QC_PENDING")) return "warning";
    if (stage?.includes("QC_PASSED")) return "success";
    if (stage?.includes("QC_FAILED")) return "error";
    if (stage?.includes("PICKING")) return "info";
    if (stage?.includes("OUTBOUND")) return "success";
    return "default";
  };

  const getStatusColor = (status: string) => {
    if (!status) return "#999";
    const s = String(status).toUpperCase();
    if (s === "PENDING") return "#ff9800";
    if (s === "COMPLETED" || s === "PASSED" || s === "DONE") return "#4caf50";
    if (s === "FAILED") return "#f44336";
    if (s === "OK") return "#4caf50";
    return "#2196f3";
  };

  // ⚡ OPTIMIZED: Format Excel sheet with XLSX parameter passed in
  const formatExcelSheet = (ws: any, data: any[], XLSX: any) => {
    const columnWidths = [
      15, 12, 12, 12, 30, 15, 15, 12, 12, 15, 15, 12, 15, 12, 12, 15, 15, 15,
      12, 15, 15, 12, 15, 15, 15, 15, 15, 15, 15, 15, 18, 15, 20,
    ];
    ws["!cols"] = columnWidths.map((w) => ({ wch: w }));

    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "F59E0B" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };

    const headers = Object.keys(data[0] || {});
    headers.forEach((header, idx) => {
      const cell = ws[XLSX.utils.encode_col(idx) + "1"];
      if (cell) cell.s = headerStyle;
    });

    const dataStyle = {
      border: {
        top: { style: "thin", color: { rgb: "E5E7EB" } },
        bottom: { style: "thin", color: { rgb: "E5E7EB" } },
        left: { style: "thin", color: { rgb: "E5E7EB" } },
        right: { style: "thin", color: { rgb: "E5E7EB" } },
      },
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
    };

    const rowCount = data.length + 1;
    for (let row = 2; row <= rowCount; row++) {
      headers.forEach((header, col) => {
        const cellRef = XLSX.utils.encode_col(col) + row;
        if (ws[cellRef]) {
          ws[cellRef].s = {
            ...dataStyle,
            fill:
              row % 2 === 0
                ? { fgColor: { rgb: "F9FAFB" } }
                : { fgColor: { rgb: "FFFFFF" } },
          };
        }
      });
    }
  };

  const handleExportWithFilters = async () => {
    setExportLoading(true);
    try {
      // ⚡ OPTIMIZED: Load XLSX dynamically only when exporting
      const XLSX = await import('xlsx');

      const params = new URLSearchParams();
      if (activeWarehouse?.id) params.append("warehouseId", String(activeWarehouse.id));

      if (exportFilters.dateFrom)
        params.append("dateFrom", exportFilters.dateFrom);
      if (exportFilters.dateTo) params.append("dateTo", exportFilters.dateTo);

      if (exportFilters.stage && exportFilters.stage !== 'all') {
        params.append('stage', exportFilters.stage);
      }

      if (exportFilters.brand) params.append("brand", exportFilters.brand);

      if (exportFilters.category)
        params.append("category", exportFilters.category);
      // Scope: All vs Available Only
      if (exportFilters.availableOnly === 'available') params.append("availableOnly", "true");

      const response = await dashboardAPI.getInventoryDataForExport(
        params.toString()
      );

      if (response.data?.data && response.data.data.length > 0) {
        const formattedData = response.data.data.map((row: any) => ({
          WSN: row.wsn,
          WID: row.wid || "",
          FSN: row.fsn || "",
          "Order ID": row.order_id || "",
          "Product Title": row.product_title,
          Brand: row.brand,
          Category: row.cms_vertical,
          FSP: row.fsp,
          MRP: row.mrp,
          "Inbound Date": row.inbound_date
            ? new Date(row.inbound_date).toLocaleDateString() : "-",
          "Vehicle No": row.vehicle_no,
          "Rack No": row.rack_no,
          "WH Location": row.wh_location,
          "FK QC Remark": row.fkqc_remark,
          "HSN/SAC": row.hsn_sac,
          "IGST Rate": row.igst_rate,
          "Invoice Date": row.invoice_date
            ? new Date(row.invoice_date).toLocaleDateString()
            : "-",
          "Product Type": row.p_type,
          "Product Size": row.p_size,
          VRP: row.vrp,
          "Yield Value": row.yield_value,
          "QC Date": row.qc_date,
          "QC By": row.qc_by,
          "QC Grade": row.qc_grade,
          "QC Remarks": row.qc_remarks,
          "Picking Date": row.picking_date,
          "Picked for Customer Name": row.customer_name,
          "Picking Remarks": row.picking_remarks,
          "Dispatch Date": row.dispatch_date,
          "Dispatch Vehicle": row.dispatch_vehicle,
          "Dispatch Remarks": row.dispatch_remarks,
          "Current Status": row.current_status,
          "Batch ID": row.batch_id,
          "Created At": new Date(row.created_at).toLocaleString(),
          "Created By": row.created_by,
        }));

        const ws = XLSX.utils.json_to_sheet(formattedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventory");

        formatExcelSheet(ws, formattedData, XLSX);

        const summaryData = [
          { Metric: "Total Records", Count: formattedData.length },
          {
            Metric: "Inbound",
            Count: formattedData.filter(
              (r: any) => r["Current Status"] === "INBOUND"
            ).length,
          },
          {
            Metric: "QC Done",
            Count: formattedData.filter(
              (r: any) => r["Current Status"] === "QC_DONE"
            ).length,
          },
          {
            Metric: "Picked",
            Count: formattedData.filter(
              (r: any) => r["Current Status"] === "PICKED"
            ).length,
          },
          {
            Metric: "Dispatched",
            Count: formattedData.filter(
              (r: any) => r["Current Status"] === "DISPATCHED"
            ).length,
          },
        ];

        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        wsSummary["!cols"] = [{ wch: 20 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

        const filename = `Inventory_${activeWarehouse?.name}_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);

        toast.success(`✓ Exported ${formattedData.length} records to Excel`);
        setExportDialogOpen(false);
      } else {
        toast.error("No data to export with selected filters");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setExportLoading(false);
    }
  };



  const toggleColumn = (column: string) => {
    if (visibleColumns.includes(column)) {
      if (visibleColumns.length === 1) {
        toast.error("At least one column must be visible");
        return;
      }
      setVisibleColumns(visibleColumns.filter((c) => c !== column));
    } else {
      const newColumns = ALL_COLUMNS.filter(
        (col) => visibleColumns.includes(col) || col === column
      );
      setVisibleColumns(newColumns);
    }
  };

  const resetFilters = () => {
    // ⚡ Set flag to show overlay spinner when data reloads
    forceOverlayRef.current = true;
    setLoading(true); // Show spinner immediately

    // Clear all filters
    setSearchWSN("");
    setStageFilter("all");
    setBrandFilter("");
    setCategoryFilter("");
    setDateFrom("");
    setDateTo("");
    setAvailableOnly(false);
    setPage(1);
    // useEffect will detect filter changes and call loadInventoryData
  };


  //////////////////////////////////====UI RENDERING====////////////////////////////////////
  return (
    <AppLayout>
      <Toaster position="top-right" />
      {/* WRAPPER - ENTIRE CONTENT AREA (FLEX COLUMN) */}
      <Box sx={{
        p: { xs: 0.75, md: 1 },
        background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        height: '100%',
        width: '100%',
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
      >
        {/* ================= HEADER ================= */}
        <StandardPageHeader
          title="Dashboard"
          subtitle="Welcome to WMS"
          icon="📊"
          warehouseName={activeWarehouse?.name}
          userName={user?.fullName}
        />

        {/* ================= SCROLLABLE CONTENT AREA ================= */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
            position: "relative",
          }}
        >

          {/* =================  METRICS GRID WITH ICONS ================= */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(3, 1fr)",
                sm: "repeat(6, 1fr)",
                md: "repeat(6, 1fr)",
              },
              gap: { xs: 0.75, sm: 1.5, md: 2 },
              py: { xs: 0.75, sm: 0.75, md: 0.75 },
              overflowX: "visible",
              bgcolor: isDarkMode ? '#0f172a' : 'transparent',
              flexShrink: 0,
            }}
          >

            {[
              { label: "Master Data", value: metrics.total, color: "#3b82f6", icon: <DashboardRounded /> },
              { label: "Available", value: inventorySummary.available_stock, color: "#10b981", icon: <InventoryRounded /> },
              { label: "Inbounded", value: metrics.inbound, color: "#8b5cf6", icon: <LoginRounded /> },
              { label: "Processed", value: (metrics.qcPassed || 0) + (metrics.qcDone || 0), color: "#06b6d4", icon: <CheckCircleRounded /> },
              { label: "Picked", value: metrics.pickingCompleted, color: "#f59e0b", icon: <LocalShippingRounded /> },
              { label: "Dispatched", value: metrics.outboundDispatched, color: "#ef4444", icon: <SendRounded /> },
            ].map((m, index) => (

              <Card
                key={index}
                elevation={0}
                sx={{
                  px: { xs: 0.75, sm: 1.25, md: 1.5 },
                  py: { xs: 0.5, sm: 0.75, md: 1 },
                  height: { xs: 52, sm: 58, md: 64 },
                  width: "100%",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: { xs: 0.5, sm: 0.75, md: 1 },
                  borderRadius: { xs: 1.5, sm: 2, md: 2.5 },
                  background: isDarkMode
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(255,255,255,0.8)",
                  backdropFilter: "blur(12px)",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid rgba(0,0,0,0.06)",
                  boxShadow: isDarkMode
                    ? "0 2px 8px rgba(0,0,0,0.2)"
                    : "0 1px 3px rgba(0,0,0,0.04)",
                  transition: "all 0.2s ease",
                  overflow: "hidden",
                  "&:hover": {
                    transform: { xs: "none", md: "translateY(-2px)" },
                    background: isDarkMode
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(255,255,255,0.95)",
                    boxShadow: {
                      xs: isDarkMode ? "0 2px 8px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.04)",
                      md: isDarkMode ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,0,0,0.08)"
                    },
                    border: isDarkMode
                      ? "1px solid rgba(255,255,255,0.12)"
                      : "1px solid rgba(0,0,0,0.08)",
                  },
                }}
              >
                {/* ICON CONTAINER */}
                <Box
                  sx={{
                    width: { xs: 28, sm: 32, md: 36 },
                    height: { xs: 28, sm: 32, md: 36 },
                    borderRadius: { xs: 1, sm: 1.25, md: 1.5 },
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `${m.color}15`,
                    flexShrink: 0,
                    "& svg": {
                      fontSize: { xs: "0.875rem", sm: "1rem", md: "1.125rem" },
                      color: m.color,
                    },
                  }}
                >
                  {m.icon}
                </Box>

                {/* TEXT CONTENT */}
                <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: { xs: "0.875rem", sm: "1rem", md: "1.125rem" },
                      lineHeight: 1.2,
                      color: isDarkMode ? "#f1f5f9" : "#1e293b",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {m.value.toLocaleString()}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: { xs: "0.45rem", sm: "0.65rem", md: "0.7rem" },
                      fontWeight: 500,
                      color: isDarkMode ? "#64748b" : "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.02em",
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {m.label}
                  </Typography>
                </Box>
              </Card>
            ))}
          </Box>

          {/* ================= STICKY WRAPPER: FILTER BAR + TABLE ================= */}
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 90px)',
              flexShrink: 0,
              background: isDarkMode ? '#0f172a' : '#f8fafc',
            }}
          >

            {/* ================= FILTER BAR ================= */}
            <Box
              sx={{
                mb: 0.5,
                background: isDarkMode ? '#0f172a' : '#f8fafc',
                py: { xs: 0.5, sm: 0.75, md: 0.95 },
                display: "flex",
                flexDirection: "column",
                gap: { xs: 0.1, md: 1.0 },
                flexShrink: 0,
                borderBottom: 'transparent',
                boxShadow: { md: isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)' },

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
              {/* TOP ROW: Search + Pivot + Menu/Reset */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  gap: { xs: 0.75, md: 1 },
                  alignItems: "stretch",
                }}
              >
                {/* Search Field */}
                <TextField
                  size="small"
                  placeholder="🔍 Search WSN or Product"
                  value={searchWSN}
                  onChange={(e) => {
                    setSearchWSN(e.target.value);
                    setPage(1);
                  }}
                  fullWidth
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end" sx={{ display: { xs: 'flex', md: 'none' } }}>
                          <IconButton
                            size="small"
                            onClick={() => { setLookupResult(null); setLookupError(''); setLookupCameraOpen(true); }}
                            sx={{ color: '#3b82f6', p: 0.5 }}
                          >
                            <CameraIcon sx={{ fontSize: 20 }} />
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      height: { xs: 40, sm: 42 },
                      bgcolor: isDarkMode ? '#1e293b' : '#f8fafc',
                      borderRadius: 2.5,
                      transition: "all 0.2s ease",
                      "&:hover": {
                        bgcolor: isDarkMode ? '#334155' : '#f1f5f9',
                      },
                      "&.Mui-focused": {
                        bgcolor: isDarkMode ? '#1e293b' : 'white',
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "primary.main",
                          borderWidth: 2,
                        },
                      },
                    },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
                    },
                  }}
                />

                {/* Pivot Table Button */}
                <Tooltip title="Open Pivot Analysis - Excel-style pivot table">
                  <Button
                    variant={pivotOpen ? "contained" : "outlined"}
                    size="small"
                    onClick={() => setPivotOpen(!pivotOpen)}
                    sx={{
                      height: { xs: 40, md: 42 },
                      minWidth: { xs: 'auto', md: 100 },
                      px: { xs: 1.5, md: 2 },
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      borderRadius: 2,
                      flexShrink: 0,
                      ...(pivotOpen ? {
                        background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                      } : {
                        borderColor: '#7c3aed',
                        color: '#7c3aed',
                        borderWidth: 1.5,
                        "&:hover": {
                          borderWidth: 1.5,
                          borderColor: '#6d28d9',
                          bgcolor: 'rgba(124, 58, 237, 0.08)',
                        },
                      }),
                    }}
                  >
                    <PivotIcon sx={{ fontSize: '1.1rem', mr: { xs: 0, md: 0.5 } }} />
                    <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>Pivot</Box>
                  </Button>
                </Tooltip>

                {/* Options Button - Always visible with green dot indicator when filters active */}
                <Tooltip title="Open Options Panel">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setSettingsPanelOpen(true);
                      // ⚡ LAZY LOAD: Load filter options when settings panel opens
                      if (!filtersLoaded) {
                        loadFilterOptions();
                      }
                    }}
                    sx={{
                      height: { xs: 40, md: 42 },
                      minWidth: { xs: 'auto', md: 100 },
                      px: { xs: 1.5, md: 2 },
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      borderRadius: 2,
                      flexShrink: 0,
                      borderColor: isDarkMode ? '#3b82f6' : '#1e40af',
                      color: isDarkMode ? '#60a5fa' : '#1e40af',
                      bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(30, 64, 175, 0.04)',
                      borderWidth: 1.5,
                      position: 'relative',
                      "&:hover": {
                        borderWidth: 1.5,
                        borderColor: '#3b82f6',
                        bgcolor: 'rgba(59, 130, 246, 0.12)',
                      },
                    }}
                  >
                    <MenuIcon sx={{ fontSize: '1.1rem', mr: { xs: 0, md: 0.5 } }} />
                    <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>Options</Box>
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
              </Box>
            </Box>


            {/* ================= TABLE AREA ================= */}
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                bgcolor: isDarkMode ? '#0f172a' : 'transparent',
              }}
            >
              <Paper
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                }}
              >
                {/* Table Container - AG Grid */}
                <Box sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  position: 'relative',
                  bgcolor: isDarkMode ? '#1e293b' : 'transparent',
                }}>
                  {/* ⚡ SUBTLE PROGRESS BAR - Shows during background refresh without blocking UI */}
                  {isBackgroundRefresh && (
                    <LinearProgress
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 15,
                        height: 3,
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: '#1e40af'
                        },
                        backgroundColor: isDarkMode ? 'rgba(30, 64, 175, 0.2)' : 'rgba(30, 64, 175, 0.1)'
                      }}
                    />
                  )}

                  {/* NOTE: Skeleton loading overlay removed - now handled inside AG Grid Box below */}

                  {/* Empty State Overlay - shows when no data but headers remain visible */}
                  {!activeWarehouse && (!filteredData || filteredData.length === 0) && !loading && (
                    <Box sx={{
                      position: 'absolute',
                      top: 60,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.97)' : 'rgba(255, 255, 255, 0.97)',
                      backdropFilter: 'blur(4px)',
                      zIndex: 5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Box
                        sx={{
                          p: { xs: 3, md: 5 },
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'column',
                        }}
                      >
                        <Box
                          sx={{
                            p: { xs: 3, md: 5 },
                            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                            borderRadius: 4,
                            color: 'white',
                            boxShadow: '0 20px 60px rgba(30, 64, 175, 0.35)',
                          }}
                        >
                          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                            No active warehouse selected
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.9, fontSize: { xs: '0.8rem', md: '0.875rem' } }}>
                            Please go to Settings &gt; Warehouses to set one
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}

                  {activeWarehouse && (!filteredData || filteredData.length === 0) && !loading && !isBackgroundRefresh && isMounted && (
                    <Box sx={{
                      position: 'absolute',
                      top: 35, // Start below AG Grid header (35px height)
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.97)' : 'rgba(255, 255, 255, 0.97)',
                      backdropFilter: 'blur(4px)',
                      zIndex: 5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Box sx={{
                        textAlign: 'center',
                        p: { xs: 3, md: 4 },
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 1.5
                      }}>
                        <Box sx={{
                          fontSize: { xs: '3rem', md: '4rem' },
                          opacity: 0.25,
                          mb: 0.5
                        }}>
                          📭
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#475569', mb: 0.5, fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                          No Data Found
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#94a3b8', maxWidth: 400, fontSize: { xs: '0.8rem', md: '0.875rem' } }}>
                          No items match your current filters. Try adjusting your search criteria or reset filters to see all items.
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* AG Grid - Always rendered, covered by skeleton overlay when loading */}
                  <Box sx={{
                    flex: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d1d5db',
                    borderBottom: 'none',
                    borderRadius: '12px 12px 0 0',
                    boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
                    bgcolor: isDarkMode ? '#1e293b' : 'transparent',
                    '& .ag-root-wrapper': {
                      height: '100%',
                      overflow: 'hidden',
                      border: 'none',
                      backgroundColor: isDarkMode ? '#1e293b' : 'transparent',
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
                    // ⚡ FLASH FIX: Hide body viewport until rows are rendered
                    // This prevents the empty white flash during hydration
                    '& .ag-body-viewport': {
                      opacity: (loading && gridRowData.length === 0) ? 0.3 : 1,
                      // Match background to prevent white flash
                      backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                    },
                    // ⚡ FLASH FIX: Ensure center viewport also has correct background
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
                      height: { xs: 44, md: 44 },
                      overflow: 'visible',
                      borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e5e7eb',
                    },
                    '& .ag-row-even': {
                      backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                    },
                    '& .ag-row-odd': {
                      backgroundColor: isDarkMode ? '#1a2536' : '#f8fafc',
                    },
                    '& .ag-cell': {
                      display: 'flex',
                      alignItems: 'center',
                      lineHeight: { xs: '44px', md: '44px' },
                      fontSize: '0.875rem',
                      padding: '0 12px',
                      color: isDarkMode ? '#f1f5f9' : '#1e293b',
                      borderRight: isDarkMode ? '1px solid #334155' : '1px solid #e5e7eb',
                    },
                    '& .ag-cell:last-child': {
                      borderRight: 'none',
                    },
                    '& .ag-cell-focus': {
                      border: isDarkMode ? '2px solid #38bdf8 !important' : '2px solid #2563eb !important',
                      boxSizing: 'border-box',
                      outline: 'none'
                    },
                    '& .ag-cell-range-selected': {
                      backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.25) !important' : '#dbeafe !important',
                    },
                    '& .ag-row-hover': {
                      backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15) !important' : '#eff6ff !important',
                    },
                  }}>
                    <div className="ag-theme-quartz" style={{ height: '100%', width: '100%', position: 'relative', zIndex: 1 }}>
                      <AgGridReact
                        ref={gridRef}
                        rowData={gridRowData}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
                        loading={false}
                        suppressNoRowsOverlay={true}
                        enableCellTextSelection={true}
                        ensureDomOrder={true}
                        getRowId={(params: any) => String(params.data?.wsn || params.data?.wid || params.rowIndex)}
                        onGridReady={(params: any) => {
                          gridRef.current = params.api;
                          columnApiRef.current = params.columnApi;
                          // Restore saved column state from user-specific localStorage key
                          try {
                            const stateKey = getDashboardGridStateKey();
                            let saved = localStorage.getItem(stateKey);
                            // Migrate from old non-user-specific key if exists
                            if (!saved) {
                              const legacy = localStorage.getItem('dashboard_grid_state');
                              if (legacy) {
                                saved = legacy;
                                localStorage.setItem(stateKey, legacy);
                                localStorage.removeItem('dashboard_grid_state');
                              }
                            }
                            if (saved) {
                              const state = JSON.parse(saved);
                              params.api.applyColumnState({ state, applyOrder: true });
                              hasAutoFittedRef.current = true;
                            }
                          } catch { /* ignore */ }
                        }}
                        onFirstDataRendered={(params: any) => {
                          // Auto-size columns on first load if no saved state
                          if (!hasAutoFittedRef.current && params.api) {
                            try {
                              const allColIds = params.api.getColumns()
                                ?.filter((col: any) => col.getColId() !== '__action')
                                .map((col: any) => col.getColId()) || [];
                              if (allColIds.length > 0) {
                                params.api.autoSizeColumns(allColIds);
                              }
                              hasAutoFittedRef.current = true;
                            } catch { /* ignore */ }
                          }
                          // ⚡ Hide overlay immediately after columns sized
                          requestAnimationFrame(() => {
                            setGridDataRendered(true);
                          });
                        }}
                        onColumnResized={(params: any) => {
                          // Save state when user finishes resizing
                          if (params.finished && params.api) {
                            try {
                              const state = params.api.getColumnState();
                              const stateKey = getDashboardGridStateKey();
                              localStorage.setItem(stateKey, JSON.stringify(state));
                            } catch { /* ignore */ }
                          }
                        }}
                        onColumnMoved={(params: any) => {
                          // Save state when user finishes moving columns
                          if (params.finished && params.api) {
                            try {
                              const state = params.api.getColumnState();
                              const stateKey = getDashboardGridStateKey();
                              localStorage.setItem(stateKey, JSON.stringify(state));
                            } catch { /* ignore */ }
                          }
                        }}
                        onColumnVisible={(params: any) => {
                          // Save state when column visibility changes
                          if (params.api) {
                            try {
                              const state = params.api.getColumnState();
                              const stateKey = getDashboardGridStateKey();
                              localStorage.setItem(stateKey, JSON.stringify(state));
                            } catch { /* ignore */ }
                          }
                        }}
                        animateRows={false}
                        // ⚡ PERFORMANCE: Optimizations for smooth fast scrolling
                        rowBuffer={100}
                        suppressRowTransform={true}
                        suppressAnimationFrame={true}
                        debounceVerticalScrollbar={true}
                        suppressScrollOnNewData={true}
                        alwaysShowVerticalScroll={true}
                        rowHeight={tableRowHeight}
                        headerHeight={35}

                      />
                    </div>

                    {/* Initial Loading Overlay - positioned below header */}
                    {((loading && gridRowData.length === 0 && activeWarehouse) || (gridRowData.length > 0 && !gridDataRendered)) && (
                      <Box sx={{
                        position: 'absolute',
                        top: 35,
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
                            Loading inventory...
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {/* Loading Spinner Overlay - shows when fetching data with existing data visible */}
                    {(loading || isFetching) && gridRowData.length > 0 && gridDataRendered && (
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
                  </Box>
                </Box>
                {/* ================= PAGINATION (ENHANCED WITH ALL IMPROVEMENTS) ================= */}
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

                      {/* ⚡ Last Refresh Time Indicator */}
                      {lastRefreshTime && !isMobile && (
                        <Tooltip title={`Last updated: ${lastRefreshTime.toLocaleTimeString()}`}>
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 1 }}>
                            <AccessTime sx={{ fontSize: 14, color: isDarkMode ? '#64748b' : '#94a3b8' }} />
                            <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                              <TimeAgo date={lastRefreshTime} />
                            </Typography>
                          </Stack>
                        </Tooltip>
                      )}
                    </Stack>

                    {/* Center Section: Count + Quick Page Jump */}
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        sx={{
                          fontSize: { xs: "0.7rem", sm: "0.78rem" },
                          whiteSpace: "nowrap",
                          color: isDarkMode ? '#94a3b8' : 'inherit',
                        }}
                      >
                        {(page - 1) * limit + 1} – {Math.min(page * limit, total)} of {total}
                      </Typography>

                      {/* ⚡ Quick Page Jump Input */}
                      {showPageInput && !isMobile && (
                        <Fade in={showPageInput}>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <InputBase
                              autoFocus
                              placeholder="Page #"
                              value={pageInputValue}
                              onChange={(e) => setPageInputValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handlePageJump();
                                if (e.key === 'Escape') {
                                  setShowPageInput(false);
                                  setPageInputValue('');
                                }
                              }}
                              sx={{
                                width: 60,
                                px: 1,
                                py: 0.25,
                                fontSize: '0.75rem',
                                border: isDarkMode ? '1px solid #475569' : '1px solid #cbd5e1',
                                borderRadius: 1,
                                bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                                color: isDarkMode ? '#f1f5f9' : 'inherit',
                              }}
                            />
                            <Button size="small" onClick={handlePageJump} sx={{ minWidth: 40, fontSize: '0.7rem' }}>
                              Go
                            </Button>
                          </Stack>
                        </Fade>
                      )}

                      {/* ⚡ Show page jump button on desktop */}
                      {!showPageInput && !isMobile && Math.ceil(total / limit) > 5 && (
                        <Tooltip title="Press 'G' to jump to page">
                          <Button
                            size="small"
                            onClick={() => setShowPageInput(true)}
                            sx={{
                              minWidth: 'auto',
                              px: 1,
                              py: 0.25,
                              fontSize: '0.65rem',
                              color: isDarkMode ? '#64748b' : '#94a3b8',
                            }}
                          >
                            Go to...
                          </Button>
                        </Tooltip>
                      )}
                    </Stack>

                    {/* Right Section: Pagination Controls */}
                    {(isMobile ? (
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
                          {page} / {Math.ceil(total / limit)}
                        </Typography>

                        <IconButton
                          size="small"
                          disabled={page === Math.ceil(total / limit)}
                          onClick={() => setPage(page + 1)}
                          sx={{ p: 0.5 }}
                        >
                          <KeyboardArrowRight fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={page === Math.ceil(total / limit)}
                          onClick={() => setPage(Math.ceil(total / limit))}
                          sx={{ p: 0.5 }}
                        >
                          <LastPage fontSize="small" />
                        </IconButton>
                      </Stack>
                    ) : (
                      // DESKTOP: Enhanced pagination
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
                          count={Math.ceil(total / limit)}
                          size="small"
                          onChange={(_, v) => setPage(v)}
                          siblingCount={1}
                          boundaryCount={1}
                        />

                        <Tooltip title="Next page">
                          <span>
                            <IconButton
                              size="small"
                              disabled={page === Math.ceil(total / limit)}
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
                              disabled={page === Math.ceil(total / limit)}
                              onClick={() => setPage(Math.ceil(total / limit))}
                            >
                              <LastPage fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    ))}
                  </Box>
                </Fade>
              </Paper>
            </Box>
          </Box>{/* END STICKY WRAPPER */}
        </Box>{/* END SCROLLABLE CONTENT AREA */}
      </Box>{/* END MAIN WRAPPER */}

      {/* ================= SETTINGS PANEL DRAWER ================= */}
      <Drawer
        anchor="right"
        open={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '50%', sm: 380 },
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
          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>🔍 Filters</Typography>
          <IconButton size="small" onClick={() => setSettingsPanelOpen(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Panel Content with Accordions */}
        <Box sx={{ overflow: 'auto', flex: 1 }}>

          {/* ═══════════ FILTERS ACCORDION ═══════════ */}
          <Accordion
            expanded={settingsPanelExpanded === 'filters'}
            onChange={(_, isExpanded) => setSettingsPanelExpanded(isExpanded ? 'filters' : false)}
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
                <FilterIcon sx={{ color: '#3b82f6', fontSize: 22 }} />
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
                    value={dateFrom || ''}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
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
                    value={dateTo || ''}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        height: 40,
                        bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                      }
                    }}
                  />
                </Box>

                {/* Stage Filter */}
                <TextField
                  select
                  size="small"
                  label="Stage"
                  value={stageFilter}
                  onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      height: 40,
                      bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                    }
                  }}
                >
                  {PIPELINE_STAGES.map((s) => (
                    <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                  ))}
                </TextField>

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
                  {(categoryFilter ? memoizedFilteredBrands : brands).map((b) => (
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
                  {(brandFilter ? filteredCategories : categories).map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </TextField>

                {/* Available Only Checkbox */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={availableOnly}
                      onChange={(e) => {
                        setAvailableOnly(e.target.checked);
                        if (e.target.checked) {
                          toast.success("Showing available inventory only");
                        } else {
                          toast.success("Showing all items");
                        }
                        setPage(1);
                      }}
                      sx={{ '&.Mui-checked': { color: '#3b82f6' } }}
                    />
                  }
                  label={
                    <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                      Available Only
                    </Typography>
                  }
                />
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* ═══════════ COLUMNS ACCORDION ═══════════ */}
          {canSeeButton('columns') && (
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
                  <ViewColumnIcon sx={{ color: '#10b981', fontSize: 22 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>Columns</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                      {visibleColumns.length} of {ALL_COLUMNS.length} visible
                    </Typography>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                {!canAccessButton('columns') ? (
                  <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>
                    You don't have permission to manage columns
                  </Alert>
                ) : (
                  <Box sx={{ maxHeight: 280, overflow: 'auto', pr: 1 }}>
                    <Stack spacing={0.5}>
                      {ALL_COLUMNS.map((col) => (
                        <FormControlLabel
                          key={col}
                          control={
                            <Checkbox
                              size="small"
                              checked={visibleColumns.includes(col)}
                              onChange={() => toggleColumn(col)}
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
              {canSeeButton('export') && (
                <Tooltip title={!canAccessButton('export') ? "You don't have permission to use this feature" : ""} arrow>
                  <span style={{ width: '100%' }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<DownloadIcon />}
                      disabled={!canAccessButton('export')}
                      onClick={() => {
                        if (!canAccessButton('export')) return;
                        setExportFilters({
                          dateFrom,
                          dateTo,
                          stage: stageFilter || 'all',
                          brand: brandFilter,
                          category: categoryFilter,
                          availableOnly: availableOnly ? 'available' : 'all',
                        });
                        setExportDialogOpen(true);
                        setSettingsPanelOpen(false);
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
                startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                disabled={loading}
                onClick={async () => {
                  setSettingsPanelOpen(false);
                  await loadInventoryData(true, false);
                  loadMetrics();
                  loadInventorySummary();
                  toast.success('Data refreshed');
                }}
                sx={{
                  height: 44,
                  fontWeight: 600,
                  borderColor: '#3b82f6',
                  color: '#3b82f6',
                  '&:hover': { borderColor: '#2563eb', bgcolor: 'rgba(59, 130, 246, 0.08)' }
                }}
              >
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </Button>

              {filtersActive && (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<RestartAltIcon />}
                  onClick={() => {
                    resetFilters();
                    setSettingsPanelOpen(false);
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

      {/* EXPORT DIALOG */}
      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{ fontWeight: 700, bgcolor: "#10b981", color: "white" }}
        >
          📊 Export Inventory Data
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                📅 Date Range
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="From Date"
                  type="date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={exportFilters.dateFrom}
                  onChange={(e) =>
                    setExportFilters({
                      ...exportFilters,
                      dateFrom: e.target.value,
                    })
                  }
                  fullWidth
                />
                <TextField
                  label="To Date"
                  type="date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={exportFilters.dateTo}
                  onChange={(e) =>
                    setExportFilters({
                      ...exportFilters,
                      dateTo: e.target.value,
                    })
                  }
                  fullWidth
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                📦 Current Stage
              </Typography>
              <Select
                value={exportFilters.stage}
                onChange={(e) =>
                  setExportFilters({ ...exportFilters, stage: e.target.value })
                }
                size="small"
                fullWidth
              >
                {PIPELINE_STAGES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </Select>
            </Box>



            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                🏷️ Brand
              </Typography>
              <Autocomplete
                options={brands}
                value={exportFilters.brand || null}
                onChange={(_, val) =>
                  setExportFilters({ ...exportFilters, brand: val || "" })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Select brand"
                    size="small"
                  />
                )}
                fullWidth
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                🏪 Category
              </Typography>
              <Autocomplete
                options={categories}
                value={exportFilters.category || null}
                onChange={(_, val) =>
                  setExportFilters({ ...exportFilters, category: val || "" })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Select category"
                    size="small"
                  />
                )}
                fullWidth
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                � Scope
              </Typography>
              <Select
                value={exportFilters.availableOnly}
                onChange={(e) =>
                  setExportFilters({ ...exportFilters, availableOnly: e.target.value })
                }
                size="small"
                fullWidth
              >
                <MenuItem value="all">All Items</MenuItem>
                <MenuItem value="available">Available Only</MenuItem>
              </Select>
            </Box>



            <Alert severity="info" icon={<InfoIcon />}>
              <Typography variant="body2">
                <strong>Export includes:</strong> All product details from
                Inbound, QC, Picking, and Outbound with professional Excel
                formatting
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={
              exportLoading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <DownloadIcon />
              )
            }
            onClick={handleExportWithFilters}
            disabled={exportLoading}
            sx={{
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            }}
          >
            {exportLoading ? "Exporting..." : "Export to Excel"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DETAILS DIALOG */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Item - {selectedItem?.wsn}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Product
              </Typography>
              <Typography variant="body2">
                {selectedItem?.product_title}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Brand / Category
              </Typography>
              <Typography variant="body2">
                {selectedItem?.brand} / {selectedItem?.cms_vertical}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Price
              </Typography>
              <Typography variant="body2">
                FSP: ₹{selectedItem?.fsp} | MRP: ₹{selectedItem?.mrp}
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Pipeline
              </Typography>
              <Typography variant="body2">
                Inbound: {selectedItem?.inbound_status} | QC:{" "}
                {selectedItem?.qc_status} | Picking:{" "}
                {selectedItem?.picking_status}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* COLUMNS DIALOG */}
      <Dialog
        open={columnDialogOpen && true}
        onClose={() => setColumnDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Select Visible Columns</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 2 }}>
            {ALL_COLUMNS.map((col) => (
              <FormControlLabel
                key={col}
                control={
                  <Checkbox
                    checked={visibleColumns.includes(col)}
                    onChange={() => toggleColumn(col)}
                  />
                }
                label={col.replace(/_/g, " ")}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setColumnDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* GRID SETTINGS DIALOG */}
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
              '&:hover': { background: 'linear-gradient(135deg, #d97706 0%, #b45309 100)' }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ================= WSN PRODUCT LOOKUP DIALOG ================= */}
      <Dialog
        open={lookupCameraOpen || !!lookupResult || !!lookupError}
        onClose={() => { setLookupCameraOpen(false); setLookupResult(null); setLookupError(''); setLookupWSN(''); }}
        fullWidth maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: { xs: 0, sm: 3 },
            maxHeight: { xs: '100dvh', sm: '90vh' },
            m: { xs: 0, sm: 2 },
            width: { xs: '100%', sm: undefined },
            height: { xs: '100dvh', sm: 'auto' },
            bgcolor: isDarkMode ? '#0f172a' : '#ffffff',
            overflow: 'hidden',
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1.5,
          background: isDarkMode
            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{
              width: 32, height: 32, borderRadius: 1.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: isDarkMode ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.2)',
            }}>
              <SearchIcon sx={{ fontSize: 18, color: isDarkMode ? '#60a5fa' : '#fff' }} />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#fff', letterSpacing: '-0.01em' }}>
              Product Lookup
            </Typography>
          </Stack>
          <IconButton
            size="small"
            onClick={() => { setLookupCameraOpen(false); setLookupResult(null); setLookupError(''); setLookupWSN(''); }}
            sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {/* Camera Scanner */}
          {lookupCameraOpen && (
            <Box sx={{ px: 1.5, pt: 1.5 }}>
              <CameraScanner
                isOpen={lookupCameraOpen}
                onScan={(wsn) => { setLookupCameraOpen(false); setLookupWSN(wsn); handleWSNLookup(wsn); }}
                onClose={() => setLookupCameraOpen(false)}
                title="Scan WSN Barcode"
              />
            </Box>
          )}

          {/* Search Input */}
          <Box sx={{ px: 2, py: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small" fullWidth
                placeholder="Enter WSN..."
                value={lookupWSN}
                onChange={e => setLookupWSN(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') handleWSNLookup(lookupWSN); }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    height: 44, borderRadius: 2.5,
                    bgcolor: isDarkMode ? '#1e293b' : '#f8fafc',
                    fontSize: '0.9rem', fontWeight: 600, fontFamily: 'monospace',
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6', borderWidth: 2 },
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                  },
                }}
              />
              <Button
                variant="contained" size="small"
                onClick={() => handleWSNLookup(lookupWSN)}
                disabled={!lookupWSN.trim() || lookupLoading}
                sx={{
                  height: 44, minWidth: 44, borderRadius: 2.5, px: 2.5,
                  textTransform: 'none', fontWeight: 700, fontSize: '0.85rem',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
                  '&:hover': { boxShadow: '0 4px 12px rgba(59,130,246,0.4)' },
                }}
              >
                {lookupLoading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
              </Button>
            </Stack>
          </Box>

          {/* Error */}
          {lookupError && (
            <Box sx={{ px: 2, pb: 1.5 }}>
              <Alert severity="warning" onClose={() => setLookupError('')}
                sx={{ borderRadius: 2, fontSize: '0.85rem', '& .MuiAlert-icon': { fontSize: 20 } }}>
                {lookupError}
              </Alert>
            </Box>
          )}

          {/* Product Details */}
          {lookupResult && (
            <Box sx={{ px: 2, pb: 2 }}>
              {/* WSN Badge + Product Title */}
              <Box sx={{
                mb: 1.5, p: 2, borderRadius: 3,
                background: isDarkMode
                  ? 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(99,102,241,0.06) 100%)'
                  : 'linear-gradient(135deg, #eff6ff 0%, #f0f0ff 100%)',
                border: isDarkMode ? '1px solid rgba(59,130,246,0.12)' : '1px solid #dbeafe',
              }}>
                <Chip
                  label={lookupResult.wsn || lookupWSN}
                  size="small"
                  sx={{
                    fontWeight: 800, fontSize: '0.78rem', height: 26, mb: 1,
                    bgcolor: isDarkMode ? '#1e3a5f' : '#3b82f6',
                    color: isDarkMode ? '#93c5fd' : '#fff',
                    fontFamily: 'monospace', letterSpacing: '0.5px',
                  }}
                />
                {lookupResult.product_title && (
                  <Typography sx={{
                    fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.45,
                    color: isDarkMode ? '#e2e8f0' : '#1e293b',
                  }}>
                    {lookupResult.product_title}
                  </Typography>
                )}
              </Box>

              {/* Info Grid */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1,
                mb: 1.5,
              }}>
                {/* Brand */}
                {lookupResult.brand && (
                  <Box sx={{
                    p: 1.25, borderRadius: 2,
                    bgcolor: isDarkMode ? 'rgba(59,130,246,0.06)' : '#f0f7ff',
                    border: isDarkMode ? '1px solid rgba(59,130,246,0.1)' : '1px solid #dbeafe',
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: isDarkMode ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.25 }}>
                      Brand
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: isDarkMode ? '#93c5fd' : '#1e40af' }}>
                      {lookupResult.brand}
                    </Typography>
                  </Box>
                )}

                {/* Category */}
                {lookupResult.cms_vertical && (
                  <Box sx={{
                    p: 1.25, borderRadius: 2,
                    bgcolor: isDarkMode ? 'rgba(139,92,246,0.06)' : '#faf5ff',
                    border: isDarkMode ? '1px solid rgba(139,92,246,0.1)' : '1px solid #e9d5ff',
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: isDarkMode ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.25 }}>
                      Category
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: isDarkMode ? '#c084fc' : '#7c3aed' }}>
                      {lookupResult.cms_vertical}
                    </Typography>
                  </Box>
                )}

                {/* MRP */}
                {lookupResult.mrp && (
                  <Box sx={{
                    p: 1.25, borderRadius: 2,
                    bgcolor: isDarkMode ? 'rgba(34,197,94,0.06)' : '#f0fdf4',
                    border: isDarkMode ? '1px solid rgba(34,197,94,0.1)' : '1px solid #bbf7d0',
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: isDarkMode ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.25 }}>
                      MRP
                    </Typography>
                    <Typography sx={{ fontSize: '0.88rem', fontWeight: 800, color: isDarkMode ? '#86efac' : '#16a34a' }}>
                      {'\u20B9'}{lookupResult.mrp}
                    </Typography>
                  </Box>
                )}

                {/* FSP */}
                {lookupResult.fsp && (
                  <Box sx={{
                    p: 1.25, borderRadius: 2,
                    bgcolor: isDarkMode ? 'rgba(245,158,11,0.06)' : '#fffbeb',
                    border: isDarkMode ? '1px solid rgba(245,158,11,0.1)' : '1px solid #fde68a',
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: isDarkMode ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.25 }}>
                      FSP
                    </Typography>
                    <Typography sx={{ fontSize: '0.88rem', fontWeight: 800, color: isDarkMode ? '#fbbf24' : '#d97706' }}>
                      {'\u20B9'}{lookupResult.fsp}
                    </Typography>
                  </Box>
                )}

                {/* Order ID */}
                {lookupResult.order_id && (
                  <Box sx={{
                    p: 1.25, borderRadius: 2,
                    bgcolor: isDarkMode ? 'rgba(236,72,153,0.06)' : '#fdf2f8',
                    border: isDarkMode ? '1px solid rgba(236,72,153,0.1)' : '1px solid #fbcfe8',
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: isDarkMode ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.25 }}>
                      Order ID
                    </Typography>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: isDarkMode ? '#f9a8d4' : '#db2777', fontFamily: 'monospace' }}>
                      {lookupResult.order_id}
                    </Typography>
                  </Box>
                )}

                {/* WID */}
                {lookupResult.wid && (
                  <Box sx={{
                    p: 1.25, borderRadius: 2,
                    bgcolor: isDarkMode ? 'rgba(20,184,166,0.06)' : '#f0fdfa',
                    border: isDarkMode ? '1px solid rgba(20,184,166,0.1)' : '1px solid #99f6e4',
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: isDarkMode ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.25 }}>
                      WID
                    </Typography>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: isDarkMode ? '#5eead4' : '#0d9488', fontFamily: 'monospace' }}>
                      {lookupResult.wid}
                    </Typography>
                  </Box>
                )}

                {/* FSN */}
                {lookupResult.fsn && (
                  <Box sx={{
                    p: 1.25, borderRadius: 2,
                    bgcolor: isDarkMode ? 'rgba(100,116,139,0.08)' : '#f8fafc',
                    border: isDarkMode ? '1px solid rgba(100,116,139,0.12)' : '1px solid #e2e8f0',
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: isDarkMode ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.25 }}>
                      FSN
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: isDarkMode ? '#cbd5e1' : '#475569', fontFamily: 'monospace' }}>
                      {lookupResult.fsn}
                    </Typography>
                  </Box>
                )}

                {/* P Type */}
                {lookupResult.p_type && (
                  <Box sx={{
                    p: 1.25, borderRadius: 2,
                    bgcolor: isDarkMode ? 'rgba(249,115,22,0.06)' : '#fff7ed',
                    border: isDarkMode ? '1px solid rgba(249,115,22,0.1)' : '1px solid #fed7aa',
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: isDarkMode ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.25 }}>
                      P Type
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: isDarkMode ? '#fb923c' : '#ea580c' }}>
                      {lookupResult.p_type}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* FKQC Remarks - Full Width */}
              {lookupResult.fkqc_remark && (
                <Box sx={{
                  p: 1.25, borderRadius: 2, mb: 1.5,
                  bgcolor: isDarkMode ? 'rgba(239,68,68,0.06)' : '#fef2f2',
                  border: isDarkMode ? '1px solid rgba(239,68,68,0.12)' : '1px solid #fecaca',
                }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: isDarkMode ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.25 }}>
                    FKQC Remarks
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: isDarkMode ? '#fca5a5' : '#dc2626', lineHeight: 1.4 }}>
                    {lookupResult.fkqc_remark}
                  </Typography>
                </Box>
              )}

              {/* Product Link */}
              {lookupResult.fkt_link && (
                <Button
                  fullWidth size="small" variant="outlined"
                  href={lookupResult.fkt_link}
                  target="_blank" rel="noopener noreferrer"
                  startIcon={<OpenInNewIcon sx={{ fontSize: '16px !important' }} />}
                  sx={{
                    textTransform: 'none', fontWeight: 700,
                    fontSize: '0.85rem', height: 40, borderRadius: 2.5,
                    color: '#3b82f6', borderColor: isDarkMode ? 'rgba(59,130,246,0.3)' : '#93c5fd',
                    bgcolor: isDarkMode ? 'rgba(59,130,246,0.06)' : '#f0f7ff',
                    '&:hover': { bgcolor: isDarkMode ? 'rgba(59,130,246,0.12)' : '#dbeafe', borderColor: '#3b82f6' },
                  }}
                >
                  View on Flipkart
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Dialog>

      {/* Pivot Table Drawer */}
      <PivotTableDrawer
        open={pivotOpen}
        onClose={() => setPivotOpen(false)}
        warehouseId={activeWarehouse?.id}
      />

    </AppLayout >
  );
}
