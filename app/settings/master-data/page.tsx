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
  Collapse, Tooltip, FormControlLabel, Divider, Grid, Card, CardContent, InputBase, Fade,
  Drawer, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import {
  Upload as UploadIcon, Refresh as RefreshIcon, Logout as LogoutIcon,
  GetApp as ExportIcon, Visibility as VisibilityIcon, Cancel as CancelIcon,
  DeleteSweep as DeleteSweepIcon, Download as DownloadIcon, Search as SearchIcon,
  Speed as SpeedIcon, Clear as ClearIcon, CheckCircle, Settings as SettingsIcon,
  Tune as TuneIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon, Close as CloseIcon, KeyboardArrowLeft, KeyboardArrowRight, FirstPage, LastPage, AccessTime,
  Print as PrintIcon, Menu as MenuIcon, ViewColumn as ViewColumnIcon, TableChart as TableChartIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import toast, { Toaster } from 'react-hot-toast';
import { getStoredUser, logout } from '@/lib/auth';
import { masterDataAPI } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { BatchManagementTab, StandardPageHeader } from '@/components';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { useTableRowHeight } from '@/app/context/AppearanceContext';
// ⚡ OPTIMIZED: XLSX loaded dynamically on export to reduce bundle size
// import * as XLSX from 'xlsx'; // Removed - loaded dynamically
import { useMasterDataPermissions } from '@/hooks/usePagePermissions';
import { printLabel, isAgentRunning } from '@/lib/printAgent';
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
                row.actual_received === 'Rejected' ? 'error' :
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

  // Print button - always available if agent is ready
  const { onPrint, agentReady } = context || {};

  // Common button styles - professional look with no focus border
  const buttonBase = {
    width: 28,
    height: 28,
    borderRadius: '6px',
    border: 'none',
    transition: 'all 0.15s ease',
    '&:focus': { outline: 'none' },
    '&:focus-visible': { outline: 'none' },
    '&.MuiIconButton-root:focus': { outline: 'none', boxShadow: 'none' },
    '&.MuiIconButton-root:focus-visible': { outline: 'none', boxShadow: 'none' },
  };

  return (
    <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      {/* Print Button */}
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); onPrint?.(data); }}
        disabled={!agentReady}
        sx={{
          ...buttonBase,
          bgcolor: agentReady ? 'rgba(34, 197, 94, 0.15)' : 'rgba(158, 158, 158, 0.1)',
          opacity: agentReady ? 1 : 0.4,
          '&:hover': {
            bgcolor: agentReady ? 'rgba(34, 197, 94, 0.25)' : 'rgba(158, 158, 158, 0.1)',
            transform: agentReady ? 'scale(1.08)' : 'none',
          },
          '&:active': { transform: 'scale(0.95)' },
        }}
        title={agentReady ? 'Print WSN Label' : 'Print Agent not available'}
      >
        <PrintIcon sx={{ fontSize: 15, color: agentReady ? '#16a34a' : '#9e9e9e' }} />
      </IconButton>

      {/* Edit Button */}
      {showEditButton && (
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); context?.onEdit?.(data); }}
          disabled={!canEdit}
          sx={{
            ...buttonBase,
            bgcolor: canEdit ? 'rgba(59, 130, 246, 0.15)' : 'rgba(158, 158, 158, 0.1)',
            opacity: canEdit ? 1 : 0.4,
            '&:hover': {
              bgcolor: canEdit ? 'rgba(59, 130, 246, 0.25)' : 'rgba(158, 158, 158, 0.1)',
              transform: canEdit ? 'scale(1.08)' : 'none',
            },
            '&:active': { transform: 'scale(0.95)' },
          }}
          title="Edit"
        >
          <EditIcon sx={{ fontSize: 15, color: canEdit ? '#2563eb' : '#9e9e9e' }} />
        </IconButton>
      )}

      {/* Delete Button */}
      {showDeleteButton && (
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); context?.onDelete?.(data); }}
          disabled={!canDelete}
          sx={{
            ...buttonBase,
            bgcolor: canDelete ? 'rgba(239, 68, 68, 0.15)' : 'rgba(158, 158, 158, 0.1)',
            opacity: canDelete ? 1 : 0.4,
            '&:hover': {
              bgcolor: canDelete ? 'rgba(239, 68, 68, 0.25)' : 'rgba(158, 158, 158, 0.1)',
              transform: canDelete ? 'scale(1.08)' : 'none',
            },
            '&:active': { transform: 'scale(0.95)' },
          }}
          title="Delete"
        >
          <DeleteIcon sx={{ fontSize: 15, color: canDelete ? '#dc2626' : '#9e9e9e' }} />
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
    } else if (status === 'Rejected') {
      return {
        bgcolor: '#ef4444',  // solid red background
        color: '#ffffff',    // white text
        borderColor: '#dc2626',
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

  // Table row height from appearance settings
  const tableRowHeight = useTableRowHeight();

  // Permission hook
  const { filterTabs, canSeeTab, canSeeButton, canAccessButton, isAdmin, isLoading: permLoading } = useMasterDataPermissions();

  // ====== PRINT AGENT STATE ======
  const [agentReady, setAgentReady] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [masterData, setMasterData] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [gridDataRendered, setGridDataRendered] = useState(false);
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
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update' | 'replace'>('skip');

  // Upload history
  const [uploadHistory, setUploadHistory] = useState<any[]>([]);
  const [uploadHistoryTotal, setUploadHistoryTotal] = useState(0);
  const [uploadHistoryPage, setUploadHistoryPage] = useState(1);
  const [uploadHistoryLoading, setUploadHistoryLoading] = useState(false);

  // Phase 5: Deleted records & snapshots
  const [deletedRecords, setDeletedRecords] = useState<any[]>([]);
  const [deletedRecordsTotal, setDeletedRecordsTotal] = useState(0);
  const [deletedRecordsPage, setDeletedRecordsPage] = useState(1);
  const [deletedRecordsLoading, setDeletedRecordsLoading] = useState(false);
  const [deletedSearch, setDeletedSearch] = useState('');
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [snapshotsTotal, setSnapshotsTotal] = useState(0);
  const [snapshotsPage, setSnapshotsPage] = useState(1);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [restoringBatchId, setRestoringBatchId] = useState<string | null>(null);
  // Upload progress
  const [uploadProgress, setUploadProgress] = useState({
    show: false,
    jobId: '',
    processed: 0,
    total: 0,
    successCount: 0,
    errorCount: 0,
    duplicateCount: 0,
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

  // ====== OPTIONS PANEL STATE ======
  const [optionsPanelOpen, setOptionsPanelOpen] = useState(false);
  const [optionsPanelExpanded, setOptionsPanelExpanded] = useState<string | false>('filters');

  // ====== COMPUTED: Check if any filter is active ======
  const filtersActive = filterBatchId || filterStatus !== 'All' || filterBrand || filterCategory;

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
    tooltipComponentParams: { color: '#ececec' },
    cellStyle: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
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
    if (!colConfig) return {};

    const sizing: any = {};

    // Add flex for columns that should expand (like product_title)
    if (colConfig.flex) {
      sizing.flex = colConfig.flex;
      sizing.minWidth = isMobile ? 150 : 250;
    } else {
      sizing.width = isMobile ? Math.max(70, Math.round(colConfig.width * 0.7)) : colConfig.width;
      sizing.minWidth = Math.max(60, isMobile ? 50 : 80);
    }

    return sizing;
  }, [isMobile]);

  // Build column definitions for AG Grid
  // Include ALL columns - visibility controlled by ag-Grid state
  useEffect(() => {
    // SR.NO column - always first, pinned to left
    const srCol = {
      headerName: 'SR.NO',
      field: '__sr',
      valueGetter: (params: any) => params.node ? page * rowsPerPage + params.node.rowIndex + 1 : undefined,
      width: 20,
      minWidth: 40,
      maxWidth: 100,
      suppressMovable: true,
      sortable: false,
      filter: false,
      pinned: 'left',
      lockPinned: true,
      cellStyle: { fontWeight: 700, textAlign: 'center' },
    };

    // Include ALL columns with hide property - columnDefs structure never changes
    const defs: any = [srCol, ...columns.map((col) => {
      const base: any = {
        field: col.id,
        headerName: col.label,
        sortable: enableSorting,
        resizable: enableColumnResize,
        filter: enableColumnFilters ? 'agTextColumnFilter' : undefined,
        tooltipField: col.id,
        hide: false, // ag-Grid state controls visibility
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
      width: 130,
      maxWidth: 150,
      suppressCellFocus: true,
      cellRenderer: ActionsCellRenderer
    });

    setColumnDefs(defs);
  }, [enableSorting, enableColumnFilters, enableColumnResize, isMobile, page, rowsPerPage, getColumnSizing]);

  // NOTE: No longer need to re-apply column state on columnDefs change
  // because columnDefs structure is now STABLE (includes ALL columns with hide property)
  // Column visibility is controlled via setColumnsVisible() API which preserves order

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

  // ====== CHECK PRINT AGENT STATUS ======
  useEffect(() => {
    const checkAgent = async () => {
      const running = await isAgentRunning();
      setAgentReady(running);
      if (running) {
        console.log('✅ Print Agent is ready');
      }
    };
    checkAgent();
    // Re-check every 30 seconds in case agent starts/stops
    const interval = setInterval(checkAgent, 30000);
    return () => clearInterval(interval);
  }, []);

  // ====== PRINT WSN HANDLER ======
  const handlePrintWSN = useCallback(async (rowData: any) => {
    if (!rowData?.wsn?.trim()) {
      toast.error('No WSN to print');
      return;
    }

    if (!agentReady) {
      toast.error('Print agent not available. Please ensure the print agent is running.');
      return;
    }

    const wsnUpper = rowData.wsn.trim().toUpperCase();

    try {
      const printPayload = {
        wsn: wsnUpper,
        fsn: rowData.fsn || '',
        wid: rowData.wid || '',
        product_title: rowData.product_title || '',
        brand: rowData.brand || '',
        mrp: String(rowData.mrp || ''),
        fsp: String(rowData.fsp || ''),
        copies: 1,
      };

      const printSuccess = await printLabel(printPayload);

      if (printSuccess) {
        toast.success(`✓ Label printed: ${wsnUpper}`, { duration: 2000 });
      } else {
        toast.error('Print failed - check printer settings');
      }
    } catch (err: any) {
      toast.error(`Print error: ${err.message}`);
    }
  }, [agentReady]);

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
  }, [page, rowsPerPage, user, tabValue, isClient, debouncedSearch, filterBatchId, filterStatus, filterBrand, filterCategory, activeWarehouse?.id]);

  // Initial load for batches and active uploads
  useEffect(() => {
    if (user && isClient) {
      loadBatches();
      // Note: loadBrands and loadCategories are handled by their respective useEffects
      checkActiveUploads();
    }
  }, [user, isClient, activeWarehouse?.id]);

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
      warehouseId: activeWarehouse?.id,
    });
  }, [page, rowsPerPage, debouncedSearch, filterBatchId, filterStatus, filterBrand, filterCategory, activeWarehouse?.id]);

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
      warehouseId: activeWarehouse?.id,
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
      if (activeWarehouse?.id) params.append('warehouseId', activeWarehouse.id.toString());

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
  }, [page, rowsPerPage, totalRecords, debouncedSearch, filterBatchId, filterStatus, filterBrand, filterCategory, activeWarehouse?.id]);

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
      if (activeWarehouse?.id) params.append('warehouseId', activeWarehouse.id.toString());

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
            document.cookie = 'wms_auth_token=; path=/; max-age=0; SameSite=Lax';
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
      const response = await masterDataAPI.getBatches(activeWarehouse?.id);
      console.log('Batches response:', response.data);

      const batchesArray = Array.isArray(response.data) ? response.data : [];

      // ✅ Format lastupdated with created_at_display (datetime format)
      const formattedBatches = batchesArray.map((batch: any) => ({
        ...batch,
        last_updated: batch.lastupdated || batch.created_at,
        created_at: batch.created_at || batch.lastupdated,
        lastupdated_display: formatDateToIST(batch.lastupdated, 'datetime'),
        warehouse_names: batch.warehouse_name || '-',
        uploaded_by: batch.uploaded_by_name || '-'
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
      const response = await masterDataAPI.getBrands(category || undefined, activeWarehouse?.id);
      setBrandOptions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load brands:', error);
      setBrandOptions([]);
    }
  };

  // ✅ Load categories from database API (optionally filtered by brand)
  const loadCategories = async (brand?: string) => {
    try {
      const response = await masterDataAPI.getCategories(brand || undefined, activeWarehouse?.id);
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
          duplicateCount: job.duplicateCount || 0,
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
          duplicateCount: prog.duplicateCount || 0,
          total: prog.total || prev.total
        }));

        if (prog.status === 'completed' || prog.status === 'failed') {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }

          setUploadProgress(prev => ({ ...prev, show: false }));

          if (prog.status === 'completed') {
            const dupInfo = prog.duplicateCount > 0 ? ` | ${formatNumber(prog.duplicateCount)} duplicates` : '';
            toast.success(`✓ Upload complete! ${formatNumber(prog.successCount)} records added${dupInfo}`, { duration: 5000 });
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

  // ✅ Phase 4: Load upload history
  const loadUploadHistory = useCallback(async () => {
    setUploadHistoryLoading(true);
    try {
      const response = await masterDataAPI.getUploadHistory(uploadHistoryPage, 20, { warehouseId: activeWarehouse?.id });
      setUploadHistory(response.data?.data || []);
      setUploadHistoryTotal(response.data?.total || 0);
    } catch (error) {
      console.log('⚠️ Upload history load error:', error);
    } finally {
      setUploadHistoryLoading(false);
    }
  }, [uploadHistoryPage, activeWarehouse?.id]);

  // Load upload history when page changes or tab switches to it
  useEffect(() => {
    // The tab index logic: 0=Master Data, 1=Batches, 2=Upload History
    if (tabValue === 2) {
      loadUploadHistory();
    }
  }, [tabValue, loadUploadHistory]);

  // ✅ Phase 5: Load deleted records
  const loadDeletedRecords = useCallback(async () => {
    setDeletedRecordsLoading(true);
    try {
      const response = await masterDataAPI.getDeletedRecords(deletedRecordsPage, 50, { search: deletedSearch, warehouseId: activeWarehouse?.id });
      setDeletedRecords(response.data?.data || []);
      setDeletedRecordsTotal(response.data?.total || 0);
    } catch (error) {
      console.log('⚠️ Deleted records load error:', error);
    } finally {
      setDeletedRecordsLoading(false);
    }
  }, [deletedRecordsPage, deletedSearch, activeWarehouse?.id]);

  // ✅ Phase 5: Load snapshots
  const loadSnapshots = useCallback(async () => {
    setSnapshotsLoading(true);
    try {
      const response = await masterDataAPI.getSnapshots(snapshotsPage, 20, { warehouseId: activeWarehouse?.id });
      setSnapshots(response.data?.data || []);
      setSnapshotsTotal(response.data?.total || 0);
    } catch (error) {
      console.log('⚠️ Snapshots load error:', error);
    } finally {
      setSnapshotsLoading(false);
    }
  }, [snapshotsPage, activeWarehouse?.id]);

  // Load deleted/snapshots when their tab is active
  useEffect(() => {
    if (tabValue === 3) loadDeletedRecords();
  }, [tabValue, loadDeletedRecords]);

  useEffect(() => {
    if (tabValue === 4) loadSnapshots();
  }, [tabValue, loadSnapshots]);

  // ✅ Phase 5: Restore batch from snapshot
  const handleRestoreBatch = async (batchId: string) => {
    if (!confirm(`Restore all soft-deleted records in batch "${batchId}" from snapshot?`)) return;
    setRestoringBatchId(batchId);
    try {
      const response = await masterDataAPI.restoreBatch(batchId);
      const data = response.data;
      toast.success(`✅ Restored ${data.restoredCount} records${data.conflictCount > 0 ? ` (${data.conflictCount} WSN conflicts skipped)` : ''}`);
      loadSnapshots();
      loadDeletedRecords();
      loadMasterData();
      loadBatches();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Restore failed');
    } finally {
      setRestoringBatchId(null);
    }
  };

  // ✅ Phase 5: Purge single deleted record permanently
  const handlePurgeRecord = async (id: number, wsn: string) => {
    if (!confirm(`Permanently delete record WSN "${wsn}"? This CANNOT be undone.`)) return;
    try {
      await masterDataAPI.purgeDeletedRecord(id);
      toast.success('Record permanently deleted');
      loadDeletedRecords();
    } catch (error) {
      toast.error('Failed to purge record');
    }
  };

  // ✅ Phase 5: Purge ALL deleted records permanently
  const handlePurgeAll = async () => {
    if (!confirm(`Permanently delete ALL ${deletedRecordsTotal} deleted records? This CANNOT be undone!`)) return;
    try {
      const response = await masterDataAPI.purgeAllDeletedRecords();
      const count = response.data?.count || 0;
      toast.success(`🗑️ ${count} records permanently deleted`);
      loadDeletedRecords();
    } catch (error) {
      toast.error('Failed to purge records');
    }
  };

  // ✅ Phase 5: Cleanup stale data
  const handleCleanupStale = async () => {
    if (!confirm('This will permanently remove:\n• Expired snapshots\n• Old upload progress entries\n• Records deleted 90+ days ago\n\nProceed?')) return;
    try {
      const response = await masterDataAPI.cleanupStaleData();
      const r = response.data?.results || {};
      toast.success(`Cleanup complete: ${r.expiredSnapshots || 0} snapshots, ${r.oldProgressEntries || 0} progress entries, ${r.purgedRecords || 0} records purged`);
      loadSnapshots();
      loadDeletedRecords();
    } catch (error) {
      toast.error('Cleanup failed');
    }
  };

  // ✅ Delete upload history log entry
  const handleDeleteUploadLog = async (id: number, filename: string) => {
    if (!confirm(`Delete upload log for "${filename}"?\n\nThis only removes the log entry, not the uploaded data.`)) return;
    try {
      await masterDataAPI.deleteUploadLog(id);
      toast.success('Upload log deleted');
      loadUploadHistory();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to delete upload log');
    }
  };


  // ✅ Reset all filters
  const resetFilters = () => {
    setFilterBatchId('');
    setFilterStatus('All');
    setFilterBrand('');
    setFilterCategory('');
    setSearchQuery('');
    setPage(0);
    toast('🔍 Filters reset', { icon: '🔄' });
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
      await masterDataAPI.create({ ...productFormData, warehouse_id: activeWarehouse?.id });
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
    formData.append('duplicateStrategy', duplicateStrategy);
    if (activeWarehouse?.id) formData.append('warehouse_id', activeWarehouse.id.toString());

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
        duplicateCount: 0,
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
    if (!confirm(`Delete all records in batch ${batchId}?\n\nA snapshot will be created so you can restore later from the Snapshots tab.`)) return;

    try {
      await masterDataAPI.deleteBatch(batchId);
      toast.success('✓ Batch deleted (snapshot saved for 90 days)');
      loadMasterData();
      loadBatches();
      loadSnapshots();
      loadDeletedRecords();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error?.response?.data?.error || 'Failed to delete batch');
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

      // Always fetch from API with current filters to get ALL filtered data (not just current page)
      const params = new URLSearchParams();

      // Add batch filters if selected in export dialog
      if (exportBatch.length > 0) {
        params.append('batchIds', exportBatch.join(','));
      }

      // Add date range if selected in export dialog
      if (exportDateFrom && exportDateTo) {
        params.append('dateFrom', exportDateFrom);
        params.append('dateTo', exportDateTo);
      }

      // Add current active filters
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filterBatchId) params.append('batch_id', filterBatchId);
      if (filterStatus && filterStatus !== 'All') params.append('status', filterStatus);
      if (filterBrand) params.append('brand', filterBrand);
      if (filterCategory) params.append('category', filterCategory);
      if (activeWarehouse?.id) params.append('warehouseId', activeWarehouse.id.toString());

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/master-data/export?${params.toString()}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );

      if (!response.ok) throw new Error('Export failed');

      const result = await response.json();
      data = result.data || [];

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
        'Actual Received': item.actual_received || 'Pending',
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

    // Use ag-Grid API to toggle column visibility WITHOUT rebuilding columnDefs
    // This preserves column order
    const api = gridRef.current;
    if (api) {
      const shouldShow = !columnVisibility[col as keyof typeof columnVisibility];
      api.setColumnsVisible([col], shouldShow);
      // Save the updated state
      try {
        const state = api.getColumnState();
        localStorage.setItem('masterdata_grid_state', JSON.stringify(state));
      } catch { /* ignore */ }
    }
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
                  {uploadProgress.duplicateCount > 0 && <Chip label={`⊘${formatNumber(uploadProgress.duplicateCount)}`} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#fff3e0', color: '#e65100' }} />}
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
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Tabs */}
          {(() => {
            // Define all tabs with their permission codes
            const allTabs = [
              { label: '📋 Master Data', code: 'list' },
              { label: '📦 Batches', code: 'batches' },
              { label: '📜 Upload History', code: 'list' },
              { label: '🗑️ Deleted Records', code: 'list' },
              { label: '📸 Snapshots', code: 'batches' }
            ];

            // Filter visible tabs based on permissions
            const visibleTabs = allTabs.filter(tab => canSeeTab(tab.code));

            // Map visible tab index to actual tab index — use index-based matching for duplicate codes
            const getActualTabIndex = (visibleIndex: number) => {
              if (visibleIndex < 0 || visibleIndex >= visibleTabs.length) return -1;
              const visibleTab = visibleTabs[visibleIndex];
              // Count how many tabs with the same code appear before this one in visibleTabs
              let sameCodeCount = 0;
              for (let i = 0; i < visibleIndex; i++) {
                if (visibleTabs[i].code === visibleTab.code) sameCodeCount++;
              }
              // Find the nth occurrence of this code in allTabs
              let found = 0;
              for (let i = 0; i < allTabs.length; i++) {
                if (allTabs[i].code === visibleTab.code) {
                  if (found === sameCodeCount) return i;
                  found++;
                }
              }
              return -1;
            };

            // Current actual tab index
            const actualTabIndex = getActualTabIndex(tabValue);

            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <Paper elevation={0} sx={{
                  borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e0e0e0',
                  position: 'sticky',
                  top: 0,
                  zIndex: 90,
                  bgcolor: isDarkMode ? '#1e293b' : 'white',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                }}>
                  <Tabs
                    value={tabValue}
                    onChange={(e, v) => setTabValue(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    sx={{
                      minHeight: { xs: 40, md: 42 },
                      '& .MuiTabs-scrollButtons': {
                        width: 32,
                        '&.Mui-disabled': { opacity: 0.3 },
                      },
                      '& .MuiTabs-indicator': {
                        height: 3,
                        bgcolor: '#1e40af',
                        borderRadius: '3px 3px 0 0',
                      },
                      '& .MuiTab-root': {
                        fontWeight: 600,
                        fontSize: { xs: '0.78rem', sm: '0.85rem' },
                        textTransform: 'none',
                        minHeight: { xs: 40, md: 42 },
                        py: 1,
                        px: { xs: 1.5, sm: 2 },
                        color: '#64748b',
                        '&.Mui-selected': { color: '#1e40af', fontWeight: 700 },
                      },
                    }}
                  >
                    {visibleTabs.map((tab, idx) => (
                      <Tab key={idx} label={tab.label} />
                    ))}
                  </Tabs>
                </Paper>

                {/* Tab 1: Master Data List */}
                {actualTabIndex === 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', overflow: 'hidden', p: { xs: 0.25, sm: 0.5 } }}>
                    {/* SEARCH BAR + OPTIONS BUTTON */}
                    <Box sx={{
                      flexShrink: 0,
                      mb: 1, position: 'relative', zIndex: 95,
                      // Paste inside the existing sx object
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'transparent !important',
                        boxShadow: 'none !important',
                        '&:hover': { bgcolor: 'transparent !important' },
                        '&.Mui-focused': { bgcolor: 'transparent !important', boxShadow: 'none !important' },
                      },
                      '& .MuiOutlinedInput-input': {
                        background: 'transparent !important',
                      },
                      '& input[type="date"], & .MuiOutlinedInput-input[type="date"], & .MuiInputBase-input[type="date"]': {
                        background: 'transparent !important',
                        color: 'inherit !important',
                        WebkitAppearance: 'none !important',
                        MozAppearance: 'textfield !important',
                        appearance: 'none !important',
                        borderRadius: '6px !important',
                        padding: '0 6px !important',
                      },
                      '& input[type="date"]::-webkit-datetime-edit, & input[type="date"]::-webkit-datetime-edit-text, & input[type="date"]::-webkit-datetime-edit-month-field, & input[type="date"]::-webkit-datetime-edit-day-field, & input[type="date"]::-webkit-datetime-edit-year-field': {
                        background: 'transparent !important',
                        color: 'inherit !important',
                      },
                      '& input[type="date"]::-webkit-calendar-picker-indicator': {
                        WebkitAppearance: 'none',
                        appearance: 'none',
                        background: 'transparent',
                        padding: 0,
                        margin: 0,
                      },
                      '& input:-webkit-autofill': {
                        WebkitBoxShadow: '0 0 0 1000px transparent inset',
                        boxShadow: '0 0 0 1000px transparent inset',
                        WebkitTextFillColor: 'inherit',
                      },

                    }}>
                      <Stack direction="row" spacing={1} alignItems="stretch">
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

                        {/* Options Button - Opens Options Panel Drawer */}
                        <Tooltip title="Open Options Panel">
                          <Button
                            variant="outlined"
                            onClick={() => setOptionsPanelOpen(true)}
                            sx={{
                              minWidth: { xs: 'auto', sm: 100 },
                              height: 38,
                              borderWidth: 2,
                              borderColor: isDarkMode ? '#3b82f6' : '#1e40af',
                              bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(30, 64, 175, 0.04)',
                              color: isDarkMode ? '#60a5fa' : '#1e40af',
                              fontWeight: 700,
                              fontSize: { xs: '0.75rem', sm: '0.78rem' },
                              borderRadius: 1.5,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                              transition: 'all 0.2s',
                              px: { xs: 1.5, sm: 2 },
                              '&:hover': {
                                borderWidth: 2,
                                borderColor: '#3b82f6',
                                bgcolor: 'rgba(59, 130, 246, 0.12)',
                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
                              },
                              position: 'relative'
                            }}
                          >
                            <MenuIcon sx={{ fontSize: '1.1rem', mr: { xs: 0, sm: 0.5 } }} />
                            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Options</Box>
                            {/* Green dot indicator when filters are active */}
                            {filtersActive && (
                              <Box sx={{
                                position: 'absolute',
                                top: -4,
                                right: -4,
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: '#10b981',
                                border: '2px solid white',
                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.4)'
                              }} />
                            )}
                          </Button>
                        </Tooltip>
                      </Stack>
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

                      {/* Full Loading Overlay - shows during initial load OR while columns are being sized */}
                      {((loading && (!masterData || masterData.length === 0)) || (masterData && masterData.length > 0 && !gridDataRendered)) && (
                        <Box sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
                          zIndex: 100,
                          display: 'flex',
                          flexDirection: 'column',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)',
                        }}>
                          {/* Static header row that matches AG Grid header exactly */}
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            height: 32,
                            bgcolor: '#1e3a5f',
                            borderBottom: isDarkMode ? '2px solid #10b981' : '2px solid #059669',
                            borderRadius: '4px 4px 0 0',
                          }}>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', minWidth: 50, textTransform: 'uppercase', letterSpacing: '0.02em', px: 1.5, borderRight: '1px solid #3b5998' }}>SR.NO</Typography>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', minWidth: 100, textTransform: 'uppercase', letterSpacing: '0.02em', px: 1.5, borderRight: '1px solid #3b5998' }}>WSN</Typography>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', minWidth: 80, textTransform: 'uppercase', letterSpacing: '0.02em', px: 1.5, borderRight: '1px solid #3b5998' }}>WID</Typography>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', minWidth: 100, textTransform: 'uppercase', letterSpacing: '0.02em', px: 1.5, borderRight: '1px solid #3b5998' }}>FSN</Typography>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', flex: 1, textTransform: 'uppercase', letterSpacing: '0.02em', px: 1.5, borderRight: '1px solid #3b5998' }}>PRODUCT TITLE</Typography>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', minWidth: 80, textTransform: 'uppercase', letterSpacing: '0.02em', px: 1.5, borderRight: '1px solid #3b5998' }}>BRAND</Typography>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', minWidth: 100, textTransform: 'uppercase', letterSpacing: '0.02em', px: 1.5 }}>CATEGORY</Typography>
                          </Box>
                          {/* Loading body area with centered spinner */}
                          <Box sx={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
                          }}>
                            <Box sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 3,
                              p: 4,
                              bgcolor: isDarkMode ? '#1e293b' : 'white',
                              borderRadius: 3,
                              boxShadow: isDarkMode ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)'
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

                      <Box className="ag-theme-quartz" sx={{
                        height: '100%',
                        width: '100%',
                        bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
                        border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        '& .ag-root-wrapper': {
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                          border: 'none',
                        },
                        '& .ag-header': {
                          backgroundColor: '#1e3a5f !important',
                          borderBottom: isDarkMode ? '2px solid #10b981' : '2px solid #059669',
                          fontWeight: 700,
                          opacity: '1 !important',
                          zIndex: 15,
                          position: 'relative'
                        },
                        '& .ag-header-cell': {
                          padding: '0 12px',
                          opacity: '1 !important',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          backgroundColor: '#1e3a5f !important',
                          color: '#ffffff !important',
                          borderRight: '1px solid #3b5998',
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                        },
                        '& .ag-header-cell:last-child': {
                          borderRight: 'none',
                        },
                        '& .ag-header-row': {
                          backgroundColor: '#1e3a5f !important',
                        },
                        '& .ag-header-viewport': {
                          backgroundColor: '#1e3a5f !important',
                        },
                        '& .ag-header-container': {
                          backgroundColor: '#1e3a5f !important',
                        },
                        '& .ag-header-cell-label': {
                          color: '#ffffff !important',
                        },
                        '& .ag-header-cell-text': {
                          color: '#ffffff !important',
                        },
                        '& .ag-icon': {
                          color: '#94a3b8 !important',
                        },
                        '& .ag-body-viewport': {
                          opacity: loading ? 0.3 : 1,
                          transition: 'opacity 0.2s ease-in-out',
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        },
                        '& .ag-center-cols-viewport': {
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        },
                        '& .ag-center-cols-container': {
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        },
                        '& .ag-body': {
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        },
                        '& .ag-row': {
                          borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                        },
                        '& .ag-row-even': {
                          backgroundColor: isDarkMode ? '#1a2536' : '#ffffff',
                        },
                        '& .ag-row-odd': {
                          backgroundColor: isDarkMode ? '#1e293b' : 'rgba(248,250,252,0.5)',
                        },
                        '& .ag-cell': {
                          display: 'flex',
                          alignItems: 'center',
                          fontSize: '0.875rem',
                          padding: '0 12px',
                          color: isDarkMode ? '#f1f5f9' : 'inherit',
                        },
                        '& .ag-cell-focus': {
                          border: '2px solid #1e40af !important',
                          boxSizing: 'border-box',
                          outline: 'none'
                        },
                        '& .ag-cell-range-selected': {
                          backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2) !important' : 'rgba(30,64,175,0.08) !important',
                        },
                        '& .ag-row-hover': {
                          backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15) !important' : 'rgba(30,64,175,0.04) !important',
                        },
                        '& .ag-overlay-loading-wrapper': {
                          backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        },
                        '& .ag-overlay-no-rows-wrapper': {
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        },
                      }}>
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
                            onPrint: handlePrintWSN,
                            agentReady,
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
                              } else {
                                // No saved state - hide columns based on columnVisibility
                                const allColIds = params.api.getColumns()?.map((c: any) => c.getColId()) || [];
                                allColIds.forEach((colId: string) => {
                                  if (colId === '__sr' || colId === 'actions') return;
                                  const shouldShow = columnVisibility[colId as keyof typeof columnVisibility] ?? false;
                                  params.api.setColumnsVisible([colId], shouldShow);
                                });
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
                            // Mark grid as rendered
                            requestAnimationFrame(() => setGridDataRendered(true));
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
                          // ⚡ PERFORMANCE: Optimizations for smooth fast scrolling
                          rowBuffer={100}
                          suppressRowTransform={true}
                          suppressAnimationFrame={true}
                          alwaysShowVerticalScroll={true}
                          valueCache={true}
                          debounceVerticalScrollbar={true}
                          suppressScrollOnNewData={true}
                          maintainColumnOrder={true}
                          ensureDomOrder={true}
                          enableCellTextSelection={true}
                          containerStyle={{ height: '100%', width: '100%' }}
                          rowHeight={tableRowHeight}
                          headerHeight={35}
                        />
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
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
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
                  </Box>
                )}

                {/* Tab 3: Upload History */}
                {actualTabIndex === 2 && (
                  <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Typography variant="h6" fontWeight={700}>
                        <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Upload History
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={loadUploadHistory}
                        disabled={uploadHistoryLoading}
                      >
                        Refresh
                      </Button>
                    </Stack>

                    {uploadHistoryLoading && <LinearProgress sx={{ mb: 2 }} />}

                    {uploadHistory.length === 0 && !uploadHistoryLoading ? (
                      <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc' }}>
                        <HistoryIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
                        <Typography color="text.secondary">No upload history yet</Typography>
                        <Typography variant="caption" color="text.secondary">Upload history will appear here after your first file upload</Typography>
                      </Paper>
                    ) : (
                      <>
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, flex: 1, overflow: 'auto' }}>
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f1f5f9' }}>Filename</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f1f5f9' }}>Batch</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f1f5f9' }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f1f5f9' }} align="right">Total</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f1f5f9' }} align="right">Success</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f1f5f9' }} align="right">Duplicates</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f1f5f9' }}>Strategy</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f1f5f9' }}>Date</TableCell>
                                {(isAdmin || canSeeButton('batches:delete')) && <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#f1f5f9' }} align="center">Actions</TableCell>}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {uploadHistory.map((entry: any) => (
                                <TableRow key={entry.id} hover>
                                  <TableCell>
                                    <Tooltip title={entry.filename}>
                                      <Typography variant="caption" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                        📄 {entry.filename}
                                      </Typography>
                                    </Tooltip>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                      {(entry.fileSizeBytes / 1024 / 1024).toFixed(2)} MB · {entry.fileType?.toUpperCase()}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                      {entry.batchId}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      label={entry.status}
                                      size="small"
                                      color={
                                        entry.status === 'completed' ? 'success' :
                                          entry.status === 'failed' ? 'error' :
                                            entry.status === 'processing' ? 'info' :
                                              entry.status === 'cancelled' ? 'warning' : 'default'
                                      }
                                      sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
                                    />
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="caption">{formatNumber(entry.totalRows)}</Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="caption" color="success.main" fontWeight={600}>{formatNumber(entry.successCount)}</Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="caption" color={entry.duplicateCount > 0 ? 'warning.main' : 'text.secondary'} fontWeight={entry.duplicateCount > 0 ? 600 : 400}>
                                      {formatNumber(entry.duplicateCount)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      label={entry.duplicateStrategy || 'skip'}
                                      size="small"
                                      variant="outlined"
                                      sx={{ height: 20, fontSize: '0.65rem' }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                      {formatDateToIST(entry.uploadedAt)}
                                    </Typography>
                                  </TableCell>
                                  {(isAdmin || canSeeButton('batches:delete')) && (
                                    <TableCell align="center">
                                      {entry.status !== 'processing' && entry.status !== 'pending' ? (
                                        <Tooltip title="Delete log entry">
                                          <IconButton size="small" color="error" onClick={() => handleDeleteUploadLog(entry.id, entry.filename)}>
                                            <DeleteIcon sx={{ fontSize: 16 }} />
                                          </IconButton>
                                        </Tooltip>
                                      ) : (
                                        <Typography variant="caption" color="text.secondary">-</Typography>
                                      )}
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>

                        {uploadHistoryTotal > 20 && (
                          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <Pagination
                              count={Math.ceil(uploadHistoryTotal / 20)}
                              page={uploadHistoryPage}
                              onChange={(_, p) => { setUploadHistoryPage(p); }}
                              size="small"
                              color="primary"
                            />
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                )}

                {/* Tab 4: Deleted Records (Trash) */}
                {actualTabIndex === 3 && (
                  <Box sx={{
                    p: 2, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'transparent !important',
                      boxShadow: 'none !important',
                      '&:hover': { bgcolor: 'transparent !important' },
                      '&.Mui-focused': { bgcolor: 'transparent !important', boxShadow: 'none !important' },
                    },
                    '& .MuiOutlinedInput-input': {
                      background: 'transparent !important',
                    },
                    '& input[type="date"], & .MuiOutlinedInput-input[type="date"], & .MuiInputBase-input[type="date"]': {
                      background: 'transparent !important',
                      color: 'inherit !important',
                      WebkitAppearance: 'none !important',
                      MozAppearance: 'textfield !important',
                      appearance: 'none !important',
                      borderRadius: '6px !important',
                      padding: '0 6px !important',
                    },
                    '& input[type="date"]::-webkit-datetime-edit, & input[type="date"]::-webkit-datetime-edit-text, & input[type="date"]::-webkit-datetime-edit-month-field, & input[type="date"]::-webkit-datetime-edit-day-field, & input[type="date"]::-webkit-datetime-edit-year-field': {
                      background: 'transparent !important',
                      color: 'inherit !important',
                    },
                    '& input[type="date"]::-webkit-calendar-picker-indicator': {
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      background: 'transparent',
                      padding: 0,
                      margin: 0,
                    },
                    '& input:-webkit-autofill': {
                      WebkitBoxShadow: '0 0 0 1000px transparent inset',
                      boxShadow: '0 0 0 1000px transparent inset',
                      WebkitTextFillColor: 'inherit',
                    },
                  }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="h6" fontWeight={700}>
                          🗑️ Deleted Records
                        </Typography>
                        {deletedRecordsTotal > 0 && (
                          <Chip label={formatNumber(deletedRecordsTotal)} size="small" color="error" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }} />
                        )}
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <TextField
                          size="small"
                          placeholder="Search deleted..."
                          value={deletedSearch}
                          onChange={(e) => { setDeletedSearch(e.target.value); setDeletedRecordsPage(1); }}
                          sx={{ width: 200, '& .MuiOutlinedInput-root': { height: 32, fontSize: '0.8rem' } }}
                        />
                        {deletedRecordsTotal > 0 && (
                          <Button size="small" variant="contained" color="error" startIcon={<DeleteSweepIcon />} onClick={handlePurgeAll}>
                            Purge All
                          </Button>
                        )}
                        <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={loadDeletedRecords} disabled={deletedRecordsLoading}>
                          Refresh
                        </Button>
                      </Stack>
                    </Stack>

                    {deletedRecordsLoading && <LinearProgress sx={{ mb: 2 }} />}

                    {deletedRecords.length === 0 && !deletedRecordsLoading ? (
                      <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc' }}>
                        <DeleteIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
                        <Typography color="text.secondary">No deleted records</Typography>
                        <Typography variant="caption" color="text.secondary">Soft-deleted records will appear here</Typography>
                      </Paper>
                    ) : (
                      <>
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, flex: 1, overflow: 'auto' }}>
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#fef2f2' }}>WSN</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#fef2f2' }}>WID</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#fef2f2' }}>Product</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#fef2f2' }}>Batch</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#fef2f2' }}>Deleted At</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#fef2f2' }}>Deleted By</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: '#fef2f2' }} align="right">Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {deletedRecords.map((record: any) => (
                                <TableRow key={record.id} hover>
                                  <TableCell>
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 600 }}>
                                      {record.wsn}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>{record.wid || '-'}</Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Tooltip title={record.product_title || ''}>
                                      <Typography variant="caption" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', fontSize: '0.7rem' }}>
                                        {record.product_title || '-'}
                                      </Typography>
                                    </Tooltip>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                      {record.batch_id}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                      {formatDateToIST(record.deleted_at)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                      {record.deleted_by || '-'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Tooltip title="Permanently delete">
                                      <IconButton size="small" color="error" onClick={() => handlePurgeRecord(record.id, record.wsn)}>
                                        <DeleteIcon sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>

                        {deletedRecordsTotal > 50 && (
                          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <Pagination
                              count={Math.ceil(deletedRecordsTotal / 50)}
                              page={deletedRecordsPage}
                              onChange={(_, p) => setDeletedRecordsPage(p)}
                              size="small"
                              color="primary"
                            />
                          </Box>
                        )}

                        <Box sx={{ mt: 1, textAlign: 'right' }}>
                          <Typography variant="caption" color="text.secondary">
                            {deletedRecordsTotal} deleted record{deletedRecordsTotal !== 1 ? 's' : ''}
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Box>
                )}

                {/* Tab 5: Snapshots */}
                {actualTabIndex === 4 && (
                  <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Typography variant="h6" fontWeight={700}>
                        📸 Batch Snapshots
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="outlined" color="warning" onClick={handleCleanupStale}>
                          🧹 Cleanup Stale
                        </Button>
                        <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={loadSnapshots} disabled={snapshotsLoading}>
                          Refresh
                        </Button>
                      </Stack>
                    </Stack>

                    {snapshotsLoading && <LinearProgress sx={{ mb: 2 }} />}

                    {snapshots.length === 0 && !snapshotsLoading ? (
                      <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc' }}>
                        <HistoryIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
                        <Typography color="text.secondary">No active snapshots</Typography>
                        <Typography variant="caption" color="text.secondary">Snapshots are created automatically before batch deletions and expire after 90 days</Typography>
                      </Paper>
                    ) : (
                      <>
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ bgcolor: '#f0f9ff' }}>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Batch ID</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }} align="right">Records</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Size</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Reason</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Created</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Expires</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }} align="right">Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {snapshots.map((snap: any) => (
                                <TableRow key={snap.id} hover>
                                  <TableCell>
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 600 }}>
                                      {snap.batchId}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="caption" fontWeight={600}>{formatNumber(snap.recordCount)}</Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                      {snap.snapshotSizeBytes ? `${(snap.snapshotSizeBytes / 1024 / 1024).toFixed(2)} MB` : '-'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      label={snap.reason}
                                      size="small"
                                      color={snap.reason === 'pre_delete' ? 'warning' : 'info'}
                                      sx={{ height: 20, fontSize: '0.65rem' }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                      {formatDateToIST(snap.createdAt)}
                                    </Typography>
                                    {snap.createdByName && (
                                      <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                                        by {snap.createdByName}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                      {formatDateToIST(snap.expiresAt, 'date')}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    {snap.restored ? (
                                      <Chip label="Restored" size="small" color="success" sx={{ height: 20, fontSize: '0.65rem' }} />
                                    ) : (
                                      <Chip label="Available" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                    )}
                                  </TableCell>
                                  <TableCell align="right">
                                    {!snap.restored && (
                                      <Button
                                        size="small"
                                        variant="contained"
                                        color="success"
                                        onClick={() => handleRestoreBatch(snap.batchId)}
                                        disabled={restoringBatchId === snap.batchId}
                                        sx={{ height: 26, fontSize: '0.7rem', textTransform: 'none' }}
                                      >
                                        {restoringBatchId === snap.batchId ? 'Restoring...' : '♻️ Restore'}
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>

                        {snapshotsTotal > 20 && (
                          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <Pagination
                              count={Math.ceil(snapshotsTotal / 20)}
                              page={snapshotsPage}
                              onChange={(_, p) => setSnapshotsPage(p)}
                              size="small"
                              color="primary"
                            />
                          </Box>
                        )}

                        <Box sx={{ mt: 1, textAlign: 'right' }}>
                          <Typography variant="caption" color="text.secondary">
                            {snapshotsTotal} snapshot{snapshotsTotal !== 1 ? 's' : ''} · Snapshots expire after 90 days
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Box>
                )}
              </Box>
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
              setDuplicateStrategy('skip');
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

              {/* Duplicate Strategy Selector */}
              <FormControl fullWidth size="small">
                <InputLabel id="duplicate-strategy-label">Duplicate Handling</InputLabel>
                <Select
                  labelId="duplicate-strategy-label"
                  value={duplicateStrategy}
                  label="Duplicate Handling"
                  onChange={(e) => setDuplicateStrategy(e.target.value as 'skip' | 'update' | 'replace')}
                >
                  <MenuItem value="skip">
                    <Stack>
                      <Typography variant="body2" fontWeight={600}>Skip Duplicates</Typography>
                      <Typography variant="caption" color="text.secondary">Existing WSNs are ignored — only new records inserted</Typography>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="update">
                    <Stack>
                      <Typography variant="body2" fontWeight={600}>Update Duplicates</Typography>
                      <Typography variant="caption" color="text.secondary">Overwrite all columns for existing WSNs with new data</Typography>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="replace">
                    <Stack>
                      <Typography variant="body2" fontWeight={600}>Replace (Soft-Delete + Re-insert)</Typography>
                      <Typography variant="caption" color="text.secondary">Old records archived, fresh insert — full audit trail</Typography>
                    </Stack>
                  </MenuItem>
                </Select>
              </FormControl>

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
                setDuplicateStrategy('skip');
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
                    <Chip size="small" label="🔍 All Data" sx={{ bgcolor: '#fee2e2', color: '#dc2626' }} />
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

        {/* ================= OPTIONS PANEL DRAWER ================= */}
        <Drawer
          anchor="right"
          open={optionsPanelOpen}
          onClose={() => setOptionsPanelOpen(false)}
          PaperProps={{
            sx: {
              width: { xs: '85%', sm: 380 },
              maxWidth: '100vw',
              bgcolor: isDarkMode ? '#1e293b' : '#ffffff',
              borderLeft: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0'
            }
          }}
        >
          {/* Panel Header */}
          <Box sx={{
            p: 2,
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>🔍 Options</Typography>
            <IconButton size="small" onClick={() => setOptionsPanelOpen(false)} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Panel Content with Accordions */}
          <Box sx={{ overflow: 'auto', flex: 1 }}>

            {/* ═══════════ FILTERS ACCORDION ═══════════ */}
            <Accordion
              expanded={optionsPanelExpanded === 'filters'}
              onChange={(_, isExpanded) => setOptionsPanelExpanded(isExpanded ? 'filters' : false)}
              disableGutters
              sx={{
                bgcolor: 'transparent',
                boxShadow: 'none',
                '&:before': { display: 'none' },
                borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0'
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: isDarkMode ? '#94a3b8' : '#64748b' }} />}
                sx={{
                  px: 2,
                  minHeight: 56,
                  '&.Mui-expanded': { minHeight: 56 },
                  '& .MuiAccordionSummary-content': { my: 1.5 }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <FilterListIcon sx={{ color: '#3b82f6', fontSize: 22 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>Filters</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                      {filtersActive ? 'Active filters applied' : 'No filters applied'}
                    </Typography>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                <Stack spacing={1.5}>
                  {/* Batch ID Filter */}
                  <TextField
                    select
                    size="small"
                    label="Batch ID"
                    value={filterBatchId}
                    onChange={(e) => { setFilterBatchId(e.target.value); setPage(0); }}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        height: 40,
                        bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                      }
                    }}
                  >
                    <MenuItem value="">All Batches</MenuItem>
                    {batches.map(b => (
                      <MenuItem key={b.batch_id} value={b.batch_id}>{b.batch_id} ({formatNumber(b.count)})</MenuItem>
                    ))}
                  </TextField>

                  {/* Status Filter */}
                  <TextField
                    select
                    size="small"
                    label="Status"
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        height: 40,
                        bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                      }
                    }}
                  >
                    <MenuItem value="All">All Status</MenuItem>
                    <MenuItem value="Received">✅ Received</MenuItem>
                    <MenuItem value="Receiving">🔄 Receiving</MenuItem>
                    <MenuItem value="Rejected">🚫 Rejected</MenuItem>
                    <MenuItem value="Pending">❌ Pending</MenuItem>
                  </TextField>

                  {/* Brand Filter */}
                  <TextField
                    select
                    size="small"
                    label="Brand"
                    value={filterBrand}
                    onChange={(e) => { setFilterBrand(e.target.value); setPage(0); }}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        height: 40,
                        bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                      }
                    }}
                  >
                    <MenuItem value="">All Brands</MenuItem>
                    {brandOptions.map(brand => (
                      <MenuItem key={brand} value={brand}>{brand}</MenuItem>
                    ))}
                  </TextField>

                  {/* Category Filter */}
                  <TextField
                    select
                    size="small"
                    label="Category"
                    value={filterCategory}
                    onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        height: 40,
                        bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
                      }
                    }}
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    {categoryOptions.map(category => (
                      <MenuItem key={category} value={category}>{category}</MenuItem>
                    ))}
                  </TextField>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* ═══════════ COLUMNS ACCORDION ═══════════ */}
            {canSeeButton('columns') && (
              <Accordion
                expanded={optionsPanelExpanded === 'columns'}
                onChange={(_, isExpanded) => setOptionsPanelExpanded(isExpanded ? 'columns' : false)}
                disableGutters
                sx={{
                  bgcolor: 'transparent',
                  boxShadow: 'none',
                  '&:before': { display: 'none' },
                  borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0'
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon sx={{ color: isDarkMode ? '#94a3b8' : '#64748b' }} />}
                  sx={{
                    px: 2,
                    minHeight: 56,
                    '&.Mui-expanded': { minHeight: 56 },
                    '& .MuiAccordionSummary-content': { my: 1.5 }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <ViewColumnIcon sx={{ color: '#10b981', fontSize: 22 }} />
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>Columns</Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                        {Object.values(columnVisibility).filter(Boolean).length} of {columns.length} visible
                      </Typography>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                  {!canAccessButton('columns') ? (
                    <Paper sx={{ p: 1.5, bgcolor: '#fef3c7', border: '1px solid #fbbf24' }}>
                      <Typography sx={{ fontSize: '0.8rem', color: '#92400e' }}>
                        You don't have permission to manage columns
                      </Typography>
                    </Paper>
                  ) : (
                    <Box sx={{ maxHeight: 280, overflow: 'auto', pr: 1 }}>
                      <Stack spacing={0.5}>
                        {columns.map((col) => (
                          <FormControlLabel
                            key={col.id}
                            control={
                              <Checkbox
                                size="small"
                                checked={columnVisibility[col.id as keyof typeof columnVisibility] || false}
                                onChange={() => {
                                  setColumnVisibility((prev) => {
                                    const newVisibility = { ...prev, [col.id]: !prev[col.id as keyof typeof prev] };
                                    // Update AG Grid column visibility
                                    if (gridRef.current) {
                                      gridRef.current.setColumnsVisible([col.id], !prev[col.id as keyof typeof prev]);
                                    }
                                    return newVisibility;
                                  });
                                }}
                                sx={{ py: 0.25, '&.Mui-checked': { color: '#10b981' } }}
                              />
                            }
                            label={
                              <Typography sx={{ fontSize: '0.8rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                                {col.label}
                              </Typography>
                            }
                            sx={{ m: 0 }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            )}

            {/* ═══════════ GRID SETTINGS ACCORDION ═══════════ */}
            <Accordion
              expanded={optionsPanelExpanded === 'grid'}
              onChange={(_, isExpanded) => setOptionsPanelExpanded(isExpanded ? 'grid' : false)}
              disableGutters
              sx={{
                bgcolor: 'transparent',
                boxShadow: 'none',
                '&:before': { display: 'none' },
                borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0'
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: isDarkMode ? '#94a3b8' : '#64748b' }} />}
                sx={{
                  px: 2,
                  minHeight: 56,
                  '&.Mui-expanded': { minHeight: 56 },
                  '& .MuiAccordionSummary-content': { my: 1.5 }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <TableChartIcon sx={{ color: '#f59e0b', fontSize: 22 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>Grid Settings</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Sorting, filtering, resize</Typography>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                <Stack spacing={1.5}>
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
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>⬆️ Enable Sorting</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Click headers to sort</Typography>
                      </Box>
                    }
                  />
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
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>🔍 Enable Filtering</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Filter in column headers</Typography>
                      </Box>
                    }
                  />
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
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: isDarkMode ? '#e2e8f0' : '#334155' }}>↔️ Column Resize</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: isDarkMode ? '#64748b' : '#94a3b8' }}>Drag borders to resize</Typography>
                      </Box>
                    }
                  />
                  <Button
                    size="small"
                    onClick={() => {
                      setEnableSorting(true);
                      setEnableColumnFilters(true);
                      setEnableColumnResize(true);
                      toast.success('Grid settings reset');
                    }}
                    sx={{ alignSelf: 'flex-start', fontSize: '0.75rem', color: isDarkMode ? '#94a3b8' : '#64748b' }}
                  >
                    🔄 Reset to Default
                  </Button>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* ═══════════ ACTIONS SECTION ═══════════ */}
            <Box sx={{ p: 2, borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: isDarkMode ? '#94a3b8' : '#64748b', mb: 1.5, textTransform: 'uppercase' }}>
                Actions
              </Typography>
              <Stack spacing={1}>
                {/* Add Product Button */}
                {canSeeButton('add') && (
                  <Tooltip title={!canAccessButton('add') ? "You don't have permission to use this feature" : ""} arrow>
                    <span style={{ width: '100%' }}>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<AddIcon />}
                        disabled={!canAccessButton('add')}
                        onClick={() => {
                          if (!canAccessButton('add')) return;
                          handleOpenAddDialog();
                          setOptionsPanelOpen(false);
                        }}
                        sx={{
                          height: 44,
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          fontWeight: 600,
                          '&:hover': { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' },
                          '&.Mui-disabled': { background: '#94a3b8' }
                        }}
                      >
                        Add Product
                      </Button>
                    </span>
                  </Tooltip>
                )}

                {/* Upload Button */}
                {canSeeButton('upload') && (
                  <Tooltip title={!canAccessButton('upload') ? "You don't have permission to use this feature" : ""} arrow>
                    <span style={{ width: '100%' }}>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<UploadIcon />}
                        disabled={!canAccessButton('upload')}
                        onClick={() => {
                          if (!canAccessButton('upload')) return;
                          setUploadDialogOpen(true);
                          setOptionsPanelOpen(false);
                        }}
                        sx={{
                          height: 44,
                          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                          fontWeight: 600,
                          '&:hover': { background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' },
                          '&.Mui-disabled': { background: '#94a3b8' }
                        }}
                      >
                        Upload Products
                      </Button>
                    </span>
                  </Tooltip>
                )}

                {/* Export Button */}
                {canSeeButton('export') && (
                  <Tooltip title={!canAccessButton('export') ? "You don't have permission to use this feature" : ""} arrow>
                    <span style={{ width: '100%' }}>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        disabled={!canAccessButton('export')}
                        onClick={() => {
                          if (!canAccessButton('export')) return;
                          setExportDialogOpen(true);
                          setOptionsPanelOpen(false);
                        }}
                        sx={{
                          height: 44,
                          background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                          fontWeight: 600,
                          '&:hover': { background: 'linear-gradient(135deg, #6d28d9 0%, #9333ea 100%)' },
                          '&.Mui-disabled': { background: '#94a3b8' }
                        }}
                      >
                        Export to Excel
                      </Button>
                    </span>
                  </Tooltip>
                )}

                {/* Download Template Button */}
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() => {
                    handleDownloadTemplate();
                    setOptionsPanelOpen(false);
                  }}
                  sx={{
                    height: 44,
                    fontWeight: 600,
                    borderColor: isDarkMode ? '#64748b' : '#94a3b8',
                    color: isDarkMode ? '#94a3b8' : '#475569',
                    '&:hover': { borderColor: isDarkMode ? '#94a3b8' : '#64748b', bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc' }
                  }}
                >
                  Download Template
                </Button>

                {/* Refresh Data Button */}
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
                  disabled={refreshing}
                  onClick={() => {
                    loadMasterData({ buttonRefresh: true });
                    setOptionsPanelOpen(false);
                  }}
                  sx={{
                    height: 44,
                    fontWeight: 600,
                    borderColor: '#3b82f6',
                    color: '#3b82f6',
                    '&:hover': { borderColor: '#2563eb', bgcolor: 'rgba(59, 130, 246, 0.08)' }
                  }}
                >
                  {refreshing ? 'Refreshing...' : 'Refresh Data'}
                </Button>

                {/* Reset All Filters Button - Only show when filters are active */}
                {filtersActive && (
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<FilterListIcon />}
                    onClick={() => {
                      resetFilters();
                      setOptionsPanelOpen(false);
                    }}
                    sx={{
                      height: 44,
                      fontWeight: 600,
                      borderColor: '#f59e0b',
                      color: '#f59e0b',
                      '&:hover': { borderColor: '#d97706', bgcolor: 'rgba(245, 158, 11, 0.08)' }
                    }}
                  >
                    Reset All Filters
                  </Button>
                )}
              </Stack>
            </Box>
          </Box>
        </Drawer>
      </Box>
    </AppLayout >
  );
}
