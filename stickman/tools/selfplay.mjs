#!/usr/bin/env node
// tools/selfplay.mjs — Headless self-play bot. Runs through 5 acts + Boss.
import { createRun, step, drainEvents, startNextWave, nextAct, getHud, getUpgradeChoices, applyUpgrade } from '../src/game/sim.js';
import { CONFIG, WORLD, STEP } from '../config/game.config.js';

const SEED = Number(process.argv.find(a => a.startsWith('--seed='))?.split('=')[1] || '42');
const MAX_STEPS = Number(process.argv.find(a => a.startsWith('--max='))?.split('=')[1] || '72000');
const VERBOSE = process.argv.includes('--verbose');

function botInput(run, rng) {
  const p = run.sim.player;
  if (p.dead) return {};

  const enemies = run.sim.enemies.filter(e => !e.dead);
  const boss = run.sim.boss && !run.sim.boss.dead ? run.sim.boss : null;
  const targets = boss ? [boss, ...enemies] : enemies;

  const input = { mx: 0, fire: false, aim: null, jumpPressed: false, jump: false, dashPressed: false, meleePressed: false };

  const grounded = p.body.grounded;
  const px = p.body.pts[2].x;
  const py = p.body.pts[2].y;

  // Threat assessment - check all bullets, not just nearest
  const incomingBullets = run.sim.bullets.filter(b => b.owner === 'enemy');
  let nearestBullet = null;
  let threateningBullets = [];
  for (const b of incomingBullets) {
    const d = Math.hypot(b.x - px, b.y - py);
    if (d < 150) threateningBullets.push({ bullet: b, dist: d });
    if (!nearestBullet || d < nearestBullet.dist) nearestBullet = { bullet: b, dist: d };
  }

  const isDanger = threateningBullets.length > 0;
  const isCloseDanger = nearestBullet && nearestBullet.dist < 50;

  // Find best target (prioritize by threat level and distance)
  let target = null;
  if (targets.length > 0) {
    const scored = targets.map(e => {
      const d = Math.hypot(e.x - px, e.y - py);
      let priority = 1000 - d;
      // High priority threats
      if (e.type === 'compass') priority += 300;
      if (e.type === 'eraser') priority += 250;
      if (e.type === 'smudge') priority += 150;
      if (e.type === 'blank') priority += 600;
      // Close enemies are more dangerous
      if (d < 200) priority += 100;
      return { enemy: e, dist: d, priority };
    });
    scored.sort((a, b) => b.priority - a.priority);
    target = scored[0].enemy;
  }

  // Boss-specific tactics
  let bossAimSet = false;
  if (boss) {
    const bossDist = Math.hypot(boss.x - px, (boss.y || boss.body.pts[2].y) - py);
    const bossHpPct = boss.hp / boss.maxHp;
    const playerHpPct = p.hp / p.maxHp;

    // Boss fight: keep far distance, dodge very aggressively
    if (bossDist < 300) {
      // Too close - back away quickly
      input.mx = boss.x > px ? -1 : 1;
      // Jump to dodge ground attacks
      if (grounded && rng() < 0.6) {
        input.jumpPressed = true;
        input.jump = true;
      }
    } else if (bossDist > 550) {
      // Too far - approach cautiously
      input.mx = boss.x > px ? 1 : -1;
    } else {
      // Ideal range - strafe and dodge
      const strafePhase = Math.sin(run.sim.t * 3 + px * 0.005);
      input.mx = strafePhase > 0 ? 1 : strafePhase < 0 ? -1 : 0;
    }

    // Jump to dodge boss attacks - very aggressive
    const jumpChance = playerHpPct > 0.5 ? 0.45 : 0.7;
    if (grounded && isDanger && rng() < jumpChance) {
      input.jumpPressed = true;
      input.jump = true;
    }

    // Dash to dodge boss charge or ground wipe - use defensively
    const dashHpThreshold = playerHpPct > 0.6 ? 10 : 25;
    if (isCloseDanger && run._dashCharges > 0 && run._dashT <= 0 && p.hp > CONFIG.player.dashCost + dashHpThreshold) {
      input.dashPressed = true;
      // Dash perpendicular to boss or away
      const toBossX = boss.x - px;
      const perpDir = toBossX > 0 ? -1 : 1;
      input.mx = perpDir;
    }

    // Fire at boss when in range, prioritize survival
    if (bossDist < 650 && !isCloseDanger) {
      const tx = boss.x;
      const ty = boss.body ? boss.body.pts[0].y : (boss.y - 50);
      const tVx = boss.body ? boss.body.pts[2].vx : 0;
      const tVy = boss.body ? boss.body.pts[2].vy : 0;
      const dist = Math.hypot(tx - px, ty - py);
      const bulletSpeed = CONFIG.player.walkSpeed * 4;
      const travelTime = dist / bulletSpeed;
      const leadX = tx + tVx * travelTime;
      const leadY = ty + tVy * travelTime;
      input.aim = { x: leadX, y: leadY };
      input.fire = true;
      target = boss;
      bossAimSet = true;
    }
  }

  // Movement: dodge + approach (skip if boss logic handled it)
  if (!boss) {
    if (isCloseDanger && run._dashCharges > 0 && run._dashT <= 0 && p.hp > CONFIG.player.dashCost + 20) {
      // Emergency dash - dodge perpendicular to bullet velocity
      input.dashPressed = true;
      const bullet = nearestBullet.bullet;
      const bvx = bullet.vx || 0;
      const bvy = bullet.vy || 0;
      // Perpendicular direction
      const perpX = -bvy;
      const dodgeDir = perpX > 0 ? 1 : perpX < 0 ? -1 : (rng() > 0.5 ? 1 : -1);
      input.mx = dodgeDir;
    } else if (target) {
      const dx = target.x - px;
      const dy = (target.y || target.body.pts[2].y) - py;
      const dist = Math.hypot(dx, dy);
      const idealRange = p.weapon === 'brush' ? 120 : p.weapon === 'nib' ? 300 : 220;

      // Approach or retreat
      if (dist > idealRange + 80) input.mx = dx > 0 ? 1 : -1;
      else if (dist < idealRange - 100) input.mx = dx > 0 ? -1 : 1;
      else {
        // Strafe with bullet dodging
        const strafePhase = Math.sin(run.sim.t * 3 + px * 0.01);
        let strafeDir = strafePhase > 0.3 ? 1 : strafePhase < -0.3 ? -1 : 0;

        // Dodge incoming bullets while strafing
        if (isDanger && nearestBullet && nearestBullet.dist < 100) {
          const bullet = nearestBullet.bullet;
          const bulletDir = Math.sign(bullet.vx || 0);
          if (bulletDir !== 0 && bulletDir === strafeDir) {
            strafeDir = -strafeDir;
          }
        }
        input.mx = strafeDir;
      }

      // Jump to dodge bullets when in danger
      if (grounded && isDanger && nearestBullet && nearestBullet.dist < 80 && rng() < 0.2) {
        input.jumpPressed = true;
        input.jump = true;
      }
      // Jump to reach elevated targets
      if (grounded && target.y < py - 100 && dist < 300 && rng() < 0.08) {
        input.jumpPressed = true;
        input.jump = true;
      }
    } else {
      // No target - move toward center
      input.mx = px < 640 ? 1 : -1;
    }
  }

  // Aiming: lead the target (skip if boss aiming already set)
  if (target && !bossAimSet) {
    const tx = target.x;
    const ty = target.body ? target.body.pts[0].y : (target.y - 30);
    const tVx = target.body ? target.body.pts[2].vx : 0;
    const tVy = target.body ? target.body.pts[2].vy : 0;
    const dist = Math.hypot(tx - px, ty - py);
    const bulletSpeed = CONFIG.player.walkSpeed * 4;
    const travelTime = dist / bulletSpeed;
    const leadX = tx + tVx * travelTime;
    const leadY = ty + tVy * travelTime;
    // Minimal randomness for more consistent aiming
    const aimNoise = (rng() - 0.5) * 8;
    input.aim = { x: leadX + aimNoise, y: leadY + aimNoise * 0.5 };
    input.fire = true;
  }

  // Melee when very close
  if (target) {
    const dist = Math.hypot(target.x - px, (target.y || 400) - py);
    if (dist < 70 && run._meleeCd <= 0) {
      input.meleePressed = true;
    }
  }

  // Reload when safe
  if (p.mag <= 2 && !isDanger && !p.reloading) {
    input.reloadPressed = true;
  }

  return input;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}

