import type { DbTrack, DbPlaylist, AlbumSummary, SortKey, View } from '../types';
import { formatDuration } from '../utils';

interface TrackTableProps {
  view: View;
  albums: AlbumSummary[];
  openAlbum: (album: string, artist: string) => void;
  openAlbums: () => void;
  headerLabel: string;
  displayedTracks: DbTrack[];
  currentTrack: DbTrack | null;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  handleSort: (key: SortKey) => void;
  selectAndPlay: (track: DbTrack, queue: DbTrack[]) => void;
  playlists: DbPlaylist[];
  addTrackToPlaylist: (trackId: number, playlistId: number) => void;
  removeTrackFromPlaylist: (trackId: number, playlistId: number) => void;
}

export function TrackTable({
  view,
  albums,
  openAlbum,
  openAlbums,
  headerLabel,
  displayedTracks,
  currentTrack,
  sortKey,
  sortDir,
  handleSort,
  selectAndPlay,
  playlists,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
}: TrackTableProps) {
  if (view.kind === 'albums') {
    return (
      <div className="panel">
        <span className="section-label">Albums ({albums.length})</span>
        <div>
          {albums.map((a) => (
            <div key={`${a.artist}\u0000${a.album}`} onClick={() => openAlbum(a.album, a.artist)} className="album-card">
              <div className="album-title">{a.album}</div>
              <div className="album-meta">
                {a.artist} &middot; {a.trackCount} track{a.trackCount === 1 ? '' : 's'}
              </div>
            </div>
          ))}
          {albums.length === 0 && <div style={{ color: 'var(--text-dim)' }}>No albums yet — import some music.</div>}
        </div>
      </div>
    );
  }

  return (
    <>
      {view.kind === 'album' && (
        <div style={{ marginBottom: '1rem' }}>
          <button className="btn-retro" onClick={openAlbums}>
            &larr; Back to Albums
          </button>
        </div>
      )}

      <div className="panel">
        <span className="section-label track-panel-header">{headerLabel}</span>
        <table className="track-table">
          <thead>
            <tr>
              {view.kind === 'album' && <th style={{ width: '2.5rem' }}>#</th>}
              {(['title', 'artist', 'album', 'duration'] as const)
                .filter((key) => view.kind !== 'album' || (key !== 'artist' && key !== 'album'))
                .map((key) => (
                  <th
                    key={key}
                    onClick={view.kind === 'album' ? undefined : () => handleSort(key)}
                    style={{ cursor: view.kind === 'album' ? 'default' : 'pointer' }}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                    {view.kind !== 'album' && sortKey === key && (sortDir === 'asc' ? ' \u25b2' : ' \u25bc')}
                  </th>
                ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayedTracks.map((track) => (
              <tr key={track.id} className={currentTrack?.id === track.id ? 'is-current' : undefined}>
                {view.kind === 'album' && (
                  <td onClick={() => selectAndPlay(track, displayedTracks)} style={{ color: 'var(--text-dim)' }}>
                    {track.track_number ?? '—'}
                  </td>
                )}
                <td onClick={() => selectAndPlay(track, displayedTracks)}>{track.title}</td>
                {view.kind !== 'album' && (
                  <>
                    <td onClick={() => selectAndPlay(track, displayedTracks)}>{track.artist}</td>
                    <td onClick={() => selectAndPlay(track, displayedTracks)}>{track.album}</td>
                  </>
                )}
                <td onClick={() => selectAndPlay(track, displayedTracks)}>{formatDuration(track.duration)}</td>
                <td onClick={(e) => e.stopPropagation()} style={{ cursor: 'default' }}>
                  {view.kind === 'playlist' ? (
                    <button className="btn-retro" onClick={() => removeTrackFromPlaylist(track.id, view.id)}>
                      Remove
                    </button>
                  ) : (
                    <select
                      value=""
                      onChange={(e) => {
                        const plId = Number(e.target.value);
                        if (plId) addTrackToPlaylist(track.id, plId);
                        e.target.value = '';
                      }}
                    >
                      <option value="">+ Add to...</option>
                      {playlists.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
