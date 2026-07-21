import Database from '@tauri-apps/plugin-sql';
import type { ThemeColors, ThemePreset } from './themes';

// The subset of ThemeColors a person actually picks color-by-color in the
// theme creator. glowMagenta/glowCyan are deliberately excluded -- they're
// CSS box-shadow strings (not something a color wheel/native color input
// can produce), so they're derived automatically from accentMagenta/
// accentCyan instead (see buildGlow below), the same way the built-in
// presets in themes.ts were hand-derived.
export type EditableThemeColors = Omit<ThemeColors, 'glowMagenta' | 'glowCyan'>;

export const EDITABLE_COLOR_KEYS: { key: keyof EditableThemeColors; label: string }[] = [
  { key: 'accentMagenta', label: 'Accent (Primary)' },
  { key: 'accentCyan', label: 'Accent (Secondary)' },
  { key: 'accentViolet', label: 'Accent (Tertiary)' },
  { key: 'borderViolet', label: 'Border' },
  { key: 'bgVoid', label: 'Background (Void)' },
  { key: 'bgPanel', label: 'Background (Panel)' },
  { key: 'bgPanelRaised', label: 'Background (Panel Raised)' },
  { key: 'bgScreen', label: 'Background (LED Screen)' },
];

function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function buildGlow(hex: string): string {
  const rgb = hexToRgbTriplet(hex);
  return `0 0 6px rgba(${rgb}, 0.7), 0 0 16px rgba(${rgb}, 0.3)`;
}

function toThemeColors(editable: EditableThemeColors): ThemeColors {
  return {
    ...editable,
    glowMagenta: buildGlow(editable.accentMagenta),
    glowCyan: buildGlow(editable.accentCyan),
  };
}

interface CustomThemeRow {
  id: number;
  name: string;
  accent_magenta: string;
  accent_cyan: string;
  accent_violet: string;
  border_violet: string;
  bg_void: string;
  bg_panel: string;
  bg_panel_raised: string;
  bg_screen: string;
}

function rowToPreset(row: CustomThemeRow): ThemePreset {
  return {
    // Prefixed so a custom theme's id can never collide with a built-in
    // preset's id (e.g. 'cyberpunk'), since both lists get merged together
    // for the picker.
    id: `custom-${row.id}`,
    label: row.name,
    colors: toThemeColors({
      accentMagenta: row.accent_magenta,
      accentCyan: row.accent_cyan,
      accentViolet: row.accent_violet,
      borderViolet: row.border_violet,
      bgVoid: row.bg_void,
      bgPanel: row.bg_panel,
      bgPanelRaised: row.bg_panel_raised,
      bgScreen: row.bg_screen,
    }),
  };
}

export async function loadCustomThemes(): Promise<ThemePreset[]> {
  const db = await Database.load('sqlite:ryamp.db');
  const rows = await db.select<CustomThemeRow[]>('SELECT * FROM custom_themes ORDER BY created_at');
  return rows.map(rowToPreset);
}

export async function saveCustomTheme(name: string, colors: EditableThemeColors): Promise<ThemePreset> {
  const db = await Database.load('sqlite:ryamp.db');
  const result = await db.execute(
    `INSERT INTO custom_themes (
      name, accent_magenta, accent_cyan, accent_violet, border_violet,
      bg_void, bg_panel, bg_panel_raised, bg_screen
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      name,
      colors.accentMagenta,
      colors.accentCyan,
      colors.accentViolet,
      colors.borderViolet,
      colors.bgVoid,
      colors.bgPanel,
      colors.bgPanelRaised,
      colors.bgScreen,
    ]
  );

  return {
    id: `custom-${result.lastInsertId}`,
    label: name,
    colors: toThemeColors(colors),
  };
}

export async function deleteCustomTheme(id: string): Promise<void> {
  const numericId = id.replace(/^custom-/, '');
  const db = await Database.load('sqlite:ryamp.db');
  await db.execute('DELETE FROM custom_themes WHERE id = $1', [numericId]);
}
