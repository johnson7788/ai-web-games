// src/render/car.js — AI 生成 GLB 火箭车 + 足球（draco），加载完成前回退低多边形占位。
import * as THREE from 'three';
import { loadModelData, tintModel } from '../../lib/model-loader-data.js';
import carData from '../../lib/models/car.glb.js';
import ballData from '../../lib/models/ball.glb.js';

function makeFlame(accent) {
  const flameMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, toneMapped: false });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 10), flameMat);
  flame.rotation.x = -Math.PI / 2; // 朝 -X（车尾）
  flame.position.set(-2.7, 0.62, 0);
  return { flame, flameMat };
}
function makeBeacon(accent) {
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), new THREE.MeshBasicMaterial({ color: accent, toneMapped: false }));
  beacon.position.set(0, 1.6, 0);
  return beacon;
}
function placeholderCar(color) {
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.45 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.8, 2.2), paint);
  hull.position.y = 0.6; hull.castShadow = true;
  return hull;
}

export function buildCarMesh(color, accent, isPlayer) {
  const group = new THREE.Group();
  const { flame, flameMat } = makeFlame(accent);
  const beacon = makeBeacon(accent);
  group.add(flame, beacon);
  if (isPlayer) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    pole.position.set(0, 2.3, 0);
    group.add(pole);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, toneMapped: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
    group.add(ring);
  }
  let placeholder = placeholderCar(color);
  group.add(placeholder);
  let bodyRef = placeholder;
  loadModelData(carData, { targetLen: 4.0, forward: '+x', key: 'car' }).then((model) => {
    tintModel(model, color, 0.3);
    if (placeholder) { group.remove(placeholder); placeholder = null; }
    group.add(model);
    bodyRef = model;
  }).catch(() => {});
  return {
    group, flameMat, flame, wheels: [], body: bodyRef, beacon,
    setFlame(on) { flameMat.opacity = on ? 0.95 : 0; },
    spinWheels() {},
  };
}

export function buildBallMesh(color) {
  const fallback = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 20, 20),
    new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1 }),
  );
  fallback.castShadow = true;
  const wrap = new THREE.Group();
  wrap.add(fallback);
  loadModelData(ballData, { targetLen: 1.6, forward: '+z', key: 'ball' }).then((model) => {
    wrap.remove(fallback);
    wrap.add(model);
    model.position.y = -0.8; // 球心对齐原点
  }).catch(() => {});
  wrap.castShadow = true;
  return wrap;
}

export function buildPickupMesh(color) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  g.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.08, 6, 20), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  g.userData.core = core;
  g.userData.ring = ring;
  return g;
}