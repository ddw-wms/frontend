'use client';
// File Path = warehouse-frontend/app/settings/permissions/page.tsx
// Modern Permissions Management - Enable/Disable + Show/Hide

import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Tabs, Tab, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Checkbox, Button, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip,
    Alert, CircularProgress, Snackbar, Accordion, AccordionSummary,
    AccordionDetails, List, ListItem, ListItemButton, ListItemText,
    FormControlLabel, Switch, Tooltip, Card, CardContent, Avatar,
    useTheme, useMediaQuery, Divider, Badge, Stack, alpha,
    Grid, LinearProgress
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon, Save as SaveIcon, Refresh as RefreshIcon,
    Person as PersonIcon, Group as GroupIcon, Warehouse as WarehouseIcon,
    Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon,
    Lock as LockIcon, LockOpen as LockOpenIcon, Close as CloseIcon,
    Search as SearchIcon, CheckCircle as CheckCircleIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
    Dashboard as DashboardIcon, Inventory as InventoryIcon,
    LocalShipping as ShippingIcon, Assignment as AssignmentIcon,
    Settings as SettingsIcon, Security as SecurityIcon,
    SelectAll as SelectAllIcon, Deselect as DeselectIcon,
    RemoveRedEye as ViewOnlyIcon, AdminPanelSettings as FullAccessIcon,
    CheckBox as CheckBoxIcon, CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon
} from '@mui/icons-material';
import { permissionsAPI, usersAPI, warehousesAPI } from '@/lib/api';
import { usePermissions } from '@/app/context/PermissionContext';
import AppLayout from '@/components/AppLayout';
import { StandardPageHeader, StandardTabs } from '@/components';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';

interface Role {
    id: number;
    name: string;
    description: string;
    is_system_role: boolean;
    user_count: number;
}

interface User {
    id: number;
    username: string;
    full_name: string;
    role: string;
    is_active: boolean;
}

interface Warehouse {
    id: number;
    name: string;
    code: string;
}

interface Permission {
    code: string;
    name: string;
    category: string;
    page: string;
    parent_code: string | null;
    is_enabled: boolean;
    is_visible: boolean;
    role_enabled?: boolean;
    role_visible?: boolean;
    override_enabled?: boolean | null;
    override_visible?: boolean | null;
    effective_enabled?: boolean;
    effective_visible?: boolean;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
    return (
        <Box
            role="tabpanel"
            hidden={value !== index}
            sx={{ height: '100%', overflow: 'auto' }}
        >
            {value === index && <Box sx={{ pt: { xs: 1, md: 2 } }}>{children}</Box>}
        </Box>
    );
}

// Page labels for grouping - merged duplicates
const PAGE_LABELS: Record<string, string> = {
    'dashboard': '1. Dashboard',
    'inbound': '2. Inbound',
    'qc': '3. QC/Processing',
    'picking': '4. Picking',
    'outbound': '5. Outbound',
    'customers': '6. Customers',
    'reports': '7. Reports',
    'settings-masterdata': '8. Settings/Master Data',
    'settings-warehouses': '9. Settings/Warehouses',
    'warehouses': '9. Settings/Warehouses',  // Same as settings-warehouses
    'settings-racks': '10. Settings/Racks',
    'racks': '10. Settings/Racks',  // Same as settings-racks
    'settings-users': '11. Settings/Users',
    'settings-printers': '12. Settings/Printers',
    'settings-backups': '13. Settings/Backups',
    'settings-permissions': '14. Settings/Permissions',
    'settings-appearance': '15. Settings/Appearance',
    'settings-errorlogs': '16. Settings/Error Logs',
};

// Merge duplicate pages into single groups
const mergePagePermissions = (perms: Permission[]): Record<string, Permission[]> => {
    const grouped: Record<string, Permission[]> = {};

    perms.forEach(p => {
        // Normalize page names - merge warehouses -> settings-warehouses, racks -> settings-racks
        let normalizedPage = p.page;
        if (p.page === 'warehouses') normalizedPage = 'settings-warehouses';
        if (p.page === 'racks') normalizedPage = 'settings-racks';

        if (!grouped[normalizedPage]) grouped[normalizedPage] = [];
        grouped[normalizedPage].push(p);
    });

    return grouped;
};

// Page sort order
const PAGE_ORDER = [
    'dashboard', 'inbound', 'qc', 'picking', 'outbound', 'customers',
    'reports', 'settings-masterdata', 'settings-warehouses', 'settings-racks',
    'settings-users', 'settings-printers', 'settings-backups', 'settings-permissions',
    'settings-appearance', 'settings-errorlogs'
];

