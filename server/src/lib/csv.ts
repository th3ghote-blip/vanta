/**
 * Minimal RFC-4180 CSV serialization for admin report exports (21.15).
 *
 * Deliberately dependency-free and side-effect-free so it is trivially unit
 * testable. Used by the analytics export endpoints to turn the SAME computed
 * payload the JSON endpoint returns into a downloadable CSV — guaranteeing the
 * exported rows match the on-screen data exactly.
 */

export interface CsvColumn<T> {
  /** Header label written in the first row. */
  label: string;
  /** Cell value for a given row. */
  value: (row: T) => unknown;
}

/** Escape a single CSV field per RFC 4180 (quote when it contains , " CR or LF). */
export function csvCell(v: unknown): string {
  if (v == null) return '';
  let s: string;
  if (typeof v === 'number') s = Number.isFinite(v) ? String(v) : '';
  else if (typeof v === 'boolean') s = v ? 'true' : 'false';
  else s = String(v);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Serialize rows to a CSV string with a header row.
 * Lines are CRLF-terminated (RFC 4180); the output ends with a trailing CRLF.
 */
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => csvCell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(','));
  return [header, ...lines].join('\r\n') + '\r\n';
}

/** Build a safe, dated download filename: `vanta-<base>-<YYYY-MM-DD>.csv`. */
export function csvFilename(base: string, date: Date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `vanta-${safe}-${day}.csv`;
}
