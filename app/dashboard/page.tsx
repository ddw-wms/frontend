// File Path = warehouse-frontend\app\dashboard\page.tsx UUU
"use client";

//import { useState, useEffect } from "react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import toast, { Toaster } from "react-hot-toast";
// ⚡ OPTIMIZED: XLSX loaded dynamically on export to reduce bundle size
// import * as XLSX from "xlsx"; // Removed static import

import { AgGridReact } from 'ag-grid-react';
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
  "current_stage",
];

// Column width configuration - adjust per column. Use numbers for fixed widths (px) or flex for flexible columns.
// You can add mobile overrides using a `mobile` key; otherwise the helper will scale widths on small screens.
const COLUMN_WIDTHS: Record<string, any> = {
  wid: { width: 120, minWidth: 80 },
  fsn: { width: 130, minWidth: 90 },
  order_id: { width: 130, minWidth: 80 },
  fkqc_remark: { width: 150, minWidth: 80 },
  fk_grade: { width: 100, minWidth: 80 },
  hsn_sac: { width: 120, minWidth: 80 },
  igst_rate: { width: 100, minWidth: 80 },
  invoice_date: { width: 120, minWidth: 80 },
  fkt_link: { width: 120, minWidth: 80 },
  wh_location: { width: 120, minWidth: 80 },
  vrp: { width: 100, minWidth: 80 },
  yield_value: { width: 100, minWidth: 80 },
  p_type: { width: 100, minWidth: 80 },
  p_size: { width: 100, minWidth: 80 },
  wsn: { width: 110, minWidth: 80 },
  product_title: { width: 350, minWidth: 280 },
  brand: { width: 100, minWidth: 80 },
  cms_vertical: { width: 120, minWidth: 80 },
  fsp: { width: 100, minWidth: 80 },
  mrp: { width: 100, minWidth: 80 },
  inbound_status: { width: 100, minWidth: 80 },
  qc_status: { width: 100, minWidth: 80 },
  qc_grade: { width: 100, minWidth: 80 },
  picking_status: { width: 100, minWidth: 80 },
  outbound_status: { width: 100, minWidth: 80 },
  current_stage: { width: 100, minWidth: 80 },
  vehicle_no: { width: 130, minWidth: 80 },
  warehouse_location: { width: 150, minWidth: 80 },
  rack_no: { width: 120, minWidth: 80 },
  inbound_date: { width: 120, minWidth: 80 },
  qc_date: { width: 120, minWidth: 80 },
  picking_date: { width: 120, minWidth: 80 },
  outbound_date: { width: 120, minWidth: 80 },
};

