'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Stack, Tab, Tabs,
  CircularProgress, Alert, Card, CardContent, Divider,
  Select, FormControl, InputLabel, Checkbox, FormControlLabel, Autocomplete
} from '@mui/material';
import {
  Add as AddIcon, Download as DownloadIcon, Upload as UploadIcon,
  Settings as SettingsIcon, CheckCircle as CheckIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { outboundAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';

// ====== ALL MASTER DATA COLUMNS ======
const ALL_MASTER_COLUMNS = [
  'wid', 'fsn', 'order_id', 'fkqc_remark', 'fk_grade', 'product_title',
  'hsn_sac', 'igst_rate', 'fsp', 'mrp', 'invoice_date', 'fkt_link',
  'wh_location', 'brand', 'cms_vertical', 'vrp', 'yield_value', 'p_type', 'p_size'
];

const DEFAULT_MULTI_COLUMNS = ['wsn', 'dispatch_date', 'customer_name', 'vehicle_no', 'dispatch_remarks'];
const SOURCE_COLUMNS = ['source', 'product_title', 'brand', 'mrp', 'fsp', 'rack_no', 'qc_date', 'qc_by', 'inbound_date'];

export default function OutboundPage() {
  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);
  const [tabValue, setTabValue] = useState(0);

  // ====== SINGLE ENTRY STATE ======
  const [singleWSN, setSingleWSN] = useState('');
  const [sourceData, setSourceData] = useState<any>(null);
  const [singleForm, setSingleForm] = useState({
    dispatch_date: new Date().toISOString().split('T')[0],
    customer_name: '',
    vehicle_no: '',
    dispatch_remarks: '',
    other_remarks: ''
  });
  const [singleLoading, setSingleLoading] = useState(false);
  const [duplicateWSN, setDuplicateWSN] = useState<any>(null);

  // ====== BULK UPLOAD STATE ======
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkCurrentBatch, setBulkCurrentBatch] = useState<any>(null);

  // ====== MULTI ENTRY STATE ======
  const generateEmptyRows = (count: number) => {
    return Array.from({ length: count }, () => ({
      wsn: '',
      dispatch_date: new Date().toISOString().split('T')[0],
      customer_name: '',
      vehicle_no: '',
      dispatch_remarks: '',
      other_remarks: ''
    }));
  };

  const [multiRows, setMultiRows] = useState(generateEmptyRows(5));
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiResults, setMultiResults] = useState<any[]>([]);
  const [duplicateWSNs, setDuplicateWSNs] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_MULTI_COLUMNS);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [commonDate, setCommonDate] = useState(new Date().toISOString().split('T')[0]);
  const [commonCustomer, setCommonCustomer] = useState('');
  const [commonVehicle, setCommonVehicle] = useState('');

  // ====== OUTBOUND LIST STATE ======
  const [listData, setListData] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [total, setTotal] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [customers, setCustomers] = useState<string[]>([]);
  const [listColumns, setListColumns] = useState(['wsn', 'customer_name', 'product_title', 'brand', 'source', 'dispatch_date', 'vehicle_no']);
  const [listColumnSettingsOpen, setListColumnSettingsOpen] = useState(false);

  // ====== BATCH MANAGEMENT STATE ======
  const [batches, setBatches] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // ====== EXPORT STATE ======
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportBatchId, setExportBatchId] = useState('');
  const [existingOutboundWSNs, setExistingOutboundWSNs] = useState<Set<string>>(new Set());

  // ====== AUTH CHECK ======
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(storedUser);
  }, [router]);

  // ====== VEHICLE & CUSTOMER PERSISTENCE ======
  useEffect(() => {
    const savedVehicle = localStorage.getItem('lastOutboundVehicle');
    const savedCustomer = localStorage.getItem('lastOutboundCustomer');
    if (savedVehicle) {
      setSingleForm(prev => ({ ...prev, vehicle_no: savedVehicle }));
      setCommonVehicle(savedVehicle);
    }
    if (savedCustomer) {
      setSingleForm(prev => ({ ...prev, customer_name: savedCustomer }));
      setCommonCustomer(savedCustomer);
    }
  }, []);

  const saveVehicleNumber = (vehicle: string) => {
    if (vehicle.trim()) localStorage.setItem('lastOutboundVehicle', vehicle);
  };

  const saveCustomerName = (customer: string) => {
    if (customer.trim()) localStorage.setItem('lastOutboundCustomer', customer);
  };

  // ====== LOAD COLUMN SETTINGS ======
  useEffect(() => {
    const saved = localStorage.getItem('outboundMultiEntryColumns');
    if (saved) {
      try {
        setVisibleColumns(JSON.parse(saved));
      } catch (e) {}
    }
    const savedList = localStorage.getItem('outboundListColumns');
    if (savedList) {
      try {
        setListColumns(JSON.parse(savedList));
      } catch (e) {}
    }
  }, []);

  const saveColumnSettings = (cols: string[]) => {
    setVisibleColumns(cols);
    localStorage.setItem('outboundMultiEntryColumns', JSON.stringify(cols));
  };

  const saveListColumnSettings = (cols: string[]) => {
    setListColumns(cols);
    localStorage.setItem('outboundListColumns', JSON.stringify(cols));
  };

  // LOAD CUSTOMERS ON MOUNT (for all tabs)
useEffect(() => {
  if (activeWarehouse) {
    loadCustomers();
  }
}, [activeWarehouse]);

