// File Path = warehouse-frontend/lib/logger.ts
// Production-ready frontend logger utility

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const logger = {
    debug: (...args: unknown[]) => {
        if (isDevelopment) {
            console.log('[DEBUG]', ...args);
        }
    },

    info: (...args: unknown[]) => {
        if (isDevelopment) {
            console.info('[INFO]', ...args);
        }
    },

    warn: (...args: unknown[]) => {
        // Warnings are shown in all environments
        console.warn('[WARN]', ...args);
    },

    error: (...args: unknown[]) => {
        // Errors are always shown
        console.error('[ERROR]', ...args);
    },

    // For tracking user actions (can be extended to analytics)
    track: (event: string, data?: object) => {
        if (isDevelopment) {
            console.log('[TRACK]', event, data);
        }
        // In production, you could send to analytics service
    },
};

export default logger;
