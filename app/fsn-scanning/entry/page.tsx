"use client";
// File Path = wms_frontend/app/fsn-scanning/entry/page.tsx
// FSN Level Scanning — Entry / Multi-entry scanning page
// Mandatory: Date + Customer Name before scanning grid is active
// AG Grid multi-entry: lookup by WID/FSN/EAN/SAP, auto-fill product fields

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Autocomplete,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  Switch,
  useTheme,
  Divider,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Send as SendIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  ClearAll as ClearAllIcon,
  ViewColumn as ViewColumnIcon,
  FileDownload as ExportIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import { fsnMasterAPI, fsnScanningAPI, fsnConfigAPI } from "@/lib/fsn-api";
import { customerAPI } from "@/lib/api";
import { useNlGridSx } from "@/lib/nl-utils";
import { useWarehouse } from "@/app/context/WarehouseContext";
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

// ─── Column definitions ───────────────────────────────────────────────────────
// User-editable columns — drives Enter-key navigation order
// EAN and SAP appear right after the lookup so the scanner can capture them immediately
const USER_INPUT_COLS = [
  "lookup_input", // Scan / type WID, FSN, EAN, or SAP
  "ean", // Scan EAN barcode (auto-filled from master if available)
  "sap_sku", // Scan SAP/SKU (auto-filled from master if available)
  "mrp",
  "fsp",
  "quantity",
  "inventory_type",
  "remarks",
];
// EAN/SAP are user-input columns but also auto-filled — styled with amber border
const EDITABLE_AUTO_STYLED = ["ean", "sap_sku"];
// Auto-filled read-only — core product data pulled from master data
const READONLY_AUTO_COLS = [
  "wid",
  "fsn",
  "product_title",
  "brand",
  "cms_vertical",
  "mega_category",
];
const AUTO_COLS = READONLY_AUTO_COLS; // ean/sap_sku moved to user input
// Enter-key: lookup_input → ean → sap_sku → mrp → fsp → quantity → inventory_type → remarks → next row
const ALL_GRID_COLS = [...USER_INPUT_COLS, ...AUTO_COLS];

const DEFAULT_INVENTORY_TYPES = ["NEW", "RVP", "Other"];
const DRAFT_KEY = "fsn_entry_draft";

const HEADER_LABELS: Record<string, string> = {
  lookup_input: "Scan / Lookup (WID / FSN / EAN / SAP)",
  mrp: "MRP",
  fsp: "FSP",
  quantity: "Qty",
  inventory_type: "Inventory Type",
  remarks: "Remarks",
  wid: "WID",
  fsn: "FSN",
  product_title: "Product Title",
  brand: "Brand",
  cms_vertical: "CMS Vertical",
  mega_category: "Mega Category",
  ean: "EAN/ENA",
  sap_sku: "SAP/SKU",
};

