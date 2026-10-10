/**
 * Works out where the player can get to in a level, by playing it. Pure, no Phaser.
 *
 * A small copy of the game's physics, using the same run and jump functions and the same
 * numbers, tries a fixed set of moves from every cell the player can stand in: jumps of
 * different lengths, from a standstill and from a run, steering for different amounts of
 * time, and walking off ledges. Each move that ends with the player standing somewhere
 * is a step that can really be made. Following those steps from the spawn point gives
 * every cell the player can reach and the quickest time to it.
 *
 * It only ever finds real routes, but it does not find them all: it tries a fixed set of
 * moves, and it ignores the kegs. So "reachable" is proof, and "not found" means look.
 *
 * Everything here is in tiles and seconds, so the answer is the same at any tile size.
 */
import { PLAYER, TILE_SIZE, WORLD } from '../config/constants';
import { isSolid, type LevelData } from './level';
import {
  createJumpState,
  stepJump,
  stepRunVelocity,
  type JumpState,
  type JumpTuning,
  type RunTuning,
} from './movement';

export interface ReachTuning extends RunTuning, JumpTuning {
  gravity: number;
  maxFallSpeed: number;
  /** How far below the level the player can fall before it counts as lost. */
  fallMargin: number;
  oneWayTolerance: number;
  /** The physics ignores a tile the body is further into than this (Arcade's `TILE_BIAS`). */
  tileBias: number;
}

const inTiles = (pixels: number) => pixels / TILE_SIZE;

/** The game's own numbers, converted to tiles. */
export const GAME_TUNING: ReachTuning = {
  runSpeed: inTiles(PLAYER.runSpeed),
  groundAccel: inTiles(PLAYER.groundAccel),
  groundFriction: inTiles(PLAYER.groundFriction),
  airAccel: inTiles(PLAYER.airAccel),
  airFriction: inTiles(PLAYER.airFriction),
  jumpVelocity: inTiles(PLAYER.jumpVelocity),
  jumpCutMultiplier: PLAYER.jumpCutMultiplier,
  coyoteTimeMs: PLAYER.coyoteTimeMs,
  jumpBufferMs: PLAYER.jumpBufferMs,
  gravity: inTiles(WORLD.gravity),
  maxFallSpeed: inTiles(PLAYER.maxFallSpeed),
  fallMargin: inTiles(WORLD.fallDeathMargin),
  oneWayTolerance: inTiles(WORLD.oneWayTolerance),
  // 16 pixels is Arcade's default; the game does not change it.
  tileBias: inTiles(16),
};

/**
 * A player who runs and jumps at `strength` of full speed. A level that can still be
 * finished at 0.9 has no jump that needs to be perfect.
 */
export function weakened(tuning: ReachTuning, strength: number): ReachTuning {
  return {
    ...tuning,
    runSpeed: tuning.runSpeed * strength,
    jumpVelocity: tuning.jumpVelocity * strength,
  };
}

/**
 * The player's box for bumping into things: as narrow as the narrowest theme's hero
 * (which makes jumps shortest) and as tall as the tallest (which needs most headroom).
 */
const BODY = { width: 0.625, height: 1.25 };
/** The part of the player that picks things up: the smallest hero box of any theme. */
const GRAB = { width: 0.56, height: 1 };
/** Half the size of the smallest pickup of any theme. It floats in the middle of its cell. */
const PICKUP_HALF = { width: 0.25, height: 0.33 };

const STEP = 1 / 60;
const MAX_FRAMES = 300;
const EPSILON = 1e-6;

/** How long the jump button is held, in frames, from a tap to a full jump. */
const JUMP_HOLDS = [2, 5, 8, 12, 60];
/** How long the player keeps steering once in the air, in frames. */
const STEER_HOLDS = [6, 12, 20, 30, MAX_FRAMES];

type Direction = -1 | 0 | 1;

