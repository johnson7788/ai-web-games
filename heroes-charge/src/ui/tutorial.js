// src/ui/tutorial.js — 首次进入交互引导（可跳过/可重看/可自动推进）
// 约定：根节点 [data-tutorial]；跳过 [data-tutorial-skip]；步进 [data-tutorial-next]。
export function createTutorial({ overlay, card, titleEl, textEl, nextBtn, skipBtn, t, save }) {
  const STEPS = ['tut.1', 'tut.2', 'tut.3', 'tut.4'];
  const DONE_KEY = 'tutorialDone';

  let step = 0;
  let active = false;
  let startX = 0;
  let onDoneCb = null;

  function done() {
    if (!active) return false;
    active = false;
    overlay.classList.add('hidden');
    save.save(DONE_KEY, true);
    if (onDoneCb) onDoneCb();
    return true;
  }

  function render() {
    titleEl.textContent = t('tut.title');
    textEl.textContent = t(STEPS[step]);
    nextBtn.textContent = step >= STEPS.length - 1 ? t('btn.got') : t('btn.got');
    card.dataset.step = String(step + 1);
  }

  function show() {
    step = 0;
    active = true;
    startX = 0;
    overlay.classList.remove('hidden');
    render();
  }

  function skip() {
    if (active) done();
  }

  function next() {
    if (!active) return;
    if (step >= STEPS.length - 1) {
      done();
      return;
    }
    step += 1;
    render();
  }

  function onGameEvent(ev) {
    if (!active) return;
    if (ev.type === 'attack' && step === 1) next();
    else if (ev.type === 'dash' && step === 2) next();
    else if (ev.type === 'enemyDown' && step === 3) next();
  }

  function tick(run) {
    if (!active || !run) return;
    if (step === 0) {
      if (startX === 0) startX = run.player.x;
      else if (Math.abs(run.player.x - startX) >= 60) next();
    }
  }

  return {
    get active() { return active; },
    get step() { return step; },
    get steps() { return STEPS; },
    get current() { return STEPS[step]; },
    show,
    skip,
    hide: skip,
    onGameEvent,
    tick,
    onDone(fn) { onDoneCb = fn; },
    isDone: () => !!save.load(DONE_KEY, false),
  };
}
