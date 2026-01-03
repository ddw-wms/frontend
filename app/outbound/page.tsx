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
    Collapse,
    Tooltip,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    Download as DownloadIcon,
    Settings as SettingsIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
    CheckCircle,
    Upload as UploadIcon,
    ExpandMore as ExpandMoreIcon,
    FilterList as FilterListIcon,
} from '@mui/icons-material';
import { outboundAPI, customerAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
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
    const columnApiRef = useRef<any>(null);
    const wsnInputRef = useRef<HTMLInputElement>(null);
    const wsnFetchTimerRef = useRef<NodeJS.Timeout | null>(null);

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

    // Fast add 30 rows (used by Add +30 button) — use functional update for performance
    const add30Rows = () => {
        setMultiRows(prev => [...prev, ...generateEmptyRows(30)]);
    };

    const [multiRows, setMultiRows] = useState<OutboundItem[]>(generateEmptyRows(10));
    const [multiLoading, setMultiLoading] = useState(false);
    //   const [multiResults, setMultiResults] = useState<any[]>([]);
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
    // Template download confirmation
    const [confirmOpen, setConfirmOpen] = useState(false);

    // ====== OUTBOUND LIST STATE ======
    const [listData, setListData] = useState<OutboundItem[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshSuccess, setRefreshSuccess] = useState(false);
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

    // ====== RESPONSIVE FILTERS ======
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
    const [filteredBrands, setFilteredBrands] = useState<string[]>([]);

    const filtersActive = Boolean(
        (searchFilter && searchFilter.trim() !== '') ||
        (brandFilter && brandFilter !== '') ||
        (categoryFilter && categoryFilter !== '') ||
        (startDateFilter && startDateFilter !== '') ||
        (endDateFilter && endDateFilter !== '')
    );

    // Default: filters collapsed by default on Outbound List tab
    useEffect(() => {
        // Start collapsed on mount
        setFiltersExpanded(false);
    }, []);

    // Ensure filters are collapsed whenever user navigates to the Outbound List tab (tab index 0)
    useEffect(() => {
        if (tabValue === 0) {
            setFiltersExpanded(false);
        }
    }, [tabValue]);

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

    // Auto-size columns whenever Multi Entry tab opens, visibleColumns changes, or rows change
    useEffect(() => {
        if (tabValue !== 3) return;
        const colApi = columnApiRef.current;
        if (!colApi) return;

        setTimeout(() => {
            try {
                const allCols = colApi.getAllColumns().map((c: any) => c.getId());
                colApi.autoSizeColumns(allCols, false);
            } catch (err) {
                gridRef.current?.api.sizeColumnsToFit();
            }
        }, 80);
    }, [tabValue, visibleColumns, multiRows.length]);
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

    // Debounced auto-fetch for single WSN (mimic inbound behaviour)
    useEffect(() => {
        if (wsnFetchTimerRef.current) {
            clearTimeout(wsnFetchTimerRef.current);
            wsnFetchTimerRef.current = null;
        }

        if (!singleWSN || singleWSN.trim() === '') {
            setSourceData(null);
            setDuplicateWSN(null);
            return;
        }

        // Only auto-fetch after user stops typing for 500ms and WSN looks valid
        wsnFetchTimerRef.current = setTimeout(() => {
            const wsnUpper = singleWSN.trim().toUpperCase();
            autoFetchSource(wsnUpper);
        }, 500);

        return () => {
            if (wsnFetchTimerRef.current) {
                clearTimeout(wsnFetchTimerRef.current);
                wsnFetchTimerRef.current = null;
            }
        };
    }, [singleWSN, activeWarehouse]);

    const autoFetchSource = async (wsn: string) => {
        if (!wsn || wsn.length < 6) {
            setSourceData(null);
            return;
        }

        try {
            await fetchSourceByWSN(wsn, true);
        } catch (err) {
            // silent on auto fetch
            console.debug('Auto fetch error', err);
        }
    };

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
            // Use master customers table for dropdown (like Picking page)
            const response = await customerAPI.getNames(activeWarehouse?.id);
            if (Array.isArray(response.data)) {
                setCustomers(response.data);
                if (response.data.length === 0) {
                    console.warn('No customers found for this warehouse. Please add customers first.');
                }
            } else {
                console.error('Invalid response format from customerAPI:', response.data);
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

    // ====== FILTER DEPENDENCIES ======
    useEffect(() => {
        if (brandFilter) {
            const filtered = listData
                .filter(item => item.brand === brandFilter)
                .map(item => item.cms_vertical)
                .filter((v, i, a) => v && a.indexOf(v) === i);
            setFilteredCategories(filtered);
        } else {
            setFilteredCategories(categories);
        }
    }, [brandFilter, listData, categories]);

    useEffect(() => {
        if (categoryFilter) {
            const filtered = listData
                .filter(item => item.cms_vertical === categoryFilter)
                .map(item => item.brand)
                .filter((v, i, a) => v && a.indexOf(v) === i);
            setFilteredBrands(filtered);
        } else {
            setFilteredBrands(brands);
        }
    }, [categoryFilter, listData, brands]);

    // ====== SINGLE ENTRY: FETCH SOURCE BY WSN ======
    const fetchSourceByWSN = async (wsn: string, quiet = false) => {
        if (!wsn.trim() || !activeWarehouse) return;

        setSingleLoading(true);
        setSourceData(null);
        setDuplicateWSN(null);
        setUpdateMode(false);

        try {
            const res = await outboundAPI.getSourceByWSN(wsn.trim(), activeWarehouse.id);
            const data = res.data;
            setSourceData(data);
            // Auto-fill common single form fields when available
            setSingleForm((prev) => ({
                ...prev,
                customer_name: data.customer_name || prev.customer_name,
                vehicle_no: data.vehicle_no || data.inbound_vehicle_no || prev.vehicle_no,
            }));
            if (!quiet) toast.success('✓ Source data loaded');
        } catch (err: any) {
            console.error('Fetch source by WSN error:', err);
            if (err.response?.status === 409) {
                setDuplicateWSN(err.response.data);
                if (!quiet) toast.error(err.response.data.error || 'WSN already dispatched');
            } else if (err.response?.status === 404) {
                if (!quiet) toast.error('WSN not found in Picking, QC or Inbound');
            } else {
                if (!quiet) toast.error(err.response?.data?.error || 'Failed to fetch source data');
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

                // Build current grid snapshot
                const allRows: any[] = [];
                gridRef.current?.api.forEachNode((node: any) => { if (node.data) allRows.push(node.data); });

                // Immediate inline duplicate detection (grid duplicates)
                const counts = new Map<string, number>();
                allRows.forEach((r) => {
                    const val = r.wsn?.trim()?.toUpperCase();
                    if (val) counts.set(val, (counts.get(val) || 0) + 1);
                });

                const isGridDuplicateImmediate = (counts.get(wsn) || 0) > 1;

                if (isGridDuplicateImmediate) {
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

                    // Clear the cell and all master columns
                    rowNode.setDataValue('wsn', '');
                    ['source', 'product_title', 'brand', 'cms_vertical', 'wid', 'fsn', 'order_id', 'fkqc_remark', 'fk_grade', 'hsn_sac', 'igst_rate', 'fsp', 'mrp', 'vrp', 'yield_value', 'invoice_date', 'fkt_link', 'wh_location', 'p_type', 'p_size', 'quantity'].forEach(c => rowNode.setDataValue(c, ''));

                    // Update duplicates state & refocus
                    const updatedRows: any[] = [];
                    gridRef.current?.api.forEachNode((node: any) => { if (node.data) updatedRows.push(node.data); });
                    checkDuplicates(updatedRows);

                    setTimeout(() => {
                        params.api.startEditingCell({ rowIndex: params.rowIndex, colKey: 'wsn' });
                    }, 100);

                    return;
                }

                // Check existing outbound WSNs in this warehouse (same-warehouse duplicate)
                if (existingOutboundWSNs.has(wsn)) {
                    toast(`WSN ${wsn} already dispatched in this warehouse`, {
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

                    rowNode.setDataValue('wsn', '');
                    ['source', 'product_title', 'brand', 'cms_vertical', 'wid', 'fsn', 'order_id', 'fkqc_remark', 'fk_grade', 'hsn_sac', 'igst_rate', 'fsp', 'mrp', 'vrp', 'yield_value', 'invoice_date', 'fkt_link', 'wh_location', 'p_type', 'p_size', 'quantity'].forEach(c => rowNode.setDataValue(c, ''));

                    const updatedRows: any[] = [];
                    gridRef.current?.api.forEachNode((node: any) => { if (node.data) updatedRows.push(node.data); });
                    await checkDuplicates(updatedRows);

                    setTimeout(() => {
                        params.api.startEditingCell({ rowIndex: params.rowIndex, colKey: 'wsn' });
                    }, 100);

                    return;
                }

                // Cross-warehouse detection: if WSN exists anywhere but not in this warehouse
                try {
                    const allWsnsResp = await outboundAPI.getAllOutboundWSNs();
                    const allWsns: string[] = allWsnsResp.data.map((w: string) => w.toUpperCase());
                    if (allWsns.includes(wsn) && !existingOutboundWSNs.has(wsn)) {
                        toast.error(`WSN ${wsn} already dispatched in another warehouse`, {
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

                        rowNode.setDataValue('wsn', '');
                        ['source', 'product_title', 'brand', 'cms_vertical', 'wid', 'fsn', 'order_id', 'fkqc_remark', 'fk_grade', 'hsn_sac', 'igst_rate', 'fsp', 'mrp', 'vrp', 'yield_value', 'invoice_date', 'fkt_link', 'wh_location', 'p_type', 'p_size', 'quantity'].forEach(c => rowNode.setDataValue(c, ''));

                        const updatedRows: any[] = [];
                        gridRef.current?.api.forEachNode((node: any) => { if (node.data) updatedRows.push(node.data); });
                        await checkDuplicates(updatedRows);

                        setTimeout(() => {
                            params.api.startEditingCell({ rowIndex: params.rowIndex, colKey: 'wsn' });
                        }, 100);

                        return;
                    }
                } catch (err) {
                    // ignore remote lookup errors
                }

                // If we reach here, proceed to fetch source/master data
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
        [activeWarehouse, checkDuplicates, existingOutboundWSNs]
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
        setConfirmOpen(true);
    };

    //  Actual download after confirmation
    const handleConfirmDownload = () => {
        const template = [
            {
                WSN: 'ABC123',
                DISPATCHDATE: '2025-12-19',
                CUSTOMERNAME: 'Flipkart',
                VEHICLENO: 'MH01AB1234',
                DISPATCHREMARKS: 'Good condition',
                OTHERREMARKS: '',
            },
        ];
        // Using CSV export for templates to avoid client-side XLSX dependency
        import('../outbound/csv-export').then(({ exportJsonAsCsv }) => {
            exportJsonAsCsv('outbound_bulk_template.csv', template);
        });
        toast.success('Template downloaded (CSV)');
        setConfirmOpen(false);
    };

    // ====== OUTBOUND LIST ======
    const loadOutboundList = async (opts: { buttonRefresh?: boolean } = { buttonRefresh: false }) => {
        if (!activeWarehouse) return;

        const { buttonRefresh } = opts;
        if (buttonRefresh) setRefreshing(true);
        else setListLoading(true);

        try {
            const res = await outboundAPI.getList(page, limit, {
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

            if (buttonRefresh) {
                setRefreshSuccess(true);
                toast.success('List refreshed');
                setTimeout(() => setRefreshSuccess(false), 1800);
            }
        } catch (err: any) {
            console.error('Load outbound list error:', err);
            if (buttonRefresh) toast.error(err.response?.data?.error || 'Failed to refresh outbound list');
            else toast.error(err.response?.data?.error || 'Failed to load outbound list');
            setListData([]);
            setTotal(0);
        } finally {
            if (buttonRefresh) setRefreshing(false);
            else setListLoading(false);
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
        setFilteredBrands(brands);
        setFilteredCategories(categories);
        setPage(1);
        // Close filters on mobile to save space
        if (isMobile) setFiltersExpanded(false);
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
        // Serial column (Sr. No.) - pinned to left
        const srCol = {
            headerName: 'SR.NO',
            field: '__sr',
            valueGetter: (params: any) => params.node ? params.node.rowIndex + 1 : undefined,
            width: 80,
            cellStyle: { fontWeight: 700, textAlign: 'center', backgroundColor: '#fafafa' },
            suppressMovable: true,
            sortable: false,
            filter: false,
        };

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

        return [srCol, ...cols];
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


    ///////////////////////////////////////// UI RENDERING /////////////////////////////////////////
    return (
        <AppLayout>
            <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#363636', color: '#fff', borderRadius: '10px', padding: '16px', fontWeight: 600 }, success: { iconTheme: { primary: '#10b981', secondary: '#fff' } }, error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } } }} />

            <Box sx={{
                p: { xs: 0.8, md: 1 },
                background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)', minHeight: '100vh', width: '100%'
            }}>
                {/* HEADER */}
                <Box sx={{ mb: 0.8, p: 0.8, background: 'linear-gradient(  135deg, #0f2027 0%, #203a43 50%, #2c5364 100%  )', borderRadius: 1.5, boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)' }}>
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(110vh - 200px)' }}>
                        {/* SEARCH + FILTERS TOGGLE */}
                        <Box sx={{ mb: 0.5 }}>
                            <Stack direction={{ xs: 'row', md: 'row' }} spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                <TextField size="small" placeholder="🔍 Search by WSN, Product or Customer" value={searchFilter} onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }} sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { height: 36 } }} />

                                <Button
                                    variant="outlined"
                                    onClick={() => setFiltersExpanded(!filtersExpanded)}
                                    sx={{
                                        minWidth: { xs: 42, md: 120 },
                                        height: 36,

                                        borderWidth: 2,
                                        borderColor: filtersExpanded ? '#667eea' : '#cbd5e1',
                                        bgcolor: filtersExpanded ? 'rgba(102, 126, 234, 0.06)' : 'white',
                                        color: filtersExpanded ? '#667eea' : '#64748b',
                                        fontWeight: 700,
                                        fontSize: '0.68rem',
                                        borderRadius: 1.5,
                                        px: 1.25,
                                        position: 'relative'
                                    }}
                                >
                                    <FilterListIcon sx={{ mr: 0.5 }} />
                                    <Box component="span" sx={{ mr: 1 }}>{filtersExpanded ? 'Hide Filters' : 'Show Filters'}</Box>
                                    {filtersActive && (
                                        <Tooltip title="Filters active">
                                            <Box sx={{
                                                position: 'absolute',
                                                top: -6,
                                                right: -6,
                                                width: 14,
                                                height: 14,
                                                borderRadius: '50%',
                                                bgcolor: '#10b981',
                                                border: '2px solid white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, color: 'white' }}>●</Typography>
                                            </Box>
                                        </Tooltip>
                                    )}
                                    <ExpandMoreIcon sx={{ transform: filtersExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }} />
                                </Button>


                            </Stack>

                            <Collapse in={filtersExpanded} timeout="auto">
                                <Card sx={{ mb: 0.5, borderRadius: 1, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid #e2e8f0' }}>
                                    <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                        <Box sx={{ display: 'grid', gap: 1 }}>
                                            {/* DESKTOP LAYOUT - 2 Rows (unchanged) */}
                                            <Box sx={{ display: { xs: 'none', md: 'grid' }, gap: 1 }}>
                                                {/* ROW 1: Dates + Source + Customer */}
                                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                                                    <TextField label="From Date" type="date" size="small" InputLabelProps={{ shrink: true }} value={startDateFilter} onChange={(e) => { setStartDateFilter(e.target.value); setPage(1); }} sx={{ '& .MuiOutlinedInput-root': { height: 36 } }} />
                                                    <TextField label="To Date" type="date" size="small" InputLabelProps={{ shrink: true }} value={endDateFilter} onChange={(e) => { setEndDateFilter(e.target.value); setPage(1); }} sx={{ '& .MuiOutlinedInput-root': { height: 36 } }} />
                                                    <TextField select size="small" label="Source" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }} sx={{ '& .MuiOutlinedInput-root': { height: 36 } }}>
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
                                                            <TextField {...params} label="Customer" size="small" sx={{ '& .MuiOutlinedInput-root': { height: 36 } }} />
                                                        )}
                                                        size="small"
                                                        noOptionsText={customers.length === 0 ? "No customers available" : "No matching customers"}
                                                    />
                                                </Box>

                                                {/* ROW 2: Brand / Category / Batch / Actions */}
                                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, alignItems: 'center' }}>
                                                    <TextField select size="small" label="Brand" value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }} sx={{ '& .MuiOutlinedInput-root': { height: 36 } }}>
                                                        <MenuItem value="">All Brands</MenuItem>
                                                        {filteredBrands.length > 0 ? filteredBrands.map((b) => (
                                                            <MenuItem key={b} value={b}>{b}</MenuItem>
                                                        )) : brands.map((b) => (
                                                            <MenuItem key={b} value={b}>{b}</MenuItem>
                                                        ))}
                                                    </TextField>

                                                    <TextField select size="small" label="Category" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} sx={{ '& .MuiOutlinedInput-root': { height: 36 } }}>
                                                        <MenuItem value="">All Categories</MenuItem>
                                                        {filteredCategories.length > 0 ? filteredCategories.map((c) => (
                                                            <MenuItem key={c} value={c}>{c}</MenuItem>
                                                        )) : categories.map((c) => (
                                                            <MenuItem key={c} value={c}>{c}</MenuItem>
                                                        ))}
                                                    </TextField>

                                                    <TextField size="small" label="Batch ID" value={batchFilter} onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }} sx={{ '& .MuiOutlinedInput-root': { height: 36 } }} />

                                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ width: '100%' }}>
                                                        <Button size="small" variant="outlined" onClick={handleListReset} sx={{ height: 36, fontSize: '0.7rem', fontWeight: 600 }}>RESET</Button>
                                                        <Button size="small" startIcon={<SettingsIcon sx={{ fontSize: 14 }} />} variant="outlined" onClick={() => setListColumnSettingsOpen(true)} sx={{ height: 36, fontSize: '0.7rem', fontWeight: 600 }}>COLS</Button>
                                                        <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 14 }} />} variant="contained" onClick={() => setExportDialogOpen(true)} sx={{ height: 36, fontSize: '0.7rem', fontWeight: 600, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>EXPORT</Button>
                                                        <Button
                                                            size="small"
                                                            startIcon={refreshing ? <CircularProgress size={14} /> : (refreshSuccess ? <CheckCircle sx={{ color: 'success.main' }} /> : <RefreshIcon sx={{ fontSize: 14 }} />)}
                                                            variant="outlined"
                                                            onClick={() => loadOutboundList({ buttonRefresh: true })}
                                                            sx={{ height: 36, fontSize: '0.7rem', fontWeight: 600 }}
                                                            disabled={refreshing}
                                                        >
                                                            {refreshing ? 'Refreshing...' : (refreshSuccess ? 'Refreshed' : 'Refresh')}
                                                        </Button>
                                                    </Stack>
                                                </Box>
                                            </Box>

                                            {/* MOBILE LAYOUT - Exact 3 Rows */}
                                            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
                                                    {/* ROW 1: From Date, To Date, Source */}
                                                    <TextField
                                                        label="From Date"
                                                        type="date"
                                                        size="small"
                                                        fullWidth
                                                        InputLabelProps={{ shrink: true }}
                                                        value={startDateFilter}
                                                        onChange={(e) => { setStartDateFilter(e.target.value); setPage(1); }}
                                                        sx={{
                                                            minWidth: 0,
                                                            '& .MuiOutlinedInput-root': { height: 36 },
                                                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                                                            '& .MuiInputBase-input': { fontSize: '0.7rem' },
                                                        }}
                                                    />

                                                    <TextField
                                                        label="To Date"
                                                        type="date"
                                                        size="small"
                                                        fullWidth
                                                        InputLabelProps={{ shrink: true }}
                                                        value={endDateFilter}
                                                        onChange={(e) => { setEndDateFilter(e.target.value); setPage(1); }}
                                                        sx={{
                                                            minWidth: 0,
                                                            '& .MuiOutlinedInput-root': { height: 36 },
                                                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                                                            '& .MuiInputBase-input': { fontSize: '0.7rem' },
                                                        }}
                                                    />

                                                    <TextField
                                                        select
                                                        size="small"
                                                        fullWidth
                                                        label="Source"
                                                        value={sourceFilter}
                                                        onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                                                        sx={{
                                                            minWidth: 0,
                                                            '& .MuiOutlinedInput-root': { height: 36 },
                                                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                                                            '& .MuiInputBase-input': { fontSize: '0.7rem' },
                                                        }}
                                                    >
                                                        <MenuItem value="">All</MenuItem>
                                                        <MenuItem value="PICKING">PICKING</MenuItem>
                                                        <MenuItem value="QC">QC</MenuItem>
                                                        <MenuItem value="INBOUND">INBOUND</MenuItem>
                                                    </TextField>

                                                    {/* ROW 2: Customer, Brand, Category */}
                                                    <Autocomplete
                                                        freeSolo
                                                        options={customers}
                                                        value={customerFilter}
                                                        onChange={(event, newValue) => { setCustomerFilter(newValue || ''); setPage(1); }}
                                                        onInputChange={(event, newInputValue) => { setCustomerFilter(newInputValue); setPage(1); }}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                label="Customer"
                                                                size="small"
                                                                sx={{
                                                                    '& .MuiOutlinedInput-root': { height: 36 },
                                                                    '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                                                                    '& .MuiInputBase-input': { fontSize: '0.7rem' },
                                                                }}
                                                            />
                                                        )}
                                                        size="small"
                                                        noOptionsText={customers.length === 0 ? "No customers available" : "No matching customers"}
                                                        sx={{ minWidth: 0 }}
                                                    />

                                                    <TextField
                                                        select
                                                        size="small"
                                                        fullWidth
                                                        label="Brand"
                                                        value={brandFilter}
                                                        onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                                                        sx={{
                                                            minWidth: 0,
                                                            '& .MuiOutlinedInput-root': { height: 36 },
                                                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                                                            '& .MuiInputBase-input': { fontSize: '0.7rem' },
                                                        }}
                                                    >
                                                        <MenuItem value="">All Brands</MenuItem>
                                                        {filteredBrands.length > 0 ? filteredBrands.map((b) => (
                                                            <MenuItem key={b} value={b}>{b}</MenuItem>
                                                        )) : brands.map((b) => (
                                                            <MenuItem key={b} value={b}>{b}</MenuItem>
                                                        ))}
                                                    </TextField>

                                                    <TextField
                                                        select
                                                        size="small"
                                                        fullWidth
                                                        label="Category"
                                                        value={categoryFilter}
                                                        onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                                                        sx={{
                                                            minWidth: 0,
                                                            '& .MuiOutlinedInput-root': { height: 36 },
                                                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                                                            '& .MuiInputBase-input': { fontSize: '0.7rem' },
                                                        }}
                                                    >
                                                        <MenuItem value="">All Categories</MenuItem>
                                                        {filteredCategories.length > 0 ? filteredCategories.map((c) => (
                                                            <MenuItem key={c} value={c}>{c}</MenuItem>
                                                        )) : categories.map((c) => (
                                                            <MenuItem key={c} value={c}>{c}</MenuItem>
                                                        ))}
                                                    </TextField>
                                                </Box>

                                                {/* ROW 3: 4 Action Buttons */}
                                                <Box
                                                    sx={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(4, 1fr)',
                                                        gap: 0.5,
                                                        mt: 0.5,
                                                    }}
                                                >
                                                    {[
                                                        {
                                                            icon: '🧹',
                                                            label: 'Reset',
                                                            onClick: handleListReset,
                                                        },
                                                        {
                                                            icon: <SettingsIcon fontSize="small" />,
                                                            label: 'Columns',
                                                            onClick: () => setListColumnSettingsOpen(true),
                                                        },
                                                        {
                                                            icon: <DownloadIcon fontSize="small" />,
                                                            label: 'Export',
                                                            onClick: () => setExportDialogOpen(true),
                                                        },
                                                        {
                                                            icon: <RefreshIcon fontSize="small" />,
                                                            label: 'Refresh',
                                                            onClick: loadOutboundList,
                                                        },
                                                    ].map((btn, index) => (
                                                        <Button
                                                            key={index}
                                                            size="small"
                                                            variant="outlined"
                                                            onClick={() => btn.onClick?.()}
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
                                                                {btn.icon}
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
                                    </CardContent>
                                </Card>
                            </Collapse>

                        </Box>


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
                            <DialogTitle>⚙️ Column Settings</DialogTitle>
                            <DialogContent>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6b21a8', mb: 1 }}>EDITABLE FIELDS</Typography>
                                <Stack spacing={1} sx={{ mb: 2 }}>
                                    {EDITABLE_COLUMNS.map((col) => (
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
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6b21a8', mb: 1 }}>READ-ONLY MASTER DATA</Typography>
                                <Stack spacing={1} sx={{ mt: 1 }}>
                                    {ALL_LIST_COLUMNS.filter((col) => !EDITABLE_COLUMNS.includes(col)).map((col) => (
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
                                <Button onClick={() => setListColumnSettingsOpen(false)}>CLOSE</Button>
                                <Button onClick={() => setListColumnSettingsOpen(false)} variant="contained" sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}>DONE</Button>
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

                {/* TAB 2 - BULK UPLOAD */}
                {tabValue === 2 && (
                    <Box sx={{ p: { xs: 1, sm: 1.5, md: 2 } }}>
                        {/* ✅ REMOVE maxWidth - full width card */}
                        <Card sx={{ borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#1a237e', fontSize: '0.9rem' }}>
                                    📤 Bulk Upload
                                </Typography>

                                <Stack spacing={2}>
                                    {/* DOWNLOAD TEMPLATE BUTTON */}
                                    <Button
                                        variant="outlined"
                                        onClick={downloadBulkTemplate}
                                        startIcon={<DownloadIcon />}
                                        sx={{ py: 1.5 }}
                                    >
                                        📥 DOWNLOAD TEMPLATE
                                    </Button>

                                    {/* FILE UPLOAD BOX */}
                                    <Box
                                        sx={{
                                            border: '2px dashed #cbd5e1',
                                            borderRadius: 2,
                                            p: 4,
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            background: '#f8fafc',
                                            transition: 'all 0.3s',
                                            '&:hover': {
                                                borderColor: '#667eea',
                                                background: 'rgba(102, 126, 234, 0.05)',
                                            },
                                        }}
                                    >
                                        <input
                                            type="file"
                                            accept=".xlsx,.xls"
                                            onChange={handleBulkFileChange}
                                            style={{ display: 'none' }}
                                            id="bulk-file-outbound"
                                        />
                                        <label htmlFor="bulk-file-outbound" style={{ cursor: 'pointer', display: 'block' }}>
                                            <UploadIcon sx={{ fontSize: 48, color: '#667eea', mb: 1 }} />
                                            <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 0.5 }}>
                                                Click to upload file
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                                                {bulkFile?.name || 'No file selected'}
                                            </Typography>
                                        </label>
                                    </Box>

                                    {/* UPLOAD BUTTON */}
                                    <Button
                                        variant="contained"
                                        onClick={handleBulkUpload}
                                        disabled={!bulkFile || bulkLoading || !activeWarehouse}
                                        startIcon={bulkLoading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <UploadIcon />}
                                        fullWidth
                                        sx={{
                                            py: 1.5,
                                            fontSize: '0.85rem',
                                            fontWeight: 700,
                                            background: !bulkFile || bulkLoading ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            '&:hover': {
                                                background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                                            },
                                            '&.Mui-disabled': {
                                                background: '#9ca3af',
                                            },
                                        }}
                                    >
                                        {bulkLoading ? 'Processing...' : 'UPLOAD'}
                                    </Button>
                                </Stack>

                                {/* PROGRESS CARD */}
                                {bulkProgress.show && (
                                    <Card sx={{ mt: 2, borderRadius: 1.5, border: '2px solid #e5e7eb', bgcolor: '#f9fafb' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#1f2937', fontSize: '0.85rem' }}>
                                                Upload Result
                                            </Typography>
                                            <Stack spacing={1}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Batch ID</Typography>
                                                    <Chip label={bulkProgress.batchId} size="small" sx={{ fontWeight: 700, bgcolor: '#dbeafe', color: '#1e40af' }} />
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Total Rows</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{bulkProgress.total}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#10b981' }}>Success</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#10b981' }}>{bulkProgress.successCount}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#ef4444' }}>Errors</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#ef4444' }}>{bulkProgress.errorCount}</Typography>
                                                </Box>
                                                {bulkErrors.length > 0 && (
                                                    <Button size="small" onClick={() => setBulkErrorsOpen(true)} color="error" variant="outlined">
                                                        VIEW ERRORS ({bulkErrors.length})
                                                    </Button>
                                                )}
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                )}
                            </CardContent>
                        </Card>
                    </Box>
                )}

                {/* TEMPLATE DOWNLOAD CONFIRMATION DIALOG */}
                <Dialog
                    open={confirmOpen}
                    onClose={() => setConfirmOpen(false)}
                    maxWidth="xs"
                    fullWidth
                >
                    <DialogTitle sx={{ fontWeight: 700, color: '#1a237e' }}>
                        Confirm Download
                    </DialogTitle>
                    <DialogContent>
                        <Typography sx={{ color: '#334155', mb: 2 }}>
                            Would you like to proceed with downloading the outbound template?
                        </Typography>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleConfirmDownload}
                            sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                        >
                            Yes, Download
                        </Button>
                    </DialogActions>
                </Dialog>



                {/* ====== TAB 3: MULTI ENTRY (AG GRID) ====== */}
                {tabValue === 3 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>

                        {/* Common Fields */}
                        <Card sx={{ mb: 0.5, borderRadius: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                {isMobile ? (
                                    <Box sx={{ display: 'grid', gap: 1 }}>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                                            <TextField
                                                label="Dispatch Date *"
                                                type="date"
                                                value={commonDate}
                                                onChange={(e) => setCommonDate(e.target.value)}
                                                InputLabelProps={{ shrink: true }}
                                                size="small"
                                                required
                                                sx={{ '& .MuiOutlinedInput-root': { height: 36 } }}
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
                                                        sx={{ '& .MuiOutlinedInput-root': { height: 36 } }}
                                                    />
                                                )}
                                                noOptionsText={customers.length === 0 ? "No customers available. Please add customers first." : "No matching customers"}
                                            />
                                        </Box>

                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 1, alignItems: 'center' }}>
                                            <TextField
                                                label="Vehicle Number"
                                                value={commonVehicle}
                                                onChange={(e) => setCommonVehicle(e.target.value.toUpperCase())}
                                                size="small"
                                                placeholder="Optional"
                                                sx={{ '& .MuiOutlinedInput-root': { height: 36 } }}
                                            />


                                            <Button
                                                size="small"
                                                variant="contained"
                                                onClick={add30Rows}
                                                sx={{ height: 32, fontSize: '0.7rem', fontWeight: 600, background: '#ec4899' }}
                                            >
                                                +30 Add Rows
                                            </Button>

                                            <Button
                                                size="small"
                                                onClick={() => setColumnSettingsOpen(true)}
                                                startIcon={<SettingsIcon sx={{ fontSize: 16 }} />}
                                                variant="outlined"
                                                sx={{ height: 32, fontSize: '0.7rem', fontWeight: 600, px: 1 }}
                                            >
                                                COLS
                                            </Button>
                                        </Box>
                                    </Box>
                                ) : (
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


                                        <Button
                                            size="small"
                                            variant="contained"
                                            onClick={add30Rows}
                                            sx={{ height: 32, fontSize: '0.7rem', fontWeight: 600, background: '#ec4899' }}
                                        >
                                            +30 Add Rows
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
                                )}
                            </CardContent>
                        </Card>

                        {/* Duplicate Warning */}
                        {(gridDuplicateWSNs.size > 0 || crossWarehouseWSNs.size > 0) && (
                            <Alert severity="error" sx={{ mb: 0.5, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600 }}>
                                {gridDuplicateWSNs.size > 0 && `Duplicate WSNs: ${Array.from(gridDuplicateWSNs).join(', ')}. `}
                                {crossWarehouseWSNs.size > 0 && `Already dispatched: ${Array.from(crossWarehouseWSNs).join(', ')}`}
                            </Alert>
                        )}

                        {/* MULTI ENTRY: COLUMN SETTINGS DIALOG (match Inbound/QC) */}
                        <Dialog
                            open={columnSettingsOpen}
                            onClose={() => setColumnSettingsOpen(false)}
                            maxWidth="sm"
                            fullWidth
                            PaperProps={{ sx: { borderRadius: 2 } }}
                        >
                            <DialogTitle
                                sx={{
                                    fontWeight: 800,
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    py: 2,
                                }}
                            >
                                ⚙️ Columns View Settings
                            </DialogTitle>
                            <DialogContent sx={{ py: 3, maxHeight: 600, overflow: 'auto' }}>
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        mb: 2,
                                        fontWeight: 800,
                                        color: '#667eea',
                                        textTransform: 'uppercase',
                                        fontSize: '0.75rem',
                                    }}
                                >
                                    Editable Fields
                                </Typography>
                                <Stack spacing={1} sx={{ mb: 3 }}>
                                    {EDITABLE_COLUMNS.map((col, idx) => (
                                        <FormControlLabel
                                            key={`col_${idx}_${col}`}
                                            control={
                                                <Checkbox
                                                    checked={visibleColumns.includes(col)}
                                                    onChange={(e) => {
                                                        let next = visibleColumns;

                                                        if (e.target.checked) {
                                                            next = [...visibleColumns, col];
                                                        } else {
                                                            next = visibleColumns.filter((c) => c !== col);
                                                        }

                                                        const ordered = [...EDITABLE_COLUMNS, ...ALL_MULTI_COLUMNS].filter(
                                                            (c) => next.includes(c),
                                                        );

                                                        saveColumnSettings(ordered);
                                                    }}
                                                />
                                            }
                                            label={col.replace(/_/g, ' ').toUpperCase()}
                                        />
                                    ))}
                                </Stack>

                                <Divider sx={{ my: 2 }} />
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        mb: 2,
                                        fontWeight: 800,
                                        color: '#764ba2',
                                        textTransform: 'uppercase',
                                        fontSize: '0.75rem',
                                    }}
                                >
                                    Read-Only Master Data
                                </Typography>
                                <Stack spacing={1}>
                                    {ALL_MULTI_COLUMNS.filter((col) => !EDITABLE_COLUMNS.includes(col)).map((col, idx) => (
                                        <FormControlLabel
                                            key={`master_${idx}_${col}`}
                                            control={
                                                <Checkbox
                                                    checked={visibleColumns.includes(col)}
                                                    onChange={(e) => {
                                                        let next = visibleColumns;

                                                        if (e.target.checked) {
                                                            next = [...visibleColumns, col];
                                                        } else {
                                                            next = visibleColumns.filter((c) => c !== col);
                                                        }

                                                        const ordered = [...EDITABLE_COLUMNS, ...ALL_MULTI_COLUMNS].filter(
                                                            (c) => next.includes(c),
                                                        );

                                                        saveColumnSettings(ordered);
                                                    }}
                                                />
                                            }
                                            label={col.replace(/_/g, ' ').toUpperCase()}
                                        />
                                    ))}
                                </Stack>
                            </DialogContent>
                            <DialogActions sx={{ p: 2, background: '#f9fafb' }}>
                                <Button onClick={() => setColumnSettingsOpen(false)} sx={{ fontWeight: 700 }}>
                                    Close
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={() => setColumnSettingsOpen(false)}
                                    sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontWeight: 700 }}
                                >
                                    Done
                                </Button>
                            </DialogActions>
                        </Dialog>
                        {multiErrorMessage && (
                            <Alert severity="error" sx={{ mb: 0.5, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600 }} onClose={() => setMultiErrorMessage('')}>
                                {multiErrorMessage}
                            </Alert>
                        )}

                        {/* AG Grid */}
                        <Box className="ag-theme-quartz" sx={{
                            flex: 1,
                            minHeight: 0,
                            borderRadius: 0,
                            overflow: 'hidden',
                            border: '1px solid #cbd5e1',
                            '& .ag-root-wrapper': { borderRadius: 0 },
                            '& .ag-header': { borderBottom: '1px solid #cbd5e1' },
                            '& .ag-header-cell': { backgroundColor: '#e5e7eb', color: '#111827', fontWeight: 700, borderRight: '1px solid #d1d5db', fontSize: '11px', padding: '0 6px' },
                            '& .ag-cell': { borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontSize: '11px', padding: '2px 6px', display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
                            '& .ag-row': { height: 26, overflow: 'visible' },
                            '& .ag-row-even': { backgroundColor: '#ffffff' },
                            '& .ag-row-odd': { backgroundColor: '#f9fafb' },
                            '& .ag-cell-focus': { border: '2px solid #2563eb !important', boxSizing: 'border-box' },
                            '& .ag-cell-range-selected': { backgroundColor: '#dbeafe !important' },
                            '& .ag-cell-range-single-cell': { backgroundColor: '#eff6ff !important' },
                            '& .ag-row-hover': { backgroundColor: '#e5f3ff !important' },
                        }}>
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
                                containerStyle={{ height: '100%', width: '100%' }}
                                onGridReady={(params: any) => {
                                    columnApiRef.current = params.columnApi;
                                    // Small delay to make sure columns registered
                                    setTimeout(() => {
                                        const colApi = columnApiRef.current;
                                        if (!colApi) return;
                                        try {
                                            const allCols = colApi.getAllColumns().map((c: any) => c.getId());
                                            colApi.autoSizeColumns(allCols, false);
                                        } catch (err) {
                                            params.api.sizeColumnsToFit();
                                        }
                                    }, 50);
                                }}
                                onFirstDataRendered={() => {
                                    const colApi = columnApiRef.current;
                                    if (!colApi) return;
                                    try {
                                        const allCols = colApi.getAllColumns().map((c: any) => c.getId());
                                        colApi.autoSizeColumns(allCols, false);
                                    } catch (err) {
                                        gridRef.current?.api.sizeColumnsToFit();
                                    }
                                }}
                                onGridSizeChanged={() => {
                                    const colApi = columnApiRef.current;
                                    if (!colApi) return;
                                    try {
                                        const allCols = colApi.getAllColumns().map((c: any) => c.getId());
                                        colApi.autoSizeColumns(allCols, false);
                                    } catch (err) {
                                        gridRef.current?.api.sizeColumnsToFit();
                                    }
                                }}
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
                        </Stack>

                        {/* Column Settings Dialog */}
                        <Dialog open={columnSettingsOpen} onClose={() => setColumnSettingsOpen(false)} maxWidth="sm" fullWidth>
                            <DialogTitle>⚙️ Columns View Settings</DialogTitle>
                            <DialogContent>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                    Editable: {EDITABLE_COLUMNS.join(', ')}
                                </Typography>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6b21a8', mb: 1 }}>EDITABLE FIELDS</Typography>
                                <Stack spacing={1} sx={{ mb: 2 }}>
                                    {EDITABLE_COLUMNS.map((col) => (
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
                                </Stack>
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#6b21a8', mb: 1 }}>READ-ONLY MASTER DATA</Typography>
                                <Stack spacing={1} sx={{ mt: 1 }}>
                                    {ALL_MULTI_COLUMNS.filter((col) => !EDITABLE_COLUMNS.includes(col)).map((col) => (
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
                                </Stack>
                            </DialogContent>
                            <DialogActions sx={{ justifyContent: 'space-between' }}>
                                <Button onClick={() => setColumnSettingsOpen(false)}>CLOSE</Button>
                                <Button onClick={() => setColumnSettingsOpen(false)} variant="contained" sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}>DONE</Button>
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
        </AppLayout >
    );
}
