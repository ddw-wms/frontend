'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    Box, Button, Paper, Typography, Chip, Alert, FormControl, InputLabel, Select, MenuItem,
    useTheme, useMediaQuery, CircularProgress, Tooltip, Stack, TextField, IconButton,
    InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions, Card, CardContent, Tabs, Tab
} from '@mui/material';
import {
    CloudUpload as UploadIcon, CloudDownload as DownloadIcon, Delete as DeleteIcon,
    Search as SearchIcon, Refresh as RefreshIcon,
    CheckCircle as CheckIcon, Warning as WarningIcon,
    Close as CloseIcon, Description as ExcelIcon
} from '@mui/icons-material';

import AppLayout from '@/components/AppLayout';
import { StandardPageHeader, BatchManagementTab } from '@/components';
import { rejectionsAPI } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { useResourcePermissions } from '@/hooks/usePermission';
import { usePermissions } from '@/app/context/PermissionContext';

import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ClientSideRowModelModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

interface Rejection {
    id: number;
    wsn: string;
    rejection_type: string;
    remarks: string | null;
    rejected_by_person: string | null;
    batch_id: string;
    source_batch_id: string | null;
    warehouse_id: number;
    rejection_date: string | null;
    uploaded_by: number;
    uploaded_by_name: string;
    created_at: string;
    credit_note_no: string | null;
    credit_note_date: string | null;
    credit_note_amount: number | null;
    product_title: string | null;
    brand: string | null;
    vrp: string | null;
    mrp: string | null;
    cms_vertical: string | null;
    fsn: string | null;
}

interface RejectionSummary {
    batch_id: string;
    rejection_date: string;
    item_count: number;
    total_vrp: number;
    cn_pending: number;
    cn_received: number;
    upload_date: string;
    uploaded_by_name: string;
}

