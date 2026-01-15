'use client';

import { useState, useEffect } from 'react';
import {
    Box, Typography, Button, Stack, FormControl, InputLabel, Select, MenuItem,
    Slider, Switch, FormControlLabel, Card, CardContent, Divider,
    ToggleButton, ToggleButtonGroup, Chip, Alert, useTheme, useMediaQuery,
    RadioGroup, Radio
} from '@mui/material';
import {
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon,
    SettingsBrightness as AutoModeIcon,
    FormatSize as FontSizeIcon,
    Palette as PaletteIcon,
    RestartAlt as ResetIcon,
    Save as SaveIcon,
    Check as CheckIcon,
    Contrast as ContrastIcon,
    TextFields as TextFieldsIcon,
    ViewCompact as CompactIcon,
    ViewAgenda as ComfortableIcon,
} from '@mui/icons-material';
import AppLayout from '@/components/AppLayout';
import { StandardPageHeader } from '@/components';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { useAppearance } from '@/app/context/AppearanceContext';
import { getStoredUser } from '@/lib/auth';
import toast, { Toaster } from 'react-hot-toast';

// Available primary colors
const PRIMARY_COLORS = [
    { name: 'Deep Blue', value: '#1e40af' },
    { name: 'Royal Blue', value: '#2563eb' },
    { name: 'Indigo', value: '#4f46e5' },
    { name: 'Purple', value: '#7c3aed' },
    { name: 'Emerald', value: '#059669' },
    { name: 'Teal', value: '#0d9488' },
    { name: 'Slate', value: '#475569' },
    { name: 'Rose', value: '#be185d' },
];

// Font families
const FONT_FAMILIES = [
    { name: 'Inter', value: 'Inter' },
    { name: 'System Default', value: 'system-ui' },
    { name: 'Roboto', value: 'Roboto' },
    { name: 'Open Sans', value: 'Open Sans' },
];

// Helper to adjust color brightness
function adjustColorBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

