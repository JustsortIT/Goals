import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH, KIOSK } from '../../../shell/constants';
import { kioskGate, type KioskState } from '../../../shell/kiosk';
import { fetchKioskState, onKioskCredit } from '../../../shell/kioskLink';
import { addPixelText, centerPixelText } from '../../../shell/pixelFont';
import { GLASS_ART } from '../art';
import { sfx } from '../audio';
import { COLOUR, DATA_KEY, GLASS, PLAY, SceneKey, TextureKey } from '../config';
import type { GameData } from '../gameData';
import { TapsView } from '../tapsView';
import { beginPlay, onKiosk } from '../session';
import type { PlayData } from './Play';

/**
 * The title screen, where a game waits. On a kiosk it waits for a coin: the shell says what to
 * show for what the kiosk holds (`kioskGate`), and a tap starts a play only once that says it
 * can. With no kiosk a tap starts a free game.
 */
export class Title extends Phaser.Scene {
  private prompt!: Phaser.GameObjects.BitmapText;
  private detail!: Phaser.GameObjects.BitmapText;
  private state: KioskState | null = null;
  private starting = false;

  constructor() {
    super(SceneKey.Title);
  }

  create(): void {
    const data = this.registry.get(DATA_KEY) as GameData;
    this.state = null;
    this.starting = false;

    this.add.image(0, 0, TextureKey.Backdrop).setOrigin(0, 0);
    new TapsView(this, 1.2, data.drink).update(0, [0, 0, 0]);
    // An empty glass on the bar, waiting.
    const glassX = GLASS.x - GLASS_ART.width / 2;
    const glassY = GLASS.top - GLASS_ART.above;
    this.add.image(GLASS.x - 70, GLASS.bottom - 6, TextureKey.Shadow).setOrigin(0, 0);
    this.add.image(glassX, glassY, TextureKey.GlassBack).setOrigin(0, 0);
    this.add.image(glassX, glassY, TextureKey.Glass).setOrigin(0, 0);
    this.add.image(0, 0, TextureKey.Vignette).setOrigin(0, 0).setDepth(3);
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOUR.wash, 0.5)
      .setOrigin(0, 0)
      .setDepth(3.1);

    const centre = GAME_WIDTH / 2;
    const name = addPixelText(this, 0, 0, data.name, FONT_SIZE.title)
      .setTint(COLOUR.gold)
      .setDepth(4);
    centerPixelText(name, centre, GAME_HEIGHT * 0.22);
    const line = addPixelText(this, 0, 0, data.line, FONT_SIZE.medium)
      .setTint(COLOUR.quiet)
      .setDepth(4);
    centerPixelText(line, centre, GAME_HEIGHT * 0.22 + 36);
    this.prompt = addPixelText(this, 0, 0, '', FONT_SIZE.medium).setDepth(4);
    this.detail = addPixelText(this, 0, 0, '').setTint(COLOUR.quiet).setDepth(4);
    this.show();

    if (onKiosk()) {
      const ask = () => void this.ask();
      const stopListening = onKioskCredit(ask);
      const poll = this.time.addEvent({ delay: KIOSK.pollMs, loop: true, callback: ask });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        stopListening();
        poll.remove();
      });
      ask();
    }
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => void this.begin());
  }

  private async ask(): Promise<void> {
    this.state = await fetchKioskState();
    if (this.state) sfx.enabled = this.state.sound;
    if (this.scene.isActive()) this.show();
  }

  private show(): void {
    const gate = onKiosk()
      ? kioskGate(this.state)
      : { prompt: 'TAP TO START', detail: 'FREE PLAY' };
    this.prompt.setText(gate.prompt);
    this.detail.setText(gate.detail);
    centerPixelText(this.prompt, GAME_WIDTH / 2, GAME_HEIGHT * 0.6);
    centerPixelText(this.detail, GAME_WIDTH / 2, GAME_HEIGHT * 0.6 + KIOSK.detailGap);
  }

  private async begin(): Promise<void> {
    if (this.starting) return;
    if (onKiosk() && !kioskGate(this.state).canStart) return;

    this.starting = true;
    const lives = await beginPlay(PLAY.freeLives);
    if (lives === null) {
      // The kiosk would not start a play: what it holds has changed. Ask again and wait.
      this.starting = false;
      void this.ask();
      return;
    }
    this.scene.start(SceneKey.Play, { lives } satisfies PlayData);
  }
}
