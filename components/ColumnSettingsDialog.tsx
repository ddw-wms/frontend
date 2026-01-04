// File: components/ColumnSettingsDialog.tsx
// Standardized column settings dialog for consistency across all pages
import React from 'react';
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
    Divider,
    useTheme,
    useMediaQuery,
    Stack,
} from '@mui/material';
import {
    Close as CloseIcon,
    Settings as SettingsIcon,
    RestartAlt as ResetIcon,
} from '@mui/icons-material';

interface ColumnSettingsDialogProps {
    open: boolean;
    onClose: () => void;
    columns: string[];
    visibleColumns: string[];
    onToggleColumn: (column: string) => void;
    onSelectAll: () => void;
    onReset: () => void;
    title?: string;
}

export const ColumnSettingsDialog: React.FC<ColumnSettingsDialogProps> = ({
    open,
    onClose,
    columns,
    visibleColumns,
    onToggleColumn,
    onSelectAll,
    onReset,
    title = 'Column Settings',
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

    const allSelected = columns.length === visibleColumns.length;
    const someSelected = visibleColumns.length > 0 && visibleColumns.length < columns.length;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            fullScreen={isMobile || fullScreen}
            PaperProps={{
                sx: {
                    borderRadius: isMobile ? 0 : 3,
                    maxHeight: isMobile ? '100%' : '85vh',
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    py: isMobile ? 1.5 : 2,
                    px: isMobile ? 2 : 3,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SettingsIcon />
                    <Typography variant={isMobile ? 'h6' : 'h6'} component="div" sx={{ fontWeight: 600 }}>
                        {title}
                    </Typography>
                </Box>
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
            </DialogTitle>

            <DialogContent
                sx={{
                    px: isMobile ? 2 : 3,
                    py: isMobile ? 2 : 3,
                    bgcolor: 'background.default',
                }}
            >
                <Stack spacing={2}>
                    {/* Summary */}
                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            {visibleColumns.length} of {columns.length} columns selected
                        </Typography>
                    </Box>

                    <Divider />

                    {/* Select All Checkbox */}
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={allSelected}
                                indeterminate={someSelected}
                                onChange={onSelectAll}
                                color="primary"
                            />
                        }
                        label={
                            <Typography variant="body1" fontWeight={600}>
                                {allSelected ? 'Deselect All' : 'Select All'}
                            </Typography>
                        }
                    />

                    <Divider />

                    {/* Column List */}
                    <Box sx={{ maxHeight: isMobile ? 'none' : '400px', overflowY: 'auto' }}>
                        <Stack spacing={0.5}>
                            {columns.map((col) => (
                                <FormControlLabel
                                    key={col}
                                    control={
                                        <Checkbox
                                            checked={visibleColumns.includes(col)}
                                            onChange={() => onToggleColumn(col)}
                                            color="primary"
                                            size={isMobile ? 'small' : 'medium'}
                                        />
                                    }
                                    label={
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                textTransform: 'capitalize',
                                                fontSize: isMobile ? '0.875rem' : '0.9375rem',
                                            }}
                                        >
                                            {col.replace(/_/g, ' ')}
                                        </Typography>
                                    }
                                    sx={{
                                        m: 0,
                                        py: 0.5,
                                        px: 1.5,
                                        borderRadius: 1,
                                        transition: 'background-color 0.2s',
                                        '&:hover': {
                                            bgcolor: 'action.hover',
                                        },
                                    }}
                                />
                            ))}
                        </Stack>
                    </Box>
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
                    flexDirection: isMobile ? 'column' : 'row',
                    '& > *': {
                        width: isMobile ? '100%' : 'auto',
                        m: 0,
                    },
                }}
            >
                <Button
                    onClick={onReset}
                    startIcon={<ResetIcon />}
                    variant="outlined"
                    color="secondary"
                    sx={{ order: isMobile ? 2 : 1 }}
                >
                    Reset to Default
                </Button>
                <Box sx={{ flex: 1, order: isMobile ? 3 : 2 }} />
                <Button
                    onClick={onClose}
                    variant="contained"
                    color="primary"
                    sx={{ order: isMobile ? 1 : 3 }}
                >
                    Done
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ColumnSettingsDialog;
