'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Box, Paper, Typography, Button, TextField, Chip, Stack, MenuItem,
    CircularProgress, Alert, IconButton, Tooltip, Dialog, DialogTitle,
    DialogContent, DialogActions, Drawer, Accordion, AccordionSummary,
    AccordionDetails, FormControlLabel, Checkbox, Switch, useMediaQuery, useTheme,
    Divider, InputAdornment, LinearProgress, Select, Pagination, Fade,
    Card, CardContent,
} from '@mui/material';
import {
    Delete as DeleteIcon, Refresh as RefreshIcon,
    Send as SendIcon, Settings as SettingsIcon,
    CheckCircle as CheckCircleIcon, ExpandMore as ExpandMoreIcon,
    Download as DownloadIcon,
    CloudUpload as UploadIcon, Search as SearchIcon,
    Close as CloseIcon, Save as SaveIcon, ClearAll as ClearAllIcon,
    FilterList as FilterListIcon,
    FileDownload as ExportIcon, QrCodeScanner as ScanIcon,
    Inventory2 as BoxIcon, Add as AddIcon,
    FirstPage, LastPage, KeyboardArrowLeft, KeyboardArrowRight,
} from '@mui/icons-material';
import { nlQcAPI, nlMasterDataAPI } from '@/lib/nl-api';
import { useNlGridSx, nlFormatDate } from '@/lib/nl-utils';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import { StandardPageHeader, StandardTabs } from '@/components';
import { useTableRowHeight } from '@/app/context/AppearanceContext';
import { usePagePermissions } from '@/hooks/usePagePermissions';
import BatchManagementTab from '@/components/BatchManagementTab';
import type { BatchData } from '@/components/BatchManagementTab';
import toast, { Toaster } from 'react-hot-toast';
import { AgGridReact } from '@/components/AGGridScrollWrapper';
import { ModuleRegistry, AllCommunityModule, ClientSideRowModelModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

const formatDate = nlFormatDate;

const ALL_TABS = ['QC Entry', 'QC List', 'Batches', 'Bulk Upload'];
const TAB_CODES = ['qc_entry', 'list', 'batches', 'bulk'];
const QC_GRADES = ['A', 'B', 'C', 'D'];
const GRADE_COLORS: Record<string, string> = { A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#ef4444' };

export default function NLQCPage() {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const { activeWarehouse } = useWarehouse();
    const [user, setUser] = useState<any>(null);
    const tableRowHeight = useTableRowHeight();
    const { filterTabs, canSeeTab, isAdmin } = usePagePermissions('nl_qc');

    const visibleTabs = useMemo(() => { const f = filterTabs(ALL_TABS, TAB_CODES); return f.length > 0 ? f : ALL_TABS; }, [filterTabs]);
    const visibleTabCodes = useMemo(() => { if (isAdmin) return TAB_CODES; const f = TAB_CODES.filter(c => canSeeTab(c)); return f.length > 0 ? f : TAB_CODES; }, [canSeeTab, isAdmin]);
    const [tabValue, setTabValue] = useState(0);
    const currentTabCode = visibleTabCodes[tabValue] || 'qc_entry';

    // ====== QC ENTRY STATE ======
    const [qcDate, setQcDate] = useState(new Date().toISOString().split('T')[0]);

    // Box scan
    const [boxIdInput, setBoxIdInput] = useState('');
    const [boxLoading, setBoxLoading] = useState(false);
    const [activeBox, setActiveBox] = useState<any>(null); // box data from lookup
    const boxInputRef = useRef<HTMLInputElement>(null);

    // Items being QC'd for the active box
    const [qcItems, setQcItems] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

    // RVP scan input
    const [wsnInput, setWsnInput] = useState('');
    const [wsnGrade, setWsnGrade] = useState<string>('A');
    const [wsnRemark, setWsnRemark] = useState('');
    const wsnInputRef = useRef<HTMLInputElement>(null);

    // RA entry input
    const [raWid, setRaWid] = useState('');
    const [raProductName, setRaProductName] = useState('');
    const [raQty, setRaQty] = useState<number | string>(1);
    const [raGrade, setRaGrade] = useState<string>('A');
    const [raRemark, setRaRemark] = useState('');
    const raWidInputRef = useRef<HTMLInputElement>(null);
    const [raWidLookupLoading, setRaWidLookupLoading] = useState(false);

    // Auto-lookup WID product details
    const lookupRaWid = useCallback(async (wid: string) => {
        const w = wid.trim().toUpperCase();
        if (!w || w.length < 2) return;
        try {
            setRaWidLookupLoading(true);
            const res = await nlMasterDataAPI.lookupWID(w);
            if (res.data?.data) {
                if (!raProductName) setRaProductName(res.data.data.product_title || '');
            }
        } catch { /* not found */ }
        finally { setRaWidLookupLoading(false); }
    }, [raProductName]);

    // Completed boxes history (within current session)
    const [completedBoxes, setCompletedBoxes] = useState<any[]>([]);

    // Draft
    const DRAFT_KEY = 'nl_qc_box_draft';
    const [draftLoaded, setDraftLoaded] = useState(false);

    // ====== QC LIST STATE ======
    const [listData, setListData] = useState<any[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [listSearch, setListSearch] = useState('');
    const [listDateFrom, setListDateFrom] = useState('');
    const [listDateTo, setListDateTo] = useState('');
    const [listPage, setListPage] = useState(1);
    const [listLimit, setListLimit] = useState(100);
    const [listTotal, setListTotal] = useState(0);
    const [listOptionsPanelOpen, setListOptionsPanelOpen] = useState(false);
    const [listSettingsExpanded, setListSettingsExpanded] = useState<string | false>('filters');

    // ====== BATCH STATE ======
    const [batches, setBatches] = useState<BatchData[]>([]);
    const [batchLoading, setBatchLoading] = useState(false);

    // ====== BULK UPLOAD STATE ======
    const [bulkUploading, setBulkUploading] = useState(false);
    const bulkFileRef = useRef<HTMLInputElement>(null);

    // ====== INIT ======
    useEffect(() => { const stored = getStoredUser(); if (stored) setUser(stored); }, []);

    // ====== DRAFT: save/restore active box + items ======
    const saveDraftRef = useRef<(() => void) | undefined>(undefined);
    saveDraftRef.current = () => {
        if (!activeBox || qcItems.length === 0) { localStorage.removeItem(DRAFT_KEY); setDraftLoaded(false); return; }
        const draft = { activeBox, qcItems, qcDate, savedAt: new Date().toISOString() };
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); setDraftLoaded(true); } catch { }
    };

    useEffect(() => {
        const timer = setInterval(() => saveDraftRef.current?.(), 10000);
        return () => clearInterval(timer);
    }, []);

    // Restore draft on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) {
                const draft = JSON.parse(saved);
                if (draft.activeBox && draft.qcItems?.length > 0) {
                    setActiveBox(draft.activeBox);
                    setQcItems(draft.qcItems);
                    if (draft.qcDate) setQcDate(draft.qcDate);
                    setDraftLoaded(true);
                    setTimeout(() => toast.success(`Draft restored: Box ${draft.activeBox.box_id} — ${draft.qcItems.length} items`, { duration: 3000 }), 500);
                }
            }
        } catch { }
    }, []);

    const saveDraftNow = useCallback(() => { saveDraftRef.current?.(); toast.success('Draft saved', { duration: 1500 }); }, []);

    const clearDraft = useCallback(() => {
        localStorage.removeItem(DRAFT_KEY);
        setActiveBox(null);
        setQcItems([]);
        setBoxIdInput('');
        setDraftLoaded(false);
        toast.success('Draft cleared', { duration: 1500 });
    }, []);

    // ======================== BOX LOOKUP ========================
    const handleBoxScan = useCallback(async () => {
        const boxId = boxIdInput.trim().toUpperCase();
        if (!boxId) { toast.error('Enter a Box ID'); return; }
        if (!activeWarehouse?.id) return;

        try {
            setBoxLoading(true);
            const res = await nlQcAPI.lookupBox(boxId, activeWarehouse.id);
            if (res.data?.data) {
                setActiveBox(res.data.data);
                setQcItems([]);
                setBoxIdInput('');
                toast.success(`Box ${boxId} loaded — VRP: ${res.data.data.vrp_id}, Lot: ${res.data.data.lot_type}, Qty: ${res.data.data.actual_qty}`);
                // Focus appropriate input
                setTimeout(() => {
                    if (res.data.data.lot_type === 'RVP') wsnInputRef.current?.focus();
                    else raWidInputRef.current?.focus();
                }, 200);
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Box not found or not stacked');
        } finally { setBoxLoading(false); }
    }, [boxIdInput, activeWarehouse?.id]);

    // ======================== RVP: SCAN WSN ========================
    const handleWsnScan = useCallback(async () => {
        const wsn = wsnInput.trim().toUpperCase();
        if (!wsn) return;

        // Check duplicate
        if (qcItems.some(i => i.wsn === wsn)) {
            toast.error(`WSN ${wsn} already scanned`);
            setWsnInput('');
            wsnInputRef.current?.focus();
            return;
        }

        // Auto-lookup product details from nl_master_data
        let productTitle = '';
        let fsn = '';
        let wid = '';
        try {
            const res = await nlMasterDataAPI.lookupWSN(wsn);
            if (res.data?.data) {
                productTitle = res.data.data.product_title || '';
                fsn = res.data.data.fsn || '';
                wid = res.data.data.wid || '';
            }
        } catch { /* not found in master data — continue without enrichment */ }

        setQcItems(prev => [...prev, {
            _id: `wsn_${Date.now()}_${Math.random()}`,
            wsn,
            wid: wid || undefined,
            fsn: fsn || undefined,
            product_title: productTitle || undefined,
            qc_grade: wsnGrade,
            qc_remark: wsnRemark,
            qty: 1,
        }]);

        setWsnInput('');
        setWsnRemark('');
        // Keep same grade for speed
        wsnInputRef.current?.focus();
    }, [wsnInput, wsnGrade, wsnRemark, qcItems]);

    // ======================== RA: ADD WID ========================
    const handleRaAdd = useCallback(async () => {
        const wid = raWid.trim().toUpperCase();
        if (!wid) { toast.error('Enter WID'); return; }
        const qty = Number(raQty) || 1;
        if (qty < 1) { toast.error('Qty must be at least 1'); return; }

        // Auto-lookup product details from nl_master_data if product name is empty
        let productName = raProductName;
        let fsn = '';
        if (!productName) {
            try {
                const res = await nlMasterDataAPI.lookupWID(wid);
                if (res.data?.data) {
                    productName = res.data.data.product_title || '';
                    fsn = res.data.data.fsn || '';
                }
            } catch { /* not found — user typed name will be used */ }
        }

        setQcItems(prev => [...prev, {
            _id: `wid_${Date.now()}_${Math.random()}`,
            wid,
            product_title: productName || '',
            fsn: fsn || undefined,
            qty,
            qc_grade: raGrade,
            qc_remark: raRemark,
        }]);

        setRaWid('');
        setRaProductName('');
        setRaQty(1);
        setRaRemark('');
        raWidInputRef.current?.focus();
    }, [raWid, raProductName, raQty, raGrade, raRemark]);

    // ======================== REMOVE ITEM ========================
    const removeItem = useCallback((id: string) => {
        setQcItems(prev => prev.filter(i => i._id !== id));
    }, []);

    // ======================== UPDATE ITEM GRADE ========================
    const updateItemGrade = useCallback((id: string, grade: string) => {
        setQcItems(prev => prev.map(i => i._id === id ? { ...i, qc_grade: grade } : i));
    }, []);

    // ======================== SUBMIT BOX QC ========================
    const handleSubmitBox = async () => {
        if (!activeBox || qcItems.length === 0) { toast.error('No items to submit'); return; }
        if (!activeWarehouse?.id) return;

        try {
            setSubmitting(true);
            const items = qcItems.map(item => ({
                wsn: item.wsn || undefined,
                wid: item.wid || undefined,
                fsn: item.fsn || undefined,
                product_title: item.product_title || undefined,
                qty: item.qty || 1,
                actual_qty: item.qty || 1,
                qc_grade: item.qc_grade || 'A',
                qc_remark: item.qc_remark || undefined,
            }));

            const res = await nlQcAPI.submitBox({
                box_id: activeBox.box_id,
                warehouse_id: activeWarehouse.id,
                qc_date: qcDate,
                items,
            });

            const data = res.data;
            toast.success(`Box ${activeBox.box_id} QC done — ${data.items_inserted} items. Batch: ${data.session_id}`);

            // Track completed
            setCompletedBoxes(prev => [{
                box_id: activeBox.box_id, vrp_id: activeBox.vrp_id,
                lot_type: activeBox.lot_type, items: qcItems.length,
                session_id: data.session_id, time: new Date().toLocaleTimeString(),
            }, ...prev].slice(0, 50));

            // Reset for next box
            setActiveBox(null);
            setQcItems([]);
            setSubmitDialogOpen(false);
            localStorage.removeItem(DRAFT_KEY);
            setDraftLoaded(false);

            // Focus box input for next scan
            setTimeout(() => boxInputRef.current?.focus(), 200);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Submit failed');
        } finally { setSubmitting(false); }
    };

    // ======================== CLOSE BOX (discard) ========================
    const handleCloseBox = useCallback(() => {
        setActiveBox(null);
        setQcItems([]);
        localStorage.removeItem(DRAFT_KEY);
        setDraftLoaded(false);
        setTimeout(() => boxInputRef.current?.focus(), 100);
    }, []);

    // ======================== QC LIST ========================
    const loadQCList = useCallback(async () => {
        if (!activeWarehouse?.id) return;
        try {
            setListLoading(true);
            const res = await nlQcAPI.listEntries({
                warehouse_id: activeWarehouse.id,
                search: listSearch || undefined,
                dateFrom: listDateFrom || undefined,
                dateTo: listDateTo || undefined,
                page: listPage,
                limit: listLimit,
            });
            setListData(res.data?.data || []);
            setListTotal(res.data?.total || 0);
        } catch { toast.error('Failed to load QC list'); }
        finally { setListLoading(false); }
    }, [activeWarehouse?.id, listSearch, listDateFrom, listDateTo, listPage, listLimit]);

    useEffect(() => { if (currentTabCode === 'list') loadQCList(); }, [currentTabCode, loadQCList]);

    // ======================== BATCHES ========================
    const loadBatches = useCallback(async () => {
        if (!activeWarehouse?.id) return;
        try {
            setBatchLoading(true);
            const res = await nlQcAPI.getBatches(activeWarehouse.id);
            setBatches(res.data || []);
        } catch { toast.error('Failed to load batches'); }
        finally { setBatchLoading(false); }
    }, [activeWarehouse?.id]);

    useEffect(() => { if (currentTabCode === 'batches') loadBatches(); }, [currentTabCode, loadBatches]);

    const handleDeleteBatch = async (batchId: string) => {
        try {
            await nlQcAPI.deleteBatch(batchId);
            toast.success('Batch deleted');
            loadBatches();
        } catch (error: any) { toast.error(error?.response?.data?.error || 'Delete failed'); }
    };

    // ======================== BULK UPLOAD ========================
    const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeWarehouse?.id) { toast.error('File and active warehouse required'); return; }
        try {
            setBulkUploading(true);
            const XLSX = await import('xlsx');
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const jsonRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

            const entries = jsonRows.map(row => ({
                box_id: String(row['BOX ID'] || row['Box ID'] || row['box_id'] || '').trim().toUpperCase(),
                qc_grade: String(row['QC GRADE'] || row['QC Grade'] || row['qc_grade'] || row['Grade'] || row['grade'] || 'A').toUpperCase(),
                qc_remark: String(row['Remarks'] || row['remarks'] || row['QC Remark'] || row['qc_remark'] || ''),
            })).filter(e => e.box_id);

            if (entries.length === 0) { toast.error('No valid rows found (need BOX ID column)'); return; }

            const res = await nlQcAPI.multiEntry({
                entries,
                warehouse_id: activeWarehouse.id,
                qc_date: qcDate,
            });

            const d = res.data;
            toast.success(`Bulk QC: ${d.total_boxes} processed${d.error_count ? `, ${d.error_count} errors` : ''}. Batch: ${d.session_id}`);
        } catch (error: any) { toast.error('Bulk upload failed: ' + (error?.response?.data?.error || error?.message || 'Unknown error')); }
        finally { setBulkUploading(false); if (bulkFileRef.current) bulkFileRef.current.value = ''; }
    };

    const downloadBulkTemplate = async () => {
        const XLSX = await import('xlsx');
        const template = [{ 'BOX ID': 'BOX001', 'QC Grade': 'A', 'Remarks': '' }];
        const ws = XLSX.utils.json_to_sheet(template);
        ws['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'NL QC Template');
        XLSX.writeFile(wb, 'NL_QC_Bulk_Upload_Template.xlsx');
    };

    // ======================== EXPORTS ========================
    const exportListToExcel = async () => {
        if (listData.length === 0) { toast.error('No data to export'); return; }
        const XLSX = await import('xlsx');
        const ed = listData.map(r => ({
            'Box ID': r.box_id, 'VRP ID': r.vrp_id, 'Lot Type': r.lot_type || '',
            'WID': r.wid || '', 'WSN': r.wsn || '', 'Product': r.product_title || '',
            'Qty': r.actual_qty, 'QC Grade': r.qc_grade, 'Status': r.status,
            'Remark': r.qc_remark || '', 'Session': r.session_id,
            'QC Date': formatDate(r.qc_date), 'QC By': r.qc_by_name || '',
        }));
        const ws = XLSX.utils.json_to_sheet(ed);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'NL QC List');
        XLSX.writeFile(wb, `NL_QC_List_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Exported');
    };

    // ======================== COMPUTED ========================
    const totalItemsQcd = qcItems.length;
    const totalItemQty = qcItems.reduce((s, i) => s + (i.qty || 1), 0);
    const gradeBreakdown = useMemo(() => {
        return {
            A: qcItems.filter(i => i.qc_grade === 'A').length,
            B: qcItems.filter(i => i.qc_grade === 'B').length,
            C: qcItems.filter(i => i.qc_grade === 'C').length,
            D: qcItems.filter(i => i.qc_grade === 'D').length,
        };
    }, [qcItems]);
    const listHasFilters = !!(listSearch || listDateFrom || listDateTo);

    // ======================== DARK MODE GRID SX ========================
    const gridSx = useNlGridSx(isDarkMode, {
        headerBg: '#065f46',
        headerBorder: '#10b981',
        headerBorderLight: '#059669',
        headerCellBorder: '#059669',
        hoverBg: 'rgba(16, 185, 129, 0.15)',
        hoverBgLight: '#ecfdf5',
        focusBorder: '#34d399',
        focusBorderLight: '#059669',
        rangeBg: 'rgba(16, 185, 129, 0.25)',
        rangeBgLight: '#d1fae5',
    });

    // ======================== LIST COLUMN DEFS ========================
    const listColumnDefs = useMemo(() => [
        { field: 'box_id', headerName: 'Box ID', width: 130, pinned: 'left' as const },
        { field: 'vrp_id', headerName: 'VRP ID', width: 120 },
        { field: 'lot_type', headerName: 'Lot', width: 70 },
        { field: 'wid', headerName: 'WID', width: 120 },
        { field: 'wsn', headerName: 'WSN', width: 140 },
        { field: 'product_title', headerName: 'Product', flex: 1, minWidth: 150 },
        { field: 'actual_qty', headerName: 'Qty', width: 70, type: 'numericColumn' },
        {
            field: 'qc_grade', headerName: 'Grade', width: 80,
            cellStyle: (p: any) => {
                if (p.value === 'D') return { color: '#ef4444', fontWeight: 700 };
                if (p.value === 'C') return { color: '#f59e0b', fontWeight: 600 };
                if (p.value === 'B') return { color: '#3b82f6', fontWeight: 600 };
                return { color: '#22c55e', fontWeight: 600 };
            },
        },
        {
            field: 'status', headerName: 'Status', width: 90,
            cellRenderer: (p: any) => p.value === 'qc_pass'
                ? <Chip label="Pass" size="small" color="success" variant="outlined" />
                : <Chip label="Fail" size="small" color="error" variant="outlined" />,
        },
        { field: 'qc_remark', headerName: 'Remark', flex: 1, minWidth: 100 },
        { field: 'session_id', headerName: 'Session', flex: 1.5, minWidth: 180 },
        { field: 'qc_date', headerName: 'Date', width: 100, valueFormatter: (p: any) => formatDate(p.value) },
        { field: 'qc_by_name', headerName: 'QC By', width: 120 },
    ], []);

    const defaultColDef = useMemo(() => ({ sortable: false, filter: false, resizable: true, suppressMovable: true }), []);

    if (!user) return <AppLayout><Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><CircularProgress /></Box></AppLayout>;
    if (!activeWarehouse) return <AppLayout><Box sx={{ p: 3, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Alert severity="warning" sx={{ maxWidth: 400 }}>No active warehouse selected.</Alert></Box></AppLayout>;

    return (
        <AppLayout>
            <Toaster position="top-right" containerStyle={{ zIndex: 99999 }} toastOptions={{ duration: 3000, style: { background: '#363636', color: '#fff', borderRadius: '10px', padding: '16px', fontWeight: 600 } }} />

            <Box sx={{
                height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                '& *': { transition: 'none !important' },
            }}>
                <StandardPageHeader title="NL QC" subtitle="Item-level quality check per box" icon="🔍" warehouseName={activeWarehouse?.name} />
                <StandardTabs value={tabValue} onChange={(_e: any, v: number) => setTabValue(v)} tabs={visibleTabs} color="#059669" />

                {/* ================== QC ENTRY TAB ================== */}
                {currentTabCode === 'qc_entry' && (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', p: { xs: 0.5, sm: 1.5 }, bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa' }}>

                        {/* ---- STEP 1: BOX SCAN ---- */}
                        <Paper sx={{ p: 2, mb: 1.5, borderRadius: 2, border: activeBox ? `2px solid ${isDarkMode ? '#10b981' : '#059669'}` : undefined }}>
                            <Stack direction={isMobile ? 'column' : 'row'} spacing={1.5} alignItems={isMobile ? 'stretch' : 'center'} flexWrap="wrap">
                                <TextField size="small" label="QC Date" type="date" value={qcDate} onChange={(e) => setQcDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 150 }} />
                                <TextField
                                    inputRef={boxInputRef}
                                    size="small"
                                    label="Scan Box ID"
                                    value={boxIdInput}
                                    onChange={(e) => setBoxIdInput(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleBoxScan(); }}
                                    placeholder="Scan or type Box ID"
                                    disabled={!!activeBox}
                                    sx={{ minWidth: 220, flex: 1, maxWidth: 350 }}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><ScanIcon fontSize="small" color="success" /></InputAdornment>,
                                        endAdornment: boxLoading ? <CircularProgress size={18} /> : null,
                                    }}
                                />
                                {!activeBox && (
                                    <Button variant="contained" onClick={handleBoxScan} disabled={boxLoading || !boxIdInput.trim()} sx={{ height: 40, background: 'linear-gradient(135deg, #059669, #10b981)', fontWeight: 600, textTransform: 'none' }} startIcon={<BoxIcon />}>
                                        Load Box
                                    </Button>
                                )}

                                {/* Active Box Info */}
                                {activeBox && (
                                    <>
                                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                                        <Chip icon={<BoxIcon />} label={activeBox.box_id} color="success" variant="filled" sx={{ fontWeight: 700, fontSize: '0.85rem' }} />
                                        <Chip label={`VRP: ${activeBox.vrp_id}`} size="small" variant="outlined" color="info" />
                                        <Chip label={activeBox.lot_type} size="small" variant="filled" color={activeBox.lot_type === 'RVP' ? 'secondary' : 'warning'} sx={{ fontWeight: 700 }} />
                                        <Chip label={`Qty: ${activeBox.actual_qty}`} size="small" variant="outlined" />
                                        {activeBox.category && <Chip label={activeBox.category} size="small" variant="outlined" />}
                                        <Box sx={{ flex: 1 }} />
                                        {draftLoaded && <Chip label="Draft" size="small" color="info" variant="outlined" icon={<SaveIcon sx={{ fontSize: 14 }} />} />}
                                        {qcItems.length > 0 && (
                                            <Tooltip title="Save Draft"><IconButton aria-label="Action" size="small" onClick={saveDraftNow} color="info"><SaveIcon fontSize="small" /></IconButton></Tooltip>
                                        )}
                                        <Tooltip title="Close Box (discard)"><IconButton aria-label="Action" size="small" onClick={handleCloseBox} color="error"><CloseIcon fontSize="small" /></IconButton></Tooltip>
                                    </>
                                )}
                            </Stack>
                        </Paper>

                        {/* ---- STEP 2: ITEM-LEVEL QC ---- */}
                        {activeBox && (
                            <>
                                {/* RVP Mode: Scan WSN */}
                                {activeBox.lot_type === 'RVP' && (
                                    <Paper sx={{ p: 1.5, mb: 1, borderRadius: 2 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#7c3aed' }}>
                                            RVP Mode — Scan individual WSN stickers
                                        </Typography>
                                        <Stack direction={isMobile ? 'column' : 'row'} spacing={1} alignItems={isMobile ? 'stretch' : 'center'} flexWrap="wrap">
                                            <TextField
                                                inputRef={wsnInputRef}
                                                size="small"
                                                label="Scan WSN"
                                                value={wsnInput}
                                                onChange={(e) => setWsnInput(e.target.value.toUpperCase())}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleWsnScan(); }}
                                                autoFocus
                                                sx={{ minWidth: 200, flex: 1, maxWidth: 300 }}
                                                InputProps={{ startAdornment: <InputAdornment position="start"><ScanIcon fontSize="small" color="secondary" /></InputAdornment> }}
                                            />
                                            <Stack direction="row" spacing={0.5}>
                                                {QC_GRADES.map(g => (
                                                    <Button key={g} variant={wsnGrade === g ? 'contained' : 'outlined'} size="small"
                                                        onClick={() => setWsnGrade(g)}
                                                        sx={{
                                                            minWidth: 38, height: 36, fontWeight: 700,
                                                            bgcolor: wsnGrade === g ? GRADE_COLORS[g] : 'transparent',
                                                            borderColor: GRADE_COLORS[g], color: wsnGrade === g ? 'white' : GRADE_COLORS[g],
                                                            '&:hover': { bgcolor: GRADE_COLORS[g], color: 'white' },
                                                        }}>
                                                        {g}
                                                    </Button>
                                                ))}
                                            </Stack>
                                            <TextField size="small" label="Remark" value={wsnRemark} onChange={(e) => setWsnRemark(e.target.value)} sx={{ width: 140 }} />
                                            <Button variant="contained" onClick={handleWsnScan} disabled={!wsnInput.trim()} startIcon={<CheckCircleIcon />}
                                                sx={{ height: 36, background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', fontWeight: 600, textTransform: 'none' }}>
                                                Add
                                            </Button>
                                        </Stack>
                                    </Paper>
                                )}

                                {/* RA Mode: Enter WID + Qty */}
                                {activeBox.lot_type === 'RA' && (
                                    <Paper sx={{ p: 1.5, mb: 1, borderRadius: 2 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#d97706' }}>
                                            RA Mode — Enter WID, product name & qty
                                        </Typography>
                                        <Stack direction={isMobile ? 'column' : 'row'} spacing={1} alignItems={isMobile ? 'stretch' : 'center'} flexWrap="wrap">
                                            <TextField
                                                inputRef={raWidInputRef}
                                                size="small"
                                                label="WID"
                                                value={raWid}
                                                onChange={(e) => setRaWid(e.target.value.toUpperCase())}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleRaAdd(); }}
                                                onBlur={() => { if (raWid.trim()) lookupRaWid(raWid); }}
                                                autoFocus
                                                sx={{ minWidth: 140, width: 160 }}
                                                InputProps={{ startAdornment: <InputAdornment position="start">{raWidLookupLoading ? <CircularProgress size={16} /> : <ScanIcon fontSize="small" color="warning" />}</InputAdornment> }}
                                            />
                                            <TextField size="small" label="Product Name" value={raProductName} onChange={(e) => setRaProductName(e.target.value)} sx={{ minWidth: 150, flex: 1, maxWidth: 250 }} />
                                            <TextField size="small" label="Qty" type="number" value={raQty} onChange={(e) => setRaQty(e.target.value)} sx={{ width: 80 }} inputProps={{ min: 1 }} />
                                            <Stack direction="row" spacing={0.5}>
                                                {QC_GRADES.map(g => (
                                                    <Button key={g} variant={raGrade === g ? 'contained' : 'outlined'} size="small"
                                                        onClick={() => setRaGrade(g)}
                                                        sx={{
                                                            minWidth: 38, height: 36, fontWeight: 700,
                                                            bgcolor: raGrade === g ? GRADE_COLORS[g] : 'transparent',
                                                            borderColor: GRADE_COLORS[g], color: raGrade === g ? 'white' : GRADE_COLORS[g],
                                                            '&:hover': { bgcolor: GRADE_COLORS[g], color: 'white' },
                                                        }}>
                                                        {g}
                                                    </Button>
                                                ))}
                                            </Stack>
                                            <TextField size="small" label="Remark" value={raRemark} onChange={(e) => setRaRemark(e.target.value)} sx={{ width: 140 }} />
                                            <Button variant="contained" onClick={handleRaAdd} disabled={!raWid.trim()} startIcon={<AddIcon />}
                                                sx={{ height: 36, background: 'linear-gradient(135deg, #d97706, #f59e0b)', fontWeight: 600, textTransform: 'none' }}>
                                                Add
                                            </Button>
                                        </Stack>
                                    </Paper>
                                )}

                                {/* ---- PROGRESS CARDS ---- */}
                                <Stack direction={isMobile ? 'column' : 'row'} spacing={1.5} sx={{ mb: 1 }}>
                                    <Card sx={{ flex: 1, background: 'linear-gradient(135deg, #059669, #10b981)', color: 'white', borderRadius: 2 }}>
                                        <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
                                            <Typography variant="caption" sx={{ opacity: 0.85 }}>Items Scanned</Typography>
                                            <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalItemsQcd} / {activeBox.actual_qty || '?'}</Typography>
                                        </CardContent>
                                    </Card>
                                    {activeBox.lot_type === 'RA' && (
                                        <Card sx={{ flex: 1, background: 'linear-gradient(135deg, #d97706, #f59e0b)', color: 'white', borderRadius: 2 }}>
                                            <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
                                                <Typography variant="caption" sx={{ opacity: 0.85 }}>Total Qty</Typography>
                                                <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalItemQty}</Typography>
                                            </CardContent>
                                        </Card>
                                    )}
                                    <Card sx={{ flex: 1, background: isDarkMode ? '#1e293b' : '#f1f5f9', borderRadius: 2, border: '1px solid', borderColor: isDarkMode ? '#334155' : '#d1d5db' }}>
                                        <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
                                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Grade Breakdown</Typography>
                                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
                                                {gradeBreakdown.A > 0 && <Chip label={`A:${gradeBreakdown.A}`} size="small" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 600, height: 22 }} />}
                                                {gradeBreakdown.B > 0 && <Chip label={`B:${gradeBreakdown.B}`} size="small" sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 600, height: 22 }} />}
                                                {gradeBreakdown.C > 0 && <Chip label={`C:${gradeBreakdown.C}`} size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 600, height: 22 }} />}
                                                {gradeBreakdown.D > 0 && <Chip label={`D:${gradeBreakdown.D}`} size="small" sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 600, height: 22 }} />}
                                                {totalItemsQcd === 0 && <Typography variant="body2" sx={{ color: 'text.disabled' }}>—</Typography>}
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Stack>

                                {/* Progress bar */}
                                {activeBox.actual_qty > 0 && (
                                    <LinearProgress
                                        variant="determinate"
                                        value={Math.min((totalItemQty / activeBox.actual_qty) * 100, 100)}
                                        color="success"
                                        sx={{ height: 6, borderRadius: 3, mb: 1, bgcolor: isDarkMode ? '#334155' : '#e2e8f0' }}
                                    />
                                )}

                                {/* ---- SCANNED ITEMS TABLE ---- */}
                                <Paper sx={{ flex: 1, minHeight: 200, overflow: 'auto', borderRadius: 2 }}>
                                    {qcItems.length === 0 ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'text.disabled' }}>
                                            <Typography>{activeBox.lot_type === 'RVP' ? 'Scan WSN stickers to start QC...' : 'Enter WID items to start QC...'}</Typography>
                                        </Box>
                                    ) : (
                                        <Box sx={{ overflow: 'auto', maxHeight: 400 }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                                <thead>
                                                    <tr style={{ background: isDarkMode ? '#065f46' : '#059669', color: 'white' }}>
                                                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>#</th>
                                                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>{activeBox.lot_type === 'RVP' ? 'WSN' : 'WID'}</th>
                                                        {activeBox.lot_type === 'RA' && <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Product</th>}
                                                        {activeBox.lot_type === 'RA' && <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Qty</th>}
                                                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Grade</th>
                                                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Remark</th>
                                                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, width: 40 }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {qcItems.map((item, idx) => (
                                                        <tr key={item._id} style={{
                                                            background: isDarkMode ? (idx % 2 === 0 ? '#1e293b' : '#1a2536') : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'),
                                                            borderBottom: `1px solid ${isDarkMode ? '#334155' : '#e5e7eb'}`,
                                                        }}>
                                                            <td style={{ padding: '6px 10px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>{idx + 1}</td>
                                                            <td style={{ padding: '6px 10px', fontWeight: 600, color: isDarkMode ? '#f1f5f9' : '#0f172a' }}>{item.wsn || item.wid}</td>
                                                            {activeBox.lot_type === 'RA' && <td style={{ padding: '6px 10px', color: isDarkMode ? '#cbd5e1' : '#475569' }}>{item.product_title || '-'}</td>}
                                                            {activeBox.lot_type === 'RA' && <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600 }}>{item.qty}</td>}
                                                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                                                <select
                                                                    value={item.qc_grade}
                                                                    onChange={(e) => updateItemGrade(item._id, e.target.value)}
                                                                    style={{
                                                                        border: 'none', background: 'transparent', fontWeight: 700, cursor: 'pointer',
                                                                        color: GRADE_COLORS[item.qc_grade] || '#22c55e', fontSize: '0.85rem', padding: '2px 4px',
                                                                    }}>
                                                                    {QC_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                                                                </select>
                                                            </td>
                                                            <td style={{ padding: '6px 10px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>{item.qc_remark || '-'}</td>
                                                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                                                <IconButton aria-label="Action" size="small" onClick={() => removeItem(item._id)} sx={{ p: 0.25 }}>
                                                                    <DeleteIcon sx={{ fontSize: 16, color: '#ef4444' }} />
                                                                </IconButton>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </Box>
                                    )}
                                </Paper>

                                {/* ---- SUBMIT BAR ---- */}
                                <Paper sx={{ p: 1, mt: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0, alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', borderRadius: 2, bgcolor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
                                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {totalItemsQcd > 0
                                                ? `${totalItemsQcd} item${totalItemsQcd !== 1 ? 's' : ''}${activeBox.lot_type === 'RA' ? ` (${totalItemQty} qty)` : ''} ready`
                                                : 'No items scanned yet'}
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        {qcItems.length > 0 && (
                                            <Button variant="outlined" size="small" startIcon={<ClearAllIcon />} onClick={() => setQcItems([])} sx={{ textTransform: 'none' }}>Clear Items</Button>
                                        )}
                                        <Button variant="contained" color="success" size="small" startIcon={<SendIcon />}
                                            onClick={() => setSubmitDialogOpen(true)} disabled={qcItems.length === 0 || submitting}
                                            sx={{ textTransform: 'none', fontWeight: 600 }}>
                                            Submit Box QC
                                        </Button>
                                    </Stack>
                                </Paper>
                            </>
                        )}

                        {/* ---- NO ACTIVE BOX: show completed boxes history ---- */}
                        {!activeBox && completedBoxes.length > 0 && (
                            <Paper sx={{ p: 2, mt: 1, borderRadius: 2 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Recently Completed Boxes</Typography>
                                <Stack spacing={0.75}>
                                    {completedBoxes.map((cb, i) => (
                                        <Stack key={i} direction="row" spacing={1.5} alignItems="center" sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: isDarkMode ? '#1a2536' : '#f8fafc' }}>
                                            <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 18 }} />
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{cb.box_id}</Typography>
                                            <Chip label={cb.vrp_id} size="small" variant="outlined" />
                                            <Chip label={cb.lot_type} size="small" variant="outlined" color={cb.lot_type === 'RVP' ? 'secondary' : 'warning'} />
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{cb.items} items</Typography>
                                            <Typography variant="body2" sx={{ color: 'text.disabled', ml: 'auto' }}>{cb.time}</Typography>
                                        </Stack>
                                    ))}
                                </Stack>
                            </Paper>
                        )}

                        {/* No active box hint */}
                        {!activeBox && completedBoxes.length === 0 && (
                            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center', maxWidth: 400 }}>
                                    <ScanIcon sx={{ fontSize: 48, color: '#059669', mb: 1 }} />
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Scan a Box to Start QC</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                        Scan or type a Box ID above. The system will auto-fetch VRP, lot type & qty.
                                        Then QC each item based on lot type (RVP → scan WSN, RA → enter WID + qty).
                                    </Typography>
                                </Paper>
                            </Box>
                        )}
                    </Box>
                )}

                {/* ================== QC LIST TAB ================== */}
                {currentTabCode === 'list' && (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: { xs: 1, sm: 1.5 }, bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa' }}>
                        <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
                            <TextField fullWidth size="small" placeholder="Search box, VRP, WSN, WID, grade..."
                                value={listSearch} onChange={(e) => setListSearch(e.target.value)} sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 38 } }}
                                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="primary" /></InputAdornment> }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { setListPage(1); loadQCList(); } }} />
                            <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={loadQCList} disabled={listLoading} sx={{ height: 38 }}>Refresh</Button>
                            <Button variant="outlined" size="small" startIcon={<SettingsIcon />} onClick={() => setListOptionsPanelOpen(true)} sx={{ height: 38, position: 'relative' }}>
                                Options
                                {listHasFilters && <Box sx={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, bgcolor: '#ef4444', borderRadius: '50%' }} />}
                            </Button>
                        </Stack>

                        <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
                            <Chip label={`${listTotal} entries`} size="small" color="success" variant="outlined" />
                            {listHasFilters && <Chip label="Filters active" size="small" color="warning" variant="outlined" onDelete={() => { setListSearch(''); setListDateFrom(''); setListDateTo(''); setListPage(1); }} />}
                        </Stack>

                        <Box sx={{ flex: 1, minHeight: 0 }}>
                            <Box className="ag-theme-quartz" sx={gridSx}>
                                <AgGridReact rowData={listData} columnDefs={listColumnDefs} defaultColDef={defaultColDef}
                                    rowHeight={tableRowHeight} headerHeight={40} animateRows={false} suppressCellFocus loading={listLoading}
                                    containerStyle={{ height: '100%', width: '100%', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }} />
                            </Box>
                        </Box>

                        {/* Pagination */}
                        <Fade in={true} timeout={300}>
                            <Box sx={{
                                px: { xs: 1, sm: 2 }, py: { xs: 0.75, sm: 0.5 },
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d1d5db',
                                bgcolor: isDarkMode ? '#1e293b' : 'white', flexShrink: 0,
                                minHeight: { xs: 44, sm: 52 }, borderRadius: '0 0 12px 12px',
                            }}>
                                <Stack direction="row" spacing={{ xs: 0.5, sm: 1.5 }} alignItems="center">
                                    <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Per page:</Typography>
                                    <Select size="small" value={listLimit} onChange={(e) => { setListLimit(Number(e.target.value)); setListPage(1); }}
                                        sx={{ height: 30, fontSize: '0.78rem', minWidth: 65 }}>
                                        <MenuItem value={50}>50</MenuItem>
                                        <MenuItem value={100}>100</MenuItem>
                                        <MenuItem value={500}>500</MenuItem>
                                        <MenuItem value={1000}>1000</MenuItem>
                                    </Select>
                                </Stack>
                                <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                                    {listTotal > 0 ? `${(listPage - 1) * listLimit + 1} \u2013 ${Math.min(listPage * listLimit, listTotal)} of ${listTotal}` : '0 results'}
                                </Typography>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                    <IconButton aria-label="Action" size="small" disabled={listPage === 1} onClick={() => setListPage(1)}><FirstPage fontSize="small" /></IconButton>
                                    <IconButton aria-label="Action" size="small" disabled={listPage === 1} onClick={() => setListPage(listPage - 1)}><KeyboardArrowLeft fontSize="small" /></IconButton>
                                    <Pagination page={listPage} count={Math.ceil(listTotal / listLimit) || 1} size="small"
                                        onChange={(_, v) => setListPage(v)} siblingCount={1} boundaryCount={1}
                                        sx={{
                                            '& .MuiPaginationItem-root': { color: isDarkMode ? '#94a3b8' : 'inherit', minWidth: 28, height: 28 },
                                            '& .Mui-selected': { bgcolor: isDarkMode ? 'rgba(16, 185, 129, 0.3) !important' : 'rgba(5, 150, 105, 0.12) !important' },
                                        }} />
                                    <IconButton aria-label="Action" size="small" disabled={listPage >= Math.ceil(listTotal / listLimit)} onClick={() => setListPage(listPage + 1)}><KeyboardArrowRight fontSize="small" /></IconButton>
                                    <IconButton aria-label="Action" size="small" disabled={listPage >= Math.ceil(listTotal / listLimit)} onClick={() => setListPage(Math.ceil(listTotal / listLimit))}><LastPage fontSize="small" /></IconButton>
                                </Stack>
                            </Box>
                        </Fade>
                    </Box>
                )}

                {/* ================== BATCHES TAB ================== */}
                {currentTabCode === 'batches' && (
                    <Box sx={{ flex: 1, overflow: 'auto', bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa' }}>
                        <BatchManagementTab
                            batches={batches} loading={batchLoading} onRefresh={loadBatches} onDelete={handleDeleteBatch}
                            canDelete={true} title="QC Batch Management" emptyMessage="No batches found"
                            emptySubMessage="Batches will appear here after QC submissions"
                        />
                    </Box>
                )}

                {/* ================== BULK UPLOAD TAB ================== */}
                {currentTabCode === 'bulk' && (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', p: { xs: 1.5, sm: 3 }, bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa' }}>
                        <Paper sx={{ p: { xs: 2, sm: 4 }, borderRadius: 3, maxWidth: 600, mx: 'auto', width: '100%' }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Bulk QC Upload</Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                                Upload an Excel file with box IDs and QC grades. All rows will be submitted as a single batch (box-level QC).
                            </Typography>
                            <Divider sx={{ mb: 3 }} />
                            <Stack direction="row" spacing={1.5} sx={{ mb: 3 }}>
                                <TextField size="small" label="QC Date" type="date" value={qcDate} onChange={(e) => setQcDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
                            </Stack>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Expected Columns</Typography>
                            <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                {['BOX ID *', 'QC Grade', 'Remarks'].map(col => (
                                    <Chip key={col} label={col} size="small" variant="outlined" color={col.includes('*') ? 'success' : 'default'} />
                                ))}
                            </Box>
                            <Stack spacing={2}>
                                <Button variant="outlined" size="large" startIcon={<DownloadIcon />} onClick={downloadBulkTemplate} fullWidth sx={{ py: 1.5 }}>Download Template</Button>
                                <input type="file" accept=".xlsx,.xls" ref={bulkFileRef} style={{ display: 'none' }} onChange={handleBulkUpload} />
                                <Button variant="contained" size="large" startIcon={bulkUploading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
                                    onClick={() => bulkFileRef.current?.click()} disabled={bulkUploading} fullWidth
                                    sx={{ py: 1.5, background: 'linear-gradient(135deg, #059669, #10b981)', '&:hover': { background: 'linear-gradient(135deg, #047857, #059669)' } }}>
                                    {bulkUploading ? 'Uploading...' : 'Upload & Submit'}
                                </Button>
                            </Stack>
                            {bulkUploading && <LinearProgress sx={{ mt: 2 }} color="success" />}
                            <Alert severity="info" sx={{ mt: 3 }}>This is box-level bulk QC. For item-level QC, use the QC Entry tab.</Alert>
                        </Paper>
                    </Box>
                )}
            </Box>

            {/* ================== SUBMIT DIALOG ================== */}
            <Dialog open={submitDialogOpen} onClose={() => setSubmitDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Submit Box QC?</DialogTitle>
                <DialogContent>
                    <Typography>
                        QC <strong>{activeBox?.box_id}</strong> — <strong>{totalItemsQcd} item{totalItemsQcd !== 1 ? 's' : ''}</strong>
                        {activeBox?.lot_type === 'RA' ? ` (${totalItemQty} total qty)` : ''}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                        {gradeBreakdown.A > 0 && <Chip label={`A: ${gradeBreakdown.A}`} size="small" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 600 }} />}
                        {gradeBreakdown.B > 0 && <Chip label={`B: ${gradeBreakdown.B}`} size="small" sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 600 }} />}
                        {gradeBreakdown.C > 0 && <Chip label={`C: ${gradeBreakdown.C}`} size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 600 }} />}
                        {gradeBreakdown.D > 0 && <Chip label={`D: ${gradeBreakdown.D}`} size="small" sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 600 }} />}
                    </Stack>
                    {gradeBreakdown.D > 0 && <Alert severity="warning" sx={{ mt: 1 }}>{gradeBreakdown.D} item(s) graded D — discrepancies will be auto-created.</Alert>}
                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>Box status will change to &apos;qc_done&apos;.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" color="success" onClick={handleSubmitBox} disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={16} /> : <SendIcon />}>
                        {submitting ? 'Submitting...' : 'Confirm Submit'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ================== LIST OPTIONS PANEL ================== */}
            <Drawer anchor="right" open={listOptionsPanelOpen} onClose={() => setListOptionsPanelOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 360 } } }}>
                <Box sx={{ p: 2, background: 'linear-gradient(135deg, #059669, #10b981)', color: 'white', position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>QC List Options</Typography>
                    <IconButton aria-label="Action" onClick={() => setListOptionsPanelOpen(false)} sx={{ color: 'white' }}><CloseIcon /></IconButton>
                </Box>
                <Box sx={{ overflow: 'auto', flex: 1, p: 2 }}>
                    <Accordion expanded={listSettingsExpanded === 'filters'} onChange={(_, exp) => setListSettingsExpanded(exp ? 'filters' : false)}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <FilterListIcon fontSize="small" color="success" />
                                <Typography sx={{ fontWeight: 600 }}>Filters</Typography>
                                {listHasFilters && <Chip label="Active" size="small" color="warning" sx={{ height: 20, fontSize: 11 }} />}
                            </Stack>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Stack spacing={1.5}>
                                <Stack direction="row" spacing={1}>
                                    <TextField label="From Date" type="date" size="small" InputLabelProps={{ shrink: true }} value={listDateFrom} onChange={(e) => { setListDateFrom(e.target.value); setListPage(1); }} fullWidth />
                                    <TextField label="To Date" type="date" size="small" InputLabelProps={{ shrink: true }} value={listDateTo} onChange={(e) => { setListDateTo(e.target.value); setListPage(1); }} fullWidth />
                                </Stack>
                                {listHasFilters && <Button variant="outlined" color="error" size="small" startIcon={<DeleteIcon />} onClick={() => { setListSearch(''); setListDateFrom(''); setListDateTo(''); setListPage(1); }}>Clear All Filters</Button>}
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                    <Divider sx={{ my: 1.5 }} />
                    <Stack spacing={1.5}>
                        <Button variant="outlined" fullWidth startIcon={<ExportIcon />} onClick={exportListToExcel} disabled={listData.length === 0}>Export to Excel</Button>
                        <Button variant="outlined" fullWidth startIcon={<RefreshIcon />} onClick={loadQCList} disabled={listLoading}>Refresh</Button>
                    </Stack>
                </Box>
            </Drawer>
        </AppLayout>
    );
}
