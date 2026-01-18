// File: components/PivotTableDrawer.tsx
// Excel-style Pivot Table with Server-Side Aggregation
// Handles 5-10 lakh+ products smoothly

import React, { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import {
    Close as CloseIcon,
    Download as DownloadIcon,
    PivotTableChart as PivotIcon,
    Refresh as RefreshIcon,
    Search as SearchIcon,
    TableChart as TableIcon,
} from '@mui/icons-material';
import { dashboardAPI } from '@/lib/api';

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
    const [drilldownCategory, setDrilldownCategory] = useState<string>('');
    const [drilldownData, setDrilldownData] = useState<any[]>([]);
    const [drilldownLoading, setDrilldownLoading] = useState(false);
    const [drilldownPage, setDrilldownPage] = useState(1);
    const [drilldownTotal, setDrilldownTotal] = useState(0);
    const [drilldownTotalPages, setDrilldownTotalPages] = useState(0);
    const [drilldownSearch, setDrilldownSearch] = useState('');
    const [exportingExcel, setExportingExcel] = useState(false);
    const [drilldownLimit, setDrilldownLimit] = useState(100);

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
        fetchDrilldownData(category, 1);
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

    // Filtered drilldown data based on search
    const filteredDrilldownData = drilldownSearch
        ? drilldownData.filter(row =>
            row.wsn?.toLowerCase().includes(drilldownSearch.toLowerCase()) ||
            row.product_title?.toLowerCase().includes(drilldownSearch.toLowerCase()) ||
            row.brand?.toLowerCase().includes(drilldownSearch.toLowerCase())
        )
        : drilldownData;

    const drawerWidth = isMobile ? '100%' : 700;

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
                PaperProps={{
                    sx: {
                        width: drawerWidth,
                        maxWidth: '100vw',
                        bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                    },
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2,
                        py: 1.5,
                        background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                        color: 'white',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PivotIcon />
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                            Inventory Pivot Table
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Chip
                            label={loading ? 'Loading...' : `${formatNumber(grandTotal.qty)} items`}
                            size="small"
                            sx={{
                                bgcolor: 'rgba(255,255,255,0.2)',
                                color: 'white',
                                fontSize: '0.75rem',
                                height: 24,
                                fontWeight: 600,
                            }}
                        />
                        <Tooltip title="Refresh">
                            <IconButton onClick={fetchPivotSummary} sx={{ color: 'white' }} disabled={loading}>
                                <RefreshIcon sx={{ fontSize: 20 }} />
                            </IconButton>
                        </Tooltip>
                        <IconButton onClick={onClose} sx={{ color: 'white' }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </Box>

                {/* Controls */}
                <Box
                    sx={{
                        p: 2,
                        bgcolor: isDarkMode ? '#1e293b' : 'white',
                        borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        flexWrap: 'wrap',
                    }}
                >
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Group By</InputLabel>
                        <Select
                            value={groupBy}
                            label="Group By"
                            onChange={(e) => setGroupBy(e.target.value)}
                        >
                            {groupByOptions.map(opt => (
                                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Brand Filter */}
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel>Brand</InputLabel>
                        <Select
                            value={brandFilter}
                            label="Brand"
                            onChange={(e) => setBrandFilter(e.target.value)}
                        >
                            <MenuItem value="">All Brands</MenuItem>
                            {allBrands.map(brand => (
                                <MenuItem key={brand} value={brand}>{brand}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Category Filter */}
                    <FormControl size="small" sx={{ minWidth: 140 }}>
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

                    {/* Reset Filters Button */}
                    {(brandFilter || categoryFilter) && (
                        <Button
                            size="small"
                            variant="text"
                            color="error"
                            onClick={() => {
                                setBrandFilter('');
                                setCategoryFilter('');
                            }}
                            sx={{ minWidth: 'auto', px: 1 }}
                        >
                            Reset Filters
                        </Button>
                    )}

                    <Box sx={{ flex: 1 }} />

                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handleExportPivotSummary}
                        disabled={loading || pivotData.length === 0}
                    >
                        Export Summary
                    </Button>
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
                    <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                        <TableContainer
                            component={Paper}
                            elevation={0}
                            sx={{
                                bgcolor: isDarkMode ? '#1e293b' : 'white',
                                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                borderRadius: 2,
                                maxHeight: 'calc(100vh - 280px)',
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
                                                fontSize: '0.85rem',
                                                minWidth: 200,
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
                                                fontSize: '0.85rem',
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
                                                fontSize: '0.85rem',
                                                borderBottom: 'none',
                                                position: 'sticky',
                                                top: 0,
                                                zIndex: 1,
                                            }}
                                        >
                                            Total FSP
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                fontWeight: 700,
                                                bgcolor: '#0f766e !important',
                                                color: 'white',
                                                fontSize: '0.85rem',
                                                borderBottom: 'none',
                                                position: 'sticky',
                                                top: 0,
                                                zIndex: 1,
                                            }}
                                        >
                                            Total MRP
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
                                            <TableCell sx={{ fontWeight: 500, fontSize: '0.85rem' }}>
                                                {row.category}
                                            </TableCell>
                                            <TableCell
                                                align="right"
                                                sx={{
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    color: isDarkMode ? '#10b981' : '#059669',
                                                }}
                                            >
                                                {formatNumber(row.qty)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                                                {formatCurrency(row.total_fsp)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                                                {formatCurrency(row.total_mrp)}
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                    {/* Grand Total Row */}
                                    <TableRow
                                        sx={{
                                            bgcolor: isDarkMode ? '#065f46' : '#047857',
                                            '& td': { fontWeight: 700, fontSize: '0.9rem', color: 'white' },
                                        }}
                                    >
                                        <TableCell sx={{ color: 'white !important' }}>
                                            GRAND TOTAL
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

                        {/* Tip */}
                        <Box
                            sx={{
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
                maxWidth="xl"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        maxHeight: '90vh',
                        height: '90vh',
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
                        py: 1.5,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TableIcon />
                        <Box>
                            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700 }}>
                                {drilldownCategory}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.9 }}>
                                {formatNumber(drilldownTotal)} items • All Master Data Columns
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={exportingExcel ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                            onClick={handleExportDrilldown}
                            disabled={exportingExcel || drilldownLoading}
                            sx={{
                                bgcolor: 'rgba(255,255,255,0.2)',
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                            }}
                        >
                            {exportingExcel ? 'Exporting...' : 'Export to Excel'}
                        </Button>
                        <IconButton onClick={() => setDrilldownOpen(false)} sx={{ color: 'white' }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>

                <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                    <TextField
                        size="small"
                        placeholder="Search WSN, Product, Brand..."
                        value={drilldownSearch}
                        onChange={(e) => setDrilldownSearch(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ width: 300 }}
                    />
                </Box>

                <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {drilldownLoading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                            {/* Excel-style table */}
                            <Table size="small" stickyHeader sx={{ borderCollapse: 'collapse' }}>
                                <TableHead>
                                    <TableRow>
                                        {[
                                            'Sr.No', 'WSN', 'WID', 'FSN', 'Order ID', 'Product Title', 'Brand', 'Category',
                                            'HSN/SAC', 'IGST', 'FSP', 'MRP', 'VRP', 'Yield',
                                            'Rack', 'WH Location', 'P Type', 'P Size',
                                            'Inbound Date', 'QC Grade', 'QC Date', 'Stage'
                                        ].map((header) => (
                                            <TableCell
                                                key={header}
                                                sx={{
                                                    fontWeight: 600,
                                                    fontSize: '11px',
                                                    bgcolor: '#0f766e', // Consistent teal header
                                                    color: 'white',
                                                    whiteSpace: 'nowrap',
                                                    py: 1,
                                                    px: 1.5,
                                                    borderRight: '1px solid rgba(255,255,255,0.3)',
                                                    minWidth: header === 'Product Title' ? 200 : header === 'Sr.No' ? 50 : header === 'WSN' ? 100 : 70,
                                                }}
                                            >
                                                {header}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredDrilldownData.map((row, idx) => (
                                        <TableRow
                                            key={row.wsn || idx}
                                            sx={{
                                                bgcolor: idx % 2 === 0 ? '#ffffff' : '#f0f7f4', // Excel alternating rows
                                                '&:hover': { bgcolor: '#e8f4fd' },
                                                height: 24, // Fixed row height like Excel
                                            }}
                                        >
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap', textAlign: 'center', bgcolor: '#f5f5f5' }}>
                                                {(drilldownPage - 1) * drilldownLimit + idx + 1}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>
                                                {row.wsn}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.wid}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.fsn}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.order_id}</TableCell>
                                            <TableCell
                                                sx={{
                                                    fontSize: '11px',
                                                    py: 0.5,
                                                    px: 1,
                                                    borderRight: '1px solid #d0d0d0',
                                                    borderBottom: '1px solid #d0d0d0',
                                                    fontFamily: 'Calibri, Arial, sans-serif',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: 280,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                                title={row.product_title}
                                            >
                                                {row.product_title}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.brand}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.cms_vertical}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.hsn_sac}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.igst_rate}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.fsp}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.mrp}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.vrp}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.yield_value}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.rack_no}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.wh_location}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.p_type}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.p_size}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{formatDate(row.inbound_date)}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.qc_grade || ''}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderRight: '1px solid #d0d0d0', borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{formatDate(row.qc_date)}</TableCell>
                                            <TableCell sx={{ fontSize: '11px', py: 0.5, px: 1, borderBottom: '1px solid #d0d0d0', fontFamily: 'Calibri, Arial, sans-serif', whiteSpace: 'nowrap' }}>{row.current_stage}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </DialogContent>

                <DialogActions sx={{ px: 2, py: 1.5, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                        {drilldownTotalPages > 1 && (
                            <Pagination
                                count={drilldownTotalPages}
                                page={drilldownPage}
                                onChange={handleDrilldownPageChange}
                                size="small"
                                color="primary"
                            />
                        )}
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <InputLabel>Per Page</InputLabel>
                            <Select
                                value={drilldownLimit}
                                label="Per Page"
                                onChange={(e) => {
                                    const newLimit = Number(e.target.value);
                                    setDrilldownLimit(newLimit);
                                    setDrilldownPage(1);
                                    fetchDrilldownData(drilldownCategory, 1, newLimit);
                                }}
                            >
                                <MenuItem value={100}>100</MenuItem>
                                <MenuItem value={500}>500</MenuItem>
                                <MenuItem value={1000}>1000</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                    <Button onClick={() => setDrilldownOpen(false)} variant="contained">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default PivotTableDrawer;
