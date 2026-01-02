// File Path = warehouse-frontend\components\Sidebar.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
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

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string>('');

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  // --------------------------------------
  // FIXED MOBILE DETECTION (REAL DEVICE)
  // --------------------------------------
  const [isMobile, setIsMobile] = useState(false);

  const checkMobile = useCallback(() => {
    if (typeof navigator !== 'undefined') {
      const real = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobile(real);
    }
  }, []);

  useEffect(() => {
    checkMobile();
    // Get user role
    const user = getStoredUser();
    if (user) {
      setUserRole(user.role || '');
    }
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
    setMobileOpen(false);
  }, [pathname]);

  const drawerWidth = collapsed ? 70 : 230;

  // Filter menu items based on user role
  const getMainMenu = () => {
    const allItems = [
      { label: 'Dashboard', icon: DashboardIcon, path: '/dashboard', roles: ['admin', 'manager', 'operator', 'qc', 'picker'] },
      { label: 'Inbound', icon: InventoryIcon, path: '/inbound', roles: ['admin', 'manager', 'operator'] },
      { label: 'Processing', icon: CheckIcon, path: '/qc', roles: ['admin', 'manager', 'qc'] },
      { label: 'Picking', icon: AssignmentIcon, path: '/picking', roles: ['admin', 'manager', 'picker'] },
      { label: 'Outbound', icon: ShippingIcon, path: '/outbound', roles: ['admin', 'manager', 'operator'] },
      { label: 'Customers', icon: GroupIcon, path: '/customers', roles: ['admin', 'manager', 'operator'] },
      { label: 'Reports', icon: ReportsIcon, path: '/reports', roles: ['admin', 'manager'] }
    ];

    return allItems.filter(item => !userRole || item.roles.includes(userRole));
  };

  const getSettingsMenu = () => {
    if (userRole === 'admin') {
      return [
        { label: 'Master Data', icon: StorageIcon, path: '/settings/master-data' },
        { label: 'Warehouses', icon: WarehouseIcon, path: '/settings/warehouses' },
        { label: 'Racks', icon: CategoryIcon, path: '/settings/racks' },
        { label: 'Users', icon: PersonIcon, path: '/settings/users' },
        { label: 'Permissions', icon: SettingsIcon, path: '/settings/permissions' },
        { label: 'Printers', icon: PrinterIcon, path: '/settings/printers' },
      ];
    } else if (userRole === 'manager') {
      return [
        { label: 'Master Data', icon: StorageIcon, path: '/settings/master-data' },
        { label: 'Reports', icon: AssignmentIcon, path: '/settings/reports' },
      ];
    } else if (userRole === 'operator') {
      return [
        { label: 'Master Data', icon: StorageIcon, path: '/settings/master-data' },
      ];
    }
    return []; // qc and picker have no settings access
  };

  const mainMenu = getMainMenu();
  const settingsMenu = getSettingsMenu();

  const navigate = (path: string) => {
    router.push(path);
    if (isMobile) setMobileOpen(false);
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
          onClick={() => (isMobile ? setMobileOpen(false) : setCollapsed(!collapsed))}
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
            onClick={() => setMobileOpen(false)}
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
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                width: 230,
                background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
                color: 'white',
                left: 0,
                position: 'fixed',
                borderRight: 'none',
                // ✅ Mobile scrollbar styling
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.3) transparent',

                '&::-webkit-scrollbar': {
                  width: '4px', // Mobile pe aur bhi thin
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

          {!mobileOpen && (
            <IconButton
              onClick={() => setMobileOpen(true)}
              sx={{
                position: 'fixed',
                top: 10,
                left: 10,
                zIndex: 3000,
                bgcolor: '#052457',
                color: 'white',
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
        </>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
              color: 'white',
              transition: 'width 0.3s',
              overflowX: 'hidden',
              position: 'fixed',
              top: 0,
              left: 0,
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              borderRight: 'none',
              // ✅ Scrollbar styling add karo
              scrollbarWidth: 'thin', // Firefox ke liye
              scrollbarColor: 'rgba(255,255,255,0.3) transparent', // Firefox ke liye

              // Chrome, Safari, Edge ke liye
              '&::-webkit-scrollbar': {
                width: '4px', // Thickness kam karo (default 15px hoti hai)
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent', // Track ka color
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(255,255,255,0.3)', // Thumb ka color
                borderRadius: '10px', // Rounded corners
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.5)', // Hover pe brightness
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
    </>
  );
}