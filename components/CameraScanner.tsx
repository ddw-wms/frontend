'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Box, IconButton, Typography, Chip, Stack, Fade
} from '@mui/material';
import {
    Close as CloseIcon,
    FlashlightOn as FlashOnIcon,
    FlashlightOff as FlashOffIcon,
    CameraRear as CameraRearIcon,
    CameraFront as CameraFrontIcon,
} from '@mui/icons-material';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

interface CameraScannerProps {
    /** Called when a barcode/QR is successfully decoded */
    onScan: (decodedText: string) => void;
    /** Called when user closes the scanner */
    onClose: () => void;
    /** Whether scanner is active */
    isOpen: boolean;
    /** Optional: label shown above the scanner */
    title?: string;
}

const SCANNER_REGION_ID = 'mobile-camera-scanner-region';

export default function CameraScanner({ onScan, onClose, isOpen, title = 'Scan WSN Barcode' }: CameraScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [torchOn, setTorchOn] = useState(false);
    const [facingBack, setFacingBack] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const lastScanRef = useRef<string>('');
    const lastScanTimeRef = useRef<number>(0);

    const stopScanner = useCallback(async () => {
        try {
            if (scannerRef.current) {
                const state = scannerRef.current.getState();
                if (state === Html5QrcodeScannerState.SCANNING) {
                    await scannerRef.current.stop();
                }
            }
        } catch {
            // ignore stop errors
        }
        setScanning(false);
        setTorchOn(false);
    }, []);

    const startScanner = useCallback(async (useFrontCamera = false) => {
        setError(null);
        try {
            // Stop existing scanner if running
            await stopScanner();

            // Small delay to let DOM settle
            await new Promise(r => setTimeout(r, 200));

            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode(SCANNER_REGION_ID);
            }

            const facingMode = useFrontCamera ? 'user' : 'environment';

            await scannerRef.current.start(
                { facingMode },
                {
                    fps: 15,
                    qrbox: { width: 280, height: 120 },
                    aspectRatio: 1.0,
                    disableFlip: false,
                },
                (decodedText) => {
                    // Deduplicate rapid scans of same barcode (1.5s cooldown)
                    const now = Date.now();
                    if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 1500) {
                        return;
                    }
                    lastScanRef.current = decodedText;
                    lastScanTimeRef.current = now;

                    // Vibration feedback
                    if (navigator.vibrate) {
                        navigator.vibrate(100);
                    }

                    onScan(decodedText.trim().toUpperCase());
                },
                () => {
                    // QR code not found in frame — ignore
                }
            );

            setScanning(true);
            setFacingBack(!useFrontCamera);
        } catch (err: any) {
            const msg = err?.message || String(err);
            if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
                setError('Camera permission denied. Please allow camera access in browser settings.');
            } else if (msg.includes('NotFoundError')) {
                setError('No camera found on this device.');
            } else {
                setError(`Camera error: ${msg}`);
            }
            setScanning(false);
        }
    }, [onScan, stopScanner]);

    // Start/stop on isOpen change
    useEffect(() => {
        if (isOpen) {
            startScanner(!facingBack ? true : false);
        } else {
            stopScanner();
        }

        return () => {
            stopScanner();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Toggle torch
    const handleToggleTorch = useCallback(async () => {
        try {
            if (scannerRef.current && scanning) {
                const newState = !torchOn;
                await scannerRef.current.applyVideoConstraints({
                    // @ts-ignore - torch is valid but not in TS types
                    advanced: [{ torch: newState }]
                });
                setTorchOn(newState);
            }
        } catch {
            // Torch not supported on this device
        }
    }, [scanning, torchOn]);

    // Flip camera
    const handleFlipCamera = useCallback(async () => {
        const newFacingBack = !facingBack;
        setFacingBack(newFacingBack);
        await startScanner(!newFacingBack);
    }, [facingBack, startScanner]);

    if (!isOpen) return null;

    return (
        <Fade in={isOpen}>
            <Box
                sx={{
                    position: 'relative',
                    width: '100%',
                    bgcolor: '#000',
                    borderRadius: 2,
                    overflow: 'hidden',
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 1.5,
                        py: 1,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        position: 'relative',
                        zIndex: 2,
                    }}
                >
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
                        {title}
                    </Typography>
                    <IconButton size="small" onClick={onClose} sx={{ color: '#fff' }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>

                {/* Camera View */}
                <Box
                    sx={{
                        position: 'relative',
                        width: '100%',
                        minHeight: 260,
                        '& video': {
                            width: '100% !important',
                            objectFit: 'cover !important',
                            borderRadius: 0,
                        },
                        '& #qr-shaded-region': {
                            borderColor: '#22c55e !important',
                        },
                    }}
                >
                    <div id={SCANNER_REGION_ID} style={{ width: '100%' }} />

                    {/* Error overlay */}
                    {error && (
                        <Box
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'rgba(0,0,0,0.8)',
                                p: 3,
                                zIndex: 3,
                            }}
                        >
                            <Typography sx={{ color: '#f87171', fontSize: '0.85rem', textAlign: 'center' }}>
                                {error}
                            </Typography>
                        </Box>
                    )}
                </Box>

                {/* Controls */}
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                        justifyContent: 'center',
                        py: 1,
                        bgcolor: 'rgba(0,0,0,0.7)',
                    }}
                >
                    <IconButton
                        size="small"
                        onClick={handleToggleTorch}
                        sx={{
                            color: torchOn ? '#fbbf24' : '#94a3b8',
                            bgcolor: torchOn ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.1)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                            width: 40,
                            height: 40,
                        }}
                    >
                        {torchOn ? <FlashOnIcon fontSize="small" /> : <FlashOffIcon fontSize="small" />}
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={handleFlipCamera}
                        sx={{
                            color: '#94a3b8',
                            bgcolor: 'rgba(255,255,255,0.1)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                            width: 40,
                            height: 40,
                        }}
                    >
                        {facingBack ? <CameraFrontIcon fontSize="small" /> : <CameraRearIcon fontSize="small" />}
                    </IconButton>
                </Stack>

                {/* Scanning indicator */}
                {scanning && (
                    <Chip
                        label="Scanning..."
                        size="small"
                        sx={{
                            position: 'absolute',
                            bottom: 56,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            bgcolor: 'rgba(34,197,94,0.2)',
                            color: '#22c55e',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            animation: 'pulse 1.5s infinite',
                            '@keyframes pulse': {
                                '0%,100%': { opacity: 1 },
                                '50%': { opacity: 0.5 },
                            },
                        }}
                    />
                )}
            </Box>
        </Fade>
    );
}
