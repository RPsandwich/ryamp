import { useState } from 'react';
import type { DbPlaylist, View } from '../types';
import type { ThemePreset } from '../skins/themes';
import type { BannerPreset } from '../skins/banners';
import type { UserBanner } from '../skins/userBanners';
import { labelFromFilename } from '../skins/userBanners';
import type { AvatarSource } from '../hooks/useSkin';
import type { EditableThemeColors } from '../skins/customThemes';
import { ThemeCreator } from './ThemeCreator';

interface SidebarProps {
  libraryCount: number;
  albumsCount: number;
  view: View;
  playlists: DbPlaylist[];
  newPlaylistName: string;
  setNewPlaylistName: (name: string) => void;
  createPlaylist: () => void;
  deletePlaylist: (id: number) => void;
  selectPlaylist: (id: number | null) => void;
  openAlbums: () => void;
  pickFolder: () => void;
  isImporting: boolean;
  selectedFolder: string | null;
  importStatus: string | null;
  themes: ThemePreset[];
  themeId: string;
  setThemeId: (id: string) => void;
  saveCustomTheme: (name: string, colors: EditableThemeColors) => void;
  deleteCustomTheme: (id: string) => void;
  bannerPresets: BannerPreset[];
  userBanners: UserBanner[];
  avatarSource: AvatarSource | null;
  avatarSrc: string | null;
  pickAvatarImage: () => void;
  selectBannerPreset: (id: string) => void;
  selectUserBanner: (path: string) => void;
  deleteUserBanner: (path: string) => void;
  clearAvatar: () => void;
}

