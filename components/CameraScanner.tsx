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
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

interface CameraScannerProps {
    onScan: (decodedText: string) => void;
    /** Synchronous check called BEFORE showing overlay. Return 'duplicate' for red flash. */
    onScanCheck?: (decodedText: string) => 'success' | 'duplicate';
    onClose: () => void;
    isOpen: boolean;
    title?: string;
}

const SCANNER_REGION_ID = 'mobile-camera-scanner-region';
const ZOOM_STORAGE_KEY = 'mobileScan_cameraZoom';
const SAME_BARCODE_COOLDOWN = 3000;
const SCAN_PAUSE_DURATION = 1200;

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
    const scannerRef = useRef<Html5Qrcode | null>(null);
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
    const torchCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Store refs for callbacks used inside html5-qrcode scan handler
    const onScanRef = useRef(onScan);
    const onScanCheckRef = useRef(onScanCheck);
    onScanRef.current = onScan;
    onScanCheckRef.current = onScanCheck;

    // Get the video track — tries multiple methods for reliability
    const getVideoTrack = useCallback((): MediaStreamTrack | null => {
        // Method 1: Direct DOM query inside scanner region
        try {
            const video = document.querySelector(`#${SCANNER_REGION_ID} video`) as HTMLVideoElement;
            if (video?.srcObject) {
                const tracks = (video.srcObject as MediaStream).getVideoTracks();
                if (tracks.length > 0 && tracks[0].readyState === 'live') return tracks[0];
            }
        } catch { /* ignore */ }
        // Method 2: Access html5-qrcode's internal MediaStream (private but reliable)
        try {
            const scanner = scannerRef.current as any;
            const internalStream = scanner?.localMediaStream || scanner?._localMediaStream;
            if (internalStream) {
                const tracks = internalStream.getVideoTracks();
                if (tracks.length > 0 && tracks[0].readyState === 'live') return tracks[0];
            }
        } catch { /* ignore */ }
        // Method 3: Search ALL video elements on page
        try {
            const videos = document.querySelectorAll('video');
            for (let i = 0; i < videos.length; i++) {
                const v = videos[i];
                if (v.srcObject) {
                    const tracks = (v.srcObject as MediaStream).getVideoTracks();
                    if (tracks.length > 0 && tracks[0].readyState === 'live') return tracks[0];
                }
            }
        } catch { /* ignore */ }
        return null;
    }, []);

    // Initialize ImageCapture on track — unlocks torch capability on many Android devices
    const initImageCapture = useCallback((track: MediaStreamTrack) => {
        try {
            if (typeof ImageCapture !== 'undefined') {
                new ImageCapture(track);
            }
        } catch { /* not supported */ }
    }, []);

    // Check torch capability on the html5-qrcode video track with polling
    const checkTorchSupport = useCallback(() => {
        if (torchCheckTimerRef.current) clearTimeout(torchCheckTimerRef.current);
        let attempts = 0;
        const check = () => {
            attempts++;

            // Check via html5-qrcode's own public API
            try {
                const scanner = scannerRef.current as any;
                if (scanner && typeof scanner.getRunningTrackCapabilities === 'function') {
                    const caps = scanner.getRunningTrackCapabilities() as any;
                    if (caps?.torch === true) {
                        setTorchSupported(true);
                        return;
                    }
                }
            } catch { /* ignore */ }

            const track = getVideoTrack();
            if (track) {
                initImageCapture(track);

                // Check 1: getCapabilities reports torch
                try {
                    const caps = track.getCapabilities?.() as any;
                    if (caps?.torch === true) {
                        setTorchSupported(true);
                        return;
                    }
                } catch { /* ignore */ }

                // Check 2: Try actually applying torch constraint (some devices don't report capability)
                track.applyConstraints({ advanced: [{ torch: true } as any] })
                    .then(() => {
                        track.applyConstraints({ advanced: [{ torch: false } as any] }).catch(() => { });
                        setTorchSupported(true);
                    })
                    .catch(() => {
                        // Check 3: Try flat constraint syntax as fallback
                        (track.applyConstraints({ torch: true } as any) as Promise<void>)
                            .then(() => {
                                (track.applyConstraints({ torch: false } as any) as Promise<void>).catch(() => { });
                                setTorchSupported(true);
                            })
                            .catch(() => {
                                if (attempts < 10) {
                                    torchCheckTimerRef.current = setTimeout(check, 500);
                                } else {
                                    // Don't set torchSupported(false) — keep it optimistic.
                                    // The nuclear restart in handleToggleTorch can still work.
                                    // We set it as "maybe supported" by leaving the icon dimmed but still clickable.
                                    setTorchSupported(false);
                                }
                            });
                    });
            } else if (attempts < 15) {
                torchCheckTimerRef.current = setTimeout(check, 400);
            }
        };
        // Start checking after short delay for scanner init
        torchCheckTimerRef.current = setTimeout(check, 500);
    }, [getVideoTrack, initImageCapture]);

    const applyTorch = useCallback(async (on: boolean) => {
        // Method 1: Use html5-qrcode's own public API (most reliable — uses internal track reference)
        try {
            const scanner = scannerRef.current as any;
            if (scanner && typeof scanner.applyVideoConstraints === 'function') {
                await scanner.applyVideoConstraints({ advanced: [{ torch: on }] });
                return true;
            }
        } catch { /* try next */ }

        const track = getVideoTrack();
        if (!track || track.readyState !== 'live') return false;
        initImageCapture(track);

        // Method 2: advanced constraint syntax (works on most devices)
        try {
            await track.applyConstraints({ advanced: [{ torch: on } as any] });
            return true;
        } catch { /* try next */ }
        // Method 3: flat constraint syntax
        try {
            await track.applyConstraints({ torch: on } as any);
            return true;
        } catch { /* try next */ }
        // Method 4: re-get track (reference may be stale) and retry
        try {
            const freshTrack = getVideoTrack();
            if (freshTrack && freshTrack !== track && freshTrack.readyState === 'live') {
                initImageCapture(freshTrack);
                await freshTrack.applyConstraints({ advanced: [{ torch: on } as any] });
                return true;
            }
        } catch { /* failed */ }
        return false;
    }, [getVideoTrack, initImageCapture]);

    const setupZoom = useCallback(() => {
        const track = getVideoTrack();
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
    }, [getVideoTrack]);

    const stopScanner = useCallback(async () => {
        if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
        if (torchCheckTimerRef.current) clearTimeout(torchCheckTimerRef.current);
        isPausedRef.current = false;
        setScanPaused(false);
        setLastScannedWSN('');

        // Turn off torch using the scanner's own track
        try { await applyTorch(false); } catch { /* ignore */ }

        // Stop html5-qrcode scanner
        try {
            if (scannerRef.current) {
                const state = scannerRef.current.getState();
                if (state === Html5QrcodeScannerState.SCANNING) {
                    await scannerRef.current.stop();
                }
            }
        } catch { /* ignore */ }

        setScanning(false);
        setTorchOn(false);
        setTorchSupported(false);
        setZoomRange(null);
    }, [applyTorch]);

    const makeScanHandler = useCallback(() => {
        return (decodedText: string) => {
            if (isPausedRef.current) return;

            const now = Date.now();
            const text = decodedText.trim().toUpperCase();
            if (text === lastScanRef.current && now - lastScanTimeRef.current < SAME_BARCODE_COOLDOWN) return;

            lastScanRef.current = text;
            lastScanTimeRef.current = now;

            // Check if duplicate BEFORE pausing (synchronous)
            const resultType = onScanCheckRef.current ? onScanCheckRef.current(text) : 'success';

            isPausedRef.current = true;
            setScanPaused(true);
            setScanResultType(resultType);
            setLastScannedWSN(text);

            if (resultType === 'duplicate') {
                if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
                playErrorBeep();
            } else {
                if (navigator.vibrate) navigator.vibrate(100);
            }

            onScanRef.current(text);

            pauseTimerRef.current = setTimeout(() => {
                isPausedRef.current = false;
                setScanPaused(false);
                setLastScannedWSN('');
            }, SCAN_PAUSE_DURATION);
        };
    }, []);

    const startScanner = useCallback(async (useFrontCamera = false) => {
        setError(null);
        try {
            await stopScanner();
            await new Promise(r => setTimeout(r, 200));

            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode(SCANNER_REGION_ID);
            }

            const facingMode = useFrontCamera ? 'user' : 'environment';
            const scanHandler = makeScanHandler();

            await scannerRef.current.start(
                { facingMode },
                {
                    fps: 12,
                    qrbox: { width: 280, height: 100 },
                    aspectRatio: 1.5,
                    disableFlip: false,
                },
                scanHandler,
                () => { }
            );

            setScanning(true);
            setFacingBack(!useFrontCamera);

            // Setup torch and zoom using html5-qrcode's own video track
            if (!useFrontCamera) {
                checkTorchSupport();
                setTimeout(setupZoom, 1000);
            } else {
                setTimeout(setupZoom, 800);
            }
        } catch (err: any) {
            const msg = err?.message || err?.name || String(err);
            if (msg.includes('NotAllowedError') || msg.includes('Permission') || msg.includes('permission')) {
                setError('Camera permission denied.\n\n• Android Chrome: Tap lock icon → Camera → Allow\n• iPhone Safari: Settings → Safari → Camera → Allow\n\nRefresh page after enabling.');
            } else if (msg.includes('NotFoundError') || msg.includes('Requested device not found')) {
                setError('No camera found on this device.');
            } else if (msg.includes('NotReadableError') || msg.includes('Could not start')) {
                setError('Camera is in use by another app. Close other camera apps and try again.');
            } else if (msg.includes('OverconstrainedError')) {
                try {
                    if (scannerRef.current) {
                        const scanHandler = makeScanHandler();
                        await scannerRef.current.start(
                            { facingMode: 'environment' },
                            { fps: 10, qrbox: { width: 240, height: 90 } },
                            scanHandler,
                            () => { }
                        );
                        setScanning(true);
                        setFacingBack(true);
                        checkTorchSupport();
                        setTimeout(setupZoom, 1000);
                        return;
                    }
                } catch { /* ignore fallback */ }
                setError(`Camera error: ${msg}`);
            } else {
                setError(`Camera error: ${msg}`);
            }
            setScanning(false);
        }
    }, [stopScanner, setupZoom, checkTorchSupport, makeScanHandler]);

    // Handle page visibility change (phone sleep/wake)
    useEffect(() => {
        if (!isOpen) return;
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && isOpen && !scanning) {
                startScanner(!facingBack ? true : false);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, scanning, facingBack]);

    useEffect(() => {
        if (isOpen) {
            startScanner(!facingBack ? true : false);
        } else {
            stopScanner();
        }
        return () => { stopScanner(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Samsung S24 Ultra has 4 back cameras — torch LED is only on the main wide camera.
    // If html5-qrcode selected a camera without torch, find one that has it.
    const tryAlternateCameraWithTorch = useCallback(async (): Promise<boolean> => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(d => d.kind === 'videoinput');
            const currentTrack = getVideoTrack();
            const currentDeviceId = currentTrack?.getSettings?.()?.deviceId;

            for (const device of videoInputs) {
                if (device.deviceId === currentDeviceId) continue;

                // Open a test stream to check torch capability
                let testStream: MediaStream | null = null;
                try {
                    testStream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: { exact: device.deviceId } }
                    });
                    const testTrack = testStream.getVideoTracks()[0];
                    if (!testTrack) { testStream.getTracks().forEach(t => t.stop()); continue; }
                    try { if (typeof ImageCapture !== 'undefined') new ImageCapture(testTrack); } catch { /* ignore */ }
                    const caps = testTrack.getCapabilities?.() as any;
                    testStream.getTracks().forEach(t => t.stop());
                    testStream = null;

                    if (caps?.torch !== true) continue;

                    // This camera has torch! Restart scanner with it
                    try {
                        if (scannerRef.current?.getState?.() === Html5QrcodeScannerState.SCANNING) {
                            await scannerRef.current.stop();
                        }
                    } catch { /* ignore */ }
                    setScanning(false);
                    await new Promise(r => setTimeout(r, 500));

                    if (!scannerRef.current) {
                        scannerRef.current = new Html5Qrcode(SCANNER_REGION_ID);
                    }
                    const scanHandler = makeScanHandler();
                    await scannerRef.current.start(
                        device.deviceId,
                        { fps: 12, qrbox: { width: 280, height: 100 }, aspectRatio: 1.5, disableFlip: false },
                        scanHandler,
                        () => { }
                    );
                    setScanning(true);

                    // Apply torch on this camera
                    for (let i = 0; i < 6; i++) {
                        await new Promise(r => setTimeout(r, 300 + i * 100));
                        const ft = getVideoTrack();
                        if (!ft || ft.readyState !== 'live') continue;
                        try { if (typeof ImageCapture !== 'undefined') new ImageCapture(ft); } catch { /* ignore */ }
                        try {
                            await ft.applyConstraints({ advanced: [{ torch: true } as any] });
                            setTorchOn(true);
                            setTorchSupported(true);
                            setTimeout(setupZoom, 300);
                            return true;
                        } catch { /* continue */ }
                    }
                } catch {
                    if (testStream) testStream.getTracks().forEach(t => t.stop());
                    continue;
                }
            }
        } catch { /* ignore */ }
        return false;
    }, [getVideoTrack, makeScanHandler, setupZoom]);

    const handleToggleTorch = useCallback(async () => {
        const newState = !torchOn;

        // === Attempt 1: Standard applyTorch on current track ===
        let ok = await applyTorch(newState);
        if (ok) { setTorchOn(newState); setTorchSupported(true); return; }

        // === Attempt 2: Re-init ImageCapture + delay + retry ===
        const track = getVideoTrack();
        if (track && track.readyState === 'live') {
            initImageCapture(track);
            await new Promise(r => setTimeout(r, 400));
            ok = await applyTorch(newState);
            if (ok) { setTorchOn(newState); setTorchSupported(true); return; }
        }

        // === Attempt 3: Nuclear restart — stop scanner, restart with explicit deviceId ===
        // Samsung devices often need the camera to be fully re-opened for torch to work
        try {
            const deviceId = track?.getSettings?.()?.deviceId;

            // Stop scanner manually (don't call stopScanner to avoid resetting torch UI state)
            if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
            if (torchCheckTimerRef.current) clearTimeout(torchCheckTimerRef.current);
            isPausedRef.current = false;
            setScanPaused(false);

            try {
                if (scannerRef.current?.getState?.() === Html5QrcodeScannerState.SCANNING) {
                    await scannerRef.current.stop();
                }
            } catch { /* ignore */ }

            setScanning(false);
            await new Promise(r => setTimeout(r, 600)); // Samsung needs time to fully release camera

            // Restart with explicit deviceId (keeps same camera)
            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode(SCANNER_REGION_ID);
            }

            const scanHandler = makeScanHandler();
            const cameraConfig: string | { facingMode: string } = deviceId || { facingMode: 'environment' };

            await scannerRef.current.start(
                cameraConfig,
                { fps: 12, qrbox: { width: 280, height: 100 }, aspectRatio: 1.5, disableFlip: false },
                scanHandler,
                () => { }
            );
            setScanning(true);

            // If turning ON: aggressively apply torch on the fresh track
            if (newState) {
                let torchOk = false;
                for (let i = 0; i < 12 && !torchOk; i++) {
                    await new Promise(r => setTimeout(r, 250 + i * 100));

                    // Try html5-qrcode's own API first
                    try {
                        const s = scannerRef.current as any;
                        if (s && typeof s.applyVideoConstraints === 'function') {
                            await s.applyVideoConstraints({ advanced: [{ torch: true }] });
                            torchOk = true;
                            break;
                        }
                    } catch { /* try track directly */ }

                    const ft = getVideoTrack();
                    if (!ft || ft.readyState !== 'live') continue;
                    try { if (typeof ImageCapture !== 'undefined') new ImageCapture(ft); } catch { /* ignore */ }

                    try {
                        await ft.applyConstraints({ advanced: [{ torch: true } as any] });
                        torchOk = true;
                    } catch {
                        try {
                            await ft.applyConstraints({ torch: true } as any);
                            torchOk = true;
                        } catch { /* continue retrying */ }
                    }
                }

                if (torchOk) {
                    setTorchOn(true);
                    setTorchSupported(true);
                } else {
                    // === Attempt 4: Try alternate back camera (Samsung S24 Ultra has 4 cameras) ===
                    const altOk = await tryAlternateCameraWithTorch();
                    if (!altOk) {
                        setTorchSupported(false);
                    }
                }
            } else {
                // Turning off — fresh scanner won't have torch enabled
                setTorchOn(false);
            }

            setTimeout(setupZoom, 300);
        } catch {
            // Nuclear restart completely failed — restart normally
            try { await startScanner(!facingBack ? true : false); } catch { /* ignore */ }
            setTorchOn(false);
        }
    }, [torchOn, applyTorch, getVideoTrack, initImageCapture, makeScanHandler, setupZoom, facingBack, startScanner, tryAlternateCameraWithTorch]);

    const handleFlipCamera = useCallback(async () => {
        const newFacingBack = !facingBack;
        setFacingBack(newFacingBack);
        await startScanner(!newFacingBack);
    }, [facingBack, startScanner]);

    const handleZoomChange = useCallback((_: Event, val: number | number[]) => {
        const level = val as number;
        setZoomLevel(level);
        const track = getVideoTrack();
        if (track) {
            track.applyConstraints({ advanced: [{ zoom: level } as any] }).catch(() => { });
        }
        localStorage.setItem(ZOOM_STORAGE_KEY, String(level));
    }, [getVideoTrack]);

    const handleRetry = useCallback(() => {
        setError(null);
        startScanner(!facingBack ? true : false);
    }, [facingBack, startScanner]);

    if (!isOpen) return null;

    const isDuplicate = scanResultType === 'duplicate';
    const overlayColor = isDuplicate ? 'rgba(239,68,68' : 'rgba(34,197,94';
    const pillColor = isDuplicate ? 'rgba(239,68,68,0.9)' : 'rgba(34,197,94,0.9)';
    const borderColor = isDuplicate ? '#ef4444 !important' : '#22c55e !important';

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
                    {/* Torch button */}
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

            {/* Camera View */}
            <Box sx={{
                position: 'relative', width: '100%', minHeight: 200, maxHeight: 240, overflow: 'hidden',
                '& video': { width: '100% !important', objectFit: 'cover !important', maxHeight: '240px !important' },
                '& #qr-shaded-region': { borderColor: scanPaused ? borderColor : '#60a5fa !important' },
            }}>
                <div id={SCANNER_REGION_ID} style={{ width: '100%' }} />

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
                                {isDuplicate ? '✗ DUPLICATE' : '✓'} {lastScannedWSN}
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
                        }}>● Ready to scan</Typography>
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
