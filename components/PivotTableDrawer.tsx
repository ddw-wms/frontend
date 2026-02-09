// File: components/PivotTableDrawer.tsx
// Excel-style Pivot Table with Server-Side Aggregation
// Handles 5-10 lakh+ products smoothly

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Drawer,
    Box,
    Typography,
    IconButton,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip,
    Tooltip,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    useTheme,
    useMediaQuery,
    CircularProgress,
    Alert,
    Pagination,
    TextField,
    InputAdornment,
    Checkbox,
    FormControlLabel,
    Stack,
    Divider,
} from '@mui/material';
import {
    Close as CloseIcon,
    Download as DownloadIcon,
    PivotTableChart as PivotIcon,
    Refresh as RefreshIcon,
    Search as SearchIcon,
    TableChart as TableIcon,
    Settings as SettingsIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import { dashboardAPI } from '@/lib/api';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ClientSideRowModelModule, ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

interface PivotTableDrawerProps {
    open: boolean;
    onClose: () => void;
    warehouseId?: number;
}

interface PivotRow {
    category: string;
    qty: number;
    total_fsp: number;
    total_mrp: number;
    total_vrp: number;
}

interface GrandTotal {
    qty: number;
    total_fsp: number;
    total_mrp: number;
    total_vrp: number;
}

// Format number Indian style
const formatNumber = (num: number, decimals = 0): string => {
    if (decimals > 0) {
        return num.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    return num.toLocaleString('en-IN');
};

// Format currency
const formatCurrency = (num: number): string => {
    return '₹' + formatNumber(num, 2);
};

// Format date from ISO to DD-MM-YYYY
const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    } catch {
        return dateStr;
    }
};

