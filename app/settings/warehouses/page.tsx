'use client';

import { useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, 
  TextField, Paper, Typography, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Chip, IconButton, AppBar, Toolbar, Stack
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Done as DoneIcon } from '@mui/icons-material';
import { warehousesAPI } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { useWarehouse } from '@/app/context/WarehouseContext';
import toast, { Toaster } from 'react-hot-toast';

export default function WarehousesPage() {
  const { activeWarehouse, setActiveWarehouse } = useWarehouse();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: '', city: '', code: '', address: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const loadWarehouses = async () => {
    try {
      const res = await warehousesAPI.getAll();
      setWarehouses(res.data);
    } catch (e) {
      toast.error('Failed to load warehouses');
    }
  };

  useEffect(() => { 
    loadWarehouses(); 
  }, []);

  const handleDialogOpen = (item?: any) => {
    setEditItem(item || null);
    setForm(item || { name: '', city: '', code: '', address: '', phone: '' });
    setOpenDialog(true);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    setEditItem(null);
    setForm({ name: '', city: '', code: '', address: '', phone: '' });
  };

  const handleSave = async () => {
    if (!form.name || !form.code) {
      toast.error('Name and Code are required');
      return;
    }

    try {
      setLoading(true);
      if (editItem) {
        await warehousesAPI.update(editItem.id, form);
        toast.success('✓ Warehouse updated');
      } else {
        await warehousesAPI.create(form);
        toast.success('✓ Warehouse created');
      }
      handleDialogClose();
      loadWarehouses();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error saving warehouse');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure? This will delete the warehouse.')) return;
    try {
      await warehousesAPI.delete(id);
      loadWarehouses();
      toast.success('✓ Warehouse deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleSetActive = async (warehouse: any) => {
    try {
      setActiveWarehouse(warehouse);
      toast.success(`✓ ${warehouse.name} is now active`);
    } catch (e) {
      toast.error('Failed to set active');
    }
  };

  return (
    <AppLayout>
      <Toaster position="top-center" />
      <AppBar position="static" elevation={0} sx={{ bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar>
          <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
            🏭 Warehouses Management
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleDialogOpen()}>
            Add Warehouse
          </Button>
        </Toolbar>
      </AppBar>

      <Paper sx={{ m: 3, p: 3 }}>
        {/* Active Warehouse Display */}
        {activeWarehouse && (
          <Box sx={{ mb: 3, p: 2, bgcolor: '#e3f2fd', borderRadius: 1, border: '2px solid #1976d2' }}>
            <Typography variant="body2" color="text.secondary">
              Currently Active Warehouse:
            </Typography>
            <Typography variant="h6" fontWeight="bold" color="primary">
              🔵 {activeWarehouse.name} ({activeWarehouse.code})
            </Typography>
          </Box>
        )}

        <TableContainer>
          <Table>

            <TableHead>
     <TableRow sx={{ bgcolor: 'grey.100' }}>
     <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
     <TableCell sx={{ fontWeight: 'bold' }}>City</TableCell>
     <TableCell sx={{ fontWeight: 'bold' }}>Code</TableCell>
     <TableCell sx={{ fontWeight: 'bold' }}>Address</TableCell>
     <TableCell sx={{ fontWeight: 'bold' }}>Phone</TableCell>
     <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
     <TableCell sx={{ fontWeight: 'bold' }} align="center">
      Actions
     </TableCell>
     </TableRow>
     </TableHead>


            <TableBody>
              {warehouses.length > 0 ? (
                warehouses.map(w => (
                  <TableRow 
                    key={w.id}
                    sx={{ 
                      bgcolor: activeWarehouse?.id === w.id ? '#e3f2fd' : 'transparent',
                      '&:hover': { bgcolor: '#f5f5f5' }
                    }}
                  >
                    <TableCell sx={{ fontWeight: activeWarehouse?.id === w.id ? 'bold' : 'normal' }}>
                      {activeWarehouse?.id === w.id && '🔵 '}{w.name}
                    </TableCell>
                    <TableCell>{w.city || '-'}</TableCell>
                    <TableCell><Chip label={w.code} size="small" /></TableCell>
                    <TableCell>{w.address || '-'}</TableCell>
                    <TableCell>{w.phone || '-'}</TableCell>
                    <TableCell>
                      {activeWarehouse?.id === w.id ? (
                        <Chip label="ACTIVE" color="success" size="small" />
                      ) : (
                        <Chip label="Inactive" size="small" />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <IconButton size="small" onClick={() => handleDialogOpen(w)} title="Edit">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(w.id)} title="Delete">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        {activeWarehouse?.id !== w.id && (
                          <Button 
                            size="small" 
                            variant="outlined" 
                            color="success"
                            onClick={() => handleSetActive(w)}
                          >
                            Set Active
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">No warehouses found. Create one!</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight="bold">
          {editItem ? '✏️ Edit Warehouse' : '➕ Add New Warehouse'}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Warehouse Name *"
              fullWidth
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Mumbai Warehouse"
            />
            <TextField
              label="Code *"
              fullWidth
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
              placeholder="e.g., MUM01"
            />
            <TextField
              label="City"
              fullWidth
              value={form.city}
              onChange={e => setForm({ ...form, city: e.target.value })}
              placeholder="e.g., Mumbai"
            />
            <TextField
              label="Address"
              fullWidth
              multiline
              rows={2}
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              placeholder="Full address"
            />
            <TextField
              label="Phone"
              fullWidth
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g., 9876543210"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSave} 
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Warehouse'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
