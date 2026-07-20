import { useState, useEffect, useMemo } from 'react';
import Database from '@tauri-apps/plugin-sql';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readFile } from '@tauri-apps/plugin-fs';
import { parseBuffer } from 'music-metadata';
import type { DbTrack, DbPlaylist, AlbumSummary, SortKey, View, ParsedTrack, ParseResult } from '../types';

// Owns the SQLite-backed music library: tracks, playlists, albums, folder
// import/scan, sorting, and which "view" (library/playlist/albums/album) is
// currently on screen.
export function useLibrary() {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [library, setLibrary] = useState<DbTrack[]>([]);

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

  const displayedTracks =
    view.kind === 'playlist' ? sortTracks(playlistTracks) : view.kind === 'album' ? albumTracks : sortTracks(library);
  const activePlaylist = view.kind === 'playlist' ? playlists.find((p) => p.id === view.id) : undefined;

  const headerLabel =
    view.kind === 'playlist'
      ? `${activePlaylist?.name ?? 'Playlist'} (${playlistTracks.length} tracks)`
      : view.kind === 'album'
        ? `${view.album} — ${view.artist} (${albumTracks.length} tracks)`
        : `Library (${library.length} tracks)`;

  return {
    selectedFolder,
    library,
    sortKey,
    sortDir,
    playlists,
    view,
    newPlaylistName,
    setNewPlaylistName,
    isImporting,
    importStatus,
    albums,
    albumTracks,
    displayedTracks,
    headerLabel,
    selectPlaylist,
    openAlbums,
    openAlbum,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    handleSort,
    pickFolder,
  };
}
