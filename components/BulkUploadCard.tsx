'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Stack,
    LinearProgress,
    Chip,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    IconButton,
    Collapse,
    useMediaQuery,
    useTheme,
    Tooltip,
    Divider,
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    Download as DownloadIcon,
    CheckCircle as CheckIcon,
    Error as ErrorIcon,
    Warning as WarningIcon,
    Close as CloseIcon,
    Refresh as RefreshIcon,
    Description as FileIcon,
    Cancel as CancelIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Info as InfoIcon,
} from '@mui/icons-material';
import { useBulkUpload, UploadModule, UploadJob, UploadStatus } from '@/app/context/BulkUploadContext';
import toast from 'react-hot-toast';

interface BulkUploadCardProps {
    module: UploadModule;
    warehouseId: number;
    userId?: number;
    onUploadComplete?: () => void;
    onDownloadTemplate: () => void;
    templateColumns: string[];
    title?: string;
}

// Format bytes to human readable
const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format duration
const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
};

// Get status color and icon
const getStatusInfo = (status: UploadStatus): { color: string; bgColor: string; icon: React.ReactNode; label: string } => {
    switch (status) {
        case 'validating':
            return {
                color: '#3b82f6',
                bgColor: '#dbeafe',
                icon: <CircularProgress size={16} sx={{ color: '#3b82f6' }} />,
                label: 'Validating...'
            };
        case 'uploading':
            return {
                color: '#8b5cf6',
                bgColor: '#ede9fe',
                icon: <UploadIcon sx={{ fontSize: 16, color: '#8b5cf6' }} />,
                label: 'Uploading...'
            };
        case 'processing':
            return {
                color: '#f59e0b',
                bgColor: '#fef3c7',
                icon: <CircularProgress size={16} sx={{ color: '#f59e0b' }} />,
                label: 'Processing...'
            };
        case 'completed':
            return {
                color: '#10b981',
                bgColor: '#d1fae5',
                icon: <CheckIcon sx={{ fontSize: 16, color: '#10b981' }} />,
                label: 'Completed'
            };
        case 'error':
            return {
                color: '#ef4444',
                bgColor: '#fee2e2',
                icon: <ErrorIcon sx={{ fontSize: 16, color: '#ef4444' }} />,
                label: 'Failed'
            };
        default:
            return {
                color: '#6b7280',
                bgColor: '#f3f4f6',
                icon: null,
                label: 'Idle'
            };
    }
};

