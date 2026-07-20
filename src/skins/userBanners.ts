import { appLocalDataDir, join } from '@tauri-apps/api/path';
import { mkdir, readDir, copyFile, remove, exists } from '@tauri-apps/plugin-fs';

// Where uploaded avatar images actually live on disk, persistently, for a
// real installed copy of the app -- NOT src/assets/banners/, which is a
// source folder Vite bundles at build time and doesn't exist inside a
// packaged app at all. This is the runtime equivalent: a real writable
// folder under the OS's app-data directory, resolved to an absolute path
// (rather than using the BaseDirectory shorthand) so it's covered by the
// same broad fs:scope the rest of the app already relies on.
async function getUserBannersDir(): Promise<string> {
  const dataDir = await appLocalDataDir();
  const dir = await join(dataDir, 'banners');
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

export interface UserBanner {
  fileName: string;
  path: string;
}

function labelFromFilename(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, '');
  return withoutExt.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function listUserBanners(): Promise<UserBanner[]> {
  const dir = await getUserBannersDir();
  const entries = await readDir(dir);
  return entries
    .filter((e) => !e.isDirectory && e.name)
    .map((e) => ({ fileName: e.name as string, path: `${dir}/${e.name}` }))
    .sort((a, b) => labelFromFilename(a.fileName).localeCompare(labelFromFilename(b.fileName)));
}

// Copies a picked file into the persistent gallery folder rather than just
// remembering its original location -- so it survives the source file being
// moved/deleted, and shows up as a permanent gallery entry like the bundled
// presets, not a one-off "last thing you picked."
export async function importUserBanner(sourcePath: string): Promise<UserBanner> {
  const dir = await getUserBannersDir();
  const originalName = sourcePath.split(/[/\\]/).pop() ?? 'avatar.png';

  let destName = originalName;
  let destPath = `${dir}/${destName}`;

  // Avoid clobbering an existing file with the same name by appending a
  // timestamp instead.
  if (await exists(destPath)) {
    const dot = originalName.lastIndexOf('.');
    const base = dot >= 0 ? originalName.slice(0, dot) : originalName;
    const ext = dot >= 0 ? originalName.slice(dot) : '';
    destName = `${base}-${Date.now()}${ext}`;
    destPath = `${dir}/${destName}`;
  }

  await copyFile(sourcePath, destPath);
  return { fileName: destName, path: destPath };
}

export async function removeUserBanner(path: string): Promise<void> {
  await remove(path);
}

export { labelFromFilename };
