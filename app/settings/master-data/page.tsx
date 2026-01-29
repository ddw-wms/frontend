// File Path = warehouse-frontend/app/settings/master-data/page.tsx
'use client';

import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, AppBar, Toolbar, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Pagination,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip, CircularProgress,
  LinearProgress, IconButton, Tabs, Tab, Menu, MenuItem, Checkbox, ListItemText,
  TextField, FormControl, InputLabel, Select, InputAdornment, Badge, useTheme, useMediaQuery,
  Collapse, Tooltip, FormControlLabel, Divider, Grid, Card, CardContent, InputBase, Fade
} from '@mui/material';
import {
  Upload as UploadIcon, Refresh as RefreshIcon, Logout as LogoutIcon,
  GetApp as ExportIcon, Visibility as VisibilityIcon, Cancel as CancelIcon,
  DeleteSweep as DeleteSweepIcon, Download as DownloadIcon, Search as SearchIcon,
  Speed as SpeedIcon, Clear as ClearIcon, CheckCircle, Settings as SettingsIcon,
  Tune as TuneIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon, Close as CloseIcon, KeyboardArrowLeft, KeyboardArrowRight, FirstPage, LastPage, AccessTime
} from '@mui/icons-material';
import toast, { Toaster } from 'react-hot-toast';
import { getStoredUser, logout } from '@/lib/auth';
import { masterDataAPI } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { BatchManagementTab, StandardPageHeader } from '@/components';
import { useWarehouse } from '@/app/context/WarehouseContext';
// ⚡ OPTIMIZED: XLSX loaded dynamically on export to reduce bundle size
// import * as XLSX from 'xlsx'; // Removed - loaded dynamically
import { useMasterDataPermissions } from '@/hooks/usePagePermissions';
// Simple localStorage-based grid state (native ag-Grid pattern)

import FilterListIcon from '@mui/icons-material/FilterList';

import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, ClientSideRowModelModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

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
      {columnVisibility.wsn && <TableCell sx={{ ...cellStyle, fontWeight: 600, color: '#1e40af' }}>{row.wsn || '-'}</TableCell>}
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
      {columnVisibility.batch_id && <TableCell sx={cellStyle}>{row.batch_id || '-'}</TableCell>}
      {columnVisibility.actual_received && <TableCell sx={cellStyle}>
        <Chip
          label={row.actual_received || 'Pending'}
          size="small"
          color={
            row.actual_received === 'Received' ? 'success' :
              row.actual_received === 'Receiving' ? 'info' :
                'warning'
          }
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

// Actions Cell Renderer Component for AG Grid
const ActionsCellRenderer = memo((props: any) => {
  const { data, context } = props;
  if (!data) return null;

  const { canSeeButton, canAccessButton, isAdmin } = context || {};

  // Check visibility for edit button
  const showEditButton = isAdmin || canSeeButton?.('edit');
  const canEdit = isAdmin || canAccessButton?.('edit');

  // Check visibility for delete button
  const showDeleteButton = isAdmin || canSeeButton?.('delete');
  const canDelete = isAdmin || canAccessButton?.('delete');

  return (
    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      {showEditButton && (
        <IconButton
          size="small"
          onClick={() => context?.onEdit?.(data)}
          disabled={!canEdit}
          sx={{
            bgcolor: canEdit ? '#e3f2fd' : '#f5f5f5',
            borderRadius: 1,
            p: 0.5,
            opacity: canEdit ? 1 : 0.5,
            '&:hover': { bgcolor: canEdit ? '#bbdefb' : '#f5f5f5' }
          }}
          title="Edit"
        >
          <EditIcon sx={{ fontSize: 16, color: canEdit ? '#1e40af' : '#9e9e9e' }} />
        </IconButton>
      )}
      {showDeleteButton && (
        <IconButton
          size="small"
          onClick={() => context?.onDelete?.(data)}
          disabled={!canDelete}
          sx={{
            bgcolor: canDelete ? '#ffebee' : '#f5f5f5',
            borderRadius: 1,
            p: 0.5,
            opacity: canDelete ? 1 : 0.5,
            '&:hover': { bgcolor: canDelete ? '#ffcdd2' : '#f5f5f5' }
          }}
          title="Delete"
        >
          <DeleteIcon sx={{ fontSize: 16, color: canDelete ? '#d32f2f' : '#9e9e9e' }} />
        </IconButton>
      )}
    </Box>
  );
});
ActionsCellRenderer.displayName = 'ActionsCellRenderer';

// Actual Received Cell Renderer Component for AG Grid - visible in both themes
const ActualReceivedCellRenderer = memo((props: any) => {
  const { value } = props;
  const status = value || 'Pending';

  const getStyles = () => {
    if (status === 'Received') {
      return {
        bgcolor: '#22c55e',  // solid green background
        color: '#ffffff',    // white text
        borderColor: '#16a34a',
      };
    } else if (status === 'Receiving') {
      return {
        bgcolor: '#3b82f6',  // solid blue background
        color: '#ffffff',    // white text
        borderColor: '#2563eb',
      };
    } else {
      return {
        bgcolor: '#f59e0b',  // solid amber background
        color: '#ffffff',    // white text
        borderColor: '#d97706',
      };
    }
  };

  const styles = getStyles();

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
    }}>
      <Chip
        label={status}
        size="small"
        sx={{
          bgcolor: `${styles.bgcolor} !important`,
          color: `${styles.color} !important`,
          border: `1px solid ${styles.borderColor} !important`,
          fontWeight: 700,
          fontSize: '0.75rem',
          height: 24,
          '& .MuiChip-label': {
            color: `${styles.color} !important`,
          }
        }}
      />
    </Box>
  );
});
ActualReceivedCellRenderer.displayName = 'ActualReceivedCellRenderer';

