// File Path = warehouse-frontend\hooks\useSnackbar.ts
import { useState, useCallback, useRef, useEffect } from 'react';

export const useSnackbar = () => {
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'warning' | 'info';
    }>({
        open: false,
        message: '',
        severity: 'info',
    });

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const showSnackbar = useCallback(
        (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'info') => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setSnackbar({ open: true, message, severity });
            timerRef.current = setTimeout(() => setSnackbar(prev => ({ ...prev, open: false })), 3000);
        },
        []
    );

    const closeSnackbar = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setSnackbar(prev => ({ ...prev, open: false }));
    }, []);

    return { snackbar, showSnackbar, closeSnackbar };
};