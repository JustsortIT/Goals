# gaa-free (Free Taker)

Notes on this game, for whoever works on it next and for whoever carries it into PubPixels.
The rules every game keeps are in `CLAUDE.md` at the top of the repo: read that first.

## What it is

A precision game set at a Gaelic football ground in Ireland. You face a GAA goal (two posts,
a crossbar, a net under the bar) with a ball in front of you. Pull back and let go to land the
ball on one of five targets hung in the goal mouth, each a different size: the smaller, the
more it scores. Hit all five to clear the goal. The next goal is a little farther back (smaller,
higher up the screen, with smaller targets). Clear the last of six and you win.

A golden **bonus target** also circles in the goal mouth, in a figure of eight, quicker on each
farther goal. It is not needed to clear a goal, but it is worth a lot (100 times the goal's
number). The ball takes 0.6 s to arrive, so it has to be aimed at where the target will be, not
where it is: the skill is timing the release. It is there once a goal, and is gone once hit.

**Wind** blows from the second goal on. It pushes the ball sideways, more the longer it is in the
air, by the wind as it is at the moment of the kick, and it is not in the dotted line: the player
reads it off the flag on the pitch (out straight in a strong wind, hanging in none) and the gauge
under the top bar (a bar out from the middle, the way it blows), and aims into it. It blows mostly
one way on a goal, the other way on the next, with gusts that ease it or even turn it, and it is
stronger on each farther goal (6 px at the second goal, 3 more each after, over a whole flight).
A ball that lands on it is a hit even if a normal target is behind it.

## How it is played with fingers

One finger, no buttons. Touch anywhere, drag **down** to pull back, lift to kick. The ball goes
the other way from the drag, 1.6 pixels for every pixel of pull. A dotted line shows the first
three quarters of the way. The finger never covers the ball, since the pull is measured from
where the finger first touched. A touch of less than 8 pixels, or a pull upwards, is not a
kick: the ball goes back. Only one finger is used, so nothing here depends on two touches at
once. (While making it: arrow keys aim and set power, space kicks.)

## What a life is

A ball that hits none of the targets costs a life (wide, over the bar, short, or in the net
between targets). A ball that hits a target already hit costs nothing and scores nothing. A
goal cleared gives one life back. A euro is 3 lives. With no kiosk a play is 3 lives.

## The rules, as sums (`logic.ts`, tested)

- Landing point = ball origin minus pull, times `KICK.gain`. The ball counts as touching a
  target within `KICK.reach` (3 px) of its edge.
- Goal at level n has scale `1 - shrink * (n - 1)` (never below `GOAL.minScale`). Its width,
  height, targets and ground line all scale with it, and its base moves up the screen.
- A target is worth its `points` times the level. The bonus target is the same, with its own points.
- Wind: `windAt(time, wind, level)` gives the push in pixels over a whole flight, to the right if
  positive: the most for the level (`windMost`) times a mix of a steady side (by the level, odd or
  even) and a sine gust. The ball is moved by `push * along^2` as it flies and lands `push` away
  from where it was aimed. The test aims against the strongest wind on every level to prove every
  target can still be reached.
- The bonus target's place at a time is a sum (`bonusSpot`): a figure of eight round the middle of
  its path, with a period that shrinks each goal. It is checked at the moment the ball lands, so
  the ball's flight time is the lead the player has to give it.
- `logic.test.ts` proves every target can be reached on every level with a pull the screen has
  room for, that the smallest target of the last goal is still about 4.7 px of aim (about 3 px of
  finger) wide, and that the bonus target stays in the goal and can be reached at every moment of
  every level. Change `game.json` and the tests will say if a goal has become impossible.

## Files

