import { beforeEach, describe, expect, it } from 'vitest';
import {
  getAvailableFonts,
  applyFontSettings,
  getSavedTypography,
} from './fontManager';

describe('fontManager', () => {
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

  it('returns default curated lists of popular UI and Mono fonts', async () => {
    const fonts = await getAvailableFonts();
    expect(fonts.ui).toContain('Inter');
    expect(fonts.ui).toContain('Segoe UI');
    expect(fonts.mono).toContain('JetBrains Mono');
    expect(fonts.mono).toContain('Fira Code');
  });

  it('updates CSS variables and localStorage when typography settings change', () => {
    applyFontSettings({
      uiFont: 'Segoe UI',
      uiFontSize: 14,
      monoFont: 'Fira Code',
      monoFontSize: 15,
      monoFontStyle: 'italic',
    });

    expect(mockStyle['--font-sans']).toContain('Segoe UI');
    expect(mockStyle['--font-mono']).toContain('Fira Code');
    expect(mockStyle['--font-ui-size']).toBe('14px');
    expect(mockStyle['--font-mono-size']).toBe('15px');
    expect(mockStyle['--font-mono-style']).toBe('italic');

    const saved = getSavedTypography();
    expect(saved.uiFont).toBe('Segoe UI');
    expect(saved.monoFont).toBe('Fira Code');
    expect(saved.uiFontSize).toBe(14);
    expect(saved.monoFontSize).toBe(15);
  });
});
