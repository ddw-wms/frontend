'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Box, Typography, Button, TextField, Stack, Card, CardContent,
    Select, MenuItem, FormControl, InputLabel, IconButton, Chip, Alert,
    CircularProgress, Divider, useTheme, AppBar, Toolbar, ToggleButton,
    ToggleButtonGroup, Fade,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    CameraAlt as CameraIcon,
    CheckCircle as CheckCircleIcon,
    Replay as ReplayIcon,
    VolumeUp as VolumeUpIcon,
    VolumeOff as VolumeOffIcon,
} from '@mui/icons-material';
import { qcAPI, outboundAPI, pickingAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import CameraScanner from '@/components/CameraScanner';
import CustomerAutocomplete from '@/components/CustomerAutocomplete';
import toast, { Toaster } from 'react-hot-toast';

type ScanMode = 'qc' | 'outbound' | 'picking';

// Audio beep for successful scan
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
    } catch {
        // AudioContext not available
    }
}

const MODE_CONFIG: Record<ScanMode, { title: string; color: string; icon: string }> = {
    qc: { title: 'QC Scan', color: '#7c3aed', icon: '🔍' },
    outbound: { title: 'Dispatch Scan', color: '#1e40af', icon: '📦' },
    picking: { title: 'Picking Scan', color: '#059669', icon: '📋' },
};

