# Carrying a game into PubPixels

A game made here becomes a type of game in PubPixels, beside the platformer. This says when
one is ready, and what moving it involves. Mark decides when a game goes.

## Ready when

Tick these in the game's own `CLAUDE.md` as they become true.

**It plays**

- [ ] Someone who has not seen it can start, play and finish a go with no help.
- [ ] It is fun for two minutes and still has something to give after ten.
- [ ] It gets harder as it goes, by rule, not by a list written out by hand.

**It keeps the rules** (`CLAUDE.md` at the top of the repo)

- [ ] 480 by 270, pixel font for all text, nothing but Phaser added.
- [ ] Every part of it is played with fingers alone.
- [ ] It has been played on a real touchscreen, and the notes say which and what was found.
      If it needs two touches at once, that is written down.
- [ ] On the pretend kiosk: no start without a euro, all credit becomes lives, a coin in
      the middle of a game adds lives at once, the 30 second count carries the same play
      on, and one score is sent at the end.
- [ ] Free (`&free=1`): it plays with nothing to pay and sends nothing.
- [ ] Nothing in it suggests a prize.

**It can be made for any pub**

- [ ] Everything a pub would want its own is in `game.json`, and `start(data)` checks it and
      says what is wrong with data that does not fit.
- [ ] The notes list every picture the game needs, each with its size in pixels, and every
      place it writes words with how many characters fit.
- [ ] The notes say how a layout (a maze, a wave, a track) is made: by rule from a seed, with
      a way to prove one can be finished. Or they say plainly that this is not solved.

**It is in good order**

- [ ] `npm run typecheck`, `npm test` and `npm run lint` pass.
- [ ] The rules of the game are in modules with no Phaser import, with tests.
- [ ] The shell is untouched, and what the game wanted of it is listed under "Asks of the
      shell".

## What moving it involves

This is done in PubPixels, by whoever looks after it, with the game's maker on hand.

1. **The folder** `src/games/<name>` is copied to `app/frontend/game/<kind>` in PubPixels.
   Its imports of `../../shell` already point the right way.
2. **One line** in `ENGINES` in `app/frontend/game/boot.ts`, and the kind's name in
   `Game::KINDS`. From then PubPixels can serve a game of that type with a bundle made by
   hand from `game.json`.
3. **Then the larger part, which is new work in PubPixels**: a Ruby module beside
   `Platformer` that makes this type's content for a pub. Its art (what pictures, at what
   sizes, described how), its layouts by rule and the check that plays them, and its steps
   in the builder chat. The game's notes are what this is built from, which is why the
   checklist asks for them.
4. **The shared screens.** The title screen with its coin gate, the end screen and the
   scores with initials are still the platformer's in PubPixels. A second type is what
   shows which parts of them belong in the shell, so expect some of the template's
   `session.ts` and scenes to move there at this point.

So a game is "carried over" in two stages: it plays in PubPixels from a hand-made bundle
quickly, and it can be generated for a pub once step 3 is done.
