import { useCallback, useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { THEMES, type ThemeColors, type ThemePreset } from '../skins/themes';

const THEME_STORAGE_KEY = 'ryamp.themeId';
const AVATAR_STORAGE_KEY = 'ryamp.avatarPath';

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

// localStorage can throw in some restricted embedding contexts (rare for a
// real desktop webview, but cheap to guard) -- these wrappers just make
// persistence best-effort rather than something that can crash the app.
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Persistence failed silently -- the choice still applies for this
    // session, it just won't survive a restart.
  }
}

function clearStorage(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function loadStoredThemeId(): string {
  const stored = readStorage(THEME_STORAGE_KEY);
  return stored && THEMES.some((t) => t.id === stored) ? stored : THEMES[0].id;
}

export function useSkin() {
  const [themeId, setThemeIdState] = useState<string>(loadStoredThemeId);
  const [avatarPath, setAvatarPath] = useState<string | null>(() => readStorage(AVATAR_STORAGE_KEY));

  // Re-applies whenever the selected theme changes (including on first
  // mount, restoring whatever was saved from last time).
  useEffect(() => {
    const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
    applyTheme(theme);
  }, [themeId]);

  const setThemeId = useCallback((id: string) => {
    setThemeIdState(id);
    writeStorage(THEME_STORAGE_KEY, id);
  }, []);

  // Re-derives the displayable src from the persisted absolute path on every
  // render (cheap string transform) rather than storing the converted URL
  // itself, so a restart just needs the original filesystem path back.
  const avatarSrc = avatarPath ? convertFileSrc(avatarPath) : null;

  const pickAvatarImage = useCallback(async () => {
    const filePath = await open({
      multiple: false,
      title: 'Select an avatar skin image',
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    });

    if (typeof filePath === 'string') {
      setAvatarPath(filePath);
      writeStorage(AVATAR_STORAGE_KEY, filePath);
    }
  }, []);

  const clearAvatar = useCallback(() => {
    setAvatarPath(null);
    clearStorage(AVATAR_STORAGE_KEY);
  }, []);

  return {
    themes: THEMES,
    themeId,
    setThemeId,
    avatarSrc,
    pickAvatarImage,
    clearAvatar,
  };
}
