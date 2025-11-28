'use client';

import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, AppBar, Toolbar, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip, CircularProgress,
  LinearProgress, IconButton, Tabs, Tab, Menu, MenuItem, Checkbox, ListItemText,
  TextField, FormControl, InputLabel, Select
} from '@mui/material';
import {
  Upload as UploadIcon, Refresh as RefreshIcon, Logout as LogoutIcon,
  GetApp as ExportIcon, Visibility as VisibilityIcon, Cancel as CancelIcon,
  DeleteSweep as DeleteSweepIcon
} from '@mui/icons-material';
import toast, { Toaster } from 'react-hot-toast';
import { getStoredUser, logout } from '@/lib/auth';
import { masterDataAPI } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import * as XLSX from 'xlsx';

// ✅ Helper function to safely format date - NO LOCALE (Hydration Safe)
const formatDate = (dateString: any, format: 'date' | 'datetime' = 'datetime'): string => {
  if (!dateString || dateString === null || dateString === undefined) {
    return '-';
  }
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '-';
    }
    
    if (format === 'date') {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } else {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
  } catch (error) {
    return '-';
  }
};

// ✅ Helper function to safely format numbers - NO LOCALE (Hydration Safe)
const formatNumber = (value: any): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  
  try {
    const num = parseInt(value);
    if (isNaN(num)) {
      return String(value);
    }
    // Simple comma formatting - no locale dependency
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  } catch (error) {
    return String(value);
  }
};

// Memoized table row for performance
const MasterDataRow = memo(({ 
  row, 
  idx, 
  page, 
  rowsPerPage, 
  columnVisibility 
}: any) => {
  return (
    <TableRow hover>
      <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
      {columnVisibility.wsn && <TableCell sx={{ fontWeight: 'bold' }}>{row.wsn || '-'}</TableCell>}
      {columnVisibility.wid && <TableCell>{row.wid || '-'}</TableCell>}
      {columnVisibility.fsn && <TableCell>{row.fsn || '-'}</TableCell>}
      {columnVisibility.order_id && <TableCell>{row.order_id || '-'}</TableCell>}
      {columnVisibility.fkqc_remark && <TableCell>{row.fkqc_remark || '-'}</TableCell>}
      {columnVisibility.fk_grade && <TableCell><Chip label={row.fk_grade || 'N/A'} size="small" /></TableCell>}
      {columnVisibility.product_title && <TableCell>{row.product_title || '-'}</TableCell>}
      {columnVisibility.hsn_sac && <TableCell>{row.hsn_sac || '-'}</TableCell>}
      {columnVisibility.igst_rate && <TableCell>{row.igst_rate || '-'}</TableCell>}
      {columnVisibility.fsp && <TableCell>₹{row.fsp || '-'}</TableCell>}
      {columnVisibility.mrp && <TableCell>₹{row.mrp || '-'}</TableCell>}
      {columnVisibility.invoice_date && <TableCell>{row.invoice_date_display}</TableCell>}
      {columnVisibility.fkt_link && <TableCell>{row.fkt_link || '-'}</TableCell>}
      {columnVisibility.wh_location && <TableCell>{row.wh_location || '-'}</TableCell>}
      {columnVisibility.brand && <TableCell>{row.brand || '-'}</TableCell>}
      {columnVisibility.cms_vertical && <TableCell>{row.cms_vertical || '-'}</TableCell>}
      {columnVisibility.vrp && <TableCell>{row.vrp || '-'}</TableCell>}
      {columnVisibility.yield_value && <TableCell>{row.yield_value || '-'}</TableCell>}
      {columnVisibility.p_type && <TableCell>{row.p_type || '-'}</TableCell>}
      {columnVisibility.p_size && <TableCell>{row.p_size || '-'}</TableCell>}
      {columnVisibility.batch_id && <TableCell><Typography variant="caption">{row.batch_id}</Typography></TableCell>}
      {columnVisibility.created_at && <TableCell><Typography variant="caption">{row.created_at_display}</Typography></TableCell>}
    </TableRow>
  );
});

MasterDataRow.displayName = 'MasterDataRow';

