// File Path = warehouse-frontend\app\inbound\page.tsx
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip, Stack, Tab, Tabs,
  CircularProgress, Alert, Card, CardContent, LinearProgress, Divider,
  Select, FormControl, InputLabel, Checkbox, FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon, Download as DownloadIcon, Upload as UploadIcon,
  Settings as SettingsIcon, CheckCircleOutline as CheckIcon, Info as InfoIcon,
  Delete as DeleteIcon, Refresh as RefreshIcon,
  CheckCircle
} from '@mui/icons-material';
import { inboundAPI } from '@/lib/api';
import { useWarehouse } from '@/app/context/WarehouseContext';
import { getStoredUser } from '@/lib/auth';
import AppLayout from '@/components/AppLayout';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import Tooltip from '@mui/material/Tooltip';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { printLabel, isAgentRunning } from '@/lib/printAgent';
import { useRoleGuard, checkRole } from '@/hooks/useRoleGuard';

// Constants
const DEFAULT_MULTI_COLUMNS = [
  'wsn',
  'product_serial_number',
  'rack_no',
  'unload_remarks'
];

const ALL_MASTER_COLUMNS = ['wid', 'fsn', 'order_id', 'product_title', 'brand', 'mrp', 'fsp', 'hsn_sac', 'igst_rate', 'cms_vertical', 'fkt_link', 'p_type', 'p_size', 'vrp', 'yield_value'];
const INBOUND_LIST_COLUMNS = [
  'wsn',
  'product_title',
  'brand',
  'cms_vertical',
  'fsp',
  'mrp',
  'inbound_date',
  'vehicle_no',
  'rack_no',
  'quantity',
  'batch_id',
  'product_serial_number',
  'unload_remarks',
  'created_user_name',
  'fkqc_remark',
  'fk_grade'
];

const EDITABLE_COLUMNS = ['wsn', 'product_serial_number', 'rack_no', 'unload_remarks'];

import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import React from 'react';

// Register AG Grid modules ONCE
ModuleRegistry.registerModules([AllCommunityModule]);

