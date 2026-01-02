'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Stack,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  Select,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Divider,
  Card,
  CardContent,
  useMediaQuery,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
  CheckCircle,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { qcAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { debounce } from 'lodash';
import { Tooltip } from '@mui/material';

// Register AG Grid modules ONCE
ModuleRegistry.registerModules([AllCommunityModule]);

let QC_GRADES = ['A', 'B', 'C', 'D'];
const QC_STATUSES = ['Pending', 'Done', 'Pass', 'Fail', 'Hold'];

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${yy}`;
};

const ALL_LIST_COLUMNS = [
  'wsn',
  'product_title',
  'brand',
  'cms_vertical',
  'mrp',
  'fsp',
  'inbound_date',
  'vehicle_no',
  'qc_date',
  'qc_by_name',
  'qc_grade',
  'qc_status',
  'qc_remarks',
  'updated_by_name',
  'updated_at',
];

const ALL_MULTI_COLUMNS = [
  'sno',
  'wsn',
  'productserialnumber',
  'rackno',
  'qcgrade',
  'qcremarks',
  'otherremarks',
  // Master data
  'fsn',
  'producttitle',
  'brand',
  'cmsvertical',
  'hsnsac',
  'igstrate',
  'mrp',
  'fsp',
  'vrp',
  'yieldvalue',
  'ptype',
  'psize',
  'fktlink',
  'whlocation',
  'orderid',
  'fkqcremark',
  'fkgrade',
  'invoicedate',
];

// Constants
const DEFAULT_MULTI_COLUMNS = [
  'sno',
  'wsn',
  'product_serial_number',
  'rack_no',
  'qc_grade',
  'qc_remarks',
  'other_remarks',
];

const ALL_MASTER_COLUMNS = [
  'fsn',
  'producttitle',
  'brand',
  'cmsvertical',
  'hsnsac',
  'igstrate',
  'mrp',
  'fsp',
  'vrp',
  'yieldvalue',
  'ptype',
  'psize',
  'fktlink',
  'whlocation',
  'orderid',
  'fkqcremark',
  'fkgrade',
  'invoicedate',
];

const EDITABLE_COLUMNS = ['wsn', 'product_serial_number', 'rack_no', 'qc_grade', 'qc_remarks', 'other_remarks'];

interface QCItem {
  id: number;
  [key: string]: any;
}

interface Rack {
  id: number;
  rack_name: string;
}

interface StatsType {
  pending: number;
  pass: number;
  fail: number;
  hold: number;
  done: number;
  total: number;
}

interface BulkProgressType {
  show: boolean;
  processed: number;
  total: number;
  successCount: number;
  errorCount: number;
  batchId: string;
}

interface Batch {
  batch_id: string;
  count: number;
  created_at: string;
  status: string;
}

export default function QCPage() {
  // Role guard - only admin, manager, qc can access
  useRoleGuard(['admin', 'manager', 'qc']);

  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const isMobile = useMediaQuery('(max-width:600px)');
  const [user, setUser] = useState<any>(null);
  const [tabValue, setTabValue] = useState(0);

  // QC LIST STATE
  const [qcList, setQcList] = useState<QCItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  // Local refresh button state (non-blocking)
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Whether any filter is active (shows green dot on Filters button)
  const filtersActive = Boolean(
    (searchFilter && searchFilter.trim() !== '') ||
    (statusFilter && statusFilter !== '') ||
    (gradeFilter && gradeFilter !== '') ||
    (brandFilter && brandFilter !== '') ||
    (categoryFilter && categoryFilter !== '') ||
    (dateFromFilter && dateFromFilter !== '') ||
    (dateToFilter && dateToFilter !== '')
  );

  type ColumnConfig = {
    key: string;
    visible: boolean;
  };

  const DEFAULT_LIST_COLUMNS: ColumnConfig[] = ALL_LIST_COLUMNS.map(col => ({
    key: col,
    visible: true,
  }));

  const [listColumns, setListColumns] = useState<ColumnConfig[]>([]);

  const [listColumnSettingsOpen, setListColumnSettingsOpen] = useState(false);

  // SINGLE ENTRY STATE
  const [singleWSN, setSingleWSN] = useState('');
  const [singleProduct, setSingleProduct] = useState({
    fsn: '',
    product_title: '',
    brand: '',
    cms_vertical: '',
    mrp: '',
    fsp: '',
    fkt_link: '',
  });
  const [singleForm, setSingleForm] = useState({
    qc_date: new Date().toISOString().split('T')[0],
    qc_by_name: '',
    qc_grade: '',
    qc_remarks: '',
    other_remarks: '',
    product_serial_number: '',
    rack_no: '',
  });
  const [singleLoading, setSingleLoading] = useState(false);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [duplicateQC, setDuplicateQC] = useState<any>(null);

  // BULK UPLOAD STATE
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgressType>({
    show: false,
    processed: 0,
    total: 0,
    successCount: 0,
    errorCount: 0,
    batchId: '',
  });

  // ✅ ADD THIS - Template download confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);

  // MULTI ENTRY STATE
  const generateEmptyRows = (count: number) => {
    return Array.from({ length: count }, () => ({
      wsn: '',
      qcdate: new Date().toISOString().split('T')[0],
      qcbyname: '',
      productserialnumber: '',
      rackno: '',
      qcgrade: '',
      qcremarks: '',
      otherremarks: '',
      // Master data fields
      fsn: '',
      producttitle: '',
      brand: '',
      cmsvertical: '',
      hsnsac: '',
      igstrate: '',
      mrp: '',
      fsp: '',
      vrp: '',
      yieldvalue: '',
      ptype: '',
      psize: '',
      fktlink: '',
      whlocation: '',
      orderid: '',
      fkqcremark: '',
      fkgrade: '',
      invoicedate: '',
    }));
  };


  const [multiRows, setMultiRows] = useState<any[]>(generateEmptyRows(50));
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiResults, setMultiResults] = useState<any[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [commonQcDate, setCommonQcDate] = useState('');
  const [commonQcByName, setCommonQcByName] = useState('');

  // Store objects with WSN + warehouse ID
  const [existingQCWSNs, setExistingQCWSNs] = useState<Array<{ wsn: string; warehouseid: number }>>([]);

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('qcMultiEntryColumns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // ✅ Always include 'sno' at the beginning
        if (!parsed.includes('sno')) {
          return ['sno', ...parsed];
        }
        return parsed;
      } catch (e) {
        return DEFAULT_MULTI_COLUMNS;
      }
    }
    return DEFAULT_MULTI_COLUMNS;
  });



  // Grid settings with localStorage
  const [gridSettings, setGridSettings] = useState({
    sortable: true,
    filter: true,
    resizable: true,
    editable: true,
  });

  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);

  // ✅ LOAD Grid Settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('qc_grid_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setGridSettings(parsed);
        console.log('✅ Grid settings loaded:', parsed);
      } catch (e) {
        console.log('Failed to parse grid settings');
      }
    }
  }, []);

  // ✅ SAVE to localStorage whenever settings change
  const updateGridSettings = (newSettings: typeof gridSettings) => {
    setGridSettings(newSettings);
    localStorage.setItem('qc_grid_settings', JSON.stringify(newSettings));
    console.log('💾 Grid settings saved:', newSettings);
  };


  // Fetch all existing QC'd WSNs on mount (for cross-warehouse checking)
  // ✅ Fetch existing QC WSNs with warehouse IDs
  useEffect(() => {
    async function fetchExistingWSNs() {
      try {
        const res = await qcAPI.getAllQCWSNs();
        // res.data is now: [{ wsn: "ABC", warehouseid: 1 }, ...]
        setExistingQCWSNs(res.data || []);
        console.log('✅ Existing QC WSNs loaded:', res.data);
      } catch (error) {
        console.error('Failed to fetch existing QC WSNs:', error);
      }
    }
    fetchExistingWSNs();
  }, []);


  // Set initial date on client side only (avoid hydration mismatch)
  useEffect(() => {
    if (!commonQcDate) {
      setCommonQcDate(new Date().toISOString().split('T')[0]);
    }
  }, []);



  // BATCH MANAGEMENT STATE
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // GRADE MANAGEMENT STATE
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [newGrade, setNewGrade] = useState('');
  const [editingGradeIndex, setEditingGradeIndex] = useState<number | null>(null);

  // FILTERS
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState<StatsType>({
    pending: 0,
    pass: 0,
    fail: 0,
    hold: 0,
    done: 0,
    total: 0,
  });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const [exportGrade, setExportGrade] = useState('');


  // AUTH CHECK
  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }

    setUser(storedUser);

    // ✅ AUTO-POPULATE QC BY NAME FROM LOGGED-IN USER
    const userName =
      (storedUser as any)?.full_name ||
      (storedUser as any)?.name ||
      (storedUser as any)?.username ||
      '';

    if (userName) {
      // Set single form
      setSingleForm((prev) => ({
        ...prev,
        qc_by_name: userName,
      }));

      // Set common QC by name for multi entry
      setCommonQcByName(userName);

      console.log('✅ QC By Name auto-populated:', userName);
    }
  }, [router]);

  // ✅ KEEP QC BY NAME UPDATED WHEN USER CHANGES
  useEffect(() => {
    if (!user) return;

    const userName =
      (user as any)?.full_name ||
      (user as any)?.name ||
      (user as any)?.username ||
      '';

    if (userName) {
      setSingleForm((prev) => ({
        ...prev,
        qc_by_name: userName,
      }));

      setCommonQcByName(userName);
    }
  }, [user]);

  // ✅ LOAD COLUMN SETTINGS FROM LOCALSTORAGE
  useEffect(() => {
    const saved = localStorage.getItem('qcMultiEntryColumns');

    if (saved) {
      try {
        const cols = JSON.parse(saved);
        setVisibleColumns(cols);
        return;
      } catch (e) {
        console.log('Column settings load error');
      }
    }

    setVisibleColumns(DEFAULT_MULTI_COLUMNS);
  }, []);

  // ✅ SAVE COLUMN SETTINGS
  const saveColumnSettings = (cols: string[]) => {
    setVisibleColumns(cols);
    localStorage.setItem('qcMultiEntryColumns', JSON.stringify(cols));
  };




  // ✅ NAVIGATE TO NEXT CELL (AG GRID)
  const navigateToNextCell = useCallback((params: any) => {
    const { previousCellPosition, nextCellPosition, key } = params;

    if (key === 'Enter') {
      const currentCol = previousCellPosition.column.getColId();
      const currentRow = previousCellPosition.rowIndex;

      if (currentCol === visibleColumns[visibleColumns.length - 1]) {
        // Last column → move to first column of next row
        return {
          rowIndex: currentRow + 1,
          column: params.api.getColumns()![0],
        };
      } else {
        // Same row, next column
        const colIndex = visibleColumns.indexOf(currentCol);
        const nextColId = visibleColumns[colIndex + 1];
        const nextCol = params.api.getColumns()!.find((c: any) => c.getColId() === nextColId);
        return {
          rowIndex: currentRow,
          column: nextCol,
        };
      }
    }

    return nextCellPosition;
  }, [visibleColumns]);


  // FETCH PRODUCT DETAILS FOR SINGLE ENTRY
  const fetchProductDetails = async (wsn: string) => {
    if (!wsn.trim()) {
      setSingleProduct({
        fsn: '',
        product_title: '',
        brand: '',
        cms_vertical: '',
        mrp: '',
        fsp: '',
        fkt_link: '',
      });
      return;
    }

    const upperWsn = wsn.trim().toUpperCase();

    try {
      // Try pending inbound first
      const pendingResponse = await qcAPI.getPendingInbound(activeWarehouse?.id, upperWsn);
      if (pendingResponse.data.length > 0) {
        const item = pendingResponse.data[0];
        setSingleProduct({
          fsn: item.fsn || '',
          product_title: item.product_title || '',
          brand: item.brand || '',
          cms_vertical: item.cms_vertical || '',
          mrp: item.mrp || '',
          fsp: item.fsp || '',
          fkt_link: item.fkt_link || '',
        });
        return;
      }

      // If not in pending, try QC list
      const listResponse = await qcAPI.getList(1, 1, {
        warehouseId: activeWarehouse?.id,
        search: upperWsn,
      });
      if (listResponse.data?.data?.length > 0) {
        const item = listResponse.data.data[0];
        setSingleProduct({
          fsn: item.fsn || '',
          product_title: item.product_title || '',
          brand: item.brand || '',
          cms_vertical: item.cms_vertical || '',
          mrp: item.mrp || '',
          fsp: item.fsp || '',
          fkt_link: item.fkt_link || '',
        });
        return;
      }

      // If not found, clear
      setSingleProduct({
        fsn: '',
        product_title: '',
        brand: '',
        cms_vertical: '',
        mrp: '',
        fsp: '',
        fkt_link: '',
      });
    } catch (error) {
      console.error('Failed to fetch product details:', error);
      setSingleProduct({
        fsn: '',
        product_title: '',
        brand: '',
        cms_vertical: '',
        mrp: '',
        fsp: '',
        fkt_link: '',
      });
    }
  };

  // LOAD DATA
  useEffect(() => {
    if (!activeWarehouse) return;

    // Debug log
    console.log('🔍 Search Filter Changed:', searchFilter);

    if (tabValue === 0) {
      loadQCList();
      loadStats();
    } else if (tabValue === 1) {
      loadRacks();
    } else if (tabValue === 3) {
      loadRacks();
    } else if (tabValue === 4) {
      loadBatches();
      loadStats();
    }
    loadBrands();
    loadCategories();
  }, [
    activeWarehouse,
    tabValue,
    page,
    limit,
    searchFilter,
    statusFilter,
    gradeFilter,
    brandFilter,
    categoryFilter,
    dateFromFilter,
    dateToFilter,
  ]);


  // Add localStorage management for listColumns
  useEffect(() => {
    const saved = localStorage.getItem('qc_list_columns');
    if (saved) {
      setListColumns(JSON.parse(saved));
    } else {
      setListColumns(DEFAULT_LIST_COLUMNS);
    }
  }, []);


  // Save to localStorage when columns change
  const handleListColumnToggle = (key: string) => {
    const updated = listColumns.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    );

    setListColumns(updated);
    localStorage.setItem('qc_list_columns', JSON.stringify(updated));
  };

  // LOAD FUNCTIONS
  const loadQCList = async ({ buttonRefresh = false } = {}) => {
    if (buttonRefresh) {
      setRefreshing(true);
      setRefreshSuccess(false);
    } else {
      setListLoading(true);
    }

    try {
      console.log('📡 API Call with search:', searchFilter); // ADD THIS DEBUG
      const response = await qcAPI.getList(page, limit, {
        warehouseId: activeWarehouse?.id,
        search: searchFilter,  // ✅ VERIFY THIS LINE EXISTS
        qcStatus: statusFilter,
        qc_grade: gradeFilter,
        brand: brandFilter,
        category: categoryFilter,
        dateFrom: dateFromFilter,
        dateTo: dateToFilter,
      });
      setQcList(response.data?.data || []);
      setTotal(response.data?.total || 0);

      if (buttonRefresh) {
        toast.success('✓ List refreshed');
        setRefreshSuccess(true);
        setTimeout(() => setRefreshSuccess(false), 1800);
      }
    } catch (error) {
      if (buttonRefresh) toast.error('Failed to refresh QC list');
      else toast.error('Failed to load QC list');
    } finally {
      if (buttonRefresh) setRefreshing(false);
      else setListLoading(false);
    }
  };


  const loadStats = async () => {
    try {
      const response = await qcAPI.getStats(activeWarehouse?.id);
      setStats(response.data || {
        pending: 0,
        pass: 0,
        fail: 0,
        hold: 0,
        done: 0,
        total: 0,
      });
    } catch (error) {
      console.error('Stats error:', error);
    }
  };

  const loadBrands = async () => {
    try {
      const response = await qcAPI.getBrands(activeWarehouse?.id);
      setBrands(response.data || []);
    } catch (error) {
      console.error('Brands error:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await qcAPI.getCategories(activeWarehouse?.id);
      setCategories(response.data || []);
    } catch (error) {
      console.error('Categories error:', error);
    }
  };

  const loadRacks = async () => {
    try {
      const response = await qcAPI.getWarehouseRacks(activeWarehouse?.id);
      setRacks(response.data || []);
    } catch (error) {
      console.error('Racks error:', error);
    }
  };

  const loadBatches = async () => {
    setBatchLoading(true);
    try {
      const response = await qcAPI.getBatches(activeWarehouse?.id);
      setBatches(response.data || []);
    } catch (error) {
      toast.error('Failed to load batches');
    } finally {
      setBatchLoading(false);
    }
  };

  // GRADE MANAGEMENT
  const handleAddGrade = () => {
    if (!newGrade.trim()) {
      toast.error('Grade name is required');
      return;
    }

    if (editingGradeIndex !== null) {
      // Edit existing grade
      const updatedGrades = [...QC_GRADES];
      updatedGrades[editingGradeIndex] = newGrade.toUpperCase();
      QC_GRADES = updatedGrades;
      toast.success(`✓ Grade updated to ${newGrade}`);
      setEditingGradeIndex(null);
    } else {
      // Add new grade
      if (QC_GRADES.includes(newGrade.toUpperCase())) {
        toast.error('Grade already exists');
        return;
      }
      QC_GRADES = [...QC_GRADES, newGrade.toUpperCase()];
      toast.success(`✓ Grade ${newGrade} added`);
    }

    setNewGrade('');
    setGradeDialogOpen(false);
  };

  const handleDeleteGrade = (index: number) => {
    if (QC_GRADES.length <= 1) {
      toast.error('At least one grade must exist');
      return;
    }
    const deletedGrade = QC_GRADES[index];
    QC_GRADES = QC_GRADES.filter((_, i) => i !== index);
    toast.success(`✓ Grade ${deletedGrade} deleted`);
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm('Delete entire batch?')) return;
    try {
      await qcAPI.deleteBatch(batchId);
      toast.success('✓ Batch deleted');
      loadBatches();
      loadStats();
    } catch (error) {
      toast.error('Failed to delete batch');
    }
  };

  // TAB 1: SINGLE ENTRY ACTIONS
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleWSN.trim()) {
      toast.error('WSN is required');
      return;
    }
    if (!singleForm.qc_by_name.trim()) {
      toast.error('QC By Name is required');
      return;
    }

    setSingleLoading(true);
    try {
      await qcAPI.createEntry({
        wsn: singleWSN,
        ...singleForm,
        warehouse_id: activeWarehouse?.id,
        update_existing: duplicateQC ? true : false,
      });
      toast.success('✓ QC entry created');
      setSingleWSN('');
      setDuplicateQC(null);

      // Clear product details
      setSingleProduct({
        fsn: '',
        product_title: '',
        brand: '',
        cms_vertical: '',
        mrp: '',
        fsp: '',
        fkt_link: '',
      });

      const userName = (user as any)?.full_name || (user as any)?.name || (user as any)?.username || '';

      setSingleForm({
        qc_date: new Date().toISOString().split('T')[0],
        qc_by_name: userName,  // ← Auto-fills again
        qc_grade: '',
        qc_remarks: '',
        other_remarks: '',
        product_serial_number: '',
        rack_no: '',
      });

      loadQCList();
      loadStats();
    } catch (error: any) {
      if (error.response?.status === 409) {
        const data = error.response.data;
        if (data.canUpdate === false) {
          toast.error('WSN already exists in another warehouse - cannot update');
          setDuplicateQC(null);
        } else {
          setDuplicateQC(data);
          toast.error('Duplicate QC in this warehouse - Click "Update" to modify');
        }
      } else {
        toast.error(error.response?.data?.error || 'Failed to create');
      }
    } finally {
      setSingleLoading(false);
    }
  };

  // TAB 2: BULK UPLOAD ACTIONS
  const handleBulkUpload = async () => {
    if (!bulkFile) {
      toast.error('Please select a file');
      return;
    }

    setBulkLoading(true);
    try {
      const response = await qcAPI.bulkUpload(bulkFile, activeWarehouse?.id);
      setBulkProgress({
        show: true,
        processed: 0,
        total: response.data?.totalRows || 0,
        successCount: 0,
        errorCount: 0,
        batchId: response.data?.batchId || '',
      });
      toast.success(`Upload started! Processing ${response.data?.totalRows || 0} rows...`);
      setBulkFile(null);

      setTimeout(() => {
        loadQCList();
        loadStats();
        loadBatches();  // ← ADD THIS LINE
        setBulkProgress((prev) => ({ ...prev, show: false }));
      }, 3000);


    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Upload failed');
    } finally {
      setBulkLoading(false);
    }
  };

  // ✅ NEW - Opens confirmation dialog first
  const downloadBulkTemplate = () => {
    setConfirmOpen(true); // Open dialog instead of direct download
  };

  // ✅ ADD THIS - Actual download after confirmation
  const handleConfirmDownload = () => {
    const template = [
      {
        WSN: 'ABC123A',
        QCBYNAME: 'John Doe',
        QCDATE: new Date().toISOString().split('T')[0],
        GRADE: 'A',
        QCREMARKS: 'All checks passed',
        OTHERREMARKS: 'Package condition good',
        PRODUCTSERIALNUMBER: 'SN12345',
        RACKNO: 'A-01',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'QCBulkTemplate.xlsx');
    toast.success('Template downloaded');
    setConfirmOpen(false); // Close dialog
  };


  // TAB 3: MULTI ENTRY ACTIONS
  const addMultiRow = () => {
    setMultiRows([...multiRows, ...generateEmptyRows(10)]);
  };

  const add30Rows = () => {
    setMultiRows([...multiRows, ...generateEmptyRows(30)]);
  };

  // Column widths matching inbound page
  const COLUMN_WIDTHS: Record<string, any> = {
    // Editable columns
    sno: { width: 50 },
    wsn: { width: 80 },
    productserialnumber: { width: 160 },
    rackno: { width: 80 },
    qcgrade: { width: 80 },
    qcremarks: { flex: 1, minWidth: 90 },
    otherremarks: { flex: 1, minWidth: 100 },

    // Master data columns (read-only)
    fsn: { width: 100 },
    producttitle: { flex: 2, minWidth: 220 },
    brand: { width: 90 },
    cmsvertical: { width: 100 },
    hsnsac: { width: 80 },
    igstrate: { width: 70 },
    mrp: { width: 60 },
    fsp: { width: 60 },
    vrp: { width: 60 },
    yieldvalue: { width: 70 },
    ptype: { width: 100 },
    psize: { width: 80 },
    fktlink: { width: 80 },
    whlocation: { width: 100 },
    orderid: { width: 100 },
    fkqcremark: { width: 120 },
    fkgrade: { width: 70 },
    invoicedate: { width: 90 },
  };

  const handleMultiSubmit = async () => {
    const validRows = multiRows.filter((r) => r.wsn?.trim());
    if (validRows.length === 0) {
      toast.error('At least 1 WSN required');
      return;
    }

    if (!commonQcByName.trim()) {
      toast.error('QC By Name is required');
      return;
    }

    const fixedRows = validRows.map((row) => ({
      ...row,
      qc_date: commonQcDate,
      qc_by_name: commonQcByName,
    }));

    setMultiLoading(true);
    try {
      const response = await qcAPI.multiEntry({
        entries: fixedRows,
        warehouse_id: activeWarehouse?.id,
      });

      setMultiResults(response.data?.results || []);
      toast.success(`✓ ${response.data?.successCount || 0} entries created`);

      // Reset rows
      setMultiRows(generateEmptyRows(10));


      loadQCList();
      loadStats();
      loadBatches();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Submission failed');
    } finally {
      setMultiLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await qcAPI.exportData({
        warehouseId: activeWarehouse?.id,
        dateFrom: exportStartDate,
        dateTo: exportEndDate,
        qc_grade: exportGrade,
      });


      const exportData = response.data.data.map((item: any) => ({
        // QC
        WSN: item.wsn,
        'QC Date': formatDate(item.qc_date),
        'QC By': item.qc_by_name,
        'QC Grade': item.qc_grade,
        'QC Status': item.qc_status,
        'QC Remarks': item.qc_remarks,
        'Other Remarks': item.other_remarks,
        'QC Batch ID': item.batch_id,
        'QC Updated By': item.updated_by_name,
        'QC Updated At': formatDate(item.updated_at),

        // MASTER DATA
        WID: item.wid,
        FSN: item.fsn,
        'Order ID': item.order_id,
        'FK QC Remark': item.fkqc_remark,
        'FK Grade': item.fk_grade,
        'Product Title': item.product_title,
        'HSN/SAC': item.hsn_sac,
        'IGST Rate': item.igst_rate,
        MRP: item.mrp,
        FSP: item.fsp,
        'Invoice Date': item.invoice_date,
        'FKT Link': item.fkt_link,
        'WH Location': item.wh_location,
        Brand: item.brand,
        Category: item.cms_vertical,
        VRP: item.vrp,
        Yield: item.yield_value,
        'Product Type': item.p_type,
        'Product Size': item.p_size,

        // INBOUND
        'Inbound Date': formatDate(item.inbound_date),
        'Vehicle No': item.vehicle_no,
        'Rack No': item.rack_no,
        'Product Serial No': item.product_serial_number,
      }));


      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'QC');
      const filename = `QC_${exportStartDate || 'all'}_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`✓ Exported ${exportData.length} records`);
      setExportDialogOpen(false);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleDeleteQCEntry = async (qcId: number) => {
    if (!confirm('Delete QC entry?')) return;
    try {
      await qcAPI.deleteEntry(qcId);
      toast.success('✓ Entry deleted');
      loadQCList();
      loadStats();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  if (!activeWarehouse) {
    return <AppLayout>⚠️ No warehouse selected</AppLayout>;
  }

  //////////////////////////////////====UI RENDERING====////////////////////////////////////
  return (
    <AppLayout>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: {
          background: '#363636', color: '#fff', borderRadius: '10px',
          padding: '16px', fontWeight: 600
        }, success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } }
      }} />

      <Box sx={{
        p: { xs: 0.75, md: 1 },
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
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
          borderRadius: 2,
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
              <Box sx={{
                p: { xs: 0.4, sm: 0.7 },
                bgcolor: 'rgba(255,255,255,0.2)',
                borderRadius: 1.5,
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Typography sx={{ fontSize: { xs: '1rem', sm: '1.5rem' }, lineHeight: 1 }}>✅</Typography>
              </Box>
              <Box>
                <Typography variant="h4" sx={{
                  fontWeight: 650,
                  color: 'white',
                  fontSize: { xs: '0.85rem', sm: '1rem', md: '1.3rem' },
                  lineHeight: 1.1,
                  textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  QC Management
                </Typography>
                <Typography variant="caption" sx={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: { xs: isMobile ? '0.5rem' : '0.2rem', sm: '0.7rem' },
                  fontWeight: 500,
                  lineHeight: 1.2,
                  display: 'block',
                  mt: 0.25
                }}>
                  Quality control operations
                </Typography>
              </Box>
            </Box>

            {/* RIGHT: Warehouse + User Chips */}
            <Stack direction="row" spacing={{ xs: 0.5, sm: 0.75 }} alignItems="center">
              <Chip
                label={activeWarehouse.name}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 700,
                  height: { xs: 20, sm: 24 },
                  fontSize: { xs: isMobile ? '0.42rem' : '0.2rem', sm: '0.72rem' },
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  '& .MuiChip-label': { px: { xs: 0.75, sm: 1 } }
                }}
              />
              <Chip
                label={user?.full_name}
                size="small"
                avatar={<Box sx={{
                  bgcolor: 'rgba(255,255,255,0.3)',
                  width: { xs: 14, sm: 16 },
                  height: { xs: 14, sm: 16 },
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: { xs: '0.55rem', sm: '0.6rem' }
                }}>👤</Box>}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 600,
                  height: { xs: 20, sm: 24 },
                  fontSize: { xs: '0.62rem', sm: '0.72rem' },
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  '& .MuiChip-label': { px: { xs: 0.75, sm: 1 } },
                  '& .MuiChip-avatar': {
                    width: { xs: 14, sm: 16 },
                    height: { xs: 14, sm: 16 },
                    ml: { xs: 0.5, sm: 0.75 }
                  }
                }}
              />
            </Stack>
          </Box>
        </Box>


        {/* ==================== TABS SECTION ==================== */}
        <Paper
          sx={{
            position: 'sticky',
            top: 38,
            zIndex: 90,
            mb: 1,
            borderRadius: 2,
            overflow: 'visible', // Changed from 'hidden'
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            background: 'white',
          }}
        >
          <Tabs
            value={tabValue}
            onChange={(event, newValue) => {
              setTabValue(newValue);
            }}
            variant="scrollable"
            scrollButtons="auto"
            TabIndicatorProps={{
              style: {
                height: 3,
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '3px 3px 0 0',
              },
            }}
            sx={{
              minHeight: 48,
              '.MuiTab-root': {
                fontWeight: 600,
                fontSize: { xs: '0.75rem', sm: '0.82rem' },
                textTransform: 'none',
                minHeight: 48,
                py: 1.25,
                minWidth: { xs: 'auto', sm: 110 },
                px: { xs: 2, sm: 2.5 },
                color: '#64748b',
                transition: 'all 0.2s',
              },
              '.Mui-selected': {
                color: '#667eea !important',
                fontWeight: '700 !important',
              },
              '.MuiTab-root:hover': {
                bgcolor: 'rgba(102, 126, 234, 0.05)',
              },
              '.MuiTabs-indicator': {
                display: 'flex',
                justifyContent: 'center',
                backgroundColor: 'transparent',
              },
            }}
          >
            <Tab label="QC List" />
            <Tab label="Single QC" />
            <Tab label="Bulk Upload" />
            <Tab label="Multi QC" />
            <Tab label="Batch Manager" />
          </Tabs>
        </Paper>


        {/* ==================== MAIN CONTENT AREA ==================== */}
        <Paper
          sx={{
            p: 0,
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            background: 'white',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >

          {/* ========== TAB 0: QC LIST ========== */}
          {tabValue === 0 && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                p: { xs: 0.25, sm: 0.50 },
              }}
            >
              {/* SEARCH BAR + FILTERS TOGGLE */}
              <Box sx={{ flexShrink: 0, mb: 1, position: 'relative', zIndex: 95 }}>
                <Stack direction="row" spacing={1} alignItems="stretch" sx={{ mb: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="🔍 Search by WSN, Product Title, or any field..."
                    value={searchFilter}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchFilter(value);
                      setPage(1);
                      // Force immediate reload if empty (clear search)
                      if (value === '') {
                        loadQCList();
                      }
                    }}
                    onKeyPress={(e) => {
                      // Trigger search on Enter key
                      if (e.key === 'Enter') {
                        loadQCList();
                      }
                    }}
                    sx={{
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'white',
                        borderRadius: 1.5,
                        height: 38,
                        fontSize: { xs: '0.8rem', sm: '0.875rem' },
                        fontWeight: 500,
                        border: '2px solid #e2e8f0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        '&:hover': {
                          borderColor: '#cbd5e1',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        },
                        '&.Mui-focused': {
                          borderColor: '#667eea',
                          boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)'
                        },
                        '& fieldset': {
                          border: 'none'
                        },
                        '& input': {
                          py: 0.75
                        }
                      }
                    }}
                  />

                  <Button
                    variant="outlined"
                    onClick={() => setFiltersExpanded(!filtersExpanded)}
                    sx={{
                      minWidth: { xs: 42, sm: 115 },
                      height: 38,
                      borderWidth: 2,
                      borderColor: filtersExpanded ? '#667eea' : '#cbd5e1',
                      bgcolor: filtersExpanded ? 'rgba(102, 126, 234, 0.1)' : 'white',
                      color: filtersExpanded ? '#667eea' : '#64748b',
                      fontWeight: 700,
                      fontSize: { xs: '0.7rem', sm: '0.78rem' },
                      borderRadius: 1.5,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      transition: 'all 0.2s',
                      px: { xs: 1, sm: 1.5 },
                      '&:hover': {
                        borderWidth: 2,
                        borderColor: '#667eea',
                        bgcolor: 'rgba(102, 126, 234, 0.15)',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)'
                      },
                      position: 'relative'
                    }}
                  >
                    <FilterListIcon sx={{
                      fontSize: { xs: '1.1rem', sm: '1.15rem' },
                      mr: { xs: 0, sm: 0.4 }
                    }} />

                    <Box component="span" sx={{ mr: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box component="span">{filtersExpanded ? "Hide Filters" : "Show Filters"}</Box>
                      {filtersActive && (
                        <Tooltip title="Filters active">
                          <Box sx={{
                            position: 'absolute',
                            top: -5,
                            right: -5,
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            bgcolor: '#10b981',
                            border: '2px solid white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Typography sx={{ fontSize: '0.5rem', fontWeight: 800, color: 'white' }}>
                              ●
                            </Typography>
                          </Box>
                        </Tooltip>
                      )}
                    </Box>

                    <ExpandMoreIcon sx={{ transform: filtersExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }} />
                  </Button>
                </Stack>

                {/* Collapsible Filter Content */}
                <Collapse in={filtersExpanded} timeout="auto">
                  <Card sx={{
                    borderRadius: 1.5,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: '1px solid #e2e8f0',
                    position: 'relative',
                    zIndex: 95
                  }}>
                    <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                      <Stack spacing={1}>
                        {/* ROW 1: Date Filters + Status + Grade + Brand + Category */}
                        <Box sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
                          gap: 1
                        }}>
                          <TextField
                            label="From Date"
                            type="date"
                            size="small"
                            InputLabelProps={{ shrink: true }}
                            value={dateFromFilter}
                            onChange={(e) => { setDateFromFilter(e.target.value); setPage(1); }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                height: 36,
                                fontSize: '0.8rem',
                                bgcolor: 'white',
                                '&:hover fieldset': { borderColor: '#667eea' },
                                '&.Mui-focused fieldset': { borderColor: '#667eea' }
                              },
                              '& .MuiInputLabel-root': {
                                fontSize: '0.75rem'
                              }
                            }}
                          />
                          <TextField
                            label="To Date"
                            type="date"
                            size="small"
                            InputLabelProps={{ shrink: true }}
                            value={dateToFilter}
                            onChange={(e) => { setDateToFilter(e.target.value); setPage(1); }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                height: 36,
                                fontSize: '0.8rem',
                                bgcolor: 'white',
                                '&:hover fieldset': { borderColor: '#667eea' },
                                '&.Mui-focused fieldset': { borderColor: '#667eea' }
                              },
                              '& .MuiInputLabel-root': {
                                fontSize: '0.75rem'
                              }
                            }}
                          />
                          <FormControl size="small">
                            <InputLabel sx={{ fontSize: '0.75rem' }}>Status</InputLabel>
                            <Select
                              value={statusFilter}
                              label="Status"
                              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                              sx={{
                                height: 36,
                                fontSize: '0.8rem',
                                bgcolor: 'white',
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' }
                              }}
                            >
                              <MenuItem value="">All Status</MenuItem>
                              {QC_STATUSES.map(s => <MenuItem key={s} value={s} sx={{ fontSize: '0.8rem' }}>{s}</MenuItem>)}
                            </Select>
                          </FormControl>
                          <FormControl size="small">
                            <InputLabel sx={{ fontSize: '0.75rem' }}>Grade</InputLabel>
                            <Select
                              value={gradeFilter}
                              label="Grade"
                              onChange={(e) => { setGradeFilter(e.target.value); setPage(1); }}
                              sx={{
                                height: 36,
                                fontSize: '0.8rem',
                                bgcolor: 'white',
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' }
                              }}
                            >
                              <MenuItem value="">All Grades</MenuItem>
                              {QC_GRADES.map(g => <MenuItem key={g} value={g} sx={{ fontSize: '0.8rem' }}>{g}</MenuItem>)}
                            </Select>
                          </FormControl>
                          <FormControl size="small">
                            <InputLabel sx={{ fontSize: '0.75rem' }}>Brand</InputLabel>
                            <Select
                              value={brandFilter}
                              label="Brand"
                              onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                              sx={{
                                height: 36,
                                fontSize: '0.8rem',
                                bgcolor: 'white',
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' }
                              }}
                            >
                              <MenuItem value="">All Brands</MenuItem>
                              {brands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                            </Select>
                          </FormControl>
                          <FormControl size="small">
                            <InputLabel sx={{ fontSize: '0.75rem' }}>Category</InputLabel>
                            <Select
                              value={categoryFilter}
                              label="Category"
                              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                              sx={{
                                height: 36,
                                fontSize: '0.8rem',
                                bgcolor: 'white',
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' }
                              }}
                            >
                              <MenuItem value="">All Categories</MenuItem>
                              {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                            </Select>
                          </FormControl>
                        </Box>

                        {/* ROW 2: Action Buttons */}
                        <Box sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                          gap: 1
                        }}>
                          <Button
                            fullWidth
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setSearchFilter('');
                              setStatusFilter('');
                              setGradeFilter('');
                              setBrandFilter('');
                              setCategoryFilter('');
                              setDateFromFilter('');
                              setDateToFilter('');
                              setPage(1);
                            }}
                            sx={{
                              height: 34,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              borderWidth: 2,
                              borderColor: '#94a3b8',
                              color: '#64748b',
                              '&:hover': {
                                borderWidth: 2,
                                borderColor: '#64748b',
                                bgcolor: '#f8fafc'
                              }
                            }}
                          >
                            🔄 RESET
                          </Button>
                          <Button
                            fullWidth
                            size="small"
                            startIcon={<SettingsIcon sx={{ fontSize: '0.9rem' }} />}
                            variant="outlined"
                            onClick={() => setListColumnSettingsOpen(true)}
                            sx={{
                              height: 34,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              borderWidth: 2,
                              borderColor: '#667eea',
                              color: '#667eea',
                              '&:hover': {
                                borderWidth: 2,
                                bgcolor: 'rgba(102, 126, 234, 0.1)'
                              }
                            }}
                          >
                            COLUMNS
                          </Button>
                          <Button
                            fullWidth
                            size="small"
                            startIcon={<DownloadIcon sx={{ fontSize: '0.9rem' }} />}
                            variant="contained"
                            onClick={() => setExportDialogOpen(true)}
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
                            EXPORT
                          </Button>
                          <Button
                            fullWidth
                            size="small"
                            startIcon={refreshing ? <CircularProgress size={14} /> : refreshSuccess ? <CheckCircle sx={{ color: '#10b981' }} /> : <RefreshIcon sx={{ fontSize: '0.9rem' }} />}
                            variant="outlined"
                            onClick={() => loadQCList({ buttonRefresh: true })}
                            disabled={refreshing}
                            sx={{
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
                            {refreshing ? 'Refreshing...' : refreshSuccess ? 'Refreshed' : 'REFRESH'}
                          </Button>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Collapse>
              </Box>

              {/* TABLE - HORIZONTAL SCROLL */}
              <Box sx={{
                flex: 1,
                overflow: 'auto',
                minHeight: 0,
                border: '2px solid #e2e8f0',
                borderRadius: 1.5,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                '&::-webkit-scrollbar': {
                  height: 8,
                  width: 8
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: '#cbd5e1',
                  borderRadius: 4,
                  '&:hover': {
                    backgroundColor: '#94a3b8'
                  }
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: '#f1f5f9',
                  borderRadius: 4
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
                    size="small"
                    sx={{
                      '& .MuiTableCell-root': {
                        borderRight: '1px solid #e2e8f0',
                        padding: { xs: '4px 8px', sm: '6px 10px' },
                        fontSize: { xs: '0.72rem', sm: '0.78rem' },
                        minWidth: { xs: 85, sm: 100 },
                        whiteSpace: 'nowrap'
                      }
                    }}
                  >
                    <TableHead>
                      <TableRow sx={{ background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)' }}>
                        {listColumns
                          .filter(c => c.visible)
                          .map(c => (
                            <TableCell
                              key={`header_${c.key}`}
                              sx={{
                                color: '#1e293b',
                                fontWeight: 800,
                                background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                                fontSize: { xs: '0.68rem', sm: '0.75rem' },
                                textTransform: 'uppercase',
                                py: { xs: 0.75, sm: 1 },
                                position: 'sticky',
                                top: 0,
                                zIndex: 10
                              }}
                            >
                              {c.key.replace(/_/g, ' ')}
                            </TableCell>
                          ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {listLoading ? (
                        <TableRow>
                          <TableCell colSpan={listColumns.filter(c => c.visible).length} align="center" sx={{ py: { xs: 5, sm: 8 } }}>
                            <CircularProgress size={isMobile ? 35 : 50} sx={{ color: '#667eea' }} />
                            <Typography sx={{ mt: 1.5, fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>
                              Loading data...
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : qcList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={listColumns.filter(c => c.visible).length} align="center" sx={{ py: { xs: 5, sm: 8 } }}>
                            <Typography sx={{ fontWeight: 700, color: '#94a3b8', fontSize: { xs: '0.85rem', sm: '1rem' } }}>
                              🔭 No data found
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#cbd5e1', mt: 0.5, fontSize: '0.7rem' }}>
                              Try adjusting your filters
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        qcList.map((item: any, idx) => (
                          <TableRow
                            key={item.id}
                            sx={{
                              bgcolor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                              transition: 'all 0.2s',
                              '&:hover': {
                                bgcolor: '#f1f5f9',
                                transform: 'scale(1.001)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                              }
                            }}
                          >
                            {listColumns
                              .filter(c => c.visible)
                              .map(c => (
                                <TableCell
                                  key={`cell_${idx}_${c.key}`}
                                  sx={{
                                    fontWeight: 500,
                                    fontSize: { xs: '0.72rem', sm: '0.78rem' },
                                    color: '#334155'
                                  }}
                                >
                                  {c.key === 'qc_date'
                                    ? formatDate(item.qc_date)
                                    : c.key === 'inbound_date'
                                      ? formatDate(item.inbound_date)
                                      : (item[c.key] ? String(item[c.key]).substring(0, 50) : '-')}
                                </TableCell>
                              ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* PAGINATION - STICKY AT BOTTOM */}
              <Box sx={{
                mt: 1,
                p: { xs: 0.5, sm: 0.75 },
                background: 'white',
                borderRadius: 1.25,
                border: '2px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 0.5,
                flexShrink: 0,
                position: 'sticky',
                bottom: 0,
                zIndex: 10,
                backdropFilter: 'blur(8px)',
                backgroundColor: 'rgba(255, 255, 255, 0.95)'
              }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 700,
                    color: '#475569',
                    fontSize: { xs: '0.65rem', sm: '0.72rem' },
                    display: { xs: 'none', sm: 'block' }
                  }}
                >
                  📊 {qcList.length > 0 ? (page - 1) * limit + 1 : 0}-{Math.min(page * limit, total)} of {total}
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 700,
                    color: '#475569',
                    fontSize: '0.65rem',
                    display: { xs: 'block', sm: 'none' }
                  }}
                >
                  {qcList.length > 0 ? (page - 1) * limit + 1 : 0}-{Math.min(page * limit, total)} / {total}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75 } }}>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    sx={{
                      fontSize: { xs: '0.65rem', sm: '0.72rem' },
                      fontWeight: 700,
                      minWidth: { xs: 40, sm: 65 },
                      height: { xs: 26, sm: 30 },
                      borderWidth: 2,
                      borderColor: '#667eea',
                      color: '#667eea',
                      px: { xs: 0.25, sm: 1 },
                      '&:hover': {
                        borderWidth: 2,
                        bgcolor: 'rgba(102, 126, 234, 0.1)'
                      },
                      '&.Mui-disabled': {
                        borderWidth: 2,
                        borderColor: '#e2e8f0',
                        color: '#cbd5e1'
                      }
                    }}
                  >
                    {isMobile ? '◀' : '◀ Prev'}
                  </Button>

                  <Box sx={{
                    px: { xs: 1, sm: 1.5 },
                    py: { xs: 0.25, sm: 0.4 },
                    border: '2px solid #667eea',
                    borderRadius: 1,
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                    minWidth: { xs: 50, sm: 60 },
                    textAlign: 'center'
                  }}>
                    <Typography sx={{
                      fontWeight: 800,
                      color: '#667eea',
                      fontSize: { xs: '0.68rem', sm: '0.75rem' },
                      lineHeight: 1.1
                    }}>
                      {page}/{Math.ceil(total / limit) || 1}
                    </Typography>
                  </Box>

                  <Button
                    size="small"
                    variant="outlined"
                    disabled={page >= Math.ceil(total / limit)}
                    onClick={() => setPage(page + 1)}
                    sx={{
                      fontSize: { xs: '0.65rem', sm: '0.72rem' },
                      fontWeight: 700,
                      minWidth: { xs: 40, sm: 65 },
                      height: { xs: 26, sm: 30 },
                      borderWidth: 2,
                      borderColor: '#667eea',
                      color: '#667eea',
                      px: { xs: 0.25, sm: 1 },
                      '&:hover': {
                        borderWidth: 2,
                        bgcolor: 'rgba(102, 126, 234, 0.1)'
                      },
                      '&.Mui-disabled': {
                        borderWidth: 2,
                        borderColor: '#e2e8f0',
                        color: '#cbd5e1'
                      }
                    }}
                  >
                    {isMobile ? '▶' : 'Next ▶'}
                  </Button>
                </Box>
              </Box>
            </Box>
          )}

          {/* ========== TAB 1: SINGLE QC ========== */}
          {tabValue === 1 && (
            <Box sx={{
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: { xs: 1.5, sm: 2, lg: 2.5 },
              p: { xs: 1, sm: 1.5, md: 2 },
              height: '100%',
              overflow: 'auto'
            }}
            >
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                gap: { xs: 1, sm: 2 },
                flex: 1,
                minHeight: 0
              }}>
                {/* LEFT COLUMN - FORM */}
                <Card sx={{
                  borderRadius: 1.5,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <CardContent sx={{ p: { xs: 1.5, sm: 2 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 800,
                        mb: 2,
                        color: '#1e293b',
                        fontSize: { xs: '1rem', sm: '1.1rem' },
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      📝 Single QC Entry
                    </Typography>

                    {duplicateQC && (
                      <Alert
                        severity="warning"
                        sx={{
                          mb: 2,
                          py: 1,
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          borderRadius: 1,
                          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                          border: '1px solid #f59e0b'
                        }}
                      >
                        ⚠️ QC already exists. Click "Update" to modify existing entry.
                      </Alert>
                    )}

                    <Box sx={{ flex: 1, overflow: 'auto' }}>
                      <Stack spacing={1.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="WSN *"
                          value={singleWSN}
                          onChange={(e) => {
                            const value = e.target.value;
                            setSingleWSN(value);
                            fetchProductDetails(value);
                          }}
                          placeholder="Enter WSN to auto-fetch product details"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              height: 40,
                              fontSize: '0.85rem',
                              bgcolor: 'white',
                              '&:hover fieldset': { borderColor: '#667eea' },
                              '&.Mui-focused fieldset': { borderColor: '#667eea' }
                            },
                            '& .MuiInputLabel-root': {
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }
                          }}
                        />

                        <TextField
                          fullWidth
                          size="small"
                          label="QC By Name"
                          value={singleForm.qc_by_name}
                          onChange={(e) => setSingleForm({ ...singleForm, qc_by_name: e.target.value })}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              height: 40,
                              fontSize: '0.85rem',
                              bgcolor: 'white',
                              '&:hover fieldset': { borderColor: '#667eea' },
                              '&.Mui-focused fieldset': { borderColor: '#667eea' }
                            },
                            '& .MuiInputLabel-root': {
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }
                          }}
                        />

                        <TextField
                          fullWidth
                          size="small"
                          label="QC Date"
                          type="date"
                          InputLabelProps={{ shrink: true }}
                          value={singleForm.qc_date}
                          onChange={(e) => setSingleForm({ ...singleForm, qc_date: e.target.value })}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              height: 40,
                              fontSize: '0.85rem',
                              bgcolor: 'white',
                              '&:hover fieldset': { borderColor: '#667eea' },
                              '&.Mui-focused fieldset': { borderColor: '#667eea' }
                            },
                            '& .MuiInputLabel-root': {
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }
                          }}
                        />

                        <TextField
                          fullWidth
                          size="small"
                          label="Product Serial Number"
                          value={singleForm.product_serial_number}
                          onChange={(e) => setSingleForm({ ...singleForm, product_serial_number: e.target.value })}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              height: 40,
                              fontSize: '0.85rem',
                              bgcolor: 'white',
                              '&:hover fieldset': { borderColor: '#667eea' },
                              '&.Mui-focused fieldset': { borderColor: '#667eea' }
                            },
                            '& .MuiInputLabel-root': {
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }
                          }}
                        />

                        <FormControl fullWidth size="small">
                          <InputLabel sx={{ fontSize: '0.8rem', fontWeight: 600 }}>QC Grade</InputLabel>
                          <Select
                            value={singleForm.qc_grade}
                            label="QC Grade"
                            onChange={(e) => setSingleForm({ ...singleForm, qc_grade: e.target.value })}
                            sx={{
                              height: 40,
                              fontSize: '0.85rem',
                              bgcolor: 'white',
                              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' }
                            }}
                          >
                            <MenuItem value="" sx={{ fontSize: '0.85rem' }}>Select Grade</MenuItem>
                            {QC_GRADES.map((g) => (
                              <MenuItem key={g} value={g} sx={{ fontSize: '0.85rem' }}>
                                {g}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <FormControl fullWidth size="small">
                          <InputLabel sx={{ fontSize: '0.8rem', fontWeight: 600 }}>Rack Location</InputLabel>
                          <Select
                            value={singleForm.rack_no}
                            label="Rack Location"
                            onChange={(e) => setSingleForm({ ...singleForm, rack_no: e.target.value })}
                            sx={{
                              height: 40,
                              fontSize: '0.85rem',
                              bgcolor: 'white',
                              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#667eea' }
                            }}
                          >
                            <MenuItem value="" sx={{ fontSize: '0.85rem' }}>Select Rack</MenuItem>
                            {racks.map((r) => (
                              <MenuItem key={r.id} value={r.rack_name} sx={{ fontSize: '0.85rem' }}>
                                {r.rack_name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={3}
                          label="QC Remarks"
                          value={singleForm.qc_remarks}
                          onChange={(e) => setSingleForm({ ...singleForm, qc_remarks: e.target.value })}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              fontSize: '0.85rem',
                              bgcolor: 'white',
                              '&:hover fieldset': { borderColor: '#667eea' },
                              '&.Mui-focused fieldset': { borderColor: '#667eea' }
                            },
                            '& .MuiInputLabel-root': {
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }
                          }}
                        />

                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={2}
                          label="Other Remarks"
                          value={singleForm.other_remarks}
                          onChange={(e) => setSingleForm({ ...singleForm, other_remarks: e.target.value })}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              fontSize: '0.85rem',
                              bgcolor: 'white',
                              '&:hover fieldset': { borderColor: '#667eea' },
                              '&.Mui-focused fieldset': { borderColor: '#667eea' }
                            },
                            '& .MuiInputLabel-root': {
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }
                          }}
                        />
                      </Stack>
                    </Box>

                    {/* ACTION BUTTONS */}
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e2e8f0' }}>
                      {duplicateQC ? (
                        <Stack direction="row" spacing={1}>
                          <Button
                            fullWidth
                            variant="contained"
                            size="small"
                            onClick={handleSingleSubmit}
                            disabled={singleLoading}
                            sx={{
                              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                              py: 1,
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              borderRadius: 1,
                              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                                boxShadow: '0 6px 16px rgba(245, 158, 11, 0.4)'
                              }
                            }}
                          >
                            🔄 Update Existing QC
                          </Button>
                          <Button
                            fullWidth
                            variant="outlined"
                            size="small"
                            onClick={() => setGradeDialogOpen(true)}
                            sx={{
                              py: 1,
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              borderWidth: 2,
                              borderColor: '#667eea',
                              color: '#667eea',
                              '&:hover': {
                                borderWidth: 2,
                                bgcolor: 'rgba(102, 126, 234, 0.1)'
                              }
                            }}
                          >
                            ⚙️ Manage Grades
                          </Button>
                        </Stack>
                      ) : (
                        <Stack direction="row" spacing={1}>
                          <Button
                            fullWidth
                            variant="contained"
                            size="small"
                            onClick={handleSingleSubmit}
                            disabled={singleLoading}
                            sx={{
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              py: 1,
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              height: 36,
                              borderRadius: 1,
                              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                boxShadow: '0 6px 16px rgba(16, 185, 129, 0.4)'
                              }
                            }}
                          >
                            ✓ Submit QC Entry
                          </Button>

                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setGradeDialogOpen(true)}
                            sx={{
                              py: 1,
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              borderWidth: 2,
                              height: 36,
                              minWidth: 100,
                              borderColor: '#667eea',
                              color: '#667eea',
                              '&:hover': {
                                borderWidth: 2,
                                bgcolor: 'rgba(102, 126, 234, 0.1)'
                              }
                            }}
                          >
                            ⚙️ Grades
                          </Button>
                        </Stack>
                      )}
                    </Box>
                  </CardContent>
                </Card>

                {/* RIGHT COLUMN - PRODUCT DETAILS */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1, sm: 2 } }}>
                  {singleProduct.product_title && (
                    <Card sx={{
                      borderRadius: 1.5,
                      background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                      border: '2px solid #10b981',
                      boxShadow: '0 4px 20px rgba(16, 185, 129, 0.2)',
                      flex: 1
                    }}>
                      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                          <CheckCircle sx={{ color: '#10b981', fontSize: { xs: 24, sm: 28 } }} />
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: 800,
                              color: '#065f46',
                              fontSize: { xs: '0.95rem', sm: '1rem' }
                            }}
                          >
                            Master Data Found
                          </Typography>
                        </Stack>

                        <Divider sx={{ mb: 2, borderColor: 'rgba(5, 150, 105, 0.3)' }} />

                        <Box sx={{ flex: 1, overflow: 'auto' }}>
                          <Stack spacing={2}>
                            <Box>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: '#065f46',
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5
                                }}
                              >
                                FSN
                              </Typography>
                              <Typography sx={{
                                fontWeight: 700,
                                color: '#047857',
                                fontSize: '0.9rem',
                                wordBreak: 'break-all'
                              }}>
                                {singleProduct.fsn || 'N/A'}
                              </Typography>
                            </Box>

                            <Box>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: '#065f46',
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                  textTransform: 'uppercase'
                                }}
                              >
                                PRODUCT TITLE
                              </Typography>
                              <Typography sx={{
                                fontWeight: 600,
                                color: '#047857',
                                fontSize: '0.85rem',
                                lineHeight: 1.3
                              }}>
                                {singleProduct.product_title || 'N/A'}
                              </Typography>
                            </Box>

                            <Box sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                              gap: 1.5
                            }}>
                              <Box>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: '#065f46',
                                    fontWeight: 700,
                                    fontSize: '0.7rem'
                                  }}
                                >
                                  BRAND
                                </Typography>
                                <Typography sx={{ fontWeight: 700, color: '#047857' }}>
                                  {singleProduct.brand || 'N/A'}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: '#065f46',
                                    fontWeight: 700,
                                    fontSize: '0.7rem'
                                  }}
                                >
                                  CATEGORY
                                </Typography>
                                <Typography sx={{ fontWeight: 700, color: '#047857' }}>
                                  {singleProduct.cms_vertical || 'N/A'}
                                </Typography>
                              </Box>
                            </Box>

                            <Box sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                              gap: 1.5
                            }}>
                              <Box>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: '#065f46',
                                    fontWeight: 700,
                                    fontSize: '0.7rem'
                                  }}
                                >
                                  MRP
                                </Typography>
                                <Typography sx={{ fontWeight: 700, color: '#047857' }}>
                                  ₹{singleProduct.mrp || 'N/A'}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: '#065f46',
                                    fontWeight: 700,
                                    fontSize: '0.7rem'
                                  }}
                                >
                                  FSP
                                </Typography>
                                <Typography sx={{ fontWeight: 700, color: '#047857' }}>
                                  ₹{singleProduct.fsp || 'N/A'}
                                </Typography>
                              </Box>
                            </Box>

                            {singleProduct.fkt_link && (
                              <Box>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: '#065f46',
                                    fontWeight: 700,
                                    fontSize: '0.7rem'
                                  }}
                                >
                                  PRODUCT LINK
                                </Typography>
                                <Typography
                                  sx={{
                                    fontWeight: 600,
                                    color: '#047857',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    '&:hover': { color: '#065f46' }
                                  }}
                                  onClick={() => window.open(singleProduct.fkt_link, '_blank')}
                                >
                                  View Product Details →
                                </Typography>
                              </Box>
                            )}
                          </Stack>
                        </Box>
                      </CardContent>
                    </Card>
                  )}

                  {/* STATS CARD */}
                  <Card sx={{
                    borderRadius: 1.5,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: '1px solid #e2e8f0'
                  }}>
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 800,
                          mb: 2,
                          color: '#1e293b',
                          fontSize: { xs: '0.95rem', sm: '1rem' },
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1
                        }}
                      >
                        📊 Today's QC Stats
                      </Typography>

                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>Pending:</Typography>
                          <Chip
                            label={stats.pending}
                            sx={{
                              bgcolor: '#fef3c7',
                              color: '#92400e',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              height: 24
                            }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>Pass:</Typography>
                          <Chip
                            label={stats.pass}
                            sx={{
                              bgcolor: '#d1fae5',
                              color: '#065f46',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              height: 24
                            }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>Fail:</Typography>
                          <Chip
                            label={stats.fail}
                            sx={{
                              bgcolor: '#fee2e2',
                              color: '#991b1b',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              height: 24
                            }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>Hold:</Typography>
                          <Chip
                            label={stats.hold}
                            sx={{
                              bgcolor: '#fed7d7',
                              color: '#9b2c2c',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              height: 24
                            }}
                          />
                        </Box>
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>Total:</Typography>
                          <Chip
                            label={stats.total}
                            sx={{
                              bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              color: 'white',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              height: 26
                            }}
                          />
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            </Box>
          )
          }

          {/* ========== TAB 2: BULK UPLOAD ========== */}
          {/* TAB 2 - BULK UPLOAD */}
          {tabValue === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: { xs: 1, sm: 1.5, md: 2 }, overflow: 'auto' }}>
              <Card sx={{ borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#1a237e' }}>
                    📤 Bulk Upload
                  </Typography>

                  <Stack spacing={2}>
                    {/* DOWNLOAD TEMPLATE BUTTON */}
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={downloadBulkTemplate}
                      sx={{ py: 1.5 }}
                    >
                      📥 DOWNLOAD TEMPLATE
                    </Button>

                    {/* Confirmation Dialog for Download */}
                    <Dialog
                      open={confirmOpen}
                      onClose={() => setConfirmOpen(false)}
                      maxWidth="xs"
                      fullWidth
                    >
                      <DialogTitle sx={{ fontWeight: 700, color: '#1a237e' }}>
                        Confirm Download
                      </DialogTitle>

                      <DialogContent>
                        <Typography sx={{ color: '#334155', mb: 2 }}>
                          Would you like to proceed with downloading the template?
                        </Typography>
                      </DialogContent>

                      <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                        <Button
                          variant="contained"
                          onClick={handleConfirmDownload}
                          sx={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          }}
                        >
                          Yes, Download
                        </Button>
                      </DialogActions>
                    </Dialog>

                    {/* FILE UPLOAD SECTION - SAME AS INBOUND */}
                    <Box
                      sx={{
                        border: '2px dashed #667eea',
                        borderRadius: 2,
                        p: 3,
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'rgba(102, 126, 234, 0.05)',
                        transition: 'all 0.3s',
                        '&:hover': {
                          background: 'rgba(102, 126, 234, 0.1)',
                          borderColor: '#764ba2',
                        },
                      }}
                    >
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                        style={{ display: 'none' }}
                        id="bulk-file"
                      />
                      <label htmlFor="bulk-file" style={{ cursor: 'pointer', display: 'block' }}>
                        <CloudUploadIcon sx={{ fontSize: 40, color: '#667eea', mb: 1 }} />
                        <Typography sx={{ fontWeight: 700 }}>Click to upload file</Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          {bulkFile?.name || 'No file selected'}
                        </Typography>
                      </label>
                    </Box>

                    {/* UPLOAD BUTTON */}
                    <Button
                      variant="contained"
                      onClick={handleBulkUpload}
                      disabled={bulkLoading || !bulkFile}
                      sx={{
                        py: 1.5,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      }}
                    >
                      {bulkLoading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : <CloudUploadIcon sx={{ mr: 1 }} />}
                      Upload
                    </Button>
                  </Stack>

                  {/* PROGRESS INDICATOR */}
                  {bulkProgress.show && (
                    <Card sx={{ background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', border: '2px solid #3b82f6', mt: 2 }}>
                      <CardContent>
                        <Stack spacing={2}>
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#1e40af' }}>BATCH ID</Typography>
                            <Typography sx={{ fontWeight: 700, color: '#1e3a8a' }}>{bulkProgress.batchId}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#1e40af' }}>TOTAL ROWS</Typography>
                            <Typography sx={{ fontWeight: 700, color: '#1e3a8a' }}>{bulkProgress.total}</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={50} sx={{ height: 8, borderRadius: 4 }} />
                          <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 600 }}>Processing...</Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}


          {/* ========== TAB 3: MULTI QC (AG GRID) ========== */}
          {tabValue === 3 && (() => {
            // Column definitions for AG Grid
            const columnDefs = visibleColumns.map((field: string) => {
              const widthConfig = COLUMN_WIDTHS[field];

              const baseColDef: any = {
                field,
                headerName: field === 'sno' ? 'S.No' : field.replace(/([A-Z])/g, ' $1').toUpperCase(),
                ...widthConfig,
                cellStyle: (params: any) => {
                  const styles: any = {};

                  // ✅ SERIAL NUMBER STYLING
                  if (field === 'sno') {
                    styles.backgroundColor = '#f8fafc';
                    styles.fontWeight = 700;
                    styles.color = '#64748b';
                    styles.textAlign = 'center';
                  }

                  // Master data columns get gray background
                  if (ALL_MASTER_COLUMNS.includes(field)) {
                    styles.backgroundColor = '#f5f5f5';
                  }
                  return styles;
                },
              };

              // ✅ SERIAL NUMBER COLUMN (Auto-numbered, non-editable)
              if (field === 'sno') {
                baseColDef.valueGetter = (params: any) => params.node.rowIndex + 1;
                baseColDef.editable = false;
                return baseColDef;
              }



              //  Visual indicators for WSN column with icons
              if (field === 'wsn') {
                baseColDef.cellRenderer = (params: any) => {
                  return params.value || '';
                };
              }

              // Special handling for specific columns
              if (field === 'qc_grade') {
                baseColDef.cellEditor = 'agSelectCellEditor';
                baseColDef.cellEditorParams = {
                  values: ['', ...QC_GRADES],
                };
              } else if (field === 'rack_no') {
                baseColDef.cellEditor = 'agSelectCellEditor';
                baseColDef.cellEditorParams = {
                  values: ['', ...racks.map((r) => r.rack_name)],
                };
              }

              // Read-only for master data columns
              if (ALL_MASTER_COLUMNS.includes(field)) {
                baseColDef.editable = false;
              }

              return baseColDef;
            });

            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1, mt: 0 }}>
                {/* HEADER */}
                <Card sx={{ borderRadius: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <CardContent sx={{ p: 1.2, '&:last-child': { pb: 1.2 } }}>

                    {/* ===== MOBILE: 2 ROWS ===== */}
                    <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                      {/* ROW 1: Date + Name Fields */}
                      <Stack
                        direction="row"
                        spacing={0.8}
                        alignItems="center"
                        sx={{ mb: 1 }}
                      >
                        <TextField
                          label="QC Date"
                          type="date"
                          value={commonQcDate}
                          onChange={(e) => setCommonQcDate(e.target.value)}
                          size="small"
                          sx={{
                            width: '48%',
                            '& .MuiInputBase-root': {
                              height: 32,
                              fontSize: '0.75rem'
                            },
                            '& .MuiInputLabel-root': {
                              fontSize: '0.7rem'
                            }
                          }}
                          InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                          label="QC By Name"
                          value={commonQcByName}
                          onChange={(e) => setCommonQcByName(e.target.value)}
                          size="small"
                          sx={{
                            width: '48%',
                            '& .MuiInputBase-root': {
                              height: 32,
                              fontSize: '0.75rem'
                            },
                            '& .MuiInputLabel-root': {
                              fontSize: '0.7rem'
                            }
                          }}
                        />
                      </Stack>

                      {/* ROW 2: Chips + Buttons (NO WRAP) */}
                      <Stack
                        direction="row"
                        spacing={0.4}
                        alignItems="center"
                        sx={{
                          flexWrap: 'nowrap',
                          overflowX: 'auto',
                          '&::-webkit-scrollbar': { display: 'none' },
                          scrollbarWidth: 'none'
                        }}
                      >

                        {/* Buttons */}
                        <Stack direction="row" spacing={1} sx={{ flexShrink: 0, paddingRight: 5, ml: 'auto !important' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={add30Rows}
                            sx={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              width: 110,
                              '&:hover': {
                                borderWidth: 2,
                                bgcolor: 'rgba(245, 158, 11, 0.1)'
                              }
                            }}
                          >
                            +30 Rows
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SettingsIcon sx={{ fontSize: '0.85rem' }} />}
                            onClick={() => setColumnSettingsOpen(true)}
                            sx={{
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              width: 110,
                              height: 26,
                              px: 0.8,
                              borderWidth: 2,
                              '&:hover': { borderWidth: 2 }
                            }}
                          >
                            Columns
                          </Button>



                          {/* ✅ NEW: Grid Settings Button */}
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SettingsIcon sx={{ fontSize: '0.85rem' }} />}
                            onClick={() => setGridSettingsOpen(true)}
                            sx={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              width: 110,
                              '&:hover': {
                                borderWidth: 2,
                                bgcolor: 'rgba(245, 158, 11, 0.1)'
                              }
                            }}
                          >
                            Grid
                          </Button>

                        </Stack>
                      </Stack>
                    </Box>

                    {/* ===== DESKTOP: SINGLE ROW ===== */}
                    <Stack
                      direction="row"
                      spacing={2}
                      alignItems="center"
                      sx={{ display: { xs: 'none', md: 'flex' } }}
                    >
                      {/* Date + Name Fields */}
                      <TextField
                        label="QC Date"
                        type="date"
                        value={commonQcDate}
                        onChange={(e) => setCommonQcDate(e.target.value)}
                        size="small"
                        sx={{ width: 150 }}
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        label="QC By Name"
                        value={commonQcByName}
                        onChange={(e) => setCommonQcByName(e.target.value)}
                        size="small"
                        sx={{ width: 200 }}
                      />

                      {/* Buttons */}
                      <Stack direction="row" spacing={0.8}>

                        <Button
                          size="small"
                          variant="outlined"
                          onClick={add30Rows}
                          sx={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            '&:hover': {
                              borderWidth: 2,
                              bgcolor: 'rgba(245, 158, 11, 0.1)'
                            }
                          }}
                        >
                          +30 Rows
                        </Button>

                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SettingsIcon sx={{ fontSize: '0.85rem' }} />}
                          onClick={() => setColumnSettingsOpen(true)}
                          sx={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            '&:hover': {
                              borderWidth: 2,
                              bgcolor: 'rgba(245, 158, 11, 0.1)'
                            }
                          }}
                        >
                          Columns
                        </Button>


                        {/* ✅ NEW: Grid Settings Button */}
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SettingsIcon sx={{ fontSize: '0.85rem' }} />}
                          onClick={() => setGridSettingsOpen(true)}
                          sx={{
                            fontSize: '0.7rem',
                            fontWeight: 700,

                            '&:hover': {
                              borderWidth: 2,
                              bgcolor: 'rgba(245, 158, 11, 0.1)'
                            }
                          }}
                        >
                          Grid
                        </Button>
                      </Stack>
                    </Stack>

                  </CardContent>
                </Card>


                {/* AG GRID */}
                <Box
                  sx={{
                    flex: 1,
                    border: '1px solid #cbd5e1',
                    borderRadius: 0,
                    '& .ag-root-wrapper': { borderRadius: 0 },

                    // Excel-style header
                    '& .ag-header': {
                      borderBottom: '1px solid #cbd5e1',
                    },
                    '& .ag-header-cell': {
                      backgroundColor: '#e5e7eb',
                      color: '#111827',
                      fontWeight: 700,
                      borderRight: '1px solid #d1d5db',
                      fontSize: '11px',
                      padding: '0 4px',
                    },

                    // Excel-style cells
                    '& .ag-cell': {
                      borderRight: '1px solid #e5e7eb',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '11px',
                      padding: '1px 4px',
                      display: 'flex',
                      alignItems: 'center',

                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    },

                    // Error cell styling
                    '& .wsn-cross-error': {
                      backgroundColor: '#fee2e2 !important',
                      fontWeight: 700,
                    },
                    '& .wsn-dup-error': {
                      backgroundColor: '#fef3c7 !important',
                      fontWeight: 700,
                    },



                    // Compact rows
                    // Compact rows (popup visible)
                    '& .ag-row': {
                      height: 26,
                      overflow: 'visible',   // ⭐ REQUIRED
                    },

                    '& .ag-row-even': { backgroundColor: '#ffffff' },
                    '& .ag-row-odd': { backgroundColor: '#f9fafb' },

                    // Active (focused) cell – Excel जैसी नीली border
                    '& .ag-cell-focus': {
                      border: '2px solid #2563eb !important',
                      boxSizing: 'border-box',
                    },

                    // Range selection (drag / shift select) – हल्का blue background
                    '& .ag-cell-range-selected': {
                      backgroundColor: '#dbeafe !important',
                    },
                    '& .ag-cell-range-single-cell': {
                      backgroundColor: '#eff6ff !important',
                    },

                    // Hover like selected Excel row
                    '& .ag-row-hover': {
                      backgroundColor: '#e5f3ff !important',
                    },
                    '& .ag-row-focus': {
                      outline: '1 px solid #60a5fa',
                    },
                  }}
                >
                  <AgGridReact
                    theme="legacy"
                    rowData={multiRows}
                    columnDefs={columnDefs}
                    rowHeight={26}


                    defaultColDef={{
                      sortable: gridSettings.sortable,  // ✅ Dynamic
                      filter: gridSettings.filter,      // ✅ Dynamic
                      resizable: gridSettings.resizable, // ✅ Dynamic
                      editable: (params: any) => {
                        if (!gridSettings.editable) return false;
                        const field = params.colDef.field as string;
                        return EDITABLE_COLUMNS.includes(field);
                      },

                    }}

                    stopEditingWhenCellsLoseFocus={true}
                    enterNavigatesVertically={true}
                    enterNavigatesVerticallyAfterEdit={true}
                    navigateToNextCell={navigateToNextCell}
                    ensureDomOrder={true}
                    suppressRowClickSelection={true}
                    suppressMovableColumns={true}
                    rowBuffer={5}
                    //theme="legacy"
                    className="ag-theme-quartz"
                    containerStyle={{ height: '100%', width: '100%' }}
                    onCellValueChanged={(event: any) => {
                      const { colDef, newValue, rowIndex } = event;
                      const field = colDef?.field;
                      if (!field) return;

                      const newRows = [...multiRows];

                      // ===== WSN FIELD LOGIC =====
                      if (field === 'wsn') {
                        const wsn = newValue?.trim()?.toUpperCase();

                        // 🔴 WSN cleared - clear master data
                        if (!newValue || !newValue.trim()) {
                          newRows[rowIndex] = { ...newRows[rowIndex], [field]: newValue };
                          ALL_MASTER_COLUMNS.forEach((col) => {
                            newRows[rowIndex][col] = null;
                          });
                          setMultiRows(newRows);
                          return;
                        }

                        // Calculate duplicates inline for immediate feedback
                        const wsnCounts = new Map<string, number>();
                        newRows.forEach((row: any) => {
                          const rowWsn = row.wsn?.trim()?.toUpperCase();
                          if (rowWsn) {
                            wsnCounts.set(rowWsn, (wsnCounts.get(rowWsn) || 0) + 1);
                          }
                        });

                        const isGridDuplicate = (wsnCounts.get(wsn) || 0) > 1;

                        // Check against database
                        const existingRecord = existingQCWSNs.find((item) => item.wsn === wsn);
                        const isSameWarehouseDup = existingRecord?.warehouseid === activeWarehouse?.id;
                        const isCrossWarehouse = existingRecord && existingRecord.warehouseid !== activeWarehouse?.id;

                        // 🔴 CROSS-WAREHOUSE ERROR (different warehouse)
                        if (isCrossWarehouse) {
                          toast.error(`WSN ${wsn} already QC'd in another warehouse`, {
                            duration: 3000,
                            style: {
                              background: '#ffffff',
                              color: '#dc2626',
                              border: '2px solid #dc2626',
                              borderRadius: '8px',
                              padding: '12px 16px',
                              fontWeight: 600,
                              fontSize: '14px',
                              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)',
                            },
                            icon: '🚫',
                          });


                          // Clear cell
                          newRows[rowIndex].wsn = '';
                          ALL_MASTER_COLUMNS.forEach((col) => {
                            newRows[rowIndex][col] = null;
                          });
                          setMultiRows(newRows);
                          return;
                        }

                        // 🟡 SAME WAREHOUSE DUPLICATE
                        if (isSameWarehouseDup) {
                          toast(`WSN ${wsn} already QC'd in this warehouse`, {
                            duration: 2500,
                            style: {
                              background: '#ffffff',
                              color: '#d97706',
                              border: '2px solid #f59e0b',
                              borderRadius: '8px',
                              padding: '12px 16px',
                              fontWeight: 600,
                              fontSize: '14px',
                              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
                            },
                            icon: '⚠️',
                          });


                          // Clear cell
                          newRows[rowIndex].wsn = '';
                          ALL_MASTER_COLUMNS.forEach((col) => {
                            newRows[rowIndex][col] = null;
                          });
                          setMultiRows(newRows);

                          return;
                        }

                        // 🟡 GRID DUPLICATE
                        if (isGridDuplicate) {
                          toast(`Duplicate WSN in grid: ${wsn}`, {
                            duration: 2500,
                            style: {
                              background: '#ffffff',
                              color: '#d97706',
                              border: '2px solid #f59e0b',
                              borderRadius: '8px',
                              padding: '12px 16px',
                              fontWeight: 600,
                              fontSize: '14px',
                              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)',
                            },
                            icon: '⚠️',
                          });


                          // Clear cell
                          newRows[rowIndex].wsn = '';
                          ALL_MASTER_COLUMNS.forEach((col) => {
                            newRows[rowIndex][col] = null;
                          });
                          setMultiRows(newRows);

                          // ✅ UPDATE CHIPS AFTER CLEARING
                          setTimeout(() => {
                            event.api.startEditingCell({
                              rowIndex: rowIndex,
                              colKey: 'wsn',
                            });
                          }, 100);
                          return;
                        }

                        // ✅ VALID WSN - Update row and chips
                        newRows[rowIndex] = { ...newRows[rowIndex], [field]: newValue };
                        setMultiRows(newRows);



                        // Auto add new row at last row
                        if (rowIndex === event.api.getDisplayedRowCount() - 1) {
                          addMultiRow();
                        }

                        // Fetch master data
                        if (newValue?.trim()) {
                          setTimeout(async () => {
                            try {
                              const response = await qcAPI.getPendingInbound(activeWarehouse?.id, newValue);

                              // ✅ ADD DEBUG
                              console.log('🔍 API Response for WSN:', newValue, response.data[0]);

                              if (response.data.length > 0) {
                                const item = response.data[0];
                                setMultiRows((prevRows) => {
                                  const updatedRows = [...prevRows];
                                  updatedRows[rowIndex] = {
                                    ...updatedRows[rowIndex],
                                    // ✅ EXACT MAPPING FROM CONSOLE OUTPUT
                                    fsn: item.fsn || '',
                                    producttitle: item.product_title || '',
                                    brand: item.brand || '',
                                    cmsvertical: item.cms_vertical || '',
                                    hsnsac: item.hsn_sac || '',
                                    igstrate: item.igst_rate || '',
                                    mrp: item.mrp || '',
                                    fsp: item.fsp || '',
                                    vrp: item.vrp || '',
                                    yieldvalue: item.yield_value || '',
                                    psize: item.p_size || '',
                                    ptype: item.p_type || '',
                                    fktlink: item.fkt_link || '',
                                    whlocation: item.wh_location || '',
                                    orderid: item.order_id || '',
                                    fkqcremark: item.fkqc_remark || '',
                                    fkgrade: item.fk_grade || '',
                                    invoicedate: item.invoice_date || '',
                                  };
                                  return updatedRows;
                                });
                              }

                            } catch (error) {
                              console.log('WSN not found in pending inbound');
                            }
                          }, 500);
                        }

                        return;
                      }

                      // ===== OTHER FIELDS (non-WSN) =====
                      newRows[rowIndex] = { ...newRows[rowIndex], [field]: newValue };
                      setMultiRows(newRows);
                    }}

                  />
                </Box>

                {/* ======================== GRID SETTINGS DIALOG ======================== */}
                <Dialog
                  open={gridSettingsOpen}
                  onClose={() => setGridSettingsOpen(false)}
                  maxWidth="xs"
                  fullWidth
                  PaperProps={{
                    sx: {
                      borderRadius: 2,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
                    }
                  }}
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
                      <Alert severity="info" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                        Settings auto-save and persist after reload 💾
                      </Alert>

                      {/* SORTABLE */}
                      <Box>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={gridSettings.sortable}
                              onChange={(e) => updateGridSettings({ ...gridSettings, sortable: e.target.checked })}
                              sx={{
                                '&.Mui-checked': { color: '#f59e0b' }
                              }}
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
                              checked={gridSettings.filter}
                              onChange={(e) => updateGridSettings({ ...gridSettings, filter: e.target.checked })}
                              sx={{
                                '&.Mui-checked': { color: '#f59e0b' }
                              }}
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
                              checked={gridSettings.resizable}
                              onChange={(e) => updateGridSettings({ ...gridSettings, resizable: e.target.checked })}
                              sx={{
                                '&.Mui-checked': { color: '#f59e0b' }
                              }}
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

                      {/* EDITABLE */}
                      <Box>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={gridSettings.editable}
                              onChange={(e) => updateGridSettings({ ...gridSettings, editable: e.target.checked })}
                              sx={{
                                '&.Mui-checked': { color: '#f59e0b' }
                              }}
                            />
                          }
                          label={
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                                ✏️ Enable Cell Editing
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                                Double-click or press Enter to edit cells
                              </Typography>
                            </Box>
                          }
                        />
                      </Box>
                    </Stack>
                  </DialogContent>

                  <DialogActions sx={{ p: 2, background: '#fef3c7', gap: 1 }}>
                    <Button
                      onClick={() => {
                        const defaultSettings = {
                          sortable: true,
                          filter: true,
                          resizable: true,
                          editable: true,
                        };
                        updateGridSettings(defaultSettings);
                        toast.success('Settings reset to default');
                      }}
                      sx={{
                        fontWeight: 700,
                        color: '#78716c',
                        '&:hover': {
                          bgcolor: 'rgba(120, 113, 108, 0.1)'
                        }
                      }}
                    >
                      🔄 Reset All
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Button
                      variant="contained"
                      onClick={() => setGridSettingsOpen(false)}
                      sx={{
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        fontWeight: 700,
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #d97706 0%, #b45309 100)',
                        }
                      }}
                    >
                      Done
                    </Button>
                  </DialogActions>
                </Dialog>



                {/* SUBMIT BUTTON */}
                <Button
                  fullWidth
                  variant="contained"
                  size="medium"
                  onClick={handleMultiSubmit}
                  disabled={multiLoading}
                  sx={{
                    py: 1,
                    borderRadius: 1.5,
                    mb: 1,
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  ✓ SUBMIT ALL ({multiRows.filter((r) => r.wsn?.trim()).length} rows)
                </Button>

                {/* COLUMN SETTINGS DIALOG */}
                <Dialog
                  open={columnSettingsOpen}
                  onClose={() => setColumnSettingsOpen(false)}
                  maxWidth="sm"
                  fullWidth
                  PaperProps={{ sx: { borderRadius: 2 } }}
                >
                  <DialogTitle
                    sx={{
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      py: 2,
                    }}
                  >
                    ⚙️ Column View Settings
                  </DialogTitle>
                  <DialogContent sx={{ py: 3, maxHeight: 600, overflow: 'auto' }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        mb: 2,
                        fontWeight: 800,
                        color: '#667eea',
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                      }}
                    >
                      Editable Fields
                    </Typography>
                    <Stack spacing={1} sx={{ mb: 3 }}>
                      {EDITABLE_COLUMNS.map((col) => (
                        <FormControlLabel
                          key={col}
                          control={
                            <Checkbox
                              checked={visibleColumns.includes(col)}
                              disabled={col === 'sno'}  // ✅ Can't uncheck serial number
                              onChange={(e) => {
                                if (col === 'sno') return;  // ✅ Safety check

                                let next: string[];
                                if (e.target.checked) {
                                  // Add column
                                  next = [...visibleColumns, col];
                                } else {
                                  // Remove column
                                  next = visibleColumns.filter((c: string) => c !== col);
                                }

                                // ✅ Build ordered array respecting user's choices
                                const ordered = [
                                  'sno',  // Always first
                                  ...EDITABLE_COLUMNS.filter(c => c !== 'sno' && next.includes(c)),  // User-selected editable columns
                                  ...ALL_MASTER_COLUMNS.filter(c => next.includes(c))  // User-selected master columns
                                ];

                                saveColumnSettings(ordered);
                              }}
                            />
                          }
                          label={col === 'sno' ? 'S.No' : col.replace(/([A-Z])/g, ' $1').toUpperCase()}
                        />
                      ))}


                    </Stack>

                    <Divider sx={{ my: 2 }} />
                    <Typography
                      variant="subtitle2"
                      sx={{
                        mb: 2,
                        fontWeight: 800,
                        color: '#764ba2',
                        textTransform: 'uppercase',
                        fontSize: '0.75rem',
                      }}
                    >
                      Read-Only Master Data
                    </Typography>
                    <Stack spacing={1}>
                      {ALL_MASTER_COLUMNS.map((col) => (
                        <FormControlLabel
                          key={col}
                          control={
                            <Checkbox
                              checked={visibleColumns.includes(col)}
                              onChange={(e) => {
                                let next: string[];
                                if (e.target.checked) {
                                  // Add column
                                  next = [...visibleColumns, col];
                                } else {
                                  // Remove column
                                  next = visibleColumns.filter((c: string) => c !== col);
                                }

                                // ✅ Build ordered array respecting user's choices
                                const ordered = [
                                  'sno',  // Always first
                                  ...EDITABLE_COLUMNS.filter(c => c !== 'sno' && next.includes(c)),  // User-selected editable columns
                                  ...ALL_MASTER_COLUMNS.filter(c => next.includes(c))  // User-selected master columns
                                ];

                                saveColumnSettings(ordered);
                              }}
                            />
                          }
                          label={col.replace(/([A-Z])/g, ' $1').toUpperCase()}
                        />
                      ))}

                    </Stack>
                  </DialogContent>
                  <DialogActions sx={{ p: 2, background: '#f9fafb' }}>
                    <Button onClick={() => setColumnSettingsOpen(false)} sx={{ fontWeight: 700 }}>
                      Close
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => setColumnSettingsOpen(false)}
                      sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontWeight: 700 }}
                    >
                      Done
                    </Button>
                  </DialogActions>
                </Dialog>
              </Box>
            );
          })()
          }

          {/* ========== TAB 4: BATCH MANAGER ========== */}
          {
            tabValue === 4 && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  p: { xs: 0.25, sm: 0.50 },
                }}
              >
                <Card sx={{
                  borderRadius: 1.5,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  border: '1px solid #e2e8f0',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 800,
                        mb: 3,
                        color: '#1e293b',
                        fontSize: { xs: '1.1rem', sm: '1.25rem' },
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      📦 Batch Management
                    </Typography>

                    {/* BATCHES TABLE */}
                    <Box sx={{
                      flex: 1,
                      border: '2px solid #e2e8f0',
                      borderRadius: 1.5,
                      overflow: 'hidden',
                      background: 'white',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}>
                      <TableContainer sx={{ height: '100%' }}>
                        <Table stickyHeader size="small">
                          <TableHead>
                            <TableRow sx={{
                              background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                              '& th': {
                                fontWeight: 800,
                                color: '#1e293b',
                                fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                textTransform: 'uppercase',
                                py: 1.5,
                                borderRight: '1px solid #cbd5e1',
                                '&:last-child': { borderRight: 'none' }
                              }
                            }}>
                              <TableCell>Batch ID</TableCell>
                              <TableCell>Count</TableCell>
                              <TableCell>Created date</TableCell>
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {batchLoading ? (
                              <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: { xs: 5, sm: 8 } }}>
                                  <CircularProgress size={isMobile ? 35 : 50} sx={{ color: '#667eea' }} />
                                  <Typography sx={{ mt: 1.5, fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>
                                    Loading batches...
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ) : batches.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: { xs: 5, sm: 8 } }}>
                                  <Typography sx={{ fontWeight: 700, color: '#94a3b8', fontSize: { xs: '0.85rem', sm: '1rem' } }}>
                                    📭 No batches found
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#cbd5e1', mt: 0.5, fontSize: '0.7rem' }}>
                                    Batches will appear here after bulk uploads
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ) : (
                              batches.map((batch: any, idx) => (
                                <TableRow
                                  key={batch.batch_id}
                                  sx={{
                                    bgcolor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                      bgcolor: '#f1f5f9',
                                      transform: 'scale(1.001)',
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                    },
                                    '& td': {
                                      fontWeight: 500,
                                      fontSize: { xs: '0.72rem', sm: '0.78rem' },
                                      color: '#334155',
                                      borderRight: '1px solid #e2e8f0',
                                      '&:last-child': { borderRight: 'none' }
                                    }
                                  }}
                                >
                                  <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>
                                    {batch.batch_id}
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      label={batch.count}
                                      sx={{
                                        bgcolor: 'rgba(102, 126, 234, 0.1)',
                                        color: '#667eea',
                                        fontWeight: 700,
                                        fontSize: '0.75rem'
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {formatDate(batch.created_at)}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="error"
                                      onClick={() => handleDeleteBatch(batch.batch_id)}
                                      sx={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        borderWidth: 2,
                                        borderColor: '#dc2626',
                                        color: '#dc2626',
                                        minWidth: 'auto',
                                        px: 1.5,
                                        '&:hover': {
                                          borderWidth: 2,
                                          bgcolor: 'rgba(220, 38, 38, 0.1)',
                                          borderColor: '#b91c1c'
                                        }
                                      }}
                                    >
                                      🗑️ Delete
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            )
          }
        </Paper>

        {/* EXPORT DIALOG */}
        <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>📥 Export QC Data</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField type="date" label="Start Date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
              <TextField type="date" label="End Date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
              <FormControl fullWidth size="small">
                <InputLabel>Grade</InputLabel>
                <Select
                  value={exportGrade}
                  label="Grade"
                  onChange={(e) => setExportGrade(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  {QC_GRADES.map((g) => (
                    <MenuItem key={g} value={g}>
                      {g}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleExport} variant="contained">
              Export
            </Button>
          </DialogActions>
        </Dialog>

        {/* GRADE MANAGEMENT DIALOG */}
        <Dialog open={gradeDialogOpen} onClose={() => { setGradeDialogOpen(false); setNewGrade(''); setEditingGradeIndex(null); }} maxWidth="sm" fullWidth>
          <DialogTitle>⚙️ Manage QC Grades</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1}>
                <TextField
                  label={editingGradeIndex !== null ? 'Edit Grade' : 'New Grade'}
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value.toUpperCase())}
                  fullWidth
                  size="small"
                  placeholder="e.g., A, B, C"
                />
                <Button variant="contained" onClick={handleAddGrade}>
                  {editingGradeIndex !== null ? 'Update' : 'Add'}
                </Button>
              </Stack>

              <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2 }}>
                Current Grades:
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {QC_GRADES.map((grade, idx) => (
                  <Chip
                    key={grade}
                    label={grade}
                    onDelete={() => handleDeleteGrade(idx)}
                    onClick={() => { setNewGrade(grade); setEditingGradeIndex(idx); }}
                    icon={<EditIcon />}
                  />
                ))}
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setGradeDialogOpen(false); setNewGrade(''); setEditingGradeIndex(null); }}>Done</Button>
          </DialogActions>
        </Dialog>

        {/* COLUMN SETTINGS - LIST */}
        <Dialog open={listColumnSettingsOpen} onClose={() => setListColumnSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>⚙️ Column Settings</DialogTitle>
          <DialogContent>
            <Stack spacing={1} sx={{ mt: 2 }}>
              {ALL_LIST_COLUMNS.map((col) => (
                <FormControlLabel
                  key={col}
                  control={
                    <Checkbox
                      checked={listColumns.find(c => c.key === col)?.visible || false}
                      onChange={() => handleListColumnToggle(col)}

                    />
                  }
                  label={col.toUpperCase().replace(/_/g, ' ')}
                />
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setListColumnSettingsOpen(false)}>Done</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AppLayout>
  );
}