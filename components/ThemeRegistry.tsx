'use client';

import * as React from 'react';
import { ThemeProvider, createTheme, PaletteMode } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

// Theme mode context for dynamic switching
const ThemeModeContext = React.createContext<{
    mode: PaletteMode;
    toggleMode: () => void;
    setMode: (mode: 'light' | 'dark' | 'auto') => void;
}>({
    mode: 'light',
    toggleMode: () => { },
    setMode: () => { },
});

export const useThemeMode = () => React.useContext(ThemeModeContext);

// Create theme based on mode
const createAppTheme = (mode: PaletteMode) => createTheme({
    palette: {
        mode,
        primary: {
            main: '#1e40af',
            light: '#3b82f6',
            dark: '#1e3a8a',
            contrastText: '#fff',
        },
        secondary: {
            main: '#7c3aed',
            light: '#a78bfa',
            dark: '#5b21b6',
            contrastText: '#fff',
        },
        success: {
            main: '#059669',
            light: '#10b981',
            dark: '#047857',
        },
        error: {
            main: '#dc2626',
            light: '#ef4444',
            dark: '#b91c1c',
        },
        warning: {
            main: '#d97706',
            light: '#f59e0b',
            dark: '#b45309',
        },
        info: {
            main: '#0284c7',
            light: '#0ea5e9',
            dark: '#0369a1',
        },
        background: {
            default: mode === 'dark' ? '#0f172a' : '#f5f7fa',
            paper: mode === 'dark' ? '#1e293b' : '#ffffff',
        },
        text: {
            primary: mode === 'dark' ? '#f1f5f9' : '#1f2937',
            secondary: mode === 'dark' ? '#94a3b8' : '#6b7280',
            disabled: mode === 'dark' ? '#64748b' : '#9ca3af',
        },
        divider: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        grey: {
            50: mode === 'dark' ? '#1e293b' : '#f9fafb',
            100: mode === 'dark' ? '#334155' : '#f3f4f6',
            200: mode === 'dark' ? '#475569' : '#e5e7eb',
            300: mode === 'dark' ? '#64748b' : '#d1d5db',
            400: mode === 'dark' ? '#94a3b8' : '#9ca3af',
            500: mode === 'dark' ? '#cbd5e1' : '#6b7280',
            600: mode === 'dark' ? '#e2e8f0' : '#4b5563',
            700: mode === 'dark' ? '#f1f5f9' : '#374151',
            800: mode === 'dark' ? '#f8fafc' : '#1f2937',
            900: mode === 'dark' ? '#ffffff' : '#111827',
        },
        ...(mode === 'dark' && {
            action: {
                active: '#f1f5f9',
                hover: 'rgba(255, 255, 255, 0.08)',
                selected: 'rgba(255, 255, 255, 0.16)',
                disabled: 'rgba(255, 255, 255, 0.3)',
                disabledBackground: 'rgba(255, 255, 255, 0.12)',
            },
        }),
    },
    typography: {
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        h1: {
            fontSize: '2.25rem',
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            '@media (max-width:600px)': {
                fontSize: '1.75rem',
            },
        },
        h2: {
            fontSize: '1.875rem',
            fontWeight: 700,
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
            '@media (max-width:600px)': {
                fontSize: '1.5rem',
            },
        },
        h3: {
            fontSize: '1.5rem',
            fontWeight: 600,
            lineHeight: 1.4,
            '@media (max-width:600px)': {
                fontSize: '1.25rem',
            },
        },
        h4: {
            fontSize: '1.25rem',
            fontWeight: 600,
            lineHeight: 1.4,
            '@media (max-width:600px)': {
                fontSize: '1.125rem',
            },
        },
        h5: {
            fontSize: '1.125rem',
            fontWeight: 600,
            lineHeight: 1.5,
            '@media (max-width:600px)': {
                fontSize: '1rem',
            },
        },
        h6: {
            fontSize: '1rem',
            fontWeight: 600,
            lineHeight: 1.5,
            '@media (max-width:600px)': {
                fontSize: '0.9375rem',
            },
        },
        body1: {
            fontSize: '0.9375rem',
            lineHeight: 1.6,
            '@media (max-width:600px)': {
                fontSize: '0.875rem',
            },
        },
        body2: {
            fontSize: '0.875rem',
            lineHeight: 1.6,
            '@media (max-width:600px)': {
                fontSize: '0.8125rem',
            },
        },
        button: {
            textTransform: 'none',
            fontWeight: 600,
            letterSpacing: '0.01em',
        },
        caption: {
            fontSize: '0.75rem',
            lineHeight: 1.5,
            color: '#6b7280',
        },
        overline: {
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
        },
    },
    shape: {
        borderRadius: 10,
    },
    spacing: 8,
    breakpoints: {
        values: {
            xs: 0,
            sm: 640,
            md: 768,
            lg: 1024,
            xl: 1280,
        },
    },
    shadows: [
        'none',
        '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    ],
    transitions: {
        duration: {
            shortest: 150,
            shorter: 200,
            short: 250,
            standard: 300,
            complex: 375,
            enteringScreen: 225,
            leavingScreen: 195,
        },
        easing: {
            easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
            easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
            easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
            sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
        },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    scrollbarWidth: 'thin',
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 10,
                    padding: '8px 18px',
                    boxShadow: 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    minHeight: 40,
                    '&:hover': {
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        transform: 'translateY(-1px)',
                    },
                    '&:active': {
                        transform: 'translateY(0)',
                    },
                    '@media (max-width:640px)': {
                        minHeight: 44,
                        padding: '10px 16px',
                    },
                },
                sizeSmall: {
                    padding: '6px 14px',
                    fontSize: '0.8125rem',
                    minHeight: 36,
                    '@media (max-width:640px)': {
                        minHeight: 40,
                        padding: '8px 14px',
                    },
                },
                sizeMedium: {
                    padding: '8px 18px',
                    fontSize: '0.875rem',
                },
                sizeLarge: {
                    padding: '12px 24px',
                    fontSize: '0.9375rem',
                    minHeight: 48,
                },
                contained: {
                    '&:hover': {
                        boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                    },
                },
                containedPrimary: {
                    background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)',
                    },
                },
                outlined: {
                    borderWidth: 1.5,
                    '&:hover': {
                        borderWidth: 1.5,
                        backgroundColor: 'rgba(30, 64, 175, 0.04)',
                    },
                },
            },
            defaultProps: {
                disableElevation: true,
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: 16,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    '@media (max-width:640px)': {
                        margin: 16,
                        width: 'calc(100% - 32px)',
                        maxHeight: 'calc(100% - 32px)',
                        borderRadius: 12,
                    },
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    padding: '20px 24px',
                    '@media (max-width:640px)': {
                        fontSize: '1.125rem',
                        padding: '16px 20px',
                    },
                },
            },
        },
        MuiDialogContent: {
            styleOverrides: {
                root: {
                    padding: '24px',
                    '@media (max-width:640px)': {
                        padding: '16px 20px',
                    },
                },
            },
        },
        MuiDialogActions: {
            styleOverrides: {
                root: {
                    padding: '16px 24px 20px',
                    gap: 10,
                    '@media (max-width:640px)': {
                        padding: '12px 20px 16px',
                        flexDirection: 'column-reverse',
                        '& > :not(:first-of-type)': {
                            marginLeft: 0,
                        },
                        '& > *': {
                            width: '100%',
                            margin: 0,
                        },
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
                elevation1: {
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
                },
                elevation2: {
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
                },
                elevation3: {
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                },
                rounded: {
                    borderRadius: 12,
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 10,
                        transition: 'all 0.2s ease',
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#3b82f6',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderWidth: 2,
                        },
                    },
                    '& .MuiInputBase-input': {
                        '@media (max-width:640px)': {
                            fontSize: '16px',
                        },
                    },
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#3b82f6',
                    },
                },
                input: {
                    padding: '12px 14px',
                    '@media (max-width:640px)': {
                        padding: '14px 14px',
                    },
                },
            },
        },
        MuiSelect: {
            styleOverrides: {
                select: {
                    '@media (max-width:640px)': {
                        fontSize: '16px',
                    },
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 500,
                    borderRadius: 8,
                },
                sizeSmall: {
                    height: 24,
                    fontSize: '0.75rem',
                },
                sizeMedium: {
                    height: 32,
                },
                colorPrimary: {
                    backgroundColor: '#eff6ff',
                    color: '#1e40af',
                },
                colorSuccess: {
                    backgroundColor: '#ecfdf5',
                    color: '#059669',
                },
                colorError: {
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                },
                colorWarning: {
                    backgroundColor: '#fffbeb',
                    color: '#d97706',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                    '&:hover': {
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                    },
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    minHeight: 48,
                    '@media (max-width:640px)': {
                        minHeight: 44,
                        fontSize: '0.8125rem',
                        padding: '8px 12px',
                    },
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                indicator: {
                    height: 3,
                    borderRadius: '3px 3px 0 0',
                },
            },
        },
        MuiAlert: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    alignItems: 'center',
                },
                standardSuccess: {
                    backgroundColor: '#ecfdf5',
                    color: '#065f46',
                    '& .MuiAlert-icon': {
                        color: '#059669',
                    },
                },
                standardError: {
                    backgroundColor: '#fef2f2',
                    color: '#991b1b',
                    '& .MuiAlert-icon': {
                        color: '#dc2626',
                    },
                },
                standardWarning: {
                    backgroundColor: '#fffbeb',
                    color: '#92400e',
                    '& .MuiAlert-icon': {
                        color: '#d97706',
                    },
                },
                standardInfo: {
                    backgroundColor: '#eff6ff',
                    color: '#1e40af',
                    '& .MuiAlert-icon': {
                        color: '#3b82f6',
                    },
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: '#1f2937',
                    fontSize: '0.75rem',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontWeight: 500,
                },
                arrow: {
                    color: '#1f2937',
                },
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    transition: 'all 0.2s ease',
                    '@media (max-width:640px)': {
                        padding: 10,
                    },
                },
            },
        },
        MuiFab: {
            styleOverrides: {
                root: {
                    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                    '&:hover': {
                        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                    },
                },
            },
        },
        MuiLinearProgress: {
            styleOverrides: {
                root: {
                    borderRadius: 4,
                    height: 6,
                },
            },
        },
        MuiCircularProgress: {
            styleOverrides: {
                root: {
                    strokeLinecap: 'round',
                },
            },
        },
        MuiSkeleton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                },
            },
        },
        MuiMenu: {
            styleOverrides: {
                paper: ({ theme }) => ({
                    borderRadius: 12,
                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                    marginTop: 8,
                    backgroundColor: theme.palette.background.paper,
                }),
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: ({ theme }) => ({
                    borderRadius: 6,
                    margin: '2px 8px',
                    padding: '10px 12px',
                    '&:hover': {
                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                    },
                    '&.Mui-selected': {
                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(30, 64, 175, 0.2)' : '#eff6ff',
                        '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(30, 64, 175, 0.3)' : '#dbeafe',
                        },
                    },
                }),
            },
        },
        MuiAutocomplete: {
            styleOverrides: {
                paper: ({ theme }) => ({
                    borderRadius: 12,
                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                    backgroundColor: theme.palette.background.paper,
                }),
                option: ({ theme }) => ({
                    borderRadius: 6,
                    margin: '2px 8px',
                    '&:hover': {
                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                    },
                }),
            },
        },
    },
});

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
    const [mode, setModeState] = React.useState<PaletteMode>('light');

    // Load theme from localStorage on mount
    React.useEffect(() => {
        const stored = localStorage.getItem('app_appearance_settings');
        if (stored) {
            try {
                const settings = JSON.parse(stored);
                if (settings.theme === 'dark') {
                    setModeState('dark');
                } else if (settings.theme === 'auto') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    setModeState(prefersDark ? 'dark' : 'light');
                } else {
                    setModeState('light');
                }
            } catch (e) {
                setModeState('light');
            }
        }
    }, []);

    // Listen for theme changes from AppearanceContext
    React.useEffect(() => {
        const handleThemeChange = (e: CustomEvent) => {
            const theme = e.detail?.theme;
            if (theme === 'dark') {
                setModeState('dark');
            } else if (theme === 'auto') {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                setModeState(prefersDark ? 'dark' : 'light');
            } else {
                setModeState('light');
            }
        };

        window.addEventListener('appearanceSettingsChanged', handleThemeChange as EventListener);
        window.addEventListener('themeChanged', handleThemeChange as EventListener);
        return () => {
            window.removeEventListener('appearanceSettingsChanged', handleThemeChange as EventListener);
            window.removeEventListener('themeChanged', handleThemeChange as EventListener);
        };
    }, []);

    // Listen for system preference changes when in auto mode
    React.useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => {
            const stored = localStorage.getItem('app_appearance_settings');
            if (stored) {
                const settings = JSON.parse(stored);
                if (settings.theme === 'auto') {
                    setModeState(e.matches ? 'dark' : 'light');
                }
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const toggleMode = React.useCallback(() => {
        setModeState((prev) => (prev === 'light' ? 'dark' : 'light'));
    }, []);

    const setMode = React.useCallback((newMode: 'light' | 'dark' | 'auto') => {
        if (newMode === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setModeState(prefersDark ? 'dark' : 'light');
        } else {
            setModeState(newMode);
        }
    }, []);

    const theme = React.useMemo(() => createAppTheme(mode), [mode]);

    return (
        <AppRouterCacheProvider>
            <ThemeModeContext.Provider value={{ mode, toggleMode, setMode }}>
                <ThemeProvider theme={theme}>
                    <CssBaseline />
                    {children}
                </ThemeProvider>
            </ThemeModeContext.Provider>
        </AppRouterCacheProvider>
    );
}

