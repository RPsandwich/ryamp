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
    <div style={{ width: '200px', flexShrink: 0 }}>
      <h1 style={{ fontSize: '1.2rem', marginTop: 0 }}>ryamp</h1>

      <div
        onClick={() => selectPlaylist(null)}
        style={{
          cursor: 'pointer',
          fontWeight: view.kind === 'library' ? 'bold' : 'normal',
          padding: '0.25rem 0',
        }}
      >
        All Tracks ({libraryCount})
      </div>

      <div
        onClick={openAlbums}
        style={{
          cursor: 'pointer',
          fontWeight: view.kind === 'albums' || view.kind === 'album' ? 'bold' : 'normal',
          padding: '0.25rem 0',
        }}
      >
        Albums ({albumsCount})
      </div>

      <div style={{ marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>Playlists</div>
      {playlists.map((pl) => (
        <div
          key={pl.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.15rem 0',
          }}
        >
          <span
            onClick={() => selectPlaylist(pl.id)}
            style={{
              cursor: 'pointer',
              flex: 1,
              fontWeight: view.kind === 'playlist' && view.id === pl.id ? 'bold' : 'normal',
            }}
          >
            {pl.name}
          </span>
          <button
            onClick={() => deletePlaylist(pl.id)}
            style={{ fontSize: '0.7rem' }}
            title="Delete playlist"
          >
            &times;
          </button>
        </div>
      ))}

      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.25rem' }}>
        <input
          value={newPlaylistName}
          onChange={(e) => setNewPlaylistName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createPlaylist()}
          placeholder="New playlist"
          style={{ width: '100%', fontSize: '0.8rem' }}
        />
        <button onClick={createPlaylist}>+</button>
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        <button onClick={pickFolder} disabled={isImporting} style={{ width: '100%' }}>
          {isImporting ? 'Importing...' : 'Import Music Folder'}
        </button>
        {selectedFolder && !importStatus && (
          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
            Last imported: {selectedFolder}
          </div>
        )}
        {importStatus && (
          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>{importStatus}</div>
        )}
      </div>
    </div>
  );
}
