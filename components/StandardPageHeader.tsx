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
    const isMobile = useMediaQuery('(max-width:640px)');
    const isTablet = useMediaQuery('(max-width:900px)');
    const isVerySmall = useMediaQuery('(max-width:400px)');

    return (
        <Box sx={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1e40af 100%)',
            color: 'white',
            px: { xs: 1, sm: 2.5, md: 3 },
            py: { xs: 0.5, sm: 1.25, md: 1.5 },
            pl: { xs: '48px', sm: 2.5, md: 3 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: { xs: 0.5, sm: 1.5 },
            borderRadius: 0,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            flexShrink: 0,
            mb: 0,
            minHeight: { xs: 42, sm: 56, md: 64 },
            // Subtle gradient overlay for depth
            '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)',
                pointerEvents: 'none',
            },
        }}>
            {/* LEFT: Icon + Title */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 0.5, sm: 1.5 },
                position: 'relative',
                zIndex: 1,
            }}>
                <Box sx={{
                    p: { xs: 0.5, sm: 1 },
                    bgcolor: 'rgba(255,255,255,0.15)',
                    borderRadius: { xs: 1, sm: 2 },
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <Typography sx={{
                        fontSize: { xs: '0.875rem', sm: '1.375rem', md: '1.5rem' },
                        lineHeight: 1,
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
                    }}>
                        {icon}
                    </Typography>
                </Box>
                <Box>
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 700,
                            color: 'white',
                            fontSize: { xs: '0.8125rem', sm: '1.125rem', md: '1.375rem' },
                            lineHeight: 1.2,
                            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            letterSpacing: '-0.01em',
                        }}
                    >
                        {isVerySmall && title.length > 15 ? title.slice(0, 15) + '…' : title}
                    </Typography>
                    {subtitle && !isMobile && (
                        <Typography
                            variant="caption"
                            sx={{
                                color: 'rgba(255,255,255,0.8)',
                                fontSize: { xs: '0.625rem', sm: '0.75rem' },
                                fontWeight: 500,
                                lineHeight: 1.3,
                                display: 'block',
                                mt: 0.25,
                            }}
                        >
                            {subtitle}
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* RIGHT: Warehouse + User Chips */}
            <Stack
                direction="row"
                spacing={{ xs: 0.5, sm: 1 }}
                alignItems="center"
                sx={{ position: 'relative', zIndex: 1 }}
            >
                {warehouseName && !isVerySmall && (
                    <Chip
                        label={isMobile && warehouseName.length > 8 ? warehouseName.slice(0, 8) + '…' : warehouseName}
                        size="small"
                        sx={{
                            bgcolor: 'rgba(255,255,255,0.15)',
                            color: 'white',
                            fontWeight: 700,
                            height: { xs: 20, sm: 28 },
                            fontSize: { xs: '0.5625rem', sm: '0.75rem' },
                            border: '1px solid rgba(255,255,255,0.2)',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s ease',
                            '& .MuiChip-label': {
                                px: { xs: 0.5, sm: 1.25 }
                            },
                            '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.2)',
                            },
                        }}
                    />
                )}
                {userName && (
                    <Chip
                        label={isMobile && userName.length > 6 ? userName.slice(0, 6) + '…' : userName}
                        size="small"
                        avatar={
                            <Box sx={{
                                bgcolor: 'rgba(255,255,255,0.25)',
                                width: { xs: 14, sm: 20 },
                                height: { xs: 14, sm: 20 },
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: { xs: '0.5rem', sm: '0.6875rem' },
                                ml: '4px !important',
                            }}>
                                👤
                            </Box>
                        }
                        sx={{
                            bgcolor: 'rgba(255,255,255,0.15)',
                            color: 'white',
                            fontWeight: 600,
                            height: { xs: 20, sm: 28 },
                            fontSize: { xs: '0.5625rem', sm: '0.75rem' },
                            border: '1px solid rgba(255,255,255,0.2)',
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s ease',
                            '& .MuiChip-label': {
                                px: { xs: 0.5, sm: 1 }
                            },
                            '& .MuiChip-avatar': {
                                width: { xs: 14, sm: 20 },
                                height: { xs: 14, sm: 20 },
                            },
                            '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.2)',
                            },
                        }}
                    />
                )}
            </Stack>
        </Box>
    );
}
