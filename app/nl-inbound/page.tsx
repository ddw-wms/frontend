'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Box, Paper, Typography, Button, TextField, Chip, Stack, MenuItem,
    CircularProgress, Alert, IconButton, Tooltip, Dialog, DialogTitle,
    DialogContent, DialogActions, Drawer, Accordion, AccordionSummary,
    AccordionDetails, FormControlLabel, Checkbox, Switch, useTheme,
    Divider, InputAdornment, LinearProgress, Select, Pagination, Fade,
} from '@mui/material';
import {
    Delete as DeleteIcon, Refresh as RefreshIcon,
    Send as SendIcon, Settings as SettingsIcon,
    CheckCircle as CheckCircleIcon, ExpandMore as ExpandMoreIcon,
    Download as DownloadIcon,
    Fullscreen as FullscreenIcon, FullscreenExit as FullscreenExitIcon,
    CloudUpload as UploadIcon, Search as SearchIcon,
    Close as CloseIcon, Save as SaveIcon, ClearAll as ClearAllIcon,
    FilterList as FilterListIcon, ViewColumn as ViewColumnIcon,
    FileDownload as ExportIcon,
    FirstPage, LastPage, KeyboardArrowLeft, KeyboardArrowRight,
} from '@mui/icons-material';
import { nlInboundAPI, nlFktOsAPI } from '@/lib/nl-api';
import { useNlGridSx, nlFormatDate } from '@/lib/nl-utils';
import { printLabel, isAgentRunning } from '@/lib/printAgent';
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

// User-input columns first, then auto-populated columns
const USER_INPUT_FIELDS = ['box_id', 'vrp_id', 'actual_qty', 'remarks'];
const AUTO_FIELDS = ['category', 'lot_type', 'region', 'declared_qty', 'short_qty'];
const WORKFLOW_FIELDS = ['box_id', 'vrp_id', 'actual_qty'];
const ALL_GRID_COLUMNS = [...USER_INPUT_FIELDS, ...AUTO_FIELDS];

const ALL_TABS = ['Inbound List', 'Multi Entry', 'Bulk', 'Batches'];
const TAB_CODES = ['list', 'multi_entry', 'bulk', 'batches'];

