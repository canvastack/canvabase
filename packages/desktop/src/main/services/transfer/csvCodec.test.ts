import { describe, expect, it } from 'vitest';
import {
  createCsvParserState,
  csvEncodeField,
  csvEncodeRow,
  csvParse,
} from './csvCodec.js';

const opts = { separator: ',', quote: '"' };

describe('csvCodec encode', () => {
  it('keeps plain fields unquoted', () => {
    expect(csvEncodeField('hello', opts)).toBe('hello');
  });

  it('quotes fields containing separator, quote or newline', () => {
    expect(csvEncodeField('a,b', opts)).toBe('"a,b"');
    expect(csvEncodeField('say "hi"', opts)).toBe('"say ""hi"""');
    expect(csvEncodeField('a\nb', opts)).toBe('"a\nb"');
  });

  it('renders null/undefined as empty and numbers verbatim', () => {
    expect(csvEncodeField(null, opts)).toBe('');
    expect(csvEncodeField(undefined, opts)).toBe('');
    expect(csvEncodeField(42.5, opts)).toBe('42.5');
    expect(csvEncodeField(false, opts)).toBe('false');
  });

  it('encodes a full row joined by separator', () => {
    expect(csvEncodeRow(['id', 'a,b', null], opts)).toBe('id,"a,b",');
  });
});

describe('csvCodec parse', () => {
  it('round-trips rows through encode', () => {
    const input = [
      ['id', 'name', 'note'],
      ['1', "O'Brien", 'has, comma'],
      ['2', 'multi\nline', 'quote "here"'],
    ];
    const text = input.map((r) => csvEncodeRow(r, opts)).join('\n') + '\n';
    const state = createCsvParserState();
    const rows = csvParse(state, text, opts);
    expect(rows).toEqual(input);
  });

  it('handles CRLF line endings', () => {
    const state = createCsvParserState();
    const rows = csvParse(state, 'a,b\r\n1,2\r\n', opts);
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('buffers rows split across chunks', () => {
    const state = createCsvParserState();
    const text = 'a,b\n1,2\n3,4\n';
    const first = csvParse(state, text.slice(0, 5), opts);
    const second = csvParse(state, text.slice(5), opts);
    expect(first).toEqual([['a', 'b']]);
    expect(second).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('extracts trailing line without final newline when done', () => {
    const state = createCsvParserState();
    const rows = csvParse(state, 'a,b\n1,2', opts);
    expect(rows).toEqual([['a', 'b']]);
    state.done = true;
    const tail = csvParse(state, '', opts);
    expect(tail).toEqual([['1', '2']]);
  });

  it('parses quoted fields containing commas and quotes', () => {
    const state = createCsvParserState();
    const rows = csvParse(state, '"a,b","say ""hi""",x\n', opts);
    expect(rows).toEqual([['a,b', 'say "hi"', 'x']]);
  });
});
