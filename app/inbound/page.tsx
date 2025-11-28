'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Stack, Tab, Tabs,
  CircularProgress, Alert, Card, CardContent, LinearProgress, Divider,
  Select, FormControl, InputLabel, Checkbox, FormControlLabel, Grid
} from '@mui/material';
import {
  Add as AddIcon, Download as DownloadIcon, Upload as UploadIcon,
  Settings as SettingsIcon, CheckCircle as CheckIcon, Info as InfoIcon,
  Delete as DeleteIcon, Refresh as RefreshIcon, OpenInNew as OpenIcon
} from '@mui/icons-material';
import { inboundAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';

// Constants
const DEFAULT_MULTI_COLUMNS = ['wsn', 'product_serial_number', 'rack_no', 'unload_remarks'];
const ALL_MASTER_COLUMNS = ['wid', 'fsn', 'product_title', 'brand', 'mrp', 'fsp', 'hsn_sac', 'igst_rate', 'cms_vertical', 'fkt_link'];

export default function InboundPage() {
  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);
  const [tabValue, setTabValue] = useState(0);

  // ====== SINGLE ENTRY STATE ======
  const [singleWSN, setSingleWSN] = useState('');
  const [masterData, setMasterData] = useState<any>(null);
  const [singleForm, setSingleForm] = useState({
    inbound_date: new Date().toISOString().split('T')[0],
    vehicle_no: '',
    product_serial_number: '',
    rack_no: '',
    unload_remarks: ''
  });
  const [singleLoading, setSingleLoading] = useState(false);
  const [duplicateWSN, setDuplicateWSN] = useState<any>(null);
  const [racks, setRacks] = useState<any[]>([]);

  // ====== BULK UPLOAD STATE ======
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkCurrentBatch, setBulkCurrentBatch] = useState<any>(null);

  // ====== MULTI ENTRY STATE ======
  const generateEmptyRows = (count: number) => {
    return Array.from({ length: count }, () => ({
      wsn: '',
      inbound_date: new Date().toISOString().split('T')[0],
      vehicle_no: '',
      product_serial_number: '',
      rack_no: '',
      unload_remarks: ''
    }));
  };

  // States
  const [multiRows, setMultiRows] = useState<any[]>(generateEmptyRows(5));
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiResults, setMultiResults] = useState<any[]>([]);
  const [duplicateWSNs, setDuplicateWSNs] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_MULTI_COLUMNS);  
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [commonDate, setCommonDate] = useState(new Date().toISOString().split('T')[0]);
  const [commonVehicle, setCommonVehicle] = useState('');

  // ====== INBOUND LIST STATE ======
  const [listData, setListData] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [total, setTotal] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [listColumns, setListColumns] = useState<string[]>(['wsn', 'product_title', 'brand', 'cms_vertical', 'vehicle_no', 'batch_id']);
  const [listColumnSettingsOpen, setListColumnSettingsOpen] = useState(false);

  // ====== BATCH MANAGEMENT STATE ======
  const [batches, setBatches] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // ====== EXPORT STATE ======
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportBatchId, setExportBatchId] = useState('');

  const [existingInboundWSNs, setExistingInboundWSNs] = useState(new Set());

