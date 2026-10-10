# phaseplay

A workshop for new types of game for PubPixels (`../pubpixels`, a Rails app): coin-operated
arcade games on touchscreen kiosks in Irish pubs. PubPixels has one type of game, a
platformer. Team mates make others here, each in a folder of its own, and one that works is
carried into PubPixels (`docs/CARRYING_OVER.md`).

You are most likely helping one person with one game. **Work only in that game's folder**,
`src/games/<name>`, unless they ask for something else. Read that folder's `CLAUDE.md` first:
it says what the game is and what has been decided about it. Keep it current as you work.

## Layout

```
src/boot.ts          starts a game on play.html?game=<folder>. Shared: leave it alone
src/shell/           a copy of PubPixels' shell: the kiosk's coins, lives and scores, the
                     pixel font, the screen's size. NEVER EDIT IT (see below)
src/games/_template  what a new game starts as: `npm run new-game -- <name> "Who"`
src/games/<name>/    one game, whole: start.ts, game.json, about.json, CLAUDE.md, its code
src/games/pint-dash  the first prototype (4 October 2026), which PubPixels' platformer grew
                     out of. A worked example of scenes, physics and a level check. It
                     does not use the shell: do not copy how it starts, scores or takes input
tools/               the pretend kiosk, new-game, shell:sync. Shared: leave them alone
```

## Commands

```
npm run dev          # http://localhost:5173 lists the games
npm run typecheck    # after every change
npm test             # Vitest, pure logic only
npm run lint         # ESLint, Prettier (single quotes, semicolons, 100 columns)
npm run build
npm run new-game -- <name> "Who"
```

Typecheck and test before saying something is done. If something could not be checked (it
needs a browser, or a real kiosk), say so plainly.

## What a game is

A folder in `src/games` with:

- **`start.ts`** exporting `start(data: unknown): Promise<void>`. This is the whole of what
  PubPixels asks of a type of game, and it must stay exactly this. `data` is the game's
  content as fetched, unchecked: read it and say what is wrong with it before starting.
- **`game.json`**: that content, for the game as it is here. See "Content is data" below.
- **`about.json`**: `title`, `by`, `status` (idea, playable, ready, carried over) and a
  `summary` of a sentence, for the list of games.
- **`CLAUDE.md`**: what the game is, how it is played with fingers, what is decided, what is
  not, and what has been tried on a real touchscreen.

## The rules every game keeps

These are PubPixels' own. A game that breaks one cannot be carried over, so hold them from
the first day and do not trade one away for a nicer prototype. If the person asks for
something that breaks one, tell them which and why before doing it.

### The screen and the machine

- **480 by 270, pixel art, no smoothing**, scaled to fit (`GAME_WIDTH`, `GAME_HEIGHT` in
  `shell/constants.ts`). 60 frames a second on hardware about ten years old.
- So: small images, no heavy libraries (Phaser is the one dependency: ask before adding
  another), and nothing made anew every frame in the game loop.
- All text is in the pixel font (`addPixelText` in `shell/pixelFont.ts`), in sizes from
  `FONT_SIZE`. It has plain keyboard characters only: no accents, no emoji.

### Touch only

- **A kiosk has a touchscreen and nothing else.** No keyboard, no mouse hover, no right
  click, no gamepad. Every part of the game must be playable with fingers. A keyboard may
  work as well, for whoever is making it.
- Keep input behind one small module (`controls.ts` in the template) that the scenes ask.
- Whether two fingers at once reach the page on a real kiosk is not yet known. A game that
  needs two things held together is a risk: say so in the game's notes.
- A finger covers what it touches. Keep what matters out from under it, and make anything
  to be pressed big.

### Coins, lives and the score (the shell)

- **A coin is lives.** Every whole euro on the kiosk is 3 lives, whenever it goes in. There
  are no prices to choose, no buttons to buy with, and no most a player can have.
- **A play** starts with all the credit there is turned into lives, takes more lives from any
  coin put in while it lasts, gives 30 seconds for a coin when the lives run out, and ends
  once with one score. The template's `session.ts` does all of this with the shell: keep it,
  or keep what it does.
- **So a game has lives**, or something that is plainly them: what a coin buys is tries. If
  your game has no natural life (a race, a puzzle), decide what a life is in it and write
  that down. Do not invent a different thing for a coin to buy.
- **The page never adds credit**, and never decides what a coin is worth. It asks the shell.
- **The score is a whole number, 0 or more, sent once.** A place on the leaderboard is for
  show. **Amusement only: no prizes, no cash, nothing given for a score**, and no words
  that suggest there is.
- **A game also runs with no kiosk** (`&free=1`): no coins, no score sent. Ask `onKiosk()`.

### Content is data

- PubPixels makes a different game for each pub: its own art, names and words, and its own
  layouts. **AI generates that content, never code.** The engine is hand-written and fixed.
- So anything a pub would want its own goes in `game.json` and is read by `start(data)`:
  names, words, what there is to collect and what it scores, how hard it is, the layout of
  a maze or a wave or a track. Not in the scenes.
- Think early about how a layout could be **made by rule from a seed and checked by playing
  it**: PubPixels makes its levels that way, and never shows a pub one that has not been
  proved finishable. A game whose layouts can only be drawn by hand is hard to carry over.
- **"Level" is the platformer's word.** Use your own game's word (maze, wave, track, round).
- **Lettering is never part of a picture.** Anything with words on it is drawn blank and the
  game writes the words.
- No copyrighted characters, brands or logos, and no real people, in anything.

### Code

- TypeScript, strict. Phaser 4 (not 3: check the API in `node_modules/phaser` or the skills
  in `.claude/skills` before using something from memory).
- **Rules as plain functions, drawing in scenes.** Whatever can be worked out without
  Phaser (movement, collisions, scoring, reading the data) goes in modules with no Phaser
  import and has tests beside it (`logic.ts`, `logic.test.ts`). Tests never import Phaser.
- A scene object is used again each time it starts: set every field afresh in `init` or
  `create`.
- Comments say why, in plain words. Match the template's.

## The shell is not ours to change

`src/shell` is a copy of `app/frontend/game/shell` in PubPixels (`src/shell/COPIED_FROM`
says which commit). It is how a game meets a kiosk, and PubPixels owns it.

- Never edit a file in it. A change made here is lost the next time it is copied, and a
  game that leans on it will not run in PubPixels.
- If a game needs something the shell does not give, write it in the game's own folder and
  note it in the game's `CLAUDE.md` under "Asks of the shell". That list is what gets
  discussed when the game is carried over.
- `npm run shell:sync` copies it again from `../pubpixels`. Whoever runs it runs the checks
  after, since every game depends on it.

## The pretend kiosk

`tools/pretend-kiosk.mjs` answers the few addresses of PubPixels' kiosk API the shell calls,
from memory, in the dev server. It is always in admin mode, which is what shows the strip of
coins. It is not the real thing: it checks nobody and keeps nothing. If the shell and it
disagree after a sync, the pretend kiosk is what is wrong (the real API is described in
`../pubpixels/docs/KIOSK_API.md`).

## Money

Nothing here costs anything, and nothing should. Do not call PixelLab, the Claude API or
any paid service from a game or a tool without the person saying so and knowing the cost.
Pint Dash's art generator (`npm run art:generate`) spends PixelLab credit: leave it alone.
Use plain shapes, or free art with its licence noted, until a game is carried over; its real
art is made in PubPixels.
