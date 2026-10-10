import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH, KIOSK } from '../../../shell/constants';
import { kioskGate, type KioskState } from '../../../shell/kiosk';
import { fetchKioskState, onKioskCredit } from '../../../shell/kioskLink';
import { addText, centerText, QuizText } from '../text';
import { sfx } from '../audio';
import { BUTTON_COLOURS, COLOUR, DATA_KEY, PLAY, SceneKey, TextureKey } from '../config';
import type { GameData } from '../gameData';
import { beginPlay, onKiosk } from '../session';
import type { ChooseData } from './Choose';

/**
 * The title screen, where a game waits. On a kiosk it waits for a coin: the shell says what to
 * show for what the kiosk holds (`kioskGate`), and a tap starts a play only once that says it
 * can. With no kiosk a tap starts a free game.
 */
export class Title extends Phaser.Scene {
  private prompt!: QuizText;
  private detail!: QuizText;
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
    // The four answer colours, as a row of coasters, so a player sees what the buttons will be.
    BUTTON_COLOURS.forEach((colour, index) => {
      this.add
        .circle(GAME_WIDTH / 2 + (index - 1.5) * 36, GAME_HEIGHT * 0.84, 13, colour)
        .setStrokeStyle(2, 0xffffff, 0.55)
        .setDepth(2);
    });
    this.add.image(0, 0, TextureKey.Vignette).setOrigin(0, 0).setDepth(3);

    const centre = GAME_WIDTH / 2;
    const name = addText(this, 0, 0, data.name, FONT_SIZE.title).setTint(COLOUR.gold).setDepth(4);
    centerText(name, centre, GAME_HEIGHT * 0.22);
    const line = addText(this, 0, 0, data.line, FONT_SIZE.medium).setTint(COLOUR.quiet).setDepth(4);
    centerText(line, centre, GAME_HEIGHT * 0.22 + 46);
    this.prompt = addText(this, 0, 0, '', FONT_SIZE.medium).setDepth(4);
    this.detail = addText(this, 0, 0, '').setTint(COLOUR.quiet).setDepth(4);
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
    centerText(this.prompt, GAME_WIDTH / 2, GAME_HEIGHT * 0.58);
    centerText(this.detail, GAME_WIDTH / 2, GAME_HEIGHT * 0.58 + KIOSK.detailGap);
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
    this.scene.start(SceneKey.Choose, { lives } satisfies ChooseData);
  }
}
