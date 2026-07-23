import type { DbTrack, RepeatMode } from '../types';
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
  bassBoostOn: boolean;
  toggleBassBoost: () => void;
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
  bassBoostOn,
  toggleBassBoost,
}: TransportControlsProps) {
  return (
    <>
      <div className="led-screen" style={{ padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>
        <Marquee
          text={currentTrack ? `Now playing: ${currentTrack.title} \u2014 ${currentTrack.artist}` : 'Toriamp \u2014 no track loaded'}
          scroll={isPlaying && !!currentTrack}
        />
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
        <button
          className={bassBoostOn ? 'btn-retro is-active' : 'btn-retro'}
          onClick={toggleBassBoost}
          style={{ flexShrink: 0 }}
        >
          Bass Boost: {bassBoostOn ? 'On' : 'Off'}
        </button>
      </div>
    </>
  );
}
