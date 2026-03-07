// Wrapper around AgGridReact that adds a rapid-scroll overlay spinner.
// Usage: swap `import { AgGridReact } from 'ag-grid-react'`
//    to  `import { AgGridReact } from '@/components/AGGridScrollWrapper'`
// Everything else (props, ref, etc.) stays exactly the same.

import React, { forwardRef, useRef, useState, useCallback, useEffect } from 'react';
import { AgGridReact as OriginalAgGridReact } from 'ag-grid-react';
import { Box, CircularProgress, useTheme } from '@mui/material';

const AGGridScrollWrapper = forwardRef<any, any>(function AGGridScrollWrapper(props, ref) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    const [isRapidScrolling, setIsRapidScrolling] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isRapidRef = useRef(false);
    // Rolling window: track scroll distances with timestamps
    const scrollSamplesRef = useRef<{ time: number; pos: number }[]>([]);

    // Measure cumulative scroll distance over a 600ms rolling window.
    // Normal wheel/trackpad: ~200-800px in 600ms.
    // Rapid scrollbar drag or fast flick: 2500+ px in 600ms (scrolling through 50+ rows).
    const WINDOW_MS = 600;
    const DISTANCE_THRESHOLD = 2500;

    const handleNativeScroll = useCallback((e: Event) => {
        const target = e.target as HTMLElement;
        const now = performance.now();
        const scrollTop = target.scrollTop;

        // Add current sample
        const samples = scrollSamplesRef.current;
        samples.push({ time: now, pos: scrollTop });

        // Trim samples outside the rolling window
        while (samples.length > 0 && now - samples[0].time > WINDOW_MS) {
            samples.shift();
        }

        // Calculate total distance traveled in window (handles direction changes)
        let totalDistance = 0;
        for (let i = 1; i < samples.length; i++) {
            totalDistance += Math.abs(samples[i].pos - samples[i - 1].pos);
        }

        if (totalDistance >= DISTANCE_THRESHOLD && !isRapidRef.current) {
            isRapidRef.current = true;
            setIsRapidScrolling(true);
        }

        // Hide overlay 300ms after scrolling stops
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            isRapidRef.current = false;
            setIsRapidScrolling(false);
            scrollSamplesRef.current = [];
        }, 300);
    }, []);

    // Attach native scroll listener to AG Grid's internal scrollable viewport
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        let viewport: Element | null = null;
        // AG Grid renders async — poll briefly until viewport is available
        const findViewport = () => {
            viewport = el.querySelector('.ag-body-viewport') || el.querySelector('.ag-center-cols-viewport');
            if (viewport) {
                viewport.addEventListener('scroll', handleNativeScroll, { passive: true });
            }
        };

        findViewport();
        // Retry after grid renders if not found immediately
        const retryTimer = !viewport ? setTimeout(findViewport, 500) : null;

        return () => {
            if (retryTimer) clearTimeout(retryTimer);
            if (viewport) viewport.removeEventListener('scroll', handleNativeScroll);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [handleNativeScroll]);

    return (
        <Box ref={containerRef} sx={{ position: 'relative', width: '100%', height: '100%' }}>
            <OriginalAgGridReact
                ref={ref}
                {...props}
            />
            {isRapidScrolling && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isDarkMode ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.6)',
                        backdropFilter: 'blur(2px)',
                        zIndex: 10,
                        pointerEvents: 'none',
                    }}
                >
                    <CircularProgress size={28} sx={{ color: isDarkMode ? '#60a5fa' : '#1e40af' }} />
                </Box>
            )}
        </Box>
    );
});

// Re-export with the original AgGridReact type so generics (TData) flow through correctly
export const AgGridReact = AGGridScrollWrapper as any as typeof OriginalAgGridReact;
export default AGGridScrollWrapper;
