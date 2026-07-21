import { useRef, useState, useEffect, type RefObject } from 'react';

export type VisualizerMode = 'bars' | 'wave' | 'plasma';

const MODE_ORDER: VisualizerMode[] = ['bars', 'wave', 'plasma'];

export function nextVisualizerMode(mode: VisualizerMode): VisualizerMode {
  const i = MODE_ORDER.indexOf(mode);
  return MODE_ORDER[(i + 1) % MODE_ORDER.length];
}

export type VisualizerColorMode = 'rainbow' | 'red' | 'yellow' | 'green' | 'blue';

const COLOR_MODE_ORDER: VisualizerColorMode[] = ['rainbow', 'red', 'yellow', 'green', 'blue'];

export function nextColorMode(mode: VisualizerColorMode): VisualizerColorMode {
  const i = COLOR_MODE_ORDER.indexOf(mode);
  return COLOR_MODE_ORDER[(i + 1) % COLOR_MODE_ORDER.length];
}

// Fixed hues (degrees) used when a solid color mode is selected, in place of
// the rainbow hue sweep. Chosen for punch against a dark background rather
// than textbook-exact red/yellow/green/blue.
const FIXED_HUES: Record<Exclude<VisualizerColorMode, 'rainbow'>, number> = {
  red: 355,
  yellow: 50,
  green: 135,
  blue: 205,
};

