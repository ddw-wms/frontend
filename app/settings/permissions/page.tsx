// File Path = warehouse-frontend\app\settings\permissions\page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Checkbox, Button, AppBar, Toolbar,
  Card, CardContent, Stack, Chip, Alert, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails, Collapse, TextField, InputAdornment,
  useTheme, useMediaQuery
} from '@mui/material';
import {
  Save as SaveIcon, RestartAlt as ResetIcon, CheckCircle as CheckIcon,
  ExpandMore as ExpandMoreIcon, Search as SearchIcon, Refresh as RefreshIcon,
  Warning as WarningIcon, Lock as LockIcon
} from '@mui/icons-material';
import AppLayout from '@/components/AppLayout';
import { useWarehouse } from '@/app/context/WarehouseContext';
import toast, { Toaster } from 'react-hot-toast';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { permissionsAPI } from '@/lib/permissions';
import { getStoredUser } from '@/lib/auth';

// Comprehensive grouped permissions - ALL modules
const PERMISSION_GROUPS: any = {
  '📊 Dashboard': [
    { key: 'view_dashboard', label: 'View Dashboard', description: 'Access main dashboard' },
    { key: 'view_dashboard_stats', label: 'View Stats', description: 'See statistics' },
    { key: 'export_dashboard', label: 'Export Data', description: 'Export dashboard data' },
    { key: 'view_inventory_details', label: 'Inventory Details', description: 'View inventory info' },
    { key: 'filter_dashboard', label: 'Filter', description: 'Use dashboard filters' },
    { key: 'refresh_dashboard', label: 'Refresh', description: 'Refresh dashboard data' },
    { key: 'view_recent_activities', label: 'Recent Activities', description: 'View recent actions' },
    { key: 'print_dashboard_label', label: 'Print Labels', description: 'Print from dashboard' }
  ],
  '📥 Inbound Operations': [
    { key: 'view_inbound', label: 'View Inbound', description: 'Access inbound page' },
    { key: 'create_inbound_single', label: 'Single Entry', description: 'Add single inbound' },
    { key: 'upload_inbound_bulk', label: 'Bulk Upload', description: 'Upload bulk inbound' },
    { key: 'create_inbound_multi', label: 'Multi Entry', description: 'Multi-row inbound entry' },
    { key: 'view_inbound_list', label: 'View List', description: 'View inbound records' },
    { key: 'export_inbound', label: 'Export', description: 'Export inbound data' },
    { key: 'delete_inbound', label: 'Delete', description: 'Delete inbound records' },
    { key: 'refresh_inbound', label: 'Refresh', description: 'Refresh inbound data' },
    { key: 'print_inbound_label', label: 'Print Labels', description: 'Print inbound labels' },
    { key: 'inbound_column_settings', label: 'Column Settings', description: 'Customize columns' },
    { key: 'filter_inbound', label: 'Filter', description: 'Filter inbound records' },
    { key: 'paginate_inbound', label: 'Pagination', description: 'Navigate pages' },
    { key: 'download_inbound_template', label: 'Download Template', description: 'Get Excel template' },
    { key: 'view_inbound_master_columns', label: 'Master Columns', description: 'View master data columns' }
  ],
  '✅ Quality Control (QC)': [
    { key: 'view_qc', label: 'View QC', description: 'Access QC page' },
    { key: 'create_qc_single', label: 'Single Entry', description: 'Add single QC' },
    { key: 'create_qc_multi', label: 'Multi Entry', description: 'Multi-row QC entry' },
    { key: 'upload_qc_bulk', label: 'Bulk Upload', description: 'Upload bulk QC' },
    { key: 'edit_qc', label: 'Edit QC', description: 'Modify QC records' },
    { key: 'delete_qc', label: 'Delete QC', description: 'Delete QC records' },
    { key: 'approve_qc', label: 'Approve QC', description: 'Approve/reject items' },
    { key: 'view_qc_list', label: 'View List', description: 'View QC records' },
    { key: 'export_qc', label: 'Export', description: 'Export QC data' },
    { key: 'refresh_qc', label: 'Refresh', description: 'Refresh QC data' },
    { key: 'qc_column_settings', label: 'Column Settings', description: 'Customize columns' },
    { key: 'filter_qc', label: 'Filter', description: 'Filter QC records' },
    { key: 'view_qc_stats', label: 'View Stats', description: 'View QC statistics' },
    { key: 'download_qc_template', label: 'Download Template', description: 'Get Excel template' },
    { key: 'change_qc_grade', label: 'Change Grade', description: 'Change QC grade' },
    { key: 'view_qc_history', label: 'View History', description: 'View QC history' }
  ],
  '📦 Picking Operations': [
    { key: 'view_picking', label: 'View Picking', description: 'Access picking page' },
    { key: 'create_picking_multi', label: 'Create Picking', description: 'Create picking lists' },
    { key: 'complete_picking', label: 'Complete Picking', description: 'Mark as picked' },
    { key: 'view_picking_list', label: 'View List', description: 'View picking records' },
    { key: 'export_picking', label: 'Export', description: 'Export picking data' },
    { key: 'delete_picking', label: 'Delete', description: 'Delete picking records' },
    { key: 'refresh_picking', label: 'Refresh', description: 'Refresh picking data' },
    { key: 'picking_column_settings', label: 'Column Settings', description: 'Customize columns' },
    { key: 'filter_picking', label: 'Filter', description: 'Filter picking records' },
    { key: 'select_picking_customer', label: 'Select Customer', description: 'Choose customer for picking' },
    { key: 'view_picking_details', label: 'View Details', description: 'View detailed info' },
    { key: 'edit_picking', label: 'Edit Picking', description: 'Modify picking records' },
    { key: 'download_picking_template', label: 'Download Template', description: 'Get Excel template' }
  ],
  '📤 Outbound Operations': [
    { key: 'view_outbound', label: 'View Outbound', description: 'Access outbound page' },
    { key: 'create_outbound_multi', label: 'Create Outbound', description: 'Create dispatch records' },
    { key: 'upload_outbound_bulk', label: 'Bulk Upload', description: 'Upload bulk outbound' },
    { key: 'view_outbound_list', label: 'View List', description: 'View outbound records' },
    { key: 'export_outbound', label: 'Export', description: 'Export outbound data' },
    { key: 'delete_outbound', label: 'Delete', description: 'Delete outbound records' },
    { key: 'refresh_outbound', label: 'Refresh', description: 'Refresh outbound data' },
    { key: 'outbound_column_settings', label: 'Column Settings', description: 'Customize columns' },
    { key: 'filter_outbound', label: 'Filter', description: 'Filter outbound records' },
    { key: 'select_outbound_customer', label: 'Select Customer', description: 'Choose customer' },
    { key: 'view_outbound_stats', label: 'View Stats', description: 'View statistics' },
    { key: 'download_outbound_template', label: 'Download Template', description: 'Get Excel template' },
    { key: 'edit_outbound', label: 'Edit Outbound', description: 'Modify outbound records' },
    { key: 'view_outbound_details', label: 'View Details', description: 'View detailed info' }
  ],
  '👥 Customers': [
    { key: 'view_customers', label: 'View Customers', description: 'Access customers page' },
    { key: 'create_customer', label: 'Create Customer', description: 'Add new customer' },
    { key: 'edit_customer', label: 'Edit Customer', description: 'Modify customer info' },
    { key: 'delete_customer', label: 'Delete Customer', description: 'Remove customer' },
    { key: 'view_customer_details', label: 'View Details', description: 'View customer details' }
  ],
  '📋 Master Data': [
    { key: 'view_master_data', label: 'View Master Data', description: 'Access master data page' },
    { key: 'upload_master_data', label: 'Upload', description: 'Upload master data' },
    { key: 'export_master_data', label: 'Export', description: 'Export master data' },
    { key: 'delete_master_data', label: 'Delete', description: 'Delete master data records' },
    { key: 'refresh_master_data', label: 'Refresh', description: 'Refresh data' },
    { key: 'master_data_column_settings', label: 'Column Settings', description: 'Customize columns' },
    { key: 'filter_master_data', label: 'Filter', description: 'Filter records' },
    { key: 'download_master_data_template', label: 'Download Template', description: 'Get Excel template' },
    { key: 'view_master_data_stats', label: 'View Stats', description: 'View statistics' },
    { key: 'edit_master_data', label: 'Edit', description: 'Modify master data' },
    { key: 'bulk_delete_master_data', label: 'Bulk Delete', description: 'Delete multiple records' }
  ],
  '👤 Users Management': [
    { key: 'view_users', label: 'View Users', description: 'Access users page' },
    { key: 'create_user', label: 'Create User', description: 'Add new user' },
    { key: 'edit_user', label: 'Edit User', description: 'Modify user info' },
    { key: 'delete_user', label: 'Delete User', description: 'Remove user' },
    { key: 'toggle_user_status', label: 'Toggle Status', description: 'Activate/deactivate user' }
  ],
  '🏭 Warehouses': [
    { key: 'view_warehouses', label: 'View Warehouses', description: 'Access warehouses page' },
    { key: 'create_warehouse', label: 'Create Warehouse', description: 'Add new warehouse' },
    { key: 'edit_warehouse', label: 'Edit Warehouse', description: 'Modify warehouse info' },
    { key: 'delete_warehouse', label: 'Delete Warehouse', description: 'Remove warehouse' },
    { key: 'set_active_warehouse', label: 'Set Active', description: 'Set active warehouse' },
    { key: 'view_warehouse_details', label: 'View Details', description: 'View warehouse details' }
  ],
  '📁 Racks': [
    { key: 'view_racks', label: 'View Racks', description: 'Access racks page' },
    { key: 'create_rack', label: 'Create Rack', description: 'Add new rack' },
    { key: 'edit_rack', label: 'Edit Rack', description: 'Modify rack info' },
    { key: 'delete_rack', label: 'Delete Rack', description: 'Remove rack' },
    { key: 'toggle_rack_status', label: 'Toggle Status', description: 'Activate/deactivate rack' },
    { key: 'upload_racks_bulk', label: 'Bulk Upload', description: 'Upload multiple racks' },
    { key: 'download_racks_template', label: 'Download Template', description: 'Get Excel template' }
  ],
  '🖨️ Printers': [
    { key: 'view_printers', label: 'View Printers', description: 'Access printer settings' },
    { key: 'save_printer_settings', label: 'Save Settings', description: 'Save printer config' },
    { key: 'test_print', label: 'Test Print', description: 'Test printer' },
    { key: 'refresh_printers', label: 'Refresh', description: 'Refresh printer list' },
    { key: 'restart_print_agent', label: 'Restart Agent', description: 'Restart print service' },
    { key: 'view_printer_status', label: 'View Status', description: 'Check printer status' },
    { key: 'change_printer_settings', label: 'Change Settings', description: 'Modify printer settings' },
    { key: 'view_print_history', label: 'View History', description: 'View print history' },
    { key: 'reset_printer_settings', label: 'Reset Settings', description: 'Reset to defaults' }
  ],
  '🔒 Permissions': [
    { key: 'view_permissions', label: 'View Permissions', description: 'Access permissions page' },
    { key: 'edit_permissions', label: 'Edit Permissions', description: 'Modify permissions' },
    { key: 'save_permissions', label: 'Save Permissions', description: 'Save permission changes' },
    { key: 'reset_permissions', label: 'Reset Permissions', description: 'Reset to defaults' }
  ],
  '📈 Reports': [
    { key: 'view_reports', label: 'View Reports', description: 'Access reports page' },
    { key: 'generate_reports', label: 'Generate Reports', description: 'Create reports' },
    { key: 'export_reports', label: 'Export Reports', description: 'Export report data' },
    { key: 'schedule_reports', label: 'Schedule Reports', description: 'Schedule automated reports' },
    { key: 'view_report_history', label: 'View History', description: 'View report history' }
  ]
};

