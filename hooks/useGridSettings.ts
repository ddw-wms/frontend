/**
 * ⚡ PERFORMANCE OPTIMIZATION: Custom hook to manage AG Grid settings
 * 
 * Purpose: Extract grid settings state from large page components
 * to reduce re-renders when settings change.
 * 
 * Benefits:
 * - Persists settings to localStorage automatically
 * - Memoized defaultColDef prevents unnecessary grid re-renders
 * - Centralized grid configuration across all pages
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

export interface GridSettings {
    enableSorting: boolean;
    enableColumnFilters: boolean;
    enableColumnResize: boolean;
}

const STORAGE_KEYS = {
    SORTING: 'grid_enableSorting',
    FILTERS: 'grid_enableColumnFilters',
    RESIZE: 'grid_enableColumnResize',
};

const DEFAULT_SETTINGS: GridSettings = {
    enableSorting: false,
    enableColumnFilters: false,
    enableColumnResize: true,
};

export function useGridSettings(storagePrefix: string = 'grid') {
    const keys = useMemo(() => ({
        sorting: `${storagePrefix}_enableSorting`,
        filters: `${storagePrefix}_enableColumnFilters`,
        resize: `${storagePrefix}_enableColumnResize`,
    }), [storagePrefix]);

    // Initialize from localStorage
    const [settings, setSettings] = useState<GridSettings>(() => {
        if (typeof window === 'undefined') return DEFAULT_SETTINGS;

        try {
            return {
                enableSorting: localStorage.getItem(keys.sorting) === 'true',
                enableColumnFilters: localStorage.getItem(keys.filters) === 'true',
                enableColumnResize: localStorage.getItem(keys.resize) !== 'false',
            };
        } catch {
            return DEFAULT_SETTINGS;
        }
    });

    // Dialog state
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

    // Persist to localStorage when settings change
    useEffect(() => {
        try {
            localStorage.setItem(keys.sorting, String(settings.enableSorting));
            localStorage.setItem(keys.filters, String(settings.enableColumnFilters));
            localStorage.setItem(keys.resize, String(settings.enableColumnResize));
        } catch {
            // Ignore localStorage errors
        }
    }, [settings, keys]);

    // Memoized defaultColDef - only recalculates when relevant settings change
    const defaultColDef = useMemo(() => ({
        sortable: settings.enableSorting,
        resizable: settings.enableColumnResize,
        filter: settings.enableColumnFilters,
        minWidth: 100,
        flex: 1,
        tooltipComponentParams: { color: '#ececec' },
    }), [settings.enableSorting, settings.enableColumnResize, settings.enableColumnFilters]);

    // Setting updaters
    const setEnableSorting = useCallback((value: boolean) => {
        setSettings(prev => ({ ...prev, enableSorting: value }));
    }, []);

    const setEnableColumnFilters = useCallback((value: boolean) => {
        setSettings(prev => ({ ...prev, enableColumnFilters: value }));
    }, []);

    const setEnableColumnResize = useCallback((value: boolean) => {
        setSettings(prev => ({ ...prev, enableColumnResize: value }));
    }, []);

    // Toggle settings dialog
    const openSettingsDialog = useCallback(() => setSettingsDialogOpen(true), []);
    const closeSettingsDialog = useCallback(() => setSettingsDialogOpen(false), []);

    // Reset to defaults
    const resetSettings = useCallback(() => {
        setSettings(DEFAULT_SETTINGS);
    }, []);

    return {
        // Current settings
        ...settings,

        // Memoized column defaults
        defaultColDef,

        // Dialog state
        settingsDialogOpen,

        // Setters
        setEnableSorting,
        setEnableColumnFilters,
        setEnableColumnResize,

        // Dialog controls
        openSettingsDialog,
        closeSettingsDialog,

        // Actions
        resetSettings,
    };
}

export default useGridSettings;