export default function PermissionsPage() {
    const { isAdmin, refreshPermissions } = usePermissions();
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
    const { activeWarehouse } = useWarehouse();
    const [user, setUser] = useState<any>(null);

    // Load user on mount
    useEffect(() => {
        const storedUser = getStoredUser();
        setUser(storedUser);
    }, []);

    // Only super_admin can access User Overrides and Warehouse Access tabs
    const isSuperAdmin = user?.role === 'super_admin';

    const [tabValue, setTabValue] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false, message: '', severity: 'success'
    });

    // Data
    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);

    // Selection
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
    const [userOverrides, setUserOverrides] = useState<Permission[]>([]);
    const [userWarehouses, setUserWarehouses] = useState<number[]>([]);
    const [defaultWarehouseId, setDefaultWarehouseId] = useState<number | null>(null);
    const [userRole, setUserRole] = useState<string>('');

    // Mobile drawer
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Accordion expanded state - track which pages are expanded
    const [expandedAccordions, setExpandedAccordions] = useState<Record<string, boolean>>({});

    const handleAccordionChange = (page: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
        setExpandedAccordions(prev => ({
            ...prev,
            [page]: isExpanded
        }));
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [rolesRes, permRes, usersRes, whRes] = await Promise.all([
                permissionsAPI.getRoles(),
                permissionsAPI.getAll(),
                usersAPI.getAll(),
                warehousesAPI.getAll(),
            ]);

            setRoles(rolesRes.data || []);
            setAllPermissions(permRes.data?.permissions || []);
            setUsers(usersRes.data || []);
            setWarehouses(whRes.data || []);
        } catch (error) {
            console.error('Load data error:', error);
            showSnackbar('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showSnackbar = (message: string, severity: 'success' | 'error') => {
        setSnackbar({ open: true, message, severity });
    };

    // =====================================================
    // ROLE PERMISSIONS
    // =====================================================
    const handleSelectRole = async (role: Role) => {
        setSelectedRole(role);
        setMobileDrawerOpen(false);
        try {
            const res = await permissionsAPI.getRolePermissions(role.id);
            setRolePermissions(res.data || []);
        } catch (error) {
            showSnackbar('Failed to load role permissions', 'error');
        }
    };

    const handleToggleRoleEnabled = (code: string) => {
        setRolePermissions(prev => prev.map(p =>
            p.code === code ? { ...p, is_enabled: !p.is_enabled } : p
        ));
    };

    const handleToggleRoleVisible = (code: string) => {
        setRolePermissions(prev => prev.map(p =>
            p.code === code ? { ...p, is_visible: !p.is_visible } : p
        ));
    };

    // =====================================================
    // BULK ACTIONS FOR ROLE PERMISSIONS
    // =====================================================

    // Select/Unselect all enabled for entire role
    const handleSelectAllEnabled = (enabled: boolean) => {
        setRolePermissions(prev => prev.map(p => ({ ...p, is_enabled: enabled })));
    };

    // Select/Unselect all visible for entire role
    const handleSelectAllVisible = (visible: boolean) => {
        setRolePermissions(prev => prev.map(p => ({ ...p, is_visible: visible })));
    };

    // Select/Unselect all for a specific page
    const handleSelectPageEnabled = (page: string, enabled: boolean) => {
        setRolePermissions(prev => prev.map(p => {
            let normalizedPage = p.page;
            if (p.page === 'warehouses') normalizedPage = 'settings-warehouses';
            if (p.page === 'racks') normalizedPage = 'settings-racks';
            return normalizedPage === page ? { ...p, is_enabled: enabled } : p;
        }));
    };

    const handleSelectPageVisible = (page: string, visible: boolean) => {
        setRolePermissions(prev => prev.map(p => {
            let normalizedPage = p.page;
            if (p.page === 'warehouses') normalizedPage = 'settings-warehouses';
            if (p.page === 'racks') normalizedPage = 'settings-racks';
            return normalizedPage === page ? { ...p, is_visible: visible } : p;
        }));
    };

    // Set view-only permissions (all visible, only menu enabled)
    const handleSetViewOnly = () => {
        setRolePermissions(prev => prev.map(p => ({
            ...p,
            is_enabled: p.code.startsWith('menu:'), // Only enable menu permissions
            is_visible: true // All visible
        })));
    };

    // Set full access
    const handleSetFullAccess = () => {
        setRolePermissions(prev => prev.map(p => ({
            ...p,
            is_enabled: true,
            is_visible: true
        })));
    };

    // Check if page has all enabled/visible
    const isPageAllEnabled = (page: string): boolean => {
        const pagePerms = rolePermissions.filter(p => {
            let normalizedPage = p.page;
            if (p.page === 'warehouses') normalizedPage = 'settings-warehouses';
            if (p.page === 'racks') normalizedPage = 'settings-racks';
            return normalizedPage === page;
        });
        return pagePerms.length > 0 && pagePerms.every(p => p.is_enabled);
    };

    const isPageAllVisible = (page: string): boolean => {
        const pagePerms = rolePermissions.filter(p => {
            let normalizedPage = p.page;
            if (p.page === 'warehouses') normalizedPage = 'settings-warehouses';
            if (p.page === 'racks') normalizedPage = 'settings-racks';
            return normalizedPage === page;
        });
        return pagePerms.length > 0 && pagePerms.every(p => p.is_visible);
    };

    const handleSaveRolePermissions = async () => {
        if (!selectedRole) return;
        try {
            setSaving(true);
            await permissionsAPI.updateRolePermissions(
                selectedRole.id,
                rolePermissions.map(p => ({
                    code: p.code,
                    is_enabled: p.is_enabled,
                    is_visible: p.is_visible
                }))
            );
            showSnackbar('Role permissions saved successfully', 'success');
            await refreshPermissions();
        } catch (error: any) {
            console.error('Save role permissions error:', error);
            const errorMsg = error?.response?.data?.error || error?.message || 'Network error';
            showSnackbar(`Failed to save: ${errorMsg}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // =====================================================
    // USER OVERRIDES
    // =====================================================
    const handleSelectUser = async (user: User) => {
        setSelectedUser(user);
        setMobileDrawerOpen(false);
        try {
            const [overridesRes, whRes] = await Promise.all([
                permissionsAPI.getUserOverrides(user.id),
                permissionsAPI.getUserWarehouses(user.id),
            ]);
            setUserRole(overridesRes.data.userRole);
            setUserOverrides(overridesRes.data.permissions || []);
            const userWh = whRes.data || [];
            setUserWarehouses(userWh.map((w: any) => w.warehouse_id));
            setDefaultWarehouseId(userWh.find((w: any) => w.is_default)?.warehouse_id || null);
        } catch (error) {
            showSnackbar('Failed to load user data', 'error');
        }
    };

    const handleToggleUserOverrideEnabled = (code: string) => {
        setUserOverrides(prev => prev.map(p => {
            if (p.code !== code) return p;
            let newVal: boolean | null;
            if (p.override_enabled === null || p.override_enabled === undefined) {
                newVal = !p.role_enabled;
            } else {
                newVal = null;
            }
            return { ...p, override_enabled: newVal, effective_enabled: newVal ?? p.role_enabled };
        }));
    };

    const handleToggleUserOverrideVisible = (code: string) => {
        setUserOverrides(prev => prev.map(p => {
            if (p.code !== code) return p;
            let newVal: boolean | null;
            if (p.override_visible === null || p.override_visible === undefined) {
                newVal = !p.role_visible;
            } else {
                newVal = null;
            }
            return { ...p, override_visible: newVal, effective_visible: newVal ?? p.role_visible };
        }));
    };

    const handleSaveUserOverrides = async () => {
        if (!selectedUser) return;
        try {
            setSaving(true);
            const overrides = userOverrides
                .filter(p => p.override_enabled !== null || p.override_visible !== null)
                .map(p => ({
                    code: p.code,
                    is_enabled: p.override_enabled ?? null,
                    is_visible: p.override_visible ?? null
                }));
            await permissionsAPI.updateUserOverrides(selectedUser.id, overrides);
            showSnackbar('User overrides saved successfully', 'success');
        } catch (error: any) {
            console.error('Save user overrides error:', error);
            const errorMsg = error?.response?.data?.error || error?.message || 'Network error';
            showSnackbar(`Failed to save: ${errorMsg}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // =====================================================
    // USER WAREHOUSES
    // =====================================================
    const handleToggleWarehouse = (warehouseId: number) => {
        setUserWarehouses(prev => {
            if (prev.includes(warehouseId)) {
                // If removing and this was the default, clear default
                if (defaultWarehouseId === warehouseId) {
                    setDefaultWarehouseId(null);
                }
                return prev.filter(id => id !== warehouseId);
            }
            return [...prev, warehouseId];
        });
    };

    const handleSaveUserWarehouses = async () => {
        if (!selectedUser) return;
        try {
            setSaving(true);
            await permissionsAPI.updateUserWarehouses(
                selectedUser.id,
                userWarehouses,
                defaultWarehouseId || undefined
            );
            showSnackbar('User warehouses saved successfully', 'success');
        } catch (error: any) {
            console.error('Save user warehouses error:', error);
            const errorMsg = error?.response?.data?.error || error?.message || 'Network error';
            showSnackbar(`Failed to save: ${errorMsg}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // =====================================================
    // RENDER HELPERS
    // =====================================================

    // Role List Component - Filter out super_admin as they have all permissions by default
    const RoleList = () => {
        // Filter out super_admin - they have all permissions by default and cannot be modified
        const editableRoles = roles.filter(r => r.name !== 'super_admin');

        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="subtitle2" sx={{ px: 2, py: 1.5, bgcolor: 'grey.100', fontWeight: 600 }}>
                    Select Role
                </Typography>
                <List dense sx={{ flex: 1, overflow: 'auto', p: 0 }}>
                    {editableRoles.map(role => (
                        <ListItemButton
                            key={role.id}
                            selected={selectedRole?.id === role.id}
                            onClick={() => handleSelectRole(role)}
                            sx={{
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                '&.Mui-selected': {
                                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                                    borderLeft: `3px solid ${theme.palette.primary.main}`,
                                }
                            }}
                        >
                            <Avatar sx={{
                                width: 32,
                                height: 32,
                                mr: 1.5,
                                bgcolor: selectedRole?.id === role.id ? 'primary.main' : 'grey.300',
                                fontSize: '0.875rem'
                            }}>
                                {role.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <ListItemText
                                primary={<Typography fontWeight={500}>{role.name}</Typography>}
                                secondary={
                                    <Typography variant="caption" color="text.secondary">
                                        {role.user_count} user{role.user_count !== 1 ? 's' : ''}
                                    </Typography>
                                }
                            />
                        </ListItemButton>
                    ))}
                </List>
            </Box>
        );
    };

    // User List Component - Filter out super_admin users (they have all permissions by default)
    const UserList = () => {
        const filteredUsers = users.filter(u =>
            u.is_active &&
            u.role !== 'super_admin' && // Exclude super_admin users - they have full access by default
            (searchQuery === '' ||
                u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase())))
        );

        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 1, bgcolor: isDarkMode ? '#1e293b' : 'grey.100' }}>
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: <SearchIcon sx={{ mr: 1, color: 'grey.500' }} fontSize="small" />
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                bgcolor: isDarkMode ? '#334155' : 'white',
                                borderRadius: 1,
                                '& input': {
                                    bgcolor: 'transparent'
                                },
                                '& fieldset': {
                                    borderColor: isDarkMode ? 'grey.600' : 'grey.300'
                                }
                            }
                        }}
                    />
                </Box>
                <List dense sx={{ flex: 1, overflow: 'auto', p: 0 }}>
                    {filteredUsers.map(user => (
                        <ListItemButton
                            key={user.id}
                            selected={selectedUser?.id === user.id}
                            onClick={() => handleSelectUser(user)}
                            sx={{
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                '&.Mui-selected': {
                                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                                    borderLeft: `3px solid ${theme.palette.primary.main}`,
                                }
                            }}
                        >
                            <Avatar sx={{
                                width: 32,
                                height: 32,
                                mr: 1.5,
                                bgcolor: selectedUser?.id === user.id ? 'primary.main' : 'grey.300',
                                fontSize: '0.75rem'
                            }}>
                                {(user.full_name || user.username).charAt(0).toUpperCase()}
                            </Avatar>
                            <ListItemText
                                primary={
                                    <Typography fontWeight={500} noWrap sx={{ maxWidth: 150 }}>
                                        {user.full_name || user.username}
                                    </Typography>
                                }
                                secondary={
                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                        <Typography variant="caption" color="text.secondary" noWrap>
                                            {user.username}
                                        </Typography>
                                        <Chip
                                            label={user.role}
                                            size="small"
                                            sx={{
                                                height: 18,
                                                fontSize: '0.65rem',
                                                bgcolor: alpha(theme.palette.info.main, 0.1),
                                                color: 'info.dark'
                                            }}
                                        />
                                    </Stack>
                                }
                            />
                        </ListItemButton>
                    ))}
                </List>
            </Box>
        );
    };

    // Permission accordion for role permissions
    const RolePermissionAccordions = () => {
        const grouped = mergePagePermissions(rolePermissions);
        const sortedPages = PAGE_ORDER.filter(p => grouped[p]?.length > 0);

        // Calculate totals
        const totalEnabled = rolePermissions.filter(p => p.is_enabled).length;
        const totalVisible = rolePermissions.filter(p => p.is_visible).length;
        const totalPermissions = rolePermissions.length;

        return (
            <Box>
                {/* Global Quick Actions */}
                <Paper sx={{
                    p: { xs: 1, sm: 1.5 },
                    mb: 2,
                    bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.main, 0.05),
                    border: '1px solid',
                    borderColor: isDarkMode ? alpha(theme.palette.primary.main, 0.3) : alpha(theme.palette.primary.main, 0.2),
                    borderRadius: 2
                }}>
                    <Stack direction="column" spacing={1}>
                        {/* First row: Enable/Disable/Show/Hide */}
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, auto) 1fr repeat(2, auto)' },
                            gap: { xs: 0.5, sm: 1 },
                            alignItems: 'center'
                        }}>
                            <Tooltip title="Enable all permissions">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="success"
                                    startIcon={!isSmall && <SelectAllIcon />}
                                    onClick={() => handleSelectAllEnabled(true)}
                                    sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                >
                                    {isSmall ? '✓ All' : 'Enable All'}
                                </Button>
                            </Tooltip>
                            <Tooltip title="Disable all permissions">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    startIcon={!isSmall && <DeselectIcon />}
                                    onClick={() => handleSelectAllEnabled(false)}
                                    sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                >
                                    {isSmall ? '✗ All' : 'Disable All'}
                                </Button>
                            </Tooltip>
                            <Tooltip title="Show all in UI">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="info"
                                    startIcon={!isSmall && <VisibilityIcon />}
                                    onClick={() => handleSelectAllVisible(true)}
                                    sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                >
                                    {isSmall ? '👁 All' : 'Show All'}
                                </Button>
                            </Tooltip>
                            <Tooltip title="Hide all from UI">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={!isSmall && <VisibilityOffIcon />}
                                    onClick={() => handleSelectAllVisible(false)}
                                    sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                >
                                    {isSmall ? '🚫 All' : 'Hide All'}
                                </Button>
                            </Tooltip>
                            <Box sx={{ display: { xs: 'none', sm: 'block' } }} />
                            <Tooltip title="View Only: Enable menus, show all, disable actions">
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="warning"
                                    startIcon={!isSmall && <ViewOnlyIcon />}
                                    onClick={handleSetViewOnly}
                                    sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                >
                                    {isSmall ? '👁 Only' : 'View Only'}
                                </Button>
                            </Tooltip>
                            <Tooltip title="Full Access: Enable & show everything">
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    startIcon={!isSmall && <FullAccessIcon />}
                                    onClick={handleSetFullAccess}
                                    sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                >
                                    {isSmall ? 'Full' : 'Full Access'}
                                </Button>
                            </Tooltip>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={{ xs: 1, sm: 2 }} mt={1} flexWrap="wrap" useFlexGap>
                        <Chip
                            label={`Enabled: ${totalEnabled}/${totalPermissions}`}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}
                        />
                        <Chip
                            label={`Visible: ${totalVisible}/${totalPermissions}`}
                            size="small"
                            color="info"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                        />
                    </Stack>
                </Paper>

                {sortedPages.map((page) => {
                    const pageAllEnabled = isPageAllEnabled(page);
                    const pageAllVisible = isPageAllVisible(page);

                    return (
                        <Accordion
                            key={page}
                            expanded={expandedAccordions[`role_${page}`] || false}
                            onChange={handleAccordionChange(`role_${page}`)}
                            sx={{
                                '&:before': { display: 'none' },
                                boxShadow: 'none',
                                border: '1px solid',
                                borderColor: 'divider',
                                mb: 1,
                                borderRadius: '8px !important',
                                overflow: 'hidden'
                            }}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                sx={{
                                    bgcolor: isDarkMode ? '#1e293b' : 'grey.50',
                                    minHeight: { xs: 40, sm: 48 },
                                    px: { xs: 1, sm: 2 },
                                    '&.Mui-expanded': { minHeight: { xs: 40, sm: 48 } },
                                    '& .MuiAccordionSummary-content': { my: { xs: 0.5, sm: 1 } }
                                }}
                            >
                                <Box sx={{ flex: 1, mr: 1, overflow: 'hidden' }}>
                                    <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap" useFlexGap>
                                        <Typography fontWeight={600} fontSize={{ xs: '0.75rem', sm: '0.9rem' }} noWrap sx={{ maxWidth: { xs: '120px', sm: 'none' } }}>
                                            {PAGE_LABELS[page] || page}
                                        </Typography>
                                        <Chip
                                            label={grouped[page].length}
                                            size="small"
                                            sx={{ height: { xs: 16, sm: 20 }, fontSize: { xs: '0.6rem', sm: '0.7rem' }, '& .MuiChip-label': { px: 0.5 } }}
                                        />
                                        {pageAllEnabled && (
                                            <Chip label={isSmall ? '✓E' : '✓ Enabled'} size="small" color="success" variant="outlined" sx={{ height: { xs: 16, sm: 18 }, fontSize: { xs: '0.55rem', sm: '0.65rem' }, '& .MuiChip-label': { px: { xs: 0.3, sm: 0.5 } } }} />
                                        )}
                                        {pageAllVisible && (
                                            <Chip label={isSmall ? '✓V' : '✓ Visible'} size="small" color="info" variant="outlined" sx={{ height: { xs: 16, sm: 18 }, fontSize: { xs: '0.55rem', sm: '0.65rem' }, '& .MuiChip-label': { px: { xs: 0.3, sm: 0.5 } } }} />
                                        )}
                                    </Stack>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 0 }}>
                                {/* Page-level quick actions */}
                                <Box sx={{
                                    p: { xs: 0.5, sm: 1 },
                                    bgcolor: isDarkMode ? alpha(theme.palette.grey[800], 0.5) : 'grey.100',
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                    display: 'flex',
                                    gap: { xs: 0.5, sm: 1 },
                                    flexWrap: 'wrap'
                                }}>
                                    <Tooltip title={pageAllEnabled ? "Disable all in this section" : "Enable all in this section"}>
                                        <Button
                                            size="small"
                                            variant={pageAllEnabled ? "contained" : "outlined"}
                                            color="success"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectPageEnabled(page, !pageAllEnabled);
                                            }}
                                            startIcon={!isSmall && (pageAllEnabled ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />)}
                                            sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' }, py: 0.25, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                        >
                                            {isSmall ? (pageAllEnabled ? '✓ Enable' : 'Enable') : (pageAllEnabled ? 'All Enabled' : 'Enable All')}
                                        </Button>
                                    </Tooltip>
                                    <Tooltip title={pageAllVisible ? "Hide all in this section" : "Show all in this section"}>
                                        <Button
                                            size="small"
                                            variant={pageAllVisible ? "contained" : "outlined"}
                                            color="info"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectPageVisible(page, !pageAllVisible);
                                            }}
                                            startIcon={!isSmall && (pageAllVisible ? <VisibilityIcon /> : <VisibilityOffIcon />)}
                                            sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' }, py: 0.25, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                        >
                                            {isSmall ? (pageAllVisible ? '✓ Show' : 'Show') : (pageAllVisible ? 'All Visible' : 'Show All')}
                                        </Button>
                                    </Tooltip>
                                </Box>
                                <TableContainer>
                                    <Table size="small" sx={{ tableLayout: 'fixed' }}>
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: isDarkMode ? '#334155' : 'grey.100' }}>
                                                <TableCell sx={{ fontWeight: 600, py: { xs: 0.5, sm: 1 }, fontSize: { xs: '0.7rem', sm: '0.875rem' }, width: { xs: 'auto', sm: 'auto' } }}>Permission</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 600, py: { xs: 0.5, sm: 1 }, width: { xs: 50, sm: 80 }, px: { xs: 0.25, sm: 1 } }}>
                                                    <Tooltip title="Can use the feature">
                                                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.25}>
                                                            <LockOpenIcon sx={{ fontSize: { xs: 14, sm: 18 }, color: 'success.main' }} />
                                                            {!isSmall && <Typography component="span" sx={{ fontSize: '0.75rem' }}>Enable</Typography>}
                                                        </Stack>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 600, py: { xs: 0.5, sm: 1 }, width: { xs: 50, sm: 80 }, px: { xs: 0.25, sm: 1 } }}>
                                                    <Tooltip title="Can see in UI">
                                                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.25}>
                                                            <VisibilityIcon sx={{ fontSize: { xs: 14, sm: 18 }, color: 'info.main' }} />
                                                            {!isSmall && <Typography component="span" sx={{ fontSize: '0.75rem' }}>Show</Typography>}
                                                        </Stack>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {grouped[page].map(p => (
                                                <TableRow key={p.code} hover>
                                                    <TableCell sx={{ py: { xs: 0.25, sm: 0.75 }, px: { xs: 0.5, sm: 2 } }}>
                                                        <Typography variant="body2" fontWeight={500} sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, wordBreak: 'break-word' }}>
                                                            {p.name}
                                                        </Typography>
                                                        {!isSmall && (
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', wordBreak: 'break-all' }}>
                                                                {p.code}
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ py: { xs: 0.25, sm: 0.75 }, px: { xs: 0, sm: 1 } }}>
                                                        <Checkbox
                                                            checked={p.is_enabled}
                                                            onChange={() => handleToggleRoleEnabled(p.code)}
                                                            color="success"
                                                            size="small"
                                                            sx={{ p: { xs: 0.25, sm: 0.5 } }}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ py: { xs: 0.25, sm: 0.75 }, px: { xs: 0, sm: 1 } }}>
                                                        <Checkbox
                                                            checked={p.is_visible}
                                                            onChange={() => handleToggleRoleVisible(p.code)}
                                                            color="info"
                                                            size="small"
                                                            sx={{ p: { xs: 0.25, sm: 0.5 } }}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </AccordionDetails>
                        </Accordion>
                    );
                })}
            </Box>
        );
    };

    // User Override Accordions
    const UserOverrideAccordions = () => {
        const grouped = mergePagePermissions(userOverrides);
        const sortedPages = PAGE_ORDER.filter(p => grouped[p]?.length > 0);

        return (
            <Box>
                {sortedPages.map((page) => (
                    <Accordion
                        key={page}
                        expanded={expandedAccordions[`user_${page}`] || false}
                        onChange={handleAccordionChange(`user_${page}`)}
                        sx={{
                            '&:before': { display: 'none' },
                            boxShadow: 'none',
                            border: '1px solid',
                            borderColor: 'divider',
                            mb: 1,
                            borderRadius: '8px !important',
                            overflow: 'hidden'
                        }}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={{
                                bgcolor: isDarkMode ? '#1e293b' : 'grey.50',
                                minHeight: { xs: 40, sm: 48 },
                                px: { xs: 1, sm: 2 },
                                '&.Mui-expanded': { minHeight: { xs: 40, sm: 48 } },
                                '& .MuiAccordionSummary-content': { my: { xs: 0.5, sm: 1 } }
                            }}
                        >
                            <Typography fontWeight={600} fontSize={{ xs: '0.75rem', sm: '0.9rem' }} noWrap>
                                {PAGE_LABELS[page] || page}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ p: 0 }}>
                            <TableContainer>
                                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: isDarkMode ? '#334155' : 'grey.100' }}>
                                            <TableCell sx={{ fontWeight: 600, py: { xs: 0.5, sm: 1 }, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>Permission</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 600, py: { xs: 0.5, sm: 1 }, width: { xs: 50, sm: 90 }, px: { xs: 0.25, sm: 1 }, fontSize: { xs: '0.65rem', sm: '0.875rem' } }}>Enable</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 600, py: { xs: 0.5, sm: 1 }, width: { xs: 50, sm: 90 }, px: { xs: 0.25, sm: 1 }, fontSize: { xs: '0.65rem', sm: '0.875rem' } }}>Show</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {grouped[page].map(p => (
                                            <TableRow key={p.code} hover>
                                                <TableCell sx={{ py: { xs: 0.25, sm: 0.75 }, px: { xs: 0.5, sm: 2 } }}>
                                                    <Typography variant="body2" fontWeight={500} sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, wordBreak: 'break-word' }}>{p.name}</Typography>
                                                </TableCell>
                                                <TableCell align="center" sx={{ py: { xs: 0.25, sm: 0.75 }, px: { xs: 0, sm: 1 } }}>
                                                    <Checkbox
                                                        checked={p.effective_enabled || false}
                                                        indeterminate={p.override_enabled === null}
                                                        onChange={() => handleToggleUserOverrideEnabled(p.code)}
                                                        size="small"
                                                        sx={{
                                                            p: { xs: 0.25, sm: 0.5 },
                                                            color: p.override_enabled === null ? 'grey.400' : undefined
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell align="center" sx={{ py: { xs: 0.25, sm: 0.75 }, px: { xs: 0, sm: 1 } }}>
                                                    <Checkbox
                                                        checked={p.effective_visible || false}
                                                        indeterminate={p.override_visible === null}
                                                        onChange={() => handleToggleUserOverrideVisible(p.code)}
                                                        size="small"
                                                        sx={{
                                                            p: { xs: 0.25, sm: 0.5 },
                                                            color: p.override_visible === null ? 'grey.400' : undefined
                                                        }}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </AccordionDetails>
                    </Accordion>
                ))}
            </Box>
        );
    };

    // =====================================================
    // MAIN RENDER
    // =====================================================
    if (loading) {
        return (
            <AppLayout>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                    <CircularProgress />
                </Box>
            </AppLayout>
        );
    }

    // Allow super_admin and admin roles to access permissions page
    // For admin, their permissions are checked via RouteGuard
    const currentUserRole = user?.role;
    const canAccessPermissionsPage = isAdmin || currentUserRole === 'admin' || currentUserRole === 'super_admin';

    if (!canAccessPermissionsPage) {
        return (
            <AppLayout>
                <Alert severity="error">You do not have permission to access this page.</Alert>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
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
                    title="Permissions"
                    subtitle="Manage roles, user permissions and warehouse access"
                    icon="🔐"
                    warehouseName={activeWarehouse?.name}
                    userName={user?.full_name}
                />

                {/* Tabs - User Overrides & Warehouse Access only for super_admin */}
                <StandardTabs
                    value={tabValue}
                    onChange={(_, v) => {
                        // Prevent non-super_admin from accessing restricted tabs
                        if (!isSuperAdmin && v > 0) return;
                        setTabValue(v);
                        setSelectedRole(null);
                        setSelectedUser(null);
                    }}
                    tabs={isSuperAdmin
                        ? ['👥 Role Permissions', '👤 User Overrides', '🏢 Warehouse Access']
                        : ['👥 Role Permissions']
                    }
                    color="#1e40af"
                />

                {/* Content */}
                <Box sx={{ flex: 1, overflow: 'hidden', p: { xs: 1, md: 2 } }}>
                    {/* TAB 0: Role Permissions */}
                    <TabPanel value={tabValue} index={0}>
                        <Box sx={{
                            display: 'flex',
                            gap: 2,
                            height: 'calc(100vh - 220px)',
                            flexDirection: { xs: 'column', md: 'row' }
                        }}>
                            {/* Role List - Desktop Sidebar / Mobile Button */}
                            {isMobile ? (
                                <>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        onClick={() => setMobileDrawerOpen(true)}
                                        startIcon={<GroupIcon />}
                                        sx={{ mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: { xs: 0.75, sm: 1 } }}
                                    >
                                        {selectedRole ? (isSmall ? selectedRole.name : `Selected: ${selectedRole.name}`) : 'Select Role'}
                                    </Button>
                                    <Dialog
                                        open={mobileDrawerOpen}
                                        onClose={() => setMobileDrawerOpen(false)}
                                        fullWidth
                                        maxWidth="xs"
                                        PaperProps={{ sx: { borderRadius: 2, maxHeight: '70vh' } }}
                                    >
                                        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Typography fontWeight={600}>Select Role</Typography>
                                            <IconButton onClick={() => setMobileDrawerOpen(false)}>
                                                <CloseIcon />
                                            </IconButton>
                                        </Box>
                                        <Divider />
                                        <RoleList />
                                    </Dialog>
                                </>
                            ) : (
                                <Paper sx={{ width: 240, overflow: 'hidden', flexShrink: 0 }}>
                                    <RoleList />
                                </Paper>
                            )}

                            {/* Permissions Panel */}
                            <Paper sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                {selectedRole ? (
                                    <>
                                        <Box sx={{
                                            p: { xs: 1, sm: 2 },
                                            borderBottom: '1px solid',
                                            borderColor: 'divider',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: 1
                                        }}>
                                            <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '0.9rem', sm: '1.25rem' } }}>
                                                {selectedRole.name} Permissions
                                            </Typography>
                                            <Button
                                                variant="contained"
                                                startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />}
                                                onClick={handleSaveRolePermissions}
                                                disabled={saving}
                                                size="small"
                                                sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, px: { xs: 1, sm: 2 } }}
                                            >
                                                {saving ? 'Saving...' : (isSmall ? 'Save' : 'Save Changes')}
                                            </Button>
                                        </Box>
                                        <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 0.5, sm: 2 } }}>
                                            <RolePermissionAccordions />
                                        </Box>
                                    </>
                                ) : (
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '100%',
                                        flexDirection: 'column',
                                        color: 'text.secondary'
                                    }}>
                                        <GroupIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                                        <Typography>Select a role to manage permissions</Typography>
                                    </Box>
                                )}
                            </Paper>
                        </Box>
                    </TabPanel>

                    {/* TAB 1: User Overrides - Super Admin Only */}
                    {isSuperAdmin && (
                        <TabPanel value={tabValue} index={1}>
                            <Box sx={{
                                display: 'flex',
                                gap: 2,
                                height: 'calc(100vh - 220px)',
                                flexDirection: { xs: 'column', md: 'row' }
                            }}>
                                {/* User List */}
                                {isMobile ? (
                                    <>
                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            onClick={() => setMobileDrawerOpen(true)}
                                            startIcon={<PersonIcon />}
                                            sx={{ mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: { xs: 0.75, sm: 1 } }}
                                        >
                                            {selectedUser ? (isSmall ? (selectedUser.full_name || selectedUser.username).substring(0, 15) : `Selected: ${selectedUser.full_name || selectedUser.username}`) : 'Select User'}
                                        </Button>
                                        <Dialog
                                            open={mobileDrawerOpen}
                                            onClose={() => setMobileDrawerOpen(false)}
                                            fullWidth
                                            maxWidth="xs"
                                            PaperProps={{ sx: { borderRadius: 2, maxHeight: '70vh' } }}
                                        >
                                            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Typography fontWeight={600}>Select User</Typography>
                                                <IconButton onClick={() => setMobileDrawerOpen(false)}>
                                                    <CloseIcon />
                                                </IconButton>
                                            </Box>
                                            <Divider />
                                            <UserList />
                                        </Dialog>
                                    </>
                                ) : (
                                    <Paper sx={{ width: 280, overflow: 'hidden', flexShrink: 0, bgcolor: isDarkMode ? '#1e293b' : 'white' }}>
                                        <UserList />
                                    </Paper>
                                )}

                                {/* Overrides Panel */}
                                <Paper sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: isDarkMode ? '#1e293b' : 'white' }}>
                                    {selectedUser ? (
                                        <>
                                            <Box sx={{
                                                p: { xs: 1, sm: 2 },
                                                borderBottom: '1px solid',
                                                borderColor: 'divider',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                flexWrap: 'wrap',
                                                gap: 1
                                            }}>
                                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '0.85rem', sm: '1.25rem' } }} noWrap>
                                                        {selectedUser.full_name || selectedUser.username}
                                                    </Typography>
                                                    <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap" useFlexGap>
                                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.875rem' } }}>
                                                            Role:
                                                        </Typography>
                                                        <Chip label={userRole} size="small" sx={{ height: { xs: 16, sm: 20 }, fontSize: { xs: '0.6rem', sm: '0.75rem' } }} />
                                                        {!isSmall && (
                                                            <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                                                (grey = role default)
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                </Box>
                                                <Button
                                                    variant="contained"
                                                    startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />}
                                                    onClick={handleSaveUserOverrides}
                                                    disabled={saving}
                                                    size="small"
                                                    sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, px: { xs: 1, sm: 2 }, flexShrink: 0 }}
                                                >
                                                    {saving ? 'Saving...' : (isSmall ? 'Save' : 'Save Overrides')}
                                                </Button>
                                            </Box>
                                            <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 0.5, sm: 2 } }}>
                                                <UserOverrideAccordions />
                                            </Box>
                                        </>
                                    ) : (
                                        <Box sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '100%',
                                            flexDirection: 'column',
                                            color: 'text.secondary'
                                        }}>
                                            <PersonIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                                            <Typography>Select a user to manage overrides</Typography>
                                        </Box>
                                    )}
                                </Paper>
                            </Box>
                        </TabPanel>
                    )}

                    {/* TAB 2: Warehouse Access - Super Admin Only */}
                    {isSuperAdmin && (
                        <TabPanel value={tabValue} index={2}>
                            <Box sx={{
                                display: 'flex',
                                gap: 2,
                                height: 'calc(100vh - 220px)',
                                flexDirection: { xs: 'column', md: 'row' }
                            }}>
                                {/* User List */}
                                {isMobile ? (
                                    <>
                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            onClick={() => setMobileDrawerOpen(true)}
                                            startIcon={<PersonIcon />}
                                            sx={{ mb: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: { xs: 0.75, sm: 1 } }}
                                        >
                                            {selectedUser ? (isSmall ? (selectedUser.full_name || selectedUser.username).substring(0, 15) : `Selected: ${selectedUser.full_name || selectedUser.username}`) : 'Select User'}
                                        </Button>
                                        <Dialog
                                            open={mobileDrawerOpen}
                                            onClose={() => setMobileDrawerOpen(false)}
                                            fullWidth
                                            maxWidth="xs"
                                            PaperProps={{ sx: { borderRadius: 2, maxHeight: '70vh' } }}
                                        >
                                            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Typography fontWeight={600}>Select User</Typography>
                                                <IconButton onClick={() => setMobileDrawerOpen(false)}>
                                                    <CloseIcon />
                                                </IconButton>
                                            </Box>
                                            <Divider />
                                            <UserList />
                                        </Dialog>
                                    </>
                                ) : (
                                    <Paper sx={{ width: 280, overflow: 'hidden', flexShrink: 0, bgcolor: isDarkMode ? '#1e293b' : 'white' }}>
                                        <UserList />
                                    </Paper>
                                )}

                                {/* Warehouse Access Panel */}
                                <Paper sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: isDarkMode ? '#1e293b' : 'white' }}>
                                    {selectedUser ? (
                                        <>
                                            <Box sx={{
                                                p: { xs: 1, sm: 2 },
                                                borderBottom: '1px solid',
                                                borderColor: 'divider',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                flexWrap: 'wrap',
                                                gap: 1
                                            }}>
                                                <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '0.8rem', sm: '1.25rem' } }}>
                                                    {isSmall ? 'Warehouses' : `Warehouse Access for ${selectedUser.full_name || selectedUser.username}`}
                                                </Typography>
                                                <Button
                                                    variant="contained"
                                                    startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />}
                                                    onClick={handleSaveUserWarehouses}
                                                    disabled={saving}
                                                    size="small"
                                                    sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, px: { xs: 1, sm: 2 } }}
                                                >
                                                    {saving ? 'Saving...' : 'Save'}
                                                </Button>
                                            </Box>
                                            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                                                <Alert severity="info" sx={{ mb: 2 }}>
                                                    <Typography variant="body2">
                                                        <strong>No warehouses selected</strong> = User can access ALL warehouses.
                                                        <br />
                                                        <strong>Select specific warehouses</strong> = User can ONLY access selected warehouses.
                                                        <br />
                                                        <strong style={{ color: '#ed6c02' }}>Note:</strong> User must <strong>logout and login again</strong> for changes to take effect.
                                                    </Typography>
                                                </Alert>

                                                <Grid container spacing={2}>
                                                    {warehouses.map(wh => (
                                                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={wh.id}>
                                                            <Card
                                                                variant="outlined"
                                                                sx={{
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s',
                                                                    borderColor: userWarehouses.includes(wh.id) ? 'primary.main' : 'divider',
                                                                    bgcolor: userWarehouses.includes(wh.id) ? alpha(theme.palette.primary.main, 0.05) : 'white',
                                                                    '&:hover': {
                                                                        borderColor: 'primary.main',
                                                                        boxShadow: 2
                                                                    }
                                                                }}
                                                                onClick={() => handleToggleWarehouse(wh.id)}
                                                            >
                                                                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                                                    <Stack direction="row" alignItems="center" spacing={1}>
                                                                        <Checkbox
                                                                            checked={userWarehouses.includes(wh.id)}
                                                                            color="primary"
                                                                            sx={{ p: 0 }}
                                                                        />
                                                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                            <Typography fontWeight={600} noWrap>
                                                                                {wh.name}
                                                                            </Typography>
                                                                            <Typography variant="caption" color="text.secondary">
                                                                                {wh.code}
                                                                            </Typography>
                                                                        </Box>
                                                                        {userWarehouses.includes(wh.id) && (
                                                                            <Tooltip title={defaultWarehouseId === wh.id ? "Default warehouse" : "Set as default"}>
                                                                                <IconButton
                                                                                    size="small"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setDefaultWarehouseId(wh.id);
                                                                                    }}
                                                                                    color={defaultWarehouseId === wh.id ? "primary" : "default"}
                                                                                >
                                                                                    {defaultWarehouseId === wh.id ? (
                                                                                        <CheckCircleIcon />
                                                                                    ) : (
                                                                                        <RadioButtonUncheckedIcon />
                                                                                    )}
                                                                                </IconButton>
                                                                            </Tooltip>
                                                                        )}
                                                                    </Stack>
                                                                </CardContent>
                                                            </Card>
                                                        </Grid>
                                                    ))}
                                                </Grid>

                                                {userWarehouses.length > 0 && (
                                                    <Alert severity="success" sx={{ mt: 2 }}>
                                                        User has access to <strong>{userWarehouses.length}</strong> warehouse(s).
                                                        {defaultWarehouseId && (
                                                            <span> Default: <strong>{warehouses.find(w => w.id === defaultWarehouseId)?.name}</strong></span>
                                                        )}
                                                    </Alert>
                                                )}
                                            </Box>
                                        </>
                                    ) : (
                                        <Box sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '100%',
                                            flexDirection: 'column',
                                            color: 'text.secondary'
                                        }}>
                                            <WarehouseIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                                            <Typography>Select a user to manage warehouse access</Typography>
                                        </Box>
                                    )}
                                </Paper>
                            </Box>
                        </TabPanel>
                    )}
                </Box>

                {/* Snackbar */}
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={4000}
                    onClose={() => setSnackbar(s => ({ ...s, open: false }))}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert severity={snackbar.severity} variant="filled">
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Box>
        </AppLayout>
    );
}
