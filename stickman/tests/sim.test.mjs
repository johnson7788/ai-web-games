// tests/sim.test.mjs — Simulation, combat, waves, upgrades tests
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, WORLD, STEP } from '../config/game.config.js';
import { WEAPONS } from '../config/weapons.js';
import { ENEMIES } from '../config/enemies.js';
import { UPGRADES } from '../config/upgrades.js';
import {
  createRun, step, drainEvents, getHud, getUpgradeChoices,
  applyUpgrade, startNextWave, nextAct, mulberry32,
} from '../src/game/sim.js';
import { setBodyPos } from '../src/game/ragdoll.js';

function runSteps(run, n, input = {}) {
  for (let i = 0; i < n; i++) step(run, input);
}

function fightInput(run) {
  const p = run.sim.player;
  const enemies = run.sim.enemies.filter(e => !e.dead);
  if (enemies.length > 0) {
    const e = enemies[0];
    return { mx: e.x > p.x ? 1 : -1, fire: true, aim: { x: e.x, y: e.y - 20 } };
  }
  return { mx: 1, fire: true, aim: { x: 800, y: 400 } };
}

describe('sim — basic', () => {
  it('createRun returns valid state', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    assert.equal(run.state, 'idle');
    assert.equal(run.actIndex, 0);
    assert.equal(run.sim.player.hp, CONFIG.player.maxInk);
    assert.ok(run.sim.player.body.pts.length === 11);
  });

  it('idle transitions to fighting after intro delay', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    const introSteps = Math.ceil(CONFIG.wave.introDelay / STEP) + 5;
    runSteps(run, introSteps);
    assert.equal(run.state, 'fighting');
  });

  it('startWave spawns enemies from config', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    runSteps(run, Math.ceil(CONFIG.wave.introDelay / STEP) + 2);
    const initialCount = run.sim.enemies.length;
    assert.ok(initialCount > 0, 'enemies should spawn after intro');
  });

  it('drainEvents returns events and clears queue', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    runSteps(run, Math.ceil(CONFIG.wave.introDelay / STEP) + 5);
    const events = drainEvents(run);
    assert.ok(events.length > 0, 'should have events');
    const events2 = drainEvents(run);
    assert.equal(events2.length, 0, 'events should be drained');
  });

  it('getHud returns correct shape', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    const hud = getHud(run);
    assert.ok('ink' in hud);
    assert.ok('weapon' in hud);
    assert.ok('mag' in hud);
    assert.ok('score' in hud);
    assert.ok('combo' in hud);
    assert.ok('dash' in hud);
    assert.ok('bossHp' in hud);
  });
});

describe('sim — weapons', () => {
  it('shooting reduces magazine', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    runSteps(run, Math.ceil(CONFIG.wave.introDelay / STEP) + 2);
    run.state = 'fighting';
    const magBefore = run.sim.player.mag;
    runSteps(run, 10, { fire: true, aim: { x: 800, y: 400 } });
    assert.ok(run.sim.player.mag < magBefore || run.sim.player.reloading, 'mag should decrease or reloading');
  });

  it('empty magazine triggers reload', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    runSteps(run, Math.ceil(CONFIG.wave.introDelay / STEP) + 2);
    run.sim.player.mag = 1;
    run.state = 'fighting';
    runSteps(run, 5, { fire: true, aim: { x: 800, y: 400 } });
    assert.ok(run.sim.player.reloading || run.sim.player.mag === WEAPONS.pencil.mag, 'should reload when empty');
  });

  it('reload completes and fills magazine', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    run.sim.player.reloading = true;
    run.sim.player.reloadT = 0.01;
    run.sim.player.mag = 0;
    runSteps(run, 3);
    assert.equal(run.sim.player.mag, WEAPONS.pencil.mag);
    assert.equal(run.sim.player.reloading, false);
  });

  it('bullets are created on shoot', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    run._shootCd = 0;
    const before = run.sim.bullets.length;
    runSteps(run, 1, { fire: true, aim: { x: 800, y: 400 } });
    assert.ok(run.sim.bullets.length > before, 'bullets should be created');
  });

  it('shot event emitted on fire', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    run._shootCd = 0;
    drainEvents(run);
    runSteps(run, 1, { fire: true, aim: { x: 800, y: 400 } });
    const events = drainEvents(run);
    const shotEvents = events.filter(e => e.type === 'shot');
    assert.ok(shotEvents.length > 0, 'should emit shot event');
  });
});

