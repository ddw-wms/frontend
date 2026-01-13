'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { inboundAPI, qcAPI, outboundAPI } from '@/lib/api';

// Upload types for different modules
export type UploadModule = 'inbound' | 'qc' | 'outbound';

// Status of an upload job
export type UploadStatus = 'idle' | 'validating' | 'uploading' | 'processing' | 'completed' | 'error';

// Individual upload job
export interface UploadJob {
    id: string;
    module: UploadModule;
    fileName: string;
    fileSize: number;
    status: UploadStatus;
    progress: number; // 0-100
    totalRows: number;
    processedRows: number;
    successCount: number;
    errorCount: number;
    errors: Array<{ row?: number; wsn?: string; message: string }>;
    batchId: string;
    startTime: number;
    endTime?: number;
    warehouseId: number;
}

// Valid Excel file signatures (magic bytes)
const EXCEL_SIGNATURES = {
    xlsx: [0x50, 0x4B, 0x03, 0x04], // PK.. (ZIP-based)
    xls: [0xD0, 0xCF, 0x11, 0xE0],  // Old Excel format
};

// Required columns for each module (ALL must be present in header)
const REQUIRED_COLUMNS: Record<UploadModule, string[]> = {
    inbound: ['WSN', 'INBOUND_DATE', 'VEHICLE_NO', 'PRODUCT_SERIAL_NUMBER', 'RACK_NO', 'UNLOAD_REMARKS'],
    qc: ['WSN', 'QCBYNAME', 'QCDATE', 'GRADE', 'QCREMARKS', 'OTHERREMARKS', 'PRODUCTSERIALNUMBER', 'RACKNO'],
    outbound: ['WSN', 'DISPATCHDATE', 'CUSTOMERNAME', 'VEHICLENO', 'DISPATCHREMARKS', 'OTHERREMARKS'],
};

// Minimum required columns (at least these must be present)
const MINIMUM_REQUIRED_COLUMNS: Record<UploadModule, string[]> = {
    inbound: ['WSN'],
    qc: ['WSN', 'GRADE'],
    outbound: ['WSN'],
};

interface BulkUploadContextType {
    // Current upload jobs
    jobs: Record<string, UploadJob>;

    // Active upload per module (to show in UI)
    activeJobs: Record<UploadModule, UploadJob | null>;

    // Start a new upload
    startUpload: (
        module: UploadModule,
        file: File,
        warehouseId: number,
        userId?: number
    ) => Promise<{ success: boolean; jobId?: string; error?: string }>;

    // Validate file before upload
    validateFile: (
        file: File,
        module: UploadModule
    ) => Promise<{ valid: boolean; error?: string; rowCount?: number; columns?: string[]; missingOptional?: string[] }>;

    // Cancel an upload
    cancelUpload: (jobId: string) => void;

    // Clear completed job
    clearJob: (jobId: string) => void;

    // Get job by module
    getActiveJob: (module: UploadModule) => UploadJob | null;

    // Check if module has active upload
    hasActiveUpload: (module: UploadModule) => boolean;
}

const BulkUploadContext = createContext<BulkUploadContextType | null>(null);

