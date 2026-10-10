# phaseplay

Where new types of game for PubPixels are tried out. PubPixels puts coin-operated arcade
games on touchscreen kiosks in pubs; it has one type of game so far, a platformer. This repo
is for making the next ones: a maze, a shoot 'em up, a racer, whatever plays well on a kiosk.

Each game is a folder in `src/games`. You make yours with whatever help you like, an AI
assistant included, and when it is good enough it is carried into PubPixels
([docs/CARRYING_OVER.md](docs/CARRYING_OVER.md)).

## Start

You need Node 22.12 or newer (`mise install` gets it, if you use mise).

```
npm ci
npm run dev                              # then open http://localhost:5173
npm run new-game -- maze-chase "Your name"
```

`new-game` copies the template into `src/games/maze-chase`. Open
`http://localhost:5173/play.html?game=maze-chase` and you have a small working game that
already takes coins, counts lives and sends a score the way a kiosk does. Now turn it into
yours.

If you work with Claude Code or another assistant, it reads [CLAUDE.md](CLAUDE.md) for the
rules, and the `CLAUDE.md` in your game's folder for notes on your game. Keep that second
one up to date as you go: it is what whoever carries the game over will read.

## What is here

```
index.html, src/launcher.ts   the list of games (http://localhost:5173)
play.html, src/boot.ts        the page a game plays on (play.html?game=<folder>)
src/shell/                    what every game shares on a kiosk: coins, lives, scores, the
                              pixel font. A copy of PubPixels' own. Never edited here
src/games/_template/          what a new game starts as
src/games/<yours>/            your game. Everything of it is in here
src/games/pint-dash/          the first prototype, kept as a worked example of a whole game
tools/pretend-kiosk.mjs       the dev server's pretend kiosk: answers what the shell asks
tools/new-game.mjs            npm run new-game
tools/sync-shell.sh           npm run shell:sync: brings the shell over from PubPixels again
docs/CARRYING_OVER.md         what a game has to be before it moves, and how it moves
```

## Coins, while you make a game

A game plays two ways, and yours has to work both:

- **On the pretend kiosk** (`play.html?game=<folder>`). A strip along the bottom of the
  screen has a button for each coin. A euro is 3 lives, whenever it goes in: before the game,
  during it, or in the 30 seconds after the last life is lost.
- **Free** (`play.html?game=<folder>&free=1`). No kiosk: no coins, no score kept. This is how
  a publican previews a game, and how anyone plays one that is open to the public.

The pretend kiosk forgets everything when the dev server stops.

## Checks

```
npm run typecheck    # TypeScript
npm test             # unit tests (Vitest): the rules of each game, as plain sums
npm run lint         # ESLint and Prettier
npm run build        # all three pages, built
```

Run them before you push. A game that breaks them breaks them for everyone.

## Working side by side

Work in your own folder and commit to `main` often. You will not collide with anyone as
long as you keep out of `src/shell`, `src/boot.ts`, `tools` and other people's folders. If
you need one of those changed, say so first.
