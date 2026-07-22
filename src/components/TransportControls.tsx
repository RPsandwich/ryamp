import type { CSSProperties } from 'react';
import type { DbTrack, RepeatMode } from '../types';
import { formatDuration } from '../utils';
import { Marquee } from './Marquee';

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
  currentTime: number;
  duration: number;
  seek: (time: number) => void;
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
  currentTime,
  duration,
  seek,
}: TransportControlsProps) {
  const fillPercent = duration > 0 ? (Math.min(currentTime, duration) / duration) * 100 : 0;
  return (
    <>
      <div className="led-screen" style={{ padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>
        <Marquee
          text={currentTrack ? `Now playing: ${currentTrack.title} \u2014 ${currentTrack.artist}` : 'Toriamp \u2014 no track loaded'}
          scroll={isPlaying && !!currentTrack}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: 'var(--text-dim)', minWidth: '2.6rem', textAlign: 'right' }}>
          {formatDuration(currentTime)}
        </span>
        <input
          type="range"
          className="scrub-bar"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!currentTrack}
          style={{ '--fill': `${fillPercent}%`, flex: 1 } as CSSProperties}
        />
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: 'var(--text-dim)', minWidth: '2.6rem' }}>
          {formatDuration(duration)}
        </span>
      </div>

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
        <button className="btn-retro" onClick={skipPrevious} disabled={!currentTrack} style={{ flexShrink: 0 }}>
          &laquo; Prev
        </button>
        <button className="btn-retro" onClick={togglePlay} disabled={!currentTrack} style={{ flexShrink: 0 }}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button className="btn-retro" onClick={skipNext} disabled={!currentTrack} style={{ flexShrink: 0 }}>
          Next &raquo;
        </button>
        <button
          className={shuffleOn ? 'btn-retro is-active' : 'btn-retro'}
          onClick={toggleShuffle}
          style={{ flexShrink: 0 }}
        >
          Shuffle: {shuffleOn ? 'On' : 'Off'}
        </button>
        <button
          className={repeatMode !== 'off' ? 'btn-retro is-active' : 'btn-retro'}
          onClick={cycleRepeat}
          style={{ flexShrink: 0 }}
        >
          Repeat: {repeatMode === 'off' ? 'Off' : repeatMode === 'all' ? 'All' : 'One'}
        </button>
      </div>
    </>
  );
}
