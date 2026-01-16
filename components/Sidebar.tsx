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
  CircularProgress,
  Snackbar,
  Alert,
  Portal,
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
  Security as SecurityIcon,
  Storage as StorageIcon,
  Warehouse as WarehouseIcon,
  Person as PersonIcon,
  Category as CategoryIcon,
  LocalPrintshop as PrinterIcon,
  Menu as MenuIcon,
  Assessment as ReportsIcon,
  AdminPanelSettings as PermissionsIcon,
  Group as GroupIcon,
  Logout as LogoutIcon,
  BugReport as ErrorLogsIcon,
  Palette as AppearanceIcon,
} from '@mui/icons-material';
import { getStoredUser, logout } from '@/lib/auth';
import { usePermissions } from '@/app/context/PermissionContext';
import ConfirmDialog from './ConfirmDialog';

interface SidebarProps {
  username?: string;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen = false, setMobileOpen }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);


  // Use Permission context
  const { canSeeMenu, isAdmin, isLoading: permissionsLoading } = usePermissions();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  // Listen for appearance settings changes
  useEffect(() => {
    const handleAppearanceChange = (e: CustomEvent) => {
      const settings = e.detail;
      if (settings?.sidebarCompact !== undefined) {
        setCollapsed(settings.sidebarCompact);
      }
    };
    window.addEventListener('appearanceSettingsChanged', handleAppearanceChange as EventListener);
    return () => {
      window.removeEventListener('appearanceSettingsChanged', handleAppearanceChange as EventListener);
    };
  }, []);

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
      setUserRole(user.role || '');
      setUserName(user.fullName || user.username || '');
    }



    return () => {
      window.removeEventListener('resize', checkMobile);
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

  // Main menu items with UI access codes
  const allMainMenuItems = useMemo(() => [
    { label: 'Dashboard', icon: DashboardIcon, path: '/dashboard', code: 'menu:dashboard' },
    { label: 'Inbound', icon: InventoryIcon, path: '/inbound', code: 'menu:inbound' },
    { label: 'Processing', icon: CheckIcon, path: '/qc', code: 'menu:qc' },
    { label: 'Picking', icon: AssignmentIcon, path: '/picking', code: 'menu:picking' },
    { label: 'Outbound', icon: ShippingIcon, path: '/outbound', code: 'menu:outbound' },
    { label: 'Customers', icon: GroupIcon, path: '/customers', code: 'menu:customers' },
    { label: 'Analytics', icon: ReportsIcon, path: '/reports', code: 'menu:reports' }
  ], []);

  // Settings menu items with permission codes
  const allSettingsMenuItems = useMemo(() => [
    { label: 'Master Data', icon: StorageIcon, path: '/settings/master-data', code: 'menu:settings:masterdata' },
    { label: 'Warehouses', icon: WarehouseIcon, path: '/settings/warehouses', code: 'menu:settings:warehouses' },
    { label: 'Racks', icon: CategoryIcon, path: '/settings/racks', code: 'menu:settings:racks' },
    { label: 'Users', icon: PersonIcon, path: '/settings/users', code: 'menu:settings:users' },
    { label: 'Printers', icon: PrinterIcon, path: '/settings/printers', code: 'menu:settings:printers' },
    { label: 'Backups', icon: StorageIcon, path: '/settings/backups', code: 'menu:settings:backups' },
    { label: 'Permissions', icon: PermissionsIcon, path: '/settings/permissions', code: 'menu:settings:permissions' },
    { label: 'Appearance', icon: AppearanceIcon, path: '/settings/appearance', code: 'menu:settings:appearance' },
    { label: 'Error Logs', icon: ErrorLogsIcon, path: '/settings/error-logs', code: 'super_admin_only', superAdminOnly: true },
  ], []);

  // Filter menu items based on permissions
  const mainMenu = useMemo(() => {
    // Get user from storage for immediate admin check
    const user = getStoredUser();
    const isUserAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    // Admin gets all menu items immediately (no waiting for permissions to load)
    if (isAdmin || isUserAdmin) {
      return allMainMenuItems;
    }

    // Show all menu items while loading to prevent blank menu (permission check happens on route)
    // This prevents app from feeling unresponsive on slow networks
    if (permissionsLoading) return allMainMenuItems;
    return allMainMenuItems.filter(item => canSeeMenu(item.code));
  }, [allMainMenuItems, canSeeMenu, isAdmin, permissionsLoading]);

  const settingsMenu = useMemo(() => {
    // Get user from storage for immediate admin check
    const user = getStoredUser();
    const isUserAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const isSuperAdmin = user?.role === 'super_admin';

    // Filter items based on role
    const filterSuperAdminItems = (items: typeof allSettingsMenuItems) => {
      return items.filter(item => !item.superAdminOnly || isSuperAdmin);
    };

    // Admin gets all menu items immediately (but super_admin-only items filtered)
    if (isAdmin || isUserAdmin) {
      return filterSuperAdminItems(allSettingsMenuItems);
    }

    // Show all settings items while loading to prevent blank menu
    // This prevents app from feeling unresponsive on slow networks
    if (permissionsLoading) return filterSuperAdminItems(allSettingsMenuItems);
    return filterSuperAdminItems(allSettingsMenuItems.filter(item => canSeeMenu(item.code)));
  }, [allSettingsMenuItems, canSeeMenu, isAdmin, permissionsLoading]);

  const navigate = (path: string) => {
    // Close mobile drawer IMMEDIATELY for instant feedback (don't wait for navigation)
    if (isMobile && setMobileOpen) setMobileOpen(false);

    if (pathname === path) {
      // already on target path — drawer already closed above
      return;
    }

    // Use startTransition for non-blocking navigation (React 18+)
    router.push(path);
  };

  const handleLogout = () => {
    setLogoutDialogOpen(true);
  };

  const confirmLogout = () => {
    logout();
    router.push('/login');
  };

  const drawerContent = (
    <>
      <Toolbar sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minHeight: { xs: 56, sm: 64 },
        px: { xs: 1.5, sm: 2 },
      }}>
        <IconButton
          onClick={() => (isMobile ? (setMobileOpen && setMobileOpen(false)) : setCollapsed(!collapsed))}
          sx={{
            color: 'white',
            ml: -0.5,
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          <MenuIcon />
        </IconButton>

        {!collapsed && (
          <Typography
            fontWeight="bold"
            sx={{
              fontSize: { xs: '1rem', sm: '1.1rem' },
              background: 'linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.9) 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              letterSpacing: '0.5px',
            }}
          >
            Divine WMS
          </Typography>
        )}

        {isMobile && (
          <IconButton
            sx={{
              marginLeft: 'auto',
              color: 'white',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
            onClick={() => setMobileOpen && setMobileOpen(false)}
          >
            <CloseIcon />
          </IconButton>
        )}
      </Toolbar>

      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />

      <List sx={{ px: 0.5, py: 1 }}>
        {mainMenu.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.path || pathname.startsWith(item.path + '/');

          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.25 }}>
              <Tooltip title={collapsed ? item.label : ''} placement="right" arrow>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  sx={{
                    mx: 0.75,
                    py: { xs: 1.25, sm: 1 },
                    borderRadius: 2,
                    bgcolor: active ? 'rgba(59,130,246,0.2)' : 'transparent',
                    color: active ? '#93c5fd' : 'rgba(255,255,255,0.75)',
                    transition: 'background-color 0.15s ease, color 0.15s ease',
                    WebkitTapHighlightColor: 'transparent',
                    '&:hover': {
                      bgcolor: active ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.08)',
                    },
                    '&:active': {
                      bgcolor: 'rgba(59,130,246,0.3)',
                    },
                    // Active indicator left border
                    ...(active && {
                      borderLeft: '3px solid #3b82f6',
                      pl: 1.5,
                    }),
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: 'inherit',
                      minWidth: collapsed ? 'auto' : 40,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                    }}
                  >
                    <Icon sx={{ fontSize: { xs: 22, sm: 24 } }} />
                  </ListItemIcon>

                  {!collapsed && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '0.9rem' },
                        fontWeight: active ? 600 : 500,
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}

        <Divider sx={{ my: 1.5, bgcolor: 'rgba(255,255,255,0.08)' }} />

        {/* Only show Settings if user has settings menu items */}
        {settingsMenu.length > 0 && (
          <ListItem
            disablePadding
            onMouseEnter={() => setSettingsHovered(true)}
            onMouseLeave={() => setSettingsHovered(false)}
            sx={{ mb: 0.25 }}
          >
            <ListItemButton
              onClick={() => { setSettingsOpen(!settingsOpen); }}
              sx={{
                mx: 0.75,
                py: { xs: 1.25, sm: 1 },
                borderRadius: 2,
                color: 'rgba(255,255,255,0.75)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.08)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: 'inherit',
                  minWidth: collapsed ? 'auto' : 40,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <SettingsIcon sx={{ fontSize: { xs: 22, sm: 24 } }} />
              </ListItemIcon>

              {!collapsed && (
                <>
                  <ListItemText
                    primary="Settings"
                    primaryTypographyProps={{
                      fontSize: { xs: '0.875rem', sm: '0.9rem' },
                      fontWeight: 500,
                    }}
                  />
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
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <List sx={{ pl: { xs: 2.5, sm: 3 }, pr: 0.5, py: 0.5 }}>
                {settingsMenu.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.path || pathname.startsWith(item.path + '/');

                  return (
                    <ListItem key={item.path} disablePadding sx={{ mb: 0.25 }}>
                      <ListItemButton
                        onClick={() => navigate(item.path)}
                        sx={{
                          py: { xs: 1, sm: 0.75 },
                          borderRadius: 1.5,
                          color: active ? '#93c5fd' : 'rgba(255,255,255,0.7)',
                          bgcolor: active ? 'rgba(59,130,246,0.2)' : 'transparent',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: active ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)',
                          },
                          // Active indicator left border
                          ...(active && {
                            borderLeft: '3px solid #3b82f6',
                            pl: 1,
                          }),
                        }}
                      >
                        <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>
                          <Icon sx={{ fontSize: 18 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            fontSize: { xs: '0.8125rem', sm: '0.85rem' },
                            fontWeight: active ? 600 : 400,
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}

                {/* Logout Button */}
                <ListItem disablePadding sx={{ mt: 0.5 }}>
                  <ListItemButton
                    onClick={handleLogout}
                    sx={{
                      py: { xs: 1, sm: 0.75 },
                      borderRadius: 1.5,
                      color: '#fca5a5',
                      bgcolor: 'transparent',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(239, 68, 68, 0.15)',
                        color: '#fecaca',
                      }
                    }}
                  >
                    <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>
                      <LogoutIcon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary="Logout"
                      primaryTypographyProps={{
                        fontSize: { xs: '0.8125rem', sm: '0.85rem' },
                        fontWeight: 500,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              </List>
            </motion.div>
          )}
        </AnimatePresence>

      </List>

      <Box sx={{ flexGrow: 1 }} />

      {!collapsed && (
        <Box sx={{
          p: 2,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          pb: { xs: 'calc(16px + env(safe-area-inset-bottom))', sm: 2 },
        }}>
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: '0.75rem',
              display: 'block',
            }}
          >
            Logged in as
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255,255,255,0.8)',
              fontWeight: 600,
              fontSize: '0.8125rem',
            }}
          >
            {userName}
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
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              zIndex: 1200,
              '& .MuiDrawer-paper': {
                width: 260,
                background: "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
                color: 'white',
                left: 0,
                position: 'fixed',
                borderRight: 'none',
                boxShadow: '4px 0 30px rgba(0,0,0,0.3)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.2) transparent',
                '&::-webkit-scrollbar': {
                  width: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  borderRadius: '10px',
                },
              },
              '& .MuiBackdrop-root': {
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
              },
            }}
            transitionDuration={{
              enter: 225,
              exit: 195,
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
              background: "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
              color: 'white',
              transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              overflowX: 'hidden',
              overflowY: 'auto',
              position: 'relative',
              height: '100%',
              maxHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              borderRight: 'none',
              boxShadow: '2px 0 20px rgba(0,0,0,0.1)',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.2) transparent',
              '&::-webkit-scrollbar': {
                width: '5px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '10px',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.3)',
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
        <Portal>
          <Paper
            onMouseEnter={() => setFlyoutHovered(true)}
            onMouseLeave={() => setFlyoutHovered(false)}
            elevation={24}
            sx={{
              position: 'fixed',
              top: 70,
              left: drawerWidth,
              width: 220,
              background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
              color: 'white',
              p: 1.5,
              borderRadius: 2,
              zIndex: 99999,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          >
            <Typography sx={{ px: 1, pb: 1.5, fontSize: 12, fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Settings
            </Typography>

            <List sx={{ py: 0 }}>
              {settingsMenu.map((item) => {
                const Icon = item.icon;
                return (
                  <ListItem key={item.path} disablePadding sx={{ mb: 0.25 }}>
                    <ListItemButton
                      onClick={() => navigate(item.path)}
                      sx={{
                        borderRadius: 1.5,
                        color: 'rgba(255,255,255,0.8)',
                        py: 0.875,
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.08)',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>
                        <Icon sx={{ fontSize: 18 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: '0.85rem' }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}

              {/* Logout Button */}
              <ListItem disablePadding sx={{ mt: 0.5 }}>
                <ListItemButton
                  onClick={handleLogout}
                  sx={{
                    borderRadius: 1.5,
                    color: '#fca5a5',
                    py: 0.875,
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: 'rgba(239, 68, 68, 0.15)',
                    }
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>
                    <LogoutIcon sx={{ fontSize: 18 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Logout"
                    primaryTypographyProps={{ fontSize: '0.85rem' }}
                  />
                </ListItemButton>
              </ListItem>
            </List>
          </Paper>
        </Portal>
      )}


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

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        open={logoutDialogOpen}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        confirmColor="primary"
        onConfirm={confirmLogout}
        onCancel={() => setLogoutDialogOpen(false)}
      />
    </>
  );
}
