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
    Stack
} from '@mui/material';
import {
    CloudDownload as DownloadIcon,
    CloudUpload as BackupIcon,
    Delete as DeleteIcon,
    Restore as RestoreIcon,
    Storage as StorageIcon,
    Info as InfoIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { useRoleGuard } from '@/hooks/useRoleGuard';
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

export default function BackupPage() {
    useRoleGuard(['admin']);

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

    useEffect(() => {
        loadBackups();
        loadDatabaseStats();
    }, []);

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
            toast.error('Download failed', { id: toastId });
            console.error(error);
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

    return (
        <AppLayout>
            <Toaster position="top-center" />
            <Box sx={{
                p: { xs: 0.75, md: 1 },
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                minHeight: { xs: 'calc(100vh - 60px)', md: '100%' },
                width: '100%',
                display: 'flex',
                flex: { md: 1 },
                flexDirection: 'column',
                overflowY: 'auto',
                overflowX: 'auto',
                pb: { xs: 0.5, md: 0 }
            }}>

                {/* Header */}
                <Box sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1000,
                    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                    borderRadius: { xs: '12px 12px 0 0', md: '16px 16px 0 0' },
                    p: { xs: 1.5, md: 2.5 },
                    mb: { xs: 1.5, md: 2 },
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
                        🔄 Database Backup & Restore
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        Manage database backups and restore points
                    </Typography>
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1 }}>

                    {/* Statistics Card */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'space-around' }}>
                                <Box textAlign="center" sx={{ minWidth: 120 }}>
                                    <Typography variant="h4" color="primary.main">
                                        {backups.length}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Total Backups
                                    </Typography>
                                </Box>
                                <Box textAlign="center" sx={{ minWidth: 120 }}>
                                    <Typography variant="h4" color="success.main">
                                        {dbStats?.total_database_size || '...'}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Database Size
                                    </Typography>
                                </Box>
                                <Box textAlign="center" sx={{ minWidth: 120 }}>
                                    <Typography variant="h4" color="info.main">
                                        {backups.filter(b => b.backup_type === 'full' || b.backup_type === 'json').length}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Full Backups
                                    </Typography>
                                </Box>
                                <Box textAlign="center" sx={{ minWidth: 120 }}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<InfoIcon />}
                                        onClick={() => setStatsDialogOpen(true)}
                                        fullWidth={isMobile}
                                    >
                                        View Details
                                    </Button>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Button
                            variant="contained"
                            startIcon={<BackupIcon />}
                            onClick={() => setCreateDialogOpen(true)}
                        >
                            Create Backup
                        </Button>
                    </Box>

                    {/* Important Notice */}
                    <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
                        <strong>Important:</strong> Database restore will overwrite current data.
                        Always create a backup before restoring. For Supabase, you can also use
                        their built-in backup features.
                    </Alert>

                    {/* Backups Table */}
                    {loading ? (
                        <Box display="flex" justifyContent="center" py={4}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>File Name</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Size</TableCell>
                                        <TableCell>Description</TableCell>
                                        <TableCell>Created At</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {backups.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center">
                                                <Typography variant="body2" color="text.secondary" py={4}>
                                                    No backups found. Create your first backup to get started.
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        backups.map((backup) => (
                                            <TableRow key={backup.id} hover>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={500}>
                                                        {backup.file_name}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={backup.backup_type.toUpperCase()}
                                                        color={getBackupTypeColor(backup.backup_type) as any}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell>{backup.file_size_mb} MB</TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {backup.description || '-'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>{formatDate(backup.created_at)}</TableCell>
                                                <TableCell align="right">
                                                    <Tooltip title="Download">
                                                        <IconButton
                                                            size="small"
                                                            color="primary"
                                                            onClick={() => handleDownloadBackup(backup)}
                                                        >
                                                            <DownloadIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Restore">
                                                        <IconButton
                                                            size="small"
                                                            color="success"
                                                            onClick={() => {
                                                                setSelectedBackup(backup);
                                                                setRestoreDialogOpen(true);
                                                            }}
                                                        >
                                                            <RestoreIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Delete">
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => handleDeleteBackup(backup)}
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}

                    {/* Create Backup Dialog */}
                    <Dialog
                        open={createDialogOpen}
                        onClose={() => setCreateDialogOpen(false)}
                        maxWidth="sm"
                        fullWidth
                    >
                        <DialogTitle>Create New Backup</DialogTitle>
                        <DialogContent>
                            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <FormControl fullWidth>
                                    <InputLabel>Backup Type</InputLabel>
                                    <Select
                                        value={backupType}
                                        onChange={(e) => setBackupType(e.target.value as any)}
                                        label="Backup Type"
                                    >
                                        <MenuItem value="full">Full Backup (Schema + Data)</MenuItem>
                                        <MenuItem value="schema">Schema Only</MenuItem>
                                        <MenuItem value="data">Data Only</MenuItem>
                                    </Select>
                                </FormControl>

                                <TextField
                                    label="Description (Optional)"
                                    multiline
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="e.g., Before major update, Weekly backup, etc."
                                />

                                <Alert severity="info">
                                    <strong>Note:</strong> This requires pg_dump to be installed on the server.
                                    For production on Supabase, use their backup features.
                                </Alert>
                            </Box>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                            <Button
                                variant="contained"
                                onClick={handleCreateBackup}
                                startIcon={<BackupIcon />}
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
                    >
                        <DialogTitle>
                            <Box display="flex" alignItems="center" gap={1}>
                                <WarningIcon color="warning" />
                                Restore Database
                            </Box>
                        </DialogTitle>
                        <DialogContent>
                            <Box sx={{ pt: 2 }}>
                                <Alert severity="error" sx={{ mb: 2 }}>
                                    <strong>⚠️ WARNING:</strong> This will DELETE all current data and replace it with backup data.
                                    <br />
                                    <strong>Tables affected:</strong> warehouses, customers, racks, master_data, inbound, qc, picking, outbound, etc.
                                    <br />
                                    <strong>This action CANNOT be undone!</strong>
                                </Alert>

                                <Alert severity="info" sx={{ mb: 2 }}>
                                    <strong>💡 Tip:</strong> Create a backup of current state before restoring, so you can revert if needed.
                                </Alert>

                                {selectedBackup && (
                                    <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                                        <Typography variant="body2"><strong>File:</strong> {selectedBackup.file_name}</Typography>
                                        <Typography variant="body2"><strong>Type:</strong> {selectedBackup.backup_type.toUpperCase()}</Typography>
                                        <Typography variant="body2"><strong>Date:</strong> {formatDate(selectedBackup.created_at)}</Typography>
                                        <Typography variant="body2"><strong>Size:</strong> {selectedBackup.file_size_mb} MB</Typography>
                                    </Box>
                                )}

                                <TextField
                                    fullWidth
                                    label="Type RESTORE to confirm"
                                    value={confirmRestore}
                                    onChange={(e) => setConfirmRestore(e.target.value.toUpperCase())}
                                    placeholder="RESTORE"
                                    error={confirmRestore.length > 0 && confirmRestore !== 'RESTORE'}
                                    helperText="Type RESTORE in capital letters to confirm"
                                />
                            </Box>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => {
                                setRestoreDialogOpen(false);
                                setConfirmRestore('');
                            }}>
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                color="error"
                                onClick={handleRestoreBackup}
                                disabled={confirmRestore !== 'RESTORE'}
                                startIcon={<RestoreIcon />}
                            >
                                Restore Database
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Database Stats Dialog */}
                    <Dialog
                        open={statsDialogOpen}
                        onClose={() => setStatsDialogOpen(false)}
                        maxWidth="md"
                        fullWidth
                    >
                        <DialogTitle>Database Statistics</DialogTitle>
                        <DialogContent>
                            {dbStats && (
                                <Box sx={{ pt: 2 }}>
                                    <Typography variant="h6" gutterBottom>
                                        Total Database Size: {dbStats.total_database_size}
                                    </Typography>

                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Table Name</TableCell>
                                                    <TableCell align="right">Size</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {dbStats.tables.map((table, index) => (
                                                    <TableRow key={`${table.schema}.${table.table_name}-${index}`}>
                                                        <TableCell>
                                                            {table.schema === 'public' ? table.table_name : `${table.schema}.${table.table_name}`}
                                                        </TableCell>
                                                        <TableCell align="right">{table.size}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setStatsDialogOpen(false)}>Close</Button>
                        </DialogActions>
                    </Dialog>

                </Box>
            </Box>
        </AppLayout>
    );
}
