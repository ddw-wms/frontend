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
    const lastScrollTopRef = useRef(0);
    const lastScrollTimeRef = useRef(0);

    // Detect rapid scrolling via scroll velocity (px/ms).
    // Normal scroll: ~0.5-2 px/ms. Rapid flick/drag: 5+ px/ms.
    const handleNativeScroll = useCallback((e: Event) => {
        const target = e.target as HTMLElement;
        const now = performance.now();
        const scrollTop = target.scrollTop;
        const dt = now - lastScrollTimeRef.current;
        const dp = Math.abs(scrollTop - lastScrollTopRef.current);

        lastScrollTopRef.current = scrollTop;
        lastScrollTimeRef.current = now;

        // Need at least 16ms gap to measure velocity (avoid division noise)
        if (dt < 16) return;

        const velocity = dp / dt; // px per ms

        if (velocity > 5 && !isRapidRef.current) {
            isRapidRef.current = true;
            setIsRapidScrolling(true);
        }

        // Hide overlay 250ms after scrolling slows/stops
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            isRapidRef.current = false;
            setIsRapidScrolling(false);
        }, 250);
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
