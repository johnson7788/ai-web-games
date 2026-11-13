/**
 * polyfork.js — polyfork.dev 低多边形模型的本地加载封装
 *
 * 为什么是"本地"：polyfork 的 GLB 网格允许随游戏分发（CC BY 4.0 或 Polyfork 许可），
 * 而 .mjs 源码模块禁止自托管/镜像/随包分发（需 $299/月 platform licence）。
 * 所以这里只吃本地 assets/models/*.glb，永不 import polyfork.dev/cdn。
 *
 * 特点：
 *   - 零额外依赖：只用 three + 内置 GLTFLoader/BufferGeometryUtils（已随 lib/three 固定 r160）
 *   - 并发限流 + 失败重试 + 加载中 Promise 去重（同一模型并发 ensure 只发一次请求）
 *   - 真实进度：track(ids) 后 onProgress 拿到 (loaded, total)，不是假动画
 *   - 懒预热：preheat() 用 requestIdleCallback 分批，不抢首屏带宽
 *   - GLB 里自带的 glTF 动画（polyfork 的 tick 循环）自动挂 AnimationMixer
 *   - mergeStatic() 把一批模型烘成单 draw call（顶点色单材质，这是 polyfork 的设计前提）
 *   - createInstanced() 同模型多份走 InstancedMesh
 *
 * 用法：
 *   import { createModelPool } from './lib/polyfork.js';
 *   import { MODELS } from './assets/models/manifest.js';
 *
 *   const pool = createModelPool({ manifest: MODELS, base: './assets/models/' });
 *   pool.track(['snowman-18c02d']);                       // 首屏要用的
 *   const snowman = await pool.spawn('snowman-18c02d');    // 拿到可独立摆放的实例
 *   scene.add(snowman.object);
 *   // 循环里：snowman.update(dt);   // 有 clips 才需要
 *
 *   pool.preheat(['crate-a1', 'tree-b2']);                // 空闲时段补载
 */

import * as THREE from 'three';
import { GLTFLoader } from './three/loaders/GLTFLoader.js';
import { mergeGeometries } from './three/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from './three/utils/SkeletonUtils.js';

const DEFAULTS = {
  base: './assets/models/',
  manifest: [],
  concurrency: 4,
  retries: 1,
  shadows: true,
};

/** 简单的并发闸门：超过上限就排队，而不是一次性打满连接池 */
function createLimiter(max) {
  const queue = [];
  let active = 0;
  const pump = () => {
    if (active >= max || queue.length === 0) return;
    const job = queue.shift();
    active += 1;
    Promise.resolve()
      .then(job.fn)
      .then(job.resolve, job.reject)
      .finally(() => {
        active -= 1;
        pump();
      });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    pump();
  });
}

/** 把 node 到 root 之间的祖先链重建出来，保留每层局部变换（用于保住 pivot 支点） */
function cloneChain(node, root) {
  const chain = [];
  let cur = node;
  while (cur && cur !== root) {
    chain.unshift(cur);
    cur = cur.parent;
  }
  if (chain.length === 0) return null;

  root.updateWorldMatrix(true, false);
  const wrap = new THREE.Group();          // 承载 root 的世界变换
  root.matrixWorld.decompose(wrap.position, wrap.quaternion, wrap.scale);

  let parent = wrap;
  for (const src of chain) {
    // 末端（pivot 本体）连同其网格一起克隆；中间层只重建变换
    const clone = src === node ? src.clone(true) : new THREE.Object3D();
    if (src !== node) {
      clone.position.copy(src.position);
      clone.quaternion.copy(src.quaternion);
      clone.scale.copy(src.scale);
    }
    parent.add(clone);
    parent = clone;
  }
  return { object: wrap, pivot: node.name };
}

/** 该 mesh 是否挂在某个 pivot 子树下（这些不能烘进静态合并，否则动画失效） */
function underAny(node, root, names) {
  let cur = node;
  while (cur && cur !== root) {
    if (cur.name && names.has(cur.name)) return true;
    cur = cur.parent;
  }
  return false;
}

/** 把一个模型的网格烘成"以自身原点为基准"的单个 geometry（用于 InstancedMesh） */
function bakeGeometry(object) {
  object.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
  const geoms = [];
  object.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    g.applyMatrix4(inv);
    geoms.push(g);
  });
  if (geoms.length === 0) return null;
  const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
  if (merged !== geoms[0]) geoms.forEach((g) => g.dispose());
  return merged;
}

/**
 * 把一批已摆好位置的模型合并成单次 draw call。
 * 返回 { merged, dynamic }：merged 是静态合并网格，dynamic 是仍可动的支点链条。
 * 用法：const { merged, dynamic } = mergeStatic(parts); scene.add(merged); dynamic.forEach(d => scene.add(d.object));
 */
