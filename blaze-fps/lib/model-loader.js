import * as THREE from './three.module.js';
import { GLTFLoader } from './GLTFLoader.js';
import { DRACOLoader } from './DRACOLoader.js';
// GLB 加载 + 归一化。按 URL 缓存原始 GLB（只 fetch 一次），变体复用；preloadModel 启动预载避免验收重载 abort。
const _draco = new DRACOLoader();
_draco.setDecoderPath('lib/draco/');
_draco.setDecoderConfig({ type: 'js' });
_draco.preload();
const _loader = new GLTFLoader();
_loader.setDRACOLoader(_draco);
const _gltfCache = new Map();   // url -> Promise<THREE.Group>（原始场景）
const _normCache = new Map();   // url|len|forward -> 归一化模型
function fetchGLB(url) {
  if (!_gltfCache.has(url)) {
    _gltfCache.set(url, new Promise((resolve, reject) => {
      _loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    }));
  }
  return _gltfCache.get(url);
}
export function preloadModel(url) { return fetchGLB(url).catch(() => null); }
function normalize(scene, targetLen, forward) {
  const root = scene.clone(true);
  const wrap = new THREE.Group(); wrap.add(root);
  let box = new THREE.Box3().setFromObject(root);
  let size = new THREE.Vector3(); box.getSize(size);
  const s = targetLen / Math.max(size.x, size.y, size.z, 1e-6);
  root.scale.setScalar(s);
  root.rotation.y = forward === '+x' ? Math.PI / 2 : forward === '-x' ? -Math.PI / 2 : forward === '-z' ? 0 : Math.PI;
  box = new THREE.Box3().setFromObject(wrap);
  const center = new THREE.Vector3(); box.getCenter(center);
  wrap.position.set(-center.x, -box.min.y, -center.z);
  const outer = new THREE.Group(); outer.add(wrap);
  outer.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return outer;
}
export function loadModel(url, opts = {}) {
  const targetLen = opts.targetLen ?? 4;
  const forward = opts.forward ?? '+z';
  const key = url + '|' + targetLen + '|' + forward;
  if (_normCache.has(key)) return Promise.resolve(_normCache.get(key).clone(true));
  return fetchGLB(url).then((scene) => {
    const m = normalize(scene, targetLen, forward);
    _normCache.set(key, m);
    return m.clone(true);
  });
}
export function tintModel(group, tint, keep = 0.5) {
  group.traverse((o) => {
    if (o.isMesh && o.material) {
      o.material = o.material.clone();
      if (tint != null) o.material.color = new THREE.Color(tint).lerp(new THREE.Color(0xffffff), keep);
      o.material.metalness = Math.max(o.material.metalness ?? 0, 0.3);
      o.material.roughness = Math.min(o.material.roughness ?? 0.6, 0.6);
    }
  });
  return group;
}