// Visualizer loop — reads directly from whatever AnalyserNode the audio
// engine hands it. Runs only while a track is actually playing.
export function useVisualizer(analyserRef: RefObject<AnalyserNode | null>, isPlaying: boolean) {
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('bars');
  const [colorMode, setColorMode] = useState<VisualizerColorMode>('rainbow');
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualizerRafRef = useRef<number | null>(null);
  const visualizerModeRef = useRef(visualizerMode);
  const colorModeRef = useRef(colorMode);
  const rotationRef = useRef(0);

  // Logical (CSS-pixel) size of the canvas, kept in sync via ResizeObserver
  // below so all drawing math matches what's actually on screen instead of
  // being locked to a fixed backing buffer that just gets CSS-stretched.
  const sizeRef = useRef({ width: 800, height: 80 });

  // Lets the (already-running) draw loop see mode toggles without restarting
  // the effect — same stale-closure-avoidance pattern used for repeat/shuffle.
  useEffect(() => {
    visualizerModeRef.current = visualizerMode;
  }, [visualizerMode]);

  useEffect(() => {
    colorModeRef.current = colorMode;
  }, [colorMode]);

  // Keep the canvas's backing pixel buffer matched to its actual displayed
  // size (times devicePixelRatio), so it stays crisp at any window width
  // instead of the old fixed 800x80 buffer stretched via CSS.
  useEffect(() => {
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;

    const applySize = (cssWidth: number, cssHeight: number) => {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(cssWidth));
      const height = Math.max(1, Math.round(cssHeight));
      sizeRef.current = { width, height };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      // Reset then scale so the draw loop below can keep working entirely in
      // CSS pixels (sizeRef.current.width/height) rather than raw buffer
      // pixels — same math as before, just no longer stale after a resize.
      const ctx2d = canvas.getContext('2d');
      ctx2d?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Set initial size immediately — ResizeObserver's first callback fires
    // asynchronously, and we don't want to flash the old fixed size.
    const rect = canvas.getBoundingClientRect();
    applySize(rect.width || 800, rect.height || 80);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.contentBoxSize?.[0];
        if (box) {
          applySize(box.inlineSize, box.blockSize);
        } else {
          applySize(entry.contentRect.width, entry.contentRect.height);
        }
      }
    });
    observer.observe(canvas);

    return () => observer.disconnect();
  }, []);

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

      const { width, height } = sizeRef.current;
      const mode = colorModeRef.current;
      const isRainbow = mode === 'rainbow';
      const fixedHue = isRainbow ? 0 : FIXED_HUES[mode];

      ctx2d.clearRect(0, 0, width, height);

      if (visualizerModeRef.current === 'bars') {
        analyser.getByteFrequencyData(dataArray);
        const barCount = 64;
        const step = Math.floor(bufferLength / barCount);
        const barWidth = width / barCount;
        for (let i = 0; i < barCount; i++) {
          const value = dataArray[i * step] ?? 0;
          const barHeight = (value / 255) * height;
          if (isRainbow) {
            const hue = (i / barCount) * 300; // 0 (red) through ~300 (magenta), skips wrapping back to red
            ctx2d.fillStyle = `hsl(${hue}, 90%, 55%)`;
          } else {
            // Solid color mode: hue stays fixed, louder bars get lighter
            // instead of shifting hue, so there's still visual variation.
            const lightness = 45 + (value / 255) * 25;
            ctx2d.fillStyle = `hsl(${fixedHue}, 90%, ${lightness}%)`;
          }
          ctx2d.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
        }
      } else if (visualizerModeRef.current === 'wave') {
        analyser.getByteTimeDomainData(dataArray);
        ctx2d.lineWidth = 2;
        if (isRainbow) {
          const gradient = ctx2d.createLinearGradient(0, 0, width, 0);
          gradient.addColorStop(0, 'hsl(0, 90%, 55%)');
          gradient.addColorStop(0.17, 'hsl(50, 90%, 55%)');
          gradient.addColorStop(0.34, 'hsl(100, 90%, 55%)');
          gradient.addColorStop(0.5, 'hsl(180, 90%, 55%)');
          gradient.addColorStop(0.67, 'hsl(220, 90%, 55%)');
          gradient.addColorStop(0.84, 'hsl(280, 90%, 55%)');
          gradient.addColorStop(1, 'hsl(320, 90%, 55%)');
          ctx2d.strokeStyle = gradient;
        } else {
          ctx2d.strokeStyle = `hsl(${fixedHue}, 90%, 55%)`;
        }
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
      } else {
        // Plasma: a Milkdrop-inspired generative mode. Rather than directly
        // plotting frequency/time data, it drives a rotating ring of
        // particles + a pulsing glow from the data, so it reacts to the
        // music without being a literal 1:1 chart of it.
        analyser.getByteFrequencyData(dataArray);

        const cx = width / 2;
        const cy = height / 2;
        const maxRadius = Math.min(width, height) / 2 - 2;
        const baseRadius = maxRadius * 0.35;

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const avgVolume = sum / bufferLength / 255; // 0..1

        // Continuous slow rotation, sped up a bit by overall volume so it
        // stays alive during quiet passages but energizes on loud ones.
        rotationRef.current += 0.004 + avgVolume * 0.01;

        const glowHue = isRainbow ? (rotationRef.current * 40) % 360 : fixedHue;

        // Background glow, pulsing with volume.
        const glow = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
        glow.addColorStop(0, `hsla(${glowHue}, 80%, 50%, ${0.15 + avgVolume * 0.25})`);
        glow.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
        ctx2d.fillStyle = glow;
        ctx2d.fillRect(0, 0, width, height);

        const particleCount = 48;
        const step = Math.floor(bufferLength / particleCount);
        const points: Array<[number, number]> = [];

        for (let i = 0; i < particleCount; i++) {
          const value = dataArray[i * step] ?? 0;
          const amp = value / 255;
          const angle = (i / particleCount) * Math.PI * 2 + rotationRef.current;
          const radius = baseRadius + amp * (maxRadius - baseRadius);
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          points.push([x, y]);

          const particleHue = isRainbow ? ((i / particleCount) * 360 + rotationRef.current * 40) % 360 : fixedHue;
          ctx2d.fillStyle = `hsl(${particleHue}, 90%, ${55 + amp * 20}%)`;
          ctx2d.beginPath();
          ctx2d.arc(x, y, 1.5 + amp * 2.5, 0, Math.PI * 2);
          ctx2d.fill();
        }

        // Faint connecting web between particles for a generative, non-literal feel.
        ctx2d.strokeStyle = `hsla(${glowHue}, 80%, 70%, 0.25)`;
        ctx2d.lineWidth = 1;
        ctx2d.beginPath();
        points.forEach(([x, y], i) => {
          if (i === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        });
        ctx2d.closePath();
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

  return { visualizerMode, setVisualizerMode, colorMode, setColorMode, visualizerCanvasRef };
}
