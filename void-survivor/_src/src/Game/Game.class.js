import * as THREE from 'three';
import Sizes from './Utils/Sizes.class';
import Time from './Utils/Time.class';
import Camera from './Core/Camera.class';
import Renderer from './Core/Renderer.class';
import World from './World/World.scene';
import AudioManager from './Managers/AudioManager.class';
import VisibilityManager from './Managers/VisibilityManager.class';
import KeyboardControls from './Input/Keyboard.class';
import Pointer from './Input/Pointer.class';
import UIManager from './UI/UIManager.class';

/**
 * Game — adapted from threejs-gamedev-template.
 * Keeps the template's singleton + Sizes/Time/EventEmitter loop, audio
 * manager, visibility pause. Debug GUI (lil-gui/tweakpane) removed.
 */
export default class Game {
  constructor(canvas, resources) {
    if (Game.instance) {
      return Game.instance;
    }
    Game.instance = this;

    this.canvas = canvas;
    this.resources = resources;
    this.isPaused = false;

    this.visibilityManager = new VisibilityManager();
    this.audioManager = new AudioManager(this.resources);
    this.keyboard = new KeyboardControls();

    this.sizes = new Sizes();
    this.time = new Time();
    this.scene = new THREE.Scene();
    this.camera = new Camera();
    this.renderer = new Renderer();
    this.pointer = new Pointer();
    this.ui = new UIManager(this);

    this.world = new World();

    this.time.on('animate', () => {
      this.update();
    });
    this.sizes.on('resize', () => {
      this.resize();
    });

    this.visibilityManager.on('pause', () => this.pause());
    this.visibilityManager.on('resume', () => this.resume());
  }

  static getInstance() {
    return Game.instance;
  }

  resize() {
    this.camera.resize();
    this.renderer.resize();
  }

  update() {
    if (this.isPaused) return;
    this.world.update();
    this.renderer.update();
    this.keyboard.endFrame();
  }

  pause() {
    if (this.isPaused) return;
    this.isPaused = true;
    if (this.time) this.time.pause();
    if (this.audioManager && !this.audioManager.isMuted) {
      this.audioManager.pauseBGM();
    }
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (this.time) this.time.resume();
    if (this.audioManager && !this.audioManager.isMuted) {
      if (this.audioManager.audioContext?.state === 'suspended') {
        this.audioManager.audioContext.resume().then(() => {
          this.audioManager.resumeBGM();
        });
      } else {
        this.audioManager.resumeBGM();
      }
    }
  }
}