/** One thing the player can try from a standing start in the middle of a cell. */
export interface Move {
  direction: Direction;
  /**
   * `jump`: press jump at once. `runningJump`: run, and press it on reaching the edge of
   * the cell, by which time the player is at full speed. `walkOff`: no jump at all.
   */
  takeoff: 'jump' | 'runningJump' | 'walkOff';
  /** How long the jump button is held, in frames. */
  jumpFrames: number;
  /** How long the direction is held once in the air, in frames. */
  steerFrames: number;
}

/** Where a move ends: the cell the player comes to rest in, and where exactly. */
export interface MoveResult {
  column: number;
  row: number;
  /** The middle of the player, in tiles from the left of the level. */
  x: number;
  seconds: number;
}

function allMoves(): Move[] {
  const moves: Move[] = [{ direction: 0, takeoff: 'jump', jumpFrames: 60, steerFrames: 0 }];
  for (const direction of [-1, 1] as const) {
    for (const steerFrames of STEER_HOLDS) {
      moves.push({ direction, takeoff: 'walkOff', jumpFrames: 0, steerFrames });
      for (const takeoff of ['jump', 'runningJump'] as const) {
        for (const jumpFrames of JUMP_HOLDS) {
          moves.push({ direction, takeoff, jumpFrames, steerFrames });
        }
      }
    }
  }
  return moves;
}

const MOVES = allMoves();

/** One step of a route: from standing in one cell to standing in another. */
export interface RouteStep {
  from: { column: number; row: number };
  to: { column: number; row: number };
  /** The move that does it, or null for walking to the next cell. */
  move: Move | null;
}

export interface Reach {
  /** Seconds of the quickest route found to standing in this cell, or null if none was. */
  timeTo(column: number, row: number): number | null;
  /** Whether a route passes through the middle of this cell, where a pickup would float. */
  touches(column: number, row: number): boolean;
  /** The quickest route found to this cell, step by step from the spawn point. */
  routeTo(column: number, row: number): RouteStep[] | null;
}

interface Body {
  /** Centre. */
  x: number;
  /** Feet. */
  y: number;
  velocityX: number;
  velocityY: number;
  grounded: boolean;
  jump: JumpState;
}

