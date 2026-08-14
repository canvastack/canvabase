import { useEffect, useRef, useState, type JSX } from 'react';
import type { AppStore } from '../store';
import {
  getAvailableFonts,
  importGoogleFont,
  uploadLocalFontFile,
  getSavedTypography,
  applyFontSettings,
  type FontTypographySettings,
} from '../lib/fontManager';
import {
  SQL_THEME_PRESETS,
  getSavedSqlTheme,
  getSavedSqlThemePresetId,
  applySqlTheme,
  type SqlThemeColors,
} from '../lib/sqlTheme';
import { highlightSql } from '../lib/sqlHighlighter';

interface SettingsModalProps {
  store?: AppStore;
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_ACCENT_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#64748b', // Slate
];

const PRESET_DARK_BG_THEMES = [
  { name: 'Midnight', hex: '#0f1222' },
  { name: 'Pitch Black', hex: '#000000' },
  { name: 'Charcoal', hex: '#121212' },
  { name: 'Deep Navy', hex: '#0a1128' },
  { name: 'Forest', hex: '#061a14' },
  { name: 'Deep Purple', hex: '#130924' },
];

const PRESET_LIGHT_BG_THEMES = [
  { name: 'Light Snow', hex: '#f8fafc' },
  { name: 'Pure White', hex: '#ffffff' },
  { name: 'Cool Gray', hex: '#f1f5f9' },
  { name: 'Warm Sand', hex: '#fafaf9' },
  { name: 'Soft Mint', hex: '#f0fdf4' },
  { name: 'Soft Rose', hex: '#fff1f2' },
];

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (c.length !== 6) return { h: 228, s: 38, l: 10 };
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function computeAutoHoverColor(hex: string): string {
  if (!hex || !hex.startsWith('#')) return '#818cf8';
  const { h, s, l } = hexToHsl(hex);
  const hoverL = l < 45 ? Math.min(95, l + 12) : Math.max(10, l - 10);
  return hslToHex(h, s, hoverL);
}

export function applyAccent(hex: string, hoverHex?: string) {
  if (!hex || !hex.startsWith('#')) return;
  const computedHover = hoverHex || computeAutoHoverColor(hex);

  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-hover', computedHover);
  document.documentElement.style.setProperty('--accent-subtle', `${hex}26`);

  localStorage.setItem('cb_accent_color', hex);
  localStorage.setItem('cb_accent_hover_color', computedHover);
}

export function getSavedBgColor(mode: 'dark' | 'light' | 'system'): string {
  if (mode === 'light') {
    return localStorage.getItem('cb_light_bg_color') || '#f8fafc';
  } else {
    return localStorage.getItem('cb_dark_bg_color') || '#0f1222';
  }
}

export function applyBgColor(baseHex: string, mode: 'dark' | 'light' | 'system') {
  if (!baseHex || !baseHex.startsWith('#')) return;
  const { h, s, l } = hexToHsl(baseHex);
  const isDark = l < 50;

  if (mode === 'light' || (!isDark && mode === 'system')) {
    localStorage.setItem('cb_light_bg_color', baseHex);
  } else {
    localStorage.setItem('cb_dark_bg_color', baseHex);
  }

  if (isDark) {
    const surfaceL = Math.max(0, Math.min(100, l + 5));
    const surfaceHoverL = Math.max(0, Math.min(100, l + 9));
    const inputL = Math.max(0, Math.min(100, l - 3));
    const borderL = Math.max(0, Math.min(100, l + 14));

    document.documentElement.style.setProperty('--bg-app', baseHex);
    document.documentElement.style.setProperty('--bg-surface', hslToHex(h, s, surfaceL));
    document.documentElement.style.setProperty('--bg-surface-hover', hslToHex(h, s, surfaceHoverL));
    document.documentElement.style.setProperty('--bg-input', hslToHex(h, s, inputL));
    document.documentElement.style.setProperty('--border', hslToHex(h, s, borderL));
    document.documentElement.style.setProperty('--text-primary', '#e6e8f2');
    document.documentElement.style.setProperty('--text-secondary', '#9aa0c0');
    document.documentElement.style.setProperty('--text-muted', '#6b7194');
  } else {
    const surfaceL = 100;
    const surfaceHoverL = Math.max(0, Math.min(100, l - 4));
    const inputL = 100;
    const borderL = Math.max(0, Math.min(100, l - 18));

    document.documentElement.style.setProperty('--bg-app', baseHex);
    document.documentElement.style.setProperty('--bg-surface', hslToHex(h, s, surfaceL));
    document.documentElement.style.setProperty('--bg-surface-hover', hslToHex(h, s, surfaceHoverL));
    document.documentElement.style.setProperty('--bg-input', hslToHex(h, s, inputL));
    document.documentElement.style.setProperty('--border', hslToHex(h, s, borderL));
    document.documentElement.style.setProperty('--text-primary', '#0f172a');
    document.documentElement.style.setProperty('--text-secondary', '#475569');
    document.documentElement.style.setProperty('--text-muted', '#64748b');
  }
}

