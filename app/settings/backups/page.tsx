'use client';

import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
    Chip,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    useTheme,
    useMediaQuery,
    CircularProgress,
    Tooltip,
    Stack,
    Grid,
    Divider,
    Collapse
} from '@mui/material';
import {
    CloudDownload as DownloadIcon,
    CloudUpload as BackupIcon,
    Delete as DeleteIcon,
    Restore as RestoreIcon,
    Storage as StorageIcon,
    Info as InfoIcon,
    Warning as WarningIcon,
    MoreVert as MoreVertIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { usePermissionGuard } from '@/hooks/usePermissionGuard';
import { usePermissions } from '@/app/context/PermissionsContext';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';

interface Backup {
    id: number;
    file_name: string;
    file_size: number;
    file_size_mb: string;
    backup_type: 'full' | 'schema' | 'data' | 'json';
    description: string;
    created_by: number;
    created_at: string;
}

interface DatabaseStats {
    tables: Array<{
        schema: string;
        table_name: string;
        size: string;
        size_bytes: number;
    }>;
    total_database_size: string;
}

interface BackupSchedule {
    id: number;
    name: string;
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    backup_type: string;
    description: string;
    enabled: boolean;
    time_of_day: string;
    day_of_week: number;
    day_of_month: number;
    retention_days: number;
    last_run_at: string | null;
    next_run_at: string | null;
    created_at: string;
}

interface HealthStats {
    total_backups: number;
    successful_backups: number;
    failed_backups: number;
    last_backup_at: string | null;
    last_backup_status: string | null;
    last_backup_size: number;
    total_storage_used: number;
    average_backup_size: number;
    success_rate: number;
    total_storage_used_formatted: string;
    average_backup_size_formatted: string;
    last_backup_size_formatted: string;
}

export default function BackupPage() {
    const { loading: permissionLoading } = usePermissionGuard('view_backups');

    // Permission checks
    const { hasPermission } = usePermissions();

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [backups, setBackups] = useState<Backup[]>([]);
    const [loading, setLoading] = useState(true);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
    const [backupType, setBackupType] = useState<'full' | 'schema' | 'data'>('full');
    const [description, setDescription] = useState('');
    const [confirmRestore, setConfirmRestore] = useState('');
    const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
    const [statsDialogOpen, setStatsDialogOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState<number | null>(null);
    const [healthStats, setHealthStats] = useState<HealthStats | null>(null);
    const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
    const [schedulesDialogOpen, setSchedulesDialogOpen] = useState(false);
    const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
    const [currentSchedule, setCurrentSchedule] = useState<Partial<BackupSchedule> | null>(null);

    useEffect(() => {
        // Only load data after permissions are checked
        if (!permissionLoading) {
            loadBackups();
            loadDatabaseStats();
            loadHealthStats();
            loadSchedules();
        }
    }, [permissionLoading]);

    const loadBackups = async () => {
        try {
            setLoading(true);
            const response = await api.get('/backups');
            setBackups(response.data);
        } catch (error: any) {
            toast.error('Failed to load backups');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadDatabaseStats = async () => {
        try {
            const response = await api.get('/backups/stats');
            setDbStats(response.data);
        } catch (error) {
            console.error('Failed to load database stats:', error);
        }
    };

    const loadHealthStats = async () => {
        try {
            const response = await api.get('/backups/health/stats');
            setHealthStats(response.data);
        } catch (error) {
            console.error('Failed to load health stats:', error);
        }
    };

    const loadSchedules = async () => {
        try {
            const response = await api.get('/backups/schedules');
            setSchedules(response.data);
        } catch (error) {
            console.error('Failed to load schedules:', error);
        }
    };

    const handleCreateBackup = async () => {
        const toastId = toast.loading('Creating backup...');
        try {
            await api.post('/backups', {
                backup_type: backupType,
                description,
                use_json: true  // Use JSON format by default (Supabase-friendly)
            });

            toast.success('Backup created successfully!', { id: toastId });
            setCreateDialogOpen(false);
            setDescription('');
            setBackupType('full');
            loadBackups();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Backup failed', { id: toastId });
            console.error(error);
        }
    };

    const handleDownloadBackup = async (backup: Backup) => {
        const toastId = toast.loading('Downloading backup...');
        try {
            console.log('Downloading backup ID:', backup.id);
            console.log('Request URL:', `/backups/download/${backup.id}`);

            const response = await api.get(`/backups/download/${backup.id}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', backup.file_name);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success('Backup downloaded!', { id: toastId });
        } catch (error: any) {
            console.error('Download error:', error);
            console.error('Error response:', error.response?.data);
            console.error('Error status:', error.response?.status);
            console.error('Full error:', error);
            toast.error(error.response?.data?.error || 'Download failed', { id: toastId });
        }
    };

    const handleDeleteBackup = async (backup: Backup) => {
        if (!confirm(`Delete backup: ${backup.file_name}?`)) return;

        const toastId = toast.loading('Deleting backup...');
        try {
            await api.delete(`/backups/${backup.id}`);
            toast.success('Backup deleted!', { id: toastId });
            loadBackups();
        } catch (error: any) {
            toast.error('Delete failed', { id: toastId });
            console.error(error);
        }
    };

    const handleRestoreBackup = async () => {
        if (confirmRestore !== 'RESTORE') {
            toast.error('Please type RESTORE to confirm');
            return;
        }

        if (!selectedBackup) return;

        const toastId = toast.loading('Restoring database... This may take a while.');
        try {
            await api.post(`/backups/restore/${selectedBackup.id}`, {
                confirm: true
            });

            toast.success('✅ Database restored successfully! Refresh page to see changes.', {
                id: toastId,
                duration: 6000
            });
            setRestoreDialogOpen(false);
            setSelectedBackup(null);
            setConfirmRestore('');

            // Reload after 2 seconds to show updated data
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error: any) {
            const errorMsg = error.response?.data?.details || error.response?.data?.error || 'Restore failed';
            toast.error(`❌ ${errorMsg}`, { id: toastId, duration: 6000 });
            console.error('Restore error:', error.response?.data || error);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getBackupTypeColor = (type: string) => {
        switch (type) {
            case 'full': return 'success';
            case 'schema': return 'info';
            case 'data': return 'warning';
            default: return 'default';
        }
    };

    // Show loading state while permissions are being checked
    if (permissionLoading) {
        return (
            <AppLayout>
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh'
                }}>
                    <CircularProgress />
                </Box>
            </AppLayout>
        );
    }

    /////////////////////// UI Render ///////////////////////
    return (
        <AppLayout>
            <Toaster position="top-right" />
            <Box sx={{
                p: { xs: 2, sm: 2.5, md: 3 },
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                minHeight: { xs: 'calc(100vh - 64px)', md: '100%' },
                width: '100%',
                display: 'flex',
                flex: { md: 1 },
                flexDirection: 'column',
                overflowY: 'auto',
                overflowX: 'hidden',
            }}>

                {/* Header */}
                <Box sx={{
                    position: 'sticky',
                    top: { xs: -16, md: 0 },
                    zIndex: 1000,
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                    borderRadius: { xs: '12px', md: '16px' },
                    p: { xs: 2, sm: 2.5, md: 3 },
                    mb: { xs: 2, md: 3 },
                    boxShadow: '0 8px 32px rgba(30, 58, 138, 0.25)',
                }}>
                    <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5}>
                        <BackupIcon sx={{ color: '#fff', fontSize: { xs: 28, md: 32 } }} />
                        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 700, color: '#fff' }}>
                            Database Backup & Restore
                        </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', fontSize: { xs: '0.875rem', md: '0.95rem' } }}>
                        Securely backup and restore your WMS database
                    </Typography>
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1 }}>

                    {/* Statistics Cards */}
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'repeat(4, 1fr)', sm: 'repeat(4, 1fr)' },
                        gap: { xs: 0.75, md: 2 },
                        mb: { xs: 2, md: 3 }
                    }}>
                        <Card sx={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            boxShadow: { xs: '0 2px 8px rgba(59, 130, 246, 0.3)', md: '0 4px 12px rgba(59, 130, 246, 0.3)' },
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            '&:hover': {
                                transform: { xs: 'none', md: 'translateY(-4px)' },
                                boxShadow: { xs: '0 2px 8px rgba(59, 130, 246, 0.3)', md: '0 8px 24px rgba(59, 130, 246, 0.4)' },
                            }
                        }}>
                            <CardContent sx={{
                                py: { xs: 1, md: 3 },
                                px: { xs: 0.5, md: 2 },
                                width: '100%',
                                '&:last-child': { pb: { xs: 1, md: 3 } }
                            }}>
                                <Typography variant="h4" sx={{ fontWeight: 700, mb: { xs: 0.25, md: 1 }, fontSize: { xs: '1.25rem', md: '2.125rem' } }}>
                                    {backups.length}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: { xs: '0.6rem', md: '0.875rem' }, fontWeight: 500, lineHeight: 1.2 }}>
                                    Total Backups
                                </Typography>
                            </CardContent>
                        </Card>

                        <Card sx={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            boxShadow: { xs: '0 2px 8px rgba(16, 185, 129, 0.3)', md: '0 4px 12px rgba(16, 185, 129, 0.3)' },
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            '&:hover': {
                                transform: { xs: 'none', md: 'translateY(-4px)' },
                                boxShadow: { xs: '0 2px 8px rgba(16, 185, 129, 0.3)', md: '0 8px 24px rgba(16, 185, 129, 0.4)' },
                            }
                        }}>
                            <CardContent sx={{
                                py: { xs: 1, md: 3 },
                                px: { xs: 0.5, md: 2 },
                                width: '100%',
                                '&:last-child': { pb: { xs: 1, md: 3 } }
                            }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: { xs: 0.25, md: 1 }, fontSize: { xs: '0.9rem', md: '2.125rem' } }}>
                                    {dbStats?.total_database_size || '...'}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: { xs: '0.6rem', md: '0.875rem' }, fontWeight: 500, lineHeight: 1.2 }}>
                                    DB Size
                                </Typography>
                            </CardContent>
                        </Card>

                        <Card sx={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                            color: 'white',
                            boxShadow: { xs: '0 2px 8px rgba(139, 92, 246, 0.3)', md: '0 4px 12px rgba(139, 92, 246, 0.3)' },
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            '&:hover': {
                                transform: { xs: 'none', md: 'translateY(-4px)' },
                                boxShadow: { xs: '0 2px 8px rgba(139, 92, 246, 0.3)', md: '0 8px 24px rgba(139, 92, 246, 0.4)' },
                            }
                        }}>
                            <CardContent sx={{
                                py: { xs: 1, md: 3 },
                                px: { xs: 0.5, md: 2 },
                                width: '100%',
                                '&:last-child': { pb: { xs: 1, md: 3 } }
                            }}>
                                <Typography variant="h4" sx={{ fontWeight: 700, mb: { xs: 0.25, md: 1 }, fontSize: { xs: '1.25rem', md: '2.125rem' } }}>
                                    {backups.filter(b => b.backup_type === 'full' || b.backup_type === 'json').length}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: { xs: '0.6rem', md: '0.875rem' }, fontWeight: 500, lineHeight: 1.2 }}>
                                    Full Backups
                                </Typography>
                            </CardContent>
                        </Card>

                        <Card sx={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            color: 'white',
                            boxShadow: { xs: '0 2px 8px rgba(245, 158, 11, 0.3)', md: '0 4px 12px rgba(245, 158, 11, 0.3)' },
                            cursor: 'pointer',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            '&:hover': {
                                transform: { xs: 'none', md: 'translateY(-4px)' },
                                boxShadow: { xs: '0 2px 8px rgba(245, 158, 11, 0.3)', md: '0 8px 24px rgba(245, 158, 11, 0.4)' },
                            }
                        }}
                            onClick={() => setStatsDialogOpen(true)}
                        >
                            <CardContent sx={{
                                py: { xs: 1, md: 3 },
                                px: { xs: 0.5, md: 2 },
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                '&:last-child': { pb: { xs: 1, md: 3 } }
                            }}>
                                <InfoIcon sx={{ fontSize: { xs: 22, md: 40 }, mb: { xs: 0.25, md: 0.5 } }} />
                                <Typography variant="body2" sx={{ fontSize: { xs: '0.6rem', md: '0.875rem' }, fontWeight: 500, lineHeight: 1.2 }}>
                                    View Details
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>

                    {/* Health Dashboard */}
                    {healthStats && (
                        <Paper sx={{
                            p: { xs: 2, md: 3 },
                            mb: 3,
                            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                            border: '1px solid',
                            borderColor: 'primary.light',
                            borderRadius: 2
                        }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                    <Typography variant="h6" fontWeight={700} color="primary.main">
                                        📊 Backup Health Dashboard
                                    </Typography>
                                </Stack>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => setSchedulesDialogOpen(true)}
                                    sx={{ fontSize: { xs: '0.7rem', sm: '0.85rem' } }}
                                >
                                    ⏰ Schedules ({schedules.length})
                                </Button>
                            </Stack>

                            <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                                gap: 2
                            }}>
                                <Card sx={{ bgcolor: 'white', boxShadow: 2 }}>
                                    <CardContent sx={{ textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                            Success Rate
                                        </Typography>
                                        <Typography variant="h4" fontWeight={700} color="success.main" sx={{ my: 0.5 }}>
                                            {Number(healthStats.success_rate || 0).toFixed(1)}%
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {healthStats.successful_backups}/{healthStats.total_backups} successful
                                        </Typography>
                                    </CardContent>
                                </Card>

                                <Card sx={{ bgcolor: 'white', boxShadow: 2 }}>
                                    <CardContent sx={{ textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                            Total Storage
                                        </Typography>
                                        <Typography variant="h5" fontWeight={700} color="primary.main" sx={{ my: 0.5, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                                            {healthStats.total_storage_used_formatted}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Avg: {healthStats.average_backup_size_formatted}
                                        </Typography>
                                    </CardContent>
                                </Card>

                                <Card sx={{ bgcolor: 'white', boxShadow: 2 }}>
                                    <CardContent sx={{ textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                            Last Backup
                                        </Typography>
                                        <Typography variant="body1" fontWeight={600} sx={{ my: 0.5, fontSize: { xs: '0.85rem', sm: '1rem' } }}>
                                            {healthStats.last_backup_at ? new Date(healthStats.last_backup_at).toLocaleDateString() : 'Never'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {healthStats.last_backup_size_formatted}
                                        </Typography>
                                    </CardContent>
                                </Card>

                                <Card sx={{ bgcolor: 'white', boxShadow: 2 }}>
                                    <CardContent sx={{ textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                            Active Schedules
                                        </Typography>
                                        <Typography variant="h4" fontWeight={700} color="warning.main" sx={{ my: 0.5 }}>
                                            {schedules.filter(s => s.enabled).length}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            of {schedules.length} total
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Box>
                        </Paper>
                    )}

                    {/* Action Buttons */}
                    <Box sx={{ mb: 3 }}>
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<BackupIcon />}
                            onClick={() => setCreateDialogOpen(true)}
                            sx={{
                                py: 1.5,
                                px: 3,
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                                fontWeight: 600,
                                fontSize: '1rem',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                    boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)',
                                    transform: 'translateY(-2px)',
                                },
                                transition: 'all 0.2s'
                            }}
                        >
                            Create New Backup
                        </Button>
                    </Box>

                    {/* Important Notice */}
                    <Alert
                        severity="info"
                        icon={<InfoIcon />}
                        sx={{
                            mb: 3,
                            borderRadius: 2,
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            '& .MuiAlert-message': {
                                fontSize: '0.875rem',
                                width: '100%'
                            }
                        }}
                    >
                        <Typography variant="body2" fontWeight={600} mb={0.5}>
                            ℹ️ Backup Information
                        </Typography>
                        <Typography variant="body2">
                            JSON backups work with Supabase without requiring pg_dump. Restore operations will replace current data. Always download backups for safety.
                        </Typography>
                    </Alert>

                    {/* Backups List */}
                    {loading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" py={8}>
                            <CircularProgress size={48} />
                        </Box>
                    ) : backups.length === 0 ? (
                        <Paper sx={{
                            p: { xs: 4, md: 6 },
                            textAlign: 'center',
                            borderRadius: 3,
                            border: '2px dashed',
                            borderColor: 'divider'
                        }}>
                            <StorageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                No Backups Yet
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={3}>
                                Create your first backup to secure your data
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<BackupIcon />}
                                onClick={() => setCreateDialogOpen(true)}
                            >
                                Create First Backup
                            </Button>
                        </Paper>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            {!isMobile ? (
                                <TableContainer component={Paper} sx={{
                                    borderRadius: 2,
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                                    border: '1px solid',
                                    borderColor: 'divider'
                                }}>
                                    <Table>
                                        <TableHead>
                                            <TableRow sx={{
                                                bgcolor: 'grey.100',
                                                '& th': {
                                                    borderBottom: '2px solid',
                                                    borderColor: 'divider'
                                                }
                                            }}>
                                                <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>File Name</TableCell>
                                                <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem', width: 100 }}>Type</TableCell>
                                                <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem', width: 100 }}>Size</TableCell>
                                                <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem', width: 200 }}>Description</TableCell>
                                                <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem', width: 180 }}>Created</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.875rem', width: 140 }}>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {backups.map((backup) => (
                                                <TableRow
                                                    key={backup.id}
                                                    hover
                                                    sx={{
                                                        '&:last-child td': { border: 0 },
                                                        '&:hover': { bgcolor: 'action.hover' }
                                                    }}
                                                >
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={500} fontFamily="monospace" fontSize="0.8rem">
                                                            {backup.file_name}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={backup.backup_type.toUpperCase()}
                                                            color={getBackupTypeColor(backup.backup_type) as any}
                                                            size="small"
                                                            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={500}>
                                                            {backup.file_size_mb} MB
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                                                            {backup.description || '-'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontSize="0.85rem">
                                                            {formatDate(backup.created_at)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Stack direction="row" spacing={0.5} justifyContent="center">
                                                            <Tooltip title="Download" arrow>
                                                                <IconButton
                                                                    size="small"
                                                                    color="primary"
                                                                    onClick={() => handleDownloadBackup(backup)}
                                                                    sx={{
                                                                        '&:hover': {
                                                                            bgcolor: 'primary.light',
                                                                            color: 'white'
                                                                        }
                                                                    }}
                                                                >
                                                                    <DownloadIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Restore" arrow>
                                                                <IconButton
                                                                    size="small"
                                                                    color="success"
                                                                    onClick={() => {
                                                                        setSelectedBackup(backup);
                                                                        setRestoreDialogOpen(true);
                                                                    }}
                                                                    sx={{
                                                                        '&:hover': {
                                                                            bgcolor: 'success.light',
                                                                            color: 'white'
                                                                        }
                                                                    }}
                                                                >
                                                                    <RestoreIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Delete" arrow>
                                                                <IconButton
                                                                    size="small"
                                                                    color="error"
                                                                    onClick={() => handleDeleteBackup(backup)}
                                                                    sx={{
                                                                        '&:hover': {
                                                                            bgcolor: 'error.light',
                                                                            color: 'white'
                                                                        }
                                                                    }}
                                                                >
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Stack>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            ) : (
                                /* Mobile Card View */
                                <Stack spacing={2}>
                                    {backups.map((backup) => (
                                        <Card key={backup.id} sx={{
                                            borderRadius: 2,
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                            transition: 'transform 0.2s, box-shadow 0.2s',
                                            '&:active': {
                                                transform: 'scale(0.98)',
                                            }
                                        }}>
                                            <CardContent sx={{ p: 2 }}>
                                                <Stack spacing={1.5}>
                                                    {/* Header Row */}
                                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                                        <Box flex={1}>
                                                            <Typography variant="subtitle2" fontWeight={600} sx={{
                                                                wordBreak: 'break-word',
                                                                fontSize: '0.9rem',
                                                                lineHeight: 1.3
                                                            }}>
                                                                {backup.file_name}
                                                            </Typography>
                                                        </Box>
                                                        <Chip
                                                            label={backup.backup_type.toUpperCase()}
                                                            color={getBackupTypeColor(backup.backup_type) as any}
                                                            size="small"
                                                            sx={{ ml: 1, fontWeight: 600, fontSize: '0.7rem' }}
                                                        />
                                                    </Stack>

                                                    <Divider />

                                                    {/* Info Grid */}
                                                    <Stack spacing={1.5}>
                                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                                            <Box sx={{ flex: 1 }}>
                                                                <Typography variant="caption" color="text.secondary" display="block">
                                                                    Size
                                                                </Typography>
                                                                <Typography variant="body2" fontWeight={500}>
                                                                    {backup.file_size_mb} MB
                                                                </Typography>
                                                            </Box>
                                                            <Box sx={{ flex: 1 }}>
                                                                <Typography variant="caption" color="text.secondary" display="block">
                                                                    Created
                                                                </Typography>
                                                                <Typography variant="body2" fontWeight={500} fontSize="0.85rem">
                                                                    {formatDate(backup.created_at)}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                        {backup.description && (
                                                            <Box>
                                                                <Typography variant="caption" color="text.secondary" display="block">
                                                                    Description
                                                                </Typography>
                                                                <Typography variant="body2" fontSize="0.85rem">
                                                                    {backup.description}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Stack>

                                                    <Divider />

                                                    {/* Action Buttons */}
                                                    <Stack direction="row" spacing={1}>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            startIcon={<DownloadIcon />}
                                                            onClick={() => handleDownloadBackup(backup)}
                                                            fullWidth
                                                        >
                                                            Download
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            color="success"
                                                            startIcon={<RestoreIcon />}
                                                            onClick={() => {
                                                                setSelectedBackup(backup);
                                                                setRestoreDialogOpen(true);
                                                            }}
                                                            fullWidth
                                                        >
                                                            Restore
                                                        </Button>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => handleDeleteBackup(backup)}
                                                            sx={{
                                                                border: '1px solid',
                                                                borderColor: 'error.main',
                                                                borderRadius: 1
                                                            }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Stack>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Stack>
                            )}
                        </>
                    )}

                    {/* Create Backup Dialog */}
                    <Dialog
                        open={createDialogOpen}
                        onClose={() => setCreateDialogOpen(false)}
                        maxWidth="sm"
                        fullWidth
                        fullScreen={isMobile}
                        PaperProps={{
                            sx: {
                                borderRadius: { xs: 0, sm: 3 },
                                m: { xs: 0, sm: 2 }
                            }
                        }}
                    >
                        <DialogTitle sx={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            py: { xs: 2, md: 2.5 }
                        }}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                <BackupIcon />
                                <Typography variant={isMobile ? 'h6' : 'h6'} fontWeight={600}>
                                    Create New Backup
                                </Typography>
                            </Stack>
                            {isMobile && (
                                <IconButton onClick={() => setCreateDialogOpen(false)} sx={{ color: 'white' }}>
                                    <CloseIcon />
                                </IconButton>
                            )}
                        </DialogTitle>
                        <DialogContent sx={{ pt: { xs: 3, md: 3 }, pb: { xs: 1.5, md: 2 }, px: { xs: 2.5, md: 3 } }}>
                            <Stack spacing={{ xs: 2.5, md: 3 }} sx={{ pt: 1.5 }}>
                                <FormControl fullWidth>
                                    <InputLabel>Backup Type</InputLabel>
                                    <Select
                                        value={backupType}
                                        onChange={(e) => setBackupType(e.target.value as any)}
                                        label="Backup Type"
                                        sx={{
                                            '& .MuiSelect-select': {
                                                py: { xs: 1.5, md: 2 }
                                            }
                                        }}
                                    >   <MenuItem value="full" sx={{ py: 1.5 }}>
                                            <Stack spacing={0.25}>
                                                <Typography variant="body2" fontWeight={500}>Full Backup</Typography>
                                                <Typography variant="caption" color="text.secondary">Schema + All Data</Typography>
                                            </Stack>
                                        </MenuItem>
                                        <MenuItem value="schema" sx={{ py: 1.5 }}>
                                            <Stack spacing={0.25}>
                                                <Typography variant="body2" fontWeight={500}>Schema Only</Typography>
                                                <Typography variant="caption" color="text.secondary">Table Structure</Typography>
                                            </Stack>
                                        </MenuItem>
                                        <MenuItem value="data" sx={{ py: 1.5 }}>
                                            <Stack spacing={0.25}>
                                                <Typography variant="body2" fontWeight={500}>Data Only</Typography>
                                                <Typography variant="caption" color="text.secondary">Records Without Structure</Typography>
                                            </Stack>
                                        </MenuItem>
                                    </Select>
                                </FormControl>

                                <TextField
                                    label="Description (Optional)"
                                    multiline
                                    rows={isMobile ? 2 : 3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="e.g., Before major update, Weekly backup, etc."
                                    fullWidth
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            fontSize: { xs: '0.9rem', md: '1rem' }
                                        }
                                    }}
                                />

                                <Alert severity="success" sx={{ borderRadius: { xs: 1.5, md: 2 }, py: { xs: 1, md: 1.5 } }}>
                                    <Typography variant="body2" fontWeight={500} sx={{ fontSize: { xs: '0.85rem', md: '0.875rem' } }}>✓ Supabase Compatible</Typography>
                                    <Typography variant="caption" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                        Uses JSON format, no pg_dump required
                                    </Typography>
                                </Alert>
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{ px: { xs: 2, md: 3 }, pb: { xs: 2, md: 3 }, pt: { xs: 1, md: 1.5 }, gap: 1 }}>
                            <Button
                                onClick={() => setCreateDialogOpen(false)}
                                fullWidth={isMobile}
                                size="large"
                                sx={{ fontWeight: 500 }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleCreateBackup}
                                startIcon={<BackupIcon />}
                                fullWidth={isMobile}
                                size="large"
                                sx={{
                                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                    fontWeight: 600,
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                    }
                                }}
                            >
                                Create Backup
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Restore Confirmation Dialog */}
                    <Dialog
                        open={restoreDialogOpen}
                        onClose={() => setRestoreDialogOpen(false)}
                        maxWidth="sm"
                        fullWidth
                        fullScreen={isMobile}
                        PaperProps={{
                            sx: {
                                borderRadius: { xs: 0, sm: 3 },
                                m: { xs: 0, sm: 2 }
                            }
                        }}
                    >
                        <DialogTitle sx={{
                            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            py: { xs: 2, md: 2.5 }
                        }}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                <WarningIcon />
                                <Typography variant={isMobile ? 'h6' : 'h6'} fontWeight={600}>
                                    Restore Database
                                </Typography>
                            </Stack>
                            {isMobile && (
                                <IconButton onClick={() => {
                                    setRestoreDialogOpen(false);
                                    setConfirmRestore('');
                                }} sx={{ color: 'white' }}>
                                    <CloseIcon />
                                </IconButton>
                            )}
                        </DialogTitle>
                        <DialogContent sx={{ pt: 3, pb: 2 }}>
                            <Stack spacing={2.5}>
                                <Alert severity="error" sx={{ borderRadius: 2 }}>
                                    <Typography variant="body2" fontWeight={600} mb={0.5}>
                                        ⚠️ CRITICAL WARNING
                                    </Typography>
                                    <Typography variant="body2" component="div" fontSize="0.85rem">
                                        • All current data will be DELETED
                                        <br />
                                        • Tables will be replaced with backup data
                                        <br />
                                        • This action CANNOT be undone
                                    </Typography>
                                </Alert>

                                <Alert severity="info" sx={{ borderRadius: 2 }}>
                                    <Typography variant="body2" fontWeight={500}>
                                        💡 Recommendation
                                    </Typography>
                                    <Typography variant="caption" display="block">
                                        Create a backup of current state before restoring
                                    </Typography>
                                </Alert>

                                {selectedBackup && (
                                    <Paper sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                                        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                                            BACKUP TO RESTORE:
                                        </Typography>
                                        <Stack spacing={0.5}>
                                            <Typography variant="body2"><strong>File:</strong> {selectedBackup.file_name}</Typography>
                                            <Typography variant="body2"><strong>Type:</strong> {selectedBackup.backup_type.toUpperCase()}</Typography>
                                            <Typography variant="body2"><strong>Date:</strong> {formatDate(selectedBackup.created_at)}</Typography>
                                            <Typography variant="body2"><strong>Size:</strong> {selectedBackup.file_size_mb} MB</Typography>
                                        </Stack>
                                    </Paper>
                                )}

                                <TextField
                                    fullWidth
                                    label="Type RESTORE to confirm"
                                    value={confirmRestore}
                                    onChange={(e) => setConfirmRestore(e.target.value.toUpperCase())}
                                    placeholder="RESTORE"
                                    error={confirmRestore.length > 0 && confirmRestore !== 'RESTORE'}
                                    helperText="Type RESTORE in capital letters to proceed"
                                    autoFocus={!isMobile}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            fontSize: { xs: '1rem', md: '1rem' }
                                        }
                                    }}
                                />
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
                            <Button
                                onClick={() => {
                                    setRestoreDialogOpen(false);
                                    setConfirmRestore('');
                                }}
                                fullWidth={isMobile}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                color="error"
                                onClick={handleRestoreBackup}
                                disabled={confirmRestore !== 'RESTORE'}
                                startIcon={<RestoreIcon />}
                                fullWidth={isMobile}
                                sx={{
                                    background: confirmRestore === 'RESTORE'
                                        ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                                        : undefined
                                }}
                            >
                                Restore Now
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Database Stats Dialog */}
                    <Dialog
                        open={statsDialogOpen}
                        onClose={() => setStatsDialogOpen(false)}
                        maxWidth="md"
                        fullWidth
                        fullScreen={isMobile}
                        PaperProps={{
                            sx: {
                                borderRadius: { xs: 0, sm: 3 },
                                m: { xs: 0, sm: 2 }
                            }
                        }}
                    >
                        <DialogTitle sx={{
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            py: { xs: 2, md: 2.5 }
                        }}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                <StorageIcon />
                                <Typography variant={isMobile ? 'h6' : 'h6'} fontWeight={600}>
                                    Database Statistics
                                </Typography>
                            </Stack>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                {dbStats && (
                                    <Stack alignItems="flex-end" spacing={0.25}>
                                        <Typography variant="caption" sx={{ opacity: 0.9, fontSize: { xs: '0.65rem', md: '0.7rem' } }}>
                                            Total Size
                                        </Typography>
                                        <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight={700} sx={{ lineHeight: 1 }}>
                                            {dbStats.total_database_size}
                                        </Typography>
                                    </Stack>
                                )}
                                {isMobile && (
                                    <IconButton onClick={() => setStatsDialogOpen(false)} sx={{ color: 'white' }}>
                                        <CloseIcon />
                                    </IconButton>
                                )}
                            </Stack>
                        </DialogTitle>
                        <DialogContent sx={{ pt: { xs: 1.5, md: 3 }, pb: { xs: 1, md: 2 }, px: { xs: 1.5, md: 3 } }}>
                            {dbStats && (
                                <Box>
                                    {isMobile ? (
                                        // Mobile Compact Table-like View
                                        <Box sx={{
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 1.5,
                                            overflow: 'hidden',
                                            bgcolor: 'white'
                                        }}>
                                            {/* Header */}
                                            <Box sx={{
                                                display: 'flex',
                                                bgcolor: 'grey.100',
                                                borderBottom: '2px solid',
                                                borderColor: 'divider',
                                                py: 0.75,
                                                px: 1.25
                                            }}>
                                                <Typography variant="caption" fontWeight={700} sx={{ flex: 1, fontSize: '0.7rem' }}>
                                                    Table Name
                                                </Typography>
                                                <Typography variant="caption" fontWeight={700} sx={{ width: 60, textAlign: 'right', fontSize: '0.7rem' }}>
                                                    Size
                                                </Typography>
                                            </Box>
                                            {/* Rows */}
                                            <Box sx={{ overflow: 'auto' }}>
                                                {dbStats.tables.map((table, index) => (
                                                    <Box
                                                        key={`${table.schema}.${table.table_name}-${index}`}
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            py: 0.75,
                                                            px: 1.25,
                                                            borderBottom: index < dbStats.tables.length - 1 ? '1px solid' : 'none',
                                                            borderColor: 'divider',
                                                            '&:active': {
                                                                bgcolor: 'action.selected'
                                                            }
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="body2"
                                                            fontFamily="monospace"
                                                            sx={{
                                                                flex: 1,
                                                                fontSize: '0.7rem',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                pr: 1
                                                            }}
                                                        >
                                                            {table.schema === 'public' ? table.table_name : `${table.schema}.${table.table_name}`}
                                                        </Typography>
                                                        <Chip
                                                            label={table.size}
                                                            size="small"
                                                            color="primary"
                                                            sx={{
                                                                height: 18,
                                                                fontSize: '0.65rem',
                                                                fontWeight: 600,
                                                                '& .MuiChip-label': {
                                                                    px: 0.75
                                                                }
                                                            }}
                                                        />
                                                    </Box>
                                                ))}
                                            </Box>
                                        </Box>
                                    ) : (
                                        // Desktop Compact Table View
                                        <TableContainer component={Paper} sx={{
                                            borderRadius: 2,
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            maxHeight: 400,
                                            overflow: 'auto'
                                        }}>
                                            <Table size="small" stickyHeader>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{
                                                            fontWeight: 700,
                                                            bgcolor: 'grey.100',
                                                            fontSize: '0.875rem',
                                                            py: 1.5
                                                        }}>
                                                            Table Name
                                                        </TableCell>
                                                        <TableCell align="right" sx={{
                                                            fontWeight: 700,
                                                            bgcolor: 'grey.100',
                                                            fontSize: '0.875rem',
                                                            py: 1.5,
                                                            width: 120
                                                        }}>
                                                            Size
                                                        </TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {dbStats.tables.map((table, index) => (
                                                        <TableRow
                                                            key={`${table.schema}.${table.table_name}-${index}`}
                                                            hover
                                                            sx={{
                                                                '&:hover': { bgcolor: 'action.hover' },
                                                                '&:last-child td': { border: 0 }
                                                            }}
                                                        >
                                                            <TableCell sx={{ py: 1.25 }}>
                                                                <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                                                                    {table.schema === 'public' ? table.table_name : `${table.schema}.${table.table_name}`}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell align="right" sx={{ py: 1.25 }}>
                                                                <Chip
                                                                    label={table.size}
                                                                    size="small"
                                                                    color="primary"
                                                                    variant="outlined"
                                                                    sx={{
                                                                        fontWeight: 600,
                                                                        fontSize: '0.75rem'
                                                                    }}
                                                                />
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}
                                </Box>
                            )}
                        </DialogContent>
                        <DialogActions sx={{ px: { xs: 1.5, md: 3 }, pb: { xs: 1.5, md: 3 }, pt: { xs: 1, md: 2 } }}>
                            <Button
                                onClick={() => setStatsDialogOpen(false)}
                                fullWidth={isMobile}
                                variant="contained"
                                size={isMobile ? "medium" : "large"}
                                sx={{
                                    py: { xs: 0.875, md: 1.25 },
                                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                                    fontWeight: 600,
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                                    }
                                }}
                            >
                                Close
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Schedules Management Dialog */}
                    <Dialog
                        open={schedulesDialogOpen}
                        onClose={() => setSchedulesDialogOpen(false)}
                        maxWidth="md"
                        fullWidth
                        fullScreen={isMobile}
                        PaperProps={{
                            sx: {
                                borderRadius: { xs: 0, sm: 3 },
                                m: { xs: 0, sm: 2 }
                            }
                        }}
                    >
                        <DialogTitle sx={{
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            py: { xs: 2, md: 2.5 }
                        }}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                <Typography fontSize="1.5rem">⏰</Typography>
                                <Typography variant={isMobile ? 'h6' : 'h6'} fontWeight={600}>
                                    Backup Schedules
                                </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={() => {
                                        setCurrentSchedule({
                                            name: '',
                                            frequency: 'daily',
                                            backup_type: 'full',
                                            enabled: true,
                                            time_of_day: '02:00:00',
                                            retention_days: 30
                                        });
                                        setScheduleFormOpen(true);
                                    }}
                                    sx={{
                                        bgcolor: 'white',
                                        color: 'warning.main',
                                        '&:hover': { bgcolor: 'grey.100' }
                                    }}
                                >
                                    + New
                                </Button>
                                {isMobile && (
                                    <IconButton onClick={() => setSchedulesDialogOpen(false)} sx={{ color: 'white' }}>
                                        <CloseIcon />
                                    </IconButton>
                                )}
                            </Stack>
                        </DialogTitle>
                        <DialogContent sx={{ pt: { xs: 2, md: 3 }, pb: 2 }}>
                            {schedules.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography color="text.secondary">No schedules configured</Typography>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => {
                                            setCurrentSchedule({
                                                name: '',
                                                frequency: 'daily',
                                                backup_type: 'full',
                                                enabled: true,
                                                time_of_day: '02:00:00',
                                                retention_days: 30
                                            });
                                            setScheduleFormOpen(true);
                                        }}
                                        sx={{ mt: 2 }}
                                    >
                                        Create First Schedule
                                    </Button>
                                </Box>
                            ) : (
                                <Stack spacing={2}>
                                    {schedules.map((schedule) => (
                                        <Card key={schedule.id} sx={{
                                            border: schedule.enabled ? '2px solid' : '1px solid',
                                            borderColor: schedule.enabled ? 'success.main' : 'divider'
                                        }}>
                                            <CardContent>
                                                <Stack direction="row" justifyContent="space-between" alignItems="start" mb={1}>
                                                    <Stack spacing={0.5} flex={1}>
                                                        <Stack direction="row" alignItems="center" spacing={1}>
                                                            <Typography variant="h6" fontWeight={600}>
                                                                {schedule.name}
                                                            </Typography>
                                                            <Chip
                                                                label={schedule.enabled ? 'Active' : 'Disabled'}
                                                                color={schedule.enabled ? 'success' : 'default'}
                                                                size="small"
                                                                sx={{ height: 20, fontSize: '0.7rem' }}
                                                            />
                                                        </Stack>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {schedule.description || 'No description'}
                                                        </Typography>
                                                        <Stack direction="row" spacing={2} mt={1}>
                                                            <Typography variant="caption">
                                                                <strong>Frequency:</strong> {schedule.frequency}
                                                            </Typography>
                                                            <Typography variant="caption">
                                                                <strong>Time:</strong> {schedule.time_of_day}
                                                            </Typography>
                                                            <Typography variant="caption">
                                                                <strong>Retention:</strong> {schedule.retention_days} days
                                                            </Typography>
                                                        </Stack>
                                                        {schedule.next_run_at && (
                                                            <Typography variant="caption" color="primary.main">
                                                                Next run: {new Date(schedule.next_run_at).toLocaleString()}
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                    <Stack direction="row" spacing={0.5}>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={async () => {
                                                                if (confirm(`Delete schedule "${schedule.name}"?`)) {
                                                                    try {
                                                                        await api.delete(`/backups/schedules/${schedule.id}`);
                                                                        toast.success('Schedule deleted');
                                                                        loadSchedules();
                                                                    } catch (error) {
                                                                        toast.error('Failed to delete schedule');
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Stack>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Stack>
                            )}
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 3 }}>
                            <Button onClick={() => setSchedulesDialogOpen(false)} fullWidth={isMobile}>
                                Close
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Schedule Form Dialog */}
                    <Dialog
                        open={scheduleFormOpen}
                        onClose={() => {
                            setScheduleFormOpen(false);
                            setCurrentSchedule(null);
                        }}
                        maxWidth="sm"
                        fullWidth
                        fullScreen={isMobile}
                    >
                        <DialogTitle sx={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <Box component="span" fontWeight={600} fontSize="1.25rem">
                                Create Backup Schedule
                            </Box>
                            {isMobile && (
                                <IconButton onClick={() => {
                                    setScheduleFormOpen(false);
                                    setCurrentSchedule(null);
                                }} sx={{ color: 'white' }}>
                                    <CloseIcon />
                                </IconButton>
                            )}
                        </DialogTitle>
                        <DialogContent sx={{ pt: 3, pb: 2 }}>
                            <Stack spacing={2.5}>
                                <TextField
                                    label="Schedule Name"
                                    fullWidth
                                    required
                                    value={currentSchedule?.name || ''}
                                    onChange={(e) => setCurrentSchedule({ ...currentSchedule, name: e.target.value })}
                                    placeholder="e.g., Daily Backup, Weekly Backup"
                                />

                                <FormControl fullWidth required>
                                    <InputLabel>Frequency</InputLabel>
                                    <Select
                                        value={currentSchedule?.frequency || 'daily'}
                                        onChange={(e) => setCurrentSchedule({ ...currentSchedule, frequency: e.target.value as any })}
                                        label="Frequency"
                                    >
                                        <MenuItem value="hourly">Hourly</MenuItem>
                                        <MenuItem value="daily">Daily</MenuItem>
                                        <MenuItem value="weekly">Weekly</MenuItem>
                                        <MenuItem value="monthly">Monthly</MenuItem>
                                    </Select>
                                </FormControl>

                                <TextField
                                    label="Time (24-hour format)"
                                    type="time"
                                    fullWidth
                                    value={currentSchedule?.time_of_day?.substring(0, 5) || '02:00'}
                                    onChange={(e) => setCurrentSchedule({ ...currentSchedule, time_of_day: e.target.value + ':00' })}
                                    helperText="When to run the backup"
                                />

                                <TextField
                                    label="Retention Days"
                                    type="number"
                                    fullWidth
                                    value={currentSchedule?.retention_days || 30}
                                    onChange={(e) => setCurrentSchedule({ ...currentSchedule, retention_days: parseInt(e.target.value) })}
                                    helperText="Auto-delete backups older than this (0 = never delete)"
                                />

                                <FormControl fullWidth>
                                    <InputLabel>Backup Type</InputLabel>
                                    <Select
                                        value={currentSchedule?.backup_type || 'full'}
                                        onChange={(e) => setCurrentSchedule({ ...currentSchedule, backup_type: e.target.value })}
                                        label="Backup Type"
                                    >
                                        <MenuItem value="full">Full Backup</MenuItem>
                                        <MenuItem value="schema">Schema Only</MenuItem>
                                        <MenuItem value="data">Data Only</MenuItem>
                                    </Select>
                                </FormControl>

                                <TextField
                                    label="Description (Optional)"
                                    multiline
                                    rows={2}
                                    fullWidth
                                    value={currentSchedule?.description || ''}
                                    onChange={(e) => setCurrentSchedule({ ...currentSchedule, description: e.target.value })}
                                    placeholder="e.g., Automated backup for production data"
                                />

                                <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
                                    <Typography variant="caption" display="block" fontWeight={600} mb={0.5}>
                                        💡 Note:
                                    </Typography>
                                    <Typography variant="caption">
                                        Schedule will run automatically at the specified time. Backups older than retention days will be auto-deleted.
                                    </Typography>
                                </Alert>
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
                            <Button
                                onClick={() => {
                                    setScheduleFormOpen(false);
                                    setCurrentSchedule(null);
                                }}
                                fullWidth={isMobile}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={async () => {
                                    if (!currentSchedule?.name || !currentSchedule?.frequency) {
                                        toast.error('Please fill required fields');
                                        return;
                                    }

                                    const toastId = toast.loading('Creating schedule...');
                                    try {
                                        await api.post('/backups/schedules', currentSchedule);
                                        toast.success('Schedule created successfully!', { id: toastId });
                                        setScheduleFormOpen(false);
                                        setCurrentSchedule(null);
                                        loadSchedules();
                                        loadHealthStats();
                                    } catch (error: any) {
                                        toast.error(error.response?.data?.error || 'Failed to create schedule', { id: toastId });
                                        console.error(error);
                                    }
                                }}
                                fullWidth={isMobile}
                                sx={{
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                    }
                                }}
                            >
                                Create Schedule
                            </Button>
                        </DialogActions>
                    </Dialog>

                </Box>
            </Box>
        </AppLayout >
    );
}
