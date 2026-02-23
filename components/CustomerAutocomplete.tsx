// File Path = warehouse-frontend/components/CustomerAutocomplete.tsx
'use client';

import React, { useState, useCallback } from 'react';
import {
    Autocomplete,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stack,
    Box,
    CircularProgress,
    InputAdornment,
    Tooltip,
    IconButton,
    Typography,
    Divider,
    Tabs,
    Tab,
    RadioGroup,
    Radio,
    FormControlLabel,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    useTheme
} from '@mui/material';
import {
    Add as AddIcon,
    LocationOn as LocationIcon,
    CheckCircle as CheckIcon,
    PersonAdd as PersonAddIcon,
    Close as CloseIcon,
    Business as BusinessIcon,
    Person as PersonIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    ContentCopy as CopyIcon
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { customerAPI } from '@/lib/api';

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

// Props interface
interface CustomerAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    customers: string[];
    warehouseId?: number;
    onCustomerAdded?: () => void;
    size?: 'small' | 'medium';
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    fullWidth?: boolean;
    sx?: any;
}

// Add New Customer option constant
const ADD_NEW_OPTION = '➕ Add New Customer';

export default function CustomerAutocomplete({
    value,
    onChange,
    customers,
    warehouseId,
    onCustomerAdded,
    size = 'small',
    label = 'Customer Name',
    placeholder = 'Type to search or select...',
    disabled = false,
    fullWidth = true,
    sx = {}
}: CustomerAutocompleteProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [customerType, setCustomerType] = useState<'business' | 'individual'>('business');

    // Pincode & GST lookup states
    const [billingPincodeLookupLoading, setBillingPincodeLookupLoading] = useState(false);
    const [billingPincodeVerified, setBillingPincodeVerified] = useState(false);
    const [shippingPincodeLookupLoading, setShippingPincodeLookupLoading] = useState(false);
    const [shippingPincodeVerified, setShippingPincodeVerified] = useState(false);
    const [gstLookupLoading, setGstLookupLoading] = useState(false);

    // New customer form data with billing/shipping addresses
    const [formData, setFormData] = useState({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        gst_number: '',
        customer_type: 'Business',
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

    // Options with "Add New" at top
    const options = [ADD_NEW_OPTION, ...customers];

    // Reset form when dialog closes
    const resetForm = () => {
        setFormData({
            name: '',
            contact_person: '',
            phone: '',
            email: '',
            gst_number: '',
            customer_type: 'Business',
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
        setBillingPincodeVerified(false);
        setShippingPincodeVerified(false);
        setActiveTab(0);
        setCustomerType('business');
    };

    // Handle option selection
    const handleChange = (event: any, newValue: string | null) => {
        if (newValue === ADD_NEW_OPTION) {
            setDialogOpen(true);
        } else {
            onChange(newValue || '');
        }
    };

    // Billing Pincode lookup
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
                toast.error('Invalid pincode');
            }
        } catch (error: any) {
            console.error('Pincode lookup error:', error);
        } finally {
            setBillingPincodeLookupLoading(false);
        }
    }, []);

    // Shipping Pincode lookup
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
            }
        } catch (error: any) {
            console.error('Pincode lookup error:', error);
        } finally {
            setShippingPincodeLookupLoading(false);
        }
    }, []);

    // Handle billing pincode change
    const handleBillingPincodeChange = (value: string) => {
        const sanitized = value.replace(/\D/g, '').slice(0, 6);
        setFormData(prev => ({ ...prev, billing_pin_code: sanitized }));
        setBillingPincodeVerified(false);
        if (sanitized.length === 6) {
            lookupBillingPincode(sanitized);
        }
    };

    // Handle shipping pincode change
    const handleShippingPincodeChange = (value: string) => {
        const sanitized = value.replace(/\D/g, '').slice(0, 6);
        setFormData(prev => ({ ...prev, shipping_pin_code: sanitized }));
        setShippingPincodeVerified(false);
        if (sanitized.length === 6) {
            lookupShippingPincode(sanitized);
        }
    };

    // GST validation
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

    // Submit new customer
    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            toast.error('Customer name is required');
            return;
        }
        if (!warehouseId) {
            toast.error('Warehouse not selected');
            return;
        }
        if (formData.customer_type === 'Business') {
            if (!formData.gst_number.trim()) {
                toast.error('GST Number is required for Business customers');
                return;
            }
            if (!validateGSTNumber(formData.gst_number)) {
                toast.error('Invalid GST Number format');
                return;
            }
        }
        if (formData.gst_number && !validateGSTNumber(formData.gst_number)) {
            toast.error('Invalid GST Number format');
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
                warehouse_id: warehouseId
            };

            await customerAPI.create(payload);
            toast.success('✓ Customer added successfully');

            // Set the newly added customer as selected
            onChange(formData.name);

            // Close dialog and reset
            setDialogOpen(false);
            resetForm();

            // Notify parent to refresh customers list
            if (onCustomerAdded) {
                onCustomerAdded();
            }
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || 'Failed to add customer';
            toast.error(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    // Custom option rendering
    const renderOption = (props: any, option: string) => {
        const { key, ...restProps } = props;
        if (option === ADD_NEW_OPTION) {
            return (
                <Box
                    key={key}
                    component="li"
                    {...restProps}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        py: 1.5,
                        px: 2,
                        borderBottom: '1px solid #e2e8f0',
                        bgcolor: '#f0fdf4',
                        color: '#059669',
                        fontWeight: 700,
                        '&:hover': { bgcolor: '#dcfce7' }
                    }}
                >
                    <PersonAddIcon sx={{ fontSize: 14, color: '#10b981' }} />
                    <span>Add New Customer</span>
                </Box>
            );
        }
        return (
            <Box key={key} component="li" {...restProps} sx={{ py: 1, px: 2 }}>
                {option}
            </Box>
        );
    };

    return (
        <>
            <Autocomplete
                options={options}
                value={value || null}
                onChange={handleChange}
                disabled={disabled}
                fullWidth={fullWidth}
                size={size}
                renderOption={renderOption}
                filterOptions={(opts, state) => {
                    // Always show "Add New" at top
                    const filtered = opts.filter(opt => {
                        if (opt === ADD_NEW_OPTION) return true;
                        return opt.toLowerCase().includes(state.inputValue.toLowerCase());
                    });
                    return filtered;
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={label}
                        placeholder={placeholder}
                        sx={{
                            ...sx,
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                ...(sx?.['& .MuiOutlinedInput-root'] || {})
                            }
                        }}
                    />
                )}
                noOptionsText="No customers found"
            />

            {/* Full Add Customer Dialog - Same as Customers Page */}
            <Dialog
                open={dialogOpen}
                onClose={() => { setDialogOpen(false); resetForm(); }}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }
                }}
            >
                <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #e5e7eb' }}>
                    <PersonAddIcon sx={{ color: '#10b981' }} />
                    Add New Customer
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    {/* Customer Type Selection */}
                    <Box sx={{ px: 3, pt: 2, pb: 1 }}>
                        <FormControl component="fieldset">
                            <RadioGroup
                                row
                                value={formData.customer_type}
                                onChange={(e) => setFormData(prev => ({ ...prev, customer_type: e.target.value }))}
                            >
                                <FormControlLabel
                                    value="Business"
                                    control={<Radio size="small" sx={{ color: '#10b981', '&.Mui-checked': { color: '#10b981' } }} />}
                                    label={<Typography variant="body2" fontWeight={formData.customer_type === 'Business' ? 700 : 400}>Business</Typography>}
                                />
                                <FormControlLabel
                                    value="Individual"
                                    control={<Radio size="small" sx={{ color: '#10b981', '&.Mui-checked': { color: '#10b981' } }} />}
                                    label={<Typography variant="body2" fontWeight={formData.customer_type === 'Individual' ? 700 : 400}>Individual</Typography>}
                                />
                            </RadioGroup>
                        </FormControl>
                    </Box>

                    <Divider />

                    {/* Primary Info Section */}
                    <Box sx={{ px: 3, py: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#4b5563', fontWeight: 600 }}>
                            Primary Information
                        </Typography>
                        <Stack spacing={2}>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Customer Name *"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Customer / Company Name"
                                    autoFocus
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                />
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Contact Person"
                                    value={formData.contact_person}
                                    onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                                    placeholder="Contact Person Name"
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Phone"
                                    value={formData.phone}
                                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                    placeholder="Phone Number"
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                />
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="Email Address"
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                />
                            </Box>
                            {/* GST Number - only for Business */}
                            {formData.customer_type === 'Business' && (
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="GST Number *"
                                    value={formData.gst_number}
                                    onChange={(e) => handleGSTChange(e.target.value)}
                                    placeholder="e.g., 22AAAAA0000A1Z5"
                                    inputProps={{ maxLength: 15, style: { textTransform: 'uppercase', fontFamily: 'monospace' } }}
                                    error={formData.gst_number.length > 0 && !validateGSTNumber(formData.gst_number)}
                                    helperText={formData.gst_number.length > 0 && !validateGSTNumber(formData.gst_number) ? 'Invalid GST format' : 'Enter 15-digit GST to auto-fetch company details'}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                {gstLookupLoading ? (
                                                    <CircularProgress size={18} />
                                                ) : formData.gst_number.length === 15 && validateGSTNumber(formData.gst_number) ? (
                                                    <CheckIcon sx={{ color: '#10b981', fontSize: 20 }} />
                                                ) : null}
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            )}
                        </Stack>
                    </Box>

                    <Divider />

                    {/* Address Tabs */}
                    <Box sx={{ px: 3, py: 2 }}>
                        <Tabs
                            value={activeTab}
                            onChange={(_, newVal) => setActiveTab(newVal)}
                            sx={{
                                mb: 2,
                                '& .MuiTab-root': { fontWeight: 600, textTransform: 'none' },
                                '& .Mui-selected': { color: '#10b981' },
                                '& .MuiTabs-indicator': { backgroundColor: '#10b981' }
                            }}
                        >
                            <Tab label="Billing Address" />
                            <Tab label="Shipping Address" />
                        </Tabs>

                        {/* Billing Address Tab */}
                        {activeTab === 0 && (
                            <Stack spacing={2}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Address"
                                    multiline
                                    rows={2}
                                    value={formData.billing_address}
                                    onChange={(e) => setFormData(prev => ({ ...prev, billing_address: e.target.value }))}
                                    placeholder="Street address, building, floor, etc."
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                />
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <TextField
                                        size="small"
                                        label="Pin Code *"
                                        required
                                        value={formData.billing_pin_code}
                                        onChange={(e) => handleBillingPincodeChange(e.target.value)}
                                        placeholder="6 digits"
                                        inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
                                        sx={{ width: 130, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    {billingPincodeLookupLoading ? (
                                                        <CircularProgress size={16} />
                                                    ) : formData.billing_pin_code?.length === 6 ? (
                                                        <CheckIcon sx={{ color: '#10b981', fontSize: 18 }} />
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
                                        onChange={(e) => setFormData(prev => ({ ...prev, billing_city: e.target.value }))}
                                        placeholder="City"
                                        sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    />
                                    <FormControl size="small" sx={{ flex: 1 }} required>
                                        <InputLabel>State *</InputLabel>
                                        <Select
                                            value={formData.billing_state}
                                            onChange={(e) => setFormData(prev => ({ ...prev, billing_state: e.target.value }))}
                                            label="State *"
                                            sx={{ borderRadius: 2 }}
                                        >
                                            {INDIAN_STATES.map((state) => (
                                                <MenuItem key={state} value={state}>{state}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Box>
                            </Stack>
                        )}

                        {/* Shipping Address Tab */}
                        {activeTab === 1 && (
                            <Stack spacing={2}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={formData.shipping_same_as_billing}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                if (checked) {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        shipping_same_as_billing: true,
                                                        shipping_address: prev.billing_address,
                                                        shipping_city: prev.billing_city,
                                                        shipping_state: prev.billing_state,
                                                        shipping_pin_code: prev.billing_pin_code
                                                    }));
                                                } else {
                                                    setFormData(prev => ({ ...prev, shipping_same_as_billing: false }));
                                                }
                                            }}
                                            sx={{ color: '#10b981', '&.Mui-checked': { color: '#10b981' } }}
                                        />
                                    }
                                    label={<Typography variant="body2">Same as Billing Address</Typography>}
                                />
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Address"
                                    multiline
                                    rows={2}
                                    value={formData.shipping_address}
                                    onChange={(e) => setFormData(prev => ({ ...prev, shipping_address: e.target.value }))}
                                    placeholder="Street address, building, floor, etc."
                                    disabled={formData.shipping_same_as_billing}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                />
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <TextField
                                        size="small"
                                        label="Pin Code"
                                        value={formData.shipping_pin_code}
                                        onChange={(e) => handleShippingPincodeChange(e.target.value)}
                                        placeholder="6 digits"
                                        inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
                                        disabled={formData.shipping_same_as_billing}
                                        sx={{ width: 130, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    {shippingPincodeLookupLoading ? (
                                                        <CircularProgress size={16} />
                                                    ) : formData.shipping_pin_code?.length === 6 ? (
                                                        <CheckIcon sx={{ color: '#10b981', fontSize: 18 }} />
                                                    ) : null}
                                                </InputAdornment>
                                            )
                                        }}
                                    />
                                    <TextField
                                        size="small"
                                        label="City"
                                        value={formData.shipping_city}
                                        onChange={(e) => setFormData(prev => ({ ...prev, shipping_city: e.target.value }))}
                                        placeholder="City"
                                        disabled={formData.shipping_same_as_billing}
                                        sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    />
                                    <FormControl size="small" sx={{ flex: 1 }}>
                                        <InputLabel>State</InputLabel>
                                        <Select
                                            value={formData.shipping_state}
                                            onChange={(e) => setFormData(prev => ({ ...prev, shipping_state: e.target.value }))}
                                            label="State"
                                            disabled={formData.shipping_same_as_billing}
                                            sx={{ borderRadius: 2 }}
                                        >
                                            {INDIAN_STATES.map((state) => (
                                                <MenuItem key={state} value={state}>{state}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Box>
                            </Stack>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid #e5e7eb' }}>
                    <Button
                        onClick={() => { setDialogOpen(false); resetForm(); }}
                        disabled={saving}
                        sx={{ borderRadius: 2, fontWeight: 600 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={saving || !formData.name.trim() || !formData.billing_pin_code.trim() || formData.billing_pin_code.length !== 6 || !formData.billing_city.trim() || !formData.billing_state.trim() || (formData.customer_type === 'Business' && (!formData.gst_number.trim() || !validateGSTNumber(formData.gst_number)))}
                        startIcon={saving ? <CircularProgress size={18} /> : <AddIcon />}
                        sx={{
                            borderRadius: 2,
                            fontWeight: 700,
                            px: 3,
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            '&:hover': { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' },
                            '&:disabled': { background: 'rgba(0,0,0,0.12)' }
                        }}
                    >
                        {saving ? 'Adding...' : 'Add Customer'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