useEffect(() => {
  async function fetchExistingWSNs() {
    try {
      const res = await inboundAPI.getAllInboundWSNs();
      setExistingInboundWSNs(new Set(res.data)); // assuming res.data is string[] of WSNs
    } catch (error) {
      console.error('Failed to fetch existing inbound WSNs', error);
    }
  }
  fetchExistingWSNs();
}, []);

  // ====== AUTH CHECK ======
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(storedUser);
  }, [router]);

  // ====== VEHICLE PERSISTENCE ======
  useEffect(() => {
    const savedVehicle = localStorage.getItem('lastVehicleNumber');
    if (savedVehicle) {
      setSingleForm(prev => ({ ...prev, vehicle_no: savedVehicle }));
      setCommonVehicle(savedVehicle);
    }
  }, []);

  const saveVehicleNumber = (vehicle: string) => {
    if (vehicle.trim()) {
      localStorage.setItem('lastVehicleNumber', vehicle);
    }
  };

  // ====== LOAD COLUMN SETTINGS FROM LOCALSTORAGE ======
  useEffect(() => {
    const saved = localStorage.getItem('multiEntryColumns');
    if (saved) {
      try {
        setVisibleColumns(JSON.parse(saved));
      } catch (e) {
        console.log('Column settings load error');
      }
    }

    const savedList = localStorage.getItem('inboundListColumns');
    if (savedList) {
      try {
        setListColumns(JSON.parse(savedList));
      } catch (e) {
        console.log('List column settings load error');
      }
    }
  }, []);

  // ====== SAVE COLUMN SETTINGS ======
  const saveColumnSettings = (cols: string[]) => {
    setVisibleColumns(cols);
    localStorage.setItem('multiEntryColumns', JSON.stringify(cols));
  };

  const saveListColumnSettings = (cols: string[]) => {
    setListColumns(cols);
    localStorage.setItem('inboundListColumns', JSON.stringify(cols));
  };

  // ====== LOAD DATA ON TAB CHANGE ======
  useEffect(() => {
    if (activeWarehouse && tabValue === 0) {
      loadRacks();
      loadBatches();
      loadInboundList();
      loadBrands();
      loadCategories();
    }
  }, [activeWarehouse, tabValue]);

  useEffect(() => {
    if (activeWarehouse && tabValue === 3) {
      loadInboundList();
      loadBrands();
      loadCategories();
      loadBatches();
    }
  }, [activeWarehouse, tabValue, page, limit, searchFilter, brandFilter, categoryFilter]);

  // ====== RACK MANAGEMENT ======
  const loadRacks = async () => {
    try {
      const response = await inboundAPI.getWarehouseRacks(activeWarehouse?.id);
      setRacks(response.data);
    } catch (error) {
      console.error('Failed to load racks');
    }
  };

  // ====== SINGLE ENTRY FUNCTIONS ======
  const handleWSNBlur = async () => {
    if (!singleWSN.trim()) return;
    
    try {
      const response = await inboundAPI.getMasterDataByWSN(singleWSN);
      setMasterData(response.data);
      setDuplicateWSN(null);
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast.error('WSN not found in master data');
        setMasterData(null);
      }
    }
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!singleWSN.trim()) {
      toast.error('WSN is required');
      return;
    }

    setSingleLoading(true);
    try {
      const response = await inboundAPI.createSingle({
        wsn: singleWSN,
        ...singleForm,
        warehouse_id: activeWarehouse?.id
      });

      if (response.data.action === 'created') {
        toast.success('✓ Inbound entry created successfully!');
        saveVehicleNumber(singleForm.vehicle_no);
      } else if (response.data.action === 'updated') {
        toast.success('✓ Inbound entry updated successfully!');
        saveVehicleNumber(singleForm.vehicle_no);
      }

      setSingleWSN('');
      setMasterData(null);
      setDuplicateWSN(null);
      setSingleForm({
        inbound_date: new Date().toISOString().split('T')[0],
        vehicle_no: singleForm.vehicle_no,
        product_serial_number: '',
        rack_no: '',
        unload_remarks: ''
      });

    } catch (error: any) {
      if (error.response?.status === 409) {
        setDuplicateWSN(error.response.data);
        toast.error('Duplicate WSN - Click "Update" to modify');
      } else if (error.response?.status === 403) {
        toast.error(`❌ ${error.response.data.error}`);
      } else {
        toast.error(error.response?.data?.error || 'Failed to create entry');
      }
    } finally {
      setSingleLoading(false);
    }
  };

  const handleUpdateDuplicate = async () => {
    setSingleLoading(true);
    try {
      await inboundAPI.createSingle({
        wsn: singleWSN,
        ...singleForm,
        warehouse_id: activeWarehouse?.id,
        update_existing: true
      });

      toast.success('✓ Updated successfully!');
      setSingleWSN('');
      setMasterData(null);
      setDuplicateWSN(null);
      setSingleForm({
        inbound_date: new Date().toISOString().split('T')[0],
        vehicle_no: singleForm.vehicle_no,
        product_serial_number: '',
        rack_no: '',
        unload_remarks: ''
      });
    } catch (error: any) {
      toast.error('Failed to update');
    } finally {
      setSingleLoading(false);
    }
  };

  // ====== BULK UPLOAD FUNCTIONS ======
  const downloadTemplate = () => {
    const template = [{
      'WSN': 'ABC123',
      'INBOUND_DATE': new Date().toISOString().split('T')[0],
      'VEHICLE_NO': 'TN-01-1234',
      'RACK_NO': 'A-01'
    }];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Inbound_Template.xlsx');
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
      const response = await inboundAPI.bulkUpload(formData);
      setBulkCurrentBatch({
        id: response.data.batchId,
        total: response.data.totalRows,
        timestamp: response.data.timestamp
      });
      
      toast.success(`✓ Batch started: ${response.data.batchId}`);
      setBulkFile(null);
      
      setTimeout(() => {
        setBulkProgress(0);
        setBulkCurrentBatch(null);
        loadBatches();
      }, 3000);
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
        inbound_date: commonDate,
        vehicle_no: commonVehicle,
        product_serial_number: '', 
        rack_no: '', 
        unload_remarks: '' 
      }
    ]);
  };

  const add30Rows = () => {
    const newRows = generateEmptyRows(30).map(row => ({
      ...row,
      inbound_date: commonDate,
      vehicle_no: commonVehicle
    }));
    setMultiRows([...multiRows, ...newRows]);
    toast.success('✓ Added 30 rows');
  };

  const add10Rows = () => {
    const newRows = generateEmptyRows(10).map(row => ({
      ...row,
      inbound_date: commonDate,
      vehicle_no: commonVehicle
    }));
    setMultiRows([...multiRows, ...newRows]);
    toast.success('✓ Added 10 rows');
  };

  const checkDuplicates = (rows: any[]) => {
    const wsnCounts = new Map<string, number>();
    const duplicates = new Set<string>();
    
    rows.forEach(row => {
      if (row.wsn?.trim()) {
        const wsn = row.wsn.trim();
        wsnCounts.set(wsn, (wsnCounts.get(wsn) || 0) + 1);
        if (wsnCounts.get(wsn)! > 1) {
          duplicates.add(wsn);
        }
      }
    });
    
    setDuplicateWSNs(duplicates);
  };

  const updateMultiRow = async (index: number, field: string, value: any) => {
    const newRows = [...multiRows];
    newRows[index][field] = value;
    setMultiRows(newRows);

    checkDuplicates(newRows);

    if (field === 'wsn' && value.trim()) {
      try {
        const response = await inboundAPI.getMasterDataByWSN(value);
        const masterInfo = response.data;
        
        ALL_MASTER_COLUMNS.forEach(col => {
          newRows[index][col] = masterInfo[col] || null;
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

  try {
    const res = await inboundAPI.multiEntry(filtered, activeWarehouse.id);

    toast.success(`Saved ${res.data.successCount} rows`);
    setMultiResults(res.data.results);

  } catch (err: any) {
    console.error(err);
    toast.error("Multi entry failed");
  }
 };


  // ====== INBOUND LIST FUNCTIONS ======
  const loadInboundList = async () => {
    setListLoading(true);
    try {
      const response = await inboundAPI.getAll(page, limit, {
        warehouseId: activeWarehouse?.id,
        search: searchFilter,
        brand: brandFilter,
        category: categoryFilter
      });
      setListData(response.data.data);
      setTotal(response.data.total);
    } catch (error: any) {
      toast.error('Failed to load list');
    } finally {
      setListLoading(false);
    }
  };

  const loadBrands = async () => {
    try {
      const response = await inboundAPI.getBrands(activeWarehouse?.id);
      setBrands(response.data || []);
    } catch (error) {
      console.log('Brands error - likely no data');
      setBrands([]);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await inboundAPI.getCategories(activeWarehouse?.id);
      setCategories(response.data || []);
    } catch (error) {
      console.log('Categories error - likely no data');
      setCategories([]);
    }
  };

  const exportToExcel = () => {
    setExportDialogOpen(true);
  };

  const handleAdvancedExport = async () => {
    try {
      let dataToExport = listData;

      if (exportStartDate || exportEndDate || exportBatchId) {
        const response = await inboundAPI.getAll(1, 10000, {
          warehouseId: activeWarehouse?.id,
          startDate: exportStartDate,
          endDate: exportEndDate,
          batchId: exportBatchId
        });
        dataToExport = response.data.data;
      }

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inbound');
      
      const filename = `inbound_${exportStartDate || 'all'}_${exportEndDate || 'all'}_${Date.now()}.xlsx`;
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
      const response = await inboundAPI.getBatches(activeWarehouse?.id?.toString());
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
      await inboundAPI.deleteBatch(batchId);
      toast.success('Batch deleted');
      loadBatches();
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






  //>>>>>>>>>>>>>>>>>>>>>> UI >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  return (
    <AppLayout>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
            borderRadius: '10px',
            padding: '16px',
            fontWeight: 600
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}/>

        <Box sx={{ 
          p: { xs: 0.8, md: 1 }, 
          background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)',
          minHeight: '100vh',
          width: '100%',
          maxWidth: '100vw',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}>
        {/* PREMIUM HEADER */}
        <Box sx={{ 
          mb: 0.8,
          p: 0.8,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 1,
          boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            opacity: 0.3
          }
        }}>
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 700, 
              color: 'white',
              mb: 0.2,
              textShadow: '0 2px 10px rgba(0,0,0,0.2)',
              letterSpacing: '-0.3px',
              fontSize: '0.85rem'
            }}>
              📦 Inbound Management
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip 
                label={activeWarehouse.name}
                size="small"
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 600,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  height: '18px',
                  fontSize: '0.65rem'
                }}
              />
              <Chip 
                label={user?.full_name}
                size="small"
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 500,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  height: '18px',
                  fontSize: '0.65rem'
                }}
              />
            </Stack>
          </Box>
        </Box>

        {/* PREMIUM TABS */}
        <Paper sx={{ 
          mb: 0.5,
          //height:40, 
          borderRadius: 1,
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)'
        }}>
          <Tabs
            value={tabValue}
            onChange={(e, v) => setTabValue(v)}
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
            <Tab icon="📝" iconPosition="start" label="Single Entry" />
            <Tab icon="📤" iconPosition="start" label="Bulk Upload" />
            <Tab icon="📊" iconPosition="start" label="Multi Entry" />
            <Tab icon="📋" iconPosition="start" label="Inbound List" />
            <Tab icon="🗂️" iconPosition="start" label="Batch Manager" />
          </Tabs>
        </Paper>

        {/* TAB 0: SINGLE ENTRY */}
        {tabValue === 0 && (            
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
            <Box sx={{ 
              animation: 'slideInLeft 0.5s ease-out',
              '@keyframes slideInLeft': {
                '0%': { opacity: 0, transform: 'translateX(-30px)' },
                '100%': { opacity: 1, transform: 'translateX(0)' }
              }
            }}>
              <Card sx={{ 
                borderRadius: 1.5,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                background: 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.5)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 6px 16px rgba(102, 126, 234, 0.12)',
                  transform: 'translateY(-1px)'
                }
              }}>
                <CardContent sx={{ p: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 1 }}>
                    <Box sx={{
                      width: 20,
                      height: 20,
                      borderRadius: 0.6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.25)'
                    }}>
                      <Typography sx={{ fontSize: '14px' }}>📝</Typography>
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a237e', fontSize: '0.8rem' }}>
                      Entry Form
                    </Typography>
                  </Stack>                    <Stack spacing={1.8}>
                    <TextField
                      fullWidth
                      size="small"
                      label="WSN *"
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
                      size="small"
                      label="Inbound Date"
                      type="date"
                      value={singleForm.inbound_date}
                      onChange={(e) => setSingleForm({ ...singleForm, inbound_date: e.target.value })}
                      InputLabelProps={{ shrink: true }}
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
                      size="small"
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

                    <FormControl fullWidth size="small">
                      <InputLabel>Rack Number</InputLabel>
                      <Select
                        value={singleForm.rack_no}
                        onChange={(e) => setSingleForm({ ...singleForm, rack_no: e.target.value })}
                        label="Rack Number"
                        sx={{
                          borderRadius: 1,
                          fontSize: '0.85rem',
                          '& .MuiSelect-select': { py: 0.8 }
                        }}
                      >
                        <MenuItem value="">Select Rack</MenuItem>
                        {racks.map(r => (
                          <MenuItem key={r.id} value={r.rack_name}>
                            {r.rack_name} ({r.location})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      fullWidth
                      size="small"
                      label="Product Serial Number"
                      value={singleForm.product_serial_number}
                      onChange={(e) => setSingleForm({ ...singleForm, product_serial_number: e.target.value })}
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
                      size="small"
                      multiline
                      rows={2}
                      label="Unload Remarks"
                      value={singleForm.unload_remarks}
                      onChange={(e) => setSingleForm({ ...singleForm, unload_remarks: e.target.value })}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1,
                          fontSize: '0.85rem'
                        }
                      }}
                    />

                    {duplicateWSN && (
                      <Stack direction="row" spacing={1}>
                        <Button 
                          variant="contained"
                          size="medium"
                          onClick={handleUpdateDuplicate} 
                          fullWidth
                          sx={{
                            py: 0.7,
                            fontSize: '0.8rem',
                            borderRadius: 1,
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            boxShadow: '0 8px 20px rgba(245, 158, 11, 0.3)',
                            '&:hover': {
                              boxShadow: '0 12px 30px rgba(245, 158, 11, 0.4)',
                              transform: 'translateY(-2px)'
                            }
                          }}
                        >
                          🔄 Update Existing
                        </Button>
                        <Button 
                          variant="outlined"
                          size="small"
                          onClick={() => { setSingleWSN(''); setDuplicateWSN(null); }}
                          sx={{
                            fontSize: '0.8rem',
                            borderRadius: 1,
                            fontWeight: 700,
                            borderWidth: 1.5,
                            '&:hover': {
                              borderWidth: 2
                            }
                          }}
                        >
                          Clear
                        </Button>
                      </Stack>
                    )}

                    {!duplicateWSN && (
                      <Button
                        fullWidth
                        variant="contained"
                        size="small"
                        onClick={handleSingleSubmit}
                        disabled={singleLoading}
                        startIcon={singleLoading ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
                        sx={{
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
                        {singleLoading ? 'Adding Entry...' : '✓ Add Entry'}
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ 
              animation: 'slideInRight 0.5s ease-out',
              '@keyframes slideInRight': {
                '0%': { opacity: 0, transform: 'translateX(30px)' },
                '100%': { opacity: 1, transform: 'translateX(0)' }
              }
            }}>
              {masterData && (
                <Card sx={{ 
                  borderRadius: 2,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.12)',
                  background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                  border: '1px solid #10b981',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: '0 6px 16px rgba(16, 185, 129, 0.15)',
                    transform: 'translateY(-1px)'
                  }
                }}>
                  <CardContent sx={{ p: 1.5 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                      <Box sx={{
                        width: 28,
                        height: 28,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#10b981',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                      }}>
                        <CheckIcon sx={{ color: 'white', fontSize: 20 }} />
                      </Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#065f46', fontSize: '0.95rem' }}>
                        Master Data Found
                      </Typography>
                    </Stack>
                    
                    <Divider sx={{ mb: 1.5, borderColor: 'rgba(5, 150, 105, 0.3)' }} />

                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                      <Box sx={{ gridColumn: '1 / -1' }}>
                        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>
                          FSN
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#047857', mt: 0.3, fontSize: '0.9rem' }}>
                          {masterData.fsn || 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ gridColumn: '1 / -1' }}>
                        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.7rem' }}>
                          Product Title
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#047857', mt: 0.3, fontSize: '0.85rem' }}>
                          {masterData.product_title}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                          Category
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#047857', mt: 0.5 }}>
                          {masterData.cms_vertical || 'N/A'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                          Brand
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#047857', mt: 0.5 }}>
                          {masterData.brand || 'N/A'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                          FSP
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#047857', mt: 0.5 }}>
                          ₹ {masterData.fsp || 'N/A'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                          MRP
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#047857', mt: 0.5 }}>
                          ₹ {masterData.mrp || 'N/A'}
                        </Typography>
                      </Box>
                      {masterData.fkt_link && (
                        <Box sx={{ gridColumn: '1 / -1' }}>
                          <Button
                            size="medium"
                            endIcon={<OpenIcon />}
                            onClick={() => window.open(masterData.fkt_link, '_blank')}
                            sx={{
                              mt: 1,
                              borderRadius: 2,
                              fontWeight: 700,
                              background: '#10b981',
                              color: 'white',
                              px: 3,
                              py: 1,
                              '&:hover': {
                                background: '#059669',
                                transform: 'translateX(5px)'
                              }
                            }}
                          >
                            Open FKT Link
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              )}

              {duplicateWSN && (
                <Alert 
                  severity="warning" 
                  icon={<InfoIcon />}
                  sx={{ 
                    mt: masterData ? 3 : 0,
                    borderRadius: 2,
                    border: '2px solid #f59e0b',
                    boxShadow: '0 10px 30px rgba(245, 158, 11, 0.2)',
                    '& .MuiAlert-message': {
                      fontWeight: 600
                    }
                  }}
                >
                  <strong>⚠️ Duplicate Detected!</strong><br />
                  This WSN already exists. Click "Update Existing" to modify the entry.
                </Alert>
              )}
            </Box>
          </Box>
        )}

        {/* TAB 1: BULK UPLOAD */}
        {tabValue === 1 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5 }}>
            <Box sx={{
              animation: 'fadeIn 0.5s ease-out',
              '@keyframes fadeIn': {
                '0%': { opacity: 0, transform: 'scale(0.95)' },
                '100%': { opacity: 1, transform: 'scale(1)' }
              }
            }}>
              <Card sx={{ 
                borderRadius: 1.5,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                background: 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.5)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.12)',
                  transform: 'translateY(-1px)'
                }
              }}>
                <CardContent sx={{ p: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <Box sx={{
                      width: 28,
                      height: 28,
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                      boxShadow: '0 4px 12px rgba(6, 182, 212, 0.25)'
                    }}>
                      <Typography sx={{ fontSize: '18px' }}>📤</Typography>
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a237e', fontSize: '0.9rem' }}>
                      Upload Data
                    </Typography>
                  </Stack>

                  <Stack spacing={1.5}>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
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

                    <Divider sx={{ 
                      my: 1,
                      '&::before, &::after': {
                        borderColor: 'rgba(6, 182, 212, 0.3)'
                      }
                    }}>
                      <Chip label="OR" size="small" sx={{ fontWeight: 700, bgcolor: '#e0f2fe', color: '#0891b2', fontSize: '0.7rem' }} />
                    </Divider>

                    <input
                      accept=".xlsx,.xls"
                      style={{ display: 'none' }}
                      id="bulk-upload"
                      type="file"
                      onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="bulk-upload" style={{ width: '100%' }}>
                      <Button 
                        component="span" 
                        fullWidth 
                        variant="outlined" 
                        size="small"
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
                      <Alert 
                        severity="success" 
                        icon="📄"
                        sx={{ 
                          borderRadius: 1.5,
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          py: 0.5,
                          border: '1.5px solid #10b981',
                          background: '#d1fae5'
                        }}
                      >
                        {bulkFile.name}
                      </Alert>
                    )}

                    <Button
                      fullWidth
                      variant="contained"
                      size="small"
                      onClick={handleBulkUpload}
                      disabled={!bulkFile || bulkLoading}
                      startIcon={bulkLoading ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
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
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            {bulkCurrentBatch && (
              <Box sx={{
                animation: 'slideInRight 0.5s ease-out',
                '@keyframes slideInRight': {
                  '0%': { opacity: 0, transform: 'translateX(30px)' },
                  '100%': { opacity: 1, transform: 'translateX(0)' }
                }
              }}>
                <Card sx={{ 
                  borderRadius: 1.5,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
                  background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                  border: '1.5px solid #10b981'
                }}>
                  <CardContent sx={{ p: 2 }}>
                    <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
                      <Box sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#10b981',
                        boxShadow: '0 6px 20px rgba(16, 185, 129, 0.3)',
                        animation: 'pulse 2s infinite',
                        '@keyframes pulse': {
                          '0%, 100%': { transform: 'scale(1)', opacity: 1 },
                          '50%': { transform: 'scale(1.05)', opacity: 0.9 }
                        }
                      }}>
                        <CheckIcon sx={{ fontSize: 32, color: 'white' }} />
                      </Box>
                      
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#065f46', fontSize: '1rem' }}>
                        Processing Started!
                      </Typography>
                      
                      <Box sx={{ 
                        p: 1.5, 
                        bgcolor: 'rgba(255,255,255,0.6)',
                        borderRadius: 1.5,
                        width: '100%',
                        backdropFilter: 'blur(10px)'
                      }}>
                        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                          Batch ID
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#047857', fontFamily: 'monospace', mt: 0.5, fontSize: '0.9rem' }}>
                          {bulkCurrentBatch.id}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={2}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h5" sx={{ fontWeight: 800, color: '#047857' }}>
                            {bulkCurrentBatch.total}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                            Total Rows
                          </Typography>
                        </Box>
                      </Stack>

                      <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 600, fontSize: '0.7rem' }}>
                        📅 {new Date(bulkCurrentBatch.timestamp).toLocaleString()}
                      </Typography>

                      <LinearProgress 
                        variant="indeterminate" 
                        sx={{ 
                          width: '100%',
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'rgba(5, 150, 105, 0.2)',
                          '& .MuiLinearProgress-bar': {
                            background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                            borderRadius: 3
                          }
                        }} 
                      />
                      
                      <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 600, fontStyle: 'italic', fontSize: '0.7rem' }}>
                        ⏳ Processing in background...
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Box>
            )}
          </Box>
        )}


        {/* TAB 2: MULTI ENTRY ////////////////////////////////////////////////////////////////////////////////////////////////////////////////*/}
        {tabValue === 2 && (
  <Box sx={{
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 230px)',
    animation: 'fadeIn 0.5s ease-out',
    '@keyframes fadeIn': {
      '0%': { opacity: 0 },
      '100%': { opacity: 1 }
    }
  }}>
    {/* TOP CONTROLS - FIXED */}
    <Card sx={{ 
      mb: 1,
      borderRadius: 1.5,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      background: 'rgba(255, 255, 255, 0.98)',
      border: '1px solid rgba(0,0,0,0.08)',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 100,
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <CardContent sx={{ p: 1.2, width: '100%', boxSizing: 'border-box' }}>
        <Stack
  direction={{ xs: "column", md: "row" }}
  alignItems={{ xs: "stretch", md: "center" }}
  spacing={1}
  sx={{
    width: "100%",
    justifyContent: "space-between",
  }}
>
  {/* LEFT SIDE — DATE + VEHICLE */}
  <Stack
    direction={{ xs: "column", sm: "row" }}
    spacing={1.5}
    sx={{ flexShrink: 0 }}
  >
    <TextField
      size="small"
      label="Date"
      type="date"
      value={commonDate}
      onChange={(e) => setCommonDate(e.target.value)}
      InputLabelProps={{ shrink: true }}
      sx={{
        minWidth: { xs: "100%", sm: 150 },
        "& .MuiOutlinedInput-root": { borderRadius: 1, fontSize: "0.75rem" },
      }}
    />

    <TextField
      size="small"
      label="Vehicle"
      value={commonVehicle}
      onChange={(e) => setCommonVehicle(e.target.value)}
      sx={{
        minWidth: { xs: "100%", sm: 150 },
        "& .MuiOutlinedInput-root": { borderRadius: 1, fontSize: "0.75rem" },
      }}
    />
  </Stack>

  {/* RIGHT SIDE — BUTTONS */}
  <Stack
    direction="row"
    spacing={1}
    sx={{
      mt: { xs: 1, md: 0 },         // mobile → add space
      flexWrap: "wrap",
      justifyContent: { xs: "flex-start", md: "flex-end" },
    }}
  >
    <Button
      size="small"
      startIcon={<SettingsIcon sx={{ fontSize: 12 }} />}
      variant="outlined"
      onClick={() => setColumnSettingsOpen(true)}
      sx={{
        fontSize: "0.7rem",
        borderRadius: 1,
        fontWeight: 700,
      }}
    >
      Columns
    </Button>

    <Button
      size="small"
      variant="contained"
      onClick={add10Rows}
      sx={{
        fontSize: "0.7rem",
        borderRadius: 1,
        fontWeight: 700,
        background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
      }}
    >
      +10 Rows
    </Button>

    <Button
      size="small"
      variant="contained"
      onClick={add30Rows}
      sx={{
        fontSize: "0.7rem",
        borderRadius: 1,
        fontWeight: 700,
        background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
      }}
    >
      +30 Rows
    </Button>
  </Stack>
</Stack>

      </CardContent>
    </Card>


    {/* EXCEL STYLE TABLE - SCROLLABLE */}
    <Box sx={{ 
      flex: 1,
      overflow: 'auto',
      minHeight: 0,
      border: '1px solid #d1d5db',
      '&::-webkit-scrollbar': {
        width: 12,
        height: 12
      },
      '&::-webkit-scrollbar-track': {
        background: '#f1f5f9'
      },
      '&::-webkit-scrollbar-thumb': {
        background: '#94a3b8',
        borderRadius: 0
      }
    }}>
      <TableContainer 
        component={Paper} 
        sx={{ 
          borderRadius: 0,
          boxShadow: 'none',
          border: 'none',
          background: '#ffffff',
          height: '100%'
        }}
      >
      <Table 
        size="small"
        stickyHeader
        sx={{
          '& .MuiTableCell-root': {
            borderRight: '1px solid #d1d5db',
            borderBottom: '1px solid #d1d5db',
            padding: '4px 8px',
            fontSize: '0.8rem'
          }
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ 
              color: '#1f2937', 
              fontWeight: 700, 
              width: 50, 
              textAlign: 'center',
              background: '#e5e7eb',
              fontSize: '0.8rem',
              py: 0.8,
              borderRight: '1px solid #9ca3af',
              borderBottom: '1px solid #9ca3af'
            }}>
              #
            </TableCell>
            {visibleColumns.map(col => (
              <TableCell 
                key={col} 
                sx={{ 
                  color: '#1f2937', 
                  fontWeight: 700, 
                  minWidth: 130,
                  background: '#e5e7eb',
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                  py: 0.8,
                  borderRight: '1px solid #9ca3af',
                  borderBottom: '1px solid #9ca3af'
                }}
              >
                {col.replace(/_/g, ' ')}
              </TableCell>
            ))}
            <TableCell sx={{ 
              color: '#1f2937', 
              fontWeight: 700, 
              width: 100, 
              textAlign: 'center',
              background: '#e5e7eb',
              fontSize: '0.8rem',
              py: 0.8,
              borderRight: '1px solid #9ca3af',
              borderBottom: '1px solid #9ca3af'
            }}>
              STATUS
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {multiRows.map((row, index) => {
            const wsnTrimmed = row.wsn?.trim();
            const isDuplicateOrInbound = duplicateWSNs.has(wsnTrimmed) || existingInboundWSNs.has(wsnTrimmed);
            return (
              <TableRow 
                key={index} 
                sx={{ 
                  bgcolor: isDuplicateOrInbound ? '#fef3c7' : '#ffffff',
                  '&:hover': { 
                    bgcolor: isDuplicateOrInbound ? '#fde68a' : '#f3f4f6'
                  }
                }}
              >
                <TableCell sx={{ 
                  textAlign: 'center', 
                  fontWeight: 600, 
                  bgcolor: '#f9fafb',
                  color: '#1f2937',
                  fontSize: '0.8rem',
                  borderRight: '1px solid #d1d5db'
                }}>
                  {index + 1}
                </TableCell>
                {visibleColumns.map((col, colIdx) => (
                  <TableCell key={col} sx={{ p: 0.3, borderRight: '1px solid #d1d5db' }}>
                    {col === 'rack_no' ? (
                      <Select
                        size="small"
                        value={row[col] || ''}
                        onChange={(e) => updateMultiRow(index, col, e.target.value)}
                        fullWidth
                        sx={{ 
                          '& .MuiOutlinedInput-input': { py: 0.5, fontWeight: 500, fontSize: '0.8rem' },
                          '& .MuiOutlinedInput-notchedOutline': { borderWidth: 1, borderColor: '#d1d5db' },
                          '& .MuiOutlinedInput-root': { borderRadius: 0 }
                        }}
                      >
                        <MenuItem value="">-</MenuItem>
                        {racks.map(r => (
                          <MenuItem key={r.id} value={r.rack_name}>{r.rack_name}</MenuItem>
                        ))}
                      </Select>
                    ) : col.includes('date') ? (
                      <TextField
                        size="small"
                        type="date"
                        value={row[col] || ''}
                        onChange={(e) => updateMultiRow(index, col, e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                        sx={{ 
                          '& .MuiOutlinedInput-input': { p: 0.5, fontWeight: 500, fontSize: '0.8rem' },
                          '& .MuiOutlinedInput-notchedOutline': { borderWidth: 1, borderColor: '#d1d5db' },
                          '& .MuiOutlinedInput-root': { borderRadius: 0, bgcolor: '#ffffff' }
                        }}
                      />
                    ) : (
                      <TextField
                        size="small"
                        value={row[col] || ''}
                        onChange={(e) => updateMultiRow(index, col, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, colIdx)}
                        inputProps={{
                          'data-row': index,
                          'data-col': colIdx
                        }}
                        fullWidth
                        multiline={col === 'unload_remarks'}
                        maxRows={col === 'unload_remarks' ? 2 : 1}
                        sx={{ 
                          '& .MuiOutlinedInput-root': {
                            bgcolor: col === 'wsn' && isDuplicateOrInbound ? '#fee2e2' : '#ffffff',
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
                            }
                          },
                          '& .MuiOutlinedInput-input': { p: 0.5, fontWeight: 500, fontSize: '0.8rem' },
                          '& .MuiOutlinedInput-notchedOutline': { borderWidth: 1, borderColor: '#d1d5db' }
                        }}
                      />
                    )}
                  </TableCell>
                ))}
                <TableCell sx={{ textAlign: 'center', p: 0.5 }}>
                  {isDuplicateOrInbound ? (
                    <Chip
                      label="Duplicate WSN Error"
                      color="warning"
                      size="small"
                      sx={{ fontWeight: 700 }}
                    />
                  ) : multiResults[index]?.status === 'SUCCESS' ? (
                    <Chip
                      label="✓"
                      color="success"
                      size="small"
                      sx={{ fontWeight: 800, fontSize: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                    />
                  ) : (
                    <Chip
                      label=""
                      size="small"
                      sx={{ fontWeight: 800, fontSize: '1rem' }}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </TableContainer>
    </Box>

    {/* SUBMIT BUTTON - FIXED */}
    <Button
      fullWidth
      variant="contained"
      size="medium"
      onClick={handleMultiSubmit}
      disabled={multiLoading}
      startIcon={multiLoading ? <CircularProgress size={18} color="inherit" /> : <CheckIcon />}
      sx={{ 
        mt: 10,
        mb: -20,
        width: 400,
        py: 0.9,
        borderRadius: 1.5,
        flexShrink: 0,
        position: 'sticky',
        bottom: 10,
        zIndex: 100,
        fontWeight: 200,
        fontSize: '0.75rem',
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
      <DialogTitle sx={{ 
        fontWeight: 800, 
        fontSize: '1.5rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        py: 2.5
      }}>
        ⚙️ Column Settings
      </DialogTitle>
      <DialogContent sx={{ py: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 800, color: '#667eea', textTransform: 'uppercase', letterSpacing: 1 }}>
          Default Columns
        </Typography>
        <Stack spacing={1.5} sx={{ mb: 3 }}>
          {DEFAULT_MULTI_COLUMNS.map(col => (
            <FormControlLabel key={col}
              control={
                <Checkbox
                  checked={visibleColumns.includes(col)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const originalOrder = [...DEFAULT_MULTI_COLUMNS, ...ALL_MASTER_COLUMNS];
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
              label={<Typography sx={{ fontWeight: 700 }}>{col.toUpperCase().replace(/_/g, ' ')}</Typography>}
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
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 800, color: '#764ba2', textTransform: 'uppercase', letterSpacing: 1 }}>
          Master Data Columns
        </Typography>
        <Stack spacing={1.5}>
          {ALL_MASTER_COLUMNS.map(col => (
            <FormControlLabel key={col}
              control={
                <Checkbox
                  checked={visibleColumns.includes(col)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const originalOrder = [...DEFAULT_MULTI_COLUMNS, ...ALL_MASTER_COLUMNS];
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
              label={<Typography sx={{ fontWeight: 700 }}>{col.toUpperCase().replace(/_/g, ' ')}</Typography>}
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
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
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
  </Box>
   )}
  

        {/* TAB 3: INBOUND LIST */}
        {tabValue === 3 && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: 'calc(100vh - 230px)',
            animation: 'fadeIn 0.5s ease-out',
            pb: 0,
            '@keyframes fadeIn': {
              '0%': { opacity: 0 },
              '100%': { opacity: 1 }
            }
          }}>
            {/* FILTER CONTROLS - FIXED */}
            <Card sx={{ 
              mb: 1,
              borderRadius: 1.5,
              height:50,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              flexShrink: 0,
              background: 'rgba(255, 255, 255, 0.98)',
              border: '1px solid rgba(0,0,0,0.08)',
              position: 'sticky',
              top: 0,
              zIndex: 100
              }}>
              <CardContent sx={{ p: 1.2 }}>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" alignItems="center" sx={{ gap: 0.5 }}>
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <Stack direction="row" spacing={0.5}>
                      <TextField
                        size="small"
                        label="Search"
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
                      <TextField
                        select
                        size="small"
                        label="Brand"
                        value={brandFilter}
                        onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
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
                      >
                        <MenuItem value="">All</MenuItem>
                        {brands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                      </TextField>
                    </Stack>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5,  flexShrink: 0 }}>
                    <Stack direction="row" spacing={5}>
                      <TextField
                        select
                        size="small"
                        label="Category"
                        value={categoryFilter}
                        onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                        fullWidth
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1,
                            fontWeight: 600,
                            width:120,
                            fontSize: '0.7rem'
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: '0.65rem'
                          }
                        }}
                      >
                        <MenuItem value="">All</MenuItem>
                        {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                      </TextField>
                      <TextField
                        select
                        size="small"
                        label="Per Page"
                        value={limit}
                        onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                        fullWidth
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1,
                            fontWeight: 600,
                            width:70,
                            fontSize: '0.7rem'
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: '0.65rem'
                          }
                        }}
                      >
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                        <MenuItem value={250}>250</MenuItem>
                        <MenuItem value={500}>500</MenuItem>
                      </TextField>
                    </Stack>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Button 
                        size="small"
                        startIcon={<DownloadIcon sx={{ fontSize: 12 }} />} 
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
                        size="small"
                        startIcon={<SettingsIcon sx={{ fontSize: 12 }} />} 
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
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* TABLE - SCROLLABLE */}
            <Box sx={{ 
              flex: 1,
              overflow: 'auto',
              minHeight: 0,
              border: '1px solid #d1d5db',
              '&::-webkit-scrollbar': {
                width: 12,
                height: 12
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f5f9'
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#94a3b8',
                borderRadius: 0
              }
            }}>
              <TableContainer 
                component={Paper} 
                sx={{ 
                  borderRadius: 0,
                  boxShadow: 'none',
                  border: 'none',
                  background: '#ffffff',
                  height: '100%'
                }}
              >
              <Table 
                stickyHeader
                sx={{
                  '& .MuiTableCell-root': {
                    borderRight: '1px solid #d1d5db',
                    borderBottom: '1px solid #d1d5db',
                    padding: '4px 8px',
                    // height: 0.5,
                    fontSize: '0.7rem'
                  }
                }}
              >
                <TableHead>
                  <TableRow>
                    {listColumns.map(col => (
                      <TableCell 
                        key={col} 
                        sx={{ 
                          color: '#1f2937', 
                          fontWeight: 600,
                          background: '#e5e7eb',
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          letterSpacing: 0.3,
                          py: 0.8,
                          borderRight: '1px solid #9ca3af',
                          borderBottom: '1px solid #9ca3af'
                        }}
                      >
                        {col.toUpperCase().replace('_', ' ')}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {listLoading ? (
                    <TableRow>
                      <TableCell colSpan={listColumns.length} align="center" sx={{ py: 8 }}>
                        <CircularProgress size={50} sx={{ color: '#667eea' }} />
                        <Typography sx={{ mt: 2, fontWeight: 600, color: '#667eea' }}>
                          Loading data...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : listData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={listColumns.length} align="center" sx={{ py: 8 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#94a3b8' }}>
                          📭 No data found
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Try adjusting your filters
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    listData.map((item, idx) => (
                      <TableRow 
                        key={item.id} 
                        sx={{
                          bgcolor: '#ffffff',
                          '&:hover': { 
                            bgcolor: '#f9fafb'
                          }
                        }}
                      >
                        {listColumns.map(col => (
                          <TableCell 
                            key={col}
                            sx={{ fontWeight: 500, borderRight: '1px solid #d1d5db' }}
                          >
                            {col === 'batch_id' ? (
                              <Chip 
                                label={item[col] || 'N/A'} 
                                size="small"
                                sx={{
                                  fontWeight: 700,
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  color: 'white',
                                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                                }}
                              />
                            ) : col === 'inbound_date' ? (
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
            </Box>

            {/* PAGINATION - FIXED */}
            <Stack 
    direction="row"
    spacing={2} 
    justifyContent="space-between" 
    alignItems="center"
    sx={{ 
    flexShrink: 0,
    //width: 500,
    p: 1,
    bgcolor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 1.5,
    boxShadow: '0 -2px 8px rgba(0,0,0,0.04)',
    border: '1px solid rgba(0,0,0,0.08)',
    position: 'sticky',
    bottom: 0,
    zIndex: 100,
    height: 40,
    mt: 8,
    mb: -20, // ✅ ensures no bottom margin
  }}
  >

              <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.7rem' }}>
                📊 {listData.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, total)} of {total}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button 
                  size="small"
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
                <Box sx={{ 
                  px: 2, 
                  py: 0.5, 
                  border: '1.5px solid #667eea', 
                  borderRadius: 1.5,
                  background: 'rgba(102, 126, 234, 0.08)',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Typography sx={{ fontWeight: 700, color: '#667eea', fontSize: '0.8rem' }}>
                    {page} / {Math.ceil(total / limit) || 1}
                  </Typography>
                </Box>
                <Button 
                  size="small"
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
              <DialogTitle sx={{ 
                fontWeight: 800, 
                fontSize: '1.5rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                py: 2.5
              }}>
                📤 Advanced Export Options
              </DialogTitle>
              <DialogContent sx={{ py: 4 }}>
                <Stack spacing={3}>
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
                  <TextField
                    select
                    fullWidth
                    label="Batch ID (Optional)"
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
                  </TextField>
                  <Alert 
                    severity="info"
                    sx={{
                      borderRadius: 2,
                      border: '2px solid #06b6d4',
                      fontWeight: 600
                    }}
                  >
                    💡 Leave filters empty to export all current list data
                  </Alert>
                </Stack>
              </DialogContent>
              <DialogActions sx={{ p: 2.5 }}>
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
                  onClick={handleAdvancedExport} 
                  startIcon={<DownloadIcon />}
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
              <DialogTitle sx={{ 
                fontWeight: 800, 
                fontSize: '1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                py: 2.5
              }}>
                ⚙️ Inbound List Columns
              </DialogTitle>
              <DialogContent sx={{ py: 3 }}>
                <Typography variant="body2" sx={{ mb: 3, fontWeight: 600, color: '#64748b' }}>
                  Select columns to display in the inbound list table
                </Typography>
                <Stack spacing={1.5}>
                  {['wsn', 'product_title', 'brand', 'cms_vertical', 'fsn', 'mrp', 'fsp', 'rack_no', 'vehicle_no', 'inbound_date', 'batch_id', 'product_serial_number', 'unload_remarks'].map(col => (
                    <FormControlLabel key={col}
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
                      label={<Typography sx={{ fontWeight: 700 }}>{col.toUpperCase().replace('_', ' ')}</Typography>}
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
                </Stack>
              </DialogContent>
              <DialogActions sx={{ p: 2.5 }}>
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
          </Box>
        )}


        {/* TAB 4: BATCH MANAGEMENT */}
{tabValue === 4 && (
  <Box
    sx={{
      animation: 'fadeIn 0.5s ease-out',
      '@keyframes fadeIn': {
        '0%': { opacity: 0 },
        '100%': { opacity: 1 }
      },
      width: "100%",
      overflowX: "hidden"
    }}
  >
    {/* MOBILE-FRIENDLY SCROLL WRAPPER */}
    <Box
      sx={{
        width: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        borderRadius: 2,
        border: "1px solid #e5e7eb",
      }}
    >
      <TableContainer
        component={Paper}
        sx={{
          minWidth: 700,                  // ★ IMPORTANT: Enable horizontal scroll
          borderRadius: 0,
          boxShadow: "none",
          overflowX: "auto",
        }}
      >
        <Table size="small">

          <TableHead>
            <TableRow>
              {[
                "🗂️ Batch ID",
                "📊 Count",
                "🕒 Last Updated",
                "⚡ Action"
              ].map((label, idx) => (
                <TableCell
                  key={idx}
                  sx={{
                    color: 'white',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    fontSize: '0.75rem',                 // ★ Mobile optimized
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    py: 1.5,
                    whiteSpace: "nowrap"                // ★ Prevent wrapping
                  }}
                  align={idx === 3 ? "center" : "left"}
                >
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                  <Typography variant="body1" sx={{ fontWeight: 700, color: '#94a3b8' }}>
                    📭 No batches found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              batches.map((batch, idx) => (
                <TableRow
                  key={batch.batch_id}
                  sx={{
                    transition: 'all 0.2s ease',
                    bgcolor: idx % 2 === 0 ? '#f9fafb' : '#fff',
                    '&:hover': {
                      bgcolor: '#f3f4f6',
                      transform: 'scale(1.002)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                    }
                  }}
                >
                  {/* Batch ID */}
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      whiteSpace: "nowrap"
                    }}
                  >
                    {batch.batch_id}
                  </TableCell>

                  {/* Count */}
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Chip
                      label={`${batch.count} entries`}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white'
                      }}
                    />
                  </TableCell>

                  {/* Last Updated */}
                  <TableCell
                    sx={{
                      whiteSpace: "nowrap",
                      fontSize: "0.75rem"
                    }}
                  >
                    {new Date(batch.last_updated).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>

                  {/* Action */}
                  <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                    <Button
                      size="small"
                      variant="contained"
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
    </Box>
  </Box>
)}

      </Box>
    </AppLayout>
  );
}