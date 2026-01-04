'use client';

import * as React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2',
            light: '#42a5f5',
            dark: '#1565c0',
            contrastText: '#fff',
        },
        secondary: {
            main: '#9c27b0',
            light: '#ba68c8',
            dark: '#7b1fa2',
            contrastText: '#fff',
        },
        success: {
            main: '#2e7d32',
            light: '#4caf50',
            dark: '#1b5e20',
        },
        error: {
            main: '#d32f2f',
            light: '#ef5350',
            dark: '#c62828',
        },
        warning: {
            main: '#ed6c02',
            light: '#ff9800',
            dark: '#e65100',
        },
        info: {
            main: '#0288d1',
            light: '#03a9f4',
            dark: '#01579b',
        },
        background: {
            default: '#f5f5f5',
            paper: '#ffffff',
        },
        text: {
            primary: 'rgba(0, 0, 0, 0.87)',
            secondary: 'rgba(0, 0, 0, 0.6)',
            disabled: 'rgba(0, 0, 0, 0.38)',
        },
        divider: 'rgba(0, 0, 0, 0.12)',
    },
    typography: {
        fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial)',
        h1: {
            fontSize: '2.5rem',
            fontWeight: 600,
            lineHeight: 1.2,
            '@media (max-width:600px)': {
                fontSize: '2rem',
            },
        },
        h2: {
            fontSize: '2rem',
            fontWeight: 600,
            lineHeight: 1.3,
            '@media (max-width:600px)': {
                fontSize: '1.75rem',
            },
        },
        h3: {
            fontSize: '1.75rem',
            fontWeight: 600,
            lineHeight: 1.4,
            '@media (max-width:600px)': {
                fontSize: '1.5rem',
            },
        },
        h4: {
            fontSize: '1.5rem',
            fontWeight: 600,
            lineHeight: 1.4,
            '@media (max-width:600px)': {
                fontSize: '1.25rem',
            },
        },
        h5: {
            fontSize: '1.25rem',
            fontWeight: 600,
            lineHeight: 1.5,
            '@media (max-width:600px)': {
                fontSize: '1.1rem',
            },
        },
        h6: {
            fontSize: '1.1rem',
            fontWeight: 600,
            lineHeight: 1.5,
            '@media (max-width:600px)': {
                fontSize: '1rem',
            },
        },
        button: {
            textTransform: 'none',
            fontWeight: 500,
        },
    },
    shape: {
        borderRadius: 8,
    },
    spacing: 8,
    breakpoints: {
        values: {
            xs: 0,
            sm: 600,
            md: 900,
            lg: 1200,
            xl: 1536,
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 500,
                    borderRadius: 8,
                    padding: '8px 16px',
                    boxShadow: 'none',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    },
                },
                sizeSmall: {
                    padding: '6px 12px',
                    fontSize: '0.8125rem',
                },
                sizeMedium: {
                    padding: '8px 16px',
                    fontSize: '0.875rem',
                },
                sizeLarge: {
                    padding: '10px 20px',
                    fontSize: '0.9375rem',
                },
                contained: {
                    '&:hover': {
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
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
                    borderRadius: 12,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    '@media (max-width:600px)': {
                        margin: 16,
                        width: 'calc(100% - 32px)',
                        maxHeight: 'calc(100% - 32px)',
                    },
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    padding: '16px 24px',
                    '@media (max-width:600px)': {
                        fontSize: '1.1rem',
                        padding: '12px 16px',
                    },
                },
            },
        },
        MuiDialogContent: {
            styleOverrides: {
                root: {
                    padding: '20px 24px',
                    '@media (max-width:600px)': {
                        padding: '16px',
                    },
                },
            },
        },
        MuiDialogActions: {
            styleOverrides: {
                root: {
                    padding: '16px 24px',
                    gap: 8,
                    '@media (max-width:600px)': {
                        padding: '12px 16px',
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
                    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                },
                elevation2: {
                    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                },
                elevation3: {
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 8,
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#1976d2',
                        },
                    },
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    padding: '12px 16px',
                    '@media (max-width:600px)': {
                        padding: '8px 12px',
                        fontSize: '0.8125rem',
                    },
                },
                head: {
                    fontWeight: 600,
                    backgroundColor: '#f5f5f5',
                    borderBottom: '2px solid #e0e0e0',
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 500,
                    borderRadius: 6,
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    transition: 'box-shadow 0.2s ease-in-out',
                    '&:hover': {
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    },
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    borderRight: '1px solid rgba(0,0,0,0.12)',
                },
            },
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