export function mergeStatic(objects, { material = null } = {}) {
  const geoms = [];
  const dynamic = [];
  let mat = material;

  for (const root of objects) {
    root.updateWorldMatrix(true, true);
    const pivotNames = new Set(root.userData.pivots || []);

    for (const name of pivotNames) {
      const node = root.getObjectByName(name);
      if (!node) continue;
      const chain = cloneChain(node, root);
      if (chain) dynamic.push(chain);
    }

    root.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      if (pivotNames.size > 0 && underAny(o, root, pivotNames)) return;
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      geoms.push(g);
      if (!mat) mat = o.material;
    });
  }

  if (geoms.length === 0) return { merged: null, dynamic };

  // mergeGeometries 要求属性集一致：按属性签名分组，取最大组（polyfork 全是同规格，正常只会有一组）
  const groups = new Map();
  for (const g of geoms) {
    const key = Object.keys(g.attributes).sort().join(',') + '|' + (g.index ? 'i' : 'n');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  }
  let biggest = null;
  for (const list of groups.values()) if (!biggest || list.length > biggest.length) biggest = list;
  const dropped = geoms.length - biggest.length;
  if (dropped > 0) console.warn(`[polyfork] mergeStatic：${dropped} 个网格属性规格不一致，已跳过`);

  const mergedGeo = biggest.length === 1 ? biggest[0] : mergeGeometries(biggest, false);
  // 合并后的 buffer 是新的，输入克隆体可以全部释放（mergedGeo 自己除外）
  geoms.forEach((g) => { if (g !== mergedGeo) g.dispose(); });

  const merged = new THREE.Mesh(mergedGeo, mat);
  merged.castShadow = true;
  merged.receiveShadow = true;
  merged.name = 'polyfork-merged';
  return { merged, dynamic };
}

/** 模型实例：object 是独立副本，update(dt) 只在模型自带动画时才需要调 */
function buildInstance(id, object, clips, meta, clipName = null) {
  let mixer = null;
  const actions = new Map();
  let ownsMaterials = false;   // 只有 tint() 克隆过材质才由本实例负责释放

  let autoName = null;
  if (clips && clips.length > 0) {
    mixer = new THREE.AnimationMixer(object);
    for (const clip of clips) actions.set(clip.name, mixer.clipAction(clip));
    // polyfork 道具通常只有一条 tick；角色会有 Idle/Walk/Run 多条，
    // 同时播会互相覆盖，所以多 clip 时默认只播指定的那条。
    autoName = clipName || (clips.length === 1 ? clips[0].name : null);
  }

  const inst = {
    id,
    object,
    mixer,
    actions,
    clips: clips || [],
    current: null,
    meta: meta || null,
    /** 支点：inst.pivot('scarf-tail').rotation.y = ... */
    pivot(name) {
      return object.getObjectByName(name);
    },
    /** 切动画（角色用）：inst.play('Walk'); 传 fade 秒数做交叉淡入 */
    play(name, { fade = 0.2 } = {}) {
      const action = actions.get(name);
      if (!action) {
        console.warn(`[polyfork] ${id} 没有动画 ${name}，可选：${[...actions.keys()].join('/')}`);
        return inst;
      }
      if (inst.current === action) return inst;
      if (fade > 0 && inst.current) action.crossFadeFrom(inst.current, fade, false);
      else {
        actions.forEach((a) => a.stop());
        action.reset();
      }
      action.play();
      inst.current = action;
      return inst;
    },
    /** 循环里调，dt 单位秒 */
    update(dt) {
      if (mixer) mixer.update(dt);
    },
    /** 整体染色（顶点色 × 材质色）：会各自克隆材质，不影响其他实例 */
    tint(color) {
      const c = new THREE.Color(color);
      object.traverse((o) => {
        if (!o.isMesh) return;
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.color.copy(c));
      });
      ownsMaterials = true;
      return inst;
    },
    /** 尺寸（米）：来自 manifest，取自 polyfork 元数据 */
    get size() {
      return (meta && meta.size) || null;
    },
    /**
     * 只解绑本实例：停动画、从父级摘掉。
     * 几何体和共享材质归原型所有，不能在这里 dispose（否则同 id 的其他实例一起白屏），
     * 真正回收走 pool.dispose()。
     */
    dispose() {
      if (mixer) {
        mixer.stopAllAction();
        mixer.uncacheRoot(object);
        mixer = null;
      }
      if (ownsMaterials) {
        object.traverse((o) => {
          if (!o.isMesh) return;
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose());
        });
      }
      object.removeFromParent();
    },
  };
  if (autoName && mixer) inst.play(autoName, { fade: 0 });
  return inst;
}