export default function BulkUploadCard({
    module,
    warehouseId,
    userId,
    onUploadComplete,
    onDownloadTemplate,
    templateColumns,
    title = '📤 Bulk Upload',
}: BulkUploadCardProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

    const { startUpload, validateFile, getActiveJob, clearJob, hasActiveUpload, cancelUpload } = useBulkUpload();

    // Local state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [validationResult, setValidationResult] = useState<{
        valid: boolean;
        error?: string;
        rowCount?: number;
        columns?: string[];
    } | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [errorsExpanded, setErrorsExpanded] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get current job for this module
    const activeJob = getActiveJob(module);
    const isUploading = hasActiveUpload(module);

    // Call onUploadComplete when job completes
    useEffect(() => {
        if (activeJob?.status === 'completed' && onUploadComplete) {
            onUploadComplete();
        }
    }, [activeJob?.status, onUploadComplete]);

    // Handle file selection
    const handleFileSelect = useCallback(async (file: File | null) => {
        if (!file) {
            setSelectedFile(null);
            setValidationResult(null);
            return;
        }

        setSelectedFile(file);
        setIsValidating(true);
        setValidationResult(null);

        try {
            const result = await validateFile(file, module);
            setValidationResult(result);

            if (!result.valid) {
                toast.error(result.error || 'Invalid file');
            } else {
                toast.success(`✓ File validated: ${result.rowCount} rows found`);
            }
        } catch (e: any) {
            setValidationResult({ valid: false, error: e.message || 'Validation failed' });
            toast.error('File validation failed');
        } finally {
            setIsValidating(false);
        }
    }, [module, validateFile]);

    // Handle file input change
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        handleFileSelect(file);
        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    // Handle drag and drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    // Handle upload
    const handleUpload = async () => {
        if (!selectedFile || !validationResult?.valid || isUploading) return;

        const result = await startUpload(module, selectedFile, warehouseId, userId);

        if (result.success) {
            setSelectedFile(null);
            setValidationResult(null);
            toast.success('Upload started!');
        } else {
            toast.error(result.error || 'Upload failed');
        }
    };

    // Handle template download
    const handleDownloadClick = () => {
        setConfirmOpen(true);
    };

    const handleConfirmDownload = () => {
        setConfirmOpen(false);
        onDownloadTemplate();
        toast.success('Template downloaded');
    };

    // Handle clear job
    const handleClearJob = () => {
        if (activeJob) {
            clearJob(activeJob.id);
        }
        setSelectedFile(null);
        setValidationResult(null);
    };

    // Calculate progress bar color
    const getProgressColor = (status: UploadStatus): string => {
        switch (status) {
            case 'validating':
            case 'uploading':
                return 'primary';
            case 'processing':
                return 'warning';
            case 'completed':
                return 'success';
            case 'error':
                return 'error';
            default:
                return 'primary';
        }
    };

    return (
        <Card
            sx={{
                borderRadius: { xs: 1, sm: 1.5, md: 2 },
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                overflow: 'visible',
            }}
        >
            <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
                {/* Header */}
                <Typography
                    variant="subtitle1"
                    sx={{
                        fontWeight: 700,
                        mb: { xs: 1.5, sm: 2 },
                        color: '#1a237e',
                        fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' },
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                    }}
                >
                    {title}
                    {isUploading && (
                        <Chip
                            size="small"
                            label="In Progress"
                            sx={{
                                bgcolor: '#fef3c7',
                                color: '#92400e',
                                fontWeight: 600,
                                fontSize: '0.7rem',
                            }}
                        />
                    )}
                </Typography>

                <Stack spacing={{ xs: 1.5, sm: 2 }}>
                    {/* Template Download Button */}
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handleDownloadClick}
                        fullWidth={isMobile}
                        sx={{
                            py: { xs: 1, sm: 1.5 },
                            fontSize: { xs: '0.8rem', sm: '0.875rem' },
                            borderColor: '#667eea',
                            color: '#667eea',
                            '&:hover': {
                                borderColor: '#764ba2',
                                bgcolor: 'rgba(102, 126, 234, 0.04)',
                            },
                        }}
                    >
                        📥 Download Template
                    </Button>

                    {/* Template Info */}
                    <Box
                        sx={{
                            p: { xs: 1, sm: 1.5 },
                            bgcolor: '#f0f9ff',
                            borderRadius: 1,
                            border: '1px solid #bae6fd',
                        }}
                    >
                        <Typography
                            variant="caption"
                            sx={{
                                color: '#0369a1',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                mb: 0.5,
                            }}
                        >
                            <InfoIcon sx={{ fontSize: 14 }} />
                            Required Columns:
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{
                                color: '#0c4a6e',
                                wordBreak: 'break-word',
                            }}
                        >
                            {templateColumns.join(', ')}
                        </Typography>
                    </Box>

                    {/* File Drop Zone */}
                    <Box
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        sx={{
                            border: `2px dashed ${isDragOver ? '#764ba2' : validationResult?.valid === false ? '#ef4444' : '#667eea'}`,
                            borderRadius: 2,
                            p: { xs: 2, sm: 3, md: 4 },
                            textAlign: 'center',
                            cursor: isUploading ? 'not-allowed' : 'pointer',
                            background: isDragOver
                                ? 'rgba(118, 75, 162, 0.1)'
                                : validationResult?.valid === false
                                    ? 'rgba(239, 68, 68, 0.05)'
                                    : 'rgba(102, 126, 234, 0.03)',
                            transition: 'all 0.3s ease',
                            opacity: isUploading ? 0.6 : 1,
                            '&:hover': !isUploading ? {
                                background: 'rgba(102, 126, 234, 0.08)',
                                borderColor: '#764ba2',
                            } : {},
                        }}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileInputChange}
                            style={{ display: 'none' }}
                            disabled={isUploading}
                        />

                        {isValidating ? (
                            <>
                                <CircularProgress size={40} sx={{ color: '#667eea', mb: 1 }} />
                                <Typography sx={{ fontWeight: 600, color: '#667eea' }}>Validating file...</Typography>
                            </>
                        ) : selectedFile ? (
                            <>
                                <FileIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: validationResult?.valid ? '#10b981' : '#ef4444', mb: 1 }} />
                                <Typography
                                    sx={{
                                        fontWeight: 700,
                                        fontSize: { xs: '0.85rem', sm: '1rem' },
                                        color: validationResult?.valid ? '#065f46' : '#991b1b',
                                        wordBreak: 'break-word',
                                    }}
                                >
                                    {selectedFile.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mt: 0.5 }}>
                                    {formatBytes(selectedFile.size)}
                                    {validationResult?.rowCount && ` • ${validationResult.rowCount} rows`}
                                </Typography>
                                {validationResult?.valid === false && (
                                    <Alert
                                        severity="error"
                                        sx={{
                                            mt: 1,
                                            textAlign: 'left',
                                            '& .MuiAlert-message': { fontSize: { xs: '0.75rem', sm: '0.8rem' } },
                                        }}
                                    >
                                        {validationResult.error}
                                    </Alert>
                                )}
                                {validationResult?.valid && (
                                    <Chip
                                        icon={<CheckIcon />}
                                        label="Valid file"
                                        size="small"
                                        sx={{
                                            mt: 1,
                                            bgcolor: '#d1fae5',
                                            color: '#065f46',
                                            fontWeight: 600,
                                        }}
                                    />
                                )}
                            </>
                        ) : (
                            <>
                                <UploadIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: '#667eea', mb: 1 }} />
                                <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.85rem', sm: '1rem' } }}>
                                    {isMobile ? 'Tap to select file' : 'Click or drag file here'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                                    .xlsx, .xls, or .csv (max 50MB)
                                </Typography>
                            </>
                        )}
                    </Box>

                    {/* Action Buttons */}
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{ width: '100%' }}
                    >
                        {selectedFile && !isUploading && (
                            <Button
                                variant="outlined"
                                color="inherit"
                                onClick={() => {
                                    setSelectedFile(null);
                                    setValidationResult(null);
                                }}
                                sx={{
                                    flex: { xs: 1, sm: 'none' },
                                    py: { xs: 1, sm: 1.5 },
                                    color: '#6b7280',
                                    borderColor: '#d1d5db',
                                }}
                            >
                                Clear
                            </Button>
                        )}
                        <Button
                            variant="contained"
                            onClick={handleUpload}
                            disabled={!selectedFile || !validationResult?.valid || isUploading}
                            startIcon={isUploading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <UploadIcon />}
                            sx={{
                                flex: 1,
                                py: { xs: 1.2, sm: 1.5 },
                                fontSize: { xs: '0.85rem', sm: '0.9rem' },
                                fontWeight: 700,
                                background: (!selectedFile || !validationResult?.valid || isUploading)
                                    ? '#9ca3af'
                                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                                },
                                '&.Mui-disabled': {
                                    background: '#d1d5db',
                                    color: '#9ca3af',
                                },
                            }}
                        >
                            {isUploading ? 'Uploading...' : 'Upload'}
                        </Button>
                    </Stack>
                </Stack>

                {/* Upload Progress Section */}
                {activeJob && activeJob.status !== 'idle' && (
                    <Box sx={{ mt: { xs: 2, sm: 3 } }}>
                        <Divider sx={{ mb: { xs: 1.5, sm: 2 } }} />

                        <Card
                            sx={{
                                borderRadius: 1.5,
                                border: `2px solid ${getStatusInfo(activeJob.status).color}20`,
                                bgcolor: getStatusInfo(activeJob.status).bgColor,
                                overflow: 'hidden',
                            }}
                        >
                            <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                                {/* Status Header */}
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        mb: 1.5,
                                        flexWrap: 'wrap',
                                        gap: 1,
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {getStatusInfo(activeJob.status).icon}
                                        <Typography
                                            sx={{
                                                fontWeight: 700,
                                                color: getStatusInfo(activeJob.status).color,
                                                fontSize: { xs: '0.85rem', sm: '0.95rem' },
                                            }}
                                        >
                                            {getStatusInfo(activeJob.status).label}
                                        </Typography>
                                    </Box>

                                    <Stack direction="row" spacing={0.5}>
                                        {(activeJob.status === 'uploading' || activeJob.status === 'processing') && (
                                            <Tooltip title="Cancel Upload">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => cancelUpload(activeJob.id)}
                                                    sx={{ color: '#ef4444' }}
                                                >
                                                    <CancelIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {(activeJob.status === 'completed' || activeJob.status === 'error') && (
                                            <Tooltip title="Dismiss">
                                                <IconButton
                                                    size="small"
                                                    onClick={handleClearJob}
                                                    sx={{ color: '#6b7280' }}
                                                >
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Stack>
                                </Box>

                                {/* Progress Bar */}
                                {(activeJob.status === 'uploading' || activeJob.status === 'processing' || activeJob.status === 'validating') && (
                                    <Box sx={{ mb: 1.5 }}>
                                        <LinearProgress
                                            variant={activeJob.status === 'validating' ? 'indeterminate' : 'determinate'}
                                            value={activeJob.progress}
                                            color={getProgressColor(activeJob.status) as any}
                                            sx={{
                                                height: { xs: 6, sm: 8 },
                                                borderRadius: 4,
                                                bgcolor: 'rgba(0,0,0,0.1)',
                                            }}
                                        />
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                display: 'block',
                                                textAlign: 'right',
                                                mt: 0.5,
                                                fontWeight: 600,
                                                color: getStatusInfo(activeJob.status).color,
                                            }}
                                        >
                                            {activeJob.progress}%
                                        </Typography>
                                    </Box>
                                )}

                                {/* Stats Grid */}
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                                        gap: { xs: 1, sm: 1.5 },
                                    }}
                                >
                                    {/* Batch ID */}
                                    {activeJob.batchId && (
                                        <Box>
                                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block' }}>
                                                Batch ID
                                            </Typography>
                                            <Chip
                                                label={activeJob.batchId}
                                                size="small"
                                                sx={{
                                                    mt: 0.25,
                                                    maxWidth: '100%',
                                                    fontWeight: 600,
                                                    fontSize: '0.7rem',
                                                    bgcolor: 'rgba(0,0,0,0.08)',
                                                    '& .MuiChip-label': {
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    },
                                                }}
                                            />
                                        </Box>
                                    )}

                                    {/* Total Rows */}
                                    <Box>
                                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block' }}>
                                            Total Rows
                                        </Typography>
                                        <Typography sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.1rem' }, color: '#1e293b' }}>
                                            {activeJob.totalRows.toLocaleString()}
                                        </Typography>
                                    </Box>

                                    {/* Success Count */}
                                    {activeJob.status === 'completed' && (
                                        <Box>
                                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block' }}>
                                                Success
                                            </Typography>
                                            <Typography sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.1rem' }, color: '#10b981' }}>
                                                {activeJob.successCount.toLocaleString()}
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Error Count */}
                                    {activeJob.errorCount > 0 && (
                                        <Box>
                                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block' }}>
                                                Errors
                                            </Typography>
                                            <Typography sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.1rem' }, color: '#ef4444' }}>
                                                {activeJob.errorCount.toLocaleString()}
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Duration */}
                                    {activeJob.endTime && (
                                        <Box>
                                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'block' }}>
                                                Duration
                                            </Typography>
                                            <Typography sx={{ fontWeight: 600, fontSize: { xs: '0.85rem', sm: '0.9rem' }, color: '#475569' }}>
                                                {formatDuration(activeJob.endTime - activeJob.startTime)}
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>

                                {/* Errors Section */}
                                {activeJob.errors.length > 0 && (
                                    <Box sx={{ mt: 2 }}>
                                        <Button
                                            size="small"
                                            onClick={() => setErrorsExpanded(!errorsExpanded)}
                                            endIcon={errorsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                            sx={{
                                                color: '#ef4444',
                                                fontWeight: 600,
                                                mb: 1,
                                            }}
                                        >
                                            View Errors ({activeJob.errors.length})
                                        </Button>

                                        <Collapse in={errorsExpanded}>
                                            <Box
                                                sx={{
                                                    maxHeight: { xs: 150, sm: 200 },
                                                    overflow: 'auto',
                                                    borderRadius: 1,
                                                    bgcolor: 'rgba(239, 68, 68, 0.05)',
                                                    p: 1,
                                                }}
                                            >
                                                {activeJob.errors.slice(0, 50).map((error, idx) => (
                                                    <Alert
                                                        key={idx}
                                                        severity="error"
                                                        sx={{
                                                            mb: 0.5,
                                                            py: 0,
                                                            '& .MuiAlert-message': {
                                                                fontSize: { xs: '0.7rem', sm: '0.75rem' }
                                                            },
                                                        }}
                                                    >
                                                        {error.row && `Row ${error.row}: `}
                                                        {error.wsn && `WSN ${error.wsn}: `}
                                                        {error.message}
                                                    </Alert>
                                                ))}
                                                {activeJob.errors.length > 50 && (
                                                    <Typography variant="caption" sx={{ color: '#ef4444', display: 'block', mt: 1 }}>
                                                        ... and {activeJob.errors.length - 50} more errors
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Collapse>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Box>
                )}
            </CardContent>

            {/* Confirm Download Dialog */}
            <Dialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        mx: { xs: 2, sm: 0 },
                    },
                }}
            >
                <DialogTitle sx={{ fontWeight: 700, color: '#1a237e', fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                    Confirm Download
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ color: '#334155', mb: 2, fontSize: { xs: '0.85rem', sm: '0.9rem' } }}>
                        Would you like to download the bulk upload template?
                    </Typography>
                    <Alert severity="info" sx={{ '& .MuiAlert-message': { fontSize: { xs: '0.75rem', sm: '0.8rem' } } }}>
                        Fill in the template with your data and upload it back.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ p: { xs: 1.5, sm: 2 } }}>
                    <Button onClick={() => setConfirmOpen(false)} sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleConfirmDownload}
                        sx={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            fontSize: { xs: '0.8rem', sm: '0.875rem' },
                        }}
                    >
                        Yes, Download
                    </Button>
                </DialogActions>
            </Dialog>
        </Card>
    );
}
