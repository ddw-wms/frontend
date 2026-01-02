// File Path = warehouse-frontend/app/reports/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Tabs,
    Tab,
    TextField,
    Button,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    CircularProgress,
    Alert,
    Stack,
    IconButton,
    Tooltip,
    TablePagination,
} from '@mui/material';
import {
    Download,
    Refresh,
    Assessment,
    Inventory,
    LocalShipping,
    CheckCircle,
    ShoppingCart,
    TrendingUp,
} from '@mui/icons-material';
import api from '@/lib/api';
import dayjs from 'dayjs';
import AppLayout from '@/components/AppLayout';

interface Warehouse {
    id: number;
    name: string;
}

interface ReportData {
    data: any[];
    summary?: any;
    total: number;
}

export default function ReportsPage() {
    const [currentTab, setCurrentTab] = useState(0);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [reportData, setReportData] = useState<ReportData>({ data: [], total: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [summaryData, setSummaryData] = useState<any>(null);

    // Pagination (server-aware)
    const [page, setPage] = useState<number>(0);
    const [rowsPerPage, setRowsPerPage] = useState<number>(50);

    // Additional filters
    const [brand, setBrand] = useState<string>('');
    const [category, setCategory] = useState<string>('');
    const [customer, setCustomer] = useState<string>('');
    const [qcGrade, setQcGrade] = useState<string>('');

    useEffect(() => {
        fetchWarehouses();
        // Set default date range (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        setStartDate(dayjs(thirtyDaysAgo).format('YYYY-MM-DD'));
        setEndDate(dayjs(today).format('YYYY-MM-DD'));
    }, []);

    useEffect(() => {
        // Auto-fetch report when tab, page or rowsPerPage changes
        if (startDate && endDate) {
            handleGenerateReport();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTab, page, rowsPerPage]);

    const fetchWarehouses = async () => {
        try {
            const response = await api.get('/warehouses');
            setWarehouses(response.data);
        } catch (error: any) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const handleGenerateReport = async () => {
        setLoading(true);
        setError('');

        try {
            const params: any = {
                warehouse_id: selectedWarehouse || undefined,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                page: page + 1,
                limit: rowsPerPage,
            };

            let endpoint = '';

            switch (currentTab) {
                case 0: // Current Stock
                    endpoint = '/reports/current-stock';
                    if (brand) params.brand = brand;
                    if (category) params.category = category;
                    break;
                case 1: // Stock Movement
                    endpoint = '/reports/stock-movement';
                    break;
                case 2: // Inbound
                    endpoint = '/reports/inbound';
                    if (brand) params.brand = brand;
                    if (category) params.category = category;
                    break;
                case 3: // Outbound
                    endpoint = '/reports/outbound';
                    if (customer) params.customer = customer;
                    break;
                case 4: // QC
                    endpoint = '/reports/qc';
                    if (qcGrade) params.qc_grade = qcGrade;
                    break;
                case 5: // Picking
                    endpoint = '/reports/picking';
                    if (customer) params.customer = customer;
                    break;
                case 6: // Performance
                    endpoint = '/reports/user-performance';
                    break;
                case 7: // Summary
                    endpoint = '/reports/warehouse-summary';
                    break;
                default:
                    endpoint = '/reports/current-stock';
            }

            const response = await api.get(endpoint, { params });
            setReportData(response.data);

            // For summary dashboard
            if (currentTab === 7) {
                setSummaryData(response.data);
            }
        } catch (error: any) {
            setError(error.response?.data?.error || 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const handleExportToExcel = async () => {
        try {
            const reportTypeMap: any = {
                0: 'current_stock',
                1: 'stock_movement',
                2: 'inbound',
                3: 'outbound',
                4: 'qc',
                5: 'picking',
                6: 'user_performance',
                7: 'warehouse_summary',
            };

            const params: any = {
                report_type: reportTypeMap[currentTab],
                warehouse_id: selectedWarehouse || undefined,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
            };

            const response = await api.get('/reports/export', {
                params,
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${reportTypeMap[currentTab]}_report.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error: any) {
            setError('Failed to export report');
        }
    };

    const renderFilters = () => (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
                select
                label="Warehouse"
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                size="small"
                sx={{ minWidth: { xs: '100%', sm: 200 } }}
            >
                <MenuItem value="">All Warehouses</MenuItem>
                {warehouses && warehouses.length > 0 && warehouses.map((w) => (
                    <MenuItem key={w.id} value={w.id}>
                        {w.name}
                    </MenuItem>
                ))}
            </TextField>

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
                sx={{ minWidth: 150 }}
            />

            {/* Additional filters based on report type */}
            {(currentTab === 0 || currentTab === 2) && (
                <>
                    <TextField
                        label="Brand"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        size="small"
                        placeholder="Search brand..."
                        sx={{ minWidth: 150 }}
                    />
                    <TextField
                        label="Category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        size="small"
                        placeholder="Search category..."
                        sx={{ minWidth: 150 }}
                    />
                </>
            )}

            {(currentTab === 3 || currentTab === 5) && (
                <TextField
                    label="Customer"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    size="small"
                    placeholder="Search customer..."
                    sx={{ minWidth: 150 }}
                />
            )}

            {currentTab === 4 && (
                <TextField
                    select
                    label="QC Grade"
                    value={qcGrade}
                    onChange={(e) => setQcGrade(e.target.value)}
                    size="small"
                    sx={{ minWidth: 150 }}
                >
                    <MenuItem value="">All Grades</MenuItem>
                    <MenuItem value="A">Grade A</MenuItem>
                    <MenuItem value="B">Grade B</MenuItem>
                    <MenuItem value="C">Grade C</MenuItem>
                    <MenuItem value="Reject">Reject</MenuItem>
                </TextField>
            )}

            <Button
                variant="contained"
                startIcon={<Assessment />}
                onClick={handleGenerateReport}
                disabled={loading}
                sx={{ minWidth: { xs: '100%', sm: 150 } }}
            >
                Generate Report
            </Button>

            <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleExportToExcel}
                disabled={loading || !reportData?.data || reportData.data.length === 0}
                sx={{ minWidth: { xs: '100%', sm: 150 } }}
                aria-label="Export report to Excel"
            >
                Export Excel
            </Button>
        </Box>
    );

    const renderCurrentStockTable = () => (
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <TableContainer component={Paper}>
                <Table sx={{ minWidth: 900 }} size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'primary.main' }}>
                            <TableCell sx={{ color: 'white' }}>WSN</TableCell>
                            <TableCell sx={{ color: 'white' }}>Warehouse</TableCell>
                            <TableCell sx={{ color: 'white' }}>Product</TableCell>
                            <TableCell sx={{ color: 'white' }}>Brand</TableCell>
                            <TableCell sx={{ color: 'white' }}>Category</TableCell>
                            <TableCell sx={{ color: 'white' }}>MRP</TableCell>
                            <TableCell sx={{ color: 'white' }}>Rack</TableCell>
                            <TableCell sx={{ color: 'white' }}>Status</TableCell>
                            <TableCell sx={{ color: 'white' }}>Inbound Date</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {reportData.data.map((row: any, index: number) => (
                            <TableRow key={index} hover>
                                <TableCell>{row.wsn}</TableCell>
                                <TableCell>{row.warehouse_name}</TableCell>
                                <TableCell sx={{ maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.product_title}</TableCell>
                                <TableCell sx={{ maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.brand}</TableCell>
                                <TableCell>{row.cms_vertical}</TableCell>
                                <TableCell>₹{row.mrp}</TableCell>
                                <TableCell>{row.rack_no || 'N/A'}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={row.current_status}
                                        size="small"
                                        color={
                                            row.current_status === 'OUTBOUND' ? 'success' :
                                                row.current_status === 'PICKING' ? 'warning' :
                                                    row.current_status === 'QC' ? 'info' : 'default'
                                        }
                                    />
                                </TableCell>
                                <TableCell>{row.inbound_date ? dayjs(row.inbound_date).format('DD-MMM-YYYY') : ''}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );

    const renderStockMovementTable = () => (
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <TableContainer component={Paper}>
                <Table sx={{ minWidth: 700 }} size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'primary.main' }}>
                            <TableCell sx={{ color: 'white' }}>WSN</TableCell>
                            <TableCell sx={{ color: 'white' }}>Movement Type</TableCell>
                            <TableCell sx={{ color: 'white' }}>Movement Date</TableCell>
                            <TableCell sx={{ color: 'white' }}>User</TableCell>
                            <TableCell sx={{ color: 'white' }}>Timestamp</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {reportData.data.map((row: any, index: number) => (
                            <TableRow key={index} hover>
                                <TableCell>{row.wsn}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={row.movement_type}
                                        size="small"
                                        color={
                                            row.movement_type === 'OUTBOUND' ? 'success' :
                                                row.movement_type === 'PICKING' ? 'warning' :
                                                    row.movement_type === 'QC' ? 'info' : 'default'
                                        }
                                    />
                                </TableCell>
                                <TableCell>{row.movement_date ? dayjs(row.movement_date).format('DD-MMM-YYYY') : ''}</TableCell>
                                <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.user_name}</TableCell>
                                <TableCell>{row.sort_date ? dayjs(row.sort_date).format('DD-MMM-YYYY HH:mm') : ''}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );

    const renderInboundTable = () => (
        <Box>
            {reportData.summary && (
                <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                    <Card sx={{ minWidth: 200 }}>
                        <CardContent>
                            <Typography variant="body2" color="text.secondary">Total Inbound</Typography>
                            <Typography variant="h4">{reportData.summary.total_inbound}</Typography>
                        </CardContent>
                    </Card>
                    <Card sx={{ minWidth: 200 }}>
                        <CardContent>
                            <Typography variant="body2" color="text.secondary">Unique Items</Typography>
                            <Typography variant="h4">{reportData.summary.unique_items}</Typography>
                        </CardContent>
                    </Card>
                    <Card sx={{ minWidth: 200 }}>
                        <CardContent>
                            <Typography variant="body2" color="text.secondary">Brands</Typography>
                            <Typography variant="h4">{reportData.summary.brands_count}</Typography>
                        </CardContent>
                    </Card>
                    <Card sx={{ minWidth: 200 }}>
                        <CardContent>
                            <Typography variant="body2" color="text.secondary">Categories</Typography>
                            <Typography variant="h4">{reportData.summary.categories_count}</Typography>
                        </CardContent>
                    </Card>
                </Box>
            )}
            <Box sx={{ width: '100%', overflowX: 'auto' }}>
                <TableContainer component={Paper}>
                    <Table sx={{ minWidth: 900 }} size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'primary.main' }}>
                                <TableCell sx={{ color: 'white' }}>WSN</TableCell>
                                <TableCell sx={{ color: 'white' }}>Warehouse</TableCell>
                                <TableCell sx={{ color: 'white' }}>Product</TableCell>
                                <TableCell sx={{ color: 'white' }}>Brand</TableCell>
                                <TableCell sx={{ color: 'white' }}>Category</TableCell>
                                <TableCell sx={{ color: 'white' }}>Inbound Date</TableCell>
                                <TableCell sx={{ color: 'white' }}>Created By</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {reportData.data.map((row: any, index: number) => (
                                <TableRow key={index} hover>
                                    <TableCell>{row.wsn}</TableCell>
                                    <TableCell>{row.warehouse_name}</TableCell>
                                    <TableCell sx={{ maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.product_title}</TableCell>
                                    <TableCell sx={{ maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.brand}</TableCell>
                                    <TableCell>{row.cms_vertical}</TableCell>
                                    <TableCell>{row.inbound_date ? dayjs(row.inbound_date).format('DD-MMM-YYYY') : ''}</TableCell>
                                    <TableCell sx={{ maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.created_user_name}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
        </Box>
    );

    const renderOutboundTable = () => (
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <TableContainer component={Paper}>
                <Table sx={{ minWidth: 900 }} size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'primary.main' }}>
                            <TableCell sx={{ color: 'white' }}>WSN</TableCell>
                            <TableCell sx={{ color: 'white' }}>Warehouse</TableCell>
                            <TableCell sx={{ color: 'white' }}>Product</TableCell>
                            <TableCell sx={{ color: 'white' }}>Customer</TableCell>
                            <TableCell sx={{ color: 'white' }}>Source</TableCell>
                            <TableCell sx={{ color: 'white' }}>Dispatch Date</TableCell>
                            <TableCell sx={{ color: 'white' }}>Tracking No</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {reportData.data.map((row: any, index: number) => (
                            <TableRow key={index} hover>
                                <TableCell>{row.wsn}</TableCell>
                                <TableCell>{row.warehouse_name}</TableCell>
                                <TableCell sx={{ maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.product_title}</TableCell>
                                <TableCell sx={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.customer_name}</TableCell>
                                <TableCell>{row.source}</TableCell>
                                <TableCell>{row.dispatch_date ? dayjs(row.dispatch_date).format('DD-MMM-YYYY') : ''}</TableCell>
                                <TableCell>{row.tracking_no}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );

    const renderQCTable = () => (
        <Box>
            {reportData.summary && reportData.summary.length > 0 && (
                <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                    {reportData.summary.map((item: any, index: number) => (
                        <Card key={index} sx={{ minWidth: 200 }}>
                            <CardContent>
                                <Typography variant="body2" color="text.secondary">
                                    {item.qc_grade} - {item.qc_status}
                                </Typography>
                                <Typography variant="h4">{item.count}</Typography>
                            </CardContent>
                        </Card>
                    ))}
                </Box>
            )}
            <Box sx={{ width: '100%', overflowX: 'auto' }}>
                <TableContainer component={Paper}>
                    <Table sx={{ minWidth: 900 }} size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'primary.main' }}>
                                <TableCell sx={{ color: 'white' }}>WSN</TableCell>
                                <TableCell sx={{ color: 'white' }}>Warehouse</TableCell>
                                <TableCell sx={{ color: 'white' }}>Product</TableCell>
                                <TableCell sx={{ color: 'white' }}>Brand</TableCell>
                                <TableCell sx={{ color: 'white' }}>QC Grade</TableCell>
                                <TableCell sx={{ color: 'white' }}>QC Status</TableCell>
                                <TableCell sx={{ color: 'white' }}>QC Date</TableCell>
                                <TableCell sx={{ color: 'white' }}>QC By</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {reportData.data.map((row: any, index: number) => (
                                <TableRow key={index} hover>
                                    <TableCell>{row.wsn}</TableCell>
                                    <TableCell>{row.warehouse_name}</TableCell>
                                    <TableCell sx={{ maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.product_title}</TableCell>
                                    <TableCell sx={{ maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.brand}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={row.qc_grade}
                                            size="small"
                                            color={row.qc_grade === 'A' ? 'success' : row.qc_grade === 'B' ? 'info' : 'warning'}
                                        />
                                    </TableCell>
                                    <TableCell><Chip label={row.qc_status} size="small" /></TableCell>
                                    <TableCell>{row.qc_date ? dayjs(row.qc_date).format('DD-MMM-YYYY') : ''}</TableCell>
                                    <TableCell sx={{ maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.qc_by_name}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
        </Box>
    );

    const renderPickingTable = () => (
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <TableContainer component={Paper}>
                <Table sx={{ minWidth: 900 }} size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'primary.main' }}>
                            <TableCell sx={{ color: 'white' }}>WSN</TableCell>
                            <TableCell sx={{ color: 'white' }}>Warehouse</TableCell>
                            <TableCell sx={{ color: 'white' }}>Product</TableCell>
                            <TableCell sx={{ color: 'white' }}>Customer</TableCell>
                            <TableCell sx={{ color: 'white' }}>Picking Date</TableCell>
                            <TableCell sx={{ color: 'white' }}>Picked By</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {reportData.data.map((row: any, index: number) => (
                            <TableRow key={index} hover>
                                <TableCell>{row.wsn}</TableCell>
                                <TableCell>{row.warehouse_name}</TableCell>
                                <TableCell sx={{ maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.product_title}</TableCell>
                                <TableCell sx={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.customer_name}</TableCell>
                                <TableCell>{row.picking_date ? dayjs(row.picking_date).format('DD-MMM-YYYY') : ''}</TableCell>
                                <TableCell>{row.picked_by_name}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );

    const renderPerformanceTable = () => (
        <TableContainer component={Paper}>
            <Table size="small">
                <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell sx={{ color: 'white' }}>User Name</TableCell>
                        <TableCell sx={{ color: 'white' }}>Activity Type</TableCell>
                        <TableCell sx={{ color: 'white' }}>Total Operations</TableCell>
                        <TableCell sx={{ color: 'white' }}>First Operation</TableCell>
                        <TableCell sx={{ color: 'white' }}>Last Operation</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {reportData.data.map((row: any, index: number) => (
                        <TableRow key={index} hover>
                            <TableCell>{row.user_name}</TableCell>
                            <TableCell>
                                <Chip label={row.activity_type} size="small" color="primary" />
                            </TableCell>
                            <TableCell>{row.total_operations}</TableCell>
                            <TableCell>
                                {row.first_operation ? dayjs(row.first_operation).format('DD-MMM-YYYY HH:mm') : ''}
                            </TableCell>
                            <TableCell>
                                {row.last_operation ? dayjs(row.last_operation).format('DD-MMM-YYYY HH:mm') : ''}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );

    const renderSummaryDashboard = () => (
        <Box sx={{ display: 'flex', gap: 3, flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Card sx={{ minWidth: 250, bgcolor: '#e3f2fd' }}>
                    <CardContent>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="body2" color="text.secondary">Total Inbound</Typography>
                                <Typography variant="h3">{summaryData?.inbound || 0}</Typography>
                            </Box>
                            <Inventory sx={{ fontSize: 48, color: '#1976d2' }} />
                        </Stack>
                    </CardContent>
                </Card>

                <Card sx={{ minWidth: 250, bgcolor: '#fff3e0' }}>
                    <CardContent>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="body2" color="text.secondary">Total QC</Typography>
                                <Typography variant="h3">{summaryData?.qc || 0}</Typography>
                            </Box>
                            <CheckCircle sx={{ fontSize: 48, color: '#f57c00' }} />
                        </Stack>
                    </CardContent>
                </Card>

                <Card sx={{ minWidth: 250, bgcolor: '#fce4ec' }}>
                    <CardContent>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="body2" color="text.secondary">Total Picking</Typography>
                                <Typography variant="h3">{summaryData?.picking || 0}</Typography>
                            </Box>
                            <ShoppingCart sx={{ fontSize: 48, color: '#c2185b' }} />
                        </Stack>
                    </CardContent>
                </Card>

                <Card sx={{ minWidth: 250, bgcolor: '#e8f5e9' }}>
                    <CardContent>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="body2" color="text.secondary">Total Outbound</Typography>
                                <Typography variant="h3">{summaryData?.outbound || 0}</Typography>
                            </Box>
                            <LocalShipping sx={{ fontSize: 48, color: '#388e3c' }} />
                        </Stack>
                    </CardContent>
                </Card>
            </Box>

            <Card>
                <CardContent>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                            <Typography variant="h6" color="text.secondary">Grand Total Operations</Typography>
                            <Typography variant="h2" sx={{ mt: 1 }}>{summaryData?.total || 0}</Typography>
                        </Box>
                        <TrendingUp sx={{ fontSize: 64, color: '#1976d2' }} />
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );

    const renderTableContent = () => {
        if (loading) {
            return (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={{ xs: 200, sm: 400 }}>
                    <CircularProgress />
                </Box>
            );
        }

        if (error) {
            return <Alert severity="error">{error}</Alert>;
        }

        if (currentTab === 7) {
            return renderSummaryDashboard();
        }

        if (!reportData?.data || reportData.data.length === 0) {
            return (
                <Alert severity="info">
                    No data available for the selected criteria. Try adjusting your filters.
                </Alert>
            );
        }

        switch (currentTab) {
            case 0:
                return renderCurrentStockTable();
            case 1:
                return renderStockMovementTable();
            case 2:
                return renderInboundTable();
            case 3:
                return renderOutboundTable();
            case 4:
                return renderQCTable();
            case 5:
                return renderPickingTable();
            case 6:
                return renderPerformanceTable();
            default:
                return null;
        }
    };

    return (
        <AppLayout>
            {/* Sticky Header Section */}
            <Box sx={{
                position: 'sticky',
                top: 0,
                zIndex: 100,
                bgcolor: 'background.default',
                pb: 1,
                borderBottom: 1,
                borderColor: 'divider'
            }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="h5">📊 Reports & Analytics</Typography>
                    <Tooltip title="Refresh">
                        <IconButton aria-label="Refresh reports" onClick={handleGenerateReport} color="primary" size="small">
                            <Refresh />
                        </IconButton>
                    </Tooltip>
                </Stack>

                <Tabs
                    value={currentTab}
                    onChange={(e, newValue) => { setCurrentTab(newValue); setPage(0); }}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        borderBottom: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        '& .MuiTab-root': {
                            minHeight: 48,
                            textTransform: 'none'
                        }
                    }}
                >
                    {['Current Stock', 'Stock Movement', 'Inbound', 'Outbound', 'QC', 'Picking', 'User Performance', 'Summary Dashboard'].map((label, i) => (
                        <Tab key={i} label={label} id={`tab-${i}`} aria-controls={`tabpanel-${i}`} />
                    ))}
                </Tabs>

                {/* Compact Filters */}
                <Box sx={{ px: 2, py: 1.5, bgcolor: 'background.paper' }}>
                    {renderFilters()}
                </Box>
            </Box>

            {/* Scrollable Content */}
            <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Total Records: {currentTab === 7 ? summaryData?.total || 0 : reportData.total}
                </Typography>

                <Box role="tabpanel" id={`tabpanel-${currentTab}`} aria-labelledby={`tab-${currentTab}`}>
                    {renderTableContent()}

                    {/* Pagination for tabular reports */}
                    {currentTab !== 7 && (
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                            <TablePagination
                                component="div"
                                count={reportData.total || 0}
                                page={page}
                                onPageChange={(e, newPage) => setPage(newPage)}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                                rowsPerPageOptions={[10, 25, 50, 100]}
                            />
                        </Box>
                    )}
                </Box>
            </Box>
        </AppLayout>
    );
}
