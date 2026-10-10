/**
 * Takes a picture of the title screen and posts it to the server, which keeps it as what a shared
 * link to the game shows. Only when the page asked for one (`share.ts`); a player's browser never
 * posts anything. The frame is scaled up with its pixels kept square, to the size link previews want
 * (`SHARE_PICTURE`, `shareFrame` in `share.ts`), and the middle is kept.
 */
import Phaser from 'phaser';
import { SHARE_PICTURE } from './constants';
import { shareFrame, sharePictureUrl } from './share';

/** Once the scene has faded in, takes the picture and sends it. Does nothing without an address. */
export function captureSharePicture(scene: Phaser.Scene): void {
  const url = sharePictureUrl();
  if (!url) return;

  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
    scene.renderer.snapshot((snapshot) => {
      if (!(snapshot instanceof HTMLImageElement)) return;
      void send(url, compose(snapshot));
    });
  });
}

function compose(frame: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_PICTURE.width;
  canvas.height = SHARE_PICTURE.height;
  const context = canvas.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  const { scale, x, y } = shareFrame(frame.width, frame.height);
  context.drawImage(frame, x, y, Math.round(frame.width * scale), Math.round(frame.height * scale));
  return canvas;
}

async function send(url: string, canvas: HTMLCanvasElement): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;

  const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
  const body = new FormData();
  body.set('picture', blob, 'share.png');
  try {
    await fetch(url, { method: 'POST', headers: { 'X-CSRF-Token': token, Accept: 'application/json' }, body });
  } catch (error) {
    // The game goes on; the next admin's visit tries again.
    console.warn('Could not send the share picture.', error);
  }
}
