import { useCallback, useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { THEMES, type ThemeColors, type ThemePreset } from './themes';
import { BANNER_PRESETS } from './banners';
import { listUserBanners, importUserBanner, removeUserBanner, type UserBanner } from '../skins/userBanners';

const THEME_STORAGE_KEY = 'ryamp.themeId';
const AVATAR_STORAGE_KEY = 'ryamp.avatarSource';

// Either a bundled preset from src/assets/banners/ (persisted by stable id,
// since a bundled preset's build-time src can change between builds), or a
// user upload -- which now lives permanently in the app-data banner
// gallery (see skins/userBanners.ts), persisted by its (stable, app-data-
// relative) path rather than wherever the original file was picked from.
export type AvatarSource = { type: 'custom'; path: string } | { type: 'preset'; id: string };

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

function loadStoredAvatarSource(): AvatarSource | null {
  const stored = readStorage(AVATAR_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as AvatarSource;
    if (parsed.type === 'custom' && typeof parsed.path === 'string') return parsed;
    if (parsed.type === 'preset' && typeof parsed.id === 'string') return parsed;
  } catch {
    // Malformed/old-format value -- treat as no avatar rather than crashing.
  }
  return null;
}

export function useSkin() {
  const [themeId, setThemeIdState] = useState<string>(loadStoredThemeId);
  const [avatarSource, setAvatarSource] = useState<AvatarSource | null>(loadStoredAvatarSource);
  const [userBanners, setUserBanners] = useState<UserBanner[]>([]);

  // Re-applies whenever the selected theme changes (including on first
  // mount, restoring whatever was saved from last time).
  useEffect(() => {
    const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
    applyTheme(theme);
  }, [themeId]);

  // Loads whatever's already in the persistent upload gallery on startup.
  useEffect(() => {
    listUserBanners()
      .then(setUserBanners)
      .catch((err) => console.error('Failed to load user banner gallery:', err));
  }, []);

  const setThemeId = useCallback((id: string) => {
    setThemeIdState(id);
    writeStorage(THEME_STORAGE_KEY, id);
  }, []);

  // Resolves the current avatarSource into an actual displayable src.
  // Presets are bundled at build time (already a usable URL); custom
  // uploads need convertFileSrc() to turn their (now permanent, app-data)
  // path into something the webview is allowed to load. If a stored
  // reference no longer matches anything (preset removed from
  // src/assets/banners/, or a gallery file deleted outside the app), this
  // quietly falls back to no avatar rather than erroring.
  let avatarSrc: string | null = null;
  if (avatarSource?.type === 'custom') {
    avatarSrc = convertFileSrc(avatarSource.path);
  } else if (avatarSource?.type === 'preset') {
    avatarSrc = BANNER_PRESETS.find((p) => p.id === avatarSource.id)?.src ?? null;
  }

  const pickAvatarImage = useCallback(async () => {
    const filePath = await open({
      multiple: false,
      title: 'Select an avatar skin image',
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    });

    if (typeof filePath !== 'string') return;

    try {
      const banner = await importUserBanner(filePath);
      setUserBanners((prev) => [...prev, banner].sort((a, b) => a.fileName.localeCompare(b.fileName)));
      const next: AvatarSource = { type: 'custom', path: banner.path };
      setAvatarSource(next);
      writeStorage(AVATAR_STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.error('Failed to import avatar image:', err);
    }
  }, []);

  const selectBannerPreset = useCallback((id: string) => {
    const next: AvatarSource = { type: 'preset', id };
    setAvatarSource(next);
    writeStorage(AVATAR_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const selectUserBanner = useCallback((path: string) => {
    const next: AvatarSource = { type: 'custom', path };
    setAvatarSource(next);
    writeStorage(AVATAR_STORAGE_KEY, JSON.stringify(next));
  }, []);

  // Deselects the current avatar without deleting anything -- distinct from
  // deleteUserBanner below, which actually removes an uploaded file from
  // the gallery.
  const clearAvatar = useCallback(() => {
    setAvatarSource(null);
    clearStorage(AVATAR_STORAGE_KEY);
  }, []);

  const deleteUserBanner = useCallback(
    async (path: string) => {
      try {
        await removeUserBanner(path);
        setUserBanners((prev) => prev.filter((b) => b.path !== path));
        if (avatarSource?.type === 'custom' && avatarSource.path === path) {
          setAvatarSource(null);
          clearStorage(AVATAR_STORAGE_KEY);
        }
      } catch (err) {
        console.error('Failed to delete banner:', err);
      }
    },
    [avatarSource]
  );

  return {
    themes: THEMES,
    themeId,
    setThemeId,
    bannerPresets: BANNER_PRESETS,
    userBanners,
    avatarSource,
    avatarSrc,
    pickAvatarImage,
    selectBannerPreset,
    selectUserBanner,
    deleteUserBanner,
    clearAvatar,
  };
}