const PIPELINE_STAGES = [
  { value: "all", label: "All Items" },
  { value: "inbound", label: "Inbound" },
  { value: "qc", label: "QC (Done)" },
  { value: "picking", label: "Picking" },
  { value: "dispatched", label: "Dispatched" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [user, setUser] = useState<User | null>(null);

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

  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [filteredData, setFilteredData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true); // Start true for initial load spinner
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const gridRef = useRef<any>(null);
  const columnApiRef = useRef<any>(null);
  const hasAutoFittedRef = useRef(false); // Track if auto-fit has been done
  const [columnDefs, setColumnDefs] = useState<any[]>([]);
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
  const [initialLoad, setInitialLoad] = useState<boolean>(true);
  // ⚡ PROFESSIONAL PAGINATION: Keep previous data visible during page transitions
  const previousDataRef = useRef<InventoryItem[] | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  // ⚡ PAGE CACHE: Store fetched pages for instant back navigation
  const pageCacheRef = useRef<Map<string, { data: InventoryItem[], total: number, timestamp: number }>>(new Map());
  const PAGE_CACHE_TTL = 60000; // 1 minute cache validity

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
    minWidth: 100,
    flex: 1,
    tooltipComponentParams: { color: '#ececec' },
    cellStyle: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  }), [enableSorting, enableColumnFilters, enableColumnResize]);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);
  const [pivotOpen, setPivotOpen] = useState(false);

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
      // scale fixed widths down for mobile; keep flex/minWidth when present
      const r: any = {};
      if (sizing.flex) r.flex = sizing.flex;
      if (sizing.width) {
        r.width = Math.max(70, Math.round(sizing.width * 0.7));
        r.suppressSizeToFit = true;
      }
      if (sizing.minWidth) r.minWidth = Math.max(70, Math.round(sizing.minWidth * 0.7));
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
      width: 80,
      minWidth: 80,
      maxWidth: 100,
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
        minWidth: sizing?.minWidth || 150,
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
  useEffect(() => {
    if (gridRef.current) {
      try {
        const savedState = localStorage.getItem('dashboard_grid_state');
        if (savedState) {
          const state = JSON.parse(savedState);
          // Apply widths without changing order (applyOrder: false)
          // This preserves user's widths when toggling column visibility
          gridRef.current.applyColumnState({ state, applyOrder: false });
        }
      } catch { /* ignore */ }
    }
  }, [columnDefs]);

  const [searchWSN, setSearchWSN] = useState("");

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
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('dashboardFiltersOpen');
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore
    }
    return false;
  });
  // Mobile full-screen filter modal state (Flipkart/Myntra style)
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  // Actions overflow menu on mobile (used for compact action access)


  const toggleFilters = () => {
    setFiltersOpen((prev) => {
      const next = !prev;
      // ⚡ LAZY LOAD: Load filter options when filters panel opens for first time
      if (next && !filtersLoaded) {
        loadFilterOptions();
      }
      try {
        localStorage.setItem('dashboardFiltersOpen', next ? 'true' : 'false');
      } catch { }
      return next;
    });
  };

  // Determine if any filters are active (used to show green dot on toggle button)
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

  useEffect(() => {
    const savedColumns = localStorage.getItem("dashboardColumns");
    const savedLimit = localStorage.getItem("dashboardLimit");

    if (savedColumns) {
      try {
        setVisibleColumns(JSON.parse(savedColumns));
      } catch {
        setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
      }
    } else {
      setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    }

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

  // If user has not set a preference for filters, default to collapsed on mobile and expanded on desktop
  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem('dashboardFiltersOpen');
      // Default to collapsed when user has not set a preference
      if (savedFilters === null) {
        setFiltersOpen(false);
      }
    } catch { /* ignore */ }
  }, [isMobile]);

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

  const loadInventoryData = useCallback(async (forceRefresh = false) => {
    // Use request id to ignore stale responses
    currentLoadIdRef.current += 1;
    const loadId = currentLoadIdRef.current;

    const cacheKey = getCacheKey();

    // ⚡ PAGE CACHE: Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = pageCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PAGE_CACHE_TTL) {
        // Use cached data - instant!
        previousDataRef.current = cached.data;
        setInventoryData(cached.data);
        setFilteredData(cached.data);
        setTotal(cached.total);
        setLastRefreshTime(new Date(cached.timestamp));
        setLoading(false);

        // Prefetch next page in background
        setTimeout(() => prefetchNextPage(), 100);
        return;
      }
    }

    // ⚡ Show loading spinner
    setLoading(true);

    // Cancel any previous in-flight request
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

      // Only include filters when present
      if (searchDebounced) params.search = searchDebounced;
      if (stageFilter && stageFilter !== "all") params.stage = stageFilter;
      if (availableOnly) params.availableOnly = true;
      if (brandFilter) params.brand = brandFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const response = await dashboardAPI.getInventoryPipeline(params, { signal: controller.signal });
      // backend returns paginated data + pagination meta
      const rows = (response.data?.data || []) as InventoryItem[];

      // Only apply if this is latest request
      if (loadId === currentLoadIdRef.current) {
        // ⚡ Store current data for next transition
        previousDataRef.current = rows;

        setInventoryData(rows);
        setFilteredData(rows); // server already applied filters so show directly
        setTotal(response.data?.pagination?.total || 0);
        setLastRefreshTime(new Date());

        // ⚡ PAGE CACHE: Store in cache
        pageCacheRef.current.set(cacheKey, {
          data: rows,
          total: response.data?.pagination?.total || 0,
          timestamp: Date.now(),
        });

        // Reset retry count on success
        retryCountRef.current = 0;

        // Update grid rows immediately if grid API supports it
        if (gridRef.current && typeof (gridRef.current as any).setRowData === 'function') {
          try {
            (gridRef.current as any).setRowData(rows);
          } catch { /* ignore */ }
        }

        // ⚡ PREFETCH: Prefetch next page after successful load
        setTimeout(() => prefetchNextPage(), 500);
      }

    } catch (error: any) {
      // ignore aborts
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED' || error?.name === 'AbortError') {
        // aborted or canceled - clear loading and return
        setLoading(false);
        return;
      }
      console.error("Load inventory error:", error);

      // ⚡ AUTO-RETRY: Retry on failure
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        toast.error(`Loading failed, retrying... (${retryCountRef.current}/${MAX_RETRIES})`);
        setTimeout(() => {
          loadInventoryData(true);
        }, 1000 * retryCountRef.current); // Exponential backoff
        return;
      }

      toast.error("Failed to load inventory data");
      retryCountRef.current = 0;
    } finally {
      // Only clear loading when this is the latest request
      if (loadId === currentLoadIdRef.current) {
        setLoading(false);
        inventoryAbortControllerRef.current = null;
      }
    }
  }, [activeWarehouse?.id, page, limit, searchDebounced, stageFilter, availableOnly, brandFilter, categoryFilter, dateFrom, dateTo, getCacheKey, prefetchNextPage]);

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

  // ⚡ TIME AGO: Format last refresh time
  const getTimeAgo = useCallback((date: Date | null) => {
    if (!date) return '';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }, []);

  // ⚡ UPDATE TIME AGO: Update every 10 seconds
  const [, setTimeUpdate] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUpdate(prev => prev + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

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

  // ⚡ LAZY LOAD: If filters are already open on mount, load filter options
  useEffect(() => {
    if (filtersOpen && !filtersLoaded && activeWarehouse?.id) {
      loadFilterOptions();
    }
  }, [filtersOpen, filtersLoaded, activeWarehouse?.id, loadFilterOptions]);

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

  useEffect(() => {
    if (activeWarehouse) {
      // ⚡ PRIORITY 1: Load main inventory data FIRST (critical path)
      // Debounce inventory loads to avoid flicker on rapid filter changes
      if (inventoryLoadDebounceRef.current) clearTimeout(inventoryLoadDebounceRef.current);
      inventoryLoadDebounceRef.current = setTimeout(() => {
        loadInventoryData();
        inventoryLoadDebounceRef.current = null;

        // ⚡ PRIORITY 2: Load secondary data AFTER main data (deferred)
        if (!initialDataLoadedRef.current) {
          initialDataLoadedRef.current = true;
          // Defer non-critical loads by 500ms after main data
          setTimeout(() => {
            loadMetrics();
            loadInventorySummary();
            // Load existing WSN lists (even more deferred)
            setTimeout(() => loadExistingStageWSNs(), 300);
          }, 200);
        }
      }, 50); // Reduced from 100ms

      // ⚡ EGRESS OPTIMIZATION: Reduced polling from 5s to 60s (saves ~1.3GB/day)
      // Manual refresh still available via Refresh button
      const interval = setInterval(() => {
        loadMetrics();
        loadInventorySummary();
        // refresh existing stage WSNs periodically as well
        loadExistingStageWSNs();
      }, 60000);
      return () => {
        clearInterval(interval);
        if (inventoryLoadDebounceRef.current) {
          clearTimeout(inventoryLoadDebounceRef.current);
          inventoryLoadDebounceRef.current = null;
        }
      };
    }
  }, [activeWarehouse, page, limit, searchDebounced, stageFilter, availableOnly, brandFilter, categoryFilter, dateFrom, dateTo, loadMetrics, loadInventorySummary, loadExistingStageWSNs, loadInventoryData]);

  useEffect(() => {
    setFilteredData(inventoryData);
  }, [inventoryData]);

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
  useEffect(() => {
    const autoSize = () => {
      try {
        const colApi = columnApiRef.current;
        const api = gridRef.current;
        if (!colApi || !api) return;
        const allCols = (colApi.getAllColumns && colApi.getAllColumns()) ? colApi.getAllColumns().map((c: any) => c.getColId()) : [];
        if (!allCols || allCols.length === 0) return;
        colApi.autoSizeColumns(allCols, false);

        // If total column width is less than grid width, stretch to fit
        let total = 0;
        for (const id of allCols) {
          const col = colApi.getColumn(id);
          total += col?.getActualWidth ? col.getActualWidth() : 0;
        }
        const dims = api.getSize ? api.getSize() : (api.gridPanel && api.gridPanel.getBodyClientRect && api.gridPanel.getBodyClientRect());
        const gridW = dims?.width || 0;
        if (gridW && total < gridW) {
          api.sizeColumnsToFit();
        }
      } catch { /* ignore */ }
    };

    const t = setTimeout(autoSize, 50);
    let r: any;
    const onResize = () => {
      clearTimeout(r);
      r = setTimeout(autoSize, 150);
    };

    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t);
      clearTimeout(r);
      window.removeEventListener('resize', onResize);
    };
  }, [filteredData, columnDefs]);


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
    setSearchWSN("");
    setStageFilter("all");
    setBrandFilter("");
    setCategoryFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
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
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
        bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa',
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
            overflow: { xs: "hidden", md: "auto" },
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
              p: { xs: 1, sm: 2, md: 2 },
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
                      fontSize: { xs: "0.6rem", sm: "0.65rem", md: "0.7rem" },
                      fontWeight: 500,
                      color: isDarkMode ? "#64748b" : "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
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


          {/* ================= FILTER BAR ================= */}
          <Box
            sx={{
              background: isDarkMode ? '#1e293b' : 'white',
              px: { xs: 1, sm: 2, md: 2 },
              py: { xs: 1, sm: 1.5, md: 2 },
              display: "flex",
              flexDirection: "column",
              gap: { xs: 0.75, md: 1.5 },
              flexShrink: 0,
              borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)',
              // Sticky filter bar on desktop
              position: { xs: 'static', md: 'sticky' },
              top: { md: 0 },
              zIndex: { md: 10 },
              boxShadow: { md: isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)' },
            }}
          >
            {/* TOP ROW: Search + Dates (desktop) + Filters toggle (mobile) */}
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "row", md: "row" },
                gap: { xs: 0.75, md: 1.5 },
                alignItems: "center",
              }}
            >
              {/* Search + Mobile Actions */}
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', width: '100%' }}>
                <TextField
                  size="small"
                  placeholder="🔍 Search WSN or Product"
                  value={searchWSN}
                  onChange={(e) => {
                    setSearchWSN(e.target.value);
                    setPage(1);
                  }}
                  fullWidth
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

                {/* Mobile Actions button: opens a full-screen dialog with filters + actions */}
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
              </Box>

              {/* Desktop dates */}
              <Box
                sx={{
                  display: { xs: "none", md: "flex" },
                  gap: 1,
                }}
              >
                <TextField
                  label="From Date"
                  type="date"
                  size="small"
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                  value={dateFrom || ""}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      height: 42,
                      fontSize: "0.875rem",
                      bgcolor: isDarkMode ? '#1e293b' : '#f8fafc',
                      borderRadius: 2,
                      "&:hover": { bgcolor: isDarkMode ? '#334155' : '#f1f5f9' },
                      "&.Mui-focused": { bgcolor: isDarkMode ? '#1e293b' : 'white' },
                    },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
                    },
                  }}
                />
                <TextField
                  label="To Date"
                  type="date"
                  size="small"
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                  value={dateTo || ""}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      height: 42,
                      fontSize: "0.875rem",
                      bgcolor: isDarkMode ? '#1e293b' : '#f8fafc',
                      borderRadius: 2,
                      "&:hover": { bgcolor: isDarkMode ? '#334155' : '#f1f5f9' },
                      "&.Mui-focused": { bgcolor: isDarkMode ? '#1e293b' : 'white' },
                    },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
                    },
                  }}
                />
              </Box>

              {/* Filters toggle (desktop only) */}
              <Button
                variant={filtersOpen ? "contained" : "outlined"}
                size="small"
                onClick={toggleFilters}
                sx={{
                  display: { xs: 'none', md: 'inline-flex' },
                  height: 42,
                  minWidth: 130,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  ml: 0.5,
                  whiteSpace: "nowrap",
                  justifyContent: "space-between",
                  px: 2,
                  borderRadius: 2.5,
                  position: "relative",
                  ...(filtersOpen ? {
                    background: "linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)",
                  } : {
                    borderWidth: 1.5,
                    "&:hover": { borderWidth: 1.5 },
                  }),
                }}
              >
                <FilterIcon sx={{
                  fontSize: '1.1rem',
                  mr: 0.75,
                }} />

                <Box component="span" sx={{ mr: 0.5, display: 'flex', alignItems: 'center' }}>
                  <Box component="span">{filtersOpen ? "Hide" : "Filters"}</Box>
                  {filtersActive && !filtersOpen && (
                    <Tooltip title="Filters active">
                      <Box sx={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: '#10b981',
                        border: '2px solid white',
                        boxShadow: "0 2px 4px rgba(16,185,129,0.3)",
                      }} />
                    </Tooltip>
                  )}
                </Box>
                <ExpandMoreIcon sx={{
                  transform: filtersOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 200ms",
                  fontSize: "1.1rem",
                }} />
              </Button>

              {/* Pivot Table Button (desktop only) */}
              <Tooltip title="Open Pivot Analysis - Excel-style pivot table">
                <Button
                  variant={pivotOpen ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setPivotOpen(!pivotOpen)}
                  sx={{
                    display: { xs: 'none', md: 'inline-flex' },
                    height: 42,
                    minWidth: 110,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    ml: 0.5,
                    whiteSpace: "nowrap",
                    px: 2,
                    borderRadius: 2.5,
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
                  <PivotIcon sx={{
                    fontSize: '1.1rem',
                    mr: 0.75,
                  }} />
                  Pivot
                </Button>
              </Tooltip>
            </Box>

            {/* BODY: collapsible */}
            <Collapse in={filtersOpen} timeout="auto" sx={{ display: { xs: 'none', md: 'block' } }}>
              <Box sx={{ mt: { xs: 1, md: 0.5 } }}>
                {/* Dates on mobile */}
                <Box
                  sx={{
                    display: { xs: "flex", md: "none" },
                    flexDirection: "row",
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <TextField
                    label="From Date"
                    type="date"
                    size="small"
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    value={dateFrom || ""}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="To Date"
                    type="date"
                    size="small"
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    value={dateTo || ""}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                    sx={{ flex: 1 }}
                  />

                  {/* Mobile: move Available toggle to the right of date filters */}
                  <Box sx={{ ml: 'auto', display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
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
                          sx={{ color: '#1e40af', '&.Mui-checked': { color: '#1e40af' } }}
                        />
                      }
                      label={<Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#424242' }}>Available</Typography>}
                      sx={{ mr: 0 }}
                    />
                  </Box>
                </Box>

                {/* MAIN ROW: filters + buttons, no empty space */}
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", md: "row" },
                    gap: 1,
                    alignItems: { xs: "stretch", md: "center" },
                    justifyContent: "space-between",
                  }}
                >
                  {/* LEFT: Stage / Brand / Category - tightly packed (stack on mobile) */}
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: 'column', md: 'row' },
                      gap: { xs: 0.5, md: 1 },
                      flexGrow: 1,
                    }}
                  >
                    <TextField
                      select
                      size="small"
                      label="Stage"
                      value={stageFilter}
                      onChange={(e) => {
                        setStageFilter(e.target.value);
                        setPage(1);
                      }}
                      fullWidth
                      SelectProps={{
                        MenuProps: {
                          PaperProps: { style: { maxHeight: 300 } },
                        },
                      }}
                      sx={{ "& .MuiOutlinedInput-root": { height: { xs: 36, md: 40 }, fontSize: { xs: '0.85rem', md: '0.95rem' } } }}
                    >
                      {PIPELINE_STAGES.map((s) => (
                        <MenuItem key={s.value} value={s.value}>
                          {s.label}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      select
                      size="small"
                      label="Brand"
                      value={brandFilter}
                      onChange={(e) => {
                        setBrandFilter(e.target.value);
                        setPage(1);
                      }}
                      fullWidth
                      SelectProps={{
                        MenuProps: {
                          PaperProps: { style: { maxHeight: 300 } },
                        },
                      }}
                      sx={{ "& .MuiOutlinedInput-root": { height: { xs: 36, md: 40 }, fontSize: { xs: '0.85rem', md: '0.95rem' } } }}
                    >
                      <MenuItem value="">All</MenuItem>
                      {(categoryFilter ? memoizedFilteredBrands : brands).map((b) => (
                        <MenuItem key={b} value={b}>
                          {b}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      select
                      size="small"
                      label="Category"
                      value={categoryFilter}
                      onChange={(e) => {
                        setCategoryFilter(e.target.value);
                        setPage(1);
                      }}
                      fullWidth
                      SelectProps={{
                        MenuProps: {
                          PaperProps: { style: { maxHeight: 300 } },
                        },
                      }}
                      sx={{ "& .MuiOutlinedInput-root": { height: { xs: 36, md: 40 }, fontSize: { xs: '0.85rem', md: '0.95rem' } } }}
                    >
                      <MenuItem value="">All</MenuItem>
                      {(brandFilter ? filteredCategories : categories).map((c) => (
                        <MenuItem key={c} value={c}>
                          {c}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>

                  {/* RIGHT: Buttons - responsive 2x2 on mobile */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "repeat(6, 1fr)", // mobile: tighter fit for 6 items
                        md: "repeat(6, auto)", // desktop: 6 items in a row (includes Available Only)
                      },
                      gap: { xs: 0.5, md: 1 },
                      width: { xs: "100%", md: "auto" },
                      justifyContent: { xs: "stretch", md: "flex-end" },
                      alignItems: "center",
                      overflowX: { xs: 'auto', md: 'visible' }
                    }}
                  >
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<RestartAltIcon sx={{ fontSize: 14 }} />}
                      onClick={resetFilters}
                      sx={{
                        height: { xs: 34, md: 40 },
                        px: 1,
                        fontSize: { xs: '0.62rem', md: '0.65rem' },
                        fontWeight: 600,
                        width: "100%",
                      }}
                    >
                      RESET
                    </Button>


                    {canSeeButton('columns') && (
                      <Tooltip title={!canAccessButton('columns') ? "You don't have permission to use this feature" : "Manage Columns"} arrow>
                        <span style={{ width: '100%' }}>
                          <Button
                            size="small"
                            startIcon={<SettingsIcon sx={{ fontSize: 11 }} />}
                            variant="outlined"
                            disabled={!canAccessButton('columns')}
                            onClick={() => canAccessButton('columns') && setColumnDialogOpen(true)}
                            sx={{
                              height: { xs: 34, md: 40 },
                              px: 1,
                              fontSize: { xs: '0.62rem', md: '0.65rem' },
                              fontWeight: 600,
                              width: "100%",
                            }}
                          >
                            COLUMNS
                          </Button>
                        </span>
                      </Tooltip>
                    )}


                    <Button
                      size="small"
                      startIcon={<SettingsIcon sx={{ fontSize: 11 }} />}
                      variant="outlined"
                      onClick={() => setGridSettingsOpen(true)}
                      sx={{
                        height: { xs: 32, md: 36 },
                        px: 0.6,
                        fontSize: { xs: '0.6rem', md: '0.62rem' },
                        fontWeight: 600,
                        width: "100%",
                      }}
                    >
                      <TuneIcon sx={{ fontSize: 15, mr: 0.3 }} />
                      <Box component="span" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>GRID</Box>
                    </Button>

                    {canSeeButton('export') && (
                      <Tooltip title={!canAccessButton('export') ? "You don't have permission to use this feature" : "Export Data"} arrow>
                        <span style={{ width: '100%' }}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<DownloadIcon sx={{ fontSize: 11 }} />}
                            disabled={!canAccessButton('export')}
                            onClick={() => {
                              if (!canAccessButton('export')) return;
                              // Prefill export dialog with current active filters (use same stage codes as main filter)
                              setExportFilters({
                                dateFrom,
                                dateTo,
                                stage: stageFilter || 'all',
                                brand: brandFilter,
                                category: categoryFilter,
                                availableOnly: availableOnly ? 'available' : 'all',
                              });

                              setExportDialogOpen(true);
                            }}
                            sx={{
                              height: { xs: 34, md: 40 },
                              px: 1,
                              fontSize: { xs: '0.62rem', md: '0.65rem' },
                              fontWeight: 600,
                              width: "100%",
                            }}
                          >
                            EXPORT
                          </Button>
                        </span>
                      </Tooltip>
                    )}

                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
                      onClick={() => {
                        loadInventoryData();
                        loadMetrics();
                      }}
                      sx={{
                        height: { xs: 34, md: 40 },
                        px: 1,
                        fontSize: { xs: '0.62rem', md: '0.65rem' },
                        fontWeight: 600,
                        width: "100%",
                      }}
                    >
                      REFRESH
                    </Button>

                    {/* Available Only - inline in the button grid so it stays on same row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', pl: { xs: 0, md: 1 } }}>
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
                            sx={{
                              color: "#1e40af",
                              '&.Mui-checked': {
                                color: "#1e40af",
                              },
                              transform: { xs: 'scale(0.9)', md: 'scale(1)' },
                              mr: { xs: 0.4, md: 0.8 }
                            }}
                          />
                        }
                        label={
                          <Typography sx={{ fontSize: { xs: '0.6rem', md: '0.75rem' }, fontWeight: 600, color: "#424242" }}>
                            Available Only
                          </Typography>
                        }
                        sx={{ mr: 0 }}
                      />
                    </Box>

                  </Box>

                </Box>
              </Box>
            </Collapse>
          </Box>


          {/* ================= TABLE AREA (SCROLLABLE) ================= */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              pb: { xs: 0, md: 2 },
              bgcolor: isDarkMode ? '#0f172a' : 'transparent',
              minHeight: { md: 'calc(100vh - 180px)' }, // Ensure table has minimum height for proper scrolling
            }}
          >
            <Paper
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                bgcolor: isDarkMode ? '#1e293b' : 'background.paper',
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
                {/* Loading Spinner Overlay - semi-transparent so data stays visible */}
                {loading && filteredData && filteredData.length > 0 && (
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
                {loading && (!filteredData || filteredData.length === 0) && (
                  <Box sx={{
                    position: 'absolute',
                    top: 48,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2.5,
                      p: { xs: 3, md: 4 },
                      bgcolor: isDarkMode ? '#1e293b' : 'white',
                      borderRadius: 3,
                      boxShadow: isDarkMode ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.1)'
                    }}>
                      <Box sx={{ position: 'relative' }}>
                        <CircularProgress
                          size={52}
                          thickness={4}
                          sx={{
                            color: '#1e40af',
                            filter: 'drop-shadow(0 2px 8px rgba(30, 64, 175, 0.2))'
                          }}
                        />
                        <Box sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                          opacity: 0.12,
                          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                          '@keyframes pulse': {
                            '0%, 100%': {
                              transform: 'translate(-50%, -50%) scale(1)',
                              opacity: 0.12
                            },
                            '50%': {
                              transform: 'translate(-50%, -50%) scale(1.2)',
                              opacity: 0.04
                            }
                          }
                        }} />
                      </Box>
                      <Typography
                        sx={{
                          fontSize: '0.9rem',
                          fontWeight: 500,
                          color: isDarkMode ? '#94a3b8' : '#64748b',
                          letterSpacing: 0.2,
                          textAlign: 'center'
                        }}
                      >
                        Loading data...
                      </Typography>
                    </Box>
                  </Box>
                )}

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

                {activeWarehouse && (!filteredData || filteredData.length === 0) && !loading && (
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

                {/* AG Grid - Always Rendered */}
                <Box sx={{
                  flex: 1,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: isDarkMode ? '#1e293b' : 'transparent',
                  '& .ag-root-wrapper': {
                    height: '100%',
                    borderRadius: { xs: 0, md: '12px' },
                    overflow: 'hidden',
                    border: { xs: 'none', md: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)' },
                    backgroundColor: isDarkMode ? '#1e293b' : 'transparent',
                  },
                  '& .ag-header': {
                    backgroundColor: isDarkMode ? '#334155' : '#f8fafc',
                    borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                    fontWeight: 600,
                    opacity: '1 !important',
                    zIndex: 15,
                    position: 'relative'
                  },
                  '& .ag-header-cell': {
                    padding: '0 12px',
                    opacity: '1 !important',
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                    backgroundColor: isDarkMode ? '#334155' : 'transparent',
                    color: isDarkMode ? '#f1f5f9' : 'inherit',
                  },
                  '& .ag-body-viewport': {
                    opacity: loading ? 0.3 : 1,
                    transition: 'opacity 0.2s ease-in-out',
                  },
                  '& .ag-row': {
                    height: { xs: 44, md: 44 },
                    overflow: 'visible',
                    transition: 'background-color 0.15s ease',
                    borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                  },
                  '& .ag-row-even': {
                    backgroundColor: isDarkMode ? '#1a2536' : '#ffffff',
                  },
                  '& .ag-row-odd': {
                    backgroundColor: isDarkMode ? '#1e293b' : 'rgba(248,250,252,0.5)',
                  },
                  '& .ag-cell': {
                    display: 'flex',
                    alignItems: 'center',
                    lineHeight: { xs: '44px', md: '44px' },
                    fontSize: '0.875rem',
                    padding: '0 12px',
                    color: isDarkMode ? '#f1f5f9' : 'inherit',
                  },
                  '& .ag-cell-focus': {
                    border: '2px solid #1e40af !important',
                    boxSizing: 'border-box',
                    outline: 'none'
                  },
                  '& .ag-cell-range-selected': {
                    backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2) !important' : 'rgba(30,64,175,0.08) !important',
                  },
                  '& .ag-row-hover': {
                    backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15) !important' : 'rgba(30,64,175,0.04) !important',
                    transition: 'background-color 0.1s ease'
                  },
                }}>
                  <div className="ag-theme-quartz" style={{ height: '100%', width: '100%' }}>
                    <AgGridReact
                      ref={gridRef}
                      rowData={filteredData}
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
                        // Restore saved column state from localStorage
                        try {
                          const saved = localStorage.getItem('dashboard_grid_state');
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
                      }}
                      onColumnResized={(params: any) => {
                        // Save state when user finishes resizing
                        if (params.finished && params.api) {
                          try {
                            const state = params.api.getColumnState();
                            localStorage.setItem('dashboard_grid_state', JSON.stringify(state));
                          } catch { /* ignore */ }
                        }
                      }}
                      onColumnMoved={(params: any) => {
                        // Save state when user finishes moving columns
                        if (params.finished && params.api) {
                          try {
                            const state = params.api.getColumnState();
                            localStorage.setItem('dashboard_grid_state', JSON.stringify(state));
                          } catch { /* ignore */ }
                        }
                      }}
                      onColumnVisible={(params: any) => {
                        // Save state when column visibility changes
                        if (params.api) {
                          try {
                            const state = params.api.getColumnState();
                            localStorage.setItem('dashboard_grid_state', JSON.stringify(state));
                          } catch { /* ignore */ }
                        }
                      }}
                      animateRows={false}
                      rowHeight={tableRowHeight}
                      headerHeight={32}
                    />
                  </div>
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

                    {/* ⚡ Last Refresh Time Indicator */}
                    {lastRefreshTime && !isMobile && (
                      <Tooltip title={`Last updated: ${lastRefreshTime.toLocaleTimeString()}`}>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 1 }}>
                          <AccessTime sx={{ fontSize: 14, color: isDarkMode ? '#64748b' : '#94a3b8' }} />
                          <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                            {getTimeAgo(lastRefreshTime)}
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
        </Box>{/* END SCROLLABLE CONTENT AREA */}
      </Box>{/* END MAIN WRAPPER */}

      {/* MOBILE ACTIONS DIALOG (Filters + Actions combined) */}
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
                  fullWidth
                  placeholder="Search WSN or Product"
                  value={searchWSN}
                  onChange={(e) => { setSearchWSN(e.target.value); }}
                  size="small"
                  sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}
                />

                <TextField
                  select
                  size="small"
                  label="Stage"
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  fullWidth
                  SelectProps={{ MenuProps: { PaperProps: { style: { maxHeight: 300 } } } }}
                  sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}
                >
                  {PIPELINE_STAGES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                </TextField>

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
                  {(categoryFilter ? memoizedFilteredBrands : brands).map((b) => (<MenuItem key={b} value={b}>{b}</MenuItem>))}
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
                  {(brandFilter ? filteredCategories : categories).map((c) => (<MenuItem key={c} value={c}>{c}</MenuItem>))}
                </TextField>

                <Box display="flex" gap={1}>
                  <TextField
                    label="From Date"
                    type="date"
                    size="small"
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    value={dateFrom || ''}
                    onChange={(e) => setDateFrom(e.target.value)}
                    sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 40 } }}
                  />
                  <TextField
                    label="To Date"
                    type="date"
                    size="small"
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    value={dateTo || ''}
                    onChange={(e) => setDateTo(e.target.value)}
                    sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 40 } }}
                  />
                </Box>

                <FormControlLabel
                  control={<Checkbox checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} />}
                  label={<Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>Available Only</Typography>}
                />
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
                  startIcon={<RestartAltIcon />}
                  onClick={resetFilters}
                  sx={{ height: 44, fontSize: '0.85rem' }}
                >
                  Clear
                </Button>

                {canSeeButton('columns') && (
                  <Tooltip title={!canAccessButton('columns') ? "You don't have permission to use this feature" : ""} arrow>
                    <span style={{ width: '100%' }}>
                      <Button
                        variant="outlined"
                        startIcon={<SettingsIcon />}
                        disabled={!canAccessButton('columns')}
                        onClick={() => { if (canAccessButton('columns')) { setColumnDialogOpen(true); setMobileActionsOpen(false); } }}
                        sx={{ height: 44, fontSize: '0.85rem', width: '100%' }}
                      >
                        Columns
                      </Button>
                    </span>
                  </Tooltip>
                )}

                <Button
                  variant="outlined"
                  startIcon={<TuneIcon />}
                  onClick={() => { setGridSettingsOpen(true); setMobileActionsOpen(false); }}
                  sx={{ height: 44, fontSize: '0.85rem' }}
                >
                  Grid
                </Button>

                {canSeeButton('export') && (
                  <Tooltip title={!canAccessButton('export') ? "You don't have permission to use this feature" : ""} arrow>
                    <span style={{ width: '100%' }}>
                      <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        disabled={!canAccessButton('export')}
                        onClick={() => {
                          if (!canAccessButton('export')) return;
                          setExportFilters({ dateFrom, dateTo, stage: stageFilter || 'all', brand: brandFilter, category: categoryFilter, availableOnly: availableOnly ? 'available' : 'all' });
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
                  startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
                  onClick={() => loadInventoryData()}
                  disabled={loading}
                  sx={{ height: 44, fontSize: '0.85rem', gridColumn: 'span 2' }}
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
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
              setDateFrom('');
              setDateTo('');
              setStageFilter('all');
              setBrandFilter('');
              setCategoryFilter('');
              setAvailableOnly(false);
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

      {/* Pivot Table Drawer */}
      <PivotTableDrawer
        open={pivotOpen}
        onClose={() => setPivotOpen(false)}
        warehouseId={activeWarehouse?.id}
      />

    </AppLayout >
  );
}
