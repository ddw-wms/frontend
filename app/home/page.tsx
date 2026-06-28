// File Path = wms_frontend/app/home/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CircularProgress,
  Chip,
  useTheme,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  ArrowForward as ArrowForwardIcon,
  Widgets as RvpLargeIcon,
  Layers as NLIcon,
  Assignment as FSNIcon,
  StorageRounded,
  CallReceivedRounded,
  DoneAllRounded,
  ShoppingCartRounded,
  LocalShippingRounded,
  HourglassEmptyRounded,
  CancelRounded,
  InventoryRounded,
  RemoveCircleRounded,
  WarningRounded,
  DateRangeRounded,
  FormatListBulletedRounded,
} from "@mui/icons-material";
import AppLayout from "@/components/AppLayout";
import { StandardPageHeader } from "@/components";
import { dashboardAPI } from "@/lib/api";
import { nlSummaryAPI } from "@/lib/nl-api";
import { fsnScanningAPI } from "@/lib/fsn-api";
import { useWarehouse } from "@/app/context/WarehouseContext";
import { usePermissions } from "@/app/context/PermissionContext";
import { useRouter } from "next/navigation";

// ============================================================
// MetricCard — exact same style as /dashboard metric cards
// ============================================================
function MetricCard({
  label,
  value,
  color,
  icon: Icon,
  isDarkMode,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
  isDarkMode: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      elevation={0}
      onClick={onClick}
      sx={{
        px: { xs: 1, sm: 1.5 },
        py: { xs: 0.85, sm: 1.1 },
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: { xs: 0.75, sm: 1.1 },
        borderRadius: { xs: 2, sm: 2.5 },
        position: "relative",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        background: isDarkMode
          ? `linear-gradient(135deg, ${color}14 0%, ${color}08 100%)`
          : `linear-gradient(135deg, rgba(255,255,255,0.95) 0%, ${color}16 55%, ${color}10 100%)`,
        border: `1px solid ${color}22`,
        boxShadow: isDarkMode
          ? `0 4px 14px ${color}16, inset 0 1px 1px rgba(255,255,255,0.05)`
          : `0 2px 10px ${color}1a, inset 0 1px 1px rgba(255,255,255,0.8)`,
        borderLeft: `4px solid ${color}`,
        transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "&:hover": onClick
          ? {
              transform: "translateY(-3px) scale(1.02)",
              boxShadow: isDarkMode
                ? `0 12px 28px ${color}28`
                : `0 10px 28px ${color}28`,
              border: `1px solid ${color}32`,
              borderLeft: `4px solid ${color}`,
            }
          : {},
      }}
    >
      {/* Icon box */}
      <Box
        sx={{
          width: { xs: 30, sm: 38 },
          height: { xs: 30, sm: 38 },
          borderRadius: { xs: 1.5, sm: 2 },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
          flexShrink: 0,
          boxShadow: isDarkMode
            ? `0 4px 10px ${color}42`
            : `0 4px 14px ${color}38`,
          position: "relative",
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), transparent 70%)",
            pointerEvents: "none",
          },
          "& svg": {
            fontSize: { xs: "0.88rem", sm: "1.05rem" },
            color: "white",
            position: "relative",
            zIndex: 1,
            filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.22))",
          },
        }}
      >
        <Icon />
      </Box>

      {/* Text */}
      <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: { xs: "1rem", sm: "1.18rem" },
            lineHeight: 1.05,
            color: isDarkMode ? "#f1f5f9" : color,
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {value.toLocaleString()}
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: "0.56rem", sm: "0.62rem" },
            fontWeight: 600,
            color: isDarkMode ? "#94a3b8" : "#475569",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </Typography>
      </Box>
    </Card>
  );
}

