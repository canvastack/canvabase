/**
 * CSV codec pure — encode/decode dengan dukungan quote + separator.
 * Digunakan TransferService (export/import). Tidak bergantung konteks file.
 */

export interface CsvEncodeOptions {
  separator: string;
  quote: string;
}

/** Encodize satu field: quote jika mengandung separator/quote/newline, escape quote dobel. */
export function csvEncodeField(value: unknown, opts: CsvEncodeOptions): string {
  let raw: string;
  if (value === null || value === undefined) raw = '';
  else if (typeof value === 'string') raw = value;
  else if (value instanceof Date) raw = value.toISOString();
  else if (typeof value === 'object') raw = JSON.stringify(value);
  else raw = JSON.stringify(value) ?? '';
  const { separator, quote } = opts;
  const needsQuote = raw.includes(separator) || raw.includes(quote) || /[\r\n]/.test(raw);
  if (!needsQuote) return raw;
  return `${quote}${raw.split(quote).join(quote + quote)}${quote}`;
}

export function csvEncodeRow(values: unknown[], opts: CsvEncodeOptions): string {
  return values.map((v) => csvEncodeField(v, opts)).join(opts.separator);
}

/** Decode satu baris CSV — streamable (state di-carry antar chunk). */
export interface CsvParserState {
  buffer: string;
  done: boolean;
}

export function createCsvParserState(): CsvParserState {
  return { buffer: '', done: false };
}

/** Posisi terminator baris berikutnya (indeks `\n`/`\r`), -1 jika belum lengkap. */
function nextLineEnd(buffer: string, quote: string): number {
  let inQuote = false;
  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    if (inQuote) {
      if (ch === quote) {
        if (buffer[i + 1] === quote) i++;
        else inQuote = false;
      }
      continue;
    }
    if (ch === quote) {
      inQuote = true;
      continue;
    }
    if (ch === '\r' || ch === '\n') return i;
  }
  return -1;
}

function parseLine(line: string, opts: CsvEncodeOptions): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuote = false;
  const { separator, quote } = opts;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === quote) {
        if (line[i + 1] === quote) {
          field += quote;
          i++;
        } else {
          inQuote = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === quote) {
      inQuote = true;
      continue;
    }
    if (ch === separator) {
      fields.push(field);
      field = '';
      continue;
    }
    field += ch;
  }
  fields.push(field);
  return fields;
}

/**
 * Parse data CSV menjadi baris-baris field. Menangani baris yang terpecah
 * chunk (buffer disimpan antar panggilan) dan quote berisi newline.
 * Panggil dengan `done:true` pada akhir file agar baris terakhir (tanpa
 * newline) ikut diekstrak.
 */
export function csvParse(
  state: CsvParserState,
  chunk: string,
  opts: CsvEncodeOptions,
): string[][] {
  state.buffer += chunk;
  const rows: string[][] = [];

  for (;;) {
    const end = nextLineEnd(state.buffer, opts.quote);
    if (end < 0) break;
    const line = state.buffer.slice(0, end);
    rows.push(parseLine(line, opts));
    let cursor = end;
    while (cursor < state.buffer.length && (state.buffer[cursor] === '\r' || state.buffer[cursor] === '\n')) {
      cursor++;
    }
    state.buffer = state.buffer.slice(cursor);
  }

  if (state.done && state.buffer.trim().length > 0) {
    rows.push(parseLine(state.buffer, opts));
    state.buffer = '';
  }
  return rows;
}
