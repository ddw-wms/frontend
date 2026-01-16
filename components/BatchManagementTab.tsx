'use client';

import React from 'react';
import {
    Box,
    Paper,
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
    Card,
    CardContent,
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
    const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
    const isDarkMode = theme.palette.mode === 'dark';

    // Get date from batch (handles different field names)
    const getBatchDate = (batch: BatchData) => {
        return batch.lastupdated_display || formatDate(batch.last_updated || batch.created_at);
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                p: { xs: 0.5, sm: 1, md: 1.5 },
                overflow: 'auto',
            }}
        >
            <Card
                sx={{
                    borderRadius: { xs: 1, sm: 1.5, md: 2 },
                    boxShadow: isDarkMode
                        ? '0 4px 20px rgba(0,0,0,0.4)'
                        : '0 4px 20px rgba(0,0,0,0.08)',
                    background: isDarkMode
                        ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                        : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: isDarkMode
                        ? '1px solid rgba(255,255,255,0.1)'
                        : '1px solid #e2e8f0',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                }}
            >
                <CardContent
                    sx={{
                        p: { xs: 1.5, sm: 2, md: 2.5 },
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                        '&:last-child': { pb: { xs: 1.5, sm: 2, md: 2.5 } },
                    }}
                >
                    {/* Header Section */}
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        spacing={{ xs: 1, sm: 0 }}
                        sx={{ mb: { xs: 1.5, sm: 2, md: 2.5 } }}
                    >
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 800,
                                color: isDarkMode ? '#f1f5f9' : '#1e293b',
                                fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                            }}
                        >
                            <BatchIcon sx={{ color: isDarkMode ? '#60a5fa' : '#1e40af', fontSize: { xs: 20, sm: 22, md: 24 } }} />
                            {title}
                            {batches.length > 0 && (
                                <Chip
                                    label={batches.length}
                                    size="small"
                                    sx={{
                                        ml: 1,
                                        bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.2)' : 'rgba(30, 64, 175, 0.1)',
                                        color: isDarkMode ? '#60a5fa' : '#1e40af',
                                        fontWeight: 700,
                                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                        height: { xs: 20, sm: 22, md: 24 },
                                    }}
                                />
                            )}
                        </Typography>

                        <Button
                            size={isMobile ? 'small' : 'medium'}
                            startIcon={<RefreshIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />}
                            onClick={onRefresh}
                            variant="outlined"
                            sx={{
                                height: { xs: 32, sm: 36, md: 40 },
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                borderColor: isDarkMode ? 'rgba(96, 165, 250, 0.5)' : '#1e40af',
                                color: isDarkMode ? '#60a5fa' : '#1e40af',
                                '&:hover': {
                                    borderColor: isDarkMode ? '#60a5fa' : '#1e3a8a',
                                    bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.1)' : 'rgba(30, 64, 175, 0.05)',
                                },
                            }}
                        >
                            Refresh
                        </Button>
                    </Stack>

                    {/* Table Container */}
                    <Box
                        sx={{
                            flex: 1,
                            border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                            borderRadius: { xs: 1, sm: 1.5 },
                            overflow: 'hidden',
                            background: isDarkMode ? '#1e293b' : 'white',
                            boxShadow: isDarkMode ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
                            minHeight: 0,
                        }}
                    >
                        <TableContainer sx={{ height: '100%', maxHeight: { xs: 'calc(100vh - 280px)', sm: 'calc(100vh - 260px)', md: 'calc(100vh - 240px)' } }}>
                            <Table stickyHeader size={isMobile ? 'small' : 'medium'}>
                                <TableHead>
                                    <TableRow
                                        sx={{
                                            '& th': {
                                                background: isDarkMode
                                                    ? 'linear-gradient(135deg, #334155 0%, #475569 100%)'
                                                    : 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                                                color: 'white',
                                                fontWeight: 800,
                                                fontSize: { xs: '0.65rem', sm: '0.72rem', md: '0.8rem' },
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                py: { xs: 1, sm: 1.25, md: 1.5 },
                                                px: { xs: 1, sm: 1.5, md: 2 },
                                                borderBottom: 'none',
                                                whiteSpace: 'nowrap',
                                                '&:first-of-type': {
                                                    borderTopLeftRadius: { xs: 4, sm: 6 },
                                                },
                                                '&:last-of-type': {
                                                    borderTopRightRadius: { xs: 4, sm: 6 },
                                                },
                                            },
                                        }}
                                    >
                                        <TableCell>Batch ID</TableCell>
                                        <TableCell align="center">Count</TableCell>
                                        {!isMobile && <TableCell>Last Updated</TableCell>}
                                        <TableCell align="center">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={isMobile ? 3 : 4} align="center" sx={{ py: { xs: 4, sm: 6, md: 8 } }}>
                                                <CircularProgress
                                                    size={isMobile ? 32 : 48}
                                                    sx={{ color: isDarkMode ? '#60a5fa' : '#1e40af' }}
                                                />
                                                <Typography
                                                    sx={{
                                                        mt: 1.5,
                                                        fontWeight: 600,
                                                        color: isDarkMode ? '#94a3b8' : '#64748b',
                                                        fontSize: { xs: '0.75rem', sm: '0.85rem' },
                                                    }}
                                                >
                                                    Loading batches...
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : batches.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={isMobile ? 3 : 4} align="center" sx={{ py: { xs: 4, sm: 6, md: 8 } }}>
                                                <BatchIcon
                                                    sx={{
                                                        fontSize: { xs: 40, sm: 50, md: 60 },
                                                        color: isDarkMode ? '#475569' : '#cbd5e1',
                                                        mb: 1,
                                                    }}
                                                />
                                                <Typography
                                                    sx={{
                                                        fontWeight: 700,
                                                        color: isDarkMode ? '#64748b' : '#94a3b8',
                                                        fontSize: { xs: '0.85rem', sm: '1rem' },
                                                    }}
                                                >
                                                    📭 {emptyMessage}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: isDarkMode ? '#475569' : '#cbd5e1',
                                                        mt: 0.5,
                                                        display: 'block',
                                                        fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                                    }}
                                                >
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
                                                        ? idx % 2 === 0 ? '#1e293b' : '#263545'
                                                        : idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                                                    transition: 'all 0.2s ease',
                                                    '&:hover': {
                                                        bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.1)' : '#f1f5f9',
                                                        transform: 'scale(1.001)',
                                                    },
                                                    '& td': {
                                                        py: { xs: 0.75, sm: 1, md: 1.25 },
                                                        px: { xs: 1, sm: 1.5, md: 2 },
                                                        fontSize: { xs: '0.72rem', sm: '0.78rem', md: '0.85rem' },
                                                        color: isDarkMode ? '#e2e8f0' : '#334155',
                                                        borderBottom: isDarkMode
                                                            ? '1px solid rgba(255,255,255,0.05)'
                                                            : '1px solid #f1f5f9',
                                                    },
                                                }}
                                            >
                                                {/* Batch ID */}
                                                <TableCell>
                                                    <Chip
                                                        label={batch.batch_id}
                                                        size="small"
                                                        sx={{
                                                            fontWeight: 700,
                                                            fontFamily: 'monospace',
                                                            bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.15)' : '#dbeafe',
                                                            color: isDarkMode ? '#60a5fa' : '#1e40af',
                                                            fontSize: { xs: '0.65rem', sm: '0.72rem', md: '0.78rem' },
                                                            height: { xs: 22, sm: 26, md: 28 },
                                                            maxWidth: { xs: 100, sm: 140, md: 'none' },
                                                            '& .MuiChip-label': {
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                            },
                                                        }}
                                                    />
                                                </TableCell>

                                                {/* Count */}
                                                <TableCell align="center">
                                                    <Chip
                                                        label={`${formatNumber(batch.count)} items`}
                                                        size="small"
                                                        sx={{
                                                            fontWeight: 700,
                                                            bgcolor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)',
                                                            color: isDarkMode ? '#4ade80' : '#16a34a',
                                                            fontSize: { xs: '0.62rem', sm: '0.68rem', md: '0.72rem' },
                                                            height: { xs: 20, sm: 24, md: 26 },
                                                        }}
                                                    />
                                                </TableCell>

                                                {/* Date - Hidden on mobile */}
                                                {!isMobile && (
                                                    <TableCell>
                                                        <Typography
                                                            sx={{
                                                                fontSize: { sm: '0.72rem', md: '0.78rem' },
                                                                color: isDarkMode ? '#94a3b8' : '#64748b',
                                                                fontWeight: 500,
                                                            }}
                                                        >
                                                            {getBatchDate(batch)}
                                                        </Typography>
                                                    </TableCell>
                                                )}

                                                {/* Actions */}
                                                <TableCell align="center">
                                                    <Stack
                                                        direction="row"
                                                        spacing={{ xs: 0.5, sm: 0.75 }}
                                                        justifyContent="center"
                                                        flexWrap="wrap"
                                                    >
                                                        {/* View Button */}
                                                        {canView && onView && (
                                                            isMobile ? (
                                                                <Tooltip title="View Batch" arrow>
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => onView(batch.batch_id)}
                                                                        sx={{
                                                                            bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.15)' : '#dbeafe',
                                                                            color: isDarkMode ? '#60a5fa' : '#1e40af',
                                                                            '&:hover': {
                                                                                bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.25)' : '#bfdbfe',
                                                                            },
                                                                            width: { xs: 28, sm: 32 },
                                                                            height: { xs: 28, sm: 32 },
                                                                        }}
                                                                    >
                                                                        <VisibilityIcon sx={{ fontSize: { xs: 14, sm: 16 } }} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            ) : (
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    startIcon={<VisibilityIcon sx={{ fontSize: 14 }} />}
                                                                    onClick={() => onView(batch.batch_id)}
                                                                    sx={{
                                                                        height: { sm: 28, md: 32 },
                                                                        fontSize: { sm: '0.65rem', md: '0.7rem' },
                                                                        fontWeight: 600,
                                                                        textTransform: 'uppercase',
                                                                        borderColor: isDarkMode ? 'rgba(96, 165, 250, 0.5)' : '#1e40af',
                                                                        color: isDarkMode ? '#60a5fa' : '#1e40af',
                                                                        minWidth: { sm: 60, md: 70 },
                                                                        '&:hover': {
                                                                            borderColor: isDarkMode ? '#60a5fa' : '#1e3a8a',
                                                                            bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.1)' : 'rgba(30, 64, 175, 0.05)',
                                                                        },
                                                                    }}
                                                                >
                                                                    View
                                                                </Button>
                                                            )
                                                        )}

                                                        {/* Delete Button */}
                                                        {canDelete && onDelete && (
                                                            isMobile ? (
                                                                <Tooltip title="Delete Batch" arrow>
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => onDelete(batch.batch_id)}
                                                                        sx={{
                                                                            bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                                                                            color: '#ef4444',
                                                                            '&:hover': {
                                                                                bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.2)',
                                                                            },
                                                                            width: { xs: 28, sm: 32 },
                                                                            height: { xs: 28, sm: 32 },
                                                                        }}
                                                                    >
                                                                        <DeleteIcon sx={{ fontSize: { xs: 14, sm: 16 } }} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            ) : (
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    color="error"
                                                                    startIcon={<DeleteIcon sx={{ fontSize: 14 }} />}
                                                                    onClick={() => onDelete(batch.batch_id)}
                                                                    sx={{
                                                                        height: { sm: 28, md: 32 },
                                                                        fontSize: { sm: '0.65rem', md: '0.7rem' },
                                                                        fontWeight: 600,
                                                                        textTransform: 'uppercase',
                                                                        borderWidth: 1.5,
                                                                        minWidth: { sm: 70, md: 80 },
                                                                        '&:hover': {
                                                                            borderWidth: 1.5,
                                                                            bgcolor: 'rgba(239, 68, 68, 0.08)',
                                                                        },
                                                                    }}
                                                                >
                                                                    Delete
                                                                </Button>
                                                            )
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

                    {/* Footer Summary - shown when there are batches */}
                    {!loading && batches.length > 0 && (
                        <Box
                            sx={{
                                mt: { xs: 1, sm: 1.5, md: 2 },
                                p: { xs: 1, sm: 1.25, md: 1.5 },
                                bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.08)' : 'rgba(30, 64, 175, 0.04)',
                                borderRadius: { xs: 0.75, sm: 1 },
                                border: isDarkMode ? '1px solid rgba(96, 165, 250, 0.2)' : '1px solid rgba(30, 64, 175, 0.1)',
                            }}
                        >
                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={{ xs: 0.5, sm: 2 }}
                                justifyContent="center"
                                alignItems="center"
                            >
                                <Typography
                                    sx={{
                                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                                        fontWeight: 600,
                                        color: isDarkMode ? '#94a3b8' : '#64748b',
                                    }}
                                >
                                    📊 Total Batches: <strong style={{ color: isDarkMode ? '#60a5fa' : '#1e40af' }}>{batches.length}</strong>
                                </Typography>
                                <Typography
                                    sx={{
                                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                                        fontWeight: 600,
                                        color: isDarkMode ? '#94a3b8' : '#64748b',
                                    }}
                                >
                                    📦 Total Items: <strong style={{ color: isDarkMode ? '#4ade80' : '#16a34a' }}>
                                        {formatNumber(batches.reduce((sum, b) => sum + (b.count || 0), 0))}
                                    </strong>
                                </Typography>
                            </Stack>
                        </Box>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}
