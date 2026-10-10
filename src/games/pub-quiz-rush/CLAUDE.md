# pub-quiz-rush (Pub Quiz Rush)

Notes on this game, for whoever works on it next and for whoever carries it into PubPixels.
The rules every game keeps are in `CLAUDE.md` at the top of the repo: read that first.

## What it is

A pub quiz against the clock. After the coin the player picks a **genre** (Ireland, Sport, Science,
World, General, or Mixed, which is all of them) and a **level** (Easy, Medium, Hard). Then ten
questions of that genre and level are asked: each is chalked on the board with four coloured
buttons for the answers. Tap the right one before the bar runs out. A quicker answer scores more,
and right answers in a row raise a multiplier (up to x2). The level multiplies the score again
(x1, x1.5, x2) and sets the clock: Easy starts at 14 s, Medium 12 s, Hard 10 s, each getting a
little shorter for every question down to a floor (9 s, 6.5 s, 5 s). A wrong answer, or none in
time, shows the right button in green and costs a life. Answer all ten to win ("last orders"). A
streak of 5 right answers gives one life back.

The questions picked and the place of the right answer differ each play. The right answer is
stored first in `game.json` and shuffled at play time.

A player who has paid and walks away from the choosing is started on Mixed and Medium after 25 s
(`PLAY.chooseMs`), so the credit is never left unused. There is no background sound.

A **50/50** strip under the buttons, once a play, takes two wrong answers away (`fiftyFifty` in
`logic.ts`). The question it is used on scores half (`fiftyFiftyPoints`); the streak still goes on.
(Key `5` while making it.)

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
| `text.ts`                   | the game's text: a smooth bold sans-serif (see below)                      |
| `config.ts`                 | layout, colours and timings                                                |
| `art.ts`, `audio.ts`        | the brick wall and chalkboard, and the sounds                              |
| `scenes/`                   | Boot (pictures), Title, Choose (genre, then level), Play (the quiz), Over  |

## What a pub would want its own

- The name (14 characters) and the line under it (30).
- The genres (`categories`: an `id` and a button `name` of up to 12 characters, 1 to 8 of them).
- The three `difficulties` (name, score `multiplier`, and the `time` clock: `startMs`, `stepMs`, `endMs`).
- The questions, each with a `category` (a genre id) and a `level` (1 easy, 2 medium, 3 hard): plain
  ASCII, question up to 90 characters, answers up to 26, exactly four distinct answers, the right
  one first (`correct` 0). No brands and no real people. **Every genre needs at least `rounds`
  questions at every level** (the reader says which is short); there are 206 now, 12 to 21 in each.
- How many rounds, and the points. The checks are in `gameData.ts`.

## Pictures it needs

None: the wall, board and buttons are drawn in `art.ts`.

## Text: NOT the pixel font

This game breaks the repo rule that all text is in the shell's pixel font, on purpose and at the
owner's request: the pixel font was hard to read in a quiz. Text is a bold sans-serif drawn by
canvas `Text` (`text.ts`: `QuizText`, `addText`, `centerText`), at 4x resolution with smoothing on so
it stays sharp. It still takes the sizes in `FONT_SIZE`, and the question and answers use the
largest size that fits (`fitText` in `scenes/Play.ts`).

**To carry this game into PubPixels, its text must go back to the pixel font** (swap `text.ts` for
`addPixelText` / `centerPixelText`), or the rule must be changed there.

## How it is scaled

`main.ts` zooms the 480 by 270 screen by a whole number (`crispZoom`, allowing for the display's own
scaling) so the pictures keep even pixels. If a whole number would leave wide empty borders (more
than a third), it fits the window instead. On a 1920 by 1080 kiosk it is exactly 4x.

## Asks of the shell

Nothing beyond the usual: coins, one score at the end, initials and the leaderboard.

## Tried on a real touchscreen

Not yet. Checked in the browser with scripted clicks (right, wrong, game over). Sound has not
been listened to.

## Ready to carry over?

Copy the checklist from `docs/CARRYING_OVER.md` here and tick it after a real kiosk test.