export function BulkUploadProvider({ children }: { children: React.ReactNode }) {
    const [jobs, setJobs] = useState<Record<string, UploadJob>>({});
    const [activeJobs, setActiveJobs] = useState<Record<UploadModule, UploadJob | null>>({
        inbound: null,
        qc: null,
        outbound: null,
    });

    // Polling intervals for active jobs
    const pollingIntervals = useRef<Record<string, NodeJS.Timeout>>({});

    // Load persisted jobs from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedJobs = localStorage.getItem('bulkUploadJobs');
            if (savedJobs) {
                try {
                    const parsed = JSON.parse(savedJobs);
                    // Only restore jobs that are still in progress
                    const activeJobsToRestore: Record<string, UploadJob> = {};
                    Object.entries(parsed).forEach(([id, job]: [string, any]) => {
                        if (job.status === 'processing' || job.status === 'uploading') {
                            activeJobsToRestore[id] = job;
                        }
                    });

                    if (Object.keys(activeJobsToRestore).length > 0) {
                        setJobs(activeJobsToRestore);

                        // Update active jobs per module
                        const newActiveJobs: Record<UploadModule, UploadJob | null> = {
                            inbound: null,
                            qc: null,
                            outbound: null,
                        };

                        Object.values(activeJobsToRestore).forEach((job: UploadJob) => {
                            newActiveJobs[job.module] = job;
                        });

                        setActiveJobs(newActiveJobs);
                    }
                } catch (e) {
                    console.error('Failed to restore bulk upload jobs:', e);
                }
            }
        }
    }, []);

    // Persist jobs to localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('bulkUploadJobs', JSON.stringify(jobs));
        }
    }, [jobs]);

    // Update active jobs when jobs change
    useEffect(() => {
        const newActiveJobs: Record<UploadModule, UploadJob | null> = {
            inbound: null,
            qc: null,
            outbound: null,
        };

        Object.values(jobs).forEach((job) => {
            if (job.status === 'uploading' || job.status === 'processing' || job.status === 'validating') {
                newActiveJobs[job.module] = job;
            } else if (!newActiveJobs[job.module] && (job.status === 'completed' || job.status === 'error')) {
                // Show most recent completed/error job if no active job
                const existing = newActiveJobs[job.module];
                if (!existing || job.startTime > existing.startTime) {
                    newActiveJobs[job.module] = job;
                }
            }
        });

        setActiveJobs(newActiveJobs);
    }, [jobs]);

    // Validate file format and structure
    const validateFile = useCallback(async (
        file: File,
        module: UploadModule
    ): Promise<{ valid: boolean; error?: string; rowCount?: number; columns?: string[]; missingOptional?: string[] }> => {
        // Check file extension
        const ext = file.name.toLowerCase().split('.').pop();
        if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
            return {
                valid: false,
                error: 'Invalid file type. Only .xlsx, .xls, or .csv files are allowed.'
            };
        }

        // Check file size (max 50MB)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            return {
                valid: false,
                error: 'File too large. Maximum size is 50MB.'
            };
        }

        // Check file signature (magic bytes)
        try {
            const buffer = await file.slice(0, 8).arrayBuffer();
            const bytes = new Uint8Array(buffer);

            let isValidSignature = false;

            // Check for XLSX (ZIP-based)
            if (ext === 'xlsx' || ext === 'csv') {
                const xlsxSig = EXCEL_SIGNATURES.xlsx;
                isValidSignature = xlsxSig.every((byte, i) => bytes[i] === byte);

                // CSV doesn't have a specific signature, allow if extension is csv
                if (ext === 'csv') {
                    isValidSignature = true;
                }
            }

            // Check for XLS (older format)
            if (ext === 'xls') {
                const xlsSig = EXCEL_SIGNATURES.xls;
                isValidSignature = xlsSig.every((byte, i) => bytes[i] === byte);
            }

            // For XLSX, also allow if it starts with PK (even if slight variation)
            if (!isValidSignature && (ext === 'xlsx')) {
                isValidSignature = bytes[0] === 0x50 && bytes[1] === 0x4B;
            }

            if (!isValidSignature && ext !== 'csv') {
                return {
                    valid: false,
                    error: 'Invalid file format. The file does not appear to be a valid Excel file.'
                };
            }
        } catch (e) {
            console.warn('Could not verify file signature:', e);
        }

        // Parse file to check columns using XLSX library
        try {
            const XLSX = await import('xlsx');
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array', sheetRows: 5 }); // Only read first 5 rows for validation

            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            if (!firstSheet) {
                return { valid: false, error: 'Empty file or no worksheets found.' };
            }

            const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

            if (data.length < 2) {
                return { valid: false, error: 'File must have at least a header row and one data row.' };
            }

            // Normalize headers - remove spaces, convert to uppercase
            const headers = (data[0] || [])
                .map((h: any) => String(h || '').toUpperCase().trim().replace(/[\s_-]+/g, ''))
                .filter((h: string) => h.length > 0);

            if (headers.length === 0) {
                return { valid: false, error: 'No valid column headers found in the file.' };
            }

            // Get the required columns for this module
            const allRequiredCols = REQUIRED_COLUMNS[module];
            const minRequiredCols = MINIMUM_REQUIRED_COLUMNS[module];

            // Normalize required columns for comparison
            const normalizeCol = (col: string) => col.toUpperCase().trim().replace(/[\s_-]+/g, '');
            const normalizedHeaders = headers.map(normalizeCol);
            const normalizedRequired = allRequiredCols.map(normalizeCol);
            const normalizedMinRequired = minRequiredCols.map(normalizeCol);

            // Check minimum required columns first
            const missingMinCols = minRequiredCols.filter(col =>
                !normalizedHeaders.includes(normalizeCol(col))
            );

            if (missingMinCols.length > 0) {
                return {
                    valid: false,
                    error: `Missing mandatory column(s): ${missingMinCols.join(', ')}`
                };
            }

            // Check if file has at least some of the expected columns
            const matchingCols = allRequiredCols.filter(col =>
                normalizedHeaders.includes(normalizeCol(col))
            );

            // If less than 50% of expected columns match, likely wrong template
            if (matchingCols.length < Math.ceil(allRequiredCols.length * 0.5)) {
                const missingCols = allRequiredCols.filter(col =>
                    !normalizedHeaders.includes(normalizeCol(col))
                );
                return {
                    valid: false,
                    error: `Invalid file format. Missing columns: ${missingCols.join(', ')}. Please use the correct template.`
                };
            }

            // Check for completely unrecognized columns (might be wrong file)
            const recognizedCols = normalizedHeaders.filter(h =>
                normalizedRequired.includes(h) ||
                h === 'SNO' || h === 'S.NO' || h === 'SERIALNO' || h === 'SN' // Allow serial number column
            );

            // If most columns are unrecognized, it's likely a wrong file
            if (recognizedCols.length < headers.length * 0.3 && headers.length > 3) {
                return {
                    valid: false,
                    error: `File appears to be in wrong format. Expected columns: ${allRequiredCols.join(', ')}`
                };
            }

            // Get full row count (re-read without row limit)
            const fullWorkbook = XLSX.read(buffer, { type: 'array' });
            const fullSheet = fullWorkbook.Sheets[fullWorkbook.SheetNames[0]];
            const fullData = XLSX.utils.sheet_to_json(fullSheet) as any[];

            // Build warning for missing optional columns
            const missingOptionalCols = allRequiredCols.filter(col =>
                !normalizedHeaders.includes(normalizeCol(col)) &&
                !minRequiredCols.includes(col)
            );

            return {
                valid: true,
                rowCount: fullData.length,
                columns: headers,
                missingOptional: missingOptionalCols.length > 0 ? missingOptionalCols : undefined
            };
        } catch (e: any) {
            return {
                valid: false,
                error: `Failed to parse file: ${e.message || 'Unknown error'}`
            };
        }
    }, []);

    // Start upload process
    const startUpload = useCallback(async (
        module: UploadModule,
        file: File,
        warehouseId: number,
        userId?: number
    ): Promise<{ success: boolean; jobId?: string; error?: string }> => {
        // Generate job ID
        const jobId = `${module}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create initial job
        const job: UploadJob = {
            id: jobId,
            module,
            fileName: file.name,
            fileSize: file.size,
            status: 'validating',
            progress: 0,
            totalRows: 0,
            processedRows: 0,
            successCount: 0,
            errorCount: 0,
            errors: [],
            batchId: '',
            startTime: Date.now(),
            warehouseId,
        };

        setJobs(prev => ({ ...prev, [jobId]: job }));

        // Validate file first
        const validation = await validateFile(file, module);
        if (!validation.valid) {
            setJobs(prev => ({
                ...prev,
                [jobId]: {
                    ...prev[jobId],
                    status: 'error',
                    errors: [{ message: validation.error || 'Validation failed' }],
                    endTime: Date.now(),
                },
            }));
            return { success: false, error: validation.error };
        }

        // Update job with row count
        setJobs(prev => ({
            ...prev,
            [jobId]: {
                ...prev[jobId],
                status: 'uploading',
                progress: 10,
                totalRows: validation.rowCount || 0,
            },
        }));

        try {
            // Prepare form data
            const formData = new FormData();
            formData.append('file', file);
            formData.append('warehouse_id', warehouseId.toString());
            if (userId) {
                formData.append('created_by', userId.toString());
            }

            // Call appropriate API based on module
            let response: any;

            switch (module) {
                case 'inbound':
                    response = await inboundAPI.bulkUpload(formData);
                    break;
                case 'qc':
                    response = await qcAPI.bulkUpload(file, warehouseId);
                    break;
                case 'outbound':
                    response = await outboundAPI.bulkUpload(formData);
                    break;
            }

            const data = response.data;

            // Update job with response
            setJobs(prev => ({
                ...prev,
                [jobId]: {
                    ...prev[jobId],
                    status: data.successCount !== undefined ? 'completed' : 'processing',
                    progress: data.successCount !== undefined ? 100 : 50,
                    batchId: data.batchId || '',
                    totalRows: data.totalRows || prev[jobId].totalRows,
                    processedRows: data.successCount !== undefined ? data.totalRows : 0,
                    successCount: data.successCount || 0,
                    errorCount: data.errorCount || 0,
                    errors: (data.errors || []).map((e: any) => ({
                        row: e.row,
                        wsn: e.wsn,
                        message: e.error || e.message || 'Unknown error',
                    })),
                    endTime: data.successCount !== undefined ? Date.now() : undefined,
                },
            }));

            // If processing is async, start polling for progress
            if (data.successCount === undefined && data.batchId) {
                startProgressPolling(jobId, module, data.batchId);
            }

            return { success: true, jobId };
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || error.message || 'Upload failed';
            const errors = error.response?.data?.errors || [];

            setJobs(prev => ({
                ...prev,
                [jobId]: {
                    ...prev[jobId],
                    status: 'error',
                    errors: errors.length > 0
                        ? errors.map((e: any) => ({ row: e.row, message: e.error || e.message }))
                        : [{ message: errorMsg }],
                    endTime: Date.now(),
                },
            }));

            return { success: false, error: errorMsg };
        }
    }, [validateFile]);

    // Poll for progress updates (for async processing)
    const startProgressPolling = useCallback((jobId: string, module: UploadModule, batchId: string) => {
        // Clear any existing polling for this job
        if (pollingIntervals.current[jobId]) {
            clearInterval(pollingIntervals.current[jobId]);
        }

        const pollInterval = setInterval(async () => {
            try {
                // For now, we'll simulate progress completion after a delay
                // In a real implementation, you'd call a progress API endpoint
                setJobs(prev => {
                    const job = prev[jobId];
                    if (!job) return prev;

                    const newProgress = Math.min(job.progress + 10, 100);
                    const isComplete = newProgress >= 100;

                    if (isComplete) {
                        clearInterval(pollingIntervals.current[jobId]);
                        delete pollingIntervals.current[jobId];
                    }

                    return {
                        ...prev,
                        [jobId]: {
                            ...job,
                            status: isComplete ? 'completed' : 'processing',
                            progress: newProgress,
                            processedRows: isComplete ? job.totalRows : Math.floor(job.totalRows * newProgress / 100),
                            successCount: isComplete ? job.totalRows : job.successCount,
                            endTime: isComplete ? Date.now() : undefined,
                        },
                    };
                });
            } catch (e) {
                console.error('Polling error:', e);
            }
        }, 1000);

        pollingIntervals.current[jobId] = pollInterval;

        // Auto-stop after 2 minutes
        setTimeout(() => {
            if (pollingIntervals.current[jobId]) {
                clearInterval(pollingIntervals.current[jobId]);
                delete pollingIntervals.current[jobId];

                setJobs(prev => {
                    const job = prev[jobId];
                    if (!job || job.status === 'completed') return prev;

                    return {
                        ...prev,
                        [jobId]: {
                            ...job,
                            status: 'completed',
                            progress: 100,
                            endTime: Date.now(),
                        },
                    };
                });
            }
        }, 120000);
    }, []);

    // Cancel upload
    const cancelUpload = useCallback((jobId: string) => {
        // Clear polling if any
        if (pollingIntervals.current[jobId]) {
            clearInterval(pollingIntervals.current[jobId]);
            delete pollingIntervals.current[jobId];
        }

        setJobs(prev => {
            const job = prev[jobId];
            if (!job) return prev;

            return {
                ...prev,
                [jobId]: {
                    ...job,
                    status: 'error',
                    errors: [{ message: 'Upload cancelled by user' }],
                    endTime: Date.now(),
                },
            };
        });
    }, []);

    // Clear completed/error job
    const clearJob = useCallback((jobId: string) => {
        setJobs(prev => {
            const newJobs = { ...prev };
            delete newJobs[jobId];
            return newJobs;
        });
    }, []);

    // Get active job for module
    const getActiveJob = useCallback((module: UploadModule): UploadJob | null => {
        return activeJobs[module];
    }, [activeJobs]);

    // Check if module has active upload
    const hasActiveUpload = useCallback((module: UploadModule): boolean => {
        const job = activeJobs[module];
        return job !== null && (job.status === 'validating' || job.status === 'uploading' || job.status === 'processing');
    }, [activeJobs]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            Object.values(pollingIntervals.current).forEach(clearInterval);
        };
    }, []);

    return (
        <BulkUploadContext.Provider
            value={{
                jobs,
                activeJobs,
                startUpload,
                validateFile,
                cancelUpload,
                clearJob,
                getActiveJob,
                hasActiveUpload,
            }}
        >
            {children}
        </BulkUploadContext.Provider>
    );
}

export function useBulkUpload() {
    const context = useContext(BulkUploadContext);
    if (!context) {
        throw new Error('useBulkUpload must be used within BulkUploadProvider');
    }
    return context;
}
