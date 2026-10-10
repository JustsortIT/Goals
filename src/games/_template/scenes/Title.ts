import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH, KIOSK } from '../../../shell/constants';
import { kioskGate, type KioskState } from '../../../shell/kiosk';
import { fetchKioskState, onKioskCredit } from '../../../shell/kioskLink';
import { addPixelText, centerPixelText } from '../../../shell/pixelFont';
import { COLOUR, DATA_KEY, PLAY, SceneKey } from '../config';
import type { GameData } from '../gameData';
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

    const centre = GAME_WIDTH / 2;
    const name = addPixelText(this, 0, 0, data.name, FONT_SIZE.title).setTint(COLOUR.gold);
    centerPixelText(name, centre, GAME_HEIGHT * 0.3);
    const line = addPixelText(this, 0, 0, data.line).setTint(COLOUR.quiet);
    centerPixelText(line, centre, GAME_HEIGHT * 0.3 + 32);
    this.prompt = addPixelText(this, 0, 0, '', FONT_SIZE.medium);
    this.detail = addPixelText(this, 0, 0, '').setTint(COLOUR.quiet);
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
    if (this.scene.isActive()) this.show();
  }

  private show(): void {
    const gate = onKiosk()
      ? kioskGate(this.state)
      : { prompt: 'TAP TO START', detail: 'FREE PLAY' };
    this.prompt.setText(gate.prompt);
    this.detail.setText(gate.detail);
    centerPixelText(this.prompt, GAME_WIDTH / 2, GAME_HEIGHT * 0.62);
    centerPixelText(this.detail, GAME_WIDTH / 2, GAME_HEIGHT * 0.62 + KIOSK.detailGap);
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
