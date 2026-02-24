'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    Box, Button, Paper, Typography, Chip, Alert, FormControl, InputLabel, Select, MenuItem,
    useTheme, useMediaQuery, CircularProgress, Tooltip, Stack, TextField, IconButton,
    InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions, Card, CardContent, Tabs, Tab,
    Pagination, LinearProgress, AppBar, Toolbar
} from '@mui/material';
import {
    CloudUpload as UploadIcon, CloudDownload as DownloadIcon, Delete as DeleteIcon,
    Search as SearchIcon, Refresh as RefreshIcon,
    CheckCircle as CheckIcon,
    Close as CloseIcon, Description as ExcelIcon,
    Tune as TuneIcon, FilterList as FilterListIcon,
    PersonAdd as PersonAddIcon,
    RestoreFromTrash as RestoreIcon,
    DeleteForever as DeleteForeverIcon
} from '@mui/icons-material';

import AppLayout from '@/components/AppLayout';

// Format date as DD-MMM-YYYY (e.g. 18-Feb-2026)
const formatDateDMY = (dateVal: any): string => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
};

// Format date+time as DD-MMM-YYYY HH:MM
const formatDateTimeDMY = (dateVal: any): string => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${months[d.getMonth()]}-${d.getFullYear()} ${hr}:${min}`;
};
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
    fsp: string | null;
    mrp: string | null;
    yield_value: string | null;
    cms_vertical: string | null;
    fsn: string | null;
}

interface RejectionSummary {
    batch_id: string;
    rejection_date: string;
    item_count: number;
    total_fsp: number;
    total_mrp: number;
    total_yield: number;
    cn_pending: number;
    cn_received: number;
    upload_date: string;
    uploaded_by_name: string;
}

// Grid state persistence key
const GRID_STATE_KEY = 'rejections_grid_state';
const SUMMARY_GRID_STATE_KEY = 'rejections_summary_grid_state';

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
    const summaryGridRef = useRef<AgGridReact>(null);

    // State
    const [rejections, setRejections] = useState<Rejection[]>([]);
    const [summary, setSummary] = useState<RejectionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(100);
    const [activeTab, setActiveTab] = useState(0);
    const [uploadError, setUploadError] = useState<string>('');
    const [fileValidationError, setFileValidationError] = useState<string>('');

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
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [rejectionDate, setRejectionDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedBatchForCN, setSelectedBatchForCN] = useState<string>('');
    const [cnNumber, setCnNumber] = useState('');
    const [cnDate, setCnDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [cnAmount, setCnAmount] = useState<string>('');

    // Batch Management state
    const [batchList, setBatchList] = useState<any[]>([]);
    const [batchLoading, setBatchLoading] = useState(false);

    // Deleted batches (soft-deleted, recoverable)
    const [deletedBatches, setDeletedBatches] = useState<any[]>([]);
    const [deletedBatchesLoading, setDeletedBatchesLoading] = useState(false);

    // Upload History state
    const [uploadHistory, setUploadHistory] = useState<any[]>([]);
    const [uploadHistoryTotal, setUploadHistoryTotal] = useState(0);
    const [uploadHistoryPage, setUploadHistoryPage] = useState(1);
    const [uploadHistoryLoading, setUploadHistoryLoading] = useState(false);

    // Upload log detail dialog (skipped/error details)
    const [logDetailDialog, setLogDetailDialog] = useState<{ open: boolean; log: any; tab: 'skipped' | 'errors' }>({ open: false, log: null, tab: 'skipped' });

    // Managed persons state (for upload dialog dropdown)
    const [managedPersons, setManagedPersons] = useState<{ id: number; name: string }[]>([]);
    const [selectedPerson, setSelectedPerson] = useState<string>('');
    const [addingNewPerson, setAddingNewPerson] = useState(false);
    const [newPersonName, setNewPersonName] = useState('');

    // Summary stats
    const [stats, setStats] = useState({ total: 0, cn_pending: 0, cn_received: 0, total_yield: 0 });

    // Total pages
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch rejections
    const fetchRejections = useCallback(async () => {
        if (!canView) return;

        setLoading(true);
        try {
            const response = await rejectionsAPI.getAll({
                page,
                limit,
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
    }, [canView, page, limit, search, rejectionType, cnStatus, personFilter, batchFilter, activeWarehouse?.id]);

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

    // Fetch managed persons for upload dialog dropdown
    const fetchManagedPersons = useCallback(async () => {
        if (!activeWarehouse?.id) return;
        try {
            const res = await rejectionsAPI.getManagedPersons(activeWarehouse.id);
            setManagedPersons((res.data.persons || []).map((p: any) => ({ id: p.id, name: p.name })));
        } catch (error) {
            console.error('Failed to load managed persons:', error);
        }
    }, [activeWarehouse?.id]);

    // Handle adding a new person
    const handleAddNewPerson = async () => {
        if (!newPersonName.trim() || !activeWarehouse?.id) return;
        try {
            const res = await rejectionsAPI.addManagedPerson(newPersonName.trim(), activeWarehouse.id);
            toast.success(res.data.message || 'Person added');
            setNewPersonName('');
            setAddingNewPerson(false);
            await fetchManagedPersons();
            // Auto-select the newly added person
            if (res.data.person?.name) {
                setSelectedPerson(res.data.person.name);
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to add person');
        }
    };

    // Load batch list when batch management tab is active
    useEffect(() => {
        if (activeTab === 2) {
            fetchBatchList();
            fetchDeletedBatches();
        }
    }, [activeTab, fetchBatchList]);

    // Fetch deleted batches (soft-deleted, can be restored)
    const fetchDeletedBatches = useCallback(async () => {
        if (!canView) return;
        setDeletedBatchesLoading(true);
        try {
            const res = await rejectionsAPI.getDeletedBatches(activeWarehouse?.id);
            setDeletedBatches(res.data.batches || []);
        } catch (error) {
            console.log('⚠️ Failed to load deleted batches:', error);
        } finally {
            setDeletedBatchesLoading(false);
        }
    }, [canView, activeWarehouse?.id]);

    // Handle restore batch
    const handleRestoreBatch = async (batchId: string) => {
        if (!confirm(`Restore batch "${batchId}"? All its rejections will be recovered.`)) return;
        try {
            const res = await rejectionsAPI.restoreBatch(batchId);
            toast.success(res.data.message || 'Batch restored');
            fetchBatchList();
            fetchDeletedBatches();
            fetchRejections();
            fetchSummary();
            fetchFilterOptions();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to restore batch');
        }
    };

    // Handle permanent delete
    const handlePermanentDeleteBatch = async (batchId: string) => {
        if (!confirm(`⚠️ PERMANENTLY delete batch "${batchId}"?\n\nThis cannot be undone! Data will be lost forever.`)) return;
        try {
            const res = await rejectionsAPI.permanentDeleteBatch(batchId);
            toast.success(res.data.message || 'Batch permanently deleted');
            fetchDeletedBatches();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to permanently delete batch');
        }
    };

    // Fetch upload history
    const fetchUploadHistory = useCallback(async () => {
        if (!canView) return;
        setUploadHistoryLoading(true);
        try {
            const response = await rejectionsAPI.getUploadHistory({
                page: uploadHistoryPage,
                limit: 20,
                warehouse_id: activeWarehouse?.id,
            });
            setUploadHistory(response.data.data || []);
            setUploadHistoryTotal(response.data.total || 0);
        } catch (error) {
            console.log('⚠️ Upload history load error:', error);
        } finally {
            setUploadHistoryLoading(false);
        }
    }, [canView, uploadHistoryPage, activeWarehouse?.id]);

    // Load upload history when tab is active
    useEffect(() => {
        if (activeTab === 3) {
            fetchUploadHistory();
        }
    }, [activeTab, fetchUploadHistory]);

    // Handle delete upload log
    const handleDeleteUploadLog = async (id: number, filename: string) => {
        if (!confirm(`Delete upload log for "${filename}"?\n\nThis only removes the log entry, not the uploaded data.`)) return;
        try {
            await rejectionsAPI.deleteUploadLog(id);
            toast.success('Upload log deleted');
            fetchUploadHistory();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to delete upload log');
        }
    };

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

        if (!selectedPerson) {
            toast.error('Please select Rejected By person');
            return;
        }

        // Reset errors
        setUploadError('');
        setFileValidationError('');

        // Client-side validation
        const validExtensions = ['.xlsx', '.xls'];
        const fileName = selectedFile.name.toLowerCase();
        const fileExt = fileName.substring(fileName.lastIndexOf('.'));

        if (!validExtensions.includes(fileExt)) {
            setFileValidationError(`Invalid file type "${fileExt}". Only Excel (.xlsx, .xls) files are allowed.`);
            return;
        }

        // Check file size (10MB limit)
        const maxSize = 10 * 1024 * 1024;
        if (selectedFile.size > maxSize) {
            setFileValidationError('File size exceeds 10MB limit. Please upload a smaller file.');
            return;
        }

        // Check if file is empty
        if (selectedFile.size === 0) {
            setFileValidationError('The selected file is empty. Please choose a valid file.');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('warehouse_id', String(activeWarehouse.id));
            formData.append('rejection_date', rejectionDate);
            formData.append('rejected_by_person', selectedPerson);

            const response = await rejectionsAPI.uploadRejections(formData);

            toast.success(`Uploaded ${response.data.inserted} rejections`);

            if (response.data.skipped > 0) {
                toast(`${response.data.skipped} items skipped`, { icon: '⚠️' });
            }

            setUploadDialogOpen(false);
            setSelectedFile(null);
            setSelectedPerson('');
            setUploadError('');
            setFileValidationError('');
            fetchRejections();
            fetchSummary();
            fetchFilterOptions();
            fetchBatchList();
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || 'Upload failed';
            setUploadError(errorMsg);
            toast.error(errorMsg);
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

    // Handle delete batch (soft delete — can be restored)
    const handleDeleteBatch = async (batchId: string) => {
        if (!confirm(`Delete batch "${batchId}"?\n\nThis is a soft delete — you can restore it from the "Deleted Batches" section.`)) return;

        try {
            await rejectionsAPI.deleteBatch(batchId);
            toast.success('Batch moved to trash (can be restored)');
            fetchRejections();
            fetchSummary();
            fetchBatchList();
            fetchDeletedBatches();
            fetchFilterOptions();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete batch');
        }
    };

    // Handle rename batch
    const handleRenameBatch = async (oldBatchId: string, newBatchId: string) => {
        try {
            await rejectionsAPI.renameBatch(oldBatchId, newBatchId);
            toast.success('Batch renamed successfully');
            fetchRejections();
            fetchSummary();
            fetchBatchList();
            fetchFilterOptions();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to rename batch');
            throw error;
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

    // Save grid state
    const onGridReady = useCallback(() => {
        const savedState = localStorage.getItem(GRID_STATE_KEY);
        if (savedState && gridRef.current?.api) {
            try {
                const state = JSON.parse(savedState);
                gridRef.current.api.applyColumnState({ state: state.columnState, applyOrder: true });
            } catch (e) {
                console.log('Failed to restore grid state');
            }
        }
    }, []);

    const onColumnStateChanged = useCallback(() => {
        if (gridRef.current?.api) {
            const columnState = gridRef.current.api.getColumnState();
            localStorage.setItem(GRID_STATE_KEY, JSON.stringify({ columnState }));
        }
    }, []);

    const onSummaryColumnStateChanged = useCallback(() => {
        if (summaryGridRef.current?.api) {
            const columnState = summaryGridRef.current.api.getColumnState();
            localStorage.setItem(SUMMARY_GRID_STATE_KEY, JSON.stringify({ columnState }));
        }
    }, []);

    const onSummaryGridReady = useCallback(() => {
        if (summaryGridRef.current?.api) {
            const savedState = localStorage.getItem(SUMMARY_GRID_STATE_KEY);
            if (savedState) {
                try {
                    const { columnState } = JSON.parse(savedState);
                    if (columnState) {
                        summaryGridRef.current.api.applyColumnState({ state: columnState, applyOrder: true });
                    }
                } catch (e) {
                    console.error('Failed to restore summary grid state:', e);
                }
            }
        }
    }, []);

    // AG Grid column definitions with proper dark mode styling
    const columnDefs = useMemo(() => [
        { field: 'wsn', headerName: 'WSN', width: 130, pinned: isSmall ? undefined : 'left' as const },
        { field: 'product_title', headerName: 'Product', flex: 1, minWidth: 180, tooltipField: 'product_title' },
        { field: 'brand', headerName: 'Brand', width: 100 },
        { field: 'cms_vertical', headerName: 'Category', width: 110 },
        { field: 'vrp', headerName: 'Order ID', width: 90 },
        {
            field: 'fsp',
            headerName: 'FSP',
            width: 85,
            valueFormatter: (params: any) => params.value ? `₹${Number(params.value).toLocaleString()}` : '-'
        },
        {
            field: 'mrp',
            headerName: 'MRP',
            width: 85,
            valueFormatter: (params: any) => params.value ? `₹${Number(params.value).toLocaleString()}` : '-'
        },
        {
            field: 'yield_value',
            headerName: 'Yield',
            width: 85,
            valueFormatter: (params: any) => params.value ? `₹${Number(params.value).toLocaleString()}` : '-'
        },
        {
            field: 'rejection_type',
            headerName: 'Type',
            width: 95,
            cellRenderer: (params: any) => {
                const type = params.value;
                const colors: Record<string, { bg: string; color: string }> = {
                    damaged: { bg: '#dc2626', color: '#fff' },
                    fraud: { bg: '#f59e0b', color: '#fff' },
                    short: { bg: '#3b82f6', color: '#fff' },
                    other: { bg: '#6b7280', color: '#fff' }
                };
                const style = colors[type] || colors.other;
                return (
                    <Chip
                        label={type?.toUpperCase() || 'N/A'}
                        size="small"
                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600, bgcolor: style.bg, color: style.color }}
                    />
                );
            }
        },
        { field: 'rejected_by_person', headerName: 'Rejected By', width: 110 },
        { field: 'remarks', headerName: 'Remarks', width: 130, tooltipField: 'remarks' },
        {
            field: 'rejection_date',
            headerName: 'Date',
            width: 95,
            valueFormatter: (params: any) => formatDateDMY(params.value)
        },
        {
            field: 'credit_note_no',
            headerName: 'CN Status',
            width: 110,
            cellRenderer: (params: any) => {
                if (params.value) {
                    return (
                        <Chip
                            label={params.value}
                            size="small"
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#22c55e', color: '#fff' }}
                        />
                    );
                }
                return (
                    <Chip
                        label="Pending"
                        size="small"
                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#f59e0b', color: '#fff' }}
                    />
                );
            }
        },
        { field: 'uploaded_by_name', headerName: 'Uploaded By', width: 100 },
        {
            field: 'actions',
            headerName: '',
            width: 50,
            sortable: false,
            filter: false,
            cellRenderer: (params: any) => {
                if (!canDelete) return null;
                return (
                    <Tooltip title="Delete">
                        <IconButton
                            size="small"
                            onClick={() => handleDelete(params.data.id)}
                            sx={{ width: 24, height: 24, color: '#ef4444' }}
                        >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                );
            }
        }
    ], [canDelete, isSmall]);

    // Summary table columns
    const summaryColumns = useMemo<any[]>(() => [
        { field: 'batch_id', headerName: 'Batch ID', width: 150 },
        { field: 'item_count', headerName: 'Items', width: 70 },
        {
            field: 'total_fsp',
            headerName: 'Total FSP',
            width: 100,
            valueFormatter: (params: any) => `₹${Number(params.value || 0).toLocaleString()}`
        },
        {
            field: 'total_mrp',
            headerName: 'Total MRP',
            width: 100,
            valueFormatter: (params: any) => `₹${Number(params.value || 0).toLocaleString()}`
        },
        {
            field: 'total_yield',
            headerName: 'Total Yield (CN)',
            width: 120,
            valueFormatter: (params: any) => `₹${Number(params.value || 0).toLocaleString()}`,
            cellStyle: {
                fontWeight: 600,
                color: '#22c55e'
            }
        },
        {
            field: 'rejection_date',
            headerName: 'Date',
            width: 90,
            valueFormatter: (params: any) => formatDateDMY(params.value)
        },
        {
            field: 'cn_pending',
            headerName: 'Pending',
            width: 80,
            cellRenderer: (params: any) => (
                <Chip
                    label={params.value}
                    size="small"
                    sx={{ height: 20, fontWeight: 600, bgcolor: params.value > 0 ? '#f59e0b' : '#22c55e', color: '#fff' }}
                />
            )
        },
        {
            field: 'cn_received',
            headerName: 'Received',
            width: 80,
            cellRenderer: (params: any) => (
                <Chip label={params.value} size="small" sx={{ height: 20, fontWeight: 600, bgcolor: '#22c55e', color: '#fff' }} />
            )
        },
        { field: 'uploaded_by_name', headerName: 'Uploaded By', width: 100 },
        {
            field: 'actions',
            headerName: 'Action',
            width: 100,
            sortable: false,
            filter: false,
            suppressCellFocus: true,
            cellRenderer: (params: any) => {
                if (!canUpdateCN || params.data.cn_pending === 0) return null;
                return (
                    <Button
                        size="small"
                        variant="outlined"
                        sx={{
                            fontSize: '0.65rem',
                            py: 0.25,
                            px: 0.75,
                            minWidth: 'auto',
                            height: 24,
                            lineHeight: 1,
                            textTransform: 'none',
                            whiteSpace: 'nowrap'
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
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

    //////////////////////////////////====UI RENDERING====////////////////////////////////////
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

                <Box sx={{ px: { xs: 0.5, md: 1.5 }, pb: 1, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Stats Row - Compact on Mobile */}
                    <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ mb: 1, mt: 1, flexWrap: 'wrap', gap: 0.5 }}
                    >
                        {/* Stats Chips */}
                        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Chip
                                label={`Total: ${stats.total}`}
                                size="small"
                                sx={{
                                    bgcolor: '#ef4444',
                                    color: '#fff',
                                    fontWeight: 600,
                                    height: { xs: 24, sm: 26 },
                                    fontSize: { xs: '0.7rem', sm: '0.75rem' }
                                }}
                            />
                            <Chip
                                label={`Pending: ${stats.cn_pending}`}
                                size="small"
                                sx={{
                                    bgcolor: '#f59e0b',
                                    color: '#fff',
                                    fontWeight: 600,
                                    height: { xs: 24, sm: 26 },
                                    fontSize: { xs: '0.7rem', sm: '0.75rem' }
                                }}
                            />
                            <Chip
                                label={`Received: ${stats.cn_received}`}
                                size="small"
                                sx={{
                                    bgcolor: '#22c55e',
                                    color: '#fff',
                                    fontWeight: 600,
                                    height: { xs: 24, sm: 26 },
                                    fontSize: { xs: '0.7rem', sm: '0.75rem' }
                                }}
                            />
                        </Stack>

                        {/* Action Buttons - Desktop Only */}
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
                            <Button size="small" variant="outlined" startIcon={<DownloadIcon sx={{ fontSize: 16 }} />} onClick={handleDownloadTemplate} sx={{ fontSize: '0.75rem' }}>
                                Template
                            </Button>
                            {canExport && (
                                <Button size="small" variant="outlined" startIcon={<ExcelIcon sx={{ fontSize: 16 }} />} onClick={handleExport} sx={{ fontSize: '0.75rem' }}>
                                    Export
                                </Button>
                            )}
                            {canCreate && (
                                <Button size="small" variant="contained" startIcon={<UploadIcon sx={{ fontSize: 16 }} />} onClick={() => { fetchManagedPersons(); setUploadDialogOpen(true); }} sx={{ fontSize: '0.75rem' }}>
                                    Upload
                                </Button>
                            )}
                        </Stack>
                    </Stack>

                    {/* Tabs */}
                    <Tabs
                        value={activeTab}
                        onChange={(_, v) => setActiveTab(v)}
                        variant={isSmall ? 'scrollable' : 'standard'}
                        scrollButtons={isSmall ? 'auto' : false}
                        sx={{
                            minHeight: 32,
                            mb: 1,
                            '& .MuiTab-root': { minHeight: 32, py: 0.5, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.75rem', sm: '0.8rem' } }
                        }}
                    >
                        <Tab label={`Rejections (${totalCount})`} />
                        <Tab label={`CN Summary (${summary.length})`} />
                        <Tab label={`Batches (${batchList.length})`} />
                        <Tab label={`Upload History (${uploadHistoryTotal})`} />
                    </Tabs>

                    {/* Tab Panels */}
                    {activeTab === 0 && (
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                            {/* Active Batch Filter Indicator */}
                            {batchFilter && (
                                <Alert
                                    severity="info"
                                    sx={{ mb: 1, py: 0, '& .MuiAlert-message': { py: 0.5 } }}
                                    action={
                                        <Button
                                            size="small"
                                            color="inherit"
                                            onClick={() => { setBatchFilter(''); setPage(1); }}
                                            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
                                        >
                                            Clear Filter
                                        </Button>
                                    }
                                >
                                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                        Filtered by batch: <strong>{batchFilter}</strong>
                                    </Typography>
                                </Alert>
                            )}

                            {/* Search & Filter Row */}
                            <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                sx={{ mb: 1.5 }}
                            >
                                {/* Search Box */}
                                <TextField
                                    size="small"
                                    placeholder="Search WSN, Product..."
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                                    }}
                                    sx={{
                                        flex: 1,
                                        maxWidth: { xs: '100%', md: 280 },
                                        '& .MuiOutlinedInput-root': { height: 36, fontSize: '0.8rem' }
                                    }}
                                />

                                {/* Mobile: Filter & Refresh Buttons */}
                                <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'flex', md: 'none' } }}>
                                    <IconButton
                                        size="small"
                                        onClick={() => { fetchRejections(); fetchSummary(); }}
                                        disabled={loading}
                                        sx={{
                                            bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                            '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }
                                        }}
                                    >
                                        {loading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
                                    </IconButton>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<TuneIcon />}
                                        onClick={() => setMobileFiltersOpen(true)}
                                        sx={{ height: 36, px: 1.5, textTransform: 'none', fontSize: '0.8rem', fontWeight: 600 }}
                                    >
                                        Filters
                                    </Button>
                                </Stack>

                                {/* Desktop: Inline Filters */}
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
                                    {/* Type Filter */}
                                    <FormControl size="small" sx={{ minWidth: 130 }}>
                                        <Select
                                            value={rejectionType}
                                            onChange={(e) => { setRejectionType(e.target.value); setPage(1); }}
                                            displayEmpty
                                            renderValue={(value) => (
                                                <Typography variant="body2" sx={{ color: isDarkMode ? '#fff' : 'inherit' }} noWrap>
                                                    <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Type: </span>
                                                    {value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1)}
                                                </Typography>
                                            )}
                                            sx={{ height: 36, '& .MuiSelect-select': { py: 1, pr: 4 } }}
                                        >
                                            <MenuItem value="all">All</MenuItem>
                                            <MenuItem value="damaged">Damaged</MenuItem>
                                            <MenuItem value="fraud">Fraud</MenuItem>
                                            <MenuItem value="short">Short</MenuItem>
                                            <MenuItem value="other">Other</MenuItem>
                                        </Select>
                                    </FormControl>

                                    {/* CN Status Filter */}
                                    <FormControl size="small" sx={{ minWidth: 160 }}>
                                        <Select
                                            value={cnStatus}
                                            onChange={(e) => { setCnStatus(e.target.value); setPage(1); }}
                                            displayEmpty
                                            renderValue={(value) => (
                                                <Typography variant="body2" sx={{ color: isDarkMode ? '#fff' : 'inherit' }} noWrap>
                                                    <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>CN Status: </span>
                                                    {value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1)}
                                                </Typography>
                                            )}
                                            sx={{ height: 36, '& .MuiSelect-select': { py: 1, pr: 4 } }}
                                        >
                                            <MenuItem value="all">All</MenuItem>
                                            <MenuItem value="pending">Pending</MenuItem>
                                            <MenuItem value="received">Received</MenuItem>
                                        </Select>
                                    </FormControl>

                                    {/* Rejected By Filter */}
                                    {persons.length > 0 && (
                                        <FormControl size="small" sx={{ minWidth: 200 }}>
                                            <Select
                                                value={personFilter}
                                                onChange={(e) => { setPersonFilter(e.target.value); setPage(1); }}
                                                displayEmpty
                                                renderValue={(value) => (
                                                    <Typography variant="body2" sx={{ color: isDarkMode ? '#fff' : 'inherit' }} noWrap>
                                                        <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Rejected By: </span>
                                                        {value === '' ? 'All' : value}
                                                    </Typography>
                                                )}
                                                sx={{ height: 36, '& .MuiSelect-select': { py: 1, pr: 4 } }}
                                            >
                                                <MenuItem value="">All</MenuItem>
                                                {persons.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                                            </Select>
                                        </FormControl>
                                    )}

                                    {/* Refresh Button */}
                                    <Tooltip title="Refresh">
                                        <IconButton size="small" onClick={() => { fetchRejections(); fetchSummary(); }} disabled={loading}>
                                            {loading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Stack>

                            {/* Grid Container with Fixed Height */}
                            <Box sx={{
                                position: 'relative',
                                flex: 1,
                                overflow: 'hidden',
                                minHeight: 0,
                                border: isDarkMode ? '2px solid rgba(255,255,255,0.1)' : '2px solid #e2e8f0',
                                borderRadius: 1.5,
                                boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
                            }}>

                                {/* Loading Spinner Overlay - semi-transparent so data stays visible */}
                                {loading && rejections && rejections.length > 0 && (
                                    <Box sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.5)',
                                        zIndex: 10,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <Box sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: 1.5,
                                            p: 3,
                                            bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                                            borderRadius: 2,
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                                        }}>
                                            <CircularProgress
                                                size={40}
                                                thickness={4}
                                                sx={{ color: '#1e40af' }}
                                            />
                                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                                Loading...
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}

                                {/* Full Loading Overlay - ONLY for initial load when no data exists */}
                                {loading && (!rejections || rejections.length === 0) && (
                                    <Box sx={{
                                        position: 'absolute',
                                        top: 48,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
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
                                            bgcolor: isDarkMode ? '#1e293b' : 'white',
                                            borderRadius: 3,
                                            boxShadow: isDarkMode ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)'
                                        }}>
                                            <Box sx={{ position: 'relative' }}>
                                                <CircularProgress
                                                    size={56}
                                                    thickness={3.5}
                                                    sx={{
                                                        color: '#1e40af',
                                                        filter: 'drop-shadow(0 2px 8px rgba(25, 118, 210, 0.2))'
                                                    }}
                                                />
                                            </Box>
                                            <Typography
                                                sx={{
                                                    fontSize: '0.95rem',
                                                    fontWeight: 500,
                                                    color: isDarkMode ? '#94a3b8' : '#546e7a',
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
                                {!loading && (!rejections || rejections.length === 0) && (
                                    <Box sx={{
                                        position: 'absolute',
                                        top: 60,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
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
                                                No rejections match your current filters. Try adjusting your search criteria or reset filters to see all items.
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}

                                {/* AG Grid - Always Rendered with Fixed Height */}
                                <Box className="ag-theme-quartz" sx={{
                                    height: '100%',
                                    width: '100%',
                                    bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
                                    overflow: 'hidden',
                                    '& .ag-root-wrapper': {
                                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                    },
                                    '& .ag-header': {
                                        backgroundColor: isDarkMode ? '#334155' : '#f8fafc',
                                        borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                                        fontWeight: 600,
                                        opacity: '1 !important',
                                        zIndex: 15,
                                        position: 'relative'
                                    },
                                    '& .ag-header-cell': {
                                        padding: '0 12px',
                                        opacity: '1 !important',
                                        fontWeight: 600,
                                        letterSpacing: '0.01em',
                                        backgroundColor: isDarkMode ? '#334155' : 'transparent',
                                        color: isDarkMode ? '#f1f5f9' : 'inherit',
                                    },
                                    '& .ag-header-cell-label': {
                                        color: isDarkMode ? '#f1f5f9' : 'inherit'
                                    },
                                    '& .ag-icon': { color: isDarkMode ? '#94a3b8' : '#64748b' },
                                    '& .ag-body-viewport': {
                                        opacity: loading ? 0.3 : 1,
                                        transition: 'opacity 0.2s ease-in-out',
                                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                    },
                                    '& .ag-row': {
                                        borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                                        transition: 'background-color 0.15s ease',
                                    },
                                    '& .ag-row-even': {
                                        backgroundColor: isDarkMode ? '#1a2536 !important' : '#ffffff !important',
                                    },
                                    '& .ag-row-odd': {
                                        backgroundColor: isDarkMode ? '#1e293b !important' : 'rgba(248,250,252,0.5) !important',
                                    },
                                    '& .ag-cell': {
                                        display: 'flex',
                                        alignItems: 'center',
                                        lineHeight: '36px',
                                        fontSize: '0.875rem',
                                        padding: '0 12px',
                                        color: isDarkMode ? '#f1f5f9' : 'inherit',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    },
                                    '& .ag-cell-value': {
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    },
                                    '& .ag-row-hover': {
                                        backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15) !important' : 'rgba(30,64,175,0.04) !important',
                                        transition: 'background-color 0.1s ease'
                                    },
                                    '& .ag-cell-focus': {
                                        border: '2px solid #1e40af !important',
                                        boxSizing: 'border-box',
                                        outline: 'none',
                                    },
                                    '& .ag-cell-range-selected': {
                                        backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2) !important' : 'rgba(30,64,175,0.08) !important',
                                    },
                                    '& .ag-center-cols-viewport, & .ag-center-cols-container': {
                                        backgroundColor: isDarkMode ? '#1e293b' : '#fff'
                                    },
                                }}
                                >
                                    <AgGridReact
                                        ref={gridRef}
                                        rowData={rejections}
                                        columnDefs={columnDefs}
                                        defaultColDef={defaultColDef}
                                        animateRows={false}
                                        rowSelection="multiple"
                                        suppressCellFocus
                                        onGridReady={onGridReady}
                                        onColumnMoved={onColumnStateChanged}
                                        onColumnResized={onColumnStateChanged}
                                        suppressScrollOnNewData={true}
                                        maintainColumnOrder={true}
                                        enableCellTextSelection={true}
                                        loading={false}
                                        suppressNoRowsOverlay={true}
                                        // ⚡ PERFORMANCE: Optimizations for smooth fast scrolling
                                        rowBuffer={100}
                                        suppressRowTransform={true}
                                        suppressAnimationFrame={true}
                                        alwaysShowVerticalScroll={true}
                                        debounceVerticalScrollbar={true}
                                        containerStyle={{ height: '100%', width: '100%' }}
                                        rowHeight={36}
                                        headerHeight={36}

                                    />
                                </Box>
                            </Box>

                            {/* Pagination */}
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{
                                px: { xs: 1, sm: 2 },
                                py: { xs: 0.75, sm: 0.5 },
                                borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #ddd',
                                bgcolor: isDarkMode ? '#1e293b' : '#fff',
                                borderRadius: '0 0 8px 8px',
                                mt: 0.5,
                                minHeight: { xs: 44, sm: 52 },
                                gap: { xs: 0.5, sm: 1 },
                                flexWrap: 'wrap',
                            }}>
                                {/* Left Section: Per Page */}
                                <Stack direction="row" spacing={{ xs: 0.5, sm: 1.5 }} alignItems="center">
                                    <Typography sx={{ fontSize: { xs: '0.7rem', sm: '0.78rem' }, whiteSpace: 'nowrap', color: isDarkMode ? '#94a3b8' : 'inherit' }}>
                                        Per page:
                                    </Typography>
                                    <Select
                                        size="small"
                                        value={limit}
                                        onChange={(e) => {
                                            setLimit(Number(e.target.value));
                                            setPage(1);
                                        }}
                                        sx={{
                                            minWidth: { xs: 58, sm: 70 },
                                            '& .MuiSelect-select': {
                                                py: { xs: 0.5, sm: 0.75 },
                                                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                                color: isDarkMode ? '#f1f5f9' : 'inherit',
                                            }
                                        }}
                                    >
                                        <MenuItem value={50}>50</MenuItem>
                                        <MenuItem value={100}>100</MenuItem>
                                        <MenuItem value={500}>500</MenuItem>
                                        <MenuItem value={1000}>1000</MenuItem>
                                    </Select>
                                </Stack>

                                {/* Center Section: Count */}
                                <Typography sx={{ fontSize: { xs: '0.7rem', sm: '0.78rem' }, whiteSpace: 'nowrap', color: isDarkMode ? '#94a3b8' : 'inherit' }}>
                                    {totalCount > 0 ? `${(page - 1) * limit + 1}-${Math.min(page * limit, totalCount)} of ${totalCount}` : 'No records'}
                                </Typography>

                                {/* Right Section: Pagination */}
                                <Pagination
                                    count={totalPages}
                                    page={page}
                                    onChange={(_, p) => setPage(p)}
                                    size="small"
                                    siblingCount={isSmall ? 0 : 1}
                                />
                            </Stack>
                        </Box>
                    )
                    }

                    {
                        activeTab === 1 && (
                            <Box sx={{
                                position: 'relative',
                                flex: 1,
                                overflow: 'hidden',
                                minHeight: 0,
                                border: isDarkMode ? '2px solid rgba(255,255,255,0.1)' : '2px solid #e2e8f0',
                                borderRadius: 1.5,
                                boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
                            }}>
                                {/* Empty State */}
                                {!loading && (!summary || summary.length === 0) && (
                                    <Box sx={{
                                        position: 'absolute',
                                        top: 60,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
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
                                            <Box sx={{ fontSize: '4rem', opacity: 0.3, mb: 1 }}>📋</Box>
                                            <Typography variant="h5" sx={{ fontWeight: 600, color: '#6b7280', mb: 0.5 }}>
                                                No CN Summary
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ca3af', maxWidth: 400 }}>
                                                Credit note summary will appear here once rejections are uploaded.
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}

                                <Box className="ag-theme-quartz" sx={{
                                    height: '100%',
                                    width: '100%',
                                    bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
                                    overflow: 'hidden',
                                    '& .ag-root-wrapper': {
                                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                    },
                                    '& .ag-header': {
                                        backgroundColor: isDarkMode ? '#334155' : '#f8fafc',
                                        borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                                        fontWeight: 600,
                                        opacity: '1 !important',
                                        zIndex: 15,
                                        position: 'relative'
                                    },
                                    '& .ag-header-cell': {
                                        padding: '0 12px',
                                        opacity: '1 !important',
                                        fontWeight: 600,
                                        letterSpacing: '0.01em',
                                        backgroundColor: isDarkMode ? '#334155' : 'transparent',
                                        color: isDarkMode ? '#f1f5f9' : 'inherit',
                                    },
                                    '& .ag-header-cell-label': { color: isDarkMode ? '#f1f5f9' : 'inherit' },
                                    '& .ag-icon': { color: isDarkMode ? '#94a3b8' : '#64748b' },
                                    '& .ag-body-viewport': {
                                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                    },
                                    '& .ag-row': {
                                        borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                                        transition: 'background-color 0.15s ease',
                                    },
                                    '& .ag-row-even': {
                                        backgroundColor: isDarkMode ? '#1a2536 !important' : '#ffffff !important',
                                    },
                                    '& .ag-row-odd': {
                                        backgroundColor: isDarkMode ? '#1e293b !important' : 'rgba(248,250,252,0.5) !important',
                                    },
                                    '& .ag-cell': {
                                        display: 'flex',
                                        alignItems: 'center',
                                        lineHeight: '36px',
                                        fontSize: '0.875rem',
                                        padding: '0 12px',
                                        color: isDarkMode ? '#f1f5f9' : 'inherit',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    },
                                    '& .ag-cell-value': {
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    },
                                    '& .ag-row-hover': {
                                        backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15) !important' : 'rgba(30,64,175,0.04) !important',
                                        transition: 'background-color 0.1s ease'
                                    },
                                    '& .ag-cell-focus': {
                                        border: 'none !important',
                                        outline: 'none !important',
                                    },
                                    '& .ag-center-cols-viewport, & .ag-center-cols-container': {
                                        backgroundColor: isDarkMode ? '#1e293b' : '#fff'
                                    },
                                }}>
                                    <AgGridReact
                                        ref={summaryGridRef}
                                        rowData={summary}
                                        columnDefs={summaryColumns}
                                        defaultColDef={defaultColDef}
                                        animateRows={false}
                                        suppressScrollOnNewData={true}
                                        maintainColumnOrder={true}
                                        enableCellTextSelection={true}
                                        loading={false}
                                        suppressNoRowsOverlay={true}
                                        suppressCellFocus={true}
                                        // ⚡ PERFORMANCE: Optimizations for smooth fast scrolling
                                        rowBuffer={100}
                                        suppressRowTransform={true}
                                        suppressAnimationFrame={true}
                                        alwaysShowVerticalScroll={true}
                                        debounceVerticalScrollbar={true}
                                        containerStyle={{ height: '100%', width: '100%' }}
                                        rowHeight={36}
                                        headerHeight={36}
                                        onGridReady={onSummaryGridReady}
                                        onColumnMoved={onSummaryColumnStateChanged}
                                        onColumnResized={onSummaryColumnStateChanged}
                                    />
                                </Box>
                            </Box>
                        )
                    }

                    {
                        activeTab === 2 && (
                            <Paper elevation={2} sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 300, overflow: 'hidden' }}>
                                <BatchManagementTab
                                    batches={batchList}
                                    loading={batchLoading}
                                    onRefresh={fetchBatchList}
                                    onDelete={handleDeleteBatch}
                                    onRename={handleRenameBatch}
                                    onView={(batchId) => {
                                        setBatchFilter(batchId);
                                        setPage(1);
                                        setActiveTab(0);
                                    }}
                                    canDelete={canDelete}
                                    canRename={canCreate}
                                    canView={true}
                                    title="Rejection Batches"
                                    emptyMessage="No rejection batches found"
                                    emptySubMessage="Batches will appear here after uploading rejections"
                                />
                                {/* Deleted Batches Section (Trash / Recovery) */}
                                {deletedBatches.length > 0 && (
                                    <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                                            <Typography variant="subtitle2" fontWeight={700} color="error.main">
                                                🗑️ Deleted Batches ({deletedBatches.length})
                                            </Typography>
                                            <Button
                                                size="small"
                                                startIcon={deletedBatchesLoading ? <CircularProgress size={14} /> : <RefreshIcon />}
                                                onClick={fetchDeletedBatches}
                                                disabled={deletedBatchesLoading}
                                            >
                                                Refresh
                                            </Button>
                                        </Stack>
                                        <Alert severity="warning" sx={{ mb: 1.5, py: 0.5 }}>
                                            <Typography variant="caption">
                                                Deleted batches can be <strong>restored</strong>. Permanent delete will remove data forever.
                                            </Typography>
                                        </Alert>
                                        <Stack spacing={1}>
                                            {deletedBatches.map((batch: any) => (
                                                <Paper
                                                    key={batch.batch_id}
                                                    variant="outlined"
                                                    sx={{ p: 1.5, bgcolor: 'action.hover', opacity: 0.85 }}
                                                >
                                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                        <Box>
                                                            <Typography variant="body2" fontWeight={600}>
                                                                {batch.batch_id}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {batch.count} items • Deleted by {batch.deleted_by_name || 'Unknown'} • {formatDateDMY(batch.deleted_at)}
                                                            </Typography>
                                                        </Box>
                                                        <Stack direction="row" spacing={0.5}>
                                                            <Tooltip title="Restore Batch">
                                                                <IconButton
                                                                    size="small"
                                                                    color="success"
                                                                    onClick={() => handleRestoreBatch(batch.batch_id)}
                                                                >
                                                                    <RestoreIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                            {canDelete && (
                                                                <Tooltip title="Permanently Delete">
                                                                    <IconButton
                                                                        size="small"
                                                                        color="error"
                                                                        onClick={() => handlePermanentDeleteBatch(batch.batch_id)}
                                                                    >
                                                                        <DeleteForeverIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                        </Stack>
                                                    </Stack>
                                                </Paper>
                                            ))}
                                        </Stack>
                                    </Box>
                                )}
                            </Paper>
                        )
                    }

                    {/* Upload History Tab */}
                    {
                        activeTab === 3 && (
                            <Paper elevation={2} sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 300, overflow: 'auto' }}>
                                <Box sx={{ p: 2 }}>
                                    {/* Header */}
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                        <Typography variant="subtitle1" fontWeight={700}>
                                            📜 Upload History
                                        </Typography>
                                        <Button
                                            size="small"
                                            startIcon={uploadHistoryLoading ? <CircularProgress size={14} /> : <RefreshIcon />}
                                            onClick={fetchUploadHistory}
                                            disabled={uploadHistoryLoading}
                                        >
                                            Refresh
                                        </Button>
                                    </Stack>

                                    {/* Upload History Table */}
                                    {uploadHistoryLoading && uploadHistory.length === 0 ? (
                                        <Box sx={{ textAlign: 'center', py: 4 }}>
                                            <CircularProgress size={32} />
                                            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>Loading upload history...</Typography>
                                        </Box>
                                    ) : uploadHistory.length === 0 ? (
                                        <Box sx={{ textAlign: 'center', py: 4 }}>
                                            <Typography sx={{ fontSize: '3rem', opacity: 0.3 }}>📜</Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#6b7280', mt: 1 }}>No Upload History</Typography>
                                            <Typography variant="body2" sx={{ color: '#9ca3af' }}>Upload history will appear here after rejection uploads</Typography>
                                        </Box>
                                    ) : (
                                        <>
                                            <Box sx={{ overflowX: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: `2px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : '#e0e0e0'}` }}>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>File</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Batch</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>Status</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>Total</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>Success</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>Skipped</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>Errors</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Uploaded By</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Date</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {uploadHistory.map((log: any) => (
                                                            <tr key={log.id} style={{ borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : '#f0f0f0'}` }}>
                                                                <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    <Tooltip title={log.original_filename || '-'}>
                                                                        <span>{log.original_filename || '-'}</span>
                                                                    </Tooltip>
                                                                    {log.file_size_bytes > 0 && (
                                                                        <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                                                                            {(log.file_size_bytes / 1024).toFixed(1)} KB
                                                                        </Typography>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '8px 12px' }}>
                                                                    <Typography variant="body2" sx={{ color: '#1e40af', fontWeight: 500, fontSize: '0.78rem' }}>
                                                                        {log.batch_id}
                                                                    </Typography>
                                                                </td>
                                                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                                    <Chip
                                                                        label={log.status === 'completed' ? 'Success' : 'Failed'}
                                                                        size="small"
                                                                        sx={{
                                                                            height: 22,
                                                                            fontSize: '0.7rem',
                                                                            fontWeight: 600,
                                                                            bgcolor: log.status === 'completed' ? '#22c55e' : '#ef4444',
                                                                            color: '#fff'
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{log.total_rows}</td>
                                                                <td style={{ padding: '8px 12px', textAlign: 'center', color: '#22c55e', fontWeight: 600 }}>{log.success_count}</td>
                                                                <td style={{ padding: '8px 12px', textAlign: 'center', color: '#f59e0b', fontWeight: 600 }}>
                                                                    {log.skipped_count > 0 ? (
                                                                        <Tooltip title="Click to view skipped WSN details">
                                                                            <span
                                                                                style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                                                                onClick={() => setLogDetailDialog({ open: true, log, tab: 'skipped' })}
                                                                            >
                                                                                {log.skipped_count}
                                                                            </span>
                                                                        </Tooltip>
                                                                    ) : log.skipped_count}
                                                                </td>
                                                                <td style={{ padding: '8px 12px', textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>
                                                                    {log.error_count > 0 ? (
                                                                        <Tooltip title="Click to view error details">
                                                                            <span
                                                                                style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                                                                onClick={() => setLogDetailDialog({ open: true, log, tab: 'errors' })}
                                                                            >
                                                                                {log.error_count}
                                                                            </span>
                                                                        </Tooltip>
                                                                    ) : log.error_count}
                                                                </td>
                                                                <td style={{ padding: '8px 12px' }}>{log.uploaded_by_name || '-'}</td>
                                                                <td style={{ padding: '8px 12px', fontSize: '0.75rem' }}>
                                                                    {formatDateTimeDMY(log.uploaded_at)}
                                                                </td>
                                                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                                    {canDelete && (
                                                                        <Tooltip title="Delete log">
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={() => handleDeleteUploadLog(log.id, log.original_filename || 'unknown')}
                                                                                sx={{ width: 28, height: 28, color: '#ef4444' }}
                                                                            >
                                                                                <DeleteIcon sx={{ fontSize: 16 }} />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </Box>

                                            {/* Pagination */}
                                            {uploadHistoryTotal > 20 && (
                                                <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
                                                    <Pagination
                                                        count={Math.ceil(uploadHistoryTotal / 20)}
                                                        page={uploadHistoryPage}
                                                        onChange={(_, p) => setUploadHistoryPage(p)}
                                                        size="small"
                                                    />
                                                </Stack>
                                            )}
                                        </>
                                    )}
                                </Box>
                            </Paper>
                        )
                    }
                </Box >
            </Box >

            {/* Upload Dialog */}
            < Dialog open={uploadDialogOpen} onClose={() => { setUploadDialogOpen(false); setUploadError(''); setFileValidationError(''); setAddingNewPerson(false); setNewPersonName(''); }} maxWidth="sm" fullWidth >
                <DialogTitle sx={{ pb: 1 }}>
                    Upload Rejection Excel
                    <IconButton onClick={() => { setUploadDialogOpen(false); setUploadError(''); setFileValidationError(''); setAddingNewPerson(false); setNewPersonName(''); }} sx={{ position: 'absolute', right: 8, top: 8 }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Alert severity="info" sx={{ py: 0.5 }}>
                            Excel columns: <strong>WSN</strong>, <strong>Rejection Type</strong> (dropdown in template), Remarks (optional)
                            <br />
                            <Typography variant="caption" color="text.secondary">
                                Rejected By person and Rejection Date are selected below (applied to all rows).
                            </Typography>
                        </Alert>

                        {/* Upload Error Display */}
                        {uploadError && (
                            <Alert severity="error" onClose={() => setUploadError('')} sx={{ py: 0.5 }}>
                                <Typography variant="body2" fontWeight={600}>Upload Failed</Typography>
                                <Typography variant="caption">{uploadError}</Typography>
                                <Box sx={{ mt: 1 }}>
                                    <Button size="small" variant="outlined" color="error" onClick={handleDownloadTemplate} sx={{ fontSize: '0.7rem' }}>
                                        Download Correct Template
                                    </Button>
                                </Box>
                            </Alert>
                        )}

                        {/* File Validation Error */}
                        {fileValidationError && (
                            <Alert severity="warning" onClose={() => setFileValidationError('')} sx={{ py: 0.5 }}>
                                {fileValidationError}
                            </Alert>
                        )}

                        {/* Rejected By Person Dropdown */}
                        <FormControl fullWidth size="small" required>
                            <InputLabel>Rejected By Person</InputLabel>
                            <Select
                                value={selectedPerson}
                                label="Rejected By Person"
                                onChange={(e) => {
                                    if (e.target.value === '__ADD_NEW__') {
                                        setAddingNewPerson(true);
                                        return;
                                    }
                                    setSelectedPerson(e.target.value);
                                }}
                            >
                                {managedPersons.map((p) => (
                                    <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>
                                ))}
                                <MenuItem value="__ADD_NEW__" sx={{ color: 'primary.main', fontWeight: 600, borderTop: '1px solid', borderColor: 'divider', mt: 0.5 }}>
                                    <PersonAddIcon sx={{ mr: 1, fontSize: 18 }} /> + Add New Person
                                </MenuItem>
                            </Select>
                        </FormControl>

                        {/* Add New Person Inline */}
                        {addingNewPerson && (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <TextField
                                    size="small"
                                    label="New Person Name"
                                    value={newPersonName}
                                    onChange={(e) => setNewPersonName(e.target.value)}
                                    fullWidth
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddNewPerson(); if (e.key === 'Escape') { setAddingNewPerson(false); setNewPersonName(''); } }}
                                    placeholder="e.g. Rahul Kumar"
                                />
                                <Button variant="contained" size="small" onClick={handleAddNewPerson} disabled={!newPersonName.trim()} sx={{ minWidth: 70 }}>
                                    Add
                                </Button>
                                <IconButton size="small" onClick={() => { setAddingNewPerson(false); setNewPersonName(''); }}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Stack>
                        )}

                        {/* Rejection Date */}
                        <TextField
                            type="date"
                            label="Rejection Date"
                            value={rejectionDate}
                            onChange={(e) => setRejectionDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                            size="small"
                            required
                            helperText="Applied to all rows in this upload"
                        />

                        {/* File Upload Area */}
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
                    <Button onClick={() => { setUploadDialogOpen(false); setUploadError(''); setFileValidationError(''); setAddingNewPerson(false); setNewPersonName(''); }}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleUpload}
                        disabled={!selectedFile || !selectedPerson || uploading}
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

            {/* Mobile Filters Dialog */}
            <Dialog fullScreen open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)}>
                <AppBar position="sticky" elevation={1} sx={{ bgcolor: isDarkMode ? '#1e293b' : 'background.paper', color: isDarkMode ? '#f1f5f9' : 'text.primary', borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e0e0e0' }}>
                    <Toolbar>
                        <IconButton edge="start" color="inherit" onClick={() => setMobileFiltersOpen(false)} aria-label="close">
                            <CloseIcon />
                        </IconButton>
                        <Typography sx={{ ml: 2, flex: 1, fontWeight: 700 }}>Filters & Actions</Typography>
                        <Button color="primary" onClick={() => setMobileFiltersOpen(false)}>Done</Button>
                    </Toolbar>
                </AppBar>

                <DialogContent sx={{ p: 2, bgcolor: isDarkMode ? '#0f172a' : 'background.default' }}>
                    <Stack spacing={2.5}>
                        {/* Filters Section */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: isDarkMode ? '#94a3b8' : '#6b7280', display: 'flex', alignItems: 'center', gap: 1 }}>
                                <FilterListIcon fontSize="small" /> Filters
                            </Typography>

                            <Stack spacing={1.5}>
                                <TextField
                                    select
                                    size="small"
                                    label="Type"
                                    value={rejectionType}
                                    onChange={(e) => { setRejectionType(e.target.value); setPage(1); }}
                                    fullWidth
                                    sx={{ '& .MuiOutlinedInput-root': { height: 44 } }}
                                >
                                    <MenuItem value="all">All Types</MenuItem>
                                    <MenuItem value="damaged">Damaged</MenuItem>
                                    <MenuItem value="fraud">Fraud</MenuItem>
                                    <MenuItem value="short">Short</MenuItem>
                                    <MenuItem value="other">Other</MenuItem>
                                </TextField>

                                <TextField
                                    select
                                    size="small"
                                    label="CN Status"
                                    value={cnStatus}
                                    onChange={(e) => { setCnStatus(e.target.value); setPage(1); }}
                                    fullWidth
                                    sx={{ '& .MuiOutlinedInput-root': { height: 44 } }}
                                >
                                    <MenuItem value="all">All Status</MenuItem>
                                    <MenuItem value="pending">Pending</MenuItem>
                                    <MenuItem value="received">Received</MenuItem>
                                </TextField>

                                {persons.length > 0 && (
                                    <TextField
                                        select
                                        size="small"
                                        label="Rejected By"
                                        value={personFilter}
                                        onChange={(e) => { setPersonFilter(e.target.value); setPage(1); }}
                                        fullWidth
                                        sx={{ '& .MuiOutlinedInput-root': { height: 44 } }}
                                    >
                                        <MenuItem value="">All Persons</MenuItem>
                                        {persons.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                                    </TextField>
                                )}

                                <Button
                                    variant="outlined"
                                    startIcon={<FilterListIcon />}
                                    onClick={() => {
                                        setSearch('');
                                        setRejectionType('all');
                                        setCnStatus('all');
                                        setPersonFilter('');
                                        setPage(1);
                                    }}
                                    sx={{ height: 44, fontSize: '0.85rem' }}
                                >
                                    Clear All Filters
                                </Button>
                            </Stack>
                        </Box>

                        {/* Actions Section */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: isDarkMode ? '#94a3b8' : '#6b7280', display: 'flex', alignItems: 'center', gap: 1 }}>
                                ⚡ Actions
                            </Typography>

                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<RefreshIcon />}
                                    onClick={() => { fetchRejections(); fetchSummary(); setMobileFiltersOpen(false); }}
                                    sx={{ height: 48, fontSize: '0.85rem' }}
                                >
                                    Refresh
                                </Button>

                                <Button
                                    variant="outlined"
                                    startIcon={<DownloadIcon />}
                                    onClick={() => { handleDownloadTemplate(); setMobileFiltersOpen(false); }}
                                    sx={{ height: 48, fontSize: '0.85rem' }}
                                >
                                    Template
                                </Button>

                                {canExport && (
                                    <Button
                                        variant="outlined"
                                        startIcon={<ExcelIcon />}
                                        onClick={() => { handleExport(); setMobileFiltersOpen(false); }}
                                        sx={{ height: 48, fontSize: '0.85rem' }}
                                    >
                                        Export
                                    </Button>
                                )}

                                {canCreate && (
                                    <Button
                                        variant="contained"
                                        startIcon={<UploadIcon />}
                                        onClick={() => { fetchManagedPersons(); setUploadDialogOpen(true); setMobileFiltersOpen(false); }}
                                        sx={{ height: 48, fontSize: '0.85rem' }}
                                    >
                                        Upload
                                    </Button>
                                )}
                            </Box>
                        </Box>

                        {/* Apply Button */}
                        <Button
                            variant="contained"
                            color="primary"
                            fullWidth
                            onClick={() => { setPage(1); setMobileFiltersOpen(false); }}
                            sx={{ height: 52, fontSize: '0.95rem', fontWeight: 600, mt: 1 }}
                        >
                            Apply Filters
                        </Button>
                    </Stack>
                </DialogContent>
            </Dialog>

            {/* Upload Log Detail Dialog (Skipped / Error details) */}
            <Dialog
                open={logDetailDialog.open}
                onClose={() => setLogDetailDialog({ open: false, log: null, tab: 'skipped' })}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ pb: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="h6" fontWeight={700}>
                            {logDetailDialog.tab === 'skipped' ? '⚠️ Skipped WSNs' : '❌ Error Details'}
                        </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        File: {logDetailDialog.log?.original_filename || '-'} &bull; Batch: {logDetailDialog.log?.batch_id || '-'}
                    </Typography>
                    <IconButton
                        onClick={() => setLogDetailDialog({ open: false, log: null, tab: 'skipped' })}
                        sx={{ position: 'absolute', right: 8, top: 8 }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {/* Tab toggle between skipped and errors */}
                    {logDetailDialog.log && (logDetailDialog.log.skipped_count > 0 || logDetailDialog.log.error_count > 0) && (
                        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                            <Chip
                                label={`Skipped (${logDetailDialog.log.skipped_count})`}
                                variant={logDetailDialog.tab === 'skipped' ? 'filled' : 'outlined'}
                                color="warning"
                                size="small"
                                onClick={() => setLogDetailDialog(prev => ({ ...prev, tab: 'skipped' }))}
                                sx={{ cursor: 'pointer', fontWeight: 600 }}
                            />
                            <Chip
                                label={`Errors (${logDetailDialog.log.error_count})`}
                                variant={logDetailDialog.tab === 'errors' ? 'filled' : 'outlined'}
                                color="error"
                                size="small"
                                onClick={() => setLogDetailDialog(prev => ({ ...prev, tab: 'errors' }))}
                                sx={{ cursor: 'pointer', fontWeight: 600 }}
                            />
                        </Stack>
                    )}

                    {logDetailDialog.tab === 'skipped' ? (
                        (() => {
                            const skippedData: { wsn: string; reason: string }[] = logDetailDialog.log?.skipped_details || [];
                            if (skippedData.length === 0) {
                                return (
                                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                                        No skipped details available for this upload.
                                    </Typography>
                                );
                            }
                            return (
                                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                                                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, width: 50 }}>#</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>WSN</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {skippedData.map((item, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                    <td style={{ padding: '6px 12px', color: '#9ca3af' }}>{idx + 1}</td>
                                                    <td style={{ padding: '6px 12px', fontWeight: 600, fontFamily: 'monospace' }}>{item.wsn}</td>
                                                    <td style={{ padding: '6px 12px', color: '#f59e0b' }}>{item.reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </Box>
                            );
                        })()
                    ) : (
                        (() => {
                            const errorData: string[] = logDetailDialog.log?.error_details || [];
                            if (errorData.length === 0) {
                                return (
                                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                                        No error details available for this upload.
                                    </Typography>
                                );
                            }
                            return (
                                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                                                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, width: 50 }}>#</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Error Message</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {errorData.map((msg, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                    <td style={{ padding: '6px 12px', color: '#9ca3af' }}>{idx + 1}</td>
                                                    <td style={{ padding: '6px 12px', color: '#ef4444' }}>{msg}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </Box>
                            );
                        })()
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLogDetailDialog({ open: false, log: null, tab: 'skipped' })}>Close</Button>
                </DialogActions>
            </Dialog>
        </AppLayout>
    );
}
