// File Path = warehouse-frontend/app/customers/page.tsx
//File Path= warehouse-frontend\app\customers\page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, IconButton, Alert, Stack, CircularProgress,
  Card, CardContent, Chip, useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { FilterList as FilterListIcon } from '@mui/icons-material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  ArrowBack as BackIcon, Download as DownloadIcon, Refresh as RefreshIcon
} from '@mui/icons-material';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import StandardPageLayout from '@/components/StandardPageLayout';

import toast, { Toaster } from 'react-hot-toast';
import { customerAPI } from '@/lib/api';
import { useRoleGuard } from '@/hooks/useRoleGuard';

export default function CustomersPage() {
  // Role guard - only admin, manager, operator can access
  useRoleGuard(['admin', 'manager', 'operator']);

  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [user, setUser] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterContact, setFilterContact] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: ''
  });

  // Filter customers based on search query - memoized for performance
  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter((customer) => (
      customer.name?.toLowerCase().includes(query) ||
      customer.contact_person?.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.address?.toLowerCase().includes(query)
    ));
  }, [customers, searchQuery]);

  // Auth check
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(storedUser);
  }, [router]);

  // Load customers - deferred for faster initial render
  useEffect(() => {
    if (activeWarehouse) {
      // Defer API call slightly to allow page to render first
      const timer = setTimeout(() => {
        loadCustomers();
      }, 0);
      return () => clearTimeout(timer);
    } else {
      setLoading(false);
    }
  }, [activeWarehouse]);

  const loadCustomers = async () => {
    if (!activeWarehouse?.id) return;
    setLoading(true);
    try {
      const response = await customerAPI.getAll(activeWarehouse.id);
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
        await customerAPI.update(currentCustomer.id, payload);
        toast.success('✓ Customer updated successfully');
      } else {
        // CREATE
        await customerAPI.create(payload);
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
      await customerAPI.delete(id);
      toast.success('✓ Customer deleted successfully');
      loadCustomers();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to delete customer';
      toast.error(errorMsg);
    }
  };

  const handleExport = () => {
    if (customers.length === 0) {
      toast.error('No customers to export');
      return;
    }

    try {
      // Create CSV content
      const headers = ['Customer Name', 'Contact Person', 'Phone', 'Email', 'Address'];
      const csvContent = [
        headers.join(','),
        ...customers.map((customer) =>
          [
            `"${customer.name || ''}"`,
            `"${customer.contact_person || ''}"`,
            `"${customer.phone || ''}"`,
            `"${customer.email || ''}"`,
            `"${customer.address || ''}"`
          ].join(',')
        )
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `customers_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('✓ Customers exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export customers');
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

  /////////////////////////////////// UI RENDER ///////////////////////////////////
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
                  Customers
                </Typography>
                <Typography variant="caption" sx={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: { xs: isMobile ? '0.5rem' : '0.2rem', sm: '0.7rem' },
                  fontWeight: 500,
                  lineHeight: 1.2,
                  display: 'block',
                  mt: 0.25
                }}>
                  Manage your customers
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

        {/* Action Buttons */}
        <Box sx={{ 
          mb: 1.5, 
          mt: 1.5, 
          px: 1,
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} variant="contained" onClick={() => handleOpenDialog()} sx={{ height: 36, fontSize: '0.75rem', fontWeight: 600, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              ADD
            </Button>
            <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 14 }} />} variant="contained" onClick={handleExport} sx={{ height: 36, fontSize: '0.75rem', fontWeight: 600, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              EXPORT
            </Button>
            <Button size="small" startIcon={<RefreshIcon sx={{ fontSize: 14 }} />} variant="outlined" onClick={loadCustomers} sx={{ height: 36, fontSize: '0.75rem', fontWeight: 600 }}>
              REFRESH
            </Button>
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, border: '1px solid #d1d5db', position: 'relative' }}>
          <TableContainer component={Paper} sx={{ borderRadius: 0, boxShadow: 'none', border: 'none', background: '#ffffff', height: '100%' }}>
            <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { borderRight: '1px solid #d1d5db', padding: '6px 10px', fontSize: '0.75rem' } }}>
              <TableHead>
                <TableRow sx={{ background: '#e5e7eb' }}>
                  <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 180 }}>CUSTOMER NAME</TableCell>
                  <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 150 }}>CONTACT PERSON</TableCell>
                  <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 130 }}>PHONE</TableCell>
                  <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 180 }}>EMAIL</TableCell>
                  <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap', minWidth: 250 }}>ADDRESS</TableCell>
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
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                      <Typography sx={{ fontWeight: 700, color: '#94a3b8' }}>📭 No customers found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer, idx) => (
                    <TableRow key={customer.id} sx={{ bgcolor: idx % 2 === 0 ? '#ffffff' : '#f9fafb', '&:hover': { bgcolor: '#f0f0f0' } }}>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {customer.name || '-'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {customer.contact_person || '-'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        {customer.phone || '-'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {customer.email || '-'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 250 }}>
                        {customer.address || '-'}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center' }}>
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(customer)}
                            sx={{ color: '#667eea', p: 0.5, '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.1)' } }}
                          >
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(customer.id, customer.name)}
                            sx={{ color: '#ef4444', p: 0.5, '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
                          >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box >

      </Box>

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
    </AppLayout >
  );
}