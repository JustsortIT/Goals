# pub-quiz-rush (Pub Quiz Rush)

Notes on this game, for whoever works on it next and for whoever carries it into PubPixels.
The rules every game keeps are in `CLAUDE.md` at the top of the repo: read that first.

## What it is

A pub quiz against the clock. A question is chalked on the board and four coloured buttons carry
the answers. Tap the right one before the bar runs out. A quicker answer scores more, and right
answers in a row raise a multiplier (up to x2). A wrong answer, or no answer in time, shows the
right button in green and costs a life. Fifteen questions are asked, easy first and harder later,
and the clock shortens each time (12 s down to 6.5 s). Get through all fifteen to win ("last orders").
A streak of 5 right answers gives one life back.

A **50/50** strip under the buttons, once a play, takes two wrong answers away (iftyFifty in logic.ts). The question it is used on scores half (iftyFiftyPoints); the streak still goes on. (Key 5 while making it.)

Every play uses a fresh random seed, so the questions picked and the place of the right answer
differ each time. The right answer is stored first in `game.json` and shuffled at play time.

## How it is played with fingers

One tap on a button or on the 50/50 strip. One finger; nothing is dragged. (While making it: clicks with the mouse.)

## What a life is

A wrong answer or a timeout costs one. A euro is 3 lives. When lives run out, a coin during the
count carries on with the next question.

## Files

| File                        | What it is                                                                 |
| --------------------------- | -------------------------------------------------------------------------- |
| `start.ts`                  | `start(data)`: checks the data, then starts Phaser. PubPixels calls this   |
| `game.json`                 | the content: name, line, rounds, clock, points and the questions           |
| `gameData.ts`               | reads and checks that content (pure)                                       |
| `logic.ts`, `logic.test.ts` | the rules as plain sums (question order, shuffle, clock, score), and tests |
| `session.ts`                | a play as the kiosk sees it: start, coins while it lasts, one score. Keep  |
| `scores.ts`                 | initials and the top five, through the shell                               |
| `config.ts`                 | layout, colours and timings                                                |
| `art.ts`, `audio.ts`        | the brick wall and chalkboard, and the sounds                              |
| `scenes/`                   | Boot (font), Title, Play (the quiz), Over (score, initials, top five)      |

## What a pub would want its own

- The name (14 characters) and the line under it (30).
- The questions: plain ASCII, question up to 90 characters, answers up to 26, exactly four
  distinct answers, `level` 1 to 3, at least `rounds` of them, none repeated. No brands and no
  real people. The checks are in `gameData.ts`.
- There are 128 questions now, so plays rarely repeat. More are welcome.
- How many rounds, the clock (`startMs`, `stepMs`, `endMs`) and the points.

## Pictures it needs

None: the wall, board and buttons are drawn in `art.ts`.

## How it is scaled

main.ts zooms the 480 by 270 screen by a whole number (crispZoom) so every font pixel is the same size on screen, which is what keeps the text clean. If a whole number would leave wide empty borders (more than a third), it fits the window instead. On a 1920 by 1080 kiosk it is exactly 4x.

## Asks of the shell

Nothing beyond the usual: coins, one score at the end, initials and the leaderboard.

## Tried on a real touchscreen

Not yet. Checked in the browser with scripted clicks (right, wrong, game over). Sound has not
been listened to.

## Ready to carry over?

Copy the checklist from `docs/CARRYING_OVER.md` here and tick it after a real kiosk test.
