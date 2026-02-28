'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
    Box, Typography, Paper, Card, CardContent, Chip, CircularProgress,
    Select, MenuItem, FormControl, InputLabel, IconButton, Tooltip,
    Divider, Collapse, Stack, Badge, Alert, useTheme, LinearProgress,
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import {
    Timeline as TimelineIcon,
    History as HistoryIcon,
    Storage as StorageIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    CloudDownload as DownloadIcon,
    Restore as RestoreIcon,
    Visibility as ViewIcon,
    InsertDriveFile as FileIcon,
    Circle as CircleIcon,
    ArrowUpward as InsertIcon,
    Edit as UpdateIcon,
    DeleteOutline as DeleteOpIcon,
    Refresh as RefreshIcon,
    CalendarMonth as CalendarIcon,
    AccessTime as TimeIcon
} from '@mui/icons-material';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { alpha } from '@mui/material/styles';
import React from 'react';

// ==================== TYPES ====================

interface TimelineData {
    days: number;
    totalBackups: number;
    totalChanges: number;
    backups: Array<{
        id: number;
        file_name: string;
        file_size: number;
        backup_type: string;
        description: string;
        created_by: number;
        created_at: string;
    }>;
    changeLogByHour: Array<{
        hour: string;
        table_name: string;
        operation: string;
        count: number;
        unique_users: number;
        first_change: string;
        last_change: string;
    }>;
    dailySummary: Array<{
        day: string;
        total_changes: number;
        tables_affected: number;
        unique_users: number;
        operations: Record<string, number>;
    }>;
}

interface ChangeLogEntry {
    id: number;
    table_name: string;
    operation: string;
    record_id: string;
    record_wsn: string;
    batch_id: string;
    changed_by: number;
    changed_by_name: string;
    warehouse_id: string;
    changed_at: string;
}

interface BackupPreview {
    id: number;
    fileName: string;
    fileSize: number;
    createdAt: string;
    description: string;
    backupType: string;
    metadata: any;
    tables: Array<{ table: string; count: number }>;
    totalRecords: number;
}

interface Props {
    warehouseId?: string;
}

// ==================== HELPER FUNCTIONS ====================

function formatTimeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
}

const OP_COLORS: Record<string, string> = {
    INSERT: '#22c55e',
    UPDATE: '#3b82f6',
    DELETE: '#ef4444'
};

const OP_ICONS: Record<string, any> = {
    INSERT: <InsertIcon sx={{ fontSize: 14 }} />,
    UPDATE: <UpdateIcon sx={{ fontSize: 14 }} />,
    DELETE: <DeleteOpIcon sx={{ fontSize: 14 }} />
};

const TABLE_LABELS: Record<string, string> = {
    inbound: 'Inbound',
    outbound: 'Outbound',
    picking: 'Picking',
    qc: 'QC',
    master_data: 'Master Data',
    customers: 'Customers',
    racks: 'Racks',
    warehouses: 'Warehouses',
    rejections: 'Rejections',
    users: 'Users',
    roles: 'Roles',
    permissions: 'Permissions'
};

// ==================== COMPONENT ====================