// ============================================================
// ModuleSection — full-width card wrapping a module's content
// ============================================================
function ModuleSection({
  icon: Icon,
  title,
  subtitle,
  accentColor,
  gradientFrom,
  gradientTo,
  ctaLabel,
  onCta,
  isDarkMode,
  loading,
  error,
  children,
  quickLinks,
  onNavigate,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  ctaLabel: string;
  onCta: () => void;
  isDarkMode: boolean;
  loading: boolean;
  error: boolean;
  children?: React.ReactNode;
  quickLinks: { label: string; path: string }[];
  onNavigate: (path: string) => void;
}) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        overflow: "hidden",
        border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
        bgcolor: isDarkMode ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.9)",
        backdropFilter: "blur(16px)",
        boxShadow: isDarkMode
          ? `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.04)`
          : `0 4px 20px rgba(0,0,0,0.07), inset 0 1px 1px rgba(255,255,255,0.9)`,
      }}
    >
      {/* ---- Section header band ---- */}
      <Box
        sx={{
          px: { xs: 1.75, md: 2.5 },
          py: { xs: 1.1, md: 1.35 },
          background: isDarkMode
            ? `linear-gradient(135deg, ${gradientFrom}22 0%, ${gradientTo}10 100%)`
            : `linear-gradient(135deg, ${gradientFrom}12 0%, ${gradientTo}06 100%)`,
          borderBottom: `1px solid ${isDarkMode ? `${accentColor}18` : `${accentColor}15`}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        {/* Left: accent bar + icon badge + title */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          {/* Glowing accent bar */}
          <Box
            sx={{
              width: 4,
              height: 36,
              borderRadius: 1,
              background: `linear-gradient(180deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
              flexShrink: 0,
              boxShadow: `0 0 10px ${accentColor}50`,
            }}
          />
          {/* Icon badge */}
          <Box
            sx={{
              width: { xs: 34, sm: 40 },
              height: { xs: 34, sm: 40 },
              borderRadius: 2,
              background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: `0 4px 14px ${accentColor}35`,
            }}
          >
            <Icon sx={{ fontSize: { xs: 18, sm: 20 }, color: "white" }} />
          </Box>
          {/* Title + subtitle */}
          <Box>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: { xs: "0.9rem", sm: "1rem" },
                color: isDarkMode ? "#f1f5f9" : "#1e293b",
                lineHeight: 1.25,
              }}
            >
              {title}
            </Typography>
            <Typography
              sx={{
                fontSize: "0.68rem",
                color: isDarkMode ? "#64748b" : "#94a3b8",
                lineHeight: 1,
              }}
            >
              {subtitle}
            </Typography>
          </Box>
        </Box>

        {/* Right: CTA button */}
        <Button
          size="small"
          variant="contained"
          endIcon={<ArrowForwardIcon sx={{ fontSize: 13 }} />}
          onClick={onCta}
          sx={{
            background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
            color: "white",
            fontWeight: 600,
            fontSize: { xs: "0.68rem", sm: "0.75rem" },
            borderRadius: 2,
            textTransform: "none",
            px: { xs: 1.1, sm: 1.75 },
            py: 0.6,
            flexShrink: 0,
            boxShadow: `0 4px 12px ${accentColor}35`,
            "&:hover": {
              opacity: 0.88,
              boxShadow: `0 6px 18px ${accentColor}45`,
            },
          }}
        >
          {ctaLabel}
        </Button>
      </Box>

      {/* ---- Stats + quick links body ---- */}
      <Box
        sx={{
          px: { xs: 1.75, md: 2.5 },
          py: { xs: 1.5, md: 1.75 },
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        {/* Stats area */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2.5 }}>
            <CircularProgress size={26} sx={{ color: accentColor }} />
          </Box>
        ) : error ? (
          <Box
            sx={{
              textAlign: "center",
              py: 2,
              borderRadius: 2,
              bgcolor: isDarkMode
                ? "rgba(239,68,68,0.08)"
                : "rgba(239,68,68,0.05)",
              border: "1px solid rgba(239,68,68,0.15)",
            }}
          >
            <Typography sx={{ color: "#f87171", fontSize: "0.78rem" }}>
              Could not load data — check connection or refresh
            </Typography>
          </Box>
        ) : (
          children
        )}

        {/* Divider */}
        <Box
          sx={{
            height: 1,
            bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
          }}
        />

        {/* Quick navigation chips */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 0.65,
          }}
        >
          <Typography
            sx={{
              fontSize: "0.62rem",
              fontWeight: 700,
              color: isDarkMode ? "#475569" : "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              mr: 0.25,
            }}
          >
            Go to:
          </Typography>
          {quickLinks.map((lnk) => (
            <Chip
              key={lnk.path}
              label={lnk.label}
              size="small"
              onClick={() => onNavigate(lnk.path)}
              sx={{
                fontSize: "0.7rem",
                height: 24,
                fontWeight: 500,
                cursor: "pointer",
                bgcolor: isDarkMode
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.04)",
                color: isDarkMode
                  ? "rgba(255,255,255,0.65)"
                  : "rgba(0,0,0,0.58)",
                border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.09)"}`,
                transition: "all 0.15s ease",
                "&:hover": {
                  bgcolor: isDarkMode ? `${accentColor}18` : `${accentColor}12`,
                  color: isDarkMode ? "#f1f5f9" : "#1e293b",
                  borderColor: `${accentColor}40`,
                },
                "& .MuiChip-label": { px: 1 },
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// ============================================================
// Main Page Component
// ============================================================
export default function HomePage() {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const { canSeeMenu, isAdmin } = usePermissions();

  const [warehouseName, setWarehouseName] = useState("");
  useEffect(() => {
    if (activeWarehouse?.name) setWarehouseName(activeWarehouse.name);
  }, [activeWarehouse]);

  // ---- RVP Large ----
  const [rvpLoading, setRvpLoading] = useState(false);
  const [rvpError, setRvpError] = useState(false);
  const [rvpMetrics, setRvpMetrics] = useState<any>(null);

  // ---- Non-Large ----
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState(false);
  const [nlKpi, setNlKpi] = useState<any>(null);

  // ---- FSN Scanning ----
  const [fsnLoading, setFsnLoading] = useState(false);
  const [fsnError, setFsnError] = useState(false);
  const [fsnStats, setFsnStats] = useState<{
    sessions: number;
    rows: number;
  } | null>(null);

  // Permission gates (same codes as Sidebar)
  const canSeeRvp = isAdmin || canSeeMenu("menu:dashboard");
  const canSeeNl = isAdmin || canSeeMenu("menu:nl_summary");
  const canSeeFsn = isAdmin || canSeeMenu("menu:fsn_scanning:master_data");

  const loadData = useCallback(() => {
    const wId = activeWarehouse?.id;
    if (!wId) return;

    if (canSeeRvp) {
      setRvpLoading(true);
      setRvpError(false);
      dashboardAPI
        .getInventoryMetrics(wId)
        .then((r) => setRvpMetrics(r.data))
        .catch(() => setRvpError(true))
        .finally(() => setRvpLoading(false));
    }

    if (canSeeNl) {
      setNlLoading(true);
      setNlError(false);
      nlSummaryAPI
        .getSummary({ warehouse_id: wId })
        .then((r) => setNlKpi(r.data?.kpi ?? null))
        .catch(() => setNlError(true))
        .finally(() => setNlLoading(false));
    }

    if (canSeeFsn) {
      setFsnLoading(true);
      setFsnError(false);
      Promise.all([
        fsnScanningAPI.listSessions({ page: 1, limit: 1, warehouseId: wId }),
        fsnScanningAPI.listRows({ page: 1, limit: 1, warehouseId: wId }),
      ])
        .then(([s, r]) =>
          setFsnStats({
            sessions: s.data?.total ?? 0,
            rows: r.data?.total ?? 0,
          }),
        )
        .catch(() => setFsnError(true))
        .finally(() => setFsnLoading(false));
    }
  }, [activeWarehouse?.id, canSeeRvp, canSeeNl, canSeeFsn]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const go = (path: string) => router.push(path);
  const n = (v: any) => Number(v || 0);

  const visibleCount =
    (canSeeRvp ? 1 : 0) + (canSeeNl ? 1 : 0) + (canSeeFsn ? 1 : 0);

  return (
    <AppLayout>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
          background: isDarkMode
            ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)"
            : "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        }}
      >
        <StandardPageHeader
          title="Overview"
          subtitle="All modules at a glance"
          icon="🏠"
          warehouseName={warehouseName}
        />

        {/* Toolbar */}
        <Box
          sx={{
            px: { xs: 1.5, md: 2.5 },
            py: 0.55,
            display: "flex",
            justifyContent: "flex-end",
            flexShrink: 0,
            borderBottom: `1px solid ${isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"}`,
          }}
        >
          <Button
            size="small"
            startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
            onClick={loadData}
            sx={{
              fontSize: "0.74rem",
              textTransform: "none",
              fontWeight: 500,
              color: isDarkMode ? "#94a3b8" : "#64748b",
              borderRadius: 1.75,
              px: 1.4,
              py: 0.35,
              "&:hover": {
                bgcolor: isDarkMode
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
              },
            }}
          >
            Refresh
          </Button>
        </Box>

        {/* Scrollable content */}
        <Box
          sx={{
            flex: 1,
            overflow: "auto",
            px: { xs: 1.25, md: 2.5 },
            py: { xs: 1.5, md: 2 },
          }}
        >
          {visibleCount === 0 ? (
            <Box sx={{ textAlign: "center", py: 10 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: "0.88rem" }}>
                No modules accessible. Contact your administrator.
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: { xs: 1.5, md: 2 },
              }}
            >
              {/* ======================================================== */}
              {/* RVP LARGE */}
              {/* ======================================================== */}
              {canSeeRvp && (
                <ModuleSection
                  icon={RvpLargeIcon}
                  title="RVP Large"
                  subtitle="Item-level Flipkart warehouse operations"
                  accentColor="#3b82f6"
                  gradientFrom="#1e40af"
                  gradientTo="#3b82f6"
                  ctaLabel="Open Dashboard"
                  onCta={() => go("/dashboard")}
                  isDarkMode={isDarkMode}
                  loading={rvpLoading}
                  error={rvpError}
                  quickLinks={[
                    { label: "Inbound", path: "/inbound" },
                    { label: "QC", path: "/qc" },
                    { label: "Picking", path: "/picking" },
                    { label: "Outbound", path: "/outbound" },
                    { label: "Analytics", path: "/reports" },
                    { label: "Rejections", path: "/settings/rejections" },
                    { label: "Master Data", path: "/settings/master-data" },
                  ]}
                  onNavigate={go}
                >
                  {rvpMetrics && (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "repeat(auto-fill, minmax(110px, 1fr))",
                          sm: "repeat(auto-fill, minmax(130px, 1fr))",
                          md: "repeat(7, 1fr)",
                        },
                        gap: { xs: 0.75, sm: 1.1, md: 1.25 },
                      }}
                    >
                      <MetricCard
                        label="Total Items"
                        value={n(rvpMetrics.total)}
                        color="#3b82f6"
                        icon={StorageRounded}
                        isDarkMode={isDarkMode}
                        onClick={() => go("/dashboard")}
                      />
                      <MetricCard
                        label="Inbounded"
                        value={n(rvpMetrics.inbound)}
                        color="#8b5cf6"
                        icon={CallReceivedRounded}
                        isDarkMode={isDarkMode}
                        onClick={() => go("/inbound")}
                      />
                      <MetricCard
                        label="QC Pending"
                        value={n(rvpMetrics.qcPending)}
                        color="#f97316"
                        icon={HourglassEmptyRounded}
                        isDarkMode={isDarkMode}
                        onClick={() => go("/qc")}
                      />
                      <MetricCard
                        label="QC Passed"
                        value={n(rvpMetrics.qcTotal)}
                        color="#10b981"
                        icon={DoneAllRounded}
                        isDarkMode={isDarkMode}
                        onClick={() => go("/qc")}
                      />
                      <MetricCard
                        label="QC Failed"
                        value={n(rvpMetrics.qcFailed)}
                        color="#ef4444"
                        icon={CancelRounded}
                        isDarkMode={isDarkMode}
                        onClick={() => go("/qc")}
                      />
                      <MetricCard
                        label="Picking Done"
                        value={n(rvpMetrics.pickingCompleted)}
                        color="#f59e0b"
                        icon={ShoppingCartRounded}
                        isDarkMode={isDarkMode}
                        onClick={() => go("/picking")}
                      />
                      <MetricCard
                        label="Dispatched"
                        value={n(rvpMetrics.outboundDispatched)}
                        color="#6366f1"
                        icon={LocalShippingRounded}
                        isDarkMode={isDarkMode}
                        onClick={() => go("/outbound")}
                      />
                    </Box>
                  )}
                </ModuleSection>
              )}

              {/* ======================================================== */}
              {/* NON-LARGE (NL) */}
              {/* ======================================================== */}
              {canSeeNl && (
                <ModuleSection
                  icon={NLIcon}
                  title="Non-Large (NL)"
                  subtitle="Box-level inbound & dispatch tracking"
                  accentColor="#06b6d4"
                  gradientFrom="#0e7490"
                  gradientTo="#06b6d4"
                  ctaLabel="Open NL Summary"
                  onCta={() => go("/nl-summary")}
                  isDarkMode={isDarkMode}
                  loading={nlLoading}
                  error={nlError}
                  quickLinks={[
                    { label: "NL OS Data", path: "/nl-fkt-os" },
                    { label: "NL Inbound", path: "/nl-inbound" },
                    { label: "NL Stacking", path: "/nl-stacking" },
                    { label: "NL QC", path: "/nl-qc" },
                    { label: "NL Picking", path: "/nl-picking" },
                    { label: "NL Dispatch", path: "/nl-dispatch" },
                    { label: "NL Billing", path: "/nl-billing" },
                    { label: "NL Discrepancy", path: "/nl-discrepancy" },
                  ]}
                  onNavigate={go}
                >
                  {nlKpi && (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "repeat(auto-fill, minmax(110px, 1fr))",
                          sm: "repeat(auto-fill, minmax(130px, 1fr))",
                          md: "repeat(5, 1fr)",
                        },
                        gap: { xs: 0.75, sm: 1.1, md: 1.25 },
                      }}
                    >
                      <MetricCard
                        label="Received Qty"
                        value={n(nlKpi.total_received_qty)}
                        color="#06b6d4"
                        icon={CallReceivedRounded}
                        isDarkMode={isDarkMode}
                        onClick={() => go("/nl-inbound")}
                      />
                      <MetricCard
                        label="Available"
                        value={n(nlKpi.available_qty)}
                        color="#10b981"
                        icon={InventoryRounded}
                        isDarkMode={isDarkMode}
                        onClick={() => go("/nl-summary")}
                      />
                      <MetricCard
                        label="Dispatched"
                        value={n(nlKpi.dispatched_qty)}
                        color="#8b5cf6"
                        icon={LocalShippingRounded}
                        isDarkMode={isDarkMode}
                        onClick={() => go("/nl-dispatch")}
                      />
                      <MetricCard
                        label="Short Qty"
                        value={n(nlKpi.short_qty)}
                        color="#f59e0b"
                        icon={RemoveCircleRounded}
                        isDarkMode={isDarkMode}
                        onClick={() => go("/nl-summary")}
                      />
                      <MetricCard
                        label="Damaged"
                        value={n(nlKpi.damaged_count)}
                        color="#ef4444"
                        icon={WarningRounded}
                        isDarkMode={isDarkMode}
                        onClick={() => go("/nl-discrepancy")}
                      />
                    </Box>
                  )}
                </ModuleSection>
              )}

              {/* ======================================================== */}
              {/* FSN SCANNING */}
              {/* ======================================================== */}
              {canSeeFsn && (
                <ModuleSection
                  icon={FSNIcon}
                  title="FSN Scanning"
                  subtitle="SKU-level scan sessions & master data"
                  accentColor="#f59e0b"
                  gradientFrom="#78350f"
                  gradientTo="#f59e0b"
                  ctaLabel="Scanned List"
                  onCta={() => go("/fsn-scanning/scanned-list")}
                  isDarkMode={isDarkMode}
                  loading={fsnLoading}
                  error={fsnError}
                  quickLinks={[
                    { label: "Master Data", path: "/fsn-scanning/master-data" },
                    { label: "Entry", path: "/fsn-scanning/entry" },
                  ]}
                  onNavigate={go}
                >
                  {fsnStats && (
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "repeat(2, 1fr)",
                          sm: "repeat(2, minmax(130px, 220px))",
                        },
                        gap: { xs: 0.75, sm: 1.25 },
                      }}
                    >
                      <MetricCard
                        label="Sessions"
                        value={fsnStats.sessions}
                        color="#f59e0b"
                        icon={DateRangeRounded}
                        isDarkMode={isDarkMode}
                        onClick={() => go("/fsn-scanning/entry")}
                      />
                      <MetricCard
                        label="Total Rows"
                        value={fsnStats.rows}
                        color="#10b981"
                        icon={FormatListBulletedRounded}
                        isDarkMode={isDarkMode}
                        onClick={() => go("/fsn-scanning/scanned-list")}
                      />
                    </Box>
                  )}
                </ModuleSection>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </AppLayout>
  );
}