export default function FSNEntryPage() {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const { activeWarehouse } = useWarehouse();
  const tableRowHeight = useTableRowHeight();
  const { canSeeButton } = usePagePermissions("fsn_scanning_entry");

  // ── Customer list (from existing customers table) ────────────────────────
  const [customers, setCustomers] = useState<string[]>([]);

  useEffect(() => {
    if (!activeWarehouse?.id) return;
    customerAPI
      .getNames(activeWarehouse.id)
      .then((res: any) => {
        const list: any[] = Array.isArray(res.data) ? res.data : [];
        const names = list
          .map((c: any) =>
            typeof c === "string" ? c : c.name || c.customer_name || "",
          )
          .filter(Boolean);
        setCustomers(names);
      })
      .catch(() => {}); // silently ignore — still lets user type manually
  }, [activeWarehouse?.id]);

  // ── Mandatory header fields ────────────────────────────────────────────────
  const [scanDate, setScanDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [customerName, setCustomerName] = useState("");
  const scanDateInputRef = useRef<HTMLInputElement | null>(null);

  // grid is only active when both are filled
  const headerReady = scanDate !== "" && customerName.trim() !== "";

  // ── Grid state ─────────────────────────────────────────────────────────────
  const gridRef = useRef<any>(null);
  const rowIdCounterRef = useRef(0);
  const [rows, setRows] = useState<any[]>([]);
  const rowsRef = useRef<any[]>([]);
  rowsRef.current = rows;
  const pendingLookupsRef = useRef<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [conflictErrors, setConflictErrors] = useState<string[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);

  // ── Inventory types (default + user-defined, persisted in DB) ────
  const [inventoryTypes, setInventoryTypes] = useState<string[]>(
    DEFAULT_INVENTORY_TYPES,
  );
  const [newInvType, setNewInvType] = useState("");

  // Load custom types from DB on mount
  useEffect(() => {
    fsnConfigAPI
      .getInventoryTypes()
      .then((res: any) => {
        const custom: string[] = res.data?.types || [];
        if (custom.length > 0) {
          setInventoryTypes([
            ...new Set([...DEFAULT_INVENTORY_TYPES, ...custom]),
          ]);
        }
      })
      .catch(() => {}); // silently ignore — built-in defaults still available
  }, []);

  const addInventoryType = async () => {
    const t = newInvType.trim();
    if (!t || inventoryTypes.includes(t)) {
      setNewInvType("");
      return;
    }
    const updated = [...inventoryTypes, t];
    setInventoryTypes(updated);
    const custom = updated.filter((x) => !DEFAULT_INVENTORY_TYPES.includes(x));
    try {
      await fsnConfigAPI.saveInventoryTypes(custom);
    } catch {} // silently ignore — types are still updated in local state
    setNewInvType("");
    toast.success(`Added "${t}" to inventory types`);
  };

  const removeInventoryType = async (t: string) => {
    if (DEFAULT_INVENTORY_TYPES.includes(t)) {
      toast.error("Cannot remove built-in types");
      return;
    }
    const updated = inventoryTypes.filter((x) => x !== t);
    setInventoryTypes(updated);
    const custom = updated.filter((x) => !DEFAULT_INVENTORY_TYPES.includes(x));
    try {
      await fsnConfigAPI.saveInventoryTypes(custom);
    } catch {} // silently ignore
  };

  // ── Column visibility ──────────────────────────────────────────────────────
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const s = localStorage.getItem("fsn_entry_visible_cols");
        return s ? JSON.parse(s) : ALL_GRID_COLS;
      } catch {
        return ALL_GRID_COLS;
      }
    }
    return ALL_GRID_COLS;
  });

  // ── Settings drawer ────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState<string | false>(
    "columns",
  );
  const [gridSettings, setGridSettings] = useState({
    sortable: false,
    filter: false,
    resizable: true,
  });

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const gridSx = useNlGridSx(isDarkMode, {
    headerBg: "#1e3a5f",
    headerBorder: "#f59e0b",
    headerBorderLight: "#d97706",
    headerCellBorder: "#374151",
    hoverBg: "rgba(245, 158, 11, 0.12)",
    hoverBgLight: "#fffbeb",
    focusBorder: "#f59e0b",
    focusBorderLight: "#d97706",
    rangeBg: "rgba(245, 158, 11, 0.2)",
    rangeBgLight: "#fef3c7",
  });

  // ── Row generation ─────────────────────────────────────────────────────────
  const generateEmptyRows = useCallback((count: number) => {
    return Array.from({ length: count }, () => {
      rowIdCounterRef.current += 1;
      return {
        _rowId: `row_${rowIdCounterRef.current}_${Date.now()}`,
        _found: false,
        _error: undefined as string | undefined,
        _master_id: null as number | null,
        _lookup_type: null as string | null,
        lookup_input: "",
        mrp: null as number | null,
        fsp: null as number | null,
        quantity: null as number | null,
        inventory_type: "",
        remarks: "",
        wid: "",
        fsn: "",
        product_title: "",
        brand: "",
        cms_vertical: "",
        mega_category: "",
        ean: "",
        sap_sku: "",
      };
    });
  }, []);

  // ── Init: restore draft ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.rows?.length > 0) {
          const restored = draft.rows.map((r: any) => {
            rowIdCounterRef.current += 1;
            return {
              _rowId: `row_${rowIdCounterRef.current}_${Date.now()}`,
              ...r,
            };
          });
          const padding = generateEmptyRows(
            Math.max(500 - restored.length, 100),
          );
          setRows([...restored, ...padding]);
          if (draft.scanDate) setScanDate(draft.scanDate);
          if (draft.customerName) setCustomerName(draft.customerName);
          setDraftLoaded(true);
          setTimeout(
            () =>
              toast.success(`Draft restored: ${draft.rows.length} rows`, {
                duration: 3000,
              }),
            500,
          );
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setRows(generateEmptyRows(500));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save draft ────────────────────────────────────────────────────────
  const saveDraftRef = useRef<(() => void) | undefined>(undefined);
  saveDraftRef.current = () => {
    const filled = rows.filter((r) => r.lookup_input?.trim());
    if (filled.length === 0) {
      localStorage.removeItem(DRAFT_KEY);
      setDraftLoaded(false);
      return;
    }
    const draftData = {
      rows: filled.map(({ _rowId, ...rest }) => rest),
      scanDate,
      customerName,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
      setDraftLoaded(true);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const timer = setInterval(() => saveDraftRef.current?.(), 10000);
    return () => clearInterval(timer);
  }, []);

  const saveDraftNow = useCallback(() => {
    saveDraftRef.current?.();
    toast.success("Draft saved", { duration: 1500 });
  }, []);

  const clearGrid = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setRows(generateEmptyRows(500));
    setDraftLoaded(false);
    toast.success("Grid cleared", { duration: 1500 });
  }, [generateEmptyRows]);

  // ── Lookup ────────────────────────────────────────────────────────────────
  const lookupProduct = useCallback(
    async (lookupValue: string, rowIndex: number) => {
      const q = lookupValue.trim();
      if (!q || q.length < 2) return;
      const key = `${rowIndex}_${q.toUpperCase()}`;
      if (pendingLookupsRef.current.has(key)) return;
      pendingLookupsRef.current.add(key);

      try {
        const res = await fsnMasterAPI.lookup(q);
        const { found, matched_by, data } = res.data;
        const currentRow = rowsRef.current[rowIndex];
        if (!currentRow) return;

        if (found && data) {
          const updatedRow = {
            ...currentRow,
            _found: true,
            _error: undefined,
            _master_id: data.id,
            _lookup_type: matched_by,
            wid: data.wid || "",
            fsn: data.fsn || "",
            product_title: data.product_title || "",
            brand: data.brand || "",
            cms_vertical: data.cms_vertical || "",
            mega_category: data.mega_category || "",
            // If master had no EAN but we matched BY ean, keep the scanned value
            ean: data.ean || (matched_by === "ean" ? q : ""),
            // If master had no SAP but we matched BY sap_sku, keep the scanned value
            sap_sku: data.sap_sku || (matched_by === "sap_sku" ? q : ""),
          };
          setRows((prev) => {
            const u = [...prev];
            u[rowIndex] = updatedRow;
            return u;
          });
          setTimeout(() => {
            const api = gridRef.current?.api;
            if (api) {
              const node = api.getRowNode(updatedRow._rowId);
              if (node) api.refreshCells({ rowNodes: [node], force: true });
              // Only auto-move focus to mrp if focus is STILL on this row's
              // lookup_input (i.e. scanner fired lookup without an Enter key press).
              // If Enter key was pressed first, focus is already on mrp — don't disrupt.
              const focused = api.getFocusedCell();
              const stillOnLookup =
                focused?.rowIndex === rowIndex &&
                focused?.column?.getColId?.() === "lookup_input";
              if (stillOnLookup) {
                api.setFocusedCell(rowIndex, "mrp");
                setTimeout(
                  () => api.startEditingCell({ rowIndex, colKey: "mrp" }),
                  50,
                );
              }
            }
          }, 80);
        } else {
          setRows((prev) => {
            const u = [...prev];
            if (u[rowIndex])
              u[rowIndex] = {
                ...u[rowIndex],
                _found: false,
                _error: "Not found in master data",
              };
            return u;
          });
        }
      } catch {
        setRows((prev) => {
          const u = [...prev];
          if (u[rowIndex])
            u[rowIndex] = {
              ...u[rowIndex],
              _found: false,
              _error: "Lookup failed",
            };
          return u;
        });
      } finally {
        pendingLookupsRef.current.delete(key);
      }
    },
    [],
  );

  // ── Cell value changed ─────────────────────────────────────────────────────
  const handleCellValueChanged = useCallback(
    (event: any) => {
      const { colDef, rowIndex, newValue } = event;
      const field = colDef?.field;
      if (!field) return;

      const processed =
        typeof newValue === "string" ? newValue.toUpperCase() : newValue;

      setRows((prev) => {
        const u = [...prev];
        u[rowIndex] = { ...u[rowIndex], [field]: processed };
        return u;
      });

      if (field === "lookup_input" && processed?.trim()) {
        lookupProduct(processed, rowIndex);
      }

      // Extend grid if near end
      if (rowIndex >= rowsRef.current.length - 5) {
        setRows((prev) => [...prev, ...generateEmptyRows(500)]);
      }
    },
    [lookupProduct, generateEmptyRows],
  );

  // ── Enter key navigation ───────────────────────────────────────────────────
  // Uses the double-timeout pattern (matches NL Inbound page) for reliable
  // focus transitions — setFocusedCell first, then startEditingCell 50ms later.
  const suppressKeyboardEvent = useCallback(
    (params: any) => {
      const { colDef, event, editing, node } = params;
      const field = colDef?.field;
      const rowIndex = node?.rowIndex;

      if (editing && event.key === "Enter") {
        params.api.stopEditing();

        const nav = (nextCol: string, nextRow = rowIndex) => {
          params.api.setFocusedCell(nextRow, nextCol);
          setTimeout(
            () =>
              params.api.startEditingCell({
                rowIndex: nextRow,
                colKey: nextCol,
              }),
            50,
          );
        };

        if (field === "lookup_input") {
          // Trigger lookup in background, move focus to EAN immediately
          const val = node?.data?.lookup_input?.trim();
          if (val) setTimeout(() => lookupProduct(val, rowIndex), 100);
          nav("ean");
        } else if (field === "ean") {
          nav("sap_sku");
        } else if (field === "sap_sku") {
          nav("mrp");
        } else if (field === "mrp") {
          nav("fsp");
        } else if (field === "fsp") {
          nav("quantity");
        } else if (field === "quantity") {
          nav("inventory_type");
        } else if (field === "inventory_type") {
          nav("remarks");
        } else if (field === "remarks") {
          setTimeout(() => nav("lookup_input", rowIndex + 1), 20);
        }
        return true;
      }
      return false;
    },
    [lookupProduct],
  );

  // ── Delete row ─────────────────────────────────────────────────────────────
  const handleDeleteRow = useCallback((rowIndex: number) => {
    rowIdCounterRef.current += 1;
    setRows((prev) => {
      const u = [...prev];
      u[rowIndex] = {
        _rowId: `row_${rowIdCounterRef.current}_${Date.now()}`,
        _found: false,
        _error: undefined,
        _master_id: null,
        _lookup_type: null,
        lookup_input: "",
        mrp: null,
        fsp: null,
        quantity: null,
        inventory_type: "",
        remarks: "",
        wid: "",
        fsn: "",
        product_title: "",
        brand: "",
        cms_vertical: "",
        mega_category: "",
        ean: "",
        sap_sku: "",
      };
      return u;
    });
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const filledRows = useMemo(
    () => rows.filter((r) => r.lookup_input?.trim()),
    [rows],
  );

  const handleSubmit = async () => {
    if (!activeWarehouse?.id) {
      toast.error("No active warehouse");
      return;
    }
    if (filledRows.length === 0) {
      toast.error("No rows to submit");
      return;
    }
    if (!headerReady) {
      toast.error("Date and Customer Name are required");
      return;
    }

    try {
      setSubmitting(true);
      setConflictErrors([]);

      const payload = filledRows.map((r) => ({
        lookup_value: r.lookup_input?.trim() || null,
        lookup_type: r._lookup_type || "unknown",
        master_id: r._master_id,
        wid: r.wid || null,
        fsn: r.fsn || null,
        product_title: r.product_title || null,
        brand: r.brand || null,
        cms_vertical: r.cms_vertical || null,
        mega_category: r.mega_category || null,
        ean: r.ean || null,
        sap_sku: r.sap_sku || null,
        mrp: r.mrp ? parseFloat(r.mrp) : null,
        fsp: r.fsp ? parseFloat(r.fsp) : null,
        quantity: parseInt(r.quantity, 10) || 1,
        inventory_type: r.inventory_type || null,
        remarks: r.remarks || null,
      }));

      const res = await fsnScanningAPI.submitSession({
        session_date: scanDate,
        customer_name: customerName.trim(),
        warehouse_id: activeWarehouse.id,
        rows: payload,
      });

      setLastBatchId(res.data.session_id);
      toast.success(
        `✅ Submitted ${res.data.total_rows} rows — Batch: ${res.data.session_id}`,
        { duration: 6000 },
      );
      // Clear grid + draft
      setRows(generateEmptyRows(500));
      localStorage.removeItem(DRAFT_KEY);
      setDraftLoaded(false);
      setSubmitDialogOpen(false);
    } catch (err: any) {
      const errData = err?.response?.data;
      if (err?.response?.status === 409 && errData?.conflicts) {
        setConflictErrors(errData.conflicts);
        setSubmitDialogOpen(false);
        toast.error("Identifier conflict detected. See details above.");
      } else {
        toast.error(errData?.error || err?.message || "Submit failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Excel export ───────────────────────────────────────────────────────────
  const exportToExcel = async () => {
    if (filledRows.length === 0) {
      toast.error("No data to export");
      return;
    }
    const XLSX = await import("xlsx");
    const ed = filledRows.map((r) => ({
      "Lookup Input": r.lookup_input,
      WID: r.wid,
      FSN: r.fsn,
      "Product Title": r.product_title,
      Brand: r.brand,
      "CMS Vertical": r.cms_vertical,
      "Mega Category": r.mega_category,
      "EAN/ENA": r.ean,
      "SAP/SKU": r.sap_sku,
      MRP: r.mrp,
      FSP: r.fsp,
      Qty: r.quantity,
      "Inventory Type": r.inventory_type,
      Remarks: r.remarks,
    }));
    const ws = XLSX.utils.json_to_sheet(ed);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FSN Entry");
    XLSX.writeFile(wb, `FSN_Entry_${scanDate}_${customerName || "data"}.xlsx`);
  };

  // ── Column defs ────────────────────────────────────────────────────────────
  const columnDefs = useMemo(() => {
    const cols: any[] = [
      {
        headerName: "#",
        valueGetter: (p: any) =>
          p.node?.rowIndex != null ? p.node.rowIndex + 1 : "",
        width: 50,
        pinned: "left",
        sortable: false,
        filter: false,
        editable: false,
        cellStyle: {
          color: "#64748b",
          fontSize: "0.75rem",
          textAlign: "center",
        },
      },
    ];

    visibleColumns.forEach((col) => {
      const isUser = USER_INPUT_COLS.includes(col);
      const colDef: any = {
        field: col,
        headerName: HEADER_LABELS[col] || col,
        minWidth:
          col === "lookup_input"
            ? 200
            : col === "product_title"
              ? 180
              : col === "remarks"
                ? 140
                : 100,
        flex: ["product_title", "remarks"].includes(col) ? 2 : 1,
        suppressKeyboardEvent,
        editable: isUser && headerReady,
      };

      if (col === "inventory_type") {
        colDef.cellEditor = "agSelectCellEditor";
        colDef.cellEditorParams = { values: ["", ...inventoryTypes] };
      }
      if (["mrp", "fsp"].includes(col)) {
        colDef.type = "numericColumn";
      }
      const isEditableAuto = EDITABLE_AUTO_STYLED.includes(col);
      if (isEditableAuto) {
        // EAN / SAP: editable even though auto-filled
        colDef.editable = headerReady;
        colDef.cellStyle = (p: any) => ({
          color: p.value ? (isDarkMode ? "#fbbf24" : "#b45309") : "#9ca3af",
          fontStyle: p.value ? "normal" : "italic",
          borderLeft: "2px dashed #f59e0b",
        });
      }
      if (!isUser && !isEditableAuto) {
        colDef.cellStyle = (p: any) => ({
          color: p.data?._found
            ? isDarkMode
              ? "#94a3b8"
              : "#475569"
            : "#9ca3af",
          fontStyle: p.data?._found ? "normal" : "italic",
        });
      }
      if (col === "lookup_input") {
        colDef.cellStyle = (p: any) => {
          if (p.data?._found) return { color: "#10b981", fontWeight: 600 };
          if (p.data?._error && p.data?.lookup_input)
            return { color: "#ef4444" };
          return null;
        };
      }
      cols.push(colDef);
    });

    // Status column
    cols.push({
      headerName: "✓",
      width: 45,
      sortable: false,
      filter: false,
      editable: false,
      cellRenderer: (params: any) => {
        if (params.data._found)
          return <CheckCircleIcon sx={{ color: "#10b981", fontSize: 16 }} />;
        if (params.data._error && params.data.lookup_input) {
          return (
            <Tooltip title={params.data._error}>
              <WarningIcon
                sx={{ color: "#f59e0b", fontSize: 16, cursor: "help" }}
              />
            </Tooltip>
          );
        }
        return null;
      },
    });

    // Delete column
    cols.push({
      headerName: "",
      width: 40,
      sortable: false,
      filter: false,
      editable: false,
      cellRenderer: (params: any) => {
        if (!params.data.lookup_input?.trim()) return null;
        return (
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeleteRow(params.node.rowIndex)}
          >
            <DeleteIcon sx={{ fontSize: 15 }} />
          </IconButton>
        );
      },
    });

    return cols;
  }, [
    visibleColumns,
    suppressKeyboardEvent,
    handleDeleteRow,
    isDarkMode,
    headerReady,
    inventoryTypes,
  ]);

  const defaultColDef = useMemo(
    () => ({
      sortable: gridSettings.sortable,
      filter: gridSettings.filter,
      resizable: gridSettings.resizable,
      suppressMovable: true,
    }),
    [gridSettings],
  );

  const toggleColumn = (col: string) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col];
      localStorage.setItem("fsn_entry_visible_cols", JSON.stringify(next));
      return next;
    });
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
    setIsFullscreen(!isFullscreen);
  };

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
        ref={containerRef}
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
          title="FSN Level Scanning — Entry"
          subtitle="Scan products by any identifier; auto-fill from master data"
          icon="🔍"
          warehouseName={activeWarehouse?.name}
        />

        {/* ── Header bar ── */}
        <Paper
          sx={{
            p: 1.5,
            mb: 0.5,
            borderRadius: 0,
            borderBottom: `2px solid ${headerReady ? "#10b981" : "#f59e0b"}`,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
            flexWrap="wrap"
          >
            {/* Mandatory fields */}
            <TextField
              size="small"
              label="Scan Date"
              type="date"
              value={scanDate}
              onChange={(e) => setScanDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputRef={scanDateInputRef}
              onClick={() => {
                scanDateInputRef.current?.focus();
                scanDateInputRef.current?.showPicker?.();
              }}
              onFocus={() => {
                scanDateInputRef.current?.showPicker?.();
              }}
              sx={{
                width: { xs: "100%", sm: 170 },
                "& .MuiInputBase-root": { cursor: "pointer" },
                "& input": { cursor: "pointer" },
              }}
            />
            <Autocomplete
              freeSolo
              size="small"
              options={customers}
              value={customerName}
              inputValue={customerName}
              onInputChange={(_, val) => setCustomerName(val ?? "")}
              sx={{ width: { xs: "100%", sm: 250 } }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Customer Name *"
                  placeholder="Select or type customer…"
                  error={!headerReady && customerName === ""}
                />
              )}
            />

            {/* Status chips */}
            {!headerReady && (
              <Chip
                label="Fill Date & Customer to start scanning"
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
            {headerReady && filledRows.length > 0 && (
              <Chip
                label={`${filledRows.length} row${filledRows.length !== 1 ? "s" : ""} entered`}
                size="small"
                color="success"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            )}
            {draftLoaded && (
              <Chip
                label="Draft saved"
                size="small"
                color="info"
                variant="outlined"
                icon={<SaveIcon sx={{ fontSize: 14 }} />}
              />
            )}

            <Box sx={{ flex: 1 }} />

            {/* Actions */}
            <Stack direction="row" spacing={0.5} alignItems="center">
              {filledRows.length > 0 && (
                <>
                  <Tooltip title="Save Draft">
                    <IconButton
                      aria-label="Save Draft"
                      size="small"
                      onClick={saveDraftNow}
                      color="info"
                    >
                      <SaveIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Clear Grid">
                    <IconButton
                      aria-label="Clear Grid"
                      size="small"
                      onClick={clearGrid}
                      color="warning"
                    >
                      <ClearAllIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
              <Button
                variant="outlined"
                size="small"
                onClick={() =>
                  setRows((prev) => [...prev, ...generateEmptyRows(500)])
                }
                sx={{ height: 32, textTransform: "none", fontWeight: 600 }}
              >
                +500 Rows
              </Button>
              <IconButton
                aria-label="Settings"
                size="small"
                onClick={() => setSettingsOpen(true)}
              >
                <SettingsIcon />
              </IconButton>
              <IconButton
                aria-label="Fullscreen"
                size="small"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Stack>
          </Stack>

          {/* Conflict errors */}
          {conflictErrors.length > 0 && (
            <Alert
              severity="error"
              sx={{ mt: 1.5 }}
              onClose={() => setConflictErrors([])}
            >
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
                Identifier Conflict Detected — Fix before submitting:
              </Typography>
              {conflictErrors.map((c, i) => (
                <Typography key={i} variant="body2">
                  • {c}
                </Typography>
              ))}
            </Alert>
          )}

          {!headerReady && (
            <Alert severity="info" sx={{ mt: 1, py: 0.5 }}>
              Please fill in <strong>Scan Date</strong> and{" "}
              <strong>Customer Name</strong> before scanning. The grid is
              read-only until both are filled.
            </Alert>
          )}
        </Paper>

        {lastBatchId && (
          <Box sx={{ px: 1, pt: 0.5 }}>
            <Alert
              severity="success"
              onClose={() => setLastBatchId(null)}
              sx={{ py: 0.5 }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                Last Submitted Batch ID:&nbsp;
                <span style={{ fontFamily: "monospace" }}>{lastBatchId}</span>
              </Typography>
            </Alert>
          </Box>
        )}

        {/* ── AG Grid ── */}
        <Box sx={{ flex: 1, minHeight: 0, px: { xs: 0.5, sm: 1 }, pb: 0.5 }}>
          <Box
            className="ag-theme-quartz"
            sx={{ ...gridSx, height: "100%", width: "100%" }}
          >
            <AgGridReact
              ref={gridRef}
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              rowHeight={tableRowHeight}
              headerHeight={40}
              animateRows={false}
              getRowId={(params: any) => params.data._rowId}
              onCellValueChanged={handleCellValueChanged}
              suppressCellFocus={false}
              singleClickEdit
              stopEditingWhenCellsLoseFocus
              rowBuffer={20}
              suppressScrollOnNewData
              debounceVerticalScrollbar
              valueCache
              containerStyle={{
                height: "100%",
                width: "100%",
                backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
              }}
              enterNavigatesVertically
              enterNavigatesVerticallyAfterEdit
            />
          </Box>
        </Box>

        {/* ── Footer bar ── */}
        <Paper
          sx={{
            p: 1,
            mx: { xs: 0.5, sm: 1 },
            mb: 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 2,
            bgcolor: isDarkMode ? "#1e293b" : "#f1f5f9",
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: filledRows.length > 0 ? "text.primary" : "text.secondary",
            }}
          >
            {filledRows.length > 0
              ? `${filledRows.length} row${filledRows.length !== 1 ? "s" : ""} ready — ${filledRows.filter((r) => r._found).length} matched in master`
              : "No data entered yet — scan or type any identifier in the first column"}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {filledRows.length > 0 && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<ClearAllIcon />}
                onClick={clearGrid}
                sx={{ textTransform: "none" }}
              >
                Clear
              </Button>
            )}
            {canSeeButton("submit") && (
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<SendIcon />}
                onClick={() => setSubmitDialogOpen(true)}
                disabled={filledRows.length === 0 || submitting || !headerReady}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                Submit All
              </Button>
            )}
          </Stack>
        </Paper>
      </Box>

      {/* ── Submit Dialog ── */}
      <Dialog
        open={submitDialogOpen}
        onClose={() => setSubmitDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Submit FSN Scanning Session?</DialogTitle>
        <DialogContent>
          <Typography>
            Submit <strong>{filledRows.length} rows</strong> for customer{" "}
            <strong>{customerName}</strong> on <strong>{scanDate}</strong>?
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
            A Session ID will be auto-generated. New EAN/SAP values will be
            saved back to master data automatically.
          </Typography>
          {filledRows.some((r) => !r._found) && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {filledRows.filter((r) => !r._found).length} row(s) were not
              matched in master data and will be saved as-is.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSubmit}
            disabled={submitting}
            startIcon={
              submitting ? <CircularProgress size={16} /> : <SendIcon />
            }
          >
            {submitting ? "Submitting…" : "Confirm Submit"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Settings Drawer ── */}
      <Drawer
        anchor="right"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 360 } } }}
      >
        <Box
          sx={{
            p: 2,
            background: "linear-gradient(135deg, #1e40af, #3b82f6)",
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
            Options Panel
          </Typography>
          <IconButton
            onClick={() => setSettingsOpen(false)}
            sx={{ color: "white" }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ overflow: "auto", flex: 1, p: 1 }}>
          <Accordion
            expanded={settingsExpanded === "columns"}
            onChange={(_, exp) => setSettingsExpanded(exp ? "columns" : false)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ViewColumnIcon fontSize="small" color="primary" />
                <Typography sx={{ fontWeight: 600 }}>
                  Columns ({visibleColumns.length}/{ALL_GRID_COLS.length})
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", mb: 1, display: "block" }}
              >
                User-input columns
              </Typography>
              {USER_INPUT_COLS.map((col) => (
                <FormControlLabel
                  key={col}
                  control={
                    <Checkbox
                      checked={visibleColumns.includes(col)}
                      onChange={() => toggleColumn(col)}
                      size="small"
                    />
                  }
                  label={HEADER_LABELS[col] || col}
                  sx={{ display: "block", ml: 0 }}
                />
              ))}
              <Divider sx={{ my: 1 }} />
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", mb: 1, display: "block" }}
              >
                Auto-filled (read-only) columns
              </Typography>
              {AUTO_COLS.map((col) => (
                <FormControlLabel
                  key={col}
                  control={
                    <Checkbox
                      checked={visibleColumns.includes(col)}
                      onChange={() => toggleColumn(col)}
                      size="small"
                    />
                  }
                  label={HEADER_LABELS[col] || col}
                  sx={{ display: "block", ml: 0 }}
                />
              ))}
            </AccordionDetails>
          </Accordion>

          <Accordion
            expanded={settingsExpanded === "grid"}
            onChange={(_, exp) => setSettingsExpanded(exp ? "grid" : false)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 600 }}>Grid Settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Switch
                    checked={gridSettings.sortable}
                    onChange={(e) =>
                      setGridSettings((p) => ({
                        ...p,
                        sortable: e.target.checked,
                      }))
                    }
                  />
                }
                label="Enable Sorting"
                sx={{ display: "block" }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={gridSettings.filter}
                    onChange={(e) =>
                      setGridSettings((p) => ({
                        ...p,
                        filter: e.target.checked,
                      }))
                    }
                  />
                }
                label="Enable Filtering"
                sx={{ display: "block" }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={gridSettings.resizable}
                    onChange={(e) =>
                      setGridSettings((p) => ({
                        ...p,
                        resizable: e.target.checked,
                      }))
                    }
                  />
                }
                label="Column Resize"
                sx={{ display: "block" }}
              />
            </AccordionDetails>
          </Accordion>

          <Accordion
            expanded={settingsExpanded === "invtypes"}
            onChange={(_, exp) => setSettingsExpanded(exp ? "invtypes" : false)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 600 }}>Inventory Types</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1 }}
              >
                Add custom types to the dropdown. Built-in types cannot be
                removed.
              </Typography>
              <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                {inventoryTypes.map((t) => (
                  <Stack
                    key={t}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="body2">{t}</Typography>
                    {!DEFAULT_INVENTORY_TYPES.includes(t) && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeInventoryType(t)}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                  </Stack>
                ))}
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  placeholder="New type…"
                  value={newInvType}
                  onChange={(e) => setNewInvType(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addInventoryType();
                  }}
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={addInventoryType}
                  disabled={!newInvType.trim()}
                >
                  Add
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion
            expanded={settingsExpanded === "actions"}
            onChange={(_, exp) => setSettingsExpanded(exp ? "actions" : false)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 600 }}>Actions</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {canSeeButton("export") && (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<ExportIcon />}
                  onClick={exportToExcel}
                  disabled={filledRows.length === 0}
                >
                  Export Grid to Excel
                </Button>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>
      </Drawer>
    </AppLayout>
  );
}
