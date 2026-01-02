// File: components/StandardLoadingOverlay.tsx
// Reusable smooth loading overlay component - prevents flicker on fast loads

import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface StandardLoadingOverlayProps {
    loading: boolean;
    delay?: number; // milliseconds before showing overlay (default: 300ms to prevent flicker)
    message?: string;
}

export const StandardLoadingOverlay: React.FC<StandardLoadingOverlayProps> = ({
    loading,
    delay = 300,
    message = 'Loading...'
}) => {
    const [showOverlay, setShowOverlay] = useState(false);
    const timeoutRef = React.useRef<any>(null);

    useEffect(() => {
        if (loading && !showOverlay) {
            // Show overlay only if loading takes longer than delay (prevents flicker on fast loads)
            timeoutRef.current = setTimeout(() => {
                setShowOverlay(true);
            }, delay);
        } else if (!loading && showOverlay) {
            // Hide immediately when loading completes
            setShowOverlay(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [loading, showOverlay, delay]);

    if (!showOverlay || !loading) return null;

    return (
        <Box
            sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(255,255,255,0.65)',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(0.5px)',
                opacity: showOverlay ? 1 : 0,
                transition: 'opacity 0.2s ease-in-out'
            }}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8 }}>
                <CircularProgress size={36} thickness={4} />
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500 }}>
                    {message}
                </Typography>
            </Box>
        </Box>
    );
};

export default StandardLoadingOverlay;
