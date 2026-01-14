'use client';

import React from 'react';
import { Button, ButtonProps, CircularProgress, useTheme, useMediaQuery, Box } from '@mui/material';

interface StandardButtonProps extends ButtonProps {
    loading?: boolean;
    icon?: React.ReactNode;
    responsiveSize?: boolean;
}

export const StandardButton: React.FC<StandardButtonProps> = ({
    loading = false,
    icon,
    children,
    disabled,
    responsiveSize = true,
    size,
    variant = 'contained',
    ...props
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const buttonSize = responsiveSize && isMobile ? 'medium' : (size || 'small');

    return (
        <Button
            {...props}
            variant={variant}
            size={buttonSize}
            disabled={disabled || loading}
            startIcon={
                loading ? (
                    <CircularProgress
                        size={16}
                        color="inherit"
                        thickness={4}
                    />
                ) : icon
            }
            sx={{
                minHeight: { xs: 44, sm: 40 },
                minWidth: { xs: 'auto', sm: 80 },
                px: { xs: 2, sm: 2.5 },
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 2.5,
                fontSize: { xs: '0.875rem', sm: '0.8125rem' },
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                // Contained variant styles
                ...(variant === 'contained' && {
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    '&:hover': {
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        transform: 'translateY(-1px)',
                    },
                    '&:active': {
                        transform: 'translateY(0)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    },
                }),
                // Outlined variant styles
                ...(variant === 'outlined' && {
                    borderWidth: 1.5,
                    '&:hover': {
                        borderWidth: 1.5,
                        backgroundColor: 'rgba(30, 64, 175, 0.04)',
                    },
                }),
                // Disabled state
                '&.Mui-disabled': {
                    opacity: 0.6,
                },
                // Touch ripple enhancement
                '& .MuiTouchRipple-root': {
                    color: 'inherit',
                    opacity: 0.2,
                },
                ...props.sx,
            }}
        >
            {children}
        </Button>
    );
};

export default StandardButton;