export default function NLInboundPage() {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const { activeWarehouse } = useWarehouse();
    const [user, setUser] = useState<any>(null);
    const tableRowHeight = useTableRowHeight();
    const { filterTabs, canSeeTab, isAdmin } = usePagePermissions('nl_inbound');

    const visibleTabs = useMemo(() => { const f = filterTabs(ALL_TABS, TAB_CODES); return f.length > 0 ? f : ALL_TABS; }, [filterTabs]);
    const visibleTabCodes = useMemo(() => { if (isAdmin) return TAB_CODES; const f = TAB_CODES.filter(c => canSeeTab(c)); return f.length > 0 ? f : TAB_CODES; }, [canSeeTab, isAdmin]);
    const [tabValue, setTabValue] = useState(0);
    const currentTabCode = visibleTabCodes[tabValue] || 'multi_entry';

    // ====== MULTI ENTRY STATE (no session system) ======
    const [inboundDate, setInboundDate] = useState(new Date().toISOString().split('T')[0]);
    const [vehicleNo, setVehicleNo] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
    const [draftLoaded, setDraftLoaded] = useState(false);
    const DRAFT_KEY = 'nl_inbound_draft';

    // ====== GRID STATE ======
    const gridRef = useRef<any>(null);
    const rowIdCounterRef = useRef(0);
    const [rows, setRows] = useState<any[]>([]);
    const rowsRef = useRef<any[]>([]);
    rowsRef.current = rows;
    const pendingLookupsRef = useRef<Set<string>>(new Set());

    // ====== PRINT STATE ======
    const [agentReady, setAgentReady] = useState(false);
    const [autoPrintEnabled, setAutoPrintEnabled] = useState(() => {
        if (typeof window !== 'undefined') { const s = localStorage.getItem('nl_inbound_autoPrint'); return s !== 'false'; }
        return true;
    });
    const lastScannedRowRef = useRef<any>(null);

    // ====== INBOUND LIST STATE (box-level) ======
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

    // ====== MULTI ENTRY OPTIONS PANEL ======
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsExpanded, setSettingsExpanded] = useState<string | false>('columns');
    const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
        if (typeof window !== 'undefined') {
            try { const s = localStorage.getItem('nl_inbound_visible_cols'); return s ? JSON.parse(s) : ALL_GRID_COLUMNS; }
            catch { return ALL_GRID_COLUMNS; }
        }
        return ALL_GRID_COLUMNS;
    });
    const [gridSettings, setGridSettings] = useState({ sortable: false, filter: false, resizable: true });

    // ====== BULK UPLOAD STATE ======
    const [bulkUploading, setBulkUploading] = useState(false);
    const bulkFileRef = useRef<HTMLInputElement>(null);

    // ====== FULLSCREEN ======
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // ====== INIT ======
    useEffect(() => { const stored = getStoredUser(); if (stored) setUser(stored); }, []);
    useEffect(() => {
        const checkAgent = async () => { setAgentReady(await isAgentRunning()); };
        checkAgent(); const interval = setInterval(checkAgent, 30000);
        return () => clearInterval(interval);
    }, []);
    useEffect(() => { localStorage.setItem('nl_inbound_autoPrint', String(autoPrintEnabled)); }, [autoPrintEnabled]);

    // ======================== ROW GENERATION ========================
    const generateEmptyRows = useCallback((count: number) => {
        return Array.from({ length: count }, () => {
            rowIdCounterRef.current += 1;
            return {
                _rowId: `row_${rowIdCounterRef.current}_${Date.now()}`, _vrpFound: false,
                box_id: '', vrp_id: '', category: '', lot_type: '', region: '',
                declared_qty: null as number | null, actual_qty: null as number | null, short_qty: null as number | null,
                route: 'direct', remarks: '',
            };
        });
    }, []);

    // Initialize rows - restore draft if available
    useEffect(() => {
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) {
                const draft = JSON.parse(saved);
                if (draft.rows?.length > 0) {
                    const restoredRows = draft.rows.map((r: any) => {
                        rowIdCounterRef.current += 1;
                        return { _rowId: `row_${rowIdCounterRef.current}_${Date.now()}`, ...r };
                    });
                    const padding = generateEmptyRows(Math.max(500 - restoredRows.length, 100));
                    setRows([...restoredRows, ...padding]);
                    if (draft.inboundDate) setInboundDate(draft.inboundDate);
                    if (draft.vehicleNo) setVehicleNo(draft.vehicleNo);
                    setDraftLoaded(true);
                    setTimeout(() => toast.success(`Draft restored: ${draft.rows.length} rows`, { duration: 3000 }), 500);
                    return;
                }
            }
        } catch { }
        setRows(generateEmptyRows(500));
    }, []); // eslint-disable-line

    // ====== AUTO-SAVE DRAFT ======
    const saveDraftRef = useRef<(() => void) | undefined>(undefined);
    saveDraftRef.current = () => {
        const filled = rows.filter(r => r.box_id?.trim());
        if (filled.length === 0) { localStorage.removeItem(DRAFT_KEY); setDraftLoaded(false); return; }
        const draftData = { rows: filled.map(({ _rowId, ...rest }) => rest), inboundDate, vehicleNo, savedAt: new Date().toISOString() };
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData)); setDraftLoaded(true); } catch { }
    };

    useEffect(() => {
        const timer = setInterval(() => saveDraftRef.current?.(), 10000);
        return () => clearInterval(timer);
    }, []);

    const saveDraftNow = useCallback(() => { saveDraftRef.current?.(); toast.success('Draft saved', { duration: 1500 }); }, []);

    const clearDraft = useCallback(() => {
        localStorage.removeItem(DRAFT_KEY);
        setRows(generateEmptyRows(500));
        setVehicleNo('');
        setDraftLoaded(false);
        toast.success('Draft cleared', { duration: 1500 });
    }, [generateEmptyRows]);

    // ======================== PRINT BOX STICKER ========================
    const printBoxSticker = useCallback(async (rowData: any) => {
        if (!rowData?.box_id?.trim()) { toast.error('No Box ID to print'); return; }
        if (!agentReady) { toast.error('Print agent not available'); return; }
        try {
            const success = await printLabel({
                wsn: rowData.box_id.trim().toUpperCase(),
                product_title: `${rowData.category || ''} | ${rowData.lot_type || ''}`,
                brand: `VRP: ${rowData.vrp_id || ''}`,
                mrp: `QTY: ${rowData.actual_qty || rowData.declared_qty || 0}`,
                fsp: '', fsn: '', wid: '',
                product_serial_number: rowData.box_id.trim().toUpperCase(),
                copies: 1,
            });
            if (success) toast.success(`Sticker printed: ${rowData.box_id}`, { duration: 1500 });
            else toast.error('Print failed');
        } catch (err: any) { toast.error(`Print error: ${err.message}`); }
    }, [agentReady]);

    // ======================== VRP LOOKUP ========================
    const lookupVRP = useCallback(async (vrpId: string, rowIndex: number) => {
        if (!vrpId?.trim() || vrpId.trim().length < 2) return;
        const key = `${rowIndex}_${vrpId.trim().toUpperCase()}`;
        if (pendingLookupsRef.current.has(key)) return;
        pendingLookupsRef.current.add(key);

        try {
            const res = await nlFktOsAPI.getByVrpId(vrpId.trim().toUpperCase(), activeWarehouse?.id);
            if (res.data?.data) {
                const osData = res.data.data;
                const currentRow = rowsRef.current[rowIndex];
                if (!currentRow) return;

                const actualQty = currentRow.actual_qty || osData.declared_qty || 0;
                const completeRow = {
                    ...currentRow, vrp_id: vrpId.trim().toUpperCase(),
                    category: osData.category || '', lot_type: osData.lot_type || '', region: osData.region || '',
                    declared_qty: osData.declared_qty || 0, actual_qty: actualQty,
                    short_qty: (osData.declared_qty || 0) - actualQty,
                    _vrpFound: true, _error: undefined,
                };

                setRows(prev => { const u = [...prev]; u[rowIndex] = { ...completeRow }; return u; });
                setTimeout(() => {
                    const api = gridRef.current?.api;
                    if (api) { const n = api.getRowNode(completeRow._rowId); if (n) api.refreshCells({ rowNodes: [n], force: true }); }
                }, 50);

                lastScannedRowRef.current = completeRow;
                if (autoPrintEnabled && agentReady) printBoxSticker(completeRow);

                // Auto-move to actual_qty column in same row
                setTimeout(() => {
                    const api = gridRef.current?.api;
                    if (api) { api.setFocusedCell(rowIndex, 'actual_qty'); api.startEditingCell({ rowIndex: rowIndex, colKey: 'actual_qty' }); }
                }, 100);
            } else {
                setRows(prev => { const u = [...prev]; if (u[rowIndex]) u[rowIndex] = { ...u[rowIndex], _error: 'VRP not found in OS data' }; return u; });
            }
        } catch {
            setRows(prev => { const u = [...prev]; if (u[rowIndex]) u[rowIndex] = { ...u[rowIndex], _error: 'VRP not found in OS data' }; return u; });
        } finally { pendingLookupsRef.current.delete(key); }
    }, [activeWarehouse?.id, autoPrintEnabled, agentReady, printBoxSticker]);

    // ======================== CELL VALUE CHANGED ========================
    const handleCellValueChanged = useCallback((event: any) => {
        const { colDef, rowIndex, newValue } = event;
        const field = colDef?.field;
        if (!field) return;

        const processedValue = newValue && typeof newValue === 'string' ? newValue.toUpperCase() : newValue;

        setRows(prev => {
            const u = [...prev]; u[rowIndex] = { ...u[rowIndex], [field]: processedValue };
            if (field === 'actual_qty' && u[rowIndex].declared_qty != null) {
                u[rowIndex].short_qty = (u[rowIndex].declared_qty || 0) - (Number(processedValue) || 0);
            }
            return u;
        });

        if (field === 'vrp_id' && processedValue?.trim()) lookupVRP(processedValue, rowIndex);
        if (rowIndex >= rowsRef.current.length - 5) setRows(prev => [...prev, ...generateEmptyRows(500)]);
    }, [lookupVRP, generateEmptyRows]);

    // ======================== ENTER KEY ========================
    const suppressKeyboardEvent = useCallback((params: any) => {
        const { colDef, event, editing, node } = params;
        const field = colDef?.field;
        const rowIndex = node?.rowIndex;
        
        if (editing && event.key === 'Enter') {
            params.api.stopEditing();
            
            // box_id -> vrp_id
            if (field === 'box_id') {
                setTimeout(() => {
                    params.api.setFocusedCell(rowIndex, 'vrp_id');
                    setTimeout(() => params.api.startEditingCell({ rowIndex, colKey: 'vrp_id' }), 50);
                }, 20);
            }
            // vrp_id -> move to actual_qty immediately, then trigger lookup in background
            else if (field === 'vrp_id') {
                const rowData = node.data;
                const vrpId = rowData.vrp_id?.trim();
                
                // Move focus to actual_qty immediately
                params.api.setFocusedCell(rowIndex, 'actual_qty');
                setTimeout(() => params.api.startEditingCell({ rowIndex, colKey: 'actual_qty' }), 50);
                
                // Trigger VRP lookup in background if vrp_id exists
                if (vrpId) {
                    setTimeout(() => {
                        lookupVRP(vrpId, rowIndex);
                    }, 100);
                }
            }
            // actual_qty -> next row box_id
            else if (field === 'actual_qty') {
                setTimeout(() => {
                    params.api.setFocusedCell(rowIndex + 1, 'box_id');
                    setTimeout(() => params.api.startEditingCell({ rowIndex: rowIndex + 1, colKey: 'box_id' }), 50);
                }, 20);
            }
            return true;
        }
        
        // Allow Tab key for field navigation
        if (editing && event.key === 'Tab') {
            params.api.stopEditing();
            const direction = event.shiftKey ? -1 : 1;
            const currentIndex = WORKFLOW_FIELDS.indexOf(field);
            if (currentIndex !== -1 && currentIndex + direction >= 0 && currentIndex + direction < WORKFLOW_FIELDS.length) {
                const nextField = WORKFLOW_FIELDS[currentIndex + direction];
                setTimeout(() => {
                    params.api.setFocusedCell(rowIndex, nextField);
                    params.api.startEditingCell({ rowIndex, colKey: nextField });
                }, 50);
                return true;
            }
        }
        
        // Allow left/right arrows to navigate between cells (no suppression)
        if (editing && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            return false; // Allow default arrow key behavior
        }
        
        if (event.ctrlKey && event.key.toLowerCase() === 'p') {
            event.preventDefault();
            if (lastScannedRowRef.current) printBoxSticker(lastScannedRowRef.current);
            return true;
        }
        return false;
    }, [lookupVRP, printBoxSticker]);

    // ======================== DELETE ROW ========================
    const handleDeleteRow = useCallback((rowIndex: number) => {
        rowIdCounterRef.current += 1;
        setRows(prev => {
            const u = [...prev]; u[rowIndex] = {
                _rowId: `row_${rowIdCounterRef.current}_${Date.now()}`, _vrpFound: false,
                box_id: '', vrp_id: '', category: '', lot_type: '', region: '',
                declared_qty: null, actual_qty: null, short_qty: null, route: 'direct', remarks: '',
            }; return u;
        });
    }, []);

    // ======================== SUBMIT (batch) ========================
    const handleSubmit = async () => {
        const filledRows = rows.filter(r => r.box_id?.trim() && r.vrp_id?.trim());
        if (filledRows.length === 0) { toast.error('No boxes to submit'); return; }

        const errorRows = filledRows.filter(r => !r._vrpFound);
        if (errorRows.length > 0) { toast.error(`${errorRows.length} row(s) have unresolved VRP IDs`); return; }

        try {
            setSubmitting(true);
            const res = await nlInboundAPI.multiEntry({
                entries: filledRows.map(r => ({
                    box_id: r.box_id.trim().toUpperCase(),
                    vrp_id: r.vrp_id.trim().toUpperCase(),
                    actual_qty: Number(r.actual_qty) || Number(r.declared_qty) || 0,
                    route: r.route || 'direct',
                    remarks: r.remarks || '',
                })),
                warehouse_id: activeWarehouse!.id,
                vehicle_no: vehicleNo.trim().toUpperCase() || undefined,
                inbound_date: inboundDate,
            });

            const data = res.data;
            if (data.error_count > 0) {
                toast.success(`Submitted ${data.total_boxes} boxes (${data.error_count} errors). Batch: ${data.session_id}`);
            } else {
                toast.success(`Submitted ${data.total_boxes} boxes. Batch: ${data.session_id}`);
            }

            // Clear grid and draft
            setRows(generateEmptyRows(500));
            setVehicleNo('');
            setSubmitDialogOpen(false);
            localStorage.removeItem(DRAFT_KEY);
            setDraftLoaded(false);
        } catch (error: any) { toast.error(error?.response?.data?.error || 'Submit failed'); }
        finally { setSubmitting(false); }
    };

    // ======================== INBOUND LIST (box-level) ========================
    const loadInboundList = useCallback(async () => {
        if (!activeWarehouse?.id) return;
        try {
            setListLoading(true);
            const res = await nlInboundAPI.listBoxes({
                warehouse_id: activeWarehouse.id,
                search: listSearch || undefined,
                dateFrom: listDateFrom || undefined,
                dateTo: listDateTo || undefined,
                page: listPage,
                limit: listLimit,
            });
            setListData(res.data?.data || []);
            setListTotal(res.data?.total || 0);
        } catch { toast.error('Failed to load inbound list'); }
        finally { setListLoading(false); }
    }, [activeWarehouse?.id, listSearch, listDateFrom, listDateTo, listPage, listLimit]);

    useEffect(() => { if (currentTabCode === 'list') loadInboundList(); }, [currentTabCode, loadInboundList]);

    // ======================== BATCHES ========================
    const loadBatches = useCallback(async () => {
        if (!activeWarehouse?.id) return;
        try {
            setBatchLoading(true);
            const res = await nlInboundAPI.getBatches(activeWarehouse.id);
            setBatches(res.data || []);
        } catch { toast.error('Failed to load batches'); }
        finally { setBatchLoading(false); }
    }, [activeWarehouse?.id]);

    useEffect(() => { if (currentTabCode === 'batches') loadBatches(); }, [currentTabCode, loadBatches]);

    const handleDeleteBatch = async (batchId: string) => {
        try {
            await nlInboundAPI.deleteBatch(batchId);
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
                vrp_id: String(row['VRP ID'] || row['VRP_ID'] || row['vrp_id'] || '').trim().toUpperCase(),
                actual_qty: parseInt(row['Actual Qty'] || row['actual_qty'] || row['QTY'] || '0', 10) || undefined,
                route: String(row['Route'] || row['route'] || 'direct').toLowerCase() === 'qc' ? 'qc' : 'direct',
                remarks: String(row['Remarks'] || row['remarks'] || ''),
            })).filter(e => e.box_id && e.vrp_id);

            if (entries.length === 0) { toast.error('No valid rows found in file'); return; }

            const res = await nlInboundAPI.multiEntry({
                entries,
                warehouse_id: activeWarehouse.id,
                vehicle_no: vehicleNo.trim().toUpperCase() || undefined,
                inbound_date: inboundDate,
            });

            const d = res.data;
            toast.success(`Bulk upload: ${d.total_boxes} saved${d.error_count ? `, ${d.error_count} errors` : ''}. Batch: ${d.session_id}`);
        } catch (error: any) { toast.error('Bulk upload failed: ' + (error?.response?.data?.error || error?.message || 'Unknown error')); }
        finally { setBulkUploading(false); if (bulkFileRef.current) bulkFileRef.current.value = ''; }
    };

    const downloadBulkTemplate = async () => {
        const XLSX = await import('xlsx');
        const template = [{ 'BOX ID': 'BOX001', 'VRP ID': '2627714', 'Actual Qty': 5, 'Route': 'direct', 'Remarks': '' }];
        const ws = XLSX.utils.json_to_sheet(template);
        ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'NL Inbound Template');
        XLSX.writeFile(wb, 'NL_Inbound_Bulk_Upload_Template.xlsx');
    };

    // ======================== MISC ========================
    const add500Rows = useCallback(() => { setRows(prev => [...prev, ...generateEmptyRows(500)]); }, [generateEmptyRows]);

    const exportToExcel = async () => {
        const XLSX = await import('xlsx');
        const dataRows = rows.filter(r => r.box_id?.trim() && r._vrpFound);
        if (dataRows.length === 0) { toast.error('No data to export'); return; }
        const ed = dataRows.map(r => ({
            'Box ID': r.box_id, 'VRP ID': r.vrp_id, 'Actual Qty': r.actual_qty, 'Route': r.route, 'Remarks': r.remarks,
            'Category': r.category, 'Lot Type': r.lot_type, 'Region': r.region, 'Declared Qty': r.declared_qty, 'Short': r.short_qty,
        }));
        const ws = XLSX.utils.json_to_sheet(ed);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'NL Inbound');
        XLSX.writeFile(wb, `NL_Inbound_${inboundDate}_${vehicleNo || 'data'}.xlsx`);
    };

    const exportListToExcel = async () => {
        if (listData.length === 0) { toast.error('No data to export'); return; }
        const XLSX = await import('xlsx');
        const ed = listData.map(r => ({
            'Box ID': r.box_id, 'VRP ID': r.vrp_id, 'Category': r.category || '', 'Lot Type': r.lot_type || '',
            'Region': r.region || '', 'Declared Qty': r.declared_qty, 'Actual Qty': r.actual_qty,
            'Short Qty': (r.declared_qty || 0) - (r.actual_qty || 0), 'Route': r.route, 'Remarks': r.remarks || '',
            'Session ID': r.session_id, 'Inbound Date': formatDate(r.inbound_date), 'Vehicle No': r.vehicle_no || '',
            'Received By': r.received_by_name || '', 'Received At': formatDate(r.received_at),
        }));
        const ws = XLSX.utils.json_to_sheet(ed);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'NL Inbound List');
        XLSX.writeFile(wb, `NL_Inbound_List_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Exported');
    };

    const toggleColumn = (col: string) => {
        setVisibleColumns(prev => {
            const next = prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col];
            localStorage.setItem('nl_inbound_visible_cols', JSON.stringify(next));
            return next;
        });
    };

    const toggleFullscreen = () => {
        if (!isFullscreen) containerRef.current?.requestFullscreen?.();
        else document.exitFullscreen?.();
        setIsFullscreen(!isFullscreen);
    };

    // ======================== DARK MODE GRID SX ========================
    const gridSx = useNlGridSx(isDarkMode);

    // ======================== COLUMN DEFS (multi-entry) ========================
    const columnDefs = useMemo(() => {
        const cols: any[] = [{
            headerName: '#',
            valueGetter: (p: any) => p.node?.rowIndex != null ? p.node.rowIndex + 1 : '',
            width: 55, pinned: 'left', sortable: false, filter: false, editable: false,
            cellStyle: { color: '#64748b', fontSize: '0.75rem', textAlign: 'center' },
        }];

        visibleColumns.forEach((col: string) => {
            const isUserInput = USER_INPUT_FIELDS.includes(col);
            const isAutoField = AUTO_FIELDS.includes(col);
            const colDef: any = {
                field: col,
                headerName: col.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                minWidth: ['box_id', 'vrp_id'].includes(col) ? 130 : col === 'remarks' ? 140 : 100,
                flex: col === 'remarks' ? 2 : 1,
                suppressKeyboardEvent,
                editable: isUserInput,
            };

            if (col === 'route') { colDef.cellEditor = 'agSelectCellEditor'; colDef.cellEditorParams = { values: ['direct', 'qc'] }; }
            if (['declared_qty', 'actual_qty', 'short_qty'].includes(col)) colDef.type = 'numericColumn';
            if (col === 'short_qty') { colDef.cellStyle = (p: any) => p.value > 0 ? { color: '#ef4444', fontWeight: 700 } : null; colDef.editable = false; }
            if (isAutoField && col !== 'short_qty') { colDef.cellStyle = { color: isDarkMode ? '#94a3b8' : '#64748b' }; colDef.editable = false; }
            if (col === 'box_id') {
                colDef.cellStyle = (p: any) => {
                    if (p.data._vrpFound) return { color: '#22c55e', fontWeight: 600 };
                    if (p.data._error) return { color: '#ef4444' };
                    return null;
                };
            }
            cols.push(colDef);
        });

        // Print column
        cols.push({
            headerName: '🖨️', width: 50, sortable: false, filter: false, editable: false,
            cellRenderer: (params: any) => {
                if (!params.data._vrpFound) return null;
                return <IconButton aria-label="Action" size="small" onClick={(e: any) => { e.stopPropagation(); printBoxSticker(params.data); }}
                    sx={{ p: 0.5, color: '#16a34a', '&:hover': { backgroundColor: 'rgba(22, 163, 74, 0.1)' } }} title="Print sticker">
                    <span style={{ fontSize: '16px' }}>🖨️</span></IconButton>;
            },
            cellStyle: { textAlign: 'center', padding: '0 4px' },
        });

        // Status column
        cols.push({
            headerName: '✓', width: 45, sortable: false, filter: false, editable: false,
            cellRenderer: (params: any) => {
                if (params.data._vrpFound) return <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 18 }} />;
                if (params.data._error) return <Tooltip title={params.data._error}><span style={{ color: '#ef4444', cursor: 'help' }}>⚠</span></Tooltip>;
                return null;
            },
        });

        // Delete column
        cols.push({
            headerName: '', width: 45, sortable: false, filter: false, editable: false,
            cellRenderer: (params: any) => {
                if (!params.data.box_id?.trim()) return null;
                return <IconButton aria-label="Action" size="small" color="error" onClick={() => handleDeleteRow(params.node.rowIndex)}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>;
            },
        });

        return cols;
    }, [visibleColumns, suppressKeyboardEvent, handleDeleteRow, printBoxSticker, isDarkMode]);

    // ======================== LIST COLUMN DEFS (box-level) ========================
    const listColumnDefs = useMemo(() => [
        { field: 'box_id', headerName: 'Box ID', width: 140, pinned: 'left' as const },
        { field: 'vrp_id', headerName: 'VRP ID', width: 130 },
        { field: 'category', headerName: 'Category', flex: 1, minWidth: 120 },
        { field: 'lot_type', headerName: 'Lot Type', width: 100 },
        { field: 'region', headerName: 'Region', width: 110 },
        { field: 'declared_qty', headerName: 'Decl Qty', width: 90, type: 'numericColumn' },
        { field: 'actual_qty', headerName: 'Act Qty', width: 85, type: 'numericColumn' },
        { headerName: 'Short', width: 80, type: 'numericColumn', valueGetter: (p: any) => (p.data?.declared_qty || 0) - (p.data?.actual_qty || 0), cellStyle: (p: any) => p.value > 0 ? { color: '#ef4444', fontWeight: 700 } : null },
        { field: 'route', headerName: 'Route', width: 80 },
        { field: 'remarks', headerName: 'Remarks', flex: 1, minWidth: 120 },
        { field: 'session_id', headerName: 'Session / Batch', flex: 1.5, minWidth: 200 },
        { field: 'inbound_date', headerName: 'Inbound Date', width: 120, valueFormatter: (p: any) => formatDate(p.value) },
        { field: 'vehicle_no', headerName: 'Vehicle', width: 120 },
        { field: 'received_by_name', headerName: 'Received By', width: 130 },
        { field: 'received_at', headerName: 'Received At', width: 140, valueFormatter: (p: any) => formatDate(p.value) },
    ], []);

    const defaultColDef = useMemo(() => ({
        sortable: gridSettings.sortable, filter: gridSettings.filter, resizable: gridSettings.resizable, suppressMovable: true,
    }), [gridSettings]);

    const filledCount = rows.filter(r => r.box_id?.trim() && r._vrpFound).length;
    const totalQty = rows.filter(r => r._vrpFound).reduce((sum, r) => sum + (r.actual_qty || 0), 0);
    const listHasFilters = !!(listSearch || listDateFrom || listDateTo);

    if (!user) return <AppLayout><Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><CircularProgress /></Box></AppLayout>;
    if (!activeWarehouse) return <AppLayout><Box sx={{ p: 3, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Alert severity="warning" sx={{ maxWidth: 400 }}>No active warehouse selected.</Alert></Box></AppLayout>;

    return (
        <AppLayout>
            <Toaster position="top-right" containerStyle={{ zIndex: 99999 }} toastOptions={{ duration: 3000, style: { background: '#363636', color: '#fff', borderRadius: '10px', padding: '16px', fontWeight: 600 } }} />

            <Box ref={containerRef} sx={{
                height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                '& *': { transition: 'none !important' },
            }}>
                <StandardPageHeader title="NL Inbound" subtitle="Multi-entry box scanning" icon="📥" warehouseName={activeWarehouse?.name} />
                <StandardTabs value={tabValue} onChange={(_e: any, v: number) => setTabValue(v)} tabs={visibleTabs} color="#1e40af" />

                {/* ================== MULTI ENTRY TAB ================== */}
                {currentTabCode === 'multi_entry' && (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: { xs: 0.5, sm: 1 }, bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa' }}>
                        <Paper sx={{ p: 1.5, mb: 1, borderRadius: 2 }}>
                            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" flexWrap="wrap">
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <TextField size="small" label="Inbound Date" type="date" value={inboundDate} onChange={(e) => setInboundDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
                                    <TextField size="small" label="Vehicle No." value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value.toUpperCase())} sx={{ width: 150 }} />
                                    {filledCount > 0 && <Chip label={`${filledCount} boxes — ${totalQty} qty`} size="small" color="primary" variant="outlined" sx={{ fontWeight: 600 }} />}
                                    {draftLoaded && <Chip label="Draft saved" size="small" color="info" variant="outlined" icon={<SaveIcon sx={{ fontSize: 14 }} />} sx={{ fontWeight: 600 }} />}
                                </Stack>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                    {filledCount > 0 && (
                                        <>
                                            <Tooltip title="Save Draft Now"><IconButton aria-label="Action" size="small" onClick={saveDraftNow} color="info"><SaveIcon fontSize="small" /></IconButton></Tooltip>
                                            <Tooltip title="Clear Draft & Grid"><IconButton aria-label="Action" size="small" onClick={clearDraft} color="warning"><ClearAllIcon fontSize="small" /></IconButton></Tooltip>
                                        </>
                                    )}
                                    <Tooltip title={agentReady ? 'Print Agent Connected' : 'Print Agent Not Available'}>
                                        <Chip label={agentReady ? '🖨️ Ready' : '🖨️ Off'} size="small" color={agentReady ? 'success' : 'default'} variant="outlined" sx={{ fontSize: '0.7rem' }} />
                                    </Tooltip>
                                    <Button variant="contained" size="small" onClick={add500Rows} sx={{ height: 32, background: 'linear-gradient(135deg, #3b82f6, #1e40af)', fontWeight: 600, textTransform: 'none' }}>+500 Rows</Button>
                                    <IconButton aria-label="Action" size="small" onClick={() => setSettingsOpen(true)}><SettingsIcon /></IconButton>
                                    <IconButton aria-label="Action" size="small" onClick={toggleFullscreen}>{isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}</IconButton>
                                </Stack>
                            </Stack>
                        </Paper>

                        <Box sx={{ flex: 1, minHeight: 0 }}>
                            <Box className="ag-theme-quartz" sx={gridSx}>
                                <AgGridReact ref={gridRef} rowData={rows} columnDefs={columnDefs} defaultColDef={defaultColDef}
                                    rowHeight={tableRowHeight} headerHeight={40} animateRows={false} getRowId={(params: any) => params.data._rowId}
                                    onCellValueChanged={handleCellValueChanged} suppressCellFocus={false} singleClickEdit stopEditingWhenCellsLoseFocus
                                    rowBuffer={20} suppressScrollOnNewData debounceVerticalScrollbar valueCache
                                    containerStyle={{ height: '100%', width: '100%', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }}
                                    enterNavigatesVertically enterNavigatesVerticallyAfterEdit />
                            </Box>
                        </Box>

                        <Paper sx={{ p: 1, mt: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 2, bgcolor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Typography variant="body2" sx={{ fontWeight: 600, color: filledCount > 0 ? 'text.primary' : 'text.secondary' }}>{filledCount > 0 ? `${filledCount} box${filledCount !== 1 ? 'es' : ''} ready — ${totalQty} total qty` : 'No data entered yet'}</Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                                {filledCount > 0 && <Button variant="outlined" size="small" startIcon={<ClearAllIcon />} onClick={clearDraft} sx={{ textTransform: 'none' }}>Clear</Button>}
                                <Button variant="contained" color="success" size="small" startIcon={<SendIcon />} onClick={() => setSubmitDialogOpen(true)} disabled={filledCount === 0 || submitting} sx={{ textTransform: 'none', fontWeight: 600 }}>Submit All</Button>
                            </Stack>
                        </Paper>
                    </Box>
                )}

                {/* ================== INBOUND LIST TAB (box-level) ================== */}
                {currentTabCode === 'list' && (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: { xs: 1, sm: 1.5 }, bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa' }}>
                        <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
                            <TextField fullWidth size="small" placeholder="Search box ID, VRP, session, vehicle..."
                                value={listSearch} onChange={(e) => setListSearch(e.target.value)} sx={{ flex: 1, '& .MuiOutlinedInput-root': { height: 38 } }}
                                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="primary" /></InputAdornment> }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { setListPage(1); loadInboundList(); } }} />
                            <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={loadInboundList} disabled={listLoading} sx={{ height: 38 }}>Refresh</Button>
                            <Button variant="outlined" size="small" startIcon={<SettingsIcon />} onClick={() => setListOptionsPanelOpen(true)} sx={{ height: 38, position: 'relative' }}>
                                Options
                                {listHasFilters && <Box sx={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, bgcolor: '#ef4444', borderRadius: '50%' }} />}
                            </Button>
                        </Stack>

                        <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
                            <Chip label={`${listTotal} boxes`} size="small" color="primary" variant="outlined" />
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
                                    {listTotal > 0 ? `${(listPage - 1) * listLimit + 1} – ${Math.min(listPage * listLimit, listTotal)} of ${listTotal}` : '0 results'}
                                </Typography>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                    <IconButton aria-label="Action" size="small" disabled={listPage === 1} onClick={() => setListPage(1)}><FirstPage fontSize="small" /></IconButton>
                                    <IconButton aria-label="Action" size="small" disabled={listPage === 1} onClick={() => setListPage(listPage - 1)}><KeyboardArrowLeft fontSize="small" /></IconButton>
                                    <Pagination page={listPage} count={Math.ceil(listTotal / listLimit) || 1} size="small"
                                        onChange={(_, v) => setListPage(v)} siblingCount={1} boundaryCount={1}
                                        sx={{
                                            '& .MuiPaginationItem-root': { color: isDarkMode ? '#94a3b8' : 'inherit', minWidth: 28, height: 28 },
                                            '& .Mui-selected': { bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.3) !important' : 'rgba(25, 118, 210, 0.12) !important' },
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
                            batches={batches}
                            loading={batchLoading}
                            onRefresh={loadBatches}
                            onDelete={handleDeleteBatch}
                            canDelete={true}
                            title="Inbound Batch Management"
                            emptyMessage="No batches found"
                            emptySubMessage="Batches will appear here after inbound submissions"
                        />
                    </Box>
                )}

                {/* ================== BULK UPLOAD TAB ================== */}
                {currentTabCode === 'bulk' && (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', p: { xs: 1.5, sm: 3 }, bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa' }}>
                        <Paper sx={{ p: { xs: 2, sm: 4 }, borderRadius: 3, maxWidth: 600, mx: 'auto', width: '100%' }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Bulk Inbound Upload</Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                                Upload an Excel file with multiple boxes. All rows will be submitted as a single batch.
                            </Typography>
                            <Divider sx={{ mb: 3 }} />

                            <Stack direction="row" spacing={1.5} sx={{ mb: 3 }}>
                                <TextField size="small" label="Inbound Date" type="date" value={inboundDate} onChange={(e) => setInboundDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
                                <TextField size="small" label="Vehicle No. (optional)" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value.toUpperCase())} sx={{ flex: 1 }} />
                            </Stack>

                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Expected Columns</Typography>
                            <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                {['BOX ID *', 'VRP ID *', 'Actual Qty', 'Route', 'Remarks'].map(col => (
                                    <Chip key={col} label={col} size="small" variant="outlined" color={col.includes('*') ? 'primary' : 'default'} />
                                ))}
                            </Box>
                            <Stack spacing={2}>
                                <Button variant="outlined" size="large" startIcon={<DownloadIcon />} onClick={downloadBulkTemplate} fullWidth sx={{ py: 1.5 }}>Download Template</Button>
                                <input type="file" accept=".xlsx,.xls" ref={bulkFileRef} style={{ display: 'none' }} onChange={handleBulkUpload} />
                                <Button variant="contained" size="large" startIcon={bulkUploading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
                                    onClick={() => bulkFileRef.current?.click()} disabled={bulkUploading} fullWidth
                                    sx={{ py: 1.5, background: 'linear-gradient(135deg, #1e40af, #3b82f6)', '&:hover': { background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' } }}>
                                    {bulkUploading ? 'Uploading...' : 'Upload & Submit'}
                                </Button>
                            </Stack>
                            {bulkUploading && <LinearProgress sx={{ mt: 2 }} />}
                            <Alert severity="info" sx={{ mt: 3 }}>All rows will be submitted as a single batch. VRP IDs must exist in OS Data.</Alert>
                        </Paper>
                    </Box>
                )}
            </Box>

            {/* ================== SUBMIT DIALOG ================== */}
            <Dialog open={submitDialogOpen} onClose={() => setSubmitDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Submit Inbound?</DialogTitle>
                <DialogContent>
                    <Typography>Submit <strong>{filledCount} boxes</strong> with total qty <strong>{totalQty}</strong>{vehicleNo ? ` for vehicle ${vehicleNo}` : ''}?</Typography>
                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>A Batch ID will be auto-generated. This action cannot be undone.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" color="success" onClick={handleSubmit} disabled={submitting} startIcon={submitting ? <CircularProgress size={16} /> : <SendIcon />}>
                        {submitting ? 'Submitting...' : 'Confirm Submit'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ================== MULTI ENTRY OPTIONS PANEL ================== */}
            <Drawer anchor="right" open={settingsOpen} onClose={() => setSettingsOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 360 } } }}>
                <Box sx={{ p: 2, background: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: 'white', position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>Options Panel</Typography>
                    <IconButton aria-label="Action" onClick={() => setSettingsOpen(false)} sx={{ color: 'white' }}><CloseIcon /></IconButton>
                </Box>
                <Box sx={{ overflow: 'auto', flex: 1, p: 1 }}>
                    <Accordion expanded={settingsExpanded === 'columns'} onChange={(_, exp) => setSettingsExpanded(exp ? 'columns' : false)}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack direction="row" spacing={1} alignItems="center"><ViewColumnIcon fontSize="small" color="primary" /><Typography sx={{ fontWeight: 600 }}>Columns ({visibleColumns.length}/{ALL_GRID_COLUMNS.length})</Typography></Stack>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>User input columns (editable)</Typography>
                            {USER_INPUT_FIELDS.map((col: string) => (
                                <FormControlLabel key={col} control={<Checkbox checked={visibleColumns.includes(col)} onChange={() => toggleColumn(col)} size="small" />}
                                    label={col.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} sx={{ display: 'block', ml: 0 }} />
                            ))}
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>Auto-populated columns</Typography>
                            {AUTO_FIELDS.map((col: string) => (
                                <FormControlLabel key={col} control={<Checkbox checked={visibleColumns.includes(col)} onChange={() => toggleColumn(col)} size="small" />}
                                    label={col.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} sx={{ display: 'block', ml: 0 }} />
                            ))}
                        </AccordionDetails>
                    </Accordion>

                    <Accordion expanded={settingsExpanded === 'grid'} onChange={(_, exp) => setSettingsExpanded(exp ? 'grid' : false)}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 600 }}>Grid Settings</Typography></AccordionSummary>
                        <AccordionDetails>
                            <FormControlLabel control={<Switch checked={gridSettings.sortable} onChange={(e) => setGridSettings(p => ({ ...p, sortable: e.target.checked }))} />} label="Enable Sorting" sx={{ display: 'block' }} />
                            <FormControlLabel control={<Switch checked={gridSettings.filter} onChange={(e) => setGridSettings(p => ({ ...p, filter: e.target.checked }))} />} label="Enable Filtering" sx={{ display: 'block' }} />
                            <FormControlLabel control={<Switch checked={gridSettings.resizable} onChange={(e) => setGridSettings(p => ({ ...p, resizable: e.target.checked }))} />} label="Column Resize" sx={{ display: 'block' }} />
                        </AccordionDetails>
                    </Accordion>

                    <Accordion expanded={settingsExpanded === 'print'} onChange={(_, exp) => setSettingsExpanded(exp ? 'print' : false)}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 600 }}>Printing</Typography></AccordionSummary>
                        <AccordionDetails>
                            <FormControlLabel control={<Switch checked={autoPrintEnabled} onChange={(e) => setAutoPrintEnabled(e.target.checked)} />} label="Auto Print on VRP Lookup" sx={{ display: 'block' }} />
                            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>Ctrl+P — Reprint last scanned box sticker</Typography>
                            <Chip label={agentReady ? 'Agent Connected' : 'Agent Not Running'} size="small" color={agentReady ? 'success' : 'error'} variant="outlined" sx={{ mt: 1 }} />
                        </AccordionDetails>
                    </Accordion>

                    <Accordion expanded={settingsExpanded === 'actions'} onChange={(_, exp) => setSettingsExpanded(exp ? 'actions' : false)}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography sx={{ fontWeight: 600 }}>Actions</Typography></AccordionSummary>
                        <AccordionDetails>
                            <Stack spacing={1}>
                                <Button fullWidth variant="outlined" startIcon={<ExportIcon />} onClick={exportToExcel} disabled={filledCount === 0}>Export Grid to Excel</Button>
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                </Box>
            </Drawer>

            {/* ================== LIST OPTIONS PANEL ================== */}
            <Drawer anchor="right" open={listOptionsPanelOpen} onClose={() => setListOptionsPanelOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 360 } } }}>
                <Box sx={{ p: 2, background: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: 'white', position: 'sticky', top: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>Inbound List Options</Typography>
                    <IconButton aria-label="Action" onClick={() => setListOptionsPanelOpen(false)} sx={{ color: 'white' }}><CloseIcon /></IconButton>
                </Box>
                <Box sx={{ overflow: 'auto', flex: 1, p: 2 }}>
                    <Accordion expanded={listSettingsExpanded === 'filters'} onChange={(_, exp) => setListSettingsExpanded(exp ? 'filters' : false)}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <FilterListIcon fontSize="small" color="primary" />
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
                        <Button variant="outlined" fullWidth startIcon={<RefreshIcon />} onClick={loadInboundList} disabled={listLoading}>Refresh</Button>
                    </Stack>
                </Box>
            </Drawer>
        </AppLayout>
    );
}
