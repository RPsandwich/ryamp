interface AvatarBannerProps {
  src: string | null;
}

// Sits above the entire player like the roof of a house. Renders nothing
// (not even an empty strip) when no avatar image has been picked yet.
//
// Fixed aspect ratio (rather than a fixed max-height) so the banner keeps
// the same proportions at any window width, and object-fit: cover fills the
// whole frame instead of letterboxing images that don't happen to match
// that ratio exactly. object-position: center top favors keeping a
// character's face/head in frame when cropping top-to-bottom, which is the
// more common case for portrait-style avatar art getting cropped into a
// wide banner shape.
export function AvatarBanner({ src }: AvatarBannerProps) {
  if (!src) return null;

  return (
    <div
      className="led-screen"
      style={{
        marginBottom: '1rem',
        width: '100%',
        aspectRatio: '16 / 5',
        overflow: 'hidden',
      }}
    >
      <img
        src={src}
        alt="Avatar skin"
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
      />
    </div>
  );
}

