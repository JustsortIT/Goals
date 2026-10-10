# _template

Notes on this game, for whoever works on it next and for whoever carries it into PubPixels.
The rules every game keeps are in `CLAUDE.md` at the top of the repo: read that first.
Keep this file current. Replace what is below as the game becomes its own.

## What it is

Catch what falls. The player slides a paddle along the bottom of the screen; a drop caught
scores, a drop missed costs a life. It is the smallest game that meets a kiosk properly, and
is here to be replaced.

## How it is played with fingers

Hold a finger anywhere on the screen and the paddle goes to it. One finger, no buttons.
(While making it: the left and right arrow keys.)

## What a life is

A missed drop costs one. A euro is 3 lives.

## Files

| File                        | What it is                                                                |
| --------------------------- | ------------------------------------------------------------------------- |
| `start.ts`                  | `start(data)`: checks the data, then starts Phaser. PubPixels calls this  |
| `game.json`                 | the content: the name, the line under it, what falls and what it scores   |
| `gameData.ts`               | reads and checks that content (pure)                                      |
| `logic.ts`, `logic.test.ts` | the rules as plain sums, and their tests (pure)                           |
| `controls.ts`               | what the player is asking for: finger first, keys as well                 |
| `session.ts`                | a play as the kiosk sees it: start, coins while it lasts, one score. Keep |
| `config.ts`                 | numbers and names                                                         |
| `main.ts`                   | makes the Phaser game                                                     |
| `scenes/Boot.ts`            | loads the pixel font                                                      |
| `scenes/Title.ts`           | waits for a coin, or a tap when free                                      |
| `scenes/Play.ts`            | the game, the lives, the count for a coin when they run out               |
| `scenes/Over.ts`            | the score and where it came                                               |

## What a pub would want its own

- The name and the line under it (`name`, 14 characters; `line`, 30).
- What falls: each drop's name, points, colour, speed and how often it comes.

## Pictures it needs

None yet: everything is a plain rectangle.

## How a layout is made

There is none: drops fall at random places, quicker as the score grows.

## Asks of the shell

Nothing yet.

## Tried on a real touchscreen

Not yet.

## Ready to carry over?

Copy the checklist from `docs/CARRYING_OVER.md` here when the game is playable, and tick it
as it becomes true.
