/**
 * The picture a shared link to the game shows: the title screen, scaled up with its pixels kept
 * square to the size link previews want, with the middle kept (`SHARE_PICTURE`). This decides the
 * scale and the crop; `sharePicture.ts` takes the picture and posts it.
 *
 * Where to post it comes from the page: `data-game-share-url` on `#app`, read by `boot.ts`. The page
 * gives the address only when the game has no picture of the version that is playing and an admin is
 * looking; otherwise there is none and nothing is taken. No Phaser imports.
 */
import { SHARE_PICTURE } from './constants';

let shareUrl: string | null = null;

export function setShareUrl(url: string | null | undefined): void {
  shareUrl = url || null;
}

export function sharePictureUrl(): string | null {
  return shareUrl;
}

/** The scale, and where the frame's corner goes, so the frame fills the picture. */
export function shareFrame(width: number, height: number): { scale: number; x: number; y: number } {
  const scale = Math.max(SHARE_PICTURE.width / width, SHARE_PICTURE.height / height);
  return {
    scale,
    x: Math.round((SHARE_PICTURE.width - width * scale) / 2),
    y: Math.round((SHARE_PICTURE.height - height * scale) / 2),
  };
}
