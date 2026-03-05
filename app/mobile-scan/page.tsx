'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Box, Typography, Button, TextField, Stack, Card, CardContent,
    IconButton, Chip, Alert, CircularProgress, Divider, useTheme,
    AppBar, Toolbar, ToggleButton, ToggleButtonGroup, Dialog, DialogTitle,
    DialogContent, DialogActions, Collapse, Autocomplete,
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
    DeleteSweep as ClearAllIcon,
    Warning as WarningIcon,
    QrCodeScanner as ScanIcon,
} from '@mui/icons-material';
import { qcAPI, outboundAPI, pickingAPI, rackAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import CameraScanner from '@/components/CameraScanner';
import CustomerAutocomplete from '@/components/CustomerAutocomplete';
import toast, { Toaster } from 'react-hot-toast';

type ScanMode = 'qc' | 'outbound' | 'picking';

interface ProductInfo {
    product_title?: string;
    brand?: string;
    mrp?: string | number;
    fsp?: string | number;
    rack_no?: string;
    fsn?: string;
}

interface ScannedEntry {
    id: string;
    wsn: string;
    scannedAt: number;
    // QC per-entry fields
    qcGrade?: string;
    productSerialNumber?: string;
    rackNo?: string;
    qcRemarks?: string;
    otherRemarks?: string;
    // Outbound per-entry fields
    dispatchRemarks?: string;
    // Picking per-entry fields
    pickingRemarks?: string;
    // Product info (all modes)
    productInfo?: ProductInfo;
    // Duplicate flags
    isDuplicate?: boolean;
    dupType?: 'grid' | 'same-wh' | 'cross-wh';
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
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
    const [serialScanEntry, setSerialScanEntry] = useState<string | null>(null); // entry ID for scanning serial number

    // Scanned entries
    const [scannedEntries, setScannedEntries] = useState<ScannedEntry[]>([]);
    const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
    const wsnInputRef = useRef<HTMLInputElement>(null);
    const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const draftLoadedRef = useRef(false);
    // Ref-based duplicate check (avoids stale closure in scan callback)
    const scannedWSNsRef = useRef<Set<string>>(new Set());

    // Existing WSNs for duplicate check: wsn -> warehouseId (null if unknown)
    const [existingWSNs, setExistingWSNs] = useState<Map<string, number | null>>(new Map());
    const [dupCheckReady, setDupCheckReady] = useState(false);

    // Rack list for QC
    const [racks, setRacks] = useState<string[]>([]);

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

    // Load existing WSNs for duplicate check
    useEffect(() => {
        if (!activeWarehouse?.id) return;
        setDupCheckReady(false);
        const loadExisting = async () => {
            try {
                const map = new Map<string, number | null>();
                if (mode === 'qc') {
                    const res = await qcAPI.getAllQCWSNs();
                    (res.data || []).forEach((item: any) => {
                        const wsn = (typeof item === 'string' ? item : item.wsn || '').toUpperCase();
                        const whId = typeof item === 'object' ? (item.warehouseid ?? null) : null;
                        if (wsn) map.set(wsn, whId);
                    });
                } else if (mode === 'outbound') {
                    const res = await outboundAPI.getExistingWSNs(activeWarehouse.id);
                    (res.data || []).forEach((w: any) => {
                        const wsn = (typeof w === 'string' ? w : '').toUpperCase();
                        if (wsn) map.set(wsn, activeWarehouse!.id);
                    });
                } else {
                    const res = await pickingAPI.getExistingWSNs(activeWarehouse.id);
                    (res.data || []).forEach((w: any) => {
                        const wsn = (typeof w === 'string' ? w : '').toUpperCase();
                        if (wsn) map.set(wsn, activeWarehouse!.id);
                    });
                }
                setExistingWSNs(map);
            } catch (err) {
                console.error('Failed to load existing WSNs for duplicate check:', err);
            } finally {
                setDupCheckReady(true);
            }
        };
        loadExisting();
    }, [mode, activeWarehouse?.id]);

    // Load racks for QC
    useEffect(() => {
        if (mode === 'qc' && activeWarehouse?.id) {
            rackAPI.getByWarehouse(activeWarehouse.id)
                .then(res => {
                    const list = (res.data || []).map((r: any) => r.rack_no || r.rack_name || r.name || String(r));
                    setRacks(list.filter(Boolean));
                })
                .catch(() => {
                    // Fallback to inbound racks API
                    qcAPI.getWarehouseRacks?.(activeWarehouse!.id)
                        ?.then((res: any) => {
                            const list = (res.data?.racks || res.data || []).map((r: any) => r.rack_no || r);
                            setRacks(list.filter(Boolean));
                        })
                        .catch(() => { });
                });
        }
    }, [mode, activeWarehouse?.id]);

    // Load draft on mount
    useEffect(() => {
        if (!activeWarehouse?.id || draftLoadedRef.current) return;
        draftLoadedRef.current = true;
        const load = async () => {
            try {
                let res: any;
                if (mode === 'qc') res = await qcAPI.loadDraft(activeWarehouse.id, 'mobile');
                else if (mode === 'outbound') res = await outboundAPI.loadDraft(activeWarehouse.id, 'mobile');
                else res = await pickingAPI.loadDraft(activeWarehouse.id, 'mobile');

                const draft = res?.data?.draft || res?.data;
                const draftRows = draft?.rows || draft?.draft_data;
                if (draftRows?.length > 0) {
                    const entries: ScannedEntry[] = draftRows.map((d: any, i: number) => ({
                        id: `draft_${i}_${Date.now()}`,
                        wsn: d.wsn || '',
                        scannedAt: Date.now(),
                        qcGrade: d.qc_grade || 'A',
                        productSerialNumber: d.product_serial_number || '',
                        rackNo: d.rack_no || '',
                        qcRemarks: d.qc_remarks || '',
                        otherRemarks: d.other_remarks || '',
                        dispatchRemarks: d.dispatch_remarks || '',
                        pickingRemarks: d.picking_remarks || '',
                        productInfo: d.productInfo || undefined,
                    }));
                    setScannedEntries(entries);
                    // Sync ref with loaded entries
                    scannedWSNsRef.current = new Set(entries.map(e => e.wsn));
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
                        scannedWSNsRef.current = new Set(data.entries.map((e: any) => e.wsn));
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

    // Fetch product info for a WSN
    const fetchProductInfo = useCallback(async (wsn: string): Promise<ProductInfo | undefined> => {
        if (!activeWarehouse?.id) return undefined;
        try {
            if (mode === 'qc') {
                const res = await qcAPI.getPendingInbound(activeWarehouse.id, wsn);
                const items = res.data?.data || res.data || [];
                const match = items.find((i: any) => (i.wsn || '').toUpperCase() === wsn.toUpperCase()) || items[0];
                if (match) {
                    return {
                        product_title: match.product_title || '',
                        brand: match.brand || '',
                        mrp: match.mrp || '',
                        fsp: match.fsp || '',
                        rack_no: match.rack_no || '',
                        fsn: match.fsn || '',
                    };
                }
            } else if (mode === 'outbound') {
                const res = await outboundAPI.getSourceByWSN(wsn, activeWarehouse.id);
                if (res.data) {
                    const d = res.data;
                    return {
                        product_title: d.product_title || '',
                        brand: d.brand || '',
                        mrp: d.mrp || '',
                        fsp: d.fsp || '',
                        rack_no: d.rack_no || '',
                        fsn: d.fsn || '',
                    };
                }
            } else {
                const res = await pickingAPI.getSourceByWSN(wsn, activeWarehouse.id);
                if (res.data) {
                    const d = res.data;
                    return {
                        product_title: d.product_title || '',
                        brand: d.brand || '',
                        mrp: d.mrp || '',
                        fsp: d.fsp || '',
                        rack_no: d.rack_no || '',
                        fsn: d.fsn || '',
                    };
                }
            }
        } catch { /* ignore */ }
        return undefined;
    }, [activeWarehouse?.id, mode]);

    // Auto-save drafts
    const saveDraft = useCallback(async (entries: ScannedEntry[]) => {
        if (!activeWarehouse?.id) return;
        if (entries.length === 0) {
            // Clear drafts when no entries
            try { localStorage.removeItem(`${DRAFT_LS_KEY}_${mode}`); } catch { /* ignore */ }
            return;
        }

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
                    other_remarks: e.otherRemarks || '',
                    dispatch_remarks: e.dispatchRemarks || '',
                    picking_remarks: e.pickingRemarks || '',
                    productInfo: e.productInfo || undefined,
                }));

                if (mode === 'qc') {
                    await qcAPI.saveDraft(draftRows, activeWarehouse.id, qcDate, 'mobile');
                } else if (mode === 'outbound') {
                    await outboundAPI.saveDraft(draftRows, activeWarehouse.id, customerName, '', dispatchDate, 'mobile');
                } else {
                    await pickingAPI.saveDraft(draftRows, activeWarehouse.id, pickingCustomer, pickingDate, 'mobile');
                }
            } catch { /* silent */ }
        }, 500);
    }, [activeWarehouse?.id, mode, qcByName, qcDate, customerName, dispatchDate, vehicleNo, pickerName, pickingDate, pickingCustomer]);

    useEffect(() => {
        saveDraft(scannedEntries);
    }, [scannedEntries, saveDraft]);

    // Scan handler with proper 3-level duplicate check + product fetch
    const handleScan = useCallback(async (wsn: string) => {
        // Level 1: Grid duplicate — uses ref (NOT state) to avoid stale closure
        if (scannedWSNsRef.current.has(wsn)) {
            toast.error(`${wsn} already in scan list!`, { duration: 2500 });
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
            return;
        }

        // Level 2 & 3: Server duplicate check (same-warehouse / cross-warehouse)
        let isDuplicate = false;
        let dupType: 'same-wh' | 'cross-wh' | undefined;
        if (existingWSNs.has(wsn)) {
            isDuplicate = true;
            const existingWhId = existingWSNs.get(wsn);
            if (mode === 'qc' && existingWhId !== null && existingWhId !== undefined && activeWarehouse?.id && existingWhId !== activeWarehouse.id) {
                dupType = 'cross-wh';
            } else {
                dupType = 'same-wh';
            }
        }

        if (soundOn) playBeep();
        const newEntry: ScannedEntry = {
            id: `${wsn}_${Date.now()}`,
            wsn,
            scannedAt: Date.now(),
            qcGrade: 'A',
            isDuplicate,
            dupType,
        };

        // Add to ref immediately (synchronous — prevents rapid-fire duplicates)
        scannedWSNsRef.current.add(wsn);
        setScannedEntries(prev => [newEntry, ...prev]);
        if (isDuplicate) {
            const dupMsg = dupType === 'cross-wh'
                ? `⚠️ ${wsn} exists in another warehouse`
                : `⚠️ ${wsn} already exists in database`;
            toast(dupMsg, { icon: '⚠️', duration: 3000 });
        } else {
            toast.success(`✓ ${wsn}`, { duration: 800 });
        }

        // Fetch product info in background
        fetchProductInfo(wsn).then(info => {
            if (info) {
                setScannedEntries(prev => prev.map(e =>
                    e.id === newEntry.id ? {
                        ...e,
                        productInfo: info,
                        rackNo: e.rackNo || info.rack_no || '',
                    } : e
                ));
            }
        });
    }, [existingWSNs, soundOn, fetchProductInfo, mode, activeWarehouse?.id]);

    // Handle serial number scan result
    const handleSerialScan = useCallback((serial: string) => {
        if (serialScanEntry) {
            setScannedEntries(prev => prev.map(e =>
                e.id === serialScanEntry ? { ...e, productSerialNumber: serial } : e
            ));
            toast.success(`Serial: ${serial}`, { duration: 1000 });
        }
        setSerialScanEntry(null);
    }, [serialScanEntry]);

    // Manual add
    const handleManualAdd = useCallback(() => {
        const wsn = manualWSN.trim().toUpperCase();
        if (!wsn) return;
        handleScan(wsn);
        setManualWSN('');
        wsnInputRef.current?.focus();
    }, [manualWSN, handleScan]);

    const handleDeleteEntry = useCallback((id: string) => {
        setScannedEntries(prev => {
            const removed = prev.find(e => e.id === id);
            if (removed) scannedWSNsRef.current.delete(removed.wsn);
            return prev.filter(e => e.id !== id);
        });
    }, []);

    const handleUpdateEntry = useCallback((id: string, field: keyof ScannedEntry, value: string) => {
        setScannedEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    }, []);

    // Clear all drafts with confirmation
    const handleClearDraft = useCallback(async () => {
        setClearConfirmOpen(false);
        setScannedEntries([]);
        scannedWSNsRef.current.clear();
        // Clear localStorage
        try { localStorage.removeItem(`${DRAFT_LS_KEY}_${mode}`); } catch { /* ignore */ }
        // Clear server draft (mobile source)
        try {
            if (activeWarehouse?.id) {
                if (mode === 'qc') await qcAPI.clearDraft(activeWarehouse.id, 'mobile');
                else if (mode === 'outbound') await outboundAPI.clearDraft(activeWarehouse.id, 'mobile');
                else await pickingAPI.clearDraft(activeWarehouse.id, 'mobile');
            }
        } catch { /* ignore */ }
        toast.success('Draft cleared');
    }, [mode, activeWarehouse?.id]);

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

        // Filter out duplicate entries if user wants
        const validEntries = scannedEntries.filter(e => !e.isDuplicate);
        if (validEntries.length === 0) {
            toast.error('All entries are duplicates. Remove them or scan new WSNs.');
            return;
        }

        setSubmitting(true);
        try {
            const user = getStoredUser();
            let batchId = '';

            if (mode === 'qc') {
                const entries = validEntries.map(e => ({
                    wsn: e.wsn,
                    qc_date: qcDate,
                    qc_by_name: qcByName.trim(),
                    qc_grade: e.qcGrade || 'A',
                    product_serial_number: e.productSerialNumber || '',
                    rack_no: e.rackNo || '',
                    qc_remarks: e.qcRemarks || '',
                    other_remarks: e.otherRemarks || '',
                }));
                const res = await qcAPI.multiEntry({ entries, warehouse_id: activeWarehouse.id });
                batchId = res.data?.batch_id || res.data?.batchId || '';
            } else if (mode === 'outbound') {
                const entries = validEntries.map(e => ({
                    wsn: e.wsn,
                    dispatch_date: dispatchDate,
                    customer_name: customerName.trim(),
                    vehicle_no: vehicleNo,
                    dispatch_remarks: e.dispatchRemarks || '',
                    other_remarks: e.otherRemarks || '',
                }));
                const res = await outboundAPI.multiEntry({ entries, warehouse_id: activeWarehouse.id });
                batchId = res.data?.batch_id || res.data?.batchId || '';
            } else {
                const entries = validEntries.map(e => ({
                    wsn: e.wsn,
                    picking_date: pickingDate,
                    customer_name: pickingCustomer.trim(),
                    picker_name: pickerName.trim(),
                    picking_remarks: e.pickingRemarks || '',
                    rack_no: e.productInfo?.rack_no || '',
                    other_remarks: '',
                    quantity: 1,
                    created_by: user?.id,
                    created_user_name: user?.fullName || user?.username,
                    warehouse_name: activeWarehouse?.name,
                }));
                const res = await pickingAPI.multiEntry(entries, activeWarehouse.id);
                batchId = res.data?.batch_id || res.data?.batchId || '';
            }

            // Clear drafts (mobile source)
            try {
                if (mode === 'qc') await qcAPI.clearDraft(activeWarehouse.id, 'mobile');
                else if (mode === 'outbound') await outboundAPI.clearDraft(activeWarehouse.id, 'mobile');
                else await pickingAPI.clearDraft(activeWarehouse.id, 'mobile');
            } catch { /* ignore */ }
            localStorage.removeItem(`${DRAFT_LS_KEY}_${mode}`);

            // Add submitted WSNs to existingWSNs so they can't be re-scanned
            setExistingWSNs(prev => {
                const updated = new Map(prev);
                validEntries.forEach(e => updated.set(e.wsn, activeWarehouse!.id));
                return updated;
            });

            setResultDialog({ open: true, batchId, count: validEntries.length });
            setScannedEntries([]);
            scannedWSNsRef.current.clear();
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

    const dupCount = useMemo(() => scannedEntries.filter(e => e.isDuplicate).length, [scannedEntries]);

    // Product info display - comprehensive like multi-entry
    const ProductInfoLine = ({ info }: { info?: ProductInfo }) => {
        if (!info) return null;
        const hasAny = info.product_title || info.brand || info.mrp || info.fsn;
        if (!hasAny) return null;
        return (
            <Box sx={{ px: 1.5, pb: 0.8, pt: 0.2 }}>
                {info.product_title && (
                    <Typography sx={{ fontSize: '0.7rem', color: isDark ? '#cbd5e1' : '#334155', fontWeight: 600, lineHeight: 1.4 }}>
                        {info.product_title}
                    </Typography>
                )}
                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.3 }}>
                    {info.brand && (
                        <Chip label={info.brand} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: isDark ? '#1e3a5f' : '#dbeafe', color: isDark ? '#93c5fd' : '#1e40af' }} />
                    )}
                    {info.mrp && (
                        <Chip label={`MRP ₹${info.mrp}`} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: isDark ? '#14532d' : '#dcfce7', color: isDark ? '#86efac' : '#166534' }} />
                    )}
                    {info.fsp && (
                        <Chip label={`FSP ₹${info.fsp}`} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: isDark ? '#3b1764' : '#f3e8ff', color: isDark ? '#c084fc' : '#7c3aed' }} />
                    )}
                    {info.fsn && (
                        <Chip label={`FSN: ${info.fsn}`} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: isDark ? '#422006' : '#fef3c7', color: isDark ? '#fbbf24' : '#92400e' }} />
                    )}
                    {info.rack_no && (
                        <Chip label={`📍 ${info.rack_no}`} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: isDark ? '#1c1917' : '#f5f5f4', color: isDark ? '#a8a29e' : '#57534e' }} />
                    )}
                </Stack>
            </Box>
        );
    };

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
                        {/* Serial number scanner overlay for QC */}
                        {serialScanEntry && (
                            <Box sx={{ mb: 1 }}>
                                <CameraScanner
                                    isOpen={true}
                                    onScan={handleSerialScan}
                                    onClose={() => setSerialScanEntry(null)}
                                    title="Scan Product Serial Number"
                                />
                            </Box>
                        )}

                        {/* Main WSN Camera (hidden when scanning serial) */}
                        {!serialScanEntry && (
                            <CameraScanner
                                isOpen={cameraOpen} onScan={handleScan}
                                onClose={() => setCameraOpen(false)}
                                title={`Scan WSN for ${config.title}`}
                            />
                        )}

                        {/* Camera toggle + Manual input */}
                        <Card sx={{
                            mt: (cameraOpen || serialScanEntry) ? 1 : 0, borderRadius: 2,
                            bgcolor: isDark ? '#1e293b' : '#fff',
                            boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 1px 6px rgba(0,0,0,0.06)',
                        }}>
                            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                <Stack spacing={1}>
                                    {!cameraOpen && !serialScanEntry && (
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

                        {/* Setup summary + Clear button */}
                        <Box sx={{
                            mt: 1, px: 1.5, py: 0.8, borderRadius: 1.5,
                            bgcolor: isDark ? '#1e293b80' : '#e2e8f040',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography sx={{ fontSize: '0.7rem', color: isDark ? '#94a3b8' : '#64748b', flex: 1 }}>
                                    {mode === 'qc' && `👤 ${qcByName} • 📅 ${qcDate}`}
                                    {mode === 'outbound' && `🏢 ${customerName} • 🚛 ${vehicleNo || 'N/A'} • 📅 ${dispatchDate}`}
                                    {mode === 'picking' && `👤 ${pickerName}${pickingCustomer ? ` • 🏢 ${pickingCustomer}` : ''} • 📅 ${pickingDate}`}
                                </Typography>
                                <Stack direction="row" spacing={0.5}>
                                    {scannedEntries.length > 0 && (
                                        <Button
                                            size="small"
                                            onClick={() => setClearConfirmOpen(true)}
                                            sx={{ minWidth: 'auto', fontSize: '0.6rem', color: '#ef4444', textTransform: 'none', px: 0.5 }}
                                            startIcon={<ClearAllIcon sx={{ fontSize: '12px !important' }} />}
                                        >
                                            Clear
                                        </Button>
                                    )}
                                    <Button
                                        size="small"
                                        onClick={() => { setPhase('setup'); setCameraOpen(false); }}
                                        sx={{ minWidth: 'auto', fontSize: '0.65rem', color: config.color, textTransform: 'none', px: 0.5 }}
                                    >
                                        Edit
                                    </Button>
                                </Stack>
                            </Stack>
                        </Box>

                        {/* Duplicate check status */}
                        {!dupCheckReady && (
                            <Alert severity="info" sx={{ mt: 0.5, py: 0, fontSize: '0.7rem', borderRadius: 1 }}
                                icon={<CircularProgress size={14} />}
                            >
                                Loading duplicate check data...
                            </Alert>
                        )}

                        {/* Duplicate warning */}
                        {dupCount > 0 && (
                            <Alert severity="warning" sx={{ mt: 0.5, py: 0, fontSize: '0.7rem', borderRadius: 1 }}
                                icon={<WarningIcon sx={{ fontSize: 16 }} />}
                            >
                                {dupCount} WSN(s) already exist in database — they will be skipped on submit
                            </Alert>
                        )}

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
                                            border: `1px solid ${entry.isDuplicate ? '#f59e0b' : (isDark ? '#334155' : '#e2e8f0')}`,
                                            opacity: entry.isDuplicate ? 0.7 : 1,
                                        }}>
                                            <Box sx={{ px: 1.5, py: 0.6, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                                        <Typography sx={{
                                                            fontSize: '0.75rem', fontWeight: 700,
                                                            color: entry.isDuplicate ? '#f59e0b' : (isDark ? '#e2e8f0' : '#1e293b'),
                                                            fontFamily: 'monospace',
                                                        }} noWrap>
                                                            {entry.wsn}
                                                        </Typography>
                                                        {entry.isDuplicate && (
                                                            <Chip
                                                                label={entry.dupType === 'cross-wh' ? 'OTHER WH' : 'EXISTS'}
                                                                size="small"
                                                                sx={{
                                                                    height: 16, fontSize: '0.55rem', fontWeight: 800,
                                                                    bgcolor: entry.dupType === 'cross-wh' ? '#fecaca' : '#fef3c7',
                                                                    color: entry.dupType === 'cross-wh' ? '#991b1b' : '#92400e',
                                                                }}
                                                            />
                                                        )}
                                                    </Stack>
                                                </Box>

                                                {mode === 'qc' && (
                                                    <ToggleButtonGroup
                                                        value={entry.qcGrade || 'A'} exclusive
                                                        onChange={(_, v) => { if (v) handleUpdateEntry(entry.id, 'qcGrade', v); }}
                                                        size="small"
                                                        sx={{
                                                            '& .MuiToggleButton-root': {
                                                                px: 0.6, py: 0, fontSize: '0.6rem', fontWeight: 700, minWidth: 22, height: 22,
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

                                                {(mode === 'qc' || mode === 'outbound' || mode === 'picking') && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                                                        sx={{ color: isDark ? '#64748b' : '#94a3b8', width: 22, height: 22 }}
                                                    >
                                                        <ExpandMoreIcon sx={{
                                                            fontSize: 14,
                                                            transform: expandedEntry === entry.id ? 'rotate(180deg)' : 'none',
                                                            transition: '0.2s',
                                                        }} />
                                                    </IconButton>
                                                )}

                                                <IconButton
                                                    size="small" onClick={() => handleDeleteEntry(entry.id)}
                                                    sx={{ color: '#ef4444', width: 22, height: 22 }}
                                                >
                                                    <DeleteIcon sx={{ fontSize: 13 }} />
                                                </IconButton>
                                            </Box>

                                            {/* Compact product info */}
                                            <ProductInfoLine info={entry.productInfo} />

                                            {/* QC expanded fields */}
                                            {mode === 'qc' && (
                                                <Collapse in={expandedEntry === entry.id}>
                                                    <Box sx={{ px: 1.5, pb: 1, pt: 0.5 }}>
                                                        <Divider sx={{ mb: 1 }} />
                                                        <Stack spacing={1}>
                                                            <Stack direction="row" spacing={0.5} alignItems="center">
                                                                <TextField
                                                                    fullWidth size="small" label="Product Serial No."
                                                                    value={entry.productSerialNumber || ''}
                                                                    onChange={e => handleUpdateEntry(entry.id, 'productSerialNumber', e.target.value)}
                                                                    placeholder="Scan or type..."
                                                                    sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }}
                                                                />
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => {
                                                                        setCameraOpen(false);
                                                                        setSerialScanEntry(entry.id);
                                                                    }}
                                                                    sx={{
                                                                        color: config.color, width: 34, height: 34,
                                                                        border: `1px solid ${config.color}40`,
                                                                    }}
                                                                >
                                                                    <ScanIcon sx={{ fontSize: 18 }} />
                                                                </IconButton>
                                                            </Stack>
                                                            <Autocomplete
                                                                freeSolo
                                                                options={racks}
                                                                value={entry.rackNo || ''}
                                                                onChange={(_, v) => handleUpdateEntry(entry.id, 'rackNo', v || '')}
                                                                onInputChange={(_, v) => handleUpdateEntry(entry.id, 'rackNo', v || '')}
                                                                renderInput={(params) => (
                                                                    <TextField {...params} size="small" label="Rack"
                                                                        placeholder="Select or type rack..."
                                                                        sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }}
                                                                    />
                                                                )}
                                                                size="small"
                                                            />
                                                            <TextField
                                                                fullWidth size="small" label="QC Remarks"
                                                                value={entry.qcRemarks || ''}
                                                                onChange={e => handleUpdateEntry(entry.id, 'qcRemarks', e.target.value)}
                                                                multiline rows={1}
                                                                sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }}
                                                            />
                                                            <TextField
                                                                fullWidth size="small" label="Other Remarks"
                                                                value={entry.otherRemarks || ''}
                                                                onChange={e => handleUpdateEntry(entry.id, 'otherRemarks', e.target.value)}
                                                                multiline rows={1}
                                                                sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }}
                                                            />
                                                        </Stack>
                                                    </Box>
                                                </Collapse>
                                            )}

                                            {/* Picking expanded fields */}
                                            {mode === 'picking' && (
                                                <Collapse in={expandedEntry === entry.id}>
                                                    <Box sx={{ px: 1.5, pb: 1, pt: 0.5 }}>
                                                        <Divider sx={{ mb: 1 }} />
                                                        <TextField
                                                            fullWidth size="small" label="Picking Remarks"
                                                            value={entry.pickingRemarks || ''}
                                                            onChange={e => handleUpdateEntry(entry.id, 'pickingRemarks', e.target.value)}
                                                            multiline rows={1}
                                                            placeholder="Add remarks..."
                                                            sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }}
                                                        />
                                                    </Box>
                                                </Collapse>
                                            )}

                                            {/* Outbound expanded fields */}
                                            {mode === 'outbound' && (
                                                <Collapse in={expandedEntry === entry.id}>
                                                    <Box sx={{ px: 1.5, pb: 1, pt: 0.5 }}>
                                                        <Divider sx={{ mb: 1 }} />
                                                        <Stack spacing={1}>
                                                            <TextField
                                                                fullWidth size="small" label="Dispatch Remarks"
                                                                value={entry.dispatchRemarks || ''}
                                                                onChange={e => handleUpdateEntry(entry.id, 'dispatchRemarks', e.target.value)}
                                                                multiline rows={1}
                                                                placeholder="Add dispatch remarks..."
                                                                sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }}
                                                            />
                                                            <TextField
                                                                fullWidth size="small" label="Other Remarks"
                                                                value={entry.otherRemarks || ''}
                                                                onChange={e => handleUpdateEntry(entry.id, 'otherRemarks', e.target.value)}
                                                                multiline rows={1}
                                                                placeholder="Add other remarks..."
                                                                sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }}
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
                        {submitting ? 'Submitting...' : `Submit All (${scannedEntries.filter(e => !e.isDuplicate).length} entries)`}
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

            {/* Clear Draft Confirmation Dialog */}
            <Dialog
                open={clearConfirmOpen}
                onClose={() => setClearConfirmOpen(false)}
                PaperProps={{ sx: { borderRadius: 2.5, minWidth: 260 } }}
            >
                <DialogTitle sx={{ fontSize: '1rem', fontWeight: 800, pb: 0.5 }}>
                    Clear All Scanned Data?
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '0.82rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                        This will remove all {scannedEntries.length} scanned entries and clear saved drafts. This cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
                    <Button onClick={() => setClearConfirmOpen(false)}
                        sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}>
                        Cancel
                    </Button>
                    <Button variant="contained" color="error" onClick={handleClearDraft}
                        startIcon={<ClearAllIcon />}
                        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5 }}>
                        Clear All
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
