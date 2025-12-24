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
} from '@mui/material';
import {
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Edit as EditIcon,
  CheckCircle,
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
  'wsn',
  'product_serial_number',
  'rack_no',
  'qc_grade',
  'qc_remarks',
  'other_remarks',
  'product_title',
  'brand',
  'cms_vertical',
  'mrp',
  'fsp',
  'fkt_link',
];

// Constants
const DEFAULT_MULTI_COLUMNS = [
  'wsn',
  'product_serial_number',
  'rack_no',
  'qc_grade',
  'qc_remarks',
  'other_remarks',
];

const ALL_MASTER_COLUMNS = ['product_title', 'brand', 'cms_vertical', 'mrp', 'fsp', 'fkt_link'];
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
  const [user, setUser] = useState<any>(null);
  const [tabValue, setTabValue] = useState(0);

  // QC LIST STATE
  const [qcList, setQcList] = useState<QCItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
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

  // MULTI ENTRY STATE
  const generateEmptyRows = (count: number) => {
    return Array.from({ length: count }, () => ({
      wsn: '',
      qc_date: new Date().toISOString().split('T')[0],
      qc_by_name: '',
      product_serial_number: '',
      rack_no: '',
      qc_grade: '',
      qc_remarks: '',
      other_remarks: '',
      product_title: '',
      brand: '',
      cms_vertical: '',
      mrp: '',
      fsp: '',
      fkt_link: '',
    }));
  };

  const [multiRows, setMultiRows] = useState<any[]>(generateEmptyRows(10));
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiResults, setMultiResults] = useState<any[]>([]);
  const [duplicateWSNs, setDuplicateWSNs] = useState<Set<string>>(new Set());
  const [crossWarehouseWSNs, setCrossWarehouseWSNs] = useState<Set<string>>(new Set());
  const [gridDuplicateWSNs, setGridDuplicateWSNs] = useState<Set<string>>(new Set());
  const [existingQCWSNs, setExistingQCWSNs] = useState(new Set());
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_MULTI_COLUMNS);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [commonQcDate, setCommonQcDate] = useState('');
  const [commonQcByName, setCommonQcByName] = useState('');

  // Fetch all existing QC'd WSNs on mount (for cross-warehouse checking)
  useEffect(() => {
    async function fetchExistingWSNs() {
      try {
        const res = await qcAPI.getAllQCWSNs();
        setExistingQCWSNs(new Set(res.data));
      } catch (error) {
        console.error('Failed to fetch existing QC WSNs', error);
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

  // Calculate status counts for Multi QC
  const statusCounts = useMemo(() => {
    let ready = 0;
    let duplicate = 0;
    let cross = 0;

    multiRows.forEach(row => {
      if (!row.wsn?.trim()) return;

      const wsn = row.wsn.trim().toUpperCase();

      if (crossWarehouseWSNs.has(wsn)) cross++;
      else if (gridDuplicateWSNs.has(wsn)) duplicate++;
      else ready++;
    });

    return { ready, duplicate, cross };
  }, [multiRows, gridDuplicateWSNs, crossWarehouseWSNs]);

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

  // ✅ CHECK DUPLICATES IN GRID
  const checkDuplicates = useCallback(async (rows: any[]) => {
    const gridDup = new Set<string>();
    const crossWh = new Set<string>();
    const wsnCounts = new Map<string, number>();

    rows.forEach((row) => {
      const wsn = row.wsn?.trim()?.toUpperCase();
      if (!wsn) return;

      // Grid duplicate counting
      wsnCounts.set(wsn, (wsnCounts.get(wsn) || 0) + 1);
      if (wsnCounts.get(wsn)! > 1) {
        gridDup.add(wsn);
      }

      // Check if already QC'd (any warehouse)
      if (existingQCWSNs.has(wsn)) {
        crossWh.add(wsn);
      }
    });

    setGridDuplicateWSNs(gridDup);
    setCrossWarehouseWSNs(crossWh);

    // Backward compatibility (submit button disable)
    setDuplicateWSNs(
      new Set([
        ...Array.from(gridDup),
        ...Array.from(crossWh)
      ])
    );
  }, [existingQCWSNs]);

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

    try {
      // Try pending inbound first
      const pendingResponse = await qcAPI.getPendingInbound(activeWarehouse?.id, wsn);
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
        search: wsn,
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
  const loadQCList = async () => {
    setListLoading(true);
    try {
      const response = await qcAPI.getList(page, limit, {
        warehouseId: activeWarehouse?.id,
        search: searchFilter,
        qcStatus: statusFilter,
        qc_grade: gradeFilter,
        brand: brandFilter,
        category: categoryFilter,
        dateFrom: dateFromFilter,
        dateTo: dateToFilter,
      });

      setQcList(response.data?.data || []);
      setTotal(response.data?.total || 0);
    } catch (error) {
      toast.error('Failed to load QC list');
    } finally {
      setListLoading(false);
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

  const downloadBulkTemplate = () => {
    const template = [
      {
        WSN: 'ABC123_A',
        QC_BY_NAME: 'John Doe',
        QC_DATE: new Date().toISOString().split('T'),
        GRADE: 'A',
        QC_REMARKS: 'All checks passed',
        OTHER_REMARKS: 'Package condition good',
        PRODUCT_SERIAL_NUMBER: 'SN12345',
        RACK_NO: 'A-01',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'QC_Bulk_Template.xlsx');
    toast.success('✓ Template downloaded');
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
    wsn: { width: 80 },
    product_serial_number: { width: 160 },
    rack_no: { width: 80 },
    qc_grade: { width: 80 },
    qc_remarks: { flex: 1, minWidth: 90 },
    other_remarks: { flex: 1, minWidth: 100 },

    // Master data columns
    product_title: { flex: 2, minWidth: 220 },
    brand: { width: 90 },
    cms_vertical: { width: 100 },
    mrp: { width: 40 },
    fsp: { width: 40 },
    fkt_link: { width: 50 },
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
      setGridDuplicateWSNs(new Set());
      setCrossWarehouseWSNs(new Set());

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

  return (
    <AppLayout>
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#363636', color: '#fff', borderRadius: '10px', padding: '16px', fontWeight: 600 }, success: { iconTheme: { primary: '#10b981', secondary: '#fff' } }, error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } } }} />

      <Box sx={{
        p: { xs: 0.8, md: 1 },
        background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)', minHeight: '100vh', width: '100%'
      }}>
        {/* HEADER */}
        <Box sx={{ mb: 0.8, p: 0.8, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 1, boxShadow: '0 8px 24px rgba(102, 126, 234, 0.25)' }}>
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', mb: 0.2, fontSize: '0.85rem' }}>✅ QC Management</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip label={activeWarehouse.name} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, height: '18px', fontSize: '0.65rem' }} />
              <Chip label={user?.full_name} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 500, height: '18px', fontSize: '0.65rem' }} />
            </Stack>
          </Box>
        </Box>


        {/* TABS */}
        <Paper sx={{ mb: 0.5, borderRadius: 1, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', background: 'rgba(255, 255, 255, 0.95)' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto" sx={{ '& .MuiTabs-indicator': { height: 3, background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)', borderRadius: '2px 2px 0 0' }, '& .MuiTab-root': { fontWeight: 600, fontSize: '0.7rem', textTransform: 'none', minHeight: 32, py: 0.5 } }}>
            <Tab label="QC List" />
            <Tab label="Single QC" />
            <Tab label="Bulk Upload" />
            <Tab label="Multi QC" />
            <Tab label="Batch Manager" />
          </Tabs>
        </Paper>

        {/* ========== TAB 0: QC LIST ========== */}
        {tabValue === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 230px)' }}>
            {/* FILTERS */}
            <Card sx={{ mb: 1, borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', background: 'rgba(255, 255, 255, 0.98)' }}>
              <CardContent sx={{ p: 1 }}>
                <Stack spacing={1}>
                  {/* ROW 1: Search + Dates */}
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center">
                    <TextField size="small" placeholder="Search WSN or Product" value={searchFilter} onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }} fullWidth sx={{ '& .MuiOutlinedInput-root': { height: 40 } }} />
                    <TextField label="From Date" type="date" size="small" InputLabelProps={{ shrink: true }} value={dateFromFilter} onChange={(e) => { setDateFromFilter(e.target.value); setPage(1); }} sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 40 } }} />
                    <TextField label="To Date" type="date" size="small" InputLabelProps={{ shrink: true }} value={dateToFilter} onChange={(e) => { setDateToFilter(e.target.value); setPage(1); }} sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 40 } }} />
                  </Stack>

                  {/* ROW 2: Filters */}
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center">
                    <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 40 } }}>
                      <MenuItem value="">All Status</MenuItem>
                      {QC_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" label="Grade" value={gradeFilter} onChange={(e) => { setGradeFilter(e.target.value); setPage(1); }} sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 40 } }}>
                      <MenuItem value="">All Grades</MenuItem>
                      {QC_GRADES.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" label="Brand" value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }} sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 40 } }}>
                      <MenuItem value="">All Brands</MenuItem>
                      {brands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" label="Category" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 40 } }}>
                      <MenuItem value="">All Categories</MenuItem>
                      {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>

                    {/* BUTTONS */}
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" variant="outlined" onClick={() => { setSearchFilter(''); setStatusFilter(''); setGradeFilter(''); setBrandFilter(''); setCategoryFilter(''); setDateFromFilter(''); setDateToFilter(''); setPage(1); }} sx={{ height: 40, minWidth: 70, fontSize: '0.7rem', fontWeight: 700 }}>Clear</Button>
                      <Button size="small" variant="contained" onClick={loadQCList} sx={{ height: 40, minWidth: 70, fontSize: '0.7rem', fontWeight: 700, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>Search</Button>
                      <Button size="small" variant="outlined" startIcon={<SettingsIcon />} onClick={() => setListColumnSettingsOpen(true)} sx={{ height: 40, fontSize: '0.7rem', fontWeight: 700 }}>Columns</Button>
                      <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => setExportDialogOpen(true)} sx={{ height: 40, fontSize: '0.7rem', fontWeight: 700 }}>Export</Button>
                      <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={loadQCList} sx={{ height: 40, fontSize: '0.7rem', fontWeight: 700 }}>Refresh</Button>
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {/* TABLE - Scrollable */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, border: '1px solid #d1d5db', position: 'relative' }}>
              <TableContainer component={Paper} sx={{ borderRadius: 0, boxShadow: 'none', border: 'none', background: '#ffffff', height: '100%' }}>
                <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { borderRight: '1px solid #d1d5db', padding: '4px 8px', fontSize: '0.75rem', minWidth: 120 } }}>
                  <TableHead>
                    <TableRow sx={{ background: '#e5e7eb' }}>
                      <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.5, whiteSpace: 'nowrap' }}>No.</TableCell>
                      {listColumns
                        .filter(c => c.visible)
                        .map(c => (
                          <TableCell
                            key={c.key}
                            sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.5, whiteSpace: 'nowrap' }}
                          >
                            {c.key.replace(/_/g, ' ')}
                          </TableCell>
                        ))}

                      <TableCell sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.5, whiteSpace: 'nowrap' }}>ACTION</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {listLoading ? (
                      <TableRow>
                        <TableCell colSpan={listColumns.length + 2} sx={{ textAlign: 'center', py: 3 }}>
                          <CircularProgress size={30} />
                        </TableCell>
                      </TableRow>
                    ) : qcList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={listColumns.length + 2} sx={{ textAlign: 'center', py: 3 }}>
                          📭 No data
                        </TableCell>
                      </TableRow>
                    ) : (
                      qcList.map((item: any, idx) => (
                        <TableRow key={item.id} sx={{ bgcolor: idx % 2 === 0 ? '#ffffff' : '#f9fafb', '&:hover': { bgcolor: '#f0f0f0' } }}>
                          <TableCell sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(page - 1) * limit + idx + 1}</TableCell>
                          {listColumns
                            .filter(c => c.visible)
                            .map(c => (
                              <TableCell key={c.key} sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {c.key === 'qc_date' || c.key === 'inbound_date' || c.key === 'updated_at'
                                  ? formatDate(item[c.key])
                                  : (item[c.key] ? String(item[c.key]).substring(0, 50) : '-')}
                              </TableCell>
                            ))}

                          <TableCell>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => handleDeleteQCEntry(item.id)}
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

            {/* PAGINATION */}
            <Stack
              direction="row"
              spacing={1}
              justifyContent="space-between"
              alignItems="center"
              sx={{
                mt: 1,
                p: 1,
                mb: -13,
                background: 'rgba(255, 255, 255, 0.98)',
                borderRadius: 1.5,
                border: '1px solid rgba(0,0,0,0.08)'
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.7rem' }}>
                📊 {qcList.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, total)} of {total}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" disabled={page === 1} onClick={() => setPage(page - 1)} sx={{ fontSize: '0.75rem', fontWeight: 600 }}>◀ Prev</Button>
                <Box sx={{ px: 2, border: '1.5px solid #667eea', borderRadius: 1.5, background: 'rgba(102, 126, 234, 0.08)', display: 'flex', alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: 700, color: '#667eea', fontSize: '0.8rem' }}>{page} / {Math.ceil(total / limit) || 1}</Typography>
                </Box>
                <Button size="small" variant="outlined" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)} sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Next ▶</Button>
              </Stack>
            </Stack>
          </Box>
        )}

        {/* ========== TAB 1: SINGLE QC ========== */}
        {tabValue === 1 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
            <Card sx={{ borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, color: '#1a237e', fontSize: '0.9rem' }}>📝 QC Entry Form</Typography>

                {duplicateQC && (
                  <Alert severity="warning" sx={{ mb: 1.5, py: 0.5, fontSize: '0.75rem' }}>
                    QC already exists. Click "Update" to modify.
                  </Alert>
                )}

                <Stack spacing={1.2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="WSN *"
                    value={singleWSN}
                    onChange={(e) => setSingleWSN(e.target.value)}
                    onBlur={() => fetchProductDetails(singleWSN)}
                    placeholder="Enter WSN"
                  />

                  <TextField
                    fullWidth
                    size="small"
                    label="QC By Name"
                    value={singleForm.qc_by_name}
                    onChange={(e) => setSingleForm({ ...singleForm, qc_by_name: e.target.value })}
                  />

                  <TextField
                    fullWidth
                    size="small"
                    label="QC Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={singleForm.qc_date}
                    onChange={(e) => setSingleForm({ ...singleForm, qc_date: e.target.value })}
                  />

                  <TextField
                    fullWidth
                    size="small"
                    label="Product Serial Number"
                    value={singleForm.product_serial_number}
                    onChange={(e) => setSingleForm({ ...singleForm, product_serial_number: e.target.value })}
                  />

                  <FormControl fullWidth size="small">
                    <InputLabel>Grade</InputLabel>
                    <Select
                      value={singleForm.qc_grade}
                      label="Grade"
                      onChange={(e) => setSingleForm({ ...singleForm, qc_grade: e.target.value })}
                    >
                      <MenuItem value="">Select Grade</MenuItem>
                      {QC_GRADES.map((g) => (
                        <MenuItem key={g} value={g}>
                          {g}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    label="QC Remarks"
                    value={singleForm.qc_remarks}
                    onChange={(e) => setSingleForm({ ...singleForm, qc_remarks: e.target.value })}
                  />

                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    label="Other Remarks"
                    value={singleForm.other_remarks}
                    onChange={(e) => setSingleForm({ ...singleForm, other_remarks: e.target.value })}
                  />

                  {duplicateQC ? (
                    <Stack direction="row" spacing={1}>
                      <Button
                        fullWidth
                        variant="contained"
                        size="small"
                        onClick={handleSingleSubmit}
                        disabled={singleLoading}
                        sx={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', py: 0.8, fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        🔄 Update
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        size="small"
                        onClick={() => setGradeDialogOpen(true)}
                        sx={{ py: 0.8, fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        Manage Grades
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
                        sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', py: 0.8, fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        ✓ Submit QC
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setGradeDialogOpen(true)}
                        sx={{ py: 0.8, fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        Grades
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {singleProduct.product_title && (
              <Card sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', border: '2px solid #10b981' }}>
                <CardContent sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <CheckCircle sx={{ color: '#10b981', fontSize: 28 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#065f46', fontSize: '0.95rem' }}>Master Data Found</Typography>
                  </Stack>
                  <Divider sx={{ mb: 1.5, borderColor: 'rgba(5, 150, 105, 0.3)' }} />
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>FSN</Typography>
                      <Typography sx={{ fontWeight: 700, color: '#047857' }}>{singleProduct.fsn || 'N/A'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>PRODUCT</Typography>
                      <Typography sx={{ fontWeight: 600, color: '#047857', fontSize: '0.85rem' }}>{singleProduct.product_title || 'N/A'}</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>BRAND</Typography>
                        <Typography sx={{ fontWeight: 700, color: '#047857' }}>{singleProduct.brand || 'N/A'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>CATEGORY</Typography>
                        <Typography sx={{ fontWeight: 700, color: '#047857' }}>{singleProduct.cms_vertical || 'N/A'}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>MRP</Typography>
                        <Typography sx={{ fontWeight: 700, color: '#047857' }}>{singleProduct.mrp || 'N/A'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>FSP</Typography>
                        <Typography sx={{ fontWeight: 700, color: '#047857' }}>{singleProduct.fsp || 'N/A'}</Typography>
                      </Box>
                    </Box>
                    {singleProduct.fkt_link && (
                      <Box>
                        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>LINK</Typography>
                        <Typography
                          sx={{ fontWeight: 600, color: '#047857', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => window.open(singleProduct.fkt_link, '_blank')}
                        >
                          View Product →
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Box>
        )}

        {/* ========== TAB 2: BULK UPLOAD ========== */}
        {tabValue === 2 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              📤 Bulk Upload QC
            </Typography>

            {bulkProgress.show && (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  ⏳ Processing {bulkProgress.batchId}: {bulkProgress.processed}/{bulkProgress.total}
                </Alert>
                <LinearProgress
                  variant="determinate"
                  value={(bulkProgress.processed / bulkProgress.total) * 100}
                  sx={{ mb: 2 }}
                />
              </>
            )}

            <Stack spacing={2}>
              <Box>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setBulkFile(e.currentTarget.files?.[0] || null)}
                  style={{ padding: '8px', width: '100%' }}
                />
              </Box>

              {bulkFile && (
                <Chip
                  label={`✓ ${bulkFile.name} (${(bulkFile.size / 1024 / 1024).toFixed(2)} MB)`}
                  color="success"
                />
              )}

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  onClick={handleBulkUpload}
                  disabled={bulkLoading || !bulkFile}
                >
                  {bulkLoading ? 'Uploading...' : 'Submit'}
                </Button>

                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadBulkTemplate}>
                  Download Template
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}

        {/* ========== TAB 3: MULTI QC (AG GRID) ========== */}
        {tabValue === 3 && (() => {
          // Column definitions for AG Grid
          const columnDefs = visibleColumns.map((field) => {
            const widthConfig = COLUMN_WIDTHS[field] || {};
            const baseColDef: any = {
              field,
              headerName: field.replace(/_/g, ' ').toUpperCase(),
              ...widthConfig,
              cellStyle: (params: any) => {
                const wsn = params.data?.wsn?.trim()?.toUpperCase();
                const styles: any = {};

                // Master data columns get gray background
                if (ALL_MASTER_COLUMNS.includes(field)) {
                  styles.backgroundColor = '#f5f5f5';
                }

                // WSN validation colors
                if (wsn && field === 'wsn') {
                  if (crossWarehouseWSNs.has(wsn)) {
                    styles.backgroundColor = '#fee';
                    styles.color = '#c00';
                  } else if (gridDuplicateWSNs.has(wsn)) {
                    styles.backgroundColor = '#fff3cd';
                    styles.color = '#856404';
                  }
                }

                return styles;
              },
            };

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
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 175px)',
              gap: 1,
              mt: 0
            }}>
              {/* HEADER */}
              <Card sx={{ borderRadius: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <CardContent sx={{ p: 1.2, '&:last-child': { pb: 1.2 } }}>
                  <Stack direction="row" spacing={2} alignItems="center">

                    {/* COMMON FIELDS */}
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

                    {/* STATUS CHIPS */}
                    <Stack direction="row" spacing={0.5} sx={{ ml: 'auto !important' }}>
                      <Chip
                        label={`✅ READY: ${statusCounts.ready}`}
                        sx={{ bgcolor: '#d1fae5', color: '#065f46', fontWeight: 700 }}
                        size="small"
                      />
                      <Chip
                        label={`🟡 DUPLICATE: ${statusCounts.duplicate}`}
                        sx={{ bgcolor: '#fef9c3', color: '#854d0e', fontWeight: 700 }}
                        size="small"
                      />
                      <Chip
                        label={`🔴 CROSS-WH: ${statusCounts.cross}`}
                        sx={{ bgcolor: '#fee2e2', color: '#7f1d1d', fontWeight: 700 }}
                        size="small"
                      />
                    </Stack>




                    <Stack direction="row" spacing={0.8}>
                      <Button size="small" variant="outlined" onClick={() =>
                        setColumnSettingsOpen(true)} sx={{
                          fontSize: '0.7rem',
                          fontWeight: 700
                        }}>⚙️ Columns</Button>
                      {/* <Button size="small" variant="contained" onClick={add10Rows} sx={{ fontSize: '0.7rem', fontWeight: 700, background: '#8b5cf6' }}>+10</Button> */}
                      <Button size="small" variant="contained" onClick={add30Rows}
                        sx={{ fontSize: '0.7rem', fontWeight: 700, background: '#ec4899' }}>+30 Add Rows </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {/* ERROR */}
              {crossWarehouseWSNs.size > 0 && (
                <Alert severity="error" sx={{ mb: 0.5, fontWeight: 700 }}>
                  ❌ Some WSNs are already QC'd. Remove them to proceed.
                </Alert>
              )}

              {gridDuplicateWSNs.size > 0 && (
                <Alert severity="warning" sx={{ mb: 0.5, fontWeight: 700 }}>
                  ⚠️ Duplicate WSNs found inside the grid.
                </Alert>
              )}

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
                    sortable: false,
                    filter: false,
                    resizable: true,
                    editable: (params) => {
                      const field = params.colDef.field as string;
                      const wsn = params.data?.wsn?.trim()?.toUpperCase();

                      if (!wsn) return EDITABLE_COLUMNS.includes(field);

                      if (crossWarehouseWSNs.has(wsn)) return false;

                      if (gridDuplicateWSNs.has(wsn)) {
                        return field === 'wsn';
                      }

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

                    // WSN clear -> master clear
                    if (field === 'wsn' && (!newValue || newValue.trim() === '')) {
                      newRows[rowIndex] = { ...newRows[rowIndex], [field]: newValue };
                      ALL_MASTER_COLUMNS.forEach((col) => {
                        newRows[rowIndex][col] = null;
                      });
                      setMultiRows(newRows);
                      checkDuplicates(newRows);
                      return;
                    }

                    newRows[rowIndex] = { ...newRows[rowIndex], [field]: newValue };
                    setMultiRows(newRows);

                    if (field === 'wsn') {
                      // Check duplicates immediately before validation
                      checkDuplicates(newRows);

                      const wsn = newValue?.trim()?.toUpperCase();

                      // Calculate duplicates inline for immediate feedback
                      const wsnCounts = new Map<string, number>();
                      newRows.forEach((row) => {
                        const rowWsn = row.wsn?.trim()?.toUpperCase();
                        if (rowWsn) {
                          wsnCounts.set(rowWsn, (wsnCounts.get(rowWsn) || 0) + 1);
                        }
                      });

                      const isGridDuplicate = (wsnCounts.get(wsn) || 0) > 1;
                      const isCrossWarehouse = existingQCWSNs.has(wsn);

                      // 🔴 Already QC'd → clear cell and stay
                      if (isCrossWarehouse) {
                        toast.error(`WSN ${wsn} already QC'd - cannot re-QC`);

                        // Clear the cell
                        newRows[rowIndex].wsn = '';
                        ALL_MASTER_COLUMNS.forEach((col) => {
                          newRows[rowIndex][col] = null;
                        });
                        setMultiRows(newRows);
                        checkDuplicates(newRows);

                        setTimeout(() => {
                          event.api.startEditingCell({
                            rowIndex: rowIndex,
                            colKey: 'wsn',
                          });
                        }, 0);
                        return;
                      }

                      // 🟡 Grid duplicate → clear cell and stay
                      if (isGridDuplicate) {
                        toast(`Duplicate WSN in grid: ${wsn}`, { icon: '⚠️' });

                        // Clear the cell
                        newRows[rowIndex].wsn = '';
                        ALL_MASTER_COLUMNS.forEach((col) => {
                          newRows[rowIndex][col] = null;
                        });
                        setMultiRows(newRows);
                        checkDuplicates(newRows);

                        setTimeout(() => {
                          event.api.startEditingCell({
                            rowIndex: rowIndex,
                            colKey: 'wsn',
                          });
                        }, 0);
                        return;
                      }

                      // Auto add new row at last row
                      if (rowIndex === event.api.getDisplayedRowCount() - 1) {
                        addMultiRow();
                      }

                      // Fetch master data
                      if (newValue?.trim()) {
                        setTimeout(async () => {
                          try {
                            const response = await qcAPI.getPendingInbound(activeWarehouse?.id, newValue);
                            if (response.data.length > 0) {
                              const item = response.data[0];
                              setMultiRows((prevRows) => {
                                const updatedRows = [...prevRows];
                                updatedRows[rowIndex] = { ...updatedRows[rowIndex] };
                                ALL_MASTER_COLUMNS.forEach((masterCol) => {
                                  updatedRows[rowIndex][masterCol] = item[masterCol] || null;
                                });
                                return updatedRows;
                              });
                            }
                          } catch (error) {
                            console.log('WSN not found in pending inbound');
                          }
                        }, 500);
                      }
                    }
                  }}
                />
              </Box>

              {/* SUBMIT BUTTON */}
              <Button
                fullWidth
                variant="contained"
                size="medium"
                onClick={handleMultiSubmit}
                disabled={multiLoading || gridDuplicateWSNs.size > 0 || crossWarehouseWSNs.size > 0}
                sx={{
                  py: 1,
                  borderRadius: 1.5,
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                }}
              >
                ✓ SUBMIT ALL ({multiRows.filter((r) => r.wsn?.trim()).length} rows)
              </Button>

              {/* RESULTS */}
              {
                multiResults.length > 0 && (
                  <Alert severity="info">
                    ✓ {multiResults.filter((r: any) => r.status === 'SUCCESS').length} success, ✗{' '}
                    {multiResults.filter((r: any) => r.status === 'ERROR').length} errors
                  </Alert>
                )
              }

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
                            onChange={(e) => {
                              let next = visibleColumns;

                              if (e.target.checked) {
                                next = [...visibleColumns, col];
                              } else {
                                next = visibleColumns.filter((c) => c !== col);
                              }

                              const ordered = [...EDITABLE_COLUMNS, ...ALL_MASTER_COLUMNS].filter((c) => next.includes(c));

                              saveColumnSettings(ordered);
                            }}
                          />
                        }
                        label={col.replace(/_/g, ' ').toUpperCase()}
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
                              let next = visibleColumns;

                              if (e.target.checked) {
                                next = [...visibleColumns, col];
                              } else {
                                next = visibleColumns.filter((c) => c !== col);
                              }

                              const ordered = [...EDITABLE_COLUMNS, ...ALL_MASTER_COLUMNS].filter((c) => next.includes(c));

                              saveColumnSettings(ordered);
                            }}
                          />
                        }
                        label={col.replace(/_/g, ' ').toUpperCase()}
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
        })()}

        {/* ========== TAB 4: BATCH MANAGER ========== */}
        {
          tabValue === 4 && (
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                📦 Batch Management
              </Typography>

              <TableContainer sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow sx={{ background: '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Batch ID</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Count</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Created At</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>ACTION</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batchLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} sx={{ textAlign: 'center', py: 3 }}>
                          <CircularProgress size={30} />
                        </TableCell>
                      </TableRow>
                    ) : batches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} sx={{ textAlign: 'center', py: 3 }}>
                          No batches
                        </TableCell>
                      </TableRow>
                    ) : (
                      batches.map((batch: any) => (
                        <TableRow key={batch.batch_id}>
                          <TableCell>{batch.batch_id}</TableCell>
                          <TableCell>{batch.count}</TableCell>
                          <TableCell>{formatDate(batch.created_at)}</TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => handleDeleteBatch(batch.batch_id)}
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
          )
        }

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
    </AppLayout >
  );

}