/** The game's physics on one level: what `analyseReach` and `playMove` are built from. */
function simulate(level: LevelData, tuning: ReachTuning) {
  const { width: columns, height: rows, cells } = level;
  const key = (column: number, row: number) => row * columns + column;

  const kindAt = (row: number, column: number) =>
    row < 0 || row >= rows || column < 0 || column >= columns ? null : cells[row][column];
  const solidAt = (row: number, column: number) => isSolid(kindAt(row, column));
  const holdsUp = (row: number, column: number) => kindAt(row, column) !== null;

  /** A cell the player can stand in: something under it, nothing solid in it or over its head. */
  const canStandIn = (column: number, row: number) =>
    column >= 0 &&
    column < columns &&
    row >= 0 &&
    holdsUp(row + 1, column) &&
    !solidAt(row, column) &&
    !solidAt(row - 1, column);

  // --- One frame of the game's physics ---------------------------------------------------

  const halfWidth = BODY.width / 2;

  /**
   * One frame, in the same order as the game: the player's code sets the velocities, then
   * the physics adds gravity, moves the body, and pushes it out of anything it is now in.
   */
  function advance(body: Body, moveX: Direction, jumpPressed: boolean, jumpHeld: boolean): void {
    const onGround = body.grounded && body.velocityY >= 0;
    body.velocityX = stepRunVelocity(body.velocityX, moveX, onGround, STEP, tuning);
    const velocityY = stepJump(
      body.jump,
      { onGround, jumpPressed, jumpHeld, velocityY: body.velocityY },
      STEP * 1000,
      tuning,
    );
    body.velocityY = Math.min(velocityY, tuning.maxFallSpeed) + tuning.gravity * STEP;

    const previousFeet = body.y;
    const deltaX = body.velocityX * STEP;
    const deltaY = body.velocityY * STEP;
    body.x += deltaX;
    body.y += deltaY;
    body.grounded = false;

    // The sides and top of the level. The bottom is open.
    if (body.x - halfWidth < 0) {
      body.x = halfWidth;
      body.velocityX = 0;
    } else if (body.x + halfWidth > columns) {
      body.x = columns - halfWidth;
      body.velocityX = 0;
    }
    if (body.y - BODY.height < 0) {
      body.y = BODY.height;
      body.velocityY = 0;
    }

    // Every tile the body is now in, top row first, as the engine visits them.
    const firstRow = Math.floor(body.y - BODY.height);
    const lastRow = Math.floor(body.y);
    const firstColumn = Math.floor(body.x - halfWidth);
    const lastColumn = Math.floor(body.x + halfWidth);
    for (let row = firstRow; row <= lastRow; row++) {
      for (let column = firstColumn; column <= lastColumn; column++) {
        separate(body, row, column, deltaX, deltaY, previousFeet);
      }
    }
  }

  /**
   * Pushes the body out of one tile, the way Phaser's Arcade physics does (its
   * `SeparateTile`). The part that matters is the corner rule. A body moving diagonally
   * into the corner of a ledge is pushed out along whichever direction it has gone in
   * least. So a jump that only just clips the top corner of a ledge, having sunk further
   * down than across, is pushed back off it sideways and does not land.
   */
  function separate(
    body: Body,
    row: number,
    column: number,
    deltaX: number,
    deltaY: number,
    previousFeet: number,
  ): void {
    const kind = kindAt(row, column);
    if (kind === null) return;

    // A face only counts if there is no solid tile on the other side of it. A one-way
    // platform has a top and nothing else.
    const solid = kind !== 'oneWay';
    const faceTop = !solid || !solidAt(row - 1, column);
    const faceBottom = solid && !solidAt(row + 1, column);
    const faceLeft = solid && !solidAt(row, column - 1);
    const faceRight = solid && !solidAt(row, column + 1);
    const faceHorizontal = faceLeft || faceRight;
    const faceVertical = faceTop || faceBottom;
    if (!faceHorizontal && !faceVertical) return;

    // Touching is not overlapping. A full jump on flat ground comes back to exactly the
    // height it left from, and the game does not count that frame as a landing.
    const inTile = () =>
      body.x + halfWidth > column + EPSILON &&
      body.x - halfWidth < column + 1 - EPSILON &&
      body.y > row + EPSILON &&
      body.y - BODY.height < row + 1 - EPSILON;
    if (!inTile()) return;
    // A one-way platform only catches feet that started the step above it.
    if (!solid && previousFeet > row + tuning.oneWayTolerance) return;

    const pushX = (): boolean => {
      let overlap = 0;
      if (deltaX < 0 && faceRight && body.x - halfWidth < column + 1) {
        overlap = body.x - halfWidth - (column + 1);
      } else if (deltaX > 0 && faceLeft && body.x + halfWidth > column) {
        overlap = body.x + halfWidth - column;
      }
      if (overlap === 0 || Math.abs(overlap) > tuning.tileBias) return false;
      body.x -= overlap;
      body.velocityX = 0;
      return true;
    };
    const pushY = (): boolean => {
      let overlap = 0;
      if (deltaY < 0 && faceBottom && body.y - BODY.height < row + 1) {
        overlap = body.y - BODY.height - (row + 1);
      } else if (deltaY > 0 && faceTop && body.y > row) {
        overlap = body.y - row;
      }
      if (overlap === 0 || Math.abs(overlap) > tuning.tileBias) return false;
      body.y -= overlap;
      body.velocityY = 0;
      if (overlap > 0) body.grounded = true;
      return true;
    };

    // Which direction first: the one the body moved less in, or at a corner, the one it
    // is less far into the tile along.
    let depthX = Math.abs(deltaX) > Math.abs(deltaY) ? -1 : 0;
    let depthY = Math.abs(deltaX) < Math.abs(deltaY) ? -1 : 1;
    if (deltaX !== 0 && deltaY !== 0 && faceHorizontal && faceVertical) {
      depthX = Math.min(
        Math.abs(body.x - halfWidth - (column + 1)),
        Math.abs(body.x + halfWidth - column),
      );
      depthY = Math.min(Math.abs(body.y - BODY.height - (row + 1)), Math.abs(body.y - row));
    }

    if (depthX < depthY) {
      if (faceHorizontal && pushX() && !inTile()) return;
      if (faceVertical) pushY();
    } else {
      if (faceVertical && pushY() && !inTile()) return;
      if (faceHorizontal) pushX();
    }
  }

  // --- Pickups -----------------------------------------------------------------------------

  const pickups = new Set<number>();
  for (const object of level.objects) {
    if (object.type === 'coin' || object.type === 'life') {
      pickups.add(
        key(Math.floor(object.x / level.tileSize), Math.round(object.y / level.tileSize) - 1),
      );
    }
  }
  /** Adds the pickups the player's box is over right now to `into`. */
  function grab(body: Body, into: Set<number>): void {
    const left = body.x - GRAB.width / 2;
    const right = body.x + GRAB.width / 2;
    const top = body.y - GRAB.height;
    for (let row = Math.floor(top); row <= Math.floor(body.y - EPSILON); row++) {
      for (let column = Math.floor(left); column <= Math.floor(right); column++) {
        if (!pickups.has(key(column, row))) continue;
        const overX = Math.abs(column + 0.5 - body.x) < GRAB.width / 2 + PICKUP_HALF.width;
        const middleY = (top + body.y) / 2;
        const overY = Math.abs(row + 0.5 - middleY) < GRAB.height / 2 + PICKUP_HALF.height;
        if (overX && overY) into.add(key(column, row));
      }
    }
  }

  // --- One move, played to the end -----------------------------------------------------

  interface Outcome extends MoveResult {
    grabbed: Set<number>;
  }

  function play(column: number, row: number, move: Move): Outcome | null {
    const body: Body = {
      x: column + 0.5,
      y: row + 1,
      velocityX: 0,
      velocityY: 0,
      grounded: true,
      jump: createJumpState(),
    };
    const grabbed = new Set<number>();
    const boundary = move.direction > 0 ? column + 1 : column;

    /** The frame the jump button went down, and the frame the player left the ground. */
    let pressedAt = move.takeoff === 'jump' ? 0 : -1;
    let airborneAt = -1;
    let landed = false;

    for (let frame = 0; frame < MAX_FRAMES; frame++) {
      if (move.takeoff === 'runningJump' && pressedAt < 0 && body.grounded) {
        const crossed = move.direction > 0 ? body.x >= boundary : body.x <= boundary;
        if (crossed) pressedAt = frame;
      }
      // The direction is held up to the take-off and for a while in the air, then let go,
      // so the player comes to rest after landing.
      const steerFrom = move.takeoff === 'walkOff' ? airborneAt : pressedAt;
      const steering = !landed && (steerFrom < 0 || frame < steerFrom + move.steerFrames);
      const jumpHeld = pressedAt >= 0 && frame < pressedAt + move.jumpFrames;

      advance(body, steering ? move.direction : 0, frame === pressedAt, jumpHeld);
      grab(body, grabbed);

      if (body.y > rows + tuning.fallMargin) return null;
      if (!body.grounded && airborneAt < 0) airborneAt = frame;
      if (body.grounded && airborneAt >= 0) landed = true;

      if (body.grounded && body.velocityX === 0) {
        if (airborneAt >= 0) {
          // Landed and come to rest. The cell is the one under the middle of the body,
          // or the one beside it if the middle is hanging over an edge.
          const restRow = Math.round(body.y) - 1;
          const under = [Math.floor(body.x), Math.floor(body.x) - 1, Math.floor(body.x) + 1];
          const restColumn = under.find(
            (candidate) =>
              candidate + 1 > body.x - halfWidth &&
              candidate < body.x + halfWidth &&
              canStandIn(candidate, restRow),
          );
          if (restColumn === undefined) return null;
          return {
            column: restColumn,
            row: restRow,
            x: body.x,
            seconds: (frame + 1) * STEP,
            grabbed,
          };
        }
        // Stopped against a wall without ever leaving the ground.
        if (frame > 10) return null;
      }
    }
    return null;
  }

  /** The pickups in reach of a player standing still in the middle of a cell. */
  function grabStanding(column: number, row: number, into: Set<number>): void {
    const body = {
      x: column + 0.5,
      y: row + 1,
      velocityX: 0,
      velocityY: 0,
      grounded: true,
      jump: createJumpState(),
    };
    grab(body, into);
  }

  return { columns, key, canStandIn, play, grabStanding };
}

