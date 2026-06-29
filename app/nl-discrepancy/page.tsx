"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Card,
  CardContent,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";
import { nlDiscrepancyAPI } from "@/lib/nl-api";
import { useNlGridSx, nlFormatDateTime } from "@/lib/nl-utils";
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

const formatDate = nlFormatDateTime;

const DISCREPANCY_TYPES = [
  { value: "short_qty", label: "Short Qty" },
  { value: "damaged", label: "Damaged" },
  { value: "grade_d", label: "Grade D" },
  { value: "wrong_item", label: "Wrong Item" },
  { value: "other", label: "Other" },
];

const STATUS_COLORS: Record<
  string,
  "error" | "success" | "warning" | "info" | "default"
> = {
  open: "error",
  resolved: "success",
  escalated: "warning",
  investigating: "info",
  written_off: "default",
};

const ALL_TABS = ["Discrepancies", "Create"];
const TAB_CODES = ["list", "create"];

export default function NLDiscrepancyPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDarkMode = theme.palette.mode === "dark";
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);
  const tableRowHeight = useTableRowHeight();
  const { filterTabs, canSeeTab, isAdmin, canSeeButton } =
    usePagePermissions("nl_discrepancy");

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
  const currentTabCode = visibleTabCodes[tabValue] || "list";

  // List state
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [stats, setStats] = useState<any>({
    total: 0,
    open_count: 0,
    resolved_count: 0,
    escalated_count: 0,
  });

  // Create form state
  const [formBoxId, setFormBoxId] = useState("");
  const [formVrpId, setFormVrpId] = useState("");
  const [formType, setFormType] = useState("short_qty");
  const [formExpected, setFormExpected] = useState("");
  const [formActual, setFormActual] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Resolve dialog state
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveResolution, setResolveResolution] = useState("");
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolving, setResolving] = useState(false);
  const [escalateTargetId, setEscalateTargetId] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
  }, []);

  const loadDiscrepancies = useCallback(async () => {
    if (!activeWarehouse?.id) return;
    try {
      setListLoading(true);
      const res = await nlDiscrepancyAPI.list({
        warehouse_id: activeWarehouse.id,
        status: statusFilter || undefined,
        discrepancy_type: typeFilter || undefined,
        search: search || undefined,
      });
      setDiscrepancies(res.data?.data || []);
    } catch {
      toast.error("Failed to load discrepancies");
    } finally {
      setListLoading(false);
    }
  }, [activeWarehouse?.id, statusFilter, typeFilter, search]);

  const loadStats = useCallback(async () => {
    if (!activeWarehouse?.id) return;
    try {
      const res = await nlDiscrepancyAPI.getStats({
        warehouse_id: activeWarehouse.id,
      });
      setStats(res.data?.data || stats);
    } catch {
      /* ignore */
    }
  }, [activeWarehouse?.id]);

  useEffect(() => {
    if (currentTabCode === "list") {
      loadDiscrepancies();
      loadStats();
    }
  }, [currentTabCode, loadDiscrepancies, loadStats]);

  const handleCreate = async () => {
    if (!activeWarehouse?.id || !formType) {
      toast.error("Discrepancy type is required");
      return;
    }
    try {
      setCreating(true);
      await nlDiscrepancyAPI.create({
        warehouse_id: activeWarehouse.id,
        box_id: formBoxId || undefined,
        vrp_id: formVrpId || undefined,
        discrepancy_type: formType,
        expected_value: formExpected || undefined,
        actual_value: formActual || undefined,
        notes: formNotes || undefined,
      });
      toast.success("Discrepancy reported");
      setFormBoxId("");
      setFormVrpId("");
      setFormType("short_qty");
      setFormExpected("");
      setFormActual("");
      setFormNotes("");
      setTabValue(0);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveId || !resolveResolution.trim()) {
      toast.error("Resolution is required");
      return;
    }
    try {
      setResolving(true);
      await nlDiscrepancyAPI.resolve(resolveId, {
        resolution: resolveResolution.trim(),
        notes: resolveNotes || undefined,
      });
      toast.success("Discrepancy resolved");
      setResolveDialogOpen(false);
      setResolveId(null);
      setResolveResolution("");
      setResolveNotes("");
      loadDiscrepancies();
      loadStats();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to resolve");
    } finally {
      setResolving(false);
    }
  };

  const handleEscalate = async (id: string) => {
    try {
      await nlDiscrepancyAPI.escalate(id);
      toast.success("Discrepancy escalated");
      loadDiscrepancies();
      loadStats();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to escalate");
    }
  };

  const requestEscalate = (id: string) => {
    setEscalateTargetId(id);
  };

  const columnDefs = useMemo(
    () => [
      { field: "box_id", headerName: "Box ID", flex: 1, minWidth: 130 },
      { field: "vrp_id", headerName: "VRP ID", flex: 1, minWidth: 110 },
      {
        field: "discrepancy_type",
        headerName: "Type",
        width: 120,
        cellRenderer: (p: any) => (
          <Chip
            label={(p.value || "").replace(/_/g, " ")}
            size="small"
            variant="outlined"
          />
        ),
      },
      { field: "expected_value", headerName: "Expected", width: 100 },
      { field: "actual_value", headerName: "Actual", width: 100 },
      { field: "category", headerName: "Category", width: 110 },
      { field: "lot_type", headerName: "Lot", width: 70 },
      { field: "notes", headerName: "Notes", flex: 1, minWidth: 140 },
      {
        field: "status",
        headerName: "Status",
        width: 110,
        cellRenderer: (p: any) => (
          <Chip
            label={p.value}
            size="small"
            color={STATUS_COLORS[p.value] || "default"}
            variant="outlined"
          />
        ),
      },
      { field: "raised_by_name", headerName: "Raised By", width: 120 },
      {
        field: "created_at",
        headerName: "Date",
        width: 140,
        valueFormatter: (p: any) => formatDate(p.value),
      },
      { field: "resolution", headerName: "Resolution", flex: 1, minWidth: 130 },
      {
        headerName: "Actions",
        width: 170,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) => {
          if (p.data.status !== "open") return null;
          return (
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.3 }}>
              {canSeeButton("resolve") && (
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  onClick={() => {
                    setResolveId(p.data.id);
                    setResolveDialogOpen(true);
                  }}
                >
                  Resolve
                </Button>
              )}
              {canSeeButton("escalate") && (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={() => requestEscalate(p.data.id)}
                >
                  Escalate
                </Button>
              )}
            </Stack>
          );
        },
      },
    ],
    [canSeeButton],
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
          title="NL Discrepancy"
          subtitle="Track & resolve inventory discrepancies"
          icon="⚠️"
          warehouseName={activeWarehouse?.name}
        />
        <StandardTabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          tabs={visibleTabs}
          color="#ef4444"
        />

        {/* ===== LIST TAB ===== */}
        {currentTabCode === "list" && (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              p: { xs: 1, sm: 1.5 },
            }}
          >
            {/* KPI Cards */}
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ mb: 1.5, flexWrap: "wrap" }}
            >
              <Card
                sx={{
                  flex: 1,
                  minWidth: 100,
                  background: "linear-gradient(135deg, #1e40af, #3b82f6)",
                  color: "white",
                }}
              >
                <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Total
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {stats.total}
                  </Typography>
                </CardContent>
              </Card>
              <Card
                sx={{
                  flex: 1,
                  minWidth: 100,
                  background: "linear-gradient(135deg, #dc2626, #f87171)",
                  color: "white",
                }}
              >
                <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Open
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {stats.open_count}
                  </Typography>
                </CardContent>
              </Card>
              <Card
                sx={{
                  flex: 1,
                  minWidth: 100,
                  background: "linear-gradient(135deg, #059669, #10b981)",
                  color: "white",
                }}
              >
                <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Resolved
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {stats.resolved_count}
                  </Typography>
                </CardContent>
              </Card>
              <Card
                sx={{
                  flex: 1,
                  minWidth: 100,
                  background: "linear-gradient(135deg, #d97706, #f59e0b)",
                  color: "white",
                }}
              >
                <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Escalated
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {stats.escalated_count}
                  </Typography>
                </CardContent>
              </Card>
            </Stack>

            {/* Filters */}
            <Paper sx={{ p: 1.5, mb: 1, borderRadius: 2 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ sm: "center" }}
              >
                <TextField
                  placeholder="Search box, VRP, notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  size="small"
                  sx={{ flex: 1, minWidth: 180 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="primary" />
                      </InputAdornment>
                    ),
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadDiscrepancies();
                  }}
                />
                <TextField
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  size="small"
                  select
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="escalated">Escalated</MenuItem>
                </TextField>
                <TextField
                  label="Type"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  size="small"
                  select
                  sx={{ minWidth: 130 }}
                >
                  <MenuItem value="">All</MenuItem>
                  {DISCREPANCY_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={loadDiscrepancies}
                  disabled={listLoading}
                >
                  Refresh
                </Button>
              </Stack>
            </Paper>

            {/* Grid */}
            <Box sx={{ flex: 1, minHeight: 300 }}>
              <Box className="ag-theme-quartz" sx={gridSx}>
                <AgGridReact
                  rowData={discrepancies}
                  columnDefs={columnDefs}
                  defaultColDef={defaultColDef}
                  rowHeight={tableRowHeight}
                  headerHeight={40}
                  animateRows={false}
                  suppressCellFocus
                  loading={listLoading}
                />
              </Box>
            </Box>

            <Paper
              sx={{
                p: 1,
                mt: 1,
                borderRadius: 2,
                bgcolor: isDarkMode ? "#1e293b" : "#f1f5f9",
              }}
            >
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Showing {discrepancies.length} discrepancies
              </Typography>
            </Paper>
          </Box>
        )}

        {/* ===== CREATE TAB ===== */}
        {currentTabCode === "create" && (
          <Box sx={{ flex: 1, overflow: "auto", p: { xs: 1, sm: 1.5 } }}>
            <Paper sx={{ p: 3, maxWidth: 600, mx: "auto", borderRadius: 2 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  mb: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <WarningIcon color="error" /> Report New Discrepancy
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Discrepancy Type *"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  size="small"
                  select
                  fullWidth
                >
                  {DISCREPANCY_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </TextField>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Box ID"
                    value={formBoxId}
                    onChange={(e) => setFormBoxId(e.target.value)}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="VRP ID"
                    value={formVrpId}
                    onChange={(e) => setFormVrpId(e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Stack>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Expected Value"
                    value={formExpected}
                    onChange={(e) => setFormExpected(e.target.value)}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Actual Value"
                    value={formActual}
                    onChange={(e) => setFormActual(e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Stack>
                <TextField
                  label="Notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  size="small"
                  fullWidth
                  multiline
                  rows={3}
                />
                {canSeeButton("create") && (
                  <Button
                    variant="contained"
                    color="error"
                    size="large"
                    startIcon={
                      creating ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <AddIcon />
                      )
                    }
                    onClick={handleCreate}
                    disabled={creating || !formType}
                    fullWidth
                  >
                    {creating ? "Reporting..." : "Report Discrepancy"}
                  </Button>
                )}
              </Stack>
            </Paper>
          </Box>
        )}
      </Box>

      {/* Resolve Dialog */}
      <Dialog
        open={resolveDialogOpen}
        onClose={() => setResolveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Resolve Discrepancy</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Resolution *"
              value={resolveResolution}
              onChange={(e) => setResolveResolution(e.target.value)}
              size="small"
              fullWidth
              multiline
              rows={2}
              placeholder="Describe how this was resolved..."
            />
            <TextField
              label="Additional Notes"
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              size="small"
              fullWidth
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleResolve}
            disabled={resolving || !resolveResolution.trim()}
            startIcon={
              resolving ? <CircularProgress size={16} /> : <CheckCircleIcon />
            }
          >
            {resolving ? "Resolving..." : "Confirm Resolve"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!escalateTargetId}
        onClose={() => setEscalateTargetId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Escalate Discrepancy?</DialogTitle>
        <DialogContent>
          <Typography>
            This will mark the discrepancy as escalated for further review.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEscalateTargetId(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={async () => {
              const id = escalateTargetId;
              setEscalateTargetId(null);
              if (id) await handleEscalate(id);
            }}
          >
            Escalate
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
