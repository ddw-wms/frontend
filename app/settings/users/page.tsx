'use client';

import { useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Paper, Typography, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Chip, IconButton, AppBar, Toolbar, Stack,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { usersAPI } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';

export default function UsersPage() {
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

  return (
    <AppLayout>
      <Toaster position="top-center" />
      <AppBar position="static" elevation={0} sx={{ bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar>
          <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
            👥 Users Management
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleDialogOpen()}>
            Add User
          </Button>
        </Toolbar>
      </AppBar>

      <Paper sx={{ m: 3, p: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx ={{fontWeight: "bold"}}>#</TableCell>
                <TableCell sx ={{fontWeight: "bold"}} >Full Name</TableCell>
                <TableCell sx ={{fontWeight: "bold"}} >Username</TableCell>
                <TableCell sx ={{fontWeight: "bold"}} >Email</TableCell>
                <TableCell sx ={{fontWeight: "bold"}} >Phone</TableCell>
                <TableCell sx ={{fontWeight: "bold"}} >Role</TableCell>
                <TableCell sx ={{fontWeight: "bold"}} >Status</TableCell>
                <TableCell sx ={{fontWeight: "bold"}} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length > 0 ? (
                users.map((user, idx) => (
                  <TableRow key={user.id} hover>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>{user.full_name || '-'}</TableCell>
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
                        <IconButton size="small" color="error" onClick={() => handleDelete(user.id)} title="Delete">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">No users found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

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
    </AppLayout>
  );
}
