// File Path = warehouse-frontend/components/ApiErrorState.tsx
'use client';

import React from 'react';
import { Box, Typography, Button, Paper, CircularProgress, Alert, AlertTitle } from '@mui/material';
import {
    ErrorOutline as ErrorIcon,
    Refresh as RefreshIcon,
    WifiOff as NetworkErrorIcon,
    CloudOff as ServerErrorIcon,
    AccessTime as TimeoutIcon,
} from '@mui/icons-material';
import { ApiErrorDetails, parseApiError } from '@/lib/api';

interface ApiErrorStateProps {
    error: any;
    onRetry?: () => void;
    isRetrying?: boolean;
    title?: string;
    compact?: boolean;
    inline?: boolean;
}

/**
 * ApiErrorState - A user-friendly error display component
 * 
 * Displays appropriate error messages based on error type:
 * - Network errors: Shows "Check your internet connection"
 * - Server errors: Shows "Server is temporarily unavailable"
 * - Timeout errors: Shows "Request took too long"
 * - Other errors: Shows the actual error message
 */
export function ApiErrorState({
    error,
    onRetry,
    isRetrying = false,
    title,
    compact = false,
    inline = false,
}: ApiErrorStateProps) {
    const parsedError: ApiErrorDetails = error?.parsedError || parseApiError(error);

    const getIcon = () => {
        if (parsedError.isNetworkError) {
            return <NetworkErrorIcon sx={{ fontSize: compact ? 40 : 64, color: 'warning.main' }} />;
        }
        if (parsedError.isTimeout) {
            return <TimeoutIcon sx={{ fontSize: compact ? 40 : 64, color: 'warning.main' }} />;
        }
        if (parsedError.isServerError) {
            return <ServerErrorIcon sx={{ fontSize: compact ? 40 : 64, color: 'error.main' }} />;
        }
        return <ErrorIcon sx={{ fontSize: compact ? 40 : 64, color: 'error.main' }} />;
    };

    const getTitle = () => {
        if (title) return title;
        if (parsedError.isNetworkError) return 'Connection Problem';
        if (parsedError.isTimeout) return 'Request Timeout';
        if (parsedError.isServerError) return 'Server Unavailable';
        return 'Something Went Wrong';
    };

    const getSeverity = (): 'error' | 'warning' | 'info' => {
        if (parsedError.isNetworkError || parsedError.isTimeout) return 'warning';
        if (parsedError.isServerError && parsedError.statusCode === 503) return 'warning';
        return 'error';
    };

    // Inline variant - simple alert style
    if (inline) {
        return (
            <Alert
                severity={getSeverity()}
                action={
                    onRetry && parsedError.isRetryable ? (
                        <Button
                            color="inherit"
                            size="small"
                            onClick={onRetry}
                            disabled={isRetrying}
                            startIcon={isRetrying ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />}
                        >
                            {isRetrying ? 'Retrying...' : 'Retry'}
                        </Button>
                    ) : undefined
                }
                sx={{ mb: 2 }}
            >
                <AlertTitle>{getTitle()}</AlertTitle>
                {parsedError.userMessage}
            </Alert>
        );
    }

    // Compact variant
    if (compact) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 3,
                    px: 2,
                    textAlign: 'center',
                }}
            >
                {getIcon()}
                <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 1.5, mb: 0.5 }}>
                    {getTitle()}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 300 }}>
                    {parsedError.userMessage}
                </Typography>
                {onRetry && parsedError.isRetryable && (
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={isRetrying ? <CircularProgress size={16} /> : <RefreshIcon />}
                        onClick={onRetry}
                        disabled={isRetrying}
                    >
                        {isRetrying ? 'Retrying...' : 'Try Again'}
                    </Button>
                )}
            </Box>
        );
    }

    // Full variant
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 300,
                p: 3,
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    p: 4,
                    textAlign: 'center',
                    maxWidth: 450,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                }}
            >
                {getIcon()}
                <Typography variant="h5" gutterBottom sx={{ mt: 2 }}>
                    {getTitle()}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {parsedError.userMessage}
                </Typography>

                {parsedError.isRetryable && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {parsedError.isNetworkError && 'Please check your internet connection and try again.'}
                        {parsedError.isServerError && 'The server might be starting up. Please wait a moment.'}
                        {parsedError.isTimeout && 'The request took too long. Try using filters to reduce data.'}
                    </Typography>
                )}

                {onRetry && (
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                        <Button
                            variant="contained"
                            startIcon={isRetrying ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                            onClick={onRetry}
                            disabled={isRetrying}
                        >
                            {isRetrying ? 'Retrying...' : 'Try Again'}
                        </Button>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}

export default ApiErrorState;
