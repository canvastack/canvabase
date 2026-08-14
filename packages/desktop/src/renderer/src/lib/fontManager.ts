/**
 * Font Manager Utility for CanvaBase
 * Handles system font detection, Google fonts dynamic loading, local font file uploads, and typography CSS variable application.
 */

export interface FontTypographySettings {
  uiFont: string;
  uiFontSize: number; // e.g. 13
  uiFontWeight: string; // '300' | '400' | '500' | '600' | '700'
  monoFont: string;
  monoFontSize: number; // e.g. 13
  monoFontWeight: string; // '400' | '500' | '600' | '700'
  monoFontStyle: 'normal' | 'italic';
  monoLineHeight: number; // e.g. 1.5
}

export const DEFAULT_FONT_SETTINGS: FontTypographySettings = {
  uiFont: 'Inter',
  uiFontSize: 13,
  uiFontWeight: '400',
  monoFont: 'JetBrains Mono',
  monoFontSize: 13,
  monoFontWeight: '400',
  monoFontStyle: 'normal',
  monoLineHeight: 1.5,
};

export const POPULAR_UI_FONTS: string[] = [
  'Inter',
  'Segoe UI',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Nunito',
  'Ubuntu',
  'SF Pro Display',
  '-apple-system',
  'system-ui',
  'Helvetica Neue',
  'Arial',
];

export const POPULAR_MONO_FONTS: string[] = [
  'JetBrains Mono',
  'Fira Code',
  'Cascadia Code',
  'Source Code Pro',
  'Consolas',
  'Courier New',
  'Menlo',
  'Monaco',
  'Inconsolata',
  'Ubuntu Mono',
  'Roboto Mono',
  'IBM Plex Mono',
  'Space Mono',
  'Hack',
];

const CUSTOM_FONTS_STORAGE_KEY = 'cb_custom_uploaded_fonts';
const GOOGLE_FONTS_STORAGE_KEY = 'cb_imported_google_fonts';

interface StoredCustomFont {
  family: string;
  dataUrl: string;
  format: string;
}

/**
 * Retrieve list of all available system fonts + curated catalog.
 */
