import Papa from 'papaparse';
import { saveAs } from 'file-saver';

export function exportJsonAsCsv(filename: string, data: any[]) {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}