export const PivotTableDrawer: React.FC<PivotTableDrawerProps> = ({
    open,
    onClose,
    warehouseId,
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isDarkMode = theme.palette.mode === 'dark';

    // Pivot data state
    const [pivotData, setPivotData] = useState<PivotRow[]>([]);
    const [grandTotal, setGrandTotal] = useState<GrandTotal>({ qty: 0, total_fsp: 0, total_mrp: 0, total_vrp: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [groupBy, setGroupBy] = useState<string>('cms_vertical');

    // Filters state
    const [brandFilter, setBrandFilter] = useState<string>('');
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [allBrands, setAllBrands] = useState<string[]>([]);
    const [allCategories, setAllCategories] = useState<string[]>([]);

    // Drill-down state
    const [drilldownOpen, setDrilldownOpen] = useState(false);
    const [drilldownFullscreen, setDrilldownFullscreen] = useState(false);
    const [drilldownCategory, setDrilldownCategory] = useState<string>('');
    const [drilldownData, setDrilldownData] = useState<any[]>([]);
    const [drilldownLoading, setDrilldownLoading] = useState(false);
    const [drilldownPage, setDrilldownPage] = useState(1);
    const [drilldownTotal, setDrilldownTotal] = useState(0);
    const [drilldownTotalPages, setDrilldownTotalPages] = useState(0);
    const [drilldownSearch, setDrilldownSearch] = useState('');
    const [exportingExcel, setExportingExcel] = useState(false);
    const [exportingAllData, setExportingAllData] = useState(false);
    const [drilldownLimit, setDrilldownLimit] = useState(100);

    // Grid settings state
    const [gridSettingsOpen, setGridSettingsOpen] = useState(false);
    const [enableSorting, setEnableSorting] = useState<boolean>(() => {
        try { return localStorage.getItem('pivot_drilldown_enableSorting') !== 'false'; } catch { return true; }
    });
    const [enableColumnFilters, setEnableColumnFilters] = useState<boolean>(() => {
        try { return localStorage.getItem('pivot_drilldown_enableColumnFilters') !== 'false'; } catch { return true; }
    });
    const [enableColumnResize, setEnableColumnResize] = useState<boolean>(() => {
        try { return localStorage.getItem('pivot_drilldown_enableColumnResize') !== 'false'; } catch { return true; }
    });
    const gridRef = useRef<any>(null);

    // Save grid settings to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('pivot_drilldown_enableSorting', String(enableSorting));
            localStorage.setItem('pivot_drilldown_enableColumnFilters', String(enableColumnFilters));
            localStorage.setItem('pivot_drilldown_enableColumnResize', String(enableColumnResize));
        } catch { /* ignore */ }
    }, [enableSorting, enableColumnFilters, enableColumnResize]);

    // AG Grid default column definition
    const defaultColDef = useMemo(() => ({
        sortable: enableSorting,
        filter: enableColumnFilters,
        resizable: enableColumnResize,
        minWidth: 80,
        suppressSizeToFit: false,
        cellStyle: {
            fontSize: '12px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
        },
    }), [enableSorting, enableColumnFilters, enableColumnResize]);

    // AG Grid column definitions for drill-down
    const drilldownColumnDefs: ColDef[] = useMemo(() => [
        {
            field: 'srNo',
            headerName: 'SR.NO',
            width: isMobile ? 45 : 75,
            minWidth: isMobile ? 40 : 75,
            maxWidth: isMobile ? 50 : 75,
            sortable: false,
            filter: false,
            pinned: isMobile ? undefined : 'left', // Not pinned on mobile
            valueGetter: (params: any) => {
                if (!params.node) return '';
                const rowIndex = params.node.rowIndex;
                const api = params.api;
                if (api) {
                    const pageSize = api.paginationGetPageSize();
                    const currentPage = api.paginationGetCurrentPage();
                    return (currentPage * pageSize) + rowIndex + 1;
                }
                return rowIndex + 1;
            }
        },
        { field: 'wsn', headerName: 'WSN', width: isMobile ? 90 : 120, minWidth: isMobile ? 80 : 100 },
        { field: 'wid', headerName: 'WID', width: isMobile ? 85 : 110, minWidth: isMobile ? 75 : 90 },
        { field: 'fsn', headerName: 'FSN', width: isMobile ? 95 : 130, minWidth: isMobile ? 85 : 100 },
        { field: 'order_id', headerName: 'Order ID', width: isMobile ? 90 : 120, minWidth: isMobile ? 80 : 100 },
        { field: 'product_title', headerName: 'Product Title', width: isMobile ? 180 : 300, minWidth: isMobile ? 150 : 200, tooltipField: 'product_title' },
        { field: 'brand', headerName: 'Brand', width: isMobile ? 85 : 120, minWidth: isMobile ? 70 : 90 },
        { field: 'cms_vertical', headerName: 'Category', width: isMobile ? 100 : 130, minWidth: isMobile ? 85 : 100 },
        { field: 'hsn_sac', headerName: 'HSN/SAC', width: isMobile ? 80 : 100, minWidth: isMobile ? 65 : 80 },
        { field: 'igst_rate', headerName: 'IGST', width: isMobile ? 55 : 70, minWidth: isMobile ? 45 : 60 },
        { field: 'fsp', headerName: 'FSP', width: isMobile ? 75 : 100, minWidth: isMobile ? 65 : 80, valueFormatter: (params: any) => params.value ? `₹${Number(params.value).toLocaleString('en-IN')}` : '' },
        { field: 'mrp', headerName: 'MRP', width: isMobile ? 75 : 100, minWidth: isMobile ? 65 : 80, valueFormatter: (params: any) => params.value ? `₹${Number(params.value).toLocaleString('en-IN')}` : '' },
        { field: 'vrp', headerName: 'VRP', width: isMobile ? 75 : 100, minWidth: isMobile ? 65 : 80, valueFormatter: (params: any) => params.value ? `₹${Number(params.value).toLocaleString('en-IN')}` : '' },
        { field: 'yield_value', headerName: 'Yield', width: isMobile ? 65 : 90, minWidth: isMobile ? 55 : 70 },
        { field: 'rack_no', headerName: 'Rack', width: isMobile ? 60 : 80, minWidth: isMobile ? 50 : 60 },
        { field: 'wh_location', headerName: 'WH Location', width: isMobile ? 85 : 110, minWidth: isMobile ? 70 : 90 },
        { field: 'p_type', headerName: 'P Type', width: isMobile ? 65 : 80, minWidth: isMobile ? 55 : 70 },
        { field: 'p_size', headerName: 'P Size', width: isMobile ? 65 : 80, minWidth: isMobile ? 55 : 70 },
        { field: 'inbound_date', headerName: 'Inbound Date', width: isMobile ? 90 : 115, minWidth: isMobile ? 80 : 100, valueFormatter: (params: any) => formatDate(params.value) },
        { field: 'qc_grade', headerName: 'QC Grade', width: isMobile ? 75 : 95, minWidth: isMobile ? 65 : 80 },
        { field: 'qc_date', headerName: 'QC Date', width: isMobile ? 85 : 105, minWidth: isMobile ? 70 : 90, valueFormatter: (params: any) => formatDate(params.value) },
        { field: 'current_stage', headerName: 'Stage', width: isMobile ? 75 : 100, minWidth: isMobile ? 65 : 80 },
    ], [isMobile]);

    // Fetch pivot filters (brands, categories) when drawer opens
    useEffect(() => {
        if (open && warehouseId) {
            fetchPivotFilters();
        }
    }, [open, warehouseId]);

    // Fetch pivot summary when drawer opens or filters change
    useEffect(() => {
        if (open && warehouseId) {
            fetchPivotSummary();
        }
    }, [open, warehouseId, groupBy, brandFilter, categoryFilter]);

    // Fetch filter options from API
    const fetchPivotFilters = async () => {
        if (!warehouseId) return;
        try {
            const response = await dashboardAPI.getPivotFilters({ warehouseId });
            if (response.data?.success) {
                setAllBrands(response.data.brands || []);
                setAllCategories(response.data.categories || []);
            }
        } catch (err) {
            console.error('Failed to load pivot filters:', err);
        }
    };

    const fetchPivotSummary = async () => {
        if (!warehouseId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await dashboardAPI.getPivotSummary({
                warehouseId,
                groupBy,
                brand: brandFilter || undefined,
                category: categoryFilter || undefined,
            });

            if (response.data?.success) {
                setPivotData(response.data.data || []);
                setGrandTotal(response.data.grandTotal || { qty: 0, total_fsp: 0, total_mrp: 0, total_vrp: 0 });
            } else {
                setError('Failed to load pivot data');
            }
        } catch (err: any) {
            console.error('Pivot summary error:', err);
            setError(err.message || 'Failed to load pivot data');
        } finally {
            setLoading(false);
        }
    };

    // Fetch drill-down data
    const fetchDrilldownData = useCallback(async (category: string, page: number = 1, limit: number = drilldownLimit) => {
        if (!warehouseId) return;

        setDrilldownLoading(true);

        try {
            const response = await dashboardAPI.getPivotDrilldown({
                warehouseId,
                groupBy,
                categoryValue: category,
                page,
                limit,
            });

            if (response.data?.success) {
                setDrilldownData(response.data.data || []);
                setDrilldownTotal(response.data.pagination?.total || 0);
                setDrilldownTotalPages(response.data.pagination?.totalPages || 0);
            }
        } catch (err: any) {
            console.error('Drilldown error:', err);
        } finally {
            setDrilldownLoading(false);
        }
    }, [warehouseId, groupBy]);

    // Handle row double-click for drill-down
    const handleRowDoubleClick = (category: string) => {
        setDrilldownCategory(category);
        setDrilldownPage(1);
        setDrilldownSearch('');
        setDrilldownOpen(true);
        // Fetch all data for proper AG Grid client-side pagination
        fetchDrilldownData(category, 1, 10000);
    };

    // Handle drill-down pagination
    const handleDrilldownPageChange = (_: any, page: number) => {
        setDrilldownPage(page);
        fetchDrilldownData(drilldownCategory, page);
    };

    // Export drill-down to Excel
    const handleExportDrilldown = async () => {
        if (!warehouseId || !drilldownCategory) return;

        setExportingExcel(true);

        try {
            // Fetch ALL data for export
            const response = await dashboardAPI.getPivotDrilldown({
                warehouseId,
                groupBy,
                categoryValue: drilldownCategory,
                exportAll: true,
            });

            if (response.data?.success && response.data.data) {
                const XLSX = await import('xlsx');

                // Prepare data with clean column headers (Excel-like, no Actual Received)
                const exportData = response.data.data.map((row: any) => ({
                    'WSN': row.wsn,
                    'WID': row.wid,
                    'FSN': row.fsn,
                    'Order ID': row.order_id,
                    'Product Title': row.product_title,
                    'Brand': row.brand,
                    'Category': row.cms_vertical,
                    'HSN/SAC': row.hsn_sac,
                    'IGST Rate': row.igst_rate,
                    'FSP': row.fsp,
                    'MRP': row.mrp,
                    'VRP': row.vrp,
                    'Yield Value': row.yield_value,
                    'Invoice Date': formatDate(row.invoice_date),
                    'FKT Link': row.fkt_link,
                    'WH Location': row.wh_location,
                    'P Type': row.p_type,
                    'P Size': row.p_size,
                    'FK QC Remark': row.fkqc_remark,
                    'FK Grade': row.fk_grade,
                    'Rack No': row.rack_no,
                    'Warehouse': row.warehouse_name,
                    'Inbound Date': formatDate(row.inbound_date),
                    'Inbound Vehicle': row.inbound_vehicle,
                    'Inbound Qty': row.inbound_qty,
                    'QC Date': formatDate(row.qc_date),
                    'QC Grade': row.qc_grade,
                    'QC Status': row.qc_status,
                    'QC Remarks': row.qc_remarks,
                    'QC By': row.qc_by,
                    'Picking Date': formatDate(row.picking_date),
                    'Customer Name': row.customer_name,
                    'Current Stage': row.current_stage,
                    'Created At': formatDate(row.inbound_created_at),
                    'Created By': row.inbound_created_by,
                }));

                const ws = XLSX.utils.json_to_sheet(exportData);

                // Auto-size columns
                const colWidths = Object.keys(exportData[0] || {}).map(key => ({
                    wch: Math.max(key.length, 15)
                }));
                ws['!cols'] = colWidths;

                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Inventory Details');

                const filename = `Inventory_${drilldownCategory.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
                XLSX.writeFile(wb, filename);
            }
        } catch (err: any) {
            console.error('Export error:', err);
            alert('Failed to export data');
        } finally {
            setExportingExcel(false);
        }
    };

    // Export pivot summary to Excel
    const handleExportPivotSummary = async () => {
        try {
            const XLSX = await import('xlsx');

            const exportData = pivotData.map(row => ({
                [groupBy === 'cms_vertical' ? 'Category' : groupBy === 'brand' ? 'Brand' : 'Group']: row.category,
                'Quantity': row.qty,
                'Total FSP (₹)': row.total_fsp,
                'Total MRP (₹)': row.total_mrp,
            }));

            // Add grand total
            exportData.push({
                [groupBy === 'cms_vertical' ? 'Category' : groupBy === 'brand' ? 'Brand' : 'Group']: 'GRAND TOTAL',
                'Quantity': grandTotal.qty,
                'Total FSP (₹)': grandTotal.total_fsp,
                'Total MRP (₹)': grandTotal.total_mrp,
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Pivot Summary');

            XLSX.writeFile(wb, `Pivot_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            console.error('Export error:', err);
        }
    };

    // Export ALL inventory data to Excel
    const handleExportAllData = async () => {
        if (!warehouseId) return;

        setExportingAllData(true);

        try {
            // Fetch ALL available inventory data
            const response = await dashboardAPI.getPivotExportAll({
                warehouseId,
                brand: brandFilter || undefined,
                category: categoryFilter || undefined,
            });

            if (response.data?.success && response.data.data) {
                const XLSX = await import('xlsx');

                // Prepare data with clean column headers
                const exportData = response.data.data.map((row: any, index: number) => ({
                    'Sr.No': index + 1,
                    'WSN': row.wsn,
                    'WID': row.wid,
                    'FSN': row.fsn,
                    'Order ID': row.order_id,
                    'Product Title': row.product_title,
                    'Brand': row.brand,
                    'Category': row.cms_vertical,
                    'HSN/SAC': row.hsn_sac,
                    'IGST Rate': row.igst_rate,
                    'FSP': row.fsp,
                    'MRP': row.mrp,
                    'VRP': row.vrp,
                    'Yield Value': row.yield_value,
                    'Invoice Date': formatDate(row.invoice_date),
                    'FKT Link': row.fkt_link,
                    'WH Location': row.wh_location,
                    'P Type': row.p_type,
                    'P Size': row.p_size,
                    'FK QC Remark': row.fkqc_remark,
                    'FK Grade': row.fk_grade,
                    'Rack No': row.rack_no,
                    'Warehouse': row.warehouse_name,
                    'Inbound Date': formatDate(row.inbound_date),
                    'Inbound Vehicle': row.inbound_vehicle,
                    'Inbound Qty': row.inbound_qty,
                    'QC Date': formatDate(row.qc_date),
                    'QC Grade': row.qc_grade,
                    'QC Status': row.qc_status,
                    'QC Remarks': row.qc_remarks,
                    'QC By': row.qc_by,
                    'Picking Date': formatDate(row.picking_date),
                    'Customer Name': row.customer_name,
                    'Current Stage': row.current_stage,
                    'Created At': formatDate(row.inbound_created_at),
                    'Created By': row.inbound_created_by,
                }));

                const ws = XLSX.utils.json_to_sheet(exportData);

                // Auto-size columns
                const colWidths = Object.keys(exportData[0] || {}).map(key => ({
                    wch: Math.max(key.length, 15)
                }));
                ws['!cols'] = colWidths;

                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'All Inventory Data');

                const filterSuffix = brandFilter || categoryFilter
                    ? `_${brandFilter || ''}_${categoryFilter || ''}`.replace(/[^a-zA-Z0-9_]/g, '')
                    : '';
                const filename = `All_Inventory_Data${filterSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`;
                XLSX.writeFile(wb, filename);
            }
        } catch (err: any) {
            console.error('Export all error:', err);
            alert('Failed to export data. Please try again.');
        } finally {
            setExportingAllData(false);
        }
    };

    // Filtered drilldown data based on search
    const filteredDrilldownData = drilldownSearch
        ? drilldownData.filter(row =>
            row.wsn?.toLowerCase().includes(drilldownSearch.toLowerCase()) ||
            row.product_title?.toLowerCase().includes(drilldownSearch.toLowerCase()) ||
            row.brand?.toLowerCase().includes(drilldownSearch.toLowerCase())
        )
        : drilldownData;

    const groupByOptions = [
        { value: 'cms_vertical', label: 'Category' },
        { value: 'brand', label: 'Brand' },
        { value: 'current_stage', label: 'Stage' },
        { value: 'qc_grade', label: 'QC Grade' },
    ];

    return (
        <>
            <Drawer
                anchor="right"
                open={open}
                onClose={onClose}
                ModalProps={{
                    keepMounted: true,
                }}
                PaperProps={{
                    sx: {
                        width: { xs: '100%', sm: '100%', md: '50%' },
                        minWidth: { xs: '100vw', sm: '100vw', md: 'auto' },
                        maxWidth: '100vw',
                        bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                        top: { xs: '50px', sm: '56px', md: '64px' },
                        height: { xs: 'calc(100% - 42px)', sm: 'calc(100% - 56px)', md: 'calc(100% - 64px)' },
                    },
                }}
            >
                {/* Header - Compact on mobile */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: { xs: 1, md: 2 },
                        py: { xs: 0.75, md: 1.5 },
                        background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                        color: 'white',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 } }}>
                        <PivotIcon sx={{ fontSize: { xs: 18, md: 24 } }} />
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '0.85rem', md: '1.1rem' } }}>
                            Pivot Table
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                        <Chip
                            label={loading ? '...' : `${formatNumber(grandTotal.qty)}`}
                            size="small"
                            sx={{
                                bgcolor: 'rgba(255,255,255,0.2)',
                                color: 'white',
                                fontSize: { xs: '0.65rem', md: '0.75rem' },
                                height: { xs: 20, md: 24 },
                                fontWeight: 600,
                            }}
                        />
                        <Tooltip title="Refresh">
                            <IconButton onClick={fetchPivotSummary} sx={{ color: 'white', p: { xs: 0.25, md: 1 } }} disabled={loading}>
                                <RefreshIcon sx={{ fontSize: { xs: 16, md: 20 } }} />
                            </IconButton>
                        </Tooltip>
                        <IconButton onClick={onClose} sx={{ color: 'white', p: { xs: 0.25, md: 1 } }}>
                            <CloseIcon sx={{ fontSize: { xs: 18, md: 24 } }} />
                        </IconButton>
                    </Box>
                </Box>

                {/* Controls - Compact 2-row layout on mobile */}
                <Box
                    sx={{
                        p: { xs: 0.75, md: 2 },
                        bgcolor: isDarkMode ? '#1e293b' : 'white',
                        borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: { xs: 0.75, md: 2 },
                    }}
                >
                    {/* Row 1: Group By + Brand (mobile) | All in row (desktop) */}
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'row' }, gap: { xs: 0.75, md: 2 }, alignItems: 'center' }}>
                        <FormControl size="small" sx={{ flex: { xs: 1, md: 'none' }, minWidth: { md: 120 }, '& .MuiInputBase-root': { height: { xs: 32, md: 40 } } }}>
                            <InputLabel sx={{ fontSize: { xs: '0.7rem', md: '1rem' } }}>Group By</InputLabel>
                            <Select
                                value={groupBy}
                                label="Group By"
                                onChange={(e) => setGroupBy(e.target.value)}
                                sx={{ fontSize: { xs: '0.75rem', md: '1rem' } }}
                            >
                                {groupByOptions.map(opt => (
                                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ flex: { xs: 1, md: 'none' }, minWidth: { md: 140 }, '& .MuiInputBase-root': { height: { xs: 32, md: 40 } } }}>
                            <InputLabel sx={{ fontSize: { xs: '0.7rem', md: '1rem' } }}>Brand</InputLabel>
                            <Select
                                value={brandFilter}
                                label="Brand"
                                onChange={(e) => setBrandFilter(e.target.value)}
                                sx={{ fontSize: { xs: '0.75rem', md: '1rem' } }}
                            >
                                <MenuItem value="">All Brands</MenuItem>
                                {allBrands.map(brand => (
                                    <MenuItem key={brand} value={brand}>{brand}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Desktop only: Category + spacer + buttons */}
                        <FormControl size="small" sx={{ display: { xs: 'none', md: 'flex' }, minWidth: 140, '& .MuiInputBase-root': { height: 40 } }}>
                            <InputLabel>Category</InputLabel>
                            <Select
                                value={categoryFilter}
                                label="Category"
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                                <MenuItem value="">All Categories</MenuItem>
                                {allCategories.map(cat => (
                                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Box sx={{ display: { xs: 'none', md: 'block' }, flex: 1 }} />
                        <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' } }}>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<DownloadIcon sx={{ fontSize: 20 }} />}
                                onClick={handleExportPivotSummary}
                                disabled={loading || pivotData.length === 0}
                                sx={{ fontSize: '0.875rem', py: 1 }}
                            >
                                Export Summary
                            </Button>
                            <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                startIcon={exportingAllData ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon sx={{ fontSize: 20 }} />}
                                onClick={handleExportAllData}
                                disabled={loading || pivotData.length === 0 || exportingAllData}
                                sx={{ fontSize: '0.875rem', py: 1 }}
                            >
                                {exportingAllData ? 'Exporting...' : 'Export All Data'}
                            </Button>
                        </Stack>
                    </Box>

                    {/* Row 2 (Mobile only): Category + Export buttons */}
                    <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'row', gap: 0.75, alignItems: 'center' }}>
                        <FormControl size="small" sx={{ flex: 1, '& .MuiInputBase-root': { height: 32 } }}>
                            <InputLabel sx={{ fontSize: '0.7rem' }}>Category</InputLabel>
                            <Select
                                value={categoryFilter}
                                label="Category"
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                sx={{ fontSize: '0.75rem' }}
                            >
                                <MenuItem value="">All Categories</MenuItem>
                                {allCategories.map(cat => (
                                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
                            onClick={handleExportPivotSummary}
                            disabled={loading || pivotData.length === 0}
                            sx={{ fontSize: '0.65rem', py: 0.5, px: 1, minWidth: 'auto', whiteSpace: 'nowrap' }}
                        >
                            Summary
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={exportingAllData ? <CircularProgress size={12} color="inherit" /> : <DownloadIcon sx={{ fontSize: 14 }} />}
                            onClick={handleExportAllData}
                            disabled={loading || pivotData.length === 0 || exportingAllData}
                            sx={{ fontSize: '0.65rem', py: 0.5, px: 1, minWidth: 'auto', whiteSpace: 'nowrap' }}
                        >
                            {exportingAllData ? '...' : 'All Data'}
                        </Button>
                    </Box>
                </Box>

                {/* Loading */}
                {loading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                )}

                {/* Error */}
                {error && !loading && (
                    <Box sx={{ p: 2 }}>
                        <Alert severity="error">{error}</Alert>
                    </Box>
                )}

                {/* Pivot Table */}
                {!loading && !error && (
                    <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 0.75, md: 2 } }}>
                        <TableContainer
                            component={Paper}
                            elevation={0}
                            sx={{
                                bgcolor: isDarkMode ? '#1e293b' : 'white',
                                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                borderRadius: { xs: 1, md: 2 },
                                maxHeight: { xs: 'calc(100vh - 280px)', md: 'calc(100vh - 280px)' },
                                overflow: 'auto',
                            }}
                        >
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell
                                            sx={{
                                                fontWeight: 700,
                                                bgcolor: '#0f766e !important',
                                                color: 'white',
                                                fontSize: { xs: '0.7rem', md: '0.85rem' },
                                                minWidth: { xs: 100, md: 200 },
                                                py: { xs: 0.75, md: 1.5 },
                                                px: { xs: 0.75, md: 2 },
                                                borderBottom: 'none',
                                                position: 'sticky',
                                                top: 0,
                                                zIndex: 1,
                                            }}
                                        >
                                            {groupByOptions.find(o => o.value === groupBy)?.label || 'Category'}
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                fontWeight: 700,
                                                bgcolor: '#0f766e !important',
                                                color: 'white',
                                                fontSize: { xs: '0.7rem', md: '0.85rem' },
                                                py: { xs: 0.75, md: 1.5 },
                                                px: { xs: 0.75, md: 2 },
                                                borderBottom: 'none',
                                                position: 'sticky',
                                                top: 0,
                                                zIndex: 1,
                                            }}
                                        >
                                            Qty
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                fontWeight: 700,
                                                bgcolor: '#0f766e !important',
                                                color: 'white',
                                                fontSize: { xs: '0.7rem', md: '0.85rem' },
                                                py: { xs: 0.75, md: 1.5 },
                                                px: { xs: 0.75, md: 2 },
                                                borderBottom: 'none',
                                                position: 'sticky',
                                                top: 0,
                                                zIndex: 1,
                                            }}
                                        >
                                            FSP
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                fontWeight: 700,
                                                bgcolor: '#0f766e !important',
                                                color: 'white',
                                                fontSize: { xs: '0.7rem', md: '0.85rem' },
                                                py: { xs: 0.75, md: 1.5 },
                                                px: { xs: 0.75, md: 2 },
                                                borderBottom: 'none',
                                                position: 'sticky',
                                                top: 0,
                                                zIndex: 1,
                                            }}
                                        >
                                            MRP
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {pivotData.map((row, idx) => (
                                        <TableRow
                                            key={row.category}
                                            hover
                                            onDoubleClick={() => handleRowDoubleClick(row.category)}
                                            sx={{
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    bgcolor: isDarkMode ? 'rgba(5, 150, 105, 0.15)' : 'rgba(5, 150, 105, 0.08)',
                                                },
                                                bgcolor: idx % 2 === 0 ? 'transparent' : (isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                                            }}
                                        >
                                            <TableCell sx={{ fontWeight: 500, fontSize: { xs: '0.7rem', md: '0.85rem' }, py: { xs: 0.5, md: 1 }, px: { xs: 0.75, md: 2 } }}>
                                                {row.category}
                                            </TableCell>
                                            <TableCell
                                                align="right"
                                                sx={{
                                                    fontSize: { xs: '0.7rem', md: '0.85rem' },
                                                    fontWeight: 600,
                                                    color: isDarkMode ? '#10b981' : '#059669',
                                                    py: { xs: 0.5, md: 1 },
                                                    px: { xs: 0.75, md: 2 },
                                                }}
                                            >
                                                {formatNumber(row.qty)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', md: '0.85rem' }, py: { xs: 0.5, md: 1 }, px: { xs: 0.75, md: 2 } }}>
                                                {formatCurrency(row.total_fsp)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', md: '0.85rem' }, py: { xs: 0.5, md: 1 }, px: { xs: 0.75, md: 2 } }}>
                                                {formatCurrency(row.total_mrp)}
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                    {/* Grand Total Row */}
                                    <TableRow
                                        sx={{
                                            bgcolor: isDarkMode ? '#065f46' : '#047857',
                                            '& td': { fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.9rem' }, color: 'white', py: { xs: 0.75, md: 1.5 }, px: { xs: 0.75, md: 2 } },
                                        }}
                                    >
                                        <TableCell sx={{ color: 'white !important' }}>
                                            TOTAL
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{ color: 'white !important' }}
                                        >
                                            {formatNumber(grandTotal.qty)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ color: 'white !important' }}>
                                            {formatCurrency(grandTotal.total_fsp)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ color: 'white !important' }}>
                                            {formatCurrency(grandTotal.total_mrp)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {/* Tip - hidden on mobile for compactness */}
                        <Box
                            sx={{
                                display: { xs: 'none', md: 'block' },
                                mt: 2,
                                p: 1.5,
                                bgcolor: isDarkMode ? 'rgba(5, 150, 105, 0.1)' : 'rgba(5, 150, 105, 0.05)',
                                borderRadius: 2,
                                border: `1px solid ${isDarkMode ? 'rgba(5, 150, 105, 0.2)' : 'rgba(5, 150, 105, 0.15)'}`,
                            }}
                        >
                            <Typography variant="caption" sx={{ color: isDarkMode ? '#10b981' : '#047857' }}>
                                💡 <strong>Double-click</strong> on any row to see full item details with all columns. You can export the details to Excel.
                            </Typography>
                        </Box>
                    </Box>
                )}
            </Drawer>

            {/* Drill-Down Dialog */}
            <Dialog
                open={drilldownOpen}
                onClose={() => setDrilldownOpen(false)}
                maxWidth={isMobile ? false : (drilldownFullscreen ? false : 'xl')}
                fullWidth={isMobile ? true : !drilldownFullscreen}
                fullScreen={isMobile ? true : drilldownFullscreen}
                PaperProps={{
                    sx: {
                        borderRadius: (isMobile || drilldownFullscreen) ? 0 : 2,
                        maxHeight: (isMobile || drilldownFullscreen) ? '100vh' : '90vh',
                        height: (isMobile || drilldownFullscreen) ? '100vh' : '90vh',
                        width: (isMobile || drilldownFullscreen) ? '100vw' : undefined,
                        margin: (isMobile || drilldownFullscreen) ? 0 : undefined,
                        transition: 'all 0.2s ease-in-out',
                        // Mobile: position below header with safe area padding
                        ...(isMobile && {
                            top: '42px',
                            height: 'calc(100vh - 42px)',
                            maxHeight: 'calc(100vh - 42px)',
                            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                        }),
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                        color: 'white',
                        py: { xs: 0.75, md: 1.5 },
                        px: { xs: 1.5, md: 3 },
                        minHeight: { xs: 48, md: 64 },
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1 }, minWidth: 0, flex: 1 }}>
                        <TableIcon sx={{ fontSize: { xs: 20, md: 24 } }} />
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={{ fontSize: { xs: '0.85rem', md: '1rem' }, fontWeight: 700, lineHeight: 1.2 }} noWrap>
                                {drilldownCategory}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: 'rgba(255,255,255,0.95)',
                                    fontSize: { xs: '0.6rem', md: '0.75rem' },
                                    lineHeight: 1.1,
                                    display: 'block',
                                }}
                            >
                                {formatNumber(drilldownTotal)} items • All Master Data Columns
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 }, flexShrink: 0 }}>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={exportingExcel ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon sx={{ fontSize: { xs: 16, md: 20 } }} />}
                            onClick={handleExportDrilldown}
                            disabled={exportingExcel || drilldownLoading}
                            sx={{
                                bgcolor: 'rgba(255,255,255,0.2)',
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                                fontSize: { xs: '0.65rem', md: '0.875rem' },
                                py: { xs: 0.5, md: 0.75 },
                                px: { xs: 1, md: 2 },
                                minWidth: 'auto',
                            }}
                        >
                            {exportingExcel ? '...' : (isMobile ? 'Export' : 'Export to Excel')}
                        </Button>
                        {/* Fullscreen button - desktop only */}
                        <Tooltip title={drilldownFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                            <IconButton
                                onClick={() => setDrilldownFullscreen(!drilldownFullscreen)}
                                sx={{ color: 'white', display: { xs: 'none', md: 'flex' }, p: { xs: 0.5, md: 1 } }}
                            >
                                {drilldownFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                            </IconButton>
                        </Tooltip>
                        <IconButton onClick={() => setDrilldownOpen(false)} sx={{ color: 'white', p: { xs: 0.5, md: 1 } }}>
                            <CloseIcon sx={{ fontSize: { xs: 20, md: 24 } }} />
                        </IconButton>
                    </Box>
                </DialogTitle>

                <Box sx={{ p: { xs: 0.5, md: 2 }, borderBottom: '1px solid rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 2 } }}>
                    <TextField
                        size="small"
                        placeholder="Search WSN, Product, Brand..."
                        value={drilldownSearch}
                        onChange={(e) => setDrilldownSearch(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ fontSize: { xs: 16, md: 20 }, color: 'text.secondary' }} />
                                </InputAdornment>
                            ),
                            sx: { fontSize: { xs: '0.75rem', md: '1rem' }, height: { xs: 32, md: 40 } },
                        }}
                        sx={{ flex: { xs: 1, md: 'none' }, width: { md: 300 } }}
                    />
                    <Tooltip title="Grid Settings">
                        <IconButton
                            onClick={() => setGridSettingsOpen(true)}
                            sx={{
                                bgcolor: 'rgba(13, 148, 136, 0.1)',
                                '&:hover': { bgcolor: 'rgba(13, 148, 136, 0.2)' },
                                p: { xs: 0.5, md: 1 },
                            }}
                        >
                            <SettingsIcon sx={{ color: '#0d9488', fontSize: { xs: 18, md: 24 } }} />
                        </IconButton>
                    </Tooltip>
                </Box>

                <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {drilldownLoading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Box
                            className="ag-theme-quartz"
                            sx={{
                                flex: 1,
                                width: '100%',
                                mb: { xs: 'calc(env(safe-area-inset-bottom, 8px) + 8px)', md: 0 },
                                // Desktop default styles
                                '--ag-header-height': '42px',
                                '--ag-row-height': '38px',
                                '--ag-header-foreground-color': '#ffffff',
                                '--ag-header-background-color': '#0f766e',
                                '--ag-border-color': 'rgba(0,0,0,0.12)',
                                '--ag-odd-row-background-color': 'rgba(240, 247, 244, 0.5)',
                                '--ag-row-hover-color': 'rgba(13, 148, 136, 0.08)',
                                '--ag-selected-row-background-color': 'rgba(13, 148, 136, 0.12)',
                                '--ag-font-size': '12px',
                                '--ag-font-family': 'Inter, -apple-system, sans-serif',
                                '--ag-cell-horizontal-padding': '8px',
                                '& .ag-root-wrapper': {
                                    border: 'none',
                                },
                                '& .ag-header': {
                                    borderBottom: '2px solid #0d9488',
                                    fontWeight: 600,
                                },
                                '& .ag-header-cell': {
                                    fontWeight: 600,
                                    fontSize: '11px',
                                    padding: '0 8px',
                                },
                                '& .ag-header-cell-text': {
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                },
                                '& .ag-row': {
                                    transition: 'background-color 0.15s ease',
                                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                                },
                                '& .ag-cell': {
                                    lineHeight: '36px',
                                    padding: '0 8px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    borderRight: '1px solid rgba(0,0,0,0.06)',
                                },
                                '& .ag-cell-value': {
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                },
                                // Pagination Panel Styles
                                '& .ag-paging-panel': {
                                    height: '52px',
                                    borderTop: '2px solid #0d9488',
                                    background: '#f0fdfa !important',
                                    color: '#1e293b !important',
                                    fontWeight: 500,
                                    padding: '0 16px',
                                },
                                '& .ag-paging-panel *': {
                                    color: '#1e293b !important',
                                },
                                '& .ag-paging-button': {
                                    cursor: 'pointer',
                                    backgroundColor: '#ffffff !important',
                                    border: '1px solid #0d9488 !important',
                                    borderRadius: '4px !important',
                                    margin: '0 3px !important',
                                    minWidth: '32px !important',
                                    height: '32px !important',
                                    display: 'flex !important',
                                    alignItems: 'center !important',
                                    justifyContent: 'center !important',
                                },
                                '& .ag-paging-button:hover': {
                                    backgroundColor: '#ccfbf1 !important',
                                },
                                '& .ag-paging-button.ag-disabled': {
                                    opacity: '0.4 !important',
                                    cursor: 'not-allowed !important',
                                    backgroundColor: '#e2e8f0 !important',
                                },
                                '& .ag-paging-button .ag-icon': {
                                    color: '#0f766e !important',
                                    fontSize: '18px !important',
                                    display: 'block !important',
                                },
                                '& .ag-icon-first, & .ag-icon-previous, & .ag-icon-next, & .ag-icon-last': {
                                    color: '#0f766e !important',
                                    display: 'block !important',
                                },
                                '& .ag-paging-row-summary-panel': {
                                    color: '#475569 !important',
                                    fontWeight: '500 !important',
                                    fontSize: '13px !important',
                                },
                                '& .ag-paging-row-summary-panel-number': {
                                    fontWeight: '700 !important',
                                    color: '#0f766e !important',
                                },
                                '& .ag-paging-page-summary-panel': {
                                    color: '#1e293b !important',
                                    fontWeight: '600 !important',
                                    fontSize: '13px !important',
                                },
                                '& .ag-paging-number': {
                                    fontWeight: '700 !important',
                                    color: '#0f766e !important',
                                },
                                '& .ag-picker-field-wrapper, & .ag-paging-page-size .ag-picker-field-wrapper': {
                                    backgroundColor: '#ffffff !important',
                                    border: '1px solid #0d9488 !important',
                                    borderRadius: '4px !important',
                                    minHeight: '32px !important',
                                },
                                '& .ag-picker-field-display': {
                                    color: '#1e293b !important',
                                    fontWeight: '600 !important',
                                },
                                '& .ag-label': {
                                    color: '#475569 !important',
                                    fontWeight: '500 !important',
                                },
                                // ======= MOBILE ONLY STYLES (< 900px) =======
                                '@media (max-width: 899px)': {
                                    '--ag-header-height': '32px',
                                    '--ag-row-height': '28px',
                                    '--ag-font-size': '11px',
                                    '--ag-cell-horizontal-padding': '4px',
                                    '--ag-border-color': 'rgba(0,0,0,0.18)',
                                    '--ag-row-border-color': 'rgba(0,0,0,0.18)',
                                    '& .ag-root-wrapper': {
                                        border: '1px solid rgba(0,0,0,0.2)',
                                    },
                                    '& .ag-header-cell': {
                                        fontSize: '10px',
                                        padding: '0 3px',
                                        borderRight: '1px solid rgba(255,255,255,0.25) !important',
                                    },
                                    '& .ag-row': {
                                        borderBottom: '1px solid rgba(0,0,0,0.18) !important',
                                    },
                                    '& .ag-cell': {
                                        lineHeight: '26px',
                                        padding: '0 3px',
                                        fontSize: '11px',
                                        borderRight: '1px solid rgba(0,0,0,0.18) !important',
                                    },
                                    // Mobile Pagination - Compact & Aligned
                                    '& .ag-paging-panel': {
                                        height: '38px !important',
                                        minHeight: '38px !important',
                                        padding: '0 6px !important',
                                        gap: '2px !important',
                                        justifyContent: 'space-between !important',
                                        flexWrap: 'nowrap !important',
                                    },
                                    '& .ag-paging-panel *': {
                                        fontSize: '10px !important',
                                    },
                                    // Hide row summary on mobile (1 to 100 of 228)
                                    '& .ag-paging-row-summary-panel': {
                                        display: 'none !important',
                                    },
                                    '& .ag-paging-page-size': {
                                        marginRight: 'auto !important',
                                    },
                                    '& .ag-paging-page-size .ag-picker-field-wrapper': {
                                        minHeight: '26px !important',
                                        height: '26px !important',
                                    },
                                    '& .ag-paging-page-size .ag-picker-field-display': {
                                        fontSize: '10px !important',
                                        padding: '0 4px !important',
                                    },
                                    '& .ag-paging-button': {
                                        minWidth: '24px !important',
                                        height: '24px !important',
                                        margin: '0 1px !important',
                                    },
                                    '& .ag-paging-button .ag-icon': {
                                        fontSize: '14px !important',
                                    },
                                    '& .ag-paging-page-summary-panel': {
                                        fontSize: '10px !important',
                                        gap: '2px !important',
                                    },
                                    '& .ag-paging-number': {
                                        fontSize: '10px !important',
                                    },
                                    '& .ag-label': {
                                        fontSize: '10px !important',
                                    },
                                },
                            }}
                        >
                            <AgGridReact
                                ref={gridRef}
                                rowData={filteredDrilldownData}
                                columnDefs={drilldownColumnDefs}
                                defaultColDef={defaultColDef}
                                pagination={true}
                                paginationPageSize={100}
                                paginationPageSizeSelector={[50, 100, 200, 500]}
                                animateRows={false}
                                enableCellTextSelection={true}
                                suppressMovableColumns={false}
                                // ⚡ PERFORMANCE: Optimizations for smooth fast scrolling
                                rowBuffer={100}
                                suppressRowTransform={true}
                                suppressAnimationFrame={true}
                                alwaysShowVerticalScroll={true}
                                debounceVerticalScrollbar={true}
                                suppressScrollOnNewData={true}
                                headerHeight={isMobile ? 32 : 44}
                                rowHeight={isMobile ? 28 : 40}
                                tooltipShowDelay={500}
                            />
                        </Box>
                    )}
                </DialogContent>
            </Dialog>

            {/* Grid Settings Dialog */}
            <Dialog
                open={gridSettingsOpen}
                onClose={() => setGridSettingsOpen(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } }}
            >
                <DialogTitle sx={{
                    background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
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
                                        sx={{ '&.Mui-checked': { color: '#0d9488' } }}
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
                                        sx={{ '&.Mui-checked': { color: '#0d9488' } }}
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
                                        sx={{ '&.Mui-checked': { color: '#0d9488' } }}
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

                <DialogActions sx={{ p: 2, background: 'rgba(13, 148, 136, 0.08)', gap: 1 }}>
                    <Button
                        onClick={() => {
                            setEnableSorting(true);
                            setEnableColumnFilters(true);
                            setEnableColumnResize(true);
                        }}
                        sx={{
                            fontWeight: 700,
                            color: '#64748b',
                            '&:hover': { bgcolor: 'rgba(100, 116, 139, 0.1)' }
                        }}
                    >
                        🔄 Reset All
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Button
                        variant="contained"
                        onClick={() => setGridSettingsOpen(false)}
                        sx={{
                            background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                            fontWeight: 700,
                            boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)',
                            '&:hover': { background: 'linear-gradient(135deg, #0f766e 0%, #0d5e56 100%)' }
                        }}
                    >
                        Done
                    </Button>
                </DialogActions>
            </Dialog >
        </>
    );
};

export default PivotTableDrawer;
