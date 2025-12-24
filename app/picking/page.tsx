// File Path = warehouse-frontend\app\picking\page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Stack, Tab, Tabs,
  CircularProgress, Alert, IconButton, Autocomplete, Checkbox, FormControlLabel,
  Card, CardContent, LinearProgress, Divider
} from '@mui/material';
import {
  Add as AddIcon, Download as DownloadIcon, Settings as SettingsIcon,
  CheckCircle as CheckIcon, Delete as DeleteIcon, Refresh as RefreshIcon, Visibility as VisibilityIcon
} from '@mui/icons-material';
import { pickingAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useRoleGuard } from '@/hooks/useRoleGuard';

// Register AG Grid modules ONCE
ModuleRegistry.registerModules([AllCommunityModule]);

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

// ALL MASTER DATA COLUMNS
const ALL_MASTER_COLUMNS = [
  'wid', 'fsn', 'order_id', 'product_title', 'brand', 'mrp', 'fsp',
  'hsn_sac', 'igst_rate', 'cms_vertical', 'fkt_link', 'p_type', 'p_size',
  'vrp', 'yield_value', 'wh_location', 'fkqc_remark', 'fk_grade'
];

// DEFAULT VISIBLE COLUMNS FOR MULTI ENTRY
const DEFAULT_MULTI_COLUMNS = [
  'wsn', 'picking_remarks', 'product_title', 'brand', 'cms_vertical',
  'fsp', 'mrp', 'rack_no'
];

