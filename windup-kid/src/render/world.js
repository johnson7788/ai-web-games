import * as THREE from 'three';
import { T } from '../game/level.js';
import { makeGroundAtlas, makeTopGrassBox, makeDirtTexture } from './textures.js';

function hash32(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const PALETTE = {
  [T.SOLID]: 0x8a7154,
  [T.BRICK]: 0xb07d47,
  [T.QUESTION]: 0xe0ad4a,
  [T.HARD]: 0x6a7787,
  [T.ONEWAY]: 0x6f8058,
  [T.SPIKE]: 0xa84343,
  [T.SPRING]: 0x8b9a4a,
};

export function buildWorld(level, env = null) {
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const grassGeo = makeTopGrassBox();
  const groundTex = env?.ground || makeGroundAtlas();
  const dirtTex = env?.dirt || makeDirtTexture();
  const buckets = new Map();

  for (let y = 0; y < level.h; y++) {
    for (let x = 0; x < level.w; x++) {
      const t = level.tileAt(x, y);
      if (!t) continue;
      const surface = t === T.SOLID && level.tileAt(x, y + 1) === T.EMPTY;
      const key = surface ? 'grass' : t;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push([x, y]);
    }
  }

  const dynamic = new Map();
  const usedMat = new THREE.MeshLambertMaterial({ color: 0x6b5f52 });
  const m = new THREE.Matrix4();

  // 弹簧：不画方块，直接铺一张弹簧贴图
  if (env?.spring && buckets.has(T.SPRING)) {
    const cells = buckets.get(T.SPRING);
    const mat = new THREE.MeshBasicMaterial({ map: env.spring, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide });
    mat.toneMapped = false;
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.96, 0.96), mat, cells.length);
    cells.forEach(([x, y], i) => {
      m.makeTranslation(x + 0.5, y + 0.5, 0.52);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    buckets.delete(T.SPRING);
  }

  // 木箱/问号砖会被打碎或变空，用独立 mesh 以便运行时替换
  for (const [type, cells] of [...buckets]) {
    if (type !== T.BRICK && type !== T.QUESTION) continue;
    for (const [x, y] of cells) {
      const tint = type === T.QUESTION ? 0xffe1a0 : 0xffffff;
      let mat;
      if (env?.crate) {
        // 六面材质：顶/底用专用木板顶面，侧面用箱体正面
        const side = new THREE.MeshLambertMaterial({ map: env.crate, color: tint });
        const top = new THREE.MeshLambertMaterial({ map: env.crateTop || env.crate, color: tint });
        mat = [side, side, top, top, side, side];
      } else {
        mat = new THREE.MeshLambertMaterial({ color: PALETTE[type] });
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x + 0.5, y + 0.5, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      dynamic.set(`${x},${y}`, mesh);
    }
    buckets.delete(type);
  }

  for (const [type, cells] of buckets) {
    const isGround = type === T.SOLID || type === 'grass';
    let mat;
    if (type === 'grass') {
      // 地面用 unlit：贴图里已经烘了明暗，Lambert 会让正面朝向的土墙发黑
      mat = new THREE.MeshBasicMaterial({ map: groundTex });
      mat.toneMapped = false;
    } else if (type === T.SOLID) {
      mat = new THREE.MeshBasicMaterial({ map: env?.stone || dirtTex });
      mat.toneMapped = false;
    } else if (type === T.HARD) {
      mat = new THREE.MeshBasicMaterial({ map: env?.stone || dirtTex });
      mat.toneMapped = false;
    } else if (env?.crate && type === T.ONEWAY) {
      mat = new THREE.MeshLambertMaterial({ map: env.crate, color: 0xb9c8a2 });
    } else {
      mat = new THREE.MeshLambertMaterial({ color: PALETTE[type] ?? 0x888888 });
    }
    const mesh = new THREE.InstancedMesh(isGround ? grassGeo : geo, mat, cells.length);
    cells.forEach(([x, y], i) => {
      m.makeTranslation(x + 0.5, y + 0.5, 0);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // 草皮前缘：一排草叶盖住"顶面/侧面"的硬接缝
    if (type === 'grass' && env?.fringe) {
      const fmat = new THREE.MeshBasicMaterial({
        map: env.fringe, transparent: true, alphaTest: 0.28, side: THREE.DoubleSide,
      });
      fmat.toneMapped = false;
      const fgeo = new THREE.PlaneGeometry(1.3, 0.325);
      const fringe = new THREE.InstancedMesh(fgeo, fmat, cells.length);
      cells.forEach(([x, y], i) => {
        m.makeTranslation(x + 0.5, y + 1.16, 0.52);
        fringe.setMatrixAt(i, m);
      });
      fringe.instanceMatrix.needsUpdate = true;
      group.add(fringe);
    }
  }

  // 地表装饰：草丛 / 野花 / 石子，按 x 坐标做确定性散布
  const decalFade = { value: -999 };
  const decalDefs = [
    { tex: env?.tuft, h: [0.22, 0.36], w: null },
    { tex: env?.flower, h: [0.18, 0.3], w: null },
    { tex: env?.decoStone, h: [0.07, 0.13], w: null },
  ].filter((d) => d.tex);

  if (decalDefs.length && buckets.has('grass')) {
    const cells = buckets.get('grass');
    const bucketsByType = decalDefs.map(() => []);
    const place = (x, y, salt) => {
      const r = hash32(x * 73856093 + y * 19349663 + salt);
      if (r > 0.95) return;
      const pick = hash32(x * 83492791 + y * 2654435761 + salt * 7);
      const ti = pick < 0.35 ? 0 : pick < 0.7 ? 1 : 2;
      const def = decalDefs[Math.min(ti, decalDefs.length - 1)];
      const r2 = hash32(x * 1274126177 + y * 2246822519 + salt);
      const r3 = hash32(x * 3266489917 + y * 668265263 + salt);
      const h = def.h[0] + (def.h[1] - def.h[0]) * r2;
      const aspect = def.tex.image.width / def.tex.image.height;
      const w = h * aspect;
      const px = x + 0.18 + r3 * 0.64;
      const py = y + 1 + h / 2 - 0.01;
      const pz = -0.35 + hash32(x * 374761393 + y * 668265263 + salt) * 0.85;
      const rot = (hash32(x * 2147483647 + y * 1274126177 + salt) - 0.5) * 0.18;
      const flip = hash32(x * 1103515245 + y * 12345 + salt) > 0.5 ? -1 : 1;
      bucketsByType[ti].push({ px, py, pz, w, h, rot, flip });
    };
    cells.forEach(([x, y]) => {
      place(x, y, 0);
      if (hash32(x * 2654435761 + y * 40503) < 0.35) place(x, y, 977);
    });

    bucketsByType.forEach((list, ti) => {
      if (!list.length) return;
      const mat = new THREE.MeshBasicMaterial({
        map: decalDefs[ti].tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide,
      });
      mat.toneMapped = false;
      // 玩家靠近时按 x 距离淡出，避免花丛挡住脚
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uPlayerX = decalFade;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uPlayerX;\nvarying float vFade;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvFade = smoothstep(0.35, 1.15, abs(instanceMatrix[3].x - uPlayerX));\n#else\nvFade = 1.0;\n#endif');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vFade;')
          .replace('#include <alphatest_fragment>', 'diffuseColor.a *= vFade;\n#include <alphatest_fragment>');
      };
      mat.customProgramCacheKey = () => 'decal-fade';
      const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, list.length);
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      list.forEach((d, i) => {
        e.set(0, 0, d.rot);
        q.setFromEuler(e);
        pos.set(d.px, d.py, d.pz);
        scl.set(d.w * d.flip, d.h, 1);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    });
  }

  // 地下填充：两层暗色瓦片垫在地面之下，镜头下探时不会露出虚空
  const underMat = new THREE.MeshLambertMaterial({ color: 0x3b2e23 });
  const under = new THREE.InstancedMesh(geo, underMat, level.w * 10);
  let ui = 0;
  for (let x = 0; x < level.w; x++) {
    for (let y = -1; y >= -10; y--) {
      m.makeTranslation(x + 0.5, y + 0.5, 0);
      under.setMatrixAt(ui++, m);
    }
  }
  under.instanceMatrix.needsUpdate = true;
  under.receiveShadow = true;
  group.add(under);

  // 坑洞不再垫背板：地下填充（y=-1..-10）已经挡住虚空，背板会在大场景里露出成一片黑墙


  return {
    group,
    updateDecals(x) { decalFade.value = x; },
    setTile(tx, ty, state) {
      const mesh = dynamic.get(`${tx},${ty}`);
      if (!mesh) return;
      if (state === 'gone') { mesh.visible = false; return; }
      mesh.material = usedMat;
    },
  };
}

/** 3 层视差背景：越远移动越少 */
export function buildBackdrop(level, env = null) {
  const group = new THREE.Group();

  if (env?.backdrop) {
    const mat = new THREE.MeshBasicMaterial({ map: env.backdrop, fog: false, depthWrite: false });
    const h = 96;   // 高度要盖住俯视相机的下缘，否则地面之上会露出背景色
    const w = Math.max(132, h * (env.backdrop.image.width / env.backdrop.image.height));
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    plane.position.z = -55;
    plane.renderOrder = -10;
    group.add(plane);
    return {
      group,
      update(camX, camY = 5) {
        // 远景几乎跟随相机（天空不该滚出画面），近处视差交给地形与装饰
        plane.position.x = camX * 0.97;
        plane.position.y = camY + 3.2;
      },
    };
  }

  const layers = [];
  const specs = [
    { z: -11, k: 0.28, color: 0x2b3a58, count: 16, w: 11, h: 4.5 },
    { z: -23, k: 0.52, color: 0x384b70, count: 12, w: 19, h: 6.5 },
    { z: -40, k: 0.78, color: 0x4b5f8c, count: 9, w: 28, h: 9 },
  ];

  for (const s of specs) {
    const layer = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: s.color });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < s.count; i++) {
      const box = new THREE.Mesh(geo, mat);
      const px = -80 + (i / (s.count - 1)) * (level.w + 180);
      const hh = s.h * (0.6 + ((i * 37) % 100) / 120);
      box.scale.set(s.w, hh, 1);
      box.position.set(px, -2 + hh / 2, s.z + (i % 3) * 3);
      layer.add(box);
    }
    group.add(layer);
    layers.push({ layer, k: s.k });
  }

  return {
    group,
    update(camX) {
      for (const { layer, k } of layers) layer.position.x = camX * (1 - k);
    },
  };
}


/** 齿轮 / 旗杆 / 检查点：可交互物的可见性 */
export function buildEntities(level, env = null) {
  const group = new THREE.Group();
  const brass = new THREE.MeshLambertMaterial({ color: 0xe0ad4a, emissive: 0x3a2a08 });
  const gearGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const gearTex = env?.gear;
  const gearMat = gearTex
    ? new THREE.MeshBasicMaterial({ map: gearTex, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide })
    : null;
  if (gearMat) gearMat.toneMapped = false;
  const coins = level.pickups.map((p) => {
    const m = gearMat
      ? new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), gearMat)
      : new THREE.Mesh(gearGeo, brass);
    m.position.set(p.x, p.y, 0);
    m.castShadow = true;
    group.add(m);
    return m;
  });

  const goalMat = env?.goal
    ? new THREE.MeshBasicMaterial({ map: env.goal, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide })
    : new THREE.MeshLambertMaterial({ color: 0xc0392b });
  if (goalMat.map) goalMat.toneMapped = false;
  if (env?.goal) {
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.0), goalMat);
    flag.position.set(level.goal.x + 0.45, level.goal.y + 1.5, 0.2);
    group.add(flag);
  } else {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4, 0.12), new THREE.MeshLambertMaterial({ color: 0xd8d2c4 }));
    pole.position.set(level.goal.x, level.goal.y + 2, -0.1);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.06), goalMat);
    flag.position.set(level.goal.x + 0.5, level.goal.y + 3.5, -0.1);
    group.add(pole, flag);
  }

  const cpMat = env?.checkpoint
    ? new THREE.MeshBasicMaterial({ map: env.checkpoint, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide })
    : new THREE.MeshLambertMaterial({ color: 0x6fa8dc });
  if (cpMat.map) cpMat.toneMapped = false;
  for (const c of level.checkpoints) {
    const m = env?.checkpoint
      ? new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.6), cpMat)
      : new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 0.14), cpMat);
    m.position.set(c.x, c.y + 1.3, 0.2);
    group.add(m);
  }

  let spin = 0;
  return {
    group,
    update(dt) {
      spin += dt * 2.2;
      level.pickups.forEach((p, i) => {
        const m = coins[i];
        m.visible = !p.taken;
        m.rotation.y = spin;
        m.position.y = p.y + Math.sin(spin * 1.6 + i) * 0.08;
      });
    },
  };
}
