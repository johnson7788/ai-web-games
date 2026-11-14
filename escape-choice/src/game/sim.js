// 纯逻辑：分支剧情图遍历 + 失败/结局统计。
// 不碰 DOM / window / localStorage / Date.now。
import { STORY, START_NODE, WIN_NODES } from '../../config/story.js';

export function createRun({ endingsFound = [] } = {}) {
  return {
    nodeId: START_NODE,
    fails: 0,
    steps: 0,
    endingsFound: new Set(endingsFound),
    phase: 'playing', // playing | fail | win
    events: [],
  };
}

export function currentNode(run) {
  return STORY[run.nodeId];
}

export function choose(run, choiceIndex) {
  if (run.phase !== 'playing') return { ok: false };
  const node = STORY[run.nodeId];
  if (!node.choices || !node.choices[choiceIndex]) return { ok: false };
  const choice = node.choices[choiceIndex];
  const from = run.nodeId;
  run.nodeId = choice.next;
  run.steps += 1;
  const next = STORY[choice.next];
  run.events.push({ type: 'choice', from, to: choice.next });
  let ending = null;
  if (next.ending === 'fail') {
    run.phase = 'fail';
    run.fails += 1;
    ending = 'fail';
    run.events.push({ type: 'fail', node: choice.next });
  } else if (next.ending === 'win') {
    run.phase = 'win';
    run.endingsFound.add(choice.next);
    ending = 'win';
    run.events.push({ type: 'win', node: choice.next, total: run.endingsFound.size });
  }
  return { ok: true, node: next, ending };
}

export function retry(run) {
  run.nodeId = START_NODE;
  run.phase = 'playing';
}

export function getHud(run) {
  return {
    nodeId: run.nodeId,
    fails: run.fails,
    steps: run.steps,
    endings: run.endingsFound.size,
    totalEndings: WIN_NODES.length,
    phase: run.phase,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export function serializeEndings(run) {
  return [...run.endingsFound];
}

export const ENDING_COUNT = WIN_NODES.length;