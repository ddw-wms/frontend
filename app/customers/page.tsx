// File Path = warehouse-frontend/app/customers/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ColDef, CellStyle } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

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
  const gridRef = useRef<AgGridReact>(null);
  const columnApiRef = useRef<any>(null);
  const hasAutoFittedRef = useRef(false);
  const [user, setUser] = useState<any>(null);
  const [gridReady, setGridReady] = useState(false);

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

  // AG Grid Column Definitions - Dashboard Style (no floating filters, SR.NO column)
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'SR.NO',
      field: '__sr',
      valueGetter: (params: any) => params.node ? (page - 1) * pageSize + params.node.rowIndex + 1 : undefined,
      width: 80,
      maxWidth: 100,
      suppressMovable: true,
      sortable: false,
      filter: false,
      cellStyle: { fontWeight: 700, textAlign: 'center' }
    },
    {
      headerName: 'CUSTOMER NAME',
      field: 'name',
      flex: 2,
      minWidth: 180,
      filter: 'agTextColumnFilter',
      cellStyle: { fontWeight: 600 } as CellStyle
    },
    {
      headerName: 'CONTACT PERSON',
      field: 'contact_person',
      flex: 1.5,
      minWidth: 150,
      filter: 'agTextColumnFilter',
      valueFormatter: (params: any) => params.value || '-'
    },
    {
      headerName: 'PHONE',
      field: 'phone',
      flex: 1,
      minWidth: 130,
      filter: 'agTextColumnFilter',
      valueFormatter: (params: any) => params.value || '-'
    },
    {
      headerName: 'EMAIL',
      field: 'email',
      flex: 1.5,
      minWidth: 180,
      filter: 'agTextColumnFilter',
      valueFormatter: (params: any) => params.value || '-'
    },
    {
      headerName: 'GST NUMBER',
      field: 'gst_number',
      flex: 1.3,
      minWidth: 160,
      filter: 'agTextColumnFilter',
      cellStyle: { fontFamily: 'monospace' } as CellStyle,
      valueFormatter: (params: any) => params.value || '-'
    },
    {
      headerName: 'CITY',
      field: 'billing_city',
      flex: 1,
      minWidth: 120,
      filter: 'agTextColumnFilter',
      valueFormatter: (params: any) => params.value || params.data?.city || '-'
    },
    {
      headerName: 'STATE',
      field: 'billing_state',
      flex: 1,
      minWidth: 120,
      filter: 'agTextColumnFilter',
      valueFormatter: (params: any) => params.value || params.data?.state || '-'
    },
    {
      headerName: 'ACTIONS',
      field: 'actions',
      width: 100,
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', height: '100%', alignItems: 'center' }}>
          {canSeeButton('edit') && (
            <IconButton
              size="small"
              onClick={() => handleOpenDialog(params.data)}
              sx={{ color: '#3b82f6', p: 0.5, '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.1)' } }}
            >
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          {canSeeButton('delete') && (
            <IconButton
              size="small"
              onClick={() => handleDelete(params.data.id, params.data.name)}
              sx={{ color: '#ef4444', p: 0.5, '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
            >
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      )
    }
  ], [canSeeButton, page, pageSize]);

  // AG Grid default column properties - Dashboard Style (no floating filters)
  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: true,
  }), []);

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
    if (formData.gst_number && !validateGSTNumber(formData.gst_number)) {
      toast.error('Invalid GST Number format. Expected: 22AAAAA0000A1Z5');
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
  const totalPages = Math.ceil(customers.length / pageSize);
  const paginatedCustomers = customers.slice((page - 1) * pageSize, page * pageSize);

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

        {/* Action Buttons */}
        <Box sx={{ mb: 1, mt: 1.5, px: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {canSeeButton('add') && (
              <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} variant="contained" onClick={() => handleOpenDialog()} sx={{ height: 36, fontSize: '0.75rem', fontWeight: 600, background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' }}>
                ADD CUSTOMER
              </Button>
            )}
            {canSeeButton('export') && (
              <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 14 }} />} variant="contained" onClick={handleExport} sx={{ height: 36, fontSize: '0.75rem', fontWeight: 600, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                EXPORT
              </Button>
            )}
            <Button size="small" startIcon={<RefreshIcon sx={{ fontSize: 14 }} />} variant="outlined" onClick={loadCustomers} sx={{ height: 36, fontSize: '0.75rem', fontWeight: 600 }}>
              REFRESH
            </Button>
          </Box>
          <Typography variant="body2" sx={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 500 }}>
            Total: {customers.length} customers
          </Typography>
        </Box>

        {/* AG Grid - Dashboard Style */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            borderRadius: 2,
            overflow: 'hidden',
            border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: isDarkMode ? '#1e293b' : 'white',
            transition: 'opacity 0.2s ease-in-out',
            opacity: loading ? 0.6 : 1,
            // Header styling
            '& .ag-header': {
              background: '#1e3a5f !important',
              borderBottom: 'none'
            },
            '& .ag-header-row': {
              background: '#1e3a5f !important',
            },
            '& .ag-header-cell': {
              padding: '0 12px',
              fontWeight: 600,
              letterSpacing: '0.01em',
              backgroundColor: '#1e3a5f !important',
              color: '#ffffff !important',
            },
            '& .ag-header-cell-text': {
              color: '#ffffff !important',
              fontWeight: 700,
              fontSize: '0.75rem'
            },
            '& .ag-header-icon': {
              color: '#ffffff !important'
            },
            '& .ag-icon': {
              color: isDarkMode ? '#94a3b8 !important' : 'inherit'
            },
            // Root and body styling for dark mode
            '& .ag-root-wrapper': {
              backgroundColor: isDarkMode ? '#1e293b !important' : 'white',
              border: 'none !important'
            },
            '& .ag-root': {
              backgroundColor: isDarkMode ? '#1e293b !important' : 'white'
            },
            '& .ag-body-viewport': {
              backgroundColor: isDarkMode ? '#1e293b !important' : 'white'
            },
            '& .ag-center-cols-viewport': {
              backgroundColor: isDarkMode ? '#1e293b !important' : 'white'
            },
            '& .ag-center-cols-container': {
              backgroundColor: isDarkMode ? '#1e293b !important' : 'white'
            },
            // Row styling
            '& .ag-row': {
              backgroundColor: isDarkMode ? '#1e293b !important' : '#ffffff',
              borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.08) !important' : '1px solid rgba(0,0,0,0.06)',
            },
            '& .ag-row-even': {
              backgroundColor: isDarkMode ? '#0f172a !important' : '#ffffff !important',
            },
            '& .ag-row-odd': {
              backgroundColor: isDarkMode ? '#1e293b !important' : 'rgba(248,250,252,0.5) !important',
            },
            // Cell styling - critical for text visibility
            '& .ag-cell': {
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              color: isDarkMode ? '#f1f5f9 !important' : '#1e293b',
              backgroundColor: 'transparent !important',
            },
            '& .ag-cell-value': {
              color: isDarkMode ? '#f1f5f9 !important' : '#1e293b'
            },
            '& .ag-cell-wrapper': {
              color: isDarkMode ? '#f1f5f9 !important' : '#1e293b'
            },
            // Hover effect
            '& .ag-row-hover': {
              backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2) !important' : 'rgba(30,64,175,0.04) !important',
            },
            '& .ag-row-hover .ag-cell': {
              backgroundColor: 'transparent !important',
            },
            // No rows overlay
            '& .ag-overlay-no-rows-wrapper': {
              backgroundColor: isDarkMode ? '#1e293b !important' : 'white',
              color: isDarkMode ? '#94a3b8' : '#64748b'
            },
            '& .ag-overlay': {
              backgroundColor: isDarkMode ? '#1e293b !important' : 'white'
            },
            // Scrollbar styling for dark mode
            '& .ag-body-horizontal-scroll-viewport, & .ag-body-vertical-scroll-viewport': {
              backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9'
            }
          }}
        >
          <div className="ag-theme-quartz" style={{ flex: 1, minHeight: 0, height: '100%', width: '100%', position: 'relative' }}>
            {loading && !gridReady && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, bgcolor: isDarkMode ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.8)' }}>
                <CircularProgress size={50} />
              </Box>
            )}
            <AgGridReact
              ref={gridRef}
              rowData={paginatedCustomers}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              animateRows={false}
              rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
              suppressCellFocus={true}
              enableCellTextSelection={true}
              ensureDomOrder={true}
              // ⚡ PERFORMANCE: Optimizations for smooth fast scrolling
              rowBuffer={100}
              suppressRowTransform={true}
              suppressAnimationFrame={true}
              alwaysShowVerticalScroll={true}
              debounceVerticalScrollbar={true}
              suppressScrollOnNewData={true}
              getRowId={(params) => String(params.data.id)}
              overlayNoRowsTemplate={`<div style='padding: 20px; font-weight: 600; color: ${isDarkMode ? '#94a3b8' : '#64748b'};'>📭 No customers found</div>`}
              rowHeight={44}
              headerHeight={40}
              onGridReady={(params: any) => {
                columnApiRef.current = params.api;
                setGridReady(true);
                // Restore saved column state from localStorage
                try {
                  const saved = localStorage.getItem('customers_grid_state');
                  if (saved) {
                    const state = JSON.parse(saved);
                    params.api.applyColumnState({ state, applyOrder: true });
                    hasAutoFittedRef.current = true;
                  }
                } catch { /* ignore */ }
              }}
              onFirstDataRendered={(params: any) => {
                // Auto-size columns on first load if no saved state
                if (!hasAutoFittedRef.current && params.api) {
                  try {
                    const allColIds = params.api.getColumns()
                      ?.filter((col: any) => col.getColId() !== 'actions')
                      .map((col: any) => col.getColId()) || [];
                    if (allColIds.length > 0) {
                      params.api.autoSizeColumns(allColIds);
                    }
                    hasAutoFittedRef.current = true;
                  } catch { /* ignore */ }
                }
              }}
              onColumnResized={(params: any) => {
                // Save state when user finishes resizing
                if (params.finished && params.api) {
                  try {
                    const state = params.api.getColumnState();
                    localStorage.setItem('customers_grid_state', JSON.stringify(state));
                  } catch { /* ignore */ }
                }
              }}
              onColumnMoved={(params: any) => {
                // Save state when user finishes moving columns
                if (params.finished && params.api) {
                  try {
                    const state = params.api.getColumnState();
                    localStorage.setItem('customers_grid_state', JSON.stringify(state));
                  } catch { /* ignore */ }
                }
              }}
            />
          </div>
        </Box>

        {/* Pagination Footer - Responsive Dashboard Style */}
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
              borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #ddd',
              bgcolor: isDarkMode ? '#1e293b' : 'white',
              flexShrink: 0,
              minHeight: { xs: 'auto', sm: 52 },
            }}
          >
            {/* Row 1 on Mobile: Page Size + Record Count */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: { xs: 'space-between', sm: 'flex-start' },
              width: { xs: '100%', sm: 'auto' },
              gap: 1.5
            }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap', color: isDarkMode ? '#94a3b8' : 'inherit' }}>
                  Page Size:
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

              <Typography sx={{ fontSize: '0.78rem', color: isDarkMode ? '#94a3b8' : 'inherit', whiteSpace: 'nowrap' }}>
                {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, customers.length)} of {customers.length}
              </Typography>
            </Box>

            {/* Row 2 on Mobile: Pagination */}
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
              <Typography sx={{
                fontSize: '0.78rem',
                color: isDarkMode ? '#94a3b8' : 'inherit',
                mr: 1,
                display: { xs: 'none', md: 'block' }
              }}>
                Page {page} of {totalPages}
              </Typography>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                size="small"
                showFirstButton
                showLastButton
                siblingCount={isMobile ? 0 : 1}
                boundaryCount={isMobile ? 1 : 1}
                sx={{
                  '& .MuiPaginationItem-root': {
                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                    minWidth: { xs: 28, sm: 32 },
                    height: { xs: 28, sm: 32 }
                  },
                  '& .Mui-selected': { bgcolor: '#1e40af !important', color: 'white' }
                }}
              />
            </Stack>
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
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', pt: 1 }}>GST Number</Typography>
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
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', pt: 1 }}>Location</Typography>
                  <TextField
                    size="small"
                    label="Pin Code"
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
                    label="City"
                    value={formData.billing_city}
                    onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                    placeholder="City"
                  />
                  <FormControl size="small" fullWidth>
                    <InputLabel>State</InputLabel>
                    <Select
                      value={formData.billing_state}
                      label="State"
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
            disabled={saving || !formData.name.trim()}
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