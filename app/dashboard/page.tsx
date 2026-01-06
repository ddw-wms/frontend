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
} from "@mui/icons-material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { dashboardAPI, inventoryAPI, inboundAPI, pickingAPI, outboundAPI } from "@/lib/api";
import { useWarehouse } from "@/app/context/WarehouseContext";
import { getStoredUser, logout } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";
import { StandardPageHeader } from '@/components';
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";

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
  "product_title",
  "brand",
  "cms_vertical",
  "fsp",
  "mrp",
  "inbound_status",
  "qc_status",
  "picking_status",
  "outbound_status",
  "current_stage",
];

// Column width configuration - adjust per column. Use numbers for fixed widths (px) or flex for flexible columns.
// You can add mobile overrides using a `mobile` key; otherwise the helper will scale widths on small screens.
const COLUMN_WIDTHS: Record<string, any> = {
  wsn: { width: 110, minWidth: 90 },
  product_title: { width: 350, minWidth: 280 },
  brand: { width: 110 },
  cms_vertical: { width: 120 },
  fsp: { width: 100, minWidth: 80 },
  mrp: { width: 100, minWidth: 80 },
  inbound_status: { width: 120 },
  qc_status: { width: 120 },
  picking_status: { width: 110 },
  outbound_status: { width: 110 },
  current_stage: { width: 140 },
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

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [filteredData, setFilteredData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const gridRef = useRef<any>(null);
  const columnApiRef = useRef<any>(null);
  const [columnDefs, setColumnDefs] = useState<any[]>([]);
  const [pickingWSNs, setPickingWSNs] = useState<Set<string>>(new Set());
  const [outboundWSNs, setOutboundWSNs] = useState<Set<string>>(new Set());

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

  const [enableSorting, setEnableSorting] = useState<boolean>(() => {
    try { return localStorage.getItem('dashboard_enableSorting') !== 'false'; } catch { return true; }
  });
  const [enableColumnFilters, setEnableColumnFilters] = useState<boolean>(() => {
    try { return localStorage.getItem('dashboard_enableColumnFilters') !== 'false'; } catch { return true; }
  });
  const [enableColumnResize, setEnableColumnResize] = useState<boolean>(() => {
    try { return localStorage.getItem('dashboard_enableColumnResize') !== 'false'; } catch { return true; }
  });

  const defaultColDef = useMemo(() => ({
    sortable: !!enableSorting,
    resizable: !!enableColumnResize,
    filter: !!enableColumnFilters,
    minWidth: 100,
    flex: 1, // allow columns to flex and fill available width
    tooltipComponentParams: { color: '#ececec' },
  }), [enableSorting, enableColumnFilters, enableColumnResize]);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);

  // Grid settings
  useEffect(() => {
    try {
      const s = localStorage.getItem('dashboard_enableSorting');
      const f = localStorage.getItem('dashboard_enableColumnFilters');
      const r = localStorage.getItem('dashboard_enableColumnResize');
      if (s !== null) setEnableSorting(s === 'true');
      if (f !== null) setEnableColumnFilters(f === 'true');
      if (r !== null) setEnableColumnResize(r === 'true');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('dashboard_enableSorting', String(enableSorting));
      localStorage.setItem('dashboard_enableColumnFilters', String(enableColumnFilters));
      localStorage.setItem('dashboard_enableColumnResize', String(enableColumnResize));
    } catch { }
  }, [enableSorting, enableColumnFilters, enableColumnResize]);

  const formatGridDate = (raw: any) => {
    if (!raw) return '-';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

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
    const defs: any = visibleColumns.map((col) => {
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
          suppressMenu: true,
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
          suppressMenu: true,
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
    });

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
          sx={{ color: "#667eea", p: 0.5 }}
        >
          <FilterIcon fontSize="small" />
        </IconButton>
      ),
      width: 90,
      suppressMenu: true,
      resizable: enableColumnResize,
      sortable: false,
    });

    setColumnDefs(defs);
  }, [visibleColumns, enableSorting, enableColumnFilters, enableColumnResize, isMobile]);



  const [searchWSN, setSearchWSN] = useState("");

  const [stageFilter, setStageFilter] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [brandFilter, setBrandFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
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

  const loadInventoryData = useCallback(async () => {
    // Use request id to ignore stale responses
    currentLoadIdRef.current += 1;
    const loadId = currentLoadIdRef.current;

    // Always show the professional loading spinner for consistent UX
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
        setInventoryData(rows);
        setFilteredData(rows); // server already applied filters so show directly
        setTotal(response.data?.pagination?.total || 0);

        // Update grid rows immediately if grid API supports it
        if (gridRef.current && typeof (gridRef.current as any).setRowData === 'function') {
          try {
            (gridRef.current as any).setRowData(rows);
          } catch { /* ignore */ }
        }
      }

    } catch (error: any) {
      // ignore aborts
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED' || error?.name === 'AbortError') {
        // aborted or canceled - nothing to show
        return;
      }
      console.error("Load inventory error:", error);
      toast.error("Failed to load inventory data");
    } finally {
      // Only clear loading when this is the latest request
      if (loadId === currentLoadIdRef.current) {
        // Always clear loading state
        setLoading(false);
        inventoryAbortControllerRef.current = null;
      }
    }
  }, [activeWarehouse?.id, page, limit, searchDebounced, stageFilter, availableOnly, brandFilter, categoryFilter, dateFrom, dateTo]);

  const loadFilterOptions = useCallback(async () => {
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
    } catch (err) {
      console.warn("Could not load full filter options:", err);
      // On error, just leave empty - no fallback to page data
      setBrands([]);
      setCategories([]);
    }
  }, [activeWarehouse?.id]);

  // 🔥 GET FILTERED CATEGORIES - only for selected brand
  const getFilteredCategories = useCallback(async () => {
    if (!brandFilter) {
      // No brand selected, show all categories
      return categories;
    }
    try {
      // Get inbound data filtered by selected brand
      const response = await dashboardAPI.getInventoryPipeline({
        warehouseId: activeWarehouse?.id,
        brand: brandFilter,
        page: 1,
        limit: 10000, // Get all records for this brand
      });

      const items = response.data?.data || [];
      const uniqueCategories = Array.from(
        new Set(items.map((item: any) => item.cms_vertical).filter(Boolean))
      ) as string[];

      return uniqueCategories;
    } catch {
      console.error("Error getting filtered categories:");
      return categories; // Fallback to all categories
    }
  }, [activeWarehouse?.id, brandFilter, categories]);

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
      // Initial loads
      loadFilterOptions();
      loadMetrics();
      loadInventorySummary();
      // Load existing WSN lists for picking & outbound so status can reflect DONE
      loadExistingStageWSNs();

      // Debounce inventory loads to avoid flicker on rapid filter changes
      if (inventoryLoadDebounceRef.current) clearTimeout(inventoryLoadDebounceRef.current);
      inventoryLoadDebounceRef.current = setTimeout(() => {
        loadInventoryData();
        inventoryLoadDebounceRef.current = null;
      }, 100);

      const interval = setInterval(() => {
        loadMetrics();
        loadInventorySummary();
        // refresh existing stage WSNs periodically as well
        loadExistingStageWSNs();
      }, 5000);
      return () => {
        clearInterval(interval);
        if (inventoryLoadDebounceRef.current) {
          clearTimeout(inventoryLoadDebounceRef.current);
          inventoryLoadDebounceRef.current = null;
        }
      };
    }
  }, [activeWarehouse, page, limit, searchDebounced, stageFilter, availableOnly, brandFilter, categoryFilter, dateFrom, dateTo, loadFilterOptions, loadMetrics, loadInventorySummary, loadExistingStageWSNs, loadInventoryData]);

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

  const formatExcelSheet = (ws: any, data: any[]) => {
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

        formatExcelSheet(ws, formattedData);

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
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflow: "hidden",
          height: "100%",
        }}
      >
        {/* ================= HEADER ================= */}
        <StandardPageHeader
          title="Dashboard"
          subtitle="All warehouse operations"
          icon="📊"
          warehouseName={activeWarehouse?.name}
          userName={user?.fullName}
        />

        {/* =================  METRICS GRID WITH ICONS ================= */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(6, 1fr)",
              md: "repeat(6, 1fr)",
            },
            gap: { xs: 0.5, md: 2 },
            p: { xs: 0.3, md: 1 },
            overflowX: "visible",
          }}
        >

          {[
            { label: "Master Data", value: metrics.total, color: "#6366f1", icon: <DashboardRounded /> },
            { label: "Available", value: inventorySummary.available_stock, color: "#6366f1", icon: <InventoryRounded /> },
            { label: "Inbound", value: metrics.inbound, color: "#3b82f6", icon: <LoginRounded /> },
            { label: "QC", value: (metrics.qcPassed || 0) + (metrics.qcDone || 0), color: "#10b981", icon: <CheckCircleRounded /> },
            { label: "Picking", value: metrics.pickingCompleted, color: "#f59e0b", icon: <LocalShippingRounded /> },
            { label: "Dispatch", value: metrics.outboundDispatched, color: "#ef4444", icon: <SendRounded /> },
          ].map((m, index) => (

            <Card
              key={index}
              sx={{
                p: { xs: 0.25, md: 1.2 },
                height: { xs: 44, md: 80 },
                width: "100%",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                borderRadius: 2,
                background: `linear-gradient(135deg, ${m.color}15, ${m.color}35)`,
                border: `2px solid ${m.color}`,
                boxShadow: { xs: "0 1px 3px rgba(0,0,0,0.05)", md: "0 2px 6px rgba(0,0,0,0.08)" },
                transition: "all 0.2s ease",
                "&:hover": {
                  transform: { xs: "none", md: "translateY(-2px)" },
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  borderColor: m.color,
                },
              }}
            >
              {/* ICON */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  mb: 0.05,
                  "& svg": {
                    fontSize: { xs: "0.7rem", md: "1.4rem" },
                    color: m.color,
                  },
                }}
              >
                {m.icon}
              </Box>

              {/* VALUE */}
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: "0.75rem", md: "1.4rem" },
                  lineHeight: 1,
                  color: m.color,
                }}
              >
                {m.value}
              </Typography>

              {/* LABEL */}
              <Typography
                sx={{
                  fontSize: { xs: "0.5rem", md: "0.75rem" },
                  mt: 0.05,
                  fontWeight: 600,
                  color: "#666",
                }}
              >
                {m.label}
              </Typography>
            </Card>
          ))}
        </Box>


        {/* ================= FILTER BAR ================= */}
        <Box
          sx={{
            background: "white",
            px: { xs: 1, md: 2 },
            py: { xs: 1, md: 1.5 },
            display: "flex",
            flexDirection: "column",
            gap: { xs: 0.75, md: 1 },
            flexShrink: 0,
          }}
        >
          {/* TOP ROW: Search + Dates (desktop) + Filters toggle (mobile) */}
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "row", md: "row" },
              gap: { xs: 0.5, md: 1 },
              alignItems: "center",
            }}
          >
            {/* Search + Mobile Actions */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%' }}>
              <TextField
                size="small"
                placeholder="Search WSN or Product"
                value={searchWSN}
                onChange={(e) => {
                  setSearchWSN(e.target.value);
                  setPage(1);
                }}
                fullWidth
                sx={{ "& .MuiOutlinedInput-root": { height: 40 } }}
              />

              {/* Mobile Actions button: opens a full-screen dialog with filters + actions */}
              <Button
                variant="contained"
                color="primary"
                startIcon={<TuneIcon />}
                sx={{
                  display: { xs: 'inline-flex', md: 'none' },
                  size: 'small', height: 40, px: 2.5, textTransform: 'none'
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
                sx={{ "& .MuiOutlinedInput-root": { height: 40, fontSize: "0.875rem" } }}
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
                sx={{ "& .MuiOutlinedInput-root": { height: 40, fontSize: "0.875rem" } }}
              />
            </Box>

            {/* Filters toggle (desktop only) */}
            <Button
              variant="outlined"
              size="small"
              onClick={toggleFilters}
              sx={{
                display: { xs: 'none', md: 'inline-flex' },
                height: 40,
                minWidth: 120,
                fontSize: "0.60rem",
                fontWeight: 600,
                ml: 0.5,
                whiteSpace: "nowrap",
                justifyContent: "space-between",
                px: 1,
              }}
            >
              <FilterIcon sx={{
                fontSize: { xs: '1.1rem', sm: '1.15rem' },
                mr: { xs: 0, sm: 0.4 }
              }} />

              <Box component="span" sx={{ mr: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box component="span">{filtersOpen ? "Hide Filters" : "Show Filters"}</Box>
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
              <ExpandMoreIcon sx={{ transform: filtersOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }} />
            </Button>
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
                        sx={{ color: '#1976d2', '&.Mui-checked': { color: '#1976d2' } }}
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

                  <Button
                    size="small"
                    startIcon={<SettingsIcon sx={{ fontSize: 11 }} />}
                    variant="outlined"
                    onClick={() => setColumnDialogOpen(true)}
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

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon sx={{ fontSize: 11 }} />}
                    onClick={() => {
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
                            color: "#1976d2",
                            '&.Mui-checked': {
                              color: "#1976d2",
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
            px: 1,
            pb: { xs: 10, md: 2 }, // reserve space for mobile action bar
          }}
        >
          <Paper
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Table Container - AG Grid */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
              {/* Loading Overlay - shows during any loading state */}
              {loading && (
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

              {/* Empty State Overlay - shows when no data but headers remain visible */}
              {!activeWarehouse && (!filteredData || filteredData.length === 0) && !loading && (
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
                  <Box
                    sx={{
                      p: 5,
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                    }}
                  >
                    <Box
                      sx={{
                        p: 5,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: 4,
                        color: 'white',
                        boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4)',
                      }}
                    >
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                        No active warehouse selected
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
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
                '& .ag-root-wrapper': {
                  height: '100%',
                  borderRadius: '4px',
                  overflow: 'hidden'
                },
                '& .ag-header': {
                  backgroundColor: '#f8f9fa',
                  borderBottom: '2px solid #e9ecef',
                  fontWeight: 600,
                  opacity: '1 !important',
                  zIndex: 15,
                  position: 'relative'
                },
                '& .ag-header-cell': {
                  padding: '0 12px',
                  opacity: '1 !important'
                },
                '& .ag-body-viewport': {
                  opacity: loading ? 0.3 : 1,
                  transition: 'opacity 0.2s ease-in-out'
                },
                '& .ag-row': {
                  height: 26,
                  overflow: 'visible',
                  transition: 'background-color 0.15s ease'
                },
                '& .ag-row-even': {
                  backgroundColor: '#ffffff',
                },
                '& .ag-row-odd': {
                  backgroundColor: '#fafbfc',
                },
                '& .ag-cell': {
                  display: 'flex',
                  alignItems: 'center',
                  lineHeight: '26px',
                },
                '& .ag-cell-focus': {
                  border: '2px solid #1976d2 !important',
                  boxSizing: 'border-box',
                  outline: 'none'
                },
                '& .ag-cell-range-selected': {
                  backgroundColor: '#e3f2fd !important',
                },
                '& .ag-row-hover': {
                  backgroundColor: '#f0f7ff !important',
                  transition: 'background-color 0.1s ease'
                },
              }}>
                <div className="ag-theme-quartz" style={{ height: '100%', width: '100%' }}>
                  <AgGridReact
                    ref={gridRef}
                    rowData={filteredData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    rowSelection="single"
                    suppressRowClickSelection={true}
                    suppressLoadingOverlay={true}
                    suppressNoRowsOverlay={true}
                    getRowId={(params: any) => params.data?.wsn || params.data?.wid || String(params.rowIndex)}
                    onGridReady={(params: any) => {
                      gridRef.current = params.api;
                      columnApiRef.current = params.columnApi;
                      try {
                        const savedState = localStorage.getItem('dashboard_columnState');
                        if (savedState && params.api) {
                          params.api.applyColumnState({ state: JSON.parse(savedState), applyOrder: true });
                        }
                      } catch { /* ignore */ }
                    }}
                    onColumnResized={(params: any) => {
                      if (params.finished && params.api) {
                        try {
                          localStorage.setItem('dashboard_columnState', JSON.stringify(params.api.getColumnState()));
                        } catch { /* ignore */ }
                      }
                    }}
                    onColumnMoved={(params: any) => {
                      if (params.finished && params.api) {
                        try {
                          localStorage.setItem('dashboard_columnState', JSON.stringify(params.api.getColumnState()));
                        } catch { /* ignore */ }
                      }
                    }}
                    animateRows={false}
                    rowBuffer={10}
                    rowHeight={36}
                  />
                </div>
              </Box>
            </Box>
            {/* ================= PAGINATION (ALWAYS ONE ROW + MOBILE COMPACT) ================= */}
            <Box
              sx={{
                px: 2,
                py: 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: "1px solid #ddd",
                bgcolor: "white",
                flexShrink: 0,
                overflowX: "auto",
                whiteSpace: "nowrap",
                gap: 1,
              }}
            >
              {/* Per Page */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                  Per page:
                </Typography>

                <Select
                  size="small"
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  sx={{ minWidth: 70 }}
                >
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                  <MenuItem value={500}>500</MenuItem>
                  <MenuItem value={1000}>1000</MenuItem>
                </Select>
              </Stack>

              {/* Count */}
              <Typography
                sx={{
                  fontSize: "0.78rem",
                  whiteSpace: "nowrap",
                }}
              >
                {(page - 1) * limit + 1} – {Math.min(page * limit, total)} of{" "}
                {total}
              </Typography>

              {/* Pagination (Responsive) */}
              {(typeof window !== "undefined" && window.innerWidth < 500 ? (
                // MOBILE COMPACT PAGINATION
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    size="small"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Prev
                  </Button>

                  <Typography sx={{ fontSize: "0.85rem", fontWeight: 600 }}>
                    {page} / {Math.ceil(total / limit)}
                  </Typography>

                  <Button
                    size="small"
                    disabled={page === Math.ceil(total / limit)}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </Stack>
              ) : (
                // DESKTOP FULL PAGINATION
                <Pagination
                  page={page}
                  count={Math.ceil(total / limit)}
                  size="small"
                  onChange={(_, v) => setPage(v)}
                />
              ))}
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Mobile sticky action bar hidden (actions moved to Actions dialog) */}
      <Box sx={{ display: { xs: 'none', md: 'none' } }} />

      {/* MOBILE ACTIONS DIALOG (Filters + Actions combined) */}
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
            <Box>
              <TextField fullWidth placeholder="Search WSN or Product" value={searchWSN} onChange={(e) => { setSearchWSN(e.target.value); }} size="small" sx={{ '& .MuiOutlinedInput-root': { height: 40 } }} />
            </Box>

            <Box display="flex" gap={1} flexDirection="column">
              <TextField select size="small" label="Stage" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} fullWidth SelectProps={{ MenuProps: { PaperProps: { style: { maxHeight: 300 } } } }} sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}>
                {PIPELINE_STAGES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>

              <TextField select size="small" label="Brand" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} fullWidth SelectProps={{ MenuProps: { PaperProps: { style: { maxHeight: 300 } } } }} sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}>
                <MenuItem value="">All</MenuItem>
                {(categoryFilter ? memoizedFilteredBrands : brands).map((b) => (<MenuItem key={b} value={b}>{b}</MenuItem>))}
              </TextField>

              <TextField select size="small" label="Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} fullWidth SelectProps={{ MenuProps: { PaperProps: { style: { maxHeight: 300 } } } }} sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}>
                <MenuItem value="">All</MenuItem>
                {(brandFilter ? filteredCategories : categories).map((c) => (<MenuItem key={c} value={c}>{c}</MenuItem>))}
              </TextField>

              <Box display="flex" gap={1} alignItems="center">
                <TextField label="From Date" type="date" size="small" variant="outlined" InputLabelProps={{ shrink: true }} value={dateFrom || ''} onChange={(e) => setDateFrom(e.target.value)} sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 40 } }} />
                <TextField label="To Date" type="date" size="small" variant="outlined" InputLabelProps={{ shrink: true }} value={dateTo || ''} onChange={(e) => setDateTo(e.target.value)} sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 40 } }} />
              </Box>

              <FormControlLabel control={<Checkbox checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} />} label={<Typography sx={{ fontSize: '0.9rem', fontWeight: 700 }}>Available Only</Typography>} />

              {/* Action buttons */}
              <Box sx={{ display: 'grid', gap: 1, mt: 1, flexWrap: 'wrap', columnCount: 2, gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <Button variant="outlined" sx={{ width: 170 }} startIcon={<RestartAltIcon />} onClick={resetFilters}>Reset</Button>
                <Button variant="outlined" sx={{ width: 170 }} startIcon={<DownloadIcon />} onClick={() => { setExportFilters({ dateFrom, dateTo, stage: stageFilter || 'all', brand: brandFilter, category: categoryFilter, availableOnly: availableOnly ? 'available' : 'all' }); setExportDialogOpen(true); }}>Export</Button>

                <Button variant="outlined" sx={{ width: 170 }} startIcon={<SettingsIcon />} onClick={() => setColumnDialogOpen(true)}>Columns</Button>
                <Button variant="outlined" sx={{ width: 170 }} startIcon={<TuneIcon />} onClick={() => setGridSettingsOpen(true)}>Grid</Button>
              </Box>

            </Box>
          </Stack>
        </DialogContent>

        <Box sx={{ position: 'sticky', bottom: 0, left: 0, right: 0, bgcolor: 'background.paper', p: 1, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 1 }}>
          <Button fullWidth variant="outlined" onClick={() => { setDateFrom(''); setDateTo(''); setStageFilter('all'); setBrandFilter(''); setCategoryFilter(''); setAvailableOnly(false); }}>Reset</Button>
          <Button fullWidth variant="contained" onClick={() => { setPage(1); setMobileActionsOpen(false); }}>Apply</Button>
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
        open={columnDialogOpen}
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

    </AppLayout >
  );
}
