import * as THREE from 'three';
import Game from '../Game.class';

/**
 * Camera — adapted from threejs-gamedev-template.
 * OrbitControls replaced with a smooth top-down follow rig (no pointer lock
 * needed: aiming is canvas-relative). RenderSystem drives position/shake.
 */
export default class Camera {
  constructor(fov = 50, near = 0.1, far = 220) {
    this.game = Game.getInstance();
    this.sizes = this.game.sizes;
    this.scene = this.game.scene;

    this.cameraInstance = new THREE.PerspectiveCamera(
      fov,
      this.sizes.width / this.sizes.height,
      near,
      far,
    );
    this.cameraInstance.position.set(0, 26, 16);
    this.cameraInstance.lookAt(0, 0, 0);
    this.scene.add(this.cameraInstance);

    // Follow rig offset (top-down ~58deg)
    this.offset = new THREE.Vector3(0, 25, 14.5);
    this.lookAhead = new THREE.Vector3();
  }

  resize() {
    this.cameraInstance.aspect = this.sizes.width / this.sizes.height;
    this.cameraInstance.updateProjectionMatrix();
  }

  update() {
    // driven by RenderSystem
  }
}