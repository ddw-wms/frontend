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

import AppLayout from '@/components/AppLayout';
import { StandardPageHeader } from '@/components';
import api from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import { useBackupsPermissions } from '@/hooks/usePagePermissions';

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

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isDarkMode = theme.palette.mode === 'dark';
    const { activeWarehouse } = useWarehouse();
    const { canSeeButton, isAdmin, isLoading: permLoading } = useBackupsPermissions();
    const [user, setUser] = useState<any>(null);

    // Load user on mount
    useEffect(() => {
        const storedUser = getStoredUser();
        setUser(storedUser);
    }, []);

    const [backups, setBackups] = useState<Backup[]>([]);
    const [loading, setLoading] = useState(true);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
    const [backupType, setBackupType] = useState<'full' | 'selective'>('full');
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

    // Selective backup tables
    const [selectedTables, setSelectedTables] = useState<string[]>([]);

    // Available modules for selective backup
    const backupModules = [
        { id: 'master_data', name: 'Master Data', description: 'Product catalog & SKU data', icon: '📦' },
        { id: 'inbound', name: 'Inbound', description: 'All inbound entries', icon: '📥' },
        { id: 'qc', name: 'Quality Control', description: 'QC inspection records', icon: '✅' },
        { id: 'picking', name: 'Picking', description: 'Picking records', icon: '🛒' },
        { id: 'outbound', name: 'Outbound', description: 'Outbound/dispatch records', icon: '📤' },
        { id: 'warehouses', name: 'Warehouses', description: 'Warehouse configuration', icon: '🏭' },
        { id: 'customers', name: 'Customers', description: 'Customer data', icon: '👥' },
        { id: 'racks', name: 'Racks', description: 'Rack locations', icon: '🗄️' },
        { id: 'users', name: 'Users', description: 'User accounts & roles', icon: '👤' },
    ];



    const loadBackups = async (showLoader = true) => {
        try {
            // Only show full-page loader on initial load, not on refresh
            if (showLoader) setLoading(true);
            const response = await api.get('/backups');
            setBackups(response.data);
        } catch (error: any) {
            toast.error('Failed to load backups');
            console.error(error);
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    // Refresh backups without showing full-page loader (prevents flash)
    const refreshBackups = () => loadBackups(false);

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

    // Poll backup progress
    const pollBackupProgress = async (backupId: string, toastId: string) => {
        let attempts = 0;
        const maxAttempts = 600; // 10 minutes max (1 second intervals)

        const poll = async () => {
            try {
                const response = await api.get(`/backups/progress/${backupId}`);
                const { status, progress, message, result } = response.data;

                // Update toast with progress
                toast.loading(`${message} (${progress}%)`, { id: toastId });

                if (status === 'completed') {
                    toast.success(`✅ Backup created: ${result?.file_size_mb || ''} MB`, {
                        id: toastId,
                        duration: 5000
                    });
                    setCreateDialogOpen(false);
                    setDescription('');
                    setBackupType('full');
                    setSelectedTables([]);
                    refreshBackups();
                    return;
                }

                if (status === 'failed') {
                    toast.error(`❌ ${message}`, { id: toastId });
                    return;
                }

                // Continue polling
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(poll, 1000);
                } else {
                    toast.error('Backup timeout - please check backup list', { id: toastId });
                }
            } catch (error: any) {
                console.error('Progress poll error:', error);
                // Backup might have completed, refresh list
                refreshBackups();
                toast.dismiss(toastId);
            }
        };

        poll();
    };

    const handleCreateBackup = async () => {
        // Validate selective backup
        if (backupType === 'selective' && selectedTables.length === 0) {
            toast.error('Please select at least one module to backup');
            return;
        }

        const toastId = toast.loading('Starting backup...');
        try {
            let response;

            if (backupType === 'selective') {
                // Selective backup
                response = await api.post('/backups/selective', {
                    tables: selectedTables,
                    description: description || `Selective: ${selectedTables.join(', ')}`
                });
            } else {
                // Full backup
                response = await api.post('/backups', {
                    backup_type: 'full',
                    description,
                    use_json: true,
                    async_mode: true
                });
            }

            // Check if async mode
            if (response.data.backupId && response.data.status === 'in_progress') {
                // Poll for progress
                toast.loading('Backup started, processing...', { id: toastId });
                pollBackupProgress(response.data.backupId, toastId);
            } else {
                // Sync mode completed
                toast.success('Backup created successfully!', { id: toastId });
                setCreateDialogOpen(false);
                setDescription('');
                setBackupType('full');
                setSelectedTables([]);
                refreshBackups();
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.error ||
                error.response?.data?.message ||
                error.message ||
                'Backup failed - please try again';
            toast.error(errorMessage, { id: toastId });
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
            refreshBackups();
        } catch (error: any) {
            toast.error('Delete failed', { id: toastId });
            console.error(error);
        }
    };

    // Poll restore progress
    const pollRestoreProgress = async (restoreId: string, toastId: string) => {
        let attempts = 0;
        let consecutiveErrors = 0;
        const maxAttempts = 1800; // 30 minutes max (1 second intervals)
        const maxConsecutiveErrors = 15; // Give up after 15 consecutive errors

        const poll = async () => {
            try {
                const response = await api.get(`/backups/progress/${restoreId}`, { timeout: 10000 });
                const { status, progress, message, details, result } = response.data;

                // Reset error counter on success
                consecutiveErrors = 0;

                // Build detailed message
                let displayMessage = message;
                if (details?.currentTable) {
                    displayMessage = `${message} (${details.processedRows || 0}/${details.totalRows || 0} rows)`;
                }

                // Update toast with progress
                toast.loading(
                    <div style={{ minWidth: '280px' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>🔄 Restoring Database</div>
                        <div style={{ fontSize: '0.85em', color: '#666' }}>{displayMessage}</div>
                        <div style={{
                            marginTop: 8,
                            height: 6,
                            background: '#e2e8f0',
                            borderRadius: 3,
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${progress}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                        <div style={{ fontSize: '0.75em', color: '#888', marginTop: 4 }}>
                            {progress}% complete
                        </div>
                    </div>,
                    { id: toastId }
                );

                if (status === 'completed') {
                    const successCount = result?.success?.length || 0;
                    const totalRows = result?.totalRows || 0;
                    toast.success(
                        <div>
                            <div style={{ fontWeight: 600 }}>✅ Restore Complete!</div>
                            <div style={{ fontSize: '0.85em' }}>
                                {successCount} tables, {totalRows.toLocaleString()} rows restored
                            </div>
                        </div>,
                        { id: toastId, duration: 6000 }
                    );
                    setRestoreDialogOpen(false);
                    setSelectedBackup(null);
                    setConfirmRestore('');
                    // Reload all data without full page reload
                    refreshBackups();
                    loadDatabaseStats();
                    loadHealthStats();
                    loadSchedules();
                    return;
                }

                if (status === 'failed') {
                    toast.error(`❌ ${message}`, { id: toastId, duration: 8000 });
                    return;
                }

                // Continue polling
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(poll, 1000);
                } else {
                    toast.error('Restore timeout - please check restore logs', { id: toastId });
                }
            } catch (error: any) {
                console.error('Restore progress poll error:', error);
                consecutiveErrors++;
                attempts++;

                // Handle 404 - restore ID not found (might have expired or server restarted)
                if (error.response?.status === 404) {
                    toast.dismiss(toastId);
                    toast.success('Restore may have completed - refreshing backups list');
                    refreshBackups();
                    loadDatabaseStats();
                    return;
                }

                // Keep trying if under error limit
                if (consecutiveErrors < maxConsecutiveErrors && attempts < maxAttempts) {
                    setTimeout(poll, 2000); // Slower polling on errors
                } else {
                    toast.dismiss(toastId);
                    toast.error('Lost connection to server - please refresh and check restore status');
                    refreshBackups();
                }
            }
        };

        poll();
    };

    const handleRestoreBackup = async () => {
        if (confirmRestore !== 'RESTORE') {
            toast.error('Please type RESTORE to confirm');
            return;
        }

        if (!selectedBackup) return;

        const toastId = toast.loading('Connecting to server...');

        try {
            // First, wake up the server with a health check (Render free tier sleeps)
            try {
                await api.get('/health', { timeout: 30000 });
            } catch (healthError) {
                // Retry once after a delay
                await new Promise(resolve => setTimeout(resolve, 2000));
                await api.get('/health', { timeout: 30000 });
            }

            toast.loading('Starting restore...', { id: toastId });

            const response = await api.post(`/backups/restore/${selectedBackup.id}`, {
                confirm: true
            });

            // Check if async mode
            if (response.data.restoreId && response.data.status === 'in_progress') {
                toast.loading('Restore started, please wait...', { id: toastId });
                pollRestoreProgress(response.data.restoreId, toastId);
            } else {
                // Sync mode completed (shouldn't happen with new code)
                toast.success('✅ Database restored successfully!', {
                    id: toastId,
                    duration: 6000
                });
                setRestoreDialogOpen(false);
                setSelectedBackup(null);
                setConfirmRestore('');
                // Reload all data without full page reload
                refreshBackups();
                loadDatabaseStats();
                loadHealthStats();
                loadSchedules();
            }
        } catch (error: any) {
            const errorMsg = error.response?.data?.details ||
                error.response?.data?.error ||
                error.message ||
                'Restore failed';
            toast.error(`❌ ${errorMsg}`, { id: toastId, duration: 8000 });
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

    // Load initial data on mount
    useEffect(() => {
        loadBackups();
        loadDatabaseStats();
        loadHealthStats();
        loadSchedules();
    }, []);



    if (loading) {
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
                p: { xs: 0.75, md: 1 },
                background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                height: '100%',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>

                {/* ==================== HEADER SECTION ==================== */}
                <StandardPageHeader
                    title="Backup & Restore"
                    subtitle="Securely backup and restore your WMS database"
                    icon="💾"
                    warehouseName={activeWarehouse?.name}
                    userName={user?.full_name}
                />

                {/* Content */}
                <Box sx={{
                    flex: 1,
                    overflow: 'auto',
                    p: { xs: 1.5, sm: 2, md: 3 },
                    background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                }}>

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
                            background: isDarkMode
                                ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                                : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                            border: '1px solid',
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'primary.light',
                            borderRadius: 2
                        }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                    <Typography variant="h6" fontWeight={700} sx={{ color: isDarkMode ? '#93c5fd' : 'primary.main' }}>
                                        📊 Backup Health Dashboard
                                    </Typography>
                                </Stack>
                                {canSeeButton('schedules') && (
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => setSchedulesDialogOpen(true)}
                                        sx={{ fontSize: { xs: '0.7rem', sm: '0.85rem' } }}
                                    >
                                        ⏰ Schedules ({schedules.length})
                                    </Button>
                                )}
                            </Stack>

                            <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                                gap: 2
                            }}>
                                <Card sx={{ bgcolor: isDarkMode ? '#1e293b' : 'white', boxShadow: 2 }}>
                                    <CardContent sx={{ textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                            Success Rate
                                        </Typography>
                                        <Typography variant="h4" fontWeight={700} color="success.main" sx={{ my: 0.5 }}>
                                            {Number(healthStats?.success_rate ?? 0).toFixed(1)}%
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {healthStats?.successful_backups ?? 0}/{healthStats?.total_backups ?? 0} successful
                                        </Typography>
                                    </CardContent>
                                </Card>

                                <Card sx={{ bgcolor: isDarkMode ? '#1e293b' : 'white', boxShadow: 2 }}>
                                    <CardContent sx={{ textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                            Total Storage
                                        </Typography>
                                        <Typography variant="h5" fontWeight={700} color="primary.main" sx={{ my: 0.5, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                                            {healthStats?.total_storage_used_formatted ?? '0 B'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Avg: {healthStats?.average_backup_size_formatted ?? '0 B'}
                                        </Typography>
                                    </CardContent>
                                </Card>

                                <Card sx={{ bgcolor: isDarkMode ? '#1e293b' : 'white', boxShadow: 2 }}>
                                    <CardContent sx={{ textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                            Last Backup
                                        </Typography>
                                        <Typography variant="body1" fontWeight={600} sx={{ my: 0.5, fontSize: { xs: '0.85rem', sm: '1rem' } }}>
                                            {healthStats?.last_backup_at ? new Date(String(healthStats!.last_backup_at)).toLocaleDateString() : 'Never'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {healthStats?.last_backup_size_formatted ?? '0 B'}
                                        </Typography>
                                    </CardContent>
                                </Card>

                                <Card sx={{ bgcolor: isDarkMode ? '#1e293b' : 'white', boxShadow: 2 }}>
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
                        {canSeeButton('create') && (
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
                        )}
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
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'divider',
                            bgcolor: isDarkMode ? '#1e293b' : 'background.paper'
                        }}>
                            <StorageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                No Backups Yet
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={3}>
                                Create your first backup to secure your data
                            </Typography>
                            {canSeeButton('create') && (
                                <Button
                                    variant="contained"
                                    startIcon={<BackupIcon />}
                                    onClick={() => setCreateDialogOpen(true)}
                                >
                                    Create First Backup
                                </Button>
                            )}
                        </Paper>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            {!isMobile ? (
                                <TableContainer component={Paper} sx={{
                                    borderRadius: 2,
                                    boxShadow: isDarkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.08)',
                                    border: '1px solid',
                                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider',
                                    bgcolor: isDarkMode ? '#1e293b' : 'background.paper'
                                }}>
                                    <Table>
                                        <TableHead>
                                            <TableRow sx={{
                                                bgcolor: isDarkMode ? '#334155' : 'grey.100',
                                                '& th': {
                                                    borderBottom: '2px solid',
                                                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider',
                                                    color: isDarkMode ? '#f1f5f9' : 'inherit'
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
                                                            {canSeeButton('restore') && (
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
                                                            )}
                                                            {canSeeButton('delete') && (
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
                                                            )}
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
                                                        {canSeeButton('restore') && (
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
                                                        )}
                                                        {canSeeButton('delete') && (
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
                                                        )}
                                                    </Stack>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Stack>
                            )}
                        </>
                    )}

                    {/* Create Backup Dialog - Enhanced */}
                    <Dialog
                        open={createDialogOpen}
                        onClose={() => {
                            setCreateDialogOpen(false);
                            setSelectedTables([]);
                            setBackupType('full');
                        }}
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
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            py: { xs: 2, md: 2.5 }
                        }}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                <BackupIcon />
                                <Typography variant="h6" fontWeight={600}>
                                    Create New Backup
                                </Typography>
                            </Stack>
                            {isMobile && (
                                <IconButton onClick={() => setCreateDialogOpen(false)} sx={{ color: 'white' }}>
                                    <CloseIcon />
                                </IconButton>
                            )}
                        </DialogTitle>
                        <DialogContent sx={{ pt: 3, pb: 2, px: { xs: 2, md: 3 } }}>
                            <Stack spacing={3} sx={{ pt: 1 }}>
                                {/* Backup Type Selection */}
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Select Backup Type
                                    </Typography>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                        <Card
                                            onClick={() => setBackupType('full')}
                                            sx={{
                                                flex: 1,
                                                cursor: 'pointer',
                                                border: backupType === 'full' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                                bgcolor: backupType === 'full' ? 'rgba(59, 130, 246, 0.05)' : 'white',
                                                transition: 'all 0.2s',
                                                '&:hover': { borderColor: '#3b82f6' }
                                            }}
                                        >
                                            <CardContent sx={{ p: 2 }}>
                                                <Stack direction="row" spacing={2} alignItems="center">
                                                    <Box sx={{
                                                        width: 48, height: 48, borderRadius: 2,
                                                        bgcolor: 'rgba(59, 130, 246, 0.1)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '1.5rem'
                                                    }}>
                                                        💾
                                                    </Box>
                                                    <Box>
                                                        <Typography fontWeight={600}>Full Backup</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            All tables & data (~{healthStats?.average_backup_size_formatted || '30 MB'})
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </CardContent>
                                        </Card>

                                        <Card
                                            onClick={() => setBackupType('selective')}
                                            sx={{
                                                flex: 1,
                                                cursor: 'pointer',
                                                border: backupType === 'selective' ? '2px solid #10b981' : '1px solid #e2e8f0',
                                                bgcolor: backupType === 'selective' ? 'rgba(16, 185, 129, 0.05)' : 'white',
                                                transition: 'all 0.2s',
                                                '&:hover': { borderColor: '#10b981' }
                                            }}
                                        >
                                            <CardContent sx={{ p: 2 }}>
                                                <Stack direction="row" spacing={2} alignItems="center">
                                                    <Box sx={{
                                                        width: 48, height: 48, borderRadius: 2,
                                                        bgcolor: 'rgba(16, 185, 129, 0.1)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '1.5rem'
                                                    }}>
                                                        ✂️
                                                    </Box>
                                                    <Box>
                                                        <Typography fontWeight={600}>Selective Backup</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Choose specific modules
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    </Stack>
                                </Box>

                                {/* Selective Module Selection */}
                                {backupType === 'selective' && (
                                    <Box>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                                            <Typography variant="subtitle2" color="text.secondary">
                                                Select Modules to Backup ({selectedTables.length} selected)
                                            </Typography>
                                            <Button
                                                size="small"
                                                onClick={() => {
                                                    if (selectedTables.length === backupModules.length) {
                                                        setSelectedTables([]);
                                                    } else {
                                                        setSelectedTables(backupModules.map(m => m.id));
                                                    }
                                                }}
                                            >
                                                {selectedTables.length === backupModules.length ? 'Deselect All' : 'Select All'}
                                            </Button>
                                        </Stack>
                                        <Box sx={{
                                            display: 'grid',
                                            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
                                            gap: 1.5
                                        }}>
                                            {backupModules.map((module) => (
                                                <Card
                                                    key={module.id}
                                                    onClick={() => {
                                                        setSelectedTables(prev =>
                                                            prev.includes(module.id)
                                                                ? prev.filter(t => t !== module.id)
                                                                : [...prev, module.id]
                                                        );
                                                    }}
                                                    sx={{
                                                        cursor: 'pointer',
                                                        border: selectedTables.includes(module.id)
                                                            ? '2px solid #10b981'
                                                            : '1px solid #e2e8f0',
                                                        bgcolor: selectedTables.includes(module.id)
                                                            ? 'rgba(16, 185, 129, 0.08)'
                                                            : 'white',
                                                        transition: 'all 0.15s',
                                                        '&:hover': {
                                                            borderColor: '#10b981',
                                                            transform: 'scale(1.02)'
                                                        }
                                                    }}
                                                >
                                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                                        <Stack direction="row" spacing={1} alignItems="center">
                                                            <Typography fontSize="1.2rem">{module.icon}</Typography>
                                                            <Box>
                                                                <Typography variant="body2" fontWeight={500} noWrap>
                                                                    {module.name}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary" noWrap>
                                                                    {module.description}
                                                                </Typography>
                                                            </Box>
                                                        </Stack>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </Box>
                                    </Box>
                                )}

                                <TextField
                                    label="Description (Optional)"
                                    multiline
                                    rows={2}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="e.g., Before major update, Weekly backup..."
                                    fullWidth
                                    size="small"
                                />

                                <Alert severity="success" icon={false} sx={{ borderRadius: 2 }}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Typography>✅</Typography>
                                        <Box>
                                            <Typography variant="body2" fontWeight={500}>Supabase Compatible</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                JSON format • No pg_dump required • Works with large data
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Alert>
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1 }}>
                            <Button
                                onClick={() => {
                                    setCreateDialogOpen(false);
                                    setSelectedTables([]);
                                    setBackupType('full');
                                }}
                                size="large"
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleCreateBackup}
                                startIcon={<BackupIcon />}
                                disabled={backupType === 'selective' && selectedTables.length === 0}
                                size="large"
                                sx={{
                                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                    fontWeight: 600,
                                    px: 4,
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                    }
                                }}
                            >
                                {backupType === 'selective'
                                    ? `Backup ${selectedTables.length} Module${selectedTables.length !== 1 ? 's' : ''}`
                                    : 'Create Full Backup'
                                }
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Restore Confirmation Dialog */}
                    <Dialog
                        open={restoreDialogOpen}
                        onClose={() => {
                            setRestoreDialogOpen(false);
                            setConfirmRestore('');
                        }}
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
                            py: 2.5
                        }}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                <WarningIcon />
                                <Typography variant="h6" fontWeight={600}>
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
                                    <Paper sx={{ p: 2, bgcolor: isDarkMode ? '#334155' : 'grey.50', borderRadius: 2 }}>
                                        <Typography variant="caption" sx={{ color: isDarkMode ? '#94a3b8' : 'text.secondary' }} display="block" mb={1}>
                                            BACKUP TO RESTORE:
                                        </Typography>
                                        <Stack spacing={0.5}>
                                            <Typography variant="body2" sx={{ color: isDarkMode ? '#f1f5f9' : 'inherit' }}><strong>File:</strong> {selectedBackup?.file_name ?? ''}</Typography>
                                            <Typography variant="body2" sx={{ color: isDarkMode ? '#f1f5f9' : 'inherit' }}><strong>Type:</strong> {selectedBackup?.backup_type?.toUpperCase() ?? ''}</Typography>
                                            <Typography variant="body2" sx={{ color: isDarkMode ? '#f1f5f9' : 'inherit' }}><strong>Date:</strong> {formatDate(selectedBackup?.created_at ?? '')}</Typography>
                                            <Typography variant="body2" sx={{ color: isDarkMode ? '#f1f5f9' : 'inherit' }}><strong>Size:</strong> {selectedBackup?.file_size_mb ?? 0} MB</Typography>
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
                                            {dbStats?.total_database_size}
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
                        <DialogContent sx={{ pt: { xs: 1.5, md: 3 }, pb: { xs: 1, md: 2 }, px: { xs: 1.5, md: 3 }, bgcolor: isDarkMode ? '#0f172a' : 'background.paper' }}>
                            {dbStats && (
                                <Box>
                                    {isMobile ? (
                                        // Mobile Compact Table-like View
                                        <Box sx={{
                                            border: '1px solid',
                                            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider',
                                            borderRadius: 1.5,
                                            overflow: 'hidden',
                                            bgcolor: isDarkMode ? '#1e293b' : 'white'
                                        }}>
                                            {/* Header */}
                                            <Box sx={{
                                                display: 'flex',
                                                bgcolor: isDarkMode ? '#334155' : 'grey.100',
                                                borderBottom: '2px solid',
                                                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider',
                                                py: 0.75,
                                                px: 1.25
                                            }}>
                                                <Typography variant="caption" fontWeight={700} sx={{ flex: 1, fontSize: '0.7rem', color: isDarkMode ? '#f1f5f9' : 'inherit' }}>
                                                    Table Name
                                                </Typography>
                                                <Typography variant="caption" fontWeight={700} sx={{ width: 60, textAlign: 'right', fontSize: '0.7rem', color: isDarkMode ? '#f1f5f9' : 'inherit' }}>
                                                    Size
                                                </Typography>
                                            </Box>
                                            {/* Rows */}
                                            <Box sx={{ overflow: 'auto' }}>
                                                {dbStats?.tables?.map((table, index) => (
                                                    <Box
                                                        key={`${table.schema}.${table.table_name}-${index}`}
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            py: 0.75,
                                                            px: 1.25,
                                                            borderBottom: index < (dbStats?.tables?.length ?? 0) - 1 ? '1px solid' : 'none',
                                                            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider',
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
                                                                pr: 1,
                                                                color: isDarkMode ? '#f1f5f9' : 'inherit'
                                                            }}
                                                        >
                                                            {table.schema === 'public' ? table.table_name : `${table.schema}.${table.table_name}`}
                                                        </Typography>
                                                        <Chip
                                                            label={table.size}
                                                            size="small"
                                                            sx={{
                                                                height: 18,
                                                                fontSize: '0.65rem',
                                                                fontWeight: 600,
                                                                bgcolor: isDarkMode ? '#6366f1' : '#e0e7ff',
                                                                color: isDarkMode ? '#ffffff' : '#3730a3',
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
                                            boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
                                            border: '1px solid',
                                            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider',
                                            maxHeight: 400,
                                            overflow: 'auto',
                                            bgcolor: isDarkMode ? '#1e293b' : 'white'
                                        }}>
                                            <Table size="small" stickyHeader>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{
                                                            fontWeight: 700,
                                                            bgcolor: isDarkMode ? '#334155' : 'grey.100',
                                                            color: isDarkMode ? '#f1f5f9' : 'inherit',
                                                            fontSize: '0.875rem',
                                                            py: 1.5
                                                        }}>
                                                            Table Name
                                                        </TableCell>
                                                        <TableCell align="right" sx={{
                                                            fontWeight: 700,
                                                            bgcolor: isDarkMode ? '#334155' : 'grey.100',
                                                            color: isDarkMode ? '#f1f5f9' : 'inherit',
                                                            fontSize: '0.875rem',
                                                            py: 1.5,
                                                            width: 120
                                                        }}>
                                                            Size
                                                        </TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {dbStats?.tables?.map((table, index) => (
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
                                                                    sx={{
                                                                        fontWeight: 600,
                                                                        fontSize: '0.75rem',
                                                                        bgcolor: isDarkMode ? '#6366f1' : '#e0e7ff',
                                                                        color: isDarkMode ? '#ffffff' : '#3730a3'
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
                        <DialogActions sx={{
                            px: { xs: 1.5, md: 3 },
                            pb: { xs: 1.5, md: 3 },
                            pt: { xs: 1, md: 2 },
                            bgcolor: isDarkMode ? '#1e293b' : 'background.paper',
                            borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e0e0e0'
                        }}>
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
                                        bgcolor: isDarkMode ? '#1e293b' : 'white',
                                        color: 'warning.main',
                                        '&:hover': { bgcolor: isDarkMode ? '#334155' : 'grey.100' }
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
