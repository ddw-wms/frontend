/**
 * ⚡ OPTIMIZED: Dynamic Excel Utility
 * Loads XLSX library on-demand to reduce initial bundle size (~500KB savings)
 * 
 * Usage:
 * const { exportToExcel, createWorkbook, jsonToSheet } = await import('@/lib/excelUtils');
 * await exportToExcel(data, 'filename.xlsx');
 */

// Type definitions for XLSX
type WorkBook = any;
type WorkSheet = any;

let xlsxModule: typeof import('xlsx') | null = null;

/**
 * Load XLSX module dynamically (cached after first load)
 */
async function getXLSX() {
    if (!xlsxModule) {
        xlsxModule = await import('xlsx');
    }
    return xlsxModule;
}

/**
 * Create a new workbook
 */
export async function createWorkbook(): Promise<WorkBook> {
    const XLSX = await getXLSX();
    return XLSX.utils.book_new();
}

/**
 * Convert JSON data to worksheet
 */
export async function jsonToSheet(data: any[]): Promise<WorkSheet> {
    const XLSX = await getXLSX();
    return XLSX.utils.json_to_sheet(data);
}

/**
 * Append sheet to workbook
 */
export async function appendSheet(workbook: WorkBook, worksheet: WorkSheet, sheetName: string): Promise<void> {
    const XLSX = await getXLSX();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

/**
 * Write workbook to file (triggers download)
 */
export async function writeFile(workbook: WorkBook, filename: string): Promise<void> {
    const XLSX = await getXLSX();
    XLSX.writeFile(workbook, filename);
}

/**
 * Encode column index to letter (0 -> A, 1 -> B, etc.)
 */
export async function encodeCol(col: number): Promise<string> {
    const XLSX = await getXLSX();
    return XLSX.utils.encode_col(col);
}

/**
 * Quick export: JSON data to Excel file in one call
 * @param data - Array of objects to export
 * @param filename - Output filename (should end with .xlsx)
 * @param sheetName - Name of the worksheet (default: 'Sheet1')
 */
export async function exportToExcel(
    data: any[],
    filename: string,
    sheetName: string = 'Sheet1'
): Promise<void> {
    const XLSX = await getXLSX();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
}

/**
 * Export with multiple sheets
 * @param sheets - Array of { name: string, data: any[] }
 * @param filename - Output filename
 */
export async function exportMultiSheet(
    sheets: Array<{ name: string; data: any[] }>,
    filename: string
): Promise<void> {
    const XLSX = await getXLSX();
    const wb = XLSX.utils.book_new();

    for (const sheet of sheets) {
        const ws = XLSX.utils.json_to_sheet(sheet.data);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }

    XLSX.writeFile(wb, filename);
}

/**
 * Read Excel file and return data
 * @param file - File object from input
 * @returns Promise<any[][]> - Array of sheet data
 */
export async function readExcelFile(file: File): Promise<{ sheetName: string; data: any[] }[]> {
    const XLSX = await getXLSX();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                const result = workbook.SheetNames.map((sheetName: string) => ({
                    sheetName,
                    data: XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])
                }));

                resolve(result);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Format Excel sheet with styles (for styled exports)
 * Note: Basic XLSX doesn't support styling, this adds column widths
 */
export async function setColumnWidths(worksheet: WorkSheet, widths: number[]): Promise<void> {
    worksheet['!cols'] = widths.map(w => ({ wch: w }));
}

export default {
    createWorkbook,
    jsonToSheet,
    appendSheet,
    writeFile,
    encodeCol,
    exportToExcel,
    exportMultiSheet,
    readExcelFile,
    setColumnWidths,
};
