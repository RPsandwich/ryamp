import { useRef, useState, useEffect } from 'react';
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
}

interface DbPlaylist {
  id: number;
  name: string;
}

type SortKey = 'title' | 'artist' | 'album' | 'duration';

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
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
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
    setSelectedPlaylistId(id);
    if (id === null) {
      await loadLibrary();
    } else {
      await loadPlaylistTracks(id);
    }
  };

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
    if (selectedPlaylistId === id) {
      setSelectedPlaylistId(null);
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
    if (selectedPlaylistId === playlistId) {
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
        });
      } catch (err) {
        failed++;
        console.error(`Failed to parse ${filepath}:`, err);
      }
      onProgress?.(i + 1, filePaths.length);
    }

    return { tracks, failed };
  };

  const saveTracksToDb = async (tracks: ParsedTrack[]): Promise<{ added: number; skipped: number }> => {
    const db = await Database.load('sqlite:ryamp.db');
    let added = 0;
    let skipped = 0;

    for (const track of tracks) {
      const result = await db.execute(
        `INSERT OR IGNORE INTO tracks (filepath, title, artist, album, duration)
         VALUES ($1, $2, $3, $4, $5)`,
        [track.filepath, track.title, track.artist, track.album, track.duration]
      );
      if (result.rowsAffected > 0) {
        added++;
      } else {
        skipped++;
      }
    }

    return { added, skipped };
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
      const { added, skipped } = await saveTracksToDb(tracks);
      await loadLibrary();

      const parts = [`Added ${added} track${added === 1 ? '' : 's'}`];
      if (skipped > 0) parts.push(`${skipped} already in library`);
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

  const displayedTracks = sortTracks(selectedPlaylistId !== null ? playlistTracks : library);
  const activePlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', display: 'flex', gap: '2rem' }}>
      <div style={{ width: '200px', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.2rem', marginTop: 0 }}>ryamp</h1>

        <div
          onClick={() => selectPlaylist(null)}
          style={{
            cursor: 'pointer',
            fontWeight: selectedPlaylistId === null ? 'bold' : 'normal',
            padding: '0.25rem 0',
          }}
        >
          All Tracks ({library.length})
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
                fontWeight: selectedPlaylistId === pl.id ? 'bold' : 'normal',
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

        <div>
          <strong>
            {selectedPlaylistId === null
              ? `Library (${library.length} tracks)`
              : `${activePlaylist?.name ?? 'Playlist'} (${playlistTracks.length} tracks)`}
          </strong>
          <table style={{ width: '100%', marginTop: '0.5rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                {(['title', 'artist', 'album', 'duration'] as const).map((key) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                    {sortKey === key && (sortDir === 'asc' ? ' \u25b2' : ' \u25bc')}
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
                  <td onClick={() => playTrack(track)} style={{ cursor: 'pointer' }}>{track.title}</td>
                  <td onClick={() => playTrack(track)} style={{ cursor: 'pointer' }}>{track.artist}</td>
                  <td onClick={() => playTrack(track)} style={{ cursor: 'pointer' }}>{track.album}</td>
                  <td onClick={() => playTrack(track)} style={{ cursor: 'pointer' }}>{formatDuration(track.duration)}</td>
                  <td>
                    {selectedPlaylistId === null ? (
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
                    ) : (
                      <button onClick={() => removeTrackFromPlaylist(track.id, selectedPlaylistId!)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
