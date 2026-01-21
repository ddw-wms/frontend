'use client';

import React from 'react';
import {
    Box,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Chip,
    Stack,
    IconButton,
    Tooltip,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
    Inventory2 as BatchIcon,
} from '@mui/icons-material';

// Standard date formatter
const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = months[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${day}-${mon}-${yyyy}`;
};

// Format number with commas
const formatNumber = (value: any): string => {
    if (value === null || value === undefined || value === '') return '-';
    try {
        const num = parseInt(value);
        if (isNaN(num)) return String(value);
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    } catch {
        return String(value);
    }
};

export interface BatchData {
    batch_id: string;
    count: number;
    created_at?: string;
    last_updated?: string;
    lastupdated_display?: string;
}

interface BatchManagementTabProps {
    batches: BatchData[];
    loading: boolean;
    onRefresh: () => void;
    onDelete?: (batchId: string) => void;
    onView?: (batchId: string) => void;
    canDelete?: boolean;
    canView?: boolean;
    title?: string;
    emptyMessage?: string;
    emptySubMessage?: string;
}

export default function BatchManagementTab({
    batches,
    loading,
    onRefresh,
    onDelete,
    onView,
    canDelete = true,
    canView = false,
    title = 'Batch Management',
    emptyMessage = 'No batches found',
    emptySubMessage = 'Batches will appear here after bulk uploads',
}: BatchManagementTabProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isDarkMode = theme.palette.mode === 'dark';

    // Get date from batch (handles different field names)
    const getBatchDate = (batch: BatchData) => {
        return batch.lastupdated_display || formatDate(batch.last_updated || batch.created_at);
    };

    // Calculate total items properly (ensure numeric addition)
    const totalItems = batches.reduce((sum, b) => sum + (parseInt(String(b.count)) || 0), 0);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 1 }}>
            {/* Compact Header */}
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{
                    mb: 1,
                    pb: 1,
                    borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1}>
                    <BatchIcon sx={{ color: isDarkMode ? '#60a5fa' : '#2563eb', fontSize: 20 }} />
                    <Typography sx={{ fontWeight: 700, color: isDarkMode ? '#f1f5f9' : '#1e293b', fontSize: '0.9rem' }}>
                        {title}
                    </Typography>
                    {batches.length > 0 && (
                        <Chip
                            label={batches.length}
                            size="small"
                            sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.15)' : '#dbeafe',
                                color: isDarkMode ? '#60a5fa' : '#2563eb',
                            }}
                        />
                    )}
                </Stack>
                <Button
                    size="small"
                    startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                    onClick={onRefresh}
                    sx={{
                        height: 28,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        color: isDarkMode ? '#60a5fa' : '#2563eb',
                        '&:hover': { bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.1)' : '#eff6ff' },
                    }}
                >
                    Refresh
                </Button>
            </Stack>

            {/* Compact Table */}
            <Box
                sx={{
                    flex: 1,
                    overflow: 'hidden',
                    borderRadius: 1,
                    border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
                    bgcolor: isDarkMode ? '#1e293b' : '#fff',
                }}
            >
                <TableContainer sx={{ maxHeight: 'calc(100vh - 280px)' }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                {['Batch ID', 'Count', ...(isMobile ? [] : ['Last Updated']), 'Actions'].map((header, i) => (
                                    <TableCell
                                        key={header}
                                        align={header === 'Count' || header === 'Actions' ? (header === 'Actions' ? 'right' : 'center') : 'left'}
                                        sx={{
                                            bgcolor: isDarkMode ? '#334155' : '#f8fafc',
                                            color: isDarkMode ? '#94a3b8' : '#64748b',
                                            fontWeight: 600,
                                            fontSize: '0.7rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            py: 1,
                                            borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
                                        }}
                                    >
                                        {header}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={isMobile ? 3 : 4} align="center" sx={{ py: 4 }}>
                                        <CircularProgress size={24} sx={{ color: isDarkMode ? '#60a5fa' : '#2563eb' }} />
                                        <Typography sx={{ mt: 1, fontSize: '0.75rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                            Loading...
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : batches.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={isMobile ? 3 : 4} align="center" sx={{ py: 4 }}>
                                        <BatchIcon sx={{ fontSize: 36, color: isDarkMode ? '#475569' : '#cbd5e1', mb: 0.5 }} />
                                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                                            {emptyMessage}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#475569' : '#cbd5e1' }}>
                                            {emptySubMessage}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                batches.map((batch, idx) => (
                                    <TableRow
                                        key={batch.batch_id}
                                        sx={{
                                            bgcolor: isDarkMode
                                                ? idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
                                                : idx % 2 === 0 ? 'transparent' : '#fafafa',
                                            '&:hover': { bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.08)' : '#f0f9ff' },
                                            '& td': {
                                                py: 0.75,
                                                borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f1f5f9',
                                            },
                                        }}
                                    >
                                        <TableCell>
                                            <Typography
                                                sx={{
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    color: isDarkMode ? '#60a5fa' : '#2563eb',
                                                    bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.1)' : '#eff6ff',
                                                    px: 1,
                                                    py: 0.25,
                                                    borderRadius: 0.5,
                                                    display: 'inline-block',
                                                    maxWidth: 200,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {batch.batch_id}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={formatNumber(batch.count)}
                                                size="small"
                                                sx={{
                                                    height: 22,
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    bgcolor: isDarkMode ? 'rgba(34, 197, 94, 0.12)' : '#f0fdf4',
                                                    color: isDarkMode ? '#4ade80' : '#16a34a',
                                                    border: isDarkMode ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid #bbf7d0',
                                                }}
                                            />
                                        </TableCell>
                                        {!isMobile && (
                                            <TableCell>
                                                <Typography sx={{ fontSize: '0.72rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                                    {getBatchDate(batch)}
                                                </Typography>
                                            </TableCell>
                                        )}
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                {canView && onView && (
                                                    <Tooltip title="View" arrow placement="top">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => onView(batch.batch_id)}
                                                            sx={{
                                                                width: 26,
                                                                height: 26,
                                                                bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.1)' : '#eff6ff',
                                                                color: isDarkMode ? '#60a5fa' : '#2563eb',
                                                                '&:hover': { bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.2)' : '#dbeafe' },
                                                            }}
                                                        >
                                                            <VisibilityIcon sx={{ fontSize: 14 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                {canDelete && onDelete && (
                                                    <Tooltip title="Delete" arrow placement="top">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => onDelete(batch.batch_id)}
                                                            sx={{
                                                                width: 26,
                                                                height: 26,
                                                                bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                                                                color: '#ef4444',
                                                                '&:hover': { bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' },
                                                            }}
                                                        >
                                                            <DeleteIcon sx={{ fontSize: 14 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>

            {/* Compact Footer Stats */}
            {batches.length > 0 && (
                <Box
                    sx={{
                        mt: 1,
                        py: 0.75,
                        px: 1.5,
                        bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.05)' : '#f8fafc',
                        borderRadius: 1,
                        border: isDarkMode ? '1px solid rgba(96, 165, 250, 0.1)' : '1px solid #e5e7eb',
                    }}
                >
                    <Stack direction="row" spacing={3} justifyContent="center" alignItems="center">
                        <Typography sx={{ fontSize: '0.72rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                            📊 Batches: <strong style={{ color: isDarkMode ? '#60a5fa' : '#2563eb' }}>{batches.length}</strong>
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                            📦 Total Items: <strong style={{ color: isDarkMode ? '#4ade80' : '#16a34a' }}>{formatNumber(totalItems)}</strong>
                        </Typography>
                    </Stack>
                </Box>
            )}
        </Box>
    );
}
