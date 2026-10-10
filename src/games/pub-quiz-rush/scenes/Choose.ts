import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH } from '../../../shell/constants';
import { sfx } from '../audio';
import {
  COLOUR,
  DATA_KEY,
  GENRE_COLOURS,
  LEVEL_COLOURS,
  PLAY,
  SceneKey,
  TextureKey,
} from '../config';
import type { GameData } from '../gameData';
import { addText, centerText } from '../text';
import type { PlayData } from './Play';

export interface ChooseData {
  lives: number;
}

interface Choice {
  name: string;
  /** Under the name, a few words on what the choice means (the levels have them). */
  detail?: string;
  colour: number;
}

/**
 * After the coin: pick a genre, then a level. Nothing here costs anything, and it is the play that
 * was paid for that goes on, so a player who walks away is started on mixed, medium once
 * `PLAY.chooseMs` has passed, rather than leaving the credit unused.
 */
export class Choose extends Phaser.Scene {
  private data_!: GameData;
  private lives = 0;
  private category: string | null = null;
  private genreName = '';
  private shown: Phaser.GameObjects.GameObject[] = [];
  private leftMs = 0;
  private countText!: Phaser.GameObjects.Text;
  private done = false;

  constructor() {
    super(SceneKey.Choose);
  }

  init(data: ChooseData): void {
    this.lives = data.lives;
    this.category = null;
    this.genreName = 'MIXED';
    this.shown = [];
    this.leftMs = PLAY.chooseMs;
    this.done = false;
  }

  create(): void {
    this.data_ = this.registry.get(DATA_KEY) as GameData;
    this.add.image(0, 0, TextureKey.Wall).setOrigin(0, 0);
    this.add.image(0, 0, TextureKey.Vignette).setOrigin(0, 0).setDepth(20);
    this.countText = addText(this, 0, 0, '', FONT_SIZE.small).setTint(COLOUR.quiet).setDepth(8);
    this.showGenres();
  }

  override update(_time: number, delta: number): void {
    if (this.done) return;
    this.leftMs -= delta;
    const seconds = Math.max(0, Math.ceil(this.leftMs / 1000));
    this.countText.setText(`STARTS ANYWAY IN ${seconds}`);
    this.countText.setPosition(GAME_WIDTH - 12 - this.countText.width, GAME_HEIGHT - 20);
    if (this.leftMs <= 0) this.start(2);
  }

  private clear(): void {
    this.shown.forEach((object) => object.destroy());
    this.shown = [];
    this.leftMs = PLAY.chooseMs;
  }

  private heading(words: string): void {
    const heading = addText(this, 0, 0, words, FONT_SIZE.medium).setTint(COLOUR.gold).setDepth(8);
    centerText(heading, GAME_WIDTH / 2, 17);
    this.shown.push(heading);
  }

  /** A button the size of its place, in a colour of its own, with a light edge so it looks pressed in. */
  private button(
    choice: Choice,
    box: { x: number; y: number; width: number; height: number },
    onTap: () => void,
  ): void {
    const { x, y, width, height } = box;
    const face = this.add
      .rectangle(x, y, width, height, choice.colour)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x000000, 0.45)
      .setDepth(3)
      .setInteractive();
    const shine = this.add
      .rectangle(x + 3, y + 3, width - 6, 6, 0xffffff, 0.22)
      .setOrigin(0, 0)
      .setDepth(4);
    const size = height < 40 ? FONT_SIZE.medium : FONT_SIZE.large;
    const name = addText(this, 0, 0, choice.name, size).setDepth(5);
    centerText(name, x + width / 2, y + height / 2 - (choice.detail ? 11 : 0));
    this.shown.push(face, shine, name);
    if (choice.detail) {
      const detail = addText(this, 0, 0, choice.detail, FONT_SIZE.medium)
        .setTint(COLOUR.quiet)
        .setDepth(5);
      centerText(detail, x + width / 2, y + height / 2 + 15);
      this.shown.push(detail);
    }
    face.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (this.done) return;
      sfx.play('click');
      onTap();
    });
  }

  private showGenres(): void {
    this.clear();
    this.category = null;
    this.heading('CHOOSE A GENRE');
    const choices: { choice: Choice; category: string | null }[] = [
      ...this.data_.categories.map((genre, index) => ({
        choice: { name: genre.name, colour: GENRE_COLOURS[index % GENRE_COLOURS.length] },
        category: genre.id,
      })),
      {
        choice: { name: 'MIXED', colour: GENRE_COLOURS[this.data_.categories.length % 8] },
        category: null,
      },
    ];
    const rows = Math.ceil(choices.length / 2);
    const gap = 8;
    const top = 36;
    const height = Math.min(60, Math.floor((GAME_HEIGHT - 36 - top - (rows - 1) * gap) / rows));
    const width = 214;
    choices.forEach(({ choice, category }, index) => {
      const alone = index === choices.length - 1 && choices.length % 2 === 1;
      const x = alone ? (GAME_WIDTH - width) / 2 : index % 2 === 0 ? 20 : 246;
      const y = top + Math.floor(index / 2) * (height + gap);
      this.button(choice, { x, y, width, height }, () => {
        this.category = category;
        this.genreName = choice.name;
        this.showLevels();
      });
    });
  }

  private showLevels(): void {
    this.clear();
    this.heading(`${this.genreName}: CHOOSE A LEVEL`);
    this.data_.difficulties.forEach((difficulty, index) => {
      const seconds = Math.round(difficulty.time.startMs / 1000);
      const detail = `${seconds} SECONDS EACH - POINTS x${difficulty.multiplier}`;
      this.button(
        { name: difficulty.name, detail, colour: LEVEL_COLOURS[index] },
        { x: 20, y: 38 + index * 64, width: 440, height: 56 },
        () => this.start((index + 1) as 1 | 2 | 3),
      );
    });
    this.button(
      { name: 'BACK', colour: 0x3b2a1a },
      { x: 20, y: GAME_HEIGHT - 28, width: 120, height: 22 },
      () => this.showGenres(),
    );
  }

  private start(level: 1 | 2 | 3): void {
    if (this.done) return;
    this.done = true;
    this.scene.start(SceneKey.Play, {
      lives: this.lives,
      category: this.category,
      level,
    } satisfies PlayData);
  }
}
