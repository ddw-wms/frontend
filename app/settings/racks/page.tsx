// File Path = warehouse-frontend\app\settings\racks\page.tsx
'use client';

import { Upload as UploadIcon, GetApp as DownloadIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Stack, useMediaQuery, useTheme, CircularProgress, Card, CardContent
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  ToggleOn as ToggleOnIcon, ToggleOff as ToggleOffIcon
} from '@mui/icons-material';
import { rackAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';
import { usePermissionGuard } from '@/hooks/usePermissionGuard';
import { usePermissions } from '@/app/context/PermissionsContext';

export default function RacksPage() {
  // Role guard - only admin can access
  usePermissionGuard('view_racks');

  // Permission checks
  const { hasPermission } = usePermissions();

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [confirmDownloadOpen, setConfirmDownloadOpen] = useState(false);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState({ show: false, total: 0, successCount: 0, errorCount: 0, batchId: '' });
  const [bulkErrors, setBulkErrors] = useState<any[]>([]);
  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [user, setUser] = useState<any>(null);
  const [racks, setRacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRack, setEditingRack] = useState<any>(null);
  const [formData, setFormData] = useState({


    rack_name: '',
    rack_type: 'Standard',
    capacity: '',
    location: ''
  });

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(storedUser);
  }, [router]);

  useEffect(() => {
    if (activeWarehouse) {
      loadRacks();
    }
  }, [activeWarehouse]);

  const loadRacks = async () => {
    setLoading(true);
    try {
      const response = await rackAPI.getAll(activeWarehouse?.id);
      setRacks(response.data || []);
    } catch (error) {
      toast.error('Failed to load racks');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (rack?: any) => {
    if (rack) {
      setEditingRack(rack);
      setFormData({
        rack_name: rack.rack_name,
        rack_type: rack.rack_type,
        capacity: rack.capacity,
        location: rack.location
      });
    } else {
      setEditingRack(null);
      setFormData({
        rack_name: '',
        rack_type: 'Standard',
        capacity: '',
        location: ''
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRack(null);
  };

  const handleSubmit = async () => {
    if (!formData.rack_name) {
      toast.error('Rack name is required');
      return;
    }

    try {
      if (editingRack) {
        await rackAPI.update(editingRack.id, formData);
        toast.success('Rack updated successfully');
      } else {
        await rackAPI.create({
          ...formData,
          warehouse_id: activeWarehouse?.id
        });
        toast.success('Rack created successfully');
      }
      handleCloseDialog();
      loadRacks();
    } catch (error) {
      toast.error('Failed to save rack');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rack?')) return;

    try {
      await rackAPI.delete(id);
      toast.success('Rack deleted successfully');
      loadRacks();
    } catch (error) {
      toast.error('Failed to delete rack');
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      await rackAPI.toggleStatus(id);
      toast.success('Rack status updated');
      loadRacks();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  if (!activeWarehouse) {
    return (
      <AppLayout>
        <Box
          sx={{
            p: 6,
            textAlign: 'center',
            minHeight: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              p: 5,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 4,
              color: 'white',
              boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4)',
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              ⚠️ No active warehouse selected.
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Please go to Settings → Warehouses to set one.
            </Typography>
          </Box>
        </Box>
      </AppLayout>
    );
  }

  const doDownloadTemplate = () => {
    const template = [
      {
        RACK_NAME: 'A-01',
        RACK_TYPE: 'Standard',
        CAPACITY: '100',
        LOCATION: 'Floor 1, Section A'
      },
      {
        RACK_NAME: 'B-01',
        RACK_TYPE: 'Heavy',
        CAPACITY: '50',
        LOCATION: 'Floor 1, Section B'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Rack_Bulk_Upload_Template.xlsx');
    toast.success('Template downloaded');
  };

  const downloadTemplate = () => setConfirmDownloadOpen(true);
  const handleConfirmDownload = () => {
    doDownloadTemplate();
    setConfirmDownloadOpen(false);
  };

  const exportRacks = () => {
    if (!racks || racks.length === 0) {
      toast('No racks to export');
      return;
    }
    const data = racks.map((r) => ({
      RACK_NAME: r.rack_name,
      RACK_TYPE: r.rack_type,
      CAPACITY: r.capacity,
      LOCATION: r.location,
      STATUS: r.is_active ? 'Active' : 'Inactive'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Racks');
    XLSX.writeFile(wb, `Racks_${activeWarehouse?.name || 'warehouse'}.xlsx`);
    toast.success('Exported racks');
  };
  const handleBulkUpload = async () => {
    if (!bulkFile) {
      toast.error('Please select a file');
      return;
    }

    const uploadData = new FormData();
    uploadData.append('file', bulkFile);
    uploadData.append('warehouse_id', activeWarehouse?.id?.toString() || '');

    setBulkUploading(true);
    try {
      const response = await rackAPI.bulkUpload(uploadData);
      const data = response.data || {};
      setBulkResult({
        show: true,
        total: data.totalRows || data.total || 0,
        successCount: data.successCount || 0,
        errorCount: data.errorCount || 0,
        batchId: data.batchId || ''
      });
      setBulkErrors(data.errors || []);
      toast.success(`✓ ${data.successCount || 0} racks uploaded successfully!`);
      setBulkFile(null);
      setBulkDialogOpen(true);
      const input = document.getElementById('bulk-rack-upload') as HTMLInputElement | null;
      if (input) input.value = '';
      loadRacks();
    } catch (error) {
      toast.error('Bulk upload failed');
    } finally {
      setBulkUploading(false);
    }
  };

  /////////////////////////////////// UI RENDER ///////////////////////////////////
  return (
    <AppLayout>
      <Toaster position="top-center" />
      <Box sx={{
        p: { xs: 0.75, md: 1 },
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        minHeight: { xs: 'calc(100vh - 60px)', md: '100%' },
        width: '100%',
        display: 'flex',
        flex: { md: 1 },
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'auto',
        pb: { xs: 0.5, md: 0 }
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
                <Typography sx={{ fontSize: { xs: '1rem', sm: '1.5rem' }, lineHeight: 1 }}>🏗️</Typography>
              </Box>
              <Box>
                <Typography variant="h4" sx={{
                  fontWeight: 650,
                  color: 'white',
                  fontSize: { xs: '0.85rem', sm: '1rem', md: '1.3rem' },
                  lineHeight: 1.1,
                  textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  Rack Management
                </Typography>
                <Typography variant="caption" sx={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: { xs: isMobile ? '0.5rem' : '0.2rem', sm: '0.7rem' },
                  fontWeight: 500,
                  lineHeight: 1.2,
                  display: 'block',
                  mt: 0.25
                }}>
                  Manage your warehouse racks
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
            </Stack>
          </Box>
        </Box>
        <Box sx={{ marginBottom: 1.5, mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center', overflowX: 'auto', whiteSpace: 'nowrap', pb: { xs: 0.5, sm: 0 } }}>
            <Button
              variant="contained"
              startIcon={<AddIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />}
              size="small"
              onClick={() => handleOpenDialog()}
              sx={{ height: { xs: 32, sm: 40 }, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.7rem', sm: '0.9rem' } }}
            >
              {isMobile ? 'Add' : 'Add Rack'}
            </Button>

            <Button
              variant="outlined"
              startIcon={<DownloadIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />}
              onClick={downloadTemplate}
              size="small"
              sx={{ height: { xs: 32, sm: 36 }, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.66rem', sm: '0.82rem' } }}
            >
              {isMobile ? 'Template' : 'Download Template'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />}
              size="small"
              sx={{ height: { xs: 32, sm: 36 }, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.66rem', sm: '0.82rem' }, ml: 1 }}
              onClick={() => setBulkDialogOpen(true)}>
              {isMobile ? 'Bulk' : 'Bulk Upload'}
            </Button>

            <Button
              variant="outlined"
              startIcon={<DownloadIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />}
              size="small"
              sx={{ height: { xs: 32, sm: 36 }, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.66rem', sm: '0.82rem' }, ml: 0.5 }}
              onClick={() => setExportConfirmOpen(true)}
              disabled={racks.length === 0}
            >
              Export
            </Button>
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, border: '1px solid #d1d5db', position: 'relative' }}>
          <TableContainer component={Paper} sx={{ borderRadius: 0, boxShadow: 'none', border: 'none', background: '#ffffff', height: '100%' }}>
            <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { borderRight: '1px solid #d1d5db', padding: '6px 10px', fontSize: '0.75rem' } }}>
              <TableHead>
                <TableRow sx={{ background: '#e5e7eb' }}>
                  <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 150 }}>RACK NAME</TableCell>
                  <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 120 }}>TYPE</TableCell>
                  <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 100 }}>CAPACITY</TableCell>
                  <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 200 }}>LOCATION</TableCell>
                  <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 100 }}>STATUS</TableCell>
                  <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 120, textAlign: 'center' }}>ACTIONS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                      <CircularProgress size={50} />
                    </TableCell>
                  </TableRow>
                ) : racks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                      <Typography sx={{ fontWeight: 700, color: '#94a3b8' }}>📭 No racks found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  racks.map((rack, idx) => (
                    <TableRow key={rack.id} sx={{ bgcolor: idx % 2 === 0 ? '#ffffff' : '#f9fafb', '&:hover': { bgcolor: '#f0f0f0' } }}>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{rack.rack_name}</TableCell>
                      <TableCell sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{rack.rack_type}</TableCell>
                      <TableCell sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{rack.capacity || '-'}</TableCell>
                      <TableCell sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{rack.location || '-'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Chip
                          label={rack.is_active ? 'Active' : 'Inactive'}
                          color={rack.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(rack)}
                            sx={{ color: '#667eea', p: 0.5, '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.1)' } }}
                          >
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(rack.id)}
                            sx={{ color: '#ef4444', p: 0.5, '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
                          >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleStatus(rack.id)}
                            sx={{ color: rack.is_active ? '#10b981' : '#6b7280', p: 0.5, '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' } }}
                          >
                            {rack.is_active ? <ToggleOnIcon sx={{ fontSize: 20 }} /> : <ToggleOffIcon sx={{ fontSize: 20 }} />}
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRack ? 'Edit Rack' : 'Add New Rack'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Rack Name *"
              value={formData.rack_name}
              onChange={(e) => setFormData({ ...formData, rack_name: e.target.value })}
              placeholder="e.g., A-01, B-15"
              required
            />
            <TextField
              select
              label="Rack Type"
              value={formData.rack_type}
              onChange={(e) => setFormData({ ...formData, rack_type: e.target.value })}
            >
              <MenuItem value="Standard">Standard</MenuItem>
              <MenuItem value="Heavy">Heavy</MenuItem>
              <MenuItem value="Bulk">Bulk</MenuItem>
              <MenuItem value="Cold">Cold Storage</MenuItem>
            </TextField>
            <TextField
              label="Capacity"
              type="number"
              inputProps={{ min: 0 }}
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              placeholder="e.g., 100"
            />
            <TextField
              label="Location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Floor 1, Section A"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingRack ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* BULK UPLOAD DIALOG */}
      <Dialog open={bulkDialogOpen} onClose={() => setBulkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Bulk Upload Racks</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box sx={{ border: '2px dashed #cbd5e1', borderRadius: 2, p: 3, textAlign: 'center', background: '#f8fafc', cursor: 'pointer' }}>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
                id="bulk-rack-upload"
              />
              <label htmlFor="bulk-rack-upload" style={{ display: 'block', cursor: 'pointer' }}>
                <UploadIcon sx={{ fontSize: 40, color: '#667eea', mb: 1 }} />
                <Typography sx={{ fontWeight: 700 }}>{bulkFile?.name || 'Click to choose a file'}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>Accepts .xlsx or .xls</Typography>
              </label>
            </Box>

            <Button
              variant="contained"
              onClick={handleBulkUpload}
              disabled={!bulkFile || bulkUploading}
              startIcon={bulkUploading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <UploadIcon />}
              sx={{ py: 1.25, fontWeight: 700 }}
            >
              {bulkUploading ? 'Processing...' : 'Upload and Process'}
            </Button>

            {bulkResult.show && (
              <Card sx={{ borderRadius: 1.25, border: '1px solid #e6eef6', background: '#fbfdff' }}>
                <CardContent>
                  <Typography sx={{ fontWeight: 700, mb: 1 }}>Upload Result</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Total</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{bulkResult.total}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="success.main">Success</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>{bulkResult.successCount}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="error.main">Errors</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main' }}>{bulkResult.errorCount}</Typography>
                  </Box>
                  {bulkErrors.length > 0 && (
                    <Button size="small" color="error" variant="outlined" sx={{ mt: 1 }} onClick={() => { navigator.clipboard?.writeText(JSON.stringify(bulkErrors)); toast('Errors copied to clipboard'); }}>
                      Copy Errors
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* DOWNLOAD TEMPLATE CONFIRMATION DIALOG */}
      <Dialog open={confirmDownloadOpen} onClose={() => setConfirmDownloadOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Download</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#334155' }}>Do you want to download the racks bulk upload template?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDownloadOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmDownload} sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>Yes, Download</Button>
        </DialogActions>
      </Dialog>

      {/* EXPORT CONFIRMATION DIALOG */}
      <Dialog open={exportConfirmOpen} onClose={() => setExportConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Export</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#334155' }}>Are you sure you want to export <strong>{racks.length}</strong> rack{racks.length !== 1 ? 's' : ''} for <strong>{activeWarehouse?.name}</strong> to Excel?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => { exportRacks(); setExportConfirmOpen(false); }} sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>Yes, Export</Button>
        </DialogActions>
      </Dialog>

    </AppLayout >
  );
}
