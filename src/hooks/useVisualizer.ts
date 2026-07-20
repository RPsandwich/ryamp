import { useRef, useState, useEffect, type RefObject } from 'react';

export type VisualizerMode = 'bars' | 'wave';

// Basic MVP visualizer loop — reads directly from whatever AnalyserNode the
// audio engine hands it. Runs only while a track is actually playing.
export function useVisualizer(analyserRef: RefObject<AnalyserNode | null>, isPlaying: boolean) {
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('bars');
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualizerRafRef = useRef<number | null>(null);
  const visualizerModeRef = useRef(visualizerMode);

  // Lets the (already-running) draw loop see mode toggles without restarting
  // the effect — same stale-closure-avoidance pattern used for repeat/shuffle.
  useEffect(() => {
    visualizerModeRef.current = visualizerMode;
  }, [visualizerMode]);

  useEffect(() => {
    if (!isPlaying) return;

    const canvas = visualizerCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      visualizerRafRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;
      ctx2d.clearRect(0, 0, width, height);

      if (visualizerModeRef.current === 'bars') {
        analyser.getByteFrequencyData(dataArray);
        const barCount = 64;
        const step = Math.floor(bufferLength / barCount);
        const barWidth = width / barCount;
        for (let i = 0; i < barCount; i++) {
          const value = dataArray[i * step] ?? 0;
          const barHeight = (value / 255) * height;
          const hue = (i / barCount) * 300; // 0 (red) through ~300 (magenta), skips wrapping back to red
          ctx2d.fillStyle = `hsl(${hue}, 90%, 55%)`;
          ctx2d.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
        }
      } else {
        analyser.getByteTimeDomainData(dataArray);
        const gradient = ctx2d.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, 'hsl(0, 90%, 55%)');
        gradient.addColorStop(0.17, 'hsl(50, 90%, 55%)');
        gradient.addColorStop(0.34, 'hsl(100, 90%, 55%)');
        gradient.addColorStop(0.5, 'hsl(180, 90%, 55%)');
        gradient.addColorStop(0.67, 'hsl(220, 90%, 55%)');
        gradient.addColorStop(0.84, 'hsl(280, 90%, 55%)');
        gradient.addColorStop(1, 'hsl(320, 90%, 55%)');
        ctx2d.lineWidth = 2;
        ctx2d.strokeStyle = gradient;
        ctx2d.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
          x += sliceWidth;
        }
        ctx2d.lineTo(width, height / 2);
        ctx2d.stroke();
      }
    };

    draw();

    return () => {
      if (visualizerRafRef.current !== null) {
        cancelAnimationFrame(visualizerRafRef.current);
        visualizerRafRef.current = null;
      }
    };
  }, [isPlaying, analyserRef]);

  return { visualizerMode, setVisualizerMode, visualizerCanvasRef };
}
