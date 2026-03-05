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
    onClose: () => void;
    isOpen: boolean;
    title?: string;
}

const SCANNER_REGION_ID = 'mobile-camera-scanner-region';
const ZOOM_STORAGE_KEY = 'mobileScan_cameraZoom';
const SAME_BARCODE_COOLDOWN = 3000; // 3 seconds before accepting same barcode again
const SCAN_PAUSE_DURATION = 1200; // 1.2 second pause after successful scan

export default function CameraScanner({ onScan, onClose, isOpen, title = 'Scan Barcode' }: CameraScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    // We keep our OWN MediaStream reference for torch control
    const ownStreamRef = useRef<MediaStream | null>(null);
    const torchTrackRef = useRef<MediaStreamTrack | null>(null);
    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const [facingBack, setFacingBack] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const [scanPaused, setScanPaused] = useState(false);
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

    // Get the video track from html5-qrcode's video element (for zoom)
    const getVideoTrack = useCallback((): MediaStreamTrack | null => {
        try {
            const video = document.querySelector(`#${SCANNER_REGION_ID} video`) as HTMLVideoElement;
            if (video?.srcObject) {
                const stream = video.srcObject as MediaStream;
                const tracks = stream.getVideoTracks();
                if (tracks.length > 0 && tracks[0].readyState === 'live') return tracks[0];
            }
        } catch { /* ignore */ }
        return null;
    }, []);

    // Acquire our own camera stream JUST for torch control
    const acquireTorchStream = useCallback(async (deviceId?: string) => {
        // Release any previous stream
        if (ownStreamRef.current) {
            ownStreamRef.current.getTracks().forEach(t => t.stop());
            ownStreamRef.current = null;
            torchTrackRef.current = null;
        }
        try {
            const constraints: MediaStreamConstraints = {
                video: deviceId
                    ? { deviceId: { exact: deviceId } }
                    : { facingMode: 'environment' },
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            ownStreamRef.current = stream;
            const track = stream.getVideoTracks()[0];
            torchTrackRef.current = track;

            // Check torch capability
            const caps = track.getCapabilities?.() as any;
            if (caps?.torch === true) {
                setTorchSupported(true);
                return true;
            } else {
                // Try to set torch anyway — some devices don't report capability
                try {
                    await track.applyConstraints({ advanced: [{ torch: true } as any] });
                    await track.applyConstraints({ advanced: [{ torch: false } as any] });
                    setTorchSupported(true);
                    return true;
                } catch {
                    // Torch really not supported
                    setTorchSupported(false);
                    // Stop this stream since we don't need it
                    stream.getTracks().forEach(t => t.stop());
                    ownStreamRef.current = null;
                    torchTrackRef.current = null;
                    return false;
                }
            }
        } catch {
            setTorchSupported(false);
            return false;
        }
    }, []);

    const applyTorch = useCallback(async (on: boolean) => {
        const track = torchTrackRef.current;
        if (!track || track.readyState !== 'live') return false;
        try {
            await track.applyConstraints({ advanced: [{ torch: on } as any] });
            return true;
        } catch {
            try {
                await track.applyConstraints({ torch: on } as any);
                return true;
            } catch { return false; }
        }
    }, []);

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
        // Clear pause
        if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
        isPausedRef.current = false;
        setScanPaused(false);
        setLastScannedWSN('');

        // Turn off torch via our own stream
        if (torchTrackRef.current && torchTrackRef.current.readyState === 'live') {
            try {
                await torchTrackRef.current.applyConstraints({ advanced: [{ torch: false } as any] });
            } catch { /* ignore */ }
        }

        // Stop html5-qrcode scanner
        try {
            if (scannerRef.current) {
                const state = scannerRef.current.getState();
                if (state === Html5QrcodeScannerState.SCANNING) {
                    await scannerRef.current.stop();
                }
            }
        } catch { /* ignore */ }

        // Stop our torch stream
        if (ownStreamRef.current) {
            ownStreamRef.current.getTracks().forEach(t => t.stop());
            ownStreamRef.current = null;
            torchTrackRef.current = null;
        }

        setScanning(false);
        setTorchOn(false);
        setTorchSupported(false);
        setZoomRange(null);
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

            await scannerRef.current.start(
                { facingMode },
                {
                    fps: 12,
                    qrbox: { width: 280, height: 100 },
                    aspectRatio: 1.5,
                    disableFlip: false,
                },
                (decodedText) => {
                    // Check if paused
                    if (isPausedRef.current) return;

                    const now = Date.now();
                    const text = decodedText.trim().toUpperCase();
                    // Same barcode cooldown
                    if (text === lastScanRef.current && now - lastScanTimeRef.current < SAME_BARCODE_COOLDOWN) return;

                    lastScanRef.current = text;
                    lastScanTimeRef.current = now;

                    // Pause scanning briefly
                    isPausedRef.current = true;
                    setScanPaused(true);
                    setLastScannedWSN(text);
                    if (navigator.vibrate) navigator.vibrate(100);

                    onScan(text);

                    // Resume after pause duration
                    pauseTimerRef.current = setTimeout(() => {
                        isPausedRef.current = false;
                        setScanPaused(false);
                        setLastScannedWSN('');
                    }, SCAN_PAUSE_DURATION);
                },
                () => { }
            );

            setScanning(true);
            setFacingBack(!useFrontCamera);

            // After scanner starts, get the camera deviceId and acquire torch stream
            if (!useFrontCamera) {
                setTimeout(async () => {
                    const track = getVideoTrack();
                    if (track) {
                        const settings = track.getSettings?.();
                        const deviceId = settings?.deviceId;
                        // Acquire our own stream for the same camera for torch control
                        await acquireTorchStream(deviceId);
                    } else {
                        // No track yet, retry
                        setTimeout(async () => {
                            const t2 = getVideoTrack();
                            if (t2) {
                                const s2 = t2.getSettings?.();
                                await acquireTorchStream(s2?.deviceId);
                            }
                        }, 1000);
                    }
                    setupZoom();
                }, 800);
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
                        await scannerRef.current.start(
                            { facingMode: 'environment' },
                            { fps: 10, qrbox: { width: 240, height: 90 } },
                            (decodedText) => {
                                if (isPausedRef.current) return;
                                const now = Date.now();
                                const text = decodedText.trim().toUpperCase();
                                if (text === lastScanRef.current && now - lastScanTimeRef.current < SAME_BARCODE_COOLDOWN) return;
                                lastScanRef.current = text;
                                lastScanTimeRef.current = now;
                                isPausedRef.current = true;
                                setScanPaused(true);
                                setLastScannedWSN(text);
                                if (navigator.vibrate) navigator.vibrate(100);
                                onScan(text);
                                pauseTimerRef.current = setTimeout(() => {
                                    isPausedRef.current = false;
                                    setScanPaused(false);
                                    setLastScannedWSN('');
                                }, SCAN_PAUSE_DURATION);
                            },
                            () => { }
                        );
                        setScanning(true);
                        setFacingBack(true);
                        setTimeout(async () => {
                            const t = getVideoTrack();
                            if (t) await acquireTorchStream(t.getSettings?.()?.deviceId);
                            setupZoom();
                        }, 800);
                        return;
                    }
                } catch { /* ignore fallback */ }
                setError(`Camera error: ${msg}`);
            } else {
                setError(`Camera error: ${msg}`);
            }
            setScanning(false);
        }
    }, [onScan, stopScanner, getVideoTrack, setupZoom, acquireTorchStream]);

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

    const handleToggleTorch = useCallback(async () => {
        const newState = !torchOn;
        const ok = await applyTorch(newState);
        if (ok) {
            setTorchOn(newState);
        } else {
            // Maybe our torch stream died, try re-acquiring
            const track = getVideoTrack();
            if (track) {
                const ok2 = await acquireTorchStream(track.getSettings?.()?.deviceId);
                if (ok2) {
                    const ok3 = await applyTorch(newState);
                    if (ok3) { setTorchOn(newState); return; }
                }
            }
            setTorchSupported(false);
        }
    }, [torchOn, applyTorch, getVideoTrack, acquireTorchStream]);

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
                    {/* Torch button — large & prominent */}
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
                '& #qr-shaded-region': { borderColor: scanPaused ? '#22c55e !important' : '#60a5fa !important' },
            }}>
                <div id={SCANNER_REGION_ID} style={{ width: '100%' }} />

                {/* Scan success flash overlay */}
                {scanPaused && (
                    <Box sx={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        bgcolor: 'rgba(34,197,94,0.2)', zIndex: 3,
                        animation: 'flashIn 0.15s ease-out',
                        '@keyframes flashIn': { '0%': { bgcolor: 'rgba(34,197,94,0.5)' }, '100%': { bgcolor: 'rgba(34,197,94,0.15)' } },
                    }}>
                        <Box sx={{
                            px: 2, py: 0.8, borderRadius: 2,
                            bgcolor: 'rgba(34,197,94,0.9)', backdropFilter: 'blur(4px)',
                        }}>
                            <Typography sx={{
                                color: '#fff', fontWeight: 800, fontSize: '0.85rem',
                                fontFamily: 'monospace', textAlign: 'center',
                            }}>
                                ✓ {lastScannedWSN}
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
