// src/render/island.js — 世界层：地形/天空/光照/昼夜/建筑/道具/实例化散布/分区，并把可交互物登记给观察面。
// 资产来源 = assets/asset-manifest.json（台账）：每件都从 lib/models/<id>.glb.js（data-URI，零网络请求）加载。
import { THREE, createStage, FixedLoop, Input, Pool, mulberry32 } from '../core/base3d.js';
import { loadModel, stripGroundPlane } from '../core/glb.js';
import { createLighting, setTimeOfDay, gradientSky, scatter, Zones } from '../core/world.js';
import { RoomEnvironment } from '../../lib/RoomEnvironment.js';
import { CONFIG } from '../../config/game.config.js';
import { MODELS } from '../../lib/models/all.js';
import { heightAt, colorAt, blockedAt, WATER_Y } from '../game/terrain.js';

const W = CONFIG.world;

export async function createWorld(scene, bible, registry, report = () => {}, rendererRef = {}) {
  // ---- 地形（顶点色，1 DrawCall）----
  const ground = buildGroundMesh();
  scene.add(ground);
  registry.register('terrain', ground, ['static']);
  const sky = gradientSky(scene, { top: bible.sky.top, bottom: bible.sky.bottom, radius: 460 });
  // 有写实天空图就用图（等距柱状贴球壳），没有就保留渐变兜底
  try {
    new THREE.TextureLoader().load('assets/tex/sky_dusk.webp', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.mapping = THREE.EquirectangularReflectionMapping;
      sky.material.map = tex;
      sky.material.vertexColors = false;
      sky.material.needsUpdate = true;
    }, undefined, () => {});
  } catch { /* 没图就渐变 */ }
  const lights = createLighting(scene, bible, { shadows: true });
  // IBL：PBR 金属/湿石头/玻璃要有环境反射才「真」，RoomEnvironment 是零外链的反射源
  {
    const pmrem = new THREE.PMREMGenerator(rendererRef.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;   // 黄昏：环境光只给一点反射，别冲淡主光
  }
  const water = buildWater(scene);
  // ---- 光照参数 ----
  if (scene.renderer) { /* stage 侧配 */ }

  const zones = new Zones();
  const colliders = [];
  const models = {};

  // ---- 模块建筑 + 道具（GLB data-URI；缺件回退到方块，玩法不受影响）----
  async function place(spec, kind) {
    const st = spec.at ? CONFIG.stations.find((s) => s.id === spec.at) : null;
    const x = spec.x != null ? spec.x : st.x;
    const z = spec.z != null ? spec.z : st.z;
    const y = heightAt(x, z);
    const entry = { id: spec.model + '_' + (spec.tag || kind) + '_' + Math.round(x) + '_' + Math.round(z), x, y, z };
    let obj;
    try {
      const uri = MODELS[spec.model];
      if (!uri) throw new Error('聚合模块里没有 ' + spec.model);
      obj = await loadModel(uri, { targetLen: ASSET_LEN[spec.model] || 3, forward: '+z', key: spec.model });
      stripGroundPlane(obj);   // 剥 Hunyuan3D 的黑色阴影捕手底板
    } catch (e) {
      report(`fallback ${spec.model}: ${e.message}`);
      obj = fallbackBox(ASSET_LEN[spec.model] || 3);
    }
    obj.position.set(x, y, z);
    obj.rotation.y = spec.ry || 0;
    if (spec.scale && spec.scale !== 1) obj.scale.setScalar(spec.scale);
    scene.add(obj);
    registry.register(entry.id, obj, [kind, spec.tag || 'decor', spec.zone || '']);
    if (spec.solid) colliders.push({ x, z, r: spec.solid, model: spec.model });
    models[spec.model] = obj;
    return obj;
  }
  for (const b of CONFIG.buildings) await place(b, 'building');
  for (const p of CONFIG.props) await place(p, 'prop');

  // ---- 灯位标记：灯柱 + 可点亮的辉光 ----
  const lampNodes = {};
  for (const s of CONFIG.stations) {
    const y = heightAt(s.x, s.z);
    const group = new THREE.Group();
    group.position.set(s.x, y, s.z);
    const glow = new THREE.PointLight(0xffb45a, 0, s.big ? 26 : 15, 1.8);
    glow.position.set(0, s.big ? 6 : 2.6, 0);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(s.big ? 0.55 : 0.26, 10, 8), new THREE.MeshBasicMaterial({ color: 0x2a1c0c }));
    bulb.position.copy(glow.position);
    // 目标可见性：没点亮的灯位有一束淡光柱，玩家在岛任何位置都能看出「下一个目标在哪」
    const beamH = s.big ? 34 : 22;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(s.big ? 1.5 : 0.7, s.big ? 3.4 : 1.7, beamH, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffb45a, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false, fog: true }),
    );
    beam.position.set(0, (s.big ? 6 : 2.6) + beamH / 2, 0);
    beam.name = 'beam';
    group.add(glow, bulb, beam);
    scene.add(group);
    registry.register('station_' + s.id, group, ['station', s.zone]);
    lampNodes[s.id] = { group, glow, bulb, beam, lit: false };
  }

  // ---- 实例化散布（树/草/石）----
  for (const sc of CONFIG.scatter) {
    const zone = W.zones.find((z) => z.name === sc.zone);
    if (!zone) continue;
    const rnd = mulberry32(hash(sc.model + sc.zone));
    const pts = [];
    let guard = 0;
    while (pts.length < sc.count && guard++ < sc.count * 14) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * zone.r * 0.92;
      const x = zone.x + Math.cos(a) * r, z = zone.z + Math.sin(a) * r;
      const h = heightAt(x, z);
      if (h < WATER_Y + 0.5) continue;
      if (nearPath(x, z) < 1.7) continue;
      // 别把碰撞体撒在出生点/灯位/NPC 脚下：会把玩家钉在原地（表现为「按了 W 但不动」）
      if (crowded(x, z, (sc.solid || 0) + 1.6)) continue;
      pts.push({ x, y: h, z, scale: sc.scale ? sc.scale[0] + rnd() * (sc.scale[1] - sc.scale[0]) : 1, ry: rnd() * Math.PI * 2 });
    }
    if (!pts.length) continue;
    let proto;
    try {
      const uri = MODELS[sc.model];
      if (!uri) throw new Error('聚合模块里没有 ' + sc.model);
      proto = await loadModel(uri, { targetLen: ASSET_LEN[sc.model] || 2, forward: '+z', key: sc.model });
      const first = proto.children[0] && proto.children[0].children[0] ? proto.children[0].children[0] : proto;
      proto = first.geometry ? { geometry: first.geometry, material: first.material } : proto;
    } catch (e) {
      report(`scatter fallback ${sc.model}`);
      proto = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 6), new THREE.MeshLambertMaterial({ color: 0x2f4030 }));
    }
    const im = scatter(scene, { proto, points: pts, name: `scatter_${sc.model}_${sc.zone}`, castShadow: sc.solid > 0, seed: hash(sc.model + sc.zone), scaleRange: sc.scale || [0.9, 1.1] });
    if (im) {
      registry.register(im.name, im, ['scatter', sc.zone]);
      if (sc.solid) for (const p of pts) colliders.push({ x: p.x, z: p.z, r: sc.solid });
    }
  }

  // ---- 分区（按玩家位置开关，控 DrawCall）----
  for (const zone of W.zones) {
    const objs = [];
    registry.forEach((o, k) => {
      const tags = (o.userData && o.userData.tags) || [];
      if (tags.includes(zone.name)) objs.push(o);
    });
    zones.add(zone.name, { center: [zone.x, zone.z], radius: zone.r + 26, objects: objs });
  }

  return {
    scene, lights, sky, water, zones, colliders, lampNodes, models,
    groundAt: (x, z) => heightAt(x, z),
    blockedAt: (x, z) => blockedAt(x, z),
    setTime(t) {
      const night = setTimeOfDay(lights, t);
      if (water.material) water.material.opacity = 0.5 + night * 0.2;
      return night;
    },
    setLamp(id, lit, boost = 1) {
      const n = lampNodes[id];
      if (!n) return false;
      n.lit = lit;
      n.glow.intensity = lit ? (n.group.userData.big ? 9 : 5.2) * boost : 0;
      n.bulb.material.color.setHex(lit ? 0xffc86a : 0x2a1c0c);
      n.bulb.scale.setScalar(lit ? 1.25 : 1);
      if (n.beam) { n.beam.visible = !lit; n.beam.material.opacity = lit ? 0 : (n.group.userData.big ? 0.14 : 0.10); }
      return true;
    },
    wind(dir, gust) {
      water.rotation.z = Math.sin(dir) * 0.02;
      water.position.y = WATER_Y + 0.02 + Math.sin(gust * 3) * 0.06;
    },
    tick(t) {
      // 水面慢波：让海看起来是活的，而不是贴纸
      const pos = water.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        pos.setZ(i, Math.sin(x * 0.12 + t * 1.1) * 0.14 + Math.cos(y * 0.1 + t * 0.7) * 0.12);
      }
      pos.needsUpdate = true;
      water.geometry.computeVertexNormals();
    },
  };
}

