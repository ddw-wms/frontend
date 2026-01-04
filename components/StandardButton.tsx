'use client';

import React from 'react';
import { Button, ButtonProps, CircularProgress, useTheme, useMediaQuery } from '@mui/material';

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
    ...props
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const buttonSize = responsiveSize && isMobile ? 'medium' : (size || 'small');

    return (
        <Button
            {...props}
            size={buttonSize}
            disabled={disabled || loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : icon}
            sx={{
                minHeight: isMobile ? 40 : 36,
                minWidth: isMobile ? 'auto' : 64,
                textTransform: 'none',
                fontWeight: 600,
                borderWidth: props.variant === 'outlined' ? 2 : undefined,
                '&:hover': {
                    borderWidth: props.variant === 'outlined' ? 2 : undefined,
                },
                ...props.sx,
            }}
        >
            {children}
        </Button>
    );
};

export default StandardButton;
