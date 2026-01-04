// File: components/StandardPageLayout.tsx
// Standardized page layout component for consistency across all pages
import React from 'react';
import { Box, Paper, Stack, TextField, Button, CircularProgress, Typography, InputAdornment, useTheme, useMediaQuery, Collapse } from '@mui/material';
import { Search as SearchIcon, FilterList as FilterListIcon } from '@mui/icons-material';

export interface FilterField {
    id: string;
    label: string;
    type: 'text' | 'select' | 'date';
    value: any;
    onChange: (value: any) => void;
    options?: Array<{ label: string; value: any }>;
}

interface StandardPageLayoutProps {
    children: React.ReactNode;
    title: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    showAdvancedFilters?: boolean;
    onToggleFilters?: () => void;
    advancedFilters?: React.ReactNode;
    actionButtons?: React.ReactNode;
    loading?: boolean;
}

export const StandardPageLayout: React.FC<StandardPageLayoutProps> = ({
    children,
    title,
    searchValue = '',
    onSearchChange,
    showAdvancedFilters = false,
    onToggleFilters,
    advancedFilters,
    actionButtons,
    loading = false,
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', height: '100%' }}>
            {/* Header with Title */}
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 1.5, sm: 2, md: 2.5 },
                    bgcolor: 'background.paper',
                    borderBottom: '2px solid',
                    borderColor: 'primary.main',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                }}
            >
                <Typography
                    variant={isMobile ? 'h6' : 'h5'}
                    sx={{
                        fontWeight: 700,
                        color: 'primary.main',
                        letterSpacing: '-0.02em'
                    }}
                >
                    {title}
                </Typography>
            </Paper>

            {/* Quick Search + Action Buttons Row */}
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 1, sm: 1.5 },
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'grey.50',
                }}
            >
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 1, sm: 1.5 }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                >
                    {/* Search Field */}
                    {onSearchChange && (
                        <TextField
                            size="small"
                            placeholder="Search..."
                            value={searchValue}
                            onChange={(e) => onSearchChange(e.target.value)}
                            fullWidth={isMobile}
                            sx={{
                                minWidth: { xs: '100%', sm: '280px', md: '350px' },
                                maxWidth: { sm: '400px' },
                                '& .MuiInputBase-root': {
                                    height: { xs: 40, sm: 42 },
                                    bgcolor: 'background.paper',
                                },
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" color="primary" />
                                    </InputAdornment>
                                )
                            }}
                        />
                    )}

                    {/* Spacer */}
                    <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />

                    {/* Action Buttons */}
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={{ xs: 1, sm: 1 }}
                        alignItems={{ xs: 'stretch', sm: 'center' }}
                    >
                        {actionButtons}

                        {/* Toggle Advanced Filters Button */}
                        {onToggleFilters && (
                            <Button
                                size={isMobile ? 'medium' : 'small'}
                                variant={showAdvancedFilters ? "contained" : "outlined"}
                                onClick={onToggleFilters}
                                startIcon={<FilterListIcon />}
                                fullWidth={isMobile}
                                sx={{
                                    minHeight: { xs: 40, sm: 36 },
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {showAdvancedFilters ? 'Hide Filters' : 'Show Filters'}
                            </Button>
                        )}
                    </Stack>
                </Stack>
            </Paper>

            {/* Advanced Filters - Collapsible */}
            <Collapse in={showAdvancedFilters} timeout="auto">
                {advancedFilters && (
                    <Paper
                        elevation={0}
                        sx={{
                            p: { xs: 1.5, sm: 2 },
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'grey.100',
                        }}
                    >
                        {advancedFilters}
                    </Paper>
                )}
            </Collapse>

            {/* Content Area */}
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {loading && (
                    <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(255,255,255,0.65)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(0.5px)', opacity: 1, transition: 'opacity 0.2s ease-in-out' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8 }}>
                            <CircularProgress size={36} thickness={4} />
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500 }}>Loading...</Typography>
                        </Box>
                    </Box>
                )}
                {children}
            </Box>
        </Box>
    );
};

export default StandardPageLayout;