/** Plays one move from standing in a cell. Null if it ends in a fall or goes nowhere. */
export function playMove(
  level: LevelData,
  from: { column: number; row: number },
  move: Move,
  tuning: ReachTuning = GAME_TUNING,
): MoveResult | null {
  const outcome = simulate(level, tuning).play(from.column, from.row, move);
  if (!outcome) return null;
  const { column, row, x, seconds } = outcome;
  return { column, row, x, seconds };
}

/** Finds everywhere the player can get to from the spawn point, and how quickly. */
export function analyseReach(level: LevelData, tuning: ReachTuning = GAME_TUNING): Reach {
  const { columns, key, canStandIn, play, grabStanding } = simulate(level, tuning);
  const touched = new Set<number>();

  // --- The quickest way to everywhere --------------------------------------------------

  const time = new Map<number, number>();
  const waiting = new Map<number, number>();
  const spawn = level.objects.find((object) => object.type === 'player');
  if (spawn) {
    const column = Math.floor(spawn.x / level.tileSize);
    const row = Math.round(spawn.y / level.tileSize) - 1;
    waiting.set(key(column, row), 0);
  }

  /** How each cell was first reached quickest: the cell before it, and the move. */
  const cameBy = new Map<number, { from: number; move: Move | null }>();

  const offer = (from: number, move: Move | null, column: number, row: number, seconds: number) => {
    const id = key(column, row);
    if (time.has(id)) return;
    if (seconds < (waiting.get(id) ?? Infinity)) {
      waiting.set(id, seconds);
      cameBy.set(id, { from, move });
    }
  };

  while (waiting.size > 0) {
    let id = -1;
    let seconds = Infinity;
    for (const [candidate, candidateSeconds] of waiting) {
      if (candidateSeconds < seconds) {
        id = candidate;
        seconds = candidateSeconds;
      }
    }
    waiting.delete(id);
    time.set(id, seconds);

    const column = id % columns;
    const row = Math.floor(id / columns);
    grabStanding(column, row, touched);

    // Walking to the next cell along.
    for (const direction of [-1, 1]) {
      if (canStandIn(column + direction, row)) {
        offer(id, null, column + direction, row, seconds + 1 / tuning.runSpeed);
      }
    }
    for (const move of MOVES) {
      const outcome = play(column, row, move);
      if (outcome) {
        offer(id, move, outcome.column, outcome.row, seconds + outcome.seconds);
        for (const pickup of outcome.grabbed) touched.add(pickup);
      }
    }
  }

  const cellOf = (id: number) => ({ column: id % columns, row: Math.floor(id / columns) });

  return {
    timeTo: (column, row) => time.get(key(column, row)) ?? null,
    touches: (column, row) => touched.has(key(column, row)),
    routeTo(column, row) {
      let id = key(column, row);
      if (!time.has(id)) return null;
      const steps: RouteStep[] = [];
      for (let step = cameBy.get(id); step; step = cameBy.get(id)) {
        steps.unshift({ from: cellOf(step.from), to: cellOf(id), move: step.move });
        id = step.from;
      }
      return steps;
    },
  };
}