// LOAD DATA ON TAB CHANGE
useEffect(() => {
  if (activeWarehouse && tabValue === 3) {
    loadOutboundList();
    loadBatches();
  }
}, [activeWarehouse, tabValue, page, limit, searchFilter, sourceFilter, customerFilter]);


  // ====== LOAD EXISTING WSNs ======
  useEffect(() => {
    if (activeWarehouse) {
      loadExistingWSNs();
    }
  }, [activeWarehouse]);

  const loadExistingWSNs = async () => {
    try {
      const response = await outboundAPI.getExistingWSNs(activeWarehouse?.id);
      setExistingOutboundWSNs(new Set(response.data));
    } catch (error) {
      console.error('Failed to load existing WSNs:', error);
    }
  };

  // ====== SINGLE ENTRY FUNCTIONS ======
  const handleWSNBlur = async () => {
    if (!singleWSN.trim()) return;
    try {
      const response = await outboundAPI.getSourceByWSN(singleWSN, activeWarehouse?.id);
      setSourceData(response.data);
      setDuplicateWSN(null);

      // Check if already dispatched
      if (existingOutboundWSNs.has(singleWSN.trim())) {
        toast.error('⚠️ WSN already dispatched!');
        setDuplicateWSN({ wsn: singleWSN });
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast.error('WSN not found in Picking, QC or Inbound');
        setSourceData(null);
      }
    }
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleWSN.trim()) {
      toast.error('WSN is required');
      return;
    }

    if (existingOutboundWSNs.has(singleWSN.trim())) {
      toast.error('❌ Duplicate - WSN already dispatched');
      return;
    }

    setSingleLoading(true);
    try {
      const response = await outboundAPI.multiEntry({
        entries: [{
          wsn: singleWSN,
          ...singleForm,
          source: sourceData?.source,
          ...sourceData // Include ALL master_data columns
        }],
        warehouse_id: activeWarehouse?.id
      });

      toast.success('✓ Outbound entry created successfully!');
      saveVehicleNumber(singleForm.vehicle_no);
      saveCustomerName(singleForm.customer_name);

      setSingleWSN('');
      setSourceData(null);
      setDuplicateWSN(null);
      setSingleForm({
        dispatch_date: new Date().toISOString().split('T')[0],
        customer_name: singleForm.customer_name,
        vehicle_no: singleForm.vehicle_no,
        dispatch_remarks: '',
        other_remarks: ''
      });
      loadExistingWSNs();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create entry');
    } finally {
      setSingleLoading(false);
    }
  };

  // ====== BULK UPLOAD FUNCTIONS ======
  const downloadTemplate = () => {
    const template = [{
      'WSN': 'ABC123',
      'DISPATCH_DATE': new Date().toISOString().split('T')[0],
      'CUSTOMER_NAME': 'John Doe',
      'VEHICLE_NO': 'TN-01-1234',
      'DISPATCH_REMARKS': 'Sample remarks'
    }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Outbound_Template.xlsx');
    toast.success('✓ Template downloaded');
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      toast.error('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', bulkFile);
    formData.append('warehouse_id', activeWarehouse?.id?.toString() || '');

    setBulkLoading(true);
    try {
      const response = await outboundAPI.bulkUpload(formData);
      setBulkCurrentBatch({
        id: response.data.batchId,
        total: response.data.totalRows,
        success: response.data.successCount,
        errors: response.data.errorCount,
        timestamp: response.data.timestamp
      });
      toast.success(`✓ Batch ${response.data.batchId} processed!`);
      setBulkFile(null);
      setTimeout(() => {
        setBulkCurrentBatch(null);
        loadBatches();
        loadExistingWSNs();
      }, 5000);
    } catch (error: any) {
      toast.error('Upload failed');
    } finally {
      setBulkLoading(false);
    }
  };

  // ====== MULTI ENTRY FUNCTIONS ======
  const addMultiRow = () => {
    setMultiRows([
      ...multiRows,
      {
        wsn: '',
        dispatch_date: commonDate,
        customer_name: commonCustomer,
        vehicle_no: commonVehicle,
        dispatch_remarks: '',
        other_remarks: ''
      }
    ]);
  };

  const add30Rows = () => {
    const newRows = generateEmptyRows(30).map(row => ({
      ...row,
      dispatch_date: commonDate,
      customer_name: commonCustomer,
      vehicle_no: commonVehicle
    }));
    setMultiRows([...multiRows, ...newRows]);
    toast.success('✓ Added 30 rows');
  };

  const add10Rows = () => {
    const newRows = generateEmptyRows(10).map(row => ({
      ...row,
      dispatch_date: commonDate,
      customer_name: commonCustomer,
      vehicle_no: commonVehicle
    }));
    setMultiRows([...multiRows, ...newRows]);
    toast.success('✓ Added 10 rows');
  };

  const checkDuplicates = (rows: any[]) => {
    const wsnCounts = new Map();
    const duplicates = new Set<string>();
    rows.forEach(row => {
      if (row.wsn?.trim()) {
        const wsn = row.wsn.trim();
        wsnCounts.set(wsn, (wsnCounts.get(wsn) || 0) + 1);
        if (wsnCounts.get(wsn)! > 1 || existingOutboundWSNs.has(wsn)) {
          duplicates.add(wsn);
        }
      }
    });
    setDuplicateWSNs(duplicates);
  };

  const updateMultiRow = async (index: number, field: string, value: any) => {
    const newRows = [...multiRows];
    (newRows[index] as any)[field] = value;
    setMultiRows(newRows);
    checkDuplicates(newRows);

    if (field === 'wsn' && value.trim()) {
      try {
        const response = await outboundAPI.getSourceByWSN(value, activeWarehouse?.id);
        const sourceInfo = response.data;
        // Include ALL master_data columns
        [...SOURCE_COLUMNS, ...ALL_MASTER_COLUMNS].forEach(col => {
          (newRows[index] as any)[col] = sourceInfo[col] || null;
        });
        setMultiRows([...newRows]);
      } catch (error) {
        console.log('WSN not found');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextCell = document.querySelector(
        `[data-row="${rowIndex}"][data-col="${colIndex + 1}"]`
      ) as HTMLElement;
      if (nextCell) {
        nextCell.focus();
      } else {
        const nextRowFirstCell = document.querySelector(
          `[data-row="${rowIndex + 1}"][data-col="0"]`
        ) as HTMLElement;
        if (nextRowFirstCell) {
          nextRowFirstCell.focus();
        } else {
          addMultiRow();
        }
      }
    }
  };

  const handleMultiSubmit = async () => {
    if (!activeWarehouse?.id) {
      toast.error("Select warehouse first");
      return;
    }

    const filtered = multiRows.filter((r: any) => r.wsn && r.wsn.trim() !== "");
    if (filtered.length === 0) {
      toast.error("No valid WSN rows");
      return;
    }

    // Check duplicates
    const hasDuplicates = filtered.some((r: any) => duplicateWSNs.has(r.wsn.trim()));
    if (hasDuplicates) {
      toast.error("❌ Remove duplicate WSNs before submitting!");
      return;
    }

    try {
      const res = await outboundAPI.multiEntry({ 
        entries: filtered, 
        warehouse_id: activeWarehouse.id 
      });
      toast.success(`✓ Dispatched ${res.data.successCount} items | Batch: ${res.data.batchId}`);
      setMultiResults(res.data.results);
      loadExistingWSNs();
      setMultiRows(generateEmptyRows(5));
      setCommonCustomer('');
      setCommonVehicle('');
    } catch (err: any) {
      console.error(err);
      toast.error("Multi entry failed");
    }
  };

  // ====== OUTBOUND LIST FUNCTIONS ======
  const loadOutboundList = async () => {
    setListLoading(true);
    try {
      const response = await outboundAPI.getList({
        page,
        limit,
        warehouseId: activeWarehouse?.id,
        search: searchFilter,
        source: sourceFilter,
        customer: customerFilter
      });
      setListData(response.data.data);
      setTotal(response.data.total);
    } catch (error: any) {
      toast.error('Failed to load list');
    } finally {
      setListLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await outboundAPI.getCustomers(activeWarehouse?.id);
      setCustomers(response.data || []);
    } catch (error) {
      setCustomers([]);
    }
  };

  const exportToExcel = () => {
    setExportDialogOpen(true);
  };

  const handleAdvancedExport = async () => {
    try {
      let dataToExport = listData;
      if (exportStartDate || exportEndDate || exportBatchId) {
        const response = await outboundAPI.getList({
          page: 1,
          limit: 10000,
          warehouseId: activeWarehouse?.id,
          startDate: exportStartDate,
          endDate: exportEndDate,
          batchId: exportBatchId
        });
        dataToExport = response.data.data;
      }

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Outbound');
      const filename = `outbound_${exportStartDate || 'all'}_${exportEndDate || 'all'}_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`✓ Exported ${dataToExport.length} records`);
      setExportDialogOpen(false);
      setExportStartDate('');
      setExportEndDate('');
      setExportBatchId('');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  // ====== BATCH MANAGEMENT ======
  const loadBatches = async () => {
    setBatchLoading(true);
    try {
      const response = await outboundAPI.getBatches(activeWarehouse?.id?.toString());
      setBatches(response.data);
    } catch (error) {
      console.error('Batches error');
    } finally {
      setBatchLoading(false);
    }
  };

  const deleteBatch = async (batchId: string) => {
    if (!confirm('Delete batch?')) return;
    try {
      await outboundAPI.deleteBatch(batchId);
      toast.success('Batch deleted');
      loadBatches();
      loadExistingWSNs();
    } catch (error) {
      toast.error('Delete failed');
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
        {/* PREMIUM HEADER */}
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
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            📦 Outbound Management
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {activeWarehouse?.name}
          </Typography>
        </Paper>

        {/* PREMIUM TABS */}
        <Paper elevation={3} sx={{ mb: 3, borderRadius: 3, overflow: 'hidden' }}>
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTabs-indicator': {
                height: 3,
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '2px 2px 0 0'
              },
              '& .MuiTab-root': {
                fontWeight: 600,
                fontSize: '0.7rem',
                textTransform: 'none',
                minHeight: 32,
                py: 0.5,
                transition: 'background 0.2s ease',
                '&:hover': {
                  background: 'rgba(102, 126, 234, 0.08)'
                },
                '&.Mui-selected': {
                  color: '#667eea'
                }
              }
            }}
          >
            <Tab label="➕ Single Entry" />
            <Tab label="📤 Bulk Upload" />
            <Tab label="📋 Multi Entry Grid" />
            <Tab label="📊 Outbound List" />
            <Tab label="🗂️ Batch Management" />
          </Tabs>
        </Paper>

        {/* TAB 0: SINGLE ENTRY */}
        {tabValue === 0 && (
          <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
              Entry Form
            </Typography>
            <Box component="form" onSubmit={handleSingleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                  <TextField
                    fullWidth
                    label="WSN"
                    value={singleWSN}
                    onChange={(e) => setSingleWSN(e.target.value)}
                    onBlur={handleWSNBlur}
                    variant="outlined"
                    placeholder="Enter product WSN"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                        fontSize: '0.85rem',
                        '& input': { py: 0.8 }
                      }
                    }}
                  />
                  <TextField
                    fullWidth
                    label="Dispatch Date"
                    type="date"
                    value={singleForm.dispatch_date}
                    onChange={(e) => setSingleForm({ ...singleForm, dispatch_date: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                        fontSize: '0.85rem',
                        '& input': { py: 0.8 }
                      }
                    }}
                  />
                </Box>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                  <Autocomplete
                    fullWidth
                    freeSolo
                    options={customers}
                    value={singleForm.customer_name}
                    onChange={(e, newValue) => setSingleForm({ ...singleForm, customer_name: newValue || '' })}
                    onInputChange={(e, newValue) => setSingleForm({ ...singleForm, customer_name: newValue })}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Customer Name"
                        placeholder="Type or select customer"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1,
                            fontSize: '0.85rem'
                          }
                        }}
                      />
                    )}
                  />
                  <TextField
                    fullWidth
                    label="Vehicle Number"
                    value={singleForm.vehicle_no}
                    onChange={(e) => setSingleForm({ ...singleForm, vehicle_no: e.target.value })}
                    placeholder="Auto-saves for next entry"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                        fontSize: '0.85rem',
                        '& input': { py: 0.8 }
                      }
                    }}
                  />
                </Box>
                <TextField
                  fullWidth
                  label="Dispatch Remarks"
                  value={singleForm.dispatch_remarks}
                  onChange={(e) => setSingleForm({ ...singleForm, dispatch_remarks: e.target.value })}
                  multiline
                  rows={2}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1,
                      fontSize: '0.85rem'
                    }
                  }}
                />
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={singleLoading || !singleWSN.trim()}
                startIcon={singleLoading ? <CircularProgress size={20} /> : <CheckIcon />}
                sx={{
                  mt: 3,
                  py: 0.7,
                  borderRadius: 1,
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: '0 10px 30px rgba(102, 126, 234, 0.4)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 15px 40px rgba(102, 126, 234, 0.5)',
                    transform: 'translateY(-3px)'
                  },
                  '&:disabled': {
                    background: 'rgba(0,0,0,0.12)',
                    boxShadow: 'none'
                  }
                }}
              >
                {singleLoading ? 'Dispatching...' : '✓ Dispatch Item'}
              </Button>
            </Box>

            {sourceData && (
              <Card sx={{ mt: 3, borderRadius: 2, boxShadow: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: '#667eea' }}>
                    Source Data Found
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#666' }}>Source</Typography>
                      <Typography variant="body2"><Chip label={sourceData.source} size="small" color="primary" /></Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#666' }}>Product Title</Typography>
                      <Typography variant="body2">{sourceData.product_title || 'N/A'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#666' }}>Brand</Typography>
                      <Typography variant="body2">{sourceData.brand || 'N/A'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#666' }}>Rack No</Typography>
                      <Typography variant="body2">{sourceData.rack_no || 'N/A'}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            )}

            {duplicateWSN && (
              <Alert
                severity="warning"
                sx={{
                  mt: 3,
                  borderRadius: 2,
                  border: '2px solid #f59e0b',
                  boxShadow: '0 10px 30px rgba(245, 158, 11, 0.2)',
                  '& .MuiAlert-message': {
                    fontWeight: 600
                  }
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>⚠️ Duplicate Detected!</Typography>
                <Typography variant="body2">This WSN has already been dispatched.</Typography>
              </Alert>
            )}
          </Paper>
        )}

        {/* TAB 1: BULK UPLOAD */}
        {tabValue === 1 && (
          <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
              Upload Data
            </Typography>
            <Stack spacing={2}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={downloadTemplate}
                sx={{
                  py: 0.8,
                  borderRadius: 1.5,
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  borderWidth: 1.5,
                  borderColor: '#06b6d4',
                  color: '#0891b2',
                  '&:hover': {
                    borderWidth: 1.5,
                    borderColor: '#0891b2',
                    background: 'rgba(6, 182, 212, 0.05)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(6, 182, 212, 0.15)'
                  }
                }}
              >
                Download Template
              </Button>

              <input
                type="file"
                accept=".xlsx,.xls"
                hidden
                id="bulk-upload-input"
                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="bulk-upload-input">
                <Button
                  component="span"
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  sx={{
                    py: 0.8,
                    borderRadius: 1.5,
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: '#667eea',
                    color: '#667eea',
                    '&:hover': {
                      borderWidth: 1.5,
                      borderColor: '#764ba2',
                      background: 'rgba(102, 126, 234, 0.05)'
                    }
                  }}
                >
                  Choose Excel File
                </Button>
              </label>

              {bulkFile && (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  {bulkFile.name}
                </Alert>
              )}

              <Button
                variant="contained"
                fullWidth
                disabled={!bulkFile || bulkLoading}
                onClick={handleBulkUpload}
                startIcon={bulkLoading ? <CircularProgress size={20} /> : <UploadIcon />}
                sx={{
                  py: 0.8,
                  borderRadius: 1.5,
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                  boxShadow: '0 6px 20px rgba(6, 182, 212, 0.3)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 8px 25px rgba(6, 182, 212, 0.4)',
                    transform: 'translateY(-2px)'
                  },
                  '&:disabled': {
                    background: 'rgba(0,0,0,0.12)',
                    boxShadow: 'none'
                  }
                }}
              >
                {bulkLoading ? 'Uploading...' : '🚀 Upload & Process'}
              </Button>

              {bulkCurrentBatch && (
                <Card sx={{ mt: 2, borderRadius: 2, boxShadow: 3 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: '#10b981' }}>
                      Batch Processing Complete!
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#666' }}>Batch ID</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{bulkCurrentBatch.id}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Chip label={`Total: ${bulkCurrentBatch.total}`} color="primary" />
                        <Chip label={`Success: ${bulkCurrentBatch.success}`} color="success" />
                        <Chip label={`Errors: ${bulkCurrentBatch.errors}`} color="error" />
                      </Box>
                      <Box>
                        <Typography variant="caption">📅 {new Date(bulkCurrentBatch.timestamp).toLocaleString()}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Paper>
        )}

        {/* TAB 2: MULTI ENTRY GRID */}
        {tabValue === 2 && (
          <Paper elevation={3} sx={{ p: 0, borderRadius: 3 }}>
            {/* TOP CONTROLS - FIXED */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{
                p: 2,
                position: 'sticky',
                top: 0,
                zIndex: 100,
                bgcolor: '#f8f9fa',
                borderBottom: '2px solid #e5e7eb',
                alignItems: { xs: 'stretch', sm: 'center' },
                justifyContent: 'space-between'
              }}
            >
              {/* LEFT SIDE */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  label="Dispatch Date"
                  type="date"
                  value={commonDate}
                  onChange={(e) => setCommonDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    minWidth: { xs: "100%", sm: 150 },
                    "& .MuiOutlinedInput-root": { borderRadius: 1, fontSize: "0.75rem" },
                  }}
                />
                <Autocomplete
                  freeSolo
                  options={customers}
                  value={commonCustomer}
                  onChange={(e, newValue) => setCommonCustomer(newValue || '')}
                  onInputChange={(e, newValue) => setCommonCustomer(newValue)}
                  sx={{ minWidth: { xs: "100%", sm: 150 } }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Customer (All Rows)"
                      sx={{
                        "& .MuiOutlinedInput-root": { borderRadius: 1, fontSize: "0.75rem" },
                      }}
                    />
                  )}
                />
                <TextField
                  label="Vehicle (All Rows)"
                  value={commonVehicle}
                  onChange={(e) => setCommonVehicle(e.target.value)}
                  sx={{
                    minWidth: { xs: "100%", sm: 150 },
                    "& .MuiOutlinedInput-root": { borderRadius: 1, fontSize: "0.75rem" },
                  }}
                />
              </Stack>

              {/* RIGHT SIDE */}
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  onClick={() => setColumnSettingsOpen(true)}
                  sx={{
                    fontSize: "0.7rem",
                    borderRadius: 1,
                    fontWeight: 700,
                  }}
                >
                  Columns
                </Button>
                <Button variant="contained" startIcon={<AddIcon />} onClick={add10Rows}>
                  +10 Rows
                </Button>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={add30Rows}>
                  +30 Rows
                </Button>
              </Stack>
            </Stack>

            {/* EXCEL STYLE TABLE - SCROLLABLE */}
            <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)', overflow: 'auto' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 700, fontSize: '0.7rem', py: 0.8 }}>#</TableCell>
                    {visibleColumns.map(col => (
                      <TableCell key={col} sx={{ bgcolor: '#f5f5f5', fontWeight: 700, fontSize: '0.7rem', py: 0.8 }}>
                        {col.replace(/_/g, ' ').toUpperCase()}
                      </TableCell>
                    ))}
                    <TableCell sx={{ bgcolor: '#f5f5f5', fontWeight: 700, fontSize: '0.7rem', py: 0.8 }}>STATUS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {multiRows.map((row, index) => {
                    const wsnTrimmed = row.wsn?.trim();
                    const isDuplicate = duplicateWSNs.has(wsnTrimmed);
                    return (
                      <TableRow key={index}>
                        <TableCell sx={{ fontSize: '0.7rem', py: 0.5 }}>{index + 1}</TableCell>
                        
                                                {visibleColumns.map((col, colIdx) => (
                          <TableCell key={col} sx={{ py: 0.5 }}>
                            {col.includes('date') ? (
                              <TextField
                                type="date"
                                value={(row as any)[col]}
                                onChange={(e) => updateMultiRow(index, col, e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                                sx={{
                                  '& .MuiOutlinedInput-input': { p: 0.5, fontWeight: 500, fontSize: '0.8rem' },
                                  '& .MuiOutlinedInput-notchedOutline': { borderWidth: 1, borderColor: '#d1d5db' },
                                  '& .MuiOutlinedInput-root': { borderRadius: 0, bgcolor: '#ffffff' }
                                }}
                              />
                            ) : col === 'customer_name' ? (
                              <Autocomplete
                                freeSolo
                                options={customers}
                                value={(row as any)[col] || ''}
                                onChange={(e, newValue) => updateMultiRow(index, col, newValue || '')}
                                onInputChange={(e, newValue) => updateMultiRow(index, col, newValue)}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    fullWidth
                                    placeholder="Select or type customer"
                                    inputProps={{
                                      ...params.inputProps,
                                      'data-row': index,
                                      'data-col': colIdx
                                    }}
                                    sx={{
                                      '& .MuiOutlinedInput-root': {
                                        bgcolor: '#ffffff',
                                        borderRadius: 0,
                                        '& .MuiOutlinedInput-input': { p: 0.5, fontWeight: 500, fontSize: '0.8rem' },
                                        '& .MuiOutlinedInput-notchedOutline': { borderWidth: 1, borderColor: '#d1d5db' },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#9ca3af'
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                          borderWidth: 2,
                                          borderColor: '#3b82f6'
                                        }
                                      }
                                    }}
                                  />
                                )}
                              />
                            ) : (
                              <TextField
                                value={(row as any)[col]}
                                onChange={(e) => updateMultiRow(index, col, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, index, colIdx)}
                                inputProps={{
                                  'data-row': index,
                                  'data-col': colIdx
                                }}
                                fullWidth
                                multiline={col === 'dispatch_remarks'}
                                maxRows={col === 'dispatch_remarks' ? 2 : 1}
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    bgcolor: col === 'wsn' && isDuplicate ? '#fee2e2' : '#ffffff',
                                    borderRadius: 0,
                                    '&:hover': {
                                      bgcolor: '#f9fafb'
                                    },
                                    '&.Mui-focused': {
                                      bgcolor: '#ffffff',
                                      '& .MuiOutlinedInput-notchedOutline': {
                                        borderWidth: 2,
                                        borderColor: '#3b82f6'
                                      }
                                    },
                                    '& .MuiOutlinedInput-input': { p: 0.5, fontWeight: 500, fontSize: '0.8rem' },
                                    '& .MuiOutlinedInput-notchedOutline': { borderWidth: 1, borderColor: '#d1d5db' }
                                  }
                                }}
                              />
                            )}
                          </TableCell>
                        ))}

                        
                        <TableCell sx={{ py: 0.5, textAlign: 'center' }}>
                          {isDuplicate ? (
                            <Chip label="DUP" size="small" color="error" sx={{ fontSize: '0.65rem', height: 20 }} />
                          ) : multiResults[index]?.status === 'SUCCESS' ? (
                            <CheckIcon sx={{ color: '#10b981', fontSize: 16 }} />
                          ) : (
                            <span>-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* SUBMIT BUTTON - FIXED */}
            <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderTop: '2px solid #e5e7eb' }}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleMultiSubmit}
                disabled={multiLoading || multiRows.filter(r => r.wsn?.trim()).length === 0}
                startIcon={multiLoading ? <CircularProgress size={20} /> : <CheckIcon />}
                sx={{
                  py: 0.9,
                  borderRadius: 1.5,
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 15px 40px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 20px 50px rgba(16, 185, 129, 0.5)',
                    transform: 'translateY(-4px)'
                  },
                  '&:disabled': {
                    background: 'rgba(0,0,0,0.12)',
                    boxShadow: 'none'
                  }
                }}
              >
                {multiLoading ? '⏳ Submitting...' : `✓ Submit All (${multiRows.filter(r => r.wsn?.trim()).length} rows)`}
              </Button>
            </Box>

            {/* COLUMN SETTINGS DIALOG */}
            <Dialog
              open={columnSettingsOpen}
              onClose={() => setColumnSettingsOpen(false)}
              maxWidth="sm"
              fullWidth
              PaperProps={{
                sx: {
                  borderRadius: 3,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                }
              }}
            >
              <DialogTitle>⚙️ Column Settings</DialogTitle>
              <DialogContent>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>Default Columns</Typography>
                {DEFAULT_MULTI_COLUMNS.map(col => (
                  <FormControlLabel
                    key={col}
                    control={
                      <Checkbox
                        checked={visibleColumns.includes(col)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const originalOrder = [...DEFAULT_MULTI_COLUMNS, ...SOURCE_COLUMNS, ...ALL_MASTER_COLUMNS];
                            const newVisible = [...visibleColumns, col];
                            const sortedVisible = originalOrder.filter(c => newVisible.includes(c));
                            saveColumnSettings(sortedVisible);
                          } else {
                            saveColumnSettings(visibleColumns.filter(c => c !== col));
                          }
                        }}
                        sx={{
                          '&.Mui-checked': {
                            color: '#667eea'
                          }
                        }}
                      />
                    }
                    label={col.toUpperCase().replace(/_/g, ' ')}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(102, 126, 234, 0.05)'
                      }
                    }}
                  />
                ))}

                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>Source Data Columns</Typography>
                {SOURCE_COLUMNS.map(col => (
                  <FormControlLabel
                    key={col}
                    control={
                      <Checkbox
                        checked={visibleColumns.includes(col)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const originalOrder = [...DEFAULT_MULTI_COLUMNS, ...SOURCE_COLUMNS, ...ALL_MASTER_COLUMNS];
                            const newVisible = [...visibleColumns, col];
                            const sortedVisible = originalOrder.filter(c => newVisible.includes(c));
                            saveColumnSettings(sortedVisible);
                          } else {
                            saveColumnSettings(visibleColumns.filter(c => c !== col));
                          }
                        }}
                        sx={{
                          '&.Mui-checked': {
                            color: '#764ba2'
                          }
                        }}
                      />
                    }
                    label={col.toUpperCase().replace(/_/g, ' ')}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(118, 75, 162, 0.05)'
                      }
                    }}
                  />
                ))}

                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>Master Data Columns</Typography>
                {ALL_MASTER_COLUMNS.map(col => (
                  <FormControlLabel
                    key={col}
                    control={
                      <Checkbox
                        checked={visibleColumns.includes(col)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const originalOrder = [...DEFAULT_MULTI_COLUMNS, ...SOURCE_COLUMNS, ...ALL_MASTER_COLUMNS];
                            const newVisible = [...visibleColumns, col];
                            const sortedVisible = originalOrder.filter(c => newVisible.includes(c));
                            saveColumnSettings(sortedVisible);
                          } else {
                            saveColumnSettings(visibleColumns.filter(c => c !== col));
                          }
                        }}
                        sx={{
                          '&.Mui-checked': {
                            color: '#10b981'
                          }
                        }}
                      />
                    }
                    label={col.toUpperCase().replace(/_/g, ' ')}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(16, 185, 129, 0.05)'
                      }
                    }}
                  />
                ))}
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setColumnSettingsOpen(false)}
                  variant="contained"
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    px: 4,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  }}
                >
                  Done
                </Button>
              </DialogActions>
            </Dialog>
          </Paper>
        )}

        {/* TAB 3: OUTBOUND LIST */}
        {tabValue === 3 && (
          <Paper elevation={3} sx={{ p: 0, borderRadius: 3 }}>
            {/* FILTER CONTROLS - FIXED */}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{
                p: 2,
                position: 'sticky',
                top: 0,
                zIndex: 100,
                bgcolor: '#f8f9fa',
                borderBottom: '2px solid #e5e7eb',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Stack direction="row" spacing={1} sx={{ flex: 1 }}>
                <TextField
                  label="Search WSN, Product, Brand..."
                  value={searchFilter}
                  onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1,
                      fontWeight: 600,
                      fontSize: '0.7rem'
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: '0.65rem'
                    }
                  }}
                />
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>Source</InputLabel>
                  <Select
                    value={sourceFilter}
                    onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                        fontWeight: 600,
                        fontSize: '0.7rem'
                      }
                    }}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="PICKING">PICKING</MenuItem>
                    <MenuItem value="QC">QC</MenuItem>
                    <MenuItem value="INBOUND">INBOUND</MenuItem>
                  </Select>
                </FormControl>
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>Customer</InputLabel>
                  <Select
                    value={customerFilter}
                    onChange={(e) => { setCustomerFilter(e.target.value); setPage(1); }}
                    fullWidth
                    label="Customer"
                  >
                    <MenuItem value="">All</MenuItem>
                    {customers.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl sx={{ minWidth: 70 }}>
                  <InputLabel>Limit</InputLabel>
                  <Select
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                    fullWidth
                    label="Limit"
                  >
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                    <MenuItem value={250}>250</MenuItem>
                    <MenuItem value={500}>500</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              <Stack direction="row" spacing={1}>
                <Button
                  startIcon={<DownloadIcon />}
                  onClick={exportToExcel}
                  variant="contained"
                  sx={{
                    borderRadius: 1,
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    py: 0.5,
                    px: 1.2,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                    '&:hover': {
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
                    }
                  }}
                >
                  Export
                </Button>
                <Button
                  startIcon={<SettingsIcon />}
                  onClick={() => setListColumnSettingsOpen(true)}
                  variant="outlined"
                  sx={{
                    borderRadius: 1,
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    py: 0.5,
                    px: 1.2,
                    borderWidth: 1.5,
                    '&:hover': {
                      borderWidth: 1.5
                    }
                  }}
                >
                  Columns
                </Button>
              </Stack>
            </Stack>

            {/* TABLE - SCROLLABLE */}
            <TableContainer sx={{ maxHeight: 'calc(100vh - 350px)', overflow: 'auto' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {listColumns.map(col => (
                      <TableCell key={col} sx={{ bgcolor: '#f5f5f5', fontWeight: 700, fontSize: '0.7rem', py: 0.8 }}>
                        {col.toUpperCase().replace(/_/g, ' ')}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {listLoading ? (
                    <TableRow>
                      <TableCell colSpan={listColumns.length} align="center" sx={{ py: 4 }}>
                        <CircularProgress size={30} />
                        <Typography variant="body2" sx={{ mt: 1 }}>Loading data...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : listData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={listColumns.length} align="center" sx={{ py: 4 }}>
                        <Typography variant="h6">📭 No data found</Typography>
                        <Typography variant="body2" color="text.secondary">Try adjusting your filters</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    listData.map((item, idx) => (
                      <TableRow key={idx} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                        {listColumns.map(col => (
                          <TableCell key={col} sx={{ fontSize: '0.75rem', py: 0.8 }}>
                            {col === 'source' ? (
                              <Chip label={item[col]} size="small" color="primary" sx={{ fontSize: '0.65rem', height: 20 }} />
                            ) : col === 'dispatch_date' ? (
                              new Date(item[col]).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })
                            ) : (
                              item[col] || '-'
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* PAGINATION - FIXED */}
            <Stack
              direction="row"
              sx={{
                p: 2,
                bgcolor: '#f8f9fa',
                borderTop: '2px solid #e5e7eb',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                📊 {listData.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, total)} of {total}
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="outlined"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  sx={{
                    borderRadius: 1.5,
                    fontWeight: 600,
                    borderWidth: 1.5,
                    fontSize: '0.75rem',
                    minWidth: 80,
                    py: 0.5,
                    '&:hover': {
                      borderWidth: 1.5
                    }
                  }}
                >
                  ◀ Prev
                </Button>

                <Typography variant="body2" sx={{ px: 2, fontSize: '0.75rem', fontWeight: 600 }}>
                  {page} / {Math.ceil(total / limit) || 1}
                </Typography>

                <Button
                  variant="outlined"
                  disabled={page >= Math.ceil(total / limit)}
                  onClick={() => setPage(page + 1)}
                  sx={{
                    borderRadius: 1.5,
                    fontWeight: 600,
                    borderWidth: 1.5,
                    fontSize: '0.75rem',
                    minWidth: 80,
                    py: 0.5,
                    '&:hover': {
                      borderWidth: 1.5
                    }
                  }}
                >
                  Next ▶
                </Button>
              </Stack>
            </Stack>

            {/* EXPORT DIALOG */}
            <Dialog
              open={exportDialogOpen}
              onClose={() => setExportDialogOpen(false)}
              maxWidth="sm"
              fullWidth
              PaperProps={{
                sx: {
                  borderRadius: 3,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                }
              }}
            >
              <DialogTitle>📤 Advanced Export Options</DialogTitle>
              <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <TextField
                    fullWidth
                    label="Start Date"
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2
                      }
                    }}
                  />
                  <TextField
                    fullWidth
                    label="End Date"
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2
                      }
                    }}
                  />
                  <FormControl fullWidth>
                    <InputLabel>Batch ID (Optional)</InputLabel>
                    <Select
                      value={exportBatchId}
                      onChange={(e) => setExportBatchId(e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2
                        }
                      }}
                    >
                      <MenuItem value="">All Batches</MenuItem>
                      {batches.map(b => (
                        <MenuItem key={b.batch_id} value={b.batch_id}>
                          {b.batch_id} ({b.count} entries)
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    💡 Leave filters empty to export all current list data
                  </Alert>
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setExportDialogOpen(false)}
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
                  startIcon={<DownloadIcon />}
                  onClick={handleAdvancedExport}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    px: 4,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 6px 20px rgba(16, 185, 129, 0.3)',
                    '&:hover': {
                      boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)'
                    }
                  }}
                >
                  Export to Excel
                </Button>
              </DialogActions>
            </Dialog>

            {/* LIST COLUMN SETTINGS DIALOG */}
            <Dialog
              open={listColumnSettingsOpen}
              onClose={() => setListColumnSettingsOpen(false)}
              maxWidth="sm"
              fullWidth
              PaperProps={{
                sx: {
                  borderRadius: 3,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                }
              }}
            >
              <DialogTitle>⚙️ Outbound List Columns</DialogTitle>
              <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select columns to display in the outbound list table
                </Typography>
                {['wsn', 'customer_name', 'product_title', 'brand', 'source', 'dispatch_date', 'vehicle_no', 'batch_id', 'mrp', 'fsp', 'rack_no', 'dispatch_remarks', ...ALL_MASTER_COLUMNS].map(col => (
                  <FormControlLabel
                    key={col}
                    control={
                      <Checkbox
                        checked={listColumns.includes(col)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            saveListColumnSettings([...listColumns, col]);
                          } else {
                            saveListColumnSettings(listColumns.filter(c => c !== col));
                          }
                        }}
                        sx={{
                          '&.Mui-checked': {
                            color: '#667eea'
                          }
                        }}
                      />
                    }
                    label={col.toUpperCase().replace(/_/g, ' ')}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(102, 126, 234, 0.05)'
                      }
                    }}
                  />
                ))}
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setListColumnSettingsOpen(false)}
                  variant="contained"
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    px: 4,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  }}
                >
                  Done
                </Button>
              </DialogActions>
            </Dialog>
          </Paper>
        )}

        {/* TAB 4: BATCH MANAGEMENT */}
        {tabValue === 4 && (
          <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)', overflow: 'auto' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {[
                      "🗂️ Batch ID",
                      "📊 Count",
                      "🕒 Last Updated",
                      "⚡ Action"
                    ].map((label, idx) => (
                      <TableCell key={idx} sx={{ bgcolor: '#f5f5f5', fontWeight: 700, fontSize: '0.7rem', py: 0.8 }}>
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <Typography variant="h6">📭 No batches found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    batches.map((batch, idx) => (
                      <TableRow key={idx} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                        <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'monospace', py: 0.8 }}>
                          {batch.batch_id}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', py: 0.8 }}>
                          <Chip label={batch.count} size="small" color="primary" />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', py: 0.8 }}>
                          {new Date(batch.last_updated).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell sx={{ py: 0.8 }}>
                          <Button
                            variant="contained"
                            color="error"
                            size="small"
                            startIcon={<DeleteIcon />}
                            onClick={() => deleteBatch(batch.batch_id)}
                            sx={{
                              borderRadius: 2,
                              fontWeight: 700,
                              fontSize: "0.7rem",
                              px: 1.5,
                              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                              '&:hover': {
                                transform: 'translateY(-2px)'
                              }
                            }}
                          >
                            Delete
                          </Button>
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
