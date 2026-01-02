// File Path = warehouse-frontend/app/settings/master-data/page.tsx
'use client';

import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, AppBar, Toolbar, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip, CircularProgress,
  LinearProgress, IconButton, Tabs, Tab, Menu, MenuItem, Checkbox, ListItemText,
  TextField, FormControl, InputLabel, Select, InputAdornment, Badge, useTheme, useMediaQuery,
  Collapse
} from '@mui/material';
import {
  Upload as UploadIcon, Refresh as RefreshIcon, Logout as LogoutIcon,
  GetApp as ExportIcon, Visibility as VisibilityIcon, Cancel as CancelIcon,
  DeleteSweep as DeleteSweepIcon, Download as DownloadIcon, Search as SearchIcon,
  Speed as SpeedIcon, Clear as ClearIcon, CheckCircle
} from '@mui/icons-material';
import toast, { Toaster } from 'react-hot-toast';
import { getStoredUser, logout } from '@/lib/auth';
import { masterDataAPI } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import * as XLSX from 'xlsx';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import FilterListIcon from '@mui/icons-material/FilterList';



// ✅ ISSUE #3 FIX: Format date to IST timezone - Hydration Safe
const formatDateToIST = (dateString: any, format: 'date' | 'datetime' = 'datetime'): string => {
  if (!dateString) return '-';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    if (format === 'date') {
      return date.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: '2-digit'
      });
    }

    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).replace(',', '');
  } catch {
    return '-';
  }
};



// ✅ Helper function to safely format numbers - Hydration Safe
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

// ✅ Grade color mapping for visual feedback
const getGradeColor = (grade: string): 'success' | 'warning' | 'error' | 'default' => {
  if (!grade) return 'default';
  const g = grade.toUpperCase();
  if (g.includes('A') || g.includes('GOOD')) return 'success';
  if (g.includes('B') || g.includes('OK')) return 'warning';
  if (g.includes('C') || g.includes('REJECT')) return 'error';
  return 'default';
};

// ✅ Relative time display (lightweight)
const getRelativeTime = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return dateStr;
  } catch {
    return dateStr;
  }
};

// Excel-style compact cell with proper overflow handling
const cellStyle = {
  py: 0.5,
  px: 1,
  fontSize: '0.875rem',
  border: '1px solid #e0e0e0',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%'
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
    <TableRow hover sx={{ '&:hover': { bgcolor: '#f5f5f5' }, height: 30 }}>
      <TableCell sx={{ ...cellStyle, fontWeight: 500, bgcolor: '#fafafa', py: 0.25 }}>{page * rowsPerPage + idx + 1}</TableCell>
      {columnVisibility.wsn && <TableCell sx={{ ...cellStyle, fontWeight: 600, color: '#1976d2' }}>{row.wsn || '-'}</TableCell>}
      {columnVisibility.wid && <TableCell sx={cellStyle}>{row.wid || '-'}</TableCell>}
      {columnVisibility.fsn && <TableCell sx={cellStyle}>{row.fsn || '-'}</TableCell>}
      {columnVisibility.order_id && <TableCell sx={cellStyle}>{row.order_id || '-'}</TableCell>}
      {columnVisibility.fkqc_remark && <TableCell sx={cellStyle}>{row.fkqc_remark || '-'}</TableCell>}
      {columnVisibility.fk_grade && <TableCell sx={cellStyle}><Chip label={row.fk_grade || 'N/A'} size="small" color={getGradeColor(row.fk_grade)} sx={{ height: 20, fontSize: '0.75rem' }} /></TableCell>}
      {columnVisibility.product_title && <TableCell sx={{ ...cellStyle, maxWidth: 300 }}>{row.product_title || '-'}</TableCell>}
      {columnVisibility.hsn_sac && <TableCell sx={cellStyle}>{row.hsn_sac || '-'}</TableCell>}
      {columnVisibility.igst_rate && <TableCell sx={cellStyle}>{row.igst_rate || '-'}</TableCell>}
      {columnVisibility.fsp && <TableCell sx={{ ...cellStyle, textAlign: 'right' }}>₹{row.fsp || '-'}</TableCell>}
      {columnVisibility.mrp && <TableCell sx={{ ...cellStyle, textAlign: 'right' }}>₹{row.mrp || '-'}</TableCell>}
      {columnVisibility.invoice_date && <TableCell sx={cellStyle}>{row.invoice_date_display}</TableCell>}
      {columnVisibility.fkt_link && <TableCell sx={cellStyle}>{row.fkt_link || '-'}</TableCell>}
      {columnVisibility.wh_location && <TableCell sx={cellStyle}>{row.wh_location || '-'}</TableCell>}
      {columnVisibility.brand && <TableCell sx={{ ...cellStyle, fontWeight: 500 }}>{row.brand || '-'}</TableCell>}
      {columnVisibility.cms_vertical && <TableCell sx={cellStyle}>{row.cms_vertical || '-'}</TableCell>}
      {columnVisibility.vrp && <TableCell sx={{ ...cellStyle, textAlign: 'right' }}>₹{row.vrp || '-'}</TableCell>}
      {columnVisibility.yield_value && <TableCell sx={cellStyle}>{row.yield_value || '-'}</TableCell>}
      {columnVisibility.p_type && <TableCell sx={cellStyle}>{row.p_type || '-'}</TableCell>}
      {columnVisibility.p_size && <TableCell sx={cellStyle}>{row.p_size || '-'}</TableCell>}
      {columnVisibility.batch_id && <TableCell sx={cellStyle}><Chip label={row.batch_id || '-'} size="small" variant="outlined" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} /></TableCell>}
      {columnVisibility.actual_received && <TableCell sx={cellStyle}>
        <Chip
          label={row.actual_received || 'Pending'}
          size="small"
          color={row.actual_received === 'Received' ? 'success' : 'warning'}
          variant="outlined"
          sx={{ height: 20, fontSize: '0.75rem', fontWeight: 'bold' }}
        />
      </TableCell>}
      {columnVisibility.created_at && <TableCell sx={{ ...cellStyle, fontSize: '0.75rem' }}>
        <Box>{row.created_at_display}</Box>
        <Box sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>{getRelativeTime(row.created_at)}</Box>
      </TableCell>}
    </TableRow>
  );
});

