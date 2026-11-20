// src/render/actors.js — 角色层：主角 + 三个岛民（GLB 带骨骼与 6 段动画 → AnimationMixer 状态机）。
// 只读 sim 状态驱动视觉；判定全在 sim。缺件时回退成胶囊，玩法不受影响。
import { THREE } from '../core/base3d.js';
import { loadCharacter, attachPoint, stripGroundPlane } from '../core/glb.js';
import { ThirdPersonController, OrbitChaseCamera, AnimStateMachine } from '../core/character.js';
import { CONFIG } from '../../config/game.config.js';
import { heightAt } from '../game/terrain.js';
import { MODELS } from '../../lib/models/all.js';

export async function createActors(scene, registry, report = () => {}) {
  const P = CONFIG.player;
  const holder = new THREE.Group();
  scene.add(holder);

  const A = { nodes: {}, anims: {}, mixers: [], carriedMesh: null, ready: false };

  async function build(id, opts) {
    let unit;
    const modelId = MODELS[id] ? id : 'char_keeper';   // NPC 复用守卫网格，靠着色/缩放区分
    try {
      const uri = MODELS[modelId];
      if (!uri) throw new Error('聚合模块里没有 ' + id);
      unit = await loadCharacter(uri, { targetLen: opts.height, forward: '-z' });
      stripGroundPlane(unit.group);
      if (opts.tint) {
        const c = new THREE.Color(opts.tint);
        unit.group.traverse((m) => { if (m.isMesh && m.material) { m.material = m.material.clone(); m.material.color = m.material.color.clone().lerp(c, 0.55); } });
      }
      if (opts.scale && opts.scale !== 1) unit.group.scale.setScalar(opts.scale);
    } catch (e) {
      report(`角色回退 ${id}: ${e.message}`);
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.0, 6, 10), new THREE.MeshLambertMaterial({ color: opts.fallback }));
      body.position.y = 0.9; body.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), new THREE.MeshLambertMaterial({ color: 0xe3b086 }));
      head.position.y = 1.62; head.castShadow = true;
      g.add(body, head);
      const mixer = new THREE.AnimationMixer(g);
      unit = { group: g, clips: {}, mixer, bones: {}, animations: [] };
    }
    unit.group.rotation.y = opts.ry || 0;
    unit.group.position.set(opts.x, heightAt(opts.x, opts.z), opts.z);
    holder.add(unit.group);
    registry.register(opts.key, unit.group, ['actor', opts.key]);
    const anim = new AnimStateMachine(unit.mixer, unit.clips, { crossfadeSec: P.crossfadeSec, runThreshold: P.runThreshold });
    A.nodes[opts.key] = unit;
    A.anims[opts.key] = anim;
    A.mixers.push(unit.mixer);
    A.reportedClips = A.reportedClips || {};
    A.reportedClips[opts.key] = Object.keys(unit.clips);
    return unit;
  }

  const player = await build('char_keeper', { key: 'player', height: 1.75, x: CONFIG.levels[0].spawn.x, z: CONFIG.levels[0].spawn.z, fallback: 0x2f4351, ry: Math.PI / 2 });
  // NPC 复用 Hunyuan3D 守卫网格：靠着色 + 缩放区分人格（避免「一个精致三个方块木偶」）
  const NPC_LOOK = { warden: { tint: 0xb0764a, scale: 1.05 }, netmender: { tint: 0x5f8f8a, scale: 0.96 }, lampchild: { tint: 0x9fbf6f, scale: 0.74 } };
  for (const [id, n] of Object.entries(CONFIG.npcs)) {
    const look = NPC_LOOK[id] || {};
    await build('char_keeper', { key: id, height: 1.75, tint: look.tint, scale: look.scale, x: n.x, z: n.z, ry: n.ry, fallback: 0x4a6b6f });
  }

  const controller = new ThirdPersonController({
    pos: new THREE.Vector3(CONFIG.levels[0].spawn.x, 0, CONFIG.levels[0].spawn.z),
    radius: P.radius, cfg: P,
  });
  const orbit = new OrbitChaseCamera(CONFIG.camera3d || new THREE.PerspectiveCamera(58, 16 / 9, 0.2, 620), CONFIG.camera);

  A.controller = controller;
  A.orbit = orbit;
  A.ready = true;
  A.talking = null;

  // 手里的灯（跟着右手骨头）
  A.setCarried = (items, world) => {
    const want = items.length ? items[items.length - 1].id : null;
    if (want && !A.carriedMesh && world) {
      (async () => {
        try {
          const { loadModel } = await import('../core/glb.js');
          const m = await loadModel(MODELS.prop_lantern_01, { targetLen: 0.4, forward: '+z', key: 'hand_lantern' });
          m.userData.bone = 'arm_R_hand';
          A.carriedMesh = m;
          A.handAnchor = attachPoint(player.group, 'arm_R_hand', 0.55);
        } catch { /* 缺件就不显示手上道具，不影响判定 */ }
      })();
    }
    if (!want && A.carriedMesh) { if (A.carriedMesh.parent) A.carriedMesh.parent.remove(A.carriedMesh); A.carriedMesh = null; }
    return !!A.carriedMesh;
  };

  A.update = (dt, snap, opts = {}) => {
    const key = opts.followKey || 'player';
    const node = A.nodes[key];
    const anim = A.anims[key];
    if (!node || !anim) return;
    const isPlayer = key === 'player';
    const p = isPlayer ? controller.snapshot() : snap.player;
    if (isPlayer) {
      node.group.position.set(p.x, heightAt(p.x, p.z), p.z);
      const targetFacing = p.facing;
      node.group.rotation.y = targetFacing;
      anim.auto({ grounded: p.grounded, speed: p.speed, carrying: snap.weight > 0, run: opts.run, override: A.talking ? 'talk' : null });
      if (A.carriedMesh) {
        const a = attachPoint(node.group, 'arm_R_hand', 0.55);
        A.carriedMesh.position.set(a.x, a.y - 0.15, a.z);
      }
      anim.update(dt);
      return;
    }
    anim.play('idle');
    anim.update(dt);
  };
  return A;
}
