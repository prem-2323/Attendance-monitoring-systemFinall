type CsvCell = string | number | boolean | null | undefined;

const escapeCsvCell = (value: CsvCell): string => {
  let text = value == null ? '' : String(value);

  if (typeof value === 'string' && /^[\s\uFEFF]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildCsv = (headers: string[], rows: CsvCell[][]): string => {
  const content = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');

  return `\uFEFF${content}`;
};

export const downloadCsv = (filename: string, headers: string[], rows: CsvCell[][]): void => {
  const safeFilename = filename.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
  const blob = new Blob([buildCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename.toLowerCase().endsWith('.csv') ? safeFilename : `${safeFilename}.csv`;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};
