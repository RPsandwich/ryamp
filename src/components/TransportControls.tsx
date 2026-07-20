import type { DbTrack, RepeatMode } from '../types';

interface TransportControlsProps {
  currentTrack: DbTrack | null;
  isPlaying: boolean;
  skipPrevious: () => void;
  togglePlay: () => void;
  skipNext: () => void;
  shuffleOn: boolean;
  toggleShuffle: () => void;
  repeatMode: RepeatMode;
  cycleRepeat: () => void;
}

export function TransportControls({
  currentTrack,
  isPlaying,
  skipPrevious,
  togglePlay,
  skipNext,
  shuffleOn,
  toggleShuffle,
  repeatMode,
  cycleRepeat,
}: TransportControlsProps) {
  return (
    <>
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

      <div
        style={{
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
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
    </>
  );
}
