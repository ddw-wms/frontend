'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Box, IconButton, Typography, Stack, Slider, Button,
} from '@mui/material';
import {
    Close as CloseIcon,
    FlashlightOn as FlashOnIcon,
    FlashlightOff as FlashOffIcon,
    CameraRear as CameraRearIcon,
    CameraFront as CameraFrontIcon,
    ZoomIn as ZoomInIcon,
} from '@mui/icons-material';

interface CameraScannerProps {
    onScan: (decodedText: string) => void;
    /** Synchronous check called BEFORE showing overlay. Return 'duplicate' for red flash. */
    onScanCheck?: (decodedText: string) => 'success' | 'duplicate';
    onClose: () => void;
    isOpen: boolean;
    title?: string;
}

const TORCH_CAMERA_KEY = 'mobileScan_torchCameraId';
const ZOOM_STORAGE_KEY = 'mobileScan_cameraZoom';
const SAME_BARCODE_COOLDOWN = 3000;
const SCAN_PAUSE_DURATION = 1200;
const SCAN_INTERVAL_MS = 100;

const BARCODE_FORMATS = [
    'code_128', 'code_39', 'code_93', 'codabar',
    'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e',
    'qr_code', 'data_matrix', 'pdf417', 'aztec',
];

function playErrorBeep() {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 300;
        gain.gain.value = 0.5;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch { /* no audio */ }
}

