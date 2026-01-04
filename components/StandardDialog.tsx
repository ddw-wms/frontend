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
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth={maxWidth}
            fullWidth={fullWidth}
            fullScreen={isMobile || fullScreen}
            TransitionComponent={Transition}
            PaperProps={{
                elevation: 8,
                sx: {
                    borderRadius: isMobile ? 0 : 3,
                    maxHeight: isMobile ? '100%' : '90vh',
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
                <Typography
                    variant={isMobile ? 'h6' : 'h5'}
                    component="div"
                    sx={{ fontWeight: 600 }}
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
                            '&:hover': {
                                bgcolor: 'rgba(255, 255, 255, 0.1)',
                            },
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                )}
            </DialogTitle>

            <DialogContent
                dividers={dividers}
                sx={{
                    px: isMobile ? 2 : 3,
                    py: isMobile ? 2 : 3,
                    overflowY: 'auto',
                    bgcolor: 'background.default',
                }}
            >
                {children}
            </DialogContent>

            {actions && (
                <DialogActions
                    sx={{
                        px: isMobile ? 2 : 3,
                        py: isMobile ? 1.5 : 2,
                        gap: 1,
                        bgcolor: 'grey.50',
                        flexDirection: isMobile ? 'column-reverse' : 'row',
                        '& > *': {
                            width: isMobile ? '100%' : 'auto',
                            m: 0,
                        },
                    }}
                >
                    {actions}
                </DialogActions>
            )}
        </Dialog>
    );
};

export default StandardDialog;
