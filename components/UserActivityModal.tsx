'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Dialog, DialogTitle, DialogContent, IconButton, Box, Typography,
    Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Chip, Stack, CircularProgress, Avatar, Divider, useTheme,
    Tooltip, LinearProgress
} from '@mui/material';
import {
    Close as CloseIcon,
    Computer as DesktopIcon,
    PhoneAndroid as MobileIcon,
    Tablet as TabletIcon,
    Circle as CircleIcon,
    Login as LoginIcon,
    Logout as LogoutIcon,
    Schedule as ScheduleIcon,
    Language as BrowserIcon,
    LocationOn as LocationIcon,
    History as HistoryIcon,
    Person as PersonIcon
} from '@mui/icons-material';
import { sessionsAPI } from '@/lib/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface UserActivityModalProps {
    open: boolean;
    onClose: () => void;
    userId: number | null;
    userName?: string;
}

interface UserSummary {
    user: {
        id: number;
        username: string;
        full_name: string;
        role: string;
        email: string;
        phone: string;
        last_seen: string;
        last_login: string;
        last_login_ip: string;
        last_login_device: string;
        created_at: string;
    };
    currentSession: {
        device_type: string;
        browser: string;
        os: string;
        ip_address: string;
        session_started: string;
        last_activity: string;
        status: 'online' | 'away' | 'offline';
        session_duration_minutes: number;
    } | null;
    isOnline: boolean;
    stats: {
        totalLogins: number;
        loginsLast30Days: number;
        avgSessionDuration: number;
    };
}

interface LoginHistoryItem {
    id: number;
    login_time: string;
    logout_time: string | null;
    duration_minutes: number | null;
    ip_address: string;
    device_type: string;
    browser: string;
    os: string;
    logout_reason: string;
}

