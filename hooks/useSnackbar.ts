// File Path = warehouse-frontend\hooks\useSnackbar.ts
import { useState, useCallback } from 'react';

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

    const showSnackbar = useCallback(
        (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'info') => {
            setSnackbar({ open: true, message, severity });
            // Use functional update to avoid stale closure
            setTimeout(() => setSnackbar(prev => ({ ...prev, open: false })), 3000);
        },
        [] // No dependencies needed with functional update
    );

    const closeSnackbar = useCallback(() => {
        setSnackbar(prev => ({ ...prev, open: false }));
    }, []);

    return { snackbar, showSnackbar, closeSnackbar };
};