'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, MenuItem, Chip, Stack,
  Tab, Tabs, Alert,
  Select, FormControl, InputLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, Checkbox, FormControlLabel, Divider
} from '@mui/material';
import {
  Download as DownloadIcon, Upload as UploadIcon,
  Delete as DeleteIcon, Refresh as RefreshIcon, Settings as SettingsIcon,
  OpenInNew as OpenIcon, CheckCircle as CheckIcon
} from '@mui/icons-material';
import { qcAPI, rackAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface QCMultiRow {
  wsn: string;
  qc_date: string;
  qc_by: string;
  product_serial_number: string;
  rack_no: string;
  qc_remarks: string;
  qc_grade: string;
  [key: string]: string;
}

function TabPanel(props: any) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 0 }}>{children}</Box>}
    </div>
  );
}

function generateEmptyRows(count: number, qcBy: string = ''): QCMultiRow[] {
  return Array.from({ length: count }, () => ({
    wsn: '',
    qc_date: new Date().toISOString().split('T')[0],
    qc_by: qcBy,
    product_serial_number: '',
    rack_no: '',
    qc_remarks: '',
    qc_grade: ''
  }));
}

export default function QCPage() {
  const router = useRouter();
  const context = useWarehouse();
  const activeWarehouse = context?.activeWarehouse;

  const warehouseId = (context as any)?.warehouseId;

  const [user, setUser] = useState<any>(null);
  const [tabValue, setTabValue] = useState(0);

  // ====== QC GRADE MANAGEMENT ======
  const [qcGradesManagement, setQcGradesManagement] = useState<Array<{ value: string; label: string }>>([
    { value: 'A', label: 'Grade A - Excellent' },
    { value: 'B', label: 'Grade B - Good' },
    { value: 'C', label: 'Grade C - Fair' },
    { value: 'D', label: 'Grade D - Poor' },
    { value: 'REJECT', label: 'Reject' }
  ]);
  const [gradeSettingsOpen, setGradeSettingsOpen] = useState(false);
  const [newGradeValue, setNewGradeValue] = useState('');
  const [newGradeLabel, setNewGradeLabel] = useState('');

  // ====== SINGLE ENTRY STATE ======
  const [singleWSN, setSingleWSN] = useState('');
  const [productData, setProductData] = useState<any>(null);
  const [singleForm, setSingleForm] = useState({
    qc_date: new Date().toISOString().split('T')[0],
    qc_by: '',
    product_serial_number: '',
    rack_no: '',
    qc_remarks: '',
    other_remarks: '',
    qc_grade: ''
  });
  const [singleLoading, setSingleLoading] = useState(false);

  // ====== BULK UPLOAD STATE ======
  const [bulkFile, setBulkFile] = useState<any>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkCurrentBatch, setBulkCurrentBatch] = useState<any>(null);

  // ====== MULTI ENTRY STATE ======
  const [multiRows, setMultiRows] = useState<QCMultiRow[]>([]);
  const [multiLoading, setMultiLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(['wsn', 'qc_date', 'qc_by', 'rack_no', 'qc_grade', 'qc_remarks']);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [commonDate, setCommonDate] = useState(new Date().toISOString().split('T')[0]);
  const [commonQCBy, setCommonQCBy] = useState('');

  // ====== QC LIST STATE ======
  const [listData, setListData] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [total, setTotal] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [brands, setBrands] = useState<string[]>([]);
  const [listColumns, setListColumns] = useState<string[]>([
    'wsn', 'product_title', 'brand', 'cms_vertical', 'fsp', 'mrp', 'qc_date', 'qc_by', 'fk_grade', 'status', 'qc_remarks', 'rack_no', 'product_serial_number'
  ]);
  const [listColumnSettingsOpen, setListColumnSettingsOpen] = useState(false);

  // ====== BATCH MANAGEMENT STATE ======
  const [batches, setBatches] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // ====== DROPDOWN DATA ======
  const [racks, setRacks] = useState<any[]>([]);

  // ====== ALL useEffect ======
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(storedUser);
    setSingleForm(prev => ({ ...prev, qc_by: storedUser.fullName || '' }));
    setCommonQCBy(storedUser.fullName || '');
  }, [router]);

  useEffect(() => {
    const saved = localStorage.getItem('qcGrades');
    if (saved) {
      try {
        setQcGradesManagement(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('qcListColumns');
    if (saved) {
      try {
        setListColumns(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (user && multiRows.length === 0) {
      setMultiRows(generateEmptyRows(5, user?.fullName || commonQCBy));
    }
  }, [user]);

  useEffect(() => {
    if (activeWarehouse && (tabValue === 0 || tabValue === 2)) {
      loadRacks();
    }
  }, [activeWarehouse, tabValue]);

  useEffect(() => {
    if (activeWarehouse && tabValue === 3) {
      loadQCList();
      loadBrands();
      loadBatches();
    }
  }, [activeWarehouse, tabValue, page, limit, searchFilter, statusFilter, brandFilter]);




  const addQCGrade = () => {
    if (!newGradeValue.trim() || !newGradeLabel.trim()) {
      toast.error('Enter both value and label');
      return;
    }
    if (qcGradesManagement.some(g => g.value === newGradeValue)) {
      toast.error('Grade already exists');
      return;
    }
    const updated = [...qcGradesManagement, { value: newGradeValue, label: newGradeLabel }];
    setQcGradesManagement(updated);
    localStorage.setItem('qcGrades', JSON.stringify(updated));
    setNewGradeValue('');
    setNewGradeLabel('');
    toast.success('✓ Grade added');
  };

  const deleteQCGrade = (value: string) => {
    const updated = qcGradesManagement.filter(g => g.value !== value);
    setQcGradesManagement(updated);
    localStorage.setItem('qcGrades', JSON.stringify(updated));
    toast.success('✓ Grade deleted');
  };


    useEffect(() => {
    if (commonQCBy && multiRows.length === 0) {
    setMultiRows(generateEmptyRows(5));
    }
    }, [commonQCBy]);


  // ====== RACK MANAGEMENT ======
  const loadRacks = async () => {
    try {
      const response = await rackAPI.getByWarehouse(warehouseId);
      setRacks(response.data);
    } catch (error) {
      console.error('Failed to load racks');
    }
  };

  // ====== SINGLE ENTRY FUNCTIONS ======
  const handleWSNBlur = async () => {
    if (!singleWSN.trim()) return;
    try {
      const response = await qcAPI.getInboundByWSN(singleWSN, warehouseId);
      setProductData(response.data);
      toast.success('✓ Product found!');
    } catch (error: any) {
      setProductData(null);
      toast.error('Product not found in inbound');
    }
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleWSN.trim()) {
      toast.error('WSN is required');
      return;
    }
    if (!singleForm.qc_grade) {
      toast.error('QC Grade is required');
      return;
    }

    setSingleLoading(true);
    try {
      // Check if WSN already exists in QC
      const existingQC = await qcAPI.checkWSNExists(singleWSN, warehouseId);
      
      if (existingQC?.data?.exists) {
        // Show update dialog
        const confirmed = confirm(`WSN already exists in QC! Do you want to UPDATE the existing record?`);
        
        if (confirmed) {
          // Update existing QC entry
          await qcAPI.updateSingleQC(existingQC.data.id, {
            ...singleForm,
            warehouse_id: warehouseId
          });
          toast.success('✓ QC entry updated successfully!');
        } else {
          setSingleLoading(false);
          return;
        }
      } else {
        // Create new QC entry
        await qcAPI.createSingleQC({
          wsn: singleWSN,
          ...singleForm,
          warehouse_id: warehouseId
        });
        toast.success('✓ QC entry created successfully!');
      }

      // Reset form
      setSingleWSN('');
      setProductData(null);
      setSingleForm({
        qc_date: new Date().toISOString().split('T')[0],
        qc_by: user?.fullName || '',
        product_serial_number: '',
        rack_no: '',
        qc_remarks: '',
        other_remarks: '',
        qc_grade: ''
      });
      loadQCList();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create/update entry');
    } finally {
      setSingleLoading(false);
    }
  };

  // ====== BULK UPLOAD FUNCTIONS ======
  const downloadTemplate = () => {
    const template = [{
      'WSN': 'ABC123',
      'QC_DATE': new Date().toISOString().split('T')[0],
      'QC_BY': 'User Name',
      'QC_GRADE': 'A'
    }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'QC_Template.xlsx');
    toast.success('✓ Template downloaded');
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      toast.error('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', bulkFile);
    formData.append('warehouse_id', warehouseId?.toString() || '');

    setBulkLoading(true);
    try {
      const response = await qcAPI.bulkQCUpload(formData);
      setBulkCurrentBatch({
        id: response.data.batchId,
        total: response.data.totalRows,
        timestamp: response.data.timestamp
      });
      toast.success(`✓ Batch started: ${response.data.batchId}`);
      setBulkFile(null);
      setTimeout(() => {
        setBulkCurrentBatch(null);
        loadBatches();
        loadQCList();
      }, 3000);
    } catch (error: any) {
      toast.error('Upload failed');
    } finally {
      setBulkLoading(false);
    }
  };

  // ====== MULTI ENTRY FUNCTIONS ====== 
    const addMultiRow = () => {
    setMultiRows([...multiRows, {
      wsn: '',
      qc_date: commonDate,
      qc_by: commonQCBy,
      product_serial_number: '',
      rack_no: '',
      qc_remarks: '',
      qc_grade: ''
    }]);
  };

  const add10Rows = () => {
    const newRows = generateEmptyRows(10, commonQCBy).map(row => ({ ...row, qc_date: commonDate }));
    setMultiRows([...multiRows, ...newRows]);
    toast.success('✓ Added 10 rows');
  };

  const add30Rows = () => {
    const newRows = generateEmptyRows(30, commonQCBy).map(row => ({ ...row, qc_date: commonDate }));
    setMultiRows([...multiRows, ...newRows]);
    toast.success('✓ Added 30 rows');
  };

  const updateMultiRow = (index: number, field: string, value: string) => {
    const newRows: QCMultiRow[] = [...multiRows];
    newRows[index][field] = value;
    setMultiRows(newRows);
  };

  const updateCommonDate = (date: string) => {
    setCommonDate(date);
    setMultiRows(multiRows.map(row => ({ ...row, qc_date: date })));
  };

  const updateCommonQCBy = (qcBy: string) => {
    setCommonQCBy(qcBy);
    setMultiRows(multiRows.map(row => ({ ...row, qc_by: qcBy })));
  };

  const handleMultiSubmit = async () => {
  const filtered = multiRows.filter((r) => r.wsn?.trim());
  if (filtered.length === 0) {
    toast.error('No valid WSN rows');
    return;
  }
  
  // Check for duplicates in current entries
  const wsnCounts: { [key: string]: number } = {};
  for (const row of filtered) {
    wsnCounts[row.wsn?.trim() || ''] = (wsnCounts[row.wsn?.trim() || ''] || 0) + 1;
  }

  const duplicates = Object.entries(wsnCounts)
      .filter(([_, count]) => count > 1)
      .map(([wsn]) => wsn);

    if (duplicates.length > 0) {
      toast.error(`❌ Duplicate WSNs found: ${duplicates.join(', ')}`);
      return;
    }

  // Check if WSNs already exist in QC list
  setMultiLoading(true);
    try {
    const existingWSNs = await qcAPI.getExistingWSNs(warehouseId);
    const existingSet = new Set(existingWSNs.data);

    const alreadyQCed = filtered.filter(r => existingSet.has(r.wsn?.trim()));
    
    if (alreadyQCed.length > 0) {
      toast.error(
        `⚠️ ${alreadyQCed.length} WSN(s) already in QC: ${alreadyQCed.map(r => r.wsn).join(', ')}`
      );
      setMultiLoading(false);
      return;
    }

    // All validations passed - submit
    const res = await qcAPI.multiQCEntry({
      entries: filtered,
      warehouse_id: warehouseId
    });

    toast.success(`✓ Saved ${res.data.successCount} rows`);
    setMultiRows(generateEmptyRows(5));
    loadQCList();
    loadBatches();
     } catch (err: any) {
    toast.error('Multi entry failed');
    } finally {
    setMultiLoading(false);
    }
  };

  // ====== QC LIST FUNCTIONS ======
  const loadQCList = async () => {
    setListLoading(true);
    try {
      const response = await qcAPI.getQCList({
        page,
        limit,
        warehouseId,
        search: searchFilter,
        status: statusFilter,
        brand: brandFilter
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
      const response = await qcAPI.getBrands(warehouseId);
      setBrands(response.data || []);
    } catch (error) {
      setBrands([]);
    }
  };

  const exportToExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(listData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'QC List');
      const filename = `qc_list_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`✓ Exported ${listData.length} records`);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  // ====== BATCH MANAGEMENT ======
  const loadBatches = async () => {
    setBatchLoading(true);
    try {
      const response = await qcAPI.getQCBatches(warehouseId);
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
      await qcAPI.deleteQCBatch(batchId);
      toast.success('Batch deleted');
      loadBatches();
      loadQCList();
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
          flexDirection: 'column' 
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
              ⚠️ No Warehouse Selected
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Please select a warehouse to continue
            </Typography>
          </Box>
        </Box>

      </AppLayout>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    const cols = visibleColumns;
    
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (colIdx < cols.length - 1) {
        const nextCell = document.querySelector(`[data-row="${rowIdx}"][data-col="${colIdx + 1}"]`) as HTMLInputElement;
        if (nextCell) nextCell.focus();
      } else if (rowIdx < multiRows.length - 1) {
        const nextCell = document.querySelector(`[data-row="${rowIdx + 1}"][data-col="0"]`) as HTMLInputElement;
        if (nextCell) nextCell.focus();
      }
    }
  };


  return (
    <AppLayout>
      <Toaster position="top-right" />
      <Box sx={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', px: { xs: 0.5, sm: 1, md: 2 } }}>
        {/* HEADER - Fixed */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, py: 1, flexShrink: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '0.95rem', md: '1.2rem' } }}>
            📦 QC Management
          </Typography>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => {
              loadQCList();
              loadBatches();
              loadRacks();
              loadBrands();
            }}
            sx={{ borderRadius: 1, fontWeight: 600, fontSize: { xs: '0.6rem', md: '0.75rem' }, py: { xs: 0.3, md: 0.5 }, px: { xs: 0.8, md: 1.5 } }}
            variant="outlined"
            size="small"
          >
            Refresh
          </Button>
        </Box>

        {/* TABS - Fixed */}
        <Paper sx={{ mb: 1, flexShrink: 0, borderRadius: 1 }}>
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
                fontSize: { xs: '0.6rem', md: '0.75rem' },
                textTransform: 'none',
                minHeight: { xs: 28, md: 32 },
                py: 0.5,
              }
            }}
          >
            <Tab label="📝 Single Entry" />
            <Tab label="📂 Bulk Upload" />
            <Tab label="🔢 Multi Entry" />
            <Tab label="📋 QC List" />
            <Tab label="📦 Batch Manager" />
          </Tabs>
        </Paper>

        {/* CONTENT - Scrollable */}
        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', mb: 1, px: { xs: 1, md: 2 } }}>
          {/* TAB 0: SINGLE ENTRY */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ py: 2 }}>
              <Stack spacing={2}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                  <Paper sx={{ p: 1.5, backgroundColor: '#f9fafb' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '0.7rem', md: '0.8rem' }, textTransform: 'uppercase', color: '#666' }}>
                      Product Entry
                    </Typography>
                    <TextField
                      fullWidth
                      label="WSN"
                      value={singleWSN}
                      onChange={(e) => setSingleWSN(e.target.value)}
                      onBlur={handleWSNBlur}
                      variant="outlined"
                      placeholder="Scan or enter WSN"
                      size="small"
                    />
                  </Paper>

                  {productData && (
                    <Paper sx={{ p: 1.5, backgroundColor: '#f0f9ff', border: '2px solid #0284c7' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, fontSize: { xs: '0.7rem', md: '0.8rem' }, color: '#0c63e4' }}>
                        ✓ Product Details
                      </Typography>
                      <Stack spacing={0.5}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                          <Box>
                            <Typography sx={{ fontSize: { xs: '0.65rem', md: '0.7rem' }, color: '#666' }}>Title</Typography>
                            <Typography sx={{ fontSize: { xs: '0.7rem', md: '0.8rem' }, fontWeight: 600 }}>{productData.product_title}</Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: { xs: '0.65rem', md: '0.7rem' }, color: '#666' }}>Brand</Typography>
                            <Typography sx={{ fontSize: { xs: '0.7rem', md: '0.8rem' }, fontWeight: 600 }}>{productData.brand}</Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: { xs: '0.65rem', md: '0.7rem' }, color: '#666' }}>FSP</Typography>
                            <Typography sx={{ fontSize: { xs: '0.7rem', md: '0.8rem' }, fontWeight: 600, color: '#059669' }}>₹{productData.fsp}</Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: { xs: '0.65rem', md: '0.7rem' }, color: '#666' }}>MRP</Typography>
                            <Typography sx={{ fontSize: { xs: '0.7rem', md: '0.8rem' }, fontWeight: 600 }}>₹{productData.mrp}</Typography>
                          </Box>
                        </Box>
                      </Stack>
                    </Paper>
                  )}
                </Box>

                {productData && (
                  <Paper sx={{ p: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 2, fontSize: { xs: '0.7rem', md: '0.8rem' }, textTransform: 'uppercase', color: '#666' }}>
                      QC Details
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
                      <TextField
                        fullWidth
                        type="date"
                        label="QC Date"
                        value={singleForm.qc_date}
                        onChange={(e) => setSingleForm({ ...singleForm, qc_date: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="QC By"
                        value={singleForm.qc_by}
                        onChange={(e) => setSingleForm({ ...singleForm, qc_by: e.target.value })}
                        size="small"
                      />
                      <FormControl fullWidth size="small">
                        <InputLabel>QC Grade</InputLabel>
                        <Select
                          label="QC Grade"
                          value={singleForm.qc_grade}
                          onChange={(e) => setSingleForm({ ...singleForm, qc_grade: e.target.value })}
                        >
                          {qcGradesManagement.map(g => (
                            <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl fullWidth size="small">
                        <InputLabel>Rack Number</InputLabel>
                        <Select
                          label="Rack Number"
                          value={singleForm.rack_no}
                          onChange={(e) => setSingleForm({ ...singleForm, rack_no: e.target.value })}
                        >
                          {racks.map(r => (
                            <MenuItem key={r.id} value={r.rack_name}>{r.rack_name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mt: 1.5 }}>
                      <TextField
                        fullWidth
                        label="Product Serial No"
                        value={singleForm.product_serial_number}
                        onChange={(e) => setSingleForm({ ...singleForm, product_serial_number: e.target.value })}
                        size="small"
                        multiline
                        rows={2}
                      />
                      <TextField
                        fullWidth
                        label="QC Remarks"
                        value={singleForm.qc_remarks}
                        onChange={(e) => setSingleForm({ ...singleForm, qc_remarks: e.target.value })}
                        size="small"
                        multiline
                        rows={2}
                      />
                    </Box>
                    <TextField
                      fullWidth
                      label="Other Remarks"
                      value={singleForm.other_remarks}
                      onChange={(e) => setSingleForm({ ...singleForm, other_remarks: e.target.value })}
                      size="small"
                      multiline
                      rows={2}
                      sx={{ mt: 1.5 }}
                    />
                  </Paper>
                )}

                {productData && (
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleSingleSubmit}
                    disabled={singleLoading}
                    sx={{
                      py: 0.8,
                      borderRadius: 1,
                      fontWeight: 700,
                      fontSize: { xs: '0.7rem', md: '0.85rem' },
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}
                  >
                    {singleLoading ? '⏳ Creating...' : '✓ Create QC Entry'}
                  </Button>
                )}
              </Stack>
            </Box>
          </TabPanel>

          {/* TAB 1: BULK UPLOAD */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ py: 2 }}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <UploadIcon sx={{ fontSize: 40, color: '#999', mb: 2 }} />
                <Typography variant="body1" sx={{ fontWeight: 700, mb: 2, fontSize: { xs: '0.9rem', md: '1rem' } }}>Upload Excel File</Typography>
                <Button variant="outlined" onClick={downloadTemplate} sx={{ mb: 2 }}>📥 Download Template</Button>
                <Box sx={{ mb: 2 }}>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setBulkFile(e.target.files?.[0])} style={{ marginBottom: 8 }} />
                  {bulkFile && <Typography sx={{ color: 'green', fontSize: '0.8rem', fontWeight: 600 }}>✓ {bulkFile.name}</Typography>}
                </Box>
                <Button
                  variant="contained"
                  onClick={handleBulkUpload}
                  disabled={!bulkFile || bulkLoading}
                  sx={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' }}
                >
                  {bulkLoading ? '⏳ Uploading...' : '🚀 Upload & Process'}
                </Button>
                {bulkCurrentBatch && <Alert severity="success" sx={{ mt: 2 }}>✓ Batch: {bulkCurrentBatch.id}</Alert>}
              </Paper>
            </Box>
          </TabPanel>

          {/* TAB 2: MULTI ENTRY */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ py: 2 }}>
              <Stack spacing={1}>
                <Paper sx={{ p: 1.5, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1 }}>
                  <TextField type="date" label="QC Date" value={commonDate} onChange={(e) => updateCommonDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" fullWidth />
                  <TextField label="QC By" value={commonQCBy} onChange={(e) => updateCommonQCBy(e.target.value)} size="small" fullWidth />
                  <Stack direction="row" spacing={0.3}><Button onClick={add10Rows} size="small" variant="outlined" sx={{ flex: 1, fontSize: '0.6rem' }}>+10</Button><Button onClick={add30Rows} size="small" variant="outlined" sx={{ flex: 1, fontSize: '0.6rem' }}>+30</Button></Stack>
                  <Stack direction="row" spacing={0.3}>
                    <Button onClick={() => setGradeSettingsOpen(true)} variant="outlined" size="small" sx={{ flex: 1, fontSize: '0.6rem' }} startIcon={<SettingsIcon />} />
                    <Button onClick={() => setColumnSettingsOpen(true)} variant="outlined" size="small" sx={{ flex: 1, fontSize: '0.6rem' }} startIcon={<SettingsIcon />} />
                  </Stack>
                </Paper>

                <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 1, flex: 1, maxHeight: 'calc(100vh - 320px)', minHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead sx={{ backgroundColor: '#f3f4f6' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.65rem', width: 35 }}>#</TableCell>
                        {visibleColumns.map((col, idx) => (
                          <TableCell key={col} sx={{ fontWeight: 700, fontSize: '0.65rem', minWidth: 90, whiteSpace: 'nowrap' }} data-col={idx}>
                            {col.replace(/_/g, ' ').toUpperCase()}
                          </TableCell>
                        ))}
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.65rem', width: 35 }}>✓</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {multiRows.map((row, idx) => {
                        const isDuplicate = multiRows.filter(r => r.wsn?.trim() === row.wsn?.trim() && r.wsn?.trim()).length > 1;
                        return (
                          <TableRow key={idx} sx={{ backgroundColor: isDuplicate && row.wsn ? '#fee2e2' : 'inherit' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', p: '4px' }}>{idx + 1}</TableCell>
                            {visibleColumns.map((col, colIdx) => (
                              <TableCell key={col} sx={{ p: '2px' }} data-row={idx} data-col={colIdx}>
                                {col === 'qc_grade' ? (
                                  <Select size="small" fullWidth value={row[col] || ''} onChange={(e) => updateMultiRow(idx, col, e.target.value)} onKeyDown={(e: any) => handleKeyDown(e, idx, colIdx)} sx={{ fontSize: '0.65rem', '& .MuiOutlinedInput-input': { py: '2px', px: '4px' } }}>
                                    {qcGradesManagement.map(g => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
                                  </Select>
                                ) : col === 'rack_no' ? (
                                  <Select size="small" fullWidth value={row[col] || ''} onChange={(e) => updateMultiRow(idx, col, e.target.value)} onKeyDown={(e: any) => handleKeyDown(e, idx, colIdx)} sx={{ fontSize: '0.65rem', '& .MuiOutlinedInput-input': { py: '2px', px: '4px' } }}>
                                    {racks.map(r => <MenuItem key={r.id} value={r.rack_name}>{r.rack_name}</MenuItem>)}
                                  </Select>
                                ) : (
                                  <TextField size="small" fullWidth value={row[col] || ''} onChange={(e) => updateMultiRow(idx, col, e.target.value)} onKeyDown={(e: any) => handleKeyDown(e, idx, colIdx)} sx={{ '& .MuiOutlinedInput-input': { py: '2px', px: '4px', fontSize: '0.65rem' } }} />
                                )}
                              </TableCell>
                            ))}
                            <TableCell sx={{ p: '2px' }}>{isDuplicate && row.wsn ? <Chip label="DUP" size="small" color="error" sx={{ height: 16, fontSize: '0.6rem' }} /> : row.wsn ? <CheckIcon sx={{ fontSize: '0.85rem', color: '#10b981' }} /> : null}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Button fullWidth variant="contained" onClick={handleMultiSubmit} disabled={multiLoading || multiRows.some(r => r.wsn?.trim() && multiRows.filter(x => x.wsn?.trim() === r.wsn?.trim()).length > 1)} sx={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', fontSize: '0.7rem', py: 0.7 }}>
                  {multiLoading ? '⏳ Submitting...' : `✓ Submit (${multiRows.filter(r => r.wsn?.trim()).length})`}
                </Button>

                <Dialog open={columnSettingsOpen} onClose={() => setColumnSettingsOpen(false)} maxWidth="xs" fullWidth>
                  <DialogTitle>⚙️ Column Settings</DialogTitle>
                  <DialogContent>
                    <Box sx={{ pt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      {['wsn', 'qc_date', 'qc_by', 'rack_no', 'qc_grade', 'qc_remarks', 'product_serial_number'].map(col => (
                        <FormControlLabel key={col} control={<Checkbox checked={visibleColumns.includes(col)} onChange={(e) => { setVisibleColumns(e.target.checked ? [...visibleColumns, col] : visibleColumns.filter(c => c !== col)); }} />} label={col.replace(/_/g, ' ').toUpperCase()} sx={{ fontSize: '0.7rem' }} />
                      ))}
                    </Box>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setColumnSettingsOpen(false)} variant="contained" size="small">Done</Button>
                  </DialogActions>
                </Dialog>

                <Dialog open={gradeSettingsOpen} onClose={() => setGradeSettingsOpen(false)} maxWidth="xs" fullWidth>
                  <DialogTitle>⚙️ QC Grades</DialogTitle>
                  <DialogContent>
                    <Box sx={{ pt: 2 }}>
                      <Stack direction="row" spacing={0.5} sx={{ mb: 2 }}>
                        <TextField label="Value" value={newGradeValue} onChange={(e) => setNewGradeValue(e.target.value.toUpperCase())} size="small" sx={{ flex: 0.3 }} />
                        <TextField label="Label" value={newGradeLabel} onChange={(e) => setNewGradeLabel(e.target.value)} size="small" sx={{ flex: 0.7 }} />
                        <Button onClick={addQCGrade} variant="contained" size="small">Add</Button>
                      </Stack>
                      <Divider sx={{ my: 1.5 }} />
                      <Stack spacing={0.8}>
                        {qcGradesManagement.map(g => (
                          <Box key={g.value} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0.8, backgroundColor: '#f3f4f6', borderRadius: 0.8 }}>
                            <Box><Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{g.value}</Typography><Typography sx={{ fontSize: '0.65rem', color: '#666' }}>{g.label}</Typography></Box>
                            <Button size="small" color="error" onClick={() => deleteQCGrade(g.value)} startIcon={<DeleteIcon />} sx={{ fontSize: '0.55rem' }}>Del</Button>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setGradeSettingsOpen(false)} variant="contained" size="small">Done</Button>
                  </DialogActions>
                </Dialog>
              </Stack>
            </Box>
          </TabPanel>

          {/* TAB 3: QC LIST */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ py: 2 }}>
              <Stack spacing={1}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 1 }}>
                  <TextField placeholder="Search..." value={searchFilter} onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }} size="small" fullWidth />
                  <FormControl fullWidth size="small"><InputLabel>Status</InputLabel><Select label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}><MenuItem value="">All</MenuItem><MenuItem value="PENDING">Pending</MenuItem><MenuItem value="COMPLETED">Completed</MenuItem></Select></FormControl>
                  <FormControl fullWidth size="small"><InputLabel>Brand</InputLabel><Select label="Brand" value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}><MenuItem value="">All</MenuItem>{brands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}</Select></FormControl>
                  <FormControl fullWidth size="small"><InputLabel>Per Page</InputLabel><Select label="Per Page" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}><MenuItem value={50}>50</MenuItem><MenuItem value={100}>100</MenuItem></Select></FormControl>
                  <Stack direction="row" spacing={0.5}><Button onClick={() => setListColumnSettingsOpen(true)} variant="outlined" size="small" fullWidth startIcon={<SettingsIcon />} sx={{ fontSize: '0.6rem' }}>Cols</Button><Button onClick={exportToExcel} variant="contained" size="small" fullWidth sx={{ background: '#10b981', fontSize: '0.6rem' }} startIcon={<DownloadIcon />}>Export</Button></Stack>
                </Box>

                <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 1, flex: 1, maxHeight: 'calc(100vh - 320px)', minHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead sx={{ backgroundColor: '#f3f4f6' }}>
                      <TableRow>
                        {listColumns.map(col => (
                          <TableCell key={col} sx={{ fontWeight: 700, fontSize: '0.65rem', whiteSpace: 'nowrap', minWidth: 85 }}>
                            {col.replace(/_/g, ' ').toUpperCase()}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {listLoading ? <TableRow><TableCell colSpan={listColumns.length} align="center" sx={{ py: 3 }}>Loading...</TableCell></TableRow> : listData.length === 0 ? <TableRow><TableCell colSpan={listColumns.length} align="center" sx={{ py: 3 }}>No data</TableCell></TableRow> : listData.map((item, idx) => (
                        <TableRow key={idx}>
                          {listColumns.map(col => (
                            <TableCell key={col} sx={{ fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                              {col === 'status' ? <Chip label={item[col] || 'PENDING'} size="small" color={item[col] === 'COMPLETED' ? 'success' : 'warning'} sx={{ height: 18, fontSize: '0.55rem' }} /> : col === 'qc_date' ? new Date(item[col]).toLocaleDateString() : item[col] || '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 600 }}>📊 {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}</Typography>
                  <Stack direction="row" spacing={0.3}>
                    <Button disabled={page === 1} onClick={() => setPage(page - 1)} variant="outlined" size="small" sx={{ fontSize: '0.6rem', minWidth: 40 }}>◀</Button>
                    <Typography sx={{ fontSize: '0.65rem', px: 0.8 }}>{page} / {Math.ceil(total / limit) || 1}</Typography>
                    <Button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)} variant="outlined" size="small" sx={{ fontSize: '0.6rem', minWidth: 40 }}>▶</Button>
                  </Stack>
                </Box>

                <Dialog open={listColumnSettingsOpen} onClose={() => setListColumnSettingsOpen(false)} maxWidth="xs" fullWidth>
                  <DialogTitle>⚙️ Columns</DialogTitle>
                  <DialogContent>
                    <Box sx={{ pt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      {['wsn', 'product_title', 'brand', 'cms_vertical', 'fsp', 'mrp', 'qc_date', 'qc_by', 'fk_grade', 'status', 'qc_remarks', 'rack_no', 'product_serial_number'].map(col => (
                        <FormControlLabel key={col} control={<Checkbox checked={listColumns.includes(col)} onChange={(e) => { const newCols = e.target.checked ? [...listColumns, col] : listColumns.filter(c => c !== col); setListColumns(newCols); localStorage.setItem('qcListColumns', JSON.stringify(newCols)); }} />} label={col.replace(/_/g, ' ').toUpperCase()} sx={{ fontSize: '0.7rem' }} />
                      ))}
                    </Box>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setListColumnSettingsOpen(false)} variant="contained" size="small">Done</Button>
                  </DialogActions>
                </Dialog>
              </Stack>
            </Box>
          </TabPanel>

          {/* TAB 4: BATCH MANAGER */}
          <TabPanel value={tabValue} index={4}>
            <Box sx={{ py: 2 }}>
              <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 1, maxHeight: 'calc(100vh - 320px)' }}>
                <Table size="small" stickyHeader>
                  <TableHead sx={{ backgroundColor: '#f3f4f6' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Batch ID</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Count</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Updated</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', width: 60 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batches.length === 0 ? <TableRow><TableCell colSpan={4} align="center" sx={{ py: 2 }}>No batches</TableCell></TableRow> : batches.map(b => (
                      <TableRow key={b.batch_id}>
                        <TableCell sx={{ fontSize: '0.7rem' }}><Chip label={b.batch_id} size="small" /></TableCell>
                        <TableCell sx={{ fontSize: '0.7rem' }}>{b.count}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem' }}>{new Date(b.last_updated).toLocaleString()}</TableCell>
                        <TableCell><Button size="small" color="error" onClick={() => deleteBatch(b.batch_id)} startIcon={<DeleteIcon />} sx={{ fontSize: '0.55rem' }}>Del</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </TabPanel>
        </Box>
      </Box>
    </AppLayout>
  );
}
