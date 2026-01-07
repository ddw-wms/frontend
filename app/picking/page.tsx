// File Path = warehouse-frontend\app\picking\page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Stack, Tab, Tabs,
  CircularProgress, Alert, IconButton, Autocomplete, Checkbox, FormControlLabel,
  Card, CardContent, LinearProgress, Divider, Collapse, Tooltip, FormControl, InputLabel, Select,
  useTheme, useMediaQuery, AppBar, Toolbar
} from '@mui/material';
import {
  Add as AddIcon, Download as DownloadIcon, Settings as SettingsIcon,
  CheckCircle as CheckIcon, Delete as DeleteIcon, Refresh as RefreshIcon, Visibility as VisibilityIcon,
  FilterList as FilterListIcon, ExpandMore as ExpandMoreIcon, Info as InfoIcon,
  Tune as TuneIcon, Close as CloseIcon
} from '@mui/icons-material';
import { pickingAPI, rackAPI, inboundAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import { StandardPageHeader, StandardTabs } from '@/components';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ClientSideRowModelModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { usePermissionGuard } from '@/hooks/usePermissionGuard';
import { usePermissions } from '@/app/context/PermissionsContext';

// Register AG Grid modules ONCE (include ClientSideRowModel for client-side features)
ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

// Format date helper
const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${yy}`;
};

// Safe date-time formatter for display (returns '-' for invalid dates)
const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString();
};

// Date-only formatter: 28-Dec-2025 (no time)
const formatDateFull = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${day}-${mon}-${yyyy}`;
};


// ALL MASTER DATA COLUMNS
const ALL_MASTER_COLUMNS = [
  'wid', 'fsn', 'order_id', 'product_title', 'brand', 'mrp', 'fsp',
  'hsn_sac', 'igst_rate', 'cms_vertical', 'fkt_link', 'p_type', 'p_size',
  'vrp', 'yield_value', 'wh_location', 'fkqc_remark', 'fk_grade'
];
// DEFAULT VISIBLE COLUMNS FOR MULTI ENTRY
const DEFAULT_MULTI_COLUMNS = [
  'sno', 'wsn', 'product_serial_number', 'rack_no', 'picking_remarks', 'product_title', 'brand', 'cms_vertical',
  'fsp', 'mrp'
];

// EDITABLE COLUMNS IN MULTI ENTRY
const EDITABLE_COLUMNS = ['wsn', 'product_serial_number', 'rack_no', 'picking_remarks'];

// DEFAULT VISIBLE COLUMNS FOR PICKING LIST (includes master data columns)
const ALL_LIST_COLUMNS = [
  'wsn', 'product_title', 'brand', 'cms_vertical', 'fsp', 'mrp',
  'rack_no', 'batch_id', 'source', 'picking_date', 'customer_name',
  'picker_name', 'quantity', 'picking_remarks', 'other_remarks', 'created_user_name',
  'wid', 'fsn', 'order_id', 'hsn_sac', 'igst_rate', 'p_type', 'p_size',
  'vrp', 'yield_value', 'wh_location', 'fkqc_remark', 'fk_grade', 'invoice_date', 'fkt_link'
];

const DEFAULT_LIST_COLUMNS = [
  'wsn', 'product_title', 'brand', 'cms_vertical', 'fsp', 'mrp',
  'rack_no', 'batch_id', 'source', 'picking_date', 'customer_name', 'picker_name'
];

