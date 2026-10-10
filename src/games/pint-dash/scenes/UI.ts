import Phaser from 'phaser';
import { FONT_SIZE, GAME_HEIGHT, GAME_WIDTH, PLAYER } from '../config/constants';
import { RegistryKey, SceneKey, TextureKey } from '../config/keys';
import { SectionBanner } from '../systems/boards';
import { addPixelText, centerPixelText } from '../systems/pixelFont';
import { TouchControls } from '../systems/touchControls';
import { themeArt } from '../themes';

const MARGIN = 8;
/** Centre line of the top HUD row. Icons are about 12px tall. */
const ROW_Y = MARGIN + 6;
const HEART_SPACING = 15;
const HINT_VISIBLE_MS = 6000;

/**
 * HUD overlay. Runs in parallel with the Game scene (launched from it) and has its own
 * unscrolled camera. It never talks to the Game scene directly: it redraws whenever the
 * registry changes.
 */
export class UI extends Phaser.Scene {
  private scoreIcon!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.BitmapText;
  private hearts: Phaser.GameObjects.Image[] = [];
  private shownScore = 0;
  private shownLives = 0;
  private touchControls: TouchControls | null = null;
  private banner!: SectionBanner;
  private shownSection = '';

  constructor() {
    super(SceneKey.UI);
  }

  create(): void {
    // Drawn here rather than in the Game scene so camera shake does not move it.
    this.add.image(0, 0, TextureKey.Vignette).setOrigin(0, 0);

    const { pickup, heart } = themeArt();
    this.scoreIcon = this.add.image(MARGIN + 8, ROW_Y, pickup.texture, pickup.frame);
    this.scoreText = addPixelText(this, MARGIN + 20, ROW_Y, '0000', FONT_SIZE.medium);
    this.scoreText.setY(Math.round(ROW_Y - this.scoreText.height / 2));

    // Hearts fill from the right edge inwards; the leftmost is the first life lost.
    this.hearts = [];
    for (let i = 0; i < PLAYER.lives; i++) {
      const x = GAME_WIDTH - MARGIN - 7 - (PLAYER.lives - 1 - i) * HEART_SPACING;
      this.hearts.push(this.add.image(x, ROW_Y, heart.texture, heart.full));
    }

    this.banner = new SectionBanner(this);
    this.shownSection = '';
    this.shownScore = this.readNumber(RegistryKey.Score);
    this.shownLives = this.readNumber(RegistryKey.Lives);
    this.refresh();

    // Touch screens get buttons; everything else gets a reminder of the keys.
    this.touchControls = null;
    if (TouchControls.isNeeded(this)) {
      this.touchControls = new TouchControls(this);
    } else {
      const hint = addPixelText(this, 0, 0, 'ARROWS / WASD: MOVE    SPACE: JUMP    R: RESTART');
      centerPixelText(hint, GAME_WIDTH / 2, GAME_HEIGHT - MARGIN - hint.height / 2);
      this.tweens.add({ targets: hint, alpha: 0, delay: HINT_VISIBLE_MS, duration: 500 });
    }

    // The registry outlives this scene, so its listeners must be removed by hand.
    const registryEvents = this.registry.events;
    registryEvents.on(Phaser.Data.Events.SET_DATA, this.refresh, this);
    registryEvents.on(Phaser.Data.Events.CHANGE_DATA, this.refresh, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      registryEvents.off(Phaser.Data.Events.SET_DATA, this.refresh, this);
      registryEvents.off(Phaser.Data.Events.CHANGE_DATA, this.refresh, this);
    });
  }

  override update(): void {
    this.touchControls?.update();
  }

  private readNumber(key: string): number {
    return (this.registry.get(key) as number | undefined) ?? 0;
  }

  private refresh(): void {
    const score = this.readNumber(RegistryKey.Score);
    const lives = this.readNumber(RegistryKey.Lives);

    this.scoreText.setText(String(score).padStart(4, '0'));
    if (score > this.shownScore) {
      this.pop(this.scoreIcon);
    }

    const { full, empty } = themeArt().heart;
    this.hearts.forEach((heart, index) => {
      const lost = index < PLAYER.lives - lives;
      heart.setFrame(lost ? empty : full);
      if (lost && index >= PLAYER.lives - this.shownLives) {
        this.pop(heart);
      }
    });

    this.shownScore = score;
    this.shownLives = lives;

    const section = (this.registry.get(RegistryKey.Section) as string | undefined) ?? '';
    if (section !== this.shownSection) {
      this.shownSection = section;
      if (section !== '') {
        this.banner.show(section);
      }
    }
  }

  /** A quick scale bump to draw the eye to something that just changed. */
  private pop(target: Phaser.GameObjects.Image): void {
    this.tweens.killTweensOf(target);
    target.setScale(1.4);
    this.tweens.add({ targets: target, scale: 1, duration: 180, ease: 'Quad.easeOut' });
  }
}