export default function RejectionsPage() {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
    const { activeWarehouse } = useWarehouse();
    const { canView, canCreate, canDelete, canExport } = useResourcePermissions('rejections');
    const { canAccess, isAdmin } = usePermissions();
    const canUpdateCN = isAdmin || canAccess('feature:rejections:credit');
    const gridRef = useRef<AgGridReact>(null);

    // State
    const [rejections, setRejections] = useState<Rejection[]>([]);
    const [summary, setSummary] = useState<RejectionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [activeTab, setActiveTab] = useState(0);

    // Filters
    const [search, setSearch] = useState('');
    const [rejectionType, setRejectionType] = useState<string>('all');
    const [cnStatus, setCnStatus] = useState<string>('all');
    const [personFilter, setPersonFilter] = useState<string>('');
    const [batchFilter, setBatchFilter] = useState<string>('');

    // Filter options
    const [persons, setPersons] = useState<string[]>([]);
    const [batches, setBatches] = useState<any[]>([]);

    // Dialogs
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [cnDialogOpen, setCnDialogOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [rejectionDate, setRejectionDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedBatchForCN, setSelectedBatchForCN] = useState<string>('');
    const [cnNumber, setCnNumber] = useState('');
    const [cnDate, setCnDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [cnAmount, setCnAmount] = useState<string>('');

    // Batch Management state
    const [batchList, setBatchList] = useState<any[]>([]);
    const [batchLoading, setBatchLoading] = useState(false);

    // Summary stats
    const [stats, setStats] = useState({ total: 0, cn_pending: 0, cn_received: 0 });

    // Fetch rejections
    const fetchRejections = useCallback(async () => {
        if (!canView) return;

        setLoading(true);
        try {
            const response = await rejectionsAPI.getAll({
                page,
                limit: 100,
                search: search || undefined,
                rejection_type: rejectionType !== 'all' ? rejectionType : undefined,
                cn_status: cnStatus !== 'all' ? cnStatus as any : undefined,
                rejected_by_person: personFilter || undefined,
                batch_id: batchFilter || undefined,
                warehouse_id: activeWarehouse?.id,
            });

            setRejections(response.data.data);
            setTotalCount(response.data.total);
            setStats(response.data.summary);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to load rejections');
        } finally {
            setLoading(false);
        }
    }, [canView, page, search, rejectionType, cnStatus, personFilter, batchFilter, activeWarehouse?.id]);

    // Fetch summary
    const fetchSummary = useCallback(async () => {
        if (!canView) return;

        try {
            const response = await rejectionsAPI.getSummary(activeWarehouse?.id);
            setSummary(response.data.data);
        } catch (error) {
            console.error('Failed to load summary:', error);
        }
    }, [canView, activeWarehouse?.id]);

    // Fetch filter options
    const fetchFilterOptions = useCallback(async () => {
        if (!canView) return;

        try {
            const [personsRes, batchesRes] = await Promise.all([
                rejectionsAPI.getPersons(activeWarehouse?.id),
                rejectionsAPI.getBatches(activeWarehouse?.id),
            ]);
            setPersons(personsRes.data.persons || []);
            setBatches(batchesRes.data.batches || []);
        } catch (error) {
            console.error('Failed to load filter options:', error);
        }
    }, [canView, activeWarehouse?.id]);

    // Fetch batch list for batch management tab
    const fetchBatchList = useCallback(async () => {
        if (!canView) return;
        setBatchLoading(true);
        try {
            const response = await rejectionsAPI.getBatches(activeWarehouse?.id);
            const batchData = (response.data.batches || []).map((b: any) => ({
                batch_id: b.batch_id,
                count: parseInt(b.count) || 0,
                created_at: b.created_at,
                last_updated: b.last_updated || b.created_at,
            }));
            setBatchList(batchData);
        } catch (error) {
            console.error('Failed to load batch list:', error);
        } finally {
            setBatchLoading(false);
        }
    }, [canView, activeWarehouse?.id]);

    // Load batch list when batch management tab is active
    useEffect(() => {
        if (activeTab === 2) {
            fetchBatchList();
        }
    }, [activeTab, fetchBatchList]);

    useEffect(() => {
        fetchRejections();
        fetchSummary();
        fetchFilterOptions();
    }, [fetchRejections, fetchSummary, fetchFilterOptions]);

    // Handle file upload
    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error('Please select a file');
            return;
        }

        if (!activeWarehouse?.id) {
            toast.error('Please select a warehouse');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('warehouse_id', String(activeWarehouse.id));
            formData.append('rejection_date', rejectionDate);

            const response = await rejectionsAPI.uploadRejections(formData);

            toast.success(`Uploaded ${response.data.inserted} rejections`);

            if (response.data.skipped > 0) {
                toast(`${response.data.skipped} items skipped`, { icon: '⚠️' });
            }

            setUploadDialogOpen(false);
            setSelectedFile(null);
            fetchRejections();
            fetchSummary();
            fetchFilterOptions();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    // Handle credit note update
    const handleUpdateCN = async () => {
        if (!cnNumber.trim()) {
            toast.error('Please enter credit note number');
            return;
        }

        if (!selectedBatchForCN) {
            toast.error('Please select a batch');
            return;
        }

        try {
            await rejectionsAPI.updateCreditNote({
                batch_id: selectedBatchForCN,
                credit_note_no: cnNumber,
                credit_note_date: cnDate,
                credit_note_amount: cnAmount ? parseFloat(cnAmount) : undefined,
            });

            toast.success('Credit note updated');
            setCnDialogOpen(false);
            setCnNumber('');
            setCnAmount('');
            setSelectedBatchForCN('');
            fetchRejections();
            fetchSummary();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to update credit note');
        }
    };

    // Handle delete single rejection
    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this rejection?')) return;

        try {
            await rejectionsAPI.delete(id);
            toast.success('Rejection deleted');
            fetchRejections();
            fetchSummary();
            fetchBatchList();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Delete failed');
        }
    };

    // Handle delete batch
    const handleDeleteBatch = async (batchId: string) => {
        if (!confirm(`Are you sure you want to delete batch "${batchId}" and all its rejections?`)) return;

        try {
            await rejectionsAPI.deleteBatch(batchId);
            toast.success('Batch deleted successfully');
            fetchRejections();
            fetchSummary();
            fetchBatchList();
            fetchFilterOptions();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete batch');
        }
    };

    // Download template handler
    const handleDownloadTemplate = async () => {
        try {
            const res = await rejectionsAPI.downloadTemplate();
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'rejection_template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Template downloaded');
        } catch (error: any) {
            toast.error('Failed to download template');
        }
    };

    // Export handler
    const handleExport = async () => {
        try {
            const res = await rejectionsAPI.exportRejections({
                warehouse_id: activeWarehouse?.id,
                cn_status: cnStatus !== 'all' ? cnStatus : undefined
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `rejections_export_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Export downloaded');
        } catch (error: any) {
            toast.error('Failed to export');
        }
    };

    // AG Grid column definitions
    const columnDefs = useMemo(() => [
        { field: 'wsn', headerName: 'WSN', width: 140, pinned: 'left' as const },
        { field: 'product_title', headerName: 'Product', flex: 1, minWidth: 200, tooltipField: 'product_title' },
        { field: 'brand', headerName: 'Brand', width: 110 },
        { field: 'cms_vertical', headerName: 'Category', width: 120 },
        {
            field: 'vrp',
            headerName: 'Order ID',
            width: 100,
        },
        {
            field: 'fsp',
            headerName: 'FSP',
            width: 90,
            valueFormatter: (params: any) => params.value ? `₹${Number(params.value).toLocaleString()}` : '-'
        },
        {
            field: 'mrp',
            headerName: 'MRP',
            width: 90,
            valueFormatter: (params: any) => params.value ? `₹${Number(params.value).toLocaleString()}` : '-'
        },
        {
            field: 'rejection_type',
            headerName: 'Type',
            width: 100,
            cellRenderer: (params: any) => {
                const type = params.value;
                const colorMap: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
                    damaged: 'error',
                    fraud: 'warning',
                    short: 'info',
                    other: 'default'
                };
                return (
                    <Chip
                        label={type?.toUpperCase() || 'N/A'}
                        size="small"
                        color={colorMap[type] || 'default'}
                        sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
                    />
                );
            }
        },
        { field: 'rejected_by_person', headerName: 'Rejected By', width: 120 },
        { field: 'remarks', headerName: 'Remarks', width: 150, tooltipField: 'remarks' },
        {
            field: 'rejection_date',
            headerName: 'Date',
            width: 100,
            valueFormatter: (params: any) => {
                if (!params.value) return '-';
                return new Date(params.value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
            }
        },
        {
            field: 'credit_note_no',
            headerName: 'CN Status',
            width: 130,
            cellRenderer: (params: any) => {
                if (params.value) {
                    return (
                        <Chip
                            label={params.value}
                            size="small"
                            sx={{
                                height: 22, fontSize: '0.7rem', fontWeight: 600,
                                bgcolor: '#22c55e', color: '#fff', border: '1px solid #16a34a'
                            }}
                        />
                    );
                }
                return (
                    <Chip
                        label="Pending"
                        size="small"
                        sx={{
                            height: 22, fontSize: '0.7rem', fontWeight: 600,
                            bgcolor: '#f59e0b', color: '#fff', border: '1px solid #d97706'
                        }}
                    />
                );
            }
        },
        { field: 'uploaded_by_name', headerName: 'Uploaded By', width: 120 },
        {
            field: 'actions',
            headerName: '',
            width: 60,
            sortable: false,
            filter: false,
            cellRenderer: (params: any) => {
                if (!canDelete) return null;
                return (
                    <Tooltip title="Delete">
                        <IconButton
                            size="small"
                            onClick={() => handleDelete(params.data.id)}
                            sx={{
                                width: 28, height: 28, borderRadius: '6px',
                                bgcolor: 'rgba(239, 68, 68, 0.1)',
                                '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.2)' }
                            }}
                        >
                            <DeleteIcon sx={{ fontSize: 16, color: '#dc2626' }} />
                        </IconButton>
                    </Tooltip>
                );
            }
        }
    ], [canDelete]);

    // Summary table columns
    const summaryColumns = useMemo<any[]>(() => [
        { field: 'batch_id', headerName: 'Batch ID', width: 160 },
        { field: 'item_count', headerName: 'Items', width: 70, type: 'number' as const },
        {
            field: 'total_fsp',
            headerName: 'Total FSP',
            width: 110,
            valueFormatter: (params: any) => `₹${Number(params.value || 0).toLocaleString()}`
        },
        {
            field: 'total_mrp',
            headerName: 'Total MRP',
            width: 110,
            valueFormatter: (params: any) => `₹${Number(params.value || 0).toLocaleString()}`
        },
        {
            field: 'rejection_date',
            headerName: 'Date',
            width: 100,
            valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'
        },
        {
            field: 'cn_pending',
            headerName: 'Pending',
            width: 85,
            cellRenderer: (params: any) => (
                <Chip
                    label={params.value}
                    size="small"
                    sx={{
                        height: 22, fontWeight: 600,
                        bgcolor: params.value > 0 ? '#f59e0b' : '#22c55e',
                        color: '#fff'
                    }}
                />
            )
        },
        {
            field: 'cn_received',
            headerName: 'Received',
            width: 85,
            cellRenderer: (params: any) => (
                <Chip label={params.value} size="small" sx={{ height: 22, fontWeight: 600, bgcolor: '#22c55e', color: '#fff' }} />
            )
        },
        { field: 'uploaded_by_name', headerName: 'Uploaded By', width: 110 },
        {
            field: 'actions',
            headerName: 'Action',
            width: 100,
            sortable: false,
            filter: false,
            cellRenderer: (params: any) => {
                if (!canUpdateCN || params.data.cn_pending === 0) return null;
                return (
                    <Button
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', py: 0.25, px: 1 }}
                        onClick={() => {
                            setSelectedBatchForCN(params.data.batch_id);
                            setCnDialogOpen(true);
                        }}
                    >
                        Update CN
                    </Button>
                );
            }
        }
    ], [canUpdateCN]);

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
    }), []);

    if (!canView) {
        return (
            <AppLayout>
                <Box sx={{ p: 3 }}>
                    <Alert severity="error">You don't have permission to view rejections</Alert>
                </Box>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Toaster position="top-right" />
            <Box sx={{
                p: { xs: 0.75, md: 1 },
                background: isDarkMode
                    ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                    : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <StandardPageHeader
                    title="Rejections"
                    subtitle="Manage rejected products and credit notes"
                    icon="🚫"
                />

                <Box sx={{ p: { xs: 1, md: 2 }, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Stats Card */}
                    <Card sx={{ mb: 2 }}>
                        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={{ xs: 1, sm: 3 }}
                                alignItems={{ xs: 'flex-start', sm: 'center' }}
                                justifyContent="space-between"
                                flexWrap="wrap"
                            >
                                <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap" useFlexGap>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" color="text.secondary">Total:</Typography>
                                        <Chip
                                            label={stats.total}
                                            size="small"
                                            sx={{ bgcolor: '#ef4444', color: '#fff', fontWeight: 700, minWidth: 50 }}
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" color="text.secondary">CN Pending:</Typography>
                                        <Chip
                                            label={stats.cn_pending}
                                            size="small"
                                            sx={{ bgcolor: '#f59e0b', color: '#fff', fontWeight: 700, minWidth: 50 }}
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" color="text.secondary">CN Received:</Typography>
                                        <Chip
                                            label={stats.cn_received}
                                            size="small"
                                            sx={{ bgcolor: '#22c55e', color: '#fff', fontWeight: 700, minWidth: 50 }}
                                        />
                                    </Box>
                                </Stack>

                                {/* Action Buttons */}
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    <Tooltip title="Refresh">
                                        <IconButton
                                            size="small"
                                            onClick={() => { fetchRejections(); fetchSummary(); }}
                                            disabled={loading}
                                        >
                                            <RefreshIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<DownloadIcon />}
                                        onClick={handleDownloadTemplate}
                                    >
                                        {isSmall ? '' : 'Template'}
                                    </Button>
                                    {canExport && (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<ExcelIcon />}
                                            onClick={handleExport}
                                        >
                                            {isSmall ? '' : 'Export'}
                                        </Button>
                                    )}
                                    {canCreate && (
                                        <Button
                                            size="small"
                                            variant="contained"
                                            startIcon={<UploadIcon />}
                                            onClick={() => setUploadDialogOpen(true)}
                                        >
                                            {isSmall ? '' : 'Upload'}
                                        </Button>
                                    )}
                                </Stack>
                            </Stack>
                        </CardContent>
                    </Card>

                    {/* Tabs */}
                    <Tabs
                        value={activeTab}
                        onChange={(_, v) => setActiveTab(v)}
                        sx={{
                            minHeight: 36,
                            mb: 1,
                            '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.85rem' }
                        }}
                    >
                        <Tab label={`Rejections (${totalCount})`} />
                        <Tab label={`CN Summary (${summary.length})`} />
                        <Tab label={`Batch Management (${batchList.length})`} />
                    </Tabs>

                    {/* Tab Panels */}
                    {activeTab === 0 && (
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                            {/* Filters */}
                            <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                                <TextField
                                    size="small"
                                    placeholder="Search WSN, Product..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ minWidth: { xs: '100%', sm: 220 }, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
                                />
                                <FormControl size="small" sx={{ minWidth: 110 }}>
                                    <InputLabel>Type</InputLabel>
                                    <Select value={rejectionType} label="Type" onChange={(e) => setRejectionType(e.target.value)}>
                                        <MenuItem value="all">All</MenuItem>
                                        <MenuItem value="damaged">Damaged</MenuItem>
                                        <MenuItem value="fraud">Fraud</MenuItem>
                                        <MenuItem value="short">Short</MenuItem>
                                        <MenuItem value="other">Other</MenuItem>
                                    </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ minWidth: 110 }}>
                                    <InputLabel>CN Status</InputLabel>
                                    <Select value={cnStatus} label="CN Status" onChange={(e) => setCnStatus(e.target.value)}>
                                        <MenuItem value="all">All</MenuItem>
                                        <MenuItem value="pending">Pending</MenuItem>
                                        <MenuItem value="received">Received</MenuItem>
                                    </Select>
                                </FormControl>
                                {!isSmall && persons.length > 0 && (
                                    <FormControl size="small" sx={{ minWidth: 130 }}>
                                        <InputLabel>Rejected By</InputLabel>
                                        <Select value={personFilter} label="Rejected By" onChange={(e) => setPersonFilter(e.target.value)}>
                                            <MenuItem value="">All</MenuItem>
                                            {persons.map((p) => (
                                                <MenuItem key={p} value={p}>{p}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                )}
                            </Stack>

                            {/* Grid */}
                            <Paper elevation={2} sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                                <div
                                    className={isDarkMode ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'}
                                    style={{ flex: 1, width: '100%', minHeight: 0 }}
                                >
                                    <AgGridReact
                                        ref={gridRef}
                                        rowData={rejections}
                                        columnDefs={columnDefs}
                                        defaultColDef={defaultColDef}
                                        animateRows
                                        rowSelection="multiple"
                                        loading={loading}
                                        pagination
                                        paginationPageSize={50}
                                        paginationPageSizeSelector={[25, 50, 100, 200]}
                                        domLayout="normal"
                                    />
                                </div>
                            </Paper>
                        </Box>
                    )}

                    {activeTab === 1 && (
                        <Paper elevation={2} sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                            <div
                                className={isDarkMode ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'}
                                style={{ flex: 1, width: '100%', minHeight: 0 }}
                            >
                                <AgGridReact
                                    rowData={summary}
                                    columnDefs={summaryColumns}
                                    defaultColDef={defaultColDef}
                                    animateRows
                                    domLayout="normal"
                                />
                            </div>
                        </Paper>
                    )}

                    {activeTab === 2 && (
                        <Paper elevation={2} sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                            <BatchManagementTab
                                batches={batchList}
                                loading={batchLoading}
                                onRefresh={fetchBatchList}
                                onDelete={handleDeleteBatch}
                                canDelete={canDelete}
                                title="Rejection Batches"
                                emptyMessage="No rejection batches found"
                                emptySubMessage="Batches will appear here after uploading rejections"
                            />
                        </Paper>
                    )}
                </Box>
            </Box>

            {/* Upload Dialog */}
            <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ pb: 1 }}>
                    Upload Rejection Excel
                    <IconButton onClick={() => setUploadDialogOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Alert severity="info" sx={{ py: 0.5 }}>
                            Required columns: <strong>WSN</strong>, <strong>Rejection Type</strong>, <strong>Rejected By</strong>, Remarks (optional)
                        </Alert>

                        <TextField
                            type="date"
                            label="Rejection Date"
                            value={rejectionDate}
                            onChange={(e) => setRejectionDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                            size="small"
                        />

                        <Box
                            sx={{
                                border: '2px dashed',
                                borderColor: selectedFile ? 'success.main' : 'divider',
                                borderRadius: 2,
                                p: 3,
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' }
                            }}
                            onClick={() => document.getElementById('rejection-file-input')?.click()}
                        >
                            <input
                                id="rejection-file-input"
                                type="file"
                                accept=".xlsx,.xls"
                                hidden
                                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            />
                            {selectedFile ? (
                                <>
                                    <ExcelIcon sx={{ fontSize: 48, color: 'success.main' }} />
                                    <Typography fontWeight={600}>{selectedFile.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {(selectedFile.size / 1024).toFixed(1)} KB
                                    </Typography>
                                </>
                            ) : (
                                <>
                                    <UploadIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                                    <Typography>Click to select Excel file</Typography>
                                    <Typography variant="caption" color="text.secondary">.xlsx or .xls</Typography>
                                </>
                            )}
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleUpload}
                        disabled={!selectedFile || uploading}
                        startIcon={uploading ? <CircularProgress size={16} /> : <UploadIcon />}
                    >
                        {uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Credit Note Dialog */}
            <Dialog open={cnDialogOpen} onClose={() => setCnDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ pb: 1 }}>
                    Update Credit Note
                    <IconButton onClick={() => setCnDialogOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label="Batch ID" value={selectedBatchForCN} disabled fullWidth size="small" />
                        <TextField
                            label="Credit Note Number"
                            value={cnNumber}
                            onChange={(e) => setCnNumber(e.target.value)}
                            fullWidth
                            required
                            size="small"
                        />
                        <TextField
                            type="date"
                            label="Credit Note Date"
                            value={cnDate}
                            onChange={(e) => setCnDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                            size="small"
                        />
                        <TextField
                            label="Credit Note Amount (Optional)"
                            value={cnAmount}
                            onChange={(e) => setCnAmount(e.target.value)}
                            type="number"
                            fullWidth
                            size="small"
                            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setCnDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" color="success" onClick={handleUpdateCN} startIcon={<CheckIcon />}>
                        Update
                    </Button>
                </DialogActions>
            </Dialog>
        </AppLayout>
    );
}
