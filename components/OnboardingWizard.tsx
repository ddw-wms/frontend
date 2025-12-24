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
            const response = await fetch('http://localhost:9100/status');
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
        window.location.reload(); // Reload to apply warehouse selection
    };

    const handleSkip = () => {
        if (activeStep === 1) {
            // Skip printer setup
            setActiveStep(2);
        }
    };

    const downloadPrintAgent = () => {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
        window.open(`${API_BASE}/downloads/print-agent`, '_blank');
    };

    const renderStepContent = (step: number) => {
        switch (step) {
            case 0:
                // Step 1: Select Warehouse
                return (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <WarehouseIcon sx={{ fontSize: 80, color: 'primary.main', mb: 3 }} />
                        <Typography variant="h4" gutterBottom>
                            Welcome to Divine WMS! 🎉
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
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
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <PrintIcon sx={{ fontSize: 80, color: 'primary.main', mb: 3 }} />
                        <Typography variant="h4" gutterBottom>
                            Set Up Print Agent
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                            Print Agent enables automatic label printing for your warehouse operations
                        </Typography>

                        <Card sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}>
                            <CardContent>
                                <Stack spacing={2}>
                                    {printAgentConnected ? (
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
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <RocketLaunchIcon sx={{ fontSize: 80, color: 'primary.main', mb: 3 }} />
                        <Typography variant="h4" gutterBottom>
                            You're All Set! 🚀
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                            Your workspace is configured and ready to use
                        </Typography>

                        <Card sx={{ maxWidth: 600, mx: 'auto', mb: 3 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
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

                        <Alert severity="success" sx={{ maxWidth: 600, mx: 'auto', mt: 3 }}>
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
                sx: { minHeight: '600px' }
            }}
        >
            <DialogContent>
                <Box sx={{ width: '100%', py: 3 }}>
                    <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                        {steps.map((label) => (
                            <Step key={label}>
                                <StepLabel>{label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>

                    <Box sx={{ minHeight: '400px' }}>
                        {renderStepContent(activeStep)}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                        <Button
                            disabled={activeStep === 0}
                            onClick={handleBack}
                            startIcon={<ArrowBackIcon />}
                        >
                            Back
                        </Button>

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            {activeStep === 1 && (
                                <Button onClick={handleSkip}>
                                    Skip for Now
                                </Button>
                            )}
                            <Button
                                variant="contained"
                                onClick={handleNext}
                                endIcon={activeStep === steps.length - 1 ? <CheckCircleIcon /> : <ArrowForwardIcon />}
                                disabled={activeStep === 0 && !selectedWarehouse}
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
