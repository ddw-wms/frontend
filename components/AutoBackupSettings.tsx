'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Switch,
    FormControlLabel,
    Select,
    MenuItem,
    TextField,
    Button,
    Divider,
    Stack,
    Chip,
    Alert,
    CircularProgress,
    useTheme,
    InputLabel,
    FormControl,
    Tooltip,
    IconButton,
} from '@mui/material';
import {
    Save as SaveIcon,
    Refresh as RefreshIcon,
    CleaningServices as CleanupIcon,
    Info as InfoIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface AutoBackupSettings {
    enabled: boolean;
    frequency: string;
    min_change_threshold: number;
    event_backup_enabled: boolean;
    event_throttle_minutes: number;
    retention_keep_all_hours: number;
    retention_daily_days: number;
    retention_weekly_days: number;
    retention_delete_after_days: number;
}

const FREQUENCY_OPTIONS = [
    { value: '1h', label: 'Every 1 Hour' },
    { value: '2h', label: 'Every 2 Hours' },
    { value: '4h', label: 'Every 4 Hours' },
    { value: '6h', label: 'Every 6 Hours' },
    { value: '12h', label: 'Every 12 Hours' },
    { value: '24h', label: 'Once a Day (3 AM)' },
];

export default function AutoBackupSettings() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const [settings, setSettings] = useState<AutoBackupSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [cleaningUp, setCleaningUp] = useState(false);
    const [dirty, setDirty] = useState(false);

    const cardBg = isDark ? alpha('#1e293b', 0.8) : '#ffffff';
    const sectionBg = isDark ? alpha('#0f172a', 0.5) : alpha('#f1f5f9', 0.7);

    const loadSettings = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/backups/auto-settings');
            setSettings(res.data);
            setDirty(false);
        } catch (err: any) {
            toast.error('Failed to load auto-backup settings');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const updateField = <K extends keyof AutoBackupSettings>(key: K, value: AutoBackupSettings[K]) => {
        if (!settings) return;
        setSettings({ ...settings, [key]: value });
        setDirty(true);
    };

    const handleSave = async () => {
        if (!settings) return;
        try {
            setSaving(true);
            const res = await api.put('/backups/auto-settings', settings);
            setSettings(res.data.settings);
            setDirty(false);
            toast.success('Auto-backup settings saved');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleCleanup = async () => {
        try {
            setCleaningUp(true);
            await api.post('/backups/run-retention-cleanup');
            toast.success('Retention cleanup completed');
        } catch (err: any) {
            toast.error('Cleanup failed');
        } finally {
            setCleaningUp(false);
        }
    };

    if (loading || !settings) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress size={36} />
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
            {dirty && (
                <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                    You have unsaved changes. Click "Save Settings" to apply.
                </Alert>
            )}

            {/* ===== AUTO-BACKUP ON/OFF ===== */}
            <Card sx={{ mb: 2.5, borderRadius: 2.5, bgcolor: cardBg, border: `1px solid ${isDark ? alpha('#3b82f6', 0.2) : '#e2e8f0'}` }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Box>
                            <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1rem', md: '1.15rem' } }}>
                                ⚡ Auto-Backup
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Automatically creates backups at the configured interval when data changes are detected.
                            </Typography>
                        </Box>
                        <Switch
                            checked={settings.enabled}
                            onChange={(e) => updateField('enabled', e.target.checked)}
                            color="primary"
                            sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#3b82f6' } }}
                        />
                    </Box>

                    {settings.enabled && (
                        <Box sx={{ mt: 2.5, p: 2, borderRadius: 2, bgcolor: sectionBg }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5}>
                                <FormControl size="small" sx={{ minWidth: 200 }}>
                                    <InputLabel>Frequency</InputLabel>
                                    <Select
                                        value={settings.frequency}
                                        label="Frequency"
                                        onChange={(e) => updateField('frequency', e.target.value)}
                                    >
                                        {FREQUENCY_OPTIONS.map(opt => (
                                            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <TextField
                                    label="Min. Changes Threshold"
                                    type="number"
                                    size="small"
                                    value={settings.min_change_threshold}
                                    onChange={(e) => updateField('min_change_threshold', Math.max(0, parseInt(e.target.value) || 0))}
                                    helperText="Skip backup if fewer changes"
                                    inputProps={{ min: 0, max: 1000 }}
                                    sx={{ width: 200 }}
                                />
                            </Stack>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* ===== EVENT BACKUP ===== */}
            <Card sx={{ mb: 2.5, borderRadius: 2.5, bgcolor: cardBg, border: `1px solid ${isDark ? alpha('#8b5cf6', 0.2) : '#e2e8f0'}` }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Box>
                            <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1rem', md: '1.15rem' } }}>
                                🔔 Event-Triggered Backup
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Creates a backup immediately after bulk data operations (imports, batch deletes, etc.)
                            </Typography>
                        </Box>
                        <Switch
                            checked={settings.event_backup_enabled}
                            onChange={(e) => updateField('event_backup_enabled', e.target.checked)}
                            color="secondary"
                        />
                    </Box>

                    {settings.event_backup_enabled && (
                        <Box sx={{ mt: 2.5, p: 2, borderRadius: 2, bgcolor: sectionBg }}>
                            <TextField
                                label="Throttle (minutes)"
                                type="number"
                                size="small"
                                value={settings.event_throttle_minutes}
                                onChange={(e) => updateField('event_throttle_minutes', Math.max(1, parseInt(e.target.value) || 1))}
                                helperText="Minimum gap between event backups"
                                inputProps={{ min: 1, max: 60 }}
                                sx={{ width: 200 }}
                            />
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* ===== HASH DEDUP INFO ===== */}
            <Card sx={{ mb: 2.5, borderRadius: 2.5, bgcolor: cardBg, border: `1px solid ${isDark ? alpha('#10b981', 0.2) : '#e2e8f0'}` }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1rem', md: '1.15rem' }, mb: 1 }}>
                        🔒 Smart Deduplication
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Active automatically. Each backup file is SHA256-hashed and compared with the previous backup.
                        If the data is identical, the duplicate is discarded — saving storage without any manual effort.
                    </Typography>
                    <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip label="SHA256 Hash" size="small" color="success" variant="outlined" />
                        <Chip label="Auto Skip Duplicates" size="small" color="success" variant="outlined" />
                        <Chip label="Zero Config" size="small" color="info" variant="outlined" />
                    </Box>
                </CardContent>
            </Card>

            {/* ===== TIERED RETENTION ===== */}
            <Card sx={{ mb: 2.5, borderRadius: 2.5, bgcolor: cardBg, border: `1px solid ${isDark ? alpha('#f59e0b', 0.2) : '#e2e8f0'}` }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Box>
                            <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1rem', md: '1.15rem' } }}>
                                🗂️ Tiered Retention Policy
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Automatically thins out old auto/event backups. Manual & scheduled backups are never auto-deleted.
                            </Typography>
                        </Box>
                        <Tooltip title="Runs daily at 3 AM automatically">
                            <IconButton size="small"><InfoIcon fontSize="small" /></IconButton>
                        </Tooltip>
                    </Box>

                    <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: sectionBg }}>
                        <Stack spacing={2.5}>
                            {/* Tier 1 */}
                            <Box>
                                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5, color: '#22c55e' }}>
                                    Tier 1 — Keep All
                                </Typography>
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                    <TextField
                                        label="Hours"
                                        type="number"
                                        size="small"
                                        value={settings.retention_keep_all_hours}
                                        onChange={(e) => updateField('retention_keep_all_hours', Math.max(1, parseInt(e.target.value) || 1))}
                                        inputProps={{ min: 1, max: 168 }}
                                        sx={{ width: 120 }}
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        Keep every backup within this window
                                    </Typography>
                                </Stack>
                            </Box>

                            <Divider />

                            {/* Tier 2 */}
                            <Box>
                                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5, color: '#3b82f6' }}>
                                    Tier 2 — Keep 1 per Day
                                </Typography>
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                    <TextField
                                        label="Days"
                                        type="number"
                                        size="small"
                                        value={settings.retention_daily_days}
                                        onChange={(e) => updateField('retention_daily_days', Math.max(1, parseInt(e.target.value) || 1))}
                                        inputProps={{ min: 1, max: 90 }}
                                        sx={{ width: 120 }}
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        Keep only the latest backup each day (others deleted)
                                    </Typography>
                                </Stack>
                            </Box>

                            <Divider />

                            {/* Tier 3 */}
                            <Box>
                                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5, color: '#f59e0b' }}>
                                    Tier 3 — Keep 1 per Week
                                </Typography>
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                    <TextField
                                        label="Days"
                                        type="number"
                                        size="small"
                                        value={settings.retention_weekly_days}
                                        onChange={(e) => updateField('retention_weekly_days', Math.max(1, parseInt(e.target.value) || 1))}
                                        inputProps={{ min: 7, max: 365 }}
                                        sx={{ width: 120 }}
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        Keep only the latest backup each week (others deleted)
                                    </Typography>
                                </Stack>
                            </Box>

                            <Divider />

                            {/* Tier 4 */}
                            <Box>
                                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5, color: '#ef4444' }}>
                                    Tier 4 — Hard Delete
                                </Typography>
                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                    <TextField
                                        label="Days"
                                        type="number"
                                        size="small"
                                        value={settings.retention_delete_after_days}
                                        onChange={(e) => updateField('retention_delete_after_days', Math.max(1, parseInt(e.target.value) || 1))}
                                        inputProps={{ min: 7, max: 365 }}
                                        sx={{ width: 120 }}
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        Delete all auto/event backups older than this
                                    </Typography>
                                </Stack>
                            </Box>
                        </Stack>
                    </Box>

                    {/* Manual cleanup button */}
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={cleaningUp ? <CircularProgress size={16} /> : <CleanupIcon />}
                            onClick={handleCleanup}
                            disabled={cleaningUp}
                            sx={{ textTransform: 'none' }}
                        >
                            {cleaningUp ? 'Running...' : 'Run Cleanup Now'}
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {/* ===== SAVE BAR ===== */}
            <Box sx={{
                position: 'sticky',
                bottom: 0,
                py: 2,
                px: 0,
                display: 'flex',
                gap: 1.5,
                justifyContent: 'flex-end',
                bgcolor: isDark ? alpha('#0f172a', 0.95) : alpha('#f8fafc', 0.95),
                backdropFilter: 'blur(8px)',
                borderRadius: 2,
                zIndex: 5,
            }}>
                <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadSettings}
                    disabled={saving}
                    sx={{ textTransform: 'none' }}
                >
                    Reset
                </Button>
                <Button
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    sx={{
                        textTransform: 'none',
                        bgcolor: '#3b82f6',
                        '&:hover': { bgcolor: '#2563eb' },
                    }}
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </Button>
            </Box>
        </Box>
    );
}