export default function PickingPage() {
  // Role guard - only admin, manager, picker can access
  const { loading: permissionLoading } = usePermissionGuard('view_picking');

  // Permission checks
  const { hasPermission } = usePermissions();

  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);
  const gridRef = useRef<any>(null);
  const columnApiRef = useRef<any>(null);


  // Tab state
  const [tabValue, setTabValue] = useState(0);

  // Multi Entry Header state
  const [pickingDate, setPickingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customers, setCustomers] = useState<string[]>([]);
  const [pickerName, setPickerName] = useState<string>('');
  const [racks, setRacks] = useState<any[]>([]);

  // Load racks for warehouse
  const loadRacks = async () => {
    try {
      const res = await rackAPI.getByWarehouse(activeWarehouse?.id);
      const data = res.data || [];
      setRacks(data);
      if (!data || data.length === 0) {
        console.warn('No racks returned for warehouse', activeWarehouse?.id);
        toast('No racks configured for this warehouse', { duration: 3000, style: { background: '#fff3cd', color: '#856404', border: '1px solid #f59e0b' } });
      }
    } catch (error) {
      console.error('Failed to load racks', error);
      setRacks([]);
      toast.error('Failed to load racks');
    }
  };

  useEffect(() => {
    if (activeWarehouse) loadRacks();
  }, [activeWarehouse]);

  // Multi Entry state with AG Grid
  const rowIdCounterRef = useRef(0);
  const generateEmptyRows = (count: number) => {
    return Array.from({ length: count }, () => {
      rowIdCounterRef.current += 1;
      return {
        id: `row-${rowIdCounterRef.current}`,
        wsn: '',
        product_serial_number: '',
        picking_date: pickingDate,
        picking_remarks: '',
        product_title: '',
        brand: '',
        cms_vertical: '',
        fsp: '',
        mrp: '',
        rack_no: '',
        wid: '',
        fsn: '',
        order_id: '',
        fkqc_remark: '',
        fk_grade: '',
        hsn_sac: '',
        igst_rate: '',
        invoice_date: '',
        fkt_link: '',
        wh_location: '',
        vrp: '',
        yield_value: '',
        p_type: '',
        p_size: '',
        source: '',
        customer_name: selectedCustomer || '',
        picker_name: pickerName || ''
      };
    });
  };

  const [multiRows, setMultiRows] = useState<any[]>(generateEmptyRows(50));
  const [existingWSNs, setExistingWSNs] = useState<string[]>([]);
  const [multiLoading, setMultiLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('pickingMultiEntryColumns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as string[];
        // Ensure 'sno' is first
        if (!parsed.includes('sno')) parsed.unshift('sno');
        // Ensure product_serial_number is present after wsn
        if (!parsed.includes('product_serial_number')) {
          const wsnIndex = parsed.indexOf('wsn');
          const insertAt = wsnIndex >= 0 ? wsnIndex + 1 : 1;
          parsed.splice(insertAt, 0, 'product_serial_number');
        }
        // Ensure rack_no is present after product_serial_number
        if (!parsed.includes('rack_no')) {
          const psIndex = parsed.indexOf('product_serial_number');
          const insertAt = psIndex >= 0 ? psIndex + 1 : 2;
          parsed.splice(insertAt, 0, 'rack_no');
        }
        return parsed;
      } catch (e) {
        return DEFAULT_MULTI_COLUMNS;
      }
    }
    return DEFAULT_MULTI_COLUMNS;
  });

  // Persist visible columns so new users and existing users see the same defaults
  useEffect(() => {
    try {
      localStorage.setItem('pickingMultiEntryColumns', JSON.stringify(visibleColumns));
    } catch (e) {
      // ignore
    }
  }, [visibleColumns]);

  // When switching to Multi Picking tab, auto-size columns so layout looks correct
  useEffect(() => {
    if (tabValue !== 1) return;
    const t = setTimeout(() => {
      try {
        const colApi = columnApiRef.current;
        const api = gridRef.current;
        if (!colApi || !api) return;
        const allCols = colApi.getAllColumns ? colApi.getAllColumns().map((c: any) => c.getColId()) : [];
        if (!allCols || allCols.length === 0) return;
        colApi.autoSizeColumns(allCols, false);
        let total = 0;
        for (const id of allCols) {
          const col = colApi.getColumn(id);
          total += col?.getActualWidth ? col.getActualWidth() : 0;
        }
        const dims = api.getSize ? api.getSize() : (api.gridPanel && api.gridPanel.getBodyClientRect && api.gridPanel.getBodyClientRect());
        const gridW = dims?.width || 0;
        if (gridW && total < gridW) api.sizeColumnsToFit();
      } catch { /* ignore */ }
    }, 50);
    return () => clearTimeout(t);
  }, [tabValue, visibleColumns, multiRows]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [gridDuplicateWSNs, setGridDuplicateWSNs] = useState<Set<string>>(new Set());
  const [crossWarehouseWSNs, setCrossWarehouseWSNs] = useState<Set<string>>(new Set());
  const [existingPickingWSNs, setExistingPickingWSNs] = useState(new Set());

  // Picking List state
  const [pickingList, setPickingList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  // Local refresh button state (non-blocking)
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Mobile actions dialog state
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Smooth loading helpers (prevent blinking overlay)
  const currentLoadIdRef = useRef(0);
  const pickingAbortControllerRef = useRef<AbortController | null>(null);
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const overlayShownRef = useRef(false);
  const overlayStartRef = useRef<number | null>(null);
  const emptyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const SHOW_OVERLAY_DELAY = 50; // ms - reduced to show animation faster
  const MIN_LOADING_MS = 350; // ms
  const EMPTY_CONFIRM_DELAY = 400; // ms
  const [topLoading, setTopLoading] = useState(false);
  const previousDataRef = useRef<any[] | null>(null);

  // Grid Settings (persisted)
  const [enableSorting, setEnableSorting] = useState<boolean>(() => {
    try { return localStorage.getItem('picking_enableSorting') !== 'false'; } catch { return true; }
  });
  const [enableColumnFilters, setEnableColumnFilters] = useState<boolean>(() => {
    try { return localStorage.getItem('picking_enableColumnFilters') !== 'false'; } catch { return true; }
  });
  const [enableColumnResize, setEnableColumnResize] = useState<boolean>(() => {
    try { return localStorage.getItem('picking_enableColumnResize') !== 'false'; } catch { return true; }
  });
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);

  const filtersActive = Boolean(
    (searchFilter && searchFilter.trim() !== '') ||
    (brandFilter && brandFilter !== '') ||
    (categoryFilter && categoryFilter !== '') ||
    (sourceFilter && sourceFilter !== '')
  );

  // Default: filters collapsed by default on Picking List tab
  useEffect(() => {
    // Start collapsed on mount
    setFiltersExpanded(false);
  }, []);

  // Ensure filters are collapsed whenever user navigates to the Picking List tab (tab index 0)
  useEffect(() => {
    if (tabValue === 0) {
      setFiltersExpanded(false);
    }
  }, [tabValue]);

  type ColumnConfig = {
    key: string;
    visible: boolean;
  };

  const DEFAULT_LIST_COLUMNS_CONFIG: ColumnConfig[] = ALL_LIST_COLUMNS.map(col => ({
    key: col,
    visible: DEFAULT_LIST_COLUMNS.includes(col),
  }));

  // Use simple string array for list columns (matching outbound pattern)
  const [listColumns, setListColumns] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pickingListColumns');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Validate that saved columns exist in ALL_LIST_COLUMNS
          const valid = parsed.filter((col: string) => ALL_LIST_COLUMNS.includes(col));
          if (valid.length > 0) {
            return valid;
          }
        } catch (e) {
          console.log('Column settings load error');
        }
      }
    }
    // Default: show most important columns
    return DEFAULT_LIST_COLUMNS;
  });
  const [listColumnSettingsOpen, setListColumnSettingsOpen] = useState(false);

  // Batch Management state
  const [batches, setBatches] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Export Dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportCustomer, setExportCustomer] = useState('');
  const [exportBatchIds, setExportBatchIds] = useState<string[]>([]);

  // Auth check
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(storedUser);
    setPickerName(storedUser?.fullName || storedUser?.username || '');
  }, [router]);

  // Fetch all existing picked WSNs on mount
  useEffect(() => {
    async function fetchExistingWSNs() {
      try {
        const res = await pickingAPI.getExistingWSNs(activeWarehouse?.id);
        setExistingPickingWSNs(new Set(res.data));
      } catch (error) {
        console.error('Failed to fetch existing picking WSNs', error);
      }
    }
    if (activeWarehouse) {
      fetchExistingWSNs();
    }
  }, [activeWarehouse]);

  // Load existing WSNs and customers on mount
  useEffect(() => {
    if (activeWarehouse) {
      loadCustomers();
    }
  }, [activeWarehouse]);

  // Debounce search filter
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    searchDebounceRef.current = setTimeout(() => {
      setSearchDebounced(searchFilter);
    }, 220);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [searchFilter]);

  // Load picking list when filters change
  useEffect(() => {
    if (activeWarehouse && tabValue === 0) {
      loadPickingList();
    }
  }, [activeWarehouse, tabValue, page, limit, searchDebounced, brandFilter, categoryFilter, sourceFilter]);

  // Load batches when batch tab opens
  useEffect(() => {
    if (activeWarehouse && tabValue === 2) {
      loadBatches();
    }
  }, [activeWarehouse, tabValue]);

  // Load list columns from localStorage with validation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pickingListColumns');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const valid = parsed.filter((col: string) => ALL_LIST_COLUMNS.includes(col));
          if (valid.length > 0) {
            setListColumns(valid);
          }
        } catch (e) {
          // Keep default
        }
      }
    }
  }, []);

  // Grid settings persisted
  useEffect(() => {
    try {
      const s = localStorage.getItem('picking_enableSorting');
      const f = localStorage.getItem('picking_enableColumnFilters');
      const r = localStorage.getItem('picking_enableColumnResize');
      if (s !== null) setEnableSorting(s === 'true');
      if (f !== null) setEnableColumnFilters(f === 'true');
      if (r !== null) setEnableColumnResize(r === 'true');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('picking_enableSorting', String(enableSorting));
      localStorage.setItem('picking_enableColumnFilters', String(enableColumnFilters));
      localStorage.setItem('picking_enableColumnResize', String(enableColumnResize));
    } catch { }
  }, [enableSorting, enableColumnFilters, enableColumnResize]);

  // Load customers from customers table
  const loadCustomers = async () => {
    try {
      const response = await pickingAPI.getCustomers(activeWarehouse?.id);
      if (Array.isArray(response.data)) {
        setCustomers(response.data);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Load customers error:', error);
      toast.error('Failed to load customers');
      setCustomers([]);
    }
  };

  // Check for duplicates in grid
  const checkDuplicates = useCallback((rows: any[]) => {
    const gridDup = new Set<string>();
    const crossWh = new Set<string>();
    const wsnCounts = new Map<string, number>();

    rows.forEach((row) => {
      const wsn = row.wsn?.trim()?.toUpperCase();
      if (!wsn) return;

      // Grid duplicate counting
      wsnCounts.set(wsn, (wsnCounts.get(wsn) || 0) + 1);
      if (wsnCounts.get(wsn)! > 1) {
        gridDup.add(wsn);
      }

      // Check if already picked (any warehouse)
      if (existingPickingWSNs.has(wsn)) {
        crossWh.add(wsn);
      }
    });

    setGridDuplicateWSNs(gridDup);
    setCrossWarehouseWSNs(crossWh);
  }, [existingPickingWSNs]);

  // Navigate to next cell in AG Grid
  const navigateToNextCell = useCallback((params: any) => {
    const { previousCellPosition, nextCellPosition, key } = params;

    if (key === 'Enter') {
      const currentCol = previousCellPosition.column.getColId();
      const currentRow = previousCellPosition.rowIndex;

      if (currentCol === visibleColumns[visibleColumns.length - 1]) {
        // Last column → move to first column of next row
        return {
          rowIndex: currentRow + 1,
          column: params.api.getColumns()![0],
        };
      } else {
        // Same row, next column
        const colIndex = visibleColumns.indexOf(currentCol);
        const nextColId = visibleColumns[colIndex + 1];
        const nextCol = params.api.getColumns()!.find((c: any) => c.getColId() === nextColId);
        return {
          rowIndex: currentRow,
          column: nextCol,
        };
      }
    }

    return nextCellPosition;
  }, [visibleColumns]);

  // Add new rows
  const addMultiRow = () => {
    setMultiRows([...multiRows, ...generateEmptyRows(10)]);
  };

  const add30Rows = () => {
    setMultiRows([...multiRows, ...generateEmptyRows(30)]);
  };

  // Submit multi entry
  const handleMultiSubmit = async () => {
    const validRows = multiRows.filter(r => r.wsn?.trim());

    if (validRows.length === 0) {
      toast.error('At least 1 WSN required');
      return;
    }

    if (!pickingDate) {
      toast.error('Please select picking date');
      return;
    }

    if (!selectedCustomer) {
      toast.error('Please select customer');
      return;
    }

    if (!pickerName.trim()) {
      toast.error('Picker name is required');
      return;
    }

    const fixedRows = validRows.map(row => ({
      ...row,
      picking_date: pickingDate,
      customer_name: selectedCustomer,
      picker_name: pickerName,
      created_by: user?.id,
      created_user_name: user?.fullName || user?.username,
      warehouse_name: activeWarehouse?.name
    }));

    console.log('Submitting picking entries:', { fixedRows, warehouse_id: activeWarehouse?.id });

    setMultiLoading(true);
    try {
      const response = await pickingAPI.multiEntry(fixedRows, activeWarehouse?.id);

      if (response.data?.successCount > 0) {
        toast.success(`✓ ${response.data.successCount} entries created`);
      }

      if (response.data?.errors && response.data.errors.length > 0) {
        console.error('Errors:', response.data.errors);
        toast.error(`❌ ${response.data.errors.length} entries failed. Check console.`);
      }

      if (response.data?.successCount === 0 && response.data?.errors?.length === 0) {
        toast.error('No entries were saved. Check data.');
      }

      // Reset rows
      setMultiRows(generateEmptyRows(50));
      setGridDuplicateWSNs(new Set());
      setCrossWarehouseWSNs(new Set());

      // Reload data
      const res = await pickingAPI.getExistingWSNs(activeWarehouse?.id);
      setExistingPickingWSNs(new Set(res.data));
      loadPickingList();
      loadBatches();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Submission failed');
    } finally {
      setMultiLoading(false);
    }
  };

  // Calculate status counts for Multi Entry
  const statusCounts = useMemo(() => {
    let ready = 0;
    let duplicate = 0;
    let cross = 0;

    multiRows.forEach(row => {
      if (!row.wsn?.trim()) return;

      const wsn = row.wsn.trim().toUpperCase();

      if (crossWarehouseWSNs.has(wsn)) cross++;
      else if (gridDuplicateWSNs.has(wsn)) duplicate++;
      else ready++;
    });

    return { ready, duplicate, cross };
  }, [multiRows, gridDuplicateWSNs, crossWarehouseWSNs]);

  // Load picking list (supports buttonRefresh for non-blocking inline refresh)
  const loadPickingList = async ({ buttonRefresh = false } = {}) => {
    if (!activeWarehouse) return;

    // Use request id to ignore stale responses
    currentLoadIdRef.current += 1;
    const loadId = currentLoadIdRef.current;

    if (buttonRefresh) setRefreshing(true);

    // If we have no data yet, show full loader; otherwise show a delayed overlay to avoid flicker
    if (!pickingList || pickingList.length === 0) {
      setLoading(true);
    } else {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      overlayShownRef.current = false;
      overlayStartRef.current = null;
      overlayTimerRef.current = setTimeout(() => {
        try {
          setTopLoading(true);
          overlayShownRef.current = true;
          overlayStartRef.current = Date.now();
          // Hide AG Grid's built-in loading overlay for consistency
          try { gridRef.current?.api?.hideOverlay(); } catch { }
        } catch (err) { }
        overlayTimerRef.current = null;
      }, SHOW_OVERLAY_DELAY);
    }

    // Mark fetching in-progress
    setIsFetching(true);

    // Cancel any previous in-flight request & pending empty timers
    if (pickingAbortControllerRef.current) {
      try { pickingAbortControllerRef.current.abort(); } catch { }
      pickingAbortControllerRef.current = null;
    }
    if (emptyTimerRef.current) {
      clearTimeout(emptyTimerRef.current);
      emptyTimerRef.current = null;
    }
    const controller = new AbortController();
    pickingAbortControllerRef.current = controller;

    try {
      const response = await pickingAPI.getList({
        page,
        limit,
        warehouseId: activeWarehouse.id,
        search: searchDebounced,
        brand: brandFilter,
        category: categoryFilter,
        source: sourceFilter
      });

      // Only process if this is still the latest request
      if (loadId === currentLoadIdRef.current) {
        const data = response.data.data || [];
        const totalCount = response.data.pagination?.total || 0;

        // Clear any pending empty timers
        if (emptyTimerRef.current) {
          clearTimeout(emptyTimerRef.current);
          emptyTimerRef.current = null;
        }

        // If server returned rows, update immediately
        if (data.length > 0) {
          setPickingList(data);
          previousDataRef.current = data;
        } else {
          // Server returned zero rows - delay clearing to avoid flicker
          emptyTimerRef.current = setTimeout(() => {
            if (loadId === currentLoadIdRef.current) {
              setPickingList([]);
              previousDataRef.current = [];
            }
            emptyTimerRef.current = null;
          }, EMPTY_CONFIRM_DELAY);
        }

        setTotal(totalCount);

        // Extract unique brands and categories for filters
        const uniqueBrands = Array.from(new Set(data.map((item: any) => item.brand).filter(Boolean)));
        const uniqueCategories = Array.from(new Set(data.map((item: any) => item.cms_vertical).filter(Boolean)));
        setBrandOptions(uniqueBrands as string[]);
        setCategoryOptions(uniqueCategories as string[]);

        if (buttonRefresh) {
          setRefreshSuccess(true);
          toast.success('✓ List refreshed');
          setTimeout(() => setRefreshSuccess(false), 1800);
        }
      }
    } catch (err: any) {
      // Handle aborts: clear overlay/timer and return without clearing data
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') {
        if (overlayTimerRef.current) {
          clearTimeout(overlayTimerRef.current);
          overlayTimerRef.current = null;
        }
        if (overlayShownRef.current) {
          try { gridRef.current?.api?.hideOverlay(); } catch { }
          overlayShownRef.current = false;
          overlayStartRef.current = null;
          try { setTopLoading(false); } catch { }
        }
        setIsFetching(false);
        pickingAbortControllerRef.current = null;
        return;
      }

      console.error('Load picking list error:', err);
      if (buttonRefresh) toast.error(err.response?.data?.error || 'Failed to refresh picking list');
      else toast.error(err.response?.data?.error || 'Failed to load picking list');

      // Do not clear existing list data on error to avoid blinking; keep previous rows visible
    } finally {
      // Only clear loading/overlays when this is the latest request
      if (loadId === currentLoadIdRef.current) {
        if (overlayShownRef.current && overlayStartRef.current) {
          const elapsed = Date.now() - overlayStartRef.current;
          if (elapsed < MIN_LOADING_MS) {
            await new Promise(res => setTimeout(res, MIN_LOADING_MS - elapsed));
          }
          try { gridRef.current?.api?.hideOverlay(); } catch { }
          overlayShownRef.current = false;
          overlayStartRef.current = null;
          try { setTopLoading(false); } catch { }
        } else {
          // overlay never shown, clear pending timer
          if (overlayTimerRef.current) {
            clearTimeout(overlayTimerRef.current);
            overlayTimerRef.current = null;
          }
          // Also ensure topLoading is false if the timer was pending
          try { setTopLoading(false); } catch { }
        }

        if (!previousDataRef.current || (Array.isArray(previousDataRef.current) && previousDataRef.current.length === 0)) {
          if (!emptyTimerRef.current) {
            // No previous data - normal behavior
            if (buttonRefresh) setRefreshing(false);
            else setLoading(false);
          } else {
            // If an empty timer is pending, keep showing old rows until it resolves
            if (buttonRefresh) setRefreshing(false);
            else setLoading(false);
          }
        } else {
          // We have previous data - keep it visible, don't show full-screen spinner
          if (buttonRefresh) setRefreshing(false);
          else setLoading(false);
        }

        setIsFetching(false);
        pickingAbortControllerRef.current = null;
      }
    }
  };

  // Load batches
  const loadBatches = async () => {
    setBatchLoading(true);
    try {
      console.log('Loading batches for warehouse:', activeWarehouse?.id);
      const response = await pickingAPI.getBatches(activeWarehouse?.id);
      setBatches(response.data || []);
      console.log('Batches loaded:', response.data?.length ?? 0);
    } catch (err: any) {
      // Surface server error details for easier debugging
      console.error('Load batches error:', err);
      const serverMsg = err?.response?.data?.error || err?.message || 'Failed to load batches';
      toast.error(serverMsg);
      // Helpful debug toast when server returns stack or details
      if (err?.response?.data?.details) {
        console.error('Server error details:', err.response.data.details);
      }
    } finally {
      setBatchLoading(false);
    }
  };

  // Delete batch
  const handleDeleteBatch = async (batchId: string) => {
    if (window.confirm(`Delete batch ${batchId}?`)) {
      try {
        await pickingAPI.deleteBatch(batchId);
        toast.success('✓ Batch deleted successfully');

        // Reload existing WSNs after deletion
        const res = await pickingAPI.getExistingWSNs(activeWarehouse?.id);
        setExistingPickingWSNs(new Set(res.data));

        loadBatches();
        loadPickingList();
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to delete batch');
      }
    }
  };

  // Export to Excel with filters
  const handleAdvancedExport = async () => {
    if (!activeWarehouse) return;

    try {
      let dataToExport = pickingList;

      // Build filter params
      const filterParams: any = {
        warehouseId: activeWarehouse.id,
      };

      // Add date filters if provided
      if (exportStartDate) filterParams.startDate = exportStartDate;
      if (exportEndDate) filterParams.endDate = exportEndDate;

      // Add customer filter if provided
      if (exportCustomer) filterParams.customer = exportCustomer;

      // Add batch filter if provided
      if (exportBatchIds && exportBatchIds.length > 0) filterParams.batchId = exportBatchIds;

      // Fetch data with all filters
      const response = await pickingAPI.getList({
        page: 1,
        limit: 999999,
        ...filterParams
      });

      dataToExport = response.data.data || [];

      if (dataToExport.length === 0) {
        toast.error('No data to export with selected filters');
        return;
      }

      const exportData = dataToExport.map((item: any) => ({
        ID: item.id || '-',
        WSN: item.wsn,
        'Product Title': item.product_title || '-',
        Brand: item.brand || '-',
        Category: item.cms_vertical || '-',
        FSP: item.fsp || '-',
        MRP: item.mrp || '-',
        'Rack No': item.rack_no || '-',
        'Batch ID': item.batch_id || '-',
        Source: item.source || '-',
        'Picking Date': formatDate(item.picking_date),
        Customer: item.customer_name || '-',
        Picker: item.picker_name || '-',
        Quantity: item.quantity || 1,
        'Picking Remarks': item.picking_remarks || '-',
        'Other Remarks': item.other_remarks || '-',
        'Created By': item.created_user_name || '-',
        'Warehouse ID': item.warehouse_id || '-',
        'Warehouse Name': item.warehouse_name || '-',
        WID: item.wid || '-',
        FSN: item.fsn || '-',
        'Order ID': item.order_id || '-',
        'HSN/SAC': item.hsn_sac || '-',
        'IGST Rate': item.igst_rate || '-',
        'Product Type': item.p_type || '-',
        'Product Size': item.p_size || '-',
        VRP: item.vrp || '-',
        'Yield Value': item.yield_value || '-',
        'WH Location': item.wh_location || '-',
        'FK QC Remark': item.fkqc_remark || '-',
        'FK Grade': item.fk_grade || '-',
        'Invoice Date': formatDate(item.invoice_date),
        'FKT Link': item.fkt_link || '-'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Picking List');

      // Generate meaningful filename
      let filenameParts = ['picking'];
      if (exportBatchIds && exportBatchIds.length > 0) {
        if (exportBatchIds.length === 1) {
          filenameParts.push(`batch_${exportBatchIds[0]}`);
        } else {
          filenameParts.push(`batches_${exportBatchIds.length}`);
        }
      }
      if (exportStartDate) filenameParts.push(`from_${exportStartDate.replace(/-/g, '')}`);
      if (exportEndDate) filenameParts.push(`to_${exportEndDate.replace(/-/g, '')}`);
      if (exportCustomer) filenameParts.push(`customer_${exportCustomer.replace(/\s+/g, '_')}`);
      if (filenameParts.length === 1) filenameParts.push('all');

      const filename = `${filenameParts.join('_')}_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success(`✓ Exported ${exportData.length} records`);
      setExportDialogOpen(false);
      setExportStartDate('');
      setExportEndDate('');
      setExportCustomer('');
      setExportBatchIds([]);
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(err.response?.data?.error || 'Failed to export Excel');
    }
  };

  // Get unique customers from picking list
  const exportCustomerOptions = useMemo(() => {
    const uniqueCustomers = Array.from(
      new Set(pickingList.map((item: any) => item.customer_name).filter(Boolean))
    ).sort();
    return uniqueCustomers as string[];
  }, [pickingList]);

  const handleListReset = () => {
    setSearchFilter('');
    setBrandFilter('');
    setCategoryFilter('');
    setSourceFilter('');
    setPage(1);
  };

  const saveListColumnSettings = (cols: string[]) => {
    setListColumns(cols);
    localStorage.setItem('pickingListColumns', JSON.stringify(cols));
  };

  // Ensure AG Grid shows the correct overlay
  useEffect(() => {
    const api = gridRef.current;
    if (!api) return;

    if (isFetching) {
      try { api.hideOverlay(); } catch { }
      return;
    }

    if (!isFetching && !loading && pickingList.length === 0) {
      try { api.showNoRowsOverlay(); } catch { }
    } else {
      try { api.hideOverlay(); } catch { }
    }
  }, [pickingList, loading, isFetching]);

  // Apply AG Grid quick filter when search input changes
  useEffect(() => {
    const api = gridRef.current;
    if (!api || typeof api.setQuickFilter !== 'function') return;

    if (isFetching) {
      try { api.hideOverlay(); } catch { }
      return;
    }

    api.setQuickFilter(searchDebounced || '');
  }, [searchDebounced, pickingList]);

  // ✅ LIST GRID COLUMN DEFINITIONS (AG GRID)
  const listColumnDefs = useMemo(() => {
    const sr = {
      headerName: 'SR.NO',
      field: '__sr',
      valueGetter: (params: any) => params.node ? params.node.rowIndex + 1 + (page - 1) * limit : undefined,
      width: 80,
      cellStyle: { fontWeight: 700, textAlign: 'center', backgroundColor: '#fafafa' },
      suppressMovable: true,
      sortable: false,
      filter: false,
    };

    const cols = listColumns.map((col: string) => {
      // Dates
      if (col.includes('date')) {
        return {
          field: col,
          headerName: col.replace(/_/g, ' ').toUpperCase(),
          filter: enableColumnFilters ? 'agDateColumnFilter' : undefined,
          valueFormatter: (p: any) => formatDate(p.value),
          tooltipField: col,
          width: col === 'picking_date' ? 140 : 150,
        };
      }

      // Source chip
      if (col === 'source') {
        return {
          field: col,
          headerName: 'SOURCE',
          cellRenderer: (p: any) => {
            if (!p.value) return '-';
            const colorMap: any = { 'QC': 'success', 'INBOUND': 'warning', 'MASTER': 'info' };
            return (
              <Chip label={p.value} size="small" color={colorMap[p.value] || 'default'} sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }} />
            );
          },
          width: 120,
        };
      }

      // Default
      return {
        field: col,
        headerName: col.replace(/_/g, ' ').toUpperCase(),
        filter: enableColumnFilters ? 'agTextColumnFilter' : undefined,
        tooltipField: col,
        width: col === 'wsn' ? 180 : 150,
      };
    });

    return [sr, ...cols];
  }, [listColumns, page, limit, enableColumnFilters]);

  const listDefaultColDef = useMemo(() => ({
    sortable: !!enableSorting,
    resizable: !!enableColumnResize,
    filter: !!enableColumnFilters,
    suppressMenu: false,
    minWidth: 100,
  }), [enableSorting, enableColumnFilters, enableColumnResize]);

  // Column widths for AG Grid
  const COLUMN_WIDTHS: Record<string, any> = {
    sno: { width: 60 },
    wsn: { width: 80 },
    product_serial_number: { width: 160 },
    picking_remarks: { flex: 1, minWidth: 120 },
    product_title: { flex: 2, minWidth: 220 },
    brand: { width: 90 },
    cms_vertical: { width: 100 },
    mrp: { width: 40 },
    fsp: { width: 40 },
    rack_no: { width: 80 },
  };

  if (!activeWarehouse) {
    return <AppLayout>⚠️ No warehouse selected</AppLayout>;
  }

  // Column definitions for AG Grid
  const columnDefs = visibleColumns.map((field) => {
    const widthConfig = COLUMN_WIDTHS[field] || {};
    const baseColDef: any = {
      field,
      headerName: field === 'sno' ? 'S.No' : field.replace(/_/g, ' ').toUpperCase(),
      ...widthConfig,
      cellStyle: (params: any) => {
        const wsn = params.data?.wsn?.trim()?.toUpperCase();
        const styles: any = {};

        // SNO special styling
        if (field === 'sno') {
          styles.backgroundColor = '#f8fafc';
          styles.fontWeight = 700;
          styles.color = '#64748b';
          styles.textAlign = 'center';
        }

        // Master data columns get gray background
        if (ALL_MASTER_COLUMNS.includes(field)) {
          styles.backgroundColor = '#f5f5f5';
        }

        // WSN validation colors
        if (wsn && field === 'wsn') {
          if (crossWarehouseWSNs.has(wsn)) {
            styles.backgroundColor = '#fee';
            styles.color = '#c00';
          } else if (gridDuplicateWSNs.has(wsn)) {
            styles.backgroundColor = '#fff3cd';
            styles.color = '#856404';
          }
        }

        return styles;
      },
    };

    // S.NO is read-only and shows row index
    if (field === 'sno') {
      baseColDef.editable = false;
      baseColDef.valueGetter = (params: any) => (params.node?.rowIndex != null ? params.node.rowIndex + 1 : '');
      baseColDef.width = baseColDef.width || 60;
      baseColDef.suppressSizeToFit = true;
      return baseColDef;
    }

    // Rack select editor (editable)
    if (field === 'rack_no') {
      baseColDef.editable = EDITABLE_COLUMNS.includes('rack_no');
      if (baseColDef.editable) {
        baseColDef.cellEditor = 'agSelectCellEditor';
        baseColDef.cellEditorParams = { values: ['', ...racks.map((r: any) => r.rack_name)] };
        baseColDef.width = baseColDef.width || 110;
      }
      return baseColDef;
    }

    // Read-only for master data columns
    if (ALL_MASTER_COLUMNS.includes(field)) {
      baseColDef.editable = false;
    }

    return baseColDef;
  });

  //////////////////////////////////====UI RENDERING====////////////////////////////////////

  // Show loading state while permissions are being checked
  if (permissionLoading) {
    return (
      <AppLayout>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh'
        }}>
          <CircularProgress />
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: {
          background: '#363636',
          color: '#fff',
          borderRadius: '10px',
          padding: '16px',
          fontWeight: 600
        },
        success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } }
      }} />

      <Box sx={{
        p: { xs: 0.75, md: 1 },
        background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)',
        minHeight: '100vh',
        width: '100%'
      }}>
        {/* HEADER */}
        <StandardPageHeader
          title="Picking"
          subtitle="Prepare orders for dispatch"
          icon="📦"
          warehouseName={activeWarehouse?.name}
        // userName={user?.fullName}
        />

        {/* TABS */}
        <StandardTabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          tabs={['Picking List', 'Multi Picking', 'Batch Manager']}
          color="#f59e0b"
        />

        {/* ========== TAB 0: PICKING LIST ========== */}
        {tabValue === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 230px)' }}>
            {/* FILTERS */}
            <Card sx={{ mb: { xs: 0, md: 1 }, borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', background: 'rgba(255, 255, 255, 0.98)' }}>
              <CardContent sx={{ p: { xs: 0, md: 1 } }}>
                <Stack spacing={{ xs: 0, md: 1 }}>
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 1, md: 1 }, alignItems: { xs: 'stretch', md: 'center' }, width: '100%' }}>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', width: '100%', overflow: 'hidden' }}>
                      <TextField size="small" placeholder="🔍 Search by WSN or Product" value={searchFilter} onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }} sx={{ flex: '1 1 auto', flexGrow: 1, flexShrink: 1, minWidth: 0, maxWidth: { xs: 'calc(100% - 120px)', sm: 'calc(100% - 130px)', md: 'none' }, '& .MuiOutlinedInput-root': { height: 40 } }} />

                      {/* Mobile: Actions button to open full-screen filter dialog */}
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<TuneIcon />}
                        sx={{
                          display: { xs: 'inline-flex', md: 'none' },
                          height: 40,
                          px: 2,
                          textTransform: 'none',
                          flexShrink: 0,
                          fontSize: '0.85rem',
                          fontWeight: 600
                        }}
                        onClick={() => setMobileActionsOpen(true)}
                      >
                        Actions
                      </Button>

                      {/* Mobile: show the filter toggle button aligned to the right of search - HIDDEN, now in Actions dialog */}
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setFiltersExpanded(!filtersExpanded)}
                        sx={{
                          display: 'none',
                          height: 40,
                          minWidth: 64,
                          fontSize: '0.63rem',
                          fontWeight: 600,
                          ml: 0,
                          whiteSpace: 'nowrap',
                          justifyContent: 'flex-start',
                          gap: 0.4,
                          px: 0.4,
                          textTransform: 'none',
                          flexShrink: 0
                        }}
                      >
                        <FilterListIcon sx={{ fontSize: { xs: '1.1rem', sm: '1.15rem' } }} />

                        <Box component="span" sx={{ mr: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box component="span">Filters</Box>
                          {filtersActive && (
                            <Tooltip title="Filters active">
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#10b981', border: '2px solid white' }} />
                            </Tooltip>
                          )}
                        </Box>

                        <Box sx={{ ml: 'auto' }}>
                          <ExpandMoreIcon sx={{ transform: filtersExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }} />
                        </Box>
                      </Button>

                      {/* Desktop: show all filters in one row */}
                      <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, alignItems: 'center', ml: 1, flexGrow: 1 }}>
                        <TextField select size="small" label="Brand" value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }} sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 40 } }}>
                          <MenuItem value="">All Brands</MenuItem>
                          {brandOptions.map(brand => (
                            <MenuItem key={brand} value={brand}>{brand}</MenuItem>
                          ))}
                        </TextField>

                        <TextField select size="small" label="Category" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 40 } }}>
                          <MenuItem value="">All Categories</MenuItem>
                          {categoryOptions.map(cat => (
                            <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                          ))}
                        </TextField>

                        <TextField select size="small" label="Source" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }} sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 40 } }}>
                          <MenuItem value="">All Sources</MenuItem>
                          <MenuItem value="QC">QC</MenuItem>
                          <MenuItem value="INBOUND">INBOUND</MenuItem>
                          <MenuItem value="MASTER">MASTER</MenuItem>
                        </TextField>

                        <Stack direction="row" spacing={0.5} sx={{ ml: 'auto', alignItems: 'center' }}>
                          <Button size="small" variant="outlined" onClick={handleListReset} sx={{ height: 40, minWidth: 70, fontSize: '0.7rem', fontWeight: 700 }}>Clear</Button>
                          <Button size="small" variant="outlined" startIcon={<SettingsIcon />} onClick={() => setListColumnSettingsOpen(true)} sx={{ height: 40, fontSize: '0.7rem', fontWeight: 700 }}>Columns</Button>
                          <Button size="small" variant="outlined" startIcon={<SettingsIcon />} onClick={() => setGridSettingsOpen(true)} sx={{ height: 40, fontSize: '0.7rem', fontWeight: 700 }}>Grid</Button>
                          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => setExportDialogOpen(true)} sx={{ height: 40, fontSize: '0.7rem', fontWeight: 700 }}>Export</Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={refreshing ? <CircularProgress size={14} /> : refreshSuccess ? <CheckIcon sx={{ color: '#10b981' }} /> : <RefreshIcon />}
                            onClick={() => loadPickingList({ buttonRefresh: true })}
                            disabled={refreshing}
                            sx={{ height: 40, fontSize: '0.7rem', fontWeight: 700 }}
                          >
                            {refreshing ? 'Refreshing...' : refreshSuccess ? 'Refreshed' : 'Refresh'}
                          </Button>

                        </Stack>
                      </Box>
                    </Box>

                    {filtersExpanded && (
                      <Collapse
                        in={filtersExpanded}
                        timeout="auto"
                        sx={{ display: { xs: 'block', md: 'none' } }}
                      >
                        <Box sx={{ mt: 0 }}>
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(4, 1fr)',
                              gap: 0.5,
                            }}
                          >
                            {/* Brand */}
                            <TextField
                              select
                              size="small"
                              fullWidth
                              label="Brand"
                              value={brandFilter}
                              onChange={(e) => {
                                setBrandFilter(e.target.value);
                                setPage(1);
                              }}
                              sx={{
                                gridColumn: 'span 2',
                                minWidth: 0,
                                '& .MuiOutlinedInput-root': { height: 36 },
                              }}
                            >
                              <MenuItem value="">All Brands</MenuItem>
                              {brandOptions.map((brand) => (
                                <MenuItem key={brand} value={brand}>
                                  {brand}
                                </MenuItem>
                              ))}
                            </TextField>

                            {/* Category */}
                            <TextField
                              select
                              size="small"
                              fullWidth
                              label="Category"
                              value={categoryFilter}
                              onChange={(e) => {
                                setCategoryFilter(e.target.value);
                                setPage(1);
                              }}
                              sx={{
                                gridColumn: 'span 2',
                                minWidth: 0,
                                '& .MuiOutlinedInput-root': { height: 36 },
                              }}
                            >
                              <MenuItem value="">All Categories</MenuItem>
                              {categoryOptions.map((cat) => (
                                <MenuItem key={cat} value={cat}>
                                  {cat}
                                </MenuItem>
                              ))}
                            </TextField>

                            {/* Source */}
                            <TextField
                              select
                              size="small"
                              fullWidth
                              label="Source"
                              value={sourceFilter}
                              onChange={(e) => {
                                setSourceFilter(e.target.value);
                                setPage(1);
                              }}
                              sx={{
                                gridColumn: 'span 2',
                                minWidth: 0,
                                '& .MuiOutlinedInput-root': { height: 36 },
                              }}
                            >
                              <MenuItem value="">All Sources</MenuItem>
                              <MenuItem value="QC">QC</MenuItem>
                              <MenuItem value="INBOUND">INBOUND</MenuItem>
                              <MenuItem value="MASTER">MASTER</MenuItem>
                            </TextField>

                            {/* Buttons */}
                            <Box
                              sx={{
                                gridColumn: 'span 2',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 0.5,
                              }}
                            >
                              {[
                                {
                                  icon: '🧹',
                                  label: 'Reset',
                                  onClick: () => {
                                    setSearchFilter('');
                                    setBrandFilter('');
                                    setCategoryFilter('');
                                    setSourceFilter('');
                                    setPage(1);
                                  },
                                },
                                { icon: <SettingsIcon fontSize="small" />, label: 'Columns', onClick: () => setListColumnSettingsOpen(true) },
                                { icon: <DownloadIcon fontSize="small" />, label: 'Export', onClick: () => setExportDialogOpen(true) },
                                { icon: <RefreshIcon fontSize="small" />, label: 'Refresh', onClick: () => loadPickingList({ buttonRefresh: true }) },
                              ].map((btn, index) => (
                                <Button
                                  key={index}
                                  size="small"
                                  variant="outlined"
                                  onClick={btn.label === 'Refresh' ? () => loadPickingList({ buttonRefresh: true }) : btn.onClick}
                                  sx={{
                                    minWidth: 0,
                                    height: 36,
                                    px: 0.5,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    lineHeight: 1,
                                  }}
                                >
                                  <Box
                                    sx={{
                                      fontSize: '1rem',
                                      display: 'flex',
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                    }}
                                  >
                                    {btn.label === 'Refresh' ? (refreshing ? <CircularProgress size={16} /> : refreshSuccess ? <CheckIcon sx={{ color: '#10b981' }} /> : <RefreshIcon fontSize="small" />) : btn.icon}
                                  </Box>
                                  <Box
                                    sx={{
                                      fontSize: '0.55rem',
                                      fontWeight: 600,
                                      mt: 0.1,
                                      textAlign: 'center',
                                    }}
                                  >
                                    {btn.label}
                                  </Box>
                                </Button>
                              ))}
                            </Box>
                          </Box>
                        </Box>
                      </Collapse>
                    )}

                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* TABLE - AG GRID */}
            <Box sx={{
              flex: 1,
              minHeight: 0,
              border: '1px solid #d1d5db',
              position: 'relative'
            }}>

              {/* Loading Overlay with Spinner */}
              {loading && (
                <Box sx={{
                  position: 'absolute',
                  top: 48,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(3px)',
                  zIndex: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    p: 4,
                    bgcolor: 'white',
                    borderRadius: 3,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                  }}>
                    <Box sx={{ position: 'relative' }}>
                      <CircularProgress
                        size={56}
                        thickness={3.5}
                        sx={{
                          color: '#1976d2',
                          filter: 'drop-shadow(0 2px 8px rgba(25, 118, 210, 0.2))'
                        }}
                      />
                      <Box sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                        opacity: 0.15,
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                        '@keyframes pulse': {
                          '0%, 100%': {
                            transform: 'translate(-50%, -50%) scale(1)',
                            opacity: 0.15
                          },
                          '50%': {
                            transform: 'translate(-50%, -50%) scale(1.15)',
                            opacity: 0.05
                          }
                        }
                      }} />
                    </Box>
                    <Typography
                      sx={{
                        fontSize: '0.95rem',
                        fontWeight: 500,
                        color: '#546e7a',
                        letterSpacing: 0.3,
                        textAlign: 'center'
                      }}
                    >
                      Loading data...
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Empty State Overlay */}
              {!loading && (!pickingList || pickingList.length === 0) && (
                <Box sx={{
                  position: 'absolute',
                  top: 60,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  zIndex: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Box sx={{
                    textAlign: 'center',
                    p: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2
                  }}>
                    <Box sx={{
                      fontSize: '4rem',
                      opacity: 0.3,
                      mb: 1
                    }}>
                      📭
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#6b7280', mb: 0.5 }}>
                      No Data Found
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#9ca3af', maxWidth: 400 }}>
                      No picking items match your current filters. Try adjusting your search criteria or reset filters to see all items.
                    </Typography>
                  </Box>
                </Box>
              )}

              <Box sx={{ height: '100%', width: '100%' }}>
                <div className="ag-theme-quartz" style={{ height: '100%', width: '100%', position: 'relative' }}>
                  <Box sx={{
                    height: '100%',
                    width: '100%',
                    '& .ag-header': {
                      opacity: '1 !important',
                      zIndex: 15,
                      position: 'relative'
                    },
                    '& .ag-header-cell': {
                      opacity: '1 !important'
                    },
                    '& .ag-body-viewport': {
                      opacity: loading ? 0.3 : 1,
                      transition: 'opacity 0.2s ease-in-out'
                    }
                  }}>
                    <AgGridReact
                      ref={gridRef}
                      rowData={pickingList}
                      columnDefs={listColumnDefs}
                      defaultColDef={listDefaultColDef}
                      rowSelection="single"
                      suppressRowClickSelection={true}
                      suppressLoadingOverlay={true}
                      suppressNoRowsOverlay={true}
                      animateRows={false}
                      gridOptions={{ getRowId: (params: any) => params.data?.wsn || params.data?.id || String(params.rowIndex), suppressRowTransform: true }}
                      onGridReady={(params: any) => { gridRef.current = params.api; columnApiRef.current = params.columnApi; try { const savedState = localStorage.getItem('picking_columnState'); if (savedState && params.api) { params.api.applyColumnState({ state: JSON.parse(savedState), applyOrder: true }); } } catch (e) { /* ignore */ } }}
                      onColumnResized={(params: any) => { if (params.finished && params.api) { try { localStorage.setItem('picking_columnState', JSON.stringify(params.api.getColumnState())); } catch { /* ignore */ } } }}
                      onColumnMoved={(params: any) => { if (params.finished && params.api) { try { localStorage.setItem('picking_columnState', JSON.stringify(params.api.getColumnState())); } catch { /* ignore */ } } }}
                      pagination={false}
                    />
                  </Box>
                </div>
              </Box>
            </Box>

            {/* PAGINATION */}
            <Stack
              direction="row"
              spacing={1}
              justifyContent="space-between"
              alignItems="center"
              sx={{
                mt: 1,
                p: 1,
                mb: -13,
                background: 'rgba(255, 255, 255, 0.98)',
                borderRadius: 1.5,
                border: '1px solid rgba(0,0,0,0.08)'
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.7rem' }}>
                📊 {pickingList.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, total)} of {total}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" disabled={page === 1} onClick={() => setPage(page - 1)} sx={{ fontSize: '0.75rem', fontWeight: 600 }}>◀ Prev</Button>
                <Box sx={{ px: 2, border: '1.5px solid #f59e0b', borderRadius: 1.5, background: 'rgba(245, 158, 11, 0.08)', display: 'flex', alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.8rem' }}>{page} / {Math.ceil(total / limit) || 1}</Typography>
                </Box>
                <Button size="small" variant="outlined" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)} sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Next ▶</Button>
              </Stack>
            </Stack>

            {/* Column Settings Dialog */}
            <Dialog open={listColumnSettingsOpen} onClose={() => setListColumnSettingsOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>⚙️ Column Settings</DialogTitle>
              <DialogContent>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {ALL_LIST_COLUMNS.map((col) => (
                    <FormControlLabel
                      key={col}
                      control={
                        <Checkbox
                          checked={listColumns.includes(col)}
                          onChange={() => {
                            if (listColumns.includes(col)) {
                              saveListColumnSettings(listColumns.filter((c: string) => c !== col));
                            } else {
                              saveListColumnSettings([...listColumns, col]);
                            }
                          }}
                        />
                      }
                      label={col.replace(/_/g, ' ').toUpperCase()}
                    />
                  ))}
                </Stack>
              </DialogContent>
              <DialogActions sx={{ justifyContent: 'space-between' }}>
                <Button onClick={() => {
                  setListColumns(DEFAULT_LIST_COLUMNS);
                  localStorage.setItem('pickingListColumns', JSON.stringify(DEFAULT_LIST_COLUMNS));
                }} variant="outlined">Reset</Button>
                <Button onClick={() => setListColumnSettingsOpen(false)} variant="contained" sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}>DONE</Button>
              </DialogActions>
            </Dialog>

            {/* GRID SETTINGS DIALOG */}
            <Dialog
              open={gridSettingsOpen}
              onClose={() => setGridSettingsOpen(false)}
              maxWidth="xs"
              fullWidth
              PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } }}
            >
              <DialogTitle sx={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                fontWeight: 800,
                fontSize: '1.1rem',
                py: 1.5
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SettingsIcon />
                  Grid Settings
                </Box>
              </DialogTitle>

              <DialogContent sx={{ mt: 2, pb: 1 }}>
                <Stack spacing={2.5}>
                  <Alert severity="info" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                    Settings auto-save and persist after reload 💾
                  </Alert>

                  {/* SORTABLE */}
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={enableSorting}
                          onChange={(e) => setEnableSorting(e.target.checked)}
                          sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                        />
                      }
                      label={
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                            ⬆️ Enable Sorting
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                            Click column headers to sort ascending/descending
                          </Typography>
                        </Box>
                      }
                    />
                  </Box>

                  <Divider sx={{ my: 0.5 }} />

                  {/* FILTER */}
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={enableColumnFilters}
                          onChange={(e) => setEnableColumnFilters(e.target.checked)}
                          sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                        />
                      }
                      label={
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                            🔍 Enable Column Filters
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                            Filter menu icon in column headers
                          </Typography>
                        </Box>
                      }
                    />
                  </Box>

                  <Divider sx={{ my: 0.5 }} />

                  {/* RESIZABLE */}
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={enableColumnResize}
                          onChange={(e) => setEnableColumnResize(e.target.checked)}
                          sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                        />
                      }
                      label={
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                            ↔️ Enable Column Resize
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                            Drag column borders to adjust width
                          </Typography>
                        </Box>
                      }
                    />
                  </Box>

                </Stack>
              </DialogContent>

              <DialogActions sx={{ p: 2, background: '#fef3c7', gap: 1 }}>
                <Button
                  onClick={() => {
                    setEnableSorting(true);
                    setEnableColumnFilters(true);
                    setEnableColumnResize(true);
                    toast.success('Settings reset to default');
                  }}
                  sx={{
                    fontWeight: 700,
                    color: '#78716c',
                    '&:hover': { bgcolor: 'rgba(120, 113, 108, 0.1)' }
                  }}
                >
                  Reset
                </Button>

                <Box sx={{ flex: 1 }} />

                <Button onClick={() => setGridSettingsOpen(false)} sx={{ fontWeight: 700 }}>Close</Button>
                <Button onClick={() => setGridSettingsOpen(false)} variant="contained" sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}>Done</Button>
              </DialogActions>
            </Dialog>

            {/* MOBILE ACTIONS DIALOG (Filters + Actions combined) */}
            <Dialog fullScreen open={mobileActionsOpen} onClose={() => setMobileActionsOpen(false)}>
              <AppBar position="sticky" elevation={1} sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>
                <Toolbar>
                  <IconButton edge="start" color="inherit" onClick={() => setMobileActionsOpen(false)} aria-label="close">
                    <CloseIcon />
                  </IconButton>
                  <Typography sx={{ ml: 2, flex: 1, fontWeight: 700 }}>Filters & Actions</Typography>
                  <Button color="primary" onClick={() => setMobileActionsOpen(false)}>Close</Button>
                </Toolbar>
              </AppBar>

              <DialogContent sx={{ p: 2 }}>
                <Stack spacing={2}>
                  {/* Filters */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#6b7280' }}>
                      📊 Filters
                    </Typography>

                    <Stack spacing={1.5}>
                      <TextField
                        select
                        size="small"
                        label="Brand"
                        value={brandFilter}
                        onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                        fullWidth
                        sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}
                      >
                        <MenuItem value="">All Brands</MenuItem>
                        {brandOptions.map((brand) => (
                          <MenuItem key={brand} value={brand}>{brand}</MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        select
                        size="small"
                        label="Category"
                        value={categoryFilter}
                        onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                        fullWidth
                        sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}
                      >
                        <MenuItem value="">All Categories</MenuItem>
                        {categoryOptions.map((cat) => (
                          <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        select
                        size="small"
                        label="Source"
                        value={sourceFilter}
                        onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                        fullWidth
                        sx={{ '& .MuiOutlinedInput-root': { height: 40 } }}
                      >
                        <MenuItem value="">All Sources</MenuItem>
                        <MenuItem value="QC">QC</MenuItem>
                        <MenuItem value="INBOUND">INBOUND</MenuItem>
                        <MenuItem value="MASTER">MASTER</MenuItem>
                      </TextField>
                    </Stack>
                  </Box>

                  {/* Action Buttons */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#6b7280' }}>
                      ⚡ Actions
                    </Typography>

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                      <Button
                        variant="outlined"
                        startIcon={<FilterListIcon />}
                        onClick={handleListReset}
                        sx={{ height: 44, fontSize: '0.85rem' }}
                      >
                        Clear
                      </Button>

                      <Button
                        variant="outlined"
                        startIcon={<SettingsIcon />}
                        onClick={() => { setListColumnSettingsOpen(true); }}
                        sx={{ height: 44, fontSize: '0.85rem' }}
                      >
                        Columns
                      </Button>

                      <Button
                        variant="outlined"
                        startIcon={<SettingsIcon />}
                        onClick={() => { setGridSettingsOpen(true); }}
                        sx={{ height: 44, fontSize: '0.85rem' }}
                      >
                        Grid
                      </Button>

                      <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => { setExportDialogOpen(true); setMobileActionsOpen(false); }}
                        sx={{ height: 44, fontSize: '0.85rem' }}
                      >
                        Export
                      </Button>

                      <Button
                        variant="outlined"
                        startIcon={refreshing ? <CircularProgress size={14} /> : refreshSuccess ? <CheckIcon sx={{ color: '#10b981' }} /> : <RefreshIcon />}
                        onClick={() => loadPickingList({ buttonRefresh: true })}
                        disabled={refreshing}
                        sx={{ height: 44, fontSize: '0.85rem', gridColumn: 'span 2' }}
                      >
                        {refreshing ? 'Refreshing...' : refreshSuccess ? 'Refreshed' : 'Refresh'}
                      </Button>
                    </Box>
                  </Box>
                </Stack>
              </DialogContent>

              <Box sx={{ position: 'sticky', bottom: 0, left: 0, right: 0, bgcolor: 'background.paper', p: 2, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 1 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => {
                    setBrandFilter('');
                    setCategoryFilter('');
                    setSourceFilter('');
                    setPage(1);
                  }}
                  sx={{ height: 48 }}
                >
                  Reset Filters
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => { setPage(1); setMobileActionsOpen(false); }}
                  sx={{ height: 48 }}
                >
                  Apply
                </Button>
              </Box>
            </Dialog>

            {/* Export Dialog */}
            <Dialog
              open={exportDialogOpen}
              onClose={() => setExportDialogOpen(false)}
              maxWidth="md"
              fullWidth
              PaperProps={{
                sx: {
                  borderRadius: 3,
                  boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                  overflow: 'hidden'
                }
              }}
            >
              <DialogTitle sx={{
                fontWeight: 800,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                py: 3,
                px: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5
              }}>
                <DownloadIcon sx={{ fontSize: '1.5rem' }} />
                Advanced Export Options
                <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.8, fontSize: '0.7rem' }}>
                  Filter & Download
                </Typography>
              </DialogTitle>

              <DialogContent sx={{ py: 4, px: 3 }}>
                <Stack spacing={3}>
                  {/* CURRENT FILTERS PREVIEW */}
                  <Alert
                    severity="info"
                    icon={<InfoIcon />}
                    sx={{
                      fontSize: '0.85rem',
                      borderRadius: 2,
                      '& .MuiAlert-icon': { color: '#0ea5e9' }
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#0ea5e9' }}>
                      📋 Applied Filters Preview:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {exportStartDate && (
                        <Chip size="small" label={`📅 From: ${exportStartDate}`} sx={{ bgcolor: '#e0e7ff', color: '#3730a3' }} />
                      )}
                      {exportEndDate && (
                        <Chip size="small" label={`📅 To: ${exportEndDate}`} sx={{ bgcolor: '#e0e7ff', color: '#3730a3' }} />
                      )}
                      {exportCustomer && (
                        <Chip size="small" label={`👤 ${exportCustomer}`} sx={{ bgcolor: '#dcfce7', color: '#166534' }} />
                      )}
                      {(exportBatchIds && exportBatchIds.length > 0) && (
                        <Chip size="small" label={`📦 ${exportBatchIds.length} Batch${exportBatchIds.length > 1 ? 'es' : ''}`} sx={{ bgcolor: '#f3e8ff', color: '#6b21a8' }} />
                      )}
                      {!exportStartDate && !exportEndDate && !exportCustomer && (!exportBatchIds || exportBatchIds.length === 0) && (
                        <Chip size="small" label="📊 All Data" sx={{ bgcolor: '#fee2e2', color: '#dc2626' }} />
                      )}
                    </Box>
                  </Alert>

                  {/* DIVIDER */}
                  <Divider sx={{ '&::before, &::after': { borderColor: '#e5e7eb' } }}>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 2,
                      py: 0.5,
                      bgcolor: '#f9fafb',
                      borderRadius: 2,
                      border: '1px solid #e5e7eb'
                    }}>
                      <SettingsIcon sx={{ fontSize: '1rem', color: '#6b7280' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280' }}>
                        Filter Options
                      </Typography>
                    </Box>
                  </Divider>

                  {/* DATE RANGE */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                    <TextField
                      fullWidth
                      label="Start Date"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#10b981' },
                          '&.Mui-focused fieldset': { borderColor: '#10b981' }
                        }
                      }}
                    />
                    <TextField
                      fullWidth
                      label="End Date"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#10b981' },
                          '&.Mui-focused fieldset': { borderColor: '#10b981' }
                        }
                      }}
                    />
                  </Box>

                  {/* CUSTOMER */}
                  <Autocomplete
                    freeSolo
                    options={exportCustomerOptions}
                    value={exportCustomer}
                    onChange={(event, newValue) => setExportCustomer(newValue || '')}
                    onInputChange={(event, newInputValue) => setExportCustomer(newInputValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Customer Name"
                        placeholder="Select or type customer name..."
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            '&:hover fieldset': { borderColor: '#10b981' },
                            '&.Mui-focused fieldset': { borderColor: '#10b981' }
                          }
                        }}
                      />
                    )}
                    noOptionsText="No customers found"
                  />

                  {/* BATCH SELECTION */}
                  <FormControl fullWidth>
                    <InputLabel sx={{ '&.Mui-focused': { color: '#10b981' } }}>
                      Select Batch IDs (Multiple)
                    </InputLabel>
                    <Select
                      multiple
                      value={exportBatchIds}
                      onChange={(e: any) => setExportBatchIds(e.target.value as string[])}
                      renderValue={(selected: string[]) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value: string) => (
                            <Chip
                              key={value}
                              label={value}
                              size="small"
                              onDelete={() => setExportBatchIds(exportBatchIds.filter(b => b !== value))}
                              sx={{
                                bgcolor: '#10b981',
                                color: 'white',
                                '& .MuiChip-deleteIcon': { color: 'white', '&:hover': { color: '#a7f3d0' } }
                              }}
                            />
                          ))}
                        </Box>
                      )}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#10b981' },
                          '&.Mui-focused fieldset': { borderColor: '#10b981' }
                        }
                      }}
                    >
                      {batches.map(b => (
                        <MenuItem key={b.batch_id} value={b.batch_id} sx={{ py: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {b.batch_id}
                            </Typography>
                            <Chip
                              label={`${b.count} entries`}
                              size="small"
                              sx={{
                                bgcolor: '#e5e7eb',
                                color: '#374151',
                                fontSize: '0.7rem',
                                height: '20px'
                              }}
                            />
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* EXPORT SUMMARY */}
                  <Card sx={{
                    bgcolor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 2
                  }}>
                    <CardContent sx={{ py: 2, px: 3 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#166534', mb: 1 }}>
                        📊 Export Summary:
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#166534' }}>
                        This will export filtered picking records to Excel with all selected criteria applied.
                        The file will include product details, dates, and batch information.
                      </Typography>
                    </CardContent>
                  </Card>
                </Stack>
              </DialogContent>

              <DialogActions sx={{
                p: 3,
                bgcolor: '#f9fafb',
                borderTop: '1px solid #e5e7eb',
                gap: 1
              }}>
                <Button
                  onClick={() => setExportDialogOpen(false)}
                  sx={{
                    borderRadius: 2,
                    px: 3,
                    fontWeight: 600,
                    color: '#6b7280',
                    '&:hover': { bgcolor: '#e5e7eb' }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleAdvancedExport}
                  startIcon={<DownloadIcon />}
                  sx={{
                    borderRadius: 2,
                    px: 4,
                    py: 1.5,
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    }
                  }}
                >
                  Export to Excel
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        )}

        {/* ========== TAB 1: MULTI PICKING (AG GRID) ========== */}
        {tabValue === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 175px)', gap: 1, mt: 0 }}>
            {/* HEADER */}
            <Card sx={{ borderRadius: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: 1.2, '&:last-child': { pb: 1.2 } }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'auto 1fr auto' }, gap: 1, alignItems: 'center', width: '100%' }}>

                  {/* LEFT: Picking Date + Picker Name (mobile: span both columns on first row) */}
                  <Box sx={{ gridColumn: { xs: '1 / span 2', md: '1 / span 1' }, display: 'flex', gap: { xs: 0.5, md: 1 }, alignItems: 'center', width: '100%' }}>
                    <TextField
                      label="Picking Date"
                      type="date"
                      value={pickingDate}
                      onChange={(e) => setPickingDate(e.target.value)}
                      size="small"
                      sx={{ flex: { xs: '0 0 45%', md: '0 0 35%' }, minWidth: { xs: '45%', md: 80 }, maxWidth: { md: 150 } }}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      label="Picker Name"
                      value={pickerName}
                      onChange={(e) => setPickerName(e.target.value)}
                      size="small"
                      sx={{ flex: { xs: '1 1 55%', md: '1 1 65%' }, minWidth: { xs: 100, md: 100 } }}
                    />
                  </Box>

                  {/* MIDDLE: Customer (on mobile occupies left column second row) */}
                  <Box sx={{ gridColumn: { xs: '1 / span 1', md: '2 / span 1' }, width: '100%', mt: { xs: 1, md: 0 } }}>
                    <Autocomplete
                      freeSolo
                      options={customers}
                      value={selectedCustomer}
                      onChange={(event, newValue) => setSelectedCustomer(newValue || '')}
                      onInputChange={(event, newInputValue) => setSelectedCustomer(newInputValue)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Customer Name"
                          placeholder="Type to search or select..."
                          size="small"
                          sx={{ width: '100%' }}
                        />
                      )}
                      noOptionsText="No customers found"
                      sx={{ width: '100%' }}
                    />
                  </Box>

                  {/* RIGHT: Actions */}
                  <Box sx={{ gridColumn: { xs: '2 / span 1', md: '3 / span 1' }, display: 'flex', gap: 0.5, justifyContent: { xs: 'flex-end', md: 'flex-end' }, alignItems: 'center', pt: { xs: 0.5, md: 0 } }}>
                    <Button size="small" variant="outlined" onClick={() => setColumnSettingsOpen(true)} sx={{ fontSize: '0.7rem', fontWeight: 700, px: 0.6, height: { xs: 40, md: 'auto' }, textTransform: 'none', minWidth: { xs: 92, md: 'auto' } }}>⚙️ Columns</Button>
                    <Button size="small" variant="contained" onClick={add30Rows} sx={{ fontSize: '0.7rem', fontWeight: 700, background: '#ec4899', px: 0.6, height: { xs: 40, md: 'auto' }, minWidth: { xs: 92, md: 'auto' } }}>+30 Add Rows</Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* ERROR */}
            {crossWarehouseWSNs.size > 0 && (
              <Alert severity="error" sx={{ mb: 0.5, fontWeight: 700 }}>
                ❌ Some WSNs are already picked. Remove them to proceed.
              </Alert>
            )}

            {gridDuplicateWSNs.size > 0 && (
              <Alert severity="warning" sx={{ mb: 0.5, fontWeight: 700 }}>
                ⚠️ Duplicate WSNs found inside the grid.
              </Alert>
            )}

            {/* AG GRID */}
            <Box
              sx={{
                flex: 1,
                border: '1px solid #cbd5e1',
                borderRadius: 0,
                '& .ag-root-wrapper': { borderRadius: 0 },
                '& .ag-header': { borderBottom: '1px solid #cbd5e1' },
                '& .ag-header-cell': {
                  backgroundColor: '#e5e7eb',
                  color: '#111827',
                  fontWeight: 700,
                  borderRight: '1px solid #d1d5db',
                  fontSize: '11px',
                  padding: '0 4px',
                },
                '& .ag-cell': {
                  borderRight: '1px solid #e5e7eb',
                  borderBottom: '1px solid #e5e7eb',
                  fontSize: '11px',
                  padding: '1px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                },
                '& .ag-row': { height: 26, overflow: 'visible' },
                '& .ag-row-even': { backgroundColor: '#ffffff' },
                '& .ag-row-odd': { backgroundColor: '#f9fafb' },
                '& .ag-cell-focus': {
                  border: '2px solid #2563eb !important',
                  boxSizing: 'border-box',
                },
                '& .ag-cell-range-selected': { backgroundColor: '#dbeafe !important' },
                '& .ag-cell-range-single-cell': { backgroundColor: '#eff6ff !important' },
                '& .ag-row-hover': { backgroundColor: '#e5f3ff !important' },
                '& .ag-row-focus': { outline: '1px solid #60a5fa' },
              }}
            >
              <AgGridReact
                ref={gridRef}
                onGridReady={(params: any) => {
                  gridRef.current = params.api;
                  columnApiRef.current = params.columnApi;
                  // small delay to allow rendering then autosize
                  setTimeout(() => {
                    try {
                      const colApi = columnApiRef.current;
                      if (!colApi) return;
                      const allCols = colApi.getAllColumns ? colApi.getAllColumns().map((c: any) => c.getColId()) : [];
                      if (allCols.length > 0) {
                        colApi.autoSizeColumns(allCols, false);
                        // if total width less than grid, stretch
                        const api = gridRef.current;
                        let total = 0;
                        for (const id of allCols) {
                          const col = colApi.getColumn(id);
                          total += col?.getActualWidth ? col.getActualWidth() : 0;
                        }
                        const dims = api.getSize ? api.getSize() : (api.gridPanel && api.gridPanel.getBodyClientRect && api.gridPanel.getBodyClientRect());
                        const gridW = dims?.width || 0;
                        if (gridW && total < gridW) api.sizeColumnsToFit();
                      }
                    } catch { /* ignore */ }
                  }, 50);
                }}
                rowData={multiRows}
                columnDefs={columnDefs}
                rowHeight={26}
                getRowId={(params) => params.data.id}
                defaultColDef={{
                  sortable: false,
                  filter: false,
                  resizable: true,
                  editable: (params) => {
                    const field = params.colDef.field as string;
                    const wsn = params.data?.wsn?.trim()?.toUpperCase();

                    if (!wsn) return EDITABLE_COLUMNS.includes(field);
                    if (crossWarehouseWSNs.has(wsn)) return false;
                    if (gridDuplicateWSNs.has(wsn)) return field === 'wsn';
                    return EDITABLE_COLUMNS.includes(field);
                  },
                }}
                stopEditingWhenCellsLoseFocus={true}
                enterNavigatesVertically={true}
                enterNavigatesVerticallyAfterEdit={true}
                navigateToNextCell={navigateToNextCell}
                ensureDomOrder={true}
                suppressRowClickSelection={true}
                suppressMovableColumns={true}
                rowBuffer={5}
                //theme="legacy"
                className="ag-theme-quartz"
                containerStyle={{ height: '100%', width: '100%' }}
                onGridSizeChanged={() => {
                  try {
                    const colApi = columnApiRef.current;
                    const api = gridRef.current;
                    if (!colApi || !api) return;
                    const allCols = colApi.getAllColumns ? colApi.getAllColumns().map((c: any) => c.getColId()) : [];
                    if (!allCols || allCols.length === 0) return;
                    colApi.autoSizeColumns(allCols, false);
                    let total = 0;
                    for (const id of allCols) {
                      const col = colApi.getColumn(id);
                      total += col?.getActualWidth ? col.getActualWidth() : 0;
                    }
                    const dims = api.getSize ? api.getSize() : (api.gridPanel && api.gridPanel.getBodyClientRect && api.gridPanel.getBodyClientRect());
                    const gridW = dims?.width || 0;
                    if (gridW && total < gridW) api.sizeColumnsToFit();
                  } catch { /* ignore */ }
                }}
                onFirstDataRendered={() => {
                  // ensure columns fit on first render
                  try {
                    const colApi = columnApiRef.current;
                    const api = gridRef.current;
                    if (!colApi || !api) return;
                    const allCols = colApi.getAllColumns ? colApi.getAllColumns().map((c: any) => c.getColId()) : [];
                    if (allCols.length === 0) return;
                    colApi.autoSizeColumns(allCols, false);
                    let total = 0;
                    for (const id of allCols) {
                      const col = colApi.getColumn(id);
                      total += col?.getActualWidth ? col.getActualWidth() : 0;
                    }
                    const dims = api.getSize ? api.getSize() : (api.gridPanel && api.gridPanel.getBodyClientRect && api.gridPanel.getBodyClientRect());
                    const gridW = dims?.width || 0;
                    if (gridW && total < gridW) api.sizeColumnsToFit();
                  } catch { /* ignore */ }
                }}

                onCellEditingStopped={async (event: any) => {
                  const field = event.colDef?.field;
                  const value = event.value;
                  const node = event.node;
                  const rowIndex = event.rowIndex;

                  if (field !== 'wsn') return;

                  const wsn = value?.trim()?.toUpperCase();

                  // If WSN is cleared/deleted, reset all product fields
                  if (!wsn) {
                    // Clear all product and master data fields
                    node.setDataValue('product_title', '');
                    node.setDataValue('brand', '');
                    node.setDataValue('cms_vertical', '');
                    node.setDataValue('fsp', '');
                    node.setDataValue('mrp', '');
                    node.setDataValue('rack_no', '');
                    node.setDataValue('source', '');
                    node.setDataValue('batch_id', '');
                    node.setDataValue('hsn_sac', '');
                    node.setDataValue('igst_rate', '');
                    node.setDataValue('p_type', '');
                    node.setDataValue('p_size', '');
                    node.setDataValue('vrp', '');
                    node.setDataValue('wid', '');
                    node.setDataValue('fsn', '');
                    node.setDataValue('order_id', '');
                    node.setDataValue('fkqc_remark', '');
                    node.setDataValue('fk_grade', '');
                    node.setDataValue('invoice_date', '');
                    node.setDataValue('fkt_link', '');
                    node.setDataValue('wh_location', '');
                    node.setDataValue('yield_value', '');
                    node.setDataValue('product_serial_number', '');

                    // Also update React state
                    setMultiRows((prev) => {
                      const rows = [...prev];
                      rows[rowIndex] = {
                        ...rows[rowIndex],
                        wsn: '',
                        product_title: '',
                        brand: '',
                        cms_vertical: '',
                        fsp: '',
                        mrp: '',
                        rack_no: '',
                        source: '',
                        batch_id: '',
                        hsn_sac: '',
                        igst_rate: '',
                        p_type: '',
                        p_size: '',
                        vrp: '',
                        wid: '',
                        fsn: '',
                        order_id: '',
                        fkqc_remark: '',
                        fk_grade: '',
                        invoice_date: '',
                        fkt_link: '',
                        wh_location: '',
                        yield_value: '',
                        product_serial_number: ''
                      };
                      checkDuplicates(rows);
                      return rows;
                    });
                    return; // Exit early after clearing fields
                  }

                  // Immediate grid-level duplicate or existing pick check
                  const immediateCounts = new Map<string, number>();
                  multiRows.forEach((r: any) => {
                    const rv = r.wsn?.trim()?.toUpperCase();
                    if (rv) immediateCounts.set(rv, (immediateCounts.get(rv) || 0) + 1);
                  });

                  const isGridDuplicateImmediate = (immediateCounts.get(wsn) || 0) > 1;

                  if (isGridDuplicateImmediate) {
                    // Styled toast like QC/Inbounds
                    toast(`Duplicate WSN in grid: ${wsn}`, {
                      duration: 2500,
                      style: {
                        background: '#ffffff',
                        color: '#d97706',
                        border: '2px solid #f59e0b',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        fontWeight: 600,
                        fontSize: '14px',
                      },
                      icon: '⚠️',
                    });

                    // Clear the cell and master columns
                    node.setDataValue('wsn', '');
                    ALL_MASTER_COLUMNS.forEach((col) => {
                      node.setDataValue(col, null);
                    });
                    node.setDataValue('product_serial_number', null);

                    // Update react state
                    setMultiRows((prev) => {
                      const rows = [...prev];
                      rows[rowIndex] = { ...rows[rowIndex], wsn: '' };
                      ALL_MASTER_COLUMNS.forEach(col => (rows[rowIndex][col] = null));
                      rows[rowIndex]['product_serial_number'] = null;
                      checkDuplicates(rows);
                      return rows;
                    });

                    // Re-focus same cell for quick correction
                    setTimeout(() => {
                      event.api.startEditingCell({
                        rowIndex: rowIndex,
                        colKey: 'wsn',
                      });
                    }, 100);

                    return;
                  }

                  if (existingPickingWSNs.has(wsn)) {
                    // Determine whether it's in this warehouse or another warehouse
                    try {
                      const resp = await pickingAPI.checkWSNExists(wsn, activeWarehouse?.id);
                      const existsHere = resp.data?.exists;

                      if (existsHere) {
                        // Same-warehouse duplicate → warn + clear
                        toast(`WSN ${wsn} already picked in this warehouse`, {
                          duration: 2500,
                          style: {
                            background: '#ffffff',
                            color: '#d97706',
                            border: '2px solid #f59e0b',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            fontWeight: 600,
                            fontSize: '14px',
                          },
                          icon: '⚠️',
                        });

                      } else {
                        // Cross-warehouse → error + clear
                        toast.error(`WSN ${wsn} already picked in another warehouse`, {
                          duration: 3000,
                          style: {
                            background: '#ffffff',
                            color: '#dc2626',
                            border: '2px solid #dc2626',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            fontWeight: 600,
                            fontSize: '14px',
                          },
                          icon: '🚫',
                        });
                      }

                      // Clear cell + master fields and update state
                      node.setDataValue('wsn', '');
                      ALL_MASTER_COLUMNS.forEach((col) => {
                        node.setDataValue(col, null);
                      });
                      node.setDataValue('product_serial_number', null);

                      setMultiRows((prev) => {
                        const rows = [...prev];
                        rows[rowIndex] = { ...rows[rowIndex], wsn: '' };
                        ALL_MASTER_COLUMNS.forEach(col => (rows[rowIndex][col] = null));
                        rows[rowIndex]['product_serial_number'] = null;
                        checkDuplicates(rows);
                        return rows;
                      });

                      // Re-focus same cell
                      setTimeout(() => {
                        event.api.startEditingCell({ rowIndex: rowIndex, colKey: 'wsn' });
                      }, 100);

                      return;
                    } catch (err) {
                      // On API error, fall through to master data fetch (best-effort)
                    }
                  }

                  try {
                    const res = await pickingAPI.getSourceByWSN(
                      wsn,
                      activeWarehouse?.id
                    );

                    const d = res.data;
                    console.log('BACKEND DATA:', d);

                    // GUARD: ensure cell wasn't cleared in the meantime
                    const currentWsn = node?.data?.wsn?.trim()?.toUpperCase();
                    if (!currentWsn || currentWsn !== wsn) return;

                    // 🔥 UPDATE AG GRID CELLS DIRECTLY
                    node.setDataValue('product_title', d.product_title ?? '');
                    node.setDataValue('brand', d.brand ?? '');
                    node.setDataValue('cms_vertical', d.cms_vertical ?? '');
                    node.setDataValue('fsp', d.fsp ?? '');
                    node.setDataValue('mrp', d.mrp ?? '');
                    node.setDataValue('rack_no', d.rack_no ?? '');
                    node.setDataValue('hsn_sac', d.hsn_sac ?? '');
                    node.setDataValue('igst_rate', d.igst_rate ?? '');
                    node.setDataValue('p_type', d.p_type ?? '');
                    node.setDataValue('p_size', d.p_size ?? '');
                    node.setDataValue('vrp', d.vrp ?? '');
                    node.setDataValue('wid', d.wid ?? '');
                    node.setDataValue('fsn', d.fsn ?? '');
                    node.setDataValue('order_id', d.order_id ?? '');
                    node.setDataValue('fkqc_remark', d.fkqc_remark ?? '');
                    node.setDataValue('fk_grade', d.fk_grade ?? '');
                    node.setDataValue('invoice_date', d.invoice_date ?? '');
                    node.setDataValue('fkt_link', d.fkt_link ?? '');
                    node.setDataValue('wh_location', d.wh_location ?? '');
                    node.setDataValue('yield_value', d.yield_value ?? '');
                    node.setDataValue('source', d.source ?? '');

                    // 🔥 ALSO UPDATE REACT STATE FOR CONSISTENCY
                    setMultiRows((prev) => {
                      const rows = [...prev];
                      rows[rowIndex] = {
                        ...rows[rowIndex],
                        wsn,
                        product_title: d.product_title ?? '',
                        brand: d.brand ?? '',
                        cms_vertical: d.cms_vertical ?? '',
                        fsp: d.fsp ?? '',
                        mrp: d.mrp ?? '',
                        rack_no: d.rack_no ?? '',
                        hsn_sac: d.hsn_sac ?? '',
                        igst_rate: d.igst_rate ?? '',
                        p_type: d.p_type ?? '',
                        p_size: d.p_size ?? '',
                        vrp: d.vrp ?? '',
                        wid: d.wid ?? '',
                        fsn: d.fsn ?? '',
                        order_id: d.order_id ?? '',
                        fkqc_remark: d.fkqc_remark ?? '',
                        fk_grade: d.fk_grade ?? '',
                        invoice_date: d.invoice_date ?? '',
                        fkt_link: d.fkt_link ?? '',
                        wh_location: d.wh_location ?? '',
                        yield_value: d.yield_value ?? '',
                        source: d.source ?? ''
                      };
                      checkDuplicates(rows);
                      return rows;
                    });
                  } catch (err: any) {
                    console.error('Picking source fetch error:', err);

                    // If not found in picking sources, try inbound master data as a fallback
                    if (err?.response?.status === 404) {
                      try {
                        const inboundResp = await inboundAPI.getMasterDataByWSN(wsn);
                        const md = inboundResp.data;

                        // Update grid cells from inbound master data
                        node.setDataValue('product_title', md.product_title ?? '');
                        node.setDataValue('brand', md.brand ?? '');
                        node.setDataValue('cms_vertical', md.cms_vertical ?? '');
                        node.setDataValue('fsp', md.fsp ?? '');
                        node.setDataValue('mrp', md.mrp ?? '');
                        node.setDataValue('rack_no', md.rack_no ?? '');
                        node.setDataValue('hsn_sac', md.hsn_sac ?? '');
                        node.setDataValue('igst_rate', md.igst_rate ?? '');
                        node.setDataValue('p_type', md.p_type ?? '');
                        node.setDataValue('p_size', md.p_size ?? '');
                        node.setDataValue('vrp', md.vrp ?? '');
                        node.setDataValue('wid', md.wid ?? '');
                        node.setDataValue('fsn', md.fsn ?? '');
                        node.setDataValue('order_id', md.order_id ?? '');
                        node.setDataValue('fkqc_remark', md.fkqc_remark ?? '');
                        node.setDataValue('fk_grade', md.fk_grade ?? '');
                        node.setDataValue('invoice_date', md.invoice_date ?? '');
                        node.setDataValue('fkt_link', md.fkt_link ?? '');
                        node.setDataValue('wh_location', md.wh_location ?? '');
                        node.setDataValue('yield_value', md.yield_value ?? '');
                        node.setDataValue('source', md.source ?? '');

                        // Also update React state
                        setMultiRows((prev) => {
                          const rows = [...prev];
                          rows[rowIndex] = {
                            ...rows[rowIndex],
                            wsn,
                            product_title: md.product_title ?? '',
                            brand: md.brand ?? '',
                            cms_vertical: md.cms_vertical ?? '',
                            fsp: md.fsp ?? '',
                            mrp: md.mrp ?? '',
                            rack_no: md.rack_no ?? '',
                            hsn_sac: md.hsn_sac ?? '',
                            igst_rate: md.igst_rate ?? '',
                            p_type: md.p_type ?? '',
                            p_size: md.p_size ?? '',
                            vrp: md.vrp ?? '',
                            wid: md.wid ?? '',
                            fsn: md.fsn ?? '',
                            order_id: md.order_id ?? '',
                            fkqc_remark: md.fkqc_remark ?? '',
                            fk_grade: md.fk_grade ?? '',
                            invoice_date: md.invoice_date ?? '',
                            fkt_link: md.fkt_link ?? '',
                            wh_location: md.wh_location ?? '',
                            yield_value: md.yield_value ?? '',
                            source: md.source ?? ''
                          };
                          checkDuplicates(rows);
                          return rows;
                        });

                        toast.success(`✓ Source data loaded from Inbound for ${wsn}`);
                        return;
                      } catch (inErr) {
                        console.error('Inbound fallback failed:', inErr);
                      }
                    }

                    toast.error(`WSN ${wsn} not found`);
                    node.setDataValue('wsn', '');
                    setTimeout(() => {
                      event.api.startEditingCell({ rowIndex: rowIndex, colKey: 'wsn' });
                    }, 100);
                  }
                }}

              />
            </Box>

            {/* SUBMIT BUTTON */}
            <Button
              fullWidth
              variant="contained"
              size="medium"
              onClick={handleMultiSubmit}
              disabled={multiLoading || gridDuplicateWSNs.size > 0 || crossWarehouseWSNs.size > 0}
              sx={{
                py: 1,
                borderRadius: 1.5,
                fontWeight: 800,
                fontSize: '0.8rem',
                background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
              }}
            >
              ✓ SUBMIT ALL ({multiRows.filter((r) => r.wsn?.trim()).length} rows)
            </Button>

            {/* COLUMN SETTINGS DIALOG */}
            <Dialog
              open={columnSettingsOpen}
              onClose={() => setColumnSettingsOpen(false)}
              maxWidth="sm"
              fullWidth
              PaperProps={{ sx: { borderRadius: 2 } }}
            >
              <DialogTitle sx={{ fontWeight: 800, background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)', color: 'white', py: 2 }}>
                📋 Column Settings
              </DialogTitle>
              <DialogContent sx={{ mt: 2 }}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    Editable Columns
                  </Typography>

                  {/* Locked S.No column — always visible */}
                  <FormControlLabel
                    key="sno"
                    control={<Checkbox checked={visibleColumns.includes('sno')} disabled />}
                    label="S. No"
                  />

                  {EDITABLE_COLUMNS.map((col) => (
                    <FormControlLabel
                      key={col}
                      control={
                        <Checkbox
                          checked={visibleColumns.includes(col)}
                          onChange={() => {
                            if (visibleColumns.includes(col)) {
                              if (visibleColumns.length === 1) {
                                toast.error('At least one column must be visible');
                                return;
                              }
                              setVisibleColumns(visibleColumns.filter(c => c !== col));
                            } else {
                              setVisibleColumns([...visibleColumns, col]);
                            }
                          }}
                        />
                      }
                      label={col.replace(/_/g, ' ').toUpperCase()}
                    />
                  ))}

                  <Divider sx={{ my: 1 }} />

                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    Master Data Columns (Read-only)
                  </Typography>
                  {ALL_MASTER_COLUMNS.map((col) => (
                    <FormControlLabel
                      key={col}
                      control={
                        <Checkbox
                          checked={visibleColumns.includes(col)}
                          onChange={() => {
                            if (visibleColumns.includes(col)) {
                              setVisibleColumns(visibleColumns.filter(c => c !== col));
                            } else {
                              setVisibleColumns([...visibleColumns, col]);
                            }
                          }}
                        />
                      }
                      label={col.replace(/_/g, ' ').toUpperCase()}
                    />
                  ))}
                </Stack>
              </DialogContent>
              <DialogActions sx={{ p: 2 }}>
                <Button onClick={() => setColumnSettingsOpen(false)} variant="outlined">Close</Button>
                <Button onClick={() => setVisibleColumns(DEFAULT_MULTI_COLUMNS)} variant="contained" sx={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)' }}>
                  Reset to Default
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        )}

        {/* ========== TAB 2: BATCH MANAGEMENT ========== */}
        {tabValue === 2 && (
          <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ p: 2, bgcolor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Batch Management</Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Batch ID</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Item Count</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Created At</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batchLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <CircularProgress size={30} />
                      </TableCell>
                    </TableRow>
                  ) : batches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <Typography variant="h6">📭 No batches found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    batches.map((batch) => (
                      <TableRow key={batch.batch_id} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                        <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{batch.batch_id}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{batch.count}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{formatDateFull(batch.created_at)}</TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            startIcon={<DeleteIcon />}
                            onClick={() => handleDeleteBatch(batch.batch_id)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Box>
    </AppLayout >
  );
}
