// useFastSubmit.ts - Hook for optimistic, real-time progress Multi Entry submissions
'use client';

import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

interface SubmitProgress {
    total: number;
    completed: number;
    successCount: number;
    failedCount: number;
    duplicateCount: number;
    currentBatch: number;
    isComplete: boolean;
    errors: Array<{ wsn: string; error: string }>;
}

interface RowData {
    wsn?: string;
    [key: string]: any;
}

interface UseFastSubmitOptions {
    batchSize?: number;
    onBatchComplete?: (batch: any[], results: any[]) => void;
    onComplete?: (stats: SubmitProgress) => void;
    onError?: (error: Error) => void;
}

interface SubmitResult {
    status: 'SUCCESS' | 'DUPLICATE' | 'ERROR';
    wsn: string;
    message?: string;
    data?: any;
}

export function useFastSubmit({
    batchSize = 50,
    onBatchComplete,
    onComplete,
    onError,
}: UseFastSubmitOptions = {}) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [progress, setProgress] = useState<SubmitProgress | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Cancel ongoing submission
    const cancelSubmit = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsSubmitting(false);
            toast('Submission cancelled', { icon: '🛑' });
        }
    }, []);

    // Process submission in batches with progress updates
    const submitInBatches = useCallback(async (
        rows: RowData[],
        submitFn: (batch: RowData[]) => Promise<{ data: { results: SubmitResult[] } }>,
        validateFn?: (rows: RowData[]) => { valid: boolean; message?: string }
    ) => {
        // Filter valid rows
        const validRows = rows.filter(r => r.wsn && r.wsn.trim() !== '');

        if (validRows.length === 0) {
            toast.error('No valid rows to submit');
            return null;
        }

        // Run validation if provided
        if (validateFn) {
            const validation = validateFn(validRows);
            if (!validation.valid) {
                toast.error(validation.message || 'Validation failed');
                return null;
            }
        }

        // Initialize progress
        const initialProgress: SubmitProgress = {
            total: validRows.length,
            completed: 0,
            successCount: 0,
            failedCount: 0,
            duplicateCount: 0,
            currentBatch: 0,
            isComplete: false,
            errors: [],
        };

        setProgress(initialProgress);
        setIsSubmitting(true);

        // Create abort controller
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        // Split into batches
        const batches: RowData[][] = [];
        for (let i = 0; i < validRows.length; i += batchSize) {
            batches.push(validRows.slice(i, i + batchSize));
        }

        // Show initial toast with progress
        const toastId = toast.loading(`Submitting 0/${validRows.length}...`, {
            duration: Infinity,
        });

        let currentProgress = { ...initialProgress };

        try {
            for (let i = 0; i < batches.length; i++) {
                // Check if cancelled
                if (signal.aborted) {
                    throw new Error('Submission cancelled');
                }

                const batch = batches[i];
                currentProgress.currentBatch = i + 1;

                try {
                    const response = await submitFn(batch);
                    const results = response.data?.results || [];

                    // Count results
                    const batchSuccess = results.filter((r: SubmitResult) => r.status === 'SUCCESS').length;
                    const batchDupes = results.filter((r: SubmitResult) => r.status === 'DUPLICATE').length;
                    const batchErrors = results.filter((r: SubmitResult) => r.status === 'ERROR');

                    currentProgress.completed += batch.length;
                    currentProgress.successCount += batchSuccess;
                    currentProgress.duplicateCount += batchDupes;
                    currentProgress.failedCount += batchErrors.length;

                    // Collect error details
                    batchErrors.forEach((r: SubmitResult) => {
                        currentProgress.errors.push({
                            wsn: r.wsn,
                            error: r.message || 'Unknown error',
                        });
                    });

                    // Update progress state and toast
                    setProgress({ ...currentProgress });
                    toast.loading(
                        `Submitting ${currentProgress.completed}/${currentProgress.total}...`,
                        { id: toastId }
                    );

                    // Callback for batch completion
                    if (onBatchComplete) {
                        onBatchComplete(batch, results);
                    }
                } catch (batchError: any) {
                    // Handle batch-level error (but continue with other batches)
                    console.error(`Batch ${i + 1} failed:`, batchError);

                    currentProgress.completed += batch.length;
                    currentProgress.failedCount += batch.length;
                    batch.forEach(row => {
                        currentProgress.errors.push({
                            wsn: row.wsn || 'Unknown',
                            error: batchError.message || 'Batch submission failed',
                        });
                    });

                    setProgress({ ...currentProgress });
                }
            }

            // Mark as complete
            currentProgress.isComplete = true;
            setProgress({ ...currentProgress });

            // Show final toast
            if (currentProgress.successCount === currentProgress.total) {
                toast.success(`✓ Submitted ${currentProgress.successCount} rows`, { id: toastId });
            } else if (currentProgress.successCount > 0) {
                toast.success(
                    `✓ Submitted ${currentProgress.successCount}/${currentProgress.total} ` +
                    `(${currentProgress.duplicateCount} duplicates, ${currentProgress.failedCount} errors)`,
                    { id: toastId }
                );
            } else {
                toast.error(`Failed to submit any rows`, { id: toastId });
            }

            // Callback for completion
            if (onComplete) {
                onComplete(currentProgress);
            }

            return currentProgress;

        } catch (error: any) {
            toast.dismiss(toastId);

            if (error.message === 'Submission cancelled') {
                toast('Submission cancelled', { icon: '🛑' });
            } else {
                toast.error(`Submit failed: ${error.message}`);
                if (onError) {
                    onError(error);
                }
            }
            return null;

        } finally {
            setIsSubmitting(false);
            abortControllerRef.current = null;
        }
    }, [batchSize, onBatchComplete, onComplete, onError]);

    // Reset progress
    const resetProgress = useCallback(() => {
        setProgress(null);
    }, []);

    return {
        isSubmitting,
        progress,
        submitInBatches,
        cancelSubmit,
        resetProgress,
    };
}
