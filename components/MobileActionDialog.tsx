'use client';
import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
    Box
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export interface MobileAction {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    color?: 'primary' | 'success' | 'error' | 'warning' | 'info';
}

interface MobileActionDialogProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    actions: MobileAction[];
}

export default function MobileActionDialog({
    open,
    onClose,
    title = 'Actions',
    actions
}: MobileActionDialogProps) {
    const handleActionClick = (action: MobileAction) => {
        action.onClick();
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xs"
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    m: 2
                }
            }}
        >
            <DialogTitle
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    pb: 1
                }}
            >
                {title}
                <IconButton
                    edge="end"
                    color="inherit"
                    onClick={onClose}
                    aria-label="close"
                    size="small"
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 0 }}>
                <List sx={{ py: 0 }}>
                    {actions.map((action, index) => (
                        <ListItemButton
                            key={index}
                            onClick={() => handleActionClick(action)}
                            sx={{
                                py: 2,
                                borderBottom: index < actions.length - 1 ? '1px solid #e0e0e0' : 'none'
                            }}
                        >
                            <ListItemIcon sx={{ color: action.color ? `${action.color}.main` : 'inherit', minWidth: 40 }}>
                                {action.icon}
                            </ListItemIcon>
                            <ListItemText
                                primary={action.label}
                                primaryTypographyProps={{
                                    fontWeight: 500
                                }}
                            />
                        </ListItemButton>
                    ))}
                </List>
            </DialogContent>
        </Dialog>
    );
}