export function createModelPool(userOpts = {}) {
  const opts = { ...DEFAULTS, ...userOpts };
  const base = opts.base.endsWith('/') ? opts.base : opts.base + '/';

  const metaById = new Map();
  for (const m of opts.manifest || []) metaById.set(m.id, m);

  const loader = new GLTFLoader();
  const limit = createLimiter(Math.max(1, opts.concurrency));
  const proto = new Map();       // id -> { root, clips, meta }
  const pending = new Map();     // id -> Promise（去重）
  const loaded = new Set();
  const tracked = new Set();
  let onProgress = opts.onProgress || null;

  const emit = () => {
    if (!onProgress) return;
    const total = tracked.size || metaById.size;
    onProgress({ loaded: loaded.size, total, ratio: total ? loaded.size / total : 0, ids: [...loaded] });
  };

  async function fetchOne(id) {
    const meta = metaById.get(id);
    if (!meta) throw new Error(`[polyfork] manifest 里没有 ${id}`);
    const url = base + (meta.file || `${id}.glb`);
    let lastErr = null;
    for (let attempt = 0; attempt <= opts.retries; attempt += 1) {
      try {
        const gltf = await loader.loadAsync(url);
        const root = gltf.scene;
        root.userData.pivots = meta.pivots || [];
        root.userData.assetId = id;
        root.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = Boolean(opts.shadows);
          o.receiveShadow = Boolean(opts.shadows);
          // polyfork 是顶点色单材质：确保顶点色生效（GLTFLoader 一般已设好，这里兜底）
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { if (m && m.vertexColors === undefined) m.vertexColors = true; });
        });
        proto.set(id, { root, clips: gltf.animations || [], meta });
        loaded.add(id);
        emit();
        return root;
      } catch (err) {
        lastErr = err;
      }
    }
    throw new Error(`[polyfork] 加载失败 ${url}: ${lastErr && lastErr.message}`);
  }

  const pool = {
    /** 声明本作真正要用的模型，用于算真实进度 */
    track(ids) {
      ids.forEach((id) => tracked.add(id));
      emit();
      return pool;
    },

    /** 进度快照 */
    get progress() {
      const total = tracked.size || metaById.size;
      return { loaded: loaded.size, total, ratio: total ? loaded.size / total : 0 };
    },

    has(id) { return proto.has(id); },
    ids() { return [...metaById.keys()]; },

    /** 载入并返回原型（同一 id 并发只发一次请求） */
    ensure(id) {
      if (proto.has(id)) return Promise.resolve(proto.get(id).root);
      if (pending.has(id)) return pending.get(id);
      const p = limit(() => fetchOne(id)).finally(() => pending.delete(id));
      pending.set(id, p);
      return p;
    },

    /** 载入并克隆出一个可摆放实例（推荐直接用这个） */
    async spawn(id, { tint = null, clip = null } = {}) {
      await pool.ensure(id);
      const rec = proto.get(id);
      // 蒙皮模型必须走 SkeletonUtils.clone，普通 clone 会和外层共用骨架
      const object = cloneSkinned(rec.root);
      object.userData.pivots = rec.meta.pivots || [];
      object.userData.assetId = id;
      const inst = buildInstance(id, object, rec.clips, rec.meta, clip);
      if (tint !== null) inst.tint(tint);
      return inst;
    },

    /** 一批一起载入，并发受 concurrency 限制 */
    async preload(ids) {
      pool.track(ids);
      return Promise.all(ids.map((id) => pool.ensure(id)));
    },

    /**
     * 空闲预热：requestIdleCallback 逐个补载，失败静默（等真正 spawn 时还会重试）
     * 注意：别用它替代首屏的 await，只用于"下一关可能用到"的资源
     */
    preheat(ids, { timeout = 2000 } = {}) {
      const ric = window.requestIdleCallback || ((cb) => setTimeout(() => cb({ timeRemaining: () => 8 }), 120));
      let i = 0;
      const step = (deadline) => {
        while (i < ids.length && (deadline.timeRemaining() > 6 || deadline.didTimeout)) {
          const id = ids[i++];
          if (!proto.has(id)) pool.ensure(id).catch(() => {});
        }
        if (i < ids.length) ric(step, { timeout });
      };
      ric(step, { timeout });
      return pool;
    },

    /** 同模型多份：单 geometry + InstancedMesh，最省内存 */
    async createInstanced(id, count, { material = null } = {}) {
      await pool.ensure(id);
      const rec = proto.get(id);
      const geo = bakeGeometry(rec.root);
      if (!geo) throw new Error(`[polyfork] ${id} 没有可用网格`);
      let mat = material;
      if (!mat) rec.root.traverse((o) => { if (!mat && o.isMesh) mat = o.material; });
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      mesh.castShadow = Boolean(opts.shadows);
      mesh.receiveShadow = Boolean(opts.shadows);
      mesh.userData.assetId = id;
      return mesh;
    },

    /** 把一批实例合并成单 draw call，见 mergeStatic */
    merge(instances, mergeOpts) {
      return mergeStatic(instances.map((i) => (i.object ? i.object : i)), mergeOpts);
    },

    /** 换 onProgress 回调 */
    onProgress(fn) { onProgress = fn; return pool; },

    /** 释放全部原型（切场景时调用） */
    dispose() {
      for (const rec of proto.values()) {
        rec.root.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry?.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m?.dispose());
        });
      }
      proto.clear();
      loaded.clear();
    },
  };

  return pool;
}

/** 便捷写法：直接吃 manifest 模块 */
export function poolFromManifest(MODELS, opts = {}) {
  return createModelPool({ manifest: MODELS, ...opts });
}

/** polyfork 的 GLB 原点在地面（minY = 0），摆位直接 position.y = 地面高度 */
export function groundY(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  return -box.min.y;
}
