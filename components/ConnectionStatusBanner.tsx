// File Path = warehouse-frontend/components/ConnectionStatusBanner.tsx
'use client';

import React from 'react';
import { Box, Typography, Button, LinearProgress, Collapse, IconButton } from '@mui/material';
import {
    CloudOff as OfflineIcon,
    WifiOff as NoWifiIcon,
    Refresh as RefreshIcon,
    Close as CloseIcon,
    CloudQueue as ConnectingIcon,
} from '@mui/icons-material';
import { useConnectionStatus } from '@/app/context/ConnectionContext';

interface ConnectionStatusBannerProps {
    variant?: 'fixed' | 'inline';
    onDismiss?: () => void;
}

export function ConnectionStatusBanner({ variant = 'fixed', onDismiss }: ConnectionStatusBannerProps) {
    const { shouldShowBanner, message, status, isOnline, retry, isHealthy } = useConnectionStatus();
    const [dismissed, setDismissed] = React.useState(false);

    // Reset dismissed state when connection is restored
    React.useEffect(() => {
        if (isHealthy) {
            setDismissed(false);
        }
    }, [isHealthy]);

    const handleDismiss = () => {
        setDismissed(true);
        onDismiss?.();
    };

    const handleRetry = async () => {
        setDismissed(false);
        await retry();
    };

    const showBanner = shouldShowBanner && !dismissed;

    const getIcon = () => {
        if (!isOnline) return <NoWifiIcon sx={{ mr: 1.5, fontSize: 20 }} />;
        if (status === 'reconnecting' || status === 'connecting') {
            return <ConnectingIcon sx={{ mr: 1.5, fontSize: 20, animation: 'pulse 1.5s infinite' }} />;
        }
        return <OfflineIcon sx={{ mr: 1.5, fontSize: 20 }} />;
    };

    const getBgColor = () => {
        if (!isOnline) return '#f44336'; // Red for no internet
        if (status === 'reconnecting' || status === 'connecting') return '#ff9800'; // Orange for reconnecting
        return '#e53935'; // Dark red for error
    };

    const content = (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 1,
                px: 2,
                py: 1,
                bgcolor: getBgColor(),
                color: 'white',
            }}
        >
            {getIcon()}
            <Typography variant="body2" sx={{ fontWeight: 500, flex: 1, minWidth: 200 }}>
                {message}
            </Typography>

            {status !== 'reconnecting' && status !== 'connecting' && (
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRetry}
                    sx={{
                        color: 'white',
                        borderColor: 'rgba(255,255,255,0.5)',
                        '&:hover': {
                            borderColor: 'white',
                            bgcolor: 'rgba(255,255,255,0.1)',
                        },
                    }}
                >
                    Retry
                </Button>
            )}

            {(status === 'reconnecting' || status === 'connecting') && (
                <Box sx={{ width: 100, ml: 2 }}>
                    <LinearProgress
                        sx={{
                            bgcolor: 'rgba(255,255,255,0.3)',
                            '& .MuiLinearProgress-bar': {
                                bgcolor: 'white',
                            },
                        }}
                    />
                </Box>
            )}

            <IconButton
                size="small"
                onClick={handleDismiss}
                sx={{
                    color: 'rgba(255,255,255,0.7)',
                    '&:hover': { color: 'white' },
                    ml: 1,
                }}
            >
                <CloseIcon fontSize="small" />
            </IconButton>
        </Box>
    );

    if (variant === 'fixed') {
        return (
            <Collapse in={showBanner}>
                <Box
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 9999,
                        '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.6 },
                        },
                    }}
                >
                    {content}
                </Box>
            </Collapse>
        );
    }

    return <Collapse in={showBanner}>{content}</Collapse>;
}

export default ConnectionStatusBanner;
