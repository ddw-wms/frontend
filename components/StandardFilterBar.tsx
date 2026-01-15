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
    Stack,
    InputAdornment,
    useTheme
} from '@mui/material';
import {
    FilterList as FilterListIcon,
    ExpandMore as ExpandMoreIcon,
    RestartAlt as RestartAltIcon,
    Search as SearchIcon
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
    searchPlaceholder = 'Search...',
    filters,
    onReset,
    filtersExpanded = false,
    onToggleFilters,
    filtersActive = false,
    mobileActionButton
}: StandardFilterBarProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    return (
        <Card sx={{
            mb: { xs: 0, md: 1.5 },
            borderRadius: { xs: 0, md: 3 },
            boxShadow: { xs: 'none', md: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.05), 0 4px 6px rgba(0,0,0,0.03)' },
            background: isDarkMode ? '#1e293b' : 'white',
            border: { xs: 'none', md: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.04)' },
            borderBottom: { xs: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)', md: 'none' },
        }}>
            <CardContent sx={{
                p: { xs: 1.25, sm: 1.5, md: 2 },
                '&:last-child': { pb: { xs: 1.25, sm: 1.5, md: 2 } }
            }}>
                <Stack spacing={{ xs: 1, md: 1.5 }}>
                    {/* Search + Mobile Actions */}
                    <Box sx={{
                        display: 'flex',
                        gap: { xs: 0.75, sm: 1 },
                        alignItems: 'center',
                        width: '100%'
                    }}>
                        <TextField
                            size="small"
                            placeholder={searchPlaceholder}
                            value={searchValue}
                            onChange={(e) => onSearchChange(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                flex: '1 1 auto',
                                flexGrow: 1,
                                minWidth: 0,
                                '& .MuiOutlinedInput-root': {
                                    height: { xs: 44, sm: 42 },
                                    bgcolor: { xs: '#f8fafc', md: 'white' },
                                    borderRadius: 2.5,
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        bgcolor: '#f8fafc',
                                    },
                                    '&.Mui-focused': {
                                        bgcolor: 'white',
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'primary.main',
                                            borderWidth: 2,
                                        },
                                    },
                                },
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(0,0,0,0.08)',
                                },
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
                                variant={filtersExpanded ? "contained" : "outlined"}
                                size="small"
                                onClick={onToggleFilters}
                                startIcon={<FilterListIcon />}
                                endIcon={
                                    <ExpandMoreIcon sx={{
                                        transform: filtersExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s ease'
                                    }} />
                                }
                                sx={{
                                    display: { xs: 'none', md: 'inline-flex' },
                                    height: 42,
                                    px: 2.5,
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    borderRadius: 2.5,
                                    position: 'relative',
                                    minWidth: 110,
                                    ...(filtersExpanded ? {
                                        background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                                    } : {
                                        borderWidth: 1.5,
                                        '&:hover': {
                                            borderWidth: 1.5,
                                            bgcolor: 'rgba(30, 64, 175, 0.04)',
                                        },
                                    }),
                                }}
                            >
                                Filters
                                {filtersActive && (
                                    <Box sx={{
                                        position: 'absolute',
                                        top: -4,
                                        right: -4,
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        bgcolor: '#10b981',
                                        border: '2px solid white',
                                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
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
                                    width: 42,
                                    height: 42,
                                    bgcolor: 'rgba(239, 68, 68, 0.08)',
                                    color: '#dc2626',
                                    borderRadius: 2.5,
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        bgcolor: 'rgba(239, 68, 68, 0.15)',
                                        transform: 'scale(1.05)',
                                    }
                                }}
                            >
                                <RestartAltIcon sx={{ fontSize: 20 }} />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    {/* Desktop Filters */}
                    <Collapse in={filtersExpanded} timeout={250}>
                        <Box sx={{
                            display: { xs: 'none', md: 'flex' },
                            gap: 1.5,
                            flexWrap: 'wrap',
                            pt: 1,
                            pb: 0.5,
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
                                        minWidth: 160,
                                        '& .MuiOutlinedInput-root': {
                                            height: 42,
                                            bgcolor: '#f8fafc',
                                            borderRadius: 2,
                                            transition: 'all 0.2s ease',
                                            '&:hover': {
                                                bgcolor: '#f1f5f9',
                                            },
                                            '&.Mui-focused': {
                                                bgcolor: 'white',
                                            },
                                        },
                                        '& .MuiInputLabel-root': {
                                            fontWeight: 500,
                                        },
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
