// LiveViewPanel.tsx - Real-time view of other users' Multi Entry data
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
  Drawer,
  Stack,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Badge,
  Avatar,
  useTheme,
  alpha,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  AccessTime as AccessTimeIcon,
  Inventory as InventoryIcon,
  TableChart as TableChartIcon,
  PieChart as PieChartIcon,
} from '@mui/icons-material';
import { liveViewAPI } from '@/lib/api';
import toast from 'react-hot-toast';

interface LiveSession {
  session_id: string;
  user_id: number;
  user_name: string;
  warehouse_id: number;
  page_type: string;
  started_at: string;
  last_activity_at: string;
  total_entries: number;
}

interface LiveEntry {
  wsn: string;
  product_title?: string;
  brand?: string;
  mrp?: number;
  fsp?: number;
  cms_vertical?: string;
  fkqc_remarks?: string;
  p_type?: string;
  p_size?: string;
  source?: string;
  wid?: string;
  fsn?: string;
  order_id?: string;
  fk_grade?: string;
  hsn_sac?: string;
  igst_rate?: number;
  vrp?: number;
  yield_value?: number;
  invoice_date?: string;
  fkt_link?: string;
  wh_location?: string;
  quantity?: number;
  dispatch_remarks?: string;
  other_remarks?: string;
  rack_no?: string;
  qc_grade?: string;
  qc_remarks?: string;
  product_serial_number?: string;
  row_index: number;
  created_at?: string;
}

interface LiveViewPanelProps {
  warehouseId: number | undefined;
  pageType: 'inbound' | 'qc' | 'picking' | 'outbound';
  isDarkMode?: boolean;
  container?: HTMLElement | null;
}

