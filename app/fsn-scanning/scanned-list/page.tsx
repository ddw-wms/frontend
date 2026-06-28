"use client";
// File Path = wms_frontend/app/fsn-scanning/scanned-list/page.tsx
// FSN Level Scanning — Scanned List + Sessions page
// Tab 1: Flat filterable list of all scanned rows across sessions
// Tab 2: Sessions / Batches management

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Chip,
  Stack,
  IconButton,
  InputAdornment,
  Select,
  MenuItem,
  Pagination,
  Fade,
  Drawer,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterListIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  FileDownload as ExportIcon,
  Delete as DeleteIcon,
  FirstPage,
  LastPage,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from "@mui/icons-material";
import { fsnScanningAPI } from "@/lib/fsn-api";
import { useNlGridSx, nlFormatDate } from "@/lib/nl-utils";
import { useWarehouse } from "@/app/context/WarehouseContext";
import AppLayout from "@/components/AppLayout";
import { StandardPageHeader } from "@/components";
import { useTableRowHeight } from "@/app/context/AppearanceContext";
import toast, { Toaster } from "react-hot-toast";
import { AgGridReact } from "@/components/AGGridScrollWrapper";
import {
  ModuleRegistry,
  AllCommunityModule,
  ClientSideRowModelModule,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

const INVENTORY_TYPES = [
  "Good",
  "Damaged",
  "Expired",
  "Return",
  "Liquidation",
  "Other",
];

export default function FSNScannedListPage() {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const tableRowHeight = useTableRowHeight();
  const { activeWarehouse } = useWarehouse();

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<0 | 1>(0); // 0 = Rows, 1 = Sessions

  // ── Filters (applied only on explicit search/Apply) ────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customer, setCustomer] = useState("");
  const [customerInput, setCustomerInput] = useState("");
  const [widFilter, setWidFilter] = useState("");
  const [fsnFilter, setFsnFilter] = useState("");
  const [eanFilter, setEanFilter] = useState("");
  const [sapFilter, setSapFilter] = useState("");
  const [invTypeFilter, setInvTypeFilter] = useState("");

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [total, setTotal] = useState(0);

  // ── Scanned rows data ──────────────────────────────────────────────────────
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Sessions / Batches data ────────────────────────────────────────────────
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionPage, setSessionPage] = useState(1);

  // ── Options panel ──────────────────────────────────────────────────────────
  const [optionsPanelOpen, setOptionsPanelOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState<string | false>(
    "filters",
  );

  const hasFilters = !!(
    search ||
    dateFrom ||
    dateTo ||
    customer ||
    widFilter ||
    fsnFilter ||
    eanFilter ||
    sapFilter ||
    invTypeFilter
  );

  const gridSx = useNlGridSx(isDarkMode, {
    headerBg: "#1e1b4b",
    headerBorder: "#818cf8",
    headerBorderLight: "#6366f1",
    headerCellBorder: "#374151",
    hoverBg: "rgba(129, 140, 248, 0.12)",
    hoverBgLight: "#eef2ff",
    focusBorder: "#818cf8",
    focusBorderLight: "#6366f1",
    rangeBg: "rgba(129, 140, 248, 0.2)",
    rangeBgLight: "#e0e7ff",
  });

  // ── Load scanned rows ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fsnScanningAPI.listRows({
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        customer: customer || undefined,
        warehouseId: activeWarehouse?.id,
        wid: widFilter || undefined,
        fsn: fsnFilter || undefined,
        ean: eanFilter || undefined,
        sap_sku: sapFilter || undefined,
        inventory_type: invTypeFilter || undefined,
        page,
        limit,
      });
      setData(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error("Failed to load scanned list");
    } finally {
      setLoading(false);
    }
  }, [
    search,
    dateFrom,
    dateTo,
    customer,
    activeWarehouse?.id,
    widFilter,
    fsnFilter,
    eanFilter,
    sapFilter,
    invTypeFilter,
    page,
    limit,
  ]);

  useEffect(() => {
    if (activeTab === 0) loadData();
  }, [loadData, activeTab]);

  // Apply filter helper — commits input state to filter state and resets page
  const applyFilters = () => {
    setSearch(searchInput);
    setCustomer(customerInput);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setCustomerInput("");
    setCustomer("");
    setDateFrom("");
    setDateTo("");
    setWidFilter("");
    setFsnFilter("");
    setEanFilter("");
    setSapFilter("");
    setInvTypeFilter("");
    setPage(1);
  };

  // ── Load sessions ──────────────────────────────────────────────────────────
  const loadSessions = useCallback(
    async (pg = 1) => {
      try {
        setSessionsLoading(true);
        const res = await fsnScanningAPI.listSessions({
          page: pg,
          limit: 50,
          warehouseId: activeWarehouse?.id,
        });
        setSessions(res.data.data || []);
        setSessionsTotal(res.data.total || 0);
        setSessionPage(pg);
      } catch {
        toast.error("Failed to load sessions");
      } finally {
        setSessionsLoading(false);
      }
    },
    [activeWarehouse?.id],
  );

  useEffect(() => {
    if (activeTab === 1) loadSessions(1);
  }, [activeTab, loadSessions]);

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm(`Delete session "${sessionId}" and all its rows?`)) return;
    try {
      await fsnScanningAPI.deleteSession(sessionId);
      toast.success("Session deleted");
      loadSessions(sessionPage);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Delete failed");
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportToExcel = async () => {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }
    const XLSX = await import("xlsx");
    const rows = data.map((r) => ({
      "Session ID": r.session_id || "",
      Date: nlFormatDate(r.session_date),
      Customer: r.customer_name || "",
      Warehouse: r.warehouse_name || "",
      "Lookup Value": r.lookup_value || "",
      "Lookup Type": r.lookup_type || "",
      WID: r.wid || "",
      FSN: r.fsn || "",
      "Product Title": r.product_title || "",
      Brand: r.brand || "",
      "CMS Vertical": r.cms_vertical || "",
      "Mega Category": r.mega_category || "",
      "EAN/ENA": r.ean || "",
      "SAP/SKU": r.sap_sku || "",
      MRP: r.mrp || "",
      FSP: r.fsp || "",
      Qty: r.quantity || 1,
      "Inventory Type": r.inventory_type || "",
      Remarks: r.remarks || "",
      "Scanned By": r.scanned_by_name || "",
      "Scanned At": nlFormatDate(r.scanned_at),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FSN Scanned List");
    XLSX.writeFile(
      wb,
      `FSN_Scanned_List_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("Exported");
  };

  // ── Column defs ────────────────────────────────────────────────────────────
  const columnDefs = useMemo(
    () => [
      {
        field: "session_id",
        headerName: "Session ID",
        flex: 1.5,
        minWidth: 220,
        pinned: "left" as const,
      },
      {
        field: "session_date",
        headerName: "Date",
        width: 110,
        valueFormatter: (p: any) => nlFormatDate(p.value),
      },
      { field: "customer_name", headerName: "Customer", width: 160 },
      { field: "warehouse_name", headerName: "Warehouse", width: 140 },
      { field: "lookup_value", headerName: "Lookup Value", width: 160 },
      {
        field: "lookup_type",
        headerName: "Matched By",
        width: 110,
        cellStyle: { color: "#818cf8", fontWeight: 600 },
      },
      { field: "wid", headerName: "WID", width: 160 },
      { field: "fsn", headerName: "FSN", width: 170 },
      {
        field: "product_title",
        headerName: "Product Title",
        flex: 2,
        minWidth: 180,
      },
      { field: "brand", headerName: "Brand", width: 130 },
      { field: "cms_vertical", headerName: "CMS Vertical", width: 140 },
      { field: "mega_category", headerName: "Mega Category", width: 150 },
      { field: "ean", headerName: "EAN/ENA", width: 160 },
      { field: "sap_sku", headerName: "SAP/SKU", width: 140 },
      {
        field: "mrp",
        headerName: "MRP",
        width: 90,
        type: "numericColumn" as const,
      },
      {
        field: "fsp",
        headerName: "FSP",
        width: 90,
        type: "numericColumn" as const,
      },
      {
        field: "quantity",
        headerName: "Qty",
        width: 75,
        type: "numericColumn" as const,
      },
      { field: "inventory_type", headerName: "Inventory Type", width: 140 },
      { field: "remarks", headerName: "Remarks", flex: 1, minWidth: 120 },
      { field: "scanned_by_name", headerName: "Scanned By", width: 130 },
      {
        field: "scanned_at",
        headerName: "Scanned At",
        width: 150,
        valueFormatter: (p: any) => nlFormatDate(p.value),
      },
    ],
    [],
  );

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      suppressMovable: false,
      floatingFilter: false,
    }),
    [],
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
        }}
      >
        <StandardPageHeader
          title="FSN Scanned List"
          subtitle="All scanned sessions and product rows"
          icon="📋"
          warehouseName={activeWarehouse?.name}
        />

        {/* ── Tabs ── */}
        <Box
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: isDarkMode ? "#1e293b" : "#fff",
            flexShrink: 0,
          }}
        >
          <Stack direction="row" alignItems="center" px={1}>
            <Button
              onClick={() => setActiveTab(0)}
              sx={{
                borderRadius: 0,
                py: 1.2,
                px: 2.5,
                fontWeight: 600,
                fontSize: "0.85rem",
                color: activeTab === 0 ? "#818cf8" : "text.secondary",
                borderBottom:
                  activeTab === 0
                    ? "2px solid #818cf8"
                    : "2px solid transparent",
                textTransform: "none",
              }}
            >
              📊 Scanned Rows
            </Button>
            <Button
              onClick={() => setActiveTab(1)}
              sx={{
                borderRadius: 0,
                py: 1.2,
                px: 2.5,
                fontWeight: 600,
                fontSize: "0.85rem",
                color: activeTab === 1 ? "#818cf8" : "text.secondary",
                borderBottom:
                  activeTab === 1
                    ? "2px solid #818cf8"
                    : "2px solid transparent",
                textTransform: "none",
              }}
            >
              📋 Sessions / Batches
            </Button>
          </Stack>
        </Box>

        {/* ══════════ TAB 0: SCANNED ROWS ══════════ */}
        {activeTab === 0 && (
          <>
            {/* ── Toolbar ── */}
            <Paper sx={{ px: 1.5, py: 1, borderRadius: 0, flexShrink: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Search WID, FSN, EAN, SAP, product, customer…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  sx={{ flex: 1, "& .MuiOutlinedInput-root": { height: 38 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="primary" />
                      </InputAdornment>
                    ),
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters();
                  }}
                />
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SearchIcon />}
                  onClick={applyFilters}
                  sx={{ height: 38, fontWeight: 600, textTransform: "none" }}
                >
                  Search
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={loadData}
                  disabled={loading}
                  sx={{ height: 38 }}
                >
                  Refresh
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SettingsIcon />}
                  onClick={() => setOptionsPanelOpen(true)}
                  sx={{ height: 38, position: "relative" }}
                >
                  Filters
                  {hasFilters && (
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

            {/* ── AG Grid ── */}
            <Box
              sx={{ flex: 1, minHeight: 0, px: { xs: 0.5, sm: 1 }, py: 0.5 }}
            >
              <Box
                className="ag-theme-quartz"
                sx={{ ...gridSx, height: "100%", width: "100%" }}
              >
                <AgGridReact
                  rowData={data}
                  columnDefs={columnDefs}
                  defaultColDef={defaultColDef}
                  rowHeight={tableRowHeight}
                  headerHeight={40}
                  animateRows={false}
                  suppressCellFocus
                  loading={loading}
                  containerStyle={{
                    height: "100%",
                    width: "100%",
                    backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                  }}
                />
              </Box>
            </Box>

            {/* ── Pagination ── */}
            <Fade in timeout={300}>
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
                    {[50, 100, 500, 1000].map((v) => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    ))}
                  </Select>

                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mt: 0.75 }}
                    alignItems="center"
                    flexWrap="wrap"
                  >
                    <Chip
                      label={`${total} rows`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    {hasFilters && (
                      <Chip
                        label="Filters active — click to clear"
                        size="small"
                        color="warning"
                        variant="outlined"
                        onDelete={clearFilters}
                        deleteIcon={<DeleteIcon />}
                      />
                    )}
                  </Stack>
                </Stack>
                <Typography
                  sx={{ fontSize: "0.78rem", color: "text.secondary" }}
                >
                  {total > 0
                    ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`
                    : "0 results"}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <IconButton
                    aria-label="First"
                    size="small"
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                  >
                    <FirstPage fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Prev"
                    size="small"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <KeyboardArrowLeft fontSize="small" />
                  </IconButton>
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
                        minWidth: 28,
                        height: 28,
                      },
                      "& .Mui-selected": {
                        bgcolor: isDarkMode
                          ? "rgba(129,140,248,0.3) !important"
                          : "rgba(99,102,241,0.12) !important",
                      },
                    }}
                  />
                  <IconButton
                    aria-label="Next"
                    size="small"
                    disabled={page >= Math.ceil(total / limit)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <KeyboardArrowRight fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Last"
                    size="small"
                    disabled={page >= Math.ceil(total / limit)}
                    onClick={() => setPage(Math.ceil(total / limit))}
                  >
                    <LastPage fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            </Fade>
          </>
        )}

        {/* ══════════ TAB 1: SESSIONS / BATCHES ══════════ */}
        {activeTab === 1 && (
          <Box sx={{ flex: 1, overflow: "auto", p: { xs: 1, sm: 2 } }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              mb={1.5}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Submitted Sessions
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {sessionsTotal} sessions total
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => loadSessions(sessionPage)}
                disabled={sessionsLoading}
                variant="outlined"
              >
                Refresh
              </Button>
            </Stack>

            {sessionsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress />
              </Box>
            ) : sessions.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: "center", borderRadius: 2 }}>
                <Typography color="text.secondary">
                  No sessions submitted yet.
                </Typography>
              </Paper>
            ) : (
              <Stack spacing={1}>
                {sessions.map((s: any) => (
                  <Paper
                    key={s.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: `1px solid ${isDarkMode ? "#374151" : "#e2e8f0"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          fontFamily: "monospace",
                          color: "#818cf8",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.session_id}
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={2}
                        mt={0.25}
                        flexWrap="wrap"
                      >
                        <Typography variant="caption" color="text.secondary">
                          📅 {nlFormatDate(s.session_date)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          👤 {s.customer_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          📦 {s.total_rows} rows
                        </Typography>
                        {s.warehouse_name && (
                          <Typography variant="caption" color="text.secondary">
                            🏭 {s.warehouse_name}
                          </Typography>
                        )}
                        {s.created_by_name && (
                          <Typography variant="caption" color="text.secondary">
                            🙍 {s.created_by_name}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                    <Tooltip title="Delete this session and all its rows">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          handleDeleteSession(s.session_id || s.id)
                        }
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Paper>
                ))}
              </Stack>
            )}

            {sessionsTotal > 50 && (
              <Stack direction="row" justifyContent="center" spacing={1} mt={2}>
                <Button
                  size="small"
                  disabled={sessionPage === 1}
                  onClick={() => loadSessions(sessionPage - 1)}
                >
                  ← Prev
                </Button>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ alignSelf: "center" }}
                >
                  Page {sessionPage} · {sessionsTotal} total
                </Typography>
                <Button
                  size="small"
                  disabled={sessionPage * 50 >= sessionsTotal}
                  onClick={() => loadSessions(sessionPage + 1)}
                >
                  Next →
                </Button>
              </Stack>
            )}
          </Box>
        )}
      </Box>

      {/* ── Filters / Options Drawer ── */}
      <Drawer
        anchor="right"
        open={optionsPanelOpen}
        onClose={() => setOptionsPanelOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 380 } } }}
      >
        <Box
          sx={{
            p: 2,
            background: "linear-gradient(135deg, #1e1b4b, #4338ca)",
            color: "white",
            position: "sticky",
            top: 0,
            zIndex: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: "1.1rem" }}>
            Filters & Options
          </Typography>
          <IconButton
            onClick={() => setOptionsPanelOpen(false)}
            sx={{ color: "white" }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ overflow: "auto", flex: 1, p: 2 }}>
          <Accordion
            expanded={filtersExpanded === "filters"}
            onChange={(_, exp) => setFiltersExpanded(exp ? "filters" : false)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} alignItems="center">
                <FilterListIcon fontSize="small" color="primary" />
                <Typography sx={{ fontWeight: 600 }}>Filters</Typography>
                {hasFilters && (
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
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="From Date"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                    fullWidth
                  />
                  <TextField
                    label="To Date"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                    fullWidth
                  />
                </Stack>
                <TextField
                  label="Customer Name"
                  size="small"
                  value={customerInput}
                  onChange={(e) => setCustomerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters();
                  }}
                  onBlur={() => {
                    if (customerInput !== customer) applyFilters();
                  }}
                  helperText="Press Enter or click Search to apply"
                  fullWidth
                />
                <TextField
                  label="WID"
                  size="small"
                  value={widFilter}
                  onChange={(e) => {
                    setWidFilter(e.target.value);
                    setPage(1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadData();
                  }}
                  fullWidth
                />
                <TextField
                  label="FSN"
                  size="small"
                  value={fsnFilter}
                  onChange={(e) => {
                    setFsnFilter(e.target.value);
                    setPage(1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadData();
                  }}
                  fullWidth
                />
                <TextField
                  label="EAN/ENA"
                  size="small"
                  value={eanFilter}
                  onChange={(e) => {
                    setEanFilter(e.target.value);
                    setPage(1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadData();
                  }}
                  fullWidth
                />
                <TextField
                  label="SAP/SKU"
                  size="small"
                  value={sapFilter}
                  onChange={(e) => {
                    setSapFilter(e.target.value);
                    setPage(1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadData();
                  }}
                  fullWidth
                />
                <TextField
                  label="Inventory Type"
                  size="small"
                  select
                  value={invTypeFilter}
                  onChange={(e) => {
                    setInvTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  fullWidth
                >
                  <MenuItem value="">All Types</MenuItem>
                  {INVENTORY_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </TextField>

                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    applyFilters();
                    setOptionsPanelOpen(false);
                  }}
                >
                  Apply Filters
                </Button>
                {hasFilters && (
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

          <Box sx={{ mt: 2 }}>
            <Stack spacing={1.5}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<ExportIcon />}
                onClick={exportToExcel}
                disabled={data.length === 0}
              >
                Export to Excel
              </Button>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<RefreshIcon />}
                onClick={loadData}
                disabled={loading}
              >
                Refresh Data
              </Button>
            </Stack>
          </Box>
        </Box>
      </Drawer>
    </AppLayout>
  );
}
