import type { RefObject } from 'react';
import { nextVisualizerMode, nextColorMode, type VisualizerMode, type VisualizerColorMode } from '../hooks/useVisualizer';

interface VisualizerProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  mode: VisualizerMode;
  setMode: (updater: (m: VisualizerMode) => VisualizerMode) => void;
  colorMode: VisualizerColorMode;
  setColorMode: (updater: (m: VisualizerColorMode) => VisualizerColorMode) => void;
}

const MODE_LABEL: Record<VisualizerMode, string> = {
  bars: 'Bars',
  wave: 'Wave',
  plasma: 'Plasma',
};

const COLOR_MODE_LABEL: Record<VisualizerColorMode, string> = {
  rainbow: 'Rainbow',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
};

export function Visualizer({ canvasRef, mode, setMode, colorMode, setColorMode }: VisualizerProps) {
  return (
    <>
      {/*
        No width/height attributes here anymore -- the useVisualizer hook's
        ResizeObserver sets the canvas's actual pixel buffer size (scaled by
        devicePixelRatio) to match whatever this renders at on screen, so it
        stays crisp instead of being CSS-stretched from a fixed 800x80 buffer.
      */}
      <div className="led-screen">
        <canvas ref={canvasRef} style={{ width: '100%', height: '80px', display: 'block' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', margin: '0.4rem 0 1rem' }}>
        <button className="btn-retro" onClick={() => setMode(nextVisualizerMode)}>
          Visualizer: {MODE_LABEL[mode]}
        </button>
        <button className="btn-retro" onClick={() => setColorMode(nextColorMode)}>
          Color: {COLOR_MODE_LABEL[colorMode]}
        </button>
      </div>
    </>
  );
}
