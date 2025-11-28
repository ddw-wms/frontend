'use client';

import { useState } from 'react';
import {
  Box, Button, Paper, Typography, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Chip, TextField, FormControl, InputLabel, Select, MenuItem,
  AppBar, Toolbar, Stack, Grid, Card, CardContent, Dialog, DialogContent, DialogTitle
} from '@mui/material';
import {
  Download as DownloadIcon,
  Visibility as ViewIcon,
  FileDownload as ExportIcon,
  BarChart as ChartIcon
} from '@mui/icons-material';
import AppLayout from '@/components/AppLayout';
import { useWarehouse } from '@/app/context/WarehouseContext';
import toast, { Toaster } from 'react-hot-toast';

const REPORTS = [
  {
    id: 1,
    name: 'Inbound Summary',
    description: 'Daily inbound inventory report',
    category: 'Operations',
    records: 1456,
    lastGenerated: '2025-11-02 14:30',
    format: ['PDF', 'Excel', 'CSV']
  },
  {
    id: 2,
    name: 'QC Report',
    description: 'Quality control acceptance/rejection details',
    category: 'Quality',
    records: 892,
    lastGenerated: '2025-11-02 13:15',
    format: ['PDF', 'Excel']
  },
  {
    id: 3,
    name: 'Outbound Summary',
    description: 'Dispatch and shipment logs',
    category: 'Operations',
    records: 645,
    lastGenerated: '2025-11-02 12:00',
    format: ['PDF', 'Excel', 'CSV']
  },
  {
    id: 4,
    name: 'Inventory Status',
    description: 'Current stock levels by warehouse/rack',
    category: 'Inventory',
    records: 3241,
    lastGenerated: '2025-11-01 16:45',
    format: ['PDF', 'Excel']
  },
  {
    id: 5,
    name: 'User Activity Log',
    description: 'System user actions and timestamps',
    category: 'Audit',
    records: 5432,
    lastGenerated: '2025-11-02 10:20',
    format: ['Excel', 'CSV']
  },
  {
    id: 6,
    name: 'Performance Analytics',
    description: 'Warehouse KPIs and metrics',
    category: 'Analytics',
    records: 234,
    lastGenerated: '2025-11-02 09:00',
    format: ['PDF', 'Excel']
  }
];

export default function ReportsPage() {
  const { activeWarehouse } = useWarehouse();
  const [filteredReports, setFilteredReports] = useState(REPORTS);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [selectedFormat, setSelectedFormat] = useState('PDF');

  const categorySet = new Set(REPORTS.map(r => r.category));
  const categories = ['All', ...Array.from(categorySet)];


  const handleCategoryFilter = (cat: string) => {
    setCategoryFilter(cat);
    if (cat === 'All') {
      setFilteredReports(REPORTS);
    } else {
      setFilteredReports(REPORTS.filter(r => r.category === cat));
    }
  };

  const handleExport = (report: any, format: string) => {
    toast.success(`✓ Exporting ${report.name} as ${format}`);
    // Simulate download
    setTimeout(() => {
      toast.success(`✓ Downloaded: ${report.name}.${format.toLowerCase()}`);
    }, 1000);
  };

  const handleViewDetails = (report: any) => {
    setSelectedReport(report);
    setSelectedFormat('PDF');
    setOpenDialog(true);
  };

  return (
    <AppLayout>
      <Toaster position="top-center" />
      <AppBar position="static" elevation={0} sx={{ bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar>
          <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
            📊 Reports & Analytics
          </Typography>
        </Toolbar>
      </AppBar>

      <Paper sx={{ m: 3, p: 3 }}>
               {/* Summary Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mb: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography color="text.secondary" gutterBottom>
                Total Reports
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="primary.main">
                {REPORTS.length}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography color="text.secondary" gutterBottom>
                Categories
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">
                {categories.length - 1}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography color="text.secondary" gutterBottom>
                Total Records
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="warning.main">
                {REPORTS.reduce((a, b) => a + b.records, 0).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography color="text.secondary" gutterBottom>
                Warehouse
              </Typography>
              <Typography variant="h6" fontWeight="bold">
                {activeWarehouse?.name.substring(0, 10)}
              </Typography>
            </CardContent>
          </Card>
        </Box>


        {/* Category Filter */}
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {categories.map(cat => (
              <Chip
                key={cat}
                label={cat}
                onClick={() => handleCategoryFilter(cat)}
                color={categoryFilter === cat || (cat === 'All' && categoryFilter === '') ? 'primary' : 'default'}
                variant={categoryFilter === cat || (cat === 'All' && categoryFilter === '') ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
        </Box>

        {/* Reports Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Report Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Records</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Formats</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Last Generated</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>

              </TableRow>
            </TableHead>
            <TableBody>
              {filteredReports.map((report) => (
                <TableRow key={report.id} hover>
                  <TableCell>
                    <Box>
                      <Typography sx={{ fontWeight: 'bold' }}>{report.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {report.description}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={report.category} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{report.records.toLocaleString()}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      {report.format.map(fmt => (
                        <Chip key={fmt} label={fmt} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>{report.lastGenerated}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ViewIcon />}
                        onClick={() => handleViewDetails(report)}
                      >
                        View
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ExportIcon />}
                        onClick={() => handleExport(report, 'PDF')}
                      >
                        Export
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Report Details Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight="bold">
          {selectedReport?.name}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedReport?.description}
            </Typography>
            <Box>
              <Typography variant="subtitle2" fontWeight="bold">Records: </Typography>
              <Typography variant="body2">{selectedReport?.records.toLocaleString()}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" fontWeight="bold">Last Generated:</Typography>
              <Typography variant="body2">{selectedReport?.lastGenerated}</Typography>
            </Box>
            <FormControl fullWidth>
              <InputLabel>Export Format</InputLabel>
              <Select
                value={selectedFormat}
                label="Export Format"
                onChange={e => setSelectedFormat(e.target.value)}
              >
               {selectedReport?.format.map((fmt: string) => (
               <MenuItem key={fmt} value={fmt}>{fmt}</MenuItem>
                ))}

              </Select>
            </FormControl>
            <Button
              fullWidth
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={() => {
                handleExport(selectedReport, selectedFormat);
                setOpenDialog(false);
              }}
            >
              Download Report
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
