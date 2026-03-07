// Wrapper around AgGridReact that adds a rapid-scroll overlay spinner.
// Usage: swap `import { AgGridReact } from 'ag-grid-react'`
//    to  `import { AgGridReact } from '@/components/AGGridScrollWrapper'`
// Everything else (props, ref, etc.) stays exactly the same.

import React, { forwardRef, useRef, useState, useCallback, useEffect, type ComponentProps } from 'react';
import { AgGridReact as OriginalAgGridReact } from 'ag-grid-react';
import { Box, CircularProgress, useTheme } from '@mui/material';

type AgGridProps = ComponentProps<typeof OriginalAgGridReact>;

const AGGridScrollWrapper = forwardRef<InstanceType<typeof OriginalAgGridReact>, AgGridProps>(function AGGridScrollWrapper(props, ref) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    const [isRapidScrolling, setIsRapidScrolling] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollCountRef = useRef(0);
    const scrollWindowRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isRapidRef = useRef(false);

    // Native DOM scroll handler — fires on every scroll tick (not throttled like AG Grid's onBodyScroll)
    const handleNativeScroll = useCallback(() => {
        scrollCountRef.current++;
        if (!scrollWindowRef.current) {
            scrollWindowRef.current = setTimeout(() => {
                scrollCountRef.current = 0;
                scrollWindowRef.current = null;
            }, 400);
        }
        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
        if (scrollCountRef.current >= 4 && !isRapidRef.current) {
            isRapidRef.current = true;
            setIsRapidScrolling(true);
        }
        scrollTimerRef.current = setTimeout(() => {
            isRapidRef.current = false;
            setIsRapidScrolling(false);
            scrollCountRef.current = 0;
        }, 200);
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
            if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
            if (scrollWindowRef.current) clearTimeout(scrollWindowRef.current);
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

// Re-export as AgGridReact so pages only need to change the import path
export { AGGridScrollWrapper as AgGridReact };
export default AGGridScrollWrapper;