MasterDataRow.displayName = 'MasterDataRow';

export default function MasterDataPage() {
  // Role guard - admin, manager, operator can access
  useRoleGuard(['admin', 'manager', 'operator']);

  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const progressIntervalRef = useRef<any>(null);
  const loadingTimeoutRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [masterData, setMasterData] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  // Local refresh button state (non-blocking refresh)
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

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
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [fileValidationError, setFileValidationError] = useState<string>('');

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

  // Column visibility - Hide less critical columns by default to maximize table space
  const [columnVisibility, setColumnVisibility] = useState({
    wsn: true, wid: false, fsn: false, order_id: true, fkqc_remark: false,
    fk_grade: true, product_title: true, hsn_sac: false, igst_rate: false,
    fsp: false, mrp: false, invoice_date: false, fkt_link: false,
    wh_location: false, brand: true, cms_vertical: true, vrp: false,
    yield_value: false, p_type: false, p_size: false, batch_id: true, actual_received: true, created_at: false
  });

  // ✅ NEW: Filters for batch, status, brand, and category
  const [filterBatchId, setFilterBatchId] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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
    { id: 'actual_received', label: 'Actual Received', width: 130 },
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
    if (saved) {
      const savedColumns = JSON.parse(saved);
      // ✅ Merge with defaults to avoid undefined values
      setColumnVisibility(prev => ({ ...prev, ...savedColumns }));
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [router]);

  // ✅ Debounced search effect (500ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0); // Reset to first page on search
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ✅ Save column visibility to localStorage
  useEffect(() => {
    if (isClient) {
      try {
        localStorage.setItem('masterDataColumns', JSON.stringify(columnVisibility));
      } catch (e) {
        console.error('Failed to save column preferences:', e);
      }
    }
  }, [columnVisibility, isClient]);

  // Data loading effect - with tab awareness and filters
  useEffect(() => {
    if (user && tabValue === 0 && isClient) {
      setLoading(true);
      setShowLoadingOverlay(false);

      // Show overlay only if loading takes more than 300ms (prevents flicker on fast loads)
      loadingTimeoutRef.current = setTimeout(() => {
        setShowLoadingOverlay(true);
      }, 300);

      const loadTimer = setTimeout(() => {
        loadMasterData();
      }, 0);

      return () => {
        clearTimeout(loadTimer);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      };
    }
  }, [page, rowsPerPage, user, tabValue, isClient, debouncedSearch, filterBatchId, filterStatus, filterBrand, filterCategory]);

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

  const loadMasterData = async ({ buttonRefresh = false } = {}) => {
    if (buttonRefresh) {
      setRefreshing(true);
      setRefreshSuccess(false);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      params.append('page', (page + 1).toString());
      params.append('limit', rowsPerPage.toString());
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filterBatchId) params.append('batch_id', filterBatchId);
      if (filterStatus && filterStatus !== 'All') params.append('status', filterStatus);
      if (filterBrand) params.append('brand', filterBrand);
      if (filterCategory) params.append('category', filterCategory);

      const token = localStorage.getItem('token');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/master-data?${params.toString()}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated — clear and redirect to login
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
          throw new Error('Unauthorized');
        }
        const text = await response.text();
        throw new Error(text || 'Failed to load data');
      }
      const data = await response.json();

      // ✅ Format dates on client using IST timezone
      const formattedData = (data.data || []).map((item: any) => ({
        ...item,
        invoice_date_display: formatDateToIST(item.invoice_date, 'date'),
        created_at_display: formatDateToIST(item.created_at, 'datetime')
      }));

      setMasterData(formattedData);
      setTotalRecords(data.total || 0);
      const now = new Date();
      setLastRefreshTime(now);

      if (buttonRefresh) {
        toast.success('✓ Refreshed');
        setRefreshSuccess(true);
        setTimeout(() => setRefreshSuccess(false), 2000);
      }
    } catch (error) {
      console.error('Load error:', error);
      toast.error('Failed to load data');
    } finally {
      if (buttonRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
        setShowLoadingOverlay(false);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      }
    }
  };

  const loadBatches = async () => {
    try {
      const response = await masterDataAPI.getBatches();
      console.log('Batches response:', response.data);

      const batchesArray = Array.isArray(response.data) ? response.data : [];

      // ✅ Format lastupdated with created_at_display (datetime format)
      const formattedBatches = batchesArray.map((batch: any) => ({
        ...batch,
        lastupdated_display: formatDateToIST(batch.lastupdated, 'datetime')
      }));

      setBatches(formattedBatches);
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

    setUploadDialogOpen(false);

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
            const errorMsg = prog.error || 'Unknown error occurred during upload';
            // ✅ Use console.log instead of console.error (prevents error overlay)
            console.log('⚠️ Upload failed (handled):', errorMsg);

            setUploadError(errorMsg);
            setSelectedFile(null);
            setUploadDialogOpen(true);

            toast.error('❌ Upload Failed - Check error details', { duration: 4000 });
          }
        }
      } catch (err: any) {
        console.log('⚠️ Progress poll error (handled):', err.message);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }
    }, 2000);
  };


  // ✅ Reset all filters
  const resetFilters = () => {
    setFilterBatchId('');
    setFilterStatus('All');
    setFilterBrand('');
    setFilterCategory('');
    setSearchQuery('');
    setPage(0);
    toast('✓ Filters reset', { icon: '🔄' });
  };

  // ✅ ISSUE #5 FIX: Download template function
  const handleDownloadTemplate = async () => {
    try {
      masterDataAPI.downloadTemplate();
      toast.success('✓ Template download initiated!', { icon: '⬇️' });
    } catch (error: any) {
      console.error('❌ Template download error:', error);
      toast.error(`Failed to download template: ${error.message || error}`);
    }
  };



  // Enhanced handleFileUpload with better error handling
  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    // Reset errors
    setUploadError('');
    setFileValidationError('');

    // Client-side validation
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = selectedFile.name.toLowerCase();
    const fileExt = fileName.substring(fileName.lastIndexOf('.'));

    if (!validExtensions.includes(fileExt)) {
      setFileValidationError(`Invalid file type "${fileExt}". Only Excel (.xlsx, .xls) and CSV (.csv) files are allowed.`);
      return;
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setFileValidationError('File size exceeds 50MB limit. Please upload a smaller file.');
      return;
    }

    // Check if file is empty
    if (selectedFile.size === 0) {
      setFileValidationError('The selected file is empty. Please choose a valid file.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/master-data/upload`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formData
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // ✅ Extract and display detailed error from backend
        const errorMsg = data.error || 'Upload failed - Unknown error';
        setUploadError(errorMsg);

        // Show toast for immediate feedback
        toast.error('Upload failed. Please check the error message.', {
          duration: 4000,
          icon: '❌'
        });

        // ✅ Don't throw error - just return (prevents console error)
        setLoading(false);
        return;
      }

      // Success - start progress tracking
      setUploadProgress({
        show: true,
        jobId: data.jobId,
        processed: 0,
        total: data.totalRows || 0,
        successCount: 0,
        errorCount: 0,
        batchId: data.batchId
      });

      toast.success(`Upload started! Processing ${formatNumber(data.totalRows)} rows...`, {
        icon: '⏳',
        duration: 3000
      });

      setSelectedFile(null);
      setUploadError('');
      setFileValidationError('');

      startProgressPolling(data.jobId);

    } catch (error: any) {
      // ✅ Log to console but don't re-throw (prevents Next.js error overlay)
      console.log('⚠️ Upload error (handled):', error.message);
      const errorMsg = error.message || 'Network error - Please try again';
      setUploadError(errorMsg);
      toast.error('Upload failed. Please try again.', { duration: 4000 });
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
          `${process.env.NEXT_PUBLIC_API_URL}/api/master-data/export?${params.toString()}`,
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
      // const exportData = data.map(item => ({
      //   WSN: item.wsn,
      //   WID: item.wid,
      //   FSN: item.fsn,
      //   'Order ID': item.order_id,
      //   'Product Title': item.product_title,
      //   Brand: item.brand,
      //   Grade: item.fk_grade,
      //   MRP: item.mrp,
      //   FSP: item.fsp,
      //   'HSN/SAC': item.hsn_sac,
      //   'IGST Rate': item.igst_rate,
      //   'Invoice Date': item.invoice_date,
      //   'Wh Location': item.wh_location,
      //   'CMS Vertical': item.cms_vertical,
      //   VRP: item.vrp,
      //   'Yield Value': item.yield_value,
      //   'Product Type': item.p_type,
      //   'Product Size': item.p_size,
      //   'FKQC Remark': item.fkqc_remark,
      //   'Batch ID': item.batch_id,
      //   'Created At': item.created_at
      // }));

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
        'Invoice Date': item.invoice_date_display || formatDateToIST(item.invoice_date, 'date'),
        'Wh Location': item.wh_location,
        'CMS Vertical': item.cms_vertical,
        VRP: item.vrp,
        'Yield Value': item.yield_value,
        'Product Type': item.p_type,
        'Product Size': item.p_size,
        'FKQC Remark': item.fkqc_remark,
        'Batch ID': item.batch_id,
        'Created At': item.created_at_display || formatDateToIST(item.created_at, 'datetime')
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

  ////////////////////////////////////////UI RENDERING////////////////////////////////////////
  return (
    <AppLayout>
      <Toaster position="top-right" />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Fixed Header */}
        <Box sx={{
          p: { xs: 0.75, md: 1 },
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}>

          {/* ==================== HEADER SECTION ==================== */}
          <Box sx={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            mb: 1,
            p: { xs: 1, sm: 1.25 },
            background: 'linear-gradient(  135deg, #0f2027 0%, #203a43 50%, #2c5364 100%  )',
            borderRadius: 1.5,
            boxShadow: '0 8px 30px rgba(102, 126, 234, 0.25)',
          }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: { xs: 0.75, sm: 1 }
            }}>
              {/* LEFT: Icon + Title */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1.25 } }}>

                <Box>
                  <Typography variant="h4" sx={{
                    fontWeight: 650,
                    color: 'white',
                    fontSize: { xs: '0.85rem', sm: '1rem', md: '1.3rem' },
                    lineHeight: 1.1,
                    textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    📊 Master Data Management
                  </Typography>
                  <Typography variant="caption" sx={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: { xs: isMobile ? '0.5rem' : '0.2rem', sm: '0.7rem' },
                    fontWeight: 500,
                    lineHeight: 1.2,
                    display: 'block',
                    mt: 0.25
                  }}>
                    Manage master data for your warehouse
                  </Typography>
                </Box>
              </Box>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                <Chip label={`Total Records: ${formatNumber(totalRecords)}`} color="info" size="small" variant="outlined" sx={{ height: 28, fontSize: '0.85rem', color: 'white', borderColor: 'white' }} />
                <Chip label={`${batches.length} Batches`} color="success" size="small" variant="outlined" sx={{ height: 28, fontSize: '0.85rem', color: 'white', borderColor: 'white' }} />
              </Stack>
            </Box>
          </Box>
        </Box>

        {/* Upload Progress Bar */}
        {uploadProgress.show && (
          <Paper sx={{ mx: 1, my: 0.5, p: 1.5, bgcolor: '#e3f2fd', border: '2px solid #2196f3', borderRadius: 1 }}>
            <Stack spacing={0.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <SpeedIcon fontSize="small" color="primary" />
                  <Typography variant="caption" fontWeight="bold">Uploading: {formatNumber(uploadProgress.processed)}/{formatNumber(uploadProgress.total)}</Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Chip label={`✓${formatNumber(uploadProgress.successCount)}`} color="success" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                  {uploadProgress.errorCount > 0 && <Chip label={`✗${formatNumber(uploadProgress.errorCount)}`} color="error" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />}
                  <IconButton size="small" onClick={handleCancelUpload} color="error" sx={{ p: 0.5 }}><CancelIcon fontSize="small" /></IconButton>
                </Stack>
              </Stack>
              <LinearProgress variant="determinate" value={progressPercent} sx={{ height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #4caf50 0%, #2196f3 100%)' } }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Batch: {uploadProgress.batchId}</Typography>
                <Typography variant="caption" fontWeight="bold" color="primary.main">{progressPercent}%</Typography>
              </Stack>
            </Stack>
          </Paper>
        )}

        {/* Scrollable Content Area */}
        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Tabs */}
          <Paper elevation={0} sx={{ borderBottom: '1px solid #e0e0e0' }}>
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ minHeight: 42 }}>
              <Tab label="📋 Master Data" sx={{ minHeight: 42, py: 0 }} />
              <Tab label="📦 Batches" sx={{ minHeight: 42, py: 0 }} />
            </Tabs>
          </Paper>

          {/* Tab 1: Master Data List */}
          {tabValue === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {/* Quick Search + Action Buttons Row */}
              <Paper elevation={0} sx={{ p: { xs: 0.5, sm: 0.75 }, borderBottom: '2px solid #e0e0e0', bgcolor: '#fafafa' }}>
                {/* DESKTOP LAYOUT - Exactly 2 Rows with auto-responsive sizing */}
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  {/* Row 1: Search + Filter Toggle + Refresh - Always visible */}
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: 0.5,
                    mb: 0.5,
                    alignItems: 'center'
                  }}>
                    {/* Search Field - Takes remaining space */}
                    <TextField
                      size="small"
                      placeholder="🔍 Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      sx={{
                        minWidth: 0,
                        '& .MuiInputBase-root': { height: 32 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 0.5,
                          fontSize: { md: '0.75rem', lg: '0.85rem' },
                          '&:hover fieldset': { borderColor: '#1976d2' }
                        }
                      }}
                    />

                    {/* Filter Toggle Button */}
                    <Button
                      size="small"
                      variant={showAdvancedFilters ? "contained" : "outlined"}
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      sx={{
                        height: 32,
                        minWidth: { md: 110, lg: 130 },
                        fontSize: { md: '0.7rem', lg: '0.75rem' },
                        whiteSpace: 'nowrap',
                        px: { md: 1, lg: 1.5 },
                        fontWeight: 600,
                        position: 'relative',
                        borderWidth: 2,
                        borderColor: showAdvancedFilters ? '#667eea' : '#cbd5e1',
                        bgcolor: showAdvancedFilters ? 'rgba(102, 126, 234, 0.1)' : 'white',
                        color: showAdvancedFilters ? '#667eea' : '#64748b',
                      }}
                    >
                      <FilterListIcon sx={{ fontSize: 16, mr: { md: 0.3, lg: 0.5 } }} />
                      {showAdvancedFilters ? 'Hide' : 'Show'} Filters
                      {(filterBatchId || filterStatus !== 'All' || filterBrand || filterCategory) && (
                        <Box sx={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          bgcolor: '#10b981',
                          border: '2px solid white',
                        }} />
                      )}
                    </Button>

                    {/* Refresh Button */}
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={refreshing ? <CircularProgress size={14} /> : refreshSuccess ? <CheckCircle sx={{ color: '#10b981' }} /> : <RefreshIcon fontSize="small" />}
                      onClick={() => loadMasterData({ buttonRefresh: true })}
                      disabled={refreshing || loading}
                      sx={{
                        height: 32,
                        fontSize: { md: '0.7rem', lg: '0.75rem' },
                        px: { md: 1, lg: 1.5 },
                        whiteSpace: 'nowrap',
                        minWidth: { md: 85, lg: 100 }
                      }}
                    >
                      {refreshing ? 'Refreshing...' : refreshSuccess ? 'Refreshed' : 'Refresh'}
                    </Button>


                  </Box>

                  {/* Row 2: All Filters + Action Buttons - Collapsible with auto-responsive grid */}
                  <Collapse in={showAdvancedFilters} timeout="auto">
                    <Box sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        md: 'repeat(auto-fit, minmax(100px, 1fr))',
                        lg: 'repeat(9, 1fr)'
                      },
                      gap: 0.5,
                      alignItems: 'center'
                    }}>
                      {/* Batch ID Filter */}
                      <FormControl size="small" sx={{ minWidth: 0 }}>
                        <InputLabel sx={{ fontSize: { md: '0.75rem', lg: '0.85rem' }, '&.Mui-focused': { color: '#1976d2' } }}>Batch ID</InputLabel>
                        <Select
                          value={filterBatchId}
                          label="Batch ID"
                          onChange={(e) => { setFilterBatchId(e.target.value); setPage(0); }}
                          sx={{ height: 32, fontSize: { md: '0.75rem', lg: '0.85rem' } }}
                        >
                          <MenuItem value="">All</MenuItem>
                          {batches.map(b => (
                            <MenuItem key={b.batch_id} value={b.batch_id}>{b.batch_id} ({formatNumber(b.count)})</MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {/* Status Filter */}
                      <FormControl size="small" sx={{ minWidth: 0 }}>
                        <InputLabel sx={{ fontSize: { md: '0.75rem', lg: '0.85rem' }, '&.Mui-focused': { color: '#1976d2' } }}>Status</InputLabel>
                        <Select
                          value={filterStatus}
                          label="Status"
                          onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
                          sx={{ height: 32, fontSize: { md: '0.75rem', lg: '0.85rem' } }}
                        >
                          <MenuItem value="All">All</MenuItem>
                          <MenuItem value="Received">✅ Received</MenuItem>
                          <MenuItem value="Pending">❌ Pending</MenuItem>
                        </Select>
                      </FormControl>

                      {/* Brand Filter */}
                      <FormControl size="small" sx={{ minWidth: 0 }}>
                        <InputLabel sx={{ fontSize: { md: '0.75rem', lg: '0.85rem' }, '&.Mui-focused': { color: '#1976d2' } }}>Brand</InputLabel>
                        <Select
                          value={filterBrand}
                          label="Brand"
                          onChange={(e) => { setFilterBrand(e.target.value); setPage(0); }}
                          sx={{ height: 32, fontSize: { md: '0.75rem', lg: '0.85rem' } }}
                        >
                          <MenuItem value="">All</MenuItem>
                          {Array.from(new Set(masterData.map(d => d.brand).filter(Boolean))).map(brand => (
                            <MenuItem key={brand} value={brand}>{brand}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {/* Category Filter */}
                      <FormControl size="small" sx={{ minWidth: 0 }}>
                        <InputLabel sx={{ fontSize: { md: '0.75rem', lg: '0.85rem' }, '&.Mui-focused': { color: '#1976d2' } }}>Category</InputLabel>
                        <Select
                          value={filterCategory}
                          label="Category"
                          onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }}
                          sx={{ height: 32, fontSize: { md: '0.75rem', lg: '0.85rem' } }}
                        >
                          <MenuItem value="">All</MenuItem>
                          {Array.from(new Set(masterData.map(d => d.cms_vertical).filter(Boolean))).map(category => (
                            <MenuItem key={category} value={category}>{category}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {/* Upload Button */}
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<UploadIcon fontSize="small" sx={{ display: { md: 'none', lg: 'inline-flex' } }} />}
                        onClick={() => setUploadDialogOpen(true)}
                        sx={{
                          height: 32,
                          fontSize: { md: '0.7rem', lg: '0.75rem' },
                          px: { md: 0.5, lg: 1.25 },
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          '&:hover': { boxShadow: 2 },
                          whiteSpace: 'nowrap',
                          minWidth: 0
                        }}
                      >
                        <Box component="span" sx={{ display: { md: 'none', lg: 'inline' } }}>Upload</Box>
                        <Box component="span" sx={{ display: { md: 'inline', lg: 'none' } }}>Upld</Box>
                      </Button>

                      {/* Template Button */}
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon fontSize="small" sx={{ display: { md: 'none', lg: 'inline-flex' } }} />}
                        onClick={handleDownloadTemplate}
                        sx={{
                          height: 32,
                          fontSize: { md: '0.7rem', lg: '0.75rem' },
                          px: { md: 0.5, lg: 1.25 },
                          whiteSpace: 'nowrap',
                          minWidth: 0
                        }}
                      >
                        <Box component="span" sx={{ display: { md: 'none', lg: 'inline' } }}>Template</Box>
                        <Box component="span" sx={{ display: { md: 'inline', lg: 'none' } }}>Tmpl</Box>
                      </Button>

                      {/* Export Button */}
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ExportIcon fontSize="small" sx={{ display: { md: 'none', lg: 'inline-flex' } }} />}
                        onClick={() => setExportDialogOpen(true)}
                        sx={{
                          height: 32,
                          fontSize: { md: '0.7rem', lg: '0.75rem' },
                          px: { md: 0.5, lg: 1.25 },
                          whiteSpace: 'nowrap',
                          minWidth: 0
                        }}
                      >
                        <Box component="span" sx={{ display: { md: 'none', lg: 'inline' } }}>Export</Box>
                        <Box component="span" sx={{ display: { md: 'inline', lg: 'none' } }}>Exp</Box>
                      </Button>

                      {/* Columns Button */}
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<VisibilityIcon fontSize="small" sx={{ display: { md: 'none', lg: 'inline-flex' } }} />}
                        onClick={(e) => setColumnMenuAnchor(e.currentTarget)}
                        sx={{
                          height: 32,
                          fontSize: { md: '0.7rem', lg: '0.75rem' },
                          px: { md: 0.5, lg: 1.25 },
                          whiteSpace: 'nowrap',
                          minWidth: 0
                        }}
                      >
                        <Box component="span" sx={{ display: { md: 'none', lg: 'inline' } }}>Columns</Box>
                        <Box component="span" sx={{ display: { md: 'inline', lg: 'none' } }}>Cols</Box>
                      </Button>

                      {/* Reset Button */}
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ClearIcon fontSize="small" sx={{ display: { md: 'none', lg: 'inline-flex' } }} />}
                        onClick={resetFilters}
                        sx={{
                          height: 32,
                          fontSize: { md: '0.7rem', lg: '0.75rem' },
                          px: { md: 0.5, lg: 1.25 },
                          color: '#d32f2f',
                          borderColor: '#d32f2f',
                          '&:hover': { borderColor: '#b71c1c', bgcolor: '#ffebee' },
                          whiteSpace: 'nowrap',
                          minWidth: 0
                        }}
                      >
                        <Box component="span" sx={{ display: { md: 'none', lg: 'inline' } }}>Reset</Box>
                        <Box component="span" sx={{ display: { md: 'inline', lg: 'none' } }}>Rst</Box>
                      </Button>
                    </Box>
                  </Collapse>
                </Box>

                {/* MOBILE LAYOUT - Unchanged */}
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ gap: 0.5 }}>
                    {/* Search Field */}
                    <TextField
                      size="small"
                      placeholder="🔍 Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        '& .MuiInputBase-root': { height: 36 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 0.5,
                          fontSize: '0.8rem',
                          '&:hover fieldset': { borderColor: '#1976d2' }
                        }
                      }}
                      InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: '#1976d2' }} /></InputAdornment> }}
                    />

                    {/* Filter Toggle Button */}
                    <Button
                      size="small"
                      variant={showAdvancedFilters ? "contained" : "outlined"}
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      sx={{
                        height: 36,
                        minWidth: 70,
                        fontSize: '0.7rem',
                        whiteSpace: 'nowrap',
                        px: 1,
                        fontWeight: 600,
                        position: 'relative',
                        borderWidth: 2,
                        borderColor: showAdvancedFilters ? '#667eea' : '#cbd5e1',
                        bgcolor: showAdvancedFilters ? 'rgba(102, 126, 234, 0.1)' : 'white',
                        color: showAdvancedFilters ? '#667eea' : '#64748b',
                      }}
                    >
                      <FilterListIcon sx={{ fontSize: 16, mr: 0.3 }} />
                      Filters
                      {(filterBatchId || filterStatus !== 'All' || filterBrand || filterCategory) && (
                        <Box sx={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: '#10b981',
                          border: '2px solid white',
                        }} />
                      )}
                    </Button>

                    {/* Refresh Button */}
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => loadMasterData({ buttonRefresh: true })}
                      disabled={refreshing || loading}
                      sx={{
                        height: 36,
                        minWidth: 36,
                        px: 0.5,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {refreshing ? <CircularProgress size={16} /> : refreshSuccess ? <CheckCircle sx={{ color: '#10b981' }} fontSize="small" /> : <RefreshIcon fontSize="small" />}
                    </Button>
                  </Stack>
                </Box>
              </Paper>

              {/* Advanced Filters - Mobile Only Collapsible (Unchanged) */}
              <Collapse in={showAdvancedFilters} timeout="auto">
                <Paper elevation={0} sx={{ p: 0.5, borderBottom: '1px solid #e0e0e0', bgcolor: '#f9f9f9', display: { xs: 'block', md: 'none' } }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
                    {/* Row 1: Batch ID, Status, Brand */}
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: '0.7rem' }}>Batch ID</InputLabel>
                      <Select
                        value={filterBatchId}
                        label="Batch ID"
                        onChange={(e) => { setFilterBatchId(e.target.value); setPage(0); }}
                        sx={{ height: 36, fontSize: '0.7rem' }}
                      >
                        <MenuItem value="">All</MenuItem>
                        {batches.map(b => (
                          <MenuItem key={b.batch_id} value={b.batch_id}>{b.batch_id} ({formatNumber(b.count)})</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: '0.7rem' }}>Status</InputLabel>
                      <Select
                        value={filterStatus}
                        label="Status"
                        onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
                        sx={{ height: 36, fontSize: '0.7rem' }}
                      >
                        <MenuItem value="All">All</MenuItem>
                        <MenuItem value="Received">✅ Received</MenuItem>
                        <MenuItem value="Pending">❌ Pending</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: '0.7rem' }}>Brand</InputLabel>
                      <Select
                        value={filterBrand}
                        label="Brand"
                        onChange={(e) => { setFilterBrand(e.target.value); setPage(0); }}
                        sx={{ height: 36, fontSize: '0.7rem' }}
                      >
                        <MenuItem value="">All</MenuItem>
                        {Array.from(new Set(masterData.map(d => d.brand).filter(Boolean))).map(brand => (
                          <MenuItem key={brand} value={brand}>{brand}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Row 2: Category, Upload, Export */}
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: '0.7rem' }}>Category</InputLabel>
                      <Select
                        value={filterCategory}
                        label="Category"
                        onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }}
                        sx={{ height: 36, fontSize: '0.7rem' }}
                      >
                        <MenuItem value="">All</MenuItem>
                        {Array.from(new Set(masterData.map(d => d.cms_vertical).filter(Boolean))).map(category => (
                          <MenuItem key={category} value={category}>{category}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => setUploadDialogOpen(true)}
                      sx={{
                        height: 36,
                        fontSize: '0.65rem',
                        px: 0.5,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        minWidth: 0
                      }}
                    >
                      <UploadIcon sx={{ fontSize: 16 }} />
                      <Box sx={{ fontSize: '0.55rem', fontWeight: 600, mt: 0.1 }}>Upload</Box>
                    </Button>

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setExportDialogOpen(true)}
                      sx={{
                        height: 36,
                        fontSize: '0.65rem',
                        px: 0.5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        minWidth: 0
                      }}
                    >
                      <ExportIcon sx={{ fontSize: 16 }} />
                      <Box sx={{ fontSize: '0.55rem', fontWeight: 600, mt: 0.1 }}>Export</Box>
                    </Button>

                    {/* Row 3: Template, Columns, Reset */}
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleDownloadTemplate}
                      sx={{
                        height: 36,
                        fontSize: '0.65rem',
                        px: 0.5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        minWidth: 0
                      }}
                    >
                      <DownloadIcon sx={{ fontSize: 16 }} />
                      <Box sx={{ fontSize: '0.55rem', fontWeight: 600, mt: 0.1 }}>Template</Box>
                    </Button>

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={(e) => setColumnMenuAnchor(e.currentTarget)}
                      sx={{
                        height: 36,
                        fontSize: '0.65rem',
                        px: 0.5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        minWidth: 0
                      }}
                    >
                      <VisibilityIcon sx={{ fontSize: 16 }} />
                      <Box sx={{ fontSize: '0.55rem', fontWeight: 600, mt: 0.1 }}>Columns</Box>
                    </Button>

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={resetFilters}
                      sx={{
                        height: 36,
                        fontSize: '0.65rem',
                        px: 0.5,
                        color: '#d32f2f',
                        borderColor: '#d32f2f',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        minWidth: 0
                      }}
                    >
                      <ClearIcon sx={{ fontSize: 16 }} />
                      <Box sx={{ fontSize: '0.55rem', fontWeight: 600, mt: 0.1 }}>Reset</Box>
                    </Button>
                  </Box>
                </Paper>
              </Collapse>




              {/* Excel-like Data Table */}
              <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0', position: 'relative' }}>
                {showLoadingOverlay && loading && (
                  <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(255,255,255,0.65)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(0.5px)', opacity: showLoadingOverlay ? 1 : 0, transition: 'opacity 0.2s ease-in-out' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8 }}>
                      <CircularProgress size={36} thickness={4} />
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500 }}>Loading...</Typography>
                    </Box>
                  </Box>
                )}
                <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                  <Table stickyHeader size="small" sx={{ borderCollapse: 'collapse' }}>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#1565c0' }}>
                        <TableCell sx={{ bgcolor: '#1565c0', color: 'white', fontWeight: '700', width: 35, py: 0.3, px: 0.8, border: '1px solid #1565c0', position: 'sticky', top: 0, zIndex: 3, fontSize: '0.8rem' }}>#</TableCell>
                        {columns.filter(col => columnVisibility[col.id as keyof typeof columnVisibility]).map(col => (
                          <TableCell key={col.id} sx={{ bgcolor: '#1565c0', color: 'white', fontWeight: '700', minWidth: col.width, py: 0.3, px: 0.8, border: '1px solid #1565c0', fontSize: '0.8rem', position: 'sticky', top: 0, zIndex: 3, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{col.label}</TableCell>
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
                <Box sx={{ borderTop: '2px solid #1565c0', bgcolor: '#f5f5f5', py: 0.25 }}>
                  <TablePagination
                    component="div"
                    count={totalRecords}
                    page={page}
                    onPageChange={(e, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => { const value = parseInt(e.target.value, 10); setRowsPerPage(Math.min(value, 1000)); setPage(0); }}
                    rowsPerPageOptions={[100, 500, 1000]}
                    labelRowsPerPage="Rows:"
                    sx={{
                      '& .MuiTablePagination-toolbar': {
                        minHeight: 40,
                        px: { xs: 1, sm: 2 },
                        py: 0.25,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5
                      },
                      '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        margin: 0
                      },
                      '& .MuiTablePagination-select': {
                        borderRadius: 1
                      }
                    }}
                    labelDisplayedRows={({ from, to, count }) => `${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(count)}`}
                  />
                </Box>
              </Box>
            </Box>
          ) : null}

          {/* Tab 2: Batch Management */}
          {tabValue === 1 ? (
            <Paper sx={{ m: { xs: 0.5, sm: 1 }, p: { xs: 1, sm: 1.5 }, flex: 1, overflow: 'auto', borderRadius: { xs: 0, sm: 1 } }}>
              <TableContainer sx={{ overflowX: 'auto' }}>

                <Table size="small" sx={{ minWidth: 600 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1565c0' }}>
                      <TableCell sx={{ fontWeight: '700', color: 'white', py: 1, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Batch ID</TableCell>
                      <TableCell sx={{ fontWeight: '700', color: 'white', py: 1, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Records</TableCell>
                      <TableCell sx={{ fontWeight: '700', color: 'white', py: 1, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last Updated</TableCell>
                      <TableCell sx={{ fontWeight: '700', color: 'white', py: 1, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.5px' }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {batches && batches.length > 0 ? (
                      batches.map(batch => (
                        <TableRow key={batch.batch_id} hover sx={{ '&:hover': { bgcolor: '#e3f2fd' } }}>
                          <TableCell sx={{ fontWeight: '600', py: 1.2 }}>{batch.batch_id || '-'}</TableCell>
                          <TableCell sx={{ py: 1.2 }}><Chip label={formatNumber(batch.count || 0)} size="small" variant="outlined" color="primary" /></TableCell>
                          <TableCell>
                            {batch.lastupdated_display ? batch.lastupdated_display : '-'}
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" color="error" onClick={() => handleDeleteBatch(batch.batch_id)}>
                              <DeleteSweepIcon />   Delete Batch
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
        <Dialog
          open={uploadDialogOpen}
          onClose={() => {
            // ✅ Don't allow closing if upload is in progress
            if (!loading && !uploadProgress.show) {
              setUploadDialogOpen(false);
              setSelectedFile(null);
              setUploadError('');
              setFileValidationError('');
            }
          }}
          maxWidth="sm"
          fullWidth
          // ✅ Prevent closing by clicking outside if uploading
          disableEscapeKeyDown={loading || uploadProgress.show}
        >
          <DialogTitle fontWeight="bold" sx={{ borderBottom: '2px solid #1976d2', pb: 1.5 }}>
            📤 Upload Excel File
          </DialogTitle>

          <DialogContent sx={{ p: 3 }}>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              {/* Instructions */}
              <Paper sx={{ p: 2, bgcolor: '#e3f2fd', borderLeft: '4px solid #2196f3' }}>
                <Stack spacing={1}>
                  <Typography variant="body2" fontWeight="600" color="primary.main">
                    📋 Upload Requirements:
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    • Use the template file (Download Template button)
                    <br />
                    • All 20 columns must be in exact order
                    <br />
                    • Supported formats: .xlsx, .xls, .csv
                    <br />
                    • Maximum file size: 50MB
                  </Typography>
                </Stack>
              </Paper>

              {/* File Validation Error Display */}
              {fileValidationError && (
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: '#ffebee',
                    borderLeft: '4px solid #d32f2f',
                    animation: 'fadeIn 0.3s ease-in'
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{
                      bgcolor: '#d32f2f',
                      borderRadius: '50%',
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Typography variant="caption" fontWeight="bold" color="white">!</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight="600" color="error.main" gutterBottom>
                        Validation Error
                      </Typography>
                      <Typography variant="caption" color="error.dark" sx={{ whiteSpace: 'pre-wrap' }}>
                        {fileValidationError}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}

              {/* Backend Error Display */}
              {uploadError && (
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: '#fff3e0',
                    borderLeft: '4px solid #f57c00',
                    animation: 'fadeIn 0.3s ease-in'
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{
                      bgcolor: '#f57c00',
                      borderRadius: '50%',
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Typography variant="caption" fontWeight="bold" color="white">✕</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight="600" color="warning.dark" gutterBottom>
                        Upload Error
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.primary"
                        sx={{
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'monospace',
                          display: 'block',
                          bgcolor: 'rgba(0,0,0,0.05)',
                          p: 1,
                          borderRadius: 1,
                          fontSize: '0.75rem'
                        }}
                      >
                        {uploadError}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleDownloadTemplate}
                        sx={{ mt: 1.5, fontSize: '0.75rem' }}
                        startIcon={<DownloadIcon fontSize="small" />}
                      >
                        Download Correct Template
                      </Button>
                    </Box>
                  </Stack>
                </Paper>
              )}

              {/* File Input */}
              <input
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                id="file-upload"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                  setUploadError('');
                  setFileValidationError('');
                }}
              />
              <label htmlFor="file-upload">
                <Button
                  variant="outlined"
                  component="span"
                  fullWidth
                  sx={{
                    height: 48,
                    borderStyle: 'dashed',
                    borderWidth: 2,
                    '&:hover': {
                      borderStyle: 'dashed',
                      borderWidth: 2,
                      bgcolor: '#f5f5f5'
                    }
                  }}
                >
                  {selectedFile ? 'Change File' : 'Choose File'}
                </Button>
              </label>

              {/* Selected File Display */}
              {selectedFile && (
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: '#f5f5f5',
                    border: '1px solid #e0e0e0',
                    borderRadius: 1
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        fontWeight="600"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        📄 {selectedFile.name}
                      </Typography>
                      <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Type: {selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toUpperCase()}
                        </Typography>
                      </Stack>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedFile(null);
                        setUploadError('');
                        setFileValidationError('');
                      }}
                      sx={{
                        bgcolor: 'white',
                        '&:hover': { bgcolor: '#ffebee', color: 'error.main' }
                      }}
                    >
                      <CancelIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0', gap: 1 }}>
            <Button
              onClick={() => {
                setUploadDialogOpen(false);
                setSelectedFile(null);
                setUploadError('');
                setFileValidationError('');
              }}
              disabled={loading}
              variant="outlined"
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
              onClick={handleFileUpload}
              disabled={!selectedFile || loading || !!fileValidationError}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #63408b 100%)',
                }
              }}
            >
              {loading ? 'Uploading...' : 'Upload & Process'}
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
      </Box>
    </AppLayout>
  );
}