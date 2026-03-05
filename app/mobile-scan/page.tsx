'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Box, Typography, Button, TextField, Stack, Card, CardContent,
    IconButton, Chip, Alert, CircularProgress, Divider, useTheme,
    AppBar, Toolbar, ToggleButton, ToggleButtonGroup, Dialog, DialogTitle,
    DialogContent, DialogActions, Collapse,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    CameraAlt as CameraIcon,
    CheckCircle as CheckCircleIcon,
    VolumeUp as VolumeUpIcon,
    VolumeOff as VolumeOffIcon,
    Delete as DeleteIcon,
    Send as SendIcon,
    PlayArrow as StartIcon,
    ExpandMore as ExpandMoreIcon,
    Settings as SetupIcon,
} from '@mui/icons-material';
import { qcAPI, outboundAPI, pickingAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import CameraScanner from '@/components/CameraScanner';
import CustomerAutocomplete from '@/components/CustomerAutocomplete';
import toast, { Toaster } from 'react-hot-toast';

type ScanMode = 'qc' | 'outbound' | 'picking';

interface ScannedEntry {
    id: string;
    wsn: string;
    scannedAt: number;
    qcGrade?: string;
    productSerialNumber?: string;
    rackNo?: string;
    qcRemarks?: string;
}

const MODE_CONFIG: Record<ScanMode, { title: string; color: string; icon: string }> = {
    qc: { title: 'QC Scan', color: '#7c3aed', icon: '🔍' },
    outbound: { title: 'Dispatch Scan', color: '#1e40af', icon: '📦' },
    picking: { title: 'Picking Scan', color: '#059669', icon: '📋' },
};

function playBeep() {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 1200;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch { /* no audio */ }
}

const DRAFT_LS_KEY = 'mobileScan_draft';

export default function MobileScanPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { activeWarehouse } = useWarehouse();
    const mode = (searchParams.get('mode') as ScanMode) || 'qc';
    const config = MODE_CONFIG[mode] || MODE_CONFIG.qc;

    // Phase
    const [phase, setPhase] = useState<'setup' | 'scanning'>('setup');
    const [cameraOpen, setCameraOpen] = useState(false);
    const [soundOn, setSoundOn] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [manualWSN, setManualWSN] = useState('');
    const [resultDialog, setResultDialog] = useState<{ open: boolean; batchId: string; count: number }>({
        open: false, batchId: '', count: 0,
    });

    // Scanned entries
    const [scannedEntries, setScannedEntries] = useState<ScannedEntry[]>([]);
    const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
    const wsnInputRef = useRef<HTMLInputElement>(null);
    const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // QC setup
    const [qcByName, setQcByName] = useState('');
    const [qcDate, setQcDate] = useState(new Date().toISOString().split('T')[0]);

    // Outbound setup
    const [customerName, setCustomerName] = useState('');
    const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
    const [vehicleNo, setVehicleNo] = useState('');
    const [customers, setCustomers] = useState<string[]>([]);

    // Picking setup
    const [pickerName, setPickerName] = useState('');
    const [pickingDate, setPickingDate] = useState(new Date().toISOString().split('T')[0]);
    const [pickingCustomer, setPickingCustomer] = useState('');
    const [pickingCustomers, setPickingCustomers] = useState<string[]>([]);

    // Auto-fill user info
    useEffect(() => {
        const user = getStoredUser();
        if (user) {
            if (mode === 'qc') setQcByName(user.fullName || user.username || '');
            else if (mode === 'picking') setPickerName(user.fullName || user.username || '');
        }
    }, [mode]);

    // Load customers
    useEffect(() => {
        if ((mode === 'outbound' || mode === 'picking') && activeWarehouse?.id) {
            outboundAPI.getCustomers(activeWarehouse.id)
                .then(res => {
                    const list = (res.data || []).map((c: any) => c.customer_name || c);
                    if (mode === 'outbound') setCustomers(list);
                    else setPickingCustomers(list);
                })
                .catch(() => { });
        }
    }, [mode, activeWarehouse?.id]);

    // Load draft on mount
    useEffect(() => {
        if (!activeWarehouse?.id) return;
        const load = async () => {
            try {
                let res: any;
                if (mode === 'qc') res = await qcAPI.loadDraft(activeWarehouse.id);
                else if (mode === 'outbound') res = await outboundAPI.loadDraft(activeWarehouse.id);
                else res = await pickingAPI.loadDraft(activeWarehouse.id);

                const draft = res?.data?.draft || res?.data;
                if (draft?.draft_data?.length > 0) {
                    const entries: ScannedEntry[] = draft.draft_data.map((d: any, i: number) => ({
                        id: `draft_${i}_${Date.now()}`,
                        wsn: d.wsn || '',
                        scannedAt: Date.now(),
                        qcGrade: d.qc_grade || 'A',
                        productSerialNumber: d.product_serial_number || '',
                        rackNo: d.rack_no || '',
                        qcRemarks: d.qc_remarks || '',
                    }));
                    setScannedEntries(entries);
                    if (mode === 'qc' && draft.common_date) setQcDate(draft.common_date);
                    if (mode === 'outbound') {
                        if (draft.customer_name) setCustomerName(draft.customer_name);
                        if (draft.common_date) setDispatchDate(draft.common_date);
                    }
                    if (mode === 'picking') {
                        if (draft.customer_name) setPickingCustomer(draft.customer_name);
                        if (draft.common_date) setPickingDate(draft.common_date);
                    }
                    setPhase('scanning');
                    toast.success(`Restored ${entries.length} draft entries`);
                    return;
                }
            } catch { /* server draft failed, try localStorage */ }

            try {
                const ls = localStorage.getItem(`${DRAFT_LS_KEY}_${mode}`);
                if (ls) {
                    const data = JSON.parse(ls);
                    if (data?.entries?.length > 0) {
                        setScannedEntries(data.entries);
                        if (data.qcByName) setQcByName(data.qcByName);
                        if (data.qcDate) setQcDate(data.qcDate);
                        if (data.customerName) setCustomerName(data.customerName);
                        if (data.dispatchDate) setDispatchDate(data.dispatchDate);
                        if (data.vehicleNo) setVehicleNo(data.vehicleNo);
                        if (data.pickerName) setPickerName(data.pickerName);
                        if (data.pickingDate) setPickingDate(data.pickingDate);
                        if (data.pickingCustomer) setPickingCustomer(data.pickingCustomer);
                        setPhase('scanning');
                        toast.success(`Restored ${data.entries.length} draft entries (local)`);
                    }
                }
            } catch { /* ignore */ }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeWarehouse?.id, mode]);

    // Auto-save drafts
    const saveDraft = useCallback(async (entries: ScannedEntry[]) => {
        if (!activeWarehouse?.id || entries.length === 0) return;

        // Instant localStorage save
        try {
            const localData: any = { entries, mode };
            if (mode === 'qc') { localData.qcByName = qcByName; localData.qcDate = qcDate; }
            if (mode === 'outbound') { localData.customerName = customerName; localData.dispatchDate = dispatchDate; localData.vehicleNo = vehicleNo; }
            if (mode === 'picking') { localData.pickerName = pickerName; localData.pickingDate = pickingDate; localData.pickingCustomer = pickingCustomer; }
            localStorage.setItem(`${DRAFT_LS_KEY}_${mode}`, JSON.stringify(localData));
        } catch { /* storage full */ }

        // Debounced server save
        if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
        draftSaveTimer.current = setTimeout(async () => {
            try {
                const draftRows = entries.map(e => ({
                    wsn: e.wsn,
                    qc_grade: e.qcGrade || '',
                    product_serial_number: e.productSerialNumber || '',
                    rack_no: e.rackNo || '',
                    qc_remarks: e.qcRemarks || '',
                }));

                if (mode === 'qc') {
                    await qcAPI.saveDraft(draftRows, activeWarehouse.id, qcDate);
                } else if (mode === 'outbound') {
                    await outboundAPI.saveDraft(draftRows, activeWarehouse.id, customerName, '', dispatchDate);
                } else {
                    await pickingAPI.saveDraft(draftRows, activeWarehouse.id, pickingCustomer, pickingDate);
                }
            } catch { /* silent */ }
        }, 500);
    }, [activeWarehouse?.id, mode, qcByName, qcDate, customerName, dispatchDate, vehicleNo, pickerName, pickingDate, pickingCustomer]);

    useEffect(() => {
        if (scannedEntries.length > 0) saveDraft(scannedEntries);
    }, [scannedEntries, saveDraft]);

    // Scan handler
    const handleScan = useCallback((wsn: string) => {
        if (scannedEntries.some(e => e.wsn === wsn)) {
            toast.error(`${wsn} already scanned`);
            return;
        }
        if (soundOn) playBeep();
        setScannedEntries(prev => [{
            id: `${wsn}_${Date.now()}`,
            wsn,
            scannedAt: Date.now(),
            qcGrade: 'A',
        }, ...prev]);
        toast.success(`Scanned: ${wsn}`, { duration: 1000 });
    }, [scannedEntries, soundOn]);

    // Manual add
    const handleManualAdd = useCallback(() => {
        const wsn = manualWSN.trim().toUpperCase();
        if (!wsn) return;
        handleScan(wsn);
        setManualWSN('');
        wsnInputRef.current?.focus();
    }, [manualWSN, handleScan]);

    const handleDeleteEntry = useCallback((id: string) => {
        setScannedEntries(prev => prev.filter(e => e.id !== id));
    }, []);

    const handleUpdateEntry = useCallback((id: string, field: keyof ScannedEntry, value: string) => {
        setScannedEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    }, []);

    // Start session
    const handleStartSession = useCallback(() => {
        if (mode === 'qc' && !qcByName.trim()) { toast.error('QC By Name is required'); return; }
        if (mode === 'outbound' && !customerName.trim()) { toast.error('Customer name is required'); return; }
        if (mode === 'picking' && !pickerName.trim()) { toast.error('Picker name is required'); return; }
        setPhase('scanning');
        setCameraOpen(true);
    }, [mode, qcByName, customerName, pickerName]);

    // Submit all
    const handleSubmitAll = useCallback(async () => {
        if (scannedEntries.length === 0 || !activeWarehouse?.id) return;
        setSubmitting(true);

        try {
            const user = getStoredUser();
            let batchId = '';

            if (mode === 'qc') {
                const entries = scannedEntries.map(e => ({
                    wsn: e.wsn,
                    qc_date: qcDate,
                    qc_by_name: qcByName.trim(),
                    qc_grade: e.qcGrade || 'A',
                    product_serial_number: e.productSerialNumber || '',
                    rack_no: e.rackNo || '',
                    qc_remarks: e.qcRemarks || '',
                    other_remarks: '',
                }));
                const res = await qcAPI.multiEntry({ entries, warehouse_id: activeWarehouse.id });
                batchId = res.data?.batch_id || res.data?.batchId || '';
            } else if (mode === 'outbound') {
                const entries = scannedEntries.map(e => ({
                    wsn: e.wsn,
                    dispatch_date: dispatchDate,
                    customer_name: customerName.trim(),
                    vehicle_no: vehicleNo,
                }));
                const res = await outboundAPI.multiEntry({ entries, warehouse_id: activeWarehouse.id });
                batchId = res.data?.batch_id || res.data?.batchId || '';
            } else {
                const entries = scannedEntries.map(e => ({
                    wsn: e.wsn,
                    picking_date: pickingDate,
                    customer_name: pickingCustomer.trim(),
                    picker_name: pickerName.trim(),
                    picking_remarks: '',
                    rack_no: '',
                    other_remarks: '',
                    quantity: 1,
                    created_by: user?.id,
                    created_user_name: user?.fullName || user?.username,
                    warehouse_name: activeWarehouse?.name,
                }));
                const res = await pickingAPI.multiEntry(entries, activeWarehouse.id);
                batchId = res.data?.batch_id || res.data?.batchId || '';
            }

            // Clear drafts
            try {
                if (mode === 'qc') await qcAPI.clearDraft(activeWarehouse.id);
                else if (mode === 'outbound') await outboundAPI.clearDraft(activeWarehouse.id);
                else await pickingAPI.clearDraft(activeWarehouse.id);
            } catch { /* ignore */ }
            localStorage.removeItem(`${DRAFT_LS_KEY}_${mode}`);

            setResultDialog({ open: true, batchId, count: scannedEntries.length });
            setScannedEntries([]);
            setCameraOpen(false);
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err?.message || 'Submission failed');
        } finally {
            setSubmitting(false);
        }
    }, [scannedEntries, activeWarehouse, mode, qcByName, qcDate, customerName, dispatchDate, vehicleNo, pickerName, pickingDate, pickingCustomer]);

    const canStart = useMemo(() => {
        if (mode === 'qc') return !!qcByName.trim();
        if (mode === 'outbound') return !!customerName.trim();
        if (mode === 'picking') return !!pickerName.trim();
        return false;
    }, [mode, qcByName, customerName, pickerName]);

    return (
        <Box sx={{ minHeight: '100dvh', bgcolor: isDark ? '#0f172a' : '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
            <Toaster position="top-center" />

            {/* App Bar */}
            <AppBar position="sticky" elevation={0} sx={{ background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}cc 100%)` }}>
                <Toolbar sx={{ minHeight: '48px !important', px: 1.5 }}>
                    <IconButton edge="start" color="inherit" onClick={() => router.back()} sx={{ mr: 0.5 }}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography sx={{ fontWeight: 800, fontSize: '1rem', flex: 1 }}>
                        {config.icon} {config.title}
                    </Typography>
                    {phase === 'scanning' && (
                        <>
                            <IconButton color="inherit" onClick={() => setSoundOn(!soundOn)} size="small">
                                {soundOn ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
                            </IconButton>
                            {scannedEntries.length > 0 && (
                                <Chip
                                    label={scannedEntries.length}
                                    size="small"
                                    sx={{ ml: 0.5, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, fontSize: '0.75rem', height: 24 }}
                                />
                            )}
                        </>
                    )}
                </Toolbar>
            </AppBar>

            {/* Warehouse */}
            {activeWarehouse && (
                <Box sx={{ px: 2, py: 0.5, bgcolor: isDark ? '#1e293b' : '#e2e8f0' }}>
                    <Typography sx={{ fontSize: '0.7rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                        📍 {activeWarehouse.name || activeWarehouse.warehouse_name || 'Warehouse'}
                    </Typography>
                </Box>
            )}

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>

                {/* ===== SETUP PHASE ===== */}
                {phase === 'setup' && (
                    <Card sx={{ borderRadius: 2, bgcolor: isDark ? '#1e293b' : '#fff', boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.08)' }}>
                        <CardContent sx={{ p: 2 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                                <SetupIcon sx={{ color: config.color, fontSize: 20 }} />
                                <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: isDark ? '#e2e8f0' : '#1e293b' }}>
                                    Session Setup
                                </Typography>
                            </Stack>

                            {mode === 'qc' && (
                                <Stack spacing={2}>
                                    <TextField fullWidth size="small" label="QC By Name *" value={qcByName}
                                        onChange={e => setQcByName(e.target.value)} placeholder="Your name" />
                                    <TextField fullWidth size="small" label="QC Date" type="date" value={qcDate}
                                        onChange={e => setQcDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                                    <Typography sx={{ fontSize: '0.7rem', color: isDark ? '#64748b' : '#94a3b8' }}>
                                        Grade, serial number, rack & remarks can be set per entry after scanning.
                                    </Typography>
                                </Stack>
                            )}

                            {mode === 'outbound' && (
                                <Stack spacing={2}>
                                    <CustomerAutocomplete
                                        value={customerName} onChange={setCustomerName}
                                        customers={customers} warehouseId={activeWarehouse?.id}
                                        onCustomerAdded={() => {
                                            if (activeWarehouse?.id) {
                                                outboundAPI.getCustomers(activeWarehouse.id)
                                                    .then(res => setCustomers((res.data || []).map((c: any) => c.customer_name || c)))
                                                    .catch(() => { });
                                            }
                                        }}
                                        size="small" label="Customer Name *" placeholder="Select customer..."
                                    />
                                    <TextField fullWidth size="small" label="Vehicle No" value={vehicleNo}
                                        onChange={e => setVehicleNo(e.target.value.toUpperCase())} placeholder="MH-01-AB-1234" />
                                    <TextField fullWidth size="small" label="Dispatch Date" type="date" value={dispatchDate}
                                        onChange={e => setDispatchDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                                </Stack>
                            )}

                            {mode === 'picking' && (
                                <Stack spacing={2}>
                                    <TextField fullWidth size="small" label="Picker Name *" value={pickerName}
                                        onChange={e => setPickerName(e.target.value)} placeholder="Your name" />
                                    <CustomerAutocomplete
                                        value={pickingCustomer} onChange={setPickingCustomer}
                                        customers={pickingCustomers} warehouseId={activeWarehouse?.id}
                                        size="small" label="Customer Name" placeholder="Select customer (optional)..."
                                    />
                                    <TextField fullWidth size="small" label="Picking Date" type="date" value={pickingDate}
                                        onChange={e => setPickingDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                                </Stack>
                            )}

                            <Button
                                fullWidth variant="contained" size="large" startIcon={<StartIcon />}
                                onClick={handleStartSession} disabled={!canStart}
                                sx={{
                                    mt: 2.5, py: 1.5, fontWeight: 800, fontSize: '0.95rem', borderRadius: 2,
                                    background: canStart ? `linear-gradient(135deg, ${config.color} 0%, ${config.color}bb 100%)` : undefined,
                                    textTransform: 'none',
                                    boxShadow: canStart ? `0 4px 14px ${config.color}40` : 'none',
                                }}
                            >
                                Start Scanning Session
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* ===== SCANNING PHASE ===== */}
                {phase === 'scanning' && (
                    <>
                        {/* Camera */}
                        <CameraScanner
                            isOpen={cameraOpen} onScan={handleScan}
                            onClose={() => setCameraOpen(false)}
                            title={`Scan WSN for ${config.title}`}
                        />

                        {/* Camera toggle + Manual input */}
                        <Card sx={{
                            mt: cameraOpen ? 1 : 0, borderRadius: 2,
                            bgcolor: isDark ? '#1e293b' : '#fff',
                            boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 1px 6px rgba(0,0,0,0.06)',
                        }}>
                            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                <Stack spacing={1}>
                                    {!cameraOpen && (
                                        <Button
                                            fullWidth variant="contained" startIcon={<CameraIcon />}
                                            onClick={() => setCameraOpen(true)}
                                            sx={{
                                                py: 1, fontWeight: 700, fontSize: '0.85rem', borderRadius: 1.5,
                                                background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}bb 100%)`,
                                                textTransform: 'none',
                                            }}
                                        >
                                            Open Camera
                                        </Button>
                                    )}
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <TextField
                                            fullWidth size="small" label="Manual WSN"
                                            value={manualWSN}
                                            onChange={e => setManualWSN(e.target.value.toUpperCase())}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleManualAdd(); } }}
                                            inputRef={wsnInputRef}
                                            placeholder="Type or paste WSN..."
                                            sx={{ '& .MuiInputBase-root': { bgcolor: isDark ? '#0f172a' : '#f8fafc' } }}
                                        />
                                        <Button
                                            variant="outlined" onClick={handleManualAdd}
                                            sx={{ minWidth: 50, fontWeight: 700, borderColor: config.color, color: config.color }}
                                        >
                                            Add
                                        </Button>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* Setup summary */}
                        <Box sx={{
                            mt: 1, px: 1.5, py: 0.8, borderRadius: 1.5,
                            bgcolor: isDark ? '#1e293b80' : '#e2e8f040',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography sx={{ fontSize: '0.7rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                                    {mode === 'qc' && `👤 ${qcByName} • 📅 ${qcDate}`}
                                    {mode === 'outbound' && `🏢 ${customerName} • 🚛 ${vehicleNo || 'N/A'} • 📅 ${dispatchDate}`}
                                    {mode === 'picking' && `👤 ${pickerName}${pickingCustomer ? ` • 🏢 ${pickingCustomer}` : ''} • 📅 ${pickingDate}`}
                                </Typography>
                                <Button
                                    size="small"
                                    onClick={() => { setPhase('setup'); setCameraOpen(false); }}
                                    sx={{ minWidth: 'auto', fontSize: '0.65rem', color: config.color, textTransform: 'none' }}
                                >
                                    Edit
                                </Button>
                            </Stack>
                        </Box>

                        {/* Scanned Entries */}
                        {scannedEntries.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b', mb: 0.5, px: 0.5 }}>
                                    Scanned ({scannedEntries.length})
                                </Typography>
                                <Stack spacing={0.5}>
                                    {scannedEntries.map((entry) => (
                                        <Card key={entry.id} sx={{
                                            borderRadius: 1.5, bgcolor: isDark ? '#1e293b' : '#fff',
                                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        }}>
                                            <Box sx={{ px: 1.5, py: 0.8, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography sx={{
                                                    fontSize: '0.78rem', fontWeight: 700,
                                                    color: isDark ? '#e2e8f0' : '#1e293b',
                                                    flex: 1, fontFamily: 'monospace',
                                                }}>
                                                    {entry.wsn}
                                                </Typography>

                                                {mode === 'qc' && (
                                                    <ToggleButtonGroup
                                                        value={entry.qcGrade || 'A'} exclusive
                                                        onChange={(_, v) => { if (v) handleUpdateEntry(entry.id, 'qcGrade', v); }}
                                                        size="small"
                                                        sx={{
                                                            '& .MuiToggleButton-root': {
                                                                px: 0.8, py: 0.1, fontSize: '0.65rem', fontWeight: 700, minWidth: 24,
                                                                '&.Mui-selected': { bgcolor: config.color, color: '#fff' },
                                                            },
                                                        }}
                                                    >
                                                        <ToggleButton value="A">A</ToggleButton>
                                                        <ToggleButton value="B">B</ToggleButton>
                                                        <ToggleButton value="C">C</ToggleButton>
                                                        <ToggleButton value="D">D</ToggleButton>
                                                    </ToggleButtonGroup>
                                                )}

                                                {mode === 'qc' && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                                                        sx={{ color: isDark ? '#64748b' : '#94a3b8', width: 24, height: 24 }}
                                                    >
                                                        <ExpandMoreIcon sx={{
                                                            fontSize: 16,
                                                            transform: expandedEntry === entry.id ? 'rotate(180deg)' : 'none',
                                                            transition: '0.2s',
                                                        }} />
                                                    </IconButton>
                                                )}

                                                <IconButton
                                                    size="small" onClick={() => handleDeleteEntry(entry.id)}
                                                    sx={{ color: '#ef4444', width: 24, height: 24 }}
                                                >
                                                    <DeleteIcon sx={{ fontSize: 14 }} />
                                                </IconButton>
                                            </Box>

                                            {mode === 'qc' && (
                                                <Collapse in={expandedEntry === entry.id}>
                                                    <Box sx={{ px: 1.5, pb: 1, pt: 0.5 }}>
                                                        <Divider sx={{ mb: 1 }} />
                                                        <Stack spacing={1}>
                                                            <TextField
                                                                fullWidth size="small" label="Product Serial No."
                                                                value={entry.productSerialNumber || ''}
                                                                onChange={e => handleUpdateEntry(entry.id, 'productSerialNumber', e.target.value)}
                                                                placeholder="Scan or type..."
                                                            />
                                                            <TextField
                                                                fullWidth size="small" label="Rack"
                                                                value={entry.rackNo || ''}
                                                                onChange={e => handleUpdateEntry(entry.id, 'rackNo', e.target.value)}
                                                                placeholder="Rack location"
                                                            />
                                                            <TextField
                                                                fullWidth size="small" label="Remarks"
                                                                value={entry.qcRemarks || ''}
                                                                onChange={e => handleUpdateEntry(entry.id, 'qcRemarks', e.target.value)}
                                                                multiline rows={1}
                                                            />
                                                        </Stack>
                                                    </Box>
                                                </Collapse>
                                            )}
                                        </Card>
                                    ))}
                                </Stack>
                            </Box>
                        )}

                        {scannedEntries.length === 0 && (
                            <Box sx={{ mt: 4, textAlign: 'center' }}>
                                <Typography sx={{ fontSize: '2rem', mb: 0.5 }}>📷</Typography>
                                <Typography sx={{ fontSize: '0.8rem', color: isDark ? '#64748b' : '#94a3b8', fontWeight: 600 }}>
                                    Scan barcodes to add entries
                                </Typography>
                            </Box>
                        )}
                    </>
                )}
            </Box>

            {/* Fixed Bottom Submit Bar */}
            {phase === 'scanning' && scannedEntries.length > 0 && (
                <Box sx={{
                    p: 1.5, borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    bgcolor: isDark ? '#1e293b' : '#fff', position: 'sticky', bottom: 0, zIndex: 10,
                }}>
                    <Button
                        fullWidth variant="contained" size="large"
                        onClick={handleSubmitAll} disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                        sx={{
                            py: 1.5, fontWeight: 800, fontSize: '0.95rem', borderRadius: 2,
                            background: !submitting ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)' : undefined,
                            textTransform: 'none',
                            boxShadow: !submitting ? '0 4px 14px rgba(34,197,94,0.3)' : 'none',
                        }}
                    >
                        {submitting ? 'Submitting...' : `Submit All (${scannedEntries.length} entries)`}
                    </Button>
                </Box>
            )}

            {/* Result Dialog */}
            <Dialog
                open={resultDialog.open}
                onClose={() => setResultDialog({ open: false, batchId: '', count: 0 })}
                PaperProps={{ sx: { borderRadius: 3, minWidth: 280 } }}
            >
                <DialogTitle sx={{ textAlign: 'center', pt: 3, pb: 0 }}>
                    <CheckCircleIcon sx={{ fontSize: 48, color: '#22c55e', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Submitted!</Typography>
                </DialogTitle>
                <DialogContent sx={{ textAlign: 'center', pt: 1 }}>
                    <Typography sx={{ fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#64748b', mb: 1 }}>
                        {resultDialog.count} entries submitted successfully
                    </Typography>
                    {resultDialog.batchId && (
                        <Chip
                            label={`Batch: ${resultDialog.batchId}`}
                            sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: isDark ? '#1e293b' : '#f1f5f9' }}
                        />
                    )}
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: 2.5, gap: 1 }}>
                    <Button
                        variant="outlined"
                        onClick={() => { setResultDialog({ open: false, batchId: '', count: 0 }); setPhase('scanning'); setCameraOpen(true); }}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                    >
                        Scan More
                    </Button>
                    <Button
                        variant="contained" onClick={() => router.back()}
                        sx={{
                            borderRadius: 2, textTransform: 'none', fontWeight: 700,
                            background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}bb 100%)`,
                        }}
                    >
                        Done
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
