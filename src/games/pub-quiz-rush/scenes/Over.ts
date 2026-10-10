import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH, KIOSK } from '../../../shell/constants';
import { stepLetter } from '../../../shell/kiosk';
import { fetchLeaderboard, sendInitials } from '../../../shell/kioskLink';
import { addText, centerText, QuizText } from '../text';
import { sfx } from '../audio';
import { COLOUR, SceneKey, TextureKey } from '../config';
import { scoreRows } from '../scores';
import { onKiosk } from '../session';

export interface OverData {
  score: number;
  /** Where the play came in the week on this kiosk's leaderboard, if it has one. */
  rank: number | null;
  /** Every goal was cleared. */
  won: boolean;
  /** The server's id for the play, and whether it came high enough to ask for initials. */
  playId: number | null;
  asksInitials: boolean;
}

/** How long before a tap is taken, so the tap that was meant for the game does not skip this. */
const TAP_AFTER_MS = 800;
/** A finger held on a letter's button steps it again after this long, and then this often. */
const HOLD = { firstMs: 380, everyMs: 130 } as const;
/** How many places of the week's scores there is room to show. */
const ROWS = 5;
const COLUMNS = [GAME_WIDTH / 2 - 64, GAME_WIDTH / 2, GAME_WIDTH / 2 + 64] as const;

type Made = Phaser.GameObjects.GameObject;

/**
 * The end of a play, in up to three screens: its score and where it came; three initials, if it
 * came high enough to be asked for them; and the venue's scores for the week. It goes back to the
 * title screen at a tap, or by itself after a while, since on a kiosk the next player may be
 * someone else. A place on the leaderboard is for show: nothing is ever won.
 */