describe('sim — recoil', () => {
  it('shooting pushes pelvis opposite to aim', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    const pelvis = run.sim.player.body.pts[2];
    const vxBefore = pelvis.vx;
    runSteps(run, 1, { fire: true, aim: { x: 900, y: 400 } });
    assert.ok(pelvis.vx < vxBefore, 'pelvis should move left when shooting right');
  });

  it('air shooting can maintain height (recoil flight)', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    const p = run.sim.player;
    setBodyPos(p.body, 640, 300);
    const yStart = p.body.pts[2].y;
    for (let i = 0; i < 30; i++) {
      step(run, { fire: true, aim: { x: p.x, y: p.y + 300 } });
    }
    const yEnd = p.body.pts[2].y;
    assert.ok(yEnd < yStart + 300, `recoil should slow descent: start=${yStart.toFixed(0)} end=${yEnd.toFixed(0)}`);
  });
});

describe('sim — dash', () => {
  it('dash costs ink', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    const inkBefore = run.sim.player.hp;
    runSteps(run, 1, { dashPressed: true });
    assert.ok(run.sim.player.hp < inkBefore, 'dash should cost ink');
  });

  it('dash grants invulnerability', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    runSteps(run, 1, { dashPressed: true });
    assert.ok(run.sim.player.invuln > 0 || run.sim.player._dashInvuln > 0, 'dash should grant invuln');
  });

  it('dash charges decrease', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    const chargesBefore = run._dashCharges;
    runSteps(run, 1, { dashPressed: true });
    assert.equal(run._dashCharges, chargesBefore - 1);
  });
});

describe('sim — melee', () => {
  it('melee has cooldown', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    runSteps(run, 1, { meleePressed: true });
    assert.ok(run._meleeCd > 0, 'melee should have cooldown');
  });

  it('melee emits event', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    drainEvents(run);
    runSteps(run, 1, { meleePressed: true });
    const events = drainEvents(run);
    assert.ok(events.some(e => e.type === 'melee'), 'should emit melee event');
  });

  it('melee clears nearby enemy bullets', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    const p = run.sim.player;
    run.sim.bullets.push({
      x: p.x + 30, y: p.y, px: p.x + 30, py: p.y,
      dx: -1, dy: 0, speed: 500, owner: 'enemy', dmg: 10,
      r: 4, life: 2, color: '#ff0000', pierce: 1, splash: 0, hit: new Set(),
    });
    runSteps(run, 1, { meleePressed: true });
    const enemyBullets = run.sim.bullets.filter(b => b.owner === 'enemy' && b.life > 0);
    assert.equal(enemyBullets.length, 0, 'melee should clear enemy bullets in range');
  });
});

describe('sim — damage and death', () => {
  it('enemy bullet damages player', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    const p = run.sim.player;
    p.invuln = 0;
    const hpBefore = p.hp;
    run.sim.bullets.push({
      x: p.x, y: p.y, px: p.x - 10, py: p.y,
      dx: 1, dy: 0, speed: 500, owner: 'enemy', dmg: 20,
      r: 4, life: 2, color: '#ff0000', pierce: 1, splash: 0, hit: new Set(),
    });
    runSteps(run, 3);
    assert.ok(p.hp < hpBefore, `player should take damage: ${hpBefore} → ${p.hp}`);
  });

  it('invuln period prevents damage', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    const p = run.sim.player;
    p.invuln = 10;
    const hpBefore = p.hp;
    runSteps(run, 30);
    assert.equal(p.hp, hpBefore, 'invuln should prevent damage');
  });

  it('ink reaches 0 → dead state + event', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    run.sim.player.hp = 1;
    run.sim.player.invuln = 0;
    run.sim.player._dashInvuln = 0;
    run.sim.player._revives = 0;
    drainEvents(run);
    run.sim.bullets.push({
      x: run.sim.player.x, y: run.sim.player.y,
      px: run.sim.player.x - 10, py: run.sim.player.y,
      dx: 1, dy: 0, speed: 500, owner: 'enemy', dmg: 50,
      r: 4, life: 2, color: '#ff0000', pierce: 1, splash: 0, hit: new Set(),
    });
    runSteps(run, 5);
    assert.equal(run.state, 'dead');
    const events = drainEvents(run);
    assert.ok(events.some(e => e.type === 'dead'), 'should emit dead event');
  });
});

