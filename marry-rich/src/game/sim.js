// src/game/sim.js — MARRY RICH · 剧情模拟核心（纯逻辑，零依赖，无 DOM/无 i18n）。
// 契约：createRun({seed}) → run；run.step(input) 推进一帧（input = { choice?, advance? }）；
//       run.getHud() / run.drainEvents() / run.currentNode()。
// 阶段：choice（抉择）→ result（结果卡）→ 下一章 choice … 直到 ending。
// 事件表（供渲染/音频/遥测消费）：nodeEnter / timerStart / timerTick / typeTick /
//   choiceMade / success / attrChange / scaleTilt / resultShown / ending。
import {
  STEP, ATTRS, FLAGS, TIMED, REVEAL, CHAPTER_COUNT, clamp, clampAttrs,
} from '../../config/gameplay.js';
import { getNode } from '../../config/story.js';
import { resolveEnding } from '../../config/endings.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const run = {
    seed: seed >>> 0,
    phase: 'playing',   // 'playing' | 'ended'
    stage: 'choice',    // 'choice' | 'result' | 'ending'
    nodeId: null,
    chapter: 0,
    arc: null,
    ending: null,
    attrs: { ...ATTRS.START },
    flags: { ...FLAGS.START },
    time: 0,
    timer: null,
    curChoice: null,
    history: [],
    events: [],
    _successEmitted: false,
    _revealUntil: 0,
    _lastTimerInt: null,
  };

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.currentNode = () => currentNode(run);

  enterNode(run, getNode('n1'));
  return run;
}

// 兼容旧骨架调用（新代码走 createRun）
export function createSim() {
  return createRun({ seed: 0 });
}

function currentNode(run) {
  return run.nodeId ? getNode(run.nodeId) : null;
}

// ---------- 每 tick ----------
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  run.time += STEP;

  // 打字机 reveal：reveal 期间每帧都发 typeTick（可感知反馈，保证遥测事件密度、无空转）
  if (run.time < run._revealUntil && (run.stage === 'choice' || run.stage === 'result')) {
    emit(run, 'typeTick', { stage: run.stage, chapter: run.chapter });
  }

  if (run.stage === 'choice') {
    const node = currentNode(run);
    if (!node) return;

    // 限时抉择倒计时
    if (node.timed && run.timer != null) {
      run.timer -= STEP;
      const cur = Math.ceil(run.timer);
      if (cur !== run._lastTimerInt) {
        run._lastTimerInt = cur;
        emit(run, 'timerTick', { chapter: run.chapter, remaining: Math.max(0, run.timer) });
      }
      if (run.timer <= 0) {
        applyChoice(run, Number.isInteger(node.default) ? node.default : 0, true);
        return;
      }
    }

    const idx = input.choice;
    if (Number.isInteger(idx) && idx >= 0 && idx < node.choices.length) {
      applyChoice(run, idx, false);
    }
  } else if (run.stage === 'result') {
    if (input.advance) goNext(run);
  }
  // stage === 'ending'：无动作，等 main 展示结局
}

// ---------- 抉择应用 ----------
function applyChoice(run, index, timedOut) {
  const node = currentNode(run);
  if (!node) return;
  const choice = node.choices[index];
  if (!choice) return;

  for (const k of ATTRS.KEYS) run.attrs[k] += choice.effects?.[k] ?? 0;
  for (const k of FLAGS.KEYS) run.flags[k] += choice.flags?.[k] ?? 0;
  clampAttrs(run.attrs);
  clampFlags(run.flags);

  if (choice.arc) run.arc = choice.arc;
  run.curChoice = index;
  run.history.push({ nodeId: node.id, choiceIndex: index, timedOut: !!timedOut });

  emit(run, 'choiceMade', { chapter: node.chapter, choiceIndex: index, timedOut: !!timedOut });
  if (!run._successEmitted) {
    run._successEmitted = true;
    emit(run, 'success', { chapter: node.chapter });
  }
  emit(run, 'attrChange', { abi: run.attrs.abi, net: run.attrs.net, sav: run.attrs.sav });
  if (node.timed) emit(run, 'scaleTilt', { lean: leanOf(choice), chapter: node.chapter });

  run.stage = 'result';
  run.timer = null;
  run._lastTimerInt = null;
  run._revealUntil = run.time + REVEAL.RESULT_SEC;
  emit(run, 'resultShown', { chapter: node.chapter, choiceIndex: index });
}

// ---------- 前进到下一章或结局 ----------
function goNext(run) {
  const node = currentNode(run);
  if (!node) return;
  const choice = node.choices[run.curChoice];
  if (!choice) return;
  emit(run, 'advance', { chapter: node.chapter });

  if (choice.next === 'ending') {
    run.ending = resolveEnding({ ...run.attrs, ...run.flags, arc: run.arc });
    run.stage = 'ending';
    run.phase = 'ended';
    emit(run, 'ending', { endingId: run.ending.id, arc: run.arc });
    return;
  }

  const nextNode = getNode(choice.next);
  if (!nextNode) return; // 死链防御（story.test 会兜底校验无死链）
  enterNode(run, nextNode);
}

// ---------- 进入章节 ----------
function enterNode(run, node) {
  run.nodeId = node.id;
  run.chapter = node.chapter;
  run.stage = 'choice';
  run.curChoice = null;
  run.timer = node.timed ? (node.timeLimitSec ?? TIMED.DEFAULT_SEC) : null;
  run._lastTimerInt = run.timer != null ? Math.ceil(run.timer) : null;
  run._revealUntil = run.time + REVEAL.CHOICE_SEC;
  emit(run, 'nodeEnter', { chapter: node.chapter, scene: node.scene, nodeId: node.id, timed: !!node.timed });
  if (node.timed) emit(run, 'timerStart', { chapter: node.chapter, timeLimitSec: run.timer });
}

// ---------- 小工具 ----------
function leanOf(choice) {
  const e = choice.effects || {};
  const ambition = (e.abi ?? 0) + (e.net ?? 0) - (e.sav ?? 0);
  return ambition > 0 ? 1 : ambition < 0 ? -1 : 0;
}

function clampFlags(flags) {
  for (const k of FLAGS.KEYS) flags[k] = clamp(flags[k], -3, 9);
  return flags;
}

function getHud(run) {
  const node = currentNode(run);
  return {
    phase: run.phase,
    stage: run.stage,
    chapter: run.chapter,
    totalChapters: CHAPTER_COUNT,
    nodeId: run.nodeId,
    scene: node?.scene ?? 'town',
    timed: !!node?.timed,
    timer: run.timer,
    timeLimitSec: node?.timeLimitSec ?? null,
    attrs: { ...run.attrs },
    flags: { ...run.flags },
    arc: run.arc,
    endingId: run.ending?.id ?? null,
    curChoice: run.curChoice,
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