export default function MobileScanPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const { activeWarehouse } = useWarehouse();
    const mode = (searchParams.get('mode') as ScanMode) || 'qc';

    // Scanner state
    const [cameraOpen, setCameraOpen] = useState(false);
    const [lastScannedWSN, setLastScannedWSN] = useState('');
    const [manualWSN, setManualWSN] = useState('');
    const [productInfo, setProductInfo] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [soundOn, setSoundOn] = useState(true);
    const [sessionCount, setSessionCount] = useState(0);
    const [lastEntry, setLastEntry] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // QC-specific state
    const [qcGrade, setQcGrade] = useState(() =>
        typeof window !== 'undefined' ? localStorage.getItem('mobileScan_qcGrade') || '' : ''
    );
    const [qcByName, setQcByName] = useState(() =>
        typeof window !== 'undefined' ? localStorage.getItem('mobileScan_qcByName') || '' : ''
    );
    const [qcDate, setQcDate] = useState(new Date().toISOString().split('T')[0]);
    const [rackNo, setRackNo] = useState('');
    const [qcRemarks, setQcRemarks] = useState('');
    const [racks, setRacks] = useState<string[]>([]);

    // Outbound-specific state
    const [customerName, setCustomerName] = useState(() =>
        typeof window !== 'undefined' ? localStorage.getItem('mobileScan_customerName') || '' : ''
    );
    const [vehicleNo, setVehicleNo] = useState(() =>
        typeof window !== 'undefined' ? localStorage.getItem('mobileScan_vehicleNo') || '' : ''
    );
    const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
    const [dispatchRemarks, setDispatchRemarks] = useState('');
    const [customers, setCustomers] = useState<string[]>([]);

    // Picking-specific state
    const [pickerName, setPickerName] = useState(() =>
        typeof window !== 'undefined' ? localStorage.getItem('mobileScan_pickerName') || '' : ''
    );
    const [pickingDate, setPickingDate] = useState(new Date().toISOString().split('T')[0]);
    const [pickingRemarks, setPickingRemarks] = useState('');

    const wsnInputRef = useRef<HTMLInputElement>(null);
    const config = MODE_CONFIG[mode] || MODE_CONFIG.qc;

    // Load racks for QC mode
    useEffect(() => {
        if (mode === 'qc' && activeWarehouse?.id) {
            qcAPI.getWarehouseRacks(activeWarehouse.id)
                .then((res) => {
                    const rackList = (res.data?.racks || res.data || []).map((r: any) => r.rack_no || r);
                    setRacks(rackList);
                })
                .catch(() => { });
        }
    }, [mode, activeWarehouse?.id]);

    // Load customers for Outbound mode
    useEffect(() => {
        if (mode === 'outbound' && activeWarehouse?.id) {
            outboundAPI.getCustomers(activeWarehouse.id)
                .then((res) => {
                    const list = (res.data || []).map((c: any) => c.customer_name || c);
                    setCustomers(list);
                })
                .catch(() => { });
        }
    }, [mode, activeWarehouse?.id]);

    // Persist remembered fields
    useEffect(() => {
        if (qcByName) localStorage.setItem('mobileScan_qcByName', qcByName);
    }, [qcByName]);
    useEffect(() => {
        if (qcGrade) localStorage.setItem('mobileScan_qcGrade', qcGrade);
    }, [qcGrade]);
    useEffect(() => {
        if (customerName) localStorage.setItem('mobileScan_customerName', customerName);
    }, [customerName]);
    useEffect(() => {
        if (vehicleNo) localStorage.setItem('mobileScan_vehicleNo', vehicleNo);
    }, [vehicleNo]);
    useEffect(() => {
        if (pickerName) localStorage.setItem('mobileScan_pickerName', pickerName);
    }, [pickerName]);

    // Fetch product info by WSN
    const fetchWSNData = useCallback(async (wsn: string) => {
        if (!wsn || !activeWarehouse?.id) return;
        setLoading(true);
        setError(null);
        setProductInfo(null);

        try {
            if (mode === 'qc') {
                const res = await qcAPI.getPendingInbound(activeWarehouse.id, wsn);
                const items = res.data?.data || res.data || [];
                const match = items.find((i: any) => (i.wsn || '').toUpperCase() === wsn.toUpperCase());
                if (match) {
                    setProductInfo(match);
                } else {
                    setError('WSN not found in pending inbound.');
                }
            } else if (mode === 'outbound') {
                const res = await outboundAPI.getSourceByWSN(wsn, activeWarehouse.id);
                if (res.data) {
                    setProductInfo(res.data);
                } else {
                    setError('WSN not found for outbound.');
                }
            } else if (mode === 'picking') {
                const res = await pickingAPI.getSourceByWSN(wsn, activeWarehouse.id);
                if (res.data) {
                    setProductInfo(res.data);
                    // Auto-fill rack from source data
                    if (res.data.rack_no) setRackNo(res.data.rack_no);
                } else {
                    setError('WSN not found for picking.');
                }
            }
        } catch (err: any) {
            const msg = err?.response?.data?.error || err?.message || 'Failed to fetch WSN data';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [activeWarehouse?.id, mode]);

    // Handle scan from camera
    const handleScan = useCallback((wsn: string) => {
        if (soundOn) playBeep();
        setLastScannedWSN(wsn);
        setManualWSN(wsn);
        fetchWSNData(wsn);
    }, [fetchWSNData, soundOn]);

    // Handle manual WSN entry
    const handleManualSubmit = useCallback(() => {
        const wsn = manualWSN.trim().toUpperCase();
        if (!wsn) return;
        setLastScannedWSN(wsn);
        fetchWSNData(wsn);
    }, [manualWSN, fetchWSNData]);

    // Submit entry
    const handleSubmit = useCallback(async () => {
        if (!lastScannedWSN || !activeWarehouse?.id) {
            toast.error('Please scan a WSN first');
            return;
        }

        setSubmitting(true);
        try {
            if (mode === 'qc') {
                if (!qcByName.trim()) {
                    toast.error('QC By Name is required');
                    setSubmitting(false);
                    return;
                }
                await qcAPI.createEntry({
                    wsn: lastScannedWSN,
                    qc_date: qcDate,
                    qc_by_name: qcByName.trim(),
                    qc_grade: qcGrade,
                    qc_remarks: qcRemarks,
                    other_remarks: '',
                    product_serial_number: productInfo?.product_serial_number || '',
                    rack_no: rackNo,
                    warehouse_id: activeWarehouse.id,
                    update_existing: false,
                });
                setLastEntry(`${lastScannedWSN} → Grade ${qcGrade || 'N/A'}`);
            } else if (mode === 'outbound') {
                if (!customerName.trim()) {
                    toast.error('Customer name is required');
                    setSubmitting(false);
                    return;
                }
                await outboundAPI.createSingle({
                    wsn: lastScannedWSN,
                    dispatch_date: dispatchDate,
                    customer_name: customerName.trim(),
                    vehicle_no: vehicleNo,
                    dispatch_remarks: dispatchRemarks,
                    other_remarks: '',
                    warehouse_id: activeWarehouse.id,
                    update_existing: false,
                });
                setLastEntry(`${lastScannedWSN} → ${customerName}`);
            } else if (mode === 'picking') {
                await pickingAPI.multiEntry(
                    [{
                        wsn: lastScannedWSN,
                        picking_date: pickingDate,
                        picker_name: pickerName.trim(),
                        picking_remarks: pickingRemarks,
                        rack_no: productInfo?.rack_no || rackNo || '',
                        product_serial_number: productInfo?.product_serial_number || '',
                    }],
                    activeWarehouse.id
                );
                setLastEntry(`${lastScannedWSN} → Picked`);
            }

            toast.success('Entry saved!');
            setSessionCount(prev => prev + 1);

            // Reset for next scan
            setLastScannedWSN('');
            setManualWSN('');
            setProductInfo(null);
            setQcRemarks('');
            setDispatchRemarks('');
            setPickingRemarks('');
            setError(null);

            // Auto-open camera for next scan
            if (cameraOpen) {
                // Camera stays open, user scans next
            } else {
                // Focus manual input
                setTimeout(() => wsnInputRef.current?.focus(), 200);
            }
        } catch (err: any) {
            const msg = err?.response?.data?.error || err?.message || 'Submit failed';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    }, [
        lastScannedWSN, activeWarehouse?.id, mode,
        qcByName, qcDate, qcGrade, qcRemarks, rackNo, productInfo,
        customerName, dispatchDate, vehicleNo, dispatchRemarks,
        pickerName, pickingDate, pickingRemarks, cameraOpen
    ]);

    const canSubmit = lastScannedWSN && !submitting && !loading;

    return (
        <Box
            sx={{
                minHeight: '100dvh',
                bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Toaster position="top-center" />

            {/* App Bar */}
            <AppBar
                position="sticky"
                elevation={0}
                sx={{
                    background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}cc 100%)`,
                }}
            >
                <Toolbar sx={{ minHeight: '48px !important', px: 1.5 }}>
                    <IconButton edge="start" color="inherit" onClick={() => router.back()} sx={{ mr: 0.5 }}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography sx={{ fontWeight: 800, fontSize: '1rem', flex: 1 }}>
                        {config.icon} {config.title}
                    </Typography>
                    <IconButton color="inherit" onClick={() => setSoundOn(!soundOn)} size="small">
                        {soundOn ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
                    </IconButton>
                    {sessionCount > 0 && (
                        <Chip
                            label={sessionCount}
                            size="small"
                            sx={{
                                ml: 0.5,
                                bgcolor: 'rgba(255,255,255,0.2)',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                height: 24,
                            }}
                        />
                    )}
                </Toolbar>
            </AppBar>

            {/* Warehouse indicator */}
            {activeWarehouse && (
                <Box sx={{ px: 2, py: 0.5, bgcolor: isDarkMode ? '#1e293b' : '#e2e8f0' }}>
                    <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                        📍 {activeWarehouse.name || activeWarehouse.warehouse_name || 'Warehouse'}
                    </Typography>
                </Box>
            )}

            {/* Main Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>

                {/* Camera Scanner */}
                <CameraScanner
                    isOpen={cameraOpen}
                    onScan={handleScan}
                    onClose={() => setCameraOpen(false)}
                    title={`Scan WSN for ${config.title}`}
                />

                {/* Camera toggle + Manual WSN input */}
                <Card
                    sx={{
                        mt: cameraOpen ? 1.5 : 0,
                        borderRadius: 2,
                        boxShadow: isDarkMode ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.08)',
                        bgcolor: isDarkMode ? '#1e293b' : '#fff',
                    }}
                >
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Stack spacing={1.5}>
                            {/* Camera Toggle Button */}
                            {!cameraOpen && (
                                <Button
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    startIcon={<CameraIcon />}
                                    onClick={() => setCameraOpen(true)}
                                    sx={{
                                        py: 1.5,
                                        fontWeight: 800,
                                        fontSize: '0.95rem',
                                        borderRadius: 2,
                                        background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}bb 100%)`,
                                        textTransform: 'none',
                                        boxShadow: `0 4px 14px ${config.color}40`,
                                    }}
                                >
                                    Open Camera & Scan
                                </Button>
                            )}

                            {/* Manual WSN input */}
                            <Stack direction="row" spacing={1} alignItems="center">
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Manual WSN"
                                    value={manualWSN}
                                    onChange={(e) => setManualWSN(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleManualSubmit();
                                        }
                                    }}
                                    inputRef={wsnInputRef}
                                    placeholder="Type or paste WSN..."
                                    sx={{
                                        '& .MuiInputBase-root': {
                                            bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                                        },
                                    }}
                                />
                                <Button
                                    variant="outlined"
                                    onClick={handleManualSubmit}
                                    sx={{
                                        minWidth: 60,
                                        fontWeight: 700,
                                        borderColor: config.color,
                                        color: config.color,
                                    }}
                                >
                                    Go
                                </Button>
                            </Stack>
                        </Stack>
                    </CardContent>
                </Card>

                {/* Loading */}
                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={28} sx={{ color: config.color }} />
                    </Box>
                )}

                {/* Error */}
                {error && (
                    <Alert severity="error" sx={{ mt: 1.5, borderRadius: 1.5, fontSize: '0.8rem' }}>
                        {error}
                    </Alert>
                )}

                {/* Product Info Card */}
                {productInfo && (
                    <Fade in>
                        <Card
                            sx={{
                                mt: 1.5,
                                borderRadius: 2,
                                border: `2px solid ${config.color}40`,
                                bgcolor: isDarkMode ? '#1e293b' : '#fff',
                            }}
                        >
                            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: config.color, mb: 0.5 }}>
                                    ✅ WSN: {lastScannedWSN}
                                </Typography>
                                <Stack spacing={0.3}>
                                    {productInfo.product_title && (
                                        <Typography sx={{ fontSize: '0.78rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                                            📦 {productInfo.product_title}
                                        </Typography>
                                    )}
                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                        {productInfo.brand && (
                                            <Chip label={productInfo.brand} size="small" sx={{ fontSize: '0.7rem', height: 22 }} />
                                        )}
                                        {productInfo.mrp && (
                                            <Chip label={`MRP: ₹${productInfo.mrp}`} size="small" sx={{ fontSize: '0.7rem', height: 22 }} />
                                        )}
                                        {productInfo.fsp && (
                                            <Chip label={`FSP: ₹${productInfo.fsp}`} size="small" sx={{ fontSize: '0.7rem', height: 22 }} />
                                        )}
                                        {productInfo.rack_no && (
                                            <Chip label={`Rack: ${productInfo.rack_no}`} size="small" sx={{ fontSize: '0.7rem', height: 22 }} />
                                        )}
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Fade>
                )}

                {/* Mode-specific form fields */}
                {lastScannedWSN && (
                    <Card
                        sx={{
                            mt: 1.5,
                            borderRadius: 2,
                            bgcolor: isDarkMode ? '#1e293b' : '#fff',
                            boxShadow: isDarkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
                        }}
                    >
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>

                            {/* ===== QC FIELDS ===== */}
                            {mode === 'qc' && (
                                <Stack spacing={1.5}>
                                    {/* QC Grade - Quick tap buttons */}
                                    <Box>
                                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, mb: 0.5, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                            QC Grade
                                        </Typography>
                                        <ToggleButtonGroup
                                            value={qcGrade}
                                            exclusive
                                            onChange={(_, val) => { if (val !== null) setQcGrade(val); }}
                                            fullWidth
                                            size="small"
                                            sx={{
                                                '& .MuiToggleButton-root': {
                                                    fontWeight: 800,
                                                    fontSize: '0.85rem',
                                                    py: 1,
                                                    textTransform: 'none',
                                                    '&.Mui-selected': {
                                                        bgcolor: config.color,
                                                        color: '#fff',
                                                        '&:hover': { bgcolor: config.color },
                                                    },
                                                },
                                            }}
                                        >
                                            <ToggleButton value="A">A</ToggleButton>
                                            <ToggleButton value="B">B</ToggleButton>
                                            <ToggleButton value="C">C</ToggleButton>
                                            <ToggleButton value="D">D</ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>

                                    <TextField
                                        fullWidth size="small" label="QC By Name *"
                                        value={qcByName}
                                        onChange={(e) => setQcByName(e.target.value)}
                                        placeholder="Your name"
                                    />

                                    <FormControl fullWidth size="small">
                                        <InputLabel>Rack Location</InputLabel>
                                        <Select
                                            value={rackNo}
                                            onChange={(e) => setRackNo(e.target.value)}
                                            label="Rack Location"
                                        >
                                            <MenuItem value="">None</MenuItem>
                                            {racks.map((r) => (
                                                <MenuItem key={r} value={r}>{r}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>

                                    <TextField
                                        fullWidth size="small" label="QC Date" type="date"
                                        value={qcDate}
                                        onChange={(e) => setQcDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />

                                    <TextField
                                        fullWidth size="small" label="Remarks (optional)"
                                        value={qcRemarks}
                                        onChange={(e) => setQcRemarks(e.target.value)}
                                        multiline rows={2}
                                        placeholder="Any remarks..."
                                    />
                                </Stack>
                            )}

                            {/* ===== OUTBOUND FIELDS ===== */}
                            {mode === 'outbound' && (
                                <Stack spacing={1.5}>
                                    <CustomerAutocomplete
                                        value={customerName}
                                        onChange={(val) => setCustomerName(val)}
                                        customers={customers}
                                        warehouseId={activeWarehouse?.id}
                                        onCustomerAdded={() => {
                                            if (activeWarehouse?.id) {
                                                outboundAPI.getCustomers(activeWarehouse.id)
                                                    .then((res) => setCustomers((res.data || []).map((c: any) => c.customer_name || c)))
                                                    .catch(() => { });
                                            }
                                        }}
                                        size="small"
                                        label="Customer Name *"
                                        placeholder="Type or select..."
                                    />

                                    <TextField
                                        fullWidth size="small" label="Vehicle No"
                                        value={vehicleNo}
                                        onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                                        placeholder="MH-01-AB-1234"
                                    />

                                    <TextField
                                        fullWidth size="small" label="Dispatch Date" type="date"
                                        value={dispatchDate}
                                        onChange={(e) => setDispatchDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />

                                    <TextField
                                        fullWidth size="small" label="Remarks (optional)"
                                        value={dispatchRemarks}
                                        onChange={(e) => setDispatchRemarks(e.target.value)}
                                        multiline rows={2}
                                    />
                                </Stack>
                            )}

                            {/* ===== PICKING FIELDS ===== */}
                            {mode === 'picking' && (
                                <Stack spacing={1.5}>
                                    <TextField
                                        fullWidth size="small" label="Picker Name"
                                        value={pickerName}
                                        onChange={(e) => setPickerName(e.target.value)}
                                        placeholder="Your name"
                                    />

                                    <TextField
                                        fullWidth size="small" label="Picking Date" type="date"
                                        value={pickingDate}
                                        onChange={(e) => setPickingDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />

                                    <TextField
                                        fullWidth size="small" label="Remarks (optional)"
                                        value={pickingRemarks}
                                        onChange={(e) => setPickingRemarks(e.target.value)}
                                        multiline rows={2}
                                    />
                                </Stack>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Last entry indicator */}
                {lastEntry && (
                    <Box
                        sx={{
                            mt: 1.5,
                            px: 1.5,
                            py: 0.8,
                            borderRadius: 1.5,
                            bgcolor: isDarkMode ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)',
                            border: '1px solid rgba(34,197,94,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                        }}
                    >
                        <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 16 }} />
                        <Typography sx={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>
                            Last: {lastEntry}
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Fixed Bottom Submit Bar */}
            {lastScannedWSN && (
                <Box
                    sx={{
                        p: 1.5,
                        borderTop: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                        bgcolor: isDarkMode ? '#1e293b' : '#fff',
                        position: 'sticky',
                        bottom: 0,
                        zIndex: 10,
                    }}
                >
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
                        sx={{
                            py: 1.5,
                            fontWeight: 800,
                            fontSize: '1rem',
                            borderRadius: 2,
                            background: canSubmit
                                ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)'
                                : undefined,
                            textTransform: 'none',
                            boxShadow: canSubmit ? '0 4px 14px rgba(34,197,94,0.3)' : 'none',
                        }}
                    >
                        {submitting ? 'Saving...' : 'Submit & Scan Next'}
                    </Button>
                </Box>
            )}
        </Box>
    );
}
