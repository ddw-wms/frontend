'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Box, IconButton, Typography, Stack, Slider,
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
    const trackRef = useRef<MediaStreamTrack | null>(null);
    const [torchOn, setTorchOn] = useState(false);
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

    const getTrack = useCallback((): MediaStreamTrack | null => {
        try {
            if (trackRef.current && trackRef.current.readyState === 'live') {
                return trackRef.current;
            }
            const video = document.querySelector(`#${SCANNER_REGION_ID} video`) as HTMLVideoElement;
            if (video?.srcObject) {
                const stream = video.srcObject as MediaStream;
                const tracks = stream.getVideoTracks();
                if (tracks.length > 0) {
                    trackRef.current = tracks[0];
                    return tracks[0];
                }
            }
        } catch { /* ignore */ }
        return null;
    }, []);

    const applyZoom = useCallback(async (level: number) => {
        const track = getTrack();
        if (!track) return;
        try {
            const caps = track.getCapabilities?.() as any;
            if (caps?.zoom) {
                const clamped = Math.min(Math.max(level, caps.zoom.min), caps.zoom.max);
                await track.applyConstraints({ advanced: [{ zoom: clamped } as any] });
            }
        } catch { /* zoom not supported */ }
    }, [getTrack]);

    const applyTorch = useCallback(async (on: boolean) => {
        const track = getTrack();
        if (!track) return false;
        try {
            const caps = track.getCapabilities?.() as any;
            if (caps?.torch) {
                await track.applyConstraints({ advanced: [{ torch: on } as any] });
                return true;
            }
        } catch { /* torch not supported */ }
        return false;
    }, [getTrack]);

    const stopScanner = useCallback(async () => {
        try {
            if (scannerRef.current) {
                const state = scannerRef.current.getState();
                if (state === Html5QrcodeScannerState.SCANNING) {
                    await scannerRef.current.stop();
                }
            }
        } catch { /* ignore */ }
        trackRef.current = null;
        setScanning(false);
        setTorchOn(false);
        setZoomRange(null);
    }, []);

    const startScanner = useCallback(async (useFrontCamera = false) => {
        setError(null);
        try {
            await stopScanner();
            await new Promise(r => setTimeout(r, 250));

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

            // Setup zoom after camera starts
            setTimeout(() => {
                const track = getTrack();
                if (track) {
                    const caps = track.getCapabilities?.() as any;
                    if (caps?.zoom) {
                        setZoomRange({ min: caps.zoom.min, max: caps.zoom.max });
                        const saved = localStorage.getItem(ZOOM_STORAGE_KEY);
                        const level = saved ? parseFloat(saved) : 1;
                        setZoomLevel(level);
                        applyZoom(level);
                    }
                }
            }, 500);
        } catch (err: any) {
            const msg = err?.message || String(err);
            if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
                setError('Camera permission denied. Allow camera in browser settings.');
            } else if (msg.includes('NotFoundError')) {
                setError('No camera found on this device.');
            } else {
                setError(`Camera error: ${msg}`);
            }
            setScanning(false);
        }
    }, [onScan, stopScanner, getTrack, applyZoom]);

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
        if (ok) setTorchOn(newState);
    }, [torchOn, applyTorch]);

    const handleFlipCamera = useCallback(async () => {
        const newFacingBack = !facingBack;
        setFacingBack(newFacingBack);
        await startScanner(!newFacingBack);
    }, [facingBack, startScanner]);

    const handleZoomChange = useCallback((_: Event, val: number | number[]) => {
        const level = val as number;
        setZoomLevel(level);
        applyZoom(level);
        localStorage.setItem(ZOOM_STORAGE_KEY, String(level));
    }, [applyZoom]);

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
                        color: torchOn ? '#fbbf24' : '#64748b', width: 30, height: 30,
                        bgcolor: torchOn ? 'rgba(251,191,36,0.2)' : 'transparent',
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
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: 'rgba(0,0,0,0.85)', p: 2, zIndex: 3,
                    }}>
                        <Typography sx={{ color: '#f87171', fontSize: '0.78rem', textAlign: 'center' }}>{error}</Typography>
                    </Box>
                )}
                {scanning && (
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
