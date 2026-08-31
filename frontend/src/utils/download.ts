/**
 * Triggers a browser download of a blob under the given filename.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Builds a report filename like `Client_Name_report_2024-01-01.csv`,
 * replacing characters that are unsafe in filenames.
 */
export function buildReportFilename(clientName: string, extension: 'csv' | 'pdf'): string {
  const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
  const date = new Date().toISOString().split('T')[0];
  return `${safeName}_report_${date}.${extension}`;
}
