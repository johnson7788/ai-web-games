#!/usr/bin/env node
// Debug: check if corridor is clear at top of stage 1
import { generateMap } from '../src/game/level.js';
import { STAGES } from '../config/levels.js';
import { WORLD } from '../config/game.config.js';

const stage = STAGES[0];
const map = generateMap(stage);

console.log(`Stage: ${stage.id}`);
console.log(`Map: ${map.cols}x${map.rows}, tile=${map.tile}, levelH=${map.levelH}`);
console.log(`Top area (y=0-5):`);

const TILE = map.tile;
for (let y = 0; y < 5; y++) {
  let row = '';
  for (let x = 0; x < map.cols; x++) {
    const v = map.solid[y * map.cols + x];
    row += v === 0 ? '·' : v === 1 ? '█' : v === 2 ? '~' : '▓';
  }
  console.log(`  y=${y}: ${row}`);
}

console.log(`\nCorridor at y=2 (should be clear):`);
for (let x = 0; x < map.cols; x++) {
  const v = map.solid[2 * map.cols + x];
  if (v === 0) console.log(`  x=${x}: WALKABLE`);
}

console.log(`\nPlayer needs to reach y<140 (tile y<${Math.floor(140/TILE)})`);
console.log(`Camera needs cameraY<=0 (top of map)`);
