export interface ParsedTrack {
  filepath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  trackNumber: number | null;
}

export interface ParseResult {
  tracks: ParsedTrack[];
  failed: number;
}

export interface DbTrack {
  id: number;
  filepath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  track_number: number | null;
}

export interface DbPlaylist {
  id: number;
  name: string;
}

export interface AlbumSummary {
  album: string;
  artist: string;
  trackCount: number;
}

export type SortKey = 'title' | 'artist' | 'album' | 'duration';
export type RepeatMode = 'off' | 'all' | 'one';

export type View =
  | { kind: 'library' }
  | { kind: 'playlist'; id: number }
  | { kind: 'albums' }
  | { kind: 'album'; album: string; artist: string };
