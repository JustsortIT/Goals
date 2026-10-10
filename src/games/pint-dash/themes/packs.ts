/**
 * The art packs written by `npm run art:generate`, found at build time. Adding a folder
 * under `packs/` is all it takes for a theme to become selectable. No Phaser imports.
 */

export interface PackImage {
  file: string;
  width: number;
  height: number;
}

export interface PackTileset {
  /** Corner code (see `generated/corners.ts`) to file name. */
  tiles: Record<string, string>;
}

/** An animation of the hero, made from the hero image. */
export interface PackAnimation {
  /** The frames to play, in order. */
  frames: string[];
  /** Size of every frame, and where the hero image sits inside it. */
  width: number;
  height: number;
  heroX: number;
  heroY: number;
}

export interface PackManifest {
  name: string;
  tileSize: number;
  images: Record<string, PackImage>;
  tilesets: Record<string, PackTileset>;
  /** `run` and `jump`, when the pack has them. */
  animations?: Record<string, PackAnimation>;
  /**
   * Colours for the sky and the two rows of skyline, when the pack has its own. The
   * pictures of each row are the images `backdrop-far` and `backdrop-near`, or
   * `backdrop-far-1`, `backdrop-far-2`, ... when a row is several pictures side by side.
   */
  backdrop?: { sky?: string; far?: string; near?: string };
}

const manifests = import.meta.glob<PackManifest>('./packs/*/theme.json', {
  eager: true,
  import: 'default',
});
const urls = import.meta.glob<string>('./packs/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Every pack, by folder name. */
export const PACKS: Record<string, PackManifest> = Object.fromEntries(
  Object.entries(manifests).map(([file, manifest]) => [file.split('/')[2], manifest]),
);

/** The URL the bundler serves one of a pack's files from. */
export function packUrl(pack: string, file: string): string {
  const url = urls[`./packs/${pack}/${file}`];
  if (!url) {
    throw new Error(`Pack "${pack}" has no file "${file}".`);
  }
  return url;
}
