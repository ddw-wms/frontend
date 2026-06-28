// File Path = warehouse-frontend\app\inbound\page.tsx
"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useLayoutEffect,
} from "react";
import { useRouter } from "next/navigation";
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
  Card,
  CardContent,
  LinearProgress,
  Divider,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  Collapse,
  IconButton,
  AppBar,
  Toolbar,
  useMediaQuery,
  useTheme,
  Switch,
  Pagination,
  InputBase,
  Fade,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";

import {
  Add as AddIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  CheckCircleOutline as CheckIcon,
  Info as InfoIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterListIcon,
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
  Print as PrintIcon,
  Keyboard as KeyboardIcon,
  Link as LinkIcon,
  Inventory as InventoryIcon,
  QrCodeScanner as QrCodeScannerIcon,
} from "@mui/icons-material";

import { inboundAPI } from "@/lib/api";
import { useWarehouse } from "@/app/context/WarehouseContext";
import { getStoredUser } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";
import {
  StandardPageHeader,
  StandardTabs,
  BatchManagementTab,
  WSNOverwriteDialog,
} from "@/components";
import type { WSNOverwriteDialogData } from "@/components";
import { useTableRowHeight } from "@/app/context/AppearanceContext";
import toast, { Toaster } from "react-hot-toast";
// ⚡ OPTIMIZED: XLSX loaded dynamically on export to reduce bundle size
// import * as XLSX from 'xlsx'; // Removed - loaded dynamically when needed
import Tooltip from "@mui/material/Tooltip";
import { AgGridReact } from "@/components/AGGridScrollWrapper";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { printLabel, isAgentRunning } from "@/lib/printAgent";

// Constants
const DEFAULT_MULTI_COLUMNS = [
  "wsn",
  "unload_remarks",
  "product_title",
  "brand",
  "cms_vertical",
  "fsp",
  "mrp",
  "fkqc_remark",
  "p_type",
];

const DEFAULT_LIST_COLUMNS = [
  "inbound_date",
  "vehicle_no",
  "rack_no",
  "product_serial_number",
  "unload_remarks",
  "wsn",
  "wid",
  "fsn",
  "product_title",
  "brand",
  "cms_vertical",
  "fsp",
  "mrp",
  "quantity",
  "fkqc_remark",
  "p_type",
  "batch_id",
];

const ALL_MASTER_COLUMNS = [
  "wid",
  "fsn",
  "order_id",
  "product_title",
  "brand",
  "mrp",
  "fsp",
  "hsn_sac",
  "igst_rate",
  "cms_vertical",
  "fkt_link",
  "p_type",
  "p_size",
  "vrp",
  "yield_value",
  "fk_grade",
  "fkqc_remark",
];

const INBOUND_LIST_COLUMNS = [
  "inbound_date",
  "vehicle_no",
  "wsn",
  "wid",
  "fsn",
  "product_title",
  "brand",
  "cms_vertical",
  "fsp",
  "mrp",
  "quantity",
  "fkqc_remark",
  "p_type",
  "batch_id",
  "rack_no",
  "product_serial_number",
  "unload_remarks",
];

const EDITABLE_COLUMNS = [
  "wsn",
  "product_serial_number",
  "rack_no",
  "unload_remarks",
];

// ⚡ INBOUND EXPORT COLUMNS CONFIG (for column picker dialog)
const INBOUND_EXPORT_COLUMNS_CONFIG: {
  key: string;
  label: string;
  field: string;
}[] = [
  { key: "sr_no", label: "Sr No", field: "sr_no" },
  { key: "wsn", label: "WSN", field: "wsn" },
  {
    key: "product_serial_number",
    label: "Product Serial Number",
    field: "product_serial_number",
  },
  { key: "rack_no", label: "Rack No", field: "rack_no" },
  { key: "unload_remarks", label: "Unload Remarks", field: "unload_remarks" },
  { key: "inbound_date", label: "Inbound Date", field: "inbound_date" },
  { key: "vehicle_no", label: "Vehicle No", field: "vehicle_no" },
  { key: "wid", label: "WID", field: "wid" },
  { key: "fsn", label: "FSN", field: "fsn" },
  { key: "order_id", label: "Order ID", field: "order_id" },
  { key: "product_title", label: "Product Title", field: "product_title" },
  { key: "brand", label: "Brand", field: "brand" },
  { key: "mrp", label: "MRP", field: "mrp" },
  { key: "fsp", label: "FSP", field: "fsp" },
  { key: "hsn_sac", label: "HSN/SAC", field: "hsn_sac" },
  { key: "igst_rate", label: "IGST Rate", field: "igst_rate" },
  { key: "cms_vertical", label: "CMS Vertical", field: "cms_vertical" },
  { key: "fkt_link", label: "FKT Link", field: "fkt_link" },
  { key: "p_type", label: "Product Type", field: "p_type" },
  { key: "p_size", label: "Product Size", field: "p_size" },
  { key: "vrp", label: "VRP", field: "vrp" },
  { key: "yield_value", label: "Yield Value", field: "yield_value" },
  { key: "fk_grade", label: "FK Grade", field: "fk_grade" },
  { key: "fkqc_remark", label: "FKQC Remark", field: "fkqc_remark" },
];
const INBOUND_DEFAULT_EXPORT_COLUMNS = [
  "sr_no",
  "wsn",
  "product_serial_number",
  "rack_no",
  "unload_remarks",
  "inbound_date",
  "vehicle_no",
  "product_title",
  "brand",
  "mrp",
  "fsp",
  "fkqc_remark",
];

// ⚡ PERF: Module-level constant — avoids creating a new object per cellStyle call (thousands/sec during drag)
const SELECTION_RESET_STYLE = {
  backgroundColor: undefined as any,
  boxShadow: undefined as any,
  borderTop: undefined as any,
  borderBottom: undefined as any,
  borderLeft: undefined as any,
  borderRight: undefined as any,
};

import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import React from "react";
import localforage from "localforage";
import { useInboundPermissions } from "@/hooks/usePagePermissions";
import { useFullscreen, useLiveSession, useRealtimeSync } from "@/hooks";
import BulkUploadCard from "@/components/BulkUploadCard";
import LiveViewPanel from "@/components/LiveViewPanel";
// Simple localStorage-based grid state (native ag-Grid pattern)
import {
  getMasterDataByWSN as getLocalMasterData,
  prewarmCache,
  getCacheStats,
  getBatchList,
  cacheBatchData,
  isWSNInCachedBatches,
  getBatchCacheStats,
  setActiveWarehouseForCache,
  BatchInfo,
} from "@/lib/masterDataCache";
import {
  removeMultipleFromPendingCache,
  isCacheEnabled as isWMSCacheEnabled,
  getPendingByWSN,
  getPendingByWSNFast,
  loadPendingInventory,
  getCacheStats as getPendingCacheStats,
  enableCache as enableWMSCache,
  disableCache as disableWMSCache,
  warmupMemoryCache,
  clearMemoryCache,
  isMemoryCacheReady,
  removeFromPendingMemoryCache,
  removeMultipleFromPendingMemoryCache,
  startAutoRefresh,
  stopAutoRefresh,
} from "@/lib/wmsCache";
import { width } from "@mui/system";

// Register AG Grid modules ONCE
ModuleRegistry.registerModules([AllCommunityModule]);

