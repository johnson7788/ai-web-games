import { CONFIG } from '../../config/game.config.js';
import { createInput } from '../game/input.js';

const EDGE_ACTIONS = ['jump', 'dash', 'punch', 'punchRelease', 'grab'];
const blank = () => ({ mx: 0, mz: 0, jump: false, dash: false, punch: false, punchHeld: false, punchRelease: false, grab: false, charge: false });

export function createOnlineInput() {
  const core = createInput();
  const pending = Object.fromEntries(EDGE_ACTIONS.map((key) => [key, false]));
  const controlledKeys = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyJ', 'KeyK']);
  const canvas = document.getElementById('game');
  const zone = document.getElementById('joystick-zone');
  const base = document.getElementById('joystick-base');
  const knob = document.getElementById('joystick-knob');
  let enabled = false;
  let current = blank();

  function clear() {
    core.clear();
    current = blank();
    for (const key of EDGE_ACTIONS) pending[key] = false;
    base.hidden = true;
    knob.style.transform = 'translate(-50%, -50%)';
  }

  function setEnabled(value) {
    if (enabled === value) return;
    enabled = value;
    clear();
  }

  function sample(options = {}) {
    if (!enabled) return blank();
    current = core.poll(options);
    for (const key of EDGE_ACTIONS) pending[key] ||= Boolean(current[key]);
    return current;
  }

  function packet() {
    if (!enabled) return blank();
    const result = { ...current };
    for (const key of EDGE_ACTIONS) {
      result[key] = pending[key];
      pending[key] = false;
    }
    return result;
  }

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
    if (!enabled) return;
    if (controlledKeys.has(event.code)) event.preventDefault();
    core.setKey(event.code, true);
  });
  window.addEventListener('keyup', (event) => core.setKey(event.code, false));
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  canvas.addEventListener('pointerdown', (event) => {
    if (!enabled || event.pointerType !== 'mouse') return;
    if (event.button === 0) core.setAction('punch');
    if (event.button === 2) core.setAction('grab');
  });
  window.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'mouse') return;
    if (event.button === 0) core.setAction('punch', false);
    if (event.button === 2) core.setAction('grab', false);
  });

  function updateStick(stick) {
    const dx = stick.x - stick.originX;
    const dy = stick.y - stick.originY;
    const length = Math.hypot(dx, dy);
    const scale = length > CONFIG.input.joystickRadius ? CONFIG.input.joystickRadius / length : 1;
    knob.style.transform = `translate(calc(-50% + ${dx * scale}px), calc(-50% + ${dy * scale}px))`;
  }

  zone.addEventListener('pointerdown', (event) => {
    if (!enabled || event.pointerType === 'mouse') return;
    event.preventDefault();
    zone.setPointerCapture(event.pointerId);
    const stick = core.beginJoystick(event.pointerId, event.clientX, event.clientY, performance.now() / 1000);
    base.hidden = false;
    const bounds = zone.getBoundingClientRect();
    base.style.left = `${Math.max(72, Math.min(bounds.width - 72, stick.originX - bounds.left))}px`;
    base.style.top = `${Math.max(72, Math.min(bounds.height - 72, stick.originY - bounds.top))}px`;
    updateStick(stick);
  });
  zone.addEventListener('pointermove', (event) => {
    const stick = core.moveJoystick(event.pointerId, event.clientX, event.clientY);
    if (!stick) return;
    event.preventDefault();
    updateStick(stick);
  });
  const endStick = (event) => {
    if (!core.endJoystick(event.pointerId)) return;
    base.hidden = true;
    knob.style.transform = 'translate(-50%, -50%)';
  };
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);

  document.querySelectorAll('.touch-button').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      if (!enabled) return;
      event.preventDefault();
      event.stopPropagation();
      button.setPointerCapture(event.pointerId);
      core.setAction(button.dataset.action, true);
    });
    const release = (event) => {
      core.setAction(button.dataset.action, false);
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', () => core.setAction(button.dataset.action, false));
  });
  document.addEventListener('contextmenu', (event) => event.preventDefault());

  return { sample, packet, clear, setEnabled, get enabled() { return enabled; } };
}
