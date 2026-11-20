// Keyboard + touch input. All state changes go through real DOM events so the
// game has a single input path (also used by the smoke-test autopilot).
const down = new Set();
const listeners = [];

const MAP = {
  KeyW: 'gas', ArrowUp: 'gas',
  KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'boost', ShiftRight: 'boost',
};

export const input = {
  gas: false, brake: false, left: false, right: false, boost: false,
  steer: 0, throttle: 0,
};

function refresh() {
  input.gas = down.has('gas');
  input.brake = down.has('brake');
  input.left = down.has('left');
  input.right = down.has('right');
  input.boost = down.has('boost');
  input.steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  input.throttle = (input.gas ? 1 : 0) - (input.brake ? 1 : 0);
}

// dispatch a real key event (used by touch buttons and the test autopilot)
export function press(action, isDown) {
  const code = { gas: 'KeyW', brake: 'KeyS', left: 'KeyA', right: 'KeyD', boost: 'ShiftLeft' }[action];
  if (!code) return;
  window.dispatchEvent(new KeyboardEvent(isDown ? 'keydown' : 'keyup', { code, bubbles: true }));
}

export function onKey(fn) { listeners.push(fn); }

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) { if (MAP[e.code]) e.preventDefault(); return; }
    const a = MAP[e.code];
    if (a) { down.add(a); refresh(); e.preventDefault(); }
    for (const fn of listeners) fn(e);
  });
  window.addEventListener('keyup', (e) => {
    const a = MAP[e.code];
    if (a) { down.delete(a); refresh(); e.preventDefault(); }
  });
  window.addEventListener('blur', () => { down.clear(); refresh(); });

  // touch
  const coarse = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (coarse) document.body.classList.add('touch');
  const bind = (id, action) => {
    const el = document.getElementById(id);
    if (!el) return;
    const on = (e) => { e.preventDefault(); el.classList.add('on'); press(action, true); };
    const off = (e) => { e.preventDefault(); el.classList.remove('on'); press(action, false); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  };
  bind('tLeft', 'left'); bind('tRight', 'right');
  bind('tGas', 'gas'); bind('tBrake', 'brake'); bind('tBoost', 'boost');
}

export function clearInput() { down.clear(); refresh(); }