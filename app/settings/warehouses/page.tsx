// File Path = warehouse-frontend\app\settings\warehouses\page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Paper, Typography, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Chip, IconButton, AppBar, Toolbar, Stack, useMediaQuery, useTheme
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Done as DoneIcon, FilterList as FilterListIcon } from '@mui/icons-material';
import { warehousesAPI } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { useWarehouse } from '@/app/context/WarehouseContext';
import toast, { Toaster } from 'react-hot-toast';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { ArrowBack as BackIcon, Download as DownloadIcon, Refresh as RefreshIcon } from '@mui/icons-material';

export default function WarehousesPage() {
  // Role guard - only admin can access
  useRoleGuard(['admin']);

  const { activeWarehouse, setActiveWarehouse } = useWarehouse();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterCity, setFilterCity] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: '', city: '', code: '', address: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [user, setUser] = useState<any>(null);

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

  const handleExport = () => {
    if (!warehouses || warehouses.length === 0) {
      toast.error('No warehouses to export');
      return;
    }
    try {
      const headers = ['Name', 'City', 'Code', 'Address', 'Phone', 'Status'];
      const rows = warehouses.map(w => [
        w.name || '',
        w.city || '',
        w.code || '',
        w.address || '',
        w.phone || '',
        activeWarehouse?.id === w.id ? 'ACTIVE' : 'Inactive'
      ]);
      const csv = [headers, ...rows]
        .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'warehouses.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('✓ Exported warehouses');
    } catch (e) {
      toast.error('Failed to export');
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  //////////////////////////////////// UI RENDER ////////////////////////////////////
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
          zIndex: 1000,
          mb: 0,
          px: 2,
          py: 1.25,
          pl: { xs: '54px', sm: 2 },
          background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
          borderRadius: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
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
                <Typography sx={{ fontSize: { xs: '1rem', sm: '1.5rem' }, lineHeight: 1 }}>🏭</Typography>
              </Box>
              <Box>
                <Typography variant="h4" sx={{
                  fontWeight: 650,
                  color: 'white',
                  fontSize: { xs: '0.85rem', sm: '1rem', md: '1.3rem' },
                  lineHeight: 1.1,
                  textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  Warehouses
                </Typography>
                <Typography variant="caption" sx={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: { xs: isMobile ? '0.5rem' : '0.2rem', sm: '0.7rem' },
                  fontWeight: 500,
                  lineHeight: 1.2,
                  display: 'block',
                  mt: 0.25
                }}>
                  Manage your warehouses
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
        <Box sx={{ marginBottom: 1.5, mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button variant="contained"
              startIcon={<AddIcon />} onClick={() => handleDialogOpen()}
              size="small" sx={{
                height: 36,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              }}
            >Add Warehouse
            </Button>
          </Box>
        </Box>

        <TableContainer>
          <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { padding: '6px 10px', fontSize: '0.75rem' } }}>
            <TableHead>
              <TableRow sx={{ background: '#e5e7eb' }}>
                <TableCell sx={{ color: '#1f2937', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8 }}>NAME</TableCell>
                <TableCell sx={{ color: '#1f2937', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8 }}>CITY</TableCell>
                <TableCell sx={{ color: '#1f2937', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8 }}>CODE</TableCell>
                <TableCell sx={{ color: '#1f2937', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8 }}>ADDRESS</TableCell>
                <TableCell sx={{ color: '#1f2937', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8 }}>PHONE</TableCell>
                <TableCell sx={{ color: '#1f2937', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8 }}>STATUS</TableCell>
                <TableCell sx={{ color: '#1f2937', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8 }} align="center">
                  ACTIONS
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
      </Box>
    </AppLayout>
  );
}
