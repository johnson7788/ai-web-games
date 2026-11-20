// runtime/glb.js — 3D 资产加载（data-URI 内联 GLB，零网络请求）。脚手架复制到 src/core/glb.js。
// 为什么必须 data-URI：平台 iframe 是 opaque origin，运行期 fetch/blob 会 abort；断网也要可玩。
// 与 lib/model-loader-data.js 同源同规矩，额外支持：角色（要动画与骨骼）、按骨头名找挂点。
import * as THREE from '../../lib/three.module.js';
import { GLTFLoader } from '../../lib/GLTFLoader.js';
import { MeshoptDecoder } from '../../lib/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

function b64ToBuf(dataUri) {
  const bin = atob(String(dataUri).split(',')[1]);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
/** 归一化：最大边缩到 targetLen、按 forward 转向、底面落地 y=0、x/z 居中 */
function normalize(gltfScene, targetLen, forward) {
  const root = gltfScene.clone(true);
  const wrap = new THREE.Group();
  wrap.add(root);
  let box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const s = targetLen / Math.max(size.x, size.y, size.z, 1e-6);
  root.scale.setScalar(s);
  root.rotation.y = forward === '+x' ? Math.PI / 2 : forward === '-x' ? -Math.PI / 2 : forward === '-z' ? 0 : Math.PI;
  box = new THREE.Box3().setFromObject(wrap);
  const c = new THREE.Vector3();
  box.getCenter(c);
  wrap.position.set(-c.x, -box.min.y, -c.z);
  const outer = new THREE.Group();
  outer.add(wrap);
  outer.userData.modelRoot = root;
  return outer;
}
/** 单体道具/建筑：只要网格，不要动画 */
export function loadModel(dataUri, { targetLen = 1, forward = '+z', key = '', shadows = true } = {}) {
  const ck = (key || dataUri.length) + '|' + targetLen + '|' + forward;
  if (cache.has(ck)) return Promise.resolve(cache.get(ck).clone(true));
  return new Promise((resolve, reject) => {
    loader.parse(b64ToBuf(dataUri), '', (gltf) => {
      const m = normalize(gltf.scene, targetLen, forward);
      m.traverse((o) => { if (o.isMesh) { o.castShadow = shadows; o.receiveShadow = shadows; } });
      cache.set(ck, m);
      resolve(m.clone(true));
    }, reject);
  });
}
/**
 * 角色：返回 { group, clips, mixer, bones } —— 自己建 mixer（clip 名 = Blender action 名）。
 * 注意：蒙皮网格**不能 clone**（clone 出来的 SkinnedMesh 仍指向原 skeleton，动画会失效），
 * 所以这里直接原地归一化 gltf.scene；要多个 NPC 就各自 parse 一次（data-URI 已在内存，代价可接受）。
 * 用 AnimationMixer + 交叉淡入淡出，别自己手 K 变换。
 */
export function loadCharacter(dataUri, { targetLen = 1.75, forward = '-z' } = {}) {
  return new Promise((resolve, reject) => {
    loader.parse(b64ToBuf(dataUri), '', (gltf) => {
      const root = gltf.scene;
      root.scale.setScalar(1);   // 角色按米制建模，不缩放（Box3 对蒙皮网格量不准）
      root.rotation.y = forward === '+x' ? Math.PI / 2 : forward === '-x' ? -Math.PI / 2 : forward === '-z' ? 0 : Math.PI;
      const wrap = new THREE.Group();
      wrap.add(root);
      let box = new THREE.Box3().setFromObject(wrap);
      const c = new THREE.Vector3();
      box.getCenter(c);
      wrap.position.set(-c.x, -box.min.y, -c.z);
      const group = new THREE.Group();
      group.add(wrap);
      group.userData.modelRoot = root;
      group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }); // 蒙皮网格必须关视锥裁剪
      const mixer = new THREE.AnimationMixer(root);
      const clips = {};
      for (const c2 of gltf.animations || []) {
        let nm = c2.name;
        if (!nm && c2.tracks[0]) {
          const suffix = String(c2.tracks[0].name).split('.').pop();
          if (['rotation', 'quaternion', 'position', 'scale'].indexOf(suffix) < 0) { nm = suffix; c2.name = suffix; }
        }
        if (nm) clips[nm] = c2;
      }
      const bones = {};
      root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
      resolve({ group, clips, mixer, bones, animations: Object.keys(clips) });
    }, reject);
  });
}
/** 找骨头挂点（手里的灯笼、背上的包袱）：找不到就退回物体顶部中心 */
export function attachPoint(rootObject, boneName, fallbackYRatio = 0.62) {
  let bone = null;
  rootObject.traverse((o) => { if (!bone && o.isBone && o.name === boneName) bone = o; });
  if (bone) { const p = new THREE.Vector3(); bone.getWorldPosition(p); return p; }
  const bb = new THREE.Box3().setFromObject(rootObject);
  const c = new THREE.Vector3();
  bb.getCenter(c);
  return new THREE.Vector3(c.x, THREE.MathUtils.lerp(bb.min.y, bb.max.y, fallbackYRatio), c.z);
}

/** 运行期剥阴影捕手：Hunyuan3D 的底板是贴底、法线近垂直的大片三角形，材质全黑。
 *  在 three 侧按「局部 bbox 底部 6% + |normal.y|>0.6」剔掉，比 Blender 侧更稳（不依赖导出顺序）。 */
export function stripGroundPlane(group, frac = 0.06, nrm = 0.6) {
  const box = new THREE.Box3().setFromObject(group);
  const h = Math.max(0.05, box.max.y - box.min.y);
  const cut = box.min.y + h * frac;
  let removed = 0;
  group.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    const pos = g.attributes.position;
    let nor = g.attributes.normal;
    if (!pos) return;
    if (!nor) { g.computeVertexNormals(); nor = g.attributes.normal; }   // Hunyuan 网格可能没带法线
    if (!nor) return;
    o.updateWorldMatrix(true, false);
    const keep = [];
    const idx = g.index ? g.index.array : null;
    const count = idx ? idx.length : pos.count;
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i += 3) {
      const a = idx ? idx[i] : i, b2 = idx ? idx[i + 1] : i + 1, c = idx ? idx[i + 2] : i + 2;
      let drop = true;
      for (const t of [a, b2, c]) {
        // 法线要转到世界空间再判：glTF 的 yup 转换与 forward 旋转都在节点上，局部法线不可信
        v.set(nor.getX(t), nor.getY(t), nor.getZ(t)).transformDirection(o.matrixWorld);
        const wy = o.localToWorld(new THREE.Vector3(pos.getX(t), pos.getY(t), pos.getZ(t))).y;
        if (!(Math.abs(v.y) > nrm && wy < cut)) { drop = false; break; }
      }
      if (!drop) keep.push(a, b2, c);
      else removed++;
    }
    if (removed && keep.length !== count) {
      if (idx) g.setIndex(keep);
      else {
        // 非索引几何：重建 position/normal/uv/color
        const rebuild = (attr, itemSize) => {
          if (!attr) return;
          const src = attr.array, dst = new src.constructor((keep.length / 3) * 3 * itemSize);
          for (let t = 0; t < keep.length; t++) for (let k = 0; k < itemSize; k++) dst[t * itemSize + k] = src[keep[t] * itemSize + k];
          attr.array = dst; attr.count = keep.length; attr.needsUpdate = true;
        };
        rebuild(pos, 3); rebuild(nor, 3); rebuild(g.attributes.uv, 2); rebuild(g.attributes.color, 3);
      }
      g.computeBoundingBox(); g.computeBoundingSphere();
    }
  });
  return removed;
}