async function main() {
  console.log(`=== LAST LINE Self-Play === seed=${SEED} maxSteps=${MAX_STEPS}`);
  const run = createRun({ actIndex: 0, seed: SEED });
  const actLog = [];
  let currentAct = 0;
  let actStartT = 0;
  let stepCount = 0;
  let maxCombo = 0;

  actLog.push({ act: 0, id: run.actId, startT: 0 });

  while (stepCount < MAX_STEPS && run.state !== 'won' && run.state !== 'dead') {
    const input = botInput(run, run.rng);
    step(run, input);
    const events = drainEvents(run);

    for (const ev of events) {
      if (ev.type === 'actStart' && ev.act !== currentAct) {
        const prev = actLog.find(a => a.act === currentAct);
        if (prev) prev.endT = run.sim.t;
        currentAct = ev.act;
        actLog.push({ act: ev.act, id: ev.id, startT: run.sim.t });
        if (VERBOSE) console.log(`  [t=${formatTime(run.sim.t)}] ACT ${ev.act} ${ev.id}`);
      }
      if (ev.type === 'kill') {
        if (run.stats.combo > maxCombo) maxCombo = run.stats.combo;
        if (VERBOSE) console.log(`  [t=${formatTime(run.sim.t)}] kill ${ev.enemyType} combo=${run.stats.combo}`);
      }
      if (ev.type === 'bossPhase' && VERBOSE) console.log(`  [t=${formatTime(run.sim.t)}] BOSS PHASE ${ev.phase}`);
      if (ev.type === 'bossDown' && VERBOSE) console.log(`  [t=${formatTime(run.sim.t)}] BOSS DOWN!`);
    }

    // Debug boss HP during boss fight
    if (run.sim.boss && !run.sim.boss.dead && stepCount % 60 === 0 && VERBOSE) {
      const boss = run.sim.boss;
      const p = run.sim.player;
      const px = p.body.pts[2].x;
      const py = p.body.pts[2].y;
      const bossDist = Math.hypot(boss.x - px, (boss.y || boss.body.pts[2].y) - py);
      console.log(`  [t=${formatTime(run.sim.t)}] Boss HP: ${boss.hp.toFixed(0)}/${boss.maxHp} | Invuln: ${boss.invuln.toFixed(2)} | Dist: ${bossDist.toFixed(0)} | Player HP: ${p.hp.toFixed(1)}/${p.maxHp}`);
    }

    if (run.state === 'clear' && run._clearT <= 0) {
      // 和玩家一样：每笔结束补一笔（随机选，模拟普通玩家）
      const choices = getUpgradeChoices(run, 3);
      if (choices.length) {
        const pick = choices[Math.floor(run.rng() * choices.length)];
        applyUpgrade(run, pick.id);
        if (VERBOSE) console.log(`  [t=${formatTime(run.sim.t)}] upgrade ${pick.id}`);
      }
      startNextWave(run);
    }

    stepCount++;
    if (stepCount % 3600 === 0 && VERBOSE) {
      const hud = getHud(run);
      console.log(`  [step ${stepCount}] t=${formatTime(run.sim.t)} act=${run.actIndex} ink=${hud.ink}/${hud.inkMax} kills=${run.stats.kills} score=${hud.score} combo=${run.stats.combo}`);
    }
  }

  const lastAct = actLog[actLog.length - 1];
  if (lastAct && !lastAct.endT) lastAct.endT = run.sim.t;

  console.log('\n=== REPORT ===');
  console.log(`State: ${run.state}`);
  console.log(`Steps: ${stepCount} (${formatTime(run.sim.t)})`);
  console.log(`Final Act: ${run.actIndex} (${run.actId})`);
  console.log(`Kills: ${run.stats.kills}`);
  console.log(`Shots: ${run.stats.shots}`);
  console.log(`Hits: ${run.stats.hits}`);
  console.log(`Accuracy: ${run.stats.shots > 0 ? (run.stats.hits / run.stats.shots * 100).toFixed(1) : 0}%`);
  console.log(`Score: ${run.stats.score}`);
  console.log(`Max Combo: ${maxCombo}`);
  console.log(`Ink Gained: ${run.stats.inkGained.toFixed(0)}`);
  console.log(`Lore Found: ${run.stats.lore.length}/8`);

  console.log('\n--- Per-Act Breakdown ---');
  for (const a of actLog) {
    const dur = (a.endT || run.sim.t) - a.startT;
    console.log(`  Act ${a.act} (${a.id}): ${formatTime(dur)} (${dur.toFixed(1)}s)`);
  }

  if (run.state === 'dead') {
    console.log(`\nDeath at t=${formatTime(run.sim.t)} in act ${run.actIndex} (${run.actId})`);
  }
  if (run.state === 'won') {
    console.log(`\nVICTORY! Completed in ${formatTime(run.sim.t)}`);
  }

  const report = {
    seed: SEED, state: run.state, steps: stepCount, time: run.sim.t,
    actIndex: run.actIndex, actId: run.actId,
    kills: run.stats.kills, shots: run.stats.shots, hits: run.stats.hits,
    accuracy: run.stats.shots > 0 ? (run.stats.hits / run.stats.shots * 100).toFixed(1) + '%' : 'N/A',
    score: run.stats.score, maxCombo, inkGained: Math.round(run.stats.inkGained),
    loreFound: run.stats.lore.length,
    acts: actLog.map(a => ({ act: a.act, id: a.id, duration: ((a.endT || run.sim.t) - a.startT).toFixed(1) })),
  };

  const fs = await import('node:fs');
  const outPath = new URL('./selfplay-report.json', import.meta.url);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to ${outPath.pathname}`);

  if (run.state !== 'won') {
    console.log('\n⚠ Did not complete all 5 acts + Boss.');
    process.exit(1);
  }
}

main().catch(e => { console.error(e.stack); process.exit(2); });