export default function CameraScanner({ onScan, onScanCheck, onClose, isOpen, title = 'Scan Barcode' }: CameraScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const detectorRef = useRef<any>(null);
    const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const selectedCameraIdRef = useRef<string | null>(null);

    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const [facingBack, setFacingBack] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const [scanPaused, setScanPaused] = useState(false);
    const [scanResultType, setScanResultType] = useState<'success' | 'duplicate'>('success');
    const [lastScannedWSN, setLastScannedWSN] = useState('');
    const [zoomLevel, setZoomLevel] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(ZOOM_STORAGE_KEY);
            return saved ? parseFloat(saved) : 1;
        }
        return 1;
    });
    const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null);
    const [showZoom, setShowZoom] = useState(false);

    const lastScanRef = useRef<string>('');
    const lastScanTimeRef = useRef<number>(0);
    const isPausedRef = useRef(false);
    const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onScanRef = useRef(onScan);
    const onScanCheckRef = useRef(onScanCheck);
    onScanRef.current = onScan;
    onScanCheckRef.current = onScanCheck;

    // Get the active video track from OUR stream (not a third-party library's)
    const getTrack = useCallback((): MediaStreamTrack | null => {
        return streamRef.current?.getVideoTracks()[0] || null;
    }, []);

    // Stop camera and cleanup everything
    const stopCamera = useCallback(() => {
        if (scanTimerRef.current) { clearInterval(scanTimerRef.current); scanTimerRef.current = null; }
        if (pauseTimerRef.current) { clearTimeout(pauseTimerRef.current); pauseTimerRef.current = null; }
        isPausedRef.current = false;
        setScanPaused(false);
        setLastScannedWSN('');

        if (streamRef.current) {
            const track = streamRef.current.getVideoTracks()[0];
            if (track) {
                try { track.applyConstraints({ advanced: [{ torch: false } as any] }); } catch { /* ignore */ }
            }
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;

        setScanning(false);
        setTorchOn(false);
        setTorchSupported(false);
        setZoomRange(null);
    }, []);

    // Check if a specific camera device has torch capability
    const checkDeviceTorch = useCallback(async (deviceId: string): Promise<boolean> => {
        let stream: MediaStream | null = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: deviceId } }
            });
            const track = stream.getVideoTracks()[0];
            if (!track) return false;

            // Samsung: ImageCapture + grabFrame warm-up to unlock torch HAL
            try {
                if (typeof ImageCapture !== 'undefined') {
                    const ic = new ImageCapture(track) as any;
                    try { await ic.grabFrame(); } catch { /* grabFrame may fail but still unlocks torch */ }
                }
            } catch { /* ignore */ }

            await new Promise(r => setTimeout(r, 400));

            const caps = track.getCapabilities?.() as any;
            return caps?.torch === true;
        } catch {
            return false;
        } finally {
            if (stream) stream.getTracks().forEach(t => t.stop());
        }
    }, []);

    // Find a camera with torch support (Samsung S24 Ultra has 4+ back cameras, only main wide has torch)
    const findTorchCameraId = useCallback(async (excludeId?: string): Promise<string | null> => {
        // Check cache first
        try {
            const cached = localStorage.getItem(TORCH_CAMERA_KEY);
            if (cached && cached !== excludeId) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                if (devices.some(d => d.deviceId === cached && d.kind === 'videoinput')) {
                    return cached;
                }
                localStorage.removeItem(TORCH_CAMERA_KEY);
            }
        } catch { /* ignore */ }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(d => d.kind === 'videoinput');
            if (videoInputs.length <= 1) return null;

            for (const device of videoInputs) {
                if (device.deviceId === excludeId) continue;
                // Skip front cameras if label is available
                if (device.label && /front|user/i.test(device.label)) continue;

                const hasTorch = await checkDeviceTorch(device.deviceId);
                if (hasTorch) {
                    try { localStorage.setItem(TORCH_CAMERA_KEY, device.deviceId); } catch { /* ignore */ }
                    return device.deviceId;
                }
            }
        } catch { /* ignore */ }
        return null;
    }, [checkDeviceTorch]);

    // Initialize BarcodeDetector (native Chrome/Safari API)
    const initDetector = useCallback(async (): Promise<boolean> => {
        if (detectorRef.current) return true;

        const BD = (window as any).BarcodeDetector;
        if (!BD) return false;

        try {
            let formats = BARCODE_FORMATS;
            try {
                const supported: string[] = await BD.getSupportedFormats();
                formats = BARCODE_FORMATS.filter(f => supported.includes(f));
                if (formats.length === 0) formats = supported.slice(0, 5);
            } catch { /* use default formats */ }

            detectorRef.current = new BD({ formats });
            return true;
        } catch {
            return false;
        }
    }, []);

    // Start barcode detection loop — reads frames from OUR video element
    const startDetection = useCallback(() => {
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);

        scanTimerRef.current = setInterval(async () => {
            if (isPausedRef.current || !videoRef.current || !detectorRef.current) return;
            if (videoRef.current.readyState < 2) return;

            try {
                const barcodes = await detectorRef.current.detect(videoRef.current);
                if (!barcodes?.length || isPausedRef.current) return;

                const raw = barcodes[0].rawValue?.trim()?.toUpperCase();
                if (!raw) return;

                const now = Date.now();
                if (raw === lastScanRef.current && now - lastScanTimeRef.current < SAME_BARCODE_COOLDOWN) return;

                lastScanRef.current = raw;
                lastScanTimeRef.current = now;

                const resultType = onScanCheckRef.current ? onScanCheckRef.current(raw) : 'success';

                isPausedRef.current = true;
                setScanPaused(true);
                setScanResultType(resultType);
                setLastScannedWSN(raw);

                if (resultType === 'duplicate') {
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
                    playErrorBeep();
                } else {
                    if (navigator.vibrate) navigator.vibrate(100);
                }

                onScanRef.current(raw);

                pauseTimerRef.current = setTimeout(() => {
                    isPausedRef.current = false;
                    setScanPaused(false);
                    setLastScannedWSN('');
                }, SCAN_PAUSE_DURATION);
            } catch { /* frame decode error, skip */ }
        }, SCAN_INTERVAL_MS);
    }, []);

    // Setup zoom controls on current track
    const setupZoom = useCallback(() => {
        const track = getTrack();
        if (!track) return;
        try {
            const caps = track.getCapabilities?.() as any;
            if (caps?.zoom) {
                setZoomRange({ min: caps.zoom.min, max: caps.zoom.max });
                const saved = localStorage.getItem(ZOOM_STORAGE_KEY);
                const level = saved ? parseFloat(saved) : 1;
                const clamped = Math.min(Math.max(level, caps.zoom.min), caps.zoom.max);
                setZoomLevel(clamped);
                track.applyConstraints({ advanced: [{ zoom: clamped } as any] }).catch(() => { });
            }
        } catch { /* ignore */ }
    }, [getTrack]);

    // Open camera stream and start scanning
    const startCamera = useCallback(async (useFront = false) => {
        setError(null);
        stopCamera();
        await new Promise(r => setTimeout(r, 150));

        // Initialize barcode detector
        const hasDetector = await initDetector();
        if (!hasDetector) {
            setError('Barcode scanning not supported.\n\nPlease use Chrome, Edge, or Safari.');
            return;
        }

        try {
            let cameraId: string | null = null;

            if (!useFront) {
                // Try cached torch camera first
                cameraId = selectedCameraIdRef.current;
                if (!cameraId) {
                    try { cameraId = localStorage.getItem(TORCH_CAMERA_KEY); } catch { /* ignore */ }
                }
            }

            // Open camera with getUserMedia — WE own the stream
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: cameraId
                        ? { deviceId: { exact: cameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
                        : { facingMode: useFront ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false,
                });
            } catch (e: any) {
                // Cached camera might be stale
                if (cameraId && (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError')) {
                    selectedCameraIdRef.current = null;
                    try { localStorage.removeItem(TORCH_CAMERA_KEY); } catch { /* ignore */ }
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: useFront ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                        audio: false,
                    });
                    cameraId = null;
                } else {
                    throw e;
                }
            }

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play().catch(() => { /* autoplay blocked — user interaction required */ });
            }

            setScanning(true);
            setFacingBack(!useFront);
            startDetection();

            // Torch & zoom setup (back camera only)
            if (!useFront) {
                const track = stream.getVideoTracks()[0];
                if (track) {
                    // Samsung: warm up torch HAL with ImageCapture
                    try {
                        if (typeof ImageCapture !== 'undefined') {
                            const ic = new ImageCapture(track) as any;
                            try { await ic.grabFrame(); } catch { /* ignore */ }
                        }
                    } catch { /* ignore */ }

                    await new Promise(r => setTimeout(r, 500));
                    const caps = track.getCapabilities?.() as any;

                    if (caps?.torch === true) {
                        // Current camera has torch — great!
                        setTorchSupported(true);
                        selectedCameraIdRef.current = track.getSettings?.()?.deviceId || cameraId;
                    } else if (!cameraId) {
                        // facingMode selected a camera without torch — find the right one
                        const currentId = track.getSettings?.()?.deviceId;

                        // Stop current stream to avoid resource conflicts during probing
                        if (scanTimerRef.current) { clearInterval(scanTimerRef.current); scanTimerRef.current = null; }
                        stream.getTracks().forEach(t => t.stop());
                        streamRef.current = null;

                        const torchId = await findTorchCameraId(currentId);
                        const restartId = torchId || currentId;

                        // Restart with the best camera
                        const newStream = await navigator.mediaDevices.getUserMedia({
                            video: restartId
                                ? { deviceId: { exact: restartId }, width: { ideal: 1280 }, height: { ideal: 720 } }
                                : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                            audio: false,
                        });
                        streamRef.current = newStream;
                        if (videoRef.current) {
                            videoRef.current.srcObject = newStream;
                            await videoRef.current.play().catch(() => { });
                        }
                        startDetection();

                        if (torchId) {
                            selectedCameraIdRef.current = torchId;
                            const newTrack = newStream.getVideoTracks()[0];
                            if (newTrack) {
                                try {
                                    if (typeof ImageCapture !== 'undefined') {
                                        const ic = new ImageCapture(newTrack) as any;
                                        try { await ic.grabFrame(); } catch { /* ignore */ }
                                    }
                                } catch { /* ignore */ }
                                await new Promise(r => setTimeout(r, 400));
                                const newCaps = newTrack.getCapabilities?.() as any;
                                setTorchSupported(newCaps?.torch === true);
                            }
                        }
                    }
                }
                setupZoom();
            }
        } catch (err: any) {
            const msg = err?.message || err?.name || String(err);
            if (msg.includes('NotAllowed') || msg.includes('Permission') || msg.includes('permission')) {
                setError('Camera permission denied.\n\n\u2022 Android Chrome: Tap lock icon \u2192 Camera \u2192 Allow\n\u2022 iPhone Safari: Settings \u2192 Safari \u2192 Camera \u2192 Allow\n\nRefresh page after enabling.');
            } else if (msg.includes('NotFound') || msg.includes('not found')) {
                setError('No camera found on this device.');
            } else if (msg.includes('NotReadable') || msg.includes('Could not start')) {
                setError('Camera is in use by another app.\nClose other camera apps and try again.');
            } else {
                setError(`Camera error: ${msg}`);
            }
            setScanning(false);
        }
    }, [stopCamera, initDetector, startDetection, findTorchCameraId, setupZoom]);

    // Torch toggle — direct control on OUR stream track (guaranteed to work)
    const handleToggleTorch = useCallback(async () => {
        const track = getTrack();
        if (!track || track.readyState !== 'live') return;

        const newState = !torchOn;

        // Samsung: warm up before applying torch
        try {
            if (typeof ImageCapture !== 'undefined') {
                const ic = new ImageCapture(track) as any;
                try { await ic.grabFrame(); } catch { /* ignore */ }
            }
        } catch { /* ignore */ }

        // Try advanced constraint syntax
        try {
            await track.applyConstraints({ advanced: [{ torch: newState } as any] });
            setTorchOn(newState);
            return;
        } catch { /* try next */ }

        // Try flat constraint syntax
        try {
            await (track.applyConstraints as any)({ torch: newState });
            setTorchOn(newState);
            return;
        } catch { /* failed */ }

        // Both failed — this camera doesn't actually support torch
        setTorchSupported(false);
    }, [torchOn, getTrack]);

    // Flip camera
    const handleFlipCamera = useCallback(() => {
        const newBack = !facingBack;
        setFacingBack(newBack);
        startCamera(!newBack);
    }, [facingBack, startCamera]);

    // Zoom change
    const handleZoomChange = useCallback((_: Event, val: number | number[]) => {
        const level = val as number;
        setZoomLevel(level);
        const track = getTrack();
        if (track) track.applyConstraints({ advanced: [{ zoom: level } as any] }).catch(() => { });
        localStorage.setItem(ZOOM_STORAGE_KEY, String(level));
    }, [getTrack]);

    // Retry
    const handleRetry = useCallback(() => {
        setError(null);
        startCamera(!facingBack ? true : false);
    }, [facingBack, startCamera]);

    // Handle page visibility change (phone sleep/wake)
    useEffect(() => {
        if (!isOpen) return;
        const handleVis = () => {
            if (document.visibilityState === 'visible' && isOpen && !scanning) {
                startCamera(!facingBack ? true : false);
            }
        };
        document.addEventListener('visibilitychange', handleVis);
        return () => document.removeEventListener('visibilitychange', handleVis);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, scanning, facingBack]);

    // Open/close
    useEffect(() => {
        if (isOpen) {
            startCamera(!facingBack ? true : false);
        } else {
            stopCamera();
        }
        return () => { stopCamera(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    if (!isOpen) return null;

    const isDuplicate = scanResultType === 'duplicate';
    const overlayColor = isDuplicate ? 'rgba(239,68,68' : 'rgba(34,197,94';
    const pillColor = isDuplicate ? 'rgba(239,68,68,0.9)' : 'rgba(34,197,94,0.9)';

    return (
        <Box sx={{ position: 'relative', width: '100%', bgcolor: '#000', borderRadius: 2, overflow: 'hidden' }}>
            {/* Header */}
            <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                px: 1.5, py: 0.8, bgcolor: 'rgba(0,0,0,0.85)', zIndex: 2,
            }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem' }}>
                    {title}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    {/* Torch button — always visible, even if torch check pending */}
                    <IconButton
                        size="small" onClick={handleToggleTorch}
                        sx={{
                            width: 36, height: 36,
                            color: torchOn ? '#fbbf24' : (torchSupported ? '#e2e8f0' : '#4b5563'),
                            bgcolor: torchOn ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)',
                            border: torchOn ? '1.5px solid #fbbf24' : '1px solid rgba(255,255,255,0.15)',
                            '&:active': { bgcolor: 'rgba(251,191,36,0.4)' },
                        }}
                    >
                        {torchOn ? <FlashOnIcon sx={{ fontSize: 20 }} /> : <FlashOffIcon sx={{ fontSize: 20 }} />}
                    </IconButton>
                    {zoomRange && (
                        <IconButton size="small" onClick={() => setShowZoom(!showZoom)} sx={{
                            color: showZoom ? '#60a5fa' : '#94a3b8', width: 32, height: 32,
                            bgcolor: showZoom ? 'rgba(96,165,250,0.2)' : 'transparent',
                        }}>
                            <ZoomInIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    )}
                    <IconButton size="small" onClick={handleFlipCamera} sx={{ color: '#94a3b8', width: 32, height: 32 }}>
                        {facingBack ? <CameraFrontIcon sx={{ fontSize: 18 }} /> : <CameraRearIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                    <IconButton size="small" onClick={onClose} sx={{ color: '#fff', width: 32, height: 32 }}>
                        <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Stack>
            </Box>

            {/* Camera View — OUR video element (no third-party library) */}
            <Box sx={{
                position: 'relative', width: '100%', minHeight: 200, maxHeight: 240, overflow: 'hidden',
            }}>
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        width: '100%',
                        objectFit: 'cover',
                        maxHeight: 240,
                        display: 'block',
                    }}
                />

                {/* Scan region indicator */}
                {scanning && !error && (
                    <Box sx={{
                        position: 'absolute',
                        top: '50%', left: '50%',
                        width: 280, height: 100,
                        transform: 'translate(-50%, -50%)',
                        border: `2px solid ${scanPaused ? (isDuplicate ? '#ef4444' : '#22c55e') : 'rgba(96,165,250,0.7)'}`,
                        borderRadius: 1,
                        pointerEvents: 'none',
                        zIndex: 2,
                        transition: 'border-color 0.15s',
                    }} />
                )}

                {/* Scan flash overlay — green for success, red for duplicate */}
                {scanPaused && (
                    <Box sx={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        bgcolor: `${overlayColor},0.2)`, zIndex: 3,
                        animation: 'flashIn 0.15s ease-out',
                        '@keyframes flashIn': { '0%': { bgcolor: `${overlayColor},0.5)` }, '100%': { bgcolor: `${overlayColor},0.15)` } },
                    }}>
                        <Box sx={{
                            px: 2, py: 0.8, borderRadius: 2,
                            bgcolor: pillColor, backdropFilter: 'blur(4px)',
                        }}>
                            <Typography sx={{
                                color: '#fff', fontWeight: 800, fontSize: '0.85rem',
                                fontFamily: 'monospace', textAlign: 'center',
                            }}>
                                {isDuplicate ? '\u2717 DUPLICATE' : '\u2713'} {lastScannedWSN}
                            </Typography>
                        </Box>
                    </Box>
                )}

                {/* Error overlay */}
                {error && (
                    <Box sx={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        bgcolor: 'rgba(0,0,0,0.92)', p: 2, zIndex: 3,
                    }}>
                        <Typography sx={{
                            color: '#f87171', fontSize: '0.75rem', textAlign: 'center',
                            whiteSpace: 'pre-line', lineHeight: 1.5,
                        }}>{error}</Typography>
                        <Button
                            size="small" variant="outlined"
                            onClick={handleRetry}
                            sx={{
                                mt: 1.5, color: '#60a5fa', borderColor: '#60a5fa',
                                fontSize: '0.75rem', textTransform: 'none', fontWeight: 700,
                                px: 3,
                            }}
                        >
                            Retry Camera
                        </Button>
                    </Box>
                )}

                {/* Scanning indicator */}
                {scanning && !error && !scanPaused && (
                    <Box sx={{
                        position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
                        px: 1.5, py: 0.3, borderRadius: 1, bgcolor: 'rgba(96,165,250,0.25)',
                    }}>
                        <Typography sx={{
                            color: '#60a5fa', fontSize: '0.65rem', fontWeight: 700,
                            animation: 'pulse 1.5s infinite',
                            '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
                        }}>{'\u25CF'} Ready to scan</Typography>
                    </Box>
                )}
            </Box>

            {/* Zoom Slider */}
            {showZoom && zoomRange && (
                <Box sx={{ px: 2, py: 0.5, bgcolor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', minWidth: 14 }}>1x</Typography>
                    <Slider
                        value={zoomLevel}
                        min={zoomRange.min}
                        max={zoomRange.max}
                        step={0.1}
                        onChange={handleZoomChange}
                        size="small"
                        sx={{
                            color: '#60a5fa', height: 4,
                            '& .MuiSlider-thumb': { width: 16, height: 16 },
                        }}
                    />
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', minWidth: 22 }}>
                        {zoomLevel.toFixed(1)}x
                    </Typography>
                </Box>
            )}
        </Box>
    );
}
