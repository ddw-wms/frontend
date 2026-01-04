'use client';
import React from 'react';
import { Box, Typography, Chip, Stack, useMediaQuery } from '@mui/material';

interface StandardPageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: string;
    warehouseName?: string;
    userName?: string;
    userRole?: string;
}

export default function StandardPageHeader({
    title,
    subtitle,
    icon = '📦',
    warehouseName,
    userName,
    userRole
}: StandardPageHeaderProps) {
    const isMobile = useMediaQuery('(max-width:600px)');

    return (
        <Box sx={{
            background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
            color: 'white',
            px: 2,
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: { xs: 0.75, sm: 1 },
            borderRadius: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            flexShrink: 0
        }}>
            {/* LEFT: Icon + Title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1.25 } }}>
                <Box sx={{
                    p: { xs: 0.4, sm: 0.7 },
                    bgcolor: 'rgba(255,255,255,0.2)',
                    borderRadius: 1.5,
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Typography sx={{ fontSize: { xs: '1rem', sm: '1.5rem' }, lineHeight: 1 }}>{icon}</Typography>
                </Box>
                <Box>
                    <Typography variant="h4" sx={{
                        fontWeight: 650,
                        color: 'white',
                        fontSize: { xs: '0.85rem', sm: '1rem', md: '1.3rem' },
                        lineHeight: 1.1,
                        textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                        {title}
                    </Typography>
                    {subtitle && (
                        <Typography variant="caption" sx={{
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: { xs: '0.5rem', sm: '0.7rem' },
                            fontWeight: 500,
                            lineHeight: 1.2,
                            display: 'block',
                            mt: 0.25
                        }}>
                            {subtitle}
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* RIGHT: Warehouse + User Chips */}
            <Stack direction="row" spacing={{ xs: 0.5, sm: 0.75 }} alignItems="center">
                {warehouseName && (
                    <Chip
                        label={warehouseName}
                        size="small"
                        sx={{
                            bgcolor: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            fontWeight: 700,
                            height: { xs: 20, sm: 24 },
                            fontSize: { xs: '0.42rem', sm: '0.72rem' },
                            border: '1.5px solid rgba(255,255,255,0.3)',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            '& .MuiChip-label': { px: { xs: 0.75, sm: 1 } }
                        }}
                    />
                )}
                {userName && (
                    <Chip
                        label={userName}
                        size="small"
                        avatar={<Box sx={{
                            bgcolor: 'rgba(255,255,255,0.3)',
                            width: { xs: 14, sm: 16 },
                            height: { xs: 14, sm: 16 },
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: { xs: '0.55rem', sm: '0.6rem' }
                        }}>👤</Box>}
                        sx={{
                            bgcolor: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            fontWeight: 600,
                            height: { xs: 20, sm: 24 },
                            fontSize: { xs: '0.62rem', sm: '0.72rem' },
                            border: '1.5px solid rgba(255,255,255,0.3)',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            '& .MuiChip-label': { px: { xs: 0.75, sm: 1 } },
                            '& .MuiChip-avatar': {
                                width: { xs: 14, sm: 16 },
                                height: { xs: 14, sm: 16 },
                                ml: { xs: 0.5, sm: 0.75 }
                            }
                        }}
                    />
                )}
            </Stack>
        </Box>
    );
}
