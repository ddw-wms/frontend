// File: components/StandardPageLayout.tsx
// Standardized page layout component for consistency across all pages
import React from 'react';
import { Box, Paper, Stack, TextField, Button, CircularProgress, Typography, InputAdornment } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

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
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Header with Title */}
            <Paper elevation={0} sx={{ p: { xs: 1, sm: 1.5 }, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, color: '#1565c0' }}>
                    {title}
                </Typography>
            </Paper>

            {/* Quick Search + Action Buttons Row */}
            <Paper elevation={0} sx={{ p: { xs: 0.5, sm: 0.75 }, borderBottom: '2px solid #e0e0e0', bgcolor: '#fafafa' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.5} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ gap: 0.5 }}>
                    {/* Search Field */}
                    {onSearchChange && (
                        <TextField
                            size="small"
                            placeholder="🔍 Search..."
                            value={searchValue}
                            onChange={(e) => onSearchChange(e.target.value)}
                            sx={{
                                flex: { xs: 1, sm: 1 },
                                minWidth: { xs: '100%', sm: '250px' },
                                '& .MuiInputBase-root': { height: 32 },
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 0.5,
                                    fontSize: '0.85rem',
                                    '&:hover fieldset': { borderColor: '#1976d2' }
                                }
                            }}
                            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: '#1976d2' }} /></InputAdornment> }}
                        />
                    )}

                    {/* Spacer */}
                    <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />

                    {/* Action Buttons */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.4} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ gap: 0.4 }}>
                        {actionButtons}

                        {/* Toggle Advanced Filters Button */}
                        {onToggleFilters && (
                            <Button
                                size="small"
                                variant={showAdvancedFilters ? "contained" : "outlined"}
                                onClick={onToggleFilters}
                                sx={{ height: 32, fontSize: '0.8rem', whiteSpace: 'nowrap', padding: '4px 12px' }}
                            >
                                {showAdvancedFilters ? '⬆ Filters' : '⬇ Filters'}
                            </Button>
                        )}
                    </Stack>
                </Stack>
            </Paper>

            {/* Advanced Filters - Collapsible */}
            {showAdvancedFilters && advancedFilters && (
                <Paper elevation={0} sx={{ p: { xs: 0.5, sm: 0.75 }, borderBottom: '1px solid #e0e0e0', bgcolor: '#f9f9f9' }}>
                    {advancedFilters}
                </Paper>
            )}

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
