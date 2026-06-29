"use client";
// File Path = wms_frontend/app/fsn-scanning/master-data/page.tsx
// FSN Level Scanning — Master Data page
// Upload Excel/CSV, view list, manage batches

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
  Chip,
  Stack,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  LinearProgress,
  InputAdornment,
  Select,
  MenuItem,
  Pagination,
  Fade,
  useTheme,
} from "@mui/material";
import {
  CloudUpload as UploadIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  FileDownload as ExportIcon,
  FirstPage,
  LastPage,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from "@mui/icons-material";
import { fsnMasterAPI } from "@/lib/fsn-api";
import { useNlGridSx, nlFormatDate } from "@/lib/nl-utils";

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

const ALL_TABS = ["Master List", "Upload", "Batches"];
const TAB_CODES = ["list", "upload", "batches"];

// Expected columns for upload template
const EXPECTED_COLUMNS = [
  "WID",
  "FSN",
  "Product Title",
  "Brand",
  "CMS Vertical",
  "Mega Category",
  "EAN/ENA",
  "SAP/SKU",
  "+ any extra columns (preserved as metadata)",
];

export default function FSNMasterDataPage() {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const tableRowHeight = useTableRowHeight();
  const { filterTabs, canSeeTab, canSeeButton, isAdmin } = usePagePermissions(
    "fsn_scanning_master",
  );

  const visibleTabs = isAdmin
    ? ALL_TABS
    : filterTabs(ALL_TABS, TAB_CODES).length > 0
      ? filterTabs(ALL_TABS, TAB_CODES)
      : ALL_TABS;
  const visibleTabCodes = isAdmin
    ? TAB_CODES
    : TAB_CODES.filter((c) => canSeeTab(c)).length > 0
      ? TAB_CODES.filter((c) => canSeeTab(c))
      : TAB_CODES;
  const [tabValue, setTabValue] = useState(0);
  const currentTabCode = visibleTabCodes[tabValue] || "upload";

  // ====== UPLOAD STATE ======
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadXferPct, setUploadXferPct] = useState(0);

  // Job polling state
  const [jobResult, setJobResult] = useState<{
    status: "processing" | "done" | "failed";
    processed: number;
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
    batchId?: string;
    error?: string;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ====== MASTER LIST STATE ======
  const [listData, setListData] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [listPage, setListPage] = useState(1);
  const [listLimit, setListLimit] = useState(100);
  const [listTotal, setListTotal] = useState(0);

  // ====== BATCH STATE ======
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const gridSx = useNlGridSx(isDarkMode, {
    headerBg: "#064e3b",
    headerBorder: "#10b981",
    headerBorderLight: "#059669",
    headerCellBorder: "#065f46",
    hoverBg: "rgba(16, 185, 129, 0.15)",
    hoverBgLight: "#ecfdf5",
    focusBorder: "#34d399",
    focusBorderLight: "#059669",
    rangeBg: "rgba(16, 185, 129, 0.25)",
    rangeBgLight: "#d1fae5",
  });

  // ====== UPLOAD ======
  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop();
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      toast.error("Invalid file type. Only .xlsx, .xls, .csv allowed");
      return;
    }
    setSelectedFile(file);
    setJobResult(null);
    setUploadError(null);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = (jid: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fsnMasterAPI.getUploadProgress(jid);
        const data = res.data;
        setJobResult(data);
        if (data.status === "done" || data.status === "failed") {
          stopPolling();
          setUploading(false);
          if (data.status === "done") {
            toast.success(
              `Import complete: ${data.inserted} new, ${data.updated} updated${
                data.skipped > 0 ? `, ${data.skipped} skipped` : ""
              }`,
            );
          } else {
            toast.error(data.error || "Upload failed");
            setUploadError(data.error || "Upload failed");
          }
        }
      } catch {
        // polling errors are non-fatal, keep trying
      }
    }, 800);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Select a file first");
      return;
    }
    try {
      setUploading(true);
      setUploadXferPct(0);
      setJobResult(null);
      setUploadError(null);
      stopPolling();

      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fsnMasterAPI.upload(formData, (pct) => {
        setUploadXferPct(pct);
      });

      const { jobId: jid } = res.data;
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      toast.success("File received — processing in background…", {
        duration: 3000,
      });

      startPolling(jid);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Upload failed";
      setUploadError(msg);
      toast.error(msg);
      setUploading(false);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const sample = [
      {
        WID: "ITME1234567",
        FSN: "FSNA1B2C3D4E5",
        "Product Title": "Sample Product Name",
        Brand: "Sample Brand",
        "CMS Vertical": "Electronics",
        "Mega Category": "Mobiles",
        "EAN/ENA": "8901234567890",
        "SAP/SKU": "SAP123456",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    ws["!cols"] = [
      { wch: 18 },
      { wch: 18 },
      { wch: 35 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
      { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FSN Master Template");
    XLSX.writeFile(wb, "FSN_Master_Upload_Template.xlsx");
    toast.success("Template downloaded");
  };

  // ====== MASTER LIST ======
  const loadList = useCallback(async () => {
    try {
      setListLoading(true);
      const res = await fsnMasterAPI.list({
        search: listSearch || undefined,
        page: listPage,
        limit: listLimit,
      });
      setListData(res.data.data || []);
      setListTotal(res.data.total || 0);
    } catch {
      toast.error("Failed to load master data");
    } finally {
      setListLoading(false);
    }
  }, [listSearch, listPage, listLimit]);

  useEffect(() => {
    if (currentTabCode === "list") loadList();
  }, [currentTabCode, loadList]);

  const exportToExcel = async () => {
    if (listData.length === 0) {
      toast.error("No data to export");
      return;
    }
    const XLSX = await import("xlsx");
    const rows = listData.map((r) => ({
      WID: r.wid || "",
      FSN: r.fsn || "",
      "Product Title": r.product_title || "",
      Brand: r.brand || "",
      "CMS Vertical": r.cms_vertical || "",
      "Mega Category": r.mega_category || "",
      "EAN/ENA": r.ean || "",
      "SAP/SKU": r.sap_sku || "",
      "Batch ID": r.batch_id || "",
      "Uploaded At": nlFormatDate(r.uploaded_at),
      "Uploaded By": r.uploaded_by_name || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FSN Master Data");
    XLSX.writeFile(
      wb,
      `FSN_Master_List_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("Exported");
  };

  // ====== BATCHES ======
  const loadBatches = useCallback(async () => {
    try {
      setBatchLoading(true);
      const res = await fsnMasterAPI.getBatches();
      setBatches(res.data || []);
    } catch {
      toast.error("Failed to load batches");
    } finally {
      setBatchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentTabCode === "batches") loadBatches();
  }, [currentTabCode, loadBatches]);

  const handleDeleteBatch = async (batchId: string) => {
    try {
      await fsnMasterAPI.deleteBatch(batchId);
      toast.success("Batch deleted");
      loadBatches();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Delete failed");
    }
  };

  // ====== COLUMN DEFS ======
  const listColumnDefs = useMemo(
    () => [
      { field: "wid", headerName: "WID", width: 160, pinned: "left" as const },
      { field: "fsn", headerName: "FSN", width: 180 },
      {
        field: "product_title",
        headerName: "Product Title",
        flex: 2,
        minWidth: 200,
      },
      { field: "brand", headerName: "Brand", width: 140 },
      { field: "cms_vertical", headerName: "CMS Vertical", width: 150 },
      { field: "mega_category", headerName: "Mega Category", width: 160 },
      { field: "ean", headerName: "EAN/ENA", width: 160 },
      { field: "sap_sku", headerName: "SAP/SKU", width: 140 },
      { field: "batch_id", headerName: "Batch ID", flex: 1, minWidth: 220 },
      {
        field: "uploaded_at",
        headerName: "Uploaded At",
        width: 130,
        valueFormatter: (p: any) => nlFormatDate(p.value),
      },
      { field: "uploaded_by_name", headerName: "Uploaded By", width: 140 },
    ],
    [],
  );

  const defaultColDef = useMemo(
    () => ({
      sortable: false,
      filter: false,
      resizable: true,
      suppressMovable: true,
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
          title="FSN Master Data"
          subtitle="Upload and manage product master records"
          icon="📋"
        />
        <StandardTabs
          value={tabValue}
          onChange={(_e: any, v: number) => setTabValue(v)}
          tabs={visibleTabs}
          color="#059669"
        />

        {/* ================== UPLOAD TAB ================== */}
        {currentTabCode === "upload" && (
          <Box
            sx={{
              flex: 1,
              overflow: "auto",
              p: { xs: 1.5, sm: 3 },
              bgcolor: isDarkMode ? "#0f172a" : "#f5f7fa",
            }}
          >
            <Paper
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 3,
                maxWidth: 880,
                mx: "auto",
                width: "100%",
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Upload Master Data
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Upload an Excel or CSV file. Existing records are updated by WID
                or FSN. Extra columns are preserved in metadata.
              </Typography>
              <Divider sx={{ mb: 3 }} />

              {/* Expected columns */}
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Recognized Columns (case-insensitive):
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 3 }}>
                {EXPECTED_COLUMNS.map((col) => (
                  <Chip
                    key={col}
                    label={col}
                    size="small"
                    variant="outlined"
                    color={col.startsWith("+") ? "default" : "primary"}
                    sx={{
                      fontStyle: col.startsWith("+") ? "italic" : "normal",
                    }}
                  />
                ))}
              </Box>

              {/* Download template */}
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={downloadTemplate}
                fullWidth
                sx={{ mb: 2, py: 1.25 }}
              >
                Download Template
              </Button>

              {/* Drop zone */}
              <Box
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFileSelect(e.dataTransfer.files?.[0] || null);
                }}
                onClick={() => !uploading && fileInputRef.current?.click()}
                sx={{
                  border: `2px dashed ${dragOver ? "#10b981" : selectedFile ? "#059669" : isDarkMode ? "#475569" : "#cbd5e1"}`,
                  borderRadius: 2,
                  p: { xs: 2.5, sm: 1.2 },
                  textAlign: "center",
                  cursor: uploading ? "not-allowed" : "pointer",
                  bgcolor: dragOver
                    ? "rgba(16,185,129,0.08)"
                    : selectedFile
                      ? "rgba(16,185,129,0.04)"
                      : "transparent",
                  transition: "all 0.2s ease",
                  mb: 2,
                  "&:hover": !uploading
                    ? {
                        borderColor: "#10b981",
                        bgcolor: "rgba(16,185,129,0.06)",
                      }
                    : {},
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: "none" }}
                  onChange={(e) =>
                    handleFileSelect(e.target.files?.[0] || null)
                  }
                  disabled={uploading}
                />
                {selectedFile ? (
                  <>
                    <CheckCircleIcon
                      sx={{ fontSize: 40, color: "#10b981", mb: 1 }}
                    />
                    <Typography sx={{ fontWeight: 700, color: "#059669" }}>
                      {selectedFile.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB — Click
                      to change
                    </Typography>
                  </>
                ) : (
                  <>
                    <UploadIcon
                      sx={{
                        fontSize: 40,
                        color: isDarkMode ? "#475569" : "#94a3b8",
                        mb: 1,
                      }}
                    />
                    <Typography
                      sx={{
                        fontWeight: 600,
                        color: isDarkMode ? "#94a3b8" : "#64748b",
                      }}
                    >
                      Click or drag file here
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      .xlsx, .xls, .csv
                    </Typography>
                  </>
                )}
              </Box>

              {/* Upload button */}
              {canSeeButton("upload") && (
                <Button
                  variant="contained"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  fullWidth
                  startIcon={
                    uploading ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      <UploadIcon />
                    )
                  }
                  sx={{
                    py: 1.5,
                    fontWeight: 700,
                    background:
                      !selectedFile || uploading
                        ? undefined
                        : "linear-gradient(135deg, #059669, #10b981)",
                  }}
                >
                  {uploading
                    ? jobResult
                      ? `Processing… ${jobResult.processed.toLocaleString()} rows`
                      : `Uploading… ${uploadXferPct}%`
                    : "Upload & Import"}
                </Button>
              )}

              {/* Progress */}
              {uploading && (
                <Box sx={{ mt: 1.5 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 0.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        color: jobResult ? "#f59e0b" : "#10b981",
                      }}
                    >
                      {jobResult
                        ? `⚙️ Processing rows… ${jobResult.processed.toLocaleString()} done`
                        : `⬆️ Uploading file… ${uploadXferPct}%`}
                    </Typography>
                    {!jobResult && (
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {uploadXferPct}%
                      </Typography>
                    )}
                  </Box>
                  <LinearProgress
                    variant={jobResult ? "indeterminate" : "determinate"}
                    value={!jobResult ? uploadXferPct : 100}
                    color={jobResult ? "warning" : "success"}
                    sx={{ borderRadius: 1, height: 8 }}
                  />
                  {jobResult && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        mt: 0.5,
                        display: "block",
                      }}
                    >
                      {jobResult.inserted.toLocaleString()} new
                      &nbsp;&middot;&nbsp;
                      {jobResult.updated.toLocaleString()} updated
                      &nbsp;&middot;&nbsp;
                      {jobResult.skipped.toLocaleString()} skipped
                    </Typography>
                  )}
                </Box>
              )}

              {/* Result after job completes */}
              {!uploading && jobResult?.status === "done" && (
                <Box sx={{ mt: 2 }}>
                  <Alert severity="success" sx={{ mb: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>
                      Import Complete
                    </Typography>
                    <Typography variant="body2">
                      Total: {jobResult.processed.toLocaleString()}{" "}
                      &nbsp;|&nbsp; New: {jobResult.inserted.toLocaleString()}{" "}
                      &nbsp;|&nbsp; Updated:{" "}
                      {jobResult.updated.toLocaleString()}
                      {jobResult.skipped > 0 && (
                        <>
                          {" "}
                          &nbsp;|&nbsp;{" "}
                          <strong style={{ color: "#ef4444" }}>
                            Skipped: {jobResult.skipped.toLocaleString()}
                          </strong>
                        </>
                      )}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.7rem",
                        display: "block",
                        mt: 0.5,
                      }}
                    >
                      Batch: {jobResult.batchId}
                    </Typography>
                  </Alert>
                </Box>
              )}

              {!uploading && jobResult?.status === "failed" && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    Import Failed
                  </Typography>
                  <Typography variant="body2">{jobResult.error}</Typography>
                </Alert>
              )}

              {uploadError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    Upload Failed
                  </Typography>
                  <Typography variant="body2">{uploadError}</Typography>
                </Alert>
              )}
            </Paper>
          </Box>
        )}

        {/* ================== MASTER LIST TAB ================== */}
        {currentTabCode === "list" && (
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
            <Stack
              direction="row"
              spacing={1}
              sx={{ mb: 1 }}
              alignItems="center"
            >
              <TextField
                fullWidth
                size="small"
                placeholder="Search WID, FSN, EAN, SAP, product, brand…"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                sx={{ flex: 1, "& .MuiOutlinedInput-root": { height: 38 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="primary" />
                    </InputAdornment>
                  ),
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setListPage(1);
                    loadList();
                  }
                }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={loadList}
                disabled={listLoading}
                sx={{ height: 38 }}
              >
                Refresh
              </Button>
              {canSeeButton("export") && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ExportIcon />}
                  onClick={exportToExcel}
                  disabled={listData.length === 0}
                  sx={{ height: 38 }}
                >
                  Export
                </Button>
              )}

              <Chip
                label={`${listTotal} records`}
                size="small"
                color="success"
                variant="outlined"
                sx={{ height: 88 }}
              />
            </Stack>

            <Box sx={{ flex: 1, minHeight: 0 }}>
              <Box className="ag-theme-quartz" sx={gridSx}>
                <AgGridReact
                  rowData={listData}
                  columnDefs={listColumnDefs}
                  defaultColDef={defaultColDef}
                  rowHeight={tableRowHeight}
                  headerHeight={40}
                  animateRows={false}
                  suppressCellFocus
                  loading={listLoading}
                  containerStyle={{
                    height: "100%",
                    width: "100%",
                    backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                  }}
                />
              </Box>
            </Box>

            {/* Pagination */}
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
                    value={listLimit}
                    onChange={(e) => {
                      setListLimit(Number(e.target.value));
                      setListPage(1);
                    }}
                    sx={{ height: 30, fontSize: "0.78rem", minWidth: 65 }}
                  >
                    {[50, 100, 500, 1000].map((v) => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    ))}
                  </Select>
                </Stack>
                <Typography
                  sx={{ fontSize: "0.78rem", color: "text.secondary" }}
                >
                  {listTotal > 0
                    ? `${(listPage - 1) * listLimit + 1}–${Math.min(listPage * listLimit, listTotal)} of ${listTotal}`
                    : "0 results"}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <IconButton
                    aria-label="First"
                    size="small"
                    disabled={listPage === 1}
                    onClick={() => setListPage(1)}
                  >
                    <FirstPage fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Prev"
                    size="small"
                    disabled={listPage === 1}
                    onClick={() => setListPage((p) => p - 1)}
                  >
                    <KeyboardArrowLeft fontSize="small" />
                  </IconButton>
                  <Pagination
                    page={listPage}
                    count={Math.ceil(listTotal / listLimit) || 1}
                    size="small"
                    onChange={(_, v) => setListPage(v)}
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
                          ? "rgba(16,185,129,0.3) !important"
                          : "rgba(5,150,105,0.12) !important",
                      },
                    }}
                  />
                  <IconButton
                    aria-label="Next"
                    size="small"
                    disabled={listPage >= Math.ceil(listTotal / listLimit)}
                    onClick={() => setListPage((p) => p + 1)}
                  >
                    <KeyboardArrowRight fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label="Last"
                    size="small"
                    disabled={listPage >= Math.ceil(listTotal / listLimit)}
                    onClick={() =>
                      setListPage(Math.ceil(listTotal / listLimit))
                    }
                  >
                    <LastPage fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            </Fade>
          </Box>
        )}

        {/* ================== BATCHES TAB ================== */}
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
              title="FSN Master Data — Batch Management"
              emptyMessage="No upload batches found"
              emptySubMessage="Batches appear here after a successful master data upload"
            />
          </Box>
        )}
      </Box>
    </AppLayout>
  );
}
