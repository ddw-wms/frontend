'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, IconButton, Alert, Stack, CircularProgress
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';

// API Base URL - adjust according to your setup
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function CustomersPage() {
  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: ''
  });

  // Auth check
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(storedUser);
  }, [router]);

  // Load customers
  useEffect(() => {
    if (activeWarehouse) {
      loadCustomers();
    }
  }, [activeWarehouse]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/customers`, {
        params: { warehouseId: activeWarehouse?.id }
      });
      setCustomers(response.data);
    } catch (error: any) {
      console.error('Load customers error:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (customer?: any) => {
    if (customer) {
      setEditMode(true);
      setCurrentCustomer(customer);
      setFormData({
        name: customer.name || '',
        contact_person: customer.contact_person || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || ''
      });
    } else {
      setEditMode(false);
      setCurrentCustomer(null);
      setFormData({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: ''
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: ''
    });
    setCurrentCustomer(null);
    setEditMode(false);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Customer name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        warehouse_id: activeWarehouse?.id
      };

      if (editMode && currentCustomer) {
        // UPDATE
        await axios.put(`${API_BASE_URL}/customers/${currentCustomer.id}`, payload);
        toast.success('✓ Customer updated successfully');
      } else {
        // CREATE
        await axios.post(`${API_BASE_URL}/customers`, payload);
        toast.success('✓ Customer added successfully');
      }

      handleCloseDialog();
      loadCustomers();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to save customer';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete customer "${name}"? This action cannot be undone.`)) return;

    try {
      await axios.delete(`${API_BASE_URL}/customers/${id}`);
      toast.success('✓ Customer deleted successfully');
      loadCustomers();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to delete customer';
      toast.error(errorMsg);
    }
  };

  if (!activeWarehouse) {
    return (
      <AppLayout>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <Alert severity="warning" sx={{ maxWidth: 400 }}>
            <Typography variant="h6">⚠️ No Warehouse Selected</Typography>
            <Typography variant="body2">Please select a warehouse to continue</Typography>
          </Alert>
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Toaster position="top-right" />
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        {/* HEADER */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: 3,
            boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)'
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconButton
              onClick={() => router.back()}
              sx={{ color: 'white' }}
            >
              <BackIcon />
            </IconButton>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                👥 Customer Management
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {activeWarehouse?.name}
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* ACTION BUTTONS */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              px: 3,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 6px 20px rgba(16, 185, 129, 0.3)',
              '&:hover': {
                boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)',
                transform: 'translateY(-2px)'
              }
            }}
          >
            Add Customer
          </Button>
        </Box>

        {/* CUSTOMERS TABLE */}
        <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f5f5f5' }}>Customer Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f5f5f5' }}>Contact Person</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f5f5f5' }}>Phone</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f5f5f5' }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f5f5f5' }}>Address</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f5f5f5', textAlign: 'center' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={30} />
                      <Typography variant="body2" sx={{ mt: 1 }}>Loading customers...</Typography>
                    </TableCell>
                  </TableRow>
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="h6">📭 No customers found</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Add your first customer to get started
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                      <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        {customer.name}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {customer.contact_person || '-'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {customer.phone || '-'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {customer.email || '-'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', maxWidth: 200 }}>
                        {customer.address || '-'}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(customer)}
                            sx={{ 
                              color: '#667eea',
                              '&:hover': {
                                bgcolor: 'rgba(102, 126, 234, 0.1)'
                              }
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(customer.id, customer.name)}
                            sx={{ 
                              color: '#ef4444',
                              '&:hover': {
                                bgcolor: 'rgba(239, 68, 68, 0.1)'
                              }
                            }}
                          >
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

        {/* ADD/EDIT DIALOG */}
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
            {editMode ? '✏️ Edit Customer' : '➕ Add New Customer'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Customer Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter customer name"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <TextField
                fullWidth
                label="Contact Person"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Enter contact person name"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter phone number"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={3}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter full address"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button
              onClick={handleCloseDialog}
              disabled={saving}
              sx={{ 
                borderRadius: 2, 
                fontWeight: 700,
                px: 3
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={20} /> : null}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                px: 4,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 6px 20px rgba(102, 126, 234, 0.3)',
                '&:hover': {
                  boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)'
                },
                '&:disabled': {
                  background: 'rgba(0,0,0,0.12)'
                }
              }}
            >
              {saving ? 'Saving...' : (editMode ? 'Update' : 'Add')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AppLayout>
  );
}