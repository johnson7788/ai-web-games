import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, currentNode, choose, retry, getHud, serializeEndings, ENDING_COUNT } from '../src/game/sim.js';
import { STORY, START_NODE, WIN_NODES, FAIL_NODES } from '../config/story.js';
import { CONFIG } from '../config/game.config.js';

test('初始化：起点、playing、0 失败', () => {
  const run = createRun();
  assert.equal(run.nodeId, START_NODE);
  assert.equal(run.phase, 'playing');
  assert.equal(run.fails, 0);
});

test('选择推进到下一节点', () => {
  const run = createRun();
  const r = choose(run, 0); // start → lock
  assert.equal(r.ok, true);
  assert.equal(run.nodeId, 'lock');
  assert.equal(run.phase, 'playing');
});

test('选到失败节点：phase=fail、失败+1', () => {
  const run = createRun();
  choose(run, 2); // start → yell
  const r = choose(run, 1); // yell → attack_fail
  assert.equal(r.ending, 'fail');
  assert.equal(run.phase, 'fail');
  assert.equal(run.fails, 1);
});

test('选到胜利节点：phase=win、记录结局', () => {
  const run = createRun();
  choose(run, 0); // lock
  choose(run, 1); // roof
  const r = choose(run, 0); // win_zip
  assert.equal(r.ending, 'win');
  assert.equal(run.phase, 'win');
  assert.equal(run.endingsFound.size, 1);
  assert.ok(run.endingsFound.has('win_zip'));
});

test('失败后重试回到起点', () => {
  const run = createRun();
  choose(run, 2);
  choose(run, 1); // fail
  retry(run);
  assert.equal(run.nodeId, START_NODE);
  assert.equal(run.phase, 'playing');
  assert.equal(run.fails, 1, '失败计数保留');
});

test('多结局累计', () => {
  const run = createRun();
  choose(run, 0); choose(run, 1); choose(run, 0); // win_zip
  retry(run);
  choose(run, 1); choose(run, 0); choose(run, 0); // dig→tunnel→win_tunnel
  assert.equal(run.endingsFound.size, 2);
  assert.equal(serializeEndings(run).length, 2);
});

test('非法选择索引返回 ok:false', () => {
  const run = createRun();
  assert.equal(choose(run, 99).ok, false);
  assert.equal(run.nodeId, START_NODE);
});

test('剧情图完整性：引用有效、全可达、结局无选项', () => {
  for (const [id, node] of Object.entries(STORY)) {
    if (node.choices) {
      for (const c of node.choices) assert.ok(STORY[c.next], `${id} 的选项指向有效节点 ${c.next}`);
    }
    if (node.ending) assert.ok(!node.choices, `结局节点 ${id} 不应有选项`);
  }
  // BFS 可达性
  const seen = new Set([START_NODE]);
  const queue = [START_NODE];
  while (queue.length) {
    const n = STORY[queue.shift()];
    for (const c of n.choices || []) {
      if (!seen.has(c.next)) { seen.add(c.next); queue.push(c.next); }
    }
  }
  assert.equal(seen.size, Object.keys(STORY).length, '所有节点从起点可达');
});

test('配置默认值：4 结局 / en+zh', () => {
  assert.equal(ENDING_COUNT, 4);
  assert.equal(WIN_NODES.length, 4);
  assert.ok(FAIL_NODES.length >= 6);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun()).totalEndings, 4);
});