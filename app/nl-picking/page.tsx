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
  Card,
  CardContent,
  useMediaQuery,
  useTheme,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  LinearProgress,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
  Delete as DeleteIcon,
  Cancel as CancelIcon,
  PlaylistAdd as PlaylistAddIcon,
  Inventory as InventoryIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  ContentPasteGo as PasteIcon,
  UploadFile as UploadFileIcon,
} from "@mui/icons-material";
import * as XLSX from "xlsx";
import { nlPicklistAPI, nlPickingAPI } from "@/lib/nl-api";
import { useNlGridSx, nlFormatDate } from "@/lib/nl-utils";
import { customerAPI } from "@/lib/api";
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

const formatDate = nlFormatDate;

const STATUS_COLORS: Record<
  string,
  "success" | "warning" | "error" | "info" | "default"
> = {
  active: "info",
  partial: "warning",
  completed: "success",
  cancelled: "error",
  fulfilled: "success",
  pending: "default",
};

const ALL_TABS = ["Picklist", "Picking", "Picking List", "History"];
const TAB_CODES = ["picklist", "picking", "picking_list", "history"];

export default function NLPickingPage() {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);
  const tableRowHeight = useTableRowHeight();
  const { filterTabs, canSeeButton, canSeeTab, isAdmin } =
    usePagePermissions("nl_picking");

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
  const currentTabCode = visibleTabCodes[tabValue] || "picklist";
  // ====== PICKLIST STATE ======
  const [customers, setCustomers] = useState<any[]>([]);
  const [plCustomerId, setPlCustomerId] = useState<number | "">("");
  const [plRemarks, setPlRemarks] = useState("");
  const [plItems, setPlItems] = useState<
    { vrp_id: string; required_qty: number }[]
  >([{ vrp_id: "", required_qty: 1 }]);
  const [plCreating, setPlCreating] = useState(false);
  const [picklists, setPicklists] = useState<any[]>([]);
  const [plLoading, setPlLoading] = useState(false);
  const [plStatusFilter, setPlStatusFilter] = useState("active");
  // Expanded picklist detail
  const [expandedPl, setExpandedPl] = useState<any>(null);
  const [expandedPlItems, setExpandedPlItems] = useState<any[]>([]);
  const [expandedLoading, setExpandedLoading] = useState(false);

  // ====== PICKING STATE ======
  const [pickSessionId, setPickSessionId] = useState<string | null>(null);
  const [pickPicklistId, setPickPicklistId] = useState<string>("");
  const [pickEntries, setPickEntries] = useState<any[]>([]);
  const [pickTotals, setPickTotals] = useState({
    total_boxes: 0,
    total_qty: 0,
  });
  const [pickLoading, setPickLoading] = useState(false);
  const [pickSubmitting, setPickSubmitting] = useState(false);
  const [pickSubmitDialogOpen, setPickSubmitDialogOpen] = useState(false);
  const [discardPickingDialogOpen, setDiscardPickingDialogOpen] =
    useState(false);
  const [cancelPicklistTargetId, setCancelPicklistTargetId] = useState<
    string | null
  >(null);
  // Pick guide
  const [pickGuide, setPickGuide] = useState<any>(null);
  const [pickGuideLoading, setPickGuideLoading] = useState(false);
  // Active picklists for dropdown
  const [activePicklists, setActivePicklists] = useState<any[]>([]);

  // ====== MULTI-ENTRY PICKING GRID ======
  const pickGridRef = useRef<any>(null);
  const pickRowIdCounterRef = useRef(0);
  const pickRowsRef = useRef<any[]>([]);
  const pickPendingScansRef = useRef(new Set<string>());
  const [pickRows, setPickRows] = useState<any[]>([]);

  const generatePickEmptyRows = useCallback((count: number) => {
    return Array.from({ length: count }, () => {
      pickRowIdCounterRef.current += 1;
      return {
        _rowId: `pick_${pickRowIdCounterRef.current}_${Date.now()}`,
        _scanned: false,
        _error: "",
        _loading: false,
        id: "",
        box_id: "",
        vrp_id: "",
        rack_no: "",
        category: "",
        lot_type: "",
        qty: null,
        picked_at: "",
      };
    });
  }, []);

  useEffect(() => {
    pickRowsRef.current = pickRows;
  }, [pickRows]);

  // ====== HISTORY STATE ======
  const [historySessions, setHistorySessions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ====== PICKING LIST STATE ======
  const [pickingListData, setPickingListData] = useState<any[]>([]);
  const [pickingListLoading, setPickingListLoading] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
  }, []);

  // Load customers
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const res = await customerAPI.getAll(activeWarehouse?.id);
        setCustomers(res.data?.data || res.data || []);
      } catch {
        /* ignore */
      }
    };
    if (activeWarehouse?.id) loadCustomers();
  }, [activeWarehouse?.id]);

  // ====== PICKLIST TAB LOGIC ======
  const loadPicklists = useCallback(async () => {
    if (!activeWarehouse?.id) return;
    try {
      setPlLoading(true);
      const res = await nlPicklistAPI.list({
        warehouse_id: activeWarehouse.id,
        status: plStatusFilter || undefined,
        limit: 100,
      });
      setPicklists(res.data?.data || []);
    } catch {
      toast.error("Failed to load picklists");
    } finally {
      setPlLoading(false);
    }
  }, [activeWarehouse?.id, plStatusFilter]);

  useEffect(() => {
    if (currentTabCode === "picklist") loadPicklists();
  }, [currentTabCode, loadPicklists]);

  const handleAddPlRow = () => {
    setPlItems((prev) => [...prev, { vrp_id: "", required_qty: 1 }]);
  };

  const handleRemovePlRow = (idx: number) => {
    setPlItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePlItemChange = (
    idx: number,
    field: "vrp_id" | "required_qty",
    value: any,
  ) => {
    setPlItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  };

  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsePastedItems = (
    text: string,
  ): { vrp_id: string; required_qty: number }[] => {
    const lines = text
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const items: { vrp_id: string; required_qty: number }[] = [];
    for (const line of lines) {
      const parts = line.split(/[\t,|;]+/).map((p) => p.trim());
      if (parts.length === 0) continue;
      const vrp = parts[0].replace(/[^a-zA-Z0-9\-_]/g, "");
      if (!vrp) continue;
      const qty = parts.length >= 2 ? parseInt(parts[1], 10) : 1;
      items.push({ vrp_id: vrp, required_qty: qty > 0 ? qty : 1 });
    }
    return items;
  };

  const handlePasteConfirm = () => {
    const parsed = parsePastedItems(pasteText);
    if (parsed.length === 0) {
      toast.error("No valid VRP rows found");
      return;
    }
    setPlItems((prev) => {
      const existing = prev.filter((i) => i.vrp_id.trim());
      return [...existing, ...parsed];
    });
    toast.success(`${parsed.length} VRP rows added`);
    setPasteText("");
    setPasteDialogOpen(false);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        const items: { vrp_id: string; required_qty: number }[] = [];
        for (const row of rows) {
          const vrpKey =
            Object.keys(row).find((k) => /vrp|item|sku|product/i.test(k)) ||
            Object.keys(row)[0];
          const qtyKey =
            Object.keys(row).find((k) => /qty|quantity|count|pcs/i.test(k)) ||
            Object.keys(row)[1];
          const vrp = String(row[vrpKey] || "")
            .replace(/[^a-zA-Z0-9\-_]/g, "")
            .trim();
          if (!vrp) continue;
          const qty = parseInt(String(row[qtyKey] || "1"), 10);
          items.push({ vrp_id: vrp, required_qty: qty > 0 ? qty : 1 });
        }
        if (items.length === 0) {
          toast.error("No valid VRP rows found in Excel");
          return;
        }
        setPlItems((prev) => {
          const existing = prev.filter((i) => i.vrp_id.trim());
          return [...existing, ...items];
        });
        toast.success(`${items.length} VRP rows loaded from Excel`);
      } catch (err) {
        toast.error("Failed to parse Excel file");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleCreatePicklist = async () => {
    if (!activeWarehouse?.id) return;
    const validItems = plItems.filter(
      (i) => i.vrp_id.trim() && i.required_qty > 0,
    );
    if (validItems.length === 0) {
      toast.error("Add at least one VRP item");
      return;
    }
    try {
      setPlCreating(true);
      const res = await nlPicklistAPI.create({
        warehouse_id: activeWarehouse.id,
        customer_id: plCustomerId ? Number(plCustomerId) : undefined,
        remarks: plRemarks || undefined,
        items: validItems,
      });
      toast.success(`Picklist created: ${res.data.picklist.picklist_id}`);
      setPlItems([{ vrp_id: "", required_qty: 1 }]);
      setPlCustomerId("");
      setPlRemarks("");
      loadPicklists();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to create picklist");
    } finally {
      setPlCreating(false);
    }
  };

  const handleExpandPicklist = async (pl: any) => {
    if (expandedPl?.id === pl.id) {
      setExpandedPl(null);
      setExpandedPlItems([]);
      return;
    }
    try {
      setExpandedLoading(true);
      setExpandedPl(pl);
      const res = await nlPicklistAPI.get(pl.id);
      setExpandedPlItems(res.data?.items || []);
    } catch {
      toast.error("Failed to load picklist details");
    } finally {
      setExpandedLoading(false);
    }
  };

  const handleCancelPicklist = async (plId: string) => {
    try {
      await nlPicklistAPI.cancel(plId);
      toast.success("Picklist cancelled");
      loadPicklists();
      if (expandedPl?.id === plId) {
        setExpandedPl(null);
        setExpandedPlItems([]);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to cancel");
    }
  };

  const requestCancelPicklist = (plId: string) => {
    setCancelPicklistTargetId(plId);
  };

  // ====== PICKING TAB LOGIC ======
  const loadActivePicklists = useCallback(async () => {
    if (!activeWarehouse?.id) return;
    try {
      const res = await nlPicklistAPI.list({
        warehouse_id: activeWarehouse.id,
        status: "active",
        limit: 200,
      });
      const activeList = res.data?.data || [];
      // Also load partial
      const res2 = await nlPicklistAPI.list({
        warehouse_id: activeWarehouse.id,
        status: "partial",
        limit: 200,
      });
      setActivePicklists([...activeList, ...(res2.data?.data || [])]);
    } catch {
      /* ignore */
    }
  }, [activeWarehouse?.id]);

  const loadDraftSession = useCallback(async () => {
    if (!activeWarehouse?.id) return;
    try {
      setPickLoading(true);
      const res = await nlPickingAPI.getDraftSession(activeWarehouse.id);
      if (res.data?.exists && res.data?.session) {
        setPickSessionId(res.data.session.id);
        setPickPicklistId(res.data.session.picklist_id);
        const entries = res.data.entries || [];
        setPickEntries(entries);
        setPickTotals({
          total_boxes: res.data.session.total_boxes || 0,
          total_qty: res.data.session.total_qty || 0,
        });
        // Build grid rows: scanned entries first, then empty rows
        const scannedRows = entries.map((e: any) => {
          pickRowIdCounterRef.current += 1;
          return {
            _rowId: `pick_${pickRowIdCounterRef.current}_${Date.now()}`,
            _scanned: true,
            _error: "",
            _loading: false,
            id: e.id,
            box_id: e.box_id,
            vrp_id: e.vrp_id,
            rack_no: e.rack_no,
            category: e.category,
            lot_type: e.lot_type,
            qty: e.qty,
            picked_at: e.picked_at,
          };
        });
        setPickRows([...scannedRows, ...generatePickEmptyRows(100)]);
        // Load pick guide
        loadPickGuide(res.data.session.picklist_id);
        // Auto-focus first empty row
        setTimeout(() => {
          const api = pickGridRef.current?.api;
          if (api) {
            api.setFocusedCell(scannedRows.length, "box_id");
            api.startEditingCell({
              rowIndex: scannedRows.length,
              colKey: "box_id",
            });
          }
        }, 300);
      }
    } catch {
      /* ignore */
    } finally {
      setPickLoading(false);
    }
  }, [activeWarehouse?.id, generatePickEmptyRows]);

  useEffect(() => {
    if (currentTabCode === "picking") {
      loadActivePicklists();
      loadDraftSession();
    }
  }, [currentTabCode, loadActivePicklists, loadDraftSession]);

  const loadPickGuide = async (plId: string) => {
    try {
      setPickGuideLoading(true);
      const res = await nlPicklistAPI.getAvailableBoxes(plId);
      setPickGuide(res.data);
    } catch {
      /* ignore */
    } finally {
      setPickGuideLoading(false);
    }
  };

  const handleStartPicking = async () => {
    if (!activeWarehouse?.id || !pickPicklistId) {
      toast.error("Select a picklist first");
      return;
    }
    try {
      setPickLoading(true);
      const res = await nlPickingAPI.createSession({
        warehouse_id: activeWarehouse.id,
        picklist_id: pickPicklistId,
      });
      setPickSessionId(res.data.session.id);
      setPickEntries([]);
      setPickTotals({ total_boxes: 0, total_qty: 0 });
      setPickRows(generatePickEmptyRows(100));
      toast.success("Picking session started");
      loadPickGuide(pickPicklistId);
      // Auto-focus first row
      setTimeout(() => {
        const api = pickGridRef.current?.api;
        if (api) {
          api.setFocusedCell(0, "box_id");
          api.startEditingCell({ rowIndex: 0, colKey: "box_id" });
        }
      }, 200);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to start session");
    } finally {
      setPickLoading(false);
    }
  };

  // Scan box via API and populate row
  const scanBoxForRow = useCallback(
    async (boxId: string, rowIndex: number) => {
      if (!boxId?.trim() || !pickSessionId || !activeWarehouse?.id) return;
      const key = `${rowIndex}_${boxId.trim().toUpperCase()}`;
      if (pickPendingScansRef.current.has(key)) return;
      pickPendingScansRef.current.add(key);

      // Mark row as loading
      setPickRows((prev) => {
        const u = [...prev];
        if (u[rowIndex])
          u[rowIndex] = { ...u[rowIndex], _loading: true, _error: "" };
        return u;
      });

      try {
        const res = await nlPickingAPI.scanBox(pickSessionId, {
          box_id: boxId.trim(),
          warehouse_id: activeWarehouse.id,
        });
        const entry = res.data.entry;
        const totals = res.data.session_totals;

        // Update row with API response
        setPickRows((prev) => {
          const u = [...prev];
          if (u[rowIndex]) {
            u[rowIndex] = {
              ...u[rowIndex],
              _scanned: true,
              _loading: false,
              _error: "",
              id: entry.id,
              box_id: entry.box_id,
              vrp_id: entry.vrp_id,
              rack_no: entry.rack_no,
              category: entry.category,
              lot_type: entry.lot_type,
              qty: entry.qty,
              picked_at: entry.picked_at,
            };
          }
          return u;
        });

        // Update totals and entries list
        setPickTotals(totals || { total_boxes: 0, total_qty: 0 });
        setPickEntries((prev) => [entry, ...prev]);

        // Refresh grid cell
        setTimeout(() => {
          const api = pickGridRef.current?.api;
          if (api) {
            const node = api.getRowNode(pickRowsRef.current[rowIndex]?._rowId);
            if (node) api.refreshCells({ rowNodes: [node], force: true });
          }
        }, 50);

        toast.success(
          `Box ${entry.box_id} picked from ${entry.rack_no || "?"}`,
        );
        if (pickPicklistId) loadPickGuide(pickPicklistId);

        // Auto-move to next row
        setTimeout(() => {
          const api = pickGridRef.current?.api;
          if (api) {
            api.setFocusedCell(rowIndex + 1, "box_id");
            api.startEditingCell({ rowIndex: rowIndex + 1, colKey: "box_id" });
          }
        }, 100);
      } catch (error: any) {
        const errMsg = error?.response?.data?.error || "Scan failed";
        setPickRows((prev) => {
          const u = [...prev];
          if (u[rowIndex])
            u[rowIndex] = { ...u[rowIndex], _loading: false, _error: errMsg };
          return u;
        });
        toast.error(errMsg);
        // Keep focus on same row
        setTimeout(() => {
          const api = pickGridRef.current?.api;
          if (api) {
            api.setFocusedCell(rowIndex, "box_id");
            api.startEditingCell({ rowIndex, colKey: "box_id" });
          }
        }, 100);
      } finally {
        pickPendingScansRef.current.delete(key);
      }
    },
    [pickSessionId, activeWarehouse?.id, pickPicklistId],
  );

  const handlePickCellChanged = useCallback(
    (event: any) => {
      const { colDef, rowIndex, newValue } = event;
      if (colDef?.field !== "box_id" || !newValue?.trim()) return;
      const upper = newValue.trim().toUpperCase();
      setPickRows((prev) => {
        const u = [...prev];
        if (u[rowIndex]) u[rowIndex] = { ...u[rowIndex], box_id: upper };
        return u;
      });
      scanBoxForRow(upper, rowIndex);
      // Add more empty rows if near the end
      if (rowIndex >= pickRowsRef.current.length - 5) {
        setPickRows((prev) => [...prev, ...generatePickEmptyRows(100)]);
      }
    },
    [scanBoxForRow, generatePickEmptyRows],
  );

  const suppressPickKeyboardEvent = useCallback(
    (params: any) => {
      if (params.editing && params.event.key === "Enter") {
        params.api.stopEditing();
        setTimeout(() => {
          const rowData = params.node.data;
          const ri = params.node.rowIndex;
          if (rowData.box_id?.trim() && !rowData._scanned) {
            scanBoxForRow(rowData.box_id.trim().toUpperCase(), ri);
          } else {
            params.api.setFocusedCell(ri + 1, "box_id");
            setTimeout(
              () =>
                params.api.startEditingCell({
                  rowIndex: ri + 1,
                  colKey: "box_id",
                }),
              50,
            );
          }
        }, 20);
        return true;
      }
      return false;
    },
    [scanBoxForRow],
  );

  const handleDeletePickEntry = async (entryId: string, rowIndex: number) => {
    if (!pickSessionId || !entryId) return;
    try {
      const res = await nlPickingAPI.deleteEntry(pickSessionId, entryId);
      setPickEntries((prev) => prev.filter((e) => e.id !== entryId));
      setPickTotals(res.data.session_totals || pickTotals);
      // Clear the row
      pickRowIdCounterRef.current += 1;
      setPickRows((prev) => {
        const u = [...prev];
        u[rowIndex] = {
          _rowId: `pick_${pickRowIdCounterRef.current}_${Date.now()}`,
          _scanned: false,
          _error: "",
          _loading: false,
          id: "",
          box_id: "",
          vrp_id: "",
          rack_no: "",
          category: "",
          lot_type: "",
          qty: null,
          picked_at: "",
        };
        return u;
      });
      toast.success("Entry removed");
      if (pickPicklistId) loadPickGuide(pickPicklistId);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to remove entry");
    }
  };

  const handleSubmitPicking = async () => {
    if (!pickSessionId || pickEntries.length === 0) return;
    try {
      setPickSubmitting(true);
      const res = await nlPickingAPI.submitSession(pickSessionId, {
        warehouse_id: activeWarehouse.id,
      });
      toast.success(`Picking submitted: ${res.data.session_id}`);
      setPickSessionId(null);
      setPickEntries([]);
      setPickTotals({ total_boxes: 0, total_qty: 0 });
      setPickGuide(null);
      setPickPicklistId("");
      setPickRows([]);
      setPickSubmitDialogOpen(false);
      loadActivePicklists();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Submit failed");
    } finally {
      setPickSubmitting(false);
    }
  };

  const handleDiscardPicking = async () => {
    if (!pickSessionId) return;
    try {
      await nlPickingAPI.discardSession(pickSessionId);
      setPickSessionId(null);
      setPickEntries([]);
      setPickTotals({ total_boxes: 0, total_qty: 0 });
      setPickGuide(null);
      setPickPicklistId("");
      setPickRows([]);
      toast.success("Session discarded");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to discard");
    }
  };

  const requestDiscardPicking = () => {
    if (!pickSessionId) return;
    setDiscardPickingDialogOpen(true);
  };

  // ====== PICKING LIST TAB ======
  const loadPickingList = useCallback(async () => {
    if (!activeWarehouse?.id) return;
    try {
      setPickingListLoading(true);
      const res = await nlPickingAPI.listSessions({
        warehouse_id: activeWarehouse.id,
      });
      setPickingListData(
        (res.data?.data || []).filter((s: any) => s.status === "submitted"),
      );
    } catch {
      toast.error("Failed to load picking list");
    } finally {
      setPickingListLoading(false);
    }
  }, [activeWarehouse?.id]);

  // ====== HISTORY TAB ======
  const loadHistory = useCallback(async () => {
    if (!activeWarehouse?.id) return;
    try {
      setHistoryLoading(true);
      const res = await nlPickingAPI.listSessions({
        warehouse_id: activeWarehouse.id,
      });
      setHistorySessions(res.data?.data || []);
    } catch {
      toast.error("Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  }, [activeWarehouse?.id]);

  useEffect(() => {
    if (currentTabCode === "picking_list") loadPickingList();
    if (currentTabCode === "history") loadHistory();
  }, [currentTabCode, loadHistory, loadPickingList]);

  // ====== COLUMN DEFS ======
  const pickEntryColDefs = useMemo(
    () => [
      {
        headerName: "",
        width: 45,
        sortable: false,
        filter: false,
        suppressKeyboardEvent: suppressPickKeyboardEvent,
        cellRenderer: (p: any) => {
          if (p.data._loading)
            return <CircularProgress size={16} sx={{ mt: 0.5 }} />;
          if (p.data._scanned)
            return (
              <CheckCircleIcon
                fontSize="small"
                sx={{ color: "#10b981", mt: 0.5 }}
              />
            );
          if (p.data._error)
            return (
              <Tooltip title={p.data._error}>
                <WarningIcon
                  fontSize="small"
                  sx={{ color: "#ef4444", mt: 0.5 }}
                />
              </Tooltip>
            );
          return (
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: "text.disabled" }}
            >
              {p.node.rowIndex + 1}
            </Typography>
          );
        },
      },
      {
        field: "box_id",
        headerName: "Box ID",
        flex: 1,
        minWidth: 150,
        editable: (p: any) => !p.data._scanned,
        suppressKeyboardEvent: suppressPickKeyboardEvent,
        cellStyle: (p: any) =>
          p.data._error
            ? { backgroundColor: "rgba(239,68,68,0.1)" }
            : undefined,
      },
      {
        field: "vrp_id",
        headerName: "VRP ID",
        width: 130,
        suppressKeyboardEvent: suppressPickKeyboardEvent,
      },
      {
        field: "rack_no",
        headerName: "Rack",
        width: 100,
        suppressKeyboardEvent: suppressPickKeyboardEvent,
      },
      {
        field: "category",
        headerName: "Category",
        width: 120,
        suppressKeyboardEvent: suppressPickKeyboardEvent,
      },
      {
        field: "lot_type",
        headerName: "Lot",
        width: 70,
        suppressKeyboardEvent: suppressPickKeyboardEvent,
      },
      {
        field: "qty",
        headerName: "Qty",
        width: 70,
        type: "numericColumn",
        suppressKeyboardEvent: suppressPickKeyboardEvent,
      },
      {
        field: "picked_at",
        headerName: "Time",
        width: 110,
        suppressKeyboardEvent: suppressPickKeyboardEvent,
        valueFormatter: (p: any) =>
          p.value ? new Date(p.value).toLocaleTimeString() : "",
      },
      {
        headerName: "",
        width: 50,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) =>
          p.data._scanned ? (
            <IconButton
              aria-label="Action"
              size="small"
              color="error"
              onClick={() => handleDeletePickEntry(p.data.id, p.node.rowIndex)}
              title="Remove"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          ) : null,
      },
    ],
    [suppressPickKeyboardEvent],
  );

  const pickingListColDefs = useMemo(
    () => [
      { field: "session_id", headerName: "Session ID", flex: 2, minWidth: 220 },
      {
        field: "picklist_code",
        headerName: "Picklist",
        flex: 1,
        minWidth: 180,
      },
      {
        field: "customer_name",
        headerName: "Customer",
        flex: 1,
        minWidth: 130,
      },
      {
        field: "total_boxes",
        headerName: "Boxes",
        width: 80,
        type: "numericColumn",
      },
      {
        field: "total_qty",
        headerName: "Qty",
        width: 80,
        type: "numericColumn",
      },
      {
        field: "submitted_at",
        headerName: "Submitted",
        width: 130,
        valueFormatter: (p: any) => formatDate(p.value),
      },
      { field: "created_by_name", headerName: "By", width: 120 },
    ],
    [],
  );

  const historyColDefs = useMemo(
    () => [
      { field: "session_id", headerName: "Session ID", flex: 2, minWidth: 220 },
      {
        field: "picklist_code",
        headerName: "Picklist",
        flex: 1,
        minWidth: 180,
      },
      {
        field: "customer_name",
        headerName: "Customer",
        flex: 1,
        minWidth: 130,
      },
      {
        field: "total_boxes",
        headerName: "Boxes",
        width: 80,
        type: "numericColumn",
      },
      {
        field: "total_qty",
        headerName: "Qty",
        width: 80,
        type: "numericColumn",
      },
      {
        field: "submitted_at",
        headerName: "Submitted",
        width: 130,
        valueFormatter: (p: any) => formatDate(p.value),
      },
      { field: "created_by_name", headerName: "By", width: 120 },
      {
        field: "status",
        headerName: "Status",
        width: 110,
        cellRenderer: (p: any) => (
          <Chip
            label={p.value}
            size="small"
            color={p.value === "submitted" ? "success" : "warning"}
            variant="outlined"
          />
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

  // Build pick guide summary per VRP
  const pickGuideSummary = useMemo(() => {
    if (!pickGuide?.items || !pickGuide?.available_boxes) return [];
    return pickGuide.items.map((item: any) => {
      const boxes = pickGuide.available_boxes.filter(
        (b: any) =>
          (b.vrp_id || "").toUpperCase() === (item.vrp_id || "").toUpperCase(),
      );
      // Group by rack
      const rackMap: Record<string, { count: number; boxes: string[] }> = {};
      for (const b of boxes) {
        const rack = b.rack_no || "-";
        if (!rackMap[rack]) rackMap[rack] = { count: 0, boxes: [] };
        rackMap[rack].count++;
        rackMap[rack].boxes.push(b.box_id);
      }
      return {
        ...item,
        available_count: boxes.length,
        racks: rackMap,
        remaining: item.required_qty - item.picked_qty,
      };
    });
  }, [pickGuide]);

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
          title="NL Picking"
          subtitle="Picklist & picking management"
          icon="📋"
          warehouseName={activeWarehouse?.name}
        />
        <StandardTabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          tabs={visibleTabs}
          color="#059669"
        />

        {/* ===== PICKLIST TAB ===== */}
        {currentTabCode === "picklist" && (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "auto",
              p: { xs: 1, sm: 1.5 },
            }}
          >
            {/* Create Picklist Form */}
            <Paper sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  mb: 1.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <PlaylistAddIcon color="primary" /> Create New Picklist
              </Typography>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                sx={{ mb: 1.5 }}
              >
                <TextField
                  label="Customer (optional)"
                  value={plCustomerId}
                  onChange={(e) =>
                    setPlCustomerId(
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                  size="small"
                  select
                  sx={{ minWidth: 200 }}
                >
                  <MenuItem value="">-- No Customer --</MenuItem>
                  {customers.map((c: any) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Remarks (optional)"
                  value={plRemarks}
                  onChange={(e) => setPlRemarks(e.target.value)}
                  size="small"
                  sx={{ minWidth: 200 }}
                />
              </Stack>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, mb: 0.5, color: "text.secondary" }}
              >
                VRP Items:
              </Typography>
              {plItems.map((item, idx) => (
                <Stack
                  key={idx}
                  direction={isMobile ? "column" : "row"}
                  spacing={1}
                  sx={{ mb: 0.5 }}
                  alignItems={isMobile ? "stretch" : "center"}
                >
                  <TextField
                    label="VRP ID"
                    value={item.vrp_id}
                    onChange={(e) =>
                      handlePlItemChange(idx, "vrp_id", e.target.value)
                    }
                    size="small"
                    sx={{ flex: 1 }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (idx === plItems.length - 1) handleAddPlRow();
                      }
                    }}
                  />
                  <TextField
                    label="Qty"
                    type="number"
                    value={item.required_qty}
                    onChange={(e) =>
                      handlePlItemChange(
                        idx,
                        "required_qty",
                        parseInt(e.target.value, 10) || 1,
                      )
                    }
                    size="small"
                    sx={{ width: 80 }}
                    inputProps={{ min: 1 }}
                  />
                  {plItems.length > 1 && (
                    <IconButton
                      aria-label="Action"
                      size="small"
                      color="error"
                      onClick={() => handleRemovePlRow(idx)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              ))}
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 1 }}
                flexWrap="wrap"
                useFlexGap
              >
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddPlRow}
                >
                  Add Row
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  startIcon={<PasteIcon />}
                  onClick={() => setPasteDialogOpen(true)}
                >
                  Paste VRP+Qty
                </Button>
                {canSeeButton("bulk_upload") && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="secondary"
                    startIcon={<UploadFileIcon />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Excel
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  hidden
                  onChange={handleExcelUpload}
                />
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SendIcon />}
                  onClick={handleCreatePicklist}
                  disabled={plCreating}
                >
                  {plCreating ? "Creating..." : "Create Picklist"}
                </Button>
              </Stack>

              {/* Paste Dialog */}
              <Dialog
                open={pasteDialogOpen}
                onClose={() => setPasteDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                fullScreen={isMobile}
              >
                <DialogTitle>Paste VRP + Qty</DialogTitle>
                <DialogContent>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    Paste tab/comma separated rows from Excel. Format: VRP ID
                    [TAB] QTY (one per line).
                  </Typography>
                  <TextField
                    multiline
                    rows={10}
                    fullWidth
                    placeholder={`2627714\t4\n343555\t3\n789012\t1`}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    sx={{ mt: 1, fontFamily: "monospace" }}
                    InputProps={{
                      sx: { fontFamily: "monospace", fontSize: 14 },
                    }}
                  />
                  {pasteText && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.5, display: "block" }}
                    >
                      Preview: {parsePastedItems(pasteText).length} valid rows
                      detected
                    </Typography>
                  )}
                </DialogContent>
                <DialogActions>
                  <Button
                    onClick={() => {
                      setPasteText("");
                      setPasteDialogOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handlePasteConfirm}
                    disabled={!pasteText.trim()}
                  >
                    Add Rows
                  </Button>
                </DialogActions>
              </Dialog>
            </Paper>

            {/* Picklists List */}
            <Paper
              sx={{
                flex: 1,
                p: 2,
                borderRadius: 2,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <Stack
                direction={isMobile ? "column" : "row"}
                spacing={1}
                alignItems={isMobile ? "stretch" : "center"}
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Picklists
                </Typography>
                <TextField
                  value={plStatusFilter}
                  onChange={(e) => setPlStatusFilter(e.target.value)}
                  size="small"
                  select
                  sx={{ width: 130 }}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="partial">Partial</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="">All</MenuItem>
                </TextField>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadPicklists}
                  disabled={plLoading}
                >
                  Refresh
                </Button>
              </Stack>

              <Box sx={{ flex: 1, overflow: "auto" }}>
                {plLoading && <LinearProgress sx={{ mb: 1 }} />}
                {picklists.length === 0 && !plLoading && (
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", textAlign: "center", py: 3 }}
                  >
                    No picklists found
                  </Typography>
                )}
                {picklists.map((pl: any) => (
                  <Paper
                    key={pl.id}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      mb: 1,
                      cursor: "pointer",
                      borderRadius: 1.5,
                      borderLeft: `4px solid ${pl.status === "active" ? "#3b82f6" : pl.status === "partial" ? "#f59e0b" : pl.status === "completed" ? "#10b981" : "#ef4444"}`,
                      "&:hover": {
                        bgcolor: isDarkMode
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(0,0,0,0.02)",
                      },
                    }}
                    onClick={() => handleExpandPicklist(pl)}
                  >
                    <Stack
                      direction={isMobile ? "column" : "row"}
                      justifyContent="space-between"
                      alignItems={isMobile ? "flex-start" : "center"}
                      spacing={0.75}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {pl.picklist_id}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          {pl.customer_name || "No customer"} &bull;{" "}
                          {pl.item_count} VRPs &bull; {pl.total_picked}/
                          {pl.total_required} picked &bull;{" "}
                          {formatDate(pl.created_at)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Chip
                          label={pl.status}
                          size="small"
                          color={STATUS_COLORS[pl.status] || "default"}
                          variant="outlined"
                        />
                        {(pl.status === "active" ||
                          pl.status === "partial") && (
                          <IconButton
                            aria-label="Action"
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestCancelPicklist(pl.id);
                            }}
                            title="Cancel"
                          >
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    </Stack>

                    {/* Progress bar */}
                    {pl.total_required > 0 && (
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(
                          100,
                          (pl.total_picked / pl.total_required) * 100,
                        )}
                        sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                        color={
                          pl.total_picked >= pl.total_required
                            ? "success"
                            : "primary"
                        }
                      />
                    )}

                    {/* Expanded detail */}
                    {expandedPl?.id === pl.id && (
                      <Box
                        sx={{
                          mt: 1.5,
                          pt: 1,
                          borderTop: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        {expandedLoading ? (
                          <CircularProgress size={20} />
                        ) : (
                          <>
                            {expandedPlItems.map((item: any) => (
                              <Stack
                                key={item.id}
                                direction={isMobile ? "column" : "row"}
                                spacing={1}
                                alignItems={isMobile ? "flex-start" : "center"}
                                sx={{ mb: 0.5 }}
                              >
                                {item.status === "fulfilled" ? (
                                  <CheckCircleIcon
                                    fontSize="small"
                                    color="success"
                                  />
                                ) : item.status === "partial" ? (
                                  <WarningIcon
                                    fontSize="small"
                                    color="warning"
                                  />
                                ) : (
                                  <InventoryIcon
                                    fontSize="small"
                                    color="disabled"
                                  />
                                )}
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 600, width: 120 }}
                                >
                                  {item.vrp_id}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{ color: "text.secondary" }}
                                >
                                  {item.picked_qty}/{item.required_qty} picked
                                </Typography>
                                <Chip
                                  label={item.status}
                                  size="small"
                                  color={
                                    STATUS_COLORS[item.status] || "default"
                                  }
                                  variant="outlined"
                                  sx={{ ml: "auto" }}
                                />
                              </Stack>
                            ))}
                          </>
                        )}
                      </Box>
                    )}
                  </Paper>
                ))}
              </Box>
            </Paper>
          </Box>
        )}

        {/* ===== PICKING TAB ===== */}
        {currentTabCode === "picking" && (
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
              sx={{ mb: 1.5 }}
            >
              <Card
                sx={{
                  flex: 1,
                  minWidth: 110,
                  background: "linear-gradient(135deg, #059669, #10b981)",
                  color: "white",
                }}
              >
                <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Boxes Picked
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {pickTotals.total_boxes}
                  </Typography>
                </CardContent>
              </Card>
              <Card
                sx={{
                  flex: 1,
                  minWidth: 110,
                  background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
                  color: "white",
                }}
              >
                <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Total Qty
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {pickTotals.total_qty}
                  </Typography>
                </CardContent>
              </Card>
            </Stack>

            {!pickSessionId ? (
              /* ---- No active session: select picklist to start ---- */
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography
                  variant="h6"
                  sx={{ mb: 2, color: "text.secondary" }}
                >
                  No active picking session
                </Typography>
                <Paper
                  sx={{ p: 3, maxWidth: 500, mx: "auto", borderRadius: 2 }}
                >
                  <Stack spacing={2}>
                    <TextField
                      label="Select Picklist"
                      value={pickPicklistId}
                      onChange={(e) => setPickPicklistId(e.target.value)}
                      size="small"
                      select
                      fullWidth
                    >
                      <MenuItem value="">-- Select Active Picklist --</MenuItem>
                      {activePicklists.map((pl: any) => (
                        <MenuItem key={pl.id} value={pl.id}>
                          {pl.picklist_id} — {pl.customer_name || "No customer"}{" "}
                          ({pl.total_picked}/{pl.total_required})
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="contained"
                      size="large"
                      color="success"
                      startIcon={<InventoryIcon />}
                      onClick={handleStartPicking}
                      disabled={pickLoading || !pickPicklistId}
                    >
                      Start Picking
                    </Button>
                  </Stack>
                </Paper>
              </Box>
            ) : (
              /* ---- Active session: guide + multi-entry grid ---- */
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                }}
              >
                {/* Pick Guide */}
                {pickGuideSummary.length > 0 && (
                  <Paper
                    sx={{
                      p: 1.5,
                      mb: 1,
                      borderRadius: 2,
                      maxHeight: 180,
                      overflow: "auto",
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 700,
                        mb: 0.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      <InventoryIcon fontSize="small" color="primary" /> Pick
                      Guide
                    </Typography>
                    {pickGuideSummary.map((item: any) => (
                      <Box key={item.id} sx={{ mb: 0.5 }}>
                        <Stack
                          direction={isMobile ? "column" : "row"}
                          spacing={1}
                          alignItems={isMobile ? "flex-start" : "center"}
                        >
                          {item.remaining <= 0 ? (
                            <CheckCircleIcon fontSize="small" color="success" />
                          ) : (
                            <WarningIcon fontSize="small" color="warning" />
                          )}
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, minWidth: 100 }}
                          >
                            {item.vrp_id}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                          >
                            Need: {item.remaining > 0 ? item.remaining : 0}{" "}
                            &bull; Available: {item.available_count}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "primary.main", fontWeight: 600 }}
                          >
                            {Object.entries(item.racks)
                              .map(
                                ([rack, data]: any) => `${rack}(${data.count})`,
                              )
                              .join(", ")}
                          </Typography>
                        </Stack>
                      </Box>
                    ))}
                  </Paper>
                )}

                {/* Multi-Entry Scan Grid */}
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <Box className="ag-theme-quartz" sx={gridSx}>
                    <AgGridReact
                      ref={pickGridRef}
                      rowData={pickRows}
                      columnDefs={pickEntryColDefs}
                      defaultColDef={defaultColDef}
                      rowHeight={tableRowHeight}
                      headerHeight={40}
                      animateRows={false}
                      getRowId={(p: any) => p.data._rowId}
                      onCellValueChanged={handlePickCellChanged}
                      suppressCellFocus={false}
                      singleClickEdit
                      stopEditingWhenCellsLoseFocus
                    />
                  </Box>
                </Box>

                {/* Submit Bar */}
                <Paper
                  sx={{
                    p: 1.5,
                    mt: 1,
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    gap: isMobile ? 1 : 0,
                    alignItems: isMobile ? "stretch" : "center",
                    justifyContent: "space-between",
                    borderRadius: 2,
                    bgcolor: isDarkMode ? "#1e293b" : "#f1f5f9",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {pickEntries.length} entries — {pickTotals.total_boxes}{" "}
                      boxes — {pickTotals.total_qty} qty
                    </Typography>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<CancelIcon />}
                      onClick={requestDiscardPicking}
                    >
                      Discard
                    </Button>
                  </Stack>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<SendIcon />}
                    onClick={() => setPickSubmitDialogOpen(true)}
                    disabled={pickEntries.length === 0 || pickSubmitting}
                  >
                    Submit Picking
                  </Button>
                </Paper>
              </Box>
            )}
          </Box>
        )}

        {/* ===== PICKING LIST TAB ===== */}
        {currentTabCode === "picking_list" && (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              p: { xs: 1, sm: 1.5 },
            }}
          >
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={loadPickingList}
              disabled={pickingListLoading}
              sx={{ mb: 1, alignSelf: "flex-start" }}
            >
              Refresh
            </Button>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <Box className="ag-theme-quartz" sx={gridSx}>
                <AgGridReact
                  rowData={pickingListData}
                  columnDefs={pickingListColDefs}
                  defaultColDef={defaultColDef}
                  rowHeight={tableRowHeight}
                  headerHeight={40}
                  animateRows={false}
                  suppressCellFocus
                  loading={pickingListLoading}
                />
              </Box>
            </Box>
          </Box>
        )}

        {/* ===== HISTORY TAB ===== */}
        {currentTabCode === "history" && (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              p: { xs: 1, sm: 1.5 },
            }}
          >
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={loadHistory}
              disabled={historyLoading}
              sx={{ mb: 1, alignSelf: "flex-start" }}
            >
              Refresh
            </Button>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <Box className="ag-theme-quartz" sx={gridSx}>
                <AgGridReact
                  rowData={historySessions}
                  columnDefs={historyColDefs}
                  defaultColDef={defaultColDef}
                  rowHeight={tableRowHeight}
                  headerHeight={40}
                  animateRows={false}
                  suppressCellFocus
                  loading={historyLoading}
                />
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* Submit Dialog */}
      <Dialog
        open={pickSubmitDialogOpen}
        onClose={() => setPickSubmitDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Submit Picking?</DialogTitle>
        <DialogContent>
          <Typography>
            This will mark <strong>{pickTotals.total_boxes} boxes</strong> (
            {pickTotals.total_qty} qty) as picked and move them to staging area.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
            Box status will change to &apos;picked&apos;. Picklist progress will
            be updated.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPickSubmitDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSubmitPicking}
            disabled={pickSubmitting}
            startIcon={
              pickSubmitting ? <CircularProgress size={16} /> : <SendIcon />
            }
          >
            {pickSubmitting ? "Submitting..." : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!cancelPicklistTargetId}
        onClose={() => setCancelPicklistTargetId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Cancel Picklist?</DialogTitle>
        <DialogContent>
          <Typography>
            This will cancel the selected picklist and stop further picking
            against it.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelPicklistTargetId(null)}>Keep</Button>
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              const targetId = cancelPicklistTargetId;
              setCancelPicklistTargetId(null);
              if (targetId) await handleCancelPicklist(targetId);
            }}
          >
            Cancel Picklist
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={discardPickingDialogOpen}
        onClose={() => setDiscardPickingDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Discard Picking Session?</DialogTitle>
        <DialogContent>
          <Typography>
            This will remove all scanned picking entries from the current draft
            session.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardPickingDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              setDiscardPickingDialogOpen(false);
              await handleDiscardPicking();
            }}
          >
            Discard Session
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