export function applyAppOpacity(percent: number) {
  const decimal = Math.max(0.4, Math.min(1, percent / 100));
  const blurPx = Math.round((1 - decimal) * 20);
  document.documentElement.style.setProperty('--cb-surface-opacity', String(decimal));
  document.documentElement.style.setProperty('--cb-glass-blur', `${blurPx}px`);
  localStorage.setItem('cb_app_opacity', String(percent));
}

export interface ThemeProfile {
  version: 1;
  name?: string;
  themeMode: 'dark' | 'light' | 'system';
  accentColor: string;
  accentHoverColor: string;
  bgColor: string;
  appOpacity: number;
  density: 'compact' | 'comfortable';
  typography?: FontTypographySettings;
  sqlTheme?: {
    presetId?: string;
    colors: SqlThemeColors;
  };
  uiFont?: string;
  monoFont?: string;
  toolbarDisplayStyle: 'both' | 'icon' | 'text';
}

function readLocalStorageProfile(): ThemeProfile {
  const mode = (localStorage.getItem('theme') as 'dark' | 'light' | 'system') || 'dark';
  return {
    version: 1,
    themeMode: mode,
    accentColor: localStorage.getItem('cb_accent_color') || '#6366f1',
    accentHoverColor: localStorage.getItem('cb_accent_hover_color') || '#818cf8',
    bgColor: getSavedBgColor(mode),
    appOpacity: parseInt(localStorage.getItem('cb_app_opacity') || '100', 10),
    density: (localStorage.getItem('data-density') as 'compact' | 'comfortable') || 'comfortable',
    typography: getSavedTypography(),
    sqlTheme: {
      presetId: getSavedSqlThemePresetId(),
      colors: getSavedSqlTheme(),
    },
    uiFont: localStorage.getItem('cb_ui_font') || 'Inter',
    monoFont: localStorage.getItem('cb_mono_font') || 'JetBrains Mono',
    toolbarDisplayStyle: (localStorage.getItem('cb_toolbar_display_style') as 'both' | 'icon' | 'text') || 'both',
  };
}

export function applyThemeProfile(profile: ThemeProfile) {
  const mode = profile.themeMode ?? 'dark';
  localStorage.setItem('theme', mode);
  document.documentElement.setAttribute('data-theme', mode);

  const accent = profile.accentColor ?? '#6366f1';
  const hover = profile.accentHoverColor ?? computeAutoHoverColor(accent);
  applyAccent(accent, hover);

  const bg = profile.bgColor ?? getSavedBgColor(mode);
  applyBgColor(bg, mode);

  applyAppOpacity(profile.appOpacity ?? 100);
  localStorage.setItem('data-density', profile.density ?? 'comfortable');
  document.documentElement.setAttribute('data-density', profile.density ?? 'comfortable');

  if (profile.typography) {
    applyFontSettings(profile.typography);
  } else {
    const partial: Partial<FontTypographySettings> = {};
    if (profile.uiFont) {
      localStorage.setItem('cb_ui_font', profile.uiFont);
      partial.uiFont = profile.uiFont;
    }
    if (profile.monoFont) {
      localStorage.setItem('cb_mono_font', profile.monoFont);
      partial.monoFont = profile.monoFont;
    }
    applyFontSettings(partial);
  }

  if (profile.sqlTheme) {
    applySqlTheme(profile.sqlTheme.colors, profile.sqlTheme.presetId);
  }

  if (profile.toolbarDisplayStyle) localStorage.setItem('cb_toolbar_display_style', profile.toolbarDisplayStyle);
}

export function downloadThemeProfile(filename = 'canvabase-theme.json') {
  const profile = readLocalStorageProfile();
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function loadThemeProfileFromFile(file: File): Promise<{ ok: boolean; error?: string }> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<ThemeProfile>;
    if (parsed.version !== 1) {
      return { ok: false, error: 'Unsupported theme profile version' };
    }
    applyThemeProfile(parsed as ThemeProfile);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Invalid theme JSON file' };
  }
}