let _groundTex = null;
function groundTexture() {
  if (_groundTex) return _groundTex;
  try {
    const tl = new THREE.TextureLoader();
    _groundTex = tl.load('assets/tex/tex_dirt_path.webp');   // 草贴图是「一丛丛」的内容，平铺会出现网格状草球；沙土细节图才是可平铺的底色
    _groundTex.wrapS = _groundTex.wrapT = THREE.RepeatWrapping;
    _groundTex.repeat.set(96, 96);
    _groundTex.colorSpace = THREE.SRGBColorSpace;
    _groundTex.anisotropy = 4;
  } catch { _groundTex = null; }
  return _groundTex;
}
function buildGroundMesh() {
  const seg = W.seg, half = W.half;
  const geo = new THREE.PlaneGeometry(half * 2, half * 2, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, heightAt(x, z));
    colorAt(x, z, c);
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  // AI 出的「seamless」贴图实测并不无缝（平铺出现菱形网格），地形回退纯顶点色；
  // 细节靠顶点色噪声 + 光照 + 雾，风格统一且零贴图成本。
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  mesh.name = 'terrainMesh';
  return mesh;
}
function fallbackBox(len) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(len * 0.8, len, len * 0.8), new THREE.MeshLambertMaterial({ color: 0x51606b }));
  m.position.y = len / 2;
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  return g;
}
function buildWater(scene) {
  const geo = new THREE.PlaneGeometry(W.half * 2.6, W.half * 2.6, 28, 28);
  const mat = new THREE.MeshStandardMaterial({ color: 0x16272f, transparent: true, opacity: 0.86, roughness: 0.16, metalness: 0.0 });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = WATER_Y;
  m.name = 'water';
  scene.add(m);
  return m;
}
function crowded(x, z, minDist) {
  const spots = [CONFIG.levels[0].spawn, ...CONFIG.stations, ...Object.values(CONFIG.npcs)];
  for (const s of spots) if (Math.hypot(x - s.x, z - s.z) < minDist) return true;
  return false;
}
function nearPath(x, z) {
  let d = Infinity;
  const path = CONFIG.world.path;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1)));
    d = Math.min(d, Math.hypot(x - (ax + vx * t), z - (az + vz * t)));
  }
  return d;
}
function hash(s) { let h = 2166136261; for (const c of s) h = (h ^ c.charCodeAt(0)) * 16777619 >>> 0; return h; }

// targetLen 与台账 spec 对齐（台账是唯一真源，这里是它的运行期镜像）
export const ASSET_LEN = {
  build_cottage_a: 5, build_cottage_b: 5.8, build_shed_01: 3.3, build_lighthouse_01: 15, build_pier_platform_01: 6,
  build_stairs_01: 2.5, build_fence_01: 2.3, build_well_01: 1.9, build_boathouse_01: 5.4, prop_lantern_post_01: 3.2,
  env_tree_pine_01: 4.2, env_bush_01: 1.1, env_rock_01: 1.5, env_grass_tuft_01: 0.5, env_crate_stack_01: 1.6,
  prop_rock_cluster_01: 2, prop_boat_row_01: 3.6, prop_net_bundle_01: 1, prop_bell_01: 0.6, prop_lamp_relay_01: 1.2,
  prop_crate_01: 0.9, prop_oil_barrel_01: 0.75, prop_lantern_01: 0.45, prop_storm_glass_01: 0.3,
};
