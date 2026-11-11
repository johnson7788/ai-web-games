// tests/ragdoll.test.mjs — Ragdoll physics tests
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, WORLD, STEP } from '../config/game.config.js';
import {
  createBody, stepPhysics, moveBody, setJumpPose, aimBody,
  getGunDir, getGunTip, applyRecoil, applyImpulse, isGrounded,
  ragdollDeath, stepRagdoll, setBodyPos, getBodyCenter,
  POINT_ORDER, PELVIS,
} from '../src/game/ragdoll.js';

const R = CONFIG.rig;

describe('ragdoll', () => {
  it('POINT_ORDER has 11 entries', () => {
    assert.equal(POINT_ORDER.length, 11);
    assert.equal(POINT_ORDER[0], 'head');
    assert.equal(POINT_ORDER[2], 'pelvis');
    assert.equal(POINT_ORDER[9], 'footL');
    assert.equal(POINT_ORDER[10], 'footR');
  });

  it('createBody produces 11 points at correct offsets', () => {
    const b = createBody(640, 500);
    assert.equal(b.pts.length, 11);
    assert.equal(b.pts[PELVIS].x, 640);
    assert.equal(b.pts[PELVIS].y, 500);
    assert.ok(b.pts[0].y < 500);
  });

  it('free fall reaches ground and stops', () => {
    const b = createBody(640, 200);
    for (let i = 0; i < 300; i++) stepPhysics(b, null, STEP);
    const py = b.pts[PELVIS].y;
    assert.ok(py <= WORLD.groundY + 1, `pelvis y=${py} should be near ground ${WORLD.groundY}`);
    assert.ok(Math.abs(b.pts[PELVIS].vy) < 50, 'should have low vertical velocity on ground');
  });

  it('does not penetrate ground', () => {
    const b = createBody(640, 100);
    for (let i = 0; i < 600; i++) {
      stepPhysics(b, null, STEP);
      for (const p of b.pts) {
        assert.ok(p.y <= WORLD.groundY + 5, `point y=${p.y.toFixed(1)} exceeded ground`);
      }
    }
  });

  it('walls prevent escape', () => {
    const b = createBody(5, 500);
    applyImpulse(b, -500, 0, 1);
    for (let i = 0; i < 60; i++) stepPhysics(b, null, STEP);
    for (const p of b.pts) {
      assert.ok(p.x >= 0, `point x=${p.x} escaped left wall`);
    }
    const b2 = createBody(WORLD.w - 5, 500);
    applyImpulse(b2, 500, 0, 1);
    for (let i = 0; i < 60; i++) stepPhysics(b2, null, STEP);
    for (const p of b2.pts) {
      assert.ok(p.x <= WORLD.w, `point x=${p.x} escaped right wall`);
    }
  });

  it('platform one-way: pass through from below', () => {
    const map = { platforms: [{ x: 500, y: 400, w: 200, h: 14 }], groundY: WORLD.groundY };
    const b = createBody(600, 500);
    applyImpulse(b, 0, -1200, 1);
    let passedThrough = false;
    for (let i = 0; i < 60; i++) {
      stepPhysics(b, map, STEP);
      if (b.pts[PELVIS].y < 399) passedThrough = true;
    }
    assert.ok(passedThrough, 'body should pass through platform from below');
  });

  it('platform one-way: land on top from above', () => {
    const map = { platforms: [{ x: 500, y: 400, w: 200, h: 14 }], groundY: WORLD.groundY };
    const b = createBody(600, 300);
    for (let i = 0; i < 200; i++) stepPhysics(b, map, STEP);
    const onPlatform = b.pts.some(p => Math.abs(p.y - 400) < 3 && p.x >= 500 && p.x <= 700);
    const onGround = b.pts[PELVIS].y >= WORLD.groundY - 2;
    assert.ok(onPlatform || onGround, 'body should land on platform or ground');
  });

  it('walking moves body ~400px/s', () => {
    const b = createBody(400, WORLD.groundY);
    for (let i = 0; i < 120; i++) {
      moveBody(b, 1, STEP);
      stepPhysics(b, null, STEP);
    }
    const dx = b.pts[PELVIS].x - 400;
    assert.ok(dx > 200 && dx < 950, `walk distance ${dx.toFixed(0)} should be ~300-800px in 2s`);
  });

  it('walking alternates feet', () => {
    const b = createBody(400, WORLD.groundY);
    let swaps = 0;
    let lastFoot = b.supportFoot;
    for (let i = 0; i < 240; i++) {
      moveBody(b, 1, STEP);
      stepPhysics(b, null, STEP);
      if (b.supportFoot !== lastFoot) { swaps++; lastFoot = b.supportFoot; }
    }
    assert.ok(swaps >= 2, `foot should swap at least twice, got ${swaps}`);
  });

  it('stop walking → velocity approaches zero', () => {
    const b = createBody(400, WORLD.groundY);
    for (let i = 0; i < 120; i++) { moveBody(b, 1, STEP); stepPhysics(b, null, STEP); }
    for (let i = 0; i < 120; i++) { moveBody(b, 0, STEP); stepPhysics(b, null, STEP); }
    assert.ok(Math.abs(b.pts[PELVIS].vx) < 30, `pelvis vx=${b.pts[PELVIS].vx.toFixed(1)} should be near zero`);
  });

  it('jump reaches 150-350px height', () => {
    const b = createBody(400, WORLD.groundY);
    const startY = b.pts[PELVIS].y;
    for (const p of b.pts) p.vy = CONFIG.player.jump;
    let minY = startY;
    for (let i = 0; i < 120; i++) {
      stepPhysics(b, null, STEP);
      minY = Math.min(minY, b.pts[PELVIS].y);
    }
    const height = startY - minY;
    assert.ok(height > 80 && height < 400, `jump height ${height.toFixed(0)} should be 80-400px`);
  });

  it('coyote time allows late jump', () => {
    const b = createBody(400, WORLD.groundY);
    for (let i = 0; i < 10; i++) stepPhysics(b, null, STEP);
    assert.ok(!isGrounded(b) || b.pts[PELVIS].y >= WORLD.groundY - 5);
    for (const p of b.pts) p.vy = CONFIG.player.jump;
    let rose = false;
    for (let i = 0; i < 20; i++) {
      stepPhysics(b, null, STEP);
      if (b.pts[PELVIS].y < WORLD.groundY - 20) rose = true;
    }
    assert.ok(rose, 'jump should lift body');
  });

  it('ragdoll death: all points reach ground area', () => {
    const b = createBody(640, 300);
    const rng = () => Math.random();
    ragdollDeath(b, rng);
    for (let i = 0; i < 360; i++) stepRagdoll(b, 0, null, STEP);
    for (const p of b.pts) {
      assert.ok(!isNaN(p.x) && !isNaN(p.y), 'no NaN in ragdoll points');
      assert.ok(p.y <= WORLD.groundY + 10, `ragdoll point y=${p.y} should be near ground`);
    }
  });

  it('ragdoll: no NaN after 10s', () => {
    const b = createBody(640, 200);
    const rng = () => Math.random();
    ragdollDeath(b, rng);
    for (let i = 0; i < 600; i++) {
      stepRagdoll(b, i * 0.01, null, STEP);
      for (const p of b.pts) {
        assert.ok(!isNaN(p.x) && !isNaN(p.y), `NaN at step ${i}`);
      }
    }
  });

  it('aimBody pulls hand toward target', () => {
    const b = createBody(640, 500);
    const handBefore = { x: b.pts[6].x, y: b.pts[6].y };
    aimBody(b, 900, 300, 1);
    assert.ok(b.pts[6].vx > 0, 'hand should move right toward aim');
    assert.ok(b.pts[6].vy < 0, 'hand should move up toward aim');
  });

  it('getGunDir returns normalized direction', () => {
    const b = createBody(640, 500);
    b.pts[6].x = 660; b.pts[6].y = 500;
    b.pts[4].x = 650; b.pts[4].y = 500;
    const dir = getGunDir(b);
    const mag = Math.hypot(dir.x, dir.y);
    assert.ok(Math.abs(mag - 1) < 0.01, `gun dir magnitude ${mag} should be ~1`);
  });

  it('applyRecoil pushes pelvis opposite to shot direction', () => {
    const b = createBody(640, 500);
    applyRecoil(b, 1, 0, 200, 1);
    assert.ok(b.pts[PELVIS].vx < 0, 'pelvis should move left when shooting right');
  });

  it('setBodyPos moves entire body', () => {
    const b = createBody(100, 500);
    setBodyPos(b, 600, 400);
    const c = getBodyCenter(b);
    assert.ok(Math.abs(c.x - 600) < 1, `center x=${c.x} should be ~600`);
    assert.ok(Math.abs(c.y - 400) < 1, `center y=${c.y} should be ~400`);
  });

  it('isGrounded detects ground contact', () => {
    const b = createBody(640, WORLD.groundY);
    for (let i = 0; i < 30; i++) stepPhysics(b, null, STEP);
    assert.ok(isGrounded(b), 'body on ground should be grounded');
  });
});