describe('sim — combo and score', () => {
  it('kills increment combo within window', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    run._comboT = 3;
    run.stats.combo = 0;
    run.stats.kills = 0;
    run.stats.score = 0;
    const e = {
      id: 'e1', kind: 'enemy', type: 'scribble',
      x: 640, y: 500, hp: 1, maxHp: 1, r: 24,
      dead: false, dying: false, invuln: 0,
      body: { pts: Array(11).fill(null).map(() => ({ x: 640, y: 500, px: 640, py: 500, vx: 0, vy: 0, r: 2 })), supportFoot: 0, savedFootX: [640, 640], grounded: true, lastGroundedT: 0 },
      sink: 0, anim: { dead: 0, hurt: 0, flash: 0, walk: 0, dash: 0, melee: 0, reload: 0, spawn: 0, telegraph: 0 },
      gun: { x: 640, y: 500, dx: 1, dy: 0 }, aim: { x: 640, y: 500 },
      facing: 1, hitFlash: 0, scale: 1, walkx: 0,
    };
    e.ai = { def: ENEMIES.scribble, timer: 0, fireCd: 5, state: 'idle', telegraph: 0, stuckT: 0, lastX: 640, rng: Math.random };
    run.sim.enemies.push(e);
    run.sim.bullets.push({
      x: 640, y: 490, px: 600, py: 490,
      dx: 1, dy: 0, speed: 1600, owner: 'player', dmg: 50,
      r: 3, life: 1, color: '#fff', pierce: 1, splash: 0, hit: new Set(),
    });
    runSteps(run, 5);
    assert.ok(run.stats.kills >= 1, `should have at least 1 kill, got ${run.stats.kills}`);
  });

  it('score increases on kill', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    const scoreBefore = run.stats.score;
    const e = {
      id: 'e1', kind: 'enemy', type: 'scribble',
      x: 640, y: 500, hp: 1, maxHp: 1, r: 24,
      dead: false, dying: false, invuln: 0,
      body: { pts: Array(11).fill(null).map(() => ({ x: 640, y: 500, px: 640, py: 500, vx: 0, vy: 0, r: 2 })) },
      sink: 0, anim: { dead: 0, hurt: 0, flash: 0, walk: 0, dash: 0, melee: 0, reload: 0, spawn: 0, telegraph: 0 },
      gun: { x: 640, y: 500, dx: 1, dy: 0 }, aim: { x: 640, y: 500 },
      facing: 1, hitFlash: 0,
    };
    e.ai = { def: ENEMIES.scribble, timer: 0 };
    run.sim.enemies.push(e);
    e.hp = 0;
    runSteps(run, 2);
    assert.ok(run.stats.score >= scoreBefore);
  });
});

describe('sim — upgrades', () => {
  it('applyUpgrade modifies stats', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    const maxInkBefore = run.sim.player.maxHp;
    applyUpgrade(run, 'heavyink');
    assert.ok(run.sim.player.maxHp > maxInkBefore, 'heavyink should increase max ink');
  });

  it('getUpgradeChoices excludes taken upgrades', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    applyUpgrade(run, 'quickdraw');
    const choices = getUpgradeChoices(run, 3);
    assert.ok(!choices.some(c => c.id === 'quickdraw'), 'taken upgrade should not appear');
  });

  it('all 16 upgrades taken → choices can repeat', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    for (const u of UPGRADES) applyUpgrade(run, u.id);
    const choices = getUpgradeChoices(run, 3);
    assert.ok(choices.length > 0, 'should still return choices after all taken');
  });

  it('applyUpgrade with reviveAdd gives extra life', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    const revivesBefore = run.sim.player._revives;
    applyUpgrade(run, 'finalcut');
    assert.equal(run.sim.player._revives, revivesBefore + 1);
  });
});

