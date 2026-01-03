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

    useEffect(() => {
        if (open) {
            loadWarehouses();
            checkPrintAgent();
        }
    }, [open]);

    const loadWarehouses = async () => {
        try {
            setLoading(true);
            const response = await warehousesAPI.getAll();
            const data = response.data;
            setWarehouses(Array.isArray(data) ? data : []);

            // Auto-select if only one warehouse
            if (data.length === 1) {
                setSelectedWarehouse(data[0].id);
                setCanSkip(true);
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

    // const downloadPrintAgent = () => {
    //     const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
    //     window.open(`${API_BASE}/downloads/print-agent`, '_blank');
    // };


    const downloadPrintAgent = () => {
        const link = document.createElement("a");
        link.href = "https://drive.google.com/file/d/1pcVAo0mA-zvw31W_0_h5ysM4KPSa0BUs/view?usp=sharing";
        link.target = "_blank"; // new tab / window
        link.rel = "noopener noreferrer"; // security best practice
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };



    const renderStepContent = (step: number) => {
        switch (step) {
            case 0:
                // Step 1: Select Warehouse
                return (
                    <Box sx={{ textAlign: 'center', py: { xs: 1.5, md: 4 }, px: { xs: 1, md: 0 } }}>
                        <WarehouseIcon sx={{ fontSize: { xs: 36, md: 80 }, color: 'primary.main', mb: 1, mx: 'auto' }} />
                        <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.4rem', md: '2rem' }, mb: 0.75 }}>
                            Welcome to Divine WMS! 🎉
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: { xs: 1.5, md: 4 }, fontSize: { xs: '0.85rem', md: '1rem' } }}>
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
                    <Box sx={{ textAlign: 'center', py: { xs: 1.5, md: 4 }, px: { xs: 1, md: 0 } }}>
                        <PrintIcon sx={{ fontSize: { xs: 36, md: 80 }, color: 'primary.main', mb: 1, mx: 'auto' }} />
                        <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.25rem', md: '2rem' }, mb: 1 }}>
                            Set Up Print Agent
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: { xs: 2, md: 4 }, fontSize: { xs: '0.9rem', md: '1rem' } }}>
                            Print Agent enables automatic label printing for your warehouse operations
                        </Typography>

                        <Card sx={{ maxWidth: { xs: '100%', md: 500 }, mx: 'auto', mb: 3 }}>
                            <CardContent>
                                <Stack spacing={2}>                                    {printAgentConnected ? (
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

                                        <Typography variant="subtitle2" align="left">
                                            Quick Setup:
                                        </Typography>

                                        <Box sx={{ textAlign: 'left', pl: 2 }}>
                                            <Typography variant="body2" component="div">
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
                                            sx={{ mt: 2 }}
                                        >
                                            Download Print Agent
                                        </Button>

                                        <Typography variant="caption" color="text.secondary">
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
                    <Box sx={{ textAlign: 'center', py: { xs: 1.5, md: 4 }, px: { xs: 1, md: 0 } }}>
                        <RocketLaunchIcon sx={{ fontSize: { xs: 36, md: 80 }, color: 'primary.main', mb: 1, mx: 'auto' }} />
                        <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.25rem', md: '2rem' }, mb: 1 }}>
                            You're All Set! 🚀
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: { xs: 2, md: 4 }, fontSize: { xs: '0.9rem', md: '1rem' } }}>
                            Your workspace is configured and ready to use
                        </Typography>

                        <Card sx={{ width: '100%', maxWidth: { xs: '100%', md: 600 }, mx: 'auto', mb: 2, boxSizing: 'border-box', px: { xs: 0.5, md: 0 } }}>
                            <CardContent sx={{ py: { xs: 1, md: 2 }, px: { xs: 1, md: 2 } }}>
                                <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', md: '1.125rem' } }}>
                                    Quick Guide:
                                </Typography>
                                <Stack spacing={2} sx={{ textAlign: 'left', mt: 2 }}>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Chip label="1" color="primary" size="small" />
                                        <Typography variant="body2">
                                            <strong>Inbound:</strong> Receive and process incoming inventory with WSN tracking
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Chip label="2" color="primary" size="small" />
                                        <Typography variant="body2">
                                            <strong>Processing:</strong> Organize items, assign racks, and perform quality checks
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Chip label="3" color="primary" size="small" />
                                        <Typography variant="body2">
                                            <strong>Picking:</strong> Create pick lists and manage order fulfillment
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Chip label="4" color="primary" size="small" />
                                        <Typography variant="body2">
                                            <strong>Outbound:</strong> Prepare and ship orders to customers
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Chip label="5" color="primary" size="small" />
                                        <Typography variant="body2">
                                            <strong>Dashboard:</strong> Monitor real-time metrics and warehouse performance
                                        </Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>

                        <Alert severity="success" sx={{ maxWidth: { xs: '100%', md: 600 }, mx: 'auto', mt: 3 }}>
                            💡 <strong>Tip:</strong> Visit Settings → Master Data to configure brands, categories, and customer information
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
            disableEscapeKeyDown
            PaperProps={{
                elevation: 24,
                sx: {
                    width: { xs: 320, sm: 520, md: 720 },
                    maxWidth: '100%',
                    maxHeight: { xs: '60vh', md: undefined },
                    p: { xs: 0.5, md: 3 },
                    mx: 'auto',
                    borderRadius: 3,
                    overflowX: 'hidden',
                    overflowY: 'visible',
                    boxSizing: 'border-box',
                },
            }}
        >
            <DialogContent sx={{ px: { xs: 0.5, md: 3 }, py: { xs: 0.5, md: 2 } }}>
                <Box sx={{ width: '100%', py: 0.5, maxHeight: isMobile ? '55vh' : undefined, overflowY: isMobile ? 'auto' : undefined, overflowX: 'hidden', boxSizing: 'border-box' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
                        <Stepper activeStep={activeStep} sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.25, justifyContent: 'center' }}>
                            {steps.map((label) => (
                                <Step key={label} sx={{ '& .MuiStepLabel-label': { fontSize: { xs: '0.65rem', md: '0.9rem' } }, px: 0.25 }}>
                                    <StepLabel>{label}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                    </Box>

                    <Box sx={{ minHeight: { xs: 'auto', md: '400px' } }}>
                        {renderStepContent(activeStep)}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 0.5, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button
                                disabled={activeStep === 0}
                                onClick={handleBack}
                                startIcon={<ArrowBackIcon />}
                                size="small"
                                sx={{ minWidth: 78, mx: 0.25, px: 1 }}
                            >
                                Back
                            </Button>

                            {activeStep === 1 && (
                                <Button onClick={handleSkip} size="small" sx={{ minWidth: 78, mx: 0.25, px: 1 }}>
                                    Skip for Now
                                </Button>
                            )}

                            <Button
                                variant="contained"
                                onClick={handleNext}
                                endIcon={activeStep === steps.length - 1 ? <CheckCircleIcon /> : <ArrowForwardIcon />}
                                disabled={activeStep === 0 && !selectedWarehouse}
                                size="small"
                                sx={{ minWidth: 78, mx: 0.25, px: 1 }}
                            >
                                {activeStep === steps.length - 1 ? 'Get Started' : 'Next'}
                            </Button>
                        </Box>
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
