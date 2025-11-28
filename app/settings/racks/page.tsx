'use client';

import { Upload as UploadIcon, GetApp as DownloadIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Stack
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

export default function RacksPage() {

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
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
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            ⚠️ No active warehouse selected
          </Typography>
        </Box>
      </AppLayout>
    );
  }

    const downloadTemplate = () => {
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

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      toast.error('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', bulkFile);
    formData.append('warehouse_id', activeWarehouse?.id?.toString() || '');

    setBulkUploading(true);
    try {
      const response = await rackAPI.bulkUpload(formData);
      toast.success(`✓ ${response.data.successCount} racks uploaded successfully!`);
      setBulkFile(null);
      loadRacks();
    } catch (error) {
      toast.error('Bulk upload failed');
    } finally {
      setBulkUploading(false);
    }
  };


  return (
    <AppLayout>
      <Toaster position="top-center" />

      <Box sx={{ p: 3 }}>
        
        
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight="bold">
            🏗️ Rack Management - {activeWarehouse.name}
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={downloadTemplate}
              size="small"
            >
              Download Template
            </Button>
            
            <input
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              id="bulk-rack-upload"
              type="file"
              onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="bulk-rack-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<UploadIcon />}
                size="small"
              >
                Choose File
              </Button>
            </label>

            {bulkFile && (
              <Button
                variant="contained"
                color="secondary"
                onClick={handleBulkUpload}
                disabled={bulkUploading}
                size="small"
              >
                {bulkUploading ? 'Uploading...' : `Upload ${bulkFile.name}`}
              </Button>
            )}

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Rack
            </Button>
          </Stack>
        </Stack>


        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: '#1976d2', color: 'white', fontWeight: 'bold' }}>Rack Name</TableCell>
                  <TableCell sx={{ bgcolor: '#1976d2', color: 'white', fontWeight: 'bold' }}>Type</TableCell>
                  <TableCell sx={{ bgcolor: '#1976d2', color: 'white', fontWeight: 'bold' }}>Capacity</TableCell>
                  <TableCell sx={{ bgcolor: '#1976d2', color: 'white', fontWeight: 'bold' }}>Location</TableCell>
                  <TableCell sx={{ bgcolor: '#1976d2', color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ bgcolor: '#1976d2', color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {racks.map((rack) => (
                  <TableRow key={rack.id} hover>
                    <TableCell sx={{ fontWeight: 'bold' }}>{rack.rack_name}</TableCell>
                    <TableCell>{rack.rack_type}</TableCell>
                    <TableCell>{rack.capacity || '-'}</TableCell>
                    <TableCell>{rack.location || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={rack.is_active ? 'Active' : 'Inactive'}
                        color={rack.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <IconButton size="small" color="primary" onClick={() => handleOpenDialog(rack)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(rack.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleToggleStatus(rack.id)}>
                          {rack.is_active ? <ToggleOnIcon color="success" /> : <ToggleOffIcon />}
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

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
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                placeholder="e.g., 100 units"
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
      </Box>
    </AppLayout>
  );
}