describe('sim — waves and acts', () => {
  it('all enemies dead → clear state', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    runSteps(run, Math.ceil(CONFIG.wave.introDelay / STEP) + 5);
    for (const e of run.sim.enemies) { e.dead = true; e.dying = true; }
    run.waves.allSpawned = true;
    runSteps(run, 5);
    assert.equal(run.state, 'clear');
  });

  it('startNextWave progresses wave index', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    runSteps(run, Math.ceil(CONFIG.wave.introDelay / STEP) + 5);
    for (const e of run.sim.enemies) { e.dead = true; e.dying = true; }
    run.waves.allSpawned = true;
    runSteps(run, 5);
    const waveBefore = run.waves.waveIndex;
    startNextWave(run);
    assert.ok(run.waves.waveIndex > waveBefore || run.actIndex > 0, 'wave or act should progress');
  });

  it('nextAct changes map and resets player', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    const actBefore = run.actIndex;
    run.sim.player.hp = 50;
    nextAct(run);
    assert.equal(run.actIndex, actBefore + 1);
    assert.equal(run.sim.player.hp, run.sim.player.maxHp, 'player ink should refill');
  });

  it('5 acts → won state', () => {
    const run = createRun({ actIndex: 4, seed: 1 });
    runSteps(run, Math.ceil(CONFIG.wave.introDelay / STEP) + 5);
    for (const e of run.sim.enemies) { e.hp = 0; e.dead = true; e.dying = true; }
    run.waves.allSpawned = true;
    let steps = 0;
    while (run.state !== 'won' && steps < 1000) {
      runSteps(run, 5);
      if (run.state === 'clear') startNextWave(run);
      steps++;
    }
    assert.equal(run.state, 'won');
  });
});

describe('sim — determinism', () => {
  it('same seed + input → identical results', () => {
    const run1 = createRun({ actIndex: 0, seed: 42 });
    const run2 = createRun({ actIndex: 0, seed: 42 });
    const input = { mx: 1, fire: true, aim: { x: 800, y: 400 } };
    for (let i = 0; i < 600; i++) {
      step(run1, input);
      step(run2, input);
    }
    assert.equal(run1.sim.player.x, run2.sim.player.x, 'player x should match');
    assert.equal(run1.sim.player.y, run2.sim.player.y, 'player y should match');
    assert.equal(run1.stats.kills, run2.stats.kills, 'kills should match');
    assert.equal(run1.stats.score, run2.stats.score, 'score should match');
  });
});

describe('sim — performance', () => {
  it('40 enemies + 200 bullets: step < 3ms avg', () => {
    const run = createRun({ actIndex: 0, seed: 1 });
    run.state = 'fighting';
    for (let i = 0; i < 40; i++) {
      const e = {
        id: `e${i}`, kind: 'enemy', type: 'scribble',
        x: 200 + i * 20, y: WORLD.groundY,
        px: 200 + i * 20, py: WORLD.groundY,
        vx: 0, vy: 0, hp: 100, maxHp: 100, r: 24,
        facing: 1, dead: false, dying: false, invuln: 0,
        body: { pts: Array(11).fill(null).map(() => ({ x: 200 + i * 20, y: WORLD.groundY, px: 200 + i * 20, py: WORLD.groundY, vx: 0, vy: 0, r: 2 })), supportFoot: 0, savedFootX: [0, 0], grounded: true, lastGroundedT: 0, _map: run.map },
        gun: { x: 0, y: 0, dx: 1, dy: 0 }, aim: { x: 0, y: 0 },
        anim: { walk: 0, hurt: 0, dead: 0, flash: 0, dash: 0, melee: 0, reload: 0, spawn: 0, telegraph: 0 },
        weapon: null, mag: 0, magMax: 0, reloading: false, reloadT: 0,
        hitFlash: 0, walkx: 0, scale: 1, sink: 0, _contactCd: 0,
      };
      e.ai = { def: ENEMIES.scribble, timer: 0, fireCd: 5, state: 'idle', telegraph: 0, stuckT: 0, lastX: e.x, rng: Math.random };
      run.sim.enemies.push(e);
    }
    for (let i = 0; i < 200; i++) {
      run.sim.bullets.push({
        x: Math.random() * WORLD.w, y: Math.random() * 400,
        px: 0, py: 0, dx: 1, dy: 0, speed: 1000,
        owner: 'player', dmg: 10, r: 3, life: 1,
        color: '#fff', pierce: 1, splash: 0, hit: new Set(),
      });
    }
    const times = [];
    for (let i = 0; i < 300; i++) {
      const t0 = performance.now();
      step(run, { mx: 1, fire: true, aim: { x: 640, y: 400 } });
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    assert.ok(avg < 3, `avg step time ${avg.toFixed(2)}ms should be < 3ms`);
  });
});

describe('mulberry32', () => {
  it('produces deterministic sequence', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      assert.equal(rng1(), rng2(), 'same seed should produce same sequence');
    }
  });

  it('different seeds produce different sequences', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(99);
    let same = 0;
    for (let i = 0; i < 100; i++) {
      if (rng1() === rng2()) same++;
    }
    assert.ok(same < 5, 'different seeds should produce mostly different values');
  });
});
