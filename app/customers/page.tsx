// File Path = warehouse-frontend/app/customers/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, IconButton, Stack, CircularProgress,
  useMediaQuery, InputAdornment, Tooltip, Tabs, Tab, Divider, MenuItem,
  FormControl, InputLabel, Select, RadioGroup, Radio, FormControlLabel, Checkbox,
  Pagination, Fade
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  LocationOn as LocationIcon, CheckCircle as CheckIcon, Close as CloseIcon,
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Download as DownloadIcon, Refresh as RefreshIcon, Business as BusinessIcon,
  Person as PersonIcon, Phone as PhoneIcon, Email as EmailIcon,
  ContentCopy as CopyIcon, Search as SearchIcon
} from '@mui/icons-material';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';
import { customerAPI } from '@/lib/api';
import { useCustomersPermissions } from '@/hooks/usePagePermissions';
import { StandardPageHeader } from '@/components';

// Indian States list for dropdown
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
  'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Lakshadweep'
];

export default function CustomersPage() {
  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';
  const [user, setUser] = useState<any>(null);

  // Permission hook
  const { canSeeButton, isAdmin, isLoading: permLoading } = useCustomersPermissions();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [customerType, setCustomerType] = useState<'business' | 'individual'>('business');

  // Pincode & GST lookup states
  const [billingPincodeLookupLoading, setBillingPincodeLookupLoading] = useState(false);
  const [billingPincodeVerified, setBillingPincodeVerified] = useState(false);
  const [shippingPincodeLookupLoading, setShippingPincodeLookupLoading] = useState(false);
  const [shippingPincodeVerified, setShippingPincodeVerified] = useState(false);
  const [gstLookupLoading, setGstLookupLoading] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    gst_number: '',
    // Billing Address
    billing_address: '',
    billing_pin_code: '',
    billing_city: '',
    billing_state: '',
    // Shipping Address
    shipping_address: '',
    shipping_pin_code: '',
    shipping_city: '',
    shipping_state: '',
    shipping_same_as_billing: true
  });

  // Search state for Zoho-style list
  const [searchQuery, setSearchQuery] = useState('');

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.contact_person || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.gst_number || '').toLowerCase().includes(q) ||
      (c.billing_city || c.city || '').toLowerCase().includes(q) ||
      (c.billing_state || c.state || '').toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  // Helper: get initials + color for avatar
  const getCustomerAvatar = (name: string) => {
    const initials = name
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
    return { initials, color: colors[idx] };
  };

  // Billing Pincode lookup function
  const lookupBillingPincode = useCallback(async (pincode: string) => {
    if (pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
      setBillingPincodeVerified(false);
      return;
    }

    setBillingPincodeLookupLoading(true);
    setBillingPincodeVerified(false);
    try {
      const response = await customerAPI.lookupPincode(pincode);
      if (response.data.success && response.data.city && response.data.state) {
        setFormData(prev => ({
          ...prev,
          billing_city: response.data.city,
          billing_state: response.data.state
        }));
        setBillingPincodeVerified(true);
        toast.success(`📍 ${response.data.city}, ${response.data.state}`);
      } else {
        toast.error('Invalid pincode or city/state not found');
      }
    } catch (error: any) {
      console.error('Pincode lookup error:', error);
      toast.error('Failed to fetch city/state for pincode');
    } finally {
      setBillingPincodeLookupLoading(false);
    }
  }, []);

  // Shipping Pincode lookup function
  const lookupShippingPincode = useCallback(async (pincode: string) => {
    if (pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
      setShippingPincodeVerified(false);
      return;
    }


    setShippingPincodeLookupLoading(true);
    setShippingPincodeVerified(false);
    try {
      const response = await customerAPI.lookupPincode(pincode);
      if (response.data.success && response.data.city && response.data.state) {
        setFormData(prev => ({
          ...prev,
          shipping_city: response.data.city,
          shipping_state: response.data.state
        }));
        setShippingPincodeVerified(true);
        toast.success(`📍 ${response.data.city}, ${response.data.state}`);
      } else {
        toast.error('Invalid pincode or city/state not found');
      }
    } catch (error: any) {
      console.error('Pincode lookup error:', error);
    } finally {
      setShippingPincodeLookupLoading(false);
    }
  }, []);

  // Handle billing pincode change with auto-lookup
  const handleBillingPincodeChange = (value: string) => {
    const sanitized = value.replace(/\D/g, '').slice(0, 6);
    setFormData(prev => ({ ...prev, billing_pin_code: sanitized }));
    setBillingPincodeVerified(false);
    if (sanitized.length === 6) {
      lookupBillingPincode(sanitized);
    }
  };

  // Handle shipping pincode change with auto-lookup
  const handleShippingPincodeChange = (value: string) => {
    const sanitized = value.replace(/\D/g, '').slice(0, 6);
    setFormData(prev => ({ ...prev, shipping_pin_code: sanitized }));
    setShippingPincodeVerified(false);
    if (sanitized.length === 6) {
      lookupShippingPincode(sanitized);
    }
  };

  // GST Number validation
  const validateGSTNumber = (gst: string): boolean => {
    if (!gst) return true;
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(gst.toUpperCase());
  };

  // GST Number lookup for company details
  const lookupGSTNumber = useCallback(async (gstin: string) => {
    if (!validateGSTNumber(gstin)) return;

    setGstLookupLoading(true);
    try {
      const response = await customerAPI.lookupGST(gstin);
      if (response.data.success) {
        const data = response.data;
        let fieldsUpdated = 0;

        // Auto-fill company name if available and field is empty
        if (data.company_name && !formData.name) {
          setFormData(prev => ({ ...prev, name: data.company_name }));
          fieldsUpdated++;
        }
        // Auto-fill billing address info
        if (data.state) {
          setFormData(prev => ({ ...prev, billing_state: data.state }));
          fieldsUpdated++;
        }
        if (data.city) {
          setFormData(prev => ({ ...prev, billing_city: data.city }));
          fieldsUpdated++;
        }
        if (data.pincode) {
          setFormData(prev => ({ ...prev, billing_pin_code: data.pincode }));
          setBillingPincodeVerified(true);
          fieldsUpdated++;
        }
        if (data.address) {
          setFormData(prev => ({ ...prev, billing_address: data.address }));
          fieldsUpdated++;
        }

        // Show appropriate toast based on what was filled
        if (data.company_name) {
          toast.success(`🏢 GST verified! Company: ${data.company_name}`);
        } else if (data.state) {
          toast.success(`✅ GST format valid. State: ${data.state}. Please enter company details manually.`);
        } else {
          toast.success('✅ GST format is valid');
        }
      }
    } catch (error: any) {
      console.error('GST lookup error:', error);
      toast.error('Could not verify GST. Please enter details manually.');
    } finally {
      setGstLookupLoading(false);
    }
  }, [formData.name]);

  // Handle GST change with auto-lookup
  const handleGSTChange = (value: string) => {
    const sanitized = value.toUpperCase().slice(0, 15);
    setFormData(prev => ({ ...prev, gst_number: sanitized }));
    if (sanitized.length === 15 && validateGSTNumber(sanitized)) {
      lookupGSTNumber(sanitized);
    }
  };

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
    setBillingPincodeVerified(false);
    setShippingPincodeVerified(false);
    setActiveTab(0);
    if (customer) {
      setEditMode(true);
      setCurrentCustomer(customer);
      setCustomerType(customer.gst_number ? 'business' : 'individual');
      setFormData({
        name: customer.name || '',
        contact_person: customer.contact_person || '',
        phone: customer.phone || '',
        email: customer.email || '',
        gst_number: customer.gst_number || '',
        // Billing Address (fallback to old address field)
        billing_address: customer.billing_address || customer.address || '',
        billing_pin_code: customer.billing_pin_code || customer.pin_code || '',
        billing_city: customer.billing_city || customer.city || '',
        billing_state: customer.billing_state || customer.state || '',
        // Shipping Address
        shipping_address: customer.shipping_address || '',
        shipping_pin_code: customer.shipping_pin_code || '',
        shipping_city: customer.shipping_city || '',
        shipping_state: customer.shipping_state || '',
        shipping_same_as_billing: customer.shipping_same_as_billing !== false
      });
      if (customer.billing_pin_code && customer.billing_city && customer.billing_state) {
        setBillingPincodeVerified(true);
      }
      if (customer.shipping_pin_code && customer.shipping_city && customer.shipping_state) {
        setShippingPincodeVerified(true);
      }
    } else {
      setEditMode(false);
      setCurrentCustomer(null);
      setCustomerType('business');
      setFormData({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        gst_number: '',
        billing_address: '',
        billing_pin_code: '',
        billing_city: '',
        billing_state: '',
        shipping_address: '',
        shipping_pin_code: '',
        shipping_city: '',
        shipping_state: '',
        shipping_same_as_billing: true
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
      gst_number: '',
      billing_address: '',
      billing_pin_code: '',
      billing_city: '',
      billing_state: '',
      shipping_address: '',
      shipping_pin_code: '',
      shipping_city: '',
      shipping_state: '',
      shipping_same_as_billing: true
    });
    setCurrentCustomer(null);
    setEditMode(false);
    setBillingPincodeVerified(false);
    setShippingPincodeVerified(false);
    setActiveTab(0);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (customerType === 'business') {
      if (!formData.gst_number.trim()) {
        toast.error('GST Number is required for Business customers');
        return;
      }
      if (!validateGSTNumber(formData.gst_number)) {
        toast.error('Invalid GST Number format. Expected: 22AAAAA0000A1Z5');
        return;
      }
    }
    if (formData.gst_number && !validateGSTNumber(formData.gst_number)) {
      toast.error('Invalid GST Number format. Expected: 22AAAAA0000A1Z5');
      return;
    }
    if (!formData.billing_pin_code.trim() || formData.billing_pin_code.length !== 6) {
      toast.error('Valid 6-digit Billing Pin Code is required');
      return;
    }
    if (!formData.billing_city.trim()) {
      toast.error('Billing City is required');
      return;
    }
    if (!formData.billing_state.trim()) {
      toast.error('Billing State is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        gst_number: formData.gst_number?.toUpperCase() || '',
        warehouse_id: activeWarehouse?.id
      };

      if (editMode && currentCustomer) {
        await customerAPI.update(currentCustomer.id, payload);
        toast.success('✓ Customer updated successfully');
      } else {
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
      const headers = ['Customer Name', 'Contact Person', 'Phone', 'Email', 'GST Number', 'Billing City', 'Billing State', 'Billing Pin Code', 'Billing Address', 'Shipping City', 'Shipping State', 'Shipping Pin Code', 'Shipping Address'];
      const csvContent = [
        headers.join(','),
        ...customers.map((customer) =>
          [
            `"${customer.name || ''}"`,
            `"${customer.contact_person || ''}"`,
            `"${customer.phone || ''}"`,
            `"${customer.email || ''}"`,
            `"${customer.gst_number || ''}"`,
            `"${customer.billing_city || customer.city || ''}"`,
            `"${customer.billing_state || customer.state || ''}"`,
            `"${customer.billing_pin_code || customer.pin_code || ''}"`,
            `"${customer.billing_address || customer.address || ''}"`,
            `"${customer.shipping_city || ''}"`,
            `"${customer.shipping_state || ''}"`,
            `"${customer.shipping_pin_code || ''}"`,
            `"${customer.shipping_address || ''}"`
          ].join(',')
        )
      ].join('\n');

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

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / pageSize);
  const paginatedCustomers = filteredCustomers.slice((page - 1) * pageSize, page * pageSize);

  if (!activeWarehouse) {
    return (
      <AppLayout>
        <Box sx={{ p: 6, textAlign: 'center', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <Box sx={{ p: 5, background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', borderRadius: 4, color: 'white', boxShadow: '0 20px 60px rgba(30, 64, 175, 0.4)' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>⚠️ No active warehouse selected.</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>Please go to Settings → Warehouses to set one.</Typography>
          </Box>
        </Box>
      </AppLayout>
    );
  }

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
        overflow: 'hidden'
      }}>
        <StandardPageHeader
          title="Customers"
          subtitle="Manage your customers"
          icon="👥"
          warehouseName={activeWarehouse?.name}
          userName={user?.fullName}
        />

        {/* Zoho Books Style Toolbar */}
        <Box sx={{
          mb: 1, mt: 1.5, px: 1,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1
        }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {canSeeButton('add') && (
              <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} variant="contained" onClick={() => handleOpenDialog()} sx={{ height: 36, fontSize: '0.75rem', fontWeight: 600, background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', borderRadius: 1.5 }}>
                ADD CUSTOMER
              </Button>
            )}
            {canSeeButton('export') && (
              <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 14 }} />} variant="contained" onClick={handleExport} sx={{ height: 36, fontSize: '0.75rem', fontWeight: 600, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: 1.5 }}>
                EXPORT
              </Button>
            )}
            <Button size="small" startIcon={<RefreshIcon sx={{ fontSize: 14 }} />} variant="outlined" onClick={loadCustomers} sx={{ height: 36, fontSize: '0.75rem', fontWeight: 600, borderRadius: 1.5 }}>
              REFRESH
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                  </InputAdornment>
                )
              }}
              sx={{
                width: { xs: '100%', sm: 260 },
                '& .MuiOutlinedInput-root': { borderRadius: 2, height: 36, fontSize: '0.8rem' }
              }}
            />
            <Typography variant="body2" sx={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {filteredCustomers.length} customers
            </Typography>
          </Box>
        </Box>

        {/* Zoho Books Style Customer List */}
        <Box sx={{
          flex: 1,
          minHeight: 0,
          borderRadius: 2,
          overflow: 'hidden',
          border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
          transition: 'opacity 0.2s ease-in-out',
          opacity: loading ? 0.6 : 1,
        }}>
          {/* Table Header */}
          <Box sx={{
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns: '44px 2fr 1.2fr 1.2fr 1.3fr 1fr 80px',
            gap: 1,
            px: 2,
            py: 1.2,
            bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
            borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
            position: 'sticky',
            top: 0,
            zIndex: 2
          }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>#</Typography>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Customer</Typography>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Phone</Typography>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</Typography>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>GST Number</Typography>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Location</Typography>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>Actions</Typography>
          </Box>

          {/* Customer Rows */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={40} />
              </Box>
            ) : paginatedCustomers.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, color: '#94a3b8' }}>
                <Typography sx={{ fontSize: '2rem', mb: 1 }}>📭</Typography>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {searchQuery ? 'No customers match your search' : 'No customers found'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: '#94a3b8' }}>
                  {searchQuery ? 'Try a different search term' : 'Add your first customer to get started'}
                </Typography>
              </Box>
            ) : (
              paginatedCustomers.map((customer, index) => {
                const avatar = getCustomerAvatar(customer.name || 'C');
                const city = customer.billing_city || customer.city || '';
                const state = customer.billing_state || customer.state || '';
                const location = [city, state].filter(Boolean).join(', ');
                const srNo = (page - 1) * pageSize + index + 1;

                return (
                  <Box
                    key={customer.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr auto', md: '44px 2fr 1.2fr 1.2fr 1.3fr 1fr 80px' },
                      gap: { xs: 0, md: 1 },
                      px: 2,
                      py: { xs: 1.5, md: 1 },
                      alignItems: 'center',
                      borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f1f5f9',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.08)' : '#f8fafc',
                      },
                      '&:last-child': { borderBottom: 'none' }
                    }}
                    onClick={() => canSeeButton('edit') && handleOpenDialog(customer)}
                  >
                    {/* SR.NO - Desktop */}
                    <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
                      {srNo}
                    </Typography>

                    {/* Customer Name + Avatar */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                      <Box sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        bgcolor: avatar.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `0 2px 8px ${avatar.color}40`
                      }}>
                        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.75rem', lineHeight: 1 }}>
                          {avatar.initials}
                        </Typography>
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          color: isDarkMode ? '#f1f5f9' : '#1e293b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {customer.name}
                        </Typography>
                        {customer.contact_person && (
                          <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {customer.contact_person}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* Mobile: Actions */}
                    <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 0.5 }}>
                      {canSeeButton('edit') && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOpenDialog(customer); }} sx={{ color: '#3b82f6', p: 0.5 }}>
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                      {canSeeButton('delete') && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(customer.id, customer.name); }} sx={{ color: '#ef4444', p: 0.5 }}>
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                    </Box>

                    {/* Mobile: Extra Info */}
                    <Box sx={{ display: { xs: 'flex', md: 'none' }, gridColumn: '1 / -1', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                      {customer.phone && (
                        <Typography sx={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 0.3 }}>
                          <PhoneIcon sx={{ fontSize: 12 }} /> {customer.phone}
                        </Typography>
                      )}
                      {customer.gst_number && (
                        <Typography sx={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#8b5cf6', bgcolor: isDarkMode ? 'rgba(139,92,246,0.1)' : '#f5f3ff', px: 0.8, py: 0.2, borderRadius: 1 }}>
                          {customer.gst_number}
                        </Typography>
                      )}
                      {location && (
                        <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>📍 {location}</Typography>
                      )}
                    </Box>

                    {/* Phone - Desktop */}
                    <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: '0.8rem', color: isDarkMode ? '#cbd5e1' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {customer.phone || <span style={{ color: '#cbd5e1' }}>—</span>}
                    </Typography>

                    {/* Email - Desktop */}
                    <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: '0.8rem', color: isDarkMode ? '#cbd5e1' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {customer.email || <span style={{ color: '#cbd5e1' }}>—</span>}
                    </Typography>

                    {/* GST - Desktop */}
                    <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
                      {customer.gst_number ? (
                        <Typography sx={{
                          fontSize: '0.73rem',
                          fontFamily: 'monospace',
                          letterSpacing: 0.3,
                          color: '#8b5cf6',
                          bgcolor: isDarkMode ? 'rgba(139,92,246,0.1)' : '#f5f3ff',
                          px: 1,
                          py: 0.3,
                          borderRadius: 1,
                          fontWeight: 500
                        }}>
                          {customer.gst_number}
                        </Typography>
                      ) : (
                        <Typography sx={{ fontSize: '0.8rem', color: '#cbd5e1' }}>—</Typography>
                      )}
                    </Box>

                    {/* Location - Desktop */}
                    <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: '0.8rem', color: isDarkMode ? '#cbd5e1' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {location || <span style={{ color: '#cbd5e1' }}>—</span>}
                    </Typography>

                    {/* Actions - Desktop */}
                    <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, justifyContent: 'center' }}>
                      {canSeeButton('edit') && (
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleOpenDialog(customer); }}
                          sx={{ color: '#3b82f6', p: 0.5, '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.1)' } }}
                        >
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                      {canSeeButton('delete') && (
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleDelete(customer.id, customer.name); }}
                          sx={{ color: '#ef4444', p: 0.5, '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>

        {/* Pagination Footer */}
        <Fade in={true} timeout={300}>
          <Box
            sx={{
              px: { xs: 1, sm: 2 },
              py: { xs: 1, sm: 0.75 },
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: { xs: 1, sm: 0 },
              borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
              bgcolor: isDarkMode ? '#1e293b' : 'white',
              flexShrink: 0,
              minHeight: { xs: 'auto', sm: 48 },
            }}
          >
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: { xs: 'space-between', sm: 'flex-start' },
              width: { xs: '100%', sm: 'auto' },
              gap: 1.5
            }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Show:
                </Typography>
                <Select
                  size="small"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  sx={{ minWidth: 65, '& .MuiSelect-select': { py: 0.5, fontSize: '0.8rem' } }}
                >
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                  <MenuItem value={200}>200</MenuItem>
                </Select>
              </Stack>
              <Typography sx={{ fontSize: '0.78rem', color: isDarkMode ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap' }}>
                {filteredCustomers.length > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredCustomers.length)} of ${filteredCustomers.length}` : '0 results'}
              </Typography>
            </Box>

            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, newPage) => setPage(newPage)}
              size="small"
              showFirstButton
              showLastButton
              siblingCount={isMobile ? 0 : 1}
              boundaryCount={1}
              sx={{
                '& .MuiPaginationItem-root': {
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  minWidth: { xs: 28, sm: 32 },
                  height: { xs: 28, sm: 32 }
                },
                '& .Mui-selected': { bgcolor: '#1e40af !important', color: 'white' }
              }}
            />
          </Box>
        </Fade>
      </Box>

      {/* ZOHO-STYLE ADD/EDIT DIALOG */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            minHeight: '70vh',
            maxHeight: '90vh'
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2.5,
          borderBottom: '1px solid #e2e8f0',
          background: isDarkMode ? '#1e293b' : '#ffffff'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
            {editMode ? 'Edit Customer' : 'New Customer'}
          </Typography>
          <IconButton onClick={handleCloseDialog} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Customer Type Selection */}
          <Box sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', minWidth: 100 }}>Customer Type</Typography>
              <RadioGroup
                row
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value as 'business' | 'individual')}
              >
                <FormControlLabel
                  value="business"
                  control={<Radio size="small" sx={{ '&.Mui-checked': { color: '#3b82f6' } }} />}
                  label={<Typography variant="body2">Business</Typography>}
                />
                <FormControlLabel
                  value="individual"
                  control={<Radio size="small" sx={{ '&.Mui-checked': { color: '#3b82f6' } }} />}
                  label={<Typography variant="body2">Individual</Typography>}
                />
              </RadioGroup>
            </Box>
          </Box>

          {/* Main Form Content */}
          <Box sx={{ px: 3, py: 2, flex: 1, overflow: 'auto' }}>
            {/* Primary Info Section */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 2, alignItems: 'start', mb: 2.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', pt: 1 }}>
                {customerType === 'business' ? 'Company Name*' : 'Customer Name*'}
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={customerType === 'business' ? 'Enter company name' : 'Enter customer name'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {customerType === 'business' ? <BusinessIcon sx={{ fontSize: 18, color: '#94a3b8' }} /> : <PersonIcon sx={{ fontSize: 18, color: '#94a3b8' }} />}
                    </InputAdornment>
                  )
                }}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 2, alignItems: 'start', mb: 2.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', pt: 1 }}>Contact Person</Typography>
              <TextField
                fullWidth
                size="small"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Enter contact person name"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                    </InputAdornment>
                  )
                }}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 2, alignItems: 'start', mb: 2.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', pt: 1 }}>Contact</Typography>
              <TextField
                fullWidth
                size="small"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone number"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                    </InputAdornment>
                  )
                }}
              />
              <TextField
                fullWidth
                size="small"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Email address"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                    </InputAdornment>
                  )
                }}
              />
            </Box>

            {customerType === 'business' && (
              <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 2, alignItems: 'start', mb: 2.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', pt: 1 }}>GST Number*</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={formData.gst_number}
                  onChange={(e) => handleGSTChange(e.target.value)}
                  placeholder="e.g., 22AAAAA0000A1Z5 (15 characters)"
                  error={formData.gst_number.length > 0 && !validateGSTNumber(formData.gst_number)}
                  helperText={formData.gst_number.length > 0 && !validateGSTNumber(formData.gst_number) ? 'Invalid GST format' : 'Enter 15-digit GST to auto-verify details'}
                  inputProps={{ maxLength: 15, style: { textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: 1 } }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        {gstLookupLoading ? (
                          <CircularProgress size={16} />
                        ) : formData.gst_number.length === 15 && validateGSTNumber(formData.gst_number) ? (
                          <Tooltip title="GST Verified">
                            <CheckIcon sx={{ color: '#10b981', fontSize: 18 }} />
                          </Tooltip>
                        ) : null}
                      </InputAdornment>
                    )
                  }}
                />
              </Box>
            )}

            {/* Address Tabs - Billing & Shipping */}
            <Divider sx={{ my: 2 }} />
            <Tabs
              value={activeTab}
              onChange={(e, v) => setActiveTab(v)}
              sx={{
                mb: 2,
                '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', minHeight: 40 },
                '& .Mui-selected': { color: '#3b82f6' },
                '& .MuiTabs-indicator': { backgroundColor: '#3b82f6' }
              }}
            >
              <Tab label="Billing Address" />
              <Tab label="Shipping Address" />
            </Tabs>

            {/* Billing Address Tab */}
            {activeTab === 0 && (
              <Box sx={{ pl: 0 }}>
                {/* Pin Code with auto-fetch */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '120px 150px 1fr 1fr', gap: 2, alignItems: 'start', mb: 2.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', pt: 1 }}>Location*</Typography>
                  <TextField
                    size="small"
                    label="Pin Code *"
                    required
                    value={formData.billing_pin_code}
                    onChange={(e) => handleBillingPincodeChange(e.target.value)}
                    placeholder="6 digits"
                    inputProps={{ maxLength: 6, inputMode: 'numeric' }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          {billingPincodeLookupLoading ? (
                            <CircularProgress size={16} />
                          ) : billingPincodeVerified ? (
                            <Tooltip title="Verified">
                              <CheckIcon sx={{ color: '#10b981', fontSize: 18 }} />
                            </Tooltip>
                          ) : formData.billing_pin_code.length === 6 ? (
                            <Tooltip title="Click to lookup">
                              <IconButton size="small" onClick={() => lookupBillingPincode(formData.billing_pin_code)}>
                                <LocationIcon sx={{ fontSize: 16, color: '#3b82f6' }} />
                              </IconButton>
                            </Tooltip>
                          ) : null}
                        </InputAdornment>
                      )
                    }}
                  />
                  <TextField
                    size="small"
                    label="City *"
                    required
                    value={formData.billing_city}
                    onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                    placeholder="City"
                  />
                  <FormControl size="small" fullWidth required>
                    <InputLabel>State *</InputLabel>
                    <Select
                      value={formData.billing_state}
                      label="State *"
                      onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
                    >
                      <MenuItem value="">Select State</MenuItem>
                      {INDIAN_STATES.map(state => (
                        <MenuItem key={state} value={state}>{state}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 2, alignItems: 'start', mb: 2.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', pt: 1 }}>Address</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    rows={3}
                    value={formData.billing_address}
                    onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                    placeholder="Enter billing address (street, area, landmark, etc.)"
                  />
                </Box>
              </Box>
            )}

            {/* Shipping Address Tab */}
            {activeTab === 1 && (
              <Box sx={{ pl: 0 }}>
                {/* Same as Billing checkbox */}
                <Box sx={{ mb: 2.5 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.shipping_same_as_billing}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            shipping_same_as_billing: checked,
                            ...(checked ? {
                              shipping_address: prev.billing_address,
                              shipping_pin_code: prev.billing_pin_code,
                              shipping_city: prev.billing_city,
                              shipping_state: prev.billing_state
                            } : {})
                          }));
                          if (checked) setShippingPincodeVerified(billingPincodeVerified);
                        }}
                        size="small"
                        sx={{ '&.Mui-checked': { color: '#3b82f6' } }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CopyIcon sx={{ fontSize: 16, color: '#64748b' }} />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>Same as Billing Address</Typography>
                      </Box>
                    }
                  />
                </Box>

                {!formData.shipping_same_as_billing && (
                  <>
                    {/* Pin Code with auto-fetch */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '120px 150px 1fr 1fr', gap: 2, alignItems: 'start', mb: 2.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', pt: 1 }}>Location</Typography>
                      <TextField
                        size="small"
                        label="Pin Code"
                        value={formData.shipping_pin_code}
                        onChange={(e) => handleShippingPincodeChange(e.target.value)}
                        placeholder="6 digits"
                        inputProps={{ maxLength: 6, inputMode: 'numeric' }}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              {shippingPincodeLookupLoading ? (
                                <CircularProgress size={16} />
                              ) : shippingPincodeVerified ? (
                                <Tooltip title="Verified">
                                  <CheckIcon sx={{ color: '#10b981', fontSize: 18 }} />
                                </Tooltip>
                              ) : formData.shipping_pin_code.length === 6 ? (
                                <Tooltip title="Click to lookup">
                                  <IconButton size="small" onClick={() => lookupShippingPincode(formData.shipping_pin_code)}>
                                    <LocationIcon sx={{ fontSize: 16, color: '#3b82f6' }} />
                                  </IconButton>
                                </Tooltip>
                              ) : null}
                            </InputAdornment>
                          )
                        }}
                      />
                      <TextField
                        size="small"
                        label="City"
                        value={formData.shipping_city}
                        onChange={(e) => setFormData({ ...formData, shipping_city: e.target.value })}
                        placeholder="City"
                      />
                      <FormControl size="small" fullWidth>
                        <InputLabel>State</InputLabel>
                        <Select
                          value={formData.shipping_state}
                          label="State"
                          onChange={(e) => setFormData({ ...formData, shipping_state: e.target.value })}
                        >
                          <MenuItem value="">Select State</MenuItem>
                          {INDIAN_STATES.map(state => (
                            <MenuItem key={state} value={state}>{state}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 2, alignItems: 'start', mb: 2.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', pt: 1 }}>Address</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        rows={3}
                        value={formData.shipping_address}
                        onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                        placeholder="Enter shipping address (street, area, landmark, etc.)"
                      />
                    </Box>
                  </>
                )}

                {formData.shipping_same_as_billing && (
                  <Box sx={{ p: 2, bgcolor: isDarkMode ? '#1e3a5f' : '#f0f9ff', borderRadius: 2, border: '1px dashed #3b82f6' }}>
                    <Typography variant="body2" sx={{ color: isDarkMode ? '#93c5fd' : '#1e40af', fontWeight: 500 }}>
                      📍 Shipping address will be same as billing address
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>

        {/* Footer */}
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0', gap: 1 }}>
          <Button
            onClick={handleCloseDialog}
            disabled={saving}
            sx={{ borderRadius: 1, fontWeight: 600, px: 3, color: '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={saving || !formData.name.trim() || !formData.billing_pin_code.trim() || formData.billing_pin_code.length !== 6 || !formData.billing_city.trim() || !formData.billing_state.trim() || (customerType === 'business' && (!formData.gst_number.trim() || !validateGSTNumber(formData.gst_number)))}
            startIcon={saving ? <CircularProgress size={18} /> : null}
            sx={{
              borderRadius: 1,
              fontWeight: 700,
              px: 4,
              background: '#3b82f6',
              '&:hover': { background: '#2563eb' },
              '&:disabled': { background: '#94a3b8' }
            }}
          >
            {saving ? 'Saving...' : (editMode ? 'Save' : 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}