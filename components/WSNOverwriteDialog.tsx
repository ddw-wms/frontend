// File Path = warehouse-frontend/components/WSNOverwriteDialog.tsx
'use client';

import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Divider,
    Chip,
    useTheme,
} from '@mui/material';
import {
    Warning as WarningIcon,
    SwapHoriz as ReplaceIcon,
    KeyboardArrowDown as NextRowIcon,
    Close as CancelIcon,
} from '@mui/icons-material';

export interface WSNOverwriteDialogData {
    open: boolean;
    rowIndex: number;
    existingWSN: string;
    existingData: {
        product_title?: string;
        brand?: string;
        mrp?: number | string;
        fsp?: number | string;
        fsn?: string;
        cms_vertical?: string;
        [key: string]: any;
    };
    newWSN: string;
}

interface WSNOverwriteDialogProps {
    data: WSNOverwriteDialogData | null;
    onCancel: () => void;
    onReplace: () => void;
    onAddToNextRow: () => void;
}

export default function WSNOverwriteDialog({
    data,
    onCancel,
    onReplace,
    onAddToNextRow,
}: WSNOverwriteDialogProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    if (!data) return null;

    const { rowIndex, existingWSN, existingData, newWSN } = data;

    return (
        <Dialog
            open={data.open}
            onClose={onCancel}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    border: `2px solid ${theme.palette.warning.main}`,
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    bgcolor: isDarkMode ? 'rgba(237, 137, 54, 0.1)' : 'rgba(237, 137, 54, 0.05)',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                }}
            >
                <WarningIcon color="warning" />
                <Typography variant="h6" fontWeight={600}>
                    Row Already Has WSN
                </Typography>
                <Chip
                    label={`Row ${rowIndex + 1}`}
                    size="small"
                    color="warning"
                    sx={{ ml: 'auto' }}
                />
            </DialogTitle>

            <DialogContent sx={{ pt: 3 }}>
                {/* Existing WSN Info */}
                <Box
                    sx={{
                        p: 2,
                        borderRadius: 1,
                        bgcolor: isDarkMode ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)',
                        border: `1px solid ${theme.palette.success.main}`,
                        mb: 2,
                    }}
                >
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Current WSN in this row:
                    </Typography>
                    <Typography variant="h5" fontWeight={700} color="success.main" sx={{ mb: 1 }}>
                        {existingWSN}
                    </Typography>
                    {existingData?.product_title && (
                        <Typography variant="body2" color="text.secondary" noWrap>
                            <strong>Product:</strong> {existingData.product_title}
                        </Typography>
                    )}
                    <Box display="flex" gap={2} flexWrap="wrap" mt={0.5}>
                        {existingData?.brand && (
                            <Typography variant="body2" color="text.secondary">
                                <strong>Brand:</strong> {existingData.brand}
                            </Typography>
                        )}
                        {existingData?.mrp && (
                            <Typography variant="body2" color="text.secondary">
                                <strong>MRP:</strong> ₹{existingData.mrp}
                            </Typography>
                        )}
                        {existingData?.fsp && (
                            <Typography variant="body2" color="text.secondary">
                                <strong>FSP:</strong> ₹{existingData.fsp}
                            </Typography>
                        )}
                    </Box>
                </Box>

                <Divider sx={{ my: 2 }}>
                    <Chip label="↓ Will be replaced by ↓" size="small" />
                </Divider>

                {/* New WSN Info */}
                <Box
                    sx={{
                        p: 2,
                        borderRadius: 1,
                        bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                        border: `1px solid ${theme.palette.warning.main}`,
                    }}
                >
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        New WSN scanned:
                    </Typography>
                    <Typography variant="h5" fontWeight={700} color="warning.main">
                        {newWSN}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Master data will be loaded after you confirm
                    </Typography>
                </Box>

                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 2, textAlign: 'center' }}
                >
                    What would you like to do?
                </Typography>
            </DialogContent>

            <DialogActions
                sx={{
                    px: 3,
                    pb: 2,
                    pt: 1,
                    gap: 1,
                    flexDirection: { xs: 'column', sm: 'row' },
                }}
            >
                <Button
                    onClick={onCancel}
                    variant="outlined"
                    color="inherit"
                    startIcon={<CancelIcon />}
                    fullWidth
                    sx={{ order: { xs: 3, sm: 1 } }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={onReplace}
                    variant="outlined"
                    color="warning"
                    startIcon={<ReplaceIcon />}
                    fullWidth
                    sx={{ order: { xs: 2, sm: 2 } }}
                >
                    Replace
                </Button>
                <Button
                    onClick={onAddToNextRow}
                    variant="contained"
                    color="primary"
                    startIcon={<NextRowIcon />}
                    fullWidth
                    sx={{ order: { xs: 1, sm: 3 } }}
                >
                    Add to Next Row
                </Button>
            </DialogActions>
        </Dialog>
    );
}
