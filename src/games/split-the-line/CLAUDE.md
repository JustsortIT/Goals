# split-the-line (Split the Line)

Notes on this game, for whoever works on it next and for whoever carries it into PubPixels.
The rules every game keeps are in `CLAUDE.md` at the top of the repo: read that first.

## What it is

A pub game of timing. A pint glass stands on the bar under a tap, and there is a gold mark on
it. Hold the screen to pour stout and let go to stop, so the top of the pint (the head) comes to
rest on the **middle of the mark**. The better you stop it, the more you score; stop outside the
mark, or pour over the rim, and a life is lost. Pour eight pints, each harder than the last, to
win ("last orders").

It is the old pub game of splitting the logo on a pint. The mark here is a plain gold band with
a line down its middle, not a brand's logo, because **no brands or logos** may be in a game
(top-level `CLAUDE.md`), and the picture has no lettering.

## Bonus games

After pints 2, 4 and 6 a bonus game comes up (set in `game.json` under `bonus`). A bonus never costs
a life. It scores double (`multiplier`), and clearing it (every glass stopped inside its mark) gives
one life back (`lifeOnSuccess`). A bonus has a clock that starts when the first finger goes down, and
one pour a glass: the tap shuts for good when the finger lifts or the time runs out.

- **Rapid pour** (after pint 2): that pint's round with a tap 2x as quick, a mark 0.55x as wide and
  a wilder surge, against a 7 s clock.
- **Moving glass** (after pint 4): the glass swings along the bar under the tap (a sine, amplitude
  56 px, 3.6 s a swing) and only fills while it is within `CATCH_HALF` (34 px) of the spout; the rest
  of the stream splashes on the bar. 16 s clock. The finger just holds; the timing is when to let go,
  and the glass is only filling part of the time, so the pour is slower.
- **Two pints** (after pint 6): two glasses under the left and right taps, at once. A finger on the
  left half of the screen holds the left tap, one on the right half the right tap. 16 s clock. It can
  be done with ONE finger (pour one glass, lift, move over, pour the other: the test does this), so it
  does not need two touches at once, but two fingers do it in half the time. **Whether two fingers
  reach the page on a real kiosk is not yet known: try it.**

All of it is made by rule from the pint just cleared (`bonusRounds` in `logic.ts`), and tested: a
rapid pour has a finger window over 60 ms and a pour that takes less than its clock; a moving glass is
under the tap over 30% of the time and the pour fits in 60% of its clock; two pints pour one after the
other in under 70% of the clock.

## How it is played with fingers

One finger, no buttons. Touch anywhere and hold: the tap opens. Lift: it shuts. The tap does not
shut at once (it takes about 150 ms) and it surges and eases as it runs, so the stout goes on
rising a little after the finger lifts, and the finger has to lift a little early. There is no
topping up: one pour a pint. Only one finger, nothing held with another, so nothing depends on
two touches at once. (While making it: the space bar does the same.)

## What a life is

A pint stopped outside the mark (short or over) or poured over the rim costs a life, and the same
pint is poured again. A pint stopped inside the mark clears the round. A euro is 3 lives. With no
kiosk a play is 3 lives.

## The rules, as sums (`logic.ts`, tested)

- `roundFor(n)` makes round n by rule: the middle of the mark is somewhere between `markLow` and
  `markHigh` of the glass, spread unevenly by a fixed run (the golden ratio, so it never repeats
  by the same step); the mark narrows by `bandStep` a round down to `bandMin`; the tap's flow is
  `flowStart + flowStep * (n - 1)` px a second; it surges more each round (`surgeStart`,
  `surgeStep`).
- `stepPour` runs the tap: flow works up to the tap's flow (times its surge) with a time constant
  of 110 ms while held, and dies away with one of 150 ms when let go, so what goes in after the
  finger lifts is `flow * 0.15` px (`coastAfterRelease`). It steps in 8 ms pieces, so it is the
  same at any frame rate.
- `judge` says where it stopped: a **split** within `splitTolerance` (1.6 px) of the middle,
  **close** inside the mark, **short** or **over** outside it, **spill** at the rim.
- Points: a split is `points.split` times the round; a close one `points.close` scaled by how near
  the middle, times the round; anything else is nothing.
