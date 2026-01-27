// File Path = warehouse-frontend/components/ui/connection-status.tsx
"use client";

import { useEffect, useState } from 'react';
import { connectionManager, ConnectionStatus as ConnectionStatusType } from '@/lib/api';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import CloseIcon from '@mui/icons-material/Close';

interface ConnectionState {
    status: ConnectionStatusType;
    lastError: string | null;
    retryCount: number;
    lastSuccessTime: Date | null;
}

export function ConnectionStatusBanner() {
    const [state, setState] = useState<ConnectionState>({
        status: 'connected',
        lastError: null,
        retryCount: 0,
        lastSuccessTime: null,
    });
    const [dismissed, setDismissed] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const unsubscribe = connectionManager.subscribe((newState) => {
            setState(newState);
            // Show banner for non-connected states
            if (newState.status !== 'connected') {
                setDismissed(false);
                setVisible(true);
            } else {
                // Hide after 2 seconds when reconnected
                setTimeout(() => setVisible(false), 2000);
            }
        });

        return () => { unsubscribe(); };
    }, []);

    // Don't render if connected and not visible, or if dismissed
    if ((state.status === 'connected' && !visible) || dismissed) {
        return null;
    }

    const getStatusConfig = () => {
        switch (state.status) {
            case 'connected':
                return {
                    bg: 'bg-green-500',
                    icon: <WifiIcon sx={{ fontSize: 18 }} />,
                    text: 'Connection restored!',
                    animate: false,
                };
            case 'connecting':
                return {
                    bg: 'bg-blue-500',
                    icon: <RefreshIcon sx={{ fontSize: 18, animation: 'spin 1s linear infinite' }} />,
                    text: 'Connecting to server...',
                    animate: true,
                };
            case 'reconnecting':
                return {
                    bg: 'bg-yellow-600',
                    icon: <RefreshIcon sx={{ fontSize: 18, animation: 'spin 1s linear infinite' }} />,
                    text: `Reconnecting... (Attempt ${state.retryCount})`,
                    animate: true,
                };
            case 'disconnected':
                return {
                    bg: 'bg-red-500',
                    icon: <WifiOffIcon sx={{ fontSize: 18 }} />,
                    text: state.lastError || 'Connection lost',
                    animate: false,
                };
            default:
                return {
                    bg: 'bg-gray-500',
                    icon: <WarningIcon sx={{ fontSize: 18 }} />,
                    text: 'Unknown status',
                    animate: false,
                };
        }
    };

    const config = getStatusConfig();

    return (
        <>
            <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
            <div
                className={`fixed top-0 left-0 right-0 z-9999 px-4 py-2 text-white text-sm flex items-center justify-center gap-2 transition-all duration-300 ${config.bg}`}
            >
                {config.icon}
                <span>{config.text}</span>

                {state.status === 'disconnected' && (
                    <button
                        onClick={() => window.location.reload()}
                        className="ml-4 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium transition-colors"
                    >
                        Retry Now
                    </button>
                )}

                {state.status !== 'reconnecting' && (
                    <button
                        onClick={() => setDismissed(true)}
                        className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
                        aria-label="Dismiss"
                    >
                        <CloseIcon sx={{ fontSize: 14 }} />
                    </button>
                )}
            </div>
        </>
    );
}

// Compact status indicator for header/navbar
export function ConnectionStatusIndicator() {
    const [status, setStatus] = useState<ConnectionStatusType>('connected');

    useEffect(() => {
        const unsubscribe = connectionManager.subscribe((state) => {
            setStatus(state.status);
        });
        return () => { unsubscribe(); };
    }, []);

    if (status === 'connected') {
        return (
            <div className="flex items-center gap-1 text-green-500" title="Connected">
                <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
            </div>
        );
    }

    if (status === 'reconnecting' || status === 'connecting') {
        return (
            <div className="flex items-center gap-1 text-yellow-500" title="Reconnecting...">
                <RefreshIcon sx={{ fontSize: 14, animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1 text-red-500" title="Disconnected">
            <WifiOffIcon sx={{ fontSize: 14 }} />
        </div>
    );
}

export default ConnectionStatusBanner;
