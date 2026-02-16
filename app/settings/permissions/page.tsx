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
    CheckBox as CheckBoxIcon, CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
    Send as SendIcon, Pending as PendingIcon, History as HistoryIcon,
    ThumbUp as ApproveIcon, ThumbDown as RejectIcon, Cancel as CancelIcon,
    ArrowForward as ArrowForwardIcon, ArrowBack as ArrowBackIcon,
    Notifications as NotificationsIcon
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

// Approval Request interfaces
interface ApprovalRequest {
    id: number;
    request_type: 'role' | 'user_override';
    role_id: number | null;
    target_user_id: number | null;
    requested_by: number;
    status: 'pending' | 'approved' | 'rejected' | 'partially_approved';
    reviewer_id: number | null;
    reviewed_at: string | null;
    review_note: string | null;
    created_at: string;
    role_name: string | null;
    target_username: string | null;
    target_full_name: string | null;
    requester_username: string;
    requester_full_name: string | null;
    reviewer_username: string | null;
    reviewer_full_name: string | null;
    total_changes: number;
    approved_changes: number;
    rejected_changes: number;
    pending_changes: number;
}

interface ChangeDetail {
    id: number;
    request_id: number;
    permission_code: string;
    permission_name: string;
    category: string;
    page: string;
    old_is_enabled: boolean | null;
    new_is_enabled: boolean | null;
    old_is_visible: boolean | null;
    new_is_visible: boolean | null;
    is_approved: boolean | null;
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
    'rejections': '17. Settings/Rejections',
    'settings-rejections': '17. Settings/Rejections',
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
    'settings-appearance', 'settings-errorlogs', 'rejections', 'settings-rejections'
];

