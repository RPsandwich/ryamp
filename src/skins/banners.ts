export interface BannerPreset {
  id: string;
  label: string;
  src: string;
}

// Auto-discovers any image dropped into src/assets/banners/ at build time --
// no per-file registration needed, same spirit as themes.ts being a fixed
// list but for user-supplied art instead of hardcoded values. Drop a
// PNG/JPG/GIF/WebP in that folder and it becomes a preset automatically.
const modules = import.meta.glob('../assets/banners/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

function labelFromFilename(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, '');
  return withoutExt.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const BANNER_PRESETS: BannerPreset[] = Object.entries(modules)
  .map(([path, src]) => {
    const fileName = path.split('/').pop() ?? path;
    return { id: fileName, label: labelFromFilename(fileName), src };
  })
  .sort((a, b) => a.label.localeCompare(b.label));