export default function MasterDataPage() {


  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';
  const progressIntervalRef = useRef<any>(null);
  const loadingTimeoutRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);

  // Warehouse context
  const { activeWarehouse } = useWarehouse();

  // Permission hook
  const { filterTabs, canSeeTab, canSeeButton, canAccessButton, isAdmin, isLoading: permLoading } = useMasterDataPermissions();

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

  // Search field ref for keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Column visibility - Hide less critical columns by default to maximize table space  
  const [columnVisibility, setColumnVisibility] = useState({
    wsn: true,              // ✅ Visible by default
    wid: true,              // ✅ Ab visible hoga
    fsn: true,              // ✅ Ab visible hoga
    order_id: true,         // ✅ Visible
    fkqc_remark: true,     // ✅ Visible
    fk_grade: false,         // ❌ Hidden
    product_title: true,    // ✅ Visible
    hsn_sac: true,          // ✅ Ab visible hoga
    igst_rate: true,       // ✅ Visible
    fsp: true,              // ✅ Ab visible hoga
    mrp: true,              // ✅ Ab visible hoga
    invoice_date: false,     // ❌ Hidden
    fkt_link: false,        // ❌ Hidden
    wh_location: true,      // ✅ Ab visible hoga
    brand: true,            // ✅ Visible
    cms_vertical: true,     // ✅ Visible
    vrp: false,             // ❌ Hidden
    yield_value: false,     // ❌ Hidden
    p_type: false,          // ❌ Hidden
    p_size: false,          // ❌ Hidden
    batch_id: false,         // ❌ Hidden
    actual_received: true,  // ✅ Visible
    created_at: false        // ❌ Hidden
  });

  // ✅ NEW: Filters for batch, status, brand, and category
  const [filterBatchId, setFilterBatchId] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // ✅ NEW: Brands and categories loaded from API (database)
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  // Add/Edit Product Dialog States
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productFormData, setProductFormData] = useState({
    wsn: '', wid: '', fsn: '', order_id: '', fkqc_remark: '', fk_grade: '',
    product_title: '', hsn_sac: '', igst_rate: '', fsp: '', mrp: '',
    invoice_date: '', fkt_link: '', wh_location: '', brand: '', cms_vertical: '',
    vrp: '', yield_value: '', p_type: '', p_size: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<any>(null);

  // ⚡ PAGE CACHE: Store fetched pages to avoid redundant API calls
  const pageCacheRef = useRef<Map<string, { data: any[], total: number, timestamp: number }>>(new Map());
  const PAGE_CACHE_TTL = 60000; // Cache TTL: 60 seconds

  // ⚡ AUTO-RETRY: For network failures
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  // ⚡ LAZY FILTER LOADING: Load filters after initial data
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // AG Grid refs and state
  const gridRef = useRef<any>(null);
  const columnApiRef = useRef<any>(null);
  const [columnDefs, setColumnDefs] = useState<any[]>([]);
  const hasAutoFittedRef = useRef(false); // Track if auto-fit has been done
  const [topLoading, setTopLoading] = useState(false);
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const overlayShownRef = useRef(false);
  const overlayStartRef = useRef<number | null>(null);
  const SHOW_OVERLAY_DELAY = 150;
  const MIN_LOADING_MS = 350;

  // Grid settings
  const [enableSorting, setEnableSorting] = useState<boolean>(() => {
    try { return localStorage.getItem('masterdata_enableSorting') !== 'false'; } catch { return true; }
  });
  const [enableColumnFilters, setEnableColumnFilters] = useState<boolean>(() => {
    try { return localStorage.getItem('masterdata_enableColumnFilters') !== 'false'; } catch { return true; }
  });
  const [enableColumnResize, setEnableColumnResize] = useState<boolean>(() => {
    try { return localStorage.getItem('masterdata_enableColumnResize') !== 'false'; } catch { return true; }
  });
  const [enableCellEditing, setEnableCellEditing] = useState<boolean>(() => {
    try { return localStorage.getItem('masterdata_enableCellEditing') !== 'false'; } catch { return true; }
  });

  const defaultColDef = useMemo(() => ({
    sortable: !!enableSorting,
    resizable: !!enableColumnResize,
    filter: !!enableColumnFilters,
    editable: !!enableCellEditing,
    minWidth: 80,
    tooltipComponentParams: { color: '#ececec' },
    wrapHeaderText: true,
    autoHeaderHeight: true,
  }), [enableSorting, enableColumnFilters, enableColumnResize, enableCellEditing]);

  const columns = [
    { id: 'wsn', label: 'WSN', width: 120 },
    { id: 'wid', label: 'WID', width: 120 },
    { id: 'fsn', label: 'FSN', width: 120 },
    { id: 'order_id', label: 'Order ID', width: 130 },
    { id: 'fkqc_remark', label: 'FKQC Remark', width: 150 },
    { id: 'fk_grade', label: 'Grade', width: 100 },
    { id: 'product_title', label: 'Product Title', width: 450, flex: 1 },
    { id: 'hsn_sac', label: 'HSN/SAC', width: 110 },
    { id: 'igst_rate', label: 'IGST Rate', width: 100 },
    { id: 'fsp', label: 'FSP', width: 90 },
    { id: 'mrp', label: 'MRP', width: 90 },
    { id: 'invoice_date', label: 'Invoice Date', width: 120 },
    { id: 'fkt_link', label: 'Fkt Link', width: 150 },
    { id: 'wh_location', label: 'Location', width: 120 },
    { id: 'brand', label: 'Brand', width: 140 },
    { id: 'cms_vertical', label: 'Category', width: 150 },
    { id: 'vrp', label: 'VRP', width: 90 },
    { id: 'yield_value', label: 'Yield', width: 90 },
    { id: 'p_type', label: 'Type', width: 100 },
    { id: 'p_size', label: 'Size', width: 100 },
    { id: 'batch_id', label: 'Batch ID', width: 200 },
    { id: 'actual_received', label: 'Actual Received', width: 130 },
    { id: 'created_at', label: 'Created', width: 150 }
  ];

  // AG Grid column sizing helper
  const getColumnSizing = useCallback((col: string) => {
    const colConfig = columns.find(c => c.id === col) as any;
    if (!colConfig) return { minWidth: 80 };

    const sizing: any = {
      minWidth: 80,
    };

    // Add flex for columns that should expand (like product_title)
    if (colConfig.flex) {
      sizing.flex = colConfig.flex;
      sizing.minWidth = colConfig.width || 200;
    } else {
      sizing.width = isMobile ? Math.max(70, Math.round(colConfig.width * 0.7)) : colConfig.width;
    }

    return sizing;
  }, [isMobile]);

  // Build column definitions for AG Grid
  useEffect(() => {
    const visibleCols = columns.filter(col => columnVisibility[col.id as keyof typeof columnVisibility]);

    // SR.NO column - always first, pinned to left
    const srCol = {
      headerName: 'SR.NO',
      field: '__sr',
      valueGetter: (params: any) => params.node ? page * rowsPerPage + params.node.rowIndex + 1 : undefined,
      width: 80,
      minWidth: 80,
      maxWidth: 100,
      suppressMovable: true,
      sortable: false,
      filter: false,
      pinned: 'left',
      lockPinned: true,
      cellStyle: { fontWeight: 700, textAlign: 'center', backgroundColor: isDarkMode ? '#1e293b' : '#fafafa' },
    };

    const defs: any = [srCol, ...visibleCols.map((col) => {
      const base: any = {
        field: col.id,
        headerName: col.label,
        sortable: enableSorting,
        resizable: enableColumnResize,
        filter: enableColumnFilters ? 'agTextColumnFilter' : undefined,
        tooltipField: col.id,
        ...getColumnSizing(col.id),
      };

      // Grade column - normal text
      if (col.id === 'fk_grade') {
        return {
          ...base,
          valueFormatter: (p: any) => p.value || '-',
        };
      }

      // Actual received column - with bright visible colors using custom renderer
      if (col.id === 'actual_received') {
        return {
          ...base,
          cellRenderer: ActualReceivedCellRenderer,
        };
      }

      // Batch ID column - plain text
      if (col.id === 'batch_id') {
        return {
          ...base,
          valueFormatter: (p: any) => p.value || '-',
          cellStyle: {
            color: '#1e40af',
            fontWeight: 500,
            fontSize: '0.8rem'
          },
        };
      }

      // Date columns
      if (col.id.includes('date') || col.id === 'created_at') {
        return {
          ...base,
          valueFormatter: (p: any) => {
            if (!p.value) return '-';
            if (col.id === 'invoice_date') return p.data?.invoice_date_display || '-';
            if (col.id === 'created_at') return p.data?.created_at_display || '-';
            return formatDateToIST(p.value, 'date');
          },
        };
      }

      // Price columns
      if (col.id === 'fsp' || col.id === 'mrp' || col.id === 'vrp') {
        return {
          ...base,
          valueFormatter: (p: any) => {
            if (!p.value) return '-';
            // VRP shows normal number, FSP and MRP show rupees
            if (col.id === 'vrp') return p.value;
            return `₹${p.value}`;
          },
          cellStyle: { textAlign: 'right' }
        };
      }

      return base;
    })];

    // Add Actions column at the end
    defs.push({
      headerName: 'Actions',
      field: 'actions',
      sortable: false,
      filter: false,
      resizable: true,
      width: 100,
      minWidth: 100,
      maxWidth: 120,
      cellRenderer: ActionsCellRenderer
    });

    setColumnDefs(defs);
  }, [columnVisibility, enableSorting, enableColumnFilters, enableColumnResize, isMobile, page, rowsPerPage, getColumnSizing]);

  // Re-apply column state when columnDefs change (e.g., column visibility toggle)
  // applyOrder: false - updates widths/visibility WITHOUT changing order
  // Order is set ONLY ONCE in onGridReady
  useEffect(() => {
    if (gridRef.current) {
      try {
        const saved = localStorage.getItem('masterdata_grid_state');
        if (saved) {
          const state = JSON.parse(saved);
          gridRef.current.applyColumnState({ state, applyOrder: false });
        }
      } catch { /* ignore */ }
    }
  }, [columnDefs]);

  // Save grid settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('masterdata_enableSorting', String(enableSorting));
      localStorage.setItem('masterdata_enableColumnFilters', String(enableColumnFilters));
      localStorage.setItem('masterdata_enableColumnResize', String(enableColumnResize));
      localStorage.setItem('masterdata_enableCellEditing', String(enableCellEditing));
    } catch { }
  }, [enableSorting, enableColumnFilters, enableColumnResize, enableCellEditing]);

  // ✅ Keyboard shortcut: Ctrl/Cmd + K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Escape to clear search and blur
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // ✅ Debounced search effect (300ms delay for smooth performance)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0); // Reset to first page on search
    }, 300);

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
      // Note: loadBrands and loadCategories are handled by their respective useEffects
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

  // ⚡ HELPER: Generate cache key for current filters
  const getCacheKey = useCallback(() => {
    return JSON.stringify({
      page,
      rowsPerPage,
      search: debouncedSearch,
      batchId: filterBatchId,
      status: filterStatus,
      brand: filterBrand,
      category: filterCategory,
    });
  }, [page, rowsPerPage, debouncedSearch, filterBatchId, filterStatus, filterBrand, filterCategory]);

  // ⚡ PREFETCH: Prefetch next page in background
  const prefetchNextPage = useCallback(async () => {
    const totalPages = Math.ceil(totalRecords / rowsPerPage);
    if (page >= totalPages - 1) return;

    const nextPageCacheKey = JSON.stringify({
      page: page + 1,
      rowsPerPage,
      search: debouncedSearch,
      batchId: filterBatchId,
      status: filterStatus,
      brand: filterBrand,
      category: filterCategory,
    });

    const cached = pageCacheRef.current.get(nextPageCacheKey);
    if (cached && Date.now() - cached.timestamp < PAGE_CACHE_TTL) return;

    try {
      const params = new URLSearchParams();
      params.append('page', (page + 2).toString()); // page is 0-indexed, API is 1-indexed
      params.append('limit', rowsPerPage.toString());
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filterBatchId) params.append('batch_id', filterBatchId);
      if (filterStatus && filterStatus !== 'All') params.append('status', filterStatus);
      if (filterBrand) params.append('brand', filterBrand);
      if (filterCategory) params.append('category', filterCategory);

      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/master-data?${params.toString()}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!response.ok) return;
      const data = await response.json();
      const formattedData = (data.data || []).map((item: any) => ({
        ...item,
        invoice_date_display: formatDateToIST(item.invoice_date, 'date'),
        created_at_display: formatDateToIST(item.created_at, 'datetime')
      }));
      pageCacheRef.current.set(nextPageCacheKey, {
        data: formattedData,
        total: data.total || 0,
        timestamp: Date.now(),
      });
    } catch { /* Silently fail - prefetch is optional */ }
  }, [page, rowsPerPage, totalRecords, debouncedSearch, filterBatchId, filterStatus, filterBrand, filterCategory]);

  const loadMasterData = useCallback(async ({ buttonRefresh = false } = {}) => {
    const cacheKey = getCacheKey();

    // ⚡ PAGE CACHE: Check cache first (unless force refresh)
    if (!buttonRefresh) {
      const cached = pageCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PAGE_CACHE_TTL) {
        setMasterData(cached.data);
        setTotalRecords(cached.total);
        setLastRefreshTime(new Date(cached.timestamp));
        setLoading(false);
        setTimeout(() => prefetchNextPage(), 100);
        return;
      }
    }

    if (buttonRefresh) {
      setRefreshing(true);
      setRefreshSuccess(false);
    } else {
      setLoading(true);
      // Show delayed overlay to avoid blinking on fast loads
      if (masterData.length > 0) {
        if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
        overlayShownRef.current = false;
        overlayStartRef.current = null;
        overlayTimerRef.current = setTimeout(() => {
          try {
            setTopLoading(true);
            overlayShownRef.current = true;
            overlayStartRef.current = Date.now();
            try { gridRef.current?.api?.showLoadingOverlay(); } catch { }
          } catch (err) { }
          overlayTimerRef.current = null;
        }, SHOW_OVERLAY_DELAY);
      }
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

      // ⚡ CACHE: Store in cache
      pageCacheRef.current.set(cacheKey, {
        data: formattedData,
        total: data.total || 0,
        timestamp: Date.now(),
      });
      retryCountRef.current = 0; // Reset retry count on success

      // ⚡ PREFETCH: Trigger prefetch of next page
      setTimeout(() => prefetchNextPage(), 100);

      // Update grid if available
      if (gridRef.current && typeof gridRef.current.setRowData === 'function') {
        try {
          gridRef.current.setRowData(formattedData);
        } catch { }
      }

      if (buttonRefresh) {
        toast.success('✓ Refreshed');
        setRefreshSuccess(true);
        setTimeout(() => setRefreshSuccess(false), 2000);
      }
    } catch (error) {
      console.error('Load error:', error);
      // ⚡ AUTO-RETRY: Retry on network errors (max 2 times)
      if (retryCountRef.current < MAX_RETRIES && !buttonRefresh) {
        retryCountRef.current += 1;
        const delay = Math.pow(2, retryCountRef.current) * 500;
        setTimeout(() => loadMasterData({ buttonRefresh: false }), delay);
        return;
      }
      toast.error('Failed to load data');
    } finally {
      if (buttonRefresh) {
        setRefreshing(false);
      } else {
        // Handle overlay cleanup
        if (overlayShownRef.current && overlayStartRef.current) {
          const elapsed = Date.now() - overlayStartRef.current;
          if (elapsed < MIN_LOADING_MS) {
            await new Promise(res => setTimeout(res, MIN_LOADING_MS - elapsed));
          }
          try { gridRef.current?.api?.hideOverlay(); } catch { }
          overlayShownRef.current = false;
          overlayStartRef.current = null;
          try { setTopLoading(false); } catch { }
        } else {
          if (overlayTimerRef.current) {
            clearTimeout(overlayTimerRef.current);
            overlayTimerRef.current = null;
          }
        }

        setLoading(false);
        setShowLoadingOverlay(false);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      }
    }
  }, [page, rowsPerPage, debouncedSearch, filterBatchId, filterStatus, filterBrand, filterCategory, getCacheKey, prefetchNextPage, masterData.length]);

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

  // ✅ Load brands from database API (optionally filtered by category)
  const loadBrands = async (category?: string) => {
    try {
      const response = await masterDataAPI.getBrands(category || undefined);
      setBrandOptions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load brands:', error);
      setBrandOptions([]);
    }
  };

  // ✅ Load categories from database API (optionally filtered by brand)
  const loadCategories = async (brand?: string) => {
    try {
      const response = await masterDataAPI.getCategories(brand || undefined);
      setCategoryOptions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategoryOptions([]);
    }
  };

  // ✅ Dynamic filter: When brand changes, reload categories for that brand
  useEffect(() => {
    if (filterBrand) {
      loadCategories(filterBrand);
    } else {
      loadCategories(); // Load all categories when no brand selected
    }
  }, [filterBrand]);

  // ✅ Dynamic filter: When category changes, reload brands for that category
  useEffect(() => {
    if (filterCategory) {
      loadBrands(filterCategory);
    } else {
      loadBrands(); // Load all brands when no category selected
    }
  }, [filterCategory]);

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

  // ✅ Reset product form
  const resetProductForm = () => {
    setProductFormData({
      wsn: '', wid: '', fsn: '', order_id: '', fkqc_remark: '', fk_grade: '',
      product_title: '', hsn_sac: '', igst_rate: '', fsp: '', mrp: '',
      invoice_date: '', fkt_link: '', wh_location: '', brand: '', cms_vertical: '',
      vrp: '', yield_value: '', p_type: '', p_size: ''
    });
  };

  // ✅ Open Add Product Dialog
  const handleOpenAddDialog = () => {
    resetProductForm();
    setAddDialogOpen(true);
  };

  // ✅ Open Edit Product Dialog
  const handleOpenEditDialog = (product: any) => {
    setEditingProduct(product);
    setProductFormData({
      wsn: product.wsn || '',
      wid: product.wid || '',
      fsn: product.fsn || '',
      order_id: product.order_id || '',
      fkqc_remark: product.fkqc_remark || '',
      fk_grade: product.fk_grade || '',
      product_title: product.product_title || '',
      hsn_sac: product.hsn_sac || '',
      igst_rate: product.igst_rate || '',
      fsp: product.fsp || '',
      mrp: product.mrp || '',
      invoice_date: product.invoice_date || '',
      fkt_link: product.fkt_link || '',
      wh_location: product.wh_location || '',
      brand: product.brand || '',
      cms_vertical: product.cms_vertical || '',
      vrp: product.vrp || '',
      yield_value: product.yield_value || '',
      p_type: product.p_type || '',
      p_size: product.p_size || ''
    });
    setEditDialogOpen(true);
  };

  // ✅ Handle Add Product Submit
  const handleAddProduct = async () => {
    if (!productFormData.wsn.trim()) {
      toast.error('WSN is required');
      return;
    }

    setFormSubmitting(true);
    try {
      await masterDataAPI.create(productFormData);
      toast.success('✅ Product added successfully!');
      setAddDialogOpen(false);
      resetProductForm();
      loadMasterData({ buttonRefresh: true });
      loadBatches();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to add product';
      toast.error(errorMsg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // ✅ Handle Edit Product Submit
  const handleEditProduct = async () => {
    if (!editingProduct?.id) {
      toast.error('Invalid product');
      return;
    }

    if (!productFormData.wsn.trim()) {
      toast.error('WSN is required');
      return;
    }

    setFormSubmitting(true);
    try {
      await masterDataAPI.update(editingProduct.id, productFormData);
      toast.success('✅ Product updated successfully!');
      setEditDialogOpen(false);
      setEditingProduct(null);
      resetProductForm();
      loadMasterData({ buttonRefresh: true });
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to update product';
      toast.error(errorMsg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // ✅ Handle Delete Product
  const handleDeleteProduct = async () => {
    if (!deletingProduct?.id) {
      toast.error('Invalid product');
      return;
    }

    setFormSubmitting(true);
    try {
      await masterDataAPI.delete(deletingProduct.id);
      toast.success('✅ Product deleted successfully!');
      setDeleteConfirmOpen(false);
      setDeletingProduct(null);
      loadMasterData({ buttonRefresh: true });
      loadBatches();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to delete product';
      toast.error(errorMsg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // ✅ Open Delete Confirmation
  const handleOpenDeleteConfirm = (product: any) => {
    setDeletingProduct(product);
    setDeleteConfirmOpen(true);
  };

  // ✅ ISSUE #5 FIX: Download template function
  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/master-data/download-template`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'master-data-template.xlsx';
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('✓ Template downloaded successfully!', { icon: '⬇️' });
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
      // ⚡ OPTIMIZED: Load XLSX dynamically
      const XLSX = await import('xlsx');

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
          background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}>

          {/* ==================== HEADER SECTION ==================== */}
          <StandardPageHeader
            title="Master Data"
            subtitle="Manage master data"
            icon="📊"
            warehouseName={activeWarehouse?.name}
            userName={user?.fullName}
          />
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
          {(() => {
            // Define all tabs with their permission codes
            const allTabs = [
              { label: '📋 Master Data', code: 'list' },
              { label: '📦 Batches', code: 'batches' }
            ];

            // Filter visible tabs based on permissions
            const visibleTabs = allTabs.filter(tab => canSeeTab(tab.code));

            // Map visible tab index to actual tab index
            const getActualTabIndex = (visibleIndex: number) => {
              const visibleTab = visibleTabs[visibleIndex];
              return allTabs.findIndex(t => t.code === visibleTab?.code);
            };

            // Current actual tab index
            const actualTabIndex = getActualTabIndex(tabValue);

            return (
              <>
                <Paper elevation={0} sx={{ borderBottom: '1px solid #e0e0e0' }}>
                  <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ minHeight: 42 }}>
                    {visibleTabs.map((tab, idx) => (
                      <Tab key={tab.code} label={tab.label} sx={{ minHeight: 42, py: 0 }} />
                    ))}
                  </Tabs>
                </Paper>

                {/* Tab 1: Master Data List */}
                {actualTabIndex === 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', p: { xs: 0.25, sm: 0.5 } }}>
                    {/* SEARCH BAR + FILTERS TOGGLE */}
                    <Box sx={{ flexShrink: 0, mb: 1, position: 'relative', zIndex: 95 }}>
                      <Stack direction="row" spacing={1} alignItems="stretch" sx={{ mb: 1 }}>
                        {/* Search Field */}
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="🔍 Search by WSN, Product Title, or any field..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          inputRef={searchInputRef}
                          sx={{
                            flex: 1,
                            '& .MuiOutlinedInput-root': {
                              bgcolor: isDarkMode ? '#1e293b' : 'white',
                              borderRadius: 1.5,
                              height: 38,
                              fontSize: { xs: '0.8rem', sm: '0.875rem' },
                              fontWeight: 500,
                              border: isDarkMode ? '2px solid rgba(255,255,255,0.15)' : '2px solid #e2e8f0',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                              '&:hover': {
                                borderColor: isDarkMode ? 'rgba(255,255,255,0.25)' : '#cbd5e1',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                              },
                              '&.Mui-focused': {
                                borderColor: '#1e40af',
                                boxShadow: '0 4px 16px rgba(30, 64, 175, 0.2)'
                              },
                              '& fieldset': { border: 'none' },
                              '& input': {
                                py: 0.75,
                                color: isDarkMode ? '#f1f5f9' : 'inherit'
                              }
                            }
                          }}
                        />

                        {/* Desktop Refresh (visible md+) */}
                        <Button
                          variant="outlined"
                          onClick={() => loadMasterData({ buttonRefresh: true })}
                          disabled={refreshing}
                          startIcon={refreshing ? <CircularProgress size={14} /> : refreshSuccess ? <CheckCircle sx={{ color: '#10b981' }} /> : <RefreshIcon sx={{ fontSize: '0.95rem' }} />}
                          sx={{
                            display: { xs: 'none', md: 'inline-flex' },
                            minWidth: 110,
                            height: 38,
                            borderWidth: 2,
                            borderColor: '#3b82f6',
                            color: '#3b82f6',
                            fontWeight: 700,
                            '&:hover': { bgcolor: 'rgba(59,130,246,0.08)' }
                          }}
                        >
                          {refreshing ? '...' : refreshSuccess ? '✓' : 'Refresh'}
                        </Button>

                        {/* Mobile Actions button */}
                        <Button
                          variant="contained"
                          color="primary"
                          startIcon={<TuneIcon />}
                          sx={{
                            display: { xs: 'inline-flex', md: 'none' },
                            height: 40,
                            px: 2,
                            textTransform: 'none',
                            flexShrink: 0,
                            fontSize: '0.85rem',
                            fontWeight: 600
                          }}
                          onClick={() => setMobileActionsOpen(true)}
                        >
                          Actions
                        </Button>



                        {/* Show Filters Toggle Button - Desktop */}
                        <Button
                          variant="outlined"
                          onClick={() => setFiltersExpanded(!filtersExpanded)}
                          sx={{
                            display: { xs: 'none', md: 'inline-flex' },
                            minWidth: 130,
                            height: 38,
                            borderWidth: 2,
                            borderColor: filtersExpanded ? '#1e40af' : (isDarkMode ? 'rgba(255,255,255,0.2)' : '#cbd5e1'),
                            bgcolor: filtersExpanded ? 'rgba(30, 64, 175, 0.1)' : (isDarkMode ? '#0f172a' : 'white'),
                            color: filtersExpanded ? '#1e40af' : (isDarkMode ? '#94a3b8' : '#64748b'),
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            borderRadius: 1.5,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                            transition: 'all 0.2s',
                            px: 1.5,
                            '&:hover': {
                              borderWidth: 2,
                              borderColor: '#1e40af',
                              bgcolor: 'rgba(30, 64, 175, 0.15)',
                              boxShadow: '0 4px 12px rgba(30, 64, 175, 0.2)'
                            },
                            position: 'relative'
                          }}
                        >
                          <FilterListIcon sx={{ fontSize: '1.15rem', mr: 0.5 }} />
                          <Box component="span" sx={{ mr: 0.5 }}>
                            {filtersExpanded ? "Hide Filters" : "Show Filters"}
                          </Box>
                          {(filterBatchId || filterBrand || filterCategory) && (
                            <Box sx={{
                              position: 'absolute',
                              top: -5,
                              right: -5,
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              bgcolor: '#10b981',
                              border: '2px solid white'
                            }} />
                          )}
                          <ExpandMoreIcon sx={{ transform: filtersExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }} />
                        </Button>
                      </Stack>

                      {/* Collapsible Filter Card */}
                      <Collapse in={filtersExpanded} timeout="auto">
                        <Card sx={{
                          borderRadius: 1.5,
                          boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.15)',
                          background: isDarkMode ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                          border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                          position: 'relative',
                          zIndex: 95
                        }}>
                          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Stack spacing={1.5}>
                              {/* ROW 1: All Filters in one row */}
                              <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)', md: 'repeat(4, 1fr)' },
                                gap: 1
                              }}>
                                {/* Batch ID Filter */}
                                <FormControl size="small">
                                  <InputLabel sx={{ fontSize: '0.75rem' }}>Batch ID</InputLabel>
                                  <Select
                                    value={filterBatchId}
                                    label="Batch ID"
                                    onChange={(e) => { setFilterBatchId(e.target.value); setPage(0); }}
                                    sx={{
                                      height: 36,
                                      fontSize: '0.8rem',
                                      bgcolor: isDarkMode ? '#1e293b' : 'white',
                                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' },
                                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' }
                                    }}
                                  >
                                    <MenuItem value="">All Batches</MenuItem>
                                    {batches.map(b => (
                                      <MenuItem key={b.batch_id} value={b.batch_id} sx={{ fontSize: '0.8rem' }}>{b.batch_id} ({formatNumber(b.count)})</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>

                                {/* Status Filter */}
                                <FormControl size="small">
                                  <InputLabel sx={{ fontSize: '0.75rem' }}>Status</InputLabel>
                                  <Select
                                    value={filterStatus}
                                    label="Status"
                                    onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
                                    sx={{
                                      height: 36,
                                      fontSize: '0.8rem',
                                      bgcolor: isDarkMode ? '#1e293b' : 'white',
                                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' },
                                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' }
                                    }}
                                  >
                                    <MenuItem value="All" sx={{ fontSize: '0.8rem' }}>All</MenuItem>
                                    <MenuItem value="Received" sx={{ fontSize: '0.8rem' }}>✅ Received</MenuItem>
                                    <MenuItem value="Receiving" sx={{ fontSize: '0.8rem' }}>🔄 Receiving</MenuItem>
                                    <MenuItem value="Pending" sx={{ fontSize: '0.8rem' }}>❌ Pending</MenuItem>
                                  </Select>
                                </FormControl>

                                {/* Brand Filter */}
                                <FormControl size="small">
                                  <InputLabel sx={{ fontSize: '0.75rem' }}>Brand</InputLabel>
                                  <Select
                                    value={filterBrand}
                                    label="Brand"
                                    onChange={(e) => { setFilterBrand(e.target.value); setPage(0); }}
                                    sx={{
                                      height: 36,
                                      fontSize: '0.8rem',
                                      bgcolor: isDarkMode ? '#1e293b' : 'white',
                                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' },
                                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' }
                                    }}
                                  >
                                    <MenuItem value="">All Brands</MenuItem>
                                    {brandOptions.map(brand => (
                                      <MenuItem key={brand} value={brand} sx={{ fontSize: '0.8rem' }}>{brand}</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>

                                {/* Category Filter */}
                                <FormControl size="small">
                                  <InputLabel sx={{ fontSize: '0.75rem' }}>Category</InputLabel>
                                  <Select
                                    value={filterCategory}
                                    label="Category"
                                    onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }}
                                    sx={{
                                      height: 36,
                                      fontSize: '0.8rem',
                                      bgcolor: isDarkMode ? '#1e293b' : 'white',
                                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' },
                                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1e40af' }
                                    }}
                                  >
                                    <MenuItem value="">All Categories</MenuItem>
                                    {categoryOptions.map(category => (
                                      <MenuItem key={category} value={category} sx={{ fontSize: '0.8rem' }}>{category}</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Box>

                              {/* ROW 2: All Action Buttons in one row */}
                              <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)', md: 'repeat(8, 1fr)' },
                                gap: 1
                              }}>

                                {/* Add Button - Permission controlled */}
                                {canSeeButton('add') && (
                                  <Tooltip title={!canAccessButton('add') ? "You don't have permission to use this feature" : "Add Product"} arrow>
                                    <span style={{ width: '100%' }}>
                                      <Button
                                        fullWidth
                                        size="small"
                                        startIcon={<AddIcon sx={{ fontSize: '0.9rem' }} />}
                                        variant="contained"
                                        disabled={!canAccessButton('add')}
                                        onClick={() => canAccessButton('add') && handleOpenAddDialog()}
                                        sx={{
                                          height: 34,
                                          fontSize: '0.72rem',
                                          fontWeight: 700,
                                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                          '&:hover': {
                                            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                            boxShadow: '0 6px 16px rgba(16, 185, 129, 0.4)'
                                          }
                                        }}
                                      >
                                        + ADD
                                      </Button>
                                    </span>
                                  </Tooltip>
                                )}

                                {/* Upload Button */}
                                {canSeeButton('upload') && (
                                  <Tooltip title={!canAccessButton('upload') ? "You don't have permission to use this feature" : "Upload Products"} arrow>
                                    <span style={{ width: '100%' }}>
                                      <Button
                                        fullWidth
                                        size="small"
                                        startIcon={<UploadIcon sx={{ fontSize: '0.9rem' }} />}
                                        variant="contained"
                                        disabled={!canAccessButton('upload')}
                                        onClick={() => canAccessButton('upload') && setUploadDialogOpen(true)}
                                        sx={{
                                          height: 34,
                                          fontSize: '0.72rem',
                                          fontWeight: 700,
                                          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                                          boxShadow: '0 4px 12px rgba(30, 64, 175, 0.3)',
                                          '&:hover': {
                                            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                                            boxShadow: '0 6px 16px rgba(30, 64, 175, 0.4)'
                                          }
                                        }}
                                      >
                                        UPLOAD
                                      </Button>
                                    </span>
                                  </Tooltip>
                                )}

                                {/* Export Button */}
                                {canSeeButton('export') && (
                                  <Tooltip title={!canAccessButton('export') ? "You don't have permission to use this feature" : "Export Data"} arrow>
                                    <span style={{ width: '100%' }}>
                                      <Button
                                        fullWidth
                                        size="small"
                                        startIcon={<ExportIcon sx={{ fontSize: '0.9rem' }} />}
                                        variant="contained"
                                        disabled={!canAccessButton('export')}
                                        onClick={() => canAccessButton('export') && setExportDialogOpen(true)}
                                        sx={{
                                          height: 34,
                                          fontSize: '0.72rem',
                                          fontWeight: 700,
                                          background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                                          boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                                          '&:hover': {
                                            background: 'linear-gradient(135deg, #6d28d9 0%, #9333ea 100%)',
                                            boxShadow: '0 6px 16px rgba(124, 58, 237, 0.4)'
                                          }
                                        }}
                                      >
                                        EXPORT
                                      </Button>
                                    </span>
                                  </Tooltip>
                                )}

                                {/* Template Button */}
                                <Button
                                  fullWidth
                                  size="small"
                                  startIcon={<DownloadIcon sx={{ fontSize: '0.9rem' }} />}
                                  variant="outlined"
                                  onClick={handleDownloadTemplate}
                                  sx={{
                                    height: 34,
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    borderWidth: 2,
                                    borderColor: isDarkMode ? '#64748b' : '#94a3b8',
                                    color: isDarkMode ? '#94a3b8' : '#475569',
                                    '&:hover': {
                                      borderWidth: 2,
                                      bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc'
                                    }
                                  }}
                                >
                                  TEMPLATE
                                </Button>

                                {/* Columns Button */}
                                {canSeeButton('columns') && (
                                  <Tooltip title={!canAccessButton('columns') ? "You don't have permission to use this feature" : "Manage Columns"} arrow>
                                    <span style={{ width: '100%' }}>
                                      <Button
                                        fullWidth
                                        size="small"
                                        startIcon={<VisibilityIcon sx={{ fontSize: '0.9rem' }} />}
                                        variant="outlined"
                                        disabled={!canAccessButton('columns')}
                                        onClick={(e) => canAccessButton('columns') && setColumnMenuAnchor(e.currentTarget)}
                                        sx={{
                                          height: 34,
                                          fontSize: '0.72rem',
                                          fontWeight: 700,
                                          borderWidth: 2,
                                          borderColor: '#1e40af',
                                          color: '#1e40af',
                                          '&:hover': {
                                            borderWidth: 2,
                                            bgcolor: 'rgba(30, 64, 175, 0.1)'
                                          }
                                        }}
                                      >
                                        COLUMNS
                                      </Button>
                                    </span>
                                  </Tooltip>
                                )}

                                {/* Grid Button */}
                                <Button
                                  fullWidth
                                  size="small"
                                  startIcon={<TuneIcon sx={{ fontSize: '0.9rem' }} />}
                                  variant="outlined"
                                  onClick={() => setGridSettingsOpen(true)}
                                  sx={{
                                    height: 34,
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    borderWidth: 2,
                                    borderColor: isDarkMode ? '#64748b' : '#94a3b8',
                                    color: isDarkMode ? '#94a3b8' : '#475569',
                                    '&:hover': {
                                      borderWidth: 2,
                                      bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc'
                                    }
                                  }}
                                >
                                  GRID
                                </Button>


                                {/* Refresh Button */}
                                <Button
                                  fullWidth
                                  size="small"
                                  startIcon={refreshing ? <CircularProgress size={14} /> : refreshSuccess ? <CheckCircle sx={{ color: '#10b981' }} /> : <RefreshIcon sx={{ fontSize: '0.9rem' }} />}
                                  variant="outlined"
                                  onClick={() => loadMasterData({ buttonRefresh: true })}
                                  disabled={refreshing}
                                  sx={{
                                    display: { xs: 'block', md: 'none' },
                                    height: 34,
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    borderWidth: 2,
                                    borderColor: '#3b82f6',
                                    color: '#3b82f6',
                                    '&:hover': {
                                      borderWidth: 2,
                                      bgcolor: 'rgba(59, 130, 246, 0.1)'
                                    }
                                  }}
                                >
                                  {refreshing ? '...' : refreshSuccess ? '✓' : 'REFRESH'}
                                </Button>

                                {/* Reset Button */}
                                <Button
                                  fullWidth
                                  size="small"
                                  variant="outlined"
                                  onClick={resetFilters}
                                  sx={{
                                    height: 34,
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    borderWidth: 2,
                                    borderColor: isDarkMode ? '#64748b' : '#94a3b8',
                                    color: isDarkMode ? '#94a3b8' : '#64748b',
                                    '&:hover': {
                                      borderWidth: 2,
                                      borderColor: isDarkMode ? '#94a3b8' : '#64748b',
                                      bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc'
                                    }
                                  }}
                                >
                                  🔄 RESET
                                </Button>

                              </Box>
                            </Stack>
                          </CardContent>
                        </Card>
                      </Collapse>
                    </Box>

                    {/* AG Grid Table */}
                    <Box sx={{
                      flex: 1,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      borderLeft: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e0e0e0',
                      borderRight: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e0e0e0',
                      position: 'relative',
                      bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
                    }}>

                      {/* Loading Spinner Overlay - semi-transparent so data stays visible */}
                      {loading && masterData && masterData.length > 0 && (
                        <Box sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.5)',
                          zIndex: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 1.5,
                            p: 3,
                            bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                            borderRadius: 2,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                          }}>
                            <CircularProgress
                              size={40}
                              thickness={4}
                              sx={{ color: '#1e40af' }}
                            />
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                              Loading...
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {/* Full Loading Overlay - ONLY for initial load when no data exists */}
                      {loading && (!masterData || masterData.length === 0) && (
                        <Box sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                          backdropFilter: 'blur(3px)',
                          zIndex: 10,
                        }}>
                          <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 3,
                            p: 4,
                            bgcolor: isDarkMode ? '#1e293b' : 'white',
                            borderRadius: 3,
                            boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)'
                          }}>
                            <Box sx={{ position: 'relative' }}>
                              <CircularProgress
                                size={56}
                                thickness={3.5}
                                sx={{
                                  color: '#1e40af',
                                  filter: 'drop-shadow(0 2px 8px rgba(25, 118, 210, 0.2))'
                                }}
                              />
                              <Box sx={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #1e40af 0%, #60a5fa 100%)',
                                opacity: 0.15,
                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                                '@keyframes pulse': {
                                  '0%, 100%': {
                                    transform: 'translate(-50%, -50%) scale(1)',
                                    opacity: 0.15
                                  },
                                  '50%': {
                                    transform: 'translate(-50%, -50%) scale(1.15)',
                                    opacity: 0.05
                                  }
                                }
                              }} />
                            </Box>
                            <Typography
                              sx={{
                                fontSize: '0.95rem',
                                fontWeight: 500,
                                color: isDarkMode ? '#94a3b8' : '#546e7a',
                                letterSpacing: 0.3,
                                textAlign: 'center'
                              }}
                            >
                              Loading data...
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {/* Empty State Overlay */}
                      {!loading && (!masterData || masterData.length === 0) && (
                        <Box sx={{
                          position: 'absolute',
                          top: 60,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                          zIndex: 5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Box sx={{
                            textAlign: 'center',
                            p: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2
                          }}>
                            <Box sx={{
                              fontSize: '4rem',
                              opacity: 0.3,
                              mb: 1
                            }}>
                              📭
                            </Box>
                            <Typography variant="h5" sx={{ fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#6b7280', mb: 0.5 }}>
                              No Data Found
                            </Typography>
                            <Typography variant="body2" sx={{ color: isDarkMode ? '#64748b' : '#9ca3af', maxWidth: 400 }}>
                              No master data items match your current filters. Try adjusting your search criteria or reset filters to see all items.
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      <Box sx={{
                        flex: 1,
                        overflow: 'hidden',
                        px: 1,
                        pb: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
                        border: isDarkMode ? '1px solid #475569' : '1px solid #d1d5db',
                        borderRadius: '4px',
                        '& .ag-root-wrapper': {
                          height: '100%',
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                          border: 'none',
                        },
                        '& .ag-header': {
                          backgroundColor: isDarkMode ? '#334155' : '#f1f5f9',
                          borderBottom: isDarkMode ? '2px solid #475569' : '2px solid #d1d5db',
                          opacity: '1 !important',
                          zIndex: 15,
                          position: 'relative'
                        },
                        '& .ag-header-cell': {
                          backgroundColor: isDarkMode ? '#334155' : '#f1f5f9',
                          color: isDarkMode ? '#f1f5f9' : '#1e293b',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                          borderRight: isDarkMode ? '1px solid #475569' : '1px solid #d1d5db',
                          opacity: '1 !important'
                        },
                        '& .ag-header-cell:last-child': {
                          borderRight: 'none',
                        },
                        '& .ag-body-viewport': {
                          opacity: loading ? 0.3 : 1,
                          transition: 'opacity 0.2s ease-in-out',
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        },
                        '& .ag-row': {
                          height: 36,
                          borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e5e7eb',
                        },
                        '& .ag-row-even': { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' },
                        '& .ag-row-odd': { backgroundColor: isDarkMode ? '#1a2536' : '#f8fafc' },
                        '& .ag-cell': {
                          borderRight: isDarkMode ? '1px solid #334155' : '1px solid #e5e7eb',
                          color: isDarkMode ? '#f1f5f9' : '#1e293b',
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .ag-cell:last-child': {
                          borderRight: 'none',
                        },
                        '& .ag-cell-focus': {
                          border: isDarkMode ? '2px solid #38bdf8 !important' : '2px solid #2563eb !important',
                          outline: 'none',
                        },
                        '& .ag-cell-range-selected': {
                          backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.25) !important' : '#dbeafe !important',
                        },
                        '& .ag-row-hover': { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15) !important' : '#eff6ff !important' },
                        '& .ag-overlay-loading-wrapper': {
                          backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        },
                        '& .ag-overlay-no-rows-wrapper': {
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        },
                      }}>
                        <div className="ag-theme-quartz" style={{ height: '100%', width: '100%' }}>
                          <AgGridReact
                            ref={gridRef}
                            rowData={masterData}
                            columnDefs={columnDefs}
                            defaultColDef={defaultColDef}
                            rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
                            loading={false}
                            suppressNoRowsOverlay={true}
                            context={{
                              onEdit: handleOpenEditDialog,
                              onDelete: handleOpenDeleteConfirm,
                              canSeeButton,
                              canAccessButton,
                              isAdmin
                            }}
                            getRowId={(params: any) => String(params.data?.id || params.data?.wsn || params.rowIndex)}
                            onGridReady={(params: any) => {
                              gridRef.current = params.api;
                              columnApiRef.current = params.columnApi;

                              // Load saved column state from localStorage
                              try {
                                const savedState = localStorage.getItem('masterdata_grid_state');
                                if (savedState && params.api) {
                                  // Apply saved column state (user's custom widths)
                                  params.api.applyColumnState({
                                    state: JSON.parse(savedState),
                                    applyOrder: true,
                                  });
                                  hasAutoFittedRef.current = true; // Mark as fitted
                                  console.log('Column state restored from localStorage');
                                }
                              } catch (err) {
                                console.error('Failed to restore column state:', err);
                              }
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
                              // Save column state when resized to localStorage
                              if (params.finished && params.api) {
                                try {
                                  const columnState = params.api.getColumnState();
                                  localStorage.setItem('masterdata_grid_state', JSON.stringify(columnState));
                                } catch (err) {
                                  console.error('Failed to save column state:', err);
                                }
                              }
                            }}
                            onColumnMoved={(params: any) => {
                              // Save column state when moved to localStorage
                              if (params.finished && params.api) {
                                try {
                                  const columnState = params.api.getColumnState();
                                  localStorage.setItem('masterdata_grid_state', JSON.stringify(columnState));
                                } catch (err) {
                                  console.error('Failed to save column state:', err);
                                }
                              }
                            }}
                            onColumnVisible={(params: any) => {
                              // Save column state when visibility changes to localStorage
                              if (params.api) {
                                try {
                                  const columnState = params.api.getColumnState();
                                  localStorage.setItem('masterdata_grid_state', JSON.stringify(columnState));
                                } catch (err) {
                                  console.error('Failed to save column visibility state:', err);
                                }
                              }
                            }}
                            animateRows={false}
                            rowBuffer={20}
                            valueCache={true}
                            debounceVerticalScrollbar={true}
                            suppressScrollOnNewData={true}
                            maintainColumnOrder={true}
                            rowHeight={36}
                            headerHeight={isMobile ? 40 : 48}
                            pagination={false}
                            suppressPaginationPanel={true}
                            domLayout="normal"
                          />
                        </div>
                      </Box>

                      {/* ================= PAGINATION (DASHBOARD STYLE - FULLY RESPONSIVE) ================= */}
                      <Fade in={true} timeout={300}>
                        <Box
                          sx={{
                            px: { xs: 1, sm: 2 },
                            py: { xs: 0.75, sm: 0.5 },
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderTop: isDarkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid #ddd",
                            bgcolor: isDarkMode ? '#1e293b' : "white",
                            flexShrink: 0,
                            minHeight: { xs: 44, sm: 52 },
                            gap: { xs: 0.5, sm: 1 },
                            flexWrap: 'wrap',
                          }}
                        >
                          {/* Left Section: Per Page + Last Refresh */}
                          <Stack direction="row" spacing={{ xs: 0.5, sm: 1.5 }} alignItems="center">
                            <Typography sx={{ fontSize: { xs: "0.7rem", sm: "0.78rem" }, whiteSpace: "nowrap", color: isDarkMode ? '#94a3b8' : 'inherit' }}>
                              Per page:
                            </Typography>

                            <Select
                              size="small"
                              value={rowsPerPage}
                              onChange={(e) => {
                                const value = Math.min(Number(e.target.value), 1000);
                                setRowsPerPage(value);
                                setPage(0);
                              }}
                              sx={{
                                minWidth: { xs: 58, sm: 70 },
                                '& .MuiSelect-select': {
                                  py: { xs: 0.5, sm: 0.75 },
                                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                }
                              }}
                            >
                              <MenuItem value={100}>100</MenuItem>
                              <MenuItem value={500}>500</MenuItem>
                              <MenuItem value={1000}>1000</MenuItem>
                            </Select>

                            {/* Last Refresh Time Indicator */}
                            {lastRefreshTime && !isMobile && (
                              <Tooltip title={`Last updated: ${lastRefreshTime.toLocaleTimeString()}`}>
                                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 1 }}>
                                  <AccessTime sx={{ fontSize: 14, color: isDarkMode ? '#64748b' : '#94a3b8' }} />
                                  <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                                    {(() => {
                                      const seconds = Math.floor((new Date().getTime() - lastRefreshTime.getTime()) / 1000);
                                      if (seconds < 10) return 'just now';
                                      if (seconds < 60) return `${seconds}s ago`;
                                      const minutes = Math.floor(seconds / 60);
                                      if (minutes < 60) return `${minutes}m ago`;
                                      return `${Math.floor(minutes / 60)}h ago`;
                                    })()}
                                  </Typography>
                                </Stack>
                              </Tooltip>
                            )}
                          </Stack>

                          {/* Center Section: Count */}
                          <Typography
                            sx={{
                              fontSize: { xs: "0.7rem", sm: "0.78rem" },
                              whiteSpace: "nowrap",
                              color: isDarkMode ? '#94a3b8' : 'inherit',
                            }}
                          >
                            {formatNumber(page * rowsPerPage + 1)}–{formatNumber(Math.min((page + 1) * rowsPerPage, totalRecords))} of {formatNumber(totalRecords)}
                          </Typography>

                          {/* Right Section: Pagination Controls */}
                          {isMobile ? (
                            // MOBILE COMPACT PAGINATION
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <IconButton
                                size="small"
                                disabled={page === 0}
                                onClick={() => setPage(0)}
                                sx={{ p: 0.5 }}
                              >
                                <FirstPage fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                disabled={page === 0}
                                onClick={() => setPage(page - 1)}
                                sx={{ p: 0.5 }}
                              >
                                <KeyboardArrowLeft fontSize="small" />
                              </IconButton>

                              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, minWidth: 50, textAlign: 'center' }}>
                                {page + 1} / {Math.ceil(totalRecords / rowsPerPage) || 1}
                              </Typography>

                              <IconButton
                                size="small"
                                disabled={page >= Math.ceil(totalRecords / rowsPerPage) - 1}
                                onClick={() => setPage(page + 1)}
                                sx={{ p: 0.5 }}
                              >
                                <KeyboardArrowRight fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                disabled={page >= Math.ceil(totalRecords / rowsPerPage) - 1}
                                onClick={() => setPage(Math.ceil(totalRecords / rowsPerPage) - 1)}
                                sx={{ p: 0.5 }}
                              >
                                <LastPage fontSize="small" />
                              </IconButton>
                            </Stack>
                          ) : (
                            // DESKTOP: Enhanced pagination with MUI Pagination component
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Tooltip title="First page">
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={page === 0}
                                    onClick={() => setPage(0)}
                                  >
                                    <FirstPage fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>

                              <Tooltip title="Previous page">
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={page === 0}
                                    onClick={() => setPage(page - 1)}
                                  >
                                    <KeyboardArrowLeft />
                                  </IconButton>
                                </span>
                              </Tooltip>

                              <Pagination
                                page={page + 1}
                                count={Math.ceil(totalRecords / rowsPerPage) || 1}
                                size="small"
                                onChange={(_, v) => setPage(v - 1)}
                                siblingCount={1}
                                boundaryCount={1}
                                sx={{
                                  '& .MuiPaginationItem-root': {
                                    color: isDarkMode ? '#94a3b8' : 'inherit',
                                  },
                                  '& .Mui-selected': {
                                    bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.3) !important' : 'rgba(25, 118, 210, 0.12) !important',
                                  }
                                }}
                              />

                              <Tooltip title="Next page">
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={page >= Math.ceil(totalRecords / rowsPerPage) - 1}
                                    onClick={() => setPage(page + 1)}
                                  >
                                    <KeyboardArrowRight />
                                  </IconButton>
                                </span>
                              </Tooltip>

                              <Tooltip title="Last page">
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={page >= Math.ceil(totalRecords / rowsPerPage) - 1}
                                    onClick={() => setPage(Math.ceil(totalRecords / rowsPerPage) - 1)}
                                  >
                                    <LastPage fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          )}
                        </Box>
                      </Fade>
                    </Box>
                  </Box >
                )}

                {/* Tab 2: Batch Management */}
                {actualTabIndex === 1 && (
                  <BatchManagementTab
                    batches={batches}
                    loading={loading}
                    onRefresh={loadBatches}
                    onDelete={canSeeButton('batches:delete') ? handleDeleteBatch : undefined}
                    canDelete={canSeeButton('batches:delete')}
                    title="Batch Management"
                    emptyMessage="No batches available"
                    emptySubMessage="Batches will appear here after master data uploads"
                  />
                )}
              </>
            );
          })()}
        </Box>

        {/* COLUMNS DIALOG */}
        <Dialog
          open={columnMenuAnchor !== null}
          onClose={() => setColumnMenuAnchor(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Select Visible Columns</DialogTitle>
          <DialogContent>
            <Stack spacing={1} sx={{ mt: 2 }}>
              {columns.map((col) => (
                <FormControlLabel
                  key={col.id}
                  control={
                    <Checkbox
                      checked={columnVisibility[col.id as keyof typeof columnVisibility]}
                      onChange={() => toggleColumn(col.id)}
                    />
                  }
                  label={col.label}
                />
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setColumnMenuAnchor(null)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* GRID SETTINGS DIALOG */}
        <Dialog
          open={gridSettingsOpen}
          onClose={() => setGridSettingsOpen(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } }}
        >
          <DialogTitle sx={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
            fontWeight: 800,
            fontSize: '1.1rem',
            py: 1.5
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon />
              Grid Settings
            </Box>
          </DialogTitle>

          <DialogContent sx={{ mt: 2, pb: 1 }}>
            <Stack spacing={2.5}>
              <Paper sx={{ p: 1.5, bgcolor: '#e0f2fe', borderLeft: '4px solid #0ea5e9' }}>
                <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#0369a1' }}>
                  💾 Settings auto-save and persist after reload
                </Typography>
              </Paper>

              {/* SORTABLE */}
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={enableSorting}
                      onChange={(e) => setEnableSorting(e.target.checked)}
                      sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                        ⬆️ Enable Sorting
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                        Click column headers to sort ascending/descending
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              <Divider sx={{ my: 0.5 }} />

              {/* FILTER */}
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={enableColumnFilters}
                      onChange={(e) => setEnableColumnFilters(e.target.checked)}
                      sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                        🔍 Enable Column Filters
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                        Filter menu icon in column headers
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              <Divider sx={{ my: 0.5 }} />

              {/* RESIZABLE */}
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={enableColumnResize}
                      onChange={(e) => setEnableColumnResize(e.target.checked)}
                      sx={{ '&.Mui-checked': { color: '#f59e0b' } }}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                        ↔️ Enable Column Resize
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                        Drag column borders to adjust width
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              <Divider sx={{ my: 0.5 }} />

              {/* RESET COLUMN WIDTHS */}
              <Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    // Clear saved column state and auto-fit
                    try {
                      localStorage.removeItem('masterdata_grid_state');
                      hasAutoFittedRef.current = false;
                      if (gridRef.current) {
                        // Auto-size all columns except actions
                        const allColIds = gridRef.current.getColumns()
                          ?.filter((col: any) => col.getColId() !== 'actions')
                          .map((col: any) => col.getColId()) || [];

                        if (allColIds.length > 0) {
                          gridRef.current.autoSizeColumns(allColIds);
                        }
                      }
                      toast.success('Column widths reset to auto-fit');
                    } catch (err) {
                      console.error('Failed to reset column widths:', err);
                    }
                  }}
                  sx={{
                    width: '100%',
                    py: 1,
                    fontWeight: 600,
                    color: '#0ea5e9',
                    borderColor: '#0ea5e9',
                    '&:hover': { bgcolor: '#e0f2fe', borderColor: '#0284c7' }
                  }}
                >
                  📐 Reset Column Widths (Auto-fit)
                </Button>
                <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                  Clears saved column widths and auto-fits to content
                </Typography>
              </Box>

            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 2, background: '#fef3c7', gap: 1 }}>
            <Button
              onClick={() => {
                setEnableSorting(true);
                setEnableColumnFilters(true);
                setEnableColumnResize(true);
                toast.success('Settings reset to default');
              }}
              sx={{
                fontWeight: 700,
                color: '#78716c',
                '&:hover': { bgcolor: 'rgba(120, 113, 108, 0.1)' }
              }}
            >
              🔄 Reset All
            </Button>
            <Button
              onClick={() => setGridSettingsOpen(false)}
              variant="contained"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                }
              }}
            >
              ✓ Done
            </Button>
          </DialogActions>
        </Dialog>

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
          <DialogTitle fontWeight="bold" sx={{ borderBottom: '2px solid #1e40af', pb: 1.5 }}>
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
                        bgcolor: isDarkMode ? '#334155' : 'white',
                        '&:hover': { bgcolor: isDarkMode ? '#475569' : '#ffebee', color: 'error.main' }
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
                background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #63408b 100%)',
                }
              }}
            >
              {loading ? 'Uploading...' : 'Upload & Process'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Mobile Actions Dialog */}
        <Dialog fullScreen open={mobileActionsOpen} onClose={() => setMobileActionsOpen(false)} TransitionProps={{}}>
          <AppBar position="sticky" elevation={1} sx={{ bgcolor: isDarkMode ? '#1e293b' : 'background.paper', color: isDarkMode ? '#f1f5f9' : 'text.primary', borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e0e0e0' }}>
            <Toolbar>
              <IconButton edge="start" color="inherit" onClick={() => setMobileActionsOpen(false)} aria-label="close">
                <CancelIcon />
              </IconButton>
              <Typography sx={{ ml: 2, flex: 1, fontWeight: 700 }}>Filters & Actions</Typography>
              <Button color="primary" onClick={() => setMobileActionsOpen(false)}>Close</Button>
            </Toolbar>
          </AppBar>

          <DialogContent sx={{ p: 2, bgcolor: isDarkMode ? '#0f172a' : 'background.default' }}>
            <Stack spacing={2}>
              {/* Filters */}
              <Box>
                <FormControl fullWidth size="small">
                  <InputLabel>Batch ID</InputLabel>
                  <Select
                    value={filterBatchId}
                    label="Batch ID"
                    onChange={(e) => { setFilterBatchId(e.target.value); setPage(0); }}
                  >
                    <MenuItem value="">All</MenuItem>
                    {batches.map(b => (
                      <MenuItem key={b.batch_id} value={b.batch_id}>{b.batch_id} ({formatNumber(b.count)})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filterStatus}
                    label="Status"
                    onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
                  >
                    <MenuItem value="All">All</MenuItem>
                    <MenuItem value="Received">✅ Received</MenuItem>
                    <MenuItem value="Receiving">🔄 Receiving</MenuItem>
                    <MenuItem value="Pending">❌ Pending</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <FormControl fullWidth size="small">
                  <InputLabel>Brand</InputLabel>
                  <Select
                    value={filterBrand}
                    label="Brand"
                    onChange={(e) => { setFilterBrand(e.target.value); setPage(0); }}
                  >
                    <MenuItem value="">All</MenuItem>
                    {brandOptions.map(brand => (
                      <MenuItem key={brand} value={brand}>{brand}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filterCategory}
                    label="Category"
                    onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }}
                  >
                    <MenuItem value="">All</MenuItem>
                    {categoryOptions.map(category => (
                      <MenuItem key={category} value={category}>{category}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* Action buttons */}
              <Box sx={{ display: 'grid', gap: 1, mt: 2, gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {canSeeButton('add') && (
                  <Tooltip title={!canAccessButton('add') ? "You don't have permission to use this feature" : ""} arrow>
                    <span style={{ width: '100%' }}>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        disabled={!canAccessButton('add')}
                        onClick={() => { if (canAccessButton('add')) { handleOpenAddDialog(); setMobileActionsOpen(false); } }}
                        fullWidth
                        sx={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          '&:hover': { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }
                        }}
                      >
                        Add Product
                      </Button>
                    </span>
                  </Tooltip>
                )}
                {canSeeButton('upload') && (
                  <Tooltip title={!canAccessButton('upload') ? "You don't have permission to use this feature" : ""} arrow>
                    <span style={{ width: '100%' }}>
                      <Button
                        variant="outlined"
                        startIcon={<UploadIcon />}
                        disabled={!canAccessButton('upload')}
                        onClick={() => { if (canAccessButton('upload')) { setUploadDialogOpen(true); setMobileActionsOpen(false); } }}
                        fullWidth
                      >
                        Upload
                      </Button>
                    </span>
                  </Tooltip>
                )}
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadTemplate}
                  fullWidth
                >
                  Template
                </Button>
                {canSeeButton('export') && (
                  <Tooltip title={!canAccessButton('export') ? "You don't have permission to use this feature" : ""} arrow>
                    <span style={{ width: '100%' }}>
                      <Button
                        variant="outlined"
                        startIcon={<ExportIcon />}
                        disabled={!canAccessButton('export')}
                        onClick={() => { if (canAccessButton('export')) { setExportDialogOpen(true); setMobileActionsOpen(false); } }}
                        fullWidth
                      >
                        Export
                      </Button>
                    </span>
                  </Tooltip>
                )}
                {canSeeButton('columns') && (
                  <Tooltip title={!canAccessButton('columns') ? "You don't have permission to use this feature" : ""} arrow>
                    <span style={{ width: '100%' }}>
                      <Button
                        variant="outlined"
                        startIcon={<VisibilityIcon />}
                        disabled={!canAccessButton('columns')}
                        onClick={() => { if (canAccessButton('columns')) { setColumnMenuAnchor(document.body); setMobileActionsOpen(false); } }}
                        fullWidth
                      >
                        Columns
                      </Button>
                    </span>
                  </Tooltip>
                )}
                <Button
                  variant="outlined"
                  startIcon={<TuneIcon />}
                  onClick={() => { setGridSettingsOpen(true); setMobileActionsOpen(false); }}
                  fullWidth
                >
                  Grid
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={resetFilters}
                  fullWidth
                  color="error"
                >
                  Reset
                </Button>
              </Box>
            </Stack>
          </DialogContent>

          <Box sx={{ position: 'sticky', bottom: 0, left: 0, right: 0, bgcolor: isDarkMode ? '#1e293b' : 'background.paper', p: 1, borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e0e0e0', display: 'flex', gap: 1 }}>
            <Button fullWidth variant="outlined" onClick={() => { setFilterBatchId(''); setFilterStatus('All'); setFilterBrand(''); setFilterCategory(''); setSearchQuery(''); setPage(0); }}>Reset All</Button>
            <Button fullWidth variant="contained" onClick={() => { setPage(0); setMobileActionsOpen(false); }}>Apply</Button>
          </Box>
        </Dialog>

        {/* Export Dialog */}
        <Dialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              overflow: 'hidden'
            }
          }}
        >
          <DialogTitle sx={{
            fontWeight: 800,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            py: 3,
            px: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}>
            <DownloadIcon sx={{ fontSize: '1.5rem' }} />
            Advanced Export Options
            <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.8, fontSize: '0.7rem' }}>
              Filter & Download
            </Typography>
          </DialogTitle>

          <DialogContent sx={{ py: 4, px: 3 }}>
            <Stack spacing={3}>
              {/* CURRENT FILTERS PREVIEW */}
              <Paper sx={{
                p: 2,
                bgcolor: '#e0f2fe',
                border: '1px solid #0ea5e9',
                borderRadius: 2
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#0369a1' }}>
                  📋 Applied Filters Preview:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {debouncedSearch && (
                    <Chip size="small" label={`🔍 "${debouncedSearch}"`} sx={{ bgcolor: '#dbeafe', color: '#1e40af' }} />
                  )}
                  {filterBrand && (
                    <Chip size="small" label={`🏷️ ${filterBrand}`} sx={{ bgcolor: '#dcfce7', color: '#166534' }} />
                  )}
                  {filterCategory && (
                    <Chip size="small" label={`📂 ${filterCategory}`} sx={{ bgcolor: '#fef3c7', color: '#92400e' }} />
                  )}
                  {filterBatchId && (
                    <Chip size="small" label={`📦 Batch: ${filterBatchId}`} sx={{ bgcolor: '#f3e8ff', color: '#6b21a8' }} />
                  )}
                  {filterStatus && filterStatus !== 'All' && (
                    <Chip size="small" label={`✅ ${filterStatus}`} sx={{ bgcolor: '#fef3c7', color: '#92400e' }} />
                  )}
                  {!debouncedSearch && !filterBrand && !filterCategory && !filterBatchId && (!filterStatus || filterStatus === 'All') && (
                    <Chip size="small" label="📊 All Data" sx={{ bgcolor: '#fee2e2', color: '#dc2626' }} />
                  )}
                </Box>
              </Paper>

              {/* DIVIDER WITH ICON */}
              <Divider sx={{ '&::before, &::after': { borderColor: '#e5e7eb' } }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 0.5,
                  bgcolor: '#f9fafb',
                  borderRadius: 2,
                  border: '1px solid #e5e7eb'
                }}>
                  <SettingsIcon sx={{ fontSize: '1rem', color: '#6b7280' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280' }}>
                    Override Filters (Optional)
                  </Typography>
                </Box>
              </Divider>

              {/* OVERRIDE CONTROLS */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <TextField
                  fullWidth
                  label="Start Date Override"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={exportDateFrom}
                  onChange={(e) => setExportDateFrom(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#10b981' },
                      '&.Mui-focused fieldset': { borderColor: '#10b981' }
                    }
                  }}
                />
                <TextField
                  fullWidth
                  label="End Date Override"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={exportDateTo}
                  onChange={(e) => setExportDateTo(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#10b981' },
                      '&.Mui-focused fieldset': { borderColor: '#10b981' }
                    }
                  }}
                />
              </Box>

              {/* BATCH SELECTION */}
              <FormControl fullWidth>
                <InputLabel sx={{ '&.Mui-focused': { color: '#10b981' } }}>
                  Select Batch IDs (Multiple)
                </InputLabel>
                <Select
                  multiple
                  value={exportBatch}
                  onChange={(e) => setExportBatch(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip
                          key={value}
                          label={value}
                          size="small"
                          onDelete={() => setExportBatch(exportBatch.filter(b => b !== value))}
                          sx={{
                            bgcolor: '#10b981',
                            color: 'white',
                            '& .MuiChip-deleteIcon': { color: 'white', '&:hover': { color: '#a7f3d0' } }
                          }}
                        />
                      ))}
                    </Box>
                  )}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#10b981' },
                      '&.Mui-focused fieldset': { borderColor: '#10b981' }
                    }
                  }}
                >
                  {batches && batches.length > 0 ? (
                    batches.map(b => (
                      <MenuItem key={b.batch_id} value={b.batch_id} sx={{ py: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {b.batch_id}
                          </Typography>
                          <Chip
                            label={`${formatNumber(b.count)} entries`}
                            size="small"
                            sx={{
                              bgcolor: '#e5e7eb',
                              color: '#374151',
                              fontSize: '0.7rem',
                              height: '20px'
                            }}
                          />
                        </Box>
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>No batches available</MenuItem>
                  )}
                </Select>
              </FormControl>

              {/* EXPORT SUMMARY */}
              <Paper sx={{
                bgcolor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 2,
                p: 2
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#166534', mb: 1 }}>
                  📊 Export Summary:
                </Typography>
                <Typography variant="body2" sx={{ color: '#166534' }}>
                  This will export filtered master data records to Excel with all selected criteria applied.
                  The file will include all product details, dates, and batch information.
                </Typography>
              </Paper>
            </Stack>
          </DialogContent>

          <DialogActions sx={{
            p: 3,
            bgcolor: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
            gap: 1
          }}>
            <Button
              onClick={() => {
                setExportDialogOpen(false);
                setExportBatch([]);
                setExportDateFrom('');
                setExportDateTo('');
              }}
              disabled={loading}
              sx={{
                borderRadius: 2,
                px: 3,
                fontWeight: 600,
                color: '#6b7280',
                '&:hover': { bgcolor: '#e5e7eb' }
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleExport}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
              disabled={loading}
              sx={{
                borderRadius: 2,
                px: 4,
                py: 1.5,
                fontWeight: 700,
                fontSize: '0.9rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
                  transform: 'translateY(-1px)'
                },
                transition: 'all 0.2s ease-in-out'
              }}
            >
              {loading ? 'Exporting...' : 'Export Data'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ✅ ADD PRODUCT DIALOG */}
        <Dialog
          open={addDialogOpen}
          onClose={() => !formSubmitting && setAddDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2, maxHeight: '90vh' } }}
        >
          <DialogTitle sx={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            fontWeight: 700,
            py: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AddIcon />
              Add New Product
            </Box>
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2, mt: 1 }}>
              <TextField
                label="WSN *"
                value={productFormData.wsn}
                onChange={(e) => setProductFormData({ ...productFormData, wsn: e.target.value })}
                size="small"
                fullWidth
                required
                error={!productFormData.wsn.trim()}
                helperText={!productFormData.wsn.trim() ? 'Required' : ''}
              />
              <TextField
                label="WID"
                value={productFormData.wid}
                onChange={(e) => setProductFormData({ ...productFormData, wid: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="FSN"
                value={productFormData.fsn}
                onChange={(e) => setProductFormData({ ...productFormData, fsn: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Order ID"
                value={productFormData.order_id}
                onChange={(e) => setProductFormData({ ...productFormData, order_id: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Product Title"
                value={productFormData.product_title}
                onChange={(e) => setProductFormData({ ...productFormData, product_title: e.target.value })}
                size="small"
                fullWidth
                sx={{ gridColumn: { sm: 'span 2', md: 'span 2' } }}
              />
              <TextField
                label="Brand"
                value={productFormData.brand}
                onChange={(e) => setProductFormData({ ...productFormData, brand: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Category (CMS Vertical)"
                value={productFormData.cms_vertical}
                onChange={(e) => setProductFormData({ ...productFormData, cms_vertical: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Grade"
                value={productFormData.fk_grade}
                onChange={(e) => setProductFormData({ ...productFormData, fk_grade: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="FKQC Remark"
                value={productFormData.fkqc_remark}
                onChange={(e) => setProductFormData({ ...productFormData, fkqc_remark: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="MRP"
                value={productFormData.mrp}
                onChange={(e) => setProductFormData({ ...productFormData, mrp: e.target.value })}
                size="small"
                fullWidth
                type="number"
              />
              <TextField
                label="FSP"
                value={productFormData.fsp}
                onChange={(e) => setProductFormData({ ...productFormData, fsp: e.target.value })}
                size="small"
                fullWidth
                type="number"
              />
              <TextField
                label="VRP"
                value={productFormData.vrp}
                onChange={(e) => setProductFormData({ ...productFormData, vrp: e.target.value })}
                size="small"
                fullWidth
                type="number"
              />
              <TextField
                label="HSN/SAC"
                value={productFormData.hsn_sac}
                onChange={(e) => setProductFormData({ ...productFormData, hsn_sac: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="IGST Rate"
                value={productFormData.igst_rate}
                onChange={(e) => setProductFormData({ ...productFormData, igst_rate: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Invoice Date"
                value={productFormData.invoice_date}
                onChange={(e) => setProductFormData({ ...productFormData, invoice_date: e.target.value })}
                size="small"
                fullWidth
                type="date"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="FKT Link"
                value={productFormData.fkt_link}
                onChange={(e) => setProductFormData({ ...productFormData, fkt_link: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="WH Location"
                value={productFormData.wh_location}
                onChange={(e) => setProductFormData({ ...productFormData, wh_location: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Yield Value"
                value={productFormData.yield_value}
                onChange={(e) => setProductFormData({ ...productFormData, yield_value: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Product Type"
                value={productFormData.p_type}
                onChange={(e) => setProductFormData({ ...productFormData, p_type: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Product Size"
                value={productFormData.p_size}
                onChange={(e) => setProductFormData({ ...productFormData, p_size: e.target.value })}
                size="small"
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0', gap: 1 }}>
            <Button
              onClick={() => { setAddDialogOpen(false); resetProductForm(); }}
              disabled={formSubmitting}
              variant="outlined"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddProduct}
              disabled={formSubmitting || !productFormData.wsn.trim()}
              variant="contained"
              startIcon={formSubmitting ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
              sx={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }
              }}
            >
              {formSubmitting ? 'Adding...' : 'Add Product'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ✅ EDIT PRODUCT DIALOG */}
        <Dialog
          open={editDialogOpen}
          onClose={() => !formSubmitting && setEditDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2, maxHeight: '90vh' } }}
        >
          <DialogTitle sx={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            color: 'white',
            fontWeight: 700,
            py: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EditIcon />
              Edit Product
              {editingProduct?.wsn && (
                <Chip label={editingProduct.wsn} size="small" sx={{ ml: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
              )}
            </Box>
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2, mt: 1 }}>
              <TextField
                label="WSN *"
                value={productFormData.wsn}
                onChange={(e) => setProductFormData({ ...productFormData, wsn: e.target.value })}
                size="small"
                fullWidth
                required
                error={!productFormData.wsn.trim()}
                helperText={!productFormData.wsn.trim() ? 'Required' : ''}
              />
              <TextField
                label="WID"
                value={productFormData.wid}
                onChange={(e) => setProductFormData({ ...productFormData, wid: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="FSN"
                value={productFormData.fsn}
                onChange={(e) => setProductFormData({ ...productFormData, fsn: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Order ID"
                value={productFormData.order_id}
                onChange={(e) => setProductFormData({ ...productFormData, order_id: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Product Title"
                value={productFormData.product_title}
                onChange={(e) => setProductFormData({ ...productFormData, product_title: e.target.value })}
                size="small"
                fullWidth
                sx={{ gridColumn: { sm: 'span 2', md: 'span 2' } }}
              />
              <TextField
                label="Brand"
                value={productFormData.brand}
                onChange={(e) => setProductFormData({ ...productFormData, brand: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Category (CMS Vertical)"
                value={productFormData.cms_vertical}
                onChange={(e) => setProductFormData({ ...productFormData, cms_vertical: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Grade"
                value={productFormData.fk_grade}
                onChange={(e) => setProductFormData({ ...productFormData, fk_grade: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="FKQC Remark"
                value={productFormData.fkqc_remark}
                onChange={(e) => setProductFormData({ ...productFormData, fkqc_remark: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="MRP"
                value={productFormData.mrp}
                onChange={(e) => setProductFormData({ ...productFormData, mrp: e.target.value })}
                size="small"
                fullWidth
                type="number"
              />
              <TextField
                label="FSP"
                value={productFormData.fsp}
                onChange={(e) => setProductFormData({ ...productFormData, fsp: e.target.value })}
                size="small"
                fullWidth
                type="number"
              />
              <TextField
                label="VRP"
                value={productFormData.vrp}
                onChange={(e) => setProductFormData({ ...productFormData, vrp: e.target.value })}
                size="small"
                fullWidth
                type="number"
              />
              <TextField
                label="HSN/SAC"
                value={productFormData.hsn_sac}
                onChange={(e) => setProductFormData({ ...productFormData, hsn_sac: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="IGST Rate"
                value={productFormData.igst_rate}
                onChange={(e) => setProductFormData({ ...productFormData, igst_rate: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Invoice Date"
                value={productFormData.invoice_date}
                onChange={(e) => setProductFormData({ ...productFormData, invoice_date: e.target.value })}
                size="small"
                fullWidth
                type="date"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="FKT Link"
                value={productFormData.fkt_link}
                onChange={(e) => setProductFormData({ ...productFormData, fkt_link: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="WH Location"
                value={productFormData.wh_location}
                onChange={(e) => setProductFormData({ ...productFormData, wh_location: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Yield Value"
                value={productFormData.yield_value}
                onChange={(e) => setProductFormData({ ...productFormData, yield_value: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Product Type"
                value={productFormData.p_type}
                onChange={(e) => setProductFormData({ ...productFormData, p_type: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Product Size"
                value={productFormData.p_size}
                onChange={(e) => setProductFormData({ ...productFormData, p_size: e.target.value })}
                size="small"
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0', gap: 1 }}>
            <Button
              onClick={() => { setEditDialogOpen(false); setEditingProduct(null); resetProductForm(); }}
              disabled={formSubmitting}
              variant="outlined"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditProduct}
              disabled={formSubmitting || !productFormData.wsn.trim()}
              variant="contained"
              startIcon={formSubmitting ? <CircularProgress size={18} color="inherit" /> : <EditIcon />}
              sx={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)' }
              }}
            >
              {formSubmitting ? 'Updating...' : 'Update Product'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ✅ DELETE CONFIRMATION DIALOG */}
        <Dialog
          open={deleteConfirmOpen}
          onClose={() => !formSubmitting && setDeleteConfirmOpen(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2 } }}
        >
          <DialogTitle sx={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            fontWeight: 700,
            py: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DeleteIcon />
              Delete Product
            </Box>
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Are you sure you want to delete this product?
            </Typography>
            {deletingProduct && (
              <Paper sx={{ p: 2, bgcolor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 1 }}>
                <Typography variant="body2" fontWeight="600" color="error.main">
                  WSN: {deletingProduct.wsn}
                </Typography>
                {deletingProduct.product_title && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {deletingProduct.product_title}
                  </Typography>
                )}
                {deletingProduct.brand && (
                  <Typography variant="caption" color="text.secondary">
                    Brand: {deletingProduct.brand}
                  </Typography>
                )}
              </Paper>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              ⚠️ This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0', gap: 1 }}>
            <Button
              onClick={() => { setDeleteConfirmOpen(false); setDeletingProduct(null); }}
              disabled={formSubmitting}
              variant="outlined"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteProduct}
              disabled={formSubmitting}
              variant="contained"
              color="error"
              startIcon={formSubmitting ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
            >
              {formSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AppLayout >
  );
}
