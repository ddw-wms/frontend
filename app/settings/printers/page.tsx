'use client';

import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  Button,
  Box,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Typography,
  Divider,
  Slider,
  Chip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  // Role guard - only admin can access
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
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

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
      // Silent fail - agent not running is expected behavior
      if (err.name === 'AbortError') {
        // Timeout - agent not responding
        setAgentStatus('disconnected');
      } else {
        // Connection refused or network error - agent not installed/running
        setAgentStatus('disconnected');
      }
      // Don't log error to console - it's expected when agent is not running
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
      // Silent fail - agent not running
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
        // Merge with defaults to ensure all fields have values
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        const result = await response.json();
        setSaveMessage('✅ Settings saved successfully to agent and browser!');
        console.log('📝 Settings saved to agent:', result);
        console.log('🖨️ New default printer:', settings.defaultPrinter);
      } else {
        const errorText = await response.text();
        console.error('❌ Agent save error:', errorText);
        setSaveMessage('⚠️ Settings saved locally (agent may not be running)');
      }

      setTimeout(() => setSaveMessage(''), 4000);
    } catch (err) {
      console.error('❌ Save error:', err);
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
        copies: 1, // Always use 1 copy for test print
        printerName: settings.defaultPrinter,
      };

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(`http://127.0.0.1:${settings.agentPort}/print-label`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
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
          <Typography variant="body2">Checking agent...</Typography>
        </Box>
      );
    }

    if (agentStatus === 'connected') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'green' }}>
          <CheckCircleIcon />
          <Typography variant="body2">Agent Connected ✅</Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'red' }}>
        <ErrorIcon />
        <Typography variant="body2">Agent Not Running ❌</Typography>
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
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Sticky Header Section */}
        <Box sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'background.default',
          borderBottom: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 'bold',
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
                }}
              >
                <PrintIcon fontSize="large" />
                Printer Settings
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                Configure thermal printer, label settings, and print agent preferences
              </Typography>
            </Box>

            <Card sx={{ backgroundColor: agentStatus === 'connected' ? '#e8f5e9' : '#ffebee', boxShadow: 2 }}>
              <CardContent sx={{ py: { xs: 1.5, sm: 2 }, px: { xs: 2, sm: 3 } }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1.5, sm: 2 }, alignItems: 'center' }}>
                  <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 45%' } }}>
                    <StatusBadge />
                    {agentStatus === 'connected' && agentVersion && (
                      <Chip
                        label={`Version: ${agentVersion}`}
                        size="small"
                        sx={{ ml: { xs: 0, sm: 2 }, mt: { xs: 1, sm: 0 } }}
                      />
                    )}
                  </Box>
                 <Box
  sx={{
    flex: { xs: '1 1 100%', sm: '1 1 45%' },
    textAlign: { xs: 'left', sm: 'right' },
  }}
>
  <Stack
    direction={{ xs: 'column', sm: 'row' }}
    spacing={1}
    justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
  >
    <Button
      variant="outlined"
      size="small"
      startIcon={<RefreshIcon />}
      onClick={() => checkAgentStatus(settings.agentPort)}
      sx={{
        width: { xs: '100%', sm: 'auto' },
      }}
    >
      Refresh Status
    </Button>

    <Chip
      icon={<NetworkCheckIcon />}
      label={`Port: ${settings.agentPort}`}
      size="small"
      variant="outlined"
      sx={{ width: { xs: '100%', sm: 'auto' } }}
    />
  </Stack>
