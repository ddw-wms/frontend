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
            setTimeout(() => setSnackbar({ ...snackbar, open: false }), 3000);
        },
        [snackbar]
    );

    return { snackbar, showSnackbar };
};