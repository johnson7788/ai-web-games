/**
 * Keyboard — adapted from threejs-gamedev-template (generic key state).
 * Tracks held keys + one-shot presses consumed by systems.
 */
export default class KeyboardControls {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();

    this._onDown = (e) => {
      if (e.repeat) return;
      const codes = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'Enter', 'Digit1', 'Digit2', 'Digit3'];
      if (codes.includes(e.code)) e.preventDefault();
      this.down.add(e.code);
      this.pressed.add(e.code);
    };
    this._onUp = (e) => {
      this.down.delete(e.code);
    };
    this._onBlur = () => {
      this.down.clear();
    };

    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup', this._onUp);
    window.addEventListener('blur', this._onBlur);
  }

  isDown(code) {
    return this.down.has(code);
  }

  consumePress(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
  }

  destroy() {
    window.removeEventListener('keydown', this._onDown);
    window.removeEventListener('keyup', this._onUp);
    window.removeEventListener('blur', this._onBlur);
  }
}