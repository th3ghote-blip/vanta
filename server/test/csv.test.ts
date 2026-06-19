/**
 * 21.15 — CSV serialization helper unit tests.
 * Covers RFC-4180 escaping, header row, CRLF lines, and filename sanitization.
 */
import { describe, it, expect } from 'vitest';
import { csvCell, toCsv, csvFilename, type CsvColumn } from '../src/lib/csv.js';

describe('csvCell', () => {
  it('passes through plain values', () => {
    expect(csvCell('BTCUSD')).toBe('BTCUSD');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(3.5)).toBe('3.5');
    expect(csvCell(true)).toBe('true');
    expect(csvCell(false)).toBe('false');
  });

  it('renders null/undefined and non-finite numbers as empty', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(NaN)).toBe('');
    expect(csvCell(Infinity)).toBe('');
  });

  it('quotes and escapes values with comma, quote, or newline', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('cr\rlf')).toBe('"cr\rlf"');
  });
});

describe('toCsv', () => {
  const cols: CsvColumn<any>[] = [
    { label: 'symbol', value: (r) => r.symbol },
    { label: 'pnl', value: (r) => r.pnl },
  ];

  it('writes a header row then one CRLF-terminated line per row', () => {
    const csv = toCsv(cols, [
      { symbol: 'BTCUSD', pnl: 50 },
      { symbol: 'ETH,USD', pnl: -20 },
    ]);
    expect(csv).toBe('symbol,pnl\r\nBTCUSD,50\r\n"ETH,USD",-20\r\n');
  });

  it('emits just the header for an empty row set', () => {
    expect(toCsv(cols, [])).toBe('symbol,pnl\r\n');
  });
});

describe('csvFilename', () => {
  it('builds a dated, sanitized .csv name', () => {
    const d = new Date('2026-06-19T12:00:00Z');
    expect(csvFilename('analytics-by-symbol-7d', d)).toBe('vanta-analytics-by-symbol-7d-2026-06-19.csv');
    expect(csvFilename('weird name/v2', d)).toBe('vanta-weird-name-v2-2026-06-19.csv');
  });
});
