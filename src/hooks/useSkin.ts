import { useCallback, useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { THEMES, type ThemeColors, type ThemePreset } from '../skins/themes';

// Maps each ThemeColors key to the actual CSS custom property it drives.
// Every component already reads these variables (see index.css), so
// applying a theme is just re-setting them on the root element.
const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  accentMagenta: '--accent-magenta',
  accentCyan: '--accent-cyan',
  accentViolet: '--accent-violet',
  borderViolet: '--border-violet',
  bgVoid: '--bg-void',
  bgPanel: '--bg-panel',
  bgPanelRaised: '--bg-panel-raised',
  bgScreen: '--bg-screen',
  glowMagenta: '--glow-magenta',
  glowCyan: '--glow-cyan',
};

function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function applyTheme(theme: ThemePreset) {
  const root = document.documentElement.style;
  (Object.keys(theme.colors) as Array<keyof ThemeColors>).forEach((key) => {
    root.setProperty(CSS_VAR_MAP[key], theme.colors[key]);
  });

  // A few hover/glow overlays in index.css use rgba(var(--x-rgb), alpha)
  // rather than the hex variables directly (rgba() needs raw r,g,b), so
  // those need to be kept in sync separately here.
  root.setProperty('--accent-magenta-rgb', hexToRgbTriplet(theme.colors.accentMagenta));
  root.setProperty('--accent-violet-rgb', hexToRgbTriplet(theme.colors.accentViolet));
}

export function useSkin() {
  const [themeId, setThemeId] = useState<string>(THEMES[0].id);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  // Re-applies whenever the selected theme changes. Not persisted yet --
  // resets to the default (cyberpunk) on every app launch. Worth adding
  // localStorage or a small settings file in a follow-up if that's annoying.
  useEffect(() => {
    const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
    applyTheme(theme);
  }, [themeId]);

  const pickAvatarImage = useCallback(async () => {
    const filePath = await open({
      multiple: false,
      title: 'Select an avatar skin image',
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    });

    if (typeof filePath === 'string') {
      // convertFileSrc turns an absolute filesystem path into a URL the
      // webview is actually allowed to load as an <img src>, same asset
      // protocol used elsewhere in the app.
      setAvatarSrc(convertFileSrc(filePath));
    }
  }, []);

  const clearAvatar = useCallback(() => setAvatarSrc(null), []);

  return {
    themes: THEMES,
    themeId,
    setThemeId,
    avatarSrc,
    pickAvatarImage,
    clearAvatar,
  };
}
