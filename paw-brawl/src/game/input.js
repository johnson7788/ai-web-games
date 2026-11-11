import { CONFIG } from '../../config/game.config.js';

const KEY_ACTIONS = new Map([
  ['Space', 'jump'], ['ShiftLeft', 'dash'], ['ShiftRight', 'dash'],
  ['KeyJ', 'punch'], ['KeyK', 'grab'],
]);

const clampMagnitude = (x, z) => {
  const length = Math.hypot(x, z);
  return length > 1 ? { x: x / length, z: z / length } : { x, z };
};

const applyDeadzone = (value, deadzone) => {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  return Math.sign(value) * (magnitude - deadzone) / (1 - deadzone);
};

export function createInput() {
  const keys = new Set();
  const touches = new Map();
  const touchActions = new Set();
  const previousActions = { jump: false, dash: false, punch: false, grab: false };
  let joystick = null;
  let queuedDash = false;
  let lastTap = { time: -Infinity, x: 0, z: 0 };

  function setKey(code, down) {
    if (down) keys.add(code);
    else keys.delete(code);
  }

  function setAction(action, down = true) {
    if (down) touchActions.add(action);
    else touchActions.delete(action);
  }

  function beginJoystick(id, x, y, time = 0) {
    if (time - lastTap.time <= CONFIG.input.doubleTapWindow && Math.hypot(x - lastTap.x, y - lastTap.z) <= CONFIG.input.doubleTapDistance) {
      queuedDash = true;
      lastTap.time = -Infinity;
    } else {
      lastTap = { time, x, z: y };
    }
    joystick = { id, originX: x, originY: y, x, y };
    touches.set(id, joystick);
    return joystick;
  }

  function moveJoystick(id, x, y) {
    const stick = touches.get(id);
    if (!stick) return null;
    stick.x = x;
    stick.y = y;
    return stick;
  }

  function endJoystick(id) {
    const stick = touches.get(id);
    touches.delete(id);
    if (joystick?.id === id) joystick = null;
    return stick;
  }

  function poll({ azimuth = 0, gamepads = [] } = {}) {
    let x = 0;
    let z = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;

    if (joystick) {
      const radius = CONFIG.input.joystickRadius;
      x += applyDeadzone((joystick.x - joystick.originX) / radius, CONFIG.input.joystickDeadzone);
      z += applyDeadzone((joystick.originY - joystick.y) / radius, CONFIG.input.joystickDeadzone);
    }

    const pad = Array.from(gamepads).find(Boolean);
    if (pad) {
      x += applyDeadzone(pad.axes[0] ?? 0, CONFIG.input.gamepadDeadzone);
      z += applyDeadzone(-(pad.axes[1] ?? 0), CONFIG.input.gamepadDeadzone);
    }

    const local = clampMagnitude(x, z);
    const sin = Math.sin(azimuth);
    const cos = Math.cos(azimuth);
    const held = {
      jump: keys.has('Space') || touchActions.has('jump') || Boolean(pad?.buttons[0]?.pressed),
      dash: keys.has('ShiftLeft') || keys.has('ShiftRight') || queuedDash || Boolean(pad?.buttons[5]?.pressed),
      punch: keys.has('KeyJ') || touchActions.has('punch') || Boolean(pad?.buttons[2]?.pressed),
      grab: keys.has('KeyK') || touchActions.has('grab') || Boolean(pad?.buttons[3]?.pressed),
    };
    const intent = {
      mx: local.x * cos - local.z * sin,
      mz: -local.x * sin - local.z * cos,
      jump: held.jump && !previousActions.jump,
      dash: (held.dash && !previousActions.dash) || queuedDash,
      punch: held.punch && !previousActions.punch,
      punchHeld: held.punch,
      punchRelease: !held.punch && previousActions.punch,
      grab: held.grab && !previousActions.grab,
      charge: false,
    };
    Object.assign(previousActions, held);
    queuedDash = false;
    return intent;
  }

  function clear() {
    keys.clear();
    touches.clear();
    touchActions.clear();
    joystick = null;
    queuedDash = false;
    for (const action of Object.keys(previousActions)) previousActions[action] = false;
  }

  return { setKey, setAction, beginJoystick, moveJoystick, endJoystick, poll, clear, get joystick() { return joystick; } };
}

export { KEY_ACTIONS };
