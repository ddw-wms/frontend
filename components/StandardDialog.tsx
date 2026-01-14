// File: components/StandardDialog.tsx
// Standardized dialog component for consistency across all pages
import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Typography,
    useTheme,
    useMediaQuery,
    Slide,
    Box,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';

const Transition = React.forwardRef(function Transition(
    props: TransitionProps & {
        children: React.ReactElement<any, any>;
    },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

interface StandardDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
    maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    fullWidth?: boolean;
    showCloseButton?: boolean;
    dividers?: boolean;
}

export const StandardDialog: React.FC<StandardDialogProps> = ({
    open,
    onClose,
    title,
    children,
    actions,
    maxWidth = 'sm',
    fullWidth = true,
    showCloseButton = true,
    dividers = true,
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));
    const fullScreen = isMobile;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth={maxWidth}
            fullWidth={fullWidth}
            fullScreen={fullScreen}
            TransitionComponent={Transition}
            transitionDuration={{ enter: 250, exit: 200 }}
            PaperProps={{
                elevation: 0,
                sx: {
                    borderRadius: isMobile ? 0 : 16,
                    maxHeight: isMobile ? '100%' : '90vh',
                    boxShadow: isMobile ? 'none' : '0 25px 50px -12px rgba(0,0,0,0.25)',
                    overflow: 'hidden',
                },
            }}
            sx={{
                '& .MuiBackdrop-root': {
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(4px)',
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
                    color: 'white',
                    py: { xs: 1.75, sm: 2 },
                    px: { xs: 2, sm: 3 },
                    minHeight: { xs: 56, sm: 64 },
                }}
            >
                <Typography
                    variant={isMobile ? 'h6' : 'h5'}
                    component="div"
                    sx={{
                        fontWeight: 700,
                        fontSize: { xs: '1rem', sm: '1.25rem' },
                        letterSpacing: '-0.01em',
                    }}
                >
                    {title}
                </Typography>
                {showCloseButton && (
                    <IconButton
                        onClick={onClose}
                        size="small"
                        sx={{
                            color: 'inherit',
                            ml: 2,
                            bgcolor: 'rgba(255,255,255,0.1)',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                                bgcolor: 'rgba(255, 255, 255, 0.2)',
                                transform: 'scale(1.05)',
                            },
                        }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                )}
            </DialogTitle>

            <DialogContent
                dividers={dividers}
                sx={{
                    px: { xs: 2, sm: 3 },
                    py: { xs: 2.5, sm: 3 },
                    overflowY: 'auto',
                    bgcolor: '#fafbfc',
                    '&.MuiDialogContent-dividers': {
                        borderColor: 'rgba(0,0,0,0.06)',
                    },
                }}
            >
                {children}
            </DialogContent>

            {actions && (
                <DialogActions
                    sx={{
                        px: { xs: 2, sm: 3 },
                        py: { xs: 2, sm: 2.5 },
                        gap: 1.5,
                        bgcolor: 'white',
                        borderTop: '1px solid rgba(0,0,0,0.06)',
                        flexDirection: { xs: 'column-reverse', sm: 'row' },
                        '& > *': {
                            width: { xs: '100%', sm: 'auto' },
                            m: '0 !important',
                        },
                        // Safe area padding for iOS
                        pb: { xs: 'calc(16px + env(safe-area-inset-bottom))', sm: 2.5 },
                    }}
                >
                    {actions}
                </DialogActions>
            )}
        </Dialog>
    );
};

export default StandardDialog;
