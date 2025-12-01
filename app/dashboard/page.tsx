"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

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
      loadMetrics();

      const interval = setInterval(() => {
        loadMetrics();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [activeWarehouse, page, limit]);

  useEffect(() => {
    applyFilters();
  }, [
    inventoryData,
    searchWSN,
    stageFilter,
    brandFilter,
    categoryFilter,
    dateFrom,
    dateTo,
  ]);

  const loadInventoryData = async () => {
    setLoading(true);
    try {
      const response = await dashboardAPI.getInventoryPipeline({
        warehouseId: activeWarehouse?.id,
        page,
        limit,
      });
      setInventoryData((response.data?.data || []) as InventoryItem[]);
      setTotal(response.data?.pagination?.total || 0);

      const uniqueBrands = Array.from(
        new Set(
          (response.data?.data || [])
            .map((item: any) => item.brand)
            .filter(Boolean)
        )
      ) as string[];

      const uniqueCategories = Array.from(
        new Set(
          (response.data?.data || [])
            .map((item: any) => item.cms_vertical)
            .filter(Boolean)
        )
      ) as string[];

      setBrands(uniqueBrands);
      setCategories(uniqueCategories);
    } catch (error: any) {
      console.error("Load inventory error:", error);
      toast.error("Failed to load inventory data");
    } finally {
      setLoading(false);
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
    let filtered = [...inventoryData];

    if (searchWSN) {
      filtered = filtered.filter(
        (item) =>
          item.wsn?.toLowerCase().includes(searchWSN.toLowerCase()) ||
          item.product_title?.toLowerCase().includes(searchWSN.toLowerCase())
      );
    }

    if (stageFilter !== "all") {
      filtered = filtered.filter((item) => item.current_stage === stageFilter);
    }

    if (brandFilter) {
      filtered = filtered.filter(
        (item) => item.brand?.toLowerCase() === brandFilter.toLowerCase()
      );
    }

    if (categoryFilter) {
      filtered = filtered.filter(
        (item) =>
          item.cms_vertical?.toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    if (dateFrom) {
      filtered = filtered.filter((item) => {
        if (!item.inbound_date) return false;
        try {
          return (
            new Date(item.inbound_date).toDateString() >=
            new Date(dateFrom).toDateString()
          );
        } catch {
          return false;
        }
      });
    }

    if (dateTo) {
      filtered = filtered.filter((item) => {
        if (!item.inbound_date) return false;
        try {
          return (
            new Date(item.inbound_date).toDateString() <=
            new Date(dateTo).toDateString()
          );
        } catch {
          return false;
        }
      });
    }

    setFilteredData(filtered);
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

  const handleExportWithFilters = async () => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("warehouseId", activeWarehouse?.id);
      if (exportFilters.dateFrom)
        params.append("dateFrom", exportFilters.dateFrom);
      if (exportFilters.dateTo) params.append("dateTo", exportFilters.dateTo);
      if (exportFilters.stage && exportFilters.stage !== "all")
        params.append("stage", exportFilters.stage);
      if (exportFilters.brand) params.append("brand", exportFilters.brand);
      if (exportFilters.category)
        params.append("category", exportFilters.category);
      if (exportFilters.searchText)
        params.append("searchText", exportFilters.searchText);

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
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: 4,
              color: "white",
              boxShadow: "0 20px 60px rgba(102, 126, 234, 0.4)",
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
            bgcolor: "white",
            borderBottom: "1px solid #e5e7eb",
            px: 2,
            py: 1,
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
          <Typography sx={{ fontWeight: 600 }}>
            👋 Welcome back, {user?.fullName} ({user?.role})
          </Typography>
        </Box>

        {/* ================= METRICS GRID ================= */}
        <Box
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
            {
              label: "Picking",
              value: metrics.pickingCompleted,
              color: "#f59e0b",
            },
            {
              label: "Dispatch",
              value: metrics.outboundDispatched,
              color: "#ef4444",
            },
          ].map((m, index) => (
            <Card
              key={index}
              sx={{
                p: { xs: 0.5, md: 1.5 }, // mobile: small padding
                textAlign: "center",
                border: `2px solid ${m.color}`,
                borderRadius: 1.5,
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
        </Box>

        {/* ================= FILTER BAR ================= */}
        <Box
          sx={{
            background: "white",
            whiteSpace: "nowrap",
            overflowX: "auto",
            px: { xs: 0.5, md: 1 },
            py: { xs: 1, md: 1.5 },
            display: "flex",
            gap: { xs: 0.7, md: 1.2 },
            flexShrink: 0,
            alignItems: "center",
          }}
        >
          {/* Search */}
          <TextField
            size="small"
            placeholder="Search"
            value={searchWSN}
            onChange={(e) => setSearchWSN(e.target.value)}
            sx={{ minWidth: { xs: 90, sm: 120, md: 140 } }}
          />

          {/* Stage */}
          <FormControl
            size="small"
            sx={{ minWidth: { xs: 80, sm: 110, md: 120 } }}
          >
            <InputLabel>Stage</InputLabel>
            <Select
              label="Stage"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              {PIPELINE_STAGES.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Brand */}
          <FormControl
            size="small"
            sx={{ minWidth: { xs: 80, sm: 110, md: 120 } }}
          >
            <InputLabel>Brand</InputLabel>
            <Select
              label="Brand"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {brands.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Category */}
          <FormControl
            size="small"
            sx={{ minWidth: { xs: 80, sm: 110, md: 120 } }}
          >
            <InputLabel>Category</InputLabel>
            <Select
              label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Reset button */}
          <Button
            variant="outlined"
            size="small"
            onClick={resetFilters}
            sx={{
              fontSize: { xs: "0.65rem", md: "0.75rem" },
              px: { xs: 1, md: 2 },
              whiteSpace: "nowrap",
            }}
          >
            Reset
          </Button>

          {/* Columns */}
          <Button
            size="small"
            startIcon={<SettingsIcon sx={{ fontSize: 12 }} />}
            variant="outlined"
            onClick={() => setColumnDialogOpen(true)}
            sx={{
              fontSize: { xs: "0.65rem", md: "0.75rem" },
              px: { xs: 1, md: 2 },
              fontWeight: 700,
              borderRadius: 1,
              whiteSpace: "nowrap",
            }}
          >
            Columns
          </Button>

          {/* Export */}
          <Button
            variant="contained"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => setExportDialogOpen(true)}
            sx={{
              fontSize: { xs: "0.65rem", md: "0.75rem" },
              px: { xs: 1, md: 2 },
              whiteSpace: "nowrap",
            }}
          >
            Export
          </Button>

          {/* Refresh */}
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => {
              loadInventoryData();
              loadMetrics();
            }}
            sx={{
              fontSize: { xs: "0.65rem", md: "0.75rem" },
              px: { xs: 1, md: 2 },
              whiteSpace: "nowrap",
            }}
          >
            Refresh
          </Button>
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

            {/* ================= PAGINATION (FIXED AT BOTTOM) ================= */}
            <Box
              sx={{
                px: 2,
                py: 1,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid #ddd",
                bgcolor: "white",
                flexShrink: 0,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography>Per page:</Typography>
                <Select
                  size="small"
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </Select>
              </Stack>

              <Typography>
                {(page - 1) * limit + 1} – {Math.min(page * limit, total)} of{" "}
                {total}
              </Typography>

              <Pagination
                page={page}
                count={Math.ceil(total / limit)}
                size="small"
                onChange={(_, v) => setPage(v)}
              />
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
