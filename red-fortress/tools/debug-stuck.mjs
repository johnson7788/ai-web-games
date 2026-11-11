#!/usr/bin/env node
// Debug: check map at y=1500 (where AI gets stuck)
import { generateMap } from '../src/game/level.js';
import { STAGES } from '../config/levels.js';

const stage = STAGES[0];
const map = generateMap(stage);
const TILE = map.tile;

console.log(`Stage: ${stage.id}`);
console.log(`Checking area around y=1500 (tile y=${Math.floor(1500/TILE)})`);

// Check rows around y=1500
const centerTileY = Math.floor(1500 / TILE);
for (let dy = -3; dy <= 3; dy++) {
  const y = centerTileY + dy;
  if (y < 0 || y >= map.rows) continue;
  
  let row = `y=${y} (${y*TILE}px): `;
  for (let x = 0; x < map.cols; x++) {
    const v = map.solid[y * map.cols + x];
    row += v === 0 ? '·' : v === 1 ? '█' : v === 2 ? '~' : '▓';
  }
  console.log(row);
}

console.log('\nLegend: · = walkable, █ = rock, ~ = water, ▓ = sandbag');
console.log(`\nCorridor should be clear in the middle columns.`);