export default function MasterDataPage() {
  const router = useRouter();
  const progressIntervalRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);
  
  const [user, setUser] = useState<any>(null);
  const [masterData, setMasterData] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [totalRecords, setTotalRecords] = useState(0);
  const [tabValue, setTabValue] = useState(0);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportBatch, setExportBatch] = useState<string[]>([]);
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  
  // Upload progress
  const [uploadProgress, setUploadProgress] = useState({
    show: false,
    jobId: '',
    processed: 0,
    total: 0,
    successCount: 0,
    errorCount: 0,
    batchId: ''
  });

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState({
    wsn: true, wid: true, fsn: true, order_id: true, fkqc_remark: true,
    fk_grade: true, product_title: true, hsn_sac: true, igst_rate: true,
    fsp: true, mrp: true, invoice_date: true, fkt_link: false,
    wh_location: true, brand: true, cms_vertical: true, vrp: true,
    yield_value: true, p_type: true, p_size: true, batch_id: true, created_at: true
  });

  const columns = [
    { id: 'wsn', label: 'WSN', width: 120 },
    { id: 'wid', label: 'WID', width: 120 },
    { id: 'fsn', label: 'FSN', width: 120 },
    { id: 'order_id', label: 'Order ID', width: 130 },
    { id: 'fkqc_remark', label: 'FKQC Remark', width: 150 },
    { id: 'fk_grade', label: 'Grade', width: 100 },
    { id: 'product_title', label: 'Product Title', width: 250 },
    { id: 'hsn_sac', label: 'HSN/SAC', width: 110 },
    { id: 'igst_rate', label: 'IGST Rate', width: 100 },
    { id: 'fsp', label: 'FSP', width: 90 },
    { id: 'mrp', label: 'MRP', width: 90 },
    { id: 'invoice_date', label: 'Invoice Date', width: 120 },
    { id: 'fkt_link', label: 'Fkt Link', width: 150 },
    { id: 'wh_location', label: 'Location', width: 120 },
    { id: 'brand', label: 'Brand', width: 120 },
    { id: 'cms_vertical', label: 'Category', width: 120 },
    { id: 'vrp', label: 'VRP', width: 90 },
    { id: 'yield_value', label: 'Yield', width: 90 },
    { id: 'p_type', label: 'Type', width: 100 },
    { id: 'p_size', label: 'Size', width: 100 },
    { id: 'batch_id', label: 'Batch ID', width: 150 },
    { id: 'created_at', label: 'Created', width: 150 }
  ];

  // ✅ CRITICAL: Set isClient on mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initial setup
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(storedUser);
    
    const saved = localStorage.getItem('masterDataColumns');
    if (saved) setColumnVisibility(JSON.parse(saved));

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [router]);

  // Data loading effect - with tab awareness
  useEffect(() => {
    if (user && tabValue === 0 && isClient) {
      loadMasterData();
    }
  }, [page, rowsPerPage, user, tabValue, isClient]);

  // Initial load for batches and active uploads
  useEffect(() => {
    if (user && isClient) {
      loadBatches();
      checkActiveUploads();
    }
  }, [user, isClient]);

  // Force reset if rowsPerPage is too large
  useEffect(() => {
    if (rowsPerPage > 1000) {
      setRowsPerPage(100);
      setPage(0);
      toast('Rows per page reset to 100 for performance', { icon: '⚡' });
    }
  }, []);

  const loadMasterData = async () => {
    setLoading(true);
    try {
      const response = await masterDataAPI.getAll(page + 1, rowsPerPage);
      
      // Format dates on client to avoid hydration issues
      const formattedData = (response.data.data || []).map((item: any) => ({
        ...item,
        invoice_date_display: formatDate(item.invoice_date, 'date'),
        created_at_display: formatDate(item.created_at, 'datetime')
      }));
      
      setMasterData(formattedData);
      setTotalRecords(response.data.total || 0);
    } catch (error) {
      console.error('Load error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadBatches = async () => {
    try {
      const response = await masterDataAPI.getBatches();
      console.log('✅ Batches response:', response.data);
      
      const batchesArray = Array.isArray(response.data) ? response.data : [];
      setBatches(batchesArray);
    } catch (error) {
      console.error('Failed to load batches:', error);
      setBatches([]);
    }
  };

  const checkActiveUploads = async () => {
    try {
      const response = await masterDataAPI.getActiveUploads();
      const activeJobs = response.data;
      
      if (activeJobs && activeJobs.length > 0) {
        const job = activeJobs[0];
        setUploadProgress({
          show: true,
          jobId: job.jobId,
          processed: job.processed || 0,
          total: job.total || 0,
          successCount: job.successCount || 0,
          errorCount: job.errorCount || 0,
          batchId: job.batchId || ''
        });
        
        toast('Resuming active upload...', { icon: 'ℹ️' });
        startProgressPolling(job.jobId);
      }
    } catch (error) {
      console.error('Failed to check active uploads:', error);
    }
  };

  const startProgressPolling = (jobId: string) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(async () => {
      try {
        const progressRes = await masterDataAPI.getUploadProgress(jobId);
        const prog = progressRes.data;
        
        setUploadProgress(prev => ({
          ...prev,
          processed: prog.processed || 0,
          successCount: prog.successCount || 0,
          errorCount: prog.errorCount || 0,
          total: prog.total || prev.total
        }));

        if (prog.status === 'completed' || prog.status === 'failed') {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          
          setUploadProgress(prev => ({ ...prev, show: false }));
          
          if (prog.status === 'completed') {
            toast.success(`✓ Upload complete! ${formatNumber(prog.successCount)} records added`, { duration: 5000 });
            loadMasterData();
            loadBatches();
          } else {
            toast.error('Upload failed');
          }
        }
      } catch (err) {
        console.error('Progress poll error:', err);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }
    }, 2000);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/master-data/upload`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formData
        }
      );

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      
      setUploadProgress({
        show: true,
        jobId: data.jobId,
        processed: 0,
        total: data.totalRows || 0,
        successCount: 0,
        errorCount: 0,
        batchId: data.batchId
      });

      toast.success(`Upload started! Processing ${formatNumber(data.totalRows)} rows...`, { icon: '⏳' });
      setSelectedFile(null);
      setUploadDialogOpen(false);

      startProgressPolling(data.jobId);
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelUpload = async () => {
    if (!uploadProgress.jobId) return;
    
    try {
      await masterDataAPI.cancelUpload(uploadProgress.jobId);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setUploadProgress(prev => ({ ...prev, show: false }));
      toast.success('Upload cancelled');
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error('Failed to cancel');
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm(`Delete all records in batch ${batchId}?`)) return;
    
    try {
      await masterDataAPI.deleteBatch(batchId);
      toast.success('✓ Batch deleted');
      loadMasterData();
      loadBatches();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete');
    }
  };

  const handleExport = async () => {
    setLoading(true);
    let exportToast: any = null;

    try {
      exportToast = toast.loading('Preparing export...');
      let data: any[] = [];

      if (exportBatch.length > 0 || (exportDateFrom && exportDateTo)) {
        const params = new URLSearchParams();
        
        if (exportBatch.length > 0) {
          params.append('batchIds', exportBatch.join(','));
        }
        
        if (exportDateFrom && exportDateTo) {
          params.append('dateFrom', exportDateFrom);
          params.append('dateTo', exportDateTo);
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/master-data/export?${params.toString()}`,
          {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          }
        );

        if (!response.ok) throw new Error('Export failed');
        
        const result = await response.json();
        data = result.data || [];

      } else {
        data = [...masterData];
      }

      if (data.length === 0) {
        if (exportToast) toast.dismiss(exportToast);
        toast.error('No data to export');
        setLoading(false);
        return;
      }

      // Convert to Excel format
      const exportData = data.map(item => ({
        WSN: item.wsn,
        WID: item.wid,
        FSN: item.fsn,
        'Order ID': item.order_id,
        'Product Title': item.product_title,
        Brand: item.brand,
        Grade: item.fk_grade,
        MRP: item.mrp,
        FSP: item.fsp,
        'HSN/SAC': item.hsn_sac,
        'IGST Rate': item.igst_rate,
        'Invoice Date': item.invoice_date,
        'Wh Location': item.wh_location,
        'CMS Vertical': item.cms_vertical,
        VRP: item.vrp,
        'Yield Value': item.yield_value,
        'Product Type': item.p_type,
        'Product Size': item.p_size,
        'FKQC Remark': item.fkqc_remark,
        'Batch ID': item.batch_id,
        'Created At': item.created_at
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Master Data');
      
      const filename = exportBatch.length > 0
        ? `MasterData_Batches_${exportBatch.length}.xlsx`
        : exportDateFrom && exportDateTo
        ? `MasterData_${exportDateFrom}_to_${exportDateTo}.xlsx`
        : `MasterData_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      XLSX.writeFile(wb, filename);
      
      if (exportToast) toast.dismiss(exportToast);
      toast.success(`✓ Exported ${formatNumber(data.length)} records successfully!`, { duration: 5000 });
      
      setExportDialogOpen(false);
      setExportBatch([]);
      setExportDateFrom('');
      setExportDateTo('');

    } catch (error: any) {
      if (exportToast) toast.dismiss(exportToast);
      toast.error(`Export failed: ${error.message}`);
      console.error('Export error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleColumn = (col: string) => {
    const updated = { ...columnVisibility, [col]: !columnVisibility[col as keyof typeof columnVisibility] };
    setColumnVisibility(updated);
    localStorage.setItem('masterDataColumns', JSON.stringify(updated));
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const progressPercent = uploadProgress.total > 0 
    ? Math.round((uploadProgress.processed / uploadProgress.total) * 100) 
    : 0;

  // Don't render dynamic content until hydration is complete
  if (!isClient) {
    return (
      <AppLayout>
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Toaster position="top-center" />

      {/* Header */}
      <AppBar position="static" elevation={0} sx={{ bgcolor: 'white', color: 'text.primary', mb: 3 }}>
        <Toolbar
  sx={{
    flexWrap: 'wrap',          // ★ allows items to go to next line
    gap: 1,
  }}
>

          <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
            📊 Master Data Management
          </Typography>
          <Chip label={`${formatNumber(totalRecords)} Records`} color="primary" size="small" sx={{ mr: 1 }} />
          <Chip label={`${formatNumber(batches.length)} Batches`} color="success" size="small" sx={{ mr: 2 }} />
          <Button color="error" variant="outlined" startIcon={<LogoutIcon />} onClick={handleLogout} size="small">
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      {/* Upload Progress Bar */}
      {uploadProgress.show && (
        <Paper sx={{ m: 2, p: 2, bgcolor: '#f5f5f5' }}>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" fontWeight="bold">
                ⏳ Uploading: {formatNumber(uploadProgress.processed)} / {formatNumber(uploadProgress.total)} rows
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={`✓ ${formatNumber(uploadProgress.successCount)}`} color="success" size="small" />
                <Chip label={`✗ ${formatNumber(uploadProgress.errorCount)}`} color="error" size="small" />
                <IconButton size="small" onClick={handleCancelUpload} color="error">
                  <CancelIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
            <LinearProgress variant="determinate" value={progressPercent} sx={{ height: 8, borderRadius: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Batch: {uploadProgress.batchId} • {progressPercent}% Complete
            </Typography>
          </Stack>
        </Paper>
      )}

     <Box
  sx={{
    p: { xs: 1, md: 2 },
    width: '100%',
    overflowX: 'hidden',
    maxWidth: '100vw',
  }}
>

        {/* Tabs */}
        <Paper sx={{ mb: 2, overflowX: 'auto' }}>

          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
            <Tab label="📋 Master Data List" />
            <Tab label="📦 Batch Management" />
          </Tabs>
        </Paper>

        {/* Tab 1: Master Data List */}
        {tabValue === 0 ? (
          <>
            {/* Action Bar */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack
  direction={{ xs: 'column', sm: 'row' }}
  spacing={1}
  sx={{ width: '100%' }}
>

                <Button variant="outlined" size="small" startIcon={<VisibilityIcon />} onClick={(e) => setColumnMenuAnchor(e.currentTarget)}>
                  Columns
                </Button>
                <Button variant="outlined" size="small" startIcon={<ExportIcon />} onClick={() => setExportDialogOpen(true)}>
                  Export
                </Button>
                <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={loadMasterData} disabled={loading}>
                  {loading ? <CircularProgress size={20} /> : 'Refresh'}
                </Button>
                <Button variant="contained" size="small" startIcon={<UploadIcon />} onClick={() => setUploadDialogOpen(true)}>
                  Upload Excel
                </Button>
              </Stack>
            </Paper>

            {/* Data Table */}
            <Paper sx={{ position: 'relative' }}>
              {loading && (
                <Box sx={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  bottom: 0, 
                  bgcolor: 'rgba(255,255,255,0.7)', 
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CircularProgress />
                </Box>
              )}
              <TableContainer
  sx={{
    maxHeight: 'calc(100vh - 350px)',
    overflowX: 'auto',             // ★ allow horizontal scroll
    width: '100%',
    maxWidth: '100vw',             // ★ important for mobile!
    display: 'block'
  }}
>

                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: '#1976d2', color: 'white', fontWeight: 'bold', minWidth: 60 }}>#</TableCell>
                      {columns.filter(col => columnVisibility[col.id as keyof typeof columnVisibility]).map(col => (
                        <TableCell key={col.id} sx={{ bgcolor: '#1976d2', color: 'white', fontWeight: 'bold', minWidth: col.width }}>
                          {col.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {masterData.map((row, idx) => (
                      <MasterDataRow
                        key={row.id || idx}
                        row={row}
                        idx={idx}
                        page={page}
                        rowsPerPage={rowsPerPage}
                        columnVisibility={columnVisibility}
                      />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={totalRecords}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  const safeValue = Math.min(value, 1000);
                  setRowsPerPage(safeValue);
                  setPage(0);
                }}
                rowsPerPageOptions={[100, 500, 1000]}
                labelRowsPerPage="Rows per page:"
                labelDisplayedRows={({ from, to, count }) => 
                  `${formatNumber(from)}-${formatNumber(to)} of ${count !== -1 ? formatNumber(count) : 'more than ' + formatNumber(to)}`
                }
              />
            </Paper>
          </>
        ) : null}

        {/* Tab 2: Batch Management */}
        {tabValue === 1 ? (
          <Paper sx={{ p: 2 }}>
            <TableContainer sx={{ overflowX: 'auto' }}>

              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Batch ID</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Records</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Last Updated</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {batches && batches.length > 0 ? (
                    batches.map(batch => (
                      <TableRow key={batch.batch_id} hover>
                        <TableCell sx={{ fontWeight: 'bold' }}>{batch.batch_id || '-'}</TableCell>
                        <TableCell>{batch.count ? formatNumber(batch.count) : '0'}</TableCell>
                        <TableCell>{batch.lastupdated ? formatDate(batch.lastupdated, 'datetime') : '-'}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => handleDeleteBatch(batch.batch_id)}>
                            <DeleteSweepIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No batches available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        ) : null}
      </Box>

      {/* Column Visibility Menu */}
      <Menu anchorEl={columnMenuAnchor} open={Boolean(columnMenuAnchor)} onClose={() => setColumnMenuAnchor(null)}>
        {columns.map(col => (
          <MenuItem key={col.id} onClick={() => toggleColumn(col.id)}>
            <Checkbox checked={columnVisibility[col.id as keyof typeof columnVisibility]} />
            <ListItemText primary={col.label} />
          </MenuItem>
        ))}
      </Menu>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => !loading && setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight="bold">📤 Upload Excel File</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Upload Excel or CSV file with all 20 columns. Files up to 500MB supported.
            </Typography>
            <input
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              id="file-upload"
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="file-upload">
              <Button variant="outlined" component="span" fullWidth>
                Choose File
              </Button>
            </label>
            {selectedFile && (
              <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" fontWeight="bold">{selectedFile.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setSelectedFile(null)}>
                    <CancelIcon />
                  </IconButton>
                </Stack>
              </Paper>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setUploadDialogOpen(false)} disabled={loading}>Cancel</Button>
          <Button variant="contained" startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />} onClick={handleFileUpload} disabled={!selectedFile || loading}>
            {loading ? 'Starting...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight="bold">📥 Export to Excel</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Filter by Batches (Multi-select)</InputLabel>
              <Select
                multiple
                value={exportBatch}
                label="Filter by Batches (Multi-select)"
                onChange={(e) => setExportBatch(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {batches && batches.length > 0 ? (
                  batches.map(b => (
                    <MenuItem key={b.batch_id} value={b.batch_id}>
                      <Checkbox checked={exportBatch.indexOf(b.batch_id) > -1} />
                      <ListItemText primary={`${b.batch_id} (${formatNumber(b.count)} records)`} />
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>No batches available</MenuItem>
                )}
              </Select>
            </FormControl>
            
            <Typography variant="body2" color="text.secondary" align="center">OR</Typography>
            
            <TextField 
              label="From Date" 
              type="date" 
              value={exportDateFrom} 
              onChange={(e) => setExportDateFrom(e.target.value)} 
              InputLabelProps={{ shrink: true }} 
              fullWidth 
            />
            <TextField 
              label="To Date" 
              type="date" 
              value={exportDateTo} 
              onChange={(e) => setExportDateTo(e.target.value)} 
              InputLabelProps={{ shrink: true }} 
              fullWidth 
            />
            
            <Typography variant="caption" color="text.secondary">
              💡 Select multiple batches OR use date range. Leave all empty to export current view.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => {
              setExportDialogOpen(false);
              setExportBatch([]);
              setExportDateFrom('');
              setExportDateTo('');
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <ExportIcon />} 
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
