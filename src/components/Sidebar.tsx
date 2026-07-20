import type { DbPlaylist, View } from '../types';

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
}: SidebarProps) {
  return (
    <div className="panel" style={{ width: '200px', flexShrink: 0 }}>
      <div className="ryamp-logo">ryamp</div>

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
