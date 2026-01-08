// File Path = wms_frontend/app/settings/permissions/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Tabs,
    Tab,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    Alert,
    CircularProgress,
    Chip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    TextField,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    People as PeopleIcon,
    Person as PersonIcon,
    Save as SaveIcon,
    RestartAlt as ResetIcon,
    Search as SearchIcon,
    CheckBox as CheckBoxIcon,
    CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { usePermissions } from '@/app/context/PermissionsContext';
import AppLayout from '@/components/AppLayout';
import { StandardPageHeader, StandardTabs } from '@/components';

const api = axios.create({
    baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000, // 60 second timeout for bulk operations
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

interface Permission {
    id: number;
    permission_key: string;
    permission_name: string;
    category: string;
    description: string;
    enabled?: boolean;
    role_permission_id?: number;
    source?: 'user' | 'role' | 'default';
}

interface Role {
    role: string;
    enabled_count: number;
    total_count: number;
}

interface User {
    id: number;
    username: string;
    full_name: string;
    role: string;
    email: string;
}

export default function PermissionsPage() {
    const { hasPermission, refreshPermissions } = usePermissions();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [tabValue, setTabValue] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Role-based permissions
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRole, setSelectedRole] = useState<string>('manager');
    const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
    const [roleChanges, setRoleChanges] = useState<Record<string, boolean>>({});

    // User-based permissions
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
    const [userChanges, setUserChanges] = useState<Record<string, boolean>>({});

    // Search and filter
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');

    // Permission categories
    const categories = [
        'all',
        'dashboard',
        'inbound',
        'outbound',
        'inventory',
        'picking',
        'qc',
        'reports',
        'customers',
        'master-data',
        'warehouses',
        'racks',
        'users',
        'backups',
        'printers',
        'settings',
    ];

    useEffect(() => {
        loadRoles();
        loadUsers();
    }, []);

    useEffect(() => {
        if (selectedRole && tabValue === 0) {
            loadRolePermissions(selectedRole);
        }
    }, [selectedRole, tabValue]);

    useEffect(() => {
        if (selectedUser && tabValue === 1) {
            loadUserPermissions(selectedUser.id);
        }
    }, [selectedUser, tabValue]);

    const loadRoles = async () => {
        try {
            const response = await api.get('/permissions/roles');
            setRoles(response.data);
        } catch (err: any) {
            console.error('Error loading roles:', err);
        }
    };

    const loadUsers = async () => {
        try {
            const response = await api.get('/users');
            setUsers(response.data);
        } catch (err: any) {
            console.error('Error loading users:', err);
        }
    };

    const loadRolePermissions = async (role: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/permissions/roles/${role}`);
            setRolePermissions(response.data);
            setRoleChanges({});
        } catch (err: any) {
            setError(err.message || 'Failed to load role permissions');
        } finally {
            setLoading(false);
        }
    };

    const loadUserPermissions = async (userId: number) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/permissions/users/${userId}/effective`);
            setUserPermissions(response.data.permissions);
            setUserChanges({});
        } catch (err: any) {
            setError(err.message || 'Failed to load user permissions');
        } finally {
            setLoading(false);
        }
    };

    const handleRolePermissionToggle = (permissionKey: string, currentValue: boolean) => {
        const newValue = !currentValue;
        setRoleChanges(prev => ({
            ...prev,
            [permissionKey]: newValue,
        }));

        // Update local state
        setRolePermissions(prev =>
            prev.map(p =>
                p.permission_key === permissionKey ? { ...p, enabled: newValue } : p
            )
        );
    };

    const handleUserPermissionToggle = (permissionKey: string, currentValue: boolean) => {
        const newValue = !currentValue;
        setUserChanges(prev => ({
            ...prev,
            [permissionKey]: newValue,
        }));

        // Update local state
        setUserPermissions(prev =>
            prev.map(p =>
                p.permission_key === permissionKey ? { ...p, enabled: newValue } : p
            )
        );
    };

    const saveRolePermissions = async () => {
        if (Object.keys(roleChanges).length === 0) {
            setError('No changes to save');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const permissions = Object.entries(roleChanges).map(([permission_key, enabled]) => ({
                permission_key,
                enabled,
            }));

            // Optimistic UI update - show success immediately
            setSuccess(`Saving ${permissions.length} permissions...`);

            await api.post(`/permissions/roles/${selectedRole}/bulk-update`, { permissions });

            setSuccess(`✓ Successfully updated ${permissions.length} permissions for ${selectedRole} role`);
            setRoleChanges({});

            // Broadcast to all tabs for instant update
            console.log('📡 Broadcasting permission update to all tabs...');
            if ((window as any).__PERMISSIONS_HOOK?.forceRefresh) {
                (window as any).__PERMISSIONS_HOOK.forceRefresh();
            }

            // Reload the settings page data
            await loadRoles();
        } catch (err: any) {
            setError(err.message || 'Failed to save permissions');
        } finally {
            setSaving(false);
        }
    };

    const saveUserPermissions = async () => {
        if (!selectedUser || Object.keys(userChanges).length === 0) {
            setError('No changes to save');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            for (const [permission_key, enabled] of Object.entries(userChanges)) {
                await api.put(`/permissions/users/${selectedUser.id}/${permission_key}`, { enabled });
            }

            setSuccess(`Successfully updated ${Object.keys(userChanges).length} permissions for ${selectedUser.username}`);
            setUserChanges({});
            await loadUserPermissions(selectedUser.id);

            // Trigger instant refresh via window hook
            if ((window as any).__PERMISSIONS_HOOK?.forceRefresh) {
                (window as any).__PERMISSIONS_HOOK.forceRefresh();
            }
        } catch (err: any) {
            setError(err.message || 'Failed to save permissions');
        } finally {
            setSaving(false);
        }
    };

    const resetRolePermissions = async () => {
        if (!confirm(`Are you sure you want to reset all permissions for ${selectedRole} role to defaults?`)) {
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            await api.post(`/permissions/roles/${selectedRole}/reset`);
            setSuccess(`Successfully reset permissions for ${selectedRole} role`);
            setRoleChanges({});
            await loadRolePermissions(selectedRole);
            await loadRoles();

            // Trigger instant refresh
            if ((window as any).__PERMISSIONS_HOOK?.forceRefresh) {
                (window as any).__PERMISSIONS_HOOK.forceRefresh();
            }
        } catch (err: any) {
            setError(err.message || 'Failed to reset permissions');
        } finally {
            setSaving(false);
        }
    };

    const filterPermissions = (permissions: Permission[]) => {
        return permissions.filter(p => {
            const matchesSearch = searchQuery === '' ||
                p.permission_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.permission_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.description?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory = filterCategory === 'all' || p.category === filterCategory;

            return matchesSearch && matchesCategory;
        });
    };

    const groupByCategory = (permissions: Permission[]) => {
        const grouped: Record<string, Permission[]> = {};
        permissions.forEach(p => {
            if (!grouped[p.category]) {
                grouped[p.category] = [];
            }
            grouped[p.category].push(p);
        });
        return grouped;
    };

    // Select/Unselect all permissions
    const handleSelectAllRole = (enable: boolean) => {
        const changes: Record<string, boolean> = {};
        const filteredPermissions = filterPermissions(rolePermissions);

        filteredPermissions.forEach(perm => {
            changes[perm.permission_key] = enable;
        });

        setRoleChanges(changes);
        setRolePermissions(prev =>
            prev.map(p => {
                if (filteredPermissions.find(fp => fp.permission_key === p.permission_key)) {
                    return { ...p, enabled: enable };
                }
                return p;
            })
        );
    };

    const handleSelectAllUser = (enable: boolean) => {
        const changes: Record<string, boolean> = {};
        const filteredPermissions = filterPermissions(userPermissions);

        filteredPermissions.forEach(perm => {
            changes[perm.permission_key] = enable;
        });

        setUserChanges(changes);
        setUserPermissions(prev =>
            prev.map(p => {
                if (filteredPermissions.find(fp => fp.permission_key === p.permission_key)) {
                    return { ...p, enabled: enable };
                }
                return p;
            })
        );
    };

    const handleSelectCategoryRole = (category: string, enable: boolean) => {
        const categoryPerms = rolePermissions.filter(p => p.category === category);
        const changes = { ...roleChanges };

        categoryPerms.forEach(perm => {
            changes[perm.permission_key] = enable;
        });

        setRoleChanges(changes);
        setRolePermissions(prev =>
            prev.map(p => {
                if (p.category === category) {
                    return { ...p, enabled: enable };
                }
                return p;
            })
        );
    };

    // Keep only the minimal Dashboard permissions (columns + export) in the UI
    const sanitizeGroupedPermissions = (grouped: Record<string, Permission[]>) => {
        const cloned = { ...grouped };
        if (cloned['dashboard']) {
            // Prefer one column entry and one export entry (pick first matching)
            const candidates = cloned['dashboard'].filter(p => /column/i.test(p.permission_key) || /export/i.test(p.permission_key));
            const kept: Permission[] = [];
            const seen = new Set<string>();
            for (const p of candidates) {
                const type = /column/i.test(p.permission_key) ? 'column' : /export/i.test(p.permission_key) ? 'export' : null;
                if (type && !seen.has(type)) {
                    kept.push(p);
                    seen.add(type);
                }
            }
            cloned['dashboard'] = kept;
        }
        return cloned;
    };

    const renderRolePermissions = () => {
        const filteredPermissions = filterPermissions(rolePermissions);
        let groupedPermissions = groupByCategory(filteredPermissions);
        groupedPermissions = sanitizeGroupedPermissions(groupedPermissions);
        const hasChanges = Object.keys(roleChanges).length > 0;
        const allEnabled = filteredPermissions.every(p => p.enabled);
        const allDisabled = filteredPermissions.every(p => !p.enabled);

        return (
            <Box>
                {/* Top Controls */}
                <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                    <FormControl sx={{ minWidth: { xs: '100%', md: 200 } }}>
                        <InputLabel>Role</InputLabel>
                        <Select
                            value={selectedRole}
                            onChange={(e) => {
                                setSelectedRole(e.target.value);
                                setRoleChanges({});
                            }}
                            label="Role"
                            size={isMobile ? 'small' : 'medium'}
                        >
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="manager">Manager</MenuItem>
                            <MenuItem value="operator">Operator</MenuItem>
                            <MenuItem value="qc">QC</MenuItem>
                            <MenuItem value="picker">Picker</MenuItem>
                        </Select>
                    </FormControl>

                    <TextField
                        placeholder="Search permissions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        size={isMobile ? 'small' : 'medium'}
                        InputProps={{
                            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                        }}
                        sx={{ flexGrow: 1 }}
                    />

                    <FormControl sx={{ minWidth: { xs: '100%', md: 150 } }}>
                        <InputLabel>Category</InputLabel>
                        <Select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            label="Category"
                            size={isMobile ? 'small' : 'medium'}
                        >
                            {categories.map(cat => (
                                <MenuItem key={cat} value={cat}>
                                    {cat === 'all' ? 'All Categories' : cat}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                {/* Select All / Action Buttons */}
                <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleSelectAllRole(true)}
                        disabled={allEnabled || selectedRole === 'admin'}
                        sx={{ fontSize: '0.75rem', py: 0.5 }}
                    >
                        All On
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleSelectAllRole(false)}
                        disabled={allDisabled || selectedRole === 'admin'}
                        sx={{ fontSize: '0.75rem', py: 0.5 }}
                    >
                        All Off
                    </Button>

                    <Box sx={{ flexGrow: 1 }} />

                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ResetIcon fontSize="small" />}
                        onClick={resetRolePermissions}
                        disabled={saving || selectedRole === 'admin'}
                        sx={{ fontSize: '0.75rem', py: 0.5 }}
                    >
                        Reset
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<SaveIcon fontSize="small" />}
                        onClick={saveRolePermissions}
                        disabled={!hasChanges || saving}
                        sx={{ fontSize: '0.75rem', py: 0.5 }}
                    >
                        Save {hasChanges && `(${Object.keys(roleChanges).length})`}
                    </Button>
                </Box>

                {selectedRole === 'admin' && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Admin role has all permissions enabled by default and cannot be modified.
                    </Alert>
                )}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box>
                        {Object.entries(groupedPermissions).map(([category, perms]) => {
                            const allCategoryEnabled = perms.every(p => p.enabled);
                            const allCategoryDisabled = perms.every(p => !p.enabled);

                            return (
                                <Accordion
                                    key={category}
                                    defaultExpanded={!isMobile}
                                    sx={{
                                        '&:before': { display: 'none' },
                                        boxShadow: 'none',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        mb: 1
                                    }}
                                >
                                    <AccordionSummary
                                        expandIcon={<ExpandMoreIcon />}
                                        sx={{ minHeight: 42, '& .MuiAccordionSummary-content': { my: 0.5 } }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', flexWrap: 'wrap' }}>
                                            <Typography variant="subtitle2" sx={{ textTransform: 'capitalize', fontWeight: 600 }}>
                                                {category.replace('-', ' ')}
                                            </Typography>
                                            <Chip
                                                label={`${perms.filter(p => p.enabled).length}/${perms.length}`}
                                                size="small"
                                                color={perms.filter(p => p.enabled).length === perms.length ? 'success' : 'default'}
                                                sx={{ height: 20, fontSize: '0.7rem' }}
                                            />
                                            {!isMobile && selectedRole !== 'admin' && (
                                                <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                                                    <Box
                                                        component="span"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSelectCategoryRole(category, true);
                                                        }}
                                                        sx={{
                                                            cursor: allCategoryEnabled ? 'default' : 'pointer',
                                                            opacity: allCategoryEnabled ? 0.5 : 1,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            p: 0.5,
                                                            borderRadius: 1,
                                                            '&:hover': !allCategoryEnabled ? {
                                                                bgcolor: 'action.hover'
                                                            } : {},
                                                            pointerEvents: allCategoryEnabled ? 'none' : 'auto'
                                                        }}
                                                    >
                                                        <CheckBoxIcon fontSize="small" />
                                                    </Box>
                                                    <Box
                                                        component="span"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSelectCategoryRole(category, false);
                                                        }}
                                                        sx={{
                                                            cursor: allCategoryDisabled ? 'default' : 'pointer',
                                                            opacity: allCategoryDisabled ? 0.5 : 1,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            p: 0.5,
                                                            borderRadius: 1,
                                                            '&:hover': !allCategoryDisabled ? {
                                                                bgcolor: 'action.hover'
                                                            } : {},
                                                            pointerEvents: allCategoryDisabled ? 'none' : 'auto'
                                                        }}
                                                    >
                                                        <CheckBoxOutlineBlankIcon fontSize="small" />
                                                    </Box>
                                                </Box>
                                            )}
                                        </Box>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <TableContainer>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Permission</TableCell>
                                                        {!isMobile && <TableCell>Description</TableCell>}
                                                        <TableCell align="center">Enabled</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {perms.map((perm) => (
                                                        <TableRow key={perm.permission_key}>
                                                            <TableCell>
                                                                <Typography variant="body2" fontWeight="medium" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                                                                    {perm.permission_name}
                                                                </Typography>
                                                                {isMobile && (
                                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                                                                        {perm.description}
                                                                    </Typography>
                                                                )}
                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                                                                    {perm.permission_key}
                                                                </Typography>
                                                            </TableCell>
                                                            {!isMobile && (
                                                                <TableCell>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        {perm.description}
                                                                    </Typography>
                                                                </TableCell>
                                                            )}
                                                            <TableCell align="center">
                                                                <Switch
                                                                    checked={perm.enabled || false}
                                                                    onChange={() => handleRolePermissionToggle(perm.permission_key, perm.enabled || false)}
                                                                    disabled={selectedRole === 'admin' || saving}
                                                                    color="primary"
                                                                    size={isMobile ? 'small' : 'medium'}
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
                )}
            </Box>
        );
    };

    const renderUserPermissions = () => {
        const filteredPermissions = filterPermissions(userPermissions);
        let groupedPermissions = groupByCategory(filteredPermissions);
        groupedPermissions = sanitizeGroupedPermissions(groupedPermissions);
        const hasChanges = Object.keys(userChanges).length > 0;
        const allEnabled = filteredPermissions.every(p => p.enabled);
        const allDisabled = filteredPermissions.every(p => !p.enabled);

        return (
            <Box>
                {/* Top Controls */}
                <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                    <FormControl sx={{ minWidth: { xs: '100%', md: 300 } }}>
                        <InputLabel>User</InputLabel>
                        <Select
                            value={selectedUser?.id || ''}
                            onChange={(e) => {
                                const user = users.find(u => u.id === e.target.value);
                                setSelectedUser(user || null);
                                setUserChanges({});
                            }}
                            label="User"
                            size={isMobile ? 'small' : 'medium'}
                        >
                            {users.map(user => (
                                <MenuItem key={user.id} value={user.id}>
                                    {user.full_name || user.username} ({user.role})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        placeholder="Search permissions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        size={isMobile ? 'small' : 'medium'}
                        InputProps={{
                            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                        }}
                        sx={{ flexGrow: 1 }}
                    />

                    <FormControl sx={{ minWidth: { xs: '100%', md: 150 } }}>
                        <InputLabel>Category</InputLabel>
                        <Select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            label="Category"
                            size={isMobile ? 'small' : 'medium'}
                        >
                            {categories.map(cat => (
                                <MenuItem key={cat} value={cat}>
                                    {cat === 'all' ? 'All Categories' : cat}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                {/* Select All / Action Buttons */}
                <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CheckBoxIcon />}
                        onClick={() => handleSelectAllUser(true)}
                        disabled={allEnabled || !selectedUser}
                    >
                        Select All
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CheckBoxOutlineBlankIcon />}
                        onClick={() => handleSelectAllUser(false)}
                        disabled={allDisabled || !selectedUser}
                    >
                        Unselect All
                    </Button>

                    <Box sx={{ flexGrow: 1 }} />

                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<SaveIcon />}
                        onClick={saveUserPermissions}
                        disabled={!hasChanges || saving || !selectedUser}
                    >
                        Save {hasChanges && `(${Object.keys(userChanges).length})`}
                    </Button>
                </Box>

                {selectedUser && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Configuring custom permissions for <strong>{selectedUser.full_name || selectedUser.username}</strong> ({selectedUser.role} role).
                        These will override the default role permissions.
                    </Alert>
                )}

                {!selectedUser ? (
                    <Alert severity="warning">Please select a user to manage their permissions.</Alert>
                ) : loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box>
                        {Object.entries(groupedPermissions).map(([category, perms]) => (
                            <Accordion key={category} defaultExpanded={!isMobile}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', flexWrap: 'wrap' }}>
                                        <Typography variant="h6" sx={{ textTransform: 'capitalize', fontSize: { xs: '1rem', md: '1.25rem' } }}>
                                            {category}
                                        </Typography>
                                        <Chip
                                            label={`${perms.filter(p => p.enabled).length} / ${perms.length}`}
                                            size="small"
                                            color={perms.filter(p => p.enabled).length === perms.length ? 'success' : 'default'}
                                        />
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Permission</TableCell>
                                                    {!isMobile && <TableCell>Description</TableCell>}
                                                    {!isMobile && <TableCell align="center">Source</TableCell>}
                                                    <TableCell align="center">Enabled</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {perms.map((perm) => (
                                                    <TableRow key={perm.permission_key}>
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight="medium" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                                                                {perm.permission_name}
                                                            </Typography>
                                                            {isMobile && (
                                                                <>
                                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                                                                        {perm.description}
                                                                    </Typography>
                                                                    <Chip
                                                                        label={perm.source || 'role'}
                                                                        size="small"
                                                                        color={perm.source === 'user' ? 'primary' : 'default'}
                                                                        sx={{ mt: 0.5, height: 20, fontSize: '0.65rem' }}
                                                                    />
                                                                </>
                                                            )}
                                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                                                                {perm.permission_key}
                                                            </Typography>
                                                        </TableCell>
                                                        {!isMobile && (
                                                            <TableCell>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {perm.description}
                                                                </Typography>
                                                            </TableCell>
                                                        )}
                                                        {!isMobile && (
                                                            <TableCell align="center">
                                                                <Chip
                                                                    label={perm.source || 'role'}
                                                                    size="small"
                                                                    color={perm.source === 'user' ? 'primary' : 'default'}
                                                                />
                                                            </TableCell>
                                                        )}
                                                        <TableCell align="center">
                                                            <Switch
                                                                checked={perm.enabled || false}
                                                                onChange={() => handleUserPermissionToggle(perm.permission_key, perm.enabled || false)}
                                                                disabled={saving}
                                                                color="primary"
                                                                size={isMobile ? 'small' : 'medium'}
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
                )}
            </Box>
        );
    };

    if (!hasPermission('view_permissions')) {
        return (
            <AppLayout>
                <Box sx={{ p: 3 }}>
                    <Alert severity="error">
                        You need 'View Permissions' permission to access the permissions management page.
                    </Alert>
                </Box>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Box sx={{
                height: '100%',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header Section */}
                <StandardPageHeader
                    title="Permissions Management"
                    subtitle="Manage role and user permissions"
                    icon="🔐"
                />

                {/* Tabs Section */}
                <StandardTabs
                    value={tabValue}
                    onChange={(event, newValue) => {
                        setTabValue(newValue);
                        setSearchQuery('');
                        setFilterCategory('all');
                        setError(null);
                        setSuccess(null);
                    }}
                    tabs={['Role Permissions', 'User Permissions']}
                    color="#667eea"
                />

                {/* Scrollable Content Wrapper */}
                <Box sx={{
                    flex: 1,
                    overflow: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    {/* Main Content Area */}
                    <Paper sx={{
                        p: { xs: 2, sm: 3 },
                        borderRadius: 2,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                        background: 'white',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                    }}>
                        {/* Alerts */}
                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                                {error}
                            </Alert>
                        )}

                        {success && (
                            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                                {success}
                            </Alert>
                        )}

                        {/* Tab Content */}
                        {tabValue === 0 && renderRolePermissions()}
                        {tabValue === 1 && renderUserPermissions()}
                    </Paper>
                </Box>
            </Box>
        </AppLayout>
    );
}
