import * as THREE from 'three';
import Game from '../Game.class';

/**
 * Pointer — canvas-relative mouse aiming (NO pointer lock, sandbox-safe)
 * plus optional touch: left-half virtual joystick, right-half aim+fire.
 */
export default class Pointer {
  constructor() {
    this.game = Game.getInstance();
    this.canvas = this.game.canvas;

    this.ndc = new THREE.Vector2(0, -0.4);
    this.hasMouse = false;
    this.firing = false;
    this.aimPoint = new THREE.Vector3(0, 0, -6);

    // touch joystick state
    this.stickVec = { x: 0, y: 0 };
    this.stickId = null;
    this.aimTouchId = null;
    this.touchDash = false;

    this._raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hit = new THREE.Vector3();

    this._onMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.ndc.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
      this.hasMouse = true;
    };
    this._onDown = (e) => {
      if (e.pointerType === 'touch') return; // touch handled separately
      if (e.button === 0) {
        this._onMove(e);
        this.firing = true;
      }
    };
    this._onUp = (e) => {
      if (e.pointerType === 'touch') return;
      if (e.button === 0) this.firing = false;
    };
    this._onLeave = () => {
      this.firing = false;
    };
    this._onCtx = (e) => e.preventDefault();

    this.canvas.addEventListener('pointermove', this._onMove);
    this.canvas.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointerup', this._onUp);
    this.canvas.addEventListener('pointerleave', this._onLeave);
    this.canvas.addEventListener('contextmenu', this._onCtx);

    this._setupTouch();
  }

  _setupTouch() {
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const stick = document.getElementById('vs-stick');
    const nub = document.getElementById('vs-stick-nub');
    const dashBtn = document.getElementById('vs-touch-dash');
    if (!stick || !nub || !dashBtn) return;

    const stickCenter = () => {
      const r = stick.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, rad: r.width / 2 };
    };

    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.stickId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      this._stickMove(e, stickCenter(), nub);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) this._stickMove(e, stickCenter(), nub);
    });
    const stickEnd = (e) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.stickVec.x = 0;
      this.stickVec.y = 0;
      nub.style.transform = 'translate(-50%, -50%)';
    };
    stick.addEventListener('pointerup', stickEnd);
    stick.addEventListener('pointercancel', stickEnd);

    dashBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.touchDash = true;
    });

    // right-half canvas touch = aim + fire
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      const r = this.canvas.getBoundingClientRect();
      if (e.clientX - r.left < r.width * 0.45) return; // left side = move zone
      this.aimTouchId = e.pointerId;
      this._touchAim(e, r);
      this.firing = true;
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch' || e.pointerId !== this.aimTouchId) return;
      this._touchAim(e, this.canvas.getBoundingClientRect());
    });
    const aimEnd = (e) => {
      if (e.pointerType !== 'touch' || e.pointerId !== this.aimTouchId) return;
      this.aimTouchId = null;
      this.firing = false;
    };
    this.canvas.addEventListener('pointerup', aimEnd);
    this.canvas.addEventListener('pointercancel', aimEnd);
  }

  _stickMove(e, c, nub) {
    let dx = (e.clientX - c.x) / c.rad;
    let dy = (e.clientY - c.y) / c.rad;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    this.stickVec.x = dx;
    this.stickVec.y = dy;
    nub.style.transform = `translate(calc(-50% + ${dx * 34}px), calc(-50% + ${dy * 34}px))`;
  }

  _touchAim(e, r) {
    this.ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.hasMouse = true;
  }

  /** Project the pointer onto the ground plane; returns world aim point. */
  updateAim() {
    const camera = this.game.camera.cameraInstance;
    this._raycaster.setFromCamera(this.ndc, camera);
    if (this._raycaster.ray.intersectPlane(this._plane, this._hit)) {
      this.aimPoint.copy(this._hit);
    }
    return this.aimPoint;
  }

  consumeTouchDash() {
    const v = this.touchDash;
    this.touchDash = false;
    return v;
  }

  destroy() {
    this.canvas.removeEventListener('pointermove', this._onMove);
    this.canvas.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointerup', this._onUp);
    this.canvas.removeEventListener('pointerleave', this._onLeave);
    this.canvas.removeEventListener('contextmenu', this._onCtx);
  }
}