export default function BackupTimeline({ warehouseId }: Props) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const [timeline, setTimeline] = useState<TimelineData | null>(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(7);
    const [expandedDays, setExpandedDays] = useState<string[]>([]);
    const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
    const [changeLogLoading, setChangeLogLoading] = useState(false);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState<BackupPreview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    // ==================== DATA FETCHING ====================

    const fetchTimeline = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { days };
            if (warehouseId) params.warehouseId = warehouseId;
            const res = await api.get('/backups/timeline', { params });
            setTimeline(res.data);

            // Auto-expand today
            if (res.data.dailySummary?.length > 0) {
                setExpandedDays([res.data.dailySummary[0].day]);
            }
        } catch (error: any) {
            console.error('Failed to fetch timeline:', error);
            toast.error('Failed to load timeline');
        } finally {
            setLoading(false);
        }
    }, [days, warehouseId]);

    useEffect(() => {
        fetchTimeline();
    }, [fetchTimeline]);

    const fetchChangeLog = async (day: string) => {
        setChangeLogLoading(true);
        setSelectedDay(day);
        try {
            const since = new Date(day);
            since.setHours(0, 0, 0, 0);
            const until = new Date(day);
            until.setHours(23, 59, 59, 999);

            const params: any = {
                since: since.toISOString(),
                until: until.toISOString(),
                limit: 200
            };
            if (warehouseId) params.warehouseId = warehouseId;

            const res = await api.get('/backups/change-log', { params });
            setChangeLog(res.data.data || []);
        } catch (error: any) {
            console.error('Failed to fetch change log:', error);
            toast.error('Failed to load change log');
        } finally {
            setChangeLogLoading(false);
        }
    };

    const fetchBackupPreview = async (backupId: number) => {
        setPreviewLoading(true);
        setPreviewOpen(true);
        try {
            const res = await api.get(`/backups/${backupId}/preview`);
            setPreviewData(res.data);
        } catch (error: any) {
            console.error('Failed to fetch preview:', error);
            toast.error('Failed to load backup preview');
            setPreviewOpen(false);
        } finally {
            setPreviewLoading(false);
        }
    };

    // ==================== COMPUTED DATA ====================

    // Group hourly changes by day
    const hourlyByDay = useMemo(() => {
        if (!timeline) return {};
        const grouped: Record<string, typeof timeline.changeLogByHour> = {};
        timeline.changeLogByHour.forEach(entry => {
            const day = new Date(entry.hour).toISOString().split('T')[0];
            if (!grouped[day]) grouped[day] = [];
            grouped[day].push(entry);
        });
        return grouped;
    }, [timeline]);

    // Get backups for a specific day
    const getBackupsForDay = (day: string) => {
        if (!timeline) return [];
        return timeline.backups.filter(b => {
            const bDay = new Date(b.created_at).toISOString().split('T')[0];
            return bDay === day;
        });
    };

    const toggleDay = (day: string) => {
        setExpandedDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day]
        );
        // Also fetch change log for this day
        if (!expandedDays.includes(day)) {
            fetchChangeLog(day);
        }
    };

    // ==================== RENDER ====================

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!timeline) {
        return (
            <Alert severity="warning">Failed to load timeline data. Make sure the data_change_log table exists.</Alert>
        );
    }

    return (
        <Box>
            {/* ========== HEADER STATS ========== */}
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(3, 1fr)', md: 'repeat(3, 1fr)' },
                gap: { xs: 1, md: 2 },
                mb: { xs: 2, md: 3 }
            }}>
                {/* Total Changes */}
                <Card sx={{
                    background: isDark
                        ? 'linear-gradient(135deg, #1e3a5f 0%, #2d5a88 100%)'
                        : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    border: `1px solid ${isDark ? '#3b82f640' : '#93c5fd60'}`,
                }}>
                    <CardContent sx={{ py: { xs: 1.5, md: 2 }, px: { xs: 1, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.5rem' }, color: isDark ? '#93c5fd' : '#1e40af' }}>
                            {timeline.totalChanges.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: { xs: '0.65rem', md: '0.75rem' } }}>
                            Changes ({days}d)
                        </Typography>
                    </CardContent>
                </Card>

                {/* Total Backups */}
                <Card sx={{
                    background: isDark
                        ? 'linear-gradient(135deg, #1a3a2a 0%, #2d5a3a 100%)'
                        : 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                    border: `1px solid ${isDark ? '#22c55e40' : '#86efac60'}`,
                }}>
                    <CardContent sx={{ py: { xs: 1.5, md: 2 }, px: { xs: 1, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.5rem' }, color: isDark ? '#86efac' : '#166534' }}>
                            {timeline.totalBackups}
                        </Typography>
                        <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: { xs: '0.65rem', md: '0.75rem' } }}>
                            Backups ({days}d)
                        </Typography>
                    </CardContent>
                </Card>

                {/* Days Range Selector */}
                <Card sx={{
                    background: isDark
                        ? 'linear-gradient(135deg, #3a2a1a 0%, #5a3a2d 100%)'
                        : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    border: `1px solid ${isDark ? '#f59e0b40' : '#fbbf2460'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <CardContent sx={{ py: { xs: 1, md: 2 }, px: { xs: 1, md: 2 }, '&:last-child': { pb: { xs: 1, md: 2 } }, width: '100%' }}>
                        <FormControl size="small" fullWidth>
                            <Select
                                value={days}
                                onChange={(e) => setDays(e.target.value as number)}
                                sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}
                            >
                                <MenuItem value={1}>Last 24 hours</MenuItem>
                                <MenuItem value={3}>Last 3 days</MenuItem>
                                <MenuItem value={7}>Last 7 days</MenuItem>
                                <MenuItem value={14}>Last 14 days</MenuItem>
                                <MenuItem value={30}>Last 30 days</MenuItem>
                            </Select>
                        </FormControl>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                            <Tooltip title="Refresh">
                                <IconButton size="small" onClick={fetchTimeline}>
                                    <RefreshIcon sx={{ fontSize: { xs: 16, md: 18 } }} />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </CardContent>
                </Card>
            </Box>

            {/* ========== DAILY TIMELINE ========== */}
            {timeline.dailySummary.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                    No changes recorded in the last {days} days. Changes will appear here once the data_change_log migration is applied and data is modified.
                </Alert>
            ) : (
                <Stack spacing={1.5}>
                    {timeline.dailySummary.map((daySummary) => {
                        const dayStr = typeof daySummary.day === 'string' ? daySummary.day.split('T')[0] : daySummary.day;
                        const isExpanded = expandedDays.includes(dayStr);
                        const dayBackups = getBackupsForDay(dayStr);
                        const isToday = new Date(dayStr).toDateString() === new Date().toDateString();

                        return (
                            <Paper
                                key={dayStr}
                                elevation={isExpanded ? 3 : 1}
                                sx={{
                                    border: isToday ? `2px solid ${isDark ? '#3b82f6' : '#2563eb'}` : `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {/* Day Header */}
                                <Box
                                    onClick={() => toggleDay(dayStr)}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        px: { xs: 1.5, md: 2.5 },
                                        py: { xs: 1, md: 1.5 },
                                        cursor: 'pointer',
                                        background: isDark
                                            ? alpha(theme.palette.primary.main, 0.05)
                                            : alpha(theme.palette.primary.main, 0.02),
                                        '&:hover': {
                                            background: isDark
                                                ? alpha(theme.palette.primary.main, 0.1)
                                                : alpha(theme.palette.primary.main, 0.05),
                                        }
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                        <CalendarIcon sx={{ fontSize: { xs: 18, md: 22 }, color: isToday ? '#3b82f6' : 'text.secondary' }} />
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: { xs: '0.8rem', md: '1rem' }, lineHeight: 1.2 }}>
                                                {formatDate(dayStr)}
                                                {isToday && (
                                                    <Chip label="Today" size="small" color="primary" sx={{ ml: 1, height: 20, fontSize: '0.65rem' }} />
                                                )}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1.5 }, flexWrap: 'wrap' }}>
                                        {/* Operation badges */}
                                        {daySummary.operations && Object.entries(daySummary.operations).map(([op, count]) => (
                                            <Chip
                                                key={op}
                                                icon={OP_ICONS[op]}
                                                label={`${count}`}
                                                size="small"
                                                sx={{
                                                    height: { xs: 22, md: 26 },
                                                    fontSize: { xs: '0.6rem', md: '0.75rem' },
                                                    background: alpha(OP_COLORS[op] || '#94a3b8', 0.15),
                                                    color: OP_COLORS[op] || '#94a3b8',
                                                    fontWeight: 600,
                                                    '& .MuiChip-icon': { color: OP_COLORS[op] || '#94a3b8' }
                                                }}
                                            />
                                        ))}

                                        {/* Backup count badge */}
                                        {dayBackups.length > 0 && (
                                            <Badge badgeContent={dayBackups.length} color="success" sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem' } }}>
                                                <StorageIcon sx={{ fontSize: { xs: 16, md: 20 }, color: '#22c55e' }} />
                                            </Badge>
                                        )}

                                        {isExpanded ? <ExpandLessIcon sx={{ fontSize: { xs: 18, md: 22 } }} /> : <ExpandMoreIcon sx={{ fontSize: { xs: 18, md: 22 } }} />}
                                    </Box>
                                </Box>

                                {/* Day Detail */}
                                <Collapse in={isExpanded}>
                                    <Box sx={{ px: { xs: 1.5, md: 2.5 }, py: { xs: 1, md: 2 } }}>

                                        {/* Backups for this day */}
                                        {dayBackups.length > 0 && (
                                            <Box sx={{ mb: 2 }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#22c55e', fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                                                    💾 Backups ({dayBackups.length})
                                                </Typography>
                                                <Stack spacing={0.75}>
                                                    {dayBackups.map(backup => (
                                                        <Paper
                                                            key={backup.id}
                                                            elevation={0}
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                px: { xs: 1.5, md: 2 },
                                                                py: { xs: 0.75, md: 1 },
                                                                background: isDark ? alpha('#22c55e', 0.08) : alpha('#22c55e', 0.05),
                                                                border: `1px solid ${isDark ? '#22c55e30' : '#22c55e20'}`,
                                                                borderRadius: 1.5,
                                                                flexWrap: { xs: 'wrap', md: 'nowrap' }
                                                            }}
                                                        >
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <FileIcon sx={{ fontSize: { xs: 16, md: 20 }, color: '#22c55e' }} />
                                                                <Box>
                                                                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: { xs: '0.7rem', md: '0.8rem' } }}>
                                                                        {formatTime(backup.created_at)} — {backup.description || backup.file_name}
                                                                    </Typography>
                                                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: { xs: '0.6rem', md: '0.7rem' } }}>
                                                                        {formatBytes(backup.file_size)}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                                <Tooltip title="Preview contents">
                                                                    <IconButton size="small" onClick={() => fetchBackupPreview(backup.id)}>
                                                                        <ViewIcon sx={{ fontSize: { xs: 16, md: 18 } }} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Box>
                                                        </Paper>
                                                    ))}
                                                </Stack>
                                            </Box>
                                        )}

                                        {/* Change activity feed */}
                                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: isDark ? '#93c5fd' : '#2563eb', fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                                            📋 Activity Log ({daySummary.total_changes} changes by {daySummary.unique_users} user{daySummary.unique_users !== 1 ? 's' : ''})
                                        </Typography>

                                        {changeLogLoading && selectedDay === dayStr ? (
                                            <LinearProgress sx={{ mb: 2 }} />
                                        ) : (
                                            selectedDay === dayStr && changeLog.length > 0 ? (
                                                <Stack spacing={0.5}>
                                                    {changeLog.slice(0, 50).map(entry => (
                                                        <Box
                                                            key={entry.id}
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 1,
                                                                px: { xs: 1, md: 1.5 },
                                                                py: { xs: 0.5, md: 0.75 },
                                                                borderLeft: `3px solid ${OP_COLORS[entry.operation] || '#94a3b8'}`,
                                                                background: isDark ? alpha('#ffffff', 0.02) : alpha('#000000', 0.02),
                                                                borderRadius: '0 6px 6px 0',
                                                                fontSize: { xs: '0.65rem', md: '0.8rem' }
                                                            }}
                                                        >
                                                            <Typography sx={{ color: 'text.secondary', minWidth: { xs: 60, md: 70 }, fontSize: 'inherit' }}>
                                                                {formatTime(entry.changed_at)}
                                                            </Typography>
                                                            <Chip
                                                                label={entry.operation}
                                                                size="small"
                                                                sx={{
                                                                    height: { xs: 18, md: 22 },
                                                                    fontSize: { xs: '0.55rem', md: '0.65rem' },
                                                                    fontWeight: 700,
                                                                    background: alpha(OP_COLORS[entry.operation] || '#94a3b8', 0.15),
                                                                    color: OP_COLORS[entry.operation] || '#94a3b8',
                                                                    minWidth: { xs: 50, md: 60 }
                                                                }}
                                                            />
                                                            <Typography sx={{ fontWeight: 500, fontSize: 'inherit' }}>
                                                                {TABLE_LABELS[entry.table_name] || entry.table_name}
                                                            </Typography>
                                                            {entry.record_wsn && (
                                                                <Typography sx={{ color: 'text.secondary', fontSize: 'inherit' }}>
                                                                    WSN: {entry.record_wsn}
                                                                </Typography>
                                                            )}
                                                            <Typography sx={{ color: 'text.secondary', fontSize: 'inherit', ml: 'auto' }}>
                                                                {entry.changed_by_name || 'System'}
                                                            </Typography>
                                                        </Box>
                                                    ))}
                                                    {changeLog.length > 50 && (
                                                        <Typography variant="caption" sx={{ color: 'text.secondary', pl: 2, fontSize: { xs: '0.6rem', md: '0.7rem' } }}>
                                                            + {changeLog.length - 50} more entries
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            ) : (
                                                !changeLogLoading && selectedDay === dayStr && (
                                                    <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: { xs: '0.7rem', md: '0.8rem' } }}>
                                                        No detailed change logs available for this day.
                                                    </Typography>
                                                )
                                            )
                                        )}

                                        {/* Hourly breakdown */}
                                        {hourlyByDay[dayStr] && hourlyByDay[dayStr].length > 0 && (
                                            <Box sx={{ mt: 2 }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary', fontSize: { xs: '0.7rem', md: '0.8rem' } }}>
                                                    ⏱ Hourly Breakdown
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                                    {(() => {
                                                        // Group by hour
                                                        const hourGroups: Record<string, { total: number; tables: string[] }> = {};
                                                        hourlyByDay[dayStr].forEach(entry => {
                                                            const hr = new Date(entry.hour).getHours();
                                                            const key = `${hr}:00`;
                                                            if (!hourGroups[key]) hourGroups[key] = { total: 0, tables: [] };
                                                            hourGroups[key].total += entry.count;
                                                            if (!hourGroups[key].tables.includes(entry.table_name)) {
                                                                hourGroups[key].tables.push(entry.table_name);
                                                            }
                                                        });

                                                        return Object.entries(hourGroups)
                                                            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                                                            .map(([hour, data]) => (
                                                                <Tooltip key={hour} title={`Tables: ${data.tables.map(t => TABLE_LABELS[t] || t).join(', ')}`}>
                                                                    <Chip
                                                                        label={`${hour} · ${data.total}`}
                                                                        size="small"
                                                                        sx={{
                                                                            height: { xs: 22, md: 26 },
                                                                            fontSize: { xs: '0.6rem', md: '0.7rem' },
                                                                            background: isDark ? alpha('#3b82f6', 0.1) : alpha('#3b82f6', 0.08),
                                                                            fontWeight: 500
                                                                        }}
                                                                    />
                                                                </Tooltip>
                                                            ));
                                                    })()}
                                                </Box>
                                            </Box>
                                        )}
                                    </Box>
                                </Collapse>
                            </Paper>
                        );
                    })}
                </Stack>
            )}

            {/* ========== BACKUP PREVIEW DIALOG ========== */}
            <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontSize: { xs: '0.9rem', md: '1.1rem' } }}>
                    📦 Backup Preview
                </DialogTitle>
                <DialogContent>
                    {previewLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : previewData ? (
                        <Box>
                            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', fontSize: { xs: '0.7rem', md: '0.8rem' } }}>
                                {previewData.description} — {formatBytes(previewData.fileSize)} — {formatDate(previewData.createdAt)}
                            </Typography>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                                {previewData.totalRecords.toLocaleString()} total records across {previewData.tables.length} tables
                            </Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontSize: { xs: '0.65rem', md: '0.75rem' }, fontWeight: 600 }}>Table</TableCell>
                                            <TableCell align="right" sx={{ fontSize: { xs: '0.65rem', md: '0.75rem' }, fontWeight: 600 }}>Records</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {previewData.tables
                                            .sort((a, b) => b.count - a.count)
                                            .map(t => (
                                                <TableRow key={t.table}>
                                                    <TableCell sx={{ fontSize: { xs: '0.65rem', md: '0.75rem' } }}>
                                                        {TABLE_LABELS[t.table] || t.table}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontSize: { xs: '0.65rem', md: '0.75rem' }, fontWeight: 500 }}>
                                                        {t.count.toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        }
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    ) : (
                        <Typography color="error">Failed to load preview</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPreviewOpen(false)} size="small">Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