export default function UserActivityModal({ open, onClose, userId, userName }: UserActivityModalProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [userSummary, setUserSummary] = useState<UserSummary | null>(null);
    const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyPage, setHistoryPage] = useState(1);

    const loadUserSummary = useCallback(async () => {
        if (!userId) return;

        try {
            const res = await sessionsAPI.getUserSummary(userId);
            setUserSummary(res.data);
        } catch (error) {
            console.error('Failed to load user summary:', error);
        }
    }, [userId]);

    const loadLoginHistory = useCallback(async (page: number = 1) => {
        if (!userId) return;

        try {
            const res = await sessionsAPI.getLoginHistory(userId, page, 20);
            setLoginHistory(res.data.history);
            setHistoryTotal(res.data.total);
            setHistoryPage(page);
        } catch (error) {
            console.error('Failed to load login history:', error);
        }
    }, [userId]);

    useEffect(() => {
        if (open && userId) {
            setLoading(true);
            setActiveTab(0);

            Promise.all([
                loadUserSummary(),
                loadLoginHistory(1)
            ]).finally(() => setLoading(false));
        }
    }, [open, userId, loadUserSummary, loadLoginHistory]);

    // Auto-refresh when modal is open
    useEffect(() => {
        if (!open || !userId) return;

        const interval = setInterval(() => {
            loadUserSummary();
        }, 30000); // Refresh every 30 seconds

        return () => clearInterval(interval);
    }, [open, userId, loadUserSummary]);

    const getDeviceIcon = (deviceType: string) => {
        switch (deviceType?.toLowerCase()) {
            case 'mobile': return <MobileIcon sx={{ fontSize: 20 }} />;
            case 'tablet': return <TabletIcon sx={{ fontSize: 20 }} />;
            default: return <DesktopIcon sx={{ fontSize: 20 }} />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online': return '#22c55e';
            case 'away': return '#f59e0b';
            default: return '#6b7280';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'online': return 'Online';
            case 'away': return 'Away';
            default: return 'Offline';
        }
    };

    const formatDuration = (minutes: number | null) => {
        if (!minutes) return '-';
        if (minutes < 60) return `${Math.round(minutes)}m`;
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    const getLogoutReasonChip = (reason: string) => {
        const colors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
            'manual': 'success',
            'expired': 'warning',
            'forced': 'error',
            'active': 'info'
        };
        return (
            <Chip
                label={reason === 'active' ? 'Active' : reason}
                size="small"
                color={colors[reason] || 'default'}
                sx={{ fontSize: '0.7rem', height: 20 }}
            />
        );
    };

    const renderOverviewTab = () => {
        if (!userSummary) return null;

        const { user, currentSession, isOnline, stats } = userSummary;
        const status = currentSession?.status || 'offline';

        return (
            <Box sx={{ p: 2 }}>
                {/* User Info Card */}
                <Paper sx={{ p: 2, mb: 2, bgcolor: isDarkMode ? '#1e293b' : '#f8fafc' }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{
                            width: 60, height: 60,
                            bgcolor: isOnline ? '#22c55e' : '#6b7280',
                            fontSize: '1.5rem'
                        }}>
                            {user.full_name?.charAt(0) || user.username?.charAt(0) || '?'}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                    {user.full_name || user.username}
                                </Typography>
                                <CircleIcon sx={{
                                    fontSize: 12,
                                    color: getStatusColor(status),
                                    filter: status === 'online' ? 'drop-shadow(0 0 4px #22c55e)' : 'none'
                                }} />
                                <Typography variant="caption" sx={{ color: getStatusColor(status), fontWeight: 600 }}>
                                    {getStatusLabel(status)}
                                </Typography>
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                                @{user.username} • {user.role.toUpperCase()}
                            </Typography>
                            {user.email && (
                                <Typography variant="caption" color="text.secondary">
                                    {user.email}
                                </Typography>
                            )}
                        </Box>
                    </Stack>
                </Paper>

                {/* Current Session */}
                {currentSession && (
                    <Paper sx={{ p: 2, mb: 2, border: `2px solid ${getStatusColor(status)}20` }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircleIcon sx={{ fontSize: 10, color: getStatusColor(status) }} />
                            Current Session
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                {getDeviceIcon(currentSession.device_type)}
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Device</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {currentSession.device_type} ({currentSession.os})
                                    </Typography>
                                </Box>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <BrowserIcon sx={{ fontSize: 20 }} />
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Browser</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {currentSession.browser}
                                    </Typography>
                                </Box>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <LocationIcon sx={{ fontSize: 20 }} />
                                <Box>
                                    <Typography variant="caption" color="text.secondary">IP Address</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {currentSession.ip_address || 'Unknown'}
                                    </Typography>
                                </Box>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <ScheduleIcon sx={{ fontSize: 20 }} />
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Session Duration</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {formatDuration(currentSession.session_duration_minutes)}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Box>
                        <Divider sx={{ my: 1.5 }} />
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary">
                                Session started: {dayjs(currentSession.session_started).format('MMM DD, YYYY h:mm A')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Last active: {dayjs(currentSession.last_activity).fromNow()}
                            </Typography>
                        </Stack>
                    </Paper>
                )}

                {!currentSession && (
                    <Paper sx={{ p: 2, mb: 2, bgcolor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                            🔴 User is currently offline
                        </Typography>
                        {user.last_seen && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
                                Last seen: {dayjs(user.last_seen).fromNow()}
                            </Typography>
                        )}
                    </Paper>
                )}

                {/* Stats Cards */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                    <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: isDarkMode ? '#1e3a5f' : '#eff6ff' }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#3b82f6' }}>
                            {stats.totalLogins}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Total Logins</Typography>
                    </Paper>
                    <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: isDarkMode ? '#1e3a3a' : '#ecfdf5' }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#22c55e' }}>
                            {stats.loginsLast30Days}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Last 30 Days</Typography>
                    </Paper>
                    <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: isDarkMode ? '#3a1e3a' : '#fdf4ff' }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#a855f7' }}>
                            {formatDuration(stats.avgSessionDuration)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Avg. Session</Typography>
                    </Paper>
                </Box>
            </Box>
        );
    };

    const renderLoginHistoryTab = () => (
        <Box sx={{ p: 1 }}>
            <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: isDarkMode ? '#334155' : '#f1f5f9' }}>Login Time</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: isDarkMode ? '#334155' : '#f1f5f9' }}>Logout Time</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: isDarkMode ? '#334155' : '#f1f5f9' }}>Duration</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: isDarkMode ? '#334155' : '#f1f5f9' }}>Device</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: isDarkMode ? '#334155' : '#f1f5f9' }}>IP</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: isDarkMode ? '#334155' : '#f1f5f9' }}>Status</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loginHistory.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                    <Typography color="text.secondary">No login history found</Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            loginHistory.map((item) => (
                                <TableRow key={item.id} hover>
                                    <TableCell sx={{ fontSize: '0.75rem' }}>
                                        <Stack direction="row" alignItems="center" spacing={0.5}>
                                            <LoginIcon sx={{ fontSize: 14, color: '#22c55e' }} />
                                            <span>{dayjs(item.login_time).format('MMM DD, h:mm A')}</span>
                                        </Stack>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.75rem' }}>
                                        {item.logout_time ? (
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                <LogoutIcon sx={{ fontSize: 14, color: '#ef4444' }} />
                                                <span>{dayjs(item.logout_time).format('MMM DD, h:mm A')}</span>
                                            </Stack>
                                        ) : (
                                            <Chip label="Active" size="small" color="success" sx={{ fontSize: '0.65rem', height: 18 }} />
                                        )}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                        {formatDuration(item.duration_minutes)}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.75rem' }}>
                                        <Tooltip title={`${item.browser} on ${item.os}`}>
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                {getDeviceIcon(item.device_type)}
                                                <span>{item.browser}</span>
                                            </Stack>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>
                                        {item.ip_address || '-'}
                                    </TableCell>
                                    <TableCell>
                                        {getLogoutReasonChip(item.logout_reason)}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            {historyTotal > 20 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                        Showing {loginHistory.length} of {historyTotal} records
                    </Typography>
                </Box>
            )}
        </Box>
    );

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: isDarkMode ? '#0f172a' : '#ffffff',
                    backgroundImage: 'none'
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`,
                py: 1.5
            }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <PersonIcon />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {userName || 'User'} Activity
                    </Typography>
                </Stack>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            {loading && <LinearProgress />}

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                    <Tab icon={<PersonIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Overview" sx={{ minHeight: 48 }} />
                    <Tab icon={<HistoryIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Login History" sx={{ minHeight: 48 }} />
                </Tabs>
            </Box>

            <DialogContent sx={{ p: 0, minHeight: 400 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        {activeTab === 0 && renderOverviewTab()}
                        {activeTab === 1 && renderLoginHistoryTab()}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
