// File: components/ExportDialog.tsx
// Standardized export dialog for consistency across all pages
import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControlLabel,
    Checkbox,
    Typography,
    Box,
    IconButton,
    RadioGroup,
    Radio,
    Alert,
    LinearProgress,
    useTheme,
    useMediaQuery,
    Stack,
    Divider,
} from '@mui/material';
import {
    Close as CloseIcon,
    Download as DownloadIcon,
    FileDownload as FileDownloadIcon,
} from '@mui/icons-material';

interface ExportDialogProps {
    open: boolean;
    onClose: () => void;
    onExport: (options: { type: 'current' | 'filtered' | 'all'; format: 'xlsx' | 'csv' }) => void | Promise<void>;
    title?: string;
    currentCount?: number;
    filteredCount?: number;
    totalCount?: number;
    loading?: boolean;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
    open,
    onClose,
    onExport,
    title = 'Export Data',
    currentCount,
    filteredCount,
    totalCount,
    loading = false,
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

    const [exportType, setExportType] = useState<'current' | 'filtered' | 'all'>('current');
    const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');

    const handleExport = async () => {
        await onExport({ type: exportType, format: exportFormat });
    };

    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            fullScreen={isMobile || fullScreen}
            PaperProps={{
                sx: {
                    borderRadius: isMobile ? 0 : 3,
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    bgcolor: 'success.main',
                    color: 'success.contrastText',
                    py: isMobile ? 1.5 : 2,
                    px: isMobile ? 2 : 3,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FileDownloadIcon />
                    <Typography variant={isMobile ? 'h6' : 'h6'} component="div" sx={{ fontWeight: 600 }}>
                        {title}
                    </Typography>
                </Box>
                {!loading && (
                    <IconButton
                        onClick={onClose}
                        size="small"
                        sx={{
                            color: 'inherit',
                            '&:hover': {
                                bgcolor: 'rgba(255, 255, 255, 0.1)',
                            },
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                )}
            </DialogTitle>

            {loading && <LinearProgress />}

            <DialogContent
                sx={{
                    px: isMobile ? 2 : 3,
                    py: isMobile ? 2 : 3,
                    bgcolor: 'background.default',
                }}
            >
                <Stack spacing={3}>
                    {/* Export Scope */}
                    <Box>
                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            Select Data to Export
                        </Typography>
                        <RadioGroup value={exportType} onChange={(e) => setExportType(e.target.value as any)}>
                            <Stack spacing={1}>
                                {currentCount !== undefined && (
                                    <FormControlLabel
                                        value="current"
                                        control={<Radio color="primary" />}
                                        label={
                                            <Box>
                                                <Typography variant="body2" fontWeight={500}>
                                                    Current Page
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {currentCount} records
                                                </Typography>
                                            </Box>
                                        }
                                        sx={{
                                            m: 0,
                                            p: 1.5,
                                            borderRadius: 1,
                                            border: '1px solid',
                                            borderColor: exportType === 'current' ? 'primary.main' : 'divider',
                                            bgcolor: exportType === 'current' ? 'primary.50' : 'transparent',
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                borderColor: 'primary.main',
                                                bgcolor: 'action.hover',
                                            },
                                        }}
                                    />
                                )}

                                {filteredCount !== undefined && (
                                    <FormControlLabel
                                        value="filtered"
                                        control={<Radio color="primary" />}
                                        label={
                                            <Box>
                                                <Typography variant="body2" fontWeight={500}>
                                                    Filtered Data
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {filteredCount} records (with current filters)
                                                </Typography>
                                            </Box>
                                        }
                                        sx={{
                                            m: 0,
                                            p: 1.5,
                                            borderRadius: 1,
                                            border: '1px solid',
                                            borderColor: exportType === 'filtered' ? 'primary.main' : 'divider',
                                            bgcolor: exportType === 'filtered' ? 'primary.50' : 'transparent',
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                borderColor: 'primary.main',
                                                bgcolor: 'action.hover',
                                            },
                                        }}
                                    />
                                )}

                                {totalCount !== undefined && (
                                    <FormControlLabel
                                        value="all"
                                        control={<Radio color="primary" />}
                                        label={
                                            <Box>
                                                <Typography variant="body2" fontWeight={500}>
                                                    All Data
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {totalCount} records (entire dataset)
                                                </Typography>
                                            </Box>
                                        }
                                        sx={{
                                            m: 0,
                                            p: 1.5,
                                            borderRadius: 1,
                                            border: '1px solid',
                                            borderColor: exportType === 'all' ? 'primary.main' : 'divider',
                                            bgcolor: exportType === 'all' ? 'primary.50' : 'transparent',
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                borderColor: 'primary.main',
                                                bgcolor: 'action.hover',
                                            },
                                        }}
                                    />
                                )}
                            </Stack>
                        </RadioGroup>
                    </Box>

                    <Divider />

                    {/* Export Format */}
                    <Box>
                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            File Format
                        </Typography>
                        <RadioGroup row value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)}>
                            <FormControlLabel
                                value="xlsx"
                                control={<Radio color="primary" />}
                                label="Excel (.xlsx)"
                                sx={{ mr: 3 }}
                            />
                            <FormControlLabel
                                value="csv"
                                control={<Radio color="primary" />}
                                label="CSV (.csv)"
                            />
                        </RadioGroup>
                    </Box>

                    {/* Info Alert */}
                    <Alert severity="info" sx={{ mt: 2 }}>
                        The export will include all visible columns based on your current column settings.
                    </Alert>
                </Stack>
            </DialogContent>

            <DialogActions
                sx={{
                    px: isMobile ? 2 : 3,
                    py: isMobile ? 1.5 : 2,
                    gap: 1,
                    bgcolor: 'grey.50',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    flexDirection: isMobile ? 'column-reverse' : 'row',
                    '& > *': {
                        width: isMobile ? '100%' : 'auto',
                        m: 0,
                    },
                }}
            >
                <Button
                    onClick={onClose}
                    variant="outlined"
                    color="secondary"
                    disabled={loading}
                >
                    Cancel
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button
                    onClick={handleExport}
                    variant="contained"
                    color="success"
                    startIcon={loading ? undefined : <DownloadIcon />}
                    disabled={loading}
                >
                    {loading ? 'Exporting...' : 'Download'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ExportDialog;
