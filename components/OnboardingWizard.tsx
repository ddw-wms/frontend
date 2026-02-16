'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    Stepper,
    Step,
    StepLabel,
    Button,
    Box,
    Typography,
    useTheme,
    useMediaQuery,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Card,
    CardContent,
    Stack,
    Chip,
    Alert,
    CircularProgress,
    IconButton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useWarehouse } from '@/app/context/WarehouseContext';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import PrintIcon from '@mui/icons-material/Print';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import { warehousesAPI } from '@/lib/api';

const steps = ['Select Warehouse', 'Configure Printer', 'Get Started'];

interface OnboardingWizardProps {
    open: boolean;
    onComplete: () => void;
}

export default function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
    const [activeStep, setActiveStep] = useState(0);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState<number | ''>('');
    const [loading, setLoading] = useState(true);
    const [printAgentConnected, setPrintAgentConnected] = useState(false);
    const [canSkip, setCanSkip] = useState(false);

    // Access WarehouseContext to set active warehouse immediately
    const { setActiveWarehouse } = useWarehouse();

    // Detect small screens so we can make the dialog compact on mobile
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isDarkMode = theme.palette.mode === 'dark';

    useEffect(() => {
        if (open) {
            loadWarehouses();
            checkPrintAgent();
        }
    }, [open]);

    const loadWarehouses = async () => {
        try {
            setLoading(true);

            // First check if user has restricted warehouse access
            const storedWarehouses = localStorage.getItem('warehouses');
            let userWarehouses = storedWarehouses ? JSON.parse(storedWarehouses) : null;

            if (userWarehouses && userWarehouses.length > 0) {
                // User has restricted access - only show their warehouses
                const formattedWarehouses = userWarehouses.map((w: any) => ({
                    id: w.warehouse_id,
                    name: w.warehouse_name,
                    code: w.warehouse_code,
                    is_default: w.is_default
                }));
                setWarehouses(formattedWarehouses);

                // Auto-select default warehouse or first one
                const defaultWh = formattedWarehouses.find((w: any) => w.is_default);
                if (defaultWh) {
                    setSelectedWarehouse(defaultWh.id);
                    setCanSkip(true);
                } else if (formattedWarehouses.length === 1) {
                    setSelectedWarehouse(formattedWarehouses[0].id);
                    setCanSkip(true);
                }
            } else {
                // No restrictions - fetch all warehouses
                const response = await warehousesAPI.getAll();
                const data = response.data;
                setWarehouses(Array.isArray(data) ? data : []);

                // Auto-select if only one warehouse
                if (data.length === 1) {
                    setSelectedWarehouse(data[0].id);
                    setCanSkip(true);
                }
            }
        } catch (error) {
            console.error('Failed to load warehouses:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkPrintAgent = async () => {
        try {
            const AGENT_URL = process.env.NEXT_PUBLIC_PRINT_AGENT_URL || 'http://127.0.0.1:9100';
            const response = await fetch(`${AGENT_URL}/status`);
            if (response.ok) {
                setPrintAgentConnected(true);
            }
        } catch (error) {
            setPrintAgentConnected(false);
        }
    };

    const handleNext = () => {
        if (activeStep === 0 && selectedWarehouse) {
            // Save warehouse selection in the format WarehouseContext expects
            const warehouse = warehouses.find(w => w.id === selectedWarehouse);
            if (warehouse) {
                // Save for WarehouseContext
                localStorage.setItem('activeWarehouse', JSON.stringify(warehouse));
                // Also update context immediately so parent pages don't flash
                try { setActiveWarehouse(warehouse); } catch (e) { /* ignore if context unavailable */ }
                // Save for backward compatibility
                localStorage.setItem('selectedWarehouse', String(selectedWarehouse));
                localStorage.setItem('warehouseName', warehouse.name);
            }
        }

        if (activeStep === steps.length - 1) {
            handleComplete();
        } else {
            setActiveStep((prevStep) => prevStep + 1);
        }
    };

    const handleBack = () => {
        setActiveStep((prevStep) => prevStep - 1);
    };

    const handleComplete = () => {
        localStorage.setItem('onboarding_completed', 'true');
        onComplete();
        // No full-page reload — context is updated immediately when selection is made
    };

    const handleSkip = () => {
        if (activeStep === 1) {
            // Skip printer setup
            setActiveStep(2);
        }
    };

    const downloadPrintAgent = async () => {
        try {
            // Fetch with auth token to get signed download URL
            const token = localStorage.getItem('token');
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/downloads/print-agent`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Download failed');
            }

            const data = await response.json();
            if (data.downloadUrl) {
                // Open signed Supabase URL directly - browser handles download
                window.open(data.downloadUrl, '_blank');
                alert('📥 Download started!\n\nFile: WMS Print Agent Setup 1.0.0\nDownloading from secure cloud storage...');
            } else {
                throw new Error('No download URL received');
            }
        } catch (error) {
            alert('Download failed. Please try again or contact IT support.');
        }
    };



    const renderStepContent = (step: number) => {
        switch (step) {
            case 0:
                // Step 1: Select Warehouse
                return (
                    <Box sx={{ textAlign: 'center', py: { xs: 1, md: 2 }, px: { xs: 1, md: 0 } }}>
                        <WarehouseIcon sx={{ fontSize: { xs: 32, md: 48 }, color: 'primary.main', mb: 0.5, mx: 'auto' }} />
                        <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.1rem', md: '1.4rem' }, mb: 0.5 }}>
                            Welcome to Divine WMS! 🎉
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: { xs: 1, md: 2 }, fontSize: { xs: '0.75rem', md: '0.85rem' } }}>
                            Let's get you set up in just a few steps
                        </Typography>

                        {loading ? (
                            <CircularProgress />
                        ) : warehouses.length === 0 ? (
                            <Alert severity="warning" sx={{ mt: 3 }}>
                                No warehouses found. Please contact your administrator to set up a warehouse first.
                            </Alert>
                        ) : (
                            <FormControl fullWidth sx={{ mt: 4, maxWidth: 400, mx: 'auto' }}>
                                <InputLabel>Select Your Warehouse</InputLabel>
                                <Select
                                    value={selectedWarehouse}
                                    label="Select Your Warehouse"
                                    onChange={(e) => setSelectedWarehouse(e.target.value as number)}
                                >
                                    {warehouses.map((warehouse) => (
                                        <MenuItem key={warehouse.id} value={warehouse.id}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <WarehouseIcon fontSize="small" />
                                                {warehouse.name}
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    </Box>
                );

            case 1:
                // Step 2: Configure Printer
                return (
                    <Box sx={{ textAlign: 'center', py: { xs: 0.5, md: 1.5 }, px: { xs: 1, md: 0 }, pb: { xs: 1, md: 0 } }}>
                        <PrintIcon sx={{ fontSize: { xs: 24, md: 44 }, color: 'primary.main', mb: { xs: 0.25, md: 0.5 }, mx: 'auto' }} />
                        <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '0.95rem', md: '1.3rem' }, mb: { xs: 0.25, md: 0.5 } }}>
                            Set Up Print Agent
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: { xs: 1, md: 2 }, fontSize: { xs: '0.7rem', md: '0.85rem' } }}>
                            Print Agent enables automatic label printing for your warehouse operations
                        </Typography>

                        <Card sx={{ maxWidth: { xs: '100%', md: 500 }, mx: 'auto', mb: { xs: 1, md: 3 } }}>
                            <CardContent sx={{ py: { xs: 1.5, md: 2 }, px: { xs: 1.5, md: 2 } }}>
                                <Stack spacing={{ xs: 1.5, md: 2 }}>                                    {printAgentConnected ? (
                                    <>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                                            <CheckCircleIcon color="success" />
                                            <Typography variant="h6" color="success.main">
                                                Print Agent Connected!
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary">
                                            Your printer is ready to use. You can proceed to the next step.
                                        </Typography>
                                    </>
                                ) : (
                                    <>
                                        <Alert severity="info">
                                            Print Agent is not installed or not running
                                        </Alert>

                                        <Typography variant="subtitle2" align="left" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                                            Quick Setup:
                                        </Typography>

                                        <Box sx={{ textAlign: 'left', pl: { xs: 1.5, md: 2 } }}>
                                            <Typography variant="body2" component="div" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, lineHeight: { xs: 1.4, md: 1.5 } }}>
                                                1. Download the Print Agent installer
                                                <br />
                                                2. Run the downloaded file
                                                <br />
                                                3. Connect your thermal printer via USB
                                                <br />
                                                4. The agent will start automatically
                                            </Typography>
                                        </Box>

                                        <Button
                                            variant="contained"
                                            startIcon={<DownloadIcon />}
                                            onClick={downloadPrintAgent}
                                            fullWidth
                                            size="small"
                                            sx={{ mt: { xs: 1, md: 2 }, height: { xs: 34, md: 42 } }}
                                        >
                                            Download Print Agent
                                        </Button>

                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', md: '0.75rem' } }}>
                                            Optional: You can set this up later from Settings → Printers
                                        </Typography>
                                    </>
                                )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Box>
                );

            case 2:
                // Step 3: Ready to Start
                return (
                    <Box sx={{ textAlign: 'center', py: { xs: 0.5, md: 1.5 }, px: { xs: 1, md: 0 }, pb: { xs: 1, md: 0 } }}>
                        <RocketLaunchIcon sx={{ fontSize: { xs: 24, md: 44 }, color: 'primary.main', mb: { xs: 0.25, md: 0.5 }, mx: 'auto' }} />
                        <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '0.95rem', md: '1.3rem' }, mb: { xs: 0.25, md: 0.5 } }}>
                            You're All Set! 🚀
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: { xs: 1, md: 2 }, fontSize: { xs: '0.7rem', md: '0.85rem' } }}>
                            Your workspace is configured and ready to use
                        </Typography>

                        <Card sx={{ width: '100%', maxWidth: { xs: '100%', md: 600 }, mx: 'auto', mb: { xs: 1, md: 2 }, boxSizing: 'border-box', px: { xs: 0.5, md: 0 } }}>
                            <CardContent sx={{ py: { xs: 1, md: 2 }, px: { xs: 1, md: 2 } }}>
                                <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '0.9rem', md: '1.125rem' }, mb: { xs: 1, md: 1.5 } }}>
                                    Quick Guide:
                                </Typography>
                                <Stack spacing={{ xs: 1.2, md: 2 }} sx={{ textAlign: 'left', mt: { xs: 0.5, md: 2 } }}>
                                    <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 2 }, alignItems: 'flex-start' }}>
                                        <Chip label="1" color="primary" size="small" sx={{ minWidth: { xs: 22, md: 28 } }} />
                                        <Typography variant="body2" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, lineHeight: 1.4 }}>
                                            <strong>Inbound:</strong> Receive and process incoming inventory with WSN tracking
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 2 }, alignItems: 'flex-start' }}>
                                        <Chip label="2" color="primary" size="small" sx={{ minWidth: { xs: 22, md: 28 } }} />
                                        <Typography variant="body2" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, lineHeight: 1.4 }}>
                                            <strong>Processing:</strong> Organize items, assign racks, and perform quality checks
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 2 }, alignItems: 'flex-start' }}>
                                        <Chip label="3" color="primary" size="small" sx={{ minWidth: { xs: 22, md: 28 } }} />
                                        <Typography variant="body2" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, lineHeight: 1.4 }}>
                                            <strong>Picking:</strong> Create pick lists and manage order fulfillment
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 2 }, alignItems: 'flex-start' }}>
                                        <Chip label="4" color="primary" size="small" sx={{ minWidth: { xs: 22, md: 28 } }} />
                                        <Typography variant="body2" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, lineHeight: 1.4 }}>
                                            <strong>Outbound:</strong> Prepare and ship orders to customers
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 2 }, alignItems: 'flex-start' }}>
                                        <Chip label="5" color="primary" size="small" sx={{ minWidth: { xs: 22, md: 28 } }} />
                                        <Typography variant="body2" sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, lineHeight: 1.4 }}>
                                            <strong>Dashboard:</strong> Monitor real-time metrics and warehouse performance
                                        </Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>

                        <Alert severity="success" sx={{ maxWidth: { xs: '100%', md: 600 }, mx: 'auto', mt: { xs: 1, md: 3 }, py: { xs: 0.5, md: 1 } }}>
                            <Typography sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' } }}>
                                💡 <strong>Tip:</strong> Visit Settings → Master Data to configure brands, categories, and customer information
                            </Typography>
                        </Alert>
                    </Box>
                );

            default:
                return null;
        }
    };

    return (
        <Dialog
            open={open}
            maxWidth="md"
            fullWidth
            fullScreen={isMobile}
            disableEscapeKeyDown
            scroll="paper"
            PaperProps={{
                elevation: 24,
                sx: {
                    borderRadius: isMobile ? 0 : 4,
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                    p: isMobile ? 0.25 : 0.5,
                    maxHeight: isMobile ? '100vh' : '90vh',
                    m: isMobile ? 0 : 2,
                },
            }}
        >
            <Box sx={{
                background: 'white',
                borderRadius: isMobile ? 0 : 3.5,
                display: 'flex',
                flexDirection: 'column',
                height: isMobile ? '100%' : 'auto',
                maxHeight: isMobile ? '100vh' : 'calc(90vh - 4px)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <Box sx={{
                    background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                    px: { xs: 1.5, md: 2 },
                    py: { xs: 1, md: 1.25 },
                    color: 'white',
                    flexShrink: 0
                }}>
                    <Typography variant="h4" sx={{
                        fontWeight: 800,
                        fontSize: { xs: '1rem', md: '1.2rem' },
                        textAlign: 'center',
                        textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                        Welcome to Divine WMS
                    </Typography>
                    <Typography sx={{
                        textAlign: 'center',
                        fontSize: { xs: '0.75rem', md: '0.875rem' },
                        mt: 0.5,
                        opacity: 0.95
                    }}>
                        Let's set up your warehouse in 3 simple steps
                    </Typography>
                </Box>

                <DialogContent sx={{
                    px: { xs: 1, md: 2 },
                    py: { xs: 1, md: 1.5 },
                    pb: { xs: 0, md: 1.5 },
                    overflow: 'auto',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    '&::-webkit-scrollbar': {
                        width: '6px',
                    },
                    '&::-webkit-scrollbar-track': {
                        background: '#f1f1f1',
                        borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        background: '#888',
                        borderRadius: '4px',
                        '&:hover': {
                            background: '#555',
                        },
                    },
                }}>
                    {/* Stepper */}
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        mb: { xs: 1, md: 1.5 }
                    }}>
                        <Stepper
                            activeStep={activeStep}
                            alternativeLabel
                            sx={{
                                width: '100%',
                                maxWidth: 500,
                                '& .MuiStepLabel-label': {
                                    fontSize: { xs: '0.6rem', md: '0.7rem' },
                                    fontWeight: 600,
                                    mt: 0.25
                                },
                                '& .MuiStepIcon-root': {
                                    fontSize: { xs: '1rem', md: '1.25rem' },
                                    '&.Mui-active': {
                                        color: '#1e40af',
                                    },
                                    '&.Mui-completed': {
                                        color: '#10b981',
                                    }
                                }
                            }}
                        >
                            {steps.map((label) => (
                                <Step key={label}>
                                    <StepLabel>{label}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                    </Box>

                    {/* Content Area */}
                    <Box>
                        {renderStepContent(activeStep)}
                    </Box>

                    {/* Navigation Buttons */}
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: { xs: 1, md: 1 },
                        mt: 'auto',
                        pt: { xs: 1.5, md: 1.5 },
                        pb: { xs: 2, md: 0 },
                        px: { xs: 1, md: 0 },
                        borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                        flexWrap: 'nowrap',
                        position: isMobile ? 'sticky' : 'relative',
                        bottom: 0,
                        bgcolor: isDarkMode ? '#1e293b' : 'white',
                        zIndex: 10,
                        boxShadow: isMobile ? (isDarkMode ? '0 -4px 12px rgba(0,0,0,0.3)' : '0 -4px 12px rgba(0,0,0,0.08)') : 'none',
                    }}>
                        <Button
                            disabled={activeStep === 0}
                            onClick={handleBack}
                            startIcon={!isMobile && <ArrowBackIcon />}
                            variant="outlined"
                            size="small"
                            sx={{
                                minWidth: { xs: 70, md: 90 },
                                height: { xs: 34, md: 36 },
                                borderRadius: 2,
                                fontWeight: 600,
                                fontSize: { xs: '0.75rem', md: '0.8rem' },
                                borderWidth: 2,
                                flex: { xs: 1, md: 'none' },
                                '&:hover': {
                                    borderWidth: 2,
                                }
                            }}
                        >
                            Back
                        </Button>

                        {activeStep === 1 && (
                            <Button
                                onClick={handleSkip}
                                variant="outlined"
                                size="small"
                                sx={{
                                    minWidth: { xs: 60, md: 80 },
                                    height: { xs: 34, md: 36 },
                                    borderRadius: 2,
                                    fontWeight: 600,
                                    fontSize: { xs: '0.75rem', md: '0.8rem' },
                                    borderWidth: 2,
                                    color: '#6b7280',
                                    borderColor: '#e5e7eb',
                                    flex: { xs: 0.8, md: 'none' },
                                    '&:hover': {
                                        borderWidth: 2,
                                        borderColor: '#9ca3af',
                                        bgcolor: '#f9fafb'
                                    }
                                }}
                            >
                                Skip
                            </Button>
                        )}

                        <Button
                            variant="contained"
                            onClick={handleNext}
                            endIcon={activeStep === steps.length - 1 ? <CheckCircleIcon /> : (!isMobile && <ArrowForwardIcon />)}
                            disabled={activeStep === 0 && !selectedWarehouse}
                            size="small"
                            sx={{
                                minWidth: { xs: 85, md: 100 },
                                height: { xs: 34, md: 36 },
                                borderRadius: 2,
                                fontWeight: 700,
                                fontSize: { xs: '0.75rem', md: '0.8rem' },
                                background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                                boxShadow: '0 4px 14px rgba(30, 64, 175, 0.4)',
                                flex: { xs: 1.2, md: 'none' },
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #5568d3 0%, #63408b 100%)',
                                    boxShadow: '0 6px 20px rgba(30, 64, 175, 0.5)',
                                    transform: 'translateY(-1px)'
                                },
                                '&:disabled': {
                                    background: '#e5e7eb',
                                    color: '#9ca3af'
                                },
                                '&:active': {
                                    transform: 'scale(0.98)',
                                },
                                transition: 'all 0.2s ease-in-out'
                            }}
                        >
                            {activeStep === steps.length - 1 ? 'Get Started' : 'Next'}
                        </Button>
                    </Box>
                </DialogContent>
            </Box>
        </Dialog>
    );
}
