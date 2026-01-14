'use client';

import * as React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

const theme = createTheme({
    palette: {
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
            default: '#f5f7fa',
            paper: '#ffffff',
        },
        text: {
            primary: '#1f2937',
            secondary: '#6b7280',
            disabled: '#9ca3af',
        },
        divider: 'rgba(0, 0, 0, 0.08)',
        grey: {
            50: '#f9fafb',
            100: '#f3f4f6',
            200: '#e5e7eb',
            300: '#d1d5db',
            400: '#9ca3af',
            500: '#6b7280',
            600: '#4b5563',
            700: '#374151',
            800: '#1f2937',
            900: '#111827',
        },
    },
    typography: {
        fontFamily: 'var(--font-sans, "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif)',
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
                    fontSize: '16px', // Prevents iOS zoom
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
                fontSize: '16px', // Prevents iOS zoom
            },
        },
    },
},
    MuiTableCell: {
    styleOverrides: {
        root: {
            padding: '14px 16px',
            borderColor: '#f1f5f9',
            '@media (max-width:640px)': {
                padding: '10px 12px',
                fontSize: '0.8125rem',
            },
        },
        head: {
            fontWeight: 700,
            backgroundColor: '#f8fafc',
            borderBottom: '2px solid #e5e7eb',
            color: '#374151',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
        },
    },
},
    MuiTableRow: {
    styleOverrides: {
        root: {
            transition: 'background-color 0.15s ease',
            '&:hover': {
                backgroundColor: '#f8fafc',
            },
        },
    },
},
    MuiChip: {
    styleOverrides: {
        root: {
            fontWeight: 600,
            borderRadius: 8,
            height: 28,
            '@media (max-width:640px)': {
                height: 26,
                fontSize: '0.75rem',
            },
        },
        sizeSmall: {
            height: 24,
            fontSize: '0.75rem',
            '@media (max-width:640px)': {
                height: 22,
                fontSize: '0.6875rem',
            },
        },
        colorSuccess: {
            backgroundColor: '#dcfce7',
            color: '#166534',
        },
        colorError: {
            backgroundColor: '#fee2e2',
            color: '#991b1b',
        },
        colorWarning: {
            backgroundColor: '#fef3c7',
            color: '#92400e',
        },
        colorInfo: {
            backgroundColor: '#dbeafe',
            color: '#1e40af',
        },
    },
},
    MuiCard: {
    styleOverrides: {
        root: {
            borderRadius: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 6px rgba(0,0,0,0.04)',
            transition: 'box-shadow 0.25s ease, transform 0.25s ease',
            border: '1px solid rgba(0,0,0,0.04)',
            '&:hover': {
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
            },
            '@media (max-width:640px)': {
                borderRadius: 12,
            },
        },
    },
},
    MuiCardContent: {
    styleOverrides: {
        root: {
            padding: 20,
            '&:last-child': {
                paddingBottom: 20,
            },
            '@media (max-width:640px)': {
                padding: 16,
                '&:last-child': {
                    paddingBottom: 16,
                },
            },
        },
    },
},
    MuiDrawer: {
    styleOverrides: {
        paper: {
            borderRight: 'none',
            boxShadow: '4px 0 24px rgba(0,0,0,0.1)',
        },
    },
},
    MuiTabs: {
    styleOverrides: {
        root: {
            minHeight: 44,
        },
        indicator: {
            height: 3,
            borderRadius: '3px 3px 0 0',
        },
    },
},
    MuiTab: {
    styleOverrides: {
        root: {
            textTransform: 'none',
            fontWeight: 600,
            minHeight: 44,
            padding: '12px 20px',
            '@media (max-width:640px)': {
                padding: '10px 14px',
                minWidth: 'auto',
                fontSize: '0.8125rem',
            },
        },
    },
},
    MuiTooltip: {
    styleOverrides: {
        tooltip: {
            backgroundColor: '#1f2937',
            fontSize: '0.75rem',
            fontWeight: 500,
            padding: '8px 12px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        },
        arrow: {
            color: '#1f2937',
        },
    },
},
    MuiAlert: {
    styleOverrides: {
        root: {
            borderRadius: 10,
            fontWeight: 500,
        },
        standardSuccess: {
            backgroundColor: '#dcfce7',
            color: '#166534',
        },
        standardError: {
            backgroundColor: '#fee2e2',
            color: '#991b1b',
        },
        standardWarning: {
            backgroundColor: '#fef3c7',
            color: '#92400e',
        },
        standardInfo: {
            backgroundColor: '#dbeafe',
            color: '#1e40af',
        },
    },
},
    MuiSnackbar: {
    styleOverrides: {
        root: {
            '@media (max-width:640px)': {
                left: 16,
                right: 16,
                bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            },
        },
    },
},
    MuiIconButton: {
    styleOverrides: {
        root: {
            transition: 'all 0.2s ease',
            '@media (max-width:640px)': {
                padding: 10,
            },
            '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.06)',
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
        paper: {
            borderRadius: 12,
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
            marginTop: 8,
        },
    },
},
    MuiMenuItem: {
    styleOverrides: {
        root: {
            borderRadius: 6,
            margin: '2px 8px',
            padding: '10px 12px',
            '&:hover': {
                backgroundColor: '#f1f5f9',
            },
            '&.Mui-selected': {
                backgroundColor: '#eff6ff',
                '&:hover': {
                    backgroundColor: '#dbeafe',
                },
            },
        },
    },
},
    MuiAutocomplete: {
    styleOverrides: {
        paper: {
            borderRadius: 12,
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
        },
        option: {
            borderRadius: 6,
            margin: '2px 8px',
            '&:hover': {
                backgroundColor: '#f1f5f9',
            },
        },
    });

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
    return (
        <AppRouterCacheProvider>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </AppRouterCacheProvider>
    );
}

