// data-URI GLB 加载（meshopt 内联解码，零网络请求，避免验收重载 abort 在途贴图）。
import * as THREE from 'three';
import { GLTFLoader } from './GLTFLoader.js';
import { MeshoptDecoder } from './meshopt_decoder.module.js';
const _loader = new GLTFLoader();
_loader.setMeshoptDecoder(MeshoptDecoder);
const _cache = new Map();
function b64ToBuf(dataUri) { const b64 = dataUri.split(',')[1]; const bin = atob(b64); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); return buf.buffer; }
function normalize(scene, targetLen, forward) {
  const root = scene.clone(true); const wrap = new THREE.Group(); wrap.add(root);
  let box = new THREE.Box3().setFromObject(root); let size = new THREE.Vector3(); box.getSize(size);
  const s = targetLen / Math.max(size.x, size.y, size.z, 1e-6); root.scale.setScalar(s);
  root.rotation.y = forward === '+x' ? Math.PI / 2 : forward === '-x' ? -Math.PI / 2 : forward === '-z' ? 0 : Math.PI;
  box = new THREE.Box3().setFromObject(wrap); const center = new THREE.Vector3(); box.getCenter(center);
  wrap.position.set(-center.x, -box.min.y, -center.z);
  const outer = new THREE.Group(); outer.add(wrap);
  outer.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return outer;
}
export function loadModelData(dataUri, opts = {}) {
  const targetLen = opts.targetLen ?? 4; const forward = opts.forward ?? '+z';
  const key = (opts.key || dataUri.length) + '|' + targetLen + '|' + forward;
  if (_cache.has(key)) return Promise.resolve(_cache.get(key).clone(true));
  return new Promise((resolve, reject) => { _loader.parse(b64ToBuf(dataUri), '', (gltf) => { const m = normalize(gltf.scene, targetLen, forward); _cache.set(key, m); resolve(m.clone(true)); }, reject); });
}
export function tintModel(group, tint, keep = 0.5) { group.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); if (tint != null) o.material.color = new THREE.Color(tint).lerp(new THREE.Color(0xffffff), keep); o.material.metalness = Math.max(o.material.metalness ?? 0, 0.3); o.material.roughness = Math.min(o.material.roughness ?? 0.6, 0.6); } }); return group; }