export default function InboundPage() {
  // Role guard - only admin, manager, operator can access
  useRoleGuard(['admin', 'manager', 'operator']);

  const router = useRouter();
  const { activeWarehouse } = useWarehouse();
  const [user, setUser] = useState<any>(null);
  const [tabValue, setTabValue] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [agentReady, setAgentReady] = useState(false);


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
  const [bulkCurrentBatch, setBulkCurrentBatch] = useState<any>(null);
  const [bulkErrors, setBulkErrors] = useState<any[]>([]);
  const [bulkErrorsOpen, setBulkErrorsOpen] = useState(false);

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

  const [multiRows, setMultiRows] = useState<any[]>(generateEmptyRows(10));
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiResults, setMultiResults] = useState<any[]>([]);
  const [duplicateWSNs, setDuplicateWSNs] = useState<Set<string>>(new Set());

  const [crossWarehouseWSNs, setCrossWarehouseWSNs] = useState<Set<string>>(new Set());
  const [gridDuplicateWSNs, setGridDuplicateWSNs] = useState<Set<string>>(new Set());

  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_MULTI_COLUMNS);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [commonDate, setCommonDate] = useState(new Date().toISOString().split('T')[0]);
  const [commonVehicle, setCommonVehicle] = useState('');
  const [multiErrorMessage, setMultiErrorMessage] = useState('');
  const [scrollTop, setScrollTop] = useState(0);

  // ====== INBOUND LIST STATE ======
  const [listData, setListData] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [total, setTotal] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [listColumns, setListColumns] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('inboundListColumns');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.log('Column settings load error');
        }
      }
    }
    return [
      'wsn',
      'product_title',
      'brand',
      'inbound_date',
      'vehicle_no',
      'rack_no',
      'quantity',
      'batch_id',
      'product_serial_number',
      'unload_remarks'
    ];
  });


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
        setExistingInboundWSNs(new Set(res.data));
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
        const cols = JSON.parse(saved);
        setVisibleColumns(cols);
        return;
      } catch (e) {
        console.log('Column settings load error');
      }
    }

    setVisibleColumns(DEFAULT_MULTI_COLUMNS);
  }, []);

  // ====== PRINT AGENT CHECK ======
  useEffect(() => {
    const checkAgent = async () => {
      const running = await isAgentRunning();
      setAgentReady(running);
      if (running) {
        console.log('✅ Print Agent is ready');
      } else {
        console.warn('⚠️ Print Agent not detected - printing will not work');
      }
    };

    checkAgent();

    // Check every 10 seconds if agent status changes
    const interval = setInterval(checkAgent, 10000);
    return () => clearInterval(interval);
  }, []);


  // ✅ ISSUE #1, #3 - SAVE COLUMN SETTINGS
  const saveColumnSettings = (cols: string[]) => {
    setVisibleColumns(cols);
    localStorage.setItem('multiEntryColumns', JSON.stringify(cols));
    //toast.success('✓ Columns saved');
  };

  const saveListColumnSettings = (cols: string[]) => {
    setListColumns(cols);
    localStorage.setItem('inboundListColumns', JSON.stringify(cols));
    //toast.success('✓ List columns saved');
  };

  // ====== LOAD DATA ON TAB CHANGE ======
  useEffect(() => {
    if (activeWarehouse && (tabValue === 0 || tabValue === 1)) {
      loadRacks();
      loadBatches();
      loadBrands();
      loadCategories();
      if (tabValue === 0) loadInboundList();
    }
  }, [activeWarehouse, tabValue]);

  useEffect(() => {
    if (activeWarehouse && tabValue === 0) {
      loadInboundList();
    }
  }, [activeWarehouse, page, limit, searchFilter, brandFilter, categoryFilter, dateFromFilter, dateToFilter]);

  // ====== RACK MANAGEMENT ======
  const loadRacks = async () => {
    try {
      const response = await inboundAPI.getWarehouseRacks(activeWarehouse?.id);
      setRacks(response.data);
    } catch (error) {
      console.error('Failed to load racks');
    }
  };

  // ====== GET PRINTING SETTINGS ======
  const getPrintingSettings = async () => {
    try {
      const response = await fetch('http://127.0.0.1:9100/config', {
        method: 'GET',
        mode: 'cors',
      });

      if (response.ok) {
        const data = await response.json();
        return data.config;
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch printing settings');
    }

    return null;
  };

  // ====== PRINTING FUNCTION ======

  const triggerPrint = async (wsn: string, masterData?: any) => {
    if (!agentReady) {
      console.warn('⚠️ Print agent not available');
      return;
    }

    try {
      // Get printing settings from agent
      const settings = await getPrintingSettings();

      // CHECK: Is printing enabled?
      if (settings && !settings.printingEnabled) {
        console.log('⏸️ Printing disabled in settings - skipping print');
        return;
      }

      console.log(`🖨️ Printing WSN: ${wsn}`);

      // Get copy count from settings (fallback to 1)
      const copies = 1;

      const success = await printLabel({
        wsn,
        product_title: masterData?.product_title || '',
        brand: masterData?.brand || '',
        mrp: masterData?.mrp || '',
        fsp: masterData?.fsp || '',
        fsn: masterData?.fsn || masterData?.fsn_code || '',
        product_serial_number: masterData?.product_serial_number || '',
        copies: copies,
      });

      if (success) {
        console.log(`✅ Print sent successfully (${copies} copies)`);
      } else {
        console.warn('⚠️ Print failed - but entry was created');
      }
    } catch (err) {
      console.error('❌ Print error:', err);
      // Don't throw - allow entry creation even if print fails
    }
  };


  // ====== SINGLE ENTRY FUNCTIONS ======
  const handleWSNBlur = async () => {
    if (!singleWSN.trim()) return;

    try {
      const wsnUpper = singleWSN.trim().toUpperCase();
      const response = await inboundAPI.getMasterDataByWSN(wsnUpper);
      setMasterData(response.data);
      setDuplicateWSN(null);
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast.error('WSN not found in master data');
        setMasterData(null);
      }
    }
  };

  // ====== SINGLE ENTRY SUBMIT ======
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
        warehouse_id: activeWarehouse?.id,
        created_by: user?.id // 
      });


      if (response.data.action === 'created') {

        toast.success('✓ Inbound entry created successfully!');
        saveVehicleNumber(singleForm.vehicle_no);

        // Trigger print if agent is ready
        if (agentReady && masterData) {
          await triggerPrint(singleWSN, masterData);
        }

        setSingleWSN('');

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
      loadInboundList();

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
        update_existing: true,
        created_by: user?.id // ✅ ISSUE #8
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
      loadInboundList();
    } catch (error: any) {
      toast.error('Failed to update');
    } finally {
      setSingleLoading(false);
    }
  };

  // ====== BULK UPLOAD FUNCTIONS ======
  const downloadTemplate = () => {
    const template = [{
      'WSN': 'ABC123_A',
      'INBOUND_DATE': new Date().toISOString().split('T')[0],
      'VEHICLE_NO': 'PB04AA1234',
      'PRODUCT_SERIAL_NUMBER': 'ABCDE12345',
      'RACK_NO': 'A-01',
      'UNLOAD_REMARKS': 'Brand Box missing'
    }];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Bulk_Inbound_Template.xlsx');
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
    formData.append('created_by', user?.id?.toString() || '');

    setBulkLoading(true);
    setBulkErrors([]);
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
        setBulkCurrentBatch(null);
        loadBatches();
        loadInboundList();
      }, 5000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Upload failed';
      toast.error(errorMsg);
      if (error.response?.data?.errors) {
        setBulkErrors(error.response.data.errors);
        setBulkErrorsOpen(true);
      }
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


  const add30Rows = () => {
    const newRows = generateEmptyRows(30).map(row => ({
      ...row,
      inbound_date: commonDate,
      vehicle_no: commonVehicle
    }));
    setMultiRows([...multiRows, ...newRows]);
    //toast.success('✓ Added 30 rows');
  };


  const checkDuplicates = (rows: any[]) => {
    const gridDup = new Set<string>();
    const crossWh = new Set<string>();
    const wsnCount = new Map<string, number>();

    rows.forEach(row => {
      if (!row.wsn?.trim()) return;

      const wsn = row.wsn.trim().toUpperCase();

      // grid duplicate
      wsnCount.set(wsn, (wsnCount.get(wsn) || 0) + 1);
      if (wsnCount.get(wsn)! > 1) {
        gridDup.add(wsn);
      }

      // already inbound (any warehouse)
      if (existingInboundWSNs.has(wsn)) {
        crossWh.add(wsn);
      }
    });

    setGridDuplicateWSNs(gridDup);
    setCrossWarehouseWSNs(crossWh);

    // backward compatibility (submit button disable)
    setDuplicateWSNs(
      new Set([
        ...Array.from(gridDup),
        ...Array.from(crossWh)
      ])
    );

  };

  const updateMultiRow = (index: number, field: string, value: any) => {
    const newRows = [...multiRows];
    newRows[index][field] = field === 'wsn' ? value.toUpperCase() : value;
    setMultiRows(newRows);

    // Debounce duplicate check (200ms)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      checkDuplicates(newRows);
    }, 200);

    // Only fetch master data for WSN - with 500ms delay
    if (field === 'wsn' && value.trim()) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const wsnUpper = value.trim().toUpperCase();
          const response = await inboundAPI.getMasterDataByWSN(wsnUpper);
          const masterInfo = response.data;

          setMultiRows(prevRows => {
            const updatedRows = [...prevRows];
            ALL_MASTER_COLUMNS.forEach(col => {
              updatedRows[index][col] = masterInfo[col] || null;
            });
            return updatedRows;
          });

          // Auto-print if no duplicates
          const wsn = wsnUpper;
          const isGridDup = gridDuplicateWSNs.has(wsn);
          const isCrossWh = crossWarehouseWSNs.has(wsn);

          if (!isGridDup && !isCrossWh && agentReady) {
            // Trigger print for this WSN
            triggerPrint(wsn, masterInfo);
          }


        } catch (error) {
          console.log('WSN not found');
        }
      }, 500);
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

  const navigateToNextCell = (params: any) => {
    const { key, previousCellPosition, nextCellPosition, event } = params;

    // Tab / arrow keys default behaviour
    if (key !== 'Enter') {
      return nextCellPosition;
    }

    // Enter: same column, next/prev row
    const api = params.api;
    const column = previousCellPosition.column;
    const rowIndex = previousCellPosition.rowIndex;

    const goingUp = event && event.shiftKey;
    const newRowIndex = goingUp ? rowIndex - 1 : rowIndex + 1;

    if (newRowIndex < 0 || newRowIndex >= api.getDisplayedRowCount()) {
      return previousCellPosition;
    }

    return {
      rowIndex: newRowIndex,
      column,
      rowPinned: null,
    };
  };



  const handleMultiSubmit = async () => {
    if (!activeWarehouse?.id) {
      toast.error("Select warehouse first");
      return;
    }

    // ✅ ISSUE #2 - Ensure all rows have common date & vehicle
    const rowsWithDefaults = multiRows.map(row => ({
      ...row,
      inbound_date: row.inbound_date || commonDate,
      vehicle_no: row.vehicle_no || commonVehicle
    }));

    const filtered = rowsWithDefaults.filter((r: any) => r.wsn && r.wsn.trim() !== "");

    if (filtered.length === 0) {
      toast.error("No valid WSN rows");
      return;
    }

    // Check for duplicates
    const hasGridDup = filtered.some(r =>
      gridDuplicateWSNs.has(r.wsn.trim().toUpperCase())
    );

    const hasCrossWh = filtered.some(r =>
      crossWarehouseWSNs.has(r.wsn.trim().toUpperCase())
    );

    if (hasCrossWh) {
      toast.error('WSN already inbound in another warehouse');
      return;
    }

    if (hasGridDup) {
      toast.error('Duplicate WSN in grid');
      return;
    }


    setMultiLoading(true);
    setMultiErrorMessage('');
    try {
      // ✅ ISSUE #2, #8 - Add created_by for each row
      const res = await inboundAPI.multiEntry(
        filtered.map(row => ({
          ...row,
          created_by: user?.id,
          warehouse_id: activeWarehouse.id
        })),
        activeWarehouse.id
      );

      // Save vehicle number from current entry
      saveVehicleNumber(commonVehicle);

      toast.success(`✓ Saved ${res.data.successCount} rows`);
      setMultiResults(res.data.results);

      // Reset grid to 10 rows
      setMultiRows(generateEmptyRows(10));

      loadInboundList();

    } catch (err: any) {
      console.error(err);
      setMultiErrorMessage('❌ Multi entry failed: ' + (err.response?.data?.error || 'Unknown error'));
      toast.error("Multi entry failed");
    } finally {
      setMultiLoading(false);
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
        category: categoryFilter,
        dateFrom: dateFromFilter,
        dateTo: dateToFilter
      });
      setListData(response.data.data);
      setTotal(response.data.total);
    } catch (error: any) {
      console.error('Load error:', error);
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
      console.log('Brands error');
      setBrands([]);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await inboundAPI.getCategories(activeWarehouse?.id);
      setCategories(response.data || []);
    } catch (error) {
      console.log('Categories error');
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
          dateFrom: exportStartDate,
          dateTo: exportEndDate,
          batchId: exportBatchId
        });
        dataToExport = response.data.data;
      }

      // ✅ Format dates before export
      const formattedData = dataToExport.map((row: any) => ({
        ...row,
        inbound_date: row.inbound_date ? formatInboundDate(row.inbound_date) : '',
        invoice_date: row.invoice_date ? formatInboundDate(row.invoice_date) : ''
      }));


      const ws = XLSX.utils.json_to_sheet(formattedData);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inbound');
      const filename = `inbound_${exportStartDate || exportBatchId || 'all'}_${Date.now()}.xlsx`;
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

  const formatInboundDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';

    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = months[d.getMonth()];
    const yy = String(d.getFullYear()).slice(-2);
    return `${day}-${mon}-${yy}`;   // 01-Dec-25
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
      loadInboundList();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const COLUMN_WIDTHS: Record<string, any> = {
    wsn: { width: 60 },
    product_serial_number: { width: 160 },
    rack_no: { width: 30 },
    unload_remarks: { flex: 1, minWidth: 160 },

    // ---- MASTER / READ ONLY COLUMNS ----
    wid: { width: 60 },
    fsn: { width: 120 },
    order_id: { width: 60 },

    product_title: { flex: 2, minWidth: 220 },
    brand: { width: 60 },

    mrp: { width: 30 },
    fsp: { width: 30 },
    hsn_sac: { width: 90 },
    igst_rate: { width: 20 },

    cms_vertical: { width: 120 },
    p_type: { width: 90 },
    p_size: { width: 80 },
    vrp: { width: 70 },
    yield_value: { width: 60 },
    fk_grade: { width: 80 },
    inbound_date: { width: 110 },
    fkt_link: { Width: 50 },
    fkqc_remark: { flex: 1, minWidth: 180 },
  };


  // ✅  - MULTI ENTRY - COLUMN DEFS
  const columnDefs = useMemo(() =>
    visibleColumns.map(col => {
      const isEditable = EDITABLE_COLUMNS.includes(col);

      const baseColDef: any = {
        field: col,
        headerName: col.replace(/_/g, ' ').toUpperCase(),
        editable: isEditable,
        suppressSizeToFit: true,
        resizable: true,
        minWidth: 80
      };

      const columnWidthConfig = COLUMN_WIDTHS[col] || {};

      if (col === 'rack_no' && isEditable) { // ✅ Added isEditable check
        return {
          ...baseColDef,
          width: 110,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: { values: racks.map(r => r.rack_name) }
        };
      } else if (col.includes('date')) {
        return {
          ...baseColDef,
          width: 130,
          cellDataType: 'date'
        };
      } else {

        return {
          ...baseColDef,
          ...columnWidthConfig,

          cellRenderer: (params: any) => {

            if (col !== 'wsn') {
              return (
                <span title={params.value}>
                  {params.value ?? ''}
                </span>
              );
            }

            const wsn = params.value?.trim()?.toUpperCase();
            const isCross = wsn && crossWarehouseWSNs.has(wsn);
            const isDup = wsn && gridDuplicateWSNs.has(wsn);



            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontWeight: 700 }}>{params.value ?? ''}</span>

                {isCross && (
                  <Tooltip title="Already inbound in another warehouse">
                    <span style={{ color: '#dc2626', cursor: 'help' }}>⛔</span>
                  </Tooltip>
                )}

                {isDup && !isCross && (
                  <Tooltip title="Duplicate WSN in grid">
                    <span style={{ color: '#d97706', cursor: 'help' }}>⚠️</span>
                  </Tooltip>
                )}
              </div>
            );
          },


          cellClassRules: {
            'wsn-cross-error': (params: any) => {
              const wsn = params.value?.trim()?.toUpperCase();
              return !!wsn && crossWarehouseWSNs.has(wsn);
            },
            'wsn-dup-error': (params: any) => {
              const wsn = params.value?.trim()?.toUpperCase();
              return !!wsn && gridDuplicateWSNs.has(wsn);
            }
          },


        };


      }
    }),
    [visibleColumns, racks, gridDuplicateWSNs, crossWarehouseWSNs]
  );

  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const handleConfirmDownload = () => {
    downloadTemplate();
    setConfirmOpen(false);
  };


  if (!activeWarehouse) {
    return (
      <AppLayout>
        <Box sx={{ p: 6, textAlign: 'center', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <Box sx={{ p: 5, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 4, color: 'white', boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4)' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>⚠️ No active warehouse selected.</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>Please go to Settings → Warehouses to set one.</Typography>
          </Box>
        </Box>
      </AppLayout>
    );
  }

  ////////////////////////////////////////////////////////////////////

  /////////////////////////////// UI /////////////////////////////////

  ////////////////////////////////////////////////////////////////////

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
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', mb: 0.2, fontSize: '0.85rem' }}>📦 Inbound Management</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip label={activeWarehouse.name} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, height: '18px', fontSize: '0.65rem' }} />
              <Chip label={user?.full_name} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 500, height: '18px', fontSize: '0.65rem' }} />
            </Stack>
          </Box>
        </Box>

        {/* TABS */}
        <Paper sx={{ mb: 0.5, borderRadius: 1, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', background: 'rgba(255, 255, 255, 0.95)' }}>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto" sx={{ '& .MuiTabs-indicator': { height: 3, background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)', borderRadius: '2px 2px 0 0' }, '& .MuiTab-root': { fontWeight: 600, fontSize: '0.7rem', textTransform: 'none', minHeight: 32, py: 0.5 } }}>
            <Tab label="Inbound List" />
            <Tab label="Single Entry" />
            <Tab label="Bulk Upload" />
            <Tab label="Multi Entry" />
            <Tab label="Batch Manager" />
          </Tabs>
        </Paper>

        {/* TAB 0: INBOUND LIST */}
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

                  {/* ROW 2: Brand + Category */}
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center">
                    <TextField select size="small" label="Brand" value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }} sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 40 } }}>
                      <MenuItem value="">All Brands</MenuItem>
                      {brands.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" label="Category" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { height: 40 } }}>
                      <MenuItem value="">All Categories</MenuItem>
                      {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>

                    {/* BUTTONS */}
                    <Stack direction="row" spacing={1} sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, auto)' }, gap: 1, width: { xs: '100%', md: 'auto' } }}>
                      <Button size="small" variant="outlined" onClick={() => { setSearchFilter(''); setBrandFilter(''); setCategoryFilter(''); setDateFromFilter(''); setDateToFilter(''); setPage(1); }} sx={{ height: 40, fontSize: '0.75rem', fontWeight: 600 }}>RESET</Button>
                      <Button size="small" startIcon={<SettingsIcon sx={{ fontSize: 14 }} />} variant="outlined" onClick={() => setListColumnSettingsOpen(true)} sx={{ height: 40, fontSize: '0.75rem', fontWeight: 600 }}>COLUMNS</Button>
                      <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 14 }} />} variant="contained" onClick={exportToExcel} sx={{ height: 40, fontSize: '0.75rem', fontWeight: 600, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>EXPORT</Button>
                      <Button size="small" startIcon={<RefreshIcon sx={{ fontSize: 14 }} />} variant="outlined" onClick={() => loadInboundList()} sx={{ height: 40, fontSize: '0.75rem', fontWeight: 600 }}>REFRESH</Button>
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {/* TABLE - HORIZONTAL SCROLL */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, border: '1px solid #d1d5db', position: 'relative' }}>
              <TableContainer component={Paper} sx={{ borderRadius: 0, boxShadow: 'none', border: 'none', background: '#ffffff', height: '100%' }}>
                <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { borderRight: '1px solid #d1d5db', padding: '6px 10px', fontSize: '0.75rem', minWidth: 120 } }}>
                  <TableHead>
                    <TableRow sx={{ background: '#e5e7eb' }}>
                      {listColumns.map((col: string, idx: any) => (
                        <TableCell key={`header_${idx}_${col}`} sx={{ color: '#1f2937', fontWeight: 700, background: '#e5e7eb', fontSize: '0.75rem', textTransform: 'uppercase', py: 0.8, whiteSpace: 'nowrap' }}>
                          {col.replace(/_/g, ' ')}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {listLoading ? (
                      <TableRow>
                        <TableCell colSpan={listColumns.length} align="center" sx={{ py: 8 }}>
                          <CircularProgress size={50} />
                        </TableCell>
                      </TableRow>
                    ) : listData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={listColumns.length} align="center" sx={{ py: 8 }}>
                          <Typography sx={{ fontWeight: 700, color: '#94a3b8' }}>📭 No data found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      listData.map((item, idx) => (
                        <TableRow key={`row_${item.id || idx}`} sx={{ bgcolor: idx % 2 === 0 ? '#ffffff' : '#f9fafb', '&:hover': { bgcolor: '#f0f0f0' } }}>
                          {listColumns.map((col: string, colIdx: any) => (
                            <TableCell key={`cell_${idx}_${colIdx}_${col}`} sx={{ fontWeight: 500, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {col === 'inbound_date'
                                ? formatInboundDate(item.inbound_date)
                                : (item[col] ? String(item[col]).substring(0, 50) : '-')}

                            </TableCell>
                          ))}
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
              spacing={1} justifyContent="space-between" alignItems="center"
              sx={{
                mt: 1,
                p: 1,
                mb: -13, //Bottom empty space fix
                background: 'rgba(255, 255, 255, 0.98)',
                borderRadius: 1.5,
                border: '1px solid rgba(0,0,0,0.08)'
              }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.7rem' }}>
                📊 {listData.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, total)} of {total}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" disabled={page === 1} onClick={() => setPage(page - 1)} sx={{ fontSize: '0.75rem', fontWeight: 600 }}>◀ Prev</Button>
                <Box sx={{ px: 2, border: '1.5px solid #667eea', borderRadius: 1.5, background: 'rgba(102, 126, 234, 0.08)', display: 'flex', alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: 700, color: '#667eea', fontSize: '0.8rem' }}>{page} / {Math.ceil(total / limit) || 1}</Typography>
                </Box>
                <Button size="small" variant="outlined" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)} sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Next ▶</Button>
              </Stack>
            </Stack>

            {/* EXPORT DIALOG */}
            <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle sx={{ fontWeight: 800, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', py: 2.5 }}>📤 Export Options</DialogTitle>
              <DialogContent sx={{ py: 3 }}>
                <Stack spacing={2}>
                  <TextField fullWidth label="Start Date" type="date" InputLabelProps={{ shrink: true }} value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} />
                  <TextField fullWidth label="End Date" type="date" InputLabelProps={{ shrink: true }} value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} />
                  <TextField select fullWidth label="Batch ID (Optional)" value={exportBatchId} onChange={(e) => setExportBatchId(e.target.value)}>
                    <MenuItem value="">All Batches</MenuItem>
                    {batches.map(b => <MenuItem key={b.batch_id} value={b.batch_id}>{b.batch_id} ({b.count} entries)</MenuItem>)}
                  </TextField>
                </Stack>
              </DialogContent>
              <DialogActions sx={{ p: 2 }}>
                <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={handleAdvancedExport} sx={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>Export</Button>
              </DialogActions>
            </Dialog>

            {/* INBOUND TAB: COLUMN SETTINGS DIALOG */}
            <Dialog
              open={listColumnSettingsOpen}
              onClose={() => setListColumnSettingsOpen(false)}
              maxWidth="sm"
              fullWidth
            >
              <DialogTitle
                sx={{
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  py: 2.5,
                }}
              >
                ⚙️ List Columns
              </DialogTitle>
              <DialogContent sx={{ py: 3, maxHeight: 500, overflow: 'auto' }}>
                <Stack spacing={1.5}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 800,
                      color: '#667eea',
                      fontSize: '0.8rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    Select Columns
                  </Typography>

                  {INBOUND_LIST_COLUMNS.map((col, idx) => (
                    <FormControlLabel
                      key={`inbound_${idx}_${col}`}
                      control={
                        <Checkbox
                          checked={listColumns.includes(col)}
                          onChange={(e) => {
                            let next = listColumns;

                            if (e.target.checked) {
                              next = [...listColumns, col];
                            } else {
                              next = listColumns.filter((c: string) => c !== col);
                            }

                            // order same rakho
                            const ordered = INBOUND_LIST_COLUMNS
                              .concat(
                                ALL_MASTER_COLUMNS.filter(
                                  (c) => !INBOUND_LIST_COLUMNS.includes(c),
                                ),
                              )
                              .filter((c) => next.includes(c));

                            saveListColumnSettings(ordered);
                          }}
                        />
                      }
                      label={col.toUpperCase().replace(/_/g, ' ')}
                    />
                  ))}

                  <Divider sx={{ my: 1.5 }} />
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, color: '#764ba2', fontSize: '0.7rem' }}
                  >
                    Additional Master Data
                  </Typography>

                  {ALL_MASTER_COLUMNS.filter(
                    (col) => !INBOUND_LIST_COLUMNS.includes(col),
                  ).map((col, idx) => (
                    <FormControlLabel
                      key={`master_${idx}_${col}`}
                      control={
                        <Checkbox
                          checked={listColumns.includes(col)}
                          onChange={(e) => {
                            let next = listColumns;

                            if (e.target.checked) {
                              next = [...listColumns, col];
                            } else {
                              next = listColumns.filter((c: string) => c !== col);
                            }

                            const ordered = INBOUND_LIST_COLUMNS
                              .concat(
                                ALL_MASTER_COLUMNS.filter(
                                  (c) => !INBOUND_LIST_COLUMNS.includes(c),
                                ),
                              )
                              .filter((c) => next.includes(c));

                            saveListColumnSettings(ordered);
                          }}
                        />
                      }
                      label={col.toUpperCase().replace(/_/g, ' ')}
                    />
                  ))}
                </Stack>
              </DialogContent>
              <DialogActions sx={{ p: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => setListColumnSettingsOpen(false)}
                  sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                  Done
                </Button>
              </DialogActions>
            </Dialog>

          </Box>
        )}

        {/* TAB 1: SINGLE ENTRY */}
        {tabValue === 1 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
            <Card sx={{ borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, color: '#1a237e', fontSize: '0.9rem' }}>📝 Entry Form</Typography>
                <Stack spacing={1.2}>
                  <TextField fullWidth size="small" label="WSN *" value={singleWSN} onChange={(e) => setSingleWSN(e.target.value)} onBlur={handleWSNBlur} placeholder="Enter WSN" />
                  <TextField fullWidth size="small" label="Inbound Date" type="date" InputLabelProps={{ shrink: true }} value={singleForm.inbound_date} onChange={(e) => setSingleForm({ ...singleForm, inbound_date: e.target.value })} />
                  <TextField fullWidth size="small" label="Vehicle Number" value={singleForm.vehicle_no} onChange={(e) => setSingleForm({ ...singleForm, vehicle_no: e.target.value })} placeholder="Vehicle plate number" />
                  <FormControl fullWidth size="small">
                    <InputLabel>Rack Number</InputLabel>
                    <Select value={singleForm.rack_no} onChange={(e) => setSingleForm({ ...singleForm, rack_no: e.target.value })} label="Rack Number">
                      <MenuItem value="">Select Rack</MenuItem>
                      {racks.map(r => <MenuItem key={r.id} value={r.rack_name}>{r.rack_name} - {r.location}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField fullWidth size="small" label="Product Serial Number" value={singleForm.product_serial_number} onChange={(e) => setSingleForm({ ...singleForm, product_serial_number: e.target.value })} />
                  <TextField fullWidth size="small" multiline rows={2} label="Unload Remarks" value={singleForm.unload_remarks} onChange={(e) => setSingleForm({ ...singleForm, unload_remarks: e.target.value })} />
                  {duplicateWSN ? (
                    <Stack direction="row" spacing={1}>
                      <Button fullWidth variant="contained" size="small" onClick={handleUpdateDuplicate} disabled={singleLoading} sx={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', py: 0.8, fontSize: '0.8rem', fontWeight: 700 }}>🔄 Update</Button>
                      <Button fullWidth variant="outlined" size="small" onClick={() => { setSingleWSN(''); setDuplicateWSN(null); }} sx={{ py: 0.8, fontSize: '0.8rem', fontWeight: 700 }}>Clear</Button>
                    </Stack>
                  ) : (
                    <Button fullWidth variant="contained" size="small" onClick={handleSingleSubmit} disabled={singleLoading} sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', py: 0.8, fontSize: '0.8rem', fontWeight: 700 }}>✓ Add Entry</Button>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {masterData && (
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
                      <Typography sx={{ fontWeight: 700, color: '#047857' }}>{masterData.fsn || 'N/A'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>PRODUCT</Typography>
                      <Typography sx={{ fontWeight: 600, color: '#047857', fontSize: '0.85rem' }}>{masterData.product_title || 'N/A'}</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>BRAND</Typography>
                        <Typography sx={{ fontWeight: 700, color: '#047857' }}>{masterData.brand || 'N/A'}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#065f46', fontWeight: 700, fontSize: '0.7rem' }}>CATEGORY</Typography>
                        <Typography sx={{ fontWeight: 700, color: '#047857' }}>{masterData.cms_vertical || 'N/A'}</Typography>
                      </Box>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Box>
        )}

        {/* TAB 2: BULK UPLOAD */}
        {tabValue === 2 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
            <Card sx={{ borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#1a237e' }}>📤 Bulk Upload</Typography>
                <Stack spacing={2}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => setConfirmOpen(true)}
                    sx={{ py: 1.5 }}
                  >
                    Download Template
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

                  <Box sx={{ border: '2px dashed #667eea', borderRadius: 2, p: 3, textAlign: 'center', cursor: 'pointer', background: 'rgba(102, 126, 234, 0.05)', transition: 'all 0.3s', '&:hover': { background: 'rgba(102, 126, 234, 0.1)', borderColor: '#764ba2' } }}>
                    <input type="file" accept=".xlsx,.xls" onChange={(e) => setBulkFile(e.target.files?.[0] || null)} style={{ display: 'none' }} id="bulk-file" />
                    <label htmlFor="bulk-file" style={{ cursor: 'pointer', display: 'block' }}>
                      <UploadIcon sx={{ fontSize: 40, color: '#667eea', mb: 1 }} />
                      <Typography sx={{ fontWeight: 700 }}>Click to upload file</Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>{bulkFile?.name || 'No file selected'}</Typography>
                    </label>
                  </Box>

                  <Button variant="contained" onClick={handleBulkUpload} disabled={bulkLoading || !bulkFile} sx={{ py: 1.5, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    {bulkLoading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : <UploadIcon sx={{ mr: 1 }} />}
                    Upload
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {bulkCurrentBatch && (
              <Card sx={{ background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', border: '2px solid #3b82f6' }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#1e40af' }}>BATCH ID</Typography>
                      <Typography sx={{ fontWeight: 700, color: '#1e3a8a' }}>{bulkCurrentBatch.id}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#1e40af' }}>TOTAL ROWS</Typography>
                      <Typography sx={{ fontWeight: 700, color: '#1e3a8a' }}>{bulkCurrentBatch.total}</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={50} sx={{ height: 8, borderRadius: 4 }} />
                    <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 600 }}>Processing...</Typography>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {bulkErrors.length > 0 && (
              <Dialog open={bulkErrorsOpen} onClose={() => setBulkErrorsOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>❌ Upload Errors</DialogTitle>
                <DialogContent sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {bulkErrors.map((err, idx) => (
                    <Alert key={idx} severity="error" sx={{ mb: 1 }}>
                      Row {err.row}: {err.message}
                    </Alert>
                  ))}
                </DialogContent>
              </Dialog>
            )}
          </Box>
        )}

        {/* TAB 3: MULTI ENTRY */}
        {tabValue === 3 && (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 135px)',
            gap: 1,
            mt: 0
          }}>
            {/* CONTROLS */}
            <Card sx={{ borderRadius: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: 1.2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }}
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  spacing={1.2} sx={{ justifyContent: 'space-between' }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField size="small" label="Common Date"
                      type="date" InputLabelProps={{ shrink: true }}
                      value={commonDate} onChange={(e) => setCommonDate(e.target.value)} sx={{ minWidth: 150 }} />
                    <TextField size="small" label="Vehicle" value={commonVehicle}
                      onChange={(e) => setCommonVehicle(e.target.value)} sx={{ minWidth: 150 }}
                      placeholder="Auto-fill" />
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={`🟢 READY: ${statusCounts.ready}`}
                      sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 700 }}
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
                ❌ Some WSNs are already inbound in another warehouse. Remove them.
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
                minHeight: 400,
                maxHeight: 'calc(100vh - 300px)',
                border: '1px solid #cbd5e1',
                borderRadius: 0,
                '& .ag-root-wrapper': { borderRadius: 0, height: '100%' },

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
              <div style={{ height: '100%', width: '100%' }} className="ag-theme-quartz">
                <AgGridReact
                  //theme="legacy"
                  rowData={multiRows}
                  columnDefs={columnDefs}
                  rowHeight={26}
                  suppressNoRowsOverlay={false}
                  overlayNoRowsTemplate='<span style="padding: 20px; font-size: 14px; color: #666;">Click on any cell to start entering data</span>'
                  defaultColDef={{
                    sortable: false,
                    filter: false,
                    resizable: true,
                    editable: (params) => {
                      const field = params.colDef.field as string;
                      const wsn = params.data?.wsn?.trim()?.toUpperCase();

                      if (!wsn) return EDITABLE_COLUMNS.includes(field);

                      // 🔴 Cross warehouse → nothing editable
                      if (crossWarehouseWSNs.has(wsn)) return false;

                      // 🟡 Duplicate → only WSN editable
                      if (gridDuplicateWSNs.has(wsn)) {
                        return field === 'wsn';
                      }

                      return EDITABLE_COLUMNS.includes(field);
                    },
                  }}

                  // keyboard navigation
                  stopEditingWhenCellsLoseFocus={true}
                  enterNavigatesVertically={true}
                  enterNavigatesVerticallyAfterEdit={true}
                  navigateToNextCell={navigateToNextCell}
                  ensureDomOrder={true}
                  suppressRowClickSelection={true}
                  suppressMovableColumns={true}
                  rowBuffer={5}
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
                      setTimeout(() => checkDuplicates(newRows), 100);

                      const wsn = newValue?.trim()?.toUpperCase();

                      // 🔴 Cross warehouse → clear + auto next
                      if (crossWarehouseWSNs.has(wsn)) {
                        toast.error(`WSN ${wsn} already inbound in another warehouse`);

                        setTimeout(() => {
                          event.api.startEditingCell({
                            rowIndex: rowIndex + 1,
                            colKey: 'wsn',
                          });
                        }, 0);

                        return;
                      }

                      // 🟡 Grid duplicate → auto next
                      if (gridDuplicateWSNs.has(wsn)) {
                        toast(`Duplicate WSN skipped: ${wsn}`, { icon: '⚠️' });

                        setTimeout(() => {
                          event.api.startEditingCell({
                            rowIndex: rowIndex + 1,
                            colKey: 'wsn',
                          });
                        }, 0);

                        return;
                      }

                      // ➕ Last row → auto add new row
                      if (rowIndex === event.api.getDisplayedRowCount() - 1) {
                        addMultiRow();
                      }


                      if (newValue?.trim()) {
                        setTimeout(async () => {
                          try {
                            const wsnUpper = newValue.trim().toUpperCase();
                            const response = await inboundAPI.getMasterDataByWSN(wsnUpper);
                            const masterInfo = response.data;
                            setMultiRows((prevRows) => {
                              const updatedRows = [...prevRows];
                              updatedRows[rowIndex] = { ...updatedRows[rowIndex] };
                              ALL_MASTER_COLUMNS.forEach((masterCol) => {
                                updatedRows[rowIndex][masterCol] =
                                  masterInfo[masterCol] || null;
                              });
                              return updatedRows;
                            });

                            // 🖨️ AUTO-PRINT label for valid WSN
                            console.log('🖨️ Attempting to print label for:', wsnUpper);
                            try {
                              const printPayload = {
                                wsn: newValue,
                                fsn: masterInfo.fsn || '',
                                product_title: masterInfo.product_title || '',
                                brand: masterInfo.brand || '',
                                mrp: masterInfo.mrp || '',
                                fsp: masterInfo.fsp || '',
                                copies: 1,
                              };
                              console.log('📋 Print payload:', printPayload);

                              const printSuccess = await printLabel(printPayload);
                              console.log('📊 Print result:', printSuccess);

                              if (printSuccess) {
                                console.log(`✅ Label printed for WSN: ${newValue}`);
                                toast.success(`🖨️ Label printed: ${newValue}`, { duration: 2000 });
                              }
                              // If printSuccess is false, printing is disabled or agent not running
                              // Check console logs to determine reason - no toast needed
                            } catch (printError: any) {
                              console.error('❌ Print error:', printError);
                              console.error('❌ Print error stack:', printError.stack);
                              toast.error(`Print error: ${printError.message}`, { duration: 3000 });
                            }
                          } catch (error) {
                            console.log('WSN not found');
                          }
                        }, 500);
                      }
                    }
                  }}
                />
              </div>
            </Box>

            {/* SUBMIT BUTTON */}
            <Button fullWidth variant="contained" size="medium" onClick={handleMultiSubmit} disabled={
              multiLoading ||
              gridDuplicateWSNs.size > 0 ||
              crossWarehouseWSNs.size > 0
            }
              sx={{ py: 1, borderRadius: 1.5, fontWeight: 800, fontSize: '0.8rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
              ✓ SUBMIT ALL ({multiRows.filter(r => r.wsn?.trim()).length} rows)
            </Button>

            {/* MULTI ENTRY TAB: COLUMN SETTINGS DIALOG */}
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
                ⚙️ Columns View Settings
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
                  {EDITABLE_COLUMNS.map((col, idx) => (
                    <FormControlLabel
                      key={`col_${idx}_${col}`}
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

                            const ordered = [...EDITABLE_COLUMNS, ...ALL_MASTER_COLUMNS].filter(
                              (c) => next.includes(c),
                            );

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
                  {ALL_MASTER_COLUMNS.filter(
                    (col) => !EDITABLE_COLUMNS.includes(col),
                  ).map((col, idx) => (
                    <FormControlLabel
                      key={`master_${idx}_${col}`}
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

                            const ordered = [...EDITABLE_COLUMNS, ...ALL_MASTER_COLUMNS].filter(
                              (c) => next.includes(c),
                            );

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
        )}

        {/* TAB 4: BATCH MANAGER */}
        {tabValue === 4 && (
          <Card sx={{ borderRadius: 1.5 }}>
            <CardContent>
              {batchLoading ? (
                <CircularProgress />
              ) : batches.length === 0 ? (
                <Typography>No batches</Typography>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Batch ID</TableCell>
                      <TableCell>Count</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batches.map((batch, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{batch.batch_id}</TableCell>
                        <TableCell>{batch.count}</TableCell>
                        <TableCell>{batch.status || 'Processing'}</TableCell>
                        <TableCell>
                          <Button size="small" color="error" onClick={() => deleteBatch(batch.batch_id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </Box>
    </AppLayout>
  );
}
