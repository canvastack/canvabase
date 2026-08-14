/**
 * SQL Syntax Theming & Color Palette Management
 * Allows custom coloring of SQL keywords, functions, strings, numbers, comments, operators, and identifiers.
 */

export interface SqlThemeColors {
  keyword: string;
  function: string;
  string: string;
  number: string;
  comment: string;
  operator: string;
  identifier: string;
  selection: string;
}

export interface SqlThemePreset {
  id: string;
  name: string;
  colors: SqlThemeColors;
}

export const SQL_THEME_PRESETS: SqlThemePreset[] = [
  {
    id: 'canvabase-indigo',
    name: 'CanvaBase Indigo (Default)',
    colors: {
      keyword: '#818cf8', // Soft Indigo / Violet
      function: '#fbbf24', // Amber
      string: '#34d399', // Emerald
      number: '#f472b6', // Pink
      comment: '#6b7194', // Slate Muted
      operator: '#c084fc', // Purple
      identifier: '#e6e8f2', // Light primary
      selection: 'rgba(99, 102, 241, 0.35)',
    },
  },
  {
    id: 'vscode-dark-plus',
    name: 'VS Code Dark+ (Classic)',
    colors: {
      keyword: '#569cd6', // Blue
      function: '#dcdcaa', // Yellow/Khaki
      string: '#ce9178', // Orange-Brown
      number: '#b5cea8', // Pale Green
      comment: '#6a9955', // Forest Green
      operator: '#d4d4d4', // Off-white
      identifier: '#9cdcfe', // Sky Blue
      selection: 'rgba(38, 79, 120, 0.5)',
    },
  },
  {
    id: 'monokai-pro',
    name: 'Monokai Pro',
    colors: {
      keyword: '#ff6188', // Magenta / Pink
      function: '#78dce8', // Cyan
      string: '#ffd866', // Yellow
      number: '#ab9df2', // Purple
      comment: '#727072', // Dim Gray
      operator: '#ff6188', // Magenta
      identifier: '#fcfcfa', // Crisp White
      selection: 'rgba(255, 97, 136, 0.3)',
    },
  },
  {
    id: 'one-dark-pro',
    name: 'One Dark Pro (Atom)',
    colors: {
      keyword: '#c678dd', // Purple
      function: '#61afef', // Blue
      string: '#98c379', // Green
      number: '#d19a66', // Orange
      comment: '#5c6370', // Dark Gray
      operator: '#56b6c2', // Teal
      identifier: '#abb2bf', // Light Gray
      selection: 'rgba(61, 90, 128, 0.4)',
    },
  },
  {
    id: 'dracula-neon',
    name: 'Dracula / Cyberpunk Neon',
    colors: {
      keyword: '#ff79c6', // Hot Pink
      function: '#50fa7b', // Neon Green
      string: '#f1fa8c', // Light Yellow
      number: '#bd93f9', // Light Purple
      comment: '#6272a4', // Blue Gray
      operator: '#ffb86c', // Orange
      identifier: '#f8f8f2', // Off White
      selection: 'rgba(68, 71, 90, 0.6)',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    colors: {
      keyword: '#ff7b72', // Coral Red
      function: '#d2a8ff', // Violet
      string: '#a5d6ff', // Light Blue
      number: '#79c0ff', // Cyan
      comment: '#8b949e', // GitHub Gray
      operator: '#ff7b72', // Coral Red
      identifier: '#c9d1d9', // Bright Gray
      selection: 'rgba(56, 139, 253, 0.35)',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    colors: {
      keyword: '#859900', // Olive Green
      function: '#268bd2', // Blue
      string: '#2aa198', // Cyan
      number: '#d33682', // Magenta
      comment: '#586e75', // Gray Cyan
      operator: '#b58900', // Yellow
      identifier: '#839496', // Pale Gray
      selection: 'rgba(7, 54, 66, 0.6)',
    },
  },
  {
    id: 'light-clean-ide',
    name: 'Light Clean IDE',
    colors: {
      keyword: '#0000ff', // Blue
      function: '#795e26', // Brown
      string: '#a31515', // Dark Red
      number: '#098658', // Green
      comment: '#008000', // Forest Green
      operator: '#000000', // Black
      identifier: '#001080', // Deep Navy
      selection: 'rgba(173, 214, 255, 0.5)',
    },
  },
];

const SQL_THEME_STORAGE_KEY = 'cb_sql_theme_colors';
const SQL_THEME_PRESET_STORAGE_KEY = 'cb_sql_theme_preset_id';

export function getSavedSqlTheme(): SqlThemeColors {
  try {
    if (typeof localStorage === 'undefined') return { ...SQL_THEME_PRESETS[0]!.colors };
    const raw = localStorage.getItem(SQL_THEME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SqlThemeColors>;
      return { ...SQL_THEME_PRESETS[0]!.colors, ...parsed };
    }
  } catch {
    // fallback
  }
  return { ...SQL_THEME_PRESETS[0]!.colors };
}

export function getSavedSqlThemePresetId(): string {
  if (typeof localStorage === 'undefined') return 'canvabase-indigo';
  return localStorage.getItem(SQL_THEME_PRESET_STORAGE_KEY) || 'canvabase-indigo';
}

export function applySqlTheme(colors: SqlThemeColors, presetId?: string): void {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--sql-keyword-color', colors.keyword);
    root.style.setProperty('--sql-function-color', colors.function);
    root.style.setProperty('--sql-string-color', colors.string);
    root.style.setProperty('--sql-number-color', colors.number);
    root.style.setProperty('--sql-comment-color', colors.comment);
    root.style.setProperty('--sql-operator-color', colors.operator);
    root.style.setProperty('--sql-identifier-color', colors.identifier);
    root.style.setProperty('--sql-selection-color', colors.selection);
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SQL_THEME_STORAGE_KEY, JSON.stringify(colors));
    if (presetId) {
      localStorage.setItem(SQL_THEME_PRESET_STORAGE_KEY, presetId);
    }
  }
}

export function applySavedSqlTheme(): void {
  const colors = getSavedSqlTheme();
  const presetId = getSavedSqlThemePresetId();
  applySqlTheme(colors, presetId);
}
