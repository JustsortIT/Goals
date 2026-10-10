import Phaser from 'phaser';
import { FONT_SIZE, FX, GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { SceneKey } from '../config/keys';
import { formatTime } from '../systems/format';
import { addPixelText, centerPixelText } from '../systems/pixelFont';
import type { RunSummary } from './Game';

const RESTART_KEYS = ['SPACE', 'ENTER', 'R'];

/** End screen for both outcomes: reaching the goal, or running out of lives. */
export class GameOver extends Phaser.Scene {
  constructor() {
    super(SceneKey.GameOver);
  }

  create(data: Partial<RunSummary>): void {
    const won = data.won === true;
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    this.cameras.main.setBackgroundColor(won ? '#2b8a6b' : '#8a3b4a');
    this.cameras.main.fadeIn(FX.fadeInMs);

    const title = addPixelText(this, 0, 0, won ? 'LEVEL COMPLETE' : 'GAME OVER', FONT_SIZE.large);
    title.setTint(won ? 0xfff3a8 : 0xffd0d0);
    centerPixelText(title, centerX, centerY - 44);

    const score = addPixelText(this, 0, 0, `SCORE ${data.score ?? 0}`, FONT_SIZE.medium);
    centerPixelText(score, centerX, centerY - 6);

    const stats = addPixelText(
      this,
      0,
      0,
      `PINTS ${data.pints ?? 0}/${data.pintsTotal ?? 0}    TIME ${formatTime(data.timeMs ?? 0)}`,
    );
    centerPixelText(stats, centerX, centerY + 18);

    const touch = this.sys.game.device.input.touch;
    const prompt = addPixelText(
      this,
      0,
      0,
      touch ? 'TAP TO PLAY AGAIN' : 'PRESS SPACE OR R TO PLAY AGAIN',
    );
    centerPixelText(prompt, centerX, centerY + 46);

    // A new tap or click restarts too; a finger still resting on a button does not count.
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.scene.start(SceneKey.Game));

    for (const key of RESTART_KEYS) {
      this.input.keyboard?.on(`keydown-${key}`, (event: KeyboardEvent) => {
        // Ignore auto-repeat from a key that was already held when the level ended.
        if (!event.repeat) {
          this.scene.start(SceneKey.Game);
        }
      });
    }
  }
}