export function Sidebar({
  libraryCount,
  albumsCount,
  view,
  playlists,
  newPlaylistName,
  setNewPlaylistName,
  createPlaylist,
  deletePlaylist,
  selectPlaylist,
  openAlbums,
  pickFolder,
  isImporting,
  selectedFolder,
  importStatus,
  themes,
  themeId,
  setThemeId,
  saveCustomTheme,
  deleteCustomTheme,
  bannerPresets,
  userBanners,
  avatarSource,
  avatarSrc,
  pickAvatarImage,
  selectBannerPreset,
  selectUserBanner,
  deleteUserBanner,
  clearAvatar,
}: SidebarProps) {
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [isCreatingTheme, setIsCreatingTheme] = useState(false);

  const activeTheme = themes.find((t) => t.id === themeId) ?? themes[0];

  return (
    <div className="panel" style={{ width: '200px', flexShrink: 0 }}>
      <div className="ryamp-logo">Toriamp</div>

      <div
        onClick={() => selectPlaylist(null)}
        className={view.kind === 'library' ? 'nav-item is-active' : 'nav-item'}
      >
        All Tracks ({libraryCount})
      </div>

      <div
        onClick={openAlbums}
        className={view.kind === 'albums' || view.kind === 'album' ? 'nav-item is-active' : 'nav-item'}
      >
        Albums ({albumsCount})
      </div>

      <div className="section-label" style={{ marginTop: '1rem' }}>
        Skins
      </div>

      <button
        className={isAvatarPickerOpen ? 'btn-retro is-active' : 'btn-retro'}
        onClick={() => setIsAvatarPickerOpen((v) => !v)}
        style={{ width: '100%', marginBottom: '0.4rem' }}
      >
        Avatar Skin
      </button>
      {isAvatarPickerOpen && (
        <div style={{ marginBottom: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {bannerPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => selectBannerPreset(preset.id)}
              className={
                avatarSource?.type === 'preset' && avatarSource.id === preset.id ? 'btn-retro is-active' : 'btn-retro'
              }
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                justifyContent: 'flex-start',
                padding: '0.3rem',
              }}
            >
              <img
                src={preset.src}
                alt=""
                aria-hidden="true"
                style={{ width: '2rem', height: '1.25rem', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {preset.label}
              </span>
            </button>
          ))}

          {userBanners.length > 0 && (
            <div style={{ fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>Your uploads</div>
          )}
          {userBanners.map((banner) => (
            <div key={banner.path} style={{ display: 'flex', gap: '0.25rem', alignItems: 'stretch' }}>
              <button
                onClick={() => selectUserBanner(banner.path)}
                className={
                  avatarSource?.type === 'custom' && avatarSource.path === banner.path
                    ? 'btn-retro is-active'
                    : 'btn-retro'
                }
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  justifyContent: 'flex-start',
                  padding: '0.3rem',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {labelFromFilename(banner.fileName)}
                </span>
              </button>
              <button
                className="btn-retro"
                onClick={() => deleteUserBanner(banner.path)}
                title="Delete this uploaded image"
                style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', flexShrink: 0 }}
              >
                &times;
              </button>
            </div>
          ))}

          {bannerPresets.length === 0 && userBanners.length === 0 && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>
              No built-in banners yet -- drop images in src/assets/banners/.
            </div>
          )}

          <button className="btn-retro" onClick={pickAvatarImage} style={{ width: '100%', marginTop: '0.2rem' }}>
            Upload Custom...
          </button>
          {avatarSrc && (
            <button className="btn-retro" onClick={clearAvatar} style={{ width: '100%', fontSize: '0.7rem' }}>
              Hide Avatar
            </button>
          )}
        </div>
      )}

      <button
        className={isThemePickerOpen ? 'btn-retro is-active' : 'btn-retro'}
        onClick={() => setIsThemePickerOpen((v) => !v)}
        style={{ width: '100%' }}
      >
        Theme
      </button>
      {isThemePickerOpen && (
        <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {themes.map((theme) => {
            const isCustom = theme.id.startsWith('custom-');
            return (
              <div key={theme.id} style={{ display: 'flex', gap: '0.25rem', alignItems: 'stretch' }}>
                <button
                  onClick={() => setThemeId(theme.id)}
                  className={theme.id === themeId ? 'btn-retro is-active' : 'btn-retro'}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    justifyContent: 'flex-start',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: '0.7rem',
                      height: '0.7rem',
                      borderRadius: '50%',
                      background: theme.colors.accentMagenta,
                      boxShadow: `0 0 4px ${theme.colors.accentMagenta}`,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {theme.label}
                  </span>
                </button>
                {isCustom && (
                  <button
                    className="btn-retro"
                    onClick={() => deleteCustomTheme(theme.id)}
                    title="Delete this theme"
                    style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', flexShrink: 0 }}
                  >
                    &times;
                  </button>
                )}
              </div>
            );
          })}

          {!isCreatingTheme && (
            <button
              className="btn-retro"
              onClick={() => setIsCreatingTheme(true)}
              style={{ width: '100%', marginTop: '0.2rem' }}
            >
              + Create Theme
            </button>
          )}
          {isCreatingTheme && (
            <ThemeCreator
              initialColors={{
                accentMagenta: activeTheme.colors.accentMagenta,
                accentCyan: activeTheme.colors.accentCyan,
                accentViolet: activeTheme.colors.accentViolet,
                borderViolet: activeTheme.colors.borderViolet,
                bgVoid: activeTheme.colors.bgVoid,
                bgPanel: activeTheme.colors.bgPanel,
                bgPanelRaised: activeTheme.colors.bgPanelRaised,
                bgScreen: activeTheme.colors.bgScreen,
              }}
              onSave={(name, colors) => {
                saveCustomTheme(name, colors);
                setIsCreatingTheme(false);
              }}
              onClose={() => setIsCreatingTheme(false)}
            />
          )}
        </div>
      )}

      <div className="section-label" style={{ marginTop: '1rem' }}>
        Playlists
      </div>
      {playlists.map((pl) => (
        <div
          key={pl.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            onClick={() => selectPlaylist(pl.id)}
            className={view.kind === 'playlist' && view.id === pl.id ? 'nav-item is-active' : 'nav-item'}
            style={{ flex: 1 }}
          >
            {pl.name}
          </span>
          <button
            className="btn-retro"
            onClick={() => deletePlaylist(pl.id)}
            style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}
            title="Delete playlist"
          >
            &times;
          </button>
        </div>
      ))}

      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.25rem' }}>
        <input
          type="text"
          value={newPlaylistName}
          onChange={(e) => setNewPlaylistName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createPlaylist()}
          placeholder="New playlist"
          style={{ width: '100%' }}
        />
        <button className="btn-retro" onClick={createPlaylist}>
          +
        </button>
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        <button className="btn-retro" onClick={pickFolder} disabled={isImporting} style={{ width: '100%' }}>
          {isImporting ? 'Importing...' : 'Import Music Folder'}
        </button>
        {selectedFolder && !importStatus && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.25rem' }}>
            Last imported: {selectedFolder}
          </div>
        )}
        {importStatus && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>{importStatus}</div>
        )}
      </div>
    </div>
  );
}
