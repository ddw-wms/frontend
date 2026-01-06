'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Typography,
    useTheme,
    useMediaQuery,
    Grid,
    Tooltip,
    Alert,
} from '@mui/material';
import {
    Download as DownloadIcon,
    Refresh as RefreshIcon,
    Settings as SettingsIcon,
    Assessment as AssessmentIcon,
    Inventory as InventoryIcon,
    LocalShipping as LocalShippingIcon,
    CheckCircle as CheckCircleIcon,
    ShoppingCart as ShoppingCartIcon,
    TrendingUp as TrendingUpIcon,
    Timeline as TimelineIcon,
    Close as CloseIcon,
    Tune as TuneIcon,
} from '@mui/icons-material';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ClientSideRowModelModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import AppLayout from '@/components/AppLayout';
import { StandardPageHeader } from '@/components';
import api from '@/lib/api';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

interface Warehouse {
    id: number;
    name: string;
}

interface ReportConfig {
    name: string;
    icon: React.ReactNode;
    endpoint: string;
    description: string;
    color: string;
}

export default function ReportsPage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [selectedReport, setSelectedReport] = useState<string>('current_stock');
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [topLoading, setTopLoading] = useState(false);
    const [rowData, setRowData] = useState<any[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [summaryData, setSummaryData] = useState<any>(null);

    // Additional filters
    const [brand, setBrand] = useState<string>('');
    const [category, setCategory] = useState<string>('');
    const [customer, setCustomer] = useState<string>('');
    const [qcGrade, setQcGrade] = useState<string>('');

    // Grid settings
    const [gridSettingsOpen, setGridSettingsOpen] = useState(false);
    const [enableSorting, setEnableSorting] = useState(true);
    const [enableColumnFilters, setEnableColumnFilters] = useState(true);
    const [enableColumnResize, setEnableColumnResize] = useState(true);

    const gridRef = useRef<AgGridReact>(null);

    const reportConfigs: Record<string, ReportConfig> = {
        current_stock: {
            name: 'Current Stock',
            icon: <InventoryIcon />,
            endpoint: '/reports/current-stock',
            description: 'View current inventory status',
            color: '#1976d2'
        },
        stock_movement: {
            name: 'Stock Movement',
            icon: <TimelineIcon />,
            endpoint: '/reports/stock-movement',
            description: 'Track inventory movements',
            color: '#9c27b0'
        },
        inbound: {
            name: 'Inbound Report',
            icon: <InventoryIcon />,
            endpoint: '/reports/inbound',
            description: 'Inbound inventory analysis',
            color: '#2196f3'
        },
        outbound: {
            name: 'Outbound Report',
            icon: <LocalShippingIcon />,
            endpoint: '/reports/outbound',
            description: 'Outbound shipments report',
            color: '#4caf50'
        },
        qc: {
            name: 'QC Report',
            icon: <CheckCircleIcon />,
            endpoint: '/reports/qc',
            description: 'Quality check analysis',
            color: '#ff9800'
        },
        picking: {
            name: 'Picking Report',
            icon: <ShoppingCartIcon />,
            endpoint: '/reports/picking',
            description: 'Picking operations report',
            color: '#e91e63'
        },
        performance: {
            name: 'User Performance',
            icon: <TrendingUpIcon />,
            endpoint: '/reports/user-performance',
            description: 'Staff performance metrics',
            color: '#00bcd4'
        },
        summary: {
            name: 'Warehouse Summary',
            icon: <AssessmentIcon />,
            endpoint: '/reports/warehouse-summary',
            description: 'Overall warehouse statistics',
            color: '#607d8b'
        }
    };

    useEffect(() => {
        fetchWarehouses();
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        setStartDate(dayjs(thirtyDaysAgo).format('YYYY-MM-DD'));
        setEndDate(dayjs(today).format('YYYY-MM-DD'));
    }, []);

    const fetchWarehouses = async () => {
        try {
            const response = await api.get('/warehouses');
            setWarehouses(response.data);
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const getColumnDefs = useMemo(() => {
        const commonColConfig = {
            sortable: enableSorting,
            filter: enableColumnFilters,
            resizable: enableColumnResize,
            floatingFilter: enableColumnFilters,
        };

        switch (selectedReport) {
            case 'current_stock':
                return [
                    { field: 'wsn', headerName: 'WSN', width: 140, pinned: 'left', ...commonColConfig },
                    { field: 'warehouse_name', headerName: 'Warehouse', width: 130, ...commonColConfig },
                    { field: 'product_title', headerName: 'Product', width: 300, ...commonColConfig },
                    { field: 'brand', headerName: 'Brand', width: 150, ...commonColConfig },
                    { field: 'cms_vertical', headerName: 'Category', width: 120, ...commonColConfig },
                    {
                        field: 'mrp',
                        headerName: 'MRP',
                        width: 100,
                        valueFormatter: (params: any) => params.value ? `₹${params.value}` : '',
                        ...commonColConfig
                    },
                    { field: 'rack_no', headerName: 'Rack', width: 100, ...commonColConfig },
                    {
                        field: 'current_status',
                        headerName: 'Status',
                        width: 130,
                        cellRenderer: (params: any) => {
                            const status = params.value;
                            const colorMap: any = {
                                'INBOUND': 'primary',
                                'QC': 'info',
                                'PICKING': 'warning',
                                'OUTBOUND': 'success'
                            };
                            return <Chip label={status} size="small" color={colorMap[status] || 'default'} />;
                        },
                        ...commonColConfig
                    },
                    {
                        field: 'inbound_date',
                        headerName: 'Inbound Date',
                        width: 130,
                        valueFormatter: (params: any) => params.value ? dayjs(params.value).format('DD-MMM-YYYY') : '',
                        ...commonColConfig
                    }
                ];

            case 'stock_movement':
                return [
                    { field: 'wsn', headerName: 'WSN', width: 140, pinned: 'left', ...commonColConfig },
                    {
                        field: 'movement_type',
                        headerName: 'Movement Type',
                        width: 150,
                        cellRenderer: (params: any) => {
                            const type = params.value;
                            const colorMap: any = {
                                'INBOUND': 'primary',
                                'QC': 'info',
                                'PICKING': 'warning',
                                'OUTBOUND': 'success'
                            };
                            return <Chip label={type} size="small" color={colorMap[type] || 'default'} />;
                        },
                        ...commonColConfig
                    },
                    {
                        field: 'movement_date',
                        headerName: 'Movement Date',
                        width: 140,
                        valueFormatter: (params: any) => params.value ? dayjs(params.value).format('DD-MMM-YYYY') : '',
                        ...commonColConfig
                    },
                    { field: 'user_name', headerName: 'User', width: 150, ...commonColConfig },
                    {
                        field: 'sort_date',
                        headerName: 'Timestamp',
                        width: 160,
                        valueFormatter: (params: any) => params.value ? dayjs(params.value).format('DD-MMM-YYYY HH:mm') : '',
                        ...commonColConfig
                    }
                ];

            case 'inbound':
                return [
                    { field: 'wsn', headerName: 'WSN', width: 140, pinned: 'left', ...commonColConfig },
                    { field: 'warehouse_name', headerName: 'Warehouse', width: 130, ...commonColConfig },
                    { field: 'product_title', headerName: 'Product', width: 300, ...commonColConfig },
                    { field: 'brand', headerName: 'Brand', width: 150, ...commonColConfig },
                    { field: 'cms_vertical', headerName: 'Category', width: 120, ...commonColConfig },
                    {
                        field: 'inbound_date',
                        headerName: 'Inbound Date',
                        width: 140,
                        valueFormatter: (params: any) => params.value ? dayjs(params.value).format('DD-MMM-YYYY') : '',
                        ...commonColConfig
                    },
                    { field: 'created_user_name', headerName: 'Created By', width: 150, ...commonColConfig }
                ];

            case 'outbound':
                return [
                    { field: 'wsn', headerName: 'WSN', width: 140, pinned: 'left', ...commonColConfig },
                    { field: 'warehouse_name', headerName: 'Warehouse', width: 130, ...commonColConfig },
                    { field: 'product_title', headerName: 'Product', width: 300, ...commonColConfig },
                    { field: 'customer_name', headerName: 'Customer', width: 180, ...commonColConfig },
                    { field: 'source', headerName: 'Source', width: 120, ...commonColConfig },
                    {
                        field: 'dispatch_date',
                        headerName: 'Dispatch Date',
                        width: 140,
                        valueFormatter: (params: any) => params.value ? dayjs(params.value).format('DD-MMM-YYYY') : '',
                        ...commonColConfig
                    },
                    { field: 'tracking_no', headerName: 'Tracking No', width: 150, ...commonColConfig }
                ];

            case 'qc':
                return [
                    { field: 'wsn', headerName: 'WSN', width: 140, pinned: 'left', ...commonColConfig },
                    { field: 'warehouse_name', headerName: 'Warehouse', width: 130, ...commonColConfig },
                    { field: 'product_title', headerName: 'Product', width: 300, ...commonColConfig },
                    { field: 'brand', headerName: 'Brand', width: 150, ...commonColConfig },
                    {
                        field: 'qc_grade',
                        headerName: 'QC Grade',
                        width: 110,
                        cellRenderer: (params: any) => {
                            const grade = params.value;
                            const colorMap: any = {
                                'A': 'success',
                                'B': 'info',
                                'C': 'warning',
                                'Reject': 'error'
                            };
                            return <Chip label={grade} size="small" color={colorMap[grade] || 'default'} />;
                        },
                        ...commonColConfig
                    },
                    {
                        field: 'qc_status',
                        headerName: 'QC Status',
                        width: 120,
                        cellRenderer: (params: any) => <Chip label={params.value} size="small" />,
                        ...commonColConfig
                    },
                    {
                        field: 'qc_date',
                        headerName: 'QC Date',
                        width: 130,
                        valueFormatter: (params: any) => params.value ? dayjs(params.value).format('DD-MMM-YYYY') : '',
                        ...commonColConfig
                    },
                    { field: 'qc_by_name', headerName: 'QC By', width: 150, ...commonColConfig }
                ];

            case 'picking':
                return [
                    { field: 'wsn', headerName: 'WSN', width: 140, pinned: 'left', ...commonColConfig },
                    { field: 'warehouse_name', headerName: 'Warehouse', width: 130, ...commonColConfig },
                    { field: 'product_title', headerName: 'Product', width: 300, ...commonColConfig },
                    { field: 'customer_name', headerName: 'Customer', width: 180, ...commonColConfig },
                    {
                        field: 'picking_date',
                        headerName: 'Picking Date',
                        width: 140,
                        valueFormatter: (params: any) => params.value ? dayjs(params.value).format('DD-MMM-YYYY') : '',
                        ...commonColConfig
                    },
                    { field: 'picked_by_name', headerName: 'Picked By', width: 150, ...commonColConfig }
                ];

            case 'performance':
                return [
                    { field: 'user_name', headerName: 'User Name', width: 180, pinned: 'left', ...commonColConfig },
                    {
                        field: 'activity_type',
                        headerName: 'Activity Type',
                        width: 150,
                        cellRenderer: (params: any) => <Chip label={params.value} size="small" color="primary" />,
                        ...commonColConfig
                    },
                    { field: 'total_operations', headerName: 'Total Operations', width: 160, ...commonColConfig },
                    {
                        field: 'first_operation',
                        headerName: 'First Operation',
                        width: 160,
                        valueFormatter: (params: any) => params.value ? dayjs(params.value).format('DD-MMM-YYYY HH:mm') : '',
                        ...commonColConfig
                    },
                    {
                        field: 'last_operation',
                        headerName: 'Last Operation',
                        width: 160,
                        valueFormatter: (params: any) => params.value ? dayjs(params.value).format('DD-MMM-YYYY HH:mm') : '',
                        ...commonColConfig
                    }
                ];

            default:
                return [];
        }
    }, [selectedReport, enableSorting, enableColumnFilters, enableColumnResize]);

    const handleGenerateReport = useCallback(async () => {
        if (!startDate || !endDate) {
            toast.error('Please select date range');
            return;
        }

        setLoading(true);
        setTopLoading(true);

        // Simulate minimum loading time for better UX
        const minLoadTime = new Promise(resolve => setTimeout(resolve, 350));

        try {
            const params: any = {
                warehouse_id: selectedWarehouse || undefined,
                start_date: startDate,
                end_date: endDate,
            };

            // Add specific filters based on report type
            if (selectedReport === 'current_stock' || selectedReport === 'inbound') {
                if (brand) params.brand = brand;
                if (category) params.category = category;
            }
            if (selectedReport === 'outbound' || selectedReport === 'picking') {
                if (customer) params.customer = customer;
            }
            if (selectedReport === 'qc') {
                if (qcGrade) params.qc_grade = qcGrade;
            }

            const endpoint = reportConfigs[selectedReport]?.endpoint || '/reports/current-stock';
            const response = await api.get(endpoint, { params });

            await minLoadTime;

            if (selectedReport === 'summary') {
                setSummaryData(response.data);
                setRowData([]);
                setTotalRecords(response.data?.total || 0);
            } else {
                setRowData(response.data.data || []);
                setTotalRecords(response.data.total || 0);
                setSummaryData(response.data.summary || null);
            }

            toast.success('Report generated successfully');
        } catch (error: any) {
            console.error('Error generating report:', error);
            toast.error(error.response?.data?.error || 'Failed to generate report');
            setRowData([]);
            setTotalRecords(0);
        } finally {
            setTopLoading(false);
            setTimeout(() => setLoading(false), 200);
        }
    }, [selectedReport, selectedWarehouse, startDate, endDate, brand, category, customer, qcGrade, reportConfigs]);

    const handleExport = useCallback(() => {
        if (!rowData || rowData.length === 0) {
            toast.error('No data to export');
            return;
        }

        try {
            const worksheet = XLSX.utils.json_to_sheet(rowData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, reportConfigs[selectedReport]?.name || 'Report');

            const fileName = `${selectedReport}_${dayjs().format('YYYY-MM-DD_HHmmss')}.xlsx`;
            XLSX.writeFile(workbook, fileName);

            toast.success('Report exported successfully');
        } catch (error) {
            console.error('Error exporting report:', error);
            toast.error('Failed to export report');
        }
    }, [rowData, selectedReport, reportConfigs]);

    const renderSummaryCards = () => {
        if (!summaryData) return null;

        if (selectedReport === 'summary') {
            return (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Box>
                                        <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Inbound</Typography>
                                        <Typography variant="h3" sx={{ fontWeight: 700 }}>{summaryData.inbound || 0}</Typography>
                                    </Box>
                                    <InventoryIcon sx={{ fontSize: 48, opacity: 0.8 }} />
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Box>
                                        <Typography variant="body2" sx={{ opacity: 0.9 }}>Total QC</Typography>
                                        <Typography variant="h3" sx={{ fontWeight: 700 }}>{summaryData.qc || 0}</Typography>
                                    </Box>
                                    <CheckCircleIcon sx={{ fontSize: 48, opacity: 0.8 }} />
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Box>
                                        <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Picking</Typography>
                                        <Typography variant="h3" sx={{ fontWeight: 700 }}>{summaryData.picking || 0}</Typography>
                                    </Box>
                                    <ShoppingCartIcon sx={{ fontSize: 48, opacity: 0.8 }} />
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card sx={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Box>
                                        <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Outbound</Typography>
                                        <Typography variant="h3" sx={{ fontWeight: 700 }}>{summaryData.outbound || 0}</Typography>
                                    </Box>
                                    <LocalShippingIcon sx={{ fontSize: 48, opacity: 0.8 }} />
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12}>
                        <Card sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Box>
                                        <Typography variant="h6" sx={{ opacity: 0.9 }}>Grand Total Operations</Typography>
                                        <Typography variant="h2" sx={{ fontWeight: 700, mt: 1 }}>{summaryData.total || 0}</Typography>
                                    </Box>
                                    <TrendingUpIcon sx={{ fontSize: 64, opacity: 0.8 }} />
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            );
        }

        if (selectedReport === 'inbound' && summaryData) {
            return (
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6} sm={3}>
                        <Card>
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">Total Inbound</Typography>
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>{summaryData.total_inbound || 0}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Card>
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">Unique Items</Typography>
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>{summaryData.unique_items || 0}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Card>
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">Brands</Typography>
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>{summaryData.brands_count || 0}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Card>
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">Categories</Typography>
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>{summaryData.categories_count || 0}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            );
        }

        if (selectedReport === 'qc' && Array.isArray(summaryData)) {
            return (
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    {summaryData.map((item: any, index: number) => (
                        <Grid item xs={6} sm={3} key={index}>
                            <Card>
                                <CardContent>
                                    <Typography variant="body2" color="text.secondary">
                                        {item.qc_grade} - {item.qc_status}
                                    </Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{item.count}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            );
        }

        return null;
    };

    return (
        <AppLayout>
            <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                {/* Loading Bar */}
                {topLoading && (
                    <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000 }}>
                        <Box sx={{ height: 3, background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    </Box>
                )}

                {/* Header */}
                <StandardPageHeader
                    icon={<AssessmentIcon />}
                    title="Reports & Analytics"
                    subtitle={`${totalRecords.toLocaleString()} records`}
                />

                {/* Report Type Selection */}
                <Box sx={{ px: 2, py: 2, borderBottom: '1px solid #e0e0e0', bgcolor: 'background.paper' }}>
                    <Grid container spacing={2}>
                        {Object.entries(reportConfigs).map(([key, config]) => (
                            <Grid item xs={6} sm={4} md={3} lg={1.5} key={key}>
                                <Card
                                    sx={{
                                        cursor: 'pointer',
                                        border: selectedReport === key ? 2 : 1,
                                        borderColor: selectedReport === key ? config.color : '#e0e0e0',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            boxShadow: 3
                                        },
                                        bgcolor: selectedReport === key ? `${config.color}10` : 'white'
                                    }}
                                    onClick={() => setSelectedReport(key)}
                                >
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Stack alignItems="center" spacing={0.5}>
                                            <Box sx={{ color: config.color }}>{config.icon}</Box>
                                            <Typography variant="caption" align="center" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                                                {config.name}
                                            </Typography>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Box>

                {/* Filters */}
                <Box sx={{ px: 2, py: 2, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems="center" flexWrap="wrap">
                        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 180 } }}>
                            <InputLabel>Warehouse</InputLabel>
                            <Select
                                value={selectedWarehouse}
                                onChange={(e) => setSelectedWarehouse(e.target.value)}
                                label="Warehouse"
                            >
                                <MenuItem value="">All Warehouses</MenuItem>
                                {warehouses.map((w) => (
                                    <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            type="date"
                            label="Start Date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            size="small"
                            sx={{ minWidth: { xs: '100%', sm: 150 } }}
                        />

                        <TextField
                            type="date"
                            label="End Date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            size="small"
                            sx={{ minWidth: { xs: '100%', sm: 150 } }}
                        />

                        {/* Additional filters based on report type */}
                        {(selectedReport === 'current_stock' || selectedReport === 'inbound') && (
                            <>
                                <TextField
                                    label="Brand"
                                    value={brand}
                                    onChange={(e) => setBrand(e.target.value)}
                                    size="small"
                                    placeholder="Filter by brand..."
                                    sx={{ minWidth: { xs: '100%', sm: 150 } }}
                                />
                                <TextField
                                    label="Category"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    size="small"
                                    placeholder="Filter by category..."
                                    sx={{ minWidth: { xs: '100%', sm: 150 } }}
                                />
                            </>
                        )}

                        {(selectedReport === 'outbound' || selectedReport === 'picking') && (
                            <TextField
                                label="Customer"
                                value={customer}
                                onChange={(e) => setCustomer(e.target.value)}
                                size="small"
                                placeholder="Filter by customer..."
                                sx={{ minWidth: { xs: '100%', sm: 150 } }}
                            />
                        )}

                        {selectedReport === 'qc' && (
                            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
                                <InputLabel>QC Grade</InputLabel>
                                <Select
                                    value={qcGrade}
                                    onChange={(e) => setQcGrade(e.target.value)}
                                    label="QC Grade"
                                >
                                    <MenuItem value="">All Grades</MenuItem>
                                    <MenuItem value="A">Grade A</MenuItem>
                                    <MenuItem value="B">Grade B</MenuItem>
                                    <MenuItem value="C">Grade C</MenuItem>
                                    <MenuItem value="Reject">Reject</MenuItem>
                                </Select>
                            </FormControl>
                        )}

                        <Button
                            variant="contained"
                            startIcon={<AssessmentIcon />}
                            onClick={handleGenerateReport}
                            disabled={loading}
                            sx={{
                                minWidth: { xs: '100%', sm: 160 },
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #5568d3 0%, #63408b 100%)'
                                }
                            }}
                        >
                            Generate Report
                        </Button>

                        <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={handleExport}
                            disabled={loading || rowData.length === 0}
                            sx={{ minWidth: { xs: '100%', sm: 140 } }}
                        >
                            Export Excel
                        </Button>

                        <Tooltip title="Grid Settings">
                            <IconButton onClick={() => setGridSettingsOpen(true)} size="small">
                                <TuneIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Refresh">
                            <IconButton onClick={handleGenerateReport} size="small">
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Box>

                {/* Summary Cards */}
                {selectedReport !== 'summary' && renderSummaryCards()}

                {/* Content Area */}
                <Box sx={{ flex: 1, p: 2, overflow: 'hidden' }}>
                    {selectedReport === 'summary' ? (
                        loading ? (
                            <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
                                <CircularProgress />
                            </Box>
                        ) : summaryData ? (
                            renderSummaryCards()
                        ) : (
                            <Alert severity="info">Click "Generate Report" to view warehouse summary</Alert>
                        )
                    ) : (
                        <Box
                            className="ag-theme-quartz"
                            sx={{
                                height: '100%',
                                width: '100%',
                                '& .ag-header-cell': {
                                    bgcolor: '#1976d2',
                                    color: 'white',
                                    fontWeight: 600
                                }
                            }}
                        >
                            {loading ? (
                                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                                    <CircularProgress />
                                </Box>
                            ) : rowData.length === 0 ? (
                                <Alert severity="info">
                                    No data available. Click "Generate Report" to load data.
                                </Alert>
                            ) : (
                                <AgGridReact
                                    ref={gridRef}
                                    rowData={rowData}
                                    columnDefs={getColumnDefs}
                                    defaultColDef={{
                                        flex: 1,
                                        minWidth: 100,
                                    }}
                                    pagination={true}
                                    paginationPageSize={50}
                                    paginationPageSizeSelector={[10, 25, 50, 100]}
                                    animateRows={true}
                                    rowSelection="multiple"
                                    suppressCellFocus={false}
                                />
                            )}
                        </Box>
                    )}
                </Box>

                {/* Grid Settings Dialog */}
                <Dialog open={gridSettingsOpen} onClose={() => setGridSettingsOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="h6">Grid Settings</Typography>
                            <IconButton onClick={() => setGridSettingsOpen(false)} size="small">
                                <CloseIcon />
                            </IconButton>
                        </Stack>
                    </DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <FormControlLabel
                                control={<Switch checked={enableSorting} onChange={(e) => setEnableSorting(e.target.checked)} />}
                                label="Enable Sorting"
                            />
                            <FormControlLabel
                                control={<Switch checked={enableColumnFilters} onChange={(e) => setEnableColumnFilters(e.target.checked)} />}
                                label="Enable Column Filters"
                            />
                            <FormControlLabel
                                control={<Switch checked={enableColumnResize} onChange={(e) => setEnableColumnResize(e.target.checked)} />}
                                label="Enable Column Resize"
                            />
                        </Stack>
                    </DialogContent>
                </Dialog>
            </Box>
        </AppLayout>
    );
}
