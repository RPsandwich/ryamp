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
      <div>
        <strong>Albums ({albums.length})</strong>
        <div style={{ marginTop: '0.5rem' }}>
          {albums.map((a) => (
            <div
              key={`${a.artist}\u0000${a.album}`}
              onClick={() => openAlbum(a.album, a.artist)}
              style={{
                padding: '0.5rem 0',
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 'bold' }}>{a.album}</div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                {a.artist} · {a.trackCount} track{a.trackCount === 1 ? '' : 's'}
              </div>
            </div>
          ))}
          {albums.length === 0 && <div style={{ color: '#666' }}>No albums yet — import some music.</div>}
        </div>
      </div>
    );
  }

  return (
    <>
      {view.kind === 'album' && (
        <div style={{ marginBottom: '1rem' }}>
          <button onClick={openAlbums}>&larr; Back to Albums</button>
        </div>
      )}

      <div>
        <strong>{headerLabel}</strong>
        <table style={{ width: '100%', marginTop: '0.5rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              {view.kind === 'album' && <th style={{ width: '2.5rem' }}>#</th>}
              {(['title', 'artist', 'album', 'duration'] as const)
                .filter((key) => view.kind !== 'album' || (key !== 'artist' && key !== 'album'))
                .map((key) => (
                  <th
                    key={key}
                    onClick={view.kind === 'album' ? undefined : () => handleSort(key)}
                    style={{ cursor: view.kind === 'album' ? 'default' : 'pointer', userSelect: 'none' }}
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
              <tr
                key={track.id}
                style={{
                  backgroundColor: currentTrack?.id === track.id ? '#eee' : 'transparent',
                }}
              >
                {view.kind === 'album' && (
                  <td onClick={() => selectAndPlay(track, displayedTracks)} style={{ cursor: 'pointer', color: '#666' }}>
                    {track.track_number ?? '—'}
                  </td>
                )}
                <td onClick={() => selectAndPlay(track, displayedTracks)} style={{ cursor: 'pointer' }}>{track.title}</td>
                {view.kind !== 'album' && (
                  <>
                    <td onClick={() => selectAndPlay(track, displayedTracks)} style={{ cursor: 'pointer' }}>{track.artist}</td>
                    <td onClick={() => selectAndPlay(track, displayedTracks)} style={{ cursor: 'pointer' }}>{track.album}</td>
                  </>
                )}
                <td onClick={() => selectAndPlay(track, displayedTracks)} style={{ cursor: 'pointer' }}>
                  {formatDuration(track.duration)}
                </td>
                <td>
                  {view.kind === 'playlist' ? (
                    <button onClick={() => removeTrackFromPlaylist(track.id, view.id)}>Remove</button>
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