// ⚡ WINDOW-LEVEL CACHE: Persists data outside React lifecycle for instant navigation
declare global {
  interface Window {
    __INBOUND_LIST_CACHE__?: {
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
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("activeWarehouse");
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.id ?? null;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
};

// Helper to get cached data (checks both window cache and sessionStorage)
// ⚡ FIX: Only returns cache if warehouseId matches current warehouse
const getCachedInboundListData = (): any[] => {
  const currentWarehouseId = getCurrentWarehouseId();

  // Priority 1: Window cache (fastest, survives navigation)
  if (
    typeof window !== "undefined" &&
    window.__INBOUND_LIST_CACHE__?.data?.length
  ) {
    // Only use cache if warehouse matches and not stale (2 min TTL)
    if (
      window.__INBOUND_LIST_CACHE__.warehouseId === currentWarehouseId &&
      Date.now() - (window.__INBOUND_LIST_CACHE__.timestamp || 0) < 120000
    ) {
      return window.__INBOUND_LIST_CACHE__.data;
    }
  }
  // Priority 2: SessionStorage (survives page refresh) - skip if warehouse mismatch
  try {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("inbound_list_cache");
      const savedWarehouseId = sessionStorage.getItem(
        "inbound_list_cache_warehouseId",
      );
      if (
        saved &&
        savedWarehouseId &&
        parseInt(savedWarehouseId, 10) === currentWarehouseId
      ) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Also populate window cache for faster subsequent access
          window.__INBOUND_LIST_CACHE__ = {
            data: parsed,
            total: parsed.length,
            timestamp: Date.now(),
            warehouseId: currentWarehouseId,
          };
          return parsed;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return [];
};

// Tab definitions with permission codes
const ALL_TABS = [
  "Inbound List",
  "Single Entry",
  "Bulk Upload",
  "Multi Entry",
  "Batch Management",
];
const TAB_CODES = ["list", "single", "bulk", "multi", "batches"];

export default function InboundPage() {
  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);

  // Get table row height from appearance settings
  const tableRowHeight = useTableRowHeight();

  // Permission hook
  const {
    filterTabs,
    canSeeTab,
    canSeeButton,
    canAccessButton,
    isAdmin,
    isLoading: permLoading,
  } = useInboundPermissions();

  // Get visible tabs based on permissions
  const visibleTabs = useMemo(
    () => filterTabs(ALL_TABS, TAB_CODES),
    [filterTabs],
  );
  const visibleTabCodes = useMemo(() => {
    if (isAdmin) return TAB_CODES;
    return TAB_CODES.filter((code) => canSeeTab(code));
  }, [canSeeTab, isAdmin]);

  const [tabValue, setTabValue] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<any>(null);
  const listGridRef = useRef<any>(null); // Separate ref for List grid
  const multiEntryContainerRef = useRef<HTMLDivElement>(null); // Ref for fullscreen mode
  const multiGridBoxRef = useRef<HTMLDivElement>(null); // Ref for grid container (paste handler)
  const columnApiRef = useRef<any>(null);
  const hasAutoFittedRef = useRef(false); // Track if auto-fit has been done
  const isRestoringStateRef = useRef(false); // Prevent saving state during restore
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

  // ====== FULLSCREEN MODE ======
  const { isFullscreen, toggleFullscreen } = useFullscreen(
    multiEntryContainerRef,
  );

  // ====== PRINT TOGGLE STATE ======
  const [singlePrintEnabled, setSinglePrintEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("inbound_singlePrintEnabled");
      return saved !== "false"; // Default to true
    }
    return true;
  });
  const [multiPrintEnabled, setMultiPrintEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("inbound_multiPrintEnabled");
      return saved !== "false"; // Default to true
    }
    return true;
  });

  // ====== CTRL+P REPRINT SHORTCUT STATE ======
  const [ctrlPPrintEnabled, setCtrlPPrintEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("inbound_ctrlPPrintEnabled");
      return saved !== "false"; // Default to true
    }
    return true;
  });

  // ====== CTRL+O PRODUCT LINK SHORTCUT STATE ======
  const [ctrlOProductLinkEnabled, setCtrlOProductLinkEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("inbound_ctrlOProductLinkEnabled");
      return saved !== "false"; // Default to true
    }
    return true;
  });

  // ====== MULTI ENTRY SETTINGS PANEL STATE ======
  const [multiSettingsPanelOpen, setMultiSettingsPanelOpen] = useState(false);
  const [settingsPanelExpanded, setSettingsPanelExpanded] = useState<
    string | false
  >("columns");

  // Track last scanned row data for Ctrl+P reprint
  const lastScannedRowRef = useRef<any>(null);

  //state variables for responsive UI
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));
  const isDarkMode = theme.palette.mode === "dark";

  // ====== LIST OPTIONS PANEL STATE ======
  const [listOptionsPanelOpen, setListOptionsPanelOpen] = useState(false);
  const [listSettingsPanelExpanded, setListSettingsPanelExpanded] = useState<
    string | false
  >("filters");

  // ====== SINGLE ENTRY STATE ======
  const [singleWSN, setSingleWSN] = useState("");
  const [masterData, setMasterData] = useState<any>(null);
  const [singleForm, setSingleForm] = useState({
    inbound_date: new Date().toISOString().split("T")[0],
    vehicle_no: "",
    product_serial_number: "",
    rack_no: "",
    unload_remarks: "",
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
        wsn: "",
        inbound_date: new Date().toISOString().split("T")[0],
        vehicle_no: "",
        product_serial_number: "",
        rack_no: "",
        unload_remarks: "",
      };
    });
  };

  const [multiRows, setMultiRows] = useState<any[]>(() =>
    generateEmptyRows(500),
  );
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiResults, setMultiResults] = useState<any[]>([]);
  const [duplicateWSNs, setDuplicateWSNs] = useState<Set<string>>(new Set());

  // ====== EXCEL-LIKE ENHANCEMENTS ======
  // Row highlighting for newly added/scanned rows
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(
    new Set(),
  );
  const highlightTimeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // Undo/Redo history for Excel-like behavior - CELL-LEVEL like Excel
  interface UndoAction {
    type: "cell" | "paste" | "fillDown";
    rowIndex: number;
    field: string;
    oldValue: any;
    newValue: any;
    // For WSN changes that trigger master data clear/fetch
    oldRowData?: any;
    newRowData?: any;
    // For batch paste undo/redo
    pasteData?: {
      startRow: number;
      endRow: number;
      oldRows: any[]; // snapshot of rows BEFORE paste
      newRows: any[]; // snapshot of rows AFTER paste (with master data)
    };
  }
  const undoStackRef = useRef<UndoAction[]>([]);
  const redoStackRef = useRef<UndoAction[]>([]);
  const multiRowsRef = useRef<any[]>([]); // Track multiRows synchronously for undo
  const MAX_UNDO_HISTORY = 100;

  // WSN fetch tracking to prevent race conditions
  const wsnFetchMapRef = useRef<Map<number, string>>(new Map());

  // ⚡ BULK PASTE refs (used by custom paste handler)
  const isPastingRef = useRef(false);

  // ⚡ REAL-TIME SYNC: Cross-device row sync refs
  const isSyncingRef = useRef(false); // Prevents sync → autosave → sync loop
  const lastSyncReceivedAtRef = useRef(0); // Timestamp of last sync received (suppresses redundant draft toast)
  const pendingSyncRowsRef = useRef<Map<number, any>>(new Map()); // Batches row changes for debounced sync
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ---- Draft / Autosave (IndexedDB via localForage) ----
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftExists, setDraftExists] = useState(false);
  const lastChangeAtRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ---- Receiving WSNs Sync (for master data "Receiving" status) ----
  const receivingSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedWSNsRef = useRef<string>(""); // JSON string for comparison
  const hasEverSyncedWSNsRef = useRef<boolean>(false); // Track if WSNs were ever synced (to handle deletion)

  // ---- Offline Warning Tracker ----
  const offlineWarningShownRef = useRef<boolean>(false);

  const [crossWarehouseWSNs, setCrossWarehouseWSNs] = useState<Set<string>>(
    new Set(),
  );
  const [gridDuplicateWSNs, setGridDuplicateWSNs] = useState<Set<string>>(
    new Set(),
  );

  // ====== WSN OVERWRITE WARNING DIALOG ======
  const [wsnOverwriteDialog, setWsnOverwriteDialog] =
    useState<WSNOverwriteDialogData | null>(null);
  const pendingWSNRef = useRef<{
    rowIndex: number;
    newWSN: string;
    event: any;
  } | null>(null);

  // ====== LIVE VIEW SESSION MANAGEMENT ======
  const isOnMultiTab = visibleTabCodes[tabValue] === "multi";
  const {
    startSession: startLiveSession,
    updateEntries: updateLiveEntries,
    endSession: endLiveSession,
    isActive: isLiveSessionActive,
  } = useLiveSession({
    warehouseId: activeWarehouse?.id,
    pageType: "inbound",
    enabled: isOnMultiTab && !!activeWarehouse?.id,
  });

  // Auto-start live session when entering Multi Entry tab
  useEffect(() => {
    if (isOnMultiTab && activeWarehouse?.id && !isLiveSessionActive) {
      startLiveSession();
      // ⚡ Warm up memory cache for ultra-fast WSN lookups
      warmupMemoryCache(activeWarehouse.id).catch((err) => {
        console.warn("Memory cache warmup failed:", err);
      });
    } else if (!isOnMultiTab && isLiveSessionActive) {
      endLiveSession();
    }
  }, [
    isOnMultiTab,
    activeWarehouse?.id,
    isLiveSessionActive,
    startLiveSession,
    endLiveSession,
  ]);

  // ⚡ AUTO-ENABLE + AUTO-LOAD: When multi-entry tab opens, auto-enable cache and load pending data
  useEffect(() => {
    if (!isOnMultiTab || !activeWarehouse?.id) return;

    const autoInitCache = async () => {
      // Auto-enable cache if not already
      if (!isWMSCacheEnabled()) {
        enableWMSCache();
        setPendingCacheEnabled(true);
        console.log("⚡ Auto-enabled pending cache for multi-entry tab");
      }

      // Check if cache already has data for this warehouse
      try {
        const stats = await getPendingCacheStats(activeWarehouse.id);
        setPendingCacheStats(stats.pending);

        // If no data cached yet, auto-load in background
        if (!stats.pending?.count || stats.pending.count === 0) {
          console.log(
            "⚡ No cached data found, auto-loading pending inventory...",
          );
          setPendingCacheLoading(true);
          setPendingCacheProgress("Auto-loading pending inventory...");

          const result = await loadPendingInventory(
            activeWarehouse.id,
            (loaded, total, message) => {
              setPendingCacheProgress(message);
            },
          );

          if (result.success && result.count > 0) {
            // Warm up memory map from fresh data
            await warmupMemoryCache(activeWarehouse.id);
            const freshStats = await getPendingCacheStats(activeWarehouse.id);
            setPendingCacheStats(freshStats.pending);
            console.log(
              `✅ Auto-loaded ${result.count.toLocaleString()} pending items`,
            );
          }
          setPendingCacheLoading(false);
          setPendingCacheProgress(null);
        }
      } catch (err) {
        console.warn("Auto-init cache error:", err);
        setPendingCacheLoading(false);
        setPendingCacheProgress(null);
      }
    };

    autoInitCache();
  }, [isOnMultiTab, activeWarehouse?.id]);

  // ⚡ AUTO-REFRESH: Keep pending cache fresh every 30 minutes while on multi-entry tab
  useEffect(() => {
    if (isOnMultiTab && activeWarehouse?.id && isWMSCacheEnabled()) {
      const cleanup = startAutoRefresh(activeWarehouse.id, 30 * 60 * 1000); // 30 min
      return cleanup; // Stops auto-refresh when leaving tab or unmounting
    } else {
      stopAutoRefresh();
    }
  }, [isOnMultiTab, activeWarehouse?.id]);

  // Broadcast entries when multiRows change
  useEffect(() => {
    if (isLiveSessionActive && isOnMultiTab) {
      const validEntries = multiRows
        .map((row, idx) => ({
          wsn: row.wsn || "",
          product_title: row.product_title || "",
          brand: row.brand || "",
          mrp: row.mrp,
          fsp: row.fsp,
          cms_vertical: row.cms_vertical || "",
          fkqc_remarks: row.fkqc_remark || "",
          p_type: row.p_type || "",
          p_size: row.p_size || "",
          source: row.source || "",
          wid: row.wid || "",
          fsn: row.fsn || "",
          fk_grade: row.fk_grade || "",
          hsn_sac: row.hsn_sac || "",
          igst_rate: row.igst_rate,
          vrp: row.vrp,
          yield_value: row.yield_value,
          fkt_link: row.fkt_link || "",
          wh_location: row.wh_location || "",
          rack_no: row.rack_no || "",
          product_serial_number: row.product_serial_number || "",
          row_index: idx,
        }))
        .filter((e) => e.wsn.trim());
      updateLiveEntries(validEntries);
    }
  }, [multiRows, isLiveSessionActive, isOnMultiTab, updateLiveEntries]);

  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_MULTI_COLUMNS);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [commonDate, setCommonDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const inboundDateInputRef = useRef<HTMLInputElement | null>(null);
  const singleInboundDateInputRef = useRef<HTMLInputElement | null>(null);

  const [commonVehicle, setCommonVehicle] = useState("");
  const [multiErrorMessage, setMultiErrorMessage] = useState("");
  const [scrollTop, setScrollTop] = useState(0);

  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [filteredBrands, setFilteredBrands] = useState<string[]>([]);

  // ====== INBOUND LIST STATE ======
  // ⚡ INSTANT NAVIGATION: Initialize from cache to prevent empty grid flash
  const [listData, setListData] = useState<any[]>(() =>
    getCachedInboundListData(),
  );
  const [listLoading, setListLoading] = useState(
    () => getCachedInboundListData().length === 0,
  );
  // Track when we've received actual API response (not just loading finished)
  const [dataResponseReceived, setDataResponseReceived] = useState(
    () => getCachedInboundListData().length > 0,
  );

  // ⚡ SYNCHRONOUS MOUNT: Load cache BEFORE paint for instant display
  useLayoutEffect(() => {
    const cached = getCachedInboundListData();
    if (cached.length > 0) {
      setListData(cached);
      setListLoading(false);
      setDataResponseReceived(true);
    }
  }, []);

  // Local refresh button state (non-blocking)
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [total, setTotal] = useState(0);
  const [searchFilter, setSearchFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
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

  const fromDateFilterRef = useRef<HTMLInputElement | null>(null);
  const toDateFilterRef = useRef<HTMLInputElement | null>(null);

  // Minimum time (ms) to show loading overlay to avoid flicker
  const MIN_LOADING_MS = 350;
  // Search debounce delay for smooth performance
  const SEARCH_DEBOUNCE_MS = 300;

  // ⚡ PAGE CACHE: Store fetched pages for instant back navigation
  const pageCacheRef = useRef<
    Map<string, { data: any[]; total: number; timestamp: number }>
  >(new Map());
  const PAGE_CACHE_TTL = 60000; // 1 minute cache validity

  // ⚡ LAST REFRESH TIME: Track when data was last fetched
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // ⚡ AUTO-RETRY: Track retry attempts
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  // ⚡ LAZY LOADING: Defer filter options loading
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  const [brandFilter, setBrandFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Whether any filter is active (used to show green dot on Filters button)
  const filtersActive = Boolean(
    (searchFilter && searchFilter.trim() !== "") ||
    (brandFilter && brandFilter !== "") ||
    (categoryFilter && categoryFilter !== "") ||
    (statusFilter && statusFilter !== "") ||
    (dateFromFilter && dateFromFilter !== "") ||
    (dateToFilter && dateToFilter !== ""),
  );
  const [listColumns, setListColumns] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("inboundListColumns");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.log("Column settings load error");
        }
      }
    }
    return [
      "wsn",
      "product_title",
      "brand",
      "cms_vertical",
      "fsp",
      "mrp",
      "p_type",
      "fkqc_remark",
      "inbound_date",
      "vehicle_no",
      "rack_no",
      "quantity",
      "batch_id",
      "product_serial_number",
      "unload_remarks",
    ];
  });

  const [listColumnSettingsOpen, setListColumnSettingsOpen] = useState(false);

  // ====== BATCH MANAGEMENT STATE ======
  const [batches, setBatches] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // ====== EXPORT STATE ======
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exportBatchIds, setExportBatchIds] = useState<string[]>([]);
  const [existingInboundWSNs, setExistingInboundWSNs] = useState(new Set());

  // Multi-entry export column picker state
  const [inboundExportDialogOpen, setInboundExportDialogOpen] = useState(false);
  const [inboundExportSelectedColumns, setInboundExportSelectedColumns] =
    useState<string[]>(() => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("inboundExportColumns");
        if (saved) {
          try {
            return JSON.parse(saved);
          } catch {
            /* ignore */
          }
        }
      }
      return INBOUND_DEFAULT_EXPORT_COLUMNS;
    });
  const [inboundExportRemember, setInboundExportRemember] = useState(() => {
    if (typeof window !== "undefined")
      return localStorage.getItem("inboundExportRemember") === "true";
    return false;
  });

  // Grid settings with localStorage
  const [gridSettings, setGridSettings] = useState({
    sortable: false,
    filter: false,
    resizable: true,
    editable: true,
  });

  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);

  // ====== MULTI ENTRY GRID SETTINGS (SEPARATE) ======
  const [multiGridSettings, setMultiGridSettings] = useState({
    sortable: false,
    filter: false,
    resizable: true,
    editable: true,
  });
  const [multiGridSettingsOpen, setMultiGridSettingsOpen] = useState(false);

  // ✅ LOAD Grid Settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("qc_grid_settings");
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setGridSettings(parsed);
        console.log("✅ Grid settings loaded:", parsed);
      } catch (e) {
        console.log("Failed to parse grid settings");
      }
    }
    // Load Multi Entry grid settings
    const savedMultiSettings = localStorage.getItem(
      "inbound_multi_grid_settings",
    );
    if (savedMultiSettings) {
      try {
        const parsed = JSON.parse(savedMultiSettings);
        setMultiGridSettings(parsed);
        console.log("✅ Multi Entry Grid settings loaded:", parsed);
      } catch (e) {
        console.log("Failed to parse multi grid settings");
      }
    }
  }, []);

  // ✅ SAVE to localStorage whenever settings change
  const updateGridSettings = (newSettings: typeof gridSettings) => {
    setGridSettings(newSettings);
    localStorage.setItem("qc_grid_settings", JSON.stringify(newSettings));
    console.log("💾 Grid settings saved:", newSettings);
  };

  // ✅ SAVE Multi Entry grid settings
  const updateMultiGridSettings = (newSettings: typeof multiGridSettings) => {
    setMultiGridSettings(newSettings);
    localStorage.setItem(
      "inbound_multi_grid_settings",
      JSON.stringify(newSettings),
    );
    console.log("💾 Multi Entry Grid settings saved:", newSettings);
  };

  // ====== MASTER DATA CACHE STATE ======
  const [cacheStats, setCacheStats] = useState<{
    totalRecords: number;
    isReady: boolean;
  } | null>(null);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [gridDataRendered, setGridDataRendered] = useState(false);

  // ====== NEW PENDING CACHE STATE (wmsCache - only pending items) ======
  const [pendingCacheEnabled, setPendingCacheEnabled] = useState(false);
  const [pendingCacheStats, setPendingCacheStats] = useState<{
    count: number;
    lastSync: number | null;
  } | null>(null);
  const [pendingCacheLoading, setPendingCacheLoading] = useState(false);
  const [pendingCacheProgress, setPendingCacheProgress] = useState<
    string | null
  >(null);

  // ====== BATCH-SPECIFIC CACHING STATE ======
  const [availableBatches, setAvailableBatches] = useState<BatchInfo[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [batchCacheLoading, setBatchCacheLoading] = useState(false);
  const [batchCacheProgress, setBatchCacheProgress] = useState<{
    loaded: number;
    total: number;
    message: string;
  } | null>(null);
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
        console.error("Failed to load batch list:", error);
      }
    };
    loadBatches();
  }, []);

  // Restore selected batches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("inbound_selected_batches");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedBatchIds(parsed);
        }
      }
    } catch (e) {
      /* ignore */
    }
  }, []);

  // Auto-load batch cache when batches are selected
  useEffect(() => {
    if (selectedBatchIds.length > 0) {
      localStorage.setItem(
        "inbound_selected_batches",
        JSON.stringify(selectedBatchIds),
      );

      // Cache the selected batches
      const loadBatchCache = async () => {
        setBatchCacheLoading(true);
        setBatchCacheProgress({
          loaded: 0,
          total: 1,
          message: "Loading batch data...",
        });

        try {
          const result = await cacheBatchData(
            selectedBatchIds,
            true,
            (loaded, total, message) => {
              setBatchCacheProgress({ loaded, total, message });
            },
          );

          if (result.success) {
            setCacheStats({ totalRecords: result.count, isReady: true });
            toast.success(
              `✅ Cached ${result.count.toLocaleString()} products from ${selectedBatchIds.length} batch(es)`,
            );
          } else {
            toast.error("Failed to cache batch data");
          }
        } catch (error) {
          console.error("Batch cache error:", error);
          toast.error("Failed to cache batch data");
        } finally {
          setBatchCacheLoading(false);
          setBatchCacheProgress(null);
        }
      };

      loadBatchCache();
    } else {
      // Clear cache stats when no batches selected
      localStorage.removeItem("inbound_selected_batches");
    }
  }, [selectedBatchIds]);

  // Sync warehouse context with master data cache
  useEffect(() => {
    if (activeWarehouse?.id) {
      setActiveWarehouseForCache(activeWarehouse.id);
    }
  }, [activeWarehouse?.id]);

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
        setCacheStats({
          totalRecords: stats.totalRecords,
          isReady: stats.isReady,
        });

        if (stats.isReady) {
          console.log(
            `✅ Master data cache ready: ${stats.totalRecords} records`,
          );
        }
      } catch (error) {
        console.error("Cache init error:", error);
      } finally {
        setCacheLoading(false);
      }
    };

    initCache();

    // Refresh cache stats periodically
    const interval = setInterval(async () => {
      try {
        const stats = await getCacheStats();
        setCacheStats({
          totalRecords: stats.totalRecords,
          isReady: stats.isReady,
        });
      } catch (e) {
        /* ignore */
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [selectedBatchIds.length]);

  // ====== PENDING CACHE INIT (NEW - wmsCache) ======
  useEffect(() => {
    // Check if pending cache is enabled
    setPendingCacheEnabled(isWMSCacheEnabled());

    // Load stats if enabled and warehouse is selected
    const loadStats = async () => {
      if (!activeWarehouse?.id) return;
      try {
        const stats = await getPendingCacheStats(activeWarehouse.id);
        setPendingCacheStats(stats.pending);
      } catch (e) {
        console.error("Failed to load pending cache stats:", e);
      }
    };
    loadStats();
  }, [activeWarehouse?.id]);

  // Load pending cache function
  const handleLoadPendingCache = async () => {
    if (!activeWarehouse?.id) {
      toast.error("Select warehouse first");
      return;
    }

    setPendingCacheLoading(true);
    setPendingCacheProgress("Loading pending inventory...");

    try {
      // Enable cache if not already
      if (!isWMSCacheEnabled()) {
        enableWMSCache();
        setPendingCacheEnabled(true);
      }

      const result = await loadPendingInventory(
        activeWarehouse.id,
        (loaded, total, message) => {
          setPendingCacheProgress(message);
        },
      );

      if (result.success) {
        toast.success(
          `✅ Cached ${result.count.toLocaleString()} pending items`,
        );
        const stats = await getPendingCacheStats(activeWarehouse.id);
        setPendingCacheStats(stats.pending);
      } else {
        toast.error("Failed to load pending cache");
      }
    } catch (error) {
      console.error("Pending cache error:", error);
      toast.error("Failed to load pending cache");
    } finally {
      setPendingCacheLoading(false);
      setPendingCacheProgress(null);
    }
  };

  useEffect(() => {
    async function fetchExistingWSNs() {
      try {
        const res = await inboundAPI.getAllInboundWSNs();
        setExistingInboundWSNs(new Set(res.data));
      } catch (error) {
        console.error("Failed to fetch existing inbound WSNs", error);
      }
    }
    fetchExistingWSNs();
  }, []);

  // ====== AUTH CHECK ======
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push("/login");
      return;
    }
    setUser(storedUser);
  }, [router]);

  // ====== VEHICLE PERSISTENCE ======
  useEffect(() => {
    // Load multi entry vehicle number (persists until submit)
    const savedMultiVehicle = localStorage.getItem(
      "inbound_multiVehicleNumber",
    );
    if (savedMultiVehicle) {
      setCommonVehicle(savedMultiVehicle);
    }
    // Load single entry vehicle number
    const savedVehicle = localStorage.getItem("lastVehicleNumber");
    if (savedVehicle) {
      setSingleForm((prev) => ({ ...prev, vehicle_no: savedVehicle }));
    }
  }, []);

  const saveVehicleNumber = (vehicle: string) => {
    if (vehicle.trim()) {
      localStorage.setItem("lastVehicleNumber", vehicle);
    }
  };

  // ====== SAVE MULTI VEHICLE NUMBER ON BLUR (not on every keystroke) ======
  const saveMultiVehicleNumber = () => {
    if (commonVehicle.trim()) {
      localStorage.setItem("inbound_multiVehicleNumber", commonVehicle);
    }
  };

  // ====== MULTI ENTRY COLUMN WIDTHS PERSISTENCE ======
  const [multiColumnWidths, setMultiColumnWidths] = useState<
    Record<string, number>
  >({});

  // ====== LOAD COLUMN SETTINGS FROM LOCALSTORAGE ======
  useEffect(() => {
    const saved = localStorage.getItem("multiEntryColumns");

    if (saved) {
      try {
        const cols = JSON.parse(saved);
        setVisibleColumns(cols);
      } catch (e) {
        console.log("Column settings load error");
      }
    } else {
      setVisibleColumns(DEFAULT_MULTI_COLUMNS);
    }

    // Load saved column widths
    const savedWidths = localStorage.getItem("multiEntryColumnWidths");
    if (savedWidths) {
      try {
        const widths = JSON.parse(savedWidths);
        setMultiColumnWidths(widths);
        console.log("✅ Multi Entry column widths loaded:", widths);
      } catch (e) {
        console.log("Column widths load error");
      }
    }
  }, []);

  // ------------------ Draft helpers & autosave ------------------
  const draftLoadedRef = useRef(false); // Prevent autosave from overwriting draft during initial mount
  const draftLoadFailedRef = useRef(false); // Track if draft load failed (prevents empty overwrite)

  const getDraftKey = () => {
    if (!activeWarehouse?.id || !user?.id) return null;
    return `inboundMultiDraft_${activeWarehouse.id}_${user.id}`;
  };

  const saveDraftImmediate = async (rowsToSave = multiRows) => {
    if (!activeWarehouse?.id) return;
    // Don't save if draft hasn't been loaded yet (prevents empty rows overwriting real draft)
    if (!draftLoadedRef.current) return;

    // 🛡️ SAFEGUARD: Only block empty overwrite if draft load FAILED (prevents accidental data loss)
    // If load succeeded (draftLoadFailedRef = false), user intentionally cleared WSNs → allow save
    const hasAnyData = rowsToSave.some((r: any) => r.wsn?.trim());
    if (!hasAnyData && draftLoadFailedRef.current) {
      console.warn(
        "[DRAFT] 🛡️ Blocked: refusing to overwrite — draft load had failed, cannot confirm user intent",
      );
      return;
    }

    setDraftSaving(true);
    try {
      // ⚡ PRIMARY: Save to database (server-side, survives logout/browser crash)
      await inboundAPI.saveDraft(
        rowsToSave,
        activeWarehouse.id,
        commonVehicle,
        commonDate,
      );
      setDraftSavedAt(Date.now());
      setDraftExists(true);
    } catch (err) {
      console.error(
        "Failed to save draft to DB, falling back to local storage",
        err,
      );
      // ⚡ FALLBACK: Save to IndexedDB if API fails (offline/network error)
      try {
        const key = getDraftKey();
        if (key) {
          await localforage.setItem(key, {
            rows: rowsToSave,
            savedAt: Date.now(),
            version: 1,
          });
          setDraftSavedAt(Date.now());
          setDraftExists(true);
        }
      } catch (localErr) {
        console.error("Failed to save draft locally too", localErr);
      }
    } finally {
      setDraftSaving(false);
    }
  };

  // ⚡ REAL-TIME SYNC: Debounced function to send changed rows to other devices via SSE
  const flushSyncRows = useCallback(() => {
    if (!activeWarehouse?.id) return;
    if (pendingSyncRowsRef.current.size === 0) return;
    const rows = Array.from(pendingSyncRowsRef.current.entries()).map(
      ([index, data]) => ({ index, data }),
    );
    pendingSyncRowsRef.current.clear();
    inboundAPI.syncRows(rows, activeWarehouse.id).catch(() => {});
  }, [activeWarehouse?.id]);

  const queueRowSync = useCallback(
    (rowIndex: number, rowData: any) => {
      if (isSyncingRef.current) return;
      pendingSyncRowsRef.current.set(rowIndex, rowData);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(flushSyncRows, 300);
    },
    [flushSyncRows],
  );

  const clearDraft = async () => {
    if (!activeWarehouse?.id) return;
    try {
      // 1. Cancel any pending sync timeout FIRST to prevent stale data sync
      if (receivingSyncTimeoutRef.current) {
        clearTimeout(receivingSyncTimeoutRef.current);
        receivingSyncTimeoutRef.current = null;
      }

      // 2. Clear receiving WSNs from database (removes undone WSNs too)
      await clearReceivingWSNs();

      // 3. Reset the sync tracking ref so next sync starts fresh
      lastSyncedWSNsRef.current = "";

      // 4. Clear draft from DB (primary) + IndexedDB (fallback cleanup)
      try {
        await inboundAPI.clearDraft(activeWarehouse.id);
      } catch (e) {
        console.error("Failed to clear draft from DB", e);
      }
      const key = getDraftKey();
      if (key) {
        try {
          await localforage.removeItem(key);
        } catch (e) {
          /* ignore */
        }
      }
      setDraftSavedAt(null);
      setDraftExists(false);
      // Also clear vehicle number
      setCommonVehicle("");
      localStorage.removeItem("inbound_multiVehicleNumber");
      toast.success("Draft cleared");
    } catch (err) {
      console.error("Failed to clear draft", err);
    }
  };

  // ---- Sync receiving WSNs to server (for master data "Receiving" status) ----
  const syncReceivingWSNs = async (rowsToSync = multiRows) => {
    if (!activeWarehouse?.id) return;

    // ⚡ OFFLINE CHECK: Skip sync when offline
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline) {
      console.log("📴 Offline - skipping receiving WSNs sync");
      return;
    }

    // Extract valid WSNs from rows
    const wsns = rowsToSync
      .map((r: any) => r.wsn?.trim()?.toUpperCase())
      .filter((w: string) => w && w.length > 0);

    // Create a hash to compare with last synced
    const wsnsHash = JSON.stringify(wsns.sort());

    // Skip if no change
    if (wsnsHash === lastSyncedWSNsRef.current) return;

    // If all WSNs were removed but we previously had synced WSNs, clear them from DB
    if (wsns.length === 0) {
      lastSyncedWSNsRef.current = wsnsHash;
      if (hasEverSyncedWSNsRef.current) {
        hasEverSyncedWSNsRef.current = false;
        console.log(
          "🗑️ All WSNs removed from grid — clearing receiving_wsns from DB",
        );
        clearReceivingWSNs();
      }
      return;
    }

    try {
      // ⚡ Add timeout to prevent hanging (15s for large batches)
      await Promise.race([
        inboundAPI.syncReceivingWSNs(wsns, activeWarehouse.id),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 15000),
        ),
      ]);
      lastSyncedWSNsRef.current = wsnsHash;
      hasEverSyncedWSNsRef.current = true;
      console.log("📡 Synced receiving WSNs:", wsns.length);
    } catch (err) {
      console.error("Failed to sync receiving WSNs", err);
    }
  };

  const clearReceivingWSNs = async () => {
    if (!activeWarehouse?.id) return;

    // ⚡ OFFLINE CHECK: Skip clear when offline
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline) {
      console.log("📴 Offline - skipping clear receiving WSNs");
      return;
    }

    try {
      await inboundAPI.clearReceivingWSNs(activeWarehouse.id);
      lastSyncedWSNsRef.current = "";
      console.log("🧹 Cleared receiving WSNs");
    } catch (err) {
      console.error("Failed to clear receiving WSNs", err);
    }
  };

  // Load draft when warehouse/user become available
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!activeWarehouse?.id || !user?.id) {
        draftLoadedRef.current = true; // No user/warehouse → allow autosave for future
        return;
      }

      let draftRows: any[] | null = null;
      let draftSavedTime: number | null = null;
      let draftVehicle = "";
      let dbLoadSucceeded = false;
      let localLoadSucceeded = false;
      draftLoadFailedRef.current = false;

      // ⚡ PRIMARY: Try loading from database first
      try {
        const resp = await inboundAPI.loadDraft(activeWarehouse.id);
        const data = resp.data;
        if (data?.exists && data.draft?.rows && data.draft.rows.length > 0) {
          draftRows = data.draft.rows;
          draftSavedTime = data.draft.saved_at
            ? new Date(data.draft.saved_at).getTime()
            : Date.now();
          draftVehicle = data.draft.vehicle_no || "";
        }
        dbLoadSucceeded = true;
      } catch (err) {
        console.error(
          "Failed to load draft from DB, trying local fallback",
          err,
        );
      }

      // ⚡ FALLBACK: If DB had nothing, try IndexedDB (offline backup)
      if (!draftRows) {
        try {
          const key = getDraftKey();
          if (key) {
            const localDraft: any = await localforage.getItem(key);
            localLoadSucceeded = true;
            if (localDraft && localDraft.rows && localDraft.rows.length > 0) {
              draftRows = localDraft.rows;
              draftSavedTime = localDraft.savedAt || Date.now();
              // If we found local draft but DB was empty, sync it to DB
              try {
                await inboundAPI.saveDraft(
                  localDraft.rows,
                  activeWarehouse.id,
                  "",
                  "",
                );
                console.log("📤 Synced local draft to database");
              } catch (e) {
                /* ignore sync failure */
              }
            }
          } else {
            localLoadSucceeded = true; // No key but no error
          }
        } catch (err) {
          console.error("Failed to load draft from local storage", err);
        }
      } else {
        localLoadSucceeded = true; // DB had data, no need for local
      }

      // 🛡️ If BOTH DB and IndexedDB failed, mark load as failed to prevent empty overwrite
      if (!dbLoadSucceeded && !localLoadSucceeded) {
        draftLoadFailedRef.current = true;
        console.error(
          "⚠️ Draft load failed from both DB and IndexedDB — autosave will not overwrite",
        );
      }

      // Apply draft if found
      if (draftRows && draftRows.length > 0 && mounted) {
        const restored = draftRows.map((r: any, index: number) => {
          const rowId = r._rowId || `restored_${index}_${Date.now()}`;
          rowIdCounterRef.current = Math.max(
            rowIdCounterRef.current,
            index + 1,
          );
          return {
            _rowId: rowId,
            inbound_date: r.inbound_date || commonDate,
            vehicle_no: r.vehicle_no || commonVehicle,
            ...r,
          };
        });
        setMultiRows(restored);
        setDraftSavedAt(draftSavedTime || Date.now());
        setDraftExists(true);
        if (draftVehicle) {
          setCommonVehicle(draftVehicle);
        }
      }

      // ⚡ CRITICAL: Mark draft as loaded AFTER setting rows — allows autosave to start
      draftLoadedRef.current = true;
    };
    load();
    return () => {
      mounted = false;
    };
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

  // Sync receiving WSNs to server (debounced) for master data "Receiving" status
  useEffect(() => {
    // Skip if no warehouse selected
    if (!activeWarehouse?.id) return;

    const hasAnyWSN = multiRows.some((r) => r.wsn?.trim());

    // Skip initial sync when rows are empty (before user ever entered anything)
    // But allow sync if user previously had WSNs (to handle deletion from DB)
    if (!hasAnyWSN && !hasEverSyncedWSNsRef.current) return;

    // Debounce sync (longer interval than draft save)
    if (receivingSyncTimeoutRef.current)
      clearTimeout(receivingSyncTimeoutRef.current);
    receivingSyncTimeoutRef.current = setTimeout(() => {
      syncReceivingWSNs(multiRows);
    }, 1000); // 1 second debounce

    return () => {
      if (receivingSyncTimeoutRef.current)
        clearTimeout(receivingSyncTimeoutRef.current);
    };
  }, [multiRows, activeWarehouse?.id]);

  // Clear receiving WSNs on page unload
  useEffect(() => {
    const onUnload = () => {
      // Use sendBeacon for reliable unload sync
      if (activeWarehouse?.id && navigator.sendBeacon) {
        const url = `${process.env.NEXT_PUBLIC_API_URL}/api/inbound/receiving-wsns/clear`;
        const data = JSON.stringify({ warehouse_id: activeWarehouse.id });
        navigator.sendBeacon(
          url,
          new Blob([data], { type: "application/json" }),
        );
      }
    };
    window.addEventListener("unload", onUnload);
    return () => window.removeEventListener("unload", onUnload);
  }, [activeWarehouse?.id]);

  // Warn on unload if there are unsaved changes + emergency save to IndexedDB
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasData = multiRows.some((r) => r.wsn?.trim());
      if (!hasData) return;

      // ⚡ EMERGENCY SAVE: Save to IndexedDB synchronously on page unload
      // (API calls can't complete during unload, but IndexedDB can)
      const key = getDraftKey();
      if (key) {
        try {
          localforage.setItem(key, {
            rows: multiRows,
            savedAt: Date.now(),
            version: 1,
          });
        } catch (e) {
          /* best effort */
        }
      }

      if (
        !draftSavedAt ||
        (lastChangeAtRef.current && draftSavedAt < lastChangeAtRef.current)
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [multiRows, draftSavedAt]);

  // Add this useEffect after loadCategories function (around line 450)
  useEffect(() => {
    if (currentTabCode !== "multi") return;
    const t = setTimeout(() => {
      try {
        const colApi = columnApiRef.current;
        const api = gridRef.current;
        if (!colApi || !api) return;
        const allCols = colApi.getAllColumns
          ? colApi.getAllColumns().map((c: any) => c.getColId())
          : [];
        if (!allCols || allCols.length === 0) return;
        colApi.autoSizeColumns(allCols, false);
        let total = 0;
        for (const id of allCols) {
          const col = colApi.getColumn(id);
          total += col?.getActualWidth ? col.getActualWidth() : 0;
        }
        const dims = api.getSize
          ? api.getSize()
          : api.gridPanel &&
            api.gridPanel.getBodyClientRect &&
            api.gridPanel.getBodyClientRect();
        const gridW = dims?.width || 0;
        if (gridW && total < gridW) api.sizeColumnsToFit();
      } catch (e) {
        /* ignore */
      }
    }, 50);
    return () => clearTimeout(t);
  }, [tabValue, visibleColumns]);

  useEffect(() => {
    if (brandFilter) {
      // Filter categories based on selected brand
      const filtered = listData
        .filter((item) => item.brand === brandFilter)
        .map((item) => item.cms_vertical)
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
        .filter((item) => item.cms_vertical === categoryFilter)
        .map((item) => item.brand)
        .filter((v, i, a) => v && a.indexOf(v) === i); // unique values
      setFilteredBrands(filtered);
    } else {
      setFilteredBrands(brands);
    }
  }, [categoryFilter, listData, brands]);

  // ====== SAVE PRINT TOGGLE SETTINGS ======
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "inbound_singlePrintEnabled",
        String(singlePrintEnabled),
      );
    }
  }, [singlePrintEnabled]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "inbound_multiPrintEnabled",
        String(multiPrintEnabled),
      );
    }
  }, [multiPrintEnabled]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "inbound_ctrlPPrintEnabled",
        String(ctrlPPrintEnabled),
      );
    }
  }, [ctrlPPrintEnabled]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "inbound_ctrlOProductLinkEnabled",
        String(ctrlOProductLinkEnabled),
      );
    }
  }, [ctrlOProductLinkEnabled]);

  // ====== KEEP multiRowsRef IN SYNC WITH multiRows STATE ======
  useEffect(() => {
    multiRowsRef.current = multiRows;
  }, [multiRows]);

  // ====== CUSTOM PASTE HANDLER (AG Grid Community has no ClipboardModule) ======
  useEffect(() => {
    if (!isOnMultiTab) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const api = gridRef.current;
      if (!api) return;

      // If a cell is being edited (input active), let browser handle paste natively
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      )
        return;

      // Only handle if grid has a focused cell
      const focusedCell = api.getFocusedCell();
      if (!focusedCell) return;

      // Only handle if focus is within the grid container
      const container = multiGridBoxRef.current;
      if (container && activeEl && !container.contains(activeEl)) return;

      const text = e.clipboardData?.getData("text/plain");
      if (!text?.trim()) return;

      e.preventDefault();
      e.stopPropagation();

      isPastingRef.current = true;

      const startRow = focusedCell.rowIndex;
      const startColId = focusedCell.column.getColId();

      // Parse clipboard: rows by newlines, columns by tabs
      const clipRows = text.split(/\r?\n/).filter((r) => r.length > 0);
      const allColumns = api.getAllDisplayedColumns();
      const startColIndex = allColumns.findIndex(
        (c: any) => c.getColId() === startColId,
      );
      if (startColIndex < 0) {
        isPastingRef.current = false;
        return;
      }

      const pastedWSNCells: { rowIndex: number; wsn: string }[] = [];
      const lastPasteRow = startRow + clipRows.length - 1;

      // ⚡ SNAPSHOT rows BEFORE paste for undo
      const prevSnapshot = multiRowsRef.current;
      const oldRowsSnapshot = prevSnapshot
        .slice(startRow, lastPasteRow + 1)
        .map((r) => ({ ...r }));

      // Apply all pasted values in ONE state update
      setMultiRows((prev) => {
        let newRows = [...prev];

        // Auto-extend rows if needed
        if (lastPasteRow >= newRows.length) {
          const extraNeeded = lastPasteRow - newRows.length + 1 + 50;
          for (let x = 0; x < extraNeeded; x++) {
            newRows.push({
              _rowId: `row-${newRows.length + x}-${Date.now()}`,
              wsn: "",
              product_serial_number: "",
              rack_no: "",
              unload_remarks: "",
              inbound_date: new Date().toISOString().split("T")[0],
            });
          }
        }

        clipRows.forEach((clipRow, i) => {
          const rowIdx = startRow + i;
          if (rowIdx >= newRows.length) return;
          const cells = clipRow.split("\t");
          cells.forEach((cellValue, j) => {
            const colIndex = startColIndex + j;
            if (colIndex >= allColumns.length) return;
            const colId = allColumns[colIndex].getColId();
            if (!EDITABLE_COLUMNS.includes(colId)) return;
            const val = cellValue?.trim() ? cellValue.trim().toUpperCase() : "";
            newRows[rowIdx] = { ...newRows[rowIdx], [colId]: val };
            if (colId === "wsn" && val) {
              pastedWSNCells.push({ rowIndex: rowIdx, wsn: val });
            }
          });
        });

        return newRows;
      });

      toast.success(
        `Pasted ${clipRows.length} row${clipRows.length > 1 ? "s" : ""} — checking duplicates & loading data...`,
        { duration: 2500 },
      );

      // ⚡ COMPREHENSIVE DUPLICATE CHECK for pasted WSNs
      if (pastedWSNCells.length > 0) {
        const uniqueWSNs = Array.from(
          new Set(pastedWSNCells.map((c) => c.wsn)),
        );

        // 1) GRID DUPLICATES: Check against existing grid rows + within paste itself
        const gridRows = multiRowsRef.current;
        const wsnCountMap = new Map<string, number>();
        gridRows.forEach((r) => {
          const w = r.wsn?.trim()?.toUpperCase();
          if (w) wsnCountMap.set(w, (wsnCountMap.get(w) || 0) + 1);
        });
        const gridDupWSNs = new Set<string>();
        uniqueWSNs.forEach((wsn) => {
          if ((wsnCountMap.get(wsn) || 0) > 1) gridDupWSNs.add(wsn);
        });

        // 2) ALREADY INBOUNDED + CROSS WAREHOUSE: Single bulk API check (replaces N individual calls)
        const alreadyInboundedWSNs = new Set<string>();
        const crossWarehouseDetected = new Set<string>();
        const isOnline =
          typeof navigator !== "undefined" ? navigator.onLine : true;

        if (isOnline && activeWarehouse?.id) {
          try {
            const resp = await Promise.race([
              inboundAPI.bulkCheckWSNs(uniqueWSNs, activeWarehouse.id),
              new Promise<null>((resolve) =>
                setTimeout(() => resolve(null), 10000),
              ),
            ]);
            if (resp?.data) {
              (resp.data.alreadyInbounded || []).forEach((wsn: string) =>
                alreadyInboundedWSNs.add(wsn),
              );
              (resp.data.crossWarehouse || []).forEach((wsn: string) =>
                crossWarehouseDetected.add(wsn),
              );
            }
          } catch (err) {
            console.error(
              "Bulk WSN check failed, skipping duplicate detection:",
              err,
            );
          }
        }

        // 3) Combine all problematic WSNs
        const allProblematicArr: string[] = [];
        gridDupWSNs.forEach((w) => allProblematicArr.push(w));
        alreadyInboundedWSNs.forEach((w) => allProblematicArr.push(w));
        crossWarehouseDetected.forEach((w) => allProblematicArr.push(w));
        const allProblematic = new Set(allProblematicArr);

        // 4) Clear problematic rows AND apply master data in one state update
        // First, do master data lookup for valid WSNs
        const validPastedCells = pastedWSNCells.filter(
          (c) => !allProblematic.has(c.wsn),
        );
        const validUniqueWSNs = Array.from(
          new Set(validPastedCells.map((c) => c.wsn)),
        );
        const LOOKUP_BATCH = 50;
        const masterDataMap = new Map<string, any>();

        if (validUniqueWSNs.length > 0) {
          for (let i = 0; i < validUniqueWSNs.length; i += LOOKUP_BATCH) {
            const batch = validUniqueWSNs.slice(i, i + LOOKUP_BATCH);
            const results = await Promise.allSettled(
              batch.map(async (wsn) => {
                try {
                  if (isWMSCacheEnabled() && activeWarehouse?.id) {
                    const pendingData = await getPendingByWSNFast(
                      wsn,
                      activeWarehouse.id,
                    );
                    if (pendingData) return { wsn, data: pendingData };
                  }
                  const data = await getLocalMasterData(wsn).catch(() => null);
                  return { wsn, data };
                } catch {
                  return { wsn, data: null };
                }
              }),
            );
            results.forEach((result) => {
              if (result.status === "fulfilled" && result.value.data) {
                masterDataMap.set(result.value.wsn, result.value.data);
              }
            });
          }
        }

        // Single combined state update: remove problematic + apply master data
        setMultiRows((prev) => {
          const updated = [...prev];

          // Clear problematic WSNs
          if (allProblematic.size > 0) {
            pastedWSNCells.forEach(({ rowIndex: rIdx, wsn }) => {
              if (allProblematic.has(wsn) && rIdx < updated.length) {
                updated[rIdx] = { ...updated[rIdx], wsn: "" };
                ALL_MASTER_COLUMNS.forEach((col) => {
                  updated[rIdx][col] = null;
                });
              }
            });
          }

          // Apply master data for valid WSNs, clear WSNs without master data
          const noMasterDataWSNs = new Set<string>();
          validPastedCells.forEach(({ rowIndex: rIdx, wsn }) => {
            if (rIdx < updated.length) {
              const masterInfo = masterDataMap.get(wsn);
              if (masterInfo) {
                updated[rIdx] = { ...updated[rIdx] };
                ALL_MASTER_COLUMNS.forEach((col) => {
                  updated[rIdx][col] = masterInfo[col] || null;
                });
              } else {
                // ✅ WSN not found in master data — clear it
                noMasterDataWSNs.add(wsn);
                updated[rIdx] = { ...updated[rIdx], wsn: "" };
                ALL_MASTER_COLUMNS.forEach((col) => {
                  updated[rIdx][col] = null;
                });
              }
            }
          });

          return updated;
        });

        // Show summary messages
        if (allProblematic.size > 0) {
          const msgs: string[] = [];
          if (gridDupWSNs.size > 0)
            msgs.push(`${gridDupWSNs.size} duplicate in grid`);
          if (alreadyInboundedWSNs.size > 0)
            msgs.push(`${alreadyInboundedWSNs.size} already inbounded`);
          if (crossWarehouseDetected.size > 0)
            msgs.push(`${crossWarehouseDetected.size} cross-warehouse`);
          toast.error(`Removed: ${msgs.join(", ")}`, {
            duration: 5000,
            style: { fontWeight: 600, fontSize: "14px" },
          });
        }

        if (validUniqueWSNs.length > 0) {
          const found = masterDataMap.size;
          const notFound = validUniqueWSNs.length - found;
          if (notFound > 0) {
            toast.error(
              `${notFound} WSN(s) not found in master data — removed from grid. Upload product data first.`,
              {
                duration: 6000,
                style: { fontWeight: 600, fontSize: "14px" },
                icon: "❌",
              },
            );
          } else if (found > 0) {
            toast.success(
              `Master data loaded for ${found} WSN${found > 1 ? "s" : ""}`,
              { duration: 2000 },
            );
          }
        }

        // 6) Run full duplicate check to update UI state (grid highlights etc)
        setTimeout(() => {
          checkDuplicates(multiRowsRef.current);
        }, 300);

        // 7) SAVE BATCH UNDO ACTION — snapshot rows AFTER all changes
        setTimeout(() => {
          const newRowsSnapshot = multiRowsRef.current
            .slice(startRow, lastPasteRow + 1)
            .map((r) => ({ ...r }));
          const pasteUndoAction: UndoAction = {
            type: "paste",
            rowIndex: startRow,
            field: "wsn",
            oldValue: null,
            newValue: null,
            pasteData: {
              startRow,
              endRow: lastPasteRow,
              oldRows: oldRowsSnapshot,
              newRows: newRowsSnapshot,
            },
          };
          undoStackRef.current.push(pasteUndoAction);
          if (undoStackRef.current.length > MAX_UNDO_HISTORY)
            undoStackRef.current.shift();
          redoStackRef.current = [];
        }, 500);

        // Refresh grid
        setTimeout(() => {
          if (api) api.refreshCells({ force: true });
        }, 350);
      } else {
        // No WSN cells pasted — just non-WSN columns
        toast.success(
          `Pasted ${clipRows.length} row${clipRows.length > 1 ? "s" : ""} successfully`,
          { duration: 1500 },
        );
        setTimeout(() => {
          if (api) api.refreshCells({ force: true });
        }, 100);
      }

      isPastingRef.current = false;
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnMultiTab, activeWarehouse?.id]);

  // ====== PRINT AGENT CHECK ======
  useEffect(() => {
    const checkAgent = async () => {
      const running = await isAgentRunning();
      setAgentReady(running);
      if (running) {
        console.log("✅ Print Agent is ready");
      } else {
        console.warn("⚠️ Print Agent not detected - printing will not work");
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
    localStorage.setItem("multiEntryColumns", JSON.stringify(cols));
    //toast.success('✓ Columns saved');
  };

  const saveListColumnSettings = (cols: string[]) => {
    setListColumns(cols);
    localStorage.setItem("inboundListColumns", JSON.stringify(cols));

    // Use ag-Grid API to toggle column visibility WITHOUT rebuilding columnDefs
    // This preserves column order
    const api = listGridRef.current;
    if (api) {
      // Get all columns and set visibility based on `cols` array
      const allColIds = api.getColumns()?.map((c: any) => c.getColId()) || [];
      allColIds.forEach((colId: string) => {
        if (colId === "__sr") return; // SR column always visible
        const shouldShow = cols.includes(colId);
        api.setColumnsVisible([colId], shouldShow);
      });
      // Save the updated state
      try {
        const state = api.getColumnState();
        localStorage.setItem("inbound_list_grid_state", JSON.stringify(state));
      } catch {
        /* ignore */
      }
    }
  };

  // Date formatter (stable) — moved before column defs to avoid "used before declaration" errors
  const formatInboundDate = useCallback((dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";

    const day = String(d.getDate()).padStart(2, "0");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const mon = months[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${day}-${mon}-${yyyy}`; // 01-Dec-2025 (DD-MMM-YYYY)
  }, []);

  // -------- AG Grid helpers for Inbound List (keeps behavior same as table) --------
  // ALL possible columns for the list grid - define once, never rebuild
  const ALL_LIST_COLUMNS = useMemo(
    () => [
      ...INBOUND_LIST_COLUMNS,
      ...ALL_MASTER_COLUMNS.filter((c) => !INBOUND_LIST_COLUMNS.includes(c)),
    ],
    [],
  );

  const inboundColumnDefs = useMemo(() => {
    const srCol = {
      headerName: "SR.NO",
      field: "__sr",
      // Use context for page/limit to avoid recreating column defs on pagination
      valueGetter: (params: any) => {
        if (!params.node) return undefined;
        const ctx = params.context || {};
        const currentPage = ctx.page || 1;
        const currentLimit = ctx.limit || 100;
        return params.node.rowIndex + 1 + (currentPage - 1) * currentLimit;
      },
      width: 20,
      cellStyle: {
        fontWeight: 700,
        textAlign: "center",
        color: isDarkMode ? "#94a3b8" : "#64748b",
      },
      suppressMovable: true,
      sortable: false,
      filter: false,
    };

    // Include ALL columns with hide property - columnDefs structure never changes
    const cols = ALL_LIST_COLUMNS.map((col: string) => {
      const isDate = col.includes("date");
      const headerName = col.replace(/_/g, " ").toUpperCase();

      const base: any = {
        field: col,
        headerName,
        minWidth: col === "product_title" ? 240 : col === "brand" ? 120 : 120,
        flex: col === "product_title" ? 1.5 : 1,
        hide: false, // Start visible, ag-Grid state will control visibility
      };

      if (isDate)
        base.valueFormatter = (params: any) => formatInboundDate(params.value);
      return base;
    });

    // "Outbound in Process" status column — shows badge when WSN is in someone's outbound multi-entry grid
    const statusCol = {
      headerName: "STATUS",
      field: "outbound_in_process",
      width: 160,
      minWidth: 140,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        if (params.value) {
          return React.createElement(
            "span",
            {
              style: {
                background: "#f59e0b",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 600,
                whiteSpace: "nowrap",
              },
            },
            "Outbound in Process",
          );
        }
        if (params.data?.dispatched) {
          return React.createElement(
            "span",
            {
              style: {
                background: "#22c55e",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 600,
                whiteSpace: "nowrap",
              },
            },
            "Dispatched",
          );
        }
        return React.createElement(
          "span",
          {
            style: {
              color: "#94a3b8",
              fontSize: "11px",
            },
          },
          "Available",
        );
      },
    };

    return [srCol, statusCol, ...cols];
  }, [ALL_LIST_COLUMNS, formatInboundDate, isDarkMode]);

  const inboundDefaultColDef = useMemo(
    () => ({
      sortable: gridSettings.sortable,
      filter: gridSettings.filter,
      resizable: gridSettings.resizable,
      editable: false,
      suppressMovable: true,
      cellStyle: {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
    }),
    [gridSettings],
  );

  // Autosize / overlays when data or loading state changes
  useEffect(() => {
    // We avoid showing the loading overlay directly here to prevent flicker.
    // However, when not loading we still need to show NoRows overlay if appropriate.
    const api = gridRef.current;
    if (!api) return;

    if (!listLoading) {
      if (!listData || listData.length === 0) api.showNoRowsOverlay();
      else api.hideOverlay();
    }
  }, [listLoading, listData]);

  // NOTE: No longer need to re-apply column state on columnDefs change
  // because columnDefs structure is now STABLE (includes ALL columns with hide property)
  // Column visibility is controlled via setColumnsVisible() API which preserves order

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
      statusFilter,
    });
  }, [
    activeWarehouse?.id,
    page,
    limit,
    searchFilter,
    brandFilter,
    categoryFilter,
    dateFromFilter,
    dateToFilter,
    statusFilter,
  ]);

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
      statusFilter,
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
        statusFilter,
      });
      const rows = response.data?.data || [];
      pageCacheRef.current.set(nextPageCacheKey, {
        data: rows,
        total: response.data?.total || 0,
        timestamp: Date.now(),
      });
    } catch {
      /* Silently fail - prefetch is optional */
    }
  }, [
    activeWarehouse?.id,
    page,
    limit,
    total,
    searchFilter,
    brandFilter,
    categoryFilter,
    dateFromFilter,
    dateToFilter,
    statusFilter,
  ]);

  const loadInboundList = useCallback(
    async ({ buttonRefresh = false } = {}) => {
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
          setDataResponseReceived(true);
          // Keep spinner visible briefly for consistent UX during filter reset
          setTimeout(() => setListLoading(false), 300);
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
          } catch (err) {}
          overlayTimerRef.current = null;
        }, SHOW_OVERLAY_DELAY);
      }

      try {
        // Cancel previous in-flight load to avoid out-of-order responses and flicker
        if (listAbortControllerRef.current) {
          try {
            listAbortControllerRef.current.abort();
          } catch (err) {}
          listAbortControllerRef.current = null;
        }

        const controller = new AbortController();
        listAbortControllerRef.current = controller;

        const response = await inboundAPI.getAll(
          page,
          limit,
          {
            warehouseId: activeWarehouse?.id,
            search: searchFilter,
            brand: brandFilter,
            category: categoryFilter,
            dateFrom: dateFromFilter,
            dateTo: dateToFilter,
            statusFilter,
          },
          { signal: controller.signal },
        );

        // Only apply if this is the latest load
        if (loadId === currentLoadIdRef.current) {
          const rows = response.data.data;
          const totalCount = response.data.total;
          setListData(rows);
          setTotal(totalCount);
          setDataResponseReceived(true); // Mark that we've received actual data response

          // ⚡ WINDOW CACHE: Store in window for instant navigation (survives component unmount)
          if (typeof window !== "undefined" && rows && rows.length > 0) {
            window.__INBOUND_LIST_CACHE__ = {
              data: rows,
              total: totalCount,
              timestamp: Date.now(),
              warehouseId: activeWarehouse?.id,
            };
            try {
              sessionStorage.setItem(
                "inbound_list_cache",
                JSON.stringify(rows),
              );
              sessionStorage.setItem(
                "inbound_list_cache_warehouseId",
                String(activeWarehouse?.id || ""),
              );
            } catch {
              /* ignore quota errors */
            }
          }

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
            toast.success("✓ List refreshed");
            setRefreshSuccess(true);
            setTimeout(() => setRefreshSuccess(false), 1800);
          }
        } else {
          // stale response, ignore
          return;
        }
      } catch (error: any) {
        // Ignore aborted requests
        if (error?.code === "ERR_CANCELED") {
          return;
        }

        // Only show errors for latest request
        if (loadId === currentLoadIdRef.current) {
          console.error("Load error:", error);
          const status = error?.response?.status;
          const msg = error?.response?.data?.error || "Failed to load list";
          if (status === 401) {
            toast.error("Not authenticated — redirecting to login");
            if (typeof window !== "undefined") {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              document.cookie =
                "wms_auth_token=; path=/; max-age=0; SameSite=Lax";
            }
            router.push("/login");
          } else {
            // ⚡ AUTO-RETRY: Retry on network errors (max 2 times)
            if (retryCountRef.current < MAX_RETRIES && !buttonRefresh) {
              retryCountRef.current += 1;
              const delay = Math.pow(2, retryCountRef.current) * 500;
              setTimeout(
                () => loadInboundList({ buttonRefresh: false }),
                delay,
              );
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
              await new Promise((res) =>
                setTimeout(res, MIN_LOADING_MS - overlayElapsed),
              );
            }

            try {
              setTopLoading(false);
            } catch (err) {}
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
        // Always ensure loading state is cleared to prevent infinite spinner
        setListLoading(false);
        setRefreshing(false);
      }
    },
    [
      activeWarehouse?.id,
      page,
      limit,
      searchFilter,
      brandFilter,
      categoryFilter,
      dateFromFilter,
      dateToFilter,
      statusFilter,
      router,
      getCacheKey,
      prefetchNextPage,
    ],
  );

  const loadBrands = useCallback(async () => {
    try {
      const response = await inboundAPI.getBrands(activeWarehouse?.id);
      setBrands(response.data || []);
    } catch (error) {
      console.log("Brands error");
      setBrands([]);
    }
  }, [activeWarehouse?.id]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await inboundAPI.getCategories(activeWarehouse?.id);
      setCategories(response.data || []);
    } catch (error) {
      console.log("Categories error");
      setCategories([]);
    }
  }, [activeWarehouse?.id]);

  const loadBatches = useCallback(async () => {
    setBatchLoading(true);
    try {
      const response = await inboundAPI.getBatches(
        activeWarehouse?.id?.toString(),
      );
      // Format last_updated date for display (20-Jan-2026 format)
      const formattedBatches = (response.data || []).map((batch: any) => {
        let dateDisplay = "-";
        if (batch.last_updated) {
          try {
            const d = new Date(batch.last_updated);
            if (!isNaN(d.getTime())) {
              const day = String(d.getDate()).padStart(2, "0");
              const months = [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ];
              const mon = months[d.getMonth()];
              const yyyy = d.getFullYear();
              dateDisplay = `${day}-${mon}-${yyyy}`;
            }
          } catch {
            /* fallback to '-' */
          }
        }
        return {
          ...batch,
          lastupdated_display: dateDisplay,
        };
      });
      setBatches(formattedBatches);
    } catch (error) {
      console.error("Batches error");
    } finally {
      setBatchLoading(false);
    }
  }, [activeWarehouse?.id]);

  const loadRacks = useCallback(async () => {
    try {
      const response = await inboundAPI.getWarehouseRacks(activeWarehouse?.id);
      setRacks(response.data);
    } catch (error) {
      console.error("Failed to load racks");
    }
  }, [activeWarehouse?.id]);

  // ====== LOAD DATA ON TAB CHANGE ======
  const currentTabCode = visibleTabCodes[tabValue];

  useEffect(() => {
    if (
      activeWarehouse &&
      (currentTabCode === "list" || currentTabCode === "single")
    ) {
      loadRacks();
      loadBatches();
      loadBrands();
      loadCategories();
      if (currentTabCode === "list") loadInboundList();
    }
  }, [
    activeWarehouse,
    currentTabCode,
    loadRacks,
    loadBatches,
    loadBrands,
    loadCategories,
    loadInboundList,
  ]);

  useEffect(() => {
    if (activeWarehouse && currentTabCode === "list") {
      // ✅ Reduced debounce (100ms) since search already debounces 350ms
      if (listLoadDebounceRef.current)
        clearTimeout(listLoadDebounceRef.current);
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
  }, [
    activeWarehouse,
    tabValue,
    page,
    limit,
    searchFilter,
    brandFilter,
    categoryFilter,
    dateFromFilter,
    dateToFilter,
    statusFilter,
    loadInboundList,
  ]);

  // ====== GET PRINTING SETTINGS ======
  const getPrintingSettings = async () => {
    try {
      const response = await fetch("http://127.0.0.1:9100/config", {
        method: "GET",
        mode: "cors",
      });

      if (response.ok) {
        const data = await response.json();
        return data.config;
      }
    } catch (err) {
      console.warn("⚠️ Could not fetch printing settings");
    }

    return null;
  };

  // ====== PRINTING FUNCTION ======

  const triggerPrint = async (wsn: string, masterData?: any) => {
    if (!agentReady) {
      console.warn("⚠️ Print agent not available");
      return;
    }

    try {
      // Get printing settings from agent
      const settings = await getPrintingSettings();

      // CHECK: Is printing enabled?
      if (settings && !settings.printingEnabled) {
        console.log("⏸️ Printing disabled in settings - skipping print");
        return;
      }

      // Ensure WSN is always uppercase for printing
      const wsnUpper = wsn.toUpperCase();
      console.log(`🖨️ Printing WSN: ${wsnUpper}`);

      // Get copy count from settings (fallback to 1)
      const copies = 1;

      const success = await printLabel({
        wsn: wsnUpper,
        product_title: masterData?.product_title || "",
        brand: masterData?.brand || "",
        mrp: masterData?.mrp || "",
        fsp: masterData?.fsp || "",
        fsn: masterData?.fsn || masterData?.fsn_code || "",
        wid: masterData?.wid || "",
        product_serial_number: masterData?.product_serial_number || "",
        copies: copies,
      });

      if (success) {
        console.log(`✅ Print sent successfully (${copies} copies)`);
      } else {
        console.warn("⚠️ Print failed - but entry was created");
      }
    } catch (err) {
      console.error("❌ Print error:", err);
      // Don't throw - allow entry creation even if print fails
    }
  };

  // ====== PRINT ROW FUNCTION (for manual print button) ======
  const printRowWSN = useCallback(
    async (rowData: any) => {
      if (!rowData?.wsn?.trim()) {
        toast.error("No WSN to print");
        return;
      }

      if (!agentReady) {
        toast.error("Print agent not available");
        return;
      }

      const wsnUpper = rowData.wsn.trim().toUpperCase();

      try {
        const printPayload = {
          wsn: wsnUpper,
          fsn: rowData.fsn || "",
          wid: rowData.wid || "",
          product_title: rowData.product_title || "",
          brand: rowData.brand || "",
          mrp: rowData.mrp || "",
          fsp: rowData.fsp || "",
          copies: 1,
        };

        const printSuccess = await printLabel(printPayload);

        if (printSuccess) {
          toast.success(`✓ Label printed: ${wsnUpper}`, { duration: 2000 });
        } else {
          toast.error("Print failed");
        }
      } catch (err: any) {
        toast.error(`Print error: ${err.message}`);
      }
    },
    [agentReady],
  );

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
        try {
          listAbortControllerRef.current.abort();
        } catch (err) {}
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

      // ⚡ TRY PENDING CACHE FIRST (ultra-fast memory + IndexedDB)
      if (isWMSCacheEnabled() && activeWarehouse?.id) {
        const pendingData = await getPendingByWSNFast(
          wsnUpper,
          activeWarehouse.id,
        );
        if (pendingData) {
          setMasterData(pendingData);
          setDuplicateWSN(null);
          return;
        }
      }

      // ⚡ FALLBACK: Use old batch cache
      const data = await getLocalMasterData(wsnUpper);
      if (data) {
        setMasterData(data);
        setDuplicateWSN(null);
      } else {
        toast.error("WSN not found in master data");
        setMasterData(null);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast.error("WSN not found in master data");
        setMasterData(null);
      } else {
        console.error("Error fetching master data:", error);
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

      // ⚡ TRY PENDING CACHE FIRST (ultra-fast memory + IndexedDB)
      if (isWMSCacheEnabled() && activeWarehouse?.id) {
        const pendingData = await getPendingByWSNFast(
          wsnUpper,
          activeWarehouse.id,
        );
        if (pendingData) {
          setMasterData(pendingData);
          setDuplicateWSN(null);
          return;
        }
      }

      // ⚡ FALLBACK: Use old batch cache
      const data = await getLocalMasterData(wsnUpper);
      if (data) {
        setMasterData(data);
        setDuplicateWSN(null);
      } else {
        setMasterData(null);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Don't show toast for auto-fetch, only on blur
        console.log("WSN not found:", wsn);
        setMasterData(null);
      }
    }
  };

  // ====== SINGLE ENTRY SUBMIT ======
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!singleWSN.trim()) {
      toast.error("WSN is required");
      return;
    }

    // ✅ Block submit if master data not found for this WSN
    if (!masterData) {
      toast.error(
        "WSN not found in master data. Upload product data first before inbounding.",
        {
          duration: 5000,
          icon: "❌",
        },
      );
      return;
    }

    // ⚡ OFFLINE CHECK: Prevent submit when offline
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline) {
      toast.error(
        "Cannot submit while offline. Please try again when connected.",
        {
          duration: 4000,
          icon: "📴",
        },
      );
      return;
    }

    if (!singleForm.vehicle_no?.trim()) {
      toast.error("Vehicle number is required");
      return;
    }

    setSingleLoading(true);
    try {
      const response = await inboundAPI.createSingle({
        wsn: singleWSN,
        ...singleForm,
        rack_no: singleForm.rack_no || "Staging", // ✅ Auto-fill Staging
        warehouse_id: activeWarehouse?.id,
        created_by: user?.id,
      });

      if (response.data.action === "created") {
        toast.success("✓ Inbound entry created successfully!");
        saveVehicleNumber(singleForm.vehicle_no);

        // Trigger print if agent is ready AND print is enabled
        if (singlePrintEnabled && agentReady && masterData) {
          await triggerPrint(singleWSN, masterData);
        }

        setSingleWSN("");
      } else if (response.data.action === "updated") {
        toast.success("✓ Inbound entry updated successfully!");
        saveVehicleNumber(singleForm.vehicle_no);
      }

      setSingleWSN("");
      setMasterData(null);
      setDuplicateWSN(null);
      setSingleForm({
        inbound_date: new Date().toISOString().split("T")[0],
        vehicle_no: singleForm.vehicle_no,
        product_serial_number: "",
        rack_no: "",
        unload_remarks: "",
      });
      loadInboundList();
    } catch (error: any) {
      if (error.response?.status === 409) {
        setDuplicateWSN(error.response.data);
        toast.error('Duplicate WSN - Click "Update" to modify');
      } else if (error.response?.status === 403) {
        toast.error(`❌ ${error.response.data.error}`);
      } else {
        toast.error(error.response?.data?.error || "Failed to create entry");
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
        created_by: user?.id, // ✅ ISSUE #8
      });

      toast.success("✓ Updated successfully!");
      setSingleWSN("");
      setMasterData(null);
      setDuplicateWSN(null);
      setSingleForm({
        inbound_date: new Date().toISOString().split("T")[0],
        vehicle_no: singleForm.vehicle_no,
        product_serial_number: "",
        rack_no: "",
        unload_remarks: "",
      });
      loadInboundList();
    } catch (error: any) {
      toast.error("Failed to update");
    } finally {
      setSingleLoading(false);
    }
  };

  // ====== BULK UPLOAD FUNCTIONS ======
  const downloadTemplate = async () => {
    // ⚡ OPTIMIZED: Load XLSX dynamically
    const XLSX = await import("xlsx");

    const template = [
      {
        WSN: "ABC123_A",
        VEHICLE_NO: "PB04AA1234",
        PRODUCT_SERIAL_NUMBER: "ABCDE12345",
        UNLOAD_REMARKS: "Brand Box missing",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Bulk_Inbound_Template.xlsx");
    toast.success("✓ Template downloaded");
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
    setHighlightedRows((prev) => {
      const newSet = new Set(Array.from(prev));
      newSet.add(rowIndex);
      return newSet;
    });

    // Remove highlight after duration
    const timeout = setTimeout(() => {
      setHighlightedRows((prev) => {
        const newSet = new Set(prev);
        newSet.delete(rowIndex);
        return newSet;
      });
      highlightTimeoutRefs.current.delete(rowIndex);
    }, duration);

    highlightTimeoutRefs.current.set(rowIndex, timeout);
  }, []);

  // ✅ EXCEL-LIKE: Save cell change for undo (cell-level, not full grid)
  const saveCellUndoAction = useCallback(
    (
      rowIndex: number,
      field: string,
      oldValue: any,
      newValue: any,
      oldRowData?: any,
      newRowData?: any,
    ) => {
      const action: UndoAction = {
        type: "cell",
        rowIndex,
        field,
        oldValue,
        newValue,
        oldRowData: oldRowData ? { ...oldRowData } : undefined,
        newRowData: newRowData ? { ...newRowData } : undefined,
      };
      undoStackRef.current.push(action);
      if (undoStackRef.current.length > MAX_UNDO_HISTORY) {
        undoStackRef.current.shift();
      }
      // Clear redo stack when new action is performed
      redoStackRef.current = [];
    },
    [],
  );

  // ✅ EXCEL-LIKE: Undo last change (Ctrl+Z) - cell level + batch paste
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) {
      toast("Nothing to undo", { icon: "ℹ️", duration: 500 });
      return;
    }

    const action = undoStackRef.current.pop()!;

    // ⚡ BATCH PASTE UNDO: Restore all affected rows in one shot
    if (action.type === "paste" && action.pasteData) {
      const {
        startRow,
        endRow,
        oldRows,
        newRows: pasteNewRows,
      } = action.pasteData;

      setMultiRows((currentRows) => {
        const updated = [...currentRows];
        // Snapshot current state for redo
        const currentSnapshot = updated
          .slice(startRow, endRow + 1)
          .map((r) => ({ ...r }));

        // Restore old rows
        oldRows.forEach((oldRow, i) => {
          const idx = startRow + i;
          if (idx < updated.length) {
            updated[idx] = { ...oldRow };
          }
        });

        // Save redo action
        redoStackRef.current.push({
          ...action,
          pasteData: {
            startRow,
            endRow,
            oldRows: currentSnapshot,
            newRows: oldRows,
          },
        });

        return updated;
      });

      // Re-check duplicates after undo
      setTimeout(() => checkDuplicates(multiRowsRef.current), 100);

      setTimeout(() => {
        const api = gridRef.current;
        if (api) {
          api.ensureIndexVisible(startRow, "middle");
          api.setFocusedCell(startRow, "wsn");
          api.refreshCells({ force: true });
        }
      }, 50);

      const count = endRow - startRow + 1;
      toast.success(
        `Undo paste: ${count} row${count > 1 ? "s" : ""} restored`,
        { duration: 2000 },
      );
      return;
    }

    // CELL-LEVEL UNDO
    setMultiRows((currentRows) => {
      const newRows = [...currentRows];
      const currentRowData = { ...newRows[action.rowIndex] };

      if (action.type === "cell") {
        if (action.oldRowData) {
          newRows[action.rowIndex] = { ...action.oldRowData };
        } else {
          newRows[action.rowIndex] = {
            ...newRows[action.rowIndex],
            [action.field]: action.oldValue,
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
        api.ensureIndexVisible(action.rowIndex, "middle");
        api.setFocusedCell(action.rowIndex, action.field);
      }
    }, 50);

    toast.success("Undo successful", { duration: 1500 });
  }, []);

  // ✅ EXCEL-LIKE: Redo last undone change (Ctrl+Y) - cell level + batch paste
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) {
      toast("Nothing to redo", { icon: "ℹ️", duration: 1500 });
      return;
    }

    const action = redoStackRef.current.pop()!;

    // ⚡ BATCH PASTE REDO: Re-apply all pasted rows
    if (action.type === "paste" && action.pasteData) {
      const { startRow, endRow, oldRows } = action.pasteData;

      setMultiRows((currentRows) => {
        const updated = [...currentRows];
        const currentSnapshot = updated
          .slice(startRow, endRow + 1)
          .map((r) => ({ ...r }));

        oldRows.forEach((row, i) => {
          const idx = startRow + i;
          if (idx < updated.length) {
            updated[idx] = { ...row };
          }
        });

        undoStackRef.current.push({
          ...action,
          pasteData: {
            startRow,
            endRow,
            oldRows: currentSnapshot,
            newRows: oldRows,
          },
        });

        return updated;
      });

      setTimeout(() => checkDuplicates(multiRowsRef.current), 100);
      setTimeout(() => {
        const api = gridRef.current;
        if (api) {
          api.ensureIndexVisible(startRow, "middle");
          api.setFocusedCell(startRow, "wsn");
          api.refreshCells({ force: true });
        }
      }, 50);

      const count = endRow - startRow + 1;
      toast.success(
        `Redo paste: ${count} row${count > 1 ? "s" : ""} re-applied`,
        { duration: 2000 },
      );
      return;
    }

    // CELL-LEVEL REDO
    setMultiRows((currentRows) => {
      const newRows = [...currentRows];
      const currentRowData = { ...newRows[action.rowIndex] };

      if (action.type === "cell") {
        if (action.oldRowData) {
          newRows[action.rowIndex] = { ...action.oldRowData };
        } else {
          newRows[action.rowIndex] = {
            ...newRows[action.rowIndex],
            [action.field]: action.oldValue,
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
        api.ensureIndexVisible(action.rowIndex, "middle");
        api.setFocusedCell(action.rowIndex, action.field);
      }
    }, 50);

    toast.success("Redo successful", { duration: 1500 });
  }, []);

  // ⚡ EXCEL-LIKE: Track selected cell range for multi-cell operations
  const [selectedRange, setSelectedRange] = useState<{
    startRow: number;
    endRow: number;
    startCol: string;
    endCol: string;
  } | null>(null);
  const rangeStartCellRef = useRef<{ rowIndex: number; colId: string } | null>(
    null,
  );

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

  // ⚡ PERF: Track previous full bounds (row + col) for smart diff — only refresh changed rows
  const prevBoundsFullRef = useRef<{
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  } | null>(null);
  // ⚡ PERF: requestAnimationFrame ID for batching drag selection updates (one per frame)
  const rafIdRef = useRef<number>(0);

  // ⚡ CORE: Flush pending selection update — computes bounds, smart row diff, refreshCells
  // Called either synchronously (final events) or from requestAnimationFrame (during drag)
  const flushSelectionUpdate = useCallback(() => {
    rafIdRef.current = 0;
    const range = selectedRangeRef.current;

    // 1. Pre-compute selection bounds
    let newBounds: typeof selectionBoundsRef.current = null;
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
        newBounds = {
          minRow: Math.min(range.startRow, range.endRow),
          maxRow: Math.max(range.startRow, range.endRow),
          minCol: Math.min(startColIndex, endColIndex),
          maxCol: Math.max(startColIndex, endColIndex),
          startCol: range.startCol,
          endCol: range.endCol,
          colIndexMap,
        };
      }
    }

    // 2. Skip if bounds are identical (no visual change needed)
    const prev = prevBoundsFullRef.current;
    if (
      newBounds &&
      prev &&
      newBounds.minRow === prev.minRow &&
      newBounds.maxRow === prev.maxRow &&
      newBounds.minCol === prev.minCol &&
      newBounds.maxCol === prev.maxCol
    ) {
      return;
    }

    // 3. Update bounds ref
    selectionBoundsRef.current = newBounds;

    // 4. Smart row diff — only refresh rows that actually changed
    const api = gridRef.current;
    if (!api) {
      prevBoundsFullRef.current = null;
      return;
    }

    const rowsToRefresh = new Set<number>();
    const colsChanged =
      !prev ||
      !newBounds ||
      prev.minCol !== newBounds?.minCol ||
      prev.maxCol !== newBounds?.maxCol;

    if (colsChanged) {
      // Column bounds changed — must refresh all affected rows in both old & new
      if (newBounds) {
        for (let r = newBounds.minRow; r <= newBounds.maxRow; r++)
          rowsToRefresh.add(r);
      }
      if (prev) {
        for (let r = prev.minRow; r <= prev.maxRow; r++) rowsToRefresh.add(r);
      }
    } else if (newBounds && prev) {
      // Only row bounds changed — smart diff: entering + leaving + edge rows only
      // Rows entering selection (in new but not old)
      for (let r = newBounds.minRow; r < prev.minRow; r++) rowsToRefresh.add(r);
      for (let r = prev.maxRow + 1; r <= newBounds.maxRow; r++)
        rowsToRefresh.add(r);
      // Rows leaving selection (in old but not new)
      for (let r = prev.minRow; r < newBounds.minRow; r++) rowsToRefresh.add(r);
      for (let r = newBounds.maxRow + 1; r <= prev.maxRow; r++)
        rowsToRefresh.add(r);
      // Edge rows always refresh (border-top/bottom changes)
      rowsToRefresh.add(newBounds.minRow);
      rowsToRefresh.add(newBounds.maxRow);
      rowsToRefresh.add(prev.minRow);
      rowsToRefresh.add(prev.maxRow);
    } else if (newBounds) {
      for (let r = newBounds.minRow; r <= newBounds.maxRow; r++)
        rowsToRefresh.add(r);
    } else if (prev) {
      for (let r = prev.minRow; r <= prev.maxRow; r++) rowsToRefresh.add(r);
    }

    // 5. Save full bounds for next diff
    prevBoundsFullRef.current = newBounds
      ? {
          minRow: newBounds.minRow,
          maxRow: newBounds.maxRow,
          minCol: newBounds.minCol,
          maxCol: newBounds.maxCol,
        }
      : null;

    // 6. Refresh only changed rows — in-place style update, zero DOM destruction
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
  }, []);

  // ⚡ PERF: Schedule selection update via requestAnimationFrame — batches rapid drag events.
  // Multiple cell crossings within a single 16ms frame are collapsed into ONE refreshCells call.
  const updateSelectionRange = useCallback(
    (range: typeof selectedRange) => {
      selectedRangeRef.current = range;
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(flushSelectionUpdate);
      }
    },
    [flushSelectionUpdate],
  );

  // ⚡ PERF: Immediate selection update + React state — for final events (mouseUp, Escape, Shift+Click).
  // Cancels any pending RAF and flushes synchronously for instant visual feedback.
  const setSelectionRange = useCallback(
    (range: typeof selectedRange) => {
      selectedRangeRef.current = range;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
      flushSelectionUpdate();
      setSelectedRange(range);
    },
    [flushSelectionUpdate],
  );

  // ✅ EXCEL ENHANCEMENT: Fill Down (Ctrl+D) - copy value from FIRST selected cell to all cells below
  const handleFillDown = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    const focusedCell = api.getFocusedCell();
    if (!focusedCell) {
      toast("Select a cell first", { icon: "ℹ️", duration: 1500 });
      return;
    }

    const { rowIndex, column } = focusedCell;
    // Use the column from selection start if available, otherwise use focused cell's column
    const colId = selectedRangeRef.current?.startCol || column.getColId();

    // Check if column is editable
    if (!EDITABLE_COLUMNS.includes(colId)) {
      toast("Cannot fill down in this column", { icon: "⚠️", duration: 1500 });
      return;
    }

    // If we have a selected range, fill down from the FIRST cell to all cells below
    const fillRange = selectedRangeRef.current;
    if (fillRange) {
      const startRow = Math.min(fillRange.startRow, fillRange.endRow);
      const endRow = Math.max(fillRange.startRow, fillRange.endRow);

      // Get the value from the FIRST selected cell (topmost)
      const sourceValue = multiRows[startRow]?.[colId];
      if (
        sourceValue === undefined ||
        sourceValue === null ||
        sourceValue === ""
      ) {
        toast("First selected cell is empty", { icon: "ℹ️", duration: 1500 });
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
        toast("All cells already have the same value", {
          icon: "ℹ️",
          duration: 1500,
        });
        return;
      }

      setMultiRows(newRows);
      api.refreshCells({ force: true });
      toast.success(`Filled ${filledCount} cells with: ${sourceValue}`, {
        duration: 1500,
      });
      return;
    }

    // Single cell fill down (copy from cell above)
    if (rowIndex === 0) {
      toast("No cell above to copy from", { icon: "ℹ️", duration: 1500 });
      return;
    }

    const valueAbove = multiRows[rowIndex - 1]?.[colId];
    if (valueAbove === undefined || valueAbove === null || valueAbove === "") {
      toast("No value above to copy", { icon: "ℹ️", duration: 1500 });
      return;
    }

    // Save to undo stack before modification (cell-level)
    const oldValue = multiRows[rowIndex]?.[colId];
    saveCellUndoAction(rowIndex, colId, oldValue, valueAbove);

    const newRows = [...multiRows];
    newRows[rowIndex] = { ...newRows[rowIndex], [colId]: valueAbove };
    setMultiRows(newRows);

    // Refresh cell
    api.refreshCells({
      rowNodes: [api.getRowNode(String(rowIndex))],
      columns: [colId],
    });
    toast.success(`Filled: ${valueAbove}`, { duration: 1500 });
  }, [multiRows, saveCellUndoAction]);

  // ✅ EXCEL ENHANCEMENT: Fill Right (Ctrl+R) - copy value from cell to the left
  const handleFillRight = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    const focusedCell = api.getFocusedCell();
    if (!focusedCell) {
      toast("Select a cell first", { icon: "ℹ️", duration: 1500 });
      return;
    }

    const { rowIndex, column } = focusedCell;
    const colId = column.getColId();
    const allColumns = api.getColumns();
    if (!allColumns) return;

    const colIndex = allColumns.findIndex((c: any) => c.getColId() === colId);
    if (colIndex <= 0) {
      toast("No cell to the left to copy from", { icon: "ℹ️", duration: 1500 });
      return;
    }

    const leftColId = allColumns[colIndex - 1].getColId();

    // Check if target column is editable
    if (!EDITABLE_COLUMNS.includes(colId)) {
      toast("Cannot fill in this column", { icon: "⚠️", duration: 1500 });
      return;
    }

    const valueLeft = multiRows[rowIndex]?.[leftColId];
    if (valueLeft === undefined || valueLeft === null || valueLeft === "") {
      toast("No value to the left to copy", { icon: "ℹ️", duration: 1500 });
      return;
    }

    const oldValue = multiRows[rowIndex]?.[colId];
    saveCellUndoAction(rowIndex, colId, oldValue, valueLeft);

    const newRows = [...multiRows];
    newRows[rowIndex] = { ...newRows[rowIndex], [colId]: valueLeft };
    setMultiRows(newRows);

    api.refreshCells({
      rowNodes: [api.getRowNode(String(rowIndex))],
      columns: [colId],
    });
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
    const clearRange = selectedRangeRef.current;
    if (clearRange) {
      const startRow = Math.min(clearRange.startRow, clearRange.endRow);
      const endRow = Math.max(clearRange.startRow, clearRange.endRow);

      // Get column range
      const allColumns = api.getAllDisplayedColumns() || [];
      const colIds = allColumns.map((c: any) => c.getColId());
      const startColIndex = colIds.indexOf(clearRange.startCol);
      const endColIndex = colIds.indexOf(clearRange.endCol);

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
          if (oldValue !== "" && oldValue !== null && oldValue !== undefined) {
            saveCellUndoAction(r, currentColId, oldValue, "");
            newRows[r] = { ...newRows[r], [currentColId]: "" };

            // Clear master data if clearing WSN
            if (currentColId === "wsn") {
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
      toast("Cannot clear this column", { icon: "⚠️", duration: 1500 });
      return;
    }
    const oldValue = multiRows[rowIndex]?.[colId];
    if (oldValue === "" || oldValue === null || oldValue === undefined) return;

    saveCellUndoAction(rowIndex, colId, oldValue, "");

    const newRows = [...multiRows];
    newRows[rowIndex] = { ...newRows[rowIndex], [colId]: "" };

    // Clear master data if clearing WSN
    if (colId === "wsn") {
      ALL_MASTER_COLUMNS.forEach((col) => {
        newRows[rowIndex][col] = null;
      });
    }

    setMultiRows(newRows);
    api.refreshCells({
      rowNodes: [api.getRowNode(String(rowIndex))],
      columns: [colId],
    });
  }, [multiRows, saveCellUndoAction]);

  // ✅ EXCEL ENHANCEMENT: Select All (Ctrl+A)
  const handleSelectAll = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    const totalRows = api.getDisplayedRowCount();
    if (totalRows === 0) return;

    // Get all editable columns for selection
    const allColumns = api.getAllDisplayedColumns() || [];
    const editableColIds = allColumns
      .map((c: any) => c.getColId())
      .filter((id: string) => EDITABLE_COLUMNS.includes(id));

    const firstCol = editableColIds[0] || "wsn";
    const lastCol = editableColIds[editableColIds.length - 1] || "wsn";

    // Select all rows
    api.selectAll();

    // Set range to all editable cells
    setSelectionRange({
      startRow: 0,
      endRow: totalRows - 1,
      startCol: firstCol,
      endCol: lastCol,
    });

    rangeStartCellRef.current = { rowIndex: 0, colId: firstCol };

    toast("All rows selected", { icon: "✓", duration: 1500 });
  }, []);

  // ✅ EXCEL ENHANCEMENT: Go to first cell (Ctrl+Home)
  const handleGoToFirst = useCallback(() => {
    const api = gridRef.current;
    if (!api) return;

    api.ensureIndexVisible(0, "top");
    api.setFocusedCell(0, "wsn");
    setSelectionRange(null);
  }, [setSelectionRange]);

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

    api.ensureIndexVisible(lastRowWithData, "bottom");
    api.setFocusedCell(lastRowWithData, "wsn");
    setSelectionRange(null);
  }, [multiRows, setSelectionRange]);

  // ⚡ EXCEL-LIKE: Track mouse drag state for multi-cell selection
  const isDraggingRef = useRef(false);
  const dragStartCellRef = useRef<{ rowIndex: number; colId: string } | null>(
    null,
  );
  // Track if a drag selection actually occurred (moved to a different cell)
  const didDragSelectRef = useRef(false);

  // ✅ EXCEL ENHANCEMENT: Handle cell mouse down - start drag selection
  // FIXED: Only allow left mouse button (button === 0) for drag selection
  const handleCellMouseDown = useCallback(
    (
      rowIndex: number,
      colId: string,
      shiftKey: boolean,
      mouseButton: number,
      browserEvent?: MouseEvent,
    ) => {
      // Only allow left mouse button (button === 0) for selection
      if (mouseButton !== 0) return;

      // ✅ FIX: Prevent browser native text selection during drag to avoid ghost highlights
      if (browserEvent) browserEvent.preventDefault();

      if (shiftKey && rangeStartCellRef.current) {
        // Shift+Click: Extend selection from start cell to this cell
        setSelectionRange({
          startRow: rangeStartCellRef.current.rowIndex,
          endRow: rowIndex,
          startCol: rangeStartCellRef.current.colId,
          endCol: colId,
        });
      } else {
        // Start new drag selection - just set anchor, don't create selection yet
        isDraggingRef.current = true;
        didDragSelectRef.current = false;
        dragStartCellRef.current = { rowIndex, colId };
        rangeStartCellRef.current = { rowIndex, colId };
        // Clear any existing selection on new click
        setSelectionRange(null);
      }
    },
    [],
  );

  // ✅ EXCEL ENHANCEMENT: Handle cell mouse over - extend selection while dragging
  // FIXED: Only create selection when mouse moves to a DIFFERENT cell AND left button is still pressed
  const handleCellMouseOver = useCallback(
    (rowIndex: number, colId: string, mouseButtons: number) => {
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
      // This prevents accidental selection when clicking a single cell with slight mouse movement
      const startRow = dragStartCellRef.current.rowIndex;
      const startCol = dragStartCellRef.current.colId;

      if (rowIndex === startRow && colId === startCol) {
        // Same cell - don't create selection (Excel behavior: single click = no range)
        return;
      }

      // Mark that a real drag selection happened (moved to different cell)
      didDragSelectRef.current = true;

      // ⚡ PERF: Update refs + redraw cells only — no React re-render during drag
      updateSelectionRange({
        startRow: startRow,
        endRow: rowIndex,
        startCol: startCol,
        endCol: colId,
      });
    },
    [],
  );

  // ✅ EXCEL ENHANCEMENT: Handle mouse up — end drag selection + cleanup RAF
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        // Cancel pending RAF and flush immediately so final state is visible
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = 0;
        }
        flushSelectionUpdate();
        // Sync ref → React state so JSX chip updates
        setSelectedRange(selectedRangeRef.current);
      }
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      // Cleanup any pending RAF on unmount
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [flushSelectionUpdate]);

  // ✅ EXCEL ENHANCEMENT: Handle Shift+Click for range selection
  // FIXED: Skip if a drag selection just happened (onCellClicked fires AFTER drag ends)
  const handleCellClick = useCallback(
    (rowIndex: number, colId: string, shiftKey: boolean) => {
      // ✅ FIX: If a drag selection just occurred, don't let onClick clear it
      if (didDragSelectRef.current) {
        didDragSelectRef.current = false;
        return;
      }

      if (shiftKey && rangeStartCellRef.current) {
        // Extend selection from start cell to this cell
        setSelectionRange({
          startRow: rangeStartCellRef.current.rowIndex,
          endRow: rowIndex,
          startCol: rangeStartCellRef.current.colId,
          endCol: colId,
        });
      } else {
        // Start new selection - just set anchor, don't highlight single cell
        rangeStartCellRef.current = { rowIndex, colId };
        setSelectionRange(null);
      }
    },
    [],
  );

  // ✅ EXCEL ENHANCEMENT: Handle Shift+Arrow for range selection (step=1 for Shift, jump for Ctrl+Shift)
  const handleShiftArrow = useCallback(
    (direction: "up" | "down" | "left" | "right", jump?: boolean) => {
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

      const currentRange = selectedRangeRef.current || {
        startRow: rangeStartCellRef.current.rowIndex,
        endRow: rangeStartCellRef.current.rowIndex,
        startCol: rangeStartCellRef.current.colId,
        endCol: rangeStartCellRef.current.colId,
      };

      let newEndRow = currentRange.endRow;
      let newEndCol = currentRange.endCol;

      if (direction === "up") {
        if (jump) {
          newEndRow = 0; // Jump to first row
        } else if (currentRange.endRow > 0) {
          newEndRow = currentRange.endRow - 1;
        }
      } else if (direction === "down") {
        if (jump) {
          // Jump to last row with data
          let lastDataRow = 0;
          const rows = multiRowsRef.current;
          for (let i = rows.length - 1; i >= 0; i--) {
            if (rows[i]?.wsn?.trim()) {
              lastDataRow = i;
              break;
            }
          }
          newEndRow = Math.max(lastDataRow, currentRange.endRow);
        } else if (currentRange.endRow < multiRows.length - 1) {
          newEndRow = currentRange.endRow + 1;
        }
      } else if (direction === "left" || direction === "right") {
        // ✅ FIX: Use getAllDisplayedColumns (visible only) instead of getColumns (may include hidden)
        const allColumns = api.getAllDisplayedColumns();
        if (allColumns) {
          const colIndex = allColumns.findIndex(
            (c: any) => c.getColId() === currentRange.endCol,
          );
          if (jump) {
            newEndCol =
              direction === "left"
                ? allColumns[0].getColId()
                : allColumns[allColumns.length - 1].getColId();
          } else {
            if (direction === "left" && colIndex > 0) {
              newEndCol = allColumns[colIndex - 1].getColId();
            } else if (
              direction === "right" &&
              colIndex < allColumns.length - 1
            ) {
              newEndCol = allColumns[colIndex + 1].getColId();
            }
          }
        }
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
      api.ensureIndexVisible(newEndRow, "middle");
    },
    [multiRows.length, setSelectionRange],
  );

  // ⚡ PERF: Selection refresh is now handled inline by updateSelectionRange — no useEffect needed.

  // ⚡ EXCEL-LIKE KEYBOARD SHORTCUTS (Global listener for Multi Entry tab)
  useEffect(() => {
    if (currentTabCode !== "multi") return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const ctrlKey = e.ctrlKey || e.metaKey;
      const shiftKey = e.shiftKey;

      // Only handle shortcuts when Multi Entry tab is active
      if (currentTabCode !== "multi") return;

      // Don't handle if editing in input/textarea (except for specific shortcuts)
      const activeEl = document.activeElement;
      const isEditing =
        activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA";

      // Ctrl+P → Print last scanned WSN label (custom shortcut)
      if (ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        e.stopPropagation();

        if (!ctrlPPrintEnabled) {
          toast("Ctrl+P shortcut is disabled", { icon: "⚠️", duration: 1500 });
          return;
        }

        if (!lastScannedRowRef.current?.wsn?.trim()) {
          toast.error("No scanned WSN to print", { duration: 2000 });
          return;
        }

        if (!agentReady) {
          toast.error("Print agent not available", { duration: 2000 });
          return;
        }

        // Print the last scanned WSN
        const rowData = lastScannedRowRef.current;
        printRowWSN(rowData);
        return;
      }

      // Ctrl+O → Open product link for last scanned WSN (custom shortcut)
      if (ctrlKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        e.stopPropagation();

        if (!ctrlOProductLinkEnabled) {
          toast("Ctrl+O shortcut is disabled", { icon: "⚠️", duration: 1500 });
          return;
        }

        if (!lastScannedRowRef.current?.wsn?.trim()) {
          toast.error("No scanned WSN available", { duration: 2000 });
          return;
        }

        const fktLink = lastScannedRowRef.current?.fkt_link;
        if (!fktLink) {
          toast.error("No product link available for this WSN", {
            duration: 2000,
          });
          return;
        }

        // Open product link in new tab
        try {
          window.open(fktLink, "_blank");
          toast.success(
            `Product link opened: ${lastScannedRowRef.current.wsn}`,
            { duration: 2000 },
          );
        } catch (err) {
          toast.error("Failed to open product link", { duration: 2000 });
        }
        return;
      }

      // Ctrl+Z → Undo (global, works even outside grid)
      if (ctrlKey && e.key.toLowerCase() === "z" && !shiftKey) {
        if (isEditing) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleUndo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z → Redo
      if (
        ctrlKey &&
        (e.key.toLowerCase() === "y" ||
          (e.key.toLowerCase() === "z" && shiftKey))
      ) {
        if (isEditing) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleRedo();
        return;
      }

      // Ctrl+D → Fill Down (works on selected range)
      if (ctrlKey && e.key.toLowerCase() === "d") {
        const api = gridRef.current;
        if (!api) return;
        const focusedCell = api.getFocusedCell();
        if (!focusedCell) return;
        e.preventDefault();
        handleFillDown();
        return;
      }

      // Ctrl+R → Fill Right
      if (ctrlKey && e.key.toLowerCase() === "r") {
        const api = gridRef.current;
        if (!api) return;
        const focusedCell = api.getFocusedCell();
        if (!focusedCell) return;
        e.preventDefault();
        handleFillRight();
        return;
      }

      // Delete or Backspace → Clear selected cells
      if ((e.key === "Delete" || e.key === "Backspace") && !isEditing) {
        e.preventDefault();
        handleClearCells();
        return;
      }

      // Ctrl+A → Select All
      if (ctrlKey && e.key.toLowerCase() === "a") {
        if (isEditing) return;
        e.preventDefault();
        handleSelectAll();
        return;
      }

      // Ctrl+Home → Go to first cell
      if (ctrlKey && e.key === "Home") {
        e.preventDefault();
        handleGoToFirst();
        return;
      }

      // Ctrl+End → Go to last cell with data
      if (ctrlKey && e.key === "End") {
        e.preventDefault();
        handleGoToLast();
        return;
      }

      // Shift+Arrow keys → Extend selection (with or without Ctrl for jump)
      if (
        shiftKey &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        if (isEditing) return;
        e.preventDefault();
        const direction = e.key.replace("Arrow", "").toLowerCase() as
          | "up"
          | "down"
          | "left"
          | "right";
        handleShiftArrow(direction, ctrlKey); // ctrlKey=true → jump to edge
        return;
      }

      // Escape → Clear selection
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setSelectionRange(null);
        rangeStartCellRef.current = null;
        const api = gridRef.current;
        if (api) {
          api.deselectAll();
          api.stopEditing(true); // Cancel any cell editing
        }
        toast("Selection cleared", { icon: "✓", duration: 1000 });
        return;
      }

      // F2 → Edit current cell
      if (e.key === "F2" && !isEditing) {
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

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    currentTabCode,
    handleUndo,
    handleRedo,
    handleFillDown,
    handleFillRight,
    handleClearCells,
    handleSelectAll,
    handleGoToFirst,
    handleGoToLast,
    handleShiftArrow,
  ]);

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
    } catch (e) {
      /* ignore */
    }
  }

  // Ensure a row is visible both inside AG Grid and in the outer scroll container
  // rowsBelow controls how many rows below the target stay visible (helps scanner users)
  // Accepts an optional callback which is invoked after the scrolling finishes
  // Uses offsetTop for stable calculations and does immediate jumps for rapid scanner input
  const lastAutoScrollTsRef = useRef<number | null>(null);

  // Wait for AG Grid to render the row element (up to timeoutMs). Returns the element or null.
  function waitForRowElement(
    rowIndex: number,
    timeoutMs = 600,
  ): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
      const start = performance.now();
      const check = () => {
        const el = document.querySelector(
          `[data-row=\"${rowIndex}\"][data-col=\"0\"]`,
        ) as HTMLElement | null;
        if (el) {
          resolve(el);
          return;
        }
        if (performance.now() - start > timeoutMs) {
          resolve(null);
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    });
  }
  function ensureRowVisible(
    rowIndex: number,
    position: "top" | "middle" | "bottom" = "bottom",
    rowsBelow = 3,
    onComplete?: () => void,
    immediate = false,
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

      const isAlreadyVisible =
        rowIndex >= firstVisibleRow + topBuffer &&
        rowIndex <= lastVisibleRow - bottomBuffer;

      // If row is already comfortably visible, don't scroll - just invoke callback
      if (isAlreadyVisible) {
        isAutoScrollingRef.current = false;
        onComplete?.();
        return;
      }

      // Use AG Grid's smooth scroll approach
      // For scanning mode or immediate, use 'middle' position for minimal movement
      // Otherwise position based on where row is relative to viewport
      const effectivePosition =
        scanningModeRef.current || immediate
          ? "middle"
          : rowIndex < firstVisibleRow
            ? "top"
            : "bottom";

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
        wsn: "",
        inbound_date: commonDate,
        vehicle_no: commonVehicle,
        product_serial_number: "",
        rack_no: "",
        unload_remarks: "",
      },
    ];

    setMultiRows(newRows);

    // ⚡ EXCEL ENHANCEMENT: Highlight newly added row
    highlightRow(newRowIndex, 1500);

    // Give React/AG Grid a moment to render, then ensure the new row is visible (Excel-like behavior)
    setTimeout(() => {
      try {
        ensureRowVisible(
          newRows.length - 1,
          "bottom",
          3,
          undefined,
          scanningModeRef.current,
        );

        // Auto-focus the WSN cell of the new row
        const api = gridRef.current;
        if (api) {
          api.startEditingCell({
            rowIndex: newRowIndex,
            colKey: "wsn",
          });
        }
      } catch (e) {
        /* ignore */
      }
    }, 80);
  };

  const statusCounts = useMemo(() => {
    let ready = 0;
    let duplicate = 0;
    let cross = 0;

    multiRows.forEach((row) => {
      if (!row.wsn?.trim()) return;

      const wsn = row.wsn.trim().toUpperCase();

      if (crossWarehouseWSNs.has(wsn)) cross++;
      else if (gridDuplicateWSNs.has(wsn)) duplicate++;
      else ready++;
    });

    return { ready, duplicate, cross };
  }, [multiRows, gridDuplicateWSNs, crossWarehouseWSNs]);

  const add500Rows = () => {
    const newRows = generateEmptyRows(500).map((row) => ({
      ...row,
      inbound_date: commonDate,
      vehicle_no: commonVehicle,
    }));
    setMultiRows([...multiRows, ...newRows]);
  };

  // Export Multi Entry grid data to Excel
  const exportMultiEntryToExcel = async (selectedCols: string[]) => {
    // Filter only rows with actual data (WSN entered)
    const dataRows = multiRows.filter((row) => row.wsn?.trim());

    if (dataRows.length === 0) {
      toast("⚠️ No data to export", { icon: "⚠️" });
      return;
    }

    const columnsToExport = INBOUND_EXPORT_COLUMNS_CONFIG.filter((c) =>
      selectedCols.includes(c.key),
    );
    if (columnsToExport.length === 0) {
      toast.error("No columns selected for export");
      return;
    }

    try {
      // Dynamic import to reduce bundle size
      const XLSX = await import("xlsx");

      // Prepare export data with selected columns
      const exportData = dataRows.map((row, idx) => {
        const obj: Record<string, any> = {};
        columnsToExport.forEach((col) => {
          if (col.key === "sr_no") {
            obj[col.label] = idx + 1;
          } else if (col.key === "inbound_date") {
            obj[col.label] = row.inbound_date || commonDate || "";
          } else if (col.key === "vehicle_no") {
            obj[col.label] = row.vehicle_no || commonVehicle || "";
          } else {
            obj[col.label] = row[col.field] || "";
          }
        });
        return obj;
      });

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Auto-fit column widths
      const colWidths = Object.keys(exportData[0]).map((key) => ({
        wch:
          Math.max(
            key.length,
            ...exportData.map((row) => String((row as any)[key] || "").length),
          ) + 2,
      }));
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Multi Entry Data");

      // Generate filename with timestamp
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:-]/g, "");
      const filename = `Inbound_MultiEntry_${timestamp}.xlsx`;

      // Download the file
      XLSX.writeFile(wb, filename);
      setInboundExportDialogOpen(false);
      toast.success(
        `✅ Exported ${dataRows.length} rows with ${columnsToExport.length} columns to ${filename}`,
      );

      // Save preference if remember is checked
      if (inboundExportRemember) {
        localStorage.setItem(
          "inboundExportColumns",
          JSON.stringify(selectedCols),
        );
        localStorage.setItem("inboundExportRemember", "true");
      } else {
        localStorage.removeItem("inboundExportColumns");
        localStorage.removeItem("inboundExportRemember");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    }
  };

  const checkDuplicates = async (rows: any[]) => {
    const gridDup = new Set<string>();
    const crossWh = new Set<string>();
    const wsnCount = new Map<string, number>();

    // 1) Grid-level duplicates - fast local check
    rows.forEach((row) => {
      if (!row.wsn?.trim()) return;

      const wsn = row.wsn.trim().toUpperCase();

      wsnCount.set(wsn, (wsnCount.get(wsn) || 0) + 1);
      if (wsnCount.get(wsn)! > 1) {
        gridDup.add(wsn);
      }
    });

    // Update grid duplicates immediately for fast feedback
    setGridDuplicateWSNs(gridDup);

    // ⚡ OFFLINE CHECK: Skip cross-warehouse API calls when offline
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline) {
      console.log("📴 Offline - skipping cross-warehouse check");
      setCrossWarehouseWSNs(crossWh);
      setDuplicateWSNs(gridDup);
      return;
    }

    // 2) Cross-warehouse check: batch the API calls for efficiency
    const uniqueWsns = Array.from(
      new Set(rows.map((r) => r.wsn?.trim().toUpperCase()).filter(Boolean)),
    );

    // Limit concurrent API calls to prevent overwhelming the server
    const BATCH_SIZE = 5;
    const TIMEOUT_MS = 2000; // ⚡ Fast timeout for each batch

    for (let i = 0; i < uniqueWsns.length; i += BATCH_SIZE) {
      const batch = uniqueWsns.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (wsn) => {
          try {
            // ⚡ Add timeout to prevent hanging
            const resp = await Promise.race([
              inboundAPI.getAll(1, 1, { search: wsn }),
              new Promise<null>((resolve) =>
                setTimeout(() => resolve(null), TIMEOUT_MS),
              ),
            ]);

            if (!resp) return; // Timeout occurred

            const item = resp?.data?.data?.[0] || resp?.data?.[0] || null;
            if (item) {
              const itemWarehouseId =
                item.warehouse_id ??
                item.warehouseId ??
                item.warehouseid ??
                null;
              if (itemWarehouseId && itemWarehouseId !== activeWarehouse?.id) {
                crossWh.add(wsn);
              }
            }
          } catch (err) {
            // ignore individual failures - they simply won't be marked cross-warehouse
          }
        }),
      );
    }

    setGridDuplicateWSNs(gridDup);
    setCrossWarehouseWSNs(crossWh);

    // backward compatibility (submit button disable)
    setDuplicateWSNs(new Set([...Array.from(gridDup), ...Array.from(crossWh)]));
  };

  const updateMultiRow = (index: number, field: string, value: any) => {
    const newRows = [...multiRows];
    // ⚡ UPPERCASE: Convert ALL string values to uppercase
    newRows[index][field] =
      value && typeof value === "string" ? value.toUpperCase() : value;
    setMultiRows(newRows);

    // Debounce duplicate check (200ms)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      checkDuplicates(newRows);
    }, 200);

    // Only fetch master data for WSN - with 500ms delay
    if (field === "wsn" && value.trim()) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const wsnUpper = value.trim().toUpperCase();
          let masterInfo = null;

          // ⚡ TRY PENDING CACHE FIRST (ultra-fast memory + IndexedDB)
          if (isWMSCacheEnabled() && activeWarehouse?.id) {
            masterInfo = await getPendingByWSNFast(
              wsnUpper,
              activeWarehouse.id,
            );
          }

          // ⚡ FALLBACK: Use old batch cache
          if (!masterInfo) {
            masterInfo = await getLocalMasterData(wsnUpper);
          }

          if (masterInfo) {
            setMultiRows((prevRows) => {
              const updatedRows = [...prevRows];
              ALL_MASTER_COLUMNS.forEach((col) => {
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
          }
        } catch (error) {
          console.log("WSN not found");
        }
      }, 500);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    rowIndex: number,
    colIndex: number,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextCell = document.querySelector(
        `[data-row="${rowIndex}"][data-col="${colIndex + 1}"]`,
      ) as HTMLElement;

      if (nextCell) {
        nextCell.focus();
      } else {
        const nextRowFirstCell = document.querySelector(
          `[data-row="${rowIndex + 1}"][data-col="0"]`,
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
  const navigateToNextCell = useCallback(
    (params: any) => {
      const { previousCellPosition, nextCellPosition, key } = params;

      if (key === "Enter") {
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
          const nextCol = params.api
            .getColumns()!
            .find((c: any) => c.getColId() === nextColId);
          return {
            rowIndex: currentRow,
            column: nextCol,
          };
        }
      }

      return nextCellPosition;
    },
    [visibleColumns],
  );

  // ✅ EXCEL-LIKE TAB NAVIGATION - move through editable cells like Excel
  const tabToNextCell = useCallback(
    (params: any) => {
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
          const prevCol = allColumns.find(
            (c: any) => c.getColId() === prevColId,
          );
          return { rowIndex: currentRow, column: prevCol };
        } else if (currentRow > 0) {
          // Move to last editable column of previous row
          const lastColId = editableColumnIds[editableColumnIds.length - 1];
          const lastCol = allColumns.find(
            (c: any) => c.getColId() === lastColId,
          );
          return { rowIndex: currentRow - 1, column: lastCol };
        }
      } else {
        // Tab - go forwards
        if (currentColIndex < editableColumnIds.length - 1) {
          // Move to next editable column in same row
          const nextColId = editableColumnIds[currentColIndex + 1];
          const nextCol = allColumns.find(
            (c: any) => c.getColId() === nextColId,
          );
          return { rowIndex: currentRow, column: nextCol };
        } else {
          // Move to first editable column of next row
          const firstColId = editableColumnIds[0];
          const firstCol = allColumns.find(
            (c: any) => c.getColId() === firstColId,
          );

          // Auto-scroll to next row
          const nextRow = currentRow + 1;
          setTimeout(() => {
            try {
              ensureRowVisible(nextRow, "bottom", 4, undefined, true);
            } catch (e) {
              /* ignore */
            }
          }, 50);

          return { rowIndex: nextRow, column: firstCol };
        }
      }

      return nextCellPosition;
    },
    [ensureRowVisible],
  );

  // ====== WSN OVERWRITE DIALOG HANDLERS ======
  const handleOverwriteCancel = useCallback(() => {
    setWsnOverwriteDialog(null);
    pendingWSNRef.current = null;
    // Refocus on same cell
    if (wsnOverwriteDialog?.rowIndex !== undefined) {
      setTimeout(() => {
        gridRef.current?.startEditingCell({
          rowIndex: wsnOverwriteDialog.rowIndex,
          colKey: "wsn",
        });
      }, 100);
    }
  }, [wsnOverwriteDialog?.rowIndex]);

  const handleOverwriteReplace = useCallback(async () => {
    const pending = pendingWSNRef.current;
    if (!pending) return;

    const { rowIndex, newWSN, event } = pending;
    setWsnOverwriteDialog(null);
    pendingWSNRef.current = null;

    // Replace with new WSN
    const newRows = [...multiRowsRef.current];
    newRows[rowIndex] = { ...newRows[rowIndex], wsn: newWSN };

    // Clear old master data
    ALL_MASTER_COLUMNS.forEach((col) => {
      newRows[rowIndex][col] = null;
    });
    setMultiRows(newRows);

    // Fetch new master data
    try {
      let masterData = null;

      // ⚡ TRY PENDING CACHE FIRST (ultra-fast memory + IndexedDB)
      if (isWMSCacheEnabled() && activeWarehouse?.id) {
        masterData = await getPendingByWSNFast(newWSN, activeWarehouse.id);
      }

      // ⚡ FALLBACK: Use old batch cache
      if (!masterData) {
        masterData = await getLocalMasterData(newWSN);
      }

      if (masterData) {
        setMultiRows((prevRows) => {
          const updatedRows = [...prevRows];
          if (updatedRows[rowIndex]?.wsn?.trim()?.toUpperCase() === newWSN) {
            ALL_MASTER_COLUMNS.forEach((col) => {
              updatedRows[rowIndex][col] = masterData[col] || null;
            });
          }
          return updatedRows;
        });
      }
    } catch (e) {
      console.error("Error fetching master data:", e);
    }

    // Sync replaced row to other browsers
    setTimeout(
      () => queueRowSync(rowIndex, multiRowsRef.current[rowIndex]),
      50,
    );

    // Move to next row
    setTimeout(() => {
      const nextIndex = rowIndex + 1;
      if (nextIndex < multiRowsRef.current.length) {
        ensureRowVisible(
          nextIndex,
          "bottom",
          4,
          () => {
            gridRef.current?.startEditingCell({
              rowIndex: nextIndex,
              colKey: "wsn",
            });
          },
          true,
        );
      }
    }, 100);
  }, [ensureRowVisible, queueRowSync]);

  const handleOverwriteAddToNextRow = useCallback(async () => {
    const pending = pendingWSNRef.current;
    if (!pending) return;

    const { rowIndex, newWSN } = pending;
    setWsnOverwriteDialog(null);
    pendingWSNRef.current = null;

    // Find next empty row
    let nextEmptyRow = rowIndex + 1;
    while (
      nextEmptyRow < multiRowsRef.current.length &&
      multiRowsRef.current[nextEmptyRow]?.wsn?.trim()
    ) {
      nextEmptyRow++;
    }

    // If no empty row found, add new rows
    if (nextEmptyRow >= multiRowsRef.current.length) {
      addMultiRow();
      nextEmptyRow = multiRowsRef.current.length;
    }

    // Insert new WSN in next empty row
    setMultiRows((prevRows) => {
      const newRows = [...prevRows];
      newRows[nextEmptyRow] = { ...newRows[nextEmptyRow], wsn: newWSN };
      return newRows;
    });

    // Fetch master data for new WSN
    try {
      let masterData = null;

      // ⚡ TRY PENDING CACHE FIRST (ultra-fast memory + IndexedDB)
      if (isWMSCacheEnabled() && activeWarehouse?.id) {
        masterData = await getPendingByWSNFast(newWSN, activeWarehouse.id);
      }

      // ⚡ FALLBACK: Use old batch cache
      if (!masterData) {
        masterData = await getLocalMasterData(newWSN);
      }

      if (masterData) {
        setMultiRows((prevRows) => {
          const updatedRows = [...prevRows];
          if (
            updatedRows[nextEmptyRow]?.wsn?.trim()?.toUpperCase() === newWSN
          ) {
            ALL_MASTER_COLUMNS.forEach((col) => {
              updatedRows[nextEmptyRow][col] = masterData[col] || null;
            });
          }
          return updatedRows;
        });
      }
    } catch (e) {
      console.error("Error fetching master data:", e);
    }

    // Sync new row to other browsers
    setTimeout(
      () => queueRowSync(nextEmptyRow, multiRowsRef.current[nextEmptyRow]),
      50,
    );

    // Move to row after the newly inserted one
    setTimeout(() => {
      const focusRow = nextEmptyRow + 1;
      if (focusRow < multiRowsRef.current.length) {
        ensureRowVisible(
          focusRow,
          "bottom",
          4,
          () => {
            gridRef.current?.startEditingCell({
              rowIndex: focusRow,
              colKey: "wsn",
            });
          },
          true,
        );
      }
    }, 100);
  }, [ensureRowVisible, addMultiRow, queueRowSync]);

  const handleMultiSubmit = async () => {
    if (!activeWarehouse?.id) {
      toast.error("Select warehouse first");
      return;
    }

    // ⚡ OFFLINE CHECK: Prevent submit when offline
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline) {
      toast.error(
        "Cannot submit while offline. Data is saved locally - submit when back online.",
        {
          duration: 4000,
          icon: "📴",
        },
      );
      return;
    }

    // ⚡ FIX: Always use commonDate from header (today's date by default)
    // This prevents stale dates from saved drafts being submitted
    const rowsWithDefaults = multiRows.map((row) => ({
      ...row,
      inbound_date: commonDate,
      vehicle_no: row.vehicle_no || commonVehicle,
      rack_no: row.rack_no || "Staging", // ✅ Auto-fill Staging
    }));

    if (!commonVehicle?.trim()) {
      toast.error("Vehicle number is required");
      return;
    }

    const filtered = rowsWithDefaults.filter(
      (r: any) => r.wsn && r.wsn.trim() !== "",
    );

    // ✅ UX: Confirmation dialog before submitting large batches
    if (filtered.length > 0) {
      const confirmed = window.confirm(
        `Submit ${filtered.length} inbound entr${filtered.length === 1 ? "y" : "ies"}?\n\nDate: ${commonDate}\nVehicle: ${commonVehicle || "(none)"}\nWarehouse: ${activeWarehouse?.name || activeWarehouse?.id}`,
      );
      if (!confirmed) return;
    }

    if (filtered.length === 0) {
      toast.error("No valid WSN rows");
      return;
    }

    // Check for duplicates
    const hasGridDup = filtered.some((r) =>
      gridDuplicateWSNs.has(r.wsn.trim().toUpperCase()),
    );

    const hasCrossWh = filtered.some((r) =>
      crossWarehouseWSNs.has(r.wsn.trim().toUpperCase()),
    );

    if (hasCrossWh) {
      toast.error("WSN already inbound in another warehouse");
      return;
    }

    if (hasGridDup) {
      toast.error("Duplicate WSN in grid");
      return;
    }

    // ✅ Pre-submit validation: Check for WSNs without master data
    const rowsWithoutMasterData = filtered.filter((r: any) => {
      // A row has no master data if product_title is empty/null (it's always present in master_data)
      return !r.product_title || String(r.product_title).trim() === "";
    });

    if (rowsWithoutMasterData.length > 0) {
      const wsnsWithout = rowsWithoutMasterData
        .slice(0, 10)
        .map((r: any) => r.wsn)
        .join(", ");
      const moreText =
        rowsWithoutMasterData.length > 10
          ? ` and ${rowsWithoutMasterData.length - 10} more`
          : "";
      toast.error(
        `${rowsWithoutMasterData.length} WSN(s) have no master data: ${wsnsWithout}${moreText}. Remove them or upload product data first.`,
        {
          duration: 8000,
          style: { fontWeight: 600, fontSize: "13px" },
          icon: "❌",
        },
      );
      return;
    }

    setMultiLoading(true);
    setMultiErrorMessage("");
    try {
      // ✅ ISSUE #2, #8 - Add created_by for each row
      const res = await inboundAPI.multiEntry(
        filtered.map((row) => ({
          ...row,
          created_by: user?.id,
          warehouse_id: activeWarehouse.id,
        })),
        activeWarehouse.id,
      );

      // Save vehicle number from current entry
      saveVehicleNumber(commonVehicle);

      const results = res.data.results || [];
      const successCount = res.data.successCount || 0;
      const totalCount = res.data.totalCount || filtered.length;
      const duplicateResults = results.filter(
        (r: any) => r.status === "DUPLICATE",
      );
      const errorResults = results.filter((r: any) => r.status === "ERROR");

      setMultiResults(results);

      // ⚡ ENHANCED FEEDBACK: Single consolidated toast
      if (duplicateResults.length > 0) {
        const crossWhDuplicates = duplicateResults.filter(
          (r: any) =>
            r.message?.includes("warehouse") &&
            !r.message?.includes("this warehouse"),
        );

        if (successCount > 0) {
          const parts: string[] = [
            `✓ Saved ${successCount}/${totalCount} rows`,
          ];
          if (crossWhDuplicates.length > 0)
            parts.push(`${crossWhDuplicates.length} cross-warehouse`);
          parts.push(`${duplicateResults.length} duplicates skipped`);
          toast.success(parts.join(" · "), { duration: 5000 });
        } else {
          if (crossWhDuplicates.length > 0) {
            toast.error(
              `All ${totalCount} WSNs were duplicates (${crossWhDuplicates.length} cross-warehouse)`,
              { duration: 5000 },
            );
          } else {
            toast.error(`All ${totalCount} WSNs were duplicates`);
          }
        }
      } else if (errorResults.length > 0) {
        toast(
          `⚠️ Saved ${successCount}/${totalCount} rows (${errorResults.length} errors)`,
          {
            icon: "⚠️",
            duration: 4000,
          },
        );
      } else {
        toast.success(`✓ Saved ${successCount} rows`);
      }

      // --- Smart 3-way clearing: preserve failed/duplicate rows ---
      if (successCount === totalCount) {
        // All succeeded → full clear
        setMultiRows(generateEmptyRows(500));
        setCommonVehicle("");
        localStorage.removeItem("inbound_multiVehicleNumber");

        // Retry clearDraft up to 3 times — prevents orphaned drafts on transient failures
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await clearDraft();
            break;
          } catch (e) {
            console.error(`clearDraft attempt ${attempt}/3 failed`, e);
            if (attempt < 3)
              await new Promise((r) => setTimeout(r, 2000 * attempt));
          }
        }

        if (isWMSCacheEnabled()) {
          const submittedWSNs = filtered
            .map((r: any) => r.wsn?.trim()?.toUpperCase())
            .filter(Boolean);
          removeMultipleFromPendingCache(submittedWSNs).catch(() => {});
        }
      } else if (successCount > 0) {
        // Partial success → remove only successful WSNs, keep failed/duplicate rows
        const failedWSNs = new Set(
          results
            .filter((r: any) => r.status !== "SUCCESS")
            .map((r: any) => r.wsn?.toUpperCase()),
        );
        const survivingRows = multiRows.filter((r) => {
          const wsn = r.wsn?.trim()?.toUpperCase();
          if (!wsn) return false; // drop empty rows
          return failedWSNs.has(wsn); // keep only failed/duplicate
        });
        const padding = generateEmptyRows(
          Math.max(500 - survivingRows.length, 0),
        );
        const newRows = [...survivingRows, ...padding];
        setMultiRows(newRows);
        // Re-save draft with surviving rows
        await saveDraftImmediate(newRows);

        // Still update cache for successful WSNs
        if (isWMSCacheEnabled()) {
          const successWSNs = results
            .filter((r: any) => r.status === "SUCCESS")
            .map((r: any) => r.wsn?.trim()?.toUpperCase())
            .filter(Boolean);
          removeMultipleFromPendingCache(successWSNs).catch(() => {});
        }
      }
      // else: successCount === 0 → keep all rows as-is, don't touch draft

      // Clear receiving WSNs from server (they are now inbound)
      // Retry up to 3 times — prevents orphaned receiving WSNs on transient failures
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await clearReceivingWSNs();
          break;
        } catch (e) {
          console.error(`clearReceivingWSNs attempt ${attempt}/3 failed`, e);
          if (attempt < 3)
            await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
      }

      loadInboundList();
    } catch (err: any) {
      console.error(err);
      setMultiErrorMessage(
        "❌ Multi entry failed: " +
          (err.response?.data?.error || "Unknown error"),
      );
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
      const XLSX = await import("xlsx");

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
      if (exportBatchIds && exportBatchIds.length > 0)
        filterParams.batchId = exportBatchIds;

      // ✅ Fetch data with pagination - ALL PAGES
      let dataToExport: any[] = [];
      let page = 1;
      let hasMore = true;
      const pageSize = 10000;

      while (hasMore) {
        const response = await inboundAPI.getAll(page, pageSize, filterParams);
        dataToExport = [...dataToExport, ...response.data.data];

        // Check if there are more pages
        const totalPages = response.data.totalPages || 1;
        if (page >= totalPages) {
          hasMore = false;
        }
        page++;
      }

      if (dataToExport.length === 0) {
        toast.error("No data to export with selected filters");
        return;
      }

      // ⚡ FIX: Convert dates to proper Date objects and numbers to actual numbers
      // so Excel treats them as date/number cells (sortable, summable) not text
      const NUMERIC_FIELDS = [
        "mrp",
        "fsp",
        "igst_rate",
        "quantity",
        "vrp",
        "yield_value",
      ];
      const DATE_FIELDS = ["inbound_date", "invoice_date"];

      const formattedData = dataToExport.map((row: any) => {
        const newRow = { ...row };
        // Convert date fields to DD-MMM-YYYY string format
        DATE_FIELDS.forEach((field) => {
          if (newRow[field]) {
            const d = new Date(newRow[field]);
            if (!isNaN(d.getTime())) {
              const day = String(d.getDate()).padStart(2, "0");
              const months = [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ];
              const mon = months[d.getMonth()];
              const yyyy = d.getFullYear();
              newRow[field] = `${day}-${mon}-${yyyy}`; // DD-MMM-YYYY
            }
          }
        });
        // Convert numeric fields from strings to actual numbers
        NUMERIC_FIELDS.forEach((field) => {
          if (
            newRow[field] !== null &&
            newRow[field] !== undefined &&
            newRow[field] !== ""
          ) {
            const num = Number(newRow[field]);
            if (!isNaN(num)) newRow[field] = num;
          }
        });
        return newRow;
      });

      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inbound");

      // Generate meaningful filename based on applied filters
      let filenameParts = ["inbound"];
      if (exportBatchIds && exportBatchIds.length > 0) {
        if (exportBatchIds.length === 1) {
          filenameParts.push(`batch_${exportBatchIds[0]}`);
        } else {
          filenameParts.push(`batches_${exportBatchIds.length}`);
        }
      }
      if (exportStartDate || dateFromFilter)
        filenameParts.push(
          `from_${(exportStartDate || dateFromFilter).replace(/-/g, "")}`,
        );
      if (exportEndDate || dateToFilter)
        filenameParts.push(
          `to_${(exportEndDate || dateToFilter).replace(/-/g, "")}`,
        );
      if (searchFilter) filenameParts.push("search");
      if (brandFilter)
        filenameParts.push(`brand_${brandFilter.replace(/\s+/g, "_")}`);
      if (categoryFilter)
        filenameParts.push(`cat_${categoryFilter.replace(/\s+/g, "_")}`);
      if (filenameParts.length === 1) filenameParts.push("all");

      const filename = `${filenameParts.join("_")}_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success(`✓ Exported ${dataToExport.length} records`);
      setExportDialogOpen(false);
      setExportStartDate("");
      setExportEndDate("");
      setExportBatchIds([]);
    } catch (error) {
      toast.error("Export failed");
    }
  };

  const deleteBatch = async (batchId: string) => {
    if (!confirm("Delete batch?")) return;

    try {
      await inboundAPI.deleteBatch(batchId);
      toast.success("Batch deleted");
      loadBatches();
      loadInboundList();
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  // Multi entry column width config — removed all minWidth/flex constraints.
  // Columns auto-size to text content on first render; user-resized widths are saved permanently.
  const COLUMN_WIDTHS: Record<string, any> = useMemo(() => ({}), []);

  // ✅  - MULTI ENTRY - COLUMN DEFS
  const columnDefs = useMemo(() => {
    // Add row number column at the beginning
    const rowNumberCol = {
      field: "rowNumber",
      headerName: "#",
      width: 50,
      minWidth: 50,
      maxWidth: 50,
      suppressSizeToFit: true,
      resizable: false,
      editable: false,
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        return (
          <span
            style={{
              fontWeight: 700,
              color: isDarkMode ? "#94a3b8" : "#64748b",
            }}
          >
            {params.node.rowIndex + 1}
          </span>
        );
      },
      cellStyle: { textAlign: "center" },
    };

    // Print column at the end
    const printCol = {
      field: "print_action",
      headerName: "🖨️",
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
              color: "#16a34a",
              "&:hover": {
                backgroundColor: "rgba(22, 163, 74, 0.1)",
                color: "#15803d",
              },
            }}
            title="Print WSN Label"
          >
            <span style={{ fontSize: "16px" }}>🖨️</span>
          </IconButton>
        );
      },
      cellStyle: { textAlign: "center", padding: "0 4px" },
    };

    const dataCols = visibleColumns.map((col) => {
      const isEditable = EDITABLE_COLUMNS.includes(col);

      // Use saved width if available, otherwise use default
      const savedWidth = multiColumnWidths[col];

      const baseColDef: any = {
        field: col,
        headerName: col.replace(/_/g, " ").toUpperCase(),
        editable: isEditable,
        resizable: true,
        // Apply saved width as fixed width (no flex); unsaved columns will be auto-sized on first render
        ...(savedWidth ? { width: savedWidth, flex: undefined } : {}),
      };

      const columnWidthConfig = COLUMN_WIDTHS[col] || {};

      if (col === "rack_no" && isEditable) {
        return {
          ...baseColDef,
          ...(savedWidth ? {} : { width: 110 }),
          cellEditor: "agSelectCellEditor",
          cellEditorParams: { values: racks.map((r) => r.rack_name) },
        };
      } else if (col.includes("date")) {
        return {
          ...baseColDef,
          ...(savedWidth ? {} : { width: 130 }),
          cellDataType: "date",
        };
      } else {
        return {
          ...baseColDef,
          ...columnWidthConfig,

          cellRenderer: (params: any) => {
            // Special rendering for fkqc_remark column
            if (col === "fkqc_remark") {
              const value = params.value?.trim()?.toUpperCase();
              const isCX = value === "CX";
              const isNTF = value === "NTF";

              return (
                <span
                  className={
                    isCX ? "fkqc-badge-cx" : isNTF ? "fkqc-badge-ntf" : ""
                  }
                  style={{
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "4px",
                  }}
                  title={params.value}
                >
                  {params.value ?? "-"}
                </span>
              );
            }

            if (col !== "wsn") {
              // Make the FKT_LINK column clickable (open in new tab) while keeping other columns simple
              if (col === "fkt_link") {
                return (
                  <a
                    href={params.value}
                    target="_blank"
                    rel="noreferrer"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (params.value) window.open(params.value, "_blank");
                    }}
                    style={{ color: "#2563eb", textDecoration: "underline" }}
                    title={params.value}
                  >
                    {params.value ?? ""}
                  </a>
                );
              }

              return <span title={params.value}>{params.value ?? ""}</span>;
            }

            const wsn = params.value?.trim()?.toUpperCase();
            const isCross = wsn && crossWarehouseWSNs.has(wsn);
            const isDup = wsn && gridDuplicateWSNs.has(wsn);

            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{params.value ?? ""}</span>

                {/* Clickable product link if available */}
                {params.data?.fkt_link && (
                  <a
                    href={params.data.fkt_link}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      try {
                        window.open(params.data.fkt_link, "_blank");
                      } catch (err) {
                        /* ignore */
                      }
                    }}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 14,
                      color: "#2563eb",
                      textDecoration: "none",
                      marginLeft: 4,
                      cursor: "pointer",
                    }}
                    title="Open product link"
                  >
                    🔗
                  </a>
                )}

                {isCross && (
                  <Tooltip title="Already inbound in another warehouse">
                    <span style={{ color: "#dc2626", cursor: "help" }}>⛔</span>
                  </Tooltip>
                )}

                {isDup && !isCross && (
                  <Tooltip title="Duplicate WSN in grid">
                    <span style={{ color: "#d97706", cursor: "help" }}>⚠️</span>
                  </Tooltip>
                )}
              </div>
            );
          },

          cellClassRules: {
            "wsn-cross-error": (params: any) => {
              const wsn = params.value?.trim()?.toUpperCase();
              return !!wsn && crossWarehouseWSNs.has(wsn);
            },
            "wsn-dup-error": (params: any) => {
              const wsn = params.value?.trim()?.toUpperCase();
              return !!wsn && gridDuplicateWSNs.has(wsn);
            },
          },
        };
      }
    });

    // Invisible filler column — absorbs remaining space on wide screens (Excel-style)
    const fillerCol = {
      field: "_filler",
      headerName: "",
      flex: 1,
      resizable: false,
      editable: false,
      sortable: false,
      filter: false,
      suppressNavigable: true,
      suppressSizeToFit: true,
      cellStyle: { pointerEvents: "none" } as any,
    };

    return [rowNumberCol, ...dataCols, printCol, fillerCol];
  }, [
    visibleColumns,
    racks,
    gridDuplicateWSNs,
    crossWarehouseWSNs,
    COLUMN_WIDTHS,
    multiColumnWidths,
    printRowWSN,
  ]);

  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const handleConfirmDownload = () => {
    downloadTemplate();
    setConfirmOpen(false);
  };

  // ⚡ EXTRACTED: Multi-entry grid onCellValueChanged handler
  const handleMultiCellValueChanged = useCallback(
    (event: any) => {
      const { colDef, newValue, rowIndex, oldValue, data } = event;
      const field = colDef?.field;

      // ✅ NULL SAFETY: Return early if field or rowIndex is null
      if (!field || rowIndex === null || rowIndex === undefined) return;

      // ⚡ BULK PASTE: During paste (custom handler), skip cell-level processing
      if (isPastingRef.current) return;

      // ⚠️ WSN OVERWRITE WARNING: Check if replacing an existing WSN with a different one
      if (field === "wsn") {
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
              product_title: existingData.product_title,
              brand: existingData.brand,
              mrp: existingData.mrp,
              fsp: existingData.fsp,
              fsn: existingData.fsn,
              cms_vertical: existingData.cms_vertical,
            },
            newWSN,
          });

          // REVERT the cell value to old WSN (user hasn't confirmed yet)
          setTimeout(() => {
            const node = event.api.getRowNode(String(rowIndex));
            if (node) {
              node.setDataValue("wsn", existingWSN);
            }
          }, 10);

          return; // Don't process further until user confirms
        }
      }

      // ⚡ EXCEL-LIKE: Save cell-level undo action for any meaningful change
      if (oldValue !== newValue) {
        // For WSN field, save the entire row data for proper undo
        // This allows us to restore both the WSN AND the master data that was loaded
        if (field === "wsn") {
          // Reconstruct the old row data by taking current data and replacing WSN with oldValue
          // Also clear master columns since they weren't loaded yet for the old WSN
          const currentRowData = multiRowsRef.current[rowIndex];
          const oldRowData = { ...currentRowData, [field]: oldValue };
          // Clear master data columns since old WSN didn't have them loaded
          ALL_MASTER_COLUMNS.forEach((col) => {
            oldRowData[col] = null;
          });
          saveCellUndoAction(
            rowIndex,
            field,
            oldValue,
            newValue,
            oldRowData,
            undefined,
          );
        } else {
          saveCellUndoAction(rowIndex, field, oldValue, newValue);
        }
      }

      const newRows = [...multiRows];

      // WSN clear - master clear
      if (field === "wsn" && (!newValue || !newValue.trim())) {
        newRows[rowIndex] = { ...newRows[rowIndex], [field]: newValue };
        ALL_MASTER_COLUMNS.forEach((col) => {
          newRows[rowIndex][col] = null;
        });
        setMultiRows(newRows);
        checkDuplicates(newRows);
        // ⚡ SYNC: Broadcast cleared row to other devices
        queueRowSync(rowIndex, newRows[rowIndex]);
        return;
      }

      // ⚡ UPPERCASE: Convert ALL editable field values to uppercase
      const processedValue =
        newValue && typeof newValue === "string"
          ? newValue.toUpperCase()
          : newValue;
      newRows[rowIndex] = { ...newRows[rowIndex], [field]: processedValue };
      setMultiRows(newRows);

      // ⚡ SYNC: Broadcast non-WSN field changes to other devices (remarks, rack, serial, etc.)
      if (field !== "wsn") {
        queueRowSync(rowIndex, newRows[rowIndex]);
      }

      // ⚡ SMOOTH SCROLL: Only scroll to next row for WSN field (scanner input)
      // and only if NOT user-initiated scroll - this prevents disruptive auto-scrolling
      // For non-WSN fields, user is manually editing so no auto-scroll needed

      // If user entered a WSN, start scan activity detection
      if (field === "wsn" && newValue?.trim()) {
        // ⚡ EXCEL ENHANCEMENT: Highlight the row being scanned
        highlightRow(rowIndex, 1500);

        try {
          recordScanActivity();
        } catch (e) {
          /* ignore */
        }

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
              background: "#ffffff",
              color: "#d97706",
              border: "2px solid #f59e0b",
              borderRadius: "8px",
              padding: "12px 16px",
              fontWeight: 600,
              fontSize: "14px",
            },
            icon: "⚠️",
          });

          newRows[rowIndex].wsn = "";
          ALL_MASTER_COLUMNS.forEach((col) => {
            newRows[rowIndex][col] = null;
          });
          setMultiRows(newRows);
          checkDuplicates(newRows);

          setTimeout(() => {
            event.api.startEditingCell({
              rowIndex: rowIndex,
              colKey: "wsn",
            });
          }, 100);

          return;
        }

        // ⚡ AUTO-EXTEND: Add 500 rows when entering data near the end
        if (
          rowIndex != null &&
          rowIndex >= event.api.getDisplayedRowCount() - 2
        ) {
          add500Rows();
        }

        // ⚡ FAST FETCH: Use LOCAL CACHE first, then API fallback
        const wsnUpper = newValue.trim().toUpperCase();
        wsnFetchMapRef.current.set(rowIndex, wsnUpper);

        // ⚡ OFFLINE CHECK: Skip API calls when offline for instant response
        const isOnline =
          typeof navigator !== "undefined" ? navigator.onLine : true;

        // ⚡ OFFLINE WARNING: Show once per offline session
        if (!isOnline && !offlineWarningShownRef.current) {
          offlineWarningShownRef.current = true;
          toast(
            "📴 Offline Mode - Cross-warehouse duplicate check skipped. Will validate on submit.",
            {
              duration: 5000,
              style: {
                background: "#fef3c7",
                color: "#92400e",
                border: "1px solid #f59e0b",
                borderRadius: "8px",
                padding: "12px 16px",
                fontWeight: 500,
                fontSize: "13px",
              },
              icon: "⚠️",
            },
          );
        }

        // Reset warning flag when back online
        if (isOnline && offlineWarningShownRef.current) {
          offlineWarningShownRef.current = false;
        }

        // Start ownership check in parallel (only if online, with fast 3s timeout)
        const ownershipPromise = isOnline
          ? Promise.race([
              inboundAPI
                .getAll(1, 1, { search: wsnUpper }, { timeout: 3000 })
                .catch(() => null),
              new Promise<null>((resolve) =>
                setTimeout(() => resolve(null), 3000),
              ), // 3s hard timeout
            ])
          : Promise.resolve(null); // Skip API when offline

        // ⚡ Use LOCAL CACHE for master data (ultra-fast memory + IndexedDB)
        // Try pending cache first (new wmsCache), then fallback to old batch cache
        const masterDataPromise = (async () => {
          // TRY PENDING CACHE FIRST (ultra-fast memory + IndexedDB)
          if (isWMSCacheEnabled() && activeWarehouse?.id) {
            const pendingData = await getPendingByWSNFast(
              wsnUpper,
              activeWarehouse.id,
            );
            if (pendingData) return pendingData;
          }
          // FALLBACK: Use old batch cache
          return getLocalMasterData(wsnUpper).catch(() => null);
        })();

        // Process results as they come
        (async () => {
          // Define moveToNextRow helper at the start of async block
          const moveToNextRow = () => {
            try {
              recordScanActivity();
            } catch (e) {
              /* ignore */
            }

            setTimeout(() => {
              try {
                const nextIndex = (rowIndex ?? 0) + 1;

                if (nextIndex < event.api.getDisplayedRowCount()) {
                  desiredRowIndexRef.current = nextIndex;
                  ensureRowVisible(
                    nextIndex,
                    "bottom",
                    4,
                    () => {
                      try {
                        event.api.startEditingCell({
                          rowIndex: nextIndex,
                          colKey: "wsn",
                        });
                      } catch (e) {
                        /* ignore */
                      }
                    },
                    scanningModeRef.current,
                  );
                } else {
                  addMultiRow();
                  setTimeout(() => {
                    const newIdx = nextIndex;
                    desiredRowIndexRef.current = newIdx;
                    ensureRowVisible(
                      newIdx,
                      "bottom",
                      4,
                      () => {
                        try {
                          event.api.startEditingCell({
                            rowIndex: newIdx,
                            colKey: "wsn",
                          });
                        } catch (e) {
                          /* ignore */
                        }
                      },
                      scanningModeRef.current,
                    );
                  }, 50);
                }
              } catch (e) {
                /* ignore */
              }
            }, 30);
          };

          try {
            // ⚡ CACHE FIRST: Get master data immediately (from cache - instant!)
            const masterInfo = await masterDataPromise;

            // Check if this is still the latest fetch for this row
            const latestWSN = wsnFetchMapRef.current.get(rowIndex);
            if (latestWSN !== wsnUpper) {
              console.log(
                `⏭️ Skipping stale fetch for row ${rowIndex}: ${wsnUpper} (latest: ${latestWSN})`,
              );
              return;
            }

            // ⚡ SHOW DATA IMMEDIATELY if we have master data
            if (masterInfo) {
              // ⚡ BATCH MODE: Check if WSN is in selected batch(es)
              if (selectedBatchIds.length > 0) {
                const wsnBatch = await isWSNInCachedBatches(wsnUpper);
                if (!wsnBatch) {
                  // WSN not in selected batch - show confirmation dialog
                  setWsnNotInBatchDialog({
                    open: true,
                    wsn: wsnUpper,
                    rowIndex,
                    masterData: masterInfo,
                  });
                  // Don't auto-apply master data - wait for user confirmation
                  return;
                }
              }

              // Update master data in grid IMMEDIATELY
              setMultiRows((prevRows) => {
                const currentWSN = prevRows[rowIndex]?.wsn
                  ?.trim()
                  ?.toUpperCase();
                if (currentWSN !== wsnUpper) {
                  return prevRows;
                }

                const updatedRows = [...prevRows];
                updatedRows[rowIndex] = { ...updatedRows[rowIndex] };
                ALL_MASTER_COLUMNS.forEach((masterCol) => {
                  updatedRows[rowIndex][masterCol] =
                    masterInfo[masterCol] || null;
                });

                // ⚡ CTRL+P REPRINT: Save last scanned row data for Ctrl+P shortcut
                lastScannedRowRef.current = {
                  ...updatedRows[rowIndex],
                  wsn: wsnUpper,
                };

                // ⚡ SYNC: Broadcast row with master data to other devices
                queueRowSync(rowIndex, updatedRows[rowIndex]);

                return updatedRows;
              });

              // ⚡ MOVE TO NEXT ROW IMMEDIATELY (don't wait for print/ownership)
              moveToNextRow();

              // ✅ AUTO-PRINT: Only if multiPrintEnabled is ON (background, non-blocking)
              if (multiPrintEnabled) {
                (async () => {
                  try {
                    const printPayload = {
                      wsn: wsnUpper,
                      fsn: masterInfo.fsn || "",
                      wid: masterInfo.wid || "",
                      product_title: masterInfo.product_title || "",
                      brand: masterInfo.brand || "",
                      mrp: String(masterInfo.mrp || ""),
                      fsp: String(masterInfo.fsp || ""),
                      copies: 1,
                    };

                    const printSuccess = await printLabel(printPayload);
                    if (printSuccess) {
                      toast.success(`✓ Label printed: ${wsnUpper}`, {
                        duration: 2000,
                      });
                    }
                  } catch (printError: any) {
                    toast.error(`Print error: ${printError.message}`, {
                      duration: 3000,
                    });
                  }
                })();
              }
            }

            // ⚡ BACKGROUND: Check ownership (won't block cursor movement)
            const ownerResp = await ownershipPromise;
            const ownerItem =
              ownerResp?.data?.data?.[0] || ownerResp?.data?.[0] || null;

            if (ownerItem) {
              const ownerWarehouseId =
                ownerItem.warehouse_id ??
                ownerItem.warehouseId ??
                ownerItem.warehouseid ??
                null;

              if (
                ownerWarehouseId &&
                ownerWarehouseId !== activeWarehouse?.id
              ) {
                toast.error(
                  `WSN ${wsnUpper} already inbound in another warehouse`,
                  {
                    duration: 3000,
                    style: {
                      background: "#ffffff",
                      color: "#dc2626",
                      border: "2px solid #dc2626",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      fontWeight: 600,
                      fontSize: "14px",
                    },
                    icon: "❌",
                  },
                );

                setMultiRows((prev) => {
                  const updated = [...prev];
                  updated[rowIndex].wsn = "";
                  ALL_MASTER_COLUMNS.forEach((col) => {
                    updated[rowIndex][col] = null;
                  });
                  return updated;
                });
                // ✅ FIX: Use multiRowsRef.current after state update settles (newRows is stale here)
                setTimeout(() => checkDuplicates(multiRowsRef.current), 100);

                setTimeout(() => {
                  event.api.startEditingCell({
                    rowIndex: rowIndex,
                    colKey: "wsn",
                  });
                }, 50);
                return;
              }

              if (
                ownerWarehouseId &&
                ownerWarehouseId === activeWarehouse?.id
              ) {
                toast(`WSN ${wsnUpper} already inbound in this warehouse`, {
                  duration: 2500,
                  style: {
                    background: "#ffffff",
                    color: "#d97706",
                    border: "2px solid #f59e0b",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    fontWeight: 600,
                    fontSize: "14px",
                  },
                  icon: "⚠️",
                });

                setMultiRows((prev) => {
                  const updated = [...prev];
                  updated[rowIndex].wsn = "";
                  ALL_MASTER_COLUMNS.forEach((col) => {
                    updated[rowIndex][col] = null;
                  });
                  return updated;
                });
                // ✅ FIX: Use multiRowsRef.current after state update settles (newRows is stale here)
                setTimeout(() => checkDuplicates(multiRowsRef.current), 100);

                setTimeout(() => {
                  event.api.startEditingCell({
                    rowIndex: rowIndex,
                    colKey: "wsn",
                  });
                }, 50);
                return;
              }
            }

            // If no master data found, move to next row (may not have moved yet)
            if (!masterInfo) {
              console.log("WSN not found in master data");
              toast.error(
                `WSN ${wsnUpper} not found in master data. Upload product data first.`,
                {
                  duration: 4000,
                  icon: "❌",
                },
              );

              // ✅ Clear the WSN from grid — don't allow entries without master data
              setMultiRows((prev) => {
                const updated = [...prev];
                if (updated[rowIndex]) {
                  updated[rowIndex] = { ...updated[rowIndex], wsn: "" };
                  ALL_MASTER_COLUMNS.forEach((col) => {
                    updated[rowIndex][col] = null;
                  });
                }
                return updated;
              });

              // Re-focus on same cell for retry
              setTimeout(() => {
                event.api.startEditingCell({
                  rowIndex: rowIndex,
                  colKey: "wsn",
                });
              }, 100);
              return;
            }

            // moveToNextRow already called above after masterInfo display
          } catch (error) {
            console.log("WSN fetch error:", error);
            // On error, still try to move to next row so scanner isn't stuck
            moveToNextRow();
          }
        })();
      }

      // Only fetch master data for WSN
      if (field !== "wsn") {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          checkDuplicates(newRows);
        }, 200);
      }
    },
    [
      multiRows,
      selectedBatchIds,
      multiPrintEnabled,
      activeWarehouse,
      saveCellUndoAction,
      highlightRow,
      recordScanActivity,
      add500Rows,
      checkDuplicates,
      ensureRowVisible,
      addMultiRow,
      isWMSCacheEnabled,
      getPendingByWSNFast,
      getLocalMasterData,
      isWSNInCachedBatches,
      printLabel,
      setMultiRows,
      setWsnOverwriteDialog,
      setWsnNotInBatchDialog,
      queueRowSync,
    ],
  );

  // 📡 SSE: Real-time sync for multi-device updates
  useRealtimeSync({
    page: "inbound",
    warehouseId: activeWarehouse?.id,
    enabled: !!user && !!activeWarehouse,
    onDataSubmitted: useCallback(
      (data: any) => {
        toast.success(
          `${data.submittedBy} submitted ${data.successCount} entries from another device`,
          { duration: 4000, icon: "📡" },
        );
        // Add submitted WSNs to existing set for duplicate prevention
        if (data.submittedWSNs?.length) {
          setExistingInboundWSNs((prev) => {
            const updated = new Set(prev);
            data.submittedWSNs!.forEach((wsn: string) => updated.add(wsn));
            return updated;
          });
        }
        // Clear grid — data was submitted from another device, draft is now empty
        isSyncingRef.current = true;
        setMultiRows(generateEmptyRows(500));
        setCommonVehicle("");
        localStorage.removeItem("inbound_multiVehicleNumber");
        setDraftSavedAt(null);
        setDraftExists(false);
        lastSyncedWSNsRef.current = "";
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 300);
        // Refresh list data
        loadInboundList();
      },
      [loadInboundList],
    ),
    onDraftUpdated: useCallback((data: any) => {
      // Skip toast if we just received sync data (real-time sync already handles updates)
      if (Date.now() - lastSyncReceivedAtRef.current < 3000) return;
      toast("Draft updated from another device", {
        duration: 3000,
        icon: "📝",
      });
    }, []),
    onDraftCleared: useCallback(() => {
      toast("Draft cleared from another device", {
        duration: 3000,
        icon: "🗑️",
      });
      // Clear grid and reset draft state so stale data doesn't remain
      isSyncingRef.current = true;
      setMultiRows(generateEmptyRows(500));
      setCommonVehicle("");
      localStorage.removeItem("inbound_multiVehicleNumber");
      setDraftSavedAt(null);
      setDraftExists(false);
      lastSyncedWSNsRef.current = "";
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 300);
    }, []),
    onEntrySynced: useCallback((data: any) => {
      if (!data?.rows?.length) return;
      // Set syncing flag to prevent autosave from re-triggering sync
      isSyncingRef.current = true;
      lastSyncReceivedAtRef.current = Date.now();
      setMultiRows((prev) => {
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
        try {
          gridRef.current?.refreshCells({ force: true });
        } catch {
          /* ignore */
        }
        isSyncingRef.current = false;
      }, 150);
    }, []),
  });

  if (!activeWarehouse) {
    return (
      <AppLayout>
        <Box
          sx={{
            p: 6,
            textAlign: "center",
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              p: 5,
              background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
              borderRadius: 4,
              color: "white",
              boxShadow: "0 20px 60px rgba(30, 64, 175, 0.4)",
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              ⚠️ No active warehouse selected.
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Please go to Settings → Warehouses to set one.
            </Typography>
          </Box>
        </Box>
      </AppLayout>
    );
  }

  /////////////////////////////// UI RENDERING ///////////////////////////////////
  return (
    <AppLayout>
      <Toaster position="top-right" containerStyle={{ zIndex: 99999 }} />

      <Box
        sx={{
          p: { xs: 0.75, md: 1 },
          background: isDarkMode
            ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
            : "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
          height: "100vh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
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
        <Box
          ref={scrollContainerRef}
          sx={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: { xs: 0, sm: 1.5, md: 2 },
            py: { xs: 0, sm: 0.5, md: 0.5 },
            background: isDarkMode ? "#0f172a" : "#f8fafc",
          }}
        >
          {/* ==================== MAIN CONTENT AREA ==================== */}
          {visibleTabCodes[tabValue] === "list" && (
            <Paper
              sx={{
                p: 0,
                borderRadius: 2,
                boxShadow: isDarkMode
                  ? "0 4px 20px rgba(0,0,0,0.3)"
                  : "0 4px 20px rgba(0,0,0,0.08)",
                transition: "opacity 0.15s ease-in-out",
                background: isDarkMode ? "#0f172a" : "#f8fafc",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                //overflow: 'hidden',
              }}
            >
              {/* ==================== TAB: INBOUND LIST ==================== */}

              <Box
                sx={{
                  background: isDarkMode ? "#0f172a" : "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                  overflow: "hidden",
                  py: { xs: 0.25, sm: 0.5 },
                  borderRadius: 2,

                  // Paste inside the existing sx object
                  "& .MuiOutlinedInput-root": {
                    bgcolor: "transparent !important",
                    boxShadow: "none !important",
                    "&:hover": { bgcolor: "transparent !important" },
                    "&.Mui-focused": {
                      bgcolor: "transparent !important",
                      boxShadow: "none !important",
                    },
                  },
                  "& .MuiOutlinedInput-input": {
                    background: "transparent !important",
                  },
                  '& input[type="date"], & .MuiOutlinedInput-input[type="date"], & .MuiInputBase-input[type="date"]':
                    {
                      background: "transparent !important",
                      color: "inherit !important",
                      WebkitAppearance: "none !important",
                      MozAppearance: "textfield !important",
                      appearance: "none !important",
                      borderRadius: "6px !important",
                      padding: "0 6px !important",
                    },
                  '& input[type="date"]::-webkit-datetime-edit, & input[type="date"]::-webkit-datetime-edit-text, & input[type="date"]::-webkit-datetime-edit-month-field, & input[type="date"]::-webkit-datetime-edit-day-field, & input[type="date"]::-webkit-datetime-edit-year-field':
                    {
                      background: "transparent !important",
                      color: "inherit !important",
                    },
                  '& input[type="date"]::-webkit-calendar-picker-indicator': {
                    WebkitAppearance: "none",
                    appearance: "none",
                    background: "transparent",
                    padding: 0,
                    margin: 0,
                  },
                  "& input:-webkit-autofill": {
                    WebkitBoxShadow: "0 0 0 1000px transparent inset",
                    boxShadow: "0 0 0 1000px transparent inset",
                    WebkitTextFillColor: "inherit",
                  },
                }}
              >
                {/* SEARCH BAR + FILTERS TOGGLE */}
                <Box
                  sx={{
                    flexShrink: 0,
                    mb: 0,
                    mt: 0,
                    background: isDarkMode ? "#0f172a" : "#f8fafc",
                    borderBottom: "transparent",
                    position: "relative",
                    zIndex: 95,
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="stretch"
                    sx={{ mb: { xs: 0.5, sm: 1 } }}
                  >
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

                        if (searchDebounceRef.current)
                          clearTimeout(searchDebounceRef.current);
                        searchDebounceRef.current = setTimeout(() => {
                          setSearchPending(false);
                          setSearchFilter(v);
                          setPage(1);
                        }, SEARCH_DEBOUNCE_MS);
                      }}
                      InputProps={{
                        endAdornment:
                          searchPending || listLoading ? (
                            <InputAdornment position="end">
                              <CircularProgress size={16} />
                            </InputAdornment>
                          ) : undefined,
                      }}
                      sx={{
                        flex: 1,
                        "& .MuiOutlinedInput-root": {
                          bgcolor: isDarkMode ? "#1e293b" : "white",
                          borderRadius: 1.5,
                          height: 38,
                          fontSize: { xs: "0.8rem", sm: "0.875rem" },
                          fontWeight: 500,
                          border: isDarkMode
                            ? "2px solid rgba(255,255,255,0.15)"
                            : "2px solid #e2e8f0",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                          "&:hover": {
                            borderColor: isDarkMode
                              ? "rgba(255,255,255,0.25)"
                              : "#cbd5e1",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          },
                          "&.Mui-focused": {
                            borderColor: "#1e40af",
                            boxShadow: "0 4px 16px rgba(30, 64, 175, 0.2)",
                          },
                          "& fieldset": {
                            border: "none",
                          },
                          "& input": {
                            py: 0.75,
                            color: isDarkMode ? "#f1f5f9" : "inherit",
                          },
                        },
                      }}
                    />

                    {/* Options Button - Opens Options Panel Drawer (works on both mobile and desktop) */}
                    <Tooltip title="Open Options Panel">
                      <Button
                        variant="outlined"
                        onClick={() => setListOptionsPanelOpen(true)}
                        sx={{
                          minWidth: { xs: "auto", sm: 100 },
                          height: 38,
                          borderWidth: 2,
                          borderColor: isDarkMode ? "#3b82f6" : "#1e40af",
                          bgcolor: isDarkMode
                            ? "rgba(59, 130, 246, 0.08)"
                            : "rgba(30, 64, 175, 0.04)",
                          color: isDarkMode ? "#60a5fa" : "#1e40af",
                          fontWeight: 700,
                          fontSize: { xs: "0.75rem", sm: "0.78rem" },
                          borderRadius: 1.5,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                          transition: "all 0.2s",
                          px: { xs: 1.5, sm: 2 },
                          "&:hover": {
                            borderWidth: 2,
                            borderColor: "#3b82f6",
                            bgcolor: "rgba(59, 130, 246, 0.12)",
                            boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)",
                          },
                          position: "relative",
                        }}
                      >
                        <MenuIcon
                          sx={{ fontSize: "1.1rem", mr: { xs: 0, sm: 0.5 } }}
                        />
                        <Box
                          component="span"
                          sx={{ display: { xs: "none", sm: "inline" } }}
                        >
                          Options
                        </Box>
                        {/* Green dot indicator when filters are active */}
                        {filtersActive && (
                          <Box
                            sx={{
                              position: "absolute",
                              top: -4,
                              right: -4,
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              bgcolor: "#10b981",
                              border: "2px solid white",
                              boxShadow: "0 2px 4px rgba(16, 185, 129, 0.4)",
                            }}
                          />
                        )}
                      </Button>
                    </Tooltip>
                  </Stack>
                </Box>

                {/* TABLE (AG GRID) - HORIZONTAL SCROLL: Replaced Table with AG Grid to improve column sizing and interactions while keeping filters/export/pagination unchanged */}
                <Box
                  sx={{
                    position: "relative",
                    flex: 1,
                    overflow: "hidden",
                    minHeight: 0,
                    border: isDarkMode
                      ? "1px solid rgba(255,255,255,0.1)"
                      : "1px solid #d1d5db",
                    borderBottom: "none",
                    borderRadius: "12px 12px 0 0",
                    boxShadow: isDarkMode
                      ? "0 2px 8px rgba(0,0,0,0.3)"
                      : "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  {/* Loading Spinner Overlay - semi-transparent so data stays visible */}
                  {listLoading &&
                    listData &&
                    listData.length > 0 &&
                    gridDataRendered && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: isDarkMode
                            ? "rgba(15, 23, 42, 0.5)"
                            : "rgba(255, 255, 255, 0.5)",
                          zIndex: 100,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1.5,
                            p: 3,
                            bgcolor: isDarkMode
                              ? "rgba(30, 41, 59, 0.95)"
                              : "rgba(255, 255, 255, 0.95)",
                            borderRadius: 2,
                            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                          }}
                        >
                          <CircularProgress
                            size={40}
                            thickness={4}
                            sx={{ color: "#1e40af" }}
                          />
                          <Typography
                            sx={{
                              fontSize: "0.85rem",
                              fontWeight: 500,
                              color: isDarkMode ? "#94a3b8" : "#64748b",
                            }}
                          >
                            Loading...
                          </Typography>
                        </Box>
                      </Box>
                    )}

                  {/* Empty State Overlay */}
                  {!listLoading &&
                    dataResponseReceived &&
                    (!listData || listData.length === 0) && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 32,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: isDarkMode
                            ? "rgba(15, 23, 42, 0.95)"
                            : "rgba(255, 255, 255, 0.95)",
                          zIndex: 5,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Box
                          sx={{
                            textAlign: "center",
                            p: 4,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <Box
                            sx={{
                              fontSize: "4rem",
                              opacity: 0.3,
                              mb: 1,
                            }}
                          >
                            📭
                          </Box>
                          <Typography
                            variant="h5"
                            sx={{ fontWeight: 600, color: "#6b7280", mb: 0.5 }}
                          >
                            No Data Found
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "#9ca3af", maxWidth: 400 }}
                          >
                            No inbound items match your current filters. Try
                            adjusting your search criteria or reset filters to
                            see all items.
                          </Typography>
                        </Box>
                      </Box>
                    )}

                  {/* AG Grid - Always Rendered */}
                  <Box
                    className="ag-theme-quartz"
                    sx={{
                      height: "100%",
                      width: "100%",
                      bgcolor: isDarkMode ? "#1e293b" : "#ffffff",
                      border: isDarkMode
                        ? "1px solid #475569"
                        : "1px solid #d1d5db",
                      borderRadius: "4px",
                      overflow: "hidden",
                      "& .ag-root-wrapper": {
                        backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                        border: "none",
                      },
                      "& .ag-header": {
                        backgroundColor: "#1e3a5f !important",
                        borderBottom: isDarkMode
                          ? "2px solid #10b981"
                          : "2px solid #059669",
                        fontWeight: 700,
                        opacity: "1 !important",
                        zIndex: 15,
                        position: "relative",
                      },
                      "& .ag-header-cell": {
                        padding: "0 12px",
                        opacity: "1 !important",
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        backgroundColor: "#1e3a5f !important",
                        color: "#ffffff !important",
                        borderRight: "1px solid #3b5998",
                        textTransform: "uppercase",
                        letterSpacing: "0.02em",
                      },
                      "& .ag-header-cell:last-child": {
                        borderRight: "none",
                      },
                      "& .ag-header-row": {
                        backgroundColor: "#1e3a5f !important",
                      },
                      "& .ag-header-viewport": {
                        backgroundColor: "#1e3a5f !important",
                      },
                      "& .ag-header-container": {
                        backgroundColor: "#1e3a5f !important",
                      },
                      "& .ag-header-cell-label": {
                        color: "#ffffff !important",
                      },
                      "& .ag-header-cell-text": {
                        color: "#ffffff !important",
                      },
                      "& .ag-icon": {
                        color: "#94a3b8 !important",
                      },
                      "& .ag-body-viewport": {
                        opacity: listLoading ? 0.3 : 1,
                        transition: "opacity 0.2s ease-in-out",
                        backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                      },
                      "& .ag-center-cols-viewport": {
                        backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                      },
                      "& .ag-center-cols-container": {
                        backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                      },
                      "& .ag-body": {
                        backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                      },
                      "& .ag-row": {
                        borderBottom: isDarkMode
                          ? "1px solid #334155"
                          : "1px solid #e5e7eb",
                      },
                      "& .ag-row-even": {
                        backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                      },
                      "& .ag-row-odd": {
                        backgroundColor: isDarkMode ? "#1a2536" : "#f8fafc",
                      },
                      "& .ag-cell": {
                        borderRight: isDarkMode
                          ? "1px solid #334155"
                          : "1px solid #e5e7eb",
                        color: isDarkMode ? "#f1f5f9" : "#1e293b",
                        display: "flex",
                        alignItems: "center",
                      },
                      "& .ag-cell:last-child": {
                        borderRight: "none",
                      },
                      "& .ag-row-hover": {
                        backgroundColor: isDarkMode
                          ? "rgba(59, 130, 246, 0.15) !important"
                          : "#eff6ff !important",
                      },
                      "& .ag-cell-focus": {
                        border: isDarkMode
                          ? "2px solid #38bdf8 !important"
                          : "2px solid #2563eb !important",
                        outline: "none",
                      },
                      "& .ag-cell-range-selected": {
                        backgroundColor: isDarkMode
                          ? "rgba(59, 130, 246, 0.25) !important"
                          : "#dbeafe !important",
                      },
                    }}
                  >
                    <AgGridReact
                      rowData={listData}
                      columnDefs={inboundColumnDefs}
                      defaultColDef={inboundDefaultColDef}
                      context={{ page, limit }}
                      suppressScrollOnNewData={true}
                      maintainColumnOrder={true}
                      ensureDomOrder={true}
                      enableCellTextSelection={true}
                      suppressRowTransform={false}
                      // ⚡ Performance optimizations for large datasets
                      rowBuffer={20}
                      valueCache={true}
                      debounceVerticalScrollbar={true}
                      suppressAnimationFrame={false}
                      alwaysShowVerticalScroll={true}
                      onGridReady={(params: any) => {
                        listGridRef.current = params.api;
                        columnApiRef.current = params.api;
                        // Simple localStorage restore
                        try {
                          const saved = localStorage.getItem(
                            "inbound_list_grid_state",
                          );
                          if (saved && params.api) {
                            params.api.applyColumnState({
                              state: JSON.parse(saved),
                              applyOrder: true,
                            });
                            hasAutoFittedRef.current = true;
                          } else {
                            // No saved state - hide columns not in listColumns
                            const allColIds =
                              params.api
                                .getColumns()
                                ?.map((c: any) => c.getColId()) || [];
                            allColIds.forEach((colId: string) => {
                              if (colId === "__sr") return;
                              const shouldShow = listColumns.includes(colId);
                              params.api.setColumnsVisible([colId], shouldShow);
                            });
                          }
                        } catch {
                          /* ignore */
                        }
                      }}
                      onColumnResized={(params: any) => {
                        if (params.finished && params.api) {
                          try {
                            const state = params.api.getColumnState();
                            localStorage.setItem(
                              "inbound_list_grid_state",
                              JSON.stringify(state),
                            );
                          } catch {
                            /* ignore */
                          }
                        }
                      }}
                      onColumnMoved={(params: any) => {
                        if (params.finished && params.api) {
                          try {
                            const state = params.api.getColumnState();
                            localStorage.setItem(
                              "inbound_list_grid_state",
                              JSON.stringify(state),
                            );
                          } catch {
                            /* ignore */
                          }
                        }
                      }}
                      onColumnVisible={(params: any) => {
                        // Save state when column visibility changes
                        // BUT skip if we're in the middle of restoring state (columnDefs change)
                        if (params.api && !isRestoringStateRef.current) {
                          try {
                            const state = params.api.getColumnState();
                            localStorage.setItem(
                              "inbound_list_grid_state",
                              JSON.stringify(state),
                            );
                          } catch {
                            /* ignore */
                          }
                        }
                      }}
                      onFirstDataRendered={(params: any) => {
                        // Auto-size columns on first load if no saved state
                        if (!hasAutoFittedRef.current && params.api) {
                          try {
                            const allColIds =
                              params.api
                                .getColumns()
                                ?.filter(
                                  (col: any) =>
                                    col.getColId() !== "__action" &&
                                    col.getColId() !== "__sr",
                                )
                                .map((col: any) => col.getColId()) || [];
                            if (allColIds.length > 0) {
                              params.api.autoSizeColumns(allColIds);
                            }
                            hasAutoFittedRef.current = true;
                            // Mark grid as rendered after columns are sized
                            setTimeout(() => {
                              requestAnimationFrame(() =>
                                setGridDataRendered(true),
                              );
                            }, 50);
                          } catch {
                            requestAnimationFrame(() =>
                              setGridDataRendered(true),
                            );
                          }
                        } else {
                          requestAnimationFrame(() =>
                            setGridDataRendered(true),
                          );
                        }
                      }}
                      animateRows={false}
                      rowSelection={{
                        mode: "singleRow",
                        checkboxes: false,
                        enableClickSelection: true,
                      }}
                      loading={false}
                      suppressNoRowsOverlay={true}
                      containerStyle={{ height: "100%", width: "100%" }}
                      rowHeight={tableRowHeight}
                      headerHeight={32}
                    />
                  </Box>

                  {/* Initial Loading Overlay - positioned below header */}
                  {((listLoading && (!listData || listData.length === 0)) ||
                    (listData && listData.length > 0 && !gridDataRendered)) && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 32,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        bgcolor: isDarkMode ? "#1e293b" : "#ffffff",
                        zIndex: 50,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 2,
                        }}
                      >
                        <CircularProgress
                          size={40}
                          thickness={4}
                          sx={{ color: "#1e40af" }}
                        />
                        <Typography
                          sx={{
                            fontSize: "0.85rem",
                            fontWeight: 500,
                            color: isDarkMode ? "#94a3b8" : "#64748b",
                          }}
                        >
                          Loading inbound data...
                        </Typography>
                      </Box>
                    </Box>
                  )}
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
                      borderTop: isDarkMode
                        ? "1px solid rgba(255,255,255,0.1)"
                        : "1px solid #d1d5db",
                      borderLeft: isDarkMode
                        ? "1px solid rgba(255,255,255,0.1)"
                        : "1px solid #d1d5db",
                      borderRight: isDarkMode
                        ? "1px solid rgba(255,255,255,0.1)"
                        : "1px solid #d1d5db",
                      borderBottom: isDarkMode
                        ? "1px solid rgba(255,255,255,0.1)"
                        : "1px solid #d1d5db",
                      borderRadius: "0 0 12px 12px",
                      bgcolor: isDarkMode ? "#1e293b" : "white",
                      flexShrink: 0,
                      minHeight: { xs: 44, sm: 52 },
                      gap: { xs: 0.5, sm: 1 },
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Left Section: Per Page + Last Refresh */}
                    <Stack
                      direction="row"
                      spacing={{ xs: 0.5, sm: 1.5 }}
                      alignItems="center"
                    >
                      <Typography
                        sx={{
                          fontSize: { xs: "0.7rem", sm: "0.78rem" },
                          whiteSpace: "nowrap",
                          color: isDarkMode ? "#94a3b8" : "inherit",
                        }}
                      >
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
                          "& .MuiSelect-select": {
                            py: { xs: 0.5, sm: 0.75 },
                            fontSize: { xs: "0.75rem", sm: "0.875rem" },
                          },
                        }}
                      >
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                        <MenuItem value={500}>500</MenuItem>
                        <MenuItem value={1000}>1000</MenuItem>
                      </Select>

                      {/* Last Refresh Time Indicator */}
                      {lastRefreshTime && !isMobile && (
                        <Tooltip
                          title={`Last updated: ${lastRefreshTime.toLocaleTimeString()}`}
                        >
                          <Stack
                            direction="row"
                            spacing={0.5}
                            alignItems="center"
                            sx={{ ml: 1 }}
                          >
                            <AccessTime
                              sx={{
                                fontSize: 14,
                                color: isDarkMode ? "#64748b" : "#94a3b8",
                              }}
                            />
                            <Typography
                              sx={{
                                fontSize: "0.7rem",
                                color: isDarkMode ? "#64748b" : "#94a3b8",
                              }}
                            >
                              {(() => {
                                const seconds = Math.floor(
                                  (new Date().getTime() -
                                    lastRefreshTime.getTime()) /
                                    1000,
                                );
                                if (seconds < 10) return "just now";
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
                        color: isDarkMode ? "#94a3b8" : "inherit",
                      }}
                    >
                      {listData.length > 0 ? (page - 1) * limit + 1 : 0} –{" "}
                      {Math.min(page * limit, total)} of {total}
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

                        <Typography
                          sx={{
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            minWidth: 50,
                            textAlign: "center",
                          }}
                        >
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
                            "& .MuiPaginationItem-root": {
                              color: isDarkMode ? "#94a3b8" : "inherit",
                            },
                            "& .Mui-selected": {
                              bgcolor: isDarkMode
                                ? "rgba(59, 130, 246, 0.3) !important"
                                : "rgba(25, 118, 210, 0.12) !important",
                            },
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
                  fullScreen={isMobile}
                  PaperProps={{
                    sx: {
                      borderRadius: 3,
                      boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
                      overflow: "hidden",
                      bgcolor: isDarkMode ? "#0f172a" : "background.paper",
                    },
                  }}
                >
                  <DialogTitle
                    sx={{
                      fontWeight: 800,
                      background:
                        "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "white",
                      py: 3,
                      px: 3,
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                    }}
                  >
                    <DownloadIcon sx={{ fontSize: "1.5rem" }} />
                    Advanced Export Options
                    <Typography
                      variant="caption"
                      sx={{ ml: "auto", opacity: 0.8, fontSize: "0.7rem" }}
                    >
                      Filter & Download
                    </Typography>
                  </DialogTitle>

                  <DialogContent
                    sx={{
                      py: 4,
                      px: 3,
                      bgcolor: isDarkMode ? "#0f172a" : "background.paper",
                    }}
                  >
                    <Stack spacing={3}>
                      {/* CURRENT FILTERS PREVIEW */}
                      <Alert
                        severity="info"
                        icon={<InfoIcon />}
                        sx={{
                          fontSize: "0.85rem",
                          borderRadius: 2,
                          bgcolor: isDarkMode
                            ? "rgba(14, 165, 233, 0.1)"
                            : undefined,
                          border: isDarkMode
                            ? "1px solid rgba(14, 165, 233, 0.3)"
                            : undefined,
                          "& .MuiAlert-icon": { color: "#0ea5e9" },
                          "& .MuiAlert-message": {
                            color: isDarkMode ? "#f1f5f9" : undefined,
                          },
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 700, mb: 1, color: "#0ea5e9" }}
                        >
                          📋 Applied Filters Preview:
                        </Typography>
                        <Box
                          sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 1,
                            mt: 1,
                          }}
                        >
                          {searchFilter && (
                            <Chip
                              size="small"
                              label={`🔍 "${searchFilter}"`}
                              sx={{
                                bgcolor: isDarkMode
                                  ? "rgba(59, 130, 246, 0.2)"
                                  : "#dbeafe",
                                color: isDarkMode ? "#93c5fd" : "#1e40af",
                              }}
                            />
                          )}
                          {brandFilter && (
                            <Chip
                              size="small"
                              label={`🏷️ ${brandFilter}`}
                              sx={{
                                bgcolor: isDarkMode
                                  ? "rgba(34, 197, 94, 0.2)"
                                  : "#dcfce7",
                                color: isDarkMode ? "#86efac" : "#166534",
                              }}
                            />
                          )}
                          {categoryFilter && (
                            <Chip
                              size="small"
                              label={`📂 ${categoryFilter}`}
                              sx={{
                                bgcolor: isDarkMode
                                  ? "rgba(245, 158, 11, 0.2)"
                                  : "#fef3c7",
                                color: isDarkMode ? "#fcd34d" : "#92400e",
                              }}
                            />
                          )}
                          {(exportStartDate || dateFromFilter) && (
                            <Chip
                              size="small"
                              label={`📅 From: ${exportStartDate || dateFromFilter}`}
                              sx={{
                                bgcolor: isDarkMode
                                  ? "rgba(99, 102, 241, 0.2)"
                                  : "#e0e7ff",
                                color: isDarkMode ? "#a5b4fc" : "#3730a3",
                              }}
                            />
                          )}
                          {(exportEndDate || dateToFilter) && (
                            <Chip
                              size="small"
                              label={`📅 To: ${exportEndDate || dateToFilter}`}
                              sx={{
                                bgcolor: isDarkMode
                                  ? "rgba(99, 102, 241, 0.2)"
                                  : "#e0e7ff",
                                color: isDarkMode ? "#a5b4fc" : "#3730a3",
                              }}
                            />
                          )}
                          {exportBatchIds && exportBatchIds.length > 0 && (
                            <Chip
                              size="small"
                              label={`📦 ${exportBatchIds.length} Batch${exportBatchIds.length > 1 ? "es" : ""}`}
                              sx={{
                                bgcolor: isDarkMode
                                  ? "rgba(168, 85, 247, 0.2)"
                                  : "#f3e8ff",
                                color: isDarkMode ? "#c4b5fd" : "#6b21a8",
                              }}
                            />
                          )}
                          {!exportStartDate &&
                            !exportEndDate &&
                            (!exportBatchIds || exportBatchIds.length === 0) &&
                            !searchFilter &&
                            !brandFilter &&
                            !categoryFilter &&
                            !dateFromFilter &&
                            !dateToFilter && (
                              <Chip
                                size="small"
                                label="🔍 All Data"
                                sx={{
                                  bgcolor: isDarkMode
                                    ? "rgba(239, 68, 68, 0.2)"
                                    : "#fee2e2",
                                  color: isDarkMode ? "#fca5a5" : "#dc2626",
                                }}
                              />
                            )}
                        </Box>
                      </Alert>

                      {/* DIVIDER WITH ICON */}
                      <Divider
                        sx={{
                          "&::before, &::after": {
                            borderColor: isDarkMode
                              ? "rgba(255,255,255,0.1)"
                              : "#e5e7eb",
                          },
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            px: 2,
                            py: 0.5,
                            bgcolor: isDarkMode ? "#334155" : "#f9fafb",
                            borderRadius: 2,
                            border: isDarkMode
                              ? "1px solid rgba(255,255,255,0.15)"
                              : "1px solid #e5e7eb",
                          }}
                        >
                          <SettingsIcon
                            sx={{
                              fontSize: "1rem",
                              color: isDarkMode ? "#94a3b8" : "#6b7280",
                            }}
                          />
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: isDarkMode ? "#e2e8f0" : "#6b7280",
                            }}
                          >
                            Override Filters (Optional)
                          </Typography>
                        </Box>
                      </Divider>

                      {/* OVERRIDE CONTROLS */}
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                          gap: 2,
                        }}
                      >
                        <TextField
                          fullWidth
                          label="Start Date Override"
                          type="date"
                          InputLabelProps={{ shrink: true }}
                          value={exportStartDate}
                          onChange={(e) => setExportStartDate(e.target.value)}
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              borderRadius: 2,
                              "&:hover fieldset": { borderColor: "#10b981" },
                              "&.Mui-focused fieldset": {
                                borderColor: "#10b981",
                              },
                            },
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
                            "& .MuiOutlinedInput-root": {
                              borderRadius: 2,
                              "&:hover fieldset": { borderColor: "#10b981" },
                              "&.Mui-focused fieldset": {
                                borderColor: "#10b981",
                              },
                            },
                          }}
                        />
                      </Box>

                      {/* BATCH SELECTION */}
                      <FormControl fullWidth>
                        <InputLabel
                          sx={{ "&.Mui-focused": { color: "#10b981" } }}
                        >
                          Select Batch IDs (Multiple)
                        </InputLabel>
                        <Select
                          multiple
                          value={exportBatchIds}
                          onChange={(e) =>
                            setExportBatchIds(e.target.value as string[])
                          }
                          renderValue={(selected) => (
                            <Box
                              sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 0.5,
                              }}
                            >
                              {selected.map((value) => (
                                <Chip
                                  key={value}
                                  label={value}
                                  size="small"
                                  onDelete={() =>
                                    setExportBatchIds(
                                      exportBatchIds.filter((b) => b !== value),
                                    )
                                  }
                                  sx={{
                                    bgcolor: "#10b981",
                                    color: "white",
                                    "& .MuiChip-deleteIcon": {
                                      color: "white",
                                      "&:hover": { color: "#a7f3d0" },
                                    },
                                  }}
                                />
                              ))}
                            </Box>
                          )}
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              borderRadius: 2,
                              "&:hover fieldset": { borderColor: "#10b981" },
                              "&.Mui-focused fieldset": {
                                borderColor: "#10b981",
                              },
                            },
                          }}
                        >
                          {batches.map((b) => (
                            <MenuItem
                              key={b.batch_id}
                              value={b.batch_id}
                              sx={{ py: 1 }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  width: "100%",
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {b.batch_id}
                                </Typography>
                                <Chip
                                  label={`${b.count} entries`}
                                  size="small"
                                  sx={{
                                    bgcolor: isDarkMode ? "#334155" : "#e5e7eb",
                                    color: isDarkMode ? "#94a3b8" : "#374151",
                                    fontSize: "0.7rem",
                                    height: "20px",
                                  }}
                                />
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {/* EXPORT SUMMARY */}
                      <Card
                        sx={{
                          bgcolor: isDarkMode
                            ? "rgba(16, 185, 129, 0.1)"
                            : "#f0fdf4",
                          border: isDarkMode
                            ? "1px solid rgba(16, 185, 129, 0.3)"
                            : "1px solid #bbf7d0",
                          borderRadius: 2,
                        }}
                      >
                        <CardContent sx={{ py: 2, px: 3 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 700,
                              color: isDarkMode ? "#34d399" : "#166534",
                              mb: 1,
                            }}
                          >
                            📊 Export Summary:
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: isDarkMode ? "#a7f3d0" : "#166534" }}
                          >
                            This will export filtered inbound records to Excel
                            with all selected criteria applied. The file will
                            include product details, dates, and batch
                            information.
                          </Typography>
                        </CardContent>
                      </Card>
                    </Stack>
                  </DialogContent>

                  <DialogActions
                    sx={{
                      p: 3,
                      bgcolor: isDarkMode ? "#1e293b" : "#f9fafb",
                      borderTop: isDarkMode
                        ? "1px solid rgba(255,255,255,0.1)"
                        : "1px solid #e5e7eb",
                      gap: 1,
                    }}
                  >
                    <Button
                      onClick={() => setExportDialogOpen(false)}
                      sx={{
                        borderRadius: 2,
                        px: 3,
                        fontWeight: 600,
                        color: isDarkMode ? "#94a3b8" : "#6b7280",
                        "&:hover": {
                          bgcolor: isDarkMode ? "#334155" : "#e5e7eb",
                        },
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
                        fontSize: "0.9rem",
                        background:
                          "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
                        "&:hover": {
                          background:
                            "linear-gradient(135deg, #059669 0%, #047857 100%)",
                          boxShadow: "0 6px 20px rgba(16, 185, 129, 0.4)",
                          transform: "translateY(-1px)",
                        },
                        transition: "all 0.2s ease-in-out",
                      }}
                    >
                      Export Data
                    </Button>
                  </DialogActions>
                </Dialog>

                {/* ⚡ INBOUND MULTI-ENTRY EXPORT COLUMN PICKER DIALOG */}
                <Dialog
                  open={inboundExportDialogOpen}
                  onClose={() => setInboundExportDialogOpen(false)}
                  maxWidth="sm"
                  fullWidth
                  fullScreen={isMobile}
                  container={
                    isFullscreen ? multiEntryContainerRef.current : undefined
                  }
                >
                  <DialogTitle
                    sx={{ display: "flex", alignItems: "center", gap: 1 }}
                  >
                    <DownloadIcon sx={{ color: "#16a34a" }} />
                    Select Export Columns
                  </DialogTitle>
                  <DialogContent dividers>
                    <Box
                      sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}
                    >
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          setInboundExportSelectedColumns(
                            INBOUND_EXPORT_COLUMNS_CONFIG.map((c) => c.key),
                          )
                        }
                      >
                        Select All
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setInboundExportSelectedColumns([])}
                      >
                        Deselect All
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          setInboundExportSelectedColumns(
                            INBOUND_DEFAULT_EXPORT_COLUMNS,
                          )
                        }
                      >
                        Reset Default
                      </Button>
                    </Box>
                    <Stack spacing={0.5}>
                      {INBOUND_EXPORT_COLUMNS_CONFIG.map((col) => (
                        <FormControlLabel
                          key={col.key}
                          control={
                            <Checkbox
                              checked={inboundExportSelectedColumns.includes(
                                col.key,
                              )}
                              onChange={() => {
                                setInboundExportSelectedColumns((prev) =>
                                  prev.includes(col.key)
                                    ? prev.filter((k) => k !== col.key)
                                    : [...prev, col.key],
                                );
                              }}
                              size="small"
                            />
                          }
                          label={
                            <Typography variant="body2">{col.label}</Typography>
                          }
                        />
                      ))}
                    </Stack>
                    <FormControlLabel
                      sx={{ mt: 2 }}
                      control={
                        <Checkbox
                          checked={inboundExportRemember}
                          onChange={(e) =>
                            setInboundExportRemember(e.target.checked)
                          }
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2">
                          Remember my selection
                        </Typography>
                      }
                    />
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setInboundExportDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      disabled={inboundExportSelectedColumns.length === 0}
                      onClick={() =>
                        exportMultiEntryToExcel(inboundExportSelectedColumns)
                      }
                      startIcon={<DownloadIcon />}
                      sx={{
                        background:
                          "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      }}
                    >
                      Export ({inboundExportSelectedColumns.length} columns)
                    </Button>
                  </DialogActions>
                </Dialog>

                {/* INBOUND TAB: COLUMN SETTINGS DIALOG */}
                <Dialog
                  open={listColumnSettingsOpen}
                  onClose={() => setListColumnSettingsOpen(false)}
                  maxWidth="sm"
                  fullWidth
                  fullScreen={isMobile}
                >
                  <DialogTitle
                    sx={{
                      fontWeight: 800,
                      background:
                        "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                      color: "white",
                      py: 2.5,
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    ⚙️ List Columns
                    <Button
                      type="button"
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGridSettingsOpen(true);
                      }}
                      disabled={!true}
                      sx={{
                        ml: "auto",
                        height: 30,
                        borderColor: "#94a3b8",
                        color: "#fff",
                        bgcolor: "rgba(255,255,255,0.08)",
                        borderWidth: 1,
                      }}
                    >
                      Grid Settings
                    </Button>
                  </DialogTitle>
                  <DialogContent
                    sx={{ py: 3, maxHeight: 500, overflow: "auto" }}
                  >
                    <Stack spacing={1.5}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 800,
                          color: "#1e40af",
                          fontSize: "0.8rem",
                          textTransform: "uppercase",
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
                                  next = listColumns.filter(
                                    (c: string) => c !== col,
                                  );
                                }

                                // order same rakho
                                const ordered = INBOUND_LIST_COLUMNS.concat(
                                  ALL_MASTER_COLUMNS.filter(
                                    (c) => !INBOUND_LIST_COLUMNS.includes(c),
                                  ),
                                ).filter((c) => next.includes(c));

                                saveListColumnSettings(ordered);
                              }}
                            />
                          }
                          label={col.toUpperCase().replace(/_/g, " ")}
                        />
                      ))}

                      <Divider sx={{ my: 1.5 }} />
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          color: "#3b82f6",
                          fontSize: "0.7rem",
                        }}
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
                                  next = listColumns.filter(
                                    (c: string) => c !== col,
                                  );
                                }

                                const ordered = INBOUND_LIST_COLUMNS.concat(
                                  ALL_MASTER_COLUMNS.filter(
                                    (c) => !INBOUND_LIST_COLUMNS.includes(c),
                                  ),
                                ).filter((c) => next.includes(c));

                                saveListColumnSettings(ordered);
                              }}
                            />
                          }
                          label={col.toUpperCase().replace(/_/g, " ")}
                        />
                      ))}
                    </Stack>
                  </DialogContent>
                  <DialogActions sx={{ p: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => setListColumnSettingsOpen(false)}
                      sx={{
                        background:
                          "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                      }}
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
                      boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                    },
                  }}
                >
                  <DialogTitle
                    sx={{
                      background:
                        "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      color: "white",
                      fontWeight: 800,
                      fontSize: "1.1rem",
                      py: 1.5,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <SettingsIcon />
                      Grid Settings
                    </Box>
                  </DialogTitle>

                  <DialogContent sx={{ mt: 2, pb: 1 }}>
                    <Stack spacing={2.5}>
                      <Alert
                        severity="info"
                        sx={{ fontSize: "0.8rem", py: 0.5 }}
                      >
                        Settings auto-save and persist after reload 💾
                      </Alert>

                      {/* SORTABLE */}
                      <Box>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={gridSettings.sortable}
                              onChange={(e) =>
                                updateGridSettings({
                                  ...gridSettings,
                                  sortable: e.target.checked,
                                })
                              }
                              sx={{
                                "&.Mui-checked": { color: "#f59e0b" },
                              }}
                            />
                          }
                          label={
                            <Box>
                              <Typography
                                sx={{
                                  fontWeight: 700,
                                  fontSize: "0.95rem",
                                  color: "#1e293b",
                                }}
                              >
                                ⬆️ Enable Sorting
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: "#64748b", fontSize: "0.75rem" }}
                              >
                                Click column headers to sort
                                ascending/descending
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
                              onChange={(e) =>
                                updateGridSettings({
                                  ...gridSettings,
                                  filter: e.target.checked,
                                })
                              }
                              sx={{
                                "&.Mui-checked": { color: "#f59e0b" },
                              }}
                            />
                          }
                          label={
                            <Box>
                              <Typography
                                sx={{
                                  fontWeight: 700,
                                  fontSize: "0.95rem",
                                  color: "#1e293b",
                                }}
                              >
                                🔍 Enable Column Filters
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: "#64748b", fontSize: "0.75rem" }}
                              >
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
                              onChange={(e) =>
                                updateGridSettings({
                                  ...gridSettings,
                                  resizable: e.target.checked,
                                })
                              }
                              sx={{
                                "&.Mui-checked": { color: "#f59e0b" },
                              }}
                            />
                          }
                          label={
                            <Box>
                              <Typography
                                sx={{
                                  fontWeight: 700,
                                  fontSize: "0.95rem",
                                  color: "#1e293b",
                                }}
                              >
                                ↔️ Enable Column Resize
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: "#64748b", fontSize: "0.75rem" }}
                              >
                                Drag column borders to adjust width
                              </Typography>
                            </Box>
                          }
                        />
                      </Box>
                    </Stack>
                  </DialogContent>

                  <DialogActions sx={{ p: 2, background: "#fef3c7", gap: 1 }}>
                    <Button
                      onClick={() => {
                        const defaultSettings = {
                          sortable: true,
                          filter: true,
                          resizable: true,
                          editable: true,
                        };
                        updateGridSettings(defaultSettings);
                        toast.success("Settings reset to default");
                      }}
                      sx={{
                        fontWeight: 700,
                        color: "#78716c",
                        "&:hover": {
                          bgcolor: "rgba(120, 113, 108, 0.1)",
                        },
                      }}
                    >
                      🔄 Reset All
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Button
                      variant="contained"
                      onClick={() => setGridSettingsOpen(false)}
                      sx={{
                        background:
                          "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                        fontWeight: 700,
                        boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
                        "&:hover": {
                          background:
                            "linear-gradient(135deg, #d97706 0%, #b45309 100)",
                        },
                      }}
                    >
                      Close
                    </Button>
                  </DialogActions>
                </Dialog>
              </Box>
            </Paper>
          )}

          {/* TAB: SINGLE ENTRY */}
          {visibleTabCodes[tabValue] === "single" && (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: { xs: 1.5, sm: 2, lg: 2.5 },
                p: { xs: 1, sm: 1.5, md: 0.25 },
                height: "100%",
                overflow: "auto",
              }}
            >
              {/* Entry Form Card */}
              <Card
                sx={{
                  borderRadius: { xs: 2, sm: 2.5 },
                  boxShadow: isDarkMode
                    ? "0 2px 8px rgba(0,0,0,0.3)"
                    : {
                        xs: "0 2px 8px rgba(0,0,0,0.1)",
                        sm: "0 4px 16px rgba(0,0,0,0.08)",
                      },
                  height: { xs: "auto", lg: "fit-content" },
                  maxHeight: { xs: "70vh", lg: "none" },
                  overflow: { xs: "auto", lg: "visible" },
                  bgcolor: isDarkMode ? "#1e293b" : "white",
                }}
              >
                <CardContent sx={{ p: { xs: 1.2, sm: 1.5, md: 2 } }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      mb: { xs: 1, sm: 1.5 },
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 700,
                        color: isDarkMode ? "#f1f5f9" : "#1a237e",
                        fontSize: {
                          xs: "0.85rem",
                          sm: "0.9rem",
                          md: "0.95rem",
                        },
                      }}
                    >
                      📝 Entry Form
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: singlePrintEnabled ? "#16a34a" : "#dc2626",
                          fontWeight: 600,
                        }}
                      >
                        {singlePrintEnabled ? "🖨️ Print ON" : "🖨️ Print OFF"}
                      </Typography>
                      <Switch
                        size="small"
                        checked={singlePrintEnabled}
                        onChange={(e) =>
                          setSinglePrintEnabled(e.target.checked)
                        }
                        sx={{
                          "& .MuiSwitch-switchBase.Mui-checked": {
                            color: "#16a34a",
                          },
                          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                            {
                              backgroundColor: "#16a34a",
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
                        "& .MuiInputBase-input": {
                          fontSize: { xs: "0.85rem", sm: "0.875rem" },
                        },
                      }}
                    />

                    <TextField
                      fullWidth
                      size="small"
                      label="Inbound Date"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      value={singleForm.inbound_date}
                      onChange={(e) =>
                        setSingleForm({
                          ...singleForm,
                          inbound_date: e.target.value,
                        })
                      }
                      inputRef={singleInboundDateInputRef}
                      onClick={() => {
                        try {
                          singleInboundDateInputRef.current?.showPicker?.();
                        } catch {
                          singleInboundDateInputRef.current?.focus();
                        }
                      }}
                      sx={{
                        "& .MuiInputBase-root": {
                          cursor: "pointer",
                        },
                        "& .MuiInputBase-input": {
                          fontSize: { xs: "0.85rem", sm: "0.875rem" },
                          cursor: "pointer",
                        },
                      }}
                    />

                    <TextField
                      fullWidth
                      size="small"
                      label="Vehicle Number *"
                      value={singleForm.vehicle_no}
                      onChange={(e) =>
                        setSingleForm({
                          ...singleForm,
                          vehicle_no: e.target.value,
                        })
                      }
                      placeholder="Vehicle plate"
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: { xs: "0.85rem", sm: "0.875rem" },
                        },
                      }}
                    />

                    <FormControl fullWidth size="small">
                      <InputLabel
                        sx={{ fontSize: { xs: "0.85rem", sm: "0.875rem" } }}
                      >
                        Rack Number
                      </InputLabel>
                      <Select
                        value={singleForm.rack_no}
                        onChange={(e) =>
                          setSingleForm({
                            ...singleForm,
                            rack_no: e.target.value,
                          })
                        }
                        label="Rack Number"
                        sx={{
                          "& .MuiSelect-select": {
                            fontSize: { xs: "0.85rem", sm: "0.875rem" },
                          },
                        }}
                      >
                        <MenuItem value="">Select Rack</MenuItem>
                        {racks.map((r) => (
                          <MenuItem
                            key={r.id}
                            value={r.rack_name}
                            sx={{ fontSize: { xs: "0.85rem", sm: "0.875rem" } }}
                          >
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
                      onChange={(e) =>
                        setSingleForm({
                          ...singleForm,
                          product_serial_number: e.target.value,
                        })
                      }
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: { xs: "0.85rem", sm: "0.875rem" },
                        },
                      }}
                    />

                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      rows={3}
                      label="Unload Remarks"
                      value={singleForm.unload_remarks}
                      onChange={(e) =>
                        setSingleForm({
                          ...singleForm,
                          unload_remarks: e.target.value,
                        })
                      }
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: { xs: "0.85rem", sm: "0.875rem" },
                        },
                      }}
                    />

                    {duplicateWSN ? (
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                      >
                        <Button
                          fullWidth
                          variant="contained"
                          size="small"
                          onClick={handleUpdateDuplicate}
                          disabled={singleLoading}
                          sx={{
                            background:
                              "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                            py: { xs: 0.9, sm: 0.8 },
                            fontSize: { xs: "0.75rem", sm: "0.8rem" },
                            fontWeight: 700,
                          }}
                        >
                          🔄 Update
                        </Button>
                        <Button
                          fullWidth
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            setSingleWSN("");
                            setDuplicateWSN(null);
                          }}
                          sx={{
                            py: { xs: 0.9, sm: 0.8 },
                            fontSize: { xs: "0.75rem", sm: "0.8rem" },
                            fontWeight: 700,
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
                        disabled={
                          singleLoading || (!!singleWSN.trim() && !masterData)
                        }
                        sx={{
                          background:
                            "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                          py: { xs: 0.9, sm: 0.8 },
                          fontSize: { xs: "0.75rem", sm: "0.8rem" },
                          fontWeight: 700,
                        }}
                      >
                        {!!singleWSN.trim() && !masterData
                          ? "⚠ No Master Data"
                          : "✓ Add Entry"}
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              {/* Master Data Card */}
              {masterData && (
                <Card
                  sx={{
                    borderRadius: { xs: 2, sm: 2.5, md: 3 },
                    background: isDarkMode
                      ? "linear-gradient(135deg, #064e3b 0%, #065f46 100%)"
                      : "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
                    border: `2px solid ${isDarkMode ? "#10b981" : "#10b981"}`,
                    order: { xs: -1, lg: 0 }, // Show master data above form on mobile
                    height: { xs: "auto", lg: "fit-content" },
                    maxHeight: { xs: "50vh", lg: "none" },
                    overflow: { xs: "auto", lg: "visible" },
                  }}
                >
                  <CardContent sx={{ p: { xs: 1.2, sm: 1.5, md: 2 } }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ mb: { xs: 1, sm: 1.5 } }}
                    >
                      <CheckCircle
                        sx={{
                          color: isDarkMode ? "#4ade80" : "#10b981",
                          fontSize: { xs: 24, sm: 26, md: 28 },
                        }}
                      />
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 700,
                          color: isDarkMode ? "#a7f3d0" : "#065f46",
                          fontSize: {
                            xs: "0.85rem",
                            sm: "0.9rem",
                            md: "0.95rem",
                          },
                        }}
                      >
                        Master Data Found
                      </Typography>
                    </Stack>

                    <Divider
                      sx={{
                        mb: { xs: 1, sm: 1.5 },
                        borderColor: isDarkMode
                          ? "rgba(167, 243, 208, 0.3)"
                          : "rgba(5, 150, 105, 0.3)",
                      }}
                    />

                    <Stack spacing={{ xs: 1, sm: 1.2, md: 1.5 }}>
                      {/* FSN */}
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: isDarkMode ? "#a7f3d0" : "#065f46",
                            fontWeight: 700,
                            fontSize: { xs: "0.65rem", sm: "0.7rem" },
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            display: "block",
                            mb: 0.3,
                          }}
                        >
                          FSN
                        </Typography>
                        <Typography
                          sx={{
                            fontWeight: 700,
                            color: isDarkMode ? "#ecfdf5" : "#047857",
                            fontSize: {
                              xs: "0.85rem",
                              sm: "0.9rem",
                              md: "1rem",
                            },
                            wordBreak: "break-all",
                          }}
                        >
                          {masterData.fsn || "N/A"}
                        </Typography>
                      </Box>

                      {/* Product */}
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: isDarkMode ? "#a7f3d0" : "#065f46",
                            fontWeight: 700,
                            fontSize: { xs: "0.65rem", sm: "0.7rem" },
                            textTransform: "uppercase",
                            display: "block",
                            mb: 0.3,
                          }}
                        >
                          PRODUCT
                        </Typography>
                        <Typography
                          sx={{
                            fontWeight: 600,
                            color: isDarkMode ? "#d1fae5" : "#047857",
                            fontSize: {
                              xs: "0.75rem",
                              sm: "0.8rem",
                              md: "0.85rem",
                            },
                            lineHeight: 1.4,
                          }}
                        >
                          {masterData.product_title || "N/A"}
                        </Typography>
                      </Box>

                      {/* Brand & Category */}
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                          gap: { xs: 1, sm: 1.5 },
                        }}
                      >
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: isDarkMode ? "#a7f3d0" : "#065f46",
                              fontWeight: 700,
                              fontSize: { xs: "0.65rem", sm: "0.7rem" },
                              display: "block",
                              mb: 0.3,
                            }}
                          >
                            BRAND
                          </Typography>
                          <Typography
                            sx={{
                              fontWeight: 700,
                              color: isDarkMode ? "#ecfdf5" : "#047857",
                              fontSize: {
                                xs: "0.8rem",
                                sm: "0.85rem",
                                md: "0.9rem",
                              },
                            }}
                          >
                            {masterData.brand || "N/A"}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: isDarkMode ? "#a7f3d0" : "#065f46",
                              fontWeight: 700,
                              fontSize: { xs: "0.65rem", sm: "0.7rem" },
                              display: "block",
                              mb: 0.3,
                            }}
                          >
                            CATEGORY
                          </Typography>
                          <Typography
                            sx={{
                              fontWeight: 700,
                              color: isDarkMode ? "#ecfdf5" : "#047857",
                              fontSize: {
                                xs: "0.8rem",
                                sm: "0.85rem",
                                md: "0.9rem",
                              },
                            }}
                          >
                            {masterData.cms_vertical || "N/A"}
                          </Typography>
                        </Box>
                      </Box>

                      {/* MRP & FSP */}
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: { xs: 1, sm: 1.5 },
                          p: { xs: 1, sm: 1.2 },
                          background: isDarkMode
                            ? "rgba(0, 0, 0, 0.2)"
                            : "rgba(255, 255, 255, 0.5)",
                          borderRadius: 1,
                        }}
                      >
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: isDarkMode ? "#a7f3d0" : "#065f46",
                              fontWeight: 700,
                              fontSize: { xs: "0.65rem", sm: "0.7rem" },
                              display: "block",
                              mb: 0.3,
                            }}
                          >
                            MRP
                          </Typography>
                          <Typography
                            sx={{
                              fontWeight: 700,
                              color: isDarkMode ? "#ecfdf5" : "#047857",
                              fontSize: {
                                xs: "0.95rem",
                                sm: "1rem",
                                md: "1.1rem",
                              },
                            }}
                          >
                            ₹{masterData.mrp || "N/A"}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: isDarkMode ? "#a7f3d0" : "#065f46",
                              fontWeight: 700,
                              fontSize: { xs: "0.65rem", sm: "0.7rem" },
                              display: "block",
                              mb: 0.3,
                            }}
                          >
                            FSP
                          </Typography>
                          <Typography
                            sx={{
                              fontWeight: 700,
                              color: isDarkMode ? "#ecfdf5" : "#047857",
                              fontSize: {
                                xs: "0.95rem",
                                sm: "1rem",
                                md: "1.1rem",
                              },
                            }}
                          >
                            ₹{masterData.fsp || "N/A"}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Product Link */}
                      {masterData.fkt_link && (
                        <Box
                          sx={{
                            p: { xs: 0.8, sm: 1 },
                            background: isDarkMode
                              ? "rgba(0, 0, 0, 0.2)"
                              : "rgba(255, 255, 255, 0.6)",
                            borderRadius: 1,
                            border: `1px dashed ${isDarkMode ? "#4ade80" : "#10b981"}`,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: isDarkMode ? "#a7f3d0" : "#065f46",
                              fontWeight: 700,
                              fontSize: { xs: "0.65rem", sm: "0.7rem" },
                              display: "block",
                              mb: 0.5,
                            }}
                          >
                            PRODUCT LINK
                          </Typography>
                          <a
                            href={masterData.fkt_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: isDarkMode ? "#38bdf8" : "#0284c7",
                              fontWeight: 600,
                              textDecoration: "underline",
                              cursor: "pointer",
                              fontSize: "clamp(0.75rem, 2vw, 0.85rem)",
                              wordBreak: "break-word",
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
          )}

          {/* TAB: BULK UPLOAD */}
          {visibleTabCodes[tabValue] === "bulk" && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                p: { xs: 1, sm: 1.5, md: 2 },
                overflow: "auto",
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
                templateColumns={[
                  "WSN",
                  "VEHICLE_NO",
                  "PRODUCT_SERIAL_NUMBER",
                  "UNLOAD_REMARKS",
                ]}
                title="🔍 Bulk Inbound Upload"
                dropdownFields={[
                  {
                    key: "inbound_date",
                    label: "Inbound Date",
                    type: "date",
                    required: true,
                  },
                  {
                    key: "rack_no",
                    label: "Rack Number",
                    type: "select",
                    required: true,
                    options: (racks || []).map((r: any) => ({
                      label: r.rack_name || r.name || r,
                      value: r.rack_name || r.name || r,
                    })),
                  },
                ]}
              />
            </Box>
          )}

          {/* TAB: MULTI ENTRY */}
          {visibleTabCodes[tabValue] === "multi" && (
            <Box
              ref={multiEntryContainerRef}
              sx={{
                mt: 0.5,
                display: "flex",
                flexDirection: "column",
                height: "100%",
                overflow: "hidden",
                bgcolor: isDarkMode ? "#0f172a" : "#f5f7fa",
                // Prevent white flash during tab switch
                "& *": { transition: "none !important" },
                "& .ag-root-wrapper": {
                  backgroundColor: isDarkMode
                    ? "#1e293b !important"
                    : "#ffffff !important",
                },
              }}
            >
              {/* CONTROLS */}
              <Card
                sx={{
                  borderRadius: 1.5,
                  boxShadow: isDarkMode
                    ? "0 2px 8px rgba(0,0,0,0.3)"
                    : "0 2px 8px rgba(0,0,0,0.06)",
                  flexShrink: 0, // Don't shrink this card
                  mb: 1,

                  bgcolor: isDarkMode ? "#1e293b" : "white",
                  overflow: "visible", // Allow content to overflow for scrolling
                }}
              >
                <CardContent
                  sx={{
                    p: { xs: 1.5, sm: 1.5 },
                    pt: { xs: 2, sm: 1.5 },
                    "&:last-child": { pb: { xs: 1.5, sm: 1.5 } },
                    overflow: "visible",
                  }}
                >
                  {/* DESKTOP: Clean Single Row Layout */}
                  <Box
                    sx={{
                      mb: 0.2,
                      mt: 0,
                      display: { xs: "none", md: "block" },
                    }}
                  >
                    <Stack
                      direction="row"
                      sx={{
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      {/* LEFT: Date and Vehicle */}
                      <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{
                          flex: "0 0 auto",
                          alignItems: "center",
                        }}
                      >
                        <TextField
                          size="small"
                          label="Inbound Date"
                          type="date"
                          InputLabelProps={{ shrink: true }}
                          value={commonDate}
                          onChange={(e) => setCommonDate(e.target.value)}
                          inputRef={inboundDateInputRef}
                          onClick={() => {
                            try {
                              inboundDateInputRef.current?.showPicker?.();
                            } catch {
                              inboundDateInputRef.current?.focus();
                            }
                          }}
                          sx={{
                            width: 150,
                            "& .MuiInputBase-root": {
                              height: 38,
                              bgcolor: isDarkMode ? "#0f172a" : "#f8fafc",
                              borderRadius: 1.5,
                              cursor: "pointer",
                            },
                            "& .MuiOutlinedInput-notchedOutline": {
                              borderColor: isDarkMode ? "#334155" : "#e2e8f0",
                            },
                            "& input": {
                              cursor: "pointer",
                            },
                          }}
                        />
                        <TextField
                          size="small"
                          label="Vehicle No. *"
                          value={commonVehicle}
                          onChange={(e) => setCommonVehicle(e.target.value)}
                          onBlur={saveMultiVehicleNumber}
                          sx={{
                            width: 140,
                            "& .MuiInputBase-root": {
                              height: 38,
                              bgcolor: isDarkMode ? "#0f172a" : "#f8fafc",
                              borderRadius: 1.5,
                            },
                            "& .MuiOutlinedInput-notchedOutline": {
                              borderColor: isDarkMode ? "#334155" : "#e2e8f0",
                            },
                          }}
                          placeholder="Auto-fill"
                        />
                      </Stack>

                      {/* RIGHT: Menu Button + Fullscreen + Live View */}
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center" }}
                      >
                        {/* Settings Menu Button */}
                        <Tooltip title="Open Settings Panel" placement="top">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<MenuIcon sx={{ fontSize: 18 }} />}
                            onClick={() => setMultiSettingsPanelOpen(true)}
                            sx={{
                              height: 38,
                              px: 2,
                              borderRadius: 1.5,
                              fontWeight: 600,
                              fontSize: "0.8rem",
                              textTransform: "none",
                              borderColor: isDarkMode ? "#3b82f6" : "#1e40af",
                              color: isDarkMode ? "#60a5fa" : "#1e40af",
                              bgcolor: isDarkMode
                                ? "rgba(59, 130, 246, 0.08)"
                                : "rgba(30, 64, 175, 0.04)",
                              "&:hover": {
                                borderColor: "#3b82f6",
                                bgcolor: "rgba(59, 130, 246, 0.12)",
                              },
                            }}
                          >
                            Menu
                          </Button>
                        </Tooltip>

                        {/* Fullscreen Button */}
                        <Tooltip
                          title={
                            isFullscreen
                              ? "Exit fullscreen (Esc)"
                              : "Enter fullscreen mode"
                          }
                          placement="top"
                        >
                          <IconButton
                            size="small"
                            onClick={toggleFullscreen}
                            sx={{
                              width: 38,
                              height: 38,
                              borderRadius: 1.5,
                              border: "1.5px solid",
                              borderColor: isFullscreen
                                ? "#f59e0b"
                                : isDarkMode
                                  ? "#475569"
                                  : "#d1d5db",
                              color: isFullscreen
                                ? "#f59e0b"
                                : isDarkMode
                                  ? "#94a3b8"
                                  : "#64748b",
                              bgcolor: isFullscreen
                                ? "rgba(245, 158, 11, 0.1)"
                                : "transparent",
                              "&:hover": {
                                borderColor: "#f59e0b",
                                bgcolor: "rgba(245, 158, 11, 0.1)",
                                color: "#f59e0b",
                              },
                            }}
                          >
                            {isFullscreen ? (
                              <FullscreenExitIcon sx={{ fontSize: 20 }} />
                            ) : (
                              <FullscreenIcon sx={{ fontSize: 20 }} />
                            )}
                          </IconButton>
                        </Tooltip>

                        {/* Live View Panel */}
                        <LiveViewPanel
                          warehouseId={activeWarehouse?.id}
                          pageType="inbound"
                          isDarkMode={isDarkMode}
                          container={multiEntryContainerRef.current}
                        />
                      </Stack>
                    </Stack>
                  </Box>

                  {/* SETTINGS DRAWER - Right Side Panel with Accordions */}
                  <Drawer
                    anchor="right"
                    open={multiSettingsPanelOpen}
                    onClose={() => setMultiSettingsPanelOpen(false)}
                    container={multiEntryContainerRef.current}
                    ModalProps={{
                      container: multiEntryContainerRef.current,
                      keepMounted: false,
                    }}
                    PaperProps={{
                      sx: {
                        width: { xs: "100%", sm: 380 },
                        maxWidth: "100vw",
                        bgcolor: isDarkMode ? "#1e293b" : "#ffffff",
                        borderLeft: isDarkMode
                          ? "1px solid #334155"
                          : "1px solid #e2e8f0",
                      },
                    }}
                  >
                    {/* Panel Header */}
                    <Box
                      sx={{
                        p: 2,
                        background:
                          "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                      }}
                    >
                      <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>
                        ⚙️ Settings
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => setMultiSettingsPanelOpen(false)}
                        sx={{ color: "white" }}
                      >
                        <CloseIcon />
                      </IconButton>
                    </Box>

                    {/* Panel Content with Accordions */}
                    <Box sx={{ overflow: "auto", flex: 1 }}>
                      {/* ═══════════ COLUMNS ACCORDION ═══════════ */}
                      <Accordion
                        expanded={settingsPanelExpanded === "columns"}
                        onChange={(_, isExpanded) =>
                          setSettingsPanelExpanded(
                            isExpanded ? "columns" : false,
                          )
                        }
                        disableGutters
                        sx={{
                          bgcolor: "transparent",
                          boxShadow: "none",
                          "&:before": { display: "none" },
                          borderBottom: isDarkMode
                            ? "1px solid #334155"
                            : "1px solid #e2e8f0",
                        }}
                      >
                        <AccordionSummary
                          expandIcon={
                            <ExpandMoreIcon
                              sx={{ color: isDarkMode ? "#94a3b8" : "#64748b" }}
                            />
                          }
                          sx={{
                            px: 2,
                            minHeight: 56,
                            "&.Mui-expanded": { minHeight: 56 },
                            "& .MuiAccordionSummary-content": { my: 1.5 },
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                            }}
                          >
                            <ViewColumnIcon
                              sx={{ color: "#3b82f6", fontSize: 22 }}
                            />
                            <Box>
                              <Typography
                                sx={{
                                  fontWeight: 700,
                                  fontSize: "0.9rem",
                                  color: isDarkMode ? "#e2e8f0" : "#1e293b",
                                }}
                              >
                                Columns
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: "0.7rem",
                                  color: isDarkMode ? "#64748b" : "#94a3b8",
                                }}
                              >
                                {visibleColumns.length} of{" "}
                                {
                                  [
                                    ...EDITABLE_COLUMNS,
                                    ...ALL_MASTER_COLUMNS.filter(
                                      (c) => !EDITABLE_COLUMNS.includes(c),
                                    ),
                                  ].length
                                }{" "}
                                visible
                              </Typography>
                            </Box>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                          <Box sx={{ maxHeight: 280, overflow: "auto", pr: 1 }}>
                            <Typography
                              sx={{
                                fontWeight: 700,
                                fontSize: "0.7rem",
                                color: "#3b82f6",
                                mb: 1,
                                textTransform: "uppercase",
                              }}
                            >
                              Editable Fields
                            </Typography>
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
                                          next = visibleColumns.filter(
                                            (c) => c !== col,
                                          );
                                        }
                                        // ✅ FIX: Maintain column ordering and persist to localStorage
                                        const ordered = [
                                          ...EDITABLE_COLUMNS,
                                          ...ALL_MASTER_COLUMNS,
                                        ].filter((c) => next.includes(c));
                                        saveColumnSettings(ordered);
                                      }}
                                      sx={{
                                        py: 0.25,
                                        "&.Mui-checked": { color: "#3b82f6" },
                                      }}
                                    />
                                  }
                                  label={
                                    <Typography
                                      sx={{
                                        fontSize: "0.8rem",
                                        color: isDarkMode
                                          ? "#e2e8f0"
                                          : "#334155",
                                      }}
                                    >
                                      {col.replace(/_/g, " ").toUpperCase()}
                                    </Typography>
                                  }
                                  sx={{ m: 0 }}
                                />
                              ))}
                            </Stack>
                            <Typography
                              sx={{
                                fontWeight: 700,
                                fontSize: "0.7rem",
                                color: "#10b981",
                                mb: 1,
                                textTransform: "uppercase",
                              }}
                            >
                              Master Data Fields
                            </Typography>
                            <Stack spacing={0.5}>
                              {ALL_MASTER_COLUMNS.filter(
                                (c) => !EDITABLE_COLUMNS.includes(c),
                              ).map((col) => (
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
                                          next = visibleColumns.filter(
                                            (c) => c !== col,
                                          );
                                        }
                                        // ✅ FIX: Maintain column ordering and persist to localStorage
                                        const ordered = [
                                          ...EDITABLE_COLUMNS,
                                          ...ALL_MASTER_COLUMNS,
                                        ].filter((c) => next.includes(c));
                                        saveColumnSettings(ordered);
                                      }}
                                      sx={{
                                        py: 0.25,
                                        "&.Mui-checked": { color: "#10b981" },
                                      }}
                                    />
                                  }
                                  label={
                                    <Typography
                                      sx={{
                                        fontSize: "0.8rem",
                                        color: isDarkMode
                                          ? "#e2e8f0"
                                          : "#334155",
                                      }}
                                    >
                                      {col.replace(/_/g, " ").toUpperCase()}
                                    </Typography>
                                  }
                                  sx={{ m: 0 }}
                                />
                              ))}
                            </Stack>
                          </Box>
                        </AccordionDetails>
                      </Accordion>

                      {/* ═══════════ GRID SETTINGS ACCORDION ═══════════ */}
                      <Accordion
                        expanded={settingsPanelExpanded === "grid"}
                        onChange={(_, isExpanded) =>
                          setSettingsPanelExpanded(isExpanded ? "grid" : false)
                        }
                        disableGutters
                        sx={{
                          bgcolor: "transparent",
                          boxShadow: "none",
                          "&:before": { display: "none" },
                          borderBottom: isDarkMode
                            ? "1px solid #334155"
                            : "1px solid #e2e8f0",
                        }}
                      >
                        <AccordionSummary
                          expandIcon={
                            <ExpandMoreIcon
                              sx={{ color: isDarkMode ? "#94a3b8" : "#64748b" }}
                            />
                          }
                          sx={{
                            px: 2,
                            minHeight: 56,
                            "&.Mui-expanded": { minHeight: 56 },
                            "& .MuiAccordionSummary-content": { my: 1.5 },
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                            }}
                          >
                            <TableChartIcon
                              sx={{ color: "#f59e0b", fontSize: 22 }}
                            />
                            <Box>
                              <Typography
                                sx={{
                                  fontWeight: 700,
                                  fontSize: "0.9rem",
                                  color: isDarkMode ? "#e2e8f0" : "#1e293b",
                                }}
                              >
                                Grid Settings
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: "0.7rem",
                                  color: isDarkMode ? "#64748b" : "#94a3b8",
                                }}
                              >
                                Sorting, filtering, resize
                              </Typography>
                            </Box>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                          <Stack spacing={1.5}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={multiGridSettings.sortable}
                                  onChange={(e) =>
                                    updateMultiGridSettings({
                                      ...multiGridSettings,
                                      sortable: e.target.checked,
                                    })
                                  }
                                  sx={{ "&.Mui-checked": { color: "#f59e0b" } }}
                                />
                              }
                              label={
                                <Box>
                                  <Typography
                                    sx={{
                                      fontWeight: 600,
                                      fontSize: "0.85rem",
                                      color: isDarkMode ? "#e2e8f0" : "#334155",
                                    }}
                                  >
                                    ⬆️ Enable Sorting
                                  </Typography>
                                  <Typography
                                    sx={{
                                      fontSize: "0.7rem",
                                      color: isDarkMode ? "#64748b" : "#94a3b8",
                                    }}
                                  >
                                    Click headers to sort
                                  </Typography>
                                </Box>
                              }
                            />
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={multiGridSettings.filter}
                                  onChange={(e) =>
                                    updateMultiGridSettings({
                                      ...multiGridSettings,
                                      filter: e.target.checked,
                                    })
                                  }
                                  sx={{ "&.Mui-checked": { color: "#f59e0b" } }}
                                />
                              }
                              label={
                                <Box>
                                  <Typography
                                    sx={{
                                      fontWeight: 600,
                                      fontSize: "0.85rem",
                                      color: isDarkMode ? "#e2e8f0" : "#334155",
                                    }}
                                  >
                                    🔍 Enable Filtering
                                  </Typography>
                                  <Typography
                                    sx={{
                                      fontSize: "0.7rem",
                                      color: isDarkMode ? "#64748b" : "#94a3b8",
                                    }}
                                  >
                                    Filter in column headers
                                  </Typography>
                                </Box>
                              }
                            />
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={multiGridSettings.resizable}
                                  onChange={(e) =>
                                    updateMultiGridSettings({
                                      ...multiGridSettings,
                                      resizable: e.target.checked,
                                    })
                                  }
                                  sx={{ "&.Mui-checked": { color: "#f59e0b" } }}
                                />
                              }
                              label={
                                <Box>
                                  <Typography
                                    sx={{
                                      fontWeight: 600,
                                      fontSize: "0.85rem",
                                      color: isDarkMode ? "#e2e8f0" : "#334155",
                                    }}
                                  >
                                    ↔️ Column Resize
                                  </Typography>
                                  <Typography
                                    sx={{
                                      fontSize: "0.7rem",
                                      color: isDarkMode ? "#64748b" : "#94a3b8",
                                    }}
                                  >
                                    Drag borders to resize
                                  </Typography>
                                </Box>
                              }
                            />
                            <Button
                              size="small"
                              onClick={() => {
                                updateMultiGridSettings({
                                  sortable: true,
                                  filter: true,
                                  resizable: true,
                                  editable: true,
                                });
                                toast.success("Grid settings reset");
                              }}
                              sx={{
                                alignSelf: "flex-start",
                                fontSize: "0.75rem",
                                color: isDarkMode ? "#94a3b8" : "#64748b",
                              }}
                            >
                              🔄 Reset to Default
                            </Button>
                          </Stack>
                        </AccordionDetails>
                      </Accordion>

                      {/* ═══════════ PENDING CACHE ACCORDION (NEW) ═══════════ */}
                      <Accordion
                        expanded={settingsPanelExpanded === "batch"}
                        onChange={(_, isExpanded) =>
                          setSettingsPanelExpanded(isExpanded ? "batch" : false)
                        }
                        disableGutters
                        sx={{
                          bgcolor: "transparent",
                          boxShadow: "none",
                          "&:before": { display: "none" },
                          borderBottom: isDarkMode
                            ? "1px solid #334155"
                            : "1px solid #e2e8f0",
                        }}
                      >
                        <AccordionSummary
                          expandIcon={
                            <ExpandMoreIcon
                              sx={{ color: isDarkMode ? "#94a3b8" : "#64748b" }}
                            />
                          }
                          sx={{
                            px: 2,
                            minHeight: 56,
                            "&.Mui-expanded": { minHeight: 56 },
                            "& .MuiAccordionSummary-content": { my: 1.5 },
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              width: "100%",
                            }}
                          >
                            <InventoryIcon
                              sx={{ color: "#8b5cf6", fontSize: 22 }}
                            />
                            <Box sx={{ flex: 1 }}>
                              <Typography
                                sx={{
                                  fontWeight: 700,
                                  fontSize: "0.9rem",
                                  color: isDarkMode ? "#e2e8f0" : "#1e293b",
                                }}
                              >
                                Pending Cache
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: "0.7rem",
                                  color: isDarkMode ? "#64748b" : "#94a3b8",
                                }}
                              >
                                {pendingCacheLoading
                                  ? pendingCacheProgress || "Loading..."
                                  : pendingCacheStats?.count
                                    ? `${pendingCacheStats.count.toLocaleString()} pending items`
                                    : pendingCacheEnabled
                                      ? "Not loaded"
                                      : "Disabled"}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={
                                pendingCacheLoading
                                  ? "🔄"
                                  : pendingCacheStats?.count
                                    ? "✅"
                                    : "⚪"
                              }
                              sx={{
                                height: 24,
                                fontSize: "0.8rem",
                                bgcolor: pendingCacheStats?.count
                                  ? "#10b981"
                                  : "#64748b",
                                color: "white",
                              }}
                            />
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                          <Stack spacing={1.5}>
                            <Alert
                              severity="info"
                              sx={{ fontSize: "0.75rem", py: 0.5 }}
                            >
                              Cache pending items (not yet received) for instant
                              WSN lookup.
                            </Alert>
                            <Button
                              fullWidth
                              variant="contained"
                              disabled={
                                pendingCacheLoading || !activeWarehouse?.id
                              }
                              onClick={handleLoadPendingCache}
                              sx={{
                                height: 44,
                                background:
                                  "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                                fontWeight: 600,
                                "&:hover": {
                                  background:
                                    "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                },
                                "&.Mui-disabled": { bgcolor: "#64748b" },
                              }}
                            >
                              {pendingCacheLoading
                                ? "🔄 Loading..."
                                : "⚡ Load Pending Cache"}
                            </Button>
                            {pendingCacheStats?.lastSync && (
                              <Typography
                                sx={{
                                  fontSize: "0.7rem",
                                  color: isDarkMode ? "#64748b" : "#94a3b8",
                                  textAlign: "center",
                                }}
                              >
                                Last sync:{" "}
                                {new Date(
                                  pendingCacheStats.lastSync,
                                ).toLocaleTimeString()}
                              </Typography>
                            )}
                            <Divider sx={{ my: 1 }} />
                            <Typography
                              sx={{
                                fontSize: "0.7rem",
                                color: isDarkMode ? "#64748b" : "#94a3b8",
                              }}
                            >
                              Or use batch-based cache:
                            </Typography>
                            <Button
                              fullWidth
                              variant="outlined"
                              size="small"
                              onClick={() => {
                                setBatchSelectorOpen(true);
                                setMultiSettingsPanelOpen(false);
                              }}
                              sx={{
                                height: 36,
                                borderColor: isDarkMode ? "#475569" : "#cbd5e1",
                                color: isDarkMode ? "#94a3b8" : "#64748b",
                                fontWeight: 500,
                                fontSize: "0.8rem",
                              }}
                            >
                              📦 Open Batch Selector
                            </Button>
                          </Stack>
                        </AccordionDetails>
                      </Accordion>

                      {/* ═══════════ EXPORT BUTTON ═══════════ */}
                      <Box
                        sx={{
                          p: 2,
                          borderBottom: isDarkMode
                            ? "1px solid #334155"
                            : "1px solid #e2e8f0",
                        }}
                      >
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<DownloadIcon />}
                          onClick={() => {
                            setInboundExportDialogOpen(true);
                            setMultiSettingsPanelOpen(false);
                          }}
                          sx={{
                            height: 44,
                            background:
                              "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            fontWeight: 600,
                            "&:hover": {
                              background:
                                "linear-gradient(135deg, #059669 0%, #047857 100%)",
                            },
                          }}
                        >
                          Export to Excel
                        </Button>
                      </Box>

                      {/* ═══════════ PRINT & SHORTCUTS SECTION ═══════════ */}
                      <Box sx={{ p: 2 }}>
                        <Typography
                          sx={{
                            fontWeight: 700,
                            fontSize: "0.75rem",
                            color: isDarkMode ? "#94a3b8" : "#64748b",
                            mb: 1.5,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          Print & Shortcuts
                        </Typography>
                        <Stack spacing={1.5}>
                          {/* Auto Print Toggle */}
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              p: 1.5,
                              borderRadius: 1.5,
                              bgcolor: multiPrintEnabled
                                ? "rgba(22, 163, 74, 0.1)"
                                : isDarkMode
                                  ? "#0f172a"
                                  : "#f8fafc",
                              border: `1px solid ${multiPrintEnabled ? "#16a34a" : isDarkMode ? "#334155" : "#e2e8f0"}`,
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <PrintIcon
                                sx={{
                                  color: multiPrintEnabled
                                    ? "#16a34a"
                                    : isDarkMode
                                      ? "#64748b"
                                      : "#94a3b8",
                                  fontSize: 20,
                                }}
                              />
                              <Box>
                                <Typography
                                  sx={{
                                    fontWeight: 600,
                                    fontSize: "0.85rem",
                                    color: isDarkMode ? "#e2e8f0" : "#334155",
                                  }}
                                >
                                  Auto Print
                                </Typography>
                                <Typography
                                  sx={{
                                    fontSize: "0.7rem",
                                    color: isDarkMode ? "#64748b" : "#94a3b8",
                                  }}
                                >
                                  Print label on WSN scan
                                </Typography>
                              </Box>
                            </Box>
                            <Switch
                              checked={multiPrintEnabled}
                              onChange={(e) =>
                                setMultiPrintEnabled(e.target.checked)
                              }
                              sx={{
                                "& .MuiSwitch-switchBase.Mui-checked": {
                                  color: "#16a34a",
                                },
                                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                                  { bgcolor: "#16a34a" },
                              }}
                            />
                          </Box>

                          {/* Ctrl+P Toggle */}
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              p: 1.5,
                              borderRadius: 1.5,
                              bgcolor: ctrlPPrintEnabled
                                ? "rgba(37, 99, 235, 0.1)"
                                : isDarkMode
                                  ? "#0f172a"
                                  : "#f8fafc",
                              border: `1px solid ${ctrlPPrintEnabled ? "#2563eb" : isDarkMode ? "#334155" : "#e2e8f0"}`,
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <KeyboardIcon
                                sx={{
                                  color: ctrlPPrintEnabled
                                    ? "#2563eb"
                                    : isDarkMode
                                      ? "#64748b"
                                      : "#94a3b8",
                                  fontSize: 20,
                                }}
                              />
                              <Box>
                                <Typography
                                  sx={{
                                    fontWeight: 600,
                                    fontSize: "0.85rem",
                                    color: isDarkMode ? "#e2e8f0" : "#334155",
                                  }}
                                >
                                  Ctrl+P Reprint
                                </Typography>
                                <Typography
                                  sx={{
                                    fontSize: "0.7rem",
                                    color: isDarkMode ? "#64748b" : "#94a3b8",
                                  }}
                                >
                                  Reprint last scanned label
                                </Typography>
                              </Box>
                            </Box>
                            <Switch
                              checked={ctrlPPrintEnabled}
                              onChange={(e) =>
                                setCtrlPPrintEnabled(e.target.checked)
                              }
                              sx={{
                                "& .MuiSwitch-switchBase.Mui-checked": {
                                  color: "#2563eb",
                                },
                                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                                  { bgcolor: "#2563eb" },
                              }}
                            />
                          </Box>

                          {/* Ctrl+O Toggle */}
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              p: 1.5,
                              borderRadius: 1.5,
                              bgcolor: ctrlOProductLinkEnabled
                                ? "rgba(168, 85, 247, 0.1)"
                                : isDarkMode
                                  ? "#0f172a"
                                  : "#f8fafc",
                              border: `1px solid ${ctrlOProductLinkEnabled ? "#a855f7" : isDarkMode ? "#334155" : "#e2e8f0"}`,
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <LinkIcon
                                sx={{
                                  color: ctrlOProductLinkEnabled
                                    ? "#a855f7"
                                    : isDarkMode
                                      ? "#64748b"
                                      : "#94a3b8",
                                  fontSize: 20,
                                }}
                              />
                              <Box>
                                <Typography
                                  sx={{
                                    fontWeight: 600,
                                    fontSize: "0.85rem",
                                    color: isDarkMode ? "#e2e8f0" : "#334155",
                                  }}
                                >
                                  Ctrl+O Product Link
                                </Typography>
                                <Typography
                                  sx={{
                                    fontSize: "0.7rem",
                                    color: isDarkMode ? "#64748b" : "#94a3b8",
                                  }}
                                >
                                  Open product link for WSN
                                </Typography>
                              </Box>
                            </Box>
                            <Switch
                              checked={ctrlOProductLinkEnabled}
                              onChange={(e) =>
                                setCtrlOProductLinkEnabled(e.target.checked)
                              }
                              sx={{
                                "& .MuiSwitch-switchBase.Mui-checked": {
                                  color: "#a855f7",
                                },
                                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                                  { bgcolor: "#a855f7" },
                              }}
                            />
                          </Box>
                        </Stack>
                      </Box>
                    </Box>
                  </Drawer>

                  {/* MOBILE: Single Row - Scrollable Inputs + Fixed Buttons */}
                  <Box
                    sx={{
                      display: { xs: "flex", md: "none" },
                      alignItems: "center",
                      gap: 0.5,
                      width: "100%",
                      mt: 1,
                    }}
                  >
                    {/* LEFT: Scrollable Input Fields with Arrow Indicators */}
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      {/* Left Arrow Indicator */}
                      <Box
                        sx={{
                          width: 16,
                          height: 40,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isDarkMode ? "#64748b" : "#94a3b8",
                          fontSize: "0.7rem",
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
                          overflowX: "auto",
                          overflowY: "visible",
                          WebkitOverflowScrolling: "touch",
                          scrollbarWidth: "none",
                          "&::-webkit-scrollbar": { display: "none" },
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ width: "max-content", pt: 1 }}
                        >
                          <TextField
                            size="small"
                            label="Date"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={commonDate}
                            onChange={(e) => setCommonDate(e.target.value)}
                            sx={{
                              minWidth: 130,
                              "& .MuiInputBase-root": {
                                height: 36,
                                fontSize: "0.8rem",
                              },
                              "& .MuiInputLabel-root": { fontSize: "0.75rem" },
                            }}
                          />
                          <TextField
                            size="small"
                            label="Vehicle"
                            value={commonVehicle}
                            onChange={(e) => setCommonVehicle(e.target.value)}
                            onBlur={saveMultiVehicleNumber}
                            placeholder="Auto-fill"
                            sx={{
                              minWidth: 100,
                              "& .MuiInputBase-root": {
                                height: 36,
                                fontSize: "0.8rem",
                              },
                              "& .MuiInputLabel-root": { fontSize: "0.75rem" },
                            }}
                          />
                        </Stack>
                      </Box>

                      {/* Right Arrow Indicator */}
                      <Box
                        sx={{
                          width: 16,
                          height: 40,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isDarkMode ? "#64748b" : "#94a3b8",
                          fontSize: "0.7rem",
                          flexShrink: 0,
                        }}
                      >
                        ▶
                      </Box>
                    </Box>

                    {/* RIGHT: Fixed Action Buttons */}
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ flexShrink: 0, alignItems: "center" }}
                    >
                      {/* Mobile Scan Button */}
                      <Tooltip title="Mobile Scan">
                        <IconButton
                          size="small"
                          onClick={() =>
                            router.push("/mobile-scan?mode=inbound")
                          }
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 1,
                            border: "1.5px solid",
                            borderColor: "#ea580c",
                            color: "#ea580c",
                            bgcolor: "rgba(234,88,12,0.06)",
                            "&:hover": {
                              borderColor: "#ea580c",
                              bgcolor: "rgba(234,88,12,0.15)",
                            },
                          }}
                        >
                          <QrCodeScannerIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>

                      {/* Menu Button */}
                      <Tooltip title="Open Settings">
                        <IconButton
                          size="small"
                          onClick={() => setMultiSettingsPanelOpen(true)}
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 1,
                            border: "1.5px solid",
                            borderColor: isDarkMode ? "#3b82f6" : "#1e40af",
                            color: isDarkMode ? "#60a5fa" : "#1e40af",
                            bgcolor: isDarkMode
                              ? "rgba(59, 130, 246, 0.08)"
                              : "rgba(30, 64, 175, 0.04)",
                            "&:hover": {
                              borderColor: "#3b82f6",
                              bgcolor: "rgba(59, 130, 246, 0.12)",
                            },
                          }}
                        >
                          <MenuIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>

                      {/* Fullscreen Button */}
                      <Tooltip
                        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                      >
                        <IconButton
                          size="small"
                          onClick={toggleFullscreen}
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 1,
                            border: "1.5px solid",
                            borderColor: isFullscreen
                              ? "#f59e0b"
                              : isDarkMode
                                ? "#475569"
                                : "#d1d5db",
                            color: isFullscreen
                              ? "#f59e0b"
                              : isDarkMode
                                ? "#94a3b8"
                                : "#64748b",
                            bgcolor: isFullscreen
                              ? "rgba(245, 158, 11, 0.1)"
                              : "transparent",
                            "&:hover": {
                              borderColor: "#f59e0b",
                              bgcolor: "rgba(245, 158, 11, 0.1)",
                              color: "#f59e0b",
                            },
                          }}
                        >
                          {isFullscreen ? (
                            <FullscreenExitIcon sx={{ fontSize: 18 }} />
                          ) : (
                            <FullscreenIcon sx={{ fontSize: 18 }} />
                          )}
                        </IconButton>
                      </Tooltip>

                      {/* Live View Panel */}
                      <LiveViewPanel
                        warehouseId={activeWarehouse?.id}
                        pageType="inbound"
                        isDarkMode={isDarkMode}
                        container={multiEntryContainerRef.current}
                      />
                    </Stack>
                  </Box>
                </CardContent>
              </Card>

              {/* ERROR ALERTS */}
              {crossWarehouseWSNs.size > 0 && (
                <Alert
                  severity="error"
                  sx={{
                    mb: 0.75,
                    fontWeight: 700,
                    mx: { xs: 0.5, sm: 1 },
                    flexShrink: 0,
                  }}
                >
                  Some WSNs are already inbound in another warehouse. Remove
                  them.
                </Alert>
              )}
              {gridDuplicateWSNs.size > 0 && (
                <Alert
                  severity="warning"
                  sx={{
                    mb: 0.75,
                    fontWeight: 700,
                    mx: { xs: 0.5, sm: 1 },
                    flexShrink: 0,
                  }}
                >
                  Duplicate WSNs found inside the grid.
                </Alert>
              )}

              {/* AG GRID - Professional Excel-like styling */}
              <Box
                ref={multiGridBoxRef}
                sx={{
                  flex: 1,
                  minHeight: 300,
                  border: isDarkMode
                    ? "1px solid #334155"
                    : "2px solid #94a3b8",
                  borderRadius: "9px",
                  overflow: "hidden",
                  bgcolor: isDarkMode ? "#1e293b" : "#ffffff",
                  boxShadow: isDarkMode
                    ? "0 2px 8px rgba(0,0,0,0.3)"
                    : "0 2px 8px rgba(0,0,0,0.12)",
                  // ✅ FIX: Prevent browser native text selection on grid cells during drag
                  // This stops ghost selections (blue highlights) that overlap with custom cyan selection
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  // Prevent transitions on grid cells and rows (targeted, not wildcard)
                  "& .ag-row, & .ag-cell, & .ag-header-cell": {
                    transition: "none !important",
                  },
                  "& .ag-theme-quartz, & .ag-theme-quartz-dark": {
                    backgroundColor: isDarkMode
                      ? "#1e293b !important"
                      : "#ffffff !important",
                  },
                  "& .ag-root-wrapper, & .ag-root, & .ag-body": {
                    backgroundColor: isDarkMode
                      ? "#1e293b !important"
                      : "#ffffff !important",
                    border: "none",
                  },
                  "& .ag-body-viewport, & .ag-body-horizontal-scroll-viewport":
                    {
                      backgroundColor: isDarkMode
                        ? "#1e293b !important"
                        : "#ffffff !important",
                    },
                  "& .ag-center-cols-viewport, & .ag-center-cols-container": {
                    backgroundColor: isDarkMode
                      ? "#1e293b !important"
                      : "#ffffff !important",
                  },
                  "& .ag-center-cols-clipper, & .ag-pinned-left-cols-container, & .ag-pinned-right-cols-container":
                    {
                      backgroundColor: isDarkMode
                        ? "#1e293b !important"
                        : "#ffffff !important",
                    },

                  // Professional dark header
                  "& .ag-header": {
                    backgroundColor: isDarkMode ? "#1e3a5f" : "#1e3a5f",
                    borderBottom: isDarkMode
                      ? "2px solid #10b981"
                      : "2px solid #059669",
                  },
                  "& .ag-header-cell": {
                    backgroundColor: isDarkMode ? "#1e3a5f" : "#1e3a5f",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "11px",
                    padding: "0 8px",
                    borderRight: "1px solid #3b5998",
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                  },
                  "& .ag-header-cell:last-child": { borderRight: "none" },
                  "& .ag-header-cell-label": { color: "#ffffff" },
                  "& .ag-icon": { color: "#94a3b8" },
                  "& .ag-header-icon": { color: "#94a3b8" },

                  // Excel-style cells with visible borders
                  "& .ag-cell": {
                    borderRight: isDarkMode
                      ? "1px solid #334155"
                      : "1px solid #cbd5e1",
                    fontSize: "12px",
                    padding: "0 8px",
                    display: "flex",
                    alignItems: "center",
                    color: isDarkMode ? "#f1f5f9" : "#1e293b",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  },
                  "& .ag-cell:last-child": {
                    borderRight: isDarkMode ? "none" : "1px solid #cbd5e1",
                  },

                  // Professional rows with visible borders
                  "& .ag-row": {
                    height: 36,
                    overflow: "visible",
                    borderBottom: isDarkMode
                      ? "1px solid #334155"
                      : "1px solid #cbd5e1",
                  },
                  "& .ag-row-even": {
                    backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                  },
                  "& .ag-row-odd": {
                    backgroundColor: isDarkMode ? "#1a2536" : "#f1f5f9",
                  },

                  // ⚡ EXCEL ENHANCEMENT: Highlight animation for newly added rows
                  "& .ag-row-highlight-new": {
                    animation: "rowHighlightPulse 1.5s ease-out",
                    backgroundColor: isDarkMode
                      ? "#14532d !important"
                      : "#dcfce7 !important",
                  },
                  "@keyframes rowHighlightPulse": {
                    "0%": {
                      backgroundColor: isDarkMode ? "#166534" : "#86efac",
                    },
                    "50%": {
                      backgroundColor: isDarkMode ? "#15803d" : "#bbf7d0",
                    },
                    "100%": {
                      backgroundColor: isDarkMode ? "#14532d" : "#dcfce7",
                    },
                  },

                  // Active cell focus - Enhanced for dark mode with strong visibility (matching Outbound)
                  "& .ag-cell-focus, & .ag-cell.ag-cell-focus": {
                    border: isDarkMode
                      ? "2px solid #22d3ee !important"
                      : "2px solid #2563eb !important",
                    outline: "none !important",
                    boxShadow: isDarkMode
                      ? "0 0 12px rgba(34, 211, 238, 0.6), inset 0 0 8px rgba(34, 211, 238, 0.15)"
                      : "0 0 0 2px rgba(37, 99, 235, 0.3)",
                    backgroundColor: isDarkMode
                      ? "rgba(34, 211, 238, 0.15) !important"
                      : "rgba(37, 99, 235, 0.08) !important",
                    zIndex: 1,
                  },

                  // Cell being edited
                  "& .ag-cell-inline-editing": {
                    border: isDarkMode
                      ? "2px solid #22d3ee !important"
                      : "2px solid #2563eb !important",
                    backgroundColor: isDarkMode
                      ? "#1e293b !important"
                      : "#ffffff !important",
                    boxShadow: isDarkMode
                      ? "0 0 16px rgba(34, 211, 238, 0.5)"
                      : "0 0 8px rgba(37, 99, 235, 0.3)",
                  },

                  // Selection styling is handled entirely by cellStyle inline styles.
                  // No CSS class selectors or attribute selectors needed — keeps browser fast.

                  // ⚡ EXCEL-LIKE: Custom range selection CSS classes — matches Outbound styling
                  "& .custom-range-selected": {
                    backgroundColor: isDarkMode
                      ? "rgba(34, 211, 238, 0.25) !important"
                      : "rgba(37, 99, 235, 0.15) !important",
                  },
                  "& .custom-range-top": {
                    borderTop: isDarkMode
                      ? "3px solid #22d3ee !important"
                      : "3px solid #2563eb !important",
                  },
                  "& .custom-range-bottom": {
                    borderBottom: isDarkMode
                      ? "3px solid #22d3ee !important"
                      : "3px solid #2563eb !important",
                  },
                  "& .custom-range-left": {
                    borderLeft: isDarkMode
                      ? "3px solid #22d3ee !important"
                      : "3px solid #2563eb !important",
                  },
                  "& .custom-range-right": {
                    borderRight: isDarkMode
                      ? "3px solid #22d3ee !important"
                      : "3px solid #2563eb !important",
                  },

                  // Hover effect
                  "& .ag-row-hover": {
                    backgroundColor: isDarkMode
                      ? "rgba(16, 185, 129, 0.12) !important"
                      : "#d1fae5 !important",
                  },
                  // Prevent white flash in dark mode - apply to inner container immediately
                  "& > div": {
                    backgroundColor: isDarkMode
                      ? "#1e293b !important"
                      : "#ffffff",
                  },
                }}
              >
                <AgGridReact
                  className="ag-theme-quartz"
                  containerStyle={{
                    height: "100%",
                    width: "100%",
                    backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                  }}
                  // ⚡ PERFORMANCE: getRowId for efficient row tracking and updates
                  getRowId={(params: any) => params.data._rowId}
                  onGridReady={(params: any) => {
                    gridRef.current = params.api;
                    columnApiRef.current = params.columnApi;
                  }}
                  onModelUpdated={(params: any) => {
                    try {
                      const desired = desiredRowIndexRef.current;
                      if (
                        scanningModeRef.current &&
                        typeof desired === "number"
                      ) {
                        ensureRowVisible(desired, "bottom", 3, undefined, true);
                      }
                    } catch (e) {
                      /* ignore */
                    }
                  }}
                  onFirstDataRendered={(params: any) => {
                    try {
                      const desired = desiredRowIndexRef.current;
                      if (
                        scanningModeRef.current &&
                        typeof desired === "number"
                      ) {
                        ensureRowVisible(desired, "bottom", 3, undefined, true);
                      }
                    } catch (e) {
                      /* ignore */
                    }
                    // Auto-size columns that don't have user-saved widths (size to text content)
                    try {
                      const api = params.api;
                      if (api) {
                        const allCols = api.getColumns
                          ? api.getColumns()
                          : api.getAllGridColumns
                            ? api.getAllGridColumns()
                            : [];
                        // Only auto-size columns without a saved width
                        const colsToAutoSize = allCols
                          .map((c: any) => c.getColId())
                          .filter(
                            (id: string) =>
                              id !== "rowNumber" &&
                              id !== "print_action" &&
                              id !== "_filler" &&
                              !multiColumnWidths[id],
                          );
                        if (colsToAutoSize.length > 0) {
                          api.autoSizeColumns(colsToAutoSize, false);
                        }
                      }
                    } catch {
                      /* ignore */
                    }
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
                    // No flex — columns use explicit width (auto-sized or user-saved)
                    sortable: multiGridSettings.sortable, // ✅ Multi Entry Settings
                    filter: multiGridSettings.filter, // ✅ Multi Entry Settings
                    resizable: multiGridSettings.resizable, // ✅ Multi Entry Settings

                    // ⚡ CRITICAL: Suppress AG Grid's built-in Ctrl+Arrow / Shift+Arrow handling
                    // so our custom onCellKeyDown handler gets the CORRECT focused cell position.
                    // Without this, AG Grid moves focus first, then our handler reads the wrong cell.
                    suppressKeyboardEvent: (params: any) => {
                      const event = params.event;
                      if (!event) return false;
                      const ctrlKey = event.ctrlKey || event.metaKey;
                      const shiftKey = event.shiftKey;
                      const arrowKeys = [
                        "ArrowUp",
                        "ArrowDown",
                        "ArrowLeft",
                        "ArrowRight",
                      ];
                      // Suppress Ctrl+Arrow (navigation) and Ctrl+Shift+Arrow (selection extension)
                      if (ctrlKey && arrowKeys.includes(event.key)) return true;
                      return false;
                    },

                    editable: (params: any) => {
                      // ✅ Check multi grid settings first
                      if (!multiGridSettings.editable) return false;

                      const field = params.colDef.field as string;
                      const wsn = params.data?.wsn?.trim()?.toUpperCase();

                      if (!wsn) return EDITABLE_COLUMNS.includes(field);

                      // 🔴 Cross warehouse → nothing editable
                      if (crossWarehouseWSNs.has(wsn)) return false;

                      // 🟡 Duplicate → only WSN editable
                      if (gridDuplicateWSNs.has(wsn)) {
                        return field === "wsn";
                      }

                      return EDITABLE_COLUMNS.includes(field);
                    },
                    // ⚡ EXCEL-LIKE: Cell style for precise rectangular selection highlighting (OPTIMIZED)
                    // Uses pre-computed selectionBoundsRef for O(1) lookups instead of O(n) column search
                    // ✅ FIX: This is the SOLE source of selection styling. cellClass was removed because
                    // AG Grid's refreshCells/redrawRows can leave stale CSS classes with !important that
                    // override inline styles, causing ghost selections to persist.
                    cellStyle: (params: any) => {
                      // ⚡ EXCEL-LIKE: Precise O(1) selection highlighting per cell.
                      // Uses module-level SELECTION_RESET_STYLE constant (zero allocations).
                      const bounds = selectionBoundsRef.current;
                      if (!bounds) return SELECTION_RESET_STYLE;

                      const rowIndex = params.rowIndex;
                      const colId = params.colDef?.field;
                      if (rowIndex === null || rowIndex === undefined || !colId)
                        return SELECTION_RESET_STYLE;

                      const currentColIndex = bounds.colIndexMap.get(colId);
                      if (currentColIndex === undefined)
                        return SELECTION_RESET_STYLE;

                      const isInRange =
                        rowIndex >= bounds.minRow &&
                        rowIndex <= bounds.maxRow &&
                        currentColIndex >= bounds.minCol &&
                        currentColIndex <= bounds.maxCol;

                      if (isInRange) {
                        const borderColor = isDarkMode ? "#60a5fa" : "#2563eb";
                        const bgColor = isDarkMode
                          ? "rgba(96, 165, 250, 0.35)"
                          : "rgba(37, 99, 235, 0.2)";
                        return {
                          backgroundColor: bgColor,
                          boxShadow: isDarkMode
                            ? "inset 0 0 0 1px rgba(96, 165, 250, 0.6)"
                            : "inset 0 0 0 1px rgba(37, 99, 235, 0.4)",
                          borderTop:
                            rowIndex === bounds.minRow
                              ? `3px solid ${borderColor}`
                              : (undefined as any),
                          borderBottom:
                            rowIndex === bounds.maxRow
                              ? `3px solid ${borderColor}`
                              : (undefined as any),
                          borderLeft:
                            currentColIndex === bounds.minCol
                              ? `3px solid ${borderColor}`
                              : (undefined as any),
                          borderRight:
                            currentColIndex === bounds.maxCol
                              ? `3px solid ${borderColor}`
                              : (undefined as any),
                        };
                      }

                      return SELECTION_RESET_STYLE;
                    },
                    // ⚡ EXCEL-LIKE: CSS classes for selection — backup with !important for reliable highlighting
                    cellClass: (params: any) => {
                      const bounds = selectionBoundsRef.current;
                      if (!bounds) return "";

                      const rowIndex = params.rowIndex;
                      const colId = params.colDef?.field;
                      if (rowIndex === null || rowIndex === undefined || !colId)
                        return "";

                      const currentColIndex = bounds.colIndexMap.get(colId);
                      if (currentColIndex === undefined) return "";

                      const isInRange =
                        rowIndex >= bounds.minRow &&
                        rowIndex <= bounds.maxRow &&
                        currentColIndex >= bounds.minCol &&
                        currentColIndex <= bounds.maxCol;

                      if (isInRange) {
                        const classes = ["custom-range-selected"];
                        if (rowIndex === bounds.minRow)
                          classes.push("custom-range-top");
                        if (rowIndex === bounds.maxRow)
                          classes.push("custom-range-bottom");
                        if (currentColIndex === bounds.minCol)
                          classes.push("custom-range-left");
                        if (currentColIndex === bounds.maxCol)
                          classes.push("custom-range-right");
                        return classes.join(" ");
                      }
                      return "";
                    },
                  }}
                  // ⚡ CLIPBOARD & SELECTION FEATURES
                  enableCellTextSelection={false}
                  suppressCopyRowsToClipboard={false}
                  rowSelection={undefined}
                  suppressRowDeselection={false}
                  // NOTE: Clipboard paste is handled via custom document 'paste' event listener
                  // (AG Grid Community v34 does not include ClipboardModule)

                  // keyboard navigation
                  stopEditingWhenCellsLoseFocus={true}
                  enterNavigatesVertically={true}
                  enterNavigatesVerticallyAfterEdit={true}
                  navigateToNextCell={navigateToNextCell}
                  tabToNextCell={tabToNextCell}
                  ensureDomOrder={true}
                  suppressMovableColumns={true}
                  // ⚡ PERFORMANCE: Optimizations for smooth fast scrolling
                  rowBuffer={20}
                  suppressRowTransform={false}
                  suppressAnimationFrame={false}
                  alwaysShowVerticalScroll={true}
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
                  onCellMouseDown={(event: any) => {
                    const rowIndex = event.rowIndex;
                    const colId = event.column?.getColId();
                    if (rowIndex === null || rowIndex === undefined || !colId)
                      return;

                    const browserEvent = event.event as MouseEvent;
                    // Pass mouse button + browser event to handler for preventDefault
                    handleCellMouseDown(
                      rowIndex,
                      colId,
                      browserEvent?.shiftKey || false,
                      browserEvent?.button ?? 0,
                      browserEvent,
                    );
                  }}
                  // ⚡ EXCEL-LIKE: Handle cell mouse over for drag selection extend
                  onCellMouseOver={(event: any) => {
                    const rowIndex = event.rowIndex;
                    const colId = event.column?.getColId();
                    if (rowIndex === null || rowIndex === undefined || !colId)
                      return;

                    const browserEvent = event.event as MouseEvent;
                    // Pass buttons (bitmask of currently pressed buttons: 1=left, 2=right, 4=middle)
                    handleCellMouseOver(
                      rowIndex,
                      colId,
                      browserEvent?.buttons ?? 0,
                    );
                  }}
                  // ⚡ EXCEL-LIKE: Handle cell click for shift+click selection
                  onCellClicked={(event: any) => {
                    const rowIndex = event.rowIndex;
                    const colId = event.column?.getColId();
                    if (rowIndex === null || rowIndex === undefined || !colId)
                      return;

                    const browserEvent = event.event as MouseEvent;
                    handleCellClick(
                      rowIndex,
                      colId,
                      browserEvent?.shiftKey || false,
                    );
                  }}
                  // ⚡ SMOOTH SCROLL: Detect user manual scroll to avoid overriding it
                  onBodyScroll={(event: any) => {
                    // If we're auto-scrolling (programmatic), skip — don't flag as user scroll
                    if (isAutoScrollingRef.current) {
                      lastGridScrollTopRef.current = event.top;
                      return;
                    }

                    const currentScrollTop = event.top;
                    const scrollDelta = Math.abs(
                      currentScrollTop - lastGridScrollTopRef.current,
                    );

                    // Only mark as user scroll if there's significant movement (>10px)
                    if (scrollDelta > 10) {
                      userScrolledRef.current = true;

                      // Clear user scroll flag after 1.5 seconds of no scanning activity
                      if (userScrollTimeoutRef.current) {
                        window.clearTimeout(userScrollTimeoutRef.current);
                      }
                      userScrollTimeoutRef.current = window.setTimeout(() => {
                        userScrolledRef.current = false;
                        userScrollTimeoutRef.current = null;
                      }, 1500);
                    }

                    lastGridScrollTopRef.current = currentScrollTop;
                  }}
                  // ✅ Save column widths when user finishes resizing
                  onColumnResized={(params: any) => {
                    if (
                      params.finished &&
                      params.column &&
                      params.source === "uiColumnResized"
                    ) {
                      const colId = params.column.getColId();
                      const newWidth = params.column.getActualWidth();
                      // Don't save special columns
                      if (
                        colId === "rowNumber" ||
                        colId === "print_action" ||
                        colId === "_filler"
                      )
                        return;

                      setMultiColumnWidths((prev) => {
                        const updated = { ...prev, [colId]: newWidth };
                        localStorage.setItem(
                          "multiEntryColumnWidths",
                          JSON.stringify(updated),
                        );
                        return updated;
                      });
                    }
                  }}
                  // Column widths are fixed (auto-sized or user-saved) — no forced re-layout on container resize
                  onGridSizeChanged={() => {
                    // Intentionally empty — user-saved and auto-sized widths should not be overridden
                  }}
                  // ⚡ EXCEL-LIKE: Get row class for highlighting (newly added rows + selected range)
                  getRowClass={(params: any) => {
                    const classes: string[] = [];

                    // Highlight newly added/scanned rows
                    if (highlightedRows.has(params.rowIndex)) {
                      classes.push("ag-row-highlight-new");
                    }

                    // Note: Row-level selection highlighting removed - using cell-level highlighting instead
                    // via cellClass in defaultColDef for precise column-only selection

                    return classes.length > 0 ? classes.join(" ") : undefined;
                  }}
                  onCellValueChanged={handleMultiCellValueChanged}
                  onCellKeyDown={(event: any) => {
                    // ✅ FIX: event.event is AG Grid's wrapper - access the native keyboard event
                    const nativeEvent = event.event as
                      | KeyboardEvent
                      | undefined;
                    const key = nativeEvent?.key;
                    const rowIndex = event.rowIndex;

                    // ✅ NULL SAFETY: Check rowIndex
                    if (rowIndex === null || rowIndex === undefined) return;

                    // ⚡ EXCEL-LIKE KEYBOARD SHORTCUTS
                    const ctrlKey =
                      nativeEvent?.ctrlKey || nativeEvent?.metaKey;

                    // Note: Ctrl+Z and Ctrl+Y are handled by the global keyboard handler
                    // to avoid double-triggering. Only grid-specific shortcuts here.

                    // Ctrl+D → Fill Down (copy value from cell above)
                    if (ctrlKey && key?.toLowerCase() === "d") {
                      nativeEvent?.preventDefault();
                      handleFillDown();
                      return;
                    }

                    // When user presses Enter or Tab to move to next row
                    if (key === "Enter" || key === "Tab") {
                      const nextRowIndex = rowIndex + 1;
                      const totalRows = event.api.getDisplayedRowCount();

                      // ⚡ Immediately scroll to show next row (Excel behavior)
                      if (nextRowIndex < totalRows) {
                        setTimeout(() => {
                          try {
                            ensureRowVisible(
                              nextRowIndex,
                              "bottom",
                              4,
                              undefined,
                              true,
                            );
                          } catch (e) {
                            /* ignore */
                          }
                        }, 50);
                      }
                    }

                    // ✅ EXCEL-LIKE: Ctrl+Arrow navigation — true Excel boundary-jumping behavior
                    // Skip if Shift is held — Ctrl+Shift+Arrow is handled by global handler for selection
                    if (
                      ctrlKey &&
                      !nativeEvent?.shiftKey &&
                      [
                        "ArrowUp",
                        "ArrowDown",
                        "ArrowLeft",
                        "ArrowRight",
                      ].includes(key || "")
                    ) {
                      nativeEvent?.preventDefault();
                      nativeEvent?.stopPropagation();
                      const api = event.api;
                      const focusedCell = api.getFocusedCell();
                      if (!focusedCell) return;

                      const currentRow = focusedCell.rowIndex;
                      const currentCol = focusedCell.column;
                      const currentColId = currentCol.getColId();
                      const totalRows = api.getDisplayedRowCount();
                      const allColumns = api.getAllDisplayedColumns();

                      let targetRow = currentRow;
                      let targetCol = currentCol;

                      // Helper: check if a cell has data
                      const hasCellData = (
                        r: number,
                        colId: string,
                      ): boolean => {
                        const rowData = api.getDisplayedRowAtIndex(r)?.data;
                        if (!rowData) return false;
                        const val = rowData[colId];
                        return (
                          val !== undefined &&
                          val !== null &&
                          String(val).trim() !== ""
                        );
                      };

                      if (key === "ArrowDown") {
                        const currentHasData = hasCellData(
                          currentRow,
                          currentColId,
                        );
                        if (currentHasData) {
                          const nextRow = currentRow + 1;
                          if (nextRow >= totalRows) {
                            targetRow = currentRow; // Already at last row
                          } else if (hasCellData(nextRow, currentColId)) {
                            // Next cell also has data → skip to END of contiguous filled block
                            let r = nextRow;
                            while (
                              r + 1 < totalRows &&
                              hasCellData(r + 1, currentColId)
                            )
                              r++;
                            targetRow = r;
                          } else {
                            // Next cell is empty → jump to next filled cell below
                            let found = false;
                            for (let r = nextRow + 1; r < totalRows; r++) {
                              if (hasCellData(r, currentColId)) {
                                targetRow = r;
                                found = true;
                                break;
                              }
                            }
                            // If no data found below, stay at current row (already at last data boundary)
                            if (!found) targetRow = currentRow;
                          }
                        } else {
                          // Current cell is empty → jump to next filled cell below
                          let found = false;
                          for (let r = currentRow + 1; r < totalRows; r++) {
                            if (hasCellData(r, currentColId)) {
                              targetRow = r;
                              found = true;
                              break;
                            }
                          }
                          if (!found) targetRow = totalRows - 1; // No data below → go to last row
                        }
                      } else if (key === "ArrowUp") {
                        const currentHasData = hasCellData(
                          currentRow,
                          currentColId,
                        );
                        if (currentHasData) {
                          const prevRow = currentRow - 1;
                          if (prevRow < 0) {
                            targetRow = 0;
                          } else if (hasCellData(prevRow, currentColId)) {
                            // Previous cell has data → skip to START of contiguous block
                            let r = prevRow;
                            while (
                              r - 1 >= 0 &&
                              hasCellData(r - 1, currentColId)
                            )
                              r--;
                            targetRow = r;
                          } else {
                            // Previous cell empty → jump to next filled cell above
                            let found = false;
                            for (let r = prevRow - 1; r >= 0; r--) {
                              if (hasCellData(r, currentColId)) {
                                targetRow = r;
                                found = true;
                                break;
                              }
                            }
                            // If no data found above, stay at current row (already at first data boundary)
                            if (!found) targetRow = currentRow;
                          }
                        } else {
                          let found = false;
                          for (let r = currentRow - 1; r >= 0; r--) {
                            if (hasCellData(r, currentColId)) {
                              targetRow = r;
                              found = true;
                              break;
                            }
                          }
                          if (!found) targetRow = 0;
                        }
                      } else if (key === "ArrowLeft") {
                        const colIds = allColumns.map((c: any) => c.getColId());
                        const colIdx = colIds.indexOf(currentColId);
                        if (colIdx > 0) {
                          const currentHasData = hasCellData(
                            currentRow,
                            currentColId,
                          );
                          if (currentHasData) {
                            const prevColId = colIds[colIdx - 1];
                            if (hasCellData(currentRow, prevColId)) {
                              let c = colIdx - 1;
                              while (
                                c - 1 >= 0 &&
                                hasCellData(currentRow, colIds[c - 1])
                              )
                                c--;
                              targetCol = allColumns[c];
                            } else {
                              let found = false;
                              for (let c = colIdx - 2; c >= 0; c--) {
                                if (hasCellData(currentRow, colIds[c])) {
                                  targetCol = allColumns[c];
                                  found = true;
                                  break;
                                }
                              }
                              if (!found) targetCol = allColumns[0];
                            }
                          } else {
                            let found = false;
                            for (let c = colIdx - 1; c >= 0; c--) {
                              if (hasCellData(currentRow, colIds[c])) {
                                targetCol = allColumns[c];
                                found = true;
                                break;
                              }
                            }
                            if (!found) targetCol = allColumns[0];
                          }
                        }
                      } else if (key === "ArrowRight") {
                        const colIds = allColumns.map((c: any) => c.getColId());
                        const colIdx = colIds.indexOf(currentColId);
                        if (colIdx < colIds.length - 1) {
                          const currentHasData = hasCellData(
                            currentRow,
                            currentColId,
                          );
                          if (currentHasData) {
                            const nextColId = colIds[colIdx + 1];
                            if (hasCellData(currentRow, nextColId)) {
                              let c = colIdx + 1;
                              while (
                                c + 1 < colIds.length &&
                                hasCellData(currentRow, colIds[c + 1])
                              )
                                c++;
                              targetCol = allColumns[c];
                            } else {
                              let found = false;
                              for (let c = colIdx + 2; c < colIds.length; c++) {
                                if (hasCellData(currentRow, colIds[c])) {
                                  targetCol = allColumns[c];
                                  found = true;
                                  break;
                                }
                              }
                              if (!found)
                                targetCol = allColumns[colIds.length - 1];
                            }
                          } else {
                            let found = false;
                            for (let c = colIdx + 1; c < colIds.length; c++) {
                              if (hasCellData(currentRow, colIds[c])) {
                                targetCol = allColumns[c];
                                found = true;
                                break;
                              }
                            }
                            if (!found)
                              targetCol = allColumns[colIds.length - 1];
                          }
                        }
                      }

                      // ⚡ FLICKER-FREE: Clear selection via REFS only — no React re-render during navigation.
                      // React re-render from setSelectedRange() disrupts AG Grid's internal focus tracking,
                      // causing subsequent plain arrow keys to scroll instead of moving focus.
                      const hadSelection = !!selectedRangeRef.current;
                      if (hadSelection) {
                        selectedRangeRef.current = null;
                        if (rafIdRef.current) {
                          cancelAnimationFrame(rafIdRef.current);
                          rafIdRef.current = 0;
                        }
                        const prevBounds = prevBoundsFullRef.current;
                        selectionBoundsRef.current = null;
                        prevBoundsFullRef.current = null;
                        if (prevBounds) {
                          const rowNodes: any[] = [];
                          for (
                            let r = prevBounds.minRow;
                            r <= prevBounds.maxRow;
                            r++
                          ) {
                            const node = api.getDisplayedRowAtIndex(r);
                            if (node) rowNodes.push(node);
                          }
                          if (rowNodes.length > 0)
                            api.refreshCells({ rowNodes, force: true });
                        }
                      }
                      rangeStartCellRef.current = {
                        rowIndex: targetRow,
                        colId: targetCol.getColId(),
                      };

                      // Scroll + focus — sync, then defer React state update so re-render doesn't steal focus
                      isAutoScrollingRef.current = true;
                      api.ensureIndexVisible(targetRow);
                      api.ensureColumnVisible(targetCol);
                      api.setFocusedCell(targetRow, targetCol);
                      setTimeout(() => {
                        isAutoScrollingRef.current = false;
                        // Sync React state AFTER focus is fully settled
                        if (hadSelection) setSelectedRange(null);
                      }, 120);
                      return;
                    }

                    // ✅ EXCEL: Plain arrow keys (no Ctrl, no Shift) → Clear selection
                    if (
                      !ctrlKey &&
                      !nativeEvent?.shiftKey &&
                      [
                        "ArrowUp",
                        "ArrowDown",
                        "ArrowLeft",
                        "ArrowRight",
                      ].includes(key || "")
                    ) {
                      if (selectedRangeRef.current) {
                        setSelectionRange(null);
                      }
                      // Update anchor to current position after AG Grid moves focus
                      setTimeout(() => {
                        const focused = event.api.getFocusedCell();
                        if (focused) {
                          rangeStartCellRef.current = {
                            rowIndex: focused.rowIndex,
                            colId: focused.column.getColId(),
                          };
                        }
                      }, 0);
                    }
                  }}
                />
              </Box>

              {/* DRAFT STATUS + ACTIONS + SUBMIT */}
              {/* MOBILE: Scrollable Actions + Fixed Submit */}
              <Box
                sx={{
                  display: { xs: "flex", md: "none" },
                  alignItems: "center",
                  gap: 0.5,
                  py: 0.5,
                  flexShrink: 0,
                }}
              >
                {/* Left: Scrollable Actions with Arrow Indicators */}
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.25,
                  }}
                >
                  {/* Left Arrow */}
                  <Box
                    sx={{
                      width: 16,
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isDarkMode ? "#64748b" : "#94a3b8",
                      fontSize: "0.65rem",
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
                      overflowX: "auto",
                      overflowY: "hidden",
                      WebkitOverflowScrolling: "touch",
                      scrollbarWidth: "none",
                      "&::-webkit-scrollbar": { display: "none" },
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ width: "max-content", alignItems: "center" }}
                    >
                      <Chip
                        icon={<AccessTime sx={{ fontSize: 14 }} />}
                        label={
                          draftSavedAt
                            ? new Date(draftSavedAt).toLocaleTimeString()
                            : "No draft"
                        }
                        color={draftExists ? "success" : "default"}
                        size="small"
                        sx={{
                          height: 32,
                          fontSize: "0.7rem",
                          "& .MuiChip-icon": { ml: 0.5 },
                        }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => saveDraftImmediate()}
                        disabled={draftSaving}
                        sx={{
                          height: 32,
                          minWidth: "auto",
                          px: 1,
                          fontSize: "0.7rem",
                          fontWeight: 600,
                        }}
                      >
                        💾 Save
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={clearDraft}
                        disabled={!draftExists}
                        sx={{
                          height: 32,
                          minWidth: "auto",
                          px: 1,
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          borderColor: "#ef4444",
                          color: "#ef4444",
                          "&:hover": {
                            borderColor: "#dc2626",
                            bgcolor: "rgba(239,68,68,0.08)",
                          },
                        }}
                      >
                        🗑️ Clear
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={add500Rows}
                        sx={{
                          height: 32,
                          minWidth: "auto",
                          px: 1,
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          borderColor: "#3b82f6",
                          color: "#3b82f6",
                          "&:hover": {
                            borderColor: "#2563eb",
                            bgcolor: "rgba(59,130,246,0.08)",
                          },
                        }}
                      >
                        ➕ 500
                      </Button>
                    </Stack>
                  </Box>

                  {/* Right Arrow */}
                  <Box
                    sx={{
                      width: 16,
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isDarkMode ? "#64748b" : "#94a3b8",
                      fontSize: "0.65rem",
                      flexShrink: 0,
                    }}
                  >
                    ▶
                  </Box>
                </Box>
                {/* Right: Fixed Submit Button */}
                <Button
                  variant="contained"
                  onClick={handleMultiSubmit}
                  disabled={
                    multiLoading ||
                    gridDuplicateWSNs.size > 0 ||
                    crossWarehouseWSNs.size > 0
                  }
                  startIcon={
                    multiLoading ? (
                      <CircularProgress size={16} sx={{ color: "white" }} />
                    ) : (
                      <CheckCircle sx={{ fontSize: 16 }} />
                    )
                  }
                  sx={{
                    flexShrink: 0,
                    height: 36,
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    px: 1.5,
                    minWidth: 100,
                    background:
                      "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    boxShadow: "none",
                    "&:hover": { boxShadow: "none" },
                  }}
                >
                  SUBMIT ({multiRows.filter((r) => r.wsn?.trim()).length})
                </Button>
              </Box>

              {/* DESKTOP: Original Layout */}
              <Box
                sx={{
                  display: { xs: "none", md: "flex" },
                  alignItems: "center",
                  gap: { xs: 0.5, sm: 1 },
                  flexWrap: "wrap",
                  py: 0.5,
                  flexShrink: 0,
                }}
              >
                {/* ⚡ EXCEL-LIKE: Selection indicator - only show when multiple cells selected */}
                {selectedRange &&
                  Math.abs(selectedRange.endRow - selectedRange.startRow) >
                    0 && (
                    <Chip
                      label={`📊 ${Math.abs(selectedRange.endRow - selectedRange.startRow) + 1} cells selected (${selectedRange.startCol})`}
                      color="primary"
                      size="small"
                      onDelete={() => {
                        setSelectionRange(null);
                        rangeStartCellRef.current = null;
                      }}
                      sx={{
                        fontWeight: 600,
                        height: 28,
                        "& .MuiChip-deleteIcon": { color: "#93c5fd" },
                      }}
                    />
                  )}
                <Chip
                  label={
                    draftSavedAt
                      ? `Draft saved ${new Date(draftSavedAt).toLocaleTimeString()}`
                      : "No draft"
                  }
                  color={draftExists ? "success" : "default"}
                  size="small"
                  sx={{ height: 28 }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => saveDraftImmediate()}
                  disabled={draftSaving}
                  sx={{ height: 32, fontSize: "0.75rem" }}
                >
                  Save Draft
                </Button>
                <Button
                  size="small"
                  variant="text"
                  onClick={clearDraft}
                  disabled={!draftExists}
                  sx={{ height: 32, fontSize: "0.75rem" }}
                >
                  Clear Draft
                </Button>

                {/* +500 Rows Button - Moved to bottom bar */}
                <Tooltip
                  title="Add 500 more empty rows to the grid"
                  placement="top"
                >
                  <Button
                    size="small"
                    variant="contained"
                    onClick={add500Rows}
                    sx={{
                      height: 32,
                      px: 2,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      borderRadius: 1,
                      background:
                        "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
                      textTransform: "none",
                      boxShadow: "none",
                      "&:hover": {
                        background:
                          "linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)",
                        boxShadow: "none",
                      },
                    }}
                  >
                    +500 Rows
                  </Button>
                </Tooltip>

                {/* SUBMIT BUTTON */}
                <Button
                  variant="contained"
                  onClick={handleMultiSubmit}
                  disabled={
                    multiLoading ||
                    gridDuplicateWSNs.size > 0 ||
                    crossWarehouseWSNs.size > 0
                  }
                  startIcon={
                    multiLoading ? (
                      <CircularProgress size={18} sx={{ color: "white" }} />
                    ) : (
                      <CheckCircle sx={{ fontSize: 18 }} />
                    )
                  }
                  sx={{
                    ml: "auto",
                    height: 38,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    minWidth: { xs: 150, sm: 200 },
                    background:
                      "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  }}
                >
                  SUBMIT ALL ({multiRows.filter((r) => r.wsn?.trim()).length}{" "}
                  rows)
                </Button>
              </Box>

              {/* MULTI ENTRY TAB: COLUMN SETTINGS DIALOG */}
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
                    background:
                      "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                    color: "white",
                    py: 2,
                  }}
                >
                  ⚙️ Columns View Settings
                </DialogTitle>
                <DialogContent sx={{ py: 3, maxHeight: 600, overflow: "auto" }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      mb: 2,
                      fontWeight: 800,
                      color: "#1e40af",
                      textTransform: "uppercase",
                      fontSize: "0.75rem",
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

                              const ordered = [
                                ...EDITABLE_COLUMNS,
                                ...ALL_MASTER_COLUMNS,
                              ].filter((c) => next.includes(c));

                              saveColumnSettings(ordered);
                            }}
                          />
                        }
                        label={col.replace(/_/g, " ").toUpperCase()}
                      />
                    ))}
                  </Stack>

                  <Divider sx={{ my: 2 }} />
                  <Typography
                    variant="subtitle2"
                    sx={{
                      mb: 2,
                      fontWeight: 800,
                      color: "#3b82f6",
                      textTransform: "uppercase",
                      fontSize: "0.75rem",
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

                              const ordered = [
                                ...EDITABLE_COLUMNS,
                                ...ALL_MASTER_COLUMNS,
                              ].filter((c) => next.includes(c));

                              saveColumnSettings(ordered);
                            }}
                          />
                        }
                        label={col.replace(/_/g, " ").toUpperCase()}
                      />
                    ))}
                  </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2, background: "#f9fafb" }}>
                  <Button
                    onClick={() => setColumnSettingsOpen(false)}
                    sx={{ fontWeight: 700 }}
                  >
                    Close
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => setColumnSettingsOpen(false)}
                    sx={{
                      background:
                        "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                      fontWeight: 700,
                    }}
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
                    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                  },
                }}
              >
                <DialogTitle
                  sx={{
                    background:
                      "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                    color: "white",
                    fontWeight: 800,
                    fontSize: "1.1rem",
                    py: 1.5,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <SettingsIcon />
                    Multi Entry Grid Settings
                  </Box>
                </DialogTitle>

                <DialogContent sx={{ mt: 2, pb: 1 }}>
                  <Stack spacing={2.5}>
                    <Alert severity="info" sx={{ fontSize: "0.8rem", py: 0.5 }}>
                      Settings auto-save and persist after reload 💾
                    </Alert>

                    {/* SORTABLE */}
                    <Box>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={multiGridSettings.sortable}
                            onChange={(e) =>
                              updateMultiGridSettings({
                                ...multiGridSettings,
                                sortable: e.target.checked,
                              })
                            }
                            sx={{
                              "&.Mui-checked": { color: "#1e40af" },
                            }}
                          />
                        }
                        label={
                          <Box>
                            <Typography
                              sx={{
                                fontWeight: 700,
                                fontSize: "0.95rem",
                                color: "#1e293b",
                              }}
                            >
                              ⬆️ Enable Sorting
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: "#64748b", fontSize: "0.75rem" }}
                            >
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
                            onChange={(e) =>
                              updateMultiGridSettings({
                                ...multiGridSettings,
                                filter: e.target.checked,
                              })
                            }
                            sx={{
                              "&.Mui-checked": { color: "#1e40af" },
                            }}
                          />
                        }
                        label={
                          <Box>
                            <Typography
                              sx={{
                                fontWeight: 700,
                                fontSize: "0.95rem",
                                color: "#1e293b",
                              }}
                            >
                              🔍 Enable Filtering
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: "#64748b", fontSize: "0.75rem" }}
                            >
                              Filter icon appears in column headers for quick
                              search
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
                            onChange={(e) =>
                              updateMultiGridSettings({
                                ...multiGridSettings,
                                resizable: e.target.checked,
                              })
                            }
                            sx={{
                              "&.Mui-checked": { color: "#1e40af" },
                            }}
                          />
                        }
                        label={
                          <Box>
                            <Typography
                              sx={{
                                fontWeight: 700,
                                fontSize: "0.95rem",
                                color: "#1e293b",
                              }}
                            >
                              ↔️ Enable Column Resize
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: "#64748b", fontSize: "0.75rem" }}
                            >
                              Drag column borders to adjust width
                            </Typography>
                          </Box>
                        }
                      />
                    </Box>
                  </Stack>
                </DialogContent>

                <DialogActions
                  sx={{ p: 2, pt: 1, background: "#f9fafb", gap: 1 }}
                >
                  <Button
                    onClick={() => {
                      const defaultSettings = {
                        sortable: true,
                        filter: true,
                        resizable: true,
                        editable: true,
                      };
                      updateMultiGridSettings(defaultSettings);
                      toast.success("Settings reset to default");
                    }}
                    sx={{
                      fontWeight: 700,
                      color: "#78716c",
                      "&:hover": {
                        bgcolor: "rgba(120, 113, 108, 0.1)",
                      },
                    }}
                  >
                    🔄 Reset All
                  </Button>
                  <Box sx={{ flex: 1 }} />
                  <Button
                    variant="contained"
                    onClick={() => setMultiGridSettingsOpen(false)}
                    sx={{
                      background:
                        "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                      fontWeight: 700,
                      boxShadow: "0 4px 12px rgba(30, 64, 175, 0.3)",
                      "&:hover": {
                        background:
                          "linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)",
                      },
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
                fullScreen={isMobile}
                PaperProps={{
                  sx: {
                    borderRadius: 2,
                    maxHeight: "80vh",
                  },
                }}
              >
                <DialogTitle
                  sx={{
                    background:
                      "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                    color: "white",
                    fontWeight: 700,
                    py: 1.5,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    📦 Select Master Data Batch(es)
                  </Box>
                </DialogTitle>
                <DialogContent sx={{ mt: 2, pb: 1 }}>
                  <Alert severity="info" sx={{ mb: 2, fontSize: "0.8rem" }}>
                    Select batch(es) to cache locally for instant WSN lookup.
                    Only selected batch data will be cached (~1000 products =
                    2-3 seconds).
                  </Alert>

                  {/* Batch loading progress */}
                  {batchCacheLoading && batchCacheProgress && (
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="caption"
                        sx={{ color: "#6366f1", fontWeight: 600 }}
                      >
                        {batchCacheProgress.message}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={
                          (batchCacheProgress.loaded /
                            Math.max(batchCacheProgress.total, 1)) *
                          100
                        }
                        sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                      />
                    </Box>
                  )}

                  {/* Refresh batches button */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 1.5,
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 700, color: "text.primary" }}
                    >
                      Available Batches ({availableBatches.length})
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<RefreshIcon sx={{ fontSize: "0.9rem" }} />}
                      onClick={async () => {
                        const batches = await getBatchList();
                        setAvailableBatches(batches);
                        toast.success(`Refreshed: ${batches.length} batches`);
                      }}
                      sx={{ fontSize: "0.7rem", textTransform: "none" }}
                    >
                      Refresh
                    </Button>
                  </Box>

                  {/* Batch list */}
                  <Stack spacing={1} sx={{ maxHeight: 350, overflow: "auto" }}>
                    {availableBatches.length === 0 ? (
                      <Alert severity="warning">
                        No batches found. Upload master data first.
                      </Alert>
                    ) : (
                      availableBatches.map((batch) => (
                        <Box
                          key={batch.batch_id}
                          onClick={() => {
                            setSelectedBatchIds((prev) =>
                              prev.includes(batch.batch_id)
                                ? prev.filter((id) => id !== batch.batch_id)
                                : [...prev, batch.batch_id],
                            );
                          }}
                          sx={{
                            p: 1.5,
                            borderRadius: 1.5,
                            border: (theme) =>
                              `2px solid ${selectedBatchIds.includes(batch.batch_id) ? "#8b5cf6" : theme.palette.divider}`,
                            bgcolor: (theme) =>
                              selectedBatchIds.includes(batch.batch_id)
                                ? "rgba(139, 92, 246, 0.15)"
                                : theme.palette.background.paper,
                            cursor: "pointer",
                            transition: "all 0.2s",
                            "&:hover": {
                              borderColor: "#8b5cf6",
                              bgcolor: "rgba(139, 92, 246, 0.1)",
                            },
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <Checkbox
                                size="small"
                                checked={selectedBatchIds.includes(
                                  batch.batch_id,
                                )}
                                sx={{
                                  p: 0,
                                  color: "#8b5cf6",
                                  "&.Mui-checked": { color: "#8b5cf6" },
                                }}
                              />
                              <Typography
                                sx={{
                                  fontWeight: 600,
                                  fontSize: "0.85rem",
                                  fontFamily: "monospace",
                                  color: "text.primary",
                                }}
                              >
                                {batch.batch_id}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={`${batch.count.toLocaleString()} items`}
                              sx={{
                                bgcolor: (theme) =>
                                  theme.palette.mode === "dark"
                                    ? "rgba(99, 102, 241, 0.3)"
                                    : "#dbeafe",
                                color: (theme) =>
                                  theme.palette.mode === "dark"
                                    ? "#a5b4fc"
                                    : "#1e40af",
                                fontWeight: 600,
                                fontSize: "0.7rem",
                              }}
                            />
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary", ml: 3.5 }}
                          >
                            Created:{" "}
                            {new Date(batch.created_at).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </Typography>
                        </Box>
                      ))
                    )}
                  </Stack>

                  {/* Selected summary */}
                  {selectedBatchIds.length > 0 && (
                    <Box
                      sx={{
                        mt: 2,
                        p: 1.5,
                        bgcolor: "rgba(139, 92, 246, 0.15)",
                        borderRadius: 1.5,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, color: "#a78bfa" }}
                      >
                        ✅ {selectedBatchIds.length} batch(es) selected
                        {cacheStats &&
                          ` • ${cacheStats.totalRecords.toLocaleString()} products cached`}
                      </Typography>
                    </Box>
                  )}
                </DialogContent>
                <DialogActions
                  sx={{ p: 2, pt: 1, bgcolor: "background.default", gap: 1 }}
                >
                  <Button
                    onClick={() => {
                      setSelectedBatchIds([]);
                      localStorage.removeItem("inbound_selected_batches");
                      toast.success("Batch selection cleared");
                    }}
                    disabled={selectedBatchIds.length === 0}
                    sx={{
                      color: "#dc2626",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                    }}
                  >
                    Clear Selection
                  </Button>
                  <Box sx={{ flex: 1 }} />
                  <Button
                    variant="contained"
                    onClick={() => setBatchSelectorOpen(false)}
                    sx={{
                      background:
                        "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                      fontWeight: 700,
                      boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                      "&:hover": {
                        background:
                          "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                      },
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
                <DialogTitle
                  sx={{
                    background:
                      "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    color: "white",
                    fontWeight: 700,
                    py: 1.5,
                  }}
                >
                  ⚠️ WSN Not In Selected Batch
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    The scanned WSN <strong>{wsnNotInBatchDialog?.wsn}</strong>{" "}
                    was not found in the selected batch(es).
                  </Alert>
                  <Typography variant="body2" sx={{ color: "#374151" }}>
                    Do you want to continue with this WSN anyway? Product
                    details will be fetched from the database.
                  </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, gap: 1 }}>
                  <Button
                    onClick={() => {
                      // Clear the WSN and close dialog
                      if (wsnNotInBatchDialog) {
                        const newRows = [...multiRows];
                        newRows[wsnNotInBatchDialog.rowIndex].wsn = "";
                        ALL_MASTER_COLUMNS.forEach((col) => {
                          newRows[wsnNotInBatchDialog.rowIndex][col] = null;
                        });
                        setMultiRows(newRows);
                      }
                      setWsnNotInBatchDialog(null);
                    }}
                    sx={{ color: "#dc2626", fontWeight: 600 }}
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
                          newRows[wsnNotInBatchDialog.rowIndex][col] =
                            wsnNotInBatchDialog.masterData[col] ?? null;
                        });
                        setMultiRows(newRows);
                        toast.success(
                          `Applied product details for ${wsnNotInBatchDialog.wsn}`,
                        );
                      }
                      setWsnNotInBatchDialog(null);
                    }}
                    sx={{
                      background:
                        "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                      fontWeight: 700,
                    }}
                  >
                    Continue Anyway
                  </Button>
                </DialogActions>
              </Dialog>
            </Box>
          )}

          {/* TAB: BATCH MANAGER */}
          {visibleTabCodes[tabValue] === "batches" && (
            <BatchManagementTab
              batches={batches}
              loading={batchLoading}
              onRefresh={loadBatches}
              onDelete={
                canSeeButton("batches:delete") ? deleteBatch : undefined
              }
              canDelete={canSeeButton("batches:delete")}
              title="Batch Management"
              emptyMessage="No batches found"
              emptySubMessage="Batches will appear here after inbound uploads"
            />
          )}
        </Box>
      </Box>

      {/* ================= LIST OPTIONS PANEL DRAWER ================= */}
      <Drawer
        anchor="right"
        open={listOptionsPanelOpen}
        onClose={() => setListOptionsPanelOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "85%", sm: 380 },
            maxWidth: "100vw",
            bgcolor: isDarkMode ? "#1e293b" : "#ffffff",
            borderLeft: isDarkMode ? "1px solid #334155" : "1px solid #e2e8f0",
          },
        }}
      >
        {/* Panel Header */}
        <Box
          sx={{
            p: 2,
            background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>
            🔍 Options
          </Typography>
          <IconButton
            size="small"
            onClick={() => setListOptionsPanelOpen(false)}
            sx={{ color: "white" }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Panel Content with Accordions */}
        <Box sx={{ overflow: "auto", flex: 1 }}>
          {/* ═══════════ FILTERS ACCORDION ═══════════ */}
          <Accordion
            expanded={listSettingsPanelExpanded === "filters"}
            onChange={(_, isExpanded) =>
              setListSettingsPanelExpanded(isExpanded ? "filters" : false)
            }
            disableGutters
            sx={{
              bgcolor: "transparent",
              boxShadow: "none",
              "&:before": { display: "none" },
              borderBottom: isDarkMode
                ? "1px solid #334155"
                : "1px solid #e2e8f0",
            }}
          >
            <AccordionSummary
              expandIcon={
                <ExpandMoreIcon
                  sx={{ color: isDarkMode ? "#94a3b8" : "#64748b" }}
                />
              }
              sx={{
                px: 2,
                minHeight: 56,
                "&.Mui-expanded": { minHeight: 56 },
                "& .MuiAccordionSummary-content": { my: 1.5 },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <FilterListIcon sx={{ color: "#3b82f6", fontSize: 22 }} />
                <Box>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      color: isDarkMode ? "#e2e8f0" : "#1e293b",
                    }}
                  >
                    Filters
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.7rem",
                      color: isDarkMode ? "#64748b" : "#94a3b8",
                    }}
                  >
                    {filtersActive
                      ? "Active filters applied"
                      : "No filters applied"}
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
              <Stack spacing={1.5}>
                
                {/* Date Filters */}
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField
                    label="From Date"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={dateFromFilter || ""}
                    onChange={(e) => {
                      setDateFromFilter(e.target.value);
                      setPage(1);
                    }}
                    inputRef={fromDateFilterRef}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    onClick={() => {
                      try {
                        fromDateFilterRef.current?.showPicker?.();
                      } catch {
                        fromDateFilterRef.current?.focus();
                      }
                    }}
                    fullWidth
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        height: 40,
                        bgcolor: isDarkMode ? "#0f172a" : "#f8fafc",
                        cursor: "pointer",
                      },
                      "& .MuiInputBase-input": {
                        height: "40px",
                        boxSizing: "border-box",
                        cursor: "pointer",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                      },
                    }}
                  />

                  <TextField
                    label="To Date"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={dateToFilter || ""}
                    onChange={(e) => {
                      setDateToFilter(e.target.value);
                      setPage(1);
                    }}
                    inputRef={toDateFilterRef}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    onClick={() => {
                      try {
                        toDateFilterRef.current?.showPicker?.();
                      } catch {
                        toDateFilterRef.current?.focus();
                      }
                    }}
                    fullWidth
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        height: 40,
                        bgcolor: isDarkMode ? "#0f172a" : "#f8fafc",
                        cursor: "pointer",
                      },
                      "& .MuiInputBase-input": {
                        height: "40px",
                        boxSizing: "border-box",
                        cursor: "pointer",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                      },
                    }}
                  />
                </Box>

                {/* Brand Filter */}
                <TextField
                  select
                  size="small"
                  label="Brand"
                  value={brandFilter}
                  onChange={(e) => {
                    setBrandFilter(e.target.value);
                    if (e.target.value && categoryFilter) {
                      const validCategories = listData
                        .filter((item) => item.brand === e.target.value)
                        .map((item) => item.cms_vertical);
                      if (!validCategories.includes(categoryFilter)) {
                        setCategoryFilter("");
                      }
                    }
                    setPage(1);
                  }}
                  fullWidth
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      height: 40,
                      bgcolor: isDarkMode ? "#0f172a" : "#f8fafc",
                    },
                  }}
                >
                  <MenuItem value="">All Brands</MenuItem>
                  {(categoryFilter ? filteredBrands : brands).map((b) => (
                    <MenuItem key={b} value={b}>
                      {b}
                    </MenuItem>
                  ))}
                </TextField>

                {/* Category Filter */}
                <TextField
                  select
                  size="small"
                  label="Category"
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    if (e.target.value && brandFilter) {
                      const validBrands = listData
                        .filter((item) => item.cms_vertical === e.target.value)
                        .map((item) => item.brand);
                      if (!validBrands.includes(brandFilter)) {
                        setBrandFilter("");
                      }
                    }
                    setPage(1);
                  }}
                  fullWidth
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      height: 40,
                      bgcolor: isDarkMode ? "#0f172a" : "#f8fafc",
                    },
                  }}
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {(brandFilter ? filteredCategories : categories).map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </TextField>

                {/* Status Filter (Outbound in Process) */}
                <TextField
                  select
                  size="small"
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  fullWidth
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      height: 40,
                      bgcolor: isDarkMode ? "#0f172a" : "#f8fafc",
                    },
                  }}
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="outbound_in_process">
                    Outbound in Process
                  </MenuItem>
                  <MenuItem value="dispatched">Dispatched</MenuItem>
                  <MenuItem value="available">Available</MenuItem>
                </TextField>
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* ═══════════ COLUMNS ACCORDION ═══════════ */}
          {canSeeButton("list:columns") && (
            <Accordion
              expanded={listSettingsPanelExpanded === "columns"}
              onChange={(_, isExpanded) =>
                setListSettingsPanelExpanded(isExpanded ? "columns" : false)
              }
              disableGutters
              sx={{
                bgcolor: "transparent",
                boxShadow: "none",
                "&:before": { display: "none" },
                borderBottom: isDarkMode
                  ? "1px solid #334155"
                  : "1px solid #e2e8f0",
              }}
            >
              <AccordionSummary
                expandIcon={
                  <ExpandMoreIcon
                    sx={{ color: isDarkMode ? "#94a3b8" : "#64748b" }}
                  />
                }
                sx={{
                  px: 2,
                  minHeight: 56,
                  "&.Mui-expanded": { minHeight: 56 },
                  "& .MuiAccordionSummary-content": { my: 1.5 },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <ViewColumnIcon sx={{ color: "#10b981", fontSize: 22 }} />
                  <Box>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        color: isDarkMode ? "#e2e8f0" : "#1e293b",
                      }}
                    >
                      Columns
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.7rem",
                        color: isDarkMode ? "#64748b" : "#94a3b8",
                      }}
                    >
                      {listColumns.length} of {INBOUND_LIST_COLUMNS.length}{" "}
                      visible
                    </Typography>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                {!canAccessButton("list:columns") ? (
                  <Alert severity="warning" sx={{ fontSize: "0.8rem" }}>
                    You don't have permission to manage columns
                  </Alert>
                ) : (
                  <Box sx={{ maxHeight: 280, overflow: "auto", pr: 1 }}>
                    <Stack spacing={0.5}>
                      {INBOUND_LIST_COLUMNS.map((col) => (
                        <FormControlLabel
                          key={col}
                          control={
                            <Checkbox
                              size="small"
                              checked={listColumns.includes(col)}
                              onChange={() => {
                                let next: string[];
                                if (listColumns.includes(col)) {
                                  next = listColumns.filter(
                                    (c: string) => c !== col,
                                  );
                                } else {
                                  next = [...listColumns, col];
                                }
                                // Maintain order using INBOUND_LIST_COLUMNS
                                const ordered = INBOUND_LIST_COLUMNS.concat(
                                  ALL_MASTER_COLUMNS.filter(
                                    (c) => !INBOUND_LIST_COLUMNS.includes(c),
                                  ),
                                ).filter((c) => next.includes(c));
                                saveListColumnSettings(ordered);
                              }}
                              sx={{
                                py: 0.25,
                                "&.Mui-checked": { color: "#10b981" },
                              }}
                            />
                          }
                          label={
                            <Typography
                              sx={{
                                fontSize: "0.8rem",
                                color: isDarkMode ? "#e2e8f0" : "#334155",
                              }}
                            >
                              {col.replace(/_/g, " ").toUpperCase()}
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
            expanded={listSettingsPanelExpanded === "grid"}
            onChange={(_, isExpanded) =>
              setListSettingsPanelExpanded(isExpanded ? "grid" : false)
            }
            disableGutters
            sx={{
              bgcolor: "transparent",
              boxShadow: "none",
              "&:before": { display: "none" },
              borderBottom: isDarkMode
                ? "1px solid #334155"
                : "1px solid #e2e8f0",
            }}
          >
            <AccordionSummary
              expandIcon={
                <ExpandMoreIcon
                  sx={{ color: isDarkMode ? "#94a3b8" : "#64748b" }}
                />
              }
              sx={{
                px: 2,
                minHeight: 56,
                "&.Mui-expanded": { minHeight: 56 },
                "& .MuiAccordionSummary-content": { my: 1.5 },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <TableChartIcon sx={{ color: "#f59e0b", fontSize: 22 }} />
                <Box>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      color: isDarkMode ? "#e2e8f0" : "#1e293b",
                    }}
                  >
                    Grid Settings
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.7rem",
                      color: isDarkMode ? "#64748b" : "#94a3b8",
                    }}
                  >
                    Sorting, filtering, resize
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
              <Stack spacing={1.5}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={gridSettings.sortable}
                      onChange={(e) =>
                        updateGridSettings({
                          ...gridSettings,
                          sortable: e.target.checked,
                        })
                      }
                      sx={{ "&.Mui-checked": { color: "#f59e0b" } }}
                    />
                  }
                  label={
                    <Box>
                      <Typography
                        sx={{
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          color: isDarkMode ? "#e2e8f0" : "#334155",
                        }}
                      >
                        ⬆️ Enable Sorting
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.7rem",
                          color: isDarkMode ? "#64748b" : "#94a3b8",
                        }}
                      >
                        Click headers to sort
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={gridSettings.filter}
                      onChange={(e) =>
                        updateGridSettings({
                          ...gridSettings,
                          filter: e.target.checked,
                        })
                      }
                      sx={{ "&.Mui-checked": { color: "#f59e0b" } }}
                    />
                  }
                  label={
                    <Box>
                      <Typography
                        sx={{
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          color: isDarkMode ? "#e2e8f0" : "#334155",
                        }}
                      >
                        🔍 Enable Filtering
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.7rem",
                          color: isDarkMode ? "#64748b" : "#94a3b8",
                        }}
                      >
                        Filter in column headers
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={gridSettings.resizable}
                      onChange={(e) =>
                        updateGridSettings({
                          ...gridSettings,
                          resizable: e.target.checked,
                        })
                      }
                      sx={{ "&.Mui-checked": { color: "#f59e0b" } }}
                    />
                  }
                  label={
                    <Box>
                      <Typography
                        sx={{
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          color: isDarkMode ? "#e2e8f0" : "#334155",
                        }}
                      >
                        ↔️ Column Resize
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.7rem",
                          color: isDarkMode ? "#64748b" : "#94a3b8",
                        }}
                      >
                        Drag borders to resize
                      </Typography>
                    </Box>
                  }
                />
                <Button
                  size="small"
                  onClick={() => {
                    updateGridSettings({
                      sortable: true,
                      filter: true,
                      resizable: true,
                      editable: true,
                    });
                    toast.success("Grid settings reset");
                  }}
                  sx={{
                    alignSelf: "flex-start",
                    fontSize: "0.75rem",
                    color: isDarkMode ? "#94a3b8" : "#64748b",
                  }}
                >
                  🔄 Reset to Default
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* ═══════════   ACTIONS SECTION  ═══════════ */}
          <Box
            sx={{
              p: 2,
              borderBottom: isDarkMode
                ? "1px solid #334155"
                : "1px solid #e2e8f0",
            }}
          >
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: "0.8rem",
                color: isDarkMode ? "#94a3b8" : "#64748b",
                mb: 1.5,
                textTransform: "uppercase",
              }}
            >
              Actions
            </Typography>
            <Stack spacing={1}>
              {canSeeButton("list:export") && (
                <Tooltip
                  title={
                    !canAccessButton("list:export")
                      ? "You don't have permission to use this feature"
                      : ""
                  }
                  arrow
                >
                  <span style={{ width: "100%" }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<DownloadIcon />}
                      disabled={!canAccessButton("list:export")}
                      onClick={() => {
                        if (!canAccessButton("list:export")) return;
                        exportToExcel();
                        setListOptionsPanelOpen(false);
                      }}
                      sx={{
                        height: 44,
                        background:
                          "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        fontWeight: 600,
                        "&:hover": {
                          background:
                            "linear-gradient(135deg, #059669 0%, #047857 100%)",
                        },
                        "&.Mui-disabled": { background: "#94a3b8" },
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
                startIcon={
                  refreshing ? <CircularProgress size={16} /> : <RefreshIcon />
                }
                disabled={refreshing}
                onClick={() => {
                  loadInboundList({ buttonRefresh: true });
                  setListOptionsPanelOpen(false);
                }}
                sx={{
                  height: 44,
                  fontWeight: 600,
                  borderColor: "#3b82f6",
                  color: "#3b82f6",
                  "&:hover": {
                    borderColor: "#2563eb",
                    bgcolor: "rgba(59, 130, 246, 0.08)",
                  },
                }}
              >
                {refreshing ? "Refreshing..." : "Refresh Data"}
              </Button>

              {filtersActive && (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<FilterListIcon />}
                  onClick={() => {
                    setListLoading(true);
                    setSearchInput("");
                    setSearchFilter("");
                    setBrandFilter("");
                    setCategoryFilter("");
                    setStatusFilter("");
                    setDateFromFilter("");
                    setDateToFilter("");
                    setPage(1);
                    setListOptionsPanelOpen(false);
                  }}
                  sx={{
                    height: 44,
                    fontWeight: 600,
                    borderColor: "#f59e0b",
                    color: "#f59e0b",
                    "&:hover": {
                      borderColor: "#d97706",
                      bgcolor: "rgba(245, 158, 11, 0.08)",
                    },
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
    </AppLayout>
  );
}
