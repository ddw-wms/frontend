// File Path = arehouse-frontend\app\settings\users\page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Paper, Typography, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Chip, IconButton, Stack,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, useMediaQuery, useTheme, CircularProgress,
  Tooltip, Badge
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Key as KeyIcon, Logout as LogoutIcon, Circle as CircleIcon } from '@mui/icons-material';
import { usersAPI, sessionsAPI } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import toast, { Toaster } from 'react-hot-toast';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import { useUsersPermissions } from '@/hooks/usePagePermissions';
import { StandardPageHeader } from '@/components';

export default function UsersPage() {

  const { activeWarehouse, setActiveWarehouse } = useWarehouse();
  const { canSeeButton, isAdmin, isLoading: permLoading } = useUsersPermissions();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';
  const [users, setUsers] = useState<any[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({
    username: '',
    email: '',
    fullName: '',
    phone: '',
    role: 'operator',
    password: '',
    isActive: true
  });
  const [loading, setLoading] = useState(false);

  // Password change dialog
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordChangeUser, setPasswordChangeUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Online users tracking
  const [onlineUserIds, setOnlineUserIds] = useState<number[]>([]);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [userToLogout, setUserToLogout] = useState<any>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutAllDialogOpen, setLogoutAllDialogOpen] = useState(false);

  // Current logged-in user
  const currentUser = user;
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isCurrentAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Check if current user can modify target user
  const canModifyUser = (targetUser: any): boolean => {
    // Can't modify yourself (for delete)
    if (targetUser.id === currentUser?.id) return false;
    // Only super_admin can modify another super_admin
    if (targetUser.role === 'super_admin' && !isSuperAdmin) return false;
    return true;
  };

  // Check if current user can edit target user (self-edit allowed)
  const canEditUser = (targetUser: any): boolean => {
    // Super admin can only be edited by super_admin
    if (targetUser.role === 'super_admin' && !isSuperAdmin) return false;
    return true;
  };

  // Check if current user can logout target user
  const canLogoutUser = (targetUser: any): boolean => {
    // Can't logout yourself from here
    if (targetUser.id === currentUser?.id) return false;
    // Must be admin or super_admin to logout others
    if (!isCurrentAdmin) return false;
    // Admin can only logout regular users (not admins or super_admin)
    if (currentUser?.role === 'admin') {
      if (targetUser.role === 'admin' || targetUser.role === 'super_admin') return false;
    }
    return true;
  };

  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) setUser(storedUser);
  }, []);

  const loadUsers = async () => {
    try {
      const res = await usersAPI.getAll();
      setUsers(res.data);
    } catch (e) {
      toast.error('Failed to load users');
    }
  };

  // Fetch online users
  const loadOnlineUsers = useCallback(async () => {
    if (!isCurrentAdmin) return;
    try {
      const res = await sessionsAPI.getOnlineUsers();
      setOnlineUserIds(res.data.userIds || []);
    } catch (e) {
      // Silently fail - table might not exist yet
      console.debug('Could not fetch online users');
    }
  }, [isCurrentAdmin]);

  useEffect(() => {
    loadUsers();
  }, []);

  // Load online users when admin/super_admin
  useEffect(() => {
    if (isCurrentAdmin) {
      loadOnlineUsers();
      // Refresh online status every 30 seconds
      const interval = setInterval(loadOnlineUsers, 30000);
      return () => clearInterval(interval);
    }
  }, [isCurrentAdmin, loadOnlineUsers]);

  // Logout single user
  const handleLogoutUser = async () => {
    if (!userToLogout) return;
    try {
      setLogoutLoading(true);
      await sessionsAPI.logoutUser(userToLogout.id);
      toast.success(`${userToLogout.username} has been logged out`);
      setLogoutDialogOpen(false);
      setUserToLogout(null);
      loadOnlineUsers();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to logout user');
    } finally {
      setLogoutLoading(false);
    }
  };

  // Logout all users
  const handleLogoutAll = async () => {
    try {
      setLogoutLoading(true);
      await sessionsAPI.logoutAll(true); // exclude self
      toast.success('All users have been logged out');
      setLogoutAllDialogOpen(false);
      loadOnlineUsers();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to logout all users');
    } finally {
      setLogoutLoading(false);
    }
  };

  const openLogoutDialog = (user: any) => {
    setUserToLogout(user);
    setLogoutDialogOpen(true);
  };


  const handleDialogOpen = (item?: any) => {
    setEditItem(item || null);
    setForm(item ? {
      username: item.username,
      email: item.email || '',
      fullName: item.full_name || '',
      phone: item.phone || '',
      role: item.role || 'operator',
      password: '',
      isActive: item.is_active || true
    } : {
      username: '',
      email: '',
      fullName: '',
      phone: '',
      role: 'operator',
      password: '',
      isActive: true
    });
    setOpenDialog(true);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    setEditItem(null);
    setForm({
      username: '',
      email: '',
      fullName: '',
      phone: '',
      role: 'operator',
      password: '',
      isActive: true
    });
  };

  const handleSave = async () => {
    if (!form.username) {
      toast.error('Username is required');
      return;
    }

    try {
      setLoading(true);
      if (editItem) {
        await usersAPI.update(editItem.id, {
          email: form.email,
          full_name: form.fullName,
          phone: form.phone,
          role: form.role,
          is_active: form.isActive
        });
        toast.success('✓ User updated');
      } else {
        if (!form.password) {
          toast.error('Password is required for new users');
          setLoading(false);
          return;
        }
        await usersAPI.create({
          username: form.username,
          email: form.email,
          full_name: form.fullName,
          phone: form.phone,
          role: form.role,
          password: form.password
        });
        toast.success('✓ User created');
      }
      handleDialogClose();
      loadUsers();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error saving user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteLoading(true);
    try {
      await usersAPI.delete(id);
      loadUsers();
      toast.success('✓ User deleted');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const openDeleteDialog = (user: any) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleOpenPasswordDialog = (user: any) => {
    setPasswordChangeUser(user);
    setNewPassword('');
    setPasswordDialogOpen(true);
  };

  const handleClosePasswordDialog = () => {
    setPasswordDialogOpen(false);
    setPasswordChangeUser(null);
    setNewPassword('');
  };

  const handleChangePassword = async () => {
    // Strong password validation
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      toast.error('Password must contain at least one lowercase letter');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast.error('Password must contain at least one number');
      return;
    }

    try {
      setPasswordLoading(true);
      await usersAPI.changePassword(passwordChangeUser.id, newPassword);
      toast.success('✓ Password changed successfully');
      handleClosePasswordDialog();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    const colors: any = {
      admin: 'error',
      manager: 'warning',
      operator: 'info',
      qc: 'success',
      picker: 'default'
    };
    return colors[role] || 'default';
  };

  /////////////////////////////// UI RENDER ///////////////////////////////
  return (
    <AppLayout>
      <Toaster position="top-right" />
      <Box sx={{
        p: { xs: 0.75, md: 1 },
        background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>

        {/* ==================== HEADER SECTION ==================== */}
        <StandardPageHeader
          title="Users Management"
          subtitle="Manage your users"
          icon="👥"
          warehouseName={activeWarehouse?.name}
          userName={user?.fullName}
        />
        <Box sx={{ marginBottom: 1.5, mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            {canSeeButton('add') && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleDialogOpen()} size="small" sx={{ height: 36, fontWeight: 600, background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' }}>
                Add User
              </Button>
            )}
          </Box>
          {/* Online status and Logout All button */}
          {isCurrentAdmin && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip
                icon={<CircleIcon sx={{ fontSize: 10, color: '#22c55e !important' }} />}
                label={`${onlineUserIds.length} Online`}
                size="small"
                variant="outlined"
                sx={{ borderColor: '#22c55e', color: '#22c55e', fontWeight: 600 }}
              />
              {isSuperAdmin && onlineUserIds.length > 1 && (
                <Button
                  variant="outlined"
                  color="warning"
                  size="small"
                  startIcon={<LogoutIcon />}
                  onClick={() => setLogoutAllDialogOpen(true)}
                  sx={{ height: 32, fontWeight: 600 }}
                >
                  Logout All
                </Button>
              )}
            </Box>
          )}
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d1d5db', position: 'relative' }}>
          <TableContainer component={Paper} sx={{ borderRadius: 0, boxShadow: 'none', border: 'none', background: isDarkMode ? '#1e293b' : '#ffffff', height: '100%' }}>
            <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { borderRight: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d1d5db', padding: '6px 10px', fontSize: '0.75rem' } }}>
              <TableHead>
                <TableRow sx={{ background: isDarkMode ? '#334155' : '#e5e7eb' }}>
                  <TableCell sx={{ color: isDarkMode ? '#f1f5f9' : '#1f2937', fontWeight: 700, background: isDarkMode ? '#334155' : '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', width: 60 }}>#</TableCell>
                  <TableCell sx={{ color: isDarkMode ? '#f1f5f9' : '#1f2937', fontWeight: 700, background: isDarkMode ? '#334155' : '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 150 }}>FULL NAME</TableCell>
                  <TableCell sx={{ color: isDarkMode ? '#f1f5f9' : '#1f2937', fontWeight: 700, background: isDarkMode ? '#334155' : '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 120 }}>USERNAME</TableCell>
                  <TableCell sx={{ color: isDarkMode ? '#f1f5f9' : '#1f2937', fontWeight: 700, background: isDarkMode ? '#334155' : '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 180 }}>EMAIL</TableCell>
                  <TableCell sx={{ color: isDarkMode ? '#f1f5f9' : '#1f2937', fontWeight: 700, background: isDarkMode ? '#334155' : '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 120 }}>PHONE</TableCell>
                  <TableCell sx={{ color: isDarkMode ? '#f1f5f9' : '#1f2937', fontWeight: 700, background: isDarkMode ? '#334155' : '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 100 }}>ROLE</TableCell>
                  <TableCell sx={{ color: isDarkMode ? '#f1f5f9' : '#1f2937', fontWeight: 700, background: isDarkMode ? '#334155' : '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 100 }}>STATUS</TableCell>
                  {isCurrentAdmin && (
                    <TableCell sx={{ color: isDarkMode ? '#f1f5f9' : '#1f2937', fontWeight: 700, background: isDarkMode ? '#334155' : '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 80, textAlign: 'center' }}>ONLINE</TableCell>
                  )}
                  <TableCell sx={{ color: isDarkMode ? '#f1f5f9' : '#1f2937', fontWeight: 700, background: isDarkMode ? '#334155' : '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 120, textAlign: 'center' }}>ACTIONS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                      <CircularProgress size={50} />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                      <Typography sx={{ fontWeight: 700, color: '#94a3b8' }}>📭 No users found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user, idx) => {
                    const isOnline = onlineUserIds.includes(user.id);
                    return (
                      <TableRow key={user.id} sx={{ bgcolor: idx % 2 === 0 ? (isDarkMode ? '#1a2536' : '#ffffff') : (isDarkMode ? '#1e293b' : '#f9fafb'), '&:hover': { bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#f0f0f0' } }}>
                        <TableCell sx={{ fontWeight: 700, width: 60, fontSize: '0.75rem' }}>{idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{user.full_name || '-'}</TableCell>
                        <TableCell sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{user.username}</TableCell>
                        <TableCell sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{user.email || '-'}</TableCell>
                        <TableCell sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{user.phone || '-'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Chip
                            label={user.role.toUpperCase()}
                            size="small"
                            color={getRoleColor(user.role)}
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {user.is_active ? (
                            <Chip label="Active" color="success" size="small" />
                          ) : (
                            <Chip label="Inactive" size="small" />
                          )}
                        </TableCell>
                        {isCurrentAdmin && (
                          <TableCell sx={{ textAlign: 'center' }}>
                            <Tooltip title={isOnline ? 'Online' : 'Offline'}>
                              <CircleIcon
                                sx={{
                                  fontSize: 12,
                                  color: isOnline ? '#22c55e' : '#d1d5db',
                                  filter: isOnline ? 'drop-shadow(0 0 3px #22c55e)' : 'none'
                                }}
                              />
                            </Tooltip>
                          </TableCell>
                        )}
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            {canSeeButton('edit') && canEditUser(user) && (
                              <IconButton
                                size="small"
                                onClick={() => handleDialogOpen(user)}
                                title="Edit"
                                sx={{ color: '#1e40af', p: 0.5, '&:hover': { bgcolor: 'rgba(30, 64, 175, 0.1)' } }}
                              >
                                <EditIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            )}
                            {canSeeButton('changepassword') && canEditUser(user) && (
                              <IconButton
                                size="small"
                                onClick={() => handleOpenPasswordDialog(user)}
                                title="Change Password"
                                sx={{ color: '#10b981', p: 0.5, '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' } }}
                              >
                                <KeyIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            )}
                            {isOnline && canLogoutUser(user) && (
                              <Tooltip title="Force Logout">
                                <IconButton
                                  size="small"
                                  onClick={() => openLogoutDialog(user)}
                                  sx={{ color: '#f97316', p: 0.5, '&:hover': { bgcolor: 'rgba(249, 115, 22, 0.1)' } }}
                                >
                                  <LogoutIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {canSeeButton('delete') && canModifyUser(user) && (
                              <IconButton
                                size="small"
                                onClick={() => openDeleteDialog(user)}
                                title="Delete"
                                sx={{ color: '#ef4444', p: 0.5, '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>

      {/* Dialog */}
      <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight="bold">
          {editItem ? '✏️ Edit User' : '➕ Add New User'}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Full Name"
              fullWidth
              value={form.fullName}
              onChange={e => setForm({ ...form, fullName: e.target.value })}
              placeholder="e.g., John Doe"
            />
            <TextField
              label="Username *"
              fullWidth
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              disabled={!!editItem}
              placeholder="e.g., johndoe"
            />
            <TextField
              label="Email"
              fullWidth
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="e.g., john@example.com"
            />
            <TextField
              label="Phone"
              fullWidth
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g., 9876543210"
            />
            {!editItem && (
              <TextField
                label="Password *"
                fullWidth
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 6 characters"
              />
            )}
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={form.role}
                label="Role"
                onChange={e => setForm({ ...form, role: e.target.value })}
              >
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="manager">Manager</MenuItem>
                <MenuItem value="supervisor">Supervisor</MenuItem>
                <MenuItem value="operator">Operator</MenuItem>
                <MenuItem value="qc">QC</MenuItem>
                <MenuItem value="picker">Picker</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                />
              }
              label={form.isActive ? "Active" : "Inactive"}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onClose={handleClosePasswordDialog} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight="bold">
          🔑 Change Password
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Changing password for: <strong>{passwordChangeUser?.username}</strong>
          </Typography>
          <TextField
            label="New Password *"
            fullWidth
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Minimum 8 characters with uppercase, lowercase, and number"
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClosePasswordDialog} disabled={passwordLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleChangePassword}
            disabled={passwordLoading}
          >
            {passwordLoading ? 'Changing...' : 'Change Password'}
          </Button>
        </DialogActions >
      </Dialog >

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete User"
        message={`Are you sure you want to delete user "${userToDelete?.username}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
        loading={deleteLoading}
        onConfirm={() => handleDelete(userToDelete?.id)}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setUserToDelete(null);
        }}
      />

      {/* Logout User Confirmation Dialog */}
      <ConfirmDialog
        open={logoutDialogOpen}
        title="Force Logout User"
        message={`Are you sure you want to logout "${userToLogout?.username}"? They will be disconnected immediately and need to login again.`}
        confirmText="Logout"
        confirmColor="warning"
        loading={logoutLoading}
        onConfirm={handleLogoutUser}
        onCancel={() => {
          setLogoutDialogOpen(false);
          setUserToLogout(null);
        }}
      />

      {/* Logout All Confirmation Dialog */}
      <ConfirmDialog
        open={logoutAllDialogOpen}
        title="Logout All Users"
        message={`Are you sure you want to logout all ${onlineUserIds.length - 1} other online users? They will be disconnected immediately.`}
        confirmText="Logout All"
        confirmColor="warning"
        loading={logoutLoading}
        onConfirm={handleLogoutAll}
        onCancel={() => setLogoutAllDialogOpen(false)}
      />
    </AppLayout >
  );
}
