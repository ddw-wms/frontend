'use client';
import React from 'react';
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import {
    Add as AddIcon,
    Download as DownloadIcon,
    Refresh as RefreshIcon,
    Settings as SettingsIcon,
    Tune as TuneIcon
} from '@mui/icons-material';

export interface ActionButtonConfig {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    color?: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'inherit';
    variant?: 'contained' | 'outlined' | 'text';
    disabled?: boolean;
    tooltip?: string;
    show?: boolean;
}

interface ActionButtonBarProps {
    buttons: ActionButtonConfig[];
    mobileMenuButton?: React.ReactNode;
    showOnMobile?: boolean;
}

export default function ActionButtonBar({
    buttons,
    mobileMenuButton,
    showOnMobile = false
}: ActionButtonBarProps) {
    const visibleButtons = buttons.filter(btn => btn.show !== false);

    return (
        <>
            {/* Desktop: Show all buttons */}
            <Box sx={{
                display: { xs: 'none', md: 'flex' },
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap'
            }}>
                {visibleButtons.map((button, index) => (
                    <Tooltip key={index} title={button.tooltip || ''} arrow>
                        <span>
                            <Button
                                startIcon={button.icon}
                                onClick={button.onClick}
                                variant={button.variant || 'outlined'}
                                color={button.color || 'primary'}
                                disabled={button.disabled}
                                size="small"
                                sx={{
                                    height: 36,
                                    px: 2,
                                    fontWeight: 600,
                                    fontSize: '0.8rem',
                                    textTransform: 'none',
                                    borderWidth: button.variant === 'outlined' ? 2 : 0,
                                    '&:hover': {
                                        borderWidth: button.variant === 'outlined' ? 2 : 0
                                    }
                                }}
                            >
                                {button.label}
                            </Button>
                        </span>
                    </Tooltip>
                ))}
            </Box>

            {/* Mobile: Show menu button or individual buttons if showOnMobile is true */}
            <Box sx={{
                display: { xs: 'flex', md: 'none' },
                gap: 0.5,
                alignItems: 'center'
            }}>
                {showOnMobile ? (
                    visibleButtons.map((button, index) => (
                        <Tooltip key={index} title={button.tooltip || button.label} arrow>
                            <span>
                                <IconButton
                                    onClick={button.onClick}
                                    color={button.color || 'primary'}
                                    disabled={button.disabled}
                                    size="small"
                                    sx={{
                                        bgcolor: button.variant === 'contained' ? `${button.color || 'primary'}.main` : 'transparent',
                                        color: button.variant === 'contained' ? 'white' : `${button.color || 'primary'}.main`,
                                        border: button.variant === 'outlined' ? 2 : 0,
                                        borderColor: `${button.color || 'primary'}.main`,
                                        '&:hover': {
                                            bgcolor: button.variant === 'contained' ? `${button.color || 'primary'}.dark` : 'rgba(0,0,0,0.04)'
                                        }
                                    }}
                                >
                                    {button.icon}
                                </IconButton>
                            </span>
                        </Tooltip>
                    ))
                ) : (
                    mobileMenuButton
                )}
            </Box>
        </>
    );
}
