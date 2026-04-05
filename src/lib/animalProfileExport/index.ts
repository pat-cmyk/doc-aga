/**
 * Animal Profile Export — public API
 *
 * Usage:
 *   const { data } = useAnimalProfileExport(animalId, farmId);
 *   if (data) downloadAnimalProfile(data, 'both');
 */

import { generateAnimalProfilePDF } from './pdf';
import { generateAnimalProfileCSV, buildExportFilename } from './csv';
import type { AnimalProfileExportData, ExportFormat } from './types';

export { generateAnimalProfilePDF, generateAnimalProfileCSV, buildExportFilename };
export type { AnimalProfileExportData, ExportFormat };
export * from './types';

/**
 * Trigger a browser download for the given data in the chosen format(s).
 * Works in both web PWA and Capacitor WebView (standard blob + anchor click).
 */
export function downloadAnimalProfile(
  data: AnimalProfileExportData,
  format: ExportFormat = 'pdf',
): void {
  if (format === 'pdf' || format === 'both') {
    const doc = generateAnimalProfilePDF(data);
    doc.save(buildExportFilename(data.identity, 'pdf'));
  }
  if (format === 'csv' || format === 'both') {
    const csv = generateAnimalProfileCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildExportFilename(data.identity, 'csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
