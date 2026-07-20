import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface MarqueeProps {
  text: string;
  // When true, always animates regardless of whether the text actually
  // overflows the container -- used to always-scroll while a track is
  // playing (an experiment to see how it feels vs. only-scroll-on-overflow).
  scroll: boolean;
}

// Pixels-per-second travel speed. Duration is derived from the actual
// distance traveled rather than fixed, so a barely-clipped title and a much
// longer one both feel like the same ticker speed instead of one crawling
// and one racing.
const SCROLL_SPEED_PX_PER_SEC = 60;

// A small buffer past the edges so the text is fully clipped by the
// container's `overflow: hidden` before the loop restarts -- otherwise a
// single pixel of it could still peek in at the exact reset frame.
const EDGE_BUFFER_PX = 24;

// Single-pass ticker: text enters fully off-screen on the right, travels
// straight across, exits fully off-screen on the left, then (invisibly,
// since it's clipped the whole time) jumps back to the right and repeats.
export function Marquee({ text, scroll }: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const copyRef = useRef<HTMLSpanElement | null>(null);
  const [distances, setDistances] = useState({ containerWidth: 0, textWidth: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const copy = copyRef.current;
    if (!container || !copy) return;

    const measure = () => {
      setDistances({ containerWidth: container.clientWidth, textWidth: copy.offsetWidth });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  const { containerWidth, textWidth } = distances;
  const startPx = containerWidth + EDGE_BUFFER_PX; // fully off-screen right
  const endPx = -(textWidth + EDGE_BUFFER_PX); // fully off-screen left
  const totalDistance = startPx - endPx;
  const durationSeconds = Math.max(4, totalDistance / SCROLL_SPEED_PX_PER_SEC);

  return (
    <div ref={containerRef} className="marquee">
      <span
        ref={copyRef}
        className={scroll ? 'marquee__copy marquee__copy--scrolling' : 'marquee__copy'}
        style={
          scroll
            ? ({
                '--marquee-start': `${startPx}px`,
                '--marquee-end': `${endPx}px`,
                '--marquee-duration': `${durationSeconds}s`,
              } as CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}
