import { describe, expect, it } from 'vitest';
import {
  airPoseIndex,
  approach,
  createJumpState,
  isStomp,
  stepJump,
  stepRunVelocity,
  type JumpInput,
  type JumpTuning,
  type RunTuning,
} from './movement';

const RUN: RunTuning = {
  runSpeed: 100,
  groundAccel: 1000,
  groundFriction: 500,
  airAccel: 400,
  airFriction: 100,
};

const JUMP: JumpTuning = {
  jumpVelocity: 300,
  jumpCutMultiplier: 0.5,
  coyoteTimeMs: 100,
  jumpBufferMs: 100,
};

const FRAME_MS = 16;

function input(overrides: Partial<JumpInput> = {}): JumpInput {
  return { onGround: false, jumpPressed: false, jumpHeld: false, velocityY: 0, ...overrides };
}

describe('approach', () => {
  it('moves towards the target without overshooting', () => {
    expect(approach(0, 10, 4)).toBe(4);
    expect(approach(8, 10, 4)).toBe(10);
    expect(approach(0, -10, 4)).toBe(-4);
    expect(approach(-8, -10, 4)).toBe(-10);
    expect(approach(10, 10, 4)).toBe(10);
  });
});

describe('stepRunVelocity', () => {
  it('accelerates towards run speed and caps there', () => {
    expect(stepRunVelocity(0, 1, true, 0.05, RUN)).toBe(50);
    expect(stepRunVelocity(90, 1, true, 0.05, RUN)).toBe(100);
    expect(stepRunVelocity(0, -1, true, 0.05, RUN)).toBe(-50);
  });

  it('slows to a stop with friction when there is no input', () => {
    expect(stepRunVelocity(100, 0, true, 0.1, RUN)).toBe(50);
    expect(stepRunVelocity(20, 0, true, 0.1, RUN)).toBe(0);
    expect(stepRunVelocity(-20, 0, true, 0.1, RUN)).toBe(0);
  });

  it('uses acceleration plus friction when reversing direction', () => {
    expect(stepRunVelocity(100, -1, true, 0.05, RUN)).toBe(25);
  });

  it('has less control in the air', () => {
    expect(stepRunVelocity(0, 1, false, 0.05, RUN)).toBe(20);
    expect(stepRunVelocity(100, 0, false, 0.1, RUN)).toBe(90);
  });
});

describe('stepJump', () => {
  it('jumps when pressed on the ground', () => {
    const state = createJumpState();
    const vy = stepJump(state, input({ onGround: true, jumpPressed: true }), FRAME_MS, JUMP);
    expect(vy).toBe(-300);
  });

  it('flags justJumped only on the step the jump starts', () => {
    const state = createJumpState();
    stepJump(state, input({ onGround: true, jumpPressed: true, jumpHeld: true }), FRAME_MS, JUMP);
    expect(state.justJumped).toBe(true);

    stepJump(state, input({ jumpHeld: true, velocityY: -280 }), FRAME_MS, JUMP);
    expect(state.justJumped).toBe(false);
  });

  it('does nothing when jump is pressed in mid-air with no coyote time left', () => {
    const state = createJumpState();
    const vy = stepJump(state, input({ jumpPressed: true, velocityY: 50 }), FRAME_MS, JUMP);
    expect(vy).toBe(50);
  });

  it('allows a jump shortly after leaving the ground (coyote time)', () => {
    const state = createJumpState();
    stepJump(state, input({ onGround: true }), FRAME_MS, JUMP);
    stepJump(state, input({ velocityY: 20 }), 90, JUMP);

    const vy = stepJump(state, input({ jumpPressed: true, velocityY: 40 }), 5, JUMP);
    expect(vy).toBe(-300);
  });

  it('refuses the jump once coyote time has run out', () => {
    const state = createJumpState();
    stepJump(state, input({ onGround: true }), FRAME_MS, JUMP);
    stepJump(state, input({ velocityY: 20 }), 100, JUMP);

    const vy = stepJump(state, input({ jumpPressed: true, velocityY: 40 }), FRAME_MS, JUMP);
    expect(vy).toBe(40);
  });

  it('fires a buffered jump on landing', () => {
    const state = createJumpState();
    stepJump(state, input({ jumpPressed: true, velocityY: 200 }), FRAME_MS, JUMP);
    stepJump(state, input({ velocityY: 220 }), 80, JUMP);

    const vy = stepJump(state, input({ onGround: true }), FRAME_MS, JUMP);
    expect(vy).toBe(-300);
  });

  it('drops a buffered jump that was pressed too early', () => {
    const state = createJumpState();
    stepJump(state, input({ jumpPressed: true, velocityY: 200 }), FRAME_MS, JUMP);
    stepJump(state, input({ velocityY: 220 }), 100, JUMP);

    const vy = stepJump(state, input({ onGround: true }), FRAME_MS, JUMP);
    expect(vy).toBe(0);
  });

  it('cannot double jump inside the coyote window', () => {
    const state = createJumpState();
    stepJump(state, input({ onGround: true, jumpPressed: true, jumpHeld: true }), FRAME_MS, JUMP);

    const vy = stepJump(
      state,
      input({ jumpPressed: true, jumpHeld: true, velocityY: -280 }),
      FRAME_MS,
      JUMP,
    );
    expect(vy).toBe(-280);
  });

  it('cuts the jump short when the button is released while rising', () => {
    const state = createJumpState();
    stepJump(state, input({ onGround: true, jumpPressed: true, jumpHeld: true }), FRAME_MS, JUMP);

    expect(stepJump(state, input({ jumpHeld: true, velocityY: -280 }), FRAME_MS, JUMP)).toBe(-280);
    expect(stepJump(state, input({ velocityY: -260 }), FRAME_MS, JUMP)).toBe(-130);
    // Only cut once.
    expect(stepJump(state, input({ velocityY: -120 }), FRAME_MS, JUMP)).toBe(-120);
  });

  it('does not cut upward velocity that did not come from a jump', () => {
    const state = createJumpState();
    expect(stepJump(state, input({ velocityY: -200 }), FRAME_MS, JUMP)).toBe(-200);
  });
});

describe('airPoseIndex', () => {
  const AIR = { jumpVelocity: 300, maxFallSpeed: 300 };

  it('goes from the first pose at take-off to the last at full fall speed', () => {
    expect(airPoseIndex(-300, 3, AIR)).toBe(0);
    expect(airPoseIndex(0, 3, AIR)).toBe(1);
    expect(airPoseIndex(300, 3, AIR)).toBe(2);
  });

  it('changes pose a third of the way up and a third of the way down, for three poses', () => {
    expect(airPoseIndex(-101, 3, AIR)).toBe(0);
    expect(airPoseIndex(-99, 3, AIR)).toBe(1);
    expect(airPoseIndex(99, 3, AIR)).toBe(1);
    expect(airPoseIndex(101, 3, AIR)).toBe(2);
  });

  it('stays in range for speeds beyond the tuning', () => {
    expect(airPoseIndex(-900, 3, AIR)).toBe(0);
    expect(airPoseIndex(900, 3, AIR)).toBe(2);
  });

  it('always picks the only pose when there is one', () => {
    expect(airPoseIndex(-300, 1, AIR)).toBe(0);
    expect(airPoseIndex(300, 1, AIR)).toBe(0);
  });
});

describe('isStomp', () => {
  it('counts contact from above', () => {
    expect(isStomp(98, 100, 4)).toBe(true);
    expect(isStomp(104, 100, 4)).toBe(true);
  });

  it('does not count contact from the side or below', () => {
    expect(isStomp(110, 100, 4)).toBe(false);
  });
});
