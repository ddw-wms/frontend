// SubmitProgressDialog.tsx - Visual progress indicator for Fast Submit
'use client';

import React from 'react';
import {
    Box,
    Button,
    Typography,
    Dialog,
    DialogContent,
    LinearProgress,
    Stack,
    Chip,
    IconButton,
    Collapse,
    List,
    ListItem,
    ListItemText,
    alpha,
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    ContentCopy as DuplicateIcon,
    Cancel as CancelIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Send as SendIcon,
} from '@mui/icons-material';

interface SubmitProgress {
    total: number;
    completed: number;
    successCount: number;
    failedCount: number;
    duplicateCount: number;
    currentBatch: number;
    isComplete: boolean;
    errors: Array<{ wsn: string; error: string }>;
}

interface SubmitProgressDialogProps {
    open: boolean;
    progress: SubmitProgress | null;
    onCancel?: () => void;
    onClose?: () => void;
    pageType: 'inbound' | 'qc' | 'picking' | 'outbound';
}

export default function SubmitProgressDialog({
    open,
    progress,
    onCancel,
    onClose,
    pageType,
}: SubmitProgressDialogProps) {
    const [showErrors, setShowErrors] = React.useState(false);

    if (!progress) return null;

    const percentComplete = progress.total > 0
        ? Math.round((progress.completed / progress.total) * 100)
        : 0;

    // Page-specific colors
    const pageColors: Record<string, { primary: string; secondary: string }> = {
        inbound: { primary: '#10b981', secondary: '#059669' },
        qc: { primary: '#8b5cf6', secondary: '#7c3aed' },
        picking: { primary: '#f59e0b', secondary: '#d97706' },
        outbound: { primary: '#3b82f6', secondary: '#2563eb' },
    };
    const colors = pageColors[pageType] || pageColors.inbound;

    return (
        <Dialog
            open={open}
            onClose={progress.isComplete ? onClose : undefined}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    overflow: 'hidden',
                }
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    p: 2.5,
                    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                    color: 'white',
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <SendIcon sx={{ fontSize: 28 }} />
                    <Box>
                        <Typography variant="h6" fontWeight={700}>
                            {progress.isComplete ? 'Submission Complete' : 'Submitting...'}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                            {progress.isComplete
                                ? `Processed ${progress.total} entries`
                                : `Processing batch ${progress.currentBatch}`
                            }
                        </Typography>
                    </Box>
                </Stack>
            </Box>

            <DialogContent sx={{ py: 3 }}>
                {/* Progress Bar */}
                <Box sx={{ mb: 3 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="body2" fontWeight={600} color="text.secondary">
                            Progress
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color={colors.primary}>
                            {progress.completed} / {progress.total} ({percentComplete}%)
                        </Typography>
                    </Stack>
                    <LinearProgress
                        variant="determinate"
                        value={percentComplete}
                        sx={{
                            height: 10,
                            borderRadius: 5,
                            bgcolor: alpha(colors.primary, 0.15),
                            '& .MuiLinearProgress-bar': {
                                borderRadius: 5,
                                bgcolor: colors.primary,
                            }
                        }}
                    />
                </Box>

                {/* Stats Chips */}
                <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mb: 2 }}>
                    <Chip
                        icon={<CheckCircleIcon sx={{ fontSize: 18 }} />}
                        label={`${progress.successCount} Success`}
                        size="small"
                        sx={{
                            bgcolor: alpha('#10b981', 0.1),
                            color: '#10b981',
                            fontWeight: 600,
                            '& .MuiChip-icon': { color: '#10b981' }
                        }}
                    />
                    <Chip
                        icon={<DuplicateIcon sx={{ fontSize: 18 }} />}
                        label={`${progress.duplicateCount} Duplicates`}
                        size="small"
                        sx={{
                            bgcolor: alpha('#f59e0b', 0.1),
                            color: '#f59e0b',
                            fontWeight: 600,
                            '& .MuiChip-icon': { color: '#f59e0b' }
                        }}
                    />
                    <Chip
                        icon={<ErrorIcon sx={{ fontSize: 18 }} />}
                        label={`${progress.failedCount} Failed`}
                        size="small"
                        sx={{
                            bgcolor: alpha('#ef4444', 0.1),
                            color: '#ef4444',
                            fontWeight: 600,
                            '& .MuiChip-icon': { color: '#ef4444' }
                        }}
                    />
                </Stack>

                {/* Error Details (collapsible) */}
                {progress.errors.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                        <Button
                            size="small"
                            onClick={() => setShowErrors(!showErrors)}
                            endIcon={showErrors ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            sx={{
                                textTransform: 'none',
                                color: '#ef4444',
                                fontWeight: 600,
                            }}
                        >
                            {showErrors ? 'Hide' : 'Show'} Error Details ({progress.errors.length})
                        </Button>
                        <Collapse in={showErrors}>
                            <List dense sx={{ mt: 1, maxHeight: 200, overflow: 'auto', bgcolor: '#fef2f2', borderRadius: 2 }}>
                                {progress.errors.map((err, idx) => (
                                    <ListItem key={idx} sx={{ py: 0.5 }}>
                                        <ListItemText
                                            primary={<Typography variant="body2" fontWeight={600}>{err.wsn}</Typography>}
                                            secondary={<Typography variant="caption" color="error">{err.error}</Typography>}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </Collapse>
                    </Box>
                )}

                {/* Action Buttons */}
                <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                    {!progress.isComplete && onCancel && (
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<CancelIcon />}
                            onClick={onCancel}
                        >
                            Cancel
                        </Button>
                    )}
                    {progress.isComplete && onClose && (
                        <Button
                            variant="contained"
                            onClick={onClose}
                            sx={{
                                bgcolor: colors.primary,
                                '&:hover': { bgcolor: colors.secondary }
                            }}
                        >
                            Done
                        </Button>
                    )}
                </Stack>
            </DialogContent>
        </Dialog>
    );
}
