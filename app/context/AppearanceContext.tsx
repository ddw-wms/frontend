// File Path = warehouse-frontend/app/context/AppearanceContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

// Default appearance settings
export const DEFAULT_APPEARANCE_SETTINGS = {
    theme: 'light' as 'light' | 'dark',
    fontSize: 14,
    fontFamily: 'Inter',
    sidebarCompact: false,
    tableRowDensity: 'comfortable' as 'extra-compact' | 'compact' | 'comfortable',
    primaryColor: '#1e40af',
    showAnimations: true,
    highContrastMode: false,
};

export type AppearanceSettings = typeof DEFAULT_APPEARANCE_SETTINGS;

interface AppearanceContextType {
    settings: AppearanceSettings;
    updateSetting: <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => void;
    updateSettings: (newSettings: Partial<AppearanceSettings>) => void;
    resetSettings: () => void;
    saveSettings: () => void;
    hasUnsavedChanges: boolean;
    isLoading: boolean;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

// CSS custom properties map
const CSS_PROPERTIES_MAP: Record<string, string> = {
    fontSize: '--app-font-size',
    fontFamily: '--app-font-family',
    primaryColor: '--app-primary-color',
};

// Apply settings to DOM
const applySettingsToDOM = (settings: AppearanceSettings) => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    // Font size
    root.style.setProperty('--app-font-size', `${settings.fontSize}px`);
    // Also set on body directly for immediate effect
    document.body.style.fontSize = `${settings.fontSize}px`;

    // Font family
    root.style.setProperty('--app-font-family', settings.fontFamily);
    document.body.style.fontFamily = settings.fontFamily;

    // Primary color and variations
    root.style.setProperty('--app-primary-color', settings.primaryColor);
    root.style.setProperty('--app-primary-color-light', adjustColor(settings.primaryColor, 40));
    root.style.setProperty('--app-primary-color-dark', adjustColor(settings.primaryColor, -20));
    root.style.setProperty('--app-primary-color-rgb', hexToRgb(settings.primaryColor));

    // Table row density
    const rowHeight = settings.tableRowDensity === 'extra-compact' ? '28' : settings.tableRowDensity === 'compact' ? '36' : '44';
    root.style.setProperty('--app-table-row-height', `${rowHeight}px`);

    // Animations
    if (settings.showAnimations) {
        root.style.setProperty('--app-transition-duration', '0.2s');
        root.removeAttribute('data-animations');
    } else {
        root.style.setProperty('--app-transition-duration', '0s');
        root.setAttribute('data-animations', 'disabled');
    }

    // High contrast
    if (settings.highContrastMode) {
        root.classList.add('high-contrast');
    } else {
        root.classList.remove('high-contrast');
    }

    // Theme - apply directly (no auto mode)
    root.setAttribute('data-theme', settings.theme);
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: settings.theme } }));

    // Sidebar compact preference (for initial load)
    if (settings.sidebarCompact) {
        localStorage.setItem('sidebar-collapsed', 'true');
    }

    // Force AG Grid to refresh row heights by triggering a resize event
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 100);
};

// Helper: Adjust color brightness
const adjustColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
};

// Helper: Convert hex to RGB
const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : '30, 64, 175';
};

export const AppearanceProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_APPEARANCE_SETTINGS);
    const [savedSettings, setSavedSettings] = useState<AppearanceSettings>(DEFAULT_APPEARANCE_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Load settings on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem('app_appearance_settings');
            if (stored) {
                const parsed = JSON.parse(stored);
                const merged = { ...DEFAULT_APPEARANCE_SETTINGS, ...parsed };
                setSettings(merged);
                setSavedSettings(merged);
                applySettingsToDOM(merged);
            } else {
                applySettingsToDOM(DEFAULT_APPEARANCE_SETTINGS);
            }
        } catch (error) {
            console.error('Failed to load appearance settings:', error);
            applySettingsToDOM(DEFAULT_APPEARANCE_SETTINGS);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Track unsaved changes
    useEffect(() => {
        setHasUnsavedChanges(JSON.stringify(settings) !== JSON.stringify(savedSettings));
    }, [settings, savedSettings]);

    // Apply settings to DOM whenever they change (live preview)
    useEffect(() => {
        if (!isLoading) {
            applySettingsToDOM(settings);
        }
    }, [settings, isLoading]);

    // Update single setting
    const updateSetting = useCallback(<K extends keyof AppearanceSettings>(
        key: K,
        value: AppearanceSettings[K]
    ) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    }, []);

    // Update multiple settings
    const updateSettings = useCallback((newSettings: Partial<AppearanceSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    // Reset to defaults
    const resetSettings = useCallback(() => {
        setSettings(DEFAULT_APPEARANCE_SETTINGS);
    }, []);

    // Save settings to localStorage
    const saveSettings = useCallback(() => {
        try {
            localStorage.setItem('app_appearance_settings', JSON.stringify(settings));
            setSavedSettings(settings);

            // Handle sidebar compact setting
            localStorage.setItem('sidebar-collapsed', settings.sidebarCompact ? 'true' : 'false');

            // Dispatch custom event for components that need to react
            window.dispatchEvent(new CustomEvent('appearanceSettingsChanged', { detail: settings }));

            // Apply settings to DOM immediately after save
            applySettingsToDOM(settings);
        } catch (error) {
            console.error('Failed to save appearance settings:', error);
            throw error;
        }
    }, [settings]);

    return (
        <AppearanceContext.Provider value={{
            settings,
            updateSetting,
            updateSettings,
            resetSettings,
            saveSettings,
            hasUnsavedChanges,
            isLoading,
        }}>
            {children}
        </AppearanceContext.Provider>
    );
};

export const useAppearance = () => {
    const context = useContext(AppearanceContext);
    if (context === undefined) {
        throw new Error('useAppearance must be used within an AppearanceProvider');
    }
    return context;
};

// Hook to get specific setting value
export const useAppearanceSetting = <K extends keyof AppearanceSettings>(key: K): AppearanceSettings[K] => {
    const { settings } = useAppearance();
    return settings[key];
};

// Hook for table row height based on density setting
export const useTableRowHeight = (): number => {
    const { settings } = useAppearance();
    return settings.tableRowDensity === 'extra-compact' ? 28 : settings.tableRowDensity === 'compact' ? 36 : 44;
};

// Hook for animation check
export const useAnimationsEnabled = (): boolean => {
    const { settings } = useAppearance();
    return settings.showAnimations;
};
