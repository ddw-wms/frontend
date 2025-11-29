'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Stack,
  CircularProgress, Alert, IconButton, Card, Select, FormControl, InputLabel,
  Tooltip, Pagination, Autocomplete, FormControlLabel, Checkbox
} from '@mui/material';
import {
  Download as DownloadIcon, Refresh as RefreshIcon, Visibility as VisibilityIcon,
  FilterList as FilterIcon, Info as InfoIcon, Print as PrintIcon
} from '@mui/icons-material';
import { dashboardAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';

// ✅ Type Definitions
interface InventoryItem {
  wsn: string;
  product_title: string;
  brand: string;
  cms_vertical: string;
  mrp: number;
  fsp: number;
  inbound_date: string;
  inbound_status: string;
  qc_date: string;
  qc_status: string;
  qc_grade: string;
  picking_date: string;
  picking_status: string;
  outbound_date: string;
  outbound_status: string;
  vehicle_no: string;
  warehouse_location: string;
  rack_no: string;
  current_stage: string;
  [key: string]: any;
}

// Column configuration
const ALL_COLUMNS = [
  'wsn', 'product_title', 'brand', 'cms_vertical', 'mrp', 'fsp',
  'inbound_date', 'inbound_status', 'qc_date', 'qc_status', 'qc_grade',
  'picking_date', 'picking_status', 'outbound_date', 'outbound_status', 'vehicle_no',
  'warehouse_location', 'rack_no', 'current_stage'
];

const DEFAULT_VISIBLE_COLUMNS = [
  'wsn', 'product_title', 'brand', 'cms_vertical', 'fsp', 'mrp',
  'inbound_status', 'qc_status', 'picking_status', 'outbound_status', 'current_stage'
];

// Pipeline stages
const PIPELINE_STAGES = [
  { value: 'all', label: 'All Items' },
  { value: 'INBOUND_RECEIVED', label: 'Inbound Received' },
  { value: 'QC_PENDING', label: 'QC Pending' },
  { value: 'QC_PASSED', label: 'QC Passed' },
  { value: 'QC_FAILED', label: 'QC Failed' },
  { value: 'PICKING_PENDING', label: 'Picking Pending' },
  { value: 'PICKING_COMPLETED', label: 'Picking Completed' },
  { value: 'OUTBOUND_READY', label: 'Outbound Ready' },
  { value: 'OUTBOUND_DISPATCHED', label: 'Outbound Dispatched' }
];

export default function DashboardPage() {
  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);

  // Data state
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [filteredData, setFilteredData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [searchWSN, setSearchWSN] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);

  // Metrics
  const [metrics, setMetrics] = useState({
    total: 0,
    inbound: 0,
    qcPending: 0,
    qcPassed: 0,
    qcFailed: 0,
    pickingPending: 0,
    pickingCompleted: 0,
    outboundReady: 0,
    outboundDispatched: 0
  });

  // ✅ Export Dialog State
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    dateFrom: '',
    dateTo: '',
    stage: 'all',
    brand: '',
    category: '',
    searchText: ''
  });
  const [exportLoading, setExportLoading] = useState(false);

  // Auth check
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(storedUser);
  }, [router]);

  useEffect(() => {
    if (activeWarehouse) {
      loadInventoryData();
      loadMetrics();

      // Auto-refresh metrics every 5 seconds
      const interval = setInterval(() => {
        loadMetrics();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [activeWarehouse, page, limit]);

  // Apply filters
  useEffect(() => {
    applyFilters();
  }, [inventoryData, searchWSN, stageFilter, brandFilter, categoryFilter, dateFrom, dateTo]);

  const loadInventoryData = async () => {
    setLoading(true);
    try {
      const response = await dashboardAPI.getInventoryPipeline({
        warehouseId: activeWarehouse?.id,
        page,
        limit
      });

      setInventoryData((response.data?.data || []) as InventoryItem[]);
      setTotal(response.data?.pagination?.total || 0);

      // Extract unique brands and categories from data
      const uniqueBrands = Array.from(
        new Set(
          (response.data?.data || [])
            .map((item: any) => item.brand)
            .filter(Boolean)
        )
      ) as string[];

      const uniqueCategories = Array.from(
        new Set(
          (response.data?.data || [])
            .map((item: any) => item.cms_vertical)
            .filter(Boolean)
        )
      ) as string[];

      setBrands(uniqueBrands);
      setCategories(uniqueCategories);
    } catch (error: any) {
      console.error('Load inventory error:', error);
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      const response = await dashboardAPI.getInventoryMetrics(activeWarehouse?.id);
      setMetrics(response.data || {});
    } catch (error) {
      console.error('Load metrics error:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...inventoryData];

    // WSN search
    if (searchWSN) {
      filtered = filtered.filter(item =>
        item.wsn?.toLowerCase().includes(searchWSN.toLowerCase()) ||
        item.product_title?.toLowerCase().includes(searchWSN.toLowerCase())
      );
    }

    // Stage filter
    if (stageFilter !== 'all') {
      filtered = filtered.filter(item => item.current_stage === stageFilter);
    }

    // Brand filter
    if (brandFilter) {
      filtered = filtered.filter(item =>
        item.brand?.toLowerCase() === brandFilter.toLowerCase()
      );
    }

    // Category filter
    if (categoryFilter) {
      filtered = filtered.filter(item =>
        item.cms_vertical?.toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter(item =>
        item.inbound_date && new Date(item.inbound_date) >= new Date(dateFrom)
      );
    }

    if (dateTo) {
      filtered = filtered.filter(item =>
        item.inbound_date && new Date(item.inbound_date) <= new Date(dateTo)
      );
    }

    setFilteredData(filtered);
  };

  const getStageColor = (stage: string) => {
    if (stage?.includes('INBOUND')) return 'primary';
    if (stage?.includes('QC_PENDING')) return 'warning';
    if (stage?.includes('QC_PASSED')) return 'success';
    if (stage?.includes('QC_FAILED')) return 'error';
    if (stage?.includes('PICKING')) return 'info';
    if (stage?.includes('OUTBOUND')) return 'success';
    return 'default';
  };

  const getStatusColor = (status: string) => {
    if (!status) return '#999';
    if (status === 'PENDING') return '#ff9800';
    if (status === 'Pending') return '#ff9800';
    if (status === 'COMPLETED' || status === 'PASSED') return '#4caf50';
    if (status === 'FAILED') return '#f44336';
    if (status === 'ok') return '#4caf50';
    return '#2196f3';
  };

  // ✅ NEW: Excel Export with Formatting
  const formatExcelSheet = (ws: any, data: any[]) => {
    // Column widths
    const columnWidths = [
      15, 12, 12, 12, 30, 15, 15, 12, 12, 15, 15, 12, 15, 12, 12, 15,
      15, 15, 12, 15, 15, 12, 15, 15, 15, 15, 15, 15, 15, 15, 18, 15, 20
    ];
    ws['!cols'] = columnWidths.map(w => ({ wch: w }));

    // Freeze header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    // Format header row (row 1)
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: 'F59E0B' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    // Apply header style to all header cells
    const headers = Object.keys(data[0] || {});
    headers.forEach((header, idx) => {
      const cell = ws[XLSX.utils.encode_col(idx) + '1'];
      if (cell) cell.s = headerStyle;
    });

    // Format data cells with borders and alternating colors
    const dataStyle = {
      border: {
        top: { style: 'thin', color: { rgb: 'E5E7EB' } },
        bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
        left: { style: 'thin', color: { rgb: 'E5E7EB' } },
        right: { style: 'thin', color: { rgb: 'E5E7EB' } }
      },
      alignment: { horizontal: 'left', vertical: 'top', wrapText: true }
    };

    const rowCount = data.length + 1;
    for (let row = 2; row <= rowCount; row++) {
      headers.forEach((header, col) => {
        const cellRef = XLSX.utils.encode_col(col) + row;
        if (ws[cellRef]) {
          ws[cellRef].s = {
            ...dataStyle,
            fill: row % 2 === 0
              ? { fgColor: { rgb: 'F9FAFB' } }
              : { fgColor: { rgb: 'FFFFFF' } }
          };
        }
      });
    }
  };

  // ✅ NEW: Handle Export with Filters
  const handleExportWithFilters = async () => {
    setExportLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      params.append('warehouseId', activeWarehouse?.id);
      if (exportFilters.dateFrom) params.append('dateFrom', exportFilters.dateFrom);
      if (exportFilters.dateTo) params.append('dateTo', exportFilters.dateTo);
      if (exportFilters.stage && exportFilters.stage !== 'all') params.append('stage', exportFilters.stage);
      if (exportFilters.brand) params.append('brand', exportFilters.brand);
      if (exportFilters.category) params.append('category', exportFilters.category);
      if (exportFilters.searchText) params.append('searchText', exportFilters.searchText);

      // Fetch export data
      const response = await dashboardAPI.getInventoryDataForExport(params.toString());

      if (response.data?.data && response.data.data.length > 0) {
        // Format data for Excel with ALL columns
        const formattedData = response.data.data.map((row: any) => ({
          'WSN': row.wsn,
          'Product ID': row.wid || '',
          'FSN': row.fsn || '',
          'Order ID': row.order_id || '',
          'Product Title': row.product_title,
          'Brand': row.brand,
          'Category': row.cms_vertical,
          'FSP': row.fsp,
          'MRP': row.mrp,
          'Inbound Date': row.inbound_date ? new Date(row.inbound_date).toLocaleDateString() : '-',
          'Vehicle No': row.vehicle_no,
          'Rack No': row.rack_no,
          'Location': row.wh_location,
          'HSN/SAC': row.hsn_sac,
          'IGST Rate': row.igst_rate,
          'Invoice Date': row.invoice_date ? new Date(row.invoice_date).toLocaleDateString() : '-',
          'Product Type': row.p_type,
          'Size': row.p_size,
          'VRP': row.vrp,
          'Yield Value': row.yield_value,
          // QC Details
          'QC Date': row.qc_date,
          'QC By': row.qc_by,
          'QC Grade': row.qc_grade,
          'QC Remarks': row.qc_remarks,
          'FK QC Remark': row.fkqc_remark,
          // Picking Details
          'Picking Date': row.picking_date,
          'Customer Name': row.customer_name,
          'Picking Remarks': row.picking_remarks,
          // Outbound Details
          'Dispatch Date': row.dispatch_date,
          'Dispatch Vehicle': row.dispatch_vehicle,
          'Dispatch Remarks': row.dispatch_remarks,
          // Status
          'Current Status': row.current_status,
          'Batch ID': row.batch_id,
          'Created At': new Date(row.created_at).toLocaleString(),
          'Created By': row.created_by
        }));

        // Create Excel workbook
        const ws = XLSX.utils.json_to_sheet(formattedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

        // Format Excel sheet
        formatExcelSheet(ws, formattedData);

        // Add Summary Sheet
        const summaryData = [
          { 'Metric': 'Total Records', 'Count': formattedData.length },
          { 'Metric': 'Inbound', 'Count': formattedData.filter((r: any) => r['Current Status'] === 'INBOUND').length },
          { 'Metric': 'QC Done', 'Count': formattedData.filter((r: any) => r['Current Status'] === 'QC_DONE').length },
          { 'Metric': 'Picked', 'Count': formattedData.filter((r: any) => r['Current Status'] === 'PICKED').length },
          { 'Metric': 'Dispatched', 'Count': formattedData.filter((r: any) => r['Current Status'] === 'DISPATCHED').length }
        ];

        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 20 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

        // Generate filename with filters
        const filename = `Inventory_${activeWarehouse?.name}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);

        toast.success(`✓ Exported ${formattedData.length} records to Excel`);
        setExportDialogOpen(false);
      } else {
        toast.error('No data to export with selected filters');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  const toggleColumn = (column: string) => {
    if (visibleColumns.includes(column)) {
      if (visibleColumns.length === 1) {
        toast.error('At least one column must be visible');
        return;
      }
      setVisibleColumns(visibleColumns.filter(c => c !== column));
    } else {
      setVisibleColumns([...visibleColumns, column]);
    }
  };

  const resetFilters = () => {
    setSearchWSN('');
    setStageFilter('all');
    setBrandFilter('');
    setCategoryFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  if (!activeWarehouse) {
      return (
        <AppLayout>
          <Box
            sx={{
              p: 6,
              textAlign: 'center',
              minHeight: '60vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                p: 5,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 4,
                color: 'white',
                boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4)',
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                ⚠️ No active warehouse selected. 
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Please go to Settings → Warehouses to set one.
              </Typography>
            </Box>
          </Box>
        </AppLayout>
      );
    }

  return (
    <AppLayout>
      <Toaster position="top-right" />
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        {/* HEADER */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: 3,
            boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)'
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            📊 Divine Inventory Managment
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {activeWarehouse?.name}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              • {user?.full_name || user?.username}
            </Typography>
          </Stack>
        </Paper>

        {/* METRICS CARDS - COMPACT */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(5, 1fr)' }, gap: 2, mb: 3 }}>
          {[
            { label: 'Total Items', value: metrics.total, color: '#667eea' },
            { label: 'Inbound', value: metrics.inbound, color: '#3b82f6' },
            { label: 'QC Done', value: metrics.qcPassed, color: '#10b981' },
            { label: 'Picking Done', value: metrics.pickingCompleted, color: '#f59e0b' },
            { label: 'Dispatched', value: metrics.outboundDispatched, color: '#ef4444' }
          ].map((metric, idx) => (
            <Card key={idx} sx={{ p: 2, textAlign: 'center', border: `3px solid ${metric.color}` }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: metric.color }}>
                {metric.value}
              </Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>
                {metric.label}
              </Typography>
            </Card>
          ))}
        </Box>

        {/* FILTERS - COMPACT */}
        <Paper elevation={2} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
            <TextField
              label="Search (WSN/Product)"
              size="small"
              value={searchWSN}
              onChange={(e) => setSearchWSN(e.target.value)}
              sx={{ minWidth: 130 }}
            />

            <FormControl sx={{ minWidth: 120 }} size="small">
              <InputLabel>Stage</InputLabel>
              <Select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                label="Stage"
              >
                {PIPELINE_STAGES.map(stage => (
                  <MenuItem key={stage.value} value={stage.value}>
                    {stage.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 120 }} size="small">
              <InputLabel>Brand</InputLabel>
              <Select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                label="Brand"
              >
                <MenuItem value="">All</MenuItem>
                {brands.map(brand => (
                  <MenuItem key={brand} value={brand}>
                    {brand}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 120 }} size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                label="Category"
              >
                <MenuItem value="">All</MenuItem>
                {categories.map(cat => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="From"
              type="date"
              size="small"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 110 }}
            />

            <TextField
              label="To"
              type="date"
              size="small"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 110 }}
            />

            <Button
              size="small"
              variant="outlined"
              onClick={resetFilters}
              sx={{ borderRadius: 1 }}
            >
              Reset
            </Button>

            <IconButton
              onClick={() => setColumnDialogOpen(true)}
              size="small"
              sx={{ bgcolor: '#e5e7eb', '&:hover': { bgcolor: '#d1d5db' } }}
            >
              <VisibilityIcon />
            </IconButton>

            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={() => setExportDialogOpen(true)}
              size="small"
              sx={{ borderRadius: 1, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            >
              Export
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => {
                loadInventoryData();
                loadMetrics();
                toast.success('✓ Data refreshed');
              }}
            >
              Refresh
            </Button>
          </Stack>
        </Paper>

        {/* TABLE - COMPACT & DENSE */}
        <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 500px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  {visibleColumns.map((col) => (
                    <TableCell key={col} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                      {col.replace(/_/g, ' ').toUpperCase()}
                    </TableCell>
                  ))}
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length + 1} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={30} />
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length + 1} align="center" sx={{ py: 4 }}>
                      <Typography variant="h6">📭 No items found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item: InventoryItem, index: number) => (
                    <TableRow key={index} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                      {visibleColumns.map((col) => {
                        let cellValue = item[col] || '-';

                        if (col.includes('status')) {
                          return (
                            <TableCell key={col} sx={{ fontSize: '0.75rem' }}>
                              <Chip
                                label={cellValue}
                                size="small"
                                sx={{
                                  bgcolor: getStatusColor(cellValue),
                                  color: 'white',
                                  fontSize: '0.7rem'
                                }}
                              />
                            </TableCell>
                          );
                        }

                        if (col === 'current_stage') {
                          return (
                            <TableCell key={col} sx={{ fontSize: '0.75rem' }}>
                              <Chip
                                label={cellValue}
                                color={getStageColor(cellValue) as any}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                          );
                        }

                        return (
                          <TableCell key={col} sx={{ fontSize: '0.75rem' }}>
                            {cellValue}
                          </TableCell>
                        );
                      })}
                      <TableCell sx={{ textAlign: 'center' }}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedItem(item);
                            setDetailsDialogOpen(true);
                          }}
                          sx={{ color: '#667eea', p: 0.5 }}
                        >
                          <FilterIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* PAGINATION - COMPACT */}
          <Box sx={{ p: 2, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">Per page:</Typography>
              <Select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                size="small"
                sx={{ fontSize: '0.85rem' }}
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
              </Select>
            </Stack>

            <Typography variant="body2">
              {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} of {total}
            </Typography>

            <Pagination
              page={page}
              onChange={(_, value) => setPage(value)}
              count={Math.ceil(total / limit)}
              size="small"
              sx={{ '& .MuiPaginationItem-root': { fontSize: '0.75rem' } }}
            />
          </Box>
        </Paper>

        {/* ✅ EXPORT DIALOG */}
        <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, bgcolor: '#10b981', color: 'white' }}>
            📊 Export Inventory Data
          </DialogTitle>

          <DialogContent sx={{ pt: 3 }}>
            <Stack spacing={2}>

              {/* Date Range */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  📅 Date Range
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="From Date"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={exportFilters.dateFrom}
                    onChange={(e) => setExportFilters({ ...exportFilters, dateFrom: e.target.value })}
                    fullWidth
                  />
                  <TextField
                    label="To Date"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={exportFilters.dateTo}
                    onChange={(e) => setExportFilters({ ...exportFilters, dateTo: e.target.value })}
                    fullWidth
                  />
                </Stack>
              </Box>

              {/* Stage Filter */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  📦 Current Stage
                </Typography>
                <Select
                  value={exportFilters.stage}
                  onChange={(e) => setExportFilters({ ...exportFilters, stage: e.target.value })}
                  size="small"
                  fullWidth
                >
                  <MenuItem value="all">All Stages</MenuItem>
                  <MenuItem value="inbound">Inbound Only</MenuItem>
                  <MenuItem value="qc">QC Done</MenuItem>
                  <MenuItem value="picking">Picked</MenuItem>
                  <MenuItem value="outbound">Dispatched</MenuItem>
                </Select>
              </Box>

              {/* Brand Filter */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  🏷️ Brand
                </Typography>
                <Autocomplete
                  options={brands}
                  value={exportFilters.brand || null}
                  onChange={(_, val) => setExportFilters({ ...exportFilters, brand: val || '' })}
                  renderInput={(params) => <TextField {...params} placeholder="Select brand" size="small" />}
                  fullWidth
                />
              </Box>

              {/* Category Filter */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  🏪 Category
                </Typography>
                <Autocomplete
                  options={categories}
                  value={exportFilters.category || null}
                  onChange={(_, val) => setExportFilters({ ...exportFilters, category: val || '' })}
                  renderInput={(params) => <TextField {...params} placeholder="Select category" size="small" />}
                  fullWidth
                />
              </Box>

              {/* Search */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  🔍 Search (WSN or Product)
                </Typography>
                <TextField
                  placeholder="Enter WSN or product name..."
                  size="small"
                  value={exportFilters.searchText}
                  onChange={(e) => setExportFilters({ ...exportFilters, searchText: e.target.value })}
                  fullWidth
                />
              </Box>

              {/* Info Box */}
              <Alert severity="info" icon={<InfoIcon />}>
                <Typography variant="body2">
                  <strong>Export includes:</strong> All product details from Inbound, QC, Picking, and Outbound with professional Excel formatting
                </Typography>
              </Alert>
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              startIcon={exportLoading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
              onClick={handleExportWithFilters}
              disabled={exportLoading}
              sx={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            >
              {exportLoading ? 'Exporting...' : 'Export to Excel'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* DETAILS DIALOG */}
        <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Item - {selectedItem?.wsn}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Product</Typography>
                <Typography variant="body2">{selectedItem?.product_title}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Brand / Category</Typography>
                <Typography variant="body2">{selectedItem?.brand} / {selectedItem?.cms_vertical}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Price</Typography>
                <Typography variant="body2">FSP: ₹{selectedItem?.fsp} | MRP: ₹{selectedItem?.mrp}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Pipeline</Typography>
                <Typography variant="body2">Inbound: {selectedItem?.inbound_status} | QC: {selectedItem?.qc_status} | Picking: {selectedItem?.picking_status} | Outbound: {selectedItem?.outbound_status}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Current Stage</Typography>
                <Chip label={selectedItem?.current_stage} color="primary" size="small" />
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsDialogOpen(false)} size="small">Close</Button>
          </DialogActions>
        </Dialog>

        {/* COLUMN SETTINGS DIALOG */}
        <Dialog open={columnDialogOpen} onClose={() => setColumnDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Column Settings</DialogTitle>
          <DialogContent>
            <Stack spacing={1} sx={{ mt: 2 }}>
              {ALL_COLUMNS.map((col) => (
                <FormControlLabel
                  key={col}
                  control={
                    <Checkbox
                      checked={visibleColumns.includes(col)}
                      onChange={() => toggleColumn(col)}
                    />
                  }
                  label={col.replace(/_/g, ' ').toUpperCase()}
                />
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setColumnDialogOpen(false)} size="small">Close</Button>
            <Button onClick={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)} variant="outlined" size="small">Reset</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AppLayout>
  );

}
