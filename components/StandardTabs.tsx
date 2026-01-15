'use client';
import React from 'react';
import { Paper, Tabs, Tab, useTheme, useMediaQuery } from '@mui/material';

interface StandardTabsProps {
    value: number;
    onChange: (event: React.SyntheticEvent, newValue: number) => void;
    tabs: string[];
    color?: string;
}

export default function StandardTabs({
    value,
    onChange,
    tabs,
    color = '#1e40af'
}: StandardTabsProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isDarkMode = theme.palette.mode === 'dark';

    return (
        <Paper
            elevation={0}
            sx={{
                position: 'sticky',
                top: { xs: 38, md: 42 },
                zIndex: 90,
                borderRadius: 0,
                boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                bgcolor: isDarkMode ? '#1e293b' : 'white',
                borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)',
            }}
        >
            <Tabs
                value={value}
                onChange={onChange}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                    minHeight: { xs: 48, md: 52 },
                    '& .MuiTabs-scrollButtons': {
                        width: 32,
                        '&.Mui-disabled': {
                            opacity: 0.3,
                        },
                    },
                    '& .MuiTabs-indicator': {
                        height: 3,
                        background: `linear-gradient(90deg, ${color} 0%, #3b82f6 100%)`,
                        borderRadius: '3px 3px 0 0',
                    },
                    '& .MuiTab-root': {
                        fontWeight: 600,
                        fontSize: { xs: '0.8rem', sm: '0.85rem' },
                        textTransform: 'none',
                        minHeight: { xs: 48, md: 52 },
                        py: 1.5,
                        px: { xs: 1.5, sm: 2.5 },
                        color: '#64748b',
                        transition: 'all 0.2s ease',
                        '&.Mui-selected': {
                            color: color,
                            fontWeight: 700,
                        },
                        '&:hover': {
                            color: color,
                            bgcolor: 'rgba(30, 64, 175, 0.04)',
                        },
                    },
                }}
            >
                {tabs.map((label, index) => (
                    <Tab key={index} label={label} />
                ))}
            </Tabs>
        </Paper>
    );
}
