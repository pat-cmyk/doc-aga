/**
 * Animal Profile Export — public API
 *
 * Usage:
 *   const { data } = useAnimalProfileExport(animalId, farmId);
 *   // Full profile (identity + everything)
 *   downloadAnimalProfile(data, 'both');
 *   // Production focus (milk + feed with charts)
 *   downloadAnimalProfile(data, 'both', 'production');
 */

import { generateAnimalProfilePDF } from './pdf';
import { generateAnimalProfileCSV, buildExportFilename } from './csv';
import { generateAnimalProductionPDF } from './productionPdf';
import { generateAnimalProductionCSV } from './productionCsv';
import type { AnimalProfileExportData, ExportFormat, ReportKind } from './types';

export {
  generateAnimalProfilePDF,
  generateAnimalProfileCSV,
  generateAnimalProductionPDF,
  generateAnimalProductionCSV,
  buildExportFilename,
};
export type { AnimalProfileExportData, ExportFormat, ReportKind };
export * from './types';

/**
 * Trigger a browser download for the given data in the chosen format(s)
 * and report kind. Works in both web PWA and Capacitor WebView (standard
 * blob + anchor click).
 *
 * @param data       SSOT payload from useAnimalProfileExport
 * @param format     'pdf' | 'csv' | 'both'
 * @param reportKind 'full' (default) | 'production' — determines which
 *                   renderer is used and how the filename is labeled
 */
export function downloadAnimalProfile(
  data: AnimalProfileExportData,
  format: ExportFormat = 'pdf',
  reportKind: ReportKind = 'full',
): void {
  if (format === 'pdf' || format === 'both') {
    const doc =
      reportKind === 'production'
        ? generateAnimalProductionPDF(data)
        : generateAnimalProfilePDF(data);
    doc.save(buildExportFilename(data.identity, 'pdf', reportKind));
  }
  if (format === 'csv' || format === 'both') {
    const csv =
      reportKind === 'production'
        ? generateAnimalProductionCSV(data)
        : generateAnimalProfileCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildExportFilename(data.identity, 'csv', reportKind);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
