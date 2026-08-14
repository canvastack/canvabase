import { useEffect, useState, type JSX } from 'react';
import type { AppStore } from '../store';

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

export function isColorDark(hex: string): boolean {
  const { l } = hexToHsl(hex);
  return l < 50;
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

export function clearCustomBgColor() {
  document.documentElement.style.removeProperty('--bg-app');
  document.documentElement.style.removeProperty('--bg-surface');
  document.documentElement.style.removeProperty('--bg-surface-hover');
  document.documentElement.style.removeProperty('--bg-input');
  document.documentElement.style.removeProperty('--border');
  document.documentElement.style.removeProperty('--text-primary');
  document.documentElement.style.removeProperty('--text-secondary');
  document.documentElement.style.removeProperty('--text-muted');
  localStorage.removeItem('cb_dark_bg_color');
  localStorage.removeItem('cb_light_bg_color');
}

export function applyAppOpacity(percent: number) {
  const decimal = Math.max(0.4, Math.min(1, percent / 100));
  const blurPx = Math.round((1 - decimal) * 20);
  document.documentElement.style.setProperty('--cb-surface-opacity', String(decimal));
  document.documentElement.style.setProperty('--cb-glass-blur', `${blurPx}px`);
  localStorage.setItem('cb_app_opacity', String(percent));

  try {
    const electron = (window as unknown as { canvabase?: { events?: { emit: (channel: string, data: unknown) => void } } }).canvabase;
    electron?.events?.emit('canvabase:window:setOpacity', decimal);
  } catch {
    // browser test mode
  }
}

/** Profil tema yang bisa di-export/import sebagai JSON (PRD-NFR-01 theme save/load). */
export interface ThemeProfile {
  version: 1;
  name?: string;
  themeMode: 'dark' | 'light' | 'system';
  accentColor: string;
  accentHoverColor: string;
  bgColor: string;
  appOpacity: number;
  density: 'compact' | 'comfortable';
  uiFont: string;
  monoFont: string;
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
    density: 'comfortable',
    uiFont: 'Inter',
    monoFont: 'JetBrains Mono',
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

  if (profile.uiFont) localStorage.setItem('cb_ui_font', profile.uiFont);
  if (profile.monoFont) localStorage.setItem('cb_mono_font', profile.monoFont);
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
  const [uiFont, setUiFont] = useState('Inter');
  const [monoFont, setMonoFont] = useState('JetBrains Mono');

  const toolbarDisplayStyle = store ? store((s) => s.toolbarDisplayStyle) : 'both';
  const setToolbarDisplayStyle = store ? store((s) => s.setToolbarDisplayStyle) : () => {};

  const [themeStatus, setThemeStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [themeImportError, setThemeImportError] = useState<string | null>(null);

  const handleThemeExport = () => {
    // Simpan dulu state form ke localStorage agar profil sesuai tampilan saat ini.
    localStorage.setItem('theme', themeMode);
    localStorage.setItem('cb_accent_color', accentColor);
    localStorage.setItem('cb_accent_hover_color', accentHoverColor);
    applyBgColor(bgColor, themeMode);
    applyAppOpacity(appOpacity);
    localStorage.setItem('data-density', density);
    if (store) store.getState().setToolbarDisplayStyle(toolbarDisplayStyle);

    downloadThemeProfile();
    setThemeStatus({ ok: true, message: 'Theme profile exported' });
  };

  const handleThemeImportFile = async (file: File | undefined) => {
    if (!file) return;
    const result = await loadThemeProfileFromFile(file);
    if (result.ok) {
      // Refresh local state dari profil yang diimport.
      setThemeMode((localStorage.getItem('theme') as 'dark' | 'light' | 'system') || 'dark');
      setAccentColor(localStorage.getItem('cb_accent_color') || '#6366f1');
      setAccentHoverColor(localStorage.getItem('cb_accent_hover_color') || '#818cf8');
      setBgColor(getSavedBgColor((localStorage.getItem('theme') as 'dark' | 'light' | 'system') || 'dark'));
      setAppOpacity(parseInt(localStorage.getItem('cb_app_opacity') || '100', 10));
      const importedDensity = (localStorage.getItem('data-density') as 'compact' | 'comfortable') || 'comfortable';
      setDensity(importedDensity);
      document.documentElement.setAttribute('data-density', importedDensity);
      const importedToolbar = (localStorage.getItem('cb_toolbar_display_style') as 'both' | 'icon' | 'text') || 'both';
      if (store) store.getState().setToolbarDisplayStyle(importedToolbar);
      setThemeImportError(null);
      setThemeStatus({ ok: true, message: 'Theme profile imported & applied' });
    } else {
      setThemeStatus({ ok: false, message: result.error ?? 'Import failed' });
    }
  };

  // Sync initial state on modal open
  useEffect(() => {
    const savedAccent = localStorage.getItem('cb_accent_color') || '#6366f1';
    setAccentColor(savedAccent);
    const savedHover = localStorage.getItem('cb_accent_hover_color') || computeAutoHoverColor(savedAccent);
    setAccentHoverColor(savedHover);

    const savedBg = getSavedBgColor(themeMode);
    setBgColor(savedBg);

    const savedOpacity = parseInt(localStorage.getItem('cb_app_opacity') || '100', 10);
    setAppOpacity(savedOpacity);
  }, [isOpen, themeMode]);

  if (!isOpen) return null;

  const handleAccentChange = (hex: string) => {
    setAccentColor(hex);
    const autoHover = computeAutoHoverColor(hex);
    setAccentHoverColor(autoHover);
    applyAccent(hex, autoHover);
  };

  const handleAccentHoverChange = (hoverHex: string) => {
    setAccentHoverColor(hoverHex);
    applyAccent(accentColor, hoverHex);
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

  const handleSave = () => {
    localStorage.setItem('theme', themeMode);
    document.documentElement.setAttribute('data-theme', themeMode);
    document.documentElement.setAttribute('data-density', density);

    applyAccent(accentColor, accentHoverColor);
    applyBgColor(bgColor, themeMode);
    applyAppOpacity(appOpacity);
    onClose();
  };

  const currentBgPresets = themeMode === 'light' ? PRESET_LIGHT_BG_THEMES : PRESET_DARK_BG_THEMES;

  return (
    <div className="cb-modal-overlay" onClick={onClose}>
      <div className="cb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cb-modal-header">
          <div className="cb-modal-title">⚙️ Theme & Settings</div>
          <button className="cb-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="cb-modal-body">
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

            {/* Dynamic Accent Color Picker & Auto Hover */}
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

            {/* Custom Accent Hover Color Picker */}
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

            {/* Dynamic Application Background Base Color */}
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

            {/* Application Opacity Slider */}
            <div className="cb-form-group">
              <label className="cb-label">
                Application Layout Opacity: <strong className="highlight-text">{appOpacity}%</strong>
              </label>
              <div className="cb-opacity-slider-row">
                <span className="text-xs text-muted">40%</span>
                <input
                  type="range"
                  min={40}
                  max={100}
                  step={5}
                  className="cb-range-slider"
                  value={appOpacity}
                  onChange={(e) => handleOpacityChange(Number(e.target.value))}
                />
                <span className="text-xs text-muted">100% (Solid)</span>
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

            <div className="cb-form-group">
              <label className="cb-label">Result Grid Density</label>
              <select
                className="cb-select"
                value={density}
                onChange={(e) => setDensity(e.target.value as 'compact' | 'comfortable')}
              >
                <option value="compact">Compact (High density, smaller rows)</option>
                <option value="comfortable">Comfortable (Standard padding)</option>
              </select>
            </div>

            <div className="cb-form-row">
              <div className="cb-form-group flex-1">
                <label className="cb-label">UI Font</label>
                <input
                  className="cb-input"
                  value={uiFont}
                  onChange={(e) => setUiFont(e.target.value)}
                />
              </div>
              <div className="cb-form-group flex-1">
                <label className="cb-label">Code / Mono Font</label>
                <input
                  className="cb-input"
                  value={monoFont}
                  onChange={(e) => setMonoFont(e.target.value)}
                />
              </div>
            </div>

            {/* Theme Profile JSON (PRD-NFR-01) */}
            <div className="cb-form-group">
              <label className="cb-label">Theme Profile (JSON Save / Load)</label>
              <div className="cb-accent-picker-row">
                <button
                  type="button"
                  className="cb-button"
                  onClick={handleThemeExport}
                  title="Download current theme as JSON"
                >
                  ⬇️ Export Theme
                </button>
                <label className="cb-button cb-button-secondary" style={{ cursor: 'pointer' }}>
                  ⬆️ Import Theme
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

