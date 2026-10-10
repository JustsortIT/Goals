import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH, KIOSK } from '../../../shell/constants';
import { kioskGate, type KioskState } from '../../../shell/kiosk';
import { fetchKioskState, onKioskCredit } from '../../../shell/kioskLink';
import { sfx } from '../audio';
import { addPixelText, centerPixelText } from '../../../shell/pixelFont';
import { COLOUR, DATA_KEY, PLAY, SceneKey, TextureKey } from '../config';
import type { GameData } from '../gameData';
import { addGoalLayers, drawGoal } from '../goalArt';
import { goalGeometry, levelScale, targetSpots } from '../logic';
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
    // The goal, as it stands at the first level, behind the name.
    const layers = addGoalLayers(this);
    const geometry = goalGeometry(levelScale(1, data.shrink));
    drawGoal(
      layers,
      geometry,
      data.targets,
      targetSpots(geometry, data.targets),
      data.targets.map(() => false),
    );
    this.add.image(0, 0, TextureKey.Vignette).setOrigin(0, 0).setDepth(3);
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOUR.wash, 0.5)
      .setOrigin(0, 0)
      .setDepth(3.1);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.86, TextureKey.Ball, '0').setDepth(3.2);

    const centre = GAME_WIDTH / 2;
    const name = addPixelText(this, 0, 0, data.name, FONT_SIZE.title)
      .setTint(COLOUR.gold)
      .setDepth(4);
    centerPixelText(name, centre, GAME_HEIGHT * 0.2);
    const line = addPixelText(this, 0, 0, data.line, FONT_SIZE.medium)
      .setTint(COLOUR.quiet)
      .setDepth(4);
    centerPixelText(line, centre, GAME_HEIGHT * 0.2 + 36);
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
    centerPixelText(this.prompt, GAME_WIDTH / 2, GAME_HEIGHT * 0.56);
    centerPixelText(this.detail, GAME_WIDTH / 2, GAME_HEIGHT * 0.56 + KIOSK.detailGap);
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
