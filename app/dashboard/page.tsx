// File Path = warehouse-frontend\app\dashboard\page.tsx
"use client";

//import { useState, useEffect } from "react";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Paper,
  Container,
  AppBar,
  Toolbar,
  Avatar,
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
  CircularProgress,
  Alert,
  IconButton,
  Card,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  Pagination,
  Autocomplete,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import {
  Logout as LogoutIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  FilterList as FilterIcon,
  Info as InfoIcon,
  Print as PrintIcon,
} from "@mui/icons-material";
import { dashboardAPI } from "@/lib/api";
import { useWarehouse } from "@/app/context/WarehouseContext";
import { getStoredUser, logout } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import { inboundAPI } from "@/lib/api";

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

const PIPELINE_STAGES = [
  { value: "all", label: "All Items" },
  { value: "INBOUND_RECEIVED", label: "Inbound Received" },
  { value: "QC_PENDING", label: "QC Pending" },
  { value: "QC_PASSED", label: "QC Passed" },
  { value: "QC_FAILED", label: "QC Failed" },
  { value: "PICKING_PENDING", label: "Picking Pending" },
  { value: "PICKING_COMPLETED", label: "Picking Completed" },
  { value: "OUTBOUND_READY", label: "Outbound Ready" },
  { value: "OUTBOUND_DISPATCHED", label: "Outbound Dispatched" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<User | null>(null);
  const [warehouseChecked, setWarehouseChecked] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [filteredData, setFilteredData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [searchWSN, setSearchWSN] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);

  const [searchDebounced, setSearchDebounced] = useState(searchWSN);
  const [filteredBrands, setFilteredBrands] = useState<string[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);

  const [loadingFilteredOptions, setLoadingFilteredOptions] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);



  const [metrics, setMetrics] = useState({
    total: 0,
    inbound: 0,
    qcPending: 0,
    qcPassed: 0,
    qcFailed: 0,
    pickingPending: 0,
    pickingCompleted: 0,
    outboundReady: 0,
    outboundDispatched: 0,
  });

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    dateFrom: "",
    dateTo: "",
    stage: "all",
    brand: "",
    category: "",
    searchText: "",
  });
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(searchWSN), 350);
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

  useEffect(() => {
    if (activeWarehouse) {
      loadInventoryData();
      loadFilterOptions();
      loadMetrics();
      const interval = setInterval(() => loadMetrics(), 5000);
      return () => clearInterval(interval);
    }
    setWarehouseChecked(true);
  }, [activeWarehouse, page, limit, searchDebounced, stageFilter, brandFilter, categoryFilter, dateFrom, dateTo]);

  useEffect(() => {
    setFilteredData(inventoryData);
  }, [inventoryData]);

  // useEffect(() => {
  //   if (categoryFilter) {
  //     getFilteredBrands().then(setFilteredBrands);
  //   } else {
  //     setFilteredBrands(brands);
  //   }
  // }, [categoryFilter, brands]);

  const memoizedFilteredBrands = useMemo(() => {
    if (!categoryFilter || inventoryData.length === 0) {
      return brands;
    }

    return Array.from(
      new Set(
        inventoryData
          .map((item: any) => item.brand)
          .filter(Boolean)
      )
    ) as string[];
  }, [categoryFilter, inventoryData, brands]);


  // useEffect(() => {
  //   if (brandFilter) {
  //     getFilteredCategories().then(setFilteredCategories);
  //   } else {
  //     setFilteredCategories(categories);
  //   }
  // }, [brandFilter, categories]);

  // ✅ NEW:
  useEffect(() => {
    if (!brandFilter) {
      setFilteredCategories(categories);
      setLoadingFilteredOptions(false);
      return;
    }

    setLoadingFilteredOptions(true);
    getFilteredCategories()
      .then(setFilteredCategories)
      .finally(() => setLoadingFilteredOptions(false));
  }, [brandFilter, categories]);



  // When category changes, update filtered brands
  useEffect(() => {
    if (categoryFilter && inventoryData.length > 0) {
      // Get unique brands from current inventory data for selected category
      const filtered = Array.from(
        new Set(
          inventoryData
            .map((item: any) => item.brand)
            .filter(Boolean)
        )
      ) as string[];
      setFilteredBrands(filtered.sort());
    } else {
      setFilteredBrands(brands);
    }
  }, [categoryFilter, inventoryData, brands]);

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



  const loadInventoryData = async () => {
    setLoading(true);
    try {
      const params: any = {
        warehouseId: activeWarehouse?.id,
        page,
        limit,
      };

      // Only include filters when present
      if (searchDebounced) params.search = searchDebounced;
      if (stageFilter && stageFilter !== "all") params.stage = stageFilter;
      if (brandFilter) params.brand = brandFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const response = await dashboardAPI.getInventoryPipeline(params);
      // backend returns paginated data + pagination meta
      const rows = (response.data?.data || []) as InventoryItem[];
      setInventoryData(rows);
      setFilteredData(rows); // server already applied filters so show directly
      setTotal(response.data?.pagination?.total || 0);

    } catch (error: any) {
      console.error("Load inventory error:", error);
      toast.error("Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  };

  const loadFilterOptions = async () => {
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
  };

  // 🔥 GET FILTERED BRANDS - only for selected category
  const getFilteredBrands = async () => {
    if (!categoryFilter) {
      // No category selected, show all brands
      return brands;
    }
    try {
      // Get inbound data filtered by selected category
      const response = await dashboardAPI.getInventoryPipeline({
        warehouseId: activeWarehouse?.id,
        category: categoryFilter,
        page: 1,
        limit: 10000, // Get all records for this category
      });

      const items = response.data?.data || [];
      const uniqueBrands = Array.from(
        new Set(items.map((item: any) => item.brand).filter(Boolean))
      ) as string[];

      return uniqueBrands;
    } catch (err) {
      console.error("Error getting filtered brands:", err);
      return brands; // Fallback to all brands
    }
  };

  // 🔥 GET FILTERED CATEGORIES - only for selected brand
  const getFilteredCategories = async () => {
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
    } catch (err) {
      console.error("Error getting filtered categories:", err);
      return categories; // Fallback to all categories
    }
  };



  const loadMetrics = async () => {
    try {
      const response = await dashboardAPI.getInventoryMetrics(
        activeWarehouse?.id
      );
      setMetrics(response.data || {});
    } catch (error) {
      console.error("Load metrics error:", error);
    }
  };

  const applyFilters = () => {
    // server already returned filtered data; just ensure filteredData mirrors inventoryData
    setFilteredData(inventoryData);
  };

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
    if (status === "PENDING") return "#ff9800";
    if (status === "Pending") return "#ff9800";
    if (status === "COMPLETED" || status === "PASSED") return "#4caf50";
    if (status === "FAILED") return "#f44336";
    if (status === "ok") return "#4caf50";
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

  // const handleExportWithFilters = async () => {
  //   setExportLoading(true);
  //   try {
  //     const params = new URLSearchParams();
  //     if (activeWarehouse?.id) params.append("warehouseId", String(activeWarehouse.id));

  //     if (exportFilters.dateFrom)
  //       params.append("dateFrom", exportFilters.dateFrom);
  //     if (exportFilters.dateTo) params.append("dateTo", exportFilters.dateTo);

  //     if (exportFilters.stage && exportFilters.stage !== "all") {
  //       const mapped = mapExportStageToBackend(exportFilters.stage);
  //       if (mapped) params.append("stage", mapped);
  //     }

  //     if (exportFilters.brand) params.append("brand", exportFilters.brand);

  //     if (exportFilters.category)
  //       params.append("category", exportFilters.category);
  //     if (exportFilters.searchText)
  //       params.append("search", exportFilters.searchText);

  //     const response = await dashboardAPI.getInventoryDataForExport(
  //       params.toString()
  //     );

  //     if (response.data?.data && response.data.data.length > 0) {


  const handleExportWithFilters = async () => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeWarehouse?.id) params.append("warehouseId", String(activeWarehouse.id));

      if (exportFilters.dateFrom)
        params.append("dateFrom", exportFilters.dateFrom);
      if (exportFilters.dateTo) params.append("dateTo", exportFilters.dateTo);

      if (exportFilters.stage && exportFilters.stage !== "all") {
        const mapped = mapExportStageToBackend(exportFilters.stage);
        if (mapped) params.append("stage", mapped);
      }

      if (exportFilters.brand) params.append("brand", exportFilters.brand);
      if (exportFilters.category)
        params.append("category", exportFilters.category);
      if (exportFilters.searchText)
        params.append("search", exportFilters.searchText);

      // 🔍 DEBUG: Log exact params being sent
      console.log("📤 Export API Params:", {
        warehouseId: activeWarehouse?.id,
        dateFrom: exportFilters.dateFrom,
        dateTo: exportFilters.dateTo,
        stage: exportFilters.stage,
        brand: exportFilters.brand,
        category: exportFilters.category,
        searchText: exportFilters.searchText,
        paramsString: params.toString(),
      });

      const response = await dashboardAPI.getInventoryDataForExport(
        params.toString()
      );

      console.log("📥 Export API Response:", response.data);

      if (response.data?.data && response.data.data.length > 0) {      ////////////////////////////

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
            ? new Date(row.inbound_date).toLocaleDateString()
            : "-",
          "Vehicle No": row.vehicle_no,
          "Rack No": row.rack_no,
          "FK WH Location": row.wh_location,
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

  const mapExportStageToBackend = (s: string) => {
    switch (s) {
      case "inbound":
        return "INBOUND_RECEIVED"; // or whatever backend expects
      case "qc":
        return "QC_PASSED"; // or "QC_PENDING" depending on desired export
      case "picking":
        return "PICKING_COMPLETED";
      case "outbound":
        return "OUTBOUND_DISPATCHED";
      default:
        return ""; // empty -> don't include
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



  //////////////////////////// UI ///////////////////////////////
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
        <Box
          sx={{
            //bgcolor: "white",
            background: "linear-gradient(90deg,#6366f1,#7c3aed)",
            //borderBottom: "1px solid #e5e7eb",
            color: "white",
            px: 2,
            py: 0.5,
            mb: -1.5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            📊 Dashboard
          </Typography>

          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
          >
            LOGOUT
          </Button>
        </Box>

        {/* ================= WELCOME BAR ================= */}
        <Box
          sx={{
            background: "linear-gradient(90deg,#6366f1,#7c3aed)",
            color: "white",
            px: 2,
            py: 1,
            flexShrink: 0,
          }}
        >
          <Typography
            component="div"
            sx={{
              fontWeight: 600,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            👋 Welcome back, {user?.fullName} ({user?.role})

            <Chip
              label={activeWarehouse?.name}
              size="small"
              sx={{
                bgcolor: "rgba(255,255,255,0.2)",
                color: "yellow",
                fontWeight: 600,
                height: "18px",
                fontSize: "0.55rem",
              }}
            />
          </Typography>
        </Box>

        {/* ================= METRICS GRID ================= */}
        {/* <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(5, 1fr)", // mobile: 5 columns
              sm: "repeat(5, 1fr)",
              md: "repeat(5, 1fr)",
            },
            gap: 1,
            p: 1,
          }}
        >
          {[
            { label: "Master Data", value: metrics.total, color: "#6366f1" },
            { label: "Inbound", value: metrics.inbound, color: "#3b82f6" },
            { label: "QC", value: metrics.qcPassed, color: "#10b981" },
            { label: "Picking", value: metrics.pickingCompleted, color: "#f59e0b", },
            { label: "Dispatch", value: metrics.outboundDispatched, color: "#ef4444", },
          ].map((m, index) => (
            <Card
              key={index}
              sx={{
                p: { xs: 0.5, md: 1.5 }, // mobile: small padding
                textAlign: "center",
                border: `3px solid ${m.color}`,
                borderRadius: 2.5,
                // backgroundColor: m.color,
                minWidth: { xs: 55, md: "auto" }, // mobile me chhota width
              }}
            >
              <Typography
                sx={{
                  fontWeight: 700,
                  color: m.color,
                  fontSize: { xs: "0.75rem", md: "1rem" }, // mobile font chhota
                }}
              >
                {m.value}
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: "0.55rem", md: "0.75rem" }, // mobile caption chhota
                }}
                variant="caption"
              >
                {m.label}
              </Typography>
            </Card>
          ))}
        </Box> */}


        {/* ================= IMPROVED 3D METRICS GRID WITH ICONS ================= */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(5, 1fr)",
              sm: "repeat(5, 1fr)",
              md: "repeat(5, 1fr)",
            },
            gap: 2,
            p: 1,
          }}
        >
          {[
            { label: "Master Data", value: metrics.total, color: "#6366f1", icon: <DashboardRounded /> },
            { label: "Inbound", value: metrics.inbound, color: "#3b82f6", icon: <LoginRounded /> },
            { label: "QC", value: metrics.qcPassed, color: "#10b981", icon: <CheckCircleRounded /> },
            { label: "Picking", value: metrics.pickingCompleted, color: "#f59e0b", icon: <LocalShippingRounded /> },
            { label: "Dispatch", value: metrics.outboundDispatched, color: "#ef4444", icon: <SendRounded /> },
          ].map((m, index) => (

            <Card
              key={index}
              sx={{
                p: { xs: 0.8, md: 1.4 },
                height: { xs: 70, md: 105 },             // perfect compact height
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                borderRadius: 3,

                background: `linear-gradient(135deg, ${m.color}33, ${m.color}AA)`,
                color: "#ffffff",

                boxShadow:
                  "0 4px 12px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.2)",

                transition: "all 0.25s ease",

                "&:hover": {
                  transform: "translateY(-3px)",
                  boxShadow:
                    "0 8px 18px rgba(0,0,0,0.25), inset 0 1px 2px rgba(255,255,255,0.25)",
                },
              }}
            >
              {/* ICON */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  mb: 0.3,
                  "& svg": {
                    fontSize: { xs: "1rem", md: "1.6rem" },
                    opacity: 0.95,
                  },
                }}
              >
                {m.icon}
              </Box>

              {/* VALUE */}
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: "1rem", md: "1.4rem" },
                  lineHeight: 1,
                }}
              >
                {m.value}
              </Typography>

              {/* LABEL */}
              <Typography
                sx={{
                  fontSize: { xs: "0.6rem", md: "0.8rem" },
                  opacity: 0.95,
                  mt: 0.2,
                  fontWeight: 500,
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
            px: 2,
            py: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 1,
            flexShrink: 0,
          }}
        >
          {/* TOP ROW: Search + Dates (desktop) + Filters toggle (mobile) */}
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "row", md: "row" },
              gap: 1,
              alignItems: "center",
            }}
          >
            {/* Search */}
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

            {/* Mobile filters toggle */}
            <Button
              variant="outlined"
              size="small"
              onClick={() => setFiltersOpen((v) => !v)}
              sx={{
                display: { xs: "inline-flex", md: "none" },
                height: 40,
                width: 120,
                fontSize: "0.60rem",
                fontWeight: 600,
                ml: 0.5,
                whiteSpace: "nowrap",
              }}
            >
              {filtersOpen ? "Hide Filters" : "Show Filters"}
            </Button>
          </Box>

          {/* BODY: collapsible on mobile, always visible on desktop */}
          <Box
            sx={{
              display: { xs: filtersOpen ? "block" : "none", md: "block" },
              mt: { xs: 1, md: 0.5 },
            }}
          >
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
              {/* LEFT: Stage / Brand / Category - tightly packed */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  gap: 1,
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
                  sx={{ "& .MuiOutlinedInput-root": { height: 40 } }}
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
                  sx={{ "& .MuiOutlinedInput-root": { height: 40 } }}
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
                  sx={{ "& .MuiOutlinedInput-root": { height: 40 } }}
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
                    xs: "repeat(2, 1fr)", // mobile: 2 columns x 2 rows
                    md: "repeat(4, auto)", // desktop: 4 buttons in a row
                  },
                  gap: 1,
                  width: { xs: "100%", md: "auto" },
                  justifyContent: { xs: "stretch", md: "flex-end" },
                  alignItems: "center",
                }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  onClick={resetFilters}
                  sx={{
                    height: 40,
                    px: 2,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    width: "100%",
                  }}
                >
                  RESET
                </Button>

                <Button
                  size="small"
                  startIcon={<SettingsIcon sx={{ fontSize: 14 }} />}
                  variant="outlined"
                  onClick={() => setColumnDialogOpen(true)}
                  sx={{
                    height: 40,
                    px: 2,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    width: "100%",
                  }}
                >
                  COLUMNS
                </Button>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
                  onClick={() => setExportDialogOpen(true)}
                  sx={{
                    height: 40,
                    px: 2,
                    fontSize: "0.75rem",
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
                    height: 40,
                    px: 2,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    width: "100%",
                  }}
                >
                  REFRESH
                </Button>
              </Box>

            </Box>
          </Box>
        </Box>


        {/* ================= TABLE AREA (SCROLLABLE) ================= */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            px: 1,
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
            {/* Table Container - ONLY THIS SCROLLS */}
            <TableContainer
              sx={{
                flex: 1,
                overflowY: "auto",
              }}
            >
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                    {visibleColumns.map((col) => (
                      <TableCell
                        key={col}
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          whiteSpace: "nowrap",
                          minWidth: 100,
                        }}
                      >
                        {col.replace(/_/g, " ").toUpperCase()}
                      </TableCell>
                    ))}
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Action
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumns.length + 1}
                        align="center"
                        sx={{ py: 4 }}
                      >
                        <CircularProgress size={30} />
                      </TableCell>
                    </TableRow>
                  ) : filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumns.length + 1}
                        align="center"
                        sx={{ py: 4 }}
                      >
                        <Typography variant="h6">📭 No items found</Typography>
                        {/* YEH NAYA PART */}
                        {!activeWarehouse && (
                          <Box
                            sx={{
                              p: 6,
                              textAlign: 'center',
                              minHeight: '40vh',
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
                                No active warehouse selected.
                              </Typography>
                              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                Please go to Settings &gt; Warehouses to set one.
                              </Typography>
                            </Box>
                          </Box>
                        )}

                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((item: InventoryItem, index: number) => (
                      <TableRow
                        key={index}
                        sx={{
                          "&:nth-of-type(even)": { bgcolor: "#f9fafb" },
                          "&:hover": { bgcolor: "#f0f0f0" },
                        }}
                      >
                        {visibleColumns.map((col) => {
                          let cellValue = item[col] || "-";

                          if (col.includes("status")) {
                            return (
                              <TableCell
                                key={col}
                                sx={{
                                  fontSize: "0.75rem",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <Chip
                                  label={cellValue}
                                  size="small"
                                  sx={{
                                    bgcolor: getStatusColor(cellValue),
                                    color: "white",
                                    fontSize: "0.7rem",
                                  }}
                                />
                              </TableCell>
                            );
                          }

                          if (col === "current_stage") {
                            return (
                              <TableCell
                                key={col}
                                sx={{
                                  fontSize: "0.75rem",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <Chip
                                  label={cellValue}
                                  color={getStageColor(cellValue) as any}
                                  size="small"
                                  variant="outlined"
                                />
                              </TableCell>
                            );
                          }

                          return (
                            <TableCell
                              key={col}
                              sx={{
                                fontSize: "0.75rem",
                                whiteSpace: "nowrap",
                                maxWidth: 200,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              <Tooltip title={String(cellValue)}>
                                <span>
                                  {String(cellValue).substring(0, 30)}
                                </span>
                              </Tooltip>
                            </TableCell>
                          );
                        })}
                        <TableCell
                          sx={{ textAlign: "center", whiteSpace: "nowrap" }}
                        >
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedItem(item);
                              setDetailsDialogOpen(true);
                            }}
                            sx={{ color: "#667eea", p: 0.5 }}
                          >
                            <FilterIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* ================= PAGINATION (ALWAYS ONE ROW + MOBILE COMPACT) ================= */}
            <Box
              sx={{
                px: 2,
                py: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: "1px solid #ddd",
                bgcolor: "white",
                flexShrink: 0,
                overflowX: "auto",
                whiteSpace: "nowrap",
                gap: 2,
              }}
            >
              {/* Per Page */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>
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
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </Select>
              </Stack>

              {/* Count */}
              <Typography
                sx={{
                  fontSize: "0.85rem",
                  whiteSpace: "nowrap",
                }}
              >
                {(page - 1) * limit + 1} – {Math.min(page * limit, total)} of{" "}
                {total}
              </Typography>

              {/* Pagination (Responsive) */}
              {typeof window !== "undefined" && window.innerWidth < 500 ? (
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
              )}
            </Box>
          </Paper>
        </Box>
      </Box>

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
                <MenuItem value="all">All Stages</MenuItem>
                <MenuItem value="inbound">Inbound Only</MenuItem>
                <MenuItem value="qc">QC Done</MenuItem>
                <MenuItem value="picking">Picked</MenuItem>
                <MenuItem value="outbound">Dispatched</MenuItem>
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
                🔍 Search (WSN or Product)
              </Typography>
              <TextField
                placeholder="Enter WSN or product name..."
                size="small"
                value={exportFilters.searchText}
                onChange={(e) =>
                  setExportFilters({
                    ...exportFilters,
                    searchText: e.target.value,
                  })
                }
                fullWidth
              />
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
    </AppLayout>
  );
}
