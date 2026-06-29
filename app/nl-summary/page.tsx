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
} from "@mui/material";
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { nlSummaryAPI } from "@/lib/nl-api";
import { useNlGridSx, nlFormatDate } from "@/lib/nl-utils";
import { useWarehouse } from "@/app/context/WarehouseContext";
import { getStoredUser } from "@/lib/auth";
import AppLayout from "@/components/AppLayout";
import { StandardPageHeader } from "@/components";
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

const formatDate = nlFormatDate;

export default function NLSummaryPage() {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);
  const tableRowHeight = useTableRowHeight();
  const { canSeeButton } = usePagePermissions("nl_summary");
  const gridRef = useRef<any>(null);

  const gridSx = useNlGridSx(isDarkMode);

  // Data
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [kpi, setKpi] = useState<any>({
    total_received_qty: 0,
    available_qty: 0,
    dispatched_qty: 0,
    short_qty: 0,
    damaged_count: 0,
  });
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
  }, []);

  const loadSummary = useCallback(async () => {
    if (!activeWarehouse?.id) return;
    try {
      setLoading(true);
      const res = await nlSummaryAPI.getSummary({
        warehouse_id: activeWarehouse.id,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setSummaryData(res.data?.data || []);
      setKpi(res.data?.kpi || kpi);
    } catch (error: any) {
      toast.error("Failed to load summary");
    } finally {
      setLoading(false);
    }
  }, [activeWarehouse?.id, dateFrom, dateTo]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Filtered data for search
  const filteredData = useMemo(() => {
    if (!search) return summaryData;
    const s = search.toLowerCase();
    return summaryData.filter(
      (r: any) =>
        (r.vrp_id || "").toLowerCase().includes(s) ||
        (r.category || "").toLowerCase().includes(s) ||
        (r.region || "").toLowerCase().includes(s) ||
        (r.dispatched_to || "").toLowerCase().includes(s),
    );
  }, [summaryData, search]);

  // Export
  const handleExport = async () => {
    try {
      const res = await nlSummaryAPI.exportExcel({
        warehouse_id: activeWarehouse?.id,
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NL_Summary_${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel exported");
    } catch {
      toast.error("Export failed");
    }
  };

  // Column defs
  const columnDefs = useMemo(
    () => [
      {
        field: "inbound_date",
        headerName: "Date",
        width: 110,
        valueFormatter: (p: any) => formatDate(p.value),
      },
      { field: "vrp_id", headerName: "VRP ID", flex: 1, minWidth: 110 },
      { field: "region", headerName: "Region", width: 100 },
      { field: "category", headerName: "Category", width: 130 },
      { field: "lot_type", headerName: "Lot", width: 70 },
      {
        field: "declared_boxes",
        headerName: "Decl Boxes",
        width: 100,
        type: "numericColumn",
      },
      {
        field: "received_boxes",
        headerName: "Rec Boxes",
        width: 100,
        type: "numericColumn",
      },
      {
        field: "short_boxes",
        headerName: "Short Boxes",
        width: 100,
        type: "numericColumn",
        cellStyle: (p: any) =>
          p.value > 0 ? { color: "#ef4444", fontWeight: 700 } : null,
      },
      {
        field: "declared_qty",
        headerName: "Decl Qty",
        width: 90,
        type: "numericColumn",
      },
      {
        field: "received_qty",
        headerName: "Rec Qty",
        width: 90,
        type: "numericColumn",
      },
      {
        field: "short_qty",
        headerName: "Short Qty",
        width: 90,
        type: "numericColumn",
        cellStyle: (p: any) =>
          p.value > 0 ? { color: "#ef4444", fontWeight: 700 } : null,
      },
      {
        field: "dispatched_to",
        headerName: "Dispatched To",
        flex: 1,
        minWidth: 130,
      },
      {
        field: "dispatched_boxes",
        headerName: "Disp Boxes",
        width: 100,
        type: "numericColumn",
      },
      {
        field: "available_boxes",
        headerName: "Avail Boxes",
        width: 100,
        type: "numericColumn",
      },
      {
        field: "dispatched_qty",
        headerName: "Disp Qty",
        width: 90,
        type: "numericColumn",
      },
      {
        field: "available_qty",
        headerName: "Avail Qty",
        width: 90,
        type: "numericColumn",
        cellStyle: (p: any) =>
          p.value > 0 ? { color: "#10b981", fontWeight: 700 } : null,
      },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        cellRenderer: (p: any) => {
          const colors: Record<
            string,
            "success" | "warning" | "info" | "default"
          > = {
            fully_dispatched: "success",
            partially_dispatched: "warning",
            available: "info",
          };
          return (
            <Chip
              label={(p.value || "").replace(/_/g, " ")}
              size="small"
              color={colors[p.value] || "default"}
              variant="outlined"
            />
          );
        },
      },
      { field: "remarks", headerName: "Remarks", flex: 1, minWidth: 120 },
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
          title="NL Summary"
          subtitle="Aggregated inventory overview"
          icon="📊"
          warehouseName={activeWarehouse?.name}
        />

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
            direction={isMobile ? "column" : "row"}
            spacing={1.5}
            sx={{ mb: 1.5, flexWrap: "wrap" }}
          >
            <Card
              sx={{
                flex: 1,
                minWidth: isMobile ? "100%" : 110,
                background: "linear-gradient(135deg, #1e40af, #3b82f6)",
                color: "white",
              }}
            >
              <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Received
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {Number(kpi.total_received_qty).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
            <Card
              sx={{
                flex: 1,
                minWidth: isMobile ? "100%" : 110,
                background: "linear-gradient(135deg, #059669, #10b981)",
                color: "white",
              }}
            >
              <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Available
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {Number(kpi.available_qty).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
            <Card
              sx={{
                flex: 1,
                minWidth: isMobile ? "100%" : 110,
                background: "linear-gradient(135deg, #dc2626, #f87171)",
                color: "white",
              }}
            >
              <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Dispatched
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {Number(kpi.dispatched_qty).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
            <Card
              sx={{
                flex: 1,
                minWidth: isMobile ? "100%" : 100,
                background: "linear-gradient(135deg, #d97706, #f59e0b)",
                color: "white",
              }}
            >
              <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Short
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {Number(kpi.short_qty).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Stack>

          {/* Search + Filters + Actions */}
          <Paper sx={{ p: 1.5, mb: 1, borderRadius: 2 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ sm: "center" }}
            >
              <TextField
                placeholder="Search VRP, category, region..."
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
              />
              <TextField
                label="From"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                size="small"
                sx={{ width: 150 }}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="To"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                size="small"
                sx={{ width: 150 }}
                InputLabelProps={{ shrink: true }}
              />
              <Button
                fullWidth={isMobile}
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={loadSummary}
                disabled={loading}
              >
                Refresh
              </Button>
              {canSeeButton("export") && (
                <Button
                  fullWidth={isMobile}
                  variant="contained"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={handleExport}
                >
                  Export
                </Button>
              )}
            </Stack>
          </Paper>

          {/* Summary Grid */}
          <Box sx={{ flex: 1, minHeight: isMobile ? 220 : 300 }}>
            <Box className="ag-theme-quartz" sx={gridSx}>
              <AgGridReact
                ref={gridRef}
                rowData={filteredData}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                rowHeight={tableRowHeight}
                headerHeight={40}
                animateRows={false}
                suppressCellFocus
                loading={loading}
                noRowsOverlayComponent={() => (
                  <Typography sx={{ color: "text.secondary", py: 4 }}>
                    No records found
                  </Typography>
                )}
              />
            </Box>
          </Box>

          {/* Footer */}
          <Paper
            sx={{
              p: 1,
              mt: 1,
              borderRadius: 2,
              bgcolor: isDarkMode ? "#1e293b" : "#f1f5f9",
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Showing {filteredData.length} of {summaryData.length} VRP records
            </Typography>
          </Paper>
        </Box>
      </Box>
    </AppLayout>
  );
}
