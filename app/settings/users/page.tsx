// File Path = arehouse-frontend\app\settings\users\page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Paper, Typography, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Chip, IconButton, Stack,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, useMediaQuery, useTheme
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Key as KeyIcon } from '@mui/icons-material';
import { usersAPI } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';

export default function UsersPage() {
  // Role guard - only admin can access
  useRoleGuard(['admin']);

  const { activeWarehouse, setActiveWarehouse } = useWarehouse();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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

  useEffect(() => {
    loadUsers();
  }, []);

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
    if (!confirm('Delete this user?')) return;
    try {
      await usersAPI.delete(id);
      loadUsers();
      toast.success('✓ User deleted');
    } catch {
      toast.error('Failed to delete');
    }
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
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
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
                <Typography sx={{ fontSize: { xs: '1rem', sm: '1.5rem' }, lineHeight: 1 }}>👥</Typography>
              </Box>
              <Box>
                <Typography variant="h4" sx={{
                  fontWeight: 650,
                  color: 'white',
                  fontSize: { xs: '0.85rem', sm: '1rem', md: '1.3rem' },
                  lineHeight: 1.1,
                  textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  Users Management
                </Typography>
                <Typography variant="caption" sx={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: { xs: '0.5rem', sm: '0.7rem' },
                  fontWeight: 500,
                  lineHeight: 1.2,
                  display: 'block',
                  mt: 0.25
                }}>
                  Manage your users
                </Typography>
              </Box>
            </Box>

            {/* RIGHT: Warehouse + User Chips */}
            <Stack direction="row" spacing={{ xs: 0.5, sm: 0.75 }} alignItems="center">
              <Chip
                label={activeWarehouse.name}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 700,
                  height: { xs: 20, sm: 24 },
                  fontSize: { xs: '0.42rem', sm: '0.72rem' },
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
        <Box sx={{ marginBottom: 1, mt: -1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleDialogOpen()} size="small" sx={{ height: 36, fontWeight: 600, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              Add User
            </Button>
          </Box>
        </Box>

        <Paper sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
          <TableContainer sx={{ overflowX: 'auto', maxHeight: { xs: 'calc(100vh - 180px)', md: 'calc(100vh - 160px)' }, overflowY: 'auto', flex: 1 }}>
            <Table stickyHeader size="small" sx={{
              '& .MuiTableCell-root': { padding: '8px 12px', fontSize: '0.82rem', borderBottom: '1px solid #e6eef6', fontFamily: 'monospace' },
              '& .MuiTableCell-head': { background: 'linear-gradient(180deg, #e6f4e6 0%, #cdeccf 100%)', color: '#0b5e36', fontWeight: 800, borderBottom: '2px solid #b7e0b7', position: 'sticky', top: 0, zIndex: 3 }
            }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', py: 1, width: 60 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', py: 1 }}>Full Name</TableCell>
                  <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', py: 1 }}>Username</TableCell>
                  <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', py: 1 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', py: 1 }}>Phone</TableCell>
                  <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', py: 1 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', py: 1 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', py: 1 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                      <Typography color="text.secondary">No users found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user, idx) => (
                    <TableRow key={user.id} hover sx={{ background: idx % 2 === 0 ? '#ffffff' : '#fbfcfe', '&:hover': { background: '#eefbf0' } }}>
                      <TableCell sx={{ fontWeight: 700, width: 60 }}>{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{user.full_name || '-'}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email || '-'}</TableCell>
                      <TableCell>{user.phone || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.role.toUpperCase()}
                          size="small"
                          color={getRoleColor(user.role)}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <Chip label="Active" color="success" size="small" />
                        ) : (
                          <Chip label="Inactive" size="small" />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <IconButton size="small" onClick={() => handleDialogOpen(user)} title="Edit">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="primary" onClick={() => handleOpenPasswordDialog(user)} title="Change Password">
                            <KeyIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDelete(user.id)} title="Delete">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
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
                <MenuItem value="operator">Operator</MenuItem>
                <MenuItem value="qc">QC</MenuItem>
                <MenuItem value="picker">Picker</MenuItem>
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
            placeholder="Minimum 6 characters"
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
    </AppLayout >
  );
}
