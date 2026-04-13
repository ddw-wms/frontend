'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Box, Paper, Typography, Button, TextField, MenuItem, Chip, Stack,
    CircularProgress, Alert, Card, CardContent, useMediaQuery, useTheme,
    IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
    Tooltip,
} from '@mui/material';
import {
    Add as AddIcon, Refresh as RefreshIcon,
    Send as SendIcon,
    LocalShipping as LocalShippingIcon,
    Delete as DeleteIcon,
    Cancel as CancelIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';
import { nlDispatchAPI } from '@/lib/nl-api';
import { useNlGridSx, nlFormatDateTime } from '@/lib/nl-utils';
import { customerAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import { StandardPageHeader, StandardTabs } from '@/components';
import { useTableRowHeight } from '@/app/context/AppearanceContext';
import { usePagePermissions } from '@/hooks/usePagePermissions';
import toast, { Toaster } from 'react-hot-toast';
import { AgGridReact } from '@/components/AGGridScrollWrapper';
import { ModuleRegistry, AllCommunityModule, ClientSideRowModelModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

const formatDate = nlFormatDateTime;

const ALL_TABS = ['Dispatch Entry', 'Dispatched List', 'Session History'];
const TAB_CODES = ['dispatch', 'dispatched', 'history'];

const DISPATCH_MODES = [
    { value: 'direct_box', label: 'Direct Box' },
    { value: 'order_level', label: 'Order Level' },
    { value: 'mixed_items', label: 'Mixed Items' },
];

export default function NLDispatchPage() {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const { activeWarehouse } = useWarehouse();
    const [user, setUser] = useState<any>(null);
    const tableRowHeight = useTableRowHeight();
    const { filterTabs, canSeeTab, isAdmin } = usePagePermissions('nl_dispatch');

    const gridSx = useNlGridSx(isDarkMode);

    const visibleTabs = useMemo(() => { const f = filterTabs(ALL_TABS, TAB_CODES); return f.length > 0 ? f : ALL_TABS; }, [filterTabs]);
    const visibleTabCodes = useMemo(() => { if (isAdmin) return TAB_CODES; const f = TAB_CODES.filter(c => canSeeTab(c)); return f.length > 0 ? f : TAB_CODES; }, [canSeeTab, isAdmin]);

    const [tabValue, setTabValue] = useState(0);
    const currentTabCode = visibleTabCodes[tabValue] || 'dispatch';

    // Session state
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [dispatchMode, setDispatchMode] = useState<'direct_box' | 'order_level' | 'mixed_items'>('direct_box');
    const [customerId, setCustomerId] = useState<number | ''>('');
    const [customers, setCustomers] = useState<any[]>([]);
    const [entries, setEntries] = useState<any[]>([]);
    const [sessionTotals, setSessionTotals] = useState({ total_boxes: 0, total_qty: 0, total_items: 0 });
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
    const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
    const [vehicleNo, setVehicleNo] = useState('');

    // Multi-entry grid state
    const dispatchGridRef = useRef<any>(null);
    const dispatchRowIdCounterRef = useRef(0);
    const dispatchRowsRef = useRef<any[]>([]);
    const dispatchPendingScansRef = useRef(new Set<string>());
    const [dispatchRows, setDispatchRows] = useState<any[]>([]);

    const generateDispatchEmptyRows = useCallback((count: number) => {
        return Array.from({ length: count }, () => {
            dispatchRowIdCounterRef.current += 1;
            return {
                _rowId: `disp_${dispatchRowIdCounterRef.current}_${Date.now()}`,
                _scanned: false, _error: '', _loading: false,
                id: '', box_id: '', vrp_id: '', category: '', lot_type: '', qty: null, dispatch_price: null, created_at: '',
            };
        });
    }, []);

    useEffect(() => { dispatchRowsRef.current = dispatchRows; }, [dispatchRows]);

    // History state
    const [sessions, setSessions] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Dispatched list state
    const [dispatchedEntries, setDispatchedEntries] = useState<any[]>([]);
    const [dispatchedLoading, setDispatchedLoading] = useState(false);

    useEffect(() => {
        const stored = getStoredUser();
        if (stored) setUser(stored);
    }, []);

    useEffect(() => {
        const loadCustomers = async () => {
            try {
                const res = await customerAPI.getAll(activeWarehouse?.id);
                setCustomers(res.data?.data || res.data || []);
            } catch { /* ignore */ }
        };
        if (activeWarehouse?.id) loadCustomers();
    }, [activeWarehouse?.id]);

    useEffect(() => {
        if (!activeWarehouse?.id) return;
        loadDraftSession();
    }, [activeWarehouse?.id]);

    const loadDraftSession = async () => {
        if (!activeWarehouse?.id) return;
        try {
            setLoading(true);
            const res = await nlDispatchAPI.getDraftSession(activeWarehouse.id);
            if (res.data?.session) {
                setSessionId(res.data.session.id);
                setDispatchMode(res.data.session.dispatch_mode || res.data.session.dispatch_type || 'direct_box');
                setCustomerId(res.data.session.customer_id || '');
                const existingEntries = res.data.entries || [];
                setEntries(existingEntries);
                setSessionTotals({
                    total_boxes: res.data.session.total_boxes || 0,
                    total_qty: res.data.session.total_qty || 0,
                    total_items: res.data.session.total_items || 0,
                });
                // Build grid rows from existing entries
                const scannedRows = existingEntries.map((e: any) => {
                    dispatchRowIdCounterRef.current += 1;
                    return {
                        _rowId: `disp_${dispatchRowIdCounterRef.current}_${Date.now()}`,
                        _scanned: true, _error: '', _loading: false,
                        id: e.id, box_id: e.box_id, vrp_id: e.vrp_id,
                        category: e.category, lot_type: e.lot_type, qty: e.qty,
                        dispatch_price: e.dispatch_price, created_at: e.created_at,
                    };
                });
                setDispatchRows([...scannedRows, ...generateDispatchEmptyRows(100)]);
                setTimeout(() => {
                    const api = dispatchGridRef.current?.api;
                    if (api) {
                        api.setFocusedCell(scannedRows.length, 'box_id');
                        api.startEditingCell({ rowIndex: scannedRows.length, colKey: 'box_id' });
                    }
                }, 300);
            }
        } catch (error: any) {
            if (error?.response?.status !== 404) console.error('Failed to load draft:', error);
        } finally {
            setLoading(false);
        }
    };

    const createNewSession = async () => {
        if (!activeWarehouse?.id || !customerId) {
            toast.error('Select a customer first');
            return;
        }
        try {
            setLoading(true);
            const res = await nlDispatchAPI.createSession({
                warehouse_id: activeWarehouse.id,
                customer_id: Number(customerId),
                dispatch_mode: dispatchMode,
                vehicle_no: vehicleNo || undefined,
            } as any);
            setSessionId(res.data.session.id);
            setEntries([]);
            setSessionTotals({ total_boxes: 0, total_qty: 0, total_items: 0 });
            setDispatchRows(generateDispatchEmptyRows(100));
            toast.success('New dispatch session created');
            setTimeout(() => {
                const api = dispatchGridRef.current?.api;
                if (api) {
                    api.setFocusedCell(0, 'box_id');
                    api.startEditingCell({ rowIndex: 0, colKey: 'box_id' });
                }
            }, 200);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to create session');
        } finally {
            setLoading(false);
        }
    };

    // Scan box via API and populate row
    const scanBoxForRow = useCallback(async (boxId: string, rowIndex: number) => {
        if (!boxId?.trim() || !sessionId || !activeWarehouse?.id) return;
        const key = `${rowIndex}_${boxId.trim().toUpperCase()}`;
        if (dispatchPendingScansRef.current.has(key)) return;
        dispatchPendingScansRef.current.add(key);

        setDispatchRows(prev => {
            const u = [...prev];
            if (u[rowIndex]) u[rowIndex] = { ...u[rowIndex], _loading: true, _error: '' };
            return u;
        });

        try {
            const res = await nlDispatchAPI.scanBox(sessionId, {
                warehouse_id: activeWarehouse.id,
                box_id: boxId.trim(),
            });
            const entry = res.data.entry;
            const totals = res.data.session_totals;

            setDispatchRows(prev => {
                const u = [...prev];
                if (u[rowIndex]) {
                    u[rowIndex] = {
                        ...u[rowIndex],
                        _scanned: true, _loading: false, _error: '',
                        id: entry.id, box_id: entry.box_id, vrp_id: entry.vrp_id,
                        category: entry.category, lot_type: entry.lot_type, qty: entry.qty,
                        dispatch_price: entry.dispatch_price, created_at: entry.created_at,
                    };
                }
                return u;
            });

            setSessionTotals(totals || { total_boxes: 0, total_qty: 0, total_items: 0 });
            setEntries(prev => [entry, ...prev]);

            setTimeout(() => {
                const api = dispatchGridRef.current?.api;
                if (api) {
                    const node = api.getRowNode(dispatchRowsRef.current[rowIndex]?._rowId);
                    if (node) api.refreshCells({ rowNodes: [node], force: true });
                }
            }, 50);

            toast.success(`Box ${entry.box_id} added`);

            setTimeout(() => {
                const api = dispatchGridRef.current?.api;
                if (api) {
                    api.setFocusedCell(rowIndex + 1, 'box_id');
                    api.startEditingCell({ rowIndex: rowIndex + 1, colKey: 'box_id' });
                }
            }, 100);
        } catch (error: any) {
            const errMsg = error?.response?.data?.error || 'Scan failed';
            setDispatchRows(prev => {
                const u = [...prev];
                if (u[rowIndex]) u[rowIndex] = { ...u[rowIndex], _loading: false, _error: errMsg };
                return u;
            });
            toast.error(errMsg);
            setTimeout(() => {
                const api = dispatchGridRef.current?.api;
                if (api) {
                    api.setFocusedCell(rowIndex, 'box_id');
                    api.startEditingCell({ rowIndex, colKey: 'box_id' });
                }
            }, 100);
        } finally {
            dispatchPendingScansRef.current.delete(key);
        }
    }, [sessionId, activeWarehouse?.id]);

    const handleDispatchCellChanged = useCallback((event: any) => {
        const { colDef, rowIndex, newValue } = event;
        if (colDef?.field !== 'box_id' || !newValue?.trim()) return;
        const upper = newValue.trim().toUpperCase();
        setDispatchRows(prev => {
            const u = [...prev];
            if (u[rowIndex]) u[rowIndex] = { ...u[rowIndex], box_id: upper };
            return u;
        });
        scanBoxForRow(upper, rowIndex);
        if (rowIndex >= dispatchRowsRef.current.length - 5) {
            setDispatchRows(prev => [...prev, ...generateDispatchEmptyRows(100)]);
        }
    }, [scanBoxForRow, generateDispatchEmptyRows]);

    const suppressDispatchKeyboardEvent = useCallback((params: any) => {
        if (params.editing && params.event.key === 'Enter') {
            params.api.stopEditing();
            setTimeout(() => {
                const rowData = params.node.data;
                const ri = params.node.rowIndex;
                if (rowData.box_id?.trim() && !rowData._scanned) {
                    scanBoxForRow(rowData.box_id.trim().toUpperCase(), ri);
                } else {
                    params.api.setFocusedCell(ri + 1, 'box_id');
                    setTimeout(() => params.api.startEditingCell({ rowIndex: ri + 1, colKey: 'box_id' }), 50);
                }
            }, 20);
            return true;
        }
        return false;
    }, [scanBoxForRow]);

    const handleDeleteDispatchEntry = async (entryId: string, rowIndex: number) => {
        if (!sessionId || !entryId) return;
        try {
            const res = await nlDispatchAPI.deleteEntry(sessionId, entryId);
            setEntries(prev => prev.filter(e => e.id !== entryId));
            setSessionTotals(res.data.session_totals || sessionTotals);
            dispatchRowIdCounterRef.current += 1;
            setDispatchRows(prev => {
                const u = [...prev];
                u[rowIndex] = {
                    _rowId: `disp_${dispatchRowIdCounterRef.current}_${Date.now()}`,
                    _scanned: false, _error: '', _loading: false,
                    id: '', box_id: '', vrp_id: '', category: '', lot_type: '', qty: null, dispatch_price: null, created_at: '',
                };
                return u;
            });
            toast.success('Entry removed');
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to remove entry');
        }
    };

    const handleSubmit = async () => {
        if (!sessionId || entries.length === 0) return;
        try {
            setSubmitting(true);
            const res = await nlDispatchAPI.submitSession(sessionId, { warehouse_id: activeWarehouse.id });
            toast.success(`Dispatch submitted: ${res.data.session_id}`);
            setSessionId(null);
            setEntries([]);
            setSessionTotals({ total_boxes: 0, total_qty: 0, total_items: 0 });
            setDispatchRows([]);
            setSubmitDialogOpen(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Submit failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDiscardSession = async () => {
        if (!sessionId) return;
        try {
            await nlDispatchAPI.discardSession(sessionId);
            setSessionId(null);
            setEntries([]);
            setSessionTotals({ total_boxes: 0, total_qty: 0, total_items: 0 });
            setDispatchRows([]);
            setCustomerId('');
            setVehicleNo('');
            toast.success('Session discarded');
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to discard session');
        }
    };

    const requestDiscardSession = () => {
        if (!sessionId) return;
        setDiscardDialogOpen(true);
    };

    // ===== DISPATCHED LIST =====
    const loadDispatchedEntries = useCallback(async () => {
        if (!activeWarehouse?.id) return;
        try {
            setDispatchedLoading(true);
            const res = await nlDispatchAPI.listSessions({ warehouse_id: activeWarehouse.id, status: 'submitted' });
            setDispatchedEntries(res.data?.data || []);
        } catch {
            toast.error('Failed to load dispatched list');
        } finally {
            setDispatchedLoading(false);
        }
    }, [activeWarehouse?.id]);

    // ===== SESSION HISTORY =====
    const loadHistory = useCallback(async () => {
        if (!activeWarehouse?.id) return;
        try {
            setHistoryLoading(true);
            const res = await nlDispatchAPI.listSessions({ warehouse_id: activeWarehouse.id });
            setSessions(res.data?.data || []);
        } catch {
            toast.error('Failed to load sessions');
        } finally {
            setHistoryLoading(false);
        }
    }, [activeWarehouse?.id]);

    useEffect(() => {
        if (currentTabCode === 'history') loadHistory();
        if (currentTabCode === 'dispatched') loadDispatchedEntries();
    }, [currentTabCode, loadHistory, loadDispatchedEntries]);

    // ===== COLUMN DEFS =====
    const dispatchEntryColDefs = useMemo(() => [
        {
            headerName: '', width: 45, sortable: false, filter: false, suppressKeyboardEvent: suppressDispatchKeyboardEvent,
            cellRenderer: (p: any) => {
                if (p.data._loading) return <CircularProgress size={16} sx={{ mt: 0.5 }} />;
                if (p.data._scanned) return <CheckCircleIcon fontSize="small" sx={{ color: '#10b981', mt: 0.5 }} />;
                if (p.data._error) return <Tooltip title={p.data._error}><WarningIcon fontSize="small" sx={{ color: '#ef4444', mt: 0.5 }} /></Tooltip>;
                return <Typography variant="body2" sx={{ mt: 0.5, color: 'text.disabled' }}>{p.node.rowIndex + 1}</Typography>;
            },
        },
        {
            field: 'box_id', headerName: 'Box ID', flex: 1, minWidth: 150,
            editable: (p: any) => !p.data._scanned,
            suppressKeyboardEvent: suppressDispatchKeyboardEvent,
            cellStyle: (p: any) => p.data._error ? { backgroundColor: 'rgba(239,68,68,0.1)' } : undefined,
        },
        { field: 'vrp_id', headerName: 'VRP ID', width: 130, suppressKeyboardEvent: suppressDispatchKeyboardEvent },
        { field: 'category', headerName: 'Category', width: 120, suppressKeyboardEvent: suppressDispatchKeyboardEvent },
        { field: 'lot_type', headerName: 'Lot', width: 70, suppressKeyboardEvent: suppressDispatchKeyboardEvent },
        { field: 'qty', headerName: 'Qty', width: 70, type: 'numericColumn', suppressKeyboardEvent: suppressDispatchKeyboardEvent },
        {
            field: 'created_at', headerName: 'Time', width: 110, suppressKeyboardEvent: suppressDispatchKeyboardEvent,
            valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleTimeString() : '',
        },
        {
            headerName: '', width: 50, sortable: false, filter: false,
            cellRenderer: (p: any) => p.data._scanned ? (
                <IconButton aria-label="Action" size="small" color="error" onClick={() => handleDeleteDispatchEntry(p.data.id, p.node.rowIndex)} title="Remove">
                    <DeleteIcon fontSize="small" />
                </IconButton>
            ) : null,
        },
    ], [suppressDispatchKeyboardEvent]);

    const dispatchedColDefs = useMemo(() => [
        { field: 'session_id', headerName: 'Session ID', flex: 2, minWidth: 220 },
        { field: 'dispatch_mode', headerName: 'Mode', width: 110 },
        { field: 'customer_name', headerName: 'Customer', flex: 1, minWidth: 130 },
        { field: 'total_boxes', headerName: 'Boxes', width: 80, type: 'numericColumn' },
        { field: 'total_qty', headerName: 'Qty', width: 80, type: 'numericColumn' },
        { field: 'vehicle_no', headerName: 'Vehicle', width: 120 },
        { field: 'dispatch_date', headerName: 'Date', width: 140, valueFormatter: (p: any) => formatDate(p.value) },
        { field: 'created_by_name', headerName: 'By', width: 120 },
    ], []);

    const historyColumnDefs = useMemo(() => [
        { field: 'session_id', headerName: 'Session ID', flex: 2, minWidth: 220 },
        { field: 'dispatch_mode', headerName: 'Mode', width: 110 },
        { field: 'customer_name', headerName: 'Customer', flex: 1, minWidth: 130 },
        { field: 'total_boxes', headerName: 'Boxes', width: 80, type: 'numericColumn' },
        { field: 'total_qty', headerName: 'Qty', width: 80, type: 'numericColumn' },
        { field: 'dispatch_date', headerName: 'Date', width: 120, valueFormatter: (p: any) => formatDate(p.value) },
        {
            field: 'status', headerName: 'Status', width: 110,
            cellRenderer: (p: any) => <Chip label={p.value} size="small" color={p.value === 'submitted' ? 'success' : 'warning'} variant="outlined" />,
        },
    ], []);

    const defaultColDef = useMemo(() => ({ sortable: false, filter: false, resizable: true, suppressMovable: true }), []);

    if (!user) {
        return <AppLayout><Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><CircularProgress /></Box></AppLayout>;
    }
    if (!activeWarehouse) {
        return <AppLayout><Box sx={{ p: 3, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Alert severity="warning">No active warehouse selected.</Alert></Box></AppLayout>;
    }

    return (
        <AppLayout>
            <Toaster position="top-right" containerStyle={{ zIndex: 99999 }} toastOptions={{ duration: 3000, style: { background: '#363636', color: '#fff', borderRadius: '10px', padding: '16px', fontWeight: 600 } }} />

            <Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}>
                <StandardPageHeader title="NL Dispatch" subtitle="Dispatch boxes & items to customers" icon="ðŸšš" warehouseName={activeWarehouse?.name} />
                <StandardTabs value={tabValue} onChange={(e, v) => setTabValue(v)} tabs={visibleTabs} color="#dc2626" />

                {/* ===== DISPATCH ENTRY ===== */}
                {currentTabCode === 'dispatch' && (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: { xs: 1, sm: 1.5 } }}>
                        <Stack direction={isMobile ? 'column' : 'row'} spacing={1.5} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
                            <Card sx={{ flex: 1, minWidth: 110, background: 'linear-gradient(135deg, #dc2626, #f87171)', color: 'white' }}>
                                <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
                                    <Typography variant="caption" sx={{ opacity: 0.8 }}>Boxes</Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{sessionTotals.total_boxes}</Typography>
                                </CardContent>
                            </Card>
                            <Card sx={{ flex: 1, minWidth: 110, background: 'linear-gradient(135deg, #059669, #10b981)', color: 'white' }}>
                                <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
                                    <Typography variant="caption" sx={{ opacity: 0.8 }}>Total Qty</Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{sessionTotals.total_qty}</Typography>
                                </CardContent>
                            </Card>
                        </Stack>

                        {!sessionId ? (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>No active dispatch session</Typography>
                                <Paper sx={{ p: 3, maxWidth: 500, mx: 'auto', borderRadius: 2 }}>
                                    <Stack spacing={2}>
                                        <TextField label="Customer" value={customerId} onChange={(e) => setCustomerId(Number(e.target.value))} size="small" select fullWidth>
                                            <MenuItem value="">-- Select Customer --</MenuItem>
                                            {customers.map((c: any) => (
                                                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                            ))}
                                        </TextField>
                                        <TextField label="Dispatch Mode" value={dispatchMode} onChange={(e) => setDispatchMode(e.target.value as any)} size="small" select fullWidth>
                                            {DISPATCH_MODES.map((m) => (
                                                <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                                            ))}
                                        </TextField>
                                        <TextField label="Vehicle No (optional)" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} size="small" fullWidth />
                                        <Button variant="contained" size="large" startIcon={<LocalShippingIcon />} onClick={createNewSession} disabled={loading || !customerId}>
                                            Start Dispatch Session
                                        </Button>
                                    </Stack>
                                </Paper>
                            </Box>
                        ) : (
                            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                <Box sx={{ flex: 1, minHeight: 0 }}>
                                    <Box className="ag-theme-quartz" sx={gridSx}>
                                        <AgGridReact
                                            ref={dispatchGridRef}
                                            rowData={dispatchRows}
                                            columnDefs={dispatchEntryColDefs}
                                            defaultColDef={defaultColDef}
                                            rowHeight={tableRowHeight}
                                            headerHeight={40}
                                            animateRows={false}
                                            getRowId={(p: any) => p.data._rowId}
                                            onCellValueChanged={handleDispatchCellChanged}
                                            suppressCellFocus={false}
                                            singleClickEdit
                                            stopEditingWhenCellsLoseFocus
                                        />
                                    </Box>
                                </Box>

                                <Paper sx={{ p: 1.5, mt: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 1 : 0, alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', borderRadius: 2, bgcolor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {entries.length} entries - {sessionTotals.total_boxes} boxes - {sessionTotals.total_qty} qty
                                        </Typography>
                                        <Button variant="outlined" color="error" size="small" startIcon={<CancelIcon />} onClick={requestDiscardSession}>
                                            Discard
                                        </Button>
                                    </Stack>
                                    <Button variant="contained" color="success" startIcon={<SendIcon />} onClick={() => setSubmitDialogOpen(true)} disabled={entries.length === 0 || submitting}>
                                        Submit Dispatch
                                    </Button>
                                </Paper>
                            </Box>
                        )}
                    </Box>
                )}

                {/* ===== DISPATCHED LIST ===== */}
                {currentTabCode === 'dispatched' && (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: { xs: 1, sm: 1.5 } }}>
                        <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={loadDispatchedEntries} disabled={dispatchedLoading} sx={{ mb: 1, alignSelf: 'flex-start' }}>Refresh</Button>
                        <Box sx={{ flex: 1, minHeight: 0 }}>
                            <Box className="ag-theme-quartz" sx={gridSx}>
                                <AgGridReact
                                    rowData={dispatchedEntries}
                                    columnDefs={dispatchedColDefs}
                                    defaultColDef={defaultColDef}
                                    rowHeight={tableRowHeight}
                                    headerHeight={40}
                                    animateRows={false}
                                    suppressCellFocus
                                    loading={dispatchedLoading}
                                />
                            </Box>
                        </Box>
                    </Box>
                )}

                {/* ===== SESSION HISTORY ===== */}
                {currentTabCode === 'history' && (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: { xs: 1, sm: 1.5 } }}>
                        <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={loadHistory} disabled={historyLoading} sx={{ mb: 1, alignSelf: 'flex-start' }}>Refresh</Button>
                        <Box sx={{ flex: 1, minHeight: 0 }}>
                            <Box className="ag-theme-quartz" sx={gridSx}>
                                <AgGridReact rowData={sessions} columnDefs={historyColumnDefs} defaultColDef={defaultColDef} rowHeight={tableRowHeight} headerHeight={40} animateRows={false} suppressCellFocus loading={historyLoading} />
                            </Box>
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Submit Dialog */}
            <Dialog open={submitDialogOpen} onClose={() => setSubmitDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Submit Dispatch?</DialogTitle>
                <DialogContent>
                    <Typography>This will dispatch <strong>{sessionTotals.total_boxes} boxes</strong> ({sessionTotals.total_qty} qty) to the customer.</Typography>
                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>This action cannot be undone.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" color="success" onClick={handleSubmit} disabled={submitting} startIcon={submitting ? <CircularProgress size={16} /> : <SendIcon />}>
                        {submitting ? 'Submitting...' : 'Confirm Dispatch'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={discardDialogOpen} onClose={() => setDiscardDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Discard Dispatch Session?</DialogTitle>
                <DialogContent>
                    <Typography>This will remove all scanned dispatch entries in this draft session.</Typography>
                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>This action cannot be undone.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDiscardDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={async () => {
                            setDiscardDialogOpen(false);
                            await handleDiscardSession();
                        }}
                    >
                        Discard Session
                    </Button>
                </DialogActions>
            </Dialog>
        </AppLayout>
    );
}