export function SettingsModal({ store, isOpen, onClose }: SettingsModalProps): JSX.Element | null {
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'system'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light' | 'system') || 'dark';
  });

  const [accentColor, setAccentColor] = useState<string>(() => {
    return localStorage.getItem('cb_accent_color') || '#6366f1';
  });

  const [accentHoverColor, setAccentHoverColor] = useState<string>(() => {
    const savedAccent = localStorage.getItem('cb_accent_color') || '#6366f1';
    return localStorage.getItem('cb_accent_hover_color') || computeAutoHoverColor(savedAccent);
  });

  const [bgColor, setBgColor] = useState<string>(() => {
    const mode = (localStorage.getItem('theme') as 'dark' | 'light' | 'system') || 'dark';
    return getSavedBgColor(mode);
  });

  const [appOpacity, setAppOpacity] = useState<number>(() => {
    return parseInt(localStorage.getItem('cb_app_opacity') || '100', 10);
  });

  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');

  // Typography state
  const [typography, setTypography] = useState<FontTypographySettings>(getSavedTypography);
  const [fontList, setFontList] = useState<{ ui: string[]; mono: string[] }>({ ui: [], mono: [] });
  const [uiFontSearch, setUiFontSearch] = useState(typography.uiFont);
  const [monoFontSearch, setMonoFontSearch] = useState(typography.monoFont);
  const [uiFontDropdownOpen, setUiFontDropdownOpen] = useState(false);
  const [monoFontDropdownOpen, setMonoFontDropdownOpen] = useState(false);
  const [googleFontInput, setGoogleFontInput] = useState('');
  const [fontStatus, setFontStatus] = useState<string | null>(null);

  // SQL Theme state
  const [sqlColors, setSqlColors] = useState<SqlThemeColors>(getSavedSqlTheme);
  const [sqlPresetId, setSqlPresetId] = useState<string>(getSavedSqlThemePresetId);

  const toolbarDisplayStyle = store ? store((s) => s.toolbarDisplayStyle) : 'both';
  const setToolbarDisplayStyle = store ? store((s) => s.setToolbarDisplayStyle) : () => {};

  const [themeStatus, setThemeStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [themeImportError, setThemeImportError] = useState<string | null>(null);

  const uiDropdownRef = useRef<HTMLDivElement>(null);
  const monoDropdownRef = useRef<HTMLDivElement>(null);
  const uiInputRef = useRef<HTMLInputElement>(null);
  const monoInputRef = useRef<HTMLInputElement>(null);

  const getSelectionHex = (sel: string) => {
    if (sel.startsWith('#')) return sel.slice(0, 7);
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(sel);
    if (m && m[1] && m[2] && m[3]) {
      const r = parseInt(m[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(m[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(m[3], 10).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    return '#6366f1';
  };

  // Load available system & custom fonts on modal open
  useEffect(() => {
    if (isOpen) {
      void getAvailableFonts().then(setFontList);
      setTypography(getSavedTypography());
      setSqlColors(getSavedSqlTheme());
      setSqlPresetId(getSavedSqlThemePresetId());
    }
  }, [isOpen]);

  // Close font dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (uiDropdownRef.current && !uiDropdownRef.current.contains(e.target as Node)) {
        setUiFontDropdownOpen(false);
      }
      if (monoDropdownRef.current && !monoDropdownRef.current.contains(e.target as Node)) {
        setMonoFontDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleAccentChange = (hex: string) => {
    setAccentColor(hex);
    const autoHover = computeAutoHoverColor(hex);
    setAccentHoverColor(autoHover);
    applyAccent(hex, autoHover);
  };

  const handleAccentHoverChange = (hex: string) => {
    setAccentHoverColor(hex);
    applyAccent(accentColor, hex);
  };

  const handleBgChange = (hex: string) => {
    setBgColor(hex);
    applyBgColor(hex, themeMode);
  };

  const handleThemeModeSwitch = (mode: 'dark' | 'light' | 'system') => {
    setThemeMode(mode);
    document.documentElement.setAttribute('data-theme', mode);
    const savedForMode = getSavedBgColor(mode);
    setBgColor(savedForMode);
    applyBgColor(savedForMode, mode);
  };

  const handleOpacityChange = (val: number) => {
    setAppOpacity(val);
    applyAppOpacity(val);
  };

  // Typography Handlers
  const handleTypographyChange = (partial: Partial<FontTypographySettings>) => {
    const updated = { ...typography, ...partial };
    setTypography(updated);
    applyFontSettings(updated);
  };

  const handleSelectUiFont = (fontName: string) => {
    setUiFontSearch(fontName);
    setUiFontDropdownOpen(false);
    handleTypographyChange({ uiFont: fontName });
  };

  const handleSelectMonoFont = (fontName: string) => {
    setMonoFontSearch(fontName);
    setMonoFontDropdownOpen(false);
    handleTypographyChange({ monoFont: fontName });
  };

  const handleImportGoogleFont = async () => {
    if (!googleFontInput.trim()) return;
    setFontStatus('Loading Google Font…');
    const res = await importGoogleFont(googleFontInput.trim());
    if (res.ok) {
      setFontStatus(`✅ Loaded Google Font "${res.family}"`);
      const updated = await getAvailableFonts();
      setFontList(updated);
      handleTypographyChange({ monoFont: res.family });
      setMonoFontSearch(res.family);
      setGoogleFontInput('');
    } else {
      setFontStatus(`❌ Error: ${res.error}`);
    }
  };

  const handleUploadLocalFont = async (file: File | undefined) => {
    if (!file) return;
    setFontStatus(`Registering font ${file.name}…`);
    const res = await uploadLocalFontFile(file);
    if (res.ok) {
      setFontStatus(`✅ Installed local font "${res.family}"`);
      const updated = await getAvailableFonts();
      setFontList(updated);
      handleTypographyChange({ monoFont: res.family });
      setMonoFontSearch(res.family);
    } else {
      setFontStatus(`❌ Error: ${res.error}`);
    }
  };

  // SQL Theme Handlers
  const handleSqlColorChange = (key: keyof SqlThemeColors, val: string) => {
    const updated = { ...sqlColors, [key]: val };
    setSqlColors(updated);
    setSqlPresetId('custom');
    applySqlTheme(updated, 'custom');
  };

  const handleSelectSqlPreset = (presetId: string) => {
    const preset = SQL_THEME_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setSqlPresetId(preset.id);
      setSqlColors(preset.colors);
      applySqlTheme(preset.colors, preset.id);
    }
  };

  const handleSave = () => {
    localStorage.setItem('theme', themeMode);
    document.documentElement.setAttribute('data-theme', themeMode);
    document.documentElement.setAttribute('data-density', density);

    applyAccent(accentColor, accentHoverColor);
    applyBgColor(bgColor, themeMode);
    applyAppOpacity(appOpacity);
    applyFontSettings(typography);
    applySqlTheme(sqlColors, sqlPresetId);
    onClose();
  };

  const handleThemeExport = () => {
    localStorage.setItem('theme', themeMode);
    localStorage.setItem('cb_accent_color', accentColor);
    localStorage.setItem('cb_accent_hover_color', accentHoverColor);
    applyBgColor(bgColor, themeMode);
    applyAppOpacity(appOpacity);
    applyFontSettings(typography);
    applySqlTheme(sqlColors, sqlPresetId);

    downloadThemeProfile();
    setThemeStatus({ ok: true, message: 'Theme & Typography profile exported successfully' });
  };

  const handleThemeImportFile = async (file: File | undefined) => {
    if (!file) return;
    setThemeImportError(null);
    const res = await loadThemeProfileFromFile(file);
    if (res.ok) {
      const mode = (localStorage.getItem('theme') as 'dark' | 'light' | 'system') || 'dark';
      setThemeMode(mode);
      setAccentColor(localStorage.getItem('cb_accent_color') || '#6366f1');
      setAccentHoverColor(localStorage.getItem('cb_accent_hover_color') || '#818cf8');
      setBgColor(getSavedBgColor(mode));
      setAppOpacity(parseInt(localStorage.getItem('cb_app_opacity') || '100', 10));
      setTypography(getSavedTypography());
      setSqlColors(getSavedSqlTheme());
      setSqlPresetId(getSavedSqlThemePresetId());
      setThemeStatus({ ok: true, message: 'Theme profile imported successfully' });
    } else {
      setThemeImportError(res.error || 'Failed to import theme');
    }
  };

  const currentBgPresets = themeMode === 'light' ? PRESET_LIGHT_BG_THEMES : PRESET_DARK_BG_THEMES;

  // Filter font lists
  const filteredUiFonts = fontList.ui.filter((f) =>
    f.toLowerCase().includes(uiFontSearch.toLowerCase())
  );
  const filteredMonoFonts = fontList.mono.filter((f) =>
    f.toLowerCase().includes(monoFontSearch.toLowerCase())
  );

  // Live SQL preview sample
  const sampleSql = `SELECT u.id, u.username, count(o.id) AS total_orders\nFROM users u\nJOIN orders o ON o.user_id = u.id\nWHERE u.status = 'active' AND u.points >= 100\n-- Filter by active tier\nGROUP BY u.id, u.username\nORDER BY total_orders DESC\nLIMIT 50;`;
  const sampleHighlighted = highlightSql(sampleSql);

  return (
    <div className="cb-modal-overlay" onClick={onClose}>
      <div className="cb-modal" style={{ maxWidth: 840, maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="cb-modal-header">
          <div className="cb-modal-title">⚙️ Theme, Typography & SQL IDE Settings</div>
          <button className="cb-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="cb-modal-body" style={{ overflowY: 'auto' }}>
          <div className="cb-form-grid">
            {/* Theme Mode */}
            <div className="cb-form-group">
              <label className="cb-label">Theme Mode</label>
              <select
                className="cb-select"
                value={themeMode}
                onChange={(e) => {
                  const mode = e.target.value as 'dark' | 'light' | 'system';
                  handleThemeModeSwitch(mode);
                }}
              >
                <option value="dark">🌙 Dark Mode</option>
                <option value="light">☀️ Light Mode</option>
                <option value="system">💻 System Sync</option>
              </select>
            </div>

            {/* Accent Color Picker */}
            <div className="cb-form-group">
              <label className="cb-label">Accent Color (Auto Adjusts Hover Shade)</label>
              <div className="cb-accent-picker-row">
                <input
                  type="color"
                  className="cb-color-picker-native"
                  value={accentColor}
                  onChange={(e) => handleAccentChange(e.target.value)}
                  title="Click to open dynamic color picker"
                />
                <input
                  type="text"
                  className="cb-input cb-color-hex-input"
                  value={accentColor}
                  onChange={(e) => handleAccentChange(e.target.value)}
                  placeholder="#6366f1"
                />
                <div className="cb-accent-swatches">
                  {PRESET_ACCENT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`cb-accent-swatch ${accentColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => handleAccentChange(color)}
                      title={`Select ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Accent Hover Color Picker */}
            <div className="cb-form-group">
              <label className="cb-label">Accent Hover Color (Custom Hover Override)</label>
              <div className="cb-accent-picker-row">
                <input
                  type="color"
                  className="cb-color-picker-native"
                  value={accentHoverColor}
                  onChange={(e) => handleAccentHoverChange(e.target.value)}
                  title="Click to pick custom accent hover color"
                />
                <input
                  type="text"
                  className="cb-input cb-color-hex-input"
                  value={accentHoverColor}
                  onChange={(e) => handleAccentHoverChange(e.target.value)}
                  placeholder="#818cf8"
                />
                <button
                  type="button"
                  className="cb-button cb-button-xs"
                  onClick={() => handleAccentHoverChange(computeAutoHoverColor(accentColor))}
                  title="Reset hover shade to auto-calculated value"
                >
                  ⚡ Auto-Calculate Hover
                </button>
              </div>
            </div>

            {/* Background Color Presets */}
            <div className="cb-form-group">
              <label className="cb-label">
                Application Background Base Color ({themeMode === 'light' ? 'Light Mode Presets' : 'Dark Mode Presets'})
              </label>
              <div className="cb-accent-picker-row">
                <input
                  type="color"
                  className="cb-color-picker-native"
                  value={bgColor}
                  onChange={(e) => handleBgChange(e.target.value)}
                  title="Click to select custom base background color"
                />
                <input
                  type="text"
                  className="cb-input cb-color-hex-input"
                  value={bgColor}
                  onChange={(e) => handleBgChange(e.target.value)}
                  placeholder="#0f1222"
                />
                <div className="cb-bg-presets">
                  {currentBgPresets.map((themeItem) => (
                    <button
                      key={themeItem.hex}
                      type="button"
                      className={`cb-bg-preset-btn ${bgColor === themeItem.hex ? 'active' : ''}`}
                      style={{ backgroundColor: themeItem.hex }}
                      onClick={() => handleBgChange(themeItem.hex)}
                      title={themeItem.name}
                    >
                      {themeItem.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Opacity & Density */}
            <div className="cb-font-grid">
              <div className="cb-form-group">
                <label className="cb-label">Layout Opacity</label>
                <div className="cb-slider-wrapper">
                  <button
                    type="button"
                    className="cb-stepper-btn"
                    disabled={appOpacity <= 40}
                    onClick={() => handleOpacityChange(Math.max(40, appOpacity - 5))}
                    title="Decrease opacity"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={40}
                    max={100}
                    step={5}
                    className="cb-range-slider"
                    value={appOpacity}
                    onChange={(e) => handleOpacityChange(Number(e.target.value))}
                  />
                  <button
                    type="button"
                    className="cb-stepper-btn"
                    disabled={appOpacity >= 100}
                    onClick={() => handleOpacityChange(Math.min(100, appOpacity + 5))}
                    title="Increase opacity"
                  >
                    +
                  </button>
                  <span className="cb-slider-badge">{appOpacity}%</span>
                </div>
              </div>
              <div className="cb-form-group">
                <label className="cb-label">Grid Density</label>
                <select
                  className="cb-select"
                  value={density}
                  onChange={(e) => setDensity(e.target.value as 'compact' | 'comfortable')}
                >
                  <option value="compact">Compact (High density, smaller rows)</option>
                  <option value="comfortable">Comfortable (Standard padding)</option>
                </select>
              </div>
            </div>

            <div className="cb-form-group">
              <label className="cb-label">Toolbar Menu Style</label>
              <select
                className="cb-select"
                value={toolbarDisplayStyle}
                onChange={(e) => setToolbarDisplayStyle(e.target.value as 'both' | 'icon' | 'text')}
              >
                <option value="both">Icon + Text Label (Default)</option>
                <option value="icon">Icon Only (Compact mode)</option>
                <option value="text">Text Label Only</option>
              </select>
            </div>

            {/* =========================================================================
                SECTION 2: TYPOGRAPHY & FONT MANAGEMENT (SEARCH, GOOGLE, UPLOAD, SIZES)
               ========================================================================= */}
            <div className="cb-settings-section">
              <div className="cb-settings-section-title">
                <span>🔤 Font Family & Typography Settings</span>
              </div>

              {/* Font Family Pickers with Autocomplete & Clear Button */}
              <div className="cb-font-grid">
                {/* UI Font Selector */}
                <div className="cb-form-group" ref={uiDropdownRef}>
                  <label className="cb-label">UI Font Family (Searchable Autocomplete)</label>
                  <div className="cb-font-combobox">
                    <div className="cb-search-input-wrap">
                      <input
                        ref={uiInputRef}
                        className="cb-input"
                        value={uiFontSearch}
                        onChange={(e) => {
                          setUiFontSearch(e.target.value);
                          setUiFontDropdownOpen(true);
                        }}
                        onFocus={() => setUiFontDropdownOpen(true)}
                        placeholder="Search UI font (e.g. Inter, Segoe UI, Roboto)"
                      />
                      {uiFontSearch.length > 0 && (
                        <button
                          type="button"
                          className="cb-input-clear-btn"
                          onClick={() => {
                            setUiFontSearch('');
                            setUiFontDropdownOpen(true);
                            uiInputRef.current?.focus();
                          }}
                          title="Clear and show all fonts"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {uiFontDropdownOpen && (
                      <div className="cb-font-dropdown">
                        {filteredUiFonts.slice(0, 40).map((f) => (
                          <button
                            key={f}
                            type="button"
                            className={`cb-font-option ${typography.uiFont === f ? 'is-selected' : ''}`}
                            style={{ fontFamily: f }}
                            onClick={() => handleSelectUiFont(f)}
                          >
                            <span>{f}</span>
                            <span className="text-xs text-muted" style={{ fontStyle: 'normal' }}>Sample</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Code / Mono Font Selector */}
                <div className="cb-form-group" ref={monoDropdownRef}>
                  <label className="cb-label">Code / Mono Font Family (Searchable Autocomplete)</label>
                  <div className="cb-font-combobox">
                    <div className="cb-search-input-wrap">
                      <input
                        ref={monoInputRef}
                        className="cb-input"
                        value={monoFontSearch}
                        onChange={(e) => {
                          setMonoFontSearch(e.target.value);
                          setMonoFontDropdownOpen(true);
                        }}
                        onFocus={() => setMonoFontDropdownOpen(true)}
                        placeholder="Search mono font (e.g. JetBrains Mono, Fira Code)"
                      />
                      {monoFontSearch.length > 0 && (
                        <button
                          type="button"
                          className="cb-input-clear-btn"
                          onClick={() => {
                            setMonoFontSearch('');
                            setMonoFontDropdownOpen(true);
                            monoInputRef.current?.focus();
                          }}
                          title="Clear and show all fonts"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {monoFontDropdownOpen && (
                      <div className="cb-font-dropdown">
                        {filteredMonoFonts.slice(0, 40).map((f) => (
                          <button
                            key={f}
                            type="button"
                            className={`cb-font-option ${typography.monoFont === f ? 'is-selected' : ''}`}
                            style={{ fontFamily: f }}
                            onClick={() => handleSelectMonoFont(f)}
                          >
                            <span>{f}</span>
                            <span className="text-xs text-muted" style={{ fontStyle: 'normal' }}>Mono</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Google Fonts & Local Font Upload Row */}
              <div className="cb-form-row" style={{ gap: 12, alignItems: 'flex-start' }}>
                {/* Google Fonts Importer */}
                <div className="cb-form-group flex-1">
                  <label className="cb-label">Import from Google Fonts / Web URL</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <div className="cb-search-input-wrap">
                      <input
                        className="cb-input"
                        value={googleFontInput}
                        onChange={(e) => setGoogleFontInput(e.target.value)}
                        placeholder="e.g. Fira Code, Poppins, or Google Fonts URL"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleImportGoogleFont();
                        }}
                      />
                      {googleFontInput.length > 0 && (
                        <button
                          type="button"
                          className="cb-input-clear-btn"
                          onClick={() => setGoogleFontInput('')}
                          title="Clear input"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className="cb-button cb-button-primary"
                      style={{ padding: '6px 14px', whiteSpace: 'nowrap', flexShrink: 0, height: 32, fontSize: 12.5 }}
                      onClick={() => void handleImportGoogleFont()}
                      disabled={!googleFontInput.trim()}
                    >
                      Fetch Font
                    </button>
                  </div>
                </div>

                {/* Local Font Uploader */}
                <div className="cb-form-group" style={{ minWidth: 220 }}>
                  <label className="cb-label">Upload Font from PC (.ttf, .otf, .woff)</label>
                  <label
                    className="cb-button cb-button-secondary"
                    style={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 32,
                      fontSize: 12.5,
                      gap: 6,
                      width: '100%',
                    }}
                  >
                    📁 Upload Local Font File
                    <input
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2,font/*"
                      style={{ display: 'none' }}
                      onChange={(e) => void handleUploadLocalFont(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>

              {fontStatus && (
                <div className="cb-alert cb-alert-success" style={{ padding: '6px 12px', fontSize: 12 }}>
                  {fontStatus}
                </div>
              )}

              {/* Typography Row 1: UI Font Size & Weight */}
              <div className="cb-font-grid">
                {/* UI Font Size with Steppers & Range Bar */}
                <div className="cb-form-group">
                  <label className="cb-label">UI Font Size</label>
                  <div className="cb-slider-wrapper">
                    <button
                      type="button"
                      className="cb-stepper-btn"
                      disabled={typography.uiFontSize <= 11}
                      onClick={() => handleTypographyChange({ uiFontSize: Math.max(11, typography.uiFontSize - 1) })}
                      title="Decrease font size"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min={11}
                      max={18}
                      step={1}
                      className="cb-range-slider"
                      value={typography.uiFontSize}
                      onChange={(e) => handleTypographyChange({ uiFontSize: Number(e.target.value) })}
                    />
                    <button
                      type="button"
                      className="cb-stepper-btn"
                      disabled={typography.uiFontSize >= 18}
                      onClick={() => handleTypographyChange({ uiFontSize: Math.min(18, typography.uiFontSize + 1) })}
                      title="Increase font size"
                    >
                      +
                    </button>
                    <span className="cb-slider-badge">{typography.uiFontSize}px</span>
                  </div>
                </div>

                <div className="cb-form-group">
                  <label className="cb-label">UI Font Weight</label>
                  <select
                    className="cb-select"
                    value={typography.uiFontWeight}
                    onChange={(e) => handleTypographyChange({ uiFontWeight: e.target.value })}
                  >
                    <option value="300">300 (Light)</option>
                    <option value="400">400 (Regular)</option>
                    <option value="500">500 (Medium)</option>
                    <option value="600">600 (Semi-Bold)</option>
                    <option value="700">700 (Bold)</option>
                  </select>
                </div>
              </div>

              {/* Typography Row 2: Code / Mono Font Size, Weight & Style */}
              <div className="cb-font-grid">
                {/* Code Font Size with Steppers & Range Bar */}
                <div className="cb-form-group">
                  <label className="cb-label">Code Font Size</label>
                  <div className="cb-slider-wrapper">
                    <button
                      type="button"
                      className="cb-stepper-btn"
                      disabled={typography.monoFontSize <= 11}
                      onClick={() => handleTypographyChange({ monoFontSize: Math.max(11, typography.monoFontSize - 1) })}
                      title="Decrease code font size"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min={11}
                      max={22}
                      step={1}
                      className="cb-range-slider"
                      value={typography.monoFontSize}
                      onChange={(e) => handleTypographyChange({ monoFontSize: Number(e.target.value) })}
                    />
                    <button
                      type="button"
                      className="cb-stepper-btn"
                      disabled={typography.monoFontSize >= 22}
                      onClick={() => handleTypographyChange({ monoFontSize: Math.min(22, typography.monoFontSize + 1) })}
                      title="Increase code font size"
                    >
                      +
                    </button>
                    <span className="cb-slider-badge">{typography.monoFontSize}px</span>
                  </div>
                </div>

                <div className="cb-form-group">
                  <label className="cb-label">Code Font Weight & Style</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      className="cb-select"
                      style={{ flex: 1 }}
                      value={typography.monoFontWeight}
                      onChange={(e) => handleTypographyChange({ monoFontWeight: e.target.value })}
                    >
                      <option value="400">400 (Regular)</option>
                      <option value="500">500 (Medium)</option>
                      <option value="600">600 (Semi-Bold)</option>
                      <option value="700">700 (Bold)</option>
                    </select>
                    <select
                      className="cb-select"
                      style={{ flex: 1 }}
                      value={typography.monoFontStyle}
                      onChange={(e) => handleTypographyChange({ monoFontStyle: e.target.value as 'normal' | 'italic' })}
                    >
                      <option value="normal">Normal Style</option>
                      <option value="italic">Italic Style</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* =========================================================================
                SECTION 3: SQL QUERY SYNTAX HIGHLIGHT COLOR CUSTOMIZER (IDE FORMAT)
               ========================================================================= */}
            <div className="cb-settings-section">
              <div className="cb-settings-section-title">
                <span>🎨 SQL Query Syntax Highlight & Color Customizer</span>
              </div>

              {/* SQL Theme Preset Dropdown */}
              <div className="cb-form-group">
                <label className="cb-label">SQL Theme Preset</label>
                <select
                  className="cb-select"
                  value={sqlPresetId}
                  onChange={(e) => handleSelectSqlPreset(e.target.value)}
                >
                  {SQL_THEME_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                  {sqlPresetId === 'custom' && <option value="custom">Custom (User Modified)</option>}
                </select>
              </div>

              {/* SQL Syntax Color Swatches: Exactly 8 items in a balanced 4x2 grid */}
              <div className="cb-sql-color-grid">
                {/* Row 1: 4 items */}
                <div className="cb-sql-color-item">
                  <span>Keywords</span>
                  <div className="cb-color-input-wrap">
                    <input
                      type="color"
                      value={sqlColors.keyword}
                      onChange={(e) => handleSqlColorChange('keyword', e.target.value)}
                    />
                    <span className="text-xs" style={{ color: sqlColors.keyword, fontWeight: 600 }}>
                      SELECT
                    </span>
                  </div>
                </div>

                <div className="cb-sql-color-item">
                  <span>Functions</span>
                  <div className="cb-color-input-wrap">
                    <input
                      type="color"
                      value={sqlColors.function}
                      onChange={(e) => handleSqlColorChange('function', e.target.value)}
                    />
                    <span className="text-xs" style={{ color: sqlColors.function }}>
                      COUNT()
                    </span>
                  </div>
                </div>

                <div className="cb-sql-color-item">
                  <span>Strings</span>
                  <div className="cb-color-input-wrap">
                    <input
                      type="color"
                      value={sqlColors.string}
                      onChange={(e) => handleSqlColorChange('string', e.target.value)}
                    />
                    <span className="text-xs" style={{ color: sqlColors.string }}>
                      'active'
                    </span>
                  </div>
                </div>

                <div className="cb-sql-color-item">
                  <span>Numbers</span>
                  <div className="cb-color-input-wrap">
                    <input
                      type="color"
                      value={sqlColors.number}
                      onChange={(e) => handleSqlColorChange('number', e.target.value)}
                    />
                    <span className="text-xs" style={{ color: sqlColors.number }}>
                      100
                    </span>
                  </div>
                </div>

                {/* Row 2: 4 items */}
                <div className="cb-sql-color-item">
                  <span>Comments</span>
                  <div className="cb-color-input-wrap">
                    <input
                      type="color"
                      value={sqlColors.comment}
                      onChange={(e) => handleSqlColorChange('comment', e.target.value)}
                    />
                    <span className="text-xs" style={{ color: sqlColors.comment, fontStyle: 'italic' }}>
                      -- note
                    </span>
                  </div>
                </div>

                <div className="cb-sql-color-item">
                  <span>Operators</span>
                  <div className="cb-color-input-wrap">
                    <input
                      type="color"
                      value={sqlColors.operator}
                      onChange={(e) => handleSqlColorChange('operator', e.target.value)}
                    />
                    <span className="text-xs" style={{ color: sqlColors.operator }}>
                      &gt;=
                    </span>
                  </div>
                </div>

                <div className="cb-sql-color-item">
                  <span>Identifiers</span>
                  <div className="cb-color-input-wrap">
                    <input
                      type="color"
                      value={sqlColors.identifier}
                      onChange={(e) => handleSqlColorChange('identifier', e.target.value)}
                    />
                    <span className="text-xs" style={{ color: sqlColors.identifier }}>
                      users
                    </span>
                  </div>
                </div>

                <div className="cb-sql-color-item">
                  <span>Selection</span>
                  <div className="cb-color-input-wrap">
                    <input
                      type="color"
                      value={getSelectionHex(sqlColors.selection)}
                      onChange={(e) => handleSqlColorChange('selection', `${e.target.value}55`)}
                    />
                    <span className="text-xs" style={{ color: getSelectionHex(sqlColors.selection), fontWeight: 600 }}>
                      Highlight
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Interactive SQL Preview */}
              <div className="cb-form-group">
                <label className="cb-label">Live SQL Syntax Preview</label>
                <div
                  className="cb-sql-preview-box"
                  dangerouslySetInnerHTML={{ __html: sampleHighlighted }}
                />
              </div>
            </div>

            {/* Theme Profile JSON (PRD-NFR-01) */}
            <div className="cb-form-group">
              <label className="cb-label">Theme & Typography Profile (JSON Save / Load)</label>
              <div className="cb-accent-picker-row">
                <button
                  type="button"
                  className="cb-button"
                  onClick={handleThemeExport}
                  title="Download complete theme & font profile as JSON"
                >
                  ⬇️ Export Full Theme Profile
                </button>
                <label className="cb-button cb-button-secondary" style={{ cursor: 'pointer' }}>
                  ⬆️ Import Theme Profile
                  <input
                    type="file"
                    accept="application/json,.json"
                    style={{ display: 'none' }}
                    onChange={(e) => void handleThemeImportFile(e.target.files?.[0])}
                  />
                </label>
              </div>
              {themeStatus && (
                <div className={`cb-alert ${themeStatus.ok ? 'cb-alert-success' : 'cb-alert-error'}`}>
                  {themeStatus.message}
                </div>
              )}
              {themeImportError && <div className="cb-alert cb-alert-error">{themeImportError}</div>}
            </div>
          </div>
        </div>

        <div className="cb-modal-footer">
          <button className="cb-button" onClick={onClose}>
            Cancel
          </button>
          <button className="cb-button cb-button-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
