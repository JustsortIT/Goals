/**
 * The street behind the title screen, in the same text-grid format as the levels (the
 * legend is in systems/level.ts). It is only looked at: nothing collides and the keg stays put.
 *
 * It is 30 tiles wide so it fills the screen at either tile size; the title scene shows
 * the middle of it, with the ground along the bottom of the screen.
 */
// prettier-ignore
export const TITLE_LEVEL: readonly string[] = [
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '............oo................',
  '...........o..o...............',
  '..s..P.>.o......o....G...EbL..',
  '##############################',
  '##############################',
  '##############################',
];