const ROLES = ['admin', 'manager', 'operator', 'qc', 'picker'];

const ROLE_COLORS: any = {
  admin: '#ef5350',
  manager: '#ffa726',
  operator: '#42a5f5',
  qc: '#66bb6a',
  picker: '#ab47bc'
};

const ROLE_ICONS: any = {
  admin: '🔴',
  manager: '🟡',
  operator: '🔵',
  qc: '🟢',
  picker: '🟣'
};

// Lightweight relative time helper for last-refreshed display
const getRelativeTime = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return dateStr;
  } catch {
    return dateStr;
  }
};

export default function PermissionsPage() {
  useRoleGuard(['admin']);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [permissions, setPermissions] = useState<any>({});
  const [originalPermissions, setOriginalPermissions] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const { activeWarehouse, setActiveWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
  }, []);


  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async (opts: { showGlobalLoading?: boolean } = { showGlobalLoading: true }) => {
    const { showGlobalLoading } = opts;
    if (showGlobalLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const response = await permissionsAPI.getAll();
      const permissionsMap: any = {};

      // Check if response.data is an array
      const dataArray = Array.isArray(response.data) ? response.data : [];

      if (dataArray.length === 0) {
        // If this was the initial/global load, clear state; if a refresh, keep existing state to avoid blink
        if (showGlobalLoading) {
          setPermissions({});
          setOriginalPermissions({});
          toast.error('No permissions found. Please run database migration.');
        } else {
          toast.error('No permissions found. Please run database migration.');
        }
        return;
      }

      dataArray.forEach((p: any) => {
        if (!permissionsMap[p.permission_key]) {
          permissionsMap[p.permission_key] = {};
        }
        permissionsMap[p.permission_key][p.role] = p.enabled;
      });

      setPermissions(permissionsMap);
      setOriginalPermissions(JSON.parse(JSON.stringify(permissionsMap)));

      // If this was a button refresh (non-global), show inline success
      if (!showGlobalLoading) {
        toast.success('✓ Refreshed');
        setRefreshSuccess(true);
        setTimeout(() => setRefreshSuccess(false), 1800);
      }
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401) {
        toast.error('Not authenticated — redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else if (status === 403) {
        toast.error('Access denied: you do not have permissions to view this page');
      } else {
        toast.error(error.response?.data?.error || 'Failed to load permissions');
      }
      console.error('Load permissions error:', error);
    } finally {
      if (showGlobalLoading) setLoading(false);
      else setRefreshing(false);
    }
  };

  const handleToggle = (permissionKey: string, role: string) => {
    setPermissions((prev: any) => {
      const updated = { ...prev };
      if (!updated[permissionKey]) {
        updated[permissionKey] = {};
      }
      updated[permissionKey][role] = !updated[permissionKey][role];
      return updated;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const permissionsArray = Object.entries(permissions).flatMap(([key, roles]: any) =>
        Object.entries(roles).map(([role, enabled]) => ({
          role,
          permission_key: key,
          enabled
        }))
      );

      await permissionsAPI.saveAll(permissionsArray);
      toast.success('✓ Permissions saved successfully');
      setHasChanges(false);
      setOriginalPermissions(JSON.parse(JSON.stringify(permissions)));
    } catch (error) {
      toast.error('Failed to save permissions');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all changes? This will discard unsaved modifications.')) {
      setPermissions(JSON.parse(JSON.stringify(originalPermissions)));
      setHasChanges(false);
      toast.success('Changes discarded');
    }
  };

  const handleToggleAll = (role: string, enabled: boolean) => {
    const updatedPermissions = { ...permissions };
    Object.keys(PERMISSION_GROUPS).forEach(module => {
      PERMISSION_GROUPS[module].forEach((perm: any) => {
        if (!updatedPermissions[perm.key]) {
          updatedPermissions[perm.key] = {};
        }
        updatedPermissions[perm.key][role] = enabled;
      });
    });
    setPermissions(updatedPermissions);
    setHasChanges(true);
    toast.success(`All permissions ${enabled ? 'enabled' : 'disabled'} for ${role}`);
  };

  const toggleModuleExpansion = (module: string) => {
    setExpandedModules(prev =>
      prev.includes(module) ? prev.filter(m => m !== module) : [...prev, module]
    );
  };

  const handleToggleModuleAll = (module: string, enabled: boolean) => {
    const updated = { ...permissions };
    PERMISSION_GROUPS[module].forEach((perm: any) => {
      if (!updated[perm.key]) updated[perm.key] = {};
      ROLES.forEach(role => {
        updated[perm.key][role] = enabled;
      });
    });
    setPermissions(updated);
    setHasChanges(true);
    toast.success(`All permissions ${enabled ? 'enabled' : 'disabled'} for module ${module}`);
  };

  const expandAll = () => {
    setExpandedModules(Object.keys(PERMISSION_GROUPS));
  };

  const collapseAll = () => {
    setExpandedModules([]);
  };

  const getRoleStats = (role: string) => {
    let enabled = 0;
    let total = 0;
    Object.keys(PERMISSION_GROUPS).forEach(module => {
      PERMISSION_GROUPS[module].forEach((perm: any) => {
        total++;
        if (permissions[perm.key]?.[role]) {
          enabled++;
        }
      });
    });
    return { enabled, total, percentage: total > 0 ? Math.round((enabled / total) * 100) : 0 };
  };

  const filteredGroups = Object.keys(PERMISSION_GROUPS).reduce((acc: any, module) => {
    const filtered = PERMISSION_GROUPS[module].filter((perm: any) =>
      perm.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      perm.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[module] = filtered;
    }
    return acc;
  }, {});

  if (loading) {
    return (
      <AppLayout>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <Stack alignItems="center" spacing={2}>
            <CircularProgress size={50} />
            <Typography color="text.secondary">Loading permissions...</Typography>
          </Stack>
        </Box>
      </AppLayout>
    );
  }

  /////////////////////////////////////// UI RENDERING ///////////////////////////////////////
  return (
    <AppLayout>
      <Toaster position="top-right" />
      <Box sx={{
        p: { xs: 0.75, md: 1 },
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>

        {/* ==================== HEADER SECTION ==================== */}
        <Box sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          mb: 1,
          p: { xs: 1, sm: 1.25 },
          background: 'linear-gradient(  135deg, #0f2027 0%, #203a43 50%, #2c5364 100%  )',
          borderRadius: 1.5,
          boxShadow: '0 8px 30px rgba(102, 126, 234, 0.25)',
        }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: { xs: 0.75, sm: 1 }
          }}>
            {/* LEFT: Icon + Title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1.25 } }}>
              <Box sx={{
                p: { xs: 0.4, sm: 0.7 },
                bgcolor: 'rgba(255,255,255,0.2)',
                borderRadius: 1.5,
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Typography sx={{ fontSize: { xs: '1rem', sm: '1.5rem' }, lineHeight: 1 }}>🔑</Typography>
              </Box>
              <Box>
                <Typography variant="h4" sx={{
                  fontWeight: 650,
                  color: 'white',
                  fontSize: { xs: '0.85rem', sm: '1rem', md: '1.3rem' },
                  lineHeight: 1.1,
                  textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  User Permissions Management
                </Typography>
                <Typography variant="caption" sx={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: { xs: isMobile ? '0.5rem' : '0.2rem', sm: '0.7rem' },
                  fontWeight: 500,
                  lineHeight: 1.2,
                  display: 'block',
                  mt: 0.25
                }}>
                  Manage users permissions
                </Typography>
              </Box>
            </Box>

            {/* RIGHT: Warehouse + User Chips */}
            <Stack direction="row" spacing={{ xs: 0.5, sm: 0.75 }} alignItems="center">
              <Chip
                label={activeWarehouse?.name || '—'}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 700,
                  height: { xs: 20, sm: 24 },
                  fontSize: { xs: isMobile ? '0.42rem' : '0.2rem', sm: '0.72rem' },
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  '& .MuiChip-label': { px: { xs: 0.75, sm: 1 } }
                }}
              />
              <Chip
                label={user?.full_name}
                size="small"
                avatar={<Box sx={{
                  bgcolor: 'rgba(255,255,255,0.3)',
                  width: { xs: 14, sm: 16 },
                  height: { xs: 14, sm: 16 },
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: { xs: '0.55rem', sm: '0.6rem' }
                }}>👤</Box>}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 600,
                  height: { xs: 20, sm: 24 },
                  fontSize: { xs: '0.62rem', sm: '0.72rem' },
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  '& .MuiChip-label': { px: { xs: 0.75, sm: 1 } },
                  '& .MuiChip-avatar': {
                    width: { xs: 14, sm: 16 },
                    height: { xs: 14, sm: 16 },
                    ml: { xs: 0.5, sm: 0.75 }
                  }
                }}
              />
            </Stack>
          </Box>
        </Box>

        {/* Fixed Header Section */}
        <Box sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          bgcolor: 'background.default',
          borderBottom: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {/* Top Bar with Title and Actions */}
          <Collapse in={hasChanges} timeout={240}>
            <Box sx={{
              bgcolor: 'primary.main',
              color: 'white',
              px: { xs: 1.5, sm: 3 },
              py: { xs: 0.35, sm: 1.2 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: { xs: 1, sm: 0 },
              transition: 'height 200ms ease, padding 200ms ease'
            }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <LockIcon fontSize={isMobile ? 'small' : 'medium'} />
                <Typography variant="h6" fontWeight="600" sx={{ fontSize: { xs: '0.82rem', sm: '1rem' } }}>
                  Permissions Management
                </Typography>
                <Chip
                  label={`${Object.keys(permissions).length} Permissions`}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontSize: { xs: '0.62rem', sm: '0.78rem' }, height: { xs: 20, sm: 24 } }}
                />
              </Stack>

              <Stack direction="row" spacing={1}>
                {hasChanges && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ResetIcon />}
                    onClick={handleReset}
                    aria-label="Discard changes"
                    sx={{
                      borderColor: 'white',
                      color: 'white',
                      px: { xs: 0.5, sm: 1.2 },
                      py: { xs: 0.25, sm: 0.5 },
                      minWidth: { xs: 34, sm: 'auto' },
                      fontSize: { xs: '0.62rem', sm: '0.85rem' },
                      '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
                    }}
                  >
                    {isMobile ? null : 'Discard'}
                  </Button>
                )}
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  aria-label="Save changes"
                  sx={{
                    bgcolor: 'white',
                    color: 'primary.main',
                    px: { xs: 0.6, sm: 1.2 },
                    py: { xs: 0.25, sm: 0.5 },
                    minWidth: { xs: 34, sm: 'auto' },
                    fontSize: { xs: '0.62rem', sm: '0.85rem' },
                    '&:hover': { bgcolor: 'grey.100' },
                    '&:disabled': { bgcolor: 'grey.300' }
                  }}
                >
                  {saving
                    ? (isMobile ? <CircularProgress size={12} color="inherit" /> : 'Saving...')
                    : (isMobile ? null : 'Save Changes')}
                </Button>
              </Stack>
            </Box>
          </Collapse>

          {/* Compact Role Summary Cards */}
          <Box sx={{
            bgcolor: 'grey.50',
            px: { xs: 1.5, sm: 3 },
            py: { xs: 0.5, sm: 1 },
            display: 'flex',
            gap: { xs: 1, sm: 1.5 },
            overflowX: 'auto',
            '&::-webkit-scrollbar': { height: 6 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.400', borderRadius: 3 }
          }}>
            {ROLES.map(role => {
              const stats = getRoleStats(role);
              return (
                <Card
                  key={role}
                  sx={{
                    minWidth: { xs: 120, sm: 180 },
                    borderTop: `3px solid ${ROLE_COLORS[role]}`,
                    boxShadow: 1
                  }}
                >
                  {/* Desktop / tablet view */}
                  <CardContent sx={{ display: { xs: 'none', sm: 'block' }, p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                    <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                      <Typography fontSize="1.2rem">{ROLE_ICONS[role]}</Typography>
                      <Typography variant="subtitle2" fontWeight="700" textTransform="capitalize">
                        {role}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="baseline">
                      <Typography variant="h5" fontWeight="700" color={ROLE_COLORS[role]}>
                        {stats.percentage}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {stats.enabled}/{stats.total}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} mt={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleToggleAll(role, true)}
                        sx={{
                          fontSize: '0.7rem',
                          py: 0.25,
                          minWidth: 'auto',
                          flex: 1,
                          borderColor: ROLE_COLORS[role],
                          color: ROLE_COLORS[role]
                        }}
                      >
                        All
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => handleToggleAll(role, false)}
                        sx={{
                          fontSize: '0.7rem',
                          py: 0.25,
                          minWidth: 'auto',
                          flex: 1
                        }}
                      >
                        None
                      </Button>
                    </Stack>
                  </CardContent>

                  {/* Compact mobile view */}
                  <CardContent sx={{ display: { xs: 'flex', sm: 'none' }, alignItems: 'center', justifyContent: 'space-between', p: { xs: 0.5 } }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography fontSize="1rem">{ROLE_ICONS[role]}</Typography>
                      <Typography variant="subtitle2" fontWeight="700" sx={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>
                        {role}
                      </Typography>
                    </Stack>
                    <Typography variant="subtitle2" fontWeight="700" color={ROLE_COLORS[role]} sx={{ fontSize: '0.9rem' }}>
                      {stats.percentage}%
                    </Typography>
                  </CardContent>
                </Card>
              );
            })}
          </Box>

          {/* Search and Controls Bar */}
          <Box sx={{
            bgcolor: 'white',
            px: { xs: 1.5, sm: 3 },
            py: { xs: 0.6, sm: 1.5 },
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'nowrap', overflowX: 'auto', gap: { xs: 0.75, sm: 1.5 }, '& > *': { flexShrink: 0 } }}>
              <TextField
                placeholder="Search permissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                sx={{ flex: '1 1 auto', minWidth: { xs: 140, sm: 220 }, maxWidth: { sm: 500 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={expandAll}
              >
                Expand All
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={collapseAll}
              >
                Collapse All
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={refreshing ? <CircularProgress size={14} /> : refreshSuccess ? <CheckIcon sx={{ color: '#10b981' }} /> : <RefreshIcon />}
                onClick={() => loadPermissions({ showGlobalLoading: false })}
                disabled={refreshing}
              >
                {refreshing ? 'Refreshing...' : refreshSuccess ? 'Refreshed' : 'Refresh'}
              </Button>


            </Stack>

            {hasChanges && (
              <Alert
                severity="warning"
                icon={<WarningIcon />}
                sx={{ mt: 1.5, py: 0.5 }}
              >
                Unsaved changes detected
              </Alert>
            )}
          </Box>
        </Box>

        {/* Scrollable Content */}
        <Box sx={{ p: 2 }}>
          {/* Permissions Matrix by Module */}
          {Object.entries(filteredGroups).map(([module, perms]: any) => {
            const isExpanded = expandedModules.includes(module);
            return (
              <Paper
                key={module}
                elevation={2}
                sx={{
                  mb: 1,
                  overflow: 'hidden',
                  border: isExpanded ? '2px solid' : '1px solid',
                  borderColor: isExpanded ? 'primary.main' : 'divider'
                }}
              >
                {/* Fixed Header */}
                <Box
                  onClick={() => toggleModuleExpansion(module)}
                  sx={{
                    bgcolor: 'grey.50',
                    px: 2,
                    py: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    borderBottom: isExpanded ? '2px solid' : 'none',
                    borderColor: 'primary.main',
                    '&:hover': {
                      bgcolor: 'grey.100'
                    }
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" fontWeight="700">
                      {module}
                    </Typography>
                    <Chip
                      label={perms.length}
                      size="small"
                      color="primary"
                      sx={{ height: 20, fontSize: '0.75rem' }}
                    />
                  </Stack>
                  <ExpandMoreIcon
                    sx={{
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.3s'
                    }}
                  />
                </Box>

                {/* Scrollable Content */}
                {isExpanded && (
                  <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{
                            fontWeight: '700',
                            width: '25%',
                            py: 1,
                            bgcolor: 'grey.200',
                            position: 'sticky',
                            top: 0,
                            zIndex: 10
                          }}>Permission</TableCell>
                          <TableCell sx={{
                            fontWeight: '700',
                            width: '35%',
                            py: 1,
                            bgcolor: 'grey.200',
                            position: 'sticky',
                            top: 0,
                            zIndex: 10
                          }}>Description</TableCell>
                          {ROLES.map(role => (
                            <TableCell
                              key={role}
                              align="center"
                              sx={{
                                fontWeight: '700',
                                color: ROLE_COLORS[role],
                                py: 1,
                                fontSize: '0.75rem',
                                bgcolor: 'grey.200',
                                position: 'sticky',
                                top: 0,
                                zIndex: 10
                              }}
                            >
                              <Stack alignItems="center" spacing={0.25}>
                                <Typography fontSize="1rem">{ROLE_ICONS[role]}</Typography>
                                <Typography fontSize="0.7rem" textTransform="capitalize">
                                  {role}
                                </Typography>
                              </Stack>
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {perms.map((perm: any, idx: number) => (
                          <TableRow
                            key={perm.key}
                            hover
                            sx={{
                              '&:nth-of-type(odd)': { bgcolor: 'grey.50' },
                              '&:hover': { bgcolor: 'action.hover' }
                            }}
                          >
                            <TableCell sx={{ py: 0.75 }}>
                              <Typography variant="body2" fontWeight="600" fontSize="0.85rem">
                                {perm.label}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 0.75 }}>
                              <Typography variant="body2" color="text.secondary" fontSize="0.8rem">
                                {perm.description}
                              </Typography>
                            </TableCell>
                            {ROLES.map(role => (
                              <TableCell key={role} align="center" sx={{ py: 0.5 }}>
                                <Checkbox
                                  size="small"
                                  checked={permissions[perm.key]?.[role] || false}
                                  onChange={() => handleToggle(perm.key, role)}
                                  sx={{
                                    color: ROLE_COLORS[role],
                                    '&.Mui-checked': {
                                      color: ROLE_COLORS[role]
                                    },
                                    p: 0.5
                                  }}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </Paper>
            );
          })}

          {Object.keys(filteredGroups).length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No permissions found matching "{searchQuery}"
            </Alert>
          )}
        </Box>
      </Box>
    </AppLayout >
  );
}
