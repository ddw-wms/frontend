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
} from '@mui/icons-material';
import path from 'path';
import { Group as GroupIcon } from '@mui/icons-material';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

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

  const mainMenu = [
    { label: 'Dashboard', icon: DashboardIcon, path: '/dashboard' },
    { label: 'Inbound', icon: InventoryIcon, path: '/inbound' },
    { label: 'QC', icon: CheckIcon, path: '/qc' },
    { label: 'Picking', icon: AssignmentIcon, path: '/picking' },
    { label: 'Outbound', icon: ShippingIcon, path: '/outbound' },
    // {Label: 'Customers', icon: PersonIcon, path: '/customers'}
    { label: 'Customers', icon: GroupIcon, path: '/customers' }

  ];

  const settingsMenu = [
    { label: 'Master Data', icon: StorageIcon, path: '/settings/master-data' },
    { label: 'Warehouses', icon: WarehouseIcon, path: '/settings/warehouses' },
    { label: 'Racks', icon: CategoryIcon, path: '/settings/racks' },
    { label: 'Users', icon: PersonIcon, path: '/settings/users' },
    { label: 'Permissions', icon: SettingsIcon, path: '/settings/permissions' },
    { label: 'Printers', icon: PrinterIcon, path: '/settings/printers' },
    { label: 'Reports', icon: AssignmentIcon, path: '/settings/reports' },
  ];

  const navigate = (path: string) => {
    router.push(path);
    if (isMobile) setMobileOpen(false);
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
                bgcolor: '#052457ff',
                color: 'white',
                left: 0,
                position: 'fixed',
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
      bgcolor: '#052457ff',
      color: 'white',
      transition: 'width 0.3s',
      overflowX: 'hidden',
      position: 'fixed',       // ⭐ FIX #1
      top: 0,                  // ⭐ FIX #2
      left: 0,                 // ⭐ FIX #3
      height: '100vh',         // ⭐ FIX #4
      display: 'flex',
      flexDirection: 'column',
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
            bgcolor: '#052457',
            color: 'white',
            p: 1,
            borderRadius: 1,
            zIndex: 2000,
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
          </List>
        </Paper>
      )}
    </>
  );
}