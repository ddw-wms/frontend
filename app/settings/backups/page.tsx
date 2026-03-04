'use client';

import { useEffect, useState, useMemo } from 'react';
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
    Collapse,
    Checkbox,
    FormControlLabel,
    InputAdornment,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Badge,
    Tabs,
    Tab
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
    Close as CloseIcon,
    Search as SearchIcon,
    ExpandMore as ExpandMoreIcon,
    SelectAll as SelectAllIcon,
    DeleteSweep as DeleteSweepIcon,
    CalendarMonth as CalendarIcon,
    FilterList as FilterIcon,
    UploadFile as UploadFileIcon
} from '@mui/icons-material';

import AppLayout from '@/components/AppLayout';
import { StandardPageHeader } from '@/components';
import api from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import { useBackupsPermissions } from '@/hooks/usePagePermissions';
import { alpha } from '@mui/material/styles';
import { CheckCircleOutline as CheckIcon } from '@mui/icons-material';
import BackupTimeline from '@/components/BackupTimeline';
import AutoBackupSettings from '@/components/AutoBackupSettings';

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
    const [restoreTableSelectOpen, setRestoreTableSelectOpen] = useState(false);
    const [restorePreviewTables, setRestorePreviewTables] = useState<{ table: string; backupRows: number; dbRows: number }[]>([]);
    const [restoreSelectedTables, setRestoreSelectedTables] = useState<string[]>([]);
    const [restorePreviewLoading, setRestorePreviewLoading] = useState(false);
    const [restoreResultDialogOpen, setRestoreResultDialogOpen] = useState(false);
    const [restoreResult, setRestoreResult] = useState<any>(null);
    const [uploadRestoreFile, setUploadRestoreFile] = useState<File | null>(null);
    const [uploadRestoreLoading, setUploadRestoreLoading] = useState(false);
    const [uploadTempFilePath, setUploadTempFilePath] = useState<string>('');
    const [cloudRestoreDialogOpen, setCloudRestoreDialogOpen] = useState(false);
    const [cloudRestoreLoading, setCloudRestoreLoading] = useState(false);
    const [cloudTempFilePath, setCloudTempFilePath] = useState<string>('');
    const [cloudFileName, setCloudFileName] = useState<string>('');
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
    // Selective tables for schedule
    const [scheduleSelectedTables, setScheduleSelectedTables] = useState<string[]>([]);

    // NEW: Bulk selection and filtering states
    const [selectedBackupIds, setSelectedBackupIds] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [expandedDays, setExpandedDays] = useState<string[]>([]);
    const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
    const [activeTab, setActiveTab] = useState(0);

    // Available modules for selective backup
    const backupModules = [
        { id: 'master_data', name: 'Master Data', description: 'Product catalog & SKU data', icon: '📦' },
        { id: 'inbound', name: 'Inbound', description: 'All inbound entries', icon: '📥' },
        { id: 'qc', name: 'Quality Control', description: 'QC inspection records', icon: '✅' },
        { id: 'picking', name: 'Picking', description: 'Picking records', icon: '🛒' },
        { id: 'outbound', name: 'Outbound', description: 'Outbound/dispatch records', icon: '📤' },
        { id: 'rejections', name: 'Rejections', description: 'Rejection & credit note tracking', icon: '🚫' },
        { id: 'warehouses', name: 'Warehouses', description: 'Warehouse configuration', icon: '🏭' },
        { id: 'customers', name: 'Customers', description: 'Customer data', icon: '👥' },
        { id: 'racks', name: 'Racks', description: 'Rack locations', icon: '🗄️' },
        { id: 'users', name: 'Users', description: 'User accounts & roles', icon: '👤' },
        { id: 'roles', name: 'Roles & Permissions', description: 'RBAC roles, permissions & overrides', icon: '🔐' },
        { id: 'upload_logs', name: 'Upload History', description: 'Upload logs & batch snapshots', icon: '📋' },
    ];

    // Group backups by date
    const groupedBackups = useMemo(() => {
        let filtered = backups;

        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(b =>
                b.file_name.toLowerCase().includes(query) ||
                b.description?.toLowerCase().includes(query)
            );
        }

        // Apply type filter
        if (filterType !== 'all') {
            filtered = filtered.filter(b => b.backup_type === filterType);
        }

        // Group by date
        const groups: { [key: string]: Backup[] } = {};
        filtered.forEach(backup => {
            const date = new Date(backup.created_at).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(backup);
        });

        // Sort days (newest first)
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            const dateA = new Date(groups[a][0].created_at);
            const dateB = new Date(groups[b][0].created_at);
            return dateB.getTime() - dateA.getTime();
        });

        return { groups, sortedKeys, totalFiltered: filtered.length };
    }, [backups, searchQuery, filterType]);

    // Auto-expand today's backups
    useEffect(() => {
        if (groupedBackups.sortedKeys.length > 0 && expandedDays.length === 0) {
            setExpandedDays([groupedBackups.sortedKeys[0]]);
        }
    }, [groupedBackups.sortedKeys]);

    // Calculate total size of selected backups
    const selectedBackupsSize = useMemo(() => {
        const selected = backups.filter(b => selectedBackupIds.includes(b.id));
        const totalMB = selected.reduce((sum, b) => sum + parseFloat(b.file_size_mb || '0'), 0);
        return totalMB.toFixed(2);
    }, [backups, selectedBackupIds]);

    // Handle bulk delete
    const handleBulkDelete = async () => {
        if (selectedBackupIds.length === 0) return;

        const toastId = toast.loading(`Deleting ${selectedBackupIds.length} backups...`);
        try {
            const response = await api.post('/backups/bulk-delete', { ids: selectedBackupIds });
            toast.success(`✅ ${response.data.deletedCount} backup(s) deleted!`, { id: toastId });
            setSelectedBackupIds([]);
            setBulkDeleteDialogOpen(false);
            refreshBackups();
            loadHealthStats();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete backups', { id: toastId });
        }
    };

    // Toggle backup selection
    const toggleBackupSelection = (id: number) => {
        setSelectedBackupIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    // Select all backups in a day group
    const selectAllInDay = (day: string) => {
        const dayBackupIds = groupedBackups.groups[day].map(b => b.id);
        const allSelected = dayBackupIds.every(id => selectedBackupIds.includes(id));

        if (allSelected) {
            setSelectedBackupIds(prev => prev.filter(id => !dayBackupIds.includes(id)));
        } else {
            setSelectedBackupIds(prev => Array.from(new Set([...prev, ...dayBackupIds])));
        }
    };

    // Select all visible backups
    const selectAllVisible = () => {
        const visibleIds = groupedBackups.sortedKeys.flatMap(day =>
            groupedBackups.groups[day].map(b => b.id)
        );
        const allSelected = visibleIds.every(id => selectedBackupIds.includes(id));

        if (allSelected) {
            setSelectedBackupIds([]);
        } else {
            setSelectedBackupIds(visibleIds);
        }
    };


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
        const POLL_INTERVAL = 3000; // 3 seconds between polls
        const maxAttempts = 600; // 30 minutes max (3-second intervals)
        const maxConsecutiveErrors = 10; // Give up after 10 consecutive errors

        const poll = async () => {
            try {
                const response = await api.get(`/backups/progress/${restoreId}`, { timeout: 30000 });
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
                    const failedCount = result?.failed?.length || 0;
                    toast.success(
                        <div>
                            <div style={{ fontWeight: 600 }}>✅ Restore Complete!</div>
                            <div style={{ fontSize: '0.85em' }}>
                                {successCount} tables, {totalRows.toLocaleString()} rows restored
                                {failedCount > 0 && ` (${failedCount} failed)`}
                            </div>
                            {result?.preRestoreBackup && (
                                <div style={{ fontSize: '0.75em', color: '#16a34a', marginTop: 4 }}>
                                    🛡️ Safety backup: {result.preRestoreBackup}
                                </div>
                            )}
                        </div>,
                        { id: toastId, duration: 8000 }
                    );
                    // Store result and open result dialog
                    setRestoreResult(result);
                    setRestoreResultDialogOpen(true);
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
                    setTimeout(poll, POLL_INTERVAL);
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
                    setTimeout(poll, POLL_INTERVAL + 2000); // Slower polling on errors
                } else {
                    toast.dismiss(toastId);
                    toast.error('Lost connection to server - please refresh and check restore status');
                    refreshBackups();
                }
            }
        };

        poll();
    };

    // ===== Upload & Restore: upload file to server for preview =====
    const handleUploadFileSelected = async (file: File) => {
        setUploadRestoreFile(file);
        setRestorePreviewLoading(true);
        setRestorePreviewTables([]);
        setRestoreSelectedTables([]);
        setUploadTempFilePath('');
        setSelectedBackup(null);
        // Open the SAME table selection dialog used for regular restores
        setRestoreTableSelectOpen(true);

        try {
            // Upload to server for server-side parsing (handles .gz too)
            const formData = new FormData();
            formData.append('backupFile', file);

            const response = await api.post('/backups/upload-preview', formData, {
                timeout: 120000,
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const tables = response.data.tables || [];
            setRestorePreviewTables(tables);
            setRestoreSelectedTables(tables.map((t: any) => t.table));
            setUploadTempFilePath(response.data.filePath || '');
        } catch (err: any) {
            console.error('Upload preview error:', err);
            toast.error('Failed to parse backup file: ' + (err.response?.data?.error || err.message));
            setRestoreTableSelectOpen(false);
        }
        setRestorePreviewLoading(false);
    };

    const handleUploadRestore = async () => {
        if (!uploadRestoreFile && !uploadTempFilePath) return;
        if (confirmRestore !== 'RESTORE') {
            toast.error('Please type RESTORE to confirm');
            return;
        }

        const toastId = toast.loading('Starting restore...');
        setUploadRestoreLoading(true);

        try {
            // Wake up server
            try { await api.get('/health', { timeout: 30000 }); } catch {
                await new Promise(resolve => setTimeout(resolve, 2000));
                await api.get('/health', { timeout: 30000 });
            }

            // Close dialogs
            setRestoreDialogOpen(false);
            setConfirmRestore('');

            let response;
            if (uploadTempFilePath) {
                // File already on server from preview step — send path instead of re-uploading
                response = await api.post('/backups/upload-restore', {
                    tempFilePath: uploadTempFilePath,
                    originalName: uploadRestoreFile?.name || 'uploaded-backup',
                    selectedTables: JSON.stringify(restoreSelectedTables)
                }, { timeout: 60000 });
            } else {
                // Fallback: upload file fresh
                const formData = new FormData();
                formData.append('backupFile', uploadRestoreFile!);
                if (restoreSelectedTables.length > 0) {
                    formData.append('selectedTables', JSON.stringify(restoreSelectedTables));
                }
                response = await api.post('/backups/upload-restore', formData, {
                    timeout: 60000,
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            if (response.data.restoreId && response.data.status === 'in_progress') {
                toast.loading(
                    <div style={{ minWidth: '250px' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>🔄 Restoring Database</div>
                        <div style={{ fontSize: '0.85em', color: '#666' }}>Restore started, tracking progress...</div>
                    </div>,
                    { id: toastId }
                );
                pollRestoreProgress(response.data.restoreId, toastId);
            } else {
                toast.success('✅ Database restored successfully!', { id: toastId, duration: 6000 });
                refreshBackups();
                loadDatabaseStats();
                loadHealthStats();
            }
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || error.message || 'Upload & restore failed';
            toast.error(`❌ ${errorMsg}`, { id: toastId, duration: 8000 });
            console.error('Upload restore error:', error.response?.data || error);
        } finally {
            setUploadRestoreLoading(false);
            setUploadRestoreFile(null);
            setUploadTempFilePath('');
        }
    };

    // ===== Restore Latest from Cloud =====
    const handleCloudRestore = async () => {
        // Step 1: Download and preview (get table comparison)
        setCloudRestoreLoading(true);
        setRestorePreviewLoading(true);
        setRestorePreviewTables([]);
        setRestoreSelectedTables([]);
        setSelectedBackup(null);
        setUploadRestoreFile(null);
        setUploadTempFilePath('');
        setCloudTempFilePath('');
        setCloudFileName('');

        // Close the simple cloud dialog, open the table selection dialog
        setCloudRestoreDialogOpen(false);
        setRestoreTableSelectOpen(true);

        try {
            const response = await api.post('/backups/cloud-preview', {}, {
                timeout: 120000
            });

            const tables = response.data.tables || [];
            setRestorePreviewTables(tables);
            setRestoreSelectedTables(tables.map((t: any) => t.table));
            setCloudTempFilePath(response.data.filePath || '');
            setCloudFileName(response.data.fileName || '');
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || error.message || 'Cloud preview failed';
            toast.error(`❌ ${errorMsg}`);
            setRestoreTableSelectOpen(false);
            console.error('Cloud preview error:', error.response?.data || error);
        } finally {
            setRestorePreviewLoading(false);
            setCloudRestoreLoading(false);
        }
    };

    // Step 2: Actually restore from cloud (called from Confirmation Dialog)
    const handleCloudRestoreConfirmed = async () => {
        if (!cloudTempFilePath) return;
        if (confirmRestore !== 'RESTORE') {
            toast.error('Please type RESTORE to confirm');
            return;
        }

        const toastId = toast.loading('Starting cloud restore...');
        setCloudRestoreLoading(true);

        try {
            // Wake up server
            try { await api.get('/health', { timeout: 30000 }); } catch {
                await new Promise(resolve => setTimeout(resolve, 2000));
                await api.get('/health', { timeout: 30000 });
            }

            // Close dialogs
            setRestoreDialogOpen(false);
            setConfirmRestore('');

            const response = await api.post('/backups/restore-latest-cloud', {
                confirm: true,
                selectedTables: restoreSelectedTables,
                tempFilePath: cloudTempFilePath
            }, { timeout: 60000 });

            if (response.data.restoreId && response.data.status === 'in_progress') {
                toast.loading(
                    <div style={{ minWidth: '250px' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>☁️ Restoring from Cloud</div>
                        <div style={{ fontSize: '0.85em', color: '#666' }}>
                            {response.data.fileName ? `File: ${response.data.fileName}` : 'Restoring...'}
                        </div>
                    </div>,
                    { id: toastId }
                );
                pollRestoreProgress(response.data.restoreId, toastId);
            } else {
                toast.success('✅ Database restored successfully!', { id: toastId, duration: 6000 });
                refreshBackups();
                loadDatabaseStats();
                loadHealthStats();
            }
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || error.message || 'Cloud restore failed';
            toast.error(`❌ ${errorMsg}`, { id: toastId, duration: 8000 });
            console.error('Cloud restore error:', error.response?.data || error);
        } finally {
            setCloudRestoreLoading(false);
            setCloudTempFilePath('');
            setCloudFileName('');
        }
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

            // Close the dialog immediately so user sees progress toast
            setRestoreDialogOpen(false);
            setConfirmRestore('');

            const response = await api.post(`/backups/restore/${selectedBackup.id}`, {
                confirm: true,
                selectedTables: restoreSelectedTables
            }, { timeout: 30000 }); // 30s — backend returns restoreId immediately

            // Async mode: poll for progress
            if (response.data.restoreId && response.data.status === 'in_progress') {
                toast.loading(
                    <div style={{ minWidth: '250px' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>🔄 Restoring Database</div>
                        <div style={{ fontSize: '0.85em', color: '#666' }}>Restore started, tracking progress...</div>
                    </div>,
                    { id: toastId }
                );
                pollRestoreProgress(response.data.restoreId, toastId);
            } else {
                // Sync mode completed (shouldn't happen with new code)
                toast.success('✅ Database restored successfully!', {
                    id: toastId,
                    duration: 6000
                });
                setSelectedBackup(null);
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

                {/* Tab Navigation */}
                <Tabs
                    value={activeTab}
                    onChange={(_, v) => setActiveTab(v)}
                    sx={{
                        minHeight: { xs: 36, md: 42 },
                        px: { xs: 1, md: 3 },
                        '& .MuiTab-root': {
                            minHeight: { xs: 36, md: 42 },
                            fontSize: { xs: '0.7rem', md: '0.85rem' },
                            fontWeight: 600,
                            textTransform: 'none'
                        }
                    }}
                >
                    <Tab label="💾 Backups" />
                    <Tab label="📊 Timeline (PITR)" />
                    <Tab label="⚙️ Auto-Backup Settings" />
                </Tabs>

                {/* Content */}
                <Box sx={{
                    flex: 1,
                    overflow: 'auto',
                    p: { xs: 1.5, sm: 2, md: 3 },
                    background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                    position: 'relative',
                }}>

                    {/* Overlay loading spinner */}
                    {loading && (
                        <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            bgcolor: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                            zIndex: 10,
                            backdropFilter: 'blur(2px)',
                        }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={40} sx={{ color: '#3b82f6' }} />
                                <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                                    Loading backups...
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {/* ==================== TIMELINE TAB ==================== */}
                    {activeTab === 1 && (
                        <BackupTimeline warehouseId={activeWarehouse?.id?.toString()} />
                    )}

                    {/* ==================== AUTO-BACKUP SETTINGS TAB ==================== */}
                    {activeTab === 2 && (
                        <AutoBackupSettings />
                    )}

                    {/* ==================== BACKUPS TAB ==================== */}
                    {activeTab === 0 && (<>

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
                        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
                            {canSeeButton('restore') && (
                                <>
                                    <input
                                        type="file"
                                        id="upload-restore-input"
                                        accept=".json,.gz"
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleUploadFileSelected(file);
                                            e.target.value = '';
                                        }}
                                    />
                                    <Button
                                        variant="outlined"
                                        size="large"
                                        startIcon={<UploadFileIcon />}
                                        onClick={() => document.getElementById('upload-restore-input')?.click()}
                                        sx={{
                                            py: 1.5,
                                            px: 3,
                                            fontWeight: 600,
                                            fontSize: '1rem',
                                            borderColor: '#16a34a',
                                            color: '#16a34a',
                                            '&:hover': {
                                                borderColor: '#15803d',
                                                bgcolor: 'rgba(22, 163, 74, 0.04)',
                                                transform: 'translateY(-2px)',
                                            },
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Upload & Restore
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        size="large"
                                        startIcon={<DownloadIcon />}
                                        onClick={handleCloudRestore}
                                        sx={{
                                            py: 1.5,
                                            px: 3,
                                            fontWeight: 600,
                                            fontSize: '1rem',
                                            borderColor: '#7c3aed',
                                            color: '#7c3aed',
                                            '&:hover': {
                                                borderColor: '#6d28d9',
                                                bgcolor: 'rgba(124, 58, 237, 0.04)',
                                                transform: 'translateY(-2px)',
                                            },
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Restore from Cloud
                                    </Button>
                                </>
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

                        {/* ==================== SEARCH, FILTER & BULK ACTIONS ==================== */}
                        {backups.length > 0 && (
                            <Paper sx={{
                                p: { xs: 1.5, md: 2 },
                                mb: 2,
                                borderRadius: 2,
                                bgcolor: isDarkMode ? '#1e293b' : 'background.paper',
                                border: '1px solid',
                                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider'
                            }}>
                                <Stack
                                    direction={{ xs: 'column', md: 'row' }}
                                    spacing={2}
                                    alignItems={{ xs: 'stretch', md: 'center' }}
                                    justifyContent="space-between"
                                >
                                    {/* Search & Filter */}
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flex={1}>
                                        <TextField
                                            size="small"
                                            placeholder="Search backups..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon fontSize="small" color="action" />
                                                    </InputAdornment>
                                                )
                                            }}
                                            sx={{ minWidth: { xs: '100%', sm: 200 } }}
                                        />

                                        <FormControl size="small" sx={{ minWidth: 140 }}>
                                            <InputLabel>Type Filter</InputLabel>
                                            <Select
                                                value={filterType}
                                                label="Type Filter"
                                                onChange={(e) => setFilterType(e.target.value)}
                                            >
                                                <MenuItem value="all">All Types</MenuItem>
                                                <MenuItem value="json">JSON</MenuItem>
                                                <MenuItem value="full">Full</MenuItem>
                                                <MenuItem value="schema">Schema</MenuItem>
                                                <MenuItem value="data">Data</MenuItem>
                                            </Select>
                                        </FormControl>

                                        <Chip
                                            icon={<FilterIcon />}
                                            label={`${groupedBackups.totalFiltered} of ${backups.length}`}
                                            variant="outlined"
                                            size="small"
                                            sx={{ alignSelf: 'center' }}
                                        />
                                    </Stack>

                                    {/* Bulk Actions */}
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        {selectedBackupIds.length > 0 && (
                                            <>
                                                <Chip
                                                    label={`${selectedBackupIds.length} selected (${selectedBackupsSize} MB)`}
                                                    color="primary"
                                                    size="small"
                                                    onDelete={() => setSelectedBackupIds([])}
                                                />
                                                {canSeeButton('delete') && (
                                                    <Button
                                                        variant="contained"
                                                        color="error"
                                                        size="small"
                                                        startIcon={<DeleteSweepIcon />}
                                                        onClick={() => setBulkDeleteDialogOpen(true)}
                                                    >
                                                        Delete Selected
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                        <Tooltip title="Select All Visible">
                                            <IconButton
                                                size="small"
                                                onClick={selectAllVisible}
                                                color={selectedBackupIds.length === groupedBackups.totalFiltered && groupedBackups.totalFiltered > 0 ? 'primary' : 'default'}
                                            >
                                                <SelectAllIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
                                </Stack>
                            </Paper>
                        )}

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
                        ) : groupedBackups.totalFiltered === 0 ? (
                            <Paper sx={{
                                p: 4,
                                textAlign: 'center',
                                borderRadius: 2,
                                bgcolor: isDarkMode ? '#1e293b' : 'background.paper'
                            }}>
                                <SearchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                                <Typography color="text.secondary">
                                    No backups match your search/filter criteria
                                </Typography>
                                <Button
                                    size="small"
                                    onClick={() => { setSearchQuery(''); setFilterType('all'); }}
                                    sx={{ mt: 2 }}
                                >
                                    Clear Filters
                                </Button>
                            </Paper>
                        ) : (
                            /* ==================== DAY-WISE GROUPED VIEW ==================== */
                            <Stack spacing={2}>
                                {groupedBackups.sortedKeys.map((day) => {
                                    const dayBackups = groupedBackups.groups[day];
                                    const isExpanded = expandedDays.includes(day);
                                    const dayBackupIds = dayBackups.map(b => b.id);
                                    const selectedInDay = dayBackupIds.filter(id => selectedBackupIds.includes(id)).length;
                                    const allDaySelected = selectedInDay === dayBackups.length;
                                    const totalSizeMB = dayBackups.reduce((sum, b) => sum + parseFloat(b.file_size_mb || '0'), 0).toFixed(2);

                                    return (
                                        <Accordion
                                            key={day}
                                            expanded={isExpanded}
                                            onChange={() => {
                                                setExpandedDays(prev =>
                                                    prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                                                );
                                            }}
                                            sx={{
                                                borderRadius: '12px !important',
                                                overflow: 'hidden',
                                                bgcolor: isDarkMode ? '#1e293b' : 'background.paper',
                                                boxShadow: isDarkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
                                                '&:before': { display: 'none' },
                                                border: '1px solid',
                                                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider'
                                            }}
                                        >
                                            <AccordionSummary
                                                expandIcon={<ExpandMoreIcon />}
                                                sx={{
                                                    bgcolor: isDarkMode ? '#334155' : 'grey.50',
                                                    borderBottom: isExpanded ? '1px solid' : 'none',
                                                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider',
                                                    '&:hover': { bgcolor: isDarkMode ? '#3f4f63' : 'grey.100' }
                                                }}
                                            >
                                                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', pr: 2 }}>
                                                    <Checkbox
                                                        checked={allDaySelected}
                                                        indeterminate={selectedInDay > 0 && !allDaySelected}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            selectAllInDay(day);
                                                        }}
                                                        size="small"
                                                    />
                                                    <CalendarIcon color="primary" />
                                                    <Box flex={1}>
                                                        <Typography fontWeight={600}>{day}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {dayBackups.length} backup{dayBackups.length > 1 ? 's' : ''} • {totalSizeMB} MB total
                                                        </Typography>
                                                    </Box>
                                                    {selectedInDay > 0 && (
                                                        <Chip
                                                            label={`${selectedInDay} selected`}
                                                            color="primary"
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                    <Badge badgeContent={dayBackups.length} color="primary">
                                                        <StorageIcon color="action" />
                                                    </Badge>
                                                </Stack>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ p: 0 }}>
                                                {/* Desktop Table */}
                                                {!isMobile ? (
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow sx={{ bgcolor: isDarkMode ? '#1e293b' : 'grey.50' }}>
                                                                <TableCell padding="checkbox" sx={{ width: 50 }} />
                                                                <TableCell sx={{ fontWeight: 600 }}>File Name</TableCell>
                                                                <TableCell sx={{ fontWeight: 600, width: 90 }}>Type</TableCell>
                                                                <TableCell sx={{ fontWeight: 600, width: 80 }}>Size</TableCell>
                                                                <TableCell sx={{ fontWeight: 600, width: 180 }}>Description</TableCell>
                                                                <TableCell sx={{ fontWeight: 600, width: 100 }}>Time</TableCell>
                                                                <TableCell align="center" sx={{ fontWeight: 600, width: 130 }}>Actions</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {dayBackups.map((backup) => (
                                                                <TableRow
                                                                    key={backup.id}
                                                                    hover
                                                                    selected={selectedBackupIds.includes(backup.id)}
                                                                    sx={{
                                                                        '&.Mui-selected': {
                                                                            bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)'
                                                                        }
                                                                    }}
                                                                >
                                                                    <TableCell padding="checkbox">
                                                                        <Checkbox
                                                                            checked={selectedBackupIds.includes(backup.id)}
                                                                            onChange={() => toggleBackupSelection(backup.id)}
                                                                            size="small"
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem" noWrap>
                                                                            {backup.file_name}
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Chip
                                                                            label={backup.backup_type.toUpperCase()}
                                                                            color={getBackupTypeColor(backup.backup_type) as any}
                                                                            size="small"
                                                                            sx={{ fontWeight: 600, fontSize: '0.65rem' }}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Typography variant="body2" fontWeight={500} fontSize="0.8rem">
                                                                            {backup.file_size_mb} MB
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Typography variant="body2" color="text.secondary" noWrap fontSize="0.8rem" sx={{ maxWidth: 180 }}>
                                                                            {backup.description || '-'}
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Typography variant="body2" fontSize="0.8rem">
                                                                            {new Date(backup.created_at).toLocaleTimeString('en-IN', {
                                                                                hour: '2-digit',
                                                                                minute: '2-digit'
                                                                            })}
                                                                        </Typography>
                                                                    </TableCell>
                                                                    <TableCell align="center">
                                                                        <Stack direction="row" spacing={0.5} justifyContent="center">
                                                                            <Tooltip title="Download">
                                                                                <IconButton size="small" color="primary" onClick={() => handleDownloadBackup(backup)}>
                                                                                    <DownloadIcon fontSize="small" />
                                                                                </IconButton>
                                                                            </Tooltip>
                                                                            {canSeeButton('restore') && (
                                                                                <Tooltip title="Restore">
                                                                                    <IconButton
                                                                                        size="small"
                                                                                        color="success"
                                                                                        onClick={() => {
                                                                                            setSelectedBackup(backup);
                                                                                            setRestoreTableSelectOpen(true);
                                                                                            setRestorePreviewLoading(true);
                                                                                            setRestorePreviewTables([]);
                                                                                            setRestoreSelectedTables([]);
                                                                                            api.get(`/backups/restore-preview/${backup.id}`, { timeout: 60000 })
                                                                                                .then(res => {
                                                                                                    const tables = res.data.tables || [];
                                                                                                    setRestorePreviewTables(tables);
                                                                                                    setRestoreSelectedTables(tables.map((t: any) => t.table));
                                                                                                })
                                                                                                .catch(() => toast.error('Failed to load backup preview'))
                                                                                                .finally(() => setRestorePreviewLoading(false));
                                                                                        }}
                                                                                    >
                                                                                        <RestoreIcon fontSize="small" />
                                                                                    </IconButton>
                                                                                </Tooltip>
                                                                            )}
                                                                            {canSeeButton('delete') && (
                                                                                <Tooltip title="Delete">
                                                                                    <IconButton size="small" color="error" onClick={() => handleDeleteBackup(backup)}>
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
                                                ) : (
                                                    /* Mobile Card View */
                                                    <Stack spacing={1} p={1.5}>
                                                        {dayBackups.map((backup) => (
                                                            <Card
                                                                key={backup.id}
                                                                sx={{
                                                                    borderRadius: 2,
                                                                    boxShadow: 1,
                                                                    border: selectedBackupIds.includes(backup.id) ? '2px solid' : '1px solid',
                                                                    borderColor: selectedBackupIds.includes(backup.id) ? 'primary.main' : 'divider',
                                                                    bgcolor: selectedBackupIds.includes(backup.id)
                                                                        ? (isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.05)')
                                                                        : 'transparent'
                                                                }}
                                                            >
                                                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                                                    <Stack spacing={1}>
                                                                        <Stack direction="row" alignItems="center" spacing={1}>
                                                                            <Checkbox
                                                                                checked={selectedBackupIds.includes(backup.id)}
                                                                                onChange={() => toggleBackupSelection(backup.id)}
                                                                                size="small"
                                                                            />
                                                                            <Box flex={1}>
                                                                                <Typography variant="subtitle2" fontWeight={600} fontSize="0.85rem" noWrap>
                                                                                    {backup.file_name}
                                                                                </Typography>
                                                                                <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                                                                                    <Chip
                                                                                        label={backup.backup_type.toUpperCase()}
                                                                                        color={getBackupTypeColor(backup.backup_type) as any}
                                                                                        size="small"
                                                                                        sx={{ fontSize: '0.65rem', height: 20 }}
                                                                                    />
                                                                                    <Typography variant="caption" color="text.secondary">
                                                                                        {backup.file_size_mb} MB •{' '}
                                                                                        {new Date(backup.created_at).toLocaleTimeString('en-IN', {
                                                                                            hour: '2-digit',
                                                                                            minute: '2-digit'
                                                                                        })}
                                                                                    </Typography>
                                                                                </Stack>
                                                                            </Box>
                                                                        </Stack>
                                                                        <Stack direction="row" spacing={0.5}>
                                                                            <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => handleDownloadBackup(backup)} sx={{ flex: 1, fontSize: '0.75rem' }}>
                                                                                Download
                                                                            </Button>
                                                                            {canSeeButton('restore') && (
                                                                                <Button
                                                                                    size="small"
                                                                                    variant="outlined"
                                                                                    color="success"
                                                                                    onClick={() => {
                                                                                        setSelectedBackup(backup);
                                                                                        setRestoreTableSelectOpen(true);
                                                                                        setRestorePreviewLoading(true);
                                                                                        setRestorePreviewTables([]);
                                                                                        setRestoreSelectedTables([]);
                                                                                        api.get(`/backups/restore-preview/${backup.id}`, { timeout: 60000 })
                                                                                            .then(res => {
                                                                                                const tables = res.data.tables || [];
                                                                                                setRestorePreviewTables(tables);
                                                                                                setRestoreSelectedTables(tables.map((t: any) => t.table));
                                                                                            })
                                                                                            .catch(() => toast.error('Failed to load backup preview'))
                                                                                            .finally(() => setRestorePreviewLoading(false));
                                                                                    }}
                                                                                    sx={{ fontSize: '0.75rem' }}
                                                                                >
                                                                                    <RestoreIcon fontSize="small" />
                                                                                </Button>
                                                                            )}
                                                                            {canSeeButton('delete') && (
                                                                                <IconButton size="small" color="error" onClick={() => handleDeleteBackup(backup)}>
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
                                            </AccordionDetails>
                                        </Accordion>
                                    );
                                })}
                            </Stack>
                        )}

                        {/* ==================== BULK DELETE CONFIRMATION DIALOG ==================== */}
                        <Dialog
                            open={bulkDeleteDialogOpen}
                            onClose={() => setBulkDeleteDialogOpen(false)}
                            maxWidth="sm"
                            fullWidth
                        >
                            <DialogTitle sx={{
                                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                color: 'white'
                            }}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <DeleteSweepIcon />
                                    <span>Confirm Bulk Delete</span>
                                </Stack>
                            </DialogTitle>
                            <DialogContent sx={{ pt: 3 }}>
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                    <Typography fontWeight={600}>⚠️ Warning!</Typography>
                                    <Typography variant="body2">
                                        You are about to delete {selectedBackupIds.length} backup file(s) ({selectedBackupsSize} MB).
                                        This action cannot be undone!
                                    </Typography>
                                </Alert>
                                <Typography variant="body2" color="text.secondary">
                                    Selected backups will be permanently removed from the server.
                                </Typography>
                            </DialogContent>
                            <DialogActions sx={{ p: 2 }}>
                                <Button onClick={() => setBulkDeleteDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={handleBulkDelete}
                                    startIcon={<DeleteSweepIcon />}
                                >
                                    Delete {selectedBackupIds.length} Backup(s)
                                </Button>
                            </DialogActions>
                        </Dialog>

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

                                            {/* Full Backup */}
                                            <Card
                                                onClick={() => setBackupType('full')}
                                                role="button"
                                                tabIndex={0}
                                                aria-pressed={backupType === 'full'}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        setBackupType('full');
                                                    }
                                                }}
                                                sx={(theme) => ({
                                                    position: 'relative',
                                                    flex: 1,
                                                    cursor: 'pointer',
                                                    border: backupType === 'full' ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
                                                    bgcolor: backupType === 'full'
                                                        ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.06)
                                                        : 'background.paper',
                                                    transition: 'all 0.18s',
                                                    '&:hover': { borderColor: theme.palette.primary.main },
                                                    boxShadow: backupType === 'full' ? `0 6px 20px ${alpha(theme.palette.primary.main, 0.12)}` : undefined,
                                                    '&:focus-visible': { outline: `3px solid ${alpha(theme.palette.primary.main, 0.18)}`, outlineOffset: 2 }
                                                })}
                                            >
                                                {backupType === 'full' && (
                                                    <Box sx={(theme) => ({
                                                        position: 'absolute',
                                                        top: 8,
                                                        right: 8,
                                                        width: 26,
                                                        height: 26,
                                                        borderRadius: '50%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        bgcolor: theme.palette.mode === 'dark' ? theme.palette.primary.main : 'white',
                                                        color: theme.palette.mode === 'dark' ? 'white' : theme.palette.primary.main,
                                                        boxShadow: `0 2px 6px ${alpha(theme.palette.primary.main, 0.18)}`
                                                    })}>
                                                        <CheckIcon fontSize="small" />
                                                    </Box>
                                                )}

                                                <CardContent sx={{ p: 2 }}>
                                                    <Stack direction="row" spacing={2} alignItems="center">
                                                        <Box sx={{
                                                            width: 48, height: 48, borderRadius: 2,
                                                            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.08),
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
                                                role="button"
                                                tabIndex={0}
                                                aria-pressed={backupType === 'selective'}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        setBackupType('selective');
                                                    }
                                                }}
                                                sx={(theme) => ({
                                                    position: 'relative',
                                                    flex: 1,
                                                    cursor: 'pointer',
                                                    border: backupType === 'selective'
                                                        ? `2px solid ${theme.palette.success.main}`
                                                        : `1px solid ${theme.palette.divider}`,
                                                    bgcolor: backupType === 'selective'
                                                        ? alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.14 : 0.05)
                                                        : 'background.paper',
                                                    transition: 'all 0.18s',
                                                    '&:hover': { borderColor: theme.palette.success.main },
                                                    boxShadow: backupType === 'selective' ? `0 6px 18px ${alpha(theme.palette.success.main, 0.08)}` : undefined,
                                                    '&:focus-visible': { outline: `3px solid ${alpha(theme.palette.success.main, 0.18)}`, outlineOffset: 2 }
                                                })}
                                            >
                                                {backupType === 'selective' && (
                                                    <Box sx={(theme) => ({
                                                        position: 'absolute',
                                                        top: 8,
                                                        right: 8,
                                                        width: 26,
                                                        height: 26,
                                                        borderRadius: '50%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        bgcolor: theme.palette.mode === 'dark' ? theme.palette.success.main : 'white',
                                                        color: theme.palette.mode === 'dark' ? 'white' : theme.palette.success.main,
                                                        boxShadow: `0 2px 6px ${alpha(theme.palette.success.main, 0.18)}`
                                                    })}>
                                                        <CheckIcon fontSize="small" />
                                                    </Box>
                                                )}

                                                <CardContent sx={{ p: 2 }}>
                                                    <Stack direction="row" spacing={2} alignItems="center">
                                                        <Box sx={(theme) => ({
                                                            width: 48, height: 48, borderRadius: 2,
                                                            bgcolor: backupType === 'selective'
                                                                ? alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.12 : 0.08)
                                                                : alpha(theme.palette.success.main, 0.08),
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '1.5rem'
                                                        })}>
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
                                                        role="button"
                                                        tabIndex={0}
                                                        aria-pressed={selectedTables.includes(module.id)}
                                                        onClick={() => {
                                                            setSelectedTables(prev =>
                                                                prev.includes(module.id) ? prev.filter(t => t !== module.id) : [...prev, module.id]
                                                            );
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                setSelectedTables(prev =>
                                                                    prev.includes(module.id) ? prev.filter(t => t !== module.id) : [...prev, module.id]
                                                                );
                                                            }
                                                        }}
                                                        sx={(theme) => {
                                                            const sel = selectedTables.includes(module.id);
                                                            return {
                                                                position: 'relative',
                                                                cursor: 'pointer',
                                                                border: sel ? `2px solid ${theme.palette.success.main}` : `1px solid ${theme.palette.divider}`,
                                                                bgcolor: sel ? alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.14 : 0.08) : (theme.palette.mode === 'dark' ? '#0f172a' : 'white'),
                                                                transition: 'all 0.15s',
                                                                '&:hover': { borderColor: theme.palette.success.main, transform: 'scale(1.02)' },
                                                                '&:focus-visible': { outline: `3px solid ${alpha(theme.palette.success.main, 0.18)}`, outlineOffset: 2 }
                                                            };
                                                        }}
                                                    >
                                                        {selectedTables.includes(module.id) && (
                                                            <Box sx={(theme) => ({
                                                                position: 'absolute',
                                                                top: 8,
                                                                right: 8,
                                                                width: 18,
                                                                height: 18,
                                                                borderRadius: '50%',
                                                                bgcolor: theme.palette.mode === 'dark' ? theme.palette.success.main : 'white',
                                                                color: theme.palette.mode === 'dark' ? 'white' : theme.palette.success.main,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                boxShadow: `0 1px 4px ${alpha(theme.palette.success.main, 0.12)}`
                                                            })}>
                                                                <CheckIcon fontSize="small" />
                                                            </Box>
                                                        )}

                                                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                                            <Stack direction="row" spacing={1} alignItems="center">
                                                                <Typography fontSize="1.2rem">{module.icon}</Typography>
                                                                <Box>
                                                                    <Typography fontWeight={600} fontSize="0.85rem">{module.name}</Typography>
                                                                    <Typography variant="caption" color="text.secondary">{module.description}</Typography>
                                                                </Box>
                                                            </Stack>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </Box>
                                        </Box>
                                    )}

                                    {/* Description Field */}
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
                                    variant="outlined"
                                    sx={{ borderRadius: 2 }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleCreateBackup}
                                    variant="contained"
                                    startIcon={<BackupIcon />}
                                    disabled={backupType === 'selective' && selectedTables.length === 0}
                                    sx={{
                                        borderRadius: 2,
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                        }
                                    }}
                                >
                                    Create Backup
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {/* Table Selection Dialog (before restore) — Enhanced with Backup vs DB comparison */}
                        <Dialog
                            open={restoreTableSelectOpen}
                            onClose={() => { setRestoreTableSelectOpen(false); if (!selectedBackup) { setUploadRestoreFile(null); setUploadTempFilePath(''); setCloudTempFilePath(''); setCloudFileName(''); } }}
                            maxWidth="md"
                            fullWidth
                            fullScreen={isMobile}
                            PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 }, m: { xs: 0, sm: 2 } } }}
                        >
                            <DialogTitle sx={{
                                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                py: 2.5
                            }}>
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                    <RestoreIcon />
                                    <Box>
                                        <Typography variant="h6" fontWeight={600}>
                                            {uploadRestoreFile ? 'Upload & Restore' : 'Select Tables to Restore'}
                                        </Typography>
                                        {selectedBackup && (
                                            <Typography variant="caption" sx={{ opacity: 0.85 }}>
                                                {selectedBackup.file_name}
                                            </Typography>
                                        )}
                                        {!selectedBackup && uploadRestoreFile && (
                                            <Typography variant="caption" sx={{ opacity: 0.85 }}>
                                                {uploadRestoreFile.name} ({(uploadRestoreFile.size / (1024 * 1024)).toFixed(2)} MB)
                                            </Typography>
                                        )}
                                        {!selectedBackup && !uploadRestoreFile && cloudFileName && (
                                            <Typography variant="caption" sx={{ opacity: 0.85 }}>
                                                ☁️ {cloudFileName}
                                            </Typography>
                                        )}
                                    </Box>
                                </Stack>
                                <IconButton onClick={() => { setRestoreTableSelectOpen(false); if (!selectedBackup) { setUploadRestoreFile(null); setUploadTempFilePath(''); setCloudTempFilePath(''); setCloudFileName(''); } }} sx={{ color: 'white' }}>
                                    <CloseIcon />
                                </IconButton>
                            </DialogTitle>
                            <DialogContent sx={{ pt: 3, pb: 1 }}>
                                {restorePreviewLoading ? (
                                    <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" py={8}>
                                        <CircularProgress size={48} />
                                        <Typography mt={2} color="text.secondary" fontWeight={500}>Analyzing backup & database...</Typography>
                                        <Typography variant="caption" color="text.secondary" mt={0.5}>
                                            Comparing row counts for each table
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Stack spacing={2}>
                                        {/* Safe mode badge */}
                                        <Alert severity="success" icon={false} sx={{ borderRadius: 2, py: 0.5 }}>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Typography fontSize="1.1rem">🛡️</Typography>
                                                <Box>
                                                    <Typography variant="body2" fontWeight={600}>Safe Merge Mode</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Data will be merged — existing rows updated, new rows inserted. Nothing will be deleted.
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </Alert>

                                        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                                            <Typography variant="body2" color="text.secondary" fontWeight={500}>
                                                {restoreSelectedTables.length} of {restorePreviewTables.length} tables selected
                                            </Typography>
                                            <Stack direction="row" spacing={1}>
                                                <Button size="small" onClick={() => setRestoreSelectedTables(restorePreviewTables.map(t => t.table))}>
                                                    Select All
                                                </Button>
                                                <Button size="small" onClick={() => setRestoreSelectedTables([])}>
                                                    Deselect All
                                                </Button>
                                            </Stack>
                                        </Stack>

                                        {/* Table comparison header */}
                                        <Box sx={{ maxHeight: isMobile ? 350 : 420, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                                            <Table size="small" stickyHeader>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell padding="checkbox" sx={{ bgcolor: 'background.paper' }}>
                                                            <Checkbox
                                                                checked={restoreSelectedTables.length === restorePreviewTables.length && restorePreviewTables.length > 0}
                                                                indeterminate={restoreSelectedTables.length > 0 && restoreSelectedTables.length < restorePreviewTables.length}
                                                                onChange={() => {
                                                                    if (restoreSelectedTables.length === restorePreviewTables.length) {
                                                                        setRestoreSelectedTables([]);
                                                                    } else {
                                                                        setRestoreSelectedTables(restorePreviewTables.map(t => t.table));
                                                                    }
                                                                }}
                                                                size="small"
                                                            />
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem', bgcolor: 'background.paper' }}>Table</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.8rem', bgcolor: 'background.paper' }}>Backup Rows</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.8rem', bgcolor: 'background.paper' }}>DB Rows</TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.8rem', bgcolor: 'background.paper' }}>Status</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {restorePreviewTables.map((t) => {
                                                        const isSelected = restoreSelectedTables.includes(t.table);
                                                        const hasBackupData = t.backupRows > 0;
                                                        const willUpdate = t.backupRows > 0 && t.dbRows > 0;
                                                        const willInsertNew = t.backupRows > 0 && t.dbRows === 0;
                                                        return (
                                                            <TableRow
                                                                key={t.table}
                                                                hover
                                                                selected={isSelected}
                                                                onClick={() => {
                                                                    if (isSelected) {
                                                                        setRestoreSelectedTables(prev => prev.filter(n => n !== t.table));
                                                                    } else {
                                                                        setRestoreSelectedTables(prev => [...prev, t.table]);
                                                                    }
                                                                }}
                                                                sx={{ cursor: 'pointer' }}
                                                            >
                                                                <TableCell padding="checkbox">
                                                                    <Checkbox checked={isSelected} size="small" />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Typography variant="body2" fontWeight={500} fontSize="0.85rem">{t.table}</Typography>
                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    <Typography variant="body2" fontSize="0.85rem" fontWeight={hasBackupData ? 600 : 400} color={hasBackupData ? 'primary.main' : 'text.secondary'}>
                                                                        {t.backupRows.toLocaleString()}
                                                                    </Typography>
                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    <Typography variant="body2" fontSize="0.85rem" color="text.secondary">
                                                                        {t.dbRows.toLocaleString()}
                                                                    </Typography>
                                                                </TableCell>
                                                                <TableCell align="center">
                                                                    {!hasBackupData ? (
                                                                        <Chip label="Empty" size="small" variant="outlined" color="default" sx={{ fontSize: '0.7rem', height: 22 }} />
                                                                    ) : willInsertNew ? (
                                                                        <Chip label="New Data" size="small" color="success" sx={{ fontSize: '0.7rem', height: 22 }} />
                                                                    ) : willUpdate ? (
                                                                        <Chip label="Merge" size="small" color="info" sx={{ fontSize: '0.7rem', height: 22 }} />
                                                                    ) : (
                                                                        <Chip label="Merge" size="small" color="info" sx={{ fontSize: '0.7rem', height: 22 }} />
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </Box>

                                        {/* Summary */}
                                        <Paper sx={{ p: 1.5, bgcolor: isDarkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)', borderRadius: 2 }}>
                                            <Stack direction="row" spacing={2} justifyContent="space-around">
                                                <Box textAlign="center">
                                                    <Typography variant="h6" fontWeight={700} color="primary.main">
                                                        {restoreSelectedTables.length}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">Tables</Typography>
                                                </Box>
                                                <Box textAlign="center">
                                                    <Typography variant="h6" fontWeight={700} color="primary.main">
                                                        {restorePreviewTables
                                                            .filter(t => restoreSelectedTables.includes(t.table))
                                                            .reduce((sum, t) => sum + t.backupRows, 0)
                                                            .toLocaleString()}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">Rows to Process</Typography>
                                                </Box>
                                                <Box textAlign="center">
                                                    <Typography variant="h6" fontWeight={700} color="success.main">
                                                        🛡️
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">Auto Backup</Typography>
                                                </Box>
                                            </Stack>
                                        </Paper>
                                    </Stack>
                                )}
                            </DialogContent>
                            <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
                                <Button onClick={() => { setRestoreTableSelectOpen(false); if (!selectedBackup) { setUploadRestoreFile(null); setUploadTempFilePath(''); setCloudTempFilePath(''); setCloudFileName(''); } }} fullWidth={isMobile}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    disabled={restoreSelectedTables.length === 0 || restorePreviewLoading}
                                    startIcon={<RestoreIcon />}
                                    fullWidth={isMobile}
                                    onClick={() => {
                                        setRestoreTableSelectOpen(false);
                                        setRestoreDialogOpen(true);
                                    }}
                                    sx={{
                                        background: restoreSelectedTables.length > 0
                                            ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                                            : undefined,
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)'
                                        }
                                    }}
                                >
                                    Next: Confirm Restore ({restoreSelectedTables.length} Tables)
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
                                    <Alert severity="success" icon={false} sx={{ borderRadius: 2 }}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Typography fontSize="1.2rem">🛡️</Typography>
                                            <Box>
                                                <Typography variant="body2" fontWeight={600}>Safe Merge Mode</Typography>
                                                <Typography variant="body2" component="div" fontSize="0.85rem">
                                                    • Existing rows matching by ID will be <strong>updated</strong>
                                                    <br />
                                                    • New rows will be <strong>inserted</strong>
                                                    <br />
                                                    • Rows NOT in backup will stay <strong>untouched</strong>
                                                    <br />
                                                    • A safety backup of current data will be created first
                                                </Typography>
                                            </Box>
                                        </Stack>
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
                                                <Typography variant="body2" sx={{ color: isDarkMode ? '#f1f5f9' : 'inherit' }}><strong>Tables:</strong> {restoreSelectedTables.length} selected</Typography>
                                            </Stack>
                                        </Paper>
                                    )}

                                    {!selectedBackup && uploadRestoreFile && (
                                        <Paper sx={{ p: 2, bgcolor: isDarkMode ? '#334155' : 'grey.50', borderRadius: 2 }}>
                                            <Typography variant="caption" sx={{ color: isDarkMode ? '#94a3b8' : 'text.secondary' }} display="block" mb={1}>
                                                UPLOADED FILE:
                                            </Typography>
                                            <Stack spacing={0.5}>
                                                <Typography variant="body2" sx={{ color: isDarkMode ? '#f1f5f9' : 'inherit' }}><strong>File:</strong> {uploadRestoreFile.name}</Typography>
                                                <Typography variant="body2" sx={{ color: isDarkMode ? '#f1f5f9' : 'inherit' }}><strong>Size:</strong> {(uploadRestoreFile.size / (1024 * 1024)).toFixed(2)} MB</Typography>
                                                <Typography variant="body2" sx={{ color: isDarkMode ? '#f1f5f9' : 'inherit' }}><strong>Tables:</strong> {restoreSelectedTables.length} selected</Typography>
                                            </Stack>
                                        </Paper>
                                    )}

                                    {!selectedBackup && !uploadRestoreFile && cloudTempFilePath && (
                                        <Paper sx={{ p: 2, bgcolor: isDarkMode ? '#334155' : 'grey.50', borderRadius: 2 }}>
                                            <Typography variant="caption" sx={{ color: isDarkMode ? '#94a3b8' : 'text.secondary' }} display="block" mb={1}>
                                                ☁️ CLOUD BACKUP:
                                            </Typography>
                                            <Stack spacing={0.5}>
                                                <Typography variant="body2" sx={{ color: isDarkMode ? '#f1f5f9' : 'inherit' }}><strong>File:</strong> {cloudFileName}</Typography>
                                                <Typography variant="body2" sx={{ color: isDarkMode ? '#f1f5f9' : 'inherit' }}><strong>Source:</strong> Cloud Storage</Typography>
                                                <Typography variant="body2" sx={{ color: isDarkMode ? '#f1f5f9' : 'inherit' }}><strong>Tables:</strong> {restoreSelectedTables.length} selected</Typography>
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
                                    onClick={cloudTempFilePath ? handleCloudRestoreConfirmed : uploadRestoreFile ? handleUploadRestore : handleRestoreBackup}
                                    disabled={confirmRestore !== 'RESTORE'}
                                    startIcon={<RestoreIcon />}
                                    fullWidth={isMobile}
                                    sx={{
                                        background: confirmRestore === 'RESTORE'
                                            ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                                            : undefined,
                                        '&:hover': {
                                            background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)'
                                        }
                                    }}
                                >
                                    Restore Now
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {/* Restore Results Dialog */}
                        <Dialog
                            open={restoreResultDialogOpen}
                            onClose={() => setRestoreResultDialogOpen(false)}
                            maxWidth="md"
                            fullWidth
                            fullScreen={isMobile}
                            PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 }, m: { xs: 0, sm: 2 } } }}
                        >
                            <DialogTitle sx={{
                                background: restoreResult?.failed?.length > 0
                                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                    : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                py: 2.5
                            }}>
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                    <CheckIcon />
                                    <Typography variant="h6" fontWeight={600}>
                                        Restore Complete
                                    </Typography>
                                </Stack>
                                <IconButton onClick={() => setRestoreResultDialogOpen(false)} sx={{ color: 'white' }}>
                                    <CloseIcon />
                                </IconButton>
                            </DialogTitle>
                            <DialogContent sx={{ pt: 3, pb: 2 }}>
                                {restoreResult && (
                                    <Stack spacing={2.5}>
                                        {/* Summary Cards */}
                                        <Stack direction="row" spacing={2} justifyContent="space-around">
                                            <Paper sx={{ p: 2, textAlign: 'center', flex: 1, borderRadius: 2, bgcolor: isDarkMode ? 'rgba(22,163,74,0.1)' : 'rgba(22,163,74,0.05)' }}>
                                                <Typography variant="h5" fontWeight={700} color="success.main">
                                                    {restoreResult.success?.length || 0}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">Tables Restored</Typography>
                                            </Paper>
                                            <Paper sx={{ p: 2, textAlign: 'center', flex: 1, borderRadius: 2, bgcolor: isDarkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)' }}>
                                                <Typography variant="h5" fontWeight={700} color="primary.main">
                                                    {(restoreResult.totalRows || 0).toLocaleString()}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">Rows Processed</Typography>
                                            </Paper>
                                            {(restoreResult.failed?.length || 0) > 0 && (
                                                <Paper sx={{ p: 2, textAlign: 'center', flex: 1, borderRadius: 2, bgcolor: isDarkMode ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)' }}>
                                                    <Typography variant="h5" fontWeight={700} color="error.main">
                                                        {restoreResult.failed?.length || 0}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">Tables Failed</Typography>
                                                </Paper>
                                            )}
                                        </Stack>

                                        {/* Pre-restore backup info */}
                                        {restoreResult.preRestoreBackup && (
                                            <Alert severity="success" icon={false} sx={{ borderRadius: 2 }}>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Typography fontSize="1.1rem">🛡️</Typography>
                                                    <Box>
                                                        <Typography variant="body2" fontWeight={600}>Safety Backup Created</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {restoreResult.preRestoreBackup}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </Alert>
                                        )}

                                        {/* Detailed table results */}
                                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow sx={{ bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'grey.50' }}>
                                                        <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem' }}>Table</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>Total Rows</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>Processed</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>Failed</TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>Status</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {restoreResult.success?.map((t: any) => (
                                                        <TableRow key={t.table}>
                                                            <TableCell>
                                                                <Typography variant="body2" fontWeight={500} fontSize="0.85rem">{t.table}</Typography>
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                <Typography variant="body2" fontSize="0.85rem">{(t.total || 0).toLocaleString()}</Typography>
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                <Typography variant="body2" fontSize="0.85rem" color="success.main" fontWeight={600}>
                                                                    {(t.inserted || 0).toLocaleString()}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                <Typography variant="body2" fontSize="0.85rem" color={t.failed > 0 ? 'error.main' : 'text.secondary'}>
                                                                    {(t.failed || 0).toLocaleString()}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell align="center">
                                                                <Chip label="✓ Done" size="small" color="success" sx={{ fontSize: '0.7rem', height: 22 }} />
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {restoreResult.failed?.map((t: any) => (
                                                        <TableRow key={t.table}>
                                                            <TableCell>
                                                                <Typography variant="body2" fontWeight={500} fontSize="0.85rem">{t.table}</Typography>
                                                            </TableCell>
                                                            <TableCell align="right" colSpan={2}>
                                                                <Typography variant="caption" color="error.main">{t.error?.substring(0, 60)}</Typography>
                                                            </TableCell>
                                                            <TableCell align="right">-</TableCell>
                                                            <TableCell align="center">
                                                                <Chip label="✗ Failed" size="small" color="error" sx={{ fontSize: '0.7rem', height: 22 }} />
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {restoreResult.skipped?.map((t: any) => (
                                                        <TableRow key={t.table}>
                                                            <TableCell>
                                                                <Typography variant="body2" fontWeight={500} fontSize="0.85rem" color="text.secondary">{t.table}</Typography>
                                                            </TableCell>
                                                            <TableCell align="right" colSpan={2}>
                                                                <Typography variant="caption" color="text.secondary">{t.reason}</Typography>
                                                            </TableCell>
                                                            <TableCell align="right">-</TableCell>
                                                            <TableCell align="center">
                                                                <Chip label="Skipped" size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </Box>

                                        {/* Mode info */}
                                        <Typography variant="caption" color="text.secondary" textAlign="center">
                                            Mode: Safe Merge (UPSERT) — No data was deleted during this restore
                                        </Typography>
                                    </Stack>
                                )}
                            </DialogContent>
                            <DialogActions sx={{ px: 3, pb: 3 }}>
                                <Button
                                    variant="contained"
                                    onClick={() => setRestoreResultDialogOpen(false)}
                                    fullWidth={isMobile}
                                    sx={{
                                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                        '&:hover': { background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)' }
                                    }}
                                >
                                    Close
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
                                                            <Stack direction="row" spacing={2} mt={1} flexWrap="wrap" rowGap={0.5}>
                                                                <Typography variant="caption">
                                                                    <strong>Frequency:</strong> {schedule.frequency}
                                                                </Typography>
                                                                <Typography variant="caption">
                                                                    <strong>Time:</strong> {schedule.time_of_day}
                                                                </Typography>
                                                                <Typography variant="caption">
                                                                    <strong>Type:</strong> {schedule.backup_type === 'selective' ? '📦 Selective' : schedule.backup_type}
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
                                setScheduleSelectedTables([]);
                            }}
                            maxWidth="md"
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
                                            <MenuItem value="hourly">Hourly (Every hour)</MenuItem>
                                            <MenuItem value="daily">Daily (Once per day)</MenuItem>
                                            <MenuItem value="weekly">Weekly (Once per week)</MenuItem>
                                            <MenuItem value="monthly">Monthly (Once per month)</MenuItem>
                                        </Select>
                                    </FormControl>

                                    {currentSchedule?.frequency === 'hourly' && (
                                        <Alert severity="warning" sx={{ fontSize: '0.85rem' }}>
                                            ⚠️ Hourly backup will run every hour! If you only want backup at a specific time, please select <strong>Daily</strong> instead.
                                        </Alert>
                                    )}

                                    <TextField
                                        label="Time (24-hour format)"
                                        type="time"
                                        fullWidth
                                        value={currentSchedule?.time_of_day?.substring(0, 5) || '02:00'}
                                        onChange={(e) => setCurrentSchedule({ ...currentSchedule, time_of_day: e.target.value + ':00' })}
                                        helperText={currentSchedule?.frequency === 'hourly' ? 'Backup will run at this minute every hour' : 'Backup will run at this time'}
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
                                            onChange={(e) => {
                                                setCurrentSchedule({ ...currentSchedule, backup_type: e.target.value });
                                                if (e.target.value !== 'selective') {
                                                    setScheduleSelectedTables([]);
                                                }
                                            }}
                                            label="Backup Type"
                                        >
                                            <MenuItem value="full">Full Backup (All data)</MenuItem>
                                            <MenuItem value="selective">Selective Backup (Specific modules)</MenuItem>
                                            <MenuItem value="schema">Schema Only</MenuItem>
                                            <MenuItem value="data">Data Only</MenuItem>
                                        </Select>
                                    </FormControl>

                                    {/* Selective Module Selection for Schedule */}
                                    {currentSchedule?.backup_type === 'selective' && (
                                        <Box sx={{
                                            p: 2,
                                            bgcolor: isDarkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
                                            borderRadius: 2,
                                            border: '1px solid',
                                            borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'
                                        }}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                                                <Typography variant="subtitle2" fontWeight={600}>
                                                    📦 Select Modules ({scheduleSelectedTables.length} selected)
                                                </Typography>
                                                <Button
                                                    size="small"
                                                    onClick={() => {
                                                        if (scheduleSelectedTables.length === backupModules.length) {
                                                            setScheduleSelectedTables([]);
                                                        } else {
                                                            setScheduleSelectedTables(backupModules.map(m => m.id));
                                                        }
                                                    }}
                                                    sx={{ fontSize: '0.75rem' }}
                                                >
                                                    {scheduleSelectedTables.length === backupModules.length ? 'Deselect All' : 'Select All'}
                                                </Button>
                                            </Stack>
                                            <Box sx={{
                                                display: 'grid',
                                                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
                                                gap: 1
                                            }}>
                                                {backupModules.map((module) => (
                                                    <Card
                                                        key={module.id}
                                                        role="button"
                                                        tabIndex={0}
                                                        aria-pressed={scheduleSelectedTables.includes(module.id)}
                                                        onClick={() => {
                                                            setScheduleSelectedTables(prev =>
                                                                prev.includes(module.id) ? prev.filter(t => t !== module.id) : [...prev, module.id]
                                                            );
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                setScheduleSelectedTables(prev =>
                                                                    prev.includes(module.id) ? prev.filter(t => t !== module.id) : [...prev, module.id]
                                                                );
                                                            }
                                                        }}
                                                        sx={(theme) => {
                                                            const sel = scheduleSelectedTables.includes(module.id);
                                                            return {
                                                                position: 'relative',
                                                                cursor: 'pointer',
                                                                border: sel ? `2px solid ${theme.palette.success.main}` : `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : theme.palette.divider}`,
                                                                bgcolor: sel ? alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.15 : 0.08) : (theme.palette.mode === 'dark' ? '#1e293b' : 'white'),
                                                                transition: 'all 0.15s',
                                                                '&:hover': { borderColor: theme.palette.success.main, transform: 'scale(1.02)' },
                                                                '&:focus-visible': { outline: `3px solid ${alpha(theme.palette.success.main, 0.18)}`, outlineOffset: 2 }
                                                            };
                                                        }}
                                                    >
                                                        {scheduleSelectedTables.includes(module.id) && (
                                                            <Box sx={(theme) => ({
                                                                position: 'absolute',
                                                                top: 8,
                                                                right: 8,
                                                                width: 18,
                                                                height: 18,
                                                                borderRadius: '50%',
                                                                bgcolor: theme.palette.mode === 'dark' ? theme.palette.success.main : 'white',
                                                                color: theme.palette.mode === 'dark' ? 'white' : theme.palette.success.main,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                boxShadow: `0 1px 4px ${alpha(theme.palette.success.main, 0.12)}`
                                                            })}>
                                                                <CheckIcon fontSize="small" />
                                                            </Box>
                                                        )}
                                                        <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                                                            <Stack direction="row" spacing={1} alignItems="center">
                                                                <Typography fontSize="1.1rem">{module.icon}</Typography>
                                                                <Box>
                                                                    <Typography fontWeight={600} fontSize="0.85rem">{module.name}</Typography>
                                                                    <Typography variant="caption" color="text.secondary">{module.description}</Typography>
                                                                </Box>
                                                            </Stack>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </Box>
                                            {scheduleSelectedTables.length === 0 && (
                                                <Alert severity="warning" sx={{ mt: 1.5, py: 0.5 }}>
                                                    <Typography variant="caption">Please select at least one module</Typography>
                                                </Alert>
                                            )}
                                        </Box>
                                    )}

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
                                        setScheduleSelectedTables([]);
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

                                        // Validate selective backup has modules selected
                                        if (currentSchedule?.backup_type === 'selective' && scheduleSelectedTables.length === 0) {
                                            toast.error('Please select at least one module for selective backup');
                                            return;
                                        }

                                        const toastId = toast.loading('Creating schedule...');
                                        try {
                                            const scheduleData = {
                                                ...currentSchedule,
                                                // Include selected tables for selective backup
                                                selected_tables: currentSchedule?.backup_type === 'selective' ? scheduleSelectedTables : null
                                            };
                                            await api.post('/backups/schedules', scheduleData);
                                            toast.success('Schedule created successfully!', { id: toastId });
                                            setScheduleFormOpen(false);
                                            setCurrentSchedule(null);
                                            setScheduleSelectedTables([]);
                                            loadSchedules();
                                            loadHealthStats();
                                        } catch (error: any) {
                                            toast.error(error.response?.data?.error || 'Failed to create schedule', { id: toastId });
                                            console.error(error);
                                        }
                                    }}
                                    fullWidth={isMobile}
                                    disabled={currentSchedule?.backup_type === 'selective' && scheduleSelectedTables.length === 0}
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

                    </>)}
                </Box >
            </Box >
        </AppLayout >
    );
}
