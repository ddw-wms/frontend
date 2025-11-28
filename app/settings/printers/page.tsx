'use client';

import { useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Paper, Typography, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Chip, IconButton, AppBar, Toolbar, Stack,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Grid, Card, CardContent, Alert
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Print as PrintIcon } from '@mui/icons-material';
import { warehousesAPI } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { useWarehouse } from '@/app/context/WarehouseContext';
import toast, { Toaster } from 'react-hot-toast';

export default function PrinterSettingsPage() {
  const { activeWarehouse, warehouseId } = useWarehouse();
  const [printers, setPrinters] = useState<any[]>([
    {
      id: 1,
      warehouse_id: 1,
      name: 'WSN Printer 1',
      type: 'thermal',
      ip_address: '192.168.1.100',
      port: 9100,
      auto_print_wsn: true,
      auto_print_batch: false,
      copies: 1,
      status: 'active'
    },
    {
      id: 2,
      warehouse_id: 1,
      name: 'Label Printer 2',
      type: 'inkjet',
      ip_address: '192.168.1.101',
      port: 9100,
      auto_print_wsn: false,
      auto_print_batch: true,
      copies: 2,
      status: 'active'
    }
  ]);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'thermal',
    ip_address: '',
    port: 9100,
    auto_print_wsn: true,
    auto_print_batch: false,
    copies: 1
  });
  const [loading, setLoading] = useState(false);

  const handleDialogOpen = (item?: any) => {
    setEditItem(item || null);
    setForm(item ? {
      name: item.name,
      type: item.type,
      ip_address: item.ip_address,
      port: item.port,
      auto_print_wsn: item.auto_print_wsn,
      auto_print_batch: item.auto_print_batch,
      copies: item.copies
    } : {
      name: '',
      type: 'thermal',
      ip_address: '',
      port: 9100,
      auto_print_wsn: true,
      auto_print_batch: false,
      copies: 1
    });
    setOpenDialog(true);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    setEditItem(null);
  };

  const handleSave = async () => {
    if (!form.name || !form.ip_address) {
      toast.error('Name and IP Address required');
      return;
    }

    setLoading(true);
    try {
      if (editItem) {
        setPrinters(printers.map(p => p.id === editItem.id ? { ...p, ...form } : p));
        toast.success('✓ Printer updated');
      } else {
        setPrinters([...printers, { id: Date.now(), warehouse_id: warehouseId, ...form, status: 'active' }]);
        toast.success('✓ Printer added');
      }
      handleDialogClose();
    } catch (e) {
      toast.error('Error saving printer');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this printer?')) return;
    setPrinters(printers.filter(p => p.id !== id));
    toast.success('✓ Printer deleted');
  };

  const handleTestPrint = (printer: any) => {
    toast.success(`✓ Test print sent to ${printer.name}`);
  };

  const filteredPrinters = warehouseId ? printers.filter(p => p.warehouse_id === warehouseId) : [];

  if (!activeWarehouse) {
    return (
      <AppLayout>
        <AppBar position="static" elevation={0}><Toolbar>
          <Typography variant="h6" fontWeight="bold">🖨️ Printer Settings</Typography>
        </Toolbar></AppBar>
        <Box sx={{ m: 3 }}>
          <Alert severity="warning">
            ⚠️ No active warehouse selected. Please go to Settings → Warehouses to set one.
          </Alert>
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Toaster position="top-center" />
      <AppBar position="static" elevation={0} sx={{ bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar>
          <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
            🖨️ Printer Settings
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleDialogOpen()}>
            Add Printer
          </Button>
        </Toolbar>
      </AppBar>

      <Paper sx={{ m: 3, p: 3 }}>
        {/* Warehouse Info */}
        <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Printers for Warehouse:
          </Typography>
          <Typography variant="h6" fontWeight="bold">
            🏭 {activeWarehouse.name}
          </Typography>
        </Box>

                {/* Quick Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography color="text.secondary" gutterBottom>
                Total Printers
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {filteredPrinters.length}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography color="text.secondary" gutterBottom>
                Active
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">
                {filteredPrinters.filter(p => p.status === 'active').length}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography color="text.secondary" gutterBottom>
                WSN Auto Print
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="primary.main">
                {filteredPrinters.filter(p => p.auto_print_wsn).length}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography color="text.secondary" gutterBottom>
                Batch Auto Print
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="warning.main">
                {filteredPrinters.filter(p => p.auto_print_batch).length}
              </Typography>
            </CardContent>
          </Card>
        </Box>


        {/* Printers Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx ={{ fontWeight:"bold"}} >Name</TableCell>
                <TableCell sx ={{ fontWeight:"bold"}}>Type</TableCell>
                <TableCell sx ={{ fontWeight:"bold"}}>IP Address</TableCell>
                <TableCell sx ={{ fontWeight:"bold"}}>Port</TableCell>
                <TableCell sx ={{ fontWeight:"bold"}}>WSN Auto</TableCell>
                <TableCell sx ={{ fontWeight:"bold"}}>Batch Auto</TableCell>
                <TableCell sx ={{ fontWeight:"bold"}}>Status</TableCell>
                <TableCell sx ={{ fontWeight:"bold"}} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPrinters.length > 0 ? (
                filteredPrinters.map((printer) => (
                  <TableRow key={printer.id} hover>
                    <TableCell sx={{ fontWeight: 'bold' }}>{printer.name}</TableCell>
                    <TableCell>
                      <Chip label={printer.type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{printer.ip_address}</TableCell>
                    <TableCell>{printer.port}</TableCell>
                    <TableCell>
                      {printer.auto_print_wsn ? <Chip label="Yes" size="small" color="success" /> : <Chip label="No" size="small" />}
                    </TableCell>
                    <TableCell>
                      {printer.auto_print_batch ? <Chip label="Yes" size="small" color="success" /> : <Chip label="No" size="small" />}
                    </TableCell>
                    <TableCell>
                      <Chip label={printer.status} color="success" size="small" />
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <IconButton size="small" onClick={() => handleTestPrint(printer)} title="Test Print" color="primary">
                          <PrintIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDialogOpen(printer)} title="Edit">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(printer.id)} title="Delete">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">No printers configured yet</Typography>
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
          {editItem ? '✏️ Edit Printer' : '➕ Add New Printer'}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Printer Name *"
              fullWidth
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., WSN Printer 1"
            />
            <FormControl fullWidth>
              <InputLabel>Printer Type</InputLabel>
              <Select
                value={form.type}
                label="Printer Type"
                onChange={e => setForm({ ...form, type: e.target.value })}
              >
                <MenuItem value="thermal">Thermal</MenuItem>
                <MenuItem value="inkjet">Inkjet</MenuItem>
                <MenuItem value="laser">Laser</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="IP Address *"
              fullWidth
              value={form.ip_address}
              onChange={e => setForm({ ...form, ip_address: e.target.value })}
              placeholder="e.g., 192.168.1.100"
            />
            <TextField
              label="Port"
              fullWidth
              type="number"
              value={form.port}
              onChange={e => setForm({ ...form, port: Number(e.target.value) })}
            />
            <TextField
              label="Copies"
              fullWidth
              type="number"
              inputProps={{ min: 1, max: 10 }}
              value={form.copies}
              onChange={e => setForm({ ...form, copies: Number(e.target.value) })}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.auto_print_wsn}
                  onChange={e => setForm({ ...form, auto_print_wsn: e.target.checked })}
                />
              }
              label="Auto Print WSN Stickers"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.auto_print_batch}
                  onChange={e => setForm({ ...form, auto_print_batch: e.target.checked })}
                />
              }
              label="Auto Print Batch Reports"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Printer'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
