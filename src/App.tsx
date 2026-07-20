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
type RepeatMode = 'off' | 'all' | 'one';

type View =
  | { kind: 'library' }
  | { kind: 'playlist'; id: number }
  | { kind: 'albums' }
  | { kind: 'album'; album: string; artist: string };

const pickRandomIndex = (queueLength: number, excludeIndex: number): number => {
  if (queueLength <= 1) return excludeIndex;
  let idx = Math.floor(Math.random() * queueLength);
  while (idx === excludeIndex) {
    idx = Math.floor(Math.random() * queueLength);
  }
  return idx;
};

function App() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);
  const playbackOffsetRef = useRef(0);
  const contextStartTimeRef = useRef(0);
  const playbackGenerationRef = useRef(0);
  const currentQueueRef = useRef<DbTrack[]>([]);
  const shuffleHistoryRef = useRef<DbTrack[]>([]);
  const repeatModeRef = useRef<RepeatMode>('off');
  const shuffleOnRef = useRef(false);

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

  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [shuffleOn, setShuffleOn] = useState(false);
  const [visualizerMode, setVisualizerMode] = useState<'bars' | 'wave'>('bars');
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualizerRafRef = useRef<number | null>(null);
  const visualizerModeRef = useRef(visualizerMode);

  // Keep refs in sync so the long-lived `onended` callback (created when a track
  // starts, but firing whenever it finishes) always reads the latest mode rather
  // than whatever was current when that particular track started playing.
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    shuffleOnRef.current = shuffleOn;
  }, [shuffleOn]);

  useEffect(() => {
    visualizerModeRef.current = visualizerMode;
  }, [visualizerMode]);

  // Basic MVP visualizer loop — reads directly from the AnalyserNode already
  // wired into the audio graph. Runs only while a track is actually playing.
  useEffect(() => {
    if (!isPlaying) return;

    const canvas = visualizerCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      visualizerRafRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;
      ctx2d.clearRect(0, 0, width, height);

      if (visualizerModeRef.current === 'bars') {
        analyser.getByteFrequencyData(dataArray);
        const barCount = 64;
        const step = Math.floor(bufferLength / barCount);
        const barWidth = width / barCount;
        for (let i = 0; i < barCount; i++) {
          const value = dataArray[i * step] ?? 0;
          const barHeight = (value / 255) * height;
          const hue = (i / barCount) * 300; // 0 (red) through ~300 (magenta), skips wrapping back to red
          ctx2d.fillStyle = `hsl(${hue}, 90%, 55%)`;
          ctx2d.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
        }
      } else {
        analyser.getByteTimeDomainData(dataArray);
        const gradient = ctx2d.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, 'hsl(0, 90%, 55%)');
        gradient.addColorStop(0.17, 'hsl(50, 90%, 55%)');
        gradient.addColorStop(0.34, 'hsl(100, 90%, 55%)');
        gradient.addColorStop(0.5, 'hsl(180, 90%, 55%)');
        gradient.addColorStop(0.67, 'hsl(220, 90%, 55%)');
        gradient.addColorStop(0.84, 'hsl(280, 90%, 55%)');
        gradient.addColorStop(1, 'hsl(320, 90%, 55%)');
        ctx2d.lineWidth = 2;
        ctx2d.strokeStyle = gradient;
        ctx2d.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
          x += sliceWidth;
        }
        ctx2d.lineTo(width, height / 2);
        ctx2d.stroke();
      }
    };

    draw();

    return () => {
      if (visualizerRafRef.current !== null) {
        cancelAnimationFrame(visualizerRafRef.current);
        visualizerRafRef.current = null;
      }
    };
  }, [isPlaying]);

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
    // Invalidate whatever source is currently "claimed" — this doesn't rely on
    // that source's 'ended' event ever firing (WebKitGTK doesn't reliably fire
    // it after stop()+disconnect()), so it works even if that event never comes.
    playbackGenerationRef.current += 1;
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // already stopped, ignore
      }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
  };

  const playFromOffset = (track: DbTrack, buffer: AudioBuffer, offsetSeconds: number) => {
    const ctx = audioContextRef.current!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyserRef.current!);

    // Claim a fresh generation for this specific source. Any earlier source's
    // 'ended' callback — whether it fires promptly, late, or not at all — will
    // see a mismatch here and no-op, instead of relying on a shared boolean
    // flag that only gets reset if that earlier callback actually runs.
    const myGeneration = ++playbackGenerationRef.current;

    source.onended = () => {
      if (playbackGenerationRef.current !== myGeneration) {
        return;
      }
      sourceNodeRef.current = null;
      playbackOffsetRef.current = 0;
      advanceAfterTrackEnded(track).catch((err) => console.error('[ryamp] advanceAfterTrackEnded failed:', err));
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

    playFromOffset(track, audioBuffer, 0);
  };

  // Sets the active playback queue (the list a track was chosen from) and plays a track from it.
  const playTrackFromQueue = async (track: DbTrack, queue: DbTrack[]) => {
    currentQueueRef.current = queue;
    await playTrack(track);
  };

  // Used when the person actively picks a track from a list — starts a fresh
  // shuffle-history context, since we're now navigating a (possibly new) queue.
  const selectAndPlay = async (track: DbTrack, queue: DbTrack[]) => {
    shuffleHistoryRef.current = [];
    await playTrackFromQueue(track, queue);
  };

  // Moves forward/back one track relative to `fromTrack` within the current queue,
  // respecting shuffle and repeat modes. `auto` distinguishes "track just ended
  // naturally" from a manual Next/Previous button press (repeat-one only replays
  // on natural end, not on a manual skip).
  const playRelative = async (fromTrack: DbTrack, direction: 1 | -1, opts?: { auto?: boolean }) => {
    const queue = currentQueueRef.current;
    if (queue.length === 0) return;

    const currentIndex = queue.findIndex((t) => t.id === fromTrack.id);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;

    if (shuffleOnRef.current) {
      if (direction === 1) {
        shuffleHistoryRef.current.push(fromTrack);
        const nextIndex = pickRandomIndex(queue.length, safeIndex);
        await playTrackFromQueue(queue[nextIndex], queue);
      } else {
        const prevTrack = shuffleHistoryRef.current.pop();
        await playTrackFromQueue(prevTrack ?? fromTrack, queue);
      }
      return;
    }

    let targetIndex = safeIndex + direction;

    if (targetIndex < 0) {
      targetIndex = repeatModeRef.current === 'all' ? queue.length - 1 : 0;
    } else if (targetIndex >= queue.length) {
      if (repeatModeRef.current === 'all') {
        targetIndex = 0;
      } else {
        if (opts?.auto) setIsPlaying(false); // reached the end of the queue naturally
        return;
      }
    }

    await playTrackFromQueue(queue[targetIndex], queue);
  };

  const advanceAfterTrackEnded = async (finishedTrack: DbTrack) => {
    if (repeatModeRef.current === 'one') {
      await playTrackFromQueue(finishedTrack, currentQueueRef.current);
      return;
    }
    await playRelative(finishedTrack, 1, { auto: true });
  };

  const skipNext = () => {
    if (currentTrack) void playRelative(currentTrack, 1);
  };

  const skipPrevious = () => {
    if (currentTrack) void playRelative(currentTrack, -1);
  };

  const toggleShuffle = () => setShuffleOn((s) => !s);

  const cycleRepeat = () => {
    setRepeatMode((mode) => (mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'));
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
      playFromOffset(currentTrack, currentBufferRef.current, playbackOffsetRef.current);
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

      <div style={{ flex: 1 }}>
        <canvas
          ref={visualizerCanvasRef}
          width={800}
          height={80}
          style={{ width: '100%', height: '80px', display: 'block', background: '#111', borderRadius: '4px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0.4rem 0 1rem' }}>
          <button
            onClick={() => setVisualizerMode((m) => (m === 'bars' ? 'wave' : 'bars'))}
            style={{ fontSize: '0.75rem' }}
          >
            Visualizer: {visualizerMode === 'bars' ? 'Bars' : 'Wave'}
          </button>
        </div>

        {currentTrack && (
          <div
            style={{
              marginBottom: '1rem',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Now playing: {currentTrack.title} — {currentTrack.artist}
          </div>
        )}

        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={skipPrevious} disabled={!currentTrack} style={{ flexShrink: 0 }}>
            &laquo; Prev
          </button>
          <button onClick={togglePlay} disabled={!currentTrack} style={{ flexShrink: 0 }}>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button onClick={skipNext} disabled={!currentTrack} style={{ flexShrink: 0 }}>
            Next &raquo;
          </button>
          <button
            onClick={toggleShuffle}
            style={{
              flexShrink: 0,
              fontWeight: shuffleOn ? 'bold' : 'normal',
              backgroundColor: shuffleOn ? '#dde3ff' : undefined,
            }}
          >
            Shuffle: {shuffleOn ? 'On' : 'Off'}
          </button>
          <button onClick={cycleRepeat} style={{ flexShrink: 0 }}>
            Repeat: {repeatMode === 'off' ? 'Off' : repeatMode === 'all' ? 'All' : 'One'}
          </button>
        </div>

        {view.kind === 'album' && (
          <div style={{ marginBottom: '1rem' }}>
            <button onClick={openAlbums}>&larr; Back to Albums</button>
          </div>
        )}

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
                      <td onClick={() => { void selectAndPlay(track, displayedTracks); }} style={{ cursor: 'pointer', color: '#666' }}>
                        {track.track_number ?? '—'}
                      </td>
                    )}
                    <td onClick={() => { void selectAndPlay(track, displayedTracks); }} style={{ cursor: 'pointer' }}>{track.title}</td>
                    {view.kind !== 'album' && (
                      <>
                        <td onClick={() => { void selectAndPlay(track, displayedTracks); }} style={{ cursor: 'pointer' }}>{track.artist}</td>
                        <td onClick={() => { void selectAndPlay(track, displayedTracks); }} style={{ cursor: 'pointer' }}>{track.album}</td>
                      </>
                    )}
                    <td onClick={() => { void selectAndPlay(track, displayedTracks); }} style={{ cursor: 'pointer' }}>{formatDuration(track.duration)}</td>
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
