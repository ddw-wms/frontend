// File: components/StandardActionButtons.tsx
// Standardized action button group for consistency
import React from 'react';
import { Button, Stack, useTheme, useMediaQuery, IconButton, Tooltip } from '@mui/material';
import {
    Add as AddIcon,
    Download as DownloadIcon,
    Upload as UploadIcon,
    Refresh as RefreshIcon,
    Settings as SettingsIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Print as PrintIcon,
    FilterList as FilterListIcon,
} from '@mui/icons-material';

export interface ActionButton {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'contained' | 'outlined' | 'text';
    color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
    disabled?: boolean;
    loading?: boolean;
    show?: boolean;
}

interface StandardActionButtonsProps {
    buttons: ActionButton[];
    compact?: boolean;
    direction?: 'row' | 'column';
}

export const StandardActionButtons: React.FC<StandardActionButtonsProps> = ({
    buttons,
    compact = false,
    direction,
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const visibleButtons = buttons.filter(btn => btn.show !== false);
    const finalDirection = direction || (isMobile ? 'column' : 'row');

    if (compact && isMobile) {
        // Mobile compact mode - show icons only
        return (
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {visibleButtons.map((btn, idx) => (
                    <Tooltip key={idx} title={btn.label} arrow>
                        <span>
                            <IconButton
                                onClick={btn.onClick}
                                disabled={btn.disabled || btn.loading}
                                color={btn.color || 'primary'}
                                size="small"
                                sx={{
                                    bgcolor: btn.variant === 'contained' ? `${btn.color || 'primary'}.main` : 'transparent',
                                    color: btn.variant === 'contained' ? 'white' : undefined,
                                    '&:hover': {
                                        bgcolor: btn.variant === 'contained' ? `${btn.color || 'primary'}.dark` : 'action.hover',
                                    },
                                }}
                            >
                                {btn.icon || <SettingsIcon />}
                            </IconButton>
                        </span>
                    </Tooltip>
                ))}
            </Stack>
        );
    }

    return (
        <Stack
            direction={finalDirection}
            spacing={1}
            sx={{
                width: isMobile && finalDirection === 'column' ? '100%' : 'auto',
            }}
        >
            {visibleButtons.map((btn, idx) => (
                <Button
                    key={idx}
                    variant={btn.variant || 'contained'}
                    color={btn.color || 'primary'}
                    onClick={btn.onClick}
                    disabled={btn.disabled || btn.loading}
                    startIcon={btn.icon}
                    size={isMobile ? 'medium' : 'small'}
                    sx={{
                        minHeight: isMobile ? 40 : 36,
                        textTransform: 'none',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        width: isMobile && finalDirection === 'column' ? '100%' : 'auto',
                    }}
                >
                    {btn.loading ? 'Loading...' : btn.label}
                </Button>
            ))}
        </Stack>
    );
};

// Pre-configured common buttons
export const commonButtons = {
    add: (onClick: () => void, disabled = false): ActionButton => ({
        label: 'Add New',
        icon: <AddIcon />,
        onClick,
        variant: 'contained',
        color: 'primary',
        disabled,
    }),

    export: (onClick: () => void, disabled = false): ActionButton => ({
        label: 'Export',
        icon: <DownloadIcon />,
        onClick,
        variant: 'outlined',
        color: 'success',
        disabled,
    }),

    import: (onClick: () => void, disabled = false): ActionButton => ({
        label: 'Import',
        icon: <UploadIcon />,
        onClick,
        variant: 'outlined',
        color: 'primary',
        disabled,
    }),

    refresh: (onClick: () => void, loading = false): ActionButton => ({
        label: 'Refresh',
        icon: <RefreshIcon />,
        onClick,
        variant: 'outlined',
        color: 'primary',
        loading,
    }),

    columnSettings: (onClick: () => void): ActionButton => ({
        label: 'Columns',
        icon: <SettingsIcon />,
        onClick,
        variant: 'outlined',
        color: 'secondary',
    }),

    delete: (onClick: () => void, disabled = false): ActionButton => ({
        label: 'Delete',
        icon: <DeleteIcon />,
        onClick,
        variant: 'outlined',
        color: 'error',
        disabled,
    }),

    edit: (onClick: () => void, disabled = false): ActionButton => ({
        label: 'Edit',
        icon: <EditIcon />,
        onClick,
        variant: 'outlined',
        color: 'primary',
        disabled,
    }),

    print: (onClick: () => void, disabled = false): ActionButton => ({
        label: 'Print',
        icon: <PrintIcon />,
        onClick,
        variant: 'outlined',
        color: 'primary',
        disabled,
    }),

    filters: (onClick: () => void, active = false): ActionButton => ({
        label: active ? 'Hide Filters' : 'Show Filters',
        icon: <FilterListIcon />,
        onClick,
        variant: active ? 'contained' : 'outlined',
        color: 'primary',
    }),
};

export default StandardActionButtons;
