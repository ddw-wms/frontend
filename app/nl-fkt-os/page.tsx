"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  MenuItem,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  useMediaQuery,
  useTheme,
  IconButton,
  Tooltip,
  Drawer,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Select,
  Pagination,
  Fade,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterListIcon,
  ViewColumn as ViewColumnIcon,
  FileDownload as ExportIcon,
  Delete as DeleteIcon,
  FirstPage,
  LastPage,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from "@mui/icons-material";
import { nlFktOsAPI, nlMasterDataAPI } from "@/lib/nl-api";
import { useNlGridSx, nlFormatDate } from "@/lib/nl-utils";
import { useWarehouse } from "@/app/context/WarehouseContext";
import { getStoredUser } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";
import { StandardPageHeader, StandardTabs } from "@/components";
import { useTableRowHeight } from "@/app/context/AppearanceContext";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import BatchManagementTab from "@/components/BatchManagementTab";
import type { BatchData } from "@/components/BatchManagementTab";
import toast, { Toaster } from "react-hot-toast";
import { AgGridReact } from "@/components/AGGridScrollWrapper";
import {
  ModuleRegistry,
  AllCommunityModule,
  ClientSideRowModelModule,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

const formatDate = nlFormatDate;

const ALL_TABS = ["OS Data", "NL Master Data", "Batches"];
const TAB_CODES = ["os_data", "master_data", "batches"];

const ALL_COLUMNS = [
  { field: "vrp_id", label: "VRP ID" },
  { field: "inbound_date", label: "Inbound Date" },
  { field: "region", label: "Region" },
  { field: "category", label: "Category" },
  { field: "lot_type", label: "Lot Type" },
  { field: "declared_boxes", label: "Declared Boxes" },
  { field: "declared_qty", label: "Declared Qty" },
  { field: "batch_id", label: "Batch ID" },
  { field: "remarks", label: "Remarks" },
  { field: "uploaded_by_name", label: "Uploaded By" },
  { field: "uploaded_at", label: "Uploaded At" },
];

const STORAGE_KEY = "nlFktOs_visibleColumns";

export default function NLFktOsPage() {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);
  const tableRowHeight = useTableRowHeight();
  const { filterTabs, canSeeTab, isAdmin, canSeeButton } =
    usePagePermissions("nl_fkt_os");

  const visibleTabs = useMemo(() => {
    const f = filterTabs(ALL_TABS, TAB_CODES);
    return f.length > 0 ? f : ALL_TABS;
  }, [filterTabs]);
  const visibleTabCodes = useMemo(() => {
    if (isAdmin) return TAB_CODES;
    const f = TAB_CODES.filter((c) => canSeeTab(c));
    return f.length > 0 ? f : TAB_CODES;
  }, [canSeeTab, isAdmin]);
  const [tabValue, setTabValue] = useState(0);
  const currentTabCode = visibleTabCodes[tabValue] || "os_data";
  const gridRef = useRef<any>(null);

  // OS Data state
  const [osData, setOsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);

  // Filters
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLotType, setFilterLotType] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch state
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // ======= NL MASTER DATA STATE =======
  const [mdLotType, setMdLotType] = useState<"RVP" | "RA">("RVP");
  const [mdData, setMdData] = useState<any[]>([]);
  const [mdLoading, setMdLoading] = useState(false);
  const [mdTotal, setMdTotal] = useState(0);
  const [mdSearch, setMdSearch] = useState("");
  const [mdPage, setMdPage] = useState(1);
  const [mdLimit, setMdLimit] = useState(100);
  const [mdFilterCategory, setMdFilterCategory] = useState("");
  const [mdFilterBrand, setMdFilterBrand] = useState("");
  const [mdUploading, setMdUploading] = useState(false);
  const [mdUploadDialogOpen, setMdUploadDialogOpen] = useState(false);
  const mdFileRef = useRef<HTMLInputElement>(null);
  const mdGridRef = useRef<any>(null);
  const mdDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const mdAbortControllerRef = useRef<AbortController | null>(null);
  const [mdBatches, setMdBatches] = useState<BatchData[]>([]);
  const [mdBatchLoading, setMdBatchLoading] = useState(false);
  const [mdShowBatches, setMdShowBatches] = useState(false);

  // Options panel
  const [optionsPanelOpen, setOptionsPanelOpen] = useState(false);
  const [optionsExpanded, setOptionsExpanded] = useState<string | false>(
    "filters",
  );
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    }
    return ALL_COLUMNS.map((c) => c.field);
  });

  // Grid settings
  const [gridSortable, setGridSortable] = useState(false);
  const [gridFilterable, setGridFilterable] = useState(false);
  const [gridResizable, setGridResizable] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
  }, []);

  // Load OS data
  const loadOsData = useCallback(async () => {
    if (!activeWarehouse?.id) return;
    try {
      setLoading(true);
      const res = await nlFktOsAPI.list({
        warehouse_id: activeWarehouse.id,
        search: search || undefined,
        category: filterCategory || undefined,
        lot_type: filterLotType || undefined,
        region: filterRegion || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
        page,
        limit,
      });
      setOsData(res.data?.data || []);
      setTotalRows(res.data?.total || 0);
    } catch {
      toast.error("Failed to load OS data");
    } finally {
      setLoading(false);
    }
  }, [
    activeWarehouse?.id,
    search,
    filterCategory,
    filterLotType,
    filterRegion,
    filterDateFrom,
    filterDateTo,
    page,
    limit,
  ]);

  useEffect(() => {
    if (currentTabCode === "os_data") loadOsData();
  }, [currentTabCode, loadOsData]);

  // Load batches
  const loadBatches = useCallback(async () => {
    if (!activeWarehouse?.id) return;
    try {
      setBatchLoading(true);
      const res = await nlFktOsAPI.getBatches(activeWarehouse.id);
      setBatches(res.data || []);
    } catch {
      toast.error("Failed to load batches");
    } finally {
      setBatchLoading(false);
    }
  }, [activeWarehouse?.id]);

  useEffect(() => {
    if (currentTabCode === "batches") loadBatches();
  }, [currentTabCode, loadBatches]);

  // ======= NL MASTER DATA HANDLERS =======
  const loadMasterData = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setMdLoading(true);
        const res = await nlMasterDataAPI.list(
          {
            lot_type: mdLotType,
            search: mdSearch || undefined,
            category: mdFilterCategory || undefined,
            brand: mdFilterBrand || undefined,
            page: mdPage,
            limit: mdLimit,
          },
          signal,
        );
        if (!signal?.aborted) {
          setMdData(res.data?.data || []);
          setMdTotal(res.data?.total || 0);
        }
      } catch (err: any) {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError")
          return;
        toast.error("Failed to load master data");
      } finally {
        if (!signal?.aborted) setMdLoading(false);
      }
    },
    [mdLotType, mdSearch, mdFilterCategory, mdFilterBrand, mdPage, mdLimit],
  );

  // Debounced master data loading — 300ms debounce to prevent DB flooding
  useEffect(() => {
    if (currentTabCode !== "master_data") return;
    // Cancel previous request
    if (mdAbortControllerRef.current) mdAbortControllerRef.current.abort();
    // Clear previous debounce timer
    if (mdDebounceRef.current) clearTimeout(mdDebounceRef.current);

    mdDebounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      mdAbortControllerRef.current = controller;
      loadMasterData(controller.signal);
    }, 300);

    return () => {
      if (mdDebounceRef.current) clearTimeout(mdDebounceRef.current);
      if (mdAbortControllerRef.current) mdAbortControllerRef.current.abort();
    };
  }, [currentTabCode, loadMasterData]);

  const loadMdBatches = useCallback(async () => {
    try {
      setMdBatchLoading(true);
      const res = await nlMasterDataAPI.getBatches(mdLotType);
      setMdBatches(res.data || []);
    } catch {
      toast.error("Failed to load master data batches");
    } finally {
      setMdBatchLoading(false);
    }
  }, [mdLotType]);

  useEffect(() => {
    if (currentTabCode === "master_data" && mdShowBatches) loadMdBatches();
  }, [currentTabCode, mdShowBatches, loadMdBatches]);

  const handleMdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("lot_type", mdLotType);
    try {
      setMdUploading(true);
      const res = await nlMasterDataAPI.upload(formData);
      toast.success(
        `${mdLotType} master data uploaded: ${res.data.count || 0} records (Batch: ${res.data.batch_id || ""})`,
      );
      setMdUploadDialogOpen(false);
      loadMasterData();
      if (mdShowBatches) loadMdBatches();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Upload failed");
    } finally {
      setMdUploading(false);
      if (mdFileRef.current) mdFileRef.current.value = "";
    }
  };

  const handleMdDeleteBatch = async (batchId: string) => {
    try {
      await nlMasterDataAPI.deleteBatch(batchId);
      toast.success("Batch deleted");
      loadMdBatches();
      loadMasterData();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Delete failed");
    }
  };

  const downloadMdTemplate = async () => {
    const XLSX = await import("xlsx");
    const templateData =
      mdLotType === "RVP"
        ? [
            {
              WSN: "",
              WID: "",
              "Product Title": "",
              Brand: "",
              Category: "",
              FSN: "",
              MRP: "",
              FSP: "",
              "HSN/SAC": "",
              "IGST Rate": "",
              "VRP ID": "",
              Remarks: "",
            },
          ]
        : [
            {
              WID: "",
              "Product Title": "",
              Brand: "",
              Category: "",
              FSN: "",
              MRP: "",
              FSP: "",
              "HSN/SAC": "",
              "IGST Rate": "",
              "VRP ID": "",
              Qty: "",
              Remarks: "",
            },
          ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = Object.keys(templateData[0]).map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `NL ${mdLotType} Template`);
    XLSX.writeFile(wb, `NL_Master_Data_${mdLotType}_Template.xlsx`);
  };

  const exportMdToExcel = async () => {
    if (mdData.length === 0) {
      toast.error("No data to export");
      return;
    }
    const XLSX = await import("xlsx");
    const exportData = mdData.map((row) => ({
      "Lot Type": row.lot_type,
      ...(row.wsn ? { WSN: row.wsn } : {}),
      WID: row.wid || "",
      "Product Title": row.product_title || "",
      Brand: row.brand || "",
      Category: row.category || "",
      FSN: row.fsn || "",
      MRP: row.mrp || "",
      FSP: row.fsp || "",
      "HSN/SAC": row.hsn_sac || "",
      "IGST Rate": row.igst_rate || "",
      "VRP ID": row.vrp_id || "",
      Qty: row.qty || 1,
      Remarks: row.remarks || "",
      "Batch ID": row.batch_id || "",
      "Uploaded By": row.uploaded_by_name || "",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `NL ${mdLotType} Data`);
    XLSX.writeFile(
      wb,
      `NL_Master_Data_${mdLotType}_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("Exported");
  };

  const mdColumnDefs = useMemo(() => {
    const cols: any[] = [
      {
        field: "lot_type",
        headerName: "Type",
        width: 80,
        pinned: "left" as const,
        cellRenderer: (p: any) => (
          <Chip
            label={p.value}
            size="small"
            color={p.value === "RVP" ? "secondary" : "warning"}
            sx={{ fontWeight: 700, fontSize: "0.7rem" }}
          />
        ),
      },
    ];
    if (mdLotType === "RVP") {
      cols.push({
        field: "wsn",
        headerName: "WSN",
        width: 160,
        pinned: "left" as const,
        cellStyle: { fontWeight: 600, color: "#7c3aed" },
      });
    }
    cols.push(
      {
        field: "wid",
        headerName: "WID",
        width: 140,
        cellStyle: { fontWeight: 600, color: "#d97706" },
      },
      {
        field: "product_title",
        headerName: "Product Title",
        flex: 2,
        minWidth: 200,
      },
      { field: "brand", headerName: "Brand", width: 130 },
      { field: "category", headerName: "Category", width: 140 },
      { field: "fsn", headerName: "FSN", width: 130 },
      { field: "mrp", headerName: "MRP", width: 100, type: "numericColumn" },
      { field: "fsp", headerName: "FSP", width: 100, type: "numericColumn" },
      { field: "vrp_id", headerName: "VRP ID", width: 130 },
      { field: "qty", headerName: "Qty", width: 80, type: "numericColumn" },
      { field: "batch_id", headerName: "Batch ID", width: 200 },
      { field: "uploaded_by_name", headerName: "Uploaded By", width: 130 },
    );
    return cols;
  }, [mdLotType]);

  const uniqueMdCategories = useMemo(
    () => [...new Set(mdData.map((r) => r.category).filter(Boolean))].sort(),
    [mdData],
  );
  const uniqueMdBrands = useMemo(
    () => [...new Set(mdData.map((r) => r.brand).filter(Boolean))].sort(),
    [mdData],
  );

  // Upload handler
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("warehouse_id", String(activeWarehouse?.id));
    try {
      setUploading(true);
      const res = await nlFktOsAPI.upload(formData);
      toast.success(
        `OS data uploaded: ${res.data.count || 0} VRPs imported (Batch: ${res.data.batch_id || ""})`,
      );
      setUploadDialogOpen(false);
      loadOsData();
      loadBatches();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Delete batch
  const handleDeleteBatch = async (batchId: string) => {
    try {
      await nlFktOsAPI.deleteBatch(batchId);
      toast.success("Batch deleted");
      loadBatches();
      loadOsData();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Delete failed");
    }
  };

  // Template download
  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const templateData = [
      {
        "VRP ID": "",
        "Inbound Date": "",
        Region: "",
        Category: "",
        "Lot Type": "",
        "Declared Boxes": "",
        "Declared Qty": "",
        Remarks: "",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 25 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FKT OS Template");
    XLSX.writeFile(wb, "FKT_OS_Upload_Template.xlsx");
  };

  // Export to Excel
  const exportToExcel = async () => {
    if (osData.length === 0) {
      toast.error("No data to export");
      return;
    }
    const XLSX = await import("xlsx");
    const exportData = osData.map((row) => ({
      "VRP ID": row.vrp_id,
      "Inbound Date": formatDate(row.inbound_date),
      Region: row.region || "",
      Category: row.category || "",
      "Lot Type": row.lot_type || "",
      "Declared Boxes": row.declared_boxes || "",
      "Declared Qty": row.declared_qty || "",
      "Batch ID": row.batch_id || "",
      Remarks: row.remarks || "",
      "Uploaded By": row.uploaded_by_name || "",
      "Uploaded At": formatDate(row.uploaded_at),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "NL OS Data");
    XLSX.writeFile(
      wb,
      `NL_OS_Data_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("Exported to Excel");
  };

  const toggleColumn = (field: string) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(field)
        ? prev.filter((f) => f !== field)
        : [...prev, field];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearFilters = () => {
    setSearch("");
    setFilterCategory("");
    setFilterLotType("");
    setFilterRegion("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(1);
  };
  const hasActiveFilters = !!(
    search ||
    filterCategory ||
    filterLotType ||
    filterRegion ||
    filterDateFrom ||
    filterDateTo
  );

  // AG Grid column defs
  const columnDefs = useMemo(() => {
    const defs: any[] = [];
    if (visibleColumns.includes("vrp_id"))
      defs.push({
        field: "vrp_id",
        headerName: "VRP ID",
        flex: 1,
        minWidth: 120,
        pinned: "left",
      });
    if (visibleColumns.includes("inbound_date"))
      defs.push({
        field: "inbound_date",
        headerName: "Inbound Date",
        width: 130,
        valueFormatter: (p: any) => formatDate(p.value),
      });
    if (visibleColumns.includes("region"))
      defs.push({ field: "region", headerName: "Region", width: 120 });
    if (visibleColumns.includes("category"))
      defs.push({
        field: "category",
        headerName: "Category",
        flex: 1,
        minWidth: 140,
      });
    if (visibleColumns.includes("lot_type"))
      defs.push({ field: "lot_type", headerName: "Lot Type", width: 100 });
    if (visibleColumns.includes("declared_boxes"))
      defs.push({
        field: "declared_boxes",
        headerName: "Decl Boxes",
        width: 110,
        type: "numericColumn",
      });
    if (visibleColumns.includes("declared_qty"))
      defs.push({
        field: "declared_qty",
        headerName: "Decl Qty",
        width: 100,
        type: "numericColumn",
      });
    if (visibleColumns.includes("batch_id"))
      defs.push({
        field: "batch_id",
        headerName: "Batch ID",
        flex: 1,
        minWidth: 180,
      });
    if (visibleColumns.includes("remarks"))
      defs.push({
        field: "remarks",
        headerName: "Remarks",
        flex: 1,
        minWidth: 150,
      });
    if (visibleColumns.includes("uploaded_by_name"))
      defs.push({
        field: "uploaded_by_name",
        headerName: "Uploaded By",
        width: 130,
      });
    if (visibleColumns.includes("uploaded_at"))
      defs.push({
        field: "uploaded_at",
        headerName: "Uploaded At",
        width: 140,
        valueFormatter: (p: any) => formatDate(p.value),
      });
    return defs;
  }, [visibleColumns]);

  const defaultColDef = useMemo(
    () => ({
      sortable: gridSortable,
      filter: gridFilterable,
      resizable: gridResizable,
      suppressMovable: true,
    }),
    [gridSortable, gridFilterable, gridResizable],
  );

  const uniqueCategories = useMemo(
    () => [...new Set(osData.map((r) => r.category).filter(Boolean))].sort(),
    [osData],
  );
  const uniqueLotTypes = useMemo(
    () => [...new Set(osData.map((r) => r.lot_type).filter(Boolean))].sort(),
    [osData],
  );
  const uniqueRegions = useMemo(
    () => [...new Set(osData.map((r) => r.region).filter(Boolean))].sort(),
    [osData],
  );

  // Dark mode grid sx — shared utility
  const gridSx = useNlGridSx(isDarkMode);

  if (!user)
    return (
      <AppLayout>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
          }}
        >
          <CircularProgress />
        </Box>
      </AppLayout>
    );
  if (!activeWarehouse)
    return (
      <AppLayout>
        <Box
          sx={{
            p: 3,
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Alert severity="warning" sx={{ maxWidth: 400 }}>
            No active warehouse selected. Go to Settings → Warehouses.
          </Alert>
        </Box>
      </AppLayout>
    );

  return (
    <AppLayout>
      <Toaster
        position="top-right"
        containerStyle={{ zIndex: 99999 }}
        toastOptions={{
          duration: 3000,
          style: {
            background: "#363636",
            color: "#fff",
            borderRadius: "10px",
            padding: "16px",
            fontWeight: 600,
          },
        }}
      />

      <Box
        sx={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: isDarkMode
            ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
            : "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
          "& *": { transition: "none !important" },
        }}
      >
        <StandardPageHeader
          title="NL OS Data"
          subtitle="FKT Non-Large Order Sheet"
          icon="📋"
          warehouseName={activeWarehouse?.name}
        />
        <StandardTabs
          value={tabValue}
          onChange={(_e: any, v: number) => setTabValue(v)}
          tabs={visibleTabs}
          color="#1e40af"
        />

        {/* ===== TAB: OS DATA ===== */}
        {currentTabCode === "os_data" && (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              p: { xs: 1, sm: 1.5 },
              bgcolor: isDarkMode ? "#0f172a" : "#f5f7fa",
            }}
          >
            <Paper sx={{ p: 1.5, mb: 1, borderRadius: 2 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ sm: "center" }}
              >
                <TextField
                  placeholder="Search VRP, region, category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  size="small"
                  sx={{ minWidth: 220, flex: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="primary" />
                      </InputAdornment>
                    ),
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadOsData();
                  }}
                />
                {canSeeButton("upload") && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={
                      uploading ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <UploadIcon />
                      )
                    }
                    onClick={() => setUploadDialogOpen(true)}
                    disabled={uploading}
                    sx={{
                      height: 38,
                      background: "linear-gradient(135deg, #1e40af, #3b82f6)",
                      textTransform: "none",
                      fontWeight: 600,
                    }}
                  >
                    Upload OS
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={loadOsData}
                  disabled={loading}
                >
                  Refresh
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SettingsIcon />}
                  onClick={() => setOptionsPanelOpen(true)}
                  sx={{ position: "relative" }}
                >
                  Options
                  {hasActiveFilters && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        width: 8,
                        height: 8,
                        bgcolor: "#ef4444",
                        borderRadius: "50%",
                      }}
                    />
                  )}
                </Button>
              </Stack>
            </Paper>

            <Stack
              direction="row"
              spacing={1}
              sx={{ mb: 1 }}
              alignItems="center"
            >
              <Chip
                label={`${totalRows} VRPs`}
                size="small"
                color="primary"
                variant="outlined"
              />
              {hasActiveFilters && (
                <Chip
                  label="Filters active"
                  size="small"
                  color="warning"
                  variant="outlined"
                  onDelete={clearFilters}
                />
              )}
            </Stack>

            <Box sx={{ flex: 1, minHeight: 0 }}>
              <Box className="ag-theme-quartz" sx={gridSx}>
                <AgGridReact
                  ref={gridRef}
                  rowData={osData}
                  columnDefs={columnDefs}
                  defaultColDef={defaultColDef}
                  rowHeight={tableRowHeight}
                  headerHeight={40}
                  animateRows={false}
                  suppressCellFocus
                  loading={loading}
                  getRowId={(params: any) =>
                    params.data.id || params.data.vrp_id
                  }
                  containerStyle={{
                    height: "100%",
                    width: "100%",
                    backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                  }}
                />
              </Box>
            </Box>

            {/* Pagination */}
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
                  bgcolor: isDarkMode ? "#1e293b" : "white",
                  flexShrink: 0,
                  minHeight: { xs: 44, sm: 52 },
                  borderRadius: "0 0 12px 12px",
                }}
              >
                <Stack
                  direction="row"
                  spacing={{ xs: 0.5, sm: 1.5 }}
                  alignItems="center"
                >
                  <Typography
                    sx={{ fontSize: "0.78rem", color: "text.secondary" }}
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
                    sx={{ height: 30, fontSize: "0.78rem", minWidth: 65 }}
                  >
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                    <MenuItem value={500}>500</MenuItem>
                    <MenuItem value={1000}>1000</MenuItem>
                  </Select>
                </Stack>
                <Typography
                  sx={{ fontSize: "0.78rem", color: "text.secondary" }}
                >
                  {totalRows > 0
                    ? `${(page - 1) * limit + 1} – ${Math.min(page * limit, totalRows)} of ${totalRows}`
                    : "0 results"}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <IconButton
                    aria-label="Action"
                    size="small"
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                  >
                    <FirstPage fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Action"
                    size="small"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <KeyboardArrowLeft fontSize="small" />
                  </IconButton>
                  {!isMobile && (
                    <Pagination
                      page={page}
                      count={Math.ceil(totalRows / limit) || 1}
                      size="small"
                      onChange={(_, v) => setPage(v)}
                      siblingCount={1}
                      boundaryCount={1}
                      sx={{
                        "& .MuiPaginationItem-root": {
                          color: isDarkMode ? "#94a3b8" : "inherit",
                          minWidth: 28,
                          height: 28,
                        },
                        "& .Mui-selected": {
                          bgcolor: isDarkMode
                            ? "rgba(59, 130, 246, 0.3) !important"
                            : "rgba(25, 118, 210, 0.12) !important",
                        },
                      }}
                    />
                  )}
                  {isMobile && (
                    <Typography sx={{ fontSize: "0.78rem", px: 1 }}>
                      {page} / {Math.ceil(totalRows / limit) || 1}
                    </Typography>
                  )}
                  <IconButton
                    aria-label="Action"
                    size="small"
                    disabled={page >= Math.ceil(totalRows / limit)}
                    onClick={() => setPage(page + 1)}
                  >
                    <KeyboardArrowRight fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Action"
                    size="small"
                    disabled={page >= Math.ceil(totalRows / limit)}
                    onClick={() => setPage(Math.ceil(totalRows / limit))}
                  >
                    <LastPage fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            </Fade>
          </Box>
        )}

        {/* ===== TAB: NL MASTER DATA ===== */}
        {currentTabCode === "master_data" && (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              p: { xs: 1, sm: 1.5 },
              bgcolor: isDarkMode ? "#0f172a" : "#f5f7fa",
            }}
          >
            {/* Toolbar */}
            <Paper sx={{ p: 1.5, mb: 1, borderRadius: 2 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ sm: "center" }}
              >
                {/* Lot Type Switcher */}
                <Stack
                  direction="row"
                  spacing={0}
                  sx={{
                    border: "2px solid",
                    borderColor: mdLotType === "RVP" ? "#7c3aed" : "#d97706",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <Button
                    size="small"
                    onClick={() => {
                      setMdLotType("RVP");
                      setMdPage(1);
                    }}
                    sx={{
                      px: 2,
                      py: 0.5,
                      borderRadius: 0,
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      textTransform: "none",
                      bgcolor: mdLotType === "RVP" ? "#7c3aed" : "transparent",
                      color:
                        mdLotType === "RVP"
                          ? "#fff"
                          : isDarkMode
                            ? "#c4b5fd"
                            : "#7c3aed",
                      "&:hover": {
                        bgcolor:
                          mdLotType === "RVP"
                            ? "#6d28d9"
                            : "rgba(124,58,237,0.1)",
                      },
                    }}
                  >
                    RVP
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setMdLotType("RA");
                      setMdPage(1);
                    }}
                    sx={{
                      px: 2,
                      py: 0.5,
                      borderRadius: 0,
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      textTransform: "none",
                      bgcolor: mdLotType === "RA" ? "#d97706" : "transparent",
                      color:
                        mdLotType === "RA"
                          ? "#fff"
                          : isDarkMode
                            ? "#fbbf24"
                            : "#d97706",
                      "&:hover": {
                        bgcolor:
                          mdLotType === "RA"
                            ? "#b45309"
                            : "rgba(217,119,6,0.1)",
                      },
                    }}
                  >
                    RA
                  </Button>
                </Stack>
                <TextField
                  placeholder={
                    mdLotType === "RVP"
                      ? "Search WSN, product, brand..."
                      : "Search WID, product, brand..."
                  }
                  value={mdSearch}
                  onChange={(e) => setMdSearch(e.target.value)}
                  size="small"
                  sx={{ minWidth: 220, flex: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="primary" />
                      </InputAdornment>
                    ),
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadMasterData();
                  }}
                />
                <TextField
                  label="Category"
                  value={mdFilterCategory}
                  onChange={(e) => setMdFilterCategory(e.target.value)}
                  size="small"
                  select
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="">All</MenuItem>
                  {uniqueMdCategories.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Brand"
                  value={mdFilterBrand}
                  onChange={(e) => setMdFilterBrand(e.target.value)}
                  size="small"
                  select
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="">All</MenuItem>
                  {uniqueMdBrands.map((b) => (
                    <MenuItem key={b} value={b}>
                      {b}
                    </MenuItem>
                  ))}
                </TextField>
                {canSeeButton("master_upload") && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={
                      mdUploading ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <UploadIcon />
                      )
                    }
                    onClick={() => setMdUploadDialogOpen(true)}
                    disabled={mdUploading}
                    sx={{
                      height: 38,
                      background:
                        mdLotType === "RVP"
                          ? "linear-gradient(135deg, #7c3aed, #a855f7)"
                          : "linear-gradient(135deg, #d97706, #f59e0b)",
                      textTransform: "none",
                      fontWeight: 600,
                    }}
                  >
                    Upload {mdLotType}
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={() => loadMasterData()}
                  disabled={mdLoading}
                >
                  Refresh
                </Button>
                {canSeeButton("master_export") && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ExportIcon />}
                    onClick={exportMdToExcel}
                    disabled={mdData.length === 0}
                  >
                    Export
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setMdShowBatches(!mdShowBatches)}
                  sx={{ color: mdShowBatches ? "#ef4444" : undefined }}
                >
                  {mdShowBatches ? "Hide Batches" : "Batches"}
                </Button>
              </Stack>
            </Paper>

            <Stack
              direction="row"
              spacing={1}
              sx={{ mb: 1 }}
              alignItems="center"
            >
              <Chip
                label={`${mdTotal} ${mdLotType} records`}
                size="small"
                color={mdLotType === "RVP" ? "secondary" : "warning"}
                variant="outlined"
              />
              {(mdSearch || mdFilterCategory || mdFilterBrand) && (
                <Chip
                  label="Filters active"
                  size="small"
                  color="warning"
                  variant="outlined"
                  onDelete={() => {
                    setMdSearch("");
                    setMdFilterCategory("");
                    setMdFilterBrand("");
                    setMdPage(1);
                  }}
                />
              )}
            </Stack>

            {/* Batches panel (inline toggle) */}
            {mdShowBatches && (
              <Box sx={{ mb: 1.5, maxHeight: 300, overflow: "auto" }}>
                <BatchManagementTab
                  batches={mdBatches}
                  loading={mdBatchLoading}
                  onRefresh={loadMdBatches}
                  onDelete={handleMdDeleteBatch}
                  canDelete={true}
                  title={`${mdLotType} Master Data Batches`}
                  emptyMessage="No batches found"
                  emptySubMessage={`Upload ${mdLotType} data to create batches`}
                />
              </Box>
            )}

            {/* Grid */}
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <Box className="ag-theme-quartz" sx={gridSx}>
                <AgGridReact
                  ref={mdGridRef}
                  rowData={mdData}
                  columnDefs={mdColumnDefs}
                  defaultColDef={defaultColDef}
                  rowHeight={tableRowHeight}
                  headerHeight={40}
                  animateRows={false}
                  suppressCellFocus
                  loading={mdLoading}
                  getRowId={(params: any) => String(params.data.id)}
                  containerStyle={{
                    height: "100%",
                    width: "100%",
                    backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                  }}
                />
              </Box>
            </Box>

            {/* Pagination */}
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
                  bgcolor: isDarkMode ? "#1e293b" : "white",
                  flexShrink: 0,
                  minHeight: { xs: 44, sm: 52 },
                  borderRadius: "0 0 12px 12px",
                }}
              >
                <Stack
                  direction="row"
                  spacing={{ xs: 0.5, sm: 1.5 }}
                  alignItems="center"
                >
                  <Typography
                    sx={{ fontSize: "0.78rem", color: "text.secondary" }}
                  >
                    Per page:
                  </Typography>
                  <Select
                    size="small"
                    value={mdLimit}
                    onChange={(e) => {
                      setMdLimit(Number(e.target.value));
                      setMdPage(1);
                    }}
                    sx={{ height: 30, fontSize: "0.78rem", minWidth: 65 }}
                  >
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                    <MenuItem value={500}>500</MenuItem>
                    <MenuItem value={1000}>1000</MenuItem>
                  </Select>
                </Stack>
                <Typography
                  sx={{ fontSize: "0.78rem", color: "text.secondary" }}
                >
                  {mdTotal > 0
                    ? `${(mdPage - 1) * mdLimit + 1} – ${Math.min(mdPage * mdLimit, mdTotal)} of ${mdTotal}`
                    : "0 results"}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <IconButton
                    aria-label="Action"
                    size="small"
                    disabled={mdPage === 1}
                    onClick={() => setMdPage(1)}
                  >
                    <FirstPage fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Action"
                    size="small"
                    disabled={mdPage === 1}
                    onClick={() => setMdPage(mdPage - 1)}
                  >
                    <KeyboardArrowLeft fontSize="small" />
                  </IconButton>
                  {!isMobile && (
                    <Pagination
                      page={mdPage}
                      count={Math.ceil(mdTotal / mdLimit) || 1}
                      size="small"
                      onChange={(_, v) => setMdPage(v)}
                      siblingCount={1}
                      boundaryCount={1}
                      sx={{
                        "& .MuiPaginationItem-root": {
                          color: isDarkMode ? "#94a3b8" : "inherit",
                          minWidth: 28,
                          height: 28,
                        },
                        "& .Mui-selected": {
                          bgcolor: isDarkMode
                            ? "rgba(59, 130, 246, 0.3) !important"
                            : "rgba(25, 118, 210, 0.12) !important",
                        },
                      }}
                    />
                  )}
                  {isMobile && (
                    <Typography sx={{ fontSize: "0.78rem", px: 1 }}>
                      {mdPage} / {Math.ceil(mdTotal / mdLimit) || 1}
                    </Typography>
                  )}
                  <IconButton
                    aria-label="Action"
                    size="small"
                    disabled={mdPage >= Math.ceil(mdTotal / mdLimit)}
                    onClick={() => setMdPage(mdPage + 1)}
                  >
                    <KeyboardArrowRight fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Action"
                    size="small"
                    disabled={mdPage >= Math.ceil(mdTotal / mdLimit)}
                    onClick={() => setMdPage(Math.ceil(mdTotal / mdLimit))}
                  >
                    <LastPage fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            </Fade>
          </Box>
        )}

        {/* ===== TAB: BATCHES ===== */}
        {currentTabCode === "batches" && (
          <Box
            sx={{
              flex: 1,
              overflow: "auto",
              bgcolor: isDarkMode ? "#0f172a" : "#f5f7fa",
            }}
          >
            <BatchManagementTab
              batches={batches}
              loading={batchLoading}
              onRefresh={loadBatches}
              onDelete={handleDeleteBatch}
              canDelete={true}
              title="OS Batch Management"
              emptyMessage="No batches found"
              emptySubMessage="Batches will appear here after OS data uploads"
            />
          </Box>
        )}
      </Box>

      {/* ===== UPLOAD DIALOG ===== */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => !uploading && setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          Upload FKT OS Excel
          <IconButton
            aria-label="Action"
            onClick={() => !uploading && setUploadDialogOpen(false)}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Upload the supplier order sheet Excel file. This pre-loads VRP order
            data (Category, Lot Type, Region, Declared Boxes, Qty) that
            auto-populates during inbound scanning.
          </Typography>

          <Divider sx={{ mb: 2 }} />

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Expected Columns
          </Typography>
          <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {[
              "VRP ID *",
              "Inbound Date",
              "Region",
              "Category",
              "Lot Type",
              "Declared Boxes",
              "Declared Qty",
              "Remarks",
            ].map((col) => (
              <Chip
                key={col}
                label={col}
                size="small"
                variant="outlined"
                color={col.includes("*") ? "primary" : "default"}
              />
            ))}
          </Box>

          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>Note:</strong> VRP ID is required. Duplicate VRP IDs will be
            updated (not duplicated). A batch ID will be auto-generated for
            tracking.
          </Alert>

          {uploading && <LinearProgress sx={{ mb: 2 }} />}

          <input
            type="file"
            accept=".xlsx,.xls"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleUpload}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={downloadTemplate}
          >
            Download Template
          </Button>
          <Button
            variant="contained"
            startIcon={
              uploading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <UploadIcon />
              )
            }
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            sx={{
              background: "linear-gradient(135deg, #1e40af, #3b82f6)",
              "&:hover": {
                background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
              },
            }}
          >
            {uploading ? "Uploading..." : "Upload Excel File"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== NL MASTER DATA UPLOAD DIALOG ===== */}
      <Dialog
        open={mdUploadDialogOpen}
        onClose={() => !mdUploading && setMdUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background:
              mdLotType === "RVP"
                ? "linear-gradient(135deg, #7c3aed, #a855f7)"
                : "linear-gradient(135deg, #d97706, #f59e0b)",
            color: "white",
          }}
        >
          Upload {mdLotType} Master Data
          <IconButton
            aria-label="Action"
            onClick={() => !mdUploading && setMdUploadDialogOpen(false)}
            size="small"
            sx={{ color: "white" }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: "16px !important" }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>{mdLotType === "RVP" ? "RVP" : "RA"} Mode:</strong>{" "}
            {mdLotType === "RVP"
              ? "Each row = one unique item with WSN serial number. WSN column is required."
              : "Each row = one product type identified by WID. WID column is required."}
            <br />
            This data is shared across all warehouses — no warehouse filter.
            <br />
            Duplicates will be updated (not duplicated).
          </Alert>

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            {mdLotType === "RVP" ? "Required: WSN" : "Required: WID"} — Optional
            columns shown below
          </Typography>
          <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {(mdLotType === "RVP"
              ? [
                  "WSN *",
                  "WID",
                  "Product Title",
                  "Brand",
                  "Category",
                  "FSN",
                  "MRP",
                  "FSP",
                  "HSN/SAC",
                  "IGST Rate",
                  "VRP ID",
                  "Remarks",
                ]
              : [
                  "WID *",
                  "Product Title",
                  "Brand",
                  "Category",
                  "FSN",
                  "MRP",
                  "FSP",
                  "HSN/SAC",
                  "IGST Rate",
                  "VRP ID",
                  "Qty",
                  "Remarks",
                ]
            ).map((col) => (
              <Chip
                key={col}
                label={col}
                size="small"
                variant="outlined"
                color={
                  col.includes("*")
                    ? mdLotType === "RVP"
                      ? "secondary"
                      : "warning"
                    : "default"
                }
              />
            ))}
          </Box>

          {mdUploading && (
            <LinearProgress
              sx={{ mb: 2 }}
              color={mdLotType === "RVP" ? "secondary" : "warning"}
            />
          )}
          <input
            type="file"
            accept=".xlsx,.xls"
            ref={mdFileRef}
            style={{ display: "none" }}
            onChange={handleMdUpload}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={downloadMdTemplate}
          >
            Download Template
          </Button>
          <Button
            variant="contained"
            startIcon={
              mdUploading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <UploadIcon />
              )
            }
            onClick={() => mdFileRef.current?.click()}
            disabled={mdUploading}
            sx={{
              background:
                mdLotType === "RVP"
                  ? "linear-gradient(135deg, #7c3aed, #a855f7)"
                  : "linear-gradient(135deg, #d97706, #f59e0b)",
            }}
          >
            {mdUploading ? "Uploading..." : `Upload ${mdLotType} Excel`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== OPTIONS PANEL ===== */}
      <Drawer
        anchor="right"
        open={optionsPanelOpen}
        onClose={() => setOptionsPanelOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 380 },
            background: isDarkMode
              ? "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)"
              : "#fff",
          },
        }}
      >
        <Box
          sx={{
            background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
            color: "white",
            px: 2.5,
            py: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Options
          </Typography>
          <IconButton
            aria-label="Action"
            onClick={() => setOptionsPanelOpen(false)}
            sx={{ color: "white" }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ p: 2, overflowY: "auto", flex: 1 }}>
          {/* Filters */}
          <Accordion
            expanded={optionsExpanded === "filters"}
            onChange={(_, exp) => setOptionsExpanded(exp ? "filters" : false)}
            disableGutters
            sx={{
              bgcolor: "transparent",
              boxShadow: "none",
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} alignItems="center">
                <FilterListIcon fontSize="small" color="primary" />
                <Typography fontWeight={600}>Filters</Typography>
                {hasActiveFilters && (
                  <Chip
                    label="Active"
                    size="small"
                    color="warning"
                    sx={{ height: 20, fontSize: 11 }}
                  />
                )}
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1.5}>
                <TextField
                  label="Category"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  size="small"
                  select
                  fullWidth
                >
                  <MenuItem value="">All</MenuItem>
                  {uniqueCategories.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Lot Type"
                  value={filterLotType}
                  onChange={(e) => setFilterLotType(e.target.value)}
                  size="small"
                  select
                  fullWidth
                >
                  <MenuItem value="">All</MenuItem>
                  {uniqueLotTypes.map((l) => (
                    <MenuItem key={l} value={l}>
                      {l}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Region"
                  value={filterRegion}
                  onChange={(e) => setFilterRegion(e.target.value)}
                  size="small"
                  select
                  fullWidth
                >
                  <MenuItem value="">All</MenuItem>
                  {uniqueRegions.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </TextField>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Date From"
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="Date To"
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Stack>
                {hasActiveFilters && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={clearFilters}
                  >
                    Clear All Filters
                  </Button>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 1 }} />

          {/* Columns */}
          <Accordion
            expanded={optionsExpanded === "columns"}
            onChange={(_, exp) => setOptionsExpanded(exp ? "columns" : false)}
            disableGutters
            sx={{
              bgcolor: "transparent",
              boxShadow: "none",
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ViewColumnIcon fontSize="small" color="primary" />
                <Typography fontWeight={600}>Columns</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={0}>
                {ALL_COLUMNS.map((col) => (
                  <FormControlLabel
                    key={col.field}
                    control={
                      <Checkbox
                        checked={visibleColumns.includes(col.field)}
                        onChange={() => toggleColumn(col.field)}
                        size="small"
                      />
                    }
                    label={<Typography variant="body2">{col.label}</Typography>}
                  />
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 1 }} />

          {/* Grid Settings */}
          <Accordion
            expanded={optionsExpanded === "grid"}
            onChange={(_, exp) => setOptionsExpanded(exp ? "grid" : false)}
            disableGutters
            sx={{
              bgcolor: "transparent",
              boxShadow: "none",
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ViewColumnIcon fontSize="small" color="primary" />
                <Typography fontWeight={600}>Grid Settings</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={0}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={gridSortable}
                      onChange={(e) => setGridSortable(e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">Sortable</Typography>}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={gridFilterable}
                      onChange={(e) => setGridFilterable(e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">Filterable</Typography>}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={gridResizable}
                      onChange={(e) => setGridResizable(e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">Resizable</Typography>}
                />
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 1.5 }} />

          {/* Actions */}
          <Stack spacing={1.5}>
            {canSeeButton("export") && (
              <Button
                variant="outlined"
                fullWidth
                startIcon={<ExportIcon />}
                onClick={exportToExcel}
                disabled={osData.length === 0}
              >
                Export to Excel
              </Button>
            )}
            <Button
              variant="outlined"
              fullWidth
              startIcon={<DownloadIcon />}
              onClick={downloadTemplate}
            >
              Download Template
            </Button>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<RefreshIcon />}
              onClick={loadOsData}
              disabled={loading}
            >
              Refresh Data
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </AppLayout>
  );
}
