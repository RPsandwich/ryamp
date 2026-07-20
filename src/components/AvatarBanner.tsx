interface AvatarBannerProps {
  src: string | null;
}

// Sits above the entire player like the roof of a house. Renders nothing
// (not even an empty strip) when no avatar image has been picked yet.
export function AvatarBanner({ src }: AvatarBannerProps) {
  if (!src) return null;

  return (
    <div
      className="led-screen"
      style={{
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'center',
        maxHeight: '220px',
        overflow: 'hidden',
      }}
    >
      <img
        src={src}
        alt="Avatar skin"
        style={{ maxWidth: '100%', maxHeight: '220px', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}