// EDITABLE COLUMNS IN MULTI ENTRY
const EDITABLE_COLUMNS = ['wsn', 'picking_remarks'];

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
  useRoleGuard(['admin', 'manager', 'picker']);

  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);
  const gridRef = useRef<any>(null);

  // Tab state
  const [tabValue, setTabValue] = useState(0);

  // Multi Entry Header state
  const [pickingDate, setPickingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customers, setCustomers] = useState<string[]>([]);
  const [pickerName, setPickerName] = useState<string>('');

  // Multi Entry state with AG Grid
  let rowIdCounter = 0;
  const generateEmptyRows = (count: number) => {
    return Array.from({ length: count }, () => {
      rowIdCounter++;
      return {
        id: `row-${rowIdCounter}`,
        wsn: '',
        picking_date: new Date().toISOString().split('T')[0],
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
        source: ''
      };
    });
  };

  const [multiRows, setMultiRows] = useState<any[]>(generateEmptyRows(10));
  const [existingWSNs, setExistingWSNs] = useState<string[]>([]);
  const [multiLoading, setMultiLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_MULTI_COLUMNS);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [gridDuplicateWSNs, setGridDuplicateWSNs] = useState<Set<string>>(new Set());
  const [crossWarehouseWSNs, setCrossWarehouseWSNs] = useState<Set<string>>(new Set());
  const [existingPickingWSNs, setExistingPickingWSNs] = useState(new Set());

  // Picking List state
  const [pickingList, setPickingList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  type ColumnConfig = {
    key: string;
    visible: boolean;
  };

  const DEFAULT_LIST_COLUMNS_CONFIG: ColumnConfig[] = ALL_LIST_COLUMNS.map(col => ({
    key: col,
    visible: DEFAULT_LIST_COLUMNS.includes(col),
  }));

  const [listColumns, setListColumns] = useState<ColumnConfig[]>(DEFAULT_LIST_COLUMNS_CONFIG);
  const [listColumnSettingsOpen, setListColumnSettingsOpen] = useState(false);

  // Batch Management state
  const [batches, setBatches] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

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

  // Load picking list when filters change
  useEffect(() => {
    if (activeWarehouse && tabValue === 0) {
      loadPickingList();
    }
  }, [activeWarehouse, tabValue, page, limit, searchFilter, brandFilter, categoryFilter, sourceFilter]);

  // Load batches when batch tab opens
  useEffect(() => {
    if (activeWarehouse && tabValue === 2) {
      loadBatches();
    }
  }, [activeWarehouse, tabValue]);

  // Load list columns from localStorage with validation
  useEffect(() => {
    // Version check - force reset if old version (bump to 3.0 for master data columns)
    const COLUMN_CONFIG_VERSION = '3.0';
    const savedVersion = localStorage.getItem('picking_columns_version');

    if (savedVersion !== COLUMN_CONFIG_VERSION) {
      // Force reset to new config
      console.log('Upgrading column config to version', COLUMN_CONFIG_VERSION);
      setListColumns(DEFAULT_LIST_COLUMNS_CONFIG);
      localStorage.setItem('picking_list_columns', JSON.stringify(DEFAULT_LIST_COLUMNS_CONFIG));
      localStorage.setItem('picking_columns_version', COLUMN_CONFIG_VERSION);
      return;
    }

    const saved = localStorage.getItem('picking_list_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate: ensure all columns from ALL_LIST_COLUMNS exist
        const existingKeys = new Set(parsed.map((c: ColumnConfig) => c.key));
        const allKeysPresent = ALL_LIST_COLUMNS.every(col => existingKeys.has(col));

        if (allKeysPresent && parsed.length === ALL_LIST_COLUMNS.length) {
          setListColumns(parsed);
        } else {
          // Old/invalid data - reset to default
          console.log('Resetting column config - old data detected');
          setListColumns(DEFAULT_LIST_COLUMNS_CONFIG);
          localStorage.setItem('picking_list_columns', JSON.stringify(DEFAULT_LIST_COLUMNS_CONFIG));
        }
      } catch (e) {
        setListColumns(DEFAULT_LIST_COLUMNS_CONFIG);
      }
    } else {
      setListColumns(DEFAULT_LIST_COLUMNS_CONFIG);
      localStorage.setItem('picking_list_columns', JSON.stringify(DEFAULT_LIST_COLUMNS_CONFIG));
    }
  }, []);

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
      setMultiRows(generateEmptyRows(10));
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

  // Load picking list
  const loadPickingList = async () => {
    setLoading(true);
    try {
      const response = await pickingAPI.getList({
        page,
        limit,
        warehouseId: activeWarehouse?.id,
        search: searchFilter,
        brand: brandFilter,
        category: categoryFilter,
        source: sourceFilter
      });

      setPickingList(response.data.data || []);
      setTotal(response.data.pagination?.total || 0);

      // Extract unique brands and categories for filters
      const uniqueBrands = Array.from(new Set(response.data.data.map((item: any) => item.brand).filter(Boolean)));
      const uniqueCategories = Array.from(new Set(response.data.data.map((item: any) => item.cms_vertical).filter(Boolean)));
      setBrandOptions(uniqueBrands as string[]);
      setCategoryOptions(uniqueCategories as string[]);
    } catch (error) {
      console.error('Load picking list error:', error);
      toast.error('Failed to load picking list');
    } finally {
      setLoading(false);
    }
  };

  // Load batches
  const loadBatches = async () => {
    setBatchLoading(true);
    try {
      const response = await pickingAPI.getBatches(activeWarehouse?.id);
      setBatches(response.data || []);
    } catch (error) {
      console.error('Load batches error:', error);
      toast.error('Failed to load batches');
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

  // Export to Excel
  const handleExport = () => {
    const exportData = pickingList.map((item: any) => ({
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
    const filename = `Picking_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`✓ Exported ${exportData.length} records`);
  };

  // Handle list column toggle
  const handleListColumnToggle = (key: string) => {
    const updated = listColumns.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    );
    setListColumns(updated);
    localStorage.setItem('picking_list_columns', JSON.stringify(updated));
  };

  // Column widths for AG Grid
  const COLUMN_WIDTHS: Record<string, any> = {
    wsn: { width: 80 },
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
      headerName: field.replace(/_/g, ' ').toUpperCase(),
      ...widthConfig,
      cellStyle: (params: any) => {
        const wsn = params.data?.wsn?.trim()?.toUpperCase();
        const styles: any = {};

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

    // Read-only for master data columns
    if (ALL_MASTER_COLUMNS.includes(field)) {
      baseColDef.editable = false;
    }

    return baseColDef;
  });

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
        p: { xs: 0.8, md: 1 },
        background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)',
        minHeight: '100vh',
        width: '100%'
      }}>
        {/* HEADER */}
        <Box sx={{
          mb: 0.8,
          p: 0.8,
          background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
          borderRadius: 1,
          boxShadow: '0 8px 24px rgba(245, 158, 11, 0.25)'
        }}>
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', mb: 0.2, fontSize: '0.85rem' }}>
              📦 Picking Management
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip label={activeWarehouse.name} size="small" sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontWeight: 600,
                height: '18px',
                fontSize: '0.65rem'
              }} />
              <Chip label={user?.fullName} size="small" sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontWeight: 500,
                height: '18px',
                fontSize: '0.65rem'
              }} />
            </Stack>
          </Box>
        </Box>

        {/* TABS */}
        <Paper sx={{
          mb: 0.5,
          borderRadius: 1,
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          background: 'rgba(255, 255, 255, 0.95)'
        }}>
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTabs-indicator': {
                height: 3,
                background: 'linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)',
                borderRadius: '2px 2px 0 0'
              },
              '& .MuiTab-root': {
                fontWeight: 600,
                fontSize: '0.7rem',
                textTransform: 'none',
                minHeight: 32,
                py: 0.5
              }
            }}
          >
            <Tab label="Picking List" />
            <Tab label="Multi Picking" />
            <Tab label="Batch Manager" />
          </Tabs>
        </Paper>

        {/* ========== TAB 0: PICKING LIST ========== */}
        {tabValue === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 230px)' }}>
            {/* FILTERS */}
            <Card sx={{ mb: 1, borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', background: 'rgba(255, 255, 255, 0.98)' }}>
              <CardContent sx={{ p: 1 }}>
                <Stack spacing={1}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center">
                    <TextField size="small" placeholder="Search WSN or Product" value={searchFilter} onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }} fullWidth sx={{ '& .MuiOutlinedInput-root': { height: 40 } }} />

                    <TextField
                      select
                      size="small"
                      label="Brand"
                      value={brandFilter}
                      onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                      sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 40 } }}
                    >
                      <MenuItem value="">All Brands</MenuItem>
                      {brandOptions.map(brand => (
                        <MenuItem key={brand} value={brand}>{brand}</MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      select
                      size="small"
                      label="Category"
                      value={categoryFilter}
                      onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                      sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 40 } }}
                    >
                      <MenuItem value="">All Categories</MenuItem>
                      {categoryOptions.map(cat => (
                        <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      select
                      size="small"
                      label="Source"
                      value={sourceFilter}
                      onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                      sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 40 } }}
                    >
                      <MenuItem value="">All Sources</MenuItem>
                      <MenuItem value="QC">QC</MenuItem>
                      <MenuItem value="INBOUND">INBOUND</MenuItem>
                      <MenuItem value="MASTER">MASTER</MenuItem>
                    </TextField>

                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" variant="outlined" onClick={() => { setSearchFilter(''); setBrandFilter(''); setCategoryFilter(''); setSourceFilter(''); setPage(1); }} sx={{ height: 40, minWidth: 70, fontSize: '0.7rem', fontWeight: 700 }}>Clear</Button>
                      <Button size="small" variant="outlined" startIcon={<SettingsIcon />} onClick={() => setListColumnSettingsOpen(true)} sx={{ height: 40, fontSize: '0.7rem', fontWeight: 700 }}>Columns</Button>
                      <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport} sx={{ height: 40, fontSize: '0.7rem', fontWeight: 700 }}>Export</Button>
                      <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={loadPickingList} sx={{ height: 40, fontSize: '0.7rem', fontWeight: 700 }}>Refresh</Button>
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {/* TABLE - Scrollable */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, border: '1px solid #d1d5db', position: 'relative' }}>
              <TableContainer component={Paper} sx={{ borderRadius: 0, boxShadow: 'none', border: 'none', background: '#ffffff', height: '100%' }}>
                <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { borderRight: '1px solid #d1d5db', padding: '4px 8px', fontSize: '0.75rem', minWidth: 120 } }}>
                  <TableHead>
                    <TableRow sx={{ background: '#e5e7eb' }}>
                      <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.5, whiteSpace: 'nowrap' }}>No.</TableCell>
                      {listColumns
                        .filter(c => c.visible)
                        .map(c => (
                          <TableCell
                            key={c.key}
                            sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.5, whiteSpace: 'nowrap' }}
                          >
                            {c.key.replace(/_/g, ' ')}
                          </TableCell>
                        ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={listColumns.length + 1} sx={{ textAlign: 'center', py: 3 }}>
                          <CircularProgress size={30} />
                        </TableCell>
                      </TableRow>
                    ) : pickingList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={listColumns.length + 1} sx={{ textAlign: 'center', py: 3 }}>
                          📭 No data
                        </TableCell>
                      </TableRow>
                    ) : (
                      pickingList.map((item: any, idx) => (
                        <TableRow key={item.id} sx={{ bgcolor: idx % 2 === 0 ? '#ffffff' : '#f9fafb', '&:hover': { bgcolor: '#f0f0f0' } }}>
                          <TableCell sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(page - 1) * limit + idx + 1}</TableCell>
                          {listColumns
                            .filter(c => c.visible)
                            .map(c => (
                              <TableCell key={c.key} sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {c.key === 'picking_date' || c.key === 'invoice_date'
                                  ? formatDate(item[c.key])
                                  : (item[c.key] !== null && item[c.key] !== undefined && item[c.key] !== ''
                                    ? String(item[c.key]).substring(0, 100)
                                    : '-')}
                              </TableCell>
                            ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
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
              <DialogTitle>Column Settings</DialogTitle>
              <DialogContent>
                <Stack spacing={1}>
                  {ALL_LIST_COLUMNS.map((col) => (
                    <FormControlLabel
                      key={col}
                      control={
                        <Checkbox
                          checked={listColumns.find(c => c.key === col)?.visible || false}
                          onChange={() => handleListColumnToggle(col)}
                        />
                      }
                      label={col.replace(/_/g, ' ').toUpperCase()}
                    />
                  ))}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setListColumnSettingsOpen(false)}>Close</Button>
                <Button onClick={() => {
                  setListColumns(DEFAULT_LIST_COLUMNS_CONFIG);
                  localStorage.setItem('picking_list_columns', JSON.stringify(DEFAULT_LIST_COLUMNS_CONFIG));
                }} variant="outlined">Reset</Button>
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
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  {/* COMMON FIELDS */}
                  <TextField
                    label="Picking Date"
                    type="date"
                    value={pickingDate}
                    onChange={(e) => setPickingDate(e.target.value)}
                    size="small"
                    sx={{ width: 150 }}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="Picker Name"
                    value={pickerName}
                    onChange={(e) => setPickerName(e.target.value)}
                    size="small"
                    sx={{ width: 180 }}
                  />
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
                        sx={{ minWidth: 200 }}
                      />
                    )}
                    noOptionsText="No customers found"
                    sx={{ minWidth: 200 }}
                  />

                  {/* STATUS CHIPS */}
                  <Stack direction="row" spacing={0.5} sx={{ ml: 'auto !important' }}>
                    <Chip
                      label={`✅ READY: ${statusCounts.ready}`}
                      sx={{ bgcolor: '#d1fae5', color: '#065f46', fontWeight: 700 }}
                      size="small"
                    />
                    <Chip
                      label={`🟡 DUPLICATE: ${statusCounts.duplicate}`}
                      sx={{ bgcolor: '#fef9c3', color: '#854d0e', fontWeight: 700 }}
                      size="small"
                    />
                    <Chip
                      label={`🔴 PICKED: ${statusCounts.cross}`}
                      sx={{ bgcolor: '#fee2e2', color: '#7f1d1d', fontWeight: 700 }}
                      size="small"
                    />
                  </Stack>

                  <Stack direction="row" spacing={0.8}>
                    <Button size="small" variant="outlined" onClick={() => setColumnSettingsOpen(true)} sx={{ fontSize: '0.7rem', fontWeight: 700 }}>⚙️ Columns</Button>
                    <Button size="small" variant="contained" onClick={add30Rows} sx={{ fontSize: '0.7rem', fontWeight: 700, background: '#ec4899' }}>+30 Add Rows </Button>
                  </Stack>
                </Stack>
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
                theme="legacy"
                ref={gridRef}
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
                theme="legacy"
                className="ag-theme-quartz"
                containerStyle={{ height: '100%', width: '100%' }}

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
                        yield_value: ''
                      };
                      checkDuplicates(rows);
                      return rows;
                    });
                    return; // Exit early after clearing fields
                  }

                  if (existingPickingWSNs.has(wsn)) {
                    toast.error(`WSN ${wsn} already picked`);
                    node.setDataValue('wsn', '');
                    return;
                  }

                  try {
                    const res = await pickingAPI.getSourceByWSN(
                      wsn,
                      activeWarehouse?.id
                    );

                    const d = res.data;
                    console.log('BACKEND DATA:', d);

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
                  } catch (err) {
                    console.error(err);
                    toast.error(`WSN ${wsn} not found`);
                    node.setDataValue('wsn', '');
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
                        <TableCell sx={{ fontSize: '0.8rem' }}>{new Date(batch.created_at).toLocaleString()}</TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteBatch(batch.batch_id)}
                            sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
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
    </AppLayout>
  );
}
