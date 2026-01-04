'use client';
import React from 'react';
import {
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    MenuItem,
    Collapse,
    IconButton,
    Tooltip,
    Stack
} from '@mui/material';
import {
    FilterList as FilterListIcon,
    ExpandMore as ExpandMoreIcon,
    RestartAlt as RestartAltIcon
} from '@mui/icons-material';

export interface FilterOption {
    label: string;
    value: string;
    options?: { label: string; value: string }[];
    type?: 'select' | 'text' | 'date';
    onChange: (value: string) => void;
    currentValue: string;
}

interface StandardFilterBarProps {
    searchValue: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;
    filters: FilterOption[];
    onReset: () => void;
    filtersExpanded?: boolean;
    onToggleFilters?: () => void;
    filtersActive?: boolean;
    mobileActionButton?: React.ReactNode;
}

export default function StandardFilterBar({
    searchValue,
    onSearchChange,
    searchPlaceholder = '🔍 Search...',
    filters,
    onReset,
    filtersExpanded = false,
    onToggleFilters,
    filtersActive = false,
    mobileActionButton
}: StandardFilterBarProps) {
    return (
        <Card sx={{
            mb: { xs: 0, md: 1 },
            borderRadius: 1.5,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            background: 'rgba(255, 255, 255, 0.98)'
        }}>
            <CardContent sx={{ p: { xs: 1, md: 1.5 }, '&:last-child': { pb: { xs: 1, md: 1.5 } } }}>
                <Stack spacing={1}>
                    {/* Search + Mobile Actions */}
                    <Box sx={{
                        display: 'flex',
                        gap: 0.75,
                        alignItems: 'center',
                        width: '100%'
                    }}>
                        <TextField
                            size="small"
                            placeholder={searchPlaceholder}
                            value={searchValue}
                            onChange={(e) => onSearchChange(e.target.value)}
                            sx={{
                                flex: '1 1 auto',
                                flexGrow: 1,
                                minWidth: 0,
                                '& .MuiOutlinedInput-root': {
                                    height: 40,
                                    bgcolor: 'white',
                                    borderRadius: 1.5,
                                    '&:hover': {
                                        bgcolor: '#f9fafb'
                                    }
                                }
                            }}
                        />

                        {/* Mobile Action Button */}
                        {mobileActionButton && (
                            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                                {mobileActionButton}
                            </Box>
                        )}

                        {/* Desktop Filter Toggle */}
                        {onToggleFilters && (
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={onToggleFilters}
                                startIcon={<FilterListIcon />}
                                endIcon={<ExpandMoreIcon sx={{
                                    transform: filtersExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 200ms'
                                }} />}
                                sx={{
                                    display: { xs: 'none', md: 'inline-flex' },
                                    height: 40,
                                    px: 2,
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    borderWidth: 2,
                                    position: 'relative',
                                    '&:hover': {
                                        borderWidth: 2
                                    }
                                }}
                            >
                                Filters
                                {filtersActive && (
                                    <Box sx={{
                                        position: 'absolute',
                                        top: -4,
                                        right: -4,
                                        width: 10,
                                        height: 10,
                                        borderRadius: '50%',
                                        bgcolor: '#10b981',
                                        border: '2px solid white'
                                    }} />
                                )}
                            </Button>
                        )}

                        {/* Reset Button */}
                        <Tooltip title="Reset Filters" arrow>
                            <IconButton
                                onClick={onReset}
                                size="small"
                                sx={{
                                    display: { xs: 'none', md: 'inline-flex' },
                                    bgcolor: 'rgba(239, 68, 68, 0.1)',
                                    color: '#ef4444',
                                    '&:hover': {
                                        bgcolor: 'rgba(239, 68, 68, 0.2)'
                                    }
                                }}
                            >
                                <RestartAltIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    {/* Desktop Filters */}
                    <Collapse in={filtersExpanded} timeout={300}>
                        <Box sx={{
                            display: { xs: 'none', md: 'flex' },
                            gap: 1,
                            flexWrap: 'wrap',
                            pt: 0.5
                        }}>
                            {filters.map((filter, index) => (
                                <TextField
                                    key={index}
                                    select={filter.type === 'select'}
                                    type={filter.type === 'date' ? 'date' : 'text'}
                                    size="small"
                                    label={filter.label}
                                    value={filter.currentValue}
                                    onChange={(e) => filter.onChange(e.target.value)}
                                    sx={{
                                        minWidth: 150,
                                        '& .MuiOutlinedInput-root': {
                                            height: 40,
                                            bgcolor: 'white',
                                            borderRadius: 1.5
                                        }
                                    }}
                                    InputLabelProps={filter.type === 'date' ? { shrink: true } : undefined}
                                >
                                    {filter.type === 'select' && filter.options && (
                                        <>
                                            <MenuItem value="">All {filter.label}</MenuItem>
                                            {filter.options.map((opt) => (
                                                <MenuItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </MenuItem>
                                            ))}
                                        </>
                                    )}
                                </TextField>
                            ))}
                        </Box>
                    </Collapse>
                </Stack>
            </CardContent>
        </Card>
    );
}
