import * as THREE from 'three';
import Game from '../Game.class';

/**
 * Renderer — adapted from threejs-gamedev-template (debug/tweakpane removed).
 */
export default class Renderer {
  constructor() {
    this.game = Game.getInstance();
    this.canvas = this.game.canvas;
    this.sizes = this.game.sizes;
    this.scene = this.game.scene;
    this.camera = this.game.camera;

    this.rendererInstance = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });

    this.rendererInstance.toneMapping = THREE.ACESFilmicToneMapping;
    this.rendererInstance.toneMappingExposure = 1.15;
    this.rendererInstance.shadowMap.enabled = false;
    this.rendererInstance.setSize(this.sizes.width, this.sizes.height);
    this.rendererInstance.setPixelRatio(this.sizes.pixelRatio);
  }

  resize() {
    this.rendererInstance.setSize(this.sizes.width, this.sizes.height);
    this.rendererInstance.setPixelRatio(this.sizes.pixelRatio);
  }

  update() {
    this.rendererInstance.render(this.scene, this.camera.cameraInstance);
  }
}