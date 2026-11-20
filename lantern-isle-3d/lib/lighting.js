import { RoomEnvironment } from './RoomEnvironment.js';
// PBR 环境反射 + ACES 色调映射 + 软阴影 + 主光/半球光。setupLighting(THREE, renderer, scene, opts)
export function setupLighting(THREE, renderer, scene, opts = {}) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const sun = new THREE.DirectionalLight(0xffffff, opts.sunIntensity ?? 1.6);
  sun.position.set(...(opts.sunPos ?? [20, 30, 15]));
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.far = 150;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(opts.sky ?? 0xbfd4ff, opts.ground ?? 0x3a2f24, opts.hemiIntensity ?? 0.5));
  return sun;
}
