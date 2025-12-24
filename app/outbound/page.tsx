'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Box,
    Paper,
    Typography,
    Button,
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
    TextField,
    MenuItem,
    Chip,
    Stack,
    Tab,
    Tabs,
    CircularProgress,
    Alert,
    Select,
    FormControl,
    InputLabel,
    Checkbox,
    FormControlLabel,
    LinearProgress,
    Divider,
    Card,
    CardContent,
    Autocomplete,
} from '@mui/material';
import {
    Download as DownloadIcon,
    Settings as SettingsIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
    CheckCircle,
    Upload as UploadIcon,
} from '@mui/icons-material';
import { outboundAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

// Register AG Grid modules ONCE
ModuleRegistry.registerModules([AllCommunityModule]);

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

const ALL_LIST_COLUMNS = [
    'wsn',
    'customer_name',
    'dispatch_date',
    'vehicle_no',
    'source',
    'product_title',
    'brand',
    'cms_vertical',
    'wid',
    'fsn',
    'order_id',
    'fkqc_remark',
    'fk_grade',
    'hsn_sac',
    'igst_rate',
    'fsp',
    'mrp',
    'vrp',
    'yield_value',
    'invoice_date',
    'fkt_link',
    'wh_location',
    'p_type',
    'p_size',
    'batch_id',
    'dispatch_remarks',
    'other_remarks',
    'quantity',
    'created_user_name',
];

const ALL_MULTI_COLUMNS = [
    'wsn',
    'dispatch_remarks',
    'other_remarks',
    'product_title',
    'brand',
    'cms_vertical',
    'source',
    'wid',
    'fsn',
    'order_id',
    'fkqc_remark',
    'fk_grade',
    'hsn_sac',
    'igst_rate',
    'fsp',
    'mrp',
    'vrp',
    'yield_value',
    'invoice_date',
    'fkt_link',
    'wh_location',
    'p_type',
    'p_size',
    'quantity',
];

const DEFAULT_MULTI_COLUMNS = [
    'wsn',
    'product_title',
    'brand',
    'fsp',
    'mrp',
    'dispatch_remarks',
];

const EDITABLE_COLUMNS = ['wsn', 'dispatch_remarks', 'other_remarks', 'quantity'];

interface OutboundItem {
    id: number;
    [key: string]: any;
}

interface StatsType {
    picking: number;
    qc: number;
    inbound: number;
    total: number;
}

interface BulkProgressType {
    show: boolean;
    processed: number;
    total: number;
    successCount: number;
    errorCount: number;
    batchId: string;
}

interface Batch {
    batch_id: string;
    count: number;
    last_updated: string;
}

export default function OutboundPage() {
    // Role guard - only admin, manager, operator can access
    useRoleGuard(['admin', 'manager', 'operator']);

    const router = useRouter();
    const { activeWarehouse } = useWarehouse();
    const [user, setUser] = useState<any>(null);
    const [tabValue, setTabValue] = useState(0);
    const gridRef = useRef<any>(null);
    const wsnInputRef = useRef<HTMLInputElement>(null);

    // ====== SINGLE ENTRY STATE ======
    const [singleWSN, setSingleWSN] = useState('');
    const [sourceData, setSourceData] = useState<any>(null);
    const [singleForm, setSingleForm] = useState({
        dispatch_date: new Date().toISOString().split('T')[0],
        customer_name: '',
        vehicle_no: '',
        dispatch_remarks: '',
        other_remarks: '',
    });
    const [singleLoading, setSingleLoading] = useState(false);
    const [duplicateWSN, setDuplicateWSN] = useState<any>(null);
    const [updateMode, setUpdateMode] = useState(false);

    // ====== MULTI ENTRY STATE (AG GRID) ======
    const generateEmptyRows = (count: number) => {
        return Array.from({ length: count }, (_, i) => ({
            id: Date.now() + i,
            wsn: '',
            dispatch_date: new Date().toISOString().split('T')[0],
            customer_name: '',
            vehicle_no: '',
            dispatch_remarks: '',
            other_remarks: '',
            source: '',
            product_title: '',
            brand: '',
            mrp: '',
            fsp: '',
        }));
    };

    const [multiRows, setMultiRows] = useState<OutboundItem[]>(generateEmptyRows(10));
    const [multiLoading, setMultiLoading] = useState(false);
    const [multiResults, setMultiResults] = useState<any[]>([]);
    const [existingOutboundWSNs, setExistingOutboundWSNs] = useState<Set<string>>(new Set());
    const [duplicateWSNs, setDuplicateWSNs] = useState<Set<string>>(new Set());
    const [gridDuplicateWSNs, setGridDuplicateWSNs] = useState<Set<string>>(new Set());
    const [crossWarehouseWSNs, setCrossWarehouseWSNs] = useState<Set<string>>(new Set());
    const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_MULTI_COLUMNS);
    const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
    const [commonDate, setCommonDate] = useState(new Date().toISOString().split('T')[0]);
    const [commonCustomer, setCommonCustomer] = useState('');
    const [commonVehicle, setCommonVehicle] = useState('');
    const [multiErrorMessage, setMultiErrorMessage] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState('');

    // ====== BULK UPLOAD STATE ======
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<BulkProgressType>({
        show: false,
        processed: 0,
        total: 0,
        successCount: 0,
        errorCount: 0,
        batchId: '',
    });
    const [bulkErrors, setBulkErrors] = useState<any[]>([]);
    const [bulkErrorsOpen, setBulkErrorsOpen] = useState(false);

    // ====== OUTBOUND LIST STATE ======
    const [listData, setListData] = useState<OutboundItem[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(100);
    const [total, setTotal] = useState(0);
    const [searchFilter, setSearchFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');
    const [batchFilter, setBatchFilter] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [customers, setCustomers] = useState<string[]>([]);
    const [brands, setBrands] = useState<string[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [listColumns, setListColumns] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('outboundListColumns');
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
        // Default: show all important columns
        return ['wsn', 'customer_name', 'dispatch_date', 'product_title', 'brand', 'cms_vertical', 'source', 'fsp', 'mrp', 'batch_id'];
    });
    const [listColumnSettingsOpen, setListColumnSettingsOpen] = useState(false);

    // ====== BATCH MANAGEMENT STATE ======
    const [batches, setBatches] = useState<Batch[]>([]);
    const [batchLoading, setBatchLoading] = useState(false);

    // ====== STATS ======
    const [stats, setStats] = useState<StatsType>({
        picking: 0,
        qc: 0,
        inbound: 0,
        total: 0,
    });

    // ====== EXPORT STATE ======
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [exportStartDate, setExportStartDate] = useState('');
    const [exportEndDate, setExportEndDate] = useState('');
    const [exportCustomer, setExportCustomer] = useState('');
    const [exportBatchId, setExportBatchId] = useState('');
    const [exportSource, setExportSource] = useState('');

    // AUTH CHECK
    useEffect(() => {
        const storedUser = getStoredUser();
        if (!storedUser) {
            router.push('/login');
            return;
        }
        setUser(storedUser);
    }, [router]);

    // ✅ LOAD COLUMN SETTINGS FROM LOCALSTORAGE
    useEffect(() => {
        const saved = localStorage.getItem('outboundMultiEntryColumns');
        if (saved) {
            try {
                const cols = JSON.parse(saved);
                // Validate columns exist in ALL_MULTI_COLUMNS
                const valid = cols.filter((col: string) => ALL_MULTI_COLUMNS.includes(col));
                if (valid.length > 0) {
                    setVisibleColumns(valid);
                    return;
                }
            } catch (e) {
                console.log('Column settings load error');
            }
        }
        setVisibleColumns(DEFAULT_MULTI_COLUMNS);
    }, []);

    // ✅ SAVE COLUMN SETTINGS - Maintain order
    const saveColumnSettings = (cols: string[]) => {
        // Maintain the order of ALL_MULTI_COLUMNS, only filter by selected cols
        const orderedCols = ALL_MULTI_COLUMNS.filter(col => cols.includes(col));
        setVisibleColumns(orderedCols);
        localStorage.setItem('outboundMultiEntryColumns', JSON.stringify(orderedCols));
    };

    const saveListColumnSettings = (cols: string[]) => {
        setListColumns(cols);
        localStorage.setItem('outboundListColumns', JSON.stringify(cols));
    };

    // ====== LOAD DATA ON TAB CHANGE ======
    useEffect(() => {
        if (activeWarehouse) {
            if (tabValue === 0) {
                loadOutboundList();
                loadBrands();
                loadCategories();
            } else if (tabValue === 1 || tabValue === 3) {
                loadExistingWSNs();
                loadCustomers();
            } else if (tabValue === 4) {
                loadBatches();
            }
        }
    }, [activeWarehouse, tabValue]);

    useEffect(() => {
        if (activeWarehouse && tabValue === 0) {
            loadOutboundList();
        }
    }, [activeWarehouse, page, limit, searchFilter, sourceFilter, customerFilter, startDateFilter, endDateFilter, batchFilter, brandFilter, categoryFilter]);

    // ====== LOAD EXISTING OUTBOUND WSNs ======
    const loadExistingWSNs = async () => {
        if (!activeWarehouse) return;
        try {
            const res = await outboundAPI.getExistingWSNs(activeWarehouse.id);
            const wsnSet = new Set<string>(res.data.map((w: string) => w.toUpperCase()));
            setExistingOutboundWSNs(wsnSet);
        } catch (err: any) {
            console.error('Failed to load existing WSNs');
        }
    };

    // ====== LOAD CUSTOMERS ======
    const loadCustomers = async () => {
        try {
            console.log('Loading customers for warehouse:', activeWarehouse?.id);
            const response = await outboundAPI.getCustomers(activeWarehouse?.id);
            console.log('Customers API response:', response.data);
            if (Array.isArray(response.data)) {
                setCustomers(response.data);
                if (response.data.length === 0) {
                    console.warn('No customers found. Please add customers first.');
                }
            } else {
                console.error('Invalid response format:', response.data);
                setCustomers([]);
            }
        } catch (error: any) {
            console.error('Load customers error:', error);
            console.error('Error details:', error.response?.data);
            toast.error(error.response?.data?.error || 'Failed to load customers');
            setCustomers([]);
        }
    };

    // ====== LOAD BRANDS ======
    const loadBrands = async () => {
        try {
            const response = await outboundAPI.getBrands(activeWarehouse?.id);
            setBrands(response.data || []);
        } catch (error) {
            console.log('Brands error');
            setBrands([]);
        }
    };

    // ====== LOAD CATEGORIES ======
    const loadCategories = async () => {
        try {
            const response = await outboundAPI.getCategories(activeWarehouse?.id);
            setCategories(response.data || []);
        } catch (error) {
            console.log('Categories error');
            setCategories([]);
        }
    };

    useEffect(() => {
        if (activeWarehouse) {
            loadCustomers();
        }
    }, [activeWarehouse]);

    // ====== SINGLE ENTRY: FETCH SOURCE BY WSN ======
    const fetchSourceByWSN = async (wsn: string) => {
        if (!wsn.trim() || !activeWarehouse) return;

        setSingleLoading(true);
        setSourceData(null);
        setDuplicateWSN(null);
        setUpdateMode(false);

        try {
            const res = await outboundAPI.getSourceByWSN(wsn.trim(), activeWarehouse.id);
            setSourceData(res.data);
            toast.success('✓ Source data loaded');
        } catch (err: any) {
            console.error('Fetch source by WSN error:', err);
            if (err.response?.status === 409) {
                setDuplicateWSN(err.response.data);
                toast.error(err.response.data.error || 'WSN already dispatched');
            } else if (err.response?.status === 404) {
                toast.error('WSN not found in Picking, QC or Inbound');
            } else {
                toast.error(err.response?.data?.error || 'Failed to fetch source data');
            }
        } finally {
            setSingleLoading(false);
        }
    };

    const handleSingleWSNScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            fetchSourceByWSN(singleWSN);
        }
    };

    const handleSingleSubmit = async () => {
        if (!singleWSN.trim() || !activeWarehouse) {
            toast.error('WSN is required');
            return;
        }

        if (!singleForm.dispatch_date || !singleForm.customer_name) {
            toast.error('Dispatch date and customer name are required');
            return;
        }

        setSingleLoading(true);
        try {
            const payload = {
                wsn: singleWSN.trim(),
                ...singleForm,
                warehouse_id: activeWarehouse.id,
                update_existing: updateMode,
            };

            const res = await outboundAPI.createSingle(payload);

            if (res.data.action === 'updated') {
                toast.success('✓ Outbound entry updated');
            } else {
                toast.success('✓ Outbound entry created');
            }

            // Reset
            setSingleWSN('');
            setSourceData(null);
            setDuplicateWSN(null);
            setUpdateMode(false);
            setSingleForm({
                dispatch_date: new Date().toISOString().split('T')[0],
                customer_name: '',
                vehicle_no: '',
                dispatch_remarks: '',
                other_remarks: '',
            });

            setTimeout(() => wsnInputRef.current?.focus(), 100);
        } catch (err: any) {
            if (err.response?.status === 409 && err.response?.data?.canUpdate) {
                setDuplicateWSN(err.response.data);
                toast.error('Duplicate WSN. Enable "Update Existing" to modify.');
            } else {
                toast.error(err.response?.data?.error || 'Failed to create outbound');
            }
        } finally {
            setSingleLoading(false);
        }
    };

    const handleSingleReset = () => {
        setSingleWSN('');
        setSourceData(null);
        setDuplicateWSN(null);
        setUpdateMode(false);
        setSingleForm({
            dispatch_date: new Date().toISOString().split('T')[0],
            customer_name: '',
            vehicle_no: '',
            dispatch_remarks: '',
            other_remarks: '',
        });
        setTimeout(() => wsnInputRef.current?.focus(), 100);
    };

    // ✅ CHECK DUPLICATES IN GRID
    const checkDuplicates = useCallback(
        async (rows: any[]) => {
            const gridDup = new Set<string>();
            const crossWh = new Set<string>();
            const wsnCounts = new Map<string, number>();

            rows.forEach((row) => {
                const wsn = row.wsn?.trim()?.toUpperCase();
                if (!wsn) return;

                wsnCounts.set(wsn, (wsnCounts.get(wsn) || 0) + 1);
                if (wsnCounts.get(wsn)! > 1) {
                    gridDup.add(wsn);
                }

                if (existingOutboundWSNs.has(wsn)) {
                    crossWh.add(wsn);
                }
            });

            setGridDuplicateWSNs(gridDup);
            setCrossWarehouseWSNs(crossWh);
            setDuplicateWSNs(new Set([...Array.from(gridDup), ...Array.from(crossWh)]));
        },
        [existingOutboundWSNs]
    );

    // ✅ NAVIGATE TO NEXT CELL (AG GRID) - handles Enter and Arrow keys
    const navigateToNextCell = useCallback(
        (params: any) => {
            const { key, previousCellPosition, nextCellPosition, event } = params;

            // Tab / arrow keys default behaviour
            if (key !== 'Enter') {
                return nextCellPosition;
            }

            // Enter: same column, next/prev row
            const api = params.api;
            const column = previousCellPosition.column;
            const rowIndex = previousCellPosition.rowIndex;

            const goingUp = event && event.shiftKey;
            const newRowIndex = goingUp ? rowIndex - 1 : rowIndex + 1;

            if (newRowIndex < 0 || newRowIndex >= api.getDisplayedRowCount()) {
                return previousCellPosition;
            }

            return {
                rowIndex: newRowIndex,
                column,
                rowPinned: null,
            };
        },
        []
    );

    // ✅ AUTO-FETCH SOURCE DATA ON WSN CELL EDIT (MULTI ENTRY)
    const onCellValueChanged = useCallback(
        async (params: any) => {
            const field = params.column.getColId();
            const rowNode = params.node;
            const rowData = rowNode.data;

            if (field === 'wsn') {
                const wsn = rowData.wsn?.trim()?.toUpperCase();

                // WSN cleared -> clear all master data columns
                if (!wsn) {
                    rowNode.setDataValue('source', '');
                    rowNode.setDataValue('product_title', '');
                    rowNode.setDataValue('brand', '');
                    rowNode.setDataValue('cms_vertical', '');
                    rowNode.setDataValue('wid', '');
                    rowNode.setDataValue('fsn', '');
                    rowNode.setDataValue('order_id', '');
                    rowNode.setDataValue('fkqc_remark', '');
                    rowNode.setDataValue('fk_grade', '');
                    rowNode.setDataValue('hsn_sac', '');
                    rowNode.setDataValue('igst_rate', '');
                    rowNode.setDataValue('fsp', '');
                    rowNode.setDataValue('mrp', '');
                    rowNode.setDataValue('vrp', '');
                    rowNode.setDataValue('yield_value', '');
                    rowNode.setDataValue('invoice_date', '');
                    rowNode.setDataValue('fkt_link', '');
                    rowNode.setDataValue('wh_location', '');
                    rowNode.setDataValue('p_type', '');
                    rowNode.setDataValue('p_size', '');
                    rowNode.setDataValue('quantity', '');
                    return;
                }

                if (!activeWarehouse) return;

                try {
                    const res = await outboundAPI.getSourceByWSN(wsn, activeWarehouse.id);
                    const data = res.data;

                    // Set all product columns from API response
                    rowNode.setDataValue('source', data.source || '');
                    rowNode.setDataValue('product_title', data.product_title || '');
                    rowNode.setDataValue('brand', data.brand || '');
                    rowNode.setDataValue('cms_vertical', data.cms_vertical || '');
                    rowNode.setDataValue('wid', data.wid || '');
                    rowNode.setDataValue('fsn', data.fsn || '');
                    rowNode.setDataValue('order_id', data.order_id || '');
                    rowNode.setDataValue('fkqc_remark', data.fkqc_remark || '');
                    rowNode.setDataValue('fk_grade', data.fk_grade || '');
                    rowNode.setDataValue('hsn_sac', data.hsn_sac || '');
                    rowNode.setDataValue('igst_rate', data.igst_rate || '');
                    rowNode.setDataValue('fsp', data.fsp || '');
                    rowNode.setDataValue('mrp', data.mrp || '');
                    rowNode.setDataValue('vrp', data.vrp || '');
                    rowNode.setDataValue('yield_value', data.yield_value || '');
                    rowNode.setDataValue('invoice_date', data.invoice_date || '');
                    rowNode.setDataValue('fkt_link', data.fkt_link || '');
                    rowNode.setDataValue('wh_location', data.wh_location || '');
                    rowNode.setDataValue('p_type', data.p_type || '');
                    rowNode.setDataValue('p_size', data.p_size || '');
                    rowNode.setDataValue('quantity', data.quantity || '');

                    toast.success(`✓ Data loaded for ${wsn}`);
                } catch (err: any) {
                    if (err.response?.status === 409) {
                        toast.error(`${wsn} already dispatched`);
                    } else {
                        toast.error(`${wsn}: Not found`);
                    }
                }
            }

            const updatedRows: any[] = [];
            gridRef.current?.api.forEachNode((node: any) => {
                if (node.data) {
                    updatedRows.push(node.data);
                }
            });
            checkDuplicates(updatedRows);
        },
        [activeWarehouse, checkDuplicates]
    );

    // ✅ ROW STYLING (DUPLICATES)
    const getRowStyle = useCallback(
        (params: any) => {
            const wsn = params.data.wsn?.trim()?.toUpperCase();
            if (gridDuplicateWSNs.has(wsn) || crossWarehouseWSNs.has(wsn)) {
                return { background: '#ffebee' };
            }
            return undefined;
        },
        [gridDuplicateWSNs, crossWarehouseWSNs]
    );

    // ✅ MULTI ENTRY SUBMIT
    const handleMultiSubmit = async () => {
        if (!activeWarehouse) {
            toast.error('Please select a warehouse');
            return;
        }

        // Get customer from either selectedCustomer or commonCustomer
        const customerName = selectedCustomer || commonCustomer;

        // Validate common fields
        if (!commonDate || !customerName) {
            toast.error('Please enter dispatch date and customer name');
            return;
        }

        const rows: any[] = [];
        gridRef.current?.api.forEachNode((node: any) => {
            if (node.data) {
                rows.push(node.data);
            }
        });
        const filledRows = rows.filter((r: any) => r.wsn?.trim());

        if (filledRows.length === 0) {
            toast.error('No WSNs entered');
            return;
        }

        if (duplicateWSNs.size > 0) {
            toast.error('Remove duplicate WSNs before submitting');
            return;
        }

        setMultiLoading(true);
        setMultiResults([]);
        setMultiErrorMessage('');

        try {
            // Add common fields to each row
            const entriesWithCommonFields = filledRows.map((row: any) => ({
                ...row,
                dispatch_date: commonDate,
                customer_name: selectedCustomer || commonCustomer,
                vehicle_no: commonVehicle || '',
            }));

            const payload = {
                entries: entriesWithCommonFields,
                warehouse_id: activeWarehouse.id,
            };

            const res = await outboundAPI.multiEntry(payload);
            setMultiResults(res.data.results || []);

            toast.success(`✓ ${res.data.successCount}/${res.data.totalCount} entries created (Batch: ${res.data.batchId})`);

            // Reset grid and common fields
            setMultiRows(generateEmptyRows(10));
            setDuplicateWSNs(new Set());
            setGridDuplicateWSNs(new Set());
            setCrossWarehouseWSNs(new Set());
            setCommonDate(new Date().toISOString().split('T')[0]);
            setCommonCustomer('');
            setSelectedCustomer('');
            setCommonVehicle('');
            loadExistingWSNs();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Multi entry failed');
            setMultiErrorMessage(err.response?.data?.error || 'Failed to submit');
        } finally {
            setMultiLoading(false);
        }
    };

    // ✅ BULK UPLOAD
    const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setBulkFile(e.target.files[0]);
            setBulkProgress({ show: false, processed: 0, total: 0, successCount: 0, errorCount: 0, batchId: '' });
            setBulkErrors([]);
        }
    };

    const handleBulkUpload = async () => {
        if (!bulkFile || !activeWarehouse) {
            toast.error('Please select a file');
            return;
        }

        setBulkLoading(true);
        setBulkProgress({ show: false, processed: 0, total: 0, successCount: 0, errorCount: 0, batchId: '' });
        setBulkErrors([]);

        try {
            const formData = new FormData();
            formData.append('file', bulkFile);
            formData.append('warehouse_id', activeWarehouse.id.toString());

            const res = await outboundAPI.bulkUpload(formData);

            setBulkProgress({
                show: true,
                processed: res.data.totalRows,
                total: res.data.totalRows,
                successCount: res.data.successCount,
                errorCount: res.data.errorCount,
                batchId: res.data.batchId,
            });

            if (res.data.errors && res.data.errors.length > 0) {
                setBulkErrors(res.data.errors);
            }

            toast.success(`✓ Bulk upload completed: ${res.data.successCount}/${res.data.totalRows} success`);
            setBulkFile(null);
            loadExistingWSNs();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Bulk upload failed');
        } finally {
            setBulkLoading(false);
        }
    };

    const downloadBulkTemplate = () => {
        const template = [
            {
                WSN: 'ABC123',
                DISPATCH_DATE: '2025-12-19',
                CUSTOMER_NAME: 'Flipkart',
                VEHICLE_NO: 'MH01AB1234',
                DISPATCH_REMARKS: 'Good condition',
                OTHER_REMARKS: '',
            },
        ];

        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'outbound_bulk_template.xlsx');
        toast.success('✓ Template downloaded');
    };

    // ====== OUTBOUND LIST ======
    const loadOutboundList = async () => {
        if (!activeWarehouse) return;

        setListLoading(true);
        try {
            const res = await outboundAPI.getList({
                page,
                limit,
                warehouseId: activeWarehouse.id,
                search: searchFilter,
                source: sourceFilter,
                customer: customerFilter,
                startDate: startDateFilter,
                endDate: endDateFilter,
                batchId: batchFilter,
                brand: brandFilter,
                category: categoryFilter,
            });

            setListData(res.data.data || []);
            setTotal(res.data.total || 0);

            // Calculate stats
            const data = res.data.data || [];
            const pickingCount = data.filter((d: any) => d.source === 'PICKING').length;
            const qcCount = data.filter((d: any) => d.source === 'QC').length;
            const inboundCount = data.filter((d: any) => d.source === 'INBOUND').length;

            setStats({
                picking: pickingCount,
                qc: qcCount,
                inbound: inboundCount,
                total: data.length,
            });
        } catch (err: any) {
            console.error('Load outbound list error:', err);
            toast.error(err.response?.data?.error || 'Failed to load outbound list');
            setListData([]);
            setTotal(0);
        } finally {
            setListLoading(false);
        }
    };

    const handleListReset = () => {
        setSearchFilter('');
        setSourceFilter('');
        setCustomerFilter('');
        setStartDateFilter('');
        setEndDateFilter('');
        setBatchFilter('');
        setBrandFilter('');
        setCategoryFilter('');
        setPage(1);
    };

    const handleExportExcel = async () => {
        if (!activeWarehouse) return;

        try {
            const res = await outboundAPI.exportToExcel({
                warehouseId: activeWarehouse.id,
                source: exportSource || sourceFilter,
                customer: exportCustomer || customerFilter,
                startDate: exportStartDate || startDateFilter,
                endDate: exportEndDate || endDateFilter,
                batchId: exportBatchId || batchFilter,
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `outbound_export_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success('✓ Excel exported');
            setExportDialogOpen(false);
            setExportStartDate('');
            setExportEndDate('');
            setExportCustomer('');
            setExportBatchId('');
            setExportSource('');
        } catch (err: any) {
            console.error('Export error:', err);
            console.error('Error response:', err.response?.data);
            toast.error(err.response?.data?.error || 'Failed to export Excel');
        }
    };

    // ====== BATCH MANAGEMENT ======
    const loadBatches = async () => {
        if (!activeWarehouse) return;

        setBatchLoading(true);
        try {
            const res = await outboundAPI.getBatches(activeWarehouse.id);
            setBatches(res.data || []);
        } catch (err: any) {
            toast.error('Failed to load batches');
        } finally {
            setBatchLoading(false);
        }
    };

    const handleDeleteBatch = async (batchId: string) => {
        if (!confirm(`Delete batch ${batchId}?`)) return;

        try {
            await outboundAPI.deleteBatch(batchId);
            toast.success('✓ Batch deleted');
            loadBatches();
            loadExistingWSNs();
        } catch (err: any) {
            toast.error('Failed to delete batch');
        }
    };

    const handleViewBatch = (batchId: string) => {
        setBatchFilter(batchId);
        setTabValue(0);
    };

    // ✅ AG GRID COLUMN DEFINITIONS
    const columnDefs = useMemo(() => {
        const cols = visibleColumns.map((col) => {
            const isEditable = EDITABLE_COLUMNS.includes(col);

            return {
                field: col,
                headerName: col.replace(/_/g, ' ').toUpperCase(),
                editable: isEditable,
                width: col === 'wsn' ? 180 : col === 'dispatch_date' ? 140 : 150,
                cellStyle: isEditable ? { backgroundColor: '#f9f9f9' } : undefined,
            };
        });

        return cols;
    }, [visibleColumns]);

    const defaultColDef = useMemo(
        () => ({
            sortable: false,
            filter: false,
            resizable: true,
            editable: (params: any) => {
                const field = params.colDef.field as string;
                const wsn = params.data?.wsn?.trim()?.toUpperCase();

                if (!wsn) return EDITABLE_COLUMNS.includes(field);

                // 🔴 Cross warehouse → nothing editable
                if (crossWarehouseWSNs.has(wsn)) return false;

                // 🟡 Duplicate → only WSN editable
                if (gridDuplicateWSNs.has(wsn)) {
                    return field === 'wsn';
                }

                return EDITABLE_COLUMNS.includes(field);
            },
        }),
        [gridDuplicateWSNs, crossWarehouseWSNs]
    );

    if (!user) {
        return <CircularProgress />;
    }

    if (!activeWarehouse) {
        return (
            <AppLayout>
                <Box sx={{ p: 3, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ p: 5, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 4, color: 'white', boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4)' }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>⚠️ No active warehouse selected.</Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>Please go to Settings → Warehouses to set one.</Typography>
                    </Box>
                </Box>
            </AppLayout>
        );
    }


    return (
        <AppLayout>
            <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#363636', color: '#fff', borderRadius: '10px', padding: '16px', fontWeight: 600 }, success: { iconTheme: { primary: '#10b981', secondary: '#fff' } }, error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } } }} />

            <Box sx={{
                p: { xs: 0.8, md: 1 },
                background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)', minHeight: '100vh', width: '100%'
            }}>
                {/* HEADER */}
                <Box sx={{ mb: 0.8, p: 0.8, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 1, boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)' }}>
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', mb: 0.2, fontSize: '0.85rem' }}>📦 Outbound Management</Typography>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Chip label={activeWarehouse.name} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, height: '18px', fontSize: '0.65rem' }} />
                            <Chip label={user?.full_name} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 500, height: '18px', fontSize: '0.65rem' }} />
                        </Stack>
                    </Box>
                </Box>

                {/* TABS */}
                <Paper sx={{ mb: 0.5, borderRadius: 1, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', background: 'rgba(255, 255, 255, 0.95)' }}>
                    <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto" sx={{ '& .MuiTabs-indicator': { height: 3, background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)', borderRadius: '2px 2px 0 0' }, '& .MuiTab-root': { fontWeight: 600, fontSize: '0.7rem', textTransform: 'none', minHeight: 32, py: 0.5 } }}>
                        <Tab label="Outbound List" />
                        <Tab label="Single Entry" />
                        <Tab label="Bulk Upload" />
                        <Tab label="Multi Entry" />
                        <Tab label="Batch Management" />
                    </Tabs>
                </Paper>

                {/* TAB 0: OUTBOUND LIST */}
                {tabValue === 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
                        {/* FILTERS */}
                        <Card sx={{ mb: 0.5, borderRadius: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                <Stack spacing={0.5}>
                                    {/* ROW 1: Search + Dates */}
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.5} alignItems="center">
                                        <TextField size="small" placeholder="Search WSN, Product or Customer" value={searchFilter} onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }} fullWidth sx={{ '& .MuiOutlinedInput-root': { height: 36 } }} />
                                        <TextField label="From Date" type="date" size="small" InputLabelProps={{ shrink: true }} value={startDateFilter} onChange={(e) => { setStartDateFilter(e.target.value); setPage(1); }} sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { height: 36 } }} />
                                        <TextField label="To Date" type="date" size="small" InputLabelProps={{ shrink: true }} value={endDateFilter} onChange={(e) => { setEndDateFilter(e.target.value); setPage(1); }} sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { height: 36 } }} />
                                    </Stack>

                                    {/* ROW 2: Filters + Actions */}
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.5} alignItems="center">
                                        <TextField select size="small" label="Source" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }} sx={{ minWidth: 110, '& .MuiOutlinedInput-root': { height: 36 } }}>
                                            <MenuItem value="">All</MenuItem>
                                            <MenuItem value="PICKING">PICKING</MenuItem>
                                            <MenuItem value="QC">QC</MenuItem>
                                            <MenuItem value="INBOUND">INBOUND</MenuItem>
                                        </TextField>
                                        <Autocomplete
                                            freeSolo
                                            options={customers}
                                            value={customerFilter}
                                            onChange={(event, newValue) => { setCustomerFilter(newValue || ''); setPage(1); }}
                                            onInputChange={(event, newInputValue) => { setCustomerFilter(newInputValue); setPage(1); }}
                                            renderInput={(params) => (
                                                <TextField {...params} label="Customer" size="small" sx={{ minWidth: 120, '& .MuiOutlinedInput-root': { height: 36 } }} />
                                            )}
                                            sx={{ minWidth: 120 }}
                                            size="small"
                                        />
                                        <TextField
                                            select
                                            size="small"
                                            label="Brand"
                                            value={brandFilter}
                                            onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                                            sx={{ minWidth: 110, '& .MuiOutlinedInput-root': { height: 36 } }}
                                        >
                                            <MenuItem value="">All Brands</MenuItem>
                                            {brands.map((b) => (
                                                <MenuItem key={b} value={b}>{b}</MenuItem>
                                            ))}
                                        </TextField>
                                        <TextField
                                            select
                                            size="small"
                                            label="Category"
                                            value={categoryFilter}
                                            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                                            sx={{ minWidth: 110, '& .MuiOutlinedInput-root': { height: 36 } }}
                                        >
                                            <MenuItem value="">All Categories</MenuItem>
                                            {categories.map((c) => (
                                                <MenuItem key={c} value={c}>{c}</MenuItem>
                                            ))}
                                        </TextField>
                                        <TextField size="small" label="Batch ID" value={batchFilter} onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }} sx={{ minWidth: 110, '& .MuiOutlinedInput-root': { height: 36 } }} />

                                        {/* BUTTONS */}
                                        <Stack direction="row" spacing={0.5} sx={{ ml: 'auto' }}>
                                            <Button size="small" variant="outlined" onClick={handleListReset} sx={{ height: 36, fontSize: '0.7rem', fontWeight: 600, px: 1.5, minWidth: 'auto' }}>RESET</Button>
                                            <Button size="small" startIcon={<SettingsIcon sx={{ fontSize: 14 }} />} variant="outlined" onClick={() => setListColumnSettingsOpen(true)} sx={{ height: 36, fontSize: '0.7rem', fontWeight: 600, px: 1.5 }}>COLS</Button>
                                            <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 14 }} />} variant="contained" onClick={() => setExportDialogOpen(true)} sx={{ height: 36, fontSize: '0.7rem', fontWeight: 600, px: 1.5, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>EXPORT</Button>
                                            <Button size="small" startIcon={<RefreshIcon sx={{ fontSize: 14 }} />} variant="outlined" onClick={loadOutboundList} sx={{ height: 36, fontSize: '0.7rem', fontWeight: 600, px: 1.5, minWidth: 'auto' }}><RefreshIcon sx={{ fontSize: 16 }} /></Button>
                                        </Stack>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* STATS CARDS */}
                        <Stack direction="row" spacing={0.5} mb={0.5}>
                            <Card sx={{ flex: 1, borderRadius: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <CardContent sx={{ p: 0.8, '&:last-child': { pb: 0.8 } }}>
                                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.6rem' }}>TOTAL</Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '1.1rem' }}>{stats.total}</Typography>
                                </CardContent>
                            </Card>
                            <Card sx={{ flex: 1, borderRadius: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <CardContent sx={{ p: 0.8, '&:last-child': { pb: 0.8 } }}>
                                    <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.6rem' }}>PICKING</Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#3b82f6', fontSize: '1.1rem' }}>{stats.picking}</Typography>
                                </CardContent>
                            </Card>
                            <Card sx={{ flex: 1, borderRadius: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <CardContent sx={{ p: 0.8, '&:last-child': { pb: 0.8 } }}>
                                    <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600, fontSize: '0.6rem' }}>QC</Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#10b981', fontSize: '1.1rem' }}>{stats.qc}</Typography>
                                </CardContent>
                            </Card>
                            <Card sx={{ flex: 1, borderRadius: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <CardContent sx={{ p: 0.8, '&:last-child': { pb: 0.8 } }}>
                                    <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.6rem' }}>INBOUND</Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#f59e0b', fontSize: '1.1rem' }}>{stats.inbound}</Typography>
                                </CardContent>
                            </Card>
                        </Stack>

                        {/* TABLE - HORIZONTAL SCROLL */}
                        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, border: '1px solid #d1d5db', position: 'relative' }}>
                            <TableContainer component={Paper} sx={{ borderRadius: 0, boxShadow: 'none', border: 'none', background: '#ffffff', height: '100%' }}>
                                <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { borderRight: '1px solid #d1d5db', padding: '6px 10px', fontSize: '0.75rem', minWidth: 120 } }}>
                                    <TableHead>
                                        <TableRow sx={{ background: '#e5e7eb' }}>
                                            {listColumns.map((col: string, idx: any) => (
                                                <TableCell key={`header_${idx}_${col}`} sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap' }}>
                                                    {col.replace(/_/g, ' ')}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {listLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={listColumns.length} align="center" sx={{ py: 8 }}>
                                                    <CircularProgress size={50} />
                                                </TableCell>
                                            </TableRow>
                                        ) : listData.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={listColumns.length} align="center" sx={{ py: 8 }}>
                                                    <Typography sx={{ fontWeight: 700, color: '#94a3b8' }}>📭 No data found</Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            listData.map((item, idx) => (
                                                <TableRow key={`row_${item.id || idx}`} sx={{ bgcolor: idx % 2 === 0 ? '#ffffff' : '#f9fafb', '&:hover': { bgcolor: '#f0f0f0' } }}>
                                                    {listColumns.map((col: string, colIdx: any) => (
                                                        <TableCell key={`cell_${idx}_${colIdx}_${col}`} sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {col.includes('date')
                                                                ? formatDate(item[col])
                                                                : col === 'source'
                                                                    ? <Chip label={item[col]} size="small" color={item[col] === 'PICKING' ? 'primary' : item[col] === 'QC' ? 'success' : 'warning'} sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }} />
                                                                    : (item[col] ? String(item[col]).substring(0, 50) : '-')}
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
                        <Paper sx={{ p: 1, mt: 1, borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', background: 'rgba(255, 255, 255, 0.98)' }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="caption" sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.7rem' }}>
                                    Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)} of {total}
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Button size="small" variant="outlined" disabled={page === 1} onClick={() => setPage(page - 1)} sx={{ minWidth: 60, height: 32, fontSize: '0.7rem', fontWeight: 600 }}>PREV</Button>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569', fontSize: '0.75rem' }}>Page {page} of {Math.ceil(total / limit) || 1}</Typography>
                                    <Button size="small" variant="outlined" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)} sx={{ minWidth: 60, height: 32, fontSize: '0.7rem', fontWeight: 600 }}>NEXT</Button>
                                </Stack>
                            </Stack>
                        </Paper>

                        {/* List Column Settings Dialog */}
                        <Dialog open={listColumnSettingsOpen} onClose={() => setListColumnSettingsOpen(false)} maxWidth="sm" fullWidth>
                            <DialogTitle>Select List Columns</DialogTitle>
                            <DialogContent>
                                {ALL_LIST_COLUMNS.map((col) => (
                                    <FormControlLabel
                                        key={col}
                                        control={
                                            <Checkbox
                                                checked={listColumns.includes(col)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        saveListColumnSettings([...listColumns, col]);
                                                    } else {
                                                        saveListColumnSettings(listColumns.filter((c: string) => c !== col));
                                                    }
                                                }}
                                            />
                                        }
                                        label={col.replace(/_/g, ' ').toUpperCase()}
                                    />
                                ))}
                            </DialogContent>
                            <DialogActions>
                                <Button
                                    onClick={() => {
                                        saveListColumnSettings(ALL_LIST_COLUMNS);
                                        toast.success('✓ All columns selected');
                                    }}
                                    color="primary"
                                    variant="outlined"
                                >
                                    Select All
                                </Button>
                                <Button onClick={() => setListColumnSettingsOpen(false)}>Close</Button>
                            </DialogActions>
                        </Dialog>

                        {/* Export Dialog */}
                        <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
                            <DialogTitle>Export to Excel</DialogTitle>
                            <DialogContent>
                                <Stack spacing={2} sx={{ mt: 1 }}>
                                    <TextField
                                        label="Start Date"
                                        type="date"
                                        value={exportStartDate}
                                        onChange={(e) => setExportStartDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        fullWidth
                                        size="small"
                                    />
                                    <TextField
                                        label="End Date"
                                        type="date"
                                        value={exportEndDate}
                                        onChange={(e) => setExportEndDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        fullWidth
                                        size="small"
                                    />
                                    <Autocomplete
                                        freeSolo
                                        options={customers}
                                        value={exportCustomer}
                                        onChange={(event, newValue) => setExportCustomer(newValue || '')}
                                        onInputChange={(event, newInputValue) => setExportCustomer(newInputValue)}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Customer"
                                                placeholder="Select or type customer name..."
                                                size="small"
                                            />
                                        )}
                                        noOptionsText={customers.length === 0 ? "No customers available" : "No matching customers"}
                                    />
                                    <TextField
                                        label="Batch ID"
                                        value={exportBatchId}
                                        onChange={(e) => setExportBatchId(e.target.value)}
                                        fullWidth
                                        size="small"
                                    />
                                    <TextField
                                        select
                                        label="Source"
                                        value={exportSource}
                                        onChange={(e) => setExportSource(e.target.value)}
                                        fullWidth
                                        size="small"
                                    >
                                        <MenuItem value="">All Sources</MenuItem>
                                        <MenuItem value="PICKING">PICKING</MenuItem>
                                        <MenuItem value="QC">QC</MenuItem>
                                        <MenuItem value="INBOUND">INBOUND</MenuItem>
                                    </TextField>
                                    <Typography variant="caption" color="text.secondary">
                                        Leave empty to use current list filters
                                    </Typography>
                                </Stack>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleExportExcel} variant="contained" startIcon={<DownloadIcon />}>
                                    Export
                                </Button>
                            </DialogActions>
                        </Dialog>
                    </Box>
                )}

                {/* ====== TAB 1: SINGLE ENTRY ====== */}
                {tabValue === 1 && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
                        <Card sx={{ borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#1a237e', fontSize: '0.9rem' }}>📝 Dispatch Entry Form</Typography>
                                <Stack spacing={1.5}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="WSN *"
                                        value={singleWSN}
                                        onChange={(e) => setSingleWSN(e.target.value.toUpperCase())}
                                        onKeyDown={handleSingleWSNScan}
                                        placeholder="Scan or enter WSN"
                                        inputRef={wsnInputRef}
                                        autoFocus
                                    />

                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Dispatch Date *"
                                        type="date"
                                        InputLabelProps={{ shrink: true }}
                                        value={singleForm.dispatch_date}
                                        onChange={(e) => setSingleForm({ ...singleForm, dispatch_date: e.target.value })}
                                    />

                                    <FormControl fullWidth size="small">
                                        <InputLabel>Customer Name *</InputLabel>
                                        <Select
                                            value={singleForm.customer_name}
                                            onChange={(e) => setSingleForm({ ...singleForm, customer_name: e.target.value })}
                                            label="Customer Name *"
                                        >
                                            <MenuItem value="">Select Customer</MenuItem>
                                            {customers.length === 0 ? (
                                                <MenuItem disabled value="">
                                                    No customers available. Please add customers first.
                                                </MenuItem>
                                            ) : (
                                                customers.map((c) => (
                                                    <MenuItem key={c} value={c}>{c}</MenuItem>
                                                ))
                                            )}
                                        </Select>
                                    </FormControl>

                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Vehicle Number"
                                        value={singleForm.vehicle_no}
                                        onChange={(e) => setSingleForm({ ...singleForm, vehicle_no: e.target.value.toUpperCase() })}
                                        placeholder="e.g., MH01AB1234"
                                    />

                                    <TextField
                                        fullWidth
                                        size="small"
                                        multiline
                                        rows={2}
                                        label="Dispatch Remarks"
                                        value={singleForm.dispatch_remarks}
                                        onChange={(e) => setSingleForm({ ...singleForm, dispatch_remarks: e.target.value })}
                                    />

                                    <TextField
                                        fullWidth
                                        size="small"
                                        multiline
                                        rows={2}
                                        label="Other Remarks"
                                        value={singleForm.other_remarks}
                                        onChange={(e) => setSingleForm({ ...singleForm, other_remarks: e.target.value })}
                                    />

                                    {duplicateWSN && (
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={updateMode}
                                                    onChange={(e) => setUpdateMode(e.target.checked)}
                                                    color="warning"
                                                />
                                            }
                                            label="Update Existing Entry"
                                        />
                                    )}

                                    <Stack direction="row" spacing={1}>
                                        <Button
                                            fullWidth
                                            variant="contained"
                                            size="small"
                                            onClick={handleSingleSubmit}
                                            disabled={singleLoading}
                                            sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', py: 1 }}
                                        >
                                            {singleLoading ? <CircularProgress size={20} /> : '✓ Dispatch'}
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={handleSingleReset}
                                            sx={{ py: 1 }}
                                        >
                                            Reset
                                        </Button>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>

                        {sourceData && (
                            <Card sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', border: '2px solid #10b981' }}>
                                <CardContent sx={{ p: 2 }}>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                                        <CheckCircle sx={{ color: '#10b981', fontSize: 28 }} />
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#065f46', fontSize: '0.95rem' }}>Source Data Found</Typography>
                                    </Stack>
                                    <Divider sx={{ mb: 1.5, borderColor: 'rgba(5, 150, 105, 0.3)' }} />
                                    <Stack spacing={1.5}>
                                        <Box>
                                            <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>SOURCE</Typography>
                                            <Box sx={{ mt: 0.5 }}>
                                                <Chip label={sourceData.source} size="small" color={sourceData.source === 'PICKING' ? 'primary' : sourceData.source === 'QC' ? 'success' : 'warning'} sx={{ fontWeight: 700 }} />
                                            </Box>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>PRODUCT</Typography>
                                            <Typography sx={{ fontWeight: 600, color: '#047857', fontSize: '0.85rem' }}>{sourceData.product_title || 'N/A'}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                                            <Box>
                                                <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>BRAND</Typography>
                                                <Typography sx={{ fontWeight: 700, color: '#047857' }}>{sourceData.brand || 'N/A'}</Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>CATEGORY</Typography>
                                                <Typography sx={{ fontWeight: 700, color: '#047857' }}>{sourceData.cms_vertical || 'N/A'}</Typography>
                                            </Box>
                                        </Box>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                                            <Box>
                                                <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>MRP</Typography>
                                                <Typography sx={{ fontWeight: 700, color: '#047857' }}>₹{sourceData.mrp || 'N/A'}</Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>FSP</Typography>
                                                <Typography sx={{ fontWeight: 700, color: '#047857' }}>₹{sourceData.fsp || 'N/A'}</Typography>
                                            </Box>
                                        </Box>
                                        {sourceData.fkt_link && (
                                            <Box>
                                                <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>PRODUCT LINK</Typography>
                                                <Box sx={{ mt: 0.5 }}>
                                                    <a
                                                        href={sourceData.fkt_link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            color: '#0ea5e9',
                                                            textDecoration: 'underline',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        View Product →
                                                    </a>
                                                </Box>
                                            </Box>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>
                        )}

                        {duplicateWSN && (
                            <Card sx={{ gridColumn: '1 / -1', borderRadius: 2, background: '#fff3cd', border: '2px solid #ffc107' }}>
                                <CardContent>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#856404', mb: 1 }}>⚠️ Duplicate WSN Detected</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        This WSN is already dispatched. Enable "Update Existing Entry" checkbox to modify.
                                    </Typography>
                                </CardContent>
                            </Card>
                        )}
                    </Box>
                )}

                {/* ====== TAB 2: BULK UPLOAD ====== */}
                {tabValue === 2 && (
                    <Box>
                        <Card sx={{ maxWidth: 700, mx: 'auto', borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#1a237e', fontSize: '0.9rem' }}>📤 Bulk Upload (Excel)</Typography>
                                <Stack spacing={2}>
                                    <Button
                                        variant="outlined"
                                        onClick={downloadBulkTemplate}
                                        startIcon={<DownloadIcon sx={{ fontSize: 18 }} />}
                                        size="small"
                                        sx={{ height: 40, fontSize: '0.8rem', fontWeight: 600 }}
                                    >
                                        DOWNLOAD TEMPLATE
                                    </Button>

                                    <input type="file" accept=".xlsx,.xls" onChange={handleBulkFileChange} style={{ display: 'none' }} id="bulk-file-input" />
                                    <label htmlFor="bulk-file-input">
                                        <Button
                                            variant="outlined"
                                            component="span"
                                            startIcon={<UploadIcon sx={{ fontSize: 18 }} />}
                                            size="small"
                                            fullWidth
                                            sx={{ height: 40, fontSize: '0.8rem', fontWeight: 600 }}
                                        >
                                            SELECT EXCEL FILE
                                        </Button>
                                    </label>

                                    {bulkFile && (
                                        <Box sx={{ p: 1.5, bgcolor: '#f0f9ff', borderRadius: 1, border: '1px solid #bae6fd' }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0369a1' }}>📄 {bulkFile.name}</Typography>
                                        </Box>
                                    )}

                                    <Button
                                        variant="contained"
                                        onClick={handleBulkUpload}
                                        disabled={!bulkFile || bulkLoading || !activeWarehouse}
                                        startIcon={bulkLoading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <UploadIcon sx={{ fontSize: 18 }} />}
                                        size="small"
                                        sx={{ height: 40, fontSize: '0.8rem', fontWeight: 600, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                                    >
                                        UPLOAD & PROCESS
                                    </Button>

                                    {bulkProgress.show && (
                                        <Card sx={{ borderRadius: 1.5, border: '2px solid #e5e7eb', bgcolor: '#f9fafb' }}>
                                            <CardContent sx={{ p: 2 }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#1f2937', fontSize: '0.85rem' }}>📊 Upload Result</Typography>
                                                <Stack spacing={1}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Batch ID:</Typography>
                                                        <Chip label={bulkProgress.batchId} size="small" sx={{ fontWeight: 700, bgcolor: '#dbeafe', color: '#1e40af' }} />
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Total Rows:</Typography>
                                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{bulkProgress.total}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#10b981' }}>Success:</Typography>
                                                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#10b981' }}>{bulkProgress.successCount}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#ef4444' }}>Errors:</Typography>
                                                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#ef4444' }}>{bulkProgress.errorCount}</Typography>
                                                    </Box>

                                                    {bulkErrors.length > 0 && (
                                                        <Button
                                                            size="small"
                                                            onClick={() => setBulkErrorsOpen(true)}
                                                            color="error"
                                                            variant="outlined"
                                                            sx={{ mt: 1, fontSize: '0.75rem', fontWeight: 600 }}
                                                        >
                                                            VIEW ERRORS ({bulkErrors.length})
                                                        </Button>
                                                    )}
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* Bulk Errors Dialog */}
                        <Dialog open={bulkErrorsOpen} onClose={() => setBulkErrorsOpen(false)} maxWidth="md" fullWidth>
                            <DialogTitle>Bulk Upload Errors</DialogTitle>
                            <DialogContent>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>WSN</TableCell>
                                                <TableCell>Error</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {bulkErrors.map((err, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{err.wsn || 'N/A'}</TableCell>
                                                    <TableCell>{err.error}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setBulkErrorsOpen(false)}>Close</Button>
                            </DialogActions>
                        </Dialog>
                    </Box>
                )}

                {/* ====== TAB 3: MULTI ENTRY (AG GRID) ====== */}
                {tabValue === 3 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
                        {/* HEADER */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a237e', fontSize: '0.9rem' }}>📊 Multi Entry (AG Grid)</Typography>
                            <Stack direction="row" spacing={1}>
                                <Button
                                    size="small"
                                    onClick={() => {
                                        const newRows = generateEmptyRows(5);
                                        setMultiRows([...multiRows, ...newRows]);
                                    }}
                                    startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                                    variant="outlined"
                                    sx={{ height: 32, fontSize: '0.7rem', fontWeight: 600, px: 1.5 }}
                                >
                                    ADD ROWS
                                </Button>
                                <Button
                                    size="small"
                                    onClick={() => setColumnSettingsOpen(true)}
                                    startIcon={<SettingsIcon sx={{ fontSize: 16 }} />}
                                    variant="outlined"
                                    sx={{ height: 32, fontSize: '0.7rem', fontWeight: 600, px: 1.5 }}
                                >
                                    COLUMNS
                                </Button>
                            </Stack>
                        </Stack>

                        {/* Common Fields */}
                        <Card sx={{ mb: 0.5, borderRadius: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center">
                                    <TextField
                                        label="Dispatch Date *"
                                        type="date"
                                        value={commonDate}
                                        onChange={(e) => setCommonDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        size="small"
                                        required
                                        sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 36 } }}
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
                                                label="Customer Name *"
                                                placeholder="Type or select..."
                                                size="small"
                                                sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { height: 36 } }}
                                            />
                                        )}
                                        noOptionsText={customers.length === 0 ? "No customers available. Please add customers first." : "No matching customers"}
                                        sx={{ minWidth: 200 }}
                                    />
                                    <TextField
                                        label="Vehicle Number"
                                        value={commonVehicle}
                                        onChange={(e) => setCommonVehicle(e.target.value.toUpperCase())}
                                        size="small"
                                        placeholder="Optional"
                                        sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 36 } }}
                                    />
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* Duplicate Warning */}
                        {(gridDuplicateWSNs.size > 0 || crossWarehouseWSNs.size > 0) && (
                            <Alert severity="error" sx={{ mb: 0.5, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600 }}>
                                {gridDuplicateWSNs.size > 0 && `Duplicate WSNs: ${Array.from(gridDuplicateWSNs).join(', ')}. `}
                                {crossWarehouseWSNs.size > 0 && `Already dispatched: ${Array.from(crossWarehouseWSNs).join(', ')}`}
                            </Alert>
                        )}

                        {multiErrorMessage && (
                            <Alert severity="error" sx={{ mb: 0.5, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600 }} onClose={() => setMultiErrorMessage('')}>
                                {multiErrorMessage}
                            </Alert>
                        )}

                        {/* AG Grid */}
                        <Box className="ag-theme-quartz" sx={{ flex: 1, minHeight: 0, borderRadius: 1.5, overflow: 'hidden', border: '1px solid #d1d5db' }}>
                            <AgGridReact
                                ref={gridRef}
                                rowData={multiRows}
                                columnDefs={columnDefs}
                                rowHeight={26}
                                defaultColDef={defaultColDef}
                                onCellValueChanged={onCellValueChanged}
                                getRowStyle={getRowStyle}
                                navigateToNextCell={navigateToNextCell}
                                singleClickEdit={true}
                                stopEditingWhenCellsLoseFocus={true}
                                enterNavigatesVertically={true}
                                enterNavigatesVerticallyAfterEdit={true}
                                ensureDomOrder={true}
                                suppressRowClickSelection={true}
                                suppressMovableColumns={true}
                                rowBuffer={5}
                                theme="legacy"
                                containerStyle={{ height: '100%', width: '100%' }}
                                className="ag-theme-quartz"
                            />
                        </Box>

                        <Stack direction="row" spacing={1} mt={1} alignItems="center">
                            <Button
                                variant="contained"
                                onClick={handleMultiSubmit}
                                disabled={multiLoading || !activeWarehouse || duplicateWSNs.size > 0}
                                startIcon={multiLoading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <CheckCircle sx={{ fontSize: 18 }} />}
                                sx={{ height: 40, fontSize: '0.75rem', fontWeight: 600, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                            >
                                SUBMIT ALL ({multiRows.filter((r) => r.wsn?.trim()).length} rows)
                            </Button>

                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setMultiRows(generateEmptyRows(10));
                                    setDuplicateWSNs(new Set());
                                    setGridDuplicateWSNs(new Set());
                                    setCrossWarehouseWSNs(new Set());
                                    setMultiResults([]);
                                    setMultiErrorMessage('');
                                }}
                                sx={{ height: 40, fontSize: '0.75rem', fontWeight: 600 }}
                            >
                                RESET GRID
                            </Button>
                        </Stack>

                        {multiResults.length > 0 && (
                            <Box mt={1}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, fontSize: '0.8rem' }}>Results:</Typography>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                                    {multiResults.map((r: any, i: number) => (
                                        <Chip key={i} label={`${r.wsn}: ${r.status}`} color={r.status === 'SUCCESS' ? 'success' : 'error'} size="small" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                                    ))}
                                </Stack>
                            </Box>
                        )}

                        {/* Column Settings Dialog */}
                        <Dialog open={columnSettingsOpen} onClose={() => setColumnSettingsOpen(false)} maxWidth="sm" fullWidth>
                            <DialogTitle>Select Visible Columns</DialogTitle>
                            <DialogContent>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                                    Editable: {EDITABLE_COLUMNS.join(', ')}
                                </Typography>
                                {ALL_MULTI_COLUMNS.map((col) => (
                                    <FormControlLabel
                                        key={col}
                                        control={
                                            <Checkbox
                                                checked={visibleColumns.includes(col)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        saveColumnSettings([...visibleColumns, col]);
                                                    } else {
                                                        saveColumnSettings(visibleColumns.filter((c) => c !== col));
                                                    }
                                                }}
                                            />
                                        }
                                        label={col.replace(/_/g, ' ').toUpperCase()}
                                    />
                                ))}
                            </DialogContent>
                            <DialogActions>
                                <Button
                                    onClick={() => {
                                        saveColumnSettings(ALL_MULTI_COLUMNS);
                                        toast.success('✓ All columns selected');
                                    }}
                                    color="primary"
                                    variant="outlined"
                                >
                                    Select All
                                </Button>
                                <Button onClick={() => setColumnSettingsOpen(false)}>Close</Button>
                            </DialogActions>
                        </Dialog>
                    </Box>
                )}

                {/* ====== TAB 4: BATCH MANAGEMENT ====== */}
                {tabValue === 4 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 230px)' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a237e', fontSize: '0.9rem' }}>📦 Batch Management</Typography>
                            <Button
                                size="small"
                                onClick={loadBatches}
                                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                                variant="outlined"
                                sx={{ height: 36, fontSize: '0.75rem', fontWeight: 600 }}
                            >
                                REFRESH
                            </Button>
                        </Stack>

                        {batchLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                                <CircularProgress size={50} />
                            </Box>
                        ) : (
                            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, border: '1px solid #d1d5db', borderRadius: 1.5 }}>
                                <TableContainer component={Paper} sx={{ borderRadius: 0, boxShadow: 'none', border: 'none', background: '#ffffff', height: '100%' }}>
                                    <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { borderRight: '1px solid #d1d5db', padding: '8px 12px', fontSize: '0.8rem' } }}>
                                        <TableHead>
                                            <TableRow sx={{ background: '#e5e7eb' }}>
                                                <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.8rem', textTransform: 'uppercase', py: 1, whiteSpace: 'nowrap' }}>BATCH ID</TableCell>
                                                <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.8rem', textTransform: 'uppercase', py: 1, whiteSpace: 'nowrap' }}>COUNT</TableCell>
                                                <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.8rem', textTransform: 'uppercase', py: 1, whiteSpace: 'nowrap' }}>LAST UPDATED</TableCell>
                                                <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.8rem', textTransform: 'uppercase', py: 1, whiteSpace: 'nowrap' }}>ACTIONS</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {batches.map((batch, idx) => (
                                                <TableRow key={batch.batch_id} sx={{ bgcolor: idx % 2 === 0 ? '#ffffff' : '#f9fafb', '&:hover': { bgcolor: '#f0f0f0' } }}>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                        <Chip label={batch.batch_id} size="small" sx={{ fontWeight: 700, bgcolor: '#dbeafe', color: '#1e40af' }} />
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{batch.count}</TableCell>
                                                    <TableCell sx={{ fontWeight: 500, fontSize: '0.8rem' }}>{formatDate(batch.last_updated)}</TableCell>
                                                    <TableCell>
                                                        <Stack direction="row" spacing={0.5}>
                                                            <Button
                                                                size="small"
                                                                onClick={() => handleViewBatch(batch.batch_id)}
                                                                variant="outlined"
                                                                sx={{ height: 30, fontSize: '0.7rem', fontWeight: 600, minWidth: 60 }}
                                                            >
                                                                VIEW
                                                            </Button>
                                                            <Button
                                                                size="small"
                                                                color="error"
                                                                onClick={() => handleDeleteBatch(batch.batch_id)}
                                                                startIcon={<DeleteIcon sx={{ fontSize: 14 }} />}
                                                                variant="outlined"
                                                                sx={{ height: 30, fontSize: '0.7rem', fontWeight: 600 }}
                                                            >
                                                                DELETE
                                                            </Button>
                                                        </Stack>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        )}
                    </Box>
                )}
            </Box>
        </AppLayout>
    );
}
