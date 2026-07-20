import type { RefObject } from 'react';
import type { VisualizerMode } from '../hooks/useVisualizer';

interface VisualizerProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  mode: VisualizerMode;
  setMode: (updater: (m: VisualizerMode) => VisualizerMode) => void;
}

export function Visualizer({ canvasRef, mode, setMode }: VisualizerProps) {
  return (
    <>
      <canvas
        ref={canvasRef}
        width={800}
        height={80}
        style={{ width: '100%', height: '80px', display: 'block', background: '#111', borderRadius: '4px' }}
      />
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0.4rem 0 1rem' }}>
        <button onClick={() => setMode((m) => (m === 'bars' ? 'wave' : 'bars'))} style={{ fontSize: '0.75rem' }}>
          Visualizer: {mode === 'bars' ? 'Bars' : 'Wave'}
        </button>
      </div>
    </>
  );
}
