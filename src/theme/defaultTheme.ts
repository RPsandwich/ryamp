export interface ThemeColors {
  bg: string;
  sidebarBg: string;
  text: string;
  textMuted: string;
  accent: string;
  accentBg: string;
  buttonBg: string;
  buttonText: string;
  border: string;
  rowHighlight: string;
  visualizerBg: string;
  danger: string;
}

export const THEME_COLOR_KEYS: { key: keyof ThemeColors; label: string }[] = [
  { key: 'bg', label: 'Background' },
  { key: 'sidebarBg', label: 'Sidebar Background' },
  { key: 'text', label: 'Primary Text' },
  { key: 'textMuted', label: 'Secondary Text' },
  { key: 'accent', label: 'Accent' },
  { key: 'accentBg', label: 'Accent Background' },
  { key: 'buttonBg', label: 'Button Background' },
  { key: 'buttonText', label: 'Button Text' },
  { key: 'border', label: 'Border' },
  { key: 'rowHighlight', label: 'Row Highlight' },
  { key: 'visualizerBg', label: 'Visualizer Background' },
  { key: 'danger', label: 'Danger / Delete' },
];

export const DEFAULT_THEME: ThemeColors = {
  bg: '#ffffff',
  sidebarBg: '#ffffff',
  text: '#000000',
  textMuted: '#666666',
  accent: '#4a6fd4',
  accentBg: '#dde3ff',
  buttonBg: '#f0f0f0',
  buttonText: '#000000',
  border: '#cccccc',
  rowHighlight: '#eeeeee',
  visualizerBg: '#111111',
  danger: '#c0392b',
};