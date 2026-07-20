import type { RefObject } from 'react';
import { nextVisualizerMode, type VisualizerMode } from '../hooks/useVisualizer';

interface VisualizerProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  mode: VisualizerMode;
  setMode: (updater: (m: VisualizerMode) => VisualizerMode) => void;
}

const MODE_LABEL: Record<VisualizerMode, string> = {
  bars: 'Bars',
  wave: 'Wave',
  plasma: 'Plasma',
};

export function Visualizer({ canvasRef, mode, setMode }: VisualizerProps) {
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
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0.4rem 0 1rem' }}>
        <button className="btn-retro" onClick={() => setMode(nextVisualizerMode)}>
          Visualizer: {MODE_LABEL[mode]}
        </button>
      </div>
    </>
  );
}