export default function PermissionsPage() {
    const { isAdmin, refreshPermissions, canAccessMenu, canSee } = usePermissions();
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

    // Check tab permissions - uses both role-based and user override permissions
    const isSuperAdmin = user?.role === 'super_admin';

    // Check individual tab access via permission system (respects user overrides)
    const canSeeApprovalQueue = isSuperAdmin || canSee('tab:approval-queue');
    const canSeeUserOverrides = isSuperAdmin || canSee('tab:user-overrides');
    const canSeeWarehouseAccess = isSuperAdmin || canSee('tab:warehouse-access');

    // Compute dynamic tab indices based on which tabs are visible
    // Tab order: [Role Permissions, Approval Queue?, My Requests, User Overrides?, Warehouse Access?]
    const TAB_ROLE_PERMISSIONS = 0;
    const TAB_APPROVAL_QUEUE = canSeeApprovalQueue ? 1 : -1; // -1 = not visible
    const TAB_MY_REQUESTS = canSeeApprovalQueue ? 2 : 1;
    const TAB_USER_OVERRIDES = canSeeUserOverrides ? (TAB_MY_REQUESTS + 1) : -1;
    const TAB_WAREHOUSE_ACCESS = canSeeWarehouseAccess ? (TAB_MY_REQUESTS + (canSeeUserOverrides ? 2 : 1)) : -1;

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

    // =====================================================
    // APPROVAL WORKFLOW STATE
    // =====================================================
    const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
    const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
    const [myRequests, setMyRequests] = useState<ApprovalRequest[]>([]);
    const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
    const [requestDetails, setRequestDetails] = useState<ChangeDetail[]>([]);
    const [selectedChanges, setSelectedChanges] = useState<Set<number>>(new Set());
    const [approvalNote, setApprovalNote] = useState('');
    const [loadingApproval, setLoadingApproval] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [originalRolePermissions, setOriginalRolePermissions] = useState<Permission[]>([]);

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
            // Use Promise.allSettled so one failed API call doesn't block the entire page
            const [rolesRes, permRes, usersRes, whRes] = await Promise.allSettled([
                permissionsAPI.getRoles(),
                permissionsAPI.getAll(),
                usersAPI.getAll(),
                warehousesAPI.getAll(),
            ]);

            setRoles(rolesRes.status === 'fulfilled' ? (rolesRes.value.data || []) : []);
            setAllPermissions(permRes.status === 'fulfilled' ? (permRes.value.data?.permissions || []) : []);
            setUsers(usersRes.status === 'fulfilled' ? (usersRes.value.data || []) : []);
            setWarehouses(whRes.status === 'fulfilled' ? (whRes.value.data || []) : []);

            // Log individual failures for debugging
            const results = [rolesRes, permRes, usersRes, whRes];
            const names = ['roles', 'permissions', 'users', 'warehouses'];
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    console.warn(`[Permissions] Failed to load ${names[i]}:`, r.reason?.response?.status || r.reason?.message);
                }
            });

            // Only show error if critical data (roles + permissions) failed
            if (rolesRes.status === 'rejected' && permRes.status === 'rejected') {
                showSnackbar('Failed to load permissions data', 'error');
            }

            // Load approval data
            await loadApprovalData();
        } catch (error) {
            console.error('Load data error:', error);
            showSnackbar('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    // =====================================================
    // APPROVAL WORKFLOW FUNCTIONS
    // =====================================================
    const loadApprovalData = async () => {
        try {
            // Load pending count for badge
            const countRes = await permissionsAPI.getPendingApprovalCount();
            setPendingApprovalCount(countRes.data.count || 0);

            // Super admin: load all pending requests
            if (user?.role === 'super_admin') {
                const requestsRes = await permissionsAPI.getApprovalRequests('pending');
                setApprovalRequests(requestsRes.data || []);
            }

            // Load my requests
            const myRes = await permissionsAPI.getMyApprovalRequests();
            setMyRequests(myRes.data || []);
        } catch (error) {
            console.error('Load approval data error:', error);
        }
    };

    // Reload approval data when user changes
    useEffect(() => {
        if (user) {
            loadApprovalData();
        }
    }, [user]);

    const loadRequestDetails = async (request: ApprovalRequest) => {
        try {
            setLoadingApproval(true);
            const res = await permissionsAPI.getApprovalRequestDetails(request.id);
            setRequestDetails(res.data.details || []);
            setSelectedChanges(new Set()); // Reset selections
        } catch (error) {
            showSnackbar('Failed to load request details', 'error');
        } finally {
            setLoadingApproval(false);
        }
    };

    const handleSelectRequest = async (request: ApprovalRequest) => {
        setSelectedRequest(request);
        await loadRequestDetails(request);
    };

    const handleToggleChangeSelection = (detailId: number) => {
        setSelectedChanges(prev => {
            const newSet = new Set(prev);
            if (newSet.has(detailId)) {
                newSet.delete(detailId);
            } else {
                newSet.add(detailId);
            }
            return newSet;
        });
    };

    const handleSelectAllChanges = () => {
        const pendingIds = requestDetails.filter(d => d.is_approved === null).map(d => d.id);
        setSelectedChanges(new Set(pendingIds));
    };

    const handleDeselectAllChanges = () => {
        setSelectedChanges(new Set());
    };

    const handleApproveSelected = async () => {
        if (selectedChanges.size === 0 || !selectedRequest) return;
        try {
            setLoadingApproval(true);
            const changes = Array.from(selectedChanges).map(id => ({ detailId: id, is_approved: true }));
            await permissionsAPI.updateChangeApprovals(selectedRequest.id, changes);
            showSnackbar(`${changes.length} changes approved`, 'success');
            await loadRequestDetails(selectedRequest);
        } catch (error) {
            showSnackbar('Failed to approve changes', 'error');
        } finally {
            setLoadingApproval(false);
        }
    };

    const handleRejectSelected = async () => {
        if (selectedChanges.size === 0 || !selectedRequest) return;
        try {
            setLoadingApproval(true);
            const changes = Array.from(selectedChanges).map(id => ({ detailId: id, is_approved: false }));
            await permissionsAPI.updateChangeApprovals(selectedRequest.id, changes);
            showSnackbar(`${changes.length} changes rejected`, 'success');
            await loadRequestDetails(selectedRequest);
        } catch (error) {
            showSnackbar('Failed to reject changes', 'error');
        } finally {
            setLoadingApproval(false);
        }
    };

    const handleFinalizeRequest = async (action: 'approve' | 'reject' | 'partial') => {
        if (!selectedRequest) return;
        try {
            setLoadingApproval(true);
            await permissionsAPI.finalizeRequest(
                selectedRequest.id,
                action,
                approvalNote || undefined,
                action === 'approve'
            );
            showSnackbar(`Request ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'finalized'}`, 'success');
            setSelectedRequest(null);
            setRequestDetails([]);
            setApprovalNote('');
            await loadApprovalData();
            await refreshPermissions();
        } catch (error) {
            showSnackbar('Failed to finalize request', 'error');
        } finally {
            setLoadingApproval(false);
        }
    };

    const handleCancelRequest = async (requestId: number) => {
        try {
            await permissionsAPI.cancelRequest(requestId);
            showSnackbar('Request cancelled', 'success');
            await loadApprovalData();
        } catch (error) {
            showSnackbar('Failed to cancel request', 'error');
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
        setHasUnsavedChanges(false);
        try {
            const res = await permissionsAPI.getRolePermissions(role.id);
            const perms = res.data || [];
            setRolePermissions(perms);
            setOriginalRolePermissions(JSON.parse(JSON.stringify(perms))); // Deep copy
        } catch (error) {
            showSnackbar('Failed to load role permissions', 'error');
        }
    };

    const handleToggleRoleEnabled = (code: string) => {
        setRolePermissions(prev => prev.map(p =>
            p.code === code ? { ...p, is_enabled: !p.is_enabled } : p
        ));
        setHasUnsavedChanges(true);
    };

    const handleToggleRoleVisible = (code: string) => {
        setRolePermissions(prev => prev.map(p =>
            p.code === code ? { ...p, is_visible: !p.is_visible } : p
        ));
        setHasUnsavedChanges(true);
    };

    // =====================================================
    // BULK ACTIONS FOR ROLE PERMISSIONS
    // =====================================================

    // Select/Unselect all enabled for entire role
    const handleSelectAllEnabled = (enabled: boolean) => {
        setRolePermissions(prev => prev.map(p => ({ ...p, is_enabled: enabled })));
        setHasUnsavedChanges(true);
    };

    // Select/Unselect all visible for entire role
    const handleSelectAllVisible = (visible: boolean) => {
        setRolePermissions(prev => prev.map(p => ({ ...p, is_visible: visible })));
        setHasUnsavedChanges(true);
    };

    // Select/Unselect all for a specific page
    const handleSelectPageEnabled = (page: string, enabled: boolean) => {
        setRolePermissions(prev => prev.map(p => {
            let normalizedPage = p.page;
            if (p.page === 'warehouses') normalizedPage = 'settings-warehouses';
            if (p.page === 'racks') normalizedPage = 'settings-racks';
            return normalizedPage === page ? { ...p, is_enabled: enabled } : p;
        }));
        setHasUnsavedChanges(true);
    };

    const handleSelectPageVisible = (page: string, visible: boolean) => {
        setRolePermissions(prev => prev.map(p => {
            let normalizedPage = p.page;
            if (p.page === 'warehouses') normalizedPage = 'settings-warehouses';
            if (p.page === 'racks') normalizedPage = 'settings-racks';
            return normalizedPage === page ? { ...p, is_visible: visible } : p;
        }));
        setHasUnsavedChanges(true);
    };

    // Set view-only permissions (all visible, only menu enabled)
    const handleSetViewOnly = () => {
        setRolePermissions(prev => prev.map(p => ({
            ...p,
            is_enabled: p.code.startsWith('menu:'), // Only enable menu permissions
            is_visible: true // All visible
        })));
        setHasUnsavedChanges(true);
    };

    // Set full access
    const handleSetFullAccess = () => {
        setRolePermissions(prev => prev.map(p => ({
            ...p,
            is_enabled: true,
            is_visible: true
        })));
        setHasUnsavedChanges(true);
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

    // Count changed permissions for display
    const getChangedPermissionsCount = (): number => {
        if (originalRolePermissions.length === 0) return 0;
        return rolePermissions.filter((p, idx) => {
            const orig = originalRolePermissions.find(o => o.code === p.code);
            if (!orig) return false;
            return p.is_enabled !== orig.is_enabled || p.is_visible !== orig.is_visible;
        }).length;
    };

    const handleSaveRolePermissions = async () => {
        if (!selectedRole) return;

        // Super admin: Direct save
        if (isSuperAdmin) {
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
                setHasUnsavedChanges(false);
                setOriginalRolePermissions(JSON.parse(JSON.stringify(rolePermissions)));
                await refreshPermissions();
            } catch (error: any) {
                console.error('Save role permissions error:', error);
                const errorMsg = error?.response?.data?.error || error?.message || 'Network error';
                showSnackbar(`Failed to save: ${errorMsg}`, 'error');
            } finally {
                setSaving(false);
            }
            return;
        }

        // Non-super_admin: Create approval request
        try {
            setSaving(true);
            await permissionsAPI.createRolePermissionRequest(
                selectedRole.id,
                rolePermissions.map(p => ({
                    code: p.code,
                    is_enabled: p.is_enabled,
                    is_visible: p.is_visible
                }))
            );
            showSnackbar('Permission change request submitted for approval', 'success');
            setHasUnsavedChanges(false);
            // Reset to original
            setRolePermissions(JSON.parse(JSON.stringify(originalRolePermissions)));
            await loadApprovalData();
        } catch (error: any) {
            console.error('Create approval request error:', error);
            const errorMsg = error?.response?.data?.error || error?.message || 'Network error';
            showSnackbar(`Failed to submit: ${errorMsg}`, 'error');
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

    // =====================================================
    // BULK ACTIONS FOR USER OVERRIDES
    // =====================================================

    // Override all enabled to a value (true/false)
    const handleOverrideAllEnabled = (enabled: boolean) => {
        setUserOverrides(prev => prev.map(p => ({
            ...p,
            override_enabled: enabled,
            effective_enabled: enabled
        })));
    };

    // Override all visible to a value (true/false)
    const handleOverrideAllVisible = (visible: boolean) => {
        setUserOverrides(prev => prev.map(p => ({
            ...p,
            override_visible: visible,
            effective_visible: visible
        })));
    };

    // Reset all overrides back to role defaults (null)
    const handleResetAllOverrides = () => {
        setUserOverrides(prev => prev.map(p => ({
            ...p,
            override_enabled: null,
            override_visible: null,
            effective_enabled: p.role_enabled,
            effective_visible: p.role_visible
        })));
    };

    // Override all for a specific page
    const handleOverridePageEnabled = (page: string, enabled: boolean) => {
        setUserOverrides(prev => prev.map(p => {
            let normalizedPage = p.page;
            if (p.page === 'warehouses') normalizedPage = 'settings-warehouses';
            if (p.page === 'racks') normalizedPage = 'settings-racks';
            if (normalizedPage !== page) return p;
            return { ...p, override_enabled: enabled, effective_enabled: enabled };
        }));
    };

    const handleOverridePageVisible = (page: string, visible: boolean) => {
        setUserOverrides(prev => prev.map(p => {
            let normalizedPage = p.page;
            if (p.page === 'warehouses') normalizedPage = 'settings-warehouses';
            if (p.page === 'racks') normalizedPage = 'settings-racks';
            if (normalizedPage !== page) return p;
            return { ...p, override_visible: visible, effective_visible: visible };
        }));
    };

    // Reset page overrides back to role defaults
    const handleResetPageOverrides = (page: string) => {
        setUserOverrides(prev => prev.map(p => {
            let normalizedPage = p.page;
            if (p.page === 'warehouses') normalizedPage = 'settings-warehouses';
            if (p.page === 'racks') normalizedPage = 'settings-racks';
            if (normalizedPage !== page) return p;
            return { ...p, override_enabled: null, override_visible: null, effective_enabled: p.role_enabled, effective_visible: p.role_visible };
        }));
    };

    // Check page-level override states
    const isOverridePageAllEnabled = (page: string): boolean => {
        const pagePerms = userOverrides.filter(p => {
            let np = p.page;
            if (p.page === 'warehouses') np = 'settings-warehouses';
            if (p.page === 'racks') np = 'settings-racks';
            return np === page;
        });
        return pagePerms.length > 0 && pagePerms.every(p => p.effective_enabled);
    };

    const isOverridePageAllVisible = (page: string): boolean => {
        const pagePerms = userOverrides.filter(p => {
            let np = p.page;
            if (p.page === 'warehouses') np = 'settings-warehouses';
            if (p.page === 'racks') np = 'settings-racks';
            return np === page;
        });
        return pagePerms.length > 0 && pagePerms.every(p => p.effective_visible);
    };

    // Count overrides for display
    const getOverrideCount = (): number => {
        return userOverrides.filter(p => p.override_enabled !== null || p.override_visible !== null).length;
    };

    const handleSaveUserOverrides = async () => {
        if (!selectedUser) return;

        const overrides = userOverrides
            .filter(p => p.override_enabled !== null || p.override_visible !== null)
            .map(p => ({
                code: p.code,
                is_enabled: p.override_enabled ?? null,
                is_visible: p.override_visible ?? null
            }));

        // Super admin: Direct save
        if (isSuperAdmin) {
            try {
                setSaving(true);
                await permissionsAPI.updateUserOverrides(selectedUser.id, overrides);
                showSnackbar('User overrides saved successfully', 'success');
                await refreshPermissions();
            } catch (error: any) {
                console.error('Save user overrides error:', error);
                const errorMsg = error?.response?.data?.error || error?.message || 'Network error';
                showSnackbar(`Failed to save: ${errorMsg}`, 'error');
            } finally {
                setSaving(false);
            }
            return;
        }

        // Non-super_admin (admin): Create approval request
        try {
            setSaving(true);
            await permissionsAPI.createUserOverrideRequest(selectedUser.id, overrides);
            showSnackbar('Override change request submitted for approval', 'success');
            // Reload original overrides
            const overridesRes = await permissionsAPI.getUserOverrides(selectedUser.id);
            setUserOverrides(overridesRes.data.permissions || []);
            await loadApprovalData();
        } catch (error: any) {
            console.error('Create user override request error:', error);
            const errorMsg = error?.response?.data?.error || error?.message || 'Network error';
            showSnackbar(`Failed to submit: ${errorMsg}`, 'error');
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

        // Only super_admin can save warehouse access directly
        if (!isSuperAdmin) {
            showSnackbar('Only Super Admin can update warehouse access. Please contact your super admin.', 'error');
            return;
        }

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
                                secondaryTypographyProps={{ component: 'div' }}
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

        // Calculate totals
        const totalEnabled = userOverrides.filter(p => p.effective_enabled).length;
        const totalVisible = userOverrides.filter(p => p.effective_visible).length;
        const totalOverrides = getOverrideCount();
        const totalPermissions = userOverrides.length;

        return (
            <Box>
                {/* Global Quick Actions */}
                <Paper sx={{
                    p: { xs: 1, sm: 1.5 },
                    mb: 2,
                    bgcolor: isDarkMode ? alpha(theme.palette.secondary.main, 0.1) : alpha(theme.palette.secondary.main, 0.05),
                    border: '1px solid',
                    borderColor: isDarkMode ? alpha(theme.palette.secondary.main, 0.3) : alpha(theme.palette.secondary.main, 0.2),
                    borderRadius: 2
                }}>
                    <Stack direction="column" spacing={1}>
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(5, auto) 1fr auto' },
                            gap: { xs: 0.5, sm: 1 },
                            alignItems: 'center'
                        }}>
                            <Tooltip title="Override: Enable all permissions">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="success"
                                    startIcon={!isSmall && <SelectAllIcon />}
                                    onClick={() => handleOverrideAllEnabled(true)}
                                    sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                >
                                    {isSmall ? '✓ All' : 'Enable All'}
                                </Button>
                            </Tooltip>
                            <Tooltip title="Override: Disable all permissions">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    startIcon={!isSmall && <DeselectIcon />}
                                    onClick={() => handleOverrideAllEnabled(false)}
                                    sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                >
                                    {isSmall ? '✗ All' : 'Disable All'}
                                </Button>
                            </Tooltip>
                            <Tooltip title="Override: Show all in UI">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="info"
                                    startIcon={!isSmall && <VisibilityIcon />}
                                    onClick={() => handleOverrideAllVisible(true)}
                                    sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                >
                                    {isSmall ? '👁 All' : 'Show All'}
                                </Button>
                            </Tooltip>
                            <Tooltip title="Override: Hide all from UI">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={!isSmall && <VisibilityOffIcon />}
                                    onClick={() => handleOverrideAllVisible(false)}
                                    sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                >
                                    {isSmall ? '🚫 All' : 'Hide All'}
                                </Button>
                            </Tooltip>
                            <Tooltip title="Reset all overrides to role defaults">
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="warning"
                                    startIcon={!isSmall && <RefreshIcon />}
                                    onClick={handleResetAllOverrides}
                                    sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                >
                                    {isSmall ? 'Reset' : 'Reset All'}
                                </Button>
                            </Tooltip>
                            <Box sx={{ display: { xs: 'none', sm: 'block' } }} />
                            <Tooltip title="Full Access: Override enable & show everything">
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    startIcon={!isSmall && <FullAccessIcon />}
                                    onClick={() => { handleOverrideAllEnabled(true); handleOverrideAllVisible(true); }}
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
                            sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}
                        />
                        <Chip
                            label={`Overrides: ${totalOverrides}`}
                            size="small"
                            color={totalOverrides > 0 ? 'secondary' : 'default'}
                            variant="outlined"
                            sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }}
                        />
                    </Stack>
                </Paper>

                {sortedPages.map((page) => {
                    const pageAllEnabled = isOverridePageAllEnabled(page);
                    const pageAllVisible = isOverridePageAllVisible(page);

                    return (
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
                                                handleOverridePageEnabled(page, !pageAllEnabled);
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
                                                handleOverridePageVisible(page, !pageAllVisible);
                                            }}
                                            startIcon={!isSmall && (pageAllVisible ? <VisibilityIcon /> : <VisibilityOffIcon />)}
                                            sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' }, py: 0.25, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                        >
                                            {isSmall ? (pageAllVisible ? '✓ Show' : 'Show') : (pageAllVisible ? 'All Visible' : 'Show All')}
                                        </Button>
                                    </Tooltip>
                                    <Tooltip title="Reset this section to role defaults">
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            color="warning"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleResetPageOverrides(page);
                                            }}
                                            startIcon={!isSmall && <RefreshIcon />}
                                            sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' }, py: 0.25, px: { xs: 0.5, sm: 1 }, minWidth: 0 }}
                                        >
                                            {isSmall ? 'Reset' : 'Reset'}
                                        </Button>
                                    </Tooltip>
                                </Box>
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
                    );
                })}
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

    // Allow access if user has menu:settings:permissions permission enabled
    // super_admin always has access (isAdmin = true only for super_admin)
    // Other roles need the permission explicitly enabled
    const canAccessPermissionsPage = isAdmin || canAccessMenu('settings:permissions');

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

                {/* Tabs - Dynamic based on user permissions (respects user overrides) */}
                <StandardTabs
                    value={tabValue}
                    onChange={(_, v) => {
                        setTabValue(v);
                        setSelectedRole(null);
                        setSelectedUser(null);
                        setSelectedRequest(null);
                    }}
                    tabs={[
                        '👥 Role Permissions',
                        ...(canSeeApprovalQueue ? [`🔔 Approval Queue${pendingApprovalCount > 0 ? ` (${pendingApprovalCount})` : ''}`] : []),
                        '📋 My Requests',
                        ...(canSeeUserOverrides ? ['👤 User Overrides'] : []),
                        ...(canSeeWarehouseAccess ? ['🏢 Warehouse Access'] : [])
                    ]}
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
                                            <Box>
                                                <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '0.9rem', sm: '1.25rem' } }}>
                                                    {selectedRole.name} Permissions
                                                </Typography>
                                                {hasUnsavedChanges && (
                                                    <Typography variant="caption" color="warning.main">
                                                        {getChangedPermissionsCount()} permission(s) changed
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Stack direction="row" spacing={1}>
                                                {!isSuperAdmin && hasUnsavedChanges && (
                                                    <Chip
                                                        label="Needs Super Admin Approval"
                                                        color="warning"
                                                        size="small"
                                                        icon={<PendingIcon />}
                                                    />
                                                )}
                                                <Button
                                                    variant="contained"
                                                    color={isSuperAdmin ? "primary" : "warning"}
                                                    startIcon={saving ? <CircularProgress size={14} color="inherit" /> : (isSuperAdmin ? <SaveIcon sx={{ fontSize: { xs: 16, sm: 20 } }} /> : <SendIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />)}
                                                    onClick={handleSaveRolePermissions}
                                                    disabled={saving || !hasUnsavedChanges}
                                                    size="small"
                                                    sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, px: { xs: 1, sm: 2 } }}
                                                >
                                                    {saving
                                                        ? (isSuperAdmin ? 'Saving...' : 'Submitting...')
                                                        : (isSuperAdmin
                                                            ? (isSmall ? 'Save' : 'Save Changes')
                                                            : (isSmall ? 'Submit' : 'Submit for Approval')
                                                        )
                                                    }
                                                </Button>
                                            </Stack>
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

                    {/* TAB: Approval Queue - For users with tab:approval-queue permission */}
                    {canSeeApprovalQueue && (
                        <TabPanel value={tabValue} index={TAB_APPROVAL_QUEUE}>
                            <Box sx={{ height: 'calc(100vh - 220px)', display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
                                {/* Request List */}
                                <Paper sx={{ width: { xs: '100%', md: 300 }, overflow: 'hidden', flexShrink: 0 }}>
                                    <Box sx={{ p: 2, bgcolor: isDarkMode ? '#1e293b' : 'grey.100', borderBottom: '1px solid', borderColor: 'divider' }}>
                                        <Typography variant="subtitle1" fontWeight={600}>
                                            🔔 Pending Requests ({approvalRequests.length})
                                        </Typography>
                                    </Box>
                                    <List dense sx={{ overflow: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
                                        {approvalRequests.length === 0 ? (
                                            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                                                <CheckCircleIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                                                <Typography>No pending requests</Typography>
                                            </Box>
                                        ) : (
                                            approvalRequests.map(req => (
                                                <ListItemButton
                                                    key={req.id}
                                                    selected={selectedRequest?.id === req.id}
                                                    onClick={() => handleSelectRequest(req)}
                                                    sx={{
                                                        borderBottom: '1px solid',
                                                        borderColor: 'divider',
                                                        '&.Mui-selected': {
                                                            bgcolor: alpha(theme.palette.primary.main, 0.12),
                                                            borderLeft: `3px solid ${theme.palette.primary.main}`,
                                                        }
                                                    }}
                                                >
                                                    <ListItemText
                                                        primary={
                                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                                <Typography fontWeight={500} fontSize="0.875rem">
                                                                    {req.request_type === 'role' ? `Role: ${req.role_name}` : `User: ${req.target_full_name || req.target_username}`}
                                                                </Typography>
                                                            </Stack>
                                                        }
                                                        secondary={
                                                            <Stack spacing={0.5}>
                                                                <Typography variant="caption">
                                                                    By: {req.requester_full_name || req.requester_username}
                                                                </Typography>
                                                                <Stack direction="row" spacing={0.5}>
                                                                    <Chip label={`${req.total_changes} changes`} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                                                                    <Chip label={new Date(req.created_at).toLocaleDateString()} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                                                                </Stack>
                                                            </Stack>
                                                        }
                                                        primaryTypographyProps={{ component: 'div' }}
                                                        secondaryTypographyProps={{ component: 'div' }}
                                                    />
                                                </ListItemButton>
                                            ))
                                        )}
                                    </List>
                                    <Button
                                        fullWidth
                                        variant="text"
                                        startIcon={<RefreshIcon />}
                                        onClick={loadApprovalData}
                                        sx={{ borderTop: '1px solid', borderColor: 'divider' }}
                                    >
                                        Refresh
                                    </Button>
                                </Paper>

                                {/* Request Details Panel */}
                                <Paper sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                    {selectedRequest ? (
                                        <>
                                            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: isDarkMode ? '#1e293b' : 'grey.50' }}>
                                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                                                    <Box>
                                                        <Typography variant="h6" fontWeight={600}>
                                                            Request #{selectedRequest.id}
                                                        </Typography>
                                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                                            <Chip
                                                                label={selectedRequest.request_type === 'role' ? `Role: ${selectedRequest.role_name}` : `User: ${selectedRequest.target_full_name}`}
                                                                color="primary"
                                                                size="small"
                                                            />
                                                            <Chip
                                                                label={`By: ${selectedRequest.requester_full_name || selectedRequest.requester_username}`}
                                                                variant="outlined"
                                                                size="small"
                                                            />
                                                            <Chip
                                                                label={new Date(selectedRequest.created_at).toLocaleString()}
                                                                variant="outlined"
                                                                size="small"
                                                            />
                                                        </Stack>
                                                    </Box>
                                                    <Stack direction="row" spacing={1}>
                                                        <Button
                                                            variant="contained"
                                                            color="success"
                                                            size="small"
                                                            startIcon={<ApproveIcon />}
                                                            onClick={() => handleFinalizeRequest('approve')}
                                                            disabled={loadingApproval}
                                                        >
                                                            Approve All
                                                        </Button>
                                                        <Button
                                                            variant="contained"
                                                            color="error"
                                                            size="small"
                                                            startIcon={<RejectIcon />}
                                                            onClick={() => handleFinalizeRequest('reject')}
                                                            disabled={loadingApproval}
                                                        >
                                                            Reject All
                                                        </Button>
                                                    </Stack>
                                                </Stack>
                                            </Box>

                                            {/* Selection Actions */}
                                            <Box sx={{ p: 1, bgcolor: isDarkMode ? alpha(theme.palette.info.main, 0.1) : alpha(theme.palette.info.main, 0.05), borderBottom: '1px solid', borderColor: 'divider' }}>
                                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                                    <Button size="small" startIcon={<SelectAllIcon />} onClick={handleSelectAllChanges}>
                                                        Select All
                                                    </Button>
                                                    <Button size="small" startIcon={<DeselectIcon />} onClick={handleDeselectAllChanges}>
                                                        Deselect All
                                                    </Button>
                                                    <Divider orientation="vertical" flexItem />
                                                    <Button
                                                        size="small"
                                                        color="success"
                                                        variant="outlined"
                                                        startIcon={<ApproveIcon />}
                                                        onClick={handleApproveSelected}
                                                        disabled={selectedChanges.size === 0 || loadingApproval}
                                                    >
                                                        Approve Selected ({selectedChanges.size})
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        color="error"
                                                        variant="outlined"
                                                        startIcon={<RejectIcon />}
                                                        onClick={handleRejectSelected}
                                                        disabled={selectedChanges.size === 0 || loadingApproval}
                                                    >
                                                        Reject Selected ({selectedChanges.size})
                                                    </Button>
                                                    {selectedChanges.size > 0 && (
                                                        <Button
                                                            size="small"
                                                            color="primary"
                                                            variant="contained"
                                                            onClick={() => handleFinalizeRequest('partial')}
                                                            disabled={loadingApproval}
                                                        >
                                                            Finalize Partial
                                                        </Button>
                                                    )}
                                                </Stack>
                                            </Box>

                                            {/* Changes Table */}
                                            <Box sx={{ flex: 1, overflow: 'auto' }}>
                                                {loadingApproval ? (
                                                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                                        <CircularProgress />
                                                    </Box>
                                                ) : (
                                                    <TableContainer>
                                                        <Table size="small" stickyHeader>
                                                            <TableHead>
                                                                <TableRow>
                                                                    <TableCell padding="checkbox" sx={{ bgcolor: isDarkMode ? '#334155' : 'grey.100' }}>
                                                                        <Checkbox
                                                                            indeterminate={selectedChanges.size > 0 && selectedChanges.size < requestDetails.filter(d => d.is_approved === null).length}
                                                                            checked={requestDetails.filter(d => d.is_approved === null).length > 0 && selectedChanges.size === requestDetails.filter(d => d.is_approved === null).length}
                                                                            onChange={(e) => e.target.checked ? handleSelectAllChanges() : handleDeselectAllChanges()}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell sx={{ fontWeight: 600, bgcolor: isDarkMode ? '#334155' : 'grey.100' }}>Permission</TableCell>
                                                                    <TableCell align="center" sx={{ fontWeight: 600, bgcolor: isDarkMode ? '#334155' : 'grey.100', width: 120 }}>Enable</TableCell>
                                                                    <TableCell align="center" sx={{ fontWeight: 600, bgcolor: isDarkMode ? '#334155' : 'grey.100', width: 120 }}>Visible</TableCell>
                                                                    <TableCell align="center" sx={{ fontWeight: 600, bgcolor: isDarkMode ? '#334155' : 'grey.100', width: 100 }}>Status</TableCell>
                                                                </TableRow>
                                                            </TableHead>
                                                            <TableBody>
                                                                {requestDetails.map(detail => (
                                                                    <TableRow
                                                                        key={detail.id}
                                                                        hover
                                                                        selected={selectedChanges.has(detail.id)}
                                                                        sx={{
                                                                            bgcolor: detail.is_approved === true
                                                                                ? alpha(theme.palette.success.main, 0.1)
                                                                                : detail.is_approved === false
                                                                                    ? alpha(theme.palette.error.main, 0.1)
                                                                                    : 'inherit'
                                                                        }}
                                                                    >
                                                                        <TableCell padding="checkbox">
                                                                            <Checkbox
                                                                                checked={selectedChanges.has(detail.id)}
                                                                                onChange={() => handleToggleChangeSelection(detail.id)}
                                                                                disabled={detail.is_approved !== null}
                                                                            />
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Typography fontWeight={500} fontSize="0.875rem">{detail.permission_name}</Typography>
                                                                            <Typography variant="caption" color="text.secondary">{detail.permission_code}</Typography>
                                                                        </TableCell>
                                                                        <TableCell align="center">
                                                                            <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                                                                                <Chip
                                                                                    label={detail.old_is_enabled ? 'ON' : 'OFF'}
                                                                                    size="small"
                                                                                    color={detail.old_is_enabled ? 'success' : 'default'}
                                                                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                                                                />
                                                                                <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                                                                <Chip
                                                                                    label={detail.new_is_enabled ? 'ON' : 'OFF'}
                                                                                    size="small"
                                                                                    color={detail.new_is_enabled ? 'success' : 'default'}
                                                                                    variant={detail.old_is_enabled !== detail.new_is_enabled ? 'filled' : 'outlined'}
                                                                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                                                                />
                                                                            </Stack>
                                                                        </TableCell>
                                                                        <TableCell align="center">
                                                                            <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                                                                                <Chip
                                                                                    label={detail.old_is_visible ? 'SHOW' : 'HIDE'}
                                                                                    size="small"
                                                                                    color={detail.old_is_visible ? 'info' : 'default'}
                                                                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                                                                />
                                                                                <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                                                                <Chip
                                                                                    label={detail.new_is_visible ? 'SHOW' : 'HIDE'}
                                                                                    size="small"
                                                                                    color={detail.new_is_visible ? 'info' : 'default'}
                                                                                    variant={detail.old_is_visible !== detail.new_is_visible ? 'filled' : 'outlined'}
                                                                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                                                                />
                                                                            </Stack>
                                                                        </TableCell>
                                                                        <TableCell align="center">
                                                                            {detail.is_approved === true && (
                                                                                <Chip label="Approved" color="success" size="small" icon={<CheckCircleIcon />} />
                                                                            )}
                                                                            {detail.is_approved === false && (
                                                                                <Chip label="Rejected" color="error" size="small" icon={<CancelIcon />} />
                                                                            )}
                                                                            {detail.is_approved === null && (
                                                                                <Chip label="Pending" color="warning" size="small" icon={<PendingIcon />} />
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </TableContainer>
                                                )}
                                            </Box>

                                            {/* Note Input */}
                                            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="Review Note (optional)"
                                                    placeholder="Add a note for the requester..."
                                                    value={approvalNote}
                                                    onChange={(e) => setApprovalNote(e.target.value)}
                                                    multiline
                                                    rows={2}
                                                />
                                            </Box>
                                        </>
                                    ) : (
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', color: 'text.secondary' }}>
                                            <NotificationsIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                                            <Typography>Select a request to review</Typography>
                                        </Box>
                                    )}
                                </Paper>
                            </Box>
                        </TabPanel>
                    )}

                    {/* TAB: My Requests - For all users */}
                    <TabPanel value={tabValue} index={TAB_MY_REQUESTS}>
                        <Box sx={{ height: 'calc(100vh - 220px)', overflow: 'auto' }}>
                            <Paper sx={{ p: 2 }}>
                                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                                    📋 My Permission Change Requests
                                </Typography>
                                {myRequests.length === 0 ? (
                                    <Alert severity="info">
                                        You haven't submitted any permission change requests yet.
                                    </Alert>
                                ) : (
                                    <TableContainer>
                                        <Table>
                                            <TableHead>
                                                <TableRow sx={{ bgcolor: isDarkMode ? '#334155' : 'grey.100' }}>
                                                    <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                                                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                                                    <TableCell sx={{ fontWeight: 600 }}>Target</TableCell>
                                                    <TableCell sx={{ fontWeight: 600 }}>Changes</TableCell>
                                                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                                    <TableCell sx={{ fontWeight: 600 }}>Submitted</TableCell>
                                                    <TableCell sx={{ fontWeight: 600 }}>Reviewed</TableCell>
                                                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {myRequests.map(req => (
                                                    <TableRow key={req.id} hover>
                                                        <TableCell>#{req.id}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={req.request_type === 'role' ? 'Role' : 'User Override'}
                                                                size="small"
                                                                color={req.request_type === 'role' ? 'primary' : 'secondary'}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            {req.request_type === 'role' ? req.role_name : (req.target_full_name || req.target_username)}
                                                        </TableCell>
                                                        <TableCell>{req.total_changes}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={req.status}
                                                                size="small"
                                                                color={
                                                                    req.status === 'approved' ? 'success' :
                                                                        req.status === 'rejected' ? 'error' :
                                                                            req.status === 'partially_approved' ? 'warning' :
                                                                                'default'
                                                                }
                                                                icon={
                                                                    req.status === 'approved' ? <CheckCircleIcon /> :
                                                                        req.status === 'rejected' ? <CancelIcon /> :
                                                                            req.status === 'pending' ? <PendingIcon /> :
                                                                                undefined
                                                                }
                                                            />
                                                        </TableCell>
                                                        <TableCell>{new Date(req.created_at).toLocaleString()}</TableCell>
                                                        <TableCell>
                                                            {req.reviewed_at ? (
                                                                <Stack>
                                                                    <Typography variant="caption">{new Date(req.reviewed_at).toLocaleString()}</Typography>
                                                                    <Typography variant="caption" color="text.secondary">by {req.reviewer_username}</Typography>
                                                                </Stack>
                                                            ) : '-'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {req.status === 'pending' && (
                                                                <Button
                                                                    size="small"
                                                                    color="error"
                                                                    startIcon={<CancelIcon />}
                                                                    onClick={() => handleCancelRequest(req.id)}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                            )}
                                                            {req.review_note && (
                                                                <Tooltip title={req.review_note}>
                                                                    <IconButton size="small">
                                                                        <AssignmentIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </Paper>
                        </Box>
                    </TabPanel>

                    {/* TAB: User Overrides - For users with tab:user-overrides permission */}
                    {canSeeUserOverrides && (
                        <TabPanel value={tabValue} index={TAB_USER_OVERRIDES}>
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
                                                {!isSuperAdmin && (
                                                    <Chip
                                                        label="Needs Super Admin Approval"
                                                        color="warning"
                                                        size="small"
                                                        icon={<PendingIcon />}
                                                        sx={{ mr: 1 }}
                                                    />
                                                )}
                                                <Button
                                                    variant="contained"
                                                    color={isSuperAdmin ? "primary" : "warning"}
                                                    startIcon={saving ? <CircularProgress size={14} color="inherit" /> : (isSuperAdmin ? <SaveIcon sx={{ fontSize: { xs: 16, sm: 20 } }} /> : <SendIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />)}
                                                    onClick={handleSaveUserOverrides}
                                                    disabled={saving}
                                                    size="small"
                                                    sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, px: { xs: 1, sm: 2 }, flexShrink: 0 }}
                                                >
                                                    {saving
                                                        ? (isSuperAdmin ? 'Saving...' : 'Submitting...')
                                                        : (isSuperAdmin
                                                            ? (isSmall ? 'Save' : 'Save Overrides')
                                                            : (isSmall ? 'Submit' : 'Submit for Approval')
                                                        )
                                                    }
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

                    {/* TAB: Warehouse Access - For users with tab:warehouse-access permission */}
                    {canSeeWarehouseAccess && (
                        <TabPanel value={tabValue} index={TAB_WAREHOUSE_ACCESS}>
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
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    {!isSuperAdmin && (
                                                        <Chip
                                                            label="Super Admin Only"
                                                            color="warning"
                                                            size="small"
                                                            icon={<LockIcon />}
                                                        />
                                                    )}
                                                    <Button
                                                        variant="contained"
                                                        startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />}
                                                        onClick={handleSaveUserWarehouses}
                                                        disabled={saving || !isSuperAdmin}
                                                        size="small"
                                                        sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, px: { xs: 1, sm: 2 } }}
                                                    >
                                                        {saving ? 'Saving...' : 'Save'}
                                                    </Button>
                                                </Stack>
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
