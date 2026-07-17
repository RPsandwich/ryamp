import { useRef, useState, useEffect, useMemo } from 'react';
import Database from '@tauri-apps/plugin-sql';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readFile } from '@tauri-apps/plugin-fs';
import { parseBuffer } from 'music-metadata';

interface ParsedTrack {
  filepath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  trackNumber: number | null;
}

interface ParseResult {
  tracks: ParsedTrack[];
  failed: number;
}

interface DbTrack {
  id: number;
  filepath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  track_number: number | null;
}

interface DbPlaylist {
  id: number;
  name: string;
}

interface AlbumSummary {
  album: string;
  artist: string;
  trackCount: number;
}

type SortKey = 'title' | 'artist' | 'album' | 'duration';

type View =
  | { kind: 'library' }
  | { kind: 'playlist'; id: number }
  | { kind: 'albums' }
  | { kind: 'album'; album: string; artist: string };

function App() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);
  const playbackOffsetRef = useRef(0);
  const contextStartTimeRef = useRef(0);
  const manualStopRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [library, setLibrary] = useState<DbTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<DbTrack | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('artist');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [playlists, setPlaylists] = useState<DbPlaylist[]>([]);
  const [view, setView] = useState<View>({ kind: 'library' });
  const [playlistTracks, setPlaylistTracks] = useState<DbTrack[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const loadLibrary = async () => {
    const db = await Database.load('sqlite:ryamp.db');
    const result = await db.select<DbTrack[]>('SELECT * FROM tracks ORDER BY artist, album, title');
    setLibrary(result);
  };

  const loadPlaylists = async () => {
    const db = await Database.load('sqlite:ryamp.db');
    const result = await db.select<DbPlaylist[]>('SELECT id, name FROM playlists ORDER BY created_at');
    setPlaylists(result);
  };

  const loadPlaylistTracks = async (playlistId: number) => {
    const db = await Database.load('sqlite:ryamp.db');
    const result = await db.select<DbTrack[]>(
      `SELECT tracks.* FROM tracks
       JOIN playlist_tracks ON playlist_tracks.track_id = tracks.id
       WHERE playlist_tracks.playlist_id = $1
       ORDER BY playlist_tracks.position`,
      [playlistId]
    );
    setPlaylistTracks(result);
  };

  const selectPlaylist = async (id: number | null) => {
    if (id === null) {
      setView({ kind: 'library' });
      await loadLibrary();
    } else {
      setView({ kind: 'playlist', id });
      await loadPlaylistTracks(id);
    }
  };

  const openAlbums = () => setView({ kind: 'albums' });
  const openAlbum = (album: string, artist: string) => setView({ kind: 'album', album, artist });

  const createPlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    const db = await Database.load('sqlite:ryamp.db');
    await db.execute('INSERT INTO playlists (name) VALUES ($1)', [name]);
    setNewPlaylistName('');
    await loadPlaylists();
  };

  const deletePlaylist = async (id: number) => {
    const db = await Database.load('sqlite:ryamp.db');
    await db.execute('DELETE FROM playlist_tracks WHERE playlist_id = $1', [id]);
    await db.execute('DELETE FROM playlists WHERE id = $1', [id]);
    if (view.kind === 'playlist' && view.id === id) {
      setView({ kind: 'library' });
      setPlaylistTracks([]);
    }
    await loadPlaylists();
  };

  const addTrackToPlaylist = async (trackId: number, playlistId: number) => {
    const db = await Database.load('sqlite:ryamp.db');
    const posResult = await db.select<{ maxPos: number | null }[]>(
      'SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = $1',
      [playlistId]
    );
    const nextPos = (posResult[0]?.maxPos ?? -1) + 1;
    await db.execute(
      'INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES ($1, $2, $3)',
      [playlistId, trackId, nextPos]
    );
    if (view.kind === 'playlist' && view.id === playlistId) {
      await loadPlaylistTracks(playlistId);
    }
  };

  const removeTrackFromPlaylist = async (trackId: number, playlistId: number) => {
    const db = await Database.load('sqlite:ryamp.db');
    await db.execute(
      'DELETE FROM playlist_tracks WHERE playlist_id = $1 AND track_id = $2',
      [playlistId, trackId]
    );
    await loadPlaylistTracks(playlistId);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortTracks = (tracks: DbTrack[]): DbTrack[] => {
    return [...tracks].sort((a, b) => {
      let av: string | number = a[sortKey];
      let bv: string | number = b[sortKey];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const albums: AlbumSummary[] = useMemo(() => {
    const map = new Map<string, AlbumSummary>();
    for (const t of library) {
      const key = `${t.artist}\u0000${t.album}`;
      const existing = map.get(key);
      if (existing) {
        existing.trackCount++;
      } else {
        map.set(key, { album: t.album, artist: t.artist, trackCount: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.album.localeCompare(b.album));
  }, [library]);

  const albumTracks: DbTrack[] = useMemo(() => {
    if (view.kind !== 'album') return [];
    return library
      .filter((t) => t.album === view.album && t.artist === view.artist)
      .sort((a, b) => {
        const an = a.track_number ?? Number.MAX_SAFE_INTEGER;
        const bn = b.track_number ?? Number.MAX_SAFE_INTEGER;
        if (an !== bn) return an - bn;
        return a.title.localeCompare(b.title);
      });
  }, [library, view]);

  // Load the library and playlists from the DB on startup
  useEffect(() => {
    loadLibrary();
    loadPlaylists();
  }, []);

  const ensureAudioGraph = () => {
    if (audioContextRef.current) return;

    const ctx = new AudioContext({ latencyHint: 'playback' });
    const analyser = ctx.createAnalyser();
    const gain = ctx.createGain();

    analyser.connect(gain);
    gain.connect(ctx.destination);

    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    gainRef.current = gain;
  };

  const stopCurrentSource = () => {
    if (sourceNodeRef.current) {
      manualStopRef.current = true;
      try {
        sourceNodeRef.current.stop();
      } catch {
        // already stopped, ignore
      }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
  };

  const playFromOffset = (buffer: AudioBuffer, offsetSeconds: number) => {
    const ctx = audioContextRef.current!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyserRef.current!);

    source.onended = () => {
      if (manualStopRef.current) {
        manualStopRef.current = false;
        return;
      }
      // Track actually finished naturally
      setIsPlaying(false);
      playbackOffsetRef.current = 0;
    };

    source.start(0, offsetSeconds);
    sourceNodeRef.current = source;
    contextStartTimeRef.current = ctx.currentTime;
    playbackOffsetRef.current = offsetSeconds;
    setIsPlaying(true);
  };

  // Decodes the whole file to PCM up front and plays it via AudioBufferSourceNode.
  // (Avoids <audio> + Blob-URL streaming, which stutters on longer tracks under WebKitGTK.)
  const playTrack = async (track: DbTrack) => {
    setCurrentTrack(track);
    ensureAudioGraph();
    stopCurrentSource();

    const fileBytes = await readFile(track.filepath);
    const audioBuffer = await audioContextRef.current!.decodeAudioData(fileBytes.buffer.slice(0));
    currentBufferRef.current = audioBuffer;

    if (audioContextRef.current!.state === 'suspended') {
      await audioContextRef.current!.resume();
    }

    playFromOffset(audioBuffer, 0);
  };

  const togglePlay = async () => {
    if (!currentTrack || !currentBufferRef.current || !audioContextRef.current) return;

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      const elapsed = audioContextRef.current.currentTime - contextStartTimeRef.current;
      playbackOffsetRef.current += elapsed;
      stopCurrentSource();
      setIsPlaying(false);
    } else {
      playFromOffset(currentBufferRef.current, playbackOffsetRef.current);
    }
  };

  const pickFolder = async () => {
    const folder = await open({
      directory: true,
      multiple: false,
      title: 'Select your music folder',
    });

    if (folder) {
      setSelectedFolder(folder);
      await scanFolder(folder);
    }
  };

  const parseTags = async (
    filePaths: string[],
    onProgress?: (done: number, total: number) => void
  ): Promise<ParseResult> => {
    const tracks: ParsedTrack[] = [];
    let failed = 0;

    for (let i = 0; i < filePaths.length; i++) {
      const filepath = filePaths[i];
      try {
        const fileBytes = await readFile(filepath);
        const metadata = await parseBuffer(fileBytes, 'audio/mpeg');

        tracks.push({
          filepath,
          title: metadata.common.title || filepath.split('/').pop() || 'Unknown',
          artist: metadata.common.artist || 'Unknown Artist',
          album: metadata.common.album || 'Unknown Album',
          duration: metadata.format.duration || 0,
          trackNumber: metadata.common.track?.no ?? null,
        });
      } catch (err) {
        failed++;
        console.error(`Failed to parse ${filepath}:`, err);
      }
      onProgress?.(i + 1, filePaths.length);
    }

    return { tracks, failed };
  };

  const saveTracksToDb = async (tracks: ParsedTrack[]): Promise<{ added: number; updated: number }> => {
    const db = await Database.load('sqlite:ryamp.db');
    let added = 0;
    let updated = 0;

    for (const track of tracks) {
      const existing = await db.select<{ id: number }[]>(
        'SELECT id FROM tracks WHERE filepath = $1',
        [track.filepath]
      );
      const existedBefore = existing.length > 0;

      await db.execute(
        `INSERT INTO tracks (filepath, title, artist, album, duration, track_number)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT(filepath) DO UPDATE SET
           title = excluded.title,
           artist = excluded.artist,
           album = excluded.album,
           duration = excluded.duration,
           track_number = excluded.track_number`,
        [track.filepath, track.title, track.artist, track.album, track.duration, track.trackNumber]
      );

      if (existedBefore) {
        updated++;
      } else {
        added++;
      }
    }

    return { added, updated };
  };

  const findMp3sRecursive = async (folderPath: string): Promise<string[]> => {
    const entries = await readDir(folderPath);
    let results: string[] = [];

    for (const entry of entries) {
      const fullPath = `${folderPath}/${entry.name}`;

      if (entry.isDirectory) {
        const nested = await findMp3sRecursive(fullPath);
        results = results.concat(nested);
      } else if (entry.name?.toLowerCase().endsWith('.mp3')) {
        results.push(fullPath);
      }
    }

    return results;
  };

  const scanFolder = async (folderPath: string): Promise<void> => {
    setIsImporting(true);
    setImportStatus('Scanning folder for MP3s...');

    try {
      const mp3s = await findMp3sRecursive(folderPath);

      if (mp3s.length === 0) {
        setImportStatus('No MP3 files found in that folder.');
        return;
      }

      const { tracks, failed } = await parseTags(mp3s, (done, total) => {
        setImportStatus(`Reading tags... ${done}/${total}`);
      });

      setImportStatus('Saving to library...');
      const { added, updated } = await saveTracksToDb(tracks);
      await loadLibrary();

      const parts = [`Added ${added} track${added === 1 ? '' : 's'}`];
      if (updated > 0) parts.push(`${updated} refreshed`);
      if (failed > 0) parts.push(`${failed} failed to read`);
      setImportStatus(parts.join(' \u00b7 '));
    } finally {
      setIsImporting(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayedTracks =
    view.kind === 'playlist' ? sortTracks(playlistTracks) : view.kind === 'album' ? albumTracks : sortTracks(library);
  const activePlaylist = view.kind === 'playlist' ? playlists.find((p) => p.id === view.id) : undefined;

  const headerLabel =
    view.kind === 'playlist'
      ? `${activePlaylist?.name ?? 'Playlist'} (${playlistTracks.length} tracks)`
      : view.kind === 'album'
        ? `${view.album} — ${view.artist} (${albumTracks.length} tracks)`
        : `Library (${library.length} tracks)`;

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', display: 'flex', gap: '2rem' }}>
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
          All Tracks ({library.length})
        </div>

        <div
          onClick={openAlbums}
          style={{
            cursor: 'pointer',
            fontWeight: view.kind === 'albums' || view.kind === 'album' ? 'bold' : 'normal',
            padding: '0.25rem 0',
          }}
        >
          Albums ({albums.length})
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
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: '1rem' }}>
          <button onClick={togglePlay} disabled={!currentTrack}>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          {currentTrack && (
            <span style={{ marginLeft: '1rem' }}>
              Now playing: {currentTrack.title} — {currentTrack.artist}
            </span>
          )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <button onClick={pickFolder} disabled={isImporting}>
            {isImporting ? 'Importing...' : 'Import Music Folder'}
          </button>
          {selectedFolder && !importStatus && (
            <span style={{ marginLeft: '1rem' }}>Last imported: {selectedFolder}</span>
          )}
          {importStatus && <span style={{ marginLeft: '1rem' }}>{importStatus}</span>}
        </div>

        {view.kind === 'albums' ? (
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
        ) : (
          <div>
            {view.kind === 'album' && (
              <button onClick={openAlbums} style={{ marginBottom: '0.5rem' }}>
                &larr; Back to Albums
              </button>
            )}
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
                      <td onClick={() => playTrack(track)} style={{ cursor: 'pointer', color: '#666' }}>
                        {track.track_number ?? '—'}
                      </td>
                    )}
                    <td onClick={() => playTrack(track)} style={{ cursor: 'pointer' }}>{track.title}</td>
                    {view.kind !== 'album' && (
                      <>
                        <td onClick={() => playTrack(track)} style={{ cursor: 'pointer' }}>{track.artist}</td>
                        <td onClick={() => playTrack(track)} style={{ cursor: 'pointer' }}>{track.album}</td>
                      </>
                    )}
                    <td onClick={() => playTrack(track)} style={{ cursor: 'pointer' }}>{formatDuration(track.duration)}</td>
                    <td>
                      {view.kind === 'playlist' ? (
                        <button onClick={() => removeTrackFromPlaylist(track.id, view.id)}>
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
                            <option key={pl.id} value={pl.id}>{pl.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