- `logic.test.ts` proves every round can be won: it pours with a finger that lifts at the right
  moment and checks the stop is in the mark, that the time the pour spends inside the mark (the
  finger's window) is over 80 ms even on the last round, and that a finger 120 ms late still
  scores on the first.

## Files

| File                        | What it is                                                                       |
| --------------------------- | -------------------------------------------------------------------------------- |
| `start.ts`                  | `start(data)`: checks the data, then starts Phaser. PubPixels calls this         |
| `game.json`                 | the content: name, line, rounds, the drink's colours, the mark's, the difficulty |
| `gameData.ts`               | reads and checks that content (pure)                                             |
| `logic.ts`, `logic.test.ts` | the rounds, the pour, judging and scoring (pure)                                 |
| `controls.ts`               | a finger held down (left and right halves counted apart), or space / arrows      |
| `glassView.ts`              | one glass on the bar: the stout, the mark and the glass; it slides along         |
| `session.ts`                | a play as the kiosk sees it: start, coins while it lasts, one score              |
| `art.ts`                    | the pub, the taps, the bar and the glass, drawn in code once at load             |
| `audio.ts`                  | sounds made in code: the pour (louder as the tap opens), a ring for a split, ... |
| `scores.ts`                 | the week's scores as rows to draw                                                |
| `config.ts`                 | numbers and names                                                                |
| `main.ts`                   | makes the Phaser game                                                            |
| `scenes/Boot.ts`            | loads the pixel font, draws the pictures                                         |
| `scenes/Title.ts`           | waits for a coin, or a tap when free                                             |
| `scenes/Play.ts`            | the glass, the pour, lives, the count for a coin when they run out               |
| `scenes/Over.ts`            | the score and rank, three initials if asked, and the week's top five             |

## What a pub would want its own

In `game.json`, checked by `gameData.ts`:

- `name` (14 characters) and `line` (30).
- `rounds` (1 to 12).
- The `drink`: a name (12), the `liquid` colour and the `head` colour (so a pub could pour a
  red ale or a lager).
- The `mark`'s colour.
- `pour`, the difficulty, all by rule: `flowStart`, `flowStep`, `surgeStart`, `surgeStep`,
  `bandStart`, `bandStep`, `bandMin`, `markLow`, `markHigh`. The data is refused if the widest mark
  does not fit in the glass.
- `points` for a close and a split, and `splitTolerance`.
- `bonus` (or none): `after` (the pints the bonuses come after, rising, before the last) and `kinds`
  (`rapid`, `moving` or `two` for each), `multiplier` (1 to 5), `lifeOnSuccess`, and the settings
  of each kind (`rapid`: `flowFactor`, `bandFactor`, `timeMs`; `moving`: `flowFactor`,
  `amplitude`, `periodMs`, `timeMs`; `two`: `timeMs`).

## Pictures it needs

None from outside: everything is drawn in code. A pub's own art would be:

- The backdrop, 480 by 270: brick wall, two shelves of bottles with blank labels, two pendant
  lamps, a row of three taps with blank handles (the middle one pours, its spout at x 296, y 58),
  a brass rail at y 196 and a polished bar with a drip mat. No lettering.
- The glass's front, 104 by 170: clear glass with the stout drawn behind it, wider at the top.
  Its inside is 156 px tall, 60 px wide at the foot and 84 at the rim.
- A vignette, 480 by 270.

Words are written by the game in the pixel font: the title (14 characters), the line (30), the
verdicts (`SPLIT!`, `CLOSE ENOUGH`, `SHORT`, `OVER`, `SPILLED`), `+n`, `A LIFE LOST`, the hint
(`HOLD TO POUR`, `LET GO ON THE MARK`), `PINT n OF n`, `BONUS GAME`, `RAPID POUR`, `MOVING GLASS`,
`TWO PINTS`, `BONUS CLEARED`, `BONUS MISSED`, `NO LIFE LOST`, `+1 LIFE`, `TIME n.n`, and the end screens (`LAST ORDERS`,
`EVERY PINT POURED`, `ENTER YOUR INITIALS`, `THIS WEEK`).

## How a layout is made

By rule from the round's number, with no seed to keep: `roundFor` gives the mark's place, width,
the tap's speed and its surges (see above). A test (`logic.test.ts`) plays every round with a
finger that lifts at the right moment, so a round that cannot be won is caught.

## Asks of the shell

Nothing yet. It uses the shell as it is: `sendInitials`, `fetchLeaderboard`, `stepLetter` and the
kiosk's `sound` flag.

## Not decided / ideas

- A foam surge after the pour, so the head grows for a moment and has to settle before it counts.
- Letting a player top up a pint, as in life, with a small extra pour.
- A second kind of drink each round (a lager with a thick head).
- A split earning a life back.
- More bonus kinds (a pint with a dropping mark, a three-glass round).

## Tried on a real touchscreen

Not yet. Played with a mouse only, with scripted holds in a browser. Check on a real kiosk screen
that holding a finger down does not move it (nothing here depends on the finger's place), and how
the 150 ms of the tap shutting feels.
