'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Alert,
    CircularProgress,
    Chip,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Collapse,
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
    CleaningServices as CleanupIcon,
    KeyboardArrowDown as ExpandIcon,
    KeyboardArrowUp as CollapseIcon,
} from '@mui/icons-material';

import AppLayout from '@/components/AppLayout';
import { errorLogsAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

interface ErrorLog {
    id: number;
    message: string;
    endpoint: string | null;
    method: string | null;
    username: string | null;
    stack_trace: string | null;
    created_at: string;
}

export default function ErrorLogsPage() {
    const router = useRouter();
    const [logs, setLogs] = useState<ErrorLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const [clearDialogOpen, setClearDialogOpen] = useState(false);
    const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
    const [cleanupDays, setCleanupDays] = useState('7');
    const [actionLoading, setActionLoading] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    // Check if user is super_admin
    useEffect(() => {
        const user = getStoredUser();
        if (!user || user.role !== 'super_admin') {
            router.push('/dashboard');
            return;
        }
    }, [router]);

    const fetchLogs = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [logsRes, countRes] = await Promise.all([
                errorLogsAPI.getAll(),
                errorLogsAPI.getCount(),
            ]);
            setLogs(logsRes.data.logs || []);
            setTotalCount(countRes.data.count || 0);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch error logs';
            setError(errorMessage);
            console.error('Error fetching logs:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleClearAll = async () => {
        try {
            setActionLoading(true);
            await errorLogsAPI.clearAll();
            toast.success('All error logs cleared successfully');
            setClearDialogOpen(false);
            fetchLogs();
        } catch (err) {
            toast.error('Failed to clear logs');
            console.error('Error clearing logs:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCleanup = async () => {
        const days = parseInt(cleanupDays);
        if (isNaN(days) || days < 1) {
            toast.error('Please enter a valid number of days');
            return;
        }
        try {
            setActionLoading(true);
            const res = await errorLogsAPI.cleanup(days);
            toast.success(`Deleted ${res.data.deleted || 0} logs older than ${days} days`);
            setCleanupDialogOpen(false);
            fetchLogs();
        } catch (err) {
            toast.error('Failed to cleanup logs');
            console.error('Error cleaning up logs:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const toggleRow = (id: number) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const getMethodColor = (method: string | null) => {
        const colors: Record<string, 'error' | 'success' | 'warning' | 'info' | 'default'> = {
            GET: 'success',
            POST: 'info',
            PUT: 'warning',
            DELETE: 'error',
            PATCH: 'warning',
        };
        return colors[method || ''] || 'default';
    };

    return (
        <AppLayout>
            <Toaster position="top-right" />
            <Box sx={{ p: { xs: 2, md: 3 } }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 600 }}>
                            Error Logs
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            System error logs - Super Admin only
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Refresh">
                            <IconButton onClick={fetchLogs} disabled={loading}>
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                        <Button
                            variant="outlined"
                            color="warning"
                            startIcon={<CleanupIcon />}
                            onClick={() => setCleanupDialogOpen(true)}
                            disabled={totalCount === 0}
                        >
                            Cleanup Old
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => setClearDialogOpen(true)}
                            disabled={totalCount === 0}
                        >
                            Clear All
                        </Button>
                    </Box>
                </Box>

                {/* Stats Card */}
                <Card sx={{ mb: 3 }}>
                    <CardContent sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="body1">
                                Total Error Logs:
                            </Typography>
                            <Chip
                                label={totalCount}
                                color={totalCount > 100 ? 'error' : totalCount > 50 ? 'warning' : 'success'}
                                size="small"
                            />
                            {totalCount > 100 && (
                                <Typography variant="caption" color="error">
                                    Consider clearing old logs to save database space
                                </Typography>
                            )}
                        </Box>
                    </CardContent>
                </Card>

                {/* Error Alert */}
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Logs Table */}
                <Paper elevation={2}>
                    <TableContainer sx={{ maxHeight: 600 }}>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : logs.length === 0 ? (
                            <Box sx={{ p: 4, textAlign: 'center' }}>
                                <Typography color="text.secondary">
                                    No error logs found. This is good! 🎉
                                </Typography>
                            </Box>
                        ) : (
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600, width: 50 }}></TableCell>
                                        <TableCell sx={{ fontWeight: 600, width: 50 }}>ID</TableCell>
                                        <TableCell sx={{ fontWeight: 600, width: 160 }}>Time</TableCell>
                                        <TableCell sx={{ fontWeight: 600, width: 80 }}>Method</TableCell>
                                        <TableCell sx={{ fontWeight: 600, width: 100 }}>User</TableCell>
                                        <TableCell sx={{ fontWeight: 600, width: 180 }}>Endpoint</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Error Message</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {logs.map((log) => (
                                        <Fragment key={log.id}>
                                            <TableRow
                                                hover
                                                sx={{
                                                    cursor: log.stack_trace ? 'pointer' : 'default',
                                                    '& > *': { borderBottom: expandedRows.has(log.id) ? 'none' : undefined }
                                                }}
                                                onClick={() => log.stack_trace && toggleRow(log.id)}
                                            >
                                                <TableCell>
                                                    {log.stack_trace && (
                                                        <IconButton size="small">
                                                            {expandedRows.has(log.id) ? <CollapseIcon /> : <ExpandIcon />}
                                                        </IconButton>
                                                    )}
                                                </TableCell>
                                                <TableCell>{log.id}</TableCell>
                                                <TableCell sx={{ fontSize: '0.75rem' }}>
                                                    {formatDate(log.created_at)}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={log.method || 'N/A'}
                                                        size="small"
                                                        color={getMethodColor(log.method)}
                                                        sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={log.username || 'System'}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ fontSize: '0.7rem' }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                                    {log.endpoint || '-'}
                                                </TableCell>
                                                <TableCell
                                                    sx={{
                                                        color: 'error.main',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {log.message}
                                                </TableCell>
                                            </TableRow>
                                            {/* Expandable Stack Trace Row */}
                                            {log.stack_trace && (
                                                <TableRow>
                                                    <TableCell colSpan={7} sx={{ py: 0 }}>
                                                        <Collapse in={expandedRows.has(log.id)} timeout="auto" unmountOnExit>
                                                            <Box sx={{
                                                                p: 2,
                                                                bgcolor: '#1e1e1e',
                                                                borderRadius: 1,
                                                                my: 1,
                                                                mx: 2
                                                            }}>
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{
                                                                        color: '#569cd6',
                                                                        fontWeight: 600,
                                                                        display: 'block',
                                                                        mb: 1
                                                                    }}
                                                                >
                                                                    📍 Stack Trace:
                                                                </Typography>
                                                                <Typography
                                                                    component="pre"
                                                                    sx={{
                                                                        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                                                                        fontSize: '0.75rem',
                                                                        color: '#d4d4d4',
                                                                        whiteSpace: 'pre-wrap',
                                                                        wordBreak: 'break-all',
                                                                        m: 0,
                                                                        lineHeight: 1.6,
                                                                    }}
                                                                >
                                                                    {log.stack_trace}
                                                                </Typography>
                                                            </Box>
                                                        </Collapse>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </TableContainer>
                </Paper>

                {/* Clear All Dialog */}
                <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
                    <DialogTitle>Clear All Error Logs?</DialogTitle>
                    <DialogContent>
                        <Typography>
                            This will permanently delete all {totalCount} error logs. This action cannot be undone.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setClearDialogOpen(false)} disabled={actionLoading}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleClearAll}
                            color="error"
                            variant="contained"
                            disabled={actionLoading}
                        >
                            {actionLoading ? <CircularProgress size={20} /> : 'Clear All'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Cleanup Dialog */}
                <Dialog open={cleanupDialogOpen} onClose={() => setCleanupDialogOpen(false)}>
                    <DialogTitle>Cleanup Old Logs</DialogTitle>
                    <DialogContent>
                        <Typography sx={{ mb: 2 }}>
                            Delete error logs older than specified days:
                        </Typography>
                        <TextField
                            type="number"
                            label="Days"
                            value={cleanupDays}
                            onChange={(e) => setCleanupDays(e.target.value)}
                            inputProps={{ min: 1 }}
                            fullWidth
                            size="small"
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCleanupDialogOpen(false)} disabled={actionLoading}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCleanup}
                            color="warning"
                            variant="contained"
                            disabled={actionLoading}
                        >
                            {actionLoading ? <CircularProgress size={20} /> : 'Cleanup'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </AppLayout>
    );
}
