/**
 * 战斗 cut-in 的动画状态机：Idle → Windup → Attack → Recover。
 * 只负责「时间 → 状态 / 事件」，渲染和游戏逻辑通过事件订阅，避免帧率影响判定。
 */
export const COMBAT_STATES = ["idle", "windup", "attack", "recover"];

export const TIMELINES = {
  normal: {
    duration: 1500,
    states: [
      { at: 0.00, state: "idle" },
      { at: 0.10, state: "windup" },
      { at: 0.34, state: "attack" },
      { at: 0.64, state: "recover" },
    ],
    events: [
      { at: 0.38, type: "fire" },
      { at: 0.56, type: "impact" },
    ],
  },
  quick: {
    duration: 460,
    states: [
      { at: 0.00, state: "idle" },
      { at: 0.06, state: "windup" },
      { at: 0.28, state: "attack" },
      { at: 0.64, state: "recover" },
    ],
    events: [
      { at: 0.32, type: "fire" },
      { at: 0.50, type: "impact" },
    ],
  },
  fast: {
    duration: 800,
    states: [
      { at: 0.00, state: "idle" },
      { at: 0.08, state: "windup" },
      { at: 0.32, state: "attack" },
      { at: 0.64, state: "recover" },
    ],
    events: [
      { at: 0.36, type: "fire" },
      { at: 0.56, type: "impact" },
    ],
  },
};

export class CombatStateMachine {
  constructor({ fast = false, timeline = null } = {}) {
    this.timeline = timeline || (fast ? TIMELINES.fast : TIMELINES.normal);
    this.state = "idle";
    this.stateIndex = 0;
    this.eventIndex = 0;
    this.fired = false;
    this.impacted = false;
  }

  reset() {
    this.state = "idle"; this.stateIndex = 0; this.eventIndex = 0;
    this.fired = false; this.impacted = false;
  }

  /** 传入 0..1 的归一化时间，返回本帧新产生的状态/事件。 */
  update(t) {
    const out = [];
    const tt = Math.max(0, Math.min(1, t));
    const states = this.timeline.states;
    while (this.stateIndex + 1 < states.length && tt >= states[this.stateIndex + 1].at) {
      this.stateIndex += 1;
      this.state = states[this.stateIndex].state;
      out.push({ type: "state", state: this.state });
    }
    const events = this.timeline.events;
    while (this.eventIndex < events.length && tt >= events[this.eventIndex].at) {
      const e = events[this.eventIndex++];
      if (e.type === "fire") this.fired = true;
      if (e.type === "impact") this.impacted = true;
      out.push({ type: e.type });
    }
    return out;
  }
}