</Box>

                </Box>
              </CardContent>
            </Card>

            {saveMessage && (
              <Alert
                severity={saveMessage.includes('✅') ? 'success' : saveMessage.includes('⚠️') ? 'warning' : 'info'}
                sx={{ mt: 2 }}
                onClose={() => setSaveMessage('')}
              >
                {saveMessage}
              </Alert>
            )}

            {/* Print Agent Installation Instructions */}
            {agentStatus === 'disconnected' && (
              <Alert
                severity="warning"
                sx={{ mt: 2 }}
                icon={<InfoIcon />}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  🖨️ Print Agent Not Running
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  The WMS Print Agent is required for printing labels. Please follow these steps:
                </Typography>
                <Box sx={{ pl: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>1. Download Print Agent:</strong>
                  </Typography>
                  <Box sx={{ pl: 2, mb: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={<PrintIcon />}
                        onClick={async () => {
                          try {
                            // Download from backend server (without /api prefix for static files)
                            const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
                            const downloadUrl = `${API_BASE}/downloads/print-agent`;

                            // Open in new tab to trigger download
                            window.open(downloadUrl, '_blank');

                            // Show helpful message
                            setTimeout(() => {
                              alert('📥 Download started!\n\n' +
                                'If download doesn\'t start automatically:\n' +
                                '1. Check your Downloads folder\n' +
                                '2. Check browser\'s download manager\n' +
                                '3. Contact IT support if issue persists');
                            }, 1000);
                          } catch (err) {
                            console.error('Download error:', err);
                            alert('❌ Download failed!\n\nPlease contact IT support for installation file.');
                          }
                        }}
                        sx={{ mb: 1 }}
                      >
                        Download for Windows
                      </Button>
                      <Chip
                        label="Version 1.0.0"
                        size="small"
                        color="info"
                        variant="outlined"
                        sx={{ mb: 1 }}
                      />
                    </Stack>
                    <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                      💾 File size: ~150 MB | Compatible with Windows 10/11
                    </Typography>
                  </Box>

                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>2. Install the Agent:</strong>
                  </Typography>
                  <Box sx={{ pl: 2, mb: 2 }}>
                    <Typography variant="caption" display="block">• Run the downloaded <strong>WMS-Print-Agent-Setup.exe</strong></Typography>
                    <Typography variant="caption" display="block">• Click "Next" and choose installation folder</Typography>
                    <Typography variant="caption" display="block">• Agent will auto-start after installation</Typography>
                    <Typography variant="caption" display="block">• Look for 🖨️ icon in system tray (bottom-right)</Typography>
                  </Box>

                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>3. Connect Your Printer:</strong>
                  </Typography>
                  <Box sx={{ pl: 2, mb: 2 }}>
                    <Typography variant="caption" display="block">• Connect thermal printer via USB</Typography>
                    <Typography variant="caption" display="block">• Install printer drivers (if not auto-detected)</Typography>
                    <Typography variant="caption" display="block">• Agent will detect printer automatically</Typography>
                  </Box>

                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>4. Verify Connection:</strong>
                  </Typography>
                  <Box sx={{ pl: 2 }}>
                    <Typography variant="caption" display="block">• Click <strong>"Refresh Status"</strong> button above</Typography>
                    <Typography variant="caption" display="block">• Status should change to "Agent Connected ✅"</Typography>
                    <Typography variant="caption" display="block">• Select your printer from dropdown</Typography>
                    <Typography variant="caption" display="block">• Click "Test Print" to verify</Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  💡 Troubleshooting:
                </Typography>
                <Box sx={{ pl: 2 }}>
                  <Typography variant="caption" display="block">• Check if agent is running in system tray</Typography>
                  <Typography variant="caption" display="block">• Default port is 9100 - ensure it's not blocked by firewall</Typography>
                  <Typography variant="caption" display="block">• Restart the agent from system tray menu</Typography>
                  <Typography variant="caption" display="block">• For issues, contact support or check documentation</Typography>
                </Box>
              </Alert>
            )}
          </Container>
        </Box>

        {/* Scrollable Content Section */}
        <Box sx={{ flex: 1, overflow: 'auto', py: { xs: 2, sm: 3 } }}>
          <Container maxWidth="lg">

            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', lg: 'row' },
              gap: { xs: 2, sm: 3 }
            }}>
              <Box sx={{ flex: { xs: '1 1 100%', lg: '1 1 65%' } }}>

                <Paper sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 3 }, boxShadow: 2 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 'bold',
                      mb: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      fontSize: { xs: '1rem', sm: '1.25rem' }
                    }}
                  >
                    <SettingsIcon /> Printer Configuration
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
                        >
                          <MenuItem value="">
                            <em>Select a printer...</em>
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
                        sx={{ height: '56px' }}
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
                            <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                              {settings.printingEnabled ? '✅ Printing Enabled' : '❌ Printing Disabled'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
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
                            <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                              {settings.autoPrintOnScan ? '⚡ Auto-Print on Scan' : '🚫 Manual Print'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                              Print immediately after scanning WSN
                            </Typography>
                          </Box>
                        }
                      />
                    </Box>
                  </Box>
                </Paper>

                <Paper sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 3 }, boxShadow: 2 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 'bold',
                      mb: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      fontSize: { xs: '1rem', sm: '1.25rem' }
                    }}
                  >
                    <AspectRatioIcon /> Label Dimensions & Layout
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
                      <Typography variant="body2" gutterBottom>
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
                      <Typography variant="body2" gutterBottom>
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

                <Paper sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 3 }, boxShadow: 2 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 'bold',
                      mb: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      fontSize: { xs: '1rem', sm: '1.25rem' }
                    }}
                  >
                    <SpeedIcon /> Print Performance & Quality
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
                      <Typography variant="body2" gutterBottom>
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
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                        Lower = better quality, Higher = faster printing
                      </Typography>
                    </Box>

                    <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)' } }}>
                      <Typography variant="body2" gutterBottom>
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
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                        Adjust ink/ribbon darkness
                      </Typography>
                    </Box>
                  </Box>
                </Paper>

                <Accordion sx={{ mb: { xs: 2, sm: 3 }, boxShadow: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        fontSize: { xs: '1rem', sm: '1.25rem' }
                      }}
                    >
                      <BugReportIcon /> Advanced & Troubleshooting
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
                              <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                                {settings.autoRetry ? '🔄 Auto Retry Enabled' : '⏹️ No Retry'}
                              </Typography>
                              <Typography variant="caption" color="textSecondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
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
                              <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                                Show Print Dialog
                              </Typography>
                              <Typography variant="caption" color="textSecondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
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

              <Box sx={{ flex: { xs: '1 1 100%', lg: '1 1 35%' } }}>

                <Paper sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 3 }, boxShadow: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
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
                      sx={{ py: 1.5 }}
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
                      sx={{ py: 1.5 }}
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
                    >
                      Reset to Defaults
                    </Button>
                  </Stack>
                </Paper>

                <Paper sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 3 }, boxShadow: 2, backgroundColor: '#f5f5f5' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    📋 Current Configuration
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="caption" color="textSecondary">Printer</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', wordBreak: 'break-word', fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                        {settings.defaultPrinter || '❌ Not Selected'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="textSecondary">Status</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                        {settings.printingEnabled ? '✅ Enabled' : '❌ Disabled'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="textSecondary">Label Size</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                        {settings.labelWidth}mm × {settings.labelHeight}mm
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="textSecondary">Quality</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                        {settings.dpi} DPI | Speed: {settings.printSpeed} | Density: {settings.printDensity}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="textSecondary">Copies</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                        {settings.copies} {settings.copies === 1 ? 'copy' : 'copies'} per print
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="textSecondary">Auto Features</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                        {settings.autoPrintOnScan ? '⚡ Auto-print' : '🚫 Manual'} |
                        {settings.autoRetry ? ` 🔄 Retry (${settings.retryAttempts}x)` : ' ⏹️ No retry'}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {printHistory.length > 0 && (
                  <Paper sx={{ p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 3 }, boxShadow: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                      Recent Test Prints
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <Stack spacing={1}>
                      {printHistory.map((item, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            p: 1.5,
                            backgroundColor: '#f9f9f9',
                            borderRadius: 1,
                            borderLeft: '3px solid',
                            borderLeftColor: item.status === 'success' ? 'green' : 'red'
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.75rem' } }}>
                            {item.wsn}
                          </Typography>
                          <Typography variant="caption" display="block" color="textSecondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                            {item.timestamp}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                )}

                <Alert severity="info" icon={<InfoIcon />} sx={{ boxShadow: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1, fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                    💡 Quick Tips
                  </Typography>
                  <Typography variant="caption" component="div" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
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
    </AppLayout>
  );
}






