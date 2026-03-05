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

export default function CameraScanner({ onScan, onClose, isOpen, title = 'Scan Barcode' }: CameraScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const [facingBack, setFacingBack] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
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

    // Get the active video track directly from the stream we captured
    const getTrack = useCallback((): MediaStreamTrack | null => {
        try {
            // Method 1: From our saved stream ref
            if (streamRef.current) {
                const tracks = streamRef.current.getVideoTracks();
                if (tracks.length > 0 && tracks[0].readyState === 'live') return tracks[0];
            }
            // Method 2: From the video element in DOM
            const video = document.querySelector(`#${SCANNER_REGION_ID} video`) as HTMLVideoElement;
            if (video?.srcObject) {
                const stream = video.srcObject as MediaStream;
                streamRef.current = stream;
                const tracks = stream.getVideoTracks();
                if (tracks.length > 0 && tracks[0].readyState === 'live') return tracks[0];
            }
        } catch { /* ignore */ }
        return null;
    }, []);

    // Setup track capabilities (torch, zoom) after camera starts
    const setupTrackCapabilities = useCallback(() => {
        const track = getTrack();
        if (!track) return;
        try {
            const caps = track.getCapabilities?.() as any;
            // Torch
            if (caps?.torch) {
                setTorchSupported(true);
            }
            // Zoom
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

    const applyTorch = useCallback(async (on: boolean) => {
        const track = getTrack();
        if (!track) return false;
        try {
            // Use ImageCapture API as primary method (works on more devices)
            if (typeof ImageCapture !== 'undefined') {
                try {
                    const imgCapture = new ImageCapture(track);
                    const photoCapabilities = await imgCapture.getPhotoCapabilities?.().catch(() => null);
                    // fillLightMode check
                    if (photoCapabilities?.fillLightMode?.includes('flash')) {
                        await (imgCapture as any).setOptions({ fillLightMode: on ? 'flash' : 'off' }).catch(() => { });
                    }
                } catch { /* ImageCapture failed, fall through */ }
            }

            // Primary method: applyConstraints with torch
            const caps = track.getCapabilities?.() as any;
            if (caps?.torch) {
                await track.applyConstraints({ advanced: [{ torch: on } as any] });
                return true;
            }

            // Fallback: try setting torch via getSettings
            const settings = track.getSettings?.() as any;
            if (settings && 'torch' in settings) {
                await track.applyConstraints({ advanced: [{ torch: on } as any] });
                return true;
            }
        } catch { /* torch not supported */ }
        return false;
    }, [getTrack]);

    const stopScanner = useCallback(async () => {
        // Turn off torch before stopping
        if (torchOn) {
            try {
                const track = getTrack();
                if (track) {
                    await track.applyConstraints({ advanced: [{ torch: false } as any] }).catch(() => { });
                }
            } catch { /* ignore */ }
        }
        try {
            if (scannerRef.current) {
                const state = scannerRef.current.getState();
                if (state === Html5QrcodeScannerState.SCANNING) {
                    await scannerRef.current.stop();
                }
            }
        } catch { /* ignore */ }
        streamRef.current = null;
        setScanning(false);
        setTorchOn(false);
        setTorchSupported(false);
        setZoomRange(null);
    }, [getTrack, torchOn]);

    const requestCameraPermission = useCallback(async (): Promise<boolean> => {
        try {
            // First try to get a stream to trigger browser permission prompt
            const testStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            // Permission granted, stop test stream
            testStream.getTracks().forEach(t => t.stop());
            return true;
        } catch (err: any) {
            const msg = err?.name || err?.message || '';
            if (msg === 'NotAllowedError' || msg.includes('Permission')) {
                return false;
            }
            // Other errors (NotFoundError etc.) — permission might be OK, camera issue
            return true;
        }
    }, []);

    const startScanner = useCallback(async (useFrontCamera = false) => {
        setError(null);
        try {
            await stopScanner();
            await new Promise(r => setTimeout(r, 300));

            // Pre-check camera permission
            const hasPermission = await requestCameraPermission();
            if (!hasPermission) {
                setError('Camera permission denied.\n\n• Android Chrome: Settings → Site Settings → Camera → Allow\n• iPhone Safari: Settings → Safari → Camera → Allow\n• Other browsers: Tap the lock/info icon in the address bar → Camera → Allow\n\nThen reload this page.');
                setScanning(false);
                return;
            }

            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode(SCANNER_REGION_ID);
            }

            await scannerRef.current.start(
                { facingMode: useFrontCamera ? 'user' : 'environment' },
                {
                    fps: 15,
                    qrbox: { width: 220, height: 80 },
                    aspectRatio: 1.5,
                    disableFlip: false,
                },
                (decodedText) => {
                    const now = Date.now();
                    if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 1500) return;
                    lastScanRef.current = decodedText;
                    lastScanTimeRef.current = now;
                    if (navigator.vibrate) navigator.vibrate(100);
                    onScan(decodedText.trim().toUpperCase());
                },
                () => { }
            );

            setScanning(true);
            setFacingBack(!useFrontCamera);

            // Grab the stream and setup capabilities with retry
            const trySetup = (attempt: number) => {
                setTimeout(() => {
                    const track = getTrack();
                    if (track) {
                        setupTrackCapabilities();
                    } else if (attempt < 5) {
                        trySetup(attempt + 1);
                    }
                }, attempt === 0 ? 500 : 800);
            };
            trySetup(0);
        } catch (err: any) {
            const msg = err?.message || err?.name || String(err);
            if (msg.includes('NotAllowedError') || msg.includes('Permission') || msg.includes('permission')) {
                setError('Camera permission denied.\n\n• Android Chrome: Settings → Site Settings → Camera → Allow\n• iPhone Safari: Settings → Safari → Camera → Allow\n• Other browsers: Tap the lock/info icon in the address bar → Camera → Allow\n\nThen reload this page.');
            } else if (msg.includes('NotFoundError') || msg.includes('Requested device not found')) {
                setError('No camera found on this device.');
            } else if (msg.includes('NotReadableError') || msg.includes('Could not start')) {
                setError('Camera is in use by another app. Close other camera apps and try again.');
            } else if (msg.includes('OverconstrainedError')) {
                // Try again without specific facing mode
                try {
                    if (scannerRef.current) {
                        await scannerRef.current.start(
                            { facingMode: 'environment' },
                            { fps: 10, qrbox: { width: 200, height: 80 } },
                            (decodedText) => {
                                const now = Date.now();
                                if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 1500) return;
                                lastScanRef.current = decodedText;
                                lastScanTimeRef.current = now;
                                if (navigator.vibrate) navigator.vibrate(100);
                                onScan(decodedText.trim().toUpperCase());
                            },
                            () => { }
                        );
                        setScanning(true);
                        setFacingBack(true);
                        setTimeout(() => setupTrackCapabilities(), 800);
                        return;
                    }
                } catch { /* ignore fallback */ }
                setError(`Camera error: ${msg}`);
            } else {
                setError(`Camera error: ${msg}`);
            }
            setScanning(false);
        }
    }, [onScan, stopScanner, getTrack, setupTrackCapabilities, requestCameraPermission]);

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
            // If torch toggle failed, try re-acquiring the track and retrying
            const track = getTrack();
            if (track) {
                try {
                    await track.applyConstraints({ advanced: [{ torch: newState } as any] });
                    setTorchOn(newState);
                } catch {
                    // Truly not supported
                }
            }
        }
    }, [torchOn, applyTorch, getTrack]);

    const handleFlipCamera = useCallback(async () => {
        const newFacingBack = !facingBack;
        setFacingBack(newFacingBack);
        await startScanner(!newFacingBack);
    }, [facingBack, startScanner]);

    const handleZoomChange = useCallback((_: Event, val: number | number[]) => {
        const level = val as number;
        setZoomLevel(level);
        const track = getTrack();
        if (track) {
            track.applyConstraints({ advanced: [{ zoom: level } as any] }).catch(() => { });
        }
        localStorage.setItem(ZOOM_STORAGE_KEY, String(level));
    }, [getTrack]);

    const handleRetry = useCallback(() => {
        setError(null);
        startScanner(!facingBack ? true : false);
    }, [facingBack, startScanner]);

    if (!isOpen) return null;

    return (
        <Box sx={{ position: 'relative', width: '100%', bgcolor: '#000', borderRadius: 1.5, overflow: 'hidden' }}>
            {/* Header */}
            <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                px: 1, py: 0.5, bgcolor: 'rgba(0,0,0,0.8)', zIndex: 2,
            }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}>
                    {title}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <IconButton size="small" onClick={handleToggleTorch} sx={{
                        color: torchOn ? '#fbbf24' : (torchSupported ? '#94a3b8' : '#374151'),
                        width: 30, height: 30,
                        bgcolor: torchOn ? 'rgba(251,191,36,0.25)' : 'transparent',
                    }}>
                        {torchOn ? <FlashOnIcon sx={{ fontSize: 16 }} /> : <FlashOffIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                    {zoomRange && (
                        <IconButton size="small" onClick={() => setShowZoom(!showZoom)} sx={{
                            color: showZoom ? '#60a5fa' : '#64748b', width: 30, height: 30,
                            bgcolor: showZoom ? 'rgba(96,165,250,0.2)' : 'transparent',
                        }}>
                            <ZoomInIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    )}
                    <IconButton size="small" onClick={handleFlipCamera} sx={{ color: '#64748b', width: 30, height: 30 }}>
                        {facingBack ? <CameraFrontIcon sx={{ fontSize: 16 }} /> : <CameraRearIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                    <IconButton size="small" onClick={onClose} sx={{ color: '#fff', width: 30, height: 30 }}>
                        <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Stack>
            </Box>

            {/* Camera View — compact */}
            <Box sx={{
                position: 'relative', width: '100%', maxHeight: 180, overflow: 'hidden',
                '& video': { width: '100% !important', objectFit: 'cover !important', maxHeight: '180px !important' },
                '& #qr-shaded-region': { borderColor: '#22c55e !important' },
            }}>
                <div id={SCANNER_REGION_ID} style={{ width: '100%' }} />
                {error && (
                    <Box sx={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        bgcolor: 'rgba(0,0,0,0.92)', p: 2, zIndex: 3,
                    }}>
                        <Typography sx={{
                            color: '#f87171', fontSize: '0.72rem', textAlign: 'center',
                            whiteSpace: 'pre-line', lineHeight: 1.5,
                        }}>{error}</Typography>
                        <Button
                            size="small" variant="outlined"
                            onClick={handleRetry}
                            sx={{
                                mt: 1, color: '#60a5fa', borderColor: '#60a5fa',
                                fontSize: '0.7rem', textTransform: 'none', fontWeight: 700,
                            }}
                        >
                            Retry Camera
                        </Button>
                    </Box>
                )}
                {scanning && !error && (
                    <Box sx={{
                        position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
                        px: 1, py: 0.2, borderRadius: 1, bgcolor: 'rgba(34,197,94,0.25)',
                    }}>
                        <Typography sx={{
                            color: '#22c55e', fontSize: '0.6rem', fontWeight: 700,
                            animation: 'pulse 1.5s infinite',
                            '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
                        }}>● Scanning</Typography>
                    </Box>
                )}
            </Box>

            {/* Zoom Slider */}
            {showZoom && zoomRange && (
                <Box sx={{ px: 2, py: 0.5, bgcolor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.65rem', minWidth: 14 }}>1x</Typography>
                    <Slider
                        value={zoomLevel}
                        min={zoomRange.min}
                        max={zoomRange.max}
                        step={0.1}
                        onChange={handleZoomChange}
                        size="small"
                        sx={{
                            color: '#60a5fa', height: 3,
                            '& .MuiSlider-thumb': { width: 14, height: 14 },
                        }}
                    />
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.65rem', minWidth: 22 }}>
                        {zoomLevel.toFixed(1)}x
                    </Typography>
                </Box>
            )}
        </Box>
    );
}
