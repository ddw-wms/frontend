'use client';
import React from 'react';
import { Paper, Tabs, Tab } from '@mui/material';

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
    color = '#3b82f6'
}: StandardTabsProps) {
    return (
        <Paper
            sx={{
                position: 'sticky',
                top: { xs: 38, md: 42 },
                zIndex: 90,
                borderRadius: 0,
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                bgcolor: 'white'
            }}
        >
            <Tabs
                value={value}
                onChange={onChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                    '& .MuiTabs-indicator': {
                        height: 3,
                        background: `linear-gradient(90deg, ${color} 0%, ${color}dd 100%)`,
                        borderRadius: '2px 2px 0 0'
                    },
                    '& .MuiTab-root': {
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        textTransform: 'none',
                        minHeight: 44,
                        py: 1,
                        px: 2,
                        color: '#64748b',
                        '&.Mui-selected': {
                            color: color,
                            fontWeight: 700
                        },
                        '&:hover': {
                            color: color,
                            bgcolor: 'rgba(59, 130, 246, 0.04)'
                        }
                    }
                }}
            >
                {tabs.map((label, index) => (
                    <Tab key={index} label={label} />
                ))}
            </Tabs>
        </Paper>
    );
}
