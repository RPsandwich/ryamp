import { useState, useEffect, useCallback } from 'react';
import Database from '@tauri-apps/plugin-sql';
import { DEFAULT_THEME, type ThemeColors } from '../theme/defaultTheme';

export interface SavedTheme {
  id: number;
  name: string;
  colors: ThemeColors;
}

const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  bg: '--color-bg',
  sidebarBg: '--color-sidebar-bg',
  text: '--color-text',
  textMuted: '--color-text-muted',
  accent: '--color-accent',
  accentBg: '--color-accent-bg',
  buttonBg: '--color-button-bg',
  buttonText: '--color-button-text',
  border: '--color-border',
  rowHighlight: '--color-row-highlight',
  visualizerBg: '--color-visualizer-bg',
  danger: '--color-danger',
};

const applyThemeToDocument = (colors: ThemeColors) => {
  const root = document.documentElement;
  (Object.keys(colors) as (keyof ThemeColors)[]).forEach((key) => {
    root.style.setProperty(CSS_VAR_MAP[key], colors[key]);
  });
};

interface ThemeRow {
  id: number;
  name: string;
  color_bg: string;
  color_sidebar_bg: string;
  color_text: string;
  color_text_muted: string;
  color_accent: string;
  color_accent_bg: string;
  color_button_bg: string;
  color_button_text: string;
  color_border: string;
  color_row_highlight: string;
  color_visualizer_bg: string;
  color_danger: string;
}

export function useTheme() {
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>([]);
  const [activeThemeId, setActiveThemeId] = useState<number | null>(null);

  const loadThemes = useCallback(async () => {
    const db = await Database.load('sqlite:ryamp.db');
    const rows = await db.select<ThemeRow[]>('SELECT * FROM themes ORDER BY created_at');
    setSavedThemes(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        colors: {
          bg: r.color_bg,
          sidebarBg: r.color_sidebar_bg,
          text: r.color_text,
          textMuted: r.color_text_muted,
          accent: r.color_accent,
          accentBg: r.color_accent_bg,
          buttonBg: r.color_button_bg,
          buttonText: r.color_button_text,
          border: r.color_border,
          rowHighlight: r.color_row_highlight,
          visualizerBg: r.color_visualizer_bg,
          danger: r.color_danger,
        },
      }))
    );
  }, []);

  useEffect(() => {
    applyThemeToDocument(DEFAULT_THEME);
    loadThemes();
  }, [loadThemes]);

  const applyTheme = useCallback((theme: SavedTheme | null) => {
    setActiveThemeId(theme?.id ?? null);
    applyThemeToDocument(theme?.colors ?? DEFAULT_THEME);
  }, []);

  const saveTheme = useCallback(
    async (name: string, colors: ThemeColors) => {
      const db = await Database.load('sqlite:ryamp.db');
      await db.execute(
        `INSERT INTO themes (
          name, color_bg, color_sidebar_bg, color_text, color_text_muted,
          color_accent, color_accent_bg, color_button_bg, color_button_text,
          color_border, color_row_highlight, color_visualizer_bg, color_danger
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          name,
          colors.bg,
          colors.sidebarBg,
          colors.text,
          colors.textMuted,
          colors.accent,
          colors.accentBg,
          colors.buttonBg,
          colors.buttonText,
          colors.border,
          colors.rowHighlight,
          colors.visualizerBg,
          colors.danger,
        ]
      );
      await loadThemes();
    },
    [loadThemes]
  );

  return { savedThemes, activeThemeId, applyTheme, saveTheme };
}