export class Over extends Phaser.Scene {
  private result!: OverData;
  private made: Made[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  private letters: string[] = ['A', 'A', 'A'];
  private letterTexts: QuizText[] = [];
  private note!: QuizText;
  private sending = false;
  private tap: (() => void) | null = null;

  constructor() {
    super(SceneKey.Over);
  }

  create(data: OverData): void {
    this.result = data;
    this.made = [];
    this.timers = [];
    this.letters = ['A', 'A', 'A'];
    this.sending = false;
    this.tap = null;

    this.add.image(0, 0, TextureKey.Backdrop).setOrigin(0, 0);
    this.add.image(0, 0, TextureKey.Vignette).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOUR.wash, 0.6).setOrigin(0, 0);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => this.tap?.());
    this.showResult();
  }

  /** Drops what the last screen put up, and what it was waiting for. */
  private clear(): void {
    for (const made of this.made) made.destroy();
    for (const timer of this.timers) timer.remove();
    this.made = [];
    this.timers = [];
    this.tap = null;
  }

  private keep<T extends Made>(made: T): T {
    this.made.push(made);
    return made;
  }

  private text(
    words: string,
    y: number,
    size: number = FONT_SIZE.small,
    tint: number = 0xffffff,
  ): QuizText {
    const text = this.keep(addText(this, 0, 0, words, size).setTint(tint));
    centerText(text, GAME_WIDTH / 2, y);
    return text;
  }

  /** After a pause, a tap does `then`; if none comes, the play is over and the title returns. */
  private waitForTap(then: () => void, giveUpMs: number, giveUp: () => void): void {
    this.timers.push(
      this.time.delayedCall(TAP_AFTER_MS, () => {
        this.tap = then;
      }),
      this.time.delayedCall(giveUpMs, giveUp),
    );
  }

  private toTitle(): void {
    this.scene.start(SceneKey.Title);
  }

  private showResult(): void {
    this.clear();
    const { score, rank, won } = this.result;
    if (!won) sfx.play('over');
    this.text(won ? 'LAST ORDERS' : 'GAME OVER', GAME_HEIGHT * 0.25, FONT_SIZE.large, COLOUR.gold);
    if (won)
      this.text('EVERY QUESTION ASKED', GAME_HEIGHT * 0.25 + 24, FONT_SIZE.small, COLOUR.quiet);
    this.text(`SCORE ${score}`, GAME_HEIGHT * 0.5, FONT_SIZE.medium);
    if (rank !== null) {
      this.text(`NUMBER ${rank} THIS WEEK`, GAME_HEIGHT * 0.5 + 20, FONT_SIZE.small, COLOUR.quiet);
    }
    const asks = this.result.asksInitials && this.result.playId !== null;
    this.text(
      asks ? 'TAP FOR YOUR INITIALS' : 'TAP TO GO ON',
      GAME_HEIGHT * 0.78,
      FONT_SIZE.small,
      COLOUR.quiet,
    );
    this.waitForTap(
      () => (asks ? this.showInitials() : this.showScores()),
      KIOSK.endScreenMs,
      () => this.toTitle(),
    );
  }

  /** Three letters, each with a button to step it up and one to step it down. */
  private showInitials(): void {
    this.clear();
    this.letterTexts = [];
    this.text('ENTER YOUR INITIALS', 34, FONT_SIZE.medium, COLOUR.gold);
    if (this.result.rank !== null) {
      this.text(`NUMBER ${this.result.rank} THIS WEEK`, 56, FONT_SIZE.small, COLOUR.quiet);
    }

    COLUMNS.forEach((x, column) => {
      this.button(x, 98, 52, 34, '+', () => this.step(column, 1), true);
      this.button(x, 178, 52, 34, '-', () => this.step(column, -1), true);
      const letter = this.keep(addText(this, 0, 0, this.letters[column], FONT_SIZE.title));
      centerText(letter, x, 138);
      this.letterTexts.push(letter);
    });

    this.note = this.text('', 205, FONT_SIZE.small, COLOUR.bad);
    this.button(GAME_WIDTH / 2, 236, 130, 30, 'OK', () => void this.submit(), false);
    // If the player walks away, the scores are shown without their initials.
    this.timers.push(this.time.delayedCall(KIOSK.initialsMs, () => this.showScores()));
  }

  private step(column: number, steps: number): void {
    this.letters[column] = stepLetter(this.letters[column], steps);
    this.letterTexts[column].setText(this.letters[column]);
    sfx.play('click');
  }

  /** A button the size of a thumb. If it `repeats`, holding a finger on it keeps stepping. */
  private button(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    press: () => void,
    repeats: boolean,
  ): void {
    const face = this.keep(
      this.add
        .rectangle(x, y, width, height, 0x14301f, 0.9)
        .setStrokeStyle(2, COLOUR.gold)
        .setInteractive(),
    );
    const words = this.keep(addText(this, 0, 0, label, FONT_SIZE.medium).setTint(COLOUR.gold));
    centerText(words, x, y);

    let hold: Phaser.Time.TimerEvent | null = null;
    const stop = () => {
      hold?.remove();
      hold = null;
      face.setFillStyle(0x14301f, 0.9);
    };
    face.on(Phaser.Input.Events.POINTER_DOWN, () => {
      face.setFillStyle(0x2c6a3f, 1);
      press();
      if (repeats) {
        hold = this.time.addEvent({
          delay: HOLD.everyMs,
          startAt: HOLD.everyMs - HOLD.firstMs,
          loop: true,
          callback: press,
        });
        this.timers.push(hold);
      }
    });
    face.on(Phaser.Input.Events.POINTER_UP, stop);
    face.on(Phaser.Input.Events.POINTER_OUT, stop);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  }

  private async submit(): Promise<void> {
    const { playId } = this.result;
    if (this.sending || playId === null) return;
    this.sending = true;
    this.note.setText('SENDING').setTint(COLOUR.quiet);
    centerText(this.note, GAME_WIDTH / 2, 205);
    const sent = await sendInitials(playId, this.letters.join(''));
    // The player may have walked away while it was sent: this screen is no longer showing.
    if (!this.scene.isActive()) return;
    this.sending = false;
    if (sent === 'refused') {
      this.note.setText('NOT ALLOWED, TRY OTHER LETTERS').setTint(COLOUR.bad);
      centerText(this.note, GAME_WIDTH / 2, 205);
      return;
    }
    this.showScores();
  }

  /** The venue's best for the week, with this play marked. Skipped off a kiosk. */
  private showScores(): void {
    this.clear();
    if (!onKiosk()) {
      this.toTitle();
      return;
    }
    this.text('THIS WEEK', 32, FONT_SIZE.large, COLOUR.gold);
    this.keep(
      this.add
        .rectangle(GAME_WIDTH / 2, 134, 250, 146, COLOUR.wash, 0.7)
        .setStrokeStyle(1, COLOUR.gold, 0.5),
    );
    const waiting = this.text('', 130, FONT_SIZE.small, COLOUR.quiet);
    this.text('TAP TO GO ON', GAME_HEIGHT - 14, FONT_SIZE.small, COLOUR.quiet);
    this.waitForTap(
      () => this.toTitle(),
      KIOSK.scoresMs,
      () => this.toTitle(),
    );

    void fetchLeaderboard().then((board) => {
      if (!this.scene.isActive()) return;
      const rows = scoreRows(board, this.result.playId, ROWS);
      waiting.setText(rows.length === 0 ? 'NO SCORES YET' : '');
      centerText(waiting, GAME_WIDTH / 2, 130);
      rows.forEach((row, index) => {
        const y = 76 + index * 26;
        const tint = row.mine ? COLOUR.gold : 0xffffff;
        this.keep(addText(this, 150, y - 8, String(row.rank), FONT_SIZE.medium).setTint(tint));
        this.keep(addText(this, 200, y - 8, row.initials, FONT_SIZE.medium).setTint(tint));
        const score = this.keep(
          addText(this, 0, y - 8, String(row.score), FONT_SIZE.medium).setTint(tint),
        );
        score.setX(Math.round(332 - score.width));
      });
    });
  }
}