export default function AppearanceSettingsPage() {
    const { activeWarehouse } = useWarehouse();
    const [user, setUser] = useState<any>(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Use global appearance context
    const {
        settings,
        updateSetting,
        resetSettings,
        saveSettings,
        hasUnsavedChanges,
        isLoading
    } = useAppearance();

    const [saving, setSaving] = useState(false);

    // Load user on mount
    useEffect(() => {
        const storedUser = getStoredUser();
        if (!storedUser) {
            window.location.href = '/login';
            return;
        }
        setUser(storedUser);
    }, []);

    // Save settings handler
    const handleSave = async () => {
        setSaving(true);
        try {
            saveSettings();
            toast.success('Settings saved! Changes applied.', {
                duration: 3000,
                icon: '✨',
            });
        } catch (error) {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    // Reset handler
    const handleReset = () => {
        resetSettings();
        toast('Settings reset to defaults', { icon: '🔄' });
    };

    if (!user || isLoading) {
        return null;
    }

    return (
        <AppLayout>
            <Toaster position="top-right" />
            <Box sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                <StandardPageHeader
                    title="Appearance Settings"
                    subtitle="Customize the look and feel of your workspace"
                    icon="🎨"
                    warehouseName={activeWarehouse?.name}
                    userName={user?.fullName}
                />

                {/* Main Content */}
                <Box sx={{
                    flex: 1,
                    overflow: 'auto',
                    p: { xs: 1.5, md: 2 },
                    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                }}>
                    {/* Save Bar */}
                    {hasUnsavedChanges && (
                        <Alert
                            severity="info"
                            sx={{ mb: 2, borderRadius: 2 }}
                            action={
                                <Stack direction="row" spacing={1}>
                                    <Button size="small" onClick={handleReset} sx={{ color: 'inherit' }}>
                                        Reset
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        onClick={handleSave}
                                        disabled={saving}
                                        sx={{ background: settings.primaryColor }}
                                    >
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </Stack>
                            }
                        >
                            You have unsaved changes - Live preview is active!
                        </Alert>
                    )}

                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                        gap: 2,
                    }}>
                        {/* Theme Selection */}
                        <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                                    <PaletteIcon sx={{ color: settings.primaryColor }} />
                                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                                        Theme Mode
                                    </Typography>
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Choose your preferred color scheme for the interface
                                </Typography>
                                <ToggleButtonGroup
                                    value={settings.theme}
                                    exclusive
                                    onChange={(_, value) => value && updateSetting('theme', value)}
                                    fullWidth
                                    sx={{
                                        '& .MuiToggleButton-root': {
                                            py: 1.5,
                                            textTransform: 'none',
                                            fontWeight: 600,
                                        },
                                        '& .Mui-selected': {
                                            bgcolor: `${settings.primaryColor} !important`,
                                            color: 'white !important',
                                        }
                                    }}
                                >
                                    <ToggleButton value="light">
                                        <LightModeIcon sx={{ mr: 1 }} />
                                        Light
                                    </ToggleButton>
                                    <ToggleButton value="dark" disabled>
                                        <DarkModeIcon sx={{ mr: 1 }} />
                                        Dark
                                        <Chip label="Soon" size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }} />
                                    </ToggleButton>
                                    <ToggleButton value="auto" disabled>
                                        <AutoModeIcon sx={{ mr: 1 }} />
                                        Auto
                                        <Chip label="Soon" size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }} />
                                    </ToggleButton>
                                </ToggleButtonGroup>
                            </CardContent>
                        </Card>

                        {/* Primary Color */}
                        <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                                    <ContrastIcon sx={{ color: settings.primaryColor }} />
                                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                                        Primary Color
                                    </Typography>
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Select the accent color for buttons and highlights
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {PRIMARY_COLORS.map((color) => (
                                        <Box
                                            key={color.value}
                                            onClick={() => updateSetting('primaryColor', color.value)}
                                            title={color.name}
                                            sx={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: 2,
                                                bgcolor: color.value,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: settings.primaryColor === color.value ? '3px solid #1e293b' : '2px solid transparent',
                                                transition: settings.showAnimations ? 'all 0.2s ease' : 'none',
                                                '&:hover': {
                                                    transform: settings.showAnimations ? 'scale(1.1)' : 'none',
                                                    boxShadow: `0 4px 12px ${color.value}40`,
                                                },
                                            }}
                                        >
                                            {settings.primaryColor === color.value && (
                                                <CheckIcon sx={{ color: 'white', fontSize: 20 }} />
                                            )}
                                        </Box>
                                    ))}
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                                    Selected: {PRIMARY_COLORS.find(c => c.value === settings.primaryColor)?.name || settings.primaryColor}
                                </Typography>
                            </CardContent>
                        </Card>

                        {/* Font Size */}
                        <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                                    <FontSizeIcon sx={{ color: settings.primaryColor }} />
                                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                                        Text Size
                                    </Typography>
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Adjust the default font size for better readability
                                </Typography>
                                <Box sx={{ px: 1 }}>
                                    <Slider
                                        value={settings.fontSize}
                                        onChange={(_, value) => updateSetting('fontSize', value as number)}
                                        min={12}
                                        max={18}
                                        step={1}
                                        marks={[
                                            { value: 12, label: 'Small' },
                                            { value: 14, label: 'Default' },
                                            { value: 16, label: 'Large' },
                                            { value: 18, label: 'XL' },
                                        ]}
                                        valueLabelDisplay="auto"
                                        sx={{
                                            color: settings.primaryColor,
                                            '& .MuiSlider-markLabel': {
                                                fontSize: '0.75rem',
                                            },
                                        }}
                                    />
                                </Box>
                                <Box sx={{
                                    mt: 2,
                                    p: 1.5,
                                    bgcolor: '#f8fafc',
                                    borderRadius: 1,
                                    border: '1px solid #e2e8f0',
                                }}>
                                    <Typography sx={{ fontSize: `${settings.fontSize}px` }}>
                                        Preview: This text is {settings.fontSize}px
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>

                        {/* Font Family */}
                        <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                                    <TextFieldsIcon sx={{ color: settings.primaryColor }} />
                                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                                        Font Family
                                    </Typography>
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Choose your preferred font style
                                </Typography>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Font</InputLabel>
                                    <Select
                                        value={settings.fontFamily}
                                        label="Font"
                                        onChange={(e) => updateSetting('fontFamily', e.target.value)}
                                    >
                                        {FONT_FAMILIES.map((font) => (
                                            <MenuItem
                                                key={font.value}
                                                value={font.value}
                                                sx={{ fontFamily: font.value }}
                                            >
                                                {font.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Box sx={{
                                    mt: 2,
                                    p: 1.5,
                                    bgcolor: '#f8fafc',
                                    borderRadius: 1,
                                    border: '1px solid #e2e8f0',
                                }}>
                                    <Typography sx={{ fontFamily: settings.fontFamily }}>
                                        Preview: The quick brown fox jumps over the lazy dog
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>

                        {/* Table Density */}
                        <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                                    <CompactIcon sx={{ color: settings.primaryColor }} />
                                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                                        Table Row Density
                                    </Typography>
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Adjust how compact data tables appear
                                </Typography>
                                <RadioGroup
                                    value={settings.tableRowDensity}
                                    onChange={(e) => updateSetting('tableRowDensity', e.target.value as 'compact' | 'comfortable')}
                                >
                                    <FormControlLabel
                                        value="compact"
                                        control={<Radio size="small" sx={{ '&.Mui-checked': { color: settings.primaryColor } }} />}
                                        label={
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <CompactIcon fontSize="small" />
                                                <Box>
                                                    <Typography sx={{ fontWeight: 500 }}>Compact</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        36px row height - More rows visible
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        }
                                    />
                                    <FormControlLabel
                                        value="comfortable"
                                        control={<Radio size="small" sx={{ '&.Mui-checked': { color: settings.primaryColor } }} />}
                                        label={
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <ComfortableIcon fontSize="small" />
                                                <Box>
                                                    <Typography sx={{ fontWeight: 500 }}>Comfortable</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        44px row height - Better readability
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        }
                                    />
                                </RadioGroup>
                            </CardContent>
                        </Card>

                        {/* UI Options */}
                        <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                                    <PaletteIcon sx={{ color: settings.primaryColor }} />
                                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                                        UI Options
                                    </Typography>
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Additional interface preferences
                                </Typography>
                                <Stack spacing={1}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={settings.showAnimations}
                                                onChange={(e) => updateSetting('showAnimations', e.target.checked)}
                                                sx={{
                                                    '& .MuiSwitch-switchBase.Mui-checked': {
                                                        color: settings.primaryColor,
                                                    },
                                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                        backgroundColor: settings.primaryColor,
                                                    },
                                                }}
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                                    Enable Animations
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Smooth transitions and hover effects
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                    <Divider />
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={settings.sidebarCompact}
                                                onChange={(e) => updateSetting('sidebarCompact', e.target.checked)}
                                                sx={{
                                                    '& .MuiSwitch-switchBase.Mui-checked': {
                                                        color: settings.primaryColor,
                                                    },
                                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                        backgroundColor: settings.primaryColor,
                                                    },
                                                }}
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                                    Compact Sidebar
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Collapse sidebar to icons only by default
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                    <Divider />
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={settings.highContrastMode}
                                                onChange={(e) => updateSetting('highContrastMode', e.target.checked)}
                                                sx={{
                                                    '& .MuiSwitch-switchBase.Mui-checked': {
                                                        color: settings.primaryColor,
                                                    },
                                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                        backgroundColor: settings.primaryColor,
                                                    },
                                                }}
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                                    High Contrast Mode
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Increase color contrast for accessibility
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                </Stack>
                            </CardContent>
                        </Card>
                    </Box>

                    {/* Action Buttons */}
                    <Box sx={{
                        mt: 3,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 2,
                        pb: 2,
                    }}>
                        <Button
                            variant="outlined"
                            startIcon={<ResetIcon />}
                            onClick={handleReset}
                            sx={{ borderRadius: 2 }}
                        >
                            Reset to Defaults
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSave}
                            disabled={!hasUnsavedChanges || saving}
                            sx={{
                                borderRadius: 2,
                                background: `linear-gradient(135deg, ${settings.primaryColor} 0%, ${adjustColorBrightness(settings.primaryColor, 30)} 100%)`,
                                '&:hover': {
                                    background: `linear-gradient(135deg, ${adjustColorBrightness(settings.primaryColor, -10)} 0%, ${settings.primaryColor} 100%)`,
                                },
                            }}
                        >
                            {saving ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </Box>
                </Box>
            </Box>
        </AppLayout>
    );
}
