'use client';

import React, { useState, useMemo } from 'react';
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    InputAdornment,
    Collapse,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
    Inventory2 as BatchIcon,
    Edit as EditIcon,
    Close as CloseIcon,
    Search as SearchIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Warning as WarningIcon,
    Person as PersonIcon,
    Warehouse as WarehouseIcon,
} from '@mui/icons-material';

// Standard date formatter with time
const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = months[d.getMonth()];
    const yyyy = d.getFullYear();
    let hours = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day}-${mon}-${yyyy} ${hours}:${mins} ${ampm}`;
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

// Date group helper
const getDateGroup = (dateStr?: string): string => {
    if (!dateStr) return 'Older';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Older';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const batchDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (batchDate >= today) return 'Today';
    if (batchDate >= yesterday) return 'Yesterday';
    if (batchDate >= weekAgo) return 'This Week';
    return 'Older';
};

export interface BatchData {
    batch_id: string;
    count: number;
    created_at?: string;
    last_updated?: string;
    lastupdated_display?: string;
    warehouse_names?: string;
    warehouse_ids?: number[];
    uploaded_by?: string;
}

interface BatchManagementTabProps {
    batches: BatchData[];
    loading: boolean;
    onRefresh: () => void;
    onDelete?: (batchId: string) => void;
    onView?: (batchId: string) => void;
    onRename?: (oldBatchId: string, newBatchId: string) => Promise<void>;
    canDelete?: boolean;
    canView?: boolean;
    canRename?: boolean;
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
    onRename,
    canDelete = true,
    canView = false,
    canRename = false,
    title = 'Batch Management',
    emptyMessage = 'No batches found',
    emptySubMessage = 'Batches will appear here after bulk uploads',
}: BatchManagementTabProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isDarkMode = theme.palette.mode === 'dark';

    // Search state
    const [searchQuery, setSearchQuery] = useState('');

    // Date group collapse state
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    // Rename dialog state
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState<string>('');
    const [newBatchName, setNewBatchName] = useState('');
    const [renaming, setRenaming] = useState(false);

    // Delete confirmation dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteBatchId, setDeleteBatchId] = useState<string>('');
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    // Get date from batch (handles different field names)
    const getBatchDate = (batch: BatchData) => {
        return batch.lastupdated_display || formatDateTime(batch.last_updated || batch.created_at);
    };

    // Filter batches by search query
    const filteredBatches = useMemo(() => {
        if (!searchQuery.trim()) return batches;
        const q = searchQuery.toLowerCase();
        return batches.filter(b =>
            b.batch_id.toLowerCase().includes(q) ||
            (b.warehouse_names || '').toLowerCase().includes(q) ||
            (b.uploaded_by || '').toLowerCase().includes(q)
        );
    }, [batches, searchQuery]);

    // Group filtered batches by date
    const groupedBatches = useMemo(() => {
        const groups: Record<string, BatchData[]> = {};
        const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'];
        for (const batch of filteredBatches) {
            const group = getDateGroup(batch.last_updated || batch.created_at);
            if (!groups[group]) groups[group] = [];
            groups[group].push(batch);
        }
        // Return in order
        return groupOrder.filter(g => groups[g]?.length > 0).map(g => ({ label: g, batches: groups[g] }));
    }, [filteredBatches]);

    // Calculate total items properly (ensure numeric addition)
    const totalItems = filteredBatches.reduce((sum, b) => sum + (parseInt(String(b.count)) || 0), 0);

    // Toggle group collapse
    const toggleGroup = (label: string) => {
        setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
    };

    // Safe delete - open confirmation dialog
    const handleDeleteClick = (batchId: string) => {
        setDeleteBatchId(batchId);
        setDeleteConfirmText('');
        setDeleteDialogOpen(true);
    };

    // Confirm delete
    const handleConfirmDelete = () => {
        if (onDelete && deleteConfirmText === deleteBatchId) {
            onDelete(deleteBatchId);
            setDeleteDialogOpen(false);
            setDeleteBatchId('');
            setDeleteConfirmText('');
        }
    };

    // Handle rename
    const handleRename = async () => {
        if (!onRename || !newBatchName.trim()) return;
        setRenaming(true);
        try {
            await onRename(selectedBatch, newBatchName.trim());
            setRenameDialogOpen(false);
            setNewBatchName('');
            setSelectedBatch('');
        } catch (error) {
            // Error handling done in parent
        } finally {
            setRenaming(false);
        }
    };

    const openRenameDialog = (batchId: string) => {
        setSelectedBatch(batchId);
        setNewBatchName(batchId);
        setRenameDialogOpen(true);
    };

    // Column count for colSpan
    const colCount = isMobile ? 3 : 6; // Batch ID, Count, Warehouse, Uploaded By, Last Updated, Actions

    // Render a batch row
    const renderBatchRow = (batch: BatchData, idx: number) => (
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
                        fontSize: '0.73rem',
                        fontWeight: 600,
                        color: isDarkMode ? '#60a5fa' : '#2563eb',
                        bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.1)' : '#eff6ff',
                        px: 1,
                        py: 0.25,
                        borderRadius: 0.5,
                        display: 'inline-block',
                        maxWidth: isMobile ? 140 : 220,
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
                <>
                    <TableCell>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <WarehouseIcon sx={{ fontSize: 13, color: isDarkMode ? '#64748b' : '#94a3b8' }} />
                            <Typography sx={{ fontSize: '0.72rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                {batch.warehouse_names || '-'}
                            </Typography>
                        </Stack>
                    </TableCell>
                    <TableCell>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <PersonIcon sx={{ fontSize: 13, color: isDarkMode ? '#64748b' : '#94a3b8' }} />
                            <Typography sx={{ fontSize: '0.72rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                {batch.uploaded_by || '-'}
                            </Typography>
                        </Stack>
                    </TableCell>
                    <TableCell>
                        <Typography sx={{ fontSize: '0.72rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                            {getBatchDate(batch)}
                        </Typography>
                    </TableCell>
                </>
            )}
            <TableCell align="right">
                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    {canRename && onRename && (
                        <Tooltip title="Rename" arrow placement="top">
                            <IconButton
                                size="small"
                                onClick={() => openRenameDialog(batch.batch_id)}
                                sx={{
                                    width: 26,
                                    height: 26,
                                    bgcolor: isDarkMode ? 'rgba(251, 191, 36, 0.1)' : '#fffbeb',
                                    color: isDarkMode ? '#fbbf24' : '#d97706',
                                    '&:hover': { bgcolor: isDarkMode ? 'rgba(251, 191, 36, 0.2)' : '#fef3c7' },
                                }}
                            >
                                <EditIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {canView && onView && (
                        <Tooltip title="View in List" arrow placement="top">
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
                        <Tooltip title="Delete Batch" arrow placement="top">
                            <IconButton
                                size="small"
                                onClick={() => handleDeleteClick(batch.batch_id)}
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
    );

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 1 }}>
            {/* Header + Search */}
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
                            label={`${filteredBatches.length}${searchQuery ? `/${batches.length}` : ''}`}
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
                <Stack direction="row" alignItems="center" spacing={1}>
                    <TextField
                        size="small"
                        placeholder="Search batches..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ fontSize: 16, color: isDarkMode ? '#64748b' : '#94a3b8' }} />
                                </InputAdornment>
                            ),
                            ...(searchQuery ? {
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.25 }}>
                                            <CloseIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            } : {}),
                        }}
                        sx={{
                            width: isMobile ? 140 : 200,
                            '& .MuiOutlinedInput-root': {
                                height: 28,
                                fontSize: '0.72rem',
                                bgcolor: isDarkMode ? '#1e293b' : '#f8fafc',
                                '& fieldset': { borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e5e7eb' },
                            },
                        }}
                    />
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
            </Stack>

            {/* Table with date groups */}
            <Box
                sx={{
                    flex: 1,
                    overflow: 'hidden',
                    borderRadius: 1,
                    border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
                    bgcolor: isDarkMode ? '#1e293b' : '#fff',
                }}
            >
                <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                {[
                                    'Batch ID', 'Count',
                                    ...(isMobile ? [] : ['Warehouse', 'Uploaded By', 'Last Updated']),
                                    'Actions'
                                ].map((header) => (
                                    <TableCell
                                        key={header}
                                        align={header === 'Count' ? 'center' : header === 'Actions' ? 'right' : 'left'}
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
                                    <TableCell colSpan={colCount} align="center" sx={{ py: 4 }}>
                                        <CircularProgress size={24} sx={{ color: isDarkMode ? '#60a5fa' : '#2563eb' }} />
                                        <Typography sx={{ mt: 1, fontSize: '0.75rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                                            Loading...
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : filteredBatches.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={colCount} align="center" sx={{ py: 4 }}>
                                        <BatchIcon sx={{ fontSize: 36, color: isDarkMode ? '#475569' : '#cbd5e1', mb: 0.5 }} />
                                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                                            {searchQuery ? 'No matching batches' : emptyMessage}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#475569' : '#cbd5e1' }}>
                                            {searchQuery ? `No results for "${searchQuery}"` : emptySubMessage}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                groupedBatches.map((group) => (
                                    <React.Fragment key={group.label}>
                                        {/* Date Group Header */}
                                        <TableRow>
                                            <TableCell
                                                colSpan={colCount}
                                                sx={{
                                                    py: 0.5,
                                                    px: 1,
                                                    bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.06)' : '#f0f9ff',
                                                    borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e0f2fe',
                                                    cursor: 'pointer',
                                                    userSelect: 'none',
                                                }}
                                                onClick={() => toggleGroup(group.label)}
                                            >
                                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                                    {collapsedGroups[group.label]
                                                        ? <ExpandMoreIcon sx={{ fontSize: 16, color: isDarkMode ? '#60a5fa' : '#2563eb' }} />
                                                        : <ExpandLessIcon sx={{ fontSize: 16, color: isDarkMode ? '#60a5fa' : '#2563eb' }} />
                                                    }
                                                    <Typography sx={{
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        color: isDarkMode ? '#60a5fa' : '#2563eb',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                    }}>
                                                        {group.label}
                                                    </Typography>
                                                    <Chip
                                                        label={group.batches.length}
                                                        size="small"
                                                        sx={{
                                                            height: 18,
                                                            fontSize: '0.65rem',
                                                            fontWeight: 600,
                                                            bgcolor: isDarkMode ? 'rgba(96, 165, 250, 0.12)' : '#dbeafe',
                                                            color: isDarkMode ? '#60a5fa' : '#2563eb',
                                                        }}
                                                    />
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                        {/* Group rows - collapsible */}
                                        {!collapsedGroups[group.label] && group.batches.map((batch, idx) => renderBatchRow(batch, idx))}
                                    </React.Fragment>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>

            {/* Footer Stats */}
            {filteredBatches.length > 0 && (
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
                            Batches: <strong style={{ color: isDarkMode ? '#60a5fa' : '#2563eb' }}>{filteredBatches.length}</strong>
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                            Total Items: <strong style={{ color: isDarkMode ? '#4ade80' : '#16a34a' }}>{formatNumber(totalItems)}</strong>
                        </Typography>
                    </Stack>
                </Box>
            )}

            {/* Rename Dialog */}
            <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ pb: 1 }}>
                    Rename Batch
                    <IconButton onClick={() => setRenameDialogOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="New Batch ID"
                        value={newBatchName}
                        onChange={(e) => setNewBatchName(e.target.value)}
                        size="small"
                        sx={{ mt: 1 }}
                        autoFocus
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleRename}
                        disabled={!newBatchName.trim() || newBatchName === selectedBatch || renaming}
                        startIcon={renaming ? <CircularProgress size={16} /> : <EditIcon />}
                    >
                        {renaming ? 'Renaming...' : 'Rename'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Safe Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={{
                    sx: {
                        bgcolor: isDarkMode ? '#1e293b' : '#fff',
                        border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca',
                    }
                }}
            >
                <DialogTitle sx={{
                    pb: 1,
                    color: isDarkMode ? '#f1f5f9' : '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                }}>
                    <WarningIcon sx={{ color: '#ef4444', fontSize: 22 }} />
                    Delete Batch
                    <IconButton onClick={() => setDeleteDialogOpen(false)} sx={{ position: 'absolute', right: 8, top: 8, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '0.82rem', color: isDarkMode ? '#94a3b8' : '#64748b', mb: 2 }}>
                        This will permanently delete all outbound entries in this batch. This action cannot be undone.
                    </Typography>
                    <Box sx={{
                        p: 1.5,
                        bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2',
                        borderRadius: 1,
                        border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid #fecaca',
                        mb: 2,
                    }}>
                        <Typography sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: isDarkMode ? '#fca5a5' : '#dc2626',
                            wordBreak: 'break-all',
                        }}>
                            {deleteBatchId}
                        </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.78rem', color: isDarkMode ? '#94a3b8' : '#64748b', mb: 1 }}>
                        Type the batch ID exactly to confirm:
                    </Typography>
                    <TextField
                        fullWidth
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        size="small"
                        placeholder="Paste batch ID here"
                        autoFocus
                        error={deleteConfirmText.length > 0 && deleteConfirmText !== deleteBatchId}
                        helperText={deleteConfirmText.length > 0 && deleteConfirmText !== deleteBatchId ? 'Batch ID does not match' : ''}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                fontSize: '0.8rem',
                                fontFamily: 'monospace',
                                bgcolor: isDarkMode ? '#0f172a' : '#fff',
                            },
                        }}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleConfirmDelete}
                        disabled={deleteConfirmText !== deleteBatchId}
                        startIcon={<DeleteIcon />}
                        sx={{ fontWeight: 600 }}
                    >
                        Delete Permanently
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
