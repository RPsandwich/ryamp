import { useRef, useState, useEffect } from 'react';
import { readFile } from '@tauri-apps/plugin-fs';
import type { DbTrack, RepeatMode } from '../types';
import { pickRandomIndex } from '../utils';

// Owns the whole audio engine: the Web Audio graph, the currently playing
// track, and shuffle/repeat-aware queue navigation. Exposes just what the UI
// needs to render and control playback.
export function useAudioPlayer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
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
  const [currentTrack, setCurrentTrack] = useState<DbTrack | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [shuffleOn, setShuffleOn] = useState(false);
  const [bassBoostOn, setBassBoostOn] = useState(false);

  // Gain (in dB) the low-shelf filter applies when bass boost is on. 0 when off.
  const BASS_BOOST_GAIN_DB = 9;

  // Keep refs in sync so the long-lived `onended` callback (created when a track
  // starts, but firing whenever it finishes) always reads the latest mode rather
  // than whatever was current when that particular track started playing.
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    shuffleOnRef.current = shuffleOn;
  }, [shuffleOn]);

  const ensureAudioGraph = () => {
    if (audioContextRef.current) return;

    const ctx = new AudioContext({ latencyHint: 'playback' });
    const bassFilter = ctx.createBiquadFilter();
    const compressor = ctx.createDynamicsCompressor();
    const analyser = ctx.createAnalyser();
    const gain = ctx.createGain();

    // Low-shelf filter centered around typical "bass boost" territory.
    // Gain starts at 0 (flat/no effect) and is toggled via setBassBoost
    // below; kept as its own node rather than baked into anything else so
    // it's cheap to extend into a full multi-band EQ later if wanted.
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 150;
    bassFilter.gain.value = 0;

    // Gentle "mastering glue" compression rather than a hard limiter -- the
    // main goal is smoothing out volume differences between tracks ripped/
    // recorded at very different loudness levels, and taking the edge off
    // any harsh peaks, without being audibly "squashed."
    compressor.threshold.value = -18;
    compressor.knee.value = 20;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.15;

    // Analyser sits after bass/compression (not directly off the source), so
    // the visualizer reacts to what's actually audible -- post-EQ, post-
    // compression -- rather than the raw unprocessed signal.
    bassFilter.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);

    audioContextRef.current = ctx;
    bassFilterRef.current = bassFilter;
    compressorRef.current = compressor;
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
    source.connect(bassFilterRef.current!);

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

  const toggleBassBoost = () => {
    setBassBoostOn((prev) => {
      const next = !prev;
      const filter = bassFilterRef.current;
      const ctx = audioContextRef.current;
      if (filter && ctx) {
        // setTargetAtTime ramps smoothly rather than jumping instantly, so
        // toggling mid-playback doesn't produce an audible click/pop.
        filter.gain.setTargetAtTime(next ? BASS_BOOST_GAIN_DB : 0, ctx.currentTime, 0.05);
      }
      return next;
    });
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

  return {
    analyserRef,
    isPlaying,
    currentTrack,
    repeatMode,
    shuffleOn,
    bassBoostOn,
    toggleBassBoost,
    selectAndPlay,
    skipNext,
    skipPrevious,
    toggleShuffle,
    cycleRepeat,
    togglePlay,
  };
}
