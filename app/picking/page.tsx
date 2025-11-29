'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Stack, Tab, Tabs,
  CircularProgress, Alert, IconButton, Autocomplete, Checkbox, FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon, Download as DownloadIcon, Settings as SettingsIcon,
  CheckCircle as CheckIcon, Delete as DeleteIcon, Refresh as RefreshIcon, Visibility as VisibilityIcon
} from '@mui/icons-material';
import { pickingAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';

// ALL MASTER DATA COLUMNS
const ALL_COLUMNS = [
  'wsn', 'wid', 'fsn', 'order_id', 'product_title', 'hsn_sac', 'igst_rate', 
  'fsp', 'mrp', 'invoice_date', 'fkt_link', 'wh_location', 'brand', 
  'cms_vertical', 'vrp', 'yield_value', 'p_type', 'p_size', 'rack_no', 
  'fkqc_remark', 'fk_grade', 'picking_remarks'
];

// DEFAULT VISIBLE COLUMNS
const DEFAULT_MULTI_COLUMNS = [
  'wsn', 'product_title', 'brand', 'cms_vertical', 'fsp', 'mrp', 
  'wh_location', 'p_type', 'rack_no', 'picking_remarks'
];

const DEFAULT_LIST_COLUMNS = [
  'wsn', 'product_title', 'brand', 'cms_vertical', 'fsp', 'mrp', 
  'rack_no', 'batch_id', 'source', 'picking_date', 'customer_name'
];

export default function PickingPage() {
  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);
  const wsnInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Tab state
  const [tabValue, setTabValue] = useState(0);

  // Multi Entry Header state
  const [pickingDate, setPickingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customers, setCustomers] = useState<string[]>([]);

  // Multi Entry state
  const [multiRows, setMultiRows] = useState<any[]>([{ wsn: '' }]);
  const [existingWSNs, setExistingWSNs] = useState<string[]>([]);
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiVisibleColumns, setMultiVisibleColumns] = useState<string[]>(DEFAULT_MULTI_COLUMNS);
  const [multiColumnDialogOpen, setMultiColumnDialogOpen] = useState(false);

  // Picking List state
  const [pickingList, setPickingList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [listVisibleColumns, setListVisibleColumns] = useState<string[]>(DEFAULT_LIST_COLUMNS);
  const [listColumnDialogOpen, setListColumnDialogOpen] = useState(false);

  // Batch Management state
  const [batches, setBatches] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Auth check
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(storedUser);
  }, [router]);

  // Load existing WSNs and customers on mount
  useEffect(() => {
    if (activeWarehouse) {
      loadExistingWSNs();
      loadCustomers();
    }
  }, [activeWarehouse]);

  // Load picking list when filters change
  useEffect(() => {
    if (activeWarehouse && tabValue === 1) {
      loadPickingList();
    }
  }, [activeWarehouse, tabValue, page, limit, searchFilter, brandFilter, categoryFilter, sourceFilter]);

  // Load batches when batch tab opens
  useEffect(() => {
    if (activeWarehouse && tabValue === 2) {
      loadBatches();
    }
  }, [activeWarehouse, tabValue]);

  // Load existing WSNs
  const loadExistingWSNs = async () => {
    try {
      const response = await pickingAPI.getExistingWSNs(activeWarehouse?.id);
      setExistingWSNs(response.data || []);
    } catch (error) {
      console.error('Load existing WSNs error:', error);
    }
  };

  // Load customers from customers table
  const loadCustomers = async () => {
  try {
    console.log('🔄 Loading customers for warehouse:', activeWarehouse?.id);
    const response = await pickingAPI.getCustomers(activeWarehouse?.id);
    console.log('✅ Raw customers response:', response);
    console.log('✅ Customers data:', response.data);
    console.log('✅ Customers type:', typeof response.data);
    console.log('✅ Is array?:', Array.isArray(response.data));
    
    // ✅ IMPORTANT: response.data should be an array of strings
    if (Array.isArray(response.data)) {
      console.log('✅ Setting customers array:', response.data);
      setCustomers(response.data);
    } else {
      console.log('❌ ERROR: Response data is not an array!', response.data);
      setCustomers([]);
    }
  } catch (error) {
    console.error('❌ Load customers error:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    toast.error('Failed to load customers');
    setCustomers([]);
  }
  };


  // Handle WSN Enter key
  const handleWSNKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = multiRows[index].wsn?.trim();
      
      if (!value) {
        focusNextWSN(index);
        return;
      }

      const newRows = [...multiRows];

      // Check for local duplicate
      const localDuplicates = newRows.filter((r, i) => i !== index && r.wsn === value);
      
      // Check for global duplicate
      const isGlobalDuplicate = existingWSNs.includes(value);

      if (localDuplicates.length > 0) {
        newRows[index].duplicate = true;
        newRows[index].error = 'Duplicate WSN in grid';
        toast.error(`Duplicate WSN in grid: ${value}`);
        setMultiRows(newRows);
        return;
      }

      if (isGlobalDuplicate) {
        newRows[index].duplicate = true;
        newRows[index].error = 'WSN already picked';
        toast.error(`WSN already picked: ${value}`);
        setMultiRows(newRows);
        return;
      }

      // Fetch data from source
      newRows[index].duplicate = false;
      newRows[index].error = '';
      
      try {
        const response = await pickingAPI.getSourceByWSN(value, activeWarehouse?.id);
        if (response.data) {
          newRows[index] = {
            ...newRows[index],
            ...response.data,
            wsn: value
          };
          setMultiRows(newRows);
          
          // Auto-add new row if at end
          if (index === multiRows.length - 1) {
            setMultiRows([...newRows, { wsn: '' }]);
          }
          
          // Move to next row
          focusNextWSN(index);
        }
      } catch (error: any) {
        newRows[index].error = 'WSN not found';
        setMultiRows(newRows);
      }
    }
  };

  // Focus next WSN input
  const focusNextWSN = (currentIndex: number) => {
    setTimeout(() => {
      const nextInput = wsnInputRefs.current[currentIndex + 1];
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }, 100);
  };

  // Update multi row field
  const updateMultiRow = (index: number, field: string, value: any) => {
    const newRows = [...multiRows];
    newRows[index][field] = value;
    setMultiRows(newRows);
  };

  // Add new row
  const addMultiRow = () => {
    setMultiRows([...multiRows, { wsn: '' }]);
  };

  // Add 10 rows
  const add10Rows = () => {
    const newRows = Array(10).fill(null).map(() => ({ wsn: '' }));
    setMultiRows([...multiRows, ...newRows]);
  };

  // Delete row
  const deleteMultiRow = (index: number) => {
    if (multiRows.length === 1) {
      toast.error('Cannot delete the last row');
      return;
    }
    const newRows = multiRows.filter((_, i) => i !== index);
    setMultiRows(newRows);
  };

  // Submit multi entry
  const handleMultiSubmit = async () => {
    const validRows = multiRows.filter(r => r.wsn && !r.duplicate && !r.error);
    
    if (validRows.length === 0) {
      toast.error('No valid rows to submit');
      return;
    }

    if (!pickingDate) {
      toast.error('Please select picking date');
      return;
    }

    if (!selectedCustomer) {
      toast.error('Please select customer');
      return;
    }

    if (window.confirm(`Submit ${validRows.length} rows?`)) {
      setMultiLoading(true);
      try {
        const rowsWithHeader = validRows.map(row => ({
          ...row,
          picking_date: pickingDate,
          customer_name: selectedCustomer,
          picker_name: user?.full_name || user?.username,
          created_by: user?.id,
          created_user_name: user?.full_name || user?.username
        }));

        const response = await pickingAPI.multiEntry(rowsWithHeader, activeWarehouse?.id);
        toast.success(`✓ Batch created: ${response.data.batchId} (${response.data.successCount} items)`);
        
        setMultiRows([{ wsn: '' }]);
        loadExistingWSNs();
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to submit');
      } finally {
        setMultiLoading(false);
      }
    }
  };

  // Load picking list
  const loadPickingList = async () => {
    setLoading(true);
    try {
      const response = await pickingAPI.getList({
        page,
        limit,
        warehouseId: activeWarehouse?.id,
        search: searchFilter,
        brand: brandFilter,
        category: categoryFilter,
        source: sourceFilter
      });
      
      setPickingList(response.data.data || []);
      setTotal(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('Load picking list error:', error);
      toast.error('Failed to load picking list');
    } finally {
      setLoading(false);
    }
  };

  // Load batches
  const loadBatches = async () => {
    setBatchLoading(true);
    try {
      const response = await pickingAPI.getBatches(activeWarehouse?.id);
      setBatches(response.data || []);
    } catch (error) {
      console.error('Load batches error:', error);
      toast.error('Failed to load batches');
    } finally {
      setBatchLoading(false);
    }
  };

  // Delete batch
  const handleDeleteBatch = async (batchId: string) => {
    if (window.confirm(`Delete batch ${batchId}?`)) {
      try {
        await pickingAPI.deleteBatch(batchId);
        toast.success('✓ Batch deleted successfully');
        loadBatches();
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to delete batch');
      }
    }
  };

  // Export to Excel
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(pickingList);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Picking List');
    XLSX.writeFile(wb, `picking_list_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('✓ Exported to Excel');
  };

  // Toggle column visibility
  const toggleMultiColumn = (column: string) => {
    if (multiVisibleColumns.includes(column)) {
      if (multiVisibleColumns.length === 1) {
        toast.error('At least one column must be visible');
        return;
      }
      setMultiVisibleColumns(multiVisibleColumns.filter(c => c !== column));
    } else {
      setMultiVisibleColumns([...multiVisibleColumns, column]);
    }
  };

  const toggleListColumn = (column: string) => {
    if (listVisibleColumns.includes(column)) {
      if (listVisibleColumns.length === 1) {
        toast.error('At least one column must be visible');
        return;
      }
      setListVisibleColumns(listVisibleColumns.filter(c => c !== column));
    } else {
      setListVisibleColumns([...listVisibleColumns, column]);
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
            background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
            color: 'white',
            borderRadius: 3,
            boxShadow: '0 10px 40px rgba(245, 158, 11, 0.3)'
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            📦 Picking Management
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {activeWarehouse?.name}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              • {user?.full_name || user?.username}
            </Typography>
          </Stack>
        </Paper>

        {/* TABS */}
        <Paper elevation={2} sx={{ mb: 3, borderRadius: 2 }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{
              '& .MuiTab-root': { fontWeight: 600, fontSize: '0.9rem' },
              '& .Mui-selected': { color: '#f59e0b' }
            }}
          >
            <Tab icon={<AddIcon />} label="Multi Entry" iconPosition="start" />
            <Tab icon={<CheckIcon />} label="Picking List" iconPosition="start" />
            <Tab icon={<SettingsIcon />} label="Batch Management" iconPosition="start" />
          </Tabs>
        </Paper>

        {/* TAB 0: MULTI ENTRY */}
        {tabValue === 0 && (
          <Box>
            {/* HEADER SECTION */}
            <Paper elevation={2} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <TextField
                  label="Picking Date"
                  type="date"
                  value={pickingDate}
                  onChange={(e) => setPickingDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                  sx={{ minWidth: 180 }}
                />
                <Autocomplete
                  freeSolo
                  options={customers}  // ✅ Array of strings like ['ssas', 'customer2']
                  value={selectedCustomer}  // ✅ Current string value
                  onChange={(event, newValue) => {
                    console.log('Customer selected:', newValue);
                    setSelectedCustomer(newValue || '');
                  }}
                  onInputChange={(event, newInputValue) => {
                    console.log('Customer input changed:', newInputValue);
                    setSelectedCustomer(newInputValue);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Customer Name"
                      placeholder="Type to search or select..."
                      size="small"
                      sx={{
                        minWidth: 300,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1,
                          fontSize: '0.85rem'
                        }
                      }}
                    />
                  )}
                  noOptionsText="No customers found"
                  loadingText="Loading..."
                  sx={{
                    minWidth: 300,
                    '& .MuiAutocomplete-paper': {
                      maxHeight: '300px'
                    }
                  }}
                />
                <IconButton
                  onClick={() => setMultiColumnDialogOpen(true)}
                  sx={{
                    bgcolor: '#e5e7eb',
                    '&:hover': { bgcolor: '#d1d5db' },
                    ml: 'auto !important'
                  }}
                >
                  <VisibilityIcon />
                </IconButton>
              </Stack>
            </Paper>

            {/* GRID */}
            <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <Box sx={{ p: 2, bgcolor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={addMultiRow}
                    sx={{
                      borderRadius: 2,
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    +1 Row
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={add10Rows}
                    sx={{ borderRadius: 2, fontWeight: 600 }}
                  >
                    +10 Rows
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={multiLoading ? <CircularProgress size={20} color="inherit" /> : <CheckIcon />}
                    onClick={handleMultiSubmit}
                    disabled={multiLoading}
                    sx={{
                      borderRadius: 2,
                      fontWeight: 700,
                      ml: 'auto !important',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                    }}
                  >
                    {multiLoading ? 'Submitting...' : 'Submit All'}
                  </Button>
                </Stack>
              </Box>

              {/* EXCEL-LIKE GRID */}
              <TableContainer sx={{ maxHeight: 'calc(100vh - 450px)', overflow: 'auto' }}>
                <Table 
                  size="small" 
                  sx={{ 
                    borderCollapse: 'collapse',
                    '& td, & th': { 
                      border: '1px solid #d1d5db',
                      p: 0,
                      height: 28,
                      lineHeight: '28px'
                    }
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#f3f4f6', width: 40, textAlign: 'center', position: 'sticky', left: 0, zIndex: 2 }}>#</TableCell>
                      {multiVisibleColumns.map((col, colIndex) => (
                        <TableCell 
                          key={col} 
                          sx={{ 
                            fontWeight: 700, 
                            fontSize: '11px', 
                            bgcolor: '#f3f4f6',
                            minWidth: 100,
                            textAlign: 'center',
                            position: colIndex === 0 ? 'sticky' : 'relative',
                            left: colIndex === 0 ? 40 : 'auto',
                            zIndex: colIndex === 0 ? 2 : 1
                          }}
                        >
                          {col.replace(/_/g, ' ').toUpperCase()}
                        </TableCell>
                      ))}
                      <TableCell sx={{ fontWeight: 700, fontSize: '11px', bgcolor: '#f3f4f6', width: 40, textAlign: 'center' }}>Del</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {multiRows.map((row, index) => {
                      const isDuplicate = row.duplicate || row.error;
                      return (
                        <TableRow key={index}>
                          <TableCell sx={{ fontSize: '11px', textAlign: 'center', bgcolor: '#fafafa', position: 'sticky', left: 0, zIndex: 1 }}>
                            {index + 1}
                          </TableCell>
                          {multiVisibleColumns.map((col, colIndex) => (
                            <TableCell 
                              key={col} 
                              sx={{ 
                                p: 0,
                                position: colIndex === 0 ? 'sticky' : 'relative',
                                left: colIndex === 0 ? 40 : 'auto',
                                zIndex: colIndex === 0 ? 1 : 0,
                                bgcolor: col === 'wsn' && isDuplicate ? '#fee2e2' : colIndex === 0 ? '#ffffff' : 'transparent'
                              }}
                            >
                              {col === 'wsn' ? (
                                <input
                                  ref={(el) => {
                                    if (el) {
                                      wsnInputRefs.current[index] = el;
                                    }
                                  }}
                                  value={row.wsn || ''}
                                  onChange={(e) => updateMultiRow(index, 'wsn', e.target.value)}
                                  onKeyDown={(e) => handleWSNKeyDown(e, index)}
                                  style={{
                                    width: '100%',
                                    height: '28px',
                                    border: 'none',
                                    outline: 'none',
                                    padding: '0 6px',
                                    fontSize: '11px',
                                    fontFamily: 'Consolas, Monaco, monospace',
                                    backgroundColor: isDuplicate ? '#fee2e2' : '#ffffff',
                                    color: isDuplicate ? '#dc2626' : '#000000'
                                  }}
                                />
                              ) : (
                                <input
                                  value={row[col] || ''}
                                  onChange={(e) => updateMultiRow(index, col, e.target.value)}
                                  style={{
                                    width: '100%',
                                    height: '28px',
                                    border: 'none',
                                    outline: 'none',
                                    padding: '0 6px',
                                    fontSize: '11px',
                                    fontFamily: 'Consolas, Monaco, monospace',
                                    backgroundColor: '#ffffff'
                                  }}
                                />
                              )}
                            </TableCell>
                          ))}
                          <TableCell sx={{ textAlign: 'center', p: 0 }}>
                            <IconButton
                              size="small"
                              onClick={() => deleteMultiRow(index)}
                              sx={{ color: '#ef4444', p: 0, minWidth: 28, height: 28 }}
                            >
                              <DeleteIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* COLUMN SETTINGS DIALOG */}
            <Dialog open={multiColumnDialogOpen} onClose={() => setMultiColumnDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Column Settings</DialogTitle>
              <DialogContent>
                <Stack spacing={1}>
                  {ALL_COLUMNS.map((col) => (
                    <FormControlLabel
                      key={col}
                      control={
                        <Checkbox
                          checked={multiVisibleColumns.includes(col)}
                          onChange={() => toggleMultiColumn(col)}
                        />
                      }
                      label={col.replace(/_/g, ' ').toUpperCase()}
                    />
                  ))}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setMultiColumnDialogOpen(false)}>Close</Button>
                <Button onClick={() => setMultiVisibleColumns(DEFAULT_MULTI_COLUMNS)} variant="outlined">Reset</Button>
              </DialogActions>
            </Dialog>
          </Box>
        )}

        {/* TAB 1: PICKING LIST */}
        {tabValue === 1 && (
          <Box>
            <Paper elevation={2} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <TextField
                  label="Search"
                  size="small"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  sx={{ minWidth: 200 }}
                />
                <TextField
                  label="Brand"
                  size="small"
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  sx={{ minWidth: 150 }}
                />
                <TextField
                  label="Category"
                  size="small"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  sx={{ minWidth: 150 }}
                />
                <TextField
                  label="Source"
                  size="small"
                  select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="QC">QC</MenuItem>
                  <MenuItem value="INBOUND">INBOUND</MenuItem>
                  <MenuItem value="MASTER">MASTER</MenuItem>
                </TextField>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    setSearchFilter('');
                    setBrandFilter('');
                    setCategoryFilter('');
                    setSourceFilter('');
                  }}
                  sx={{ borderRadius: 2 }}
                >
                  Reset
                </Button>
                <IconButton
                  onClick={() => setListColumnDialogOpen(true)}
                  sx={{ bgcolor: '#e5e7eb', '&:hover': { bgcolor: '#d1d5db' } }}
                >
                  <VisibilityIcon />
                </IconButton>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={handleExport}
                  sx={{
                    ml: 'auto !important',
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  }}
                >
                  Export
                </Button>
              </Stack>
            </Paper>

            <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {listVisibleColumns.map((col) => (
                        <TableCell key={col} sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f5f5f5' }}>
                          {col.replace(/_/g, ' ').toUpperCase()}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={listVisibleColumns.length} align="center" sx={{ py: 4 }}>
                          <CircularProgress size={30} />
                        </TableCell>
                      </TableRow>
                    ) : pickingList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={listVisibleColumns.length} align="center" sx={{ py: 4 }}>
                          <Typography variant="h6">📭 No picking records found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pickingList.map((row, index) => (
                        <TableRow key={index} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                          {listVisibleColumns.map((col) => (
                            <TableCell key={col} sx={{ fontSize: '0.75rem' }}>
                              {col === 'batch_id' || col === 'source' ? (
                                <Chip label={row[col]} size="small" color={col === 'source' ? 'primary' : 'default'} />
                              ) : (
                                row[col] || '-'
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ p: 2, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">
                  Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => setPage(page - 1)} disabled={page === 1}>Previous</Button>
                  <Button size="small" onClick={() => setPage(page + 1)} disabled={page * limit >= total}>Next</Button>
                </Stack>
              </Box>
            </Paper>

            <Dialog open={listColumnDialogOpen} onClose={() => setListColumnDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Column Settings</DialogTitle>
              <DialogContent>
                <Stack spacing={1}>
                  {[...ALL_COLUMNS, 'batch_id', 'source', 'picking_date', 'customer_name'].map((col) => (
                    <FormControlLabel
                      key={col}
                      control={<Checkbox checked={listVisibleColumns.includes(col)} onChange={() => toggleListColumn(col)} />}
                      label={col.replace(/_/g, ' ').toUpperCase()}
                    />
                  ))}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setListColumnDialogOpen(false)}>Close</Button>
                <Button onClick={() => setListVisibleColumns(DEFAULT_LIST_COLUMNS)} variant="outlined">Reset</Button>
              </DialogActions>
            </Dialog>
          </Box>
        )}

        {/* TAB 2: BATCH MANAGEMENT */}
        {tabValue === 2 && (
          <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ p: 2, bgcolor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Batch Management</Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Batch ID</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Item Count</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Created At</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batchLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <CircularProgress size={30} />
                      </TableCell>
                    </TableRow>
                  ) : batches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <Typography variant="h6">📭 No batches found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    batches.map((batch) => (
                      <TableRow key={batch.batch_id} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                        <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{batch.batch_id}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{batch.count}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{new Date(batch.created_at).toLocaleString()}</TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteBatch(batch.batch_id)}
                            sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Box>
    </AppLayout>
  );

}
