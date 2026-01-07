// File Path = warehouse-frontend\components\Sidebar.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
  Typography,
  Box,
  IconButton,
  Paper,
  Tooltip,
  iconButtonClasses,
  Snackbar,
  Alert,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { ExpandLess, ExpandMore, Close as CloseIcon, Label } from '@mui/icons-material';

import {
  Dashboard as DashboardIcon,
  Inventory as InventoryIcon,
  CheckCircle as CheckIcon,
  LocalShipping as ShippingIcon,
  Assignment as AssignmentIcon,
  Settings as SettingsIcon,
  Storage as StorageIcon,
  Warehouse as WarehouseIcon,
  Person as PersonIcon,
  Category as CategoryIcon,
  LocalPrintshop as PrinterIcon,
  Menu as MenuIcon,
  Assessment as ReportsIcon,
} from '@mui/icons-material';
import path from 'path';
import { Group as GroupIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { getStoredUser, logout } from '@/lib/auth';
import { fetchUserPermissions } from '@/lib/permissions';
import { usePermissions } from '@/app/context/PermissionsContext';

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen = false, setMobileOpen }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string>('');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // Use PermissionsContext instead of local state
  const { permissions: userPermissions, loading: permissionsLoading, hasPermission } = usePermissions();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  // --------------------------------------
  // MOBILE DETECTION (SCREEN WIDTH)
  // --------------------------------------
  const [isMobile, setIsMobile] = useState(false);

  const checkMobile = useCallback(() => {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth;
      setIsMobile(width < 900);
    }
  }, []);

  useEffect(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);
    // Get user role
    const user = getStoredUser();
    if (user) {
      console.log('🔐 Sidebar - User:', user.username, '| Role:', user.role);
      setUserRole(user.role || '');
    } else {
      console.log('⚠️ No user found in storage');
    }

    // Register global notification function
    (window as any).showPermissionNotification = (message: string) => {
      setNotificationMessage(message);
      setShowNotification(true);
    };

    return () => {
      window.removeEventListener('resize', checkMobile);
      delete (window as any).showPermissionNotification;
    };
  }, [checkMobile]);

  const [settingsOpen, setSettingsOpen] = useState(() =>
    pathname.startsWith('/settings')
  );

  const [flyoutVisible, setFlyoutVisible] = useState(false);
  const [settingsHovered, setSettingsHovered] = useState(false);
  const [flyoutHovered, setFlyoutHovered] = useState(false);

  useEffect(() => {
    if (collapsed) {
      setFlyoutVisible(settingsHovered || flyoutHovered);
    } else {
      setFlyoutVisible(false);
    }
  }, [collapsed, settingsHovered, flyoutHovered]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar-collapsed', collapsed.toString());
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen?.(false);
  }, [pathname, setMobileOpen]);

  const drawerWidth = collapsed ? 70 : 230;

  // Filter menu items based on user permissions - memoized to prevent flickering
  const mainMenu = useMemo(() => {
    const allItems = [
      { label: 'Dashboard', icon: DashboardIcon, path: '/dashboard', permission: 'view_dashboard' },
      { label: 'Inbound', icon: InventoryIcon, path: '/inbound', permission: 'view_inbound' },
      { label: 'Processing', icon: CheckIcon, path: '/qc', permission: 'view_qc' },
      { label: 'Picking', icon: AssignmentIcon, path: '/picking', permission: 'view_picking' },
      { label: 'Outbound', icon: ShippingIcon, path: '/outbound', permission: 'view_outbound' },
      { label: 'Customers', icon: GroupIcon, path: '/customers', permission: 'view_customers' },
      { label: 'Reports', icon: ReportsIcon, path: '/reports', permission: 'view_reports' }
    ];

    // Admin sees all
    if (userRole === 'admin') {
      return allItems;
    }

    // Don't show any menu items while permissions are loading
    if (permissionsLoading || !userPermissions) {
      return [];
    }

    // Filter based on permissions - use the actual permission values from context
    const filtered = allItems.filter(item => {
      const hasPerm = userPermissions[item.permission] === true;
      return hasPerm;
    });

    return filtered;
  }, [userRole, permissionsLoading, userPermissions]);

  const settingsMenu = useMemo(() => {
    const allSettings = [
      { label: 'Master Data', icon: StorageIcon, path: '/settings/master-data', permission: 'view_master_data' },
      { label: 'Warehouses', icon: WarehouseIcon, path: '/settings/warehouses', permission: 'view_warehouses' },
      { label: 'Racks', icon: CategoryIcon, path: '/settings/racks', permission: 'view_racks' },
      { label: 'Users', icon: PersonIcon, path: '/settings/users', permission: 'view_users' },
      { label: 'Permissions', icon: SettingsIcon, path: '/settings/permissions', permission: 'view_permissions' },
      { label: 'Printers', icon: PrinterIcon, path: '/settings/printers', permission: 'view_printers' },
      { label: 'Backups', icon: StorageIcon, path: '/settings/backups', permission: 'view_backups' },
    ];

    // Admin sees all
    if (userRole === 'admin') return allSettings;

    // Don't show settings while permissions are loading
    if (permissionsLoading || !userPermissions) return [];

    // Filter based on actual permissions from context
    return allSettings.filter(item => userPermissions[item.permission] === true);
  }, [userRole, permissionsLoading, userPermissions]);

  const navigate = (path: string) => {
    router.push(path);
    if (isMobile && setMobileOpen) setMobileOpen(false);
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      router.push('/login');
    }
  };

  const drawerContent = (
    <>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton
          onClick={() => (isMobile ? (setMobileOpen && setMobileOpen(false)) : setCollapsed(!collapsed))}
          sx={{ color: 'white', margin: -1 }}
        >
          <MenuIcon />
        </IconButton>

        {!collapsed && (
          <Typography fontWeight="bold">Divine WMS</Typography>
        )}

        {isMobile && (
          <IconButton
            sx={{ marginLeft: 'auto', color: 'white' }}
            onClick={() => setMobileOpen && setMobileOpen(false)}
          >
            <CloseIcon />
          </IconButton>
        )}
      </Toolbar>

      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />

      <List>
        {mainMenu.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.path;

          return (
            <ListItem key={item.path} disablePadding>
              <Tooltip title={collapsed ? item.label : ''} placement="right" arrow>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  sx={{
                    mx: 1,
                    borderRadius: 1,
                    bgcolor: active ? 'rgba(59,130,246,0.2)' : 'transparent',
                    color: active ? '#60a5fa' : 'rgba(255,255,255,0.7)',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: 'inherit',
                      minWidth: collapsed ? 'auto' : 40,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                    }}
                  >
                    <Icon />
                  </ListItemIcon>

                  {!collapsed && <ListItemText primary={item.label} />}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}

        <Divider sx={{ my: 2, bgcolor: 'rgba(255,255,255,0.1)' }} />

        {/* Only show Settings if user has settings menu items */}
        {settingsMenu.length > 0 && (
          <ListItem
            disablePadding
            onMouseEnter={() => setSettingsHovered(true)}
            onMouseLeave={() => setSettingsHovered(false)}
          >
            <ListItemButton
              onClick={() => setSettingsOpen(!settingsOpen)}
              sx={{ mx: 1, borderRadius: 1, color: 'rgba(255,255,255,0.7)' }}
            >
              <ListItemIcon
                sx={{
                  color: 'inherit',
                  minWidth: collapsed ? 'auto' : 40,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <SettingsIcon />
              </ListItemIcon>

              {!collapsed && (
                <>
                  <ListItemText primary="Settings" />
                  {settingsOpen ? <ExpandLess /> : <ExpandMore />}
                </>
              )}
            </ListItemButton>
          </ListItem>
        )}

        <AnimatePresence>
          {settingsOpen && (!collapsed || isMobile) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <List sx={{ pl: 4 }}>
                {settingsMenu.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.path;

                  return (
                    <ListItem key={item.path} disablePadding>
                      <ListItemButton
                        onClick={() => navigate(item.path)}
                        sx={{
                          borderRadius: 1,
                          color: active ? '#60a5fa' : 'rgba(255,255,255,0.8)',
                          bgcolor: active ? 'rgba(59,130,246,0.2)' : 'transparent',
                          my: 0.5,
                        }}
                      >
                        <ListItemIcon sx={{ color: 'inherit', minWidth: 30 }}>
                          <Icon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={item.label} />
                      </ListItemButton>
                    </ListItem>
                  );
                })}

                {/* Logout Button */}
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={handleLogout}
                    sx={{
                      borderRadius: 1,
                      color: '#ef4444',
                      bgcolor: 'transparent',
                      my: 0.5,
                      '&:hover': {
                        bgcolor: 'rgba(239, 68, 68, 0.1)',
                      }
                    }}
                  >
                    <ListItemIcon sx={{ color: 'inherit', minWidth: 30 }}>
                      <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Logout" />
                  </ListItemButton>
                </ListItem>
              </List>
            </motion.div>
          )}
        </AnimatePresence>

      </List>

      <Box sx={{ flexGrow: 1 }} />

      {!collapsed && (
        <Box sx={{ p: 2 }}>
          <Typography variant="caption" color="rgba(255,255,255,0.6)">
            WMS v1.0.0
          </Typography>
        </Box>
      )}
    </>
  );

  ////////////////////////// UI RENDER ///////////////////////////
  return (
    <>
      {isMobile ? (
        <>
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen && setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                width: 230,
                background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
                color: 'white',
                left: 0,
                position: 'fixed',
                borderRight: 'none',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.3) transparent',
                '&::-webkit-scrollbar': {
                  width: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(255,255,255,0.3)',
                  borderRadius: '10px',
                },
              },
            }}
          >
            {drawerContent}
          </Drawer>
        </>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            height: '100vh',
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
              color: 'white',
              transition: 'width 0.3s',
              overflowX: 'hidden',
              overflowY: 'auto',
              position: 'relative',
              height: '100%',
              maxHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              borderRight: 'none',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.3) transparent',
              '&::-webkit-scrollbar': {
                width: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(255,255,255,0.3)',
                borderRadius: '10px',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.5)',
                },
              },
            },
          }}
        >

          {drawerContent}
        </Drawer>
      )}

      {/* Flyout disabled on mobile */}
      {flyoutVisible && collapsed && !isMobile && (
        <Paper
          onMouseEnter={() => setFlyoutHovered(true)}
          onMouseLeave={() => setFlyoutHovered(false)}
          elevation={6}
          sx={{
            position: 'fixed',
            top: 70,
            left: drawerWidth,
            width: 220,
            background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
            color: 'white',
            p: 1,
            borderRadius: 1,
            zIndex: 2000,
            boxShadow: '0 8px 24px rgba(2,6,23,0.6)',
            border: '1px solid rgba(255,255,255,0.04)'
          }}
        >
          <Typography sx={{ px: 1, pb: 1, fontSize: 13, opacity: 0.7 }}>
            Settings
          </Typography>

          <List>
            {settingsMenu.map((item) => {
              const Icon = item.icon;
              return (
                <ListItem key={item.path} disablePadding>
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    sx={{ borderRadius: 1, color: 'rgba(255,255,255,0.8)' }}
                  >
                    <ListItemIcon sx={{ color: 'inherit' }}>
                      <Icon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </ListItem>
              );
            })}

            {/* Logout Button */}
            <ListItem disablePadding>
              <ListItemButton
                onClick={handleLogout}
                sx={{
                  borderRadius: 1,
                  color: '#ef4444',
                  '&:hover': {
                    bgcolor: 'rgba(239, 68, 68, 0.1)',
                  }
                }}
              >
                <ListItemIcon sx={{ color: 'inherit' }}>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          </List>
        </Paper>
      )}

      {/* Permission Update Notification */}
      <Snackbar
        open={showNotification}
        autoHideDuration={3000}
        onClose={() => setShowNotification(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowNotification(false)}
          severity="info"
          sx={{ width: '100%' }}
        >
          {notificationMessage}
        </Alert>
      </Snackbar>
    </>
  );
}