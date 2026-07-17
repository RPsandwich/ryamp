import { useRef, useState, useEffect } from 'react';
import Database from '@tauri-apps/plugin-sql';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readFile } from '@tauri-apps/plugin-fs';
import { parseBuffer } from 'music-metadata';
import { convertFileSrc } from '@tauri-apps/api/core';

interface ParsedTrack {
  filepath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
}

interface DbTrack {
  id: number;
  filepath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
}

function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [library, setLibrary] = useState<DbTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<DbTrack | null>(null);

  // Load the library from the DB on startup
  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    const db = await Database.load('sqlite:ryamp.db');
    const result = await db.select<DbTrack[]>('SELECT * FROM tracks ORDER BY artist, album, title');
    setLibrary(result);
  };

  const setupAudioGraph = () => {
    if (!audioRef.current || audioContextRef.current) return;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(audioRef.current);
    const analyser = audioContext.createAnalyser();
    const gain = audioContext.createGain();

    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    sourceRef.current = source;
    analyserRef.current = analyser;
    gainRef.current = gain;
  };

  const playTrack = async (track: DbTrack) => {
    setCurrentTrack(track);
    setupAudioGraph();

    // Fetch the file as bytes and create a blob URL, instead of relying on asset:// streaming
    const fileBytes = await readFile(track.filepath);
    const blob = new Blob([fileBytes], { type: 'audio/mpeg' });
    const blobUrl = URL.createObjectURL(blob);

    if (audioRef.current) {
      audioRef.current.src = blobUrl;
    }

    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    setTimeout(async () => {
      if (audioRef.current) {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    }, 0);
  };

  const togglePlay = async () => {
    if (!audioRef.current || !currentTrack) return;

    setupAudioGraph();

    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      await audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
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

  const parseTags = async (filePaths: string[]): Promise<ParsedTrack[]> => {
    const results: ParsedTrack[] = [];

    for (const filepath of filePaths) {
      try {
        const fileBytes = await readFile(filepath);
        const metadata = await parseBuffer(fileBytes, 'audio/mpeg');

        results.push({
          filepath,
          title: metadata.common.title || filepath.split('/').pop() || 'Unknown',
          artist: metadata.common.artist || 'Unknown Artist',
          album: metadata.common.album || 'Unknown Album',
          duration: metadata.format.duration || 0,
        });
      } catch (err) {
        console.error(`Failed to parse ${filepath}:`, err);
      }
    }

    return results;
  };

  const saveTracksToDb = async (tracks: ParsedTrack[]) => {
    const db = await Database.load('sqlite:ryamp.db');

    for (const track of tracks) {
      await db.execute(
        `INSERT OR IGNORE INTO tracks (filepath, title, artist, album, duration)
         VALUES ($1, $2, $3, $4, $5)`,
        [track.filepath, track.title, track.artist, track.album, track.duration]
      );
    }
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
    const mp3s = await findMp3sRecursive(folderPath);
    const tracks = await parseTags(mp3s);
    await saveTracksToDb(tracks);
    await loadLibrary(); // refresh the visible library after import
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>ryamp</h1>

      {currentTrack && (
        <audio
          ref={audioRef}
          onEnded={() => setIsPlaying(false)}
        />
      )}

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
        <button onClick={pickFolder}>Import Music Folder</button>
        {selectedFolder && <span style={{ marginLeft: '1rem' }}>Last imported: {selectedFolder}</span>}
      </div>

      <div>
        <strong>Library ({library.length} tracks)</strong>
        <table style={{ width: '100%', marginTop: '0.5rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              <th>Title</th>
              <th>Artist</th>
              <th>Album</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {library.map((track) => (
              <tr
                key={track.id}
                onClick={() => playTrack(track)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: currentTrack?.id === track.id ? '#eee' : 'transparent',
                }}
              >
                <td>{track.title}</td>
                <td>{track.artist}</td>
                <td>{track.album}</td>
                <td>{formatDuration(track.duration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;