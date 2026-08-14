import { beforeEach, describe, expect, it } from 'vitest';
import { SQL_THEME_PRESETS, applySqlTheme, getSavedSqlTheme } from './sqlTheme';

describe('sqlTheme', () => {
  const store: Record<string, string> = {};
  const mockStyle: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    Object.keys(mockStyle).forEach((k) => delete mockStyle[k]);

    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
      key: (_i: number) => null,
      length: 0,
    };

    (globalThis as unknown as { document: { documentElement: { style: { setProperty: (k: string, v: string) => void; getPropertyValue: (k: string) => string } } } }).document = {
      documentElement: {
        style: {
          setProperty: (k: string, v: string) => {
            mockStyle[k] = v;
          },
          getPropertyValue: (k: string) => mockStyle[k] || '',
        },
      },
    };
  });

  it('contains essential IDE presets', () => {
    const presetIds = SQL_THEME_PRESETS.map((p) => p.id);
    expect(presetIds).toContain('canvabase-indigo');
    expect(presetIds).toContain('vscode-dark-plus');
    expect(presetIds).toContain('monokai-pro');
    expect(presetIds).toContain('one-dark-pro');
  });

  it('applies custom SQL theme colors to CSS variables', () => {
    const customColors = {
      keyword: '#ff0000',
      function: '#00ff00',
      string: '#0000ff',
      number: '#ffff00',
      comment: '#888888',
      operator: '#ff00ff',
      identifier: '#ffffff',
      selection: 'rgba(255, 0, 0, 0.3)',
    };

    applySqlTheme(customColors, 'custom-test');
    expect(mockStyle['--sql-keyword-color']).toBe('#ff0000');
    expect(mockStyle['--sql-string-color']).toBe('#0000ff');
    expect(getSavedSqlTheme().keyword).toBe('#ff0000');
  });
});
