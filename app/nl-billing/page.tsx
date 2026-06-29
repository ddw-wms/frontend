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
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  useMediaQuery,
  useTheme,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Upload as UploadIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AttachMoney as AttachMoneyIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";
import { nlBillingAPI } from "@/lib/nl-api";
import { useNlGridSx } from "@/lib/nl-utils";
import { useWarehouse } from "@/app/context/WarehouseContext";
import { getStoredUser } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";
import { StandardPageHeader, StandardTabs } from "@/components";
import { useTableRowHeight } from "@/app/context/AppearanceContext";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import toast, { Toaster } from "react-hot-toast";
import { AgGridReact } from "@/components/AGGridScrollWrapper";
import {
  ModuleRegistry,
  AllCommunityModule,
  ClientSideRowModelModule,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

const ALL_TABS = ["Financials", "P&L Summary"];
const TAB_CODES = ["financials", "pl"];

export default function NLBillingPage() {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);
  const tableRowHeight = useTableRowHeight();
  const { filterTabs, canSeeButton, canSeeTab, isAdmin } =
    usePagePermissions("nl_billing");
  const gridRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const effectiveRowHeight = isMobile
    ? Math.max(34, tableRowHeight - 4)
    : tableRowHeight;

  const gridSx = useNlGridSx(isDarkMode);

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
  const currentTabCode = visibleTabCodes[tabValue] || "financials";

  // Data
  const [financials, setFinancials] = useState<any[]>([]);
  const [plSummary, setPlSummary] = useState<any>({
    total_revenue: 0,
    total_cost: 0,
    total_pl: 0,
    total_entries: 0,
    profitable_count: 0,
    loss_count: 0,
    breakeven_count: 0,
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
  }, []);

  // Load financials
  const loadFinancials = useCallback(async () => {
    if (!activeWarehouse?.id) return;
    try {
      setLoading(true);
      const res = await nlBillingAPI.list({
        warehouse_id: activeWarehouse.id,
        search: search || undefined,
      });
      setFinancials(res.data?.data || []);
    } catch {
      toast.error("Failed to load financials");
    } finally {
      setLoading(false);
    }
  }, [activeWarehouse?.id, search]);

  // Load P&L
  const loadPL = useCallback(async () => {
    if (!activeWarehouse?.id) return;
    try {
      setLoading(true);
      const res = await nlBillingAPI.getPLSummary({
        warehouse_id: activeWarehouse.id,
      });
      setPlSummary(res.data?.data || plSummary);
    } catch {
      toast.error("Failed to load P&L");
    } finally {
      setLoading(false);
    }
  }, [activeWarehouse?.id]);

  useEffect(() => {
    if (currentTabCode === "financials") loadFinancials();
    if (currentTabCode === "pl") loadPL();
  }, [currentTabCode, loadFinancials, loadPL]);

  // Upload proforma invoice
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("warehouse_id", String(activeWarehouse?.id));

    try {
      setUploading(true);
      const res = await nlBillingAPI.uploadProforma(formData);
      toast.success(
        `Uploaded: ${res.data.inserted} new, ${res.data.updated} updated`,
      );
      loadFinancials();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadBillingTemplate = async () => {
    const XLSX = await import("xlsx");
    const templateData = [
      {
        "VRP ID": "",
        "Customer Name": "",
        "Invoice No": "",
        "Invoice Date": "",
        "Invoice Amount": "",
        "Selling Price": "",
        "Cost Price": "",
        Qty: "",
        Remarks: "",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Proforma Template");
    XLSX.writeFile(wb, "NL_Billing_Proforma_Template.xlsx");
  };

  // Edit financial entry
  const handleEditSave = async () => {
    if (!editRow) return;
    try {
      await nlBillingAPI.update(editRow.id, {
        selling_price: editRow.selling_price,
        cost_price: editRow.cost_price,
        invoice_no: editRow.invoice_no,
        invoice_amount: editRow.invoice_amount,
        remarks: editRow.remarks,
      });
      toast.success("Updated");
      setEditDialogOpen(false);
      loadFinancials();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Update failed");
    }
  };

  // Column defs for financials
  const financialColumnDefs = useMemo(
    () => [
      { field: "vrp_id", headerName: "VRP ID", flex: 1, minWidth: 110 },
      {
        field: "customer_name",
        headerName: "Customer",
        flex: 1,
        minWidth: 130,
      },
      { field: "invoice_no", headerName: "Invoice No", width: 130 },
      {
        field: "invoice_amount",
        headerName: "Invoice Amt",
        width: 110,
        type: "numericColumn",
        valueFormatter: (p: any) =>
          p.value ? `₹${Number(p.value).toLocaleString()}` : "-",
      },
      {
        field: "selling_price",
        headerName: "Selling Price",
        width: 110,
        type: "numericColumn",
        valueFormatter: (p: any) =>
          p.value ? `₹${Number(p.value).toLocaleString()}` : "-",
      },
      {
        field: "cost_price",
        headerName: "Cost Price",
        width: 110,
        type: "numericColumn",
        valueFormatter: (p: any) =>
          p.value ? `₹${Number(p.value).toLocaleString()}` : "-",
      },
      { field: "qty", headerName: "Qty", width: 70, type: "numericColumn" },
      {
        field: "net_pl",
        headerName: "Net P&L",
        width: 110,
        type: "numericColumn",
        cellStyle: (p: any) => {
          const val = Number(p.value || 0);
          if (val > 0) return { color: "#10b981", fontWeight: 700 };
          if (val < 0) return { color: "#ef4444", fontWeight: 700 };
          return null;
        },
        valueFormatter: (p: any) => {
          const val = Number(p.value || 0);
          return val >= 0
            ? `₹${val.toLocaleString()}`
            : `-₹${Math.abs(val).toLocaleString()}`;
        },
      },
      { field: "remarks", headerName: "Remarks", flex: 1, minWidth: 120 },
      {
        headerName: "Edit",
        width: 70,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) => (
          <Button
            size="small"
            onClick={() => {
              setEditRow({ ...p.data });
              setEditDialogOpen(true);
            }}
          >
            Edit
          </Button>
        ),
      },
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

  if (!user) {
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
  }
  if (!activeWarehouse) {
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
          <Alert severity="warning">No active warehouse selected.</Alert>
        </Box>
      </AppLayout>
    );
  }

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
          title="NL Billing"
          subtitle="Proforma invoices & P&L tracking"
          icon="💰"
          warehouseName={activeWarehouse?.name}
        />
        <StandardTabs
          value={tabValue}
          onChange={(e, v) => setTabValue(v)}
          tabs={visibleTabs}
          color="#059669"
        />

        {/* ===== FINANCIALS TAB ===== */}
        {currentTabCode === "financials" && (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              p: { xs: 1, sm: 1.5 },
            }}
          >
            {/* Actions */}
            <Paper sx={{ p: 1.5, mb: 1, borderRadius: 2 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ sm: "center" }}
              >
                <TextField
                  placeholder="Search VRP, customer, invoice..."
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
                    if (e.key === "Enter") loadFinancials();
                  }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={loadFinancials}
                  disabled={loading}
                >
                  Refresh
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={downloadBillingTemplate}
                >
                  Download Template
                </Button>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleUpload}
                />
                {canSeeButton("upload") && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={
                      uploading ? (
                        <CircularProgress size={16} />
                      ) : (
                        <UploadIcon />
                      )
                    }
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading..." : "Upload Proforma"}
                  </Button>
                )}
              </Stack>
            </Paper>

            {/* Grid */}
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <Box className="ag-theme-quartz" sx={gridSx}>
                <AgGridReact
                  ref={gridRef}
                  rowData={financials}
                  columnDefs={financialColumnDefs}
                  defaultColDef={defaultColDef}
                  rowHeight={effectiveRowHeight}
                  headerHeight={40}
                  animateRows={false}
                  suppressCellFocus
                  loading={loading}
                />
              </Box>
            </Box>
          </Box>
        )}

        {/* ===== P&L SUMMARY TAB ===== */}
        {currentTabCode === "pl" && (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "auto",
              p: { xs: 1, sm: 2 },
            }}
          >
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={loadPL}
                disabled={loading}
              >
                Refresh
              </Button>
            </Stack>

            {/* P&L KPI Cards */}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ mb: 3, flexWrap: "wrap" }}
            >
              <Card
                sx={{
                  flex: 1,
                  minWidth: 200,
                  background: "linear-gradient(135deg, #1e40af, #3b82f6)",
                  color: "white",
                }}
              >
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AttachMoneyIcon />
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      Total Revenue
                    </Typography>
                  </Stack>
                  <Typography
                    variant={isMobile ? "h5" : "h4"}
                    sx={{ fontWeight: 700, mt: 1 }}
                  >
                    ₹{Number(plSummary.total_revenue).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
              <Card
                sx={{
                  flex: 1,
                  minWidth: 200,
                  background: "linear-gradient(135deg, #dc2626, #f87171)",
                  color: "white",
                }}
              >
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TrendingDownIcon />
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      Total Cost
                    </Typography>
                  </Stack>
                  <Typography
                    variant={isMobile ? "h5" : "h4"}
                    sx={{ fontWeight: 700, mt: 1 }}
                  >
                    ₹{Number(plSummary.total_cost).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
              <Card
                sx={{
                  flex: 1,
                  minWidth: 200,
                  color: "white",
                  background:
                    Number(plSummary.total_pl) >= 0
                      ? "linear-gradient(135deg, #059669, #10b981)"
                      : "linear-gradient(135deg, #b91c1c, #ef4444)",
                }}
              >
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TrendingUpIcon />
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      Net P&L
                    </Typography>
                  </Stack>
                  <Typography
                    variant={isMobile ? "h5" : "h4"}
                    sx={{ fontWeight: 700, mt: 1 }}
                  >
                    {Number(plSummary.total_pl) >= 0 ? "" : "-"}₹
                    {Math.abs(Number(plSummary.total_pl)).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Stack>

            {/* Breakdown cards */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Entries
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {plSummary.total_entries}
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: "#10b981" }}>
                    Profitable
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 700, color: "#10b981" }}
                  >
                    {plSummary.profitable_count}
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ color: "#ef4444" }}>
                    Loss
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 700, color: "#ef4444" }}
                  >
                    {plSummary.loss_count}
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Breakeven
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {plSummary.breakeven_count}
                  </Typography>
                </CardContent>
              </Card>
            </Stack>
          </Box>
        )}
      </Box>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Edit Financial Entry — {editRow?.vrp_id}</DialogTitle>
        <DialogContent>
          {editRow && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Selling Price"
                type="number"
                value={editRow.selling_price || ""}
                onChange={(e) =>
                  setEditRow({
                    ...editRow,
                    selling_price: Number(e.target.value),
                  })
                }
                size="small"
                fullWidth
              />
              <TextField
                label="Cost Price"
                type="number"
                value={editRow.cost_price || ""}
                onChange={(e) =>
                  setEditRow({ ...editRow, cost_price: Number(e.target.value) })
                }
                size="small"
                fullWidth
              />
              <TextField
                label="Invoice No"
                value={editRow.invoice_no || ""}
                onChange={(e) =>
                  setEditRow({ ...editRow, invoice_no: e.target.value })
                }
                size="small"
                fullWidth
              />
              <TextField
                label="Invoice Amount"
                type="number"
                value={editRow.invoice_amount || ""}
                onChange={(e) =>
                  setEditRow({
                    ...editRow,
                    invoice_amount: Number(e.target.value),
                  })
                }
                size="small"
                fullWidth
              />
              <TextField
                label="Remarks"
                value={editRow.remarks || ""}
                onChange={(e) =>
                  setEditRow({ ...editRow, remarks: e.target.value })
                }
                size="small"
                fullWidth
                multiline
                rows={2}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
