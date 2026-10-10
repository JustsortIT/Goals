/**
 * Pure movement maths for the player. No Phaser imports, so this is unit-testable in Node.
 * Entities read physics state, call these, and write the result back to their body.
 */

export interface RunTuning {
  runSpeed: number;
  groundAccel: number;
  groundFriction: number;
  airAccel: number;
  airFriction: number;
}

export interface JumpTuning {
  jumpVelocity: number;
  jumpCutMultiplier: number;
  coyoteTimeMs: number;
  jumpBufferMs: number;
}

export interface JumpState {
  /** Time left in which a jump is still allowed after leaving the ground. */
  coyoteMs: number;
  /** Time left for which a jump press is remembered. */
  bufferMs: number;
  /** True while rising from a jump that can still be cut short by releasing the button. */
  canCut: boolean;
  /** True only for the step in which a jump started (for effects and sounds). */
  justJumped: boolean;
}

export interface JumpInput {
  onGround: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  velocityY: number;
}

/** Moves `current` towards `target` by at most `maxDelta`, without overshooting. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}

/**
 * Next horizontal velocity. Accelerates towards the input direction, decelerates with
 * friction when there is no input, and applies both when reversing so turns feel snappy.
 */
export function stepRunVelocity(
  velocityX: number,
  moveX: number,
  onGround: boolean,
  dtSeconds: number,
  tuning: RunTuning,
): number {
  const accel = onGround ? tuning.groundAccel : tuning.airAccel;
  const friction = onGround ? tuning.groundFriction : tuning.airFriction;
  const reversing = moveX !== 0 && velocityX !== 0 && Math.sign(velocityX) !== Math.sign(moveX);

  let rate = accel;
  if (moveX === 0) rate = friction;
  else if (reversing) rate = accel + friction;

  return approach(velocityX, moveX * tuning.runSpeed, rate * dtSeconds);
}

export function createJumpState(): JumpState {
  return { coyoteMs: 0, bufferMs: 0, canCut: false, justJumped: false };
}

/**
 * Advances the jump timers by `dtMs` (mutating `state`) and returns the vertical velocity
 * the body should have. Handles coyote time, jump buffering and variable jump height.
 */
export function stepJump(
  state: JumpState,
  input: JumpInput,
  dtMs: number,
  tuning: JumpTuning,
): number {
  state.coyoteMs = input.onGround ? tuning.coyoteTimeMs : Math.max(0, state.coyoteMs - dtMs);
  state.bufferMs = input.jumpPressed ? tuning.jumpBufferMs : Math.max(0, state.bufferMs - dtMs);
  state.justJumped = false;

  if (state.bufferMs > 0 && state.coyoteMs > 0) {
    state.bufferMs = 0;
    state.coyoteMs = 0;
    state.canCut = true;
    state.justJumped = true;
    return -tuning.jumpVelocity;
  }

  if (state.canCut) {
    if (input.velocityY >= 0) {
      // Past the apex (or landed): nothing left to cut.
      state.canCut = false;
    } else if (!input.jumpHeld) {
      state.canCut = false;
      return input.velocityY * tuning.jumpCutMultiplier;
    }
  }

  return input.velocityY;
}

/**
 * Which of `poseCount` in-the-air poses to show, given vertical speed. The poses run from
 * leaving the ground to coming back down, and are spread evenly from a full-speed jump
 * (the first pose) to a full-speed fall (the last). Using speed rather than time means a
 * short hop and a long fall both look right.
 */
export function airPoseIndex(
  velocityY: number,
  poseCount: number,
  tuning: { jumpVelocity: number; maxFallSpeed: number },
): number {
  const progress = (velocityY + tuning.jumpVelocity) / (tuning.jumpVelocity + tuning.maxFallSpeed);
  return Math.min(poseCount - 1, Math.max(0, Math.floor(progress * poseCount)));
}

/**
 * Whether a player/enemy contact is a stomp. Compares where the player's feet were before
 * this physics step with the enemy's top, so fast falls that sink into the enemy still count.
 */
export function isStomp(
  playerPreviousBottom: number,
  enemyTop: number,
  tolerance: number,
): boolean {
  return playerPreviousBottom <= enemyTop + tolerance;
}