export async function getAvailableFonts(): Promise<{ ui: string[]; mono: string[] }> {
  const uiSet = new Set<string>(POPULAR_UI_FONTS);
  const monoSet = new Set<string>(POPULAR_MONO_FONTS);

  // Load any previously registered custom/Google fonts
  const customFonts = getStoredCustomFonts();
  for (const cf of customFonts) {
    uiSet.add(cf.family);
    monoSet.add(cf.family);
  }
  const googleFonts = getStoredGoogleFonts();
  for (const gf of googleFonts) {
    uiSet.add(gf);
    monoSet.add(gf);
  }

  // Attempt window.queryLocalFonts() if supported (Chromium / Electron)
  try {
    const queryLocalFonts = (window as unknown as { queryLocalFonts?: () => Promise<Array<{ family: string }>> }).queryLocalFonts;
    if (typeof queryLocalFonts === 'function') {
      const localFonts = await queryLocalFonts();
      for (const font of localFonts) {
        if (font.family) {
          const lower = font.family.toLowerCase();
          if (lower.includes('mono') || lower.includes('code') || lower.includes('console') || lower.includes('courier')) {
            monoSet.add(font.family);
          }
          uiSet.add(font.family);
        }
      }
    }
  } catch {
    // Local font access not permitted or unavailable; fallback to curated
  }

  return {
    ui: Array.from(uiSet).sort((a, b) => a.localeCompare(b)),
    mono: Array.from(monoSet).sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * Dynamically import a Google Font by family name or stylesheet URL.
 */
export async function importGoogleFont(familyOrUrl: string): Promise<{ ok: boolean; family: string; error?: string }> {
  let fontName = familyOrUrl.trim();
  let href = '';

  if (fontName.startsWith('http://') || fontName.startsWith('https://')) {
    href = fontName;
    const match = /family=([^&:]+)/.exec(href);
    fontName = match && match[1] ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : 'Custom Web Font';
  } else {
    const cleanName = fontName.replace(/["']/g, '');
    const encoded = encodeURIComponent(cleanName).replace(/%20/g, '+');
    href = `https://fonts.googleapis.com/css2?family=${encoded}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,700&display=swap`;
    fontName = cleanName;
  }

  try {
    const linkId = `google-font-${fontName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }

    // Save to stored Google Fonts
    const saved = getStoredGoogleFonts();
    if (!saved.includes(fontName)) {
      saved.push(fontName);
      localStorage.setItem(GOOGLE_FONTS_STORAGE_KEY, JSON.stringify(saved));
    }

    return { ok: true, family: fontName };
  } catch (err) {
    return { ok: false, family: fontName, error: (err as Error).message || 'Failed to load font' };
  }
}

/**
 * Upload a local font file (.ttf, .otf, .woff, .woff2) and register with FontFace API.
 */
export async function uploadLocalFontFile(file: File): Promise<{ ok: boolean; family: string; error?: string }> {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'ttf';
    const formatMap: Record<string, string> = {
      ttf: 'truetype',
      otf: 'opentype',
      woff: 'woff',
      woff2: 'woff2',
    };
    const format = formatMap[ext] || 'truetype';
    const familyName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    const buffer = await file.arrayBuffer();
    const fontFace = new FontFace(familyName, buffer);
    const loadedFace = await fontFace.load();
    document.fonts.add(loadedFace);

    // Save to local storage for persistence across reloads
    const base64 = await fileToBase64(file);
    const stored = getStoredCustomFonts();
    const existingIdx = stored.findIndex((f) => f.family.toLowerCase() === familyName.toLowerCase());
    const item: StoredCustomFont = { family: familyName, dataUrl: base64, format };
    if (existingIdx >= 0) {
      stored[existingIdx] = item;
    } else {
      stored.push(item);
    }
    try {
      localStorage.setItem(CUSTOM_FONTS_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Storage quota exceeded if font is very large, font still active in session
    }

    return { ok: true, family: familyName };
  } catch (err) {
    return { ok: false, family: file.name, error: (err as Error).message || 'Failed to register local font' };
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getStoredCustomFonts(): StoredCustomFont[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const val = localStorage.getItem(CUSTOM_FONTS_STORAGE_KEY);
    return val ? (JSON.parse(val) as StoredCustomFont[]) : [];
  } catch {
    return [];
  }
}

export function getStoredGoogleFonts(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const val = localStorage.getItem(GOOGLE_FONTS_STORAGE_KEY);
    return val ? (JSON.parse(val) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Initialize all persisted fonts (custom uploaded + google imported) on app startup.
 */
export async function initPersistedFonts(): Promise<void> {
  if (typeof document === 'undefined') return;

  // Rehydrate Google Fonts
  const googleFonts = getStoredGoogleFonts();
  for (const gf of googleFonts) {
    void importGoogleFont(gf);
  }

  // Rehydrate Local Uploaded Fonts
  const customFonts = getStoredCustomFonts();
  for (const cf of customFonts) {
    try {
      if (typeof FontFace !== 'undefined') {
        const fontFace = new FontFace(cf.family, `url(${cf.dataUrl}) format('${cf.format}')`);
        const loaded = await fontFace.load();
        document.fonts.add(loaded);
      }
    } catch {
      // Skip invalid font
    }
  }

  // Apply saved typography settings
  applySavedTypography();
}

/**
 * Read typography settings from localStorage.
 */
export function getSavedTypography(): FontTypographySettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_FONT_SETTINGS };
  return {
    uiFont: localStorage.getItem('cb_ui_font') || DEFAULT_FONT_SETTINGS.uiFont,
    uiFontSize: parseInt(localStorage.getItem('cb_ui_font_size') || String(DEFAULT_FONT_SETTINGS.uiFontSize), 10),
    uiFontWeight: localStorage.getItem('cb_ui_font_weight') || DEFAULT_FONT_SETTINGS.uiFontWeight,
    monoFont: localStorage.getItem('cb_mono_font') || DEFAULT_FONT_SETTINGS.monoFont,
    monoFontSize: parseInt(localStorage.getItem('cb_mono_font_size') || String(DEFAULT_FONT_SETTINGS.monoFontSize), 10),
    monoFontWeight: localStorage.getItem('cb_mono_font_weight') || DEFAULT_FONT_SETTINGS.monoFontWeight,
    monoFontStyle: (localStorage.getItem('cb_mono_font_style') as 'normal' | 'italic') || DEFAULT_FONT_SETTINGS.monoFontStyle,
    monoLineHeight: parseFloat(localStorage.getItem('cb_mono_line_height') || String(DEFAULT_FONT_SETTINGS.monoLineHeight)),
  };
}

/**
 * Apply typography settings to CSS custom variables & persist in localStorage.
 */
export function applyFontSettings(settings: Partial<FontTypographySettings>): void {
  const current = getSavedTypography();
  const next = { ...current, ...settings };

  // Update CSS Variables
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--font-sans', `"${next.uiFont}", system-ui, -apple-system, sans-serif`);
    root.style.setProperty('--font-ui-size', `${next.uiFontSize}px`);
    root.style.setProperty('--font-ui-weight', next.uiFontWeight);

    root.style.setProperty('--font-mono', `"${next.monoFont}", 'Cascadia Code', Consolas, monospace`);
    root.style.setProperty('--font-mono-size', `${next.monoFontSize}px`);
    root.style.setProperty('--font-mono-weight', next.monoFontWeight);
    root.style.setProperty('--font-mono-style', next.monoFontStyle);
    root.style.setProperty('--font-mono-line-height', String(next.monoLineHeight));
  }

  // Persist
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('cb_ui_font', next.uiFont);
    localStorage.setItem('cb_ui_font_size', String(next.uiFontSize));
    localStorage.setItem('cb_ui_font_weight', next.uiFontWeight);
    localStorage.setItem('cb_mono_font', next.monoFont);
    localStorage.setItem('cb_mono_font_size', String(next.monoFontSize));
    localStorage.setItem('cb_mono_font_weight', next.monoFontWeight);
    localStorage.setItem('cb_mono_font_style', next.monoFontStyle);
    localStorage.setItem('cb_mono_line_height', String(next.monoLineHeight));
  }
}

export function applySavedTypography(): void {
  applyFontSettings(getSavedTypography());
}