| File                        | What it is                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `start.ts`                  | `start(data)`: checks the data, then starts Phaser. PubPixels calls this                   |
| `game.json`                 | the content: name, line, levels, shrink, the five targets                                  |
| `gameData.ts`               | reads and checks that content (pure)                                                       |
| `logic.ts`, `logic.test.ts` | goal geometry, the kick, hits, scoring (pure)                                              |
| `controls.ts`               | the pull-back drag: finger first, keys as well                                             |
| `session.ts`                | a play as the kiosk sees it: start, coins while it lasts, one score                        |
| `art.ts`                    | the ground, the ball (12 tumbling frames) and the bonus target, drawn in code once at load |
| `goalArt.ts`                | the goal on three layers: ground and shadow, net and targets, posts                        |
| `config.ts`                 | numbers and names                                                                          |
| `main.ts`                   | makes the Phaser game                                                                      |
| `scenes/Boot.ts`            | loads the pixel font, draws the pictures                                                   |
| `scenes/Title.ts`           | waits for a coin, or a tap when free                                                       |
| `scenes/Play.ts`            | the goal, the kick, lives, the count for a coin when they run out                          |
| `scenes/Over.ts`            | the score and where it came; "full time" if every goal was cleared                         |

## What a pub would want its own

In `game.json`, checked by `gameData.ts`:

- `name` (14 characters) and `line` (30).
- `levels` (1 to 12) and `shrink` (0 to 0.1: how much smaller the goal is each level).
- The `bonus` target (or none): name, `points`, `colour`, `radius` (5 to 20), the middle of its
  path (`x`, `y`) and how far it goes either side (`spanX`, `spanY`), `periodMs` for one round
  at the first goal and `speedUp`, how much quicker each goal is. It has to stay inside the goal.
- The `wind` (or none): `fromLevel` (the first goal it blows on), `strength` (pixels it pushes the
  ball over a flight there, up to 30), `perLevel` (more on each goal after), `gustMs` (how long a
  gust takes) and `steadiness` (1 is steady, 0 is gusts either way as often). The strongest wind
  on any goal may not pass 24 px.
- Up to 8 `targets`, each with a name (12), `points`, a `colour`, a `radius` in pixels on the
  nearest goal (3 to 30, each target its own size) and its place in the goal mouth, `x` and `y`
  from 0 to 1. They must fit in the mouth and not overlap.

## Pictures it needs

None from outside: everything is drawn in code (`art.ts`, `goalArt.ts`). The ground is a soft
sky with cloud, hills in the haze with fields, trees, farmhouses and a church, floodlights, a
stand with a crowd under a roof with flags, blank advertising boards with stewards, and a mown
pitch with grain, lit from the upper right (the goal throws its shadow to the left). A pub's own
art would be:

- The backdrop, 480 by 270 (stand, crowd, floodlights, hills, flags, pitch), with the horizon at y 109.
- The ball: a strip of 12 frames, 20 by 20 each, the ball turning over once. The bonus target,
  32 by 32, and a soft glow, 64 by 64. A vignette, 480 by 270.
- No lettering in any of them; the advertising boards are blank.

Words are written by the game in the pixel font: the title (14 characters), the line (30), the
pop-up after each kick (`+150`, `BONUS 300`, `WIDE`, `OVER`, `SHORT`, `MISS`, `DONE`), and the banners
(`GOAL CLEARED`, `FULL TIME`, and `WIND` / `WATCH THE FLAG` at the first windy goal), and the gauge label `WIND`.

## How a layout is made

The goals are made by rule: one number (`shrink`) says how much farther back each goal is, and
everything else (the goal's size, where it stands, how small the targets are) follows from it.
The target positions are set by hand in `game.json`. They are proved reachable by a test that
works out the pull that lands on each target for each level (`logic.test.ts`), so a layout that
cannot be played is caught. Not yet solved: making target positions by rule from a seed.

## Asks of the shell

Nothing yet. The title, count and end scenes follow the template's. Initials for a high score
are not taken.

## Not decided / ideas

- The bonus target coming back after a while, or more than one on the later goals.
- A point for a ball over the bar between the posts, as in the real game.
- Whether the dotted line should be shorter, or go, on the later goals.
- A time limit per goal.

## Tried on a real touchscreen

Not yet. Played with a mouse only, with a scripted drag in a browser. Check on a real kiosk
screen that the smallest target on the last goal can be hit, and how the pull feels with the
finger at the bottom edge (the furthest pull needs 70 px of screen below where the finger
starts, so a finger that starts low has less room to pull).
