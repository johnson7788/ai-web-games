import * as THREE from 'three';
import { CONFIG } from '../../config/game.config.js';

export function createStage(canvas) {
  // preserveDrawingBuffer: 分享卡要能读到当前帧
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d140e);
  scene.fog = new THREE.Fog(0x2a3a55, 60, 220);

  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 16 / 9, 0.1, 220);

  const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x4a3524, 1.65);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffd9b0, 2.9);
  key.position.set(-6, 12, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const d = 16;
  key.shadow.camera.left = -d; key.shadow.camera.right = d;
  key.shadow.camera.top = d; key.shadow.camera.bottom = -d;
  key.shadow.camera.near = 1; key.shadow.camera.far = 60;
  key.shadow.bias = -0.0008;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(0x6aa8ff, 0.9);
  rim.position.set(10, 5, -14);
  scene.add(rim);

  return { renderer, scene, camera, key };
}

export function resize(stage) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  stage.renderer.setSize(w, h, false);
  stage.camera.aspect = w / h;
  stage.camera.updateProjectionMatrix();
}

/** 相机：略偏航（看到瓦片侧面）+ 略俯视（看到顶面） */
export function applyCamera(stage, cam) {
  const C = CONFIG.camera;
  stage.camera.position.set(cam.x + C.offsetX, cam.y + C.height, C.dist);
  stage.camera.lookAt(cam.x, cam.y, 0);
  // 主光跟着玩家，保证阴影贴图始终覆盖
  stage.key.position.set(cam.x - 6, cam.y + 12, 10);
  stage.key.target.position.set(cam.x, cam.y, 0);
  stage.key.target.updateMatrixWorld();
}
