import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH, KIOSK } from '../../../shell/constants';
import { addPixelText, centerPixelText } from '../../../shell/pixelFont';
import { COLOUR, SceneKey, TextureKey } from '../config';

export interface OverData {
  score: number;
  /** Where the play came in the week on this kiosk's leaderboard, if it has one. */
  rank: number | null;
  /** Every goal was cleared. */
  won: boolean;
}

/** How long before a tap is taken, so the tap that was meant for the game does not skip this. */
const TAP_AFTER_MS = 800;

/**
 * The end of a play: its score, and where it came. It goes back to the title screen at a tap,
 * or by itself after a while, since on a kiosk the next player may be someone else. A place on
 * the leaderboard is for show: nothing is ever won. The shell can also take three initials for
 * a high score (`sendInitials`), which this game leaves out.
 */
export class Over extends Phaser.Scene {
  constructor() {
    super(SceneKey.Over);
  }

  create(data: OverData): void {
    this.add.image(0, 0, TextureKey.Backdrop).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOUR.wash, 0.6).setOrigin(0, 0);

    const centre = GAME_WIDTH / 2;
    const heading = addPixelText(
      this,
      0,
      0,
      data.won ? 'FULL TIME' : 'GAME OVER',
      FONT_SIZE.large,
    ).setTint(COLOUR.gold);
    centerPixelText(heading, centre, GAME_HEIGHT * 0.25);
    if (data.won) {
      const cleared = addPixelText(this, 0, 0, 'ALL THE GOALS CLEARED').setTint(COLOUR.quiet);
      centerPixelText(cleared, centre, GAME_HEIGHT * 0.25 + 24);
    }
    const score = addPixelText(this, 0, 0, `SCORE ${data.score}`, FONT_SIZE.medium);
    centerPixelText(score, centre, GAME_HEIGHT * 0.5);
    if (data.rank !== null) {
      const rank = addPixelText(this, 0, 0, `NUMBER ${data.rank} THIS WEEK`).setTint(COLOUR.quiet);
      centerPixelText(rank, centre, GAME_HEIGHT * 0.5 + 20);
    }
    const again = addPixelText(this, 0, 0, 'TAP TO GO ON').setTint(COLOUR.quiet);
    centerPixelText(again, centre, GAME_HEIGHT * 0.78);

    const back = () => this.scene.start(SceneKey.Title);
    this.time.delayedCall(TAP_AFTER_MS, () =>
      this.input.once(Phaser.Input.Events.POINTER_DOWN, back),
    );
    this.time.delayedCall(KIOSK.endScreenMs, back);
  }
}