export default function LiveViewPanel({ warehouseId, pageType, isDarkMode = false, container }: LiveViewPanelProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<LiveSession | null>(null);
  const [entries, setEntries] = useState<LiveEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'pivot'>('table');
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDoneRef = useRef(false);
  const initialEntriesLoadDoneRef = useRef(false);

  // Pivot data computation
  const pivotData = useMemo(() => {
    if (entries.length === 0) return { rows: [], grandTotal: { qty: 0, fsp: 0, mrp: 0 } };
    
    const grouped: Record<string, { qty: number; fsp: number; mrp: number }> = {};
    
    entries.forEach(entry => {
      const category = entry.cms_vertical || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = { qty: 0, fsp: 0, mrp: 0 };
      }
      grouped[category].qty += 1;
      grouped[category].fsp += Number(entry.fsp) || 0;
      grouped[category].mrp += Number(entry.mrp) || 0;
    });
    
    const rows = Object.entries(grouped)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.qty - a.qty);
    
    const grandTotal = rows.reduce(
      (acc, row) => ({ qty: acc.qty + row.qty, fsp: acc.fsp + row.fsp, mrp: acc.mrp + row.mrp }),
      { qty: 0, fsp: 0, mrp: 0 }
    );
    
    return { rows, grandTotal };
  }, [entries]);

  // Fetch active sessions
  const fetchSessions = useCallback(async (isInitial = false) => {
    if (!warehouseId) return;

    try {
      // Only show loading spinner on initial load
      if (isInitial || !initialLoadDoneRef.current) {
        setLoading(true);
      }
      const res = await liveViewAPI.getActiveSessions(warehouseId, pageType);
      setSessions(res.data.sessions || []);
      initialLoadDoneRef.current = true;
    } catch (error) {
      // Silently ignore - live view is not critical
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [warehouseId, pageType]);

  // Fetch entries for selected session
  const fetchEntries = useCallback(async (sessionId: string, isInitial = false) => {
    try {
      // Only show loading spinner on initial load
      if (isInitial || !initialEntriesLoadDoneRef.current) {
        setLoadingEntries(true);
      }
      const res = await liveViewAPI.getEntries(sessionId);
      setEntries(res.data.entries || []);
      initialEntriesLoadDoneRef.current = true;
    } catch (error) {
      console.debug('Failed to fetch live entries:', error);
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  // Background polling - check for active sessions every 10 seconds (even when drawer is closed)
  useEffect(() => {
    if (!warehouseId) return;

    // Initial fetch
    initialLoadDoneRef.current = false;
    fetchSessions(true);

    // Poll every 10 seconds in background
    const bgInterval = setInterval(() => {
      if (!open) {
        fetchSessions(false);
      }
    }, 10000);

    return () => clearInterval(bgInterval);
  }, [warehouseId, pageType, open, fetchSessions]);

  // Auto-refresh sessions and entries when drawer is open
  useEffect(() => {
    if (open && warehouseId) {
      fetchSessions(false);

      // Refresh every 5 seconds when open
      refreshIntervalRef.current = setInterval(() => {
        fetchSessions(false);
        if (selectedSession) {
          fetchEntries(selectedSession.session_id, false);
        }
      }, 5000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [open, warehouseId, selectedSession, fetchSessions, fetchEntries]);

  // Select a session
  const handleSelectSession = (session: LiveSession) => {
    setSelectedSession(session);
    setViewMode('table'); // Reset to table view for new session
    initialEntriesLoadDoneRef.current = false; // Reset for new session
    fetchEntries(session.session_id, true);
  };

  // Export to Excel
  const handleExport = async () => {
    if (!selectedSession) return;

    try {
      const res = await liveViewAPI.exportEntries(selectedSession.session_id);
      const data = res.data;

      // Dynamic import XLSX
      const XLSX = await import('xlsx');

      const exportData = (data.entries || []).map((e: LiveEntry, idx: number) => ({
        'S.No': idx + 1,
        'WSN': e.wsn,
        'Product Title': e.product_title || '',
        'Brand': e.brand || '',
        'Category': e.cms_vertical || '',
        'Source': e.source || '',
        'WID': e.wid || '',
        'FSN': e.fsn || '',
        'Order ID': e.order_id || '',
        'FK Grade': e.fk_grade || '',
        'FKQC Remarks': e.fkqc_remarks || '',
        'QC Grade': e.qc_grade || '',
        'QC Remarks': e.qc_remarks || '',
        'HSN SAC': e.hsn_sac || '',
        'IGST Rate': e.igst_rate || '',
        'FSP': e.fsp || '',
        'MRP': e.mrp || '',
        'VRP': e.vrp || '',
        'Yield Value': e.yield_value || '',
        'Invoice Date': e.invoice_date || '',
        'FK Link': e.fkt_link || '',
        'WH Location': e.wh_location || '',
        'P-Type': e.p_type || '',
        'P-Size': e.p_size || '',
        'Rack No': e.rack_no || '',
        'Quantity': e.quantity || '',
        'Dispatch Remarks': e.dispatch_remarks || '',
        'Other Remarks': e.other_remarks || '',
        'Product Serial No': e.product_serial_number || '',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Live Entries');

      // Add pivot sheet if there's data
      if (pivotData.rows.length > 0) {
        const pivotExport = [
          ...pivotData.rows.map(row => ({
            'Category': row.category,
            'Quantity': row.qty,
            'Total FSP': row.fsp,
            'Total MRP': row.mrp,
          })),
          { 'Category': 'GRAND TOTAL', 'Quantity': pivotData.grandTotal.qty, 'Total FSP': pivotData.grandTotal.fsp, 'Total MRP': pivotData.grandTotal.mrp }
        ];
        const pivotWs = XLSX.utils.json_to_sheet(pivotExport);
        XLSX.utils.book_append_sheet(wb, pivotWs, 'Category Summary');
      }

      const fileName = `LiveView_${data.user_name}_${pageType}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success(`Exported ${exportData.length} entries`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    }
  };

  // Format time ago
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  };

  // Colors based on page type
  const pageColors: Record<string, string> = {
    inbound: '#10b981',
    qc: '#8b5cf6',
    picking: '#f59e0b',
    outbound: '#3b82f6',
  };
  const pageColor = pageColors[pageType] || '#64748b';

  // Only render button if there are active sessions from other users
  if (sessions.length === 0) {
    return null;
  }

  return (
    <>
      {/* Trigger Button - Only shown when other users are entering data */}
      <Tooltip title={`${sessions.length} user${sessions.length > 1 ? 's' : ''} entering data - Click to view live`} placement="top">
        <Badge
          badgeContent={sessions.length}
          color="error"
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.65rem',
              minWidth: 16,
              height: 16,
            }
          }}
        >
          <IconButton
            size="small"
            onClick={() => setOpen(true)}
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              border: '1.5px solid',
              borderColor: pageColor,
              color: pageColor,
              bgcolor: alpha(pageColor, 0.1),
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%': { boxShadow: `0 0 0 0 ${alpha(pageColor, 0.4)}` },
                '70%': { boxShadow: '0 0 0 6px rgba(0,0,0,0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
              },
              '&:hover': {
                borderColor: pageColor,
                bgcolor: alpha(pageColor, 0.2),
                color: pageColor,
              }
            }}
          >
            <VisibilityIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Badge>
      </Tooltip>

      {/* Drawer Panel */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        container={container}
        ModalProps={{
          container: container,
          keepMounted: false,
        }}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: '50vw', md: '50vw' },
            maxWidth: { sm: 800 },
            minWidth: { sm: 400 },
            bgcolor: isDarkMode ? '#0f172a' : '#f8fafc',
          }
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            background: `linear-gradient(135deg, ${pageColor} 0%, ${alpha(pageColor, 0.8)} 100%)`,
            color: 'white',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              <VisibilityIcon />
              <Typography variant="h6" fontWeight={700}>
                Live View
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <IconButton size="small" onClick={() => fetchSessions(false)} sx={{ color: 'white' }}>
                <RefreshIcon />
              </IconButton>
              <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'white' }}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
            See entries being made by other users in real-time
          </Typography>
        </Box>

        <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
          {/* Active Sessions List */}
          {!selectedSession ? (
            <>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Active Users ({sessions.length})
              </Typography>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : sessions.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <VisibilityIcon sx={{ fontSize: 48, color: isDarkMode ? '#475569' : '#cbd5e1', mb: 1 }} />
                  <Typography color="textSecondary">
                    No other users are currently entering data
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {sessions.map((session) => (
                    <Paper
                      key={session.session_id}
                      onClick={() => handleSelectSession(session)}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        bgcolor: isDarkMode ? '#1e293b' : 'white',
                        border: '1px solid',
                        borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                        borderRadius: 2,
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: pageColor,
                          transform: 'translateX(4px)',
                        }
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Avatar sx={{ bgcolor: pageColor, width: 40, height: 40 }}>
                          <PersonIcon />
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography fontWeight={700} sx={{ color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
                            {session.user_name}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              size="small"
                              icon={<InventoryIcon sx={{ fontSize: 14 }} />}
                              label={`${session.total_entries} entries`}
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                            <Typography variant="caption" color="textSecondary">
                              <AccessTimeIcon sx={{ fontSize: 12, mr: 0.3, verticalAlign: 'middle' }} />
                              {formatTimeAgo(session.last_activity_at)}
                            </Typography>
                          </Stack>
                        </Box>
                        <VisibilityIcon sx={{ color: pageColor }} />
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </>
          ) : (
            /* Selected Session Entries */
            <>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Button
                  size="small"
                  onClick={() => {
                    setSelectedSession(null);
                    setEntries([]);
                    initialEntriesLoadDoneRef.current = false;
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  ← Back to sessions
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={handleExport}
                  disabled={entries.length === 0}
                  sx={{
                    bgcolor: pageColor,
                    '&:hover': { bgcolor: alpha(pageColor, 0.9) }
                  }}
                >
                  Export
                </Button>
              </Stack>

              <Paper sx={{ p: 2, mb: 2, bgcolor: isDarkMode ? '#1e293b' : 'white', borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Avatar sx={{ bgcolor: pageColor }}>
                      <PersonIcon />
                    </Avatar>
                    <Box>
                      <Typography fontWeight={700} sx={{ color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
                        {selectedSession.user_name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {entries.length} entries • Last update: {formatTimeAgo(selectedSession.last_activity_at)}
                      </Typography>
                    </Box>
                  </Stack>
                  
                  {/* View Toggle */}
                  <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(_, val) => val && setViewMode(val)}
                    size="small"
                  >
                    <ToggleButton value="table" sx={{ px: 2 }}>
                      <TableChartIcon fontSize="small" sx={{ mr: 0.5 }} />
                      Table
                    </ToggleButton>
                    <ToggleButton value="pivot" sx={{ px: 2 }}>
                      <PieChartIcon fontSize="small" sx={{ mr: 0.5 }} />
                      Pivot
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
              </Paper>

              {/* Table/Pivot with overlay spinner - no blinking */}
              <Box sx={{ position: 'relative' }}>
                {/* Loading overlay - shows on top of table */}
                {loadingEntries && entries.length > 0 && (
                  <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                    zIndex: 10,
                    borderRadius: 2,
                  }}>
                    <CircularProgress size={32} sx={{ color: pageColor }} />
                  </Box>
                )}

                {/* Initial loading state - only when no entries yet */}
                {loadingEntries && entries.length === 0 ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : entries.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="textSecondary">No entries yet</Typography>
                  </Box>
                ) : viewMode === 'pivot' ? (
                  /* Pivot View */
                  <TableContainer
                    component={Paper}
                    sx={{
                      maxHeight: 'calc(100vh - 360px)',
                      bgcolor: isDarkMode ? '#1e293b' : 'white',
                    }}
                  >
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, bgcolor: isDarkMode ? '#334155' : '#f1f5f9', minWidth: 180 }}>CMS Vertical</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: isDarkMode ? '#334155' : '#f1f5f9', textAlign: 'center', minWidth: 80 }}>Qty</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: isDarkMode ? '#334155' : '#f1f5f9', textAlign: 'right', minWidth: 100 }}>Total FSP</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: isDarkMode ? '#334155' : '#f1f5f9', textAlign: 'right', minWidth: 100 }}>Total MRP</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pivotData.rows.map((row) => (
                          <TableRow key={row.category} hover>
                            <TableCell sx={{ 
                              fontWeight: 600, 
                              color: isDarkMode ? '#f1f5f9' : '#1e293b' 
                            }}>
                              {row.category}
                            </TableCell>
                            <TableCell sx={{ 
                              textAlign: 'center',
                              color: isDarkMode ? '#cbd5e1' : '#475569' 
                            }}>
                              {row.qty}
                            </TableCell>
                            <TableCell sx={{ 
                              textAlign: 'right',
                              color: isDarkMode ? '#cbd5e1' : '#475569' 
                            }}>
                              ₹{row.fsp.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell sx={{ 
                              textAlign: 'right',
                              color: isDarkMode ? '#cbd5e1' : '#475569' 
                            }}>
                              ₹{row.mrp.toLocaleString('en-IN')}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Total Row */}
                        <TableRow sx={{ bgcolor: isDarkMode ? alpha(pageColor, 0.2) : alpha(pageColor, 0.1) }}>
                          <TableCell sx={{ fontWeight: 700, color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
                            TOTAL
                          </TableCell>
                          <TableCell sx={{ textAlign: 'center', fontWeight: 700, color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
                            {pivotData.grandTotal.qty}
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
                            ₹{pivotData.grandTotal.fsp.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right', fontWeight: 700, color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
                            ₹{pivotData.grandTotal.mrp.toLocaleString('en-IN')}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  /* Table View */
                  <TableContainer
                    component={Paper}
                    sx={{
                      maxHeight: 'calc(100vh - 360px)',
                      bgcolor: isDarkMode ? '#1e293b' : 'white',
                    }}
                  >
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, bgcolor: isDarkMode ? '#334155' : '#f1f5f9', minWidth: 40 }}>#</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: isDarkMode ? '#334155' : '#f1f5f9', minWidth: 120 }}>WSN</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: isDarkMode ? '#334155' : '#f1f5f9', minWidth: 180 }}>Product</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: isDarkMode ? '#334155' : '#f1f5f9', minWidth: 80 }}>Brand</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: isDarkMode ? '#334155' : '#f1f5f9', minWidth: 100 }}>CMS Vertical</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: isDarkMode ? '#334155' : '#f1f5f9', minWidth: 70 }}>MRP</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: isDarkMode ? '#334155' : '#f1f5f9', minWidth: 70 }}>FSP</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {entries.map((entry, idx) => (
                          <TableRow key={entry.wsn + idx} hover>
                            <TableCell sx={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>{idx + 1}</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
                              {entry.wsn}
                            </TableCell>
                            <TableCell sx={{
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: isDarkMode ? '#cbd5e1' : '#475569'
                            }}>
                              {entry.product_title || '-'}
                            </TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                              {entry.brand || '-'}
                            </TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                              {entry.cms_vertical || '-'}
                            </TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                              {entry.mrp ? `₹${entry.mrp}` : '-'}
                            </TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                              {entry.fsp ? `₹${entry.fsp}` : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </>
          )}
        </Box>
      </Drawer>
    </>
  );
}
