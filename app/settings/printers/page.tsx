'use client';

import React, { useState, useEffect } from 'react';
import {
  Container, Paper, TextField, Select, MenuItem, FormControl, InputLabel,
  FormControlLabel, Switch, Button, Box, Alert, CircularProgress, Card,
  CardContent, Typography, Divider, Slider, Chip, Stack, Accordion,
  AccordionSummary, AccordionDetails, Badge, Tooltip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import PrintIcon from '@mui/icons-material/Print';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import SpeedIcon from '@mui/icons-material/Speed';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import BugReportIcon from '@mui/icons-material/BugReport';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import DownloadIcon from '@mui/icons-material/Download';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import AppLayout from '@/components/AppLayout';

interface PrinterSettings {
  defaultPrinter: string;
  printingEnabled: boolean;
  pageSize: string;
  dpi: number;
  copies: number;
  autoRetry: boolean;
  retryAttempts: number;
  labelWidth: number;
  labelHeight: number;
  printSpeed: number;
  printDensity: number;
  agentPort: number;
  timeout: number;
  autoPrintOnScan: boolean;
  showPrintDialog: boolean;
  barcodeHeight: number;
  fontSize: number;
}

interface PrinterInfo {
  name: string;
}

export default function PrinterSettingsPage() {
  useRoleGuard(['admin']);

  const [settings, setSettings] = useState<PrinterSettings>({
    defaultPrinter: '',
    printingEnabled: true,
    pageSize: '50x30mm',
    dpi: 203,
    copies: 1,
    autoRetry: true,
    retryAttempts: 3,
    labelWidth: 50,
    labelHeight: 30,
    printSpeed: 4,
    printDensity: 12,
    agentPort: 9100,
    timeout: 60000,
    autoPrintOnScan: true,
    showPrintDialog: false,
    barcodeHeight: 55,
    fontSize: 2,
  });

  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [agentStatus, setAgentStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');
  const [testPrinting, setTestPrinting] = useState(false);
  const [agentVersion, setAgentVersion] = useState('');
  const [printHistory, setPrintHistory] = useState<any[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings.agentPort) {
      checkAgentStatus();
    }
  }, [settings.agentPort]);

  const checkAgentStatus = async (port?: number) => {
    const agentPort = port || settings.agentPort;
    if (!agentPort) return;

    setAgentStatus('checking');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`http://127.0.0.1:${agentPort}/health`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setAgentStatus('connected');
        setAgentVersion(data.version || '1.0.0');
        await fetchPrinters(agentPort);
      } else {
        setAgentStatus('disconnected');
      }
    } catch (err: any) {
      setAgentStatus('disconnected');
    }
  };

  const fetchPrinters = async (port?: number) => {
    const agentPort = port || settings.agentPort;
    if (!agentPort) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`http://127.0.0.1:${agentPort}/printers`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setPrinters(data.printers || []);
        console.log('📋 Printers loaded:', data.printers);
      }
    } catch (err) {
      setPrinters([]);
    }
  };

  const loadSettings = () => {
    try {
      const defaults: PrinterSettings = {
        defaultPrinter: '',
        printingEnabled: true,
        pageSize: '50x30mm',
        dpi: 203,
        copies: 1,
        autoRetry: true,
        retryAttempts: 3,
        labelWidth: 50,
        labelHeight: 30,
        printSpeed: 4,
        printDensity: 12,
        agentPort: 9100,
        timeout: 60000,
        autoPrintOnScan: true,
        showPrintDialog: false,
        barcodeHeight: 55,
        fontSize: 2,
      };

      const saved = localStorage.getItem('wms-printer-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaults, ...parsed });
        console.log('✅ Settings loaded from storage');
      }
      setLoading(false);
    } catch (err) {
      console.error('❌ Failed to load settings:', err);
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      localStorage.setItem('wms-printer-settings', JSON.stringify(settings));

      if (!settings.agentPort) {
        setSaveMessage('✅ Settings saved locally');
        setTimeout(() => setSaveMessage(''), 4000);
        return;
      }

      const response = await fetch(`http://127.0.0.1:${settings.agentPort}/config`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        const result = await response.json();
        setSaveMessage('✅ Settings saved successfully to agent and browser!');
        console.log('📝 Settings saved to agent:', result);
      } else {
        setSaveMessage('⚠️ Settings saved locally (agent may not be running)');
      }

      setTimeout(() => setSaveMessage(''), 4000);
    } catch (err) {
      setSaveMessage('✅ Settings saved locally');
      setTimeout(() => setSaveMessage(''), 4000);
    }
  };

  const handleResetSettings = () => {
    if (confirm('⚠️ Reset all settings to defaults?')) {
      const defaults: PrinterSettings = {
        defaultPrinter: '',
        printingEnabled: true,
        pageSize: '50x30mm',
        dpi: 203,
        copies: 1,
        autoRetry: true,
        retryAttempts: 3,
        labelWidth: 50,
        labelHeight: 30,
        printSpeed: 4,
        printDensity: 12,
        agentPort: 9100,
        timeout: 60000,
        autoPrintOnScan: true,
        showPrintDialog: false,
        barcodeHeight: 55,
        fontSize: 2,
      };
      setSettings(defaults);
      localStorage.removeItem('wms-printer-settings');
      setSaveMessage('🔄 Settings reset to defaults');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleTestPrint = async () => {
    if (agentStatus !== 'connected') {
      alert('❌ Print agent not connected');
      return;
    }

    if (!settings.agentPort) {
      alert('❌ Agent port not configured');
      return;
    }

    setTestPrinting(true);
    try {
      const testData = {
        wsn: 'TEST-' + Date.now(),
        fsn: 'FSN-TEST-' + Math.floor(Math.random() * 10000),
        product_title: 'Test Product Label',
        brand: 'WMS Test',
        mrp: '999',
        fsp: '800',
        copies: 1,
        printerName: settings.defaultPrinter,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`http://127.0.0.1:${settings.agentPort}/print-label`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        alert('✅ Test print sent successfully!\n\nWSN: ' + testData.wsn + '\nFSN: ' + testData.fsn);
        console.log('🖨️ Test print successful');

        setPrintHistory(prev => [
          { ...testData, timestamp: new Date().toLocaleString(), status: 'success' },
          ...prev.slice(0, 4)
        ]);
      } else {
        const error = await response.json();
        alert('❌ Test print failed: ' + (error.error || 'Unknown error'));
      }
    } catch (err: any) {
      console.error('❌ Test print error:', err);
      if (err.name === 'AbortError') {
        alert('❌ Test print timeout!\n\nThe print agent took too long to respond.\nCheck if the printer is connected and powered on.');
      } else {
        alert('❌ Failed to send test print: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setTestPrinting(false);
    }
  };

  const handleChange = (field: keyof PrinterSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const StatusBadge = () => {
    if (agentStatus === 'checking') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Checking agent...
          </Typography>
        </Box>
      );
    }

    if (agentStatus === 'connected') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon sx={{ color: '#2e7d32', fontSize: 24 }} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#2e7d32' }}>
              Print Agent Connected
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              Ready to print labels
            </Typography>

          </Box>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ErrorIcon sx={{ color: '#d32f2f', fontSize: 24 }} />
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#d32f2f' }}>
            Print Agent Offline
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
            Install or start the agent below
          </Typography>
        </Box>
      </Box>
    );
  };

  if (loading) {
    return (
      <AppLayout>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <CircularProgress />
          </Box>
        </Container>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Box sx={{
        p: { xs: 0.75, md: 1 },
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>

        {/* STICKY HEADER */}
        <Box sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          px: 2,
          py: 1.25,
          pl: { xs: '54px', sm: 2 },
          background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
          color: 'white',
          borderRadius: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
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
              <Typography sx={{ fontSize: { xs: '1rem', sm: '1.5rem' }, lineHeight: 1 }}>🖨️</Typography>
            </Box>
            <Box>
              <Typography variant="h4" sx={{
                fontWeight: 650,
                color: 'white',
                fontSize: { xs: '0.85rem', sm: '1rem', md: '1.3rem' },
                lineHeight: 1.1,
                textShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                Printer Settings
              </Typography>
              <Typography variant="caption" sx={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: { xs: '0.5rem', sm: '0.7rem' },
                fontWeight: 500,
                lineHeight: 1.2,
                display: 'block',
                mt: 0.25
              }}>
                Configure thermal printer and label settings
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Enhanced Status Card */}
        <Box sx={{ px: 2, pt: 2 }}>
          <Card sx={{
            background: agentStatus === 'connected'
              ? 'linear-gradient(135deg, #e8f5e9 0%, #f1f8f4 100%)'
              : 'linear-gradient(135deg, #ffebee 0%, #fff5f5 100%)',
            border: `2px solid ${agentStatus === 'connected' ? '#4caf50' : '#f44336'}`,
            boxShadow: agentStatus === 'connected'
              ? '0 4px 12px rgba(76, 175, 80, 0.2)'
              : '0 4px 12px rgba(244, 67, 54, 0.2)',
          }}>
            <CardContent sx={{
              py: { xs: 1.2, sm: 1.5 },
              px: { xs: 2, sm: 3 },
              '&:last-child': { pb: { xs: 1.2, sm: 1.5 } }
            }}>
              <Box sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: { xs: 1.5, sm: 2 },
                alignItems: 'center'
              }}>

                {/* LEFT - Status */}
                <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 50%' } }}>
                  <StatusBadge />
                  {agentStatus === 'connected' && agentVersion && (
                    <Chip
                      label={`v${agentVersion}`}
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ ml: { xs: 0, sm: 5 }, mt: { xs: 0.5, sm: 0 }, fontWeight: 600 }}
                    />
                  )}
                  {agentStatus === 'connected' && printers.length > 0 && (
                    <Chip
                      icon={<PrintIcon fontSize="small" />}
                      label={`${printers.length} printer${printers.length > 1 ? 's' : ''} detected`}
                      size="small"
                      color="info"
                      variant="outlined"
                      sx={{ ml: 1, mt: { xs: 0.5, sm: 0 }, fontWeight: 600 }}
                    />
                  )}
                </Box>

                {/* RIGHT - Actions */}
                <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 auto' }, textAlign: { xs: 'left', sm: 'right' } }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
                  >
                    <Tooltip title="Check agent connection status">
                      <Button
                        variant={agentStatus === 'connected' ? 'outlined' : 'contained'}
                        color={agentStatus === 'connected' ? 'success' : 'error'}
                        size="small"
                        startIcon={<RefreshIcon />}
                        onClick={() => checkAgentStatus(settings.agentPort)}
                        sx={{ width: { xs: '100%', sm: 'auto' }, fontWeight: 600 }}
                      >
                        Refresh Status
                      </Button>
                    </Tooltip>

                    <Chip
                      icon={<NetworkCheckIcon />}
                      label={`Port: ${settings.agentPort}`}
                      size="small"
                      variant="filled"
                      color={agentStatus === 'connected' ? 'success' : 'default'}
                      sx={{ width: { xs: '100%', sm: 'auto' }, fontWeight: 600 }}
                    />
                  </Stack>
                </Box>

              </Box>
            </CardContent>
          </Card>

          {/* Save Message */}
          {saveMessage && (
            <Alert
              severity={saveMessage.includes('✅') ? 'success' : saveMessage.includes('⚠️') ? 'warning' : 'info'}
              sx={{ mt: 1.5, fontWeight: 500 }}
              onClose={() => setSaveMessage('')}
            >
              {saveMessage}
            </Alert>
          )}

          {/* Enhanced Installation Guide (Disconnected State) */}
          {agentStatus === 'disconnected' && (
            <Alert
              severity="error"
              variant="filled"
              sx={{
                mt: 1.5,
                background: 'linear-gradient(135deg, #f44336 0%, #e53935 100%)',
                '& .MuiAlert-message': { width: '100%' }
              }}
              icon={<CloudDownloadIcon sx={{ fontSize: 28 }} />}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: 'white' }}>
                🚨 Print Agent Required
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255,255,255,0.95)' }}>
                Download and install the WMS Print Agent to enable label printing functionality.
              </Typography>

              <Box sx={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: 2,
                p: 2,
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<DownloadIcon />}
                    onClick={() => {
                      const downloadUrl = 'https://drive.google.com/file/d/1pcVAo0mA-zvw31W_0_h5ysM4KPSa0BUs/view?usp=sharing';
                      window.open(downloadUrl, '_blank');
                      setTimeout(() => {
                        alert('📥 Download started!\n\nFile: WMS Print Agent Setup (518 MB)\nIf download doesn\'t start:\n1. Check Downloads folder\n2. Check browser download manager\n3. Contact IT support');
                      }, 1000);
                    }}
                    sx={{
                      backgroundColor: 'white',
                      color: '#f44336',
                      fontWeight: 700,
                      px: 4,
                      py: 1.5,
                      '&:hover': {
                        backgroundColor: '#fafafa',
                        transform: 'scale(1.05)',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.3)'
                      },
                      transition: 'all 0.2s'
                    }}
                  >
                    Download Print Agent (518 MB)
                  </Button>

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label="Version 1.0.0"
                      size="medium"
                      sx={{
                        backgroundColor: 'rgba(255,255,255,0.25)',
                        color: 'white',
                        fontWeight: 600,
                        border: '1px solid rgba(255,255,255,0.3)'
                      }}
                    />
                    <Chip
                      label="Windows 10/11"
                      size="medium"
                      sx={{
                        backgroundColor: 'rgba(255,255,255,0.25)',
                        color: 'white',
                        fontWeight: 600,
                        border: '1px solid rgba(255,255,255,0.3)'
                      }}
                    />
                  </Stack>
                </Stack>

                <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.2)' }} />

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: 'white' }}>
                  📝 Quick Setup:
                </Typography>
                <Box component="ul" sx={{ pl: 2, m: 0, color: 'rgba(255,255,255,0.95)' }}>
                  <li><Typography variant="caption">Run <strong>WMS-Print-Agent-Setup.exe</strong></Typography></li>
                  <li><Typography variant="caption">Connect thermal printer via USB</Typography></li>
                  <li><Typography variant="caption">Look for 🖨️ icon in system tray</Typography></li>
                  <li><Typography variant="caption">Click <strong>"Refresh Status"</strong> button above</Typography></li>
                </Box>
              </Box>
            </Alert>
          )}
        </Box>

        {/* SCROLLABLE CONTENT */}
        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: { xs: 2, sm: 3 } }}>
          <Container maxWidth="lg">
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', lg: 'row' },
              gap: { xs: 2, sm: 3 }
            }}>

              {/* LEFT COLUMN - Settings */}
              <Box sx={{ flex: { xs: '1 1 100%', lg: '1 1 65%' } }}>

                {/* Printer Configuration */}
                <Paper sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 3 }, boxShadow: 3 }}>
                  <Typography variant="h6" sx={{
                    fontWeight: 700,
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    fontSize: { xs: '1rem', sm: '1.25rem' }
                  }}>
                    <SettingsIcon color="primary" /> Printer Configuration
                  </Typography>
                  <Divider sx={{ mb: 3 }} />

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(65% - 8px)' } }}>
                      <FormControl fullWidth>
                        <InputLabel>Default Thermal Printer</InputLabel>
                        <Select
                          value={settings.defaultPrinter}
                          onChange={(e) => handleChange('defaultPrinter', e.target.value)}
                          label="Default Thermal Printer"
                          disabled={agentStatus !== 'connected'}
                        >
                          <MenuItem value="">
                            <em>{agentStatus !== 'connected' ? 'Connect agent first' : 'Select a printer...'}</em>
                          </MenuItem>
                          {printers.map((printer, idx) => (
                            <MenuItem key={idx} value={printer.name}>
                              🖨️ {printer.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>

                    <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(35% - 8px)' } }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => fetchPrinters(settings.agentPort)}
                        sx={{ height: '56px', fontWeight: 600 }}
                        disabled={agentStatus !== 'connected'}
                      >
                        Refresh List
                      </Button>
                    </Box>

                    <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' } }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.printingEnabled}
                            onChange={(e) => handleChange('printingEnabled', e.target.checked)}
                            color="success"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {settings.printingEnabled ? '✅ Printing Enabled' : '❌ Printing Disabled'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              Toggle automatic label printing
                            </Typography>
                          </Box>
                        }
                      />
                    </Box>

                    <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' } }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.autoPrintOnScan}
                            onChange={(e) => handleChange('autoPrintOnScan', e.target.checked)}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {settings.autoPrintOnScan ? '⚡ Auto-Print on Scan' : '🚫 Manual Print'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              Print immediately after scanning WSN
                            </Typography>
                          </Box>
                        }
                      />
                    </Box>
                  </Box>
                </Paper>

                {/* Label Dimensions */}
                <Paper sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 3 }, boxShadow: 3 }}>
                  <Typography variant="h6" sx={{
                    fontWeight: 700,
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    fontSize: { xs: '1rem', sm: '1.25rem' }
                  }}>
                    <AspectRatioIcon color="primary" /> Label Dimensions & Layout
                  </Typography>
                  <Divider sx={{ mb: 3 }} />

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 2, sm: 3 } }}>
                    <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(33.33% - 16px)' } }}>
                      <FormControl fullWidth>
                        <InputLabel>Label Size Preset</InputLabel>
                        <Select
                          value={settings.pageSize}
                          onChange={(e) => {
                            handleChange('pageSize', e.target.value);
                            if (e.target.value === '50x30mm') {
                              handleChange('labelWidth', 50);
                              handleChange('labelHeight', 30);
                            } else if (e.target.value === '58x40mm') {
                              handleChange('labelWidth', 58);
                              handleChange('labelHeight', 40);
                            } else if (e.target.value === '80x60mm') {
                              handleChange('labelWidth', 80);
                              handleChange('labelHeight', 60);
                            }
                          }}
                          label="Label Size Preset"
                        >
                          <MenuItem value="50x30mm">50mm × 30mm (Standard)</MenuItem>
                          <MenuItem value="58x40mm">58mm × 40mm (Medium)</MenuItem>
                          <MenuItem value="80x60mm">80mm × 60mm (Large)</MenuItem>
                          <MenuItem value="custom">Custom Size</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>

                    <Box sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: '1 1 calc(33.33% - 16px)' } }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Label Width (mm)"
                        value={settings.labelWidth}
                        onChange={(e) => handleChange('labelWidth', Math.max(20, parseInt(e.target.value) || 50))}
                        inputProps={{ min: 20, max: 200 }}
                        helperText="20-200mm"
                      />
                    </Box>

                    <Box sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: '1 1 calc(33.33% - 16px)' } }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Label Height (mm)"
                        value={settings.labelHeight}
                        onChange={(e) => handleChange('labelHeight', Math.max(20, parseInt(e.target.value) || 30))}
                        inputProps={{ min: 20, max: 200 }}
                        helperText="20-200mm"
                      />
                    </Box>

                    <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)' } }}>
                      <Typography variant="body2" gutterBottom sx={{ fontWeight: 600 }}>
                        Barcode Height: {settings.barcodeHeight} dots
                      </Typography>
                      <Slider
                        value={settings.barcodeHeight}
                        onChange={(_, val) => handleChange('barcodeHeight', val)}
                        min={20}
                        max={70}
                        step={1}
                        marks
                        valueLabelDisplay="auto"
                      />
                      <Typography variant="caption" color="textSecondary">
                        Adjust for scanner readability (20-70 dots)
                      </Typography>
                    </Box>

                    <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)' } }}>
                      <Typography variant="body2" gutterBottom sx={{ fontWeight: 600 }}>
                        Text Font Size: {settings.fontSize}
                      </Typography>
                      <Slider
                        value={settings.fontSize}
                        onChange={(_, val) => handleChange('fontSize', val)}
                        min={1}
                        max={4}
                        step={1}
                        marks={[
                          { value: 1, label: 'S' },
                          { value: 2, label: 'M' },
                          { value: 3, label: 'L' },
                          { value: 4, label: 'XL' },
                        ]}
                        valueLabelDisplay="auto"
                      />
                    </Box>
                  </Box>
                </Paper>

                {/* Print Performance */}
                <Paper sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 3 }, boxShadow: 3 }}>
                  <Typography variant="h6" sx={{
                    fontWeight: 700,
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    fontSize: { xs: '1rem', sm: '1.25rem' }
                  }}>
                    <SpeedIcon color="primary" /> Print Performance & Quality
                  </Typography>
                  <Divider sx={{ mb: 3 }} />

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 2, sm: 3 } }}>
                    <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(33.33% - 16px)' } }}>
                      <FormControl fullWidth>
                        <InputLabel>Print Resolution (DPI)</InputLabel>
                        <Select
                          value={settings.dpi}
                          onChange={(e) => handleChange('dpi', e.target.value as any)}
                          label="Print Resolution (DPI)"
                        >
                          <MenuItem value={203}>203 DPI (Standard)</MenuItem>
                          <MenuItem value={300}>300 DPI (High Quality)</MenuItem>
                          <MenuItem value={600}>600 DPI (Premium)</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>

                    <Box sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: '1 1 calc(33.33% - 16px)' } }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Number of Copies"
                        value={settings.copies}
                        onChange={(e) => handleChange('copies', Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                        inputProps={{ min: 1, max: 10 }}
                        helperText="Copies per print (1-10)"
                      />
                    </Box>

                    <Box sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: '1 1 calc(33.33% - 16px)' } }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Print Timeout (ms)"
                        value={settings.timeout}
                        onChange={(e) => handleChange('timeout', Math.max(5000, parseInt(e.target.value) || 60000))}
                        inputProps={{ min: 5000, max: 120000, step: 1000 }}
                        helperText="5000-120000ms"
                      />
                    </Box>

                    <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)' } }}>
                      <Typography variant="body2" gutterBottom sx={{ fontWeight: 600 }}>
                        Print Speed: {settings.printSpeed}
                      </Typography>
                      <Slider
                        value={settings.printSpeed}
                        onChange={(_, val) => handleChange('printSpeed', val)}
                        min={1}
                        max={8}
                        step={1}
                        marks={[
                          { value: 1, label: 'Slow' },
                          { value: 4, label: 'Med' },
                          { value: 8, label: 'Fast' },
                        ]}
                        valueLabelDisplay="auto"
                      />
                      <Typography variant="caption" color="textSecondary">
                        Lower = better quality, Higher = faster printing
                      </Typography>
                    </Box>

                    <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)' } }}>
                      <Typography variant="body2" gutterBottom sx={{ fontWeight: 600 }}>
                        Print Density (Darkness): {settings.printDensity}
                      </Typography>
                      <Slider
                        value={settings.printDensity}
                        onChange={(_, val) => handleChange('printDensity', val)}
                        min={5}
                        max={20}
                        step={1}
                        marks={[
                          { value: 5, label: 'Light' },
                          { value: 12, label: 'Normal' },
                          { value: 20, label: 'Dark' },
                        ]}
                        valueLabelDisplay="auto"
                      />
                      <Typography variant="caption" color="textSecondary">
                        Adjust ink/ribbon darkness
                      </Typography>
                    </Box>
                  </Box>
                </Paper>

                {/* Advanced Settings */}
                <Accordion sx={{ mb: { xs: 2, sm: 3 }, boxShadow: 3 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6" sx={{
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      fontSize: { xs: '1rem', sm: '1.25rem' }
                    }}>
                      <BugReportIcon color="primary" /> Advanced & Troubleshooting
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' } }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.autoRetry}
                              onChange={(e) => handleChange('autoRetry', e.target.checked)}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {settings.autoRetry ? '🔄 Auto Retry Enabled' : '⏹️ No Retry'}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                Retry automatically on print failure
                              </Typography>
                            </Box>
                          }
                        />
                      </Box>

                      <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' } }}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Retry Attempts"
                          value={settings.retryAttempts}
                          onChange={(e) => handleChange('retryAttempts', Math.max(1, Math.min(10, parseInt(e.target.value) || 3)))}
                          inputProps={{ min: 1, max: 10 }}
                          helperText="Max retries on failure (1-10)"
                          disabled={!settings.autoRetry}
                        />
                      </Box>

                      <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' } }}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Agent Port"
                          value={settings.agentPort}
                          onChange={(e) => handleChange('agentPort', Math.max(1000, parseInt(e.target.value) || 9100))}
                          inputProps={{ min: 1000, max: 65535 }}
                          helperText="Print agent HTTP port"
                        />
                      </Box>

                      <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' } }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.showPrintDialog}
                              onChange={(e) => handleChange('showPrintDialog', e.target.checked)}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                Show Print Dialog
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                Show confirmation before printing
                              </Typography>
                            </Box>
                          }
                        />
                      </Box>
                    </Box>
                  </AccordionDetails>
                </Accordion>

              </Box>

              {/* RIGHT COLUMN - Actions & Status */}
              <Box sx={{ flex: { xs: '1 1 100%', lg: '1 1 35%' } }}>

                {/* Actions */}
                <Paper sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 3 }, boxShadow: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    Actions
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Stack spacing={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      size="large"
                      fullWidth
                      startIcon={<SaveIcon />}
                      onClick={handleSaveSettings}
                      sx={{ py: 1.5, fontWeight: 600, boxShadow: 2 }}
                    >
                      Save All Settings
                    </Button>

                    <Button
                      variant="contained"
                      color="success"
                      size="large"
                      fullWidth
                      startIcon={<PrintIcon />}
                      onClick={handleTestPrint}
                      disabled={testPrinting || agentStatus !== 'connected' || !settings.defaultPrinter}
                      sx={{ py: 1.5, fontWeight: 600, boxShadow: 2 }}
                    >
                      {testPrinting ? (
                        <>
                          <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
                          Printing...
                        </>
                      ) : (
                        'Test Print Label'
                      )}
                    </Button>

                    <Button
                      variant="outlined"
                      color="warning"
                      size="medium"
                      fullWidth
                      startIcon={<RestartAltIcon />}
                      onClick={handleResetSettings}
                      sx={{ fontWeight: 600 }}
                    >
                      Reset to Defaults
                    </Button>
                  </Stack>
                </Paper>

                {/* Current Configuration */}
                <Paper sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 3 }, boxShadow: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%)' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    📋 Current Configuration
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                        Printer
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
                        {settings.defaultPrinter || '❌ Not Selected'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                        Status
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {settings.printingEnabled ? '✅ Enabled' : '❌ Disabled'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                        Label Size
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {settings.labelWidth}mm × {settings.labelHeight}mm
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                        Quality
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {settings.dpi} DPI | Speed: {settings.printSpeed} | Density: {settings.printDensity}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                        Copies
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {settings.copies} {settings.copies === 1 ? 'copy' : 'copies'} per print
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                        Auto Features
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {settings.autoPrintOnScan ? '⚡ Auto-print' : '🚫 Manual'} |
                        {settings.autoRetry ? ` 🔄 Retry (${settings.retryAttempts}x)` : ' ⏹️ No retry'}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {/* Print History */}
                {printHistory.length > 0 && (
                  <Paper sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 3 }, boxShadow: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                      Recent Test Prints
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <Stack spacing={1}>
                      {printHistory.map((item, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            p: 1.5,
                            backgroundColor: item.status === 'success' ? '#e8f5e9' : '#ffebee',
                            borderRadius: 1,
                            borderLeft: '4px solid',
                            borderLeftColor: item.status === 'success' ? '#4caf50' : '#f44336'
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            {item.wsn}
                          </Typography>
                          <Typography variant="caption" display="block" color="textSecondary">
                            {item.timestamp}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                )}

                {/* Quick Tips */}
                <Alert severity="info" icon={<InfoIcon />} sx={{ boxShadow: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                    💡 Quick Tips
                  </Typography>
                  <Typography variant="caption" component="div">
                    • Make sure WMS Print Agent is running<br />
                    • Select thermal printer for best results<br />
                    • Test print before production use<br />
                    • Adjust density if labels are too light/dark<br />
                    • Lower speed improves print quality
                  </Typography>
                </Alert>

              </Box>
            </Box>
          </Container>
        </Box>
      </Box>
    </AppLayout >
  );
}