interface PrintPayload {
    wsn: string;
    product_title?: string;
    brand?: string;
    mrp?: string;
    fsp?: string;
    fsn?: string;
    wid?: string;
    product_serial_number?: string;
    copies?: number;
}

const _DEFAULT_AGENT_URL = process.env.NEXT_PUBLIC_PRINT_AGENT_URL || 'http://127.0.0.1:9100';
const TIMEOUT_MS = 65000; // 65 seconds - allows backend 60s + buffer

/**
 * Get the effective Print Agent URL.
 * On mobile devices, users can configure a custom LAN IP (e.g. http://192.168.1.5:9100)
 * stored in localStorage under 'mobileScan_printAgentUrl'.
 * Falls back to the default (127.0.0.1:9100) for desktop usage.
 */
function getAgentUrl(): string {
    if (typeof window !== 'undefined') {
        const custom = localStorage.getItem('mobileScan_printAgentUrl');
        if (custom && custom.trim()) return custom.trim();
    }
    return _DEFAULT_AGENT_URL;
}

// ==================== CHECK AGENT HEALTH ====================

export async function isAgentRunning(): Promise<boolean> {
    try {
        const response = await fetch(`${getAgentUrl()}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000), // Quick health check
        });
        return response.ok;
    } catch (err) {
        return false;
    }
}

// ==================== GET AVAILABLE PRINTERS ====================

export async function getAvailablePrinters(): Promise<any[]> {
    try {
        const response = await fetch(`${getAgentUrl()}/printers`, {
            method: 'GET',
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('Failed to fetch printers');
        const data = await response.json();
        return data.printers || [];
    } catch (err: any) {
        console.error('❌ Error getting printers:', err);
        return [];
    }
}

// ==================== SET DEFAULT PRINTER ====================

export async function setDefaultPrinter(printerName: string): Promise<boolean> {
    try {
        const response = await fetch(`${getAgentUrl()}/set-default-printer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ printerName }),
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('Failed to set default printer');
        console.log(`✅ Default printer set to: ${printerName}`);
        return true;
    } catch (err: any) {
        console.error('❌ Error setting printer:', err);
        return false;
    }
}

// ==================== MAIN PRINT FUNCTION ====================

export async function printLabel(payload: PrintPayload): Promise<boolean> {
    try {
        // Check printer settings from localStorage
        const settingsStr = localStorage.getItem('wms-printer-settings');
        if (settingsStr) {
            const settings = JSON.parse(settingsStr);

            // Check if printing is enabled
            if (settings.printingEnabled === false) {
                console.log('⏸️ Printing disabled in settings');
                return false;
            }

            // Check if auto-print on scan is enabled
            if (settings.autoPrintOnScan === false) {
                console.log('🚫 Auto-print disabled in settings');
                return false;
            }
        }

        // Check agent is running
        const agentRunning = await isAgentRunning();
        if (!agentRunning) {
            console.warn(`⚠️ Print Agent not running on ${getAgentUrl()}`);
            return false;
        }

        console.log(`🖨️ Sending print job: ${payload.wsn}`);

        // DEBUG: Log full payload being sent
        const printBody = {
            wsn: payload.wsn,
            product_title: payload.product_title || '',
            brand: payload.brand || '',
            mrp: payload.mrp || '',
            fsp: payload.fsp || '',
            fsn: payload.fsn || '',
            wid: payload.wid || '',
            product_serial_number: payload.product_serial_number || '',
            copies: Math.max(1, Math.min(payload.copies || 1, 10)),
        };
        console.log(`📋 Print payload:`, printBody);

        // Send print job with LONG timeout (printer takes time)
        const response = await fetch(`${getAgentUrl()}/print-label`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(printBody),
            signal: AbortSignal.timeout(TIMEOUT_MS), // 65 seconds
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Print failed');
        }

        const result = await response.json();
        console.log(`✅ Print job accepted: ${payload.wsn}`, result);
        return true;
    } catch (err: any) {
        console.error(`❌ Print error for ${payload.wsn}:`, err.message);
        return false;
    }
}

// ==================== TEST PRINT ====================

export async function testPrint(): Promise<boolean> {
    try {
        const response = await fetch(`${getAgentUrl()}/test-print`, {
            method: 'POST',
            signal: AbortSignal.timeout(70000), // Long timeout for test
        });
        if (!response.ok) throw new Error('Test print failed');
        console.log('✅ Test print sent');
        return true;
    } catch (err: any) {
        console.error('❌ Test print error:', err);
        return false;
    }
}

// ==================== GET AGENT CONFIG ====================

export async function getAgentConfig(): Promise<any> {
    try {
        const response = await fetch(`${getAgentUrl()}/config`, {
            method: 'GET',
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('Failed to get config');
        return await response.json();
    } catch (err: any) {
        console.error('❌ Error getting agent config:', err);
        return null;
    }
}

// ==================== UPDATE AGENT CONFIG ====================

export async function updateAgentConfig(config: any): Promise<boolean> {
    try {
        const response = await fetch(`${getAgentUrl()}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('Failed to update config');
        console.log('✅ Agent config updated');
        return true;
    } catch (err: any) {
        console.error('❌ Error updating config:', err);
        return false;
    }
}

export default {
    isAgentRunning,
    getAvailablePrinters,
    setDefaultPrinter,
    printLabel,
    testPrint,
    getAgentConfig,
    updateAgentConfig,
};
